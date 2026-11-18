/* 对战视口与说明面板：只改变显示，不参与出招或战斗结算。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement;
  var battle = document.getElementById('battle'), arena = document.getElementById('pg-arena');
  var stats = document.getElementById('statsbox'), info = document.getElementById('battle-info-panel');
  var panels = { log: document.getElementById('battle-logbox'), stats: stats, info: info };
  var current = null, frame = 0, panelTrigger = null;
  var controls = [document.getElementById('btn-speed'), document.getElementById('battle-stats-toggle'), document.querySelector('#battle .emote-wrap'), document.getElementById('btn-invite'), document.getElementById('cmd-hint')].map(function (el) {
    var home = document.createComment('battle control position'); el.before(home);
    return { el: el, home: home };
  });
  function desktopLayout(on) {
    var changed = body.classList.contains('battle-desktop') !== on;
    flag('battle-desktop', on);
    controls.forEach(function (control, i) {
      var status = control.el.id === 'cmd-hint';
      var target = on ? (i === 0 ? battle.querySelector('.vs') : status ? panels.log : document.getElementById('battle-tools')) : control.home.parentNode;
      if (control.el.parentNode !== target) {
        if (on && status) target.insertBefore(control.el, document.getElementById('log'));
        else if (on) target.appendChild(control.el);
        else target.insertBefore(control.el, control.home.nextSibling);
      }
    });
    if (on && current === 'log') close(false);
    if (changed) document.dispatchEvent(new CustomEvent('battlelayoutchange'));
  }

  function flag(name, on) { if (body.classList.contains(name) !== on) body.classList.toggle(name, on); }
  function property(name, value) { if (body.style.getPropertyValue(name) !== value) body.style.setProperty(name, value); }
  function sync() {
    frame = 0;
    var active = !battle.hidden && !arena.hidden;
    flag('battle-active', active);
    if (!active) { desktopLayout(false); hideEffect(); close(false); return; }
    var z = parseFloat(body.style.zoom) || 1;
    var height = parseFloat(body.style.getPropertyValue('--game-view-height')) || (window.visualViewport ? visualViewport.height : root.clientHeight) / z;
    var width = parseFloat(body.style.width) || root.clientWidth / z;
    var scale = 1;
    property('--battle-view-height', height + 'px');
    property('--battle-view-width', width + 'px');
    property('--battle-font-scale', String(1 / scale));
    flag('battle-wide', width >= 640 && width / height >= 1.25);
    flag('battle-short', height < 560);
    flag('battle-tiny', height < 420);
    var coarse = matchMedia('(pointer: coarse)').matches;
    // 平板按屏幕短边识别，避免 Safari 工具栏压低可用高度后误判为手机。
    var tablet = (coarse || (navigator.maxTouchPoints || 0) > 0) && Math.min(screen.width, screen.height) >= 700;
    desktopLayout((width >= 760 && !coarse) || (tablet && width >= 700));
    var field = document.getElementById('field');
    property('--battle-toast-top', (field.offsetTop + 8) + 'px');
    property('--battle-toast-left', (field.offsetLeft + field.offsetWidth / 2) + 'px');
    property('--battle-toast-width', Math.max(0, field.offsetWidth - 16) + 'px');
    property('--battle-field-height', field.offsetHeight + 'px');
    document.getElementById('battle-stats-toggle').hidden = stats.hidden;
    positionEffect();
    if (current === 'stats' && stats.hidden) close(false);
    if (body.classList.contains('battle-touch') && !body.classList.contains('battle-desktop')) {
      var unit = 1 / scale;
      document.querySelectorAll('#mgrid .mv').forEach(function (move) {
        var detail = move.querySelector('.md'); if (!detail) return;
        var size = 11 * unit;
        detail.style.fontSize = size + 'px';
        while (size > 7.5 * unit && move.scrollHeight > move.clientHeight + 1) {
          size -= .5 * unit; detail.style.fontSize = size + 'px';
        }
      });
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  function close(focus) {
    var was = current, trigger = panelTrigger; panelTrigger = null;
    current = null;
    Object.keys(panels).forEach(function (key) {
      flag('battle-' + key + '-open', false);
      var button = document.getElementById('battle-' + key + '-toggle'); if (button) button.setAttribute('aria-expanded', 'false');
      if (key !== 'info') { panels[key].removeAttribute('role'); panels[key].removeAttribute('aria-modal'); }
    });
    info.hidden = true;
    if (focus && trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    else if (focus && was) (document.getElementById('battle-' + was + '-toggle') || document.getElementById('tab-moves')).focus();
  }
  function descriptions(selected) {
    var list = document.getElementById('battle-info-list'); list.textContent = '';
    info.querySelector('h3').textContent = selected ? '技能效果' : '技能与状态说明';
    info.setAttribute('aria-label', selected ? '技能效果' : '技能与状态说明');
    (selected ? [selected] : document.querySelectorAll('#mgrid .mv')).forEach(function (move) {
      var card = document.createElement('div'); card.className = 'battle-skill-info';
      HSSKILL.fill(move, card);
      list.appendChild(card);
    });
  }
  function open(key, selected) {
    hideEffect();
    if (current === key) { close(true); return; }
    close(false); current = key;
    panelTrigger = selected || null;
    if (key === 'info') { descriptions(selected); info.hidden = false; }
    panels[key].setAttribute('role', 'dialog'); panels[key].setAttribute('aria-modal', 'true');
    flag('battle-' + key + '-open', true);
    var button = document.getElementById('battle-' + key + '-toggle'); if (button) button.setAttribute('aria-expanded', 'true');
    panels[key].querySelector('[data-battle-close]').focus();
  }
  Object.keys(panels).forEach(function (key) {
    var button = document.getElementById('battle-' + key + '-toggle'); if (button) button.addEventListener('click', function () { open(key); });
  });
  document.getElementById('mgrid').addEventListener('skillinspect', function (e) {
    var move = e.target.closest('.mv');
    if (body.classList.contains('battle-desktop')) {
      close(false); hideEffect(); HSSKILL.showBubble(move, true);
    } else open('info', move);
  });
  var effectSource = null, effectPinned = false, effectTimer = 0;
  var effectPop = document.createElement('div');
  effectPop.id = 'battle-effect-popover'; effectPop.hidden = true; effectPop.setAttribute('role', 'tooltip');
  var effectContent = document.createElement('div'); effectContent.className = 'battle-effect-content'; effectPop.appendChild(effectContent);
  document.body.appendChild(effectPop);
  function effectAt(target) { var el = target.closest && target.closest('#battle .plate [tabindex="0"]'); return el && el.querySelector('.tip') ? el : null; }
  function hideEffect() {
    clearTimeout(effectTimer);
    if (effectSource) { effectSource.removeAttribute('aria-describedby'); if (effectSource.hasAttribute('aria-expanded')) effectSource.setAttribute('aria-expanded', 'false'); }
    effectSource = null; effectPinned = false; effectPop.hidden = true;
  }
  function positionEffect() {
    if (!effectSource) return;
    var tip = effectSource.querySelector('.tip'), r = effectSource.getBoundingClientRect(), area = effectSource.closest('.chips, .row1');
    var clip = area && area.getBoundingClientRect();
    if (!effectSource.isConnected || !tip || !r.width || (clip && (r.right <= clip.left || r.left >= clip.right || r.bottom <= clip.top || r.top >= clip.bottom))) { hideEffect(); return; }
    if (effectContent.innerHTML !== tip.innerHTML) effectContent.innerHTML = tip.innerHTML;
    var vv = window.visualViewport, left = 0, top = 0;
    var width = root.clientWidth, height = vv ? vv.height : root.clientHeight;
    effectPop.style.maxHeight = Math.max(40, height - 16) + 'px';
    var box = effectPop.getBoundingClientRect(), belowSpace = Math.max(0, top + height - 8 - r.bottom - 9), aboveSpace = Math.max(0, r.top - top - 17);
    var above = box.height > belowSpace && aboveSpace > belowSpace;
    effectPop.style.maxHeight = Math.max(32, above ? aboveSpace : belowSpace) + 'px';
    box = effectPop.getBoundingClientRect();
    var x = Math.max(left + 8, Math.min(r.left, left + width - box.width - 8));
    var y = above ? Math.max(top + 8, r.top - box.height - 9) : r.bottom + 9;
    effectPop.style.left = x + 'px'; effectPop.style.top = y + 'px';
    effectPop.style.setProperty('--effect-arrow-left', Math.max(12, Math.min(box.width - 12, r.left + r.width / 2 - x)) + 'px');
    effectPop.classList.toggle('above', above);
  }
  function showEffect(source, pinned) {
    if (current || !body.classList.contains('battle-active')) return;
    if (effectSource !== source) hideEffect();
    clearTimeout(effectTimer); effectSource = source; effectPinned = !!pinned;
    var tip = source.querySelector('.tip');
    effectPop.className = 'battle-effect-popover ' + (tip.classList.contains('tip-stat') ? 'tip-stat' : tip.classList.contains('tip-type') ? 'tip-type' : '');
    effectContent.innerHTML = tip.innerHTML;
    effectPop.style.left = '8px'; effectPop.style.top = '8px'; effectPop.hidden = false;
    source.setAttribute('aria-describedby', effectPop.id); if (source.hasAttribute('aria-expanded')) source.setAttribute('aria-expanded', 'true');
    positionEffect();
  }
  function dismissEffectLater() { if (!effectPinned) { clearTimeout(effectTimer); effectTimer = setTimeout(hideEffect, 140); } }
  battle.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var source = effectAt(e.target); if (source && !source.contains(e.relatedTarget)) showEffect(source, false);
  });
  battle.addEventListener('pointerout', function (e) {
    var source = effectAt(e.target); if (source && !source.contains(e.relatedTarget) && !effectPop.contains(e.relatedTarget)) dismissEffectLater();
  });
  battle.addEventListener('focusin', function (e) { var source = effectAt(e.target); if (source && source.matches(':focus-visible')) showEffect(source, false); });
  battle.addEventListener('focusout', function (e) { if (effectSource && effectSource.contains(e.target)) dismissEffectLater(); });
  effectPop.addEventListener('pointerenter', function () { clearTimeout(effectTimer); });
  effectPop.addEventListener('pointerleave', dismissEffectLater);
  document.addEventListener('pointerdown', function (e) { if (effectSource && !effectSource.contains(e.target) && !effectPop.contains(e.target)) hideEffect(); }, true);
  document.addEventListener('scroll', function (e) { if (effectSource && e.target.contains && e.target.contains(effectSource)) positionEffect(); }, true);
  function toggleEffect(source) { if (effectSource === source && effectPinned) hideEffect(); else showEffect(source, true); }

  battle.addEventListener('click', function (e) {
    if (e.target.closest('[data-battle-close]')) { close(true); return; }
    // 点在面板外只关闭面板，不让这次点击误选下方的技能。
    if (current && !panels[current].contains(e.target) && !e.target.closest('#battle-log-toggle, #battle-stats-toggle, [data-fullscreen]')) {
      e.preventDefault(); e.stopImmediatePropagation(); close(true); return;
    }
    var effect = effectAt(e.target);
    if (effect) { e.preventDefault(); e.stopImmediatePropagation(); toggleEffect(effect); }
  }, true);
  document.addEventListener('keydown', function (e) {
    var effect = !current && effectAt(e.target);
    if (effect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); toggleEffect(effect); return; }
    if (effectSource && e.key === 'Escape') { hideEffect(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!current) return;
    if (e.key === 'Escape') { close(true); e.stopImmediatePropagation(); return; }
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key === 'Tab') {
      var all = Array.prototype.filter.call(panels[current].querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]'), function (el) { return !el.disabled && el.getClientRects().length; });
      var first = all[0], last = all[all.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panels[current].contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panels[current].contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  }, true);
  var observer = new MutationObserver(schedule);
  [battle, arena, stats].forEach(function (el) { observer.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
  observer.observe(document.getElementById('mgrid'), { childList: true });
  observer.observe(battle.querySelector('.plates'), { childList: true, subtree: true, characterData: true });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  observer.observe(body, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  ['fullscreenchange', 'webkitfullscreenchange', 'orientationchange'].forEach(function (event) { window.addEventListener(event, schedule); });
  sync();
})();
