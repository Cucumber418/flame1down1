/* 使用浏览器原生视口滚动；横竖屏均不旋转或缩放页面。 */
(function () {
  'use strict';
  function to(x, top) { if (typeof x === 'object') window.scrollTo(x); else window.scrollTo(x, top); }
  window.HSVIEW = {
    scroller: function () { return window; },
    y: function () { return window.scrollY || 0; },
    to: to,
    top: function (el) { return el.getBoundingClientRect().top + (window.scrollY || 0); }
  };
})();
