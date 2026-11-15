/* 手机固定竖屏：清除旧横屏选项；原生方向锁不可用时保持竖屏逻辑画布。 */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body, meta = document.querySelector('meta[name="viewport"]');
  var normal = 'width=device-width, initial-scale=1, viewport-fit=cover', frame = 0, locking = false;
  var phone = (navigator.maxTouchPoints || 0) > 0 && (matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/.test(navigator.userAgent)) && Math.min(screen.width || innerWidth, screen.height || innerHeight) <= 900;
  try { localStorage.removeItem('hs-land'); } catch (e) {}
  root.classList.remove('land', 'land-rot');
  function setMeta(value) { if (meta && meta.content !== value) meta.content = value; }
  function layout() {
    frame = 0;
    if (!phone) return;
    var v = window.visualViewport, k = v ? v.scale : 1;
    var width = v ? v.width * k : innerWidth, height = v ? v.height * k : innerHeight;
    var type = screen.orientation && screen.orientation.type;
    var angle = screen.orientation ? screen.orientation.angle : window.orientation;
    var landscape = type ? type.indexOf('landscape') === 0 : typeof angle === 'number' ? Math.abs(angle) % 180 === 90 : width > height;
    // 软键盘改变可见高度不代表手机转向，保留正在编辑的竖屏画布。
    var focused = document.activeElement;
    if (landscape && root.classList.contains('phone-portrait-rot') && focused && (focused.matches('input, textarea') || focused.isContentEditable)) return;
    var changed = root.classList.contains('phone-portrait-rot') !== landscape;
    var y = window.HSVIEW ? HSVIEW.y() : 0;
    root.classList.add('phone-portrait');
    root.classList.toggle('phone-portrait-rot', landscape);
    if (landscape) {
      var short = Math.round(height), long = Math.round(width);
      setMeta('width=' + short + ', viewport-fit=cover');
      var z = root.clientWidth / long;
      body.style.zoom = String(z); body.style.width = short + 'px'; body.style.height = long + 'px';
      body.style.transform = angle === 270 || angle === -90 ? 'translateY(' + short + 'px) rotate(-90deg)' : 'translateX(' + long + 'px) rotate(90deg)';
      body.style.setProperty('--game-view-height', long + 'px');
      body.style.setProperty('--game-view-width', short + 'px');
    } else {
      setMeta(normal); body.style.zoom = ''; body.style.width = ''; body.style.height = ''; body.style.transform = '';
      body.style.removeProperty('--game-view-height'); body.style.removeProperty('--game-view-width');
    }
    if (changed && window.HSVIEW) requestAnimationFrame(function () { HSVIEW.to(0, y); });
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(layout); }
  function lock() {
    if (!phone || locking || !screen.orientation || !screen.orientation.lock) return;
    locking = true;
    try { Promise.resolve(screen.orientation.lock('portrait-primary')).catch(function () {}).then(function () { locking = false; schedule(); }); }
    catch (e) { locking = false; }
  }
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if (window.visualViewport) visualViewport.addEventListener('resize', schedule);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', schedule);
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (name) { document.addEventListener(name, function () { lock(); schedule(); }); });
  layout(); lock();
})();
