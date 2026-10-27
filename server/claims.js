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
var DATED = { daily: 1, rankExp: 1, hornDay: 1, npc: 1, tea: 1, gather: 1, mine: 1, jade: 1 };
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
var SERVER_ONLY = { tower: 1, towerDeath: 1, bossFirst: 1, weekly: 1, ewk: 1, chalFirst: 1, mmFirst: 1, mm: 1, cumber: 1, npc: 1, tea: 1, purge: 1, pw: 1, travel: 1, drop: 1, rankExp: 1, battle: 1, forge: 1, gx: 1, farm: 1, help: 1, brawl: 1, gather: 1, mine: 1, jade: 1, hornDay: 1, daily: 1, quest: 1, story: 1, chapter: 1, sgive: 1, title: 1, mail: 1, chalStar: 1, rankRw: 1, fix: 1, misc: 1 };   // 这些奖励已经改由服务器直接发（server/pve.js），浏览器申报的不认
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
var OWNED = ['tower.f', 'tower.cp', 'tower.best', 'tower.clears', 'tower.death', 'tower.day', 'bosses', 'permit', 'chal', 'mm.clr', 'mm.wins', 'cumberFt', 'npcWin', 'teaFight', 'purge', 'pwd', 'travel', 'rankExp', 'farm', 'nursery', 'home.mons', 'brawlExp', 'giftGot',
  'gather', 'mine', 'drill', 'jade', 'hornDay', 'herbSeed', 'xcq',   // 野外每日产出（js/engine/world.js，2026-10-25）
  'daily', 'quests', 'stats.wildWins',   // 每日任务、世界任务（js/engine/quest.js）
  'chapters', 'starter', 'rival', 'split8',   // 剧情（js/engine/story.js）；a.story 另外处理（storyFix）
  'titles', 'titleRw', 'milRank', 'milV', 'chalGot', 'rankRw', 'matsV', 'ctPlace', 'loginDay', 'created', 'pw', 'tokenBack', 'purgeX10',   // 称号、军衔、星数和段位奖励、邮箱投递记录（js/engine/award.js）
  'spa.run', 'spa.got', 'spa.ms', 'spa.extra', 'spa.bgmOwn', 'spa.juice', 'home.cap', 'mm.g', 'pveXp', 'emblems', 'fmNpc', 'riceBowl'];   // 其他由交易、对战结算改的记录
var OWNED_KEYS = ['hs-rank-v1', 'hs-draft-v1'];   // 整个存档项只由服务器改：段位、平衡排位本局阵容（server/pve.js）
function getP(o, p) { var k = p.split('.'); return k.length === 1 ? o[k[0]] : o[k[0]] && typeof o[k[0]] === 'object' ? o[k[0]][k[1]] : undefined; }
function ownDiff(A, B) { return OWNED.filter(function (p) { var k = p.split('.'); if (k.length > 1 && (!A[k[0]] || !B[k[0]])) return false; var a = getP(A, p), b = getP(B, p); return JSON.stringify(a) !== JSON.stringify(b) && !(blankV(a) && blankV(b)) && !fresh(p, a, b, A); }); }
function blankV(v) { return v == null || (typeof v === 'object' && !Object.keys(v).length); }   // 没有和空的 [] / {} 算一样（浏览器读的时候顺手建了个空记录）
// 按天记的记录：浏览器跨天后自己清空成「今天、什么都没领」是正常的（服务器那份还是昨天的），不算改动
var FRESH = { gather: 'day', mine: 'day', jade: 'd', 'tower.day': 'd', rankExp: 'd', npcWin: 'd', pwd: 'd', brawlExp: 'd', pveXp: 'd' };
function fresh(p, a, b, A) {
  var E = require('./tx').engine();
  if (p === 'daily' && E && E.QST && b && (!a || a.date !== b.date)) {   // 每日任务：浏览器跨天后按同样的规则抽了今天的一套（进度都是 0）
    var C = JSON.parse(JSON.stringify(A)); delete C.daily;
    return b.date === E.PVE.bjDay(Date.now()) && JSON.stringify(E.QST.daily(C, Date.now())) === JSON.stringify(b);
  }
  var f = FRESH[p]; if (!f || !E || !b || typeof b !== 'object') return false;
  var now = Date.now(), today = typeof b[f] === 'number' ? E.TX.dayNum(now) : E.TX.bjDay(now);
  if (b[f] !== today || (a && a[f] === today)) return false;
  return Object.keys(b).every(function (k) { var v = b[k]; return k === f || !v || (typeof v === 'object' && !Object.keys(v).length); });
}
// 剧情进度：每段只有 at（读到第几句）、ch（选项）由浏览器记，其余（读完、奖励、对战结果……）用服务器的
function canon(v) { if (v && typeof v === 'object' && !Array.isArray(v)) { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = canon(v[k]); }); return o; } return v; }
function storyFix(A, B) {
  var SA = A.story && typeof A.story === 'object' ? A.story : {}, SB = B.story && typeof B.story === 'object' ? B.story : {}, out = {};
  Object.keys(SA).concat(Object.keys(SB)).forEach(function (k) {
    if (out.hasOwnProperty(k)) return;
    var a = SA[k], b = SB[k], o = a && typeof a === 'object' ? JSON.parse(JSON.stringify(a)) : null;
    if (b && typeof b === 'object') {
      if (!o) o = { at: 0, done: false, ch: null };
      if (typeof b.at === 'number' && isFinite(b.at)) o.at = b.at;
      if (b.ch === null || (typeof b.ch === 'string' && b.ch.length < 40)) o.ch = b.ch;
    }
    if (o) out[k] = o;
  });
  if (JSON.stringify(canon(out)) === JSON.stringify(canon(SB))) return false;
  B.story = out; return true;
}
// 邮箱：邮件只由服务器投递、领取（js/engine/award.js）。浏览器可以：标成已读、删掉已领的（或没有附件的）、自己加没有附件的通知；投递记录 mailSeen 只增不减
function hasAtt(x) { return !!(x && (x.exp || x.energy || x.merit || x.tokens || x.twTok || (x.items && Object.keys(x.items).length) || (x.mons && x.mons.length))); }
function mailFix(A, B) {
  var LA = Array.isArray(A.mail) ? A.mail : [], LB = Array.isArray(B.mail) ? B.mail : [], byA = {}, byB = {}, out = [];
  LA.forEach(function (m) { if (m && m.id) byA[m.id] = m; }); LB.forEach(function (m) { if (m && m.id) byB[m.id] = m; });
  LB.forEach(function (m) {
    if (!m || !m.id || typeof m.id !== 'string') return;
    var o = byA[m.id];
    if (o) { o = JSON.parse(JSON.stringify(o)); if (m.read) o.read = true; out.push(o); }
    else if (!hasAtt(m.att) && m.id.length < 60) out.push({ id: m.id, t: +m.t || 0, date: String(m.date || '').slice(0, 20), from: String(m.from || '').slice(0, 40), title: String(m.title || '').slice(0, 100), body: String(m.body || '').slice(0, 2000), att: null, read: !!m.read, got: true });
  });
  LA.forEach(function (m) { if (m && m.id && !byB[m.id] && hasAtt(m.att) && !m.got) out.push(JSON.parse(JSON.stringify(m))); });   // 还没领的附件邮件不能删
  out.sort(function (x, y) { return (y.t || 0) - (x.t || 0); });
  var seen = {}, SA = A.mailSeen && typeof A.mailSeen === 'object' ? A.mailSeen : {}, SB = B.mailSeen && typeof B.mailSeen === 'object' ? B.mailSeen : {};
  for (var k in SB) if (k.length < 80) seen[k] = SB[k]; for (var k2 in SA) seen[k2] = SA[k2];
  var ch = JSON.stringify(canon(out)) !== JSON.stringify(canon(LB)) || JSON.stringify(canon(seen)) !== JSON.stringify(canon(SB));
  if (ch) { B.mail = out; B.mailSeen = seen; }
  // 上次在线时间（离线经验按它算）：只能往前走，不能超过现在
  var la = +A.lastActive || 0, lb = Math.min(+B.lastActive || 0, Date.now()), lt = Math.max(la, lb);
  if (lt && B.lastActive !== lt) { B.lastActive = lt; ch = true; }
  return ch;
}
function topKeys(paths) { var o = {}; paths.forEach(function (p) { o[p.split('.')[0]] = 1; }); return Object.keys(o); }
function twBack(A, B, keys) {
  keys.forEach(function (p) {
    if (p === 'story' || p === 'mail' || p === 'mailSeen' || p === 'lastActive') return;
    var k = p.split('.'), src = k.length === 1 ? A : A[k[0]], dst = k.length === 1 ? B : B[k[0]], f = k[k.length - 1];
    if (src[f] === undefined) delete dst[f]; else dst[f] = JSON.parse(JSON.stringify(src[f]));
  });
}
function expectOf(src, id) { var E = require('./tx').engine(); return E && E.RW ? E.RW.expect(src, id) : null; }
// 申报的数额超过表里的：超出的部分算作不认的
function clip(d, X, bad) {
  var o = { items: {} }, ex = { items: {} };
  FIELDS.forEach(function (f) { if (!d[f]) return; var lim = X[f] || 0; o[f] = Math.min(d[f], lim); if (d[f] > lim) ex[f] = d[f] - lim; });
  for (var k in d.items || {}) { var lim2 = (X.items && X.items[k]) || 0; o.items[k] = Math.min(d.items[k], lim2); if (d.items[k] > lim2) ex.items[k] = d.items[k] - lim2; }
  addTo(bad, ex);
  return o;
}
function rankOk(oldData, id) {
  var r = +String(id).split(':').pop(), R = null;
  try { R = JSON.parse((oldData || {})['hs-rank-v1'] || 'null'); } catch (e) {}
  if (!R) return false;
  return Math.max(R.best || 0, R.r || 0) >= r;
}
function starsOk(oldData, n) {
  var E = require('./tx').engine(), a = accOf(oldData);
  if (!E || !E.PVE || !a) return true;
  return E.PVE.chalTotal(a, 'flora') >= n;
}
// 只由服务器改的整个存档项：上传的改回服务器的（服务器还没有时：段位只认初始的黑铁，本局阵容不认）
function keyFix(oldData, newData) {
  var out = newData, ch = false;
  OWNED_KEYS.forEach(function (k) {
    var o = oldData && oldData[k], n = newData && newData[k], keep;
    if (o != null) keep = o;
    else if (k === 'hs-rank-v1') { var R = null; try { R = JSON.parse(n || 'null'); } catch (e) {} keep = R && !(R.r > 0) && !(R.best > 0) && !(R.w > 0) ? n : undefined; }
    else keep = undefined;
    if (n === keep) return;
    if (!ch) { out = {}; for (var x in newData) out[x] = newData[x]; ch = true; }
    if (keep === undefined) delete out[k]; else out[k] = keep;
  });
  return out;
}
/* ---------- 精灵数值核对（2026-10-25，第三批） ----------
 * 精灵的等级、经验、天赋、学习力、性格、隐藏技能、异色、等级上限、形态解锁只能由服务器改（对战结算、交易）。
 * 上传的存档里这些变了、或者凭空多了精灵，就是浏览器自己改的。MON_MODE：'observe' 只记录（/status 的 mons），'enforce' 改回服务器的。 */
var MON_MODE = 'enforce';
var MON_KEYS = ['sid', 'lv', 'exp', 'iv', 'ev', 'evFree', 'nat', 'hl', 'shiny', 'lvCap', 'fu', 'got'];
var mstat = { checked: 0, bad: 0, fixed: 0, last: [] };
function same(x, y) { return JSON.stringify(x === undefined ? null : x) === JSON.stringify(y === undefined ? null : y); }
function monCheck(A, B) {
  var E = require('./tx').engine(); if (!E || !E.ACC || !Array.isArray(A.mons) || !Array.isArray(B.mons)) return null;
  var byU = {}; A.mons.forEach(function (m) { if (m && m.u != null) byU[m.u] = m; });
  var issues = [], keep = [];
  var starter = !A.mons.length && B.mons.length <= 2 && B.mons.every(function (m) { return m && m.lv <= 20; });   // 新账号选初始精灵
  B.mons.forEach(function (m) {
    if (!m || m.u == null) return;
    var o = byU[m.u];
    if (!o) { if (starter) { keep.push(m); return; } issues.push({ u: m.u, f: 'new:' + m.sid + ':LV' + m.lv }); return; }
    var fix = null;
    MON_KEYS.forEach(function (k) {
      if (same(o[k], m[k])) return;
      if (k === 'iv' && !E.ACC.ivOk(o.iv)) { if (E.ACC.ivOk(m.iv) && MON_MODE !== 'enforce') return; o.iv = E.ACC.randIv(Math.random); }   // 天赋系统上线前的精灵：由服务器补一套（不认浏览器补的）
      if (k === 'nat' && !(o.nat in NATURES())) { if ((m.nat in NATURES()) && MON_MODE !== 'enforce') return; o.nat = E.ACC.randNat(Math.random); }
      if ((k === 'ev' && o.ev == null) || (k === 'evFree' && o.evFree == null)) return;
      if ((k === 'lv' || k === 'exp') && A.expV !== B.expV) return;   // 经验曲线换版时的换算
      if (k === 'hl' && A.hlFix !== 1 && B.hlFix === 1) return;   // 小月亮、骨刃隐藏技能恢复（一次性）
      issues.push({ u: m.u, f: k }); (fix || (fix = {}))[k] = 1;
    });
    // 出战技能：只能是这只精灵现在会的
    var av = E.ACC.avail(o.sid, o.lv, Array.isArray(o.hl) ? o.hl : []);
    if (Array.isArray(m.moves) && (m.moves.length > 4 || m.moves.some(function (n, i, a) { return av.indexOf(n) < 0 || a.indexOf(n) !== i; }))) { issues.push({ u: m.u, f: 'moves' }); (fix || (fix = {})).moves = 1; }
    keep.push({ m: m, o: o, fix: fix });
  });
  if (!(B.next >= A.next)) issues.push({ u: null, f: 'next' });
  return { issues: issues, keep: keep };
}
function monApply(A, B, r) {   // 正式模式：改回服务器的
  B.mons = r.keep.map(function (x) {
    if (!x.o) return x;   // 初始精灵
    if (!x.fix) return x.m;
    var m = JSON.parse(JSON.stringify(x.m));
    Object.keys(x.fix).forEach(function (k) { if (x.o[k] === undefined) delete m[k]; else m[k] = JSON.parse(JSON.stringify(x.o[k])); });
    return m;
  });
  var us = {}; B.mons.forEach(function (m) { us[m.u] = 1; });
  (B.teams || []).forEach(function (t, i) { if (Array.isArray(t)) B.teams[i] = t.filter(function (u) { return us[u]; }); });
  if (!(B.next >= A.next)) B.next = A.next;
}
function NATURES() { var E = require('./tx').engine(); return (E && E.NATURES) || {}; }
function monStep(u, oldData, newData, info, now) {
  var A = accOf(oldData), B = accOf(newData); if (!A || !B) return newData;
  var r = null; try { r = monCheck(A, B); } catch (e) { console.error('精灵核对出错', e && e.stack); }
  if (!r) return newData;
  mstat.checked++;
  if (!r.issues.length) return newData;
  mstat.bad++;
  mstat.last.unshift({ t: new Date(now).toISOString(), u: u.name, old: !info.claims, mode: MON_MODE, issues: r.issues.slice(0, 8).map(function (x) { return (x.u != null ? '#' + x.u + ' ' : '') + x.f; }) });
  mstat.last = mstat.last.slice(0, 20);
  log({ t: new Date(now).toISOString(), u: u.name, kind: 'mons', mode: MON_MODE, oldClient: !info.claims, issues: r.issues.slice(0, 40) });
  if (MON_MODE !== 'enforce' || !(info.claims || now >= GRACE_UNTIL)) return newData;
  mstat.fixed++;
  monApply(A, B, r);
  var o2 = {}; for (var k in newData) o2[k] = newData[k]; o2['hs-account-v1'] = JSON.stringify(B);
  info.sync = ['mons', 'teams', 'next'];   // 改过了：把服务器的版本发回浏览器（悄悄换上，免得下次上传又对不上）
  return o2;
}
// 配队数量（2026-10-27）：teamX（用能量买的配队数）只由交易改；配队数不能超过 3 + teamX
function teamStep(oldData, newData, info) {
  var A = accOf(oldData), B = accOf(newData); if (!A || !B || !Array.isArray(B.teams)) return newData;
  var x = A.teamX | 0, cap = Math.max(2, Math.min(10, 3 + x)), ch = false;
  if ((B.teamX | 0) !== x) { if (x) B.teamX = x; else delete B.teamX; ch = true; }
  if (B.teams.length > cap) { B.teams = B.teams.slice(0, cap); ch = true; }
  if (!(B.active >= 0 && B.active < B.teams.length)) { B.active = 0; ch = true; }
  if (!ch) return newData;
  var o2 = {}; for (var k in newData) o2[k] = newData[k]; o2['hs-account-v1'] = JSON.stringify(B);
  info.sync = (info.sync || []).concat(['teams', 'teamX', 'active']);
  return o2;
}
function onUpload(u, list, oldData, newData, info) {
  var now = Date.now(), ok = blank(), bad = blank(), notes = [];
  if (MODE === 'enforce' && (info.claims || now >= GRACE_UNTIL)) newData = keyFix(oldData, newData);
  newData = monStep(u, oldData, newData, info, now);
  try { newData = teamStep(oldData, newData, info); } catch (e) { console.error('配队核对出错', e && e.stack); }
  if (!u.claimed || typeof u.claimed !== 'object') u.claimed = {};
  if (!Array.isArray(u.cids)) u.cids = [];
  var seen = {}; u.cids.forEach(function (x) { seen[x] = 1; });
  (Array.isArray(list) ? list.slice(0, PER_UPLOAD) : []).forEach(function (c) {
    if (c && typeof c.c === 'string' && seen[c.c]) return;   // 重复上传的同一条：已经算过了
    var d = clean(c);
    if (c && typeof c.c === 'string') { seen[c.c] = 1; u.cids.push(c.c); }
    if (!d) { if (c && c.d) addTo(bad, c.d && typeof c.d === 'object' ? sane(c.d) : {}); notes.push('无效申报 ' + (c && c.s)); return; }
    var id = String(c.i == null ? '' : c.i).slice(0, 80);
    var X = expectOf(c.s, id);   // 一次性奖励：按 js/engine/rewards.js 的表核对编号和数额（2026-10-25）
    if (X === false) { addTo(bad, d); notes.push('不认识的编号 ' + c.s + ':' + id); return; }
    if (X) d = clip(d, X, bad);
    if (c.s === 'rankRw' && !rankOk(oldData, id)) { addTo(bad, d); notes.push('段位不够 ' + id); return; }   // 赛季段位奖励：按服务器记的最高段位核对
    if (c.s === 'chalStar' && !starsOk(oldData, +id)) { addTo(bad, d); notes.push('星数不够 ' + id); return; }   // 挑战累计星数奖励：按服务器记的星数核对
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
  if (!A || !B) return { data: newData, fixed: '', sync: info.sync || null };
  var a = wallet(A), b = wallet(B), over = [];
  // 上限 lim = 上一份 + 认可的申报；超过上限时，改成 min(上传值 − 不认可的申报, 上限)：既去掉没申报的部分，也扣回被拒的申报
  function chk(f, av, bv, okv, badv) { var lim = av + okv; if (bv > lim) { var to = Math.max(0, Math.min(bv - badv, lim)); over.push({ f: f, by: bv - to, to: to }); } }
  FIELDS.forEach(function (f) { chk(f, a[f], b[f], ok[f], bad[f]); });
  Object.keys(b.items).forEach(function (k) { chk('items.' + k, a.items[k] || 0, b.items[k], ok.items[k] || 0, bad.items[k] || 0); });
  stat.uploads++; if (!info.claims) stat.oldClient++;
  var enforce = MODE === 'enforce' && (info.claims || now >= GRACE_UNTIL);
  // 先驱之塔的进度（层数、存档点、通关次数、死神代币次数、今天的塔内奖励）只由服务器推进（server/pve.js）：上传的存档改不了
  var twFix = enforce ? ownDiff(A, B) : [];
  if (enforce && storyFix(A, B)) twFix.push('story');   // storyFix 已经把 B.story 改好了（twBack 遇到 story 跳过）
  if (enforce && mailFix(A, B)) twFix.push('mail', 'mailSeen', 'lastActive');   // 同上（mailFix 已经改好）
  if (!over.length && !notes.length && !twFix.length) return { data: newData, fixed: '', sync: info.sync || null };
  if (over.length) { stat.over++; stat.last.unshift({ t: new Date(now).toISOString(), old: !info.claims, over: over.map(function (x) { return x.f + ' +' + x.by; }) }); stat.last = stat.last.slice(0, 15); }
  if (over.length || notes.length) log({ t: new Date(now).toISOString(), u: u.name, mode: enforce ? 'enforce' : 'observe', oldClient: !info.claims, over: over, notes: notes });
  if (twFix.length && !over.length) {   // 只有服务器管的字段对不上：悄悄改回服务器的（正常情况下是本机跨天重置了今天的计数，不弹窗）
    twBack(A, B, twFix);
    var o2 = {}; for (var kk in newData) o2[kk] = newData[kk]; o2['hs-account-v1'] = JSON.stringify(B);
    return { data: o2, fixed: '', sync: (info.sync || []).concat(topKeys(twFix)) };
  }
  if (!enforce || !over.length) return { data: newData, fixed: '', sync: info.sync || null };
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
function status() { return { mode: MODE, graceUntil: new Date(GRACE_UNTIL).toISOString(), since: stat.since, uploads: stat.uploads, oldClient: stat.oldClient, mismatch: stat.over, fixed: stat.fixed, recent: stat.last,
  mons: { mode: MON_MODE, checked: mstat.checked, mismatch: mstat.bad, fixed: mstat.fixed, recent: mstat.last } }; }

module.exports = { init: init, onUpload: onUpload, status: status, SRC: SRC, MODE: MODE };
