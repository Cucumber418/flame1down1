/* ==========================================================
 * 社交：玩家 / 好友 / 我的名片，以及联网切磋
 *
 * - 玩家：所有注册过的账号，显示在线状态，可以看名片、加好友、发起切磋
 * - 好友：自己加过的人（单向，像「关注」）
 * - 我的名片：最多 5 只展示精灵 + 200 字个人宣言，存在游戏存档里，跟着云存档同步
 *
 * 联网切磋：
 *   常规模式：服务器从双方存档里取出出战配队的前 N 只精灵，按背包里的练度对战。
 *   平衡模式：接受后先进入选人阶段（普通盲选 / 5v5 才有的竞技征召），服务器当裁判；精灵统一 LV60、技能自选、性格无修正、无学习力和纹章。
 * 发起方（0 号位）的浏览器负责结算每一回合，把结果和战况发给应战方（1 号位），双方各自播放。
 * 依赖：game.js 提供的 window.HSACC、battle-ui.js 提供的 window.HSBATTLE、cloud.js 提供的 window.CLOUD
 * ========================================================== */
(function () {
  'use strict';
  var A = window.HSACC, HB = window.HSBATTLE, H = window.HSUI, C = window.CLOUD;
  if (!A || !HB || !H) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = H.esc, tchips = H.tchips;
  var SHOW_MAX = 5, HELP_MAX = 3, MOTTO_MAX = 200, TURN_SEC = 90;
  var online = !!(C && C.user && C.user());   // 用服务器打开并登录了才有社交功能
  var hb = { owner: null, data: null, err: '', at: 0, draft: '', newN: 0, peeked: false }, pokeAt = {};   // 基地信息栏与留言板（见下面「基地信息栏」一节）
  var fl = { data: null, err: '', at: 0, newN: 0, loading: false };
  var st = { prep: null, bw: { picks: null, wait: null, inv: null }, view: null, tab: 'players', players: null, me: null, err: '', ws: null, wsOk: false, retry: 0, pend: null, inc: null, match: null, edit: null };

  /* ---------- 小工具 ---------- */
  function api(method, url, body) { return C.api(method, url, body); }
  function ago(t) {
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    return s < 120 ? '刚刚' : s < 3600 ? Math.floor(s / 60) + ' 分钟前' : s < 86400 ? Math.floor(s / 3600) + ' 小时前' : Math.floor(s / 86400) + ' 天前';
  }
  function avatar(name) { return esc(Array.from(name || '?')[0] || '?'); }
  function rankName(r, dv) { return typeof RANKS !== 'undefined' && RANKS[r] ? (typeof rankFull === 'function' ? rankFull(r, dv) : RANKS[r]) : ''; }
  // 王者显示星数（达到过的最高星数）
  // 铂金到宗师带小段（铂金 III），王者带星数
  function rankLabel(r, stars, dv) { return rankName(r, dv) + (r === RANKS.length - 1 && stars != null ? ' ' + stars + ' 星' : ''); }
  function rankChip(r, stars, dv) { return r > 0 && typeof RANK_COLOR !== 'undefined' ? '<span class="chip rk" style="--rc:' + RANK_COLOR[r] + '">' + rankLabel(r, stars, dv) + '</span>' : ''; }
  function statusOf(p) {
    if (p.me) return '<span class="dot on"></span>在线（我）';
    if (p.busy) return '<span class="dot busy"></span>对战中' + (p.battle ? ' · ' + esc(p.battle) : '');
    if (p.online) return '<span class="dot on"></span>在线';
    return '<span class="dot"></span>离线';   // 2026-10-26：不再显示上次在线时间
  }
  function monThumb(m) {
    var s = SPMAP[m.sid]; if (!s) return '';
    var v = A.view({ sid: m.sid, lv: m.lv, shiny: m.shiny, fs: m.fs });
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
    api('GET', '/api/fp-state').then(function (r) { if (r && r.ok) { st.fpSent = Array.isArray(r.sent) ? r.sent : []; st.fpOk = true; } }).catch(function () {});   // 2026-11-01：今天给好友送过经验没有
    api('GET', '/api/players').then(function (r) {
      loading = false;
      if (r._code !== 200) { st.err = r.error || '读取失败'; render(); fbDraw(); return; }
      st.err = ''; st.players = r.players; st.me = r.me; st.loadedAt = Date.now(); render(); renderBrawl(); fbDraw();
    }).catch(function () { loading = false; st.err = '连不上服务器'; render(); fbDraw(); });
  }
  setInterval(function () { if (A.page() === 'social' && !A.inBattle() && document.visibilityState === 'visible') load(); }, 30000);
  // 竞技对战的大乱斗面板开着时，20 秒刷新一次谁能匹配（别人刚读完支线、刚上线都要能看到）
  setInterval(function () { var el = $('brawl'); if (el && !el.hidden && A.page() === 'arena' && !A.inBattle() && document.visibilityState === 'visible') load(); }, 20000);

  // 基地右下角打开的好友选择面板：点一下去拜访。
  function fbInner(kind) {
    var farm = kind === 'farm', label = farm ? '种植园' : '基地', field = farm ? 'farmOpen' : 'homeOpen';
    if (!online) return '<p class="hint">连上服务器后才能看到好友的' + label + '。</p>';
    if (!st.players) return '<p class="hint">' + (st.err ? esc(st.err) : '正在读取好友名单……') + '</p>' + (st.err ? '<button type="button" class="btn" data-fbretry="1">重试</button>' : '');
    var F = st.players.filter(function (p) { return p.friend && !p.me && !p.noChar; }).sort(function (a, b) { return (b[field] ? 1 : 0) - (a[field] ? 1 : 0) || (b.online ? 1 : 0) - (a.online ? 1 : 0); });
    if (!F.length) return '<p class="hint">还没有好友。去「社交」页加几个好友，就能在这里直接拜访他们的' + label + '。</p>';
    return '<div class="fb-grid">' + F.map(function (p) {
      return '<button type="button" class="fb-it' + (p.online ? ' live' : '') + '" ' + (farm ? 'data-ffvisit' : 'data-fbvisit') + '="' + esc(p.user) + '"' + (p[field] ? '' : ' disabled title="对方还没有开放' + label + '"') + '>' +
        '<span class="pav' + (p.avatar ? ' img' : '') + '">' + A.avatarInner(p.avatar, p.name || p.user) + '</span>' +
        '<span class="fb-txt"><b>' + esc(p.name) + '</b><small>' + (p[field] ? (farm ? (p.farmN || 4) + ' 块田' : p.homeN ? '展示中 ' + p.homeN + ' 只精灵' : '基地里还没有精灵') : label + '还没开放') + (p.online ? ' · 在线' : '') + '</small></span>' +
        '<span class="fb-show">' + (p.show || []).slice(0, 3).map(monThumb).join('') + '</span></button>';
    }).join('') + '</div>';
  }
  function fbDraw() { var el = $('base-friends'); if (el) el.innerHTML = fbInner(); var f = $('farm-friends'); if (f) f.innerHTML = fbInner('farm'); }
  function friendBases(kind) {
    if (online && (!st.players || Date.now() - (st.loadedAt || 0) > 30000)) setTimeout(load, 0);
    return '<div id="' + (kind === 'farm' ? 'farm-friends' : 'base-friends') + '">' + fbInner(kind) + '</div>';
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-fbretry]')) { st.err = ''; fbDraw(); load(); return; }
    var t = e.target.closest('[data-fbvisit],[data-ffvisit]');
    if (t && !t.disabled) {
      var panel = t.closest('.bp-dlg,[data-visit-panel]'), close = panel && panel.querySelector('[data-bpx],[data-visitclose]');
      var from = panel && panel.dataset.visitFrom || (t.dataset.ffvisit ? 'farm' : 'base'); if (from === 'social') from = null;
      if (close) close.click();
      if (t.dataset.ffvisit) openFarm(t.dataset.ffvisit, from); else openHome(t.dataset.fbvisit, from);
    }
  });
  // 能不能观战：对方正在对战，并且是自己的好友（或者对方发了全服观战邀请）
  function canWatch(p) { return !p.me && p.online && p.busy && !!p.battle && (p.friend || p.watchOpen); }
  function watchBtn(p) { return canWatch(p) ? '<button type="button" class="btn watch" data-watch="' + esc(p.user) + '">👁 观战</button>' : ''; }
  function playerRow(p) {
    var name = p.noChar ? '（还没创建角色）' : p.name, canFight = !p.me && !p.noChar && p.online && !p.busy;
    return '<article class="prow' + (p.me ? ' me' : '') + (p.online ? ' live' : '') + '" data-user="' + esc(p.user) + '">' +
      '<button type="button" class="pr-main" data-card="' + esc(p.user) + '" aria-label="查看' + esc(name) + '的名片">' +
      '<span class="pav' + (p.avatar ? ' img' : '') + '">' + A.avatarInner(p.avatar, p.name || p.user) + '</span>' +
      '<span class="pr-txt"><span class="pr-l1"><b>' + esc(name) + '</b>' + (p.title && A.titleName(p.title) ? '<span class="chip ttl">' + esc(A.titleName(p.title)) + '</span>' : '') + rankChip(p.rank, p.rankStars, p.rankDv) + (p.fan && !p.me ? '<span class="chip fan" title="对方也把你加为好友了">互相关注</span>' : '') + '</span>' +
      '<span class="pr-l2">@' + esc(p.user) + ' · ' + statusOf(p) + '</span></span>' +
      '<span class="pr-show">' + (p.show || []).map(monThumb).join('') + '</span></button>' +
      '<span class="pr-acts">' +
      (p.me ? '<button type="button" class="btn" data-tab="mine">编辑名片</button>' :
        '<button type="button" class="btn ghost" data-home="' + esc(p.user) + '"' + (p.homeOpen ? '' : ' disabled title="对方还没有开放基地"') + '>基地' + (p.homeN ? ' · ' + p.homeN : '') + '</button>' +
        '<button type="button" class="btn' + (p.friend ? ' on' : '') + '" data-friend="' + esc(p.user) + '" aria-pressed="' + !!p.friend + '">' + (p.friend ? '★ 好友' : '＋ 加好友') + '</button>' +
        (p.friend && !p.noChar ? '<button type="button" class="btn dm-btn" data-dm="' + esc(p.user) + '">💬 私信' + (dmUnreadOf(p.user) ? '<i class="q-badge">' + dmUnreadOf(p.user) + '</i>' : '') + '</button>' : '') +
        (p.friend && !p.noChar && st.fpOk ? '<button type="button" class="btn fp-gift" data-fpgift="' + esc(p.user) + '"' + ((st.fpSent || []).indexOf(p.user) >= 0 ? ' disabled title="今天已经送过 Ta 了"' : ' title="送 Ta 10000 经验和 200 友情点，你也得 200 友情点（每位好友每天一次；你每天从送礼最多拿 2000 友情点）"') + '>🎁 ' + ((st.fpSent || []).indexOf(p.user) >= 0 ? '已送' : '送经验') + '</button>' : '') +
        (canWatch(p) ? watchBtn(p) : '<button type="button" class="btn primary" data-fight="' + esc(p.user) + '"' + (canFight ? '' : ' disabled title="' + (p.noChar ? '对方还没有创建角色' : p.busy ? '对方正在对战中' + (p.friend ? '' : '，加为好友后可以观战') : '对方不在线') + '"') + '>切磋</button>')) +
      '</span></article>';
  }

  /* ---------- 名片 ---------- */
  // 挑战进度（2026-10-17）：名片里默认收起，点开才显示
  var MIL_NAMES = ['下等兵', '二等兵', '一等兵', '上等兵'].concat(['下士', '中士', '上士', '少尉', '中尉', '上尉', '少校', '中校', '上校', '大校'].reduce(function (o, t) { return o.concat([t + '1', t + '2', t + '3']); }, []), ['将军']);   // 和 game.js 的 RANKS_MIL 一致
  function progOf(acc) {
    var stars = 0, max = 0, c = acc.chal || {};
    for (var i = 1; i <= 50; i++) { var r = c['fl' + i], n = r && r.s ? r.s.filter(Boolean).length : 0; if (n) { stars += n; max = i; } }
    var T = acc.tower || {};
    return { flora: { stars: stars, max: max, total: 150, levels: 50 }, tower: { best: T.best || 0, clears: T.clears || 0, cur: T.f || 1, top: 60 } };
  }
  function progHTML(p) {
    if (!p) return '';
    var F = p.flora || {}, T = p.tower || {};
    return '<details class="pc-prog"><summary>挑战进度</summary><ul>' +
      '<li><b>芙罗拉星 · 挑战</b><span>' + (F.max ? '最远第 ' + F.max + ' / ' + (F.levels || 50) + ' 关 · ★ ' + F.stars + ' / ' + (F.total || 150) : '还没有开始') + '</span></li>' +
      '<li><b>先驱之塔</b><span>' + (T.best || T.clears ? '最高第 ' + T.best + ' / ' + (T.top || 60) + ' 层 · 通关 ' + T.clears + ' 次 · 当前第 ' + T.cur + ' 层' : '还没有开始') + '</span></li>' +
      '</ul></details>';
  }
  function cardHTML(c, opt) {
    opt = opt || {};
    if (c.noChar) return '<div class="pcard"><p class="hint">@' + esc(c.user) + ' 还没有创建游戏角色。</p></div>';
    var R = c.rankInfo || { r: 0, best: 0, w: 0, l: 0 };
    var slots = '';
    for (var i = 0; i < SHOW_MAX; i++) {
      var m = c.show[i], s = m && SPMAP[m.sid];
      if (!s) { slots += '<li class="pc-mon empty"><span>空位</span></li>'; continue; }
      var v = A.view({ sid: m.sid, lv: m.lv, shiny: m.shiny, fs: m.fs });
      slots += '<li class="pc-mon"><img src="' + v.img + '" alt="' + esc(v.name) + '"><b>' + esc(v.name) + (m.shiny ? '<span class="shiny-tag">异色</span>' : '') + '</b><span class="pc-lv">LV' + m.lv + (m.nat ? ' · ' + esc(m.nat) : '') + '</span>' +
        '<span class="tc">' + tchips(s.types) + '</span>' +
        (m.moves && m.moves.length ? '<span class="pc-mv">' + m.moves.map(function (n) { return esc(n); }).join('、') + '</span>' : '') + '</li>';
    }
    var look = typeof CHARS !== 'undefined' && CHARS['p' + (c.gender === 'f' ? 'f' : 'm')];
    return '<div class="pcard' + (look ? ' has-look' : '') + '">' + (look ? '<figure class="pc-look"><img src="' + look + '" alt="' + esc(c.name) + '的形象"></figure>' : '') +
      '<div class="pc-top"><span class="pav big' + (c.avatar ? ' img' : '') + '">' + A.avatarInner(c.avatar, c.name) + '</span><div class="pc-who">' +
      '<span class="pc-title">' + esc(c.title ? A.titleName(c.title) || '做题家' : '做题家') + '</span><h3>' + esc(c.name) + '</h3>' +
      '<span class="pc-user">@' + esc(c.user) + (opt.preview ? '' : ' · ' + statusOf(c)) + '</span></div></div>' +
      '<p class="pc-stats"><span>军衔 <b>' + esc(MIL_NAMES[Math.max(0, Math.min(MIL_NAMES.length - 1, c.mil | 0))]) + '</b></span><span>精灵 <b>' + (c.monsN || 0) + '</b> 只</span><span>收集 <b>' + (c.speciesN || 0) + '</b> 种</span>' +
      '<span>最高段位 <b>' + (rankLabel(R.best, R.best === RANKS.length - 1 ? R.kingBest || 0 : null, R.bestDv) || '—') + '</b>' + (R.r === RANKS.length - 1 && (R.stars || 0) !== (R.kingBest || 0) ? '（当前 ' + R.stars + ' 星）' : '') + '</span><span>竞技 <b>' + R.w + '</b> 胜 <b>' + R.l + '</b> 负</span>' +
      (c.created ? '<span>' + new Date(c.created).toLocaleDateString('zh-CN') + ' 登船</span>' : '') + '</p>' +
      '<blockquote class="pc-motto' + (c.motto ? '' : ' empty') + '">' + (c.motto ? esc(c.motto) : '这位船员还没有写个人宣言。') + '</blockquote>' +
      progHTML(c.prog) +
      '<h4 class="pc-h">展示精灵</h4><ol class="pc-show">' + slots + '</ol>' +
      (function (hs) { hs = hs.filter(function (h) { return h && SPMAP[h.sid]; }); return hs.length ? '<h4 class="pc-h">助战精灵 <span class="hint">好友可以在星球挑战里借用</span></h4>' + hs.map(function (h) { var v = A.view({ sid: h.sid, lv: h.lv, shiny: h.shiny, fs: h.fs });
        return '<div class="pc-helper"><img src="' + v.img + '" alt=""><b>' + esc(v.name) + (h.shiny ? '<span class="shiny-tag">异色</span>' : '') + '</b><span class="pc-lv">LV' + h.lv + (h.nat ? ' · ' + esc(h.nat) : '') + '</span><span class="tc">' + tchips(SPMAP[h.sid].types) + '</span></div>'; }).join('') : ''; })(c.helpers || (c.helper ? [c.helper] : [])) + '</div>';
  }
  function openCard(user) {
    var d = dialog('card', '<div class="pc-body"><p class="hint">读取名片中……</p></div>', function (el, close) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-x]')) return close();
        var f = e.target.closest('[data-friend]'); if (f) { toggleFriend(f.dataset.friend).then(function () { close(); openCard(user); }); return; }
        var g = e.target.closest('[data-fight]'); if (g && !g.disabled) { close(); askFight(g.dataset.fight); return; }
        var h = e.target.closest('[data-home]'); if (h && !h.disabled) { close(); openHome(h.dataset.home); return; }
        var w = e.target.closest('[data-watch]'); if (w) { close(); watchStart(w.dataset.watch); return; }
        var dm = e.target.closest('[data-dm]'); if (dm) { close(); dmOpen(dm.dataset.dm); }
      });
    });
    api('GET', '/api/card?user=' + encodeURIComponent(user)).then(function (c) {
      var body = d.el.querySelector('.pc-body'); if (!body) return;
      if (c._code !== 200) { body.innerHTML = '<p class="hint">' + esc(c.error || '读取失败') + '</p>'; return; }
      var canFight = !c.me && !c.noChar && c.online && !c.busy;
      body.innerHTML = cardHTML(c) + '<div class="soc-foot"><button type="button" class="btn ghost" data-x="1">关闭</button>' +
        (c.me ? '' : '<button type="button" class="btn ghost" data-home="' + esc(c.user) + '"' + (c.homeOpen ? '' : ' disabled') + '>拜访基地</button>' +
          '<button type="button" class="btn" data-friend="' + esc(c.user) + '">' + (c.friend ? '取消好友' : '＋ 加好友') + '</button>' +
          (c.friend && !c.noChar ? '<button type="button" class="btn dm-btn" data-dm="' + esc(c.user) + '">💬 私信</button>' : '') +
          (canWatch(c) ? watchBtn(c) : '<button type="button" class="btn primary" data-fight="' + esc(c.user) + '"' + (canFight ? '' : ' disabled') + '>切磋</button>')) + '</div>';
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

  /* ---------- 拜访基地 ---------- */
  function openHome(user, from) {
    openPlace(user, from, 'home');
  }
  function openFarm(user, from) { openPlace(user, from, 'farm'); }
  function openPlace(user, from, kind) {
    var view = st.view = { user: user, data: null, err: '', from: from || null, kind: kind };
    if (A.page() !== 'social') A.go('social'); else render();
    HSVIEW.to(0, 0);
    api('GET', '/api/' + kind + '?user=' + encodeURIComponent(user)).then(function (r) {
      if (st.view !== view) return;
      if (r._code !== 200) view.err = r.error || '读取失败'; else { view.data = r; if (kind === 'farm') r.offset = r.now - Date.now(); }
      render();
    }).catch(function () { if (st.view === view) { view.err = '连不上服务器'; render(); } });
  }
  // 拜访别人的基地：点精灵弹出它的面板（2026-10-31），可以摸摸它
  function vmonPanel(i) {
    var d = st.view && st.view.data, m = d && d.mons[i]; if (!m) return;
    var v = A.view({ sid: m.sid, lv: m.lv, shiny: m.shiny, fs: m.fs }), old = $('vmon-dlg'); if (old) old.remove();
    var dl = document.createElement('div'); dl.className = 'soc-dlg'; dl.id = 'vmon-dlg';
    dl.innerHTML = '<div class="soc-box bp-box bp-mon" role="dialog" aria-modal="true" aria-label="' + esc(v.name) + '"><span class="tape l"></span><span class="tape r"></span>' +
      '<div class="bpm-top"><img class="bpm-img" src="' + v.img + '" alt=""><div class="bpm-txt"><h2>' + esc(v.name) + '</h2><p class="bpm-lv">LV' + m.lv + (m.shiny ? ' · 异色' : '') + '</p><p class="hint">' + esc(d.name) + ' 在基地里展示的精灵。</p></div></div>' +
      '<div class="soc-foot"><button type="button" class="btn" data-vpoke="1">摸摸它</button><button type="button" class="btn primary" data-vx="1">关闭</button></div></div>';
    document.body.appendChild(dl);
    dl.addEventListener('click', function (e) {
      if (e.target.closest('[data-vpoke]')) {
        var fig = document.querySelector('#pg-social .hm-fig[data-fi="' + i + '"]'); if (fig) { fig.classList.remove('hop'); void fig.offsetWidth; fig.classList.add('hop'); }
        var img = dl.querySelector('.bpm-img'); img.classList.remove('hop'); void img.offsetWidth; img.classList.add('hop');
        if (!d.me && !(pokeAt[v.name] && Date.now() - pokeAt[v.name] < 1500)) { pokeAt[v.name] = Date.now(); hbEvent(d.user, { kind: 'poke', mon: v.name }); }
        return;
      }
      if (e.target === dl || e.target.closest('[data-vx]')) dl.remove();
    });
  }
  // 2026-11-03：好友基地里训练满 1 小时的精灵头上冒经验气泡，点一下偷走它现存经验的 10%（规则在 js/engine/grow.js 的 homeSteal）
  function stealBub(d, i, v) {
    var S = d.steal && d.steal[i]; if (d.me || !S || !(S.n > 0)) return '';
    return '<button type="button" class="hm-ready steal" data-vsteal="' + i + '" title="偷走 ' + A.fmt(S.n) + ' 经验" aria-label="偷走 ' + esc(v.name) + ' 的 ' + A.fmt(S.n) + ' 经验"><img src="images/items/exp.png" alt="">偷 +' + A.fmt(S.n) + '</button>';
  }
  function doSteal(i, btn) {
    var d = st.view && st.view.data, S = d && d.steal && d.steal[i], m = d && d.mons[i]; if (!S || !m || !A.homeSteal) return;
    btn.disabled = true;
    var v = A.view({ sid: m.sid, lv: m.lv, shiny: m.shiny, fs: m.fs });
    A.homeSteal(d.user, S.u, function (r) {
      S.n = 0; S.why = 'done'; d.stealLeft = r.left;
      btn.remove();   // 只去掉这个气泡，不重画整个基地
      var fig = document.querySelector('#pg-social .hm-fig[data-fi="' + i + '"]'); if (fig) { fig.classList.remove('hop'); void fig.offsetWidth; fig.classList.add('hop'); }
      var sl = document.querySelector('#pg-social [data-stealleft]'); if (sl) sl.textContent = A.fmt(r.left);
      if (!r.left && d.steal) {   // 今天偷满了：其余气泡都收起来
        d.steal.forEach(function (x) { if (x.n > 0) { x.n = 0; x.why = 'cap'; } });
        document.querySelectorAll('#pg-social .hm-ready.steal').forEach(function (b) { b.remove(); });
      }
      A.toast('从 ' + d.name + ' 的' + v.name + '那里偷走了 ' + A.fmt(r.n) + ' 经验（进经验背包）。今天还能偷 ' + A.fmt(r.left) + '。');
    }, function (err) {
      btn.disabled = false; if (err) A.toast(err);
      if (err && /一半|已经偷过|不在基地|上限|1 小时|自律/.test(err)) { S.n = 0; btn.remove(); }
    });
  }
  function homeHTML() {
    var V0 = st.view, d = V0.data, back = '<div class="crumb home-crumb"><button type="button" class="btn ghost" data-back="1">‹ ' + (V0.from === 'base' ? '返回我的基地' : V0.from === 'farm' ? '返回我的种植园' : '返回社交') + '</button>';
    if (!d) return back + '</div><p class="hint soc-load">' + (V0.err ? esc(V0.err) : '正在前往基地……') + '</p>';
    if (d.noChar) return back + '</div><div class="soc-empty"><p>@' + esc(d.user) + ' 还没有创建游戏角色。</p></div>';
    if (!d.open) return back + '<b class="home-name">' + esc(d.name) + ' 的休息舱</b></div><div class="soc-empty"><p>' + esc(d.name) + ' 还没有读完「陆羽茶室」支线，基地还没开放。</p></div>';
    var pos = A.homePos, figs = d.mons.map(function (m, i) {
      var v = A.view({ sid: m.sid, lv: m.lv, shiny: m.shiny, fs: m.fs }), p = A.baseMonPos ? A.baseMonPos(d.layout && d.layout.room, i) : (pos[i] || pos[0]);
      return '<div class="hm-fig' + (d.mons.length > 3 ? ' many' : '') + '" data-csid="' + esc(m.sid) + '" data-cst="' + (v.stage || 0) + '" data-cctx="home" data-fi="' + i + '" style="left:' + p[0] + '%;top:' + p[1] + '%' + (A.baseFigW ? ';--fw:' + A.baseFigW(m.sid, v.stage, d.layout && d.layout.room, p[1]) : '') + '">' + stealBub(d, i, v) + '<button type="button" class="hm-poke" data-vmon="' + i + '" aria-label="' + esc(v.name) + '"><img src="' + v.img + '" alt=""></button><span class="hm-tip">' + esc(v.name) + ' · LV' + m.lv + '</span></div>';
    }).join('');
    var mine = (A.acc().teams[A.acc().active] || []).map(A.mon).filter(Boolean);
    var room = d.layout && /^r[1-4]$/.test(d.layout.room) ? d.layout.room : 'r1';
    return '<div class="home-page visit-home-page">' + back + '<b class="home-name">' + esc(d.homeName) + '</b></div>' +
      '<div class="base-stage" style="--home-backdrop:url(' + new URL('images/base/room' + room.slice(1) + '.jpg', document.baseURI).href + ')">' +
      A.baseRoom(d.layout, figs + (d.mons.length ? '' : '<p class="home-empty">主人还没有放精灵出来展示。</p>')) +
      '<div class="base-side"><div class="bs-list"><button type="button" class="bs-it" data-vhomepanel="msg" title="留言板"><span class="bs-ic" aria-hidden="true">💬</span><span class="bs-t"><b>留言板</b></span></button><button type="button" class="bs-it" data-vhomepanel="info" title="基地信息"><span class="bs-ic" aria-hidden="true">ⓘ</span><span class="bs-t"><b>基地信息</b></span></button></div></div>' +
      '<button type="button" class="scene-go" data-visitfarm="' + esc(d.user) + '"' + ((d.friend || d.me) && d.farmOpen ? '' : ' disabled title="对方种植园尚未开放，或尚未加为好友"') + '><span class="sg-ic" aria-hidden="true">🌱</span>前往种植园</button>' +
      (!d.me ? '<button type="button" class="scene-go visit-challenge-btn" data-teafight="1" title="' + (d.mons.length ? mine.length ? '用出战配队挑战好友展示中的精灵' : '请先配置出战精灵' : '对方没有展示精灵') + '"' + (d.mons.length && mine.length ? '' : ' disabled') + '><span class="sg-ic" aria-hidden="true">⚔</span>挑战好友</button>' : '') +
      '<button type="button" class="scene-go home-friends-btn" data-vfriends="home" aria-haspopup="dialog"><span class="sg-ic" aria-hidden="true">👥</span>好友基地</button></div></div>';
  }
  function homeInfoHTML(d) {
    return '<p>' + esc(d.name) + ' 的基地' + (d.online ? ' · 主人在线' : '') + '</p><p>用你的出战配队挑战这里展示的 ' + d.mons.length + ' 只精灵，由电脑操控对手。每天前 ' + A.TEA_DAILY + ' 场各奖励 ' + A.fmt(A.TEA_EXP) + ' 累积经验，赢输都算，认输不算。</p><p>今天还能领取 ' + A.teaLeft() + ' / ' + A.TEA_DAILY + ' 次奖励。</p>' +
      (d.friend ? '<p>好友基地里训练满 1 小时的精灵可偷取现存经验的 10%，每只每轮一次，最多被偷走一半。今天还能偷 ' + A.fmt(d.stealLeft || 0) + ' / ' + A.fmt(d.stealDay || 30000) + ' 经验。</p>' : '');
  }
  function visitPanel(kind) {
    var v = st.view, d = v && v.data; if (!d) return;
    var friends = kind === 'home' || kind === 'farm';
    var title = kind === 'farm' ? '好友种植园' : kind === 'home' ? '好友基地' : kind === 'msg' ? '留言板' : '基地信息';
    var body = friends ? friendBases(kind === 'farm' ? 'farm' : undefined) : '<div class="visit-info-body">' + (kind === 'msg' ? hbSlot(d.user, 'msg') : homeInfoHTML(d)) + '</div>';
    var panel = dialog('bp-box' + (friends ? ' wide bp-friends' : ' visit-info-box'), '<h2>' + title + '</h2>' + body + '<div class="soc-foot"><button type="button" class="btn primary" data-visitclose="1">关闭</button></div>', function (el, close) { el.addEventListener('click', function (e) { if (e.target.closest('[data-visitclose]')) close(); }); });
    panel.el.dataset.visitPanel = '1'; panel.el.dataset.visitFrom = v.from || 'social';
  }

  function farmHTML() {
    var v = st.view, d = v.data;
    var back = '<div class="crumb home-crumb"><button type="button" class="btn ghost" data-back="1">‹ ' + (v.from === 'farm' ? '返回我的种植园' : v.from === 'base' ? '返回我的基地' : '返回社交') + '</button>';
    if (!d) return back + '</div><p class="hint">' + esc(v.err || '正在前往种植园……') + '</p><button type="button" class="btn" data-vfarmrefresh="1">重试</button>';
    if (!d.open) return back + '</div><p class="hint">这名好友的种植园还没有开放。</p>';
    return '<div class="home-page farm-page visit-farm-page">' + back + '<b class="home-name">' + esc(d.name) + '的种植园</b></div>' +
      '<div class="base-stage" style="--home-backdrop:url(' + new URL('images/base/farm.jpg', document.baseURI).href + ')">' + A.farmVisitorRoom(d) +
      '<div class="base-side"><div class="bs-list"><button type="button" class="bs-it" data-vfarmrefresh="1" title="刷新种植园"><span class="bs-ic" aria-hidden="true">↻</span><span class="bs-t"><b>刷新</b></span></button><button type="button" class="bs-it" data-vfarmrules="1" title="偷菜规则"><span class="bs-ic" aria-hidden="true">ⓘ</span><span class="bs-t"><b>偷菜规则</b><small>今天还能偷 ' + A.fmt(d.stealLeft) + ' 份</small></span></button></div></div>' +
      '<button type="button" class="scene-go" data-visithome="' + esc(d.user) + '"' + (d.homeOpen ? '' : ' disabled title="对方基地还没有开放"') + '><span class="sg-ic" aria-hidden="true">🏠</span>前往基地</button><button type="button" class="scene-go home-friends-btn" data-vfriends="farm" aria-haspopup="dialog"><span class="sg-ic" aria-hidden="true">👥</span>切换好友</button></div></div>';
  }
  function refreshFarm(quiet) {
    var v = st.view; if (!v || v.kind !== 'farm' || v.farmLoading) return;
    v.farmLoading = true;
    api('GET', '/api/farm?user=' + encodeURIComponent(v.user)).then(function (r) {
      if (st.view !== v) return;
      v.farmLoading = false;
      if (r._code === 200) { r.offset = r.now - Date.now(); v.data = r; v.err = ''; }
      else { v.err = r.error || '读取失败'; if (r._code === 403 || r._code === 404) v.data = null; if (!quiet) A.toast(v.err); }
      render();
    }).catch(function () { if (st.view === v) { v.farmLoading = false; if (!quiet) A.toast('连不上服务器，请稍后重试'); } });
  }
  function stealCrop(i, button) {
    var v = st.view, d = v && v.data, p = d && d.plots && d.plots[i];
    if (!v || v.kind !== 'farm' || !p || !p.steal || !p.steal.n || v.stealing) return;
    v.stealing = true; button.disabled = true;
    A.farmSteal(d.user, i, function (r) {
      if (st.view === v) { v.stealing = false; p.steal = { n: 0, why: 'done' }; d.stealLeft = r.left; render(); refreshFarm(true); }
      A.toast('从 ' + d.name + ' 的种植园偷到了「' + A.itemName(r.crop) + '」×' + r.n + '，已放入储存箱。');
    }, function (err) { if (st.view === v) { v.stealing = false; refreshFarm(true); } if (err) A.toast(err); });
  }
  setInterval(function () { if (A.page() === 'social' && st.view && st.view.kind === 'farm' && !A.inBattle() && document.visibilityState === 'visible') refreshFarm(true); }, 15000);

  /* ---------- 我的名片（编辑） ---------- */
  function myCard() {
    var acc = A.acc(), cd = acc.card || {}, species = {};
    acc.mons.forEach(function (m) { species[m.sid] = 1; });
    var rk = null; try { rk = JSON.parse(localStorage.getItem('hs-rank-v1') || 'null'); } catch (e) {}
    var R = rk ? { r: rk.r || 0, dv: rk.dv, bestDv: rk.bestDv, best: Math.max(rk.best || 0, rk.r || 0), w: rk.w || 0, l: rk.l || 0, stars: rk.stars || 0, kingBest: Math.max(rk.kingBest || 0, rk.r === RANKS.length - 1 ? rk.stars || 0 : 0) } : { r: 0, best: 0, w: 0, l: 0 };
    var ed = st.edit;
    return { user: st.me || (C.user && C.user()), name: acc.name, avatar: A.avatarSpec(), gender: A.gender ? A.gender() : 'm', title: acc.title && (acc.titles || []).indexOf(acc.title) >= 0 ? acc.title : null, monsN: acc.mons.length, speciesN: Object.keys(species).length,
      created: acc.created, motto: ed.motto, rankInfo: R, prog: progOf(acc), mil: A.milRank ? A.milRank() : acc.milRank | 0,
      show: ed.show.map(function (u) { var m = A.mon(u); return m && { sid: m.sid, lv: m.lv, nat: m.nat, moves: m.moves, shiny: m.shiny === 2 ? 2 : !!m.shiny, fs: m.fs }; }).filter(Boolean),
      helpers: ed.helpers.map(function (u) { var m = A.mon(u); return m && { sid: m.sid, lv: m.lv, nat: m.nat, shiny: m.shiny === 2 ? 2 : !!m.shiny, fs: m.fs }; }).filter(Boolean) };
  }
  function startEdit() {
    var cd = A.acc().card || {};
    st.edit = { show: (cd.show || []).filter(function (u) { return A.mon(u); }).slice(0, SHOW_MAX), motto: typeof cd.motto === 'string' ? cd.motto.slice(0, MOTTO_MAX) : '', helpers: (Array.isArray(cd.helpers) ? cd.helpers : cd.helper != null ? [cd.helper] : []).filter(function (u) { return A.mon(u); }).slice(0, HELP_MAX), dirty: false };
  }
  function mineHTML() {
    if (!st.edit) startEdit();
    var ed = st.edit, mons = A.acc().mons.slice().sort(function (a, b) { return b.lv - a.lv || a.u - b.u; });
    return '<div class="mine">' +
      '<section class="mine-prev"><h3 class="shop-h">名片预览</h3>' + cardHTML(myCard(), { preview: true }) + '</section>' +
      '<section class="mine-edit"><h3 class="shop-h">编辑名片</h3>' +
      '<label class="me-lab" for="me-motto">个人宣言 <span class="hint" id="me-cnt">' + Array.from(ed.motto).length + ' / ' + MOTTO_MAX + '</span></label>' +
      '<textarea id="me-motto" rows="4" maxlength="' + MOTTO_MAX + '" placeholder="写点什么给其他船员看，比如你的目标、最喜欢的精灵……">' + esc(ed.motto) + '</textarea>' +
      '<p class="me-lab">展示精灵 <span class="hint">已选 ' + ed.show.length + ' / ' + SHOW_MAX + '，按点选顺序排列</span></p>' +
      '<div class="me-pick">' + mons.map(function (m) {
        var k = ed.show.indexOf(m.u), v = A.view(m), full = k < 0 && ed.show.length >= SHOW_MAX;
        return '<button type="button" class="me-mon' + (k >= 0 ? ' on' : '') + '" data-pick="' + m.u + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + (k >= 0) + '">' +
          (k >= 0 ? '<span class="me-no">' + (k + 1) + '</span>' : '') + '<img src="' + v.img + '" alt=""><b>' + esc(v.name) + '</b><small>LV' + m.lv + '</small></button>';
      }).join('') + '</div>' +
      '<p class="me-lab">助战精灵 <span class="hint">最多选 ' + HELP_MAX + ' 只（已选 ' + ed.helpers.length + ' / ' + HELP_MAX + '），好友在星球挑战里可以借用（借出去不影响你自己使用）；再点一下取消</span></p>' +
      '<div class="me-pick">' + mons.map(function (m) {
        var on = ed.helpers.indexOf(m.u) >= 0, v = A.view(m), full = !on && ed.helpers.length >= HELP_MAX;
        return '<button type="button" class="me-mon' + (on ? ' on' : '') + '" data-helper="' + m.u + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + on + '">' + (on ? '<span class="me-no">助</span>' : '') + '<img src="' + v.img + '" alt=""><b>' + esc(v.name) + '</b><small>LV' + m.lv + '</small></button>';
      }).join('') + '</div>' +
      '<div class="soc-foot"><span class="hint" id="me-msg">' + (ed.dirty ? '有修改还没保存' : '') + '</span><button type="button" class="btn ghost" id="me-reset"' + (ed.dirty ? '' : ' disabled') + '>撤销修改</button><button type="button" class="btn primary" id="me-save"' + (ed.dirty ? '' : ' disabled') + '>保存名片</button></div>' +
      '</section></div>';
  }
  function saveCard() {
    var acc = A.acc();
    acc.card = { show: st.edit.show.slice(0, SHOW_MAX), motto: Array.from(st.edit.motto).slice(0, MOTTO_MAX).join(''), helper: st.edit.helpers.length ? st.edit.helpers[0] : null, helpers: st.edit.helpers.slice(0, HELP_MAX) };
    st.edit.dirty = false; A.save(); render();
    A.toast('名片已保存。同步到服务器后，其他船员就能看到。');
  }

  /* ---------- 页面 ---------- */
  function render() {
    var pg = $('pg-social'); if (!pg || A.page() !== 'social' || !A.ready()) return;
    if (!online) {
      pg.innerHTML = '<div class="soc-empty"><span class="tape l"></span><p>社交功能需要联网：用服务器网址打开游戏并登录账号后，就能看到其他船员、加好友和切磋。</p><p class="hint">现在是双击 index.html 打开的本地版，存档只在这台电脑上。</p></div>';
      return;
    }
    var P = st.players || [], friends = P.filter(function (p) { return p.friend; }), on = P.filter(function (p) { return p.online; }).length;
    var focus = document.activeElement && document.activeElement.id === 'me-motto' ? $('me-motto').selectionStart : null;
    if (st.view) { pg.innerHTML = st.view.kind === 'farm' ? farmHTML() : homeHTML(); return; }
    var body;
    if (st.tab === 'mine') body = mineHTML();
    else if (st.tab === 'dm') body = dmListHTML();
    else if (!st.players) body = '<p class="hint soc-load">' + (st.err ? esc(st.err) + ' · <button type="button" class="btn ghost" data-reload="1">重试</button>' : '读取船员名单中……') + '</p>';
    else {
      var list = st.tab === 'friends' ? friends : P;
      body = list.length ? '<div class="plist">' + list.map(playerRow).join('') + '</div>' :
        '<div class="soc-empty"><p>' + (st.tab === 'friends' ? '还没有好友。去「玩家」里找到想关注的人，点「加好友」。' : '还没有其他船员。') + '</p></div>';
    }
    pg.innerHTML = '<div class="subbar soc-tabs" role="tablist">' +
      '<button type="button" class="sub' + (st.tab === 'players' ? ' on' : '') + '" data-tab="players" role="tab" aria-selected="' + (st.tab === 'players') + '">玩家 ' + (st.players ? P.length : '') + '</button>' +
      '<button type="button" class="sub' + (st.tab === 'friends' ? ' on' : '') + '" data-tab="friends" role="tab" aria-selected="' + (st.tab === 'friends') + '">好友 ' + (st.players ? friends.length : '') + '</button>' +
      '<button type="button" class="sub' + (st.tab === 'dm' ? ' on' : '') + '" data-tab="dm" role="tab" aria-selected="' + (st.tab === 'dm') + '">私信' + (st.dmUnread ? '<i class="q-badge">' + st.dmUnread + '</i>' : '') + '</button>' +
      '<button type="button" class="sub' + (st.tab === 'mine' ? ' on' : '') + '" data-tab="mine" role="tab" aria-selected="' + (st.tab === 'mine') + '">我的名片</button>' +
      '<button type="button" class="sub sub-go" data-myhome="1" title="' + (A.homeOpen() ? '直接去我的基地' : '读完「陆羽茶室」支线后开放') + '">我的基地' + (hb.newN ? '<i class="q-badge" title="基地里有新动态或新留言">' + hb.newN + '</i>' : '') + ' ›</button>' +
      '<span class="soc-on">' + (st.wsOk ? '<span class="dot on"></span>' + on + ' 人在线' : '<span class="dot"></span>正在连接服务器……') + '</span></div>' +
      body;
    if (focus != null && $('me-motto')) { var ta = $('me-motto'); ta.focus(); ta.setSelectionRange(focus, focus); }
  }
  if ($('pg-social')) {
    $('pg-social').addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-tab]'))) { st.tab = t.dataset.tab; if (st.tab === 'mine' && !st.edit) startEdit(); render(); if (st.tab === 'dm') dmLoadList(); else if (st.tab !== 'mine') load(); return; }
      if ((t = e.target.closest('[data-myhome]'))) { A.goHome(); return; }
      if ((t = e.target.closest('[data-reload]'))) { load(); return; }
      if ((t = e.target.closest('[data-back]'))) { var from = st.view && st.view.from; st.view = null; if (from === 'base') { A.goHome(); return; } if (from === 'farm') { A.goFarm(); return; } render(); load(); return; }
      if ((t = e.target.closest('[data-visitfarm]'))) { if (!t.disabled) { if (st.view && st.view.data && st.view.data.me) { st.view = null; A.goFarm(); } else openFarm(t.dataset.visitfarm, st.view && st.view.from); } return; }
      if ((t = e.target.closest('[data-visithome]'))) { if (!t.disabled) { if (st.view && st.view.data && st.view.data.me) { st.view = null; A.goHome(); } else openHome(t.dataset.visithome, st.view && st.view.from); } return; }
      if ((t = e.target.closest('[data-vfriends]'))) { visitPanel(t.dataset.vfriends); return; }
      if ((t = e.target.closest('[data-vhomepanel]'))) { visitPanel(t.dataset.vhomepanel); return; }
      if ((t = e.target.closest('[data-vfarmrefresh]'))) { refreshFarm(false); return; }
      if ((t = e.target.closest('[data-vfarmplot]'))) { if (!t.disabled) stealCrop(+t.dataset.vfarmplot, t); return; }
      if ((t = e.target.closest('[data-vfarmrules]'))) { dialog('bp-box', '<h2>偷菜规则</h2>' + A.farmRules() + '<p>今天还能偷 ' + A.fmt(st.view.data.stealLeft) + ' / ' + A.fmt(st.view.data.stealDay) + ' 份。</p><div class="soc-foot"><button type="button" class="btn primary" data-ruleclose="1">关闭</button></div>', function (d, close) { d.addEventListener('click', function (e) { if (e.target.closest('[data-ruleclose]')) close(); }); }); return; }
      if ((t = e.target.closest('[data-home]'))) { if (!t.disabled) openHome(t.dataset.home); return; }
      if ((t = e.target.closest('[data-vsteal]'))) { doSteal(+t.dataset.vsteal, t); return; }
      if ((t = e.target.closest('[data-vmon]'))) { vmonPanel(+t.dataset.vmon); return; }
      if ((t = e.target.closest('[data-poke]'))) {
        var fig = t.closest('.hm-fig'); if (fig) { fig.classList.remove('hop'); void fig.offsetWidth; fig.classList.add('hop'); }
        var pd = st.view && st.view.data, pm = t.dataset.mon || '精灵';
        if (pd && !pd.me && !(pokeAt[pm] && Date.now() - pokeAt[pm] < 1500)) { pokeAt[pm] = Date.now(); hbEvent(pd.user, { kind: 'poke', mon: pm }); }   // 记进主人的基地动态
        return;
      }
      if ((t = e.target.closest('[data-teafight]'))) {
        var d = st.view && st.view.data; if (!d || !d.mons.length || t.disabled) return;
        var foe = d.mons.map(A.spec).filter(Boolean);
        if (foe.length) A.teaFight({ owner: d.name, user: d.user, foe: foe, onDone: function (res, quit) { hbEvent(d.user, { kind: 'fight', r: quit ? 'quit' : res }); hb.at = 0; render(); } });
        return;
      }
      if ((t = e.target.closest('[data-friend]'))) { toggleFriend(t.dataset.friend); return; }
      if ((t = e.target.closest('[data-fpgift]'))) {   // 2026-11-01：给好友送经验（每天一次，双方各 200 友情点）
        if (t.disabled) return; var gu = t.dataset.fpgift; t.disabled = true;
        api('POST', '/api/fp-gift', { user: gu }).then(function (r) {
          if (r._code !== 200) { A.toast(r.error || '没送出去'); t.disabled = false; return; }
          if (!Array.isArray(st.fpSent)) st.fpSent = []; st.fpSent.push(gu); render(); A.toast('已送给 @' + gu + ' 10000 经验！' + (r.fp ? '你得到 ' + r.fp + ' 友情点。' : '你今天从送礼拿到的友情点已经满 2000 了。')); if (window.HS_FPCLAIM) HS_FPCLAIM();
        }).catch(function () { A.toast('连不上服务器'); t.disabled = false; });
        return;
      }
      if ((t = e.target.closest('[data-fight]'))) { if (!t.disabled) askFight(t.dataset.fight); return; }
      if ((t = e.target.closest('[data-watch]'))) { watchStart(t.dataset.watch); return; }
      if ((t = e.target.closest('[data-dm]'))) { dmOpen(t.dataset.dm); return; }
      if ((t = e.target.closest('[data-card]'))) { openCard(t.dataset.card); return; }
      if ((t = e.target.closest('[data-pick]'))) {
        var u = +t.dataset.pick, ed = st.edit, k = ed.show.indexOf(u);
        if (k >= 0) ed.show.splice(k, 1); else if (ed.show.length < SHOW_MAX) ed.show.push(u);
        ed.dirty = true; render(); return;
      }
      if ((t = e.target.closest('[data-helper]'))) { var hu = +t.dataset.helper, hk = st.edit.helpers.indexOf(hu); if (hk >= 0) st.edit.helpers.splice(hk, 1); else if (st.edit.helpers.length < HELP_MAX) st.edit.helpers.push(hu); st.edit.dirty = true; render(); return; }
      if (e.target.id === 'me-save') { saveCard(); return; }
      if (e.target.id === 'me-reset') { startEdit(); render(); return; }
    });
    $('pg-social').addEventListener('input', function (e) {
      if (e.target.id !== 'me-motto') return;
      st.edit.motto = Array.from(e.target.value).slice(0, MOTTO_MAX).join(''); st.edit.dirty = true;
      $('me-cnt').textContent = Array.from(st.edit.motto).length + ' / ' + MOTTO_MAX;
      $('me-save').disabled = false; $('me-reset').disabled = false; $('me-msg').textContent = '有修改还没保存';
      var pm = document.querySelector('.mine-prev .pc-motto');
      if (pm) { pm.textContent = st.edit.motto || '这位船员还没有写个人宣言。'; pm.classList.toggle('empty', !st.edit.motto); }
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
    ws.onopen = function () { ws.send(JSON.stringify({ type: 'auth', token: C.token(), pv: 2 })); };   // pv 2：支持服务器当裁判（server/pvp.js）
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
      case 'authed': st.wsOk = true; st.retry = 0; load(); render(); renderBrawl(); if (HB.castResync) HB.castResync(); dmLoadList(true); if (!hb.peeked) { hb.peeked = true; hbPeek(); farmPeek(); } break;
      case 'cast-viewers': if (HB.castViewers) HB.castViewers(m.n, m.names); break;
      case 'cast-invited': if (HB.castInvited) HB.castInvited(m.ok, m.ok ? '已向 ' + m.n + ' 位在线船员发出观战邀请，现在所有人都可以观战这场对战' : m.msg); break;
      case 'cast-note': if (HB.castNote) HB.castNote(m.msg); break;
      case 'watch-invite': watchInvite(m); break;
      case 'watch': onWatch(m); break;
      case 'dm': dmGot(m); break;
      case 'home-ev': homeEv(m); break;
      case 'farm-ev': farmEv(m); break;
      case 'dm-echo': dmEcho(m); break;
      case 'brawl-wait': if (st.bw.wait) { st.bw.wait.id = m.id; st.bw.wait.n = m.n; st.bw.wait.deadline = Date.now() + m.seconds * 1000; } renderBrawl(); break;
      case 'brawl-invite': brawlInvite(m); break;
      case 'brawl-end': brawlEnd(m); break;
      case 'auth-fail': st.wsOk = false; break;
      case 'presence':
        (st.players || []).forEach(function (p) { if (p.user === m.user) { p.online = m.online; p.busy = m.busy; p.battle = m.battle || null; p.watchOpen = !!m.watchOpen; if (!m.online) p.lastSeen = Date.now(); } });
        if (st.players && m.online && Date.now() - (st.loadedAt || 0) > 10000 && !(st.players || []).some(function (p) { return p.user === m.user; })) load();   // 列表里没有的（新玩家；没建角色的不在列表里）
        if (st.tab !== 'mine') render();
        renderBrawl();
        break;
      case 'ch-sent': if (st.pend) { st.pend.id = m.id; st.pend.deadline = Date.now() + m.seconds * 1000; drawPend(); } break;
      case 'ch-end': chEnd(m); break;
      case 'challenged': challenged(m); break;
      case 'match': startMatch(m); break;
      case 'prep': onPrep(m); break;
      case 'prep-err': A.toast(m.msg || '选择不符合要求'); break;
      case 'ct-series': ctSeries(m); break;
      case 'ct-rematch-ask': ctRematchAsk(m); break;
      case 'ct-rematch-res': if (m.msg) A.toast(m.msg); if (m.done && window.HSCT && HSCT.reload) HSCT.reload(); break;
      case 'ct-notice': if (window.HSCT) window.HSCT.notice(m.notice); break;
      case 'ct-draw': if (window.HSCT) window.HSCT.draw(); break;
      case 'ct-ready': if (window.HSCT) window.HSCT.ready(m); break;
      case 'mm': mmMsg(m.data || {}); break;
      case 'mm-end':
        if (st.prep && st.prep.id === m.id) { var pn = st.prep.v.peerName || '对方'; closePrep(); A.toast(m.reason === 'quit' ? pn + ' 退出了选人，这场切磋取消了。' : pn + ' 离开了，这场切磋取消了。'); load(); break; }
        if (st.match && m.reason === 'left') { st.match.aborted = 'peer'; HB.pvpAbort(st.match.foe + ' 离开了对战，你获胜', 'win'); stopHost(); }
        break;
    }
  }

  /* ---------- 发起切磋 ----------
   * 规模 1v1 / 3v3 / 5v5；规则「常规」（背包里的练度）或「平衡」（统一 LV60、自选技能）；
   * 5v5 平衡模式还可以选「普通盲选」或「竞技征召」。 */
  var DRAFT_MIN = 8;
  function fightLabel(mode, rule, pick) { return mode + 'v' + mode + (rule === 'balance' ? ' · 平衡' + (pick === 'draft' ? ' · 竞技征召' : mode === 5 ? ' · 普通盲选' : '') : ' · 常规'); }
  function ruleNote(mode, rule, pick) {
    if (rule !== 'balance') return '常规模式：双方各派出当前出战配队的前 ' + mode + ' 只精灵（不足就全部上场），按背包里的等级、性格、学习力和技能对战，按配队顺序出场。';
    var bal = '所有精灵统一 LV' + A.BAL_LV + '，技能库全部开放（自己挑 4 个），性格无修正，没有学习力和纹章。';
    if (pick === 'draft') return '竞技征召：接受后双方各从自己拥有的精灵里带 8~10 种 → 各禁用对方 3 种 → 从自己剩下的里选 5 只并配技能，然后开打。' + bal;
    return '平衡模式 · 盲选：接受后双方各从自己拥有的精灵里选 ' + mode + ' 只并配技能，看不到对方选了什么。' + bal;
  }
  function askFight(user) {
    if (!st.wsOk) { A.toast('还没连上服务器，请稍后再试'); return; }
    if (st.pend) { A.toast('你已经在等待别人回应了'); return; }
    var p = (st.players || []).filter(function (x) { return x.user === user; })[0] || { user: user, name: user, teamN: 0 };
    var acc = A.acc(), mine = (acc.teams[acc.active] || []).map(A.mon).filter(Boolean), nSp = A.speciesN();
    if (!mine.length) { A.toast('你的出战配队里还没有精灵，先去「精灵背包」配队'); return; }
    var mode = Math.min(3, Math.max(1, mine.length >= 3 ? 3 : 1));
    var seg = function (name, list, cur) { return '<div class="seg fm-seg" role="radiogroup">' + list.map(function (o) { return '<label' + (o.dis ? ' class="dis" title="' + esc(o.dis) + '"' : '') + '><input type="radio" name="' + name + '" value="' + o.v + '"' + (o.v === cur ? ' checked' : '') + (o.dis ? ' disabled' : '') + '><span>' + o.t + '</span></label>'; }).join('') + '</div>'; };
    dialog('fight', '<span class="step">切磋</span><h2>向 ' + esc(p.name || user) + ' 宣战</h2>' +
      '<div class="fm-row"><b>规模</b>' + seg('fm', [{ v: '1', t: '1v1' }, { v: '3', t: '3v3' }, { v: '5', t: '5v5' }], String(mode)) + '</div>' +
      '<div class="fm-row"><b>规则</b>' + seg('fr', [{ v: 'normal', t: '常规模式' }, { v: 'balance', t: '平衡模式' }], 'normal') + '</div>' +
      '<div class="fm-row" id="fm-pick-row"><b>选人</b>' + seg('fp', [{ v: 'blind', t: '普通盲选' }, { v: 'draft', t: '竞技征召', dis: nSp < DRAFT_MIN ? '你只有 ' + nSp + ' 种精灵，竞技征召至少要 ' + DRAFT_MIN + ' 种' : '' }], 'blind') + '</div>' +
      '<p class="hint" id="fm-note"></p>' +
      '<div class="fm-team" id="fm-team"></div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-x="1">取消</button><button type="button" class="btn primary" id="fm-go">宣战</button></div>',
      function (el, close) {
        function val(n) { var i = el.querySelector('input[name=' + n + ']:checked'); return i ? i.value : null; }
        function cur() { var n = +val('fm'), r = val('fr'); return { mode: n, rule: r, pick: r === 'balance' && n === 5 ? val('fp') : r === 'balance' ? 'blind' : null }; }
        function upd() {
          var c = cur();
          el.querySelector('#fm-pick-row').hidden = !(c.rule === 'balance' && c.mode === 5);
          el.querySelector('#fm-note').textContent = ruleNote(c.mode, c.rule, c.pick) + (c.rule === 'balance' ? '' : ' 对方的配队里有 ' + (p.teamN || '?') + ' 只。') + (c.pick === 'draft' ? ' 对方也要拥有至少 ' + DRAFT_MIN + ' 种精灵。' : '');
          el.querySelector('#fm-team').innerHTML = c.rule === 'balance' ? '<b>你拥有 ' + nSp + ' 种精灵</b><span class="hint">对方接受后再挑选出战精灵和技能</span>' : '<b>你的出场精灵</b>' + mine.slice(0, c.mode).map(function (m) { return monThumb(m); }).join('');
        }
        upd();
        el.addEventListener('change', upd);
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-x]')) return close();
          if (e.target.id !== 'fm-go') return;
          var c = cur();
          if (c.pick === 'draft' && nSp < DRAFT_MIN) { A.toast('竞技征召至少要拥有 ' + DRAFT_MIN + ' 种精灵'); return; }
          e.target.disabled = true; e.target.textContent = '正在同步存档……';
          C.flush().then(function () {
            close();
            st.pend = { to: user, toName: p.name || user, mode: c.mode, label: fightLabel(c.mode, c.rule, c.pick), id: null, deadline: Date.now() + 30000 };
            if (!send({ type: 'challenge', to: user, mode: c.mode, rule: c.rule, pick: c.pick })) { st.pend = null; A.toast('连接断开了，请稍后再试'); return; }
            drawPend();
          });
        });
      });
  }
  function drawPend() {
    var P = st.pend; if (!P) return;
    if (!P.dlg) {
      P.dlg = dialog('wait', '<span class="step">切磋 · ' + esc(P.label || P.mode + 'v' + P.mode) + '</span><h2>等待 ' + esc(P.toName) + ' 回应</h2><p class="hint" id="pd-left"></p>' +
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
    if (m.rule === 'contest') { ctChallenged(m); return; }
    var acc = A.acc(), mine = (acc.teams[acc.active] || []).map(A.mon).filter(Boolean).slice(0, m.mode), bal = m.rule === 'balance';
    var deadline = Date.now() + m.seconds * 1000, iv;
    var d = dialog('incoming', '<span class="step">⚔ 宣战</span><h2>' + esc(m.fromName) + ' 向你发起切磋！</h2>' +
      '<p><b>' + esc(fightLabel(m.mode, m.rule, m.pick)) + '</b></p><p class="hint">' + esc(ruleNote(m.mode, m.rule, m.pick)) + '切磋不影响经验和段位。</p>' +
      (bal ? '' : '<div class="fm-team"><b>你的出场精灵</b>' + (mine.length ? mine.map(monThumb).join('') : '<span class="hint">出战配队是空的</span>') + '</div>') +
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
    watchClose(true);
    closePend(); if (st.inc) { st.inc.close(); st.inc = null; }
    st.bw.wait = null; closeBwInvite();
    [].forEach.call(document.querySelectorAll('.soc-dlg'), function (d) { d.remove(); });
    closePrep();
    st.match = { id: m.id, side: m.side, srv: !!m.srv, mode: m.mode, foe: m.peerName, names: m.names, brawl: !!m.brawl, bal: !!m.bal, pick: m.pick || null, label: m.brawl ? null : m.ct ? m.ct.label : fightLabel(m.mode, m.rule, m.pick), ct: m.ct || null };
    if (m.ct) st.match.notes = ctNotes(m);
    if (m.brawl) { st.match.notes = brawlNotes(m); brawlShow(m); }
    if (m.bal) st.match.notes = balNotes(m);
    vsSplash(m);   // 2026-10-27：战前 VS 小画面
    // 2026-10-24：服务器当裁判（m.srv）时双方都等服务器发来 init；旧办法（发起方结算）只在对方还是旧页面时用
    if (m.side === 0 && !m.srv) {
      var mk = m.brawl ? A.brawlSpec : m.bal ? A.balSpec : A.spec;
      var p = (m.teams[0] || []).map(mk).filter(Boolean), a = (m.teams[1] || []).map(mk).filter(Boolean);
      var S = newBattle(p, a);
      S.pvp = { mode: m.mode, brawl: !!m.brawl, bal: !!m.bal, pick: m.pick || null }; S.sides[0].name = m.names[0]; S.sides[1].name = m.names[1];
      st.match.S = S;
      send({ type: 'mm', id: m.id, data: { k: 'init', S: S } });
      begin(S);
      hostPhase('act');
    }
    // 应战方等发起方发来 init
  }
  /* 玩家对战的战前画面（2026-10-27）：左边自己、右边对手（头像、名字、称号），中间 VS，约 2.6 秒后自动消失，点一下也能跳过 */
  function vsSide(x, cls) {
    var tn = x.title ? (A.titleName ? A.titleName(x.title) : x.title) : '';
    return '<div class="vs-side ' + cls + '"><span class="pav big vs-av' + (x.avatar ? ' img' : '') + '">' + A.avatarInner(x.avatar, x.name || x.user) + '</span>' +
      '<b class="vs-name">' + esc(x.name || x.user || '对手') + '</b>' + (tn ? '<span class="vs-title">' + esc(tn) + '</span>' : '<span class="vs-title none">暂无称号</span>') + '</div>';
  }
  function vsSplash(m) {
    var old = document.getElementById('vs-splash'); if (old) old.remove();
    var me = myCard(), p = (st.players || []).filter(function (x) { return x.user === m.peer; })[0] || { user: m.peer, name: m.peerName };
    var foe = { user: m.peer, name: p.name || m.peerName, avatar: p.avatar || null, title: p.title || null };
    var d = document.createElement('div'); d.id = 'vs-splash'; d.className = 'vs-splash'; d.setAttribute('aria-hidden', 'true');
    var sparks = ''; for (var i = 0; i < 26; i++) sparks += '<i style="--a:' + Math.round(Math.random() * 360) + 'deg;--d:' + (60 + Math.round(Math.random() * 140)) + 'px;--t:' + (0.5 + Math.random() * 0.6).toFixed(2) + 's"></i>';
    d.innerHTML = '<div class="vs-bg l"></div><div class="vs-bg r"></div>' + vsSide(me, 'l') + vsSide(foe, 'r') +
      '<div class="vs-mid"><span class="vs-slash"></span><span class="vs-sparks">' + sparks + '</span><b class="vs-txt">VS</b></div>' +
      (st.match && st.match.label ? '<div class="vs-label">' + esc(st.match.label) + '</div>' : '');
    document.body.appendChild(d);
    var close = function () { if (!d.isConnected) return; d.classList.add('out'); setTimeout(function () { d.remove(); }, 380); };
    d.addEventListener('click', close);
    setTimeout(close, 2600);
    if (!p.avatar && m.peer) api('GET', '/api/card?user=' + encodeURIComponent(m.peer)).then(function (c) {   // 名单里没有对手的资料：补读一次名片
      if (!c || c._code !== 200 || !d.isConnected) return;
      var r = d.querySelector('.vs-side.r'); if (r) r.outerHTML = vsSide({ user: m.peer, name: c.name || foe.name, avatar: c.avatar, title: c.title }, 'r');
    }).catch(function () {});
  }
  function begin(S) {
    var M0 = st.match;
    A.enterBattle();
    HB.startPvp({ S: S, side: M0.side, foe: M0.foe, mode: M0.mode, label: M0.label, seconds: TURN_SEC, notes: M0.notes, brawl: M0.brawl,
      onAct: function (a) { if (M0.side === 0 && !M0.srv) hostGot(0, 'act', a); else send({ type: 'mm', id: M0.id, data: { k: 'act', a: a } }); },
      onRepl: function (k) { if (M0.side === 0 && !M0.srv) hostGot(0, 'repl', k); else send({ type: 'mm', id: M0.id, data: { k: 'repl', i: k } }); },
      onQuit: function () { if (M0.side === 0 && !M0.srv) hostQuit(0); else send({ type: 'mm', id: M0.id, data: { k: 'quit' } }); },
      onEmote: function (e) { send({ type: 'mm', id: M0.id, data: { k: 'emote', e: String(e).slice(0, 32) } }); },
      onOver: function (mine) {
        stopHost();
        if (M0.ct) send({ type: 'ct-res', id: M0.id, r: mine });   // 争霸赛：报这一局的结果
        send({ type: 'mm-over', id: M0.id });
        if (M0.pick === 'draft') A.noteDraft();   // 支线任务「竞技征召」：打完一场就算（胜负都算）
        if (M0.brawl) {
          var none = M0.quitSide === M0.side || M0.aborted === 'self';
          A.brawlReward(mine, none, M0.id, function (r) {
          var txt = none ? '认输或自己掉线的大乱斗没有奖励。' : r.give > 0 ? '大乱斗奖励：累积经验 +' + A.fmt(r.give) + (r.give < r.want ? '（已达今日上限）' : '') + '，今天累计 ' + A.fmt(r.today) + ' / ' + A.fmt(r.cap) + '。' : '今天的大乱斗经验已经达到上限 ' + A.fmt(r.cap) + '，明天再来。';
          setTimeout(function () { A.toast(txt); }, 600);
          });
        }
      },
      onEnd: function () { var bw = M0.brawl; st.match = null; if (bw) { A.leaveBattle(); A.go('arena'); } else A.leaveBattle(); load(); }
    });
  }
  function mmMsg(d) {
    var M0 = st.match; if (!M0) return;
    if (d.k === 'emote') { if (HB.peerEmote) HB.peerEmote(d.e); return; }   // 对方发的表情
    if (M0.side === 1 || M0.srv) {   // 应战方，或者服务器当裁判时的双方：只播放结果
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

  /* ---------- 做题大王争霸赛（服务器见 server/contest.js、social.js 的 rule = 'contest'） ---------- */
  function ctNotes(m) {
    var c = m.ct, sn = function (a) { return (a || []).map(function (sid) { return SPMAP[sid] ? SPMAP[sid].name : sid; }).join('、') || '无'; };
    var out = [c.label + ' · 当前比分 ' + m.names[0] + ' ' + c.wins[0] + ' : ' + c.wins[1] + ' ' + m.names[1] + '（先赢 2 局获胜）'];
    if (c.bans) out.push('你禁用了对方的 ' + sn(c.bans[m.side]) + '；对方禁用了你的 ' + sn(c.bans[1 - m.side]) + '。');
    return out;
  }
  function ctSeries(m) {
    if (m.cancel) { A.toast('对手退出了选人，这次对局不算，之后可以再约。'); load(); return; }
    if (m.paused) { A.toast('对手离开了，比分 ' + m.wins[0] + ' : ' + m.wins[1] + ' 已经记下。下次再约，从第 ' + m.next + ' 局接着打。'); closePrep(); load(); return; }
    var me = C.user && C.user();
    if (m.done) { setTimeout(function () { A.toast(m.how === 'forfeit' ? (m.win === me ? '对手中途离开，你赢下了这个系列！' : '你中途离开，这个系列判负。') : (m.win === me ? '恭喜，你以 ' + Math.max(m.wins[0], m.wins[1]) + ':' + Math.min(m.wins[0], m.wins[1]) + ' 赢下了这个系列！' : '很遗憾，这个系列输掉了。')); if (window.HSCT) window.HSCT.refresh(); }, 1500); return; }
    setTimeout(function () { A.toast('比分 ' + m.wins[0] + ' : ' + m.wins[1] + '，第 ' + m.next + ' 局 ' + m.seconds + ' 秒后开始……'); }, 1200);
  }
  // 争霸赛重赛（2026-10-26）：对方申请把这一轮已经打完的结果作废重打
  function ctRematchAsk(m) {
    dialog('incoming', '<span class="step">🏆 争霸赛 · 重赛申请</span><h2>' + esc(m.fromName) + ' 申请重赛</h2><p class="hint">同意后，你们' + (m.final ? '决赛' : '第 ' + m.round + ' 轮') + '已经打完的结果会作废，需要重新打一场 bo3。</p>' +
      '<div class="soc-foot"><button type="button" class="btn" id="rm-no">不同意</button><button type="button" class="btn primary" id="rm-yes">同意重赛</button></div>', function (el, close) {
        el.dataset.sticky = '1';
        el.querySelector('#rm-no').addEventListener('click', function () { send({ type: 'ct-rematch-reply', id: m.id, ok: false }); close(); });
        el.querySelector('#rm-yes').addEventListener('click', function () { send({ type: 'ct-rematch-reply', id: m.id, ok: true }); close(); });
      });
  }
  function ctRematch(user) { if (!st.wsOk) { A.toast('还没连上服务器，请稍后再试'); return; } if (!send({ type: 'ct-rematch', to: user })) A.toast('连接断开了'); }
  function ctAsk(user, name, label) {
    if (!st.wsOk) { A.toast('还没连上服务器，请稍后再试'); return; }
    if (st.pend) { A.toast('你已经在等待别人回应了'); return; }
    if (A.inBattle()) { A.toast('你正在对战中'); return; }
    C.flush().then(function () {
      st.pend = { to: user, toName: name || user, mode: 5, label: label || '做题大王争霸赛', id: null, deadline: Date.now() + 30000 };
      if (!send({ type: 'challenge', to: user, mode: 5, rule: 'contest' })) { st.pend = null; A.toast('连接断开了，请稍后再试'); return; }
      drawPend();
    });
  }
  function ctChallenged(m) {
    var deadline = Date.now() + m.seconds * 1000, iv;
    var d = dialog('incoming', '<span class="step">🏆 ' + esc(m.label || '做题大王争霸赛') + '</span><h2>' + esc(m.fromName) + ' 邀请你进行争霸赛对战！</h2>' +
      '<p class="hint">bo3，先赢 2 局获胜。每局双方各从自己的精灵里带 6 只、禁用对方 1 只，再调整出场顺序和技能，打 5v5，按背包里的练度对战。</p><p class="hint" id="in-left"></p>' +
      '<div class="soc-foot"><button type="button" class="btn" id="in-no">稍后再打</button><button type="button" class="btn primary" id="in-yes">开始对战</button></div>',
      function (el, close) {
        el.dataset.sticky = '1';
        el.addEventListener('click', function (e) {
          if (e.target.id === 'in-no') { send({ type: 'ch-reply', id: m.id, ok: false }); st.inc = null; close(); return; }
          if (e.target.id === 'in-yes') { e.target.disabled = true; e.target.textContent = '正在同步存档……'; C.flush().then(function () { send({ type: 'ch-reply', id: m.id, ok: true }); }); }
        });
      });
    var close0 = d.close;
    st.inc = { id: m.id, fromName: m.fromName, dlg: d, close: function () { clearInterval(iv); close0(); } };
    iv = setInterval(function () { var l = d.el.querySelector('#in-left'); if (l) l.textContent = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) + ' 秒内有效'; }, 250);
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {}
  }

  /* ---------- 平衡模式的选人阶段（盲选 / 竞技征召） ---------- */
  function balNotes(m) {
    var out = ['平衡模式：双方精灵统一 LV' + A.BAL_LV + '，性格无修正，没有学习力和纹章，技能由双方自选。'];
    if (m.draft && m.draft.bans) {
      var sn = function (a) { return (a || []).map(function (sid) { return SPMAP[sid] ? SPMAP[sid].name : sid; }).join('、') || '无'; };
      out.push('竞技征召：你禁用了对方的 ' + sn(m.draft.bans[m.side]) + '；对方禁用了你的 ' + sn(m.draft.bans[1 - m.side]) + '。');
    }
    if (m.auto && m.auto[m.side]) out.push('你选人超时，由系统代选了出战精灵。');
    if (m.auto && m.auto[1 - m.side]) out.push('对方选人超时，由系统代选。');
    return out;
  }
  var PHASE_T = { pool: '带精灵', ban: '禁用对方精灵', pick: '选出战精灵、配技能', ct6: '带 6 只精灵', ctban: '禁用对方 1 只', ctset: '调整出战顺序和技能' };
  function spName(sid) { return SPMAP[sid] ? SPMAP[sid].name : sid; }
  function spImg(sid) { return A.view({ sid: sid, lv: A.BAL_LV }).img; }
  function onPrep(v) {
    var P = st.prep;
    if (!P || P.id !== v.id) {
      closePend(); if (st.inc) { st.inc.close(); st.inc = null; }
      [].forEach.call(document.querySelectorAll('.soc-dlg'), function (d) { d.remove(); });
      P = st.prep = { id: v.id, v: null, phase: null, sel: [], moves: {}, focus: null };
      P.dlg = dialog('prep', '<div class="pp-body"></div>', function (el) { el.dataset.sticky = '1'; el.addEventListener('click', prepClick); });
      P.iv = setInterval(prepTick, 500);
    }
    if (P.phase !== v.phase) { P.sel = v.phase === 'ctset' ? (v.allowed || []).slice(0, v.need ? v.need[1] : 5) : []; P.focus = null; P.phase = v.phase; P.sent = false; P.ctMv = {}; }
    if (v.mine) { P.sel = v.mine.slice(); P.sent = true; }
    P.v = v; P.deadline = Date.now() + v.left * 1000;
    // 选不了的（比如被禁用的）从已选里去掉
    P.sel = P.sel.filter(function (sid) { return v.allowed.indexOf(sid) >= 0; });
    renderPrep();
  }
  function closePrep() { var P = st.prep; if (!P) return; clearInterval(P.iv); if (P.dlg) P.dlg.close(); st.prep = null; }
  function prepTick() { var P = st.prep; if (!P) return; var l = P.dlg.el.querySelector('#pp-left'); if (l) l.textContent = Math.max(0, Math.ceil((P.deadline - Date.now()) / 1000)) + ' 秒'; }
  function movesOf(sid) {
    var P = st.prep;
    if (!P.moves[sid]) P.moves[sid] = HB.loadout ? HB.loadout(sid) : SPMAP[sid].def.slice();
    return P.moves[sid];
  }
  function spGrid(list, opt) {
    var P = st.prep;
    return '<div class="me-pick pp-grid">' + list.map(function (sid) {
      var s = SPMAP[sid]; if (!s) return '';
      var k = P.sel.indexOf(sid), full = k < 0 && P.sel.length >= P.v.need[1];
      var ro = opt.ro, cls = 'me-mon' + (k >= 0 && !ro ? ' on' : '') + (opt.ban && k >= 0 ? ' ban' : '') + (opt.mark && opt.mark.indexOf(sid) >= 0 ? ' banned' : '');
      return '<button type="button" class="' + cls + '"' + (ro ? ' disabled' : ' data-pp="' + sid + '"') + (!ro && (full || P.sent) ? ' disabled' : '') + ' aria-pressed="' + (k >= 0) + '">' +
        (k >= 0 && !ro ? '<span class="me-no">' + (opt.ban ? '禁' : k + 1) + '</span>' : '') + '<img src="' + spImg(sid) + '" alt=""><b>' + esc(s.name) + '</b><small>' + s.types.join(' / ') + '</small></button>';
    }).join('') + '</div>';
  }
  function moveEditor(sid) {
    var s = SPMAP[sid], cur = movesOf(sid), P = st.prep;
    var list = s.moves.concat(s.hidden).filter(function (n, i, a) { return M[n] && a.indexOf(n) === i; });
    return '<div class="pp-moves"><p class="pp-mh"><b>' + esc(s.name) + ' 的技能</b><span class="' + (cur.length === 4 ? 'blue' : 'red') + '">' + cur.length + ' / 4</span><span class="hint">技能库全部开放，选好的会记成这只精灵的默认配招</span></p><div class="pp-mlist">' +
      list.map(function (n) {
        var m = M[n], on = cur.indexOf(n) >= 0;
        return '<button type="button" class="pp-mv' + (on ? ' on' : '') + '" data-mv="' + esc(n) + '"' + (P.sent || (!on && cur.length >= 4) ? ' disabled' : '') + ' title="' + esc(m.d) + '" style="--tc:' + (TYPE_COLOR[m.type] || '#888') + '">' +
          '<b>' + esc(m.name) + (m.hidden ? '<i>隐藏</i>' : '') + '</b><small>' + m.type + ' · ' + m.cat + (m.power ? ' · ' + m.power : '') + '</small></button>';
      }).join('') + '</div></div>';
  }
  function ctGrid(cards, opt) {
    var P = st.prep;
    return '<div class="me-pick pp-grid">' + cards.map(function (c) {
      var k = P.sel.indexOf(c.u), full = k < 0 && P.sel.length >= P.v.need[1], vw = A.view({ sid: c.sid, lv: c.lv, shiny: c.shiny, fs: c.fs }), s = SPMAP[c.sid] || { types: [] };
      var mark = opt.mark && opt.mark.indexOf(c.u) >= 0, ro = opt.ro;
      return '<button type="button" class="me-mon' + (k >= 0 && !ro ? ' on' : '') + (opt.ban && k >= 0 ? ' ban' : '') + (mark ? ' banned' : '') + '"' + (ro ? ' disabled' : ' data-pp="' + esc(c.u) + '"') + (!ro && (full || P.sent) ? ' disabled' : '') + '>' +
        (k >= 0 && !ro ? '<span class="me-no">' + (opt.ban ? '禁' : k + 1) + '</span>' : '') + '<img src="' + vw.img + '" alt=""><b>' + esc(c.nick || vw.name) + '</b><small>LV' + c.lv + ' · ' + s.types.join(' / ') + '</small></button>';
    }).join('') + '</div>';
  }
  // 争霸赛 · 调整（2026-10-26）：禁用之后，剩下的精灵自己排出战顺序（第 1 只首发），也可以换技能（只能选这只精灵已经会的）
  function ctMoves(u) { var P = st.prep, c = P.v.ct; if (!P.ctMv[u]) P.ctMv[u] = ((c.sent && c.sent[u]) || (c.cur && c.cur[u]) || []).slice(); return P.ctMv[u]; }
  function ctSetHTML() {
    var P = st.prep, v = P.v, c = v.ct, card = function (u) { return c.cards.filter(function (x) { return x.u === u; })[0]; };
    if (!P.focus || P.sel.indexOf(P.focus) < 0) P.focus = P.sel[0];
    var strip = '<div class="pp-chosen">' + P.sel.map(function (u, i) {
      var x = card(u), vw = x ? A.view({ sid: x.sid, lv: x.lv, shiny: x.shiny, fs: x.fs }) : { name: u };
      return '<span class="pp-ch-w" data-k="' + esc(u) + '"><button type="button" class="pp-ch' + (u === P.focus ? ' on' : '') + '" data-pf="' + esc(u) + '"><span>' + (i + 1) + '</span>' + (x ? '<img src="' + vw.img + '" alt="" draggable="false">' : '') + esc((x && x.nick) || vw.name) + '<small>' + ctMoves(u).length + '/4</small></button></span>';
    }).join('') + '</div>';
    var u = P.focus, x = card(u), list = (c.avail && c.avail[u]) || [], cur = ctMoves(u);
    var ed = x ? '<div class="pp-moves"><p class="pp-mh"><b>' + esc(x.nick || A.view({ sid: x.sid, lv: x.lv }).name) + ' 的技能</b><span class="' + (cur.length === 4 ? 'blue' : 'red') + '">' + cur.length + ' / 4</span><span class="hint">只能选它现在会的技能</span></p><div class="pp-mlist">' +
      list.map(function (n) { var m = M[n]; if (!m) return ''; var on = cur.indexOf(n) >= 0;
        return '<button type="button" class="pp-mv' + (on ? ' on' : '') + '" data-cmv="' + esc(n) + '"' + (P.sent || (!on && cur.length >= 4) ? ' disabled' : '') + ' title="' + esc(m.d) + '" style="--tc:' + (TYPE_COLOR[m.type] || '#888') + '"><b>' + esc(m.name) + (m.hidden ? '<i>隐藏</i>' : '') + '</b><small>' + m.type + ' · ' + m.cat + (m.power ? ' · ' + m.power : '') + '</small></button>'; }).join('') + '</div></div>' : '';
    return '<p class="pp-bans">对方禁掉了你的：<b class="red">' + ((v.bans && v.bans[1]) || []).map(function (bu) { var y = card(bu); return y ? esc(y.nick || A.view({ sid: y.sid, lv: y.lv }).name) : ''; }).join('、') + '</b></p>' +
      '<p>按顺序出场，第 1 只首发；按住精灵拖动可以调整顺序。点一只精灵可以换它的技能。对方看不到你的顺序和技能。</p>' + strip + ed;
  }
  function renderCtPrep() {
    var P = st.prep, v = P.v, body = P.dlg.el.querySelector('.pp-body'), need = v.need, n = P.sel.length, okN = n >= need[0] && n <= need[1];
    var steps = '<ol class="pp-steps">' + ['ct6', 'ctban', 'ctset'].map(function (k, i) { var at = ['ct6', 'ctban', 'ctset'].indexOf(v.phase); return '<li class="' + (i < at ? 'done' : i === at ? 'cur' : '') + '">' + (i + 1) + '. ' + PHASE_T[k] + '</li>'; }).join('') + '<li>4. 开打</li></ol>';
    var head = '<span class="step">' + esc(v.ct.label) + ' · 对手 ' + esc(v.peerName || '') + '</span><h2>' + PHASE_T[v.phase] + '</h2>' + steps +
      '<p class="pp-st"><span>剩余 <b id="pp-left"></b></span><span>' + (v.done[1] ? '<b class="blue">对方已选好</b>' : '对方还在选……') + '</span></p>';
    var main;
    if (v.phase === 'ct6') main = '<p>从你的精灵里带 <b>' + need[1] + '</b> 只（已选 ' + n + '），按背包里的等级、性格、学习力和技能对战。对方会禁掉其中 1 只，之后还可以调整出场顺序和技能。</p>' + ctGrid(v.ct.cards, {}) +
      (P.sel.length ? '<h4 class="pp-h">已选（按住拖动调整顺序）</h4><div class="pp-chosen">' + P.sel.map(function (u, i) { var x = v.ct.cards.filter(function (c) { return c.u === u; })[0]; if (!x) return ''; var vw = A.view({ sid: x.sid, lv: x.lv, shiny: x.shiny, fs: x.fs }); return '<span class="pp-ch-w" data-k="' + esc(u) + '"><span class="pp-ch"><span>' + (i + 1) + '</span><img src="' + vw.img + '" alt="" draggable="false">' + esc(x.nick || vw.name) + '</span></span>'; }).join('') + '</div>' : '');
    else if (v.phase === 'ctset') main = ctSetHTML();
    else {
      var mine = v.ct.cards.filter(function (c) { return (v.pools[0] || []).indexOf(c.u) >= 0; });
      main = '<p>对方带来了这 ' + (v.ct.foe || []).length + ' 只，选 <b>' + need[1] + '</b> 只禁用（已选 ' + n + '），它这一局不能上场。</p>' + ctGrid(v.ct.foe || [], { ban: true }) +
        '<h4 class="pp-h">你带的 ' + mine.length + ' 只（对方正在从里面禁 1 只）</h4>' + ctGrid(mine, { ro: true });
    }
    var foot = '<div class="soc-foot"><button type="button" class="btn ghost" id="pp-quit">退出</button>' +
      (P.sent ? '<button type="button" class="btn" disabled>已提交，等待对方……</button>' : '<button type="button" class="btn primary" id="pp-go"' + (okN ? '' : ' disabled') + '>' + (v.phase === 'ctban' ? '确认禁用' : v.phase === 'ctset' ? '确定出战' : '确认携带') + '</button>') + '</div>';
    var box0 = body.parentNode, dlg0 = box0 && box0.parentNode, y = box0 ? box0.scrollTop : 0, y2 = dlg0 ? dlg0.scrollTop : 0;   // 重画时保持滚动位置（框和遮罩层都可能在滚）
    body.innerHTML = head + main + foot;
    if (box0) box0.scrollTop = y; if (dlg0) dlg0.scrollTop = y2;
    bindSort(body);
    prepTick();
  }
  // 已选精灵的那一排：拖动调整顺序（没提交之前）
  function bindSort(body) {
    var P = st.prep, strip = body.querySelector('.pp-chosen'); if (!strip || P.sent || !H || !H.sortable) return;
    H.sortable(strip, function (keys) { P.sel = keys.filter(function (k) { return P.sel.indexOf(k) >= 0; }); renderPrep(); });
  }
  function renderPrep() {
    if (st.prep.v.kind === 'ct') return renderCtPrep();
    var P = st.prep, v = P.v, draft = v.kind === 'draft', body = P.dlg.el.querySelector('.pp-body');
    var steps = draft ? '<ol class="pp-steps">' + ['pool', 'ban', 'pick'].map(function (k, i) { var at = ['pool', 'ban', 'pick'].indexOf(v.phase); return '<li class="' + (i < at ? 'done' : i === at ? 'cur' : '') + '">' + (i + 1) + '. ' + PHASE_T[k] + '</li>'; }).join('') + '</ol>' : '';
    var need = v.need, n = P.sel.length, okN = n >= need[0] && n <= need[1];
    var cnt = need[0] === need[1] ? need[0] : need[0] + '~' + need[1];
    var head = '<span class="step">切磋 · ' + esc(fightLabel(v.mode, 'balance', v.kind)) + ' · 对手 ' + esc(v.peerName || '') + '</span><h2>' + PHASE_T[v.phase] + '</h2>' + steps +
      '<p class="pp-st"><span>剩余 <b id="pp-left"></b></span><span>' + (v.done[1] ? '<b class="blue">对方已选好</b>' : '对方还在选……') + '</span></p>';
    var main = '', side = '';
    if (v.phase === 'pool') main = '<p>从你拥有的 ' + v.allowed.length + ' 种精灵里，带 <b>' + cnt + '</b> 种进入征召（已选 ' + n + '）。下一步才会公开给对方。</p>' + spGrid(v.allowed, {});
    else if (v.phase === 'ban') {
      main = '<p>对方带来了 ' + v.allowed.length + ' 种精灵。选 <b>' + cnt + '</b> 种禁用（已选 ' + n + '），它们不能出战。</p>' + spGrid(v.allowed, { ban: true });
      side = '<h4 class="pp-h">你带来的 ' + v.pools[0].length + ' 种（对方正在从里面禁用 3 种）</h4>' + spGrid(v.pools[0], { ro: true });
    } else {
      main = '<p>选 <b>' + cnt + '</b> 只出战（已选 ' + n + '，按选的顺序出场，第 1 只首发），点已选的精灵可以改它的技能。' + (draft ? '' : '对方看不到你选了什么。') + '</p>' + spGrid(v.allowed, {});
      if (draft) {
        var foeLeft = v.pools[1].filter(function (sid) { return v.bans[0].indexOf(sid) < 0; });
        side = '<p class="pp-bans">你禁用了：<b>' + v.bans[0].map(spName).join('、') + '</b>　对方禁用了你的：<b class="red">' + v.bans[1].map(spName).join('、') + '</b></p>' +
          '<h4 class="pp-h">对方可以从这 ' + foeLeft.length + ' 种里选 5 只</h4>' + spGrid(foeLeft, { ro: true });
      }
      if (P.sel.length) {
        if (!P.focus || P.sel.indexOf(P.focus) < 0) P.focus = P.sel[0];
        main += '<div class="pp-chosen">' + P.sel.map(function (sid, i) { return '<span class="pp-ch-w" data-k="' + sid + '"><button type="button" class="pp-ch' + (sid === P.focus ? ' on' : '') + '" data-pf="' + sid + '"><span>' + (i + 1) + '</span><img src="' + spImg(sid) + '" alt="" draggable="false">' + esc(spName(sid)) + '<small>' + movesOf(sid).length + '/4</small></button></span>'; }).join('') + '</div><p class="hint">按住已选的精灵拖动可以调整出场顺序。</p>' + moveEditor(P.focus);
      }
    }
    var badMv = v.phase === 'pick' && P.sel.some(function (sid) { return !movesOf(sid).length; });
    var foot = '<div class="soc-foot"><button type="button" class="btn ghost" id="pp-quit">退出</button>' +
      (P.sent ? '<button type="button" class="btn" disabled>已提交，等待对方……</button>' : '<button type="button" class="btn primary" id="pp-go"' + (okN && !badMv ? '' : ' disabled') + '>' + (v.phase === 'ban' ? '确认禁用' : v.phase === 'pool' ? '确认携带' : '确定出战') + '</button>') + '</div>';
    var box0 = body.parentNode, dlg0 = box0 && box0.parentNode, y = box0 ? box0.scrollTop : 0, y2 = dlg0 ? dlg0.scrollTop : 0;   // 重画时保持滚动位置（框和遮罩层都可能在滚）
    body.innerHTML = head + main + side + foot;
    if (box0) box0.scrollTop = y; if (dlg0) dlg0.scrollTop = y2;
    bindSort(body);
    prepTick();
  }
  function prepClick(e) {
    var P = st.prep; if (!P) return;
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.id === 'pp-quit') {
      if (!P.quitArmed || Date.now() - P.quitArmed > 3000) { P.quitArmed = Date.now(); b.textContent = '再点一次确认退出'; return; }
      send({ type: 'prep-quit', id: P.id }); closePrep(); A.toast(P.v.kind === 'ct' ? (P.v.ct && /第 [23] 局/.test(P.v.ct.label || '') ? '你退出了选人，比分已经记下，下次再约接着打。' : '你退出了选人，这次对局不算，之后可以再约对手。') : '你退出了这场切磋。'); load(); return;
    }
    if (P.sent) return;
    if (b.dataset.pp) {
      var sid = b.dataset.pp, k = P.sel.indexOf(sid);
      if (k >= 0) P.sel.splice(k, 1); else if (P.sel.length < P.v.need[1]) { P.sel.push(sid); P.focus = sid; }
      renderPrep(); return;
    }
    if (b.dataset.pf) { P.focus = b.dataset.pf; renderPrep(); return; }
    if (b.dataset.cmv && P.focus) { var cm = ctMoves(P.focus), cn = b.dataset.cmv, ci = cm.indexOf(cn); if (ci >= 0) cm.splice(ci, 1); else if (cm.length < 4) cm.push(cn); renderPrep(); return; }
    if (b.dataset.mv && P.focus) {
      var cur = movesOf(P.focus), n = b.dataset.mv, i = cur.indexOf(n);
      if (i >= 0) cur.splice(i, 1); else if (cur.length < 4) cur.push(n);
      renderPrep(); return;
    }
    if (b.id === 'pp-go') {
      var msg = { type: 'prep', id: P.id, phase: P.v.phase, picks: P.sel.slice() };
      if (P.v.phase === 'ctset') {
        if (P.sel.some(function (u) { return !ctMoves(u).length; })) { A.toast('每只精灵至少要带 1 个技能'); return; }
        msg.moves = {}; P.sel.forEach(function (u) { msg.moves[u] = ctMoves(u).slice(); });
      }
      if (P.v.phase === 'pick') {
        msg.moves = {};
        P.sel.forEach(function (sid) { msg.moves[sid] = movesOf(sid).slice(); if (HB.setLoadout) HB.setLoadout(sid, msg.moves[sid]); });
      }
      if (send(msg)) { P.sent = true; renderPrep(); } else A.toast('连接断开了');
    }
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
    var sub = $('brawl-sub'); if (sub && A.brawlOpen()) sub.textContent = st.wsOk ? (n ? '现在有 ' + n + ' 位玩家可以匹配' : '暂时没有可以匹配的船员') : '正在连接服务器……';
    var foot;
    if (W) foot = '<div class="bw-wait"><span class="dot busy"></span><span>正在匹配……已邀请 ' + (W.n || '?') + ' 位在线玩家，<b id="bw-left">' + Math.max(0, Math.ceil((W.deadline - Date.now()) / 1000)) + '</b> 秒后没人接受就自动取消</span><button type="button" class="btn ghost" id="bw-cancel">取消匹配</button></div>';
    else {
      var why = !st.wsOk ? '正在连接服务器……' : team.length < 3 ? '出战配队里至少要有 3 只精灵，先去「精灵背包」配队' : picks.length !== 3 ? '还要选 ' + (3 - picks.length) + ' 只' : !n ? '现在没有可以匹配的船员（对方要在线，并且也在孝感大厅开放了大乱斗）' : '';
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
  /* 大乱斗的抽选动画：双方放进来的 6 只先按主人摆开 → 翻面收拢、洗牌 → 重新发给两边 → 翻开，标出原来是谁的
   * 只是播放效果，对战已经在后面开始了（点「开始对战」或等几秒自动关掉） */
  function brawlShow(m) {
    var me = m.side, cards = [], cnt = [0, 0];
    m.teams.forEach(function (t, side) { t.forEach(function (x, k) { cards.push({ sid: x.sid, owner: x.owner, to: side, k: k, from: cnt[x.owner]++ }); }); });
    var old = document.querySelector('.bwd'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'bwd';
    var foeName = m.names[1 - me] || '对手';
    el.innerHTML = '<div class="bwd-box"><h2>精灵大乱斗 · 抽选</h2><p class="bwd-msg" id="bwd-msg">双方各放进了 3 只精灵……</p>' +
      '<div class="bwd-stage"><span class="bwd-lab top">' + esc(foeName) + '</span><span class="bwd-lab bot">你</span>' +
      cards.map(function (c, i) {
        var v = A.view({ sid: c.sid, lv: A.BRAWL.lv });
        return '<div class="bwd-card" data-i="' + i + '"><div class="bwd-in"><div class="bwd-front"><img src="' + v.img + '" alt=""><b>' + esc(v.name) + '</b><small>' + (c.owner === me ? '你的' : '对方的') + '</small></div><div class="bwd-back">?</div></div></div>';
      }).join('') + '</div><button type="button" class="btn primary" id="bwd-go">跳过</button></div>';
    document.body.appendChild(el);
    var els = [].slice.call(el.querySelectorAll('.bwd-card')), msg = el.querySelector('#bwd-msg'), timers = [];
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function place(e, row, k, rot) { e.style.left = (6 + k * 31) + '%'; e.style.top = row === 'top' ? '6%' : row === 'mid' ? '30%' : '56%'; e.style.transform = 'rotate(' + (rot || 0) + 'deg)'; }
    function close() { timers.forEach(clearTimeout); if (el.parentNode) el.remove(); }
    // 1. 按主人摆开
    cards.forEach(function (c, i) { place(els[i], c.owner === me ? 'bot' : 'top', c.from); });
    // 2. 翻面、收拢到中间
    at(1100, function () { msg.textContent = '翻面、打乱……'; els.forEach(function (e, i) { e.classList.add('flip'); e.style.left = (37 + (i % 3) * 1.5) + '%'; e.style.top = (30 + (i % 2) * 2) + '%'; e.style.transform = 'rotate(' + (i * 7 - 18) + 'deg)'; e.style.zIndex = i; }); });
    // 3. 洗牌
    for (var r = 0; r < 6; r++) at(1700 + r * 220, function () { els.forEach(function (e) { e.style.left = (37 + (Math.random() - 0.5) * 30) + '%'; e.style.top = (30 + (Math.random() - 0.5) * 18) + '%'; e.style.transform = 'rotate(' + Math.round((Math.random() - 0.5) * 40) + 'deg)'; e.style.zIndex = Math.floor(Math.random() * 6); }); });
    // 4. 重新发给两边
    at(3150, function () { msg.textContent = '重新分配！'; });
    cards.forEach(function (c, i) { at(3200 + i * 160, function () { place(els[i], c.to === me ? 'bot' : 'top', c.k); els[i].style.zIndex = 10 + i; }); });
    // 5. 翻开，标出原来是谁的
    at(4400, function () {
      els.forEach(function (e) { e.classList.remove('flip'); });
      var mine = cards.filter(function (c) { return c.to === me; }), fromFoe = mine.filter(function (c) { return c.owner !== me; }).length;
      msg.textContent = '分配完成：你拿到了 ' + (3 - fromFoe) + ' 只自己的、' + fromFoe + ' 只对方的精灵。';
      el.querySelector('#bwd-go').textContent = '开始对战';
      els.forEach(function (e, i) { if (cards[i].to === me) e.classList.add('bwd-mine'); });
    });
    at(9000, close);
    el.addEventListener('click', function (e) { if (e.target.id === 'bwd-go') close(); });
  }
  // 分牌结果写进战斗记录：谁拿到了谁的精灵
  function brawlNotes(m) {
    var mine = m.teams[m.side], owners = m.names;
    return ['精灵大乱斗：双方 6 只精灵已统一为 LV' + A.BRAWL.lv + '，打乱后随机分配。',
      '你分到了：' + mine.map(function (x) { var v = A.view({ sid: x.sid, lv: A.BRAWL.lv }); return v.name + '（' + (x.owner === m.side ? '你的' : owners[x.owner] + ' 的') + '，' + x.nat + '）'; }).join('、')];
  }

  /* ---------- 观战 ----------
   * 对战中的玩家把画面发给服务器，服务器转给观众（见 server/social.js）。这里画观战窗口：上方两块信息牌、中间战场、下方战斗记录。
   * 画面里下方（左边）是被观战的玩家，上方（右边）是他的对手。 */
  if (HB.setCaster) HB.setCaster(function (op, data) { if (op === 'invite') send({ type: 'cast-invite' }); else send(Object.assign({ type: 'cast', op: op }, data)); });
  function watchStart(user) {
    if (!st.wsOk) { A.toast('还没连上服务器，稍等一下再试'); return; }
    if (A.inBattle()) { A.toast('你正在对战中，打完再来观战吧'); return; }
    watchClose(true);
    var p = (st.players || []).filter(function (x) { return x.user === user; })[0];
    st.watch = { user: user, name: p && p.name || user, head: null, ready: false, shown: [null, null] };
    wtOpen(false);
    send({ type: 'watch-start', user: user });
  }
  // 弹幕：观众发的文字 / 表情从右往左飘过战场（只有观众看得到，回放里也有）
  function bulletShow(name, text, e) {
    var f = document.querySelector('.wt-field'); if (!f) return;
    var lay = f.querySelector('.bl-layer'); if (!lay) { lay = document.createElement('div'); lay.className = 'bl-layer'; f.appendChild(lay); }
    var E0 = e && typeof emoteOf === 'function' ? emoteOf(e) : null;
    var el = document.createElement('div'); el.className = 'bl-item';
    el.style.top = (6 + Math.floor(Math.random() * 7) * 11) + '%';
    el.innerHTML = '<b>' + esc(name) + '：</b>' + (text ? esc(text) : '') + (E0 ? '<img src="' + E0.img + '" alt="' + esc(E0.n) + '">' : '');
    lay.appendChild(el); setTimeout(function () { el.remove(); }, 8200);
  }
  function wtOpen(replay) {
    var d = dialog('watch', '<div class="wt-head"><div><span class="step" id="wt-label">' + (replay ? '回放' : '观战') + '</span><h2 id="wt-title">' + esc(st.watch.name) + ' 的对战</h2></div>' + (replay ? '<button type="button" class="btn ghost" id="wt-speed">2 倍速</button>' : '<span class="cast-wrap wt-wrap"><button type="button" class="cast-n" id="wt-n" title="点击查看谁在观战"></button><span class="cast-pop" id="wt-pop" hidden></span></span>') + '<button type="button" class="btn ghost" data-wx="1">' + (replay ? '关闭回放' : '退出观战') + '</button></div>' +
      '<div class="wt-stage"><div class="plates"><div class="plate" id="wt-p0"></div><div class="vs">第<b id="wt-turn">1</b>回合</div><div class="plate r" id="wt-p1"></div></div>' +
      '<div class="field wt-field"><div class="mon p0" id="wt-m0"><div class="ground"></div><div class="face"><img alt=""></div></div><div class="mon p1" id="wt-m1"><div class="ground"></div><div class="face"><img alt=""></div></div>' +
      '<div class="banner" id="wt-banner"></div><div class="wt-wait" id="wt-wait">正在连接对战画面……</div><div class="endcard" id="wt-end" hidden><div class="box"><h3 id="wt-end-t"></h3><p class="hint" id="wt-end-s"></p><div class="row"><button type="button" class="btn" data-wx="1">关闭</button></div></div></div></div>' +
      '<div class="bl-bar">' + (replay ? '<span class="hint">回放里的弹幕会按当时的时间出现</span>' : '<input type="text" id="bl-in" maxlength="30" placeholder="发条弹幕（只有观众看得到）"><button type="button" class="btn" id="bl-go">发送</button><span class="bl-emo">' + (typeof EMOTES !== 'undefined' ? EMOTES.slice(0, 8).map(function (x) { return '<button type="button" data-ble="' + x.id + '" title="' + esc(x.n) + '"><img src="' + x.img + '" alt="' + esc(x.n) + '"></button>'; }).join('') : '') + '</span>') + '</div>' +
      '<div class="logbox"><h4>战斗记录</h4><div class="log" id="wt-log"></div></div></div>', function (el) {
        el.dataset.sticky = '1';
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'bl-in') { e.preventDefault(); bulletSend(); } });
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-wx]')) { watchClose(); return; }
          if (e.target.id === 'bl-go') { bulletSend(); return; }
          var de = e.target.closest('[data-ble]'); if (de) { bulletSend(de.dataset.ble); return; }
          if (e.target.id === 'wt-speed' && st.watch) { st.watch.speed = st.watch.speed === 2 ? 1 : 2; e.target.textContent = st.watch.speed === 2 ? '1 倍速' : '2 倍速'; return; }
          var pop = el.querySelector('#wt-pop');
          if (e.target.closest('#wt-n')) { pop.hidden = !pop.hidden; wtViewers(); return; }
          if (!e.target.closest('#wt-pop')) pop.hidden = true;
        });
      });
    st.watch.dlg = d;
  }
  function bulletSend(e) {
    var W = st.watch; if (!W || W.replay) return;
    var inp = $('bl-in'), t = e ? '' : (inp ? inp.value.trim() : '');
    if (!t && !e) return;
    if (W.dmAt && Date.now() - W.dmAt < 1500) { A.toast('发得太快了，歇一下'); return; }
    W.dmAt = Date.now();
    send({ type: 'danmaku', user: W.user, text: t, e: e || '' });
    if (inp && !e) inp.value = '';
  }
  function watchClose(silent) {
    var W = st.watch; if (!W) return;
    st.watch = null; if (W.dlg) W.dlg.close();
    if (W.replay) { clearTimeout(W.rt); return; }
    if (!W.over) send({ type: 'watch-stop' });
  }
  /* 争霸赛回放：按录下来的时间顺序重放画面、战斗记录、动画和弹幕 */
  function replayStart(id) {
    if (A.inBattle()) { A.toast('你正在对战中，打完再来看回放吧'); return; }
    C.api('GET', '/api/contest/replay?id=' + encodeURIComponent(id)).then(function (r) {
      if (r._code !== 200 || !Array.isArray(r.frames)) { A.toast(r.error || '回放加载失败'); return; }
      watchClose(true);
      var W = st.watch = { user: '', name: (r.names && r.names[0]) || (r.head && r.head.name) || '选手', head: r.head || {}, ready: true, shown: [null, null], replay: true, speed: 1, i: 0 };
      wtOpen(true);
      $('wt-label').textContent = '回放 · ' + (r.label || (r.head && r.head.label) || '对战');
      $('wt-title').textContent = W.name + ' vs ' + ((r.names && r.names[1]) || (r.head && r.head.foe) || '对手');
      var F = r.frames, t0 = Date.now(), base = 0;
      (function step() {
        if (st.watch !== W) return;
        while (W.i < F.length) {
          var f = F[W.i];
          if (W.i > 0 && f[0] - base > 0) { var wait = (f[0] - base) / W.speed; base = f[0]; W.rt = setTimeout(step, Math.min(wait, 4000)); return; }
          base = f[0];
          if (f[1]) wtSnap(f[1]); if (f[2]) wtLog(f[2]); if (f[3]) wtFx(f[3]); if (f[4]) bulletShow(f[4][0], f[4][1], f[4][2]);
          W.i++;
        }
        $('wt-end-t').textContent = '回放结束';
        $('wt-end-s').textContent = r.end ? W.name + '：' + (r.end.title || '') + (r.end.sub ? ' · ' + you(r.end.sub) : '') : '';
        $('wt-end').hidden = false;
      })();
    }).catch(function () { A.toast('回放加载失败'); });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.watch) watchClose(); });
  // 观众名单：小眼睛上显示人数，点开看是谁（自己标「你」）
  function wtViewers() {
    var W = st.watch; if (!W) return;
    var me = A.acc() && A.acc().name, list = W.viewers || [];
    var b = $('wt-n'); if (b) b.textContent = '👁 ' + list.length;
    var pop = $('wt-pop'); if (pop && !pop.hidden) pop.innerHTML = '<b>' + list.length + ' 人在观战</b><ul>' + list.map(function (x) { return '<li>' + esc(x) + (x === me ? '（你）' : '') + '</li>'; }).join('') + '</ul>';
  }
  function wtLog(list) {
    var lg = $('wt-log'); if (!lg) return;
    lg.insertAdjacentHTML('beforeend', list.map(function (x) { return '<p class="' + esc(x[1] || '') + '">' + esc(you(x[0])).replace(/【(.+?)】/g, '<b>$1</b>') + '</p>'; }).join(''));
    while (lg.children.length > 160) lg.removeChild(lg.firstChild);
    lg.scrollTop = lg.scrollHeight;
  }
  // 战斗记录是被观战的玩家视角写的（「你派出了……」），观众看到的换成他的名字
  function you(t) { var W = st.watch; return W ? String(t).replace(/你们/g, '大家').replace(/你/g, W.name) : String(t); }
  function hpCls(h, m) { var r = h / m; return r > 0.5 ? '' : r > 0.2 ? 'mid' : 'low'; }
  function wtSnap(sn) {
    var W = st.watch; if (!W || !sn || !sn.sides) return;
    $('wt-turn').textContent = sn.turn;
    sn.sides.forEach(function (sd, i) {
      var pl = $('wt-p' + i), who = i ? (W.head && W.head.foe) || '对手' : W.name;
      pl.innerHTML = '<span class="tape ' + (i ? 'r' : 'l') + '"></span><div class="row1"><span class="pn">' + esc(sd.name) + '</span>' + tchips(sd.types || []) +
        '<span class="chip sc lvc">' + (sd.lv ? 'LV' + sd.lv : 'LV ??') + '</span><span class="abil" tabindex="0">特性 · ' + esc(sd.ability ? sd.ability.n : '') + '<span class="tip" role="tooltip"><b>特性 · ' + esc(sd.ability ? sd.ability.n : '') + '</b>' + esc(sd.ability ? sd.ability.d : '') + '</span></span><span class="who">' + esc(who) + '</span></div>' +
        '<div class="hpbar"><i class="' + hpCls(sd.hp, sd.maxhp) + '" style="width:' + (sd.hp / sd.maxhp * 100) + '%"></i></div>' +
        '<div class="hprow"><span>' + (sd.dummy ? '体力 ∞' : sd.hp + ' / ' + sd.maxhp) + '</span><span class="pips">' + (sd.team || []).map(function (t) { return '<span class="' + (!t.id ? 'unk' : t.fainted ? 'dead' : '') + (t.active ? ' cur' : '') + '" title="' + esc(!t.id ? '还没派出' : t.nick || (SPMAP[t.id] ? SPMAP[t.id].name : '')) + '">' + (!t.id ? '?' : '') + '</span>'; }).join('') + '</span></div>' +
        '<div class="chips">' + (sd.chips || []).map(function (c) { return '<span class="chip sc ' + esc(c.k || '') + '" tabindex="0">' + esc(c.t) + (c.d ? '<span class="tip" role="tooltip"><b>' + esc(c.h || c.t) + '</b>' + esc(c.d) + '</span>' : '') + '</span>'; }).join('') + '</div>';
      var mon = $('wt-m' + i), img = mon.querySelector('img'), key = sd.id + '|' + (sd.img || '');
      if (W.shown[i] !== key) { W.shown[i] = key; img.src = sd.img || SPRITES[sd.id] || ''; img.alt = sd.name; mon.classList.remove('fainted'); wtAnim(mon, 'enter'); }
      mon.classList.toggle('fainted', !!sd.fainted);
      mon.classList.toggle('miasma', (sd.chips || []).some(function (c) { return String(c.t).indexOf('瘴气') === 0; }));
    });
    $('wt-wait').hidden = true;
  }
  function wtAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 900); }
  function wtFx(list) {
    (list || []).forEach(function (f, k) {
      setTimeout(function () {
        if (!st.watch) return;
        var mon = $('wt-m' + (f.i ? 1 : 0)); if (!mon) return;
        if (f.a === 'use') { wtAnim(mon, 'lunge' + (f.i ? 1 : 0)); var b = $('wt-banner'); b.textContent = f.m || ''; b.style.color = (typeof TYPE_COLOR !== 'undefined' && TYPE_COLOR[f.ty]) || 'var(--ink)'; wtAnim(b, 'show'); }
        else if (f.a === 'hit' || f.a === 'heal') {
          wtAnim(mon, f.a === 'hit' ? 'hit' : 'heal');
          var n = document.createElement('div'); n.className = 'float ' + (f.a === 'heal' ? 'heal' : f.c ? 'crit' : ''); n.textContent = f.a === 'heal' ? '+' + f.n : f.lb != null ? f.lb + '-' + f.n : '-' + f.n + (f.c ? '!' : '');
          if (f.a === 'hit' && f.c) { var wf = mon.parentNode; if (wf) wtAnim(wf, 'bshake'); }
          mon.appendChild(n); setTimeout(function () { n.remove(); }, 950);
        } else if (f.a === 'miss') { var mn = document.createElement('div'); mn.className = 'float miss'; mn.textContent = '未命中'; mon.appendChild(mn); setTimeout(function () { mn.remove(); }, 950); }
        else if (f.a === 'throw') wtAnim(mon, 'throw');
        else if (f.a === 'emote' && typeof emoteOf === 'function' && emoteOf(f.e)) { var ob = mon.querySelector('.emote-bub'); if (ob) ob.remove(); var eb = document.createElement('div'); eb.className = 'emote-bub' + (f.i ? '' : ' flip'); eb.innerHTML = '<img src="' + emoteOf(f.e).img + '" alt="">'; mon.appendChild(eb); setTimeout(function () { eb.remove(); }, 3200); }
      }, k * 120);
    });
  }
  function onWatch(m) {
    var W = st.watch; if (!W || (m.user && m.user !== W.user)) return;
    if (m.op === 'err') { watchClose(true); A.toast(m.msg || '现在看不了这场对战'); return; }
    if (m.op === 'full') {
      W.head = m.head; W.name = (m.head && m.head.name) || W.name; W.ready = true; W.shown = [null, null];
      $('wt-label').textContent = '观战 · ' + ((m.head && m.head.label) || '对战');
      $('wt-title').textContent = W.name + ' vs ' + ((m.head && m.head.foe) || '对手');
      W.viewers = m.names || []; wtViewers();
      $('wt-log').innerHTML = ''; wtLog(m.log || []);
      $('wt-end').hidden = true;
      if (m.snap) wtSnap(m.snap); else $('wt-wait').textContent = '对战刚开始，等待画面……';
      return;
    }
    if (m.op === 'f') { if (m.log && m.log.length) wtLog(m.log); if (m.snap) wtSnap(m.snap); wtFx(m.fx); return; }
    if (m.op === 'viewers') { W.viewers = m.names || []; wtViewers(); return; }
    if (m.op === 'dm') { bulletShow(m.name, m.text, m.e); return; }
    if (m.op === 'end') {
      W.over = true;
      $('wt-end-t').textContent = '对战结束';
      $('wt-end-s').textContent = W.name + '：' + (m.title || '') + (m.sub ? ' · ' + you(m.sub) : '');
      $('wt-end').hidden = false;
    }
  }
  // 两名玩家对战时，有一方向全服发了观战邀请
  function watchInvite(m) {
    if (!A.ready() || A.inBattle() || st.match || st.watch) return;
    var old = document.querySelector('.bw-pop.wt-pop'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'bw-pop wt-pop'; el.setAttribute('role', 'status');
    el.innerHTML = '<b>👁 观战邀请</b><span>' + esc(m.name) + ' 和 ' + esc(m.peerName) + ' 正在' + esc(m.label || '对战') + '，邀请大家来观战</span>' +
      '<div class="bw-pop-btns"><button type="button" class="btn ghost" data-wno="1">忽略</button><button type="button" class="btn primary" data-wyes="1">去观战</button></div>';
    document.body.appendChild(el);
    var t = setTimeout(function () { el.remove(); }, 45000);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-wno]')) { clearTimeout(t); el.remove(); return; }
      if (e.target.closest('[data-wyes]')) { clearTimeout(t); el.remove(); watchStart(m.user); }
    });
  }

  /* ---------- 私信（服务器见 server/dm.js）----------
   * 好友的玩家行和名片上有「💬 私信」按钮，打开右下角的聊天窗口（每条带时间）。
   * 收到私信：聊天窗口开着就直接显示，没开就在右上角弹出提示，点「回复」打开窗口。社交里的「私信」页列出所有对话和未读数。 */
  st.dmList = null; st.dmUnread = 0; st.dm = null;
  function dmUnreadOf(user) { var c = (st.dmList || []).filter(function (x) { return x.peer === user; })[0]; return c ? c.unread : 0; }
  function dmTime(t) {
    var d = new Date(t), now = new Date(), hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (d.toDateString() === now.toDateString()) return hm;
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return '昨天 ' + hm;
    return (d.getFullYear() !== now.getFullYear() ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }
  function dmLoadList(notify) {
    if (!online) return;
    api('GET', '/api/dm-list').then(function (r) {
      if (r._code !== 200) return;
      var before = st.dmUnread; st.dmList = r.convs; st.dmUnread = r.unread;
      if (A.page() === 'social' && st.tab !== 'mine') render();
      if (notify && r.unread > 0 && !before) dmPop({ unreadAll: r.unread });
    }).catch(function () {});
  }
  function dmListHTML() {
    var L = st.dmList;
    if (!L) return '<p class="hint soc-load">读取私信中……</p>';
    if (!L.length) return '<div class="soc-empty"><p>还没有私信。在「好友」里点对方的「💬 私信」就能开始聊天（要先把对方加为好友）。</p></div>';
    return '<div class="plist dm-list">' + L.map(function (c) {
      return '<button type="button" class="dm-row' + (c.unread ? ' unread' : '') + '" data-dm="' + esc(c.peer) + '"><span class="pav' + (c.avatar ? ' img' : '') + '">' + A.avatarInner(c.avatar, c.name) + '</span>' +
        '<span class="dm-r-txt"><b>' + esc(c.name) + '</b><small>' + (c.lastFrom === c.peer ? '' : '我：') + (emoteMsg(c.last) ? '[表情] ' + esc(emoteMsg(c.last).n) : esc(c.last.slice(0, 60))) + '</small></span><span class="dm-r-side"><small>' + dmTime(c.lastT) + '</small>' + (c.unread ? '<i class="q-badge">' + c.unread + '</i>' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  function dmOpen(user) {
    if (!online) { A.toast('私信需要联网'); return; }
    var old = document.querySelector('.dm-win'); if (old) old.remove();
    var p = (st.players || []).filter(function (x) { return x.user === user; })[0];
    st.dm = { user: user, msgs: [], name: p && p.name || user };
    var w = document.createElement('div'); w.className = 'dm-win'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', '私信');
    w.innerHTML = '<div class="dm-head"><span class="pav" id="dm-av">' + esc(Array.from(st.dm.name)[0] || '?') + '</span><div><b id="dm-name">' + esc(st.dm.name) + '</b><small id="dm-st">@' + esc(user) + '</small></div><button type="button" class="dm-x" data-dmx="1" aria-label="关闭">×</button></div>' +
      '<div class="dm-body" id="dm-body"><p class="hint dm-empty">读取中……</p></div>' +
      '<div class="dm-emotes" id="dm-emotes" hidden>' + EMOTES.map(function (x) { return '<button type="button" data-dme="' + x.id + '" title="' + esc(x.n) + '"><img src="' + x.img + '" alt="' + esc(x.n) + '"></button>'; }).join('') + '</div>' +
      '<div class="dm-foot"><button type="button" class="dm-emo-btn" id="dm-emo" title="表情" aria-label="表情">😀</button><textarea id="dm-text" rows="2" maxlength="300" placeholder="说点什么……（回车发送，Shift+回车换行）"></textarea><button type="button" class="btn primary" id="dm-send">发送</button></div>';
    document.body.appendChild(w);
    var ta = w.querySelector('#dm-text');
    w.addEventListener('click', function (e) {
      if (e.target.closest('[data-dmx]')) { w.remove(); st.dm = null; return; }
      if (e.target.id === 'dm-send') { dmSend(); return; }
      if (e.target.closest('#dm-emo')) { var pe = $('dm-emotes'); pe.hidden = !pe.hidden; return; }
      var em = e.target.closest('[data-dme]'); if (em) { $('dm-emotes').hidden = true; dmSend('[[e:' + em.dataset.dme + ']]'); }
    });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); dmSend(); } });
    api('GET', '/api/dm?with=' + encodeURIComponent(user)).then(function (r) {
      if (!st.dm || st.dm.user !== user) return;
      if (r._code !== 200) { $('dm-body').innerHTML = '<p class="hint dm-empty">' + esc(r.error || '读取失败') + '</p>'; return; }
      st.dm.msgs = r.msgs; st.dm.me = r.me; st.dm.name = r.name; st.dm.canSend = r.canSend;
      $('dm-name').textContent = r.name; $('dm-st').innerHTML = '@' + esc(user) + ' · ' + (r.online ? '<span class="dot on"></span>在线' : '离线');
      var av = $('dm-av'); av.innerHTML = A.avatarInner(r.avatar, r.name); av.classList.toggle('img', !!r.avatar);
      if (!r.canSend) { ta.disabled = true; ta.placeholder = '先把对方加为好友，才能发私信'; }
      dmDraw(); ta.focus();
      (st.dmList || []).forEach(function (c) { if (c.peer === user) { st.dmUnread -= c.unread; c.unread = 0; } });
      if (A.page() === 'social') render();
    }).catch(function () { var b = $('dm-body'); if (b) b.innerHTML = '<p class="hint dm-empty">连不上服务器</p>'; });
  }
  function dmDraw() {
    var D = st.dm, b = $('dm-body'); if (!D || !b) return;
    if (!D.msgs.length) { b.innerHTML = '<p class="hint dm-empty">还没有聊过天，打个招呼吧。</p>'; return; }
    var prev = 0;
    b.innerHTML = D.msgs.map(function (m) {
      var mine = m.f === D.me, gap = m.t - prev > 5 * 60000; prev = m.t;
      var em = emoteMsg(m.x);
      return (gap ? '<p class="dm-time">' + dmTime(m.t) + '</p>' : '') + '<div class="dm-msg' + (mine ? ' me' : '') + (em ? ' emote' : '') + '" title="' + dmTime(m.t) + '">' + (em ? '<img src="' + em.img + '" alt="' + esc(em.n) + '">' : '<p>' + esc(m.x) + '</p>') + '<small>' + dmTime(m.t).replace(/^.* /, '') + '</small></div>';
    }).join('');
    b.scrollTop = b.scrollHeight;
  }
  function dmSend(raw) {
    var D = st.dm, ta = $('dm-text'); if (!D || !ta || ta.disabled) return;
    var text = raw || ta.value.trim(); if (!text) return;
    ta.disabled = true;
    api('POST', '/api/dm', { to: D.user, text: text }).then(function (r) {
      ta.disabled = false; ta.focus();
      if (r._code !== 200) { A.toast(r.error || '发送失败'); return; }
      if (!raw) ta.value = '';
      if (st.dm === D && !D.msgs.some(function (x) { return x.t === r.msg.t && x.f === r.msg.f; })) { D.msgs.push(r.msg); dmDraw(); }
    }).catch(function () { ta.disabled = false; A.toast('连不上服务器'); });
  }
  function dmEcho(m) {   // 自己在别的设备上发的
    var D = st.dm; if (!D || D.user !== m.to || D.msgs.some(function (x) { return x.t === m.t && x.f === D.me; })) return;
    D.msgs.push({ f: D.me, t: m.t, x: m.text }); dmDraw();
  }
  function dmGot(m) {
    var D = st.dm;
    if (D && D.user === m.from && document.querySelector('.dm-win')) {
      D.msgs.push({ f: m.from, t: m.t, x: m.text }); dmDraw();
      api('GET', '/api/dm?with=' + encodeURIComponent(m.from)).catch(function () {});   // 标记已读
      return;
    }
    var c = (st.dmList || []).filter(function (x) { return x.peer === m.from; })[0];
    if (c) { c.unread++; c.last = m.text; c.lastFrom = m.from; c.lastT = m.t; } else { if (!st.dmList) st.dmList = []; st.dmList.unshift({ peer: m.from, name: m.fromName, avatar: m.avatar, last: m.text, lastFrom: m.from, lastT: m.t, unread: 1 }); }
    st.dmUnread++;
    if (A.page() === 'social' && st.tab !== 'mine') render();
    dmPop(m);
  }
  // 右上角的私信提示
  function dmPop(m) {
    var old = document.querySelector('.dm-pop'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'dm-pop'; el.setAttribute('role', 'status');
    el.innerHTML = m.unreadAll ? '<b>💬 私信</b><span>你有 ' + m.unreadAll + ' 条未读私信</span><div class="bw-pop-btns"><button type="button" class="btn ghost" data-dpx="1">稍后</button><button type="button" class="btn primary" data-dplist="1">查看</button></div>'
      : '<div class="dm-pop-h"><span class="pav' + (m.avatar ? ' img' : '') + '">' + A.avatarInner(m.avatar, m.fromName) + '</span><b>' + esc(m.fromName) + '</b><small>' + dmTime(m.t) + '</small></div><p class="dm-pop-t">' + (emoteMsg(m.text) ? '<img class="dm-pop-e" src="' + emoteMsg(m.text).img + '" alt="">' : esc(m.text.slice(0, 120))) + '</p>' +
        '<div class="bw-pop-btns"><button type="button" class="btn ghost" data-dpx="1">忽略</button><button type="button" class="btn primary" data-dpr="' + esc(m.from) + '">回复</button></div>';
    document.body.appendChild(el);
    var tm = setTimeout(function () { el.remove(); }, 20000);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-dpx]')) { clearTimeout(tm); el.remove(); return; }
      var r = e.target.closest('[data-dpr]'); if (r) { clearTimeout(tm); el.remove(); dmOpen(r.dataset.dpr); return; }
      if (e.target.closest('[data-dplist]')) { clearTimeout(tm); el.remove(); st.tab = 'dm'; if (A.page() !== 'social' && !A.inBattle()) A.go('social'); else render(); dmLoadList(); }
    });
  }

  /* ---------- 基地信息栏与留言板（服务器见 server/homelog.js） ----------
   * 自己的基地：「基地动态」（谁什么时候来过、摸了哪只精灵、挑战了几场）+「留言板」
   * 别人的基地：只有留言板。同一位访客 30 分钟内的动作合并成一条动态（服务器合并）。
   * 主人在线时，有人来访 / 摸摸 / 挑战 / 留言会收到提示；不在线时，下次登录提示有几条新动态。 */
  function meUser() { return st.me || (C && C.user && C.user()); }
  function hbLoad(owner, force) {
    if (!online || !owner) return;
    if (hb.owner !== owner) { hb.owner = owner; hb.data = null; hb.err = ''; hb.draft = ''; }
    else if (!force && hb.data && Date.now() - hb.at < 15000) return;
    hb.at = Date.now();
    api('GET', '/api/home-log?user=' + encodeURIComponent(owner)).then(function (r) {
      if (hb.owner !== owner) return;
      if (r._code !== 200) hb.err = r.error || '读取失败';
      else { hb.data = r; hb.err = ''; if (r.mine && hb.newN) { hb.newN = 0; if (A.page() === 'social' && !st.view) render(); } }
      hbDraw();
    }).catch(function () { if (hb.owner === owner) { hb.err = '连不上服务器'; hbDraw(); } });
  }
  function hbClock(t) {
    var d = new Date(t), n = new Date(), hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return d.toDateString() === n.toDateString() ? '今天 ' + hm : (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + hm;
  }
  function hbAv(x) { return '<span class="pav' + (x.avatar ? ' img' : '') + '">' + A.avatarInner(x.avatar, x.name || x.user) + '</span>'; }
  function hbEv(e, seen) {
    var pk = Object.keys(e.poke || {}), F = e.fights || [], c = { win: 0, lose: 0, draw: 0, quit: 0 }, acts = [];
    F.forEach(function (f) { c[f.r] = (c[f.r] || 0) + 1; });
    if (pk.length) acts.push('摸了摸 ' + pk.map(function (n) { return esc(n) + (e.poke[n] > 1 ? ' ×' + e.poke[n] : ''); }).join('、'));
    var SL = e.steal || [];
    if (SL.length) acts.push('偷走了 ' + SL.map(function (x) { var v = x.sid ? A.view({ sid: x.sid, lv: x.lv || 1 }) : null; return esc(v ? v.name : '精灵') + ' 的 ' + A.fmt(x.n || 0) + ' 经验'; }).join('、'));
    if (F.length) acts.push('挑战了基地 ' + F.length + ' 场（' + [c.win ? '对方赢 ' + c.win + ' 场' : '', c.lose ? '你的精灵守住 ' + c.lose + ' 场' : '', c.draw ? '平局 ' + c.draw + ' 场' : '', c.quit ? '对方认输 ' + c.quit + ' 场' : ''].filter(Boolean).join('，') + '）');
    return '<li class="hb-ev' + (e.t2 > seen ? ' new' : '') + '">' + hbAv(e) + '<div><p class="hb-what"><b>' + esc(e.name || e.user) + '</b> 来访' + (acts.length ? '，' + acts.join('；') : '') + '</p>' +
      '<small>' + hbClock(e.t) + (e.t2 - e.t > 60000 ? ' ~ ' + hbClock(e.t2).replace(/^今天 /, '') : '') + ' · ' + ago(e.t2) + ' · <button type="button" class="linkbtn" data-hbcard="' + esc(e.user) + '">看名片</button></small></div></li>';
  }
  function hbMsg(m, d) {
    var canDel = m.mine || d.mine;
    return '<li class="hb-msg' + (m.owner ? ' owner' : '') + '">' + hbAv(m) + '<div><p class="hb-who"><b>' + esc(m.name || m.user) + '</b>' + (m.owner ? '<span class="chip">主人</span>' : '') +
      '<small>' + hbClock(m.t) + '</small>' + (m.owner ? '' : '<button type="button" class="linkbtn" data-hbcard="' + esc(m.user) + '">名片</button>') + (canDel ? '<button type="button" class="linkbtn red" data-hbdel="' + esc(m.id) + '">删除</button>' : '') + '</p>' +
      '<p class="hb-text">' + esc(m.text) + '</p></div></li>';
  }
  function hbInner(kind) {
    var d = hb.data;
    if (!d) return '<div class="hb-col"><p class="hint">' + (hb.err ? esc(hb.err) : '正在读取基地动态……') + '</p></div>';
    var html = '';
    if (d.mine && kind !== 'msg') {
      var seen = (d.seen && d.seen.log) || 0, nNew = d.logs.filter(function (e) { return e.t2 > seen; }).length;
      html += '<div class="hb-col"><h4>基地动态 <span class="hint">' + (nNew ? nNew + ' 条新动态' : '谁来过、做了什么') + '</span></h4>' +
        (d.logs.length ? '<ul class="hb-list">' + d.logs.map(function (e) { return hbEv(e, seen); }).join('') + '</ul>' : '<p class="hb-empty">还没有船员来过你的基地。好友在社交页点「基地」就能来拜访。</p>') + '</div>';
    }
    if (kind === 'log') return html;
    var n = Array.from(hb.draft).length;
    html += '<div class="hb-col"><h4>留言板 <span class="hint">' + (d.mine ? '来访的船员给你的留言，你也可以写' : '给基地主人留句话') + '</span></h4>' +
      '<form class="hb-form" onsubmit="return false"><textarea id="hb-text" rows="2" maxlength="200" placeholder="' + (d.mine ? '写点什么，来访的船员都能看到' : '比如：你的小月亮好可爱！') + '">' + esc(hb.draft) + '</textarea>' +
      '<div class="hb-form-row"><span class="hint" id="hb-cnt">' + n + ' / 200</span><button type="button" class="btn primary" data-hbsend="1"' + (n ? '' : ' disabled') + '>留言</button></div></form>' +
      (d.msgs.length ? '<ul class="hb-list">' + d.msgs.map(function (m) { return hbMsg(m, d); }).join('') + '</ul>' : '<p class="hb-empty">还没有留言。</p>') + '</div>';
    return html;
  }
  function hbDraw() {
    var el = $('hboard'); if (!el || el.dataset.owner !== hb.owner) return;
    var foc = document.activeElement && document.activeElement.id === 'hb-text' ? $('hb-text').selectionStart : null;
    el.innerHTML = hbInner(el.dataset.kind);
    if (foc != null && $('hb-text')) { $('hb-text').focus(); $('hb-text').setSelectionRange(foc, foc); }
  }
  // 基地页面里放这一块：返回 HTML，同时去服务器读最新的
  function hbSlot(owner, kind) {
    if (!online || !owner) return '';
    setTimeout(function () { hbLoad(owner); }, 0);
    if (hb.owner !== owner) { hb.owner = owner; hb.data = null; hb.err = ''; hb.draft = ''; hb.at = 0; }
    return '<section class="hboard' + (kind ? ' one' : '') + '" id="hboard" data-owner="' + esc(owner) + '"' + (kind ? ' data-kind="' + kind + '"' : '') + ' aria-label="基地信息栏与留言板">' + hbInner(kind) + '</section>';
  }
  function hbSend() {
    var text = hb.draft.trim(), owner = hb.owner; if (!text || !owner) return;
    var b = document.querySelector('[data-hbsend]'); if (b) b.disabled = true;
    api('POST', '/api/home-msg', { owner: owner, text: text }).then(function (r) {
      if (r._code !== 200) { A.toast(r.error || '留言失败'); if (b) b.disabled = false; return; }
      hb.draft = ''; hbLoad(owner, true);
    }).catch(function () { A.toast('连不上服务器，留言没有发出去'); if (b) b.disabled = false; });
  }
  function hbDel(id) {
    var owner = hb.owner;
    api('POST', '/api/home-msg-del', { owner: owner, id: id }).then(function (r) {
      if (r._code !== 200) A.toast(r.error || '删除失败'); hbLoad(owner, true);
    }).catch(function () { A.toast('连不上服务器'); });
  }
  // 访客的动作记进主人的基地动态
  function hbEvent(owner, obj) { if (online && owner && owner !== meUser()) api('POST', '/api/home-ev', Object.assign({ owner: owner }, obj)).catch(function () {}); }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#hboard')) return;
    var t;
    if ((t = e.target.closest('[data-hbsend]'))) { if (!t.disabled) hbSend(); return; }
    if ((t = e.target.closest('[data-hbdel]'))) {
      if (t.dataset.armed) hbDel(t.dataset.hbdel);
      else { t.dataset.armed = '1'; t.textContent = '确认删除'; setTimeout(function () { if (t.isConnected) { delete t.dataset.armed; t.textContent = '删除'; } }, 3000); }
      return;
    }
    if ((t = e.target.closest('[data-hbcard]'))) { openCard(t.dataset.hbcard); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'hb-text') return;
    hb.draft = Array.from(e.target.value).slice(0, 200).join('');
    var n = Array.from(hb.draft).length; if ($('hb-cnt')) $('hb-cnt').textContent = n + ' / 200';
    var b = document.querySelector('[data-hbsend]'); if (b) b.disabled = !hb.draft.trim();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'hb-text' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); hbSend(); }
  });
  // 服务器推来的基地动态（主人在线时）
  function homeEv(m) {
    var txt = m.kind === 'visit' ? m.name + ' 来拜访了你的基地' :
      m.kind === 'poke' ? m.name + ' 在你的基地里摸了摸' + (m.mon || '精灵') :
      m.kind === 'fight' ? m.name + ' 挑战了你的基地' + ({ win: '，赢了', lose: '，你的精灵守住了', draw: '，打成平局', quit: '，中途认输了' }[m.r] || '') :
      m.kind === 'msg' ? m.name + ' 在你的基地留言：' + (m.text || '') :
      m.kind === 'steal' ? m.name + ' 从你基地的' + (m.sid ? A.view({ sid: m.sid, lv: m.lv || 1 }).name : '精灵') + '那里偷走了 ' + A.fmt(m.n || 0) + ' 经验' : '';
    if (!txt) return;
    if (m.kind === 'steal' && A.homeStolen) A.homeStolen(m.u, m.user, m.n);   // 本机的基地记录也跟着扣下（服务器那份已经扣了）
    var me = meUser();
    if ($('hboard') && hb.owner === me) hbLoad(me, true);
    else { hb.newN++; if (A.page() === 'social' && !st.view && st.tab !== 'mine') render(); }
    if (!A.inBattle || !A.inBattle()) A.toast('基地：' + txt);
  }
  // 登录后看看不在线时有没有人来过
  function hbPeek() {
    var me = meUser(); if (!online || !me || !A.homeOpen || !A.homeOpen()) return;
    api('GET', '/api/home-log?user=' + encodeURIComponent(me) + '&peek=1').then(function (r) {
      if (r._code !== 200) return;
      var n = (r.newLog || 0) + (r.newMsg || 0); hb.newN = n;
      if (n) {
        if (A.page() === 'social' && !st.view) render();
        setTimeout(function () { A.toast('你不在的时候，基地里有 ' + (r.newLog ? r.newLog + ' 条新动态' : '') + (r.newLog && r.newMsg ? '、' : '') + (r.newMsg ? r.newMsg + ' 条新留言' : '') + '。去「我的基地」看看吧。'); }, 4000);
      }
    }).catch(function () {});
  }

  function farmLogInner() {
    if (fl.err) return '<p class="hint">' + esc(fl.err) + '</p><button type="button" class="btn" data-farmlogrefresh="1">重试</button>';
    if (!fl.data) return '<p class="hint">正在读取种植园动态……</p>';
    var logs = fl.data.logs || [];
    return '<div class="soc-foot"><button type="button" class="btn ghost" data-farmlogrefresh="1">刷新动态</button></div>' + (logs.length ? '<ul class="hb-list">' + logs.map(function (e) {
      var what = e.kind === 'visit' ? '来访了种植园' : e.kind === 'steal' ? '从田 ' + (e.i + 1) + ' 偷走「' + A.itemName(e.crop) + '」×' + e.n : e.kind === 'plant' ? '在田 ' + (e.i + 1) + ' 种下「' + A.itemName(e.seed) + '」' : '从田 ' + (e.i + 1) + ' 收获「' + A.itemName(e.crop) + '」×' + e.n + (e.stolen ? '（本轮被偷走 ' + e.stolen + '）' : '');
      return '<li class="hb-ev' + (e.user !== meUser() && e.t > (fl.data.seen || 0) ? ' new' : '') + '">' + hbAv(e) + '<div><p><b>' + esc(e.name || e.user) + '</b> ' + esc(what) + '</p><small>' + hbClock(e.t) + '</small></div></li>';
    }).join('') + '</ul>' : '<p class="hint">还没有种植园动态。</p>');
  }
  function farmLogDraw() { var e = $('farm-board'); if (e) e.innerHTML = farmLogInner(); }
  function farmLogLoad(force) {
    if (!online) return;
    if (fl.loading) { if (force) fl.again = true; return; }
    if (!force && fl.data && Date.now() - fl.at < 15000) return;
    fl.loading = true;
    api('GET', '/api/farm-log').then(function (r) {
      fl.loading = false; fl.at = Date.now();
      if (r._code === 200) { fl.data = r; fl.err = ''; fl.newN = 0; } else fl.err = r.error || '读取失败';
      farmLogDraw(); if (A.farmRefresh) A.farmRefresh();
      if (fl.again) { fl.again = false; farmLogLoad(true); }
    }).catch(function () { fl.loading = false; fl.err = '连不上服务器'; farmLogDraw(); });
  }
  function farmBoard() {
    if (!online) return '<p class="hint">联网登录后可查看种植园动态。</p>';
    setTimeout(function () { farmLogLoad(true); }, 0);
    return '<div id="farm-board">' + farmLogInner() + '</div>';
  }
  function farmEv(m) {
    if (m.kind === 'steal' && A.farmStolen) A.farmStolen(m);
    fl.at = 0;
    if (m.user !== meUser()) fl.newN++;
    if ($('farm-board')) farmLogLoad(true);
    else if (A.farmRefresh) A.farmRefresh();
    if (m.user !== meUser() && !A.inBattle()) A.toast('种植园：' + m.name + (m.kind === 'steal' ? ' 从田 ' + (m.i + 1) + ' 偷走「' + A.itemName(m.crop) + '」×' + m.n : ' 来拜访了你的种植园'));
  }
  function farmPeek() {
    if (!online || !A.farmOpen || !A.farmOpen()) return;
    api('GET', '/api/farm-log?peek=1').then(function (r) { if (r._code !== 200) return; fl.newN = r.newLog || 0; if (A.farmRefresh) A.farmRefresh(); if (fl.newN) A.toast('种植园有 ' + fl.newN + ' 条新动态，点「种植园动态」查看。'); }).catch(function () {});
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-farmlogrefresh]')) { fl.err = ''; farmLogLoad(true); } });

  window.HSBRAWL = { render: renderBrawl };
  window.HSSOCIAL = { render: function () { if (!st.players) load(); render(); },
    // 正在拜访的基地的主人选的基地音乐（game.js 选界面音乐时用）
    visitBgm: function () { var d = st.view && st.view.data; return d && d.open && !d.noChar ? d.bgm || 'base' : null; },
    // 基地信息栏与留言板（game.js 的「我的基地」页面调用，不传参数就是自己的基地）
    homeBoard: function (owner, kind) { return hbSlot(owner || meUser(), kind); },
    homeNew: function () { return hb.newN || 0; }, friendBases: friendBases, friendFarms: function () { return friendBases('farm'); }, online: function () { return !!online; },
    farmBoard: farmBoard, farmNew: function () { return fl.newN; },
    estatePending: function () { return A.page() === 'social' && !!st.view && !st.view.data && !st.view.err; },
    // 做题大王争霸赛：约对手对战、观看直播、看回放
    ctAsk: ctAsk, ctRematch: ctRematch, watch: function (user) { watchStart(user); }, replay: replayStart, wsOk: function () { return !!st.wsOk; } };
  if (A.homeRefresh) A.homeRefresh();   // 如果已经停在自己的基地页面，补上信息栏
  connect();
  if (A.page() === 'social') window.HSSOCIAL.render();
  renderBrawl();
})();
