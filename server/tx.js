/*
 * 交易结算（2026-10-24）：商城、各种代币商店、温泉、茶室扩容、矿石换能量、明明代币抽奖
 *
 * 规则和价格不写在这里，写在 js/engine/tx.js（浏览器也加载同一份）。服务器启动时把游戏的数据和引擎脚本
 * （index.html 里列出的 js/data/*、js/engine/*）加载进一个独立的运行环境，用里面的 TX.run 在服务器保存的存档上结算。
 *
 * 接口（需要登录）：
 *   POST /api/tx { op, args, v }   结算一笔交易。op 见 js/engine/tx.js 的 OPS；v 是浏览器加载的游戏版本
 *     成功 → { ok, rev, now, rolls }   rev 是存档新版本号；now、rolls 是结算用到的时间和随机数，浏览器用它们重算一遍
 *     失败 → 400 { error }（余额不足等）/ 409 { error, update: true }（游戏已更新，要刷新页面）
 *   GET  /api/version            → { v }   当前游戏版本（网页和脚本内容的指纹），浏览器发现变了就提示刷新
 *
 * 每笔交易记在 DATA_DIR/ledger.log（一行一笔：时间、账号、操作、余额变化），方便以后查账。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');
var A = require('./accounts');

var ROOT = path.resolve(__dirname, '..');
var LEDGER = path.join(A.DATA_DIR, 'ledger.log');

/* ---------- 游戏版本：网页、样式、脚本内容的指纹（部署后内容变了，指纹就变） ---------- */
function walk(dir, out) {
  fs.readdirSync(dir).sort().forEach(function (f) {
    var p = path.join(dir, f), s = fs.statSync(p);
    if (s.isDirectory()) walk(p, out); else if (/\.(js|css|html)$/.test(f)) out.push(p);
  });
  return out;
}
function computeVersion() {
  var h = crypto.createHash('sha1');
  [path.join(ROOT, 'index.html')].concat(walk(path.join(ROOT, 'css'), []), walk(path.join(ROOT, 'js'), [])).forEach(function (f) {
    h.update(path.relative(ROOT, f)); h.update(fs.readFileSync(f));
  });
  return h.digest('hex').slice(0, 12);
}
var VERSION = computeVersion();

/* ---------- 加载游戏规则 ---------- */
// 加载失败（比如服务器上的 Node.js 太老、不认识某种新写法）时不让整个服务器挂掉：只是暂时不能兑换，原因记在 LOAD_ERR 里（/status 能看到）
var TX = null, LOAD_ERR = null, ENGINE = null;   // ENGINE：加载了游戏数据和对战引擎的运行环境（联网对战的服务器裁判也用它，见 pvp.js）
try {
  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var files = [];
  html.replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g, function (m, f) { files.push(f); return m; });
  var ctx = vm.createContext({ console: console, window: {} });
  files.forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); });
  TX = vm.runInContext('TX', ctx);
  if (!TX || typeof TX.run !== 'function') throw new Error('js/engine/tx.js 里没有 TX');
  ENGINE = ctx;
} catch (e) { TX = null; LOAD_ERR = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); console.error('交易规则加载失败：', LOAD_ERR); }

/* ---------- 记账 ---------- */
function wallet(acc) {
  return { exp: acc.exp || 0, energy: acc.energy || 0, tokens: acc.tokens || 0, twTok: (acc.tower && acc.tower.tok) || 0, items: Object.assign({}, acc.items || {}) };
}
function diff(a, b) {
  var o = {};
  ['exp', 'energy', 'tokens', 'twTok'].forEach(function (k) { if (b[k] !== a[k]) o[k] = b[k] - a[k]; });
  var it = {}, keys = Object.keys(a.items).concat(Object.keys(b.items));
  keys.forEach(function (k) { var d = (b.items[k] || 0) - (a.items[k] || 0); if (d) it[k] = d; });
  if (Object.keys(it).length) o.items = it;
  return o;
}
function ledger(name, op, args, change) {
  try { fs.appendFileSync(LEDGER, JSON.stringify({ t: new Date().toISOString(), u: name, op: op, args: args, d: change }) + '\n'); } catch (e) {}
}

/* ---------- 接口 ---------- */
A.use(function (req, res, url) {
  if (url === '/api/version' && req.method === 'GET') { A.reply(res, 200, { v: VERSION }); return true; }
  if (url !== '/api/tx' || req.method !== 'POST') return false;
  A.readBody(req, function (err, body) {
    if (err || !body || typeof body !== 'object') return A.reply(res, 400, { error: '请求格式不对' });
    var who = A.whoIs(req), u = who && A.loadUser(who.user);
    if (!u) return A.reply(res, 401, { error: '登录已失效，请重新登录' });
    if (!TX) return A.reply(res, 503, { error: '服务器暂时不能处理兑换，请联系管理员。' });
    if (body.v && body.v !== VERSION) return A.reply(res, 409, { error: '游戏已经更新了，请刷新页面后再操作。', update: true, v: VERSION });
    var raw = u.save && u.save.data && u.save.data['hs-account-v1'];
    var acc = null; try { acc = JSON.parse(raw || 'null'); } catch (e) {}
    if (!acc || typeof acc !== 'object') return A.reply(res, 409, { error: '存档还没同步到服务器，请稍后再试。' });
    var op = String(body.op || ''), args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
    var before = wallet(acc), now = Date.now(), rand = TX.recorder(), r;
    try { r = TX.run(acc, op, args, { now: now, rand: rand, data: u.save.data, user: u.name }); } catch (e) { console.error('交易出错', op, e); return A.reply(res, 500, { error: '服务器出错了，这次没有扣费。' }); }
    if (!r || !r.ok) return A.reply(res, 400, { error: (r && r.err) || '没能完成' });
    u.save.data['hs-account-v1'] = JSON.stringify(acc);
    u.save.rev = (u.save.rev || 0) + 1; u.save.savedAt = now;
    A.saveUser(u);
    ledger(u.name, op, args, diff(before, wallet(acc)));
    A.reply(res, 200, { ok: true, rev: u.save.rev, now: now, rolls: rand.rolls.slice() });
  });
  return true;
});

module.exports = { VERSION: VERSION, TX: TX, engine: function () { return ENGINE; }, status: function () { return { v: VERSION, ok: !!TX, err: LOAD_ERR || undefined }; } };
