/* 活动首页、每日礼物与分页杂货铺；场景和首页共用同一套入口 */
var HSCHRISTMAS = (function () {
  'use strict';
  var shopPage = 0, busy = false, storyBusy = false, SIZE = 4;
  function esc(s) { return HSUI.esc(String(s)); }
  function icon(k) { return HSUI.itemIcon(k); }
  function wallet(a) { var i = a.items || {}; return '<div class="xmas-wallet"><span>' + icon('xmasBell') + '圣诞铃铛 <b>' + (i.xmasBell || 0) + '</b></span><span>' + icon('xmasCandy') + '拐杖糖 <b>' + (i.xmasCandy || 0) + '</b></span></div>'; }
  function reward(bell, candy) { return '<span class="xmas-rewards">' + icon('xmasBell') + '×' + bell + '　' + icon('xmasCandy') + '×' + candy + '</span>'; }
  function title(panel) { return panel === 'gifts' ? 'Vanber的圣诞礼物' : panel === 'shop' ? 'Threego的苏格兰杂货铺' : '圣诞'; }
  function npc(panel) { var v = panel === 'gifts'; return '<div class="xmas-host"><img src="' + CHARS[v ? 'vanber_christmas' : 'threego_christmas'] + '" alt="戴圣诞帽的' + (v ? 'Vanber' : 'Threego') + '"><p>' + (v ? '「帮我完成这些小任务，就送你圣诞礼物！」' : '「欢迎光临！带铃铛和拐杖糖来看看吧！」') + '</p><button class="btn ghost" data-xmas-scene="' + (v ? 1 : 2) + '">' + (v ? '前往秘密小屋' : '前往杂货铺') + '</button></div>'; }
  function render(el, a, panel, open) {
    if (!open) panel = 'home';
    var header = '<div class="page-head"><h2 class="sec">' + title(panel) + '</h2>' + (panel === 'home' ? '<span class="hint">一场意外带来的冬日旅程</span>' : '<button class="btn ghost" data-xmas-open="home">‹ 圣诞活动</button>') + '</div>';
    if (panel === 'home') {
      var cards = [
        ['helena', '海伦娜星', '雪夜城堡、秘密小屋与杂货铺', 'images/planets/helena_v2.png'],
        ['gifts', 'Vanber的圣诞礼物', '完成每日小任务，领取圣诞礼物', CHARS.vanber_christmas],
        ['shop', 'Threego的苏格兰杂货铺', '用圣诞铃铛与拐杖糖兑换道具', CHARS.threego_christmas]
      ];
      el.innerHTML = header + wallet(a) + '<section class="xmas-cards">' + cards.map(function (c) { var allowed = open && (c[0] === 'helena' || CHRISTMAS.sceneOpen(a, c[0] === 'gifts' ? 1 : 2)); return '<button type="button" class="xmas-card" ' + (c[0] === 'helena' ? 'data-helena' : 'data-xmas-open="' + c[0] + '"') + (allowed ? '' : ' disabled') + '><span class="tape l"></span><img src="' + c[3] + '" alt=""><span><b>' + c[1] + '</b><small>' + c[2] + '</small><em>' + (allowed ? '前往 ›' : !open ? '完成地球主线后解锁' : c[0] === 'gifts' ? '先带上巴洛，敲开城堡大门' : '先完成Vanber的一项任务') + '</em></span></button>'; }).join('') + '</section><p class="xmas-coming hint">更多圣诞活动待补充</p>';
      return;
    }
    setTimeout(function () { if (!el.hidden) maybeStory(panel); }, 100);
    if (panel === 'gifts') {
      var r = CHRISTMAS.read(a, Date.now()), all = CHRISTMAS.TASKS.every(function (t) { return (r.progress[t.id] || 0) >= t.n; });
      el.innerHTML = header + wallet(a) + npc(panel) + '<div class="xmas-scroll xmas-task-list">' + CHRISTMAS.TASKS.map(function (t) {
        var p = Math.min(t.n, r.progress[t.id] || 0), claimed = r.claimed[t.id];
        return '<article class="xmas-task"><div><b>' + t.t + '</b><small>' + p + ' / ' + t.n + '</small><progress value="' + p + '" max="' + t.n + '"></progress>' + reward(t.bell, t.candy) + '</div><button class="btn' + (p >= t.n && !claimed ? ' primary' : '') + '" data-xmas-claim="' + t.id + '"' + (claimed || p < t.n || busy ? ' disabled' : '') + '>' + (claimed ? '已领取' : p >= t.n ? '领取' : '未完成') + '</button></article>';
      }).join('') + '</div><div class="xmas-all"><span><b>全部完成大礼包</b>' + reward(CHRISTMAS.ALL.bell, CHRISTMAS.ALL.candy) + '</span><button class="btn primary" data-xmas-all' + (r.all || !all || busy ? ' disabled' : '') + '>' + (r.all ? '已领取' : '领取礼包') + '</button></div><p class="hint xmas-reset">每日零点（北京时间）刷新</p>';
      return;
    }
    var pages = Math.ceil(CHRISTMAS.SHOP.length / SIZE); shopPage = Math.max(0, Math.min(shopPage, pages - 1));
    el.innerHTML = header + wallet(a) + npc(panel) + '<div class="xmas-scroll xmas-shop-grid">' + CHRISTMAS.SHOP.slice(shopPage * SIZE, (shopPage + 1) * SIZE).map(function (s) {
      var max = Math.min(999, Math.floor(((a.items || {})[s.coin] || 0) / s.price));
      return '<article class="xmas-good" data-xmas-good="' + s.id + '"><div class="xmas-good-title">' + icon(s.k) + '<b>' + esc(HSACC.itemName(s.k)) + '</b></div><span class="xmas-price">' + icon(s.coin) + s.price + ' / 个</span><small>持有 ' + ((a.items || {})[s.k] || 0) + '</small><div class="xmas-buy"><input type="number" inputmode="numeric" min="1" max="999" step="1" value="1" aria-label="' + esc(HSACC.itemName(s.k)) + '兑换数量"><button class="btn primary" data-xmas-buy="' + s.id + '"' + (max < 1 || busy ? ' disabled' : '') + '>兑换</button></div></article>';
    }).join('') + '</div><div class="xmas-pages"><button class="btn" data-xmas-page="-1"' + (!shopPage || busy ? ' disabled' : '') + '>‹ 上一页</button><span>' + (shopPage + 1) + ' / ' + pages + '</span><button class="btn" data-xmas-page="1"' + (shopPage >= pages - 1 || busy ? ' disabled' : '') + '>下一页 ›</button></div>';
  }
  function storyDialog(lines, action, after) {
    if (storyBusy || document.getElementById('xmas-story')) return;
    storyBusy = true;
    var d = document.createElement('div'), at = 0; d.className = 'soc-dlg'; d.id = 'xmas-story'; document.body.appendChild(d);
    function draw() {
      var l = lines[at];
      d.innerHTML = '<div class="soc-box xmas-story-box' + (l.img ? ' has-art' : '') + '" role="dialog" aria-modal="true" aria-label="圣诞活动剧情"><span class="tape l"></span>' + (l.img ? '<img class="xmas-story-art" src="' + CHARS[l.img] + '" alt="">' : '') + '<div class="xmas-story-text"><b>' + esc(l.n) + '</b><p>' + esc(l.t) + '</p><small class="hint" data-xmas-story-error></small></div><div class="soc-foot">' + (l.choices ? l.choices.map(function (q) { return '<button class="btn" data-xmas-next>' + q + '</button>'; }).join('') : '<button class="btn primary" data-xmas-next>' + (at < lines.length - 1 ? '继续' : '知道了') + '</button>') + '</div></div>';
      d.querySelector('[data-xmas-next]').focus();
    }
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-xmas-next]'); if (!b || b.disabled) return;
      if (at < lines.length - 1) { at++; draw(); return; }
      b.disabled = true;
      function done() { d.remove(); storyBusy = false; if (after) after(); }
      if (!action) { done(); return; }
      HSACC.christmasTx({ a: action }, done, function (err) { b.disabled = false; d.querySelector('[data-xmas-story-error]').textContent = err || '网络不稳，请重试'; });
    }); draw();
  }
  function cabinStory() {
    storyDialog([
      { n: '熟悉的声音', t: '好吧，看起来巴洛很愿意听你的话。进来吧。' },
      { n: '你', t: '城堡大门缓缓打开。门后的人戴着圣诞帽——居然是Vanber。' },
      { n: 'Vanber', img: 'vanber_christmas', t: '欢迎！圣诞老人正在准备礼物呢，你来得正好。' },
      { n: '你', t: 'Vanber？你怎么跑到这里来了？', choices: ['你明明就是Vanber', 'Vanber，别逗我了'] },
      { n: 'Vanber', img: 'vanber_christmas', t: '都说啦，我是圣诞老人！我还忙着准备礼物呢，不能在这里闲聊一整天。' },
      { n: '你', t: '无论怎么说，他都认定自己是圣诞老人。可这副说话的样子，分明就是Vanber本人。' },
      { n: 'Vanber', img: 'vanber_christmas', t: '先帮我完成一项小任务吧。我给你准备了礼物，可不能白白拿走哦。' }
    ], 'cabinIntro', function () { HSACC.goHelena(1); });
  }
  function shopHint() {
    storyDialog([
      { n: 'Vanber', img: 'vanber_christmas', t: '做得不错！圣诞老人说话算话，礼物收好了。' },
      { n: 'Vanber', img: 'vanber_christmas', t: '里面还有个家伙，特别爱收集拐杖糖。你可以去杂货铺看看。' },
      { n: '你', t: '这里面还住着别人？' },
      { n: 'Vanber', img: 'vanber_christmas', t: '自己去看看不就知道了。记得带上糖，别空着手哦。' }
    ], 'shopHint', redraw);
  }
  function shopStory() {
    storyDialog([
      { n: '你', t: '走进杂货铺，货架后面探出一张熟悉的脸。没想到，Threego居然在这里。' },
      { n: 'Threego', img: 'threego_christmas', t: '欢迎来到苏格兰杂货铺！拐杖糖带来了吗？我这里有海伦娜星的各种宝藏！' },
      { n: '你', t: 'Threego？你很喜欢吃糖吗？' },
      { n: 'Threego', img: 'threego_christmas', t: '我是这里的店主！糖也不是给我吃的，是要给那四个人吃。' },
      { n: '你', t: '她说得理所当然，似乎完全没有觉得哪里不对。可你依旧确信，面前的就是Threego本人。' },
      { n: 'Threego', img: 'threego_christmas', t: '好了好了，带糖来换宝藏吧！铃铛我也收，可别把它们弄丢了。' }
    ], 'shopIntro', redraw);
  }
  function maybeStory(panel) {
    if (!window.HSACC || !HSACC.ready() || HSACC.inBattle() || storyBusy) return;
    var a = HSACC.acc(), st = CHRISTMAS.story(a), r = CHRISTMAS.read(a, Date.now());
    if (st.cabinOpen && !st.cabinIntro) { cabinStory(); return; }
    if (panel === 'gifts' && st.cabinIntro && !st.shopOpen && (st.taskDone || r.all || Object.keys(r.claimed).length)) { shopHint(); return; }
    if (panel === 'shop' && st.shopOpen && !st.shopIntro) shopStory();
  }
  function sceneEntered(bg) {
    if (!window.HSACC || HSACC.page() !== 'explore') return;
    if (bg === 'hl_cabin') maybeStory('gifts'); else if (bg === 'hl_shop') maybeStory('shop');
  }
  function redraw() { var el = document.getElementById('pg-christmas'); if (el && !el.hidden) HSACC.go('christmas'); }
  document.addEventListener('click', function (e) {
    var door = e.target.closest('[data-xmas-door]');
    if (door && !busy && !storyBusy) {
      busy = true;
      HSACC.christmasTx({ a: 'door' }, function (r) {
        busy = false;
        if (r.needsBarlow) storyDialog([{ n: '熟悉的声音', t: '想进来？先带一只巴洛到背包里吧。它愿意跟着你、听你的话，才说明你是会好好对待精灵的人。' }, { n: '你', t: '这声音听起来好熟悉……先把巴洛放进出战背包，再来敲门吧。' }], null);
        else if (!CHRISTMAS.story(HSACC.acc()).cabinIntro) cabinStory(); else HSACC.goHelena(1);
      }, function (err) { busy = false; HSACC.toast(err); }); return;
    }
    var home = e.target.closest('[data-helena]'); if (home) { HSACC.goHelena(0); return; }
    var scene = e.target.closest('[data-xmas-scene]'); if (scene) { HSACC.goHelena(+scene.dataset.xmasScene); return; }
    var page = e.target.closest('[data-xmas-page]'); if (page && !page.disabled && !busy) { shopPage += +page.dataset.xmasPage; redraw(); return; }
    var claim = e.target.closest('[data-xmas-claim]'), all = e.target.closest('[data-xmas-all]'), buy = e.target.closest('[data-xmas-buy]');
    var b = claim || all || buy; if (!b || b.disabled || busy) return;
    var args = claim ? { a: 'claim', id: claim.dataset.xmasClaim } : all ? { a: 'all' } : { a: 'buy', id: buy.dataset.xmasBuy, n: Number(buy.closest('[data-xmas-good]').querySelector('input').value) };
    busy = true; b.disabled = true;
    HSACC.christmasTx(args, function (r) { busy = false; HSACC.renderRes(); redraw(); HSACC.toast(r.already ? '已经领取过了' : args.a === 'buy' ? '已兑换' + HSACC.itemName(r.k) + ' ×' + r.n : '获得圣诞铃铛 ×' + r.bell + '、拐杖糖 ×' + r.candy); }, function (err) { busy = false; redraw(); HSACC.toast(err || '暂时无法完成，请重试'); });
  });
  return { render: render, sceneEntered: sceneEntered };
})();
