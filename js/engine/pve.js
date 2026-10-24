/* ==========================================================
 * 单人对战（打电脑）由服务器结算：共用的规则（2026-10-24，第一个搬过来的是先驱之塔）
 *
 * 用服务器网址玩时，先驱之塔的对战由服务器开（对手、出招、电脑 AI、胜负都在服务器上算，见 server/pve.js），
 * 打完后服务器按这里的规则发奖励、推进塔的层数，写进存档；浏览器照服务器给的结果更新本机存档。
 * 双击本地 index.html 打开（没有服务器）时，game.js 在本机用同样的规则。
 *
 * 注意：随机数一律用传进来的 rand，不要直接用 Math.random()。
 * ========================================================== */
var PVE = (function () {
  'use strict';

  /* ---------- 先驱之塔 ---------- */
  var TOWER = { top: 60, cps: [1, 11, 21, 31, 41, 51], dayExp: 450000, dayTok: 5000, deathMax: 3 };   // 2026-10-21：每层经验 ×10、代币 ×5，每日经验上限 ×3
  var TW_POOL = ['leaf', 'squid', 'shroom', 'wind', 'mush', 'kaleo', 'faraday', 'firemouse', 'frost', 'gorgon', 'hephaestus', 'leigong', 'pede', 'siren', 'turkey', 'wild', 'tagore', 'leafcat', 'moon', 'bone', 'aegis'];
  var TW_FX = ['armor', 'regen', 'thorn', 'rage', 'swift', 'guard', 'noStatus', 'focus'];   // 只用塔里通用的特性
  function seeded(str) {   // 和 game.js 的 seeded 一样：同一个字符串永远得到同一串随机数
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = (h + 0x6D2B79F5) | 0; var t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function twLv(f) { return f >= TOWER.top ? 80 : 40 + Math.round((f - 1) * 40 / 58); }
  function twExp(f) { return 10 * (f >= TOWER.top ? 16000 : 400 + 20 * f); }
  function twTok(f) { return 5 * (f >= TOWER.top ? 232 : 2 + Math.floor(f / 10)); }
  // 第 f 层的对手（每一层固定，所有人一样）
  function twFloor(f) {
    if (f >= TOWER.top) return { boss: true, foes: [{ sid: 'pluto', lv: 80, hp: 10000, fx: { immortal: 1, solemn: 1, reaper: 1, ppLim: 1 } }] };
    var g = seeded('pioneer-tower:' + f), gate = f % 10 === 0, n = gate ? 1 : 1 + Math.floor(g() * 3), lv = twLv(f), used = {}, foes = [];
    for (var i = 0; i < n; i++) {
      var sid; do { sid = TW_POOL[Math.floor(g() * TW_POOL.length)]; } while (used[sid]); used[sid] = 1;
      var mult = gate ? 4 : n === 1 ? 3 : n === 2 ? 2 : 1.5, nfx = gate || f >= 30 ? 2 : 1, fx = {}, pick = {};
      while (Object.keys(pick).length < nfx) pick[TW_FX[Math.floor(g() * TW_FX.length)]] = 1;
      Object.keys(pick).forEach(function (k) { fx[k] = k === 'regen' ? 0.06 : 1; });
      foes.push({ sid: sid, lv: lv + (gate ? 2 : 0), hp: Math.round(calcStat(SPMAP[sid].base.hp, 'hp', lv) * mult), fx: fx });
    }
    return { gate: gate, foes: foes };
  }
  function twRec(acc, now) { return TX.twRec(acc, now); }

  /* ---------- 精灵资料 ---------- */
  var STAT6 = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  function shinyV(v) { return v === 2 ? 2 : !!v; }
  function stageOf(s, lv) { for (var i = evoLast(s); i > 0; i--) if (lv >= s.evo[i].lv) return i; return 0; }
  function shownStage(m, s) { var nat = stageOf(s, m.lv); return m.fs != null && m.fs >= 0 && m.fs < nat && (!m.u || (Array.isArray(m.fu) && m.fu.indexOf(m.fs) >= 0) || m.fu === undefined) ? m.fs | 0 : nat; }
  function form(m) {
    var s = SPMAP[m.sid], st = shownStage(m, s), n = formRawName(s, st);
    if (n && n.slice(-1) === '?') n = n.slice(0, -1);
    if (!n) n = s.name + '·' + stageLabel(s, st);
    var img = formImg(s, st), sk = isFin(s, st) ? s.id : s.id + '_s' + (st + 1);
    if (m.shiny && typeof SHINY_SPRITES !== 'undefined') { if (m.shiny === 2 && SHINY_SPRITES[sk + '_2']) img = SHINY_SPRITES[sk + '_2']; else if (SHINY_SPRITES[sk]) img = SHINY_SPRITES[sk]; }
    return { name: n, img: img };
  }
  function learnLv(i) { return i === 0 ? 1 : i * 5; }
  // 电脑精灵会的技能（不带 hl：LV50 起隐藏技能全部可用，和 game.js 的 avail(sid, lv) 一样）
  function availFoe(sid, lv) { var s = SPMAP[sid]; return s.moves.filter(function (n, i) { return lv >= learnLv(i); }).concat(s.hidden.filter(function () { return lv >= 50; })); }
  function defaultMovesFoe(sid, lv) {
    var s = SPMAP[sid], a = availFoe(sid, lv), out = s.def.filter(function (n) { return a.indexOf(n) >= 0; });
    a.forEach(function (n) { if (out.length < 4 && out.indexOf(n) < 0) out.push(n); });
    return out;
  }
  // 电脑精灵的技能表：以默认配招为底，60% 换掉 1 个、其中又有 40% 再换 1 个（和 game.js 的 foeMoves 一样）
  function foeMoves(sid, lv, rand) {
    var out = defaultMovesFoe(sid, lv), pool = availFoe(sid, lv).filter(function (n) { return out.indexOf(n) < 0; });
    var n = rand() < 0.6 ? (rand() < 0.4 ? 2 : 1) : 0;
    for (var k = 0; k < n && pool.length && out.length; k++) { var pi = Math.floor(rand() * pool.length); out[Math.floor(rand() * out.length)] = pool[pi]; pool.splice(pi, 1); }
    return out;
  }
  // 玩家自己的精灵（从存档读，和 game.js 的 storyMon 一样；没带技能时用这个等级已经学会的普通技能）
  function storyMon(acc, m) {
    var f = form(m), s = SPMAP[m.sid], mv = Array.isArray(m.moves) && m.moves.length ? m.moves.slice(0, 4) : null;
    if (!mv) { var learned = s.moves.filter(function (n, i) { return m.lv >= learnLv(i); }); mv = s.def.filter(function (n) { return learned.indexOf(n) >= 0; }); learned.forEach(function (n) { if (mv.length < 4 && mv.indexOf(n) < 0) mv.push(n); }); }
    var iv = m.iv && typeof m.iv === 'object' && STAT6.every(function (k) { return m.iv[k] >= 0 && m.iv[k] <= 31 && m.iv[k] === Math.floor(m.iv[k]); }) ? m.iv : null;
    return { id: m.sid, lv: m.lv, moves: mv, nick: f.name, img: f.img, ev: m.ev || null, nat: m.nat || null, iv: iv, u: m.u, hl: m.u != null ? (m.hl || []) : undefined, shiny: shinyV(m.shiny),
      emblem: m.u != null && acc.emblems && acc.emblems[m.sid] && EMBLEMS[m.sid] ? EMBLEMS[m.sid].m : null };
  }
  function monByU(acc, u) { for (var i = 0; i < acc.mons.length; i++) if (acc.mons[i] && acc.mons[i].u === u) return acc.mons[i]; return null; }

  /* ---------- 战斗经验（击败精灵获得；每天有上限） ---------- */
  var PVE_XP_CAP = 1000000;
  function foeExp(lv) { return Math.floor((lv * lv * 2 + 20) / 2); }
  function foeEv(lv) { return lv <= 25 ? 1 : lv <= 50 ? 2 : 3; }
  // 战斗经验的「今天」：和 game.js 的 dayStr 一样的格式，按北京时间
  function dayStr(now) { var d = new Date(now + 8 * 3600e3); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  // 算出这场战斗的经验怎么分：70% 平分给出战过的精灵（share），其余进经验背包（pool）
  function xpSplit(acc, teamUs, seen, downs, now) {
    downs = downs || [];
    var parts = teamUs.filter(function (u, i) { return seen && seen[i]; }); if (!parts.length) parts = teamUs.slice(0, 1);
    var xp = 0, ev = 0; downs.forEach(function (d) { xp += foeExp(d.lv); ev += foeEv(d.lv); });
    var d = dayStr(now); if (!acc.pveXp || acc.pveXp.d !== d) acc.pveXp = { d: d, n: 0 };
    var raw = xp; xp = Math.min(xp, Math.max(0, PVE_XP_CAP - acc.pveXp.n)); acc.pveXp.n += xp;
    var share = parts.length ? Math.floor(xp * 0.7 / parts.length) : 0, pool = xp - share * parts.length;
    return { n: downs.length, xp: xp, raw: raw, share: share, pool: pool, ev: downs.length ? ev : 0, parts: parts, pveXp: { d: acc.pveXp.d, n: acc.pveXp.n } };
  }

  /* ---------- 先驱之塔：开打、结算 ---------- */
  // 开一场先驱之塔：返回 { team: [u], p, a, F, f, opt }；err 表示不能开
  function towerStart(acc, pick, now, rand) {
    var T = twRec(acc, now), f = T.f, F = twFloor(f);
    var team = (acc.teams && acc.teams[acc.active | 0] || []).map(function (u) { return monByU(acc, u); }).filter(Boolean);
    if (!team.length) return { err: '出战配队里还没有精灵' };
    team = F.boss ? [monByU(acc, pick) && team.some(function (m) { return m.u === pick; }) ? monByU(acc, pick) : team[0]] : team.slice(0, 5);
    var p = team.map(function (m) { return storyMon(acc, m); });
    var a = F.foes.map(function (x) {
      var fm = form({ sid: x.sid, lv: x.lv });
      return { id: x.sid, lv: x.lv, moves: F.boss ? defaultMovesFoe(x.sid, x.lv) : foeMoves(x.sid, x.lv, rand), nick: (F.boss ? '死神 · ' : '') + fm.name, img: fm.img, maxhp: x.hp, boss: JSON.parse(JSON.stringify(x.fx)) };
    });
    return { team: team.map(function (m) { return m.u; }), p: p, a: a, F: F, f: f, opt: { foe: '先驱之塔', diff: F.boss ? '第 60 层 · 死神' : '第 ' + f + ' 层', bgm: F.boss ? 'boss3' : 'stage', back: '先驱之塔' } };
  }
  // 打完：推进层数、发奖励（直接改 acc），返回发生了什么（浏览器照着更新本机存档、显示消息）
  function towerEnd(acc, f, F, res, quit, teamUs, seen, downs, now) {
    var T = twRec(acc, now), out = { res: res, quit: !!quit, f: f, boss: !!F.boss, ge: 0, gt: 0, death: false, cp: false, back: false };
    if (res === 'win') {
      var ge = Math.min(twExp(f), Math.max(0, TOWER.dayExp - T.day.exp)), gt = Math.min(twTok(f), Math.max(0, TOWER.dayTok - T.day.tok));
      T.day.exp += ge; T.day.tok += gt; acc.exp = (acc.exp || 0) + ge; T.tok = (T.tok || 0) + gt; T.best = Math.max(T.best, f);
      out.ge = ge; out.gt = gt;
      if (F.boss) {
        T.clears++;
        if (T.death < TOWER.deathMax) { T.death++; if (!acc.items) acc.items = {}; acc.items.deathTok = (acc.items.deathTok || 0) + 1; out.death = true; }
        T.f = 1; T.cp = 1;
      } else { T.f = f + 1; if (TOWER.cps.indexOf(T.f) >= 0) { T.cp = T.f; out.cp = true; } }
    } else { T.f = T.cp; out.back = true; }
    var x = xpSplit(acc, teamUs, seen, downs, now);
    acc.exp = (acc.exp || 0) + x.pool;
    out.xp = x; out.T = JSON.parse(JSON.stringify(T));
    return out;
  }
  // 浏览器：照服务器结算的结果更新本机存档（经验背包、先驱代币、死神代币、塔的进度、今天的战斗经验）
  function towerApply(acc, end) {
    acc.tower = JSON.parse(JSON.stringify(end.T));
    acc.exp = (acc.exp || 0) + (end.ge || 0) + ((end.xp && end.xp.pool) || 0);
    if (end.death) { if (!acc.items) acc.items = {}; acc.items.deathTok = (acc.items.deathTok || 0) + 1; }
    if (end.xp && end.xp.pveXp) acc.pveXp = { d: end.xp.pveXp.d, n: end.xp.pveXp.n };
  }

  return { TOWER: TOWER, twLv: twLv, twExp: twExp, twTok: twTok, twFloor: twFloor, seeded: seeded, foeMoves: foeMoves, storyMon: storyMon,
    PVE_XP_CAP: PVE_XP_CAP, foeExp: foeExp, foeEv: foeEv, dayStr: dayStr, xpSplit: xpSplit, towerStart: towerStart, towerEnd: towerEnd, towerApply: towerApply };
})();
if (typeof module !== 'undefined') module.exports = PVE;
