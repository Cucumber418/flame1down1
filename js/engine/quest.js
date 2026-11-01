/* ==========================================================
 * 每日任务和世界任务（2026-10-25）：服务器和浏览器共用
 *
 * 每日任务的进度由服务器在结算对战、交易时加（server/pve.js 打完一场、grow.js 的茶室收回 / 大乱斗奖励），
 * 领奖走交易 daily；世界任务按服务器上的存档判断有没有完成，领奖走交易 quest。
 * 本地双击打开（没有服务器）时，同样的规则在本机跑。
 * ========================================================== */
var QST = (function () {
  'use strict';
  function no(err) { return { ok: false, err: err }; }
  function done(a, site) { return !!(a.story && a.story[site] && a.story[site].done); }
  function items(a) { if (!a.items || typeof a.items !== 'object') a.items = {}; return a.items; }
  function bossOpen(a, k, now) { var B = PVE.BOSSES[k]; return !!(B && B.lv[0].open(a, now)); }

  /* ---------- 每日任务：每天 0:00（北京时间）刷新，一共 7 个：3 个竞技对战任务，开放了精灵大乱斗的话大概率有 1 个大乱斗任务，其余从探索类里抽 ---------- */
  var DAILY_N = 7, DAILY_BRAWL = 0.7;
  var DAILY = {
    ar_play3: { t: '完成 3 场竞技对战（沙盒或平衡排位都算）', kind: 'arena', n: 3, arena: 1 },
    ar_rank2: { t: '完成 2 场平衡排位', kind: 'rankPlay', n: 2, arena: 1 },
    ar_win1: { t: '在平衡排位中获胜 1 场', kind: 'rankWin', n: 1, arena: 1 },
    ar_sand1: { t: '在沙盒模式完成 1 场对战', kind: 'sandbox', n: 1, arena: 1 },
    bw_1: { t: '完成 1 场精灵大乱斗', kind: 'brawl', n: 1, brawl: 1 },
    bw_win1: { t: '在精灵大乱斗中获胜 1 场', kind: 'brawlWin', n: 1, brawl: 1 },
    wd_win5: { t: '击败 5 只野生精灵', kind: 'wildWin', n: 5, need: function (a) { return done(a, 'flora1'); } },
    wd_catch1: { t: '捕捉 1 只野生精灵', kind: 'catch', n: 1, need: function (a) { return done(a, 'flora1'); } },
    bs_1: { t: '挑战 1 次BOSS（胜负都算）', kind: 'boss', n: 1, need: function (a, now) { return bossOpen(a, 'tiger', now) || bossOpen(a, 'barren', now); } },
    hm_1: { t: '从茶室收回 1 只展示满 1 小时的精灵', kind: 'home', n: 1, need: function (a) { return done(a, 'tea'); } },
    pve_2: { t: '完成 2 场剧情、野外或BOSS对战', kind: 'pve', n: 2 }
  };
  Object.keys(DAILY).forEach(function (k) { DAILY[k].rw = RW.DAILY[k]; });
  function seededRng(str) { var x = 7; for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 2147483647; return function () { x = (x * 48271) % 2147483647; return x / 2147483647; }; }
  function pickN(list, n, rnd) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }
  function dailyPick(a, k, keep, now) {
    var rnd = seededRng(k + a.name), ids = Object.keys(DAILY), pick = keep.slice();
    var add = function (list, n) { pickN(list.filter(function (id) { return pick.indexOf(id) < 0; }), n, rnd).forEach(function (id) { pick.push(id); }); };
    var ok = function (id) { return !DAILY[id].need || DAILY[id].need(a, now); };
    var ar = ids.filter(function (id) { return DAILY[id].arena; });
    var bw = done(a, 'brawl') ? ids.filter(function (id) { return DAILY[id].brawl; }) : [];
    var other = ids.filter(function (id) { return !DAILY[id].arena && !DAILY[id].brawl && ok(id); });
    var arN = pick.filter(function (id) { return DAILY[id] && DAILY[id].arena; }).length;
    add(ar, Math.max(0, 3 - arN));
    if (bw.length && !pick.some(function (id) { return DAILY[id] && DAILY[id].brawl; }) && rnd() < DAILY_BRAWL) add(bw, 1);
    add(other, DAILY_N - pick.length);
    add(ar, DAILY_N - pick.length);   // 探索类不够时，用剩下的竞技任务补
    add(bw, DAILY_N - pick.length);
    return pick.slice(0, DAILY_N);
  }
  // 今天的每日任务（没有就按日期和名字抽一套；旧版只有 5 个的，补到 7 个，进度保留）。返回 a.daily
  function daily(a, now) {
    var k = PVE.bjDay(now);
    if (!a.daily || a.daily.date !== k || !Array.isArray(a.daily.list)) a.daily = { date: k, list: dailyPick(a, k, [], now).map(function (id) { return { id: id, p: 0, c: 0, x2: 1, x10: 1 }; }) };
    if (a.daily.list.length < DAILY_N) {
      var have = a.daily.list.map(function (t) { return t.id; });
      dailyPick(a, k, have, now).filter(function (id) { return have.indexOf(id) < 0; }).slice(0, DAILY_N - have.length).forEach(function (id) { a.daily.list.push({ id: id, p: 0, c: 0, x2: 1 }); });
    }
    return a.daily;
  }
  // 加进度：返回这次刚完成的任务的名字
  function hit(a, kind, n, now) {
    var D = daily(a, now), out = [];
    D.list.forEach(function (t) { var d = DAILY[t.id]; if (d && d.kind === kind && t.p < d.n) { t.p = Math.min(d.n, t.p + (n || 1)); if (t.p >= d.n) out.push(d.t); } });
    return out;
  }
  // 单人对战打完（server/pve.js）：按模式加进度
  function pveHits(a, kind, rep, now) {
    var out = [], h = function (k, n) { out = out.concat(hit(a, k, n, now)); };
    rep = rep || {};
    if (kind === 'story') { if (rep.own) h('pve'); }
    else if (kind === 'wild') { if (rep.downs) h('wildWin', rep.downs); if (rep.caught) h('catch'); h('pve'); }
    else if (kind === 'boss' || kind === 'weekly' || kind === 'ewk') { h('boss'); h('pve'); }
    else if (kind === 'cumber' || kind === 'chal' || kind === 'tower' || kind === 'mm') h('pve');
    else if (kind === 'rank') { h('arena'); h('rankPlay'); if (rep.res === 'win') h('rankWin'); }
    else if (kind === 'sandbox') { h('arena'); h('sandbox'); }
    return out;
  }
  TX.add('daily', function (a, args, env) {
    var D = daily(a, env.now), i = args.i, t = typeof i === 'number' ? D.list[i] : null;
    if (!t || !DAILY[t.id]) return no('没有这个任务');
    if (t.c) return no('这个任务的奖励已经领过了');
    if (t.p < DAILY[t.id].n) return no('这个任务还没完成');
    var R = DAILY[t.id].rw; t.c = 1;
    a.exp = (a.exp || 0) + (R.exp || 0); a.energy = (a.energy || 0) + (R.energy || 0);
    return { ok: true, id: t.id, exp: R.exp || 0, energy: R.energy || 0 };
  });

  /* ---------- 世界任务 ---------- */
  var WQ = [
    { id: 'w_first', steps: [{ k: 'wins', n: 1 }], after: 'flora1' },
    { id: 'w_karo', steps: [{ k: 'own:wind', n: 1 }], after: 'flora1' },
    { id: 'w_mush', steps: [{ k: 'own:mush', n: 1 }], after: 'flora1' },
    { id: 'w_hunt', steps: [{ k: 'wins', n: 10 }], after: 'flora1' },
    { id: 'w_kaleo', steps: [{ k: 'own:kaleo', n: 1 }], after: 'flora1' },
    { id: 'w_travel', steps: [{ k: 'story:travelcat', n: 1 }], after: 'flora2' },
    { id: 'w_yado', steps: [{ k: 'story:iceYado', n: 1 }], after: 'flora7' },
    { id: 'w_barren', steps: [{ k: 'story:barrenMys', n: 1 }], after: 'kb8' },
    { id: 'w_dex', steps: [{ k: 'lit', n: 3 }], after: 'academy' }
  ];
  function wq(id) { for (var i = 0; i < WQ.length; i++) if (WQ[i].id === id) return WQ[i]; return null; }
  function litCount(a) { var have = {}; (a.mons || []).forEach(function (m) { if (m && SPMAP[m.sid]) have[m.sid] = 1; }); return SP.concat(EXTRA_SP).filter(function (s) { return have[s.id]; }).length; }
  function qStat(a, k) {
    if (k === 'wins') return (a.stats && a.stats.wildWins) || 0;
    if (k === 'lit') return litCount(a);
    if (k.indexOf('story:') === 0) return done(a, k.slice(6)) ? 1 : 0;
    if (k.indexOf('own:') === 0) { var sid = k.slice(4); return (a.mons || []).filter(function (m) { return m && m.sid === sid; }).length; }
    return 0;
  }
  function qReady(a, id) { var W = wq(id); return !!W && (!W.after || done(a, W.after)) && W.steps.every(function (x) { return qStat(a, x.k) >= x.n; }); }
  TX.add('quest', function (a, args, env) {
    var id = String(args.id || ''), W = wq(id), R = RW.QUEST[id];
    if (!W || !R) return no('没有这个任务');
    if (a.quests && a.quests[id]) return no('这个任务的奖励已经领过了');
    if (!qReady(a, id)) return no('这个任务还没完成');
    if (!a.quests) a.quests = {};
    a.quests[id] = env.now;
    a.exp = (a.exp || 0) + (R.exp || 0); a.energy = (a.energy || 0) + (R.energy || 0);
    var I = items(a); for (var k in R.items || {}) I[k] = (I[k] || 0) + R.items[k];
    return { ok: true, id: id, rw: R };
  });

  return { DAILY: DAILY, DAILY_N: DAILY_N, daily: daily, dailyPick: dailyPick, hit: hit, pveHits: pveHits, seededRng: seededRng, WQ: WQ, qStat: qStat, qReady: qReady, litCount: litCount };
})();
if (typeof module !== 'undefined') module.exports = QST;
