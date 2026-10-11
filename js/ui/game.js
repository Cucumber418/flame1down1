/* ==========================================================
 * 账号与主线
 * 创建账号、精灵背包/仓库、黄冈秘鉴、星际探索剧情、商城、茶室、任务
 * ========================================================== */

/* ============ 账号系统：创建账号、初始精灵、精灵背包（配队）、精灵仓库、星际探索 ============ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var H = window.HSUI, esc = H.esc, tchip = H.tchip, tchips = H.tchips, atkTip = H.atkTip;
  var KEY = 'hs-account-v1', PKEY = 'hs-page';
  var STARTERS = ['leaf', 'squid', 'shroom'], START_LV = 5, NAME_MAX = 10, TEAM_N = 2, TEAM_SIZE = 5;
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
      if (!(m.exp >= expAt(m.lv))) m.exp = expAt(m.lv);
      // 隐藏技能改为战斗中领悟：旧存档里已经装备着的隐藏技能视为已领悟
      if (!Array.isArray(m.hl)) m.hl = (m.moves || []).filter(function (n) { return M[n] && M[n].hidden && LEARN[n]; });
      var a = avail(m.sid, m.lv, m.hl); m.moves = (m.moves || []).filter(function (n) { return a.indexOf(n) >= 0; });
      if (!m.moves.length) m.moves = defaultMoves(m.sid, m.lv, m.hl);
    });
    if (!(acc.exp >= 0)) acc.exp = 0; if (!(acc.energy >= 0)) acc.energy = 0;
    if (!acc.items || typeof acc.items !== 'object') acc.items = {};
  }
  function ready() { return !!(acc && acc.introDone); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(acc)); } catch (e) {} }
  function savePage() { try { localStorage.setItem(PKEY, page); } catch (e) {} }

  /* ---------- 精灵实例 ---------- */
  function mon(u) { if (!acc) return null; for (var i = 0; i < acc.mons.length; i++) if (acc.mons[i].u === u) return acc.mons[i]; return null; }
  function stageOf(s, lv) { for (var i = evoLast(s); i > 0; i--) if (lv >= s.evo[i].lv) return i; return 0; }
  function form(m) {
    var s = SPMAP[m.sid], st = stageOf(s, m.lv), n = formRawName(s, st), unsure = false;
    if (n && n.slice(-1) === '?') { n = n.slice(0, -1); unsure = true; }
    if (!n) n = s.name + '·' + stageLabel(s, st);
    var img = formImg(s, st);
    return { name: n, img: img, stage: st, unsure: unsure, no: s.evo[st].no || '', d: s.evo[st].d || '' };
  }
  // 普通技能：第 1 个 LV1 习得，之后每 5 级学会下一个（LV5、LV10、LV15……）；隐藏技能暂按 LV50
  function learnLv(i) { return i === 0 ? 1 : i * 5; }
  function moveLv(sid, mv) { var s = SPMAP[sid], i = s.moves.indexOf(mv); return i >= 0 ? learnLv(i) : 50; }
  // hl：这只精灵已领悟的隐藏技能。有领悟条件的隐藏技能只能在战斗中领悟；没写条件的仍然 LV50 习得。
  // 不传 hl（剧情里的对手）时沿用旧规则：LV50 起隐藏技能全部可用。
  function hidOk(lv, hl, n) { return hl && LEARN[n] ? hl.indexOf(n) >= 0 : lv >= 50; }
  function avail(sid, lv, hl) { var s = SPMAP[sid]; return s.moves.filter(function (n, i) { return lv >= learnLv(i); }).concat(s.hidden.filter(function (n) { return hidOk(lv, hl, n); })); }
  function defaultMoves(sid, lv, hl) {
    var s = SPMAP[sid], a = avail(sid, lv, hl), out = s.def.filter(function (n) { return a.indexOf(n) >= 0; });
    a.forEach(function (n) { if (out.length < 4 && out.indexOf(n) < 0) out.push(n); });
    return out;
  }
  function randNat() { return NAT_KEYS[Math.floor(Math.random() * NAT_KEYS.length)]; }
  function newMon(sid, lv) { var m = { u: acc.next++, sid: sid, lv: lv, exp: expAt(lv), moves: defaultMoves(sid, lv, []), got: Date.now(), nat: randNat(), ev: {}, evFree: 0, hl: [] }; acc.mons.push(m); markForm(sid, stageOf(SPMAP[sid], lv)); return m; }
  function evSum(m) { return STAT_KEYS.reduce(function (a, k) { return a + ((m.ev && m.ev[k]) || 0); }, 0); }
  function natText(nat) { var n = NATURES[nat]; return n ? BASE_NAME[n[0]] + ' +10%，' + BASE_NAME[n[1]] + ' −10%' : '各项能力无修正'; }
  // 胜利后，出战过的精灵各得 1 点可分配学习力（总量不超过 750）
  function giveEv(units, n) {
    var got = []; n = n || 1;
    units.forEach(function (u) { var m = mon(u), room = m ? EV_TOTAL - evSum(m) - (m.evFree || 0) : 0; if (room > 0) { m.evFree = (m.evFree || 0) + Math.min(n, room); got.push(form(m).name); } });
    save(); return got;
  }
  /* 经验：到达某等级所需的累计经验 = 等级³（LV5 为 125，LV100 为 1,000,000） */
  var MAX_LV = 100;
  function expAt(lv) { return lv * lv * lv; }
  function lvOf(exp) { var lv = Math.max(1, Math.floor(Math.cbrt(exp))); while (lv < MAX_LV && expAt(lv + 1) <= exp) lv++; while (lv > 1 && expAt(lv) > exp) lv--; return Math.min(lv, MAX_LV); }
  function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }
  function giveExp(m, amt) { return gainExp(m, amt, true); }
  // fromPool：从经验分配器里扣；否则是战斗直接获得
  function gainExp(m, amt, fromPool) {
    var room = expAt(MAX_LV) - m.exp; amt = Math.max(0, Math.min(amt, room, fromPool ? acc.exp : Infinity)); if (!amt) return null;
    var before = { lv: m.lv, name: form(m).name, stage: form(m).stage };
    markForm(m.sid, before.stage);
    m.exp += amt; if (fromPool) acc.exp -= amt; m.lv = lvOf(m.exp); markForm(m.sid, form(m).stage);
    var after = form(m), msg = form(m).name + ' 获得了 ' + fmt(amt) + ' 点经验';
    if (m.lv > before.lv) msg += '，升到了 LV' + m.lv + '！';
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
  function stat(m, k) { return fullStat(SPMAP[m.sid].base[k], k, m.lv, m.ev, m.nat); }

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
    $('who-av').textContent = Array.from(acc.name)[0] || '?';
    $('who-info').textContent = '做题家「' + acc.name + '」 · 拥有精灵 ' + acc.mons.length + ' 只 · 创建于 ' + new Date(acc.created).toLocaleDateString('zh-CN');
    checkTitles(); renderTitle();
    if (page === 'arena' && !arenaOpen()) page = 'bag';
    if (page === 'dex' && !dexOpen()) page = 'bag';
    if (page === 'shop') page = 'explore';
    [].forEach.call(document.querySelectorAll('#mainnav .nav'), function (b) {
      var on = b.dataset.page === page; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    });
    syncBattle();
    checkRankRewards(); daily();
    ['arena', 'log', 'bag', 'store', 'dex', 'explore'].forEach(function (p) { $('pg-' + p).hidden = p !== page; });
    if (page === 'bag') renderBag();
    else if (page === 'log') renderLog();
    else if (page === 'dex') renderDex2();
    else if (page === 'store') renderStore();
    else if (page === 'explore') renderExplore();
  }
  function renderRes() { $('res').innerHTML = '<span class="res-chip" title="经验背包里的累积经验，可分配给精灵">经验 <b>' + fmt(acc.exp) + '</b></span><span class="res-chip en" title="能量（货币）">能量 <b>' + fmt(acc.energy) + '</b></span>'; }
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
      if (pg === 'arena') { b.classList.toggle('lockA', lockA); b.querySelector('small').textContent = lockA ? '完成孝感大厅支线后开放' : '沙盒调试 · 实战段位'; }
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
    { id: 'trainee', n: '见习做题家', d: '在黄冈秘鉴中点亮 3 类精灵', ok: function () { return litCount() >= 3; } },
    { id: 'collector', n: '见习收藏家', d: '捕捉一种稀有精灵，并在学院部汇报', ok: function () { return !!(acc.story && acc.story.rare_r && acc.story.rare_r.done); } },
    { id: 'senior', n: '资深做题家', d: '在黄冈秘鉴中点亮 10 类精灵', ok: function () { return litCount() >= 10; } },
    { id: 'purifier', n: '芙罗拉净化者', d: '完成芙罗拉星的星球任务「祛除瘴气」', ok: function () { return !!(acc.purge && acc.purge.n >= 30); } }
  ];
  function checkTitles() {
    if (!acc.titles) acc.titles = [];
    TITLES.forEach(function (T) {
      if (acc.titles.indexOf(T.id) < 0 && T.ok()) { acc.titles.push(T.id); save(); setTimeout(function () { toast('获得称号「' + T.n + '」！点右上角的名字即可佩戴。'); }, 400); }
    });
  }
  function titleName(id) { var T = TITLES.filter(function (x) { return x.id === id; })[0]; return T ? T.n : ''; }
  function renderTitle() {
    var cur = acc.title && acc.titles.indexOf(acc.title) >= 0 ? acc.title : '';
    $('who-title').textContent = cur ? titleName(cur) : '做题家';
    $('who-title').classList.toggle('has', !!cur);
    $('title-box').innerHTML = '<b>称号</b>' + TITLES.map(function (T) {
      var own = acc.titles.indexOf(T.id) >= 0;
      return '<label class="tt-opt' + (own ? '' : ' lock') + '"><input type="radio" name="title" value="' + T.id + '"' + (cur === T.id ? ' checked' : '') + (own ? '' : ' disabled') + '><span><b>' + T.n + '</b><small>' + (own ? '已获得' : '未获得 · ' + T.d) + '</small></span></label>';
    }).join('') + '<label class="tt-opt"><input type="radio" name="title" value=""' + (cur ? '' : ' checked') + '><span><b>不佩戴</b></span></label>';
  }
  $('title-box').addEventListener('change', function (e) { if (e.target.name === 'title') { acc.title = e.target.value || null; save(); renderTitle(); } });
  $('title-box').addEventListener('click', function (e) { e.stopPropagation(); });
  $('btn-reset').addEventListener('click', function () {
    if (!ui.resetArmed) { ui.resetArmed = 1; this.classList.add('armed'); this.textContent = '确定重置？再点一次'; return; }
    acc = null; try { localStorage.removeItem(KEY); } catch (e) {}
    ui = { sel: null, pick: -1, ob: { step: 1, name: '', starter: null }, f: { type: '', min: 1, max: 100, sort: 'lvd' }, resetArmed: 0, welcome: false };
    stopTimers(); ex.view = 'planets'; ex.mode = null;
    $('who-menu').hidden = true; page = 'arena'; savePage(); renderTop();
  });

  /* ---------- 创建账号：输入名字 → 直接进入省实验中学序章，在张老师指引下挑选精灵 ---------- */
  function clip(v) { return Array.from(v).slice(0, NAME_MAX).join(''); }
  function renderOnboard() {
    var ob = ui.ob, el = $('onboard');
    if (acc && !acc.introDone) { if (ex.mode !== 'intro' || !$('vn')) startVN('school', 'intro', el, false); return; }
    el.innerHTML = '<div class="onboard"><span class="tape l"></span><span class="tape r"></span>' +
      '<h2>欢迎来到 Flame1Down - 1</h2>' +
      '<p>请先创建账号。给自己起一个做题家名字，最多 ' + NAME_MAX + ' 个字。</p>' +
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
    setTimeout(function () { try { inp.focus(); } catch (er) {} }, 0);
  }
  $('onboard').addEventListener('click', function (e) { if (ex.mode === 'intro' && $('vn')) vnClick(e); });
  function createAccount(name) {
    acc = { v: 1, name: name, created: Date.now(), starter: null, rival: null, next: 1, mons: [], teams: [[], []], active: 0, introDone: false, story: {}, exp: 0, energy: 0, items: {} };
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
    return '<span class="cimg"><img src="' + f.img + '" alt=""></span><span class="nm">' + esc(f.name) + '</span><span class="lv">LV' + m.lv + '</span><span class="tc">' + tchips(s.types) + '</span>' + (extra || '');
  }
  function evoLine(m) {
    var s = SPMAP[m.sid], st = stageOf(s, m.lv);
    return '<div class="evo-line">' + s.evo.map(function (e, i) {
      var n = formRawName(s, i); n = n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i);
      if (s.placeholder && i > 0) n = '？';
      return (i ? '<span>→ LV' + e.lv + ' →</span>' : '') + '<b class="' + (i === st ? 'cur' : '') + '">' + esc(n) + '</b>';
    }).join('') + '</div>';
  }
  function monDetail(m) {
    if (!m) return '<p class="empty-note">点击一只精灵查看资料、配置技能。</p>';
    var s = SPMAP[m.sid], f = form(m), a = avail(m.sid, m.lv, m.hl || []), n = m.moves.length, ts = teamsOf(m.u);
    var free = m.evFree || 0, sum = evSum(m), stats = '';
    STAT_KEYS.forEach(function (k) {
      var b = s.base[k], v = stat(m, k), ev = (m.ev && m.ev[k]) || 0, nm = natureMult(m.nat, k), room = Math.min(free, EV_MAX - ev, EV_TOTAL - sum);
      stats += '<span>' + BASE_NAME[k] + '</span><span class="sv' + (nm > 1 ? ' up' : nm < 1 ? ' dn' : '') + '" title="' + (nm > 1 ? '性格加成 +10%' : nm < 1 ? '性格修正 −10%' : '') + '">' + v + (nm > 1 ? '↑' : nm < 1 ? '↓' : '') + '</span>' +
        '<span class="bar"><i style="width:' + Math.min(100, b / 150 * 100) + '%"></i></span><span class="real">种族值 ' + b + '</span>' +
        '<span class="evc"><button type="button" data-ev="' + k + '" data-d="-10"' + (ev ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 −10">−10</button><button type="button" data-ev="' + k + '" data-d="-1"' + (ev ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 −1">−1</button>' +
        '<b title="学习力 ' + ev + ' / ' + EV_MAX + '，能力值 +' + Math.floor(ev / 10) + '">' + ev + '<small>+' + Math.floor(ev / 10) + '</small></b>' +
        '<button type="button" data-ev="' + k + '" data-d="1"' + (room > 0 ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 +1">+1</button><button type="button" data-ev="' + k + '" data-d="10"' + (room > 0 ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 +10">+10</button></span>';
    });
    stats = '<div class="nat"><b>性格 · ' + m.nat + '</b><span>' + natText(m.nat) + '</span></div>' +
      '<div class="evhead"><b>学习力</b><span>可分配 <b class="' + (free ? 'red' : '') + '">' + free + '</b> · 已分配 ' + sum + ' / ' + EV_TOTAL + '</span><span class="hint">每 10 点学习力 = 1 点能力值，单项最多 ' + EV_MAX + '。战斗胜利后，出战过的精灵各得 1 点。</span>' +
      (sum ? '<button type="button" class="btn ghost" data-evreset="1">全部收回</button>' : '') + '</div>' +
      '<div class="stats evstats">' + stats + '<span class="sum">实际能力值 = LV' + m.lv + ' 的数值 + 学习力加成，再乘性格修正' + (s.placeholder ? ' · 数值为占位' : s.unsure && s.unsure.length >= 6 ? ' · 种族值暂定' : '') + '</span></div>';
    var row = function (mv) {
      var M_ = M[mv], on = m.moves.indexOf(mv) >= 0, ok = a.indexOf(mv) >= 0, id = 'am-' + m.u + '-' + mv;
      var meta = M_.cat + (M_.power ? ' · 威力' + M_.power : '') + (M_.pri ? ' · 先制+' + M_.pri : '') + ' · PP' + M_.pp;
      return '<label class="mrow' + (on ? ' on' : '') + (M_.hidden ? ' hid' : '') + (ok ? '' : ' locked') + '" for="' + id + '">' +
        '<input type="checkbox" id="' + id + '" data-amove="' + mv + '"' + (on ? ' checked' : '') + (ok ? '' : ' disabled') + '>' +
        '<span class="l1"><span class="mn">' + M_.name + '</span>' + atkTip(M_.type) + '<span class="mm">' + meta + '</span>' +
        (M_.hidden ? '<span class="tag sc hidtag" tabindex="0">隐藏<span class="tip" role="tooltip"><b>隐藏技能</b>' + (LEARN[mv] ? '在战斗中领悟的特殊技能' : '达到 LV50 时习得') + '</span></span>' : '') +
        (ok ? '' : '<span class="lock">LV' + moveLv(m.sid, mv) + ' 习得</span>') + '</span><span class="md">' + esc(M_.d) + '</span></label>';
    };
    var acts = acc.teams.map(function (t, i) {
      var k = t.indexOf(m.u);
      if (k >= 0) return (k > 0 ? '<button class="btn" type="button" data-lead="' + i + '">设为' + TEAM_NAME[i] + '首发</button>' : '') + '<button class="btn ghost" type="button" data-out="' + i + '">移出' + TEAM_NAME[i] + '</button>';
      return '<button class="btn primary" type="button" data-in="' + i + '"' + (t.length >= TEAM_SIZE ? ' disabled title="' + TEAM_NAME[i] + '已满 5 只"' : '') + '>加入' + TEAM_NAME[i] + '</button>';
    }).join('');
    return '<span class="tape r"></span>' +
      '<div class="d-head"><button type="button" class="d-art" data-abig="' + m.sid + '|' + f.stage + '" title="点击查看大图" aria-label="查看' + esc(f.name) + '的大图"><img src="' + f.img + '" alt="' + esc(f.name) + '"></button><div>' +
      '<h3>' + (f.no ? '<span class="dexno">No.' + f.no + '</span>' : '') + esc(f.name) + (f.unsure ? '<i class="q" title="字迹没看清">?</i>' : '') + '</h3>' +
      '<p style="margin:0 0 6px"><span class="lvbig">LV' + m.lv + '</span>' + tchips(s.types) + '</p>' +
      '<p class="hint">' + stageLabel(s, f.stage) + (!isFin(s, f.stage) ? ' · 最终进化为' + (s.placeholder ? '？' : s.name) : '') +
      (ts.length ? ' · ' + ts.map(function (x) { return TEAM_NAME[x.t] + (x.lead ? '首发' : ''); }).join('、') : ' · 未加入配队') + '</p>' +
      (f.d ? '<p class="formdesc">' + esc(f.d) + '</p>' : '') + evoLine(m) + (s.placeholder ? '<p class="placeholder-note" style="margin-top:6px">还没画出来，形象、数值和技能均为占位</p>' : '') + '</div></div>' +
      expBox(m) + stats +
      '<div class="trait"><p><b>特性 · ' + esc(s.ability.n) + '</b>　<span class="blue">' + esc(s.ability.d) + '</span></p>' + (s.ability.extra ? '<p class="blue" style="font-size:13px">' + esc(s.ability.extra) + '</p>' : '') + '</div>' +
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
      if (d > 0) d = Math.min(d, free, EV_MAX - ev, EV_TOTAL - evSum(m)); else d = -Math.min(-d, ev);
      if (d) { m.ev[k] = ev + d; m.evFree = free - d; }
      save(); renderTop(); return;
    }
    if (b.dataset.evreset) { m.evFree = (m.evFree || 0) + evSum(m); m.ev = {}; save(); renderTop(); return; }
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
    var cmp = { lvd: function (a, b) { return b.lv - a.lv || a.u - b.u; }, lva: function (a, b) { return a.lv - b.lv || a.u - b.u; }, got: function (a, b) { return a.u - b.u; }, name: function (a, b) { return nm(a).localeCompare(nm(b), 'zh-CN'); } }[f.sort];
    return list.sort(cmp);
  }
  var LV_PRE = [[1, 100, '全部'], [1, 24, 'LV1–24'], [25, 49, 'LV25–49'], [50, 100, 'LV50–100']];
  function renderStore() {
    var f = ui.f, list = filtered(), m = mon(ui.sel);
    var cnt = {}; acc.mons.forEach(function (x) { SPMAP[x.sid].types.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    var html = '<div class="page-head"><h2 class="sec">精灵仓库</h2><p class="hint flash">这里存放着你拥有的全部精灵，可按属性、等级检索。点击精灵查看资料，并可加入配队。</p></div>' +
      '<div class="filters" id="filters">' +
      '<div class="f-row"><span class="f-lab">属性</span><button type="button" class="fchip' + (!f.type ? ' on' : '') + '" data-ft="">全部<i>' + acc.mons.length + '</i></button>' +
      ALL_T.map(function (t) { return '<button type="button" class="fchip t' + (f.type === t ? ' on' : '') + (cnt[t] ? '' : ' zero') + '" style="--tc:' + TYPE_COLOR[t] + '" data-ft="' + t + '">' + t + '<i>' + (cnt[t] || 0) + '</i></button>'; }).join('') + '</div>' +
      '<div class="f-row"><span class="f-lab">等级</span>' + LV_PRE.map(function (p) { return '<button type="button" class="fchip' + (f.min === p[0] && f.max === p[1] ? ' on' : '') + '" data-flv="' + p[0] + '-' + p[1] + '">' + p[2] + '</button>'; }).join('') +
      '<span class="hint" style="margin-left:6px">自定义</span><input type="number" id="f-min" min="1" max="100" value="' + f.min + '" aria-label="最低等级" inputmode="numeric"><span>–</span><input type="number" id="f-max" min="1" max="100" value="' + f.max + '" aria-label="最高等级" inputmode="numeric"></div>' +
      '<div class="f-foot"><div class="f-row"><label class="f-lab" for="f-sort">排序</label><select id="f-sort">' +
      [['lvd', '等级从高到低'], ['lva', '等级从低到高'], ['got', '获得顺序'], ['name', '名称']].map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select><span class="hint">显示 ' + list.length + ' / ' + acc.mons.length + ' 只</span></div>' +
      '</div></div>' +
      '<div class="build"><div><div class="dex-grid" id="store-grid">' +
      (list.length ? list.map(function (x) {
        var ts = teamsOf(x.u);
        return '<button type="button" class="card' + (ui.sel === x.u ? ' sel' : '') + '" data-u="' + x.u + '">' +
          (ts.length ? '<span class="tms">' + ts.map(function (y) { return '<span class="' + (acc.active === y.t ? 'on' : '') + '">' + TEAM_NAME[y.t] + (y.lead ? '·首发' : '') + '</span>'; }).join('') + '</span>' : '') +
          '<img src="' + form(x).img + '" alt="' + esc(form(x).name) + '"><span class="nm">' + esc(form(x).name) + '</span><span class="lv">LV' + x.lv + '</span><span class="meta">' + tchips(SPMAP[x.sid].types) + '</span></button>';
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
    if (st.battle && FIGHTS[st.battle]) FIGHTS[st.battle].team.forEach(function (x) { seeMon(x.sid, x.lv); });
    if (mons && mons.indexOf('tw:') === 0) seeMon(mons.slice(3), 3);
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
      var n = formRawName(s, i); n = n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i); if (s.placeholder && i > 0) n = '？';
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
    { id: 'flora', name: '芙罗拉星', d: '草系星球。丛林、草甸和盐碱地里栖息着许多野生精灵。', sites: ['flora1'], wild: true, ptype: '草系星球', color: ['#9fd08a', '#3f7d4a'], after: 'board' },
    { id: 'kamble', name: '坎布尔星', d: '水系星球。大半个星球都被温暖的浅海覆盖。', sites: [], wild: true, ptype: '水系星球', color: ['#8cc6ea', '#2a6fb0'], after: 'flora1' },
    { id: 'pompeii', name: '庞贝星', d: '火系星球。火山终年喷发，地面被熔岩烤得发烫。', sites: [], wild: true, ptype: '火系星球', color: ['#f2a46b', '#b3401f'], after: 'flora1' },
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
    荆州: ['典籍馆', '资料与档案'], 荆门: ['物资仓储', '补给与仓库'], 天门: ['陆羽茶室', '乘员的休息舱（家园）'],
    潜江: ['食堂', '餐饮补给'], 仙桃: ['体能馆', '体能与失重训练']
  };
  var SITES = {
    school: { name: '省实验中学', planet: 'earth', chapter: '第一段 · 月考之后', bg: 'gate', d: '月考成绩公布后的第二天，张老师有一件「天大的好事」要宣布，还要为你们挑选伙伴精灵。', reward: { exp: 1000, energy: 500 } },
    river: { name: '武昌江边', planet: 'earth', chapter: '第二段 · 江边出发', bg: 'qiyi', d: '出发的日子到了。从起义门到彭刘杨路，再坐大巴驶过长江大桥，一路向西。', after: 'school', reward: { exp: 1000, energy: 500 } },
    jiuquan: { name: '酒泉卫星发射中心', planet: 'earth', chapter: '第三段 · 准备发射', bg: 'jslc', d: '穿过戈壁和沙丘，大巴终于抵达发射中心。在这里，你们遇见了要去太空寻找奶弟的女孩 Threego。', after: 'river', reward: { exp: 1000, energy: 500 } },
    board: { name: '鄂州港', planet: 'jingchu', dept: '鄂州', chapter: '第四段 · 登上荆楚号', bg: 'orbit', d: '火箭升空，进入轨道。等在那里的，是一艘和湖北省地图一模一样的飞船。', after: 'jiuquan', pos: [22, 70], reward: { exp: 1000, energy: 500 } },
    academy: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 黄冈秘鉴', side: true, bg: 'pod_p', d: '学院部里收着一本记录所有精灵的「黄冈秘鉴」。读完后开放「黄冈秘鉴」。', after: 'board', pos: [50, 72], reward: { exp: 0, energy: 100 } },
    flora1: { name: '盐碱地', planet: 'flora', chapter: '第五段 · 降临芙罗拉', bg: 'fl_salt', d: '第一支地面探索小队降落在了芙罗拉星。可着陆舱偏离了坐标，落进了弥漫着瘴气的盐碱地……', after: 'board', reward: { exp: 1000, energy: 500 } },
    tea: { name: '陆羽茶室', planet: 'jingchu', dept: '天门', chapter: '支线 · 陆羽茶室', side: true, bg: 'tea_p', d: '从芙罗拉星回来后，舰上要给第一支地面小队分配休息舱。读完后开放你自己的「茶室」（家园）。', after: 'flora1', pos: [50, 84] },
    mingming: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 明明教官的礼物', side: true, bg: 'bridge_p', d: '古城防卫部的明明教官听说你在黄冈秘鉴里点亮了十类精灵，想见见你。', after: 'board', pos: [48, 82], need: function () { return litCount() >= 10; }, needText: '在黄冈秘鉴中点亮 10 类精灵后开放', reward: { gift: [{ sid: 'aegis', lv: 10 }] } },
    tiger: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 东北来的泰戈尔', side: true, bg: 'bridge_p', d: '古城防卫部来了一只从东北招募的特殊虎系精灵，专门辅助乘员训练。读完后开放首领「泰戈尔」的挑战。', after: 'board', pos: [30, 70] },
    rare: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 稀有精灵', side: true, bg: 'pod_p', d: 'Bttp 在黄冈秘鉴里发现了几页几乎空白的记录，想请你帮学院部找一只稀有精灵。', after: 'flora1', pos: [26, 58] },
    rare_r: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 稀有精灵（汇报）', side: true, bg: 'pod_p', d: '把捕捉到的稀有精灵带回学院部，向 Bttp 汇报。', after: 'rare', pos: [74, 58], need: function () { return !!rareOwned(); }, needText: '捕捉一种稀有精灵后来汇报', reward: { title: 'collector' } },
    storage: { name: '物资仓储', planet: 'jingchu', dept: '荆门', chapter: '支线 · 物资仓储', side: true, bg: 'storage_p', d: '荆楚号即将抵达芙罗拉星，新乘员要去物资仓储领取探索物资。读完后，物资仓储里的「商城」开放。', after: 'board', pos: [50, 62], reward: { exp: 0, energy: 300, items: { cap1: 10 } } },
    xiaogan: { name: '孝感大厅', planet: 'jingchu', dept: '孝感', chapter: '支线 · 孝感大厅', side: true, bg: 'xiaogan', d: '舰上切磋对战的地方。听说那里有个奇怪的家伙在等着新乘员。读完后开放「竞技对战」。', after: 'board', pos: [50, 66], reward: { exp: 0, energy: 200 } }
  };
  // 已有画面的舰内区域；其余区域先用占位画面
  var AREA_BG = { 黄冈: 'pod_p', 鄂州: 'hangar_p', 孝感: 'xiaogan', 武汉: 'cockpit_p', 咸宁: 'cabin_p', 仙桃: 'gym_p', 荆门: 'storage_p', 天门: 'teahall', 随州: 'bridge2_p', 襄阳: 'bridge_p' };
  var BG_POS = { qiyi: '50% 42%', desert: '50% 40%', jslc: '50% 38%', street: '50% 55%', bridge: '45% 55%', tower: '50% 55%' };
  var BG_NAME = { gate: '校门', school: '校门', flag: '教学楼', garden: '牌坊花园', qiyi: '起义门', street: '彭刘杨路', bridge: '长江大桥', desert: '鸣沙山 · 月牙泉', jslc: '发射中心', tower: '发射塔', launch: '火箭升空', orbit: '地球轨道', hangar: '鄂州港 · 停泊区', cockpit_p: '武汉 · 指挥中枢', hangar_p: '鄂州港 · 停泊区', cabin_p: '温泉生活区', gym_p: '体能馆', storage_p: '物资仓储', pod_p: '学院部 · 资料室', tea_p: '陆羽茶室 · 04 号舱', teahall: '陆羽茶室 · 大厅', bridge2_p: '编钟通讯站', bridge_p: '古城防卫部', xiaogan: '孝感大厅', paifang: '惟楚有材牌坊', hall: '报告厅', field: '操场', aerial: '校园全景' };
  // 角色（立绘为占位）
  var CAST = {
    p: { name: function () { return acc.name; }, color: '#c42f3a', tall: 1.0 },
    v: { name: function () { return 'Vanber'; }, color: '#2a4ca0', tall: 0.98 },
    z: { name: function () { return '张卫国'; }, color: '#5b5866', tall: 1.0, img: 'zwg' },
    t: { name: function () { return 'Threego'; }, color: '#6f8f2a', tall: 1.0, img: 'threego' },
    y: { name: function () { return '点点'; }, color: '#b0603a', tall: 1.0, img: 'dd' },
    b: { name: function () { return 'Bttp'; }, color: '#7a5a7e', tall: 1.0, img: 'bttp' },
    h: { name: function () { return 'Dr.黄'; }, color: '#a8841f', tall: 1.0, img: 'drh' },
    ai: { name: function () { return '舰载广播'; }, color: '#2a7bd8' },
    mm: { name: function () { return '明明教官'; }, color: '#4a6a8a', tall: 1.0 }
  };
  var SCRIPT = STORY_SCRIPT;   // 剧本内容见 js/data/story.js
  function unlocked(id) { var S = SITES[id], a = S.after; return (!a || prog(a).done) && (!S.need || S.need()); }
  // 稀有精灵：野外精灵表里标了 rare 的种类
  function rareOwned() { var R = []; for (var k in WILD) WILD[k].forEach(function (w) { if (w.rare && R.indexOf(w.sid) < 0) R.push(w.sid); }); return acc.mons.filter(function (m) { return R.indexOf(m.sid) >= 0; })[0] || null; }
  function planetOpen(P) { return !P.after || prog(P.after).done; }
  var UNLOCK = { xiaogan: '竞技对战', academy: '黄冈秘鉴', storage: '商城', tea: '茶室' };
  function homeOpen() { return !!(acc && acc.story && acc.story.tea && acc.story.tea.done); }
  // 茶室里展示的精灵：[{ u, t: 放出来的时间 }]
  function home() {
    if (!acc.home) acc.home = { name: '陆羽茶室', mons: [] };
    acc.home.mons = acc.home.mons.map(function (x) { return typeof x === 'number' ? { u: x, t: Date.now() } : x; }).filter(function (x) { return mon(x.u); });
    return acc.home;
  }
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
  // 剧情里拿到的东西（如 Threego 的封口费），每个存档只给一次
  function storyGive(site, g) {
    var pr = prog(site); if (!pr.gave) pr.gave = {}; if (pr.gave[g.id]) return false;
    pr.gave[g.id] = 1; acc.energy += g.energy || 0; acc.exp += g.exp || 0; giveItems(g.items); save(); if (ready()) renderRes(); return true;
  }
  // 主线奖励调整后，给已读完的旧存档补齐差额（只补一次）
  var OLD_MAIN = { school: { exp: 1000, energy: 500 }, river: { exp: 0, energy: 0 }, jiuquan: { exp: 0, energy: 0 }, board: { exp: 1000, energy: 300 } };
  function backfillMain() {
    var add = { exp: 0, energy: 0 };
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
  function rwList(R) { var a = [R.exp ? '累积经验 ×' + fmt(R.exp) : '', R.energy ? '能量 ×' + fmt(R.energy) : '']; if (R.items) for (var k in R.items) a.push(ITEMS[k].name + ' ×' + R.items[k]); if (R.title) a.push('称号「' + TITLES.filter(function (x) { return x.id === R.title; })[0].n + '」'); if (R.mon) a.push(R.mon); (R.gift || []).forEach(function (g) { a.push(form(g).name + ' LV' + g.lv); }); return a.filter(Boolean); }
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
    if (CAST[k].img) { var src = (face && CHARS[(FACE_KEY[k] || CAST[k].img) + '_' + face]) || CHARS[CAST[k].img]; return '<img class="vn-art" src="' + src + '" alt="" style="height:' + (CAST[k].tall * 100) + '%">'; }
    var c = CAST[k], col = c.color, head = 'M100 18c34 0 52 26 52 58s-20 60-52 60-52-28-52-60 18-58 52-58z', body = 'M40 420c-6-80 -8-150 14-200 14-32 34-50 46-54 12 4 32 22 46 54 22 50 20 120 14 200z';
    return '<svg viewBox="0 0 200 420" aria-hidden="true" style="height:' + (c.tall * 100) + '%"><g stroke="#23222b" stroke-width="4" stroke-linejoin="round">' +
      '<path d="' + body + '" fill="#fbfaf3" fill-opacity=".94"/><path d="' + body + '" fill="' + col + '" fill-opacity=".22" stroke-dasharray="11 7"/>' +
      '<path d="' + head + '" fill="#fbfaf3" fill-opacity=".94"/><path d="' + head + '" fill="' + col + '" fill-opacity=".22" stroke-dasharray="11 7"/></g>' +
      '<text x="100" y="86" text-anchor="middle" font-size="40" fill="' + col + '" font-family="Long Cang, KaiTi, cursive">?</text>' +
      '<text x="100" y="250" text-anchor="middle" font-size="22" fill="#75737e" font-family="-apple-system, PingFang SC, sans-serif">立绘占位</text></svg>';
  }
  function skipStep(st, p) { return (st.only && st.only !== p.ch) || (st.pick && acc.starter) || (st.res && st.res !== (p.bt === 'win' ? 'win' : 'lose')); }
  // 剧情对战的对手配置
  var FIGHTS = {
    threego: { foe: 'Threego', team: [{ sid: 'tagore', lv: 3 }] },
    karo: { foe: '被瘴气污染的野生精灵', team: [{ sid: 'wind', lv: 3, miasma: 5 }], env: 'miasma', bg: 'fl_salt', desc: '被瘴气污染的卡罗（LV3）' }
  };
  function storyMon(m) { var f = form(m), hl = m.u != null ? (m.hl || []) : undefined, mv = m.moves.length ? m.moves.slice() : defaultMoves(m.sid, m.lv, hl); return { id: m.sid, lv: m.lv, moves: mv, nick: f.name, img: f.img, ev: m.ev || null, nat: m.nat || null, u: m.u, hl: hl }; }
  function startFight(key) {
    var F = FIGHTS[key], team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    var p = team.slice(0, TEAM_SIZE).map(storyMon);
    var a = F.team.map(function (x) { var o = storyMon({ sid: x.sid, lv: x.lv, moves: [] }); if (x.miasma) o.miasma = x.miasma; return o; });
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    var host = ex.host; host.hidden = true;
    if (ex.mode === 'replay') $('pg-explore').hidden = true;
    $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: F.foe, items: invCopy(), env: F.env || null, bg: F.bg ? BG[F.bg] : null, onItem: useInv, onEnd: function (res, seen, downs) {
      var got = battleRewards(team.slice(0, TEAM_SIZE), seen, downs);
      dailyHit('pve');
      if (got.length) setTimeout(function () { toast(got.join('')); }, 300);
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
    stopTimers();
    var el = $('pg-explore');
    if (ex.view === 'vn') { renderVN(); return; }
    if (ex.view === 'area') { renderArea(); return; }
    if (ex.view === 'quests') { renderQuests(); return; }
    if (ex.view === 'home') { if (homeOpen()) { renderHome(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'boss') { if (bossOpen(ex.boss)) { renderBoss(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'room') { if (homeOpen()) { renderRoom(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'shop') { if (shopOpen()) { renderShop(); return; } ex.view = 'area'; renderArea(); return; }
    var Pp = ex.view === 'sites' && PLANETS.filter(function (p) { return p.id === ex.planet; })[0];
    var html = exHead(ex.view === 'planets' ? '选择要前往的星球。' : Pp && Pp.ship ? '点击舰上的区域，即可传送过去。' : '选择要前往的地点。');
    if (ex.view === 'planets') {
      html += '<div class="planets">' + PLANETS.filter(planetOpen).map(function (p) {
        var n = p.sites.length, done = p.sites.filter(function (s) { return prog(s).done; }).length, open = planetOpen(p);
        return '<button type="button" class="planet' + (open ? '' : ' locked') + '" data-planet="' + p.id + '"' + (open ? '' : ' disabled') + '><span class="tape l"></span>' + (p.ship ? '<img class="ship-ic" src="' + CHARS.ship_icon + '" alt="">' : planetSvg(p.id)) +
          '<span class="pn">' + p.name + (p.wild ? '<span class="chip ptype">' + p.ptype + '</span>' : '') + '</span><span class="hint">' + p.d + '</span><span class="pc">' + (open ? (p.wild ? '野外区域 ' + regionsOf(p.id).length + ' 个 · 可捕捉野生精灵' : '地点 ' + n + ' 个 · 已完成 ' + done) : '读完「' + SITES[p.after].chapter.split(' · ')[1] + '」后解锁') + '</span></button>';
      }).join('') +
        '<div class="planet locked" aria-disabled="true"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="34" fill="none" stroke="#75737e" stroke-width="3" stroke-dasharray="8 6"/><text x="60" y="72" text-anchor="middle" font-size="34" fill="#75737e" font-family="Long Cang, KaiTi, cursive">?</text></svg>' +
        '<span class="pn">未知星球</span><span class="hint">更多星球敬请期待</span></div></div>';
    } else {
      var P = PLANETS.filter(function (p) { return p.id === ex.planet; })[0];
      html += '<div class="crumb"><button type="button" class="btn ghost" id="ex-back">‹ 返回星球</button><b>' + P.name + '</b></div>';
      if (P.ship) { el.innerHTML = html + shipMap(P); return; }
      if (P.wild) { el.innerHTML = html + (P.id === 'flora' ? floraPage() : wildPage(P)); return; }
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
      (n === '荆门' ? '<button type="button" class="mk shop' + (shopOpen() ? '' : ' locked') + '"' + (shopOpen() ? ' data-shop="1"' : ' disabled') + ' style="left:74%;top:40%"><span class="mk-dot">' + (shopOpen() ? '商' : '锁') + '</span><span class="mk-lab"><b>商城 · 物资兑换</b><small>' + (shopOpen() ? '用能量兑换捕捉装置和补药' : '读完「物资仓储」支线后开放') + '</small></span></button>' : '') +
      (ids.length ? '' : '<p class="area-empty">这里暂时没有剧情。</p>') +
      '<div class="tp-fx" aria-hidden="true"><span>传送至 ' + d[0] + '……</span></div></div>' +
      (ids.length ? '<ul class="area-list">' + rw + '</ul>' : '') + '</div>';
    ex.tp = false;
  }
  function teleport(n) { ex.view = 'area'; ex.area = n; ex.tp = true; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll('荆楚号 · ' + DEPTS[n][0]); }
  function planetSvg(id) {
    if (id === 'flora') return floraSvg(120);
    var P = planetOf(id); if (P && P.color) return planetSvgC(P, 120);
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="36" fill="#cfe0f2" stroke="#23222b" stroke-width="3"/>' +
      '<path d="M36 44c8-6 16-4 20 2s12 4 14 10-6 12-14 12-6 10-14 10-14-8-12-16 0-14 6-18z M74 30c6 2 10 8 8 12s-8 2-10-2 0-10 2-10z M78 66c8-2 14 4 12 10s-10 8-14 4-4-12 2-14z" fill="#9cc79a" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="60" cy="60" rx="54" ry="14" fill="none" stroke="#c42f3a" stroke-width="2.5" stroke-dasharray="6 5" transform="rotate(-16 60 60)"/></svg>';
  }
  /* ---------- 芙罗拉星：挑战（关卡副本，未开放）+ 捕捉（随机野生精灵） ---------- */
  var WILD = WILD_POOLS, REGIONS = regionsOf('flora');   // 野外精灵表见 js/data/wild.js
  // 其他星球的示意图（立绘待补）：按星球主色画一个带纹路的圆
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
    var bgc = { forest: '#cfe5c4', grass: '#e4f1cf', salt: '#efece4', kb_sea: '#cfe8f6', pp_lava: '#f4d1b8', lt_belt: '#2e3142', wh_snow: '#eef6fb' }[id], g = '';
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
    var pot = ['pot1', 'pot2'].map(function (k) { return ITEMS[k].name + ' ×' + (acc.items[k] || 0); }).join('　');
    return '<div class="inv"><span><b>捕捉装置</b>　' + cap + '</span><span><b>补药</b>　' + pot + '</span>' +
      (shopOpen() ? '<button type="button" class="btn" data-goshop="1">去物资仓储兑换</button>' : '<span class="hint">在荆楚号 · 荆门 · 物资仓储读完支线后开放商城</span>') + '</div>';
  }
  function floraPage() {
    var part = ex.fpart || 'catch';
    var head = '<div class="flora-hero"><span class="tape l"></span>' + floraSvg(150) + '<div><h3>芙罗拉星 <span class="chip ptype">草系星球</span></h3><p class="hint">地表分为丛林、草甸、盐碱地三片区域。星球立绘还在绘制中，这里先用示意图。</p>' +
      '<div class="fparts" role="tablist"><button type="button" role="tab" class="tab' + (part === 'challenge' ? ' on' : '') + '" data-fpart="challenge" aria-selected="' + (part === 'challenge') + '">挑战</button><button type="button" role="tab" class="tab' + (part === 'catch' ? ' on' : '') + '" data-fpart="catch" aria-selected="' + (part === 'catch') + '">捕捉</button>' + taskTab('flora', part) + '</div></div></div>';
    var sp = PLANETS.filter(function (p) { return p.id === 'flora'; })[0].sites.map(function (id) {
      var S = SITES[id], pr = prog(id), started = pr.at > 0 && !pr.done;
      return '<article class="site fl-story"><span class="tape r"></span><div class="site-img"><img src="' + BG[S.bg] + '" alt=""></div><div class="site-txt"><span class="sc-tag">' + S.chapter + '</span><h3>' + S.name + '</h3><p class="hint">' + S.d + '</p>' +
        (S.reward ? '<p class="hint">首次读完奖励：' + rwList(S.reward).join('、') + (pr.rewarded ? '（已领取）' : '') + '</p>' : '') +
        '<p class="site-st ' + (pr.done ? 'blue' : started ? 'red' : '') + '">' + (pr.done ? '已读完' : started ? '读到一半' : '未读') + '</p><div class="site-act">' +
        (started ? '<button type="button" class="btn primary" data-go="' + id + '" data-from="cont">继续剧情</button><button type="button" class="btn" data-go="' + id + '" data-from="0">从头开始</button>' : '<button type="button" class="btn primary" data-go="' + id + '" data-from="0">' + (pr.done ? '重温剧情' : '进入') + '</button>') + '</div></div></article>';
    }).join('');
    head = head + (prog('flora1').done ? '' : sp);
    if (prog('flora1').done) head = head.replace('<div class="fparts" role="tablist">', '<div class="fparts" role="tablist"><button type="button" class="tab' + (part === 'story' ? ' on' : '') + '" data-fpart="story">剧情</button>');
    if (part === 'story') return head + sp;
    if (part === 'task') return head + planetTasks('flora');
    if (part === 'challenge') return head + '<div class="fl-soon"><span class="tape r"></span><b>挑战 · 关卡副本</b><p>按关卡推进的副本，每一关都会根据表现给出星级评价。</p><p class="stars3" aria-hidden="true">☆ ☆ ☆</p><p class="hint">即将开放，敬请期待。</p></div>';
    var regs = REGIONS.map(function (R) {
      var locked = !!R.boss;
      return '<article class="region' + (locked ? ' locked' : '') + '"><div class="rg-art">' + (R.bgs && BG[R.bgs[0]] ? '<img src="' + BG[R.bgs[0]] + '" alt="' + R.name + '">' + (R.bgs.length > 1 ? '<span class="rg-more">' + R.bgs.slice(1).map(function (k) { return '<img src="' + BG[k] + '" alt="">'; }).join('') + '</span>' : '') : regionArt(R.id)) + '</div><div class="rg-txt"><h4>' + R.name + ' <small>' + R.en + '</small></h4><p class="hint">' + R.d + '</p>' +
        (locked ? '<p class="rg-boss">首领 · ' + R.boss + '　<span>暂未开放</span></p>' : prog('flora1').done ? '<button type="button" class="btn primary" data-wild="' + R.id + '">寻找野生精灵</button>' : '<button type="button" class="btn" disabled>读完主线「降临芙罗拉」后开放</button>') + '</div></article>';
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
    return head + invLine() + '<div class="regions">' + regs + '</div>' +
      '<div class="wild-list"><h4>芙罗拉星的野生精灵</h4><ul>' + list + '</ul><p class="hint">在丛林或草甸点「寻找野生精灵」，就会随机遇到一只并直接开战。对战中可以在「道具」页使用捕捉装置和补药，使用道具会占用一回合；把它打虚弱、或让它陷入异常状态，更容易捕捉成功。打倒野生精灵会获得经验（对方等级越高越多）：70% 平分给出战过的精灵，30% 放进经验背包；同时出战过的精灵获得学习力（对方 LV1–25 得 1 点，LV26–50 得 2 点，LV51–100 得 3 点）。捕捉不算击败，没有经验和学习力。</p></div>';
  }
  function invCopy() { var o = {}; ITEM_ORDER.forEach(function (k) { o[k] = acc.items[k] || 0; }); return o; }
  function useInv(k) { acc.items[k] = Math.max(0, (acc.items[k] || 0) - 1); save(); }
  // 击败一只精灵：经验 = 等级² × 2 + 20；学习力按对方等级 1 / 2 / 3 点
  function foeExp(lv) { return lv * lv * 2 + 20; }
  function foeEv(lv) { return lv <= 25 ? 1 : lv <= 50 ? 2 : 3; }
  function battleRewards(team, seen, downs) {
    downs = downs || []; if (!downs.length) return [];
    var parts = team.filter(function (x, i) { return seen && seen[i]; }); if (!parts.length) parts = team.slice(0, 1);
    var xp = 0, ev = 0; downs.forEach(function (d) { xp += foeExp(d.lv); ev += foeEv(d.lv); });
    var share = Math.floor(xp * 0.7 / parts.length), pool = xp - share * parts.length, out = [];
    acc.exp = (acc.exp || 0) + pool;
    out.push('击败了 ' + downs.length + ' 只精灵，共获得 ' + fmt(xp) + ' 点经验：');
    var lines = parts.map(function (m) { return gainExp(m, share); }).filter(Boolean);
    out.push(lines.join(''));
    out.push('经验背包 +' + fmt(pool) + '。');
    var got = giveEv(parts.map(function (x) { return x.u; }), ev);
    if (got.length) out.push(got.join('、') + (got.length > 1 ? ' 各' : ' ') + '获得 ' + ev + ' 点学习力。');
    save(); return out;
  }
  function rollWild(pool) {
    var P = WILD[pool], tot = P.reduce(function (a, w) { return a + w.w; }, 0), r = Math.random() * tot, w = P[0];
    for (var i = 0; i < P.length; i++) { r -= P[i].w; if (r < 0) { w = P[i]; break; } }
    return { w: w, lv: w.lv[0] + Math.floor(Math.random() * (w.lv[1] - w.lv[0] + 1)) };
  }
  function regionOpen(R) { return R.planet === 'flora' ? prog('flora1').done : planetOpen(planetOf(R.planet)); }
  function startWild(rid) {
    var R = WILD_REGIONS.filter(function (x) { return x.id === rid; })[0]; if (!R || R.boss || !regionOpen(R)) return;
    var hit = rollWild(R.pool), P = planetOf(R.planet), o = { sid: hit.w.sid, lv: hit.lv, rate: hit.w.rate, bg: R.bgs ? BG[R.bgs[Math.floor(Math.random() * R.bgs.length)]] : null, back: P.name, where: P.name + ' · ' + R.name };
    if (R.planet === 'flora' && purgeActive() && Math.random() < PURGE.chance) { o.taint = true; o.miasma = 5; o.noCatch = true; o.foe = '被瘴气污染的野生精灵'; o.where += ' · 瘴气精灵'; }
    startWildBattle(o);
  }
  function startWildBattle(o) {
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon), a = [storyMon({ sid: o.sid, lv: o.lv, moves: [] })];
    if (o.taint) { a[0].miasma = o.miasma; a[0].nick = '被污染的' + a[0].nick; }
    seeMon(o.sid, o.lv);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: o.foe || '野生精灵', items: invCopy(), bg: o.bg || null,
      wild: { rate: o.rate, back: o.back, where: o.where, noCatch: !!o.noCatch },
      onItem: useInv,
      onEnd: function (res, seen, downs) {
        var msg = [];
        if (res === 'caught') {
          var m = newMon(o.sid, o.lv), T = acc.teams[acc.active], added = T.length < TEAM_SIZE;
          if (added) T.push(m.u);
          msg.push('捕捉到了 ' + form(m).name + '（LV' + o.lv + '，' + m.nat + '）！' + (added ? '已加入' + TEAM_NAME[acc.active] + '。' : '已收入精灵仓库。'));
          dailyHit('catch');
        }
        if (downs && downs.length) { if (!acc.stats) acc.stats = {}; acc.stats.wildWins = (acc.stats.wildWins || 0) + downs.length; dailyHit('wildWin', downs.length); }
        if (o.taint && downs && downs.length) msg = msg.concat(purgeHit());
        dailyHit('pve');
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
        if (msg.length) setTimeout(function () { toast(msg.join('')); }, 300);
      } });
  }
  // 其他星球的探索页（只有捕捉）
  function wildPage(P) {
    var regs = regionsOf(P.id);
    var part = ex.fpart === 'task' ? 'task' : 'catch';
    var head = '<div class="flora-hero"><span class="tape l"></span>' + planetSvgC(P, 150) + '<div><h3 style="color:' + P.color[1] + '">' + P.name + ' <span class="chip ptype">' + P.ptype + '</span></h3><p class="hint">' + P.d + '星球立绘还在绘制中，这里先用示意图。</p>' +
      '<div class="fparts" role="tablist"><button type="button" role="tab" class="tab' + (part === 'catch' ? ' on' : '') + '" data-fpart="catch" aria-selected="' + (part === 'catch') + '">捕捉</button>' + taskTab(P.id, part) + '</div></div></div>';
    if (part === 'task') return head + planetTasks(P.id);
    var cards = regs.map(function (R) {
      return '<article class="region"><div class="rg-art">' + regionArt(R.id) + '</div><div class="rg-txt"><h4>' + R.name + ' <small>' + R.en + '</small></h4><p class="hint">' + R.d + '</p>' +
        '<button type="button" class="btn primary" data-wild="' + R.id + '">寻找野生精灵</button></div></article>';
    }).join('');
    var list = [];
    regs.forEach(function (R) { (WILD[R.pool] || []).forEach(function (w) {
      var k = wildKnown(w.sid), f = form({ sid: w.sid, lv: w.lv[0] }), sid_ = w.sid;
      list.push('<li class="wl ' + (k || 'unk') + '">' + (k ? '<img src="' + f.img + '" alt="">' : silTag(sid_, f.stage)) + '<span><b>' + (k ? esc(f.name) : '？？？') + '</b>' + (w.rare ? '<span class="chip rare">稀有</span>' : '') +
        '<small>LV' + (w.lv[0] === w.lv[1] ? w.lv[0] + '（固定）' : w.lv[0] + '–' + w.lv[1]) + ' · 捕捉率' + w.tag + '</small><small>出现：' + R.name + ' ' + w.w + '%</small>' +
        '<small class="wk">' + (k === 'own' ? '已捕捉' : k === 'seen' ? '见过 · 未捕捉' : '未遇见') + '</small></span></li>');
    }); });
    return head + invLine() + '<div class="regions">' + cards + '</div>' +
      '<div class="wild-list"><h4>' + P.name + '的野生精灵</h4><ul>' + list.join('') + '</ul><p class="hint">点「寻找野生精灵」会随机遇到一只并直接开战。捕捉、经验和学习力的规则和芙罗拉星一样。</p></div>';
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
  function planetTaskList(pid) { return pid === 'flora' ? ['purge'] : []; }
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
      '<p class="hint">' + (done ? '任务已完成，芙罗拉星不会再出现瘴气精灵。' : open ? '在芙罗拉星的丛林、草甸作战时，有 10% 的概率遇到瘴气精灵。它们自带 5 层瘴气，无法捕捉，只能击败。' : '读完主线「降临芙罗拉」后开始。') + '</p>' +
      '<div class="pt-bar"><i style="width:' + Math.min(100, P.n / PURGE.goal * 100) + '%"></i><em>已祛除 ' + Math.min(P.n, PURGE.goal) + ' / ' + PURGE.goal + '</em></div>' +
      '<ol class="pt-steps">' + steps + '</ol>' +
      (open && !done ? '<p class="hint">去「捕捉」页的丛林或草甸作战即可。</p><button type="button" class="btn primary" data-fpart="catch">去丛林 / 草甸</button>' : '') + '</article>';
  }

  /* ---------- 神秘精灵：每天 16:00–24:00，切换场景时有 3% 概率出现（真身是 LV10 幽灵鱼） ---------- */
  var MYSTERY = { sid: 'hauris', lv: 10, rate: 0.4, chance: 0.03, from: 16, to: 24 };
  function mysteryTime() { var h = new Date().getHours(); return h >= MYSTERY.from && h < MYSTERY.to; }
  function mysteryRoll(where) {
    if (!ready() || ex.fighting || !mysteryTime() || $('mys')) return;
    if (Math.random() >= MYSTERY.chance) return;
    var d = document.createElement('div'); d.id = 'mys'; d.className = 'mys'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', '神秘精灵');
    d.dataset.where = where || '星际探索';
    d.innerHTML = '<div class="mys-box"><span class="tape l"></span><div class="mys-art"><img src="' + form({ sid: MYSTERY.sid, lv: MYSTERY.lv }).img + '" alt=""></div><b>神秘精灵出现了！</b><p>一团忽明忽暗的影子从' + esc(d.dataset.where) + '的角落里飘了出来，正盯着你看。</p>' +
      '<div class="row"><button type="button" class="btn primary" data-mys="go">迎战</button><button type="button" class="btn" data-mys="no">放它离开</button></div></div>';
    document.body.appendChild(d);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mys]'); if (!b) return;
    var d = $('mys'), where = d ? d.dataset.where : '星际探索'; if (d) d.remove();
    if (b.dataset.mys === 'go') startWildBattle({ sid: MYSTERY.sid, lv: MYSTERY.lv, rate: MYSTERY.rate, back: where, where: '神秘精灵 · ' + where, foe: '神秘精灵' });
    else toast('神秘的影子一闪，消失不见了。');
  });

  /* ---------- 排位赛季奖励：首次达到每个段位各奖励一次，达到铂金送 LV10 小月亮 ---------- */
  var SEASON = 'S1';
  var RANK_RW = [null, { exp: 500, energy: 200 }, { exp: 1000, energy: 300 }, { exp: 1500, energy: 400 }, { exp: 2000, energy: 500, gift: [{ sid: 'moon', lv: 10 }] },
    { exp: 2500, energy: 600 }, { exp: 3000, energy: 700 }, { exp: 3500, energy: 800 }, { exp: 4000, energy: 900 }, { exp: 4500, energy: 1000 }, { exp: 5000, energy: 1200 }];
  function rankBest() { try { var r = JSON.parse(localStorage.getItem('hs-rank-v1') || 'null'); return r ? Math.max(r.best || 0, r.r || 0) : 0; } catch (e) { return 0; } }
  function rankRec() { if (!acc.rankRw || acc.rankRw.season !== SEASON) acc.rankRw = { season: SEASON, got: {} }; return acc.rankRw; }
  function checkRankRewards() {
    if (!ready()) return;
    var rec = rankRec(), best = rankBest(), msg = [];
    for (var r = 1; r <= best && r < RANK_RW.length; r++) if (!rec.got[r]) {
      var R = RANK_RW[r]; rec.got[r] = Date.now();
      acc.exp += R.exp; acc.energy += R.energy;
      var line = '首次达到' + RANKS[r] + '段位：累积经验 +' + fmt(R.exp) + '，能量 +' + fmt(R.energy);
      (R.gift || []).forEach(function (g) { var m = newMon(g.sid, g.lv), T = acc.teams[acc.active]; if (T.length < TEAM_SIZE) T.push(m.u); line += '，并获得了 ' + form(m).name + ' LV' + g.lv + '！'; });
      msg.push(line + '。');
    }
    if (msg.length) { save(); renderRes(); setTimeout(function () { toast('排位赛季奖励 · ' + msg.join('')); }, 500); }
  }

  /* ---------- 每日任务：每天 0:00 刷新，必定包含 3 个竞技对战任务 ---------- */
  var DAILY = {
    ar_play3: { t: '完成 3 场竞技对战（沙盒或实战都算）', kind: 'arena', n: 3, rw: { exp: 300, energy: 100 }, arena: 1 },
    ar_rank2: { t: '完成 2 场实战', kind: 'rankPlay', n: 2, rw: { exp: 400, energy: 120 }, arena: 1 },
    ar_win1: { t: '在实战中获胜 1 场', kind: 'rankWin', n: 1, rw: { exp: 500, energy: 150 }, arena: 1 },
    ar_sand1: { t: '在沙盒模式完成 1 场对战', kind: 'sandbox', n: 1, rw: { exp: 200, energy: 80 }, arena: 1 },
    wd_win5: { t: '击败 5 只野生精灵', kind: 'wildWin', n: 5, rw: { exp: 400, energy: 120 }, need: function () { return prog('flora1').done; } },
    wd_catch1: { t: '捕捉 1 只野生精灵', kind: 'catch', n: 1, rw: { exp: 300, energy: 150 }, need: function () { return prog('flora1').done; } },
    bs_1: { t: '挑战 1 次首领（胜负都算）', kind: 'boss', n: 1, rw: { exp: 300, energy: 100 }, need: function () { return bossOpen('tiger'); } },
    hm_1: { t: '从茶室收回 1 只展示满 1 小时的精灵', kind: 'home', n: 1, rw: { exp: 300, energy: 100 }, need: function () { return homeOpen(); } },
    pve_2: { t: '完成 2 场剧情、野外或首领对战', kind: 'pve', n: 2, rw: { exp: 300, energy: 100 } }
  };
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function seededRng(str) { var x = 7; for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 2147483647; return function () { x = (x * 48271) % 2147483647; return x / 2147483647; }; }
  function pickN(list, n, rnd) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }
  function daily() {
    if (!ready()) return null;
    var k = todayKey();
    if (!acc.daily || acc.daily.date !== k) {
      var rnd = seededRng(k + acc.name), ids = Object.keys(DAILY);
      var ar = ids.filter(function (id) { return DAILY[id].arena; });
      var other = ids.filter(function (id) { return !DAILY[id].arena && id !== 'pve_2' && (!DAILY[id].need || DAILY[id].need()); });
      var pick = pickN(ar, 3, rnd).concat(pickN(other, 2, rnd));
      while (pick.length < 5) pick.push('pve_2');
      acc.daily = { date: k, list: pick.slice(0, 5).map(function (id) { return { id: id, p: 0, c: 0 }; }) };
      save();
    }
    return acc.daily;
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
    if (type !== 'arena') return;
    dailyHit('arena');
    if (d.rank) { dailyHit('rankPlay'); if (d.result === 'win') dailyHit('rankWin'); } else dailyHit('sandbox');
  };
  function dailyHTML() {
    var D = daily(); if (!D) return '';
    return '<ul class="daily">' + D.list.map(function (t, i) {
      var d = DAILY[t.id], ok = t.p >= d.n, lock = d.arena && !arenaOpen();
      return '<li class="dl' + (t.c ? ' done' : ok ? ' ok' : '') + '">' + (d.arena ? '<span class="chip dl-tag">竞技</span>' : '<span class="chip dl-tag ex">探索</span>') +
        '<span class="dl-t"><b>' + esc(d.t) + '</b><small>奖励：累积经验 ×' + fmt(d.rw.exp) + '、能量 ×' + fmt(d.rw.energy) + (lock ? ' · 完成孝感大厅支线后才能进行竞技对战' : '') + '</small></span>' +
        '<span class="dl-p"><i style="width:' + Math.round(t.p / d.n * 100) + '%"></i><em>' + t.p + ' / ' + d.n + '</em></span>' +
        (t.c ? '<span class="dl-st">已领取</span>' : ok ? '<button type="button" class="btn primary" data-dclaim="' + i + '">领取</button>' : '<span class="dl-st">进行中</span>') + '</li>';
    }).join('') + '</ul><p class="hint">每天 0:00 刷新。每天必定有 3 个竞技对战任务，另外 2 个从探索类任务里抽取。</p>';
  }

  /* ---------- 航行日志：活动、每日任务、排位奖励、下期预告 ---------- */
  function renderLog() {
    var now = new Date(), h = now.getHours(), on = mysteryTime();
    var wait = on ? '' : (function () { var t = new Date(now); t.setHours(MYSTERY.from, 0, 0, 0); var m = Math.max(0, Math.round((t - now) / 60000)); return '距离今天的活动开始还有 ' + Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分钟'; })();
    var best = rankBest(), rec = rankRec();
    var rows = RANK_RW.map(function (R, r) {
      if (!R) return '';
      var got = rec.got[r];
      return '<tr class="' + (got ? 'got' : r <= best ? 'ok' : '') + (R.gift ? ' big' : '') + '"><td>' + RANKS[r] + '</td><td>累积经验 ×' + fmt(R.exp) + '，能量 ×' + fmt(R.energy) + (R.gift ? '，<b class="red">' + R.gift.map(function (g) { return form(g).name + ' LV' + g.lv; }).join('、') + '</b>' : '') + '</td><td>' + (got ? '已领取' : '未达成') + '</td></tr>';
    }).join('');
    $('pg-log').innerHTML = '<div class="page-head"><h2 class="sec">航行日志</h2><p class="hint">荆楚号的公告板：限时活动、每日任务、排位奖励和下期预告。</p></div>' +
      '<div class="log-grid">' +
      '<article class="log-card ev"><span class="tape l"></span><span class="chip log-tag">限时活动</span><h3>神秘精灵出没</h3>' +
        '<p>每天 <b>16:00–24:00</b>，在星际探索的任何场景，都有 <b>3%</b> 的概率刷出一只神秘精灵！</p><p class="hint">它是什么？只有遇到过的人才知道。</p>' +
        '<p class="log-st ' + (on ? 'on' : '') + '">' + (on ? '活动进行中，今天 24:00 结束' : wait) + '</p></article>' +
      '<article class="log-card next"><span class="tape r"></span><span class="chip log-tag">下期预告</span><h3>草系首领「荒芜」即将登场</h3>' +
        '<div class="next-art"><img src="' + SPRITES.barren + '" alt=""></div><p>芙罗拉星盐碱地深处的瘴气，似乎和它有关……</p><p class="hint">剧情正在推进中，敬请期待。</p></article>' +
      '<article class="log-card wide"><span class="tape l"></span><span class="chip log-tag">每日任务</span><h3>今天的任务</h3>' + dailyHTML() + '</article>' +
      '<article class="log-card wide"><span class="tape r"></span><span class="chip log-tag">排位赛季 ' + SEASON + '</span><h3>首次达到段位的奖励</h3>' +
        '<p>本赛季最高段位：<b>' + RANKS[best] + '</b>。每个段位第一次达到时发放一次；<b>达到铂金送 LV10 的' + form({ sid: 'moon', lv: 10 }).name + '</b>。</p>' +
        '<table class="rank-rw"><thead><tr><th>段位</th><th>奖励</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        (arenaOpen() ? '<button type="button" class="btn" data-golog="arena">去竞技对战</button>' : '<p class="hint">完成荆楚号 · 孝感大厅的支线后开放竞技对战。</p>') + '</article>' +
      '</div>';
  }
  $('pg-log').addEventListener('click', function (e) {
    var c = e.target.closest('[data-dclaim]'); if (c) { claimDaily(+c.dataset.dclaim); renderLog(); return; }
    var g = e.target.closest('[data-golog]'); if (g) { go(g.dataset.golog); }
  });

  /* ---------- 首领：常驻在舰上部门里，可反复挑战 ---------- */
  var BOSSES = {
    tiger: { name: '泰戈尔', sid: 'tagore', lv: 25, hp: 500, only: ['水', '火', '草'], diff: '简单', dept: '襄阳', bg: 'bridge_p', story: 'tiger', pos: [66, 52],
      d: '从东北招募的特殊虎系精灵，常驻古城防卫部，辅助乘员们训练。', reward: { sid: 'tagore', lv: 10 } }
  };
  function bossOpen(k) { var B = BOSSES[k]; return !!(B && prog(B.story).done); }
  function bossWon(k) { return !!(acc.bosses && acc.bosses[k] && acc.bosses[k].wins > 0); }
  function bossSpots(n) {
    return Object.keys(BOSSES).filter(function (k) { return BOSSES[k].dept === n; }).map(function (k) {
      var B = BOSSES[k], open = bossOpen(k);
      return '<button type="button" class="mk shop boss' + (open ? '' : ' locked') + '"' + (open ? ' data-boss="' + k + '"' : ' disabled') + ' style="left:' + B.pos[0] + '%;top:' + B.pos[1] + '%"><span class="mk-dot">' + (open ? '首' : '锁') + '</span><span class="mk-lab"><b>首领 · ' + B.name + '</b><small>' + (open ? B.diff + ' · LV' + B.lv + (bossWon(k) ? ' · 已击败' : '') : '读完「' + SITES[B.story].chapter.split(' · ')[1] + '」后开放') + '</small></span></button>';
    }).join('');
  }
  function renderBoss() {
    var k = ex.boss, B = BOSSES[k], rec = (acc.bosses && acc.bosses[k]) || {}, rf = form({ sid: B.reward.sid, lv: B.reward.lv });
    $('pg-explore').innerHTML = exHead('舰上部门里常驻的首领，可以反复挑战。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="boss-back">‹ 返回' + DEPTS[B.dept][0] + '</button><b>首领 · ' + B.name + '</b></div>' +
      '<article class="boss-card"><span class="tape l"></span><div class="boss-art"><img src="' + BG[B.bg] + '" alt="" class="boss-bg"><img src="' + SPRITES[B.sid] + '" alt="' + B.name + '" class="boss-mon"></div>' +
      '<div class="boss-txt"><span class="chip boss-diff">' + B.diff + '难度</span><h3>' + B.name + '</h3><p class="hint">' + esc(B.d) + '</p>' +
      '<ul class="boss-rules"><li><b>等级</b>LV' + B.lv + '</li><li><b>体力</b>' + B.hp + '</li><li><b>特殊</b>只有' + B.only.join('、') + '系技能才能命中它</li>' +
      '<li><b>奖励</b>' + (rec.wins ? '已领取（首次击败获得 ' + esc(rf.name) + ' LV' + B.reward.lv + '）；再次击败只获得经验和学习力' : '首次击败获得 ' + esc(rf.name) + ' LV' + B.reward.lv + '，另有经验和学习力') + '</li>' +
      '<li><b>战绩</b>' + (rec.wins || 0) + ' 胜 / ' + (rec.tries || 0) + ' 次挑战</li></ul>' +
      '<p class="hint">会使用你当前的出战配队（' + TEAM_NAME[acc.active] + '）。记得带上会水、火、草系技能的精灵。</p>' +
      '<button type="button" class="btn primary" data-bossgo="' + k + '">开始挑战</button></div></article>';
  }
  function startBoss(k) {
    var B = BOSSES[k]; if (!bossOpen(k)) return;
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon);
    var a = [{ id: B.sid, lv: B.lv, moves: defaultMoves(B.sid, B.lv), nick: B.name, img: SPRITES[B.sid], maxhp: B.hp, onlyHit: B.only }];
    seeMon(B.sid, B.lv);
    if (!acc.bosses) acc.bosses = {}; if (!acc.bosses[k]) acc.bosses[k] = { wins: 0, tries: 0 };
    acc.bosses[k].tries++; save();
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: '首领', items: invCopy(), onItem: useInv, bg: BG[B.bg], back: DEPTS[B.dept][0],
      onEnd: function (res, seen, downs) {
        var msg = [], rec = acc.bosses[k];
        dailyHit('boss'); dailyHit('pve');
        if (res === 'win') {
          var first = !rec.wins; rec.wins++;
          msg.push('击败了首领「' + B.name + '」！');
          if (first) {
            var m = newMon(B.reward.sid, B.reward.lv), T = acc.teams[acc.active], added = T.length < TEAM_SIZE;
            if (added) T.push(m.u);
            msg.push('获得了 ' + form(m).name + '（LV' + B.reward.lv + '，' + m.nat + '）！' + (added ? '已加入' + TEAM_NAME[acc.active] + '。' : '已收入精灵仓库。'));
          }
        }
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'boss'; ex.boss = k;
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
        if (msg.length) setTimeout(function () { toast(msg.join('')); }, 300);
      } });
  }

  /* ---------- 商城：荆门 · 物资仓储 ---------- */
  var shopQty = {};
  function renderShop() {
    var grp = [['捕捉装置', ['cap1', 'cap2', 'cap3']], ['体力补药', ['pot1', 'pot2']]];
    $('pg-explore').innerHTML = exHead('荆楚号 · 荆门物资仓储的商城。用能量兑换探索道具，道具在剧情对战和野外对战的「道具」页使用。道具图目前是占位图。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ex-area">‹ 返回物资仓储</button><b>物资仓储 · 商城</b></div>' +
      '<div class="shop-bal"><span class="tape l"></span>当前能量 <b>' + fmt(acc.energy) + '</b></div>' +
      grp.map(function (g) {
        return '<h3 class="shop-h">' + g[0] + '</h3><div class="shop-grid">' + g[1].map(function (k) {
          var it = ITEMS[k], q = shopQty[k] || 1, cost = it.price * q, ok = acc.energy >= cost;
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
    var k = b.dataset.buy, n = shopQty[k] || 1, cost = ITEMS[k].price * n;
    if (acc.energy < cost) return true;
    acc.energy -= cost; acc.items[k] = (acc.items[k] || 0) + n; shopQty[k] = 1; save();
    renderRes(); renderShop(); toast('兑换成功：' + ITEMS[k].name + ' ×' + n + '，消耗 ' + fmt(cost) + ' 能量。');
    return true;
  }

  /* ---------- 茶室（家园）：自定义名字，安排精灵在舱里休息 ---------- */
  var HOME_MAX = 3, HOME_POS = [[20, 88], [47, 84], [73, 70]], HOME_CAP_H = 24;
  // 展示经验：每小时 30 + LV × 6 点，按分钟累计，最多累计 24 小时（离线也照样计时）
  function homeRate(m) { return 30 + m.lv * 6; }
  function homeMins(x) { return Math.max(0, Math.min(HOME_CAP_H * 60, Math.floor((Date.now() - x.t) / 60000))); }
  function homeExp(x) { var m = mon(x.u); return m ? Math.floor(homeMins(x) * homeRate(m) / 60) : 0; }
  function durText(min) { var h = Math.floor(min / 60), mm = min % 60; return (h ? h + ' 小时 ' : '') + mm + ' 分钟'; }
  function homeTag(x) { var m = mon(x.u), f = form(m), min = homeMins(x); return esc(f.name) + ' · LV' + m.lv + '<small>已展示 ' + durText(min) + (min >= HOME_CAP_H * 60 ? '（已满）' : '') + ' · 经验 +' + fmt(homeExp(x)) + '</small>'; }
  function renderHome() {
    var H = home();
    clearInterval(ex.homeTick);
    ex.homeTick = setInterval(function () {
      if (ex.view !== 'home' || !document.querySelector('.home-room')) { clearInterval(ex.homeTick); return; }
      H.mons.forEach(function (x, i) { var t = document.querySelector('[data-htag="' + i + '"]'); if (t) t.innerHTML = homeTag(x); });
    }, 20000);
    var figs = H.mons.map(function (x, i) {
      var m = mon(x.u), f = form(m), p = HOME_POS[i];
      return '<div class="hm-fig" style="left:' + p[0] + '%;top:' + p[1] + '%"><button type="button" class="hm-poke" data-hpoke="1" aria-label="摸摸' + esc(f.name) + '"><img src="' + f.img + '" alt=""></button><span class="hm-tag" data-htag="' + i + '">' + homeTag(x) + '</span></div>';
    }).join('');
    var title = ex.homeEdit
      ? '<form class="home-edit" onsubmit="return false"><input id="home-name" maxlength="10" value="' + esc(H.name) + '" aria-label="茶室名字"><button type="button" class="btn primary" id="home-ok">保存</button><button type="button" class="btn ghost" id="home-cancel">取消</button><span class="hint">最多 10 个字</span></form>'
      : '<b class="home-name">' + esc(H.name) + '</b><button type="button" class="btn ghost" id="home-rn">改名</button>';
    var ins = H.mons.map(function (x) { return x.u; });
    var cards = acc.mons.map(function (m) {
      var on = ins.indexOf(m.u) >= 0, f = form(m), full = !on && H.mons.length >= HOME_MAX, x = on ? H.mons[ins.indexOf(m.u)] : null;
      return '<button type="button" class="card hm-card' + (on ? ' on' : '') + '" data-hm="' + m.u + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + on + '"><img src="' + f.img + '" alt=""><span class="nm">' + esc(f.name) + '</span><span class="meta">LV' + m.lv + (on ? ' · 展示中，点击收回' : ' · 每小时 ' + homeRate(m) + ' 经验') + '</span></button>';
    }).join('');
    $('pg-explore').innerHTML = exHead('你在荆楚号上的休息舱。放精灵出来展示，收回时会按等级和展示时长获得经验，离开游戏也会照常计时。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="home-back">‹ 返回大厅</button>' + title + '</div>' +
      '<div class="home-room"><img class="home-bg" src="' + BG.tea_p + '" alt="' + esc(H.name) + '">' + figs +
      (H.mons.length ? '' : '<p class="home-empty">茶室里空荡荡的。从下面选几只精灵，放出来展示吧。</p>') + '</div>' +
      '<div class="home-pick"><h4>展示的精灵 <span class="hint">' + H.mons.length + ' / ' + HOME_MAX + ' · 每小时经验 = 30 + 等级 × 6，最多累计 ' + HOME_CAP_H + ' 小时 · 点击卡片放出或收回，点茶室里的精灵可以摸摸它</span></h4><div class="hm-grid">' + cards + '</div></div>';
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
    return ROOMS.map(function (R) {
      var me = R.k === 'me', label = me ? (open ? '我的房间 · ' + esc(home().name) : '我的房间') : R.n;
      return '<button type="button" class="mk shop home' + (me ? '' : ' fr') + (open ? '' : ' locked') + '"' + (open ? (me ? ' data-home="1"' : ' data-room="' + R.k + '"') : ' disabled') + ' style="left:' + R.pos[0] + '%;top:' + R.pos[1] + '%"><span class="mk-dot">' + (open ? (me ? '家' : '门') : '锁') + '</span><span class="mk-lab"><b>' + label + '</b><small>' + (open ? (me ? '你的休息舱（家园）' : '点击拜访') : '读完「陆羽茶室」支线后开放') + '</small></span></button>';
    }).join('');
  }
  // Threego 房间里固定展示：LV8 小胖虎 + LV7 的「被玩家主宠克制的那只初始精灵」
  function weakStarter() {
    var my = acc.starter && SPMAP[acc.starter].types[0];
    return STARTERS.filter(function (sid) { return sid !== acc.starter && my && eff(my, SPMAP[sid].types[0]) > 1; })[0] || STARTERS.filter(function (sid) { return sid !== acc.starter; })[0];
  }
  function roomShow(k) { return k === 't' ? [{ sid: 'tagore', lv: 8 }, { sid: weakStarter(), lv: 7 }] : []; }
  function renderRoom() {
    var R = ROOMS.filter(function (x) { return x.k === ex.room; })[0], list = roomShow(R.k);
    var figs = list.map(function (x, i) {
      var f = form(x), p = HOME_POS[i];
      return '<div class="hm-fig" style="left:' + p[0] + '%;top:' + p[1] + '%"><button type="button" class="hm-poke" data-hpoke="1" aria-label="摸摸' + esc(f.name) + '"><img src="' + f.img + '" alt=""></button><span class="hm-tag">' + esc(f.name) + ' · LV' + x.lv + '</span></div>';
    }).join('');
    $('pg-explore').innerHTML = exHead('朋友们的房间暂时都长得一样。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="home-back">‹ 返回大厅</button><b class="home-name">' + R.n + '</b></div>' +
      '<div class="home-room"><img class="home-bg" src="' + BG.tea_p + '" alt="' + R.n + '">' + figs +
      (list.length ? '' : '<p class="home-empty">房间的主人不在，这里还没有展示精灵。</p>') + '</div>' +
      (list.length ? '<p class="hint" style="margin-top:8px">Threego 在房间里展示着她的伙伴们。点它们可以摸摸。</p>' : '');
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
      var x = H.mons[i], m = mon(u), amt = homeExp(x), min = homeMins(x);
      H.mons.splice(i, 1);
      var msg = amt > 0 ? gainExp(m, amt) : null;
      if (min >= 60) dailyHit('home');
      save(); renderHome(); renderRes();
      toast(form(m).name + ' 回来了（展示了 ' + durText(min) + '）。' + (msg || '展示时间太短，还没有获得经验。'));
      return;
    }
    if (H.mons.length >= HOME_MAX) return;
    H.mons.push({ u: u, t: Date.now() }); save(); renderHome();
  }
  $('pg-explore').addEventListener('keydown', function (e) { if (e.target.id === 'home-name') { if (e.key === 'Enter') { e.preventDefault(); saveHomeName(); } else if (e.key === 'Escape') { ex.homeEdit = false; renderHome(); } } });

  /* ---------- 任务：主线 / 支线 / 世界 ---------- */
  var MAIN_Q = ['school', 'river', 'jiuquan', 'board', 'flora1'], SIDE_Q = ['academy', 'xiaogan', 'storage', 'tiger', 'tea', 'rare', 'mingming'];
  // 世界任务（奖励暂定）
  var WQ = [
    { id: 'w_first', n: '初到芙罗拉', d: '荆楚号已经抵达芙罗拉星。去丛林或草甸，和那里的野生精灵过过招吧。', where: '芙罗拉星 · 丛林 / 草甸', steps: [{ t: '在芙罗拉星击败 1 只野生精灵', k: 'wins', n: 1 }], reward: { energy: 100 }, after: 'flora1', go: 'flora' },
    { id: 'w_karo', n: '草甸上的奔跑者', d: '卡罗成群地在草甸上奔跑，捕捉率很高，很适合用来练习捕捉。', where: '芙罗拉星 · 草甸', steps: [{ t: '捕捉 1 只卡罗', k: 'own:wind', n: 1 }], reward: { items: { cap1: 3 } }, after: 'flora1', go: 'flora' },
    { id: 'w_mush', n: '林下的蘑菇', d: '丛林的树荫下，常能看到玛西的身影。', where: '芙罗拉星 · 丛林', steps: [{ t: '捕捉 1 只玛西', k: 'own:mush', n: 1 }], reward: { items: { pot1: 2 } }, after: 'flora1', go: 'flora' },
    { id: 'w_hunt', n: '荒野试炼', d: '多和野生精灵交手，伙伴们才会变强。', where: '芙罗拉星 · 丛林 / 草甸', steps: [{ t: '在芙罗拉星击败 10 只野生精灵', k: 'wins', n: 10 }], reward: { energy: 300 }, after: 'flora1', go: 'flora' },
    { id: 'w_kaleo', n: '丛林里的掠食者', d: '有人在丛林深处见过一只卡莱。它只在丛林出现，而且很少露面。', where: '芙罗拉星 · 丛林', steps: [{ t: '捕捉 1 只卡莱', k: 'own:kaleo', n: 1 }], reward: { energy: 500 }, after: 'flora1', go: 'flora' },
    { id: 'w_dex', n: '见习做题家', d: '黄冈秘鉴里亮起的页数越多，做题家就越受人尊敬。', where: '黄冈秘鉴', steps: [{ t: '在黄冈秘鉴中点亮 3 类精灵', k: 'lit', n: 3 }], reward: { energy: 200 }, after: 'academy', go: 'dex' }
  ];
  function qStat(k) {
    if (!acc.stats) acc.stats = {};
    if (k === 'wins') return acc.stats.wildWins || 0;
    if (k === 'lit') return litCount();
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
    if (id === 'rare') return prog('rare_r').done ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    return pr.done ? 'done' : pr.at > 0 ? 'doing' : 'todo';
  }
  function wq(id) { for (var i = 0; i < WQ.length; i++) if (WQ[i].id === id) return WQ[i]; return null; }
  var QLAB = { lock: '未解锁', todo: '可进行', doing: '进行中', claim: '可领取', done: '已完成' };
  function qList(tab) { return tab === 'main' ? MAIN_Q : tab === 'side' ? SIDE_Q : tab === 'daily' ? [] : WQ.map(function (w) { return w.id; }); }
  function qTodo(tab) { if (tab === 'daily') { var D = daily(); return D ? D.list.filter(function (t) { return !t.c; }).length : 0; } return qList(tab).filter(function (id) { var st = qState(id); return st === 'todo' || st === 'doing' || st === 'claim'; }).length; }
  function exHead(hint) {
    var n = qTodo('main') + qTodo('side') + qTodo('world') + dailyClaimable();
    return '<div class="page-head ex-head"><h2 class="sec">星际探索</h2><p class="hint">' + hint + '</p><button type="button" class="btn q-open" data-qopen="1">任务' + (n ? '<i class="q-badge">' + n + '</i>' : '') + '</button></div>';
  }
  function qName(id) { var W = wq(id); return W ? W.n : SITES[id].chapter.split(' · ')[1]; }
  function qWhere(id) {
    var W = wq(id); if (W) return W.where;
    var S = SITES[id], P = PLANETS.filter(function (p) { return p.id === S.planet; })[0];
    return P.name + ' · ' + (S.dept ? S.dept + ' · ' + DEPTS[S.dept][0] : S.name);
  }
  function qDetail(id) {
    if (!id) return '<p class="empty-note">点击左边的任务，查看需要做什么。</p>';
    var W = wq(id), st = qState(id), steps, R, desc, need = '';
    if (W) {
      desc = W.d; R = W.reward;
      steps = W.steps.map(function (x) { var v = Math.min(qStat(x.k), x.n); return { t: x.t, ok: v >= x.n, p: v + ' / ' + x.n }; });
      if (st === 'lock') need = '读完「' + SITES[W.after].chapter.split(' · ')[1] + '」后开放。';
    } else {
      var S = SITES[id], pr = prog(id); desc = S.d; R = S.reward;
      steps = [{ t: '前往 ' + qWhere(id), ok: pr.done || pr.at > 0 }, { t: '读完剧情「' + qName(id) + '」', ok: pr.done }];
      if (S.chapter.indexOf('准备发射') >= 0) steps.splice(1, 0, { t: '和 Threego 进行剧情对战', ok: pr.done || !!pr.bt });
      if (id === 'tiger') { steps = [{ t: '在古城防卫部听舰载广播介绍泰戈尔', ok: pr.done }, { t: '挑战并击败首领「泰戈尔」（只有水、火、草系技能能命中它）', ok: bossWon('tiger') }]; R = { mon: '小胖虎 LV10（首次击败）' }; }
      if (id === 'rare') { var rr = prog('rare_r'); steps = [{ t: '在学院部听 Bttp 说明任务', ok: pr.done }, { t: '捕捉一种稀有精灵（芙罗拉星的丛林深处可能会有）', ok: rr.done || !!rareOwned() }, { t: '回到学院部，向 Bttp 汇报', ok: rr.done }]; R = SITES.rare_r.reward; desc = S.d; }
      if (st === 'lock') need = S.need && prog(S.after).done && !S.need() ? S.needText + (id === 'mingming' ? '（当前 ' + litCount() + ' / 10）' : '') + '。' : '先读完「' + SITES[S.after].chapter.split(' · ')[1] + '」。';
    }
    var rw = R ? rwList(R) : []; if (!W && UNLOCK[id]) rw.push('开放「' + UNLOCK[id] + '」');
    var cur = steps.filter(function (x) { return !x.ok; })[0];
    var act = st === 'lock' ? '' : st === 'claim' ? '<button type="button" class="btn primary" data-qclaim="' + id + '">领取奖励</button>'
      : st === 'done' ? (W ? '' : '<button type="button" class="btn" data-qgo="' + id + '">前往重温</button>')
      : '<button type="button" class="btn primary" data-qgo="' + id + '">' + (W ? '前往' : st === 'doing' ? '前往继续' : '前往') + ' ' + esc(qWhere(id).split(' · ').slice(-1)[0]) + '</button>';
    return '<span class="tape r"></span><span class="q-kind">' + (W ? '世界任务' : SITES[id].side ? '支线任务' : '主线任务') + '</span><h3 class="q-title">' + esc(qName(id)) + '</h3>' +
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
    if (tab === 'daily') {
      $('pg-explore').innerHTML = '<div class="page-head"><h2 class="sec">星际探索</h2><p class="hint">查看当前的任务，以及每个任务需要做什么。</p></div>' +
        '<div class="crumb"><button type="button" class="btn ghost" id="q-back">‹ 返回</button><b>任务</b></div><div class="fparts q-tabs" role="tablist">' + tabs + '</div>' +
        '<article class="detail log-card wide">' + dailyHTML() + '</article>';
      return;
    }
    var list = ids.map(function (id) {
      var st = qState(id);
      return '<button type="button" class="q-item ' + st + (ex.qsel === id ? ' sel' : '') + '" data-q="' + id + '"><span class="qi-n">' + esc(qName(id)) + '</span><span class="qi-w">' + esc(qWhere(id)) + '</span><span class="q-st ' + st + '">' + QLAB[st] + '</span></button>';
    }).join('');
    if (tab === 'main' && ids.every(function (id) { return qState(id) === 'done'; })) list += '<p class="hint q-more">后续主线正在制作中。</p>';
    $('pg-explore').innerHTML = '<div class="page-head"><h2 class="sec">星际探索</h2><p class="hint">查看当前的任务，以及每个任务需要做什么。</p></div>' +
      '<div class="crumb"><button type="button" class="btn ghost" id="q-back">‹ 返回</button><b>任务</b></div>' +
      '<div class="fparts q-tabs" role="tablist">' + tabs + '</div>' +
      '<div class="q-wrap"><div class="q-list">' + list + '</div><article class="detail q-detail" id="q-detail">' + qDetail(ex.qsel) + '</article></div>';
  }
  function questGo(id) {
    var W = wq(id);
    if (W) {
      if (W.go === 'dex') { if (dexOpen()) go('dex'); return; }
      ex.planet = W.go; ex.view = 'sites'; ex.fpart = 'catch'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return;
    }
    var S = SITES[id]; ex.planet = S.planet;
    if (S.dept) { teleport(S.dept); return; }
    ex.view = 'sites'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8);
  }
  function claimQuest(id) {
    var W = wq(id); if (!W || qState(id) !== 'claim') return;
    var R = W.reward; acc.energy += R.energy || 0; acc.exp += R.exp || 0; giveItems(R.items);
    if (!acc.quests) acc.quests = {}; acc.quests[id] = Date.now(); save(); renderRes(); renderQuests();
    toast('完成世界任务「' + W.n + '」！获得 ' + rwList(R).join('、') + '。');
  }

  $('pg-explore').addEventListener('click', function (e) {
    if (ex.mode === 'replay' && $('vn')) { vnClick(e); return; }
    if (ex.view === 'shop' && shopClick(e)) return;
    var b = e.target.closest('button, .dept.open'); if (!b) return;
    if (b.dataset.area) { teleport(b.dataset.area); return; }
    if (b.dataset.qopen) { ex.qBack = { view: ex.view, planet: ex.planet, area: ex.area }; ex.view = 'quests'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.id === 'q-back') { var qb = ex.qBack || { view: 'planets' }; ex.view = qb.view === 'quests' ? 'planets' : qb.view; ex.planet = qb.planet || ex.planet; ex.area = qb.area; renderExplore(); return; }
    if (b.dataset.qtab) { ex.qtab = b.dataset.qtab; ex.qsel = null; renderQuests(); return; }
    if (b.dataset.q) { ex.qsel = b.dataset.q; renderQuests(); var d = $('q-detail'); if (d && window.innerWidth < 760) d.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (b.dataset.qgo) { questGo(b.dataset.qgo); return; }
    if (b.dataset.dclaim) { claimDaily(+b.dataset.dclaim); renderQuests(); return; }
    if (b.dataset.qclaim) { claimQuest(b.dataset.qclaim); return; }
    if (b.dataset.room) { ex.view = 'room'; ex.room = b.dataset.room; ex.area = '天门'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll('荆楚号 · 陆羽茶室'); return; }
    if (b.dataset.home) { ex.view = 'home'; ex.area = '天门'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll('荆楚号 · 陆羽茶室'); return; }
    if (b.dataset.boss) { ex.view = 'boss'; ex.boss = b.dataset.boss; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); mysteryRoll('荆楚号 · ' + DEPTS[BOSSES[b.dataset.boss].dept][0]); return; }
    if (b.dataset.bossgo) { startBoss(b.dataset.bossgo); return; }
    if (b.id === 'boss-back') { ex.view = 'area'; ex.area = BOSSES[ex.boss].dept; renderExplore(); return; }
    if (b.id === 'home-back') { ex.view = 'area'; ex.area = '天门'; renderExplore(); return; }
    if (b.id === 'home-rn') { ex.homeEdit = true; renderHome(); var ip = $('home-name'); if (ip) { ip.focus(); ip.select(); } return; }
    if (b.id === 'home-ok') { saveHomeName(); return; }
    if (b.id === 'home-cancel') { ex.homeEdit = false; renderHome(); return; }
    if (b.dataset.hm) { toggleHomeMon(+b.dataset.hm); return; }
    if (b.dataset.hpoke) { var f = b.closest('.hm-fig'); f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop'); return; }
    if (b.dataset.shop) { ex.view = 'shop'; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.dataset.fpart) { ex.fpart = b.dataset.fpart; renderExplore(); return; }
    if (b.dataset.wild && !b.disabled) { startWild(b.dataset.wild); return; }
    if (b.dataset.goshop) { ex.planet = 'jingchu'; ex.area = '荆门'; ex.view = 'shop'; ex.tp = true; renderExplore(); window.scrollTo(0, $('pg-explore').offsetTop - 8); return; }
    if (b.id === 'ex-area') { ex.view = 'area'; renderExplore(); return; }
    if (b.id === 'ex-ship') { ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.planet && !b.disabled) { ex.planet = b.dataset.planet; ex.view = 'sites'; renderExplore(); mysteryRoll(planetOf(b.dataset.planet).name); return; }
    if (b.id === 'ex-back') { ex.view = 'planets'; renderExplore(); return; }
    if (b.dataset.go && unlocked(b.dataset.go)) { startVN(b.dataset.go, 'replay', $('pg-explore'), b.dataset.from === '0'); window.scrollTo(0, $('pg-explore').offsetTop - 8); }
  });

  $('pg-explore').addEventListener('keydown', function (e) { var g = e.target.closest && e.target.closest('.dept.open'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  /* ----- 对话舞台 ----- */
  function startVN(site, mode, host, fromStart) {
    var pr; ex.site = site; pr = prog(site);
    if (mode !== 'intro') $('onboard').innerHTML = '';
    if (fromStart) { pr.at = 0; pr.ch = null; }
    ex.mode = mode; ex.host = host; ex.view = mode === 'replay' ? 'vn' : ex.view;
    ex.i = stepAt(pr.at); ex.log = []; ex.auto = false; ex.skip = false; ex.pickSel = null; ex.curBg = null;
    renderVN();
  }
  function renderVN() {
    var S = SITES[ex.site], P = PLANETS.filter(function (p) { return p.id === S.planet; })[0], intro = ex.mode === 'intro';
    ex.host.innerHTML = (intro ? '<div class="vn-intro-head"><span class="sc-tag">' + S.chapter + '</span><span class="hint">点击画面、按空格或回车继续。读完序章后进入游戏。</span></div>' : '') +
      '<div class="vn" id="vn" tabindex="0" aria-label="剧情对话，点击或按空格继续">' +
      '<img class="vn-bg" id="vn-bg" alt=""><img class="vn-bg vn-bg2" id="vn-bg2" alt="">' +
      '<div class="vn-chars" id="vn-chars"></div>' +
      '<div class="vn-mons" id="vn-mons"></div>' +
      '<div class="vn-top"><span class="vn-loc">' + P.name + ' · ' + S.name + '<small id="vn-spot"></small></span><span class="vn-ch">' + S.chapter + '</span>' +
      '<span class="vn-btns"><button type="button" data-vn="hide" title="隐藏界面，欣赏背景和立绘（H 键）">隐藏</button><button type="button" data-vn="log">记录</button><button type="button" data-vn="auto" id="vn-auto">自动</button><button type="button" data-vn="skip" id="vn-skip">跳过</button>' + (intro ? '' : '<button type="button" data-vn="exit">退出</button>') + '</span></div>' +
      '<div class="vn-box" id="vn-box"><div class="vn-name" id="vn-name"></div><p class="vn-text" id="vn-text"></p><span class="vn-next" id="vn-next" aria-hidden="true">▼</span></div>' +
      '<div class="vn-choices" id="vn-choices" hidden></div>' +
      '<div class="vn-pick" id="vn-pick" hidden></div>' +
      '<div class="vn-log" id="vn-log" hidden></div>' +
      '<div class="vn-end" id="vn-end" hidden></div><div class="vn-restore" aria-hidden="true">点击任意处恢复界面</div></div>' +
      (intro ? '' : '<p class="hint vn-tip">点击画面、按空格或回车继续；人物立绘目前为占位。</p>');
    show();
    try { $('vn').focus({ preventScroll: true }); } catch (er) {}
  }
  function stopTimers() { clearTimeout(ex.timer); clearInterval(ex.tick); ex.timer = null; ex.tick = null; }
  function setBg(k) {
    if (ex.curBg === k) return;
    var a = $('vn-bg'), b = $('vn-bg2');
    if (!ex.curBg) { a.src = BG[k]; } else { b.src = BG[k]; b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); setTimeout(function () { if (a.isConnected) { a.src = BG[k]; b.classList.remove('in'); } }, 520); }
    a.style.objectPosition = b.style.objectPosition = BG_POS[k] || '';
    ex.curBg = k; $('vn-spot').textContent = ' · ' + (BG_NAME[k] || '');
  }
  function monsHTML(mode) {
    var img = function (sid, cls, label) { return '<figure class="vn-mon ' + cls + '"><img src="' + form({ sid: sid, lv: START_LV }).img + '" alt=""><figcaption>' + esc(label) + '</figcaption></figure>'; };
    if (mode === 'all') return STARTERS.map(function (sid, i) { return img(sid, ['a1', 'a2', 'a3'][i], monName(sid)); }).join('');
    if (mode && mode.indexOf('tw:') === 0) { var tsid = mode.slice(3); return '<figure class="vn-mon tw"><img src="' + form({ sid: tsid, lv: 3 }).img + '" alt=""><figcaption>被污染的' + esc(form({ sid: tsid, lv: 3 }).name) + '</figcaption></figure>'; }
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
    seeStep(st, st.mons !== undefined ? st.mons : mons);
    if (st.give) storyGive(ex.site, st.give);
    var monsH = monsHTML(mons); if ($('vn-mons').dataset.k !== mons + acc.starter) { $('vn-mons').innerHTML = monsH; $('vn-mons').dataset.k = mons + acc.starter; }
    $('vn-chars').innerHTML = on.map(function (o) {
      var k = o[0], pos = o[1], speak = st.s === k;
      return '<div class="vn-fig ' + pos + (CAST[k].img ? ' art' : '') + (CAST[k].full ? ' full' : '') + (speak ? ' speak' : st.s && st.s !== 'n' && !st.choice ? ' dim' : '') + '" style="--cc:' + CAST[k].color + '">' + standee(k, st.f && st.f[k]) + '<span class="vn-tag">' + esc(CAST[k].name()) + '</span></div>';
    }).join('');
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
    var F = FIGHTS[key], el = $('vn-pick'), mine = (acc.teams[acc.active] || []).map(mon).filter(Boolean)[0] || acc.mons[0];
    var foe = form({ sid: F.team[0].sid, lv: F.team[0].lv });
    el.hidden = false;
    el.innerHTML = '<div class="vn-fight"><b>剧情对战</b><div class="vf-row"><img src="' + form(mine).img + '" alt=""><span class="vs">VS</span><img src="' + foe.img + '" alt=""></div>' +
      '<p>你的出战配队（' + TEAM_NAME[acc.active] + '）对阵 ' + (F.desc ? esc(F.desc) : esc(F.foe) + ' 的 ' + esc(foe.name) + '（LV' + F.team[0].lv + '）') + '</p>' +
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
        (s.placeholder ? '<span class="placeholder-note">还没画出来，形象和数值均为占位</span>' : '') + '</button>';
    }).join('') + '</div><div class="vp-foot"><span>' + (sel ? '选择 <b>' + esc(monName(sel)) + '</b> 作为你的伙伴？选定后不能更换。' : '点击一只精灵') + '</span>' +
      '<button type="button" class="btn primary" data-vn="pickok"' + (sel ? '' : ' disabled') + '>就选它了</button></div>';
  }
  function next() {
    if (!$('vn')) return;
    if (ex.typing) { doneTyping(); return; }
    var st = SCRIPT[ex.site][ex.i]; if (st && (st.choice || st.pick || st.battle)) return;
    ex.i++; show();
  }
  function finish() {
    stopTimers();
    var pr = prog(ex.site); pr.done = true; pr.at = 0; save();
    var R = grant(ex.site), intro = ex.mode === 'intro';
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
      (UNLOCK[ex.site] ? '<p><b class="red">「' + UNLOCK[ex.site] + '」已开放！</b>' + (ex.site === 'storage' ? '<br><span class="hint">在荆楚号 · 荆门 · 物资仓储里进入</span>' : '') + '</p>' : '') +
      '<p>' + (nxt ? (SITES[nxt].side ? '支线「' : '下一段「') + SITES[nxt].chapter.split(' · ')[1] + '」已解锁，可在星际探索 · ' + nxtP.name + (SITES[nxt].dept ? ' · ' + DEPTS[SITES[nxt].dept][0] : '') + '中继续。' : '后续剧情正在制作中。') + '</p>' +
      '<div class="row">' + (intro ? '<button type="button" class="btn primary" data-vn="enter">进入游戏</button>'
        : '<button type="button" class="btn" data-vn="replay">重温一遍</button>' + (nxt ? '<button type="button" class="btn" data-vn="next" data-nx="' + nxt + '">继续下一段</button>' : '') + '<button type="button" class="btn primary" data-vn="exit">' + (SITES[ex.site].dept ? '返回区域' : '返回地点') + '</button>') + '</div></div>';
    syncBtns();
  }
  function syncBtns() { var a = $('vn-auto'), s = $('vn-skip'); if (a) a.classList.toggle('on', ex.auto); if (s) s.classList.toggle('on', ex.skip); }
  function setUiOff(on) { var v = $('vn'); if (!v) return; v.classList.toggle('ui-off', on); if (on) { ex.autoWas = ex.auto; ex.auto = false; stopTimers(); if (ex.typing) doneTyping(); syncBtns(); } }
  function vnClick(e) {
    if ($('vn') && $('vn').classList.contains('ui-off') && e.target.closest('#vn')) { setUiOff(false); return; }
    var b = e.target.closest('button');
    if (b && b.dataset.ch) { prog(ex.site).ch = b.dataset.ch; ex.i++; show(); return; }
    if (b && b.dataset.pk) { ex.pickSel = b.dataset.pk; openPick(); return; }
    if (b && b.dataset.vn) {
      var a = b.dataset.vn;
      if (a === 'fight') { startFight(b.dataset.fk); return; }
      if (a === 'pickok' && ex.pickSel) { pickStarter(ex.pickSel); ex.i++; show(); return; }
      if (a === 'exit') { stopTimers(); ex.mode = null; ex.planet = SITES[ex.site].planet; if (SITES[ex.site].dept) { ex.view = 'area'; ex.area = SITES[ex.site].dept; } else ex.view = 'sites'; renderExplore(); return; }
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

  renderTop(); syncBattle();
})();
