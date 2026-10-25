/* ==========================================================
 * 野外的每日产出（2026-10-25）：服务器和浏览器共用
 *
 * 采集点、矿点（含钻头考核 / 修复）、每天刷新的星球特产、赫菲角片的每日领取，用服务器网址玩时都走交易（js/engine/tx.js 的 TX）：
 * 服务器按它记的「今天领过哪些」判断能不能领、领多少，浏览器再用同样的随机数重放一遍。
 * ========================================================== */
var WORLD = (function () {
  'use strict';
  function no(err) { return { ok: false, err: err }; }
  function items(a) { if (!a.items || typeof a.items !== 'object') a.items = {}; return a.items; }
  function done(a, site) { return !!(a.story && a.story[site] && a.story[site].done); }
  function int(v) { return typeof v === 'number' && v === Math.floor(v) ? v : NaN; }
  function seeded(str) {   // 和 game.js 的 seeded 一样
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = (h + 0x6D2B79F5) | 0; var t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function regionOk(a, rid) { var R = PVE.regionById(rid); return R && PVE.regionOpen(a, R) ? R : null; }

  /* ---------- 采集点：每个区域 2 个，每个每天 1 次；丛林、草甸第一次采集另送药草种子 ×4 ---------- */
  var GATHER_N = 2;
  function gatherRec(a, now) {
    var day = TX.dayNum(now);
    if (!a.gather || a.gather.day !== day || !a.gather.got) a.gather = { day: day, got: {} };
    return a.gather;
  }
  TX.add('gather', function (a, args, env) {
    var rid = String(args.rid || ''), i = int(args.i), g = RW.GATHER[rid];
    if (!g || !(i >= 0 && i < GATHER_N) || !regionOk(a, rid)) return no('这里没有采集点');
    var rec = gatherRec(a, env.now), key = rid + ':' + i;
    if (rec.got[key]) return no('这个采集点今天已经采过了，明天再来。');
    rec.got[key] = 1;
    var gain = {}, herb = false; gain[g.item] = g.n;
    if ((rid === 'forest' || rid === 'grass') && !a.herbSeed) { a.herbSeed = 1; gain.s_herb = 4; herb = true; }
    var I = items(a); for (var k in gain) I[k] = (I[k] || 0) + gain[k];
    return { ok: true, k: g.item, n: g.n, herb: herb, gain: gain };
  });

  /* ---------- 矿点：芙罗拉星、坎伯兰星每个野外场景一处（煤炭 / 铁矿交替），每处每天挖 1 次，要等 10 秒 ---------- */
  var MINE = { regions: ['forest', 'grass', 'kb_surf', 'kb_sea', 'kb_deep'], sec: 10, n: [2, 3] };
  function oreKind(si) { return si % 2 ? 'm_fe' : 'm_cu'; }
  TX.add('mine', function (a, args, env) {
    var M0 = TX.mineRec(a, env.now);
    if (args.a === 'start') {
      var rid = String(args.rid || ''), si = int(args.si), R = regionOk(a, rid);
      if (!R || MINE.regions.indexOf(rid) < 0 || !(si >= 0 && si < PVE.sceneCount(R))) return no('这里没有矿点');
      var key = rid + ':' + si;
      if (M0.got[key]) return no('这处矿点今天已经挖过了，明天再来吧。');
      if (!a.drill) return no('需要挖矿钻头才能采矿。');
      if (!(a.drill.dur > 0)) return no('挖矿钻头的耐久度用完了，去荆楚号 · 宜昌的「三峡能源核心」找日透骨消修一下吧。');
      M0.dig = { k: key, si: si, t: env.now };
      return { ok: true, k: oreKind(si) };
    }
    if (args.a === 'end') {
      var D = M0.dig; if (!D) return no('没有在挖矿');
      if (env.now - D.t < MINE.sec * 1000 - 300) return no('还没挖完');
      delete M0.dig;
      if (M0.got[D.k] || !a.drill || !(a.drill.dur > 0)) return no('这处矿点今天已经挖过了');
      var k = oreKind(D.si), n = MINE.n[0] + Math.floor(env.rand() * (MINE.n[1] - MINE.n[0] + 1)), I = items(a);
      M0.got[D.k] = 1; I[k] = (I[k] || 0) + n; a.drill.dur = Math.max(0, a.drill.dur - 1);
      return { ok: true, k: k, n: n, dur: a.drill.dur };
    }
    return no('不支持的操作');
  });

  /* ---------- 钻头考核（10 题对 7 题，其中 2 道难题）/ 修复（5 题对 3 题，1 道难题）：错满 3 道提前结束 ----------
   * start：服务器抽题（题库里的下标），记在 a.xcq；end：按顺序核对答案，通过就给（修满）钻头 */
  var QUIZ = { get: { n: 10, pass: 7, hard: 2 }, fix: { n: 5, pass: 3, hard: 1 }, wrongMax: 3 }, DRILL_MAX = TX.D.DRILL_MAX;
  var XQ = null;
  function bank() {
    if (XQ) return XQ; if (typeof XCQ === 'undefined') return [];
    try { var key = 'sanxia-LZSLFX', bin = atob(XCQ), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i) ^ key.charCodeAt(i % key.length); XQ = JSON.parse(new TextDecoder('utf-8').decode(u)); } catch (e) { XQ = []; }
    return XQ;
  }
  function shuffle(a, rand) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  TX.add('xcq', function (a, args, env) {
    if (!done(a, 'core')) return no('先读完宜昌的支线「三峡能源核心」吧。');
    if (args.a === 'start') {
      var rp = !!args.rp, C = rp ? QUIZ.fix : QUIZ.get, B = bank();
      if (rp ? !a.drill || a.drill.dur >= DRILL_MAX : !!a.drill) return no(rp ? '钻头不需要修' : '你已经有钻头了');
      if (B.length < C.n) return no('题库加载失败，刷新一下再试试。');
      var idx = B.map(function (q, i) { return i; });
      var hard = shuffle(idx.filter(function (i) { return B[i].h; }), env.rand).slice(0, C.hard), easy = shuffle(idx.filter(function (i) { return !B[i].h; }), env.rand).slice(0, C.n - hard.length);
      var qs = shuffle(hard.concat(easy), env.rand);
      a.xcq = { rp: rp, qs: qs, t: env.now };
      return { ok: true, qs: qs, rp: rp, n: C.n, pass: C.pass };
    }
    if (args.a === 'end') {
      var Q = a.xcq; if (!Q || !Array.isArray(Q.qs)) return no('没有在答题');
      var C2 = Q.rp ? QUIZ.fix : QUIZ.get, B2 = bank(), ans = Array.isArray(args.ans) ? args.ans : [], right = 0, wrong = 0;
      for (var i = 0; i < Q.qs.length && wrong < QUIZ.wrongMax; i++) { var q = B2[Q.qs[i]]; if (!q || ans[i] == null) break; if (ans[i] === q.a) right++; else wrong++; }
      delete a.xcq;
      var ok = wrong < QUIZ.wrongMax && right >= C2.pass;
      if (ok) a.drill = { dur: DRILL_MAX };
      return { ok: true, pass: ok, right: right, wrong: wrong, rp: Q.rp };
    }
    return no('不支持的操作');
  });

  /* ---------- 每个星球的野外场景里每天刷新的特产（每个场景每天最多一处，1~3 个；芙罗拉玉要等瘴气驱逐战开放） ---------- */
  function jadeSpot(a, rid, scene, now) {
    var k = RW.GEM_SPOT[rid]; if (!k || (k === 'floraJade' && !done(a, 'flora6'))) return null;
    var g = seeded(TX.bjDay(now) + ':jade:' + rid + ':' + scene + ':' + (a.created || 0));
    return g() < 0.35 ? { x: 15 + Math.floor(g() * 66), y: 68 + Math.floor(g() * 16), n: 1 + Math.floor(g() * 3), k: k } : null;
  }
  function jadeRec(a, now) { var d = TX.bjDay(now); if (!a.jade || a.jade.d !== d) a.jade = { d: d, got: {} }; return a.jade; }
  TX.add('jade', function (a, args, env) {
    var rid = String(args.rid || ''), sc = int(args.scene), R = regionOk(a, rid);
    if (!R || !(sc >= 0 && sc < PVE.sceneCount(R))) return no('这里什么也没有');
    var J = jadeSpot(a, rid, sc, env.now); if (!J) return no('这里什么也没有');
    var rec = jadeRec(a, env.now), key = rid + ':' + sc; if (rec.got[key]) return no('今天已经捡过了');
    rec.got[key] = 1; var I = items(a); I[J.k] = (I[J.k] || 0) + J.n;
    return { ok: true, k: J.k, n: J.n };
  });

  /* ---------- 一碗饭：放在庞贝星熔岩原的一个场景里，之后这个场景有机会刷出米饭火鸡（被吃掉前只能放一碗） ---------- */
  TX.add('bowl', function (a, args, env) {
    var rid = String(args.rid || ''), si = int(args.si), R = regionOk(a, rid), RC = PVE.RICE;
    if (!R || RC.regions.indexOf(rid) < 0 || !(si >= 0 && si < PVE.sceneCount(R))) return no('这里放不了');
    if (a.riceBowl) return no('已经放了一碗饭了');
    var I = items(a); if (!(I.c_bowl > 0)) return no('没有一碗饭了');
    I.c_bowl--; a.riceBowl = { rid: rid, si: si, t: env.now };
    return { ok: true };
  });

  /* ---------- 赫菲角片：每天领 12~15 片 ---------- */
  TX.add('hornDay', function (a, args, env) {
    var d = TX.dayNum(env.now); if (a.hornDay === d) return no('今天的赫菲角片已经领过了');
    var H = PVE.HORN, n = H.day[0] + Math.floor(env.rand() * (H.day[1] - H.day[0] + 1)), I = items(a);
    a.hornDay = d; I.m_hfhorn = (I.m_hfhorn || 0) + n;
    return { ok: true, n: n };
  });

  return { GATHER_N: GATHER_N, gatherRec: gatherRec, MINE: MINE, oreKind: oreKind, QUIZ: QUIZ, bank: bank, jadeSpot: jadeSpot, jadeRec: jadeRec, seeded: seeded };
})();
if (typeof module !== 'undefined') module.exports = WORLD;
