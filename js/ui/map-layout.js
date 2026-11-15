/* 星图、飞船、基地和储存箱共用剩余视口；顶栏、全屏及设备旋转均重新测量。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement;
  var page = document.getElementById('pg-explore'), inventory = document.getElementById('pg-items'), header = document.querySelector('.topbar');
  var frame = 0, was = false;
  function prop(key, value) { if (body.style.getPropertyValue(key) !== value) body.style.setProperty(key, value); }
  function sync() {
    frame = 0;
    var star = page.querySelector('.star-map-page'), home = page.querySelector('.home-page'), ship = page.querySelector('.ship-map-page');
    var items = !inventory.hidden, target = items ? inventory : page;
    var on = !body.classList.contains('no-acc') && (items || (!page.hidden && !!(star || home || ship))) && !body.classList.contains('battle-active');
    flag('scene-page-active', on);
    flag('star-map-active', on && !items && !!star);
    flag('home-page-active', on && !items && !!home);
    flag('ship-page-active', on && !items && !!ship);
    flag('storage-active', on && items);
    if (!on || items || !home) flag('home-compact', false);
    if (!on || items || !ship) flag('ship-paired', false);
    if (!on) { was = false; return; }
    if (!was) HSVIEW.to(0, 0);
    was = true;
    var full = window.visualViewport ? visualViewport.height : root.clientHeight;
    prop('--scene-full-height', full + 'px');
    var height = Math.max(0, full - HSVIEW.top(target) - 10);
    prop('--scene-view-height', height + 'px');
    if (items) {
      var grid = inventory.querySelector('.ib-grid');
      if (grid && window.HSACC) {
        var minWidth = root.clientWidth <= 640 ? 104 : 124;
        HSACC.layoutItems(Math.max(1, Math.min(8, Math.floor((grid.clientWidth + 8) / (minWidth + 8)))), Math.max(1, Math.floor((grid.clientHeight + 8) / 96)));
      }
    } else if (ship) {
      flag('ship-paired', height < 570);
    } else if (star) {
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
  observer.observe(inventory, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] });
  observer.observe(header, { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(header);
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  sync();
})();
