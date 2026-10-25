/*
 * 进账申报与钱包核对（2026-10-24）
 *
 * 浏览器里每次增加经验背包、能量、竞技代币、先驱代币、功勋、道具，都会记一条申报（js/ui/game.js 的 earn），
 * 随下一次上传存档（PUT /api/save 的 claims）一起发过来：{ c: 申报编号, s: 来源, i: 编号, d: { exp, energy, tokens, twTok, merit, meritXp, items } }
 *
 * 服务器这样处理：
 *   1. 逐条检查：来源要在 SRC 里；数值是正数、不超过单条上限；一次性来源（SRC 里是 1）同一个「来源:编号」只认一次
 *      （记在账号文件的 claimed 里，存档里改不到）；同一条申报重复上传（编号 c 一样）只算一次。
 *   2. 核对钱包：上传的存档里每一项（经验背包、能量、代币……每种道具）不能超过「服务器上一份存档 + 这次认可的申报」。
 *      变少（花掉、用掉）不受限制。
 *   3. MODE = 'observe'（试运行）：只把对不上的地方记进 DATA_DIR/wallet.log，存档照常保存；
 *      MODE = 'enforce'（正式）：把多出来的部分改回去，再把修正后的存档发回浏览器。
 *
 * 新增一种进账来源：在 SRC 里加一项（1 = 一次性，0 = 可重复），再在 game.js 里用 earn('来源', 编号, {...})。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var MODE = process.env.WALLET_MODE || 'enforce';   // 'observe' 只记录；'enforce' 改回多出来的数值（2026-10-24 起正式开启）
// 宽限期：还没刷新的旧页面（上线进账申报之前打开的）传不了申报，到这个时间之前只记录、不修正，免得误伤
var GRACE_UNTIL = Date.UTC(2026, 9, 25, 16, 0, 0);   // 北京时间 2026-10-26 00:00
var LABEL = { exp: '经验背包', energy: '能量', tokens: '竞技代币', twTok: '先驱代币', merit: '功勋', meritXp: '功勋经验' };

var SRC = {
  // 一次性：同一个编号只认一次
  story: 1, chapter: 1, sgive: 1, title: 1, mail: 1, quest: 1, chalStar: 1, chalFirst: 1, rankRw: 1, bossFirst: 1, mmFirst: 1,
  purge: 1, jade: 1, daily: 1, rankExp: 1, hornDay: 1, npc: 1, tea: 1, gather: 1, mine: 1, towerDeath: 1,
  // 可重复
  battle: 0, help: 0, cumber: 0, pw: 0, travel: 0, drop: 0, tower: 0, weekly: 0, ewk: 0, mm: 0, gx: 0, forge: 0, farm: 0, brawl: 0, fix: 0, misc: 0
};
// 编号里带日期的来源：记录保留 120 天后清掉，账号文件不会越来越大
var DATED = { daily: 1, rankExp: 1, hornDay: 1, npc: 1, tea: 1, gather: 1, mine: 1 };
var KEEP_MS = 120 * 864e5;
// 单条申报的上限（远高于游戏里任何一次正常奖励，只拦明显造假的）
var MAX = { exp: 20e6, energy: 3e6, tokens: 2e5, twTok: 1e5, merit: 1e6, meritXp: 1e6, item: 1e5 };
var FIELDS = ['exp', 'energy', 'tokens', 'twTok', 'merit', 'meritXp'];
var CID_KEEP = 400, PER_UPLOAD = 1000;

var DATA_DIR = null, LOG = null;
function init(dir) { DATA_DIR = dir; LOG = path.join(dir, 'wallet.log'); }
function log(obj) { try { fs.appendFileSync(LOG, JSON.stringify(obj) + '\n'); } catch (e) {} }

/* ---------- 从存档里取出钱包 ---------- */
function accOf(data) { try { var a = JSON.parse((data || {})['hs-account-v1'] || 'null'); return a && typeof a === 'object' ? a : null; } catch (e) { return null; } }
function n0(v) { v = +v; return isFinite(v) ? v : 0; }
function wallet(acc) {
  var it = {}, I = acc.items && typeof acc.items === 'object' ? acc.items : {};
  for (var k in I) it[k] = n0(I[k]);
  return { exp: n0(acc.exp), energy: n0(acc.energy), tokens: n0(acc.tokens), twTok: n0(acc.tower && acc.tower.tok), merit: n0(acc.merit), meritXp: n0(acc.meritXp), items: it };
}
function blank() { return { exp: 0, energy: 0, tokens: 0, twTok: 0, merit: 0, meritXp: 0, items: {} }; }
function addTo(sum, d) { FIELDS.forEach(function (f) { if (d[f]) sum[f] += d[f]; }); for (var k in d.items || {}) sum.items[k] = (sum.items[k] || 0) + d.items[k]; }

/* ---------- 检查一条申报，返回整理好的数值；不合格返回 null ---------- */
// 2026-10-24 起由服务器直接发的奖励：浏览器不该再申报，宽限期过后这些来源的申报一律不认
var SERVER_ONLY = { tower: 1, towerDeath: 1, bossFirst: 1, weekly: 1, ewk: 1 };   // 这些奖励已经改由服务器直接发（server/pve.js），浏览器申报的不认
function clean(c) {
  if (!c || typeof c !== 'object' || typeof c.c !== 'string' || c.c.length > 40 || !SRC.hasOwnProperty(c.s)) return null;
  if (SERVER_ONLY[c.s] && Date.now() >= GRACE_UNTIL) return null;
  var d = c.d && typeof c.d === 'object' ? c.d : {}, o = { items: {} }, any = false;
  for (var i = 0; i < FIELDS.length; i++) {
    var f = FIELDS[i]; if (d[f] == null) continue;
    var v = +d[f]; if (!(v > 0) || !isFinite(v) || v > MAX[f]) return null;
    o[f] = v; any = true;
  }
  if (d.items != null) {
    if (typeof d.items !== 'object') return null;
    for (var k in d.items) {
      var n = +d.items[k];
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k) || !(n > 0) || !isFinite(n) || n > MAX.item) return null;
      o.items[k] = n; any = true;
    }
  }
  return any ? o : null;
}

/* ---------- 处理一次上传：u 是账号记录（会记下 claimed / cids），oldData / newData 是上一份和这次上传的存档 ----------
 * 返回 { data: 要保存的存档（enforce 模式下可能改过）, fixed: 修正说明（没改就是空） } */
// 把塔的进度改回服务器上的（服务器那份没有的字段就删掉）
// 只由服务器改的字段（「对象.字段」或整个顶层字段）：上传的存档里改了，悄悄改回服务器的
var OWNED = ['tower.f', 'tower.cp', 'tower.best', 'tower.clears', 'tower.death', 'tower.day', 'bosses', 'permit'];
function getP(o, p) { var k = p.split('.'); return k.length === 1 ? o[k[0]] : o[k[0]] && typeof o[k[0]] === 'object' ? o[k[0]][k[1]] : undefined; }
function ownDiff(A, B) { return OWNED.filter(function (p) { var k = p.split('.'); if (k.length > 1 && (!A[k[0]] || !B[k[0]])) return false; return JSON.stringify(getP(A, p)) !== JSON.stringify(getP(B, p)); }); }
function twBack(A, B, keys) {
  keys.forEach(function (p) {
    var k = p.split('.'), src = k.length === 1 ? A : A[k[0]], dst = k.length === 1 ? B : B[k[0]], f = k[k.length - 1];
    if (src[f] === undefined) delete dst[f]; else dst[f] = JSON.parse(JSON.stringify(src[f]));
  });
}
function onUpload(u, list, oldData, newData, info) {
  var now = Date.now(), ok = blank(), bad = blank(), notes = [];
  if (!u.claimed || typeof u.claimed !== 'object') u.claimed = {};
  if (!Array.isArray(u.cids)) u.cids = [];
  var seen = {}; u.cids.forEach(function (x) { seen[x] = 1; });
  (Array.isArray(list) ? list.slice(0, PER_UPLOAD) : []).forEach(function (c) {
    if (c && typeof c.c === 'string' && seen[c.c]) return;   // 重复上传的同一条：已经算过了
    var d = clean(c);
    if (c && typeof c.c === 'string') { seen[c.c] = 1; u.cids.push(c.c); }
    if (!d) { if (c && c.d) addTo(bad, c.d && typeof c.d === 'object' ? sane(c.d) : {}); notes.push('无效申报 ' + (c && c.s)); return; }
    var id = String(c.i == null ? '' : c.i).slice(0, 80);
    if (SRC[c.s] === 1) {
      var key = c.s + ':' + id;
      if (u.claimed[key]) { addTo(bad, d); notes.push('重复领取 ' + key); return; }
      u.claimed[key] = now;
    }
    addTo(ok, d);
  });
  if (u.cids.length > CID_KEEP) u.cids = u.cids.slice(-CID_KEEP);
  for (var k in u.claimed) { var s = k.split(':')[0]; if (DATED[s] && now - u.claimed[k] > KEEP_MS) delete u.claimed[k]; }

  // 核对钱包
  var A = accOf(oldData), B = accOf(newData);
  if (!A || !B) return { data: newData, fixed: '' };
  var a = wallet(A), b = wallet(B), over = [];
  // 上限 lim = 上一份 + 认可的申报；超过上限时，改成 min(上传值 − 不认可的申报, 上限)：既去掉没申报的部分，也扣回被拒的申报
  function chk(f, av, bv, okv, badv) { var lim = av + okv; if (bv > lim) { var to = Math.max(0, Math.min(bv - badv, lim)); over.push({ f: f, by: bv - to, to: to }); } }
  FIELDS.forEach(function (f) { chk(f, a[f], b[f], ok[f], bad[f]); });
  Object.keys(b.items).forEach(function (k) { chk('items.' + k, a.items[k] || 0, b.items[k], ok.items[k] || 0, bad.items[k] || 0); });
  stat.uploads++; if (!info.claims) stat.oldClient++;
  var enforce = MODE === 'enforce' && (info.claims || now >= GRACE_UNTIL);
  // 先驱之塔的进度（层数、存档点、通关次数、死神代币次数、今天的塔内奖励）只由服务器推进（server/pve.js）：上传的存档改不了
  var twFix = enforce ? ownDiff(A, B) : [];
  if (!over.length && !notes.length && !twFix.length) return { data: newData, fixed: '' };
  if (over.length) { stat.over++; stat.last.unshift({ t: new Date(now).toISOString(), old: !info.claims, over: over.map(function (x) { return x.f + ' +' + x.by; }) }); stat.last = stat.last.slice(0, 15); }
  if (over.length || notes.length) log({ t: new Date(now).toISOString(), u: u.name, mode: enforce ? 'enforce' : 'observe', oldClient: !info.claims, over: over, notes: notes });
  if (twFix.length && !over.length) {   // 只有服务器管的字段对不上：悄悄改回服务器的（正常情况下是本机跨天重置了今天的计数，不弹窗）
    twBack(A, B, twFix);
    var o2 = {}; for (var kk in newData) o2[kk] = newData[kk]; o2['hs-account-v1'] = JSON.stringify(B);
    return { data: o2, fixed: '' };
  }
  if (!enforce || !over.length) return { data: newData, fixed: '' };
  stat.fixed++;
  twBack(A, B, twFix);
  // 正式模式：把多出来的改回去
  over.forEach(function (x) {
    if (x.f.indexOf('items.') === 0) { if (!B.items) B.items = {}; B.items[x.f.slice(6)] = x.to; }
    else if (x.f === 'twTok') { if (!B.tower) B.tower = {}; B.tower.tok = x.to; }
    else B[x.f] = x.to;
  });
  var out = {}; for (var key2 in newData) out[key2] = newData[key2];
  out['hs-account-v1'] = JSON.stringify(B);
  var names = []; over.forEach(function (x) { var n = x.f.indexOf('items.') === 0 ? '道具' : LABEL[x.f] || x.f; if (names.indexOf(n) < 0) names.push(n); });
  return { data: out, fixed: names.join('、') };
}
function sane(d) { var o = { items: {} }; FIELDS.forEach(function (f) { var v = +d[f]; if (v > 0 && isFinite(v)) o[f] = v; }); if (d.items && typeof d.items === 'object') for (var k in d.items) { var n = +d.items[k]; if (n > 0 && isFinite(n)) o.items[k] = n; } return o; }

// /status 里显示的统计（不含账号名）：从服务器启动起有多少次上传、多少次对不上
var stat = { since: new Date().toISOString(), uploads: 0, oldClient: 0, over: 0, fixed: 0, last: [] };
function status() { return { mode: MODE, graceUntil: new Date(GRACE_UNTIL).toISOString(), since: stat.since, uploads: stat.uploads, oldClient: stat.oldClient, mismatch: stat.over, fixed: stat.fixed, recent: stat.last }; }

module.exports = { init: init, onUpload: onUpload, status: status, SRC: SRC, MODE: MODE };
