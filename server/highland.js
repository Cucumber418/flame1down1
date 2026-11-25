/* 世界BOSS伤害排行只读取服务器已结算的存档，不接受客户端报分。 */
'use strict';
var A = require('./accounts');
function board(who, scope, page, now) {
  var E = require('./tx').engine(), rows = [], total = 0;
  A.allUsers().forEach(function (u) {
    var a; try { a = JSON.parse(((u.save || {}).data || {})['hs-account-v1'] || 'null'); } catch (e) { return; }
    if (!a || !a.introDone) return;
    var r = E.HIGHLAND.read(a), d = E.HIGHLAND.day(a, now), runs = scope === 'today' ? d.used : r.runs || 0;
    if (!runs) return;
    var damage = scope === 'today' ? d.damage : r.total || 0;
    rows.push({ user: u.name, name: String(a.name || u.name).slice(0, 20), damage: damage, runs: runs, best: r.best || 0 }); total += damage;
  });
  rows.sort(function (a, b) { return b.damage - a.damage || a.user.localeCompare(b.user); });
  rows.forEach(function (r, i) { r.rank = i + 1; });
  var pages = Math.max(1, Math.ceil(rows.length / 10)); page = Math.max(0, Math.min(pages - 1, page));
  return { ok: true, scope: scope, page: page, pages: pages, players: rows.length, total: total, rows: rows.slice(page * 10, (page + 1) * 10), me: rows.filter(function (r) { return r.user === who; })[0] || null };
}
A.use(function (req, res, url) {
  if (url !== '/api/highland' || req.method !== 'GET') return false;
  var who = A.whoIs(req); if (!who || !A.loadUser(who.user)) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  var q = require('url').parse(req.url, true).query, scope = q.scope === 'today' ? 'today' : 'total', page = Number(q.page || 0);
  if (!Number.isSafeInteger(page) || page < 0) { A.reply(res, 400, { error: '页码不正确' }); return true; }
  A.reply(res, 200, board(who.user, scope, page, Date.now())); return true;
});
module.exports = { board: board };
