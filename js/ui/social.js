/* ==========================================================
 * 社交：玩家 / 好友 / 我的名片，以及联网切磋
 *
 * - 玩家：所有注册过的账号，显示在线状态，可以看名片、加好友、发起切磋
 * - 好友：自己加过的人（单向，像「关注」）
 * - 我的名片：最多 5 只展示精灵 + 200 字个人宣言，存在游戏存档里，跟着云存档同步
 *
 * 联网切磋：服务器从双方存档里取出出战配队的前 N 只精灵。
 * 发起方（0 号位）的浏览器负责结算每一回合，把结果和战况发给应战方（1 号位），双方各自播放。
 * 依赖：game.js 提供的 window.HSACC、battle-ui.js 提供的 window.HSBATTLE、cloud.js 提供的 window.CLOUD
 * ========================================================== */
(function () {
  'use strict';
  var A = window.HSACC, HB = window.HSBATTLE, H = window.HSUI, C = window.CLOUD;
  if (!A || !HB || !H) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = H.esc, tchips = H.tchips;
  var SHOW_MAX = 5, MOTTO_MAX = 200, TURN_SEC = 90;
  var online = !!(C && C.user && C.user());   // 用服务器打开并登录了才有社交功能
  var st = { bw: { picks: null, wait: null, inv: null }, view: null, tab: 'players', players: null, me: null, err: '', ws: null, wsOk: false, retry: 0, pend: null, inc: null, match: null, edit: null };

  /* ---------- 小工具 ---------- */
  function api(method, url, body) { return C.api(method, url, body); }
  function ago(t) {
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    return s < 120 ? '刚刚' : s < 3600 ? Math.floor(s / 60) + ' 分钟前' : s < 86400 ? Math.floor(s / 3600) + ' 小时前' : Math.floor(s / 86400) + ' 天前';
  }
  function avatar(name) { return esc(Array.from(name || '?')[0] || '?'); }
  function rankName(r) { return typeof RANKS !== 'undefined' && RANKS[r] ? RANKS[r] : ''; }
  // 王者显示星数（达到过的最高星数）
  function rankLabel(r, stars) { return rankName(r) + (r === RANKS.length - 1 && stars != null ? ' ' + stars + ' 星' : ''); }
  function rankChip(r, stars) { return r > 0 && typeof RANK_COLOR !== 'undefined' ? '<span class="chip rk" style="--rc:' + RANK_COLOR[r] + '">' + rankLabel(r, stars) + '</span>' : ''; }
  function statusOf(p) {
    if (p.me) return '<span class="dot on"></span>在线（我）';
    if (p.busy) return '<span class="dot busy"></span>对战中';
    if (p.online) return '<span class="dot on"></span>在线';
    return '<span class="dot"></span>离线' + (p.lastSeen ? ' · ' + ago(p.lastSeen) : '');
  }
  function monThumb(m) {
    var s = SPMAP[m.sid]; if (!s) return '';
    var v = A.view({ sid: m.sid, lv: m.lv });
    return '<span class="mth" title="' + esc(v.name) + ' LV' + m.lv + '"><img src="' + v.img + '" alt="' + esc(v.name) + '"><small>' + m.lv + '</small></span>';
  }
  function dialog(cls, html, wire) {
    var d = document.createElement('div'); d.className = 'soc-dlg';
    d.innerHTML = '<div class="soc-box ' + cls + '" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span>' + html + '</div>';
    document.body.appendChild(d);
    var close = function () { if (d.parentNode) d.remove(); };
    d.addEventListener('click', function (e) { if (e.target === d && !d.dataset.sticky) close(); });
    if (wire) wire(d, close);
    return { el: d, close: close };
  }

  /* ---------- 玩家列表 ---------- */
  var loading = false;
  function load() {
    if (!online || loading) return;
    loading = true;
    api('GET', '/api/players').then(function (r) {
      loading = false;
      if (r._code !== 200) { st.err = r.error || '读取失败'; render(); return; }
      st.err = ''; st.players = r.players; st.me = r.me; st.loadedAt = Date.now(); render(); renderBrawl();
    }).catch(function () { loading = false; st.err = '连不上服务器'; render(); });
  }
  setInterval(function () { if (A.page() === 'social' && !A.inBattle() && document.visibilityState === 'visible') load(); }, 30000);
  // 竞技对战的大乱斗面板开着时，20 秒刷新一次谁能匹配（别人刚读完支线、刚上线都要能看到）
  setInterval(function () { var el = $('brawl'); if (el && !el.hidden && A.page() === 'arena' && !A.inBattle() && document.visibilityState === 'visible') load(); }, 20000);

  function playerRow(p) {
    var name = p.noChar ? '（还没创建角色）' : p.name, canFight = !p.me && !p.noChar && p.online && !p.busy;
    return '<article class="prow' + (p.me ? ' me' : '') + (p.online ? ' live' : '') + '" data-user="' + esc(p.user) + '">' +
      '<button type="button" class="pr-main" data-card="' + esc(p.user) + '" aria-label="查看' + esc(name) + '的名片">' +
      '<span class="pav">' + avatar(p.name || p.user) + '</span>' +
      '<span class="pr-txt"><span class="pr-l1"><b>' + esc(name) + '</b>' + (p.title && A.titleName(p.title) ? '<span class="chip ttl">' + esc(A.titleName(p.title)) + '</span>' : '') + rankChip(p.rank, p.rankStars) + (p.fan && !p.me ? '<span class="chip fan" title="对方也把你加为好友了">互相关注</span>' : '') + '</span>' +
      '<span class="pr-l2">@' + esc(p.user) + ' · ' + statusOf(p) + '</span></span>' +
      '<span class="pr-show">' + (p.show || []).map(monThumb).join('') + '</span></button>' +
      '<span class="pr-acts">' +
      (p.me ? '<button type="button" class="btn" data-tab="mine">编辑名片</button>' :
        '<button type="button" class="btn ghost" data-home="' + esc(p.user) + '"' + (p.homeOpen ? '' : ' disabled title="对方还没有开放茶室"') + '>茶室' + (p.homeN ? ' · ' + p.homeN : '') + '</button>' +
        '<button type="button" class="btn' + (p.friend ? ' on' : '') + '" data-friend="' + esc(p.user) + '" aria-pressed="' + !!p.friend + '">' + (p.friend ? '★ 好友' : '＋ 加好友') + '</button>' +
        '<button type="button" class="btn primary" data-fight="' + esc(p.user) + '"' + (canFight ? '' : ' disabled title="' + (p.noChar ? '对方还没有创建角色' : p.busy ? '对方正在对战中' : '对方不在线') + '"') + '>切磋</button>') +
      '</span></article>';
  }

  /* ---------- 名片 ---------- */
  function cardHTML(c, opt) {
    opt = opt || {};
    if (c.noChar) return '<div class="pcard"><p class="hint">@' + esc(c.user) + ' 还没有创建游戏角色。</p></div>';
    var R = c.rankInfo || { r: 0, best: 0, w: 0, l: 0 };
    var slots = '';
    for (var i = 0; i < SHOW_MAX; i++) {
      var m = c.show[i], s = m && SPMAP[m.sid];
      if (!s) { slots += '<li class="pc-mon empty"><span>空位</span></li>'; continue; }
      var v = A.view({ sid: m.sid, lv: m.lv });
      slots += '<li class="pc-mon"><img src="' + v.img + '" alt="' + esc(v.name) + '"><b>' + esc(v.name) + '</b><span class="pc-lv">LV' + m.lv + (m.nat ? ' · ' + esc(m.nat) : '') + '</span>' +
        '<span class="tc">' + tchips(s.types) + '</span>' +
        (m.moves && m.moves.length ? '<span class="pc-mv">' + m.moves.map(function (n) { return esc(n); }).join('、') + '</span>' : '') + '</li>';
    }
    return '<div class="pcard">' +
      '<div class="pc-top"><span class="pav big">' + avatar(c.name) + '</span><div class="pc-who">' +
      '<span class="pc-title">' + esc(c.title ? A.titleName(c.title) || '做题家' : '做题家') + '</span><h3>' + esc(c.name) + '</h3>' +
      '<span class="pc-user">@' + esc(c.user) + (opt.preview ? '' : ' · ' + statusOf(c)) + '</span></div></div>' +
      '<p class="pc-stats"><span>精灵 <b>' + (c.monsN || 0) + '</b> 只</span><span>收集 <b>' + (c.speciesN || 0) + '</b> 种</span>' +
      '<span>最高段位 <b>' + (rankLabel(R.best, R.best === RANKS.length - 1 ? R.kingBest || 0 : null) || '—') + '</b>' + (R.r === RANKS.length - 1 && (R.stars || 0) !== (R.kingBest || 0) ? '（当前 ' + R.stars + ' 星）' : '') + '</span><span>竞技 <b>' + R.w + '</b> 胜 <b>' + R.l + '</b> 负</span>' +
      (c.created ? '<span>' + new Date(c.created).toLocaleDateString('zh-CN') + ' 登船</span>' : '') + '</p>' +
      '<blockquote class="pc-motto' + (c.motto ? '' : ' empty') + '">' + (c.motto ? esc(c.motto) : '这位乘员还没有写个人宣言。') + '</blockquote>' +
      '<h4 class="pc-h">展示精灵</h4><ol class="pc-show">' + slots + '</ol></div>';
  }
  function openCard(user) {
    var d = dialog('card', '<div class="pc-body"><p class="hint">读取名片中……</p></div>', function (el, close) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-x]')) return close();
        var f = e.target.closest('[data-friend]'); if (f) { toggleFriend(f.dataset.friend).then(function () { close(); openCard(user); }); return; }
        var g = e.target.closest('[data-fight]'); if (g && !g.disabled) { close(); askFight(g.dataset.fight); return; }
        var h = e.target.closest('[data-home]'); if (h && !h.disabled) { close(); openHome(h.dataset.home); }
      });
    });
    api('GET', '/api/card?user=' + encodeURIComponent(user)).then(function (c) {
      var body = d.el.querySelector('.pc-body'); if (!body) return;
      if (c._code !== 200) { body.innerHTML = '<p class="hint">' + esc(c.error || '读取失败') + '</p>'; return; }
      var canFight = !c.me && !c.noChar && c.online && !c.busy;
      body.innerHTML = cardHTML(c) + '<div class="soc-foot"><button type="button" class="btn ghost" data-x="1">关闭</button>' +
        (c.me ? '' : '<button type="button" class="btn ghost" data-home="' + esc(c.user) + '"' + (c.homeOpen ? '' : ' disabled') + '>拜访茶室</button>' +
          '<button type="button" class="btn" data-friend="' + esc(c.user) + '">' + (c.friend ? '取消好友' : '＋ 加好友') + '</button>' +
          '<button type="button" class="btn primary" data-fight="' + esc(c.user) + '"' + (canFight ? '' : ' disabled') + '>切磋</button>') + '</div>';
    }).catch(function () { var body = d.el.querySelector('.pc-body'); if (body) body.innerHTML = '<p class="hint">连不上服务器</p>'; });
  }
  function toggleFriend(user) {
    var p = (st.players || []).filter(function (x) { return x.user === user; })[0], on = !(p && p.friend);
    return api('POST', '/api/friends', { user: user, on: on }).then(function (r) {
      if (r._code !== 200) { A.toast(r.error || '操作失败'); return; }
      if (p) p.friend = on;
      A.toast(on ? '已把 @' + user + ' 加为好友。' : '已取消好友 @' + user + '。');
      render();
    }).catch(function () { A.toast('连不上服务器'); });
  }

  /* ---------- 拜访茶室 ---------- */
  function openHome(user) {
    st.view = { user: user, data: null, err: '' };
    if (A.page() !== 'social') A.go('social'); else render();
    window.scrollTo(0, 0);
    api('GET', '/api/home?user=' + encodeURIComponent(user)).then(function (r) {
      if (!st.view || st.view.user !== user) return;
      if (r._code !== 200) st.view.err = r.error || '读取失败'; else st.view.data = r;
      render();
    }).catch(function () { if (st.view) { st.view.err = '连不上服务器'; render(); } });
  }
  function homeHTML() {
    var V0 = st.view, d = V0.data, back = '<div class="crumb"><button type="button" class="btn ghost" data-back="1">‹ 返回社交</button>';
    if (!d) return back + '</div><p class="hint soc-load">' + (V0.err ? esc(V0.err) : '正在前往茶室……') + '</p>';
    if (d.noChar) return back + '</div><div class="soc-empty"><p>@' + esc(d.user) + ' 还没有创建游戏角色。</p></div>';
    if (!d.open) return back + '<b class="home-name">' + esc(d.name) + ' 的休息舱</b></div><div class="soc-empty"><p>' + esc(d.name) + ' 还没有读完「陆羽茶室」支线，茶室还没开放。</p></div>';
    var pos = A.homePos, figs = d.mons.map(function (m, i) {
      var v = A.view({ sid: m.sid, lv: m.lv }), p = pos[i] || pos[0];
      return '<div class="hm-fig" style="left:' + p[0] + '%;top:' + p[1] + '%"><button type="button" class="hm-poke" data-poke="1" aria-label="摸摸' + esc(v.name) + '"><img src="' + v.img + '" alt=""></button><span class="hm-tag">' + esc(v.name) + ' · LV' + m.lv + '</span></div>';
    }).join('');
    var left = A.teaLeft(), mine = (A.acc().teams[A.acc().active] || []).map(A.mon).filter(Boolean);
    return back + '<b class="home-name">' + esc(d.homeName) + '</b><span class="hint">' + esc(d.name) + ' 的茶室' + (d.online ? ' · 主人在线' : '') + '</span></div>' +
      '<div class="home-room"><img class="home-bg" src="' + BG.tea_p + '" alt="' + esc(d.homeName) + '">' + figs +
      (d.mons.length ? '' : '<p class="home-empty">茶室里空荡荡的，主人还没有放精灵出来展示。</p>') + '</div>' +
      (d.me ? '<p class="hint" style="margin-top:8px">这是你自己的茶室。</p>' :
      '<div class="tea-bar"><span class="tape l"></span><div class="tea-txt"><b>挑战茶室</b>' +
      '<p class="hint">用你的出战配队（' + Math.min(5, mine.length) + ' 只）挑战茶室里正在训练的 ' + d.mons.length + ' 只精灵，对手由电脑操控，用的是它们的真实等级和技能。' +
      '每天前 ' + A.TEA_DAILY + ' 场茶室对战各奖励 ' + A.fmt(A.TEA_EXP) + ' 累积经验（进经验背包），赢输都算，认输不算，0 点刷新。</p>' +
      '<p class="tea-left">今天还能领奖 <b>' + left + '</b> / ' + A.TEA_DAILY + ' 次</p></div>' +
      '<button type="button" class="btn primary" data-teafight="1"' + (d.mons.length && mine.length ? '' : ' disabled') + '>' + (d.mons.length ? '挑战茶室' : '没有可挑战的精灵') + '</button></div>');
  }

  /* ---------- 我的名片（编辑） ---------- */
  function myCard() {
    var acc = A.acc(), cd = acc.card || {}, species = {};
    acc.mons.forEach(function (m) { species[m.sid] = 1; });
    var rk = null; try { rk = JSON.parse(localStorage.getItem('hs-rank-v1') || 'null'); } catch (e) {}
    var R = rk ? { r: rk.r || 0, best: Math.max(rk.best || 0, rk.r || 0), w: rk.w || 0, l: rk.l || 0, stars: rk.stars || 0, kingBest: Math.max(rk.kingBest || 0, rk.r === RANKS.length - 1 ? rk.stars || 0 : 0) } : { r: 0, best: 0, w: 0, l: 0 };
    var ed = st.edit;
    return { user: st.me || (C.user && C.user()), name: acc.name, title: acc.title && (acc.titles || []).indexOf(acc.title) >= 0 ? acc.title : null, monsN: acc.mons.length, speciesN: Object.keys(species).length,
      created: acc.created, motto: ed.motto, rankInfo: R,
      show: ed.show.map(function (u) { var m = A.mon(u); return m && { sid: m.sid, lv: m.lv, nat: m.nat, moves: m.moves }; }).filter(Boolean) };
  }
  function startEdit() {
    var cd = A.acc().card || {};
    st.edit = { show: (cd.show || []).filter(function (u) { return A.mon(u); }).slice(0, SHOW_MAX), motto: typeof cd.motto === 'string' ? cd.motto.slice(0, MOTTO_MAX) : '', dirty: false };
  }
  function mineHTML() {
    if (!st.edit) startEdit();
    var ed = st.edit, mons = A.acc().mons.slice().sort(function (a, b) { return b.lv - a.lv || a.u - b.u; });
    return '<div class="mine">' +
      '<section class="mine-prev"><h3 class="shop-h">名片预览</h3>' + cardHTML(myCard(), { preview: true }) + '</section>' +
      '<section class="mine-edit"><h3 class="shop-h">编辑名片</h3>' +
      '<label class="me-lab" for="me-motto">个人宣言 <span class="hint" id="me-cnt">' + Array.from(ed.motto).length + ' / ' + MOTTO_MAX + '</span></label>' +
      '<textarea id="me-motto" rows="4" maxlength="' + MOTTO_MAX + '" placeholder="写点什么给其他乘员看，比如你的目标、最喜欢的精灵……">' + esc(ed.motto) + '</textarea>' +
      '<p class="me-lab">展示精灵 <span class="hint">已选 ' + ed.show.length + ' / ' + SHOW_MAX + '，按点选顺序排列</span></p>' +
      '<div class="me-pick">' + mons.map(function (m) {
        var k = ed.show.indexOf(m.u), v = A.view(m), full = k < 0 && ed.show.length >= SHOW_MAX;
        return '<button type="button" class="me-mon' + (k >= 0 ? ' on' : '') + '" data-pick="' + m.u + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + (k >= 0) + '">' +
          (k >= 0 ? '<span class="me-no">' + (k + 1) + '</span>' : '') + '<img src="' + v.img + '" alt=""><b>' + esc(v.name) + '</b><small>LV' + m.lv + '</small></button>';
      }).join('') + '</div>' +
      '<div class="soc-foot"><span class="hint" id="me-msg">' + (ed.dirty ? '有修改还没保存' : '') + '</span><button type="button" class="btn ghost" id="me-reset"' + (ed.dirty ? '' : ' disabled') + '>撤销修改</button><button type="button" class="btn primary" id="me-save"' + (ed.dirty ? '' : ' disabled') + '>保存名片</button></div>' +
      '</section></div>';
  }
  function saveCard() {
    var acc = A.acc();
    acc.card = { show: st.edit.show.slice(0, SHOW_MAX), motto: Array.from(st.edit.motto).slice(0, MOTTO_MAX).join('') };
    st.edit.dirty = false; A.save(); render();
    A.toast('名片已保存。同步到服务器后，其他乘员就能看到。');
  }

  /* ---------- 页面 ---------- */
  function render() {
    var pg = $('pg-social'); if (!pg || A.page() !== 'social' || !A.ready()) return;
    if (!online) {
      pg.innerHTML = '<div class="soc-head"><h2 class="sec">社交</h2></div><div class="soc-empty"><span class="tape l"></span><p>社交功能需要联网：用服务器网址打开游戏并登录账号后，就能看到其他乘员、加好友和切磋。</p><p class="hint">现在是双击 index.html 打开的本地版，存档只在这台电脑上。</p></div>';
      return;
    }
    var P = st.players || [], friends = P.filter(function (p) { return p.friend; }), on = P.filter(function (p) { return p.online; }).length;
    var focus = document.activeElement && document.activeElement.id === 'me-motto' ? $('me-motto').selectionStart : null;
    if (st.view) { pg.innerHTML = '<div class="soc-head"><h2 class="sec">拜访茶室</h2></div>' + homeHTML(); return; }
    var body;
    if (st.tab === 'mine') body = mineHTML();
    else if (!st.players) body = '<p class="hint soc-load">' + (st.err ? esc(st.err) + ' · <button type="button" class="btn ghost" data-reload="1">重试</button>' : '读取乘员名单中……') + '</p>';
    else {
      var list = st.tab === 'friends' ? friends : P;
      body = list.length ? '<div class="plist">' + list.map(playerRow).join('') + '</div>' :
        '<div class="soc-empty"><p>' + (st.tab === 'friends' ? '还没有好友。去「玩家」里找到想关注的人，点「加好友」。' : '还没有其他乘员。') + '</p></div>';
    }
    pg.innerHTML = '<div class="soc-head"><h2 class="sec">社交</h2><p class="hint">荆楚号上的所有乘员都在这里。点一位乘员可以看他的名片；对方在线时可以直接发起切磋，切磋不消耗体力，也不影响经验和段位。</p></div>' +
      '<div class="subbar soc-tabs" role="tablist">' +
      '<button type="button" class="sub' + (st.tab === 'players' ? ' on' : '') + '" data-tab="players" role="tab" aria-selected="' + (st.tab === 'players') + '">玩家 ' + (st.players ? P.length : '') + '</button>' +
      '<button type="button" class="sub' + (st.tab === 'friends' ? ' on' : '') + '" data-tab="friends" role="tab" aria-selected="' + (st.tab === 'friends') + '">好友 ' + (st.players ? friends.length : '') + '</button>' +
      '<button type="button" class="sub' + (st.tab === 'mine' ? ' on' : '') + '" data-tab="mine" role="tab" aria-selected="' + (st.tab === 'mine') + '">我的名片</button>' +
      '<span class="soc-on">' + (st.wsOk ? '<span class="dot on"></span>' + on + ' 人在线' : '<span class="dot"></span>正在连接服务器……') + '</span></div>' +
      body;
    if (focus != null && $('me-motto')) { var ta = $('me-motto'); ta.focus(); ta.setSelectionRange(focus, focus); }
  }
  if ($('pg-social')) {
    $('pg-social').addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-tab]'))) { st.tab = t.dataset.tab; if (st.tab === 'mine' && !st.edit) startEdit(); render(); if (st.tab !== 'mine') load(); return; }
      if ((t = e.target.closest('[data-reload]'))) { load(); return; }
      if ((t = e.target.closest('[data-back]'))) { st.view = null; render(); load(); return; }
      if ((t = e.target.closest('[data-home]'))) { if (!t.disabled) openHome(t.dataset.home); return; }
      if ((t = e.target.closest('[data-poke]'))) { var fig = t.closest('.hm-fig'); fig.classList.remove('hop'); void fig.offsetWidth; fig.classList.add('hop'); return; }
      if ((t = e.target.closest('[data-teafight]'))) {
        var d = st.view && st.view.data; if (!d || !d.mons.length || t.disabled) return;
        var foe = d.mons.map(A.spec).filter(Boolean);
        if (foe.length) A.teaFight({ owner: d.name, foe: foe, onDone: function () { render(); } });
        return;
      }
      if ((t = e.target.closest('[data-friend]'))) { toggleFriend(t.dataset.friend); return; }
      if ((t = e.target.closest('[data-fight]'))) { if (!t.disabled) askFight(t.dataset.fight); return; }
      if ((t = e.target.closest('[data-card]'))) { openCard(t.dataset.card); return; }
      if ((t = e.target.closest('[data-pick]'))) {
        var u = +t.dataset.pick, ed = st.edit, k = ed.show.indexOf(u);
        if (k >= 0) ed.show.splice(k, 1); else if (ed.show.length < SHOW_MAX) ed.show.push(u);
        ed.dirty = true; render(); return;
      }
      if (e.target.id === 'me-save') { saveCard(); return; }
      if (e.target.id === 'me-reset') { startEdit(); render(); return; }
    });
    $('pg-social').addEventListener('input', function (e) {
      if (e.target.id !== 'me-motto') return;
      st.edit.motto = Array.from(e.target.value).slice(0, MOTTO_MAX).join(''); st.edit.dirty = true;
      $('me-cnt').textContent = Array.from(st.edit.motto).length + ' / ' + MOTTO_MAX;
      $('me-save').disabled = false; $('me-reset').disabled = false; $('me-msg').textContent = '有修改还没保存';
      var pm = document.querySelector('.mine-prev .pc-motto');
      if (pm) { pm.textContent = st.edit.motto || '这位乘员还没有写个人宣言。'; pm.classList.toggle('empty', !st.edit.motto); }
    });
  }

  /* ---------- 和服务器的实时连接（在线状态、切磋） ---------- */
  function send(obj) {
    if (!st.ws || st.ws.readyState !== 1) return false;
    // 战况里记录隐藏技能领悟进度的字段（hq 开头）互相引用，对方也用不到，发送前去掉
    st.ws.send(JSON.stringify(obj, function (k, v) { return k.slice(0, 2) === 'hq' ? undefined : v; }));
    return true;
  }
  function connect() {
    if (!online) return;
    var ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return retry(); }
    st.ws = ws;
    ws.onopen = function () { ws.send(JSON.stringify({ type: 'auth', token: C.token() })); };
    ws.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = function () {
      if (st.ws !== ws) return;
      st.wsOk = false; st.ws = null; render();
      if (st.match && HB.pvpActive()) { st.match.aborted = 'self'; HB.pvpAbort('你和服务器的连接断开了，对战中止', 'lose'); }
      if (st.bw.wait) { st.bw.wait = null; A.toast('和服务器的连接断开了，大乱斗匹配已取消'); }
      closeBwInvite(); renderBrawl();
      if (st.pend) { closePend(); A.toast('和服务器的连接断开了，切磋邀请已取消'); }
      if (st.inc) { st.inc.dlg.close(); st.inc = null; }
      retry();
    };
  }
  function retry() { st.retry = Math.min(st.retry + 1, 6); setTimeout(connect, [1, 2, 5, 10, 20, 30][st.retry - 1] * 1000); }

  function onMsg(m) {
    switch (m.type) {
      case 'authed': st.wsOk = true; st.retry = 0; load(); render(); renderBrawl(); break;
      case 'brawl-wait': if (st.bw.wait) { st.bw.wait.id = m.id; st.bw.wait.n = m.n; st.bw.wait.deadline = Date.now() + m.seconds * 1000; } renderBrawl(); break;
      case 'brawl-invite': brawlInvite(m); break;
      case 'brawl-end': brawlEnd(m); break;
      case 'auth-fail': st.wsOk = false; break;
      case 'presence':
        (st.players || []).forEach(function (p) { if (p.user === m.user) { p.online = m.online; p.busy = m.busy; if (!m.online) p.lastSeen = Date.now(); } });
        if (st.players && !(st.players || []).some(function (p) { return p.user === m.user; })) load();
        if (st.tab !== 'mine') render();
        renderBrawl();
        break;
      case 'ch-sent': if (st.pend) { st.pend.id = m.id; st.pend.deadline = Date.now() + m.seconds * 1000; drawPend(); } break;
      case 'ch-end': chEnd(m); break;
      case 'challenged': challenged(m); break;
      case 'match': startMatch(m); break;
      case 'mm': mmMsg(m.data || {}); break;
      case 'mm-end':
        if (st.match && m.reason === 'left') { st.match.aborted = 'peer'; HB.pvpAbort(st.match.foe + ' 离开了对战，你获胜', 'win'); stopHost(); }
        break;
    }
  }

  /* ---------- 发起切磋 ---------- */
  function askFight(user) {
    if (!st.wsOk) { A.toast('还没连上服务器，请稍后再试'); return; }
    if (st.pend) { A.toast('你已经在等待别人回应了'); return; }
    var p = (st.players || []).filter(function (x) { return x.user === user; })[0] || { user: user, name: user, teamN: 0 };
    var acc = A.acc(), mine = (acc.teams[acc.active] || []).map(A.mon).filter(Boolean);
    if (!mine.length) { A.toast('你的出战配队里还没有精灵，先去「精灵背包」配队'); return; }
    var mode = Math.min(3, Math.max(1, mine.length >= 3 ? 3 : 1));
    dialog('fight', '<span class="step">切磋</span><h2>向 ' + esc(p.name || user) + ' 宣战</h2>' +
      '<div class="seg fm-seg" role="radiogroup" aria-label="对战规模">' + [1, 3, 5].map(function (n) {
        return '<label><input type="radio" name="fm" value="' + n + '"' + (n === mode ? ' checked' : '') + '><span>' + n + 'v' + n + '</span></label>';
      }).join('') + '</div>' +
      '<p class="hint" id="fm-note"></p>' +
      '<div class="fm-team" id="fm-team"></div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-x="1">取消</button><button type="button" class="btn primary" id="fm-go">宣战</button></div>',
      function (el, close) {
        function upd() {
          var n = +el.querySelector('input[name=fm]:checked').value;
          el.querySelector('#fm-note').textContent = '双方各派出当前出战配队的前 ' + n + ' 只精灵（不足 ' + n + ' 只就全部上场），按配队顺序出场。对方的配队里有 ' + (p.teamN || '?') + ' 只。';
          el.querySelector('#fm-team').innerHTML = '<b>你的出场精灵</b>' + mine.slice(0, n).map(function (m) { return monThumb(m); }).join('');
        }
        upd();
        el.addEventListener('change', upd);
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-x]')) return close();
          if (e.target.id !== 'fm-go') return;
          var n = +el.querySelector('input[name=fm]:checked').value;
          e.target.disabled = true; e.target.textContent = '正在同步存档……';
          C.flush().then(function () {
            close();
            st.pend = { to: user, toName: p.name || user, mode: n, id: null, deadline: Date.now() + 30000 };
            if (!send({ type: 'challenge', to: user, mode: n })) { st.pend = null; A.toast('连接断开了，请稍后再试'); return; }
            drawPend();
          });
        });
      });
  }
  function drawPend() {
    var P = st.pend; if (!P) return;
    if (!P.dlg) {
      P.dlg = dialog('wait', '<span class="step">切磋 · ' + P.mode + 'v' + P.mode + '</span><h2>等待 ' + esc(P.toName) + ' 回应</h2><p class="hint" id="pd-left"></p>' +
        '<div class="soc-foot"><button type="button" class="btn ghost" id="pd-x">取消宣战</button></div>', function (el) {
          el.dataset.sticky = '1';
          el.querySelector('#pd-x').addEventListener('click', function () { if (P.id) send({ type: 'ch-cancel', id: P.id }); closePend(); });
        });
      P.iv = setInterval(function () { var l = P.dlg.el.querySelector('#pd-left'); if (l) l.textContent = '对方会看到弹窗，' + Math.max(0, Math.ceil((P.deadline - Date.now()) / 1000)) + ' 秒内没回应就自动取消。'; }, 250);
    }
  }
  function closePend() { var P = st.pend; if (!P) return; clearInterval(P.iv); if (P.dlg) P.dlg.close(); st.pend = null; }
  function chEnd(m) {
    if (m.side === 'from' || (!m.side && st.pend)) {
      var who = st.pend ? st.pend.toName : '对方';
      closePend();
      var R = { declined: who + ' 拒绝了你的切磋邀请。', timeout: who + ' 没有回应，邀请已取消。', busy: who + ' 正在忙，暂时不能切磋。', gone: who + ' 已经离开了。', cancel: '' };
      var t = m.reason === 'error' ? m.msg : R[m.reason];
      if (t) A.toast(t);
      load();
    } else if (st.inc && st.inc.id === m.id) {
      var nm = st.inc.fromName; st.inc.close(); st.inc = null;
      if (m.reason === 'cancel') A.toast(nm + ' 取消了宣战。');
      else if (m.reason === 'timeout') A.toast('没来得及回应 ' + nm + ' 的切磋邀请。');
    }
  }

  /* ---------- 被宣战：直接弹窗 ---------- */
  function challenged(m) {
    if (!A.ready() || A.inBattle() || st.match || st.pend || st.inc || st.bw.wait) { send({ type: 'ch-reply', id: m.id, ok: false, reason: 'busy' }); return; }
    var acc = A.acc(), mine = (acc.teams[acc.active] || []).map(A.mon).filter(Boolean).slice(0, m.mode);
    var deadline = Date.now() + m.seconds * 1000, iv;
    var d = dialog('incoming', '<span class="step">⚔ 宣战</span><h2>' + esc(m.fromName) + ' 向你发起切磋！</h2>' +
      '<p><b>' + m.mode + 'v' + m.mode + '</b> · 双方各派出出战配队的前 ' + m.mode + ' 只精灵。切磋不影响经验和段位。</p>' +
      '<div class="fm-team"><b>你的出场精灵</b>' + (mine.length ? mine.map(monThumb).join('') : '<span class="hint">出战配队是空的</span>') + '</div>' +
      '<p class="hint" id="in-left"></p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-card="1">看看对方名片</button><button type="button" class="btn" id="in-no">拒绝</button><button type="button" class="btn primary" id="in-yes">接受</button></div>',
      function (el, close) {
        el.dataset.sticky = '1';
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-card]')) { openCard(m.from); return; }
          if (e.target.id === 'in-no') { send({ type: 'ch-reply', id: m.id, ok: false }); st.inc = null; close(); return; }
          if (e.target.id === 'in-yes') {
            e.target.disabled = true; e.target.textContent = '正在同步存档……';
            C.flush().then(function () { send({ type: 'ch-reply', id: m.id, ok: true }); });
          }
        });
      });
    var close0 = d.close;
    st.inc = { id: m.id, fromName: m.fromName, dlg: d, close: function () { clearInterval(iv); close0(); } };
    iv = setInterval(function () { var l = d.el.querySelector('#in-left'); if (l) l.textContent = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) + ' 秒后自动拒绝'; }, 250);
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {}
  }

  /* ---------- 对战 ---------- */
  function startMatch(m) {
    closePend(); if (st.inc) { st.inc.close(); st.inc = null; }
    st.bw.wait = null; closeBwInvite();
    [].forEach.call(document.querySelectorAll('.soc-dlg'), function (d) { d.remove(); });
    st.match = { id: m.id, side: m.side, mode: m.mode, foe: m.peerName, names: m.names, brawl: !!m.brawl };
    if (m.brawl) st.match.notes = brawlNotes(m);
    if (m.side === 0) {
      var mk = m.brawl ? A.brawlSpec : A.spec;
      var p = (m.teams[0] || []).map(mk).filter(Boolean), a = (m.teams[1] || []).map(mk).filter(Boolean);
      var S = newBattle(p, a);
      S.pvp = { mode: m.mode, brawl: !!m.brawl }; S.sides[0].name = m.names[0]; S.sides[1].name = m.names[1];
      st.match.S = S;
      send({ type: 'mm', id: m.id, data: { k: 'init', S: S } });
      begin(S);
      hostPhase('act');
    }
    // 应战方等发起方发来 init
  }
  function begin(S) {
    var M0 = st.match;
    A.enterBattle();
    HB.startPvp({ S: S, side: M0.side, foe: M0.foe, mode: M0.mode, seconds: TURN_SEC, notes: M0.notes, brawl: M0.brawl,
      onAct: function (a) { if (M0.side === 0) hostGot(0, 'act', a); else send({ type: 'mm', id: M0.id, data: { k: 'act', a: a } }); },
      onRepl: function (k) { if (M0.side === 0) hostGot(0, 'repl', k); else send({ type: 'mm', id: M0.id, data: { k: 'repl', i: k } }); },
      onQuit: function () { if (M0.side === 0) hostQuit(0); else send({ type: 'mm', id: M0.id, data: { k: 'quit' } }); },
      onOver: function (mine) {
        stopHost(); send({ type: 'mm-over', id: M0.id });
        if (M0.brawl) {
          var none = M0.quitSide === M0.side || M0.aborted === 'self';
          var r = A.brawlReward(mine, none);
          var txt = none ? '认输或自己掉线的大乱斗没有奖励。' : r.give > 0 ? '大乱斗奖励：累积经验 +' + A.fmt(r.give) + (r.give < r.want ? '（已达今日上限）' : '') + '，今天累计 ' + A.fmt(r.today) + ' / ' + A.fmt(r.cap) + '。' : '今天的大乱斗经验已经达到上限 ' + A.fmt(r.cap) + '，明天再来。';
          setTimeout(function () { A.toast(txt); }, 600);
        }
      },
      onEnd: function () { var bw = M0.brawl; st.match = null; if (bw) { A.leaveBattle(); A.go('arena'); } else A.leaveBattle(); load(); }
    });
  }
  function mmMsg(d) {
    var M0 = st.match; if (!M0) return;
    if (M0.side === 1) {
      if (d.k === 'init') begin(d.S);
      else if (d.k === 'turn') { if (d.quit != null) M0.quitSide = d.quit; HB.pvpApply(d.evs || [], d.S, d.sec); }
      return;
    }
    if (d.k === 'act') hostGot(1, 'act', d.a);
    else if (d.k === 'repl') hostGot(1, 'repl', d.i);
    else if (d.k === 'quit') hostQuit(1);
  }

  /* ---------- 发起方：等双方都选好，结算，把结果发给对方 ---------- */
  function hostPhase(ph) {
    var M0 = st.match; if (!M0) return;
    var S = M0.S;
    M0.phase = ph; M0.pend = [null, null];
    if (ph === 'repl') M0.need = [!!(S.need && S.need[0]), !!(S.need && S.need[1])];
    clearTimeout(M0.timer);
    if (ph !== 'over') M0.timer = setTimeout(autoFill, (TURN_SEC + 15) * 1000);   // 多给 15 秒播放动画的时间
  }
  function stopHost() { if (st.match) { clearTimeout(st.match.timer); st.match.phase = 'over'; } }
  function usableMoves(m) { return m.moves.map(function (x, k) { return x.pp > 0 && !moveBlocked(m, x) ? k : -1; }).filter(function (k) { return k >= 0; }); }
  function autoAct(S, i) { var u = usableMoves(act(S, i)); return { kind: 'move', i: u.length ? u[0] : -1 }; }
  function autoRepl(S, i) { return aliveIdx(S, i).filter(function (k) { return k !== S.sides[i].active; })[0]; }
  // 检查对方发来的行动是否合法，不合法就当作自动出招
  function checkAct(S, i, a) {
    var m = act(S, i), u = usableMoves(m);
    if (a && a.kind === 'move') {
      if (a.i === -1 && !u.length) return { kind: 'move', i: -1 };
      if (u.indexOf(a.i) >= 0) return { kind: 'move', i: a.i };
    }
    if (a && a.kind === 'switch') {
      var k = a.to | 0, t = S.sides[i].team[k];
      if (t && !t.fainted && k !== S.sides[i].active && !(m.tm.noSwitch > 0)) return { kind: 'switch', to: k };
    }
    return autoAct(S, i);
  }
  function checkRepl(S, i, k) { var t = S.sides[i].team[k | 0]; return t && !t.fainted && (k | 0) !== S.sides[i].active ? k | 0 : autoRepl(S, i); }
  function hostGot(i, kind, v) {
    var M0 = st.match; if (!M0 || M0.side !== 0 || M0.phase !== kind) return;
    var S = M0.S;
    if (kind === 'act') { if (M0.pend[i]) return; M0.pend[i] = checkAct(S, i, v); }
    else { if (!M0.need[i] || M0.pend[i] != null) return; M0.pend[i] = checkRepl(S, i, v); }
    tryResolve();
  }
  function autoFill() {
    var M0 = st.match; if (!M0 || M0.phase === 'over') return;
    var S = M0.S;
    [0, 1].forEach(function (i) {
      if (M0.phase === 'act' && !M0.pend[i]) M0.pend[i] = autoAct(S, i);
      if (M0.phase === 'repl' && M0.need[i] && M0.pend[i] == null) M0.pend[i] = autoRepl(S, i);
    });
    tryResolve();
  }
  function tryResolve() {
    var M0 = st.match, S = M0.S, evs;
    if (M0.phase === 'act') {
      if (!M0.pend[0] || !M0.pend[1]) return;
      evs = resolveTurn(S, M0.pend);
    } else if (M0.phase === 'repl') {
      if ((M0.need[0] && M0.pend[0] == null) || (M0.need[1] && M0.pend[1] == null)) return;
      evs = pvpReplace(S, M0.pend);
    } else return;
    var next = S.over ? 'over' : S.need && (S.need[0] || S.need[1]) ? 'repl' : 'act';
    hostPhase(next);
    send({ type: 'mm', id: M0.id, data: { k: 'turn', evs: evs, S: S, sec: TURN_SEC } });
    HB.pvpApply(evs, S, TURN_SEC);
  }
  function hostQuit(i) {
    var M0 = st.match; if (!M0 || M0.side !== 0 || M0.phase === 'over') return;
    var S = M0.S, evs = [];
    S.over = i === 0 ? 'lose' : 'win'; M0.quitSide = i;
    evs.push({ t: 'text', text: S.sides[i].name + '认输了。', cls: 'bad', snap: snap(S) });
    evs.push({ t: 'over', result: S.over, snap: snap(S) });
    hostPhase('over');
    send({ type: 'mm', id: M0.id, data: { k: 'turn', evs: evs, S: S, sec: TURN_SEC, quit: i } });
    HB.pvpApply(evs, S, TURN_SEC);
  }

  /* ---------- 精灵大乱斗 ----------
   * 竞技对战的第三种模式。选 3 只开始匹配，其他在线玩家收到小弹窗，先接受的人和你对战。 */
  function myTeam() { var a = A.acc(); return a ? (a.teams[a.active] || []).map(A.mon).filter(Boolean) : []; }
  function matchable() { return (st.players || []).filter(function (p) { return !p.me && !p.noChar && p.brawl && p.online && !p.busy; }).length; }
  function validPicks(team) {
    var us = team.map(function (m) { return m.u; });
    if (!st.bw.picks) st.bw.picks = us.slice(0, 3);
    st.bw.picks = st.bw.picks.filter(function (u) { return us.indexOf(u) >= 0; });
    return st.bw.picks;
  }
  function pickGrid(team, picks, attr) {
    return '<div class="me-pick bw-pick">' + team.map(function (m) {
      var k = picks.indexOf(m.u), v = A.view(m), full = k < 0 && picks.length >= 3, s = SPMAP[m.sid];
      return '<button type="button" class="me-mon' + (k >= 0 ? ' on' : '') + '" ' + attr + '="' + m.u + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + (k >= 0) + '">' +
        (k >= 0 ? '<span class="me-no">' + (k + 1) + '</span>' : '') + '<img src="' + v.img + '" alt=""><b>' + esc(v.name) + '</b><small>' + s.types.join(' / ') + '</small></button>';
    }).join('') + '</div>';
  }
  function renderBrawl() {
    var el = $('brawl'); if (!el || el.hidden || !A.ready() || !A.brawlOpen()) return;
    var B = A.BRAWL, today = A.brawlToday();
    var rules = '<ul class="bw-rules"><li>只有其他玩家在线时才能开始，匹配后他们会收到小弹窗，先接受的人成为你的对手。</li>' +
      '<li>每人从出战配队里选 <b>3 只</b>（出战配队至少要有 3 只）。</li>' +
      '<li>双方的 6 只精灵统一为 <b>LV' + B.lv + '</b>，学会所有隐藏技能，配招为技能表的最后 4 个，没有学习力，性格随机。</li>' +
      '<li>6 只打乱后随机分给两人各 3 只，你可能会用到对方的精灵。</li>' +
      '<li>胜者 <b>' + A.fmt(B.win) + '</b>、败者 <b>' + A.fmt(B.lose) + '</b> 累积经验（平局各 ' + A.fmt(B.lose) + '，认输没有），每天最多 ' + A.fmt(B.cap) + '。</li></ul>' +
      '<div class="bw-prog"><span>今天的大乱斗经验</span><b>' + A.fmt(today) + ' / ' + A.fmt(B.cap) + '</b><span class="pbar"><i style="width:' + Math.min(100, today / B.cap * 100) + '%"></i></span></div>';
    if (!online) { el.innerHTML = '<div class="bw-card"><span class="tape l"></span><h2 class="sec">精灵大乱斗</h2>' + rules + '<p class="hint">大乱斗需要联网：用服务器网址打开游戏并登录后才能匹配。</p></div>'; return; }
    var team = myTeam(), picks = validPicks(team), n = matchable(), W = st.bw.wait;
    var sub = $('brawl-sub'); if (sub && A.brawlOpen()) sub.textContent = st.wsOk ? (n ? '现在有 ' + n + ' 位玩家可以匹配' : '暂时没有可以匹配的乘员') : '正在连接服务器……';
    var foot;
    if (W) foot = '<div class="bw-wait"><span class="dot busy"></span><span>正在匹配……已邀请 ' + (W.n || '?') + ' 位在线玩家，<b id="bw-left">' + Math.max(0, Math.ceil((W.deadline - Date.now()) / 1000)) + '</b> 秒后没人接受就自动取消</span><button type="button" class="btn ghost" id="bw-cancel">取消匹配</button></div>';
    else {
      var why = !st.wsOk ? '正在连接服务器……' : team.length < 3 ? '出战配队里至少要有 3 只精灵，先去「精灵背包」配队' : picks.length !== 3 ? '还要选 ' + (3 - picks.length) + ' 只' : !n ? '现在没有可以匹配的乘员（对方要在线，并且也在孝感大厅开放了大乱斗）' : '';
      foot = '<div class="soc-foot"><span class="hint' + (why ? ' red' : '') + '">' + (why || '准备就绪') + '</span><button type="button" class="btn primary" id="bw-go"' + (why ? ' disabled' : '') + '>开始匹配</button></div>';
    }
    el.innerHTML = '<div class="bw-card"><span class="tape l"></span><span class="tape r"></span><div class="bw-head"><h2 class="sec">精灵大乱斗</h2><span class="soc-on">' + (st.wsOk ? '<span class="dot' + (n ? ' on' : '') + '"></span>' + n + ' 人可匹配' : '<span class="dot"></span>连接中') + '</span></div>' + rules +
      '<h3 class="shop-h">选 3 只参战 <span class="hint">从出战配队里选，按点选顺序</span></h3>' + (team.length ? pickGrid(team, picks, 'data-bwpick') : '<p class="hint">出战配队是空的。</p>') + foot + '</div>';
    if (st.wsOk && (!st.players || Date.now() - (st.loadedAt || 0) > 10000)) load();
  }
  if ($('brawl')) $('brawl').addEventListener('click', function (e) {
    var t = e.target.closest('[data-bwpick]');
    if (t && !st.bw.wait) { var u = +t.dataset.bwpick, P = st.bw.picks, k = P.indexOf(u); if (k >= 0) P.splice(k, 1); else if (P.length < 3) P.push(u); renderBrawl(); return; }
    if (e.target.id === 'bw-go') {
      e.target.disabled = true; e.target.textContent = '正在同步存档……';
      C.flush().then(function () {
        st.bw.wait = { id: null, n: 0, deadline: Date.now() + 60000 };
        if (!send({ type: 'brawl-start', us: st.bw.picks.slice(0, 3) })) { st.bw.wait = null; A.toast('连接断开了，请稍后再试'); }
        renderBrawl();
      });
      return;
    }
    if (e.target.id === 'bw-cancel') { if (st.bw.wait && st.bw.wait.id) send({ type: 'brawl-cancel', id: st.bw.wait.id }); st.bw.wait = null; renderBrawl(); }
  });
  setInterval(function () { var l = $('bw-left'); if (l && st.bw.wait) l.textContent = Math.max(0, Math.ceil((st.bw.wait.deadline - Date.now()) / 1000)); }, 500);

  // 别人在匹配：右下角小弹窗
  function closeBwInvite() { var I = st.bw.inv; if (!I) return; clearInterval(I.iv); if (I.el.parentNode) I.el.remove(); if (I.dlg) I.dlg.close(); st.bw.inv = null; }
  function brawlInvite(m) {
    if (!A.ready() || !A.brawlOpen() || A.inBattle() || st.match || st.bw.wait || st.pend || st.inc || st.bw.inv) return;   // 没开放或正忙就不打扰
    var el = document.createElement('div'); el.className = 'bw-pop'; el.setAttribute('role', 'status');
    el.innerHTML = '<b>⚔ 精灵大乱斗</b><span>' + esc(m.fromName) + ' 正在找人打大乱斗</span><span class="hint" id="bwp-left"></span>' +
      '<div class="bw-pop-btns"><button type="button" class="btn ghost" data-bwno="1">忽略</button><button type="button" class="btn primary" data-bwyes="1">接受</button></div>';
    document.body.appendChild(el);
    var I = st.bw.inv = { id: m.id, from: m.from, fromName: m.fromName, el: el, deadline: Date.now() + m.seconds * 1000 };
    I.iv = setInterval(function () { var l = el.querySelector('#bwp-left'); if (l) l.textContent = Math.max(0, Math.ceil((I.deadline - Date.now()) / 1000)) + ' 秒内有效'; if (Date.now() > I.deadline) closeBwInvite(); }, 250);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-bwno]')) { closeBwInvite(); return; }
      if (e.target.closest('[data-bwyes]')) brawlAcceptPick();
    });
  }
  function brawlAcceptPick() {
    var I = st.bw.inv; if (!I) return;
    var team = myTeam();
    if (team.length < 3) { A.toast('出战配队里至少要有 3 只精灵才能参加大乱斗，先去「精灵背包」配队。'); closeBwInvite(); return; }
    var picks = validPicks(team).slice();
    I.el.hidden = true;
    I.dlg = dialog('bw-accept', '<span class="step">精灵大乱斗 · 接受 ' + esc(I.fromName) + '</span><h2>选 3 只参战</h2>' +
      '<p class="hint">6 只精灵会统一到 LV' + A.BRAWL.lv + '，打乱后每人随机分 3 只。<b id="bwa-left"></b></p><div id="bwa-grid"></div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-x="1">算了</button><button type="button" class="btn primary" id="bwa-go">确认接受</button></div>',
      function (d, close) {
        d.dataset.sticky = '1';
        function draw() { d.querySelector('#bwa-grid').innerHTML = pickGrid(team, picks, 'data-bwa'); d.querySelector('#bwa-go').disabled = picks.length !== 3; }
        draw();
        d.addEventListener('click', function (e) {
          var t = e.target.closest('[data-bwa]');
          if (t) { var u = +t.dataset.bwa, k = picks.indexOf(u); if (k >= 0) picks.splice(k, 1); else if (picks.length < 3) picks.push(u); draw(); return; }
          if (e.target.closest('[data-x]')) { closeBwInvite(); return; }
          if (e.target.id === 'bwa-go' && picks.length === 3) {
            e.target.disabled = true; e.target.textContent = '正在同步存档……'; st.bw.picks = picks.slice();
            C.flush().then(function () { if (st.bw.inv) send({ type: 'brawl-accept', id: I.id, us: picks.slice() }); });
          }
        });
      });
    var tick = setInterval(function () { var l = I.dlg && I.dlg.el.querySelector('#bwa-left'); if (!l || !st.bw.inv) return clearInterval(tick); l.textContent = '还剩 ' + Math.max(0, Math.ceil((I.deadline - Date.now()) / 1000)) + ' 秒。'; }, 250);
  }
  function brawlEnd(m) {
    if (m.side === 'from') {
      if (m.reason === 'taken') return;   // 有人接受了，马上会收到 match
      var had = !!st.bw.wait; st.bw.wait = null; renderBrawl();
      var R = { timeout: '没有人接受你的大乱斗邀请，匹配已取消。', cancel: '' };
      var t = m.reason === 'error' ? m.msg : R[m.reason];
      if (t && (had || m.reason === 'error')) A.toast(t);
    } else if (st.bw.inv && (!m.id || st.bw.inv.id === m.id)) {
      var nm = st.bw.inv.fromName, wasOpen = !!st.bw.inv.dlg; closeBwInvite();
      if (wasOpen) A.toast(m.reason === 'taken' ? nm + ' 的大乱斗已经被别人接下了。' : m.reason === 'error' ? m.msg : nm + ' 取消了大乱斗匹配。');
    }
  }
  // 分牌结果写进战斗记录：谁拿到了谁的精灵
  function brawlNotes(m) {
    var mine = m.teams[m.side], owners = m.names;
    return ['精灵大乱斗：双方 6 只精灵已统一为 LV' + A.BRAWL.lv + '，打乱后随机分配。',
      '你分到了：' + mine.map(function (x) { var v = A.view({ sid: x.sid, lv: A.BRAWL.lv }); return v.name + '（' + (x.owner === m.side ? '你的' : owners[x.owner] + ' 的') + '，' + x.nat + '）'; }).join('、')];
  }

  window.HSBRAWL = { render: renderBrawl };
  window.HSSOCIAL = { render: function () { if (!st.players) load(); render(); } };
  connect();
  if (A.page() === 'social') window.HSSOCIAL.render();
  renderBrawl();
})();
