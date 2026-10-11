/*
 * 社交：玩家列表、好友、名片、在线状态、切磋邀请
 *
 * 名片里的信息（做题家名字、称号、展示精灵、个人宣言、段位）都从玩家的云存档里读出来，
 * 所以玩家在游戏里改了名片，存档同步到服务器后别人就能看到。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/players            所有玩家的简要信息 + 在线状态 + 是否好友
 *   GET  /api/card?user=账号名    某个玩家的完整名片
 *   POST /api/friends { user, on }   加好友 / 删好友（单向，像「关注」）
 *   GET  /api/home?user=账号名    拜访某人的茶室：茶室名字、展示中的精灵（用于观看和挑战）
 *
 * WebSocket 消息（在 server.js 的 /ws 上）：
 *   → { type:'auth', token }                     用登录凭证认证，之后才算「在线」
 *   ← { type:'presence', user, online, busy }    有人上线 / 下线 / 开始或结束对战
 *   → { type:'challenge', to, mode }             向某人发起切磋（mode = 1、3、5）
 *   ← { type:'challenged', id, from, fromName, mode }   有人向你宣战
 *   → { type:'ch-reply', id, ok, reason }        接受 / 拒绝
 *   → { type:'ch-cancel', id }                   发起方取消
 *   ← { type:'ch-end', id, reason }              邀请结束（拒绝、超时、取消、对方忙）
 *   ← { type:'match', id, side, mode, peer, peerName, teams }   开打。side 0 是发起方，负责结算
 *   → { type:'mm', id, data } / ← { type:'mm', data }            对战中双方互发的消息（服务器只转发）
 *   → { type:'mm-over', id }                     对战结束
 *   ← { type:'mm-end', reason }                  对方掉线或离开
 */
'use strict';

var crypto = require('crypto');
var A = require('./accounts');

var CH_SECONDS = 30;          // 宣战弹窗等待回应的时间
var MODES = [1, 3, 5];

/* ---------- 从存档里读出名片 ---------- */
function parseSave(u) {
  var d = (u && u.save && u.save.data) || {}, acc = null, rank = null;
  try { acc = JSON.parse(d['hs-account-v1'] || 'null'); } catch (e) {}
  try { rank = JSON.parse(d['hs-rank-v1'] || 'null'); } catch (e) {}
  if (!acc || typeof acc.name !== 'string' || !Array.isArray(acc.mons)) acc = null;
  return { acc: acc, rank: rank };
}
function int(v, lo, hi) { v = Math.round(+v || 0); return Math.max(lo, Math.min(hi, v)); }
function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
function monOut(m) {
  var ev = {};
  if (m.ev && typeof m.ev === 'object') ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) { if (m.ev[k]) ev[k] = int(m.ev[k], 0, 300); });
  return {
    sid: str(m.sid, 32), lv: int(m.lv, 1, 100), nat: str(m.nat, 8) || null, ev: ev,
    moves: Array.isArray(m.moves) ? m.moves.filter(function (x) { return typeof x === 'string'; }).slice(0, 4).map(function (x) { return x.slice(0, 32); }) : []
  };
}
function monByU(acc, u) { for (var i = 0; i < acc.mons.length; i++) if (acc.mons[i] && acc.mons[i].u === u) return acc.mons[i]; return null; }
function activeTeam(acc) {
  var t = Array.isArray(acc.teams) ? acc.teams[acc.active | 0] : null;
  var list = (Array.isArray(t) ? t : []).map(function (u) { return monByU(acc, u); }).filter(Boolean);
  return list.length ? list : acc.mons.slice(0, 1);
}
function showMons(acc) {
  var c = acc.card && Array.isArray(acc.card.show) ? acc.card.show : [];
  return c.slice(0, 5).map(function (u) { return monByU(acc, u); }).filter(Boolean);
}
// 茶室：读完「陆羽茶室」支线才开放，最多展示 3 只
function homeOf(acc) {
  var open = !!(acc.story && acc.story.tea && acc.story.tea.done), h = acc.home || {};
  var mons = (Array.isArray(h.mons) ? h.mons : []).slice(0, 3).map(function (x) { return monByU(acc, x && typeof x === 'object' ? x.u : x); }).filter(Boolean);
  return { open: open, name: str(h.name, 10) || '陆羽茶室', mons: open ? mons : [] };
}
function rankOut(r) { return r ? { r: int(r.r, 0, 99), best: int(Math.max(r.best || 0, r.r || 0), 0, 99), w: int(r.w, 0, 1e7), l: int(r.l, 0, 1e7) } : { r: 0, best: 0, w: 0, l: 0 }; }

function summary(u, me) {
  var p = parseSave(u), acc = p.acc, on = isOnline(u.name);
  var o = { user: u.name, online: on, busy: on && isBusy(u.name), friend: !!(me && me.friends && me.friends.indexOf(u.name) >= 0),
    fan: !!(me && u.friends && u.friends.indexOf(me.name) >= 0), me: !!(me && me.name === u.name), lastSeen: lastSeen[u.name] || (u.save && u.save.savedAt) || u.created };
  if (!acc || !acc.introDone) { o.noChar = true; return o; }
  o.name = str(acc.name, 20); o.title = str(acc.title, 20) || null;
  o.monsN = acc.mons.length; o.teamN = activeTeam(acc).length;
  o.show = showMons(acc).map(function (m) { return { sid: str(m.sid, 32), lv: int(m.lv, 1, 100) }; });
  o.rank = rankOut(p.rank).best;
  var hm = homeOf(acc); o.homeOpen = hm.open; o.homeN = hm.mons.length;
  return o;
}
function card(u, me) {
  var o = summary(u, me);
  if (o.noChar) return o;
  var acc = parseSave(u).acc, species = {};
  acc.mons.forEach(function (m) { if (m && m.sid) species[m.sid] = 1; });
  o.created = acc.created || u.created; o.speciesN = Object.keys(species).length;
  o.motto = acc.card ? str(acc.card.motto, 200) : '';
  o.show = showMons(acc).map(monOut);
  o.rankInfo = rankOut(parseSave(u).rank);
  o.titles = Array.isArray(acc.titles) ? acc.titles.filter(function (x) { return typeof x === 'string'; }).slice(0, 20) : [];
  return o;
}
function gameName(name) { var u = A.loadUser(name), acc = u && parseSave(u).acc; return acc ? str(acc.name, 20) : name; }
function teamSpec(name, n) { var u = A.loadUser(name), acc = u && parseSave(u).acc; return acc ? activeTeam(acc).slice(0, n).map(monOut) : []; }

/* ---------- 在线状态 ---------- */
var online = {};      // 账号名 -> [ws, ...]
var lastSeen = {};
var allSockets = [];
function isOnline(name) { return !!(online[name] && online[name].length); }
function isBusy(name) { return (online[name] || []).some(function (w) { return !!w.match; }); }
function out(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function toUser(name, obj) { (online[name] || []).forEach(function (w) { out(w, obj); }); }
function presence(name) {
  var msg = { type: 'presence', user: name, online: isOnline(name), busy: isBusy(name) };
  allSockets.forEach(function (w) { if (w.user) out(w, msg); });
}

/* ---------- 切磋邀请与对战 ---------- */
var challenges = {};  // id -> { id, from(ws), fromUser, to, mode, timer }
var matches = {};     // id -> { id, socks:[host, guest], users:[..] }
function newId() { return crypto.randomBytes(8).toString('hex'); }
function endChallenge(c, reason, skip) {
  if (!challenges[c.id]) return;
  delete challenges[c.id]; clearTimeout(c.timer);
  out(c.from, { type: 'ch-end', id: c.id, reason: reason, side: 'from' });
  (online[c.to] || []).forEach(function (w) { if (w !== skip) out(w, { type: 'ch-end', id: c.id, reason: reason, side: 'to' }); });
}
function endMatch(id, leaver, reason) {
  var m = matches[id]; if (!m) return;
  delete matches[id];
  m.socks.forEach(function (w) {
    if (w.match === id) w.match = null;
    if (w !== leaver && reason) out(w, { type: 'mm-end', id: id, reason: reason });
  });
  m.users.forEach(presence);
}

function onMessage(ws, msg) {
  switch (msg.type) {
    case 'auth': {
      var who = A.whoToken(msg.token);
      if (!who) { out(ws, { type: 'auth-fail' }); return true; }
      if (ws.user === who.user) return true;
      ws.user = who.user;
      var first = !isOnline(who.user);
      (online[who.user] = online[who.user] || []).push(ws);
      out(ws, { type: 'authed', user: who.user });
      if (first) presence(who.user);
      return true;
    }
    case 'challenge': {
      if (!ws.user) return true;
      var to = String(msg.to || ''), mode = MODES.indexOf(+msg.mode) >= 0 ? +msg.mode : 1;
      var err = to === ws.user ? '不能向自己宣战' : !A.loadUser(to) ? '没有这个玩家' : !isOnline(to) ? '对方不在线' :
        ws.match ? '你正在对战中' : isBusy(to) ? '对方正在对战中' : !teamSpec(ws.user, 1).length ? '你还没有精灵' : !teamSpec(to, 1).length ? '对方还没有精灵' : '';
      Object.keys(challenges).forEach(function (k) { if (challenges[k].from === ws) err = err || '你已经在等待另一个人回应了'; });
      if (err) { out(ws, { type: 'ch-end', id: null, reason: 'error', msg: err, side: 'from' }); return true; }
      var c = { id: newId(), from: ws, fromUser: ws.user, to: to, mode: mode };
      challenges[c.id] = c;
      c.timer = setTimeout(function () { endChallenge(c, 'timeout'); }, CH_SECONDS * 1000);
      out(ws, { type: 'ch-sent', id: c.id, to: to, toName: gameName(to), mode: mode, seconds: CH_SECONDS });
      toUser(to, { type: 'challenged', id: c.id, from: ws.user, fromName: gameName(ws.user), mode: mode, seconds: CH_SECONDS });
      return true;
    }
    case 'ch-cancel': {
      var c1 = challenges[msg.id];
      if (c1 && c1.from === ws) endChallenge(c1, 'cancel');
      return true;
    }
    case 'ch-reply': {
      var c2 = challenges[msg.id];
      if (!c2 || ws.user !== c2.to) return true;
      if (!msg.ok) { endChallenge(c2, msg.reason === 'busy' ? 'busy' : 'declined'); return true; }
      if (c2.from.readyState !== 1 || c2.from.match || ws.match) { endChallenge(c2, 'gone'); return true; }
      delete challenges[c2.id]; clearTimeout(c2.timer);
      (online[c2.to] || []).forEach(function (w) { if (w !== ws) out(w, { type: 'ch-end', id: c2.id, reason: 'taken', side: 'to' }); });
      var id = c2.id, host = c2.from;
      var teams = [teamSpec(c2.fromUser, c2.mode), teamSpec(c2.to, c2.mode)];
      if (!teams[0].length || !teams[1].length) { out(host, { type: 'ch-end', id: id, reason: 'error', msg: '有一方没有精灵', side: 'from' }); out(ws, { type: 'ch-end', id: id, reason: 'error', msg: '有一方没有精灵', side: 'to' }); return true; }
      matches[id] = { id: id, socks: [host, ws], users: [c2.fromUser, c2.to] };
      host.match = id; ws.match = id;
      var names = [gameName(c2.fromUser), gameName(c2.to)];
      out(host, { type: 'match', id: id, side: 0, mode: c2.mode, peer: c2.to, peerName: names[1], names: names, teams: teams });
      out(ws, { type: 'match', id: id, side: 1, mode: c2.mode, peer: c2.fromUser, peerName: names[0], names: names });
      presence(c2.fromUser); presence(c2.to);
      return true;
    }
    case 'mm': {
      var m = matches[msg.id];
      if (!m || ws.match !== msg.id) return true;
      out(m.socks[m.socks[0] === ws ? 1 : 0], { type: 'mm', id: msg.id, data: msg.data });
      return true;
    }
    case 'mm-over': {
      var m2 = matches[msg.id];
      if (m2 && ws.match === msg.id) endMatch(msg.id, ws, 'over');
      return true;
    }
  }
  return false;
}

function onOpen(ws) { allSockets.push(ws); }
function onClose(ws) {
  allSockets = allSockets.filter(function (w) { return w !== ws; });
  Object.keys(challenges).forEach(function (k) {
    var c = challenges[k];
    if (c.from === ws) endChallenge(c, 'cancel');
    else if (c.to === ws.user && (online[ws.user] || []).length <= 1) endChallenge(c, 'gone');
  });
  if (ws.match) endMatch(ws.match, ws, 'left');
  if (ws.user && online[ws.user]) {
    online[ws.user] = online[ws.user].filter(function (w) { return w !== ws; });
    if (!online[ws.user].length) { delete online[ws.user]; lastSeen[ws.user] = Date.now(); presence(ws.user); }
  }
}

/* ---------- HTTP 接口 ---------- */
A.use(function (req, res, url) {
  if (url !== '/api/players' && url !== '/api/card' && url !== '/api/friends' && url !== '/api/home') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }

  if (url === '/api/players' && req.method === 'GET') {
    var list = A.allUsers().map(function (u) { return summary(u, me); });
    list.sort(function (a, b) { return (b.me - a.me) || (b.online - a.online) || (b.friend - a.friend) || ((b.lastSeen || 0) - (a.lastSeen || 0)); });
    A.reply(res, 200, { me: me.name, players: list });
    return true;
  }
  if (url === '/api/card' && req.method === 'GET') {
    var q = /[?&]user=([^&]*)/.exec(req.url), name = q ? decodeURIComponent(q[1]) : '', u = name && A.loadUser(name);
    if (!u) A.reply(res, 404, { error: '没有这个玩家' });
    else A.reply(res, 200, card(u, me));
    return true;
  }
  if (url === '/api/home' && req.method === 'GET') {
    var qh = /[?&]user=([^&]*)/.exec(req.url), hn = qh ? decodeURIComponent(qh[1]) : '', hu = hn && A.loadUser(hn);
    if (!hu) { A.reply(res, 404, { error: '没有这个玩家' }); return true; }
    var ha = parseSave(hu).acc;
    if (!ha || !ha.introDone) { A.reply(res, 200, { user: hu.name, noChar: true }); return true; }
    var hm = homeOf(ha);
    A.reply(res, 200, { user: hu.name, name: str(ha.name, 20), me: hu.name === me.name, open: hm.open, homeName: hm.name, mons: hm.mons.map(monOut), online: isOnline(hu.name) });
    return true;
  }
  if (url === '/api/friends' && req.method === 'POST') {
    A.readBody(req, function (err, body) {
      if (err) return A.reply(res, 400, { error: '请求格式不对' });
      me = A.loadUser(who.user);   // 重新读一次，避免覆盖刚刚同步上来的存档
      var t = A.loadUser(String(body.user || ''));
      if (!t) return A.reply(res, 404, { error: '没有这个玩家' });
      if (t.name === me.name) return A.reply(res, 400, { error: '不能加自己为好友' });
      var f = Array.isArray(me.friends) ? me.friends : [];
      f = f.filter(function (x) { return x !== t.name; });
      if (body.on) f.push(t.name);
      me.friends = f.slice(-200);
      A.saveUser(me);
      A.reply(res, 200, { friends: me.friends });
    });
    return true;
  }
  A.reply(res, 405, { error: '不支持' });
  return true;
});

module.exports = { onMessage: onMessage, onOpen: onOpen, onClose: onClose, onlineCount: function () { return Object.keys(online).length; } };
