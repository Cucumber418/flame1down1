/*
 * 友情点与好友送经验（2026-11-01）
 *
 * 存在 DATA_DIR/friendpt.json：
 *   pend: { 账号: { fp: 待领的友情点, exp: 待领的经验, gifts: [{ user, name }] } }   还没领的（交易 fpClaim 领取，见 js/engine/summon.js）
 *   sent: { 'YYYY-MM-DD|送礼人|收礼人': 1 }                                   每天可以给每位好友各送一次经验（2026-11-01 改）
 *   gfp:  { 'YYYY-MM-DD|送礼人': 当天送礼得到的友情点 }                           送礼人每天从送礼拿到的友情点最多 GIFT_CAP（收礼不限）
 *   help: { 'YYYY-MM-DD|账号': 当天借助战得到的友情点 }                           借助战的友情点每天最多 HELP_CAP
 *
 * 好友送经验：收礼人 +10000 经验、+200 友情点；送礼人 +200 友情点（每天最多 GIFT_CAP）。
 * 借助战（server/helpuse.js 记一次时调用 helpFp）：借用者和主人各 +100 友情点，各自每天最多 HELP_CAP。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/fp-state              今天送过谁（{ sent: [收礼人] }）
 *   POST /api/fp-gift { user }      给好友送经验
 */
'use strict';

var path = require('path');
var fs = require('fs');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'friendpt.json');
var GIFT_EXP = 10000, GIFT_FP = 200, GIFT_CAP = 2000, HELP_FP = 100, HELP_CAP = 1000, BJ = 8 * 3600 * 1000;

function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d && typeof d === 'object') { d.pend = d.pend || {}; d.sent = d.sent || {}; d.help = d.help || {}; d.gfp = d.gfp || {}; return d; } } catch (e) {} return { pend: {}, sent: {}, help: {}, gfp: {} }; }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function today() { return new Date(Date.now() + BJ).toISOString().slice(0, 10); }
function prune(d) { var t = today(); ['sent', 'help', 'gfp'].forEach(function (k) { Object.keys(d[k]).forEach(function (x) { if (x.slice(0, 10) !== t) delete d[k][x]; }); }); }
function pend(d, name) { return d.pend[name] || (d.pend[name] = { fp: 0, exp: 0, gifts: [] }); }
function dispName(u) {
  try { var acc = JSON.parse(((u.save && u.save.data) || {})['hs-account-v1'] || 'null'); if (acc && typeof acc.name === 'string') return acc.name.slice(0, 20); } catch (e) {}
  return u.name;
}

// 借助战：借用者 me、主人 owner 各 +100 友情点（每天各自最多 HELP_CAP）
function helpFp(me, owner) {
  var d = load(); prune(d); var t = today();
  [me, owner].forEach(function (n) { var k = t + '|' + n, got = d.help[k] || 0; if (got >= HELP_CAP) return; var add = Math.min(HELP_FP, HELP_CAP - got); d.help[k] = got + add; pend(d, n).fp += add; });
  store(d);
}
// 领取（并清空）
function take(name) {
  var d = load(), p = d.pend[name];
  if (!p) return null;
  delete d.pend[name]; store(d);
  return { fp: p.fp | 0, exp: p.exp | 0, gifts: (p.gifts || []).slice(0, 50) };
}
require('./tx').hook('fp', function (u) { return take(u.name); });

A.use(function (req, res, url) {
  if (url !== '/api/fp-state' && url !== '/api/fp-gift') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  if (url === '/api/fp-state') { var d0 = load(); prune(d0); var pre = today() + '|' + me.name + '|'; A.reply(res, 200, { ok: true, sent: Object.keys(d0.sent).filter(function (x) { return x.indexOf(pre) === 0 && x.split('|').length === 3; }).map(function (x) { return x.slice(pre.length); }), got: d0.gfp[today() + '|' + me.name] || 0, cap: GIFT_CAP, exp: GIFT_EXP, fp: GIFT_FP }); return true; }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '请求方式不对' }); return true; }
  A.readBody(req, function (err, body) {
    if (err || !body) return A.reply(res, 400, { error: '请求格式不对' });
    var o = A.loadUser(String(body.user || ''));
    if (!o || o.name === me.name) return A.reply(res, 400, { error: '找不到这位船员' });
    if (!(Array.isArray(me.friends) && me.friends.indexOf(o.name) >= 0)) return A.reply(res, 400, { error: '只能给好友送经验' });
    var d = load(); prune(d); var k = today() + '|' + me.name + '|' + o.name, gk = today() + '|' + me.name;
    if (d.sent[k]) return A.reply(res, 400, { error: '今天已经给 Ta 送过了，明天再来吧' });
    d.sent[k] = 1;
    var po = pend(d, o.name); po.exp += GIFT_EXP; po.fp += GIFT_FP; po.gifts.push({ user: me.name, name: dispName(me) }); if (po.gifts.length > 50) po.gifts = po.gifts.slice(-50);
    var mine = Math.max(0, Math.min(GIFT_FP, GIFT_CAP - (d.gfp[gk] || 0)));   // 送礼人自己的友情点每天最多 GIFT_CAP
    if (mine) { d.gfp[gk] = (d.gfp[gk] || 0) + mine; pend(d, me.name).fp += mine; }
    store(d);
    A.reply(res, 200, { ok: true, to: o.name, fp: mine });
  });
  return true;
});

module.exports = { helpFp: helpFp };
