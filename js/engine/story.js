/* ==========================================================
 * 剧情进度（2026-10-25）：服务器和浏览器共用
 *
 * 读剧情（对话、选项、读到第几句）还在浏览器里播，但「读完了」「拿到剧情里给的东西」「选初始精灵」都走交易 story：
 * 服务器按它的存档核对这段剧情开没开放（前一段读完没有、额外条件）、剧情对战打过没有，再记进度、发奖励和章节大奖。
 * a.story[段] 里只有 at（读到第几句）、ch（选了哪个选项）由浏览器记，其余由服务器改（server/claims.js）。
 * ========================================================== */
var STY = (function () {
  'use strict';
  function no(err) { return { ok: false, err: err }; }
  function done(a, site) { return !!(a.story && a.story[site] && a.story[site].done); }
  function items(a) { if (!a.items || typeof a.items !== 'object') a.items = {}; return a.items; }
  function prog(a, site) { if (!a.story || typeof a.story !== 'object') a.story = {}; if (!a.story[site] || typeof a.story[site] !== 'object') a.story[site] = { at: 0, done: false, ch: null }; return a.story[site]; }
  function give(a, R) {
    if (!R) return;
    a.exp = (a.exp || 0) + (R.exp || 0); a.energy = (a.energy || 0) + (R.energy || 0);
    var I = items(a); for (var k in R.items || {}) I[k] = (I[k] || 0) + R.items[k];
  }
  var STARTERS = ['leaf', 'squid', 'shroom'], START_LV = 5;
  function rivalOf(sid) {
    var t = SPMAP[sid].types[0];
    return STARTERS.filter(function (x) { return x !== sid && eff(SPMAP[x].types[0], t) > 1; })[0] || STARTERS.filter(function (x) { return x !== sid; })[0];
  }
  function rareList(a) { var R = []; for (var k in WILD_POOLS) WILD_POOLS[k].forEach(function (w) { if (w.rare && w.sid !== a.starter && R.indexOf(w.sid) < 0) R.push(w.sid); }); return R; }
  function species(a) { var o = {}; (a.mons || []).forEach(function (m) { if (m) o[m.sid] = 1; }); return Object.keys(o).length; }

  /* ---------- 每段剧情的开放条件（和 game.js 的 SITES 一致：after 是前一段，need 是额外条件） ---------- */
  var SITES = {
    school: {}, river: { after: 'school' }, jiuquan: { after: 'river' }, board: { after: 'jiuquan' },
    academy: { after: 'board' }, flora1: { after: 'board' }, flora2: { after: 'flora1' },
    flora3: { after: 'flora2', need: function (a) { return ((a.story && a.story.flora2 && a.story.flora2.spare) || 0) >= PVE.SPARE_N; } },
    flora4: { after: 'flora3', need: function (a) { return done(a, 'travelcat'); } },
    flora5: { after: 'flora4' }, flora6: { after: 'flora5' },
    flora7: { after: 'flora6', need: function (a, env) { var t = env.fetch ? env.fetch('pwTotal') : null; return t != null && t >= 500; } },   // 全服瘴气驱逐战击破 500 只（服务器上的数）
    mmTrial: { after: 'flora7' }, tea: { after: 'flora1' },
    mingming: { after: 'board', need: function (a) { return QST.litCount(a) >= 10; } },
    tiger: { after: 'board' }, tiger2: { after: 'tiger', need: function (a) { return PVE.bossWon(a, 'tiger', 0); } },
    fl_chal: { after: 'flora1' }, fl_chal2: { after: 'fl_chal', need: function (a) { return PVE.chalStars(a, 'fl1') > 0; } },
    medal: { after: 'mingming' }, rare: { after: 'flora1' },
    hiddenSk: { after: 'board', need: function (a) { return (a.mons || []).some(function (m) { return m && m.lv >= 40; }); } },
    rare_r: { after: 'rare', need: function (a) { var R = rareList(a); return (a.mons || []).some(function (m) { return m && R.indexOf(m.sid) >= 0; }); } },
    storage: { after: 'board' }, brawl: { after: 'xiaogan', need: function (a) { return (a.mons || []).length >= 3; } },
    draft: { after: 'xiaogan', need: function (a) { return species(a) >= 10; } },
    core: { after: 'board' }, spa: { after: 'flora1' }, plant: { after: 'flora1' }, travelcat: { after: 'flora2' }, xiaogan: { after: 'board' }
  };
  function unlocked(a, site, env) { var S = SITES[site]; return !!S && (!S.after || done(a, S.after)) && (!S.need || S.need(a, env)); }
  // 剧本里有剧情对战的段：读完之前要先打过（胜负都算，服务器打完时记 bt）
  var FIGHT_OF = {};
  if (typeof STORY_SCRIPT !== 'undefined') Object.keys(STORY_SCRIPT).forEach(function (site) { (STORY_SCRIPT[site] || []).forEach(function (st) { if (st && st.battle) (FIGHT_OF[site] || (FIGHT_OF[site] = [])).push(st.battle); }); });
  // 一定会打到的对战（不在选项分支、不看上一场胜负的）
  function mustFight(site, pr) { return (STORY_SCRIPT[site] || []).some(function (st) { return st && st.battle && !st.res && (!st.only || st.only === pr.ch); }); }
  var SITE_OF = {}; Object.keys(FIGHT_OF).forEach(function (s) { FIGHT_OF[s].forEach(function (k) { if (!SITE_OF[k]) SITE_OF[k] = s; }); });

  var CHAPTERS = [{ id: 'prologue', sites: ['school', 'river', 'jiuquan', 'board'] }, { id: 'ch1', sites: ['flora1', 'flora2', 'flora3', 'flora4', 'flora5', 'flora6', 'flora7'] }];
  function chapterPay(a, now) {   // 读完一整章、还没领过章节大奖的：发
    var out = [];
    CHAPTERS.forEach(function (C) {
      if (a.chapters && a.chapters[C.id]) return;
      if (!C.sites.every(function (s) { return done(a, s); })) return;
      if (!a.chapters) a.chapters = {}; a.chapters[C.id] = now;
      give(a, RW.CHAPTER[C.id]); out.push(C.id);
    });
    return out;
  }
  function grant(a, site) {   // 第一次读完的奖励（只发一次）
    var R = RW.STORY[site], pr = prog(a, site); if (!R || pr.rewarded) return null;
    give(a, R);
    if (R.title) { if (!Array.isArray(a.titles)) a.titles = []; if (a.titles.indexOf(R.title) < 0) a.titles.push(R.title); }
    pr.rewarded = true; pr.itemsGiven = true; pr.got = { exp: R.exp || 0, energy: R.energy || 0 };
    return R;
  }
  // 旧存档的补发（以前在浏览器里做）：主线奖励调整后的差额、物资仓储新增的道具、读完了却没发过的奖励、第八段拆分、章节大奖
  var OLD_MAIN = { school: { exp: 1000, energy: 500 }, river: { exp: 0, energy: 0 }, jiuquan: { exp: 0, energy: 0 }, board: { exp: 1000, energy: 300 } };
  function legacy(a, now) {
    var out = { exp: 0, energy: 0, items: {}, sites: [], chapters: [] };
    if (!a.split8) { a.split8 = 1; if (done(a, 'flora4')) ['flora5', 'flora6'].forEach(function (id) { var q = prog(a, id); if (!q.done) { q.done = true; q.rewarded = true; q.at = 0; } }); }
    ['school', 'river', 'jiuquan', 'board'].forEach(function (id) {
      var pr = a.story && a.story[id], R = RW.STORY[id]; if (!pr || !pr.done || !R || !pr.rewarded) return;
      var had = pr.got || OLD_MAIN[id];
      var de = Math.max(0, (R.exp || 0) - (had.exp || 0)), dn = Math.max(0, (R.energy || 0) - (had.energy || 0));
      if (!pr.got || de || dn) { a.exp = (a.exp || 0) + de; a.energy = (a.energy || 0) + dn; out.exp += de; out.energy += dn; pr.got = { exp: R.exp || 0, energy: R.energy || 0 }; }
    });
    if (done(a, 'jiuquan')) { var pj = prog(a, 'jiuquan'); if (!pj.gave) pj.gave = {}; if (!pj.gave.bribe) { pj.gave.bribe = 1; a.energy = (a.energy || 0) + 1000; out.energy += 1000; } }
    var ps = a.story && a.story.storage;
    if (ps && ps.rewarded && !ps.itemsGiven) { ps.itemsGiven = true; var it = RW.STORY.storage.items, I = items(a); for (var k in it) { I[k] = (I[k] || 0) + it[k]; out.items[k] = (out.items[k] || 0) + it[k]; } }
    Object.keys(SITES).forEach(function (id) { if (done(a, id) && RW.STORY[id] && !prog(a, id).rewarded) { var R = grant(a, id); if (R) { out.sites.push(id); out.exp += R.exp || 0; out.energy += R.energy || 0; for (var k2 in R.items || {}) out.items[k2] = (out.items[k2] || 0) + R.items[k2]; } } });
    out.chapters = chapterPay(a, now);
    out.chapters.forEach(function (id) { var R = RW.CHAPTER[id]; out.exp += R.exp || 0; out.energy += R.energy || 0; });
    return out;
  }

  TX.add('story', function (a, args, env) {
    var site = String(args.site || '');
    if (args.a === 'done') {
      if (!SITES[site] || typeof STORY_SCRIPT === 'undefined' || !STORY_SCRIPT[site]) return no('没有这段剧情');
      var pr = prog(a, site);
      if (pr.done) return { ok: true, again: true };
      if (!unlocked(a, site, env)) return no('这段剧情还没有开放');
      if (FIGHT_OF[site] && !pr.bt && mustFight(site, pr)) return no('这段剧情里的对战还没有打');
      if (site === 'school' && !a.starter) return no('还没有选初始精灵');
      pr.done = true; pr.at = 0;
      var R = grant(a, site), ch = chapterPay(a, env.now);
      return { ok: true, first: true, reward: R, chapters: ch };
    }
    if (args.a === 'give') {   // 剧本里写的 give（每个存档只给一次）
      var g = RW.SGIVE[site + ':' + String(args.id || '')];
      if (!g) return no('没有这份东西');
      if (!unlocked(a, site, env) && !done(a, site)) return no('这段剧情还没有开放');
      var p2 = prog(a, site); if (!p2.gave) p2.gave = {};
      if (p2.gave[g.id]) return { ok: true, again: true };
      p2.gave[g.id] = 1; give(a, g);
      return { ok: true, g: g };
    }
    if (args.a === 'pick') {   // 第一段里选初始精灵
      var sid = String(args.sid || '');
      if (STARTERS.indexOf(sid) < 0) return no('没有这只精灵');
      if (a.starter || (a.mons || []).length) return no('已经选过初始精灵了');
      if (!Array.isArray(a.mons)) a.mons = [];
      if (!(a.next >= 1)) a.next = 1;
      a.starter = sid; a.rival = rivalOf(sid);
      var m = ACC.newMon(a, sid, START_LV, env);
      if (!Array.isArray(a.teams)) a.teams = [[], []];
      a.teams[0] = [m.u]; a.active = 0;
      if (!a.items || typeof a.items !== 'object') a.items = {};
      a.items.cap1 = (a.items.cap1 || 0) + 10;   // 2026-10-27：新玩家自带 10 个普通精灵捕捉装置
      return { ok: true, u: m.u };
    }
    if (args.a === 'fix') return { ok: true, fix: legacy(a, env.now) };
    return no('不支持的操作');
  });

  return { SITES: SITES, unlocked: unlocked, FIGHT_OF: FIGHT_OF, SITE_OF: SITE_OF, CHAPTERS: CHAPTERS, STARTERS: STARTERS, START_LV: START_LV, rivalOf: rivalOf, grant: grant, chapterPay: chapterPay, legacy: legacy };
})();
if (typeof module !== 'undefined') module.exports = STY;
