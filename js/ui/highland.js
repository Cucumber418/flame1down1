/* 格伦高地沿用圣诞活动的NPC侧栏、兑换卡片和二级面板。 */
var HSHIGHLAND = (function () {
  'use strict';
  var refreshActive = null;
  var names = { oct: 'OCT', unicorn: 'Unicorn', may: 'May', ace: 'Ace' };
  var lines = {
    oct: ['只赢一场还不够！那个鲁普雷希特骑士，居然还能继续召唤。硬拼下去可不是办法。', '听说高地上有位从不低头的王。去找传说中的“高地之王”吧，有他帮忙，一定能打败bttp！'],
    unicorn: ['你刚才好厉害！不过，他怎么又叫来一只……我们的糖不会也被抢走吧？', '我相信传说是真的！越过雪地，去格伦高地找“高地之王”。要是你们一起回来，一定特别威风！'],
    may: ['先歇一歇吧。鲁普雷希特骑士比看上去难对付，召唤不停，我们迟早会被耗尽体力。', '格伦高地的莫格伦被称为“高地之王”。他只认可有实力的人。去向他证明自己，请他帮我们打败bttp吧。'],
    ace: ['赢了这一场，不等于赢过骑士。别被他的召唤拖住。', '去格伦高地，找“高地之王”。他不会轻易答应你——拿出实力，让他认可。然后一起回来击败bttp。']
  };
  function esc(s) { return HSUI.esc(String(s)); }
  function icon(k) { return HSUI.itemIcon(k); }
  function num(n) { return Number(n || 0).toLocaleString('zh-CN'); }
  function dialog(ls, action, after, scene) { HSCHRISTMAS.dialog(ls, action, after, scene); }
  function friendTalk(id) {
    if (!HIGHLAND.ready(HSACC.acc()) || !lines[id] || HSACC.inBattle()) return;
    dialog(lines[id].map(function (t) { return { n: names[id], img: 'christmas_' + id, t: t }; }), { op: 'highland', args: { a: 'talk', id: id } }, function () {
      HSACC.goWonderland();
      HSACC.toast(HIGHLAND.open(HSACC.acc()) ? '四位伙伴都提到了高地之王。通往格伦高地的路已开放！' : '再听听其他伙伴的建议。');
    }, 'hl_wonderland');
  }
  function friends() {
    var r = HIGHLAND.read(HSACC.acc()), talks = r.talks || {};
    return '<div class="xmas-friends xmas-friends-talk" aria-label="点击四位伙伴交谈">' + HIGHLAND.FRIENDS.map(function (k) { return '<button type="button" data-highland-friend="' + k + '" aria-label="与' + names[k] + '交谈" style="--friend:' + HIGHLAND.FRIENDS.indexOf(k) + '"><img src="' + CHARS['christmas_' + k] + '" alt="' + names[k] + '"><span>' + names[k] + (talks[k] ? ' ✓' : ' · 交谈') + '</span></button>'; }).join('') + '</div>';
  }
  function intro(after) {
    dialog([
      { n: '你', t: '风越过岩峰，一只昂首的莫格伦伫立在高地上。他似乎早已知道你的来意。' },
      { n: '莫格伦', img: 'glen', t: '鲁普雷希特骑士？要我为你而战，先让我看见你的实力。高地之王不会追随一个只会求助的人。' },
      { n: '莫格伦', img: 'glen', t: '二十回合，尽你所能向我挑战。带着高地的认可回来，你就有资格让我的力量为你所用。' }
    ], { op: 'highland', args: { a: 'intro' } }, after, 'hl_highland');
  }
  function wallet(a) { return '<div class="xmas-wallet">' + [['highlandPt','高地的认可'],['xmasBell','圣诞铃铛'],['xmasCandy','拐杖糖']].map(function (v) { return '<span>' + icon(v[0]) + v[1] + ' <b>' + num((a.items || {})[v[0]]) + '</b></span>'; }).join('') + '</div>'; }
  function open() {
    if (HSACC.inBattle() || document.getElementById('xmas-highland')) return;
    if (!HIGHLAND.open(HSACC.acc())) { HSACC.toast('先击败一次bttp，再点击四位伙伴交谈'); return; }
    if (!HIGHLAND.read(HSACC.acc()).intro) { intro(open); return; }
    var d = document.createElement('div'), tab = 'fight', scope = 'total', page = 0, ticket = 0, buying = false, prev = document.activeElement;
    d.id = 'xmas-highland'; d.className = 'soc-dlg'; document.body.appendChild(d);
    function close() { ticket++; refreshActive = null; d.remove(); if (prev && prev.isConnected) prev.focus({preventScroll:true}); }
    function draw() {
      ticket++;
      var a = HSACC.acc(), r = HIGHLAND.read(a), today = HIGHLAND.day(a, Date.now());
      d.innerHTML = '<section class="soc-box xmas-knight-box xmas-highland-box" role="dialog" aria-modal="true" aria-labelledby="highland-title"><header><div><small class="hint">圣诞仙境 · 格伦高地</small><h2 id="highland-title">高地之王</h2></div><button type="button" class="btn ghost" data-highland-close aria-label="关闭高地活动">×</button></header>' + wallet(a) + '<div class="xmas-npc-layout"><aside class="xmas-npc-side"><button type="button" class="xmas-npc-portrait" data-highland-talk aria-label="与莫格伦交谈"><img src="' + SPRITES.glen + '" alt="莫格伦"><b>莫格伦 · LV50</b><small>点击交谈</small></button><button type="button" class="btn ghost xmas-npc-place" data-highland-location>前往格伦高地</button></aside><section class="xmas-play"><nav class="xmas-highland-tabs" aria-label="高地活动">' + [['fight','挑战'],['shop','兑换'],['rank','伤害排行']].map(function (x) { return '<button type="button" class="btn' + (tab === x[0] ? ' primary' : '') + '" data-highland-tab="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</nav><div class="xmas-scroll xmas-highland-content">' + (tab === 'fight' ? '<div class="xmas-highland-stats"><span>今日剩余<b>' + (HIGHLAND.RULES.daily - today.used) + ' / 5</b></span><span>累计伤害<b>' + num(r.total) + '</b></span><span>单次最高<b>' + num(r.best) + '</b></span></div><article class="xmas-highland-rules"><b>用实力赢得高地的认可</b><p>每场100万体力，最多20回合；免疫所有百分比伤害与异常状态。</p><p>坚持到试炼结束或提前击败莫格伦，按实际伤害结算。逃跑或战败不扣次数、不结算伤害与奖励。</p><p>造成伤害并完成挑战可获得70–80个高地的认可、2万–20万经验和10–100个拐杖糖，伤害越高奖励越多。</p><small class="hint">每日零点（北京时间）刷新次数 · 约3天可攒够精元所需认可</small></article>' + (r.last ? '<p class="hint">上次挑战：' + num(r.last.damage) + '伤害</p>' : '') : tab === 'shop' ? '<div class="xmas-shop-grid xmas-highland-shop">' + HIGHLAND.SHOP.map(function (s) {
        var keys = Object.keys(s.costs), max = Math.min.apply(Math, keys.map(function (k) { return Math.floor(((a.items || {})[k] || 0) / s.costs[k]); }));
        return '<article class="xmas-good" data-highland-good="' + s.id + '"><div class="xmas-good-title">' + icon(s.k) + '<b>' + esc(HSACC.itemName(s.k)) + '</b></div><small>' + (s.k === 'e_glen' ? '孵化8小时后诞生LV1格伦' : '格伦一系专用，每项天赋随机两次取高') + '</small><div class="xmas-highland-cost">' + keys.map(function (k) { return '<span class="xmas-price">' + icon(k) + s.costs[k] + (k === 'highlandPt' ? ' 高地的认可' : ' 圣诞铃铛') + '</span>'; }).join('') + '</div><small>持有 ' + num((a.items || {})[s.k]) + '</small><div class="xmas-buy"><input type="number" inputmode="numeric" min="1" max="999" step="1" value="1" aria-label="' + esc(HSACC.itemName(s.k)) + '兑换数量"><button type="button" class="btn primary" data-highland-buy="' + s.id + '"' + (max < 1 || buying ? ' disabled' : '') + '>兑换</button></div></article>';
      }).join('') + '</div>' : '<div data-highland-board role="status">正在读取全服伤害记录…</div>') + '</div>' + (tab === 'fight' ? '<button type="button" class="btn primary xmas-highland-fight" data-highland-fight' + (today.used >= HIGHLAND.RULES.daily ? ' disabled' : '') + '>' + (today.used >= 5 ? '今日挑战已完成' : '挑战高地之王') + '</button>' : '') + '</section></div></section>';
      if (tab === 'rank') loadBoard();
    }
    function loadBoard() {
      var t = ++ticket, box = d.querySelector('[data-highland-board]');
      if (!box) return;
      function render(b) {
        if (!d.isConnected || t !== ticket) return;
        page = b.page;
        box.innerHTML = '<div class="xmas-highland-board-tools"><button class="btn' + (scope === 'total' ? ' primary' : '') + '" data-highland-scope="total">累计伤害</button><button class="btn' + (scope === 'today' ? ' primary' : '') + '" data-highland-scope="today">今日伤害</button><button class="btn ghost" data-highland-refresh>刷新</button></div><p class="hint">' + b.players + '人已完成挑战 · 全服共造成' + num(b.total) + '伤害</p><p class="xmas-highland-me">' + (b.me ? '我：第' + b.me.rank + '名 · ' + num(b.me.damage) + '伤害 · ' + b.me.runs + '场' : '完成一次挑战后，你的伤害会记录在这里') + '</p><div class="xmas-highland-ranking">' + (b.rows.length ? '<table><thead><tr><th>排名</th><th>玩家</th><th>伤害</th><th>场数</th></tr></thead><tbody>' + b.rows.map(function (r) { return '<tr' + (b.me && r.user === b.me.user ? ' class="is-me"' : '') + '><td>' + r.rank + '</td><td title="' + esc(r.user) + '">' + esc(r.name) + '</td><td>' + num(r.damage) + '</td><td>' + r.runs + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="hint">暂无已结算的挑战记录</p>') + '</div><div class="xmas-pages"><button class="btn" data-highland-page="-1"' + (!page ? ' disabled' : '') + '>‹ 上一页</button><span>' + (page+1) + ' / ' + b.pages + '</span><button class="btn" data-highland-page="1"' + (page+1 >= b.pages ? ' disabled' : '') + '>下一页 ›</button></div>';
      }
      if (location.protocol === 'file:') {
        var a = HSACC.acc(), r = HIGHLAND.read(a), dy = HIGHLAND.day(a, Date.now()), damage = scope === 'today' ? dy.damage : r.total || 0, runs = scope === 'today' ? dy.used : r.runs || 0, row = { rank: 1, user: 'local', name: a.name, damage: damage, runs: runs };
        render({ page: 0, pages: 1, players: runs ? 1 : 0, total: damage, rows: runs ? [row] : [], me: runs ? row : null }); return;
      }
      CLOUD.api('GET', '/api/highland?scope=' + scope + '&page=' + page).then(function (b) { if (!b.ok) throw new Error(b.error || '读取失败'); render(b); }).catch(function () { if (d.isConnected && t === ticket) box.innerHTML = '<p class="hint">暂时读不到排行，请重试</p><button class="btn" data-highland-refresh>重新加载</button>'; });
    }
    d.addEventListener('click', function (e) {
      var b;
      if (e.target === d || e.target.closest('[data-highland-close]')) { close(); return; }
      if ((b = e.target.closest('[data-highland-tab]'))) { tab = b.dataset.highlandTab; draw(); return; }
      if (e.target.closest('[data-highland-location]')) { close(); HSACC.goHighland(); return; }
      if (e.target.closest('[data-highland-talk]')) { dialog([{ n: '莫格伦', img: 'glen', t: '让高地记住你的每一次进攻。证明你的实力，我的力量才会为你所用。' }], null, null, 'hl_highland'); return; }
      if (e.target.closest('[data-highland-fight]')) { close(); HSACC.fightHighland(); return; }
      if ((b = e.target.closest('[data-highland-scope]'))) { scope = b.dataset.highlandScope; page = 0; loadBoard(); return; }
      if ((b = e.target.closest('[data-highland-page]')) && !b.disabled) { page += +b.dataset.highlandPage; loadBoard(); return; }
      if (e.target.closest('[data-highland-refresh]')) { loadBoard(); return; }
      if (!(b = e.target.closest('[data-highland-buy]')) || b.disabled || buying) return;
      var n = Number(b.closest('[data-highland-good]').querySelector('input').value); buying = true; b.disabled = true;
      HSACC.highlandTx({ a: 'buy', id: b.dataset.highlandBuy, n: n }, function (r) { buying = false; HSACC.renderRes(); if (d.isConnected) draw(); HSACC.toast('已兑换' + HSACC.itemName(r.k) + ' ×' + r.n); }, function (err) { buying = false; if (d.isConnected) draw(); HSACC.toast(err); });
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') { var bs = Array.from(d.querySelectorAll('button:not(:disabled),input')), f = bs[0], l = bs[bs.length-1]; if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); } else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); } }
    });
    refreshActive = function () { if (d.isConnected) draw(); };
    draw(); HSCHRISTMAS.gate(d, '正在载入格伦高地活动～', function () { d.querySelector('[data-highland-close]').focus({preventScroll:true}); });
  }
  function result(rep) {
    var old = document.getElementById('highland-result'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'highland-result';
    d.innerHTML = '<section class="soc-box xmas-knight-box xmas-highland-result" role="dialog" aria-modal="true" aria-label="高地挑战结算"><header><h2>' + (rep && rep.counted ? '高地试炼完成' : '挑战未完成') + '</h2><button class="btn ghost" data-highland-result-close aria-label="关闭挑战结算">×</button></header>' + (rep && rep.counted ? '<p>本次造成伤害 <b>' + num(rep.damage) + '</b></p><div class="xmas-highland-prizes">' + icon('highlandPt') + '高地的认可 ×' + rep.reward.highlandPt + '<br>经验背包 +' + num(rep.reward.exp) + '<br>' + icon('xmasCandy') + '拐杖糖 ×' + rep.reward.xmasCandy + '</div><p class="hint">今日剩余挑战 ' + (5 - rep.used) + ' / 5</p>' : '<p>本次不扣挑战次数，不结算伤害与奖励。</p>') + '<div class="soc-foot"><button class="btn primary" data-highland-result-open>返回高地活动</button></div></section>';
    document.body.appendChild(d); d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-highland-result-close]')) d.remove(); else if (e.target.closest('[data-highland-result-open]')) { d.remove(); open(); } }); d.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.remove(); }); d.querySelector('[data-highland-result-open]').focus({preventScroll:true});
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-highland-friend]'); if (b) { friendTalk(b.dataset.highlandFriend); return; }
    if (e.target.closest('[data-xmas-highland]')) { open(); return; }
    if (e.target.closest('[data-highland-enter]')) { HSACC.goHighland(); return; }
    if (e.target.closest('[data-highland-return]')) HSACC.goWonderland();
  });
  return { open: open, friends: friends, result: result, refresh: function () { if (refreshActive) refreshActive(); } };
})();
