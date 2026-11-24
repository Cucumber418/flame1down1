/* 好友种植园、偷菜与种植园动态；存档中的田和每日限额由服务器管理。 */
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var A = require('./accounts'), T = require('./tx');
var FILE = path.join(A.DATA_DIR, 'farmlog.json'), KEEP = 200;
function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { logs: d.logs || {}, seen: d.seen || {} }; } catch (e) { return { logs: {}, seen: {} }; } }
function store(d) { fs.writeFileSync(FILE + '.tmp', JSON.stringify(d)); fs.renameSync(FILE + '.tmp', FILE); }
function acc(u) { try { return JSON.parse(u.save.data['hs-account-v1']); } catch (e) { return null; } }
function social() { return require('./social'); }
function activity(owner, user, kind, info) {
  var d = load(), list = d.logs[owner] || [], now = Date.now(), e;
  if (kind === 'visit') {
    for (var j = list.length - 1; j >= 0; j--) if (list[j].user === user && list[j].kind === kind && now - list[j].t < 30 * 60000) return;
  }
  e = { id: crypto.randomBytes(6).toString('hex'), t: now, user: user, kind: kind };
  ['i', 'seed', 'crop', 'n', 'plantedAt', 'stolen', 'remaining'].forEach(function (k) { if (info && info[k] != null) e[k] = info[k]; });
  list.push(e); d.logs[owner] = list.slice(-KEEP); store(d);
  try { social().toUser(owner, Object.assign({ type: 'farm-ev', name: social().gameName(user) }, e)); } catch (err) {}
}
T.hook('farmSteal', function (u, arg) {
  var E = T.engine(), owner = String(arg.owner || ''), i = +arg.i;
  if (!E || !E.GROW) return { err: '服务器暂时不能处理，请稍后重试' };
  if (!owner || owner === u.name) return { err: '不能偷自己种植园的作物' };
  var ou = A.loadUser(owner);
  if (!ou || !(A.areFriends(u, ou))) return { err: '只能去好友的种植园偷菜' };
  var oa = acc(ou);
  if (!oa || !oa.introDone) return { err: '对方还没有创建角色' };
  var r = E.GROW.farmStealFrom(oa, i, u.name, Math.min(E.GROW.FARM_STEAL_DAY, Math.max(0, Math.floor(+arg.cap || 0))), Date.now());
  if (r.err) return r;
  ou.save.data['hs-account-v1'] = JSON.stringify(oa); A.saveUser(ou);
  try { activity(ou.name, u.name, 'steal', r); } catch (e) { console.error('种植园动态保存失败', e.message); }
  return r;
});
A.use(function (req, res, url) {
  if (url !== '/api/farm' && url !== '/api/farm-log') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  if (req.method !== 'GET') { A.reply(res, 405, { error: '不支持的操作' }); return true; }
  var match = /[?&]user=([^&]*)/.exec(req.url), name;
  try { name = match ? decodeURIComponent(match[1]) : me.name; } catch (e) { A.reply(res, 400, { error: '账号格式不对' }); return true; }
  var owner = A.loadUser(name);
  if (!owner) { A.reply(res, 404, { error: '没有这个玩家' }); return true; }
  var mine = owner.name === me.name;
  if (url === '/api/farm-log') {
    if (!mine) { A.reply(res, 403, { error: '只有主人能查看种植园动态' }); return true; }
    var data = load(), seen = data.seen[me.name] || 0, list = data.logs[me.name] || [];
    var unread = list.filter(function (e) { return e.user !== me.name && e.t > seen; }).length;
    if (/[?&]peek=1/.test(req.url)) { A.reply(res, 200, { newLog: unread }); return true; }
    var logs = list.slice(-60).reverse().map(function (e) { return Object.assign({}, e, { name: social().gameName(e.user), avatar: social().avatarOf(e.user) }); });
    data.seen[me.name] = Date.now(); store(data); A.reply(res, 200, { logs: logs, seen: seen }); return true;
  }
  var friend = A.areFriends(me, owner);
  if (!mine && !friend) { A.reply(res, 403, { error: '不能拜访这个种植园' }); return true; }
  var E = T.engine(), oa = acc(owner), ma = acc(me);
  if (!E || !E.GROW) { A.reply(res, 503, { error: '种植园暂时不可用' }); return true; }
  if (!oa || !oa.introDone) { A.reply(res, 200, { user: owner.name, noChar: true }); return true; }
  var open = E.GROW.farmOpen(oa), now = Date.now(), n = E.GROW.farmN(oa), cap = E.GROW.farmStealLeft(ma, now), plots = [];
  for (var i = 0; i < n; i++) {
    var p = oa.farm && oa.farm.plots && oa.farm.plots[i], seed = p && E.GROW.SEEDS[p.seed];
    plots.push(open && seed ? { seed: p.seed, t: p.t, st: Math.max(0, p.st | 0), remaining: E.GROW.farmNet(p), steal: friend ? E.GROW.farmStealView(p, me.name, cap, now) : { n: 0 } } : null);
  }
  if (open && friend) activity(owner.name, me.name, 'visit');
  A.reply(res, 200, { user: owner.name, name: String(oa.name || owner.name).slice(0, 20), me: mine, friend: friend, open: open, homeOpen: !!(oa.story && oa.story.tea && oa.story.tea.done), n: n, plots: plots, now: now, stealLeft: cap, stealDay: E.GROW.FARM_STEAL_DAY });
  return true;
});
module.exports = { activity: activity, FILE: FILE };
