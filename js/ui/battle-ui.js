/* ==========================================================
 * 竞技对战界面
 * 选精灵、背包、图鉴、对战画面与动画（对外提供 window.HSUI / window.HSBATTLE）
 * ========================================================== */

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var app = { loadout: {}, bag: ['dragon', 'leaf', 'squid', 'pluto', 'tagore'], sel: 'dragon', screen: 'builder', S: null, logHTML: '', fast: false, lastP: null, lastA: null };
  SP.forEach(function (s) { app.loadout[s.id] = s.def.slice(); });
  // 竞技对战里给每只精灵选好的技能：记在存档里（跟着云存档同步），下次再用同一只精灵时沿用这套
  var LOADOUT_KEY = 'hs-loadout-v1';
  try {
    var savedL = JSON.parse(localStorage.getItem(LOADOUT_KEY) || 'null');
    if (savedL && typeof savedL === 'object') Object.keys(savedL).forEach(function (id) {
      var s = SPMAP[id], lo = savedL[id];
      if (!s || !app.loadout[id] || !Array.isArray(lo)) return;
      var own = s.moves.concat(s.hidden);
      lo = lo.map(moveName).filter(function (n, i) { return M[n] && own.indexOf(n) >= 0 && lo.indexOf(n) === i; }).slice(0, 4);
      if (lo.length) app.loadout[id] = lo;
    });
  } catch (e) {}
  function saveLoadout() {
    // 只记和默认配招不一样的，存档小一点
    var o = {};
    SP.forEach(function (s) { var lo = app.loadout[s.id]; if (lo && lo.join('|') !== s.def.join('|')) o[s.id] = lo.slice(); });
    try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(o)); } catch (e) {}
  }
  var busy = false, quitArmed = 0;
  app.mode = 'sandbox';
  app.rank = { r: 0, stars: 0, w: 0, l: 0, best: 0 };
  try { var savedR = JSON.parse(localStorage.getItem('hs-rank-v1') || 'null'); if (savedR && savedR.r != null) app.rank = savedR; } catch (e) {}
  if (app.rank.r >= DIV_FROM && !app.rank.dv || app.rank.best >= DIV_FROM && !app.rank.bestDv && app.rank.best <= DIV_TO) { fixRank(app.rank); try { localStorage.setItem('hs-rank-v1', JSON.stringify(app.rank)); } catch (e) {} }   // 铂金到宗师分小段：旧存档补上小段
  fixRank(app.rank);
  try { var sm = localStorage.getItem('hs-mode'); if (sm === 'rank' || sm === 'brawl') app.mode = sm; } catch (e) {}
  // 平衡排位：每局系统给出两套强度相同的阵容，二选一
  app.draft = null;
  try { var savedD = JSON.parse(localStorage.getItem('hs-draft-v1') || 'null'); if (savedD && savedD.opts) app.draft = savedD; } catch (e) {}
  function saveDraft() { try { localStorage.setItem('hs-draft-v1', JSON.stringify(app.draft)); } catch (e) {} }
  function ensureDraft() { if (!app.draft || app.draft.used) { app.draft = { opts: drawDraft(), pick: null, order: null }; saveDraft(); } return app.draft; }
  function B() { if (app.mode !== 'rank') return app.bag; var d = ensureDraft(); return d.pick == null ? [] : d.order; }
  // 沙盒：对战 / 训练
  app.sub = 'battle'; app.train = { lv: 100, def: 50 };
  try { var savedT = JSON.parse(localStorage.getItem('hs-train-v1') || 'null'); if (savedT) { app.sub = savedT.sub || 'battle'; app.train = savedT.train || app.train; } } catch (e) {}
  function saveTrain() { try { localStorage.setItem('hs-train-v1', JSON.stringify({ sub: app.sub, train: app.train })); } catch (e) {} }
  function training() { return app.mode === 'sandbox' && app.sub === 'train'; }
  function saveRank() { try { localStorage.setItem('hs-rank-v1', JSON.stringify(app.rank)); } catch (e) {} }
  function saveMode() { try { localStorage.setItem('hs-mode', app.mode); } catch (e) {} }
  function starsHTML(n, r) {
    if (r === RANKS.length - 1) return '<span class="stars king">★ ×' + n + '</span>';
    var h = ''; for (var i = 0; i < 3; i++) h += '<i class="' + (i < n ? 'on' : '') + '">★</i>'; return '<span class="stars">' + h + '</span>';
  }
  function rankBadge(r, dv) { return '<span class="rbadge" style="--rc:' + RANK_COLOR[r] + '">' + rankFull(r, dv) + '</span>'; }
  var resetArmed = 0;
  function renderMode() {
    $('mode-sandbox').classList.toggle('on', app.mode === 'sandbox'); $('mode-sandbox').setAttribute('aria-selected', app.mode === 'sandbox');
    $('mode-rank').classList.toggle('on', app.mode === 'rank'); $('mode-rank').setAttribute('aria-selected', app.mode === 'rank');
    // 精灵大乱斗：读完支线「精灵大乱斗」（孝感大厅 · Dr.黄）后才开放；面板由 social.js 绘制，其他配置区先收起来
    var hs = !!(window.HSACC && window.HSACC.ready()), bwOpen = hs && window.HSACC.brawlOpen();
    if (hs && app.mode === 'brawl' && !bwOpen) app.mode = 'sandbox';   // 账号读进来之后再判断，避免刷新时丢掉上次选的模式
    $('mode-brawl').classList.toggle('locked', !bwOpen); $('mode-brawl').setAttribute('aria-disabled', String(!bwOpen));
    if (!bwOpen) $('brawl-sub').textContent = '未开放 · 持有 3 只精灵后，去孝感大厅找 Dr.黄';
    var bw = app.mode === 'brawl' && bwOpen;
    $('mode-brawl').classList.toggle('on', bw); $('mode-brawl').setAttribute('aria-selected', bw);
    $('brawl').hidden = !bw; document.querySelector('#builder .bagbox').hidden = bw; document.querySelector('#builder .build').hidden = bw;
    if (bw) { $('rankcard').hidden = true; $('subbar').hidden = true; if (window.HSBRAWL) window.HSBRAWL.render(); return; }
    var rc = $('rankcard'); rc.hidden = app.mode !== 'rank';
    $('subbar').hidden = app.mode !== 'sandbox';
    $('sub-battle').classList.toggle('on', app.sub === 'battle'); $('sub-battle').setAttribute('aria-selected', app.sub === 'battle');
    $('sub-train').classList.toggle('on', app.sub === 'train'); $('sub-train').setAttribute('aria-selected', app.sub === 'train');
    $('sub-hint').textContent = app.sub === 'train' ? '对木桩练习出招，统计每个技能造成的伤害' : '与随机配置的电脑对战';
    if (app.mode === 'rank') {
      var R = app.rank, ladder = RANKS.map(function (n, i) { return '<li class="' + (i < R.r ? 'done' : i === R.r ? 'cur' : '') + '" style="--rc:' + RANK_COLOR[i] + '" title="' + n + '">' + n + '</li>'; }).join('');
      rc.innerHTML = '<div class="rc-main">' + rankBadge(R.r, R.dv) + starsHTML(R.stars, R.r) +
        '<div class="rc-txt"><b>当前段位：' + rankFull(R.r, R.dv) + '</b><span>对手特点：' + esc(rankDesc(R.r, R.stars, R.dv)) + '</span>' +
        '<span class="rc-rule">每局胜利获得 1 星，集满 3 星晋级；每局失败扣除 1 星，0 星时失败将降级。铂金到宗师每个段位分为 V、IV、III、II、I 五个小段，从 V 开始往上升，每个小段 3 星，小段越高电脑越强。' + (R.r === RANKS.length - 1 ? '王者段位不封顶，星数越高，电脑越强、越会玩，对手阵容也会比你稍强（最多算到 ' + KING_CAP + ' 星）。' : '双方阵容的综合实力相当。') + '对手精灵在出场后才会揭晓。每局最多 ' + MAX_TURNS + ' 回合，届时剩余精灵多的一方获胜，数量相同则为平局，星数不变。</span></div>' +
        '<div class="rc-rec"><span>战绩：' + R.w + ' 胜 ' + R.l + ' 负</span><span>最高段位：' + rankFull(R.best || 0, R.bestDv) + ((R.best || 0) === RANKS.length - 1 ? ' ' + Math.max(R.kingBest || 0, R.r === RANKS.length - 1 ? R.stars : 0) + ' 星' : '') + '</span><button type="button" class="btn ghost" id="btn-reset">' + (Date.now() - resetArmed < 3000 ? '再点一次确认' : '重置段位') + '</button></div></div>' +
        rankExpHTML() + '<ol class="ladder">' + ladder + '</ol>' + (window.HSACC && HSACC.tokenBarHTML ? HSACC.tokenBarHTML() : '') + (window.HSACC && HSACC.rankRwHTML ? HSACC.rankRwHTML() : '');
    }
  }
  // 平衡排位的经验：和精灵大乱斗一样写清楚规则，并显示今天的进度
  function rankExpHTML() {
    if (!(window.HSACC && HSACC.rankToday && HSACC.ready && HSACC.ready())) return '';
    var E = HSACC.RANK_EXP, n = Math.min(HSACC.rankToday(), E.n);
    return '<ul class="bw-rules rk-rules"><li>每局奖励 <b>' + HSACC.fmt(E.exp) + '</b> 累积经验和 <b>' + (E.token || 0) + '</b> 竞技代币（胜负、平局都算，认输没有），每天前 <b>' + E.n + '</b> 局有奖励，0 点（北京时间）刷新。</li></ul>' +
      '<div class="bw-prog rk-prog"><span>今天的平衡排位经验</span><b>' + n + ' / ' + E.n + ' 局 · ' + HSACC.fmt(n * E.exp) + ' / ' + HSACC.fmt(E.n * E.exp) + '</b><span class="pbar"><i style="width:' + (n / E.n * 100) + '%"></i></span></div>';
  }
  $('sub-battle').addEventListener('click', function () { app.sub = 'battle'; saveTrain(); renderMode(); renderBuilder(); });
  $('sub-train').addEventListener('click', function () { app.sub = 'train'; saveTrain(); renderMode(); renderBuilder(); });
  function setLv(v) { v = Math.max(1, Math.min(100, Math.round(+v || 1))); app.train.lv = v; $('ts-lv').value = v; $('ts-lvr').value = v; saveTrain(); renderTrainNote(); }
  $('ts-lvr').addEventListener('input', function () { setLv(this.value); });
  $('ts-lv').addEventListener('change', function () { setLv(this.value); });
  ['0', '50', '100'].forEach(function (v) { $('ts-def' + v).addEventListener('change', function () { if (this.checked) { app.train.def = +v; saveTrain(); renderTrainNote(); } }); });
  function renderTrainNote() {
    var lv = app.train.lv, d = app.train.def;
    $('ts-note').textContent = '木桩不会攻击、体力无限，等级与我方相同（LV' + lv + '），物防 / 特防为 ' + calcStat(d, 'def', lv) + '。名义体力 ' + calcStat(100, 'hp', lv) + '，仅供按比例计算的效果使用，每次受到伤害后立即回满。';
  }
  function renderTrain() {
    var s = SPMAP[app.sel], lo = app.loadout[app.sel];
    $('ts-mon').innerHTML = '<img src="' + SPRITES[s.id] + '" alt=""><div><span class="nm">' + s.name + '</span> ' + tchips(s.types) +
      '<p class="hint">训练精灵为图鉴中当前选中的精灵，可在下方切换并配置技能。</p><p class="ts-moves">' + (lo.length ? lo.map(function (n) { return M[n].name; }).join('、') : '尚未选择技能') + '</p></div>';
    $('ts-lv').value = app.train.lv; $('ts-lvr').value = app.train.lv; $('ts-def' + app.train.def).checked = true; renderTrainNote();
  }
  $('mode-sandbox').addEventListener('click', function () { app.mode = 'sandbox'; saveMode(); renderMode(); renderBuilder(); });
  $('mode-brawl').addEventListener('click', function () {
    if (!(window.HSACC && window.HSACC.ready() && window.HSACC.brawlOpen())) { var t = '精灵大乱斗还没开放：持有 3 只精灵后，去星际探索 · 荆楚号 · 孝感大厅找 Dr.黄。'; if (window.HSACC) window.HSACC.toast(t); else flashMsg(t); return; }
    app.mode = 'brawl'; saveMode(); renderMode();
  });
  $('mode-rank').addEventListener('click', function () { app.mode = 'rank'; saveMode(); if (ensureDraft().pick != null) app.sel = B()[0]; renderMode(); renderBuilder(); });
  $('rankcard').addEventListener('click', function (e) {
    if (e.target.id !== 'btn-reset') return;
    if (Date.now() - resetArmed < 3000) { app.rank = { r: 0, stars: 0, w: 0, l: 0, best: 0 }; saveRank(); resetArmed = 0; }
    else { resetArmed = Date.now(); setTimeout(renderMode, 3100); }
    renderMode();
  });

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tchip(t) { return '<span class="chip tchip" style="background:' + (TYPE_COLOR[t] || '#9a958a') + '">' + t + '</span>'; }
  function tchips(ts) { return ts.map(tchip).join(''); }
  // 道具图标（占位，之后换成正式立绘）
  function itemIcon(k) {
    if (k === 'c_bowl') return '<svg class="it-ic" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#23222b" stroke-width="2.5" stroke-linejoin="round">' +
      '<path d="M12 30c0-9 9-15 20-15s20 6 20 15z" fill="#fffaf0"/><circle cx="24" cy="23" r="1.6" fill="#e9dcc0" stroke-width="1"/><circle cx="35" cy="20" r="1.6" fill="#e9dcc0" stroke-width="1"/><circle cx="41" cy="26" r="1.6" fill="#e9dcc0" stroke-width="1"/>' +
      '<path d="M8 30h48c0 12-10 21-24 21S8 42 8 30z" fill="#c9553a"/><path d="M14 38h36" stroke="#f3d36b" stroke-width="2"/><path d="M24 51h16v5H24z" fill="#a8432c"/></g></svg>';
    if (k === 'rename') return '<svg class="it-ic" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#23222b" stroke-width="2.5" stroke-linejoin="round">' +
      '<rect x="8" y="14" width="48" height="36" rx="6" fill="#fbfaf3"/><path d="M8 24h48" /><rect x="14" y="31" width="14" height="13" rx="3" fill="#e8d080"/>' +
      '<path d="M33 34h16M33 41h10" stroke-linecap="round"/><path d="M44 50l12-12 4 4-12 12h-4z" fill="#c42f3a" stroke-width="2"/></g></svg>';
    var C = { cap1: ['#7c97b8', '#e8eef6'], cap2: ['#c42f3a', '#f6e4e2'], cap3: ['#2b2a33', '#f3d36b'], pot1: ['#5aa469', '#e4f2e2'], pot2: ['#e08a2e', '#fbead4'], pot200: ['#2f8f86', '#d7f3ef'] }[k] || ['#999', '#eee'];
    if (k.indexOf('cap') === 0) return '<svg class="it-ic" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#23222b" stroke-width="2.5" stroke-linejoin="round">' +
      '<rect x="18" y="6" width="28" height="52" rx="12" fill="' + C[1] + '"/><path d="M18 26h28v12H18z" fill="' + C[0] + '"/>' +
      '<circle cx="32" cy="32" r="7" fill="#fff"/><circle cx="32" cy="32" r="3" fill="' + (k === 'cap3' ? '#f3d36b' : '#8fd3ff') + '" stroke-width="1.5"/>' +
      '<path d="M24 12h16" stroke-width="2" stroke-linecap="round"/></g>' + (k === 'cap3' ? '<text x="32" y="53" text-anchor="middle" font-size="9" font-weight="700" fill="#23222b">必捕</text>' : k === 'cap2' ? '<path d="M46 10l4-4M50 16h5" stroke="#c42f3a" stroke-width="2.5" stroke-linecap="round"/>' : '') + '</svg>';
    return '<svg class="it-ic" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#23222b" stroke-width="2.5" stroke-linejoin="round">' +
      '<path d="M26 6h12v10c8 3 13 10 13 19 0 12-9 22-19 22S13 47 13 35c0-9 5-16 13-19z" fill="#fff"/>' +
      '<path d="M15 36h34c0 11-8 19-17 19S15 47 15 36z" fill="' + C[0] + '" stroke-width="0"/><path d="M26 6h12v10c8 3 13 10 13 19 0 12-9 22-19 22S13 47 13 35c0-9 5-16 13-19z" fill="none"/>' +
      '<rect x="24" y="3" width="16" height="6" rx="2" fill="' + C[1] + '"/><path d="M28 40h8M32 36v8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>' +
      (k === 'pot2' ? '<path d="M50 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f3d36b" stroke="#23222b" stroke-width="1.5"/>' : '') + '</svg>';
  }
  window.HSUI = { itemIcon: itemIcon, big: function (sid, i) { openLightbox(SPMAP[sid], i); }, esc: esc, tchip: tchip, tchips: tchips, atkTip: function (t) { return atkTip(t); } };
  // 技能属性标签：显示这个属性打别人时克制谁、被谁抵抗
  function atkTip(t) {
    var all = Object.keys(TYPE_COLOR), up = [], dn = [];
    all.forEach(function (d) { var e = eff(t, d); if (e > 1) up.push(d); else if (e < 1) dn.push(d); });
    function list(a, x) { return a.length ? a.map(function (d) { return tchip(d) + '<span class="tx ' + (x > 1 ? 'hi' : 'lo') + '">×' + x + '</span>'; }).join('') : '<span class="tn">无</span>'; }
    return '<span class="tt" tabindex="0">' + tchip(t) + '<span class="tip tip-type" role="tooltip"><b>' + t + '系技能</b>' +
      '<span class="trow"><span class="tl">克制（伤害翻倍）</span><span class="tv">' + list(up, 2) + '</span></span>' +
      '<span class="trow"><span class="tl">被抵抗（伤害减半）</span><span class="tv">' + list(dn, 0.5) + '</span></span>' +
      '<span class="tsep">打双属性精灵时，两个倍率相乘</span></span></span>';
  }
  function mult(x) { return '×' + (Math.round(x * 100) / 100); }
  // 战斗中属性标签的悬停提示：进攻克制、防守弱点/抗性、对当前对手的倍率
  function typeTips(sd, opp) {
    var all = Object.keys(TYPE_COLOR);
    var weak = [], resist = [];
    all.forEach(function (a) { var e = effT(a, sd.types); if (e > 1) weak.push([a, e]); else if (e < 1) resist.push([a, e]); });
    function list(arr) { return arr.length ? arr.map(function (x) { return tchip(x[0]) + '<span class="tx">' + mult(x[1]) + '</span>'; }).join('') : '<span class="tn">无</span>'; }
    return sd.types.map(function (t) {
      var up = [], dn = [];
      all.forEach(function (d) { var e = eff(t, d); if (e > 1) up.push([d, e]); else if (e < 1) dn.push([d, e]); });
      var vs = effT(t, opp.types), back = 1;
      opp.types.forEach(function (ot) { back = Math.max(back, effT(ot, sd.types)); });
      var backMin = Math.min.apply(null, opp.types.map(function (ot) { return effT(ot, sd.types); }));
      return '<span class="tt" tabindex="0">' + tchip(t) + '<span class="tip tip-type" role="tooltip">' +
        '<b>' + t + '系</b>' +
        '<span class="trow"><span class="tl">进攻 · 克制</span><span class="tv">' + list(up) + '</span></span>' +
        '<span class="trow"><span class="tl">进攻 · 被抵抗</span><span class="tv">' + list(dn) + '</span></span>' +
        '<span class="tsep">防守（' + sd.name + ' · ' + sd.types.join('/') + '）</span>' +
        '<span class="trow"><span class="tl">怕这些攻击</span><span class="tv">' + list(weak) + '</span></span>' +
        '<span class="trow"><span class="tl">抗这些攻击</span><span class="tv">' + list(resist) + '</span></span>' +
        '<span class="tsep">对当前对手 ' + opp.name + '</span>' +
        '<span class="trow"><span class="tl">' + t + '系技能打它</span><span class="tv"><span class="tx ' + (vs > 1 ? 'hi' : vs < 1 ? 'lo' : '') + '">' + mult(vs) + '</span></span></span>' +
        '<span class="trow"><span class="tl">它的本系打你</span><span class="tv">' + opp.types.map(function (ot) { var x = effT(ot, sd.types); return tchip(ot) + '<span class="tx ' + (x > 1 ? 'hi' : x < 1 ? 'lo' : '') + '">' + mult(x) + '</span>'; }).join('') + '</span></span>' +
        '</span></span>';
    }).join('');
  }
  function rankOn() { return !!(app.S && app.S.mode === 'rank'); }
  function statTip(sd, hidden) {
    if (hidden) return '<span class="chip sc lvc" tabindex="0">LV ??<span class="tip" role="tooltip"><b>' + esc(sd.name) + ' · 能力值未知</b>平衡排位中不公开对手的具体能力值。<span class="tipx">' + rankFull(app.S.rankAt, app.S.rankDv) + '段位的对手能力值 ×' + (app.S.ai && app.S.ai.mult || rankAI(app.S.rankAt, 0, app.S.rankDv).mult) + '</span></span></span>';
    var rows = sd.stats.map(function (r) {
      var stg = r.st ? '<span class="sg ' + (r.st > 0 ? 'up' : 'dn') + '">' + (r.st > 0 ? '+' : '') + r.st + '</span>' : '';
      var sub = r.raw != null && r.st ? '<span class="sr">原 ' + r.raw + '</span>' : (r.base != null ? '<span class="sr">种族 ' + r.base + '</span>' : '');
      return '<span class="srow"><span class="sk">' + r.k + '</span><span class="sv">' + esc(r.v) + stg + sub + '</span>' +
        (r.note ? '<span class="sn">' + esc(r.note) + '</span>' : '') + '</span>';
    }).join('');
    return '<span class="chip sc lvc" tabindex="0">LV' + (sd.lv || 100) + '<span class="tip tip-stat" role="tooltip"><b>' + esc(sd.name) + ' · 当前能力值</b>' + rows + '</span></span>';
  }
  function total(s) { var n = 0; for (var k in s.base) n += s.base[k]; return n; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, app.fast ? ms * 0.35 : ms); }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------------- 选精灵界面 ---------------- */
  function renderDraft() {
    var d = ensureDraft(), el = $('draft');
    el.innerHTML = '<p class="draft-lead">系统为本局随机给出两套阵容，两套的综合实力相当。请选择其中一套出战，选定后不可更换。</p><div class="draft-opts">' +
      d.opts.map(function (team, k) {
        return '<div class="dopt"><div class="dopt-head"><b>阵容 ' + 'AB'[k] + '</b><button type="button" class="btn primary" data-pick="' + k + '">选择阵容 ' + 'AB'[k] + '</button></div><ol class="dopt-row">' +
          team.map(function (id) { var s = SPMAP[id]; return '<li><button type="button" class="dmon" data-id="' + id + '"><img src="' + SPRITES[id] + '" alt=""><span class="nm">' + s.name + '</span><span class="tc">' + tchips(s.types) + '</span></button></li>'; }).join('') +
          '</ol></div>';
      }).join('') + '</div>';
  }
  function renderBag() {
    var rank = app.mode === 'rank', d = rank ? ensureDraft() : null, drafting = rank && d.pick == null, tr = training();
    $('trainset').hidden = !tr;
    if (tr) {
      $('draft').hidden = true; $('bag').hidden = true; $('btn-random').hidden = true;
      $('bag-title').textContent = '训练设置'; $('bag-hint').textContent = '选择一只精灵、我方等级和木桩防御。开始后可连续出招，系统会统计造成的伤害。';
      renderTrain();
      var n = app.loadout[app.sel].length;
      $('bag-msg').textContent = n === 4 ? '准备就绪' : SPMAP[app.sel].name + '尚需选满 4 个技能';
      $('bag-msg').className = 'hint' + (n === 4 ? '' : ' red');
      $('btn-start').disabled = n !== 4; $('btn-start').textContent = '开始训练 · ' + SPMAP[app.sel].name;
      return;
    }
    $('draft').hidden = !drafting; $('bag').hidden = drafting;
    $('btn-random').hidden = rank;
    $('bag-title').textContent = rank ? (drafting ? '本局阵容选择' : '本局出战阵容（阵容 ' + 'AB'[d.pick] + '）') : '我的背包';
    $('bag-hint').textContent = rank ? (drafting ? '点击精灵可在下方查看资料。' : '阵容已锁定。可拖动精灵调整出场顺序（第 1 位为首发），并为每只精灵选择 4 个技能。') : '拖动背包里的精灵可调整顺序（触屏长按后拖动），排在第 1 位的为首发。点击精灵即可选中并查看资料；选中后，卡片右上角可直接「移出」或「放进背包」。';
    if (drafting) { renderDraft(); $('bag-msg').textContent = '请先选择一套阵容'; $('bag-msg').className = 'hint red'; $('btn-start').disabled = true; $('btn-start').textContent = '开始平衡排位 · ' + rankFull(app.rank.r, app.rank.dv); return; }
    var html = '';
    for (var i = 0; i < 5; i++) {
      var id = B()[i];
      if (id) {
        var s = SPMAP[id], n = app.loadout[id].length;
        html += '<li><button type="button" class="slot filled' + (app.sel === id ? ' sel' : '') + '" data-id="' + id + '">' +
          (i === 0 ? '<span class="lead">首发</span>' : '') +
          '<img src="' + SPRITES[id] + '" alt="">' + '<span class="nm">' + s.name + '</span><span class="tc">' + tchips(s.types) + '</span>' +
          (n !== 4 ? '<span class="warn">技能 ' + n + '/4</span>' : '') + '</button>' +
          (app.sel === id && !rank ? '<button type="button" class="qx" data-rm="' + id + '" aria-label="把' + s.name + '移出背包">✕ 移出</button>' : '') + '</li>';
      } else html += '<li><div class="slot"><div class="empty">空位</div></div></li>';
    }
    $('bag').innerHTML = html;
    var bad = B().filter(function (id) { return app.loadout[id].length !== 4; });
    var rank = app.mode === 'rank', need = rank && B().length < 5;
    var msg = !B().length ? '背包中至少需要 1 只精灵' : need ? '平衡排位需要携带 5 只精灵，尚缺 ' + (5 - B().length) + ' 只' : bad.length ? SPMAP[bad[0]].name + '尚需选满 4 个技能' :
      rank ? '阵容已就绪，对手阵容将在对战中逐一揭晓' : '已选 ' + B().length + ' 只，电脑将随机携带 5 只';
    $('bag-msg').textContent = msg;
    var blocked = !B().length || bad.length > 0 || need;
    $('bag-msg').className = 'hint' + (blocked ? ' red' : '');
    $('btn-start').disabled = blocked;
    $('btn-start').textContent = rank ? '开始平衡排位 · ' + rankFull(app.rank.r, app.rank.dv) : '开始对战';
  }
  function renderDex() {
    var quick = !training() && app.mode !== 'rank';
    $('dex').innerHTML = SP.map(function (s) {
      var inb = B().indexOf(s.id) >= 0, q = '';
      if (quick && app.sel === s.id) q = inb ? '<button type="button" class="qx" data-rm="' + s.id + '">✕ 移出背包</button>' : B().length < 5 ? '<button type="button" class="qa" data-add="' + s.id + '">＋ 放进背包</button>' : '';
      return '<div class="cw">' + q + '<button type="button" class="card' + (app.sel === s.id ? ' sel' : '') + '" data-id="' + s.id + '">' +
        (!training() && inb && !q ? '<span class="inbag">背包中</span>' : '') + (training() && app.sel === s.id ? '<span class="inbag">训练中</span>' : '') +
        '<img src="' + SPRITES[s.id] + '" alt="' + s.name + '的手绘立绘"><span class="nm">' + s.name + '</span>' +
        '<span class="meta">' + tchips(s.types) + '<span>种族值 ' + total(s) + (s.unsure && s.unsure.length >= 6 ? '?' : '') + '</span></span></button></div>';
    }).join('');
  }
  function moveRow(n, s) {
    var m = M[n], on = app.loadout[s.id].indexOf(n) >= 0, id = 'mv-' + s.id + '-' + n;
    var meta = m.cat + (m.power ? ' · 威力' + m.power : '') + (m.pri ? ' · 先制+' + m.pri : '') + ' · PP' + m.pp;
    var emb = s.emblem && s.emblem.m === n ? ' <span class="tag">纹章</span>' : '';
    return '<label class="mrow' + (on ? ' on' : '') + (m.hidden ? ' hid' : '') + '" for="' + id + '">' +
      '<input type="checkbox" id="' + id + '" data-move="' + n + '"' + (on ? ' checked' : '') + '>' +
      '<span class="l1"><span class="mn">' + m.name + '</span>' + atkTip(m.type) + '<span class="mm">' + meta + '</span>' +
      (m.hidden ? '<span class="tag sc hidtag" tabindex="0">隐藏<span class="tip" role="tooltip"><b>隐藏技能</b>' + (LEARN[n] ? '要在战斗中满足特定条件才能领悟（精灵需 LV' + HIDDEN_MIN_LV + ' 以上）' : '达到 LV50 时习得') + '<span class="tipx">试验版里可以直接选用</span></span></span>' : '') + emb + '</span>' +
      '<span class="md">' + esc(m.d) + '</span></label>';
  }
  function renderDetail() {
    var s = SPMAP[app.sel], inBag = B().indexOf(s.id) >= 0, n = app.loadout[s.id].length;
    var stats = '';
    ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) {
      var b = s.base[k], q = s.unsure && s.unsure.indexOf(k) >= 0;
      stats += '<span>' + BASE_NAME[k] + '</span><span>' + b + (q ? '<span class="q" title="照片里这一项没看清，先按这个数，告诉我正确数值就能改">?</span>' : '') + '</span>' +
        '<span class="bar"><i style="width:' + Math.min(100, b / 150 * 100) + '%"></i></span>' +
        '<span class="real">LV100：' + calcStat(b, k) + '</span>';
    });
    stats += '<span class="sum">种族值总和 ' + total(s) + (s.unsure ? (s.unsure.length >= 6 ? ' · 图鉴里还没写种族值，这些都是暂定数值' : ' · 带 <span class="red">?</span> 的数值是照片里没看清、暂定的') : '') + '</span>';
    // 当前查看的形态（点进化链切换）；默认最终形态
    var v = app.evoView && app.evoView.id === s.id && s.evo ? app.evoView.i : evoLast(s), fin = isFin(s, v);
    var ev = s.evo ? s.evo[v] : {}, vName = !fin ? String(ev.n || s.name + '·' + stageLabel(s, v)).replace('?', '') : s.name;
    var vImg = s.evo ? formImg(s, v) : SPRITES[s.id], vLore = ev.d || (!fin ? '' : s.lore || '');
    $('detail').innerHTML =
      '<span class="tape r"></span>' +
      '<div class="d-head"><button type="button" class="d-art" data-big="' + v + '" title="点击查看大图" aria-label="查看' + esc(vName) + '的大图"><img src="' + vImg + '" alt="' + esc(vName) + '"></button>' +
      '<div><h3>' + (ev.no ? '<span class="dexno">No.' + ev.no + '</span>' : '') + esc(vName) + '</h3>' + tchips(s.types) +
      (!fin ? '<p class="formnote">' + stageLabel(s, v) + '形态 · ' + (v === 0 ? 'LV1' : 'LV' + s.evo[v].lv) + '–' + (s.evo[v + 1].lv - 1) + ' · 下方的能力、特性和技能按最终形态「' + s.name + '」显示</p>' : s.evo ? '<p class="formnote">最终形态 · LV' + s.evo[v].lv + ' 起 · 下方的能力、特性和技能按此形态显示</p>' : '') +
      (vLore ? '<p class="lore">' + esc(vLore) + '</p>' : '') +
      (fin && LINEART[s.id] ? '<figure class="sketch"><img src="' + LINEART[s.id] + '" alt="' + s.name + '的手绘原画"><figcaption>原画手稿</figcaption></figure>' : '') + '</div></div>' +
      evoChain(s) +
      '<div class="stats">' + stats + '</div>' +
      '<div class="trait"><p><b>特性 · ' + s.ability.n + '</b>　<span class="blue">' + esc(s.ability.d) + '</span></p>' + (s.ability.extra ? '<p class="blue" style="font-size:13px">' + esc(s.ability.extra) + '</p>' : '') +
      (s.emblem ? '<p><b>纹章 · ' + s.emblem.m + '*</b>　<span class="blue">' + esc(s.emblem.d) + '</span></p>' : '') + '</div>' +
      '<div><div class="moves-head"><h4>出战技能 <span class="' + (n === 4 ? 'blue' : 'red') + '">' + n + '/4</span></h4>' +
      '<span class="hint">鼠标移到「隐藏」上可看学习条件，试验版里可以直接选用</span></div>' +
      '<div class="mlist" id="mlist">' + s.moves.map(function (m) { return moveRow(m, s); }).join('') + s.hidden.map(function (m) { return moveRow(m, s); }).join('') + '</div></div>' +
      '<div class="d-actions">' +
      (app.mode === 'rank' ? (inBag ? '<button class="btn" type="button" id="btn-lead"' + (B()[0] === s.id ? ' disabled' : '') + '>设为首发</button>' : '<span class="hint">平衡排位中只能使用本局选定的阵容</span>') :
      inBag ? '<button class="btn" type="button" id="btn-lead"' + (B()[0] === s.id ? ' disabled' : '') + '>设为首发</button><button class="btn ghost" type="button" id="btn-remove">移出背包</button>'
        : '<button class="btn primary" type="button" id="btn-add"' + (B().length >= 5 ? ' disabled' : '') + '>放进背包</button>' + (B().length >= 5 ? '<span class="hint">背包已满 5 只，先移出一只</span>' : '')) +
      '</div>';
  }
  function renderChart() {
    var types = Object.keys(TYPE_COLOR);
    $('chart').innerHTML = types.map(function (t) {
      var up = [], dn = [];
      types.forEach(function (d) { var e = eff(t, d); if (e > 1) up.push(d); else if (e < 1) dn.push(d); });
      return '<div class="chartrow">' + tchip(t) + '<div class="cl"><span class="lab">克制</span>' + (up.length ? up.map(tchip).join('') : '<span class="lab">无</span>') +
        '<span class="lab" style="margin-left:8px">被抵抗</span>' + (dn.length ? dn.map(tchip).join('') : '<span class="lab">无</span>') + '</div></div>';
    }).join('') + '<p class="hint" style="margin:8px 0 2px">双属性精灵按两个属性的倍率相乘计算。</p>';
  }
  function evoChain(s) {
    if (!s.evo) return '';
    var st = s.evo.map(function (e, i) {
      var img = formImg(s, i);
      var name = formRawName(s, i);
      var unsure = name && name.slice(-1) === '?';
      if (unsure) name = name.slice(0, -1);
      return { img: img, name: name, unsure: unsure, lv: e.lv, stage: stageLabel(s, i) };
    });
    var html = '<div class="evo"><div class="evo-head"><h4>进化链</h4><span class="hint">点击形态查看它的资料，点上方的大图可以放大' + (s.evoLvSure ? '' : ' · 进化等级在图鉴里没写，暂按 ' + s.evo.slice(1).map(function (e) { return 'LV' + e.lv; }).join(' / ')) + '</span></div><ol class="evo-row' + (s.evo.length === 2 ? ' n2' : '') + '">';
    st.forEach(function (x, i) {
      if (i > 0) html += '<li class="evo-arrow" aria-hidden="true"><span>LV' + x.lv + '</span></li>';
      var cur = (app.evoView && app.evoView.id === s.id ? app.evoView.i : evoLast(s)) === i;
      html += '<li><button type="button" class="evo-card' + (isFin(s, i) ? ' final' : '') + (cur ? ' cur' : '') + '" data-evo="' + i + '" aria-pressed="' + cur + '">' +
        '<span class="evo-img"><img src="' + x.img + '" alt="' + (x.name || s.name + st[i].stage) + '"></span>' +
        '<span class="evo-name">' + (x.name ? esc(x.name) + (x.unsure ? '<i class="q" title="字迹没看清">?</i>' : '') : '<span class="nn">名字没拍到</span>') + '</span>' +
        '<span class="evo-lv">' + (s.evo[i].no ? 'No.' + s.evo[i].no + ' · ' : '') + x.stage + ' · ' + (i === 0 ? 'LV1 起' : 'LV' + x.lv + ' 进化') + '</span></button></li>';
    });
    var descs = s.evo.filter(function (e) { return e.d; });
    html += '</ol>';
    if (descs.length) html += '<dl class="evo-desc">' + s.evo.map(function (e, i) { return e.d ? '<dt>No.' + e.no + ' ' + esc(formRawName(s, i) || '') + '</dt><dd>' + esc(e.d) + '</dd>' : ''; }).join('') + '</dl>';
    return html + '</div>';
  }
  function openLightbox(s, i) {
    var lb = $('lightbox'), e = s.evo[i];
    var img = formImg(s, i);
    var name = isFin(s, i) ? s.name : (e.n || '（名字没拍到）');
    $('lb-img').src = img; $('lb-img').alt = name.replace('?', '');
    $('lb-cap').textContent = name.replace('?', '') + (name.slice(-1) === '?' ? '（字迹没看清）' : '') + ' · ' + stageLabel(s, i) + ' · ' + (i === 0 ? 'LV1 起' : 'LV' + e.lv + ' 进化');
    if (e.d) $('lb-cap').textContent = (e.no ? 'No.' + e.no + ' ' : '') + $('lb-cap').textContent + '　' + e.d;
    lb.dataset.sid = s.id; lb.dataset.i = i; lb.hidden = false; $('lb-close').focus();
  }
  function closeLightbox() { $('lightbox').hidden = true; }
  function renderBuilder() { renderBag(); renderDex(); renderDetail(); }
  renderChart();

  function quickBag(e) {
    if (app.mode === 'rank' || training()) return false;
    var r = e.target.closest('[data-rm]'), a = e.target.closest('[data-add]');
    if (r) { var i = B().indexOf(r.dataset.rm); if (i >= 0) B().splice(i, 1); }
    else if (a) { if (B().length < 5 && B().indexOf(a.dataset.add) < 0) B().push(a.dataset.add); }
    else return false;
    renderBuilder(); return true;
  }
  /* 拖动调整背包顺序（鼠标直接拖；触屏长按后拖） */
  var drag = null, dragJustEnded = false;
  function slotAt(x, y) {
    var el = document.elementFromPoint(x, y), li = el && el.closest('#bag li');
    if (!li) return -1;
    var lis = [].slice.call($('bag').children), i = lis.indexOf(li);
    return Math.min(i, B().length - 1);
  }
  function dragStart() {
    var r = drag.el.getBoundingClientRect(), g = drag.el.cloneNode(true);
    g.classList.add('drag-ghost'); g.classList.remove('sel'); var q = g.querySelector('.qx'); if (q) q.remove();
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top; drag.ghost = g; document.body.appendChild(g);
    drag.el.classList.add('lifted'); $('bag').classList.add('dragging'); drag.on = true;
  }
  function dragMove(x, y) {
    drag.ghost.style.left = (x - drag.dx) + 'px'; drag.ghost.style.top = (y - drag.dy) + 'px';
    var t = slotAt(x, y); drag.to = t;
    [].forEach.call($('bag').querySelectorAll('.slot'), function (el, i) { el.classList.toggle('drop-to', i === t && t !== drag.from); });
  }
  function dragEnd(commit) {
    if (!drag) return;
    var d = drag; drag = null; clearTimeout(d.timer);
    if (!d.on) return;
    d.ghost.remove(); $('bag').classList.remove('dragging');
    dragJustEnded = true; setTimeout(function () { dragJustEnded = false; }, 0);
    if (commit && d.to >= 0 && d.to !== d.from) {
      var bb = B(), id = bb.splice(d.from, 1)[0]; bb.splice(d.to, 0, id);
      if (app.mode === 'rank') saveDraft();
    }
    renderBuilder();
  }
  $('bag').addEventListener('pointerdown', function (e) {
    if (training() || e.button > 0 || e.target.closest('.qx')) return;
    var sl = e.target.closest('.slot.filled'); if (!sl) return;
    var lis = [].slice.call($('bag').children);
    drag = { el: sl, id: sl.dataset.id, from: lis.indexOf(sl.parentNode), to: -1, x0: e.clientX, y0: e.clientY, touch: e.pointerType !== 'mouse', on: false };
    if (drag.touch) drag.timer = setTimeout(function () { if (drag && !drag.on) { dragStart(); dragMove(drag.x0, drag.y0); if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {} } }, 280);
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.on) {
      var far = Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 6;
      if (!far) return;
      if (drag.touch) { clearTimeout(drag.timer); drag = null; return; }   // 触屏没长按就移动 = 正常滚动
      dragStart();
    }
    dragMove(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', function () { dragEnd(true); });
  window.addEventListener('pointercancel', function () { dragEnd(false); });
  document.addEventListener('touchmove', function (e) { if (drag && drag.on) e.preventDefault(); }, { passive: false });
  $('bag').addEventListener('contextmenu', function (e) { if (drag) e.preventDefault(); });
  $('bag').addEventListener('click', function (e) { if (dragJustEnded) { e.stopPropagation(); return; } if (quickBag(e)) return; var b = e.target.closest('[data-id]'); if (b) { app.sel = b.dataset.id; renderBuilder(); } });
  $('dex').addEventListener('click', function (e) { if (quickBag(e)) return; var b = e.target.closest('[data-id]'); if (b) { app.sel = b.dataset.id; renderBuilder(); } });
  $('detail').addEventListener('change', function (e) {
    var cb = e.target.closest('input[data-move]'); if (!cb) return;
    var lo = app.loadout[app.sel], n = cb.dataset.move;
    if (cb.checked) { if (lo.length >= 4) { cb.checked = false; flashMsg('最多带 4 个技能，先取消一个'); return; } lo.push(n); }
    else lo.splice(lo.indexOf(n), 1);
    saveLoadout();
    renderBag(); renderDetail();
  });
  $('detail').addEventListener('click', function (e) {
    var ev = e.target.closest('[data-evo]'); if (ev) { app.evoView = { id: app.sel, i: +ev.dataset.evo }; renderDetail(); return; }
    var bg = e.target.closest('[data-big]'); if (bg) { openLightbox(SPMAP[app.sel], +bg.dataset.big); return; }
    var t = e.target;
    if (app.mode === 'rank' && (t.id === 'btn-add' || t.id === 'btn-remove')) return;
    if (t.id === 'btn-add' && B().length < 5) B().push(app.sel);
    else if (t.id === 'btn-remove') B().splice(B().indexOf(app.sel), 1);
    else if (t.id === 'btn-lead') { var bb = B(); bb.splice(bb.indexOf(app.sel), 1); bb.unshift(app.sel); if (app.mode === 'rank') saveDraft(); }
    else return;
    renderBuilder();
  });
  function flashMsg(t) { $('bag-msg').textContent = t; $('bag-msg').className = 'hint red'; }
  $('lb-close').addEventListener('click', closeLightbox);
  $('lightbox').addEventListener('click', function (e) { if (e.target.id === 'lightbox') closeLightbox(); });
  function lbStep(d) { var lb = $('lightbox'), s = SPMAP[lb.dataset.sid], n = s.evo ? s.evo.length : 1, i = (+lb.dataset.i + d + n) % n; openLightbox(s, i); }
  $('lb-prev').addEventListener('click', function () { lbStep(-1); });
  $('lb-next').addEventListener('click', function () { lbStep(1); });
  document.addEventListener('keydown', function (e) {
    if ($('lightbox').hidden) return;
    if (e.key === 'Escape') closeLightbox(); else if (e.key === 'ArrowLeft') lbStep(-1); else if (e.key === 'ArrowRight') lbStep(1);
  });
  $('draft').addEventListener('click', function (e) {
    var pk = e.target.closest('[data-pick]');
    if (pk) { var d = ensureDraft(); d.pick = +pk.dataset.pick; d.order = d.opts[d.pick].slice(); saveDraft(); app.sel = d.order[0]; renderBuilder(); return; }
    var m = e.target.closest('[data-id]'); if (m) { app.sel = m.dataset.id; renderDex(); renderDetail(); }
  });
  $('btn-random').addEventListener('click', function () { app.bag = shuffle(SP.map(function (s) { return s.id; })).slice(0, 5); app.sel = app.bag[0]; renderBuilder(); });
  $('btn-start').addEventListener('click', function () { startBattle(); });

  /* ---------------- 对战界面 ---------------- */
  // 战斗背景音乐（见 audio.js）
  function bgm(k, then) { if (window.HSAUDIO) HSAUDIO.play(k, then); }
  function bgmStop(ms) { if (window.HSAUDIO) HSAUDIO.stop(ms); }
  /* ---------- 观战转播：对战画面（战况快照、战斗记录、动画提示）攒一小会儿发给服务器，由服务器转给观众（见 social.js）---------- */
  var CAST = { on: false, head: null, snap: null, log: [], fx: [], timer: null, all: [] }, caster = null;
  function castLabel() {
    var S = app.S; if (!S) return '对战';
    if (pvp) return pvp.brawl ? '精灵大乱斗' : '切磋 · ' + (pvp.label || pvp.mode + 'v' + pvp.mode);
    if (S.training) return '竞技对战 · 训练';
    if (S.wild) return '野外 · ' + (S.wild.where || '');
    if (S.story) { var a0 = S.sides[1].team[0]; return S.story.foe === '首领' ? '首领战 · ' + (a0.nick || SPMAP[a0.id].name) + (S.story.diff ? '（' + S.story.diff + '）' : '') : '对战 · ' + S.story.foe; }
    return S.mode === 'rank' ? '竞技对战 · 平衡排位 · ' + rankFull(S.rankAt, S.rankDv) : '竞技对战 · 沙盒';
  }
  function castFoe() { var S = app.S; return pvp ? pvp.foe : S.training ? '训练木桩' : S.wild ? '野生精灵' : S.story ? S.story.foe : '电脑'; }
  // 发出去的快照：去掉能力值明细（太长，观众用不到）；平衡排位里对手还没派出的精灵不公开
  function castSnap(sn) {
    var hide = rankOn();
    return { turn: sn.turn, sides: sn.sides.map(function (sd, i) {
      return { id: sd.id, name: sd.name, img: sd.img, types: sd.types, lv: hide && i === 1 ? null : sd.lv, dummy: sd.dummy, ability: { n: sd.ability.n, d: sd.ability.d }, hp: sd.hp, maxhp: sd.maxhp, fainted: sd.fainted,
        chips: sd.chips.map(function (c) { return { k: c.k, t: c.t, h: c.h, d: c.d }; }),
        team: sd.team.map(function (t) { var u = hide && i === 1 && !t.seen; return { id: u ? null : t.id, nick: u ? null : t.nick, fainted: t.fainted, active: t.active }; }) };
    }) };
  }
  function castBegin() {
    CAST.on = true; CAST.snap = null; CAST.log = []; CAST.fx = []; CAST.all = [];
    CAST.head = { label: castLabel(), foe: castFoe() };
    if (caster) caster('start', { head: CAST.head });
    castViewers(0, []);
  }
  function castQueue() { if (CAST.on && !CAST.timer) CAST.timer = setTimeout(castFlush, 250); }
  function castFlush() {
    clearTimeout(CAST.timer); CAST.timer = null;
    if (!CAST.on || (!CAST.snap && !CAST.log.length && !CAST.fx.length)) return;
    if (caster) caster('f', { snap: CAST.snap, log: CAST.log, fx: CAST.fx });
    CAST.snap = null; CAST.log = []; CAST.fx = [];
  }
  function castEnd(title, sub) {
    if (!CAST.on) return;
    castFlush(); CAST.on = false;
    if (caster) caster('end', { title: title, sub: sub });
    castViewers(0, []); $('btn-invite').hidden = true; $('btn-emote').hidden = true; var ep = $('emote-pop'); if (ep) ep.hidden = true;
  }
  function castFx(o) { if (CAST.on) { CAST.fx.push(o); castQueue(); } }
  // 有几个人在看
  var castNames = [];
  function castViewers(n, names) {
    var el = $('cast-n'); if (!el) return;
    castNames = names || [];
    el.hidden = !n || !CAST.on; el.textContent = n ? '👁 ' + n : '';
    el.title = n ? n + ' 人观战中，点击查看是谁' : '';
    var pop = $('cast-pop'); if (pop && !pop.hidden) drawCastPop();
    if (!n && pop) pop.hidden = true;
  }
  function drawCastPop() { var pop = $('cast-pop'); pop.innerHTML = '<b>' + castNames.length + ' 人观战中</b>' + (castNames.length ? '<ul>' + castNames.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''); }
  $('cast-n').addEventListener('click', function (e) { e.stopPropagation(); var pop = $('cast-pop'); pop.hidden = !pop.hidden; if (!pop.hidden) drawCastPop(); });
  document.addEventListener('click', function () { var pop = $('cast-pop'); if (pop) pop.hidden = true; });
  function startTraining() {
    var id = app.sel; bgm('pvp');
    app.S = newTraining({ id: id, moves: app.loadout[id].slice() }, app.train.lv, app.train.def);
    app.screen = 'battle'; app.logHTML = ''; $('log').innerHTML = '';
    $('builder').hidden = true; $('battle').hidden = false; $('endcard').hidden = true;
    shownIds = [null, null]; castBegin();
    addLog('训练开始：【' + SPMAP[id].name + '】LV' + app.train.lv + ' 对阵木桩（双防种族值 ' + app.train.def + '）', 'turn');
    renderSnap(snap(app.S), true); renderStats();
    showTab('moves'); refreshCmd();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderStats() {
    var box = $('statsbox'), S = app.S; box.hidden = !(S && S.training); if (box.hidden) return;
    var L = S.training.log, tot = 0, max = 0, by = {}, order = [];
    L.forEach(function (x) { tot += x.amt; if (x.amt > max) max = x.amt; if (!by[x.src]) { by[x.src] = { n: 0, sum: 0, max: 0 }; order.push(x.src); } var b = by[x.src]; b.n++; b.sum += x.amt; b.max = Math.max(b.max, x.amt); });
    var turns = Math.max(0, S.turn - (S.training.t0 || 1)), nominal = act(S, 1).maxhp;
    $('sb-tiles').innerHTML = [['总伤害', tot], ['回合数', turns], ['平均每回合', turns ? Math.round(tot / turns) : 0], ['单次最高', max], ['折合木桩名义体力', nominal ? (tot / nominal).toFixed(2) + ' 管' : '—']]
      .map(function (x) { return '<div class="tile"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
    order.sort(function (a, b) { return by[b].sum - by[a].sum; });
    $('sb-rows').innerHTML = order.length ? order.map(function (k) { var b = by[k], p = tot ? b.sum / tot : 0;
      return '<tr><td>' + esc(k) + '</td><td>' + b.n + '</td><td>' + b.sum + '</td><td>' + Math.round(b.sum / b.n) + '</td><td>' + b.max + '</td><td><span class="pbar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></span>' + Math.round(p * 100) + '%</td></tr>'; }).join('')
      : '<tr><td colspan="6" class="hint">尚未造成伤害，选择一个技能开始训练</td></tr>';
  }
  $('btn-sreset').addEventListener('click', function () { if (!app.S || !app.S.training || busy) return; app.S.training.log = []; app.S.training.t0 = app.S.turn; addLog('伤害统计已清空', 'dmg'); renderStats(); });
  $('btn-dreset').addEventListener('click', function () {
    if (!app.S || !app.S.training || busy) return; var d = act(app.S, 1);
    d.stages = blankStages(); d.st = {}; d.tm = {}; d.fx = {}; d.perm = {};
    addLog('木桩状态已重置（能力等级、异常状态、持续效果全部清除）', 'dmg'); renderSnap(snap(app.S));
  });
  function startBattle() {
    setFieldBg(null);
    if (training()) return startTraining();
    bgm('pvp');
    var p = B().map(function (id) { return { id: id, moves: app.loadout[id].slice() }; });
    var rank = app.mode === 'rank';
    var a = rank ? buildAITeam(app.rank.r, B(), app.rank.stars, app.rank.dv) : (function () { var ids = shuffle(SP.map(function (s) { return s.id; })).slice(0, 5); return ids.map(function (id) { return { id: id, moves: smartLoadout(id, 6, ids) }; }); })();
    app.lastP = p;
    app.S = newBattle(p, a);
    if (rank) { app.S.mode = 'rank'; app.S.rankAt = app.rank.r; app.S.rankDv = app.rank.dv; app.S.ai = rankAI(app.rank.r, app.rank.stars, app.rank.dv); app.draft.used = true; saveDraft(); }
    app.screen = 'battle'; app.logHTML = ''; $('log').innerHTML = '';
    $('builder').hidden = true; $('battle').hidden = false; $('endcard').hidden = true;
    shownIds = [null, null]; castBegin();
    addLog('对手派出了【' + SPMAP[a[0].id].name + '】，你派出了【' + SPMAP[p[0].id].name + '】！', '');
    if (rank) addLog('平衡排位 · ' + rankFull(app.rank.r, app.rank.dv) + '段位 · 对手其余 4 只精灵尚未公开', 'turn');
    else { addLog('对手背包：' + a.map(function (x) { return SPMAP[x.id].name; }).join('、'), 'dmg'); a.forEach(function (x) { addLog('　' + SPMAP[x.id].name + '：' + x.moves.map(function (n) { return M[n].name; }).join('、'), 'dmg'); }); }
    renderSnap(snap(app.S), true);
    showTab('moves'); refreshCmd();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 剧情对战（由星际探索调用）：opt = { p, a, foe, onEnd(result) }
  function setFieldBg(src, corrupt) { var f = $('field'); f.classList.toggle('scene', !!src); f.classList.toggle('miasma-bg', !!corrupt); f.style.backgroundImage = src ? 'linear-gradient(rgba(251,250,243,.32), rgba(251,250,243,.18)), url(' + src + ')' : ''; }
  function startStory(opt) {
    setFieldBg(opt.bg || null, opt.corrupt);
    // 战斗里一律放战斗曲：默认「寻常」，剧情可以指定专属曲（如第八段的变异玛西露姆用 dis-communication）。
    // FaceTheEnemy（遇敌曲）只在剧情对话里遇敌前后用来渲染气氛（剧本行 bgm: 'faceEnemyScene'），进入战斗后不再放（2026-10-17）
    bgm(opt.bgm || 'normal');
    app.S = newBattle(opt.p, opt.a); app.S.story = { foe: opt.foe, back: opt.back || null, diff: opt.diff || null };
    if (opt.items) app.S.items = opt.items;
    if (opt.env) app.S.env = opt.env;
    if (opt.wild) app.S.wild = opt.wild;
    if (opt.ai) app.S.ai = opt.ai;   // 电脑的操作水平（例如白银段位）
    storyEnd = opt.onEnd; itemUsed = opt.onItem || null;
    app.screen = 'battle'; app.logHTML = ''; $('log').innerHTML = '';
    $('builder').hidden = true; $('battle').hidden = false; $('endcard').hidden = true;
    shownIds = [null, null]; castBegin();
    var nn = function (x) { return x.nick || SPMAP[x.id].name; };
    if (opt.wild) { addLog('野生的【' + nn(opt.a[0]) + '】（LV' + opt.a[0].lv + '）出现了！你派出了【' + nn(opt.p[0]) + '】！', ''); addLog(opt.wild.where + ' · 野外对战', 'turn'); }
    else { addLog(opt.foe + '派出了【' + nn(opt.a[0]) + '】，你派出了【' + nn(opt.p[0]) + '】！', ''); addLog(opt.diff ? '首领战 · ' + opt.diff : '剧情对战 · ' + opt.foe, 'turn'); }
    if (opt.env === 'miasma') addLog('这里弥漫着瘴气：每回合结束时，场上的精灵各获得 1 层瘴气（每层物攻、特攻 +5%，物防、特防 −5%）', 'bad');
    renderSnap(snap(app.S), true);
    showTab('moves'); refreshCmd();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    storyCuts = (opt.cuts || []).map(function (c) { return { hp: c.hp, lines: c.lines, done: false }; });
    if (opt.preStrike) preStrike();
  }
  var storyEnd = null, itemUsed = null, storyCuts = [];
  // 剧情对战：对方偷袭，开场先打出一招（玩家这一回合不行动），然后正常开始。界面上不额外说明
  async function preStrike() {
    var S = app.S; if (!S || S.over) return;
    busy = true; refreshCmd();
    await new Promise(function (r) { setTimeout(r, 450); });
    var evs = resolveTurn(S, [{ kind: 'pass' }, aiChoose(S)]);
    await play(evs);
    busy = false; afterTurn();
  }
  /* 剧情对战中途插播对话：opt.cuts = [{ hp: 700, lines: [{ n: '说话人', t: '台词' }, ...] }]
   * 对方在场精灵的体力降到 hp 以下（且没倒下）时，暂停对战，弹出对话框逐句播放，点击继续。每段只播一次 */
  function cutDue() {
    var S = app.S; if (!S || S.over || !storyCuts.length) return null;
    var foe = S.sides[1].team[S.sides[1].active];
    for (var i = 0; i < storyCuts.length; i++) if (!storyCuts[i].done && foe && !foe.fainted && foe.hp <= storyCuts[i].hp) return storyCuts[i];
    return null;
  }
  function playCut(c) {
    c.done = true;
    return new Promise(function (resolve) {
      var k = 0, box = document.createElement('div');
      box.className = 'bt-cut'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '剧情对话');
      document.body.appendChild(box);
      function draw() {
        var L = c.lines[k];
        box.innerHTML = '<div class="bt-cut-box">' + (L.n ? '<b class="bt-cut-n">' + esc(L.n) + '</b>' : '') + '<p class="' + (L.n ? '' : 'narr') + '">' + esc(L.t) + '</p><span class="bt-cut-next">' + (k < c.lines.length - 1 ? '点击继续 ▼' : '点击回到对战') + '</span></div>';
      }
      function step() { k++; if (k >= c.lines.length) { box.remove(); document.removeEventListener('keydown', key); resolve(); } else draw(); }
      function key(e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); step(); } }
      box.addEventListener('click', step); document.addEventListener('keydown', key);
      draw();
    });
  }
  /* 联网切磋（由 social.js 调用）
   * opt = { S, side, foe, mode, onAct(act), onRepl(k), onQuit(), onOver(result), onEnd() }
   * 结算都在发起方的浏览器里做，结果通过 pvpApply 播放 */
  function pvpClock() {
    if (!pvp || !pvp.deadline) return '';
    var left = Math.max(0, Math.ceil((pvp.deadline - Date.now()) / 1000));
    return left <= 30 ? '（剩余 ' + left + ' 秒，超时将自动出招）' : '';
  }
  function startPvp(opt) {
    setFieldBg(null); bgm('pvp');
    PV = opt.side; pvp = opt; pvp.waiting = false; pvp.q = Promise.resolve(); pvp.deadline = Date.now() + opt.seconds * 1000;
    app.S = opt.S; storyEnd = null; itemUsed = null;
    app.screen = 'battle'; app.logHTML = ''; $('log').innerHTML = '';
    $('builder').hidden = true; $('battle').hidden = false; $('endcard').hidden = true;
    shownIds = [null, null]; ['plate0', 'plate1'].forEach(function (id) { $(id).dataset.ready = ''; });
    castBegin(); $('btn-emote').hidden = false; $('btn-invite').hidden = false; $('btn-invite').disabled = false; $('btn-invite').textContent = '邀请全服观战';
    var me = app.S.sides[PV], foe = app.S.sides[1 - PV], nn = function (x) { return x.nick || SPMAP[x.id].name; };
    addLog(opt.brawl ? '与 ' + opt.foe + ' 的精灵大乱斗开始！' : '与 ' + opt.foe + ' 的 ' + (opt.label || opt.mode + 'v' + opt.mode) + ' 切磋开始！', 'turn');
    addLog(foe.name + '派出了【' + nn(foe.team[0]) + '】，你派出了【' + nn(me.team[0]) + '】！', '');
    addLog('对手阵容：' + foe.team.map(function (x) { return nn(x) + ' LV' + x.lv; }).join('、'), 'dmg');
    (opt.notes || []).forEach(function (t) { addLog(t, 'dmg'); });
    renderSnap(snap(app.S), true);
    showTab('moves'); refreshCmd();
    pvp.clock = setInterval(function () { if (pvp && !busy && app.S && !app.S.over) { var h = $('cmd-hint'), t = pvpClock(); if (t || /剩余/.test(h.textContent)) refreshCmd(); } }, 1000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // 播放一回合的结果；S 是结算后的战况（应战方收到的是副本）
  function pvpApply(evs, S, seconds) {
    if (!pvp) return Promise.resolve();
    var P = pvp;
    P.q = P.q.then(async function () {
      if (pvp !== P) return;
      busy = true; refreshCmd();
      await play(evs);
      if (pvp !== P) return;
      app.S = S; busy = false; P.waiting = false; P.deadline = Date.now() + (seconds || 90) * 1000;
      afterTurn();
    });
    return P.q;
  }
  // 对方掉线或离开：直接判定结果
  function pvpAbort(note, myResult) {
    if (!pvp || !app.S) return;
    var P = pvp;
    P.q = P.q.then(function () {
      if (pvp !== P || app.S.over) return;
      P.endNote = note; busy = false;
      app.S.over = myResult === 'draw' ? 'draw' : (myResult === 'win') === (PV === 0) ? 'win' : 'lose';
      addLog(note, 'bad'); showEnd();
    });
  }
  window.HSBATTLE = { renderMode: function () { renderMode(); if (app.mode !== 'brawl') renderBuilder(); }, start: startStory, startPvp: startPvp, pvpApply: pvpApply, pvpAbort: pvpAbort, pvpActive: function () { return !!pvp; },
    // 竞技对战里给每只精灵记住的配招（平衡模式切磋选技能时沿用，改了也会记回来）
    loadout: function (id) { return app.loadout[id] ? app.loadout[id].slice() : []; },
    // 观战转播：social.js 连上服务器后把发送函数交给这里
    setCaster: function (fn) { caster = fn; },
    castResync: function () { if (CAST.on && caster && app.S) { caster('start', { head: Object.assign({ resume: 1 }, CAST.head), snap: castSnap(flipSnap(snap(app.S))), log: CAST.all.slice(-60) }); } },
    castViewers: castViewers,
    castInvited: function (ok, msg) { var b = $('btn-invite'); if (ok) { b.disabled = true; b.textContent = '已邀请全服观战'; } else b.disabled = false; if (CAST.on) addLog(msg, 'dmg'); },
    castNote: function (msg) { if (CAST.on) addLog(msg, 'dmg'); },
    peerEmote: function (id) { if (!pvp) return; showEmote(1, id); castFx({ a: 'emote', i: 1, e: id }); },
    setLoadout: function (id, mv) { if (!SPMAP[id] || !Array.isArray(mv) || !mv.length) return; app.loadout[id] = mv.slice(0, 4); saveLoadout(); } };
  var shownIds = [null, null];
  /* ---------- 联网切磋：PV 是「我」在对战里的位置（0 发起方 / 1 应战方），画面始终把自己放在下方 ---------- */
  var PV = 0, pvp = null;
  function V(i) { return i ^ PV; }
  function flipSnap(sn) { return PV && sn ? { turn: sn.turn, sides: [sn.sides[1], sn.sides[0]] } : sn; }
  function hpClass(h, m) { var r = h / m; return r > 0.5 ? '' : r > 0.2 ? 'mid' : 'low'; }
  function renderSnap(sn, instant) {
    sn = flipSnap(sn);
    if (CAST.on) { CAST.snap = castSnap(sn); castQueue(); }
    var trn = app.S && app.S.training;
    $('turnNo').textContent = trn ? sn.turn : Math.min(sn.turn, MAX_TURNS);
    var left = MAX_TURNS - sn.turn; $('turnMax').textContent = trn ? '训练 · 不限回合' : left <= 0 ? '最后一回合' : '上限 ' + MAX_TURNS; $('turnMax').className = 'tmax' + (!trn && left <= 10 ? ' warn' : '');
    sn.sides.forEach(function (sd, i) {
      var pl = $('plate' + i);
      var html = '<span class="tape ' + (i ? 'r' : 'l') + '"></span>' +
        '<div class="row1"><span class="pn">' + esc(sd.name) + '</span>' + typeTips(sd, sn.sides[1 - i]) + statTip(sd, i === 1 && rankOn()) +
          '<span class="abil" tabindex="0" aria-label="特性 ' + esc(sd.ability.n) + '：' + esc(sd.ability.d) + '">特性 · ' + esc(sd.ability.n) +
          '<span class="tip" role="tooltip"><b>特性 · ' + esc(sd.ability.n) + '</b>' + esc(sd.ability.d) + (sd.ability.extra ? '<span class="tipx">' + esc(sd.ability.extra) + '</span>' : '') + '<span class="tipx">当前是否生效，看血条下方状态栏里的特性</span></span></span><span class="who">' + esc(sd.dummy ? '训练木桩' : i ? (pvp ? pvp.foe : app.S && app.S.story ? app.S.story.foe + (app.S.story.diff ? ' · ' + app.S.story.diff : '') : '对手') : '你') + '</span></div>' +
        '<div class="hpbar"><i class="' + hpClass(sd.hp, sd.maxhp) + '" style="width:' + (sd.hp / sd.maxhp * 100) + '%"></i></div>' +
        '<div class="hprow"><span>' + (sd.dummy ? '体力 ∞' : sd.hp + ' / ' + sd.maxhp) + '</span><span class="pips">' +
        sd.team.map(function (t) { var hide = i === 1 && rankOn() && !t.seen; return '<span class="' + (hide ? 'unk' : t.fainted ? 'dead' : '') + (t.active ? ' cur' : '') + '" title="' + esc(hide ? '还没派出' : t.nick || SPMAP[t.id].name) + '">' + (hide ? '?' : '') + '</span>'; }).join('') + '</span></div>' +
        '<div class="chips">' + sd.chips.map(function (c) { return '<span class="chip sc ' + c.k + '" tabindex="0">' + esc(c.t) + (c.d ? '<span class="tip" role="tooltip"><b>' + esc(c.h || c.t) + '</b>' + esc(c.d) + '</span>' : '') + '</span>'; }).join('') + '</div>';
      // 只更新内容，保留血条动画：首次整块写入，之后逐项更新
      var pkey = sd.id + '|' + sd.types.join(',') + '|' + sn.sides[1 - i].id + '|' + sn.sides[1 - i].types.join(',');
      if (!pl.dataset.ready || pl.dataset.id !== pkey) { pl.innerHTML = html; pl.dataset.ready = '1'; pl.dataset.id = pkey; }
      else {
        var bar = pl.querySelector('.hpbar i'); bar.style.width = (sd.hp / sd.maxhp * 100) + '%'; bar.className = hpClass(sd.hp, sd.maxhp);
        pl.querySelector('.hprow > span').textContent = sd.dummy ? '体力 ∞' : sd.hp + ' / ' + sd.maxhp;
        var pn = pl.querySelector('.pn'); if (pn && pn.textContent !== sd.name) pn.textContent = sd.name;   // 改名（比如泰戈尔复活后变成「热血·泰戈尔」）
        var tmp = document.createElement('div'); tmp.innerHTML = html;
        pl.querySelector('.pips').innerHTML = tmp.querySelector('.pips').innerHTML;
        pl.querySelector('.chips').innerHTML = tmp.querySelector('.chips').innerHTML;
        var lv = pl.querySelector('.lvc'), nlv = tmp.querySelector('.lvc');
        if (lv && nlv) { var open = lv.matches(':hover') || lv === document.activeElement; lv.querySelector('.tip').innerHTML = nlv.querySelector('.tip').innerHTML; if (open) fitTip({ target: lv }); }
      }
      var mon = $('mon' + i), img = mon.querySelector('img');
      if (shownIds[i] !== sd.id + '|' + (sd.img || '')) {   // 换了图（比如首领中途换形态）也要重画
        shownIds[i] = sd.id + '|' + (sd.img || ''); img.src = sd.img || SPRITES[sd.id]; img.alt = sd.name;
        mon.classList.remove('fainted'); if (!instant) restartAnim(mon, 'enter');
      }
      if (sd.fainted) mon.classList.add('fainted'); else mon.classList.remove('fainted');
      mon.classList.toggle('miasma', sd.chips.some(function (c) { return c.t.indexOf('瘴气') === 0; }));
    });
  }
  function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 900); }
  function floatNum(i, text, cls) {
    var f = document.createElement('div'); f.className = 'float ' + (cls || ''); f.textContent = text;
    $('mon' + i).appendChild(f); setTimeout(function () { f.remove(); }, 950);
  }
  function banner(text, type) {
    var b = $('banner'); b.textContent = text; b.style.color = TYPE_COLOR[type] || 'var(--ink)';
    restartAnim(b, 'show');
  }
  // 提示框超出屏幕时往里挪
  function fitTip(e) {
    var el = e.target.closest && e.target.closest('.tt, .abil, .sc'); if (!el) return;
    var tip = el.querySelector('.tip'); if (!tip) return;
    tip.style.translate = '0px 0px'; tip.classList.remove('shifted');
    var r = tip.getBoundingClientRect(), vw = document.documentElement.clientWidth, dx = 0;
    if (r.left < 8) dx = 8 - r.left; else if (r.right > vw - 8) dx = vw - 8 - r.right;
    if (dx) { tip.style.translate = Math.round(dx) + 'px 0px'; tip.classList.add('shifted'); }
  }
  document.addEventListener('mouseover', fitTip);
  document.addEventListener('focusin', fitTip);
  // 特性发动时，让对应的特性标签闪一下
  function flashAbility(text, sn) {
    if (!sn || text.indexOf('发动') < 0) return;
    sn.sides.forEach(function (sd, i) {
      var n = sd.ability.n;
      if (n && n !== '无' && text.indexOf('【' + sd.name + '】的「' + n + '」') >= 0) {
        var tag = $('plate' + i).querySelector('.abil'); if (tag) restartAnim(tag, 'flash');
      }
    });
  }
  function addLog(text, cls) {
    var h = '<p class="' + cls + '">' + esc(text).replace(/【(.+?)】/g, '<b>$1</b>') + '</p>';
    app.logHTML += h;
    if (CAST.on) { CAST.log.push([text, cls || '']); CAST.all.push([text, cls || '']); if (CAST.all.length > 80) CAST.all.shift(); castQueue(); }
    var lg = $('log'); lg.insertAdjacentHTML('beforeend', h);
    while (lg.children.length > 160) lg.removeChild(lg.firstChild);
    lg.scrollTop = lg.scrollHeight;
  }

  async function play(evs) {
    for (var k = 0; k < evs.length; k++) {
      var e = evs[k];
      switch (e.t) {
        case 'text': addLog(e.text, e.cls); renderSnap(e.snap); flashAbility(e.text, flipSnap(e.snap)); await wait(e.cls === 'turn' ? 120 : 300); break;
        case 'use': renderSnap(e.snap); castFx({ a: 'use', i: V(e.side), m: e.move, ty: e.type }); restartAnim($('mon' + V(e.side)), 'lunge' + V(e.side)); banner(e.move, e.type); await wait(450); break;
        case 'hit': renderSnap(e.snap); if (e.amount > 0) castFx({ a: 'hit', i: V(e.side), n: e.amount, c: !!e.crit }); if (app.S && app.S.training && e.side === 1) renderStats(); if (e.amount > 0) { restartAnim($('mon' + V(e.side)), 'hit'); floatNum(V(e.side), '-' + e.amount + (e.crit ? '!' : ''), e.crit ? 'crit' : ''); } await wait(480); break;
        case 'heal': renderSnap(e.snap); castFx({ a: 'heal', i: V(e.side), n: e.amount }); restartAnim($('mon' + V(e.side)), 'heal'); floatNum(V(e.side), '+' + e.amount, 'heal'); await wait(380); break;
        case 'switch': renderSnap(e.snap); await wait(520); break;
        case 'throw': renderSnap(e.snap); castFx({ a: 'throw', i: 1 }); restartAnim($('mon1'), 'throw'); await wait(900); break;
        case 'faint': renderSnap(e.snap); await wait(650); break;
        case 'scene': renderSnap(e.snap); if (e.fx && window.HSEV) window.HSEV('bossfx', { k: e.fx }); await showScene(e.lines); if (e.fx === 'past') bgm('tigerFinal'); else if (e.fx === 'rebirth') bgm('beforeEnd'); break;
        default: renderSnap(e.snap); await wait(60);
      }
    }
  }

  // 对战中的小剧情（比如困难泰戈尔复活时）：在战场上盖一层对话框，点一下翻到下一句（不点也会自己往下走）
  var SCENE_WHO = { tg: { name: '泰戈尔', img: 'tagore' }, n: null };
  function showScene(lines) {
    return new Promise(function (done) {
      var f = $('field'), box = document.createElement('div'); box.className = 'bscene'; f.appendChild(box);
      var i = 0, timer = null;
      function next() {
        clearTimeout(timer);
        if (i >= lines.length) { box.remove(); done(); return; }
        var l = lines[i++], w = SCENE_WHO[l[0]];
        box.innerHTML = (w ? '<img class="bs-img" src="' + SPRITES[w.img] + '" alt="">' : '') + '<div class="bs-say' + (w ? '' : ' narr') + '">' + (w ? '<b>' + w.name + '</b>' : '') + '<p>' + esc(l[1]) + '</p><small>点击继续</small></div>';
        timer = setTimeout(next, app.fast ? 2200 : 4200);
      }
      box.addEventListener('click', next);
      next();
    });
  }
  var tab = 'moves';
  function showTab(t) {
    tab = t; $('tab-moves').classList.toggle('on', t === 'moves'); $('tab-team').classList.toggle('on', t === 'team'); $('tab-items').classList.toggle('on', t === 'items');
    $('mgrid').hidden = t !== 'moves'; $('tgrid').hidden = t !== 'team'; $('igrid').hidden = t !== 'items';
  }
  function refreshCmd() {
    var S = app.S; if (!S) return;
    var me = act(S, PV), foe = act(S, 1 - PV), needMe = pvp ? !!(S.need && S.need[PV]) : S.needSwitch;
    var peerPick = pvp && S.need && S.need[1 - PV] && !needMe;   // 对方在选替补，我这边没事可做
    var lock = busy || !!S.over || !!(pvp && (pvp.waiting || peerPick));
    var foeTypes = typesOf(foe);
    var usable = me.moves.some(function (m) { return m.pp > 0 && !moveBlocked(me, m); });
    var html = '';
    if (!usable) html = '<button type="button" class="mv" data-mi="-1"' + (lock || needMe ? ' disabled' : '') + ' style="--tc:' + TYPE_COLOR['普通'] + '"><span class="t1"><span class="mn">挣扎</span></span><span class="md">' + STRUGGLE.d + '</span></button>';
    else me.moves.forEach(function (slot, i) {
      var m = liveMove(me, M[slot.n]), mt = mvType(me, m), e = m.cat === '变化' ? 1 : effT(mt, foeTypes);
      html += '<button type="button" class="mv" data-mi="' + i + '"' + (lock || needMe || slot.pp <= 0 || moveBlocked(me, slot) ? ' disabled' : '') + ' style="--tc:' + TYPE_COLOR[mt] + '" title="' + esc(m.d) + '">' +
        '<span class="t1"><span class="mn">' + (i + 1) + '. ' + m.name + (moveBlocked(me, slot) ? '（' + blockWhy(me, slot) + '）' : '') + '</span><span class="pp">PP ' + slot.pp + '/' + slot.max + '</span></span>' +
        '<span class="t2">' + tchip(mt) + '<span>' + m.cat + (m.power ? ' · 威力' + m.power : '') + (m.pri ? ' · 先制+' + m.pri : '') + '</span>' +
        (hitBlocked(foe, mt) && (m.cat !== '变化' || targetsFoe(m)) ? '<span class="eff0">无法命中</span>' : e > 1 ? '<span class="eff2">克制 ×' + e + '</span>' : e < 1 ? '<span class="eff0">被抵抗 ×' + e + '</span>' : '') + '</span>' +
        '<span class="md">' + esc(m.d) + '</span></button>';
    });
    $('mgrid').innerHTML = html;
    var locked = me.tm.noSwitch > 0 && !needMe;
    $('tgrid').innerHTML = S.sides[PV].team.map(function (t, k) {
      var s = SPMAP[t.id], dis = lock || t.fainted || k === S.sides[PV].active || locked;
      return '<button type="button" class="tm" data-ti="' + k + '"' + (dis ? ' disabled' : '') + '><img src="' + (t.img || SPRITES[t.id]) + '" alt="">' +
        '<span><span class="nm">' + esc(t.nick || s.name) + '</span> ' + tchips(s.types) +
        '<div class="hpbar"><i class="' + hpClass(t.hp, t.maxhp) + '" style="width:' + (t.hp / t.maxhp * 100) + '%"></i></div>' +
        '<span class="hpt">' + (t.fainted ? '已倒下' : k === S.sides[PV].active ? '出战中 · ' + t.hp + '/' + t.maxhp : t.hp + '/' + t.maxhp) + '</span></span></button>';
    }).join('');
    var its = S.items;
    $('tab-items').hidden = !its;
    if (!its && tab === 'items') showTab('moves');
    if (its) $('igrid').innerHTML = ITEM_ORDER.map(function (k) {
      var it = ITEMS[k], n = its[k] || 0, cap = !!it.cap, dis = lock || needMe || n <= 0 || (cap && (!S.wild || S.wild.noCatch)) || (!cap && me.hp >= me.maxhp);
      var rate = cap && S.wild && S.wild.noCatch ? '<span class="rate">被瘴气污染，无法捕捉</span>' : cap && S.wild && n > 0 ? '<span class="rate">当前成功率约 ' + Math.round(catchChance(S, k) * 100) + '%</span>' : cap && !S.wild ? '<span class="rate">只能对野生精灵使用</span>' : '';
      return '<button type="button" class="tm it" data-it="' + k + '"' + (dis ? ' disabled' : '') + ' title="' + esc(it.d) + '">' + itemIcon(k) +
        '<span class="it-t"><b>' + it.name + '</b><span class="cnt">持有 ' + n + '</span>' + rate + '</span></button>';
    }).join('');
    var hint = $('cmd-hint');
    hint.className = 'hint';
    if (S.over) hint.textContent = '对战结束';
    else if (busy) hint.textContent = '回合进行中……';
    else if (pvp && pvp.waiting) hint.textContent = '已选择，等待 ' + pvp.foe + ' 行动……' + pvpClock();
    else if (peerPick) hint.textContent = '等待 ' + pvp.foe + ' 选择下一只出战的精灵……' + pvpClock();
    else if (needMe) { hint.textContent = '【' + (me.nick || SPMAP[me.id].name) + '】已倒下，请选择下一只出战的精灵'; hint.className = 'hint alert'; }
    else if (locked) hint.textContent = '受「傲慢」影响，' + me.tm.noSwitch + ' 回合内无法切换精灵';
    else hint.textContent = S.training ? '点击技能对木桩出招，也可按键盘 1–4 出招。伤害统计会实时更新。' : '点击技能出招，或在「精灵」页切换精灵（切换会占用本回合），也可按键盘 1–4 出招。' + pvpClock();
    $('btn-quit').disabled = !!S.over;
    $('btn-quit').textContent = S.training ? '结束训练' : S.wild ? '逃跑' : '认输';
    if (needMe && !lock) showTab('team');
    $('tab-team').hidden = !!S.training;
  }

  async function doTurn(pAct) {
    var S = app.S; if (busy || S.over) return;
    if (pvp) { if (pvp.waiting) return; pvp.waiting = true; refreshCmd(); pvp.onAct(pAct); return; }
    busy = true; refreshCmd();
    var evs = resolveTurn(S, [pAct, S.training ? { kind: 'pass' } : aiChoose(S)]);
    await play(evs);
    for (var cut = cutDue(); cut; cut = cutDue()) { renderSnap(snap(S)); await playCut(cut); }
    busy = false; afterTurn();
  }
  function afterTurn() {
    var S = app.S; renderStats();
    renderSnap(snap(S));
    if (S.over) return showEnd();
    if (pvp ? S.need && S.need[PV] : S.needSwitch) showTab('team');
    refreshCmd();
  }
  function applyRank(result) {
    var R = fixRank(app.rank), x = { from: R.r, fromDv: R.dv, fromStars: R.stars };
    if (result === 'win') {
      R.w++; R.stars++;
      if (R.r < KING && R.stars >= 3) {
        R.stars = 0;
        if (hasDiv(R.r) && R.dv > 1) { R.dv--; x.kind = 'up'; x.msg = '晋级成功，升入' + rankFull(R.r, R.dv); }
        else { R.r++; if (hasDiv(R.r)) R.dv = DIVS; else delete R.dv; x.kind = 'up'; x.msg = '晋级成功，进入' + rankFull(R.r, R.dv) + (hasDiv(R.r) ? '' : '段位'); }
      } else x.msg = R.r === KING ? '王者段位，星数 +1' : '星数 +1，再胜 ' + (3 - R.stars) + ' 局即可晋级';
    } else if (result === 'lose') {
      R.l++;
      if (R.stars > 0) { R.stars--; x.msg = '星数 −1'; }
      else if (hasDiv(R.r) && R.dv < DIVS) { R.dv++; R.stars = 2; x.kind = 'down'; x.msg = '降至' + rankFull(R.r, R.dv); }
      else if (R.r > 0) { R.r--; if (hasDiv(R.r)) R.dv = 1; else delete R.dv; R.stars = 2; x.kind = 'down'; x.msg = '降级至' + rankFull(R.r, R.dv) + (hasDiv(R.r) ? '' : '段位'); }
      else x.msg = '黑铁为最低段位，不再降级';
    } else x.msg = '平局，星数不变';
    if (R.r > (R.best || 0)) { R.best = R.r; if (hasDiv(R.r)) R.bestDv = R.dv; else delete R.bestDv; }
    else if (R.r === R.best && hasDiv(R.r) && R.dv < (R.bestDv || DIVS + 1)) R.bestDv = R.dv;
    if (R.r === KING) R.kingBest = Math.max(R.kingBest || 0, R.stars);   // 王者达到过的最高星数（社交名片里显示）
    x.to = R.r; x.toDv = R.dv; x.toStars = R.stars; saveRank(); return x;
  }
  function showEnd() { showEnd0(); castEnd($('end-title').textContent, $('end-sub').textContent); }
  function showEnd0() {
    var S = app.S, r = S.over;
    bgmStop(1500);
    if (pvp) {
      var mine = r === 'draw' ? 'draw' : (r === 'win') === (PV === 0) ? 'win' : 'lose';
      $('end-title').textContent = mine === 'win' ? '胜利！' : mine === 'lose' ? '失败了' : '平局';
      $('end-sub').textContent = '与 ' + pvp.foe + (pvp.brawl ? ' 的精灵大乱斗' : ' 的 ' + (pvp.label || pvp.mode + 'v' + pvp.mode) + ' 切磋') + ' · 共 ' + (S.turn - 1) + ' 回合' + (pvp.endNote ? ' · ' + pvp.endNote : '') + (pvp.brawl ? '' : ' · 切磋不影响经验和段位');
      $('btn-back').textContent = pvp.brawl ? '返回竞技对战' : '返回社交';
      $('end-rank').hidden = true; $('end-hid').hidden = true;
      $('btn-again').hidden = true;
      $('endcard').hidden = false; refreshCmd();
      if (!pvp.ended) { pvp.ended = true; if (pvp.onOver) pvp.onOver(mine); }
      return;
    }
    if (S.training) {
      var L = S.training.log, tot = L.reduce(function (a, x) { return a + x.amt; }, 0), turns = Math.max(0, S.turn - (S.training.t0 || 1));
      $('end-title').textContent = r === 'lose' ? '训练中断' : '训练结束';
      $('end-sub').textContent = (r === 'lose' ? '我方精灵倒下了 · ' : '') + '共 ' + turns + ' 回合 · 总伤害 ' + tot + ' · 平均每回合 ' + (turns ? Math.round(tot / turns) : 0);
      $('end-rank').hidden = true;
      $('btn-again').textContent = '重新开始训练'; $('btn-back').textContent = '回到训练设置'; $('btn-again').hidden = false;
      $('endcard').hidden = false; refreshCmd(); return;
    }
    $('btn-back').textContent = S.wild ? '返回' + S.wild.back : S.story ? (S.story.back ? '返回' + S.story.back : '继续剧情') : '回到背包'; $('btn-again').hidden = !!S.story;
    $('end-title').textContent = r === 'caught' ? '捕捉成功！' : r === 'flee' ? '顺利逃走了' : r === 'spared' ? '手下留情' : r === 'win' ? '胜利！' : r === 'lose' ? '失败了' : '平局';
    var left = aliveIdx(S, 0).length;
    var wf = S.wild && act(S, 1);
    $('end-sub').textContent = S.wild ? (r === 'caught' ? '【' + (wf.nick || SPMAP[wf.id].name) + '】LV' + wf.lv + ' 已收入精灵仓库' : r === 'flee' ? '你带着精灵们离开了。' : r === 'spared' ? '野生的' + (wf.nick || SPMAP[wf.id].name) + '只剩最后一口气，逃走了' : r === 'win' ? '野生的' + (wf.nick || SPMAP[wf.id].name) + '倒下了，没能捕捉到它' : '你的精灵们都倒下了，先回去休整吧') + ' · 共 ' + (S.turn - 1) + ' 回合' : (S.story ? '与 ' + S.story.foe + ' 的对战 · 共 ' + (S.turn - 1) + ' 回合' : S.timeUp ? '达到 ' + MAX_TURNS + ' 回合上限，按剩余精灵数判定 · 你剩 ' + left + ' 只，对手剩 ' + aliveIdx(S, 1).length + ' 只' : '共 ' + (S.turn - 1) + ' 回合 · 你的背包还剩 ' + left + ' 只精灵能战斗');
    // 账号精灵在这场战斗中领悟的隐藏技能
    var eh = $('end-hid'), got = []; eh.hidden = true; eh.innerHTML = '';
    if (S.story) S.sides[0].team.forEach(function (x) { (x.hqGot || []).forEach(function (n) { got.push({ u: x.u, mv: n, who: x.nick || SPMAP[x.id].name }); }); });
    if (got.length) {
      eh.hidden = false; eh.innerHTML = got.map(function (g) { return '【' + esc(g.who) + '】领悟了隐藏技能「' + esc(g.mv) + '」！'; }).join('<br>');
      if (!S.hidSent) { S.hidSent = 1; if (window.HSEV) window.HSEV('hidden', got); }
    }
    var rr = $('end-rank'); rr.hidden = !rankOn(); rr.innerHTML = '';
    if (rankOn()) {
      if (!S.rankApplied) { S.rankApplied = applyRank(r); }
      var x = S.rankApplied;
      rr.innerHTML = '<div class="er-row">' + rankBadge(x.from, x.fromDv) + starsHTML(x.fromStars, x.from) + '<span class="er-arrow">→</span>' + rankBadge(x.to, x.toDv) + starsHTML(x.toStars, x.to) + '</div>' +
        '<p class="er-msg ' + (x.kind === 'up' ? 'up' : x.kind === 'down' ? 'down' : '') + '">' + esc(x.msg) + '</p>' +
        '<p class="hint">对手阵容：' + S.sides[1].team.map(function (t) { return SPMAP[t.id].name; }).join('、') + '</p>';
    }
    $('btn-again').textContent = rankOn() ? '下一局 · 重新选择阵容' : '同样的背包再来一局';
    $('endcard').hidden = false;
    refreshCmd();
    if (!S.story && !S.evSent) { S.evSent = 1; var em = window.HSEV ? window.HSEV('arena', { rank: rankOn(), result: r, quit: !!S.quit }) : null; if (em) S.evMsg = em; }
    if (S.evMsg) $('end-sub').textContent += ' · ' + S.evMsg;
  }

  $('mgrid').addEventListener('click', function (e) { var b = e.target.closest('[data-mi]'); if (b && !b.disabled) doTurn({ kind: 'move', i: +b.dataset.mi }); });
  $('tgrid').addEventListener('click', async function (e) {
    var b = e.target.closest('[data-ti]'); if (!b || b.disabled || busy) return;
    var k = +b.dataset.ti, S = app.S;
    if (pvp) {
      if (pvp.waiting) return;
      if (S.need && S.need[PV]) { pvp.waiting = true; showTab('moves'); refreshCmd(); pvp.onRepl(k); }
      else { showTab('moves'); doTurn({ kind: 'switch', to: k }); }
      return;
    }
    if (S.needSwitch) {
      busy = true; refreshCmd();
      await play(playerReplace(S, k));
      busy = false; showTab('moves'); afterTurn();
    } else { showTab('moves'); doTurn({ kind: 'switch', to: k }); }
  });
  $('tab-moves').addEventListener('click', function () { showTab('moves'); });
  $('tab-team').addEventListener('click', function () { showTab('team'); });
  $('tab-items').addEventListener('click', function () { showTab('items'); });
  $('igrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-it]'); if (!b || b.disabled || busy || !app.S || !app.S.items) return;
    var k = b.dataset.it; if (!(app.S.items[k] > 0)) return;
    app.S.items[k]--; if (itemUsed) itemUsed(k);
    showTab('moves'); doTurn({ kind: 'item', key: k });
  });
  /* 联网对战里发表情：自己这边立刻显示，再通过 social.js 发给对方；观众也能看到。3 秒内只能发一个 */
  var emoteAt = 0;
  function showEmote(i, id) {   // i：画面上的位置（0 下方的自己，1 上方的对手）
    var E0 = typeof emoteOf === 'function' ? emoteOf(id) : null; if (!E0) return;
    var mon = $('mon' + i); if (!mon) return;
    var old = mon.querySelector('.emote-bub'); if (old) old.remove();
    var b = document.createElement('div'); b.className = 'emote-bub' + (i === 0 ? ' flip' : '');   // 立绘差分都朝左：左边的自己翻过来，朝向对手
    b.innerHTML = '<img src="' + E0.img + '" alt="' + esc(E0.n) + '">';
    mon.appendChild(b); setTimeout(function () { b.remove(); }, 3200);
  }
  $('btn-emote').addEventListener('click', function (e) {
    e.stopPropagation(); var pop = $('emote-pop');
    if (pop.hidden) pop.innerHTML = EMOTES.map(function (x) { return '<button type="button" data-emote="' + x.id + '" title="' + esc(x.n) + '"><img src="' + x.img + '" alt="' + esc(x.n) + '"></button>'; }).join('');
    pop.hidden = !pop.hidden;
  });
  $('emote-pop').addEventListener('click', function (e) {
    e.stopPropagation(); var b = e.target.closest('[data-emote]'); if (!b || !pvp) return;
    if (Date.now() - emoteAt < 3000) { flashHint('表情发得太快了，稍等一下'); return; }
    emoteAt = Date.now(); $('emote-pop').hidden = true;
    showEmote(0, b.dataset.emote); castFx({ a: 'emote', i: 0, e: b.dataset.emote });
    if (pvp.onEmote) pvp.onEmote(b.dataset.emote);
  });
  document.addEventListener('click', function () { var p = $('emote-pop'); if (p) p.hidden = true; });
  function flashHint(t) { var h = $('cmd-hint'); if (h) { h.textContent = t; h.className = 'hint alert'; setTimeout(refreshCmd, 1500); } }
  $('btn-invite').addEventListener('click', function () { if (pvp && CAST.on && caster && !this.disabled) { this.disabled = true; caster('invite', {}); } });
  $('btn-speed').addEventListener('click', function () { app.fast = !app.fast; this.textContent = '动画：' + (app.fast ? '快速' : '正常'); });
  $('btn-quit').addEventListener('click', function () {
    var b = this;
    if (busy || !app.S || app.S.over) return;
    if (app.S.training) { app.S.over = 'train'; showEnd(); return; }
    if (app.S.wild) { app.S.over = 'flee'; addLog('你带着精灵们逃走了。', 'dmg'); showEnd(); return; }
    if (pvp && Date.now() - quitArmed < 3000) { b.textContent = '认输'; quitArmed = 0; pvp.onQuit(); return; }
    if (Date.now() - quitArmed < 3000) { app.S.over = 'lose'; app.S.quit = true; addLog('你认输了。', 'bad'); b.textContent = '认输'; showEnd(); return; }
    quitArmed = Date.now(); b.textContent = '再点一次确认';
    setTimeout(function () { b.textContent = '认输'; }, 3000);
  });
  $('btn-again').addEventListener('click', function () { if (rankOn()) { $('btn-back').click(); return; } $('log').innerHTML = ''; startBattle(); });
  $('btn-back').addEventListener('click', function () {
    bgmStop(400); castEnd('对战结束', '');
    if (pvp) {
      var done = pvp.onEnd; clearInterval(pvp.clock); pvp = null; PV = 0;
      app.screen = 'builder'; app.S = null; $('battle').hidden = true; $('builder').hidden = false; $('log').innerHTML = ''; $('btn-again').hidden = false; setFieldBg(null);
      shownIds = [null, null]; ['plate0', 'plate1'].forEach(function (id) { $(id).dataset.ready = ''; });
      if (done) done(); return;
    }
    if (app.S && app.S.story) {
      var endS = app.S, res = app.S.over, quit = !!app.S.quit, cb = storyEnd, seen = app.S.sides[0].team.map(function (x) { return !!x.seen; }), downs = app.S.sides[1].team.filter(function (x) { return x.fainted; }).map(function (x) { return { id: x.id, lv: x.lv }; }); storyEnd = null; itemUsed = null;
      app.screen = 'builder'; app.S = null; $('battle').hidden = true; $('builder').hidden = false; $('log').innerHTML = ''; $('btn-again').hidden = false; setFieldBg(null);
      if (cb) cb(res, seen, downs, quit, endS); return;
    }
    app.screen = 'builder'; app.S = null; $('statsbox').hidden = true; $('battle').hidden = true; $('builder').hidden = false; $('log').innerHTML = ''; renderMode(); renderBuilder();
  });
  document.addEventListener('keydown', function (e) {
    if (app.screen !== 'battle' || busy || !app.S || app.S.over || e.metaKey || e.ctrlKey) return;
    var n = +e.key; if (n >= 1 && n <= 4) { var b = $('mgrid').querySelector('[data-mi="' + (n - 1) + '"]'); if (b && !b.disabled) doTurn({ kind: 'move', i: n - 1 }); }
  });

  /* ---------------- 启动 & 热更新保留进度 ---------------- */
  function start(data) {
    try {
      if (data && data.app && data.app.loadout) {
        var d = data.app;
        if (d.mode) app.mode = d.mode;
        app.loadout = d.loadout; app.bag = d.bag; app.sel = d.sel || app.bag[0] || 'dragon'; app.fast = !!d.fast;
        $('btn-speed').textContent = '动画：' + (app.fast ? '快速' : '正常');
        if (d.screen === 'battle' && d.S) {
          app.S = d.S; app.screen = 'battle'; app.lastP = d.lastP;
          $('builder').hidden = true; $('battle').hidden = false;
          $('log').innerHTML = d.logHTML || ''; app.logHTML = d.logHTML || '';
          renderSnap(snap(app.S), true); showTab(app.S.needSwitch ? 'team' : 'moves'); refreshCmd();
          if (app.S.over) showEnd();
          return;
        }
      }
    } catch (err) { /* 旧进度不兼容就从头开始 */ }
    renderMode(); renderBuilder();
  }
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    window.claude.hot.snapshot(function () {
      return { app: { mode: app.mode, loadout: app.loadout, bag: app.bag, sel: app.sel, fast: app.fast, screen: busy ? 'builder' : app.screen, S: busy ? null : app.S, lastP: app.lastP, logHTML: app.logHTML } };
    });
  }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
