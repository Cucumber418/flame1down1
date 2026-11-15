/* 页面滚动统一入口：手机旋转横屏时，滚动容器是 .sheet，其他模式是窗口。 */
(function () {
  'use strict';
  function scroller() {
    return document.documentElement.classList.contains('land-rot') ? document.querySelector('.sheet') || window : window;
  }
  function y() {
    var s = scroller();
    return s === window ? (window.scrollY || 0) / zoom() : s.scrollTop;
  }
  function zoom() { return parseFloat(document.body.style.zoom) || 1; }
  function to(x, top) {
    var s = scroller(), z = s === window ? zoom() : 1;
    if (typeof x === 'object') {
      var opt = { behavior: x.behavior };
      if (x.top != null) opt.top = x.top * z;
      if (x.left != null) opt.left = x.left * z;
      s.scrollTo(opt);
    } else s.scrollTo(x * z, top * z);
  }
  function offset(el) {
    var n = 0;
    for (; el; el = el.offsetParent) n += el.offsetTop;
    return n;
  }
  function top(el) {
    var s = scroller();
    return s === window ? (el.getBoundingClientRect().top + (window.scrollY || 0)) / zoom() : offset(el) - offset(s);
  }
  window.HSVIEW = { scroller: scroller, y: y, to: to, top: top };
})();
