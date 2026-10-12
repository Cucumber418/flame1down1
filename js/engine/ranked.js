/* ==========================================================
 * 平衡排位
 * 段位、电脑强度、配招、公平阵容抽取
 * ========================================================== */

/* ---------- 平衡排位：段位与电脑强度 ---------- */
var RANKS = ['黑铁', '青铜', '白银', '黄金', '铂金', '翡翠', '钻石', '星耀', '大师', '宗师', '王者'];
var RANK_COLOR = ['#5b5650', '#9a6436', '#8d97a3', '#c49a1c', '#3f8f8a', '#2f9a5e', '#3a6fc4', '#7b4fc9', '#b0398f', '#c4392f', '#d18a12'];
// 王者段位里，电脑随星数继续变强（每星一档，最多算到 KING_CAP 星）：能力值、阵容、配招、失误和换人都会提升
var KING = RANKS.length - 1, KING_CAP = 30;
function kingK(r, stars) { return r === KING ? Math.min(KING_CAP, Math.max(0, Math.floor(stars || 0))) : 0; }
function rankAI(r, stars) {
  var a = rankAI0(r), k = kingK(r, stars);
  if (k) {
    a.mult = Math.round((1.15 + 0.01 * k) * 100) / 100;   // 能力值倍率：王者 0 星 ×1.15，30 星 ×1.45
    a.noise = Math.max(0.02, 0.05 - 0.001 * k);           // 估分越来越准
    a.switchP = Math.min(0.8, 0.55 + 0.01 * k);           // 更常考虑换人
    a.threat = Math.max(0.6, 1 - 0.015 * k);              // 受到的威胁没那么大时也会提前换人躲克制
    a.picks = 12 + k;                                     // 配招时比较更多方案
    a.edge = Math.min(0.3, 0.01 * k);                     // 阵容强度比你高一点（30 星时预测胜率约 57%）
  }
  return a;
}
function rankAI0(r) {
  return {
    randomP: Math.max(0, 0.5 - 0.06 * r),          // 黑铁一半招式随便放，宗师以上不乱放
    noise: Math.max(0.05, 0.45 - 0.04 * r),         // 估分噪声越来越小
    switchP: Math.min(0.55, 0.05 * r),              // 越高越会换人躲克制
    dumbRepl: Math.max(0, 0.9 - 0.3 * r),           // 倒下后随便派人的概率
    picks: [0, 1, 1, 2, 3, 4, 5, 6, 8, 10, 12][r],  // 配招时比较的候选方案数（0 = 完全随机配招）
    mult: [0.82, 0.85, 0.88, 0.91, 0.94, 0.97, 1.0, 1.03, 1.06, 1.1, 1.15][r]   // 对手能力值倍率
  };
}
function rankDesc(r, stars) {
  var a = rankAI(r, stars), k = kingK(r, stars);
  if (k) return '王者 ' + stars + ' 星：电脑能力值 ×' + a.mult + ' · 对手阵容比你稍强' + ' · 几乎不失误 · 配招针对性强 · 更会换人躲克制' + (k >= KING_CAP ? ' · 已到最强' : ' · 星数越高越强');
  return '电脑能力值 ×' + a.mult + ' · ' + (r < 2 ? '经常乱放技能' : r < 5 ? '偶尔乱放技能' : r < 8 ? '很少失误' : '几乎不失误') +
    ' · ' + (r < 1 ? '技能完全随机配置' : r < 4 ? '配招较为随意' : r < 8 ? '会根据阵容调整配招' : '配招针对性强') + (r >= 4 ? ' · 会换人躲克制' : '');
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
  if (!ALL_TYPES) ALL_TYPES = Object.keys(TYPE_COLOR);
  var s = SPMAP[id], sc = 0, cover = {}, util = 0, phys = s.base.atk >= s.base.spa;
  mv.forEach(function (n) {
    var m = M[n];
    if (isAtk(n)) {
      var p = m.fixedOnly ? 90 : (m.power || 0) + (m.fixed || 0) * 0.6;
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
  var best = null, bv = -1;
  for (var i = 0; i < tries; i++) { var mv = randomLoadout(id), v = loadoutScore(id, mv, mates); if (v > bv) { bv = v; best = mv; } }
  return best;
}
// 隐藏强度值：由 5v5 模拟对战拟合得到（双方每局都随机配招），界面上不显示
// 隐藏强度值（对胜负的贡献，logit 尺度）：由 10000 场 5v5 模拟对战拟合，界面上不显示
// 预测胜率：P(A 胜 B) = 1 / (1 + e^-(ΣA − ΣB))
var STRENGTH = {"dragon": 0.252, "leaf": 0.166, "gorgon": -0.254, "squid": -0.224, "wind": 0.045, "pluto": 0.247, "pede": -0.226, "tagore": -0.261, "hauris": -0.221, "faraday": -0.155, "moon": 0.294, "frost": 0.094, "wild": -0.057, "hephaestus": 0.063, "leigong": -0.101, "inkarm": -0.164, "barren": 0.121, "mush": 0.021, "kaleo": 0.174, "siren": -0.157, "bone": -0.292, "aegis": -0.016, "leafcat": 0.337, "phantom": 0.316};
var TEAM_BAND = 0.15;          // 阵容强度总和须接近平均水平（|Σ| ≤ 0.15，约等于对平均阵容 46%~54%）
var MATCH_TOL = 0.04;          // 两套阵容的强度差上限：预测胜率 50% ± 1%
var ALL_TEAMS = null;
function teamPower(ids) { var s = 0; ids.forEach(function (id) { s += STRENGTH[id] || 0; }); return s; }
function predictWin(a, b) { return 1 / (1 + Math.exp(-(teamPower(a) - teamPower(b)))); }
function allTeams() {
  if (ALL_TEAMS) return ALL_TEAMS;
  var ids = SP.map(function (s) { return s.id; }).filter(function (id) { return STRENGTH[id] != null; }), out = [];
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
function buildAITeam(r, vsIds, stars) {
  var a = rankAI(r, stars);
  return (vsIds ? drawFairTeam(null, teamPower(vsIds) + (a.edge || 0)) : drawFairTeam()).map(function (id) {
    return { id: id, moves: null, mult: a.mult };
  }).map(function (t, k, team) {
    t.moves = a.picks ? smartLoadout(t.id, a.picks, team.map(function (x) { return x.id; })) : shuffled(SPMAP[t.id].moves.concat(SPMAP[t.id].hidden)).slice(0, 4);
    return t;
  });
}
if (typeof module !== 'undefined') module.exports = { predictWin: predictWin, teamPower: teamPower, allTeams: allTeams, newTraining: newTraining, MAX_TURNS: MAX_TURNS, randomLoadout: randomLoadout, smartLoadout: smartLoadout, drawDraft: drawDraft, fairTeams: fairTeams, STRENGTH: STRENGTH, RANKS: RANKS, rankAI: rankAI, buildAITeam: buildAITeam, eff: eff, effT: effT, typesOf: typesOf, M: M, SP: SP, EXTRA_SP: EXTRA_SP, SPMAP: SPMAP, NATURES: NATURES, fullStat: fullStat, accMult: accMult, newBattle: newBattle, resolveTurn: resolveTurn, aiChoose: aiChoose, playerReplace: playerReplace, pvpReplace: pvpReplace, snap: snap, aiPickReplacement: aiPickReplacement, act: act, aliveIdx: aliveIdx, setRNG: function (f) { RNG = f; } };
