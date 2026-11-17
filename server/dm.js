/*
 * 私信：两个船员之间的聊天记录
 *
 * 存在 DATA_DIR/dm.json：{ convs: { 'a|b': [{ f: 发送者, t: 时间, x: 文字 }] }, reads: { 账号: { 对方: 读到的时间 } } }
 * 每段对话最多保留 500 条。对方在线时通过 WebSocket 立刻推送（{ type:'dm', from, fromName, text, t }）。
 *
 * 能给谁发：自己加了好友的人；或者对方先给你发过私信（可以直接回复）。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/dm-list            我的所有对话：对方、最后一条、未读条数
 *   GET  /api/dm?with=账号名      和某人的聊天记录（最近 200 条），同时标记为已读
 *   POST /api/dm { to, text }    发一条私信（最多 300 字，每秒最多 1 条）
 */
'use strict';

var path = require('path');
var fs = require('fs');
var A = require('./accounts');
var CONTENT = require('../js/engine/content');

var FILE = path.join(A.DATA_DIR, 'dm.json');
var MAX_LEN = 300, KEEP = 500, GAP_MS = 1000;
var last = {};

function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!d.convs) d.convs = {}; if (!d.reads) d.reads = {}; return d; } catch (e) { return { convs: {}, reads: {} }; } }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
function clean(t) {
  t = String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return Array.from(t).slice(0, MAX_LEN).join('');
}
function soc() { return require('./social'); }
function unreadOf(d, me, peer) {
  var L = d.convs[key(me, peer)] || [], r = (d.reads[me] && d.reads[me][peer]) || 0, n = 0;
  L.forEach(function (m) { if (m.f !== me && m.t > r) n++; });
  return n;
}

A.use(function (req, res, url) {
  if (url !== '/api/dm' && url !== '/api/dm-list') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }

  if (url === '/api/dm-list' && req.method === 'GET') {
    var d = load(), out = [];
    Object.keys(d.convs).forEach(function (k) {
      var ps = k.split('|'); if (ps.indexOf(me.name) < 0) return;
      var peer = ps[0] === me.name ? ps[1] : ps[0], L = d.convs[k], m = L[L.length - 1];
      if (!m) return;
      out.push({ peer: peer, name: soc().gameName(peer), avatar: soc().avatarOf(peer), last: m.x, lastFrom: m.f, lastT: m.t, unread: unreadOf(d, me.name, peer) });
    });
    out.sort(function (a, b) { return b.lastT - a.lastT; });
    A.reply(res, 200, { me: me.name, convs: out, unread: out.reduce(function (s, c) { return s + c.unread; }, 0) });
    return true;
  }
  if (url === '/api/dm' && req.method === 'GET') {
    var q = /[?&]with=([^&]*)/.exec(req.url), peer = q ? decodeURIComponent(q[1]) : '', pu = peer && A.loadUser(peer);
    if (!pu) { A.reply(res, 404, { error: '没有这个玩家' }); return true; }
    var d2 = load(), L2 = d2.convs[key(me.name, pu.name)] || [];
    if (!d2.reads[me.name]) d2.reads[me.name] = {};
    var lastT = L2.length ? L2[L2.length - 1].t : 0;
    if (lastT && d2.reads[me.name][pu.name] !== lastT) { d2.reads[me.name][pu.name] = lastT; store(d2); }
    var friends = Array.isArray(me.friends) ? me.friends : [];
    A.reply(res, 200, { me: me.name, peer: pu.name, name: soc().gameName(pu.name), avatar: soc().avatarOf(pu.name), online: soc().isOnline(pu.name),
      canSend: friends.indexOf(pu.name) >= 0 || L2.some(function (m) { return m.f === pu.name; }), msgs: L2.slice(-200) });
    return true;
  }
  if (url === '/api/dm' && req.method === 'POST') {
    A.readBody(req, function (err, body) {
      if (err) return A.reply(res, 400, { error: '请求格式不对' });
      var to = A.loadUser(String(body.to || ''));
      if (!to) return A.reply(res, 404, { error: '没有这个玩家' });
      if (to.name === me.name) return A.reply(res, 400, { error: '不能给自己发私信' });
      var contentErr = CONTENT.error(body.text, '内容');
      if (contentErr) return A.reply(res, 400, { error: contentErr });
      var text = clean(body.text); if (!text) return A.reply(res, 400, { error: '私信不能是空的' });
      var now = Date.now();
      if (last[me.name] && now - last[me.name] < GAP_MS) return A.reply(res, 429, { error: '发得太快了' });
      var d = load(), k = key(me.name, to.name), L = d.convs[k] || (d.convs[k] = []);
      var friends = Array.isArray(A.loadUser(me.name).friends) ? A.loadUser(me.name).friends : [];
      if (friends.indexOf(to.name) < 0 && !L.some(function (m) { return m.f === to.name; })) return A.reply(res, 403, { error: '先把对方加为好友，才能发私信' });
      var msg = { f: me.name, t: now, x: text };
      L.push(msg); if (L.length > KEEP) d.convs[k] = L.slice(-KEEP);
      if (!d.reads[me.name]) d.reads[me.name] = {};
      d.reads[me.name][to.name] = now;   // 自己发的不算未读
      store(d); last[me.name] = now;
      soc().toUser(to.name, { type: 'dm', from: me.name, fromName: soc().gameName(me.name), avatar: soc().avatarOf(me.name), text: text, t: now });
      soc().toUser(me.name, { type: 'dm-echo', to: to.name, text: text, t: now });   // 自己其他设备上的窗口也同步
      A.reply(res, 200, { ok: true, msg: msg });
    });
    return true;
  }
  A.reply(res, 405, { error: '不支持' });
  return true;
});

module.exports = { load: load };
