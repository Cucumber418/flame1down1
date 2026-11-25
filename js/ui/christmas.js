/* 活动首页、每日礼物与分页杂货铺；场景和首页共用同一套入口 */
var HSCHRISTMAS = (function () {
  'use strict';
  var shopPage = 0, busy = false, storyBusy = false, SIZE = 6;
  // 各入口共用星球加载面板；下载并解码后才揭开界面，整段剧情也一起预载
  var imageCache = {};
  function imageReady(src) {
    if (imageCache[src]) return imageCache[src];
    var promise = new Promise(function (resolve, reject) {
      var im = new Image(), timer = setTimeout(function () { finish(false); }, 30000), settled = false;
      function finish(ok) { if (settled) return; settled = true; clearTimeout(timer); im.onload = im.onerror = null; if (ok) resolve(im); else reject(new Error('图片未加载完成')); }
      im.onload = function () { if (im.decode) im.decode().then(function () { finish(true); }, function () { finish(false); }); else finish(true); };
      im.onerror = function () { finish(false); }; im.src = src;
    });
    imageCache[src] = promise;
    promise.catch(function () { if (imageCache[src] === promise) delete imageCache[src]; });
    return promise;
  }
  function images(srcs, step) {
    var list = (srcs || []).filter(function (s,i,a) { return s && a.indexOf(s) === i; }), n = 0;
    return Promise.all(list.map(function (src) { return imageReady(src).then(function () { if (step) step(++n,list.length); }); }));
  }
  function gate(el, message, done, extra, loader) {
    if (!el) return;
    if (el._xmasLoad) el._xmasLoad.cancel();
    var L = loader || LOADER.show(message || '正在加载圣诞活动～', {delay:120}), ticket = {}, failed = null;
    ticket.cancel = function () { L.close(); if (failed) failed.remove(); };
    el._xmasLoad = ticket; el.classList.add('xmas-loading'); el.setAttribute('data-xmas-loading','');
    function current() { return el._xmasLoad === ticket && el.isConnected && !el.hidden; }
    function clear() { if (el._xmasLoad !== ticket) return; delete el._xmasLoad; el.classList.remove('xmas-loading'); el.removeAttribute('data-xmas-loading'); }
    var srcs = (extra || []).concat([].map.call(el.querySelectorAll('img[src]'), function (im) { return im.getAttribute('src'); }));
    L.to(.4);
    images(srcs,function (n,total) { L.set(.4 + .55*n/total); }).then(function () {
      if (!current()) return;
      return Promise.all([].map.call(el.querySelectorAll('img[src]'),function (im) {
        if (im.complete && !im.naturalWidth) im.src = im.getAttribute('src');
        return im.decode ? im.decode() : imageReady(im.getAttribute('src'));
      }));
    }).then(function () {
      if (!current()) { clear(); L.close(); return; }
      L.done(function () { var valid = current(); clear(); if (valid && done) done(); });
    }).catch(function () {
      L.close(); if (!current()) { clear(); return; }
      failed = document.createElement('div'); failed.className = 'soc-dlg'; failed.innerHTML = '<section class="soc-box xmas-load-error" role="alertdialog" aria-modal="true" aria-label="资源加载未完成"><h3>资源还没加载好</h3><p>网络暂时不稳，重试后再进入</p><div class="soc-foot"><button class="btn" data-xmas-load-back>' + (el.classList.contains('page') ? '返回日志' : '返回') + '</button><button class="btn primary" data-xmas-load-retry>重新加载</button></div></section>'; document.body.appendChild(failed);
      failed.addEventListener('click',function (e) {
        if (!current()) { failed.remove(); clear(); return; }
        if (e.target.closest('[data-xmas-load-retry]')) { failed.remove(); failed = null; gate(el,message,done,extra); }
        else if (e.target.closest('[data-xmas-load-back]')) { failed.remove(); clear(); if (el.id === 'xmas-story') storyBusy = false; if (el.id === 'xmas-knight') busy = false; if (el.classList.contains('page')) HSACC.go('log'); else el.remove(); }
      }); failed.querySelector('[data-xmas-load-retry]').focus();
    });
  }
  function esc(s) { return HSUI.esc(String(s)); }
  function icon(k) { return HSUI.itemIcon(k); }
  function wallet(a) { var i = a.items || {}; return '<div class="xmas-wallet">' + [['xmasBell','圣诞铃铛'],['xmasCandy','拐杖糖']].map(function (x) { return '<span>' + icon(x[0]) + x[1] + ' <b>' + (i[x[0]] || 0) + '</b><button type="button" class="xmas-source-arrow" data-xmas-source="' + x[0] + '" aria-label="查看' + x[1] + '获取方式">›</button></span>'; }).join('') + '</div>'; }
  function reward(bell, candy) { return '<span class="xmas-rewards">' + icon('xmasBell') + '×' + bell + '　' + icon('xmasCandy') + '×' + candy + '</span>'; }
  function title(panel) { return panel === 'gifts' ? 'Vanber的圣诞礼物' : panel === 'shop' ? 'Threego的苏格兰杂货铺' : '圣诞'; }
  function npc(panel) {
    var who = panel === 'gifts' ? 'Vanber' : panel === 'shop' ? 'Threego' : 'bttp', key = panel === 'gifts' ? 'vanber_christmas' : panel === 'shop' ? 'threego_christmas' : 'bttp_christmas';
    return '<aside class="xmas-npc-side"><button type="button" class="xmas-npc-portrait" data-xmas-talk="' + panel + '" aria-label="与' + who + '交谈"><img src="' + CHARS[key] + '" alt="' + who + '圣诞立绘"><b>' + who + '</b><small>点击交谈</small></button><button type="button" class="btn ghost xmas-npc-place" ' + (panel === 'knight' ? 'data-xmas-wonder-location' : 'data-xmas-scene="' + (panel === 'gifts' ? 1 : 2) + '"') + '>' + (panel === 'gifts' ? '前往秘密小屋' : panel === 'shop' ? '前往杂货铺' : '前往圣诞仙境') + '</button></aside>';
  }
  var talkAt = {};
  function npcTalk(panel) {
    var lines = panel === 'gifts' ? ['我还忙着准备礼物呢。先帮我完成小任务，礼物可不能白白拿走哦。','圣诞老人说话算话。今天的任务都做好了，别忘记把大礼包也领走。'] : panel === 'shop' ? ['拐杖糖带来了吗？我这里有海伦娜星的各种宝藏！','糖不是给我吃的，是要给那四个人吃。铃铛我也收，可别弄丢了。'] : ['我可是邪恶的鲁普雷希特骑士！想阻止我，就先打败我的召唤精灵。','击败一只又怎样？我的召唤可不会停下，再来一只！'];
    var at = talkAt[panel] || 0; talkAt[panel] = at + 1;
    storyDialog([{ n:panel === 'gifts' ? 'Vanber' : panel === 'shop' ? 'Threego' : 'bttp', img:panel === 'gifts' ? 'vanber_christmas' : panel === 'shop' ? 'threego_christmas' : 'bttp_christmas', t:lines[at % lines.length] }], null, null, panel === 'gifts' ? 'hl_cabin' : panel === 'shop' ? 'hl_shop' : 'hl_wonderland');
  }
  function render(el, a, panel, open) {
    if (!open) panel = 'home';
    var header = '<div class="page-head"><h2 class="sec">' + title(panel) + '</h2>' + (panel === 'home' ? '<span class="hint">一场意外带来的冬日旅程</span>' : '<button class="btn ghost" data-xmas-open="home">‹ 圣诞活动</button>') + '</div>';
    if (panel === 'home') {
      var cards = [
        ['helena', '海伦娜星', '雪夜城堡、秘密小屋与杂货铺', 'images/planets/helena_v2.png'],
        ['gifts', 'Vanber的圣诞礼物', '完成每日小任务，领取圣诞礼物', CHARS.vanber_christmas],
        ['shop', 'Threego的苏格兰杂货铺', '用圣诞铃铛与拐杖糖兑换道具', CHARS.threego_christmas],
        ['knight', '讨伐鲁普雷希特骑士', '挑战召唤精灵，赢取拐杖糖', CHARS.bttp_christmas],
        ['highland', '高地之王', '挑战莫格伦，用高地的认可兑换格伦精元', SPRITES.glen],
        ['rank', '竞技排位S2新赛季', '胜利20拐杖糖，失败或平局10拐杖糖', null]
      ];
      el.innerHTML = header + wallet(a) + '<section class="xmas-cards">' + cards.map(function (c) { var allowed = c[0] === 'highland' ? HIGHLAND.open(a) : c[0] === 'rank' ? HSACC.arenaOpen() : open && (c[0] === 'helena' || (c[0] === 'knight' ? CHRISTMAS.wonderOpen(a) : CHRISTMAS.sceneOpen(a, c[0] === 'gifts' ? 1 : 2))); return '<button type="button" class="xmas-card" ' + (c[0] === 'helena' ? 'data-helena' : c[0] === 'highland' ? 'data-xmas-highland' : c[0] === 'knight' ? 'data-xmas-raid' : c[0] === 'rank' ? 'data-xmas-rank' : 'data-xmas-open="' + c[0] + '"') + (allowed ? '' : ' disabled') + '>' + (c[0] === 'gifts' && CHRISTMAS.claimable(a,Date.now()) ? '<i class="red-dot" aria-label="圣诞任务奖励可领取"></i>' : '') + '<span class="tape l"></span>' + (c[0] === 'rank' ? '<span class="xmas-rank-icon">' + icon('s2MonTicket') + '</span>' : '<img src="' + c[3] + '" alt="">') + '<span><b>' + c[1] + '</b><small>' + c[2] + '</small><em>' + (allowed ? '前往 ›' : c[0] === 'rank' ? '完成孝感大厅支线后解锁' : c[0] === 'highland' ? '击败bttp后与四位伙伴交谈' : !open ? '完成地球主线后解锁' : c[0] === 'knight' ? '先接通杂货铺角落的管道' : c[0] === 'gifts' ? '先带上巴洛，敲开城堡大门' : '先完成Vanber的一项任务') + '</em></span></button>'; }).join('') + '</section><p class="xmas-coming hint">更多圣诞活动待补充</p>';
      return;
    }
    if (panel === 'gifts') {
      var r = CHRISTMAS.read(a, Date.now()), all = CHRISTMAS.TASKS.every(function (t) { return (r.progress[t.id] || 0) >= t.n; });
      el.innerHTML = header + wallet(a) + '<div class="xmas-npc-layout">' + npc(panel) + '<section class="xmas-play"><div class="xmas-scroll xmas-task-list">' + CHRISTMAS.TASKS.map(function (t) {
        var p = Math.min(t.n, r.progress[t.id] || 0), claimed = r.claimed[t.id];
        return '<article class="xmas-task"><div><b>' + t.t + '</b><small>' + p + ' / ' + t.n + '</small><progress value="' + p + '" max="' + t.n + '"></progress>' + reward(t.bell, t.candy) + '</div><button class="btn' + (p >= t.n && !claimed ? ' primary' : '') + '" data-xmas-claim="' + t.id + '"' + (claimed || p < t.n || busy ? ' disabled' : '') + '>' + (claimed ? '已领取' : p >= t.n ? '领取' : '未完成') + '</button></article>';
      }).join('') + '</div><div class="xmas-all"><span><b>全部完成大礼包</b>' + reward(CHRISTMAS.ALL.bell, CHRISTMAS.ALL.candy) + '</span><button class="btn primary" data-xmas-all' + (r.all || !all || busy ? ' disabled' : '') + '>' + (r.all ? '已领取' : '领取礼包') + '</button></div><p class="hint xmas-reset">每日零点（北京时间）刷新</p></section></div>';
      return;
    }
    var pages = Math.ceil(CHRISTMAS.SHOP.length / SIZE); shopPage = Math.max(0, Math.min(shopPage, pages - 1));
    el.innerHTML = header + wallet(a) + '<div class="xmas-npc-layout">' + npc(panel) + '<section class="xmas-play"><div class="xmas-scroll xmas-shop-grid">' + CHRISTMAS.SHOP.slice(shopPage * SIZE, (shopPage + 1) * SIZE).map(function (s) {
      var offer = HSACC.shopOffer('christmas', s.id), owned = offer.owned || 0, limit = s.room ? 1 : 999;
      var max = Math.min(offer.limit, Math.floor(((a.items || {})[s.coin] || 0) / s.price));
      return '<article class="xmas-good" data-xmas-good="' + s.id + '"><div class="xmas-good-title">' + offer.icon + '<b>' + esc(offer.name) + '</b></div><span class="xmas-price">' + icon(s.coin) + s.price + ' / 个</span><small>' + (s.room ? owned ? '已拥有此房型' : '每个账号限兑一次' : '持有 ' + owned) + '</small><div class="xmas-buy"><input type="number" inputmode="numeric" min="1" max="' + limit + '" step="1" value="1" aria-label="' + esc(offer.name) + '兑换数量"><button class="btn primary" data-xmas-buy="' + s.id + '"' + (max < 1 || busy ? ' disabled' : '') + '>兑换</button></div></article>';
    }).join('') + '</div><div class="xmas-pages"><button class="btn" data-xmas-page="-1"' + (!shopPage || busy ? ' disabled' : '') + '>‹ 上一页</button><span>' + (shopPage + 1) + ' / ' + pages + '</span><button class="btn" data-xmas-page="1"' + (shopPage >= pages - 1 || busy ? ' disabled' : '') + '>下一页 ›</button></div></section></div>';
  }
  function storyDialog(lines, action, after, sceneKey) {
    if (storyBusy || document.getElementById('xmas-story')) return;
    storyBusy = true;
    var d = document.createElement('div'), at = 0, portrait = '', friends = false, scene = sceneKey || (action === 'knightIntro' ? 'hl_wonderland' : action === 'shopIntro' ? 'hl_shop' : action === 'shopHint' ? 'hl_cabin' : 'hl_castle'); d.className = 'soc-dlg xmas-story-layer xmas-loading'; d.id = 'xmas-story'; document.body.appendChild(d);
    var assets = [BG[scene]]; if (action === 'cabinIntro') assets.push(BG.hl_cabin);
    lines.forEach(function (l) { if (l.img) assets.push(CHARS[l.img] || SPRITES[l.img]); if (l.friends) ['oct','unicorn','may','ace'].forEach(function (k) { assets.push(CHARS['christmas_'+k]); }); });
    function draw() {
      var l = lines[at];
      if (l.img) portrait = l.img;
      if (l.friends) friends = true;
      if (action === 'cabinIntro' && portrait) scene = 'hl_cabin';
      var color = l.n === 'Vanber' ? '#2a4ca0' : l.n === 'Threego' ? '#6f8f2a' : 'var(--ink)';
      var place = scene === 'hl_highland' ? '格伦高地' : scene === 'hl_wonderland' ? '圣诞仙境' : scene === 'hl_shop' ? '杂货铺' : scene === 'hl_cabin' ? '秘密小屋' : '圣诞城堡';
      d.innerHTML = '<section class="xmas-story-scene" role="dialog" aria-modal="true" aria-labelledby="xmas-story-name" aria-describedby="xmas-story-text">' +
        '<img class="vn-bg xmas-story-bg" src="' + BG[scene] + '" alt=""><div class="xmas-story-shade" aria-hidden="true"></div>' +
        '<header class="xmas-story-heading"><span>圣诞奇遇 · ' + place + '</span><small>' + (at + 1) + ' / ' + lines.length + '</small></header>' +
        '<div class="xmas-story-cast' + (friends ? ' with-friends' : '') + '" aria-hidden="true">' + (friends ? friendsHTML(!!l.friends) : '') + (portrait ? '<img class="xmas-story-art' + (l.img ? ' speaking' : ' listening') + '" src="' + (CHARS[portrait] || SPRITES[portrait]) + '" alt="">' : '') + '</div>' +
        '<div class="vn-box xmas-story-box" style="--cc:' + color + '"><div class="vn-name" id="xmas-story-name">' + esc(l.n) + '</div>' +
        '<p class="vn-text xmas-story-text" id="xmas-story-text">' + esc(l.t) + '</p><small class="hint red" data-xmas-story-error role="alert" hidden></small>' +
        '<div class="xmas-story-actions">' + (l.choices ? l.choices.map(function (q) { return '<button class="vn-opt" data-xmas-next>' + esc(q) + '</button>'; }).join('') : '<button class="btn primary" data-xmas-next>' + (at < lines.length - 1 ? '继续 ›' : '知道了') + '</button>') + '</div></div></section>';
      if (!d.classList.contains('xmas-loading')) d.querySelector('[data-xmas-next]').focus({ preventScroll: true });
    }
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-xmas-next]'); if (!b || b.disabled) return;
      if (at < lines.length - 1) { at++; draw(); return; }
      b.disabled = true;
      function done() { d.remove(); storyBusy = false; if (after) after(); }
      if (!action) { done(); return; }
      var L = LOADER.show('正在继续圣诞旅程～', {delay:120}); L.to(.8);
      var send = typeof action === 'object' && action.op === 'highland' ? HSACC.highlandTx : HSACC.christmasTx;
      send(typeof action === 'object' ? action.args : { a: action }, function () { L.done(done); }, function (err) { L.close(); b.disabled = false; var error = d.querySelector('[data-xmas-story-error]'); error.hidden = false; error.textContent = err || '网络不稳，请重试'; });
    }); draw(); gate(d,'正在载入圣诞剧情～',function () { d.querySelector('[data-xmas-next]').focus({preventScroll:true}); },assets);
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
    else if (bg === 'hl_wonderland' && CHRISTMAS.wonderOpen(HSACC.acc()) && !CHRISTMAS.story(HSACC.acc()).knightIntro && !storyBusy) knightStory();
  }
  function friendsHTML(walk) { return '<div class="xmas-friends' + (walk ? ' walking' : '') + '" aria-label="OCT、Unicorn、May和Ace">' + ['oct','unicorn','may','ace'].map(function (name,i) { return '<span style="--friend:' + i + '"><img src="' + CHARS['christmas_' + name] + '" alt="' + ['OCT','Unicorn','May','Ace'][i] + '"></span>'; }).join('') + '</div>'; }
  function knightStory() {
    storyDialog([
      { n: '你', t: '管道后方竟通向另一片雪地。小屋前，一个戴着恶魔角、手持黑暗树枝的身影正试着推开房门。' },
      { n: 'bttp', img: 'bttp_christmas', t: '我是邪恶的鲁普雷希特骑士。这间房子，很快就归我了。' },
      { n: '你', t: 'bttp？先把树枝放下，你不能就这样闯进别人的房子。' },
      { n: 'bttp', img: 'bttp_christmas', t: '想阻止我？那就先击败我召唤的精灵。' },
      { n: '你', friends: true, t: '屋门推开，OCT、Unicorn、May和Ace陆续走了出来。原来Threego说要分糖的，就是他们四个。' },
      { n: '四人', t: '加油！拜托你守住我们的房子！' },
      { n: 'bttp', img: 'bttp_christmas', t: '我的召唤可不会停下。来吧，让我看看你的本事。' }
    ], 'knightIntro', function () { HSACC.goWonderland(); openKnight(); });
  }
  function openPipes() {
    if (busy || storyBusy || HSACC.inBattle() || document.getElementById('xmas-pipes')) return;
    var a = HSACC.acc(); if (!CHRISTMAS.story(a).shopIntro) { HSACC.toast('先去见杂货铺的Threego'); return; }
    if (CHRISTMAS.wonderOpen(a)) { HSACC.goWonderland(); return; }
    var rot = CHRISTMAS.PIPE_START.slice(), turns = 0, d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'xmas-pipes';
    d.innerHTML = '<section class="soc-box xmas-pipe-box" role="dialog" aria-modal="true" aria-labelledby="xmas-pipe-title"><header><div><small class="hint">杂货铺 · 神秘角落</small><h2 id="xmas-pipe-title">雪夜的秘密管道</h2></div><button class="btn ghost" data-pipe-close aria-label="关闭管道小游戏">×</button></header><p class="hint">点击管道顺时针旋转，把左上入口接到右下出口</p><div class="xmas-pipe-board-wrap"><span class="xmas-pipe-in">入口 →</span><div class="xmas-pipe-board" role="group" aria-label="4乘4管道拼图"></div><span class="xmas-pipe-out">→ 出口</span></div><p class="xmas-pipe-status" role="status" aria-live="polite"></p><footer><button class="btn" data-pipe-reset>重新开始</button><button class="btn primary" data-pipe-check>接通管道</button></footer></section>';
    document.body.appendChild(d);
    function draw() {
      var reach = CHRISTMAS.pipeReach(rot);
      d.querySelector('.xmas-pipe-board').innerHTML = rot.map(function (r,i) { var mask = CHRISTMAS.pipeMask(i,r); return '<button class="xmas-pipe-tile' + (reach.indexOf(i)>=0?' connected':'') + '" data-pipe-tile="' + i + '" aria-label="第' + (Math.floor(i/4)+1) + '行第' + (i%4+1) + '列管道，点击旋转"><svg viewBox="0 0 60 60" aria-hidden="true"><path d="' + [[1,'M30 30V0'],[2,'M30 30H60'],[4,'M30 30V60'],[8,'M30 30H0']].filter(function (x) { return mask & x[0]; }).map(function (x) { return x[1]; }).join(' ') + '"/><circle cx="30" cy="30" r="9"/></svg></button>'; }).join('');
      d.querySelector('.xmas-pipe-status').textContent = CHRISTMAS.pipeSolved(rot) ? '管道连通了！打开通往圣诞仙境的入口吧' : '已旋转 ' + turns + ' 次 · 发光的管道与入口相连';
    }
    var waiting = false;
    d.addEventListener('click', function (e) {
      var tile = e.target.closest('[data-pipe-tile]');
      if (waiting) return;
      if (e.target.closest('[data-pipe-close]')) { d.remove(); return; }
      if (tile) { var i = +tile.dataset.pipeTile; rot[i] = (rot[i]+1)%4; turns++; draw(); d.querySelector('[data-pipe-tile="'+i+'"]').focus({preventScroll:true}); return; }
      if (e.target.closest('[data-pipe-reset]')) { rot = CHRISTMAS.PIPE_START.slice(); turns = 0; draw(); return; }
      if (!e.target.closest('[data-pipe-check]')) return;
      if (!CHRISTMAS.pipeSolved(rot)) { d.querySelector('.xmas-pipe-status').textContent = '还没连到出口，再转一转试试'; return; }
      waiting = true; d.querySelector('[data-pipe-check]').disabled = true;
      var L = LOADER.show('正在打开圣诞仙境的入口～', {delay:120}); L.to(.7);
      HSACC.christmasTx({a:'pipes',rot:rot},function () { L.done(function () { d.remove(); HSACC.goWonderland(); }); },function (err) { L.close(); waiting = false; d.querySelector('[data-pipe-check]').disabled = false; d.querySelector('.xmas-pipe-status').textContent = err; });
    });
    d.addEventListener('keydown',function (e) { if (e.key==='Escape'&&!waiting) d.remove(); }); draw(); gate(d,'正在准备管道拼图～',function () { d.querySelector('[data-pipe-tile]').focus({preventScroll:true}); });
  }
  function openKnight() {
    if (busy || storyBusy || HSACC.inBattle() || document.getElementById('xmas-knight')) return;
    if (!CHRISTMAS.knightOpen(HSACC.acc())) { if (CHRISTMAS.wonderOpen(HSACC.acc())) knightStory(); return; }
    busy = true;
    var L = LOADER.show('正在载入讨伐活动～', {delay:120}); L.to(.5);
    HSACC.christmasTx({a:'knightVisit'},function () {
      busy = false; var a = HSACC.acc(), k = CHRISTMAS.story(a).knight, d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'xmas-knight';
      d.innerHTML = '<section class="soc-box xmas-knight-box" role="dialog" aria-modal="true" aria-labelledby="xmas-knight-title"><header><div><small class="hint">圣诞仙境 · 可重复挑战</small><h2 id="xmas-knight-title">讨伐鲁普雷希特骑士</h2></div><button class="btn ghost" data-knight-close aria-label="关闭讨伐活动">×</button></header>' + wallet(a) + '<div class="xmas-npc-layout">' + npc('knight') + '<section class="xmas-play"><p class="hint">每次挑战一只，获胜后获得拐杖糖并刷新目标</p><div class="xmas-knight-targets">' + k.slots.map(function (t,i) { var f = ACC.form(t); return '<article><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><span>LV' + t.lv + '</span><small>' + icon('xmasCandy') + '×' + CHRISTMAS.KNIGHT_CANDY[i] + '</small><button class="btn primary" data-knight-fight="' + i + '" data-target-id="' + t.id + '">挑战</button></article>'; }).join('') + '</div><p class="hint">已击败 ' + k.wins + ' 只 · 无次数限制 · 失败可重试</p></section></div></section>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { var b = e.target.closest('[data-knight-fight]'); if (e.target.closest('[data-knight-close]')) { d.remove(); return; } if (!b) return; var slot = +b.dataset.knightFight, id = +b.dataset.targetId; d.remove(); HSACC.fightChristmasKnight(slot,id); });
      d.addEventListener('keydown',function (e) { if (e.key==='Escape') d.remove(); }); gate(d,'正在载入讨伐活动～',function () { d.querySelector('[data-knight-fight]').focus({preventScroll:true}); },null,L);
    },function (err) { L.close(); busy = false; HSACC.toast(err); });
  }
  function sceneObjects(bg) {
    if (bg === 'hl_shop') return '<button class="xmas-secret-corner" data-xmas-pipes aria-label="查看杂货铺角落的管道"><span aria-hidden="true">✦</span><b>' + (CHRISTMAS.wonderOpen(HSACC.acc()) ? '通往圣诞仙境' : '神秘角落') + '</b></button>';
    if (bg === 'hl_highland') return '<button class="xmas-scene-npc xmas-highland-npc" data-xmas-highland style="left:60%;top:88%" aria-label="莫格伦 · 高地之王"><img src="' + SPRITES.glen + '" alt="莫格伦"><span>莫格伦 · LV50 · 世界BOSS</span></button><button class="btn xmas-wonder-return" data-highland-return>‹ 返回圣诞仙境</button>';
    if (bg !== 'hl_wonderland') return '';
    return '<button class="xmas-scene-npc xmas-knight-npc" data-xmas-knight style="left:71%;top:91%" aria-label="bttp · 讨伐鲁普雷希特骑士"><img src="' + CHARS.bttp_christmas + '" alt="鲁普雷希特骑士bttp"><span>bttp · 讨伐活动</span></button><div class="xmas-scene-friends">' + (HIGHLAND.ready(HSACC.acc()) ? HSHIGHLAND.friends() : friendsHTML(false)) + '</div>' + (HIGHLAND.ready(HSACC.acc()) && !HIGHLAND.open(HSACC.acc()) ? '<p class="xmas-friend-hint">点击四位伙伴，寻找打败骑士的方法（' + HIGHLAND.FRIENDS.filter(function (k) { return (HIGHLAND.read(HSACC.acc()).talks || {})[k]; }).length + '/4）</p>' : '') + '<button type="button" class="btn xmas-highland-enter" data-highland-enter' + (HIGHLAND.open(HSACC.acc()) ? '' : ' disabled') + '>格伦高地 ›</button><button class="btn xmas-wonder-return" data-xmas-scene="2">‹ 返回杂货铺</button>';
  }
  function sourcePanel(k) {
    if (k !== 'xmasBell' && k !== 'xmasCandy') return;
    var old = document.getElementById('xmas-sources'); if (old) old.remove();
    var bell = k === 'xmasBell', a = HSACC.acc(), title = bell ? '圣诞铃铛' : '拐杖糖';
    var rows = [
      { to:'tasks', title:'Vanber的圣诞礼物', text:'完成每日圣诞任务，领取' + title },
      { to:'all', title:'全部完成大礼包', text:'完成全部圣诞任务后，额外领取' + title + ' ×' + (bell ? CHRISTMAS.ALL.bell : CHRISTMAS.ALL.candy) }
    ];
    if (!bell) {
      rows.push({ to:'highland', title:'格伦高地 · 高地之王', text:'每天可完成5次试炼，按伤害获得拐杖糖、高地的认可与经验' });
      rows.push({ to:'knight', title:'讨伐鲁普雷希特骑士', text:'击败50、60、70级召唤精灵，分别获得5、8、12个拐杖糖，可重复挑战' });
      if (CHRISTMAS.RANK_EVENT.enabled) rows.push({ to:'rank', title:'竞技排位S2新赛季', text:'活动期间胜利获得20个，失败或平局获得10个，认输不发放' });
    }
    var d = document.createElement('div'), prev = document.activeElement; d.id='xmas-sources'; d.className='soc-dlg';
    d.innerHTML='<section class="soc-box xmas-sources-box" role="dialog" aria-modal="true" aria-labelledby="xmas-sources-title"><header><h2 id="xmas-sources-title">'+title+' · 获取方式</h2><button type="button" class="btn ghost" data-source-close aria-label="关闭获取指引">×</button></header><div class="xmas-source-list">'+rows.map(function(r,i){return '<article><div><b>'+r.title+'</b><p>'+r.text+'</p></div><button type="button" class="xmas-source-arrow" data-source-go="'+i+'" aria-label="前往'+r.title+'">→</button></article>';}).join('')+'</div></section>';
    function close(){d.remove();document.removeEventListener('keydown',key);if(prev&&prev.isConnected)prev.focus({preventScroll:true});}
    function key(e){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){var list=Array.from(d.querySelectorAll('button')),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
    d.addEventListener('click',function(e){if(e.target===d||e.target.closest('[data-source-close]')){close();return;}var b=e.target.closest('[data-source-go]');if(!b)return;var row=rows[+b.dataset.sourceGo];if(!row)return;close();var knight=document.getElementById('xmas-knight');if(knight)knight.remove();
      if(row.to==='highland'){if(HIGHLAND.open(a))HSHIGHLAND.open();else{HSACC.goWonderland();HSACC.toast('先击败一次bttp，再点击四位伙伴交谈');}return;}
      if(row.to==='rank'){if(!HSACC.goRank())HSACC.openQuests('side');return;}
      if(!PVE.helenaOpen(a)){HSACC.openQuests('main');return;}
      if(row.to==='knight'){if(CHRISTMAS.wonderOpen(a)){if(CHRISTMAS.knightOpen(a))openKnight();else HSACC.goWonderland();}else{HSACC.goHelena(CHRISTMAS.sceneOpen(a,2)?2:0);HSACC.toast('先解锁杂货铺，再接通角落的管道');}return;}
      if(CHRISTMAS.sceneOpen(a,1))HSACC.goChristmas('gifts');else{HSACC.goHelena(0);HSACC.toast('先带上巴洛，去城堡大门敲门');}
    });
    document.body.appendChild(d);document.addEventListener('keydown',key);d.querySelector('[data-source-close]').focus({preventScroll:true});
  }
  function redraw() { var el = document.getElementById('pg-christmas'); if (el && !el.hidden) HSACC.go('christmas'); }
  document.addEventListener('click', function (e) {
    var talk = e.target.closest('[data-xmas-talk]'); if (talk) { npcTalk(talk.dataset.xmasTalk); return; }
    if (e.target.closest('[data-xmas-wonder-location]')) { var k = document.getElementById('xmas-knight'); if (k) k.remove(); HSACC.goWonderland(); return; }
    var source = e.target.closest('[data-xmas-source]'); if (source) { sourcePanel(source.dataset.xmasSource); return; }
    if (e.target.closest('[data-xmas-rank]')) { HSACC.goRank(); return; }
    if (e.target.closest('[data-xmas-raid]')) { if(CHRISTMAS.knightOpen(HSACC.acc()))openKnight();else HSACC.goWonderland(); return; }
    if (e.target.closest('[data-xmas-pipes]')) { openPipes(); return; }
    if (e.target.closest('[data-xmas-knight]')) { openKnight(); return; }
    var door = e.target.closest('[data-xmas-door]');
    if (door && !busy && !storyBusy) {
      busy = true;
      var L = LOADER.show('正在敲开城堡大门～', {delay:120}); L.to(.7);
      HSACC.christmasTx({ a: 'door' }, function (r) {
        L.done(function () { busy = false;
        if (r.needsBarlow) storyDialog([{ n: '熟悉的声音', t: '想进来？先带一只巴洛到背包里吧。它愿意跟着你、听你的话，才说明你是会好好对待精灵的人。' }, { n: '你', t: '这声音听起来好熟悉……先把巴洛放进出战背包，再来敲门吧。' }], null);
        else if (!CHRISTMAS.story(HSACC.acc()).cabinIntro) cabinStory(); else HSACC.goHelena(1);
        });
      }, function (err) { L.close(); busy = false; HSACC.toast(err); }); return;
    }
    var home = e.target.closest('[data-helena]'); if (home) { HSACC.goHelena(0); return; }
    var scene = e.target.closest('[data-xmas-scene]'); if (scene) { HSACC.goHelena(+scene.dataset.xmasScene); return; }
    var page = e.target.closest('[data-xmas-page]'); if (page && !page.disabled && !busy) { shopPage += +page.dataset.xmasPage; redraw(); return; }
    var claim = e.target.closest('[data-xmas-claim]'), all = e.target.closest('[data-xmas-all]'), buy = e.target.closest('[data-xmas-buy]');
    var b = claim || all || buy; if (!b || b.disabled || busy) return;
    var args = claim ? { a: 'claim', id: claim.dataset.xmasClaim } : all ? { a: 'all' } : { a: 'buy', id: buy.dataset.xmasBuy, n: Number(buy.closest('[data-xmas-good]').querySelector('input').value) };
    busy = true; b.disabled = true;
    var L = LOADER.show(args.a === 'buy' ? '正在兑换圣诞道具～' : '正在领取圣诞礼物～', {delay:120}); L.to(.7);
    HSACC.christmasTx(args, function (r) { L.done(function () { busy = false; HSACC.renderRes(); redraw(); HSACC.toast(r.already ? '已经领取过了' : args.a === 'buy' ? '已兑换' + (TX.D.BASE_ROOMS[r.k] ? TX.D.BASE_ROOMS[r.k].n : TX.D.BASE_DECO[r.k] ? TX.D.BASE_DECO[r.k].n : HSACC.itemName(r.k)) + ' ×' + r.n : '获得圣诞铃铛 ×' + r.bell + '、拐杖糖 ×' + r.candy); }); }, function (err) { L.close(); busy = false; redraw(); HSACC.toast(err || '暂时无法完成，请重试'); });
  });
  return { dialog: storyDialog, openHighland: function () { HSHIGHLAND.open(); }, highlandResult: function (rep) { HSHIGHLAND.result(rep); }, render: render, gate: gate, images: images, maybeStory: maybeStory, sceneEntered: sceneEntered, sceneObjects: sceneObjects, openKnight: openKnight };
})();
