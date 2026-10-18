/*
 * 全服挑战进度（2026-10-17）：星球挑战（目前只有芙罗拉星）和先驱之塔
 * 进度从所有玩家的存档里读（acc.chal / acc.tower），不能作假；结果缓存 30 秒。
 *
 * HTTP 接口（需要登录）：
 *   GET /api/chalboard?k=flora   芙罗拉星挑战：{ players, buckets: [{ label, n }], top: [{ user, name, avatar, v, sub }], me: { v, sub, rank } }
 *   GET /api/chalboard?k=tower   先驱之塔：同上
 * progOf(acc) 也给名片用（social.js 的 card）。
 */
'use strict';

var A = require('./accounts');

var FLORA_N = 50, TOWER_TOP = 60, CACHE_MS = 30000;
var cache = {};

function accOf(u) { try { var a = JSON.parse((u && u.save && u.save.data && u.save.data['hs-account-v1']) || 'null'); return a && typeof a.name === 'string' && Array.isArray(a.mons) ? a : null; } catch (e) { return null; } }
function avatarOf(acc) {
  var m = acc && acc.avatar != null ? acc.mons.filter(function (x) { return x && x.u === acc.avatar; })[0] : null;
  return m ? { sid: String(m.sid).slice(0, 32), lv: Math.max(1, Math.min(100, m.lv | 0)), shiny: m.shiny === 2 ? 2 : !!m.shiny, fs: m.fs != null && m.fs >= 0 && m.fs <= 2 ? m.fs | 0 : undefined } : null;
}
function progOf(acc) {
  var stars = 0, max = 0, c = (acc && acc.chal) || {};
  for (var i = 1; i <= FLORA_N; i++) {
    var r = c['fl' + i], n = r && Array.isArray(r.s) ? r.s.filter(Boolean).length : 0;
    if (n) { stars += n; max = i; }
  }
  var T = (acc && acc.tower) || {};
  return { flora: { stars: stars, max: max, total: FLORA_N * 3, levels: FLORA_N },
    tower: { best: Math.max(0, Math.min(TOWER_TOP, T.best | 0)), clears: Math.max(0, T.clears | 0), cur: Math.max(1, Math.min(TOWER_TOP, T.f | 0 || 1)), top: TOWER_TOP } };
}
function board(k) {
  var hit = cache[k]; if (hit && Date.now() - hit.t < CACHE_MS) return hit.d;
  var rows = [];
  A.allUsers().forEach(function (u) {
    var acc = accOf(u); if (!acc || !acc.introDone) return;
    var p = progOf(acc), row = { user: u.name, name: acc.name.slice(0, 20), avatar: avatarOf(acc) };
    if (k === 'flora') { if (!p.flora.max) return; row.v = p.flora.max; row.s = p.flora.stars; row.key = p.flora.max * 1000 + p.flora.stars; }
    else { if (!p.tower.best && !p.tower.clears) return; row.v = p.tower.best; row.s = p.tower.clears; row.key = p.tower.clears * 1000 + p.tower.best; }
    rows.push(row);
  });
  rows.sort(function (a, b) { return b.key - a.key; });
  var edges = k === 'flora' ? [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50]] : [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 59], [60, 60]];
  var buckets = edges.map(function (e) { return { label: e[0] === e[1] ? (k === 'tower' ? '通关' : '第 ' + e[0] + ' 关') : (k === 'tower' ? '第 ' : '第 ') + e[0] + '~' + e[1] + (k === 'tower' ? ' 层' : ' 关'), n: rows.filter(function (r) { return r.v >= e[0] && r.v <= e[1]; }).length }; });
  var d = { players: rows.length, buckets: buckets, rows: rows };
  cache[k] = { t: Date.now(), d: d };
  return d;
}

A.use(function (req, res, url) {
  if (url !== '/api/chalboard') return false;
  var who = A.whoIs(req);
  if (!who || !A.loadUser(who.user)) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  var q = {}; (req.url.split('?')[1] || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
  var k = q.k === 'tower' ? 'tower' : q.k === 'flora' ? 'flora' : null;
  if (!k) { A.reply(res, 400, { error: '参数不对' }); return true; }
  var b = board(k), idx = -1;
  for (var i = 0; i < b.rows.length; i++) if (b.rows[i].user === who.user) { idx = i; break; }
  var strip = function (r) { return { user: r.user, name: r.name, avatar: r.avatar, v: r.v, s: r.s }; };
  A.reply(res, 200, { k: k, players: b.players, buckets: b.buckets, top: b.rows.slice(0, 10).map(strip), me: idx >= 0 ? Object.assign(strip(b.rows[idx]), { rank: idx + 1 }) : null });
  return true;
});

module.exports = { progOf: progOf };
