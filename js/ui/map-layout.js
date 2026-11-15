/* 星图与基地共用剩余视口；顶栏、全屏及设备旋转均重新测量。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement;
  var page = document.getElementById('pg-explore'), header = document.querySelector('.topbar');
  var frame = 0, was = false;
  function prop(key, value) { if (body.style.getPropertyValue(key) !== value) body.style.setProperty(key, value); }
  function sync() {
    frame = 0;
    var star = page.querySelector('.star-map-page'), home = page.querySelector('.home-page');
    var on = !page.hidden && !!(star || home) && !body.classList.contains('battle-active');
    flag('scene-page-active', on);
    flag('star-map-active', on && !!star);
    flag('home-page-active', on && !!home);
    if (!on || !home) flag('home-compact', false);
    if (!on) { was = false; return; }
    if (!was) HSVIEW.to(0, 0);
    was = true;
    var full = window.visualViewport ? visualViewport.height : root.clientHeight;
    prop('--scene-full-height', full + 'px');
    var height = Math.max(0, full - HSVIEW.top(page) - 10);
    prop('--scene-view-height', height + 'px');
    if (star) {
      var map = star.querySelector('.mayar-planets');
      prop('--star-planet-max', Math.max(36, Math.min(112, map.clientHeight * .18)) + 'px');
    } else {
      var stage = home.querySelector('.base-stage');
      var width = Math.max(0, Math.min(stage.clientWidth, stage.clientHeight * 1400 / 817));
      prop('--home-room-width', width + 'px');
      prop('--home-room-height', width * 817 / 1400 + 'px');
      flag('home-compact', width * 817 / 1400 < 330);
    }
  }
  function flag(key, on) { if (body.classList.contains(key) !== on) body.classList.toggle(key, on); }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  var observer = new MutationObserver(schedule);
  observer.observe(page, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] });
  observer.observe(header, { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(header);
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  sync();
})();
