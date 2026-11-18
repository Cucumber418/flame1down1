/* 电脑战斗技能悬停气泡；触屏长按查看，背包长按仍交给排序。 */
(function () {
  'use strict';
  var press = null, swallow = false, pointers = {};
  function touchUI() {
    var v = window.visualViewport, s = v ? v.scale : 1;
    return matchMedia('(pointer: coarse)').matches || ((navigator.maxTouchPoints || 0) > 0 && Math.min((v ? v.width : innerWidth) * s, (v ? v.height : innerHeight) * s) <= 900);
  }
  function sync() { document.body.classList.toggle('battle-touch', touchUI()); }
  function card(target) { return target.closest && !document.body.classList.contains('bag-skills-dragging') ? target.closest('#mgrid .mv, .bag-skill') : null; }
  function cancel(block) { if (press) { clearTimeout(press.timer); if (block) swallow = true; press = null; } }
  function inspect(el) { el.dispatchEvent(new CustomEvent('skillinspect', { bubbles: true })); }
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') { swallow = false; return; }
    pointers[e.pointerId] = true;
    if (Object.keys(pointers).length > 1 || !e.isPrimary) { cancel(true); return; }
    swallow = false; cancel(false);
    var el = card(e.target); if (!el || e.button > 0) return;
    if (el.closest('.bag-skill-grid')) return;   // 背包技能整张卡长按拿起，避免同时弹出说明。
    press = { el: el, id: e.pointerId, x: e.clientX, y: e.clientY };
    press.timer = setTimeout(function () {
      if (!press || press.el !== el || document.hidden) return;
      // 联网计时刷新会重建技能按钮，长按仍应跟随同一个技能。
      var live = el.isConnected ? el : el.dataset.mi != null ? document.querySelector('#mgrid [data-mi="' + el.dataset.mi + '"]') : null;
      if (!live || !live.getClientRects().length || live.querySelector('.mn').textContent !== el.querySelector('.mn').textContent) return;
      swallow = true; press.fired = true; inspect(live);
    }, 500);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!press || press.id !== e.pointerId || press.fired) return;
    var z = window.visualViewport ? visualViewport.scale : 1, dx = (e.clientX - press.x) * z, dy = (e.clientY - press.y) * z;
    if (dx * dx + dy * dy > 144) cancel(true);
  }, true);
  document.addEventListener('pointerup', function (e) { delete pointers[e.pointerId]; if (press && press.id === e.pointerId) cancel(false); }, true);
  document.addEventListener('pointercancel', function (e) { delete pointers[e.pointerId]; if (press && press.id === e.pointerId) cancel(true); }, true);
  document.addEventListener('click', function (e) {
    if (swallow && (e.detail > 0 || e.pointerType === 'touch' || e.pointerType === 'pen')) { e.preventDefault(); e.stopImmediatePropagation(); swallow = false; }
  }, true);
  document.addEventListener('contextmenu', function (e) { if ((card(e.target) || e.target.closest('.bag-skill-grid [data-bag-skill]')) && touchUI()) e.preventDefault(); });
  window.addEventListener('blur', function () { cancel(true); pointers = {}; });
  document.addEventListener('skillreorderstart', function () { cancel(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { cancel(true); pointers = {}; } });

  function fill(el, target) {
    target.textContent = '';
    ['.mn', '.pp', '.t2', '.md'].forEach(function (selector) {
      var node = el.querySelector(selector); if (!node) return;
      var line = document.createElement(selector === '.mn' ? 'h4' : 'p');
      if (selector === '.t2') { line.className = 'skill-info-meta'; line.appendChild(node.cloneNode(true)); }
      else line.textContent = node.textContent;
      target.appendChild(line);
    });
  }
  var grid = document.getElementById('mgrid'), source = null, hideTimer = 0, pinned = false;
  var bubble = document.createElement('div'); bubble.id = 'battle-skill-bubble'; bubble.className = 'skill-bubble';
  bubble.hidden = true; bubble.setAttribute('role', 'tooltip');
  var inner = document.createElement('div'); inner.className = 'skill-bubble-inner'; bubble.appendChild(inner); document.body.appendChild(bubble);
  function hoverCard(target) { return target.closest && target.closest('#mgrid .mv'); }
  function hoverAllowed() { return document.body.classList.contains('battle-desktop') && document.body.classList.contains('battle-active') && !grid.hidden; }
  function unlabel() { if (source) { var ids = (source.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== bubble.id; }); if (ids.length) source.setAttribute('aria-describedby', ids.join(' ')); else source.removeAttribute('aria-describedby'); } }
  function hideBubble() { clearTimeout(hideTimer); unlabel(); source = null; pinned = false; bubble.hidden = true; }
  function leaveBubble() { if (pinned) return; clearTimeout(hideTimer); hideTimer = setTimeout(hideBubble, 130); }
  function positionBubble() {
    if (!source || !source.isConnected || !hoverAllowed()) { hideBubble(); return; }
    var r = source.getBoundingClientRect(), w = document.documentElement.clientWidth, h = innerHeight;
    if (!r.width || !r.height) { hideBubble(); return; }
    bubble.style.maxHeight = '340px';
    var size = bubble.getBoundingClientRect(), above = r.top - 24, below = h - r.bottom - 24;
    var onTop = above >= size.height || above >= below;
    bubble.style.maxHeight = Math.max(60, Math.min(340, onTop ? above : below)) + 'px';
    size = bubble.getBoundingClientRect();
    var x = Math.max(12, Math.min(w - size.width - 12, r.left + r.width / 2 - size.width / 2));
    bubble.style.left = x + 'px'; bubble.style.top = Math.max(12, onTop ? r.top - size.height - 12 : r.bottom + 12) + 'px';
    bubble.style.setProperty('--skill-arrow-left', Math.max(18, Math.min(size.width - 18, r.left + r.width / 2 - x)) + 'px');
    bubble.classList.toggle('below', !onTop);
  }
  function showBubble(el, pin) {
    if (!el || !hoverAllowed()) return;
    clearTimeout(hideTimer); unlabel(); source = el; pinned = !!pin; inner.textContent = '';
    var head = document.createElement('div'); head.className = 'skill-bubble-head';
    var title = document.createElement('h4'), name = el.querySelector('.mn').cloneNode(true);
    name.querySelectorAll('.mv-blocked').forEach(function (n) { n.remove(); });
    title.className = 'skill-bubble-title'; title.textContent = name.textContent.replace(/^\d+\.\s*/, ''); head.appendChild(title);
    var pp = document.createElement('span'); pp.className = 'skill-bubble-pp'; pp.textContent = el.querySelector('.pp').textContent; head.appendChild(pp); inner.appendChild(head);
    var meta = document.createElement('div'); meta.className = 'skill-bubble-meta';
    el.querySelectorAll('.t2 > .tchip, .t2 > .mv-kind, .t2 > .mv-power').forEach(function (n) { meta.appendChild(n.cloneNode(true)); }); inner.appendChild(meta);
    var detail = document.createElement('p'); detail.className = 'skill-bubble-description'; detail.textContent = el.querySelector('.md').textContent; inner.appendChild(detail);
    var notes = Array.from(el.querySelectorAll('.mv-extra, .eff2, .eff0, .mv-blocked')).map(function (n) { return n.textContent.replace(/^\s*·\s*/, '').trim(); }).filter(Boolean);
    if (notes.length) { var note = document.createElement('p'); note.className = 'skill-bubble-note'; note.textContent = notes.join(' · '); inner.appendChild(note); }
    var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== bubble.id; }); ids.push(bubble.id); el.setAttribute('aria-describedby', ids.join(' '));
    bubble.hidden = false; positionBubble();
  }
  document.addEventListener('pointerover', function (e) { var el = hoverCard(e.target); if (e.pointerType === 'mouse' && el && !el.contains(e.relatedTarget)) showBubble(el); });
  document.addEventListener('pointerout', function (e) { var el = hoverCard(e.target); if (el && !el.contains(e.relatedTarget) && !bubble.contains(e.relatedTarget)) leaveBubble(); });
  grid.addEventListener('focusin', function (e) { var el = hoverCard(e.target); if (el && el.matches(':focus-visible')) showBubble(el); });
  grid.addEventListener('focusout', leaveBubble);
  bubble.addEventListener('pointerenter', function () { clearTimeout(hideTimer); }); bubble.addEventListener('pointerleave', leaveBubble);
  document.addEventListener('pointerdown', function (e) { if (!bubble.contains(e.target)) hideBubble(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bubble.hidden) { hideBubble(); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('blur', hideBubble); window.addEventListener('resize', hideBubble);
  document.addEventListener('visibilitychange', function () { if (document.hidden) hideBubble(); });
  new MutationObserver(function () {
    if (!source) return;
    if (!hoverAllowed()) { hideBubble(); return; }
    if (!source.isConnected) {
      var live = grid.querySelector('[data-mi="' + source.dataset.mi + '"]');
      if (live && live.querySelector('.mn').textContent === source.querySelector('.mn').textContent && (pinned || live.matches(':hover') || bubble.matches(':hover'))) showBubble(live, pinned);
      else hideBubble();
    } else positionBubble();
  }).observe(grid, { childList: true, attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(function () { if (!hoverAllowed()) hideBubble(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', function () { cancel(true); sync(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', sync);
  var coarse = matchMedia('(pointer: coarse)');
  if (coarse.addEventListener) coarse.addEventListener('change', sync); else if (coarse.addListener) coarse.addListener(sync);
  window.HSSKILL = { touchUI: touchUI, fill: fill, inspect: inspect, showBubble: showBubble };
  sync();
})();
