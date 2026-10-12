/*
 * 讨论区：所有船员都能看到的公开留言板
 *
 * 留言存在 DATA_DIR/board.json（每次读写都直接读文件，所以在服务器上用 admin.js 删留言也能立即生效），最多保留 2000 条。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/board?before=时间&n=条数   最新的留言（默认 40 条，before 用来往前翻页），另外返回 latest = 最新一条的时间
 *   POST /api/board { text }             发一条留言：最多 300 字，每人 15 秒内只能发一条
 *   POST /api/board-del { id }           删掉自己的留言
 */
'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'board.json');
var MAX_POSTS = 2000, MAX_LEN = 300, GAP_MS = 15 * 1000;
var lastPost = {};   // 账号名 -> 上次发言时间（防刷屏）

function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(d.posts) ? d : { posts: [] }; } catch (e) { return { posts: [] }; } }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function gameInfo(name) {
  var u = A.loadUser(name), acc = null;
  try { acc = JSON.parse((u && u.save && u.save.data && u.save.data['hs-account-v1']) || 'null'); } catch (e) {}
  return { name: acc && typeof acc.name === 'string' ? acc.name.slice(0, 20) : name, title: acc && typeof acc.title === 'string' ? acc.title.slice(0, 20) : null };
}
function clean(t) {
  t = String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return Array.from(t).slice(0, MAX_LEN).join('');
}

A.use(function (req, res, url) {
  if (url !== '/api/board' && url !== '/api/board-del') return false;
  var who = A.whoIs(req);
  if (!who || !A.loadUser(who.user)) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }

  if (url === '/api/board' && req.method === 'GET') {
    var q = {}; (req.url.split('?')[1] || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
    var n = Math.max(1, Math.min(100, parseInt(q.n, 10) || 40)), before = +q.before || Infinity;
    var d = load(), list = d.posts.filter(function (p) { return p.t < before; });
    var page = list.slice(-n).reverse(), av = {};
    // 头像按发帖人现在的头像显示（换了头像，旧留言也跟着换）
    page = page.map(function (p) { if (!(p.user in av)) av[p.user] = require('./social').avatarOf(p.user); return Object.assign({}, p, { avatar: av[p.user] }); });
    A.reply(res, 200, { me: who.user, posts: page, more: list.length > n, latest: d.posts.length ? d.posts[d.posts.length - 1].t : 0, total: d.posts.length });
    return true;
  }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '不支持' }); return true; }
  A.readBody(req, function (err, body) {
    if (err) return A.reply(res, 400, { error: '请求格式不对' });
    var d = load();
    if (url === '/api/board-del') {
      var k = -1; d.posts.forEach(function (p, i) { if (p.id === body.id) k = i; });
      if (k < 0) return A.reply(res, 404, { error: '这条留言已经不在了' });
      if (d.posts[k].user !== who.user) return A.reply(res, 403, { error: '只能删除自己的留言' });
      d.posts.splice(k, 1); store(d);
      return A.reply(res, 200, { ok: true });
    }
    var text = clean(body.text);
    if (!text) return A.reply(res, 400, { error: '留言不能是空的' });
    var now = Date.now();
    if (lastPost[who.user] && now - lastPost[who.user] < GAP_MS) return A.reply(res, 429, { error: '发得太快了，' + Math.ceil((GAP_MS - (now - lastPost[who.user])) / 1000) + ' 秒后再发' });
    var g = gameInfo(who.user);
    var post = { id: crypto.randomBytes(6).toString('hex'), t: now, user: who.user, name: g.name, title: g.title, text: text };
    d.posts.push(post);
    if (d.posts.length > MAX_POSTS) d.posts = d.posts.slice(-MAX_POSTS);
    store(d); lastPost[who.user] = now;
    A.reply(res, 200, { ok: true, post: post });
  });
  return true;
});

module.exports = { load: load, store: store, FILE: FILE };
