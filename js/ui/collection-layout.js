/* 仓库、放生、图鉴按剩余视口计算每页容量；旋转后保留原列表位置。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement, frame = 0, current = null;
  var pages = ['store', 'release', 'dex'].map(function (kind) { return document.getElementById('pg-' + kind); });
  function prop(key, value) { if (body.style.getPropertyValue(key) !== value) body.style.setProperty(key, value); }
  function sync() {
    frame = 0;
    var page = pages.find(function (el) { return !el.hidden; });
    var on = !!page && !body.classList.contains('no-acc') && !body.classList.contains('battle-active');
    if (body.classList.contains('collection-active') !== on) body.classList.toggle('collection-active', on);
    if (!on) { current = null; return; }
    if (current !== page) { HSVIEW.to(0, 0); current = page; }
    var full = window.visualViewport ? visualViewport.height : root.clientHeight;
    prop('--collection-full-height', full + 'px');
    prop('--collection-view-height', Math.max(0, full - HSVIEW.top(page) - 10) + 'px');
    var grid = page.querySelector('.collection-grid'); if (!grid || !window.HSACC) return;
    var cols = Math.max(1, Math.min(8, Math.floor((grid.clientWidth + 8) / (root.clientWidth <= 640 ? 100 : 132))));
    var rows = Math.max(1, Math.floor((grid.clientHeight + 8) / 150));
    prop('--collection-cols', String(cols)); prop('--collection-rows', String(rows));
    HSACC.layoutCollection(page.id.slice(3), cols, rows);
    var profile = page.querySelector('.store-profile-dialog'), box = profile && profile.querySelector('.store-profile-box');
    page.classList.toggle('profile-short', !!box && box.clientHeight < 590);
    page.classList.toggle('profile-wide', !!box && box.clientWidth >= 640 && box.clientWidth / box.clientHeight >= 1.2);
    if (box) {
      page.style.setProperty('--bag-view-height', box.clientHeight + 'px');
      if (window.HSBAGVIEW) HSBAGVIEW.fit(profile);
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  var observer = new MutationObserver(schedule);
  pages.forEach(function (page) { observer.observe(page, { attributes: true, attributeFilter: ['hidden'], childList: true }); });
  observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] });
  var header = document.querySelector('.topbar');
  observer.observe(header, { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(header);
  window.addEventListener('resize', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  window.HSCOLLECTION = { sync: schedule };
  sync();
})();
