/*
 * 茶室动态与留言板
 *
 * 存在 DATA_DIR/homelog.json：
 *   logs: { 主人账号: [{ id, t: 第一次来的时间, t2: 最后一次动作的时间, user: 访客账号, poke: { 精灵名: 次数 }, fights: [{ r: 结果, t }] }] }
 *   msgs: { 主人账号: [{ id, t, user, text }] }
 *   seen: { 主人账号: { log: 时间, msg: 时间 } }   主人上次看动态的时间（用来标「新」）
 *
 * 同一位访客 30 分钟内的所有动作（来访、摸摸、挑战）合并成一条动态。每个茶室最多保留 200 条动态、300 条留言。
 * 主人在线时，有人来访、挑战或留言会通过 WebSocket 推一条 { type:'home-ev', kind, user, name, mon, r, text }。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/home-log?user=主人       主人自己看：动态 + 留言（同时记为已读）；别人看：只有留言
 *   GET  /api/home-log?user=自己&peek=1  只返回新动态、新留言的条数 { newLog, newMsg }，不标已读
 *   POST /api/home-ev { owner, kind:'poke', mon }          访客摸了摸茶室里的精灵
 *   POST /api/home-ev { owner, kind:'fight', r }            访客打完一场茶室对战（r = win 访客赢 / lose / draw / quit）
 *   POST /api/home-msg { owner, text }   留言（最多 200 字，每人 10 秒一条；主人也能在自己的茶室留言）
 *   POST /api/home-msg-del { owner, id } 删留言：自己写的，或者自己茶室里的
 *
 * 来访记录在 social.js 的 GET /api/home 里调用 visit() 记下。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var A = require('./accounts');
var CONTENT = require('../js/engine/content');

var FILE = path.join(A.DATA_DIR, 'homelog.json');
var KEEP_LOG = 200, KEEP_MSG = 300, MAX_LEN = 200, MERGE_MS = 30 * 60 * 1000, MSG_GAP = 10 * 1000, EV_GAP = 300;
var lastMsg = {}, lastEv = {};

function load() {
  try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); d.logs = d.logs || {}; d.msgs = d.msgs || {}; d.seen = d.seen || {}; return d; }
  catch (e) { return { logs: {}, msgs: {}, seen: {} }; }
}
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function soc() { return require('./social'); }
function newId() { return crypto.randomBytes(5).toString('hex'); }
function clean(t, n) {
  t = String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return Array.from(t).slice(0, n).join('');
}
// 找到这位访客 30 分钟内的那条动态，没有就新建一条
function entry(d, owner, user) {
  var L = d.logs[owner] || (d.logs[owner] = []), now = Date.now();
  for (var i = L.length - 1; i >= 0 && i >= L.length - 30; i--) if (L[i].user === user && now - L[i].t2 < MERGE_MS) { L[i].t2 = now; return { e: L[i], fresh: false }; }
  var e = { id: newId(), t: now, t2: now, user: user, poke: {}, fights: [] };
  L.push(e); if (L.length > KEEP_LOG) d.logs[owner] = L.slice(-KEEP_LOG);
  return { e: e, fresh: true };
}
function push(owner, obj) { try { soc().toUser(owner, Object.assign({ type: 'home-ev' }, obj)); } catch (e) {} }

function visit(owner, user) {
  if (!owner || !user || owner === user) return;
  var d = load(), r = entry(d, owner, user);
  store(d);
  if (r.fresh) push(owner, { kind: 'visit', user: user, name: soc().gameName(user) });
}

// 2026-11-03：好友偷走了基地里精灵的经验（server/steal.js 调用）；s = { sid, lv, n }
function steal(owner, user, s) {
  if (!owner || !user || owner === user) return;
  var d = load(), e = entry(d, owner, user).e;
  e.steal = (e.steal || []).concat([{ sid: String(s.sid || ''), lv: s.lv | 0, n: s.n | 0, t: Date.now() }]).slice(-20);
  store(d);
  push(owner, { kind: 'steal', user: user, name: soc().gameName(user), u: s.u, sid: s.sid, lv: s.lv, n: s.n });
}

A.use(function (req, res, url) {
  if (url !== '/api/home-log' && url !== '/api/home-ev' && url !== '/api/home-msg' && url !== '/api/home-msg-del') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }

  if (url === '/api/home-log' && req.method === 'GET') {
    var q = /[?&]user=([^&]*)/.exec(req.url), on = q ? decodeURIComponent(q[1]) : '', ou = on && A.loadUser(on);
    if (!ou) { A.reply(res, 404, { error: '没有这个玩家' }); return true; }
    var d = load(), mine = ou.name === me.name, names = {}, av = {};
    // peek=1：主人只查有几条新动态 / 新留言，不标已读（登录时提示用）
    if (/[?&]peek=1/.test(req.url)) {
      if (!mine) { A.reply(res, 200, { newLog: 0, newMsg: 0 }); return true; }
      var sn = d.seen[ou.name] || {};
      A.reply(res, 200, {
        newLog: (d.logs[ou.name] || []).filter(function (e) { return e.t2 > (sn.log || 0); }).length,
        newMsg: (d.msgs[ou.name] || []).filter(function (m) { return m.t > (sn.msg || 0) && m.user !== ou.name; }).length
      });
      return true;
    }
    function nm(u) { if (!(u in names)) { names[u] = soc().gameName(u); av[u] = soc().avatarOf(u); } return names[u]; }
    var msgs = (d.msgs[ou.name] || []).slice(-80).reverse().map(function (m) { return { id: m.id, t: m.t, user: m.user, name: nm(m.user), avatar: av[m.user], text: m.text, mine: m.user === me.name, owner: m.user === ou.name }; });
    var out = { owner: ou.name, me: me.name, mine: mine, msgs: msgs, msgN: (d.msgs[ou.name] || []).length };
    if (mine) {
      var seen = d.seen[ou.name] || {};
      out.seen = { log: seen.log || 0, msg: seen.msg || 0 };
      out.logs = (d.logs[ou.name] || []).slice(-60).reverse().map(function (e) { return { id: e.id, t: e.t, t2: e.t2, user: e.user, name: nm(e.user), avatar: av[e.user], poke: e.poke || {}, fights: e.fights || [], steal: e.steal || [] }; });
      d.seen[ou.name] = { log: Date.now(), msg: Date.now() }; store(d);
    }
    A.reply(res, 200, out);
    return true;
  }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '不支持' }); return true; }
  A.readBody(req, function (err, body) {
    if (err) return A.reply(res, 400, { error: '请求格式不对' });
    var owner = A.loadUser(String(body.owner || ''));
    if (!owner) return A.reply(res, 404, { error: '没有这个玩家' });
    var d = load(), now = Date.now();

    if (url === '/api/home-ev') {
      var contentErr = CONTENT.error(body.mon, '精灵名字');
      if (contentErr) return A.reply(res, 400, { error: contentErr });
      if (owner.name === me.name) return A.reply(res, 200, { ok: true });   // 自己的茶室不记
      if (lastEv[me.name] && now - lastEv[me.name] < EV_GAP) return A.reply(res, 200, { ok: true });
      lastEv[me.name] = now;
      var r = entry(d, owner.name, me.name), e = r.e;
      if (body.kind === 'poke') {
        var mon = clean(body.mon, 20) || '精灵', first = !Object.keys(e.poke).length;
        if (Object.keys(e.poke).length < 10 || e.poke[mon]) e.poke[mon] = Math.min(9999, (e.poke[mon] || 0) + 1);
        store(d);
        if (first) push(owner.name, { kind: 'poke', user: me.name, name: soc().gameName(me.name), mon: mon });
      } else if (body.kind === 'fight') {
        var rr = ['win', 'lose', 'draw', 'quit'].indexOf(body.r) >= 0 ? body.r : 'draw';
        e.fights.push({ r: rr, t: now }); if (e.fights.length > 20) e.fights = e.fights.slice(-20);
        store(d);
        push(owner.name, { kind: 'fight', user: me.name, name: soc().gameName(me.name), r: rr });
      } else return A.reply(res, 400, { error: '不认识的动作' });
      return A.reply(res, 200, { ok: true });
    }
    if (url === '/api/home-msg-del') {
      var L = d.msgs[owner.name] || [], k = -1;
      L.forEach(function (m, i) { if (m.id === body.id) k = i; });
      if (k < 0) return A.reply(res, 404, { error: '这条留言已经不在了' });
      if (L[k].user !== me.name && owner.name !== me.name) return A.reply(res, 403, { error: '只能删除自己的留言，或者自己茶室里的留言' });
      L.splice(k, 1); store(d);
      return A.reply(res, 200, { ok: true });
    }
    // 留言
    var contentErr = CONTENT.error(body.text, '内容');
    if (contentErr) return A.reply(res, 400, { error: contentErr });
    var text = clean(body.text, MAX_LEN);
    if (!text) return A.reply(res, 400, { error: '留言不能是空的' });
    if (lastMsg[me.name] && now - lastMsg[me.name] < MSG_GAP) return A.reply(res, 429, { error: '留言太快了，' + Math.ceil((MSG_GAP - (now - lastMsg[me.name])) / 1000) + ' 秒后再试' });
    var M = d.msgs[owner.name] || (d.msgs[owner.name] = []), msg = { id: newId(), t: now, user: me.name, text: text };
    M.push(msg); if (M.length > KEEP_MSG) d.msgs[owner.name] = M.slice(-KEEP_MSG);
    if (owner.name === me.name) d.seen[me.name] = Object.assign(d.seen[me.name] || {}, { msg: now });
    store(d); lastMsg[me.name] = now;
    if (owner.name !== me.name) push(owner.name, { kind: 'msg', user: me.name, name: soc().gameName(me.name), text: Array.from(text).slice(0, 40).join('') });
    A.reply(res, 200, { ok: true });
  });
  return true;
});

module.exports = { visit: visit, steal: steal, load: load, store: store, FILE: FILE };
