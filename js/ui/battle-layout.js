/* 对战视口与说明面板：只改变显示，不参与出招或战斗结算。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement;
  var battle = document.getElementById('battle'), arena = document.getElementById('pg-arena');
  var stats = document.getElementById('statsbox'), info = document.getElementById('battle-info-panel');
  var panels = { log: document.getElementById('battle-logbox'), stats: stats, info: info };
  var current = null, frame = 0;

  function flag(name, on) { if (body.classList.contains(name) !== on) body.classList.toggle(name, on); }
  function property(name, value) { if (body.style.getPropertyValue(name) !== value) body.style.setProperty(name, value); }
  function sync() {
    frame = 0;
    var active = !battle.hidden && !arena.hidden;
    flag('battle-active', active);
    if (!active) { close(false); return; }
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
    var field = document.getElementById('field');
    property('--battle-toast-top', (field.offsetTop + 8) + 'px');
    property('--battle-toast-left', (field.offsetLeft + field.offsetWidth / 2) + 'px');
    property('--battle-toast-width', Math.max(0, field.offsetWidth - 16) + 'px');
    property('--battle-field-height', field.offsetHeight + 'px');
    document.getElementById('battle-stats-toggle').hidden = stats.hidden;
    if (current === 'stats' && stats.hidden) close(false);
    if (body.classList.contains('battle-touch')) {
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
    var was = current;
    current = null;
    Object.keys(panels).forEach(function (key) {
      flag('battle-' + key + '-open', false);
      document.getElementById('battle-' + key + '-toggle').setAttribute('aria-expanded', 'false');
      if (key !== 'info') { panels[key].removeAttribute('role'); panels[key].removeAttribute('aria-modal'); }
    });
    info.hidden = true;
    if (focus && was) document.getElementById('battle-' + was + '-toggle').focus();
  }
  function text(tag, value, parent) {
    var node = document.createElement(tag); node.textContent = value; parent.appendChild(node); return node;
  }
  function descriptions(selected) {
    var list = document.getElementById('battle-info-list'); list.textContent = '';
    info.querySelector('h3').textContent = selected ? '技能效果' : '技能与状态说明';
    (selected ? [selected] : document.querySelectorAll('#mgrid .mv')).forEach(function (move) {
      var card = document.createElement('div'); card.className = 'battle-skill-info';
      HSSKILL.fill(move, card);
      list.appendChild(card);
    });
    if (!selected) document.querySelectorAll('#battle .plate').forEach(function (plate) {
      var card = document.createElement('div'); card.className = 'battle-status-info';
      text('h4', plate.querySelector('.pn').textContent + ' · 状态与特性', card);
      plate.querySelectorAll('.tip').forEach(function (tip) { text('p', tip.textContent, card); });
      list.appendChild(card);
    });
  }
  function open(key, selected) {
    if (current === key) { close(true); return; }
    close(false); current = key;
    if (key === 'info') { descriptions(selected); info.hidden = false; }
    panels[key].setAttribute('role', 'dialog'); panels[key].setAttribute('aria-modal', 'true');
    flag('battle-' + key + '-open', true);
    document.getElementById('battle-' + key + '-toggle').setAttribute('aria-expanded', 'true');
    panels[key].querySelector('[data-battle-close]').focus();
  }
  Object.keys(panels).forEach(function (key) {
    document.getElementById('battle-' + key + '-toggle').addEventListener('click', function () { open(key); });
  });
  document.getElementById('mgrid').addEventListener('skillinspect', function (e) { open('info', e.target.closest('.mv')); });
  battle.addEventListener('click', function (e) {
    if (e.target.closest('[data-battle-close]')) { close(true); return; }
    // 点在面板外只关闭面板，不让这次点击误选下方的技能。
    if (current && !panels[current].contains(e.target) && !e.target.closest('.battle-toolbar')) {
      e.preventDefault(); e.stopImmediatePropagation(); close(true);
    }
  }, true);
  document.addEventListener('keydown', function (e) {
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
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  observer.observe(body, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  ['fullscreenchange', 'webkitfullscreenchange', 'orientationchange'].forEach(function (event) { window.addEventListener(event, schedule); });
  sync();
})();
