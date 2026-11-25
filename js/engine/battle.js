/* ==========================================================
 * 对战规则
 * 能力值计算、伤害公式、状态、回合流程、道具
 * ========================================================== */

var STG = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
var STG_NAME = { atk: '物攻', def: '物防', spa: '特攻', spd: '特防', spe: '速度', acc: '命中', eva: '闪避' };
var BASE_NAME = { hp: '体力', atk: '物攻', def: '物防', spa: '特攻', spd: '特防', spe: '速度' };
var RHYTHMS = { rhythmLight: { name: '耀音律', status: '失明' }, rhythmBurn: { name: '灼音律', status: '烧伤' }, rhythmConfuse: { name: '惑音律', status: '混乱' } };
var TM_NAME = { rhythmLight: '耀音律', rhythmBurn: '灼音律', rhythmConfuse: '惑音律', odoAtk: '全弹搭载', odoDef: '强效外壳', brandCd: '烙印冷却', etchCd: '蚀迹冷却', lmE: '雷明·电', lmL: '雷明·光', tcloud: '闪电云', cap: '逆鳞', genggu: '恒压', green: '绿色幻境', immune: '免疫异常', reflect: '风王结界', dodge: '光滑皮肤',
  noSwitch: '无法切换', prio: '先制+1', rain: '祈雨', tri: '三相归元', soul: '收魂',
  voidPhys: '虚空化', induct: '电磁感应', vortex: '闪电漩涡', fenglei: '风雷滚滚', counter: '反击风暴', parryBan: '被招架', noStat: '禁用变化', enCrit: '引爆', darkside: '月之暗面', hail: '冰雹', noBoost: '禁止强化',
  seal: '万灵封印', liuhuo: '流火', calm: '静谧水域', halfPhys: '物伤减半', halfSpec: '特伤减半', pureShield: '纯净护盾', pureField: '纯净领域', tide: '黑雾潮汐', vuln: '易伤', weak: '伤害-30%',
  swamp: '孢子沼泽', mist: '白雾', jungle: '丛林法则', siren: '海妖之歌', sirenOn: '海妖之歌', dr40: '减伤40%', crit2: '必定暴击', retal: '寂灭幽映',
  block: '坚不可摧', recoil: '磁暴反冲', sure3: '谛听', ear: '灵耳谛听', noHeal: '禁疗' };
var FOE_TM = { parryBan: 1, noStat: 1, sirenOn: 1, brandCd: 1, etchCd: 1, noSwitch: 1, soul: 1, noBoost: 1, seal: 1, vuln: 1, weak: 1, noHeal: 1 };
/* 进化链长度不固定（三阶或两阶），最后一阶是最终形态 */
function evoLast(s) { return s && s.evo ? s.evo.length - 1 : 0; }
function isFin(s, i) { return !s || !s.evo || i === s.evo.length - 1; }
function stageLabel(s, i) { return isFin(s, i) ? '最终形态' : ['一阶', '二阶'][i]; }
function formImg(s, i) { return isFin(s, i) ? SPRITES[s.id] : (PRE_SPRITES[s.id + '_s' + (i + 1)] || SPRITES[s.id]); }
function formRawName(s, i) { return isFin(s, i) ? s.name : s.evo[i].n; }
function typesOf(m) { if (m.perm && m.perm.moonFull) return ['光', '暗影']; return m.tm && m.tm.darkside > 0 ? ['暗影'] : sp(m).types; }
function mvType(me, mv) {
  if (me.perm && me.perm.moonFull) return me.perm.moonMv || mv.type;   // 光影之月：技能维持变身瞬间的属性
  if (mv.custom === 'lightside') return '光'; return me.tm && me.tm.darkside > 0 ? '暗影' : mv.type;
}
// 光影之月下，月之暗面 / 月之亮面不能再使用
// 残月之痕：初始威力 20，每使用一次翻倍（20 → 40 → 80 → 160），最高 160；次数记在 flags.canyue，换下场也保留（2026-10-14 从 10 起步改为 20 起步，并改成使用就计数）
var CANYUE_BASE = 20, CANYUE_MAX = 160;
function canyuePow(n) { return Math.min(CANYUE_MAX, CANYUE_BASE * Math.pow(2, n)); }
var STAR_MAX = 125;   // 星星魔法的最高威力（2026-10-12 从 200 削弱到 125；达到后命中有 50% 概率降低对方 1 级速度）
function moveBlocked(me, slot) { return !!(slot && M[slot.n] && ((me.perm && me.perm.moonFull && M[slot.n].custom === 'darkside') || (me.flags && me.flags.sy && M[slot.n].cat === '变化') || (me.tm && me.tm.parryBan === 1 && me.fx && me.fx.banMv === slot.n) || (me.tm && me.tm.noStat === 1 && M[slot.n].cat === '变化') || (me.enNS && M[slot.n].cat === '变化'))); }   // parryBan：被「招架」的技能；noStat：压制弧光（都写 2，回合结束减成 1 时才生效，即只禁「下回合」）
// 技能为什么不能用（界面上显示）：光影之月 / 沈阳大街（复活后的困难泰戈尔的场地效果，变化技能都不能用）
function blockWhy(me, slot) { return !moveBlocked(me, slot) ? '' : me.flags && me.flags.sy && M[slot.n].cat === '变化' ? '沈阳大街中不可用' : '光影之月中不可用'; }
// 处于月之暗面时，「月之暗面」变为「月之亮面」
var LIGHTSIDE = { name: '月之亮面', type: '光', cat: '变化', custom: 'lightside', pri: 0, pp: 5, hidden: true, d: '结束月之暗面，将精灵属性、技能属性切换回光系' };
// 战斗中按状态换图（见 assets.js 的 FORM_FX_SPRITES）：朔望月灵在月之暗面期间换暗影形态，光影之月后换光影形态，
// 沾染瘴气（瘴气层数 > 0）的精灵换成被污染的样子，按异色挑对应的那张图（没设 img 时按最终形态图比对）
function liveImg(m) {
  if (typeof FORM_FX_SPRITES === 'undefined') return m.img || null;
  var cur = m.img || (typeof SPRITES !== 'undefined' ? SPRITES[m.id] : null);
  for (var k in FORM_FX_SPRITES) if (cur && (PRE_SPRITES[k] === cur || SPRITES[k] === cur)) {
    var F = FORM_FX_SPRITES[k];
    if (m.perm && m.perm.moonFull && F.full) return F.full;
    if (m.tm && m.tm.darkside > 0 && F.dark) return F.dark;
    if (m.boss && m.boss.rainbow && F.rainbow) return F.rainbow;   // 奥多亚克 · 虹霓暴走（剧情 / BOSS 限定）
    if (m.perm && m.perm.odoForm === 'atk' && F.atk) return F.atk;
    if (m.perm && m.perm.odoForm === 'def' && F.def) return F.def;
    if (miaN(m) > 0) { if (m.shiny === 2 && F.miasmaShiny2) return F.miasmaShiny2; if (m.shiny && F.miasmaShiny) return F.miasmaShiny; if (F.miasma) return F.miasma; }
  }
  return m.img || null;
}
// 奥多亚克的形态技能：稳态版本 → [歼灭形态版本, 护阵形态版本]（2026-10-24）
var ODO_VAR = { 钢铁冲击: ['流形蛮冲', '坚守阵地'], 自体维修: ['全弹搭载', '强效外壳'], 机体引爆: ['究极爆破', '重构坚甲'], 基要扫描: ['解析导弹', '侵扰投弹'] };
function liveMove(me, mv) {
  if (mv && mv.name === '歼灭形态' && me.perm && me.perm.odoForm === 'atk') return M['护阵形态'];   // 形态切换是同一个技能：稳态 / 护阵形态时是「歼灭形态」，歼灭形态时是「护阵形态」
  if (mv && me.perm && me.perm.odoForm && ODO_VAR[mv.name]) return M[ODO_VAR[mv.name][me.perm.odoForm === 'atk' ? 0 : 1]];
  return mv && mv.custom === 'darkside' && me.tm && me.tm.darkside > 0 ? LIGHTSIDE : mv;
}

function stageMult(n) { return n >= 0 ? (2 + n) / 2 : 2 / (2 - n); }
// 命中修正：先算净等级（自己的命中等级 − 对方的闪避等级），提升命中维持原样（每级 +1/3）。
// 净等级为负时查表：-1、-2 级影响不大（80%、66%），叠到 -4 以下明显打不中（-4 级 43%，-6 级只剩 25%）
var ACC_DOWN = [1, 0.8, 0.66, 0.54, 0.43, 0.33, 0.25];
function accMult(n) { n = Math.max(-6, Math.min(6, Math.round(n) || 0)); return n >= 0 ? (3 + n) / 3 : ACC_DOWN[-n]; }
var STAB = 1.2;      // 本系加成：技能属性与精灵属性相同时伤害 ×1.2
var HP_MULT = 1.3125;   // 体力在原公式基础上 ×1.75；2026-11-03 再调为原来的 75%（1.75 × 0.75）
// iv：天赋（0~31），不传时按满天赋 31 计算（野怪、剧情对手、BOSS、平衡排位）
function calcStat(b, k, lv, iv) { lv = lv || LV; var v = Math.floor((2 * b + (iv == null ? 31 : iv)) * lv / 100); return k === 'hp' ? Math.floor((v + lv + 10) * HP_MULT) : v + 5; }
function blankStages() { var o = {}; STG.forEach(function (k) { o[k] = 0; }); return o; }
function sp(m) { return m.id === 'dummy' ? (m.dummySpec || DUMMY) : SPMAP[m.id]; }
function abilObj(m) { return m.abil || sp(m).ability; }   // 剧情里可以临时换特性（m.abil，如第十一段叶子喵的「脚伤」）
function ability(m) { var a = abilObj(m); return a ? a.n : '无'; }
// 纹章：账号里获得过某类精灵的纹章后，带进战斗的这类精灵会带上 emblem（见 EMBLEMS）
var EMBLEMS = {
  tagore: { m: '普通拳', n: '普通拳纹章', d: '每场战斗第一次使用普通拳时，不会降低自身命中，并解除自身的能力下降和异常状态' },
  shroom: { m: '净化之焰', n: '净化之焰纹章', d: '使用净化之焰时，额外降低对方1级物攻、特攻' }
};
function hasEmblem(m, mv) { return (m.emblem && m.emblem === mv) || !!(sp(m).emblem && sp(m).emblem.m === mv); }

/* 性格（参照赛尔号）：一项能力 ×1.1，另一项 ×0.9；五种性格无修正 */
var NATURES = {
  孤独: ['atk', 'def'], 固执: ['atk', 'spa'], 调皮: ['atk', 'spd'], 勇敢: ['atk', 'spe'],
  大胆: ['def', 'atk'], 淘气: ['def', 'spa'], 无虑: ['def', 'spd'], 悠闲: ['def', 'spe'],
  保守: ['spa', 'atk'], 稳重: ['spa', 'def'], 马虎: ['spa', 'spd'], 冷静: ['spa', 'spe'],
  沉着: ['spd', 'atk'], 温顺: ['spd', 'def'], 慎重: ['spd', 'spa'], 狂妄: ['spd', 'spe'],
  胆小: ['spe', 'atk'], 急躁: ['spe', 'def'], 开朗: ['spe', 'spa'], 天真: ['spe', 'spd'],
  害羞: null, 实干: null, 坦率: null, 浮躁: null, 认真: null
};
function natureMult(nat, k) { var n = nat && NATURES[nat]; if (!n) return 1; return n[0] === k ? 1.1 : n[1] === k ? 0.9 : 1; }
/* 学习力：每 10 点 = 1 点能力值；单项最多 300，总和最多 750 */
var EV_MAX = 300, EV_TOTAL = 750;
function fullStat(b, k, lv, ev, nat, iv) {
  var v = calcStat(b, k, lv, iv && iv[k] != null ? iv[k] : null) + Math.floor(((ev && ev[k]) || 0) / 10);
  return k === 'hp' ? v : Math.floor(v * natureMult(nat, k));
}
function makeMon(id, moveNames, mult, lv, ev, nat, iv) {
  var s = SPMAP[id], stats = {}; mult = mult || 1; lv = lv || LV;
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) { stats[k] = Math.round(fullStat(s.base[k], k, lv, ev, nat, iv) * mult); });
  var maxhp = Math.round(fullStat(s.base.hp, 'hp', lv, ev, nat, iv) * mult);
  return { id: id, lv: lv, maxhp: maxhp, hp: maxhp, stats: stats,
    moves: moveNames.map(moveName).filter(function (n) { return M[n]; }).map(function (n) { return { n: n, pp: M[n].pp, max: M[n].pp }; }),
    stages: blankStages(), st: {}, tm: {}, fx: {}, flags: {}, perm: {}, fainted: false };
}

// 剧情对战可以给精灵起显示名（如进化前的形态名）和换图
function erodeMult(m) { var e = m.boss && m.boss.erode; return typeof e === 'number' && e > 1 ? 1 + e : 2; }
function mkFrom(t) {
  var m = makeMon(t.id, t.moves, t.mult, t.lv, t.ev, t.nat, t.iv);
  if (t.nick) m.nick = t.nick; if (t.img) m.img = t.img; if (t.miasma) m.perm.miasma = t.miasma;
  if (t.maxhp) m.maxhp = m.hp = t.maxhp;          // BOSS：固定体力
  // breakable：剧情里可以被打破的木桩（如第八段的炸弹），体力不再无限，打到 0 就倒下；ability 可以换成剧情里的说明
  if (t.id === 'dummy' && t.breakable) { m.breakable = true; m.dummySpec = Object.assign({}, DUMMY, { name: t.nick || DUMMY.name, ability: t.ability || DUMMY.ability }); }
  if (t.ability && t.id !== 'dummy') m.abil = t.ability;
  if (t.odoForm) m.perm.odoForm = t.odoForm;   // BOSS 奥多亚克：一开场就是某个形态
  if (t.lvq) m.lvq = 1;                         // 星球挑战：等级显示为「LV.??」
  if (t.onlyHit) m.onlyHit = t.onlyHit;           // BOSS：只有这些属性的技能能命中它
  if (t.shiny) m.shiny = t.shiny === 2 ? 2 : true;   // 异色精灵（只是配色不同，能力一样）
  if (t.emblem && EMBLEMS[t.id] && EMBLEMS[t.id].m === t.emblem) m.emblem = t.emblem;
  // BOSS的特殊能力（见 BOSS_FX）；pp：BOSS技能的 PP（长时间战斗不会用光）
  if (t.boss) { m.boss = JSON.parse(JSON.stringify(t.boss)); if (m.boss.pp) m.moves.forEach(function (x) { if (M[x.n].custom !== 'annihilate') x.pp = x.max = m.boss.pp; }); }   // 灭却除外，仍按原本的 PP
  if (m.boss) m.boss.atk0 = m.stats.atk;
  if (m.boss && (m.boss.mmGift || m.boss.rainbow)) { m.stats.atk = Math.floor(m.stats.atk * 1.5); m.stats.spa = Math.floor(m.stats.spa * 1.5); }   // 「明明之赐」：双攻 +50%
  if (m.boss && m.boss.feud) m.stats.atk = Math.floor(m.stats.atk * 1.3);   // 「东北的纷争」：物攻永久 +30%（直接算进能力值，不是能力等级，不会被消除）
  if (m.boss && m.boss.erode) { var em = erodeMult(m); m.stats.atk = Math.floor(m.stats.atk * em); m.stats.spa = Math.floor(m.stats.spa * em); }   // 「深度侵蚀」：物攻、特攻永久提升（erode: 1 或 true 为 +100%；写数字 2 表示 +200%）
  if (t.u != null) { m.u = t.u; m.hl = t.hl || []; }   // 账号里的精灵：可以在战斗中领悟隐藏技能
  return m;
}
function hitBlocked(foe, t) { return !!(foe.onlyHit && foe.onlyHit.indexOf(t) < 0); }
function newBattle0(pTeam, aTeam) {
  return { turn: 1, over: null, needSwitch: false, order: [], turnActed: [false, false], silenced: [false, false],
    sides: [
      { name: '你', team: pTeam.map(mkFrom), active: 0, soulMark: false },
      { name: '对手', team: aTeam.map(mkFrom), active: 0, soulMark: false }
    ] };
}
function newTraining(p, lv, defBase) {
  var spec = { id: 'dummy', name: '木桩', types: ['无'], type: '无', base: { hp: 100, atk: 0, def: defBase, spa: 0, spd: defBase, spe: 0 }, ability: DUMMY.ability, moves: [], hidden: [], def: [] };
  var S = newBattle0([{ id: p.id, moves: p.moves, lv: lv }], []);
  var d = { id: 'dummy', dummySpec: spec, lv: lv, stats: {}, moves: [], stages: blankStages(), st: {}, tm: {}, fx: {}, flags: {}, perm: {}, fainted: false, seen: true };
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) { d.stats[k] = k === 'def' || k === 'spd' ? calcStat(defBase, k, lv) : 1; });
  d.maxhp = d.hp = calcStat(100, 'hp', lv);     // 名义体力：按体力种族值 100 计算，用于百分比类效果；受伤后立刻回满
  S.sides[1].team = [d]; S.sides[1].name = '木桩';
  S.training = { lv: lv, def: defBase, log: [] };
  [0].forEach(function (i) { var m = act(S, i); m.seen = true; if (ability(m) === '踏浪') m.tm.prio = 1; });
  return S;
}
function dotLabel(why) {
  var keys = ['寄生', '溺水', '流血', '中毒', '烧伤', '冻伤', '凋零之蚀', '冰雹', '雨水', '磁暴反冲', '感电', '混沌水域', '额外吸取'];
  for (var i = 0; i < keys.length; i++) if (why && why.indexOf(keys[i]) >= 0) return keys[i] === '雨水' ? '祈雨' : keys[i] === '额外吸取' ? '生命榨取（额外吸取）' : keys[i];
  return '持续/附加效果';
}
function recordDummy(S, amt, src) { if (S.training && amt > 0) S.training.log.push({ turn: S.turn, src: src || S.curMove || '其他', amt: amt }); }
function newBattle(pTeam, aTeam) {
  var S = newBattle0(pTeam, aTeam);
  FX_PEND.length = 0; S.sides[1].team.forEach(function (m) { if (m.boss && m.boss.solemn) { m.boss.seen = m.boss.seen || {}; m.boss.seen.solemn = 1; } });   // 「肃穆」开场就生效
  [0, 1].forEach(function (i) { var m = act(S, i); m.seen = true; if (ability(m) === '踏浪') m.tm.prio = 1; });
  return S;
}

function act(S, i) { var m = S.sides[i].team[S.sides[i].active]; if (!m.perm) m.perm = {}; return m; }
function nm(m) { return '【' + (m.nick || sp(m).name) + '】'; }
function aliveIdx(S, i) { var r = []; S.sides[i].team.forEach(function (m, k) { if (!m.fainted) r.push(k); }); return r; }

/* ---------- 快照：给界面逐帧播放 ---------- */
var ST_DESC = {
  害怕: '无法行动', 石化: '无法行动；被暴击时这次暴击伤害翻倍，并解除石化', 睡眠: '无法行动，受到攻击伤害时会醒来', 麻痹: '无法行动', 冰冻: '无法行动（冰系精灵免疫）',
  疲惫: '无法行动', 寄生: '每回合结束损失1/10最大体力，被对方吸走（草系精灵免疫）', 溺水: '每回合结束损失1/10最大体力；攻击造成的伤害变为30%（水系精灵免疫）',
  流血: '每回合结束损失60点体力（机械系免疫）', 中毒: '每回合结束损失1/16最大体力×层数；可无限叠加，叠加时回合数取较长的一方', 烧伤: '每回合结束损失1/8最大体力（火系精灵免疫）',
  失明: '攻击时有50%概率落空', 冻伤: '每回合结束损失1/8最大体力（冰系精灵免疫）', 混乱: '攻击时有40%概率攻击自己'
};
var TM_DESC = { rhythmLight: '每回合初有60%概率使对方失明1回合', rhythmBurn: '每回合初有60%概率使对方烧伤1回合', rhythmConfuse: '每回合初有60%概率使对方混乱1回合',
  odoAtk: '全弹搭载：造成的伤害提升25%', odoDef: '强效外壳：受到的伤害减少20%',
  brandCd: '闪电烙印麻痹过后的冷却：这段时间里叠不上闪电烙印',
  etchCd: '光辉蚀迹失明期间的冷却：这段时间里叠不上蚀迹', lmE: '特性「雷明」：每回合结束对对方造成25点固定伤害', lmL: '特性「雷明」：每回合结束恢复20体力', tcloud: '闪电云：每回合结束对对方造成100点固定伤害',
  cap: '单次受到的伤害不超过250，超出部分等额反馈给对方', genggu: '每回合提升1级特攻，恢复1/6最大体力',
  green: '每回合恢复已损失体力的1/5', immune: '免疫异常状态', reflect: '免疫并反弹对方施加的异常状态',
  dodge: '每次受到攻击有40%概率闪避', noSwitch: '无法切换精灵', prio: '所有技能先制+1',
  rain: '每回合结束对对方附加30点固定伤害', tri: '使用草、水、火系技能时额外恢复1/3体力',
  soul: '受到的伤害提升20%', voidPhys: '闪避物理攻击', induct: '主动攻击命中后提升1级特攻',
  enCrit: '攻击必定致命一击', counter: '受到主动攻击时，把25%的伤害反弹给对方', parryBan: '被招架的技能这回合不能使用', noStat: '不能使用变化类技能',
  vortex: '每回合结束降低对方1级命中', fenglei: '每回合结束一半概率降低对方1级速度，否则提升自身1级速度', darkside: '精灵属性和技能属性都变成暗影系',
  hail: '每回合结束对对方造成其1/10最大体力的伤害', noBoost: '无法提升能力等级',
  seal: '无法提升能力等级；强行提升会损失1/4当前体力', liuhuo: '火系技能威力+5', calm: '每回合恢复1/5最大体力',
  halfPhys: '受到的物理伤害减半', halfSpec: '受到的特殊攻击伤害减半', pureShield: '每回合初获得50点护盾', pureField: '自身在场时，双方能力等级无法变化', tide: '从使用的下回合起，每回合结束额外发动一次黑雾潮汐（共4次）', vuln: '受到的伤害提升30%',
  weak: '造成的伤害降低30%', swamp: '施加异常状态的成功率×1.5', mist: '免疫能力下降',
  jungle: '对体力比例低于自己的敌人伤害提升70%', siren: '倒计时结束时，若自己还在场，对方失去全部体力', sirenOn: '海妖之歌：倒计时结束时，若唱歌的精灵还在场，失去全部体力；换下场就会解除',
  dr40: '受到的伤害减免40%', crit2: '攻击必定致命一击', retal: '受到攻击时降低对方1级物攻、特攻、命中',
  block: '每回合获得100点护盾，抵挡伤害', recoil: '受到攻击时对对方造成75点固定伤害',
  sure3: '攻击必定命中', ear: '攻击必定命中；对方若试图主动闪避，其下一次受到的攻击威力翻倍', noHeal: '无法恢复体力'
};
function stageText(k, v) {
  var mult = (k === 'acc' || k === 'eva') ? accMult(v) : stageMult(v);
  var what = k === 'acc' ? '命中率' : k === 'eva' ? '闪避率（对方命中率 ×' + (Math.round(100 * accMult(-v)) / 100) + '）' : STG_NAME[k];
  return (v > 0 ? '提升' : '降低') + Math.abs(v) + '级，' + (k === 'eva' ? what : what + ' ×' + (Math.round(mult * 100) / 100)) + '。能力等级上下限为 ±6，换下场后清除';
}
// 状态栏里的特性：显示“此刻”具体生效了什么
function pct(x) { return Math.round(x * 100) + '%'; }
function moonStack(S, evs, i, why) {
  var m = act(S, i); if (ability(m) !== '月蚀' || m.perm.moonFull) return;
  m.fx.moon = (m.fx.moon || 0) + 1;
  log(S, evs, nm(m) + '的「月蚀」：' + why + '，月升 ' + m.fx.moon + ' / 5', 'fxl');
  if (m.fx.moon >= 5) {
    m.fx.moon = 0; m.perm.moonFull = true; m.perm.moonMv = m.tm.darkside > 0 ? '暗影' : null; delete m.tm.darkside;
    log(S, evs, nm(m) + '的月升达到5层，转化为「光影之月」！', 'crit');
  }
  E(S, evs, 'stage', { side: i });
}
function moonSwitch(S, evs, i) {
  var m = act(S, i); if (ability(m) !== '月蚀') return;
  m.fx.moonNext = 1; moonStack(S, evs, i, '转换属性，下一次攻击伤害+15%');
}
function abilityLive(m, foe) {
  var ab = ability(m), t = m.fx.fieldT || 0, on, f = foe && !foe.fainted ? foe : null;
  var lowSelf = m.hp <= m.maxhp / 3;
  switch (ab) {
    case '孤傲': var gh = m.fx.glenHits || { phys: 0, spec: 0 }; return '已累计受到 ' + (gh.phys + gh.spec) + '/3 次攻击（物攻' + gh.phys + '、特攻' + gh.spec + '），满3次提升较多类型对应的1级防御；连击技能每一击分别计算';
    case '无常': return (abilObj(m).d || '') + ' ' + (abilObj(m).extra || '');
    case '旅行': return '每次被替换上场时，提升1级速度（首发上场不触发）';
    case '脚伤': return '脚底被瘴气浸透，陷入永久的流血状态，无法被解除';
    case '重构': return '切换形态时恢复 100 体力' + (m.perm && m.perm.odoForm ? '（当前：' + (m.perm.odoForm === 'atk' ? '歼灭形态' : '护阵形态') + '）' : '（当前：稳态）');
    case '雷明': return '使用电系技能后，3回合内每回合末对对方造成25固定伤害' + (m.tm.lmE > 0 ? '（生效中，剩 ' + m.tm.lmE + ' 回合）' : '') + '；使用光系技能后，3回合内每回合末恢复20体力' + (m.tm.lmL > 0 ? '（生效中，剩 ' + m.tm.lmL + ' 回合）' : '') + '。各自不能叠加，但可以同时生效';
    case '饭香': return '每回合结束时 20% 概率吃一口米饭' + (m.perm.rice ? '（本场已吃 ' + m.perm.rice + ' 口）' : '');
    case '龙啸': if (!f) return '对手不在场，暂不生效';
      on = f.hp < m.hp; return on ? '生效中：对手体力 ' + f.hp + ' 低于自己 ' + m.hp + '，造成伤害 +15%' : '未生效：对手体力 ' + f.hp + ' 不低于自己 ' + m.hp;
    case '复苏': return lowSelf ? '生效中：体力已低于1/3，造成伤害 +30%' : '未生效：体力降到 ' + Math.floor(m.maxhp / 3) + ' 以下时，造成伤害 +30%';
    case '水形': on = STG.some(function (k) { return m.stages[k] > 0; });
      return on ? '生效中：处于能力提升状态，受到伤害 -10%' : '未生效：有任意一项能力提升时，受到伤害 -10%';
    case '光滑': return '持续生效：对方命中率 ×0.9';
    case '借风': return '每回合判定：比对方先出手时，造成伤害 +15%（速度 ' + Math.round(speedOf(m)) + (f ? ' / 对手 ' + Math.round(speedOf(f)) : '') + '）';
    case '收魂': return '待触发：击败对手后，对方下一只上场的精灵1回合内受到伤害 +20%';
    case '突袭': return m.flags.firstAtk ? '已用掉：本次出场的首次攻击已经打出' : '待触发：本次出场的第一次攻击伤害 +30%';
    case '元素': return '持续生效：水、火、草系技能威力 +10';
    case '虚空': return '持续生效：致命一击率翻倍（普通技能 12.5%，高暴击技能 50%）';
    case '感电': return '持续生效：受到物理攻击时，把伤害的15%反弹给对方';
    case '月蚀': return m.perm.moonFull ? '已转化为光影之月' + (m.fx.moonNext ? '；下一次攻击伤害+15%' : '') :
      '月升 ' + (m.fx.moon || 0) + ' / 5' + (m.fx.moonNext ? '；下一次攻击伤害+15%' : '');
    case '冰刺': return f && f.st['冰冻'] > 0 ? '对手冰冻中：其能力提升已被解除' : '待触发：使对手冰冻时，解除其所有能力提升';
    case '招架': return f && f.tm && f.tm.parryBan === 1 ? '生效中：对手这回合不能使用「' + f.fx.banMv + '」' : '待触发：用心眼刀或至高之术化解成功后，对手下回合不能使用被化解的技能';
    case '疾驰': if (!f) return '对手不在场，暂不生效';
      return '待触发：攻击命中时附加 ' + Math.floor(Math.abs(speedOf(m) - speedOf(f)) * 0.1) + ' 点固定伤害（速度 ' + Math.round(speedOf(m)) + ' / 对手 ' + Math.round(speedOf(f)) + '）';
    case '起源': if (!f) return '对手不在场，暂不生效';
      on = speedOf(m) > speedOf(f); return (on ? '生效中' : '未生效') + '：速度 ' + Math.round(speedOf(m)) + ' / 对手 ' + Math.round(speedOf(f)) + '，速度领先时造成伤害 +15%';
    case '熔炼': return '生效中：出场第 ' + (t + 1) + ' 回合，造成伤害 +' + Math.round(6 * Math.min(5, t + 1)) + '%' + (t + 1 >= 5 ? '（已到上限）' : '（上限 +30%）');
    case '引雷': return f && f.fx.leiyin ? '生效中：对手已被引雷，下一次受到伤害 +20%' : '待触发：降低对手能力后，对手下一次受到伤害 +20%';
    case '暗潮': return '待触发：每次恢复体力时，30%概率提升1级闪避（当前闪避 ' + (m.stages.eva > 0 ? '+' : '') + m.stages.eva + '）';
    case '枯萎': return '生效中：出场第 ' + (t + 1) + ' 回合，对手造成的伤害 -' + pct(Math.min(0.3, 0.05 * t)) + (0.05 * t >= 0.3 ? '（已到上限）' : '（每回合 -5%，上限 -30%）');
    case '孢子': return '待触发：使用名字含“孢子”的技能时，恢复 ' + Math.floor(m.maxhp / 10) + ' 体力（1/10）';
    case '追猎': if (!f) return '对手不在场，暂不生效';
      on = f.hp <= f.maxhp / 3; return on ? '生效中：对手体力已低于1/3，造成伤害 +25%' : '未生效：对手体力降到 ' + Math.floor(f.maxhp / 3) + ' 以下时，造成伤害 +25%';
    case '踏浪': return m.tm.prio > 0 && !(m.tm.prio > 1 && false) ? '生效中：本回合技能先制 +1' : '已结束：出场时的先制 +1 已用完';
    case '盾甲': return '持续生效：受到伤害 -10%';
    case '熔岩': if (!f) return '对手不在场，暂不生效';
      on = f.st['烧伤'] > 0; return on ? '生效中：对手处于烧伤，造成伤害 +25%' : '未生效：对手烧伤时，造成伤害 +25%';
    case '爆燃': return m.fx.charge ? '生效中：已蓄力 ' + m.fx.charge + ' / 3 层，下一次攻击伤害 +' + m.fx.charge * 10 + '%' : '未生效：不进行主动攻击的回合结束时蓄力 1 层（每层下一次攻击伤害 +10%，最多 3 层）';
    case '幻叶': return lowSelf ? '生效中：体力已低于1/3，受到伤害 -15%' : '未生效：体力降到 ' + Math.floor(m.maxhp / 3) + ' 以下时，受到伤害 -15%';
  }
  return abilObj(m) ? abilObj(m).d : '';
}
function chipsOf(m, foe, S) {
  var c = [];
  Object.keys(RHYTHMS).forEach(function (t) { if (m.tm[t] > 0) c.push({ t: TM_NAME[t] + ' ' + m.tm[t], k: 'fx', h: TM_NAME[t] + ' · 剩 ' + m.tm[t] + ' 回合', d: TM_DESC[t] }); });
  if (fateCount(m, 'luck')) c.push({ t: '幸运 ×' + fateCount(m, 'luck'), k: 'fx', h: '幸运 · ' + fateCount(m, 'luck') + ' 层', d: '命运标记，持续至战斗结束，换下场时保留。直接获得每层恢复1/8最大体力；每3层转化为1层厄运并损失1/4最大体力' });
  if (fateCount(m, 'doom')) c.push({ t: '厄运 ×' + fateCount(m, 'doom'), k: 'st', h: '厄运 · ' + fateCount(m, 'doom') + ' 层', d: '命运标记，持续至战斗结束，换下场时保留。直接获得每层损失1/8最大体力；每3层转化为1层幸运并恢复1/4最大体力' });
  if (S && S.fateTurns > 0) c.push({ t: '命运 ' + S.fateTurns, k: 'fx', h: '无常命运 · 剩 ' + S.fateTurns + ' 回合', d: '每回合结束时，双方在场精灵获得同种命运标记：幸运或厄运，各50%概率。切换精灵不会结束领域' });
  var abo = abilObj(m);
  if (abo && abo.n !== '无' && !(m.id === 'rosette' && abo.n === '星云')) c.push({ t: '特性 · ' + abo.n, k: 'ab' + (/^生效中/.test(abilityLive(m, foe)) ? ' on' : ''), d: abilityLive(m, foe), h: abo.n + ' · 当前效果' });
  STG.forEach(function (k) { var v = m.stages[k]; if (v) c.push({ t: STG_NAME[k] + (v > 0 ? '+' : '') + v, k: v > 0 ? 'up' : 'down', h: STG_NAME[k] + (v > 0 ? ' 提升' : ' 下降'), d: stageText(k, v) }); });
  for (var s in m.st) if (m.st[s] > 0) {
    var pz = s === '中毒' ? (m.fx.poison || 1) : 0;
    c.push({ t: s + (pz > 1 ? '×' + pz + ' · ' : ' ') + m.st[s], k: 'st', h: s + (pz ? ' · ' + pz + ' 层' : '') + ' · 剩 ' + m.st[s] + ' 回合', d: (ST_DESC[s] || '') + (pz ? '。当前每回合损失 ' + Math.max(1, Math.floor(m.maxhp * pz / 16)) + ' 点' : '') });
  }
  if (m.fx.stoneMark) c.push({ t: '破石印记', k: 'st', h: '破石印记', d: '受到破石之蹄时，其威力翻倍；不消耗印记，换下场后消失' });
  if (m.fx.fracture) {
    var fracture = m.fx.fracture, average = Math.round(fracture.total / 3 * 100) / 100;
    c.push({ t: '碎震 ' + average, k: 'st', h: '碎震', d: '每回合末均摊' + average + '点固定伤害，剩余' + (3 - fracture.elapsed) + '回合；剩余伤害池' + glenFracturePool(fracture) + '点，整数结算余数在后续回合补齐' });
  }
  if (m.fx.highlandHits > 0) c.push({ t: '高地之王 ' + m.fx.highlandHits, k: 'fx', h: '高地之王', d: '下' + m.fx.highlandHits + '次受到的攻击伤害减免35%；连击技能每一击分别计算' });
  if (m.fx.prideShield) c.push({ t: '孤王之傲 ' + m.fx.prideShield.hp, k: 'fx', h: '孤王之傲', d: '吸收接下来受到的' + m.fx.prideShield.hp + '点伤害' });
  if (m.fx.shield > 0) c.push({ t: '护盾 ' + m.fx.shield, k: 'fx', h: '护盾', d: '先吸收接下来受到的 ' + m.fx.shield + ' 点伤害' });
  if (m.fx.absDef) c.push({ t: '免疫下次攻击', k: 'fx', h: '免疫下次攻击', d: '闪避下一次受到的攻击' });
  if (m.fx.endure) c.push({ t: '不灭之躯', k: 'fx', h: '不灭之躯', d: '下一次受到致死攻击时残留1点体力' });
  if (m.perm && m.perm.odoForm) c.push({ t: m.perm.odoForm === 'atk' ? '歼灭形态' : '护阵形态', k: 'fx', h: m.perm.odoForm === 'atk' ? '歼灭形态' : '护阵形态', d: '部分技能切换为' + (m.perm.odoForm === 'atk' ? '歼灭' : '护阵') + '形态的版本' });
  if (m.perm && m.perm.odoMark) c.push({ t: '解析 ×' + m.perm.odoMark, k: 'st', h: '解析导弹', d: '受到的伤害提升 ' + m.perm.odoMark * 10 + '%' });
  if (m.perm && m.perm.odoJam) c.push({ t: '侵扰 ×' + m.perm.odoJam, k: 'st', h: '侵扰投弹', d: '造成的伤害降低 ' + m.perm.odoJam * 8 + '%' });
  if (m.fx.etch) c.push({ t: '蚀迹 ' + m.fx.etch + '/2', k: 'st', h: '光辉蚀迹', d: '叠满2层时必定陷入失明2回合' });
  if (m.fx.brand) c.push({ t: '烙印 ' + m.fx.brand + '/2', k: 'st', h: '闪电烙印', d: '叠满2层时必定陷入麻痹2回合' });
  if (m.fx.leiyin) c.push({ t: '引雷', k: 'st', h: '引雷', d: '下一次受到的伤害提升20%' });
  if (m.fx.sureHit && !m.fx.sureCrit) c.push({ t: '下次必中', k: 'fx', h: '下次必中', d: '下一次攻击必定命中' });
  if (m.perm && m.perm.melt) c.push({ t: '熔化 ×' + m.perm.melt, k: 'st', h: '熔化 · ' + m.perm.melt + ' 层', d: '受到的伤害提升 ' + m.perm.melt * 20 + '%（每层20%，最多5层），持续到战斗结束，换下场也不会消失' });
  if (m.insFx && typeof SUMMON !== 'undefined') Object.keys(m.insFx).forEach(function (f) { var I = SUMMON.INS[m.insFx[f]]; if (I) c.push({ t: '刻印 · ' + I.name, k: 'fx on', h: '刻印 · ' + I.name, d: I.fd }); });   // 2026-11-01
  if (m.eq && m.eq.length) c.push({ t: '装备 ×' + m.eq.length, k: 'fx on', h: '无尽作战 · 装备', d: m.eq.map(function (q) { return ITEMS[q] ? ITEMS[q].name + '：' + ITEMS[q].d : q; }).join('；') });   // 2026-11-02
  if (m.enDmg) c.push({ t: '增伤 +' + Math.round(m.enDmg * 100) + '%', k: 'fx on', h: '无尽作战 · 增伤', d: '能力、消耗品、装备带来的伤害提升，合计 +' + Math.round(m.enDmg * 100) + '%' });
  if (m.cbl) c.push({ t: 'Cumberland', k: 'fx on', h: 'Cumberland' + (m.cbl > 1 ? ' · 增幅' : ''), d: cblText(m.cbl) });   // 第十九段：Cumber 给的加成
  if (m.onlyHit) c.push({ t: '元素亲和', k: 'fx', h: 'BOSS · 元素亲和', d: '只有' + m.onlyHit.join('、') + '系技能才能命中它，其他属性的技能都会被挡下' });
  if (m.boss) BOSS_FX.forEach(function (f) {
    if (!m.boss[f.k]) return;
    if ((f.hide && f.hide(m)) || !fxKnown(m, f.k)) { c.push({ t: '？？？', k: 'fx', h: '？？？ · 尚未揭晓', d: '它好像还藏着什么本事……' }); return; }   // 隐藏特效：第一次发动前只显示问号
    var fn = f.nm ? f.nm(m) : null; c.push({ t: fn || f.t, k: 'fx', h: fn || f.h, d: f.d(m) });
  });
  if (m.flags && m.flags.sy && !m.boss) c.push({ t: '沈阳大街', k: 'bad', h: '沈阳大街（场地）', d: '场地效果：不能使用变化类技能' });
  if (m.shiny) c.push({ t: '异色', k: 'fx', h: '异色精灵', d: '和同类长得不一样的稀有配色，能力和普通的一样' });
  if (m.puppet) c.push({ t: '瘴毒傀儡', k: 'st', h: '瘴毒傀儡', d: '荒芜召唤出来的傀儡，只会使用攻击技能。被击败后荒芜会重新上场。' });
  if (m.emblem && EMBLEMS[m.id]) c.push({ t: '纹章 · ' + m.emblem, k: 'fx' + (m.flags.punch ? '' : ' on'), h: EMBLEMS[m.id].n, d: EMBLEMS[m.id].d + (m.flags.punch ? '（本场已经生效过）' : '') });
  if (m.perm && m.perm.star) c.push({ t: '星星魔法 ×' + m.perm.star, k: 'fx', h: '星星魔法 · 已使用 ' + m.perm.star + ' 次', d: '下一次星星魔法威力 ' + Math.min(STAR_MAX, 25 * (m.perm.star + 1)) + (25 * (m.perm.star + 1) >= STAR_MAX ? '（已达最高，命中时 50% 降低对方 1 级速度）' : '') + '（换下场也会保留）' });
  if (m.flags && m.flags.canyue) c.push({ t: '残月之痕 ×' + m.flags.canyue, k: 'fx', h: '残月之痕 · 已使用 ' + m.flags.canyue + ' 次', d: '下一次残月之痕威力 ' + canyuePow(m.flags.canyue) + (canyuePow(m.flags.canyue) >= CANYUE_MAX ? '（已达最高）' : '') + '（每使用一次翻倍，最高 ' + CANYUE_MAX + '；换下场也会保留）' });
  if (m.fx.flash) c.push({ t: '闪光', k: 'st', h: '闪光飞叶', d: '下一次受到攻击时，额外降低1级命中' });
  if (m.fx.earMark) c.push({ t: '被听穿', k: 'st', h: '灵耳谛听', d: '试图闪避被识破：下一次受到的攻击威力翻倍' });
  if (miaN(m)) c.push({ t: '瘴气 ×' + miaN(m), k: 'st', h: '瘴气 · ' + miaN(m) + ' 层', d: '物攻、特攻 +' + (miaN(m) * 5) + '%，物防、特防 −' + Math.min(90, miaN(m) * 5) + '%（每层 ±5%，防御最低降到 10%）。持续到战斗结束，换下场也不会消失；在瘴气环境中每回合结束时再获得 1 层。' });
  if (m.perm && m.perm.wither) c.push({ t: '凋零之蚀' + (witherN(m) > 1 ? ' ×' + witherN(m) : ''), k: 'st', h: '凋零之蚀 · ' + witherN(m) + ' 层', d: '每回合结束损失 ' + witherN(m) + '/' + WITHER_DIV + ' 最大体力（每层 1/' + WITHER_DIV + '，最多 ' + WITHER_MAX + ' 层），持续到战斗结束。当前每回合损失 ' + witherDot(m) + ' 点' });
  if (m.fx.charge) c.push({ t: '爆燃蓄力 ×' + m.fx.charge, k: 'fx', h: '爆燃蓄力 · ' + m.fx.charge + ' / 3', d: '下一次攻击伤害提升 ' + m.fx.charge * 10 + '%，攻击时全部消耗。下场时清空。' });
  if (m.fx.boostNext) c.push({ t: '潜水蓄力', k: 'fx', h: '潜水蓄力', d: '下一次攻击伤害提升50%' });
  if (m.fx.prismAttacks) c.push({ t: '斑斓之姿 ' + m.fx.prismAttacks, k: 'fx', h: '斑斓之姿', d: '剩余' + m.fx.prismAttacks + '次主动攻击拆为威力减半的2次攻击，每次附加完整技能效果' });
  if (m.fx.originHits) c.push({ t: '本源之姿 ' + m.fx.originHits, k: 'fx', h: '本源之姿', d: '剩余' + m.fx.originHits + '次攻击命中后恢复1/5最大体力' });
  if (m.fx.moon) c.push({ t: '月升 ×' + m.fx.moon, k: 'fx', h: '月升 · ' + m.fx.moon + ' / 5', d: '达到5层时转化为光影之月。下场时清空。' });
  if (m.fx.moonNext) c.push({ t: '月蚀 · 下次攻击+15%', k: 'fx', h: '月蚀', d: '刚转换过属性，下一次攻击伤害提升15%，命中后恢复 1/6 最大体力' });
  if (m.perm && m.perm.moonFull) c.push({ t: '光影之月', k: 'fx', h: '光影之月（永久，下场保留）', d: '属性：光 + 暗影\n技能属性：固定为' + (m.perm.moonMv ? '暗影系' : '原属性') + '\n伤害 +15%\n使用技能时，其余技能各恢复1点PP，并恢复 1/6 最大体力\n无法使用月之暗面 / 月之亮面' });
  if (m.fx.sureCrit) c.push({ t: m.fx.sureHit ? '必中必暴' : '下次暴击', k: 'fx', h: m.fx.sureHit ? '必中必暴' : '下次暴击', d: m.fx.sureHit ? '下一次攻击必定命中并造成致命一击' : '下一次攻击必定致命一击' });
  for (var t in m.tm) if (m.tm[t] > 0 && !RHYTHMS[t]) c.push({ t: (TM_NAME[t] || t) + ' ' + m.tm[t], k: FOE_TM[t] ? 'st' : 'fx', h: (TM_NAME[t] || t) + ' · 剩 ' + m.tm[t] + ' 回合', d: TM_DESC[t] || '' });
  return c;
}
// 当前全部具体能力值（含能力等级、特性、场上效果）
function statSheet(m, foe) {
  var rows = [];
  rows.push({ k: '体力', v: m.hp + ' / ' + m.maxhp, base: sp(m).base.hp });
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) {
    var st = m.stages[k], eff = Math.floor(m.stats[k] * stageMult(st));
    rows.push({ k: STG_NAME[k], v: String(eff), raw: m.stats[k], st: st, base: sp(m).base[k] });
  });
  var acc = accMult(m.stages.acc);
  rows.push({ k: '命中', v: Math.round(acc * 100) + '%', st: m.stages.acc, note: m.st['失明'] > 0 ? '失明：攻击有50%概率落空' : '' });
  var dodge = 1 - accMult(-m.stages.eva);
  if (ability(m) === '光滑') dodge = 1 - (1 - dodge) * 0.9;
  var dn = [];
  if (ability(m) === '光滑') dn.push('含「光滑」');
  if (m.tm.dodge > 0) dn.push('光滑皮肤另有40%闪避');
  if (m.tm.voidPhys > 0) dn.push('虚空化：物理攻击全部闪避');
  rows.push({ k: '闪避', v: Math.round(Math.max(0, dodge) * 100) + '%', st: m.stages.eva, note: dn.join('，') });
  var cr = (1 / 16) * (ability(m) === '虚空' ? 2 : 1);
  var crn = m.fx.sureCrit || m.tm.crit2 > 0 ? '下次攻击必定致命一击' : '高暴击技能为 ' + Math.round(cr * 4 * 100) + '%';
  rows.push({ k: '暴击率', v: (m.fx.sureCrit || m.tm.crit2 > 0 ? 100 : Math.round(cr * 1000) / 10) + '%', note: crn });
  var dmgOut = 1, dmgIn = 1, ab = ability(m), t = m.fx.fieldT || 0, f = foe && !foe.fainted ? foe : null;
  if (ab === '龙啸' && f && f.hp < m.hp) dmgOut *= 1.15;
  if (ab === '复苏' && m.hp <= m.maxhp / 3) dmgOut *= 1.3;
  if (ab === '起源' && f && speedOf(m) > speedOf(f)) dmgOut *= 1.15;
  if (ab === '熔炼') dmgOut *= 1 + 0.06 * Math.min(5, t + 1);
  if (ab === '追猎' && f && f.hp <= f.maxhp / 3) dmgOut *= 1.25;
  if (ab === '熔岩' && f && f.st['烧伤'] > 0) dmgOut *= 1.25;
  if (ab === '爆燃' && m.fx.charge) dmgOut *= 1 + 0.1 * m.fx.charge;
  if (m.fx.moonNext) dmgOut *= 1.15;
  if (m.perm && m.perm.moonFull) dmgOut *= 1.15;
  if (m.tm.weak > 0) dmgOut *= 0.7;
  if (m.st['溺水'] > 0) dmgOut *= 0.3;
  if (f && ability(f) === '枯萎') dmgOut *= Math.max(0.7, 1 - 0.05 * (f.fx.fieldT || 0));
  if (m.fx.boostNext) dmgOut *= 1.5;
  if (ab === '幻叶' && m.hp <= m.maxhp / 3) dmgIn *= 0.85;
  if (ab === '盾甲') dmgIn *= 0.9;
  if (ab === '水形' && STG.some(function (k) { return m.stages[k] > 0; })) dmgIn *= 0.9;
  if (m.tm.soul > 0) dmgIn *= 1.2;
  if (m.tm.vuln > 0) dmgIn *= 1.3;
  if (m.perm && m.perm.melt) dmgIn *= 1 + 0.2 * m.perm.melt;
  if (m.fx.leiyin) dmgIn *= 1.2;
  if (m.fx.highlandHits > 0) dmgIn *= .65;
  if (m.tm.dr40 > 0) dmgIn *= 0.6;
  if (m.boss && m.boss.dr) dmgIn *= 1 - m.boss.dr;
  if (m.boss && m.boss.eternal) dmgIn *= 1.2;
  rows.push({ k: '造成伤害', v: '×' + (Math.round(dmgOut * 100) / 100), note: '特性与场上效果合计（不含属性克制）' });
  rows.push({ k: '受到伤害', v: '×' + (Math.round(dmgIn * 100) / 100), note: [m.tm.halfPhys > 0 ? '物理伤害减半' : '', m.tm.halfSpec > 0 ? '特殊攻击伤害减半' : ''].filter(Boolean).join('，') });
  var pri = m.tm.prio > 0 ? '+1' : '0';
  rows.push({ k: '先制加成', v: pri });
  return rows;
}
function snap(S) {
  return {
    turn: S.turn,
    sides: S.sides.map(function (sd) {
      var m = sd.team[sd.active];
      var ab = abilObj(m) || { n: '无', d: '图鉴里还没写特性' };
      return { id: m.id, name: m.nick || sp(m).name, img: liveImg(m), types: typesOf(m), lv: m.lv || LV, lvq: !!m.lvq, dummy: m.id === 'dummy' && !m.breakable, ability: { n: ab.n, d: ab.d, extra: ab.extra || '' }, stats: statSheet(m, S.sides[1 - S.sides.indexOf(sd)].team[S.sides[1 - S.sides.indexOf(sd)].active]), hp: m.hp, maxhp: m.maxhp, bars: m.boss && m.boss.bars ? [m.boss.bar || 0, m.boss.bars.length] : null, fainted: m.fainted, chips: chipsOf(m, S.sides[1 - S.sides.indexOf(sd)].team[S.sides[1 - S.sides.indexOf(sd)].active], S),
        team: sd.team.map(function (x, k) { return { id: x.id, nick: x.nick || null, fainted: x.fainted, active: k === sd.active, hp: x.hp, maxhp: x.maxhp, seen: !!x.seen }; }) };
    })
  };
}
// 2026-10-24：BOSS特性第一次发动前显示「？？？」。RV(m, 键名)：这一项第一次真正生效时调用，记进 m.boss.seen，
// 并在下一个事件前插一个 bossfx 事件（界面据此记进 acc.seenFx，以后BOSS页和对战里都直接显示）
var FX_PEND = [];
function RV(m, k) { if (!m || !m.boss || !m.boss[k]) return; var s0 = m.boss.seen || (m.boss.seen = {}); if (s0[k]) return; s0[k] = 1; FX_PEND.push(k); }
function fxKnown(m, k) { return !!((m.boss && m.boss.seen && m.boss.seen[k]) || (typeof window !== 'undefined' && window.HS_SEENFX && window.HS_SEENFX[k])); }
function E(S, evs, t, o) {
  if (FX_PEND.length) { var pk = FX_PEND.splice(0), sn = snap(S); pk.forEach(function (k) { evs.push({ t: 'bossfx', k: k, snap: sn }); }); }
  var e = o || {}; e.t = t; e.snap = snap(S); evs.push(e);
}
function log(S, evs, text, cls) { E(S, evs, 'text', { text: text, cls: cls || '' }); }

/* ---------- 基础操作 ---------- */
function faint(S, evs, j) {
  var t = act(S, j); if (t.fainted) return;
  // 主线任务「引出猎杀者」：野生精灵不会倒下，体力剩 1 点时逃走（S.wild.spare）
  if (j === 1 && S.wild && S.wild.spare && !S.pvp) {
    t.hp = 1; t.fainted = false;
    if (S.over === 'spared') return;
    E(S, evs, 'hit', { side: j, amount: 0 });
    log(S, evs, nm(t) + '只剩最后一口气，慌忙逃进了草丛里！', 'good');
    S.over = 'spared'; E(S, evs, 'over', { result: 'spared' }); return;
  }
  if (t.boss && t.boss.past && !t.boss.revived && !S.pvp) { reviveTiger(S, evs, j, t); return; }
  if (t.boss && t.boss.bars && (t.boss.bar || 0) < t.boss.bars.length - 1 && !S.pvp) { t.hp = 0; if (!t.boss.broken) { t.boss.broken = 1; E(S, evs, 'hit', { side: j, amount: 0 }); log(S, evs, nm(t) + '的第 ' + ((t.boss.bar || 0) + 1) + ' 管体力被击破了！', 'good'); } return; }   // 玫瑰星云（第十九段）的多管体力：击破一管后溢出伤害无效，回合结束换下一管（nebPhase）
  t.fainted = true; t.hp = 0;
  E(S, evs, 'faint', { side: j }); log(S, evs, nm(t) + '倒下了！', 'bad');
  if (j === 1 && S.en && S.en.on && S.en.on.ab_soul && !act(S, 0).fainted) { var sh0 = Math.floor(t.maxhp * 0.3); log(S, evs, '超度形态：吸收了' + nm(t) + '的生命', 'fxl'); heal(S, evs, 0, sh0); }
}
// S.cs：我方（side 0）这场战斗的表现统计，星球挑战的星级要求用（2026-10-17）
function CS(S) { return S.cs || (S.cs = { crit: 0, st: {}, up6: 0, down6: 0, heal: 0, maxHit: 0, oneShot: 0, dotKO: 0, items: 0, sw: 0 }); }
// 伤害数字的来源（2026-10-24）：异常状态的持续伤害显示状态名，其他非技能直击的伤害显示「固伤」
var DOT_KINDS = ['寄生', '溺水', '流血', '中毒', '烧伤', '冻伤', '凋零之蚀'];
function dotKind(why) { for (var i = 0; i < DOT_KINDS.length; i++) if (why && why.indexOf(DOT_KINDS[i]) >= 0 && why.indexOf('额外吸取') < 0) return DOT_KINDS[i]; return 'fixed'; }
// 直接伤害为攻击技能及其附加伤害；异常、反伤、场地持续伤害为间接伤害。
// percent 标记按受伤者体力计算的伤害，cost 是技能主动消耗，不受受伤免疫影响。
function bossDamage(S, evs, j, amt, o) {
  var m = act(S, j), b = m.boss;
  if (!b || o.cost || amt <= 0) return amt;
  if (b.noPercent && o.percent) { RV(m, 'noPercent'); log(S, evs, nm(m) + '免疫百分比伤害', 'fxl'); return 0; }
  if (b.tuning && (!!o.direct === (S.turn % 2 === 1))) {
    RV(m, 'tuning');
    log(S, evs, nm(m) + '的「调弦」免疫了' + (o.direct ? '直接' : '间接') + '伤害', 'fxl');
    return 0;
  }
  if (b.chord && (o.status || o.percent)) { RV(m, 'chord'); amt *= 1 - b.chord; }
  return amt;
}
function loseHp(S, evs, j, amt, why, exact, o) {
  var t = act(S, j); if (t.fainted || amt <= 0 || (t.boss && t.boss.broken)) return 0;
  o = o || {};
  amt = bossDamage(S, evs, j, amt, { direct: !!o.direct, percent: !!o.percent, cost: !!o.cost, status: dotKind(why) !== 'fixed' || !!(why && why.indexOf('陷入混乱') >= 0) });
  if (amt <= 0) return 0;
  if (t.id === 'dummy' && !t.breakable) { amt = Math.floor(amt); recordDummy(S, amt, why ? (S.curMove && why.indexOf('混沌水域') < 0 && why.indexOf('额外吸取') < 0 ? S.curMove : dotLabel(why)) : null); E(S, evs, 'hit', { side: j, amount: amt }); if (why) log(S, evs, why + '（' + amt + '）'); return amt; }
  if (t.boss && t.boss.stRes && why && dotKind(why) !== 'fixed') { amt = Math.max(1, amt * (1 - t.boss.stRes)); RV(t, 'stRes'); }
  if (t.boss && t.boss.eSt && why && dotKind(why) !== 'fixed') { amt = Math.max(1, amt * (1 - t.boss.eSt)); RV(t, 'eSt'); }   // 无尽作战「异常抗性」
  if (!exact && t.boss && t.boss.fixRes && dotKind(why) === 'fixed') { amt = Math.max(1, amt * (1 - t.boss.fixRes)); RV(t, 'fixRes'); }   // 玫瑰星云「稀薄粒子」：异常状态的持续伤害只有两成（2026-11-01）
  if (o.direct && !o.cost && S.glenAttack) amt = glenAttackDamage(S, evs, j, amt, S.glenAttack.from);
  amt = Math.min(t.hp, Math.floor(amt)); t.hp -= amt;
  if (S.worldBoss && j === 1 && !o.cost) S.worldBoss.damage += Math.max(0, amt);
  E(S, evs, 'hit', { side: j, amount: amt, kind: dotKind(why) });
  if (why) log(S, evs, why);
  if (t.boss && t.boss.rebirth && !t.boss.reborn && t.hp < 2500) { rebirthBarren(S, evs, j, t); return amt; }
  if (t.hp <= 0 && why) hqDot(S, evs, t, why);
  if (t.hp <= 0 && j === 1 && !S.pvp) CS(S).dotKO++;
  if (t.hp <= 0) faint(S, evs, j);
  if (t.boss && t.boss.bok && !t.boss.bokUsed && !t.fainted && t.hp > 0 && t.hp < 2000) nebBok(S, evs, j, t);
  return amt;
}
function applyDamage(S, evs, j, amount, src, o) {
  o = o || {};
  var t = act(S, j); if (t.fainted || (t.boss && t.boss.broken)) return 0;
  if (amount > 0) {
    amount = bossDamage(S, evs, j, amount, { direct: src != null && src !== j && !o.indirect, percent: !!o.percent, status: !!o.status, cost: !!o.cost });
    if (amount <= 0) { S.lastShown = 0; return 0; }
  }
  if (!o.indirect) amount = glenAttackDamage(S, evs, j, amount, src);
  if (t.cbl) amount = amount * (1 - 0.25 * t.cbl);   // Cumberland：受到的伤害减免 25%（增幅后 37.5%）
  if (t.insFx && t.insFx.ice && src != null && src !== j && amount > 0 && RNG() < 0.2) { amount = Math.max(0, amount - 20); log(S, evs, nm(t) + '的刻印「肃穆之冰」减免了 20 点伤害', 'fxl'); }   // 2026-11-01
  if (t.boss && t.boss.fixRes && o.eff === undefined && !o.crit && amount > 0) { amount *= 1 - t.boss.fixRes; RV(t, 'fixRes'); }   // 无尽作战「固伤减免」
  var amt = Math.floor(amount), excess = 0;
  if (t.tm.cap > 0 && amt > 250 && src != null) { excess = amt - 250; amt = 250; }
  var willEx = 0; if (t.boss && t.boss.odoWill && amt > 200 && src != null && src !== j) { willEx = amt - 200; amt = 200; RV(t, 'odoWill'); }   // 护阵意志：单次受伤不超过 200，超出的反弹
  if (t.fx.prideShield && t.fx.prideShield.hp > 0) {
    var prideAbs = Math.min(t.fx.prideShield.hp, amt); t.fx.prideShield.hp -= prideAbs; amt -= prideAbs;
    if (prideAbs) log(S, evs, nm(t) + '的孤王之傲护盾吸收了 ' + prideAbs + ' 点伤害');
    if (!t.fx.prideShield.hp) delete t.fx.prideShield;
  }
  if (t.fx.shield > 0) {
    var ab = Math.min(t.fx.shield, amt); t.fx.shield -= ab; amt -= ab;
    if (ab) log(S, evs, nm(t) + '的护盾吸收了 ' + ab + ' 点伤害');
  }
  if (t.fx.endure && src != null && amt >= t.hp && t.hp > 1) {
    amt = t.hp - 1; t.fx.endure = 0; log(S, evs, nm(t) + '的不灭之躯撑住了，残留 1 点体力！', 'fxl'); hqGet(S, evs, t, '寂灭幽映');
  }
  if (t.id === 'dummy' && !t.breakable) { recordDummy(S, amt, src == null ? (S.dotSrc || '持续/附加效果') : null); E(S, evs, 'hit', { side: j, amount: amt, crit: o.crit, eff: o.eff }); return amt; }
  if (t.boss && t.boss.guard && !t.boss.guardUsed && amt >= t.hp && t.hp > 1) { amt = t.hp - 1; t.boss.guardUsed = 1; RV(t, 'guard'); log(S, evs, nm(t) + '的「坚壁」发动了，残留 1 点体力！', 'fxl'); }
  if (j === 1 && src === 0 && !S.pvp) { var cs = CS(S); if (o.crit) cs.crit++; if (amount > cs.maxHit) cs.maxHit = Math.floor(amount); if (t.hp >= t.maxhp && amount >= t.maxhp) cs.oneShot++; }
  var shown = amt;   // 2026-10-19：伤害溢出时界面和日志仍显示完整伤害（实际扣血不超过剩余体力）
  amt = Math.min(t.hp, amt); t.hp -= amt; S.lastShown = shown;
  if (S.worldBoss && j === 1 && !o.cost && src !== j) S.worldBoss.damage += Math.max(0, amt);
  if (amt > 0 && t.st['睡眠'] > 0 && src != null) { delete t.st['睡眠']; log(S, evs, nm(t) + '被打醒了'); }
  E(S, evs, 'hit', { side: j, amount: shown, crit: o.crit, eff: o.eff, kind: o.eff === undefined && !o.crit ? 'fixed' : undefined });
  if (t.insFx && t.insFx.water && src != null && src !== j && amt > 0 && !t.fainted && t.hp > 0 && !act(S, src).fainted && RNG() < 0.2) { var wk = RNG() < 0.5 ? { atk: -1 } : { spa: -1 }; log(S, evs, nm(t) + '的刻印「幽静之水」发动了', 'fxl'); changeStages(S, evs, src, wk, j); }   // 2026-11-01
  if (t.tm.counter > 0 && src != null && src !== j && amt > 0 && !act(S, src).fainted) { var cs0 = Math.max(1, Math.floor(amt * 0.25)); loseHp(S, evs, src, cs0, nm(t) + '的反击风暴反弹了 ' + cs0 + ' 点伤害'); }   // 2026-11-02
  if (t.boss && src === 0 && j === 1 && amt > 0 && !act(S, src).fainted && (t.boss.eRef || t.boss.rPhys || t.boss.rSpec)) {   // 无尽作战：反弹 / 反弹物攻 / 反弹特攻
    var rcat = S.curMove && M[S.curMove] ? M[S.curMove].cat : '', rk = t.boss.eRef ? 'eRef' : rcat === '物攻' && t.boss.rPhys ? 'rPhys' : rcat === '特攻' && t.boss.rSpec ? 'rSpec' : '';
    if (rk) { var rf = Math.max(1, Math.floor(amt * t.boss[rk])); RV(t, rk); loseHp(S, evs, src, rf, nm(t) + '反弹了 ' + rf + ' 点伤害'); }
  }
  if (t.boss && t.boss.thorn && src != null && src !== j && amt > 0 && !act(S, src).fainted) { var th = Math.max(1, Math.floor(amt * 0.15)); RV(t, 'thorn'); loseHp(S, evs, src, th, nm(t) + '的「荆棘」反弹了 ' + th + ' 点伤害'); }
  if (excess > 0) {
    log(S, evs, nm(t) + '的龙之逆鳞把 ' + excess + ' 点伤害反馈给了对方！', 'fxl');
    loseHp(S, evs, src, excess);
  }
  if (willEx > 0 && !act(S, src).fainted) { log(S, evs, nm(t) + '的「护阵意志」把 ' + willEx + ' 点伤害反弹了回去！', 'fxl'); loseHp(S, evs, src, willEx); }
  if (t.boss && t.boss.rebirth && !t.boss.reborn && t.hp < 2500) { rebirthBarren(S, evs, j, t); return amt; }
  if (j === 0 && amt > 0 && src === 1 && act(S, 1).boss && act(S, 1).boss.neb) S.nebHit = 1;   // 第十九段：玩家第一次被玫瑰星云打中，回合结束时 Cumber 加入
  if (t.hp <= 0 && !o.noFaint) faint(S, evs, j);
  if (t.boss && t.boss.bok && !t.boss.bokUsed && !t.fainted && t.hp > 0 && t.hp < 2000) nebBok(S, evs, j, t);
  // 虹霓暴走：对对方累计造成 1000 点伤害（不算溢出）就爆破一次，自己损失 500，对方受到 500 固定伤害
  var rbm = src != null && src !== j ? act(S, src) : null;
  if (rbm && rbm.boss && rbm.boss.rainbow && amt > 0 && !rbm.fainted) {
    rbm.fx.rb = (rbm.fx.rb || 0) + amt;
    while (rbm.fx.rb >= 1000 && !rbm.fainted && !S.over) { rbm.fx.rb -= 1000; RV(rbm, 'rainbow'); log(S, evs, nm(rbm) + '体内的虹光满溢，爆破了！', 'crit'); loseHp(S, evs, src, 500, nm(rbm) + '损失了 500 体力'); if (!act(S, j).fainted) applyDamage(S, evs, j, 500, null, {}); }
  }
  return amt;
}
function heal(S, evs, i, amount) {
  var m = act(S, i); if (m.fainted || (m.boss && m.boss.broken)) return 0;
  if (m.tm.noHeal > 0) { if (Math.floor(amount) > 0 && m.hp < m.maxhp) log(S, evs, nm(m) + '处于禁疗状态，无法恢复体力', 'bad'); return 0; }
  if (m.insFx && m.insFx.grass) amount *= 1.15;   // 刻印「灵魄之草」（2026-11-01）：恢复量 +15%
  var a = Math.min(m.maxhp - m.hp, Math.floor(amount));
  if (a <= 0) return 0;
  m.hp += a; E(S, evs, 'heal', { side: i, amount: a });
  if (i === 0) CS(S).heal += a;
  log(S, evs, nm(m) + '恢复了 ' + a + ' 点体力', 'good');
  if (ability(m) === '暗潮' && RNG() < 0.3) { log(S, evs, nm(m) + '的「暗潮」发动了', 'fxl'); changeStages(S, evs, i, { eva: 1 }); }
  return a;
}
// src：施加者（降低对方能力时用来触发特性）
function pureFieldActive(S) {
  return S.sides.some(function (sd) { var m = sd.team[sd.active]; return m && !m.fainted && !(m.boss && m.boss.broken) && m.tm.pureField > 0; });
}
function stageBlocked(S, evs) {
  if (!pureFieldActive(S)) return false;
  log(S, evs, '纯净领域生效，双方能力等级无法变化', 'fxl'); return true;
}
function changeStages(S, evs, i, obj, src) {
  var m = act(S, i); if (m.fainted) return;
  if (stageBlocked(S, evs)) return;
  var parts = [], lowered = false, tried = false;
  for (var k in obj) {
    var v = obj[k];
    if (v > 0 && (m.tm.noBoost > 0 || m.tm.seal > 0)) { tried = true; continue; }
    if (v < 0 && m.boss && m.boss.immortal) { RV(m, 'immortal'); parts.push(STG_NAME[k] + '被「不朽」免疫'); continue; }
    if (v < 0 && m.tm.mist > 0) { parts.push(STG_NAME[k] + '被白雾保护'); continue; }
    var old = m.stages[k], nv = Math.max(-6, Math.min(6, old + v));
    m.stages[k] = nv;
    if (nv === old) parts.push(STG_NAME[k] + (v > 0 ? '已无法再提升' : '已无法再降低'));
    else { parts.push(STG_NAME[k] + (nv > old ? ' +' : ' −') + Math.abs(nv - old)); if (nv < old) lowered = true; if (i === 0 && nv >= 6) CS(S).up6++; if (i === 1 && nv <= -6) CS(S).down6++; }
  }
  if (tried) {
    log(S, evs, nm(m) + '被封印，无法提升能力等级', 'bad');
    if (m.tm.seal > 0) loseHp(S, evs, i, Math.floor(m.hp / 4), '万灵封印反噬，' + nm(m) + '损失了1/4当前体力', false, { percent: true });
  }
  if (parts.length) { E(S, evs, 'stage', { side: i }); log(S, evs, nm(m) + ' ' + parts.join('，'), 'fxl'); }
  if (lowered && src != null && src !== i && !act(S, src).fainted && ability(act(S, src)) === '引雷') m.fx.leiyin = 1;
}
var CONTROL = { 害怕: 1, 石化: 1, 睡眠: 1, 麻痹: 1, 冰冻: 1, 疲惫: 1 };
var CANT_ACT = { 害怕: '害怕得无法行动', 石化: '被石化了，无法行动', 睡眠: '正在睡觉', 麻痹: '身体麻痹，无法行动', 冰冻: '被冻住了，无法行动', 疲惫: '疲惫得无法行动' };
// 石化被暴击打碎（2026-10-27）
function petriBreak(S, evs, j) { var t = act(S, j); if (t.st['石化'] > 0) { t.st['石化'] = 0; E(S, evs, 'stage', { side: j }); log(S, evs, nm(t) + '身上的石化被打碎了', 'fxl'); } }
// 属性免疫的异常状态（2026-10-27）：草系免疫寄生，火系免疫烧伤，水系免疫溺水，冰系免疫冻伤和冰冻
var ST_IMMUNE = { 寄生: '草', 烧伤: '火', 溺水: '水', 冻伤: '冰', 冰冻: '冰' };
function addStatus(S, evs, j, k, turns, src, noReflect, refresh) {
  var t = act(S, j); if (t.fainted) return;
  if (t.boss && (t.boss.noStatus || t.boss.immortal)) { RV(t, 'noStatus'); RV(t, 'immortal'); log(S, evs, nm(t) + '免疫异常状态，「' + k + '」没有效果'); return; }
  if (ST_IMMUNE[k] && typesOf(t).indexOf(ST_IMMUNE[k]) >= 0) { log(S, evs, nm(t) + '是' + ST_IMMUNE[k] + '系精灵，不会' + (k === '寄生' ? '被寄生' : k === '冰冻' ? '被冰冻' : '陷入' + k)); return; }
  if (t.tm.reflect > 0) {
    if (!noReflect && src != null && !act(S, src).fainted) {
      log(S, evs, nm(t) + '的风王结界把「' + k + '」反弹了回去！', 'fxl');
      addStatus(S, evs, src, k, turns, j, true, refresh);
    } else log(S, evs, nm(t) + '免疫了「' + k + '」');
    return;
  }
  if (t.tm.immune > 0) { hqR(t).blk = 1; log(S, evs, nm(t) + '免疫了「' + k + '」'); return; }
  if (k === '流血' && typesOf(t).indexOf('机械') >= 0) { log(S, evs, nm(t) + '是机械系精灵，不会流血'); return; }
  if (k === '中毒') {
    if (t.st['中毒'] > 0) {
      t.fx.poison = (t.fx.poison || 1) + 1; t.st['中毒'] = Math.max(t.st['中毒'], turns);
      E(S, evs, 'stage', { side: j });
      log(S, evs, nm(t) + '的中毒叠加到 ' + t.fx.poison + ' 层（剩 ' + t.st['中毒'] + ' 回合）', 'bad'); return;
    }
    t.fx.poison = 1;
  }
  // refresh（如寄生之种）：对方已经处于这个状态时，把剩余回合重置
  // 2026-10-18：对已经处于这个状态的精灵再施加时，剩余回合刷新为更久的那一个（所有异常状态通用）
  if (t.st[k] > 0) {
    var nt = turns + (CONTROL[k] && S.turnActed[j] ? 1 : 0);
    if (nt > t.st[k]) { t.st[k] = nt; E(S, evs, 'stage', { side: j }); log(S, evs, nm(t) + '的「' + k + '」刷新为 ' + nt + ' 回合', 'bad'); }
    else log(S, evs, nm(t) + '已经处于' + k + '状态');
    return;
  }
  if (t.boss && t.boss.eSt) { turns = Math.max(1, Math.ceil(turns * (1 - t.boss.eSt))); RV(t, 'eSt'); }   // 无尽作战「异常抗性」：持续回合减少
  // 控制类状态：如果对方本回合已经行动过，额外+1回合，保证真的能控住
  t.st[k] = turns + (CONTROL[k] && S.turnActed[j] ? 1 : 0);
  if (j === 1 && src === 0) { var cst = CS(S).st; cst[k] = (cst[k] || 0) + 1; }
  if (src != null && src !== j) hqStatus(S, evs, t, k, act(S, src));
  E(S, evs, 'stage', { side: j });
  log(S, evs, nm(t) + '陷入了「' + k + '」状态（' + turns + '回合）', 'bad');
  if (k === '冰冻' && src != null && ability(act(S, src)) === '冰刺') { log(S, evs, nm(act(S, src)) + '的「冰刺」发动了', 'fxl'); clearUps(S, evs, j); }
}
function statusRoll(me, chance) { return RNG() < chance * (me.tm.swamp > 0 ? 1.5 : 1); }
function clearVolatile(m) { m.stages = blankStages(); m.st = {}; m.tm = {}; m.fx = {}; }
function rint(a, b) { return a + Math.floor(RNG() * (b - a + 1)); }
function negCount(m) {
  var n = 0; for (var s in m.st) if (m.st[s] > 0) n++;
  STG.forEach(function (k) { if (m.stages[k] < 0) n++; });
  if (m.perm.melt) n++; if (m.perm.wither) n++;
  return n;
}
function posSum(m) { var n = 0; STG.forEach(function (k) { if (m.stages[k] > 0) n += m.stages[k]; }); return n; }

/* ---------- 伤害公式（参考赛尔号） ---------- */
function movePower(me, foe, mv) {
  var power = mv.power, t = mvType(me, mv);
  if (hasEmblem(me, '音速喷射') && mv.name === '音速喷射') power += 30;
  if (ability(me) === '元素' && (t === '水' || t === '火' || t === '草')) power += 10;
  if (me.tm.liuhuo > 0 && t === '火') power += 5;
  switch (mv.custom) {
    case 'lowHpDouble': if (foe.hp < foe.maxhp / 4) power *= 2; break;
    case 'iceSpike': if (foe.st['冰冻'] > 0) power += 50; break;
    case 'originStorm': power += 15 * Math.max(0, -foe.stages.spe); break;
    case 'punish': power += 20 * posSum(foe); break;
    case 'canyue': power = canyuePow(me.fx.canyueNow ? (me.flags.canyue || 1) - 1 : me.flags.canyue || 0); break;
    case 'starMagic': var sn = me.perm.star || 0; power = Math.min(STAR_MAX, 25 * (me.fx.starNow ? sn : sn + 1)); break;
    case 'glenStone': if (foe.fx.stoneMark) power *= 2; break;
    case 'baliFantasy': power += 5 * missingPP(foe); break;
  }
  if (foe.fx && foe.fx.earMark) power *= 2;
  return mv.prismHalf ? power / 2 : power;
}
function calcDamage(me, foe, mv, firstMover, est) {
  var power = movePower(me, foe, mv), t = mvType(me, mv);
  var phys = mv.cat === '物攻';
  var A = me.stats[phys ? 'atk' : 'spa'] * stageMult(me.stages[phys ? 'atk' : 'spa']) * miaAtk(me);
  var dS = foe.stages[phys ? 'def' : 'spd']; if (mv.custom === 'pierceDef' && phys) dS = Math.min(0, dS);   // 贯穿雷刃：无视对方的物防提升
  var D = foe.stats[phys ? 'def' : 'spd'] * stageMult(dS) * miaDef(foe);
  var base = Math.floor(Math.floor(Math.floor(2 * (me.lv || LV) / 5 + 2) * power * A / D) / 50) + 2;
  var mod = 1, e = effT(t, typesOf(foe)), crit = false;
  if (typesOf(me).indexOf(t) >= 0) mod *= STAB;
  mod *= e;
  var ab = ability(me), fab = ability(foe);
  if (est) mod *= 236 / 255;
  else {
    var cr = (mv.crit === 'high' ? 0.25 : 1 / 16) * (ab === '虚空' ? 2 : 1);
    if (mv.alwaysCrit) crit = true;   // 淬命之焰：必定致命一击（不消耗「下次必暴」）
    else if (me.fx.sureCrit) { crit = true; me.fx.sureCrit = 0; }
    else if (me.tm.crit2 > 0 || me.tm.enCrit > 0) crit = true;
    else crit = RNG() < cr;
    if (crit) mod *= 1.5;
    if (crit && foe.st['石化'] > 0) mod *= 2;   // 2026-10-27：石化中被暴击，这次暴击伤害翻倍（之后解除石化）
    mod *= (217 + Math.floor(RNG() * 39)) / 255;
  }
  if (ab === '龙啸' && foe.hp < me.hp) mod *= 1.15;
  if (ab === '复苏' && me.hp <= me.maxhp / 3) mod *= 1.3;
  if (ab === '借风' && firstMover) mod *= 1.15;
  if (ab === '突袭' && !me.flags.firstAtk) mod *= 1.3;
  if (ab === '起源' && speedOf(me) > speedOf(foe)) mod *= 1.15;
  if (ab === '熔炼') mod *= 1 + 0.06 * Math.min(5, (me.fx.fieldT || 0) + 1);
  if (ab === '追猎' && foe.hp <= foe.maxhp / 3) mod *= 1.25;
  if (ab === '熔岩' && foe.st['烧伤'] > 0) mod *= 1.25;
  if (ab === '爆燃') mod *= 1 + 0.1 * (est ? (me.fx.charge || 0) : (me.fx.chargeNow || 0));
  if (me.fx.moonNext) mod *= 1.15;
  if (me.perm.moonFull) mod *= 1.15;
  if (fab === '枯萎') mod *= Math.max(0.7, 1 - 0.05 * (foe.fx.fieldT || 0));
  if (fab === '幻叶' && foe.hp <= foe.maxhp / 3) mod *= 0.85;
  if (fab === '盾甲') mod *= 0.9;
  if (me.tm.odoAtk > 0) mod *= 1.25;   // 全弹搭载
  if (foe.tm.odoDef > 0) mod *= 0.8;
  if (foe.boss && foe.boss.odoRate && foe.fx.lateNow) { mod *= 1.25; if (!est) RV(foe, 'odoRate'); }   // 强效外壳
  if (foe.perm && foe.perm.odoMark) mod *= 1 + 0.1 * foe.perm.odoMark;   // 解析导弹
  if (me.perm && me.perm.odoJam) mod *= Math.max(0, 1 - 0.08 * me.perm.odoJam);   // 侵扰投弹
  if (fab === '水形' && STG.some(function (k) { return foe.stages[k] > 0; })) mod *= 0.9;
  switch (mv.custom) {
    case 'halfHpBoost': if (foe.hp < foe.maxhp / 2) mod *= 1.5; break;
    case 'poisonBoost': if (foe.st['中毒'] > 0) mod *= 1.5; break;
    case 'lowHpX2': if (me.hp < me.maxhp / 3) mod *= 2; break;
    case 'lateX2': if (!firstMover) mod *= 2; break;   // 回转之焰：后出手时威力翻倍
  }
  if (me.tm.jungle > 0 && foe.hp / foe.maxhp < me.hp / me.maxhp) mod *= 1.7;
  if (me.fx.boostNext) mod *= 1.5;
  if (me.fx.x2Next) mod *= 2;   // 岩洞藏匿成功后的下一次直接攻击
  if (me.enDmg) mod *= 1 + me.enDmg;   // 无尽作战（2026-11-02）：能力 / 消耗品 / 装备的增伤
  if (me.enCombo) mod *= 1 + 0.2 * me.enCombo;   // 凡响连击
  if (me.boss && me.boss.eAtk) { mod *= 1 + me.boss.eAtk; if (!est) RV(me, 'eAtk'); }
  if (foe.boss && foe.boss.eDr) { mod *= 1 - foe.boss.eDr; if (!est) RV(foe, 'eDr'); }
  if (me.tm.weak > 0) mod *= 0.7;
  if (me.st['溺水'] > 0) mod *= 0.3;
  if (foe.tm.soul > 0) mod *= 1.2;
  if (foe.tm.vuln > 0) mod *= 1.3;
  if (foe.perm.melt) mod *= 1 + 0.2 * foe.perm.melt;
  if (foe.fx.leiyin) { mod *= 1.2; if (!est) foe.fx.leiyin = 0; }
  if (phys && foe.tm.halfPhys > 0) mod *= 0.5;
  if (!phys && foe.tm.halfSpec > 0) mod *= 0.5;
  if (foe.tm.dr40 > 0) mod *= 0.6;
  if (est && foe.fx.highlandHits > 0) mod *= .65;
  if (foe.boss && foe.boss.dr) { mod *= 1 - foe.boss.dr; if (!est) RV(foe, 'dr'); }   // BOSS「星球聚能」
  // 玫瑰星云「疏散星团」（2026-11-01 改为BOSS特效，按体力管变化）：阿尔法 伤害 +50%；贝塔 受伤 -30%；欧米茄 先出手伤害 +50%、后出手受伤 -30%
  if (me.boss && me.boss.cl) { var clA = me.boss.bar || 0; if (clA === 0 || (clA === 2 && firstMover)) { mod *= 1.5; if (!est) RV(me, 'cl'); } }
  if (foe.boss && foe.boss.cl) { var clB = foe.boss.bar || 0; if (clB === 1 || (clB === 2 && firstMover)) { mod *= 0.7; if (!est) RV(foe, 'cl'); } }
  if (me.cbl) mod *= 1 + 0.5 * me.cbl;   // Cumberland：双攻 +50%（增幅后 +75%）
  if (!est && me.boss) ['feud', 'mmGift', 'rainbow', 'erode', 'eternal'].forEach(function (k) { RV(me, k); });   // 物攻 / 特攻加成类：第一次出手造成伤害时揭晓
  if (foe.boss && foe.boss.eternal) { mod *= 1.2; if (!est) RV(foe, 'eternal'); }   // 复活后的泰戈尔「永续的纷争」：受到的伤害 +20%
  if (me.boss && me.boss.purify && miaN(foe) > 0) { mod *= 2; if (!est) RV(me, 'purify'); }
  if (me.boss && me.boss.rage && me.hp < me.maxhp / 2) { mod *= 1.3; if (!est) RV(me, 'rage'); }
  if (me.boss && me.boss.focus) { mod *= 1.2; if (!est) RV(me, 'focus'); }   // 先驱之塔「专注」
  if (foe.boss && foe.boss.armor) { mod *= 0.8; if (!est) RV(foe, 'armor'); }   // 先驱之塔「厚甲」   // 先驱之塔「狂暴」
  if (me.boss && me.boss.reaper && !est) RV(me, 'reaper');
  if (me.boss && me.boss.reaper) mod *= 1.25 + 0.02 * Math.max(0, Math.floor((1 - foe.hp / foe.maxhp) * 100));   // 「死神」   // 叶子喵剧情限定特性「净化光芒」：对沾染瘴气的目标伤害 +100%
  return { dmg: Math.max(1, Math.floor(base * mod)), crit: crit, eff: e, petri: crit && !est && foe.st['石化'] > 0 };
}
function hitChance(me, foe, mv) {
  if (mv.always) return 1;
  var acc = mv.acc || 100;
  if (mv.custom === 'drown' && foe.st['溺水'] > 0) acc = 90;
  var p = acc / 100 * accMult(me.stages.acc - foe.stages.eva);
  if (ability(foe) === '光滑') p *= 0.9;
  return Math.min(1, p);
}
// 攻击技能附加的固定伤害：fixed 是固定数值，fixedLv 是「自身等级 × 倍数」（如盛宴）
function addFixed(me, mv) { return mv.fixedLv ? Math.floor((me.lv || LV) * mv.fixedLv) : mv.fixed || 0; }
function fixedAmount(me, foe, mv, est) {
  if (mv.fixedOnly === 'smile') {
    var low = me.lv || LV, high = Math.floor(low * 2.5);
    return est ? (low + high) / 2 : rint(low, high);
  }
  if (mv.fixedOnly === 'selfBlast') return Math.max(me.hp, Math.ceil(me.maxhp / 3));   // 等于当前体力，但不低于最大体力的 1/3
  return 0;
}

/* ---------- 回合流程 ---------- */
function moveFor(m, i) {
  if (i < 0) return STRUGGLE;
  var slot = m.moves[i];
  return slot && slot.pp > 0 ? M[slot.n] : STRUGGLE;
}
function speedOf(m) { if (m.boss && m.boss.odoRate) return 1000 * stageMult(m.stages.spe); return m.stats.spe * stageMult(m.stages.spe); }   // 歼灭速率：先天速度约 1000

function resolveTurn(S, acts) {
  var evs = [];
  S.turnActed = [false, false]; S.silenced = [false, false]; S.order = [];
  S.sides.forEach(function (sd) { sd.team.forEach(function (m) { if (m.fx) m.fx.lateNow = 0; }); });   // 歼灭速率：「这回合被抢先出手」只算当回合
  log(S, evs, '第 ' + S.turn + ' 回合', 'turn');
  barlowStart(S, evs);
  if (rhythmStart(S, evs)) {
    checkOver(S, evs);
    if (S.over) { S.turn++; return evs; }
    if ([0, 1].some(function (i) { var m = act(S, i); return m.fainted || (m.boss && m.boss.broken); })) acts = acts.map(function (a) { return a.kind === 'move' ? { kind: 'pass' } : a; });
  }
  [0, 1].forEach(function (i) { var em = act(S, i); if (!em.fainted && em.insFx && em.insFx.elec && RNG() < 0.2) { log(S, evs, nm(em) + '的刻印「迅疾之电」发动了', 'fxl'); changeStages(S, evs, i, { spe: 1 }); } });   // 2026-11-01
  if (S.turn === 1 && !S.ambushed) { S.ambushed = 1; var amb = act(S, 1); if (amb.boss && amb.boss.ambush && !act(S, 0).fainted) { RV(amb, 'ambush'); log(S, evs, nm(amb) + '使用了「突然袭击」！', 'use'); E(S, evs, 'use', { side: 1, move: '突然袭击', type: typesOf(amb)[0] }); applyDamage(S, evs, 0, amb.boss.ambush, null, {}); if (act(S, 0).fainted && !S.over) { checkOver(S, evs); } } }
  if (S.turn === 1 && !S.nebOpen) { var nb = act(S, 1); if (nb.boss && nb.boss.neb && !act(S, 0).fainted && M['强烈恒星风']) { S.nebOpen = 1; log(S, evs, nm(nb) + '一现身，就释放了恒星风暴！', 'crit'); useMove(S, evs, 1, M['强烈恒星风'], -1, true); checkOver(S, evs); if (S.over) { S.turn++; return evs; } } }   // 玫瑰星云：开局先放一次强烈恒星风
  if (S.en) enTurnStart(S, evs, acts);
  if (acts[0].kind === 'item') { useItem(S, evs, 0, acts[0].key); S.turnActed[0] = true; if (S.over) { S.turn++; return evs; } }
  [0, 1].forEach(function (i) { if (acts[i].kind === 'switch') doSwitch(S, evs, i, acts[i].to, true); });
  // BOSS「瘴毒傀儡」：占用BOSS这一回合，下场并召唤傀儡
  if (!S.pvp && acts[1].kind === 'move' && puppetRoll(S)) { summonPuppet(S, evs); acts = [acts[0], { kind: 'pass' }]; S.turnActed[1] = true; }
  var info = [0, 1].filter(function (i) { return acts[i].kind === 'move'; }).map(function (i) {
    var m = act(S, i), mv = moveFor(m, acts[i].i);
    if (m.boss && m.boss.swift) RV(m, 'swift'); if (m.boss && m.boss.reaper) RV(m, 'reaper');
    return { i: i, mv: mv, slot: acts[i].i, pri: mv.pri + (m.tm.prio > 0 ? 1 : 0) + (m.boss && (m.boss.swift || m.boss.reaper) ? 1 : 0), spe: speedOf(m), r: RNG() };
  });
  info.sort(function (a, b) { return b.pri - a.pri || b.spe - a.spe || a.r - b.r; });
  S.order = info.map(function (x) { return x.i; });
  S.parry = [null, null];   // 心眼刀 / 至高之术：用出后本回合内处于化解架势（2026-11-02）
  [0, 1].forEach(function (i) { if (acts[i].kind === 'switch') S.turnActed[i] = true; });
  for (var q = 0; q < info.length; q++) {
    if (S.over) break;
    if (S.en && info[q].i === 0) enPreMove(S, info[q].mv);
    useMove(S, evs, info[q].i, info[q].mv, info[q].slot);
    S.turnActed[info[q].i] = true;
    if (S.en && info[q].i === 0) enPostMove(S, evs, info[q].mv);
    checkOver(S, evs);
  }
  if (!S.over) endOfTurn(S, evs);
  if (!S.over && S.en) { enEndTurn(S, evs); checkOver(S, evs); }
  if (!S.over) nebCumber(S, evs);
  checkOver(S, evs);
  if (!S.over && S.worldBoss && S.turn >= S.worldBoss.limit) {
    S.worldBoss.finished = true; S.over = 'win';
    log(S, evs, '高地之王的' + S.worldBoss.limit + '回合试炼结束，共造成' + S.worldBoss.damage + '点伤害', 'turn'); E(S, evs, 'over', { result: 'win' });
  }
  if (!S.over && !S.training && !S.noLimit && S.turn >= MAX_TURNS) timeUp(S, evs);   // noLimit：PVE 不限回合（2026-10-24），竞技对战仍是 60 回合
  if (!S.over) {
    if (S.pvp) { S.need = [act(S, 0).fainted, act(S, 1).fainted]; S.needSwitch = false; }   // 联网切磋：双方各自选替补
    else {
      if (act(S, 1).fainted) { var k = aiPickReplacement(S); doSwitch(S, evs, 1, k, false); }
      S.needSwitch = act(S, 0).fainted && !S.needCore;
    }
  }
  if (S.en) enSync(S);
  S.turn++;
  return evs;
}

/* ---------- 无尽作战（2026-11-02）：S.en = { on: { 已激活的能力/消耗品 }, combo, cnt, aresQ, ghostT } ----------
 * 能力、消耗品都放在 S.items 里（ITEMS 里 en: true 的那些），用掉占一回合。装备写在我方精灵的 eq 上（['eq_heal8', …]）。
 * 具体数值见 js/engine/endless.js 的 EN_ITEMS（这里按 key 结算） */
var EN_FX = { cs_flag: { dmg: 0.25 }, ab_pow15: { dmg: 0.15 }, ab_pow20: { dmg: 0.2 } };
function enSync(S) {
  if (!S.en) return;
  var on = S.en.on || {}, d = 0; for (var k in on) if (on[k] && EN_FX[k]) d += EN_FX[k].dmg;
  var f = act(S, 1), ns = !!(f && !f.fainted && f.boss && f.boss.noStatF);
  if (ns) RV(f, 'noStatF');
  S.sides[0].team.forEach(function (m) { var e = 0; (m.eq || []).forEach(function (q) { if (q === 'eq_ketos') e += 0.3; if (q === 'eq_dmg20') e += 0.2; }); m.enDmg = d + e; m.enNS = ns ? 1 : 0; });
}
function enTurnStart(S, evs, acts) {
  var on = S.en.on || {};
  if (on.ab_ghost && S.turn % 3 === 0) { S.en.ghostT = S.turn; log(S, evs, '幽灵形态：这回合必定闪避攻击', 'fxl'); }
  if (acts[0].kind !== 'move') S.en.combo = 0;
}
function enPreMove(S, mv) { var me = act(S, 0); me.enCombo = S.en.on && S.en.on.ab_combo && mv.cat !== '变化' ? (S.en.combo || 0) : 0; }
function enPostMove(S, evs, mv) {
  var on = S.en.on || {}, me = act(S, 0); me.enCombo = 0;
  if (mv.cat !== '变化') { S.en.combo = (S.en.combo || 0) + 1; if (on.ab_combo && S.en.combo > 1) log(S, evs, '凡响连击 ×' + S.en.combo + '（下次攻击伤害 +' + (20 * S.en.combo) + '%）', 'fxl'); }
  else S.en.combo = 0;
  if (mv.cat !== '变化' && !me.fainted) {
    if (on.ab_ares2) S.en.aresQ = (S.en.aresQ || 0) + 100;
    else if (on.ab_ares1 && RNG() < 0.5) S.en.aresQ = (S.en.aresQ || 0) + 60;
  }
  if (on.ab_echo && mv !== STRUGGLE && !S.over && !me.fainted) {
    S.en.cnt = (S.en.cnt || 0) + 1;
    if (S.en.cnt % 4 === 0 && !act(S, 1).fainted) { log(S, evs, '回响形态：「' + mv.name + '」再次释放！', 'crit'); enPreMove(S, mv); useMove(S, evs, 0, mv, -1, true); me.enCombo = 0; checkOver(S, evs); }
  }
}
function enEndTurn(S, evs) {
  var f = act(S, 1);
  if (S.en.aresQ > 0 && !f.fainted && !act(S, 0).fainted) { var q = S.en.aresQ; S.en.aresQ = 0; log(S, evs, '阿瑞斯打击！造成 ' + q + ' 点固定伤害', 'crit'); applyDamage(S, evs, 1, q, 0, {}); if (f.hp <= 0 && !f.fainted) faint(S, evs, 1); }
  S.en.aresQ = 0;
  var me = act(S, 0); if (me.fainted) return;
  var hp = 0, ppE = 0;
  (me.eq || []).forEach(function (q) { if (q === 'eq_heal8') hp += 0.08; if (q === 'eq_heal12') hp += 0.12; if (q === 'eq_heal16') hp += 0.16; if (q === 'eq_pp3' && S.turn % 3 === 0) ppE++; if (q === 'eq_pp2' && S.turn % 2 === 0) ppE++; });
  if (hp && me.hp < me.maxhp) { log(S, evs, nm(me) + '的愈疗装备恢复了体力', 'fxl'); heal(S, evs, 0, me.maxhp * hp); }
  if (ppE) { var g = 0; me.moves.forEach(function (x) { var a = Math.min(ppE, x.max - x.pp); if (a > 0) { x.pp += a; g += a; } }); if (g) log(S, evs, nm(me) + '的轮盘装备恢复了 ' + g + ' 点 PP', 'fxl'); }
}
function enUse(S, evs, i, key) {
  var it = ITEMS[key], me = act(S, 0), f = act(S, 1);
  if (!S.en) S.en = { on: {} }; if (!S.en.on) S.en.on = {};
  log(S, evs, '你使用了「' + it.name + '」', 'fxl');
  switch (key) {
    case 'cs_fumo': if (!f.fainted) { var fd = Math.floor(f.maxhp * 0.4); log(S, evs, 'fumo炸弹爆炸了！', 'crit'); applyDamage(S, evs, 1, fd, 0, { percent: true, indirect: true }); if (f.hp <= 0 && !f.fainted) faint(S, evs, 1); checkOver(S, evs); } break;
    case 'cs_mia': S.sides[1].team.forEach(function (x) { if (!x.fainted) x.perm.miasma = (x.perm.miasma || 0) + 10; }); E(S, evs, 'stage', { side: 1 }); log(S, evs, '瘴气笼罩了对手全体（各 +10 层瘴气）', 'bad'); break;
    case 'cs_burn5': addStatus(S, evs, 1, '烧伤', 5, 0); break;
    case 'cs_burn10': addStatus(S, evs, 1, '烧伤', 10, 0); break;
    case 'cs_poi2': addStatus(S, evs, 1, '中毒', 5, 0); if (f.st['中毒'] > 0) { f.fx.poison = Math.max(f.fx.poison || 1, 2); E(S, evs, 'stage', { side: 1 }); } break;
    case 'cs_poi3': addStatus(S, evs, 1, '中毒', 7, 0); if (f.st['中毒'] > 0) { f.fx.poison = Math.max(f.fx.poison || 1, 3); E(S, evs, 'stage', { side: 1 }); } break;
    case 'cs_crit': me.tm.enCrit = 3; E(S, evs, 'stage', { side: 0 }); log(S, evs, nm(me) + '的攻击 3 回合内必定致命一击', 'fxl'); break;
    case 'cs_shield': var sh = Math.floor(me.maxhp * 0.25); me.fx.shield = Math.max(me.fx.shield || 0, sh); E(S, evs, 'stage', { side: 0 }); log(S, evs, nm(me) + '获得了 ' + sh + ' 点护盾', 'good'); break;
    case 'cs_horn': changeStages(S, evs, 0, { spe: 2 }); break;
    default: S.en.on[key] = 1; log(S, evs, '「' + it.name + '」本场战斗生效中', 'good');
  }
  enSync(S);
}

/* ---------- 道具：对战中使用（占用本回合） ----------
 * cap1 在商城用能量兑换。cap2、cap3、hp药水、pp药水在冶炼坊合成。（体力补药 pot1、强能体力补药 pot2 已于 2026-10-25 移除，换成 200hp药水） */
var ITEMS = {
  cap1: { name: '普通精灵捕捉装置', price: 200, cap: 1, d: '投向野生精灵尝试捕捉。对手体力越低、身上有异常状态时越容易成功。' },
  cap2: { name: '加强精灵捕捉装置', cap: 1.5, d: '捕捉成功率是普通装置的 1.5 倍。在黄石 · 冶炼坊用星砂合成。' },
  cap3: { name: '华为精灵捕捉装置', cap: 'sure', d: '必定捕捉成功。在黄石 · 冶炼坊用圣晶石合成。' },
  pot1: { name: '体力补药', heal: 0.3, d: '已移除，换成了 200hp药水。' },   // 只为旧数据保留名字
  pot2: { name: '强能体力补药', heal: 0.5, d: '已移除，换成了 200hp药水。' },
  pot100: { name: '100hp药水', heal: 100, flat: true, d: '为出战中的精灵恢复 100 点体力。在黄石 · 冶炼坊用药草合成。' },   // 2026-10-25
  pot200: { name: '200hp药水', heal: 200, flat: true, d: '为出战中的精灵恢复 200 点体力。在黄石 · 冶炼坊用药草合成。' },   // 原名 200血药
  // PP 药水（2026-10-25）：出战中的精灵每个技能各恢复几点 PP（不超过上限）。在黄石 · 冶炼坊用活力花卉合成
  pp5: { name: '5PP药水', pp: 5, d: '为出战中的精灵的每个技能各恢复 5 点 PP。（已停止合成，手里有的照样能用）' },
  pp10: { name: '10PP药水', pp: 10, d: '为出战中的精灵的每个技能各恢复 10 点 PP。在黄石 · 冶炼坊用活力花卉合成。' },
  pp20: { name: '20PP药水', pp: 20, d: '为出战中的精灵的每个技能各恢复 20 点 PP。在黄石 · 冶炼坊用活力花卉合成。' },   // 2026-10-25：PP 药水只合成 10PP、20PP
  pp15: { name: '15PP药水', pp: 15, d: '为出战中的精灵的每个技能各恢复 15 点 PP。（已停止合成，手里有的照样能用）' },
  antidote: { name: '解毒药剂', cure: '中毒', d: '解除出战中的精灵身上全部的中毒状态（不管叠了几层）。在黄石 · 冶炼坊用 1 个蘑菇毒囊和 5 个药草合成。' }   // 2026-10-27
};
var ITEM_ORDER = ['cap1', 'cap2', 'cap3', 'pot100', 'pot200', 'pp10', 'pp20', 'pp5', 'pp15', 'antidote'];
function ppFull(m) { return !m || m.moves.every(function (x) { return x.pp >= x.max; }); }
function hasStatus(m) { for (var k in m.st) if (m.st[k] > 0 && ST_DESC[k]) return true; return false; }
// 捕捉成功率 = 精灵捕捉率 × 装置倍率 × (1 − 剩余体力比例 × 0.5) × (有异常状态 ×1.25)
function catchChance(S, key) {
  var it = ITEMS[key], f = act(S, 1); if (!it || !it.cap || !S.wild || S.wild.noCatch || f.fainted) return 0;
  if (it.cap === 'sure') return 1;
  return Math.min(1, S.wild.rate * it.cap * (1 - 0.5 * f.hp / f.maxhp) * (hasStatus(f) ? 1.25 : 1));
}
function useItem(S, evs, i, key) {
  var it = ITEMS[key], m = act(S, i); if (!it) return;
  if (i === 0) CS(S).items++;
  if (it.en) { enUse(S, evs, i, key); return; }
  if (it.pp) {
    log(S, evs, '你使用了「' + it.name + '」', 'fxl');
    var got = 0; m.moves.forEach(function (x) { var add = Math.min(it.pp, x.max - x.pp); if (add > 0) { x.pp += add; got += add; } });
    if (got) log(S, evs, nm(m) + '的技能一共恢复了 ' + got + ' 点 PP', 'good'); else log(S, evs, nm(m) + '的 PP 已经是满的了', 'dmg');
    return;
  }
  if (it.cure) {   // 解毒药剂：解除全部中毒
    log(S, evs, '你使用了「' + it.name + '」', 'fxl');
    if (m.st[it.cure] > 0) { m.st[it.cure] = 0; if (it.cure === '中毒') m.fx.poison = 0; E(S, evs, 'stage', { side: i }); log(S, evs, nm(m) + '的' + it.cure + '状态解除了', 'good'); }
    else log(S, evs, nm(m) + '没有' + it.cure + '，药剂没起作用', 'dmg');
    return;
  }
  if (it.heal) {
    log(S, evs, '你使用了「' + it.name + '」', 'fxl');
    if (!heal(S, evs, i, it.flat ? it.heal : m.maxhp * it.heal)) log(S, evs, nm(m) + '的体力已经是满的了', 'dmg');
    return;
  }
  var f = act(S, 1), p = catchChance(S, key);
  log(S, evs, '你向' + nm(f) + '投出了「' + it.name + '」……', 'fxl');
  E(S, evs, 'throw', { side: 1 });
  if (RNG() < p) {
    log(S, evs, '捕捉成功！' + nm(f) + '被收进了捕捉装置。', 'good');
    S.over = 'caught'; E(S, evs, 'over', { result: 'caught' });
  } else log(S, evs, '可惜！' + nm(f) + '挣脱了出来。', 'bad');
}

var MAX_TURNS = 60;   // 每场最多 60 回合
function timeUp(S, evs) {
  var p = aliveIdx(S, 0).length, a = aliveIdx(S, 1).length;
  if (bossOf(S)) {   // BOSS战：60 回合内没有击败BOSS，算失败
    log(S, evs, '已达到 ' + MAX_TURNS + ' 回合上限，没能在时限内击败BOSS，挑战失败', 'turn');
    S.over = 'lose'; S.timeUp = true; E(S, evs, 'over', { result: 'lose' }); return;
  }
  log(S, evs, '已达到 ' + MAX_TURNS + ' 回合上限，对战强制结束：' + (S.pvp ? S.sides[0].name + '剩 ' + p + ' 只，' + S.sides[1].name : '你剩 ' + p + ' 只，对手') + '剩 ' + a + ' 只', 'turn');
  S.over = p > a ? 'win' : p < a ? 'lose' : 'draw'; S.timeUp = true;
  E(S, evs, 'over', { result: S.over });
}
function checkOver(S, evs) {
  if (S.over) return;
  var p = aliveIdx(S, 0).length, a = aliveIdx(S, 1).length;
  if (S.training) { if (!p) { S.over = 'lose'; E(S, evs, 'over', { result: 'lose' }); } return; }
  if (!p && a && nebReviveDue(S)) return;
  if (!p && a && S.coreRevive && !S.pvp) { S.needCore = 1; S.needSwitch = false; return; }   // 2026-11-01：可以花圣晶石复活的对战（第十九段）：先停下来问玩家   // 第十九段：倒下第 2 只（或全倒）时 Cumber 会在回合结束时把大家救起来
  if (!p || !a) { S.over = !a ? 'win' : 'lose'; if (!p && !a) S.over = 'draw'; E(S, evs, 'over', { result: S.over }); }
}

function onEnter(S, evs, i, midTurn) {
  var inn = act(S, i);
  if (ability(inn) === '纯净') cleanBenchMarks(S, evs, i);
  if (ability(inn) === '踏浪') { inn.tm.prio = midTurn ? 2 : 1; log(S, evs, nm(inn) + '踏浪而来，下回合先制+1', 'fxl'); }
  if (ability(inn) === '旅行') { log(S, evs, nm(inn) + '的「旅行」发动了', 'fxl'); changeStages(S, evs, i, { spe: 1 }); }
}
function doSwitch(S, evs, i, to, midTurn) {
  var side = S.sides[i], out = act(S, i);
  if (i === 0 && midTurn && !out.fainted) CS(S).sw++;
  if (!out.fainted) { clearVolatile(out); log(S, evs, side.name + '收回了' + nm(out)); }
  side.active = to;
  var inn = act(S, i); inn.seen = true;
  if (side.soulMark) { inn.tm.soul = 1; side.soulMark = false; }
  var odoA = side.odoAlly; side.odoAlly = false;
  E(S, evs, 'switch', { side: i });
  log(S, evs, side.name + '派出了' + nm(inn) + '！');
  if (inn.tm.soul) log(S, evs, '收魂的诅咒缠上了' + nm(inn) + '，本回合受到的伤害提升', 'bad');
  if (odoA) { log(S, evs, '重构坚甲的碎片附着在' + nm(inn) + '身上', 'fxl'); changeStages(S, evs, i, { def: 1, spd: 1 }); }
  onEnter(S, evs, i, midTurn);
}
function playerReplace(S, idx) {
  var evs = []; doSwitch(S, evs, 0, idx, false); S.needSwitch = false; return evs;
}
// 联网切磋：精灵倒下后双方选好的替补，按 0 号位、1 号位的顺序上场（picks[i] 为 null 表示这一方不用换）
function pvpReplace(S, picks) {
  var evs = [];
  [0, 1].forEach(function (i) { if (picks[i] != null && S.need && S.need[i]) doSwitch(S, evs, i, picks[i], false); });
  S.need = [false, false];
  return evs;
}

function cantAct(S, evs, me) {
  for (var k in CANT_ACT) if (me.st[k] > 0) {
    if (me.boss && me.boss.chord && me.fx.chordAt !== S.turn) {
      me.fx.chordAt = S.turn; RV(me, 'chord');
      if (RNG() < 0.5) { log(S, evs, nm(me) + '的「和弦」使其恢复了本次行动', 'fxl'); return false; }
    }
    E(S, evs, 'cant', { side: S.sides[0].team.indexOf(me) >= 0 ? 0 : 1, st: k }); log(S, evs, nm(me) + CANT_ACT[k] + '！', 'bad'); return true;
  }
  return false;
}

// 心眼刀 / 至高之术化解成功：对方的技能失效后立刻结算（2026-11-02）
function parryWin(S, evs, p, k, banName) {
  var me = act(S, p), q = 1 - p, foe = act(S, q), P = S.parry && S.parry[p];
  if (k === 'parryTm') { var sh = Math.floor((me.lv || LV) * 2.5); me.fx.shield = Math.max(me.fx.shield || 0, sh); log(S, evs, nm(me) + '获得了 ' + sh + ' 点护盾', 'good'); }
  else if (!foe.fainted) { var pd = Math.floor((me.lv || LV) * 2); log(S, evs, '至高之术反击，造成 ' + pd + ' 点固定伤害', 'fxl'); applyDamage(S, evs, q, pd, p, { indirect: true }); }
  var ps = P && me.moves.filter(function (x) { return x.n === P.mv; })[0]; if (ps && ps.pp < ps.max) { ps.pp++; log(S, evs, '「' + P.mv + '」回复了 1 点 PP', 'fxl'); }
  if (ability(me) === '招架' && !foe.fainted) { foe.fx.banMv = banName; foe.tm.parryBan = 2; log(S, evs, nm(me) + '的「招架」：' + nm(foe) + '下回合不能使用「' + banName + '」', 'fxl'); }
  E(S, evs, 'stage', { side: p }); E(S, evs, 'stage', { side: q });
}
// 命运标记是双方通用的战斗标记，不属于异常状态或能力等级。
// 单独保存，切换、净化异常状态和重置能力等级都不会清掉它们。
function fateCount(m, kind) { var n = m && m.fate && m.fate[kind]; return typeof n === 'number' && isFinite(n) ? Math.max(0, Math.floor(n)) : 0; }
function fateState(m) { return { luck: fateCount(m, 'luck'), doom: fateCount(m, 'doom') }; }
function fateConvert(S, evs, i) {
  var m = act(S, i);
  while (!m.fainted && !(m.boss && m.boss.broken) && (fateCount(m, 'luck') >= 3 || fateCount(m, 'doom') >= 3)) {
    var lucky = fateCount(m, 'luck') >= 3, from = lucky ? 'luck' : 'doom', to = lucky ? 'doom' : 'luck';
    m.fate[from] -= 3; m.fate[to]++;
    E(S, evs, 'stage', { side: i });
    log(S, evs, nm(m) + (lucky ? '的3层幸运转化为1层厄运，损失1/4最大体力' : '的3层厄运转化为1层幸运，恢复1/4最大体力'), lucky ? 'bad' : 'good');
    // 转换产出的层数不再触发获得效果；仍可与已有层数合并，继续进行三层转换。
    if (lucky) loseHp(S, evs, i, Math.max(1, Math.floor(m.maxhp / 4)), '命运转换使' + nm(m) + '损失了体力', true, { percent: true });
    else heal(S, evs, i, Math.max(1, Math.floor(m.maxhp / 4)));
  }
}
function gainFate(S, evs, i, kind, n) {
  if (kind !== 'luck' && kind !== 'doom') return;
  var m = act(S, i); if (m.fainted || (m.boss && m.boss.broken)) return;
  m.fate = fateState(m);
  for (var k = 0; k < n && !m.fainted && !(m.boss && m.boss.broken); k++) {
    m.fate[kind]++;
    E(S, evs, 'stage', { side: i });
    log(S, evs, nm(m) + '获得了1层' + (kind === 'luck' ? '幸运' : '厄运') + '（幸运 ' + m.fate.luck + ' 层，厄运 ' + m.fate.doom + ' 层）', kind === 'luck' ? 'good' : 'bad');
    if (kind === 'luck') heal(S, evs, i, Math.max(1, Math.floor(m.maxhp / 8)));
    else loseHp(S, evs, i, Math.max(1, Math.floor(m.maxhp / 8)), '厄运使' + nm(m) + '损失了1/8最大体力', true, { percent: true });
    if (!m.fainted && !(m.boss && m.boss.broken)) fateConvert(S, evs, i);
  }
}
function applyFateMove(S, evs, i, mv) {
  var me = act(S, i), j = 1 - i, foe = act(S, j), c = mv.custom;
  if (me.fainted) return;
  if (c === 'fateLuck') gainFate(S, evs, i, 'luck', RNG() < 0.25 ? 2 : 1);
  if (c === 'fateDoom' && !foe.fainted) gainFate(S, evs, j, 'doom', RNG() < 0.25 ? 2 : 1);
  if (c === 'fateBurn') {
    var luck = fateCount(me, 'luck') + fateCount(foe, 'luck'), doom = fateCount(me, 'doom') + fateCount(foe, 'doom');
    me.fate = { luck: 0, doom: 0 }; foe.fate = { luck: 0, doom: 0 };
    E(S, evs, 'stage', { side: i });
    log(S, evs, '烬燃命运清除了双方的全部命运标记（幸运 ' + luck + ' 层，厄运 ' + doom + ' 层）', 'fxl');
    if (luck) changeStages(S, evs, i, { spa: luck });
    if (doom && !foe.fainted) changeStages(S, evs, j, { spd: -doom }, i);
  }
  if (c === 'fateSwap' && !foe.fainted) {
    var own = fateState(me), other = fateState(foe);
    me.fate = other; foe.fate = own;
    E(S, evs, 'stage', { side: i });
    log(S, evs, '逆转命运交换了双方的幸运与厄运层数', 'fxl');
  }
  if (c === 'fateInvert') {
    me.fate = { luck: fateCount(me, 'doom'), doom: fateCount(me, 'luck') };
    E(S, evs, 'stage', { side: i });
    log(S, evs, nm(me) + '反转了自身的幸运与厄运层数', 'fxl');
  }
}
function fateTick(S, evs) {
  if (!(S.fateTurns > 0) || S.over) return;
  var kind = RNG() < 0.5 ? 'luck' : 'doom';
  S.fateTurns--;
  log(S, evs, '无常命运降下了' + (kind === 'luck' ? '幸运' : '厄运') + '，双方获得相同的命运标记', 'fxl');
  // 同一回合只抽签一次；一方倒下也照常为另一方结算，避免先后顺序偏袒某一方。
  gainFate(S, evs, 0, kind, 1); gainFate(S, evs, 1, kind, 1);
  if (!S.fateTurns) log(S, evs, '命运领域消散了', 'fxl');
}

function rhythmStart(S, evs) {
  var owners = [0, 1].filter(function (i) { var m = act(S, i); return !m.fainted && Object.keys(RHYTHMS).some(function (k) { return m.tm[k] > 0; }); });
  owners.sort(function (a, b) { return speedOf(act(S, b)) - speedOf(act(S, a)) || a - b; });
  owners.forEach(function (i) {
    var m = act(S, i), j = 1 - i, foe = act(S, j), successes = [];
    if (m.fainted || (m.boss && m.boss.broken)) return;
    Object.keys(RHYTHMS).forEach(function (key) {
      if (!(m.tm[key] > 0)) return;
      if (--m.tm[key] <= 0) delete m.tm[key];
      if (foe.fainted || (foe.boss && foe.boss.broken) || RNG() >= 0.6) return;
      var r = RHYTHMS[key], before = foe.st[r.status] || 0;
      log(S, evs, nm(m) + '的' + r.name + '响起了', 'fxl');
      addStatus(S, evs, j, r.status, 1, i);
      // 被免疫、反弹，或未实际刷新时，不计作成功触发。
      if ((foe.st[r.status] || 0) > before) successes.push(r.status);
    });
    if (ability(m) === '终律' && successes.length >= 2 && !foe.fainted) {
      successes.forEach(function (k) { foe.st[k] = Math.max(foe.st[k] || 0, 2); });
      Object.keys(RHYTHMS).forEach(function (k) { delete m.tm[k]; });
      E(S, evs, 'stage', { side: i });
      log(S, evs, nm(m) + '的「终律」发动了！', 'fxl');
      var n = Math.floor(((m.lv || LV) + (foe.lv || LV)) / 2);
      var got = loseHp(S, evs, j, n, '终律吸取了' + nm(foe) + '的体力', true);
      if (got > 0 && !m.fainted) heal(S, evs, i, got);
    }
  });
  return owners.length > 0;
}
function applyClementMove(S, evs, i, mv) {
  var me = act(S, i), j = 1 - i, foe = act(S, j);
  if (me.fainted) return;
  if (mv.rhythm && RHYTHMS[mv.rhythm]) {
    me.tm[mv.rhythm] = 3;
    E(S, evs, 'stage', { side: i });
    log(S, evs, nm(me) + '奏起了' + RHYTHMS[mv.rhythm].name, 'fxl');
  }
  if (mv.custom === 'clementEmber') {
    var paid = loseHp(S, evs, i, Math.floor(me.hp / 5), nm(me) + '燃烧了余烬，消耗1/5当前体力', true, { cost: true });
    if (paid > 0 && !foe.fainted) applyDamage(S, evs, j, paid, i, {});
  }
  if (mv.custom === 'clementFinale' && !foe.fainted) {
    var cleared = Object.keys(foe.st).filter(function (k) { return foe.st[k] > 0 && ST_DESC[k]; });
    cleared.forEach(function (k) { delete foe.st[k]; if (k === '中毒') delete foe.fx.poison; });
    E(S, evs, 'stage', { side: j });
    if (cleared.length) {
      log(S, evs, '音焚烬灭清除了' + nm(foe) + '的异常状态', 'fxl');
      var before = foe.stages.spa;
      changeStages(S, evs, j, { spa: -cleared.length }, i);
      var stolen = Math.max(0, before - foe.stages.spa);
      if (stolen) changeStages(S, evs, i, { spa: stolen });
    }
  }
}

// PP消耗和削减共用入口：只统计实际损失，恢复PP不会抵消已经发生的损失
function missingPP(m) {
  return m.moves.reduce(function (n, sl) { return n + Math.max(0, sl.max - sl.pp); }, 0);
}
function spendPP(S, evs, i, slotIdx, n) {
  var m = act(S, i), sl = m.moves[slotIdx];
  if (!sl || (m.boss && ((m.boss.immortal && !m.boss.ppLim) || m.boss.ppInf))) return 0;
  var lost = Math.min(Math.max(0, sl.pp), n), owner = act(S, 1 - i);
  sl.pp -= lost;
  if (lost && !owner.fainted && ability(owner) === '绫彩') owner.fx.rainbowPP = (owner.fx.rainbowPP || 0) + lost;
  return lost;
}
function applyBaliMove(S, evs, i, mv) {
  var me = act(S, i), j = 1 - i, foe = act(S, j);
  if (me.fainted || foe.fainted) return;
  if (mv.custom === 'baliBeam') {
    var slots = foe.moves.map(function (sl, k) { return sl.pp > 0 ? k : -1; }).filter(function (k) { return k >= 0; });
    if (slots.length) {
      var k = slots[rint(0, slots.length - 1)], lost = spendPP(S, evs, j, k, 2);
      E(S, evs, 'stage', { side: j });
      log(S, evs, lost ? nm(foe) + '的「' + foe.moves[k].n + '」损失了' + lost + '点PP' : nm(foe) + '的技能PP没有减少', 'fxl');
    }
  }
  if (mv.custom === 'baliAbsorb' && RNG() < 0.5) {
    var key = ['atk', 'def', 'spa', 'spd', 'spe'][rint(0, 4)], down = {}, up = {}, before = foe.stages[key];
    down[key] = -1; changeStages(S, evs, j, down, i);
    var stolen = Math.max(0, before - foe.stages[key]);
    if (stolen) { up[key] = stolen; changeStages(S, evs, i, up); }
  }
}
function cleanBenchMarks(S, evs, i) {
  S.sides[i].team.forEach(function (m, k) {
    if (k === S.sides[i].active || m.fainted) return;
    var removed = 0;
    ['melt', 'wither', 'miasma', 'odoMark', 'odoJam'].forEach(function (key) {
      var n = key === 'wither' ? witherN(m) : (m.perm[key] || 0);
      if (n > 0) { m.perm[key] = n - 1; if (!m.perm[key]) delete m.perm[key]; removed++; }
    });
    if (m.fate && m.fate.doom > 0) { m.fate.doom--; removed++; }
    if (removed) { E(S, evs, 'stage', { side: i }); log(S, evs, '纯净净化了' + nm(m) + '的负面印记（共' + removed + '层）', 'fxl'); }
  });
}
function gainPureShield(S, evs, i) {
  var m = act(S, i); m.fx.shield = (m.fx.shield || 0) + 50; m.fx.pureShieldAt = S.turn;
  E(S, evs, 'stage', { side: i }); log(S, evs, nm(m) + '的纯净护盾增加了50点护盾', 'fxl');
}
function barlowStart(S, evs) {
  [0, 1].forEach(function (i) { var m = act(S, i); if (!m.fainted && !(m.boss && m.boss.broken) && m.tm.pureShield > 0 && m.fx.pureShieldAt !== S.turn) gainPureShield(S, evs, i); });
}
function applyBarlowMove(S, evs, i, mv) {
  var m = act(S, i); if (m.fainted) return;
  if (mv.custom === 'barlowPurify') { var removed = clearUps(S, evs, 1 - i); if (removed) heal(S, evs, i, removed * 50); }
  if (m.fx.originHits > 0) { m.fx.originHits--; heal(S, evs, i, m.maxhp / 5); E(S, evs, 'stage', { side: i }); }
}
// 莫格伦：连击逐击记录；每一击及其附加固伤共享一次减伤与计数。
function glenDefense(m) { return Math.floor(m.stats.def * stageMult(m.stages.def) * miaDef(m)) + Math.floor(m.stats.spd * stageMult(m.stages.spd) * miaDef(m)); }
function glenAttackStart(S, i, mv) {
  delete S.glenAttack;
  var j = 1 - i, m = act(S, j);
  if (m.fx.highlandHits > 0 || ability(m) === '孤傲') S.glenAttack = { from: i, side: j, slot: S.sides[j].active, cat: mv.cat, hit: false, scale: 1 };
}
function glenAttackDamage(S, evs, j, amount, src) {
  var a = S.glenAttack, m = act(S, j);
  if (!a || a.side !== j || a.slot !== S.sides[j].active || a.from !== src || amount <= 0) return amount;
  if (!a.hit) {
    a.hit = true;
    if (m.fx.highlandHits > 0) { m.fx.highlandHits--; a.scale = .65; log(S, evs, nm(m) + '的高地之王减免35%攻击伤害（剩' + m.fx.highlandHits + '次）', 'fxl'); E(S, evs, 'stage', { side: j }); }
  }
  return amount * a.scale;
}
function glenAttackEnd(S, evs) {
  var a = S.glenAttack; if (!a || !a.hit || a.counted || a.slot !== S.sides[a.side].active) return;
  a.counted = true;
  var m = act(S, a.side); if (m.fainted || m.hp <= 0 || ability(m) !== '孤傲') return;
  var tally = m.fx.glenHits || (m.fx.glenHits = { phys: 0, spec: 0 });
  tally[a.cat === '物攻' ? 'phys' : 'spec']++;
  if (tally.phys + tally.spec >= 3) {
    var stage = tally.phys > tally.spec ? { def: 1 } : { spd: 1 };
    delete m.fx.glenHits; log(S, evs, nm(m) + '的「孤傲」发动了！', 'fxl'); changeStages(S, evs, a.side, stage);
  }
  E(S, evs, 'stage', { side: a.side });
}
// total is the refreshed three-turn budget; subtract only damage already settled.
function glenFracturePool(f) { return f ? f.total - Math.floor(f.total * f.elapsed / 3) : 0; }
function applyGlenMove(S, evs, i, mv) {
  var me = act(S, i), j = 1 - i, foe = act(S, j);
  if (mv.custom === 'glenHeal') heal(S, evs, i, glenDefense(me) * .1);
  if (foe.fainted || foe.hp <= 0) return;
  if (mv.custom === 'glenStone') { foe.fx.stoneMark = true; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '被附加了破石印记', 'bad'); }
  if (mv.custom === 'glenFracture') {
    var damage = Math.floor(glenDefense(me) * .15), old = foe.fx.fracture;
    foe.fx.fracture = { total: glenFracturePool(old) + damage, elapsed: 0 };
    E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '陷入碎震，接下来3回合末持续受到固定伤害', 'bad');
  }
}
function glenTick(S, evs) {
  [0, 1].forEach(function (i) {
    var m = act(S, i), f = m.fx.fracture; if (m.fainted || !f || S.over) return;
    var damage = Math.floor(f.total * (f.elapsed + 1) / 3) - Math.floor(f.total * f.elapsed / 3); f.elapsed++;
    if (f.elapsed >= 3) delete m.fx.fracture;
    log(S, evs, nm(m) + '受到碎震的持续打击', 'fxl'); S.dotSrc = '碎震'; applyDamage(S, evs, i, damage, null, { indirect: true }); S.dotSrc = null;
  });
}
function useMoveCore(S, evs, i, mv, slotIdx, extra, splitToken) {
  var prev = S.glenAttack; delete S.glenAttack;
  try { return useMoveCore0(S, evs, i, mv, slotIdx, extra, splitToken); }
  finally { glenAttackEnd(S, evs); if (prev) S.glenAttack = prev; else delete S.glenAttack; }
}
function useMove(S, evs, i, mv, slotIdx, extra) {
  var me = act(S, i), split = !extra && me.fx.prismAttacks > 0 && liveMove(me, mv).cat !== '变化';
  if (!split) return useMoveCore(S, evs, i, mv, slotIdx, extra);
  var half = Object.assign({}, liveMove(me, mv), { prismHalf: true }), token = { armed: false };
  useMoveCore(S, evs, i, half, slotIdx, false, token);
  if (token.armed && !S.over && !me.fainted && !act(S, 1 - i).fainted) useMoveCore(S, evs, i, half, -1, true);
}
function useMoveCore0(S, evs, i, mv, slotIdx, extra, splitToken) {
  if (!extra) RV(act(S, i), 'mute');
  var me = act(S, i), j = 1 - i, foe = act(S, j);
  mv = liveMove(me, mv);
  if (me.fainted || (me.boss && me.boss.broken)) return;
  if (!extra && cantAct(S, evs, me)) return;
  if (!extra && !mv.struggle && slotIdx >= 0 && me.moves[slotIdx] && me.moves[slotIdx].pp <= 0 && !(me.boss && ((me.boss.immortal && !me.boss.ppLim) || me.boss.ppInf))) {
    log(S, evs, nm(me) + '的「' + mv.name + '」PP已耗尽，无法使用', 'bad'); return;
  }
  if (slotIdx >= 0 && moveBlocked(me, me.moves[slotIdx])) { log(S, evs, (me.tm && me.tm.parryBan === 1 && me.fx.banMv === mv.name ? nm(me) + '的「' + mv.name + '」刚被招架过，这回合无法使用' : me.tm && me.tm.noStat === 1 && mv.cat === '变化' ? nm(me) + '被压制弧光压制，无法使用「' + mv.name + '」' : me.enNS && mv.cat === '变化' ? '对方的「禁止变化」生效中，' + nm(me) + '无法使用「' + mv.name + '」' : (me.flags && me.flags.sy && mv.cat === '变化' ? '沈阳大街上不讲究这些花架子，' + nm(me) + '无法使用「' : nm(me) + '处于光影之月，无法使用「') + mv.name + '」'), 'bad'); return; }
  if (!mv.struggle && slotIdx >= 0 && !(me.boss && ((me.boss.immortal && !me.boss.ppLim) || me.boss.ppInf))) spendPP(S, evs, i, slotIdx, 1);
  if (me.boss && me.boss.healCd && mv.heal && !extra) S.bossHealAt = S.turn;   // 回血技能的冷却（见 ai.js 的 aiChoose）
  // ppLim：先驱之塔的死神虽有「不朽」，PP 也有限   // 「不朽」：PP 无限
  if (S.silenced[i] && !extra) { log(S, evs, nm(me) + '的「' + mv.name + '」被黑暗吞没，失效了！', 'bad'); return; }
  var firstMover = !S.turnActed[j];
  if (foe.boss && foe.boss.odoRate && firstMover) foe.fx.lateNow = 1;   // 歼灭速率：被对方抢先出手，这回合受伤 +25%
  var mt = mvType(me, mv);
  S.curMove = i === 0 ? mv.name : null;
  E(S, evs, 'use', { side: i, move: mv.name, type: mt });
  S.hqMv = mv.name; if (!extra) hqUse(me, mv.name);
  log(S, evs, nm(me) + (extra ? '额外发动了「' : '使用了「') + mv.name + '」！', 'use');
  var PR = !extra && S.parry && S.parry[j];   // 对方这回合在招架：至高之术化解主动攻击，心眼刀化解回合类效果（变化技能里写着「N回合」的）
  if (PR && !PR.ok && !act(S, j).fainted && ((PR.k === 'parryAtk' && mv.cat !== '变化') || (PR.k === 'parryTm' && mv.cat === '变化' && /\d+\s*回合/.test(mv.d || '')))) {
    PR.ok = 1; log(S, evs, nm(act(S, j)) + '看穿了「' + mv.name + '」，将它化解了！', 'crit'); me.fx.boostNext = 0; parryWin(S, evs, j, PR.k, mv.name); return;
  }
  if (!extra && me.perm.moonFull && slotIdx >= 0) {
    var got = 0; me.moves.forEach(function (sl, k) { if (k !== slotIdx && sl.pp < sl.max) { sl.pp++; got++; } });
    if (got) log(S, evs, '光影之月：其余技能各恢复1点PP', 'fxl');
    if (me.hp < me.maxhp) { log(S, evs, '光影之月：使用技能恢复 1/6 最大体力', 'fxl'); heal(S, evs, i, me.maxhp / 6); }
  }
  if (ability(me) === '孢子' && mv.name.indexOf('孢子') >= 0) heal(S, evs, i, me.maxhp / 10);
  me.fx.starNow = 0; me.fx.canyueNow = 0;
  if (mv.custom === 'starMagic') { me.perm.star = (me.perm.star || 0) + 1; me.fx.starNow = 1; }
  if (mv.custom === 'canyue') { me.flags.canyue = (me.flags.canyue || 0) + 1; me.fx.canyueNow = 1; E(S, evs, 'stage', { side: i }); }   // 和星星魔法一样：使用就计数（打空也算）
  if (ability(me) === '雷明' && !extra) { var lmt = mvType(me, mv); if (lmt === '电') me.tm.lmE = 3; else if (lmt === '光') me.tm.lmL = 3; }   // 特性「雷明」（2026-10-22）：用了技能就算，3 回合内每回合末生效，重复使用只刷新回合数
  if (mv.cat !== '变化') { if (extra) me.fx.chargeNow = 0; else { me.fx.chargeNow = me.fx.charge || 0; me.fx.charge = 0; me.fx.atkT = S.turn; } }   // 特性「爆燃」：主动攻击时把蓄力全部用掉
  if (mv.cat === '变化') { doStatus(S, evs, i, mv); return; }
  if (!extra && me.st['混乱'] > 0 && RNG() < 0.4) {   // 混乱（2026-11-01，玫瑰星云的「尘埃柱」）：攻击时 40% 打到自己（威力 40 的无属性物理攻击）
    var cA = me.stats.atk * stageMult(me.stages.atk), cD = me.stats.def * stageMult(me.stages.def);
    var cd = Math.floor(Math.floor(Math.floor(2 * (me.lv || LV) / 5 + 2) * 40 * cA / cD) / 50) + 2;
    loseHp(S, evs, i, cd, nm(me) + '陷入混乱，攻击了自己！（' + cd + '）'); me.fx.boostNext = 0; return;
  }

  if (foe.fainted) { log(S, evs, '但是没有目标'); return; }
  if (foe.boss && foe.boss.broken) { log(S, evs, nm(foe) + '的这管体力已经被击破，攻击没有效果', 'fxl'); me.fx.boostNext = 0; return; }
  if (splitToken) { splitToken.armed = true; me.fx.prismAttacks--; E(S, evs, 'stage', { side: i }); }
  if (hitBlocked(foe, mt)) { log(S, evs, nm(foe) + '毫发无伤！只有' + foe.onlyHit.join('、') + '系技能才能命中它', 'bad'); me.fx.boostNext = 0; return; }
  if (foe.boss && ((foe.boss.noPhys && mv.cat === '物攻') || (foe.boss.noSpec && mv.cat === '特攻'))) { RV(foe, mv.cat === '物攻' ? 'noPhys' : 'noSpec'); log(S, evs, nm(foe) + '免疫' + (mv.cat === '物攻' ? '物理' : '特殊') + '攻击，毫发无伤！', 'bad'); me.fx.boostNext = 0; return; }   // 无尽作战
  if (i === 1 && S.en && S.en.ghostT === S.turn && !act(S, 0).fainted) { log(S, evs, '幽灵形态：' + nm(foe) + '化作虚影，闪开了攻击！', 'fxl'); me.fx.boostNext = 0; return; }
  if (mv.custom === 'clementFinale' && !hasStatus(foe)) { E(S, evs, 'miss', { side: j }); log(S, evs, '对方没有异常状态，音焚烬灭未能命中'); me.fx.boostNext = 0; return; }
  if (mv.custom === 'poisonHeart' && !(foe.st['中毒'] > 0)) { E(S, evs, 'miss', { side: j }); log(S, evs, '但是没有命中！（渗透孢子只能命中中毒的敌人）'); me.fx.boostNext = 0; return; }
  var sure = me.fx.sureHit; if (sure) me.fx.sureHit = 0;
  if (me.tm.sure3 > 0 || me.tm.ear > 0) sure = 1;
  var unstop = !!(me.boss && me.boss.sure);   // 剧情限定（2026-10-31）：技能必中，也不会被闪开
  if (unstop) sure = 1;
  if (!sure && me.st['失明'] > 0 && RNG() < 0.5) { E(S, evs, 'miss', { side: j }); log(S, evs, nm(me) + '看不清目标，攻击落空了！'); me.fx.boostNext = 0; return; }
  if (!sure && RNG() >= hitChance(me, foe, mv)) { E(S, evs, 'miss', { side: j }); log(S, evs, '但是没有命中！'); me.fx.boostNext = 0; return; }
  if (!unstop && foe.fx.cave === S.turn) { foe.fx.x2Next = 1; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '躲进岩洞，规避了这次攻击！下一次直接攻击伤害翻倍', 'fxl'); me.fx.boostNext = 0; return; }   // 岩洞藏匿：只管这一回合
  if (!unstop && foe.fx.absDef) { foe.fx.absDef = 0; log(S, evs, nm(foe) + '闪开了这次攻击！', 'fxl'); me.fx.boostNext = 0; return; }
  if (!unstop && foe.tm.dodge > 0 && RNG() < 0.4) { log(S, evs, nm(foe) + '用光滑皮肤闪开了攻击！', 'fxl'); me.fx.boostNext = 0; return; }
  if (!unstop && mv.cat === '物攻' && foe.tm.voidPhys > 0) { log(S, evs, nm(foe) + '处于虚空化，物理攻击穿过了它的身体！', 'fxl'); me.fx.boostNext = 0; return; }

  if (mv.bomb) {   // 爆燃炸弹 / 火灵炸弹：先埋下，下回合结束时在 endOfTurn 里爆炸（按爆炸时的对手算伤害，扔炸弹的倒下了也照样炸）
    if (!S.bombs) S.bombs = [];
    S.bombs.push({ from: i, mon: me, mv: mv, at: S.turn + 1 });
    log(S, evs, nm(me) + '在' + nm(foe) + '脚下埋了一颗炸弹！下回合结束时会爆炸', 'fxl');
    me.flags.firstAtk = true; me.fx.boostNext = 0; return;
  }
  if (mv.custom === 'oStar') {   // O型星超温辐射（玫瑰星云第三管体力）：同时伤害对方背包里所有精灵（不在场的直接扣体力）
    S.sides[j].team.forEach(function (x, k) {
      if (k === S.sides[j].active || x.fainted) return;
      var od = Math.floor(calcDamage(me, x, mv, firstMover, true).dmg * (x.cbl ? 1 - 0.25 * x.cbl : 1)); od = Math.min(x.hp, Math.max(1, od)); x.hp -= od;
      log(S, evs, '超温辐射波及了背包里的' + nm(x) + '（-' + od + '）', 'fxl');
      if (x.hp <= 0) { x.hp = 0; x.fainted = true; log(S, evs, nm(x) + '倒下了！', 'bad'); }
    });
    E(S, evs, 'stage', { side: j });
  }
  glenAttackStart(S, i, mv);
  var total = 0, shownT = 0, lastEff = 1, n = 0, hits = 1, raw = 0, burnX = 0, pBoost = 1;
  var glenFixedPerHit = !!S.glenAttack && !!mv.fixedHit;
  if (mv.custom === 'swiftPierce' && firstMover && foe.stages.def > 0 && !stageBlocked(S, evs)) { var dcl = foe.stages.def; foe.stages.def = 0; pBoost = 1 + 0.75 * dcl; E(S, evs, 'stage', { side: j }); log(S, evs, '迅捷刺击清空了' + nm(foe) + '的 ' + dcl + ' 级物防强化，这次伤害 +' + Math.round(75 * dcl) + '%', 'fxl'); }
  function dmgAdd(v) { total += v; shownT += S.lastShown != null ? S.lastShown : v; S.lastShown = null; }
  if (mv.fixedOnly) {
    var fa = fixedAmount(me, foe, mv);
    log(S, evs, '造成 ' + fa + ' 点固定伤害', 'fxl');
    S.lastShown = null; dmgAdd(applyDamage(S, evs, j, fa, i, { noFaint: true }));
  } else {
    if (mv.hits) {
      if (mv.custom === 'fireHits' && foe.st['烧伤'] > 0) hits = 9;
      else if (mv.custom === 'riceHits') hits = Math.min(15, rint(mv.hits[0], mv.hits[1]) + (me.perm.rice || 0));   // 非凡连击：每吃过一口米饭 +1 次
      else if (mv.hits[0] === 2 && mv.hits[1] === 5) { var r = RNG(); hits = r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5; }
      else hits = rint(mv.hits[0], mv.hits[1]);
      if (me.insFx && me.insFx.fire && RNG() < 0.15) { hits++; log(S, evs, nm(me) + '的刻印「不息之火」：连击数 +1', 'fxl'); }   // 2026-11-01
    }
    for (var h = 0; h < hits && foe.hp > 0; h++) {
      glenAttackStart(S, i, mv);
      var res = calcDamage(me, foe, mv, firstMover, false);
      if (pBoost !== 1) res.dmg = Math.floor(res.dmg * pBoost);
      if (foe.boss && foe.boss.noNormal) { if (!h) { RV(foe, 'noNormal'); log(S, evs, nm(foe) + '免疫常规伤害！只有固定伤害和异常状态能伤到它', 'bad'); } res.dmg = 0; res.crit = false; }
      lastEff = res.eff; n++; raw += res.dmg;
      if (mv.custom === 'burnExtend' && foe.st['烧伤'] > 0 && foe.hp > res.dmg) { foe.st['烧伤']++; burnX = (burnX || 0) + 1; }   // 烈焰风暴：每次命中延长 1 回合烧伤
      if (res.crit) log(S, evs, '致命一击！', 'crit');
      if (res.petri) log(S, evs, '石化中被暴击，伤害翻倍！', 'crit');
      if (me.boss && me.boss.kill) res.dmg = Math.max(res.dmg, foe.hp * 20 + 99999);   // 剧情限定（2026-10-31 第十六段最后那只奥多亚克）：打中必定秒杀，不显示
      S.lastShown = null; dmgAdd(applyDamage(S, evs, j, res.dmg, i, { crit: res.crit, eff: res.eff, noFaint: true }));
      if (glenFixedPerHit && foe.hp > 0 && !me.fainted) {
        log(S, evs, '本次命中附加 ' + mv.fixedHit + ' 点固定伤害', 'fxl');
        S.lastShown = null; dmgAdd(applyDamage(S, evs, j, mv.fixedHit, i, { noFaint: true }));
      }
      if (me.boss && me.boss.kill && foe.hp > 0) foe.hp = 0;
      if (res.petri) petriBreak(S, evs, j);
      if (res.crit && foe.hp > 0 && !foe.fainted) changeStages(S, evs, j, mv.cat === '物攻' ? { def: -1 } : { spd: -1 }, i);   // 2026-10-20：暴击降低对应防御 1 级
      glenAttackEnd(S, evs);
      if (me.fainted) break;
    }
    if (mv.mercy && foe.hp <= 0 && !foe.fainted) { foe.hp = 1; if (S.worldBoss && j === 1) S.worldBoss.damage = Math.max(0, S.worldBoss.damage - 1); total = Math.max(0, total - 1); shownT = total; log(S, evs, nm(me) + '手下留情，' + nm(foe) + '还剩 1 点体力', 'fxl'); E(S, evs, 'stage', { side: j }); }   // 慈悲气波：不会把对方打倒
    if (lastEff > 1) { log(S, evs, '效果拔群！', 'good'); if (!S.se) S.se = [0, 0]; S.se[i]++; } else if (lastEff < 1) log(S, evs, '效果不太好……');   // S.se：双方打出效果拔群的次数（星球挑战的星级用）
    // 每次攻击附带的固定伤害（飞空连击、非凡连击）：按命中次数合起来结算一次，免得十几次连击动画太长
    if (mv.fixedHit && !glenFixedPerHit && n && foe.hp > 0 && !me.fainted) { log(S, evs, '每次攻击附带 ' + mv.fixedHit + ' 点固定伤害，共 ' + (mv.fixedHit * n) + ' 点', 'fxl'); S.lastShown = null; dmgAdd(applyDamage(S, evs, j, mv.fixedHit * n, i, { noFaint: true })); }
  }
  log(S, evs, '对' + nm(foe) + '造成 ' + shownT + ' 点伤害', 'dmg');
  if (foe.hp <= 0 && !foe.fainted) faint(S, evs, j);
  if (hits > 1) log(S, evs, '连续命中 ' + n + ' 次！');
  if (burnX && !foe.fainted) { E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '的烧伤延长了 ' + burnX + ' 回合（剩 ' + foe.st['烧伤'] + ' 回合）', 'fxl'); }
  // 月蚀的强化攻击（转换属性后的下一次攻击）命中后，恢复 1/6 最大体力
  if (me.fx.moonNext && ability(me) === '月蚀' && !me.fainted && me.hp < me.maxhp) { log(S, evs, nm(me) + '的「月蚀」：强化攻击命中，恢复 1/6 最大体力', 'fxl'); heal(S, evs, i, me.maxhp / 6); }
  me.flags.firstAtk = true; me.fx.boostNext = 0; me.fx.moonNext = 0; if (me.fx.x2Next) { me.fx.x2Next = 0; E(S, evs, 'stage', { side: i }); }
  var fxd = addFixed(me, mv);
  var spP = (ability(me) === '疾驰' && mv.cat !== '变化' ? 0.1 : 0) + (mv.custom === 'spdFix30' ? 0.3 : 0);   // 2026-11-02：特性「疾驰」10%、翔月极闪 30% 的速度差固伤
  if (spP && n > 0 && !foe.fainted && foe.hp > 0) { var spd0 = Math.floor(Math.abs(speedOf(me) - speedOf(foe)) * spP); if (spd0 > 0) { log(S, evs, (mv.custom === 'spdFix30' ? '翔月极闪' : nm(me) + '的「疾驰」') + '附加 ' + spd0 + ' 点固定伤害（速度差）', 'fxl'); applyDamage(S, evs, j, spd0, i, {}); } }
  if (fxd && !foe.fainted) { log(S, evs, '附加 ' + fxd + ' 点固定伤害', 'fxl'); applyDamage(S, evs, j, fxd, i, {}); }
  if (mv.foeNoHeal && !foe.fainted && total > 0) { foe.tm.noHeal = Math.max(foe.tm.noHeal || 0, mv.foeNoHeal); E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '被淬命之焰灼伤，' + mv.foeNoHeal + '回合内无法恢复体力', 'bad'); }
  if (mv.custom === 'drown' && !foe.fainted) {   // 溺毙：对方每下降 1 级能力，附加 30 点固定伤害（2026-10-19：按等级算，不再按项数）
    var dn = STG.reduce(function (n, k) { return n + Math.max(0, -foe.stages[k]); }, 0);
    if (dn) { log(S, evs, '对方共下降了 ' + dn + ' 级能力，溺毙附加 ' + (30 * dn) + ' 点固定伤害', 'fxl'); applyDamage(S, evs, j, 30 * dn, i, {}); }
  }
  if (mv.custom === 'zeroBreak' && !foe.fainted && foe.st['冰冻'] > 0) { var zb = Math.floor(foe.maxhp / 8); log(S, evs, '冰破附带 ' + zb + ' 点固定伤害', 'fxl'); applyDamage(S, evs, j, zb, i, { percent: true }); }
  if (mv.custom === 'annihilate' && !foe.fainted) {
    var pk = Math.min(0.6, 0.05 + 0.1 * negCount(foe));
    if (RNG() < pk) {
      log(S, evs, '灭却！' + nm(foe) + '被一击抹杀！', 'crit'); applyDamage(S, evs, j, foe.hp + (foe.fx.shield || 0), i, {});
      // 秒杀成功：灭却的 PP 全部恢复
      if (foe.fainted && slotIdx >= 0 && me.moves[slotIdx] && me.moves[slotIdx].pp < me.moves[slotIdx].max) { me.moves[slotIdx].pp = me.moves[slotIdx].max; log(S, evs, '灭却的 PP 全部恢复了！', 'fxl'); }
    }
    else log(S, evs, '灭却没有发动（成功率 ' + Math.round(pk * 100) + '%）');
  }
  if (mv.custom === 'annihilateSure' && !foe.fainted) { log(S, evs, '瘴毒灭却！' + nm(foe) + '被一击吞噬！', 'crit'); applyDamage(S, evs, j, foe.hp + (foe.fx.shield || 0), i, {}); }
  // 盛宴：吃掉（击败）对方时，恢复本技能全部 PP；体力上限 +50 并回复 50 体力（本场战斗内可以无限叠加）
  if (mv.custom === 'feast' && foe.fainted) {
    if (slotIdx >= 0 && me.moves[slotIdx] && me.moves[slotIdx].pp < me.moves[slotIdx].max) { me.moves[slotIdx].pp = me.moves[slotIdx].max; log(S, evs, nm(me) + '饱餐了一顿，盛宴的 PP 全部恢复了！', 'fxl'); }
    if (!me.fainted) { me.maxhp += 50; log(S, evs, nm(me) + '吃饱了，体力上限 +50（现在是 ' + me.maxhp + '）', 'fxl'); heal(S, evs, i, 50); }
  }
  if (mv.custom === 'originBlade' && !foe.fainted && foe.stages.spe <= -6) { log(S, evs, '起源巨刃斩断了速度降到最低的敌人！', 'crit'); applyDamage(S, evs, j, foe.hp + (foe.fx.shield || 0), i, {}); }
  if (mv.custom === 'starMagic' && total > 0 && !foe.fainted && 25 * (me.perm.star || 0) >= STAR_MAX && RNG() < 0.5) { log(S, evs, '星光缠住了' + nm(foe) + '的脚步', 'fxl'); changeStages(S, evs, j, { spe: -1 }, i); }   // 达到最高威力后：50% 降速
  if (total > 0) {
    hqLand(me, foe, mv.name, i);
    if (foe.fx.earMark) foe.fx.earMark = 0;
    if (foe.fx.flash && !foe.fainted) { foe.fx.flash = 0; log(S, evs, '闪光飞叶的光芒刺痛了' + nm(foe) + '的眼睛', 'fxl'); changeStages(S, evs, j, { acc: -1 }, i); }
  }
  // 受击方的反击类效果
  if (total > 0 && !me.fainted && !foe.fainted && foe.boss && foe.boss.relive && RNG() < 0.5) { RV(foe, 'relive');   // 复活后的泰戈尔「往日重现」
    var rk = ['烧伤', '冻伤', '中毒'][rint(0, 2)];
    log(S, evs, nm(foe) + '的「往日重现」：东北街头的记忆涌了上来！', 'fxl');
    addStatus(S, evs, i, rk, rint(1, 3), j);
  }
  if (total > 0 && !me.fainted) {
    if (ability(foe) === '感电' && mv.cat === '物攻') loseHp(S, evs, i, Math.max(1, Math.floor(total * 0.15)), nm(foe) + '的「感电」反弹了部分伤害');
    if (foe.tm.recoil > 0 && !me.fainted) loseHp(S, evs, i, 75, nm(foe) + '的磁暴反冲造成了 75 点反弹伤害');
    if (foe.tm.retal > 0 && !foe.fainted && !me.fainted) { log(S, evs, nm(foe) + '的寂灭幽映发动了', 'fxl'); changeStages(S, evs, i, { atk: -1, spa: -1, acc: -1 }, j); }
  }
  if (mv.fixedOnly === 'selfBlast' && !me.fainted) { log(S, evs, nm(me) + '舍身爆破，牺牲了自己'); me.hp = 0; faint(S, evs, i); }
  if (me.fainted) return;
  if (mv.drain && total > 0) { var dh = heal(S, evs, i, total * mv.drain); hqR(me).h[mv.name] = (hqR(me).h[mv.name] || 0) + dh; }
  if (mv.struggle && total > 0) loseHp(S, evs, i, Math.max(1, Math.floor(total / 4)), nm(me) + '受到了反作用伤害');
  if (me.boss && me.boss.odoRate && firstMover && total > 0 && !foe.fainted && foe.hp > 0) { RV(me, 'odoRate'); log(S, evs, nm(me) + '的「歼灭速率」：抢先出手，追加 ' + Math.floor(foe.maxhp / 4) + ' 点固定伤害', 'fxl'); applyDamage(S, evs, j, Math.floor(foe.maxhp / 4), i, { percent: true }); if (foe.hp <= 0 && !foe.fainted) faint(S, evs, j); }
  if (mv.selfTiredHit && !me.fainted && me.boss && (me.boss.immortal || me.boss.noStatus)) { RV(me, 'immortal'); RV(me, 'noStatus'); log(S, evs, nm(me) + '免疫异常状态，没有陷入「疲惫」', 'fxl'); }   // 不朽 / 免疫异常：自己技能带来的疲惫也免疫
  else if (mv.selfTiredHit && !me.fainted) { me.st['疲惫'] = mv.selfTiredHit + 1; E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '耗尽了力气，陷入「疲惫」状态（' + mv.selfTiredHit + '回合）', 'bad'); }   // 全弹发射
  if (mv.recoil && total > 0 && !me.fainted) loseHp(S, evs, i, Math.max(1, Math.floor(total * mv.recoil)), nm(me) + '受到了反弹伤害');   // 烈焰冲锋
  if (total > 0 && me.tm.induct > 0) { log(S, evs, '电磁感应生效', 'fxl'); changeStages(S, evs, i, { spa: 1 }); }
  applyFateMove(S, evs, i, mv);
  applyClementMove(S, evs, i, mv);
  applyBaliMove(S, evs, i, mv);
  applyBarlowMove(S, evs, i, mv);
  applyGlenMove(S, evs, i, mv);
  me.fx.hqRaw = raw;   // 这一招算出来的伤害（不按对方剩余体力截断），隐藏技能「淬命之焰」的领悟条件用
  if (foe.fainted) {
    if (i === 0) hqKO(S, evs, me, foe, mv);
    if (mv.koHeal) heal(S, evs, i, me.maxhp * mv.koHeal);
    moonStack(S, evs, i, '击败敌人');
    if (ability(me) === '收魂' && aliveIdx(S, j).length) { S.sides[j].soulMark = true; log(S, evs, nm(me) + '的「收魂」发动了，对方下一只精灵会更脆弱', 'fxl'); }
  } else {
    if (mv.tgtStage && RNG() < (mv.tgtChance || 1)) changeStages(S, evs, j, mv.tgtStage, i);
    if (mv.status && statusRoll(me, mv.status.chance)) addStatus(S, evs, j, mv.status.k, rint(mv.status.min, mv.status.max), i, false, mv.status.refresh);
    if (mv.clearTgtUp && RNG() < (mv.clearTgtChance || 1)) clearUps(S, evs, j);
    switch (mv.custom) {
      case 'brand':
        // 叠满 2 层必定麻痹 2 回合；之后对方进入烙印冷却（麻痹期间 + 解除后 1 回合），这段时间叠不上烙印
        if (foe.tm.brandCd > 0) { log(S, evs, nm(foe) + '处于烙印冷却中，闪电烙印没能叠上'); break; }
        foe.fx.brand = (foe.fx.brand || 0) + 1;
        log(S, evs, nm(foe) + '身上的闪电烙印：' + foe.fx.brand + ' / 2', 'fxl');
        if (foe.fx.brand >= 2) { foe.fx.brand = 0; addStatus(S, evs, j, '麻痹', 2, i); foe.tm.brandCd = (foe.st['麻痹'] || 0) + 1; E(S, evs, 'stage', { side: j }); }
        E(S, evs, 'stage', { side: j }); break;
      case 'odoShield': me.fx.shield = (me.fx.shield || 0) + 50; E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '获得了 50 点护盾', 'fxl'); break;
      case 'odoScan': changeStages(S, evs, i, { acc: 1 }); break;
      case 'odoMark': if ((foe.perm.odoMark || 0) < 5) { foe.perm.odoMark = (foe.perm.odoMark || 0) + 1; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '被解析了：受到的伤害永久提升 ' + foe.perm.odoMark * 10 + '%', 'fxl'); } break;
      case 'odoJam': if ((foe.perm.odoJam || 0) < 5) { foe.perm.odoJam = (foe.perm.odoJam || 0) + 1; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '受到侵扰：造成的伤害永久降低 ' + foe.perm.odoJam * 8 + '%', 'fxl'); } break;
      case 'etch':   // 光辉蚀迹：和闪电烙印一样叠 2 层，叠满必定失明 2 回合；失明期间叠不上
        if (foe.tm.etchCd > 0 || foe.st['失明'] > 0) { log(S, evs, nm(foe) + '处于蚀迹冷却中，光辉蚀迹没能叠上'); break; }
        foe.fx.etch = (foe.fx.etch || 0) + 1;
        log(S, evs, nm(foe) + '身上的光辉蚀迹：' + foe.fx.etch + ' / 2', 'fxl');
        if (foe.fx.etch >= 2) { foe.fx.etch = 0; addStatus(S, evs, j, '失明', 2, i); foe.tm.etchCd = foe.st['失明'] || 0; }
        E(S, evs, 'stage', { side: j }); break;
      case 'copyStages':   // 联觉光晕：把对方的能力等级（上升和下降）复制到自己身上
        if (stageBlocked(S, evs)) break;
        STG.forEach(function (k) { me.stages[k] = foe.stages[k] || 0; }); E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '复制了' + nm(foe) + '的能力等级', 'fxl'); break;
      case 'clearSelfDmg':   // 断觉霆闪：清空自己的能力等级，每清空 1 级附加 50 固定伤害
        if (stageBlocked(S, evs)) break;
        var cl = 0; STG.forEach(function (k) { cl += Math.abs(me.stages[k] || 0); me.stages[k] = 0; });
        E(S, evs, 'stage', { side: i });
        if (cl) { log(S, evs, nm(me) + '清空了 ' + cl + ' 级能力变化，附加 ' + (cl * 50) + ' 点固定伤害', 'fxl'); applyDamage(S, evs, j, cl * 50, i, {}); }
        break;
      case 'flashLeaf': foe.fx.flash = 1; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '被闪光飞叶的光芒笼罩：下一次受到攻击时会额外降低1级命中', 'fxl'); break;
      case 'vuln': foe.tm.vuln = 3; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '被恶魔触手缠住，3回合内受到的伤害增加30%', 'bad'); break;
      case 'weak3': foe.tm.weak = 3; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '的力量被荒芜侵蚀，3回合内伤害降低30%', 'bad'); break;
      case 'blastSlash': if (firstMover && statusRoll(me, 0.5)) addStatus(S, evs, j, '烧伤', rint(2, 5), i); break;
      case 'randStatus': if (statusRoll(me, 0.5)) { var rk = RAND_ST[Math.floor(RNG() * RAND_ST.length)]; addStatus(S, evs, j, rk, CONTROL[rk] ? 2 : 3, i); } break;   // 氢-α发射线：50% 随机一种异常状态
      case 'poisonHeart': foe.st['中毒'] += 1; foe.fx.poison = (foe.fx.poison || 1) + 1; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '的中毒叠加到 ' + foe.fx.poison + ' 层，并延长了1回合（剩 ' + foe.st['中毒'] + ' 回合）', 'fxl'); break;
      case 'lifeSqueeze':
        if (foe.st['寄生'] > 0) { var ls = loseHp(S, evs, j, foe.hp / 6, '额外吸取了' + nm(foe) + '的体力', false, { direct: true, percent: true }); heal(S, evs, i, ls); } break;   // 按对方当前体力的 1/6
    }
  }
  switch (mv.custom) {
    case 'moonBlade': if (total < 180) changeStages(S, evs, i, { atk: 1 }); break;
    case 'suppressArc': if (!foe.fainted && foe.stages.atk > 0 && !stageBlocked(S, evs)) { foe.stages.atk = 0; foe.tm.noStat = 2; E(S, evs, 'stage', { side: j }); log(S, evs, '压制弧光清空了' + nm(foe) + '的物攻强化，下回合它不能使用变化类技能！', 'fxl'); } break;
    case 'boneCut': if (total > 200) { changeStages(S, evs, i, { spe: 1 }); hqGet(S, evs, me, '骨斩肉断'); } break;
    case 'vortex': if (!extra) { me.tm.vortex = 3; E(S, evs, 'stage', { side: i }); log(S, evs, '闪电漩涡缠住了战场（3回合）', 'fxl'); } break;
    case 'liuhuo': me.tm.liuhuo = 5; E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '的火系技能威力提升5点（5回合）', 'fxl'); break;
    case 'tide': if (!extra) { me.tm.tide = 5; me.fx.tideWait = 1; E(S, evs, 'stage', { side: i }); log(S, evs, '黑雾潮汐涌起，从下回合起连续4回合，每回合结束时会再发动一次', 'fxl'); } break;
  }
  if (mv.clearSelfDownAtk && !stageBlocked(S, evs)) { var anyD = false; STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) { me.stages[k] = 0; anyD = true; } }); if (anyD) { E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '解除了自身的能力下降状态', 'fxl'); } }
  if (mv.custom === 'transferDown' && !stageBlocked(S, evs)) {
    var moved = {}, any = false;
    STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) { moved[k] = me.stages[k]; me.stages[k] = 0; any = true; } });
    if (any) { log(S, evs, nm(me) + '把自身的能力下降转移给了对方', 'fxl'); if (!foe.fainted) changeStages(S, evs, j, moved, i); else E(S, evs, 'stage', { side: i }); }
  }
  if (mv.custom === 'normalPunch') {
    if (me.boss && me.boss.ne) { RV(me, 'ne');
      var anyN = false; STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) { me.stages[k] = 0; anyN = true; } });
      E(S, evs, 'stage', { side: i });
      log(S, evs, nm(me) + '的「来东北试试」：普通拳没有降低命中' + (anyN ? '，还甩掉了身上的能力下降！' : ''), 'fxl');
    } else if (hasEmblem(me, '普通拳') && !me.flags.punch) {
      me.flags.punch = true;
      STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) me.stages[k] = 0; });
      me.st = {};
      E(S, evs, 'stage', { side: i });
      log(S, evs, '纹章生效：' + nm(me) + '移除了自身的负面效果', 'fxl');
    } else changeStages(S, evs, i, { acc: -2 });
  }
  if (mv.selfStage && RNG() < (mv.firstSure && firstMover ? 1 : mv.selfChance || 1)) changeStages(S, evs, i, mv.selfStage);   // firstSure：先出手时必定提升（翔月极闪）
  if (mv.selfStageOne) changeStages(S, evs, i, mv.selfStageOne[Math.floor(RNG() * mv.selfStageOne.length)]);   // 几项里随机提升一项（勇猛盾击）
  if (mv.heal) heal(S, evs, i, me.maxhp * (mv.lowHeal && me.hp < me.maxhp / 4 ? mv.lowHeal : mv.heal));
  if (mv.healLost) heal(S, evs, i, (me.maxhp - me.hp) * mv.healLost);   // 按已损失体力回复（生命遁迹）
  if (me.tm.tri > 0 && (mt === '草' || mt === '水' || mt === '火')) { log(S, evs, '三相归元生效', 'fxl'); heal(S, evs, i, me.maxhp / 3); }
}

// 吃一口米饭（吃米饭、米饭香、特性「饭香」）：随机回复 1/5 体力 / 物攻 +1 / 速度 +1，并记下吃了几口（非凡连击用）
function eatRice(S, evs, i, why) {
  var m = act(S, i); if (m.fainted) return;
  m.perm.rice = (m.perm.rice || 0) + 1;
  log(S, evs, (why || nm(m) + '吃了一口米饭') + '（第 ' + m.perm.rice + ' 口）', 'fxl');
  var r = RNG();
  if (r < 1 / 3) { if (!heal(S, evs, i, m.maxhp / 5)) log(S, evs, '但是没有恢复体力'); }
  else if (r < 2 / 3) changeStages(S, evs, i, { atk: 1 });
  else changeStages(S, evs, i, { spe: 1 });
  E(S, evs, 'stage', { side: i });
}
function clearUps(S, evs, j) {
  var t = act(S, j), any = false, removed = posSum(t);
  if (!removed || stageBlocked(S, evs)) return 0;
  STG.forEach(function (k) { if (t.stages[k] > 0) { t.stages[k] = 0; any = true; } });
  if (any) { E(S, evs, 'stage', { side: j }); log(S, evs, nm(t) + '的能力提升效果被消除了', 'fxl'); }
  return removed;
}

var FOE_CUSTOM = { noSwitch: 1, stealDef: 1, stealAtk: 1, hail: 0, noBoostFoe: 1, melt: 1, burnout: 1, wither: 1, weak2: 1, seal: 1, silentSea: 1, selfDestruct: 0, bunker: 0, dielectric: 1, chaosWater: 1 };
function targetsFoe(mv) { return !!(mv.tgtStage || mv.status || mv.clearTgtUp || FOE_CUSTOM[mv.custom]); }

var EVADE_CUSTOM = { dodge: 1, absDef: 1, dodgeOne: 1, voidPhys: 1, cave: 1 };
function doStatus(S, evs, i, mv) {
  var me = act(S, i), j = 1 - i, foe = act(S, j);
  var c = mv.custom;
  // 灵耳谛听：对方试图主动闪避，就被识破
  if (!foe.fainted && foe.tm.ear > 0 && ((mv.selfStage && mv.selfStage.eva > 0) || EVADE_CUSTOM[c])) {
    me.fx.earMark = 1; E(S, evs, 'stage', { side: i });
    log(S, evs, nm(me) + '想要闪避，却被' + nm(foe) + '的灵耳谛听听穿了！下一次受到的攻击威力翻倍', 'bad');
  }
  if (c === 'burnout' && !(foe.perm && foe.perm.melt > 0)) { log(S, evs, '但是对方没有熔化状态，技能失败了'); return; }
  if (c === 'fold') { var fl = Math.floor(me.hp / 2); if (fl > 0) loseHp(S, evs, i, fl, nm(me) + '折叠了自己的生命，损失了 ' + fl + ' 点体力', false, { cost: true }); if (me.fainted) return; }   // 生命折叠（2026-11-01）：损失一半当前体力
  if (mv.selfCleanse) {   // 净化之焰：移除自身的异常状态
    if (hasStatus(me)) { for (var sk in me.st) if (ST_DESC[sk]) delete me.st[sk]; E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '的火焰净化了自身的异常状态', 'fxl'); }
  }
  if (targetsFoe(mv)) {
    if (foe.fainted) { log(S, evs, '但是没有目标'); return; }
    if (hitBlocked(foe, mvType(me, mv))) { log(S, evs, nm(foe) + '毫发无伤！只有' + foe.onlyHit.join('、') + '系技能才能命中它', 'bad'); return; }
    if (RNG() >= hitChance(me, foe, mv)) { E(S, evs, 'miss', { side: j }); log(S, evs, '但是没有命中！'); return; }
    hqLand(me, foe, mv.name, i);
    if (mv.tgtStage) {
      var ts = mv.tgtStage;
      if (c === 'pollen' && RNG() < 0.4) ts = { acc: -2 };   // 花粉：40% 降 2 级
      if (c === 'dielectric' && foe.st['麻痹'] > 0) { ts = {}; for (var kk in mv.tgtStage) ts[kk] = mv.tgtStage[kk] * 2; log(S, evs, '对方处于麻痹，效果翻倍！', 'fxl'); }
      changeStages(S, evs, j, ts, i);
    }
    if (mv.status) {
      if (statusRoll(me, mv.status.chance)) addStatus(S, evs, j, mv.status.k, rint(mv.status.min, mv.status.max), i, false, mv.status.refresh);
      else if (!mv.tgtStage) log(S, evs, '但是对方没有受到影响');
    }
    if (mv.clearTgtUp) {   // 净化之焰
      if (STG.some(function (k) { return foe.stages[k] > 0; })) clearUps(S, evs, j); else log(S, evs, nm(foe) + '没有能力提升效果可以消除');
      if (mv.emblemDown && hasEmblem(me, mv.name)) { log(S, evs, nm(me) + '的纹章发动了', 'fxl'); changeStages(S, evs, j, mv.emblemDown, i); }
    }
  }
  var sst = mv.selfStage;
  if (mv.name === '木叶庇护' && hasEmblem(me, '木叶庇护')) sst = { def: 2, spd: 2 };
  if (sst) changeStages(S, evs, i, sst);
  if (mv.heal) heal(S, evs, i, me.maxhp * (mv.lowHeal && me.hp < me.maxhp / 4 ? mv.lowHeal : mv.heal));
  if (mv.healLost) heal(S, evs, i, (me.maxhp - me.hp) * mv.healLost);   // 按已损失体力回复（生命遁迹）
  if (mv.selfTired && !me.fainted && me.boss && (me.boss.immortal || me.boss.noStatus)) { RV(me, 'immortal'); RV(me, 'noStatus'); log(S, evs, nm(me) + '免疫异常状态，没有陷入「疲惫」', 'fxl'); }
  else if (mv.selfTired && !me.fainted) { me.st['疲惫'] = mv.selfTired + 1; E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '耗尽了力气，陷入「疲惫」状态（' + mv.selfTired + '回合）', 'bad'); }   // 余烬涅槃：代价是自己疲惫（本回合结束时会先减 1，所以多记 1）
  if (mv.clearSelfDown && !stageBlocked(S, evs)) {
    var any = false; STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) { me.stages[k] = 0; any = true; } });
    E(S, evs, 'stage', { side: i });
    log(S, evs, any ? nm(me) + '解除了自身的能力下降状态' : '但是没有需要解除的能力下降', any ? 'fxl' : '');
  }
  function timer(key, n, text) { me.tm[key] = n; E(S, evs, 'stage', { side: i }); log(S, evs, text, 'fxl'); }
  function foeTimer(key, n, text) { foe.tm[key] = n; E(S, evs, 'stage', { side: j }); log(S, evs, text, 'bad'); }
  function flag(text) { E(S, evs, 'stage', { side: i }); log(S, evs, text, 'fxl'); }
  switch (c) {
    case 'glenPride':
      var prideHP = Math.floor(glenDefense(me) * .1);
      me.fx.prideShield = { hp: Math.max(prideHP, me.fx.prideShield ? me.fx.prideShield.hp : 0), until: S.turn + (S.turnActed[j] ? 1 : 0) };
      flag(nm(me) + '获得了 ' + prideHP + ' 点孤王之傲护盾'); break;
    case 'glenHighland': me.fx.highlandHits = 3; flag(nm(me) + '成为高地之王，下3次受到的攻击减伤35%'); break;
    case 'barlowShield': timer('pureShield', 4, nm(me) + '展开纯净护盾'); gainPureShield(S, evs, i); break;
    case 'barlowField': timer('pureField', 5, nm(me) + '展开纯净领域，双方能力等级无法变化'); break;
    case 'barlowOrigin': me.fx.originHits = 2; flag(nm(me) + '展露本源之姿，下2次攻击命中后恢复体力'); break;
    case 'baliBarrier': timer('halfSpec', 4, nm(me) + '展开彩色屏障：4回合内特殊攻击伤害减半'); break;
    case 'baliStance': me.fx.prismAttacks = 3; flag(nm(me) + '展露斑斓之姿，下3次主动攻击将拆为两次'); break;
    case 'clementClean':
      if (stageBlocked(S, evs)) break;
      var cleaned = false; STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) { me.stages[k] = 0; cleaned = true; } });
      if (cleaned) { me.tm.mist = 5; flag(nm(me) + '解除了能力下降，5回合内免疫能力下降'); }
      else log(S, evs, '没有需要解除的能力下降');
      break;
    case 'fateField': S.fateTurns = 4; E(S, evs, 'stage', { side: i }); log(S, evs, '命运领域展开：接下来4回合，双方将在回合结束时获得同种命运标记', 'fxl'); break;
    case 'sure3': timer('sure3', 3, nm(me) + '竖起耳朵仔细聆听：3回合内攻击必定命中'); break;
    case 'ear': timer('ear', 3, nm(me) + '的灵耳捕捉到了一切声音：3回合内攻击必定命中，对方若试图闪避会被识破'); break;
    case 'lightStaff':
      changeStages(S, evs, i, RNG() < 0.5 ? { def: 1 } : { spd: 1 });
      if (!foe.fainted) foeTimer('noHeal', 2, nm(foe) + '被光之杖照耀，2回合内无法恢复体力');
      break;
    case 'nilin': timer('cap', 5, nm(me) + '竖起逆鳞：5回合内单次受到的伤害不超过250'); break;
    case 'genggu': timer('genggu', 2, nm(me) + '进入亘古恒压状态（2回合）'); break;
    case 'shield': me.fx.shield = Math.max(me.fx.shield || 0, 100); flag(nm(me) + '获得了 100 点护盾'); break;
    case 'noSwitch': foeTimer('noSwitch', 5, nm(foe) + '被傲慢震慑，5回合内无法切换精灵'); break;
    case 'priorityUp': timer('prio', 5, nm(me) + '与水天融为一色：5回合内技能先制+1'); break;
    case 'dodge': timer('dodge', 3, nm(me) + '的皮肤变得光滑（3回合）'); break;
    case 'x2next': me.fx.x2Next = 1; E(S, evs, 'stage', { side: i }); log(S, evs, nm(me) + '蓄势待发，下一次攻击伤害翻倍！', 'fxl'); break;
    case 'counterStorm': timer('counter', 5, nm(me) + '摆出了反击的架势（5回合）'); break;
    case 'parryTm': case 'parryAtk':
      if (!S.parry) S.parry = [null, null];
      S.parry[i] = { k: c, ok: 0, mv: mv.name };
      log(S, evs, nm(me) + '摆出了化解的架势，准备看破对方的' + (c === 'parryTm' ? '回合类效果' : '主动攻击'), 'fxl'); break;
    case 'fenglei': timer('fenglei', 5, '风雷滚滚！' + nm(me) + '身边卷起了风与雷（5回合）'); break;   // 2026-11-02
    case 'absDef': me.fx.absDef = 1; flag(nm(me) + '摆出了绝对防御的架势'); break;
    case 'cave': me.fx.cave = S.turn; flag(nm(me) + '躲进了岩洞，这一回合的攻击都打不到它'); break;
    case 'dodgeOne': me.fx.absDef = 1; flag(nm(me) + '准备遁走，会闪避下1次攻击'); break;
    case 'immune': timer('immune', 5, nm(me) + '被香甜气息包围，5回合内免疫异常状态'); break;
    case 'reflect': timer('reflect', 5, nm(me) + '展开了风王结界（5回合）'); break;
    case 'green': timer('green', 5, nm(me) + '展开了绿色幻境（5回合）'); break;
    case 'rain': timer('rain', 5, '天空下起了雨（5回合）'); break;
    case 'tri': heal(S, evs, i, me.maxhp / 3); timer('tri', 3, nm(me) + '三相归元（3回合）'); break;
    case 'boostNext': me.fx.boostNext = 1; flag(nm(me) + '潜入水中，下一次攻击伤害提升50%'); break;
    case 'silence':
      if (!S.turnActed[j] && S.order.indexOf(j) >= 0 && !foe.fainted) { S.silenced[j] = true; log(S, evs, '黑暗笼罩了' + nm(foe) + '，它本回合的技能将会失效！', 'fxl'); }
      else log(S, evs, '但是对方已经出手或没有出招，没有效果');
      break;
    case 'selfBreak': case 'selfBreak2':
      loseHp(S, evs, i, Math.floor(me.hp / 2), nm(me) + '燃烧了一半体力', false, { cost: true });
      changeStages(S, evs, i, { atk: 2, spe: 1, acc: 1 });
      if (c === 'selfBreak2') { me.fx.sureCrit = 1; me.fx.sureHit = 1; flag(nm(me) + '的下一次攻击必定命中并造成致命一击'); }
      break;
    // —— 第二批
    case 'nextCrit': me.fx.sureCrit = 1; flag(nm(me) + '的下一次攻击必定致命一击'); break;
    case 'voidPhys': timer('voidPhys', 2, nm(me) + '进入虚空化，2回合内闪避物理攻击'); break;
    case 'induct': timer('induct', 5, nm(me) + '展开电磁感应（5回合）'); break;
    case 'stealDef': changeStages(S, evs, j, { def: -1 }, i); changeStages(S, evs, i, { def: 1 }); break;
    case 'stealAtk': changeStages(S, evs, j, { atk: -1 }, i); changeStages(S, evs, i, { atk: 1 }); break;
    case 'lightside':
      delete me.tm.darkside; E(S, evs, 'stage', { side: i });
      log(S, evs, nm(me) + '转入月之亮面：属性和技能恢复为光系', 'fxl');
      moonSwitch(S, evs, i);
      break;
    case 'darkside':
      timer('darkside', 5, nm(me) + '转入月之暗面：属性和技能都变成暗影系（5回合）');
      moonSwitch(S, evs, i);
      break;
    case 'hail': timer('hail', 5, '下起了冰雹（5回合）'); break;
    case 'mystic':
      if (RNG() < 0.6) { changeStages(S, evs, i, { spa: 1, def: 1, spd: 1, spe: 1, acc: 1, eva: 1 }); hqR(me).n['神秘之力'] = (hqR(me).n['神秘之力'] || 0) + 1; }
      else log(S, evs, '但是神秘之力没有回应');
      break;
    case 'noBoostFoe': foeTimer('noBoost', 5, nm(foe) + '被封印，5回合内无法提升能力等级'); break;
    case 'seal': foeTimer('seal', 5, nm(foe) + '被万灵封印：5回合内禁止提升能力等级，强行提升会受反噬'); break;
    case 'melt':
      foe.perm.melt = Math.min(5, (foe.perm.melt || 0) + 1); foe.hqMelt = me; E(S, evs, 'stage', { side: j });
      log(S, evs, nm(foe) + '熔化 ' + foe.perm.melt + ' 层，受到的伤害提升 ' + foe.perm.melt * 20 + '%（持续到战斗结束）', 'bad'); break;
    case 'burnout': foe.perm.melt = 5; foe.hqMelt = me; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '的熔化直接叠到了 5 层！', 'bad'); break;
    case 'capacitor':
      if (hasEmblem(me, '恐怖电容')) { me.fx.shield = (me.fx.shield || 0) + 150; flag('纹章生效：' + nm(me) + '额外获得 150 点护盾'); }
      break;
    case 'odoAtk': case 'odoDef':   // 奥多亚克切换形态
      var to = c === 'odoAtk' ? 'atk' : 'def';
      if (me.perm.odoForm === to) { log(S, evs, nm(me) + '已经是' + (to === 'atk' ? '歼灭' : '护阵') + '形态了'); break; }
      me.perm.odoForm = to; log(S, evs, nm(me) + '切换为' + (to === 'atk' ? '歼灭' : '护阵') + '形态！', 'fxl');
      if (to === 'atk') { changeStages(S, evs, i, { atk: 1, spa: 1 }); for (var osk in me.st) if (ST_DESC[osk]) delete me.st[osk]; }
      else { changeStages(S, evs, i, { def: 1, spd: 1 }); STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) me.stages[k] = 0; }); }
      if (ability(me) === '重构') { log(S, evs, nm(me) + '的「重构」发动了', 'fxl'); heal(S, evs, i, 100); }
      E(S, evs, 'stage', { side: i }); break;
    case 'odoBuffAtk': timer('odoAtk', 4, nm(me) + '全弹搭载完毕：4回合内造成的伤害提升25%'); break;
    case 'odoBuffDef': timer('odoDef', 4, nm(me) + '换上了强效外壳：4回合内受到的伤害减少20%'); break;
    case 'odoBoom':
      if (!foe.fainted) { log(S, evs, nm(me) + '引爆了机体！', 'crit'); applyDamage(S, evs, j, mv.boom, i, {}); if (mv.boomDown && !foe.fainted) changeStages(S, evs, j, { def: -1, spd: -1 }, i); }
      if (mv.boomAlly) S.sides[i].odoAlly = true;
      me.hp = 0; faint(S, evs, i); break;
    case 'selfDestruct':
      if (!foe.fainted) { addStatus(S, evs, j, '疲惫', 2, i); changeStages(S, evs, j, { def: -1, spd: -1 }, i); }
      log(S, evs, nm(me) + '自爆了！'); me.hp = 0; faint(S, evs, i); break;
    case 'bunker':
      if (!foe.fainted) clearUps(S, evs, j);
      log(S, evs, nm(me) + '炸毁了碉堡，牺牲了自己'); me.hp = 0; faint(S, evs, i); break;
    case 'calm': timer('calm', 5, nm(me) + '周围化作静谧水域（5回合）'); break;
    case 'halfPhys5': timer('halfPhys', 5, nm(me) + '展开幽冥结界：5回合内物理伤害减半'); break;
    case 'halfPhys3': timer('halfPhys', 3, nm(me) + '竖起盾墙：3回合内物理伤害减半'); break;
    case 'chaosWater': if (!foe.fainted) { var cw = loseHp(S, evs, j, foe.hp / 5, '混沌水域吸取了' + nm(foe) + '的体力', false, { percent: true }); heal(S, evs, i, cw); } break;
    case 'wither':
      if (witherN(foe) >= WITHER_MAX) { log(S, evs, nm(foe) + '身上的凋零之蚀已经叠满 ' + WITHER_MAX + ' 层，没有效果'); break; }
      foe.perm.wither = witherN(foe) + 1; foe.hqWither = me; E(S, evs, 'stage', { side: j }); log(S, evs, nm(foe) + '被凋零之蚀侵蚀（' + foe.perm.wither + ' 层），每回合损失 ' + foe.perm.wither + '/' + WITHER_DIV + ' 最大体力，直到战斗结束', 'bad'); break;
    case 'swamp': timer('swamp', 5, nm(me) + '展开孢子沼泽：5回合内异常状态成功率×1.5'); break;
    case 'purge':
      loseHp(S, evs, i, Math.floor(me.hp / 2), nm(me) + '损失了一半现有体力', false, { cost: true });
      if (!me.fainted) {
        STG.forEach(function (k) { if (me.stages[k] < 0 && !pureFieldActive(S)) me.stages[k] = 0; }); me.st = {};
        delete me.tm.noBoost; delete me.tm.seal; delete me.tm.weak; delete me.tm.vuln; delete me.tm.noSwitch; me.perm = {};
        flag(nm(me) + '以毒攻毒，清除了自身一切不利状态');
      }
      break;
    case 'mist': timer('mist', 5, nm(me) + '被白雾笼罩：5回合内免疫能力下降'); break;
    case 'jungle': timer('jungle', 3, nm(me) + '遵循丛林法则：3回合内对比自己更虚弱的敌人伤害+70%'); break;
    case 'siren':   // 2026-10-24：效果挂在对方身上，只对唱歌时在场的那只生效；对方换下场就会消失。【不朽】免疫
      if (foe.boss && foe.boss.immortal) { RV(foe, 'immortal'); flag(nm(foe) + '的「不朽」让它对海妖之歌充耳不闻'); break; }
      if (foe.tm.sirenOn > 0) { flag('海妖之歌已经在唱了，' + nm(foe) + '还剩 ' + foe.tm.sirenOn + ' 回合'); break; }
      foe.tm.sirenOn = 5; foe.fx.sirenBy = S.sides[i].active; E(S, evs, 'stage', { side: j }); flag(nm(me) + '唱起海妖之歌……5回合后若它还站着，' + nm(foe) + '将失去全部体力（换下场可以躲开）'); break;
    case 'silentSea': foe.tm = {}; E(S, evs, 'stage', { side: j }); log(S, evs, '寂静之海消除了' + nm(foe) + '身上所有回合类效果', 'fxl'); break;
    case 'dr40': timer('dr40', 3, nm(me) + '受到潮汐庇佑：3回合内受伤减免40%'); break;
    case 'weak2': foeTimer('weak', 2, nm(foe) + '的魂魄被封住，2回合内伤害降低30%'); break;
    case 'thunderCloud': timer('tcloud', 3, nm(me) + '召来了闪电云：接下来3回合每回合末对对方造成100点固定伤害'); break;
    case 'crit2': timer('crit2', 3, nm(me) + '接下来2回合的攻击必定致命一击'); break;
    case 'endure': me.fx.endure = 1; flag(nm(me) + '进入不灭之躯：下一次受到致死攻击时会残留1体力'); break;
    case 'sureHitNext': me.fx.sureHit = 1; flag(nm(me) + '的下一次攻击必定命中'); break;
    case 'retal': timer('retal', 3, nm(me) + '展开寂灭幽映（3回合）'); break;
    case 'block100': me.fx.shield = Math.max(me.fx.shield || 0, 100); timer('block', 3, nm(me) + '坚不可摧：3回合内每回合抵挡100点伤害'); break;
    case 'recoilQ': timer('recoil', 4, nm(me) + '充能磁暴反冲（4回合）'); break;
    case 'rice': eatRice(S, evs, i); break;
    case 'rice3': log(S, evs, '米饭太香了！'); var rn = RNG() < 0.25 ? 3 : 2; for (var rk = 0; rk < rn && !me.fainted; rk++) eatRice(S, evs, i); if (rn === 3) log(S, evs, '实在太香了，忍不住又吃了一口！', 'fxl'); break;   // 2026-10-21：吃 2 口，25% 再吃一口
  }
  if (i === 0) hqAfterStatus(S, evs, me, foe, mv);
}

/* ---------- 隐藏技能的领悟 ----------
 * 只有账号里的精灵（带 u）能在剧情 / 野外 / BOSS战中领悟；条件不在界面上公开，
 * 达成时战斗记录里只会出现「似乎领悟了什么……」，结算时才写出领悟了哪个技能。
 * 没有写领悟条件的隐藏技能（叶子喵）仍然是 LV50 自动习得，不走这里。 */
function hqR(m) { if (!m.hq) m.hq = { u: {}, n: {}, h: {} }; return m.hq; }
// 炸弹爆炸：到了 at 回合的结束时，对那一边当前在场的精灵造成伤害（火灵炸弹还会清空能力提升，每级附加固定伤害）
function bombTick(S, evs) {
  if (!S.bombs || !S.bombs.length) return;
  var keep = [];
  S.bombs.forEach(function (b) {
    if (b.at > S.turn) { keep.push(b); return; }
    var j = 1 - b.from, t = act(S, j); if (t.fainted || S.over) return;
    log(S, evs, nm(b.mon) + '埋下的「' + b.mv.name + '」爆炸了！', 'use');
    E(S, evs, 'use', { side: b.from, move: b.mv.name, type: b.mv.type });
    if (hitBlocked(t, b.mv.type)) { log(S, evs, nm(t) + '毫发无伤！', 'bad'); return; }
    glenAttackStart(S, b.from, b.mv);
    var res = calcDamage(b.mon, t, b.mv, false, false);
    if (res.crit) log(S, evs, '致命一击！', 'crit');
    if (res.petri) log(S, evs, '石化中被暴击，伤害翻倍！', 'crit');
    S.lastShown = null; var dmg = applyDamage(S, evs, j, res.dmg, b.from, { crit: res.crit, eff: res.eff, noFaint: true });
    if (res.petri) petriBreak(S, evs, j);
    if (res.crit && t.hp > 0 && !t.fainted) changeStages(S, evs, j, b.mv.cat === '物攻' ? { def: -1 } : { spd: -1 }, b.from);
    log(S, evs, '对' + nm(t) + '造成 ' + (S.lastShown != null ? S.lastShown : dmg) + ' 点伤害', 'dmg'); S.lastShown = null;
    if (b.mv.bombClear && t.hp > 0) {
      var lv = 0; STG.forEach(function (k) { if (t.stages[k] > 0) lv += t.stages[k]; });
      if (lv) { clearUps(S, evs, j); log(S, evs, '火灵炸弹清除了 ' + lv + ' 级能力提升，附加 ' + (lv * b.mv.bombClear) + ' 点固定伤害', 'fxl'); applyDamage(S, evs, j, lv * b.mv.bombClear, b.from, { noFaint: true }); }
    }
    if (t.hp <= 0 && !t.fainted) {
      faint(S, evs, j);
      if (b.from === 0 && b.mv.name === '爆燃炸弹') hqGet(S, evs, b.mon, '火灵炸弹');   // 隐藏技能：用爆燃炸弹的爆炸击败敌人
    }
    glenAttackEnd(S, evs); delete S.glenAttack;
    checkOver(S, evs);
  });
  S.bombs = keep;
}
var HIDDEN_MIN_LV = 40;   // 隐藏技能最低 LV40 才能领悟（条件满足但等级不够时不会领悟）
function hqGet(S, evs, m, name) {
  if (!m || m.u == null || !LEARN[name]) return;
  if (typeof window !== 'undefined' && window.HL_GATED && window.HL_GATED[m.id]) return;   // 这些种族改成只能用道具解锁（见 game.js 的 HL_GATED）
  if ((m.lv || LV) < HIDDEN_MIN_LV) return;
  var s = SPMAP[m.id]; if (!s || s.hidden.indexOf(name) < 0) return;
  if (m.hl && m.hl.indexOf(name) >= 0) return;
  if (!m.hqGot) m.hqGot = []; if (m.hqGot.indexOf(name) >= 0) return;
  m.hqGot.push(name);
  log(S, evs, nm(m) + '似乎领悟了什么……', 'crit');
}
// 本场使用次数（u）、本次出场使用次数（fx.hqU）、上一个使用的技能（fx.hqPrev）
function hqUse(me, n) {
  var q = hqR(me); q.u[n] = (q.u[n] || 0) + 1;
  if (!me.fx.hqU) me.fx.hqU = {}; me.fx.hqU[n] = (me.fx.hqU[n] || 0) + 1;
  me.fx.hqPrev = me.fx.hqLast; me.fx.hqLast = n;
}
// 技能命中对方（攻击造成了伤害，或变化技能命中）
function hqLand(me, foe, n, i) {
  var q = hqR(me); q.n[n] = (q.n[n] || 0) + 1;
  if (i === 0) { if (!foe.hqBy) foe.hqBy = {}; foe.hqBy[n] = 1; }
}
// 把对战状态（和这一回合的事件）转成 JSON，发给浏览器用（服务器结算的对战，2026-10-24）。
// 精灵身上会记着别的精灵（比如隐藏技能的领悟条件记了「是谁让它冰冻的」），直接转 JSON 会循环引用：
// 精灵只在 S.sides[i].team 里原样输出，别处引用到的一律去掉（浏览器只播放，不需要这些）
function battleJSON(S, obj) {
  var mons = new Set(), teams = new Set();
  S.sides.forEach(function (sd) { teams.add(sd.team); sd.team.forEach(function (t) { mons.add(t); }); });
  return JSON.stringify(obj, function (k, v) { return v && typeof v === 'object' && mons.has(v) && !teams.has(this) ? undefined : v; });
}
function hqStatus(S, evs, t, k, by) {
  if (!t.hqSt) t.hqSt = {}; t.hqSt[k] = { mv: S.hqMv, by: by };
  if (k === '冰冻' && S.hqMv === '冰冻打击' && by.u != null) { var q = hqR(by); q.n['冻结'] = (q.n['冻结'] || 0) + 1; if (q.n['冻结'] >= 2) hqGet(S, evs, by, '急冻打击'); }
}
function hqFrom(x, mv, me) { return !!(x && x.mv === mv && x.by === me); }
function hqStN(m) { var n = 0; for (var k in m.st) if (m.st[k] > 0 && ST_DESC[k]) n++; return n; }
function hqEff(m, k) { return m.stats[k] * stageMult(m.stages[k]); }
function hqDot(S, evs, t, why) {
  var b = t.hqSt && t.hqSt['烧伤'];
  if (why.indexOf('烧伤') >= 0 && b && b.mv === '爆炎斩') hqGet(S, evs, b.by, '火山突堑');
  if (why.indexOf('凋零之蚀') >= 0 && t.hqWither) hqGet(S, evs, t.hqWither, '灭却');
}
function hqAfterStatus(S, evs, me, foe, mv) {
  if (me.u == null) return;
  var q = hqR(me);
  if (mv.name === '逆流' && !foe.fainted && foe.stages.spe <= -6 && foe.stages.acc <= -6) hqGet(S, evs, me, '混沌海流');
  if ((q.n['雷暴'] || 0) >= 4) hqGet(S, evs, me, '介电崩坏');
  if (mv.custom === 'selfDestruct' && !foe.fainted && foe.st['疲惫'] > 0 && foe.stages.def < 0 && foe.stages.spd < 0) hqGet(S, evs, me, '舍身爆破');
}
// 用攻击技能击败对方时检查
function hqKO(S, evs, me, foe, mv) {
  if (me.u == null) return;
  var q = hqR(me), fu = me.fx.hqU || {}, prev = me.fx.hqPrev, n = mv.name, st = foe.hqSt || {}, by = foe.hqBy || {};
  var R = {
    亘古恒压: (me.fx.fieldT || 0) >= 6,
    巨龙湮灭破: foe.st['害怕'] > 0 && hqFrom(st['害怕'], '龙吟崩山震', me),
    飞叶风暴: n === '飞叶刀',
    超级吸取: (n === '吸取' || n === '强力吸取') && me.hp >= me.maxhp,
    灭生之潮: n === '海啸' && prev === '海啸',
    创生之潮: prev === '灵光' && me.stages.spa >= 6,
    溺毙: n === '贯穿水枪' && foe.st['溺水'] > 0,
    风王结界: !!q.blk,
    木叶飓风: n === '木叶旋风',
    饮血刀光: n === '灵魂之刃' && me.stages.atk >= 6 && q.u['黑月刀光'] > 0,
    黑暗收割: n === '收割',
    狂涛疾刃: hqFrom(st['流血'], '怒海疾刺', me),
    水纹震击: n === '水打击',
    元神崩坏: prev === '自我崩坏',
    三相归元: q.u['修竹拳'] > 0 && q.u['若水拳'] > 0 && q.u['燎燃拳'] > 0,
    顿悟星盘: prev === '驱使念力',
    刹那灭杀: n === '灵光冲击',
    闪电漩涡: hqFrom(st['麻痹'], '闪电烙印', me),
    残月之痕: prev === '朔月' && me.stages.def >= 3,
    月之暗面: (q.u['月神降临'] || 0) >= 3,
    零度冰破: foe.st['冰冻'] > 0,
    神秘灵核: (q.n['神秘之力'] || 0) >= 3,
    起源巨刃: foe.stages.spe <= -6 && q.u['起源暴风'] > 0,
    烧却: (foe.perm.melt || 0) >= 5 && foe.hqMelt === me,
    雷击: hqFrom(st['麻痹'], '电磁脉冲', me),
    黑雾潮汐: prev === '恶魔触手' && foe.tm.vuln > 0,
    混沌水域: (q.h['静谧水域'] || 0) >= me.maxhp * 0.5,
    以毒攻毒: me.hp <= me.maxhp / 4 && negCount(me) >= 2,
    渗透孢子: hqStN(foe) >= 2 || (foe.fx.poison || 0) >= 3,
    盛宴: n === '进食' && hqEff(foe, 'def') > hqEff(me, 'atk'),
    丛林法则: (q.n['草木皆兵'] || 0) >= 3,
    唤潮之佑: !!(by['浪花'] && by['海浪']) && foe.stages.acc <= -3,
    戳刺: n === '至高剑锋' && !!(fu['盾墙'] || fu['坚不可摧'] || fu['勇猛盾击']),
    生命榨取: (q.h['幻境汲取'] || 0) >= me.maxhp * 0.5,
    万灵封印: fu['生命折叠'] > 0 && me.stages.def >= 4 && me.stages.spd >= 4,   // 2026-11-01：生命遁迹改为生命折叠
    淬命之焰: n === '火焰车' && (me.fx.hqRaw || 0) > foe.maxhp,
    烈焰风暴: n === '烈焰云' && foe.st['烧伤'] > 0,
    余烬涅槃: Math.min(me.fx.fieldT || 0, foe.fx.fieldT || 0) >= 10
  };
  for (var k in R) if (R[k]) hqGet(S, evs, me, k);
}

/* ---------- BOSS的特殊能力 ----------
 * BOSS精灵带 boss：{ noStatus 免疫异常状态, ne 来东北试试, dr 星球聚能减伤比例, mia 瘴气领域, puppet 瘴毒傀儡, pp 技能 PP }
 * 写在 js/ui/game.js 的 BOSSES 里，开战时随精灵传进来 */
var CL_NAME = ['疏散星团-阿尔法', '疏散星团-贝塔', '疏散星团-欧米茄'], CL_DESC = ['造成的伤害提升 50%', '受到的伤害减免 30%', '先出手时造成的伤害提升 50%；后出手时受到的伤害减免 30%'];
var BOSS_FX = [
  { k: 'noPercent', t: '免疫百分比伤害', h: '免疫百分比伤害', d: function () { return '免疫按体力比例造成的伤害；常规攻击与定值伤害仍可生效'; } },
  { k: 'tuning', t: '调弦', h: '调弦', d: function () { return '奇数回合免疫直接伤害，偶数回合只受到直接伤害'; } },
  { k: 'chord', t: '和弦', h: '和弦', d: function (m) { return '受到的异常状态伤害与百分比伤害降低' + Math.round(m.boss.chord * 100) + '%，每回合因异常状态无法行动时，有50%概率恢复本次行动'; } },
  { k: 'noStatus', t: '免疫异常', h: '免疫异常状态', d: function () { return '不会陷入任何异常状态（睡眠、麻痹、中毒、寄生等）'; } },
  { k: 'feud', t: '东北的纷争', h: '东北的纷争', d: function () { return '物攻永久提升 30%（直接算进能力值，不会被消除）'; } },
  { k: 'past', t: '东北的往事', h: '东北的往事', hide: function (m) { return !m.boss.pastKnown; }, d: function () { return '第一次被击败后会不屈复活（LV60，体力 3000），觉醒【永续的纷争】【往日重现】，并展开场地【沈阳大街】'; } },
  { k: 'eternal', t: '永续的纷争', h: '永续的纷争', d: function () { return '物攻永久提升 60%，但受到的伤害增加 20%'; } },
  { k: 'relive', t: '往日重现', h: '往日重现', d: function () { return '受到攻击时有 50% 的概率，让对方随机陷入烧伤、冻伤、中毒之一（1~3 回合）'; } },
  { k: 'sy', t: '沈阳大街', h: '沈阳大街（场地）', d: function () { return '场地效果：双方都不能使用变化类技能'; } },
  { k: 'ne', t: '来东北试试', h: '来东北试试', d: function () { return '使用普通拳时不会降低自身命中，并解除自身的能力下降状态'; } },
  { k: 'nourish', t: '养料汲取', h: '养料汲取', d: function () { return '每回合结束时恢复 50 体力'; } },   // 2026-10-24 第十一段 · 实验室里的荒芜
  { k: 'mmGift', t: '明明之赐', h: '明明之赐', d: function () { return '物攻、特攻提升 50%'; } },   // 明明教官的试炼 · 高难
  { k: 'lmBoost', t: '雷明尊者', h: '雷明尊者', d: function () { return '自身的特性「雷明」效果增幅 300%（固定伤害 100、回复 80）'; } },   // 明明教官的光霆主
  { k: 'ambush', t: '突然袭击', h: '突然袭击', d: function (m) { return '第一回合率先出手，对你的出战精灵造成 ' + m.boss.ambush + ' 点固定伤害'; } },   // 奥多亚克BOSS
  { k: 'odoRate', t: '歼灭速率', h: '歼灭速率', d: function () { return '先天速度极高（约 1000）。先出手时附加对方最大体力 1/4 的固定伤害；后出手时本回合受到的伤害增加 25%'; } },
  { k: 'odoWill', t: '护阵意志', h: '护阵意志', d: function () { return '每次受到的伤害不会超过 200，超过的部分全部反弹给攻击者'; } },
  { k: 'rainbow', t: '虹霓暴走', h: '虹霓暴走', d: function () { return '物攻、特攻提升 50%。对你每累计造成 1000 点伤害（不计溢出）就爆破一次：自身损失 500 体力，并对你造成 500 点固定伤害'; } },
  { k: 'odoSwap', t: '形态切换', h: '形态切换', d: function () { return '歼灭形态和护阵形态每 2 回合主动切换一次；两种形态都被击败后，化为虹霓暴走'; } },
  { k: 'stRes', t: '稀薄粒子', h: '稀薄粒子', nm: function (m) { return m.id === 'rosette' ? '稀薄粒子' : '异常抗性'; }, d: function (m) { return '异常状态造成的持续伤害只有原来的 ' + Math.round((1 - m.boss.stRes) * 100) + '%（寄生被吸走的体力也一样）；异常状态本身照常生效'; } },
  { k: 'cl', t: '疏散星团', h: '疏散星团', nm: function (m) { return CL_NAME[m.boss.bar || 0]; }, d: function (m) { return CL_DESC[m.boss.bar || 0]; } },
  { k: 'dust', t: '尘埃柱', h: '尘埃柱', d: function () { return '每回合结束时有 30% 的概率让对方陷入混乱 2 回合（攻击时有 40% 的概率攻击自己）'; } },   // 玫瑰星云（第十九段）
  { k: 'bok', t: '博克球状体', h: '博克球状体', d: function (m) { return m.boss.bokUsed ? '已经发动过了' : '体力低于 2000 时，恢复 500 体力并对对方造成 200 点固定伤害（只发动一次）'; } },
  { k: 'dr', t: '星球聚能', h: '星球聚能', d: function (m) { return '受到的伤害减少 ' + Math.round(m.boss.dr * 100) + '%'; } },
  { k: 'mia', t: '瘴气领域', h: '瘴气领域', d: function () { return '只要它还没倒下，每回合结束时为对手在场的精灵添加 1 层瘴气'; } },
  { k: 'puppet', t: '瘴毒傀儡', h: '瘴毒傀儡', d: function (m) { var cd = puppetCd(m), left = m.boss.last == null ? 0 : Math.max(0, cd - (m.boss.now - m.boss.last));
    return '每回合有 30% 的几率下场，召唤一只 LV' + (m.boss.puppetLv || 50) + ' 的瘴毒傀儡（芙罗拉星的草系精灵，带 10 层瘴气，只会用攻击技能）。召唤后冷却 15 回合，体力低于 1000 后冷却缩短为 7 回合。' + (left ? '\n当前冷却：还剩 ' + left + ' 回合' : '\n当前：可以召唤'); } },
  { k: 'erode', t: '深度侵蚀', h: '深度侵蚀', d: function (m) { return '物攻、特攻永久提升 ' + Math.round((erodeMult(m) - 1) * 100) + '%（直接算进能力值，不会被消除）'; } },
  { k: 'mute', t: '无法交流', h: '无法交流', d: function () { return '完全失去理智，只会使用攻击技能'; } },
  { k: 'purify', t: '净化光芒', h: '净化光芒', d: function () { return '对沾染瘴气的目标造成的伤害提升 100%'; } },
  { k: 'immortal', t: '不朽', h: '不朽', d: function (m) { return '免疫任何异常状态，也免疫自身能力等级的下降（提升不受影响）' + (m && m.boss && m.boss.ppLim ? '' : '；技能 PP 无限'); } },
  // 无尽作战（2026-11-02）
  { k: 'eAtk', t: '增伤', h: '增伤', d: function (m) { return '造成的伤害提升 ' + Math.round(m.boss.eAtk * 100) + '%'; } },
  { k: 'eDr', t: '受伤减免', h: '受伤减免', d: function (m) { return '受到的伤害减少 ' + Math.round(m.boss.eDr * 100) + '%'; } },
  { k: 'eRef', t: '反弹', h: '反弹', d: function (m) { return '受到攻击时，把这次伤害的 ' + Math.round(m.boss.eRef * 100) + '% 反弹给攻击者'; } },
  { k: 'rPhys', t: '反弹物攻', h: '反弹物攻', d: function (m) { return '受到物理攻击时，把这次伤害的 ' + Math.round(m.boss.rPhys * 100) + '% 反弹给攻击者'; } },
  { k: 'rSpec', t: '反弹特攻', h: '反弹特攻', d: function (m) { return '受到特殊攻击时，把这次伤害的 ' + Math.round(m.boss.rSpec * 100) + '% 反弹给攻击者'; } },
  { k: 'noPhys', t: '免疫物攻', h: '免疫物攻', d: function () { return '物理攻击对它完全无效'; } },
  { k: 'noSpec', t: '免疫特攻', h: '免疫特攻', d: function () { return '特殊攻击对它完全无效'; } },
  { k: 'noStatF', t: '禁止变化', h: '禁止变化', d: function () { return '它在场时，对手不能使用变化类技能'; } },
  { k: 'fixRes', t: '固伤减免', h: '固伤减免', d: function (m) { return '受到的固定伤害减少 ' + Math.round(m.boss.fixRes * 100) + '%'; } },
  { k: 'noNormal', t: '免疫常规伤害', h: '免疫常规伤害', d: function () { return '技能造成的常规伤害对它无效，只有固定伤害和异常状态的伤害能伤到它'; } },
  { k: 'eSt', t: '异常抗性', h: '异常抗性', d: function (m) { return '异常状态的持续回合和持续伤害都减少 ' + Math.round(m.boss.eSt * 100) + '%'; } },
  // 先驱之塔（2026-10-17）
  { k: 'regen', t: '再生', h: '再生', d: function (m) { return '每回合结束时恢复 ' + Math.round((m.boss.regen === true ? 0.06 : m.boss.regen) * 100) + '% 最大体力'; } },
  { k: 'thorn', t: '荆棘', h: '荆棘', d: function () { return '受到攻击时，把这次伤害的 15% 反弹给攻击者'; } },
  { k: 'armor', t: '厚甲', h: '厚甲', d: function () { return '受到的伤害减少 20%'; } },
  { k: 'focus', t: '专注', h: '专注', d: function () { return '造成的伤害提升 20%'; } },
  { k: 'rage', t: '狂暴', h: '狂暴', d: function () { return '体力低于一半时，造成的伤害提升 30%'; } },
  { k: 'swift', t: '疾行', h: '疾行', d: function () { return '所有技能先制 +1'; } },
  { k: 'guard', t: '坚壁', h: '坚壁', d: function (m) { return m.boss.guardUsed ? '已经发动过了' : '第一次受到致命伤害时，保留 1 点体力（只发动一次）'; } },
  { k: 'solemn', t: '肃穆', h: '肃穆', d: function () { return '对手只能派出一只精灵单挑'; } },
  { k: 'reaper', t: '死神', h: '死神', d: function () { return '所有技能先制 +1，造成的伤害提升 25%；对方每损失 1% 最大体力，伤害再提升 2%'; } },
  { k: 'humus', t: '腐殖质', h: '腐殖质', d: function (m) { return '每回合结束时随机给对手附加 1 项：速度 −1 / 物攻 −1 / 特攻 −1 / 寄生 3 回合 / 瘴气 +4 层' + (m.boss && m.boss.rebirthKnown ? '（「枯萎中蜕生」发动后变成「腐殖乐园」，同时附加其中 2 项）' : ''); } },
  { k: 'weed', t: '除草机', h: '除草机', d: function (m) { var d0 = (m.boss && m.boss.weedDmg) || 30; return '每回合结束时附带 ' + d0 + ' 点固定伤害，每回合 +2（对草系精灵伤害翻倍）' + (m.boss && m.boss.rebirthKnown ? '。「枯萎中蜕生」发动后变成「抹除装置」：伤害定格在当时数值的 1.5 倍，不再增长' : ''); } },
  { k: 'rebirth', t: '枯萎中蜕生', h: '枯萎中蜕生', hide: function (m) { return !m.boss.rebirthKnown; }, d: function () { return '体力首次低于 2500 时发动：恢复 1000 体力，并对敌方造成其最大体力 30% 的固定伤害；「腐殖质」「除草机」从此分别变成「腐殖乐园」「抹除装置」'; } }
];
/* 困难泰戈尔「东北的往事」：第一次被击败时不屈复活（只复活一次）
 * 复活：LV60、体力 3000（回满），清掉能力等级和异常状态；东北的纷争 → 永续的纷争（物攻 +60%、受伤 +20%），新增往日重现，场地变成沈阳大街（双方都不能用变化技能）
 * 复活前插一段小剧情（事件 scene，由界面播放） */
var TIGER_PAST = [
  ['n', '泰戈尔重重地倒在地上。就在大家以为分出胜负的时候，它的爪子动了一下。'],
  ['tg', '……嘿。好些年没让人撂倒过了。'],
  ['tg', '想当年在沈阳大街上，俺可不是啥武学宗师。就是个愣头青，天天跟人约架，谁也不服，谁也不怕。'],
  ['tg', '那会儿哪有啥招式套路，挨一拳就还一拳，摔倒了拍拍土站起来接着干！'],
  ['tg', '宗师的架子，今儿个先放一边。老铁，接下来跟你打的——是当年那个泰戈尔！'],
  ['n', '泰戈尔的眼睛亮了起来。它扯掉身上的护具，又一次站了起来。']
];
function reviveTiger(S, evs, j, t) {
  var b = t.boss; b.revived = 1;
  E(S, evs, 'scene', { side: j, lines: TIGER_PAST, fx: 'past' });
  b.pastKnown = 1;
  TIGER_PAST.forEach(function (l) { log(S, evs, (l[0] === 'tg' ? '泰戈尔：' : '') + l[1], 'fxl'); });
  t.lv = 60; t.maxhp = t.hp = 3000; if (!pureFieldActive(S)) t.stages = blankStages(); t.st = {}; t.fx.poison = 0;
  delete b.feud; b.eternal = 1; b.relive = 1; b.sy = 1; RV(t, 'past'); RV(t, 'sy');
  t.stats.atk = Math.floor((b.atk0 || t.stats.atk) * 1.6);
  t.nick = '热血·' + (t.nick || sp(t).name).replace(/^热血·/, '');
  if (typeof AWAKE_SPRITES !== 'undefined' && AWAKE_SPRITES[t.id]) t.img = AWAKE_SPRITES[t.id];   // 换成复活后的形态，一直保持到战斗结束
  [0, 1].forEach(function (i) { S.sides[i].team.forEach(function (m) { if (!m.flags) m.flags = {}; m.flags.sy = 1; }); });
  log(S, evs, '「东北的往事」：' + nm(t) + '不屈地复活了！（体力 3000）', 'crit');
  log(S, evs, '「东北的纷争」变成了「永续的纷争」：物攻永久提升 60%，但受到的伤害增加 20%', 'fxl');
  log(S, evs, nm(t) + '觉醒了「往日重现」：受到攻击时有 50% 的概率让对方陷入烧伤、冻伤或中毒', 'fxl');
  log(S, evs, '场地变成了「沈阳大街」：双方都不能使用变化类技能！', 'bad');
  E(S, evs, 'heal', { side: j, amount: 3000 });
}
function bossOf(S) { var t = S.sides[1].team; for (var i = 0; i < t.length; i++) if (t[i].boss) return t[i]; return null; }
var PUPPETS = ['mush', 'wind', 'kaleo'];
function puppetCd(m) { return m.hp < 1000 ? 7 : 15; }
function puppetRoll(S) {
  var b = act(S, 1); if (!b.boss || !b.boss.puppet || b.fainted) return false;
  b.boss.now = S.turn;
  if (S.turn < 2 || (b.boss.last != null && S.turn - b.boss.last < puppetCd(b))) return false;
  return RNG() < 0.3;
}
// 傀儡只会攻击技能：从技能表里挑威力最高的 4 个（去掉只能命中中毒对手的渗透孢子）
function puppetMoves(id) {
  var s = SPMAP[id];
  return s.moves.concat(s.hidden).filter(function (n, i, a) { var m = M[n]; return m && a.indexOf(n) === i && m.cat !== '变化' && m.power > 1 && m.custom !== 'poisonHeart'; })
    .sort(function (a, b) { return (M[b].power || 0) - (M[a].power || 0); }).slice(0, 4);
}
function summonPuppet(S, evs) {
  RV(act(S, 1), 'puppet');
  var side = S.sides[1], b = act(S, 1), id = PUPPETS[Math.floor(RNG() * PUPPETS.length)], plv = (b.boss && b.boss.puppetLv) || 50;
  var m = mkFrom({ id: id, lv: plv, moves: puppetMoves(id), nick: '瘴毒傀儡·' + SPMAP[id].name, miasma: 10 });
  m.puppet = true; side.team.push(m);
  b.boss.last = S.turn;
  log(S, evs, nm(b) + '沉入地底，召唤出了瘴毒傀儡！', 'crit');
  doSwitch(S, evs, 1, side.team.length - 1, true);
}
/* 困难荒芜「枯萎中蜕生」：体力首次低于 2500 时触发（只触发一次）。
 * 恢复 1000 体力，对敌方造成其最大体力 30% 的固定伤害；「腐殖质」变成「腐殖乐园」（humusN 1→2，每回合同时附加 2 项负面效果）；
 * 「除草机」变成「抹除装置」：把触发那一刻的伤害数值 ×1.5 后冻结，不再逐回合增长（weedFrozen） */
function rebirthBarren(S, evs, j, t) {
  var b = t.boss; b.reborn = 1; b.rebirthKnown = 1;
  var i = 1 - j, foe = act(S, i);
  log(S, evs, nm(t) + '的身躯剧烈地颤动起来，枯萎的组织重新编织了一遍……「枯萎中蜕生」发动了！', 'crit');
  heal(S, evs, j, 1000);
  var dmg = Math.floor(foe.maxhp * 0.3);
  loseHp(S, evs, i, dmg, nm(t) + '释放出毁灭性的力量，对' + nm(foe) + '造成了 ' + dmg + ' 点固定伤害');
  b.humusN = 2;
  b.weedDmg = Math.round((b.weedDmg || 30) * 1.5);
  b.weedFrozen = 1;
  log(S, evs, '「腐殖质」化为了「腐殖乐园」：此后每回合会同时附加 2 项负面效果', 'fxl');
  log(S, evs, '「除草机」化为了「抹除装置」：固定伤害定格在 ' + b.weedDmg + '，不会再增长', 'fxl');
  E(S, evs, 'scene', { side: j, lines: [], fx: 'rebirth' });   // 给界面一个钩子：第一次发动时记进 acc.seenFx.rebirth（之后图鉴/BOSS页不再显示「？？？」），以及将来接《before the end》BGM 用
}
// 腐殖质 / 腐殖乐园：每回合结束时随机给对手附加 1 项（蜕生后 2 项）：速度-1 / 物攻-1 / 特攻-1 / 寄生3回合 / 瘴气+4层
var HUMUS_OPTS = ['spe', 'atk', 'spa', 'parasite', 'miasma'];
function humusField(S, evs) {
  var b = bossOf(S); if (!b || !b.boss || !b.boss.humus || b.fainted) return;
  RV(b, 'humus');
  var m = act(S, 0); if (m.fainted) return;
  var n = b.boss.humusN || 1, label = n > 1 ? '腐殖乐园' : '腐殖质';
  var pool = HUMUS_OPTS.slice(), picks = [];
  for (var c = 0; c < n && pool.length; c++) picks.push(pool.splice(Math.floor(RNG() * pool.length), 1)[0]);
  log(S, evs, nm(b) + '的「' + label + '」发动了！', 'fxl');
  picks.forEach(function (opt) {
    if (m.fainted) return;
    if (opt === 'parasite') addStatus(S, evs, 0, '寄生', 3, 1);
    else if (opt === 'miasma') { m.perm.miasma = miaN(m) + 4; E(S, evs, 'stage', { side: 0 }); log(S, evs, nm(m) + '受到瘴气侵染（瘴气 ×' + m.perm.miasma + '）', 'bad'); }
    else { var o = {}; o[opt] = -1; changeStages(S, evs, 0, o, 1); }
  });
}
// 除草机 / 抹除装置：每回合结束时附带固定伤害（除草机会逐回合 +2，抹除装置冻结不再增长），对草系精灵伤害翻倍
function weedField(S, evs) {
  var b = bossOf(S); if (!b || !b.boss || !b.boss.weed || b.fainted) return;
  RV(b, 'weed');
  var m = act(S, 0); if (m.fainted) return;
  var label = b.boss.weedFrozen ? '抹除装置' : '除草机', dmg = b.boss.weedDmg || 30;
  if (typesOf(m).indexOf('草') >= 0) dmg *= 2;
  loseHp(S, evs, 0, dmg, nm(b) + '的「' + label + '」对' + nm(m) + '造成了 ' + dmg + ' 点固定伤害');
  if (!b.boss.weedFrozen) b.boss.weedDmg = (b.boss.weedDmg || 30) + 2;
}
function miasmaField(S, evs) {
  var b = bossOf(S); if (!b || !b.boss.mia || b.fainted) return;
  RV(b, 'mia');
  var m = act(S, 0); if (m.fainted) return;
  m.perm.miasma = miaN(m) + 1; E(S, evs, 'stage', { side: 0 });
  log(S, evs, nm(b) + '的「瘴气领域」：' + nm(m) + '受到瘴气侵染（瘴气 ×' + m.perm.miasma + '）', 'bad');
}

/* ---------- 瘴气：每层使物攻、特攻 +5%，物防、特防 −5%（最低降到 10%），换下场也不消失 ---------- */
// 凋零之蚀：每层每回合损失 1/24 最大体力，可以无限叠加（旧存档里的 true 算 1 层）
var WITHER_DIV = 24, WITHER_MAX = 4;   // 凋零之蚀每层 1/24，最多 4 层
function witherN(m) { var w = m.perm && m.perm.wither; return w === true ? 1 : w > 0 ? w : 0; }
function witherDot(m) { return Math.max(1, Math.floor(m.maxhp * witherN(m) / WITHER_DIV)); }
function miaN(m) { return (m.perm && m.perm.miasma) || 0; }
function miaAtk(m) { return 1 + 0.05 * miaN(m); }
function miaDef(m) { return Math.max(0.1, 1 - 0.05 * miaN(m)); }
function miasmaTick(S, evs) {
  if (S.env !== 'miasma') return;
  [0, 1].forEach(function (i) {
    var m = act(S, i); if (m.fainted) return;
    m.perm.miasma = miaN(m) + 1;
    log(S, evs, nm(m) + '受到瘴气侵染（瘴气 ×' + m.perm.miasma + '）', 'fxl');
  });
}
/* ---------- 第十九段 · 码头决战玫瑰星云（2026-11-01） ----------
 * 星云带 boss.neb：开局放强烈恒星风（resolveTurn）、疏散星团（calcDamage）、尘埃柱（endOfTurn）、博克球状体（nebBok）
 * 玩家第一次被它打中后，Cumber 加入：全员获得【Cumberland】（m.cbl = 1）；之后每 3 回合 Cumber 轮流让戈耳贡 / 坎克托斯助阵
 * 玩家倒下第 2 只（或全倒）时，Cumber 插话、复活全员，Cumberland 再增幅 50%（m.cbl = 1.5），只发生一次 */
var RAND_ST = ['害怕', '石化', '睡眠', '麻痹', '冰冻', '寄生', '溺水', '流血', '中毒', '烧伤', '失明', '冻伤'];
function cblText(k) { return '体力上限 +' + Math.round(200 * k) + '，物攻、特攻 +' + Math.round(50 * k) + '%，受到的伤害减免 ' + (25 * k) + '%，每回合结束恢复 ' + Math.round(100 * k) + ' 体力'; }
var NEB_CB1 = [['cb', '别慌。这里是坎伯兰星——是我的领土。'], ['cb', '只要还站在这片海上，我就能把力量借给你们！'], ['n', '一股温暖的海流涌向了你的每一只精灵。全员获得了【Cumberland】！']];
var NEB_CB2 = [['cb', '你知道，这片土地为什么叫 Cumberland 吗？'], ['cb', '因为它就是我两百年经营的伟大之土！'], ['cb', '在我的土地上，谁也不许倒下——都给我站起来！'], ['n', '倒下的精灵全部站了起来。【Cumberland】的力量再次增幅了！']];
function coreRevive(S, evs, free) {   // free：剧情回顾 / 每天一次的免费复活（不碎圣晶石）   // 花 1 个圣晶石：全员复活（扣圣晶石在服务器 / 本机存档那边做）
  evs = evs || []; if (!S.needCore) return evs;
  S.needCore = 0; S.coreUsed = (S.coreUsed || 0) + 1;
  S.sides[0].team.forEach(function (m) { if (m.fainted) { m.fainted = false; clearVolatile(m); } m.hp = m.maxhp; });
  log(S, evs, free ? '耀眼的光芒笼罩了码头——你的精灵全部复活了！' : '圣晶石碎裂开来，耀眼的光芒笼罩了码头——你的精灵全部复活了！', 'good');
  E(S, evs, 'heal', { side: 0, amount: act(S, 0).hp }); E(S, evs, 'stage', { side: 0 });
  return evs;
}
function nebFight(S) { var m = S.sides[1].team.filter(function (x) { return x.boss && x.boss.neb; })[0]; return m || null; }
function nebReviveDue(S) {
  if (S.pvp || S.cbRev || !nebFight(S)) return false;
  var T = S.sides[0].team, dead = T.filter(function (m) { return m.fainted; }).length;
  return dead >= 2 || dead >= T.length;
}
function cblAdd(S, k) {   // 把全员的 Cumberland 提到 k 档；体力上限按差值增加
  S.sides[0].team.forEach(function (m) { var d = Math.round(200 * k) - Math.round(200 * (m.cbl || 0)); m.cbl = k; m.maxhp += d; if (!m.fainted) m.hp += d; });
}
function nebBok(S, evs, j, t) {
  t.boss.bokUsed = 1; RV(t, 'bok');
  log(S, evs, nm(t) + '的「博克球状体」：暗星云收缩成一团，吸回了力量！', 'crit');
  heal(S, evs, j, 500);
  if (!act(S, 1 - j).fainted) { log(S, evs, '收缩的星云爆开，冲击波扫向' + nm(act(S, 1 - j)), 'fxl'); applyDamage(S, evs, 1 - j, 200, null, {}); }
}
var NEB_P2 = [['n', '玫瑰星云的光芒忽然向内收拢。'], ['n', '四散的星尘被一点点压进内核……星云变得更加致密了！']];
var NEB_P3 = [['n', '玫瑰星云疯狂地汲取着周围的土地！'], ['n', '礁石、沙土、海床……一切都被卷进了星云里。'], ['n', '……量变引发了质变。星云再次变得能量漫溢！'], ['cb', '……它在吞我的土地？！'], ['cb', '休想！Cumberland，再增幅一次！']];
function nebPhase(S, evs, nb) {   // 击破一管后，回合结束换上下一管（第 3 管加 O 型星超温辐射、博克球状体，Cumberland 再增幅 50%）
  var B2 = nb.boss; B2.broken = 0; B2.bar = (B2.bar || 0) + 1;
  var L = B2.bar === 1 ? NEB_P2 : NEB_P3;
  E(S, evs, 'scene', { side: 1, lines: L }); L.forEach(function (l) { log(S, evs, (l[0] === 'cb' ? 'Cumber：' : '') + l[1], 'fxl'); });
  nb.maxhp = nb.hp = B2.bars[B2.bar];
  for (var sk in nb.st) delete nb.st[sk]; if (nb.fx) delete nb.fx.poison;
  STG.forEach(function (k) { if (nb.stages[k] < 0 && !pureFieldActive(S)) nb.stages[k] = 0; });
  E(S, evs, 'heal', { side: 1, amount: nb.hp });
  log(S, evs, nm(nb) + '换上了第 ' + (B2.bar + 1) + ' 管体力（' + nb.hp + '）！疏散星团变成了「' + CL_NAME[B2.bar] + '」', 'crit');
  if (B2.bar === 2) {
    B2.bok = 1; S.nebP3 = S.turn + 1;
    if (M['O型星超温辐射'] && !nb.moves.some(function (x) { return x.n === 'O型星超温辐射'; })) nb.moves.push({ n: 'O型星超温辐射', pp: 99, max: 99 });
    var ck = 1; S.sides[0].team.forEach(function (m) { if (m.cbl > ck) ck = m.cbl; });
    S.cblOn = 1; cblAdd(S, ck + 0.5);
    log(S, evs, '【Cumberland】再次增幅了：' + cblText(ck + 0.5), 'good');
  }
  E(S, evs, 'stage', { side: 0 }); E(S, evs, 'stage', { side: 1 });
}
function nebCumber(S, evs) {
  var nb = nebFight(S); if (!nb || S.pvp) return;
  if (nb.boss.broken) nebPhase(S, evs, nb);
  if (S.nebHit && !S.cblOn) {
    S.cblOn = 1; cblAdd(S, 1);
    E(S, evs, 'scene', { side: 0, lines: NEB_CB1 });
    NEB_CB1.forEach(function (l) { log(S, evs, (l[0] === 'cb' ? 'Cumber：' : '') + l[1], 'fxl'); });
    log(S, evs, '全员获得了【Cumberland】：' + cblText(1), 'good'); E(S, evs, 'stage', { side: 0 });
  }
  if (nebReviveDue(S)) {
    S.cbRev = 1; if (!S.cblOn) S.cblOn = 1;
    E(S, evs, 'scene', { side: 0, lines: NEB_CB2 });
    NEB_CB2.forEach(function (l) { log(S, evs, (l[0] === 'cb' ? 'Cumber：' : '') + l[1], 'fxl'); });
    cblAdd(S, 1.5);
    S.sides[0].team.forEach(function (m, k) { if (m.fainted) { m.fainted = false; clearVolatile(m); m.hp = m.maxhp; } });
    if (act(S, 0).fainted === false && act(S, 0).hp <= 0) act(S, 0).hp = act(S, 0).maxhp;
    log(S, evs, '你的精灵全部复活了！【Cumberland】增幅：' + cblText(1.5), 'good');
    E(S, evs, 'heal', { side: 0, amount: act(S, 0).hp }); E(S, evs, 'stage', { side: 0 });
  }
  if (S.turn % 3 === 0 && !nb.fainted) {   // Cumber 每 3 回合助阵一次，戈耳贡、坎克托斯轮流
    S.cbN = (S.cbN || 0) + 1;
    if (S.cbN % 2 === 1) {
      var pm = act(S, 0);
      if (!pm.fainted) {
        E(S, evs, 'scene', { side: 0, lines: [['cb', '戈耳贡啊，散播净化之水吧！']] }); log(S, evs, 'Cumber：戈耳贡啊，散播净化之水吧！', 'crit');
        var had = 0; for (var sk in pm.st) if (pm.st[sk] > 0 && ST_DESC[sk]) { delete pm.st[sk]; had++; }
        if (pm.fx) delete pm.fx.poison;
        if (had) log(S, evs, nm(pm) + '身上的异常状态都被冲走了', 'good');
        heal(S, evs, 0, 200);
        pm.tm.immune = Math.max(pm.tm.immune || 0, 2); log(S, evs, nm(pm) + '被净化之水包裹，2 回合内免疫异常状态', 'good'); E(S, evs, 'stage', { side: 0 });   // 2026-11-01：戈耳贡另送 2 回合异常免疫
      }
    } else {
      E(S, evs, 'scene', { side: 0, lines: [['cb', '坎克托斯啊，冲散你的敌人吧！']] }); log(S, evs, 'Cumber：坎克托斯啊，冲散你的敌人吧！', 'crit');
      applyDamage(S, evs, 1, 500, null, {});
      if (!nb.fainted && !nb.boss.broken) {   // 2026-11-01：坎克托斯另外随机降低星云双攻双防中的两项各 1 级
        var pool = ['atk', 'spa', 'def', 'spd'], dn = {}; for (var q = 0; q < 2; q++) dn[pool.splice(Math.floor(RNG() * pool.length), 1)[0]] = -1;
        changeStages(S, evs, 1, dn, 0); E(S, evs, 'stage', { side: 1 });
      }
    }
  }
}
function endOfTurn(S, evs) {
  S.curMove = null;
  // 星星魔法 / 残月之痕的「本次使用中」标记只在出招的这一回合有效，回合结束清掉，免得之后的威力预估（电脑估分、界面）少算一档
  S.sides.forEach(function (sd) { sd.team.forEach(function (m) { if (m.fx) { m.fx.starNow = 0; m.fx.canyueNow = 0; } }); });
  bombTick(S, evs);
  if (S.over) return;
  glenTick(S, evs);
  fateTick(S, evs);
  miasmaTick(S, evs);
  miasmaField(S, evs);
  humusField(S, evs);
  weedField(S, evs);
  var nbm = act(S, 1), pm0 = act(S, 0);
  if (nbm.boss && nbm.boss.dust && !nbm.fainted && !nbm.boss.broken && !pm0.fainted && RNG() < 0.3) { RV(nbm, 'dust'); log(S, evs, nm(nbm) + '的「尘埃柱」：星尘遮住了' + nm(pm0) + '的视线', 'fxl'); addStatus(S, evs, 0, '混乱', 2, 1); }
  if (pm0.cbl && !pm0.fainted && pm0.hp < pm0.maxhp) { log(S, evs, 'Cumberland 的海流包裹着' + nm(pm0), 'fxl'); heal(S, evs, 0, 100 * pm0.cbl); }
  [0, 1].forEach(function (i) { var m = act(S, i); if (!m.fainted && m.boss && m.boss.regen && m.hp < m.maxhp) { RV(m, 'regen'); log(S, evs, nm(m) + '的「再生」发动了', 'fxl'); heal(S, evs, i, m.maxhp * (m.boss.regen === true ? 0.06 : m.boss.regen)); } });   // 先驱之塔「再生」
  [0, 1].forEach(function (i) {
    var m = act(S, i); if (m.fainted) return;
    var o = act(S, 1 - i);
    var e8 = Math.max(1, Math.floor(m.maxhp / 8)), e10 = Math.max(1, Math.floor(m.maxhp / 10));
    if (m.st['寄生'] > 0) { var got = loseHp(S, evs, i, e10, nm(m) + '被寄生之种吸取了体力'); if (!o.fainted) heal(S, evs, 1 - i, got); }
    if (!m.fainted && m.st['溺水'] > 0) loseHp(S, evs, i, e10, nm(m) + '因溺水受到伤害');   // 2026-10-27：1/8 → 1/10
    if (!m.fainted && ability(m) === '脚伤') m.st['流血'] = 99;   // 第十一段 · 叶子喵的脚伤：永久流血，解不掉
    if (!m.fainted && m.st['流血'] > 0) loseHp(S, evs, i, 60, nm(m) + '因流血受到伤害');
    if (!m.fainted && m.st['中毒'] > 0) { var pz = m.fx.poison || 1; loseHp(S, evs, i, Math.max(1, Math.floor(m.maxhp * pz / 16)), nm(m) + '因中毒受到伤害' + (pz > 1 ? '（' + pz + ' 层）' : '')); }
    if (!m.fainted && m.st['烧伤'] > 0) loseHp(S, evs, i, e8, nm(m) + '因烧伤受到伤害');
    if (!m.fainted && m.st['冻伤'] > 0) loseHp(S, evs, i, e8, nm(m) + '因冻伤受到伤害');
    if (!m.fainted && m.perm.wither) loseHp(S, evs, i, witherDot(m), nm(m) + '被凋零之蚀侵蚀' + (witherN(m) > 1 ? '（' + witherN(m) + ' 层）' : ''));
    if (!m.fainted && m.tm.rain > 0 && !o.fainted) { log(S, evs, '雨水对' + nm(o) + '附加 30 点固定伤害', 'fxl'); S.dotSrc = '祈雨'; applyDamage(S, evs, 1 - i, 30, null, {}); S.dotSrc = null; }
    if (!m.fainted && m.tm.hail > 0 && !o.fainted) { log(S, evs, '冰雹砸向' + nm(o), 'fxl'); S.dotSrc = '冰雹'; applyDamage(S, evs, 1 - i, Math.floor(o.maxhp / 10), null, { percent: true }); S.dotSrc = null; }
    if (!m.fainted && m.tm.genggu > 0) { changeStages(S, evs, i, { spa: 1 }); heal(S, evs, i, m.maxhp / 6); }
    if (!m.fainted && m.tm.green > 0) heal(S, evs, i, (m.maxhp - m.hp) / 5);   // 已损失体力的 1/5
    if (!m.fainted && m.tm.calm > 0) { var ch = heal(S, evs, i, m.maxhp / 5), cq = hqR(m); cq.h['静谧水域'] = (cq.h['静谧水域'] || 0) + ch; if (cq.h['静谧水域'] >= m.maxhp * 0.6) hqGet(S, evs, m, '寂静之海'); }
    if (!m.fainted && m.tm.fenglei > 0 && !o.fainted) { if (RNG() < 0.5) { log(S, evs, '风雷滚滚拖慢了' + nm(o), 'fxl'); changeStages(S, evs, 1 - i, { spe: -1 }, i); } else { log(S, evs, '风雷滚滚推着' + nm(m) + '加速', 'fxl'); changeStages(S, evs, i, { spe: 1 }); } }
    if (!m.fainted && m.tm.vortex > 0 && !o.fainted) { log(S, evs, '闪电漩涡干扰了' + nm(o) + '的视线', 'fxl'); changeStages(S, evs, 1 - i, { acc: -1 }, i); }
    if (!m.fainted && m.tm.tide > 0 && m.fx.tideWait) delete m.fx.tideWait;   // 使用当回合不触发，从下回合末开始
    else if (!m.fainted && m.tm.tide > 0 && !o.fainted && !S.over) useMove(S, evs, i, M['黑雾潮汐'], -1, true);
    if (!m.fainted && m.tm.block > 0) m.fx.shield = Math.max(m.fx.shield || 0, 100);
    if (!m.fainted && m.tm.sirenOn === 1) {   // m 身上的海妖之歌唱完了；唱歌的 o 还在场才生效
      if (!o.fainted && S.sides[1 - i].active === m.fx.sirenBy) { log(S, evs, '海妖之歌唱完了，' + nm(m) + '失去了全部体力！', 'crit'); S.dotSrc = '海妖之歌'; applyDamage(S, evs, i, m.hp + (m.fx.shield || 0), null, { percent: true }); S.dotSrc = null; }
      else log(S, evs, '海妖之歌唱完了，但唱歌的精灵已经不在场上');
    }
    if (!m.fainted && m.tm.tcloud > 0 && !o.fainted && !S.over) { log(S, evs, '闪电云劈向' + nm(o), 'fxl'); S.dotSrc = '闪电云'; applyDamage(S, evs, 1 - i, 100, null, {}); S.dotSrc = null; }
    if (!m.fainted && m.tm.lmE > 0 && !o.fainted && !S.over) { var lmk = m.boss && m.boss.lmBoost ? 4 : 1; RV(m, 'lmBoost'); log(S, evs, nm(m) + '的「雷明」：电光对' + nm(o) + '造成 ' + 25 * lmk + ' 点固定伤害', 'fxl'); S.dotSrc = '雷明'; applyDamage(S, evs, 1 - i, 25 * lmk, null, {}); S.dotSrc = null; }
    if (!m.fainted && m.tm.lmL > 0 && m.hp < m.maxhp) heal(S, evs, i, 20 * (m.boss && m.boss.lmBoost ? 4 : 1));
    if (!m.fainted && m.boss && m.boss.nourish && m.hp < m.maxhp && !S.over) { RV(m, 'nourish'); log(S, evs, nm(m) + '的「养料汲取」发动了', 'fxl'); heal(S, evs, i, 50); }
    if (!m.fainted && ability(m) === '饭香' && !S.over && RNG() < 0.2) eatRice(S, evs, i, nm(m) + '的「饭香」发动了，吃了一口米饭');
    if (!m.fainted && ability(m) === '爆燃' && m.fx.atkT !== S.turn && (m.fx.charge || 0) < 3 && !S.over) { m.fx.charge = (m.fx.charge || 0) + 1; E(S, evs, 'stage', { side: i }); log(S, evs, nm(m) + '的「爆燃」蓄力了（' + m.fx.charge + ' / 3），下一次攻击伤害 +' + m.fx.charge * 10 + '%', 'fxl'); }
    if (!m.fainted) m.fx.fieldT = (m.fx.fieldT || 0) + 1;
  });
  // 两方回合末行动结算完毕后，绫彩统一兑现本回合的PP损失
  [0, 1].forEach(function (i) {
    var m = act(S, i), lost = m.fx.rainbowPP || 0;
    if (lost && !m.fainted && ability(m) === '绫彩') {
      log(S, evs, nm(m) + '的「绫彩」恢复了体力（对方损失' + lost + '点PP）', 'fxl');
      heal(S, evs, i, lost * 15);
    }
  });
  S.sides.forEach(function (sd) { sd.team.forEach(function (m) { delete m.fx.rainbowPP; }); });
  [0, 1].forEach(function (i) {
    var m = act(S, i); if (m.fainted) return;
    if (m.fx.prideShield && m.fx.prideShield.until <= S.turn) { delete m.fx.prideShield; log(S, evs, nm(m) + '的孤王之傲护盾消失了'); }
    for (var s in m.st) { if (m.st[s] > 0 && --m.st[s] <= 0) { delete m.st[s]; if (s === '中毒') delete m.fx.poison; log(S, evs, nm(m) + '的「' + s + '」状态解除了'); } }
    for (var t in m.tm) {
      if (RHYTHMS[t]) continue;
      if (m.tm[t] > 0 && --m.tm[t] <= 0) {
        delete m.tm[t];
        if (t === 'darkside') { log(S, evs, nm(m) + '离开了月之暗面，恢复原来的属性'); moonSwitch(S, evs, i); }
      }
    }
  });
  // BOSS 奥多亚克（困难）：歼灭形态、护阵形态每两回合主动切换一次（另一个形态还在的话）
  var osw = S.sides[1], om = act(S, 1);
  if (!S.over && om && !om.fainted && om.boss && om.boss.odoSwap && S.turn % 2 === 0) {
    RV(om, 'odoSwap');
    var oth = osw.active === 0 ? 1 : osw.active === 1 ? 0 : -1;
    if (oth >= 0 && osw.team[oth] && !osw.team[oth].fainted) { log(S, evs, nm(om) + '切换了形态！', 'fxl'); doSwitch(S, evs, 1, oth, true); }
  }
  E(S, evs, 'stage', { side: 0 });
}
