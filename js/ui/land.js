/* 手机使用浏览器原生方向：无横屏开关、无方向锁，布局随可用视口适配。 */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body;
  try { localStorage.removeItem('hs-land'); } catch (e) {}
  root.classList.remove('land', 'land-rot', 'phone-portrait', 'phone-portrait-rot');
  var button = document.getElementById('land-btn'); if (button) button.remove();
  body.style.zoom = ''; body.style.width = ''; body.style.height = ''; body.style.transform = '';
  body.style.removeProperty('--game-view-height'); body.style.removeProperty('--game-view-width');
  // 释放旧版本在全屏中可能留下的原生方向锁。
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
})();
