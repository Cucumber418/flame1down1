/* 仅在探索星图开启时锁定一屏；顶栏、全屏及设备旋转均重新测量。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement;
  var page = document.getElementById('pg-explore'), header = document.querySelector('.topbar');
  var frame = 0, was = false;
  function prop(key, value) { if (body.style.getPropertyValue(key) !== value) body.style.setProperty(key, value); }
  function sync() {
    frame = 0;
    var on = !page.hidden && !!page.querySelector('.star-map-page') && !body.classList.contains('battle-active');
    if (body.classList.contains('star-map-active') !== on) body.classList.toggle('star-map-active', on);
    if (!on) { was = false; return; }
    if (!was) HSVIEW.to(0, 0);
    was = true;
    var full = window.visualViewport ? visualViewport.height : root.clientHeight;
    prop('--star-full-height', full + 'px');
    var height = Math.max(0, full - HSVIEW.top(page) - 10);
    prop('--star-view-height', height + 'px');
    var map = page.querySelector('.mayar-planets');
    prop('--star-planet-max', Math.max(36, Math.min(112, map.clientHeight * .18)) + 'px');
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  var observer = new MutationObserver(schedule);
  observer.observe(page, { attributes: true, attributeFilter: ['hidden'], childList: true });
  observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] });
  observer.observe(header, { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(header);
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  sync();
})();
