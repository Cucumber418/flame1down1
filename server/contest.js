/*
 * 太空竞技场 · 第一届做题大王争霸赛（2026-10-19）
 *
 * 流程：
 *   报名 → 报名满 MIN_N 人后定下抽签时间（满员那天往后第二天的 18:00，北京时间），全服公告；抽签开始前都还能报名
 *   → 到点抽签（全服在线玩家弹出抽签动画，之后也能在太空竞技场回放），报名截止
 *   → 瑞士轮 swissRounds(N) 轮：每轮约 2~3 天，截止在晚上 22:00；双方在截止前同时在线、打一场 bo3（5v5，各带 6 只、禁对方 1 只）
 *     截止时还没打完的：这一轮里在线时间更长的一方获胜（都没上线就随机）。一轮全部打完或到截止时间就进入下一轮，每轮结束全服公告
 *   → 瑞士轮积分前两名打决赛（同样 bo3），决出冠军。决赛全服可以看直播，也能看回放
 * 对战本身走 social.js 的切磋流程（rule = 'contest'），打完一个系列由 social.js 调 report() 记结果。
 *
 * 数据存在 DATA_DIR/contest.json：{ quiz1: 赛事状态 }（见 blank()）。回放存在 DATA_DIR/ct-replays/编号.json。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/contest             赛事全貌（报名名单、抽签时间、赛程、积分、公告、我的对局和对手在线状态）
 *   POST /api/contest             报名
 *   GET  /api/contest/replay?id=  一局对战的回放
 * WebSocket 推送（经 social.js）：
 *   ← { type:'ct-notice', notice }   全服公告（满员定抽签时间、抽签结果、每轮结果、冠军）
 *   ← { type:'ct-draw' }             抽签开始了（在线玩家弹出抽签动画）
 *   ← { type:'ct-ready', opp, oppName, round }   你和这一轮的对手都在线
 * 测试用：环境变量 CT_MIN_N（最少报名人数）、CT_TICK_MS（检查间隔）。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'contest.json');
var REP_DIR = path.join(A.DATA_DIR, 'ct-replays');
var CUR = 'quiz1', NAME = '第一届做题大王争霸赛';
var MIN_N = +process.env.CT_MIN_N || 5;
var TICK_MS = +process.env.CT_TICK_MS || 60 * 1000;
var READY_GAP = 10 * 60 * 1000;    // 同一对选手「双方都在线」的提醒间隔
var BJ = 8 * 3600 * 1000;

function S() { return require('./social'); }   // 晚一点再取，避免循环引用
// 北京时间：ts 那天往后 addDays 天的 hour 点
function bjAt(ts, addDays, hour) { var d = new Date(ts + BJ); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + addDays, hour, 0, 0) - BJ; }
// 每轮的截止：开始那天往后第二天的 22:00；离现在不到 48 小时就再往后推一天（每轮留足 2~3 天）
function roundDeadline(now) { var t = bjAt(now, 2, 22); if (t - now < 48 * 3600 * 1000) t = bjAt(now, 3, 22); return t; }
function swissRounds(n) { return n <= 4 ? 2 : n <= 8 ? 3 : n <= 16 ? 4 : n <= 32 ? 5 : 6; }

function blank() { return { signups: {}, drawAt: 0, drawn: 0, order: [], rounds: [], final: null, status: 'signup', notices: [], seen: {}, ranks: null }; }
function loadAll() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } }
function storeAll(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function cur(all) {
  var c = all[CUR];
  if (!c || typeof c !== 'object') c = all[CUR] = blank();
  if (!c.status && !c.signups) {   // 旧格式（2026-10-19 只有报名时）：{ 账号名: 报名时间 }
    var old = c; c = all[CUR] = blank();
    Object.keys(old).forEach(function (u) { if (typeof old[u] === 'number') c.signups[u] = old[u]; });
  }
  if (!c.signups || Array.isArray(c.signups)) c.signups = {};
  ['rounds', 'notices', 'order'].forEach(function (k) { if (!Array.isArray(c[k])) c[k] = []; });
  if (!c.seen) c.seen = {};
  if (!c.status) c.status = 'signup';
  return c;
}
// 2026-10-21：人数是奇数时不再轮空，轮空的人改为和电脑对手 Bttp 打（Bttp 不进积分榜）
var BT = '@bttp';
function gname(u) { if (u === BT) return 'Bttp'; try { return S().gameName(u); } catch (e) { return u; } }
function online(u) { if (u === BT) return true; try { return S().isOnline(u); } catch (e) { return false; } }
function notice(c, title, text, extra) {
  var n = Object.assign({ id: crypto.randomBytes(5).toString('hex'), t: Date.now(), title: title, text: text }, extra || {});
  c.notices.push(n); if (c.notices.length > 40) c.notices = c.notices.slice(-40);
  try { S().toAll({ type: 'ct-notice', notice: n }); } catch (e) {}
  return n;
}
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = crypto.randomInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ---------- 积分 ---------- */
// 每个人：胜场（轮空算胜）、小分（bo3 里赢的局数 − 输的局数）、对手分（遇到过的对手的胜场之和）
function standings(c) {
  var P = {}; c.order.forEach(function (u, i) { P[u] = { user: u, w: 0, l: 0, gd: 0, opp: [], bye: 0, seed: i }; });
  c.rounds.forEach(function (R) {
    if (R.final) return;   // 决赛不计入瑞士轮积分
    if (R.bye && P[R.bye]) { P[R.bye].w++; P[R.bye].bye++; }
    R.pairs.forEach(function (p) {
      if (p.b === BT && P[p.a]) {   // 和 Bttp 的对局：只算选手自己的胜负
        if (!p.w) return; var me0 = P[p.a], sc0 = p.score || [2, 0];
        if (p.w === p.a) me0.w++; else me0.l++;
        me0.gd += (sc0[0] || 0) - (sc0[1] || 0); return;
      }
      if (!P[p.a] || !P[p.b]) return;
      P[p.a].opp.push(p.b); P[p.b].opp.push(p.a);
      if (!p.w) return;
      var W = P[p.w], L = P[p.w === p.a ? p.b : p.a];
      W.w++; L.l++;
      var sc = p.score || [2, 0], wi = p.w === p.a ? 0 : 1;
      W.gd += (sc[wi] || 0) - (sc[1 - wi] || 0); L.gd -= (sc[wi] || 0) - (sc[1 - wi] || 0);
    });
  });
  var list = Object.keys(P).map(function (u) { var x = P[u]; x.buch = x.opp.reduce(function (s, o) { return s + (P[o] ? P[o].w : 0); }, 0); return x; });
  list.sort(function (a, b) { return (b.w - a.w) || (b.buch - a.buch) || (b.gd - a.gd) || (a.seed - b.seed); });
  return list;
}
// 瑞士轮配对：按积分排，从上往下给每人找最近的、没交过手的对手；奇数人时最后一名里没轮空过的人轮空
function pairRound(c) {
  var list = standings(c), bye = null;
  if (list.length % 2) {
    for (var i = list.length - 1; i >= 0; i--) if (!list[i].bye) { bye = list[i].user; break; }
    if (!bye) bye = list[list.length - 1].user;
    list = list.filter(function (x) { return x.user !== bye; });
  }
  var played = function (a, b) { return c.rounds.some(function (R) { return R.pairs.some(function (p) { return (p.a === a && p.b === b) || (p.a === b && p.b === a); }); }); };
  var pairs = [], left = list.map(function (x) { return x.user; });
  while (left.length) {
    var a = left.shift(), k = 0;
    for (var j = 0; j < left.length; j++) if (!played(a, left[j])) { k = j; break; }
    var b = left.splice(k, 1)[0];
    pairs.push({ a: a, b: b, w: null, score: null, how: null, replays: [] });
  }
  if (bye) pairs.push({ a: bye, b: BT, w: null, score: null, how: null, replays: [], npc: 1 });
  return { pairs: pairs, bye: null };
}

/* ---------- 状态推进（每 TICK_MS 检查一次） ---------- */
function openRound(c, now, final) {
  var R;
  if (final) {
    var top = standings(c).slice(0, 2);
    R = { final: true, pairs: [{ a: top[0].user, b: top[1].user, w: null, score: null, how: null, replays: [] }], bye: null };
  } else R = pairRound(c);
  R.n = c.rounds.length + 1; R.start = now; R.deadline = roundDeadline(now);
  c.rounds.push(R); c.seen = {};
  var dl = new Date(R.deadline + BJ), dls = (dl.getUTCMonth() + 1) + ' 月 ' + dl.getUTCDate() + ' 日 22:00';
  var lines = R.pairs.map(function (p) { return gname(p.a) + ' vs ' + gname(p.b); });
  if (R.bye) lines.push(gname(R.bye) + ' 本轮轮空（直接算胜）');
  notice(c, final ? NAME + ' · 决赛开始！' : NAME + ' · 第 ' + R.n + ' 轮开始', (final ? '决赛对阵：' : '本轮对阵：') + lines.join('；') + '。请在 ' + dls + ' 之前和对手同时上线完成 bo3。', { round: R.n });
}
function resolveLeft(R) {
  R.pairs.forEach(function (p) {
    if (p.w) return;
    if (p.b === BT) { p.w = BT; p.score = [0, 2]; p.how = 'noshow'; return; }   // 到截止时间还没挑战 Bttp：判负
    var A0 = (R._seen && R._seen[p.a]) || 0, B0 = (R._seen && R._seen[p.b]) || 0;
    p.w = A0 > B0 ? p.a : B0 > A0 ? p.b : (crypto.randomInt(2) ? p.a : p.b);
    p.score = [p.w === p.a ? 2 : 0, p.w === p.b ? 2 : 0];
    p.how = A0 || B0 ? 'online' : 'random';
  });
}
function closeRound(c, now) {
  var R = c.rounds[c.rounds.length - 1];
  R._seen = c.seen; resolveLeft(R); delete R._seen; R.closed = now;
  var lines = R.pairs.map(function (p) { var l = p.w === p.a ? p.b : p.a; return gname(p.w) + ' 胜 ' + gname(l) + (p.how === 'play' ? '（' + Math.max(p.score[0], p.score[1]) + ':' + Math.min(p.score[0], p.score[1]) + '）' : p.how === 'online' ? '（对手未上线，判胜）' : p.how === 'forfeit' ? '（对手中途离开，判胜）' : p.how === 'noshow' ? '（没有挑战 Bttp，判负）' : '（双方都没上线，随机判定）'); });
  if (R.final) {
    var champ = R.pairs[0].w, st = standings(c), runner = R.pairs[0].w === R.pairs[0].a ? R.pairs[0].b : R.pairs[0].a;
    c.ranks = [champ, runner].concat(st.map(function (x) { return x.user; }).filter(function (u) { return u !== champ && u !== runner; }));
    c.status = 'done';
    notice(c, NAME + ' · 冠军诞生！', '决赛：' + lines[0] + '。恭喜 ' + gname(champ) + ' 成为做题大王！所有参赛者的奖励已经通过邮箱发放。', { round: R.n, done: true });
    return;
  }
  notice(c, NAME + ' · 第 ' + R.n + ' 轮结果', lines.join('；') + (R.bye ? '；' + gname(R.bye) + ' 轮空' : '') + '。', { round: R.n });
  if (R.n >= swissRounds(c.order.length)) { c.status = 'final'; openRound(c, now, true); }
  else openRound(c, now, false);
}
function doDraw(c, now) {
  c.order = shuffle(Object.keys(c.signups).sort(function (a, b) { return c.signups[a] - c.signups[b]; }));
  c.drawn = now; c.status = 'swiss';
  notice(c, NAME + ' · 抽签完成', '共 ' + c.order.length + ' 名选手参赛，瑞士轮 ' + swissRounds(c.order.length) + ' 轮后，积分前两名进入决赛。抽签过程可以在太空竞技场回放。', { draw: true });
  openRound(c, now, false);
  try { S().toAll({ type: 'ct-draw' }); } catch (e) {}
}
function tick(now) {
  now = now || Date.now();
  var all = loadAll(), c = cur(all), changed = false, n = Object.keys(c.signups).length;
  if (c.status === 'signup') {
    if (!c.drawAt && n >= MIN_N) {
      c.drawAt = bjAt(now, 2, 18); changed = true;
      var d = new Date(c.drawAt + BJ);
      notice(c, NAME + ' · 抽签时间确定', '报名人数已满 ' + MIN_N + ' 人！抽签将在 ' + (d.getUTCMonth() + 1) + ' 月 ' + d.getUTCDate() + ' 日 18:00 开始，在那之前还可以继续报名，抽签开始即截止。', { drawAt: c.drawAt });
    }
    if (c.drawAt && now >= c.drawAt && n >= 2) { doDraw(c, now); changed = true; }
  } else if (c.status === 'swiss' || c.status === 'final') {
    var R = c.rounds[c.rounds.length - 1];
    if (R && R.bye && !R.final && !R.closed) {   // 2026-10-21 上线时正在进行的这一轮：轮空改成挑战 Bttp
      R.pairs.push({ a: R.bye, b: BT, w: null, score: null, how: null, replays: [], npc: 1 });
      notice(c, NAME + ' · Bttp 加入', '第 ' + R.n + ' 轮 ' + gname(R.bye) + ' 不再轮空，改为和 Bttp 进行 bo3，截止时间不变。', { round: R.n });
      R.bye = null; changed = true;
    }
    if (R) {
      // 记在线时间：这一轮还没打完的选手，每次检查时在线就加一次
      R.pairs.forEach(function (p) {
        if (p.w) return;
        if (p.b === BT) return;
        [p.a, p.b].forEach(function (u) { if (online(u)) { c.seen[u] = (c.seen[u] || 0) + Math.round(TICK_MS / 1000); changed = true; } });
        // 双方都在线：提醒一下（每 READY_GAP 最多一次）
        if (online(p.a) && online(p.b) && (!p.pingAt || now - p.pingAt > READY_GAP)) {
          p.pingAt = now; changed = true;
          try { S().toUser(p.a, { type: 'ct-ready', opp: p.b, oppName: gname(p.b), round: R.n, final: !!R.final }); S().toUser(p.b, { type: 'ct-ready', opp: p.a, oppName: gname(p.a), round: R.n, final: !!R.final }); } catch (e) {}
        }
      });
      if (R.pairs.every(function (p) { return p.w; }) || now >= R.deadline) { closeRound(c, now); changed = true; }
    }
  }
  if (changed) storeAll(all);
  return c;
}
setInterval(function () { try { tick(); } catch (e) { console.log('[contest]', e.message); } }, TICK_MS);

/* ---------- 给 social.js 用的接口 ---------- */
// a、b 是不是这一轮还没打完的对手
function pairOf(a, b) {
  var c = cur(loadAll());
  if (c.status !== 'swiss' && c.status !== 'final') return null;
  var R = c.rounds[c.rounds.length - 1]; if (!R || Date.now() >= R.deadline) return null;
  for (var i = 0; i < R.pairs.length; i++) { var p = R.pairs[i]; if (!p.w && ((p.a === a && p.b === b) || (p.a === b && p.b === a))) return { round: R.n, idx: i, final: !!R.final, key: R.n + ':' + i }; }
  return null;
}
// 一个 bo3 打完：winner 是账号名，score 是 { 账号名: 赢的局数 }，how = play / forfeit
function report(key, winner, score, how) {
  var all = loadAll(), c = cur(all), k = String(key).split(':'), R = c.rounds[(+k[0]) - 1], p = R && R.pairs[+k[1]];
  if (!p || p.w || (winner !== p.a && winner !== p.b)) return false;
  p.w = winner; p.score = [score[p.a] || 0, score[p.b] || 0]; p.how = how || 'play'; p.at = Date.now();
  storeAll(all);
  setTimeout(function () { try { tick(); } catch (e) {} }, 500);   // 一轮全部打完就马上进下一轮
  return true;
}
// 保存一局的回放，挂到对应的对局上
function saveReplay(key, game, rec) {
  try {
    fs.mkdirSync(REP_DIR, { recursive: true });
    var id = crypto.randomBytes(6).toString('hex');
    fs.writeFileSync(path.join(REP_DIR, id + '.json'), JSON.stringify(rec));
    var all = loadAll(), c = cur(all), k = String(key).split(':'), R = c.rounds[(+k[0]) - 1], p = R && R.pairs[+k[1]];
    if (p) { if (!Array.isArray(p.replays)) p.replays = []; p.replays.push({ id: id, game: game, t: Date.now() }); storeAll(all); }
    return id;
  } catch (e) { console.log('[contest] 回放保存失败', e.message); return null; }
}

/* ---------- HTTP ---------- */
function view(c, me) {
  var names = {}; function nm(u) { if (!names[u]) names[u] = gname(u); return names[u]; }
  var su = Object.keys(c.signups).sort(function (a, b) { return c.signups[a] - c.signups[b]; });
  var o = { id: CUR, name: NAME, min: MIN_N, status: c.status, drawAt: c.drawAt, drawn: c.drawn, now: Date.now(), mine: !!c.signups[me], at: c.signups[me] || 0, count: su.length,
    players: su.map(function (u) { return { user: u, name: nm(u) }; }), order: c.order, swissN: c.order.length ? swissRounds(c.order.length) : swissRounds(su.length),
    rounds: c.rounds.map(function (R) { return { n: R.n, final: !!R.final, start: R.start, deadline: R.deadline, closed: R.closed || 0, bye: R.bye, pairs: R.pairs.map(function (p) { return { a: p.a, b: p.b, w: p.w, score: p.score, how: p.how, replays: p.replays || [] }; }) }; }),
    standings: c.order.length ? standings(c).map(function (x) { return { user: x.user, w: x.w, l: x.l, gd: x.gd, buch: x.buch, bye: x.bye }; }) : [],
    ranks: c.ranks, notices: c.notices.slice(-20), names: names, me: me };
  c.order.forEach(nm);
  // 我这一轮的对局
  var R = c.rounds[c.rounds.length - 1];
  if (R && (c.status === 'swiss' || c.status === 'final')) R.pairs.forEach(function (p) {
    if (p.a === me || p.b === me) { var opp = p.a === me ? p.b : p.a; o.myMatch = { round: R.n, final: !!R.final, opp: opp, oppName: nm(opp), oppOnline: online(opp), done: !!p.w, w: p.w, deadline: R.deadline, npc: opp === BT }; }
  });
  o.live = []; try { var soc = S(); (R ? R.pairs : []).forEach(function (p) { if (!p.w && soc.castLabel && (soc.castLabel(p.a) || soc.castLabel(p.b))) o.live.push({ a: p.a, b: p.b, host: soc.castLabel(p.a) ? p.a : p.b }); }); } catch (e) {}
  return o;
}
A.use(function (req, res, url) {
  if (url !== '/api/contest' && url !== '/api/contest/replay' && url !== '/api/contest/npc') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  if (url === '/api/contest/replay') {
    var q = /[?&]id=([0-9a-f]{6,20})/.exec(req.url);
    if (!q) { A.reply(res, 400, { error: '参数不对' }); return true; }
    try { A.reply(res, 200, JSON.parse(fs.readFileSync(path.join(REP_DIR, q[1] + '.json'), 'utf8'))); } catch (e) { A.reply(res, 404, { error: '没有这场回放' }); }
    return true;
  }
  if (req.method === 'GET') { A.reply(res, 200, view(cur(loadAll()), me.name)); return true; }
  if (url === '/api/contest/npc' && req.method === 'POST') {   // 和 Bttp 的 bo3 打完：{ win, score: [我赢的局数, Bttp 赢的局数] }
    A.readBody(req, function (err, body) {
      if (err) return A.reply(res, 400, { error: '请求格式不对' });
      var c0 = cur(loadAll()), R0 = c0.rounds[c0.rounds.length - 1], idx = -1;
      if (R0 && (c0.status === 'swiss' || c0.status === 'final')) R0.pairs.forEach(function (p, i) { if (p.a === me.name && p.b === BT && !p.w) idx = i; });
      if (idx < 0 || Date.now() >= R0.deadline) return A.reply(res, 403, { error: '这一轮没有要和 Bttp 打的对局' });
      var sc = Array.isArray(body.score) ? body.score.map(function (x) { return Math.max(0, Math.min(2, x | 0)); }) : [body.win ? 2 : 0, body.win ? 0 : 2];
      var win = !!body.win, scObj = {}; scObj[me.name] = sc[0]; scObj[BT] = sc[1];
      report(R0.n + ':' + idx, win ? me.name : BT, scObj, 'play');
      var all2 = loadAll(), c2 = cur(all2);
      notice(c2, NAME + ' · 第 ' + R0.n + ' 轮', gname(me.name) + (win ? ' 战胜了 Bttp' : ' 输给了 Bttp') + '（' + Math.max(sc[0], sc[1]) + ':' + Math.min(sc[0], sc[1]) + '）。', { round: R0.n });
      storeAll(all2);
      A.reply(res, 200, view(cur(loadAll()), me.name));
    });
    return true;
  }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '不支持' }); return true; }
  A.readBody(req, function (err) {
    if (err) return A.reply(res, 400, { error: '请求格式不对' });
    var all = loadAll(), c = cur(all);
    if (c.status !== 'signup' || (c.drawAt && Date.now() >= c.drawAt)) return A.reply(res, 403, { error: '报名已经截止了' });
    if (!c.signups[me.name]) { c.signups[me.name] = Date.now(); storeAll(all); }
    tick();
    A.reply(res, 200, view(cur(loadAll()), me.name));
  });
  return true;
});

module.exports = { pairOf: pairOf, report: report, saveReplay: saveReplay, tick: tick, standings: standings, FILE: FILE, NAME: NAME, _test: { pairRound: pairRound, bjAt: bjAt, roundDeadline: roundDeadline, swissRounds: swissRounds, closeRound: closeRound, doDraw: doDraw } };
