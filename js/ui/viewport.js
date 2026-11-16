/* 使用浏览器原生视口滚动；横竖屏均不旋转或缩放页面。 */
(function () {
  'use strict';
  var root = document.documentElement, meta = document.querySelector('meta[name="viewport"]');
  var viewport = meta && meta.content, touch = matchMedia('(pointer: coarse)');
  // 手机固定页面倍率；单指滚动和游戏长按照常，仅拦截浏览器缩放手势。
  function syncZoom() {
    root.classList.toggle('mobile-no-zoom', touch.matches);
    if (meta) meta.content = viewport + (touch.matches ? ', minimum-scale=1, maximum-scale=1, user-scalable=no' : '');
  }
  function blockGesture(e) { if (touch.matches && e.cancelable) e.preventDefault(); }
  function blockPinch(e) { if (e.touches.length > 1) blockGesture(e); }
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(function (name) {
    document.addEventListener(name, blockGesture, { passive: false, capture: true });
  });
  ['touchstart', 'touchmove'].forEach(function (name) {
    document.addEventListener(name, blockPinch, { passive: false, capture: true });
  });
  if (touch.addEventListener) touch.addEventListener('change', syncZoom); else touch.addListener(syncZoom);
  syncZoom();
  function to(x, top) { if (typeof x === 'object') window.scrollTo(x); else window.scrollTo(x, top); }
  window.HSVIEW = {
    scroller: function () { return window; },
    y: function () { return window.scrollY || 0; },
    to: to,
    top: function (el) { return el.getBoundingClientRect().top + (window.scrollY || 0); }
  };
})();
