/* 竞技大厅只展示阵容；精灵选择、技能、训练和赛事均使用弹出面板 */
(function () {
  'use strict';
  var builder = document.getElementById('builder'), bar = builder.querySelector('.modebar'), current = null, active = null;
  var $ = function (id) { return document.getElementById(id); }, esc = HSUI.esc;
  var home = document.createElement('section'); home.id = 'arena-home';
  home.innerHTML = '<header class="arena-welcome"><span class="step">飞船终端</span><h2>竞技对战</h2><p class="hint">选择一种作战方式</p></header>';
  builder.prepend(home); home.appendChild(bar); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', '选择作战模式');
  var contest = document.createElement('button'); contest.type = 'button'; contest.id = 'mode-contest'; contest.className = 'mode';
  contest.innerHTML = '<b>争霸赛</b><span>报名、抽签、赛程与积分榜</span>'; bar.appendChild(contest);
  var work = document.createElement('section'); work.id = 'arena-work'; work.hidden = true;
  work.innerHTML = '<header class="arena-mode-head"><button type="button" class="btn ghost" data-arena-home>‹ 竞技大厅</button><h2 id="arena-mode-title"></h2></header><div id="arena-scroll"></div>';
  var content = work.querySelector('#arena-scroll');
  Array.from(builder.children).forEach(function (n) { if (n !== home) content.appendChild(n); }); builder.appendChild(work);
  var panels = document.createElement('div'); panels.id = 'arena-panels'; panels.hidden = true; builder.appendChild(panels);
  ['draft','trainset','brawl'].forEach(function (id) { panels.appendChild($(id)); });
  var options = document.createElement('div'); options.id = 'arena-options'; content.insertBefore(options, content.querySelector('.bagbox')); options.appendChild($('subbar')); options.appendChild($('sandbox-source'));
  var prompt = document.createElement('div'); prompt.id = 'arena-draft-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<span class="arena-prompt-symbol">⚔</span><h3>选择本局阵容</h3><p class="hint">从两套阵容中选择一套出战</p><button type="button" class="btn primary" data-arena-draft>查看两套阵容</button>';
  $('bag').before(prompt);
  var tools = document.createElement('div'); tools.id = 'arena-team-tools';
  tools.innerHTML = '<button type="button" class="btn ghost" data-arena-training hidden>训练设置</button><button type="button" class="btn ghost" data-arena-training-mon hidden>切换精灵</button><button type="button" class="btn ghost" data-arena-backpack hidden>调整自己的背包</button>';
  $('bag').before(tools); $('btn-random').textContent = '随机阵容';
  var activity = document.createElement('section'); activity.id = 'arena-activity'; activity.hidden = true; content.appendChild(activity);
  function sync() {
    if (!current || current === 'contest' || current === 'brawl') return;
    var s = HSBATTLE.arenaState();
    builder.classList.toggle('arena-training', s.training); builder.classList.toggle('arena-own', s.own);
    prompt.hidden = !s.drafting; options.hidden = current !== 'sandbox';
    tools.querySelector('[data-arena-training]').hidden = !s.training;
    tools.querySelector('[data-arena-training-mon]').hidden = !s.training;
    tools.querySelector('[data-arena-backpack]').hidden = !s.own;
    tools.hidden = !s.training && !s.own;
  }
  function show(mode) {
    current = mode; home.hidden = true; work.hidden = false; builder.dataset.arenaMode = mode;
    $('arena-mode-title').textContent = { sandbox:'沙盒调试', rank:'平衡排位 · S2', brawl:'精灵大乱斗', contest:'争霸赛' }[mode];
    var event = mode === 'contest' || mode === 'brawl';
    Array.from(content.children).forEach(function (n) { n.classList.toggle('arena-event-hide', event && n !== activity); }); activity.hidden = !event;
    if (event) activity.innerHTML = '<div class="arena-event-symbol">' + (mode === 'contest' ? '🏆' : '⚔') + '</div><h3>' + (mode === 'contest' ? '精灵王争霸赛' : '精灵大乱斗') + '</h3><p class="hint">' + (mode === 'contest' ? '查看赛程、报名参赛与比赛积分' : '选择3只出战精灵，与在线船员匹配') + '</p><button type="button" class="btn primary" ' + (mode === 'contest' ? 'data-arena-contest' : 'data-arena-brawl') + '>' + (mode === 'contest' ? '赛程与报名' : '选择精灵与匹配') + '</button>';
    sync();
  }
  function back() { if (active) active.close(); current = null; home.hidden = false; work.hidden = true; activity.innerHTML = ''; delete builder.dataset.arenaMode; }
  ['sandbox','rank','brawl'].forEach(function (mode) { $('mode-' + mode).addEventListener('click', function () { if (mode !== 'brawl' || HSACC.brawlOpen()) show(mode); }); });
  contest.addEventListener('click', function () { show('contest'); });
  function open(mode) { if (mode === 'contest') show(mode); else $('mode-' + mode).click(); }
  function modal(title, html, onClose, kind) {
    if (active) active.close();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'arena-details';
    d.innerHTML = '<section class="soc-box arena-details' + (kind==='choose'||kind==='skills'?' arena-editor':'') + '" role="dialog" aria-modal="true" aria-labelledby="arena-details-title"><header><h2 id="arena-details-title">' + title + '</h2><button type="button" class="btn ghost" data-arena-close aria-label="关闭面板">×</button></header><div class="arena-details-body">' + html + '</div></section>';
    var prev = document.activeElement;
    function close() { if (!d.isConnected) return; if (onClose) onClose(); d.remove(); document.removeEventListener('keydown', key); if (active && active.el === d) active = null; if (prev && prev.isConnected) prev.focus({preventScroll:true}); }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } if (e.key === 'Tab') { var list = Array.from(d.querySelectorAll('button,input,select,a,summary')).filter(function (n) { return !n.disabled && n.getClientRects().length; }); var first=list[0],last=list[list.length-1]; if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); } } }
    d.addEventListener('click', function (e) { if (e.target===d || e.target.closest('[data-arena-close]')) close(); });
    document.addEventListener('keydown',key); document.body.appendChild(d); active={el:d,close:close,kind:kind}; d.querySelector('[data-arena-close]').focus(); return d;
  }
  function panel(id, title) {
    var node=$(id), d=modal(title, '<div class="arena-existing-panel"></div>', function () { panels.appendChild(node); if (id==='trainset') HSBATTLE.renderMode(); }, id);
    d.querySelector('.arena-existing-panel').appendChild(node);
  }
  function pager(page, pages, attr) { return '<nav class="arena-pager" aria-label="翻页"><button type="button" class="btn ghost" ' + attr + '="-1"' + (!page?' disabled':'') + '>‹ 上一页</button><span>' + (page+1) + ' / ' + pages + '</span><button type="button" class="btn ghost" ' + attr + '="1"' + (page+1>=pages?' disabled':'') + '>下一页 ›</button></nav>'; }
  function choose(index) {
    var s=HSBATTLE.arenaState(); if(s.mode!=='sandbox'||s.own)return;
    var page=0, query='', pool=SP.concat(EXTRA_SP), d=modal(s.training?'选择训练精灵':index>=0?'更换精灵':'添加精灵', '<div class="arena-picker"><label class="arena-search">搜索精灵<input type="search" data-arena-search placeholder="输入名称" autocomplete="off"></label><div class="arena-picker-grid"></div><div data-picker-pages></div><p class="arena-panel-message" role="status"></p></div>', null, 'choose');
    function draw() {
      var list=pool.filter(function(m){return !query||m.name.indexOf(query)>=0||(m.evo||[]).some(function(e){return (e.n||'').indexOf(query)>=0;});}), pages=Math.max(1,Math.ceil(list.length/6)); page=Math.max(0,Math.min(page,pages-1));
      d.querySelector('.arena-picker-grid').innerHTML=list.slice(page*6,page*6+6).map(function(m){var used=!s.training&&s.bag.indexOf(m.id)>=0&&s.bag[index]!==m.id;return '<button type="button" class="arena-pick-mon" data-arena-choose="'+m.id+'"'+(used?' disabled':'')+'><img src="'+SPRITES[m.id]+'" alt=""><b>'+esc(m.name)+'</b><small>'+esc(m.types.join(' / '))+(used?' · 已出战':'')+'</small></button>';}).join('')||( '<p class="hint">没有找到这只精灵</p>' );
      d.querySelector('[data-picker-pages]').innerHTML=pager(page,pages,'data-picker-page');
    }
    d.addEventListener('input',function(e){if(e.target.matches('[data-arena-search]')){query=e.target.value.trim();page=0;draw();}});
    d.addEventListener('click',function(e){var p=e.target.closest('[data-picker-page]');if(p&&!p.disabled){page+=+p.dataset.pickerPage;draw();}var b=e.target.closest('[data-arena-choose]');if(b&&!b.disabled){var r=HSBATTLE.arenaEdit('select',b.dataset.arenaChoose,index);if(r.ok)skills(b.dataset.arenaChoose);else d.querySelector('.arena-panel-message').textContent=r.msg;}});
    draw();
  }
  // 与精灵背包「更换技能」保持同一套勾选列表：名称、属性、威力、PP、效果均直接显示。
  function skills(id, own) {
    var sp = SPMAP[id]; if (!sp) return;
    var d = modal(esc(own ? ACC.form(own).name : sp.name) + ' · 更换技能',
      '<div class="arena-skills"></div>', null, 'skills');
    function loadout() { return own ? ACC.battleMon(HSACC.acc(), own).moves.slice() : HSBATTLE.loadout(id); }
    function draw(message) {
      var body = d.querySelector('.arena-skills'), oldList = body.querySelector('.arena-skill-list');
      var scroll = oldList ? oldList.scrollTop : 0;
      var lo = loadout(), state = HSBATTLE.arenaState(), inBag = state.bag.indexOf(id);
      var list = own ? sp.moves.concat(sp.hidden).filter(function (n) { return lo.indexOf(n) >= 0; }) : sp.moves.concat(sp.hidden);
      var rows = list.map(function (n) {
        var m = M[n]; if (!m) return '';
        var on = lo.indexOf(n) >= 0;
        var meta = m.cat + (m.power ? ' · 威力' + m.power : '') + (m.pri ? ' · 先制+' + m.pri : '') + ' · PP' + m.pp;
        return '<label class="mrow' + (on ? ' on' : '') + (m.hidden ? ' hid' : '') + '">' +
          '<input type="checkbox" data-arena-amove="' + esc(n) + '"' + (on ? ' checked' : '') +
          (own ? ' disabled' : '') + ' aria-label="' + esc(n) + '，' + (on ? '卸下' : '装备') + '技能">' +
          '<span class="l1"><span class="mn">' + esc(m.name) + '</span>' + HSUI.tchip(m.type) +
          '<span class="mm">' + esc(meta) + '</span>' + (m.hidden ? '<span class="tag sc hidtag">隐藏技能</span>' : '') + '</span>' +
          '<span class="md">' + esc(m.d || '') + '</span></label>';
      }).join('');
      body.innerHTML = '<div class="arena-skill-intro"><div class="moves-head"><h4>出战技能 <span class="' +
        (lo.length === 4 ? 'blue' : 'red') + '">' + lo.length + '/4</span></h4></div>' +
        '<p class="hint">' + (own ? '自己的精灵 · LV' + own.lv + '，请到精灵背包更换技能。' :
        '直接勾选已学习技能的模拟配置，最多装备4个；更改自动保存。') + '</p></div>' +
        '<div class="arena-skill-list mlist">' + (rows || '<p class="hint">暂无可用技能</p>') + '</div>' +
        '<p class="arena-panel-message" role="status">' + esc(message || '') + '</p>' +
        '<div class="arena-mon-actions">' +
        (!own && inBag > 0 && !state.training ? '<button type="button" class="btn ghost" data-mon-lead>设为首发</button>' : '') +
        (!own && state.mode === 'sandbox' ? '<button type="button" class="btn ghost" data-mon-replace>' +
          (state.training ? '切换精灵' : '更换精灵') + '</button>' +
          (!state.training && inBag >= 0 ? '<button type="button" class="btn ghost" data-mon-remove>移出阵容</button>' : '') : '') +
        '<button type="button" class="btn primary" data-arena-close>完成</button></div>';
      body.querySelector('.arena-skill-list').scrollTop = scroll;
    }
    d.addEventListener('change', function (e) {
      var input = e.target.closest('[data-arena-amove]');
      if (!input || own) return;
      var result = HSBATTLE.arenaEdit('move', id, input.dataset.arenaAmove);
      draw(result.ok ? '' : result.msg);
    });
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-mon-lead]')) { HSBATTLE.arenaEdit('lead', id); draw('已设为首发'); }
      if (e.target.closest('[data-mon-remove]')) { HSBATTLE.arenaEdit('remove', id); if (active) active.close(); }
      if (e.target.closest('[data-mon-replace]')) choose(HSBATTLE.arenaState().bag.indexOf(id));
    });
    draw();
  }
  document.addEventListener('click',function(e){
    if(e.target.closest('[data-arena-home]'))back();
    var source=e.target.closest('[data-sandbox-source]');if(source)HSBATTLE.setSource(source.dataset.sandboxSource);
    if(e.target.closest('[data-arena-add]'))choose(-1);
    if(e.target.closest('[data-arena-training-mon]'))choose(-1);
    if(e.target.closest('[data-arena-training]'))panel('trainset','训练设置');
    if(e.target.closest('[data-arena-draft]'))panel('draft','选择本局阵容');
    if(e.target.closest('[data-pick]')&&active&&active.kind==='draft')active.close();
    if(e.target.closest('[data-arena-backpack]'))HSACC.go('bag');
    var own=e.target.closest('[data-arena-own]');if(own){var m=HSACC.acc().mons.find(function(m){return String(m.u)===own.dataset.arenaOwn;});if(m)skills(m.sid,m);}
    if(e.target.closest('[data-arena-contest]'))modal('争霸赛 · 赛程与报名',HSACC.contestOpen()?HSACC.contestHTML():'<p class="hint">读完「降临芙罗拉」后开放争霸赛</p>');
    if(e.target.closest('[data-arena-brawl]'))panel('brawl','精灵大乱斗');
    if(e.target.closest('[data-arena-rules]'))modal('S2 赛季规则与奖励',HSBATTLE.rankRules());
    if(e.target.closest('[data-arena-token]'))HSACC.openTokenShop();
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
  new MutationObserver(function () { if (!$('battle').hidden && active) active.close(); }).observe($('battle'), { attributes:true, attributeFilter:['hidden'] });
  window.HSARENA = { open:open, home:back, current:function(){return current;}, sync:sync, skills:skills };
})();
