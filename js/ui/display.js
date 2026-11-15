/* 可选全屏：只在玩家点击按钮时请求，不改变横屏偏好；根元素全屏保留 body 上的所有弹窗。 */
(function () {
  'use strict';
  var root = document.documentElement, buttons = document.querySelectorAll('#fullscreen-btn, [data-fullscreen]');
  var status = document.getElementById('display-status'), timer, busy = false;
  var enter = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen || root.mozRequestFullScreen || root.msRequestFullscreen;
  var leave = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;

  function active() { return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement); }
  function message(text) {
    if (!status) return;
    clearTimeout(timer); status.textContent = text; status.hidden = false;
    timer = setTimeout(function () { status.hidden = true; }, 6500);
  }
  function failed(exiting) {
    message(exiting ? '暂时无法退出全屏，请按 Esc 或使用浏览器的退出全屏按钮。' : '当前浏览器未能开启全屏。可使用浏览器菜单，电脑上也可按 F11。');
  }
  function sync() {
    var on = active(), label = on ? '退出全屏（也可按 Esc）' : '全屏显示游戏';
    root.classList.toggle('is-fullscreen', on);
    buttons.forEach(function (button) {
      button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', label); button.title = label;
      button.querySelector('b').textContent = on ? '退出全屏' : '全屏';
    });
  }
  function toggle() {
    if (busy) return;
    var exiting = active(), method = exiting ? leave : enter;
    if (!method) { failed(exiting); return; }
    busy = true;
    try {
      var result = method.call(exiting ? document : root);
      // 部分 Safari 版本没有返回 Promise，由 fullscreenchange 更新按钮。
      if (result && typeof result.then === 'function') {
        result.then(function () { busy = false; sync(); }, function () { busy = false; sync(); failed(exiting); });
      } else { busy = false; sync(); }
    } catch (e) { busy = false; sync(); failed(exiting); }
  }
  buttons.forEach(function (button) { button.addEventListener('click', toggle); });
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (name) {
    document.addEventListener(name, function () {
      busy = false; sync();
      if (status) status.hidden = true;
    });
  });
  ['fullscreenerror', 'webkitfullscreenerror', 'mozfullscreenerror', 'MSFullscreenError'].forEach(function (name) {
    document.addEventListener(name, function () { busy = false; sync(); failed(active()); });
  });
  window.addEventListener('resize', sync);
  window.HSDISPLAY = { isFullscreen: active, toggle: toggle, supported: function () { return !!enter; } };
  sync();
})();
