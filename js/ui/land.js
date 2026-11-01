/* ==========================================================
 * 手机横屏模式（2026-11-01）：右上角的「横屏」按钮。打开后按电脑界面的宽度排版（约 1180 像素宽，整体缩小显示）。
 *   手机竖着（或者锁定了竖屏）：把整个页面转 90 度显示（html.land-rot），把手机横过来拿着看；
 *   手机已经横过来了（开着自动旋转）：直接按电脑宽度排版。转动手机时自动切换。
 *   （不用全屏 + 锁定方向：全屏时很多手机浏览器不认 viewport 的改动，排版会变回手机版）
 * 选择记在本机（hs-land），下次打开自动恢复。
 * ========================================================== */
(function () {
  'use strict';
  var W = 1180, meta = document.querySelector('meta[name="viewport"]'), META0 = meta ? meta.getAttribute('content') : '', on = false;
  function portrait() { return window.matchMedia ? matchMedia('(orientation: portrait)').matches : window.innerHeight > window.innerWidth; }   // 视口的长宽比不受 viewport 宽度设置影响
  function setMeta(w) { if (meta) meta.setAttribute('content', w ? 'width=' + w + ', viewport-fit=cover' : META0); }
  // 竖着拿、页面转 90 度：视口宽设成 ROT_VW（大于手机版样式的断点，保持电脑版样式），再用 zoom 把 W 宽的页面放大到正好铺满手机的长边
  var ROT_VW = 800;
  function rotFit() {
    var de = document.documentElement, vw = de.clientWidth, vh = de.clientHeight, z = vh / W, bs = document.body.style;
    bs.zoom = z; bs.width = W + 'px'; bs.height = (vw / z) + 'px'; bs.transform = 'translateX(' + (vw / z) + 'px) rotate(90deg)';
  }
  function clearFit() { var bs = document.body.style; bs.zoom = ''; bs.width = ''; bs.height = ''; bs.transform = ''; }
  function layout() {
    if (!on) return;
    var rot = portrait();
    document.documentElement.classList.toggle('land-rot', rot);
    setMeta(rot ? ROT_VW : W);
    if (rot) requestAnimationFrame(function () { requestAnimationFrame(rotFit); }); else clearFit();
  }
  function btn() { var b = document.getElementById('land-btn'); if (b) { b.classList.toggle('on', on); b.querySelector('b').textContent = on ? '竖屏' : '横屏'; b.title = on ? '退出横屏模式' : '横屏模式：和电脑界面一样'; } }
  function enter(user) {
    on = true; document.documentElement.classList.add('land');
    try { localStorage.setItem('hs-land', '1'); } catch (e) {}
    layout(); setTimeout(layout, 600); btn();
  }
  function leave() {
    on = false; document.documentElement.classList.remove('land', 'land-rot'); setMeta(null); clearFit();
    try { localStorage.removeItem('hs-land'); } catch (e) {}
    btn();
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#land-btn')) { if (on) leave(); else enter(true); } });
  window.addEventListener('resize', function () { setTimeout(layout, 100); });
  window.addEventListener('orientationchange', function () { setTimeout(layout, 300); });
  try { if (localStorage.getItem('hs-land') === '1') enter(false); } catch (e) {}
  btn();
})();
