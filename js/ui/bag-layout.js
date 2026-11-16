/* 背包占用顶栏以下的画面；旋转横屏也按缩放前的逻辑尺寸计算。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement, bag = document.getElementById('pg-bag');
  var frame = 0, was = false;
  function prop(key, value) { if (body.style.getPropertyValue(key) !== value) body.style.setProperty(key, value); }
  function fitProfile(profile) {
    var touch = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    profile.querySelectorAll('.bag-skill .md').forEach(function (detail) {
      var card = detail.closest('.bag-skill'), size = touch ? 11 : 12, min = touch ? 7.5 : 9;
      detail.style.fontSize = size + 'px';
      while (size > min && card.scrollHeight > card.clientHeight + 1) {
        size -= .5; detail.style.fontSize = size + 'px';
      }
    });
  }
  function sync() {
    frame = 0;
    var on = !bag.hidden && !body.classList.contains('battle-active');
    if (body.classList.contains('bag-active') !== on) body.classList.toggle('bag-active', on);
    if (!on) { was = false; return; }
    if (!was) HSVIEW.to(0, 0); was = true;
    var z = parseFloat(body.style.zoom) || 1;
    var full = parseFloat(body.style.getPropertyValue('--game-view-height')) || (window.visualViewport ? visualViewport.height : root.clientHeight) / z;
    var scale = 1;
    prop('--bag-full-height', full + 'px');
    prop('--bag-font-scale', String(1 / scale));
    var height = Math.max(120, full - HSVIEW.top(bag) - 10);
    prop('--bag-view-height', height + 'px');
    var width = parseFloat(body.style.width) || root.clientWidth / z;
    var wide = width >= 640 && width / full >= 1.25;
    if (body.classList.contains('bag-wide') !== wide) body.classList.toggle('bag-wide', wide);
    var short = full < 650 || height < 400;
    if (body.classList.contains('bag-short') !== short) body.classList.toggle('bag-short', short);
    fitProfile(bag);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  var observer = new MutationObserver(schedule);
  observer.observe(bag, { attributes: true, attributeFilter: ['hidden'], childList: true });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] });
  observer.observe(document.querySelector('.topbar'), { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.querySelector('.topbar'));
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  window.HSBAGVIEW = { sync: schedule, fit: fitProfile };
  sync();
})();
