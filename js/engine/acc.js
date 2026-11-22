/* ==========================================================
 * 账号的核心规则（2026-10-25）：服务器和浏览器共用
 *
 * 以前这些都写在 game.js 里，只有浏览器能用。为了让服务器结算单人对战、成长功能，把「改存档」的核心规则搬到这里：
 * 精灵实例（新建、形态、技能表）、经验与升级、学习力、图鉴记录、战斗经验的分配。
 * game.js 里同名的函数现在都只是转调这里（再加上存档、提示之类浏览器才有的事）。
 *
 * 约定：第一个参数 a 是账号存档对象；用到时间和随机数的函数从 env 里取（env = { now, rand }），不直接用 Date.now() / Math.random()，
 * 这样服务器可以记录、浏览器可以重放。
 * ========================================================== */
var ACC = (function () {
  'use strict';
  var TEAM_SIZE = 5, MAX_LV = 100, BASE_CAP = 70;
  var STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'], NAT_KEYS = Object.keys(NATURES);
  // 隐藏技能只能用道具解锁的种族（2026-10-18）
  var HL_GATED = { bali: 1, barlow: 1, clementi: 1, mush: 1, wind: 1, kaleo: 1, pede: 1, gorgon: 1, hephaestus: 1, firemouse: 1, leigong: 1, faraday: 1, frost: 1, tagore: 1, barren: 1, pluto: 1, leaf: 1, squid: 1, shroom: 1, moon: 1, bone: 1, siren: 1, leiming: 1, odo: 1, leafcat: 1, turkey: 1, hauris: 1, phantom: 1, leibniz: 1, tiago: 1 };
  function envOf(env) { return { now: env && env.now != null ? env.now : Date.now(), rand: env && env.rand ? env.rand : Math.random }; }

  /* ---------- 精灵实例 ---------- */
  function mon(a, u) { if (!a) return null; for (var i = 0; i < a.mons.length; i++) if (a.mons[i].u === u) return a.mons[i]; return null; }
  // 当前出战配队（精灵对象，最多 5 只；配队是空的就用第一只）
  function team(a) { var t = (a.teams[a.active | 0] || []).map(function (u) { return mon(a, u); }).filter(Boolean); if (!t.length) t = a.mons.slice(0, 1); return t.slice(0, TEAM_SIZE); }
  function stageOf(s, lv) { for (var i = evoLast(s); i > 0; i--) if (lv >= s.evo[i].lv) return i; return 0; }
  function shinyV(v) { return v === 2 ? 2 : !!v; }
  function shownStage(m) { var s = SPMAP[m.sid], nat = stageOf(s, m.lv); return m.fs != null && m.fs >= 0 && m.fs < nat && (!m.u || (Array.isArray(m.fu) && m.fu.indexOf(m.fs) >= 0) || m.fu === undefined) ? m.fs | 0 : nat; }
  function form(m) {
    var s = SPMAP[m.sid], st = shownStage(m), n = formRawName(s, st), unsure = false;
    if (n && n.slice(-1) === '?') { n = n.slice(0, -1); unsure = true; }
    if (!n) n = s.name + '·' + stageLabel(s, st);
    var img = formImg(s, st), sk = isFin(s, st) ? s.id : s.id + '_s' + (st + 1);
    if (m.shiny && typeof SHINY_SPRITES !== 'undefined') { if (m.shiny === 2 && SHINY_SPRITES[sk + '_2']) img = SHINY_SPRITES[sk + '_2']; else if (SHINY_SPRITES[sk]) img = SHINY_SPRITES[sk]; }
    return { name: m.renameUnlocked && m.nickname ? m.nickname : n, speciesName: n, img: img, stage: st, unsure: unsure, no: s.evo[st].no || '', d: s.evo[st].d || '', shiny: shinyV(m.shiny) };
  }
  function learnLv(i) { return i === 0 ? 1 : i * 5; }
  function hidOk(lv, hl, n) { return hl && LEARN[n] ? hl.indexOf(n) >= 0 && lv >= HIDDEN_MIN_LV : lv >= 50; }
  // 这一等级能用的技能。hl：这只精灵已解锁 / 领悟的隐藏技能；不传 hl（电脑的精灵）时 LV50 起隐藏技能全部可用
  function avail(sid, lv, hl) {
    var s = SPMAP[sid], gated = Array.isArray(hl) && HL_GATED[sid], sh = gated ? hl : null;
    return s.moves.filter(function (n, i) { return lv >= learnLv(i); }).concat(s.hidden.filter(function (n) { return gated ? sh.indexOf(n) >= 0 && lv >= HIDDEN_MIN_LV : hidOk(lv, hl, n); }));
  }
  function defaultMoves(sid, lv, hl) {
    var s = SPMAP[sid], av = avail(sid, lv, hl), out = s.def.filter(function (n) { return av.indexOf(n) >= 0; });
    av.forEach(function (n) { if (out.length < 4 && out.indexOf(n) < 0) out.push(n); });
    return out;
  }
  // 电脑精灵的技能表：以默认配招为底，60% 换掉 1 个、其中又有 40% 再换 1 个
  function foeMoves(sid, lv, hl, rand) {
    rand = rand || Math.random;
    var out = defaultMoves(sid, lv, hl), pool = avail(sid, lv, hl).filter(function (n) { return out.indexOf(n) < 0; });
    var n = rand() < 0.6 ? (rand() < 0.4 ? 2 : 1) : 0;
    for (var k = 0; k < n && pool.length && out.length; k++) { var pi = Math.floor(rand() * pool.length); out[Math.floor(rand() * out.length)] = pool[pi]; pool.splice(pi, 1); }
    return out;
  }
  function ivOk(iv) { return !!iv && typeof iv === 'object' && STAT_KEYS.every(function (k) { return iv[k] >= 0 && iv[k] <= 31 && iv[k] === Math.floor(iv[k]); }); }
  function ivOf(m) { return ivOk(m.iv) ? m.iv : null; }
  function randIv(rand) { var o = {}; STAT_KEYS.forEach(function (k) { o[k] = Math.floor(rand() * 32); }); return o; }
  function randNat(rand) { return NAT_KEYS[Math.floor(rand() * NAT_KEYS.length)]; }
  // 对战用的精灵（玩家自己的，或照玩家精灵格式写的对手）
  function battleMon(a, m) {
    var f = form(m), hl = m.u != null ? (m.hl || []) : undefined, mv = m.moves && m.moves.length ? m.moves.slice() : defaultMoves(m.sid, m.lv, hl);
    return { id: m.sid, lv: m.lv, moves: mv, nick: f.name, img: f.img, ev: m.ev || null, nat: m.nat || null, iv: ivOf(m), u: m.u, hl: hl, shiny: shinyV(m.shiny),
      emblem: m.u != null && a && a.emblems && a.emblems[m.sid] && EMBLEMS[m.sid] ? EMBLEMS[m.sid].m : null };
  }
  // 新得到一只精灵（放进仓库，返回它）
  function newMon(a, sid, lv, env) {
    env = envOf(env);
    var m = { u: a.next++, sid: sid, lv: lv, exp: expAt(lv), moves: defaultMoves(sid, lv, []), got: env.now, nat: randNat(env.rand), iv: randIv(env.rand), ev: {}, evFree: 0, hl: [] };
    a.mons.push(m); markForm(a, sid, stageOf(SPMAP[sid], lv)); return m;
  }
  // 得到一只精灵：出战配队没满就放进去。返回 { m, added }
  function giveMon(a, sid, lv, env, shiny) {
    var m = newMon(a, sid, lv, env), T = a.teams[a.active | 0], added = !!T && T.length < TEAM_SIZE;
    if (shiny) m.shiny = shinyV(shiny);
    if (added) T.push(m.u);
    return { m: m, added: added };
  }

  /* ---------- 图鉴 ---------- */
  // 返回 true 表示有新记录
  function markForm(a, sid, st) {
    if (!a.forms) a.forms = {};
    var f = a.forms[sid] || (a.forms[sid] = [0, 0, 0]);
    if (!f[st]) { f[st] = 1; return true; }
    return false;
  }
  function seeMon(a, sid, lv) {
    var s = SPMAP[sid]; if (!s || !a) return false;
    if (!a.seen) a.seen = {};
    var st = stageOf(s, lv || 1), ch = markForm(a, sid, st);
    if (a.seen[sid] === undefined || st > a.seen[sid]) { a.seen[sid] = st; ch = true; }
    return ch;
  }

  /* ---------- 经验与升级 ---------- */
  function expK(lv) { return lv < 25 ? 0.6 : lv >= 60 ? 16.8 : lv >= 50 ? 8 : 1; }
  var _expTab = null;
  function expTab() {
    if (!_expTab) { _expTab = [0, 1]; for (var l = 1; l < 100; l++) _expTab[l + 1] = _expTab[l] + Math.round(((l + 1) * (l + 1) * (l + 1) - l * l * l) * expK(l)); }
    return _expTab;
  }
  function expAt(lv) { lv = Math.max(1, Math.min(100, lv)); return expTab()[lv]; }
  function lvOf(exp) { var T = expTab(), lv = 1; while (lv < MAX_LV && T[lv + 1] <= exp) lv++; return lv; }
  function capLv(m) { return Math.min(MAX_LV, Math.max(m.lvCap || BASE_CAP, m.lv)); }
  /* 给精灵经验。fromPool：从经验背包里扣，否则是战斗直接获得。
   * 返回发生了什么（没加上返回 null）：{ u, amt, lv0, exp0, lv1, st0, st1, name0, name1, learned, equipped, hid }，浏览器拿去写提示 */
  function gainExp(a, m, amt, fromPool) {
    var room = expAt(capLv(m)) - m.exp; amt = Math.max(0, Math.min(amt, room, fromPool ? a.exp : Infinity)); if (!amt) return null;
    var f0 = form(m), out = { u: m.u, amt: amt, lv0: m.lv, exp0: m.exp, st0: f0.stage, name0: f0.name };
    markForm(a, m.sid, f0.stage);
    m.exp += amt; if (fromPool) a.exp -= amt; m.lv = lvOf(m.exp);
    var f1 = form(m); markForm(a, m.sid, f1.stage);
    out.lv1 = m.lv; out.st1 = f1.stage; out.name1 = f1.name;
    var was = avail(m.sid, out.lv0, m.hl || []), now = avail(m.sid, m.lv, m.hl || []).filter(function (n) { return was.indexOf(n) < 0; });
    out.learned = now.filter(function (n) { return !M[n].hidden; }); out.equipped = [];
    out.learned.forEach(function (n) { if (m.moves.length < 4 && m.moves.indexOf(n) < 0) { m.moves.push(n); out.equipped.push(n); } });
    out.hid = now.filter(function (n) { return M[n].hidden; });
    return out;
  }
  function evSum(m) { return STAT_KEYS.reduce(function (s, k) { return s + ((m.ev && m.ev[k]) || 0); }, 0); }
  // 出战过的精灵各得 n 点可分配学习力（总量不超过 750）。返回拿到的精灵编号
  function giveEv(a, units, n) {
    var got = []; n = n || 1;
    units.forEach(function (u) { var m = mon(a, u), room = m ? EV_TOTAL - evSum(m) - (m.evFree || 0) : 0; if (room > 0) { m.evFree = (m.evFree || 0) + Math.min(n, room); got.push(u); } });
    return got;
  }

  /* ---------- 战斗经验（击败精灵获得；每天有上限） ---------- */
  var PVE_XP_CAP = 1000000;
  function foeExp(lv) { return Math.floor((lv * lv * 2 + 20) / 2); }
  function foeEv(lv) { return lv <= 25 ? 1 : lv <= 50 ? 2 : 3; }
  function dayStr(now) { var d = new Date(now + 8 * 3600e3); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  /* 打完一场：70% 平分给出战过的精灵，其余进经验背包；出战过的精灵各得学习力。
   * teamUs：我方出战精灵的编号（按出场顺序，不算助战），seen：哪些出过场，downs：被击败的对手 [{ id, lv }]
   * 返回 { n, xp, raw, share, pool, ev, parts, gains: [gainExp 的结果], evGot: [编号] } */
  function battleXp(a, teamUs, seen, downs, env) {
    env = envOf(env); downs = downs || [];
    var out = { n: downs.length, xp: 0, raw: 0, share: 0, pool: 0, ev: 0, parts: [], gains: [], evGot: [], cap: PVE_XP_CAP };
    if (!downs.length) return out;
    var parts = teamUs.filter(function (u, i) { return seen && seen[i]; }); if (!parts.length) parts = teamUs.slice(0, 1);
    var xp = 0, ev = 0; downs.forEach(function (d) { xp += foeExp(d.lv); ev += foeEv(d.lv); });
    var d = dayStr(env.now); if (!a.pveXp || a.pveXp.d !== d) a.pveXp = { d: d, n: 0 };
    out.raw = xp; xp = Math.min(xp, Math.max(0, PVE_XP_CAP - a.pveXp.n)); a.pveXp.n += xp;
    var share = Math.floor(xp * 0.7 / parts.length), pool = xp - share * parts.length;
    out.xp = xp; out.share = share; out.pool = pool; out.ev = ev; out.parts = parts;
    if (xp > 0) {
      a.exp = (a.exp || 0) + pool;
      parts.forEach(function (u) { var m = mon(a, u), g = m && gainExp(a, m, share); if (g) out.gains.push(g); });
    }
    out.evGot = giveEv(a, parts, ev);
    return out;
  }

  /* ---------- 其他 ---------- */
  function prog(a, site) { if (!a.story) a.story = {}; if (!a.story[site]) a.story[site] = { at: 0, done: false, ch: null }; return a.story[site]; }
  function done(a, site) { return !!(a.story && a.story[site] && a.story[site].done); }
  function addItems(a, items) { if (!items) return; if (!a.items) a.items = {}; for (var k in items) if (items[k]) a.items[k] = (a.items[k] || 0) + items[k]; }
  function dayNum(t) { return Math.floor((t + 8 * 3600e3) / 86400000); }
  function thash(h) { var x = (h * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995) >>> 0; x ^= x >>> 15; return x >>> 0; }

  return { TEAM_SIZE: TEAM_SIZE, MAX_LV: MAX_LV, BASE_CAP: BASE_CAP, STAT_KEYS: STAT_KEYS, NAT_KEYS: NAT_KEYS, HL_GATED: HL_GATED, PVE_XP_CAP: PVE_XP_CAP,
    envOf: envOf, mon: mon, team: team, stageOf: stageOf, shinyV: shinyV, shownStage: shownStage, form: form, learnLv: learnLv, hidOk: hidOk, avail: avail,
    defaultMoves: defaultMoves, foeMoves: foeMoves, ivOk: ivOk, ivOf: ivOf, randIv: randIv, randNat: randNat, battleMon: battleMon, newMon: newMon, giveMon: giveMon,
    markForm: markForm, seeMon: seeMon, expK: expK, expTab: expTab, expAt: expAt, lvOf: lvOf, capLv: capLv, gainExp: gainExp, evSum: evSum, giveEv: giveEv,
    foeExp: foeExp, foeEv: foeEv, dayStr: dayStr, battleXp: battleXp, prog: prog, done: done, addItems: addItems, dayNum: dayNum, thash: thash };
})();
if (typeof module !== 'undefined') module.exports = ACC;
