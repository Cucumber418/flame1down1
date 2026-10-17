/* ==========================================================
 * 账号与主线
 * 创建账号、精灵背包/仓库、黄冈秘鉴、星际探索剧情、商城、茶室、任务
 * ========================================================== */

/* ============ 账号系统：创建账号、初始精灵、精灵背包（配队）、精灵仓库、星际探索 ============ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var H = window.HSUI, esc = H.esc, tchip = H.tchip, tchips = H.tchips, atkTip = H.atkTip;
  var KEY = 'hs-account-v1', PKEY = 'hs-page';
  var STARTERS = ['leaf', 'squid', 'shroom'], START_LV = 5, NAME_MAX = 20, TEAM_N = 2, TEAM_SIZE = 5;
  var TEAM_NAME = ['配队一', '配队二'];
  var NAT_KEYS = Object.keys(NATURES), STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  var BASE_NAME = { hp: '体力', atk: '物攻', def: '物防', spa: '特攻', spd: '特防', spe: '速度' };
  var STAGE = ['一阶', '二阶', '最终形态'];
  var acc = null, page = 'arena';
  var ui = { sel: null, pick: -1, ob: { step: 1, name: '', starter: null }, f: { type: '', min: 1, max: 100, sort: 'lvd' }, resetArmed: 0, welcome: false };

  /* ---------- 存档 ---------- */
  function valid(a) { return a && typeof a.name === 'string' && Array.isArray(a.mons) && Array.isArray(a.teams); }
  try { var raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (valid(raw)) acc = raw; } catch (e) {}
  try { var pg = localStorage.getItem(PKEY); if (pg) page = pg; } catch (e) {}
  if (acc) {   // 清理坏数据
    acc.mons = acc.mons.filter(function (m) { return SPMAP[m.sid]; });
    while (acc.teams.length < TEAM_N) acc.teams.push([]);
    acc.teams = acc.teams.map(function (t) { return t.filter(function (u, i) { return mon(u) && t.indexOf(u) === i; }).slice(0, TEAM_SIZE); });
    if (!(acc.active >= 0 && acc.active < TEAM_N)) acc.active = 0;
    if (acc.introDone == null) acc.introDone = acc.mons.length > 0;   // 旧存档：已有精灵视为看过序章
    if (acc.starter && !acc.rival) acc.rival = rivalOf(acc.starter);
    acc.mons.forEach(function (m) {
      if (!m.nat || !(m.nat in NATURES)) m.nat = NAT_KEYS[Math.floor(Math.random() * NAT_KEYS.length)];
      if (!m.ev) m.ev = {}; if (!(m.evFree >= 0)) m.evFree = 0;
      if (!ivOk(m.iv)) m.iv = randIv();   // 天赋系统上线前的精灵：补一套随机天赋
      if (acc.expV !== expV() && m.lv >= 1) {   // 经验曲线换版：等级不变，本级进度按比例换算
        var oe = acc.expV === 2 ? v2ExpAt : oldExpAt, o0 = oe(m.lv), o1 = oe(Math.min(100, m.lv + 1)), fr = m.lv >= 100 ? 0 : Math.max(0, Math.min(0.999, ((m.exp || 0) - o0) / (o1 - o0)));
        m.exp = m.lv >= 100 ? expAt(100) : Math.floor(expAt(m.lv) + fr * (expAt(m.lv + 1) - expAt(m.lv)));
      }
      if (!(m.exp >= expAt(m.lv))) m.exp = expAt(m.lv);
      // 隐藏技能改为战斗中领悟：旧存档里已经装备着的隐藏技能视为已领悟
      if (Array.isArray(m.moves)) m.moves = m.moves.map(moveName).filter(function (n, i, a) { return a.indexOf(n) === i; });   // 改过名字的技能换成新名字（合并后去重）
      if (Array.isArray(m.hl)) m.hl = m.hl.map(moveName);
      if (!Array.isArray(m.hl)) m.hl = (m.moves || []).filter(function (n) { return M[n] && M[n].hidden && LEARN[n]; });
      var a = avail(m.sid, m.lv, m.hl); m.moves = (m.moves || []).filter(function (n) { return a.indexOf(n) >= 0; });
      if (!m.moves.length) m.moves = defaultMoves(m.sid, m.lv, m.hl);
    });
    acc.expV = expV();
    if (!(acc.exp >= 0)) acc.exp = 0; if (!(acc.energy >= 0)) acc.energy = 0;
    if (!acc.items || typeof acc.items !== 'object') acc.items = {};
  }
  // 本地测试：用 ?test=tea 打开时，改用测试账号「测试」，并把「陆羽茶室」标成已读完。原来的存档留在 hs-account-v1-user，用 ?test=restore 换回来。
  function localHost() { return location.protocol === 'file:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost'; }
  function localFlag(name) { return new RegExp('(?:^|[?&])' + name + '(?:&|$)').test(location.search); }
  if (localHost() && localFlag('test=restore')) {
    try { var bakAcc = localStorage.getItem(KEY + '-user'); if (bakAcc) localStorage.setItem(KEY, bakAcc); } catch (e) {}
    location.replace(location.pathname + location.hash);
    return;
  } else if (localHost() && localFlag('test=tea')) {
    var teaWas = !!(acc && acc.story && acc.story.tea && acc.story.tea.done && acc.name === '测试');
    try {
      if ((!acc || acc.name !== '测试') && localStorage.getItem(KEY) && !localStorage.getItem(KEY + '-user')) localStorage.setItem(KEY + '-user', localStorage.getItem(KEY));
    } catch (e) {}
    if (!acc || acc.name !== '测试') acc = { v: 1, name: '测试', created: Date.now(), starter: 'leaf', rival: null, next: 1, mons: [], teams: [[], []], active: 0, introDone: true, story: {}, exp: 5000, energy: 20000, items: { cap1: 5, pot1: 5 } };
    if (!acc.story) acc.story = {};
    ['school', 'river', 'jiuquan', 'board', 'flora1', 'tea'].forEach(function (id) {
      var p = acc.story[id] || (acc.story[id] = {});
      p.done = true; p.rewarded = true; if (p.at == null) p.at = 99;
    });
    acc.introDone = true;
    if (!(acc.energy >= 20000)) acc.energy = 20000;
    if (!acc.items) acc.items = {};
    // 只补一次。星砂够做约 50 个加强装置，星核够做 1 个华为装置，药草够做 100 瓶 200血药。
    if (acc.testKit !== 2) {
      var testStock = {
        cap1: 10, cap2: 10, cap3: 1, pot1: 10, pot2: 10, pot200: 10,
        evAny: 5, evTagore: 5, natTagore: 5, trans: 1, helmet: 1, auto: 1, rename: 3,
        g_sand: 96, g_core: 4, s_herb: 4, c_herb: 200
      };
      Object.keys(testStock).forEach(function (k) { if (!(acc.items[k] >= testStock[k])) acc.items[k] = testStock[k]; });
      if (!(acc.exp >= 20000)) acc.exp = 20000;
      if (!(acc.energy >= 50000)) acc.energy = 50000;
      acc.testKit = 2;
    }
    if (!acc.mons.length) { var tm = newMon('leaf', 20); acc.starter = 'leaf'; acc.rival = rivalOf('leaf'); acc.teams[0] = [tm.u]; }
    if (!teaWas) page = 'explore';
    save(); savePage();
  }
  // 旧的六种采集物、三种种子并进星砂、星核和药草。已经种下的旧种子在打开种植园时清掉。
  function migrateMats() {
    if (!acc || !acc.items || acc.matsV === 1) return;
    var sand = 0, core = 0;
    ['g_fungus', 'g_fiber', 'g_shell', 'g_rock'].forEach(function (k) { sand += acc.items[k] || 0; delete acc.items[k]; });
    ['g_spark', 'g_ice'].forEach(function (k) { core += acc.items[k] || 0; delete acc.items[k]; });
    if (sand) acc.items.g_sand = (acc.items.g_sand || 0) + sand;
    if (core) acc.items.g_core = (acc.items.g_core || 0) + core;
    ['s_moss', 's_bean', 'c_moss', 'c_bean'].forEach(function (k) { delete acc.items[k]; });
    acc.matsV = 1; save();
  }
  migrateMats();
  function ready() { return !!(acc && acc.introDone); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(acc)); } catch (e) {} }
  function savePage() { try { localStorage.setItem(PKEY, page); } catch (e) {} }

  /* ---------- 精灵实例 ---------- */
  function mon(u) { if (!acc) return null; for (var i = 0; i < acc.mons.length; i++) if (acc.mons[i].u === u) return acc.mons[i]; return null; }
  function stageOf(s, lv) { for (var i = evoLast(s); i > 0; i--) if (lv >= s.evo[i].lv) return i; return 0; }
  // 异色：true 是第一种异色，2 是第二种（更稀有）
  function shinyV(v) { return v === 2 ? 2 : !!v; }
  function rollShiny(w) { var r = Math.random(); return w.shiny2 && r < w.shiny2 ? 2 : !!(w.shiny && r < (w.shiny2 || 0) + w.shiny); }
  function form(m) {
    var s = SPMAP[m.sid], st = stageOf(s, m.lv), n = formRawName(s, st), unsure = false;
    if (n && n.slice(-1) === '?') { n = n.slice(0, -1); unsure = true; }
    if (!n) n = s.name + '·' + stageLabel(s, st);
    var img = formImg(s, st), sk = isFin(s, st) ? s.id : s.id + '_s' + (st + 1);
    // 异色：有这一形态的异色立绘就用异色图，没有就照常显示（精灵身上仍然标着「异色」）
    if (m.shiny && typeof SHINY_SPRITES !== 'undefined') { if (m.shiny === 2 && SHINY_SPRITES[sk + '_2']) img = SHINY_SPRITES[sk + '_2']; else if (SHINY_SPRITES[sk]) img = SHINY_SPRITES[sk]; }
    return { name: n, img: img, stage: st, unsure: unsure, no: s.evo[st].no || '', d: s.evo[st].d || '', shiny: shinyV(m.shiny) };
  }
  // 普通技能：第 1 个 LV1 习得，之后每 5 级学会下一个（LV5、LV10、LV15……）；隐藏技能暂按 LV50
  function learnLv(i) { return i === 0 ? 1 : i * 5; }
  function moveLv(sid, mv) { var s = SPMAP[sid], i = s.moves.indexOf(mv); return i >= 0 ? learnLv(i) : 50; }
  // hl：这只精灵已领悟的隐藏技能。有领悟条件的隐藏技能只能在战斗中领悟；没写条件的仍然 LV50 习得。
  // 不传 hl（剧情里的对手）时沿用旧规则：LV50 起隐藏技能全部可用。
  function hidOk(lv, hl, n) { return hl && LEARN[n] ? hl.indexOf(n) >= 0 && lv >= HIDDEN_MIN_LV : lv >= 50; }   // 战斗中领悟的隐藏技能也要 LV40 以上才能用（HIDDEN_MIN_LV 在 battle.js）
  function avail(sid, lv, hl) { var s = SPMAP[sid]; return s.moves.filter(function (n, i) { return lv >= learnLv(i); }).concat(s.hidden.filter(function (n) { return hidOk(lv, hl, n); })); }
  function defaultMoves(sid, lv, hl) {
    var s = SPMAP[sid], a = avail(sid, lv, hl), out = s.def.filter(function (n) { return a.indexOf(n) >= 0; });
    a.forEach(function (n) { if (out.length < 4 && out.indexOf(n) < 0) out.push(n); });
    return out;
  }
  function randNat() { return NAT_KEYS[Math.floor(Math.random() * NAT_KEYS.length)]; }
  function newMon(sid, lv) { var m = { u: acc.next++, sid: sid, lv: lv, exp: expAt(lv), moves: defaultMoves(sid, lv, []), got: Date.now(), nat: randNat(), iv: randIv(), ev: {}, evFree: 0, hl: [] }; acc.mons.push(m); markForm(sid, stageOf(SPMAP[sid], lv)); return m; }
  // 天赋：六项能力各一个 0~31 的随机数，越高越强（满 31 和天赋系统上线前一样）
  function randIv() { var o = {}; STAT_KEYS.forEach(function (k) { o[k] = Math.floor(Math.random() * 32); }); return o; }
  function ivOk(iv) { return !!iv && typeof iv === 'object' && STAT_KEYS.every(function (k) { return iv[k] >= 0 && iv[k] <= 31 && iv[k] === Math.floor(iv[k]); }); }
  function ivOf(m) { return ivOk(m.iv) ? m.iv : null; }
  // 天赋评级（2026-10-17）：按六项天赋合计（0~186）分五档，颜色 白 / 绿 / 蓝 / 紫 / 橙
  var IV_GRADE = [[170, '极品', 'g5'], [150, '稀', 'g4'], [120, '优', 'g3'], [90, '良', 'g2'], [0, '一般', 'g1']];
  function ivGrade(m) { var iv = ivOf(m); if (!iv) return null; var t = STAT_KEYS.reduce(function (a, k) { return a + iv[k]; }, 0); for (var i = 0; i < IV_GRADE.length; i++) if (t >= IV_GRADE[i][0]) return { n: IV_GRADE[i][1], c: IV_GRADE[i][2], s: t }; return null; }
  function ivSumOf(m) { var iv = ivOf(m); return iv ? STAT_KEYS.reduce(function (a, k) { return a + iv[k]; }, 0) : -1; }
  function gradeTag(m) { var g = ivGrade(m); return g ? '<span class="iv-grade ' + g.c + '" title="天赋评级：' + g.n + '（天赋合计 ' + g.s + ' / 186）">' + g.n + '</span>' : ''; }
  function evSum(m) { return STAT_KEYS.reduce(function (a, k) { return a + ((m.ev && m.ev[k]) || 0); }, 0); }
  function natText(nat) { var n = NATURES[nat]; return n ? BASE_NAME[n[0]] + ' +10%，' + BASE_NAME[n[1]] + ' −10%' : '各项能力无修正'; }
  // 胜利后，出战过的精灵各得 1 点可分配学习力（总量不超过 750）
  function giveEv(units, n) {
    var got = []; n = n || 1;
    units.forEach(function (u) { var m = mon(u), room = m ? EV_TOTAL - evSum(m) - (m.evFree || 0) : 0; if (room > 0) { m.evFree = (m.evFree || 0) + Math.min(n, room); got.push(form(m).name); } });
    save(); return got;
  }
  /* 经验：每升一级所需经验以「等级³ 的差」为基础，按等级段调整系数（expK），expTab()[lv] = 到达该等级所需的累计经验
   * 存档 acc.expV 记录经验曲线的版本；曲线改过之后，读档清理坏数据时按「等级不变、本级进度比例不变」换算旧经验
   * （读档清理在文件最上面，比这里先执行，所以表格用到时才生成） */
  var MAX_LV = 100, _expTab = null;
  function expV() { return 3; }
  // lv → lv+1 这一级的系数（相对等级³ 的差）。v2：50 级以上 ×2；v3（2026-10-17，隐藏调整）：50 级以上再 ×4，即 ×8
  function expK(lv) { return lv < 25 ? 0.6 : lv >= 50 ? 8 : 1; }
  function expKv2(lv) { return lv < 25 ? 0.6 : lv >= 50 ? 2 : 1; }
  function tabOf(k) { var T = [0, 1]; for (var l = 1; l < 100; l++) T[l + 1] = T[l] + Math.round(((l + 1) * (l + 1) * (l + 1) - l * l * l) * k(l)); return T; }
  var _v2Tab = null;
  function v2ExpAt(lv) { if (!_v2Tab) _v2Tab = tabOf(expKv2); return _v2Tab[Math.max(1, Math.min(100, lv))]; }
  function expTab() {
    if (!_expTab) { _expTab = [0, 1]; for (var l = 1; l < 100; l++) _expTab[l + 1] = _expTab[l] + Math.round(((l + 1) * (l + 1) * (l + 1) - l * l * l) * expK(l)); }
    return _expTab;
  }
  function expAt(lv) { lv = Math.max(1, Math.min(100, lv)); return expTab()[lv]; }
  function lvOf(exp) { var T = expTab(), lv = 1; while (lv < MAX_LV && T[lv + 1] <= exp) lv++; return lv; }
  function oldExpAt(lv) { return lv * lv * lv; }   // 第 1 版曲线（只用于换算旧存档）
  function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }
  function giveExp(m, amt) { return gainExp(m, amt, true); }
  // fromPool：从经验分配器里扣；否则是战斗直接获得
  function gainExp(m, amt, fromPool) {
    var room = expAt(MAX_LV) - m.exp; amt = Math.max(0, Math.min(amt, room, fromPool ? acc.exp : Infinity)); if (!amt) return null;
    var before = { lv: m.lv, name: form(m).name, stage: form(m).stage };
    markForm(m.sid, before.stage);
    m.exp += amt; if (fromPool) acc.exp -= amt; m.lv = lvOf(m.exp); markForm(m.sid, form(m).stage);
    var after = form(m), msg = form(m).name + ' 获得了 ' + fmt(amt) + ' 点经验';
    if (m.lv > before.lv) { msg += '，升到了 LV' + m.lv + '！'; setTimeout(function () { checkTitles(); renderTitle(); }, 0); }
    else msg += '。';
    if (after.stage > before.stage) msg += before.name + ' 进化成了 ' + after.name + '！';
    var was = avail(m.sid, before.lv, m.hl || []), now = avail(m.sid, m.lv, m.hl || []).filter(function (n) { return was.indexOf(n) < 0; });
    var regular = now.filter(function (n) { return !M[n].hidden; });
    if (regular.length) {
      var eq = [];
      regular.forEach(function (n) { if (m.moves.length < 4 && m.moves.indexOf(n) < 0) { m.moves.push(n); eq.push(n); } });
      msg += '学会了新技能：' + regular.map(function (n) { return '「' + n + '」'; }).join('、') + (eq.length ? (eq.length === regular.length ? '，已自动装备。' : '，其中' + eq.map(function (n) { return '「' + n + '」'; }).join('、') + '已自动装备。') : '。出战技能已满，可在下方替换。');
    }
    var hid = now.filter(function (n) { return M[n].hidden; });
    if (hid.length) msg += '领悟了隐藏技能：' + hid.map(function (n) { return '「' + n + '」'; }).join('、') + '。';
    return msg;
  }
  function teamsOf(u) { var r = []; acc.teams.forEach(function (t, i) { var k = t.indexOf(u); if (k >= 0) r.push({ t: i, lead: k === 0 }); }); return r; }
  function stat(m, k) { return fullStat(SPMAP[m.sid].base[k], k, m.lv, m.ev, m.nat, ivOf(m)); }

  /* ---------- 顶栏、导航 ---------- */
  function renderTop() {
    document.body.classList.toggle('no-acc', !ready());
    $('onboard').hidden = ready();
    if (!ready()) { renderOnboard(); return; }
    if (prog('school').done && !prog('school').rewarded) grant('school');   // 旧存档补发序章奖励
    backfillMain();
    if (acc.story && acc.story.storage && acc.story.storage.rewarded && !acc.story.storage.itemsGiven) { giveItems(SITES.storage.reward.items); acc.story.storage.itemsGiven = true; save(); }
    $('who-name').textContent = acc.name;
    renderRes();
    renderAvatar(); renderGender();
    $('who-info').textContent = '做题家「' + acc.name + '」 · 军衔 ' + milName() + ' · 拥有精灵 ' + acc.mons.length + ' 只 · 创建于 ' + new Date(acc.created).toLocaleDateString('zh-CN');
    checkTitles(); renderTitle();
    if (page === 'arena' && !arenaOpen()) page = 'bag';
    if (page === 'dex' && !dexOpen()) page = 'bag';
    if (page === 'shop') page = 'explore';
    [].forEach.call(document.querySelectorAll('#mainnav .nav'), function (b) {
      var on = b.dataset.page === page; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    });
    syncBattle();
    deliverMail(); checkRankRewards(); daily(); homeSettle();
    setTimeout(newsCheck, 1500);
    ['arena', 'log', 'bag', 'store', 'dex', 'items', 'social', 'explore'].forEach(function (p) { $('pg-' + p).hidden = p !== page; });
    renderRename();
    if (page === 'arena' && window.HSBATTLE && window.HSBATTLE.renderMode && $('battle').hidden) window.HSBATTLE.renderMode();
    if (page === 'social') { if (window.HSSOCIAL) window.HSSOCIAL.render(); }
    else if (page === 'bag') renderBag();
    else if (page === 'log') renderLog();
    else if (page === 'dex') renderDex2();
    else if (page === 'store') renderStore();
    else if (page === 'items') renderItems();
    else if (page === 'explore') renderExplore();
    if (typeof bgmScene === 'function') bgmScene();
  }
  function renderRes() { $('res').innerHTML = '<span class="res-chip" title="经验背包里的累积经验，可分配给精灵">经验 <b>' + fmt(acc.exp) + '</b></span><span class="res-chip en" title="能量（货币）">能量 <b>' + fmt(acc.energy) + '</b></span>'; setTimeout(renderQBadge, 0); }
  function go(p) { if (ex.mode === 'replay' && p !== 'explore') { stopTimers(); ex.mode = null; ex.view = 'sites'; } page = p; ui.pick = -1; savePage(); renderTop(); window.scrollTo(0, 0); }
  $('mainnav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-page]'); if (!b || b.disabled) return;
    if (b.classList.contains('lockA')) {
      if (b.dataset.page === 'dex') toast('读完星际探索 · 荆楚号 · 学院部的剧情后，「黄冈秘鉴」才会开放。', prog('board').done ? '前往学院部' : '', '黄冈');
      else toast('读完星际探索 · 荆楚号 · 孝感大厅的剧情后，「竞技对战」才会开放。', prog('board').done ? '前往孝感大厅' : '', '孝感');
      return;
    }
    go(b.dataset.page);
  });
  function toast(msg, act, area) {
    var t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t);
      t.addEventListener('click', function (e) { var g = e.target.closest('[data-tgo]'); if (g) { t.hidden = true; ex.planet = 'jingchu'; go('explore'); teleport(g.dataset.tgo); } }); }
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (act ? '<button type="button" class="btn" data-tgo="' + (area || '孝感') + '">' + act + '</button>' : '');
    t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, Math.min(12000, 4200 + msg.length * 60));
  }
  // 竞技对战进行中时锁住其他大栏，避免中途离开
  function syncBattle() {
    var inB = !$('battle').hidden, story = typeof ex !== 'undefined' && ex.fighting;
    [].forEach.call(document.querySelectorAll('#mainnav .nav'), function (b) {
      var pg = b.dataset.page, lockA = (pg === 'arena' && !arenaOpen()) || (pg === 'dex' && !dexOpen());
      b.disabled = inB && (story || pg !== 'arena');
      if (lockA) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      b.title = inB && b.disabled ? '对战进行中，结束后才能切换' : lockA ? (pg === 'dex' ? '读完星际探索 · 荆楚号 · 学院部的剧情后开放' : '读完星际探索 · 荆楚号的支线「孝感大厅」后开放') : '';
      if (pg === 'arena') { b.classList.toggle('lockA', lockA); b.querySelector('small').textContent = lockA ? '完成孝感大厅支线后开放' : '沙盒调试 · 平衡排位'; }
      if (pg === 'dex') { b.classList.toggle('lockA', lockA); b.querySelector('small').textContent = lockA ? '在学院部解锁' : (acc ? '已点亮 ' + litCount() + ' / ' + DEX_ALL.length + ' 类' : '精灵图鉴'); }
    });
  }
  new MutationObserver(function () { syncBattle(); if (ready() && $('battle').hidden) checkRankRewards(); }).observe($('battle'), { attributes: true, attributeFilter: ['hidden'] });
  // 账号菜单
  $('who-btn').addEventListener('click', function (e) {
    e.stopPropagation(); var m = $('who-menu'); m.hidden = !m.hidden; $('who-btn').setAttribute('aria-expanded', !m.hidden);
    ui.resetArmed = 0; $('btn-reset').classList.remove('armed'); $('btn-reset').textContent = '重置存档';
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('#who')) { $('who-menu').hidden = true; $('who-btn').setAttribute('aria-expanded', false); } });
  /* ---------- 称号 ---------- */
  var TITLES = [
    // grp：授勋馆里的分组（story 剧情与探索 / lv 等级 / season 排位赛季 / type 属性）
    { id: 'trainee', n: '见习做题家', d: '在黄冈秘鉴中点亮 3 类精灵', ok: function () { return litCount() >= 3; } },
    { id: 'senior', n: '资深做题家', d: '在黄冈秘鉴中点亮 10 类精灵', ok: function () { return litCount() >= 10; } },
    { id: 'elite', n: '精英做题家', d: '在黄冈秘鉴中点亮 30 类精灵', ok: function () { return litCount() >= 30; } },
    { id: 'master', n: '大师做题家', d: '在黄冈秘鉴中点亮 50 类精灵', ok: function () { return litCount() >= 50; } },
    { id: 'scholar', n: '学习王', d: '在黄冈秘鉴中点亮 100 类精灵', ok: function () { return litCount() >= 100; } },
    { id: 'collector', n: '实验班收藏家', d: '拥有 1 类稀有精灵（捕捉后在学院部汇报）', ok: function () { return !!(acc.story && acc.story.rare_r && acc.story.rare_r.done); } },
    { id: 'rare5', n: '考点收藏家', d: '拥有 5 类稀有精灵', ok: function () { return rareKinds() >= 5; } },
    { id: 'rare15', n: '必刷题收藏家', d: '拥有 15 类稀有精灵', ok: function () { return rareKinds() >= 15; } },
    { id: 'purifier', n: '芙罗拉净化者', d: '完成芙罗拉星的星球任务「祛除瘴气」', ok: function () { return !!(acc.purge && acc.purge.n >= 30); } },
    { id: 'force', n: '原力掌控者', d: '击败困难难度的首领「泰戈尔」', ok: function () { return bossWon('tiger', 2); } },
    { id: 'guardian', n: '净土守护', d: '击败困难难度的首领「荒芜」', ok: function () { return bossWon('barren', 2); } },
    { id: 'reaper', n: '死神', d: '击败先驱之塔第 60 层的死神「帕努托尔」', ok: function () { return !!(acc.tower && acc.tower.clears > 0); } }
  ];
  // 等级成就：有 1 只 / 5 只精灵达到 25、50、75、100 级
  TITLES.forEach(function (T) { T.grp = 'story'; });
  function lvCount(lv) { return acc.mons.filter(function (m) { return m.lv >= lv; }).length; }
  [[25, '达人'], [50, '高手'], [75, '狂人'], [100, '神人']].forEach(function (L) {
    TITLES.push({ id: 'one' + L[0], grp: 'lv', n: '单科' + L[1], d: '有 1 只精灵达到 ' + L[0] + ' 级', ok: function () { return lvCount(L[0]) >= 1; } });
  });
  [[25, '达人'], [50, '高手'], [75, '狂人'], [100, '神人']].forEach(function (L) {
    TITLES.push({ id: 'all' + L[0], grp: 'lv', n: '全科' + L[1], d: '有 5 只精灵达到 ' + L[0] + ' 级', ok: function () { return lvCount(L[0]) >= 5; } });
  });
  // 排位赛季称号：本赛季（S1）达到某个段位就获得「S1 + 段位名」，例如「S1翡翠」（黑铁是起始段位，不发）
  for (var sr = 1; sr < RANKS.length; sr++) (function (r) {
    TITLES.push({ id: 'S1-' + r, grp: 'season', n: 'S1' + RANKS[r], d: '排位赛季 S1 达到' + RANKS[r] + '段位', season: true, ok: function () { return rankBest() >= r; } });
  })(sr);
  /* 属性称号：按精灵种类数统计（同一条进化线算 1 种，双属性精灵两个属性都算）
   * 收藏家：拥有 N 种该属性的精灵；训练师：N 种 LV50 以上；专家：5 种 LV80 以上 */
  var TITLE_TYPES = Object.keys(TYPE_COLOR).filter(function (t) { return t !== '无'; });
  var TYPE_TIERS = [
    { k: 'c', n: '收藏家', lv: 0, steps: [[3, '见习'], [6, '资深'], [10, '精英'], [15, '大师']] },
    { k: 't', n: '训练师', lv: 50, steps: [[1, '见习'], [3, '资深'], [5, '精英'], [10, '大师']] },
    { k: 'x', n: '专家', lv: 80, steps: [[5, '']] }
  ];
  function typeKinds(t, lv) { var o = {}; acc.mons.forEach(function (m) { var s = SPMAP[m.sid]; if (s && s.types.indexOf(t) >= 0 && m.lv >= lv) o[m.sid] = 1; }); return Object.keys(o).length; }
  TITLE_TYPES.forEach(function (t) {
    TYPE_TIERS.forEach(function (G) {
      G.steps.forEach(function (st) {
        TITLES.push({ id: 'ty' + G.k + st[0] + '-' + t, grp: 'type', type: t, tier: G.k, need: st[0], n: st[1] + t + '系' + G.n,
          d: '拥有 ' + st[0] + ' 种' + (G.lv ? ' LV' + G.lv + ' 以上的' : '') + t + '属性精灵',
          prog: function () { return typeKinds(t, G.lv); }, ok: function () { return typeKinds(t, G.lv) >= st[0]; } });
      });
    });
  });
  /* 称号奖励：每获得一个称号，得累积经验（进经验背包）、能量和功勋点（数额暂定）
   * 功勋点：存档 acc.merit（余额，暂时还没有用途）；每得 1 功勋点同时得 1 功勋经验 acc.meritXp，攒够了在授勋馆晋升军衔 */
  var TITLE_RW = {
    trainee: [1000, 200, 10], senior: [3000, 500, 30], elite: [8000, 1000, 60], master: [15000, 2000, 100], scholar: [30000, 5000, 200],
    collector: [2000, 300, 20], rare5: [8000, 1000, 60], rare15: [30000, 5000, 200], purifier: [5000, 800, 50], force: [10000, 1500, 80], guardian: [10000, 1500, 80],
    one25: [1000, 200, 10], one50: [3000, 400, 20], one75: [6000, 800, 40], one100: [10000, 1500, 80],
    all25: [3000, 400, 20], all50: [8000, 1000, 50], all75: [15000, 2000, 100], all100: [30000, 4000, 200]
  };
  var TYPE_RW = { 1: [1000, 200, 10], 3: [1000, 200, 10], 5: [8000, 1000, 50], 6: [3000, 500, 25], 10: [8000, 1000, 50], 15: [20000, 3000, 100] };
  function titleRw(T) {
    var r = TITLE_RW[T.id];
    if (!r && T.season) { var k = +T.id.split('-')[1]; r = [500 * k, 100 * k, 5 * k]; }
    if (!r && T.grp === 'type') r = T.tier === 'x' ? [15000, 2000, 80] : T.tier === 't' && T.need === 3 ? [3000, 500, 25] : T.tier === 't' && T.need === 5 ? [8000, 1000, 50] : T.tier === 't' && T.need === 10 ? [20000, 3000, 100] : TYPE_RW[T.need];
    r = r || [1000, 200, 10];
    return { exp: r[0], energy: r[1], merit: r[2] };
  }
  function rwText(r) { return '累积经验 ×' + fmt(r.exp) + '、能量 ×' + fmt(r.energy) + '、功勋点 ×' + fmt(r.merit); }
  function giveMerit(n) { acc.merit = (acc.merit || 0) + n; acc.meritXp = (acc.meritXp || 0) + n; }
  // 军衔：功勋经验攒够当前军衔的晋升所需，就能在授勋馆晋升（消耗功勋经验）。数额暂定
  var RANKS_MIL = ['列兵', '上等兵', '下士', '中士', '上士', '少尉', '中尉', '上尉', '少校', '中校', '上校', '大校', '将军'];
  var MIL_COST = [20, 40, 60, 100, 150, 200, 300, 400, 500, 700, 900, 1200];   // 第 i 级晋升到第 i+1 级要的功勋经验
  function milRank() { return Math.max(0, Math.min(RANKS_MIL.length - 1, acc.milRank | 0)); }
  function milName() { return RANKS_MIL[milRank()]; }
  function promote() {
    var r = milRank(), c = MIL_COST[r];
    if (r >= RANKS_MIL.length - 1 || !((acc.meritXp || 0) >= c)) return;
    acc.meritXp -= c; acc.milRank = r + 1; save();
    toast('晋升成功！你的军衔现在是「' + milName() + '」。'); renderTop(); if (ex.view === 'medal') renderMedal();
  }
  function checkTitles() {
    if (!acc.titles) acc.titles = [];
    var got = [];
    TITLES.forEach(function (T) { if (acc.titles.indexOf(T.id) < 0 && T.ok()) { acc.titles.push(T.id); got.push(T.n); } });
    // 称号奖励：acc.titleRw 记已经发过奖励的称号。奖励上线前已经有的称号，第一次用邮件一起补发
    var back = !acc.titleRw;
    if (back) acc.titleRw = [];
    var sum = { exp: 0, energy: 0, merit: 0 }, n = 0;
    TITLES.forEach(function (T) {
      if (acc.titles.indexOf(T.id) < 0 || acc.titleRw.indexOf(T.id) >= 0) return;
      acc.titleRw.push(T.id); var r = titleRw(T); sum.exp += r.exp; sum.energy += r.energy; sum.merit += r.merit; n++;
    });
    if (n && back) {
      sendMail({ id: 'title-rw-back', title: '称号奖励补发', body: '{name}，你好！\n从现在起，每获得一个称号都会得到累积经验、能量和功勋点奖励。功勋点同时会变成等额的功勋经验，可以在荆楚号 · 黄冈 · 学院部的授勋馆里晋升军衔。\n你之前已经获得了 ' + n + ' 个称号，奖励一起补发，请领取附件。', att: sum });
      renderMailBadge(); save();
    } else if (n) {
      acc.exp = (acc.exp || 0) + sum.exp; acc.energy = (acc.energy || 0) + sum.energy; giveMerit(sum.merit); save(); renderRes();
    }
    // 一次拿到好几个（比如老玩家第一次看到赛季称号）时合成一条提示
    if (got.length) { save(); var rt = !back && n ? '奖励：' + rwText(sum) + '。' : ''; setTimeout(function () { toast('获得称号「' + got.join('」「') + '」！' + rt + '点右上角的名字即可佩戴。'); }, 400); }
    else if (n && !back) setTimeout(function () { toast('称号奖励到账：' + rwText(sum) + '。'); }, 600);
  }
  function titleName(id) { var T = TITLES.filter(function (x) { return x.id === id; })[0]; return T ? T.n : ''; }
  function renderTitle() {
    var cur = acc.title && acc.titles.indexOf(acc.title) >= 0 ? acc.title : '';
    $('who-title').textContent = cur ? titleName(cur) : '做题家';
    $('who-title').classList.toggle('has', !!cur);
    // 名字菜单里只列出已经获得的称号；全部称号和获得方式在学院部的授勋馆
    var own = TITLES.filter(function (T) { return acc.titles.indexOf(T.id) >= 0; });
    $('title-box').innerHTML = '<b>称号 <small class="tt-n">' + own.length + '</small></b><div class="tt-list">' + own.map(function (T) {
      return '<label class="tt-opt"><input type="radio" name="title" value="' + T.id + '"' + (cur === T.id ? ' checked' : '') + '><span><b>' + T.n + '</b><small>' + T.d + '</small></span></label>';
    }).join('') + '<label class="tt-opt"><input type="radio" name="title" value=""' + (cur ? '' : ' checked') + '><span><b>不佩戴</b></span></label></div>' +
      '<p class="tt-season">' + (own.length ? '' : '还没有获得称号。') + '所有称号和获得方式，可以在荆楚号 · 黄冈 · 学院部的「授勋馆」查看' + (medalOpen() ? '' : '（读完支线「授勋馆」后开放）') + '。</p>';
  }
  /* ---------- 头像：用自己拥有的一只精灵当头像（存档 acc.avatar = 精灵的编号 u；精灵不在了就用名字首字） ----------
   * 社交的玩家列表、名片、讨论区都会显示（服务器从存档里读，见 server/social.js 的 avatarOf） */
  function avatarMon() { return acc && acc.avatar != null ? mon(acc.avatar) : null; }
  function avatarInner(spec, name) {
    if (spec && SPMAP[spec.sid]) { var f = form({ sid: spec.sid, lv: spec.lv, shiny: spec.shiny }); return '<img src="' + f.img + '" alt="">'; }
    return esc(Array.from(name || '?')[0] || '?');
  }
  function renderAvatar() {
    var m = avatarMon(), av = $('who-av');
    av.innerHTML = avatarInner(m, acc.name); av.classList.toggle('img', !!m);
    $('avatar-box').innerHTML = '<b>头像</b><div class="av-row"><span class="pav' + (m ? ' img' : '') + '">' + avatarInner(m, acc.name) + '</span><span class="hint">' + (m ? esc(form(m).name) + ' · LV' + m.lv : '名字首字（默认）') + '</span><button type="button" class="btn" id="av-pick">更换头像</button></div>';
  }
  function openAvatarPicker() {
    $('who-menu').hidden = true;
    var old = $('av-dlg'); if (old) old.remove();
    var cur = acc.avatar, list = acc.mons.slice().sort(function (a, b) { return b.lv - a.lv || a.u - b.u; });
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'av-dlg';
    d.innerHTML = '<div class="soc-box av-box" role="dialog" aria-modal="true" aria-label="更换头像"><span class="tape l"></span><span class="tape r"></span><span class="step">头像</span><h2>选一只精灵当头像</h2>' +
      '<p class="hint">只能选自己拥有的精灵，显示的是它现在的形态。社交、名片和讨论区里，其他船员都会看到。</p>' +
      '<div class="av-grid"><button type="button" class="av-opt' + (avatarMon() ? '' : ' on') + '" data-av=""><span class="pav">' + esc(Array.from(acc.name)[0] || '?') + '</span><small>名字首字</small></button>' +
      list.map(function (m) { var f = form(m); return '<button type="button" class="av-opt' + (m.u === cur ? ' on' : '') + '" data-av="' + m.u + '"><span class="pav img"><img src="' + f.img + '" alt=""></span><small>' + esc(f.name) + (m.shiny ? '<span class="shiny-tag">异色</span>' : '') + '<br>LV' + m.lv + '</small></button>'; }).join('') +
      '</div><div class="soc-foot"><button type="button" class="btn ghost" data-avx="1">取消</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-avx]')) { d.remove(); return; }
      var b = e.target.closest('[data-av]'); if (!b) return;
      acc.avatar = b.dataset.av === '' ? null : +b.dataset.av; save(); renderAvatar(); d.remove();
      var m = avatarMon(); toast(m ? '头像换成了「' + form(m).name + '」。同步到服务器后，其他船员就能看到。' : '头像改回了名字首字。');
    });
  }
  $('avatar-box').addEventListener('click', function (e) { e.stopPropagation(); if (e.target.id === 'av-pick') openAvatarPicker(); });
  /* ---------- 改名卡：商城 1000 能量，在名字菜单里使用 ---------- */
  var renaming = false;
  function renderRename() {
    var n = (acc && acc.items && acc.items.rename) || 0, box = $('rename-box');
    if (!acc) { box.innerHTML = ''; return; }
    if (renaming && n > 0) {
      box.innerHTML = '<b>改名</b><form class="rn-form" id="rn-form"><input id="rn-name" type="text" maxlength="' + NAME_MAX + '" autocomplete="off" spellcheck="false" value="' + esc(acc.name) + '" aria-label="新的做题家名字">' +
        '<div class="rn-btns"><button type="button" class="btn ghost" id="rn-x">取消</button><button type="submit" class="btn primary">确认改名</button></div><p class="hint" id="rn-msg">最多 ' + NAME_MAX + ' 个字，会消耗 1 张改名卡。</p></form>';
      var inp = $('rn-name'); inp.focus(); inp.select();
      return;
    }
    box.innerHTML = '<b>改名卡</b><p>持有 ' + n + ' 张。' + (n ? '' : '可在荆楚号 · 荆门 · 物资仓储的商城用 1,000 能量兑换。') + '</p>' +
      '<button type="button" class="btn" id="rn-use"' + (n ? '' : ' disabled') + '>使用改名卡</button>';
  }
  $('rename-box').addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.id === 'rn-use') { renaming = true; renderRename(); }
    else if (e.target.id === 'rn-x') { renaming = false; renderRename(); }
  });
  $('rename-box').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = Array.from($('rn-name').value.trim()).slice(0, NAME_MAX).join('');
    if (!v) { $('rn-msg').textContent = '名字不能为空'; return; }
    if (v === acc.name) { $('rn-msg').textContent = '和现在的名字一样'; return; }
    if (!(acc.items.rename > 0)) { renaming = false; renderRename(); return; }
    var old = acc.name;
    acc.items.rename--; acc.name = v; renaming = false; save();
    $('who-menu').hidden = true; renderTop();
    toast('改名成功：「' + old + '」→「' + v + '」。剧情和名片里都会用新名字。');
  });
  /* ---------- 主角性别：创建账号时选，之后在右上角名字菜单里可以随时换（剧情立绘、名片跟着变） ---------- */
  function gender() { return acc && acc.gender === 'f' ? 'f' : 'm'; }
  function playerArt() { return 'p' + gender(); }
  function renderGender() {
    var box = $('gender-box'); if (!box || !acc) return;
    box.innerHTML = '<b>主角形象</b><div class="gd-opts">' + [['m', '男生'], ['f', '女生']].map(function (g) {
      return '<button type="button" class="gd-opt' + (gender() === g[0] ? ' on' : '') + '" data-gender="' + g[0] + '" aria-pressed="' + (gender() === g[0]) + '"><img src="' + CHARS['p' + g[0]] + '" alt=""><span>' + g[1] + '</span></button>';
    }).join('') + '</div>';
  }
  $('gender-box').addEventListener('click', function (e) {
    e.stopPropagation();
    var b = e.target.closest('[data-gender]'); if (!b || !acc || gender() === b.dataset.gender) return;
    acc.gender = b.dataset.gender; save(); renderGender();
    toast('主角形象已换成' + (acc.gender === 'f' ? '女生' : '男生') + '。剧情立绘和名片都会跟着变。');
  });
  $('title-box').addEventListener('change', function (e) { if (e.target.name === 'title') { acc.title = e.target.value || null; save(); renderTitle(); } });
  $('title-box').addEventListener('click', function (e) { e.stopPropagation(); });
  $('btn-reset').addEventListener('click', function () {
    if (!ui.resetArmed) { ui.resetArmed = 1; this.classList.add('armed'); this.textContent = '确定重置？再点一次'; return; }
    acc = null; try { localStorage.removeItem(KEY); } catch (e) {}
    ui = { sel: null, pick: -1, ob: { step: 1, name: '', starter: null }, f: { type: '', min: 1, max: 100, sort: 'lvd' }, resetArmed: 0, welcome: false };
    stopTimers(); fields = {}; ex.view = 'planets'; ex.mode = null;
    $('who-menu').hidden = true; page = 'arena'; savePage(); renderTop();
  });

  /* ---------- 创建账号：输入名字 → 直接进入省实验中学序章，在张老师指引下挑选精灵 ---------- */
  function clip(v) { return Array.from(v).slice(0, NAME_MAX).join(''); }
  function renderOnboard() {
    var ob = ui.ob, el = $('onboard');
    if (acc && !acc.introDone) { if (ex.mode !== 'intro' || !$('vn')) startVN('school', 'intro', el, false); return; }
    el.innerHTML = '<div class="onboard"><span class="tape l"></span><span class="tape r"></span>' +
      '<h2>欢迎来到 Flame1Down - 1</h2>' +
      '<p>请先创建账号。选择主角的性别，再给自己起一个做题家名字，最多 ' + NAME_MAX + ' 个字。</p>' +
      '<div class="ob-gender" role="radiogroup" aria-label="性别">' + [['m', '男生'], ['f', '女生']].map(function (g) {
        return '<button type="button" class="ob-g' + ((ob.gender || 'm') === g[0] ? ' on' : '') + '" role="radio" aria-checked="' + ((ob.gender || 'm') === g[0]) + '" data-obg="' + g[0] + '"><img src="' + CHARS['p' + g[0]] + '" alt=""><b>' + g[1] + '</b></button>';
      }).join('') + '</div>' +
      '<form class="namebox" id="ob-form"><input id="ob-name" type="text" autocomplete="off" spellcheck="false" placeholder="输入做题家名字" aria-label="做题家名字" value="' + esc(ob.name) + '">' +
      '<span class="cnt" id="ob-cnt"></span><button class="btn primary" id="ob-next" type="submit">开始</button></form>' +
      '<p class="hint" id="ob-msg">名字会显示在页面最上方，也会出现在剧情对话里。</p></div>';
    var inp = $('ob-name');
    var sync = function () {
      var v = clip(inp.value); if (v !== inp.value) inp.value = v; ob.name = v;
      var n = Array.from(v.trim()).length; $('ob-cnt').textContent = Array.from(v).length + ' / ' + NAME_MAX; $('ob-next').disabled = !n;
    };
    inp.addEventListener('input', sync); sync();
    $('ob-form').addEventListener('submit', function (e) { e.preventDefault(); if (!ob.name.trim()) return; createAccount(ob.name.trim()); });
    el.querySelector('.ob-gender').addEventListener('click', function (e) { var b = e.target.closest('[data-obg]'); if (!b) return; ob.gender = b.dataset.obg; renderOnboard(); });
    setTimeout(function () { try { inp.focus(); } catch (er) {} }, 0);
  }
  $('onboard').addEventListener('click', function (e) { if (ex.mode === 'intro' && $('vn')) vnClick(e); });
  function createAccount(name) {
    acc = { v: 1, name: name, gender: ui.ob.gender === 'f' ? 'f' : 'm', created: Date.now(), starter: null, rival: null, next: 1, mons: [], teams: [[], []], active: 0, introDone: false, story: {}, exp: 0, energy: 0, items: {}, expV: expV() };
    save(); renderTop(); window.scrollTo(0, 0);
  }
  // 序章里选定初始精灵；Vanber 选克制主角的那只
  function rivalOf(sid) {
    var t = SPMAP[sid].types[0];
    return STARTERS.filter(function (x) { return x !== sid && eff(SPMAP[x].types[0], t) > 1; })[0] || STARTERS.filter(function (x) { return x !== sid; })[0];
  }
  function pickStarter(sid) {
    acc.starter = sid; acc.rival = rivalOf(sid);
    var m = newMon(sid, START_LV); acc.teams[0] = [m.u]; acc.active = 0; ui.sel = m.u; save();
  }
  function finishIntro() {
    acc.introDone = true; ex.mode = null; ex.view = 'planets'; stopTimers(); save();
    $('onboard').innerHTML = '';
    ui.welcome = true; page = 'bag'; savePage(); renderTop(); window.scrollTo(0, 0);
  }

  /* ---------- 共用：精灵卡片、资料面板 ---------- */
  function monCard(m, cls, extra) {
    var f = form(m), s = SPMAP[m.sid];
    return '<span class="cimg"><img src="' + f.img + '" alt="">' + (m.shiny ? '<span class="shiny-tag">异色</span>' : '') + '</span><span class="nm">' + esc(f.name) + '</span><span class="lv">LV' + m.lv + '</span><span class="tc">' + tchips(s.types) + '</span>' + (extra || '');
  }
  function evoLine(m) {
    var s = SPMAP[m.sid], st = stageOf(s, m.lv);
    return '<div class="evo-line">' + s.evo.map(function (e, i) {
      var n = formRawName(s, i); n = n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i);
      if ((s.placeholder || s.tbdForms) && i > 0) n = '？';
      return (i ? '<span>→ LV' + e.lv + ' →</span>' : '') + '<b class="' + (i === st ? 'cur' : '') + '">' + esc(n) + '</b>';
    }).join('') + '</div>';
  }
  function monDetail(m) {
    if (!m) return '<p class="empty-note">点击一只精灵查看资料、配置技能。</p>';
    var s = SPMAP[m.sid], f = form(m), a = avail(m.sid, m.lv, m.hl || []), n = m.moves.length, ts = teamsOf(m.u);
    var free = m.evFree || 0, sum = evSum(m), stats = '', iv = ivOf(m), ivSum = iv ? STAT_KEYS.reduce(function (a, k) { return a + iv[k]; }, 0) : 0;
    STAT_KEYS.forEach(function (k) {
      var b = s.base[k], v = stat(m, k), ev = (m.ev && m.ev[k]) || 0, nm = natureMult(m.nat, k), room = Math.min(free, EV_MAX - ev, EV_TOTAL - sum);
      stats += '<span>' + BASE_NAME[k] + '</span><span class="sv' + (nm > 1 ? ' up' : nm < 1 ? ' dn' : '') + '" title="' + (nm > 1 ? '性格加成 +10%' : nm < 1 ? '性格修正 −10%' : '') + '">' + v + (nm > 1 ? '↑' : nm < 1 ? '↓' : '') + '</span>' +
        '<span class="bar"><i style="width:' + Math.min(100, b / 150 * 100) + '%"></i></span><span class="real"><span class="bs">种族值 ' + b + (iv ? ' · ' : '') + '</span>' + (iv ? '<span class="ivv' + (iv[k] >= 31 ? ' max' : iv[k] >= 26 ? ' hi' : iv[k] <= 5 ? ' lo' : '') + '" title="天赋 0~31，越高越强">天赋 ' + iv[k] + '</span>' : '') + '</span>' +
        '<span class="evc">' +
        '<b title="学习力 ' + ev + ' / ' + EV_MAX + '，能力值 +' + Math.floor(ev / 10) + '">' + ev + '<small>+' + Math.floor(ev / 10) + '</small></b>' +
        '<button type="button" data-ev="' + k + '" data-d="1"' + (room > 0 ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 +1">+1</button><button type="button" data-ev="' + k + '" data-d="10"' + (room > 0 ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 +10">+10</button></span>';
    });
    stats = '<div class="nat"><b>性格 · ' + m.nat + '</b><span>' + natText(m.nat) + '</span></div>' +
      '<div class="evhead"><b>学习力</b><span>可分配 <b class="' + (free ? 'red' : '') + '">' + free + '</b> · 已分配 ' + sum + ' / ' + EV_TOTAL + '</span><span class="hint">每 10 点学习力 = 1 点能力值，单项最多 ' + EV_MAX + '。战斗胜利后，出战过的精灵各得 1 点。<b>已经分配的学习力不能退回</b>，想好再加。</span></div>' +
      (iv ? '<div class="ivhead"><b>天赋</b><span>合计 ' + ivSum + ' / 186 ' + gradeTag(m) + '</span><span class="hint">每项能力的天赋是 0~31 的随机数，越高越强。用「天赋重组合剂」可以把六项天赋全部重新随机。合计 0~89 一般，90~119 良，120~149 优，150~169 稀，170 以上极品。</span></div>' : '') +
      '<div class="stats evstats">' + stats + '<span class="sum">实际能力值 = LV' + m.lv + ' 的数值（受种族值和天赋影响） + 学习力加成，再乘性格修正' + (s.placeholder ? ' · 数值为占位' : s.unsure && s.unsure.length >= 6 ? ' · 种族值暂定' : '') + '</span></div>';
    var row = function (mv) {
      var M_ = M[mv], on = m.moves.indexOf(mv) >= 0, ok = a.indexOf(mv) >= 0, id = 'am-' + m.u + '-' + mv;
      var meta = M_.cat + (M_.power ? ' · 威力' + M_.power : '') + (M_.pri ? ' · 先制+' + M_.pri : '') + ' · PP' + M_.pp;
      return '<label class="mrow' + (on ? ' on' : '') + (M_.hidden ? ' hid' : '') + (ok ? '' : ' locked') + '" for="' + id + '">' +
        '<input type="checkbox" id="' + id + '" data-amove="' + mv + '"' + (on ? ' checked' : '') + (ok ? '' : ' disabled') + '>' +
        '<span class="l1"><span class="mn">' + M_.name + '</span>' + atkTip(M_.type) + '<span class="mm">' + meta + '</span>' +
        (M_.hidden ? '<span class="tag sc hidtag" tabindex="0">隐藏<span class="tip" role="tooltip"><b>隐藏技能</b>' + (LEARN[mv] ? '在战斗中领悟的特殊技能，精灵要到 LV' + HIDDEN_MIN_LV + ' 以上才能领悟' : '达到 LV50 时习得') + '</span></span>' : '') +
        (ok ? '' : '<span class="lock">LV' + moveLv(m.sid, mv) + ' 习得</span>') + '</span><span class="md">' + esc(M_.d) + '</span></label>';
    };
    var acts = acc.teams.map(function (t, i) {
      var k = t.indexOf(m.u);
      if (k >= 0) return (k > 0 ? '<button class="btn" type="button" data-lead="' + i + '">设为' + TEAM_NAME[i] + '首发</button>' : '') + '<button class="btn ghost" type="button" data-out="' + i + '">移出' + TEAM_NAME[i] + '</button>';
      return '<button class="btn primary" type="button" data-in="' + i + '"' + (t.length >= TEAM_SIZE ? ' disabled title="' + TEAM_NAME[i] + '已满 5 只"' : '') + '>加入' + TEAM_NAME[i] + '</button>';
    }).join('');
    return '<span class="tape r"></span>' +
      '<div class="d-head"><button type="button" class="d-art" data-abig="' + m.sid + '|' + f.stage + '" title="点击查看大图" aria-label="查看' + esc(f.name) + '的大图"><img src="' + f.img + '" alt="' + esc(f.name) + '"></button><div>' +
      '<h3>' + (f.no ? '<span class="dexno">No.' + f.no + '</span>' : '') + esc(f.name) + (f.unsure ? '<i class="q" title="字迹没看清">?</i>' : '') + (m.shiny ? '<span class="shiny-tag big" title="异色精灵：和同类长得不一样的稀有配色">异色</span>' : '') + '</h3>' +
      '<p style="margin:0 0 6px"><span class="lvbig">LV' + m.lv + '</span>' + tchips(s.types) + '</p>' +
      '<p class="hint">' + stageLabel(s, f.stage) + (!isFin(s, f.stage) ? ' · 最终进化为' + (s.placeholder || s.tbdForms ? '？' : s.name) : '') +
      (ts.length ? ' · ' + ts.map(function (x) { return TEAM_NAME[x.t] + (x.lead ? '首发' : ''); }).join('、') : ' · 未加入配队') + '</p>' +
      (f.d ? '<p class="formdesc">' + esc(f.d) + '</p>' : '') + evoLine(m) + (s.placeholder ? '<p class="placeholder-note" style="margin-top:6px">数值和技能还是占位，二阶和最终形态还没画出来</p>' : s.tbdForms ? '<p class="placeholder-note" style="margin-top:6px">二阶和最终形态还没画出来</p>' : '') + '</div></div>' +
      expBox(m) + stats +
      '<div class="trait"><p><b>特性 · ' + esc(s.ability.n) + '</b>　<span class="blue">' + esc(s.ability.d) + '</span></p>' + (s.ability.extra ? '<p class="blue" style="font-size:13px">' + esc(s.ability.extra) + '</p>' : '') +
      (acc.emblems && acc.emblems[m.sid] && EMBLEMS[m.sid] ? '<p><b>纹章 · ' + EMBLEMS[m.sid].m + '</b>　<span class="blue">' + esc(EMBLEMS[m.sid].d) + '</span></p>' : '') + '</div>' +
      monItemsHTML(m) +
      '<div><div class="moves-head"><h4>出战技能 <span class="' + (n === 4 ? 'blue' : 'red') + '">' + n + '/4</span></h4>' +
      '<span class="hint">普通技能 LV1 学会第 1 个，之后每 5 级学会一个；隐藏技能要在战斗中满足特定条件才能领悟</span></div>' +
      '<div class="mlist">' + s.moves.concat(s.hidden).filter(function (mv) { return a.indexOf(mv) >= 0; }).map(row).join('') + '</div>' + nextMoveHint(m) + '</div>' +
      '<div class="d-actions">' + acts + '</div>';
  }
  // 下一个技能在几级学会（不透露技能名）
  function nextMoveHint(m) {
    var s = SPMAP[m.sid], nx = 0;
    for (var i = 0; i < s.moves.length; i++) if (m.lv < learnLv(i)) { nx = learnLv(i); break; }
    if (!nx && m.lv < 50 && s.hidden.some(function (n) { return !LEARN[n]; })) nx = 50;
    return nx ? '<p class="hint" style="margin-top:6px">下一个技能将在 LV' + nx + ' 学会。</p>' : '';
  }
  function onDetailChange(e) {
    var cb = e.target.closest('input[data-amove]'); if (!cb) return;
    var m = mon(ui.sel); if (!m) return;
    var n = cb.dataset.amove;
    if (cb.checked) { if (m.moves.length >= 4) { cb.checked = false; flash('最多带 4 个技能，先取消一个'); return; } m.moves.push(n); }
    else m.moves.splice(m.moves.indexOf(n), 1);
    save(); renderTop();
  }
  function onDetailClick(e) {
    var m = mon(ui.sel); if (!m) return;
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.abig) { var q = b.dataset.abig.split('|'); H.big(q[0], +q[1]); return; }
    if (b.dataset.ev) {
      var k = b.dataset.ev, d = +b.dataset.d, ev = m.ev[k] || 0, free = m.evFree || 0;
      d = d > 0 ? Math.min(d, free, EV_MAX - ev, EV_TOTAL - evSum(m)) : 0;   // 已分配的学习力不能退回
      if (d > 0) { m.ev[k] = ev + d; m.evFree = free - d; }
      save(); renderTop(); return;
    }
    if (b.dataset.muse) {
      var ns = b.closest('.md-it') && b.closest('.md-it').querySelector('[data-mnat]'), r = applyMonItem(b.dataset.muse, m, ns && ns.value);
      toast(r.msg); if (r.ok) renderTop(); return;
    }
    if (b.dataset.in != null) { var t = acc.teams[+b.dataset.in]; if (t.length < TEAM_SIZE && t.indexOf(m.u) < 0) t.push(m.u); }
    else if (b.dataset.out != null) { var t2 = acc.teams[+b.dataset.out]; t2.splice(t2.indexOf(m.u), 1); }
    else if (b.dataset.lead != null) { var t3 = acc.teams[+b.dataset.lead]; t3.splice(t3.indexOf(m.u), 1); t3.unshift(m.u); }
    else if (b.dataset.give) {
      var need = expAt(Math.min(MAX_LV, m.lv + 1)) - m.exp, amt;
      if (b.dataset.give === 'lv') amt = need; else if (b.dataset.give === 'all') amt = acc.exp; else if (b.dataset.give === 'in') amt = Math.floor(+$('exp-in').value) || 0; else amt = +b.dataset.give;
      if (!acc.exp) { ui.expMsg = { u: m.u, t: '经验背包里没有经验了。', bad: 1 }; renderTop(); return; }
      if (amt <= 0) { ui.expMsg = { u: m.u, t: '请输入要分配的经验数量。', bad: 1 }; renderTop(); return; }
      if (amt > acc.exp) { ui.expMsg = { u: m.u, t: '经验不足：经验背包里只有 ' + fmt(acc.exp) + ' 点。', bad: 1 }; renderTop(); return; }
      var r = giveExp(m, amt); ui.expMsg = { u: m.u, t: r || '已经是最高等级了。', bad: !r };
    } else return;
    save(); renderTop();
  }
  function expBox(m) {
    var maxed = m.lv >= MAX_LV, cur = m.exp - expAt(m.lv), span = maxed ? 1 : expAt(m.lv + 1) - expAt(m.lv), need = maxed ? 0 : expAt(m.lv + 1) - m.exp;
    var room = expAt(MAX_LV) - m.exp, msg = ui.expMsg && ui.expMsg.u === m.u ? ui.expMsg : null;
    return '<div class="expbox"><div class="exp-head"><h4>经验</h4><span class="hint">经验背包：<b class="blue">' + fmt(acc.exp) + '</b> 点</span></div>' +
      '<div class="exp-bar"><i style="width:' + (maxed ? 100 : Math.min(100, cur / span * 100)) + '%"></i></div>' +
      '<p class="exp-txt">LV' + m.lv + (maxed ? ' · 已达最高等级' : ' · 本级 ' + fmt(cur) + ' / ' + fmt(span) + ' · 距 LV' + (m.lv + 1) + ' 还需 <b>' + fmt(need) + '</b>') + ' · 累计 ' + fmt(m.exp) + '</p>' +
      (maxed ? '' : '<div class="exp-ctl"><button type="button" class="btn" data-give="lv"' + (acc.exp >= need ? '' : ' disabled') + '>升 1 级（' + fmt(need) + '）</button>' +
        '<button type="button" class="btn ghost" data-give="100"' + (acc.exp >= 100 && room >= 100 ? '' : ' disabled') + '>+100</button>' +
        '<button type="button" class="btn ghost" data-give="all"' + (acc.exp ? '' : ' disabled') + '>全部分配</button>' +
        '<span class="exp-in"><input type="number" id="exp-in" min="1" step="1" max="' + Math.min(acc.exp, room) + '" placeholder="数量" inputmode="numeric" aria-label="分配的经验数量"><button type="button" class="btn primary" data-give="in"' + (acc.exp ? '' : ' disabled') + '>分配</button></span></div>') +
      (msg ? '<p class="exp-msg' + (msg.bad ? ' red' : '') + '">' + esc(msg.t) + '</p>' : '') + '</div>';
  }
  function flash(t) { var el = document.querySelector('.page:not([hidden]) .flash'); if (el) { el.textContent = t; el.classList.add('red'); } }

  /* ---------- 道具与储存箱 ----------
   * 精灵道具：直接用在某只精灵身上的（USE_ITEMS，kind：nat 改性格，ev 加学习力），在精灵资料里就能调出来用，储存箱里也能用
   * 一般道具：捕捉装置、补药（对战中用）、改名卡、自律训练装置、挑战许可
   * 储存箱（主菜单，黄冈秘鉴和社交中间）列出所有道具 */
  var USE_ITEMS = {
    ivReroll: { name: '天赋重组合剂', sid: null, kind: 'iv', d: '把你的任意一只精灵的六项天赋（0~31）全部重新随机。新的天赋可能更高，也可能更低。' },
    natTagore: { name: '泰戈尔性格药剂', sid: 'tagore', kind: 'nat', d: '把你的一只泰戈尔（小胖虎、胖虎也可以）的性格改成你指定的性格。' },
    evAny: { name: '通用学习力合剂', sid: null, kind: 'ev', d: '为你的任意一只精灵直接增加 100 点学习力。加进「可分配学习力」，再在精灵资料里自己分配；学习力总量最多 ' + EV_TOTAL + '。' },
    evTagore: { name: '泰戈尔学习力合剂', sid: 'tagore', kind: 'ev', d: '为你的一只泰戈尔（小胖虎、胖虎也可以）直接增加 100 点学习力。加进「可分配学习力」，再在精灵资料里自己分配；学习力总量最多 ' + EV_TOTAL + '。' },
    // 竞技代币商店（2026-10-14）
    ivMoon: { name: '小月亮专属天赋重置药剂', sid: 'moon', kind: 'iv2', d: '只能用在小月亮（朔望月灵也可以）身上。把六项天赋全部重新随机，每一项都会掷两次、取较高的一次，比普通的天赋重组合剂更容易出高天赋。', none: '你还没有小月亮。平衡排位第一次达到铂金时会送一只。' },
    ivBone: { name: '凶骨专属天赋重置药剂', sid: 'bone', kind: 'iv2', d: '只能用在凶骨（骨刃一系都可以）身上。把六项天赋全部重新随机，每一项都会掷两次、取较高的一次，比普通的天赋重组合剂更容易出高天赋。', none: '你还没有凶骨。平衡排位第一次达到王者时会送一只。' },
    natAny: { name: '性格胶囊', sid: null, kind: 'nat', d: '把你的任意一只精灵的性格改成你指定的性格。' },
    evReset: { name: '学习力重置胶囊', sid: null, kind: 'evreset', d: '把一只精灵已经分配的学习力全部退回「可分配学习力」，可以重新分配。' },
    fruit1: { name: '成长果实', sid: null, kind: 'exp', rate: 100, d: '给一只精灵直接增加经验：等级 × 100 点（LV30 吃一颗得 3,000 点）。等级越高，得到的经验越多。' },
    fruit2: { name: '迅速成长果实', sid: null, kind: 'exp', rate: 250, d: '给一只精灵直接增加经验：等级 × 250 点（LV30 吃一颗得 7,500 点）。比成长果实效果更好。' },
    // 瘴气驱逐战（2026-10-17）：100 个让芙罗拉星三种精灵领悟一个隐藏技能
    deathTok: { name: '死神代币', sid: null, sids: ['pluto'], kind: 'jade', cost: 1, d: '击败先驱之塔第 60 层的死神获得，一个账号最多 3 颗。1 颗可以让帕努托尔一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能；先驱之塔的代币商店里，兑换「帕努托尔的精元」也要用到它。', none: '你还没有帕努托尔。在先驱之塔的代币商店里，用 3000 先驱代币 + 1 颗死神代币可以兑换「帕努托尔的精元」。' },
    floraJade: { name: '芙罗拉玉', sid: null, sids: ['mush', 'wind', 'kaleo'], kind: 'jade', cost: 100, d: '芙罗拉星深处凝成的绿色玉石。100 个可以让玛西露姆、六尾风王、卡莱奥丹一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能，不用再满足战斗里的领悟条件。隐藏技能要到 LV' + HIDDEN_MIN_LV + ' 才能装备。瘴气驱逐战的全服奖励会发放；芙罗拉星的丛林、草甸里，每天也有机会捡到少量。', none: '你还没有玛西露姆、六尾风王或卡莱奥丹（进化前的形态也算）。去芙罗拉星的丛林、草甸捕捉吧。' }
  };
  var MON_ORDER = ['floraJade', 'deathTok', 'ivMoon', 'ivBone', 'ivReroll', 'evAny', 'evTagore', 'natAny', 'natTagore', 'evReset', 'fruit1', 'fruit2'], GEN_ORDER = ['trans', 'helmet', 'auto', 'rename', 'cap1', 'cap2', 'cap3', 'pot1', 'pot2', 'pot200'];
  // 剧情道具：主线里拿到的，不能使用也不会消耗
  var KEY_ITEMS = {
    trans: { name: '精灵翻译器', d: '汉街总部国际A座的情报显示，这个翻译器能凭一己之力考到雅思 6.5 分。这样一来，翻译精灵的语言也一定能行吧……', img: 'translator' },
    helmet: { name: '烟雾保护头盔', d: 'Bttp 用无人机空投下来的头盔，戴上后在浓密的瘴气里也能呼吸、看清路。很容易摔坏。', img: 'helmet' }
  };
  // 野外采集物：每个区域 2 个采集点，每个点每天 1 次。星砂做加强装置，星核做华为装置。
  var GATHER_ITEMS = {
    g_sand: { name: '星砂', d: '从星球表面收来的矿砂，冶炼坊用来装配加强捕捉装置。', from: '芙罗拉星的丛林和草甸、坎布尔星的环礁浅海、庞贝星的熔岩原', n: 12 },
    g_core: { name: '星核', d: '雷暴和永冻里凝出来的核，四颗可以合成一个华为捕捉装置。', from: '莱汀陨石带的雷暴陨石群、白之星的永冻冰原', n: 1 }
  };
  var GATHER_ORDER = ['g_sand', 'g_core'];
  // 精灵素材：旅行精灵掉落的叶片，以及合成出来的精元（精元放进神农架 · 精灵保育仓孵化，见 NURSERY）
  var MATS = {
    m_lcleaf: { name: '叶子喵的叶片', d: '旅行精灵叶子喵身上掉下来的叶片，还带着一点光。5 片可以在冶炼坊合成叶子喵的精元。' },
    e_leafcat: { name: '叶子喵的精元', d: '用 5 片叶子喵的叶片凝成的精元。放进神农架 · 精灵保育仓，孵化 8 小时后会诞生一只叶子小小喵。', hatch: { sid: 'leafcat', lv: 1, min: 480 } }
  };
  MATS.e_pluto = { name: '帕努托尔的精元', d: '在先驱之塔的代币商店兑换的精元。放进神农架 · 精灵保育仓，孵化 12 小时后会诞生一只帕努。', hatch: { sid: 'pluto', lv: 1, min: 720 } };
  var MAT_ORDER = ['m_lcleaf', 'e_leafcat', 'e_pluto'];
  // 太空种植园只种药草。min 是成熟分钟，yield 是收获数量。收获时退回种子。
  var SEEDS = {
    s_herb: { name: '药草种子', d: '生态舱里种的药草籽。种下去要 8 小时，收获时这颗种子会退回来。', crop: 'c_herb', min: 480, yield: 50 },
    s_rice: { name: '水稻种子', d: '在芙罗拉星击败野生精灵时偶尔掉落的稻种。种下去要 12 小时，收获一大把米饭，种子会退回来。', crop: 'c_rice', min: 720, yield: 250 }
  };
  var CROPS = {
    c_herb: { name: '药草', d: '太空种植园收获的药草。两份可以在冶炼坊合成一瓶 200血药。' },
    c_rice: { name: '米饭', d: '水稻收获后煮好的米饭，一粒一粒数得清。500 粒可以在冶炼坊盛成一碗饭。' },
    c_bowl: { name: '一碗饭', d: '满满一碗香喷喷的米饭。拿到庞贝星的熔岩原，放在一个场景里，说不定会引来爱吃米饭的精灵。' }
  };
  var SEED_ORDER = ['s_herb', 's_rice'];
  var CROP_ORDER = ['c_herb', 'c_rice', 'c_bowl'];
  var BAG_ORDER = MON_ORDER.concat(GEN_ORDER);
  function itemFits(k, m) { var it = USE_ITEMS[k]; return !!(it && m && (it.sids ? it.sids.indexOf(m.sid) >= 0 : !it.sid || it.sid === m.sid)); }
  function jadeMoves(m) { return SPMAP[m.sid].hidden.filter(function (n) { return (m.hl || []).indexOf(n) < 0; }); }
  // 把精灵道具用在 m 身上；nat 是性格药剂要改成的性格。返回 { ok, msg }
  function applyMonItem(k, m, nat) {
    var it = USE_ITEMS[k];
    if (!it || !(acc.items[k] > 0)) return { ok: false, msg: '没有这个道具了。' };
    if (!itemFits(k, m)) return { ok: false, msg: '先选一只' + (it.sids ? it.sids.map(function (x) { return SPMAP[x].name; }).join('、') : it.sid ? SPMAP[it.sid].name : '精灵') + '。' };
    if (it.kind === 'jade') {
      if (acc.items[k] < it.cost) return { ok: false, msg: it.name + '不够：需要 ' + it.cost + ' 个，你现在有 ' + acc.items[k] + ' 个。' };
      var left = jadeMoves(m); if (!left.length) return { ok: false, msg: form(m).name + ' 已经领悟了全部隐藏技能。' };
      if (left.indexOf(nat) < 0) nat = left[0];
      if (!Array.isArray(m.hl)) m.hl = []; m.hl.push(nat); acc.items[k] -= it.cost; save();
      return { ok: true, msg: form(m).name + ' 领悟了隐藏技能「' + nat + '」！' + (m.lv >= HIDDEN_MIN_LV ? '在精灵资料的技能栏里就能装备。' : '到 LV' + HIDDEN_MIN_LV + ' 后就能在技能栏里装备。') };
    }
    if (it.kind === 'nat') {
      if (!nat || !(nat in NATURES)) return { ok: false, msg: '先选一个性格。' };
      if (nat === m.nat) return { ok: false, msg: '它已经是「' + nat + '」性格了，换一个吧。' };
      var old = m.nat; m.nat = nat; acc.items[k]--; save();
      return { ok: true, msg: form(m).name + ' 的性格从「' + old + '」变成了「' + nat + '」（' + natText(nat) + '）。' };
    }
    if (it.kind === 'iv' || it.kind === 'iv2') {
      var o = ivOf(m), n = randIv();
      if (it.kind === 'iv2') { var n2 = randIv(); STAT_KEYS.forEach(function (x) { n[x] = Math.max(n[x], n2[x]); }); }   // 专属药剂：每项掷两次取高
      m.iv = n; acc.items[k]--; save();
      return { ok: true, msg: form(m).name + ' 的天赋重组了：' + STAT_KEYS.map(function (x) { return BASE_NAME[x] + ' ' + (o ? o[x] + '→' : '') + n[x]; }).join('，') + '。' };
    }
    if (it.kind === 'exp') {
      var amt = m.lv * it.rate, r0 = gainExp(m, amt);
      if (!r0) return { ok: false, msg: '这只已经满级了，吃不下了。' };
      acc.items[k]--; save(); renderTitle();
      return { ok: true, msg: r0 };
    }
    if (it.kind === 'evreset') {
      var back = evSum(m);
      if (!back) return { ok: false, msg: '这只还没有分配过学习力。' };
      m.evFree = (m.evFree || 0) + back; m.ev = {}; acc.items[k]--; save();
      return { ok: true, msg: form(m).name + ' 已分配的 ' + back + ' 点学习力全部退回，现在有 ' + m.evFree + ' 点可分配学习力，在精灵资料的「学习力」一栏重新分配。' };
    }
    var add = Math.min(100, evRoom(m));
    if (!add) return { ok: false, msg: '这只的学习力已经到上限了。' };
    m.evFree = (m.evFree || 0) + add; acc.items[k]--; save();
    return { ok: true, msg: form(m).name + ' 获得了 ' + add + ' 点可分配学习力' + (add < 100 ? '（已到 ' + EV_TOTAL + ' 上限）' : '') + '，在精灵资料的「学习力」一栏分配。' };
  }
  // 精灵资料里的「精灵道具」：只列出能用在这只精灵身上、手里有的
  function monItemsHTML(m) {
    var ks = MON_ORDER.filter(function (k) { return acc.items[k] > 0 && itemFits(k, m); });
    if (!ks.length) return '';
    return '<div class="md-items"><h4>精灵道具 <span class="hint">直接用在' + esc(form(m).name) + '身上</span></h4>' + ks.map(function (k) {
      var it = USE_ITEMS[k], act;
      if (it.kind === 'jade') { var jl = jadeMoves(m), jok = jl.length && acc.items[k] >= it.cost; act = jl.length ? '<select data-mnat="1" aria-label="要领悟的隐藏技能">' + jl.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') + '</select><button type="button" class="btn" data-muse="' + k + '"' + (jok ? '' : ' disabled title="需要 ' + it.cost + ' 个"') + '>' + (jok ? '用 ' + it.cost + ' 个领悟' : '需要 ' + it.cost + ' 个') + '</button>' : '<button type="button" class="btn" disabled>隐藏技能已全部领悟</button>'; }
      else if (it.kind === 'nat') act = '<select data-mnat="1" aria-label="新的性格">' + NAT_KEYS.filter(function (n) { return n !== m.nat; }).map(function (n) { return '<option value="' + n + '">' + n + '（' + natText(n) + '）</option>'; }).join('') + '</select><button type="button" class="btn" data-muse="' + k + '">改性格</button>';
      else if (it.kind === 'iv' || it.kind === 'iv2') act = '<button type="button" class="btn" data-muse="' + k + '">使用 · 重组天赋</button>';
      else if (it.kind === 'exp') act = '<button type="button" class="btn" data-muse="' + k + '"' + (m.lv >= MAX_LV ? ' disabled' : '') + '>' + (m.lv >= MAX_LV ? '已满级' : '使用 · +' + fmt(m.lv * it.rate) + ' 经验') + '</button>';
      else if (it.kind === 'evreset') act = '<button type="button" class="btn" data-muse="' + k + '"' + (evSum(m) ? '' : ' disabled') + '>' + (evSum(m) ? '使用 · 退回 ' + evSum(m) + ' 点' : '没有分配过学习力') + '</button>';
      else { var room = evRoom(m); act = '<button type="button" class="btn" data-muse="' + k + '"' + (room ? '' : ' disabled title="学习力已经到上限了"') + '>' + (room ? '使用 · +' + Math.min(100, room) + ' 学习力' : '学习力已满') + '</button>'; }
      return '<div class="md-it"><b>' + it.name + ' <span class="cnt">×' + acc.items[k] + '</span></b><span class="hint">' + esc(it.kind === 'jade' ? '每 ' + it.cost + ' 个领悟一个隐藏技能' : it.kind === 'nat' ? '把性格改成你选的性格' : it.kind === 'iv' ? '六项天赋全部重新随机' : it.kind === 'iv2' ? '六项天赋重新随机，每项掷两次取高' : it.kind === 'exp' ? '直接增加等级 × ' + it.rate + ' 点经验' : it.kind === 'evreset' ? '已分配的学习力全部退回' : '直接增加 100 点可分配学习力') + '</span><span class="md-act">' + act + '</span></div>';
    }).join('') + '</div>';
  }
  function growText(min) { return min >= 60 && min % 60 === 0 ? (min / 60) + ' 小时' : min + ' 分钟'; }
  function itemName(k) { var it = ITEMS[k] || USE_ITEMS[k] || SHOP_X[k] || TEA_SHOP[k] || KEY_ITEMS[k] || GATHER_ITEMS[k] || SEEDS[k] || CROPS[k] || MATS[k]; return it ? it.name : k; }
  function evRoom(m) { return Math.max(0, EV_TOTAL - evSum(m) - (m.evFree || 0)); }
  function itemsHTML() {
    var have = BAG_ORDER.filter(function (k) { return acc.items[k] > 0; }), gHave = GATHER_ORDER.filter(function (k) { return acc.items[k] > 0; }), sHave = SEED_ORDER.filter(function (k) { return acc.items[k] > 0; }), cHave = CROP_ORDER.filter(function (k) { return acc.items[k] > 0; }), mHave = MAT_ORDER.filter(function (k) { return acc.items[k] > 0; }), wk = weeklyOpen(), pn = wk ? permits() : 0;
    if (ui.itSel && ui.itSel !== 'permit' && have.indexOf(ui.itSel) < 0 && gHave.indexOf(ui.itSel) < 0 && sHave.indexOf(ui.itSel) < 0 && cHave.indexOf(ui.itSel) < 0 && mHave.indexOf(ui.itSel) < 0) ui.itSel = null;
    if (ui.itSel === 'permit' && !wk) ui.itSel = null;
    var cell = function (k) {
      var use = !!USE_ITEMS[k] || k === 'rename' || k === 'auto';
      var kimg = KEY_ITEMS[k] && KEY_ITEMS[k].img && ITEM_IMG[KEY_ITEMS[k].img];
      return '<button type="button" class="ib-it' + (ui.itSel === k ? ' sel' : '') + (use ? ' use' : '') + (kimg ? ' key' : '') + '" data-itsel="' + k + '">' + (kimg ? '<img class="ib-img" src="' + kimg + '" alt="">' : '') + '<b>' + itemName(k) + '</b><span class="cnt">×' + acc.items[k] + '</span>' + (USE_ITEMS[k] ? '<small>精灵道具 · 可使用</small>' : KEY_ITEMS[k] ? '<small>剧情道具</small>' : GATHER_ITEMS[k] ? '<small>采集物</small>' : SEEDS[k] ? '<small>种子</small>' : CROPS[k] ? '<small>作物</small>' : use ? '<small>可使用</small>' : '<small>对战中使用</small>') + '</button>';
    };
    var monCells = have.filter(function (k) { return USE_ITEMS[k]; }).map(cell), genCells = have.filter(function (k) { return !USE_ITEMS[k]; }).map(cell);
    if (wk) genCells.unshift('<button type="button" class="ib-it permit' + (ui.itSel === 'permit' ? ' sel' : '') + '" data-itsel="permit"><b>挑战许可</b><span class="cnt">' + pn + ' / ' + PERMIT.max + '</span><small>每周挑战用</small></button>');
    var html = '<section class="itembox"><span class="tape r"></span><div class="ib-head"><h3>精灵道具</h3><span class="hint">直接用在精灵身上的道具。也可以在精灵背包、精灵仓库里点开一只精灵，在它的资料里直接使用。</span></div>' +
      (monCells.length ? '<div class="ib-grid">' + monCells.join('') + '</div>' : '<p class="empty-note">还没有精灵道具。排位段位奖励、首领挑战会获得学习力合剂、性格药剂；竞技代币商店也能兑换。</p>') +
      '<div class="ib-head"><h3>一般道具</h3><span class="hint">捕捉装置和补药在剧情、野外、首领对战的「道具」页使用；改名卡、自律训练装置点开后使用。</span></div>' +
      (genCells.length ? '<div class="ib-grid">' + genCells.join('') + '</div>' : '<p class="empty-note">还没有一般道具。在荆楚号 · 荆门 · 物资仓储的商城可以兑换。</p>') +
      '<div class="ib-head"><h3>采集物</h3><span class="hint">野外采集点每天可以采集 1 次。芙罗拉、坎布尔、庞贝每个点得到星砂 ×12；莱汀、白之星每个点得到星核 ×1。拿到黄石 · 冶炼坊合成捕捉装置。</span></div>' +
      (gHave.length ? '<div class="ib-grid">' + gHave.map(cell).join('') + '</div>' : '<p class="empty-note">还没有采集物。进入丛林、草甸等区域，点场景里固定的采集点。</p>') +
      '<div class="ib-head"><h3>种子</h3><span class="hint">第一次在芙罗拉星的丛林或草甸采集时得到 4 颗药草种子；在芙罗拉星击败野生精灵，每只有 10% 的概率掉落水稻种子。种在恩施 · 太空种植园（读完支线「伟大的种植园」后开放），收获时种子会退回。</span></div>' +
      (sHave.length ? '<div class="ib-grid">' + sHave.map(cell).join('') + '</div>' : '<p class="empty-note">还没有种子。去芙罗拉星的丛林或草甸采集一次。</p>') +
      '<div class="ib-head"><h3>作物</h3><span class="hint">太空种植园收获的作物。在黄石 · 冶炼坊，两份药草合成一瓶 200血药，500 粒米饭盛成一碗饭。</span></div>' +
      (cHave.length ? '<div class="ib-grid">' + cHave.map(cell).join('') + '</div>' : '<p class="empty-note">还没有作物。种子成熟后，在太空种植园收获。</p>') +
      '<div class="ib-head"><h3>精灵素材</h3><span class="hint">击败旅行精灵掉落的叶片，5 片在黄石 · 冶炼坊合成精元；精元放进神农架 · 精灵保育仓孵化。</span></div>' +
      (mHave.length ? '<div class="ib-grid">' + mHave.map(cell).join('') + '</div>' : '<p class="empty-note">还没有精灵素材。留意航行日志里的「旅行精灵」。</p>');
    var k = ui.itSel;
    if (k) {
      var it = USE_ITEMS[k], body = '';
      if (k === 'permit') body = '<p>进行「每周挑战」时消耗 1 枚。每 12 小时恢复 1 枚，最多同时持有 ' + PERMIT.max + ' 枚。</p><p class="hint">当前 ' + pn + ' 枚 · ' + permitNext() + '</p><button type="button" class="btn" data-itgo="weekly">去每周挑战</button>';
      else if (k === 'rename') body = '<p>' + esc(SHOP_X.rename.d) + '</p><button type="button" class="btn primary" data-ituse="rename">使用改名卡</button>';
      else if (k === 'auto') body = '<p>' + esc(TEA_SHOP.auto.d) + '</p><button type="button" class="btn" data-itgo="home">去我的茶室装上</button>';
      else if (ITEMS[k]) body = '<p>' + esc(ITEMS[k].d) + '</p><p class="hint">在剧情、野外和首领对战的「道具」页使用，会占用一回合。</p>';
      else if (KEY_ITEMS[k]) body = (KEY_ITEMS[k].img && ITEM_IMG[KEY_ITEMS[k].img] ? '<img class="ib-big" src="' + ITEM_IMG[KEY_ITEMS[k].img] + '" alt="">' : '') + '<p>' + esc(KEY_ITEMS[k].d) + '</p><p class="hint">剧情道具，在主线剧情里获得。不能使用，也不会消耗。</p>';
      else if (GATHER_ITEMS[k]) body = '<p>' + esc(GATHER_ITEMS[k].d) + '</p><p class="hint">在' + esc(GATHER_ITEMS[k].from) + '的采集点获得，已放入储存箱。拿到荆楚号 · 黄石 · 冶炼坊可以合成道具。</p>';
      else if (SEEDS[k]) body = '<p>' + esc(SEEDS[k].d) + '</p><p class="hint">在太空种植园种下，' + growText(SEEDS[k].min) + '后收获「' + itemName(SEEDS[k].crop) + '」×' + SEEDS[k].yield + '，并把这颗种子退回来。</p>';
      else if (MATS[k]) body = '<p>' + esc(MATS[k].d) + '</p>' + (MATS[k].hatch ? '<button type="button" class="btn" data-itgo="nursery">去精灵保育仓</button>' : '<p class="hint">击败旅行精灵叶子喵时有 50% 的概率掉落。</p>');
      else if (k === 'c_bowl') body = '<p>' + esc(CROPS[k].d) + '</p><p class="hint">在黄石 · 冶炼坊用 500 粒米饭合成。进入庞贝星 · 熔岩原，在想放的场景里点「放下一碗饭」。之后这个场景里有 2% 的概率出现稀有的米饭火鸡；捕捉或击败它之后，这碗饭就被吃掉了。</p>';
      else if (CROPS[k]) body = '<p>' + esc(CROPS[k].d) + '</p><p class="hint">在太空种植园收获，已放入储存箱。可以在冶炼坊当合成材料。</p>';
      else if (it) {
        var mons = acc.mons.filter(function (m) { return itemFits(k, m); }).sort(function (a, b) { return b.lv - a.lv; });
        if (!mons.some(function (m) { return m.u === ui.itTarget; })) ui.itTarget = mons.length ? mons[0].u : null;
        var tm = mon(ui.itTarget);
        body = '<p>' + esc(it.d) + '</p>' + (mons.length ? '<div class="it-step"><b>1. 选择精灵</b><div class="it-mons">' + mons.map(function (m) {
          var f = form(m), sub = it.kind === 'jade' ? (jadeMoves(m).length ? '还有 ' + jadeMoves(m).length + ' 个隐藏技能可领悟' : '隐藏技能已全部领悟') : it.kind === 'nat' ? '性格 ' + m.nat : it.kind === 'exp' ? (m.lv >= MAX_LV ? '已满级' : '可得 ' + fmt(m.lv * it.rate) + ' 经验') : it.kind === 'evreset' ? '已分配 ' + evSum(m) + ' 点' : it.kind === 'iv' || it.kind === 'iv2' ? '天赋合计 ' + (ivOf(m) ? STAT_KEYS.reduce(function (a, x) { return a + m.iv[x]; }, 0) : '？') : '可再加 ' + evRoom(m) + ' 点';
          return '<label class="it-mon' + (m.u === ui.itTarget ? ' on' : '') + '"><input type="radio" name="it-t" value="' + m.u + '"' + (m.u === ui.itTarget ? ' checked' : '') + '><img src="' + f.img + '" alt=""><span><b>' + esc(f.name) + '</b><small>LV' + m.lv + ' · ' + sub + '</small></span></label>';
        }).join('') + '</div></div>' +
          (it.kind === 'jade' ? (tm && jadeMoves(tm).length ? '<div class="it-step"><b>2. 选择隐藏技能</b><select id="it-nat" aria-label="要领悟的隐藏技能">' + jadeMoves(tm).map(function (n) { return '<option value="' + n + '">' + n + '（' + esc(LEARN[n] ? '原本要' + LEARN[n] : '原本 LV50 习得') + '）</option>'; }).join('') + '</select></div>' : '') + '<p class="hint">一次消耗 ' + it.cost + ' 个，你现在有 ' + acc.items[k] + ' 个。</p>'
            : it.kind === 'nat' ? '<div class="it-step"><b>2. 选择性格</b><select id="it-nat" aria-label="新的性格">' + NAT_KEYS.map(function (n) { var cur = tm && tm.nat === n, pick = ui.itNat && (!tm || ui.itNat !== tm.nat) ? ui.itNat : NAT_KEYS.filter(function (x) { return !tm || x !== tm.nat; })[0]; return '<option value="' + n + '"' + (pick === n ? ' selected' : '') + (cur ? ' disabled' : '') + '>' + n + '（' + natText(n) + '）' + (cur ? ' · 当前' : '') + '</option>'; }).join('') + '</select></div>'
            : it.kind === 'iv' || it.kind === 'iv2' ? '<p class="hint">' + (tm && ivOf(tm) ? esc(form(tm).name) + ' 现在的天赋：' + STAT_KEYS.map(function (x) { return BASE_NAME[x] + ' ' + tm.iv[x]; }).join('，') + '。' : '') + '</p>'
            : it.kind === 'exp' ? '<p class="hint">' + (tm ? esc(form(tm).name) + ' 现在 LV' + tm.lv + '，吃一颗得到 ' + fmt(tm.lv * it.rate) + ' 点经验。' : '') + '</p>'
            : '<p class="hint">' + (tm ? esc(form(tm).name) + ' 学习力：已分配 ' + evSum(tm) + '，可分配 ' + (tm.evFree || 0) + '，还能再加 ' + evRoom(tm) + ' 点。' : '') + '</p>') +
          '<button type="button" class="btn primary" data-ituse="' + k + '"' + ((it.kind === 'jade' && (!tm || !jadeMoves(tm).length || acc.items[k] < it.cost)) || (it.kind === 'ev' && tm && !evRoom(tm)) || (it.kind === 'exp' && tm && tm.lv >= MAX_LV) || (it.kind === 'evreset' && tm && !evSum(tm)) ? ' disabled' : '') + '>使用 ' + (it.cost || 1) + ' 个' + itemName(k) + '</button>'
          : '<p class="hint red">' + esc(it.none || '你还没有' + SPMAP[it.sid].name + '（小胖虎、胖虎也算）。击败简单难度的首领「泰戈尔」可以领养一只小胖虎。') + '</p>');
      }
      html += '<div class="ib-detail"><h4>' + (k === 'permit' ? '挑战许可' : itemName(k)) + '</h4>' + body + (ui.itMsg ? '<p class="exp-msg">' + esc(ui.itMsg) + '</p>' : '') + '</div>';
    }
    else if (ui.itMsg) html += '<div class="ib-detail"><p class="exp-msg">' + esc(ui.itMsg) + '</p></div>';   // 道具刚好用完：提示留着
    return html + '</section>';
  }
  function renderItems() {
    $('pg-items').innerHTML = '<div class="page-head"><h2 class="sec">储存箱</h2><p class="hint">你拥有的所有道具。点道具查看说明和使用方法。</p></div>' + itemsHTML();
  }
  function useBagItem(k) {
    if (k === 'rename') { setTimeout(function () { renaming = true; renderRename(); $('who-menu').hidden = false; $('who-btn').setAttribute('aria-expanded', true); window.scrollTo(0, 0); }, 0); return; }   // 等这次点击处理完再打开名字菜单，免得被「点别处关闭」立刻关上
    var sel = $('it-nat'), r = applyMonItem(k, mon(ui.itTarget), sel && sel.value);
    ui.itMsg = r.msg; if (r.ok) ui.itNat = null;
    renderItems(); if (r.ok) toast(r.msg);
  }

  /* ---------- 精灵背包 ---------- */
  function renderBag() {
    var el = $('pg-bag'), m = mon(ui.sel);
    var html = '<div class="page-head"><h2 class="sec">精灵背包</h2><p class="hint flash">共 ' + TEAM_N + ' 个配队，每个配队最多 ' + TEAM_SIZE + ' 只不重复的精灵。拖动精灵可调整顺序（触屏长按后拖动），排在第 1 位的为首发。</p></div>';
    if (ui.welcome) html += '<div class="welcome"><p><b>欢迎，' + esc(acc.name) + '！</b>你的初始精灵 ' + esc(form(acc.mons[0]).name) + ' 已经放进配队一，并设为当前出战配队。序章奖励的经验已存进经验背包，点击精灵即可分配。下一段剧情「江边出发」已在星际探索中解锁。</p><button class="btn" type="button" id="wel-x">知道了</button></div>';
    html += '<div class="expbag"><span class="tape l"></span><div class="eb-item"><span class="eb-lab">经验背包</span><b>' + fmt(acc.exp) + '</b><span class="hint">累积经验，可分配给任意精灵</span></div>' +
      '<div class="eb-item"><span class="eb-lab">能量</span><b class="en">' + fmt(acc.energy) + '</b><span class="hint">通用货币</span></div>' +
      '<p class="hint eb-tip">点击配队中的精灵，在下方「精灵资料」的经验一栏里分配。升到 LV' + 25 + ' / LV50 时精灵会进化。隐藏技能要靠精灵在战斗中自己领悟。</p></div>';
    html += '<div class="teams">' + acc.teams.map(function (t, i) {
      var on = acc.active === i, body = '';
      for (var k = 0; k < TEAM_SIZE; k++) {
        var u = t[k], mm = mon(u);
        if (mm) body += '<li><button type="button" class="slot filled' + (ui.sel === u ? ' sel' : '') + '" data-u="' + u + '">' + (k === 0 ? '<span class="lead">首发</span>' : '') + monCard(mm) + (mm.moves.length !== 4 ? '<span class="warn">技能 ' + mm.moves.length + '/4</span>' : '') + '</button>' +
          (ui.sel === u ? '<button type="button" class="qx" data-rmt="' + i + '" data-u="' + u + '" aria-label="移出">✕ 移出</button>' : '') + '</li>';
        else body += '<li><button type="button" class="slot addslot" data-pickt="' + i + '"><span class="plus">＋</span>添加精灵</button></li>';
      }
      var picker = '';
      if (ui.pick === i) {
        var cand = acc.mons.filter(function (x) { return t.indexOf(x.u) < 0; }).sort(function (a, b) { return b.lv - a.lv; });
        picker = '<div class="picker"><div class="picker-head"><b>从仓库选择加入' + TEAM_NAME[i] + '的精灵</b><button class="btn ghost" type="button" data-pickx="1">收起</button></div>' +
          (cand.length ? '<div class="picker-grid">' + cand.map(function (x) {
            var ts = teamsOf(x.u);
            return '<button type="button" class="dmon" data-padd="' + i + '" data-u="' + x.u + '"><img src="' + form(x).img + '" alt=""><span class="nm">' + esc(form(x).name) + '</span><span class="lv">LV' + x.lv + '</span><span class="tc">' + tchips(SPMAP[x.sid].types) + '</span>' +
              (ts.length ? '<span class="intm">已在' + ts.map(function (y) { return TEAM_NAME[y.t]; }).join('、') + '</span>' : '') + '</button>';
          }).join('') + '</div>' : '<p class="empty-note">仓库里没有可加入的精灵了。' + (acc.mons.length <= t.length ? '可以先在「精灵仓库」获取更多精灵。' : '') + '</p>') + '</div>';
      }
      return '<section class="teambox' + (on ? ' active' : '') + '"><span class="tape l"></span>' +
        '<div class="team-head"><h3>' + TEAM_NAME[i] + '</h3><span class="cnt">' + t.length + ' / ' + TEAM_SIZE + '</span>' +
        '<span class="act">' + (on ? '<span class="badge-on">当前出战</span>' : '<button class="btn" type="button" data-active="' + i + '"' + (t.length ? '' : ' disabled title="配队里至少要有 1 只精灵"') + '>设为出战配队</button>') + '</span></div>' +
        '<ol class="bag tbag" data-team="' + i + '">' + body + '</ol>' + picker + '</section>';
    }).join('') + '</div>';
    html += '<div class="page-head"><h2 class="sec">精灵资料</h2><p class="hint">点击配队里的精灵，可在此处查看资料、配置技能。完整列表和检索见「精灵仓库」。</p></div><article class="detail" id="bag-detail">' + (m ? monDetail(m) : '<p class="empty-note">点击配队里的精灵查看资料。</p>') + '</article>';
    el.innerHTML = html;
  }
  $('pg-bag').addEventListener('click', function (e) {
    if (dragJust) { e.stopPropagation(); return; }
    var t = e.target;
    if (t.id === 'wel-x') { ui.welcome = false; renderBag(); return; }
    var b = t.closest('button'); if (!b) return;
    if (b.closest('#bag-detail')) { onDetailClick(e); return; }
    if (b.dataset.rmt != null) { var tm = acc.teams[+b.dataset.rmt]; tm.splice(tm.indexOf(+b.dataset.u), 1); if (!tm.length && acc.active === +b.dataset.rmt) acc.active = acc.teams[0].length ? 0 : acc.teams[1].length ? 1 : acc.active; save(); renderBag(); return; }
    if (b.dataset.pickt != null) { ui.pick = ui.pick === +b.dataset.pickt ? -1 : +b.dataset.pickt; renderBag(); return; }
    if (b.dataset.pickx) { ui.pick = -1; renderBag(); return; }
    if (b.dataset.padd != null) { var tp = acc.teams[+b.dataset.padd], u = +b.dataset.u; if (tp.length < TEAM_SIZE && tp.indexOf(u) < 0) tp.push(u); if (tp.length >= TEAM_SIZE) ui.pick = -1; ui.sel = u; save(); renderBag(); return; }
    if (b.dataset.active != null) { acc.active = +b.dataset.active; save(); renderBag(); return; }
    if (b.classList.contains('filled')) { ui.sel = +b.dataset.u; renderBag(); }
  });
  $('pg-bag').addEventListener('change', function (e) { if (e.target.closest('#bag-detail')) onDetailChange(e); });
  $('pg-items').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.itsel) { ui.itSel = ui.itSel === b.dataset.itsel ? null : b.dataset.itsel; ui.itMsg = ''; renderItems(); return; }
    if (b.dataset.ituse) { useBagItem(b.dataset.ituse); return; }
    if (b.dataset.itgo === 'weekly') { ex.view = 'weekly'; go('explore'); return; }
    if (b.dataset.itgo === 'home') { HSACC.goHome(); return; }
    if (b.dataset.itgo === 'nursery') { ex.view = 'nursery'; ex.area = '神农架'; ex.planet = 'jingchu'; go('explore'); return; }
  });
  $('pg-items').addEventListener('change', function (e) {
    if (e.target.name === 'it-t') { ui.itTarget = +e.target.value; ui.itMsg = ''; renderItems(); return; }
    if (e.target.id === 'it-nat') ui.itNat = e.target.value;
  });

  // 配队内拖动排序（鼠标直接拖；触屏长按后拖）
  var drag = null, dragJust = false;
  function dStart() {
    var r = drag.el.getBoundingClientRect(), g = drag.el.cloneNode(true);
    g.classList.add('drag-ghost'); g.classList.remove('sel'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top; drag.ghost = g; document.body.appendChild(g);
    drag.el.classList.add('lifted'); drag.list.classList.add('dragging'); drag.on = true;
  }
  function dMove(x, y) {
    drag.ghost.style.left = (x - drag.dx) + 'px'; drag.ghost.style.top = (y - drag.dy) + 'px';
    var el = document.elementFromPoint(x, y), li = el && el.closest('li'), lis = [].slice.call(drag.list.children);
    var i = li && li.parentNode === drag.list ? lis.indexOf(li) : -1, n = acc.teams[drag.t].length;
    drag.to = i < 0 ? -1 : Math.min(i, n - 1);
    lis.forEach(function (l, k) { var sl = l.querySelector('.slot'); if (sl) sl.classList.toggle('drop-to', k === drag.to && drag.to !== drag.from); });
  }
  function dEnd(commit) {
    if (!drag) return; var d = drag; drag = null; clearTimeout(d.timer); if (!d.on) return;
    d.ghost.remove(); dragJust = true; setTimeout(function () { dragJust = false; }, 0);
    if (commit && d.to >= 0 && d.to !== d.from) { var t = acc.teams[d.t], u = t.splice(d.from, 1)[0]; t.splice(d.to, 0, u); save(); }
    renderBag();
  }
  $('pg-bag').addEventListener('pointerdown', function (e) {
    if (e.button > 0 || e.target.closest('.qx')) return;
    var sl = e.target.closest('.tbag .slot.filled'); if (!sl) return;
    var list = sl.closest('.tbag'), lis = [].slice.call(list.children);
    drag = { el: sl, list: list, t: +list.dataset.team, from: lis.indexOf(sl.parentNode), to: -1, x0: e.clientX, y0: e.clientY, touch: e.pointerType !== 'mouse', on: false };
    if (drag.touch) drag.timer = setTimeout(function () { if (drag && !drag.on) { dStart(); dMove(drag.x0, drag.y0); } }, 280);
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.on) {
      if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) <= 6) return;
      if (drag.touch) { clearTimeout(drag.timer); drag = null; return; }
      dStart();
    }
    dMove(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', function () { dEnd(true); });
  window.addEventListener('pointercancel', function () { dEnd(false); });
  document.addEventListener('touchmove', function (e) { if (drag && drag.on) e.preventDefault(); }, { passive: false });

  /* ---------- 精灵仓库 ---------- */
  var ALL_T = Object.keys(TYPE_COLOR);
  function filtered() {
    var f = ui.f, lo = Math.min(f.min, f.max), hi = Math.max(f.min, f.max);
    var list = acc.mons.filter(function (m) { return (!f.type || SPMAP[m.sid].types.indexOf(f.type) >= 0) && m.lv >= lo && m.lv <= hi; });
    var nm = function (m) { return form(m).name; };
    var cmp = { lvd: function (a, b) { return b.lv - a.lv || a.u - b.u; }, lva: function (a, b) { return a.lv - b.lv || a.u - b.u; }, got: function (a, b) { return a.u - b.u; }, name: function (a, b) { return nm(a).localeCompare(nm(b), 'zh-CN'); },
      ivd: function (a, b) { return ivSumOf(b) - ivSumOf(a) || b.lv - a.lv || a.u - b.u; }, iva: function (a, b) { return ivSumOf(a) - ivSumOf(b) || b.lv - a.lv || a.u - b.u; } }[f.sort] || function (a, b) { return b.lv - a.lv || a.u - b.u; };
    return list.sort(cmp);
  }
  var LV_PRE = [[1, 100, '全部'], [1, 24, 'LV1–24'], [25, 49, 'LV25–49'], [50, 100, 'LV50–100']];
  function renderStore() {
    var f = ui.f, list = filtered(), m = mon(ui.sel), ivSort = f.sort === 'ivd' || f.sort === 'iva';   // 按天赋排序时，卡片上直接显示天赋评级
    var cnt = {}; acc.mons.forEach(function (x) { SPMAP[x.sid].types.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    var html = '<div class="page-head"><h2 class="sec">精灵仓库</h2><p class="hint flash">这里存放着你拥有的全部精灵，可按属性、等级检索。点击精灵查看资料，并可加入配队。</p></div>' +
      '<div class="filters" id="filters">' +
      '<div class="f-row"><span class="f-lab">属性</span><button type="button" class="fchip' + (!f.type ? ' on' : '') + '" data-ft="">全部<i>' + acc.mons.length + '</i></button>' +
      ALL_T.map(function (t) { return '<button type="button" class="fchip t' + (f.type === t ? ' on' : '') + (cnt[t] ? '' : ' zero') + '" style="--tc:' + TYPE_COLOR[t] + '" data-ft="' + t + '">' + t + '<i>' + (cnt[t] || 0) + '</i></button>'; }).join('') + '</div>' +
      '<div class="f-row"><span class="f-lab">等级</span>' + LV_PRE.map(function (p) { return '<button type="button" class="fchip' + (f.min === p[0] && f.max === p[1] ? ' on' : '') + '" data-flv="' + p[0] + '-' + p[1] + '">' + p[2] + '</button>'; }).join('') +
      '<span class="hint" style="margin-left:6px">自定义</span><input type="number" id="f-min" min="1" max="100" value="' + f.min + '" aria-label="最低等级" inputmode="numeric"><span>–</span><input type="number" id="f-max" min="1" max="100" value="' + f.max + '" aria-label="最高等级" inputmode="numeric"></div>' +
      '<div class="f-foot"><div class="f-row"><label class="f-lab" for="f-sort">排序</label><select id="f-sort">' +
      [['lvd', '等级从高到低'], ['lva', '等级从低到高'], ['ivd', '天赋评级从高到低'], ['iva', '天赋评级从低到高'], ['got', '获得顺序'], ['name', '名称']].map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select><span class="hint">显示 ' + list.length + ' / ' + acc.mons.length + ' 只</span></div>' +
      '</div></div>' +
      '<div class="build"><div><div class="dex-grid" id="store-grid">' +
      (list.length ? list.map(function (x) {
        var ts = teamsOf(x.u);
        return '<button type="button" class="card' + (ui.sel === x.u ? ' sel' : '') + '" data-u="' + x.u + '">' +
          (ts.length ? '<span class="tms">' + ts.map(function (y) { return '<span class="' + (acc.active === y.t ? 'on' : '') + '">' + TEAM_NAME[y.t] + (y.lead ? '·首发' : '') + '</span>'; }).join('') + '</span>' : '') +
          '<img src="' + form(x).img + '" alt="' + esc(form(x).name) + '"><span class="nm">' + esc(form(x).name) + '</span><span class="lv">LV' + x.lv + (ivSort ? gradeTag(x) : '') + '</span><span class="meta">' + tchips(SPMAP[x.sid].types) + '</span></button>';
      }).join('') : '<p class="empty-note">没有符合条件的精灵。</p>') +
      '</div></div><article class="detail" id="store-detail">' + monDetail(m) + '</article></div>';
    $('pg-store').innerHTML = html;
  }
  $('pg-store').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.closest('#store-detail')) { onDetailClick(e); return; }
    if (b.dataset.ft != null) { ui.f.type = b.dataset.ft; renderStore(); return; }
    if (b.dataset.flv) { var p = b.dataset.flv.split('-'); ui.f.min = +p[0]; ui.f.max = +p[1]; renderStore(); return; }
    if (b.classList.contains('card')) { ui.sel = +b.dataset.u; renderStore(); }
  });
  $('pg-store').addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'f-min' || t.id === 'f-max') {
      var v = Math.max(1, Math.min(100, Math.round(+t.value) || (t.id === 'f-min' ? 1 : 100)));
      ui.f[t.id === 'f-min' ? 'min' : 'max'] = v; renderStore(); return;
    }
    if (t.id === 'f-sort') { ui.f.sort = t.value; renderStore(); return; }
    if (t.closest('#store-detail')) onDetailChange(e);
  });

  /* ---------- 黄冈秘鉴：按进化系点亮 ---------- */
  var DEX_ALL = SP.concat(EXTRA_SP);
  // 没见过的精灵 / 形态：灰色实心剪影，只看得出轮廓。占位图（svg）没有剪影文件时用滤镜压成灰色
  function silTag(sid, i) {
    var p = SILHOUETTES[sid + '_' + (i || 0)];
    return p ? '<img class="sil" src="' + p + '" alt="">' : '<img class="sil fb" src="' + formImg(SPMAP[sid], i || 0) + '" alt="">';
  }
  function owned(sid) { return acc.mons.some(function (m) { return m.sid === sid; }); }
  function litCount() { return acc ? DEX_ALL.filter(function (s) { return owned(s.id); }).length : 0; }
  // 见过：剧情里出现过立绘、或在剧情对战中交过手（竞技对战不算）。只解锁名字，图仍是黑白的
  function seeMon(sid, lv) {
    var s = SPMAP[sid]; if (!s || !acc) return;
    if (!acc.seen) acc.seen = {};
    var st = stageOf(s, lv || 1);
    markForm(sid, st);
    if (acc.seen[sid] === undefined || st > acc.seen[sid]) { acc.seen[sid] = st; save(); }
  }
  function seeStep(st, mons) {
    if (mons === 'all' || st.pick) STARTERS.forEach(function (sid) { seeMon(sid, START_LV); });
    if ((mons === 'pair' || mons === 'all') && acc.rival) seeMon(acc.rival, START_LV);
    if (st.battle && FIGHTS[st.battle]) fightTeam(FIGHTS[st.battle]).forEach(function (x) { if (SPMAP[x.sid]) seeMon(x.sid, x.lv); });   // 剧情战斗的对手记进图鉴（team 也可以是函数；木桩不算）
    if (mons && mons.indexOf('tw:') === 0) seeMon(mons.slice(3), 3);
    if (mons && mons.indexOf('mon:') === 0) seeMon(mons.split(':')[1], +mons.split(':')[2] || 1);
  }
  // 记录见过 / 获得过的进化形态（图鉴里没见过的形态显示为灰色）
  function markForm(sid, st) {
    if (!acc.forms) acc.forms = {};
    var f = acc.forms[sid] || (acc.forms[sid] = [0, 0, 0]);
    if (!f[st]) { f[st] = 1; save(); }
  }
  // 图鉴标题：玩家见过的最高一阶的名字
  function topName(s) {
    var i = evoLast(s); while (i > 0 && !formKnown(s.id, i)) i--;
    return form({ sid: s.id, lv: s.evo[i].lv }).name;
  }
  function formKnown(sid, st) { return !!(acc.forms && acc.forms[sid] && acc.forms[sid][st]); }
  // 旧存档：按已经读过的剧情补记
  function syncSeen() {
    if (!acc) return;
    acc.mons.forEach(function (m) { markForm(m.sid, stageOf(SPMAP[m.sid], m.lv)); });
    if (!acc.story) return;
    Object.keys(acc.story).forEach(function (k) {
      var arr = SCRIPT[k], p = acc.story[k]; if (!arr || !p) return;
      var end = p.done ? arr.length : Math.min(arr.length, (p.at || 0) + 1);
      for (var i = 0; i < end; i++) if (!skipStep(arr[i], p)) seeStep(arr[i], arr[i].mons);
    });
  }
  function seenForm(s) { return form({ sid: s.id, lv: s.evo[acc.seen[s.id]].lv }); }
  var dexSel = null;
  function renderDex2() {
    syncSeen();
    var n = litCount(), T = TITLES[0];
    var ns = DEX_ALL.filter(function (s) { return !owned(s.id) && acc.seen && acc.seen[s.id] !== undefined; }).length;
    if (dexSel && !owned(dexSel)) dexSel = null;
    var html = '<div class="page-head"><h2 class="sec">黄冈秘鉴</h2><p class="hint">荆楚号学院部收藏的精灵图鉴。带回某一类精灵后，它那一页就会点亮；在剧情里见过或交过手的精灵，会先记下名字。</p></div>' +
      '<div class="dex-prog"><span class="tape l"></span><div><b>' + n + '</b> / ' + DEX_ALL.length + ' 类已点亮' + (ns ? '<small class="seen-n">　另有 ' + ns + ' 类见过</small>' : '') + '</div><div class="pbar2"><i style="width:' + (n / DEX_ALL.length * 100) + '%"></i></div>' +
      '<span class="hint">' + (acc.titles.indexOf(T.id) >= 0 ? '已获得称号「' + T.n + '」' : '再点亮 ' + Math.max(0, 3 - n) + ' 类，可获得称号「' + T.n + '」') + '</span></div>' +
      '<div class="build"><div class="dex-grid hg-grid">' + DEX_ALL.map(function (s) {
        var on = owned(s.id), best = 0;
        acc.mons.forEach(function (m) { if (m.sid === s.id) best = Math.max(best, stageOf(s, m.lv)); });
        var seen = !on && acc.seen && acc.seen[s.id] !== undefined, sf = seen ? seenForm(s) : null;
        // 完全没见过的精灵：只显示一阶形态的全黑剪影
        var img = on ? form({ sid: s.id, lv: s.evo[best].lv }).img : seen ? sf.img : null;
        var no = s.evo && s.evo[0].no ? 'No.' + s.evo[0].no + '–' + s.evo[evoLast(s)].no : '';
        return '<button type="button" class="card hg' + (on ? ' on' : seen ? ' off seen' : ' off unseen') + (dexSel === s.id ? ' sel' : '') + '" data-hg="' + s.id + '"' + (on ? '' : ' aria-disabled="true"') + '>' +
          (no ? '<span class="hgno">' + no + '</span>' : '') + (img ? '<img src="' + img + '" alt="">' : silTag(s.id, 0)) + '<span class="nm">' + (on ? esc(topName(s)) + '系' : seen ? esc(sf.name) : '？？？') + '</span>' +
          '<span class="meta">' + (on ? tchips(s.types) : '<span>' + (seen ? '见过 · 未获得' : '未获得') + '</span>') + '</span></button>';
      }).join('') + '</div><article class="detail" id="hg-detail">' + hgDetail(dexSel) + '</article></div>';
    $('pg-dex').innerHTML = html;
  }
  function hgDetail(sid) {
    if (!sid) return '<p class="empty-note">点击已点亮的精灵，查看秘鉴里记载的资料。灰色的精灵还没有带回来过。</p>';
    var s = SPMAP[sid];
    var forms = s.evo.map(function (e, i) {
      var n = formRawName(s, i); n = n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i); if ((s.placeholder || s.tbdForms) && i > 0) n = '？';
      var img = formImg(s, i), kn = formKnown(s.id, i);
      if (!kn) return '<li class="unk"><span class="hgf">' + silTag(s.id, i) + '</span><b>' + (e.no ? '<span class="dexno">No.' + e.no + '</span>' : '') + '？？？</b><small>' + stageLabel(s, i) + ' · ' + (i === 0 ? 'LV1 起' : 'LV' + e.lv + ' 进化') + '</small><p class="hint">还没有见过这一形态。</p></li>';
      return '<li><button type="button" class="hgf" data-abig="' + s.id + '|' + i + '"><img src="' + img + '" alt=""></button><b>' + (e.no ? '<span class="dexno">No.' + e.no + '</span>' : '') + esc(n) + '</b><small>' + stageLabel(s, i) + ' · ' + (i === 0 ? 'LV1 起' : 'LV' + e.lv + ' 进化') + '</small>' + (e.d ? '<p>' + esc(e.d) + '</p>' : '') + '</li>';
    }).join('');
    var stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(function (k) { var b = s.base[k]; return '<span>' + BASE_NAME[k] + '</span><span>' + b + '</span><span class="bar"><i style="width:' + Math.min(100, b / 150 * 100) + '%"></i></span><span></span>'; }).join('');
    return '<span class="tape r"></span><div class="moves-head"><h3 class="hgt">' + esc(topName(s)) + '系</h3>' + tchips(s.types) + '</div>' +
      '<ol class="hg-forms' + (s.evo.length === 2 ? ' n2' : '') + '">' + forms + '</ol>' +
      '<div class="trait"><p><b>特性 · ' + esc(s.ability.n) + '</b>　<span class="blue">' + esc(s.ability.d) + '</span></p></div>' +
      '<div><h4 style="margin:0 0 6px">种族值</h4><div class="stats">' + stats + '<span class="sum">种族值总和 ' + total(s) + '</span></div></div>';
  }
  function total(s) { var n = 0; for (var k in s.base) n += s.base[k]; return n; }
  $('pg-dex').addEventListener('click', function (e) {
    var bg = e.target.closest('[data-abig]'); if (bg) { var q = bg.dataset.abig.split('|'); H.big(q[0], +q[1]); return; }
    var c = e.target.closest('[data-hg]'); if (!c) return;
    if (!owned(c.dataset.hg)) {
      var sd = SPMAP[c.dataset.hg];
      toast(acc.seen && acc.seen[sd.id] !== undefined ? '见过「' + seenForm(sd).name + '」，但还没有把它带回来，秘鉴里只记下了名字。' : '还没有带回过这一类精灵，秘鉴里这一页还是灰的。');
      return;
    }
    dexSel = c.dataset.hg; renderDex2();
  });

  /* ---------- 星际探索：选星球 → 选地点 → 剧情（galgame 式对话） ---------- */
  var PLANETS = [
    { id: 'earth', name: '地球', d: '我们出发的地方。', sites: ['school', 'river', 'jiuquan'] },
    { id: 'jingchu', name: '荆楚号', d: '环绕地球运行的星际探索舰，轮廓和湖北省一模一样。', sites: ['board', 'xiaogan', 'academy', 'storage'], ship: true, after: 'jiuquan' },
    { id: 'tower', name: '先驱之塔', d: '停泊在荆楚号后方的一座高塔，共 60 层。每一层都守着一批强大的精灵，塔顶住着死神。', sites: [], tower: true, after: 'flora1' },
    { id: 'flora', name: '芙罗拉星', d: '草系星球。丛林、草甸和盐碱地里栖息着许多野生精灵。', sites: ['flora1', 'flora2', 'flora3', 'flora4', 'flora5', 'flora6', 'travelcat'], wild: true, ptype: '草系星球', color: ['#9fd08a', '#3f7d4a'], get img() { return floraFallen() ? 'images/planets/flora_corrupt.webp?v=2' : 'images/planets/flora.webp?v=2'; }, after: 'board' },
    { id: 'kamble', name: '坎布尔星', d: '水系星球。大半个星球都被温暖的浅海覆盖。', sites: [], wild: true, ptype: '水系星球', color: ['#8cc6ea', '#2a6fb0'], after: 'flora1' },
    { id: 'pompeii', name: '庞贝星', d: '火系星球。火山终年喷发，地面被熔岩烤得发烫。', sites: [], wild: true, ptype: '火系星球', color: ['#f2a46b', '#b3401f'], img: 'images/planets/pompeii.webp', after: 'flora1' },
    { id: 'laiting', name: '莱汀陨石带', d: '电系区域。无数陨石在雷暴中漂浮。', sites: [], wild: true, ptype: '电系陨石带', color: ['#f1dd73', '#7a6a1a'], belt: true, after: 'flora1' },
    { id: 'white', name: '白之星', d: '冰系星球。整颗星球都裹在冰雪里。', sites: [], wild: true, ptype: '冰系星球', color: ['#e4f2fa', '#6aa6c8'], after: 'flora1' }
  ];
  function regionsOf(pid) { return WILD_REGIONS.filter(function (R) { return R.planet === pid; }); }
  function planetOf(pid) { return PLANETS.filter(function (p) { return p.id === pid; })[0]; }
  // 荆楚号的 17 个部门，对应湖北省的 17 个市州（林区）
  var DEPTS = {
    武汉: ['指挥中枢', '舰桥所在，统筹全舰'], 孝感: ['孝感大厅', '竞技对战与模拟对战系统'], 鄂州: ['鄂州港', '停泊与对接'],
    黄冈: ['学院部', '课堂与做题家培训'], 黄石: ['冶炼工坊', '维修与制造'], 咸宁: ['温泉生活区', '宿舍与休息'],
    随州: ['编钟通讯站', '对外通讯与广播'], 襄阳: ['古城防卫部', '护盾与武备'], 十堰: ['引擎舱', '主引擎与动力'],
    宜昌: ['三峡能源核心', '全舰能源供给'], 恩施: ['生态舱', '种植与氧气循环'], 神农架: ['精灵保育区', '收容与照料野生精灵'],
    荆州: ['典籍馆', '资料与档案'], 荆门: ['物资仓储', '补给与仓库'], 天门: ['陆羽茶室', '船员的休息舱（家园）'],
    潜江: ['食堂', '餐饮补给'], 仙桃: ['体能馆', '体能与失重训练']
  };
  var SITES = {
    school: { name: '省实验中学', planet: 'earth', chapter: '第一段 · 月考之后', bg: 'gate', d: '月考成绩公布后的第二天，张老师有一件「天大的好事」要宣布，还要为你们挑选伙伴精灵。', reward: { exp: 1000, energy: 500 } },
    river: { name: '武昌江边', planet: 'earth', chapter: '第二段 · 江边出发', bg: 'qiyi', d: '出发的日子到了。从起义门到彭刘杨路，再坐大巴驶过长江大桥，一路向西。', after: 'school', reward: { exp: 1000, energy: 500 } },
    jiuquan: { name: '酒泉卫星发射中心', planet: 'earth', chapter: '第三段 · 准备发射', bg: 'jslc', d: '穿过戈壁和沙丘，大巴终于抵达发射中心。在这里，你们遇见了要去太空寻找奶弟的女孩 Threego。', after: 'river', reward: { exp: 1000, energy: 500 } },
    board: { name: '鄂州港', planet: 'jingchu', dept: '鄂州', chapter: '第四段 · 登上荆楚号', bg: 'orbit', d: '火箭升空，进入轨道。等在那里的，是一艘和湖北省地图一模一样的飞船。', after: 'jiuquan', pos: [22, 70], reward: { exp: 1000, energy: 500 } },
    academy: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 黄冈秘鉴', side: true, bg: 'pod_p', d: '学院部里收着一本记录所有精灵的「黄冈秘鉴」。读完后开放「黄冈秘鉴」。', after: 'board', pos: [50, 72], reward: { exp: 0, energy: 100 } },
    flora1: { name: '盐碱地', planet: 'flora', chapter: '第五段 · 降临芙罗拉', bg: 'fl_salt', d: '第一支地面探索小队降落在了芙罗拉星。可着陆舱偏离了坐标，落进了弥漫着瘴气的盐碱地……', after: 'board', reward: { exp: 1000, energy: 500 } },
    flora2: { name: '卡罗聚集地', planet: 'flora', chapter: '第六段 · 卡罗的不安', bg: 'fl_meadow', d: '小队回到草甸上的卡罗聚集地，却听说有不知名的生物在猎杀被瘴气侵染的精灵。', after: 'flora1', reward: { exp: 1500, energy: 600, items: { trans: 1 } } },
    flora3: { name: '丛林边缘', planet: 'flora', chapter: '第七段 · 猎杀者', bg: 'fl_maple', d: '野外的精灵们「败下阵来」的消息传开了。傍晚，丛林边缘的草丛里，三人和卡罗屏住了呼吸……', after: 'flora2', need: function () { return spareN() >= SPARE_N; }, needText: '在芙罗拉星的丛林或草甸「假装击败」' + 5 + ' 只野生精灵，引出猎杀者', reward: { exp: 2000, energy: 800, items: { helmet: 1 } } },
    flora4: { name: '丛林深处', planet: 'flora', chapter: '第八段 · 深入丛林', bg: 'fl_maple', d: 'Threego 循着点点的气味独自闯进了丛林，Vanber 又被头盔砸晕了。天快黑了，只能一个人进去找她……', after: 'flora3', need: function () { return prog('travelcat').done; }, needText: '完成世界任务「旅行猫」', reward: { exp: 2000, energy: 800 } },
    flora5: { name: '山毛榉林', planet: 'flora', chapter: '第九段 · 林中的猎手', bg: 'fl_beech', d: 'Vanber 也追进了丛林。大家会合之后，那些训练有素的卡莱，又出现了……', after: 'flora4', reward: { exp: 2000, energy: 800 } },
    flora6: { name: '盐碱地边缘', planet: 'flora', chapter: '第十段 · 瘴气之源', bg: 'fl_salt', d: '一行人决定前往盐碱地，去看看瘴气真正的源头。注意：读完这一段后，芙罗拉星的野外环境会永久改变，野生精灵将无法捕捉。', after: 'flora5', reward: { exp: 3000, energy: 1200 } },
    tea: { name: '陆羽茶室', planet: 'jingchu', dept: '天门', chapter: '支线 · 陆羽茶室', side: true, bg: 'tea_p', d: '从芙罗拉星回来后，舰上要给第一支地面小队分配休息舱。读完后开放你自己的「茶室」（家园）。', after: 'flora1', pos: [50, 84] },
    mingming: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 明明教官的礼物', side: true, bg: 'bridge_p', d: '古城防卫部的明明教官听说你在黄冈秘鉴里点亮了十类精灵，想见见你。', after: 'board', pos: [48, 82], need: function () { return litCount() >= 10; }, needText: '在黄冈秘鉴中点亮 10 类精灵后开放', reward: { gift: [{ sid: 'aegis', lv: 10 }] } },
    tiger: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 东北来的泰戈尔', side: true, bg: 'bridge_p', d: '古城防卫部来了一只从东北招募的特殊虎系精灵，专门辅助船员训练。读完后开放首领「泰戈尔」的挑战。', after: 'board', pos: [30, 70] },
    tiger2: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 来东北试试', side: true, bg: 'bridge_p', d: '被你打败的泰戈尔一屁股坐在地上，好像有话要说……读完后开放首领「泰戈尔」的普通难度。', after: 'tiger', pos: [84, 72], need: function () { return bossWon('tiger'); }, needText: '击败简单难度的泰戈尔后开放' },
    fl_chal: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 芙罗拉星挑战', side: true, bg: 'bridge_p', d: '明明教官在芙罗拉星上划出了一条「挑战路线」，一关接一关，每关最多评三颗星。读完后开放芙罗拉星的「挑战」。', after: 'flora1', pos: [66, 56], reward: { energy: 300 }, endText: '「芙罗拉星 · 挑战」已开放：去星际探索 · 芙罗拉星的「挑战」页，从第一关开始。' },
    fl_chal2: { name: '挑战路线 · 第二关', planet: 'flora', chapter: '支线 · 借来的力量', side: true, bg: 'fl_lake', d: '第二关的入口前，明明教官打来了通讯。', after: 'fl_chal', need: function () { return chalStars('fl1') > 0; }, needText: '通过芙罗拉星挑战第一关', fpart: 'challenge', endText: '现在可以带助战精灵出战了。回到第二关，挑 4 只自己的精灵，再带上明明教官的赫菲托斯试试吧。' },
    medal: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 授勋馆', side: true, bg: 'pod_p', d: '听说你从明明教官那里领到了董之马，Bttp 想带你去学院部新布置好的一间展厅看看。读完后开放「授勋馆」。', after: 'mingming', pos: [50, 40] },
    rare: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 稀有精灵', side: true, bg: 'pod_p', d: 'Bttp 在黄冈秘鉴里发现了几页几乎空白的记录，想请你帮学院部找一只稀有精灵。', after: 'flora1', pos: [26, 58] },
    rare_r: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 稀有精灵（汇报）', side: true, bg: 'pod_p', d: '把捕捉到的稀有精灵带回学院部，向 Bttp 汇报。', after: 'rare', pos: [74, 58], need: function () { return !!rareOwned(); }, needText: '捕捉一种稀有精灵后来汇报', reward: { title: 'collector' } },
    storage: { name: '物资仓储', planet: 'jingchu', dept: '荆门', chapter: '支线 · 物资仓储', side: true, bg: 'storage_p', d: '荆楚号即将抵达芙罗拉星，新船员要去物资仓储领取探索物资。读完后，物资仓储里的「商城」开放。', after: 'board', pos: [50, 62], reward: { exp: 0, energy: 300, items: { cap1: 10 } } },
    brawl: { name: '孝感大厅', planet: 'jingchu', dept: '孝感', chapter: '支线 · 精灵大乱斗', side: true, bg: 'xiaogan', d: 'Dr.黄 在孝感大厅里鼓捣着一台新搬来的机器，听说你身边已经有 3 只精灵了，想让你试试。读完后开放「精灵大乱斗」。', after: 'xiaogan', pos: [76, 56], need: function () { return acc.mons.length >= 3; }, needText: '持有 3 只精灵后开放' },
    draft: { name: '孝感大厅', planet: 'jingchu', dept: '孝感', chapter: '支线 · 竞技征召', side: true, bg: 'xiaogan', d: 'Dr.黄 听说你已经收集了 10 种精灵，神神秘秘地说要教你一种「真正的切磋」。', after: 'xiaogan', pos: [24, 50], need: function () { return speciesN() >= 10; }, needText: '收集 10 种精灵后开放' },
    spa: { name: '温泉生活区', planet: 'jingchu', dept: '咸宁', chapter: '支线 · 温泉疗养', side: true, bg: 'cabin_p', d: 'Vanber 发现荆楚号的咸宁居然藏着一片温泉疗养区，非要拉你去泡一泡。读完后开放「温泉疗养」。', after: 'flora1', pos: [30, 62] },
    plant: { name: '生态舱', planet: 'jingchu', dept: '恩施', chapter: '支线 · 伟大的种植园', side: true, bg: 'greenhouse_p', d: 'Threego 在地球上最爱种菜，被大家叫作「叶伯伯」。她把荆楚号生态舱的种植业研究了个遍，迫不及待地想带你参观。读完后开放「太空种植园」。', after: 'flora1', pos: [26, 62], reward: { energy: 200, items: { s_herb: 2 } } },
    travelcat: { name: '山毛榉林', planet: 'flora', chapter: '世界任务 · 旅行猫', side: true, bg: 'fl_beech', spot: '林子深处', d: '独自在芙罗拉星做调研的你，听见山毛榉林深处传来一阵打斗声……读完后，旅行精灵叶子喵会开始在各个星球出现。', after: 'flora2' },
    xiaogan: { name: '孝感大厅', planet: 'jingchu', dept: '孝感', chapter: '支线 · 孝感大厅', side: true, bg: 'xiaogan', d: '舰上切磋对战的地方。听说那里有个奇怪的家伙在等着新船员。读完后开放「竞技对战」。', after: 'board', pos: [50, 66], reward: { exp: 0, energy: 200 } }
  };
  // 已有画面的舰内区域；其余区域先用占位画面
  var AREA_BG = { 黄冈: 'pod_p', 鄂州: 'hangar_p', 孝感: 'xiaogan', 武汉: 'cockpit_p', 咸宁: 'cabin_p', 仙桃: 'gym_p', 荆门: 'storage_p', 恩施: 'greenhouse_p', 天门: 'teahall', 随州: 'bridge2_p', 襄阳: 'bridge_p' };
  var BG_POS = { qiyi: '50% 42%', desert: '50% 40%', jslc: '50% 38%', street: '50% 55%', bridge: '45% 55%', tower: '50% 55%' };
  var BG_NAME = { gate: '校门', school: '校门', flag: '教学楼', garden: '牌坊花园', qiyi: '起义门', street: '彭刘杨路', bridge: '长江大桥', desert: '鸣沙山 · 月牙泉', jslc: '发射中心', tower: '发射塔', launch: '火箭升空', orbit: '地球轨道', hangar: '鄂州港 · 停泊区', cockpit_p: '武汉 · 指挥中枢', hangar_p: '鄂州港 · 停泊区', cabin_p: '温泉生活区', greenhouse_p: '太空温室', pp_lake: '熔浆大湖', pp_slag: '熔渣矿区', pp_fort: '湖心堡垒', pp_core: '炙热核心', gym_p: '体能馆', storage_p: '物资仓储', pod_p: '学院部 · 资料室', tea_p: '陆羽茶室 · 04 号舱', teahall: '陆羽茶室 · 大厅', bridge2_p: '编钟通讯站', bridge_p: '古城防卫部', xiaogan: '孝感大厅', paifang: '惟楚有材牌坊', hall: '报告厅', field: '操场', aerial: '校园全景' };
  // 芙罗拉星的场景名；瘴气化后的 *_mia 版本沿用同一个名字
  Object.assign(BG_NAME, { fl_path: '林间小路', fl_lake: '草甸湖畔', fl_beech: '山毛榉林', fl_maple: '丛林边缘', fl_meadow: '草甸', fl_sun: '丛林深处', fl_salt: '盐碱地', fl_village: '叶之村落', fl_horizon: '草甸尽头', fl_jungle_corrupt: '瘴气丛林' });
  Object.keys(BG_NAME).forEach(function (k) { if (BG[k + '_mia']) BG_NAME[k + '_mia'] = BG_NAME[k]; });
  // 角色（立绘为占位）
  var CAST = {
    p: { name: function () { return acc.name; }, color: '#c42f3a', tall: 0.92, get img() { return playerArt(); } },   // 主角立绘按性别：pm 男主 / pf 女主（差分见 CHARS 的 pm_xxx）
    v: { name: function () { return 'Vanber'; }, color: '#2a4ca0', tall: 0.8, img: 'vanber' },   // 差分：sweat 无语、shock 惊讶、smile 笑、shy 慌张
    z: { name: function () { return '张卫国'; }, color: '#5b5866', tall: 1.0, img: 'zwg' },
    t: { name: function () { return 'Threego'; }, color: '#6f8f2a', tall: 1.0, img: 'threego' },
    y: { name: function () { return '点点'; }, color: '#b0603a', tall: 1.0, img: 'dd' },
    b: { name: function () { return 'Bttp'; }, color: '#7a5a7e', tall: 1.0, img: 'bttp' },
    h: { name: function () { return 'Dr.黄'; }, color: '#a8841f', tall: 1.0, img: 'drh' },
    ai: { name: function () { return '舰载广播'; }, color: '#2a7bd8' },
    mm: { name: function () { return '明明教官'; }, color: '#4a6a8a', tall: 1.0 },
    tg: { name: function () { return '泰戈尔'; }, color: '#b0702a', tall: 0.92, spr: 'tagore' },
    kr: { name: function () { return '卡罗'; }, color: '#4f9159', tall: 0.55, spr: 'wind', sprLv: 3 },     // 戴上精灵翻译器之后能听懂的卡罗
    kl: { name: function () { return '卡莱'; }, color: '#3f6d3a', tall: 0.7, spr: 'kaleo', sprLv: 15 },
    lc: { name: function () { return '叶子喵'; }, color: '#5f9a3e', tall: 0.8, spr: 'leafcat', sprLv: 30 },   // 世界任务「旅行猫」里的叶子喵（戴着翻译器能听懂）
    cy: { name: function () { return '辰爷'; }, color: '#3a4a66', tall: 1.0, img: 'cy' },
    ms: { name: function () { return '玛西'; }, color: '#8a5a9a', tall: 0.55, spr: 'mush', sprLv: 10 }   // 戴着翻译器能听懂的玛西（第八段）   // 「常春藤怀克」，常春藤组织的特工（第八段登场）
  };
  var SCRIPT = STORY_SCRIPT;   // 剧本内容见 js/data/story.js
  function unlocked(id) { var S = SITES[id], a = S.after; return (!a || prog(a).done) && (!S.need || S.need()); }
  // 稀有精灵：野外精灵表里标了 rare 的种类
  // 三主宠虽然也在野外以稀有精灵出现，但开局就有一只，不算支线「稀有精灵」要找的那种
  // （rareList 见上方说明）
  function rareList() { var R = []; for (var k in WILD) WILD[k].forEach(function (w) { if (w.rare && w.sid !== acc.starter && R.indexOf(w.sid) < 0) R.push(w.sid); }); return R; }
  function rareOwned() { var R = rareList(); return acc.mons.filter(function (m) { return R.indexOf(m.sid) >= 0; })[0] || null; }
  // 稀有精灵：野外表里标了 rare 的种类。三主宠也算，但这个账号开局选的那只不算。拥有几类按种类去重
  function rareKinds() { var R = rareList(), o = {}; acc.mons.forEach(function (m) { if (R.indexOf(m.sid) >= 0) o[m.sid] = 1; }); return Object.keys(o).length; }
  function planetOpen(P) { return !P.after || prog(P.after).done; }
  var UNLOCK = { xiaogan: '竞技对战', academy: '黄冈秘鉴', storage: '商城', tea: '茶室', brawl: '精灵大乱斗', tiger2: '泰戈尔 · 普通难度', fl_chal: '芙罗拉星 · 挑战', fl_chal2: '助战精灵', plant: '太空种植园', medal: '授勋馆', spa: '温泉疗养' };
  function brawlOpen() { return !!(acc && acc.story && acc.story.brawl && acc.story.brawl.done); }
  function brawlPlayed() { return !!(acc && acc.stats && acc.stats.brawls > 0); }
  // 平衡模式切磋统一的等级；拥有的精灵种类数（「收集」）；是否参加过竞技征召
  var BAL_LV = 60;
  function speciesN() { var o = {}; (acc ? acc.mons : []).forEach(function (m) { o[m.sid] = 1; }); return Object.keys(o).length; }
  function draftPlayed() { return !!(acc && acc.stats && acc.stats.drafts > 0); }
  function homeOpen() { return !!(acc && acc.story && acc.story.tea && acc.story.tea.done); }
  // 茶室里展示的精灵：[{ u, t: 放出来的时间 }]
  function home() {
    if (!acc.home) acc.home = { name: '陆羽茶室', mons: [] };
    acc.home.mons = acc.home.mons.map(function (x) { return typeof x === 'number' ? { u: x, t: Date.now() } : x; }).filter(function (x) { return mon(x.u); });
    return acc.home;
  }
  // 太空种植园：读完支线「伟大的种植园」后开放；这条支线上线前已经在种的老玩家照常能进
  function farmOpen() { return !!acc && (prog('plant').done || !!(acc.farm && Array.isArray(acc.farm.plots) && acc.farm.plots.some(Boolean))); }
  function shopOpen() { return !!(acc && acc.story && acc.story.storage && acc.story.storage.done); }
  function dexOpen() { return !!(acc && acc.story && acc.story.academy && acc.story.academy.done); }
  function arenaOpen() { return !!(acc && acc.story && acc.story.xiaogan && acc.story.xiaogan.done); }
  // 首次读完某段剧情时发放奖励（只发一次）
  function grant(id) {
    var R = SITES[id].reward, pr = prog(id); if (!R || pr.rewarded) return null;
    acc.exp = (acc.exp || 0) + (R.exp || 0); acc.energy = (acc.energy || 0) + (R.energy || 0);
    giveItems(R.items); if (R.title && acc.titles.indexOf(R.title) < 0) acc.titles.push(R.title);
    (R.gift || []).forEach(function (g) { var m = newMon(g.sid, g.lv), T = acc.teams[acc.active]; if (T.length < TEAM_SIZE) T.push(m.u); });
    pr.rewarded = true; pr.itemsGiven = true; pr.got = { exp: R.exp || 0, energy: R.energy || 0 }; save(); return R;
  }
  /* 主线章节：一个章节的剧情全部读完后，额外发一份章节大奖（每个存档一次，记在 acc.chapters）
   * wip 表示这一章还没写完（未完待续），写完之前不算通关 */
  var CHAPTERS = [
    { id: 'prologue', n: '序章', d: '从省实验中学出发，一路到登上荆楚号。', sites: ['school', 'river', 'jiuquan', 'board'], reward: { exp: 5000 } },
    { id: 'ch1', n: '第一章 · 芙罗拉星', d: '降落芙罗拉星，追查瘴气和猎杀者的真相。', sites: ['flora1', 'flora2', 'flora3', 'flora4', 'flora5', 'flora6'], wip: true, reward: { exp: 20000, energy: 3000 } }   // 2026-10-17：茶室音乐「芙罗拉星」移除，章节大奖改为经验和能量
  ];
  function chapterOf(site) { return CHAPTERS.filter(function (C) { return C.sites.indexOf(site) >= 0; })[0] || null; }
  function chapterDone(C) { return !C.wip && C.sites.every(function (id) { return prog(id).done; }); }
  function chapterGot(id) { return !!(acc && acc.chapters && acc.chapters[id]); }
  function chapterPay(C) {   // 发章节奖励（调用前先确认 chapterDone 且还没领过）
    var R = C.reward; if (!acc.chapters) acc.chapters = {}; acc.chapters[C.id] = Date.now();
    acc.exp = (acc.exp || 0) + (R.exp || 0); acc.energy = (acc.energy || 0) + (R.energy || 0); giveItems(R.items); save();
  }
  // 剧情里拿到的东西（如 Threego 的封口费），每个存档只给一次
  function storyGive(site, g) {
    var pr = prog(site); if (!pr.gave) pr.gave = {}; if (pr.gave[g.id]) return false;
    pr.gave[g.id] = 1; acc.energy += g.energy || 0; acc.exp += g.exp || 0; giveItems(g.items); save(); if (ready()) renderRes(); return true;
  }
  // 主线奖励调整后，给已读完的旧存档补齐差额（只补一次）
  var OLD_MAIN = { school: { exp: 1000, energy: 500 }, river: { exp: 0, energy: 0 }, jiuquan: { exp: 0, energy: 0 }, board: { exp: 1000, energy: 300 } };
  function backfillMain() {
    var add = { exp: 0, energy: 0 };
    // 2026-10-17 第八段拆成第八、九、十段：拆分前就读完第八段的存档（读的是完整旧版），第九、十段直接记为已读（不另发奖励），瘴气化状态不变
    if (!acc.split8) { acc.split8 = 1; var p8 = acc.story && acc.story.flora4; if (p8 && p8.done) ['flora5', 'flora6'].forEach(function (id) { var q = prog(id); q.done = true; q.rewarded = true; q.at = 0; }); save(); }
    ['school', 'river', 'jiuquan', 'board'].forEach(function (id) {
      var pr = acc.story && acc.story[id], R = SITES[id].reward; if (!pr || !pr.done || !R) return;
      var had = pr.got || (pr.rewarded ? OLD_MAIN[id] : { exp: 0, energy: 0 });
      var de = Math.max(0, (R.exp || 0) - had.exp), dn = Math.max(0, (R.energy || 0) - had.energy);
      if (!pr.got || de || dn) { acc.exp += de; acc.energy += dn; add.exp += de; add.energy += dn; pr.got = { exp: R.exp || 0, energy: R.energy || 0 }; pr.rewarded = true; }
    });
    if (acc.story && acc.story.jiuquan && acc.story.jiuquan.done && storyGive('jiuquan', { id: 'bribe', energy: 1000 })) add.energy += 1000;
    if (add.exp || add.energy) { save(); setTimeout(function () { toast('主线奖励调整：已为读完的主线补发累积经验 ×' + fmt(add.exp) + '、能量 ×' + fmt(add.energy) + '。'); }, 600); }
  }
  function giveItems(o) { if (!o) return; if (!acc.items) acc.items = {}; for (var k in o) acc.items[k] = (acc.items[k] || 0) + o[k]; }
  function rwList(R) { var a = [R.exp ? '累积经验 ×' + fmt(R.exp) : '', R.energy ? '能量 ×' + fmt(R.energy) : '', R.bgm ? '茶室音乐「' + bgmName(R.bgm) + '」' : '']; if (R.items) for (var k in R.items) a.push(itemName(k) + ' ×' + R.items[k]); if (R.title) a.push('称号「' + TITLES.filter(function (x) { return x.id === R.title; })[0].n + '」'); if (R.mon) a.push(R.mon); (R.gift || []).forEach(function (g) { a.push(form(g).name + ' LV' + g.lv); }); return a.filter(Boolean); }
  var ex = { view: 'planets', planet: 'earth', site: null, mode: null, host: null, i: 0, typing: false, auto: false, skip: false, timer: null, tick: null, full: '', log: [], pickSel: null };
  function story() { if (!acc.story) acc.story = {}; return acc.story; }
  function prog(site) { var st = story(); if (!st[site]) st[site] = { at: 0, done: false, ch: null }; return st[site]; }
  function monName(sid) { return sid ? form({ sid: sid, lv: START_LV }).name : '精灵'; }
  function starterName() { var m = acc.mons.filter(function (x) { return x.sid === acc.starter; })[0]; return m ? form(m).name : monName(acc.starter); }
  function fill(t) {
    var rm = t.indexOf('{rare}') >= 0 && rareOwned();
    if (rm) t = t.replace(/\{rare\}/g, form(rm).name);
    return t.replace(/\{name\}/g, acc.name).replace(/\{starter\}/g, starterName()).replace(/\{rival\}/g, monName(acc.rival))
      .replace(/\{type\}/g, acc.starter ? SPMAP[acc.starter].types[0] : '').replace(/\{rtype\}/g, acc.rival ? SPMAP[acc.rival].types[0] : '');
  }
  // 立绘差分：剧本某一句写 f: { t: 'smile' }，就换成 CHARS['threego_shy']；没有这张图时用默认立绘
  var FACE_KEY = { t: 'threego', y: 'dd', b: 'bttp', h: 'drh' };
  function standee(k, face) {
    if (CAST[k].spr) return '<img class="vn-art vn-mon" src="' + (CAST[k].sprLv ? form({ sid: CAST[k].spr, lv: CAST[k].sprLv }).img : SPRITES[CAST[k].spr]) + '" alt="" style="height:' + (CAST[k].tall * 100) + '%">';   // 精灵出场：直接用精灵立绘
    if (CAST[k].img) { var src = (face && CHARS[(FACE_KEY[k] || CAST[k].img) + '_' + face]) || CHARS[CAST[k].img]; return '<img class="vn-art" src="' + src + '" alt="" style="height:' + (CAST[k].tall * 100) + '%">'; }
    var c = CAST[k], col = c.color, head = 'M100 18c34 0 52 26 52 58s-20 60-52 60-52-28-52-60 18-58 52-58z', body = 'M40 420c-6-80 -8-150 14-200 14-32 34-50 46-54 12 4 32 22 46 54 22 50 20 120 14 200z';
    return '<svg viewBox="0 0 200 420" aria-hidden="true" style="height:' + (c.tall * 100) + '%"><g stroke="#23222b" stroke-width="4" stroke-linejoin="round">' +
      '<path d="' + body + '" fill="#fbfaf3" fill-opacity=".94"/><path d="' + body + '" fill="' + col + '" fill-opacity=".22" stroke-dasharray="11 7"/>' +
      '<path d="' + head + '" fill="#fbfaf3" fill-opacity=".94"/><path d="' + head + '" fill="' + col + '" fill-opacity=".22" stroke-dasharray="11 7"/></g>' +
      '<text x="100" y="86" text-anchor="middle" font-size="40" fill="' + col + '" font-family="Long Cang, KaiTi, cursive">?</text>' +
      '<text x="100" y="250" text-anchor="middle" font-size="22" fill="#75737e" font-family="-apple-system, PingFang SC, sans-serif">立绘占位</text></svg>';
  }
  // 主角的表情：这一句没写 f.p 时，沿用前面几句（最多往回 4 句）里最近的表情，免得别人说话时主角一直是默认的笑脸。
  // 遇到换背景、或者主角自己说了一句没写表情的话，就回到默认立绘。
  function pFace(arr, i) {
    for (var j = i; j >= 0 && j >= i - 4; j--) {
      var s = arr[j];
      if (s.f && s.f.p !== undefined) return s.f.p;
      if (j < i && (s.bg || s.s === 'p')) return null;
    }
    return null;
  }
  function skipStep(st, p) { return (st.only && st.only !== p.ch) || (st.pick && acc.starter) || (st.res && st.res !== (p.bt === 'win' ? 'win' : 'lose')); }
  // 剧情对战的对手配置
  var LEAF_ALLY = { sid: 'leafcat', lv: 40, nick: '叶子喵', boss: { purify: 1 }, moves: ['闪光飞叶', '种子炸弹', '星星魔法', '光束'] };
  var FIGHTS = {
    threego: { foe: 'Threego', team: [{ sid: 'tagore', lv: 3 }] },
    karo: { foe: '被瘴气污染的野生精灵', team: [{ sid: 'wind', lv: 3, miasma: 5 }], env: 'miasma', bg: 'fl_salt', desc: '被瘴气污染的卡罗（LV3）' },
    hunter: { foe: '神秘的猎杀者', team: [{ sid: 'kaleo', lv: 15 }], bg: 'fl_maple', desc: '猎杀者卡莱（LV15）' },
    kaleo4: { foe: '瘴气卡莱群', team: [{ sid: 'kaleo', lv: 20, miasma: 5 }, { sid: 'kaleo', lv: 20, miasma: 5 }, { sid: 'kaleo', lv: 20, miasma: 5 }, { sid: 'kaleo', lv: 20, miasma: 5 }], bg: 'fl_beech', desc: '被瘴气侵染的卡莱 ×4（LV20）' },
    // 剧情助战的叶子喵：LV40，带高威力攻击技能，默认首发（见 startFight）
    // ↓ 第八段 · 深入丛林（flora4）专用。boss 字段见 battle.js 的 BOSS_FX：erode 深度侵蚀（1 = 双攻 +100%，2 = +200%）、mute 无法交流（只用攻击技能）、purify 净化光芒
    // allyOpt：叶子喵助战可选，开战前在对战卡上勾选；preStrike：对方偷袭先出一招；cuts：对方体力降到某个数值时插播对话
    cyThreego: { foe: '瘴气玛西', pteam: [{ sid: 'tagore', lv: 12, nick: '小胖虎' }],   // 操控 Threego 的小胖虎迎战（剧情杀）
      team: [{ sid: 'mush', lv: 24, nick: '瘴气玛西', miasma: 8, boss: { erode: 2, mute: 1 } }],
      env: 'miasma', bg: 'fl_sun', desc: '瘴气玛西（LV24）' },
    cyRescue: { foe: '瘴气玛西',
      team: [{ sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }, { sid: 'mush', lv: 21, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }],
      env: 'miasma', bg: 'fl_path', desc: '瘴气玛西 ×2（LV20 / 21）' },
    cyBoss: { foe: '瘴气变异玛西露姆', bgm: 'disCommunication',   // 剧情杀：比玩家首发高 20 级，先制 +9 的「瘴毒灭却」一回合秒一只
      team: function () {
        var lead = (acc.teams[acc.active] || []).map(mon).filter(Boolean)[0] || acc.mons[0];
        var lv = Math.min(100, (lead ? lead.lv : 20) + 20);
        return [{ sid: 'mush', lv: lv, nick: '瘴气变异玛西露姆', img: FORM_FX_SPRITES.mush.miasma, miasma: 10, boss: { erode: 1, mute: 1 }, moves: ['瘴毒灭却'] }];
      },
      env: 'miasma', bg: 'fl_sun', desc: '瘴气变异玛西露姆（比你的首发高 20 级）' },
    cyCat: { foe: '瘴气叶子小小喵',
      team: [{ sid: 'leafcat', lv: 18, nick: '瘴气叶子小小喵', miasma: 6, boss: { mute: 1 } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      env: 'miasma', bg: 'fl_village', desc: '瘴气叶子小小喵（LV18）' },
    cyVillage: { foe: '村口的守卫',
      team: [{ sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }, { sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } },
        { sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }, { sid: 'leafcat', lv: 20, nick: '瘴气叶子小小喵', miasma: 6, boss: { mute: 1 } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      env: 'miasma', bg: 'fl_village', desc: '瘴气玛西 ×3、瘴气叶子小小喵（LV20）' },
    cyKaleo: { foe: '列队的卡莱', preStrike: true,   // 突然冲上来：卡莱第一回合先打出一招
      team: [{ sid: 'kaleo', lv: 22, nick: '卡莱', miasma: 3 }, { sid: 'kaleo', lv: 23, nick: '卡莱', miasma: 3 }, { sid: 'kaleo', lv: 24, nick: '卡莱', miasma: 3 }],
      allyMon: LEAF_ALLY, allyOpt: true,
      bg: 'fl_beech', desc: '卡莱 ×3（LV22 / 23 / 24）' },
    cyChenye: { foe: '辰爷',
      team: [{ sid: 'kaleo', lv: 35, nick: '卡莱奥', miasma: 4 }, { sid: 'squid', lv: 40, nick: '邪恶水臂' }],
      allyMon: LEAF_ALLY, allyOpt: true,
      bg: 'fl_beech', desc: '辰爷的卡莱奥（LV35）、邪恶水臂（LV40）' },
    cyBomb: { foe: '炸弹',   // 纯木桩：不会攻击、1000 体力，可以被打破；打到 700、300 时插播对话
      team: [{ sid: 'dummy', lv: 30, nick: '炸弹', img: SPRITES.plantbomb, maxhp: 1000, breakable: true, moves: ['按兵不动'], ability: { n: '能量炸弹', d: 'Bttp 做的炸弹。不会攻击；不断注入能量（攻击它），外壳被打破时就会爆开' } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      bg: 'fl_beech', desc: '往炸弹里注入能量（1000 体力，不会攻击）',
      cuts: [
        { hp: 700, lines: [
          { s: 'cy', t: '……嗯？不好！你们在搞什么鬼？给我上！' },
          { s: 'n', t: '辰爷一声大喝，林子里埋伏的卡莱潮水一样朝你们冲了过来。' },
          { s: 'ms', t: '我们来了——！！' },
          { s: 'n', t: '身后传来一片叫喊。是没被瘴气感染的玛西们！它们从四面八方的树丛里钻出来，组成了一支浩浩荡荡的联军，迎着卡莱冲了上去。' },
          { s: 'n', t: '两边撞在一起，林子里一下子乱成一团。一时间难分胜负。' },
          { s: 'n', t: '可是慢慢地，卡莱们靠着天生的战斗本能和瘴气的加持，一点点占了上风。' },
          { s: 'v', t: '它们撑不了太久！{name}，继续注入能量！' }
        ] },
        { hp: 300, lines: [
          { s: 'cy', t: '哈哈哈哈！偷偷摸摸的，在搞什么小动作呢？' },
          { s: 'n', t: '玛西联军已经倒下了一大片，大部分被打晕在了地上。剩下的卡莱掉过头，朝你们围了过来。' },
          { s: 'v', t: '加速注入能量！！快快快！！' }
        ] }
      ] },
    cyGuards: { foe: '失去理智的精灵', bgm: 'disCommunication',   // 压迫感强的高形态：和战前剧情里的 dis-communication 接着放
      team: [{ sid: 'wind', lv: 36, nick: '瘴气六尾风王', img: SPRITES.wind, miasma: 8, boss: { erode: 1, mute: 1 } }, { sid: 'mush', lv: 38, nick: '瘴气玛西露姆', img: FORM_FX_SPRITES.mush.miasma, miasma: 8, boss: { erode: 1, mute: 1 } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      env: 'miasma', bg: 'fl_salt', desc: '瘴气六尾风王（LV36）、瘴气玛西露姆（LV38）' }
  };
  function storyMon(m) { var f = form(m), hl = m.u != null ? (m.hl || []) : undefined, mv = m.moves.length ? m.moves.slice() : defaultMoves(m.sid, m.lv, hl); return { id: m.sid, lv: m.lv, moves: mv, nick: f.name, img: f.img, ev: m.ev || null, nat: m.nat || null, iv: ivOf(m), u: m.u, hl: hl, shiny: shinyV(m.shiny), emblem: m.u != null && acc.emblems && acc.emblems[m.sid] && EMBLEMS[m.sid] ? EMBLEMS[m.sid].m : null }; }
  // F.pteam：剧情限定，用一支固定的队伍代替玩家自己的配队出战（如操控 Threego 的精灵），不计入经验/学习力
  // F.allyMon：在玩家自己配队的最后加一只固定的助战精灵（如旅行叶子喵），本场战斗结束后也不计入经验/学习力；写法和 F.team 的项一样
  // F.team：精灵数组，或一个返回精灵数组的函数（用于体力/等级要跟玩家首发精灵联动的首领，如瘴气玛西露姆）
  // F.team / F.allyMon 的每一项：sid、lv 之外，还可以给 moves（固定技能表）、boss（见 battle.js 的 BOSS_FX）、maxhp（固定体力）、nick（显示名）、img（立绘）、miasma
  function fightTeam(F) { return typeof F.team === 'function' ? F.team() : F.team; }
  function resolveFoeEntry(x) {
    if (x.moves || x.boss || x.maxhp || x.nick || x.img) {
      var defImg = x.sid === 'dummy' ? null : formImg(SPMAP[x.sid], stageOf(SPMAP[x.sid], x.lv));
      var mv = x.moves || (x.boss && x.boss.mute && x.sid !== 'dummy' ? puppetMoves(x.sid) : defaultMoves(x.sid, x.lv));   // 「无法交流」：只会用攻击技能
      return { id: x.sid, lv: x.lv, moves: mv, nick: x.nick, img: x.img || defImg, maxhp: x.maxhp, boss: x.boss, miasma: x.miasma, breakable: x.breakable, ability: x.ability };
    }
    var o = storyMon({ sid: x.sid, lv: x.lv, moves: [] }); if (x.miasma) o.miasma = x.miasma; return o;
  }
  function startFight(key) {
    var F = FIGHTS[key], team, realN, allyFirst = false;
    if (F.pteam) {
      team = F.pteam.map(function (x) { return { id: x.sid, lv: x.lv, moves: x.moves || defaultMoves(x.sid, x.lv), nick: x.nick, img: x.img || formImg(SPMAP[x.sid], stageOf(SPMAP[x.sid], x.lv)) }; });
      realN = 0;
    } else {
      team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
      if (!team.length) team = acc.mons.slice(0, 1);
      team = team.slice(0, TEAM_SIZE).map(storyMon);
      realN = team.length;
      if (F.allyMon && !(F.allyOpt && ex.allyOff)) { team = [resolveFoeEntry(F.allyMon)].concat(team.slice(0, TEAM_SIZE - 1)); realN = team.length - 1; allyFirst = true; }   // 助战精灵默认首发   // allyOpt：助战可选，开战前在对战卡上勾选（默认带上）
    }
    var a = fightTeam(F).map(resolveFoeEntry);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    var host = ex.host; host.hidden = true;
    if (ex.mode === 'replay') $('pg-explore').hidden = true;
    $('pg-arena').hidden = false;
    // F.bgm：这一战的专属战斗曲（不先放遇敌曲）；F.preStrike：对方偷袭，开场先出一招；F.cuts：对方体力降到某个数值以下时插播对话（见 battle-ui.js）
    var cuts = (F.cuts || []).map(function (c) { return { hp: c.hp, lines: c.lines.map(function (L) { return { n: L.s === 'n' ? '' : CAST[L.s].name(), t: fill(L.t) }; }) }; });
    window.HSBATTLE.start({ p: team, a: a, foe: F.foe, items: invCopy(), env: F.env || null, bg: F.bg ? fightBg(F.bg) : null, corrupt: !!F.corrupt, bgm: F.bgm || null, bgmDirect: !!F.bgm, preStrike: !!F.preStrike, cuts: cuts, onItem: useInv, onEnd: function (res, seen, downs) {
      if (realN > 0) {
        var o0 = allyFirst ? 1 : 0, got = battleRewards(team.slice(o0, o0 + realN), (seen || []).slice(o0, o0 + realN), downs);   // 助战精灵不拿经验
        dailyHit('pve');
        if (got.length) setTimeout(function () { toast(got.join('')); }, 300);
      }
      ex.fighting = false; document.body.classList.remove('story-fight'); prog(ex.site).bt = res; save();
      $('pg-arena').hidden = page !== 'arena' || ex.mode === 'intro' || ex.mode === 'replay';
      host.hidden = false; if (ex.mode === 'replay') $('pg-explore').hidden = false;
      ex.i++; renderVN(); syncBattle(); window.scrollTo(0, host.offsetTop - 8);
    } });
  }
  function stepAt(i) { var arr = SCRIPT[ex.site], p = prog(ex.site); while (i < arr.length && skipStep(arr[i], p)) i++; return i; }
  function carry(i, key, def) { var arr = SCRIPT[ex.site], p = prog(ex.site), v = def; for (var k = 0; k <= i && k < arr.length; k++) if (arr[k][key] !== undefined && !(arr[k].only && arr[k].only !== p.ch)) v = arr[k][key]; return v; }

  function renderExplore() {
    if (ex.mode === 'intro') return;
    stopTimers(); setTimeout(bgmScene, 0);
    var el = $('pg-explore');
    if (ex.view === 'vn') { renderVN(); return; }
    if (ex.view === 'field') { renderField(); return; }
    if (ex.view === 'area') { renderArea(); return; }
    if (ex.view === 'quests') ex.view = 'planets';   // 任务面板已经移到顶栏
    if (ex.view === 'home') { if (homeOpen()) { renderHome(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'boss') { if (bossOpen(ex.boss)) { renderBoss(); return; } ex.view = 'planets'; }
    if (ex.view === 'bosshub') { renderBossHub(); return; }
    if (ex.view === 'weekly') { if (weeklyOpen()) { ex.boss = WEEKLY.boss; renderBoss(true); return; } ex.view = 'planets'; }
    if (ex.view === 'room') { if (homeOpen()) { renderRoom(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'teashop') { if (homeOpen()) { renderTeaShop(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'shop') { if (shopOpen()) { renderShop(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'forge') { renderForge(); return; }
    if (ex.view === 'nursery') { renderNursery(); return; }
    if (ex.view === 'medal') { if (medalOpen()) { renderMedal(); return; } ex.view = 'area'; ex.area = '黄冈'; }
    if (ex.view === 'farm') { if (farmOpen()) { renderFarm(); return; } ex.view = 'area'; ex.area = '恩施'; }
    if (ex.view === 'spa') { if (spaOpen()) { renderSpa(); return; } ex.view = 'area'; ex.area = '咸宁'; }
    var Pp = ex.view === 'sites' && PLANETS.filter(function (p) { return p.id === ex.planet; })[0];
    var html = exHead(ex.view === 'planets' ? '选择要前往的星球。' : Pp && Pp.ship ? '点击舰上的区域，即可传送过去。' : '选择要前往的地点。');
    if (ex.view === 'planets') {
      var nOpen = Object.keys(BOSSES).filter(bossOpen).length;
      html += '<button type="button" class="weekly-card hub-card" data-bosshub="1"><span class="tape l"></span><span class="hub-ic">' + Object.keys(BOSSES).map(function (k) { return '<img src="' + SPRITES[BOSSES[k].sid] + '" alt="">'; }).join('') + '</span><span class="wk-txt"><span class="chip boss-diff">Boss挑战</span><b>首领一览</b>' +
        '<small>' + Object.keys(BOSSES).map(function (k) { return BOSSES[k].name; }).join('、') + ' · 已开放 ' + nOpen + ' / ' + Object.keys(BOSSES).length + '</small></span><span class="wk-pm">›</span></button>';
      if (weeklyOpen()) {
        var WB = BOSSES[WEEKLY.boss], pn = permits();
        html += '<button type="button" class="weekly-card" data-weekly="1"><span class="tape l"></span><img src="' + SPRITES[WB.sid] + '" alt=""><span class="wk-txt"><span class="chip boss-diff d2">每周挑战</span><b>' + WB.name + ' · ' + WB.lv[WEEKLY.d].diff + '难度</b>' +
          '<small>每次消耗 1 枚挑战许可 · 击败得累积经验 ×' + fmt(WEEKLY.exp) + ' 和随机掉落</small></span><span class="wk-pm"><b>' + pn + '</b> / ' + PERMIT.max + '<small>挑战许可</small></span></button>';
      }
      html += '<div class="planets">' + PLANETS.filter(planetOpen).map(function (p) {
        var n = p.sites.length, done = p.sites.filter(function (s) { return prog(s).done; }).length, open = planetOpen(p);
        return '<button type="button" class="planet' + (open ? '' : ' locked') + '" data-planet="' + p.id + '"' + (open ? '' : ' disabled') + '><span class="tape l"></span>' + (p.ship ? '<img class="ship-ic" src="' + CHARS.ship_icon + '" alt="">' : p.tower ? towerSvg() : planetSvg(p.id)) +
          '<span class="pn">' + p.name + (p.wild ? '<span class="chip ptype">' + p.ptype + '</span>' : '') + '</span><span class="hint">' + p.d + '</span><span class="pc">' + (open ? (p.tower ? '当前第 ' + twRec().f + ' 层 · 存档点第 ' + twRec().cp + ' 层' : p.wild ? '野外区域 ' + regionsOf(p.id).length + ' 个 · 可捕捉野生精灵' : '地点 ' + n + ' 个 · 已完成 ' + done) : '读完「' + SITES[p.after].chapter.split(' · ')[1] + '」后解锁') + '</span></button>';
      }).join('') +
        '<div class="planet locked" aria-disabled="true"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="34" fill="none" stroke="#75737e" stroke-width="3" stroke-dasharray="8 6"/><text x="60" y="72" text-anchor="middle" font-size="34" fill="#75737e" font-family="Long Cang, KaiTi, cursive">?</text></svg>' +
        '<span class="pn">未知星球</span><span class="hint">更多星球敬请期待</span></div></div>';
    } else {
      var P = PLANETS.filter(function (p) { return p.id === ex.planet; })[0];
      html += '<div class="crumb"><button type="button" class="btn ghost" id="ex-back">‹ 返回星球</button><b>' + P.name + '</b></div>';
      if (P.ship) { el.innerHTML = html + shipMap(P); return; }
      if (P.wild) { el.innerHTML = html + (P.id === 'flora' ? floraPage() : wildPage(P)); return; }
      if (P.tower) { el.innerHTML = html + towerPage(); return; }
      html += '<div class="sites">' + P.sites.map(function (id) {
        var S = SITES[id], pr = prog(id), started = pr.at > 0 && !pr.done, open = unlocked(id);
        var rw = S.reward ? '<p class="hint">首次读完奖励：' + rwList(S.reward).filter(Boolean).join('、') + (UNLOCK[id] ? '，并开放' + UNLOCK[id] : '') + (pr.rewarded ? '（已领取）' : '') + '</p>' : '';
        return '<article class="site' + (open ? '' : ' locked') + '"><span class="tape r"></span><div class="site-img"><img src="' + BG[S.bg] + '" alt="' + S.name + '" style="object-position:' + (BG_POS[S.bg] || '50% 60%') + '"></div><div class="site-txt">' +
          '<span class="sc-tag' + (S.side ? ' side' : '') + '">' + S.chapter + '</span><h3>' + S.name + '</h3><p class="hint">' + S.d + '</p>' + rw +
          '<p class="site-st ' + (pr.done ? 'blue' : started ? 'red' : '') + '">' + (!open ? '读完「' + SITES[S.after].chapter.split(' · ')[1] + '」后解锁' : pr.done ? '已读完' : started ? '读到一半' : '未读') + '</p>' +
          '<div class="site-act">' + (!open ? '' : started ? '<button type="button" class="btn primary" data-go="' + id + '" data-from="cont">继续剧情</button><button type="button" class="btn" data-go="' + id + '" data-from="0">从头开始</button>'
            : '<button type="button" class="btn primary" data-go="' + id + '" data-from="0">' + (pr.done ? '重温剧情' : '进入') + '</button>') + '</div></div></article>';
      }).join('') + '</div>';
    }
    el.innerHTML = html;
  }
  function sPath(p, k) { k = k || 1; return 'M' + p.map(function (q) { return (q[0] * k).toFixed(1) + ',' + (q[1] * k).toFixed(1); }).join('L') + 'Z'; }
  function shipIcon() {
    return '<svg viewBox="-20 0 840 600" aria-hidden="true"><g transform="rotate(-8 400 300)"><path d="' + sPath(SHIP.outline) + '" transform="translate(0,22)" fill="#4b5260" stroke="#23222b" stroke-width="10"/>' +
      '<path d="' + sPath(SHIP.outline) + '" fill="#e6eaf0" stroke="#23222b" stroke-width="10" stroke-linejoin="round"/>' +
      '<path d="M60,330 C260,300 420,300 780,300 L780,330 C420,330 260,334 60,362 Z" fill="#c42f3a"/></g></svg>';
  }
  function deptOpen(n) { return n === '鄂州' || prog('board').done; }
  function deptSites(n) { return Object.keys(SITES).filter(function (id) { return SITES[id].dept === n; }); }
  function deptTodo(n) { return deptSites(n).filter(function (id) { return unlocked(id) && !prog(id).done; }).length; }
  // 舰体平面图：点击区域即传送
  function shipMap(P) {
    var g = SHIP.regions.map(function (r) {
      var d = DEPTS[r.n], open = deptOpen(r.n), todo = open && deptTodo(r.n), big = r.r > 22;
      return '<g class="dept' + (open ? ' open' : ' lockd') + (todo ? ' todo' : '') + '"' + (open ? ' data-area="' + r.n + '" tabindex="0" role="button" aria-label="传送到' + r.n + ' · ' + d[0] + '"' : '') + '>' +
        '<title>' + r.n + ' · ' + d[0] + '：' + d[1] + (open ? (todo ? '（有可进行的剧情）' : '（点击传送）') : '（登船后开放）') + '</title>' +
        '<path d="' + sPath(r.p) + '"/>' + '<text x="' + r.c[0] + '" y="' + (r.c[1] - (big ? 6 : 0)) + '" class="dn">' + d[0] + '</text>' +
        (big ? '<text x="' + r.c[0] + '" y="' + (r.c[1] + 11) + '" class="df">' + r.n + '</text>' : '') +
        (todo ? '<g transform="translate(' + (r.c[0] + (big ? 30 : 14)) + ',' + (r.c[1] - (big ? 20 : 14)) + ')"><g class="pin"><circle r="10"/><text y="4.5">!</text></g></g>' : '') + '</g>';
    }).join('');
    return '<figure class="shipmap"><svg viewBox="-60 20 880 560" role="img" aria-label="荆楚号舰体平面图">' +
      '<g class="eng">' + [[16, 398, 30], [20, 452, 26], [42, 510, 22], [130, 122, 24], [124, 74, 18]].map(function (e) { return '<path d="M' + (e[0] - 14) + ',' + (e[1] - e[2] / 2) + ' l-' + (e[2] * 1.6) + ',' + (e[2] * .3) + ' l0,' + (e[2] * .4) + ' l' + (e[2] * 1.6) + ',' + (e[2] * .3) + ' Z"/>'; }).join('') + '</g>' +
      '<path class="hull" d="' + sPath(SHIP.outline) + '"/>' + g + '<path class="hull-l" d="' + sPath(SHIP.outline) + '"/></svg>' +
      '<figcaption><span><i class="lg open"></i>可传送</span><span><i class="lg pin">!</i>有可进行的剧情</span><span><i class="lg"></i>登船后开放</span>船尾（西侧）是引擎，船头朝东。</figcaption></figure>';
  }
  // 区域：传送过来后，点击场景里的剧情点开始剧情
  function renderArea() {
    var n = ex.area, d = DEPTS[n], bg = AREA_BG[n], ids = deptSites(n);
    var mk = ids.map(function (id) {
      var S = SITES[id], pr = prog(id), open = unlocked(id), started = pr.at > 0 && !pr.done, pos = S.pos || [50, 60];
      var st = !open ? (S.need && prog(S.after).done ? S.needText : '读完「' + SITES[S.after].chapter.split(' · ')[1] + '」后开放') : pr.done ? '已读完 · 点击重温' : started ? '读到一半 · 点击继续' : '点击开始';
      return '<button type="button" class="mk' + (S.side ? ' side' : '') + (pr.done ? ' done' : '') + (open ? '' : ' locked') + '"' + (open ? ' data-go="' + id + '" data-from="' + (started ? 'cont' : '0') + '"' : ' disabled') + ' style="left:' + pos[0] + '%;top:' + pos[1] + '%">' +
        '<span class="mk-dot">' + (pr.done ? '✓' : open ? '!' : '锁') + '</span><span class="mk-lab"><b>' + S.chapter + '</b><small>' + st + '</small></span></button>';
    }).join('');
    var rw = ids.map(function (id) { var S = SITES[id], R = S.reward; return R ? '<li><b>' + S.chapter + '</b>：' + S.d + '<br><span class="hint">首次读完奖励：' + rwList(R).filter(Boolean).join('、') + (UNLOCK[id] ? '，并开放' + UNLOCK[id] : '') + (prog(id).rewarded ? '（已领取）' : '') + '</span></li>' : '<li><b>' + S.chapter + '</b>：' + S.d + '</li>'; }).join('');
    $('pg-explore').innerHTML = exHead('点击场景中的剧情点开始剧情。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ex-ship">‹ 返回舰体图</button><b>荆楚号 · ' + d[0] + '</b><span class="hint">' + n + ' · ' + d[1] + '</span></div>' +
      '<div class="area' + (ex.tp ? ' tp' : '') + '"><div class="area-scene">' +
      (bg ? '<img src="' + BG[bg] + '" alt="' + d[0] + '">' : '<div class="area-ph"><img src="' + CHARS.ship_icon + '" alt=""><b>' + d[0] + '</b><span>这片区域的具体样子还在建造中</span></div>') +
      mk + (n === '天门' ? hallSpots() : '') + bossSpots(n) +
      (n === '荆门' ? '<button type="button" class="mk shop' + (shopOpen() ? '' : ' locked') + '"' + (shopOpen() ? ' data-shop="1"' : ' disabled') + ' style="left:74%;top:40%"><span class="mk-dot">' + (shopOpen() ? '商' : '锁') + '</span><span class="mk-lab"><b>商城 · 物资兑换</b><small>' + (shopOpen() ? '普通捕捉装置和补药' : '读完「物资仓储」支线后开放') + '</small></span></button>' : '') +
      (n === '黄石' ? '<button type="button" class="mk shop" data-forge="1" style="left:50%;top:58%"><span class="mk-dot">炼</span><span class="mk-lab"><b>冶炼坊</b><small>合成捕捉装置、200血药等</small></span></button>' : '') +
      (n === '咸宁' ? '<button type="button" class="mk shop' + (spaOpen() ? '' : ' locked') + '"' + (spaOpen() ? ' data-spa="1"' : ' disabled') + ' style="left:66%;top:52%"><span class="mk-dot">' + (spaOpen() ? '泉' : '锁') + '</span><span class="mk-lab"><b>温泉疗养</b><small>' + (spaOpen() ? spaSummary() : '读完支线「温泉疗养」后开放') + '</small></span></button>' : '') +
      (n === '恩施' ? '<button type="button" class="mk shop' + (farmOpen() ? '' : ' locked') + '"' + (farmOpen() ? ' data-farm="1"' : ' disabled') + ' style="left:62%;top:58%"><span class="mk-dot">' + (farmOpen() ? '种' : '锁') + '</span><span class="mk-lab"><b>太空种植园</b><small>' + (farmOpen() ? '种药草，用来做 200血药' : '读完支线「伟大的种植园」后开放') + '</small></span></button>' : '') +
      (n === '黄冈' ? '<button type="button" class="mk shop' + (medalOpen() ? '' : ' locked') + '"' + (medalOpen() ? ' data-medal="1"' : ' disabled') + ' style="left:50%;top:18%"><span class="mk-dot">' + (medalOpen() ? '勋' : '锁') + '</span><span class="mk-lab"><b>授勋馆</b><small>' + (medalOpen() ? '所有称号和获得方式' : '读完支线「授勋馆」后开放') + '</small></span></button>' : '') +
      (n === '神农架' ? '<button type="button" class="mk shop" data-nursery="1" style="left:50%;top:58%"><span class="mk-dot">育</span><span class="mk-lab"><b>精灵保育仓</b><small>孵化精灵的精元</small></span></button>' : '') +
      (ids.length || n === '黄石' || n === '恩施' || n === '神农架' || n === '咸宁' ? '' : '<p class="area-empty">这里暂时没有剧情。</p>') +
      '<div class="tp-fx" aria-hidden="true"><span>传送至 ' + d[0] + '……</span></div></div>' +
      (ids.length ? '<ul class="area-list">' + rw + '</ul>' : '') + '</div>';
    ex.tp = false;
  }
  function teleport(n) { ex.view = 'area'; ex.area = n; ex.tp = true; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll('荆楚号 · ' + DEPTS[n][0]); }
  function planetSvg(id) {
    var P = planetOf(id); if (P && P.img) return planetImg(P, 120); if (P && P.color) return planetSvgC(P, 120);
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="36" fill="#cfe0f2" stroke="#23222b" stroke-width="3"/>' +
      '<path d="M36 44c8-6 16-4 20 2s12 4 14 10-6 12-14 12-6 10-14 10-14-8-12-16 0-14 6-18z M74 30c6 2 10 8 8 12s-8 2-10-2 0-10 2-10z M78 66c8-2 14 4 12 10s-10 8-14 4-4-12 2-14z" fill="#9cc79a" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="60" cy="60" rx="54" ry="14" fill="none" stroke="#c42f3a" stroke-width="2.5" stroke-dasharray="6 5" transform="rotate(-16 60 60)"/></svg>';
  }
  /* ---------- 芙罗拉星：挑战（关卡副本，未开放）+ 捕捉（随机野生精灵） ---------- */
  var WILD = WILD_POOLS, REGIONS = regionsOf('flora');   // 野外精灵表见 js/data/wild.js
  // 其他星球的示意图（立绘待补）：按星球主色画一个带纹路的圆
  function planetImg(P, w) { return '<img class="planet-img" src="' + P.img + '" alt="' + esc(P.name) + '" width="' + w + '" height="' + w + '">'; }   // 有星球立绘（P.img）的用图，没有的画示意图
  function planetSvgC(P, w) {
    var c = P.color, id = 'pc-' + P.id + w;
    var deco = { kamble: '<path d="M20 52c10-6 20 6 30 0s20-6 30 0 20 6 30 0M20 70c10-6 20 6 30 0s20-6 30 0 20 6 30 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>',
      pompeii: '<path d="M30 80l14-26 10 14 12-30 14 30 10-12 10 24z" fill="' + c[1] + '"/><path d="M58 40l4-14 4 14" stroke="#ffd36b" stroke-width="3" fill="none"/>',
      laiting: '<path d="M58 46l-8 18h11l-6 22 18-26H62l6-14z" fill="#fff6b0" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>',
      white: '<path d="M60 30v60M34 45l52 30M34 75l52-30" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="60" r="6" fill="#fff"/>' }[P.id] || '';
    if (P.belt) return '<svg viewBox="0 0 120 120" width="' + w + '" aria-hidden="true">' + [[30, 46, 13], [66, 36, 9], [86, 62, 15], [48, 80, 11], [20, 74, 7], [96, 30, 6]].map(function (r) { return '<ellipse cx="' + r[0] + '" cy="' + r[1] + '" rx="' + r[2] + '" ry="' + (r[2] * 0.8) + '" fill="#8b8576" stroke="#23222b" stroke-width="2.5"/>'; }).join('') +
      '<path d="M30 46L48 80M66 36L86 62M48 80L86 62" stroke="#d9b92a" stroke-width="2.5" stroke-dasharray="4 3"/>' + deco + '</svg>';
    return '<svg viewBox="0 0 120 120" width="' + w + '" aria-hidden="true"><defs><clipPath id="' + id + '"><circle cx="60" cy="60" r="36"/></clipPath></defs><g clip-path="url(#' + id + ')"><rect width="120" height="120" fill="' + c[0] + '"/>' + deco + '</g>' +
      '<circle cx="60" cy="60" r="36" fill="none" stroke="#23222b" stroke-width="3"/><ellipse cx="60" cy="60" rx="54" ry="13" fill="none" stroke="' + c[1] + '" stroke-width="2.5" stroke-dasharray="6 5" transform="rotate(-12 60 60)"/></svg>';
  }
  function floraSvg(w) {
    return '<svg viewBox="0 0 120 120" width="' + w + '" aria-hidden="true"><defs><clipPath id="fl-c' + w + '"><circle cx="60" cy="60" r="36"/></clipPath></defs>' +
      '<g clip-path="url(#fl-c' + w + ')"><rect width="120" height="120" fill="#9fd08a"/>' +
      '<path d="M20 20h60c-6 10-2 18 6 22-14 4-22 12-24 22-12-6-26-4-42 2z" fill="#3f7d4a"/>' +
      '<path d="M66 70c10-6 22-6 36 0v40H58c4-12 4-28 8-40z" fill="#ece8dc"/><path d="M72 84l8 4 6-6M84 98l10-4" stroke="#bdb7a6" stroke-width="2" fill="none"/>' +
      '<circle cx="36" cy="38" r="3" fill="#2c5e36"/><circle cx="46" cy="30" r="3.5" fill="#2c5e36"/><circle cx="30" cy="50" r="2.5" fill="#2c5e36"/>' +
      '<path d="M40 80c4-2 6 0 8 2M50 88c3-2 5-1 7 1M34 92c3-2 5-1 7 1" stroke="#5c9a4e" stroke-width="2" fill="none" stroke-linecap="round"/></g>' +
      '<circle cx="60" cy="60" r="36" fill="none" stroke="#23222b" stroke-width="3"/>' +
      '<ellipse cx="60" cy="60" rx="54" ry="13" fill="none" stroke="#3f7d4a" stroke-width="2.5" stroke-dasharray="6 5" transform="rotate(14 60 60)"/></svg>';
  }
  function regionArt(id) {
    var bgc = { forest: '#cfe5c4', grass: '#e4f1cf', salt: '#efece4', kb_sea: '#cfe8f6', pp_lava: '#f4d1b8', pp_city: '#f2c2a8', lt_belt: '#2e3142', wh_snow: '#eef6fb' }[id], g = '';
    if (id === 'kb_sea') g = '<path d="M0 60h160v40H0z" fill="#6fb3dd"/>' + [64, 74, 84, 94].map(function (y, k) { return '<path d="M0 ' + y + 'c20-6 20 6 40 0s20-6 40 0 20 6 40 0 20-6 40 0" stroke="#fff" stroke-width="2" fill="none" opacity="' + (0.9 - k * 0.15) + '"/>'; }).join('') + '<ellipse cx="112" cy="58" rx="26" ry="5" fill="#f4e3b2" stroke="#23222b" stroke-width="2"/><path d="M108 56c0-12 4-18 4-22M108 40c-6-4-12-2-14 2M110 38c4-6 12-6 14-2" stroke="#4f9159" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    else if (id === 'pp_lava') g = '<path d="M0 70h160v30H0z" fill="#3a2f2b"/><path d="M40 70l30-44 12 12 10-8 28 40z" fill="#5a4038" stroke="#23222b" stroke-width="2"/><path d="M76 30c-4-8 0-14 6-18" stroke="#9a9a9a" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/><path d="M10 84c20-4 30 6 50 2s30-8 50 0 30 4 40 0" stroke="#f26b2a" stroke-width="4" fill="none"/>';
    else if (id === 'lt_belt') g = [[24, 40, 12], [60, 66, 18], [104, 34, 10], [132, 70, 14], [86, 86, 8]].map(function (r) { return '<ellipse cx="' + r[0] + '" cy="' + r[1] + '" rx="' + r[2] + '" ry="' + (r[2] * 0.75) + '" fill="#8b8576" stroke="#111" stroke-width="2"/>'; }).join('') + '<path d="M36 40l14 10-6 4 12 10M114 36l8 14-6 2 8 14" stroke="#f1dd73" stroke-width="2.5" fill="none" stroke-linejoin="round"/>' + [[12, 14], [148, 20], [80, 12], [140, 92]].map(function (s) { return '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="1.5" fill="#fff"/>'; }).join('');
    else if (id === 'wh_snow') g = '<path d="M0 66c30-6 60-4 90 0s50 2 70-2v36H0z" fill="#fff" stroke="#23222b" stroke-width="2"/><path d="M20 66l18-30 14 18 10-10 20 22" fill="#d7e9f4" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>' + [[110, 20], [130, 40], [60, 18], [146, 14]].map(function (s) { return '<path d="M' + s[0] + ' ' + (s[1] - 5) + 'v10M' + (s[0] - 5) + ' ' + s[1] + 'h10" stroke="#7fb3d1" stroke-width="2" stroke-linecap="round"/>'; }).join('');
    if (id === 'forest') g = [[18, 70, 1], [42, 62, 1.3], [70, 68, 1.1], [96, 60, 1.4], [120, 70, 1], [146, 64, 1.2]].map(function (t) { var x = t[0], y = t[1], k = t[2]; return '<path d="M' + x + ' ' + (y + 30) + 'v' + (-12 * k) + '" stroke="#5b4636" stroke-width="' + (3 * k) + '"/><path d="M' + x + ' ' + (y - 26 * k) + 'l' + (14 * k) + ' ' + (26 * k) + 'h' + (-28 * k) + 'z" fill="#3f7d4a" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/><path d="M' + x + ' ' + (y - 14 * k) + 'l' + (17 * k) + ' ' + (24 * k) + 'h' + (-34 * k) + 'z" fill="#4f9159" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>'; }).join('');
    else if (id === 'grass') g = '<path d="M0 72c40-10 80-10 160 0v28H0z" fill="#a9d38b" stroke="#23222b" stroke-width="2"/>' + [12, 30, 52, 74, 96, 118, 140].map(function (x, i) { return '<path d="M' + x + ' 92c2-10 4-16 8-22M' + (x + 6) + ' 92c0-8-2-14-6-20M' + (x + 10) + ' 92c3-6 6-9 10-12" stroke="#4f9159" stroke-width="2.2" fill="none" stroke-linecap="round"/>' + (i % 2 ? '<circle cx="' + (x + 4) + '" cy="' + (66 + i) + '" r="2.6" fill="#f2c94c" stroke="#23222b" stroke-width="1"/>' : ''); }).join('') + '<path d="M18 30c10-4 18-4 26 0M100 22c12-4 22-4 30 2" stroke="#9aa5b8" stroke-width="2" fill="none" stroke-linecap="round"/>';
    else if (id === 'salt') g = '<path d="M0 66h160v34H0z" fill="#e3ded0" stroke="#23222b" stroke-width="2"/><path d="M14 80l14 4 10-6 16 8M70 74l12 8 18-4 10 8M118 82l14-6 16 6M30 92l20-2M92 92l24 2" stroke="#b5ad98" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M98 66c0-18 8-30 14-34 2 10 8 14 12 10 2 8 0 18-4 24z" fill="#6d6a75" stroke="#23222b" stroke-width="2" stroke-linejoin="round" opacity=".55"/><text x="110" y="52" text-anchor="middle" font-size="16" fill="#fff" font-family="Long Cang, KaiTi, cursive">?</text>';
    return '<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="100" fill="' + bgc + '"/>' + g + '</svg>';
  }
  function wildKnown(sid) { return owned(sid) ? 'own' : acc.seen && acc.seen[sid] !== undefined ? 'seen' : ''; }
  function invLine() {
    var cap = ['cap1', 'cap2', 'cap3'].map(function (k) { return ITEMS[k].name.replace('精灵捕捉装置', '') + ' ×' + (acc.items[k] || 0); }).join('　');
    var pot = ['pot1', 'pot2', 'pot200'].map(function (k) { return ITEMS[k].name + ' ×' + (acc.items[k] || 0); }).join('　');
    return '<div class="inv"><span><b>捕捉装置</b>　' + cap + '</span><span><b>补药</b>　' + pot + '</span>' +
      (shopOpen() ? '<button type="button" class="btn" data-goshop="1">去物资仓储兑换</button>' : '<span class="hint">在荆楚号 · 荆门 · 物资仓储读完支线后开放商城</span>') + '</div>';
  }
  function floraPage() {
    var part = ex.fpart || 'catch';
    var head = '<div class="flora-hero"><span class="tape l"></span>' + planetImg(planetOf('flora'), 150) + '<div><h3>芙罗拉星 <span class="chip ptype">草系星球</span></h3><p class="hint">地表分为丛林、草甸、盐碱地三片区域。</p>' +
      '<div class="fparts" role="tablist"><button type="button" role="tab" class="tab' + (part === 'challenge' ? ' on' : '') + '" data-fpart="challenge" aria-selected="' + (part === 'challenge') + '">挑战</button><button type="button" role="tab" class="tab' + (part === 'catch' ? ' on' : '') + '" data-fpart="catch" aria-selected="' + (part === 'catch') + '">捕捉</button>' + taskTab('flora', part) + '</div></div></div>';
    // 剧情页（2026-10-17）：分「主线」「支线」两栏，从上往下是 新 → 旧
    var flSites = PLANETS.filter(function (p) { return p.id === 'flora'; })[0].sites, stab = ex.flSt === 'side' ? 'side' : 'main';
    var stCard = function (id) {
      var S = SITES[id], pr = prog(id), started = pr.at > 0 && !pr.done, lock = !unlocked(id);
      if (lock && !prog(S.after).done) return '';   // 前一段还没读完的不显示
      if (lock) return '<article class="site fl-story locked"><span class="tape r"></span><div class="site-img"><img src="' + BG[S.bg] + '" alt=""></div><div class="site-txt"><span class="sc-tag">' + S.chapter + '</span><h3>' + S.name + '</h3><p class="hint">' + S.d + '</p>' +
        '<p class="site-st red">任务：' + esc(S.needText) + (id === 'flora3' ? '（' + spareN() + ' / ' + SPARE_N + '）' : '') + '</p><div class="site-act"><button type="button" class="btn primary" data-fpart="catch">去丛林 / 草甸</button></div></div></article>';
      return '<article class="site fl-story"><span class="tape r"></span><div class="site-img"><img src="' + BG[S.bg] + '" alt=""></div><div class="site-txt"><span class="sc-tag">' + S.chapter + '</span><h3>' + S.name + '</h3><p class="hint">' + S.d + '</p>' +
        (S.reward ? '<p class="hint">首次读完奖励：' + rwList(S.reward).join('、') + (pr.rewarded ? '（已领取）' : '') + '</p>' : '') +
        '<p class="site-st ' + (pr.done ? 'blue' : started ? 'red' : '') + '">' + (pr.done ? '已读完' : started ? '读到一半' : '未读') + '</p><div class="site-act">' +
        (started ? '<button type="button" class="btn primary" data-go="' + id + '" data-from="cont">继续剧情</button><button type="button" class="btn" data-go="' + id + '" data-from="0">从头开始</button>' : '<button type="button" class="btn primary" data-go="' + id + '" data-from="0">' + (pr.done ? '重温剧情' : '进入') + '</button>') + '</div></div></article>';
    };
    var isNew = function (id) { return unlocked(id) && !prog(id).done; };
    var mainIds = flSites.filter(function (id) { return !SITES[id].side; }), sideIds = flSites.filter(function (id) { return SITES[id].side; });
    var listOf = function (ids) { var h = ids.slice().reverse().map(stCard).join(''); return h || '<p class="hint fl-none">暂时还没有可以阅读的剧情。</p>'; };
    var nM = mainIds.some(isNew), nS = sideIds.some(isNew);
    var sp = '<div class="fparts st-tabs" role="tablist"><button type="button" role="tab" class="tab' + (stab === 'main' ? ' on' : '') + '" data-flst="main" aria-selected="' + (stab === 'main') + '">主线' + (nM ? '<i class="q-badge">!</i>' : '') + '</button>' +
      '<button type="button" role="tab" class="tab' + (stab === 'side' ? ' on' : '') + '" data-flst="side" aria-selected="' + (stab === 'side') + '">支线' + (nS ? '<i class="q-badge">!</i>' : '') + '</button></div>' +
      listOf(stab === 'side' ? sideIds : mainIds);
    head = head + (prog('flora1').done ? '' : listOf(mainIds));
    // 有新的主线可以读时，「剧情」页签上显示红点
    var newMain = flSites.some(isNew);
    if (prog('flora1').done) head = head.replace('<div class="fparts" role="tablist">', '<div class="fparts" role="tablist"><button type="button" class="tab' + (part === 'story' ? ' on' : '') + '" data-fpart="story">剧情' + (newMain ? '<i class="q-badge">!</i>' : '') + '</button>');
    if (part === 'story') return head + sp;
    if (part === 'task') return head + planetTasks('flora');
    if (part === 'challenge') return head + chalPage('flora');
    var regs = REGIONS.map(function (R) {
      var BK = Object.keys(BOSSES).filter(function (k) { return BOSSES[k].region === R.id; })[0], locked = !prog('flora1').done;
      return '<article class="region' + (locked ? ' locked' : '') + '"><div class="rg-art">' + (R.bgs && BG[R.bgs[0]] ? '<img src="' + BG[R.bgs[0]] + '" alt="' + R.name + '">' + (R.bgs.length > 1 ? '<span class="rg-more">' + R.bgs.slice(1).map(function (k) { return '<img src="' + BG[k] + '" alt="">'; }).join('') + '</span>' : '') : regionArt(R.id)) + '</div><div class="rg-txt"><h4>' + R.name + ' <small>' + R.en + '</small></h4><p class="hint">' + R.d + '</p>' +
        (BK ? '<p class="rg-boss">首领 · ' + BOSSES[BK].name + '　<span>' + (bossOpen(BK) ? BOSSES[BK].lv.filter(function (L, i) { return levelOpen(BK, i); }).map(function (L) { return L.diff; }).join(' / ') + ' 难度可挑战' : '暂未开放') + '</span></p>' +
          (prog('flora1').done ? '<button type="button" class="btn primary" data-field="' + R.id + '">进入' + R.name + '</button>' + (bossOpen(BK) ? '' : '<p class="hint">首领「' + BOSSES[BK].name + '」：' + BOSSES[BK].lv[0].lockText + '</p>') : '<button type="button" class="btn" disabled>读完主线「降临芙罗拉」后开放</button>') :
          locked ? '<p class="rg-boss">首领 · ' + R.boss + '　<span>暂未开放</span></p>' : prog('flora1').done ? '<button type="button" class="btn primary" data-field="' + R.id + '">进入' + R.name + '</button>' : '<button type="button" class="btn" disabled>读完主线「降临芙罗拉」后开放</button>') + '</div></article>';
    }).join('');
    var sids = [];
    REGIONS.forEach(function (R) { (WILD[R.pool] || []).forEach(function (w) { if (sids.indexOf(w.sid) < 0) sids.push(w.sid); }); });
    var list = sids.map(function (sid) {
      var w, where = [];
      REGIONS.forEach(function (R) { (WILD[R.pool] || []).forEach(function (x) { if (x.sid === sid) { w = x; where.push(R.name + ' ' + x.w + '%'); } }); });
      var k = wildKnown(sid), f = form({ sid: sid, lv: w.lv[0] }), sid_ = sid;
      return '<li class="wl ' + (k || 'unk') + '">' + (k ? '<img src="' + f.img + '" alt="">' : silTag(sid_, f.stage)) + '<span><b>' + (k ? esc(f.name) : '？？？') + '</b>' + (w.rare ? '<span class="chip rare">稀有</span>' : '') +
        '<small>LV' + (w.lv[0] === w.lv[1] ? w.lv[0] + '（固定）' : w.lv[0] + '–' + w.lv[1]) + ' · 捕捉率' + w.tag + '</small><small>出现：' + where.join('，') + '</small>' +
        '<small class="wk">' + (k === 'own' ? '已捕捉' : k === 'seen' ? '见过 · 未捕捉' : '未遇见') + '</small></span></li>';
    }).join('');
    var spareTip = spareActive() ? '<div class="spare-note"><span class="tape l"></span><b>主线任务 · 引出猎杀者</b>　手下留情：现在丛林和草甸里的野生精灵不会倒下，体力剩 1 点时就会逃走，算作「假装击败」。已完成 <b>' + spareN() + ' / ' + SPARE_N + '</b>。</div>' : '';
    return head + spareTip + invLine() + '<div class="regions">' + regs + '</div>' +
      '<div class="wild-list"><h4>芙罗拉星的野生精灵</h4><ul>' + list + '</ul><p class="hint">进入丛林或草甸后，精灵会在场景里走动，点中哪只就和哪只对战。对战中可以在「道具」页使用捕捉装置和补药，使用道具会占用一回合；把它打虚弱、或让它陷入异常状态，更容易捕捉成功。打倒野生精灵会获得经验（对方等级越高越多）：70% 平分给出战过的精灵，30% 放进经验背包；同时出战过的精灵获得学习力（对方 LV1–25 得 1 点，LV26–50 得 2 点，LV51–100 得 3 点）。捕捉不算击败，没有经验和学习力。</p></div>';
  }
  function invCopy() { var o = {}; ITEM_ORDER.forEach(function (k) { o[k] = acc.items[k] || 0; }); return o; }
  function useInv(k) { acc.items[k] = Math.max(0, (acc.items[k] || 0) - 1); save(); }
  // 每天通过 PVE 战斗直接获得的经验上限（击败精灵的经验，含进经验背包的那部分；首领首通、任务等奖励不算）
  var PVE_XP_CAP = 200000;   // 2026-10-17：120000 → 200000
  function pveLeft() { var d = dayStr(); if (!acc.pveXp || acc.pveXp.d !== d) acc.pveXp = { d: d, n: 0 }; return Math.max(0, PVE_XP_CAP - acc.pveXp.n); }
  // 击败一只精灵：经验 = 等级² × 2 + 20；学习力按对方等级 1 / 2 / 3 点
  function foeExp(lv) { return lv * lv * 2 + 20; }
  function foeEv(lv) { return lv <= 25 ? 1 : lv <= 50 ? 2 : 3; }
  function battleRewards(team, seen, downs) {
    downs = downs || []; if (!downs.length) return [];
    var parts = team.filter(function (x, i) { return seen && seen[i]; }); if (!parts.length) parts = team.slice(0, 1);
    var xp = 0, ev = 0; downs.forEach(function (d) { xp += foeExp(d.lv); ev += foeEv(d.lv); });
    var raw = xp, left = pveLeft(); xp = Math.min(xp, left); acc.pveXp.n += xp;
    var share = Math.floor(xp * 0.7 / parts.length), pool = xp - share * parts.length, out = [];
    if (xp > 0) {
      acc.exp = (acc.exp || 0) + pool;
      out.push('击败了 ' + downs.length + ' 只精灵，共获得 ' + fmt(xp) + ' 点经验' + (xp < raw ? '（今天的战斗经验已达上限 ' + fmt(PVE_XP_CAP) + '）' : '') + '：');
      var lines = parts.map(function (m) { return gainExp(m, share); }).filter(Boolean);
      out.push(lines.join(''));
      out.push('经验背包 +' + fmt(pool) + '。');
    } else out.push('击败了 ' + downs.length + ' 只精灵。今天通过战斗获得的经验已达上限（' + fmt(PVE_XP_CAP) + '），明天再来吧。');
    var got = giveEv(parts.map(function (x) { return x.u; }), ev);
    if (got.length) out.push(got.join('、') + (got.length > 1 ? ' 各' : ' ') + '获得 ' + ev + ' 点学习力。');
    save(); return out;
  }
  /* ---------- 野外场景：精灵在各自的范围内走动，点中才开战 ----------
   * 种类、等级、捕捉率、异色在出现时就用 rollWild 抽好，点到的就是打到的。
   * 芙罗拉的瘴气仍在点击进入战斗时判定。回到场景时，这只离开，再抽一只补上同一片范围。 */
  var FIELD_SLOTS = [
    { hx: 22, hy: 72, r: 10 },
    { hx: 42, hy: 56, r: 9 },
    { hx: 64, hy: 74, r: 10 },
    { hx: 82, hy: 58, r: 8 }
  ];
  var fields = {}, fieldTick = null, fieldRefresh = null;
  // 采集点的位置写死，不放进 fields：换一批精灵、重新进入区域都不会挪走或再抽一次
  var GATHER_SPOTS = [
    { x: 18, y: 86 },
    { x: 78, y: 46 }
  ];
  var GATHER = {
    forest: { item: 'g_sand', n: 12 }, grass: { item: 'g_sand', n: 12 },
    kb_sea: { item: 'g_sand', n: 12 }, pp_lava: { item: 'g_sand', n: 12 }, pp_city: { item: 'g_sand', n: 12 },
    lt_belt: { item: 'g_core', n: 1 }, wh_snow: { item: 'g_core', n: 1 }
  };
  function gatherRec() {
    var day = dayNum(Date.now());
    if (!acc.gather || acc.gather.day !== day || !acc.gather.got) acc.gather = { day: day, got: {} };
    return acc.gather;
  }
  function gatherKey(rid, i) { return rid + ':' + i; }
  function gatherNodesHTML(rid, scene, n) {
    var g = GATHER[rid]; if (!g || !GATHER_ITEMS[g.item]) return '';
    var got = gatherRec().got, name = GATHER_ITEMS[g.item].name;
    return GATHER_SPOTS.map(function (s, i) {
      if (n && i % n !== scene) return '';   // 采集点分散在不同场景里
      var done = !!got[gatherKey(rid, i)];
      return '<button type="button" class="wf-node' + (done ? ' done' : '') + '" data-gather="' + i + '" style="left:' + s.x + '%;top:' + s.y + '%" title="' + (done ? '今天已采集' : '采集' + name + ' ×' + g.n) + '" aria-label="' + (done ? name + '，今天已经采集过' : '采集' + name + ' ×' + g.n) + '"><i class="wf-gem" aria-hidden="true"></i><span>' + (done ? '已采集' : name) + '</span></button>';
    }).join('');
  }
  function gatherAt(i) {
    if (ex.fighting) return;
    var R = regionById(ex.region), g = R && GATHER[R.id];
    if (!g || i < 0 || i >= GATHER_SPOTS.length) return;
    var rec = gatherRec(), key = gatherKey(R.id, i), name = GATHER_ITEMS[g.item].name;
    if (rec.got[key]) { toast('这个采集点今天已经采过了，明天再来。'); return; }
    rec.got[key] = 1;
    var gain = {}, extra = '';
    gain[g.item] = g.n;
    if ((R.id === 'forest' || R.id === 'grass') && !acc.herbSeed) {
      acc.herbSeed = 1; gain.s_herb = 4; extra = '，另外找到了药草种子 ×4';
    }
    giveItems(gain); save();
    toast('采集到了「' + name + '」×' + g.n + extra + '，已放入储存箱。');
    var el = document.querySelector('#wf-scene [data-gather="' + i + '"]');
    if (!el) return;
    el.classList.add('done');
    el.title = '今天已采集';
    el.setAttribute('aria-label', name + '，今天已经采集过');
    var sp = el.querySelector('span'); if (sp) sp.textContent = '已采集';
  }
  /* ---------- 一碗饭和米饭火鸡 ----------
   * 芙罗拉星的野外战斗：每击败一只野生精灵，10% 掉落水稻种子。种植园 12 小时收获米饭 ×250，冶炼坊 500 粒米饭 = 一碗饭。
   * 一碗饭可以放在庞贝星熔岩原的任意一个场景（acc.riceBowl = { rid, si }），之后这个场景每次刷新精灵有 2% 是米饭火鸡（平时不出现）。
   * 捕捉或击败这只米饭火鸡后，这碗饭被吃掉（acc.riceBowl 清空）；逃跑或输了，饭还在。 */
  var RICE = { seedDrop: 0.1, sid: 'turkey', lv: 12, rate: 0.45, chance: 0.02, regions: ['pp_lava'] };
  function riceBowlAt(rid, si) { var b = acc && acc.riceBowl; return !!(b && b.rid === rid && b.si === si); }
  function riceSpawn(R, slot) {
    if (slot.si == null || !riceBowlAt(R.id, slot.si) || Math.random() >= RICE.chance) return null;
    var w = (WILD[R.pool] || []).filter(function (x) { return x.sid === RICE.sid; })[0] || { sid: RICE.sid, lv: [RICE.lv, RICE.lv], rate: RICE.rate, tag: '中等', rare: true };
    return { w: w, lv: w.lv[0], bait: true };
  }
  function riceBowlHTML(R, si) {
    if (RICE.regions.indexOf(R.id) < 0) return '';
    if (riceBowlAt(R.id, si)) return '<div class="wf-bowl" title="一碗米饭，等着爱吃米饭的精灵来吃"><span class="wf-bowl-ic" aria-hidden="true">' + H.itemIcon('c_bowl') + '</span><span>一碗米饭</span></div>';
    if (acc.riceBowl || !(acc.items.c_bowl > 0)) return '';
    return '<button type="button" class="wf-bowl put" data-bowl="1"><span class="wf-bowl-ic" aria-hidden="true">' + H.itemIcon('c_bowl') + '</span><span>放下一碗饭</span></button>';
  }
  function putBowl() {
    var R = regionById(ex.region), F = R && fields[R.id];
    if (!F || RICE.regions.indexOf(R.id) < 0 || acc.riceBowl || !(acc.items.c_bowl > 0)) return;
    acc.items.c_bowl--; acc.riceBowl = { rid: R.id, si: F.scene, t: Date.now() }; save();
    toast('你在这里放下了一碗香喷喷的米饭。等一等，说不定会有爱吃米饭的精灵闻着味道过来……');
    renderField();
  }
  /* ---------- 旅行精灵叶子喵 ----------
   * 全服共享的时间表（按北京时间每个整点算，所有人算出来都一样，不需要服务器）：每小时在某个区域的某个场景停留连续 20 分钟。
   * 每次出现（按小时编号 h 区分）每人只能挑战 1 次（开战就算，acc.travel = { h }），LV30，不能捕捉。
   * 击败：累积经验 ×3000，50% 掉落叶子喵的叶片（5 片在冶炼坊合成精元，精元在神农架 · 精灵保育仓孵化）。 */
  var TRAVEL = { sid: 'leafcat', lv: 30, exp: 3000, leaf: 0.5, dur: 20, regions: ['forest', 'grass', 'kb_sea', 'pp_lava', 'pp_city', 'lt_belt', 'wh_snow'],
    spots: [{ x: 50, y: 64 }, { x: 32, y: 62 }, { x: 70, y: 66 }] };
  function thash(h) { var x = (h * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995) >>> 0; x ^= x >>> 15; return x >>> 0; }
  function sceneCount(R) { return Math.max(R.pool ? 2 : 1, (R.bgs || []).filter(function (k) { return BG[k]; }).length); }
  function travelAt(now) {
    var h = Math.floor(now / 3600000), s = thash(h + 7919), start = h * 3600000 + (s % 41) * 60000;
    var R = regionById(TRAVEL.regions[(s >>> 8) % TRAVEL.regions.length]);
    return { h: h, start: start, end: start + TRAVEL.dur * 60000, rid: R.id, si: (s >>> 16) % sceneCount(R), spot: TRAVEL.spots[(s >>> 20) % TRAVEL.spots.length], active: now >= start && now < start + TRAVEL.dur * 60000 };
  }
  function travelOpen() { return !!acc && prog('travelcat').done; }   // 读完世界任务「旅行猫」后才会出现
  function travelDone(h) { return !!(acc && acc.travel && acc.travel.h === h); }
  function travelHTML(R, si) {
    var t = travelAt(Date.now()); if (!travelOpen() || !t.active || t.rid !== R.id || t.si !== si) return '';   // 切磋过也不会消失，停留满 20 分钟才走
    var f = form({ sid: TRAVEL.sid, lv: TRAVEL.lv }), met = travelDone(t.h);
    return '<button type="button" class="wf-mon wf-travel' + (met ? ' met' : '') + '" data-travel="' + t.h + '" title="旅行精灵 · ' + esc(f.name) + ' LV' + TRAVEL.lv + '" aria-label="和旅行精灵' + esc(f.name) + '对战" style="left:' + t.spot.x + '%;top:' + t.spot.y + '%;z-index:' + t.spot.y + '"><i class="wf-sh" aria-hidden="true"></i><img src="' + f.img + '" alt=""><span class="wf-tag">' + (met ? '旅行精灵 · 已切磋' : '旅行精灵') + '</span></button>';
  }
  // 区域里的首领（盐碱地的荒芜）：直接画在场景里，点它进首领页；没开放时显示开放条件
  function fieldBossHTML(R) {
    var BK = Object.keys(BOSSES).filter(function (k) { return BOSSES[k].region === R.id; })[0]; if (!BK) return '';
    var B = BOSSES[BK], open = bossOpen(BK);
    return '<button type="button" class="wf-mon wf-boss' + (open ? '' : ' locked') + '"' + (open ? ' data-boss="' + BK + '" data-from="field"' : ' disabled') + ' title="首领 · ' + esc(B.name) + '" style="left:58%;top:78%;z-index:78"><i class="wf-sh" aria-hidden="true"></i><img src="' + SPRITES[B.sid] + '" alt="' + esc(B.name) + '">' +
      '<span class="wf-tag">' + (open ? '首领 · ' + esc(B.name) + '（点击挑战）' : '首领 · ' + esc(B.name) + ' · ' + esc(B.lv[0].lockText)) + '</span></button>';
  }
  function engageTravel(h) {
    if (ex.fighting) return;
    var R = regionById(ex.region), F = R && fields[R.id], t = travelAt(Date.now());
    if (!F || t.h !== h || !t.active || t.rid !== R.id || t.si !== F.scene) { toast('叶子喵已经背起行囊，去别的地方旅行了。'); renderField(); return; }
    if (!travelOpen()) return;
    var P = planetOf(R.planet), left = Math.max(1, Math.ceil((t.end - Date.now()) / 60000));
    if (travelDone(h)) {   // 已经切磋过：聊两句，不能再打
      travelDlg(pickOne(TRAVEL_TALK.after).map(function (x) { return x.replace('{left}', left); }), [['再见', null]]);
      return;
    }
    travelDlg(pickOne(TRAVEL_TALK.hello).map(function (x) { return x.replace('{where}', R.name).replace('{planet}', P.name); }), [['下次再说', null], ['开始切磋', function () {
      var t2 = travelAt(Date.now());
      if (t2.h !== h || !t2.active || travelDone(h) || ex.fighting) { toast('叶子喵已经背起行囊，去别的地方旅行了。'); renderField(); return; }
      acc.travel = { h: h }; save();
      var sc = F.scenes[F.scene];
      stopField();
      startWildBattle({ sid: TRAVEL.sid, lv: TRAVEL.lv, rate: 0, noCatch: true, foe: '旅行精灵', bg: sc.bg || null, back: R.name, where: P.name + ' · ' + R.name + ' · 旅行精灵', travel: true });
    }]]);
  }
  // 叶子喵的台词：hello 开战前（{where} 区域、{planet} 星球），win / lose / quit 战斗结束后，after 切磋过之后再点她（{left} 剩余分钟）
  var TRAVEL_TALK = {
    hello: [
      ['{name}！我们又见面啦！', '我刚旅行到{where}，就碰到你了。上次你帮了我，这次我可要拿出真本事了——来切磋一下吧！'],
      ['咦，这不是{name}吗？真巧！', '{planet}的风景好特别，我一路走一路练，已经变强好多了。要不要比划比划？'],
      ['嘿！{name}，这边这边！', '我就知道会在旅行的路上遇见你。别忘了我们说好的——碰到了就要切磋一下！'],
      ['又见面啦，{name}！', '你看，我已经走到{where}了！族里的长辈要是知道，肯定会吓一跳吧。来吧，让我看看你变强了多少！']
    ],
    win: [
      ['好、好厉害……！', '你和你的精灵配合得真好，我输得心服口服。我在这儿再看看风景，过一会儿才出发——下次我一定会赢你的！'],
      ['唔……又输给你了。', '不过我一点都不沮丧哦！跟你切磋，比一个人练习有意思多了。我会在这里再待一阵子，下次见！']
    ],
    lose: [
      ['嘿嘿，这次是我赢啦！', '你的精灵也很努力哦。我会在这里再待一会儿，下次见面，我们再好好比一场！'],
      ['看到了吗？这就是旅行的成果！', '别灰心，你已经很强了。等你再练练，下次说不定就是你赢啦！']
    ],
    quit: [
      ['诶？你要走了吗？', '那下次见面再好好比一场吧！我会在这里再待一会儿。']
    ],
    after: [
      ['今天的切磋就到这里吧！', '我在这儿看看风景，大概再过 {left} 分钟就要出发去下一个地方了。路上碰到我，记得再来找我哦！'],
      ['嗯？还想再比一场吗？', '今天不行啦，我得留点力气赶路。再过 {left} 分钟我就要出发了，下次见！']
    ]
  };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function travelDlg(lines, btns) {
    var f = form({ sid: TRAVEL.sid, lv: TRAVEL.lv }), d = document.createElement('div'); d.className = 'soc-dlg npc-dlg travel-dlg';
    d.innerHTML = '<div class="soc-box npc-box" role="dialog" aria-modal="true" aria-label="叶子喵"><span class="tape l"></span><span class="tape r"></span>' +
      '<img class="npc-face travel-face" src="' + f.img + '" alt="叶子喵"><div class="npc-say"><span class="step">叶子喵</span>' + lines.map(function (x, i) { return '<p class="' + (i ? 'hint' : 'npc-line') + '">' + esc(fill(x)) + '</p>'; }).join('') +
      '<div class="soc-foot">' + btns.map(function (b, i) { return '<button type="button" class="btn' + (i === btns.length - 1 ? ' primary' : ' ghost') + '" data-tbtn="' + i + '">' + esc(b[0]) + '</button>'; }).join('') + '</div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tbtn]');
      if (e.target === d || b) { d.remove(); var fn = b && btns[+b.dataset.tbtn][1]; if (fn) fn(); }
    });
  }
  function regionById(rid) { for (var i = 0; i < WILD_REGIONS.length; i++) if (WILD_REGIONS[i].id === rid) return WILD_REGIONS[i]; return null; }
  function stopField() {
    if (fieldTick) { clearInterval(fieldTick); fieldTick = null; }
    if (fieldRefresh) { clearInterval(fieldRefresh); fieldRefresh = null; }
  }
  function stepFieldMon(m, dt) {
    var prev = m.x;
    m.t += m.spd * dt;
    m.x = Math.max(10, Math.min(90, m.hx + Math.cos(m.t) * m.r));
    m.y = Math.max(48, Math.min(88, m.hy + Math.sin(m.t * 0.85) * m.r * 0.5));
    if (m.x > prev + 0.02) m.face = 1; else if (m.x < prev - 0.02) m.face = -1;
  }
  function spawnFieldMon(R, slot) {
    var hit = riceSpawn(R, slot) || rollWild(R.pool, (typeof WILD_SCENE !== 'undefined' && WILD_SCENE[slot.bgKey]) || null), shiny = rollShiny(hit.w);
    var corrupt = R.planet === 'flora' && floraFallen();
    if (corrupt) hit = { w: hit.w, lv: 40 + Math.floor(Math.random() * 11) };   // 瘴气化后：强制 LV40–50
    var f = form({ sid: hit.w.sid, lv: hit.lv, shiny: shiny });
    var img = f.img, name = f.name;
    if (corrupt) {   // 不论实际等级，一律显示最高阶段的立绘（本作里形态只影响显示，不影响能力值，见 assets.js 的说明）
      var s = SPMAP[hit.w.sid];
      img = shiny === 2 ? (SHINY_SPRITES[hit.w.sid + '_2'] || SHINY_SPRITES[hit.w.sid] || SPRITES[hit.w.sid]) : shiny ? (SHINY_SPRITES[hit.w.sid] || SPRITES[hit.w.sid]) : SPRITES[hit.w.sid];
      var fxs = FORM_FX_SPRITES[hit.w.sid]; if (fxs) img = (shiny === 2 ? fxs.miasmaShiny2 : shiny ? fxs.miasmaShiny : fxs.miasma) || fxs.miasma || img;   // 有瘴气侵染立绘的（玛西露姆）直接用
      name = '瘴气' + s.name;
    }
    var m = { id: 0, sid: hit.w.sid, lv: hit.lv, rate: hit.w.rate, shiny: shiny, img: img, name: (shiny && !corrupt ? '异色' : '') + name, bait: !!hit.bait, corrupt: corrupt,
      hx: slot.hx, hy: slot.hy, r: slot.r, t: Math.random() * Math.PI * 2, spd: 0.55 + Math.random() * 0.5, x: slot.hx, y: slot.hy, face: 1 };
    stepFieldMon(m, 0);
    return m;
  }
  /* 一个区域有好几个场景（有几张背景就有几个，至少 2 个），左右箭头切换；每个场景各有 4 个精灵位置。
   * 每只精灵各自计时：待一会儿（FIELD_LIFE）就淡出离开，隔一小段时间（FIELD_GAP）再在同一片范围里出现一只新的，互不影响。
   * 采集点：第 i 个放在第 i 个场景里（场景比采集点少时轮着放）。 */
  var FIELD_LIFE = [14000, 32000], FIELD_GAP = [1500, 6000], FIELD_FADE = 600;
  function between(r) { return r[0] + Math.random() * (r[1] - r[0]); }
  function fillSlot(R, F, slot, now, first) {
    var m = spawnFieldMon(R, slot); m.id = ++F.seq;
    m.die = now + (first ? Math.random() * FIELD_LIFE[1] + 4000 : between(FIELD_LIFE));   // 刚进来时错开，不会一起走
    slot.mon = m; slot.next = 0; return m;
  }
  function fieldState(rid) {
    var R = regionById(rid); if (!R) return null;   // 没有野外表（R.pool）的区域（盐碱地）也能进，只是没有野生精灵
    if (!fields[rid]) {
      var bgs = (R.bgs || []).filter(function (k) { return BG[k]; }), n = sceneCount(R), now = Date.now();
      var fallen = R.planet === 'flora' && floraFallen();
      if (fallen) { bgs = bgs.map(floraBg); if (R.id === 'forest') bgs.push('fl_jungle_corrupt'); }   // 瘴气化之后：每个场景换成画了深紫色脉络的 *_mia 版本，丛林再多一张瘴气丛林
      var F = fields[rid] = { seq: 0, scene: Math.floor(Math.random() * n), scenes: [] };
      for (var i = 0; i < n; i++) {
        var sc = { bgKey: bgs.length ? bgs[i % bgs.length] : '', bg: bgs.length ? BG[bgs[i % bgs.length]] : '', flip: i >= bgs.length && i % 2 === 1, corrupt: fallen && !/_mia$|_corrupt$/.test(bgs[i % bgs.length] || ''), slots: FIELD_SLOTS.map(function (s) { return { hx: s.hx, hy: s.hy, r: s.r, mon: null, next: 0 }; }) };
        sc.slots.forEach(function (sl) { sl.si = i; sl.bgKey = sc.bgKey; if (R.pool) fillSlot(R, F, sl, now, true); });
        F.scenes.push(sc);
      }
    }
    return fields[rid];
  }
  function loadField(rid) { delete fields[rid]; return fieldState(rid); }
  // 不在眼前的场景：按时间补算（离开的离开、该出现的出现）
  function catchUp(R, F, sc, now) {
    sc.slots.forEach(function (sl) {
      if (sl.mon && now >= sl.mon.die + FIELD_FADE) { sl.next = sl.mon.die + FIELD_FADE + between(FIELD_GAP); sl.mon = null; }
      if (!sl.mon && now >= sl.next && R.pool) fillSlot(R, F, sl, now);
    });
  }
  function replaceFieldMon(rid, id) {   // 打完、抓到或逃走：这只离开，过一会儿再补一只
    var F = fields[rid]; if (!F) return;
    F.scenes.forEach(function (sc) { sc.slots.forEach(function (sl) { if (sl.mon && sl.mon.id === id) { sl.mon = null; sl.next = Date.now() + between(FIELD_GAP); } }); });
  }
  function enterField(rid) {
    var R = regionById(rid); if (!R || !regionOpen(R)) return;
    loadField(rid);
    ex.view = 'field'; ex.region = rid; ex.planet = R.planet;
    renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
  }
  function fieldMonHTML(m, cls) {
    return '<button type="button" class="wf-mon' + (m.face < 0 ? ' flip' : '') + (cls ? ' ' + cls : '') + '" data-wfid="' + m.id + '" title="' + esc(m.name) + ' LV' + m.lv + '" aria-label="和' + esc(m.name) + '对战" style="left:' + m.x.toFixed(2) + '%;top:' + m.y.toFixed(2) + '%;z-index:' + Math.round(m.y) + '"><i class="wf-sh" aria-hidden="true"></i><img src="' + m.img + '" alt=""></button>';
  }
  function renderField() {
    var R = regionById(ex.region);
    if (!R || !regionOpen(R)) { ex.view = 'sites'; renderExplore(); return; }
    var F = fieldState(R.id), P = planetOf(R.planet), sc = F.scenes[F.scene], n = F.scenes.length;
    catchUp(R, F, sc, Date.now());
    var bg = sc.bg ? '<img class="wf-bg' + (sc.flip ? ' flip' : '') + '" src="' + sc.bg + '" alt="">' : '<div class="wf-ph' + (sc.flip ? ' flip' : '') + '">' + regionArt(R.id) + '</div>';
    var mons = sc.slots.filter(function (sl) { return sl.mon; }).map(function (sl) { return fieldMonHTML(sl.mon); }).join('');
    var nav = n > 1 ? '<button type="button" class="wf-arrow l" data-wfnav="-1" aria-label="上一个场景">‹</button><button type="button" class="wf-arrow r" data-wfnav="1" aria-label="下一个场景">›</button>' +
      '<span class="wf-dots" aria-label="场景 ' + (F.scene + 1) + ' / ' + n + '">' + F.scenes.map(function (x, i) { return '<i class="' + (i === F.scene ? 'on' : '') + '"></i>'; }).join('') + '</span>' : '';
    var spareTip = R.pool && R.planet === 'flora' && spareActive() ? '<div class="spare-note"><span class="tape l"></span><b>主线任务 · 引出猎杀者</b>　手下留情：这些精灵不会倒下，体力剩 1 点时就会逃走，算作「假装击败」。已完成 <b>' + spareN() + ' / ' + SPARE_N + '</b>。</div>' : '';
    $('pg-explore').innerHTML = exHead(R.pool ? '点击场景里走动的精灵，就会和它开战。' : '这里没有野生精灵。点击场景里的首领就能挑战它。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="field-back">‹ 返回' + esc(P.name) + '</button><b>' + esc(P.name) + ' · ' + esc(R.name) + '</b>' + (n > 1 ? '<span class="hint">场景 ' + (F.scene + 1) + ' / ' + n + (BG_NAME[sc.bgKey] ? ' · ' + BG_NAME[sc.bgKey] : '') + '</span>' : '') + '</div>' +
      invLine() + spareTip + '<div class="wf-scene' + (sc.corrupt ? ' miasma-bg' : '') + '" id="wf-scene">' + bg + mons + gatherNodesHTML(R.id, F.scene, n) + jadeHTML(R.id, F.scene) + riceBowlHTML(R, F.scene) + travelHTML(R, F.scene) + fieldBossHTML(R) + nav + '</div>' +
      (R.pool ? '<p class="hint">点左右两边的箭头可以切换场景。每只精灵在自己的一小片范围里走动，待一会儿就会离开，过一阵又会有新的精灵出现，各走各的。点中哪只，就和哪只对战；打完、抓到或逃走之后，这只离开，过一会儿会有新的一只补上。采集点固定在场景里，每个每天可以采集 1 次：芙罗拉、坎布尔、庞贝采到星砂 ×12，莱汀和白之星采到星核 ×1。' + (RICE.regions.indexOf(R.id) >= 0 ? '带着「一碗饭」来的话，可以在任意一个场景里放下它。' : '') + '</p>' : '');
    startFieldMove();
  }
  function startFieldMove() {
    stopField();
    var last = Date.now();
    fieldTick = setInterval(function () {
      if (page !== 'explore' || ex.view !== 'field' || ex.fighting) { stopField(); return; }
      var scene = $('wf-scene'); if (!scene) { stopField(); return; }
      var F = fields[ex.region], R = regionById(ex.region); if (!F || !R) return;
      var sc = F.scenes[F.scene], now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      sc.slots.forEach(function (sl) {
        var m = sl.mon;
        if (!m) {   // 空位：时间到了就出现一只新的（淡入）
          if (R.pool && now >= sl.next) { var nm_ = fillSlot(R, F, sl, now); scene.insertAdjacentHTML('beforeend', fieldMonHTML(nm_, 'wf-in')); }
          return;
        }
        var el = scene.querySelector('[data-wfid="' + m.id + '"]');
        if (now >= m.die && !m.out) { m.out = now; if (el) el.classList.add('wf-out'); }   // 待够了：淡出
        if (m.out && now - m.out >= FIELD_FADE) { if (el) el.remove(); sl.mon = null; sl.next = now + between(FIELD_GAP); return; }
        stepFieldMon(m, dt);
        if (!el) return;
        el.style.left = m.x.toFixed(2) + '%';
        el.style.top = m.y.toFixed(2) + '%';
        el.style.zIndex = String(Math.round(m.y));
        el.classList.toggle('flip', m.face < 0);
      });
    }, 40);
  }
  function fieldNav(d) {
    var F = fields[ex.region]; if (!F) return;
    var n = F.scenes.length; F.scene = (F.scene + d + n) % n;
    renderField();
  }
  function engageField(id) {
    if (ex.fighting) return;
    var R = regionById(ex.region), F = R && fields[R.id]; if (!F || !regionOpen(R)) return;
    var sc = F.scenes[F.scene], m = null; sc.slots.forEach(function (sl) { if (sl.mon && sl.mon.id === id) m = sl.mon; }); if (!m || m.out) return;
    var P = planetOf(R.planet);
    var o = { sid: m.sid, lv: m.lv, rate: m.rate, shiny: shinyV(m.shiny), bg: sc.bg || null, back: R.name, where: P.name + ' · ' + R.name, fieldId: m.id, fieldRid: R.id, bait: !!m.bait, flora: R.planet === 'flora' };
    if (m.corrupt) { o.corrupt = true; o.miasma = 10; o.noCatch = true; o.foe = '瘴气侵蚀的狂暴精灵'; o.where += ' · 瘴气异变'; }
    else if (R.planet === 'flora' && purgeActive() && Math.random() < PURGE.chance) { o.taint = true; o.miasma = 5; o.noCatch = true; o.foe = '被瘴气污染的野生精灵'; o.where += ' · 瘴气精灵'; }
    if (R.planet === 'flora' && spareActive() && !m.corrupt) { o.spare = true; o.where += ' · 手下留情'; }
    stopField();
    startWildBattle(o);
  }
  function rollWild(pool, extra) {   // extra：只在这个场景出现的精灵（WILD_SCENE），和区域表合在一起抽
    var P = extra ? WILD[pool].concat(extra) : WILD[pool], tot = P.reduce(function (a, w) { return a + w.w; }, 0), r = Math.random() * tot, w = P[0];
    for (var i = 0; i < P.length; i++) { r -= P[i].w; if (r < 0) { w = P[i]; break; } }
    return { w: w, lv: w.lv[0] + Math.floor(Math.random() * (w.lv[1] - w.lv[0] + 1)) };
  }
  // 主线任务「引出猎杀者」（读完第六段后开始）：芙罗拉星丛林、草甸的野生精灵不会倒下，体力剩 1 点就逃走，算「假装击败」
  var SPARE_N = 5;
  function spareN() { return (acc && acc.story && acc.story.flora2 && acc.story.flora2.spare) || 0; }
  function spareActive() { return prog('flora2').done && spareN() < SPARE_N; }
  // 第十段「瘴气之源」读完后：芙罗拉星整体瘴气化，野外精灵强制变成瘴气异变的最高阶段（见 spawnFieldMon），bgm 也随之切换
  function floraFallen() { return prog('flora6').done; }   // 2026-10-17 第八段拆成三段后，改为读完第十段才瘴气化
  // 瘴气化之后，芙罗拉星的背景换成画了瘴气脉络的版本（有 *_mia 图的才换）
  function floraBg(k) { return k && floraFallen() && BG[k + '_mia'] ? k + '_mia' : k; }
  // 对战背景：传入背景键。F.bg 可以写成 'fl_salt' 这样的键，统一在这里换成图片地址
  function fightBg(k) { return BG[k] || null; }
  function regionOpen(R) { return R.planet === 'flora' ? prog('flora1').done : planetOpen(planetOf(R.planet)); }
  function startWildBattle(o) {
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon), a;
    if (o.corrupt) {   // 瘴气异变：强制最高阶段立绘、只会用攻击技能、深度侵蚀双攻 +100%
      var s = SPMAP[o.sid];
      a = [{ id: o.sid, lv: o.lv, moves: puppetMoves(o.sid), nick: '瘴气' + s.name, img: o.shiny === 2 ? (SHINY_SPRITES[o.sid + '_2'] || SHINY_SPRITES[o.sid] || SPRITES[o.sid]) : o.shiny ? (SHINY_SPRITES[o.sid] || SPRITES[o.sid]) : SPRITES[o.sid], shiny: shinyV(o.shiny), miasma: o.miasma, boss: { erode: 1, mute: 1 } }];
    } else {
      a = [storyMon({ sid: o.sid, lv: o.lv, moves: [], shiny: shinyV(o.shiny) })];
      if (o.shiny) a[0].nick = '异色' + a[0].nick;
      if (o.taint) { a[0].miasma = o.miasma; a[0].nick = '被污染的' + a[0].nick; }
    }
    seeMon(o.sid, o.lv);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: o.foe || '野生精灵', items: invCopy(), bg: o.bg || null, corrupt: !!o.corrupt && !/_mia\.|_corrupt\./.test(o.bg || ''), bgm: o.corrupt ? 'disCommunication' : null,
      wild: { rate: o.rate, back: o.back, where: o.where, noCatch: !!o.noCatch, spare: !!o.spare },
      onItem: useInv,
      onEnd: function (res, seen, downs) {
        var msg = [];
        if (o.fieldRid) replaceFieldMon(o.fieldRid, o.fieldId);
        if (res === 'spared') {   // 「假装击败」：它逃走了，照样算击败（有经验），并计入主线任务
          downs = (downs || []).concat([{ id: o.sid, lv: o.lv }]);
          var sp = prog('flora2'); sp.spare = Math.min(SPARE_N, (sp.spare || 0) + 1);
          msg.push('主线任务「引出猎杀者」：已经「假装击败」' + sp.spare + ' / ' + SPARE_N + ' 只野生精灵。' + (sp.spare >= SPARE_N ? '天色渐渐暗了下来……去芙罗拉星的「剧情」页，继续主线「猎杀者」。' : ''));
        }
        if (res === 'caught') {
          var m = newMon(o.sid, o.lv), T = acc.teams[acc.active], added = T.length < TEAM_SIZE;
          if (o.shiny) m.shiny = shinyV(o.shiny);
          if (added) T.push(m.u);
          msg.push('捕捉到了 ' + (m.shiny ? '异色的' : '') + form(m).name + '（LV' + o.lv + '，' + m.nat + '）！' + (added ? '已加入' + TEAM_NAME[acc.active] + '。' : '已收入精灵仓库。'));
          dailyHit('catch');
        }
        if (downs && downs.length) { if (!acc.stats) acc.stats = {}; acc.stats.wildWins = (acc.stats.wildWins || 0) + downs.length; dailyHit('wildWin', downs.length); }
        if ((o.taint || (o.corrupt && purgeActive())) && downs && downs.length) msg = msg.concat(purgeHit());   // 瘴气化之后的腐化精灵也计入「祛除瘴气」
        if (o.corrupt && pwOpen() && downs && downs.length) {
          var pd = pwDay();
          if (pd.n < PW.cap) { pd.n++; acc.exp = (acc.exp || 0) + PW.exp; save(); renderRes(); msg.push('瘴气驱逐战：击破 +1（今天 ' + pd.n + ' / ' + PW.cap + '），经验背包 +' + fmt(PW.exp) + (pwOnline() ? '。' : '（没有联网，全服进度没有计入）。')); pwHit(); }
          else msg.push('瘴气驱逐战：今天已经击破 ' + PW.cap + ' 次，达到每日上限，明天再来吧。');
        }
        if (o.travel && downs && downs.length) {   // 旅行精灵：累积经验 ×3000，50% 掉落叶片
          acc.exp = (acc.exp || 0) + TRAVEL.exp; var lf = Math.random() < TRAVEL.leaf;
          if (lf) giveItems({ m_lcleaf: 1 });
          msg.push('击败了旅行精灵叶子喵！获得累积经验 ×' + fmt(TRAVEL.exp) + (lf ? '，她留下了一片「叶子喵的叶片」' : '') + '。');
        }
        if (o.travel) setTimeout(function () { travelDlg(pickOne(downs && downs.length ? TRAVEL_TALK.win : res === 'lose' ? TRAVEL_TALK.lose : TRAVEL_TALK.quit), [['知道了', null]]); }, 700);   // 打完夸一句；她会留在原地，满 20 分钟才走
        if (o.bait && (res === 'caught' || (downs && downs.length))) { acc.riceBowl = null; msg.push('放在熔岩原的那碗米饭被吃得一粒不剩。'); }
        if (o.flora && downs && downs.length) {   // 芙罗拉星野外：每击败一只，10% 掉落水稻种子
          var seeds = 0; downs.forEach(function () { if (Math.random() < RICE.seedDrop) seeds++; });
          if (seeds) { giveItems({ s_rice: seeds }); msg.push('它掉下了水稻种子 ×' + seeds + '，已放入储存箱。'); }
        }
        dailyHit('pve');
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
        if (msg.length) setTimeout(function () { toast(msg.join('')); }, 300);
      } });
  }
  /* ---------- 星球挑战：从左到右一条链，每个节点是一关，按顺序开放；每关三颗星 ----------
   * 在古城防卫部读完支线「芙罗拉星挑战」后开放。第一次点开第二关时插播支线「借来的力量」，之后可以带助战精灵：
   *   自己的配队里挑 4 只 + 1 只助战（明明教官的 LV30 赫菲托斯，或好友名片里的助战精灵，服务器接口 /api/helpers）
   * 星级：1 星 = 击败所有敌人；2、3 星看每关的 s2 / s3（nofaint 无精灵倒下、half 结束时全员体力高于一半、super 用过克制对方属性的技能、nostatus 结束时没有异常状态）
   * 存档：acc.chal[关卡 id] = { s: [星1, 星2, 星3], got: 首通时间 } */
  var CHAL = {
    flora: [
      { id: 'fl1', n: '草甸前哨', bg: 'fl_meadow', foes: [{ sid: 'wind', lv: 8 }], s2: 'nofaint', s3: 'half', reward: { exp: 3000, energy: 600 } },
      { id: 'fl2', n: '湖畔双影', bg: 'fl_lake', foes: [{ sid: 'wind', lv: 10 }, { sid: 'wind', lv: 10 }], s2: 'nofaint', s3: 'super', reward: { exp: 4000, energy: 800 } },
      { id: 'fl3', n: '林下菌丛', bg: 'fl_path', foes: [{ sid: 'mush', lv: 13 }], s2: 'nofaint', s3: 'half', reward: { exp: 5000, energy: 1000 } },
      { id: 'fl4', n: '密林混战', bg: 'fl_sun', foes: [{ sid: 'mush', lv: 15 }, { sid: 'wind', lv: 15 }], s2: 'nofaint', s3: 'nostatus', reward: { exp: 6500, energy: 1200 } },
      { id: 'fl5', n: '猎手的领地', bg: 'fl_maple', foes: [{ sid: 'mush', lv: 15 }, { sid: 'kaleo', lv: 20 }], s2: 'nofaint', s3: 'nostatus', reward: { exp: 8000, energy: 1500 } },
      // 第 6~50 关（2026-10-17）：敌人等级逐关提高，第 40 关到 LV100；之后 q: 1 的敌人显示为「LV.??」，实际超过 LV100
      { id: 'fl6', n: '叶影小径', bg: 'fl_path', foes: [{ sid: 'wind', lv: 21 }, { sid: 'kaleo', lv: 22 }], s2: 'nofaint', s3: 'super', reward: { exp: 9500, energy: 1580 } },
      { id: 'fl7', n: '双生风语', bg: 'fl_lake', foes: [{ sid: 'leaf', lv: 24 }, { sid: 'wind', lv: 25 }], s2: 'nofaint', s3: 'noitem', reward: { exp: 11000, energy: 1660 } },
      { id: 'fl8', n: '孢子迷雾', bg: 'fl_sun', foes: [{ sid: 'phantom', lv: 26 }, { sid: 'leaf', lv: 27 }], s2: 'half', s3: 'st:中毒', reward: { exp: 12500, energy: 1740 } },
      { id: 'fl9', n: '枫下伏击', bg: 'fl_maple', foes: [{ sid: 'mush', lv: 28 }, { sid: 'phantom', lv: 29 }], s2: 'nofaint', s3: 'crit', reward: { exp: 14000, energy: 1820 } },
      { id: 'fl10', n: '湖心倒影', bg: 'fl_lake', foes: [{ sid: 'kaleo', lv: 30 }, { sid: 'mush', lv: 31 }], s2: 'noitem', s3: 'st:麻痹', reward: { exp: 15500, energy: 1900 } },
      { id: 'fl11', n: '山毛榉回廊', bg: 'fl_beech', foes: [{ sid: 'wind', lv: 33 }, { sid: 'kaleo', lv: 34 }], s2: 'nofaint', s3: 'turns:10', reward: { exp: 17000, energy: 1980 } },
      { id: 'fl12', n: '草甸疾风', bg: 'fl_meadow', foes: [{ sid: 'leaf', lv: 35 }, { sid: 'wind', lv: 36 }], s2: 'half', s3: 'up6', reward: { exp: 18500, energy: 2060 } },
      { id: 'fl13', n: '蘑菇环', bg: 'fl_path', foes: [{ sid: 'phantom', lv: 37 }, { sid: 'leaf', lv: 38 }], s2: 'nofaint', s3: 'st:睡眠', reward: { exp: 20000, energy: 2140 } },
      { id: 'fl14', n: '林冠之上', bg: 'fl_horizon', foes: [{ sid: 'mush', lv: 39 }, { sid: 'phantom', lv: 40 }, { sid: 'leaf', lv: 41 }], s2: 'noitem', s3: 'dotko', reward: { exp: 21500, energy: 2220 } },
      { id: 'fl15', n: '晨露猎场', bg: 'fl_meadow', foes: [{ sid: 'kaleo', lv: 41 }, { sid: 'mush', lv: 42 }, { sid: 'phantom', lv: 43 }], s2: 'nofaint', s3: 'st:烧伤', reward: { exp: 23000, energy: 2300 } },
      { id: 'fl16', n: '幻叶迷途', bg: 'fl_path', foes: [{ sid: 'phantom', lv: 44 }, { sid: 'firemouse', lv: 45 }], s2: 'lead', s3: 'super', reward: { exp: 24500, energy: 2380 } },
      { id: 'fl17', n: '三尾合围', bg: 'fl_lake', foes: [{ sid: 'turkey', lv: 45 }, { sid: 'mush', lv: 46 }, { sid: 'phantom', lv: 47 }], s2: 'nofaint', s3: 'down6', reward: { exp: 26000, energy: 2460 } },
      { id: 'fl18', n: '盐碱边缘', bg: 'fl_sun', foes: [{ sid: 'wind', lv: 48 }, { sid: 'leaf', lv: 49 }, { sid: 'turkey', lv: 50 }], s2: 'half', s3: 'heal:300', reward: { exp: 27500, energy: 2540 } },
      { id: 'fl19', n: '藤蔓深处', bg: 'fl_maple', foes: [{ sid: 'kaleo', lv: 51 }, { sid: 'leafcat', lv: 52 }], s2: 'noitem', s3: 'st:流血', reward: { exp: 29000, energy: 2620 } },
      { id: 'fl20', n: '雨后菌林', bg: 'fl_lake', foes: [{ sid: 'phantom', lv: 52 }, { sid: 'firemouse', lv: 53 }, { sid: 'kaleo', lv: 54 }], s2: 'nofaint', s3: 'oneshot', reward: { exp: 30500, energy: 2700 } },
      { id: 'fl21', n: '光斑林地', bg: 'fl_beech', foes: [{ sid: 'turkey', lv: 55 }, { sid: 'mush', lv: 56 }, { sid: 'phantom', lv: 57 }], s2: 'nosw', s3: 'crit', reward: { exp: 32000, energy: 2780 } },
      { id: 'fl22', n: '风王的试炼', bg: 'fl_meadow', foes: [{ sid: 'wind', lv: 58 }, { sid: 'leaf', lv: 59 }], s2: 'nofaint', s3: 'st:寄生', reward: { exp: 33500, energy: 2860 } },
      { id: 'fl23', n: '猎手再临', bg: 'fl_path', foes: [{ sid: 'kaleo', lv: 59 }, { sid: 'leafcat', lv: 60 }, { sid: 'wind', lv: 61 }], s2: 'half', s3: 'turns:12', reward: { exp: 35000, energy: 2940 } },
      { id: 'fl24', n: '古树根系', bg: 'fl_horizon', foes: [{ sid: 'phantom', lv: 61 }, { sid: 'firemouse', lv: 62 }, { sid: 'kaleo', lv: 63 }], s2: 'noitem', s3: 'up6', reward: { exp: 36500, energy: 3020 } },
      { id: 'fl25', n: '绿荫长阶', bg: 'fl_meadow', foes: [{ sid: 'turkey', lv: 65 }, { sid: 'mush', lv: 66 }], s2: 'nofaint', s3: 'dotko', reward: { exp: 38000, energy: 3100 } },
      { id: 'fl26', n: '落叶风暴', bg: 'fl_path', foes: [{ sid: 'wind', lv: 66 }, { sid: 'leaf', lv: 67 }, { sid: 'turkey', lv: 68 }], s2: 'lead', s3: 'st:冰冻', reward: { exp: 39500, energy: 3180 } },
      { id: 'fl27', n: '迷雾湖畔', bg: 'fl_lake', foes: [{ sid: 'kaleo', lv: 68 }, { sid: 'leafcat', lv: 69 }, { sid: 'wind', lv: 70 }], s2: 'nofaint', s3: 'heal:600', reward: { exp: 41000, energy: 3260 } },
      { id: 'fl28', n: '丛林法则', bg: 'fl_sun', foes: [{ sid: 'phantom', lv: 72 }, { sid: 'firemouse', lv: 73 }], s2: 'half', s3: 'down6', reward: { exp: 42500, energy: 3340 } },
      { id: 'fl29', n: '孢子沼泽', bg: 'fl_maple', foes: [{ sid: 'turkey', lv: 73 }, { sid: 'mush', lv: 74 }, { sid: 'phantom', lv: 75 }], s2: 'noitem', s3: 'oneshot', reward: { exp: 44000, energy: 3420 } },
      { id: 'fl30', n: '叶伞之下', bg: 'fl_lake', foes: [{ sid: 'wind', lv: 75 }, { sid: 'leaf', lv: 76 }, { sid: 'turkey', lv: 77 }], s2: 'nofaint', s3: 'st:害怕', reward: { exp: 45500, energy: 3500 } },
      { id: 'fl31', n: '翠影连环', bg: 'fl_beech', foes: [{ sid: 'kaleo', lv: 77 }, { sid: 'leafcat', lv: 78 }, { sid: 'wind', lv: 79 }], s2: 'nosw', s3: 'st:中毒', reward: { exp: 47000, energy: 3580 } },
      { id: 'fl32', n: '深林回声', bg: 'fl_meadow', foes: [{ sid: 'phantom', lv: 80 }, { sid: 'firemouse', lv: 81 }, { sid: 'kaleo', lv: 82 }], s2: 'nofaint', s3: 'turns:12', reward: { exp: 48500, energy: 3660 } },
      { id: 'fl33', n: '风暴前夕', bg: 'fl_path', foes: [{ sid: 'mush', lv: 82 }, { sid: 'siren', lv: 83 }, { sid: 'kaleo', lv: 84 }], s2: 'half', s3: 'dotko', reward: { exp: 50000, energy: 3740 } },
      { id: 'fl34', n: '林海守望', bg: 'fl_horizon', foes: [{ sid: 'bone', lv: 84 }, { sid: 'leaf', lv: 85 }, { sid: 'leafcat', lv: 86 }], s2: 'noitem', s3: 'heal:800', reward: { exp: 51500, energy: 3820 } },
      { id: 'fl35', n: '千叶之门', bg: 'fl_meadow', foes: [{ sid: 'inkarm', lv: 87 }, { sid: 'phantom', lv: 88 }, { sid: 'mush', lv: 89 }], s2: 'nofaint', s3: 'up6', reward: { exp: 53000, energy: 3900 } },
      { id: 'fl36', n: '幽绿裂谷', bg: 'fl_path', foes: [{ sid: 'kaleo', lv: 89 }, { sid: 'wind', lv: 90 }, { sid: 'bone', lv: 91 }], s2: 'lead', s3: 'oneshot', reward: { exp: 54500, energy: 3980 } },
      { id: 'fl37', n: '密林王座', bg: 'fl_lake', foes: [{ sid: 'leafcat', lv: 91 }, { sid: 'shroom', lv: 92 }, { sid: 'inkarm', lv: 93 }], s2: 'nofaint', s3: 'st:烧伤', reward: { exp: 56000, energy: 4060 } },
      { id: 'fl38', n: '群猎之夜', bg: 'fl_sun', foes: [{ sid: 'mush', lv: 93 }, { sid: 'siren', lv: 94 }, { sid: 'kaleo', lv: 95 }], s2: 'noitem', s3: 'down6', reward: { exp: 57500, energy: 4140 } },
      { id: 'fl39', n: '枯叶回旋', bg: 'fl_maple', foes: [{ sid: 'bone', lv: 96 }, { sid: 'leaf', lv: 97 }, { sid: 'leafcat', lv: 98 }], s2: 'half', s3: 'crit', reward: { exp: 59000, energy: 4220 } },
      { id: 'fl40', n: '芙罗拉之心', bg: 'fl_lake', foes: [{ sid: 'inkarm', lv: 98 }, { sid: 'phantom', lv: 99 }, { sid: 'mush', lv: 100 }], s2: 'nofaint', s3: 'nostatus', reward: { exp: 60500, energy: 4300 } },
      { id: 'fl41', n: '瘴雾边境', bg: 'fl_beech', foes: [{ sid: 'kaleo', lv: 102, q: 1 }, { sid: 'wind', lv: 104, q: 1 }, { sid: 'bone', lv: 106, q: 1 }], s2: 'nosw', s3: 'dotko', reward: { exp: 62000, energy: 4380, items: { floraJade: 10 } } },
      { id: 'fl42', n: '林中暗涌', bg: 'fl_meadow', foes: [{ sid: 'leafcat', lv: 106, q: 1 }, { sid: 'shroom', lv: 108, q: 1 }, { sid: 'inkarm', lv: 110, q: 1 }, { sid: 'phantom', lv: 112, q: 1 }], s2: 'nofaint', s3: 'heal:1000', reward: { exp: 63500, energy: 4460, items: { floraJade: 10 } } },
      { id: 'fl43', n: '古木低语', bg: 'fl_path', foes: [{ sid: 'mush', lv: 110, q: 1 }, { sid: 'siren', lv: 112, q: 1 }, { sid: 'kaleo', lv: 114, q: 1 }], s2: 'noitem', s3: 'turns:15', reward: { exp: 65000, energy: 4540, items: { floraJade: 10 } } },
      { id: 'fl44', n: '绿色风暴', bg: 'fl_horizon', foes: [{ sid: 'bone', lv: 114, q: 1 }, { sid: 'leaf', lv: 116, q: 1 }, { sid: 'leafcat', lv: 118, q: 1 }, { sid: 'shroom', lv: 120, q: 1 }], s2: 'half', s3: 'oneshot', reward: { exp: 66500, energy: 4620, items: { floraJade: 10 } } },
      { id: 'fl45', n: '百级之境', bg: 'fl_meadow', foes: [{ sid: 'inkarm', lv: 118, q: 1 }, { sid: 'phantom', lv: 120, q: 1 }, { sid: 'mush', lv: 122, q: 1 }], s2: 'nofaint', s3: 'noitem', reward: { exp: 68000, energy: 4700, items: { floraJade: 10 } } },
      { id: 'fl46', n: '？？？之林', bg: 'fl_path', foes: [{ sid: 'kaleo', lv: 122, q: 1 }, { sid: 'wind', lv: 124, q: 1 }, { sid: 'bone', lv: 126, q: 1 }, { sid: 'leaf', lv: 128, q: 1 }], s2: 'lead', s3: 'up6', reward: { exp: 69500, energy: 4780, items: { floraJade: 10 } } },
      { id: 'fl47', n: '无名猎场', bg: 'fl_lake', foes: [{ sid: 'leafcat', lv: 126, q: 1 }, { sid: 'shroom', lv: 128, q: 1 }, { sid: 'inkarm', lv: 130, q: 1 }], s2: 'nofaint', s3: 'dotko', reward: { exp: 71000, energy: 4860, items: { floraJade: 10 } } },
      { id: 'fl48', n: '寂静树海', bg: 'fl_sun', foes: [{ sid: 'mush', lv: 130, q: 1 }, { sid: 'siren', lv: 132, q: 1 }, { sid: 'kaleo', lv: 134, q: 1 }, { sid: 'wind', lv: 136, q: 1 }], s2: 'noitem', s3: 'st:麻痹', reward: { exp: 72500, energy: 4940, items: { floraJade: 10 } } },
      { id: 'fl49', n: '终末之森', bg: 'fl_maple', foes: [{ sid: 'bone', lv: 134, q: 1 }, { sid: 'leaf', lv: 136, q: 1 }, { sid: 'leafcat', lv: 138, q: 1 }], s2: 'nosw', s3: 'oneshot', reward: { exp: 74000, energy: 5020, items: { floraJade: 10 } } },
      { id: 'fl50', n: '芙罗拉 · 极境', bg: 'fl_horizon', foes: [{ sid: 'inkarm', lv: 138, q: 1 }, { sid: 'phantom', lv: 140, q: 1 }, { sid: 'mush', lv: 142, q: 1 }, { sid: 'siren', lv: 144, q: 1 }], s2: 'nofaint', s3: 'noitem', reward: { exp: 75500, energy: 5100, items: { floraJade: 50 } } }
    ]
  };
  // 星级要求：固定的几种，加上带参数的 'turns:N'（N 回合内获胜）、'st:状态'（让敌人陷入某种异常）、'heal:N'（累计恢复 N 点体力）
  var STAR_HINT = { 中毒: '如毒孢子', 麻痹: '如电磁波、麻醉孢子、闪电烙印', 睡眠: '如催眠孢子、魔眼', 烧伤: '如火焰漩涡、烈焰云', 流血: '如怒海疾刺', 寄生: '如寄生之种', 冰冻: '如冰冻打击、霜冻结界', 害怕: '如龙吟崩山震、颤栗' };
  function starTxt(c) {
    if (STAR_TXT[c]) return STAR_TXT[c];
    var p = c.split(':');
    if (p[0] === 'turns') return '在 ' + p[1] + ' 回合内获胜';
    if (p[0] === 'st') return '让一名敌人陷入「' + p[1] + '」状态' + (STAR_HINT[p[1]] ? '（' + STAR_HINT[p[1]] + '）' : '');
    if (p[0] === 'heal') return '战斗中累计恢复 ' + p[1] + ' 点体力（如吸取、光合作用、饮血刀光）';
    return c;
  }
  function starOk(c, S, mine) {
    var cs = S.cs || {}, p = c.split(':');
    if (c === 'win') return true;
    if (c === 'nofaint') return mine.every(function (m) { return !m.fainted; });
    if (c === 'half') return mine.every(function (m) { return !m.fainted && m.hp > m.maxhp / 2; });
    if (c === 'super') return !!(S.se && S.se[0] > 0);
    if (c === 'nostatus') return mine.every(function (m) { return m.fainted || !Object.keys(m.st || {}).some(function (k) { return m.st[k] > 0; }); });
    if (c === 'noitem') return !cs.items;
    if (c === 'nosw') return !cs.sw;
    if (c === 'lead') return !!mine[0] && !mine[0].fainted;
    if (c === 'crit') return cs.crit > 0;
    if (c === 'up6') return cs.up6 > 0;
    if (c === 'down6') return cs.down6 > 0;
    if (c === 'oneshot') return cs.oneShot > 0;
    if (c === 'dotko') return cs.dotKO > 0;
    if (p[0] === 'turns') return S.turn - 1 <= +p[1];
    if (p[0] === 'st') return !!(cs.st && cs.st[p[1]] > 0);
    if (p[0] === 'heal') return (cs.heal || 0) >= +p[1];
    return false;
  }
  function lvTxt(f) { return f.q ? 'LV.??' : 'LV' + f.lv; }
  // 累计星数奖励（2026-10-17）：acc.chalGot[星数] = 领取时间
  var CHAL_STAR = [
    { n: 30, rw: { bgm: 'floraGrass', exp: 30000, energy: 3000 } },
    { n: 60, rw: { bgm: 'floraForest', exp: 60000, energy: 5000 } },
    { n: 90, rw: { bgm: 'floraFallen', exp: 90000, energy: 8000 } },
    { n: 120, rw: { exp: 120000, energy: 10000, items: { floraJade: 100, g_core: 4 } } },
    { n: 150, rw: { exp: 150000, energy: 15000, items: { floraJade: 200, g_core: 8 } } }
  ];
  function chalTotal(P) { return CHAL[P || 'flora'].reduce(function (a, x) { return a + chalStars(x.id); }, 0); }
  function chalGot(n) { return !!(acc && acc.chalGot && acc.chalGot[n]); }
  function chalStarHTML(total) {
    return '<div class="ch-mile">' + CHAL_STAR.map(function (x) {
      var got = chalGot(x.n), can = !got && total >= x.n;
      return '<div class="ch-mi' + (got ? ' got' : can ? ' can' : '') + '"><b>★ ' + x.n + '</b><span>' + rwList(x.rw).join('、') + '</span>' +
        (got ? '<em>已领取</em>' : can ? '<button type="button" class="btn primary" data-chstar="' + x.n + '">领取</button>' : '<em>' + total + ' / ' + x.n + '</em>') + '</div>';
    }).join('') + '</div>';
  }
  function claimChalStar(n) {
    var x = CHAL_STAR.filter(function (y) { return y.n === n; })[0]; if (!x || chalGot(n) || chalTotal() < n) return;
    if (!acc.chalGot) acc.chalGot = {}; acc.chalGot[n] = Date.now();
    var R = x.rw; acc.exp = (acc.exp || 0) + (R.exp || 0); acc.energy = (acc.energy || 0) + (R.energy || 0); if (R.items) giveItems(R.items);
    save(); renderTop(); toast('挑战路线累计 ' + n + ' 颗星奖励：' + rwList(R).join('、') + (R.bgm ? '。茶室音乐可以在「我的茶室」里切换。' : '。'));
  }
  var STAR_TXT = { win: '击败所有敌人', nofaint: '无精灵倒下', half: '战斗结束时，所有出战精灵的体力都高于一半', super: '使用一次克制对方属性的技能（效果拔群）', nostatus: '战斗结束时，所有精灵都不处于异常状态',
    noitem: '整场战斗不使用任何道具', nosw: '整场战斗不主动更换出战精灵', lead: '首发精灵在战斗结束时没有倒下',
    crit: '至少打出一次致命一击（暴击）', up6: '让我方精灵的任意一项能力等级提升到 +6（如饮血刀光、灵光等强化技能）',
    down6: '让敌人的任意一项能力等级下降到 −6（如混沌海流、软化粉等削弱技能）', oneshot: '一次攻击造成超过敌人最大体力的伤害（满体力时一击击倒，如淬命之焰）',
    dotko: '用持续伤害（中毒、烧伤、流血、寄生等）击败一名敌人（如渗透孢子、灭却）' };
  // 对战中的「星级要求」下拉面板：每一条当前的状态
  function starLive(c, S, mine) {
    var cs = S.cs || {}, p = c.split(':');
    var keep = function (bad) { return bad ? ['fail', '已失败'] : ['keep', '保持中']; }, now = function (ok) { return ok ? ['now', '目前满足'] : ['not', '目前不满足']; }, got = function (ok, t) { return ok ? ['done', '已达成'] : ['todo', t || '未达成']; };
    if (c === 'win') return ['todo', '进行中'];
    if (c === 'nofaint') return keep(mine.some(function (m) { return m.fainted; }));
    if (c === 'half') return now(mine.every(function (m) { return !m.fainted && m.hp > m.maxhp / 2; }));
    if (c === 'super') return got(S.se && S.se[0] > 0);
    if (c === 'nostatus') return now(mine.every(function (m) { return m.fainted || !Object.keys(m.st || {}).some(function (k) { return m.st[k] > 0; }); }));
    if (c === 'noitem') return keep(cs.items > 0);
    if (c === 'nosw') return keep(cs.sw > 0);
    if (c === 'lead') return keep(!mine[0] || mine[0].fainted);
    if (c === 'crit') return got(cs.crit > 0);
    if (c === 'up6') return got(cs.up6 > 0);
    if (c === 'down6') return got(cs.down6 > 0);
    if (c === 'oneshot') return got(cs.oneShot > 0);
    if (c === 'dotko') return got(cs.dotKO > 0);
    if (p[0] === 'turns') return S.turn - 1 > +p[1] ? ['fail', '已失败'] : ['keep', '已过 ' + (S.turn - 1) + ' / ' + p[1] + ' 回合'];
    if (p[0] === 'st') return got(cs.st && cs.st[p[1]] > 0);
    if (p[0] === 'heal') return got((cs.heal || 0) >= +p[1], (cs.heal || 0) + ' / ' + p[1]);
    return ['todo', ''];
  }
  var MM_HELPER = { key: 'mm', owner: '明明教官', mon: { sid: 'hephaestus', lv: 30, moves: [] } };
  function chalRec(id) { if (!acc.chal) acc.chal = {}; return acc.chal[id] || null; }
  function chalStars(id) { var r = acc && acc.chal && acc.chal[id]; return r ? r.s.filter(Boolean).length : 0; }
  function chalOpen() { return !!(acc && prog('fl_chal').done); }
  function chalLevelOpen(P, i) { return chalOpen() && (i === 0 || chalStars(CHAL[P][i - 1].id) > 0); }
  function helperSet() { return !!(acc && acc.card && acc.card.helper != null && mon(acc.card.helper)); }
  function helperOk() { return prog('fl_chal2').done; }
  function starRow(n, got) { var h = ''; for (var i = 0; i < 3; i++) h += '<i class="' + (got ? (got[i] ? 'on' : '') : i < n ? 'on' : '') + '">★</i>'; return '<span class="ch-stars">' + h + '</span>'; }
  // 好友的助战精灵（联网时从服务器读，几分钟内用缓存）
  function loadHelpers(force) {
    if (!bsOnline() || ex.hpBusy || (!force && ex.helpers && Date.now() - ex.helpersT < 120000)) return;
    ex.hpBusy = true;
    CLOUD.api('GET', '/api/helpers').then(function (r) {
      ex.hpBusy = false; if (r._code !== 200) return;
      ex.helpers = r.helpers || []; ex.helpersT = Date.now();
      if (page === 'explore' && ex.view === 'sites' && ex.fpart === 'challenge') renderExplore();
    }).catch(function () { ex.hpBusy = false; });
  }
  function helperList() {
    var L = [MM_HELPER];
    (ex.helpers || []).forEach(function (h) { if (h && h.mon && SPMAP[h.mon.sid]) L.push({ key: 'u:' + h.user, owner: h.name || h.user, mon: h.mon }); });
    return L;
  }
  function chalTeam() {   // 这一关的出战精灵：自己的（按配队顺序）+ 助战
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean), tk = acc.active + ':' + team.map(function (m) { return m.u; }).join(',');
    if (!ex.chalOwn || ex.chalTk !== tk) { ex.chalOwn = team.map(function (m) { return m.u; }); ex.chalTk = tk; }   // 配队变了就重新全选
    var HP = ex.chalHelper && helperOk() ? helperList().filter(function (h) { return h.key === ex.chalHelper; })[0] : null;
    if (ex.chalHelper && !HP) ex.chalHelper = null;
    var own = team.filter(function (m) { return ex.chalOwn.indexOf(m.u) >= 0; }).slice(0, HP ? 4 : 5);
    return { team: team, own: own, helper: HP };
  }
  function chalPage(P) {
    if (!chalOpen()) {
      return '<div class="fl-soon"><span class="tape r"></span><b>挑战 · 关卡副本</b><p>古城防卫部的明明教官在芙罗拉星上划出了一条挑战路线：一关接一关，每一关都会根据表现评出 1~3 颗星。</p><p class="stars3" aria-hidden="true">☆ ☆ ☆</p>' +
        (prog('flora1').done ? '<p class="hint">去荆楚号 · 襄阳 · 古城防卫部，找明明教官接取挑战任务。</p><button type="button" class="btn primary" data-tpgo="襄阳">前往古城防卫部</button>' : '<p class="hint">读完主线「降临芙罗拉」后，去古城防卫部找明明教官。</p>') + '</div>';
    }
    var L = CHAL[P], sel = ex.chal != null && L[ex.chal] && chalLevelOpen(P, ex.chal) ? ex.chal : (function () { var k = 0; L.forEach(function (x, i) { if (chalLevelOpen(P, i)) k = i; }); return k; })();
    ex.chal = sel;
    if (helperOk()) loadHelpers();
    var total = L.reduce(function (a, x) { return a + chalStars(x.id); }, 0);
    setTimeout(function () { var c = document.querySelector('.ch-chain'), n = c && c.querySelector('.ch-node.sel'); if (n) c.scrollLeft = n.offsetLeft - c.clientWidth / 2 + n.offsetWidth / 2; }, 0);   // 50 关横向排开：自动滚到选中的那一关
    var chain = '<ol class="ch-chain">' + L.map(function (x, i) {
      var open = chalLevelOpen(P, i), n = chalStars(x.id), r = acc.chal && acc.chal[x.id];
      return '<li class="ch-node' + (open ? '' : ' locked') + (n ? ' clear' : '') + (i === sel ? ' sel' : '') + '"><button type="button" data-chal="' + i + '"' + (open ? '' : ' disabled') + ' aria-label="第 ' + (i + 1) + ' 关' + (open ? '' : '（未开放）') + '">' +
        '<span class="ch-no">' + (open ? i + 1 : '🔒') + '</span>' + starRow(n, r && r.s) + '<b>' + esc(x.n) + '</b></button></li>';
    }).join('') + '</ol>';
    var x = L[sel], rec = acc.chal && acc.chal[x.id], T = chalTeam(), conds = ['win', x.s2, x.s3];
    var foes = x.foes.map(function (f) { var k = wildKnown(f.sid), fm = form(f); return '<li>' + (k ? '<img src="' + fm.img + '" alt="">' : silTag(f.sid, fm.stage)) + '<span><b>' + (k ? esc(fm.name) : '？？？') + '</b><small>' + lvTxt(f) + '</small></span></li>'; }).join('');
    var ownHTML = T.team.map(function (m) {
      var on = T.own.indexOf(m) >= 0, f = form(m), dis = !on && T.own.length >= (T.helper ? 4 : 5);
      return '<button type="button" class="ch-mon' + (on ? ' on' : '') + '" data-chown="' + m.u + '"' + (dis ? ' disabled' : '') + ' aria-pressed="' + on + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + '</small></button>';
    }).join('');
    var helpHTML = !helperOk() ? '<p class="hint">' + (sel >= 1 ? '' : '通过第一关后，第二关会解锁「助战精灵」：可以借一只别人的精灵一起出战。') + '</p>' :
      '<div class="ch-helpers"><button type="button" class="ch-help' + (!T.helper ? ' on' : '') + '" data-chhelp=""><span class="ch-none">不带助战</span></button>' + helperList().map(function (h) {
        var f = form(h.mon), on = T.helper && T.helper.key === h.key;
        return '<button type="button" class="ch-help' + (on ? ' on' : '') + '" data-chhelp="' + esc(h.key) + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + h.mon.lv + ' · ' + esc(h.owner) + '</small></button>';
      }).join('') + '</div><p class="hint">' + (bsOnline() ? (ex.helpers && ex.helpers.length ? '好友在名片里放的助战精灵都在这里。' : '好友在名片里放了助战精灵后，也会出现在这里。') : '联网登录后，还能借用好友名片里的助战精灵。') + '自己也可以在「社交 → 我的名片」里挂一只助战精灵。</p>';
    var ready_ = T.own.length > 0;
    return '<div class="ch-wrap"><div class="ch-head"><b>芙罗拉星 · 挑战路线</b><span class="hint">共 ' + L.length + ' 关 · 已获得 ' + total + ' / ' + L.length * 3 + ' 颗星</span></div>' + chalStarHTML(total) + chain +
      '<article class="ch-detail"><span class="tape r"></span><div class="ch-dh"><span class="sc-tag">第 ' + (sel + 1) + ' 关</span><h3>' + esc(x.n) + '</h3>' + starRow(chalStars(x.id), rec && rec.s) + '</div>' +
      '<div class="ch-cols"><div><h4>敌人</h4><ul class="ch-foes">' + foes + '</ul>' +
      '<h4>星级要求</h4><ol class="ch-conds">' + conds.map(function (c, k) { var got = rec && rec.s[k]; return '<li class="' + (got ? 'ok' : '') + '"><span class="ch-star">' + (got ? '★' : '☆') + '</span>' + starTxt(c) + '</li>'; }).join('') + '</ol>' +
      '<p class="ch-rw"><b>首次通关奖励</b>　' + rwList(x.reward).map(function (t) { return '<span class="chip">' + t + '</span>'; }).join(' ') + (rec && rec.got ? '<span class="hint">（已领取）</span>' : '') + '</p></div>' +
      '<div><h4>出战精灵 <span class="hint">' + (T.helper ? '自己的 ' + T.own.length + ' / 4 只 + 1 只助战' : '自己的 ' + T.own.length + ' / 5 只') + '，点一下选上或取下</span></h4><div class="ch-mons">' + (ownHTML || '<p class="hint">当前配队是空的。</p>') + '</div>' +
      '<h4>助战精灵</h4>' + helpHTML + '</div></div>' +
      '<div class="ch-go"><button type="button" class="btn primary" data-chgo="' + sel + '"' + (ready_ ? '' : ' disabled') + '>开始挑战</button><span class="hint">战斗中可以使用补药；挑战失败不会有任何损失，可以反复挑战。</span></div></article>' + cbHTML(P) + '</div>';
  }
  // 出战顺序：自己的精灵用 'u' + 编号，助战精灵用 'h'；排在第一个的就是首发
  function chalLineup() {
    var T = chalTeam(), L = T.own.map(function (m) { return { k: 'u' + m.u, m: m }; });
    if (T.helper) L.push({ k: 'h', h: T.helper });
    var ord = ex.chalOrder || [];
    L.sort(function (a, b) { var ia = ord.indexOf(a.k), ib = ord.indexOf(b.k); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    return L;
  }
  function helperSpec(Hp) { var hm = storyMon({ sid: Hp.mon.sid, lv: Hp.mon.lv, moves: Hp.mon.moves || [], ev: Hp.mon.ev || null, nat: Hp.mon.nat || null, iv: Hp.mon.iv || null, shiny: shinyV(Hp.mon.shiny) }); hm.nick = hm.nick + '（' + Hp.owner + '）'; return hm; }
  // 首发选择面板：选好精灵、点「开始挑战」后弹出，拖动（或点「设为首发」）调整出战顺序
  function openLineup(P, i) {
    var x = CHAL[P][i]; if (!x) return;
    var L = chalLineup(); if (!L.some(function (e) { return e.m; })) return;
    var old = $('lu-dlg'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'lu-dlg';
    var card = function (e) {
      var f = e.m ? form(e.m) : form(e.h.mon), lv = e.m ? e.m.lv : e.h.mon.lv;
      return '<li class="lu-card" data-k="' + e.k + '"><span class="lu-no"></span><img src="' + f.img + '" alt="" draggable="false"><b>' + esc(f.name) + '</b><small>LV' + lv + (e.h ? ' · 助战（' + esc(e.h.owner) + '）' : '') + '</small>' + tchips(SPMAP[e.m ? e.m.sid : e.h.mon.sid].types) +
        '<button type="button" class="btn ghost lu-lead" data-lulead="' + e.k + '">设为首发</button></li>';
    };
    d.innerHTML = '<div class="soc-box lu-box" role="dialog" aria-modal="true" aria-label="选择首发"><span class="tape l"></span><span class="tape r"></span>' +
      '<span class="step">第 ' + (i + 1) + ' 关「' + esc(x.n) + '」</span><h2>出战顺序</h2><p class="hint">按住精灵拖动可以调整顺序，排在第一个的就是首发；也可以点「设为首发」。</p>' +
      '<ol class="lu-list" id="lu-list">' + L.map(card).join('') + '</ol>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-lux="1">返回修改</button><button type="button" class="btn primary" data-lugo="1">开始战斗</button></div></div>';
    document.body.appendChild(d);
    var list = d.querySelector('#lu-list');
    var mark = function () { Array.prototype.forEach.call(list.children, function (li, k) { li.querySelector('.lu-no').textContent = k ? '第 ' + (k + 1) + ' 位' : '首发'; li.classList.toggle('lead', !k); }); };
    var order = function () { return Array.prototype.map.call(list.children, function (li) { return li.dataset.k; }); };
    mark();
    // 拖动排序：按住一张卡，移到哪张卡的位置就插到哪里（鼠标、触屏都可以）
    var drag = null;
    list.addEventListener('pointerdown', function (e) {
      var li = e.target.closest('.lu-card'); if (!li || e.target.closest('button')) return;
      drag = li; li.classList.add('drag'); try { list.setPointerCapture(e.pointerId); } catch (er) {}
      e.preventDefault();
    });
    list.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var best = null, bd = Infinity;
      Array.prototype.forEach.call(list.children, function (li) { var r = li.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dd = (cx - e.clientX) * (cx - e.clientX) + (cy - e.clientY) * (cy - e.clientY); if (dd < bd) { bd = dd; best = li; } });
      if (!best || best === drag) return;
      var kids = Array.prototype.slice.call(list.children);
      if (kids.indexOf(best) > kids.indexOf(drag)) list.insertBefore(drag, best.nextSibling); else list.insertBefore(drag, best);
      mark();
    });
    var end = function () { if (drag) { drag.classList.remove('drag'); drag = null; mark(); } };
    list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (t === d || t.closest('[data-lux]')) { ex.chalOrder = order(); d.remove(); return; }
      if (t.closest('[data-lulead]')) { var li = t.closest('.lu-card'); list.insertBefore(li, list.firstChild); mark(); return; }
      if (t.closest('[data-lugo]')) { ex.chalOrder = order(); d.remove(); startChal(P, i, ex.chalOrder); }
    });
  }
  function startChal(P, i, ord) {
    var x = CHAL[P][i]; if (!x || !chalLevelOpen(P, i)) return;
    var T = chalTeam(); if (!T.own.length) return;
    ex.chalOrder = ord || ex.chalOrder;
    var L = chalLineup(), own = L.filter(function (e) { return e.m; }).map(function (e) { return e.m; });
    var p = L.map(function (e) { return e.m ? storyMon(e.m) : helperSpec(e.h); });
    var a = x.foes.map(function (f) { seeMon(f.sid, Math.min(f.lv, MAX_LV)); var o = storyMon({ sid: f.sid, lv: f.lv, moves: [] }); if (f.q) o.lvq = 1; return o; });
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    var sconds = ['win', x.s2, x.s3];
    window.HSBATTLE.start({ p: p, a: a, foe: '挑战第 ' + (i + 1) + ' 关「' + x.n + '」', bgm: 'stage',
      stars: { title: '第 ' + (i + 1) + ' 关「' + x.n + '」星级要求', list: function (S) { var mine = S.sides[0].team, rec = acc.chal && acc.chal[x.id]; return sconds.map(function (c, k) { var st = starLive(c, S, mine); return { t: starTxt(c), st: st[0], s: st[1], had: !!(rec && rec.s[k]) }; }); } }, items: invCopy(), bg: BG[x.bg] || null, onItem: useInv,
      onEnd: function (res, seen, downs, quit, S) {
        var msg = [];
        if (res === 'win' && S) {
          var mine = S.sides[0].team, conds = ['win', x.s2, x.s3];
          var ok = conds.map(function (c) { return starOk(c, S, mine); });
          if (!acc.chal) acc.chal = {};
          var r = acc.chal[x.id] || (acc.chal[x.id] = { s: [false, false, false] }), before = chalStars(x.id);
          ok.forEach(function (v, k) { if (v) r.s[k] = true; });
          msg.push('挑战第 ' + (i + 1) + ' 关「' + x.n + '」通过！本次 ' + ok.filter(Boolean).length + ' 颗星' + (chalStars(x.id) > before && before ? '，最好成绩提升到 ' + chalStars(x.id) + ' 颗星' : '') + '。');
          var miss = conds.filter(function (c, k) { return !ok[k]; }).map(starTxt);
          if (miss.length) msg.push('没拿到的星：' + miss.join('；') + '。');
          if (!r.got) { r.got = Date.now(); acc.exp = (acc.exp || 0) + (x.reward.exp || 0); acc.energy = (acc.energy || 0) + (x.reward.energy || 0); if (x.reward.items) giveItems(x.reward.items); msg.push('首次通关奖励：' + rwList(x.reward).join('、') + '。'); }
          if (CHAL[P][i + 1] && !before) { ex.chal = i + 1; msg.push('第 ' + (i + 2) + ' 关已开放。'); }
          var tot = chalTotal(P), mi = CHAL_STAR.filter(function (y) { return tot >= y.n && !chalGot(y.n); });
          if (mi.length) msg.push('累计星数达到 ' + mi[mi.length - 1].n + ' 颗，挑战页上方可以领取星数奖励！');
        } else if (res !== 'win') msg.push(quit ? '退出了挑战。' : '挑战失败了……调整一下出战精灵再来吧。');
        dailyHit('pve');
        var ownSeen = seen ? L.map(function (e, k) { return e.m ? seen[k] : null; }).filter(function (v) { return v !== null; }) : null;
        msg = msg.concat(battleRewards(own, ownSeen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'sites'; ex.planet = P; ex.fpart = 'challenge';
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
        if (msg.length) setTimeout(function () { toast(msg.join('')); }, 300);
      } });
  }
  function chalClick(b) {
    if (b.dataset.chstar) { claimChalStar(+b.dataset.chstar); renderExplore(); return true; }
    if (b.dataset.tpgo) { ex.planet = 'jingchu'; teleport(b.dataset.tpgo); return true; }
    if (b.dataset.chal != null && b.dataset.chal !== undefined && !b.disabled) {
      var i = +b.dataset.chal; ex.chal = i;
      // 第一次点开第二关：插播支线「借来的力量」，读完自动选上明明教官的赫菲托斯
      if (i === 1 && unlocked('fl_chal2') && !prog('fl_chal2').done) { ex.chalHelper = 'mm'; startVN('fl_chal2', 'replay', $('pg-explore'), true); window.scrollTo(0, $('pg-explore').offsetTop - 8); return true; }
      renderExplore(); return true;
    }
    if (b.dataset.chown) {
      var u = +b.dataset.chown, k = ex.chalOwn.indexOf(u);
      if (k >= 0) ex.chalOwn.splice(k, 1); else ex.chalOwn.push(u);
      renderExplore(); return true;
    }
    if (b.dataset.chhelp !== undefined) {
      ex.chalHelper = b.dataset.chhelp || null;
      if (ex.chalHelper) { var T = chalTeam(); if (T.own.length > 4) ex.chalOwn = T.own.slice(0, 4).map(function (m) { return m.u; }); }
      renderExplore(); return true;
    }
    if (b.dataset.chgo) {
      var gi = +b.dataset.chgo;
      if (gi === 1 && unlocked('fl_chal2') && !prog('fl_chal2').done) { ex.chalHelper = 'mm'; startVN('fl_chal2', 'replay', $('pg-explore'), true); window.scrollTo(0, $('pg-explore').offsetTop - 8); return true; }   // 第二关：先强制播完明明教官的助战教学
      openLineup('flora', gi); return true;
    }
    return false;
  }


  /* ---------- 全服挑战进度（2026-10-17）：星球挑战页、先驱之塔页下方，服务器见 server/chalboard.js ---------- */
  var CB = {};
  function cbFetch(k) {
    var C = CB[k] || (CB[k] = { data: null, at: 0, busy: false });
    if (!pwOnline() || C.busy || (C.data && Date.now() - C.at < 30000)) return;
    C.busy = true;
    CLOUD.api('GET', '/api/chalboard?k=' + k).then(function (r) { C.busy = false; if (r._code === 200) { C.data = r; C.at = Date.now(); var el = $('cb-' + k); if (el) el.innerHTML = cbInner(k); } })
      .catch(function () { C.busy = false; });
  }
  function cbVal(k, r) { return k === 'tower' ? (r.s ? '通关 ' + r.s + ' 次' : '最高第 ' + r.v + ' 层') : '第 ' + r.v + ' 关 · ★' + r.s; }
  function cbInner(k) {
    var h = '<h4>全服挑战进度</h4>';
    if (!pwOnline()) return h + '<p class="hint">联网登录后，可以看到全服船员的挑战进度。</p>';
    var d = CB[k] && CB[k].data; if (!d) return h + '<p class="hint">正在读取……</p>';
    if (!d.players) return h + '<p class="hint">还没有船员开始挑战。来做第一个吧！</p>';
    var mx = Math.max.apply(null, d.buckets.map(function (b) { return b.n; }).concat([1]));
    return h + '<p class="hint">共 ' + d.players + ' 位船员参与' + (d.me ? '，你排第 <b>' + d.me.rank + '</b> 名（' + cbVal(k, d.me) + '）' : '') + '。' + (k === 'tower' ? '按通关次数、最高层数排名。' : '按最远关卡、星数排名。') + '</p>' +
      '<ul class="cb-bars">' + d.buckets.map(function (b) { return '<li><span>' + esc(b.label) + '</span><i><em style="width:' + (b.n / mx * 100).toFixed(1) + '%"></em></i><b>' + b.n + ' 人</b></li>'; }).join('') + '</ul>' +
      '<ol class="cb-top">' + d.top.map(function (r, i) { return '<li class="' + (d.me && r.user === d.me.user ? 'me' : '') + '"><span class="cb-rk">' + (i + 1) + '</span><span class="cb-nm">' + esc(r.name) + '</span><span class="cb-v">' + cbVal(k, r) + '</span></li>'; }).join('') + '</ol>';
  }
  function cbHTML(k) { setTimeout(function () { cbFetch(k); }, 0); return '<article class="cb-card" id="cb-' + k + '">' + cbInner(k) + '</article>'; }
  /* ---------- 先驱之塔（2026-10-17） ----------
   * 星球列表里排在荆楚号后面，读完第五段「降临芙罗拉」后开放。共 60 层，从下往上一层一层打。
   * 第 1、11、21、31、41、51 层自动存档；挑战失败（或中途退出）回到最近的存档点。
   * 第 1~59 层：玩家能获得的各种精灵，LV40 → LV80，每层 1~3 只，体力偏高，各带 1~2 个特性（逢 10 的层是 1 只更强的守层者）。
   * 第 60 层：死神「帕努托尔」LV80、体力 10000，【不朽】【肃穆】【死神】。击败后：称号「死神」、死神代币（一个账号最多 3 颗）、大量经验和代币，回到第 1 层。
   * 每天从塔里最多拿 150000 经验、1000 先驱代币（正好是通关两次的量）。
   * 存档：acc.tower = { f 当前层, cp 存档点, best 最高通过层, clears 通关次数, death 已获得的死神代币, tok 先驱代币, day: { d, exp, tok } } */
  var TOWER = { top: 60, cps: [1, 11, 21, 31, 41, 51], dayExp: 150000, dayTok: 1000, deathMax: 3 };
  var TW_POOL = ['leaf', 'squid', 'shroom', 'wind', 'mush', 'kaleo', 'faraday', 'firemouse', 'frost', 'gorgon', 'hephaestus', 'leigong', 'pede', 'siren', 'turkey', 'wild', 'tagore', 'leafcat', 'moon', 'bone', 'aegis'];
  var TW_FX = ['armor', 'regen', 'thorn', 'rage', 'swift', 'guard', 'noStatus', 'focus'];   // 只用塔里通用的特性，不用首领专属的（星球聚能、东北的纷争等）
  var TW_SHOP = [
    { k: 'floraJade', cost: 10 }, { k: 'fruit2', cost: 60 }, { k: 'cap3', cost: 80 }, { k: 'evAny', cost: 150 }, { k: 'evReset', cost: 200 },
    { k: 'ivReroll', cost: 400 }, { k: 'natAny', cost: 2000 }, { k: 'e_pluto', cost: 3000, death: 1 }
  ];
  function twRec() {
    if (!acc.tower) acc.tower = { f: 1, cp: 1, best: 0, clears: 0, death: 0, tok: 0 };
    var T = acc.tower, d = bjDay(); if (!T.day || T.day.d !== d) T.day = { d: d, exp: 0, tok: 0 };
    return T;
  }
  function twLv(f) { return f >= TOWER.top ? 80 : 40 + Math.round((f - 1) * 40 / 58); }
  function twExp(f) { return f >= TOWER.top ? 16000 : 400 + 20 * f; }          // 一次通关合计 75000
  function twTok(f) { return f >= TOWER.top ? 232 : 2 + Math.floor(f / 10); }   // 一次通关合计 500
  function twFloor(f) {
    if (f >= TOWER.top) return { boss: true, foes: [{ sid: 'pluto', lv: 80, hp: 10000, fx: { immortal: 1, solemn: 1, reaper: 1 } }] };
    var g = seeded('pioneer-tower:' + f), gate = f % 10 === 0, n = gate ? 1 : 1 + Math.floor(g() * 3), lv = twLv(f), used = {}, foes = [];
    for (var i = 0; i < n; i++) {
      var sid; do { sid = TW_POOL[Math.floor(g() * TW_POOL.length)]; } while (used[sid]); used[sid] = 1;
      var mult = gate ? 4 : n === 1 ? 3 : n === 2 ? 2 : 1.5, nfx = gate || f >= 30 ? 2 : 1, fx = { pp: 99 }, pick = {};
      while (Object.keys(pick).length < nfx) pick[TW_FX[Math.floor(g() * TW_FX.length)]] = 1;
      Object.keys(pick).forEach(function (k) { fx[k] = k === 'regen' ? 0.06 : 1; });
      foes.push({ sid: sid, lv: lv + (gate ? 2 : 0), hp: Math.round(calcStat(SPMAP[sid].base.hp, 'hp', lv) * mult), fx: fx });
    }
    return { gate: gate, foes: foes };
  }
  function fxNames(fx) { return BOSS_FX.filter(function (x) { return fx[x.k]; }).map(function (x) { return x; }); }
  function towerSvg() {
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 8 L72 30 H48 Z" fill="#c42f3a" stroke="#23222b" stroke-width="3" stroke-linejoin="round"/>' +
      '<rect x="46" y="30" width="28" height="78" fill="#e6eaf0" stroke="#23222b" stroke-width="3"/>' +
      [40, 54, 68, 82, 96].map(function (y) { return '<rect x="55" y="' + y + '" width="10" height="7" rx="2" fill="#f2c46b" stroke="#23222b" stroke-width="2"/>'; }).join('') +
      '<path d="M34 108 H86" stroke="#23222b" stroke-width="4" stroke-linecap="round"/></svg>';
  }
  function towerPage() {
    var T = twRec(), tab = ex.twTab === 'shop' ? 'shop' : 'climb';
    var head = '<div class="tw-head"><div class="tw-stat"><b>第 ' + T.f + ' 层</b><span>当前</span></div><div class="tw-stat"><b>第 ' + T.cp + ' 层</b><span>存档点</span></div><div class="tw-stat"><b>' + T.clears + '</b><span>通关次数</span></div>' +
      '<div class="tw-stat"><b>' + fmt(T.tok) + '</b><span>先驱代币</span></div><div class="tw-stat"><b>' + (acc.items.deathTok || 0) + '</b><span>死神代币</span></div></div>' +
      '<p class="hint tw-day">今天从先驱之塔获得：累积经验 ' + fmt(T.day.exp) + ' / ' + fmt(TOWER.dayExp) + '，先驱代币 ' + T.day.tok + ' / ' + TOWER.dayTok + '（北京时间 0 点重置）</p>' +
      '<div class="fparts" role="tablist"><button type="button" role="tab" class="tab' + (tab === 'climb' ? ' on' : '') + '" data-twtab="climb">挑战</button><button type="button" role="tab" class="tab' + (tab === 'shop' ? ' on' : '') + '" data-twtab="shop">代币商店</button></div>';
    return '<div class="tw-wrap">' + head + (tab === 'shop' ? towerShop(T) : towerClimb(T)) + '</div>';
  }
  function towerClimb(T) {
    var ladder = '<ol class="tw-ladder">';
    for (var f = TOWER.top; f >= 1; f--) {
      var cls = f < T.f ? 'done' : f === T.f ? 'cur' : 'lock';
      ladder += '<li class="tw-fl ' + cls + (f === TOWER.top ? ' top' : '') + (f % 10 === 0 && f < TOWER.top ? ' gate' : '') + '" title="第 ' + f + ' 层' + (TOWER.cps.indexOf(f) >= 0 ? '（存档点）' : '') + '">' + (TOWER.cps.indexOf(f) >= 0 ? '<i class="tw-cp" aria-hidden="true">⚑</i>' : '') + (f === TOWER.top ? '☠' : f) + '</li>';
    }
    ladder += '</ol>';
    var F = twFloor(T.f), team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (F.boss && (!ex.twPick || !team.some(function (m) { return m.u === ex.twPick; }))) ex.twPick = team.length ? team[0].u : null;
    var foes = F.foes.map(function (x) {
      var fm = form({ sid: x.sid, lv: x.lv }), k = wildKnown(x.sid) || F.boss;
      return '<li class="tw-foe"><img src="' + fm.img + '" alt=""><div><b>' + (F.boss ? '死神 · ' : '') + esc(fm.name) + '</b><small>LV' + x.lv + ' · 体力 ' + fmt(x.hp) + '</small><div class="tw-fx">' +
        fxNames(x.fx).map(function (z) { return '<span class="chip boss-diff" title="' + esc(z.d({ boss: x.fx, hp: x.hp })) + '">' + z.t + '</span>'; }).join('') + '</div>' +
        '<ul class="tw-fxd">' + fxNames(x.fx).map(function (z) { return '<li><b>【' + z.t + '】</b>' + esc(z.d({ boss: x.fx, hp: x.hp })) + '</li>'; }).join('') + '</ul></div></li>';
    }).join('');
    var ge = Math.min(twExp(T.f), Math.max(0, TOWER.dayExp - T.day.exp)), gt = Math.min(twTok(T.f), Math.max(0, TOWER.dayTok - T.day.tok));
    var teamHTML = F.boss ? '<h4>出战精灵 <span class="hint">【肃穆】只能派一只精灵单挑，点一下选择</span></h4><div class="ch-mons">' + team.map(function (m) { var f = form(m), on = m.u === ex.twPick; return '<button type="button" class="ch-mon' + (on ? ' on' : '') + '" data-twpick="' + m.u + '" aria-pressed="' + on + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + '</small></button>'; }).join('') + '</div>'
      : '<p class="hint">使用当前的出战配队（' + TEAM_NAME[acc.active] + '，' + team.length + ' 只）。战斗中可以使用补药。</p>';
    return '<div class="tw-cols">' + ladder + '<article class="tw-detail"><span class="tape r"></span><span class="sc-tag">' + (F.boss ? '塔顶 · 第 60 层' : F.gate ? '第 ' + T.f + ' 层 · 守层者' : '第 ' + T.f + ' 层') + '</span>' +
      '<h3>' + (F.boss ? '死神「帕努托尔」' : '第 ' + T.f + ' 层') + '</h3><ul class="tw-foes">' + foes + '</ul>' +
      '<p class="ch-rw"><b>通过奖励</b>　<span class="chip">累积经验 ×' + fmt(twExp(T.f)) + '</span> <span class="chip">先驱代币 ×' + twTok(T.f) + '</span>' + (F.boss ? ' <span class="chip">死神代币 ×1（' + T.death + ' / ' + TOWER.deathMax + '）</span> <span class="chip">称号「死神」</span>' : '') +
      (ge < twExp(T.f) || gt < twTok(T.f) ? '<span class="hint">（今天的塔内奖励快到上限了：这一层实际只能拿到经验 ×' + fmt(ge) + '、代币 ×' + gt + '）</span>' : '') + '</p>' +
      teamHTML +
      '<div class="ch-go"><button type="button" class="btn primary" data-twgo="1"' + (team.length ? '' : ' disabled') + '>挑战第 ' + T.f + ' 层</button><span class="hint">第 1、11、21、31、41、51 层自动存档；挑战失败或中途退出，会回到存档点第 ' + T.cp + ' 层。' + (F.boss ? '击败死神后回到第 1 层。' : '') + '</span></div></article></div>' + cbHTML('tower');
  }
  function towerShop(T) {
    return '<p class="hint">用先驱代币兑换道具。性格在这个世界里格外珍稀，所以性格胶囊很贵。</p><div class="tw-shop">' + TW_SHOP.map(function (x, i) {
      var it = USE_ITEMS[x.k] || MATS[x.k] || ITEMS[x.k], ok = T.tok >= x.cost && (!x.death || (acc.items.deathTok || 0) >= x.death);
      return '<article class="tw-item"><b>' + itemName(x.k) + '</b><p class="hint">' + esc(it ? it.d : '') + '</p><p class="tw-cost">' + fmt(x.cost) + ' 先驱代币' + (x.death ? ' + ' + x.death + ' 死神代币' : '') + '</p>' +
        '<button type="button" class="btn' + (ok ? ' primary' : '') + '" data-twbuy="' + i + '"' + (ok ? '' : ' disabled') + '>兑换</button>' + (acc.items[x.k] ? '<span class="hint">已有 ' + acc.items[x.k] + '</span>' : '') + '</article>';
    }).join('') + '</div>';
  }
  function startTower() {
    var T = twRec(), f = T.f, F = twFloor(f);
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!team.length) return;
    team = F.boss ? [mon(ex.twPick) || team[0]] : team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon);
    var a = F.foes.map(function (x) { seeMon(x.sid, x.lv); var fm = form({ sid: x.sid, lv: x.lv }); return { id: x.sid, lv: x.lv, moves: defaultMoves(x.sid, x.lv), nick: (F.boss ? '死神 · ' : '') + fm.name, img: fm.img, maxhp: x.hp, boss: JSON.parse(JSON.stringify(x.fx)) }; });
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: '先驱之塔', diff: F.boss ? '第 60 层 · 死神' : '第 ' + f + ' 层', bgm: F.boss ? 'boss3' : 'stage', items: invCopy(), onItem: useInv, back: '先驱之塔',
      onEnd: function (res, seen, downs, quit) {
        var msg = [];
        dailyHit('pve');
        if (res === 'win') {
          var ge = Math.min(twExp(f), Math.max(0, TOWER.dayExp - T.day.exp)), gt = Math.min(twTok(f), Math.max(0, TOWER.dayTok - T.day.tok));
          T.day.exp += ge; T.day.tok += gt; acc.exp = (acc.exp || 0) + ge; T.tok += gt; T.best = Math.max(T.best, f);
          msg.push('先驱之塔第 ' + f + ' 层通过！' + (ge || gt ? '获得累积经验 ×' + fmt(ge) + '、先驱代币 ×' + gt + (ge < twExp(f) || gt < twTok(f) ? '（已到今天的塔内奖励上限）' : '') + '。' : '今天从先驱之塔获得的奖励已经到上限了。'));
          if (F.boss) {
            T.clears++;
            if (T.death < TOWER.deathMax) { T.death++; giveItems({ deathTok: 1 }); msg.push('获得「死神代币」×1（' + T.death + ' / ' + TOWER.deathMax + '）。'); } else msg.push('死神代币已经拿满 ' + TOWER.deathMax + ' 颗了。');
            T.f = 1; T.cp = 1; msg.push('塔顶的光芒把你送回了第 1 层。');
          } else { T.f = f + 1; if (TOWER.cps.indexOf(T.f) >= 0) { T.cp = T.f; msg.push('到达第 ' + T.f + ' 层，进度已自动存档。'); } }
        } else { T.f = T.cp; msg.push((quit ? '退出了挑战' : '挑战失败了') + '……回到存档点第 ' + T.cp + ' 层。'); }
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'sites'; ex.planet = 'tower'; ex.twTab = 'climb';
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
        if (msg.length) setTimeout(function () { toast(msg.join('')); }, 300);
      } });
  }
  function towerClick(b) {
    if (b.dataset.twtab) { ex.twTab = b.dataset.twtab; renderExplore(); return true; }
    if (b.dataset.twpick) { ex.twPick = +b.dataset.twpick; renderExplore(); return true; }
    if (b.dataset.twgo) { startTower(); return true; }
    if (b.dataset.twbuy != null && b.dataset.twbuy !== undefined) {
      var T = twRec(), x = TW_SHOP[+b.dataset.twbuy]; if (!x) return true;
      if (T.tok < x.cost || (x.death && (acc.items.deathTok || 0) < x.death)) { toast('代币不够。'); return true; }
      T.tok -= x.cost; if (x.death) acc.items.deathTok -= x.death;
      var o = {}; o[x.k] = 1; giveItems(o); save(); renderExplore();
      toast('兑换了「' + itemName(x.k) + '」，已放入储存箱。' + (x.k === 'e_pluto' ? '放进神农架 · 精灵保育仓就能孵化。' : ''));
      return true;
    }
    return false;
  }
  // 其他星球的探索页（只有捕捉）
  function wildPage(P) {
    var regs = regionsOf(P.id);
    var part = ex.fpart === 'task' ? 'task' : 'catch';
    var head = '<div class="flora-hero"><span class="tape l"></span>' + (P.img ? planetImg(P, 150) : planetSvgC(P, 150)) + '<div><h3 style="color:' + P.color[1] + '">' + P.name + ' <span class="chip ptype">' + P.ptype + '</span></h3><p class="hint">' + P.d + (P.img ? '' : '星球立绘还在绘制中，这里先用示意图。') + '</p>' +
      '<div class="fparts" role="tablist"><button type="button" role="tab" class="tab' + (part === 'catch' ? ' on' : '') + '" data-fpart="catch" aria-selected="' + (part === 'catch') + '">捕捉</button>' + taskTab(P.id, part) + '</div></div></div>';
    if (part === 'task') return head + planetTasks(P.id);
    var cards = regs.map(function (R) {
      var bgs = (R.bgs || []).filter(function (k) { return BG[k]; });
      return '<article class="region"><div class="rg-art">' + (bgs.length ? '<img src="' + BG[bgs[0]] + '" alt="' + R.name + '">' : regionArt(R.id)) + '</div><div class="rg-txt"><h4>' + R.name + ' <small>' + R.en + '</small></h4><p class="hint">' + R.d + '</p>' +
        '<button type="button" class="btn primary" data-field="' + R.id + '">进入' + R.name + '</button></div></article>';
    }).join('');
    var list = [];
    var seenSid = {};   // 同一种精灵在几个区域都有时，合成一条，「出现」里列出各个区域
    regs.forEach(function (R) { (WILD[R.pool] || []).forEach(function (w) {
      if (seenSid[w.sid]) return; seenSid[w.sid] = 1;
      var k = wildKnown(w.sid), f = form({ sid: w.sid, lv: w.lv[0] }), sid_ = w.sid;
      var where = []; regs.forEach(function (R2) { (WILD[R2.pool] || []).forEach(function (x) { if (x.sid === w.sid) where.push(x.bait ? R2.name + '（放了一碗饭的场景）' + Math.round(RICE.chance * 100) + '%' : R2.name + ' ' + x.w + '%'); }); });
      list.push('<li class="wl ' + (k || 'unk') + '">' + (k ? '<img src="' + f.img + '" alt="">' : silTag(sid_, f.stage)) + '<span><b>' + (k ? esc(f.name) : '？？？') + '</b>' + (w.rare ? '<span class="chip rare">稀有</span>' : '') +
        '<small>LV' + (w.lv[0] === w.lv[1] ? w.lv[0] + '（固定）' : w.lv[0] + '–' + w.lv[1]) + ' · 捕捉率' + w.tag + '</small><small>出现：' + where.join(' · ') + '</small>' +
        '<small class="wk">' + (k === 'own' ? '已捕捉' : k === 'seen' ? '见过 · 未捕捉' : '未遇见') + '</small></span></li>');
    }); });
    regs.forEach(function (R) { (R.bgs || []).forEach(function (bk) { ((typeof WILD_SCENE !== 'undefined' && WILD_SCENE[bk]) || []).forEach(function (w) {   // 只在某个场景出现的精灵
      if (seenSid[w.sid]) return; seenSid[w.sid] = 1;
      var tot = (WILD[R.pool] || []).reduce(function (a, x) { return a + x.w; }, 0), pct = Math.round(w.w / (tot + w.w) * 100);
      var k = wildKnown(w.sid), f = form({ sid: w.sid, lv: w.lv[0] });
      list.push('<li class="wl ' + (k || 'unk') + '">' + (k ? '<img src="' + f.img + '" alt="">' : silTag(w.sid, f.stage)) + '<span><b>' + (k ? esc(f.name) : '？？？') + '</b>' + (w.rare ? '<span class="chip rare">稀有</span>' : '') +
        '<small>LV' + (w.lv[0] === w.lv[1] ? w.lv[0] + '（固定）' : w.lv[0] + '–' + w.lv[1]) + ' · 捕捉率' + w.tag + '</small><small>出现：' + R.name + ' · ' + (BG_NAME[bk] || '某个场景') + ' ' + pct + '%</small>' +
        '<small class="wk">' + (k === 'own' ? '已捕捉' : k === 'seen' ? '见过 · 未捕捉' : '未遇见') + '</small></span></li>');
    }); }); });
    return head + invLine() + '<div class="regions">' + cards + '</div>' +
      '<div class="wild-list"><h4>' + P.name + '的野生精灵</h4><ul>' + list.join('') + '</ul><p class="hint">进入区域后，精灵会在场景里走动，点中哪只就和哪只对战。捕捉、经验和学习力的规则和芙罗拉星一样。</p></div>';
  }

  /* ---------- 星球任务：每颗星球的专属任务 ---------- */
  // 芙罗拉星 · 祛除瘴气：任务完成前，在芙罗拉星作战有 10% 概率遇到瘴气精灵（自带 5 层瘴气，无法捕捉），击败它们累计计数
  var PURGE = { chance: 0.1, goal: 30, steps: [{ n: 1, exp: 300 }, { n: 5, exp: 1000 }, { n: 10, exp: 2000 }, { n: 20, exp: 4000 }, { n: 30, exp: 12000, title: 'purifier' }] };
  function purgeRec() { if (!acc.purge) acc.purge = { n: 0, got: {} }; return acc.purge; }
  function purgeActive() { return prog('flora1').done && purgeRec().n < PURGE.goal; }
  function purgeHit() {
    var P = purgeRec(), out = []; P.n++;
    out.push('祛除了一只瘴气精灵（' + P.n + ' / ' + PURGE.goal + '）。');
    PURGE.steps.forEach(function (s) {
      if (P.n >= s.n && !P.got[s.n]) {
        P.got[s.n] = Date.now(); acc.exp += s.exp;
        out.push('星球任务「祛除瘴气」：累计击败 ' + s.n + ' 只，经验背包 +' + fmt(s.exp) + '。');
        if (s.title) { if (acc.titles.indexOf(s.title) < 0) acc.titles.push(s.title); out.push('任务完成！获得称号「' + titleName(s.title) + '」，芙罗拉星的瘴气被彻底祛除了。'); renderTitle(); }
      }
    });
    save(); return out;
  }
  function planetTaskList(pid) { return pid === 'flora' ? ['purge', 'war'] : []; }
  function taskTab(pid, part) {
    var n = pid === 'flora' && prog('flora1').done && purgeRec().n < PURGE.goal ? 1 : 0;
    return '<button type="button" role="tab" class="tab' + (part === 'task' ? ' on' : '') + '" data-fpart="task" aria-selected="' + (part === 'task') + '">星球任务' + (n ? '<i class="q-badge">' + n + '</i>' : '') + '</button>';
  }
  function planetTasks(pid) {
    if (!planetTaskList(pid).length) return '<div class="fl-soon"><span class="tape r"></span><b>星球任务</b><p>这颗星球暂时还没有专属任务。</p><p class="hint">敬请期待。</p></div>';
    var P = purgeRec(), open = prog('flora1').done, done = P.n >= PURGE.goal;
    var steps = PURGE.steps.map(function (s) {
      var got = P.got[s.n];
      return '<li class="pt-step' + (got ? ' got' : '') + '"><span class="pt-n">' + s.n + ' 只</span><span>经验背包 +' + fmt(s.exp) + (s.title ? '，称号「' + titleName(s.title) + '」' : '') + '</span><span class="pt-st">' + (got ? '已获得' : P.n + ' / ' + s.n) + '</span></li>';
    }).join('');
    return '<article class="pt-card"><span class="tape l"></span><span class="chip log-tag">剧情任务</span><h3>祛除瘴气</h3>' +
      '<p>盐碱地的瘴气正慢慢渗进丛林和草甸，有些野生精灵已经被侵染了。击败这些瘴气精灵，就能把它们身上的瘴气祛除。</p>' +
      '<p class="hint">' + (done ? '任务已完成。' : !open ? '读完主线「降临芙罗拉」后开始。' : floraFallen() ? '芙罗拉星上的精灵已经被腐化了。在丛林、草甸击败这些腐化精灵，也能祛除它们身上的瘴气。' : '在芙罗拉星的丛林、草甸作战时，有 10% 的概率遇到瘴气精灵。它们自带 5 层瘴气，无法捕捉，只能击败。') + '</p>' +
      '<div class="pt-bar"><i style="width:' + Math.min(100, P.n / PURGE.goal * 100) + '%"></i><em>已祛除 ' + Math.min(P.n, PURGE.goal) + ' / ' + PURGE.goal + '</em></div>' +
      '<ol class="pt-steps">' + steps + '</ol>' +
      (open && !done ? '<p class="hint">去「捕捉」页的丛林或草甸作战即可。</p><button type="button" class="btn primary" data-fpart="catch">去丛林 / 草甸</button>' : '') + '</article>' +
      (pwOpen() ? pwCardHTML('task') : '<article class="pt-card pw-card locked"><span class="tape l"></span><span class="chip log-tag pw-tag">全服任务</span><h3>瘴气驱逐战</h3><p class="hint">完成目前的主线（第十段）后解锁。</p></article>');
  }

  /* ---------- 瘴气驱逐战（芙罗拉星 · 全服共享进度的星球任务，2026-10-17） ----------
   * 完成目前主线的最后一段（第十段 · 瘴气之源）后开放。服务器见 server/purgewar.js。
   * 在芙罗拉星野外击败腐化精灵：自己经验背包 +1000，全服击破 +1。
   * 全服击破 10 / 50 / 100、之后每 50 只：贡献过（击破 ≥ 1）的船员各收到一封奖励邮件（经验、能量、芙罗拉玉、星砂、星核，数额暂定） */
  var PW = { exp: 1000, cap: 50, data: null, at: 0, busy: false, err: '' };   // cap：每人每天最多计入 50 次击破（服务器同样限制）
  function pwDay() { var d = bjDay(); if (!acc.pwd || acc.pwd.d !== d) acc.pwd = { d: d, n: 0 }; return acc.pwd; }
  function pwOpen() { return floraFallen(); }
  function pwOnline() { return !!(window.CLOUD && CLOUD.user && CLOUD.user()); }
  function pwMilestones(upTo) { var L = [10, 50, 100]; for (var m = 150; m <= upTo; m += 50) L.push(m); return L.filter(function (x) { return x <= upTo; }); }
  function pwNext(t) { if (t < 10) return 10; if (t < 50) return 50; if (t < 100) return 100; return (Math.floor(t / 50) + 1) * 50; }
  function pwPrev(t) { if (t < 10) return 0; if (t < 50) return 10; if (t < 100) return 50; return Math.floor(t / 50) * 50; }
  function pwReward(m) {
    if (m === 10) return { exp: 5000, energy: 1000, items: { floraJade: 20, g_sand: 24, g_core: 1 } };
    if (m === 50) return { exp: 15000, energy: 3000, items: { floraJade: 50, g_sand: 48, g_core: 2 } };
    if (m === 100) return { exp: 30000, energy: 5000, items: { floraJade: 100, g_sand: 96, g_core: 4 } };
    return { exp: 20000, energy: 4000, items: { floraJade: 60, g_sand: 48, g_core: 2 } };
  }
  function pwRwText(w) { return '累积经验 ×' + fmt(w.exp) + '、能量 ×' + fmt(w.energy) + '、' + Object.keys(w.items).map(function (k) { return itemName(k) + ' ×' + w.items[k]; }).join('、'); }
  function pwRec() { if (!acc.pw) acc.pw = { got: {} }; if (!acc.pw.got) acc.pw.got = {}; return acc.pw; }
  function pwApply(d) { PW.data = d; PW.at = Date.now(); PW.err = ''; pwClaim(); pwRedraw(); }
  function pwFetch(force) {
    if (!pwOpen() || !pwOnline() || PW.busy) return;
    if (!force && PW.data && Date.now() - PW.at < 30000) return;
    PW.busy = true;
    CLOUD.api('GET', '/api/purgewar').then(function (r) { PW.busy = false; if (r._code === 200) pwApply(r); else { PW.err = r.error || '读取失败'; pwRedraw(); } })
      .catch(function () { PW.busy = false; PW.err = '连不上服务器'; pwRedraw(); });
  }
  function pwHit() { if (!pwOnline()) return; CLOUD.api('POST', '/api/purgewar-hit', {}).then(function (r) { if (r._code === 200) pwApply(r); }).catch(function () {}); }
  // 全服达到里程碑：给贡献过的自己发奖励邮件（每个里程碑只发一次）
  function pwClaim() {
    var d = PW.data; if (!d || !(d.me > 0)) return;
    var R = pwRec(), any = false;
    pwMilestones(d.total).forEach(function (m) {
      if (R.got[m]) return; R.got[m] = 1; any = true;
      var w = pwReward(m);
      sendMail({ id: 'pw-' + m, title: '瘴气驱逐战 · 全服击破 ' + m + ' 只', body: '{name}，你好！\n全服船员在瘴气驱逐战中，已经一起击破了 ' + m + ' 只腐化精灵！\n你目前一共击破了 ' + d.me + ' 只，感谢你的贡献。奖励请领取附件。', att: { exp: w.exp, energy: w.energy, items: w.items } });
    });
    if (any) { save(); if (typeof renderTop === 'function') setTimeout(renderTop, 0); }
  }
  function pwInner() {
    var d = PW.data, head = '<span class="tape l"></span><span class="tape r"></span><span class="chip log-tag pw-tag">全服任务</span><h3>瘴气驱逐战</h3>' +
      '<p>芙罗拉星已经被腐化。所有船员一起，在芙罗拉星的丛林、草甸击败腐化精灵：每击破一只，你的经验背包 +' + fmt(PW.exp) + '，全服进度 +1。每人每天最多计入 ' + PW.cap + ' 次。</p>';
    if (!pwOnline()) return head + '<p class="hint">瘴气驱逐战是全服任务，需要用服务器网址打开游戏并登录后才能参与。</p>';
    if (!d) return head + '<p class="hint">' + (PW.err ? esc(PW.err) : '正在读取全服进度……') + '</p>';
    var prev = pwPrev(d.total), next = pwNext(d.total), pct = Math.min(100, (d.total - prev) / (next - prev) * 100);
    var ms = [10, 50, 100].concat([150, 200, 250]).filter(function (m) { return m > d.total - 100; }).slice(0, 5);
    if (ms.indexOf(next) < 0) ms = [next, next + 50, next + 100];
    return head +
      '<div class="pw-big"><b class="pw-num">' + fmt(d.total) + '</b><span>全服已击破</span></div>' +
      '<div class="pw-bar"><i style="width:' + pct.toFixed(1) + '%"></i><em>' + d.total + ' / ' + next + ' · 下一个全服奖励</em></div>' +
      '<ol class="pw-ms">' + ms.map(function (m) { var ok = d.total >= m; return '<li class="' + (ok ? 'ok' : '') + '"><b>' + m + ' 只</b><span>' + pwRwText(pwReward(m)) + '</span><em>' + (ok ? (d.me > 0 ? '已发放' : '已达成') : '未达成') + '</em></li>'; }).join('') + '</ol>' +
      '<p class="hint">全服击破 10、50、100 只，之后每 50 只，所有击破过腐化精灵的船员都会收到一封奖励邮件。之后的奖励和 150 只的一样。</p>' +
      '<div class="pw-me"><span>你的贡献：<b>' + d.me + '</b> 只</span><span>今天：<b>' + Math.max(d.today || 0, pwDay().n) + '</b> / ' + PW.cap + '</span><span>参与船员：<b>' + d.players + '</b> 人</span></div>' +
      (d.top.length ? '<ol class="pw-top">' + d.top.map(function (x, i) { return '<li><span class="pw-rk">' + (i + 1) + '</span><span class="pw-nm">' + esc(x.name) + '</span><b>' + x.n + '</b></li>'; }).join('') + '</ol>' : '<p class="hint">还没有船员击破腐化精灵，来做第一个吧。</p>') +
      '<button type="button" class="btn primary" data-golog="flora-catch" data-fpart="catch">去芙罗拉星的丛林 / 草甸</button>';
  }
  function pwCardHTML(where) {
    if (!pwOpen()) return where === 'log' ? '<article class="log-card wide pw-card locked"><span class="tape l"></span><span class="chip log-tag pw-tag">全服任务</span><h3>瘴气驱逐战</h3><p class="hint">完成目前的主线（第十段 · 瘴气之源）后解锁。</p></article>' : '';
    setTimeout(function () { pwFetch(); }, 0);
    return '<article class="log-card wide pw-card" id="pw-card-' + where + '">' + pwInner() + '</article>';
  }
  function pwRedraw() { ['log', 'task'].forEach(function (w) { var el = $('pw-card-' + w); if (el) el.innerHTML = pwInner(); }); }
  setInterval(function () { if ($('pw-card-log') || $('pw-card-task')) pwFetch(); }, 30000);

  /* 芙罗拉玉：瘴气驱逐战开放后，芙罗拉星丛林、草甸的场景里每天有一定概率冒出来（每个场景每天最多一块，捡到 1~3 个） */
  function jadeSpot(rid, scene) {
    if (!pwOpen() || (rid !== 'forest' && rid !== 'grass')) return null;
    var g = seeded(bjDay() + ':jade:' + rid + ':' + scene + ':' + (acc.created || 0));
    return g() < 0.35 ? { x: 15 + Math.floor(g() * 66), y: 68 + Math.floor(g() * 16), n: 1 + Math.floor(g() * 3) } : null;
  }
  function jadeRec() { var d = bjDay(); if (!acc.jade || acc.jade.d !== d) acc.jade = { d: d, got: {} }; return acc.jade; }
  function jadeHTML(rid, scene) {
    var J = jadeSpot(rid, scene); if (!J) return '';
    var got = !!jadeRec().got[rid + ':' + scene];
    return got ? '' : '<button type="button" class="wf-node wf-jade" data-jade="' + scene + '" style="left:' + J.x + '%;top:' + J.y + '%" title="芙罗拉玉 ×' + J.n + '" aria-label="捡起芙罗拉玉 ×' + J.n + '"><i class="wf-gem" aria-hidden="true"></i><span>芙罗拉玉</span></button>';
  }
  function jadeAt(scene) {
    var R = regionById(ex.region), J = R && jadeSpot(R.id, scene); if (!J) return;
    var rec = jadeRec(), key = R.id + ':' + scene; if (rec.got[key]) return;
    rec.got[key] = 1; giveItems({ floraJade: J.n }); save();
    toast('捡到了「芙罗拉玉」×' + J.n + '，已放入储存箱。100 个芙罗拉玉可以让玛西露姆、六尾风王、卡莱奥丹一系领悟一个隐藏技能。');
    var el = document.querySelector('#wf-scene [data-jade]'); if (el) el.remove();
  }

  /* ---------- 神秘精灵：每天 16:00–24:00，切换场景时有 3% 概率出现（真身是 LV10 幽灵鱼） ---------- */
  var MYSTERY = { sid: 'hauris', lv: 10, rate: 0.4, chance: 0.03, shiny: 0.03, from: 16, to: 24 };
  function mysteryTime() { var h = new Date().getHours(); return h >= MYSTERY.from && h < MYSTERY.to; }
  function mysteryRoll(where) {
    if (!ready() || ex.fighting || !mysteryTime() || $('mys')) return;
    if (Math.random() >= MYSTERY.chance) return;
    var d = document.createElement('div'); d.id = 'mys'; d.className = 'mys'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', '神秘精灵');
    d.dataset.where = where || '星际探索';
    var sh = Math.random() < MYSTERY.shiny; if (sh) d.dataset.shiny = '1';
    d.innerHTML = '<div class="mys-box"><span class="tape l"></span><div class="mys-art"><img src="' + form({ sid: MYSTERY.sid, lv: MYSTERY.lv, shiny: sh }).img + '" alt=""></div><b>神秘精灵出现了！</b><p>一团忽明忽暗的影子从' + esc(d.dataset.where) + '的角落里飘了出来，正盯着你看。</p>' +
      '<div class="row"><button type="button" class="btn primary" data-mys="go">迎战</button><button type="button" class="btn" data-mys="no">放它离开</button></div></div>';
    document.body.appendChild(d);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mys]'); if (!b) return;
    var d = $('mys'), where = d ? d.dataset.where : '星际探索', sh = !!(d && d.dataset.shiny); if (d) d.remove();
    if (b.dataset.mys === 'go') startWildBattle({ sid: MYSTERY.sid, lv: MYSTERY.lv, rate: MYSTERY.rate, shiny: sh, back: where, where: '神秘精灵 · ' + where, foe: '神秘精灵' });
    else toast('神秘的影子一闪，消失不见了。');
  });

  /* ---------- 排位赛季奖励：首次达到每个段位各奖励一次，达到铂金送 LV10 小月亮 ---------- */
  var SEASON = 'S1';
  // 2026-10-11 起段位奖励翻倍（RANK_RW_OLD 是翻倍前的标准，用来给之前领过的玩家算补发差额）
  var RANK_RW_OLD = [null, { exp: 500, energy: 200 }, { exp: 1000, energy: 300 }, { exp: 1500, energy: 400 }, { exp: 2000, energy: 500 },
    { exp: 2500, energy: 600 }, { exp: 3000, energy: 700 }, { exp: 3500, energy: 800 }, { exp: 4000, energy: 900 }, { exp: 4500, energy: 1000 }, { exp: 5000, energy: 1200 }];
  var RANK_GIFT = { 4: [{ sid: 'moon', lv: 10 }], 10: [{ sid: 'bone', lv: 10 }] };   // 铂金送小月亮，王者送凶骨（骨刃一阶）
  // 2026-10-11 起各段位额外送道具（之前已经领过的段位，差的道具用邮箱补发）
  // 段位不再发放加强装置和华为装置，这两种只能在冶炼坊合成。翡翠、钻石、星耀改为普通捕捉装置。
  var RANK_ITEMS = { 2: { cap1: 5 }, 3: { cap1: 5 }, 5: { cap1: 5 }, 6: { cap1: 5 }, 7: { cap1: 5, evAny: 1 }, 8: { evAny: 1 }, 9: { evAny: 2 }, 10: { evAny: 3 } };
  var RANK_RW = RANK_RW_OLD.map(function (R, r) { return R && { exp: R.exp * 2, energy: R.energy * 2, gift: RANK_GIFT[r], title: 'S1-' + r, items: RANK_ITEMS[r] }; });
  function itemsText(o) { return o ? Object.keys(o).map(function (k) { return itemName(k) + ' ×' + o[k]; }).join('、') : ''; }
  function rankBest() { try { var r = JSON.parse(localStorage.getItem('hs-rank-v1') || 'null'); return r ? Math.max(r.best || 0, r.r || 0) : 0; } catch (e) { return 0; } }
  function rankRec() { if (!acc.rankRw || acc.rankRw.season !== SEASON) acc.rankRw = { season: SEASON, got: {} }; return acc.rankRw; }
  function checkRankRewards() {
    if (!ready()) return;
    var rec = rankRec(), best = rankBest(), msg = [];
    for (var r = 1; r <= best && r < RANK_RW.length; r++) if (!rec.got[r]) {
      var R = RANK_RW[r]; rec.got[r] = Date.now();
      acc.exp += R.exp; acc.energy += R.energy; giveItems(R.items);
      var line = '首次达到' + RANKS[r] + '段位：累积经验 +' + fmt(R.exp) + '，能量 +' + fmt(R.energy) + (R.items ? '，' + itemsText(R.items) : '');
      (R.gift || []).forEach(function (g) { var m = newMon(g.sid, g.lv), T = acc.teams[acc.active]; if (T.length < TEAM_SIZE) T.push(m.u); line += '，并获得了 ' + form(m).name + ' LV' + g.lv + '！'; });
      msg.push(line + '。');
    }
    if (msg.length) { save(); renderRes(); setTimeout(function () { toast('排位赛季奖励 · ' + msg.join('')); }, 500); }
  }

  /* ---------- 邮箱 ----------
   * acc.mail：邮件列表（新的在前）；acc.mailSeen：已经投递过的邮件编号，删掉了也不会重发
   * 全服邮件写在 js/data/mail.js；按每个人情况算的补发，在这里用 sendMail() */
  var MAIL_MAX = 100;
  function dayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function mails() { if (!Array.isArray(acc.mail)) acc.mail = []; if (!acc.mailSeen) acc.mailSeen = {}; return acc.mail; }
  function hasAtt(a) { return !!(a && (a.exp || a.energy || a.merit || a.tokens || (a.items && Object.keys(a.items).length) || (a.mons && a.mons.length))); }
  function attList(a) {
    var r = []; if (!a) return r;
    if (a.exp) r.push('累积经验 ×' + fmt(a.exp)); if (a.energy) r.push('能量 ×' + fmt(a.energy)); if (a.merit) r.push('功勋点 ×' + fmt(a.merit)); if (a.tokens) r.push('竞技代币 ×' + fmt(a.tokens));
    if (a.items) for (var k in a.items) r.push(itemName(k) + ' ×' + a.items[k]);
    (a.mons || []).forEach(function (g) { if (SPMAP[g.sid]) r.push(form(g).name + ' LV' + g.lv); });
    return r;
  }
  function sendMail(m) {
    var L = mails();
    if (m.id && acc.mailSeen[m.id]) return false;
    if (m.id) acc.mailSeen[m.id] = Date.now();
    L.unshift({ id: m.id || 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), date: m.date || dayStr(), from: m.from || '荆楚号舰务处',
      title: m.title, body: m.body || '', att: hasAtt(m.att) ? m.att : null, read: false, got: !hasAtt(m.att) });
    // 超过上限时，先删最旧的已读已领邮件
    while (L.length > MAIL_MAX) { var k = -1; for (var i = L.length - 1; i >= 0; i--) if (L[i].read && L[i].got) { k = i; break; } if (k < 0) break; L.splice(k, 1); }
    return true;
  }
  /* ---------- 登录奖励（都通过邮箱发） ----------
   * 离线经验：距离上次在线超过 20 分钟再打开游戏，每离线 1 分钟给 6 点累积经验（游戏开着时每 2 分钟记一次在线时间）
   * 每日登录：每天（北京时间）3000 累积经验；没登录的日子，下次登录时一起补发（从创建账号那天算起） */
  var OFFLINE_GAP = 20 * 60000, OFFLINE_RATE = 6, OFFLINE_MAX_MIN = 3 * 24 * 60, LOGIN_EXP = 3000, onlineSeen = false;   // 离线经验最多算 3 天
  function dayNum(t) { return Math.floor((t + 8 * 3600e3) / 86400000); }
  function loginRewards() {
    if (!ready()) return;
    var now = Date.now(), last = acc.lastActive, dirty = false;
    onlineSeen = true;
    if (last && now - last > OFFLINE_GAP) {
      var mins = Math.floor((now - last) / 60000), paid = Math.min(mins, OFFLINE_MAX_MIN), xp = paid * OFFLINE_RATE;
      sendMail({ title: '离线经验', body: '{name}，欢迎回来！\n你离开了 ' + (mins >= 1440 ? Math.floor(mins / 1440) + ' 天 ' : '') + durText(mins % 1440) + '。这段时间里，精灵们也在自己训练：每分钟 ' + OFFLINE_RATE + ' 点累积经验' + (mins > OFFLINE_MAX_MIN ? '，最多算 3 天' : '') + '，一共 ' + fmt(xp) + ' 点，请领取附件。', att: { exp: xp } });
    }
    if (!last || now - last > 60000) { acc.lastActive = now; dirty = true; }
    var today = dayNum(now), from = acc.loginDay != null ? acc.loginDay + 1 : dayNum(acc.created || now);
    if (from <= today) {
      var miss = today - from;
      if (miss > 0) sendMail({ id: 'login-back-' + today, title: '每日登录奖励补发（' + miss + ' 天）', body: '{name}，你好！\n每天登录都能领取 ' + fmt(LOGIN_EXP) + ' 累积经验。之前没有领到的 ' + miss + ' 天，现在一起补发，请领取附件。', att: { exp: miss * LOGIN_EXP } });
      sendMail({ id: 'login-' + today, title: '每日登录奖励', body: '{name}，今天也欢迎登船！\n每天登录都能领取累积经验 ×' + fmt(LOGIN_EXP) + '，请领取附件。', att: { exp: LOGIN_EXP } });
      acc.loginDay = today; dirty = true;
    }
    if (dirty) save();
  }
  // 关页面时 visibilitychange 和 pagehide 会连着触发：几秒内已经记过就不再改，免得存档在上传之后又变了（下次打开会误报存档冲突）
  function markOnline() { if (ready() && !(Date.now() - (acc.lastActive || 0) < 5000)) { acc.lastActive = Date.now(); save(); } }
  setInterval(function () { if (ready() && onlineSeen) markOnline(); }, 120000);
  document.addEventListener('visibilitychange', function () {
    if (!ready()) return;
    if (document.visibilityState === 'hidden') markOnline();
    else { loginRewards(); renderMailBadge(); }   // 电脑睡眠后回来、跨过 0 点：补发离线经验和当天的登录奖励
  });
  window.addEventListener('pagehide', markOnline);
  function mailTodo() { return ready() ? mails().filter(function (m) { return !m.read || !m.got; }).length : 0; }
  function renderMailBadge() { var b = $('mail-badge'), n = mailTodo(); b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
  function deliverMail() {
    if (!ready()) return;
    var me = window.CLOUD && window.CLOUD.user ? window.CLOUD.user() : null, today = dayStr(), changed = false;
    mails();
    (typeof MAILS !== 'undefined' ? MAILS : []).forEach(function (M0) {
      if (!M0 || !M0.id || acc.mailSeen[M0.id]) return;
      if (M0.to && !((me && M0.to.indexOf(me) >= 0) || M0.to.indexOf(acc.name) >= 0)) return;   // to 里写登录账号名或做题家名字都行
      if (M0.until && today > M0.until) return;
      if (sendMail(M0)) changed = true;
    });
    // 主线章节大奖：章节推出之前就已经读完的船员，通过邮箱补发（每个章节一次）
    CHAPTERS.forEach(function (C) {
      if (!chapterDone(C) || chapterGot(C.id)) return;
      if (!acc.chapters) acc.chapters = {}; acc.chapters[C.id] = Date.now(); changed = true;
      var R = C.reward;
      sendMail({ id: 'chapter-' + C.id, title: '主线「' + C.n + '」完成奖励',
        body: '{name}，你好！\n主线剧情现在分成了若干章节，每读完一个章节，都会额外发一份章节大奖。\n你已经读完了「' + C.n + '」（' + C.d + '），请领取附件。' + (R.bgm ? '\n另外，茶室音乐「' + bgmName(R.bgm) + '」已经解锁，去陆羽茶室 · 我的房间就能换上。' : ''),
        att: { exp: R.exp || 0, energy: R.energy || 0, items: R.items } });
    });
    // 排位赛季段位奖励翻倍：之前按旧标准领过的段位，补发差额（每个账号只算一次）
    var rec = rankRec();
    if (!rec.x2) {
      rec.x2 = true; changed = true;
      var tiers = Object.keys(rec.got).map(Number).filter(function (r) { return RANK_RW[r]; }).sort(function (a, b) { return a - b; });
      if (tiers.length) {
        var e = 0, g = 0; tiers.forEach(function (r) { e += RANK_RW[r].exp - RANK_RW_OLD[r].exp; g += RANK_RW[r].energy - RANK_RW_OLD[r].energy; });
        sendMail({ id: SEASON + '-rank-x2', title: '排位赛季 ' + SEASON + ' 段位奖励翻倍补发',
          body: '{name}，你好！\n排位赛季 ' + SEASON + ' 的段位奖励已经翻倍。你之前已经达到过' + tiers.map(function (r) { return RANKS[r]; }).join('、') + '，当时按旧标准发放了奖励。\n现在按新标准补发差额，请领取附件。',
          att: { exp: e, energy: g } });
      }
    }
    // 段位奖励新增道具：之前已经领过的段位，补发道具（每个账号只算一次）
    if (!rec.items) {
      rec.items = true; changed = true;
      var add = {}, which = [];
      Object.keys(rec.got).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) { var o = RANK_ITEMS[r]; if (!o) return; which.push(RANKS[r]); for (var k in o) add[k] = (add[k] || 0) + o[k]; });
      if (which.length) sendMail({ id: SEASON + '-rank-items', title: '排位赛季 ' + SEASON + ' 段位奖励新增道具补发', body: '{name}，你好！\n排位赛季 ' + SEASON + ' 的段位奖励新增了捕捉装置和通用学习力合剂。你之前已经达到过' + which.join('、') + '，现在补发这些段位新增的道具，请领取附件。', att: { items: add } });
    }
    // 王者奖励新增 LV10 凶骨：在加这份奖励之前就领过王者奖励的，用邮箱补发
    if (!rec.kingGift) {
      rec.kingGift = true; changed = true;
      if (rec.got[10]) sendMail({ id: SEASON + '-king-gift', title: '王者段位奖励补发：凶骨', body: '{name}，你好！\n排位赛季 ' + SEASON + ' 的王者段位奖励新增了 LV10 的凶骨。你之前已经达到王者，现在补发给你，请领取附件。', att: { mons: [{ sid: 'bone', lv: 10 }] } });
    }
    // 竞技代币上线（2026-10-14）：领过排位奖励的局每局补 20 代币；今天已经按 600 经验领过的局，补经验差额
    if (!acc.tokenBack) {
      acc.tokenBack = Date.now(); changed = true;
      var RK = null; try { RK = JSON.parse(localStorage.getItem('hs-rank-v1') || 'null'); } catch (e) {}
      // 只补「当时本来就有奖励」的局：排位经验从 2026-10-12 开始发，每天前 10 局有奖。
      // 以前每天打了几局没有逐日记录，所以按「战绩里的总局数」和「10-12 起到昨天每天 10 局」取较小的一个，再加上今天已经领过奖的局
      var total = RK ? (RK.w || 0) + (RK.l || 0) : 0, tdy = rankToday();
      var past = Math.max(0, Math.round((Date.parse(bjDay().replace(/-(\d)(?=-|$)/g, '-0$1') + 'T00:00:00Z') - Date.parse('2026-10-12T00:00:00Z')) / 864e5)) * RANK_EXP_N;
      var games = tdy + Math.min(Math.max(0, total - tdy), past || 0);
      if (games) sendMail({ id: 'arena-token-back', title: '平衡排位奖励提升 · 竞技代币补发',
        body: '{name}，你好！\n从今天起，平衡排位每天前 ' + RANK_EXP_N + ' 局每局奖励 ' + fmt(RANK_EXP) + ' 累积经验（每天共 ' + fmt(RANK_EXP * RANK_EXP_N) + '），并额外掉落 ' + RANK_TOKEN + ' 竞技代币。竞技代币可以在竞技对战 · 平衡排位的「竞技代币商店」兑换道具。\n' +
          '平衡排位奖励上线以来，你有 ' + games + ' 局领过排位奖励（每天前 ' + RANK_EXP_N + ' 局），每局补发 ' + RANK_TOKEN + ' 竞技代币。' + (tdy ? '其中今天的 ' + tdy + ' 局按新标准补发经验差额。' : '') + '请领取附件。',
        att: { tokens: games * RANK_TOKEN, exp: tdy * (RANK_EXP - RANK_EXP_OLD) } });
    }
    // 每日任务奖励翻倍：今天已经按旧标准领过的任务，补发差额（之前的日子没有逐日记录，补不了）
    var DL = daily();
    if (DL) {
      var de = 0, dn = 0;
      DL.list.forEach(function (t) { if (t.x2) return; t.x2 = 1; changed = true; if (t.c && DAILY_OLD[t.id]) { de += DAILY[t.id].rw.exp - DAILY_OLD[t.id][0]; dn += DAILY[t.id].rw.energy - DAILY_OLD[t.id][1]; } });
      if (de || dn) sendMail({ id: 'daily-x2-' + DL.date, title: '每日任务奖励翻倍补发', body: '{name}，你好！\n每日任务的奖励已经翻倍，而且每天变成了 7 个任务。今天你已经按旧标准领过的任务，现在补发差额，请领取附件。', att: { exp: de, energy: dn } });
    }
    loginRewards();
    if (changed) save();
    renderMailBadge();
  }
  function claimMail(m) {
    if (!m || m.got) return [];
    var a = m.att || {}, got = attList(a);
    if (a.exp) acc.exp = (acc.exp || 0) + a.exp;
    if (a.energy) acc.energy = (acc.energy || 0) + a.energy;
    if (a.merit) giveMerit(a.merit);
    if (a.tokens) acc.tokens = (acc.tokens || 0) + a.tokens;
    if (a.items) giveItems(a.items);
    (a.mons || []).forEach(function (g) { if (!SPMAP[g.sid]) return; var nm = newMon(g.sid, g.lv), T = acc.teams[acc.active]; if (T.length < TEAM_SIZE) T.push(nm.u); });
    m.got = true; m.read = true;
    return got;
  }
  var mailOpen = null;
  function mailHTML() {
    var L = mails(), left = L.filter(function (m) { return !m.got; }).length;
    var items = L.map(function (m, i) {
      var on = mailOpen === m.id, A = attList(m.att);
      return '<li class="mb-item' + (m.read ? '' : ' unread') + (on ? ' open' : '') + '"><button type="button" class="mb-head" data-mbopen="' + i + '" aria-expanded="' + on + '">' +
        '<span class="mb-dot" aria-hidden="true"></span><span class="mb-t"><b>' + esc(m.title) + '</b><small>' + esc(m.from) + ' · ' + esc(m.date) + '</small></span>' +
        (A.length ? '<span class="chip mb-att' + (m.got ? ' got' : '') + '">' + (m.got ? '已领取' : '附件') + '</span>' : '') + '</button>' +
        (on ? '<div class="mb-body">' + esc(m.body.replace(/\{name\}/g, acc.name)).split('\n').map(function (p) { return '<p>' + p + '</p>'; }).join('') +
          (A.length ? '<div class="mb-atts"><b>附件</b>' + A.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') + '</div>' +
            (m.got ? '<p class="hint">附件已领取</p>' : '<button type="button" class="btn primary" data-mbget="' + i + '">领取附件</button>') : '') + '</div>' : '') + '</li>';
    }).join('');
    return '<span class="tape l"></span><span class="tape r"></span><span class="step">荆楚号 · 船员邮箱</span><h2>邮箱</h2>' +
      '<div class="mb-tools"><span class="hint">共 ' + L.length + ' 封' + (left ? '，' + left + ' 封有附件没领' : '') + '</span>' +
      '<button type="button" class="btn ghost" data-mbclean="1"' + (L.some(function (m) { return m.read && m.got; }) ? '' : ' disabled') + '>删除已读已领</button>' +
      '<button type="button" class="btn primary" data-mball="1"' + (left ? '' : ' disabled') + '>一键领取</button></div>' +
      (L.length ? '<ul class="mb-list">' + items + '</ul>' : '<p class="hint mb-empty">邮箱是空的。</p>') +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-mbx="1">关闭</button></div>';
  }
  function openMailbox() {
    deliverMail();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'mailbox';
    var box = document.createElement('div'); box.className = 'soc-box mailbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '邮箱');
    d.appendChild(box); document.body.appendChild(d);
    var L = mails();
    if (!mailOpen && L[0]) { mailOpen = L[0].id; if (!L[0].read) { L[0].read = true; save(); } }
    function draw() { box.innerHTML = mailHTML(); renderMailBadge(); }
    draw();
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-mbx]')) { d.remove(); return; }
      var t;
      if ((t = e.target.closest('[data-mbopen]'))) { var m = mails()[+t.dataset.mbopen]; mailOpen = mailOpen === m.id ? null : m.id; if (!m.read) { m.read = true; save(); } draw(); return; }
      if ((t = e.target.closest('[data-mbget]'))) { var got = claimMail(mails()[+t.dataset.mbget]); save(); renderRes(); renderTop(); draw(); if (got.length) toast('领取了：' + got.join('、') + '。'); return; }
      if (e.target.closest('[data-mball]')) {
        var all = []; mails().forEach(function (m) { all = all.concat(claimMail(m)); }); save(); renderRes(); renderTop(); draw();
        if (all.length) toast('一键领取了 ' + all.length + ' 项附件：' + all.join('、') + '。'); return;
      }
      if (e.target.closest('[data-mbclean]')) { acc.mail = mails().filter(function (m) { return !(m.read && m.got); }); save(); draw(); return; }
    });
  }
  $('mail-btn').addEventListener('click', openMailbox);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('mailbox')) $('mailbox').remove(); });

  /* ---------- 每日任务：每天 0:00 刷新，一共 7 个：3 个竞技对战任务，开放了精灵大乱斗的话大概率有 1 个大乱斗任务，其余从探索类里抽 ----------
   * 2026-10-12 起奖励翻倍（rw 里已经是翻倍后的数），当天已经领过的按差额补发到邮箱 */
  var DAILY_N = 7, DAILY_BRAWL = 0.7;
  var DAILY = {
    ar_play3: { t: '完成 3 场竞技对战（沙盒或平衡排位都算）', kind: 'arena', n: 3, rw: { exp: 600, energy: 200 }, arena: 1 },
    ar_rank2: { t: '完成 2 场平衡排位', kind: 'rankPlay', n: 2, rw: { exp: 800, energy: 240 }, arena: 1 },
    ar_win1: { t: '在平衡排位中获胜 1 场', kind: 'rankWin', n: 1, rw: { exp: 1000, energy: 300 }, arena: 1 },
    ar_sand1: { t: '在沙盒模式完成 1 场对战', kind: 'sandbox', n: 1, rw: { exp: 400, energy: 160 }, arena: 1 },
    bw_1: { t: '完成 1 场精灵大乱斗', kind: 'brawl', n: 1, rw: { exp: 1000, energy: 300 }, brawl: 1 },
    bw_win1: { t: '在精灵大乱斗中获胜 1 场', kind: 'brawlWin', n: 1, rw: { exp: 1200, energy: 360 }, brawl: 1 },
    wd_win5: { t: '击败 5 只野生精灵', kind: 'wildWin', n: 5, rw: { exp: 800, energy: 240 }, need: function () { return prog('flora1').done; } },
    wd_catch1: { t: '捕捉 1 只野生精灵', kind: 'catch', n: 1, rw: { exp: 600, energy: 300 }, need: function () { return prog('flora1').done; } },
    bs_1: { t: '挑战 1 次首领（胜负都算）', kind: 'boss', n: 1, rw: { exp: 600, energy: 200 }, need: function () { return bossOpen('tiger') || bossOpen('barren'); } },
    hm_1: { t: '从茶室收回 1 只展示满 1 小时的精灵', kind: 'home', n: 1, rw: { exp: 600, energy: 200 }, need: function () { return homeOpen(); } },
    pve_2: { t: '完成 2 场剧情、野外或首领对战', kind: 'pve', n: 2, rw: { exp: 600, energy: 200 } }
  };
  var DAILY_OLD = { ar_play3: [300, 100], ar_rank2: [400, 120], ar_win1: [500, 150], ar_sand1: [200, 80], wd_win5: [400, 120], wd_catch1: [300, 150], bs_1: [300, 100], hm_1: [300, 100], pve_2: [300, 100] };   // 翻倍前的奖励（补差额用）
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function seededRng(str) { var x = 7; for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 2147483647; return function () { x = (x * 48271) % 2147483647; return x / 2147483647; }; }
  function pickN(list, n, rnd) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }
  function daily() {
    if (!ready()) return null;
    var k = todayKey();
    if (!acc.daily || acc.daily.date !== k) {
      acc.daily = { date: k, list: dailyPick(k, []).map(function (id) { return { id: id, p: 0, c: 0, x2: 1 }; }) };
      save();
    }
    // 旧版（5 个任务）的今天：补到 7 个，进度保留
    if (acc.daily.list.length < DAILY_N) {
      var have = acc.daily.list.map(function (t) { return t.id; });
      dailyPick(k, have).filter(function (id) { return have.indexOf(id) < 0; }).slice(0, DAILY_N - have.length).forEach(function (id) { acc.daily.list.push({ id: id, p: 0, c: 0, x2: 1 }); });
      save();
    }
    return acc.daily;
  }
  function dailyPick(k, keep) {
    var rnd = seededRng(k + acc.name), ids = Object.keys(DAILY), pick = keep.slice();
    var add = function (list, n) { pickN(list.filter(function (id) { return pick.indexOf(id) < 0; }), n, rnd).forEach(function (id) { pick.push(id); }); };
    var ok = function (id) { return !DAILY[id].need || DAILY[id].need(); };
    var ar = ids.filter(function (id) { return DAILY[id].arena; });
    var bw = brawlOpen() ? ids.filter(function (id) { return DAILY[id].brawl; }) : [];
    var other = ids.filter(function (id) { return !DAILY[id].arena && !DAILY[id].brawl && ok(id); });
    var arN = pick.filter(function (id) { return DAILY[id] && DAILY[id].arena; }).length;
    add(ar, Math.max(0, 3 - arN));
    if (bw.length && !pick.some(function (id) { return DAILY[id] && DAILY[id].brawl; }) && rnd() < DAILY_BRAWL) add(bw, 1);
    add(other, DAILY_N - pick.length);
    add(ar, DAILY_N - pick.length);   // 探索类不够时，用剩下的竞技任务补
    add(bw, DAILY_N - pick.length);
    return pick.slice(0, DAILY_N);
  }
  function dailyHit(kind, n) {
    var D = daily(); if (!D) return; var done = [];
    D.list.forEach(function (t) { var d = DAILY[t.id]; if (d && d.kind === kind && t.p < d.n) { t.p = Math.min(d.n, t.p + (n || 1)); if (t.p >= d.n) done.push(d.t); } });
    save();
    if (done.length) setTimeout(function () { toast('每日任务完成：' + done.join('、') + '。到航行日志或任务面板领取奖励。'); }, 1200);
  }
  function dailyClaimable() { var D = daily(); return D ? D.list.filter(function (t) { return !t.c && t.p >= DAILY[t.id].n; }).length : 0; }
  function claimDaily(i) {
    var D = daily(), t = D && D.list[i]; if (!t || t.c || t.p < DAILY[t.id].n) return;
    var R = DAILY[t.id].rw; t.c = 1; acc.exp += R.exp; acc.energy += R.energy; save(); renderRes();
    toast('领取了每日任务奖励：累积经验 +' + fmt(R.exp) + '，能量 +' + fmt(R.energy) + '。');
  }
  window.HSEV = function (type, d) {
    if (!ready()) return;
    if (type === 'hidden') {   // 战斗中领悟了隐藏技能
      d.forEach(function (g) { var m = mon(g.u); if (!m) return; if (!m.hl) m.hl = []; if (m.hl.indexOf(g.mv) < 0) m.hl.push(g.mv); });
      save(); return;
    }
    if (type === 'bossfx') { if (!acc.seenFx) acc.seenFx = {}; if (!acc.seenFx[d.k]) { acc.seenFx[d.k] = Date.now(); save(); } return; }   // 隐藏的首领特效第一次发动（之后在首领页显示）
    if (type !== 'arena') return;
    dailyHit('arena');
    if (d.rank) { dailyHit('rankPlay'); if (d.result === 'win') dailyHit('rankWin'); } else dailyHit('sandbox');
    // 平衡排位：每天前 10 局各给 1000 累积经验和 20 竞技代币（认输不算）
    if (d.rank && !d.quit) {
      var n = rankToday();
      if (n < RANK_EXP_N) { acc.rankExp = { d: bjDay(), n: n + 1 }; acc.exp = (acc.exp || 0) + RANK_EXP; acc.tokens = (acc.tokens || 0) + RANK_TOKEN; save(); renderRes(); return '平衡排位奖励：累积经验 +' + fmt(RANK_EXP) + '，竞技代币 +' + RANK_TOKEN + '（今天第 ' + (n + 1) + ' / ' + RANK_EXP_N + ' 局）'; }
      return '今天的 ' + RANK_EXP_N + ' 局平衡排位奖励已经领完了';
    }
  };
  // 2026-10-14 起每局 1000 经验（每天 10 局共 10000）并掉落 20 竞技代币；RANK_EXP_OLD 用来给当天已经打过的局补差额
  var RANK_EXP = 1000, RANK_EXP_N = 10, RANK_TOKEN = 20, RANK_EXP_OLD = 600;
  function rankToday() { return acc && acc.rankExp && acc.rankExp.d === bjDay() ? acc.rankExp.n || 0 : 0; }
  function dailyHTML() {
    var D = daily(); if (!D) return '';
    return '<ul class="daily">' + D.list.map(function (t, i) {
      var d = DAILY[t.id], ok = t.p >= d.n, lock = d.arena && !arenaOpen();
      return '<li class="dl' + (t.c ? ' done' : ok ? ' ok' : '') + '">' + (d.brawl ? '<span class="chip dl-tag bw">大乱斗</span>' : d.arena ? '<span class="chip dl-tag">竞技</span>' : '<span class="chip dl-tag ex">探索</span>') +
        '<span class="dl-t"><b>' + esc(d.t) + '</b><small>奖励：累积经验 ×' + fmt(d.rw.exp) + '、能量 ×' + fmt(d.rw.energy) + (lock ? ' · 完成孝感大厅支线后才能进行竞技对战' : '') + '</small></span>' +
        '<span class="dl-p"><i style="width:' + Math.round(t.p / d.n * 100) + '%"></i><em>' + t.p + ' / ' + d.n + '</em></span>' +
        (t.c ? '<span class="dl-st">已领取</span>' : ok ? '<button type="button" class="btn primary" data-dclaim="' + i + '">领取</button>' : '<span class="dl-st">进行中</span>') + '</li>';
    }).join('') + '</ul><p class="hint">每天 0:00 刷新。每天 7 个：必定有 3 个竞技对战任务，开放精灵大乱斗后经常会有 1 个大乱斗任务，其余从探索类任务里抽取。</p>';
  }

  /* ---------- 航行日志：活动、每日任务、排位奖励、下期预告 ---------- */
  // 「近期改动」专栏：内容写在 js/data/changelog.js，最新一条展开，更早的折叠
  function changelogHTML() {
    var L = typeof CHANGELOG !== 'undefined' ? CHANGELOG : [];
    if (!L.length) return '';
    var one = function (c) { return '<div class="cl-entry"><p class="cl-h"><b>' + esc(c.title) + '</b><span>' + esc(c.date) + '</span></p><ul>' + c.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; };
    return '<article class="log-card wide changelog"><span class="tape l"></span><span class="chip log-tag">近期改动</span><h3>更新公告</h3>' +
      '<p class="hint">技能、数值和玩法的改动都会公布在这里，最新的在最上面。</p>' + L.slice(0, 1).map(one).join('') +
      (L.length > 1 ? '<details class="cl-more"><summary>更早的改动（' + (L.length - 1) + ' 条）</summary>' + L.slice(1).map(one).join('') + '</details>' : '') + '</article>';
  }
  /* 每天第一次打开游戏：弹出半屏的「更新公告」，列出上次看过之后新增的改动（没有新的就显示最新一条）。
   * 看过哪些记在存档里（newsSeen），所以换设备也不会重复算「新」；当天弹过就不再弹（newsDay）。
   * 正在对战或看剧情时先不弹，等结束后再弹。 */
  function clKey(c) { return c.date + '|' + c.title; }
  function newsCheck() {
    if (!ready() || typeof CHANGELOG === 'undefined' || !CHANGELOG.length || acc.newsDay === dayStr()) return;
    if (!$('battle').hidden || ex.fighting || (ex.mode && (ex.mode === 'intro' || ex.view === 'vn')) || $('news') || $('mailbox')) return;
    var first = !Array.isArray(acc.newsSeen), seen = first ? [] : acc.newsSeen;   // 第一次弹：只列最近 3 条，不然一下子十几条太多
    var fresh = first ? CHANGELOG.slice(0, 3) : CHANGELOG.filter(function (c) { return seen.indexOf(clKey(c)) < 0; });
    var list = fresh.length ? fresh.slice(0, 5) : CHANGELOG.slice(0, 1);
    acc.newsDay = dayStr(); acc.newsSeen = CHANGELOG.slice(0, 60).map(clKey); save();
    var d = document.createElement('div'); d.className = 'soc-dlg news-dlg'; d.id = 'news';
    d.innerHTML = '<div class="soc-box news-box" role="dialog" aria-modal="true" aria-labelledby="news-h"><span class="tape l"></span><span class="tape r"></span>' +
      '<div class="news-top"><span class="step">航行日志 · ' + dayStr() + '</span><h2 id="news-h">' + (first ? '最近的更新公告' : fresh.length ? '有 ' + fresh.length + ' 条新的更新公告' : '今天的航行日志') + '</h2></div>' +
      '<div class="news-list">' + list.map(function (c) {
        var isNew = fresh.indexOf(c) >= 0;
        return '<div class="cl-entry"><p class="cl-h"><b>' + esc(c.title) + '</b>' + (isNew ? '<span class="news-new">新</span>' : '') + '<span>' + esc(c.date) + '</span></p><ul>' + c.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + (first || fresh.length > list.length ? '<p class="hint">更早的改动都在航行日志的「更新公告」里。</p>' : '') + '</div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-nlog="1">去航行日志</button><button type="button" class="btn primary" data-nx="1">知道了</button></div></div>';
    document.body.appendChild(d);
    var close = function () { d.remove(); };
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-nx]')) { close(); return; }
      if (e.target.closest('[data-nlog]')) { close(); if ($('battle').hidden) go('log'); }
    });
    document.addEventListener('keydown', function esc0(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc0); } });
    d.querySelector('[data-nx]').focus();
  }
  setInterval(function () { if (document.visibilityState === 'visible') newsCheck(); }, 20000);
  var QQ_GROUP = '1124145809';   // 航行日志最上方显示的船员 QQ 群
  $('pg-log').addEventListener('click', function (e) {
    if (!e.target.closest('[data-copyqq]')) return;
    var done = function () { toast('群号 ' + QQ_GROUP + ' 已复制，打开 QQ 搜索加群即可。'); };
    // 网站是 http 打开的，浏览器不给用新的剪贴板接口，先用老办法复制
    var ta = document.createElement('textarea'); ta.value = QQ_GROUP; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, 99);
    var ok = false; try { ok = document.execCommand('copy'); } catch (er) {}
    ta.remove();
    if (ok) { done(); return; }
    try { navigator.clipboard.writeText(QQ_GROUP).then(done, function () { toast('QQ 群号：' + QQ_GROUP + '（没能自动复制，请长按群号手动复制）'); }); } catch (er) { toast('QQ 群号：' + QQ_GROUP + '（没能自动复制，请长按群号手动复制）'); }
  });
  // 精灵推荐：每期推荐一只精灵和它的一个技能，换一期只改 PICK
  var PICK = { no: 1, sid: 'tagore', lv: 25, move: '慈悲气波', title: '胖虎 · 抓精灵的好帮手',
    body: ['想抓的精灵总是一不小心就被打倒？试试胖虎的<b>「慈悲气波」</b>：就算这一下足以击败对方，也会给它留下 <b>1 点体力</b>。',
      '对方体力越低越好抓。先用慈悲气波把野生精灵打到只剩 1 点体力，再扔捕捉装置，稀有精灵和异色精灵都不怕失手。'],
    how: '击败古城防卫部简单难度的泰戈尔，可以领养一只小胖虎。它在 LV15 学会慈悲气波，LV25 进化成胖虎。' };
  // 航行日志 · 旅行精灵叶子喵（规则见 TRAVEL；只说在不在，不说在哪，让船员们互相通知）
  function travelLogHTML() {
    var now = Date.now(), t = travelAt(now), f = form({ sid: TRAVEL.sid, lv: TRAVEL.lv }), hm = function (ms) { var d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
    var nx = t.start > now ? t : travelAt((t.h + 1) * 3600000);
    var st = !travelOpen() ? '先去完成芙罗拉星的世界任务「旅行猫」，叶子喵才会开始在各个星球旅行。' : t.active ? (travelDone(t.h) ? '这一次的叶子喵你已经挑战过了，下一次大约在 ' + hm(travelAt((t.h + 1) * 3600000).start) + ' 出现。' : '叶子喵正在某个星球旅行！还会停留 ' + Math.max(1, Math.ceil((t.end - now) / 60000)) + ' 分钟——它在哪儿？问问其他船员吧。')
      : '叶子喵正在赶路，下一次大约在 ' + hm(nx.start) + ' 出现，停留 ' + TRAVEL.dur + ' 分钟。';
    return '<article class="log-card travel"><span class="tape r"></span><span class="chip log-tag">旅行精灵</span><h3>旅行精灵叶子喵</h3>' +
      '<div class="pick-row"><div class="pick-art travel-art"><img src="' + f.img + '" alt="' + esc(f.name) + '"></div><div class="pick-txt">' +
      '<p>叶子喵背着魔杖到处旅行，每个小时都会在某个星球的某个场景里停留<b>连续 20 分钟</b>。所有船员看到的都是同一只，发现了记得告诉大家！</p>' +
      '<p>它是 <b>LV30</b> 的强敌，不能捕捉；每次出现，每名船员只能挑战 <b>1 次</b>。击败它可以获得<b>累积经验 ×3,000</b>，还有 <b>50%</b> 的概率掉落「叶子喵的叶片」。</p>' +
      '<p><b>5 片叶片</b>在黄石 · 冶炼坊合成「叶子喵的精元」，放进神农架 · <b>精灵保育仓</b>孵化 <b>8 小时</b>，就能得到属于你的叶子喵！</p>' +
      '</div></div><p class="log-st' + (travelOpen() && t.active && !travelDone(t.h) ? ' on' : '') + '">' + st + '</p>' + (!travelOpen() ? (prog('flora2').done ? '<button type="button" class="btn primary" data-golog="travelcat">去做世界任务「旅行猫」</button>' : '<p class="hint">读完芙罗拉星主线「卡罗的不安」后，世界任务「旅行猫」就会开放。</p>') : '') + '</article>';
  }
  // 航行日志 · 稀有野怪：爱吃米饭的米饭火鸡（规则见 RICE）
  function riceLogHTML() {
    var f = form({ sid: RICE.sid, lv: RICE.lv }), b = acc && acc.riceBowl;
    var st = b ? '你已经在熔岩原放了一碗饭，去那里等等看吧。' : acc && acc.items.c_bowl > 0 ? '你手里有 ' + acc.items.c_bowl + ' 碗饭，带去庞贝星的熔岩原吧。' : '';
    return '<article class="log-card rice"><span class="tape l"></span><span class="chip log-tag">稀有野怪</span><h3>爱吃米饭的米饭火鸡</h3>' +
      '<div class="pick-row"><div class="pick-art rice-art"><img src="' + f.img + '" alt="' + esc(f.name) + '"></div><div class="pick-txt">' +
      '<p>它总是背着一筐米饭，平时很难见到。不过只要闻到米饭的香味，它就会自己找上门来！</p>' +
      '<ol class="rice-steps"><li>在<b>芙罗拉星</b>击败野生精灵，每只有 <b>10%</b> 的概率掉落<b>水稻种子</b>。</li>' +
      '<li>在恩施 · <b>太空种植园</b>种下，<b>12 小时</b>后收获一大把米饭。</li>' +
      '<li>到黄石 · <b>冶炼坊</b>，用 <b>500 粒米饭</b>盛成<b>一碗饭</b>。</li>' +
      '<li>把这碗饭放在<b>庞贝星 · 熔岩原</b>的一个场景里。之后这个场景里有 <b>2%</b> 的概率出现米饭火鸡。</li></ol>' +
      '</div></div><p class="hint">捕捉或击败米饭火鸡之后，那碗饭就被吃光了，想再见到它要重新盛一碗。太空种植园在读完恩施的支线「伟大的种植园」后开放。' + (st ? '<b> ' + st + '</b>' : '') + '</p></article>';
  }
  function pickHTML() {
    var f = form({ sid: PICK.sid, lv: PICK.lv }), M0 = M[PICK.move];
    return '<article class="log-card pick"><span class="tape r"></span><span class="chip log-tag">精灵推荐 · 第 ' + PICK.no + ' 期</span><h3>' + esc(PICK.title) + '</h3>' +
      '<div class="pick-row"><div class="pick-art"><img src="' + f.img + '" alt="' + esc(f.name) + '"></div><div class="pick-txt">' + PICK.body.map(function (t) { return '<p>' + t + '</p>'; }).join('') +
      (M0 ? '<p class="pick-mv"><b>' + esc(PICK.move) + '</b> · ' + esc(M0.type) + '系 · ' + esc(M0.cat) + ' · 威力 ' + M0.power + '</p>' : '') + '</div></div>' +
      '<p class="hint">' + PICK.how + '</p></article>';
  }
  /* 航行日志 · 立绘更新投票（服务器 server/artvote.js 计票；每人最多 5 只，截止前可以改）
   * ART_VOTE：还没有完全换上新立绘的精灵（某一阶还是旧图或占位图）。新立绘换上后从这里删掉即可 */
  var ART_VOTE = ['dragon', 'squid', 'wind', 'pluto', 'pede', 'tagore', 'faraday', 'frost', 'wild', 'hephaestus', 'inkarm', 'barren', 'mush', 'kaleo', 'siren', 'bone', 'aegis', 'phantom', 'shroom', 'turkey', 'firemouse'];
  // 已经换上新立绘的形态（其余形态待更新）
  var ART_NEW = { barren: [1], wind: [0], tagore: [1, 2], faraday: [0], mush: [0], kaleo: [0], shroom: [0], turkey: [0, 1, 2], squid: [0, 1, 2] };
  var AV_END = Date.UTC(2026, 9, 16, 16, 0, 0);   // 北京时间 10 月 16 日 24:00 截止（服务器也按这个时间）
  var AV = { data: null, picks: null, busy: false, err: '', t: 0 };
  function avOnline() { return !!(window.CLOUD && CLOUD.user && CLOUD.user()); }
  function avLoad() {
    if (!avOnline() || AV.busy) return;
    AV.busy = true;
    CLOUD.api('GET', '/api/artvote').then(function (r) {
      AV.busy = false;
      if (r._code !== 200) { AV.err = r.error || '读取失败'; avDraw(); return; }
      AV.data = r; AV.t = Date.now(); AV.err = ''; if (!AV.picks) AV.picks = r.mine.slice(); avDraw();
    }).catch(function () { AV.busy = false; AV.err = '连不上服务器'; avDraw(); });
  }
  function avDraw() { var el = $('artvote'); if (el) el.innerHTML = artVoteInner(); }
  function artVoteInner() {
    var closed = Date.now() >= AV_END || !!(AV.data && AV.data.closed);
    if (!avOnline()) return '<p class="hint">投票需要联网：用服务器网址打开游戏并登录后才能投票。</p>';
    if (AV.err) return '<p class="hint red">' + esc(AV.err) + '</p>';
    if (!AV.data) return '<p class="hint">正在读取投票……</p>';
    var T = AV.data.tally || {}, picks = AV.picks || [], mine = AV.data.mine || [], max = Math.max(1, Math.max.apply(null, ART_VOTE.map(function (k) { return T[k] || 0; })));
    var L = ART_VOTE.filter(function (k) { return SPMAP[k]; });
    var kn = function (k) { return owned(k) || !!(acc.forms && acc.forms[k] && acc.forms[k].some(Boolean)) || !!(acc.seen && acc.seen[k] !== undefined); };
    // 截止后按票数排；投票中把见过的精灵排在前面（没见过的和图鉴一样只显示剪影）
    L = L.slice().sort(closed ? function (a, b) { return (T[b] || 0) - (T[a] || 0); } : function (a, b) { return kn(b) - kn(a); });
    var changed = picks.length !== mine.length || picks.some(function (k) { return mine.indexOf(k) < 0; });
    var tiles = L.map(function (k) {
      var s = SPMAP[k], known = kn(k);
      var i = known ? (function () { var j = evoLast(s); while (j > 0 && !formKnown(k, j)) j--; return j; })() : 0;
      var nm = known ? topName(s) : '？？？', img = known ? '<img src="' + formImg(s, i) + '" alt="">' : silTag(k, 0);
      var done = ART_NEW[k] || [], todo = s.evo.map(function (e, j) { return j; }).filter(function (j) { return done.indexOf(j) < 0; });
      var on = picks.indexOf(k) >= 0, n = T[k] || 0;
      return '<button type="button" class="av-it' + (on ? ' on' : '') + '" data-avpick="' + k + '"' + (closed ? ' disabled' : '') + ' aria-pressed="' + on + '">' +
        '<span class="av-img">' + img + '</span><b>' + esc(nm) + '</b><small>待更新：' + (todo.length === s.evo.length ? '全部形态' : todo.map(function (j) { return stageLabel(s, j); }).join('、')) + '</small>' +
        '<span class="av-bar"><i style="width:' + (n / max * 100) + '%"></i></span><small class="av-n">' + n + ' 票</small>' + (on ? '<span class="av-ck">✓</span>' : '') + '</button>';
    }).join('');
    return '<p class="av-top"><span>已选 <b class="' + (picks.length ? 'red' : '') + '">' + picks.length + '</b> / ' + AV.data.max + '</span><span class="hint">已有 ' + AV.data.voters + ' 名船员投票' + (mine.length ? ' · 你已投票' : '') + '</span>' +
      (closed ? '<b class="red">投票已截止</b>' : '<button type="button" class="btn primary" data-avsend="1"' + (changed ? '' : ' disabled') + '>' + (mine.length ? '修改投票' : '提交投票') + '</button>') + '</p>' +
      '<div class="av-grid">' + tiles + '</div>';
  }
  function artVoteHTML() {
    if (avOnline() && (!AV.data || Date.now() - AV.t > 60000)) setTimeout(avLoad, 0);   // 打开航行日志时，超过 1 分钟就刷新票数
    var closed = Date.now() >= AV_END;
    return '<article class="log-card wide artvote"><span class="tape l"></span><span class="chip log-tag">立绘更新投票</span><h3>下一批想先换新立绘的精灵</h3>' +
      '<p>这些精灵还有形态没换上新立绘。选出你最想先看到新样子的精灵，<b>每人最多选 5 只</b>，截止前可以随时修改。票数最高的会优先安排！</p>' +
      '<p class="log-st' + (closed ? '' : ' on') + '">' + (closed ? '投票已于 10 月 16 日截止，感谢参与！' : '10 月 16 日 24:00 截止') + '</p>' +
      '<div id="artvote">' + artVoteInner() + '</div></article>';
  }
  // 航行日志 · 首领「荒芜」：困难难度什么时候、在什么条件下开放挑战
  var BARREN_HARD_AT = Date.UTC(2026, 9, 18, 8, 0, 0);   // 北京时间 2026-10-18 16:00
  function barrenLogHTML() {
    var hard = levelOpen('barren', 2), won = bossWon('barren', 2), timeOk = Date.now() >= BARREN_HARD_AT, storyOk = prog('flora6').done;
    var st = won ? '你已经击败了困难难度的荒芜。' : hard ? '困难难度已经开放，可以挑战了！' :
      (!timeOk ? '困难难度将在 10 月 18 日 16:00（北京时间）开放挑战。' : '困难难度已经到了开放时间。') + (storyOk ? '' : '需要先完成主线「第十段 · 瘴气之源」。');
    return '<article class="log-card next wide barren-log"><span class="tape r"></span><span class="chip log-tag">首领挑战</span><h3>草系首领「荒芜」· 困难难度</h3>' +
      '<div class="next-art"><img src="' + SPRITES.barren + '" alt=""></div>' +
      '<p>盐碱地深处的荒芜，即将展现出前所未有的力量。LV70、体力 10,000，首次击败获得称号<b>「净土守护」</b>。</p>' +
      '<p class="log-st' + (hard ? ' on' : '') + '">' + st + '</p>' +
      (bossOpen('barren') ? '<button type="button" class="btn" data-golog="boss-barren">去看看</button>' : '') + '</article>';
  }
  function renderLog() {
    var now = new Date(), h = now.getHours(), on = mysteryTime();
    var wait = on ? '' : (function () { var t = new Date(now); t.setHours(MYSTERY.from, 0, 0, 0); var m = Math.max(0, Math.round((t - now) / 60000)); return '距离今天的活动开始还有 ' + Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分钟'; })();
    $('pg-log').innerHTML = '<div class="page-head"><h2 class="sec">航行日志</h2><p class="hint">荆楚号的公告板：更新公告、限时活动、每日任务和新首领。</p></div>' +
      '<div class="log-grid">' + '<article class="log-card wide qq-card"><span class="tape l"></span><span class="tape r"></span><div class="qq-txt"><span class="chip log-tag">船员交流</span><h3>QQ 群：<b class="qq-no">' + QQ_GROUP + '</b></h3><p class="hint">攻略、组队切磋、bug 反馈、新精灵立绘抢先看，都在群里。</p></div><button type="button" class="btn primary" data-copyqq="1">复制群号</button></article>' + changelogHTML() +
      pwCardHTML('log') + barrenLogHTML() + travelLogHTML() + pickHTML() + riceLogHTML() +   // 立绘更新投票已结束移除（2026-10-17）；荒芜放在更新公告正下方
      '<article class="log-card ev"><span class="tape l"></span><span class="chip log-tag">限时活动</span><h3>神秘精灵出没</h3>' +
        '<p>每天 <b>16:00–24:00</b>，在星际探索的任何场景，都有 <b>3%</b> 的概率刷出一只神秘精灵！</p><p class="hint">它是什么？只有遇到过的人才知道。</p>' +
        '<p class="log-st ' + (on ? 'on' : '') + '">' + (on ? '活动进行中，今天 24:00 结束' : wait) + '</p></article>' +
      (function () {   // 困难泰戈尔上线：按玩家进度提示下一步（不剧透隐藏特效）
        var h = levelOpen('tiger', 2), won = bossWon('tiger', 2), tip = won ? '你已经击败了困难难度的泰戈尔，每周挑战已开放。' : h ? '在荆楚号 · 襄阳 · 古城防卫部挑战。' : bossWon('tiger', 1) ? '' : bossOpen('tiger') ? '先击败普通难度的泰戈尔，困难难度就会开放。' : '读完荆楚号 · 襄阳 · 古城防卫部的支线「东北来的泰戈尔」后，就能开始挑战泰戈尔。';
        return '<article class="log-card next tiger-hard"><span class="tape l"></span><span class="chip log-tag">首领挑战</span><h3>泰戈尔 · 困难难度已上线</h3>' +
          '<div class="next-art"><img src="' + SPRITES.tagore + '" alt=""></div><p>古城防卫部的泰戈尔终于拿出了真本事！这是它最强的状态，来看看你的队伍能不能接住它的全力一击。</p>' +
          '<p>首次击败获得称号<b>「原力掌控者」</b>、泰戈尔性格药剂 ×3、累积经验 ×50,000，并开放每周挑战。</p><p class="hint">据说……它还藏着一手。' + tip + '</p>' +
          (h ? '<button type="button" class="btn" data-golog="boss-tiger">去挑战</button>' : '') + '</article>';
      })() +
      '<article class="log-card wide"><span class="tape l"></span><span class="chip log-tag">每日任务</span><h3>今天的任务</h3>' + dailyHTML() + '</article>' +
      '</div>';
  }
  /* ---------- 竞技代币商店（2026-10-14） ----------
   * 竞技代币：平衡排位每天前 10 局每局掉 20 个。商店在竞技对战 · 平衡排位的段位卡里打开（弹窗）。
   * 卖的都是精灵道具，买到后放进储存箱，在储存箱或精灵资料里使用。 */
  var TOKEN_SHOP = [
    { k: 'ivMoon', price: 100 }, { k: 'ivBone', price: 100 }, { k: 'evAny', price: 100 },
    { k: 'fruit1', price: 30 }, { k: 'fruit2', price: 60 },
    { k: 'evReset', price: 80 },
    { k: 'ivReroll', price: 200 }
  ];
  function tokens() { return (acc && acc.tokens) || 0; }
  function tokenBarHTML() {
    if (!ready()) return '';
    return '<div class="tk-bar"><span class="tape l"></span><span class="tk-coin" aria-hidden="true">代</span><span class="tk-txt"><b>竞技代币 ' + fmt(tokens()) + '</b><small>平衡排位每天前 ' + RANK_EXP_N + ' 局每局掉落 ' + RANK_TOKEN + ' 个，可以兑换天赋药剂、学习力合剂、成长果实等</small></span>' +
      '<button type="button" class="btn primary" data-tkshop="1">竞技代币商店</button></div>';
  }
  var tkQty = {};
  function tokenShopHTML() {
    var bal = tokens();
    return '<span class="tape l"></span><span class="tape r"></span><span class="step">荆楚号 · 孝感大厅</span><h2>竞技代币商店</h2>' +
      '<div class="shop-bal tk-bal">持有竞技代币 <b>' + fmt(bal) + '</b><span class="hint">兑换的道具放进储存箱，在储存箱或精灵资料里使用</span></div>' +
      '<div class="tk-list">' + TOKEN_SHOP.map(function (T) {
        var it = USE_ITEMS[T.k], q = tkQty[T.k] || 1, cost = T.price * q, ok = bal >= cost;
        return '<article class="tk-it"><div class="si-txt"><b>' + esc(it.name) + '</b><p class="hint">' + esc(it.d) + '</p><p class="si-own">持有 <b>' + (acc.items[T.k] || 0) + '</b></p></div>' +
          '<div class="si-buy"><span class="si-price">' + T.price + ' <small>代币</small></span>' +
          '<div class="qty"><button type="button" class="btn ghost" data-tkq="' + T.k + '" data-d="-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-tkq="' + T.k + '" data-d="1" aria-label="增加"' + (q >= 20 ? ' disabled' : '') + '>+</button></div>' +
          '<button type="button" class="btn primary" data-tkbuy="' + T.k + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '兑换 · ' + cost : '代币不足') + '</button></div></article>';
      }).join('') + '</div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-tkx="1">关闭</button></div>';
  }
  function openTokenShop() {
    if (!ready() || $('tkshop')) return;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'tkshop';
    var box = document.createElement('div'); box.className = 'soc-box mailbox tkshop'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '竞技代币商店');
    d.appendChild(box); document.body.appendChild(d);
    function draw() { box.innerHTML = tokenShopHTML(); }
    function close() { d.remove(); if (window.HSBATTLE && HSBATTLE.renderMode && $('battle').hidden) HSBATTLE.renderMode(); }
    draw();
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-tkx]')) { close(); return; }
      var t;
      if ((t = e.target.closest('[data-tkq]'))) { var k0 = t.dataset.tkq; tkQty[k0] = Math.max(1, Math.min(20, (tkQty[k0] || 1) + +t.dataset.d)); draw(); return; }
      if ((t = e.target.closest('[data-tkbuy]')) && !t.disabled) {
        var k = t.dataset.tkbuy, T = TOKEN_SHOP.filter(function (x) { return x.k === k; })[0], q = tkQty[k] || 1, cost = T ? T.price * q : 0;
        if (!T || tokens() < cost) return;
        acc.tokens = tokens() - cost; var g0 = {}; g0[k] = q; giveItems(g0); tkQty[k] = 1; save(); draw();
        toast('兑换成功：' + itemName(k) + ' ×' + q + '，消耗 ' + cost + ' 竞技代币。已放进储存箱。');
      }
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-tkshop]')) openTokenShop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('tkshop')) $('tkshop').remove(); });

  // 排位赛季的段位奖励表：显示在竞技对战 · 平衡排位的段位卡下面（battle-ui.js 通过 HSACC.rankRwHTML 调用）
  function rankRwHTML() {
    if (!ready()) return '';
    var best = rankBest(), rec = rankRec(), gotN = 0, allN = 0;
    var rows = RANK_RW.map(function (R, r) {
      if (!R) return '';
      var got = rec.got[r]; allN++; if (got) gotN++;
      return '<tr class="' + (got ? 'got' : r <= best ? 'ok' : '') + (R.gift ? ' big' : '') + '"><td>' + RANKS[r] + '</td><td>累积经验 ×' + fmt(R.exp) + '，能量 ×' + fmt(R.energy) + '，称号「' + titleName(R.title) + '」' + (R.items ? '，' + itemsText(R.items) : '') + (R.gift ? '，<b class="red">' + R.gift.map(function (g) { return form(g).name + ' LV' + g.lv; }).join('、') + '</b>' : '') + '</td><td>' + (got ? '已领取' : '未达成') + '</td></tr>';
    }).join('');
    return '<details class="rk-rw" open><summary><b>排位赛季 ' + SEASON + ' · 首次达到段位的奖励</b><span class="hint">已领取 ' + gotN + ' / ' + allN + '</span></summary>' +
      '<p>本赛季最高段位：<b>' + rankFull(best, (function () { try { var r = fixRank(JSON.parse(localStorage.getItem('hs-rank-v1') || 'null')); return r && r.bestDv; } catch (e) { return 0; } })()) + '</b>。每个段位第一次达到时发放一次，并获得赛季称号（如「S1翡翠」）；<b>达到铂金送 LV10 的' + form({ sid: 'moon', lv: 10 }).name + '，达到王者送 LV10 的' + form({ sid: 'bone', lv: 10 }).name + '</b>。</p>' +
      '<table class="rank-rw"><thead><tr><th>段位</th><th>奖励</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
  }
  $('pg-log').addEventListener('click', function (e) {
    var c = e.target.closest('[data-dclaim]'); if (c) { claimDaily(+c.dataset.dclaim); renderLog(); return; }
    var ap = e.target.closest('[data-avpick]');
    if (ap && !ap.disabled && AV.data) {
      var k = ap.dataset.avpick, P = AV.picks || (AV.picks = []), i = P.indexOf(k);
      if (i >= 0) P.splice(i, 1); else if (P.length >= AV.data.max) { toast('最多只能选 ' + AV.data.max + ' 只，先取消一只吧。'); return; } else P.push(k);
      avDraw(); return;
    }
    if (e.target.closest('[data-avsend]') && AV.data && !AV.busy) {
      AV.busy = true;
      CLOUD.api('POST', '/api/artvote', { picks: AV.picks || [] }).then(function (r) {
        AV.busy = false;
        if (r._code !== 200) { toast(r.error || '投票失败'); return; }
        AV.data = r; AV.picks = r.mine.slice(); avDraw(); toast(r.mine.length ? '投票成功！截止前还可以修改。' : '已经撤回了你的投票。');
      }).catch(function () { AV.busy = false; toast('连不上服务器，稍后再试'); });
      return;
    }
    var g = e.target.closest('[data-golog]'); if (g) { if (g.dataset.golog === 'boss-barren') { ex.view = 'boss'; ex.boss = 'barren'; go('explore'); return; }
      if (g.dataset.golog === 'flora-catch') { ex.planet = 'flora'; ex.view = 'sites'; ex.fpart = 'catch'; go('explore'); renderExplore(); return; }
      if (g.dataset.golog === 'travelcat') { ex.planet = 'flora'; ex.view = 'sites'; ex.fpart = 'story'; ex.flSt = 'side'; go('explore'); renderExplore(); return; }
      if (g.dataset.golog === 'boss-tiger') { ex.view = 'boss'; ex.boss = 'tiger'; ex.bossK = 'tiger'; ex.bossD = 2; go('explore'); return; } go(g.dataset.golog); }
  });

  /* ---------- 首领：常驻在舰上部门或星球上，可反复挑战；每个首领分几档难度 ----------
   * lv：各档难度，按顺序解锁（open 返回是否开放）。boss 是首领的特殊能力，规则写在 js/engine/battle.js 的 BOSS_FX 里：
   *   noStatus 免疫异常状态 · feud 东北的纷争（物攻 +30%） · ne 来东北试试 · dr 星球聚能（减伤比例） · mia 瘴气领域 · puppet 瘴毒傀儡 · pp 首领技能的 PP
   * 战绩存在 acc.bosses[记录名]：简单难度沿用首领 id（兼容旧存档），其他难度是「id:序号」，每周挑战是「id:w」 */
  var ONLY3 = ['水', '火', '草'];
  var BOSSES = {
    tiger: { name: '泰戈尔', sid: 'tagore', dept: '襄阳', bg: 'bridge_p', pos: [66, 52],
      d: '从东北招募的特殊虎系精灵，常驻古城防卫部，辅助船员们训练。',
      lv: [
        { diff: '简单', lv: 25, hp: 500, only: ONLY3, bgm: 'boss', open: function () { return prog('tiger').done; }, lockText: '读完支线「东北来的泰戈尔」后开放', reward: { mon: { sid: 'tagore', lv: 10 } } },
        { diff: '普通', lv: 40, hp: 1500, only: ONLY3, boss: { feud: 1, ne: 1, pp: 99 }, bgm: 'boss2', open: function () { return prog('tiger2').done; }, lockText: '击败简单难度，再听泰戈尔介绍后开放', reward: { emblem: 'tagore', exp: 20000 } },
        { diff: '困难', lv: 60, hp: 5000, only: ONLY3, boss: { feud: 1, ne: 1, past: 1, pp: 99 }, bgm: 'boss3', open: function () { return bossWon('tiger', 1); }, lockText: '击败普通难度后开放', reward: { title: 'force', items: { natTagore: 3 }, exp: 50000 } }
      ] },
    barren: { name: '荒芜', sid: 'barren', planet: 'flora', region: 'salt', bg: 'fl_salt',
      d: '潜伏在芙罗拉星盐碱地地底的草系首领。盐碱地里的瘴气，就是从它身上散出来的。',
      lv: [
        { diff: '简单', lv: 40, hp: 1000, boss: { dr: 0.15, mia: 1, pp: 99 }, bgm: 'boss', open: function () { return prog('flora1').done && (chalStars('fl5') > 0 || bossWon('barren', 0)); }, lockText: '通过芙罗拉星挑战第五关「猎手的领地」后开放', reward: { mon: { sid: 'barren', lv: 10 } } },
        { diff: '普通', lv: 65, hp: 3000, boss: { dr: 0.15, mia: 1, puppet: 1, pp: 99 }, bgm: 'boss2', open: function () { return bossWon('barren', 0); }, lockText: '击败简单难度后开放', reward: { later: true } },
        // 困难：完成主线「第十段 · 瘴气之源」后，2026-10-18 16:00（北京时间）解锁
        { diff: '困难', lv: 70, hp: 10000, boss: { dr: 0.15, mia: 1, immortal: 1, puppet: 1, puppetLv: 70, humus: 1, weed: 1, weedDmg: 50, rebirth: 1, pp: 99 }, bgm: 'floraFallen',
          open: function () { return prog('flora6').done && Date.now() >= Date.UTC(2026, 9, 18, 8, 0, 0); },
          lockText: '完成主线「第十段 · 瘴气之源」后，2026-10-18 16:00 开放', reward: { title: 'guardian', exp: 50000 } }
      ] }
  };
  // 每周挑战：击败困难难度的泰戈尔后开放，规则和困难难度一样，每次消耗 1 枚挑战许可
  var WEEKLY = { boss: 'tiger', d: 2, exp: 5000, drops: [{ items: { natTagore: 1 } }, { items: { evTagore: 1 } }, { energy: 2000 }, { exp: 2000 }] };
  var PERMIT = { max: 24, every: 12 * 3600 * 1000 };   // 每 12 小时恢复 1 枚，最多 24 枚
  function recKey(k, d) { return d === 'w' ? k + ':w' : d ? k + ':' + d : k; }
  function bossRec(k, d) { if (!acc.bosses) acc.bosses = {}; var rk = recKey(k, d); if (!acc.bosses[rk]) acc.bosses[rk] = { wins: 0, tries: 0 }; return acc.bosses[rk]; }
  function bossWon(k, d) { var r = acc.bosses && acc.bosses[recKey(k, d || 0)]; return !!(r && r.wins > 0); }
  function bossOpen(k) { var B = BOSSES[k]; return !!(B && B.lv[0].open()); }
  function levelOpen(k, d) { var L = BOSSES[k] && BOSSES[k].lv[d]; return !!(L && L.open()); }
  // 默认选中：已开放的难度里第一档还没击败的；都击败了就选最高档
  function bossSel(k) {
    var B = BOSSES[k], d = ex.bossK === k ? ex.bossD : -1;
    if (d >= 0 && d < B.lv.length && levelOpen(k, d)) return d;
    for (var i = 0; i < B.lv.length; i++) if (levelOpen(k, i) && !bossWon(k, i)) return i;
    for (var j = B.lv.length - 1; j >= 0; j--) if (levelOpen(k, j)) return j;
    return 0;
  }
  function bossWhere(B) { return B.dept ? DEPTS[B.dept][0] : planetOf(B.planet).name + ' · ' + WILD_REGIONS.filter(function (R) { return R.id === B.region; })[0].name; }
  function weeklyOpen() { return !!acc && bossWon(WEEKLY.boss, WEEKLY.d); }
  // 挑战许可：第一次开放每周挑战时送 1 枚，之后每 12 小时恢复 1 枚
  function permits() {
    if (!weeklyOpen()) return 0;
    var p = acc.permit, now = Date.now();
    if (!p || !(p.n >= 0)) { p = acc.permit = { n: 1, t: now }; save(); }
    if (p.n >= PERMIT.max) p.t = now;
    else { var k = Math.floor((now - p.t) / PERMIT.every); if (k > 0) { p.n = Math.min(PERMIT.max, p.n + k); p.t = p.n >= PERMIT.max ? now : p.t + k * PERMIT.every; save(); } }
    return p.n;
  }
  function permitNext() { var n = permits(); if (n >= PERMIT.max) return '已满'; var ms = Math.max(0, acc.permit.t + PERMIT.every - Date.now()), m = Math.ceil(ms / 60000); return '下一枚 ' + Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分后恢复'; }
  function bossSpots(n) {
    return Object.keys(BOSSES).filter(function (k) { return BOSSES[k].dept === n; }).map(function (k) {
      var B = BOSSES[k], open = bossOpen(k), won = B.lv.filter(function (L, i) { return bossWon(k, i); }).length;
      var opened = B.lv.filter(function (L, i) { return levelOpen(k, i); }).length;
      return '<button type="button" class="mk shop boss' + (open ? '' : ' locked') + '"' + (open ? ' data-boss="' + k + '"' : ' disabled') + ' style="left:' + B.pos[0] + '%;top:' + B.pos[1] + '%"><span class="mk-dot">' + (open ? '首' : '锁') + '</span><span class="mk-lab"><b>首领 · ' + B.name + '</b><small>' +
        (open ? B.lv.slice(0, opened).map(function (L) { return L.diff; }).join(' / ') + (won ? ' · 已击败 ' + won + ' 档' : '') : B.lv[0].lockText) + '</small></span></button>';
    }).join('');
  }
  // SECRET_FX：第一次发动前只显示「？？？」的隐藏首领特效（触发后 acc.seenFx[键名] 会被 HSEV('bossfx',...) 记下）
  var SECRET_FX = { past: 1, rebirth: 1 };
  function fxRules(L) {
    var fake = { boss: L.boss || {}, hp: L.hp }, out = [];
    if (L.only) out.push(['【元素亲和】', '只有' + L.only.join('、') + '系技能才能命中它']);
    if (L.boss) BOSS_FX.forEach(function (f) {
      if (!L.boss[f.k]) return;
      if (SECRET_FX[f.k] && !(acc.seenFx && acc.seenFx[f.k])) { out.push(['【？？？】', '尚未揭晓。它好像还藏着什么本事……']); return; }
      out.push(['【' + f.h + '】', f.d(fake).split('\n')[0]]);
    });
    var pastKnown = !!(acc.seenFx && acc.seenFx.past);
    if (L.boss && L.boss.past && pastKnown) ['eternal', 'relive', 'sy'].forEach(function (k) { var f = BOSS_FX.filter(function (x) { return x.k === k; })[0]; out.push(['复活后 · 【' + f.h + '】', f.d(fake)]); });
    return out;
  }
  function rewardText(R) {
    var a = [];
    if (R.mon) a.push(form(R.mon).name + ' LV' + R.mon.lv);
    if (R.emblem) a.push(EMBLEMS[R.emblem].n);
    if (R.title) a.push('称号「' + titleName(R.title) + '」');
    if (R.items) for (var k in R.items) a.push(itemName(k) + ' ×' + R.items[k]);
    if (R.exp) a.push('累积经验 ×' + fmt(R.exp));
    if (R.bgm) a.push('茶室音乐「' + bgmName(R.bgm) + '」');
    if (R.later) a.push('奖励将在之后添加');
    return a.join('、');
  }
  // 星际探索 · Boss挑战：所有首领集中在这里，点进去就是各自的首领页
  function renderBossHub() {
    var cards = Object.keys(BOSSES).map(function (k) {
      var B = BOSSES[k], open = bossOpen(k);
      var lv = B.lv.map(function (L, i) { var op = levelOpen(k, i), won = bossWon(k, i); return '<span class="hb-lv' + (won ? ' won' : op ? ' op' : '') + '">' + L.diff + (won ? ' ✓' : op ? '' : ' 🔒') + '</span>'; }).join('');
      return '<article class="boss-hub-it' + (open ? '' : ' locked') + '"><span class="tape r"></span><div class="hb-art"><img src="' + BG[floraBg(B.bg)] + '" alt="" class="boss-bg"><img src="' + SPRITES[B.sid] + '" alt="" class="boss-mon"></div>' +
        '<div class="hb-txt"><h3>' + B.name + '</h3><p class="hint">' + esc(bossWhere(B)) + ' · ' + esc(B.d) + '</p><p class="hb-lvs">' + lv + '</p>' +
        (open ? '<button type="button" class="btn primary" data-boss="' + k + '" data-from="hub">挑战</button>' : '<button type="button" class="btn" disabled>' + esc(B.lv[0].lockText) + '</button>') + '</div></article>';
    }).join('');
    $('pg-explore').innerHTML = exHead('所有首领都集中在这里。难度依次开放，每档难度第一次击败都有奖励。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ex-back">‹ 返回星球</button><b>Boss挑战</b></div>' +
      (weeklyOpen() ? '<p class="hint">每周挑战在星球列表上方单独入口，挑战许可 ' + permits() + ' / ' + PERMIT.max + '。</p>' : '') +
      '<div class="boss-hub">' + cards + '</div>';
  }
  function renderBoss(weekly) {
    var k = ex.boss, B = BOSSES[k], d = weekly ? WEEKLY.d : bossSel(k), L = B.lv[d], won = bossWon(k, d);
    var rec = (acc.bosses && acc.bosses[recKey(k, weekly ? 'w' : d)]) || {}, open = weekly ? weeklyOpen() : levelOpen(k, d), pn = weekly ? permits() : 0;
    var tabs = weekly ? '' : '<div class="fparts boss-tabs" role="tablist">' + B.lv.map(function (x, i) {
      var op = levelOpen(k, i);
      return '<button type="button" role="tab" class="tab' + (i === d ? ' on' : '') + (op ? '' : ' lock') + '" aria-selected="' + (i === d) + '"' + (op ? ' data-bossd="' + i + '"' : ' disabled title="' + esc(x.lockText) + '"') + '>' + (op ? '' : '🔒 ') + x.diff + (bossWon(k, i) ? ' ✓' : '') + '</button>';
    }).join('') + '</div>';
    var rules = fxRules(L).map(function (r) { return '<li><b>特殊</b>' + esc(r[0]) + '：' + esc(r[1]) + '</li>'; }).join('');
    var rw = weekly ? '每次击败获得累积经验 ×' + fmt(WEEKLY.exp) + '，并随机掉落 ' + WEEKLY.drops.map(dropName).join(' / ') + ' 之一'
      : (won ? '已领取（首次击败：' + rewardText(L.reward) + '）；再次击败只获得经验和学习力' : '首次击败：' + rewardText(L.reward) + '；另有经验和学习力');
    var btn = weekly ? '<button type="button" class="btn primary" data-weeklygo="1"' + (pn > 0 ? '' : ' disabled') + '>开始挑战（消耗 1 枚挑战许可）</button><p class="hint permit-line">挑战许可 <b>' + pn + '</b> / ' + PERMIT.max + ' · ' + permitNext() + '</p>'
      : open ? '<button type="button" class="btn primary" data-bossgo="' + k + '" data-d="' + d + '">开始挑战</button>' : '<button type="button" class="btn" disabled>' + esc(L.lockText) + '</button>';
    $('pg-explore').innerHTML = exHead(weekly ? '每周挑战：和困难难度的泰戈尔一模一样，每次挑战消耗 1 枚挑战许可。' : '首领可以反复挑战。难度依次开放，每档难度第一次击败都有奖励。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="boss-back">‹ 返回' + (weekly ? '星际探索' : ex.bossFrom === 'hub' ? 'Boss挑战' : bossWhere(B)) + '</button><b>' + (weekly ? '每周挑战 · ' : '首领 · ') + B.name + '</b></div>' + tabs +
      '<article class="boss-card"><span class="tape l"></span><div class="boss-art"><img src="' + BG[floraBg(B.bg)] + '" alt="" class="boss-bg"><img src="' + SPRITES[B.sid] + '" alt="' + B.name + '" class="boss-mon"></div>' +
      '<div class="boss-txt"><span class="chip boss-diff d' + d + '">' + (weekly ? '每周挑战 · ' : '') + L.diff + '难度</span><h3>' + B.name + '</h3><p class="hint">' + esc(B.d) + '</p>' +
      '<ul class="boss-rules"><li><b>等级</b>LV' + L.lv + '</li><li><b>体力</b>' + fmt(L.hp) + '</li>' + rules +
      '<li><b>时限</b>' + MAX_TURNS + ' 回合内没有击败首领，算挑战失败</li>' +
      '<li><b>奖励</b>' + rw + '</li><li><b>战绩</b>' + (rec.wins || 0) + ' 胜 / ' + (rec.tries || 0) + ' 次挑战</li></ul>' +
      '<p class="hint">会使用你当前的出战配队（' + TEAM_NAME[acc.active] + '）。' + (L.only ? '记得带上会' + L.only.join('、') + '系技能的精灵。' : '') + '对战中可以使用补药。</p>' +
      btn + '</div></article>' + (weekly ? '' : '<section class="bsoc" id="bsoc"><p class="hint">读取攻略中……</p></section>');
    if (!weekly) bsocLoad(k, d);
  }
  /* ---------- 首领攻略板（每个难度一块，服务器见 server/bossboard.js）----------
   * 已通过的玩家（服务器从存档里读）、攻略留言（通过后才能发，每人一条，1~5 星评分）、赞 / 踩 / 欢乐 */
  var BS_MAX = 500;
  function bsOnline() { return !!(window.CLOUD && CLOUD.user && CLOUD.user()); }
  function bsocLoad(k, d) {
    var key = k + ':' + d; ex.bs = ex.bs && ex.bs.key === key ? ex.bs : { key: key, k: k, d: d, data: null, edit: false, stars: 0, draft: '' };
    if (!bsOnline()) { var el0 = $('bsoc'); if (el0) el0.innerHTML = '<h3 class="bs-h">通关玩家 · 攻略</h3><p class="hint">攻略板需要联网：用服务器网址打开游戏并登录后才能看到。</p>'; return; }
    CLOUD.api('GET', '/api/boss?k=' + k + '&d=' + d).then(function (r) {
      if (!ex.bs || ex.bs.key !== key) return;
      if (r._code !== 200) { var e1 = $('bsoc'); if (e1) e1.innerHTML = '<p class="hint">' + esc(r.error || '读取失败') + '</p>'; return; }
      ex.bs.data = r;
      var mine = r.posts.filter(function (p) { return p.me; })[0];
      if (mine && !ex.bs.edit) { ex.bs.stars = mine.stars; }
      bsocDraw();
    }).catch(function () { var e2 = $('bsoc'); if (e2) e2.innerHTML = '<p class="hint">连不上服务器</p>'; });
  }
  function starsTxt(n) { var h = ''; for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= n ? 'on' : '') + '">★</i>'; return '<span class="bs-stars">' + h + '</span>'; }
  function bsAgo(t) { var s0 = (Date.now() - t) / 1000; if (s0 < 60) return '刚刚'; if (s0 < 3600) return Math.floor(s0 / 60) + ' 分钟前'; if (s0 < 86400) return Math.floor(s0 / 3600) + ' 小时前'; var dd = new Date(t); return (dd.getMonth() + 1) + '月' + dd.getDate() + '日'; }
  function bsocDraw() {
    var el = $('bsoc'), S = ex.bs, r = S && S.data; if (!el || !r) return;
    var B = BOSSES[S.k], L = B.lv[S.d], mine = r.posts.filter(function (p) { return p.me; })[0];
    var clears = r.clears.length ? r.clears.slice(0, 40).map(function (c) { return '<span class="bs-clr' + (c.me ? ' me' : '') + '" title="@' + esc(c.user) + '"><span class="pav' + (c.avatar ? ' img' : '') + '">' + avatarInner(c.avatar, c.name) + '</span>' + esc(c.name) + '</span>'; }).join('') + (r.clears.length > 40 ? '<span class="hint">等 ' + r.clears.length + ' 人</span>' : '')
      : '<p class="hint">还没有人通过' + L.diff + '难度。第一个通过的会是你吗？</p>';
    var form = '';
    if (r.canPost && (!mine || S.edit)) {
      var st = S.stars || 0;
      form = '<div class="bs-form"><b>' + (mine ? '修改你的攻略' : '你已经通过了这个难度，写一份攻略吧') + '</b>' +
        '<div class="bs-pick" role="radiogroup" aria-label="评分">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="' + (n <= st ? 'on' : '') + '" data-bsstar="' + n + '" aria-label="' + n + ' 星">★</button>'; }).join('') + '<span class="hint">' + (st ? st + ' 星' : '给这个难度打个分（1~5 星）') + '</span></div>' +
        '<textarea id="bs-text" rows="4" maxlength="' + BS_MAX + '" placeholder="带了哪几只精灵、怎么打的、要注意什么……">' + esc(S.draft || (mine ? mine.text : '')) + '</textarea>' +
        '<div class="bs-row"><span class="hint" id="bs-cnt">' + Array.from(S.draft || (mine ? mine.text : '')).length + ' / ' + BS_MAX + '</span>' + (mine ? '<button type="button" class="btn ghost" data-bsx="1">取消</button>' : '') + '<button type="button" class="btn primary" data-bssend="1">' + (mine ? '保存修改' : '发表攻略') + '</button></div></div>';
    } else if (!r.canPost) form = '<p class="hint bs-lock">通过' + L.diff + '难度之后，可以在这里发攻略、给这个难度打分。</p>';
    var posts = r.posts.length ? r.posts.map(function (p) {
      var vb = function (v, ico, lab) { return '<button type="button" class="bs-v' + (p.my[v] ? ' on' : '') + '" data-bsvote="' + v + '" data-id="' + esc(p.id) + '"' + (p.me ? ' disabled title="不能给自己投票"' : ' title="' + lab + '"') + '>' + ico + ' <b>' + p[v] + '</b></button>'; };
      return '<li class="bs-post' + (p.me ? ' mine' : '') + '"><span class="pav' + (p.avatar ? ' img' : '') + '">' + avatarInner(p.avatar, p.name) + '</span><div class="bs-body">' +
        '<p class="bs-who"><b>' + esc(p.name) + '</b>' + starsTxt(p.stars) + '<span class="hint">' + bsAgo(p.edited || p.t) + (p.edited ? '（修改过）' : '') + '</span></p>' +
        '<p class="bs-text">' + esc(p.text) + '</p><p class="bs-acts">' + vb('up', '👍', '赞') + vb('down', '👎', '踩') + vb('fun', '😂', '欢乐') +
        (p.me ? '<button type="button" class="linkbtn" data-bsedit="1">修改</button><button type="button" class="linkbtn red" data-bsdel="' + esc(p.id) + '">删除</button>' : '') + '</p></div></li>';
    }).join('') : '<li class="hint bs-none">还没有攻略。</li>';
    el.innerHTML = '<span class="tape r"></span><div class="bs-top"><h3 class="bs-h">' + B.name + ' · ' + L.diff + '难度</h3>' +
      (r.posts.length ? '<span class="bs-avg">' + starsTxt(Math.round(r.avg)) + ' <b>' + r.avg.toFixed(1) + '</b> <small>' + r.posts.length + ' 份评价</small></span>' : '<span class="hint">暂无评分</span>') + '</div>' +
      '<h4>已通过的玩家 <small>' + r.clears.length + ' 人</small></h4><div class="bs-clears">' + clears + '</div>' +
      '<h4>攻略 · 留言 <small>按赞数排序</small></h4>' + form + '<ul class="bs-list">' + posts + '</ul>';
  }
  function bsocClick(e) {
    var S = ex.bs, t; if (!S) return;
    if ((t = e.target.closest('[data-bsstar]'))) { var ta = $('bs-text'); if (ta) S.draft = ta.value; S.stars = +t.dataset.bsstar; bsocDraw(); return; }
    if (e.target.closest('[data-bsedit]')) { S.edit = true; S.draft = ''; bsocDraw(); var t2 = $('bs-text'); if (t2) t2.focus(); return; }
    if (e.target.closest('[data-bsx]')) { S.edit = false; S.draft = ''; bsocLoad(S.k, S.d); return; }
    if ((t = e.target.closest('[data-bssend]'))) {
      var text = ($('bs-text') || {}).value || '';
      if (!S.stars) { toast('先点星星给这个难度打个分（1~5 星）。'); return; }
      if (!text.trim()) { toast('攻略不能是空的。'); return; }
      t.disabled = true;
      CLOUD.api('POST', '/api/boss-post', { k: S.k, d: S.d, text: text, stars: S.stars }).then(function (r) {
        if (r._code !== 200) { t.disabled = false; toast(r.error || '发表失败'); return; }
        S.edit = false; S.draft = ''; toast(r.edited ? '攻略已修改。' : '攻略已发表，其他船员可以看到了。'); bsocLoad(S.k, S.d);
      }).catch(function () { t.disabled = false; toast('连不上服务器'); });
      return;
    }
    if ((t = e.target.closest('[data-bsvote]'))) {
      if (t.disabled) return;
      CLOUD.api('POST', '/api/boss-vote', { k: S.k, d: S.d, id: t.dataset.id, v: t.dataset.bsvote }).then(function (r) {
        if (r._code !== 200) { toast(r.error || '操作失败'); return; }
        var P = S.data.posts.filter(function (p) { return p.id === t.dataset.id; })[0]; if (P) { P.up = r.up; P.down = r.down; P.fun = r.fun; P.my = r.my; }
        bsocDraw();
      }).catch(function () { toast('连不上服务器'); });
      return;
    }
    if ((t = e.target.closest('[data-bsdel]'))) {
      if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = '确认删除？'; return; }
      CLOUD.api('POST', '/api/boss-del', { k: S.k, d: S.d, id: t.dataset.bsdel }).then(function (r) {
        if (r._code !== 200) { toast(r.error || '删除失败'); return; }
        S.stars = 0; bsocLoad(S.k, S.d);
      }).catch(function () { toast('连不上服务器'); });
    }
  }
  $('pg-explore').addEventListener('input', function (e) { if (e.target.id === 'bs-text' && ex.bs) { ex.bs.draft = e.target.value; var c = $('bs-cnt'); if (c) c.textContent = Array.from(e.target.value).length + ' / ' + BS_MAX; } });
  function dropName(D) { return D.items ? Object.keys(D.items).map(function (k) { return itemName(k) + (D.items[k] > 1 ? ' ×' + D.items[k] : ''); }).join('、') : D.energy ? '能量 ×' + fmt(D.energy) : '累积经验 ×' + fmt(D.exp); }
  // 每档难度第一次击败的奖励
  function firstReward(L) {
    var R = L.reward, out = [];
    if (R.mon) {
      var m = newMon(R.mon.sid, R.mon.lv), T = acc.teams[acc.active], added = T.length < TEAM_SIZE;
      if (added) T.push(m.u);
      out.push('获得了 ' + form(m).name + '（LV' + R.mon.lv + '，' + m.nat + '）！' + (added ? '已加入' + TEAM_NAME[acc.active] + '。' : '已收入精灵仓库。'));
    }
    if (R.emblem) { if (!acc.emblems) acc.emblems = {}; acc.emblems[R.emblem] = 1; out.push('获得了「' + EMBLEMS[R.emblem].n + '」！以后你的' + SPMAP[R.emblem].name + '（包括还没进化的）都会带着它：' + EMBLEMS[R.emblem].d + '。'); }
    if (R.title && acc.titles.indexOf(R.title) < 0) { acc.titles.push(R.title); out.push('获得称号「' + titleName(R.title) + '」！点右上角的名字即可佩戴。'); }
    if (R.items) { giveItems(R.items); out.push('获得 ' + Object.keys(R.items).map(function (k) { return itemName(k) + ' ×' + R.items[k]; }).join('、') + '，可以在精灵资料或「储存箱」里使用。'); }
    if (R.exp) { acc.exp = (acc.exp || 0) + R.exp; out.push('累积经验 +' + fmt(R.exp) + '，已放进经验背包。'); }
    if (R.bgm) { acc.mailSeen['barren-bgm'] = Date.now(); out.push('获得茶室音乐「' + bgmName(R.bgm) + '」！去陆羽茶室 · 我的房间就能换上，来拜访你茶室的船员也都能听到。'); }
    if (R.later) out.push('这一档难度的首次击败奖励将在之后添加，到时会通过邮箱补发给已经击败过的船员。');
    return out;
  }
  function weeklyReward() {
    var D = WEEKLY.drops[Math.floor(Math.random() * WEEKLY.drops.length)];
    acc.exp = (acc.exp || 0) + WEEKLY.exp + (D.exp || 0); acc.energy = (acc.energy || 0) + (D.energy || 0); giveItems(D.items);
    return ['每周挑战奖励：累积经验 +' + fmt(WEEKLY.exp) + '；掉落了「' + dropName(D) + '」！'];
  }
  function startBoss(k, d, weekly) {
    var B = BOSSES[k]; if (weekly) d = WEEKLY.d;
    var L = B.lv[d]; if (!L || !(weekly ? weeklyOpen() : L.open())) return;
    if (weekly) { if (permits() < 1) { toast('挑战许可用完了。' + permitNext() + '。'); return; } acc.permit.n--; }
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon);
    var bossFx = L.boss ? JSON.parse(JSON.stringify(L.boss)) : null;
    if (bossFx && bossFx.past && acc.seenFx && acc.seenFx.past) bossFx.pastKnown = 1;   // 「东北的往事」第一次发动之前不显示
    if (bossFx && bossFx.rebirth && acc.seenFx && acc.seenFx.rebirth) bossFx.rebirthKnown = 1;   // 「枯萎中蜕生」第一次发动之前不显示
    var a = [{ id: B.sid, lv: L.lv, moves: defaultMoves(B.sid, L.lv), nick: B.name, img: SPRITES[B.sid], maxhp: L.hp, onlyHit: L.only, boss: bossFx }];
    seeMon(B.sid, L.lv);
    var rec = bossRec(k, weekly ? 'w' : d); rec.tries++; save();
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: '首领', diff: weekly ? '每周挑战' : L.diff + '难度', bgm: L.bgm, items: invCopy(), onItem: useInv, bg: BG[floraBg(B.bg)], back: weekly ? '每周挑战' : bossWhere(B),
      onEnd: function (res, seen, downs) {
        var msg = [], first = false, wasWeekly = weeklyOpen();
        dailyHit('boss'); dailyHit('pve');
        if (res === 'win') {
          first = !rec.wins; rec.wins++;
          msg.push(weekly ? '每周挑战：击败了首领「' + B.name + '」！' : '击败了' + L.diff + '难度的首领「' + B.name + '」！');
          if (weekly) msg = msg.concat(weeklyReward());
          else if (first) {
            msg = msg.concat(firstReward(L));
            if (B.lv[d + 1] && levelOpen(k, d + 1)) msg.push(B.lv[d + 1].diff + '难度已开放。');
            if (!wasWeekly && weeklyOpen()) msg.push('「每周挑战」已开放：在星际探索的星球列表上方进入，每次消耗 1 枚挑战许可（已送你 1 枚）。');
          }
        }
        msg = msg.concat(battleRewards(team, seen, downs));
        if (weeklyOpen()) permits();
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = weekly ? 'weekly' : 'boss'; ex.boss = k; ex.bossK = k; ex.bossD = first && !weekly && levelOpen(k, d + 1) ? d + 1 : d;   // 第一次打赢后自动切到下一档
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
        // 第一次打赢简单难度的泰戈尔：它有话要说（小剧情，介绍普通难度）
        if (first && !weekly && k === 'tiger' && d === 0 && page === 'explore' && unlocked('tiger2') && !prog('tiger2').done) {
          msg.push('泰戈尔好像有话要说……');
          startVN('tiger2', 'replay', $('pg-explore'), true);
        }
        if (msg.length) setTimeout(function () { toast(msg.join('')); }, 300);
      } });
  }

  /* ---------- 商城：荆门 · 物资仓储 ---------- */
  var shopQty = {};
  // 不在战斗里用的商品
  var SHOP_X = { rename: { name: '改名卡', price: 1000, d: '使用后可以修改做题家名字（最多 ' + NAME_MAX + ' 个字）。兑换后点右上角的名字，在菜单里使用。' } };
  function goods(k) { return ITEMS[k] || SHOP_X[k]; }
  function renderShop() {
    var grp = [['捕捉装置', ['cap1']], ['体力补药', ['pot1', 'pot2']], ['其他', ['rename']]];
    $('pg-explore').innerHTML = exHead('荆楚号 · 荆门物资仓储的商城。这里用能量兑换普通捕捉装置、体力补药和强能体力补药。加强捕捉装置、华为捕捉装置和 200血药在黄石 · 冶炼坊合成。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ex-area">‹ 返回物资仓储</button><b>物资仓储 · 商城</b></div>' +
      '<div class="shop-bal"><span class="tape l"></span>当前能量 <b>' + fmt(acc.energy) + '</b></div>' +
      grp.map(function (g) {
        return '<h3 class="shop-h">' + g[0] + '</h3><div class="shop-grid">' + g[1].map(function (k) {
          var it = goods(k), q = shopQty[k] || 1, cost = it.price * q, ok = acc.energy >= cost;
          return '<article class="shop-it"><span class="tape r"></span>' + H.itemIcon(k) + '<div class="si-txt"><b>' + it.name + '</b><p class="hint">' + esc(it.d) + '</p>' +
            '<p class="si-own">持有 <b>' + (acc.items[k] || 0) + '</b></p></div>' +
            '<div class="si-buy"><span class="si-price">' + fmt(it.price) + ' <small>能量</small></span>' +
            '<div class="qty"><button type="button" class="btn ghost" data-q="' + k + '|-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-q="' + k + '|1" aria-label="增加"' + (q >= 99 ? ' disabled' : '') + '>+</button></div>' +
            '<button type="button" class="btn primary" data-buy="' + k + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '兑换 · ' + fmt(cost) : '能量不足') + '</button></div></article>';
        }).join('') + '</div>';
      }).join('');
  }
  function shopClick(e) {
    var q = e.target.closest('[data-q]'); if (q) { if (!q.disabled) { var a = q.dataset.q.split('|'); shopQty[a[0]] = Math.max(1, Math.min(99, (shopQty[a[0]] || 1) + +a[1])); renderShop(); } return true; }
    var b = e.target.closest('[data-buy]'); if (!b) return false; if (b.disabled) return true;
    var k = b.dataset.buy, n = shopQty[k] || 1, cost = goods(k).price * n;
    if (acc.energy < cost) return true;
    acc.energy -= cost; acc.items[k] = (acc.items[k] || 0) + n; shopQty[k] = 1; save();
    renderRes(); renderShop(); renderRename(); toast('兑换成功：' + goods(k).name + ' ×' + n + '，消耗 ' + fmt(cost) + ' 能量。' + (k === 'rename' ? '点右上角的名字即可使用。' : ''));
    return true;
  }

  /* ---------- 精灵保育仓：神农架 · 精灵保育区 ----------
   * 3 个孵化槽，放入精元后开始计时（MATS[k].hatch.min 分钟），时间到了点「孵化」得到精灵。存档 acc.nursery = { slots: [{ k, t } | null ×3] } */
  var NURSERY_N = 3;
  function nursery() {
    if (!acc.nursery || !Array.isArray(acc.nursery.slots)) acc.nursery = { slots: [] };
    while (acc.nursery.slots.length < NURSERY_N) acc.nursery.slots.push(null);
    acc.nursery.slots = acc.nursery.slots.slice(0, NURSERY_N).map(function (x) { return x && MATS[x.k] && MATS[x.k].hatch ? x : null; });
    return acc.nursery;
  }
  function hatchLeft(x) { return Math.max(0, x.t + MATS[x.k].hatch.min * 60000 - Date.now()); }
  /* ---------- 温泉疗养（荆楚号 · 咸宁 · 温泉生活区）----------
   * 带 2 只精灵泡温泉：只要游戏开着（在线），它们就一直涨经验，离线不算。
   * 效率：每只每小时 120 + 等级 × 24 点（茶室展示是 30 + 等级 × 6，离线经验是每分钟 6 点进经验背包）。数额暂定
   * 存档 acc.spa = { u: [精灵编号或 null, ...], got: { 编号: 累计获得 } }；SPA.last 只在内存里，所以关掉游戏期间不会算经验 */
  var SPA_N = 2, SPA_TICK = 20000, SPA_GAP = 3 * 60000;
  var SPA = { last: 0, carry: {}, sess: {} };
  function spaOpen() { return !!(acc && prog('spa').done); }
  function spa() { if (!acc.spa || !Array.isArray(acc.spa.u)) acc.spa = { u: [], got: {} }; while (acc.spa.u.length < SPA_N) acc.spa.u.push(null); acc.spa.u = acc.spa.u.slice(0, SPA_N).map(function (u) { return u != null && mon(u) ? u : null; }); if (!acc.spa.got) acc.spa.got = {}; return acc.spa; }
  function spaRate(m) { return 120 + m.lv * 24; }
  function spaMons() { return spa().u.map(mon).filter(Boolean); }
  function inTea(u) { return !!(acc.home && Array.isArray(acc.home.mons) && acc.home.mons.some(function (x) { return (typeof x === 'number' ? x : x.u) === u; })); }
  function spaSummary() { var L = spaMons(); return L.length ? L.map(function (m) { return form(m).name; }).join('、') + ' 正在泡温泉' : '带 2 只精灵一起泡温泉，在线就涨经验'; }
  function spaPut(i, u) {
    var S = spa(); if (!(i >= 0 && i < SPA_N)) return;
    if (u != null) {
      var m = mon(u); if (!m) return;
      if (inTea(u)) { toast('它正在茶室里展示，先从茶室收回来吧。'); return; }
      var j = S.u.indexOf(u); if (j >= 0) S.u[j] = null;
      S.u[i] = u; toast(form(m).name + ' 泡进了温泉，舒服得眯起了眼睛。');
    } else if (S.u[i] != null) { var m2 = mon(S.u[i]); S.u[i] = null; if (m2) toast(form(m2).name + ' 从温泉里出来了，浑身冒着热气。'); }
    ex.spaPick = null; spaTick(true); save(); renderSpa();
  }
  // 每 20 秒结算一次；两次结算间隔超过 3 分钟（关掉游戏、电脑睡眠）就不算这段时间
  function spaTick(reset) {
    if (!ready() || !spaOpen()) { SPA.last = 0; return; }
    var now = Date.now(), dt = SPA.last && !reset ? now - SPA.last : 0, msgs = [], any = false;
    SPA.last = now;
    if (dt <= 0 || dt > SPA_GAP) return;
    spaMons().forEach(function (m) {
      if (m.lv >= MAX_LV) return;
      var c = (SPA.carry[m.u] || 0) + spaRate(m) * dt / 3600000, n = Math.floor(c); SPA.carry[m.u] = c - n;
      if (n <= 0) return;
      var lv0 = m.lv, r = gainExp(m, n, false); if (!r) return;
      any = true; spa().got[m.u] = (spa().got[m.u] || 0) + n; SPA.sess[m.u] = (SPA.sess[m.u] || 0) + n;
      if (m.lv > lv0) msgs.push(r);
    });
    if (!any) return;
    save();
    if (msgs.length) toast('温泉疗养：' + msgs.join(' '));
    if (page === 'explore' && ex.view === 'spa') renderSpa();
  }
  setInterval(function () { spaTick(false); }, SPA_TICK);
  function renderSpa() {
    var S = spa(), pick = ex.spaPick;
    var slot = function (i) {
      var m = mon(S.u[i]);
      if (!m) return '<div class="spa-slot empty"><button type="button" class="spa-add' + (pick === i ? ' on' : '') + '" data-spaslot="' + i + '"><b>＋</b><span>带一只精灵来泡</span></button></div>';
      var f = form(m), maxed = m.lv >= MAX_LV, need = maxed ? 0 : expAt(m.lv + 1) - m.exp, span = maxed ? 1 : expAt(m.lv + 1) - expAt(m.lv);
      return '<div class="spa-slot"><div class="spa-mon"><img src="' + f.img + '" alt="' + esc(f.name) + '"><span class="spa-water"></span></div>' +
        '<div class="spa-info"><b>' + esc(f.name) + ' <span class="lvbig">LV' + m.lv + '</span></b>' +
        (maxed ? '<small>已经满级了，泡温泉只是为了放松。</small>' : '<div class="exp-bar"><i style="width:' + Math.min(100, (span - need) / span * 100) + '%"></i></div><small>每小时 +' + fmt(spaRate(m)) + ' 经验 · 距 LV' + (m.lv + 1) + ' 还需 ' + fmt(need) + '</small>') +
        '<small>这次在线泡了 +' + fmt(SPA.sess[m.u] || 0) + ' · 累计 +' + fmt(S.got[m.u] || 0) + '</small>' +
        '<span class="spa-acts"><button type="button" class="btn ghost" data-spaslot="' + i + '">换一只</button><button type="button" class="btn ghost" data-spaout="' + i + '">起身</button></span></div></div>';
    };
    var list = '';
    if (pick != null) {
      var L = acc.mons.slice().sort(function (a, b) { return b.lv - a.lv; });
      list = '<div class="spa-pick"><h4>选一只精灵泡进 ' + (pick + 1) + ' 号位 <span class="hint">茶室里展示中的精灵要先收回</span></h4><div class="spa-list">' + L.map(function (m) {
        var f = form(m), on = S.u.indexOf(m.u) >= 0, tea = inTea(m.u);
        return '<button type="button" class="spa-it' + (on ? ' on' : '') + '" data-spain="' + m.u + '"' + (tea ? ' disabled' : '') + '><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + (tea ? ' · 茶室展示中' : on ? ' · 泡着呢' : ' · 每小时 +' + fmt(spaRate(m))) + '</small></button>';
      }).join('') + '</div></div>';
    }
    $('pg-explore').innerHTML = exHead('带 2 只精灵一起泡温泉。只要游戏开着，它们就会一直涨经验；关掉游戏就不算了。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="spa-back">‹ 返回温泉生活区</button><b>咸宁 · 温泉疗养</b></div>' +
      '<div class="spa-scene"><div class="spa-steam" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' + slot(0) + '<div class="spa-me"><img src="' + CHARS[playerArt()] + '" alt="' + esc(acc.name) + '"><span class="spa-water"></span></div>' + slot(1) + '</div>' +
      '<p class="hint spa-note">温泉经验：每只每小时 <b>120 + 等级 × 24</b> 点，直接加给精灵（不占每日战斗经验上限）。比茶室展示和离线经验都快，但必须保持在线。</p>' + list;
  }
  /* ---------- 授勋馆（荆楚号 · 黄冈 · 学院部）：展示所有称号和获得方式 ---------- */
  function medalOpen() { return !!(acc && prog('medal').done); }
  function renderMedal() {
    if (!acc.titles) acc.titles = [];
    var has = function (T) { return acc.titles.indexOf(T.id) >= 0; };
    var card = function (T, sub) {
      var own = has(T);
      var rw = titleRw(T);
      return '<div class="md-card' + (own ? ' own' : '') + '"><span class="md-ic" aria-hidden="true">' + (own ? '★' : '☆') + '</span><span class="md-tx"><b>' + T.n + '</b><small>' + T.d + (sub ? ' · ' + sub : '') + '</small><small class="md-rw">经验 ' + fmt(rw.exp) + ' · 能量 ' + fmt(rw.energy) + ' · 功勋 ' + rw.merit + '</small></span><span class="md-st">' + (own ? '已获得' : '未获得') + '</span></div>';
    };
    var grp = function (g) { return TITLES.filter(function (T) { return T.grp === g; }); };
    var sec = function (h, L, note) { var n = L.filter(has).length; return '<section class="md-sec"><h3>' + h + ' <small>' + n + ' / ' + L.length + '</small></h3>' + (note ? '<p class="hint">' + note + '</p>' : '') + '<div class="md-grid">' + L.map(function (T) { return card(T); }).join('') + '</div></section>'; };
    var all = TITLES.length, got = TITLES.filter(has).length;
    if (TITLE_TYPES.indexOf(ex.mdType) < 0) ex.mdType = TITLE_TYPES.reduce(function (b, x) { return typeKinds(x, 0) > typeKinds(b, 0) ? x : b; }, TITLE_TYPES[0]);   // 默认打开精灵种类最多的属性
    var t = ex.mdType, TT = grp('type');
    var tabs = '<div class="md-tabs" role="tablist">' + TITLE_TYPES.map(function (x) {
      var L = TT.filter(function (T) { return T.type === x; }), n = L.filter(has).length;
      return '<button type="button" role="tab" aria-selected="' + (x === t) + '" class="md-tab' + (x === t ? ' on' : '') + '" data-mdtype="' + x + '" style="--tc:' + TYPE_COLOR[x] + '">' + x + '<small>' + n + '/' + L.length + '</small></button>';
    }).join('') + '</div>';
    var rows = TYPE_TIERS.map(function (G) {
      var L = TT.filter(function (T) { return T.type === t && T.tier === G.k; }), cur = L[0].prog();
      return '<div class="md-row"><h4>' + t + '系' + G.n + ' <small>' + (G.lv ? 'LV' + G.lv + ' 以上的' : '') + t + '属性精灵：现在 ' + cur + ' 种</small></h4><div class="md-grid">' + L.map(function (T) { return card(T, has(T) || cur >= T.need ? '' : '还差 ' + (T.need - cur) + ' 种'); }).join('') + '</div></div>';
    }).join('');
    var nT = TT.filter(has).length;
    $('pg-explore').innerHTML = exHead('授勋馆里记录着荆楚号上所有的称号。已经获得的称号可以在右上角的名字菜单里佩戴。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="medal-back">‹ 返回学院部</button><b>黄冈 · 授勋馆</b><span class="hint">已获得 ' + got + ' / ' + all + '</span></div>' +
      milHTML() + sec('剧情与探索', grp('story')) + sec('等级', grp('lv')) + sec('排位赛季 S1', grp('season'), '每达到一个新段位获得一个。') +
      '<section class="md-sec"><h3>属性称号 <small>' + nT + ' / ' + TT.length + '</small></h3><p class="hint">按精灵的种类数计算：同一条进化线的精灵算 1 种，有两个属性的精灵两个属性都算。</p>' + tabs + rows + '</section>';
  }
  function milHTML() {
    var r = milRank(), top = r >= RANKS_MIL.length - 1, c = MIL_COST[r], xp = acc.meritXp || 0;
    return '<section class="mil"><div class="mil-badge"><small>军衔</small><b>' + milName() + '</b></div><div class="mil-tx">' +
      '<p>功勋点 <b>' + fmt(acc.merit || 0) + '</b> · 功勋经验 <b>' + fmt(xp) + '</b>' + (top ? '' : ' / ' + fmt(c)) + '</p>' +
      (top ? '<p class="hint">已经是最高军衔了。</p>' : '<div class="exp-bar"><i style="width:' + Math.min(100, xp / c * 100) + '%"></i></div><p class="hint">下一级：' + RANKS_MIL[r + 1] + '（晋升消耗 ' + fmt(c) + ' 功勋经验）。每获得一个称号都会得到功勋点，同时得到等额的功勋经验。</p>') +
      '<p class="mil-path">' + RANKS_MIL.map(function (n, i) { return '<span class="' + (i < r ? 'past' : i === r ? 'cur' : '') + '">' + n + '</span>'; }).join('<i>›</i>') + '</p></div>' +
      (top ? '' : '<button type="button" class="btn primary" data-promote="1"' + (xp >= c ? '' : ' disabled') + '>晋升</button>') + '</section>';
  }
  function renderNursery() {
    var N = nursery(), ess = MAT_ORDER.filter(function (k) { return MATS[k].hatch && acc.items[k] > 0; });
    var cards = N.slots.map(function (x, i) {
      if (!x) return '<article class="farm-plot"><b>孵化槽 ' + (i + 1) + '</b><p class="hint">空着</p>' + (ess.length ? '<div class="farm-acts">' + ess.map(function (k) { return '<button type="button" class="btn" data-incub="' + i + '|' + k + '">放入' + itemName(k) + '</button>'; }).join('') + '</div>' : '<p class="hint">没有可以孵化的精元。</p>') + '</article>';
      var H_ = MATS[x.k].hatch, left = hatchLeft(x), nm = form({ sid: H_.sid, lv: H_.lv }).name;
      return '<article class="farm-plot' + (left ? ' grow' : ' ready') + '"><b>孵化槽 ' + (i + 1) + ' · ' + itemName(x.k) + '</b>' +
        (left ? '<p class="hint">还要 <span data-hatchleft="' + i + '">' + farmLeftText({ t: x.t, seed: null, _ms: left }) + '</span>，会诞生一只' + esc(nm) + '。</p>' : '<p class="hint">精元在发光……可以孵化了！</p><div class="farm-acts"><button type="button" class="btn primary" data-hatch="' + i + '">孵化</button></div>') + '</article>';
    }).join('');
    $('pg-explore').innerHTML = exHead('精灵保育仓有 3 个孵化槽。把精元放进去，过一段时间就会孵化出精灵（叶子喵的精元要 8 小时）。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="nursery-back">‹ 返回精灵保育区</button><b>神农架 · 精灵保育仓</b></div>' +
      stockBar('精元', MAT_ORDER.filter(function (k) { return MATS[k].hatch; })) + '<div class="farm-plots">' + cards + '</div>';
    clearInterval(ex.farmTick);
    ex.farmTick = setInterval(function () {
      if (ex.view !== 'nursery' || !document.querySelector('.farm-plots')) { clearInterval(ex.farmTick); return; }
      var flip = false;
      nursery().slots.forEach(function (x, i) { if (!x) return; var el = document.querySelector('[data-hatchleft="' + i + '"]'), left = hatchLeft(x); if (!left && el) flip = true; else if (el) el.textContent = farmLeftText({ _ms: left }); });
      if (flip) renderNursery();
    }, 1000);
  }
  function nurseryPut(i, k) {
    var N = nursery(); if (i < 0 || i >= NURSERY_N || N.slots[i] || !MATS[k] || !MATS[k].hatch || !(acc.items[k] > 0)) return;
    acc.items[k]--; N.slots[i] = { k: k, t: Date.now() }; save();
    toast('把「' + itemName(k) + '」放进了孵化槽 ' + (i + 1) + '，' + growText(MATS[k].hatch.min) + '后可以孵化。');
    renderNursery();
  }
  function nurseryHatch(i) {
    var N = nursery(), x = N.slots[i]; if (!x || hatchLeft(x)) return;
    var H_ = MATS[x.k].hatch, m = newMon(H_.sid, H_.lv), T = acc.teams[acc.active], added = T.length < TEAM_SIZE;
    if (added) T.push(m.u);
    N.slots[i] = null; save();
    toast('精元裂开了——诞生了一只' + form(m).name + '（LV' + H_.lv + '，' + m.nat + '）！' + (added ? '已加入' + TEAM_NAME[acc.active] + '。' : '已收入精灵仓库。'));
    renderNursery(); renderRes && renderRes();
  }

  /* ---------- 冶炼坊：黄石 · 冶炼工坊 ----------
   * 加强装置吃星砂，华为装置吃星核，200血药吃药草。商城不卖这三样。 */
  var FORGE = [
    { id: 'cap2', out: { cap2: 1 }, need: { g_sand: 2 } },
    { id: 'cap3', out: { cap3: 1 }, need: { g_core: 4 } },
    { id: 'pot200', out: { pot200: 1 }, need: { c_herb: 2 } },
    { id: 'bowl', out: { c_bowl: 1 }, need: { c_rice: 500 } },
    { id: 'lcEssence', out: { e_leafcat: 1 }, need: { m_lcleaf: 5 } }
  ];
  var FORGE_Q = 120;
  function forgeOf(id) { for (var i = 0; i < FORGE.length; i++) if (FORGE[i].id === id) return FORGE[i]; return null; }
  function forgeMax(r) {
    var n = FORGE_Q;
    for (var k in r.need) n = Math.min(n, Math.floor((acc.items[k] || 0) / r.need[k]));
    return Math.max(0, n);
  }
  function forgeOutText(r, n) {
    var a = []; n = n || 1;
    for (var k in r.out) a.push(itemName(k) + ' ×' + r.out[k] * n);
    return a.join('、');
  }
  function stockBar(title, keys) {
    return '<div class="forge-stock"><span class="tape l"></span><b>' + title + '</b>' + keys.map(function (k) {
      return '<span>' + itemName(k) + ' <b>' + (acc.items[k] || 0) + '</b></span>';
    }).join('') + '</div>';
  }
  function renderForge() {
    var stock = stockBar('采集物', GATHER_ORDER) + stockBar('作物', CROP_ORDER) + stockBar('精灵素材', MAT_ORDER);
    var cards = FORGE.map(function (r) {
      var max = forgeMax(r), q = Math.max(1, Math.min(FORGE_Q, shopQty['fg-' + r.id] || 1));
      if (q > max && max > 0) q = max;
      var ok = max >= q;
      var outK = Object.keys(r.out)[0];
      var needs = Object.keys(r.need).map(function (k) {
        var have = acc.items[k] || 0, ask = r.need[k] * q;
        return itemName(k) + ' <b class="' + (have >= ask ? 'ok' : 'short') + '">' + have + '</b>/' + ask;
      }).join(' · ');
      return '<article class="shop-it"><span class="tape r"></span>' + H.itemIcon(outK) + '<div class="si-txt"><b>' + forgeOutText(r, 1) + '</b><p class="hint">' + esc((ITEMS[outK] || CROPS[outK] || MATS[outK] || {}).d || '') + '</p>' +
        '<p class="forge-need">消耗 ' + needs + '</p><p class="si-own">持有 <b>' + (acc.items[outK] || 0) + '</b></p></div>' +
        '<div class="si-buy"><span class="si-price">合成</span>' +
        '<div class="qty"><button type="button" class="btn ghost" data-fq="' + r.id + '|-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-fq="' + r.id + '|1" aria-label="增加"' + (q >= Math.min(FORGE_Q, Math.max(1, max)) ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="btn primary" data-smelt="' + r.id + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '合成' : '材料不足') + '</button></div></article>';
    }).join('');
    $('pg-explore').innerHTML = exHead('星砂合成加强捕捉装置，星核合成华为捕捉装置，药草合成 200血药，米饭盛成一碗饭，叶子喵的叶片凝成精元。这些都不在商城出售。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="forge-back">‹ 返回冶炼工坊</button><b>黄石 · 冶炼坊</b></div>' +
      stock + '<div class="shop-grid">' + cards + '</div>';
  }
  function forgeCraft(id) {
    var r = forgeOf(id); if (!r) return;
    var max = forgeMax(r), n = Math.max(1, Math.min(max, shopQty['fg-' + id] || 1));
    if (!max || n < 1) return;
    for (var k in r.need) acc.items[k] = (acc.items[k] || 0) - r.need[k] * n;
    var gain = {}; for (var ok in r.out) gain[ok] = r.out[ok] * n;
    giveItems(gain); shopQty['fg-' + id] = 1; save();
    toast('合成成功：' + forgeOutText(r, n) + '，已放入储存箱。');
    renderForge();
  }

  /* ---------- 太空种植园：恩施 · 生态舱 ----------
   * 四块田。种下 1 颗药草种子，8 小时后收获药草 ×50，种子退回。离开游戏也照常计时。 */
  var FARM_N = 4;
  function farm() {
    if (!acc.farm || !Array.isArray(acc.farm.plots)) acc.farm = { plots: [] };
    while (acc.farm.plots.length < FARM_N) acc.farm.plots.push(null);
    acc.farm.plots = acc.farm.plots.slice(0, FARM_N).map(function (p) {
      return p && SEEDS[p.seed] && p.t > 0 ? { seed: p.seed, t: p.t } : null;
    });
    return acc.farm;
  }
  function farmReady(p) { return !!(p && Date.now() - p.t >= SEEDS[p.seed].min * 60000); }
  function farmLeftText(p) {
    var sec = p._ms != null ? Math.ceil(p._ms / 1000) : Math.max(0, Math.ceil((SEEDS[p.seed].min * 60000 - (Date.now() - p.t)) / 1000));   // _ms：直接给剩余毫秒（精灵保育仓用）
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ' 小时 ' : '') + (h || m ? m + ' 分 ' : '') + s + ' 秒';
  }
  function renderFarm() {
    var F = farm(), owned = SEED_ORDER.filter(function (k) { return acc.items[k] > 0; });
    var plots = F.plots.map(function (p, i) {
      if (!p) {
        var acts = owned.map(function (k) {
          return '<button type="button" class="btn" data-sow="' + i + '|' + k + '">种下' + itemName(k) + '</button>';
        }).join('');
        return '<article class="farm-plot"><b>田 ' + (i + 1) + '</b><p class="hint">空着</p>' + (acts ? '<div class="farm-acts">' + acts + '</div>' : '<p class="hint">没有可种的种子。</p>') + '</article>';
      }
      var S = SEEDS[p.seed], ready = farmReady(p);
      return '<article class="farm-plot' + (ready ? ' ready' : ' grow') + '"><b>田 ' + (i + 1) + ' · ' + itemName(p.seed) + '</b>' +
        (ready ? '<p class="hint">成熟了，可以收获「' + itemName(S.crop) + '」×' + S.yield + '，种子会退回。</p><div class="farm-acts"><button type="button" class="btn primary" data-reap="' + i + '">收获</button></div>'
          : '<p class="hint">还要 <span data-farmleft="' + i + '">' + farmLeftText(p) + '</span>，收获「' + itemName(S.crop) + '」×' + S.yield + '。</p>') + '</article>';
    }).join('');
    $('pg-explore').innerHTML = exHead('四块田，种子收获时都会退回来。药草种子 8 小时成熟，收获药草 ×50（两份在冶炼坊合成一瓶 200血药），第一次在芙罗拉星的丛林或草甸采集会得到 4 颗；水稻种子 12 小时成熟，收获米饭 ×250（500 粒在冶炼坊盛成一碗饭），在芙罗拉星击败野生精灵时偶尔掉落。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="farm-back">‹ 返回生态舱</button><b>恩施 · 太空种植园</b></div>' +
      stockBar('种子', SEED_ORDER) + stockBar('作物', CROP_ORDER) +
      '<div class="farm-plots">' + plots + '</div>';
    clearInterval(ex.farmTick);
    ex.farmTick = setInterval(function () {
      if (ex.view !== 'farm' || !document.querySelector('.farm-plots')) { clearInterval(ex.farmTick); return; }
      var flip = false;
      farm().plots.forEach(function (p, i) {
        var el = document.querySelector('[data-farmleft="' + i + '"]');
        if (!p) return;
        if (farmReady(p)) flip = true;
        else if (el) el.textContent = farmLeftText(p);
      });
      if (flip) renderFarm();
    }, 1000);
  }
  function farmPlant(i, seed) {
    var F = farm();
    if (i < 0 || i >= FARM_N || F.plots[i] || !SEEDS[seed] || !(acc.items[seed] > 0)) return;
    acc.items[seed]--;
    F.plots[i] = { seed: seed, t: Date.now() };
    save();
    toast('在田 ' + (i + 1) + ' 种下了「' + itemName(seed) + '」，' + growText(SEEDS[seed].min) + '后可以收获。');
    renderFarm();
  }
  function farmHarvest(i) {
    var F = farm(), p = F.plots[i];
    if (!p || !farmReady(p)) return;
    var S = SEEDS[p.seed], gain = {};
    gain[S.crop] = S.yield;
    gain[p.seed] = 1;
    F.plots[i] = null;
    giveItems(gain); save();
    toast('收获了「' + itemName(S.crop) + '」×' + S.yield + '，种子已退回。');
    renderFarm();
  }

  /* ---------- 茶室（家园）：自定义名字，安排精灵在舱里休息 ---------- */
  var HOME_BASE = 3, HOME_POS = [[20, 88], [47, 84], [73, 70], [34, 66], [60, 60], [88, 92], [8, 70]], HOME_CAP_H = 24;
  // 茶室能同时展示几只：基础 3 只，茶室商店的「茶室精灵容量 +1」每买一次多 1 只（最多买 4 次）
  function homeMax() { return HOME_BASE + Math.min(4, (acc && acc.home && acc.home.cap) || 0); }
  /* 茶室音乐：自己和来拜访的船员在茶室里都会听到（曲子见 js/ui/audio.js）
   * 大厅（默认，和陆羽茶室大厅一样）和地球一开始就有；芙罗拉星是击败普通难度荒芜的奖励 */
  var HOME_BGM = [
    { k: 'ui', n: '大厅', d: '默认' },
    { k: 'earth', n: '地球', d: '自动解锁' },
    { k: 'floraGrass', n: 'Flora1', d: '芙罗拉星挑战路线累计 30 颗星后领取', own: function () { return chalGot(30); } },
    { k: 'floraForest', n: 'Flora2', d: '芙罗拉星挑战路线累计 60 颗星后领取', own: function () { return chalGot(60); } },
    { k: 'floraFallen', n: 'Flora3', d: '芙罗拉星挑战路线累计 90 颗星后领取', own: function () { return chalGot(90); } }
  ];
  function bgmName(k) { var b = HOME_BGM.filter(function (x) { return x.k === k; })[0]; return b ? b.n : k; }
  function bgmOwned(k) { var b = HOME_BGM.filter(function (x) { return x.k === k; })[0]; return !!b && (!b.own || b.own()); }
  function homeBgm() { var k = acc && acc.home && acc.home.bgm; return k && bgmOwned(k) ? k : 'ui'; }
  // 茶室音乐（2026-10-17 改成一个按钮）：点开后列出所有已解锁的曲目，点一首就换上
  function openBgmPicker() {
    var old = $('bgm-dlg'); if (old) old.remove();
    var cur = homeBgm(), own = HOME_BGM.filter(function (b) { return bgmOwned(b.k); }), lock = HOME_BGM.length - own.length;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'bgm-dlg';
    d.innerHTML = '<div class="soc-box bgm-box" role="dialog" aria-modal="true" aria-label="茶室音乐"><span class="tape l"></span><span class="tape r"></span><h2>茶室音乐</h2><p class="hint">选一首放在你的茶室里，来拜访的船员也会听到。</p>' +
      '<ul class="bgm-list">' + own.map(function (b) { var on = b.k === cur; return '<li><button type="button" class="bgm-it' + (on ? ' on' : '') + '" data-bgmset="' + b.k + '" aria-pressed="' + on + '"><span class="bgm-ic" aria-hidden="true">' + (on ? '▶' : '♪') + '</span><b>' + esc(b.n) + '</b><small>' + esc(on ? '正在播放' : b.d) + '</small></button></li>'; }).join('') + '</ul>' +
      (lock ? '<p class="hint">还有 ' + lock + ' 首曲目没有解锁。</p>' : '') +
      '<div class="soc-foot"><button type="button" class="btn primary" data-bgmx="1">关闭</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bgmset]');
      if (b && bgmOwned(b.dataset.bgmset)) { home().bgm = b.dataset.bgmset; save(); bgmScene(); d.remove(); renderExplore(); toast('茶室音乐换成了「' + bgmName(b.dataset.bgmset) + '」，来拜访的船员也会听到。'); return; }
      if (e.target === d || e.target.closest('[data-bgmx]')) d.remove();
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-bgmopen]')) openBgmPicker(); });
  function homeBgmBar() {
    var cur = homeBgm(), n = HOME_BGM.filter(function (b) { return bgmOwned(b.k); }).length;
    return '<div class="hm-bgm"><b>茶室音乐</b><button type="button" class="btn bgm-btn" data-bgmopen="1"><span aria-hidden="true">♪</span> ' + esc(bgmName(cur)) + ' <small>（已解锁 ' + n + ' 首）</small></button><span class="hint">你和来拜访的船员在茶室里都会听到。</span></div>';
  }
  /* 茶室商店（茶室大厅）
   * auto：7日自律训练装置，装在展示中的精灵身上；每满 1 天自动收回结算经验、再开始下一天，一共 7 天
   * cap：茶室精灵容量 +1，价格依次 2000 / 5000 / 10000 / 20000 能量，最多 4 次 */
  var AUTO_DAYS = 7, DAY_MS = 24 * 3600 * 1000, CAP_PRICE = [2000, 5000, 10000, 20000];
  var TEA_SHOP = { auto: { name: '7日自律训练装置', price: 1500, d: '装在茶室里展示中的一只精灵身上。它每训练满 1 天，就自动收回、结算经验，再开始下一天，一共 7 天。7 天里不用每天回来收精灵。' } };
  // 展示经验：每小时 30 + LV × 6 点，按分钟累计，最多累计 24 小时（离线也照样计时）
  function homeRate(m) { return 30 + m.lv * 6; }
  function homeMins(x) { return Math.max(0, Math.min(HOME_CAP_H * 60, Math.floor((Date.now() - x.t) / 60000))); }
  function homeExp(x) { var m = mon(x.u); return m ? Math.floor(homeMins(x) * homeRate(m) / 60) : 0; }
  function durText(min) { var h = Math.floor(min / 60), mm = min % 60; return (h ? h + ' 小时 ' : '') + mm + ' 分钟'; }
  function homeTag(x) { var m = mon(x.u), f = form(m), min = homeMins(x); return esc(f.name) + ' · LV' + m.lv + '<small>已展示 ' + durText(min) + (min >= HOME_CAP_H * 60 ? '（已满）' : '') + ' · 经验 +' + fmt(homeExp(x)) + '</small>' + (x.auto ? '<small class="hm-auto">自律训练 · 还剩 ' + x.auto.left + ' 天' + (x.auto.got ? ' · 已结算 ' + fmt(x.auto.got) : '') + '</small>' : ''); }
  // 自律训练装置：每满 1 天自动结算一次（离线也算，下次打开游戏时补上）
  function homeSettle(quiet) {
    if (!acc || !acc.home || !Array.isArray(acc.home.mons)) return;
    var out = [];
    acc.home.mons.forEach(function (x) {
      if (!x || !x.auto || !(x.auto.left > 0)) return;
      var m = mon(x.u); if (!m) return;
      var days = 0, got = 0, lvMsg = null;
      while (x.auto.left > 0 && Date.now() - x.t >= DAY_MS) {
        var amt = homeRate(m) * HOME_CAP_H, r = gainExp(m, amt);
        if (r) lvMsg = r;
        got += amt; x.t += DAY_MS; x.auto.left--; days++;
      }
      if (!days) return;
      x.auto.got = (x.auto.got || 0) + got;
      if (x.auto.left <= 0) delete x.auto;
      out.push(form(m).name + ' 自律训练了 ' + days + ' 天，获得 ' + fmt(got) + ' 经验' + (x.auto ? '（装置还剩 ' + x.auto.left + ' 天）' : '（7 天训练完成，装置用完了）') + '。');
      dailyHit('home');
    });
    if (out.length) { save(); if (!quiet) setTimeout(function () { toast('茶室：' + out.join('')); }, 2500); }   // 晚一点弹，免得被每日任务的提示盖掉
  }
  /* 家园里的精灵走来走去（自己的茶室、拜访别人的茶室、朋友的房间都用 .home-room .hm-fig）：
   * 和野外一样，每只围着自己的位置慢慢绕小圈，往左走时转身；离得近的排在前面 */
  setInterval(function () {
    var figs = document.querySelectorAll('.home-room .hm-fig'); if (!figs.length) return;
    var now = performance.now() / 1000;
    Array.prototype.forEach.call(figs, function (f) {
      var D = f.dataset;
      if (!D.hx) { D.hx = parseFloat(f.style.left) || 50; D.hy = parseFloat(f.style.top) || 80; D.ph = Math.random() * 6.283; D.sp = 0.22 + Math.random() * 0.22; D.px = D.hx; }
      var t = now * +D.sp + +D.ph, x = Math.max(8, Math.min(92, +D.hx + Math.cos(t) * 9)), y = Math.max(45, Math.min(96, +D.hy + Math.sin(t * 0.85) * 4));
      f.style.left = x.toFixed(2) + '%'; f.style.top = y.toFixed(2) + '%'; f.style.zIndex = Math.round(y);
      if (x > +D.px + 0.005) f.classList.remove('flip'); else if (x < +D.px - 0.005) f.classList.add('flip');
      D.px = x;
    });
  }, 50);
  function renderHome() {
    homeSettle(); var H = home();
    clearInterval(ex.homeTick);
    ex.homeTick = setInterval(function () {
      if (ex.view !== 'home' || !document.querySelector('.home-room')) { clearInterval(ex.homeTick); return; }
      H.mons.forEach(function (x, i) { var t = document.querySelector('[data-htag="' + i + '"]'); if (t) t.innerHTML = homeTag(x); });
    }, 20000);
    var figs = H.mons.map(function (x, i) {
      var m = mon(x.u), f = form(m), p = HOME_POS[i];
      return '<div class="hm-fig' + (H.mons.length > 3 ? ' many' : '') + '" style="left:' + p[0] + '%;top:' + p[1] + '%"><button type="button" class="hm-poke" data-hpoke="1" aria-label="摸摸' + esc(f.name) + '"><img src="' + f.img + '" alt=""></button><span class="hm-tag" data-htag="' + i + '">' + homeTag(x) + '</span></div>';
    }).join('');
    var nAuto = acc.items.auto || 0;
    var autoBar = '<div class="hm-autobar"><b>7日自律训练装置</b><span class="hint">持有 ' + nAuto + ' 个' + (nAuto ? '，点下面展示中的精灵卡片上的「装上装置」' : '，可以在茶室大厅的茶室商店兑换') + '。装上后每满 1 天自动结算经验并重新开始，一共 7 天；中途收回精灵，剩下的天数作废。</span></div>';
    var title = ex.homeEdit
      ? '<form class="home-edit" onsubmit="return false"><input id="home-name" maxlength="10" value="' + esc(H.name) + '" aria-label="茶室名字"><button type="button" class="btn primary" id="home-ok">保存</button><button type="button" class="btn ghost" id="home-cancel">取消</button><span class="hint">最多 10 个字</span></form>'
      : '<b class="home-name">' + esc(H.name) + '</b><button type="button" class="btn ghost" id="home-rn">改名</button>';
    var ins = H.mons.map(function (x) { return x.u; });
    var cards = acc.mons.map(function (m) {
      var on = ins.indexOf(m.u) >= 0, f = form(m), full = !on && H.mons.length >= homeMax(), x = on ? H.mons[ins.indexOf(m.u)] : null;
      var armed = on && ex.hmArm === m.u;
      return '<div class="hm-cell"><button type="button" class="card hm-card' + (on ? ' on' : '') + (armed ? ' armed' : '') + '" data-hm="' + m.u + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + on + '"><img src="' + f.img + '" alt=""><span class="nm">' + esc(f.name) + '</span><span class="meta">LV' + m.lv + (armed ? ' · 再点一次收回（装置剩余天数作废）' : on ? (x.auto ? ' · 自律训练中 · 点击收回' : ' · 展示中，点击收回') : ' · 每小时 ' + homeRate(m) + ' 经验') + '</span></button>' +
        (on && !x.auto && nAuto ? '<button type="button" class="btn hm-autobtn" data-hauto="' + m.u + '">装上装置</button>' : '') + '</div>';
    }).join('');
    $('pg-explore').innerHTML = exHead('你在荆楚号上的休息舱。放精灵出来展示，收回时会按等级和展示时长获得经验，离开游戏也会照常计时。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="home-back">‹ 返回大厅</button>' + title + '</div>' +
      '<div class="home-room"><img class="home-bg" src="' + BG.tea_p + '" alt="' + esc(H.name) + '">' + figs +
      (H.mons.length ? '' : '<p class="home-empty">茶室里空荡荡的。从下面选几只精灵，放出来展示吧。</p>') + '</div>' +
      (window.HSSOCIAL && HSSOCIAL.homeBoard ? HSSOCIAL.homeBoard() : '') +   // 茶室信息栏与留言板（联网时才有，见 social.js）
      homeBgmBar() + autoBar + '<div class="home-pick"><h4>展示的精灵 <span class="hint">' + H.mons.length + ' / ' + homeMax() + ' · 每小时经验 = 30 + 等级 × 6，最多累计 ' + HOME_CAP_H + ' 小时 · 点击卡片放出或收回，点茶室里的精灵可以摸摸它</span></h4><div class="hm-grid">' + cards + '</div></div>';
  }
  function renderTeaShop() {
    var nCap = Math.min(4, (acc.home && acc.home.cap) || 0), capPrice = CAP_PRICE[nCap], A0 = TEA_SHOP.auto, q = shopQty.tsauto || 1, cost = A0.price * q, ok = acc.energy >= cost;
    $('pg-explore').innerHTML = exHead('陆羽茶室大厅里的小商店，卖茶室专用的东西。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ts-back">‹ 返回茶室大厅</button><b>陆羽茶室 · 茶室商店</b></div>' +
      '<div class="shop-bal"><span class="tape l"></span>当前能量 <b>' + fmt(acc.energy) + '</b></div>' +
      '<div class="shop-grid">' +
      '<article class="shop-it"><span class="tape r"></span><span class="it-ic ts-ic" aria-hidden="true">⏱</span><div class="si-txt"><b>' + A0.name + '</b><p class="hint">' + esc(A0.d) + '</p>' +
        '<p class="si-own">持有 <b>' + (acc.items.auto || 0) + '</b></p></div>' +
        '<div class="si-buy"><span class="si-price">' + fmt(A0.price) + ' <small>能量</small></span>' +
        '<div class="qty"><button type="button" class="btn ghost" data-tsq="-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-tsq="1" aria-label="增加"' + (q >= 20 ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="btn primary" data-tsbuy="auto"' + (ok ? '' : ' disabled') + '>' + (ok ? '兑换 · ' + fmt(cost) : '能量不足') + '</button></div></article>' +
      '<article class="shop-it"><span class="tape r"></span><span class="it-ic ts-ic" aria-hidden="true">＋</span><div class="si-txt"><b>茶室精灵容量 +1</b><p class="hint">茶室里能同时展示的精灵多 1 只。基础 ' + HOME_BASE + ' 只，最多买 4 次，价格依次 ' + CAP_PRICE.map(fmt).join(' / ') + ' 能量。</p>' +
        '<p class="si-own">现在能展示 <b>' + homeMax() + '</b> 只 · 已购买 <b>' + nCap + '</b> / 4</p></div>' +
        '<div class="si-buy">' + (capPrice ? '<span class="si-price">' + fmt(capPrice) + ' <small>能量</small></span><button type="button" class="btn primary" data-tsbuy="cap"' + (acc.energy >= capPrice ? '' : ' disabled') + '>' + (acc.energy >= capPrice ? '扩容' : '能量不足') + '</button>' : '<span class="hint">已经扩到最大（' + homeMax() + ' 只）了</span>') + '</div></article>' +
      '</div>';
  }
  function teaShopBuy(k) {
    if (k === 'auto') {
      var q = shopQty.tsauto || 1, cost = TEA_SHOP.auto.price * q;
      if (acc.energy < cost) return;
      acc.energy -= cost; acc.items.auto = (acc.items.auto || 0) + q; shopQty.tsauto = 1; save(); renderRes(); renderTeaShop();
      toast('兑换成功：7日自律训练装置 ×' + q + '，消耗 ' + fmt(cost) + ' 能量。去「我的房间」给展示中的精灵装上。'); return;
    }
    if (k === 'cap') {
      var H = home(), n = Math.min(4, H.cap || 0), price = CAP_PRICE[n];
      if (!price || acc.energy < price) return;
      acc.energy -= price; H.cap = n + 1; save(); renderRes(); renderTeaShop();
      toast('茶室扩容成功！现在可以同时展示 ' + homeMax() + ' 只精灵。');
    }
  }
  // 大厅：从这里进入自己和朋友们的房间
  var ROOMS = [
    { k: 'me', pos: [16, 60] },
    { k: 't', n: 'Threego 的房间', pos: [33, 34] },
    { k: 'h', n: 'Dr.黄 的房间', pos: [67, 34] },
    { k: 'b', n: 'Bttp 的房间', pos: [84, 60] }
  ];
  function hallSpots() {
    var open = homeOpen();
    return '<button type="button" class="mk shop' + (open ? '' : ' locked') + '"' + (open ? ' data-teashop="1"' : ' disabled') + ' style="left:50%;top:72%"><span class="mk-dot">' + (open ? '商' : '锁') + '</span><span class="mk-lab"><b>茶室商店</b><small>' + (open ? '自律训练装置 · 茶室扩容' : '读完「陆羽茶室」支线后开放') + '</small></span></button>' + ROOMS.map(function (R) {
      var me = R.k === 'me', label = me ? (open ? '我的房间 · ' + esc(home().name) : '我的房间') : R.n, inside = !me && open && npcHome(R.k);
      return '<button type="button" class="mk shop home' + (me ? '' : ' fr') + (inside ? ' npc-in' : '') + (open ? '' : ' locked') + '"' + (open ? (me ? ' data-home="1"' : ' data-room="' + R.k + '"') : ' disabled') + ' style="left:' + R.pos[0] + '%;top:' + R.pos[1] + '%"><span class="mk-dot">' + (open ? (me ? '家' : '门') : '锁') + '</span><span class="mk-lab"><b>' + label + '</b><small>' + (open ? (me ? '你的休息舱（家园）' : inside ? '● 主人在家 · 点击拜访' : '点击拜访') : '读完「陆羽茶室」支线后开放') + '</small></span></button>';
    }).join('');
  }
  // Threego 房间里固定展示：LV8 小胖虎 + LV7 的「被玩家主宠克制的那只初始精灵」
  function weakStarter() {
    var my = acc.starter && SPMAP[acc.starter].types[0];
    return STARTERS.filter(function (sid) { return sid !== acc.starter && my && eff(my, SPMAP[sid].types[0]) > 1; })[0] || STARTERS.filter(function (sid) { return sid !== acc.starter; })[0];
  }
  /* ---------- 朋友回家：Threego / Dr.黄 / Bttp 每天在随机时段回房间，对话后可以对战 ----------
   * 时段和携带的精灵都用「北京时间的日期」做种子算出来，所有玩家同一天看到的一样（全服共通）。
   * 精灵等级 = 玩家出战配队平均等级 −5 / 0 / +5（三个等级随机分给三只）。电脑操作为白银段位水平。
   * 胜利奖励 3000 累积经验，每个人每天最多领一次。 */
  var NPC_WIN_EXP = 3000, NPC_HOURS = 3, NPC_FROM = 9, NPC_TO = 24, NPC_AI_RANK = 2;
  var NPC = {
    t: { name: 'Threego', pron: '她', img: 'threego', fixed: [{ slot: 0, sid: 'leafcat' }], away: '她每天会在某个时间回房间待一阵子。',
      lines: [['', '哟，{name}！我的叶子喵最近可厉害了，要不要来试试？'], ['laugh', '嘿嘿，今天我状态超好，输了可别哭鼻子哦！'], ['smile', '点点的消息还没查到……先陪我打一场散散心吧。']] },
    h: { name: 'Dr.黄', pron: '他', img: 'drh', fixed: [{ slot: -1, sid: 'aegis' }], away: '他每天会在某个时间回房间待一阵子。',
      lines: [['', '哦？你来得正好。至高之盾的防御，你破得了吗？'], ['grin', '我在孝感大厅打了很久很久……今天换你陪我练练。'], ['oh', '哦！是{name}啊。来都来了，切磋一下？']] },
    b: { name: 'Bttp', pron: '他', img: 'bttp', fixed: [{ slot: 2, sid: 'bone' }], away: '他每天会在某个时间回房间待一阵子。',
      lines: [['god', '神已经算到你会来了。'], ['', '我的精灵排序是有讲究的，尤其是第三只。'], ['smile', '要不要验证一下你最近的进步？来吧。']] }
  };
  // 随机池：竞技对战的 24 只，去掉剧情里还没揭晓的首领「荒芜」和神秘精灵「哈尔达蒙」（避免提前在黄冈秘鉴里解锁名字）
  var NPC_SECRET = ['barren', 'hauris'];
  var NPC_POOL = SP.map(function (x) { return x.id; }).filter(function (id) { return SPMAP[id] && SPRITES[id] && NPC_SECRET.indexOf(id) < 0; });
  function bjNow() { return new Date(Date.now() + 8 * 3600e3); }
  function bjDay() { var d = bjNow(); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = (h + 0x6D2B79F5) | 0; var t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function npcPlan(k, day) {
    var r = seeded('npc|' + (day || bjDay()) + '|' + k), N = NPC[k];
    var start = NPC_FROM + Math.floor(r() * (NPC_TO - NPC_FROM - NPC_HOURS + 1));
    var slots = [null, null, null];
    N.fixed.forEach(function (f) { slots[f.slot >= 0 ? f.slot : Math.floor(r() * 3)] = f.sid; });
    var pool = NPC_POOL.filter(function (id) { return !N.fixed.some(function (f) { return f.sid === id; }); });
    slots = slots.map(function (x) {
      if (x) return x;
      var id; do { id = pool[Math.floor(r() * pool.length)]; } while (slots.indexOf(id) >= 0);
      return id;
    });
    // 防止随机到同一只：上面的 do/while 只防了已经定下的位置，这里再去重一次
    slots.forEach(function (x, i) { if (slots.indexOf(x) !== i) { var alt = pool.filter(function (id) { return slots.indexOf(id) < 0; }); slots[i] = alt[Math.floor(r() * alt.length)]; } });
    var rel = [-5, 0, 5];
    for (var i = 2; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = rel[i]; rel[i] = rel[j]; rel[j] = t; }
    return { start: start, end: start + NPC_HOURS, team: slots.map(function (sid, i) { return { sid: sid, rel: rel[i], nat: NAT_KEYS[Math.floor(r() * NAT_KEYS.length)] }; }) };
  }
  function npcHome(k) { if (!NPC[k]) return false; var P = npcPlan(k), d = bjNow(), h = d.getUTCHours() + d.getUTCMinutes() / 60; return h >= P.start && h < P.end; }
  function npcWon(k) { return !!(acc.npcWin && acc.npcWin.d === bjDay() && acc.npcWin[k]); }
  function teamAvgLv() {
    var t = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!t.length) t = acc.mons;
    return t.length ? Math.round(t.reduce(function (a, m) { return a + m.lv; }, 0) / t.length) : START_LV;
  }
  function npcTeam(k) {
    var avg = teamAvgLv();
    return npcPlan(k).team.map(function (x) { var lv = Math.max(1, Math.min(100, avg + x.rel)); var o = storyMon({ sid: x.sid, lv: lv, moves: [], nat: x.nat }); delete o.u; delete o.hl; return o; });
  }
  function npcArt(k, face) { var N = NPC[k]; return CHARS[(face ? N.img + '_' + face : N.img)] || CHARS[N.img]; }
  function npcTalk(k) {
    if (!npcHome(k)) { toast(NPC[k].name + ' 刚刚出门了。'); renderRoom(); return; }
    var N = NPC[k], L = N.lines[Math.floor(Math.random() * N.lines.length)], won = npcWon(k);
    var d = document.createElement('div'); d.className = 'soc-dlg npc-dlg';
    d.innerHTML = '<div class="soc-box npc-box" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span>' +
      '<img class="npc-face" src="' + npcArt(k, L[0]) + '" alt="' + esc(N.name) + '"><div class="npc-say"><span class="step">' + esc(N.name) + '</span><p class="npc-line">' + esc(fill(L[1])) + '</p>' +
      '<p class="hint">' + esc(N.name) + ' 会带 3 只精灵，实力与你相当。' + (won ? '今天已经领过 ' + esc(N.name) + ' 的胜利奖励了，还可以继续切磋。' : '获胜可得 ' + fmt(NPC_WIN_EXP) + ' 累积经验（每天一次）。') + '</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-npcx="1">下次再说</button><button type="button" class="btn primary" data-npcgo="1">开始对战</button></div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-npcx]')) { d.remove(); return; }
      if (e.target.closest('[data-npcgo]')) { d.remove(); npcFight(k); }
    });
  }
  function npcFight(k) {
    if (!npcHome(k)) { toast(NPC[k].name + ' 刚刚出门了。'); renderRoom(); return; }
    var N = NPC[k], team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var a = npcTeam(k);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: team.map(storyMon), a: a, foe: N.name, bg: BG.tea_p, back: N.name + ' 的房间', ai: rankAI(NPC_AI_RANK),
      onEnd: function (res, seen, downs) {
        var msg = '';
        (downs || []).forEach(function (x) { seeMon(x.id, x.lv); });
        if (res === 'win') {
          if (!npcWon(k)) {
            if (!acc.npcWin || acc.npcWin.d !== bjDay()) acc.npcWin = { d: bjDay() };
            acc.npcWin[k] = 1; acc.exp = (acc.exp || 0) + NPC_WIN_EXP;
            msg = '击败了 ' + N.name + '！累积经验 +' + fmt(NPC_WIN_EXP) + '，已放进经验背包。';
          } else msg = '又赢了 ' + N.name + '！今天的胜利奖励已经领过了，明天再来。';
        } else if (res === 'lose') msg = N.name + '：嘿嘿，下次再来挑战吧！';
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'room'; ex.room = k; ex.area = '天门';
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
        if (msg) setTimeout(function () { toast(msg); }, 300);
      } });
  }
  // 房间里固定展示的精灵：Threego 是小胖虎和被玩家主宠克制的初始精灵，Dr.黄 是董之马（至高之盾的一阶）
  function roomShow(k) { return k === 't' ? [{ sid: 'tagore', lv: 8 }, { sid: weakStarter(), lv: 7 }] : k === 'h' ? [{ sid: 'aegis', lv: 10 }] : []; }
  function renderRoom() {
    var R = ROOMS.filter(function (x) { return x.k === ex.room; })[0], list = roomShow(R.k);
    var figs = list.map(function (x, i) {
      var f = form(x), p = HOME_POS[i];
      return '<div class="hm-fig" style="left:' + p[0] + '%;top:' + p[1] + '%"><button type="button" class="hm-poke" data-hpoke="1" aria-label="摸摸' + esc(f.name) + '"><img src="' + f.img + '" alt=""></button><span class="hm-tag">' + esc(f.name) + ' · LV' + x.lv + '</span></div>';
    }).join('');
    var N = NPC[R.k], inside = N && npcHome(R.k), won = N && npcWon(R.k);
    $('pg-explore').innerHTML = exHead('朋友们的房间暂时都长得一样。他们每天会在某个时间回来待一阵子，在家时可以找他们对战。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="home-back">‹ 返回大厅</button><b class="home-name">' + R.n + '</b></div>' +
      '<div class="home-room"><img class="home-bg" src="' + BG.tea_p + '" alt="' + R.n + '">' + figs +
      (inside ? '<button type="button" class="npc-stand" data-npctalk="' + R.k + '" aria-label="和 ' + esc(N.name) + ' 对话"><img src="' + npcArt(R.k) + '" alt=""><span class="npc-bubble">！</span></button>' : '') +
      (list.length || inside ? '' : '<p class="home-empty">房间的主人不在，这里还没有展示精灵。</p>') + '</div>' +
      (N ? '<div class="tea-bar npc-bar"><span class="tape l"></span><div class="tea-txt"><b>' + (inside ? esc(N.name) + ' 在家' : esc(N.name) + ' 不在房间里') + '</b>' +
        '<p class="hint">' + (inside ? '点房间里的 ' + esc(N.name) + ' 或右边的按钮和 TA 说话，会进入对战。胜利奖励 ' + fmt(NPC_WIN_EXP) + ' 累积经验，每天一次。快去通知其他船员来拜访' + N.pron + '吧！' : esc(N.away) + N.pron + '会在什么时候回来呢？不妨问问其他船员吧。') + '</p>' +
        '<p class="tea-left">今天的胜利奖励：<b>' + (won ? '已领取' : '未领取') + '</b></p></div>' +
        '<button type="button" class="btn primary" data-npctalk="' + R.k + '"' + (inside ? '' : ' disabled') + '>' + (inside ? '对话' : '不在家') + '</button></div>' : '') +
      (list.length ? '<p class="hint" style="margin-top:8px">' + (N ? esc(N.name) : '主人') + ' 在房间里展示着' + (R.k === 't' ? '她' : '他') + '的伙伴。点它们可以摸摸。</p>' : '');
  }
  function saveHomeName() {
    var ip = $('home-name'); if (!ip) return;
    var v = Array.from(ip.value.trim()).slice(0, 10).join('');
    if (!v) { toast('名字不能为空。'); return; }
    home().name = v; save(); ex.homeEdit = false; renderHome(); toast('茶室改名为「' + v + '」。');
  }
  function toggleHomeMon(u) {
    var H = home(), i = -1;
    H.mons.forEach(function (x, k) { if (x.u === u) i = k; });
    if (i >= 0) {
      if (H.mons[i].auto && ex.hmArm !== u) { ex.hmArm = u; renderHome(); setTimeout(function () { if (ex.hmArm === u) { ex.hmArm = null; if (ex.view === 'home') renderHome(); } }, 4000); return; }
      ex.hmArm = null;
      var x = H.mons[i], m = mon(u), amt = homeExp(x), min = homeMins(x);
      H.mons.splice(i, 1);
      var msg = amt > 0 ? gainExp(m, amt) : null;
      if (min >= 60) dailyHit('home');
      save(); renderHome(); renderRes();
      toast(form(m).name + ' 回来了（展示了 ' + durText(min) + '）。' + (msg || '展示时间太短，还没有获得经验。'));
      return;
    }
    if (H.mons.length >= homeMax()) return;
    H.mons.push({ u: u, t: Date.now() }); save(); renderHome();
  }
  $('pg-explore').addEventListener('keydown', function (e) { if (e.target.id === 'home-name') { if (e.key === 'Enter') { e.preventDefault(); saveHomeName(); } else if (e.key === 'Escape') { ex.homeEdit = false; renderHome(); } } });

  /* ---------- 任务：主线 / 支线 / 世界 ---------- */
  var MAIN_Q = ['school', 'river', 'jiuquan', 'board', 'flora1', 'flora2', 'flora3', 'flora4', 'flora5', 'flora6'], SIDE_Q = ['academy', 'xiaogan', 'brawl', 'draft', 'storage', 'tiger', 'tiger2', 'tea', 'rare', 'mingming', 'medal', 'spa', 'fl_chal'];
  // 世界任务（奖励暂定）
  var WQ = [
    { id: 'w_first', n: '初到芙罗拉', d: '荆楚号已经抵达芙罗拉星。去丛林或草甸，和那里的野生精灵过过招吧。', where: '芙罗拉星 · 丛林 / 草甸', steps: [{ t: '在芙罗拉星击败 1 只野生精灵', k: 'wins', n: 1 }], reward: { energy: 100 }, after: 'flora1', go: 'flora' },
    { id: 'w_karo', n: '草甸上的奔跑者', d: '卡罗成群地在草甸上奔跑，捕捉率很高，很适合用来练习捕捉。', where: '芙罗拉星 · 草甸', steps: [{ t: '捕捉 1 只卡罗', k: 'own:wind', n: 1 }], reward: { items: { cap1: 3 } }, after: 'flora1', go: 'flora' },
    { id: 'w_mush', n: '林下的蘑菇', d: '丛林的树荫下，常能看到玛西的身影。', where: '芙罗拉星 · 丛林', steps: [{ t: '捕捉 1 只玛西', k: 'own:mush', n: 1 }], reward: { items: { pot1: 2 } }, after: 'flora1', go: 'flora' },
    { id: 'w_hunt', n: '荒野试炼', d: '多和野生精灵交手，伙伴们才会变强。', where: '芙罗拉星 · 丛林 / 草甸', steps: [{ t: '在芙罗拉星击败 10 只野生精灵', k: 'wins', n: 10 }], reward: { energy: 300 }, after: 'flora1', go: 'flora' },
    { id: 'w_kaleo', n: '丛林里的掠食者', d: '有人在丛林深处见过一只卡莱。它只在丛林出现，而且很少露面。', where: '芙罗拉星 · 丛林', steps: [{ t: '捕捉 1 只卡莱', k: 'own:kaleo', n: 1 }], reward: { energy: 500 }, after: 'flora1', go: 'flora' },
    { id: 'w_travel', n: '旅行猫', d: '叶子喵是芙罗拉星上很少见的精灵。听说最近有人在山毛榉林里见过一只……', where: '芙罗拉星 · 剧情', steps: [{ t: '读完芙罗拉星的剧情「旅行猫」', k: 'story:travelcat', n: 1 }], reward: { exp: 3000, energy: 500 }, after: 'flora2', go: 'flora', fpart: 'story' },
    { id: 'w_dex', n: '见习做题家', d: '黄冈秘鉴里亮起的页数越多，做题家就越受人尊敬。', where: '黄冈秘鉴', steps: [{ t: '在黄冈秘鉴中点亮 3 类精灵', k: 'lit', n: 3 }], reward: { energy: 200 }, after: 'academy', go: 'dex' }
  ];
  function qStat(k) {
    if (!acc.stats) acc.stats = {};
    if (k === 'wins') return acc.stats.wildWins || 0;
    if (k === 'lit') return litCount();
    if (k.indexOf('story:') === 0) return prog(k.slice(6)).done ? 1 : 0;
    if (k.indexOf('own:') === 0) { var sid = k.slice(4); return acc.mons.filter(function (m) { return m.sid === sid; }).length; }
    return 0;
  }
  function qClaimed(id) { return !!(acc.quests && acc.quests[id]); }
  // 状态：lock 未解锁 / todo 可进行 / doing 进行中 / claim 可领取 / done 已完成
  function qState(id) {
    var W = wq(id);
    if (W) {
      if (W.after && !prog(W.after).done) return 'lock';
      if (qClaimed(id)) return 'done';
      return W.steps.every(function (x) { return qStat(x.k) >= x.n; }) ? 'claim' : 'doing';
    }
    var pr = prog(id); if (!unlocked(id)) return 'lock';
    if (id === 'tiger') return bossWon('tiger') ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'tiger2') return bossWon('tiger', 1) ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'brawl') return brawlPlayed() ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'draft') return pr.done && draftPlayed() ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'rare') return prog('rare_r').done ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'fl_chal') return pr.done && chalStars('fl2') > 0 && helperSet() ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'flora2') return pr.done && spareN() >= SPARE_N ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    return pr.done ? 'done' : pr.at > 0 ? 'doing' : 'todo';
  }
  function wq(id) { for (var i = 0; i < WQ.length; i++) if (WQ[i].id === id) return WQ[i]; return null; }
  var QLAB = { lock: '未解锁', todo: '可进行', doing: '进行中', claim: '可领取', done: '已完成' };
  function qList(tab) { return tab === 'main' ? MAIN_Q : tab === 'side' ? SIDE_Q : tab === 'daily' ? [] : WQ.map(function (w) { return w.id; }); }
  function qTodo(tab) { if (tab === 'daily') { var D = daily(); return D ? D.list.filter(function (t) { return !t.c; }).length : 0; } return qList(tab).filter(function (id) { var st = qState(id); return st === 'todo' || st === 'doing' || st === 'claim'; }).length; }
  function exHead(hint) {
    return '<div class="page-head ex-head"><h2 class="sec">星际探索</h2><p class="hint">' + hint + '</p></div>';
  }
  function qName(id) { var W = wq(id); return W ? W.n : SITES[id].chapter.split(' · ')[1]; }
  function qWhere(id) {
    var W = wq(id); if (W) return W.where;
    var S = SITES[id], P = PLANETS.filter(function (p) { return p.id === S.planet; })[0];
    return P.name + ' · ' + (S.dept ? S.dept + ' · ' + DEPTS[S.dept][0] : S.name);
  }
  // 一个任务的完整信息：状态、步骤（ok 已完成，p 进度文字）、奖励、介绍、未开放原因
  function qInfo(id) {
    var W = wq(id), st = qState(id), steps, R, desc, need = '';
    if (W) {
      desc = W.d; R = W.reward;
      steps = W.steps.map(function (x) { var v = Math.min(qStat(x.k), x.n); return { t: x.t, ok: v >= x.n, p: v + ' / ' + x.n }; });
      if (st === 'lock') need = '读完「' + SITES[W.after].chapter.split(' · ')[1] + '」后开放。';
    } else {
      var S = SITES[id], pr = prog(id); desc = S.d; R = S.reward;
      steps = [{ t: '前往 ' + qWhere(id), ok: pr.done || pr.at > 0 }, { t: '读完剧情「' + qName(id) + '」', ok: pr.done }];
      if (S.chapter.indexOf('准备发射') >= 0) steps.splice(1, 0, { t: '和 Threego 进行剧情对战', ok: pr.done || !!pr.bt });
      if (id === 'brawl') steps = [{ t: '在孝感大厅听 Dr.黄 介绍精灵大乱斗', ok: pr.done }, { t: '打一场精灵大乱斗（竞技对战 → 精灵大乱斗，需要有其他船员在线）', ok: brawlPlayed() }];
      if (id === 'tiger') { steps = [{ t: '在古城防卫部听舰载广播介绍泰戈尔', ok: pr.done }, { t: '挑战并击败首领「泰戈尔」（只有水、火、草系技能能命中它）', ok: bossWon('tiger') }]; R = { mon: '小胖虎 LV10（首次击败）' }; }
      if (id === 'draft') steps = [{ t: '在孝感大厅听 Dr.黄 介绍竞技征召', ok: pr.done }, { t: '和其他船员打一场竞技征召（社交 → 向在线玩家宣战 → 5v5 · 平衡模式 · 竞技征召，胜负都算）', ok: draftPlayed() }];
      if (id === 'tiger2') { steps = [{ t: '在古城防卫部听泰戈尔介绍普通难度', ok: pr.done }, { t: '挑战并击败普通难度的「泰戈尔」（LV40，体力 1500，东北的纷争：物攻永久提升 30%）', ok: bossWon('tiger', 1) }]; R = { mon: '普通拳纹章、累积经验 ×20,000（首次击败普通难度）' }; }
      if (id === 'flora2') steps = [{ t: '前往 ' + qWhere(id), ok: pr.done || pr.at > 0 }, { t: '读完剧情「' + qName(id) + '」', ok: pr.done }, { t: '在芙罗拉星的丛林或草甸「假装击败」野生精灵（这个任务里野生精灵不会倒下，体力剩 1 点时就会逃走）', ok: spareN() >= SPARE_N, p: spareN() + ' / ' + SPARE_N }];
      if (id === 'fl_chal') steps = [{ t: '在古城防卫部听明明教官介绍挑战路线', ok: pr.done }, { t: '通过芙罗拉星挑战第二关（星际探索 → 芙罗拉星 → 挑战）', ok: chalStars('fl2') > 0 }, { t: '自己也挂一只助战精灵：社交 → 我的名片 → 助战精灵', ok: helperSet() }];
      if (id === 'rare') { var rr = prog('rare_r'); steps = [{ t: '在学院部听 Bttp 说明任务', ok: pr.done }, { t: '捕捉一种稀有精灵（芙罗拉星的丛林深处可能会有）', ok: rr.done || !!rareOwned() }, { t: '回到学院部，向 Bttp 汇报', ok: rr.done }]; R = SITES.rare_r.reward; desc = S.d; }
      if (st === 'lock') need = S.need && prog(S.after).done && !S.need() ? S.needText + (id === 'mingming' ? '（当前 ' + litCount() + ' / 10）' : id === 'brawl' ? '（当前持有 ' + acc.mons.length + ' 只）' : id === 'draft' ? '（当前 ' + speciesN() + ' / 10 种）' : id === 'flora3' ? '（当前 ' + spareN() + ' / ' + SPARE_N + '）' : '') + '。' : '先读完「' + SITES[S.after].chapter.split(' · ')[1] + '」。';
    }
    return { W: W, st: st, steps: steps, R: R, desc: desc, need: need };
  }
  function qDetail(id) {
    if (!id) return '<p class="empty-note">点击左边的任务，查看需要做什么。</p>';
    var I = qInfo(id), W = I.W, st = I.st, steps = I.steps, R = I.R, desc = I.desc, need = I.need;
    var rw = R ? rwList(R) : []; if (!W && UNLOCK[id]) rw.push('开放「' + UNLOCK[id] + '」');
    var cur = steps.filter(function (x) { return !x.ok; })[0];
    var act = st === 'lock' ? '' : st === 'claim' ? '<button type="button" class="btn primary" data-qclaim="' + id + '">领取奖励</button>'
      : st === 'done' ? (W ? '' : '<button type="button" class="btn" data-qgo="' + id + '">前往重温</button>')
      : '<button type="button" class="btn primary" data-qgo="' + id + '">' + (W ? '前往' : st === 'doing' ? '前往继续' : '前往') + ' ' + esc(qWhere(id).split(' · ').slice(-1)[0]) + '</button>';
    var CHd = !W && chapterOf(id);
    return '<span class="tape r"></span><span class="q-kind">' + (W ? '世界任务' : SITES[id].side ? '支线任务' : '主线任务' + (CHd ? ' · ' + esc(CHd.n) : '')) + '</span><h3 class="q-title">' + esc(qName(id)) + '</h3>' +
      '<p class="q-st ' + st + '">' + QLAB[st] + '</p><p>' + esc(desc) + '</p>' +
      '<h4>需要做什么</h4><ol class="q-steps">' + steps.map(function (x) { return '<li class="' + (x.ok ? 'ok' : x === cur && st !== 'lock' ? 'cur' : '') + '"><span class="qs-dot">' + (x.ok ? '✓' : '') + '</span>' + esc(x.t) + (x.p ? '<b class="qs-p">' + x.p + '</b>' : '') + '</li>'; }).join('') + '</ol>' +
      (need ? '<p class="hint red">' + need + '</p>' : '') +
      '<p class="q-where"><b>地点</b>　' + esc(qWhere(id)) + '</p>' +
      (rw.length ? '<p class="q-rw"><b>奖励</b>　' + rw.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join(' ') + (st === 'done' && (W || prog(id).rewarded) ? '<span class="hint">（已领取）</span>' : '') + '</p>' : '') +
      '<div class="q-act">' + act + '</div>';
  }
  function renderQuests() {
    var tab = ex.qtab || 'main', ids = qList(tab);
    if (!ex.qsel || ids.indexOf(ex.qsel) < 0) {
      var pick = null; ['claim', 'doing', 'todo', 'done'].some(function (k) { var f = ids.filter(function (id) { return qState(id) === k; }); if (f.length) { pick = k === 'done' ? f[f.length - 1] : f[0]; return true; } });
      ex.qsel = pick;
    }
    var tabs = [['main', '主线任务'], ['side', '支线任务'], ['world', '世界任务'], ['daily', '每日任务']].map(function (t) { var n = qTodo(t[0]); return '<button type="button" role="tab" class="tab' + (tab === t[0] ? ' on' : '') + '" aria-selected="' + (tab === t[0]) + '" data-qtab="' + t[0] + '">' + t[1] + (n ? '<i class="q-badge">' + n + '</i>' : '') + '</button>'; }).join('');
    var body = $('quest-body'); if (!body) return;
    renderQBadge();
    if (tab === 'daily') {
      body.innerHTML = '<div class="fparts q-tabs" role="tablist">' + tabs + '</div>' +
        '<article class="detail log-card wide">' + dailyHTML() + '</article>';
      return;
    }
    var lastCh = null;
    var list = ids.map(function (id) {
      var st = qState(id), CH = tab === 'main' ? chapterOf(id) : null, head = '';
      if (CH && CH !== lastCh) {   // 主线按章节分组，章节标题上写通关状态和章节大奖
        lastCh = CH;
        var got = chapterGot(CH.id);
        head = '<p class="q-chap"><b>' + esc(CH.n) + '</b><span class="' + (got ? 'ok' : '') + '">' + (got ? '已通关' : CH.wip ? '未完待续' : '进行中') + '</span><small>章节大奖：' + rwList(CH.reward).join('、') + (got ? '（已领取）' : '') + '</small></p>';
      }
      return head + '<button type="button" class="q-item ' + st + (ex.qsel === id ? ' sel' : '') + '" data-q="' + id + '"><span class="qi-n">' + esc(qName(id)) + '</span><span class="qi-w">' + esc(qWhere(id)) + '</span><span class="q-st ' + st + '">' + QLAB[st] + '</span></button>';
    }).join('');
    if (tab === 'main' && ids.every(function (id) { return qState(id) === 'done'; })) list += '<p class="hint q-more">后续主线正在制作中（未完待续）。</p>';
    body.innerHTML = '<div class="fparts q-tabs" role="tablist">' + tabs + '</div>' +
      '<div class="q-wrap"><div class="q-list">' + list + '</div><article class="detail q-detail" id="q-detail">' + qDetail(ex.qsel) + '</article></div>';
  }
  function questGo(id) {
    var W = wq(id); closeQuests();
    if (W) {
      if (W.go === 'dex') { if (dexOpen()) go('dex'); return; }
      ex.planet = W.go; ex.view = 'sites'; ex.fpart = W.fpart || 'catch'; go('explore'); renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return;
    }
    var S = SITES[id]; ex.planet = S.planet; go('explore');
    if (id === 'fl_chal' && prog('fl_chal').done) { if (chalStars('fl2') > 0 && !helperSet()) { go('social'); toast('在「我的名片」里选一只助战精灵，保存名片即可。'); return; } ex.planet = 'flora'; ex.view = 'sites'; ex.fpart = 'challenge'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (S.dept) { teleport(S.dept); return; }
    ex.view = 'sites'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
  }
  function claimQuest(id) {
    var W = wq(id); if (!W || qState(id) !== 'claim') return;
    var R = W.reward; acc.energy += R.energy || 0; acc.exp += R.exp || 0; giveItems(R.items);
    if (!acc.quests) acc.quests = {}; acc.quests[id] = Date.now(); save(); renderRes(); renderQuests();
    toast('完成世界任务「' + W.n + '」！获得 ' + rwList(R).join('、') + '。');
  }

  /* ---------- 顶栏「任务」：在名字旁边。鼠标移上去看进行中任务的进度，点开是完整的任务面板 ---------- */
  function qAllTodo() { try { return qTodo('main') + qTodo('side') + qTodo('world') + dailyClaimable(); } catch (e) { return 0; } }
  function renderQBadge() { var b = $('qtop-badge'); if (!b || !ready()) return; var n = qAllTodo(); b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
  function openQuests(tab) {
    if (!ready()) return;
    hideQPeek();
    if (tab) { ex.qtab = tab; ex.qsel = null; }
    var d = $('quest-dlg');
    if (!d) {
      d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'quest-dlg';
      d.innerHTML = '<div class="soc-box quest-box" role="dialog" aria-modal="true" aria-label="任务"><span class="tape l"></span><span class="tape r"></span>' +
        '<div class="quest-head"><div><span class="step">任务</span><h2>任务面板</h2></div><button type="button" class="btn ghost" data-qx="1">关闭</button></div>' +
        '<p class="hint">主线、支线、世界任务和每日任务。点一个任务，查看需要做什么，并可以一键前往。</p><div id="quest-body"></div></div>';
      document.body.appendChild(d);
      d.addEventListener('click', questClick);
    }
    renderQuests();
  }
  function closeQuests() { var d = $('quest-dlg'); if (d) d.remove(); }
  function questClick(e) {
    var d = $('quest-dlg');
    if (e.target === d || e.target.closest('[data-qx]')) { closeQuests(); return; }
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.qtab) { ex.qtab = b.dataset.qtab; ex.qsel = null; renderQuests(); return; }
    if (b.dataset.q) { ex.qsel = b.dataset.q; renderQuests(); var q = $('q-detail'); if (q && window.innerWidth < 760) q.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (b.dataset.qgo) { questGo(b.dataset.qgo); return; }
    if (b.dataset.dclaim) { claimDaily(+b.dataset.dclaim); renderQuests(); if (page === 'log') renderLog(); return; }
    if (b.dataset.qclaim) { claimQuest(b.dataset.qclaim); return; }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('quest-dlg')) closeQuests(); });
  // 悬停小窗：只列进行中 / 可领取的任务，每个写出当前这一步和进度
  function qPeekHTML() {
    var rows = [];
    [['main', '主线'], ['side', '支线'], ['world', '世界']].forEach(function (T) {
      qList(T[0]).forEach(function (id) {
        var st = qState(id); if (st !== 'doing' && st !== 'claim') return;
        var I = qInfo(id), done = I.steps.filter(function (x) { return x.ok; }).length, n = I.steps.length;
        var cur = I.steps.filter(function (x) { return !x.ok; })[0];
        var pct = cur && cur.p ? (function () { var m = /(\d+) \/ (\d+)/.exec(cur.p); return m ? +m[1] / +m[2] : done / n; })() : done / n;
        rows.push('<li class="qp-row ' + st + '" data-qpeek="' + id + '"><span class="qp-k">' + T[1] + '</span><b>' + esc(qName(id)) + '</b>' +
          '<span class="qp-step">' + (st === 'claim' ? '已完成，可以领取奖励' : esc(cur ? cur.t : '')) + '</span>' +
          '<span class="qp-bar"><i style="width:' + Math.round((st === 'claim' ? 1 : pct) * 100) + '%"></i></span><em>' + (st === 'claim' ? '可领取' : cur && cur.p ? cur.p : '第 ' + (done + 1) + ' / ' + n + ' 步') + '</em></li>');
      });
    });
    var D = daily(), dl = '';
    if (D) {
      var c = D.list.filter(function (t) { return t.c; }).length, ok = D.list.filter(function (t) { return !t.c && t.p >= DAILY[t.id].n; }).length;
      dl = '<li class="qp-row daily' + (ok ? ' claim' : '') + '" data-qpeek="daily"><span class="qp-k">每日</span><b>今天的每日任务</b><span class="qp-step">已领取 ' + c + ' 个' + (ok ? '，还有 ' + ok + ' 个可以领取' : '') + '</span>' +
        '<span class="qp-bar"><i style="width:' + Math.round((c + ok) / D.list.length * 100) + '%"></i></span><em>' + (c + ok) + ' / ' + D.list.length + '</em></li>';
    }
    return '<p class="qp-h"><b>进行中的任务</b><span class="hint">点击打开任务面板</span></p>' +
      (rows.length ? '<ul class="qp-list">' + rows.join('') + dl + '</ul>' : '<ul class="qp-list">' + dl + '</ul><p class="hint qp-none">没有进行中的主线、支线或世界任务。</p>');
  }
  var qPeekT = 0;
  function showQPeek() {
    if (!ready() || $('quest-dlg')) return;
    clearTimeout(qPeekT);
    var p = $('qtop-pop'); p.innerHTML = qPeekHTML(); p.hidden = false;
  }
  function hideQPeek() { clearTimeout(qPeekT); var p = $('qtop-pop'); if (p) p.hidden = true; }
  if ($('qtop-wrap')) {
    var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    $('qtop-wrap').addEventListener('mouseenter', function () { if (canHover) showQPeek(); });
    $('qtop-wrap').addEventListener('mouseleave', function () { qPeekT = setTimeout(hideQPeek, 150); });
    $('qtop-btn').addEventListener('click', function () { openQuests(); });
    $('qtop-pop').addEventListener('click', function (e) {
      var r = e.target.closest('[data-qpeek]'); if (!r) { openQuests(); return; }
      var id = r.dataset.qpeek;
      if (id === 'daily') { openQuests('daily'); return; }
      ex.qtab = wq(id) ? 'world' : SITES[id].side ? 'side' : 'main'; ex.qsel = id; openQuests();
    });
  }

  $('pg-explore').addEventListener('click', function (e) {
    if (ex.mode === 'replay' && $('vn')) { vnClick(e); return; }
    if (ex.view === 'shop' && shopClick(e)) return;
    if (e.target.closest('#bsoc')) { bsocClick(e); return; }
    var b = e.target.closest('button, .dept.open'); if (!b) return;
    if (chalClick(b)) return;
    if (towerClick(b)) return;
    if (b.dataset.area) { teleport(b.dataset.area); return; }
    if (b.dataset.npctalk) { npcTalk(b.dataset.npctalk); return; }
    if (b.dataset.room) { ex.view = 'room'; ex.room = b.dataset.room; ex.area = '天门'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll('荆楚号 · 陆羽茶室'); return; }
    if (b.dataset.home) { ex.view = 'home'; ex.area = '天门'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll('荆楚号 · 陆羽茶室'); return; }
    if (b.dataset.bosshub) { ex.view = 'bosshub'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.boss) { var BB = BOSSES[b.dataset.boss]; ex.bossFrom = b.dataset.from || null; ex.view = 'boss'; ex.boss = b.dataset.boss; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll(BB.dept ? '荆楚号 · ' + DEPTS[BB.dept][0] : bossWhere(BB)); return; }
    if (b.dataset.bossd) { ex.bossK = ex.boss; ex.bossD = +b.dataset.bossd; renderBoss(); return; }
    if (b.dataset.bossgo) { startBoss(b.dataset.bossgo, +b.dataset.d || 0); return; }
    if (b.dataset.weekly) { ex.view = 'weekly'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.weeklygo) { startBoss(WEEKLY.boss, WEEKLY.d, true); return; }
    if (b.id === 'boss-back') {
      var BK2 = BOSSES[ex.boss];
      if (ex.view === 'weekly') ex.view = 'planets';
      else if (ex.bossFrom === 'hub') ex.view = 'bosshub';
      else if (ex.bossFrom === 'field' && BK2.region) { enterField(BK2.region); return; }
      else if (BK2.dept) { ex.view = 'area'; ex.area = BK2.dept; }
      else { ex.view = 'sites'; ex.planet = BK2.planet; ex.fpart = 'catch'; }
      renderExplore(); return;
    }
    if (b.id === 'home-back') { ex.view = 'area'; ex.area = '天门'; renderExplore(); return; }
    if (b.id === 'home-rn') { ex.homeEdit = true; renderHome(); var ip = $('home-name'); if (ip) { ip.focus(); ip.select(); } return; }
    if (b.id === 'home-ok') { saveHomeName(); return; }
    if (b.id === 'home-cancel') { ex.homeEdit = false; renderHome(); return; }
    if (b.dataset.hm) { toggleHomeMon(+b.dataset.hm); return; }
    if (b.dataset.hauto) {
      var hx = home().mons.filter(function (x) { return x.u === +b.dataset.hauto; })[0];
      if (!hx || hx.auto || !(acc.items.auto > 0)) return;
      acc.items.auto--; hx.auto = { left: AUTO_DAYS, got: 0 }; save(); renderHome();
      toast('给 ' + form(mon(hx.u)).name + ' 装上了 7日自律训练装置：每满 1 天自动结算经验，一共 7 天。'); return;
    }
    if (b.dataset.teashop) { ex.view = 'teashop'; ex.area = '天门'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.tsbuy) { teaShopBuy(b.dataset.tsbuy); return; }
    if (b.dataset.tsq) { shopQty.tsauto = Math.max(1, Math.min(20, (shopQty.tsauto || 1) + +b.dataset.tsq)); renderTeaShop(); return; }
    if (b.id === 'ts-back') { ex.view = 'area'; ex.area = '天门'; renderExplore(); return; }
    if (b.dataset.hpoke) { var f = b.closest('.hm-fig'); f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop'); return; }
    if (b.dataset.shop) { ex.view = 'shop'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.nursery) { ex.view = 'nursery'; ex.area = '神农架'; ex.planet = 'jingchu'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.spa) { if (!spaOpen()) return; ex.view = 'spa'; ex.area = '咸宁'; ex.planet = 'jingchu'; ex.spaPick = null; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.id === 'spa-back') { ex.view = 'area'; ex.area = '咸宁'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.spaslot != null && b.dataset.spaslot !== '') { ex.spaPick = ex.spaPick === +b.dataset.spaslot ? null : +b.dataset.spaslot; renderSpa(); return; }
    if (b.dataset.spain) { spaPut(ex.spaPick, +b.dataset.spain); return; }
    if (b.dataset.spaout != null && b.dataset.spaout !== '') { spaPut(+b.dataset.spaout, null); return; }
    if (b.dataset.medal) { if (!medalOpen()) return; ex.view = 'medal'; ex.area = '黄冈'; ex.planet = 'jingchu'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.id === 'medal-back') { ex.view = 'area'; ex.area = '黄冈'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.promote) { promote(); return; }
    if (b.dataset.mdtype) { ex.mdType = b.dataset.mdtype; renderMedal(); return; }
    if (b.id === 'nursery-back') { ex.view = 'area'; ex.area = '神农架'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.incub) { nurseryPut(+b.dataset.incub.split('|')[0], b.dataset.incub.split('|')[1]); return; }
    if (b.dataset.hatch) { nurseryHatch(+b.dataset.hatch); return; }
    if (b.dataset.forge) { ex.view = 'forge'; ex.area = '黄石'; ex.planet = 'jingchu'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.fq) { var fq = b.dataset.fq.split('|'), fr = forgeOf(fq[0]); if (fr && !b.disabled) { shopQty['fg-' + fq[0]] = Math.max(1, Math.min(FORGE_Q, (shopQty['fg-' + fq[0]] || 1) + +fq[1])); renderForge(); } return; }
    if (b.dataset.smelt) { forgeCraft(b.dataset.smelt); return; }
    if (b.id === 'forge-back') { ex.view = 'area'; ex.area = '黄石'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.farm) { if (!farmOpen()) return; ex.view = 'farm'; ex.area = '恩施'; ex.planet = 'jingchu'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.sow) { var sw = b.dataset.sow.split('|'); farmPlant(+sw[0], sw[1]); return; }
    if (b.dataset.reap != null && b.dataset.reap !== '') { farmHarvest(+b.dataset.reap); return; }
    if (b.id === 'farm-back') { ex.view = 'area'; ex.area = '恩施'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.fpart) { ex.fpart = b.dataset.fpart; renderExplore(); return; }
    if (b.dataset.flst) { ex.flSt = b.dataset.flst; renderExplore(); return; }
    if (b.dataset.field && !b.disabled) { enterField(b.dataset.field); return; }
    if (b.dataset.gather != null && b.dataset.gather !== '') { gatherAt(+b.dataset.gather); return; }
    if (b.dataset.jade != null) { jadeAt(+b.dataset.jade); return; }
    if (b.dataset.bowl) { putBowl(); return; }
    if (b.dataset.travel) { engageTravel(+b.dataset.travel); return; }
    if (b.dataset.wfid) { engageField(+b.dataset.wfid); return; }
    if (b.dataset.wfnav) { fieldNav(+b.dataset.wfnav); return; }
    if (b.id === 'field-back') { var FR = regionById(ex.region); ex.view = 'sites'; if (FR) ex.planet = FR.planet; ex.fpart = 'catch'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.goshop) { ex.planet = 'jingchu'; ex.area = '荆门'; ex.view = 'shop'; ex.tp = true; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.id === 'ex-area') { ex.view = 'area'; renderExplore(); return; }
    if (b.id === 'ex-ship') { ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.planet && !b.disabled) { ex.planet = b.dataset.planet; ex.view = 'sites'; renderExplore(); mysteryRoll(planetOf(b.dataset.planet).name); return; }
    if (b.id === 'ex-back') { ex.view = 'planets'; renderExplore(); return; }
    if (b.dataset.go && unlocked(b.dataset.go)) { startVN(b.dataset.go, 'replay', $('pg-explore'), b.dataset.from === '0'); window.scrollTo(0, $('pg-explore').offsetTop - 8); }
  });

  $('pg-explore').addEventListener('keydown', function (e) { var g = e.target.closest && e.target.closest('.dept.open'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  /* ----- 对话舞台 ----- */
  // 剧情开始时在后台静默预加载这一段要用到的 CG 和背景图，免得播到时才开始下载（2026-10-17）
  var PRELOAD = {};
  function preloadImg(src) { if (!src || PRELOAD[src]) return PRELOAD[src]; var im = new Image(); im.decoding = 'async'; im.src = src; PRELOAD[src] = im; return im; }
  function preloadVN(site) {
    var arr = SCRIPT[site] || [];
    arr.forEach(function (st) {
      if (st.cg && CG[st.cg]) preloadImg(CG[st.cg][gender()] || CG[st.cg].m);
      if (st.bg && BG[st.bg]) preloadImg(BG[st.bg]);
    });
  }
  function startVN(site, mode, host, fromStart) {
    var pr; ex.site = site; pr = prog(site);
    setTimeout(function () { preloadVN(site); }, 0);
    if (mode !== 'intro') $('onboard').innerHTML = '';
    if (fromStart) { pr.at = 0; pr.ch = null; }
    ex.mode = mode; ex.host = host; ex.view = mode === 'replay' ? 'vn' : ex.view;
    ex.i = stepAt(pr.at); ex.log = []; ex.auto = false; ex.skip = false; ex.pickSel = null; ex.curBg = null; ex.curCg = null;
    renderVN(); bgmScene();
  }
  function renderVN() {
    ex.curBg = null;   // 整个舞台会重建（例如剧情对战打完回来），背景图要重新设置，不然会是空白
    var S = SITES[ex.site], P = PLANETS.filter(function (p) { return p.id === S.planet; })[0], intro = ex.mode === 'intro';
    ex.host.innerHTML = (intro ? '<div class="vn-intro-head"><span class="sc-tag">' + S.chapter + '</span><span class="hint">点击画面、按空格或回车继续。读完序章后进入游戏。</span></div>' : '') +
      '<div class="vn" id="vn" tabindex="0" aria-label="剧情对话，点击或按空格继续">' +
      '<img class="vn-bg" id="vn-bg" alt=""><img class="vn-bg vn-bg2" id="vn-bg2" alt="">' +
      '<div class="vn-chars" id="vn-chars"></div>' +
      '<div class="vn-mons" id="vn-mons"></div>' +
      '<div class="vn-cgwrap" id="vn-cg"><div class="vn-cg-pic" id="vn-cg-pic"></div></div>' +
      '<div class="vn-fx" id="vn-fx" aria-hidden="true"></div>' +
      '<div class="vn-top"><span class="vn-loc">' + P.name + ' · ' + S.name + '<small id="vn-spot"></small></span><span class="vn-ch">' + S.chapter + '</span>' +
      '<span class="vn-btns"><button type="button" data-vn="hide" title="隐藏界面，欣赏背景和立绘（H 键）">隐藏</button><button type="button" data-vn="log">记录</button><button type="button" data-vn="auto" id="vn-auto">自动</button><button type="button" data-vn="skip" id="vn-skip">跳过</button>' + (intro ? '' : '<button type="button" data-vn="exit">退出</button>') + '</span></div>' +
      '<div class="vn-box" id="vn-box"><div class="vn-name" id="vn-name"></div><p class="vn-text" id="vn-text"></p><span class="vn-next" id="vn-next" aria-hidden="true">▼</span></div>' +
      '<div class="vn-choices" id="vn-choices" hidden></div>' +
      '<div class="vn-pick" id="vn-pick" hidden></div>' +
      '<div class="vn-log" id="vn-log" hidden></div>' +
      '<div class="vn-end" id="vn-end" hidden></div><div class="vn-restore" aria-hidden="true">点击任意处恢复界面</div></div>' +
      (intro ? '' : '<p class="hint vn-tip">点击画面、按空格或回车继续；人物立绘目前为占位。</p>');
    var cgPic = $('vn-cg-pic'), cgWrap = $('vn-cg');
    cgPic.addEventListener('animationend', function (e) {
      if (e.animationName === 'vncgScroll') { cgWrap.classList.remove('play'); cgWrap.classList.add('shake'); }
      else if (e.animationName === 'vncgShake') { cgWrap.classList.remove('shake'); var L = ex.curCg && CG[ex.curCg] && CG[ex.curCg].land; if (L) { cgPic.style.backgroundImage = 'url(' + (L[gender()] || L.m) + ')'; cgWrap.classList.add('land'); } cgWrap.classList.add('full'); }   // 有横版的：定格时换成横版，放在画面上方
    });
    show();
    try { $('vn').focus({ preventScroll: true }); } catch (er) {}
  }
  function stopTimers() { clearTimeout(ex.timer); clearInterval(ex.tick); ex.timer = null; ex.tick = null; clearInterval(ex.farmTick); stopField(); }
  function setBg(k) {
    if (ex.curBg === k) return;
    var a = $('vn-bg'), b = $('vn-bg2');
    if (!ex.curBg) { a.src = BG[k]; } else { b.src = BG[k]; b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); setTimeout(function () { if (a.isConnected) { a.src = BG[k]; b.classList.remove('in'); } }, 520); }
    a.style.objectPosition = b.style.objectPosition = BG_POS[k] || '';
    ex.curBg = k; $('vn-spot').textContent = ' · ' + ((ex.site && SITES[ex.site] && SITES[ex.site].spot) || BG_NAME[k] || '');   // spot：画面借用别处背景时，地点名按剧情写
  }
  // 剧情画面特效（剧本行写 fx）：boom 爆炸白光（炸弹）、light 温暖的光芒爆裂（叶子喵登场）、purple 深紫色瘴气涌出、quake 画面震动
  function vnFx(k) {
    var f = $('vn-fx'), v = $('vn'); if (!f || !v) return;
    if (ex.skip) return;
    f.className = 'vn-fx'; v.classList.remove('quake'); void f.offsetWidth;
    if (k === 'quake') { v.classList.add('quake'); return; }
    f.classList.add(k); if (k === 'boom' || k === 'purple') v.classList.add('quake');
  }
  // 剧情 CG：整屏竖图，出现时先从上往下「扫」过一遍，接一下screen shake，再定格展示完整画面；按主角性别选图
  function setCG(k) {
    var w = $('vn-cg'); if (!w) return;
    if (!k) { if (ex.curCg) { w.classList.remove('show', 'play', 'shake', 'full', 'land'); ex.curCg = null; } return; }
    if (ex.curCg === k) return;
    ex.curCg = k;
    var src = CG[k] ? (CG[k][gender()] || CG[k].m) : '';
    $('vn-cg-pic').style.backgroundImage = src ? 'url(' + src + ')' : 'none';
    w.classList.remove('play', 'shake', 'full', 'land');
    void w.offsetWidth;
    w.classList.add('show');
    var go_ = function () { if (ex.curCg !== k) return; void w.offsetWidth; w.classList.add('play'); };
    var im = src && preloadImg(src);
    if (im && !im.complete) { var t0 = setTimeout(go_, 4000); im.addEventListener('load', function () { clearTimeout(t0); go_(); }, { once: true }); }   // 还没下载完：等图到了再开始运镜（最多等 4 秒）
    else go_();
  }
  function monsHTML(mode) {
    var img = function (sid, cls, label) { return '<figure class="vn-mon ' + cls + '"><img src="' + form({ sid: sid, lv: START_LV }).img + '" alt=""><figcaption>' + esc(label) + '</figcaption></figure>'; };
    if (mode === 'all') return STARTERS.map(function (sid, i) { return img(sid, ['a1', 'a2', 'a3'][i], monName(sid)); }).join('');
    if (mode && mode.indexOf('tw:') === 0) { var tsid = mode.slice(3); return '<figure class="vn-mon tw"><img src="' + form({ sid: tsid, lv: 3 }).img + '" alt=""><figcaption>被污染的' + esc(form({ sid: tsid, lv: 3 }).name) + '</figcaption></figure>'; }
    if (mode && mode.indexOf('item:') === 0) { var ip = mode.split(':'); return ITEM_IMG[ip[1]] ? '<figure class="vn-mon tw plain item"><img src="' + ITEM_IMG[ip[1]] + '" alt=""><figcaption>' + esc(ip[2] || '') + '</figcaption></figure>' : ''; }   // item:道具图:标签（剧情里出现的道具）
    if (mode && mode.indexOf('mon:') === 0) { var mp = mode.split(':'); return '<figure class="vn-mon tw plain"><img src="' + form({ sid: mp[1], lv: +mp[2] || 1 }).img + '" alt=""><figcaption>' + esc(mp[3] || form({ sid: mp[1], lv: +mp[2] || 1 }).name) + '</figcaption></figure>'; }   // mon:精灵:等级:标签
    if (mode && mode.indexOf('mia:') === 0) { var xp = mode.split(':'), xl = +xp[2] || 1, xf = form({ sid: xp[1], lv: xl }), fx = typeof FORM_FX_SPRITES !== 'undefined' && FORM_FX_SPRITES[xp[1]]; return '<figure class="vn-mon tw plain mia"><img src="' + (fx && fx.miasma && xl >= 50 ? fx.miasma : xf.img) + '" alt=""><figcaption>' + esc(xp[3] || '瘴气' + xf.name) + '</figcaption></figure>'; }   // mia:精灵:等级:标签（瘴气变异的样子，带紫色光晕）
    if (mode === 'mine' && acc.starter) return img(acc.starter, 'me', starterName());
    if (mode === 'pair' && acc.starter) return img(acc.starter, 'me', starterName()) + (acc.rival ? img(acc.rival, 'rv', monName(acc.rival)) : '');
    return '';
  }
  function show() {
    stopTimers();
    var arr = SCRIPT[ex.site], pr = prog(ex.site);
    ex.i = stepAt(ex.i);
    if (ex.i >= arr.length) { finish(); return; }
    pr.at = ex.i; save();
    var st = arr[ex.i], on = carry(ex.i, 'on', []), mons = carry(ex.i, 'mons', '');
    $('vn').classList.toggle('memory', !!carry(ex.i, 'memory', false));
    setBg(carry(ex.i, 'bg', SITES[ex.site].bg));
    setCG(carry(ex.i, 'cg', null));
    if (st.bgm !== undefined) setTimeout(bgmScene, 0);   // 剧本切歌：立刻换，不等 0.5 秒的轮询
    if (st.fx) vnFx(st.fx);
    seeStep(st, st.mons !== undefined ? st.mons : mons);
    if (st.give) storyGive(ex.site, st.give);
    var monsH = monsHTML(mons); if ($('vn-mons').dataset.k !== mons + acc.starter) { $('vn-mons').innerHTML = monsH; $('vn-mons').dataset.k = mons + acc.starter; }
    $('vn-chars').innerHTML = on.map(function (o) {
      var k = o[0], pos = o[1], speak = st.s === k;
      return '<div class="vn-fig ' + pos + (CAST[k].img || CAST[k].spr ? ' art' : '') + (CAST[k].full ? ' full' : '') + (speak ? ' speak' : st.s && st.s !== 'n' && !st.choice ? ' dim' : '') + '" style="--cc:' + CAST[k].color + '">' + standee(k, k === 'p' ? pFace(arr, ex.i) : st.f && st.f[k]) + '<span class="vn-tag">' + esc(CAST[k].name()) + '</span></div>';
    }).join('');
    // Bttp 不在现场、通过无线电说话时：在画面右上方显示他的全息投影（荆楚号上的剧情是当面说话，不显示）
    if (st.s === 'b' && !on.some(function (o) { return o[0] === 'b'; }) && SITES[ex.site].planet !== 'jingchu') {
      var hk = 'holo:' + ex.site, hold = $('vn-chars').dataset.holo === hk;
      $('vn-chars').insertAdjacentHTML('beforeend', '<div class="vn-fig holo art' + (hold ? ' still' : '') + '" style="--cc:' + CAST.b.color + '">' + standee('b', st.f && st.f.b) + '<span class="vn-tag">' + esc(CAST.b.name()) + ' · 全息通讯</span><i class="holo-base" aria-hidden="true"></i></div>');
      $('vn-chars').dataset.holo = hk;
    } else $('vn-chars').dataset.holo = '';
    $('vn-choices').hidden = true; $('vn-pick').hidden = true; $('vn-box').classList.remove('wait');
    if (st.choice) {
      $('vn-box').classList.add('wait'); $('vn-choices').hidden = false;
      $('vn-choices').innerHTML = st.choice.map(function (c) { return '<button type="button" class="vn-opt" data-ch="' + c.k + '">' + esc(fill(c.t)) + '</button>'; }).join('');
      ex.skip = false; syncBtns(); return;
    }
    if (st.pick || st.battle) { ex.skip = false; ex.auto = false; syncBtns(); }
    var nar = st.s === 'n', name = nar ? '' : CAST[st.s].name();
    $('vn-name').textContent = name; $('vn-name').hidden = nar; $('vn-name').style.setProperty('--cc', nar ? '' : CAST[st.s].color);
    $('vn-box').classList.toggle('narr', nar);
    ex.full = fill(st.t); ex.shown = 0; ex.typing = true; $('vn-next').hidden = true;
    ex.log.push({ n: name, t: ex.full });
    var chars = Array.from(ex.full), txt = $('vn-text');
    if (ex.skip) { txt.textContent = ex.full; ex.typing = false; ex.timer = setTimeout(next, 70); return; }
    txt.textContent = '';
    ex.tick = setInterval(function () { ex.shown++; txt.textContent = chars.slice(0, ex.shown).join(''); if (ex.shown >= chars.length) doneTyping(); }, 32);
  }
  function doneTyping() {
    clearInterval(ex.tick); ex.tick = null; ex.typing = false;
    $('vn-text').textContent = ex.full;
    var st = SCRIPT[ex.site][ex.i];
    if (st && st.pick) { openPick(); return; }
    if (st && st.battle) { openFight(st.battle); return; }
    $('vn-next').hidden = false;
    if (ex.auto) ex.timer = setTimeout(next, 1200 + Array.from(ex.full).length * 45);
  }
  function openFight(key) {
    var F = FIGHTS[key], el = $('vn-pick'), fteam = fightTeam(F), f0 = fteam[0];
    var mineImg = F.pteam ? (F.pteam[0].img || formImg(SPMAP[F.pteam[0].sid], stageOf(SPMAP[F.pteam[0].sid], F.pteam[0].lv))) : (((acc.teams[acc.active] || []).map(mon).filter(Boolean)[0] || acc.mons[0]) ? form((acc.teams[acc.active] || []).map(mon).filter(Boolean)[0] || acc.mons[0]).img : '');
    var foeImg = f0.img || (f0.moves || f0.boss ? (f0.sid === 'dummy' ? '' : formImg(SPMAP[f0.sid], stageOf(SPMAP[f0.sid], f0.lv))) : form({ sid: f0.sid, lv: f0.lv }).img);
    var foeName = f0.nick || form({ sid: f0.sid, lv: f0.lv }).name;
    el.hidden = false;
    el.innerHTML = '<div class="vn-fight"><b>剧情对战</b><div class="vf-row"><img src="' + mineImg + '" alt=""><span class="vs">VS</span><img src="' + foeImg + '" alt=""></div>' +
      '<p>' + (F.pteam ? esc(F.pteam[0].nick || SPMAP[F.pteam[0].sid].name) + '（LV' + F.pteam[0].lv + '）' : '你的出战配队（' + TEAM_NAME[acc.active] + '）') + '对阵 ' + (F.desc ? esc(F.desc) : esc(F.foe) + ' 的 ' + esc(foeName) + '（LV' + f0.lv + '）') + '</p>' +
      (F.allyMon && F.allyOpt ? '<label class="vf-ally"><input type="checkbox" data-vnally="1"' + (ex.allyOff ? '' : ' checked') + '> 带上' + esc(F.allyMon.nick || SPMAP[F.allyMon.sid].name) + '（LV' + F.allyMon.lv + '）助战' + (F.allyMon.boss && F.allyMon.boss.purify ? '　<span class="hint">剧情限定特性「净化光芒」：对瘴气精灵伤害 +100%</span>' : '') + '</label>' : '') +
      '<button type="button" class="btn primary" data-vn="fight" data-fk="' + key + '">开始对战</button></div>';
  }
  function openPick() {
    var el = $('vn-pick'), sel = ex.pickSel;
    el.hidden = false;
    el.innerHTML = '<div class="vp-cards" role="radiogroup" aria-label="选择初始精灵">' + STARTERS.map(function (sid) {
      var s = SPMAP[sid], f = form({ sid: sid, lv: START_LV });
      return '<button type="button" class="vp-card' + (sel === sid ? ' sel' : '') + '" role="radio" aria-checked="' + (sel === sid) + '" data-pk="' + sid + '">' +
        '<img src="' + f.img + '" alt=""><span class="nm">' + esc(f.name) + '</span><span class="tc">' + tchips(s.types) + '<span class="chip">LV' + START_LV + '</span></span>' +
        (f.d ? '<span class="fd">' + esc(f.d) + '</span>' : '') + '<span class="ab">特性 · ' + esc(s.ability.n) + '</span><span class="ad">' + esc(s.ability.d) + '</span>' +
        (s.placeholder ? '<span class="placeholder-note">数值和技能还是占位</span>' : '') + '</button>';
    }).join('') + '</div><div class="vp-foot"><span>' + (sel ? '选择 <b>' + esc(monName(sel)) + '</b> 作为你的伙伴？选定后不能更换。' : '点击一只精灵') + '</span>' +
      '<button type="button" class="btn primary" data-vn="pickok"' + (sel ? '' : ' disabled') + '>就选它了</button></div>';
  }
  function next() {
    if (!$('vn')) return;
    if (ex.typing) { doneTyping(); return; }
    var st = SCRIPT[ex.site][ex.i]; if (st && (st.choice || st.pick || st.battle)) return;
    ex.i++; show();
  }
  // 第一次读完第十段后弹出：芙罗拉星已经被腐化
  function floraFallenNotice() {
    if ($('fallen-dlg')) return;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'fallen-dlg';
    d.innerHTML = '<div class="soc-box fallen-box" role="dialog" aria-modal="true" aria-label="芙罗拉星"><span class="step">芙罗拉星</span><h2>腐化</h2>' +
      '<div class="fallen-planet" aria-hidden="true"><img class="fp-a" src="images/planets/flora.webp?v=2" alt=""><img class="fp-b" src="images/planets/flora_corrupt.webp?v=2" alt=""><i class="fp-fog"></i></div>' +
      '<p>现在，芙罗拉星和星球上的绝大多数精灵，已经被瘴气腐化了。</p>' +
      '<p>尽力驱散这些诅咒吧……如果有用的话。</p>' +
      '<p class="hint">芙罗拉星的野外遇到的精灵都变成了腐化精灵，无法捕捉。击败它们，同样计入星球任务「祛除瘴气」。</p>' +
      '<div class="pw-open"><span class="chip log-tag pw-tag">全服任务</span><b>瘴气驱逐战已开启</b><span>所有船员一起击败腐化精灵，推进全服进度条，达到里程碑就能领取奖励。在航行日志和芙罗拉星的「星球任务」里查看。</span></div>' +
      '<div class="soc-foot"><button type="button" class="btn" data-fallenlog="1">去看看</button><button type="button" class="btn primary" data-fallenx="1">知道了</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target.closest('[data-fallenlog]')) { d.remove(); go('log'); } });
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-fallenx]')) d.remove(); });
  }
  function finish() {
    stopTimers();
    var pr = prog(ex.site), firstDone = !pr.done; pr.done = true; pr.at = 0; save();
    var R = grant(ex.site), intro = ex.mode === 'intro';
    if (ex.site === 'flora6' && firstDone) setTimeout(floraFallenNotice, 600);   // 第一次读完第十段：芙罗拉星被腐化的提示
    var CH = chapterOf(ex.site), chPaid = CH && chapterDone(CH) && !chapterGot(CH.id) && !intro ? (chapterPay(CH), CH) : null;
    if (chPaid) renderRes();
    if (R && ready()) renderRes();
    var nxt = Object.keys(SITES).filter(function (id) { return SITES[id].after === ex.site && !SITES[id].side; })[0] || Object.keys(SITES).filter(function (id) { return SITES[id].after === ex.site && unlocked(id); })[0];
    if (R && R.title) { checkTitles(); renderTitle(); }
    var nxtP = nxt && PLANETS.filter(function (p) { return p.id === SITES[nxt].planet; })[0];
    if (UNLOCK[ex.site]) syncBattle();
    ex.auto = false; ex.skip = false;
    $('vn-chars').innerHTML = ''; $('vn-mons').innerHTML = ''; $('vn-box').hidden = true; $('vn-choices').hidden = true;
    $('vn-end').hidden = false;
    $('vn-end').innerHTML = '<div class="vn-endbox"><span class="sc-tag">' + SITES[ex.site].chapter + '</span><b>完</b>' +
      (R ? '<p>获得奖励</p><div class="vn-reward">' + rwList(R).map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '') +
      (ex.site === 'rare' && !nxt ? '<p><b class="red">任务：捕捉一种稀有精灵，然后回学院部汇报。</b></p>' : '') + (R && R.title ? '<p><b class="red">获得称号「' + TITLES.filter(function (x) { return x.id === R.title; })[0].n + '」！</b><br><span class="hint">点击右上角的名字即可佩戴</span></p>' : '') +
      (chPaid ? '<div class="vn-chap"><b>「' + chPaid.n + '」完成！</b><p>章节大奖</p><div class="vn-reward">' + rwList(chPaid.reward).map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div></div>' : '') +
      (nxt && !unlocked(nxt) && SITES[nxt].needText && !SITES[ex.site].endText ? '<p><b class="red">任务：' + SITES[nxt].needText + '。</b></p>' : '') +
      (UNLOCK[ex.site] && !SITES[ex.site].endText ? '<p><b class="red">「' + UNLOCK[ex.site] + '」已开放！</b>' + (ex.site === 'storage' ? '<br><span class="hint">在荆楚号 · 荆门 · 物资仓储里进入</span>' : ex.site === 'medal' ? '<br><span class="hint">在荆楚号 · 黄冈 · 学院部里进入</span>' : '') + '</p>' : '') +
      '<p>' + (SITES[ex.site].endText ? SITES[ex.site].endText : nxt && !unlocked(nxt) ? '完成任务后，下一段「' + SITES[nxt].chapter.split(' · ')[1] + '」就会开放。' : nxt ? (SITES[nxt].side ? '支线「' : '下一段「') + SITES[nxt].chapter.split(' · ')[1] + '」已解锁，可在星际探索 · ' + nxtP.name + (SITES[nxt].dept ? ' · ' + DEPTS[SITES[nxt].dept][0] : '') + '中继续。' : '后续剧情正在制作中。') + '</p>' +
      '<div class="row">' + (intro ? '<button type="button" class="btn primary" data-vn="enter">进入游戏</button>'
        : '<button type="button" class="btn" data-vn="replay">重温一遍</button>' + (nxt && unlocked(nxt) ? '<button type="button" class="btn" data-vn="next" data-nx="' + nxt + '">继续下一段</button>' : '') + '<button type="button" class="btn primary" data-vn="exit">' + (SITES[ex.site].dept ? '返回区域' : '返回地点') + '</button>') + '</div></div>';
    syncBtns();
  }
  function syncBtns() { var a = $('vn-auto'), s = $('vn-skip'); if (a) a.classList.toggle('on', ex.auto); if (s) s.classList.toggle('on', ex.skip); }
  function setUiOff(on) { var v = $('vn'); if (!v) return; v.classList.toggle('ui-off', on); if (on) { ex.autoWas = ex.auto; ex.auto = false; stopTimers(); if (ex.typing) doneTyping(); syncBtns(); } }
  function vnClick(e) {
    if ($('vn') && $('vn').classList.contains('ui-off') && e.target.closest('#vn')) { setUiOff(false); return; }
    if (e.target.closest('.vf-ally')) { var cb = $('vn-pick').querySelector('[data-vnally]'); if (cb) setTimeout(function () { ex.allyOff = !cb.checked; }, 0); return; }   // 助战勾选框：不要触发「下一句」
    var b = e.target.closest('button');
    if (b && b.dataset.ch) { prog(ex.site).ch = b.dataset.ch; ex.i++; show(); return; }
    if (b && b.dataset.pk) { ex.pickSel = b.dataset.pk; openPick(); return; }
    if (b && b.dataset.vn) {
      var a = b.dataset.vn;
      if (a === 'fight') { startFight(b.dataset.fk); return; }
      if (a === 'pickok' && ex.pickSel) { pickStarter(ex.pickSel); ex.i++; show(); return; }
      if (a === 'exit') { stopTimers(); ex.mode = null; ex.planet = SITES[ex.site].planet; if (SITES[ex.site].fpart) ex.fpart = SITES[ex.site].fpart; if (SITES[ex.site].dept) { ex.view = 'area'; ex.area = SITES[ex.site].dept; } else ex.view = 'sites'; renderExplore(); return; }
      if (a === 'replay') { startVN(ex.site, 'replay', ex.host, true); return; }
      if (a === 'next') { startVN(b.dataset.nx, 'replay', ex.host, prog(b.dataset.nx).done || !prog(b.dataset.nx).at); return; }
      if (a === 'enter') { finishIntro(); return; }
      if (a === 'auto') { ex.auto = !ex.auto; ex.skip = false; syncBtns(); if (ex.auto && !ex.typing && !ex.tick) ex.timer = setTimeout(next, 600); return; }
      if (a === 'skip') { ex.skip = !ex.skip; ex.auto = false; syncBtns(); if (ex.skip) { if (ex.typing) doneTyping(); next(); } return; }
      if (a === 'log') { openLog(); return; }
      if (a === 'hide') { setUiOff(true); return; }
      if (a === 'logx') { $('vn-log').hidden = true; return; }
      return;
    }
    if (e.target.closest('#vn-log') || e.target.closest('#vn-end') || e.target.closest('.vn-top') || e.target.closest('#vn-pick')) return;
    if (!e.target.closest('#vn')) return;
    if (ex.skip) { ex.skip = false; syncBtns(); return; }
    next();
  }
  function openLog() {
    var l = $('vn-log');
    l.innerHTML = '<div class="vn-loghead"><b>对话记录</b><button type="button" class="btn ghost" data-vn="logx">关闭</button></div><div class="vn-logbody">' +
      (ex.log.length ? ex.log.map(function (x) { return '<p>' + (x.n ? '<b>' + esc(x.n) + '</b>' : '<i>旁白</i>') + esc(x.t) + '</p>'; }).join('') : '<p class="hint">还没有对话。</p>') + '</div>';
    l.hidden = false; var body = l.querySelector('.vn-logbody'); body.scrollTop = body.scrollHeight;
  }
  document.addEventListener('keydown', function (e) {
    var vn = $('vn'); if (!vn || !ex.mode) return;
    if (ex.mode === 'replay' && page !== 'explore') return;
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (vn.classList.contains('ui-off')) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'h' || e.key === 'H') { e.preventDefault(); setUiOff(false); } return; }
    if ((e.key === 'h' || e.key === 'H') && $('vn-end').hidden) { setUiOff(true); return; }
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault(); if (!$('vn-log').hidden || !$('vn-end').hidden || !$('vn-pick').hidden) return; next();
    } else if (e.key === 'Escape' && !$('vn-log').hidden) $('vn-log').hidden = true;
  });

  /* ---------- 拜访别人的茶室：挑战茶室里展示的精灵 ----------
   * 每天前 5 场各奖励 1000 累积经验（进经验背包），赢输都算，认输不算；0 点刷新 */
  var TEA_DAILY = 5, TEA_EXP = 1000;
  function teaLeft() { var t = acc && acc.teaFight; return t && t.d === todayKey() ? Math.max(0, TEA_DAILY - (t.n || 0)) : TEA_DAILY; }
  function teaFight(opt) {
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    var p = team.slice(0, TEAM_SIZE).map(storyMon);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight');
    ['log', 'bag', 'store', 'dex', 'items', 'social', 'explore'].forEach(function (pg) { $('pg-' + pg).hidden = true; });
    $('pg-arena').hidden = false; $('who-menu').hidden = true;
    window.HSBATTLE.start({ p: p, a: opt.foe, foe: opt.owner + '的茶室', bg: BG.tea_p, back: '茶室', onEnd: function (res, seen, downs, quit) {
      ex.fighting = false; document.body.classList.remove('story-fight');
      var msg = '';
      if (quit) msg = '认输的茶室对战不计入奖励次数。';
      else if (teaLeft() > 0) {
        var t = acc.teaFight && acc.teaFight.d === todayKey() ? acc.teaFight : { d: todayKey(), n: 0 };
        t.n++; acc.teaFight = t; acc.exp = (acc.exp || 0) + TEA_EXP; save();
        msg = '茶室对战奖励：累积经验 +' + fmt(TEA_EXP) + '，已放进经验背包。今天还能领 ' + teaLeft() + ' 次。';
      } else msg = '今天的 ' + TEA_DAILY + ' 次茶室对战奖励已经领完了，明天 0 点刷新。';
      go('social');
      setTimeout(function () { toast(msg); }, 300);
      if (opt.onDone) opt.onDone(res, quit);
    } });
  }

  /* ---------- 精灵大乱斗（竞技对战的第三种模式，联网） ----------
   * 6 只精灵统一 LV60、学会所有隐藏技能、配招为技能表的最后 4 个、无学习力，性格由服务器随机
   * 胜者 2000、败者 1000 累积经验（平局各 1000；自己认输或自己掉线没有奖励），每天最多 20000 */
  var BRAWL_WIN = 2000, BRAWL_LOSE = 1000, BRAWL_CAP = 20000, BRAWL_LV = 60;
  function brawlSpec(raw) {
    var s = raw && SPMAP[raw.sid]; if (!s) return null;
    var all = s.moves.concat(s.hidden).filter(function (n, i, a) { return M[n] && a.indexOf(n) === i; });
    var f = form({ sid: raw.sid, lv: BRAWL_LV });
    return { id: raw.sid, lv: BRAWL_LV, moves: all.slice(-4), nick: f.name, img: f.img, ev: {}, nat: raw.nat && NATURES[raw.nat] ? raw.nat : null };
  }
  function brawlToday() { return acc.brawlExp && acc.brawlExp.d === bjDay() ? acc.brawlExp.n || 0 : 0; }
  function brawlReward(result, noReward) {
    if (!acc.stats) acc.stats = {};
    var first = !brawlPlayed();
    if (!noReward) { dailyHit('brawl'); if (result === 'win') dailyHit('brawlWin'); }
    if (!noReward) { acc.stats.brawls = (acc.stats.brawls || 0) + 1; if (first) setTimeout(function () { toast('支线「精灵大乱斗」完成！随时可以再来和其他船员打大乱斗。'); }, 4200); }
    var want = noReward ? 0 : result === 'win' ? BRAWL_WIN : BRAWL_LOSE, had = brawlToday(), give = Math.max(0, Math.min(want, BRAWL_CAP - had));
    if (give > 0) { acc.brawlExp = { d: bjDay(), n: had + give }; acc.exp = (acc.exp || 0) + give; renderRes(); }
    save();
    return { want: want, give: give, today: brawlToday(), cap: BRAWL_CAP };
  }

  /* ---------- 给社交页（social.js）用的接口 ---------- */
  window.HSACC = {
    acc: function () { return acc; }, ready: ready, save: save, toast: toast, go: go, page: function () { return page; }, renderRes: renderRes,
    titleName: titleName, mon: mon, fmt: fmt, avatarInner: avatarInner, avatarSpec: function () { var m = avatarMon(); return m ? { sid: m.sid, lv: m.lv, shiny: shinyV(m.shiny) } : null; },
    npcPlan: npcPlan, npcHome: npcHome,
    sendMail: sendMail, openMailbox: openMailbox,
    rankToday: rankToday, RANK_EXP: { exp: RANK_EXP, n: RANK_EXP_N, token: RANK_TOKEN }, tokenBarHTML: tokenBarHTML, openTokenShop: openTokenShop, rankRwHTML: rankRwHTML, openQuests: openQuests, gender: gender,
    brawlOpen: brawlOpen, brawlSpec: brawlSpec, brawlReward: brawlReward, brawlToday: brawlToday, BRAWL: { win: BRAWL_WIN, lose: BRAWL_LOSE, cap: BRAWL_CAP, lv: BRAWL_LV },
    // 平衡模式切磋：LV60、性格无修正、没有学习力和纹章，技能可以从全部技能里选（没选就用竞技对战里记住的配招）
    balSpec: function (raw) {
      var s = raw && SPMAP[raw.sid]; if (!s) return null;
      var own = s.moves.concat(s.hidden);
      var mv = (raw.moves || []).filter(function (n, i, a) { return M[n] && own.indexOf(n) >= 0 && a.indexOf(n) === i; }).slice(0, 4);
      if (!mv.length) mv = window.HSBATTLE && HSBATTLE.loadout ? HSBATTLE.loadout(raw.sid) : s.def.slice();
      var f = form({ sid: raw.sid, lv: BAL_LV });
      return { id: raw.sid, lv: BAL_LV, moves: mv, nick: f.name, img: f.img, ev: {}, nat: null };
    },
    BAL_LV: BAL_LV, speciesN: speciesN, homeOpen: homeOpen,
    homeRefresh: function () { if (page === 'explore' && ex.view === 'home' && !ex.fighting && document.querySelector('.home-room')) renderHome(); },
    goHome: function () { if (!homeOpen()) { toast('读完星际探索 · 荆楚号 · 天门「陆羽茶室」支线后，才有自己的茶室。'); return; } ex.planet = 'jingchu'; ex.area = '天门'; ex.view = 'home'; go('explore'); },
    // 参加过一次竞技征召（支线任务「竞技征召」用）
    noteDraft: function () { if (!acc.stats) acc.stats = {}; acc.stats.drafts = (acc.stats.drafts || 0) + 1; save(); },
    teaFight: teaFight, teaLeft: teaLeft, TEA_DAILY: TEA_DAILY, TEA_EXP: TEA_EXP, homePos: HOME_POS,
    view: function (m) { var f = form(m); return { name: f.name, img: f.img, stage: f.stage, shiny: f.shiny }; },
    // 把服务器发来的精灵资料变成对战用的精灵（逐项检查，不信任外来数据）
    spec: function (raw) {
      var s = raw && SPMAP[raw.sid]; if (!s) return null;
      var lv = Math.max(1, Math.min(100, Math.round(+raw.lv || 1)));
      var own = s.moves.concat(s.hidden);
      var mv = (raw.moves || []).filter(function (n, i, a) { return M[n] && own.indexOf(n) >= 0 && a.indexOf(n) === i; }).slice(0, 4);
      if (!mv.length) mv = defaultMoves(raw.sid, lv, []);
      var ev = {}; STAT_KEYS.forEach(function (k) { var v = raw.ev && +raw.ev[k]; if (v > 0) ev[k] = Math.min(300, Math.round(v)); });
      var iv = ivOk(raw.iv) ? STAT_KEYS.reduce(function (o, k) { o[k] = raw.iv[k]; return o; }, {}) : null;   // 没带天赋的按满天赋
      var f = form({ sid: raw.sid, lv: lv, shiny: shinyV(raw.shiny) });
      return { id: raw.sid, lv: lv, moves: mv, nick: f.name, img: f.img, shiny: shinyV(raw.shiny), ev: ev, iv: iv, nat: raw.nat && NATURES[raw.nat] ? raw.nat : null, emblem: raw.emblem && EMBLEMS[raw.sid] ? EMBLEMS[raw.sid].m : null };
    },
    inBattle: function () { return !$('battle').hidden; },
    // 联网切磋：像剧情对战一样切到对战画面，锁住其他大栏
    enterBattle: function () {
      stopTimers(); ex.fighting = true; document.body.classList.add('story-fight');
      ['log', 'bag', 'store', 'dex', 'items', 'social', 'explore'].forEach(function (p) { $('pg-' + p).hidden = true; });
      $('pg-arena').hidden = false; $('who-menu').hidden = true;
    },
    leaveBattle: function () { ex.fighting = false; document.body.classList.remove('story-fight'); go('social'); }
  };

  /* ---------- 界面音乐：按当前所在的界面选曲（对战中由战斗音乐盖过，见 js/ui/audio.js） ---------- */
  var FLORA_SCENES = { flora: 1, floraGrass: 1, floraForest: 1 };
  function sceneNow() {
    var vb = vnBgm(); if (vb) return vb;   // 剧本里逐行指定的曲目（bgm 字段）优先，瘴气化之后重读也按剧本放
    var k = sceneNowRaw();
    if ((page === 'explore' && ex.view === 'home') || (page === 'social' && window.HSSOCIAL && HSSOCIAL.visitBgm && HSSOCIAL.visitBgm())) return k;   // 茶室音乐按选的曲目原样放，不受瘴气化替换（Flora1 = 草甸、Flora2 = 丛林）
    return FLORA_SCENES[k] && floraFallen() ? 'floraFallen' : k;   // 第八段结尾瘴气化之后，芙罗拉星的界面音乐统一换成 floraFallen（flora3-TheGreatCover）
  }
  // 剧本行可以写 bgm: '曲目键'（见 audio.js 的 TRACKS/SCENES），从这一行起一直生效，直到下一个写了 bgm 的行；'silence' 表示停止音乐
  function vnBgm() {
    if (!(ex.site && SCRIPT[ex.site] && $('vn') && (page === 'explore' || ex.mode === 'intro') && (ex.mode === 'intro' || (ex.mode === 'replay' && ex.view === 'vn')))) return null;
    return carry(Math.min(ex.i || 0, SCRIPT[ex.site].length - 1), 'bgm', null);
  }
  function sceneNowRaw() {
    var vnSite = ex.site && SITES[ex.site] && (ex.mode === 'intro' || (ex.mode === 'replay' && ex.view === 'vn')) ? SITES[ex.site].planet : null;
    if (vnSite === 'earth') return 'earth';            // 地球上的剧情（含序章）
    if (!ready()) return 'ui';
    if (page === 'arena') return 'arena';              // 竞技大厅
    if (page === 'explore' && ex.view === 'home') return homeBgm();   // 自己的茶室：放自己选的茶室音乐
    if (page === 'social' && window.HSSOCIAL && HSSOCIAL.visitBgm) { var vb = HSSOCIAL.visitBgm(); if (vb) return vb; }   // 拜访别人的茶室：放主人选的
    if (page === 'explore') {
      if (vnSite === 'flora') return 'flora';
      if (ex.view === 'sites' && ex.planet === 'flora') return 'flora';
      if (ex.view === 'field' && fields[ex.region] && regionById(ex.region) && regionById(ex.region).planet === 'flora') {   // 芙罗拉星野外：草甸放 floraGrass，丛林放 floraForest
        var rid_ = regionById(ex.region).id;
        return rid_ === 'grass' ? 'floraGrass' : rid_ === 'forest' ? 'floraForest' : 'flora';
      }
      if (ex.view === 'boss' && BOSSES[ex.boss] && BOSSES[ex.boss].planet === 'flora') return 'flora';
    }
    return 'ui';
  }
  function bgmScene() { if (window.HSAUDIO && HSAUDIO.scene) HSAUDIO.scene(sceneNow()); }
  setInterval(bgmScene, 500);

  renderTop(); syncBattle(); bgmScene();
})();
