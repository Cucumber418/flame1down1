/* ==========================================================
 * 各种一次性奖励的数额（2026-10-25）：服务器和浏览器共用
 *
 * 剧情、章节、称号、世界任务、每日任务、排位赛季段位奖励、野外采集……这些奖励还是由浏览器领取（申报），
 * 但服务器会用这里的表核对：编号不认识、或者数额比表里的多，都不认（server/claims.js）。
 * game.js 里这些奖励也从这里取，改数额只改这一个地方。
 * ========================================================== */
var RW = (function () {
  'use strict';
  var STORY = {"school": {"exp": 1000, "energy": 500, "items": {"g_core": 1}}, "river": {"exp": 1000, "energy": 500, "items": {"g_core": 1}}, "jiuquan": {"exp": 1000, "energy": 500, "items": {"g_core": 1}}, "board": {"exp": 1000, "energy": 500, "items": {"g_core": 1}}, "academy": {"exp": 0, "energy": 100}, "flora1": {"exp": 1000, "energy": 500, "items": {"g_core": 1}}, "flora2": {"exp": 1500, "energy": 600, "items": {"trans": 1, "g_core": 1}}, "flora3": {"exp": 2000, "energy": 800, "items": {"helmet": 1, "g_core": 1}}, "flora4": {"exp": 2000, "energy": 800, "items": {"g_core": 1}}, "flora5": {"exp": 2000, "energy": 800, "items": {"g_core": 1}}, "flora6": {"exp": 3000, "energy": 1200, "items": {"g_core": 1}}, "flora7": {"exp": 5000, "energy": 2000, "items": {"g_core": 1}}, "kb1": {"exp": 3000, "energy": 1200, "items": {"dive": 1, "g_core": 1}}, "kb2": {"exp": 3000, "energy": 1200, "items": {"g_core": 1}}, "kb3": {"exp": 3000, "energy": 1200, "items": {"g_core": 1}}, "mmTrial": {"items": {"mmTok": 500}}, "mingming": {"gift": [{"sid": "aegis", "lv": 10}]}, "fl_chal": {"energy": 300}, "hiddenSk": {"items": {"earthShard": 1000}}, "rare_r": {"title": "collector"}, "storage": {"exp": 0, "energy": 300, "items": {"cap1": 10}}, "core": {"energy": 300}, "plant": {"energy": 200, "items": {"s_herb": 2}}, "xiaogan": {"exp": 0, "energy": 200}, "kb4": {"exp": 3000, "energy": 1200, "items": {"g_core": 1}}, "kb5": {"exp": 3000, "energy": 1200, "items": {"g_core": 1}}, "kb6": {"exp": 3000, "energy": 1200, "items": {"g_core": 1}}, "kb7": {"exp": 5000, "energy": 2000, "items": {"g_core": 1}}, "kb8": {"exp": 8000, "energy": 3000, "items": {"g_core": 1}}};   // 剧情：读完一段的奖励
  var CHAPTER = {"prologue": {"exp": 5000, "items": {"grail": 1}}, "ch1": {"exp": 20000, "energy": 3000, "items": {"g_core": 10, "grail": 1}}, "ch2": {"exp": 20000, "energy": 3000, "items": {"g_core": 10, "grail": 1}}};   // 2026-11-01：第一、二章大奖各加 10 个圣晶石（第一章之前领过的补发）   // 主线章节大奖
  var QUEST = {"w_first": {"energy": 100}, "w_karo": {"items": {"cap1": 3}}, "w_mush": {"items": {"pot200": 2}}, "w_hunt": {"energy": 300}, "w_kaleo": {"energy": 500}, "w_travel": {"exp": 3000, "energy": 500}, "w_yado": {"exp": 5000, "energy": 1000}, "w_barren": {"exp": 10000, "energy": 2000, "items": {"g_core": 2}}, "w_dex": {"energy": 200}};   // 世界任务
  var DAILY = {"ar_play3": {"exp": 5000, "energy": 200}, "ar_rank2": {"exp": 5000, "energy": 240}, "ar_win1": {"exp": 5000, "energy": 300}, "ar_sand1": {"exp": 5000, "energy": 160}, "bw_1": {"exp": 5000, "energy": 300}, "bw_win1": {"exp": 5000, "energy": 360}, "wd_win5": {"exp": 5000, "energy": 240}, "wd_catch1": {"exp": 5000, "energy": 300}, "bs_1": {"exp": 5000, "energy": 200}, "hm_1": {"exp": 5000, "energy": 200}, "pve_2": {"exp": 5000, "energy": 200}};   // 每日任务（编号是「日期:任务」）
  var DAILY_ALL = { exp: 10000, items: { g_core: 2 } };
  var GATHER = {"forest": {"item": "g_sand", "n": 12}, "grass": {"item": "g_sand", "n": 12}, "kb_surf": {"item": "g_sand", "n": 12}, "kb_sea": {"item": "g_sand", "n": 12}, "kb_deep": {"item": "g_sand", "n": 12}, "pp_lava": {"item": "g_sand", "n": 12}, "pp_city": {"item": "g_sand", "n": 12}, "lt_belt": {"item": "g_sand", "n": 12}, "wh_snow": {"item": "g_sand", "n": 12}};   // 野外采集点（每个点每天 1 次）；丛林、草甸第一次采集还送药草种子 ×4
  var GEM_SPOT = { forest: 'floraJade', grass: 'floraJade', kb_surf: 'kbDrop', kb_sea: 'kbDrop', kb_deep: 'kbDrop', pp_lava: 'ppAsh', pp_city: 'ppAsh', lt_belt: 'ltOrb', wh_snow: 'whFrost' };   // 野外场景里每天刷新的特产（1~3 个）
  // 称号奖励：[累积经验, 能量, 功勋点]
  var TITLE_IDS = ['trainee', 'senior', 'elite', 'master', 'scholar', 'collector', 'rare5', 'rare15', 'purifier', 'force', 'guardian', 'odoClean', 'reaper', 'xcking', 'spa120', 'spa600', 'spa3000',
    'one25', 'one50', 'one75', 'one100', 'all25', 'all50', 'all75', 'all100', 's1king', 's1prince', 's1zone'];   // 最后几个是做题大王争霸赛的名次称号
  var TITLE_RW = {
    trainee: [1000, 200, 10], senior: [3000, 500, 30], elite: [8000, 1000, 60], master: [15000, 2000, 100], scholar: [30000, 5000, 200],
    collector: [2000, 300, 20], rare5: [8000, 1000, 60], rare15: [30000, 5000, 200], purifier: [5000, 800, 50], force: [10000, 1500, 80], guardian: [10000, 1500, 80], odoClean: [10000, 1500, 80],
    one25: [1000, 200, 10], one50: [3000, 400, 20], one75: [6000, 800, 40], one100: [10000, 1500, 80],
    all25: [3000, 400, 20], all50: [8000, 1000, 50], all75: [15000, 2000, 100], all100: [30000, 4000, 200]
  };
  var TYPE_RW = { 1: [1000, 200, 10], 3: [1000, 200, 10], 5: [8000, 1000, 50], 6: [3000, 500, 25], 10: [8000, 1000, 50], 15: [20000, 3000, 100] };
  // 称号的奖励（T 至少要有 id；属性称号还有 grp: 'type'、tier、need；赛季称号 season: true）
  function titleRw(T) {
    var r = TITLE_RW[T.id];
    if (!r && T.season) { var k = +T.id.split('-')[1]; r = [500 * k, 100 * k, 5 * k]; }
    if (!r && T.grp === 'type') r = T.tier === 'x' ? [15000, 2000, 80] : T.tier === 't' && T.need === 3 ? [3000, 500, 25] : T.tier === 't' && T.need === 5 ? [8000, 1000, 50] : T.tier === 't' && T.need === 10 ? [20000, 3000, 100] : TYPE_RW[T.need];
    r = r || [1000, 200, 10];
    return { exp: r[0], energy: r[1], merit: r[2] };
  }
  // 从称号编号还原出算奖励需要的信息；不认识的编号返回 null
  function titleOf(id) {
    if (TITLE_IDS.indexOf(id) >= 0) return { id: id };
    var m = /^S[12]-(\d+)$/.exec(id); if (m && +m[1] >= 1 && +m[1] < RANKS.length) return { id: id, season: true };
    m = /^ty([ctx])(\d+)-(.+)$/.exec(id);
    if (m && TYPE_COLOR[m[3]] && m[3] !== '无') { var need = +m[2], ok = { c: [3, 6, 10, 15], t: [1, 3, 5, 10], x: [5] }[m[1]]; if (ok.indexOf(need) >= 0) return { id: id, grp: 'type', tier: m[1], need: need }; }
    return null;
  }
  // 排位赛季（S1）首次达到每个段位的奖励
  var RANK_RW_OLD = [null, { exp: 500, energy: 200 }, { exp: 1000, energy: 300 }, { exp: 1500, energy: 400 }, { exp: 2000, energy: 500 },
    { exp: 2500, energy: 600 }, { exp: 3000, energy: 700 }, { exp: 3500, energy: 800 }, { exp: 4000, energy: 900 }, { exp: 4500, energy: 1000 }, { exp: 5000, energy: 1200 }];
  var RANK_ITEMS = { 2: { cap1: 5 }, 3: { cap1: 5 }, 5: { cap1: 5 }, 6: { cap1: 5 }, 7: { cap1: 5, evAny: 1 }, 8: { evAny: 1 }, 9: { evAny: 2 }, 10: { evAny: 3 } };
  var SEASON = RANK_SEASON.id;
  // 剧情对话里给的东西（剧本里写 give），编号是「剧情:编号」
  var SGIVE = {};
  if (typeof STORY_SCRIPT !== 'undefined') Object.keys(STORY_SCRIPT).forEach(function (site) { (STORY_SCRIPT[site] || []).forEach(function (st) { if (st && st.give && st.give.id) SGIVE[site + ':' + st.give.id] = st.give; }); });
  if (!SGIVE['jiuquan:bribe']) SGIVE['jiuquan:bribe'] = { id: 'bribe', energy: 1000 };
  function dayOk(d) { return /^\d{4}-\d{1,2}-\d{1,2}$/.test(d); }
  function only(o) { var r = { items: {} }; ['exp', 'energy', 'tokens', 'twTok', 'merit', 'meritXp'].forEach(function (k) { if (o && o[k]) r[k] = o[k]; }); if (o && o.items) for (var k in o.items) r.items[k] = o.items[k]; return r; }
  /* 核对申报用：这一条（来源 src、编号 id）最多能领多少。返回 { exp, energy, ..., items }；false 表示编号不认识；null 表示这种来源不核对数额 */
  function expect(src, id) {
    id = String(id == null ? '' : id); var p = id.split(':');
    if (src === 'story') return STORY[id] ? only(STORY[id]) : false;
    if (src === 'chapter') return CHAPTER[id] ? only(CHAPTER[id]) : false;
    if (src === 'quest') return QUEST[id] ? only(QUEST[id]) : false;
    if (src === 'sgive') return SGIVE[id] ? only(SGIVE[id]) : false;
    if (src === 'title') { var T = titleOf(id); if (!T) return false; var t = titleRw(T); return only({ exp: t.exp, energy: t.energy, merit: t.merit, meritXp: t.merit }); }
    if (src === 'daily') return p.length === 2 && dayOk(p[0]) && DAILY[p[1]] ? only(DAILY[p[1]]) : false;
    if (src === 'gather') { if (p.length !== 3 || !dayOk(p[0]) || !GATHER[p[1]] || !(p[2] === '0' || p[2] === '1')) return false; var it = {}; it[GATHER[p[1]].item] = GATHER[p[1]].n; if (p[1] === 'forest' || p[1] === 'grass') it.s_herb = 4; return only({ items: it }); }
    if (src === 'jade') { var rid = p.length === 4 ? p[1] : p[0]; if (!(p.length === 2 || (p.length === 4 && dayOk(p[0]))) || !GEM_SPOT[rid]) return false; var j = {}; j[GEM_SPOT[rid]] = 3; return only({ items: j }); }   // 「日期:区域:场景」（旧页面是「区域:场景」）
    if (src === 'hornDay') return dayOk(id) || /^\d+$/.test(id) ? only({ items: { m_hfhorn: 15 } }) : false;
    if (src === 'mine') { if (p.length !== 3 || !/^\d+$/.test(p[0])) return false; return only({ items: { m_cu: 3, m_fe: 3 } }); }
    if (src === 'rankRw') { var r = +p[1]; if (p[0] !== SEASON || !(r >= 1 && r < RANK_RW_OLD.length)) return false; var R = RANK_RW_OLD[r], items = Object.assign({}, RANK_ITEMS[r] || {}); if (r === 7) items.s2MonTicket = 1; return only({ exp: R.exp * 2, energy: R.energy * 2, items: items }); }
    if (src === 'mail') { var M0 = (typeof MAILS !== 'undefined' ? MAILS : []).filter(function (x) { return x.id === id; })[0]; if (!M0) return null; var a = M0.att || {}; return only({ exp: a.exp, energy: a.energy, tokens: a.tokens, twTok: a.twTok, merit: a.merit, meritXp: a.merit, items: a.items }); }
    return null;
  }
  return { STORY: STORY, CHAPTER: CHAPTER, QUEST: QUEST, DAILY: DAILY, DAILY_ALL: DAILY_ALL, GATHER: GATHER, GEM_SPOT: GEM_SPOT, TITLE_IDS: TITLE_IDS, TITLE_RW: TITLE_RW, TYPE_RW: TYPE_RW, titleRw: titleRw, titleOf: titleOf,
    RANK_RW_OLD: RANK_RW_OLD, RANK_ITEMS: RANK_ITEMS, SEASON: SEASON, SGIVE: SGIVE, expect: expect };
})();
if (typeof module !== 'undefined') module.exports = RW;
