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
  function done(a, id) { return ACC.done(a, id); }
  function chalStars(a, id) { var r = a && a.chal && a.chal[id]; return r && Array.isArray(r.s) ? r.s.filter(Boolean).length : 0; }
  function myTeam(a) { var t = ACC.team(a); return { us: t.map(function (m) { return m.u; }), p: t.map(function (m) { return ACC.battleMon(a, m); }) }; }

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
        { diff: '困难', lv: 70, hp: 2500, boss: { dr: 0.15, ambush: 400, odoRate: 1, odoWill: 1, rainbow: 1, odoSwap: 1, pp: 99 }, bgm: 'boss3', open: function (a, now) { return bossWon(a, 'odo', 1); }, lockText: '击败普通难度后开放', reward: { exp: 50000, items: { odoFin: 80 } },
          hpText: '歼灭形态 2500 · 护阵形态 5000 · 虹霓暴走 4000', bgmAt: { 2: 'vitalVoyage' },
          team: [
            { nick: '奥多亚克 · 歼灭形态', odoForm: 'atk', maxhp: 2500, boss: { dr: 0.15, ambush: 400, odoRate: 1, odoSwap: 1, orderRepl: 1, pp: 99 } },
            { nick: '奥多亚克 · 护阵形态', odoForm: 'def', maxhp: 5000, boss: { dr: 0.15, ambush: 400, odoWill: 1, odoSwap: 1, orderRepl: 1, pp: 99 } },
            { nick: '奥多亚克 · 虹霓暴走', maxhp: 4000, moves: ['流形蛮冲', '全弹搭载', '究极爆破', '解析导弹', '坚守阵地', '强效外壳', '重构坚甲', '侵扰投弹'],   // 掌握歼灭、护阵两种形态的全部技能
              boss: { dr: 0.15, rainbow: 1, orderRepl: 1, pp: 99 } }
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
    types: [{ t: '草', item: 'floraJade' }, { t: '水', item: 'kbDrop' }, { t: '火', item: 'ppAsh' }, { t: '冰', item: 'whFrost' }, { t: '电', item: 'ltOrb' }],
    lv: [
      { diff: '简单', lv: 40, hp: 2000, boss: { pp: 99 }, bgm: 'boss', drop: [8, 12], exp: 3000 },
      { diff: '普通', lv: 60, hp: 5000, boss: { dr: 0.15, pp: 99 }, bgm: 'boss2', drop: [16, 24], exp: 6000 },
      { diff: '困难', lv: 80, hp: 10000, boss: { dr: 0.2, noStatus: 1, pp: 99 }, bgm: 'boss3', drop: [30, 45], exp: 12000 }
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
  function ewkSid(t, now) { var P = ewkPool(t), i = EWK.types.indexOf(ewkType(t)); return P.length ? P[ACC.thash(wkNum(now) * 7 + i * 131 + 17) % P.length] : null; }
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
  function bossStart(a, k, d, recName, env) {
    seedSeenFx(a, env.now);
    var T = myTeam(a), foes = bossFoes(a, k, d);
    ACC.seeMon(a, BOSSES[k].sid, BOSSES[k].lv[d].lv);
    bossRec(a, k, recName).tries++;
    return { T: T, foes: foes };
  }
  MODES.boss = {
    start: function (a, args, env) {
      var k = String(args.k || ''), d = args.d | 0, B = BOSSES[k], L = B && B.lv[d];
      if (!L || !L.open(a, env.now)) return { err: '这一档难度还没有开放' };
      var x = bossStart(a, k, d, d, env);
      return { p: x.T.p, a: x.foes, ctx: { k: k, d: d, team: x.T.us }, dirty: true, opt: { foe: 'BOSS', diff: L.diff + '难度', bgm: L.bgm, bgmAt: L.bgmAt || null }, S: { bgmAt: L.bgmAt || null } };
    },
    end: function (a, c, B, env) {
      var L = BOSSES[c.k].lv[c.d], rec = bossRec(a, c.k, c.d), wasWeekly = weeklyOpen(a), rep = { k: c.k, d: c.d, res: B.res, first: false };
      if (B.res === 'win') {
        rep.first = !rec.wins; rec.wins++;
        if (rep.first) { rep.fr = firstReward(a, L.reward, env); rep.weeklyNew = !wasWeekly && weeklyOpen(a); }
      }
      rep.xp = ACC.battleXp(a, c.team, B.seen, B.downs, env);
      if (weeklyOpen(a)) permits(a, env.now);
      return rep;
    }
  };
  MODES.weekly = {
    start: function (a, args, env) {
      var k = String(args.k || ''), d = args.d | 0, B = BOSSES[k], WK = WEEKLIES.filter(function (x) { return x.boss === k && x.d === d; })[0];
      if (!B || !WK || !wkOpen(a, WK)) return { err: '这个每周挑战还没有开放' };
      if (permits(a, env.now) < 1) return { err: '挑战许可用完了。' };
      var L = B.lv[d], x = bossStart(a, k, d, wkKey(WK), env);
      return { p: x.T.p, a: x.foes, ctx: { k: k, d: d, team: x.T.us }, dirty: true, opt: { foe: 'BOSS', diff: '每周挑战', bgm: L.bgm, bgmAt: L.bgmAt || null }, S: { bgmAt: L.bgmAt || null } };
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
      rep.xp = ACC.battleXp(a, c.team, B.seen, B.downs, env);
      permits(a, env.now);
      return rep;
    }
  };
  MODES.ewk = {
    start: function (a, args, env) {
      var t = String(args.t || ''), d = args.d | 0, T = ewkType(t), sid = T && ewkSid(t, env.now), L = EWK.lv[d];
      if (!sid || !L || !weeklyOpen(a)) return { err: '这个每周挑战还没有开放' };
      if (permits(a, env.now) < 1) return { err: '挑战许可用完了。' };
      seedSeenFx(a, env.now);
      var Tm = myTeam(a), S = SPMAP[sid];
      ACC.seeMon(a, sid, L.lv); bossRec(a, 'ewk_' + t, d).tries++;
      return { p: Tm.p, a: [{ id: sid, lv: L.lv, moves: ACC.defaultMoves(sid, L.lv), nick: S.name, img: SPRITES[sid], maxhp: L.hp, boss: JSON.parse(JSON.stringify(L.boss)) }],
        ctx: { t: t, d: d, sid: sid, team: Tm.us }, dirty: true, opt: { foe: 'BOSS', diff: t + '系每周挑战 · ' + L.diff, bgm: L.bgm } };
    },
    end: function (a, c, B, env) {
      var T = ewkType(c.t), L = EWK.lv[c.d], rec = bossRec(a, 'ewk_' + c.t, c.d), rep = { t: c.t, d: c.d, sid: c.sid, res: B.res };
      if (B.res === 'win') {
        rec.wins++; permits(a, env.now); useOne(a);
        var n = L.drop[0] + Math.floor(env.rand() * (L.drop[1] - L.drop[0] + 1)), it = {}; it[T.item] = n;
        ACC.addItems(a, it); a.exp = (a.exp || 0) + L.exp;
        rep.drop = { item: T.item, n: n, exp: L.exp };
      }
      rep.xp = ACC.battleXp(a, c.team, B.seen, B.downs, env);
      return rep;
    }
  };

  /* ---------- 星球挑战 ----------
   * 从左到右一条链，每个节点是一关，按顺序开放；每关三颗星。可以带 1 只助战（明明教官的赫菲托斯，或好友名片上的助战精灵）。
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

  return { MODES: MODES, CHAL: CHAL, starOk: starOk, chalLevelOpen: chalLevelOpen, chalTotal: chalTotal, MM_HELPER: MM_HELPER, ONLY3: ONLY3, BOSSES: BOSSES, BOSS_CRY: BOSS_CRY, WEEKLIES: WEEKLIES, EWK: EWK, PERMIT: PERMIT, SECRET_FX: SECRET_FX,
    wkKey: wkKey, recKey: recKey, bossRec: bossRec, bossWon: bossWon, levelOpen: levelOpen, wkOpen: wkOpen, weeklyOpen: weeklyOpen, wkNum: wkNum, ewkPool: ewkPool, ewkType: ewkType, ewkSid: ewkSid,
    permits: permits, seedSeenFx: seedSeenFx, chalStars: chalStars, myTeam: myTeam,
    TOWER: TOWER, twLv: twLv, twExp: twExp, twTok: twTok, twFloor: twFloor, seeded: seeded, foeMoves: foeMoves, storyMon: storyMon,
    PVE_XP_CAP: PVE_XP_CAP, foeExp: foeExp, foeEv: foeEv, dayStr: dayStr, xpSplit: xpSplit, towerStart: towerStart, towerEnd: towerEnd, towerApply: towerApply };
})();
if (typeof module !== 'undefined') module.exports = PVE;
