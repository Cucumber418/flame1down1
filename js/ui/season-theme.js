/* 界面主题按设备保存；活动期间默认使用圣诞装饰 */
var HSSEASON = (function () {
  'use strict';
  var key='hs-christmas-theme',enabled=true;
  try{enabled=localStorage.getItem(key)!=='off';}catch(e){}
  function apply(){document.body.classList.toggle('christmas-theme',enabled);}
  function set(on){enabled=!!on;try{localStorage.setItem(key,enabled?'on':'off');}catch(e){}apply();}
  apply();
  return {on:function(){return enabled;},set:set};
})();
