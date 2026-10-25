/* ==========================================================
 * 称号、军衔、挑战星数奖励、排位段位奖励、邮箱（2026-10-25）：服务器和浏览器共用
 *
 * 这些以前都是浏览器自己判断、自己加的，现在都走交易（js/engine/tx.js 的 TX），由服务器按它的存档判断：
 *   title     检查有没有新称号，有就记上、发称号奖励
 *   promote   军衔晋升（migrate：旧军衔换算）
 *   chalStar  挑战路线累计星数奖励
 *   rankRw    排位赛季首次达到某段位的奖励
 *   mail      邮箱：sync 投递（全服邮件、登录奖励、离线经验、瘴气驱逐战里程碑、争霸赛名次、旧存档补发），get / all 领附件
 *   fix       旧存档的道具换算（采集物合并）
 * 只有服务器知道的事（全服击破数、争霸赛名次）用 env.fetch 去问（server/purgewar.js、server/contest.js 登记）。
 * ========================================================== */
var AWD = (function () {
  'use strict';
  function no(err) { return { ok: false, err: err }; }
  function done(a, site) { return !!(a.story && a.story[site] && a.story[site].done); }
  function items(a) { if (!a.items || typeof a.items !== 'object') a.items = {}; return a.items; }
  function fmt(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function itemName(k) { return (GROW.USE_ITEMS[k] && GROW.USE_ITEMS[k].name) || (typeof ITEMS !== 'undefined' && ITEMS[k] && ITEMS[k].name) || (typeof MATS !== 'undefined' && MATS[k] && MATS[k].name) || k; }
  function give(a, R) {
    if (!R) return;
    ['exp', 'energy', 'tokens', 'merit', 'meritXp'].forEach(function (f) { if (R[f] > 0) a[f] = (a[f] || 0) + R[f]; });
    if (R.twTok > 0) { if (!a.tower) a.tower = { f: 1, cp: 1, best: 0, clears: 0, death: 0, tok: 0 }; a.tower.tok = (a.tower.tok || 0) + R.twTok; }
    var I = items(a); for (var k in R.items || {}) if (R.items[k] > 0) I[k] = (I[k] || 0) + R.items[k];
  }
  function rankBest(data) { try { var R = JSON.parse((data && data['hs-rank-v1']) || 'null'); return R ? Math.max(R.best || 0, R.r || 0) : 0; } catch (e) { return 0; } }
  function lvCount(a, lv) { return (a.mons || []).filter(function (m) { return m && m.lv >= lv; }).length; }
  function rareKinds(a) { var R = []; for (var k in WILD_POOLS) WILD_POOLS[k].forEach(function (w) { if (w.rare && w.sid !== a.starter && R.indexOf(w.sid) < 0) R.push(w.sid); }); var o = {}; (a.mons || []).forEach(function (m) { if (m && R.indexOf(m.sid) >= 0) o[m.sid] = 1; }); return Object.keys(o).length; }
  function typeKinds(a, t, lv) { var o = {}; (a.mons || []).forEach(function (m) { var s = m && SPMAP[m.sid]; if (s && s.types.indexOf(t) >= 0 && m.lv >= lv) o[m.sid] = 1; }); return Object.keys(o).length; }
  function spaMin(a) { return Math.floor(((a.spa && a.spa.ms) || 0) / 60000); }

  /* ---------- 称号（和 game.js 的 TITLES 一一对应；显示用的名字、说明在 game.js） ---------- */
  var TITLES = [
    { id: 'trainee', ok: function (a) { return QST.litCount(a) >= 3; } },
    { id: 'senior', ok: function (a) { return QST.litCount(a) >= 10; } },
    { id: 'elite', ok: function (a) { return QST.litCount(a) >= 30; } },
    { id: 'master', ok: function (a) { return QST.litCount(a) >= 50; } },
    { id: 'scholar', ok: function (a) { return QST.litCount(a) >= 100; } },
    { id: 'collector', ok: function (a) { return done(a, 'rare_r'); } },
    { id: 'rare5', ok: function (a) { return rareKinds(a) >= 5; } },
    { id: 'rare15', ok: function (a) { return rareKinds(a) >= 15; } },
    { id: 'purifier', ok: function (a) { return !!(a.purge && a.purge.n >= 30); } },
    { id: 'force', ok: function (a) { return PVE.bossWon(a, 'tiger', 2); } },
    { id: 'guardian', ok: function (a) { return PVE.bossWon(a, 'barren', 2); } },
    { id: 'reaper', ok: function (a) { return !!(a.tower && a.tower.clears > 0); } },
    { id: 'xcking', ok: function (a) { return !!a.drill; } },
    { id: 'spa120', ok: function (a) { return spaMin(a) >= 120; } },
    { id: 'spa600', ok: function (a) { return spaMin(a) >= 600; } },
    { id: 'spa3000', ok: function (a) { return spaMin(a) >= 3000; } },
    { id: 's1king', ok: function (a) { var k = a.ctPlace && a.ctPlace.quiz1; return k === 0; } },
    { id: 's1prince', ok: function (a) { var k = a.ctPlace && a.ctPlace.quiz1; return k === 1; } },
    { id: 's1zone', ok: function (a) { var k = a.ctPlace && a.ctPlace.quiz1; return k != null; } }
  ];
  [25, 50, 75, 100].forEach(function (L) { TITLES.push({ id: 'one' + L, ok: function (a) { return lvCount(a, L) >= 1; } }); });
  [25, 50, 75, 100].forEach(function (L) { TITLES.push({ id: 'all' + L, ok: function (a) { return lvCount(a, L) >= 5; } }); });
  for (var sr = 1; sr < RANKS.length; sr++) (function (r) { TITLES.push({ id: 'S1-' + r, season: true, ok: function (a, env) { return rankBest(env.data) >= r; } }); })(sr);
  var TYPE_TIERS = [{ k: 'c', lv: 0, steps: [3, 6, 10, 15] }, { k: 't', lv: 50, steps: [1, 3, 5, 10] }, { k: 'x', lv: 80, steps: [5] }];
  Object.keys(TYPE_COLOR).filter(function (t) { return t !== '无'; }).forEach(function (t) {
    TYPE_TIERS.forEach(function (G) { G.steps.forEach(function (n) { TITLES.push({ id: 'ty' + G.k + n + '-' + t, grp: 'type', tier: G.k, need: n, ok: function (a) { return typeKinds(a, t, G.lv) >= n; } }); }); });
  });
  // 有哪些新称号、哪些称号还没发奖励（dry = true 只算不改）
  function titleCheck(a, env, dry) {
    var have = Array.isArray(a.titles) ? a.titles.slice() : [], rw = Array.isArray(a.titleRw) ? a.titleRw.slice() : [], got = [], paid = [], sum = { exp: 0, energy: 0, merit: 0 };
    TITLES.forEach(function (T) { if (have.indexOf(T.id) < 0 && T.ok(a, env)) { have.push(T.id); got.push(T.id); } });
    TITLES.forEach(function (T) { if (have.indexOf(T.id) < 0 || rw.indexOf(T.id) >= 0) return; rw.push(T.id); paid.push(T.id); var r = RW.titleRw(T); sum.exp += r.exp; sum.energy += r.energy; sum.merit += r.merit; });
    if (!dry) { a.titles = have; a.titleRw = rw; give(a, { exp: sum.exp, energy: sum.energy, merit: sum.merit, meritXp: sum.merit }); }
    return { got: got, paid: paid, sum: sum, back: !Array.isArray(a.titleRw) && !dry };
  }
  TX.add('title', function (a, args, env) { return Object.assign({ ok: true }, titleCheck(a, env, false)); });

  /* ---------- 军衔：功勋经验攒够当前军衔的晋升所需，在授勋馆晋升（消耗功勋经验） ---------- */
  var MIL_TIERS = [['下等兵', '二等兵', '一等兵', '上等兵'], '下士', '中士', '上士', '少尉', '中尉', '上尉', '少校', '中校', '上校', '大校', ['将军']];
  var RANKS_MIL = [], MIL_COST = [];
  MIL_TIERS.forEach(function (t) { (Array.isArray(t) ? t : [t + '1', t + '2', t + '3']).forEach(function (n) { RANKS_MIL.push(n); }); });
  for (var mi = 0; mi < RANKS_MIL.length - 1; mi++) MIL_COST.push(Math.round(80 * Math.pow(1.1, mi)));
  var MIL_COST_V1 = [20, 40, 60, 100, 150, 200, 300, 400, 500, 700, 900, 1200], MIL_V2_IDX = [0, 3, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
  function milMigrate(a) {   // 旧军衔：把一路晋升花掉的功勋经验加上手里剩的，按新的阶级重新晋升
    var old = a.milRank | 0;
    if (a.milV === 2) { var o2 = 0; MIL_V2_IDX.forEach(function (x, i) { if (x <= old) o2 = i; }); old = o2; }
    old = Math.max(0, Math.min(12, old));
    var pool = (a.meritXp || 0); for (var i = 0; i < old; i++) pool += MIL_COST_V1[i];
    var r = 0; while (r < RANKS_MIL.length - 1 && pool >= MIL_COST[r]) { pool -= MIL_COST[r]; r++; }
    a.meritXp = pool; a.milRank = r; a.milV = 3;
  }
  TX.add('promote', function (a, args) {
    if (a.milV !== 3) milMigrate(a);
    if (args.a === 'migrate') return { ok: true, r: a.milRank };
    var r = Math.max(0, Math.min(RANKS_MIL.length - 1, a.milRank | 0)), c = MIL_COST[r];
    if (r >= RANKS_MIL.length - 1) return no('已经是最高军衔了');
    if (!((a.meritXp || 0) >= c)) return no('功勋经验不够');
    a.meritXp -= c; a.milRank = r + 1;
    return { ok: true, r: a.milRank };
  });

  /* ---------- 挑战路线累计星数奖励（a.chalGot[星数] = 领取时间；茶室音乐看 chalGot 解锁） ---------- */
  var CHAL_STAR = [
    { n: 30, rw: { bgm: 'floraGrass', exp: 30000, energy: 3000 } },
    { n: 60, rw: { bgm: 'floraForest', exp: 60000, energy: 5000 } },
    { n: 90, rw: { bgm: 'floraFallen', exp: 90000, energy: 8000 } },
    { n: 120, rw: { exp: 120000, energy: 10000, items: { floraJade: 100, g_core: 4 } } },
    { n: 150, rw: { exp: 150000, energy: 15000, items: { floraJade: 200, g_core: 8 } } }
  ];
  TX.add('chalStar', function (a, args, env) {
    var n = args.n, x = CHAL_STAR.filter(function (y) { return y.n === n; })[0];
    if (!x) return no('没有这档奖励');
    if (a.chalGot && a.chalGot[n]) return no('已经领过了');
    if (PVE.chalTotal(a, 'flora') < n) return no('星数还不够');
    if (!a.chalGot) a.chalGot = {}; a.chalGot[n] = env.now;
    give(a, x.rw);
    return { ok: true, n: n, rw: x.rw };
  });

  /* ---------- 排位赛季（S1）首次达到每个段位的奖励（a.rankRw = { season, got: { 段位: 时间 } }；送的精灵一起发） ---------- */
  var SEASON = RW.SEASON;
  function rankRec(a) { if (!a.rankRw || a.rankRw.season !== SEASON) a.rankRw = { season: SEASON, got: {}, x2: true, items: true, kingGift: true };   /* 新的记录按现在的标准发，不需要补 */ if (!a.rankRw.got) a.rankRw.got = {}; return a.rankRw; }
  function rankRwOf(r) { var R = RW.RANK_RW_OLD[r]; return R && { exp: R.exp * 2, energy: R.energy * 2, items: RW.RANK_ITEMS[r] }; }
  function rankPending(a, data) { var best = rankBest(data), got = (a.rankRw && a.rankRw.season === SEASON && a.rankRw.got) || {}, out = []; for (var r = 1; r <= best && r < RW.RANK_RW_OLD.length; r++) if (!got[r]) out.push(r); return out; }
  TX.add('rankRw', function (a, args, env) {
    var list = rankPending(a, env.data), rec = rankRec(a), out = [];
    list.forEach(function (r) {
      var R = rankRwOf(r); rec.got[r] = env.now; give(a, R);
      var g = GROW.RANK_GIFT[r] ? TX.run(a, 'gift', { k: 'rank', id: SEASON + ':' + r }, env) : null;
      out.push({ r: r, rw: R, gift: g && g.ok ? (g.mons || []) : [] });
    });
    return { ok: true, list: out };
  });

  /* ---------- 旧存档的道具换算 ---------- */
  TX.add('fix', function (a, args) {
    if (args.k === 'mats') {   // 旧的六种采集物、三种种子并进星砂、星核和药草
      if (a.matsV === 1) return { ok: true, none: true };
      var I = items(a), sand = 0, core = 0;
      ['g_fungus', 'g_fiber', 'g_shell', 'g_rock'].forEach(function (k) { sand += I[k] || 0; delete I[k]; });
      ['g_spark', 'g_ice'].forEach(function (k) { core += I[k] || 0; delete I[k]; });
      if (sand) I.g_sand = (I.g_sand || 0) + sand; if (core) I.g_core = (I.g_core || 0) + core;
      ['s_moss', 's_bean', 'c_moss', 'c_bean'].forEach(function (k) { delete I[k]; });
      a.matsV = 1;
      return { ok: true, sand: sand, core: core };
    }
    return no('不支持的操作');
  });

  /* ---------- 邮箱：a.mail（新的在前），a.mailSeen（投递过的编号，删掉了也不会重发） ---------- */
  var MAIL_MAX = 100, OFFLINE_GAP = 20 * 60000, OFFLINE_RATE = 6, OFFLINE_MAX_MIN = 3 * 24 * 60, LOGIN_EXP = 3000;
  var CONTEST = { id: 'quiz1', name: '第一届做题大王争霸赛' }, CT_RW = [{ exp: 300000, t: 1 }, { exp: 200000, t: 1 }, { exp: 150000, t: 1 }, { exp: 120000, t: 1 }], CT_RW0 = { exp: 80000, t: 1 };
  function hasAtt(x) { return !!(x && (x.exp || x.energy || x.merit || x.tokens || x.twTok || (x.items && Object.keys(x.items).length) || (x.mons && x.mons.length))); }
  function durText(min) { var h = Math.floor(min / 60), mm = min % 60; return (h ? h + ' 小时 ' : '') + mm + ' 分钟'; }
  function mailList(a) { if (!Array.isArray(a.mail)) a.mail = []; if (!a.mailSeen || typeof a.mailSeen !== 'object') a.mailSeen = {}; return a.mail; }
  function send(a, m, now) {
    var L = mailList(a);
    if (m.id && a.mailSeen[m.id]) return false;
    if (m.id && !m.once) a.mailSeen[m.id] = now;
    L.unshift({ id: m.id || 'm' + now.toString(36), t: now, date: m.date || ACC.dayStr(now), from: m.from || '荆楚号舰务处', title: m.title, body: m.body || '', att: hasAtt(m.att) ? JSON.parse(JSON.stringify(m.att)) : null, read: false, got: !hasAtt(m.att) });
    while (L.length > MAIL_MAX) { var k = -1; for (var i = L.length - 1; i >= 0; i--) if (L[i].read && L[i].got) { k = i; break; } if (k < 0) break; L.splice(k, 1); }
    return true;
  }
  function pwMilestones(upTo) { var L = [10, 50, 100]; for (var m = 150; m <= upTo; m += 50) L.push(m); return L.filter(function (x) { return x <= upTo; }); }
  function pwReward(m) {
    if (m === 10) return { exp: 5000, energy: 1000, items: { floraJade: 20, g_sand: 24, g_core: 1 } };
    if (m === 50) return { exp: 15000, energy: 3000, items: { floraJade: 50, g_sand: 48, g_core: 2 } };
    if (m === 100) return { exp: 30000, energy: 5000, items: { floraJade: 100, g_sand: 96, g_core: 4 } };
    return { exp: 20000, energy: 4000, items: { floraJade: 60, g_sand: 48, g_core: 2 } };
  }
  function twExp0(f) { return f >= PVE.TOWER.top ? 16000 : 400 + 20 * f; }
  function twTok0(f) { return f >= PVE.TOWER.top ? 232 : 2 + Math.floor(f / 10); }
  var PURGE_OLD = { 1: 300, 5: 1000, 10: 2000, 20: 4000, 30: 12000 };
  var RANK_EXP = PVE.RANK_EXP, RANK_EXP_N = PVE.RANK_EXP_N, RANK_TOKEN = PVE.RANK_TOKEN, RANK_EXP_OLD = 600;
  // 投递：返回这次新到的邮件数
  function sync(a, env) {
    var now = env.now, n0 = mailList(a).length, seen = a.mailSeen, today = ACC.dayStr(now);
    // 离线经验：距离上次在线超过 20 分钟，每离线 1 分钟 6 点累积经验（最多算 3 天）
    var last = a.lastActive;
    if (last && now - last > OFFLINE_GAP) {
      var mins = Math.floor((now - last) / 60000), paid = Math.min(mins, OFFLINE_MAX_MIN), xp = paid * OFFLINE_RATE;
      send(a, { id: 'off-' + now.toString(36), once: true, title: '离线经验', body: '{name}，欢迎回来！\n你离开了 ' + (mins >= 1440 ? Math.floor(mins / 1440) + ' 天 ' : '') + durText(mins % 1440) + '。这段时间里，精灵们也在自己训练' + (mins > OFFLINE_MAX_MIN ? '（最多算 3 天）' : '') + '，一共攒下了 ' + fmt(xp) + ' 点，请领取附件。', att: { exp: xp } }, now);
    }
    a.lastActive = now;
    // 每日登录：每天 3000 累积经验；没登录的日子下次一起补（从创建账号那天算起）
    var td = ACC.dayNum(now), from = a.loginDay != null ? a.loginDay + 1 : ACC.dayNum(a.created || now);
    if (from <= td) {
      var miss = td - from;
      if (miss > 0) send(a, { id: 'login-back-' + td, title: '每日登录奖励补发（' + miss + ' 天）', body: '{name}，你好！\n每天登录都能领取 ' + fmt(LOGIN_EXP) + ' 累积经验。之前没有领到的 ' + miss + ' 天，现在一起补发，请领取附件。', att: { exp: miss * LOGIN_EXP } }, now);
      send(a, { id: 'login-' + td, title: '每日登录奖励', body: '{name}，今天也欢迎登船！\n每天登录都能领取累积经验 ×' + fmt(LOGIN_EXP) + '，请领取附件。', att: { exp: LOGIN_EXP } }, now);
      a.loginDay = td;
    }
    // 全服邮件（js/data/mail.js）
    (typeof MAILS !== 'undefined' ? MAILS : []).forEach(function (M0) {
      if (!M0 || !M0.id || seen[M0.id]) return;
      if (M0.to && !((env.user && M0.to.indexOf(env.user) >= 0) || M0.to.indexOf(a.name) >= 0)) return;   // to 里写登录账号名或做题家名字都行
      if (M0.until && today > M0.until) return;
      send(a, M0, now);
    });
    // 2026-10-21：先驱之塔奖励提高，给之前爬过塔的船员补差额
    if (!seen['tower-x10']) {
      var TW0 = a.tower, nf = TW0 ? (TW0.clears || 0) * PVE.TOWER.top + Math.max(0, (TW0.f || 1) - 1) : 0, ce = 0, ct = 0;
      for (var tf = 0; tf < nf; tf++) { var fl = tf % PVE.TOWER.top + 1; ce += twExp0(fl) * 9; ct += twTok0(fl) * 4; }
      if (nf > 0) send(a, { id: 'tower-x10', title: '先驱之塔奖励提高 · 补发', body: '先驱之塔每层的经验提高到 10 倍、先驱代币提高到 5 倍，每天的经验上限提高到 3 倍。\n按你之前通过的 ' + nf + ' 层（' + (TW0.clears || 0) + ' 次通关 + 当前这一轮的 ' + Math.max(0, (TW0.f || 1) - 1) + ' 层），补发差额。', att: { exp: ce, twTok: ct } }, now);
      else seen['tower-x10'] = now;
    }
    // 2026-10-18：困难难度BOSS新增的首次击败奖励
    [['tiger', 'tgPearl', '泰戈尔'], ['barren', 'brTwig', '荒芜']].forEach(function (x) {
      if (!PVE.bossWon(a, x[0], 2)) return; var it = {}; it[x[1]] = 80;
      send(a, { id: 'boss-item-' + x[0], title: '困难难度「' + x[2] + '」首次击败奖励补发', body: '{name}，你好！\n困难难度的BOSS「' + x[2] + '」新增了首次击败奖励「' + itemName(x[1]) + '」×80。你之前已经击败过它了，这份奖励给你补上。\n' + itemName(x[1]) + '可以让' + x[2] + '领悟隐藏技能，也能提高' + x[2] + '的等级上限。另外，' + x[2] + '的每周挑战也已经开放。', att: { items: it } }, now);
    });
    // 2026-10-24：普通难度荒芜新增首次击败奖励
    if (PVE.bossWon(a, 'barren', 1)) send(a, { id: 'boss-n-barren', title: '普通难度「荒芜」首次击败奖励补发', body: '{name}，你好！\n普通难度的BOSS「荒芜」的首次击败奖励定下来了：荒芜的专属道具「莠去津」×40（原来的「生长枯枝」也改名为「莠去津」，作用不变）。你之前已经击败过它了，这份奖励给你补上。', att: { items: { brTwig: 40 } } }, now);
    // 2026-10-19：BOSS 各难度首次击败新增马亚尔晶体（只补 10-19 之前就有的BOSS）
    ['tiger', 'barren'].forEach(function (k) {
      var B = PVE.BOSSES[k], n = 0, got = [];
      B.lv.forEach(function (L, i) { if (PVE.bossWon(a, k, i)) { n += PVE.BOSS_CRY[i] || PVE.BOSS_CRY[PVE.BOSS_CRY.length - 1]; got.push(L.diff); } });
      if (n) send(a, { id: 'boss-cry-' + k, title: 'BOSS「' + B.name + '」首次击败奖励补发', body: '{name}，你好！\n每个BOSS每档难度的首次击败，现在都会额外奖励马亚尔晶体（简单 100、普通 200、困难 400）。你之前已经击败过' + B.name + '的' + got.join('、') + '难度，这份奖励给你补上。\n马亚尔晶体可以在黄石 · 冶炼坊的「特产互换」里，每 10 个换成 10 个任意一种星球特产。', att: { items: { m_mcry: n } } }, now);
    });
    // 排位赛季段位奖励翻倍、新增道具、王者新增凶骨：之前按旧标准领过的段位补发（每个账号只算一次）
    var rec = rankRec(a);
    if (!rec.x2) {
      rec.x2 = true;
      var tiers = Object.keys(rec.got).map(Number).filter(function (r) { return RW.RANK_RW_OLD[r]; }).sort(function (x, y) { return x - y; });
      if (tiers.length) { var e = 0, g = 0; tiers.forEach(function (r) { e += RW.RANK_RW_OLD[r].exp; g += RW.RANK_RW_OLD[r].energy; });
        send(a, { id: SEASON + '-rank-x2', title: '排位赛季 ' + SEASON + ' 段位奖励翻倍补发', body: '{name}，你好！\n排位赛季 ' + SEASON + ' 的段位奖励已经翻倍。你之前已经达到过' + tiers.map(function (r) { return RANKS[r]; }).join('、') + '，当时按旧标准发放了奖励。\n现在按新标准补发差额，请领取附件。', att: { exp: e, energy: g } }, now); }
    }
    if (!rec.items) {
      rec.items = true;
      var add = {}, which = [];
      Object.keys(rec.got).map(Number).sort(function (x, y) { return x - y; }).forEach(function (r) { var o = RW.RANK_ITEMS[r]; if (!o) return; which.push(RANKS[r]); for (var k in o) add[k] = (add[k] || 0) + o[k]; });
      if (which.length) send(a, { id: SEASON + '-rank-items', title: '排位赛季 ' + SEASON + ' 段位奖励新增道具补发', body: '{name}，你好！\n排位赛季 ' + SEASON + ' 的段位奖励新增了捕捉装置和通用学习力合剂。你之前已经达到过' + which.join('、') + '，现在补发这些段位新增的道具，请领取附件。', att: { items: add } }, now);
    }
    if (!rec.kingGift) {
      rec.kingGift = true;
      if (rec.got[10]) send(a, { id: SEASON + '-king-gift', title: '王者段位奖励补发：凶骨', body: '{name}，你好！\n排位赛季 ' + SEASON + ' 的王者段位奖励新增了 LV10 的凶骨。你之前已经达到王者，现在补发给你，请领取附件。', att: { mons: [{ sid: 'bone', lv: 10 }] } }, now);
    }
    // 竞技代币上线（2026-10-14）：领过排位奖励的局每局补 20 代币；今天已经按 600 经验领过的局，补经验差额
    if (!a.tokenBack) {
      a.tokenBack = now;
      var RK = null; try { RK = JSON.parse((env.data && env.data['hs-rank-v1']) || 'null'); } catch (e2) {}
      var total = RK ? (RK.w || 0) + (RK.l || 0) : 0, tdy = a.rankExp && a.rankExp.d === PVE.bjDay(now) ? a.rankExp.n || 0 : 0;
      var past = Math.max(0, Math.round((Date.parse(PVE.bjDay(now).replace(/-(\d)(?=-|$)/g, '-0$1') + 'T00:00:00Z') - Date.parse('2026-10-12T00:00:00Z')) / 864e5)) * RANK_EXP_N;
      var games = tdy + Math.min(Math.max(0, total - tdy), past || 0);
      if (games) send(a, { id: 'arena-token-back', title: '平衡排位奖励提升 · 竞技代币补发',
        body: '{name}，你好！\n从今天起，平衡排位每天前 ' + RANK_EXP_N + ' 局每局奖励 ' + fmt(RANK_EXP) + ' 累积经验（每天共 ' + fmt(RANK_EXP * RANK_EXP_N) + '），并额外掉落 ' + RANK_TOKEN + ' 竞技代币。竞技代币可以在竞技对战 · 平衡排位的「竞技代币商店」兑换道具。\n' +
          '平衡排位奖励上线以来，你有 ' + games + ' 局领过排位奖励（每天前 ' + RANK_EXP_N + ' 局），每局补发 ' + RANK_TOKEN + ' 竞技代币。' + (tdy ? '其中今天的 ' + tdy + ' 局按新标准补发经验差额。' : '') + '请领取附件。',
        att: { tokens: games * RANK_TOKEN, exp: tdy * (RANK_EXP - RANK_EXP_OLD) } }, now);
    }
    // 星球任务「祛除瘴气」经验 ×10：已经领过的阶段补发差额
    var PR = a.purge;
    if (PR && PR.got && !a.purgeX10) {
      a.purgeX10 = 1;
      var pe = 0; PVE.PURGE.steps.forEach(function (st) { if (PR.got[st.n] && PURGE_OLD[st.n]) pe += st.exp - PURGE_OLD[st.n]; });
      if (pe > 0) send(a, { id: 'purge-x10', title: '星球任务「祛除瘴气」经验提升 · 补发', body: '{name}，你好！\n芙罗拉星的星球任务「祛除瘴气」各阶段的经验奖励提高到了原来的 10 倍。你已经领过的阶段，现在补发经验差额，请领取附件。', att: { exp: pe } }, now);
    }
    // 瘴气驱逐战：全服达到里程碑，给击破过的船员发奖励邮件（每个里程碑一次）
    var d = env.fetch ? env.fetch('pw') : null;
    if (d && d.me > 0) {
      if (!a.pw) a.pw = { got: {} }; if (!a.pw.got) a.pw.got = {};
      pwMilestones(d.total).forEach(function (m) {
        if (a.pw.got[m]) return; a.pw.got[m] = 1;
        var w = pwReward(m);
        send(a, { id: 'pw-' + m, title: '瘴气驱逐战 · 全服击破 ' + m + ' 只', body: '{name}，你好！\n全服船员在瘴气驱逐战中，已经一起击破了 ' + m + ' 只腐化精灵！\n你目前一共击破了 ' + d.me + ' 只，感谢你的贡献，请领取附件里的奖励。', att: w }, now);
      });
    }
    // 做题大王争霸赛：结束后按名次发奖（每个账号一次）
    var k2 = env.fetch ? env.fetch('ctPlace') : null;
    if (typeof k2 === 'number' && k2 >= 0) {
      if (!a.ctPlace) a.ctPlace = {};
      if (a.ctPlace[CONTEST.id] == null) a.ctPlace[CONTEST.id] = k2;
      var R = CT_RW[k2] || CT_RW0, place = k2 === 0 ? '冠军' : k2 === 1 ? '亚军' : '第 ' + (k2 + 1) + ' 名', ttl = k2 === 0 ? 'S1做题大王' : k2 === 1 ? 'S1做题小王' : 'S1做题区';
      send(a, { id: 'contest-' + CONTEST.id + '-rw', title: CONTEST.name + ' · ' + place + '奖励', body: '{name}，你好！\n' + CONTEST.name + '圆满结束，你获得了' + place + '，并获得称号「' + ttl + '」（点右上角的名字即可佩戴）！感谢参赛，请领取附件里的奖励。\n神秘精灵兑换券能兑换什么，之后揭晓。', att: { exp: R.exp, items: { ctTicket: R.t } } }, now);
    }
    return a.mail.length - n0;
  }
  function claim(a, m, env) {   // 领一封邮件的附件
    var x = m.att || {};
    give(a, { exp: x.exp, energy: x.energy, tokens: x.tokens, twTok: x.twTok, merit: x.merit, meritXp: x.merit, items: x.items });
    var mons = [];
    if (x.mons && x.mons.length) { var g = TX.run(a, 'gift', { k: 'mail', id: m.id }, env); if (g && g.ok) mons = g.mons || []; }
    m.got = true; m.read = true;
    return { id: m.id, att: x, mons: mons };
  }
  TX.add('mail', function (a, args, env) {
    var L = mailList(a);
    if (args.a === 'sync') return { ok: true, n: sync(a, env) };
    if (args.a === 'get') {
      var m = L.filter(function (y) { return y && y.id === String(args.id || ''); })[0];
      if (!m) return no('没有这封邮件');
      if (m.got) return no('附件已经领过了');
      return { ok: true, list: [claim(a, m, env)] };
    }
    if (args.a === 'all') {
      var out = []; L.forEach(function (y) { if (y && !y.got) out.push(claim(a, y, env)); });
      return { ok: true, list: out };
    }
    return no('不支持的操作');
  });

  return { TITLES: TITLES, titleCheck: titleCheck, RANKS_MIL: RANKS_MIL, MIL_COST: MIL_COST, milMigrate: milMigrate, CHAL_STAR: CHAL_STAR, rankRec: rankRec, rankPending: rankPending, rankRwOf: rankRwOf, rankBest: rankBest,
    hasAtt: hasAtt, send: send, sync: sync, MAIL_MAX: MAIL_MAX, pwMilestones: pwMilestones, pwReward: pwReward, CONTEST: CONTEST, CT_RW: CT_RW, CT_RW0: CT_RW0 };
})();
if (typeof module !== 'undefined') module.exports = AWD;
