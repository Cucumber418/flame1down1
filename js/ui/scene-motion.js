/* 场景坐标以精灵脚底为准；地面轮廓描在原图上，再随 cover 裁切投影到屏幕 */
var SCENE_MOTION = (function () {
  'use strict';
  var floors = {
    fl_path: [[0,66],[40,58],[65,59],[100,73]], fl_beech: [[0,68],[50,60],[100,70]],
    fl_sun: [[0,66],[50,61],[100,68]], fl_maple: [[0,68],[50,61],[100,68]],
    fl_meadow: [[0,62],[100,62]], fl_lake: [[0,64],[100,63]], fl_horizon: [[0,70],[100,70]],
    fl_salt: [[0,50],[100,50]], fl_lab: [[0,73],[100,73]], fl_jungle: [[0,70],[100,70]],
    kb_dock: [[0,95],[25,91],[50,82],[75,72],[100,63]],
    kb_isle: [[0,76],[100,76]], kb_shore: [[0,75],[50,79],[100,92]],
    pp_lake: [[0,76],[100,76]], pp_slag: [[0,74],[100,74]],
    pp_fort: [[0,83],[100,83]], pp_core: [[0,83],[100,83]],
    wh_snow: [[0,61],[100,61]], wh_ice: [[0,73],[100,73]], wh_deep: [[0,76],[100,76]],
    hl_castle: [[0,76],[35,69],[65,69],[100,78]],
    hl_cabin: [[0,76],[100,76]], hl_shop: [[0,77],[100,77]], hl_wonderland: [[0,72],[40,69],[75,67],[100,73]],
    tea_p: [[0,79],[100,79]]
  };
  var water = ['kb_lookup','kb_shoal','kb_floor','kb_abyss','kb_temple','kb_dusk','kb_wave'];
  // 悬浮能力按形态登记，不把整个超能系或水系都当成会飞
  var hover = { hauris: true, faraday: true, moon: true, pluto: true, leigong: true,
    clementi: true, fate: true, phantom: true, frost: [0], leiming: [1], shroom: [2] };
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function key(bg) { return String(bg || '').replace(/_(mia|corrupt)$/, ''); }
  function flies(sid, stage) {
    var s = typeof SPMAP !== 'undefined' && SPMAP[sid], h = hover[sid];
    return !!((s && s.types && s.types.indexOf('飞行') >= 0) || h === true || (Array.isArray(h) && h.indexOf(stage | 0) >= 0));
  }
  function kind(sid, stage, bg) {
    var k = key(bg);
    if (water.indexOf(k) >= 0) return 'water';
    if (k === 'lt_field' || k === 'lt_jupiter') return 'space';
    return flies(sid, stage) ? 'air' : 'ground';
  }
  function lineY(points, x) {
    for (var i = 1; i < points.length; i++) if (x <= points[i][0]) {
      var a = points[i - 1], b = points[i]; return a[1] + (b[1] - a[1]) * clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
    }
    return points[points.length - 1][1];
  }
  function floor(bg, x, view) {
    var k = key(bg), points = floors[k] || [[0,74],[100,74]], nx = x, scaleY = 1;
    if (view && view.w > 0 && view.h > 0 && view.iw > 0 && view.ih > 0) {
      var scale = Math.max(view.w / view.iw, view.h / view.ih), sw = view.iw * scale;
      nx = (x / 100 * view.w + (sw - view.w) / 2) / sw * 100;
      scaleY = view.ih * scale / view.h;
    }
    if (view && view.flip) nx = 100 - nx;
    // 地面背景靠底对齐，保证横屏裁切后依然能看到地板
    return clamp(100 - (100 - lineY(points, nx)) * scaleY, 8, 95);
  }
  function position(sid, stage, bg, x, y, view) {
    x = clamp(x, 8, 92);
    var mode = kind(sid, stage, bg), top = mode === 'ground' ? Math.max(30, floor(bg, x, view) + 1) : 30;
    // 保留各出生槽位的纵深和移动幅度，不把地面精灵挤在同一条线上
    return { x: x, y: top + clamp((y - 42) / 50, 0, 1) * (97 - top), kind: mode };
  }
  return { flies: flies, kind: kind, floor: floor, position: position };
})();
