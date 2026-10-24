/* ==========================================================
 * 联网对战的精灵资料（2026-10-24）
 *
 * 切磋、平衡模式、竞技征召、争霸赛、精灵大乱斗现在由服务器当裁判（server/pvp.js）：服务器用这里的函数把双方配队
 * 变成对战用的精灵，再用 battle.js 结算每一回合，浏览器只负责提交出招和播放。
 * 规则要和 game.js 里 HSACC.spec / balSpec / brawlSpec 保持一致（那三个是旧版「发起方结算」时用的）。
 * ========================================================== */
var PVP = (function () {
  'use strict';
  var STAT6 = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  var BAL_LV = 60, BRAWL_LV = 60;
  function shinyV(v) { return v === 2 ? 2 : !!v; }
  function stageOf(s, lv) { for (var i = evoLast(s); i > 0; i--) if (lv >= s.evo[i].lv) return i; return 0; }
  // 形态切换装置改过的外观（fs）只能比本来的形态小
  function shownStage(raw, s) { var nat = stageOf(s, raw.lv); return raw.fs != null && raw.fs >= 0 && raw.fs < nat ? raw.fs | 0 : nat; }
  // 显示用的名字和立绘（和 game.js 的 form 一样）
  function form(raw) {
    var s = SPMAP[raw.sid], st = shownStage(raw, s), n = formRawName(s, st);
    if (n && n.slice(-1) === '?') n = n.slice(0, -1);
    if (!n) n = s.name + '·' + stageLabel(s, st);
    var img = formImg(s, st), sk = isFin(s, st) ? s.id : s.id + '_s' + (st + 1);
    if (raw.shiny && typeof SHINY_SPRITES !== 'undefined') { if (raw.shiny === 2 && SHINY_SPRITES[sk + '_2']) img = SHINY_SPRITES[sk + '_2']; else if (SHINY_SPRITES[sk]) img = SHINY_SPRITES[sk]; }
    return { name: n, img: img };
  }
  function ownMoves(s) { return s.moves.concat(s.hidden); }
  function pickMoves(raw, s) { var own = ownMoves(s); return (Array.isArray(raw.moves) ? raw.moves : []).filter(function (n, i, a) { return typeof n === 'string' && M[n] && own.indexOf(n) >= 0 && a.indexOf(n) === i; }).slice(0, 4); }
  // 没带技能时的默认配招：默认配招里这个等级已经学会的普通技能，不够再补
  function fallback(s, lv) {
    var learned = s.moves.filter(function (n, i) { return lv >= (i === 0 ? 1 : i * 5); });
    var out = s.def.filter(function (n) { return learned.indexOf(n) >= 0; });
    learned.forEach(function (n) { if (out.length < 4 && out.indexOf(n) < 0) out.push(n); });
    return out.length ? out : s.def.slice(0, 4);
  }
  // 常规模式 / 争霸赛：按背包里的练度（服务器从存档里取的资料，逐项检查）
  function spec(raw) {
    var s = raw && SPMAP[raw.sid]; if (!s) return null;
    var lv = Math.max(1, Math.min(100, Math.round(+raw.lv || 1)));
    var mv = pickMoves(raw, s); if (!mv.length) mv = fallback(s, lv);
    var ev = {}; STAT6.forEach(function (k) { var v = raw.ev && +raw.ev[k]; if (v > 0) ev[k] = Math.min(300, Math.round(v)); });
    var iv = raw.iv && typeof raw.iv === 'object' && STAT6.every(function (k) { return raw.iv[k] >= 0 && raw.iv[k] <= 31 && raw.iv[k] === Math.floor(raw.iv[k]); }) ? STAT6.reduce(function (o, k) { o[k] = raw.iv[k]; return o; }, {}) : null;
    var f = form({ sid: raw.sid, lv: lv, shiny: shinyV(raw.shiny) });   // 和旧版一样：对战里不用形态切换装置改的外观
    return { id: raw.sid, lv: lv, moves: mv, nick: f.name, img: f.img, shiny: shinyV(raw.shiny), ev: ev, iv: iv,
      nat: raw.nat && NATURES[raw.nat] ? raw.nat : null, emblem: raw.emblem && EMBLEMS[raw.sid] ? EMBLEMS[raw.sid].m : null };
  }
  // 平衡模式：统一 LV60、性格无修正、没有学习力和纹章，技能从全部技能里自选
  function balSpec(raw) {
    var s = raw && SPMAP[raw.sid]; if (!s) return null;
    var mv = pickMoves(raw, s); if (!mv.length) mv = s.def.slice();
    var f = form({ sid: raw.sid, lv: BAL_LV });
    return { id: raw.sid, lv: BAL_LV, moves: mv, nick: f.name, img: f.img, ev: {}, nat: null };
  }
  // 精灵大乱斗：LV60，技能用技能表最后 4 个，性格由服务器随机
  function brawlSpec(raw) {
    var s = raw && SPMAP[raw.sid]; if (!s) return null;
    var all = ownMoves(s).filter(function (n, i, a) { return M[n] && a.indexOf(n) === i; });
    var f = form({ sid: raw.sid, lv: BRAWL_LV });
    return { id: raw.sid, lv: BRAWL_LV, moves: all.slice(-4), nick: f.name, img: f.img, ev: {}, nat: raw.nat && NATURES[raw.nat] ? raw.nat : null };
  }
  return { spec: spec, balSpec: balSpec, brawlSpec: brawlSpec };
})();
if (typeof module !== 'undefined') module.exports = PVP;
