/* ==========================================================
 * 手机横屏模式（2026-11-01）：右上角的「横屏」按钮。打开后按电脑界面的宽度排版（约 1180 像素宽，整体缩小显示）。
 *   手机竖着（或者锁定了竖屏）：把整个页面转 90 度显示（html.land-rot），把手机横过来拿着看；
 *   手机已经横过来了（开着自动旋转）：直接按电脑宽度排版。转动手机时自动切换。
 *   全屏另由 display.js 的按钮选择；进入、退出全屏后重新适配，不强制锁定手机方向。
 * 选择记在本机（hs-land），下次打开自动恢复。
 * ========================================================== */
(function () {
  'use strict';
  var W = 1180, meta = document.querySelector('meta[name="viewport"]'), META0 = meta ? meta.getAttribute('content') : '', on = false;
  var fitEpoch = 0, pendingScroll = null;
  function scrollY() { return window.HSVIEW ? window.HSVIEW.y() : window.scrollY || 0; }
  function restoreScroll(y) { if (window.HSVIEW) window.HSVIEW.to(0, y); else window.scrollTo(0, y); }
  function portrait() { return window.matchMedia ? matchMedia('(orientation: portrait)').matches : window.innerHeight > window.innerWidth; }   // 视口的长宽比不受 viewport 宽度设置影响
  function setMeta(w) { var content = w ? 'width=' + w + ', viewport-fit=cover' : META0; if (meta && meta.getAttribute('content') !== content) meta.setAttribute('content', content); }
  // 竖着拿、页面转 90 度：视口宽设成 ROT_VW（大于手机版样式的断点，保持电脑版样式），再用 zoom 把 W 宽的页面放大到正好铺满手机的长边
  var ROT_VW = 800;
  function rotFit() {
    if (!on || !document.documentElement.classList.contains('land-rot')) return;
    var de = document.documentElement, vw = de.clientWidth, vh = de.clientHeight, z = vh / W, bs = document.body.style;
    if (!(vw > 0 && vh > 0)) return;
    bs.zoom = z; bs.width = W + 'px'; bs.height = (vw / z) + 'px'; bs.transform = 'translateX(' + (vw / z) + 'px) rotate(90deg)';
    bs.setProperty('--game-view-height', (vw / z) + 'px');
  }
  function clearFit() { var bs = document.body.style; bs.zoom = ''; bs.width = ''; bs.height = ''; bs.transform = ''; bs.removeProperty('--game-view-height'); }
  function wideFit() {
    if (!on || document.documentElement.classList.contains('land-rot')) return;
    clearFit();
    var de = document.documentElement, z = de.clientWidth / W, bs = document.body.style;
    // 有些手机全屏后忽略 viewport width；这时仍让整个横屏界面适合实际宽度。
    if (z > 0 && z < .99) { bs.zoom = z; bs.width = W + 'px'; bs.setProperty('--game-view-height', (de.clientHeight / z) + 'px'); }
  }
  function layout() {
    if (!on) return;
    var rot = portrait(), wasRot = document.documentElement.classList.contains('land-rot'), epoch = ++fitEpoch;
    if (rot !== wasRot && pendingScroll === null) pendingScroll = scrollY();
    document.documentElement.classList.toggle('land-rot', rot);
    setMeta(rot ? ROT_VW : W);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (!on || epoch !== fitEpoch) return;
      if (rot) rotFit(); else wideFit();
      // 只有切换滚动容器时恢复位置，之后的 resize 不覆盖玩家的新滚动位置。
      if (pendingScroll !== null) { var y = pendingScroll; pendingScroll = null; restoreScroll(y); }
    }); });
  }
  function btn() { var b = document.getElementById('land-btn'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('b').textContent = on ? '竖屏' : '横屏'; b.title = on ? '退出横屏模式' : '横屏模式：和电脑界面一样'; b.setAttribute('aria-label', b.title); } }
  function enter(user) {
    pendingScroll = scrollY();
    on = true; document.documentElement.classList.add('land');
    try { localStorage.setItem('hs-land', '1'); } catch (e) {}
    layout(); setTimeout(layout, 600); btn();
  }
  function leave() {
    var y = pendingScroll !== null ? pendingScroll : scrollY(), epoch = ++fitEpoch;
    pendingScroll = null;
    on = false; document.documentElement.classList.remove('land', 'land-rot'); setMeta(null); clearFit();
    try { localStorage.removeItem('hs-land'); } catch (e) {}
    btn();
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (!on && epoch === fitEpoch) restoreScroll(y); }); });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#land-btn')) { if (on) leave(); else enter(true); } });
  var fitTimer;
  function scheduleFit() { clearTimeout(fitTimer); fitTimer = setTimeout(layout, 100); }
  window.addEventListener('resize', scheduleFit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 300); });
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (name) {
    document.addEventListener(name, function () { scheduleFit(); setTimeout(layout, 600); });
  });
  try { if (localStorage.getItem('hs-land') === '1') enter(false); } catch (e) {}
  btn();
})();
