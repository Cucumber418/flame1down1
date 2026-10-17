/*
 * 瘴气驱逐战（芙罗拉星 · 全服共享进度的星球任务，2026-10-17）
 *
 * 存在 DATA_DIR/purgewar.json：{ total: 全服击破数, users: { 账号: 击破数 }, start: 第一只被击破的时间 }
 * 每次读写都直接读文件，在服务器上手动改文件也能立即生效。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/purgewar        { total, me, players, top: [{ user, name, n }]（前 10 名） }
 *   POST /api/purgewar-hit    击破一只瘴气精灵：全服 +1、自己 +1，返回同上（每人每天最多 50 次，超出返回 capped: true）
 * 里程碑奖励（10 / 50 / 100 / 之后每 50）由前端按 total 判断，用邮件发给贡献过的玩家（见 game.js 的 PW）。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'purgewar.json');
var DAY_CAP = 50;    // 每名玩家每天（北京时间）最多计入 50 次击破
var GAP_MS = 2000;   // 同一个人两次击破至少隔 2 秒（一场野外对战本来就要更久，防止脚本刷）
var lastHit = {};

function load() {
  try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); d.total = d.total | 0; d.users = d.users || {}; return d; }
  catch (e) { return { total: 0, users: {}, start: 0 }; }
}
function bjDay() { var t = new Date(Date.now() + 8 * 3600000); return t.getUTCFullYear() + '-' + (t.getUTCMonth() + 1) + '-' + t.getUTCDate(); }
function todayN(d, u) { var x = d.day && d.day[u]; return x && x.d === bjDay() ? x.n : 0; }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function gameName(u) { try { return require('./social').gameName(u); } catch (e) { return u; } }
function out(d, me) {
  var list = Object.keys(d.users).map(function (u) { return { user: u, n: d.users[u] | 0 }; }).filter(function (x) { return x.n > 0; });
  list.sort(function (a, b) { return b.n - a.n; });
  return { total: d.total, me: d.users[me] | 0, today: todayN(d, me), cap: DAY_CAP, players: list.length, top: list.slice(0, 10).map(function (x) { return { user: x.user, name: gameName(x.user), n: x.n }; }) };
}

A.use(function (req, res, url) {
  if (url !== '/api/purgewar' && url !== '/api/purgewar-hit') return false;
  var who = A.whoIs(req);
  if (!who || !A.loadUser(who.user)) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  if (url === '/api/purgewar' && req.method === 'GET') { A.reply(res, 200, out(load(), who.user)); return true; }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '不支持' }); return true; }
  A.readBody(req, function () {
    var now = Date.now(), d = load();
    if (lastHit[who.user] && now - lastHit[who.user] < GAP_MS) return A.reply(res, 200, Object.assign(out(d, who.user), { skipped: true }));
    if (todayN(d, who.user) >= DAY_CAP) return A.reply(res, 200, Object.assign(out(d, who.user), { capped: true }));
    lastHit[who.user] = now;
    d.total = (d.total | 0) + 1; d.users[who.user] = (d.users[who.user] | 0) + 1; if (!d.start) d.start = now;
    if (!d.day) d.day = {}; d.day[who.user] = { d: bjDay(), n: todayN(d, who.user) + 1 };
    store(d);
    A.reply(res, 200, out(d, who.user));
  });
  return true;
});

module.exports = { load: load, store: store, FILE: FILE };
