/* 战斗技能长按查看；背包的长按交给排序，轻触仍可查看说明。 */
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
  window.addEventListener('resize', function () { cancel(true); sync(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', sync);
  var coarse = matchMedia('(pointer: coarse)');
  if (coarse.addEventListener) coarse.addEventListener('change', sync); else if (coarse.addListener) coarse.addListener(sync);
  window.HSSKILL = { touchUI: touchUI, fill: fill, inspect: inspect };
  sync();
})();
