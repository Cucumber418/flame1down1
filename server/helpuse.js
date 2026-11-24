/*
 * 助战使用记录（2026-10-20）
 *
 * 星球挑战里借用了好友的助战精灵，就给助战主人记一次；主人下次上线时领取（每次 1000 能量 + 1000 经验，奖励在客户端发）。
 * 存在 DATA_DIR/helpuse.json：
 *   pend: { 主人账号: { 借用者账号: { name: 显示名, n: 次数 } } }   还没领的
 *   day:  { 'YYYY-MM-DD|借用者|主人': 次数 }                          当天已经记过几次（同一人借同一位好友每天最多记 DAY_CAP 次）
 *
 * HTTP 接口（需要登录）：
 *   POST /api/helper-use { owner }   开打一场带好友助战的挑战时调用
 *   POST /api/helper-claim           领取：返回 { uses: [{ user, name, n }] } 并清空
 */
'use strict';

var path = require('path');
var fs = require('fs');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'helpuse.json');
var DAY_CAP = 20, BJ = 8 * 3600 * 1000;

function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d && typeof d === 'object') { d.pend = d.pend || {}; d.day = d.day || {}; return d; } } catch (e) {} return { pend: {}, day: {} }; }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function today() { return new Date(Date.now() + BJ).toISOString().slice(0, 10); }
function dispName(u) {
  try { var acc = JSON.parse(((u.save && u.save.data) || {})['hs-account-v1'] || 'null'); if (acc && typeof acc.name === 'string') return acc.name.slice(0, 20); } catch (e) {}
  return u.name;
}

// 取走（并清空）这个人的助战借用记录
function take(name) {
  var d = load(), p = d.pend[name] || {};
  var uses = Object.keys(p).map(function (k) { return { user: k, name: p[k].name, n: p[k].n }; }).filter(function (x) { return x.n > 0; });
  if (d.pend[name]) { delete d.pend[name]; store(d); }
  return uses;
}
require('./tx').hook('help', function (u) { return take(u.name); });

A.use(function (req, res, url) {
  if (url !== '/api/helper-use' && url !== '/api/helper-claim') return false;
  if (req.method !== 'POST') { A.reply(res, 405, { error: '请求方式不对' }); return true; }
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }

  if (url === '/api/helper-claim') {   // 旧页面用的；新页面走交易 help（奖励由服务器直接发）
    A.reply(res, 200, { uses: take(me.name) });
    return true;
  }
  A.readBody(req, function (err, body) {
    if (err) return A.reply(res, 400, { error: '请求格式不对' });
    var o = A.loadUser(String(body.owner || ''));
    if (!o || o.name === me.name) return A.reply(res, 200, { ok: false });
    if (!(A.areFriends(me, o))) return A.reply(res, 200, { ok: false });
    var d = load(), t = today(), key = t + '|' + me.name + '|' + o.name;
    Object.keys(d.day).forEach(function (k) { if (k.slice(0, 10) !== t) delete d.day[k]; });   // 只留当天的计数
    if ((d.day[key] || 0) >= DAY_CAP) return A.reply(res, 200, { ok: false, cap: true });
    d.day[key] = (d.day[key] || 0) + 1;
    var p = d.pend[o.name] || (d.pend[o.name] = {}), r = p[me.name] || (p[me.name] = { name: '', n: 0 });
    r.name = dispName(me); r.n++;
    store(d);
    try { require('./friendpt').helpFp(me.name, o.name); } catch (e) {}   // 2026-11-01：借助战双方各 +100 友情点
    A.reply(res, 200, { ok: true });
  });
  return true;
});
