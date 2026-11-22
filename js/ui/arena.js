/* 竞技大厅：四种模式共用一屏，长规则和奖励通过弹窗查看 */
(function () {
  'use strict';
  var builder = document.getElementById('builder'), bar = builder.querySelector('.modebar'), current = null;
  var home = document.createElement('section'); home.id = 'arena-home';
  home.innerHTML = '<header class="arena-welcome"><span class="step">飞船终端</span><h2>竞技对战</h2><p class="hint">选择一种作战方式</p></header>';
  builder.prepend(home); home.appendChild(bar);
  bar.removeAttribute('role'); bar.removeAttribute('aria-label');
  var contest = document.createElement('button'); contest.type = 'button'; contest.id = 'mode-contest'; contest.className = 'mode';
  contest.innerHTML = '<b>争霸赛</b><span>报名、抽签、赛程与积分榜</span>'; bar.appendChild(contest);
  var work = document.createElement('section'); work.id = 'arena-work'; work.hidden = true;
  work.innerHTML = '<header class="arena-mode-head"><button type="button" class="btn ghost" data-arena-home>‹ 竞技大厅</button><h2 id="arena-mode-title"></h2><button type="button" class="btn ghost arena-config-open" data-arena-config>精灵与技能</button></header><div id="arena-scroll"></div>';
  var content = work.querySelector('#arena-scroll');
  Array.from(builder.children).forEach(function (n) { if (n !== home) content.appendChild(n); }); builder.appendChild(work);
  var ct = document.createElement('section'); ct.id = 'arena-contest'; ct.hidden = true; content.appendChild(ct);
  function show(mode) {
    work.querySelector('[data-arena-config]').hidden = mode === 'contest' || mode === 'brawl' || document.querySelector('.build').hidden;
    current = mode; home.hidden = true; work.hidden = false; builder.dataset.arenaMode = mode;
    document.getElementById('arena-mode-title').textContent = { sandbox: '沙盒调试', rank: '平衡排位 · S2', brawl: '精灵大乱斗', contest: '争霸赛' }[mode];
    Array.from(content.children).forEach(function (n) { n.classList.toggle('arena-contest-hide', mode === 'contest' && n !== ct); });
    ct.hidden = mode !== 'contest';
    if (mode === 'contest') {
      ct.innerHTML = HSACC.contestOpen() ? HSACC.contestHTML() : '<p class="hint">读完「降临芙罗拉」后开放争霸赛</p>';
    }
  }
  function back() { current = null; home.hidden = false; work.hidden = true; ct.innerHTML = ''; delete builder.dataset.arenaMode; }
  ['sandbox','rank','brawl'].forEach(function (mode) {
    document.getElementById('mode-' + mode).addEventListener('click', function () {
      if (mode === 'brawl' && !HSACC.brawlOpen()) return;
      show(mode);
    });
  });
  contest.addEventListener('click', function () { show('contest'); });
  function open(mode) {
    if (mode === 'contest') show(mode);
    else document.getElementById('mode-' + mode).click();
  }
  function modal(title, html, onClose) {
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'arena-details';
    d.innerHTML = '<section class="soc-box arena-details" role="dialog" aria-modal="true" aria-labelledby="arena-details-title"><header><h2 id="arena-details-title">' + title + '</h2><button type="button" class="btn ghost" data-arena-close aria-label="关闭详情">×</button></header><div class="arena-details-scroll">' + html + '</div></section>';
    var prev = document.activeElement;
    function close() { if (onClose) onClose(); d.remove(); document.removeEventListener('keydown', key); if (prev && prev.isConnected) prev.focus({preventScroll:true}); }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'Tab') { var list = Array.from(d.querySelectorAll('button,input,select,a,summary')).filter(function (n) { return !n.disabled && n.getClientRects().length; }); var first = list[0], last = list[list.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-arena-close]')) close(); });
    document.addEventListener('keydown', key); document.body.appendChild(d); d.querySelector('[data-arena-close]').focus(); return d;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-arena-home]')) back();
    var source = e.target.closest('[data-sandbox-source]'); if (source) HSBATTLE.setSource(source.dataset.sandboxSource);
    if (source || e.target.closest('#sub-train, #sub-battle')) work.querySelector('[data-arena-config]').hidden = document.querySelector('.build').hidden;
    if (e.target.closest('[data-arena-config]')) { var build = document.querySelector('.build'); var d = modal('精灵与技能', '<div class="arena-config"></div>', function () { content.insertBefore(build, ct); }); d.querySelector('.arena-config').appendChild(build); }
    if (e.target.closest('[data-arena-rules]')) modal('S2 赛季规则与奖励', HSBATTLE.rankRules());
    if (e.target.closest('[data-arena-token]')) HSACC.openTokenShop();
  });
  // 公告由服务器记录已读，不与签到、续战或剧情弹窗叠加
  var noticeBusy = false, presented = {};
  function noticeKey() { return window.CLOUD && CLOUD.user() || HSACC.acc().created || 'local'; }
  function notice() {
    if (!window.HSACC || !HSACC.ready() || HSACC.acc().rankSeasonSeen === RANK_SEASON.id || noticeBusy || presented[noticeKey()] || HSACC.inBattle() || HSACC.resumePending() || document.visibilityState !== 'visible' || document.querySelector('.soc-dlg, #vn:not([hidden])')) return;
    noticeBusy = true; presented[noticeKey()] = true;
    modal('平衡排位 S2 赛季开启', '<p>全体玩家的段位与赛季战绩已重置为黑铁，S2 赛季现已开启</p><p>本赛季可使用目前全部' + RANK_ROSTER.length + '只有上色立绘的精灵</p><p>首次达到星耀段位可获得1张S2精灵兑换券，兑换精灵之后揭晓</p><p>小月亮与凶骨暂时绝版，已获得的精灵和旧赛季称号保留</p><button type="button" class="btn primary" data-season-ack>知道了</button><p class="hint" data-season-error></p>');
    var d = document.getElementById('arena-details'), ack = d.querySelector('[data-season-ack]');
    ack.addEventListener('click', function () { ack.disabled = true; HSACC.seasonNoticeAck(function () { d.querySelector('[data-arena-close]').click(); noticeBusy = false; }, function (err) { ack.disabled = false; d.querySelector('[data-season-error]').textContent = err || '请重试'; }); });
    new MutationObserver(function (rs, ob) { if (!d.isConnected) { noticeBusy = false; ob.disconnect(); } }).observe(document.body, { childList:true });
  }
  setInterval(notice, 2500);
  window.HSARENA = { open: open, home: back, current: function () { return current; } };
})();
