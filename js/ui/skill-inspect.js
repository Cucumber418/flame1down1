/* 技能说明手势：轻触保留原操作，长按只查看；拖动、多指和取消不会出招。 */
(function () {
  'use strict';
  var press = null, swallow = false, pointers = {}, hover = null;
  function touchUI() {
    var v = window.visualViewport, s = v ? v.scale : 1;
    return matchMedia('(pointer: coarse)').matches || ((navigator.maxTouchPoints || 0) > 0 && Math.min((v ? v.width : innerWidth) * s, (v ? v.height : innerHeight) * s) <= 900);
  }
  function sync() { document.body.classList.toggle('battle-touch', touchUI()); hideHover(); }
  function card(target) { return target.closest && target.closest('#mgrid .mv, .bag-skill'); }
  function cancel(block) { if (press) { clearTimeout(press.timer); if (block) swallow = true; press = null; } }
  function inspect(el) { el.dispatchEvent(new CustomEvent('skillinspect', { bubbles: true })); }
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') { swallow = false; return; }
    pointers[e.pointerId] = true;
    if (Object.keys(pointers).length > 1 || !e.isPrimary) { cancel(true); return; }
    swallow = false; cancel(false);
    var el = card(e.target); if (!el || e.button > 0) return;
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
  document.addEventListener('contextmenu', function (e) { if (card(e.target) && touchUI()) e.preventDefault(); });
  window.addEventListener('blur', function () { cancel(true); pointers = {}; });
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
  function hideHover() { if (hover) { hover.remove(); hover = null; } }
  document.addEventListener('pointerover', function (e) {
    var el = card(e.target);
    if (!el || e.pointerType !== 'mouse' || touchUI() || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    hideHover(); hover = document.createElement('div'); hover.className = 'skill-hover'; hover.setAttribute('role', 'tooltip');
    hover.style.setProperty('--skill-color', el.style.getPropertyValue('--skill-color') || el.style.getPropertyValue('--tc'));
    if (el.hasAttribute('title')) { el.dataset.inspectTitle = el.title; el.removeAttribute('title'); }
    fill(el, hover); document.body.appendChild(hover);
    var r = el.getBoundingClientRect(), tip = hover.getBoundingClientRect();
    hover.style.left = Math.max(8, Math.min(innerWidth - tip.width - 8, r.left)) + 'px';
    hover.style.top = Math.max(8, r.bottom + tip.height + 8 <= innerHeight ? r.bottom + 8 : r.top - tip.height - 8) + 'px';
  });
  document.addEventListener('pointerout', function (e) { var el = card(e.target); if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) { hideHover(); if (el.dataset.inspectTitle != null) { el.title = el.dataset.inspectTitle; delete el.dataset.inspectTitle; } } });
  window.addEventListener('resize', function () { cancel(true); sync(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', sync);
  var coarse = matchMedia('(pointer: coarse)');
  if (coarse.addEventListener) coarse.addEventListener('change', sync); else if (coarse.addListener) coarse.addListener(sync);
  window.HSSKILL = { touchUI: touchUI, fill: fill, inspect: inspect };
  sync();
})();
