/*
 * 联网对战的服务器裁判（2026-10-24）
 *
 * 以前切磋、争霸赛、精灵大乱斗由发起方的浏览器结算（双方的出招都发给发起方，它算完再转给对方），发起方理论上可以作弊。
 * 现在由服务器结算：服务器用 js/engine/pvp.js 把双方配队变成对战用的精灵、用 js/engine/battle.js 结算每一回合，
 * 双方浏览器都只提交出招、播放服务器发来的结果。
 *
 * 和浏览器之间的消息（都在 { type: 'mm', id, data } 里）：
 *   ← { k: 'init', S }                         对战开始（服务器 → 双方）
 *   → { k: 'act', a } / { k: 'repl', i } / { k: 'quit' }   出招 / 倒下后选替补 / 认输（浏览器 → 服务器）
 *   ← { k: 'turn', evs, S, sec, quit? }        这一回合的结果（服务器 → 双方）
 *   → { k: 'emote', e }                        表情，原样转给对方
 * 每回合 TURN_SEC 秒（再多给 15 秒播放动画），超时没出招的一方由服务器代选。
 *
 * 旧页面（没有这套代码的）不认识服务器裁判；GRACE_UNTIL 之前双方有一方是旧页面时，仍按旧办法由发起方结算，之后拒绝开打并提示刷新。
 */
'use strict';

var TURN_SEC = 90, GRACE_UNTIL = Date.UTC(2026, 9, 25, 16, 0, 0);   // 北京时间 2026-10-26 00:00
var PV = 2;   // 浏览器在 auth 里报的联网对战协议版本，2 = 支持服务器裁判

function X() { return require('./tx').engine(); }
function out(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

// 这场对战能不能由服务器当裁判；不能时 legacy 表示还能按旧办法打，否则要提示刷新
function mode(m) {
  if (!X()) return { srv: false, legacy: true };
  var ok = m.socks.every(function (w) { return (w.pv | 0) >= PV; });
  if (ok) return { srv: true };
  return { srv: false, legacy: Date.now() < GRACE_UNTIL };
}

function send(m, data) {
  if (m.S) data = JSON.parse(X().battleJSON(m.S, data));   // 精灵之间的相互引用去掉，免得转 JSON 时循环引用
  m.socks.forEach(function (w) { out(w, { type: 'mm', id: m.id, data: data }); });
}

/* ---------- 开打：kind = 'spec' 常规 / 争霸赛，'balSpec' 平衡模式，'brawlSpec' 大乱斗 ---------- */
function start(m, teams, kind, opt) {
  var E = X(), mk = E.PVP[kind];
  var p = (teams[0] || []).map(mk).filter(Boolean), a = (teams[1] || []).map(mk).filter(Boolean);
  if (!p.length || !a.length) return false;
  var S = E.newBattle(p, a);
  S.pvp = { mode: opt.mode, brawl: !!opt.brawl, bal: !!opt.bal, pick: opt.pick || null };
  S.sides[0].name = m.names[0]; S.sides[1].name = m.names[1];
  m.S = S; m.srv = true; m.quitSide = null;
  send(m, { k: 'init', S: S });
  phase(m, 'act');
  return true;
}
function phase(m, ph) {
  var S = m.S;
  m.phase = ph; m.pend = [null, null];
  if (ph === 'repl') m.need = [!!(S.need && S.need[0]), !!(S.need && S.need[1])];
  clearTimeout(m.timer);
  if (ph !== 'over') m.timer = setTimeout(function () { autoFill(m); }, (TURN_SEC + 15) * 1000);
}
function stop(m) { clearTimeout(m.timer); if (m.S) m.phase = 'over'; }

/* ---------- 检查出招（不合法的一律当作自动出招） ---------- */
function usable(E, mon) { return mon.moves.map(function (x, k) { return x.pp > 0 && !E.moveBlocked(mon, x) ? k : -1; }).filter(function (k) { return k >= 0; }); }
function autoAct(E, S, i) { var u = usable(E, E.act(S, i)); return { kind: 'move', i: u.length ? u[0] : -1 }; }
function autoRepl(E, S, i) { return E.aliveIdx(S, i).filter(function (k) { return k !== S.sides[i].active; })[0]; }
function checkAct(E, S, i, a) {
  var mon = E.act(S, i), u = usable(E, mon);
  if (a && a.kind === 'move') {
    if (a.i === -1 && !u.length) return { kind: 'move', i: -1 };
    if (u.indexOf(a.i) >= 0) return { kind: 'move', i: a.i };
  }
  if (a && a.kind === 'switch') {
    var k = a.to | 0, t = S.sides[i].team[k];
    if (t && !t.fainted && k !== S.sides[i].active && !(mon.tm.noSwitch > 0)) return { kind: 'switch', to: k };
  }
  return autoAct(E, S, i);
}
function checkRepl(E, S, i, k) { var t = S.sides[i].team[k | 0]; return t && !t.fainted && (k | 0) !== S.sides[i].active ? k | 0 : autoRepl(E, S, i); }

/* ---------- 收到一方的消息 ---------- */
function onMsg(m, side, d) {
  if (!m.S || !d || typeof d !== 'object') return;
  var E = X(), S = m.S;
  if (d.k === 'emote') { out(m.socks[1 - side], { type: 'mm', id: m.id, data: { k: 'emote', e: String(d.e || '').slice(0, 32) } }); return; }
  if (d.k === 'quit') { quit(m, side); return; }
  if (d.k === 'act' && m.phase === 'act') { if (m.pend[side]) return; m.pend[side] = checkAct(E, S, side, d.a); resolve(m); return; }
  if (d.k === 'repl' && m.phase === 'repl') { if (!m.need[side] || m.pend[side] != null) return; m.pend[side] = checkRepl(E, S, side, d.i); resolve(m); return; }
}
function autoFill(m) {
  if (!m.S || m.phase === 'over') return;
  var E = X(), S = m.S;
  [0, 1].forEach(function (i) {
    if (m.phase === 'act' && !m.pend[i]) m.pend[i] = autoAct(E, S, i);
    if (m.phase === 'repl' && m.need[i] && m.pend[i] == null) m.pend[i] = autoRepl(E, S, i);
  });
  resolve(m);
}
function resolve(m) {
  var E = X(), S = m.S, evs;
  if (m.phase === 'act') {
    if (!m.pend[0] || !m.pend[1]) return;
    evs = E.resolveTurn(S, m.pend);
  } else if (m.phase === 'repl') {
    if ((m.need[0] && m.pend[0] == null) || (m.need[1] && m.pend[1] == null)) return;
    evs = E.pvpReplace(S, m.pend);
  } else return;
  var next = S.over ? 'over' : S.need && (S.need[0] || S.need[1]) ? 'repl' : 'act';
  phase(m, next);
  if (S.over) finish(m);
  send(m, { k: 'turn', evs: evs, S: S, sec: TURN_SEC });
}
function quit(m, i) {
  if (!m.S || m.phase === 'over') return;
  var E = X(), S = m.S, evs = [];
  S.over = i === 0 ? 'lose' : 'win'; m.quitSide = i;
  evs.push({ t: 'text', text: S.sides[i].name + '认输了。', cls: 'bad', snap: E.snap(S) });
  evs.push({ t: 'over', result: S.over, snap: E.snap(S) });
  phase(m, 'over'); finish(m);
  send(m, { k: 'turn', evs: evs, S: S, sec: TURN_SEC, quit: i });
}
// 打完：争霸赛的这一局结果由服务器记（不再听浏览器报的）
function finish(m) {
  var r = m.S.over;
  m.result = r === 'win' ? 0 : r === 'lose' ? 1 : -1;   // 赢的一方；-1 是平局
  if (m.ct) m.ct.res = m.result >= 0 ? m.result : null;   // 平局不计，重打这一局
}
function over(m) { return !m.S || m.phase === 'over'; }

module.exports = { mode: mode, start: start, onMsg: onMsg, stop: stop, over: over, PV: PV, TURN_SEC: TURN_SEC };
