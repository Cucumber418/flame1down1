/*
 * 单人对战（打电脑）由服务器结算（2026-10-24 起）。先驱之塔（kind = 'tower'）是第一个；其他模式的规则写在 js/engine/pve.js 的 MODES 里
 *
 * POST /api/pve（需要登录）
 *   { op: 'start', kind: 'tower', pick }   开一场：服务器从存档里取出战配队，按规则生成对手。返回 { S }（对战状态）
 *   { op: 'start', kind, args }            其他模式（boss、weekly、ewk……）；开打前改了存档时，返回里还有 acc（整份存档）和 rev
 *   { op: 'act', a }                       出招：a = { kind: 'move', i } / { kind: 'switch', to } / { kind: 'item', key }
 *   { op: 'repl', k }                      我方精灵倒下后选下一只
 *   { op: 'quit' }                         认输
 *   出招后返回 { evs, S }（这一回合发生的事和新的对战状态）；打完时还带 end：{ ...结算结果, rev }，
 *   act / repl / quit 都带 seq（这场对战里的第几次请求）：网络断了重发同一个 seq，服务器直接回上次的结果，不会多打一回合。
 *   服务器已经把奖励和塔的进度写进存档（rev 是存档的新版本号），浏览器照 end 更新本机存档（js/engine/pve.js 的 towerApply）。
 *
 * 对战状态只放在内存里：服务器重启（部署更新）后进行中的对战作废，不发奖励也不扣层数。每个账号同时只能有一场。
 * 战斗里用掉的道具：打完时存档里的数量不会超过「开打时的数量 − 用掉的」（浏览器自己也会扣，这样不会扣两次）。
 */
'use strict';

var A = require('./accounts');
function X() { return require('./tx').engine(); }

var sessions = {};   // 账号名 -> { kind, S, team, f, F, items0, used, t, seq, last, done }
var MAX_AGE = 3 * 3600e3;
setInterval(function () { var now = Date.now(); Object.keys(sessions).forEach(function (k) { if (now - sessions[k].t > MAX_AGE) delete sessions[k]; }); }, 10 * 60e3).unref();

function accOf(u) { try { var a = JSON.parse(((u.save || {}).data || {})['hs-account-v1'] || 'null'); return a && Array.isArray(a.mons) ? a : null; } catch (e) { return null; } }

// 检查玩家这一回合的操作（不合法的当作第一个能用的技能）
function checkAct(E, S, sess, a) {
  var me = E.act(S, 0), usable = me.moves.map(function (x, k) { return x.pp > 0 && !E.moveBlocked(me, x) ? k : -1; }).filter(function (k) { return k >= 0; });
  if (a && a.kind === 'move') {
    if (a.i === -1 && !usable.length) return { kind: 'move', i: -1 };
    if (usable.indexOf(a.i) >= 0) return { kind: 'move', i: a.i };
  }
  if (a && a.kind === 'switch') {
    var k = a.to | 0, t = S.sides[0].team[k];
    if (t && !t.fainted && k !== S.sides[0].active && !(me.tm.noSwitch > 0)) return { kind: 'switch', to: k };
  }
  if (a && a.kind === 'item' && typeof a.key === 'string' && S.items && S.items[a.key] > 0 && E.ITEMS[a.key]) {
    S.items[a.key]--; sess.used[a.key] = (sess.used[a.key] || 0) + 1;
    return { kind: 'item', key: a.key };
  }
  return { kind: 'move', i: usable.length ? usable[0] : -1 };
}

// 打完：在服务器的存档上结算，返回 end（并写进存档）
function finish(name, sess) {
  var E = X(), S = sess.S, u = A.loadUser(name), acc = u && accOf(u);
  sess.done = true;   // 留着这场对战一会儿：浏览器没收到结果、重发同一个请求时还能回给它
  if (!acc) return { res: S.over, err: '存档不见了' };
  var now = Date.now();
  var seen = S.sides[0].team.map(function (x) { return !!x.seen; });
  var downs = S.sides[1].team.filter(function (x) { return x.fainted; }).map(function (x) { return { id: x.id, lv: x.lv }; });
  var end;
  if (sess.kind === 'tower') end = E.PVE.towerEnd(acc, sess.f, sess.F, S.over, !!S.quit, sess.team, seen, downs, now);
  else {   // 其他模式：规则在 js/engine/pve.js 的 MODES；结算完把整份存档发回去，浏览器直接换上
    var rep = E.PVE.MODES[sess.kind].end(acc, sess.ctx, { res: S.over, quit: !!S.quit, seen: seen, downs: downs, S: S }, { now: now, rand: Math.random });
    end = { kind: sess.kind, res: S.over, quit: !!S.quit, rep: rep };
  }
  // 战斗里用掉的道具：存档里的数量不超过「开打时 − 用掉的」
  if (!acc.items) acc.items = {};
  Object.keys(sess.used).forEach(function (k) { var cap = Math.max(0, (sess.items0[k] || 0) - sess.used[k]); if ((acc.items[k] || 0) > cap) acc.items[k] = cap; });
  u.save.data['hs-account-v1'] = JSON.stringify(acc);
  u.save.rev = (u.save.rev || 0) + 1; u.save.savedAt = now;
  A.saveUser(u);
  end.rev = u.save.rev; end.seen = seen; end.downs = downs;
  if (sess.kind !== 'tower') end.acc = u.save.data['hs-account-v1'];
  return end;
}
// 开打前存档有改动（比如记挑战次数、图鉴）：先写进去
function saveAcc(u, acc) {
  u.save.data['hs-account-v1'] = JSON.stringify(acc);
  u.save.rev = (u.save.rev || 0) + 1; u.save.savedAt = Date.now();
  A.saveUser(u);
  return u.save.rev;
}

// 开一场其他模式的对战
function startMode(E, res, name, kind, u, acc, args) {
  delete args._helper; delete args._foes; delete args._owner;
  if (kind === 'tea') {   // 对手按主人茶室里展示的精灵，服务器自己查
    var H = require('./social').homeFoes(String(args.owner || ''), name);
    if (!H || !H.mons.length) return A.reply(res, 400, { error: '这个茶室现在没法挑战' });
    args._foes = H.mons; args._owner = H.owner;
  }
  if (kind === 'chal' && args.helper) {   // 助战：明明教官的，或好友名片上的（服务器自己查，不信浏览器给的资料）
    if (args.helper === 'mm') { if (E.ACC.done(acc, 'fl_chal2')) args._helper = E.PVE.MM_HELPER; }
    else if (typeof args.helper === 'object') args._helper = require('./social').friendHelper(u, String(args.helper.user || ''), args.helper.u | 0);
    if (!args._helper) return A.reply(res, 400, { error: '借不到这只助战精灵（可能已经不是好友，或对方换了助战）' });
  }
  var now = Date.now(), st = E.PVE.MODES[kind].start(acc, args, { now: now, rand: Math.random });
  if (!st || st.err) return A.reply(res, 400, { error: (st && st.err) || '开不了这场对战' });
  var S = E.newBattle(st.p, st.a), o = st.opt || {};
  S.story = { foe: o.foe, back: o.back || null, diff: o.diff || null }; S.noLimit = true; S.remote = true;
  if (st.S) Object.keys(st.S).forEach(function (k) { if (st.S[k] != null) S[k] = st.S[k]; });   // env、wild、ai、ordered 等
  var items0 = {}; E.ITEM_ORDER.forEach(function (k) { items0[k] = (acc.items && acc.items[k]) || 0; });
  if (!st.noItems) S.items = JSON.parse(JSON.stringify(items0));
  var out = { ok: true, S: S, opt: o };
  if (st.preStrike) out.pre = E.resolveTurn(S, [{ kind: 'pass' }, E.aiChoose(S)]);   // 剧情：对方偷袭，开场先出一招
  if (st.dirty) { out.rev = saveAcc(u, acc); out.acc = u.save.data['hs-account-v1']; }
  sessions[name] = { kind: kind, S: S, ctx: st.ctx || {}, items0: items0, used: {}, t: now, seq: 0, last: null, done: false };
  return A.reply(res, 200, JSON.parse(E.battleJSON(S, out)));
}

A.use(function (req, res, url) {
  if (url !== '/api/pve' || req.method !== 'POST') return false;
  A.readBody(req, function (err, body) {
    if (err || !body || typeof body !== 'object') return A.reply(res, 400, { error: '请求格式不对' });
    var who = A.whoIs(req); if (!who) return A.reply(res, 401, { error: '登录已失效，请重新登录' });
    var E = X(); if (!E || !E.PVE) return A.reply(res, 503, { error: '服务器暂时不能开对战，请联系管理员' });
    var name = who.user, op = String(body.op || '');
    var V = require('./tx').VERSION;
    if (op === 'start' && body.v && body.v !== V) return A.reply(res, 409, { error: '游戏已经更新了，请刷新页面后再挑战。', update: true, v: V });
    try {
      if (op === 'start') {
        var kind = String(body.kind || '');
        if (kind !== 'tower' && !E.PVE.MODES[kind]) return A.reply(res, 400, { error: '不支持的对战' });
        var u = A.loadUser(name), acc = u && accOf(u);
        if (!acc) return A.reply(res, 409, { error: '存档还没同步到服务器，请稍后再试' });
        if (kind !== 'tower') return startMode(E, res, name, kind, u, acc, body.args && typeof body.args === 'object' ? body.args : {});
        var st = E.PVE.towerStart(acc, body.pick, Date.now(), Math.random);
        if (st.err) return A.reply(res, 400, { error: st.err });
        var S = E.newBattle(st.p, st.a);
        S.story = { foe: st.opt.foe, back: st.opt.back, diff: st.opt.diff }; S.noLimit = true; S.remote = true;
        var items0 = {}; E.ITEM_ORDER.forEach(function (k) { items0[k] = (acc.items && acc.items[k]) || 0; });
        S.items = JSON.parse(JSON.stringify(items0));
        sessions[name] = { kind: 'tower', S: S, team: st.team, f: st.f, F: st.F, items0: items0, used: {}, t: Date.now(), seq: 0, last: null, done: false };
        return A.reply(res, 200, JSON.parse(E.battleJSON(S, { ok: true, S: S, opt: st.opt })));
      }
      var sess = sessions[name];
      if (!sess) return A.reply(res, 410, { error: '这场对战已经失效了（服务器可能刚更新过）' });
      var S2 = sess.S, evs, seq = body.seq | 0;
      if (seq && seq === sess.seq && sess.last) return A.reply(res, 200, sess.last);   // 重发的请求：回上次的结果
      if (sess.done || S2.over) return A.reply(res, 409, { error: '这场对战已经结束了' });
      if (seq && seq !== sess.seq + 1) { delete sessions[name]; return A.reply(res, 410, { error: '对战进度对不上，这场对战作废了（不扣层数）' }); }
      sess.t = Date.now();
      if (op === 'act') {
        if (S2.needSwitch) return A.reply(res, 409, { error: '要先选下一只出战的精灵' });
        evs = E.resolveTurn(S2, [checkAct(E, S2, sess, body.a), E.aiChoose(S2)]);
      } else if (op === 'repl') {
        if (!S2.needSwitch) return A.reply(res, 409, { error: '现在不用换精灵' });
        var k = body.k | 0, t = S2.sides[0].team[k];
        if (!t || t.fainted || k === S2.sides[0].active) k = E.aliveIdx(S2, 0).filter(function (x) { return x !== S2.sides[0].active; })[0];
        evs = E.playerReplace(S2, k);
      } else if (op === 'quit') {
        S2.over = 'lose'; S2.quit = true; evs = [];
      } else return A.reply(res, 400, { error: '不支持的操作' });
      var out = { ok: true, evs: evs, S: S2 };
      if (S2.over) out.end = finish(name, sess);
      out = JSON.parse(E.battleJSON(S2, out));
      sess.seq = seq || sess.seq + 1; sess.last = out;
      return A.reply(res, 200, out);
    } catch (e) {
      console.error('单人对战出错', op, e && e.stack);
      delete sessions[name];
      return A.reply(res, 500, { error: '服务器结算出错了，这场对战作废（不扣层数）' });
    }
  });
  return true;
});

module.exports = { active: function () { return Object.keys(sessions).filter(function (k) { return !sessions[k].done; }).length; } };
