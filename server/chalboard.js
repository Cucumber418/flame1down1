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
  var F = acc && acc.avatarF;   // 新头像：获得过的任意形态 { sid, st, shiny }
  if (F && typeof F.sid === 'string' && /^[a-z0-9_]{1,32}$/.test(F.sid)) return { sid: F.sid, st: Math.max(0, Math.min(2, F.st | 0)), shiny: F.shiny === 2 ? 2 : !!F.shiny,
    c: Array.isArray(F.c) && F.c.length === 3 && F.c.every(function (x) { return typeof x === 'number' && isFinite(x) && x > -3 && x < 4; }) ? F.c.map(function (x) { return Math.round(x * 10000) / 10000; }) : undefined };   // c：玩家自己裁的框
  var m = acc && acc.avatar != null ? acc.mons.filter(function (x) { return x && x.u === acc.avatar; })[0] : null;
  return m ? { sid: String(m.sid).slice(0, 32), lv: Math.max(1, Math.min(100, m.lv | 0)), shiny: m.shiny === 2 ? 2 : !!m.shiny, fs: m.fs != null && m.fs >= 0 && m.fs <= 2 ? m.fs | 0 : undefined } : null;
}
function chalProg(c, pre) {   // 某条挑战路线的星数和打到第几关（fl1..fl50 / kc1..kc50）
  var stars = 0, max = 0;
  for (var i = 1; i <= FLORA_N; i++) {
    var r = c[pre + i], n = r && Array.isArray(r.s) ? r.s.filter(Boolean).length : 0;
    if (n) { stars += n; max = i; }
  }
  return { stars: stars, max: max, total: FLORA_N * 3, levels: FLORA_N };
}
function progOf(acc) {
  var c = (acc && acc.chal) || {};
  var T = (acc && acc.tower) || {};
  return { flora: chalProg(c, 'fl'), kamble: chalProg(c, 'kc'),   // kamble：坎伯兰星挑战路线（2026-11-01）
    tower: { best: Math.max(0, Math.min(TOWER_TOP, T.best | 0)), clears: Math.max(0, T.clears | 0), cur: Math.max(1, Math.min(TOWER_TOP, T.f | 0 || 1)), top: TOWER_TOP } };
}
function board(k) {
  var hit = cache[k]; if (hit && Date.now() - hit.t < CACHE_MS) return hit.d;
  var rows = [];
  A.allUsers().forEach(function (u) {
    var acc = accOf(u); if (!acc || !acc.introDone) return;
    var p = progOf(acc), row = { user: u.name, name: acc.name.slice(0, 20), avatar: avatarOf(acc) };
    if (k === 'flora' || k === 'kamble') { var C = p[k]; if (!C.max) return; row.v = C.max; row.s = C.stars; row.key = C.max * 1000 + C.stars; }
    else { if (!p.tower.best && !p.tower.clears) return; row.v = p.tower.best; row.s = p.tower.clears; row.key = p.tower.clears * 1000 + p.tower.best; }
    rows.push(row);
  });
  rows.sort(function (a, b) { return b.key - a.key; });
  var edges = k !== 'tower' ? [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50]] : [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 59], [60, 60]];
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
  var k = q.k === 'tower' ? 'tower' : q.k === 'flora' ? 'flora' : q.k === 'kamble' ? 'kamble' : null;
  if (!k) { A.reply(res, 400, { error: '参数不对' }); return true; }
  var b = board(k), idx = -1;
  for (var i = 0; i < b.rows.length; i++) if (b.rows[i].user === who.user) { idx = i; break; }
  var strip = function (r) { return { user: r.user, name: r.name, avatar: r.avatar, v: r.v, s: r.s }; };
  A.reply(res, 200, { k: k, players: b.players, buckets: b.buckets, top: b.rows.slice(0, 10).map(strip), me: idx >= 0 ? Object.assign(strip(b.rows[idx]), { rank: idx + 1 }) : null });
  return true;
});

module.exports = { progOf: progOf };
