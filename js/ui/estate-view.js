/* 手机竖屏下可把基地/种植园单独铺满横向画面，不改变系统方向设置。 */
(function () {
  'use strict';
  var body = document.body, root = document.documentElement, sheet = document.querySelector('.sheet');
  var explore = document.getElementById('pg-explore'), social = document.getElementById('pg-social');
  var active = false, frame = 0, oldY = 0, oldPage = '';
  var exit = document.createElement('button'); exit.type = 'button'; exit.id = 'estate-exit'; exit.className = 'scene-go'; exit.hidden = true;
  exit.innerHTML = '<span aria-hidden="true">↩</span><b>返回</b>'; exit.setAttribute('aria-label', '退出场景横屏'); sheet.appendChild(exit);
  function flag(k, on) { if (body.classList.contains(k) !== on) body.classList.toggle(k, on); }
  function prop(k, v) { if (body.style.getPropertyValue(k) !== v) body.style.setProperty(k, v); }
  function viewport() { return { width: window.visualViewport ? visualViewport.width : root.clientWidth, height: window.visualViewport ? visualViewport.height : root.clientHeight }; }
  function dimensions() { if (!active) return null; var v = viewport(); return { width: Math.max(v.width, v.height), height: Math.min(v.width, v.height) }; }
  function scene() {
    if (body.classList.contains('no-acc')) return null;
    var page = !explore.hidden ? explore : !social.hidden ? social : null; if (!page) return null;
    var stage = page.querySelector('.home-page > .base-stage');
    if (stage) return { frame: stage, page: page, visitHome: false };
    var room = page === social && page.querySelector('.home-room.base-room');
    return room ? { frame: room, page: page, visitHome: true } : null;
  }
  function leave(restore) {
    active = false; sync();
    var s = scene(), button = s && s.frame.querySelector('.estate-toggle'); if (button && !button.hidden) button.focus();
    if (restore && window.HSACC && HSACC.page() === oldPage) requestAnimationFrame(function () { HSVIEW.to(0, oldY); });
  }
  function sync() {
    frame = 0;
    var s = scene(), pending = window.HSSOCIAL && HSSOCIAL.estatePending && HSSOCIAL.estatePending();
    if (active && !s && !pending) active = false;
    var v = viewport(), rotated = active && v.width < v.height;
    flag('estate-landscape', active); flag('estate-rotated', rotated); flag('estate-visit-home', active && !!s && s.visitHome);
    if (exit.hidden !== !active) exit.hidden = !active;
    if (active) {
      var d = dimensions(); prop('--estate-width', d.width + 'px'); prop('--estate-height', d.height + 'px'); prop('--estate-physical-width', v.width + 'px');
      var w = Math.min(d.width, d.height * 1400 / 817);
      prop('--estate-visit-width', w + 'px'); prop('--estate-visit-height', w * 817 / 1400 + 'px');
    }
    if (s) {
      var b = s.frame.querySelector('.estate-toggle');
      if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.className = 'scene-go estate-toggle';
        b.innerHTML = '<span aria-hidden="true">↻</span><b>横屏</b>'; b.setAttribute('aria-label', '横屏显示整个基地或种植园'); b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { oldY = HSVIEW.y(); oldPage = HSACC.page(); active = true; HSVIEW.to(0, 0); sync(); exit.focus(); });
        s.frame.appendChild(b);
      }
      var hide = active || !(v.width < v.height && v.width <= 900 && (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches));
      if (b.hidden !== hide) b.hidden = hide;
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  exit.addEventListener('click', function () { leave(true); });
  document.addEventListener('keydown', function (e) { if (active && e.key === 'Escape' && !Array.prototype.some.call(document.querySelectorAll('.soc-dlg'), function (d) { return d.getClientRects().length > 0; })) { leave(true); e.preventDefault(); } });
  var observer = new MutationObserver(schedule);
  observer.observe(explore, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  observer.observe(social, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  observer.observe(body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', schedule); if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  window.HSESTATE = { dimensions: dimensions, active: function () { return active; } };
  sync();
})();
