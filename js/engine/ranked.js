/* ==========================================================
 * 平衡排位
 * 段位、电脑强度、配招、公平阵容抽取
 * ========================================================== */

/* ---------- 平衡排位：段位与电脑强度 ---------- */
var RANKS = ['黑铁', '青铜', '白银', '黄金', '铂金', '翡翠', '钻石', '星耀', '大师', '宗师', '王者'];
var RANK_COLOR = ['#5b5650', '#9a6436', '#8d97a3', '#c49a1c', '#3f8f8a', '#2f9a5e', '#3a6fc4', '#7b4fc9', '#b0398f', '#c4392f', '#d18a12'];
// 铂金到宗师每个段位分成 V、IV、III、II、I 五个小段（V 最低），每个小段 3 星
var DIV_FROM = 4, DIV_TO = 9, DIVS = 5, ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
function hasDiv(r) { return r >= DIV_FROM && r <= DIV_TO; }
function rankFull(r, dv) { return (RANKS[r] || '') + (hasDiv(r) && dv ? ' ' + ROMAN[dv] : ''); }
// 补齐小段（旧存档没有小段：留在这个段位的 I 段，进度不变）
function fixRank(R) {
  if (!R) return R;
  if (hasDiv(R.r)) { if (!(R.dv >= 1 && R.dv <= DIVS)) R.dv = 1; } else delete R.dv;
  R.best = Math.max(R.best || 0, R.r || 0);
  if (hasDiv(R.best)) {
    if (!(R.bestDv >= 1 && R.bestDv <= DIVS)) R.bestDv = R.best === R.r ? R.dv : 1;
    if (R.best === R.r && R.dv < R.bestDv) R.bestDv = R.dv;
  } else delete R.bestDv;
  return R;
}
// 王者段位里，电脑随星数继续变强（最多算到 KING_CAP 星）。增长先快后慢，到封顶时自然停下，不会突然卡住
var KING = RANKS.length - 1, KING_CAP = 50;
// 起始斜率：宗师每个小段 3 星、倍率 +0.01，即每星 +0.01/3；换算到 0~1 曲线上（王者封顶共 +0.30）
var KING_M0 = (0.01 / 3) * KING_CAP / 0.30;
function kingK(r, stars) { return r === KING ? Math.min(KING_CAP, Math.max(0, Math.floor(stars || 0))) : 0; }
// 段位的连续刻度：黑铁 0 … 宗师 9；铂金到宗师每个小段 +0.2（铂金 V = 4.0，铂金 I = 4.8）；王者 0 星 = 10
function rankX(r, dv) { return hasDiv(r) ? r + (DIVS - (dv || 1)) / DIVS : r; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rankAI(r, stars, dv) {
  if (r === KING) {
    // 0 → 1 的平滑曲线：刚进王者时每星的增长速度和宗师里一样（宗师每星约 +0.0033 倍率），中段稍快，接近封顶时慢慢停下
    var t = kingK(r, stars) / KING_CAP, m0 = KING_M0, e = (t * t * t - 2 * t * t + t) * m0 + (-2 * t * t * t + 3 * t * t);
    var a = rankAI0(KING);
    a.mult = Math.round((1.15 + 0.30 * e) * 1000) / 1000;   // 能力值倍率：王者 0 星 ×1.15，封顶 ×1.45
    a.noise = Math.round((0.05 - 0.03 * e) * 1000) / 1000;  // 估分越来越准
    a.switchP = 0.5 + 0.3 * e;                              // 更常考虑换人
    a.threat = 1 - 0.4 * e;                                 // 受到的威胁没那么大时也会提前换人躲克制
    a.picks = Math.round(12 + 30 * e);                      // 配招时比较更多方案
    a.edge = Math.round(0.3 * e * 1000) / 1000;             // 阵容强度比你高一点（封顶时预测胜率约 57%）
    return a;
  }
  // 其他段位：在相邻两个段位之间按小段插值，铂金 V → 铂金 I → 翡翠 V 一格一格平滑变强
  var x = rankX(r, dv), lo = Math.floor(x), hi = Math.min(KING, lo + 1), f = x - lo, A0 = rankAI0(lo), A1 = rankAI0(hi), o = {};
  Object.keys(A0).forEach(function (k) { o[k] = lerp(A0[k], A1[k], f); });
  o.mult = Math.round(o.mult * 1000) / 1000; o.picks = Math.round(o.picks);
  return o;
}
function rankAI0(r) {
  return {
    randomP: Math.max(0, 0.5 - 0.06 * r),          // 黑铁一半招式随便放，宗师以上不乱放
    noise: Math.max(0.05, 0.45 - 0.04 * r),         // 估分噪声越来越小
    switchP: Math.min(0.5, 0.05 * r),               // 越高越会换人躲克制
    dumbRepl: Math.max(0, 0.9 - 0.3 * r),           // 倒下后随便派人的概率
    picks: [0, 1, 1, 2, 3, 4, 5, 6, 8, 10, 12][r],  // 配招时比较的候选方案数（0 = 完全随机配招）
    mult: [0.82, 0.85, 0.88, 0.91, 0.94, 0.97, 1.0, 1.03, 1.06, 1.1, 1.15][r]   // 对手能力值倍率
  };
}
function rankDesc(r, stars, dv) {
  var a = rankAI(r, stars, dv), k = kingK(r, stars), x = rankX(r, dv);
  if (r === KING) return '王者 ' + (stars || 0) + ' 星：电脑能力值 ×' + a.mult + (a.edge >= 0.01 ? ' · 对手阵容比你稍强' : '') + ' · 几乎不失误 · 配招针对性强 · 更会换人躲克制' + (k >= KING_CAP ? ' · 已到最强' : ' · 星数越高越强');
  return '电脑能力值 ×' + a.mult + ' · ' + (x < 2 ? '经常乱放技能' : x < 5 ? '偶尔乱放技能' : x < 8 ? '很少失误' : '几乎不失误') +
    ' · ' + (x < 1 ? '技能完全随机配置' : x < 4 ? '配招较为随意' : x < 8 ? '会根据阵容调整配招' : '配招针对性强') + (x >= 4 ? ' · 会换人躲克制' : '');
}
/* ---------- 配招 ----------
   每只精灵有 11 个技能可选 4 个，没有唯一最优解。
   randomLoadout：随机一套“能打”的配招（至少 2 个攻击技能），用于测算强度和低段位电脑。
   smartLoadout：生成若干候选方案，按“输出 + 属性覆盖 + 功能性 + 与队友互补”打分，取较好的一套。 */
function isAtk(n) { return M[n].cat !== '变化'; }
function randomLoadout(id) {
  var s = SPMAP[id], pool = s.moves.concat(s.hidden), atk = pool.filter(isAtk), oth = pool.filter(function (n) { return !isAtk(n); });
  var nAtk = Math.min(atk.length, 2 + Math.floor(RNG() * 3));          // 2~4 个攻击技能
  var pick = shuffled(atk).slice(0, nAtk).concat(shuffled(oth).slice(0, 4 - nAtk));
  if (pick.length < 4) pick = pick.concat(shuffled(pool.filter(function (n) { return pick.indexOf(n) < 0; })).slice(0, 4 - pick.length));
  return pick;
}
var ALL_TYPES = null;
function loadoutScore(id, mv, mates) {
  if (!ALL_TYPES) { var rt = {}; RANK_ROSTER.forEach(function (x) { x.types.forEach(function (t) { rt[t] = 1; }); }); ALL_TYPES = Object.keys(TYPE_COLOR).filter(function (t) { return rt[t]; }); }   // 只算竞技名单里有的属性：新属性不影响平衡排位
  var s = SPMAP[id], sc = 0, cover = {}, util = 0, phys = s.base.atk >= s.base.spa;
  mv.forEach(function (n) {
    var m = M[n];
    if (isAtk(n)) {
      var p = m.fixedOnly ? 90 : (m.power || 0) + (m.fixed || (m.fixedLv || 0) * LV) * 0.6;
      if (m.hits) p *= (m.hits[0] + m.hits[1]) / 2;
      if (s.types.indexOf(m.type) >= 0) p *= STAB;
      if ((m.cat === '物攻') === phys) p *= 1.2;
      p *= (m.acc || 100) / 100;
      if (m.pri) p *= 1.15;
      if (m.drain) p *= 1.1;
      sc += p;
      ALL_TYPES.forEach(function (d) { if (eff(m.type, d) > 1) cover[d] = 1; });
    } else util++;
  });
  sc += 18 * Object.keys(cover).length;
  sc += util === 1 ? 120 : util === 2 ? 150 : util === 3 ? 70 : 0;           // 带 1~2 个功能技能最灵活
  // 和队友互补：属性覆盖与已有队友重复的部分打折
  if (mates) {
    var mateCover = {};
    mates.forEach(function (o) { if (o === id) return; SPMAP[o].types.forEach(function (t) { ALL_TYPES.forEach(function (d) { if (eff(t, d) > 1) mateCover[d] = 1; }); }); });
    Object.keys(cover).forEach(function (d) { if (!mateCover[d]) sc += 10; });
  }
  return sc * (0.85 + RNG() * 0.3);
}
function smartLoadout(id, tries, mates) {
  // 2026-10-19：不总取最优的一套，而是在得分前一半的方案里随机挑一套
  var c = [];
  for (var i = 0; i < tries; i++) { var mv = randomLoadout(id); c.push({ mv: mv, v: loadoutScore(id, mv, mates) }); }
  c.sort(function (a, b) { return b.v - a.v; });
  return c[Math.floor(Math.random() * Math.max(1, Math.ceil(c.length / 2)))].mv;
}
// 隐藏强度值：由 5v5 模拟对战拟合得到（双方每局都随机配招），界面上不显示
// 隐藏强度值（对胜负的贡献，logit 尺度）：由 12000 场 5v5 模拟对战拟合（2026-10-13，S1 第二期名单：叶子喵移出、方头蘑菇加入），界面上不显示
// 预测胜率：P(A 胜 B) = 1 / (1 + e^-(ΣA − ΣB))
var STRENGTH = {"dragon": 0.351, "leaf": 0.157, "gorgon": -0.195, "squid": -0.044, "wind": 0.023, "pluto": 0.221, "pede": -0.245, "tagore": -0.208, "hauris": -0.166, "faraday": -0.043, "moon": 0.023, "frost": -0.02, "wild": 0.02, "hephaestus": 0.046, "leigong": -0.289, "inkarm": -0.001, "barren": 0.217, "mush": 0.016, "kaleo": 0.079, "siren": 0.003, "bone": -0.159, "aegis": -0.167, "shroom": -0.002, "phantom": 0.382};
var TEAM_BAND = 0.15;          // 阵容强度总和须接近平均水平（|Σ| ≤ 0.15，约等于对平均阵容 46%~54%）
var MATCH_TOL = 0.04;          // 两套阵容的强度差上限：预测胜率 50% ± 1%
var ALL_TEAMS = null;
function teamPower(ids) { var s = 0; ids.forEach(function (id) { s += STRENGTH[id] || 0; }); return s; }
function predictWin(a, b) { return 1 / (1 + Math.exp(-(teamPower(a) - teamPower(b)))); }
function allTeams() {
  if (ALL_TEAMS) return ALL_TEAMS;
  var ids = RANK_ROSTER.map(function (s) { return s.id; }), out = [];
  (function rec(st, cur) {
    if (cur.length === 5) { out.push({ ids: cur.slice(), p: teamPower(cur) }); return; }
    for (var i = st; i < ids.length; i++) { cur.push(ids[i]); rec(i + 1, cur); cur.pop(); }
  })(0, []);
  return (ALL_TEAMS = out);
}
function fairTeams() { return allTeams().filter(function (t) { return Math.abs(t.p) <= TEAM_BAND; }).map(function (t) { return t.ids; }); }
function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(RNG() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
// 抽一套阵容：target 为空时取平均水平附近；否则取与 target 强度差 ≤ MATCH_TOL 的阵容（预测胜率 50% ± 1%）。avoid 中的精灵尽量不重复
function drawFairTeam(avoid, target) {
  var all = allTeams(), tol = target == null ? TEAM_BAND : MATCH_TOL, c = target == null ? 0 : target, pool = [];
  for (var tries = 0; tries < 6 && !pool.length; tries++, tol *= 1.5) {
    pool = all.filter(function (t) { return Math.abs(t.p - c) <= tol && (!avoid || t.ids.every(function (id) { return avoid.indexOf(id) < 0; })); });
    if (!pool.length && avoid) pool = all.filter(function (t) { return Math.abs(t.p - c) <= tol; });
  }
  return shuffled(pool[Math.floor(RNG() * pool.length)].ids);
}
function drawDraft() { var a = drawFairTeam(); return [a, drawFairTeam(a, teamPower(a))]; }
function buildAITeam(r, vsIds, stars, dv) {
  var a = rankAI(r, stars, dv);
  return (vsIds ? drawFairTeam(null, teamPower(vsIds) + (a.edge || 0)) : drawFairTeam()).map(function (id) {
    return { id: id, moves: null, mult: a.mult };
  }).map(function (t, k, team) {
    t.moves = a.picks ? smartLoadout(t.id, a.picks, team.map(function (x) { return x.id; })) : shuffled(SPMAP[t.id].moves.concat(SPMAP[t.id].hidden)).slice(0, 4);
    return t;
  });
}
if (typeof module !== 'undefined') module.exports = { predictWin: predictWin, teamPower: teamPower, allTeams: allTeams, newTraining: newTraining, MAX_TURNS: MAX_TURNS, randomLoadout: randomLoadout, smartLoadout: smartLoadout, drawDraft: drawDraft, fairTeams: fairTeams, STRENGTH: STRENGTH, RANKS: RANKS, rankAI: rankAI, rankX: rankX, fixRank: fixRank, rankFull: rankFull, hasDiv: hasDiv, buildAITeam: buildAITeam, eff: eff, effT: effT, typesOf: typesOf, M: M, SP: SP, EXTRA_SP: EXTRA_SP, SPMAP: SPMAP, NATURES: NATURES, fullStat: fullStat, accMult: accMult, newBattle: newBattle, resolveTurn: resolveTurn, aiChoose: aiChoose, playerReplace: playerReplace, pvpReplace: pvpReplace, snap: snap, aiPickReplacement: aiPickReplacement, act: act, aliveIdx: aliveIdx, setRNG: function (f) { RNG = f; } };
