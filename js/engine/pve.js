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


  /* ==========================================================
   * 通用的服务器结算对战（2026-10-25）
   * MODES[kind] = {
   *   start(a, args, env) → { p, a, opt, ctx, S?, noItems? } 或 { err }：按存档和规则开一场（可以改存档，比如记挑战次数）
   *   end(a, ctx, B, env) → rep：打完后按规则发奖励、记战绩（直接改存档），返回发生了什么（浏览器拿去写提示）
   * }
   * B = { res, quit, seen, downs }。env = { now, rand }。服务器改完存档后把整份存档发回浏览器，浏览器直接换上（game.js 的 adoptAcc）。
   * ========================================================== */
  var MODES = {};
  MODES.tower = {
    start: function (a, args, env) {
      var st = towerStart(a, args.pick, env.now, env.rand); if (st.err) return { err: st.err };
      return { p: st.p, a: st.a, ctx: { f: st.f, F: st.F, team: st.team }, opt: st.opt };
    },
    end: function (a, c, B, env) {
      var T = twRec(a, env.now), f = c.f, F = c.F, rep = { res: B.res, quit: B.quit, f: f, boss: !!F.boss, ge: 0, gt: 0, death: false, cp: false };
      if (B.res === 'win') {
        var ge = Math.min(twExp(f), Math.max(0, TOWER.dayExp - T.day.exp)), gt = Math.min(twTok(f), Math.max(0, TOWER.dayTok - T.day.tok));
        T.day.exp += ge; T.day.tok += gt; a.exp = (a.exp || 0) + ge; T.tok = (T.tok || 0) + gt; T.best = Math.max(T.best, f);
        rep.ge = ge; rep.gt = gt;
        if (F.boss) {
          T.clears++;
          if (T.death < TOWER.deathMax) { T.death++; if (!a.items) a.items = {}; a.items.deathTok = (a.items.deathTok || 0) + 1; rep.death = true; }
          T.f = 1; T.cp = 1;
        } else { T.f = f + 1; if (TOWER.cps.indexOf(T.f) >= 0) { T.cp = T.f; rep.cp = true; } }
      } else T.f = T.cp;
      rep.xp = ACC.battleXp(a, c.team, B.seen, B.downs, env);
      rep.T = JSON.parse(JSON.stringify(T));
      return rep;
    }
  };
  function done(a, id) { return ACC.done(a, id); }
  function chalStars(a, id) { var r = a && a.chal && a.chal[id]; return r && Array.isArray(r.s) ? r.s.filter(Boolean).length : 0; }
  function myTeam(a) { var t = ACC.team(a); return { us: t.map(function (m) { return m.u; }), p: t.map(function (m) { return ACC.battleMon(a, m); }) }; }
  // 自选出战（2026-10-27，每周挑战、明明教官的试炼）：args.line = [精灵编号, 或 'h' 表示助战]，按顺序出场；助战由服务器查好放在 args._helper。没有 line 时用当前配队
  function lineTeam(a, args) {
    if (!args || !Array.isArray(args.line)) { var T0 = myTeam(a); return { p: T0.p, us: T0.us, slots: T0.us.slice() }; }
    var team = (a.teams[a.active | 0] || []).filter(function (u) { return ACC.mon(a, u); }), Hp = args._helper || null, used = {}, slots = [];
    args.line.forEach(function (v) {
      if (v === 'h') { if (Hp && !used.h) { used.h = 1; slots.push(null); } return; }
      var u = +v; if (team.indexOf(u) >= 0 && !used[u]) { used[u] = 1; slots.push(u); }
    });
    var own = slots.filter(function (u) { return u != null; });
    if (!own.length) return { err: '至少要带一只自己的精灵' };
    if (own.length + (used.h ? 1 : 0) > 5) return { err: '出战精灵太多了' };
    return { p: slots.map(function (u) { return u == null ? helperSpec(Hp) : ACC.battleMon(a, ACC.mon(a, u)); }), us: own, slots: slots };
  }
  // 经验只给自己的精灵（助战不拿）
  function lineXp(a, c, B, env) {
    if (!c.slots) return ACC.battleXp(a, c.team, B.seen, B.downs, env);
    var us = c.slots.filter(function (u) { return u != null; }), seen = c.slots.map(function (u, k) { return u != null ? !!(B.seen && B.seen[k]) : null; }).filter(function (v) { return v !== null; });
    return ACC.battleXp(a, us, seen, B.downs, env);
  }

  /* ---------- BOSS、每周挑战、属性每周挑战 ----------
   * lv：各档难度，按顺序解锁（open(a, now) 返回是否开放）。boss 是BOSS的特殊能力，规则写在 battle.js 的 BOSS_FX 里。
   * 战绩存在 a.bosses[记录名]：简单难度沿用BOSS id（兼容旧存档），其他难度是「id:序号」，每周挑战是「id:w」 */
  var ONLY3 = ['水', '火', '草'];
  var BOSSES = {
    tiger: { name: '泰戈尔', sid: 'tagore', dept: '襄阳', bg: 'bridge_p', pos: [66, 52],
      d: '从东北招募的特殊虎系精灵，常驻古城防卫部，辅助船员们训练。',
      lv: [
        { diff: '简单', lv: 25, hp: 500, only: ONLY3, bgm: 'boss', open: function (a, now) { return done(a, 'tiger'); }, lockText: '读完支线「东北来的泰戈尔」后开放', reward: { mon: { sid: 'tagore', lv: 10 } } },
        { diff: '普通', lv: 40, hp: 1500, only: ONLY3, boss: { feud: 1, ne: 1, pp: 99 }, bgm: 'boss2', open: function (a, now) { return done(a, 'tiger2'); }, lockText: '击败简单难度，再听泰戈尔介绍后开放', reward: { emblem: 'tagore', exp: 20000 } },
        { diff: '困难', lv: 60, hp: 5000, only: ONLY3, boss: { feud: 1, ne: 1, past: 1, pp: 99 }, bgm: 'boss3', open: function (a, now) { return bossWon(a, 'tiger', 1); }, lockText: '击败普通难度后开放', reward: { title: 'force', items: { tgPearl: 80, natTagore: 3 }, exp: 50000 } }
      ] },
    barren: { name: '荒芜', sid: 'barren', planet: 'flora', region: 'salt', bg: 'fl_salt',
      d: '潜伏在芙罗拉星盐碱地地底的草系BOSS。盐碱地里的瘴气，就是从它身上散出来的。',
      lv: [
        { diff: '简单', lv: 40, hp: 1000, boss: { dr: 0.15, mia: 1, pp: 99 }, bgm: 'boss3', open: function (a, now) { return done(a, 'flora1') && (chalStars(a, 'fl5') > 0 || bossWon(a, 'barren', 0)); }, lockText: '通过芙罗拉星挑战第五关「猎手的领地」后开放', reward: { mon: { sid: 'barren', lv: 10 } } },
        { diff: '普通', lv: 65, hp: 3000, boss: { dr: 0.15, mia: 1, puppet: 1, pp: 99 }, bgm: 'boss3', open: function (a, now) { return bossWon(a, 'barren', 0); }, lockText: '击败简单难度后开放', reward: { items: { brTwig: 40 } } },
        // 困难：完成主线「第十段 · 瘴气之源」后，2026-10-18 16:00（北京时间）解锁
        { diff: '困难', lv: 70, hp: 6000, boss: { dr: 0.15, mia: 1, immortal: 1, puppet: 1, puppetLv: 70, humus: 1, weed: 1, weedDmg: 30, rebirth: 1, pp: 99 }, bgm: 'boss3',   // 开场和困难泰戈尔第一形态同一首，蜕生后切 before the end（battle-ui 里的钩子）
          open: function (a, now) { return done(a, 'flora6') && now >= Date.UTC(2026, 9, 18, 8, 0, 0); },
          lockText: '完成主线「第十段 · 瘴气之源」后，2026-10-18 16:00 开放', reward: { title: 'guardian', exp: 50000, items: { brTwig: 80 } } }
      ] },
    // 2026-10-24：坎伯兰星深海区的BOSS。困难难度是三只：歼灭形态、护阵形态轮流登场（每 2 回合主动切换），都击败后化为虹霓暴走
    odo: { name: '奥多亚克', sid: 'odo', planet: 'kamble', region: 'kb_deep', bg: 'kb_abyss',
      d: '沉睡在坎伯兰星深海古代神殿附近的机械水系精灵，会在歼灭形态和护阵形态之间切换。',
      lv: [
        { diff: '简单', lv: 40, hp: 1000, boss: { dr: 0.15, pp: 99 }, bgm: 'boss3', open: function (a, now) { return done(a, 'flora1'); }, lockText: '开放坎伯兰星后开放', reward: { items: { e_odo: 1 } } },
        { diff: '普通', lv: 65, hp: 3000, boss: { dr: 0.15, ambush: 200, pp: 99 }, bgm: 'boss3', open: function (a, now) { return bossWon(a, 'odo', 0); }, lockText: '击败简单难度后开放', reward: { items: { odoFin: 40 } } },
        { diff: '困难', lv: 70, hp: 2500, boss: { dr: 0.15, ambush: 400, odoRate: 1, odoWill: 1, rainbow: 1, odoSwap: 1, pp: 99 }, bgm: 'boss3', open: function (a, now) { return bossWon(a, 'odo', 1); }, lockText: '击败普通难度后开放', reward: { title: 'odoClean', exp: 50000, items: { odoFin: 80 } },
          hpText: '歼灭形态 2500 · 护阵形态 5000 · 虹霓暴走 4000', bgmAt: { 2: 'vitalVoyage' },
          team: [
            { nick: '奥多亚克 · 歼灭形态', odoForm: 'atk', maxhp: 2500, boss: { dr: 0.15, ambush: 400, odoRate: 1, odoSwap: 1, orderRepl: 1, pp: 99, healCd: 25 } },
            { nick: '奥多亚克 · 护阵形态', odoForm: 'def', maxhp: 5000, boss: { dr: 0.15, ambush: 400, odoWill: 1, odoSwap: 1, orderRepl: 1, pp: 99, healCd: 25 } },
            { nick: '奥多亚克 · 虹霓暴走', maxhp: 4000, moves: ['流形蛮冲', '全弹搭载', '究极爆破', '解析导弹', '坚守阵地', '强效外壳', '重构坚甲', '侵扰投弹'],   // 掌握歼灭、护阵两种形态的全部技能
              boss: { dr: 0.15, rainbow: 1, orderRepl: 1, pp: 99, healCd: 25 } }
          ] }
      ] }
  };
  // 2026-10-19：每个BOSS每档难度首次击败都送马亚尔晶体，难度越高越多（简单 100 / 普通 200 / 困难 400）
  // 2026-10-24：困难难度的BOSS都带【不朽】（之后新增的困难BOSS自动加上；困难泰戈尔保持原样）
  Object.keys(BOSSES).forEach(function (k) { if (k === 'tiger') return; BOSSES[k].lv.forEach(function (L) { if (L.diff !== '困难') return; if (L.boss) L.boss.immortal = 1; (L.team || []).forEach(function (T) { T.boss.immortal = 1; }); }); });
  var BOSS_CRY = [100, 200, 400];
  Object.keys(BOSSES).forEach(function (k) { BOSSES[k].lv.forEach(function (L, i) { if (!L.reward) L.reward = {}; if (!L.reward.items) L.reward.items = {}; L.reward.items.m_mcry = BOSS_CRY[i] || BOSS_CRY[BOSS_CRY.length - 1]; }); });
  // 每周挑战：击败困难难度的泰戈尔后开放，规则和困难难度一样，每次消耗 1 枚挑战许可
  // 2026-10-18：每周挑战改成可以有多个BOSS（击败对应BOSS的困难难度后各自开放），挑战许可共用。item 是每次击败必得的BOSS专属道具
  // 2026-10-24：每个BOSS的每一档难度都有每周挑战（击败该难度后开放），规则和对应难度一样
  var WEEKLIES = [
    { boss: 'tiger', d: 0, exp: 2000, item: { tgPearl: 15 }, cry: [10, 20], drops: [{ items: { evTagore: 1 } }, { energy: 1000 }, { exp: 1000 }] },
    { boss: 'tiger', d: 1, exp: 3500, item: { tgPearl: 30 }, cry: [20, 40], drops: [{ items: { natTagore: 1 } }, { items: { evTagore: 1 } }, { energy: 1500 }, { exp: 1500 }] },
    { boss: 'tiger', d: 2, exp: 5000, item: { tgPearl: 50 }, cry: [40, 80],   // cry：2026-10-19 每次必掉 40–80 个马亚尔晶体
      drops: [{ items: { natTagore: 1 } }, { items: { evTagore: 1 } }, { energy: 2000 }, { exp: 2000 }] },
    { boss: 'barren', d: 0, exp: 2000, item: { brTwig: 15 }, cry: [10, 20], drops: [{ items: { floraJade: 8 } }, { energy: 1000 }, { exp: 1000 }] },
    { boss: 'barren', d: 1, exp: 3500, item: { brTwig: 30 }, cry: [20, 40], drops: [{ items: { floraJade: 12 } }, { items: { evAny: 1 } }, { energy: 1500 }, { exp: 1500 }] },
    { boss: 'barren', d: 2, exp: 5000, item: { brTwig: 50 }, drops: [{ items: { floraJade: 20 } }, { items: { evAny: 1 } }, { energy: 2000 }, { exp: 2000 }] },
    { boss: 'odo', d: 0, exp: 2000, item: { odoFin: 15 }, cry: [10, 20], drops: [{ items: { kbDrop: 8 } }, { energy: 1000 }, { exp: 1000 }] },
    { boss: 'odo', d: 1, exp: 3500, item: { odoFin: 30 }, cry: [20, 40], drops: [{ items: { kbDrop: 12 } }, { items: { evAny: 1 } }, { energy: 1500 }, { exp: 1500 }] },
    { boss: 'odo', d: 2, exp: 5000, item: { odoFin: 50 }, cry: [40, 80], drops: [{ items: { kbDrop: 20 } }, { items: { evAny: 1 } }, { energy: 2000 }, { exp: 2000 }] }
  ];
  var EWK = {
    types: [{ t: '草', item: 'floraJade' }, { t: '水', item: 'kbDrop' }, { t: '火', item: 'ppAsh' }, { t: '冰', item: 'whFrost' }, { t: '电', item: 'ltOrb' },
      { t: '地球', item: 'earthShard', team: ['leaf', 'squid', 'shroom'], hpMul: 0.4, dropMul: 1.5 }],   // 2026-11-01：地球挑战，地球三主宠轮流上场（每只体力是这一档的一半），地球元素掉得更多
    lv: [
      { diff: '简单', lv: 40, hp: 1600, boss: { pp: 99 }, bgm: 'boss', drop: [8, 12], exp: 3000 },   // 2026-11-01：三档都削弱（体力 −20%，减伤降一档）
      { diff: '普通', lv: 60, hp: 4000, boss: { dr: 0.1, pp: 99 }, bgm: 'boss2', drop: [16, 24], exp: 6000 },
      { diff: '困难', lv: 80, hp: 8000, boss: { dr: 0.15, stRes: 0.2, pp: 99 }, bgm: 'boss3', drop: [30, 45], exp: 12000 }
    ]
  };

  function wkKey(W) { return W.d === 2 ? 'w' : 'w' + W.d; }
  function recKey(k, d) { return d ? k + ':' + d : k; }
  function bossRec(a, k, d) { if (!a.bosses) a.bosses = {}; var rk = recKey(k, d); if (!a.bosses[rk]) a.bosses[rk] = { wins: 0, tries: 0 }; return a.bosses[rk]; }
  function bossWon(a, k, d) { var r = a && a.bosses && a.bosses[recKey(k, d || 0)]; return !!(r && r.wins > 0); }
  function levelOpen(a, k, d, now) { var L = BOSSES[k] && BOSSES[k].lv[d]; return !!(L && L.open(a, now)); }
  function wkOpen(a, W) { return !!a && !!W && bossWon(a, W.boss, W.d); }
  function weeklyOpen(a) { return WEEKLIES.some(function (W) { return wkOpen(a, W); }); }
  function wkNum(t) { return Math.floor((ACC.dayNum(t) + 3) / 7); }   // 按北京时间的周一分周
  function ewkPool(t) {
    var o = []; for (var k in WILD_POOLS) (WILD_POOLS[k] || []).forEach(function (w) { var S = SPMAP[w.sid]; if (S && S.types.indexOf(t) >= 0 && o.indexOf(w.sid) < 0) o.push(w.sid); });
    return o.sort();
  }
  function ewkType(t) { return EWK.types.filter(function (x) { return x.t === t; })[0]; }
  function ewkFoes(T, L, now) {   // 这一档的对手：普通属性挑战是本周那一只；地球挑战是三只初始精灵按顺序上场
    var one = function (sid, hp) { return { id: sid, lv: L.lv, moves: ACC.defaultMoves(sid, L.lv), nick: SPMAP[sid].name, img: SPRITES[sid], maxhp: hp, boss: JSON.parse(JSON.stringify(L.boss)) }; };
    if (T.team) return T.team.map(function (sid) { return one(sid, Math.round(L.hp * (T.hpMul || 1))); });
    var sid = ewkSid(T.t, now); return sid ? [one(sid, L.hp)] : [];
  }
  function ewkDrop(T, L) { var k = T.dropMul || 1; return [Math.round(L.drop[0] * k), Math.round(L.drop[1] * k)]; }
  function ewkSid(t, now) { var T0 = ewkType(t); if (T0 && T0.team) return T0.team[0]; var P = ewkPool(t), i = EWK.types.indexOf(ewkType(t)); return P.length ? P[ACC.thash(wkNum(now) * 7 + i * 131 + 17) % P.length] : null; }
  // 挑战许可：第一次开放每周挑战时送 1 枚，之后每 12 小时恢复 1 枚，最多 24 枚。返回现在有几枚（会更新 a.permit）
  var PERMIT = { max: 24, every: 12 * 3600 * 1000 };
  function permits(a, now) {
    if (!weeklyOpen(a)) return 0;
    var p = a.permit;
    if (!p || !(p.n >= 0)) p = a.permit = { n: 1, t: now };
    if (p.n >= PERMIT.max) p.t = now;
    else { var k = Math.floor((now - p.t) / PERMIT.every); if (k > 0) { p.n = Math.min(PERMIT.max, p.n + k); p.t = p.n >= PERMIT.max ? now : p.t + k * PERMIT.every; } }
    return p.n;
  }
  // 第一次发动前只显示「？？？」的隐藏BOSS特效；这个规则上线之前就挑战过的难度，它的特性视为都见过了
  var SECRET_FX = { past: 1, rebirth: 1 };
  function seedSeenFx(a, now) {
    if (!a || a.fxSeed) return false; a.fxSeed = 1; if (!a.seenFx) a.seenFx = {};
    var mark = function (L) { if (L && L.boss) Object.keys(L.boss).forEach(function (k) { if (!SECRET_FX[k] && !a.seenFx[k]) a.seenFx[k] = now; }); };
    Object.keys(BOSSES).forEach(function (k) { BOSSES[k].lv.forEach(function (L, i) { var r = a.bosses && a.bosses[recKey(k, i)]; if (r && r.tries > 0) { mark(L); (L.team || []).forEach(mark); } }); });
    EWK.lv.forEach(function (L, i) { if (EWK.types.some(function (T) { var r = a.bosses && a.bosses[recKey('ewk_' + T.t, i)]; return r && r.tries > 0; })) mark(L); });
    return true;
  }
  // BOSS这一档的对手
  function bossFoes(a, k, d) {
    var B = BOSSES[k], L = B.lv[d];
    var bossFx = L.boss ? JSON.parse(JSON.stringify(L.boss)) : null;
    if (bossFx && bossFx.past && a.seenFx && a.seenFx.past) bossFx.pastKnown = 1;
    if (bossFx && bossFx.rebirth && a.seenFx && a.seenFx.rebirth) bossFx.rebirthKnown = 1;
    return L.team ? L.team.map(function (T) {   // 多只BOSS（奥多亚克困难）：形态切换技能不放进技能表
      return { id: B.sid, lv: L.lv, moves: T.moves || ACC.defaultMoves(B.sid, L.lv).filter(function (n) { return n !== '歼灭形态' && n !== '护阵形态'; }), nick: T.nick, img: SPRITES[B.sid], maxhp: T.maxhp, odoForm: T.odoForm, boss: JSON.parse(JSON.stringify(T.boss)) };
    }) : [{ id: B.sid, lv: L.lv, moves: ACC.defaultMoves(B.sid, L.lv), nick: B.name, img: SPRITES[B.sid], maxhp: L.hp, onlyHit: L.only, boss: bossFx }];
  }
  // 每档难度第一次击败的奖励（直接发进存档）。返回 { mon: { u, added }, emblem, title, items, exp, bgm, later }
  function firstReward(a, R, env) {
    var out = {};
    if (R.mon) { var g = ACC.giveMon(a, R.mon.sid, R.mon.lv, env); out.mon = { u: g.m.u, added: g.added }; }
    if (R.emblem) { if (!a.emblems) a.emblems = {}; a.emblems[R.emblem] = 1; out.emblem = R.emblem; }
    if (R.title) { if (!a.titles) a.titles = []; if (a.titles.indexOf(R.title) < 0) { a.titles.push(R.title); out.title = R.title; } }
    if (R.items) { ACC.addItems(a, R.items); out.items = R.items; }
    if (R.exp) { a.exp = (a.exp || 0) + R.exp; out.exp = R.exp; }
    if (R.bgm) { if (!a.mailSeen) a.mailSeen = {}; a.mailSeen['barren-bgm'] = env.now; out.bgm = R.bgm; }
    if (R.later) out.later = true;
    return out;
  }
  function useOne(a) { a.permit.n = Math.max(0, a.permit.n - 1); }
  // 先给精灵记图鉴、记挑战次数，再开打
  function bossStart(a, k, d, recName, env, args) {
    var T = lineTeam(a, args); if (T.err) return { err: T.err };
    seedSeenFx(a, env.now);
    var foes = bossFoes(a, k, d);
    ACC.seeMon(a, BOSSES[k].sid, BOSSES[k].lv[d].lv);
    bossRec(a, k, recName).tries++;
    return { T: T, foes: foes };
  }
  MODES.boss = {
    start: function (a, args, env) {
      var k = String(args.k || ''), d = args.d | 0, B = BOSSES[k], L = B && B.lv[d];
      if (!L || !L.open(a, env.now)) return { err: '这一档难度还没有开放' };
      var x = bossStart(a, k, d, d, env, args); if (x.err) return { err: x.err };
      return { p: x.T.p, a: x.foes, ctx: { k: k, d: d, team: x.T.us, slots: x.T.slots }, dirty: true, opt: { foe: 'BOSS', diff: L.diff + '难度', bgm: L.bgm, bgmAt: L.bgmAt || null }, S: { bgmAt: L.bgmAt || null } };
    },
    end: function (a, c, B, env) {
      var L = BOSSES[c.k].lv[c.d], rec = bossRec(a, c.k, c.d), wasWeekly = weeklyOpen(a), rep = { k: c.k, d: c.d, res: B.res, first: false };
      if (B.res === 'win') {
        rep.first = !rec.wins; rec.wins++;
        if (rep.first) { rep.fr = firstReward(a, L.reward, env); rep.weeklyNew = !wasWeekly && weeklyOpen(a); }
      }
      rep.xp = lineXp(a, c, B, env);
      if (weeklyOpen(a)) permits(a, env.now);
      return rep;
    }
  };
  MODES.weekly = {
    start: function (a, args, env) {
      var k = String(args.k || ''), d = args.d | 0, B = BOSSES[k], WK = WEEKLIES.filter(function (x) { return x.boss === k && x.d === d; })[0];
      if (!B || !WK || !wkOpen(a, WK)) return { err: '这个每周挑战还没有开放' };
      if (permits(a, env.now) < 1) return { err: '挑战许可用完了。' };
      var L = B.lv[d], x = bossStart(a, k, d, wkKey(WK), env, args); if (x.err) return { err: x.err };
      return { p: x.T.p, a: x.foes, ctx: { k: k, d: d, team: x.T.us, slots: x.T.slots }, dirty: true, opt: { foe: 'BOSS', diff: '每周挑战', bgm: L.bgm, bgmAt: L.bgmAt || null }, S: { bgmAt: L.bgmAt || null } };
    },
    end: function (a, c, B, env) {
      var WK = WEEKLIES.filter(function (x) { return x.boss === c.k && x.d === c.d; })[0], rec = bossRec(a, c.k, wkKey(WK)), rep = { k: c.k, d: c.d, res: B.res };
      if (B.res === 'win') {
        rec.wins++; permits(a, env.now); useOne(a);
        var D = WK.drops[Math.floor(env.rand() * WK.drops.length)], fix = {}, wi = {};
        for (var k1 in WK.item) fix[k1] = WK.item[k1];
        if (WK.cry) fix.m_mcry = (fix.m_mcry || 0) + WK.cry[0] + Math.floor(env.rand() * (WK.cry[1] - WK.cry[0] + 1));
        for (var k2 in fix) wi[k2] = fix[k2];
        if (D.items) for (var k3 in D.items) wi[k3] = (wi[k3] || 0) + D.items[k3];
        a.exp = (a.exp || 0) + WK.exp + (D.exp || 0); if (D.energy) a.energy = (a.energy || 0) + D.energy; ACC.addItems(a, wi);
        rep.wk = { exp: WK.exp, fix: fix, drop: D };
      }
      rep.xp = lineXp(a, c, B, env);
      permits(a, env.now);
      return rep;
    }
  };
  MODES.ewk = {
    start: function (a, args, env) {
      var t = String(args.t || ''), d = args.d | 0, T = ewkType(t), sid = T && ewkSid(t, env.now), L = EWK.lv[d];
      if (!sid || !L || !weeklyOpen(a)) return { err: '这个每周挑战还没有开放' };
      if (permits(a, env.now) < 1) return { err: '挑战许可用完了。' };
      var Tm = lineTeam(a, args); if (Tm.err) return { err: Tm.err };
      seedSeenFx(a, env.now);
      var foes = ewkFoes(T, L, env.now);
      foes.forEach(function (f) { ACC.seeMon(a, f.id, L.lv); }); bossRec(a, 'ewk_' + t, d).tries++;
      return { p: Tm.p, a: foes,
        ctx: { t: t, d: d, sid: sid, team: Tm.us, slots: Tm.slots }, dirty: true, opt: { foe: 'BOSS', diff: (T.team ? '地球挑战' : t + '系每周挑战') + ' · ' + L.diff, bgm: L.bgm, ordered: !!T.team }, S: { ordered: !!T.team } };
    },
    end: function (a, c, B, env) {
      var T = ewkType(c.t), L = EWK.lv[c.d], rec = bossRec(a, 'ewk_' + c.t, c.d), rep = { t: c.t, d: c.d, sid: c.sid, res: B.res };
      if (B.res === 'win') {
        rec.wins++; permits(a, env.now); useOne(a);
        var DR = ewkDrop(T, L), n = DR[0] + Math.floor(env.rand() * (DR[1] - DR[0] + 1)), it = {}; it[T.item] = n;
        ACC.addItems(a, it); a.exp = (a.exp || 0) + L.exp;
        rep.drop = { item: T.item, n: n, exp: L.exp };
      }
      rep.xp = lineXp(a, c, B, env);
      return rep;
    }
  };

  /* ---------- 星球挑战 ----------
   * 从左到右一条链，每个节点是一关，按顺序开放；每关三颗星。可以带 1 只助战（明明教官的赫菲斯，或好友名片上的助战精灵）。
   * 星级：1 星 = 击败所有敌人；2、3 星看每关的 s2 / s3。存档：a.chal[关卡 id] = { s: [星1, 星2, 星3], got: 首通时间 } */
  var CHAL = {
    flora: [
      { id: 'fl1', n: '草甸前哨', bg: 'fl_meadow', foes: [{ sid: 'wind', lv: 8 }], s2: 'nofaint', s3: 'half', reward: { exp: 3000, energy: 600 } },
      { id: 'fl2', n: '湖畔双影', bg: 'fl_lake', foes: [{ sid: 'wind', lv: 10 }, { sid: 'wind', lv: 10 }], s2: 'nofaint', s3: 'super', reward: { exp: 4000, energy: 800 } },
      { id: 'fl3', n: '林下菌丛', bg: 'fl_path', foes: [{ sid: 'mush', lv: 13 }], s2: 'nofaint', s3: 'half', reward: { exp: 5000, energy: 1000 } },
      { id: 'fl4', n: '密林混战', bg: 'fl_sun', foes: [{ sid: 'mush', lv: 15 }, { sid: 'wind', lv: 15 }], s2: 'nofaint', s3: 'nostatus', reward: { exp: 6500, energy: 1200 } },
      { id: 'fl5', n: '猎手的领地', bg: 'fl_maple', foes: [{ sid: 'mush', lv: 15 }, { sid: 'kaleo', lv: 20 }], s2: 'nofaint', s3: 'nostatus', reward: { exp: 8000, energy: 1500 } },
      // 第 6~50 关（2026-10-17）：敌人等级逐关提高，第 40 关到 LV100；之后 q: 1 的敌人显示为「LV.??」，实际超过 LV100
      { id: 'fl6', n: '叶影小径', bg: 'fl_path', foes: [{ sid: 'wind', lv: 21 }, { sid: 'kaleo', lv: 22 }], s2: 'nofaint', s3: 'super', reward: { exp: 9500, energy: 1580 } },
      { id: 'fl7', n: '双生风语', bg: 'fl_lake', foes: [{ sid: 'leaf', lv: 24 }, { sid: 'wind', lv: 25 }], s2: 'nofaint', s3: 'noitem', reward: { exp: 11000, energy: 1660 } },
      { id: 'fl8', n: '孢子迷雾', bg: 'fl_sun', foes: [{ sid: 'phantom', lv: 26 }, { sid: 'leaf', lv: 27 }], s2: 'half', s3: 'st:中毒', reward: { exp: 12500, energy: 1740 } },
      { id: 'fl9', n: '枫下伏击', bg: 'fl_maple', foes: [{ sid: 'mush', lv: 28 }, { sid: 'phantom', lv: 29 }], s2: 'nofaint', s3: 'crit', reward: { exp: 14000, energy: 1820 } },
      { id: 'fl10', n: '湖心倒影', bg: 'fl_lake', foes: [{ sid: 'kaleo', lv: 30 }, { sid: 'mush', lv: 31 }], s2: 'noitem', s3: 'st:麻痹', reward: { exp: 15500, energy: 1900 } },
      { id: 'fl11', n: '山毛榉回廊', bg: 'fl_beech', foes: [{ sid: 'wind', lv: 33 }, { sid: 'kaleo', lv: 34 }], s2: 'nofaint', s3: 'turns:10', reward: { exp: 17000, energy: 1980 } },
      { id: 'fl12', n: '草甸疾风', bg: 'fl_meadow', foes: [{ sid: 'leaf', lv: 35 }, { sid: 'wind', lv: 36 }], s2: 'half', s3: 'up6', reward: { exp: 18500, energy: 2060 } },
      { id: 'fl13', n: '蘑菇环', bg: 'fl_path', foes: [{ sid: 'phantom', lv: 37 }, { sid: 'leaf', lv: 38 }], s2: 'nofaint', s3: 'st:睡眠', reward: { exp: 20000, energy: 2140 } },
      { id: 'fl14', n: '林冠之上', bg: 'fl_horizon', foes: [{ sid: 'mush', lv: 39 }, { sid: 'phantom', lv: 40 }, { sid: 'leaf', lv: 41 }], s2: 'noitem', s3: 'dotko', reward: { exp: 21500, energy: 2220 } },
      { id: 'fl15', n: '晨露猎场', bg: 'fl_meadow', foes: [{ sid: 'kaleo', lv: 41 }, { sid: 'mush', lv: 42 }, { sid: 'phantom', lv: 43 }], s2: 'nofaint', s3: 'st:烧伤', reward: { exp: 23000, energy: 2300 } },
      { id: 'fl16', n: '幻叶迷途', bg: 'fl_path', foes: [{ sid: 'phantom', lv: 44 }, { sid: 'firemouse', lv: 45 }], s2: 'lead', s3: 'super', reward: { exp: 24500, energy: 2380 } },
      { id: 'fl17', n: '三尾合围', bg: 'fl_lake', foes: [{ sid: 'turkey', lv: 45 }, { sid: 'mush', lv: 46 }, { sid: 'phantom', lv: 47 }], s2: 'nofaint', s3: 'down6', reward: { exp: 26000, energy: 2460 } },
      { id: 'fl18', n: '盐碱边缘', bg: 'fl_sun', foes: [{ sid: 'wind', lv: 48 }, { sid: 'leaf', lv: 49 }, { sid: 'turkey', lv: 50 }], s2: 'half', s3: 'heal:300', reward: { exp: 27500, energy: 2540 } },
      { id: 'fl19', n: '藤蔓深处', bg: 'fl_maple', foes: [{ sid: 'kaleo', lv: 51 }, { sid: 'leafcat', lv: 52 }], s2: 'noitem', s3: 'st:流血', reward: { exp: 29000, energy: 2620 } },
      { id: 'fl20', n: '雨后菌林', bg: 'fl_lake', foes: [{ sid: 'phantom', lv: 52 }, { sid: 'firemouse', lv: 53 }, { sid: 'kaleo', lv: 54 }], s2: 'nofaint', s3: 'oneshot', reward: { exp: 30500, energy: 2700 } },
      { id: 'fl21', n: '光斑林地', bg: 'fl_beech', foes: [{ sid: 'turkey', lv: 55 }, { sid: 'mush', lv: 56 }, { sid: 'phantom', lv: 57 }], s2: 'nosw', s3: 'crit', reward: { exp: 32000, energy: 2780 } },
      // fl22：三星条件 2026-10-19 从「让敌人陷入寄生」改成 10 回合内获胜（两只敌人都是草系，免疫寄生）
      { id: 'fl22', n: '风王的试炼', bg: 'fl_meadow', foes: [{ sid: 'wind', lv: 58 }, { sid: 'leaf', lv: 59 }], s2: 'nofaint', s3: 'turns:10', reward: { exp: 33500, energy: 2860 } },
      { id: 'fl23', n: '猎手再临', bg: 'fl_path', foes: [{ sid: 'kaleo', lv: 59 }, { sid: 'leafcat', lv: 60 }, { sid: 'wind', lv: 61 }], s2: 'half', s3: 'turns:12', reward: { exp: 35000, energy: 2940 } },
      { id: 'fl24', n: '古树根系', bg: 'fl_horizon', foes: [{ sid: 'phantom', lv: 61 }, { sid: 'firemouse', lv: 62 }, { sid: 'kaleo', lv: 63 }], s2: 'noitem', s3: 'up6', reward: { exp: 36500, energy: 3020 } },
      { id: 'fl25', n: '绿荫长阶', bg: 'fl_meadow', foes: [{ sid: 'turkey', lv: 65 }, { sid: 'mush', lv: 66 }], s2: 'nofaint', s3: 'dotko', reward: { exp: 38000, energy: 3100 } },
      { id: 'fl26', n: '落叶风暴', bg: 'fl_path', foes: [{ sid: 'wind', lv: 66 }, { sid: 'leaf', lv: 67 }, { sid: 'turkey', lv: 68 }], s2: 'lead', s3: 'st:冰冻', reward: { exp: 39500, energy: 3180 } },
      { id: 'fl27', n: '迷雾湖畔', bg: 'fl_lake', foes: [{ sid: 'kaleo', lv: 68 }, { sid: 'leafcat', lv: 69 }, { sid: 'wind', lv: 70 }], s2: 'nofaint', s3: 'heal:600', reward: { exp: 41000, energy: 3260 } },
      { id: 'fl28', n: '丛林法则', bg: 'fl_sun', foes: [{ sid: 'phantom', lv: 72 }, { sid: 'firemouse', lv: 73 }], s2: 'half', s3: 'down6', reward: { exp: 42500, energy: 3340 } },
      { id: 'fl29', n: '孢子沼泽', bg: 'fl_maple', foes: [{ sid: 'turkey', lv: 73 }, { sid: 'mush', lv: 74 }, { sid: 'phantom', lv: 75 }], s2: 'noitem', s3: 'oneshot', reward: { exp: 44000, energy: 3420 } },
      { id: 'fl30', n: '叶伞之下', bg: 'fl_lake', foes: [{ sid: 'wind', lv: 75 }, { sid: 'leaf', lv: 76 }, { sid: 'turkey', lv: 77 }], s2: 'nofaint', s3: 'st:害怕', reward: { exp: 45500, energy: 3500 } },
      { id: 'fl31', n: '翠影连环', bg: 'fl_beech', foes: [{ sid: 'kaleo', lv: 77 }, { sid: 'leafcat', lv: 78 }, { sid: 'wind', lv: 79 }], s2: 'nosw', s3: 'st:中毒', reward: { exp: 47000, energy: 3580 } },
      { id: 'fl32', n: '深林回声', bg: 'fl_meadow', foes: [{ sid: 'phantom', lv: 80 }, { sid: 'firemouse', lv: 81 }, { sid: 'kaleo', lv: 82 }], s2: 'nofaint', s3: 'turns:12', reward: { exp: 48500, energy: 3660 } },
      { id: 'fl33', n: '风暴前夕', bg: 'fl_path', foes: [{ sid: 'mush', lv: 82 }, { sid: 'siren', lv: 83 }, { sid: 'kaleo', lv: 84 }], s2: 'half', s3: 'dotko', reward: { exp: 50000, energy: 3740 } },
      { id: 'fl34', n: '林海守望', bg: 'fl_horizon', foes: [{ sid: 'bone', lv: 84 }, { sid: 'leaf', lv: 85 }, { sid: 'leafcat', lv: 86 }], s2: 'noitem', s3: 'heal:800', reward: { exp: 51500, energy: 3820 } },
      { id: 'fl35', n: '千叶之门', bg: 'fl_meadow', foes: [{ sid: 'inkarm', lv: 87 }, { sid: 'phantom', lv: 88 }, { sid: 'mush', lv: 89 }], s2: 'nofaint', s3: 'up6', reward: { exp: 53000, energy: 3900 } },
      { id: 'fl36', n: '幽绿裂谷', bg: 'fl_path', foes: [{ sid: 'kaleo', lv: 89 }, { sid: 'wind', lv: 90 }, { sid: 'bone', lv: 91 }], s2: 'lead', s3: 'oneshot', reward: { exp: 54500, energy: 3980 } },
      { id: 'fl37', n: '密林王座', bg: 'fl_lake', foes: [{ sid: 'leafcat', lv: 91 }, { sid: 'shroom', lv: 92 }, { sid: 'inkarm', lv: 93 }], s2: 'nofaint', s3: 'st:烧伤', reward: { exp: 56000, energy: 4060 } },
      { id: 'fl38', n: '群猎之夜', bg: 'fl_sun', foes: [{ sid: 'mush', lv: 93 }, { sid: 'siren', lv: 94 }, { sid: 'kaleo', lv: 95 }], s2: 'noitem', s3: 'down6', reward: { exp: 57500, energy: 4140 } },
      { id: 'fl39', n: '枯叶回旋', bg: 'fl_maple', foes: [{ sid: 'bone', lv: 96 }, { sid: 'leaf', lv: 97 }, { sid: 'leafcat', lv: 98 }], s2: 'half', s3: 'crit', reward: { exp: 59000, energy: 4220 } },
      { id: 'fl40', n: '芙罗拉之心', bg: 'fl_lake', foes: [{ sid: 'inkarm', lv: 98 }, { sid: 'phantom', lv: 99 }, { sid: 'mush', lv: 100 }], s2: 'nofaint', s3: 'nostatus', reward: { exp: 60500, energy: 4300 } },
      { id: 'fl41', n: '瘴雾边境', bg: 'fl_beech', foes: [{ sid: 'kaleo', lv: 102, q: 1 }, { sid: 'wind', lv: 104, q: 1 }, { sid: 'bone', lv: 106, q: 1 }], s2: 'nosw', s3: 'dotko', reward: { exp: 62000, energy: 4380, items: { floraJade: 10 } } },
      { id: 'fl42', n: '林中暗涌', bg: 'fl_meadow', foes: [{ sid: 'leafcat', lv: 106, q: 1 }, { sid: 'shroom', lv: 108, q: 1 }, { sid: 'inkarm', lv: 110, q: 1 }, { sid: 'phantom', lv: 112, q: 1 }], s2: 'nofaint', s3: 'heal:1000', reward: { exp: 63500, energy: 4460, items: { floraJade: 10 } } },
      { id: 'fl43', n: '古木低语', bg: 'fl_path', foes: [{ sid: 'mush', lv: 110, q: 1 }, { sid: 'siren', lv: 112, q: 1 }, { sid: 'kaleo', lv: 114, q: 1 }], s2: 'noitem', s3: 'turns:15', reward: { exp: 65000, energy: 4540, items: { floraJade: 10 } } },
      { id: 'fl44', n: '绿色风暴', bg: 'fl_horizon', foes: [{ sid: 'bone', lv: 114, q: 1 }, { sid: 'leaf', lv: 116, q: 1 }, { sid: 'leafcat', lv: 118, q: 1 }, { sid: 'shroom', lv: 120, q: 1 }], s2: 'half', s3: 'oneshot', reward: { exp: 66500, energy: 4620, items: { floraJade: 10 } } },
      { id: 'fl45', n: '百级之境', bg: 'fl_meadow', foes: [{ sid: 'inkarm', lv: 118, q: 1 }, { sid: 'phantom', lv: 120, q: 1 }, { sid: 'mush', lv: 122, q: 1 }], s2: 'nofaint', s3: 'noitem', reward: { exp: 68000, energy: 4700, items: { floraJade: 10 } } },
      { id: 'fl46', n: '？？？之林', bg: 'fl_path', foes: [{ sid: 'kaleo', lv: 122, q: 1 }, { sid: 'wind', lv: 124, q: 1 }, { sid: 'bone', lv: 126, q: 1 }, { sid: 'leaf', lv: 128, q: 1 }], s2: 'lead', s3: 'up6', reward: { exp: 69500, energy: 4780, items: { floraJade: 10 } } },
      { id: 'fl47', n: '无名猎场', bg: 'fl_lake', foes: [{ sid: 'leafcat', lv: 126, q: 1 }, { sid: 'shroom', lv: 128, q: 1 }, { sid: 'inkarm', lv: 130, q: 1 }], s2: 'nofaint', s3: 'dotko', reward: { exp: 71000, energy: 4860, items: { floraJade: 10 } } },
      { id: 'fl48', n: '寂静树海', bg: 'fl_sun', foes: [{ sid: 'mush', lv: 130, q: 1 }, { sid: 'siren', lv: 132, q: 1 }, { sid: 'kaleo', lv: 134, q: 1 }, { sid: 'wind', lv: 136, q: 1 }], s2: 'noitem', s3: 'st:麻痹', reward: { exp: 72500, energy: 4940, items: { floraJade: 10 } } },
      { id: 'fl49', n: '终末之森', bg: 'fl_maple', foes: [{ sid: 'bone', lv: 134, q: 1 }, { sid: 'leaf', lv: 136, q: 1 }, { sid: 'leafcat', lv: 138, q: 1 }], s2: 'nosw', s3: 'oneshot', reward: { exp: 74000, energy: 5020, items: { floraJade: 10 } } },
      { id: 'fl50', n: '芙罗拉 · 极境', bg: 'fl_horizon', foes: [{ sid: 'inkarm', lv: 138, q: 1 }, { sid: 'phantom', lv: 140, q: 1 }, { sid: 'mush', lv: 142, q: 1 }, { sid: 'siren', lv: 144, q: 1 }], s2: 'nofaint', s3: 'noitem', reward: { exp: 75500, energy: 5100, items: { floraJade: 50 } } }
    ]
  };
    function starOk(c, S, mine) {
    var cs = S.cs || {}, p = c.split(':');
    if (c === 'win') return true;
    if (c === 'nofaint') return mine.every(function (m) { return !m.fainted; });
    if (c === 'half') return mine.every(function (m) { return !m.fainted && m.hp > m.maxhp / 2; });
    if (c === 'super') return !!(S.se && S.se[0] > 0);
    if (c === 'nostatus') return mine.every(function (m) { return m.fainted || !Object.keys(m.st || {}).some(function (k) { return m.st[k] > 0; }); });
    if (c === 'noitem') return !cs.items;
    if (c === 'nosw') return !cs.sw;
    if (c === 'lead') return !!mine[0] && !mine[0].fainted;
    if (c === 'crit') return cs.crit > 0;
    if (c === 'up6') return cs.up6 > 0;
    if (c === 'down6') return cs.down6 > 0;
    if (c === 'oneshot') return cs.oneShot > 0;
    if (c === 'dotko') return cs.dotKO > 0;
    if (p[0] === 'turns') return S.turn - 1 <= +p[1];
    if (p[0] === 'st') return !!(cs.st && cs.st[p[1]] > 0);
    if (p[0] === 'heal') return (cs.heal || 0) >= +p[1];
    return false;
  }
  var MM_HELPER = { key: 'mm', owner: '明明教官', mon: { sid: 'hephaestus', lv: 30, moves: [] } };
  function chalLevelOpen(a, P, i) { return done(a, 'fl_chal') && !!CHAL[P] && !!CHAL[P][i] && (i === 0 || chalStars(a, CHAL[P][i - 1].id) > 0); }
  function helperSpec(Hp) {
    var m = Hp.mon, hm = ACC.battleMon(null, { sid: m.sid, lv: m.lv, moves: m.moves || [], ev: m.ev || null, nat: m.nat || null, iv: m.iv || null, shiny: ACC.shinyV(m.shiny) });
    hm.nick = hm.nick + '（' + Hp.owner + '）'; return hm;
  }
  MODES.chal = {
    // args = { P, i, line: [精灵编号, 或 'h' 表示助战] }；助战由服务器查好放在 args._helper（{ owner, mon }）
    start: function (a, args, env) {
      var P = String(args.P || 'flora'), i = args.i | 0, x = CHAL[P] && CHAL[P][i];
      if (!x || !chalLevelOpen(a, P, i)) return { err: '这一关还没有开放' };
      var team = (a.teams[a.active | 0] || []).filter(function (u) { return ACC.mon(a, u); });
      var Hp = args._helper || null, line = Array.isArray(args.line) ? args.line : [], used = {}, slots = [];
      line.forEach(function (v) {
        if (v === 'h') { if (Hp && !used.h) { used.h = 1; slots.push(null); } return; }
        var u = +v; if (team.indexOf(u) >= 0 && !used[u]) { used[u] = 1; slots.push(u); }
      });
      var own = slots.filter(function (u) { return u != null; });
      if (!own.length) return { err: '至少要带一只自己的精灵' };
      if (own.length > (used.h ? 4 : 5)) return { err: '出战精灵太多了' };
      var p = slots.map(function (u) { return u == null ? helperSpec(Hp) : ACC.battleMon(a, ACC.mon(a, u)); });
      var foes = x.foes.map(function (f) { ACC.seeMon(a, f.sid, Math.min(f.lv, ACC.MAX_LV)); var o = ACC.battleMon(a, { sid: f.sid, lv: f.lv, moves: [] }); if (f.q) o.lvq = 1; return o; });
      return { p: p, a: foes, ctx: { P: P, i: i, slots: slots }, dirty: true, opt: { foe: '挑战第 ' + (i + 1) + ' 关「' + x.n + '」', bgm: 'stage' } };
    },
    end: function (a, c, B, env) {
      var x = CHAL[c.P][c.i], rep = { P: c.P, i: c.i, res: B.res };
      if (B.res === 'win' && B.S) {
        var conds = ['win', x.s2, x.s3], ok = conds.map(function (cd) { return starOk(cd, B.S, B.S.sides[0].team); });
        if (!a.chal) a.chal = {};
        var r = a.chal[x.id] || (a.chal[x.id] = { s: [false, false, false] }), before = chalStars(a, x.id);
        ok.forEach(function (v, k) { if (v) r.s[k] = true; });
        rep.ok = ok; rep.before = before; rep.after = chalStars(a, x.id);
        if (!r.got) {
          r.got = env.now; rep.first = true;
          var R = x.reward; if (R.exp) a.exp = (a.exp || 0) + R.exp; if (R.energy) a.energy = (a.energy || 0) + R.energy; ACC.addItems(a, R.items);
        }
      }
      var us = c.slots.filter(function (u) { return u != null; }), seen = c.slots.map(function (u, k) { return u != null ? !!(B.seen && B.seen[k]) : null; }).filter(function (v) { return v !== null; });
      rep.xp = ACC.battleXp(a, us, seen, B.downs, env);
      return rep;
    }
  };
  function chalTotal(a, P) { return (CHAL[P || 'flora'] || []).reduce(function (s, x) { return s + chalStars(a, x.id); }, 0); }

  /* ---------- 活动 · 明明教官的试炼（2026-10-24） ----------
   * 关卡按日期每天开放一个属性：水、火、草、电、冰；五个都开放后的第二天开放「明明的最终试炼」。
   * 每关打败对方 3 只精灵（按顺序上场）；通常 / 高难两种难度；赢了给明明代币，每关每个难度首次通过另有奖励。
   * 存档 a.mm = { clr: { '水:0': 首通时间 }, wins: 次数, g: 抽奖（见 tx.js） } */
  var BJ_DAY = 86400000;
  var MM = { start: Date.UTC(2026, 9, 23, 16, 0, 0), end: Date.UTC(2026, 10, 15, 16, 0, 0), order: ['水', '火', '草', '电', '冰'] };   // 2026-10-24 00:00 ~ 2026-11-16 00:00（北京时间）
  var MM_NICK = { gorgon: '明明疯狂蛇', pede: '明明的鱼', hephaestus: '明明疯狂虫', firemouse: '明明的鼠鼠', wind: '明明的萝卜', mush: '明明的蘑菇', kaleo: '明明的大虫子', squid: '明明的水臂', leaf: '明明的力果', shroom: '明明的方头' };
  var MM_TEAM = { 水: ['pede', 'squid', 'gorgon'], 火: ['firemouse', 'shroom', 'hephaestus'], 草: ['mush', 'leaf', 'kaleo'], 电: ['faraday', 'leigong', 'faraday'], 冰: ['frost', 'wild', 'frost'] };
  var MM_TEAM_HARD = { 草: ['mush', 'leaf', 'wind'] };
  var MM_DIFF = [
    { n: '通常', lv: [40, 45, 55], tok: [20, 30], first: { tok: 30, exp: 20000 }, hp3: 1500, fx3: { dr: 0.15, focus: 1, pp: 99 } },   // 2026-10-24：第三只显著加强（hp3 体力、fx3 特性）
    { n: '高难', lv: [75, 75, 75], tok: [60, 80], first: { tok: 80, exp: 50000 }, fx: [{ mmGift: 1, pp: 99 }, { mmGift: 1, pp: 99 }, { mmGift: 1, dr: 0.25, focus: 1, pp: 99 }], lv3: 80, hp3: 3500 }
  ];
  var MM_FINAL = { tok: [50, 60], first: { tok: 120, exp: 80000 } };
  function mmDay(t) { return Math.floor((t - MM.start) / BJ_DAY); }
  function mmLive(t) { return t >= MM.start && t < MM.end; }
  function mmOpen(a, t) { return done(a, 'mmTrial') && mmLive(t); }
  function mmFoes(type, d) {
    var L = MM_DIFF[d], sids = (d && MM_TEAM_HARD[type]) || MM_TEAM[type];
    return sids.map(function (sid, k) { var o = { sid: sid, lv: L.lv[k], nick: MM_NICK[sid] || null }; if (L.fx) o.boss = JSON.parse(JSON.stringify(L.fx[k])); if (k === 2) { if (L.fx3) o.boss = JSON.parse(JSON.stringify(L.fx3)); if (L.lv3) o.lv = L.lv3; o.maxhp = L.hp3; } return o; });
  }
  function mmFinalFoes(rand) {
    var pool = []; MM.order.forEach(function (t) { ((MM_TEAM_HARD[t]) || MM_TEAM[t]).forEach(function (sid) { if (pool.indexOf(sid) < 0) pool.push(sid); }); });
    var a = pool[Math.floor(rand() * pool.length)], b; do { b = pool[Math.floor(rand() * pool.length)]; } while (b === a);
    return [{ sid: a, lv: 75, nick: MM_NICK[a] || null, boss: { mmGift: 1, pp: 99 } }, { sid: b, lv: 75, nick: MM_NICK[b] || null, boss: { mmGift: 1, pp: 99 } },
      { sid: 'leiming', lv: 85, nick: '明明教官的光霆主', maxhp: 4500, boss: { dr: 0.25, lmBoost: 1, focus: 1, pp: 99 } }];
  }
  MODES.mm = {
    start: function (a, args, env) {   // args = { key: 属性 或 'final', d: 0 通常 / 1 高难 }
      if (!mmOpen(a, env.now)) return { err: '活动没有开放' };
      var key = String(args.key || ''), fin = key === 'final', d = args.d ? 1 : 0, idx = fin ? MM.order.length : MM.order.indexOf(key);
      if (idx < 0 || mmDay(env.now) < idx) return { err: '这一关还没有开放' };
      var T = lineTeam(a, args); if (T.err) return { err: T.err };
      var foes = (fin ? mmFinalFoes(env.rand) : mmFoes(key, d)).map(function (x) {
        ACC.seeMon(a, x.sid, x.lv);
        return { id: x.sid, lv: x.lv, moves: ACC.defaultMoves(x.sid, x.lv), nick: x.nick || ACC.form({ sid: x.sid, lv: x.lv }).name, img: SPRITES[x.sid], maxhp: x.maxhp, boss: x.boss };
      });
      var bgm = fin || d === 1 ? 'mingBattle2' : 'mingBattle1', bgmAt = { 2: fin || d === 1 ? 'mingFinal2' : 'mingFinal1' };
      return { p: T.p, a: foes, ctx: { key: key, d: d, team: T.us, slots: T.slots }, dirty: true, S: { ordered: true, bgmAt: bgmAt },
        opt: { foe: '明明教官的试炼', diff: fin ? '明明的最终试炼' : key + '系关卡 · ' + MM_DIFF[d].n, bgm: bgm, bgmAt: bgmAt } };
    },
    end: function (a, c, B, env) {
      var fin = c.key === 'final', rep = { key: c.key, d: c.d, res: B.res };
      if (B.res === 'win') {
        if (!a.mm) a.mm = { clr: {}, wins: 0 }; if (!a.mm.clr) a.mm.clr = {};
        var R = a.mm, ck = fin ? 'final' : c.key + ':' + c.d, rg = fin ? MM_FINAL.tok : MM_DIFF[c.d].tok, tok = rg[0] + Math.floor(env.rand() * (rg[1] - rg[0] + 1));
        R.wins = (R.wins || 0) + 1; ACC.addItems(a, { mmTok: tok }); rep.tok = tok;
        if (!R.clr[ck]) {
          R.clr[ck] = env.now; var F = fin ? MM_FINAL.first : MM_DIFF[c.d].first;
          a.exp = (a.exp || 0) + F.exp; ACC.addItems(a, { mmTok: F.tok, g_core: 1 }); rep.first = { tok: F.tok, exp: F.exp };
        }
      }
      rep.xp = lineXp(a, c, B, env);
      return rep;
    }
  };

  /* ---------- 深渊实验室的？？？：到达坎伯兰星深海的「深渊潜底」时偶尔遇到，每天最多一次 ---------- */
  var CUMBER = { bg: 'kb_abyss', chance: 0.05, cry: 100, team: [{ sid: 'gorgon', lv: 100 }, { sid: 'siren', lv: 100 }] };
  MODES.cumber = {
    start: function (a, args, env) {
      var day = ACC.dayNum(env.now);
      if (a.cumberDay !== day) return { err: '现在没有遇到对手' };   // 浏览器遇到时会记下当天的日子
      if (a.cumberFt === day) return { err: '今天已经交过手了' };
      a.cumberFt = day;
      var T = myTeam(a), foes = CUMBER.team.map(function (x) { return ACC.battleMon(a, { sid: x.sid, lv: x.lv, moves: ACC.foeMoves(x.sid, x.lv, undefined, env.rand) }); });
      return { p: T.p, a: foes, ctx: { team: T.us }, dirty: true, opt: { foe: '？？？', bgm: 'boss3' } };
    },
    end: function (a, c, B, env) {
      var rep = { res: B.res };
      if (B.res === 'win') { ACC.addItems(a, { m_mcry: CUMBER.cry }); rep.cry = CUMBER.cry; }
      rep.xp = ACC.battleXp(a, c.team, B.seen, B.downs, env);
      return rep;
    }
  };

  /* ---------- 朋友们的房间（天门）：每个 NPC 每天在某个时间回房间，在家时可以对战；每天第一次赢有奖励 ---------- */
  var NPC_WIN_EXP = 3000, NPC_HOURS = 3, NPC_FROM = 9, NPC_TO = 24, NPC_AI_RANK = 2;
  var NPC = {
    t: { name: 'Threego', pron: '她', img: 'threego', fixed: [{ slot: 0, sid: 'leafcat' }], away: '她每天会在某个时间回房间待一阵子。',
      lines: [['', '哟，{name}！我的叶子喵最近可厉害了，要不要来试试？'], ['laugh', '嘿嘿，今天我状态超好，输了可别哭鼻子哦！'], ['smile', '点点的消息还没查到……先陪我打一场散散心吧。']] },
    h: { name: 'Dr.黄', pron: '他', img: 'drh', fixed: [{ slot: -1, sid: 'aegis' }], away: '他每天会在某个时间回房间待一阵子。',
      lines: [['', '哦？你来得正好。至高之盾的防御，你破得了吗？'], ['grin', '我在孝感大厅打了很久很久……今天换你陪我练练。'], ['oh', '哦！是{name}啊。来都来了，切磋一下？']] },
    b: { name: 'Bttp', pron: '他', img: 'bttp', fixed: [{ slot: 2, sid: 'bone' }], away: '他每天会在某个时间回房间待一阵子。',
      lines: [['god', '神已经算到你会来了。'], ['', '我的精灵排序是有讲究的，尤其是第三只。'], ['smile', '要不要验证一下你最近的进步？来吧。']] }
  };
  // 随机池：竞技对战的 24 只，去掉剧情里还没揭晓的BOSS「荒芜」和神秘精灵「哈尔达蒙」（避免提前在黄冈秘鉴里解锁名字）
  var NPC_SECRET = ['barren', 'hauris'];
  var NPC_POOL = SP.map(function (x) { return x.id; }).filter(function (id) { return SPMAP[id] && SPRITES[id] && NPC_SECRET.indexOf(id) < 0; });
  function bjDay(now) { var d = new Date(now + 8 * 3600e3); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }
    function npcPlan(k, day) {
    var r = seeded('npc|' + day + '|' + k), N = NPC[k];
    var start = NPC_FROM + Math.floor(r() * (NPC_TO - NPC_FROM - NPC_HOURS + 1));
    var slots = [null, null, null];
    N.fixed.forEach(function (f) { slots[f.slot >= 0 ? f.slot : Math.floor(r() * 3)] = f.sid; });
    var pool = NPC_POOL.filter(function (id) { return !N.fixed.some(function (f) { return f.sid === id; }); });
    slots = slots.map(function (x) {
      if (x) return x;
      var id; do { id = pool[Math.floor(r() * pool.length)]; } while (slots.indexOf(id) >= 0);
      return id;
    });
    // 防止随机到同一只：上面的 do/while 只防了已经定下的位置，这里再去重一次
    slots.forEach(function (x, i) { if (slots.indexOf(x) !== i) { var alt = pool.filter(function (id) { return slots.indexOf(id) < 0; }); slots[i] = alt[Math.floor(r() * alt.length)]; } });
    var rel = [-5, 0, 5];
    for (var i = 2; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = rel[i]; rel[i] = rel[j]; rel[j] = t; }
    return { start: start, end: start + NPC_HOURS, team: slots.map(function (sid, i) { return { sid: sid, rel: rel[i], nat: ACC.NAT_KEYS[Math.floor(r() * ACC.NAT_KEYS.length)] }; }) };
  }
  function npcHome(k, now) { if (!NPC[k]) return false; var P = npcPlan(k, bjDay(now)), d = new Date(now + 8 * 3600e3), h = d.getUTCHours() + d.getUTCMinutes() / 60; return h >= P.start && h < P.end; }
  function teamAvgLv(a) { var t = ACC.team(a); return t.length ? Math.round(t.reduce(function (s, m) { return s + m.lv; }, 0) / t.length) : 5; }
  MODES.npc = {
    start: function (a, args, env) {
      var k = String(args.k || ''), N = NPC[k];
      if (!N || !npcHome(k, env.now)) return { err: (N ? N.name : '对方') + ' 刚刚出门了。' };
      var avg = teamAvgLv(a), T = myTeam(a);
      var foes = npcPlan(k, bjDay(env.now)).team.map(function (x) { var lv = Math.max(1, Math.min(100, avg + x.rel)); var o = ACC.battleMon(a, { sid: x.sid, lv: lv, moves: [], nat: x.nat }); delete o.u; delete o.hl; return o; });
      return { p: T.p, a: foes, ctx: { k: k }, noItems: true, S: { ai: rankAI(NPC_AI_RANK) }, opt: { foe: N.name } };
    },
    end: function (a, c, B, env) {
      var rep = { k: c.k, res: B.res }, d = bjDay(env.now);
      (B.downs || []).forEach(function (x) { ACC.seeMon(a, x.id, x.lv); });
      if (B.res === 'win') {
        if (!(a.npcWin && a.npcWin.d === d && a.npcWin[c.k])) {
          if (!a.npcWin || a.npcWin.d !== d) a.npcWin = { d: d };
          a.npcWin[c.k] = 1; a.exp = (a.exp || 0) + NPC_WIN_EXP; rep.exp = NPC_WIN_EXP;
        } else rep.again = true;
      }
      return rep;
    }
  };

  /* ---------- 拜访别人的茶室：挑战茶室里展示的精灵。每天前 5 场各奖励 1000 累积经验，赢输都算，认输不算 ---------- */
  var TEA_DAILY = 5, TEA_EXP = 1000;
  MODES.tea = {
    // args = { owner }；对手由服务器按主人的茶室查好放在 args._foes
    start: function (a, args, env) {
      var foes = (args._foes || []).map(PVP.spec).filter(Boolean);
      if (!foes.length) return { err: '这个茶室里没有可以挑战的精灵' };
      var T = myTeam(a);
      return { p: T.p, a: foes, ctx: { owner: args._owner || '' }, noItems: true, opt: { foe: (args._owner || '') + '的茶室' } };
    },
    end: function (a, c, B, env) {
      var rep = { res: B.res, quit: B.quit }, d = bjDay(env.now);
      if (!B.quit) {
        var t = a.teaFight && a.teaFight.d === d ? a.teaFight : { d: d, n: 0 };
        if ((t.n || 0) < TEA_DAILY) { t.n = (t.n || 0) + 1; a.teaFight = t; a.exp = (a.exp || 0) + TEA_EXP; rep.exp = TEA_EXP; rep.left = TEA_DAILY - t.n; }
        else rep.full = true;
      }
      return rep;
    }
  };

  /* ---------- 剧情对战 ----------
   * F.pteam：剧情限定，用一支固定的队伍代替玩家自己的配队出战，不计入经验/学习力
   * F.allyMon：在玩家自己配队的最前面加一只固定的助战精灵（默认首发），不计入经验/学习力；allyOpt：可以不带
   * F.team：精灵数组，或一个按存档算出精灵数组的函数（如等级跟玩家首发联动的BOSS）
   * 每一项：sid、lv，可选 moves、boss（battle.js 的 BOSS_FX）、maxhp、nick、img、miasma、breakable、ability */
  var LEAF_ALLY = { sid: 'leafcat', lv: 40, nick: '叶子喵', boss: { purify: 1 }, moves: ['闪光飞叶', '种子炸弹', '星星魔法', '光束'] };
  var FIGHTS = {
    // 第十一段 · 盐碱地之下（2026-10-24）
    brSalt: { foe: '荒芜', bgm: 'boss2', team: [{ sid: 'barren', lv: 45, nick: '荒芜', boss: { pp: 99 } }],
      allyMon: { sid: 'leafcat', lv: 40, nick: '叶子喵', boss: { purify: 1 }, moves: ['闪光飞叶', '种子炸弹', '星星魔法', '光束'], ability: { n: '脚伤', d: '脚底被瘴气浸透，陷入永久的流血状态，无法被解除' } },
      env: 'miasma', bg: 'fl_salt_mia', desc: '荒芜（LV45）· 叶子喵助战（特性「脚伤」：永久流血）' },
    brLab: { foe: '荒芜', bgm: 'boss3', team: [{ sid: 'barren', lv: 50, nick: '荒芜', boss: { nourish: 1, pp: 99 } }], env: 'miasma', bg: 'fl_lab', desc: '荒芜（LV50）· 特效「养料汲取」：每回合恢复 50 体力' },
    // 第二章 · 坎伯兰星（2026-10-31，作者剧本）
    // 第十五段：两只野生克托斯；辰爷的三只克托斯 + 一只坎克托斯
    ketos2: { foe: '野生克托斯', team: [{ sid: 'pede', lv: 35, nick: '克托斯' }, { sid: 'pede', lv: 35, nick: '克托斯' }], bg: 'kb_dusk', desc: '野生克托斯 ×2（LV35）' },
    cyKb: { foe: '辰爷', team: [{ sid: 'pede', lv: 40, nick: '克托斯' }, { sid: 'pede', lv: 40, nick: '克托斯' }, { sid: 'pede', lv: 40, nick: '克托斯' }, { sid: 'pede', lv: 50, nick: '坎克托斯' }], bg: 'kb_shore', desc: '辰爷的克托斯 ×3（LV40）、坎克托斯（LV50）' },
    // 第十六段：操控 Threego 的 LV50 胖虎打辰爷的 LV40 邪恶水臂（隐藏效果：胖虎的技能必中、威力翻倍——用「深度侵蚀」双攻 +100% 加 sure 必中实现）
    tgSquid: { foe: '辰爷', pteam: [{ sid: 'tagore', lv: 50, st: 1, nick: '胖虎', boss: { erode: 1, sure: 1 } }], team: [{ sid: 'squid', lv: 40, nick: '邪恶水臂' }], bg: 'kb_floor', desc: '辰爷的邪恶水臂（LV40）· 你操控 Threego 的胖虎（LV50）' },
    odo45: { foe: '机械精灵', team: [{ sid: 'odo', lv: 45, nick: '？？？', boss: { dr: 0.1, pp: 99 } }], bg: 'kb_abyss', desc: '机械精灵（LV45）' },
    // 剧情杀：第二只 LV65，双攻隐含 +500%、技能必中、不能被闪避
    odoTwin: { foe: '机械精灵', team: [{ sid: 'odo', lv: 45, nick: '？？？', boss: { dr: 0.1, pp: 99 } }, { sid: 'odo', lv: 65, nick: '？？？', maxhp: 30000, moves: ['钢铁冲击', '水打击', '铁拳', '海浪'], boss: { sure: 1, kill: 1, pp: 99 } }], bg: 'kb_abyss', desc: '机械精灵 ×2（LV45 / LV65）' },
    // 第十八段 · 星云显现：玫瑰星云（剧情限定，LV80、体力 10000，玩家不出意外地被秒杀）
    nebula: { foe: 'Rosette Nebula', bgm: 'disCommunication', team: [{ sid: 'rosette', lv: 80, nick: '玫瑰星云', maxhp: 10000, moves: ['黑雾潮汐', '幽冥息', '夜影封魂', '幽冥结界'], boss: { erode: 9, sure: 1, dr: 0.15, stRes: 0.8, pp: 99 } }], bg: 'kb_dusk', desc: '玫瑰星云（LV80）' },
    // 第十三段 · 冥岛的歌声（2026-10-31）：唱歌的塞米
    // 第十九段 · 码头决战（2026-11-01）：必须打赢才能读完；机制见 battle.js 的 nebCumber
    nebula2: { foe: 'Rosette Nebula', bgm: 'ngc2237', mustWin: true, coreRevive: true,   // coreRevive：全员倒下时可以花 1 个圣晶石全员复活（battle.js 的 coreRevive）
      team: [{ sid: 'rosette', lv: 80, nick: '玫瑰星云', maxhp: 6336, moves: ['强烈恒星风', '氢-α发射线'], ability: { n: '疏散星团', d: '先出手时造成的伤害提升 50%；后出手时受到的伤害减免 50%' }, boss: { neb: 1, dust: 1, bok: 1, stRes: 0.8, pp: 99 } }], bg: 'kb_dock', desc: '玫瑰星云（LV80）· Cumber 助阵' },
    semi: { foe: '唱歌的小精灵', team: [{ sid: 'siren', lv: 20, nick: '塞米' }], bg: 'kb_isle', desc: '塞米（LV20）' },
    threego: { foe: 'Threego', team: [{ sid: 'tagore', lv: 3 }] },
    karo: { foe: '被瘴气污染的野生精灵', team: [{ sid: 'wind', lv: 3, miasma: 5 }], env: 'miasma', bg: 'fl_salt', desc: '被瘴气污染的卡罗（LV3）' },
    hunter: { foe: '神秘的猎杀者', team: [{ sid: 'kaleo', lv: 15 }], bg: 'fl_maple', desc: '猎杀者卡莱（LV15）' },
    kaleo4: { foe: '瘴气卡莱群', team: [{ sid: 'kaleo', lv: 20, miasma: 5 }, { sid: 'kaleo', lv: 20, miasma: 5 }, { sid: 'kaleo', lv: 20, miasma: 5 }, { sid: 'kaleo', lv: 20, miasma: 5 }], bg: 'fl_beech', desc: '被瘴气侵染的卡莱 ×4（LV20）' },
    // 剧情助战的叶子喵：LV40，带高威力攻击技能，默认首发（见 startFight）
    // ↓ 第八段 · 深入丛林（flora4）专用。boss 字段见 battle.js 的 BOSS_FX：erode 深度侵蚀（1 = 双攻 +100%，2 = +200%）、mute 无法交流（只用攻击技能）、purify 净化光芒
    // allyOpt：叶子喵助战可选，开战前在对战卡上勾选；preStrike：对方偷袭先出一招；cuts：对方体力降到某个数值时插播对话
    cyThreego: { foe: '瘴气玛西', pteam: [{ sid: 'tagore', lv: 12, nick: '小胖虎' }],   // 操控 Threego 的小胖虎迎战（剧情杀）
      team: [{ sid: 'mush', lv: 24, nick: '瘴气玛西', miasma: 8, boss: { erode: 2, mute: 1 } }],
      env: 'miasma', bg: 'fl_sun', desc: '瘴气玛西（LV24）' },
    cyRescue: { foe: '瘴气玛西',
      team: [{ sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }, { sid: 'mush', lv: 21, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }],
      env: 'miasma', bg: 'fl_path', desc: '瘴气玛西 ×2（LV20 / 21）' },
    cyBoss: { foe: '瘴气变异玛西露姆', bgm: 'disCommunication',   // 剧情杀：比玩家首发高 20 级，先制 +9 的「瘴毒灭却」一回合秒一只
      team: function (a) {
        var lead = ACC.team(a)[0];
        var lv = Math.min(100, (lead ? lead.lv : 20) + 20);
        return [{ sid: 'mush', lv: lv, nick: '瘴气变异玛西露姆', img: FORM_FX_SPRITES.mush.miasma, miasma: 10, boss: { erode: 1, mute: 1 }, moves: ['瘴毒灭却'] }];
      },
      env: 'miasma', bg: 'fl_sun', desc: '瘴气变异玛西露姆（比你的首发高 20 级）' },
    cyCat: { foe: '瘴气叶子小小喵',
      team: [{ sid: 'leafcat', lv: 18, nick: '瘴气叶子小小喵', miasma: 6, boss: { mute: 1 } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      env: 'miasma', bg: 'fl_village', desc: '瘴气叶子小小喵（LV18）' },
    cyVillage: { foe: '村口的守卫',
      team: [{ sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }, { sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } },
        { sid: 'mush', lv: 20, nick: '瘴气玛西', miasma: 6, boss: { mute: 1 } }, { sid: 'leafcat', lv: 20, nick: '瘴气叶子小小喵', miasma: 6, boss: { mute: 1 } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      env: 'miasma', bg: 'fl_village', desc: '瘴气玛西 ×3、瘴气叶子小小喵（LV20）' },
    cyKaleo: { foe: '列队的卡莱', preStrike: true,   // 突然冲上来：卡莱第一回合先打出一招
      team: [{ sid: 'kaleo', lv: 22, nick: '卡莱', miasma: 3 }, { sid: 'kaleo', lv: 23, nick: '卡莱', miasma: 3 }, { sid: 'kaleo', lv: 24, nick: '卡莱', miasma: 3 }],
      allyMon: LEAF_ALLY, allyOpt: true,
      bg: 'fl_beech', desc: '卡莱 ×3（LV22 / 23 / 24）' },
    cyChenye: { foe: '辰爷',
      team: [{ sid: 'kaleo', lv: 35, nick: '卡莱奥', miasma: 4 }, { sid: 'squid', lv: 40, nick: '邪恶水臂' }],
      allyMon: LEAF_ALLY, allyOpt: true,
      bg: 'fl_beech', desc: '辰爷的卡莱奥（LV35）、邪恶水臂（LV40）' },
    cyBomb: { foe: '炸弹',   // 纯木桩：不会攻击、1000 体力，可以被打破；打到 700、300 时插播对话
      team: [{ sid: 'dummy', lv: 30, nick: '炸弹', img: SPRITES.plantbomb, maxhp: 1000, breakable: true, moves: ['按兵不动'], ability: { n: '能量炸弹', d: 'Bttp 做的炸弹。不会攻击；不断注入能量（攻击它），外壳被打破时就会爆开' } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      bg: 'fl_beech', desc: '往炸弹里注入能量（1000 体力，不会攻击）',
      cuts: [
        { hp: 700, lines: [
          { s: 'cy', t: '……嗯？不好！你们在搞什么鬼？给我上！' },
          { s: 'n', t: '辰爷一声大喝，林子里埋伏的卡莱潮水一样朝你们冲了过来。' },
          { s: 'ms', t: '我们来了——！！' },
          { s: 'n', t: '身后传来一片叫喊。是没被瘴气感染的玛西们！它们从四面八方的树丛里钻出来，组成了一支浩浩荡荡的联军，迎着卡莱冲了上去。' },
          { s: 'n', t: '两边撞在一起，林子里一下子乱成一团。一时间难分胜负。' },
          { s: 'n', t: '可是慢慢地，卡莱们靠着天生的战斗本能和瘴气的加持，一点点占了上风。' },
          { s: 'v', t: '它们撑不了太久！{name}，继续注入能量！' }
        ] },
        { hp: 300, lines: [
          { s: 'cy', t: '哈哈哈哈！偷偷摸摸的，在搞什么小动作呢？' },
          { s: 'n', t: '玛西联军已经倒下了一大片，大部分被打晕在了地上。剩下的卡莱掉过头，朝你们围了过来。' },
          { s: 'v', t: '加速注入能量！！快快快！！' }
        ] }
      ] },
    cyGuards: { foe: '失去理智的精灵', bgm: 'disCommunication',   // 压迫感强的高形态：和战前剧情里的 dis-communication 接着放
      team: [{ sid: 'wind', lv: 36, nick: '瘴气六尾风王', img: FORM_FX_SPRITES.wind.miasma, miasma: 8, boss: { erode: 1, mute: 1 } }, { sid: 'mush', lv: 38, nick: '瘴气玛西露姆', img: FORM_FX_SPRITES.mush.miasma, miasma: 8, boss: { erode: 1, mute: 1 } }],
      allyMon: LEAF_ALLY, allyOpt: true,
      env: 'miasma', bg: 'fl_salt', desc: '瘴气六尾风王（LV36）、瘴气玛西露姆（LV38）' }
  };
  function fightTeam(F, a) { return typeof F.team === 'function' ? F.team(a) : F.team; }
  function resolveFoeEntry(x, rand) {
    if (x.moves || x.boss || x.maxhp || x.nick || x.img) {
      var defImg = x.sid === 'dummy' ? null : formImg(SPMAP[x.sid], ACC.stageOf(SPMAP[x.sid], x.lv));
      var mv = x.moves || (x.boss && x.boss.mute && x.sid !== 'dummy' ? puppetMoves(x.sid) : ACC.defaultMoves(x.sid, x.lv));   // 「无法交流」：只会用攻击技能
      return { id: x.sid, lv: x.lv, moves: mv, nick: x.nick, img: x.img || defImg, maxhp: x.maxhp, boss: x.boss, miasma: x.miasma, breakable: x.breakable, ability: x.ability };
    }
    var o = ACC.battleMon(null, { sid: x.sid, lv: x.lv, moves: ACC.foeMoves(x.sid, x.lv, undefined, rand || Math.random) }); if (x.miasma) o.miasma = x.miasma; return o;
  }
  MODES.story = {
    // args = { key, allyOff }
    start: function (a, args, env) {
      var F = FIGHTS[String(args.key || '')]; if (!F) return { err: '没有这场剧情对战' };
      var p, slots;
      if (F.pteam) {
        p = F.pteam.map(function (x) { return { id: x.sid, lv: x.lv, moves: x.moves || ACC.defaultMoves(x.sid, x.lv), nick: x.nick, img: x.img || formImg(SPMAP[x.sid], x.st != null ? x.st : ACC.stageOf(SPMAP[x.sid], x.lv)), boss: x.boss ? JSON.parse(JSON.stringify(x.boss)) : undefined }; });   // st：指定立绘阶段；boss：剧情限定的隐藏效果
        slots = p.map(function () { return null; });
      } else {
        var own = ACC.team(a); p = own.map(function (m) { return ACC.battleMon(a, m); }); slots = own.map(function (m) { return m.u; });
        if (F.allyMon && !(F.allyOpt && args.allyOff)) { p = [resolveFoeEntry(F.allyMon, env.rand)].concat(p.slice(0, ACC.TEAM_SIZE - 1)); slots = [null].concat(slots.slice(0, ACC.TEAM_SIZE - 1)); }
      }
      var foes = fightTeam(F, a).map(function (x) { return resolveFoeEntry(x, env.rand); });
      fightTeam(F, a).forEach(function (x) { if (SPMAP[x.sid] && !SPMAP[x.sid].nodex) ACC.seeMon(a, x.sid, x.lv); });
      var site = String(args.site || ''); if (typeof STY !== 'undefined' && !(STY.FIGHT_OF[site] && STY.FIGHT_OF[site].indexOf(String(args.key)) >= 0)) site = STY.SITE_OF[String(args.key)] || '';   // 这场对战属于哪段剧情（打完记 bt）
      return { p: p, a: foes, ctx: { key: args.key, slots: slots, site: site }, dirty: true, preStrike: !!F.preStrike, S: { env: F.env || null, coreRevive: F.coreRevive ? 1 : null }, opt: { foe: F.foe, bgm: F.bgm || null } };
    },
    end: function (a, c, B, env) {
      var rep = { key: c.key, res: B.res, own: c.slots.some(function (u) { return u != null; }) };
      if (c.site) { if (!a.story) a.story = {}; if (!a.story[c.site]) a.story[c.site] = { at: 0, done: false, ch: null }; a.story[c.site].bt = B.res; }   // 剧情对战打过了（胜负决定后面的剧情分支）
      var us = c.slots.filter(function (u) { return u != null; }), seen = c.slots.map(function (u, k) { return u != null ? !!(B.seen && B.seen[k]) : null; }).filter(function (v) { return v !== null; });
      if (rep.own) rep.xp = ACC.battleXp(a, us, seen, B.downs, env);
      return rep;
    }
  };

  /* ==========================================================
   * 野外（2026-10-25）：刷出哪只精灵（种类、等级、异色）由服务器掷骰子
   * 浏览器进入场景时向服务器要一批「刷出来的精灵」（server/pve.js 的 op: 'wild'），只是把它们画出来、让它们走动；
   * 点中开战时只告诉服务器是哪一只（编号），服务器按记下的资料开打，捕捉、掉落、各种任务计数都在服务器上算。
   * ========================================================== */
  function regionById(rid) { for (var i = 0; i < WILD_REGIONS.length; i++) if (WILD_REGIONS[i].id === rid) return WILD_REGIONS[i]; return null; }
  function regionOpen(a, R) { return R.record ? done(a, 'flora7') : done(a, 'flora1'); }
  function floraFallen(a) { return done(a, 'flora6') && !done(a, 'flora7'); }
  function regionFallen(a, R) { return !!R && R.planet === 'flora' && (R.record || floraFallen(a)); }
  function sceneCount(R) { return Math.max(R.pool ? 2 : 1, (R.bgs || []).filter(function (k) { return BG[k]; }).length); }
  function rollShiny(w, rand) { var r = rand(); return w.shiny2 && r < w.shiny2 ? 2 : !!(w.shiny && r < (w.shiny2 || 0) + w.shiny); }
  function rollWild(pool, extra, rand) {   // extra：只在这个场景出现的精灵（WILD_SCENE），和区域表合在一起抽
    var P = extra ? WILD_POOLS[pool].concat(extra) : WILD_POOLS[pool], tot = P.reduce(function (s, w) { return s + w.w; }, 0), r = rand() * tot, w = P[0];
    for (var i = 0; i < P.length; i++) { r -= P[i].w; if (r < 0) { w = P[i]; break; } }
    return { w: w, lv: w.lv[0] + Math.floor(rand() * (w.lv[1] - w.lv[0] + 1)) };
  }
  // 一碗饭和米饭火鸡：放了饭的场景每次刷新有 2% 是米饭火鸡
  var RICE = { seedDrop: 0.1, sid: 'turkey', lv: 12, rate: 0.45, chance: 0.02, regions: ['pp_lava'] };
  // 奇声号角 → 塞米：在冥岛吹响号角会来一只塞米，和它开战时号角用掉
  var HORN = { sid: 'siren', lv: 12, rate: 0.4, bg: 'kb_isle', drop: [3, 6], day: [12, 15], need: 60 };
  // 旅行精灵叶子喵：全服共享的时间表，每小时在某个区域的某个场景停留 20 分钟；每次出现每人只能挑战 1 次
  var TRAVEL = { sid: 'leafcat', lv: 30, exp: 3000, leaf: 0.5, dur: 20, regions: ['forest', 'grass', 'kb_surf', 'kb_sea', 'kb_deep', 'pp_lava', 'pp_city', 'lt_belt', 'wh_snow'],
    spots: [{ x: 50, y: 64 }, { x: 32, y: 62 }, { x: 70, y: 66 }] };
  function travelAt(now) {
    var h = Math.floor(now / 3600000), s = ACC.thash(h + 7919), start = h * 3600000 + (s % 41) * 60000;
    var R = regionById(TRAVEL.regions[(s >>> 8) % TRAVEL.regions.length]);
    return { h: h, start: start, end: start + TRAVEL.dur * 60000, rid: R.id, si: (s >>> 16) % sceneCount(R), spot: TRAVEL.spots[(s >>> 20) % TRAVEL.spots.length], active: now >= start && now < start + TRAVEL.dur * 60000 };
  }
  // 芙罗拉星 · 祛除瘴气：任务完成前，在芙罗拉星作战有 10% 概率遇到瘴气精灵，击败它们累计计数
  var PURGE = { chance: 0.1, goal: 30, steps: [{ n: 1, exp: 3000 }, { n: 5, exp: 10000 }, { n: 10, exp: 20000 }, { n: 20, exp: 40000 }, { n: 30, exp: 120000, title: 'purifier' }] };
  function purgeRec(a) { if (!a.purge) a.purge = { n: 0, got: {} }; if (!a.purge.got) a.purge.got = {}; return a.purge; }
  function purgeActive(a) { return done(a, 'flora1') && purgeRec(a).n < PURGE.goal; }
  // 主线任务「引出猎杀者」：芙罗拉星的野生精灵不会倒下，体力剩 1 点就逃走
  var SPARE_N = 5;
  function spareN(a) { return (a.story && a.story.flora2 && a.story.flora2.spare) || 0; }
  function spareActive(a) { return done(a, 'flora2') && spareN(a) < SPARE_N; }
  // 瘴气驱逐战：击破腐化精灵，自己经验背包 +1000，全服击破 +1（每人每天最多 50 次）
  var PW = { exp: 1000, cap: 50 };
  function pwOpen(a) { return done(a, 'flora6'); }
  /* 坎伯兰星保卫战（2026-10-31）：读完第十七段「深海基站」后开放（参考瘴气驱逐战）
   * 每个整点，坎伯兰星随机 per 个场景里各出现一只不同型号的奥多亚克（全服时间表一样，按小时编号算），停留一整个小时；
   * 每只每人每小时只能挑战 1 次（开战就算），不能捕捉。击破：自己经验背包 +exp，全服击破 +1（每人每天最多 cap 次）；
   * 本账号累计击破 need 只后开放第十八段。全服里程碑奖励见 js/engine/award.js（kbwReward） */
  var KBW = { calm: ['kb_temple'], first: [0, 0, 1, 1, 2], per: 4, cap: 20, exp: 3000, need: 5, regions: ['kb_surf', 'kb_sea', 'kb_deep'],
    spots: [{ x: 24, y: 70 }, { x: 40, y: 62 }, { x: 78, y: 64 }, { x: 88, y: 74 }],
    models: [
      { k: 'scout', n: '侦察型奥多亚克', lv: 45, maxhp: 900, boss: { dr: 0.1, pp: 99 } },
      { k: 'assault', n: '突击型奥多亚克', lv: 50, maxhp: 1200, boss: { dr: 0.15, pp: 99 } },
      { k: 'heavy', n: '重装型奥多亚克', lv: 52, maxhp: 1800, boss: { dr: 0.25, pp: 99 } },
      { k: 'hunter', n: '猎杀型奥多亚克', lv: 55, maxhp: 1500, boss: { dr: 0.15, pp: 99 } }
    ] };
  function kbwOpen(a) { return done(a, 'kb6'); }
  // 保卫战奥多亚克能出现的场景：古代神殿（KBW.calm）里不出现（2026-10-31）
  function kbwScenes(R) {
    var bgs = (R.bgs || []).filter(function (k) { return BG[k]; }), out = [];
    for (var i = 0; i < sceneCount(R); i++) if (!bgs.length || KBW.calm.indexOf(bgs[i % bgs.length]) < 0) out.push(i);
    return out.length ? out : [0];
  }
  function kbwAt(now, a) {
    var h = Math.floor(now / 3600000), L = [], used = {};
    for (var k = 0; k < KBW.per; k++) {
      var s = ACC.thash(h * 7 + k + 40503), R = regionById(KBW.regions[s % KBW.regions.length]), SI = kbwScenes(R), si = SI[(s >>> 8) % SI.length], key = R.id + ':' + si;
      var spot = KBW.spots[((s >>> 4) + (used[key] || 0)) % KBW.spots.length]; used[key] = (used[key] || 0) + 1;
      L.push({ h: h, k: k, rid: R.id, si: si, spot: spot, m: KBW.models[(s >>> 16) % KBW.models.length], end: (h + 1) * 3600000 });
    }
    // 先遣奥多亚克（2026-10-31）：保卫战刚开始、本人还没击破够 KBW.need 只时，另外给这个人刷 5 只不会离开的（编号 100+j），
    // 打赢一只少一只（a.kbwS 记着打赢了哪几只），输了可以再打；保证当天就能打够、进入第十八段
    if (a && kbwOpen(a) && (a.kbwK | 0) < KBW.need) {
      var got = Array.isArray(a.kbwS) ? a.kbwS : [];
      KBW.first.forEach(function (mi, j) {
        if (got.indexOf(j) >= 0) return;
        var R2 = regionById(KBW.regions[j % KBW.regions.length]), SI2 = kbwScenes(R2), si2 = SI2[Math.floor(j / KBW.regions.length) % SI2.length], key2 = R2.id + ':' + si2;
        var spot2 = KBW.spots[(j + 1 + (used[key2] || 0)) % KBW.spots.length]; used[key2] = (used[key2] || 0) + 1;
        L.push({ h: 'p', k: 100 + j, p: 1, rid: R2.id, si: si2, spot: spot2, m: KBW.models[mi], end: (h + 1) * 3600000 });
      });
    }
    return L;
  }
  function kbwFought(a, h, k) { if (h === 'p') return !!(Array.isArray(a.kbwS) && a.kbwS.indexOf(k - 100) >= 0); return !!(a.kbw && a.kbw.h === h && Array.isArray(a.kbw.k) && a.kbw.k.indexOf(k) >= 0); }
  // 神秘精灵：每天 16:00–24:00（北京时间），切换场景时有 3% 概率出现（真身是 LV10 幽灵鱼）
  var MYSTERY = { sid: 'hauris', lv: 10, rate: 0.4, chance: 0.03, shiny: 0.03, from: 16, to: 24 };
  function mysteryTime(now) { var h = new Date(now + 8 * 3600e3).getUTCHours(); return h >= MYSTERY.from && h < MYSTERY.to; }
  function hornDrop(rand) { return HORN.drop[0] + Math.floor(rand() * (HORN.drop[1] - HORN.drop[0] + 1)); }
  /* 刷出一只野生精灵（只掷骰子，不改存档）。kind：'' 普通 / 'horn' 号角引来的塞米。返回 { sid, lv, rate, shiny, corrupt, bait, horn } 或 null */
  function wildRoll(a, R, si, bgKey, kind, rand) {
    if (kind === 'mystery') return { sid: MYSTERY.sid, lv: MYSTERY.lv, rate: MYSTERY.rate, shiny: rand() < MYSTERY.shiny, corrupt: false, bait: false, mystery: true };
    var hit = null, corrupt = regionFallen(a, R);
    if (kind === 'horn') hit = { w: { sid: HORN.sid, lv: [HORN.lv, HORN.lv], rate: HORN.rate, rare: true, w: 0 }, lv: HORN.lv };
    else {
      if (!R.pool) return null;
      var b = a.riceBowl;
      if (RICE.regions.indexOf(R.id) >= 0 && b && b.rid === R.id && b.si === si && rand() < RICE.chance) {
        var w0 = (WILD_POOLS[R.pool] || []).filter(function (x) { return x.sid === RICE.sid; })[0] || { sid: RICE.sid, lv: [RICE.lv, RICE.lv], rate: RICE.rate, rare: true };
        hit = { w: w0, lv: w0.lv[0], bait: true };
      } else hit = rollWild(R.pool, (typeof WILD_SCENE !== 'undefined' && WILD_SCENE[bgKey]) || null, rand);
    }
    var shiny = rollShiny(hit.w, rand);
    if (corrupt) hit = { w: hit.w, lv: 40 + Math.floor(rand() * 11), bait: hit.bait };   // 瘴气化后：强制 LV40–50
    return { sid: hit.w.sid, lv: hit.lv, rate: hit.w.rate, shiny: shiny, corrupt: corrupt, bait: !!hit.bait, horn: kind === 'horn' };
  }
  function wildFoe(a, o, rand) {
    var s = SPMAP[o.sid];
    if (o.odo) return { id: 'odo', lv: o.lv, moves: ACC.defaultMoves('odo', o.lv).filter(function (n) { return n !== '歼灭形态' && n !== '护阵形态'; }), nick: o.odo.n, img: SPRITES.odo, maxhp: o.odo.maxhp, boss: JSON.parse(JSON.stringify(o.odo.boss)) };
    if (o.corrupt) {   // 瘴气异变：强制最高阶段立绘、只会用攻击技能、深度侵蚀双攻 +100%
      return { id: o.sid, lv: o.lv, moves: puppetMoves(o.sid), nick: '瘴气' + s.name, img: o.shiny === 2 ? (SHINY_SPRITES[o.sid + '_2'] || SHINY_SPRITES[o.sid] || SPRITES[o.sid]) : o.shiny ? (SHINY_SPRITES[o.sid] || SPRITES[o.sid]) : SPRITES[o.sid], shiny: ACC.shinyV(o.shiny), miasma: o.miasma, boss: { erode: 1, mute: 1 } };
    }
    var f = ACC.battleMon(a, { sid: o.sid, lv: o.lv, moves: ACC.foeMoves(o.sid, o.lv, undefined, rand), shiny: ACC.shinyV(o.shiny) });
    delete f.u; delete f.hl;
    if (o.shiny) f.nick = '异色' + f.nick;
    if (o.taint) { f.miasma = o.miasma; f.nick = '被污染的' + f.nick; }
    return f;
  }
  MODES.wild = {
    // args = { sp: 服务器刷出来的那只（server/pve.js 按编号取出，放在 args._sp） } 或 { travel: 小时编号 }
    start: function (a, args, env) {
      var o, R;
      if (args.odo != null) {   // 坎伯兰星保卫战的奥多亚克
        var q = kbwAt(env.now, a).filter(function (x) { return x.k === (args.odo | 0); })[0];   // 按编号找（先遣的是 100+j）
        if (!kbwOpen(a) || !q) return { err: '奥多亚克已经潜回深海了。' };
        if (kbwFought(a, q.h, q.k)) return { err: '这只奥多亚克已经交过手了。' };
        if (!q.p) { if (!a.kbw || a.kbw.h !== q.h || !Array.isArray(a.kbw.k)) a.kbw = { h: q.h, k: [] }; a.kbw.k.push(q.k); }   // 先遣的不记（输了可以再打）
        R = regionById(q.rid);
        o = { sid: 'odo', lv: q.m.lv, rate: 0, noCatch: true, odo: q.m, odoP: q.p ? q.k - 100 : null, foe: '坎伯兰星保卫战', tag: ' · ' + (q.p ? '先遣' : '') + q.m.n, rid: R.id };
      } else if (args.travel != null) {
        var t = travelAt(env.now);
        if (!done(a, 'travelcat') || !t.active || t.h !== (args.travel | 0)) return { err: '叶子喵已经背起行囊，去别的地方旅行了。' };
        if (a.travel && a.travel.h === t.h) return { err: '这次已经和叶子喵切磋过了。' };
        a.travel = { h: t.h }; R = regionById(t.rid);
        o = { sid: TRAVEL.sid, lv: TRAVEL.lv, rate: 0, noCatch: true, travel: true, foe: '旅行精灵', tag: ' · 旅行精灵', rid: R.id };
      } else {
        var sp = args._sp; if (!sp) return { err: '它已经离开了。' };
        if (sp.mystery) o = { sid: sp.sid, lv: sp.lv, rate: sp.rate, shiny: sp.shiny, foe: '神秘精灵', tag: '' };
        else {
          R = regionById(sp.rid); if (!R || !regionOpen(a, R)) return { err: '这个区域还没有开放' };
          o = { sid: sp.sid, lv: sp.lv, rate: sp.rate, shiny: sp.shiny, corrupt: sp.corrupt, bait: sp.bait, rid: R.id, flora: R.planet === 'flora', tag: '' };
        }
        if (sp.horn) { if (!(a.items && a.items.m_horn > 0)) return { err: '奇声号角已经用完了' }; a.items.m_horn--; o.tag += ' · 号角引来的塞米'; }
        if (o.corrupt) { o.miasma = 10; o.noCatch = true; o.foe = '瘴气侵蚀的狂暴精灵'; o.tag += ' · 瘴气异变'; }
        else if (o.flora && purgeActive(a) && env.rand() < PURGE.chance) { o.taint = true; o.miasma = 5; o.noCatch = true; o.foe = '被瘴气污染的野生精灵'; o.tag += ' · 瘴气精灵'; }
        if (o.flora && spareActive(a) && !o.corrupt) { o.spare = true; o.tag += ' · 手下留情'; }
      }
      ACC.seeMon(a, o.sid, o.lv);
      var T = myTeam(a);
      return { p: T.p, a: [wildFoe(a, o, env.rand)], ctx: { o: o, team: T.us }, dirty: true,
        S: { wild: { rate: o.rate, noCatch: !!o.noCatch, spare: !!o.spare, back: '', where: '' } },
        opt: { foe: o.foe || '野生精灵', bgm: o.corrupt ? 'disCommunication' : o.odo ? 'boss3' : null, tag: o.tag, rid: o.rid, corrupt: !!o.corrupt, travel: !!o.travel } };
    },
    end: function (a, c, B, env) {
      var o = c.o, rep = { res: B.res, sid: o.sid, lv: o.lv, travel: !!o.travel }, downs = (B.downs || []).slice();
      if (B.res === 'spared') {   // 「假装击败」：它逃走了，照样算击败（有经验），并计入主线任务
        downs.push({ id: o.sid, lv: o.lv });
        var sp = ACC.prog(a, 'flora2'); sp.spare = Math.min(SPARE_N, (sp.spare || 0) + 1); rep.spare = sp.spare; rep.spareN = SPARE_N;
      }
      if (B.res === 'caught') { var g = ACC.giveMon(a, o.sid, o.lv, env, o.shiny); rep.caught = { u: g.m.u, added: g.added }; }
      var n = downs.length;
      if (n) { if (!a.stats) a.stats = {}; a.stats.wildWins = (a.stats.wildWins || 0) + n; }
      rep.downs = n;
      if ((o.taint || (o.corrupt && purgeActive(a))) && n) {   // 祛除瘴气
        var P = purgeRec(a); P.n++; rep.purge = { n: P.n, goal: PURGE.goal, steps: [] };
        PURGE.steps.forEach(function (st) {
          if (P.n >= st.n && !P.got[st.n]) {
            P.got[st.n] = env.now; a.exp = (a.exp || 0) + st.exp; var e = { n: st.n, exp: st.exp };
            if (st.title) { if (!a.titles) a.titles = []; if (a.titles.indexOf(st.title) < 0) a.titles.push(st.title); e.title = st.title; }
            rep.purge.steps.push(e);
          }
        });
      }
      if (o.corrupt && n) a.miaK = (a.miaK || 0) + n;   // 2026-10-27：本账号累计击败的瘴气污染精灵（第十一段要 10 只）
      if (o.corrupt && pwOpen(a) && n) {   // 瘴气驱逐战
        var d = bjDay(env.now); if (!a.pwd || a.pwd.d !== d) a.pwd = { d: d, n: 0 };
        if (a.pwd.n < PW.cap) {
          a.pwd.n++; var pw = env.pw ? env.pw() : null;   // 服务器：记一次全服击破，返回全服的进度
          var pe = pw && pw.total >= 1000 && (pw.me || 0) > 5 ? Math.floor(PW.exp / 4) : PW.exp;
          a.exp = (a.exp || 0) + pe; rep.pw = { n: a.pwd.n, cap: PW.cap, exp: pe, data: pw };
        } else rep.pw = { full: true, cap: PW.cap };
      }
      if (o.odo && n) {   // 坎伯兰星保卫战
        var dk = bjDay(env.now); if (!a.kbwd || a.kbwd.d !== dk) a.kbwd = { d: dk, n: 0 };
        a.kbwK = (a.kbwK || 0) + 1;
        if (o.odoP != null) { if (!Array.isArray(a.kbwS)) a.kbwS = []; if (a.kbwS.indexOf(o.odoP) < 0) a.kbwS.push(o.odoP); }
        if (a.kbwd.n < KBW.cap) { a.kbwd.n++; var kw = env.kbw ? env.kbw() : null; a.exp = (a.exp || 0) + KBW.exp; rep.kbw = { n: a.kbwd.n, cap: KBW.cap, exp: KBW.exp, me: a.kbwK, need: KBW.need, data: kw }; }
        else rep.kbw = { full: true, cap: KBW.cap, me: a.kbwK, need: KBW.need };
      }
      if (o.travel && n) { var lf = env.rand() < TRAVEL.leaf; a.exp = (a.exp || 0) + TRAVEL.exp; if (lf) ACC.addItems(a, { m_lcleaf: 1 }); rep.trav = { exp: TRAVEL.exp, leaf: lf }; }
      if (o.sid === 'hephaestus' && n) { var hn = 0; downs.forEach(function () { hn += hornDrop(env.rand); }); ACC.addItems(a, { m_hfhorn: hn }); rep.horn = hn; }
      if (o.sid === 'mush' && n) { var ps = 0; downs.forEach(function () { if (env.rand() < 0.1) ps++; }); if (ps) { ACC.addItems(a, { m_psac: ps }); rep.psac = ps; } }   // 2026-10-27：玛西一族 10% 掉落蘑菇毒囊
      if (o.sid === 'hauris' && n) { var hd = 0; downs.forEach(function () { hd += 50 + Math.floor(env.rand() * 21); }); ACC.addItems(a, { hrDisk: hd }); rep.disk = hd; }
      if (o.bait && (B.res === 'caught' || n)) { a.riceBowl = null; rep.bowl = true; }
      if (o.flora && n) { var seeds = 0; downs.forEach(function () { if (env.rand() < RICE.seedDrop) seeds++; }); if (seeds) { ACC.addItems(a, { s_rice: seeds }); rep.seeds = seeds; } }
      rep.xp = ACC.battleXp(a, c.team, B.seen, downs, env);
      return rep;
    }
  };

  /* ==========================================================
   * 竞技对战：平衡排位（rank）和沙盒对战（sandbox）（2026-10-25）
   * 段位（存档里的 hs-rank-v1）和本局阵容（hs-draft-v1）只由服务器改：env.data 是整份存档，这两个模式直接读写它。
   * ========================================================== */
  var RANK_EXP = 1000, RANK_EXP_N = 10, RANK_TOKEN = 20;   // 平衡排位：每天前 10 局各给 1000 累积经验和 20 竞技代币（认输不算）
  function readKey(data, k) { try { return JSON.parse((data && data[k]) || 'null'); } catch (e) { return null; } }
  function rankState(data) { var R = readKey(data, 'hs-rank-v1'); if (!R || R.r == null) R = { r: 0, stars: 0, w: 0, l: 0, best: 0 }; return fixRank(R); }
  function newDraft() { return { opts: drawDraft(), pick: null, order: null }; }
  // 打完一局：星数、小段、段位怎么变（和 battle-ui.js 以前的 applyRank 一样），返回显示用的变化
  function rankApply(R, result) {
    fixRank(R); var x = { from: R.r, fromDv: R.dv, fromStars: R.stars };
    if (result === 'win') {
      R.w = (R.w || 0) + 1; R.stars = (R.stars || 0) + 1;
      if (R.r < KING && R.stars >= 3) {
        R.stars = 0;
        if (hasDiv(R.r) && R.dv > 1) { R.dv--; x.kind = 'up'; x.msg = '晋级成功，升入' + rankFull(R.r, R.dv); }
        else { R.r++; if (hasDiv(R.r)) R.dv = DIVS; else delete R.dv; x.kind = 'up'; x.msg = '晋级成功，进入' + rankFull(R.r, R.dv) + (hasDiv(R.r) ? '' : '段位'); }
      } else x.msg = R.r === KING ? '王者段位，星数 +1' : '星数 +1，再胜 ' + (3 - R.stars) + ' 局即可晋级';
    } else if (result === 'lose') {
      R.l = (R.l || 0) + 1;
      if (R.stars > 0) { R.stars--; x.msg = '星数 −1'; }
      else if (hasDiv(R.r) && R.dv < DIVS) { R.dv++; R.stars = 2; x.kind = 'down'; x.msg = '降至' + rankFull(R.r, R.dv); }
      else if (R.r > 0) { R.r--; if (hasDiv(R.r)) R.dv = 1; else delete R.dv; R.stars = 2; x.kind = 'down'; x.msg = '降级至' + rankFull(R.r, R.dv) + (hasDiv(R.r) ? '' : '段位'); }
      else x.msg = '黑铁为最低段位，不再降级';
    } else x.msg = '平局，星数不变';
    if (R.r > (R.best || 0)) { R.best = R.r; if (hasDiv(R.r)) R.bestDv = R.dv; else delete R.bestDv; }
    else if (R.r === R.best && hasDiv(R.r) && R.dv < (R.bestDv || DIVS + 1)) R.bestDv = R.dv;
    if (R.r === KING) R.kingBest = Math.max(R.kingBest || 0, R.stars);
    x.to = R.r; x.toDv = R.dv; x.toStars = R.stars; return x;
  }
  // 玩家自己配的技能：只能是这只精灵会的技能（含隐藏技能），最多 4 个；不合格的用默认配招
  function arenaMoves(id, mv) {
    var s = SPMAP[id], own = s.moves.concat(s.hidden);
    var out = (Array.isArray(mv) ? mv : []).filter(function (n, i, a) { return typeof n === 'string' && M[n] && own.indexOf(n) >= 0 && a.indexOf(n) === i; }).slice(0, 4);
    return out.length ? out : s.def.slice(0, 4);
  }
  MODES.rank = {
    // args = { order: 出场顺序（本局阵容的 5 只）, moves: { 精灵: [技能] } }
    start: function (a, args, env) {
      var data = env.data, d = readKey(data, 'hs-draft-v1');
      if (!d || !d.opts || d.used) return { err: '本局阵容已经失效了，请重新选择阵容', draft: true };
      var pick = args.pick === 1 ? 1 : 0; if (d.pick === 0 || d.pick === 1) pick = d.pick;
      var team = d.opts[pick], ord = Array.isArray(args.order) ? args.order : [];
      if (!(ord.length === team.length && team.every(function (id) { return ord.indexOf(id) >= 0; }))) ord = team.slice();
      var p = ord.map(function (id) { return { id: id, moves: arenaMoves(id, args.moves && args.moves[id]) }; });
      var R = rankState(data), foes = buildAITeam(R.r, ord, R.stars, R.dv);
      d.used = true; d.pick = pick; d.order = ord; data['hs-draft-v1'] = JSON.stringify(d);
      return { p: p, a: foes, ctx: { r: R.r }, noItems: true, noStory: true, keys: ['hs-draft-v1'],
        S: { mode: 'rank', rankAt: R.r, rankDv: R.dv, ai: rankAI(R.r, R.stars, R.dv), noLimit: false }, opt: {} };
    },
    end: function (a, c, B, env) {
      var data = env.data, R = rankState(data), x = rankApply(R, B.res), rep = { res: B.res, quit: B.quit, x: x };
      data['hs-rank-v1'] = JSON.stringify(R);
      if (!B.quit) {
        var d0 = bjDay(env.now), n = a.rankExp && a.rankExp.d === d0 ? a.rankExp.n || 0 : 0;
        if (n < RANK_EXP_N) { a.rankExp = { d: d0, n: n + 1 }; a.exp = (a.exp || 0) + RANK_EXP; a.tokens = (a.tokens || 0) + RANK_TOKEN; rep.rexp = { exp: RANK_EXP, tok: RANK_TOKEN, n: n + 1, max: RANK_EXP_N }; }
        else rep.rexp = { full: true, max: RANK_EXP_N };
      }
      rep.keys = ['hs-rank-v1'];
      return rep;
    }
  };
  MODES.sandbox = {
    // args = { team: [{ id, moves }] }：沙盒随便选 5 只，对手随机；没有奖励（只算每日任务）
    start: function (a, args, env) {
      var team = (Array.isArray(args.team) ? args.team : []).filter(function (t) { return t && SPMAP[t.id] && SP.some(function (x) { return x.id === t.id; }); }).slice(0, 5);
      var seen = {}; team = team.filter(function (t) { if (seen[t.id]) return false; seen[t.id] = 1; return true; });
      if (!team.length) return { err: '背包里还没有精灵' };
      var p = team.map(function (t) { return { id: t.id, moves: arenaMoves(t.id, t.moves) }; });
      var ids = shuffled(SP.map(function (s) { return s.id; })).slice(0, 5);
      var foes = ids.map(function (id) { return { id: id, moves: smartLoadout(id, 6, ids) }; });
      return { p: p, a: foes, ctx: {}, noItems: true, noStory: true, S: { noLimit: false }, opt: {} };
    },
    end: function (a, c, B, env) { return { res: B.res, quit: B.quit }; }
  };

  return { MODES: MODES, RANK_EXP: RANK_EXP, RANK_EXP_N: RANK_EXP_N, RANK_TOKEN: RANK_TOKEN, rankState: rankState, rankApply: rankApply, newDraft: newDraft, readKey: readKey, regionById: regionById, regionOpen: regionOpen, floraFallen: floraFallen, regionFallen: regionFallen, sceneCount: sceneCount, rollShiny: rollShiny, rollWild: rollWild,
    MYSTERY: MYSTERY, mysteryTime: mysteryTime, RICE: RICE, HORN: HORN, TRAVEL: TRAVEL, travelAt: travelAt, KBW: KBW, kbwAt: kbwAt, kbwOpen: kbwOpen, kbwFought: kbwFought, PURGE: PURGE, purgeRec: purgeRec, purgeActive: purgeActive, SPARE_N: SPARE_N, spareActive: spareActive, PW: PW, wildRoll: wildRoll, LEAF_ALLY: LEAF_ALLY, FIGHTS: FIGHTS, fightTeam: fightTeam, resolveFoeEntry: resolveFoeEntry, CUMBER: CUMBER, NPC_WIN_EXP: NPC_WIN_EXP, NPC_HOURS: NPC_HOURS, NPC_FROM: NPC_FROM, NPC_TO: NPC_TO, NPC_AI_RANK: NPC_AI_RANK, NPC: NPC, NPC_SECRET: NPC_SECRET, NPC_POOL: NPC_POOL, npcPlan: npcPlan, bjDay: bjDay, TEA_DAILY: TEA_DAILY, TEA_EXP: TEA_EXP, MM: MM, MM_NICK: MM_NICK, MM_TEAM: MM_TEAM, MM_TEAM_HARD: MM_TEAM_HARD, MM_DIFF: MM_DIFF, MM_FINAL: MM_FINAL, mmFoes: mmFoes, mmDay: mmDay, CHAL: CHAL, starOk: starOk, chalLevelOpen: chalLevelOpen, chalTotal: chalTotal, MM_HELPER: MM_HELPER, ONLY3: ONLY3, BOSSES: BOSSES, BOSS_CRY: BOSS_CRY, WEEKLIES: WEEKLIES, EWK: EWK, PERMIT: PERMIT, SECRET_FX: SECRET_FX,
    wkKey: wkKey, recKey: recKey, bossRec: bossRec, bossWon: bossWon, levelOpen: levelOpen, wkOpen: wkOpen, weeklyOpen: weeklyOpen, wkNum: wkNum, ewkPool: ewkPool, ewkType: ewkType, ewkSid: ewkSid, ewkFoes: ewkFoes, ewkDrop: ewkDrop,
    permits: permits, seedSeenFx: seedSeenFx, chalStars: chalStars, myTeam: myTeam,
    TOWER: TOWER, twLv: twLv, twExp: twExp, twTok: twTok, twFloor: twFloor, seeded: seeded, foeMoves: foeMoves, storyMon: storyMon,
    PVE_XP_CAP: PVE_XP_CAP, foeExp: foeExp, foeEv: foeEv, dayStr: dayStr, xpSplit: xpSplit, towerStart: towerStart, towerEnd: towerEnd, towerApply: towerApply };
})();
if (typeof module !== 'undefined') module.exports = PVE;
