/* 星图、飞船、基地和储存箱共用剩余视口；顶栏、全屏及设备旋转均重新测量。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement;
  var page = document.getElementById('pg-explore'), inventory = document.getElementById('pg-items'), social = document.getElementById('pg-social'), header = document.querySelector('.topbar');
  var frame = 0, was = false;
  function prop(key, value) { if (body.style.getPropertyValue(key) !== value) body.style.setProperty(key, value); }
  function sync() {
    frame = 0;
    var visitingEstate = !social.hidden && social.querySelector('.visit-farm-page, .visit-home-page');
    var star = page.querySelector('.star-map-page'), home = visitingEstate || page.querySelector('.home-page'), ship = page.querySelector('.ship-map-page'), planet = page.querySelector('.planet-map-page');
    var items = !inventory.hidden, target = items ? inventory : visitingEstate ? social : page;
    var on = !body.classList.contains('no-acc') && (items || !!visitingEstate || (!page.hidden && !!(star || home || ship || planet))) && !body.classList.contains('battle-active');
    flag('scene-page-active', on);
    flag('star-map-active', on && !items && !visitingEstate && !!star);
    flag('home-page-active', on && !items && !!home);
    flag('ship-page-active', on && !items && !visitingEstate && !!ship);
    flag('storage-active', on && items);
    flag('planet-map-active', on && !items && !visitingEstate && !!planet);
    flag('farm-page-active', on && !items && !!home && home.classList.contains('farm-page'));
    if (!on || items || !home) flag('home-compact', false);
    if (!on || items || visitingEstate || !ship) flag('ship-paired', false);
    if (!on) { was = false; return; }
    if (!was) HSVIEW.to(0, 0);
    was = true;
    var estate = window.HSESTATE && HSESTATE.dimensions();
    var full = estate ? estate.height : window.visualViewport ? visualViewport.height : root.clientHeight;
    prop('--scene-full-height', full + 'px');
    var height = estate ? full : Math.max(0, full - HSVIEW.top(target) - 10);
    prop('--scene-view-height', height + 'px');
    if (items) {
      var grid = inventory.querySelector('.ib-grid');
      if (grid && window.HSACC) {
        var minWidth = root.clientWidth <= 640 ? 104 : 124;
        HSACC.layoutItems(Math.max(1, Math.min(8, Math.floor((grid.clientWidth + 8) / (minWidth + 8)))), Math.max(1, Math.floor((grid.clientHeight + 8) / 96)));
      }
    } else if (planet && !visitingEstate) {
      prop('--planet-scene-height', planet.querySelector('.wf-scene').clientHeight + 'px');
    } else if (ship && !visitingEstate) {
      flag('ship-paired', height < 570);
    } else if (star && !visitingEstate) {
      var map = star.querySelector('.mayar-planets');
      prop('--star-planet-max', Math.max(36, Math.min(112, map.clientHeight * .18)) + 'px');
    } else {
      var stage = home.querySelector('.base-stage');
      var ratio = home.classList.contains('farm-page') ? 1192 / 697 : 1400 / 817;
      var width = Math.max(0, Math.min(stage.clientWidth, stage.clientHeight * ratio));
      prop('--home-room-width', width + 'px');
      prop('--home-room-height', width / ratio + 'px');
      flag('home-compact', width / ratio < 330);
    }
  }
  function flag(key, on) { if (body.classList.contains(key) !== on) body.classList.toggle(key, on); }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  var observer = new MutationObserver(schedule);
  observer.observe(page, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(inventory, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(social, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] });
  observer.observe(header, { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(header);
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  sync();
})();
