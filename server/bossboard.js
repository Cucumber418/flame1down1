/*
 * 首领攻略板：每个首领的每个难度都有一块
 *   - 已通过的玩家：从所有人的存档里读（存档 bosses 里这一档 wins > 0 就算通过），所以不能作假
 *   - 攻略 / 留言：只有通过了这一档的玩家能发，每人每档一条（再发就是修改），带 1~5 星评分
 *   - 每条留言可以点赞、踩、欢乐（赞和踩只能二选一，欢乐单独算；不能给自己点）
 *
 * 留言存在 DATA_DIR/bossboard.json（每次读写都直接读文件）。
 *
 * HTTP 接口（需要登录），k 是首领代号（tiger / barren），d 是难度（0 简单、1 普通、2 困难）：
 *   GET  /api/boss?k=&d=                     已通过的玩家、我能不能发、所有留言和平均分
 *   POST /api/boss-post { k, d, text, stars } 发表或修改自己的攻略
 *   POST /api/boss-vote { k, d, id, v }      v = up 赞 / down 踩 / fun 欢乐，再点一次取消
 *   POST /api/boss-del  { k, d, id }         删掉自己的攻略
 */
'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'bossboard.json');
var MAX_LEN = 500, GAP_MS = 10 * 1000, VOTES = ['up', 'down', 'fun'];
var lastPost = {};

function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return d && typeof d.levels === 'object' ? d : { levels: {} }; } catch (e) { return { levels: {} }; } }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function lvKey(k, d) { k = String(k || ''); d = parseInt(d, 10); if (!/^[a-z]{2,16}$/.test(k) || !(d >= 0 && d <= 5)) return null; return d ? k + ':' + d : k; }   // 和存档里 bosses 的键名一样
function accOf(u) { try { var a = JSON.parse((u && u.save && u.save.data && u.save.data['hs-account-v1']) || 'null'); return a && typeof a.name === 'string' ? a : null; } catch (e) { return null; } }
function cleared(acc, key) { var r = acc && acc.bosses && acc.bosses[key]; return !!(r && r.wins > 0); }
function avatarOf(acc) {
  if (!acc || acc.avatar == null || !Array.isArray(acc.mons)) return null;
  var m = acc.mons.filter(function (x) { return x && x.u === acc.avatar; })[0];
  return m ? { sid: String(m.sid).slice(0, 32), lv: Math.max(1, Math.min(100, m.lv | 0)), shiny: !!m.shiny } : null;
}
function clean(t) {
  t = String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return Array.from(t).slice(0, MAX_LEN).join('');
}
function score(p) { return (p.votes.up || []).length - (p.votes.down || []).length; }

A.use(function (req, res, url) {
  if (url !== '/api/boss' && url !== '/api/boss-post' && url !== '/api/boss-vote' && url !== '/api/boss-del') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }

  if (url === '/api/boss' && req.method === 'GET') {
    var q = {}; (req.url.split('?')[1] || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
    var key = lvKey(q.k, q.d); if (!key) { A.reply(res, 400, { error: '参数不对' }); return true; }
    var info = {}, clears = [];
    A.allUsers().forEach(function (u) {
      var acc = accOf(u); if (!acc) return;
      info[u.name] = { name: acc.name.slice(0, 20), avatar: avatarOf(acc) };
      if (cleared(acc, key)) clears.push({ user: u.name, name: acc.name.slice(0, 20), avatar: avatarOf(acc), me: u.name === me.name });
    });
    var L = load().levels[key] || { posts: [] };
    var posts = L.posts.map(function (p) {
      var i = info[p.user] || { name: p.user, avatar: null }, mine = {};
      VOTES.forEach(function (v) { mine[v] = (p.votes[v] || []).indexOf(me.name) >= 0; });
      return { id: p.id, user: p.user, name: i.name, avatar: i.avatar, t: p.t, edited: p.edited || 0, text: p.text, stars: p.stars, up: (p.votes.up || []).length, down: (p.votes.down || []).length, fun: (p.votes.fun || []).length, my: mine, me: p.user === me.name };
    }).sort(function (a, b) { return (b.up - b.down) - (a.up - a.down) || b.t - a.t; });
    var sum = 0; posts.forEach(function (p) { sum += p.stars; });
    A.reply(res, 200, { key: key, clears: clears, canPost: cleared(accOf(me), key), posts: posts, avg: posts.length ? Math.round(sum / posts.length * 10) / 10 : 0 });
    return true;
  }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '不支持' }); return true; }
  A.readBody(req, function (err, body) {
    if (err) return A.reply(res, 400, { error: '请求格式不对' });
    var key = lvKey(body.k, body.d); if (!key) return A.reply(res, 400, { error: '参数不对' });
    var d = load(), L = d.levels[key] || (d.levels[key] = { posts: [] }), now = Date.now();
    var find = function (id) { for (var i = 0; i < L.posts.length; i++) if (L.posts[i].id === id) return i; return -1; };
    if (url === '/api/boss-post') {
      if (!cleared(accOf(A.loadUser(who.user)), key)) return A.reply(res, 403, { error: '通过这个难度之后才能发攻略' });
      var text = clean(body.text), stars = parseInt(body.stars, 10);
      if (!text) return A.reply(res, 400, { error: '攻略不能是空的' });
      if (!(stars >= 1 && stars <= 5)) return A.reply(res, 400, { error: '请给出 1~5 星的评分' });
      if (lastPost[who.user] && now - lastPost[who.user] < GAP_MS) return A.reply(res, 429, { error: '发得太快了，稍等几秒再试' });
      var old = L.posts.filter(function (p) { return p.user === who.user; })[0];
      if (old) { old.text = text; old.stars = stars; old.edited = now; }
      else L.posts.push({ id: crypto.randomBytes(6).toString('hex'), user: who.user, t: now, text: text, stars: stars, votes: { up: [], down: [], fun: [] } });
      store(d); lastPost[who.user] = now;
      return A.reply(res, 200, { ok: true, edited: !!old });
    }
    var k = find(String(body.id || ''));
    if (k < 0) return A.reply(res, 404, { error: '这条攻略已经不在了' });
    var P = L.posts[k];
    if (url === '/api/boss-del') {
      if (P.user !== who.user) return A.reply(res, 403, { error: '只能删除自己的攻略' });
      L.posts.splice(k, 1); store(d);
      return A.reply(res, 200, { ok: true });
    }
    var v = String(body.v || ''); if (VOTES.indexOf(v) < 0) return A.reply(res, 400, { error: '参数不对' });
    if (P.user === who.user) return A.reply(res, 400, { error: '不能给自己的攻略投票' });
    VOTES.forEach(function (x) { if (!Array.isArray(P.votes[x])) P.votes[x] = []; });
    var on = P.votes[v].indexOf(who.user) >= 0;
    P.votes[v] = P.votes[v].filter(function (n) { return n !== who.user; });
    if (!on) { P.votes[v].push(who.user); if (v !== 'fun') { var other = v === 'up' ? 'down' : 'up'; P.votes[other] = P.votes[other].filter(function (n) { return n !== who.user; }); } }
    store(d);
    A.reply(res, 200, { ok: true, up: P.votes.up.length, down: P.votes.down.length, fun: P.votes.fun.length, my: { up: P.votes.up.indexOf(who.user) >= 0, down: P.votes.down.indexOf(who.user) >= 0, fun: P.votes.fun.indexOf(who.user) >= 0 } });
  });
  return true;
});

module.exports = { load: load, store: store, FILE: FILE };
