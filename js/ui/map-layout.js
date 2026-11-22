/* 主页面共用顶栏以下的剩余视口；顶栏、全屏及设备旋转均重新测量。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement;
  var page = document.getElementById('pg-explore'), inventory = document.getElementById('pg-items'), social = document.getElementById('pg-social'), log = document.getElementById('pg-log'), christmas = document.getElementById('pg-christmas'), header = document.querySelector('.topbar');
  var frame = 0, was = false;
  function prop(key, value) { if (body.style.getPropertyValue(key) !== value) body.style.setProperty(key, value); }
  function sync() {
    frame = 0;
    var visitingEstate = !social.hidden && social.querySelector('.visit-farm-page, .visit-home-page');
    var star = page.querySelector('.star-map-page'), home = visitingEstate || page.querySelector('.home-page'), ship = page.querySelector('.ship-map-page'), planet = page.querySelector('.planet-map-page'), forge = page.querySelector('.forge-page');
    var arena = document.getElementById('pg-arena'), competitive = arena && !arena.hidden;
    var activity = !!christmas && !christmas.hidden;
    var items = !inventory.hidden, journal = !log.hidden, socialMain = !social.hidden && !visitingEstate, exploring = !page.hidden;
    var target = competitive ? arena : activity ? christmas : journal ? log : !social.hidden ? social : items ? inventory : page;
    var on = !body.classList.contains('no-acc') && (competitive || activity || journal || socialMain || items || !!visitingEstate || (exploring && !!(star || home || ship || planet || forge))) && !body.classList.contains('battle-active');
    flag('scene-page-active', on);
    flag('arena-page-active', on && competitive);
    flag('star-map-active', on && exploring && !!star);
    flag('home-page-active', on && (!!visitingEstate || exploring) && !!home);
    flag('ship-page-active', on && exploring && !!ship);
    flag('forge-page-active', on && exploring && !!forge);
    flag('storage-active', on && items);
    flag('planet-map-active', on && exploring && !!planet);
    flag('farm-page-active', on && (!!visitingEstate || exploring) && !!home && home.classList.contains('farm-page'));
    flag('christmas-page-active', on && activity);
    flag('log-page-active', on && journal);
    flag('social-page-active', on && socialMain);
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
    if (competitive || activity || journal || socialMain || exploring && !!forge) { flag('home-compact', false); flag('ship-paired', false); return; }
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
  if (christmas) observer.observe(christmas, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(document.getElementById('pg-arena'), { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(log, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] });
  observer.observe(header, { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(header);
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  sync();
})();
