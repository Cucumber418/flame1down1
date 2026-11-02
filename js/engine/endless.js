/* ==========================================================
 * 无尽作战（2026-11-02，飞船终端右侧）
 *
 * 一次作战 = 3 个大关卡，每个大关卡 15 小关（第 15 关是 BOSS）。通关 3 个大关卡解锁下一级难度（共 10 级），开局可以选已解锁的难度。
 * 开局从自己的精灵里挑最多 20 只（练度在开局时固定下来），每场战斗从里面派最多 5 只。
 * 体力不会在战斗之间回满（PP 会），倒下的精灵这次作战里不能再上场，身上的装备脱落回背包。
 * 每赢一关选下一个节点：战斗 / 精英 / 奖励 / 商店 / 碰碰运气。每个大关卡开始时有一段剧情事件（Vanber / Threego / Bttp / Cumber）。
 * 失败回到这个大关卡的起点（大关卡开始时自动存档）。随时可以结束作战，按这次走到的最远进度发经验和无尽代币。
 *
 * 存档：a.endless = { maxD 已解锁的最高难度, best: { 难度: 最远进度 }, runs 次数, clr: { 难度: 通关次数 }, run }
 *   run = { d, st 第几个大关卡(0..2), n 本大关卡已过的小关数(0..15), gems 无尽宝石, ros: [出战名单], abil: [能力], cons: { 消耗品: 数量 },
 *           bag: [没装上的装备], path: [[每个大关卡走过的节点]], next: [可选的下一节点], cur: 当前节点, pend: 待处理的面板,
 *           evs: [用过的剧情事件], vb Vanber 好感, vbOn 这个大关卡有没有遇到 Vanber, vbDone, prog 最远进度, ck 大关卡起点的存档 }
 *   ros[i] = { u, sid, spec: 对战用的资料（开局时固定）, im: { lv, ins, insX } 刻印, hpr 剩余体力比例, dead, eq: [装备 ×3] }
 * 所有改动走交易（TX：enStart、enEv、enGo、enPick、enBuy、enChat、enLeave、enEquip、enUneq、enQuit、enShop），
 * 战斗走 PVE.MODES.endless（服务器结算，见 server/pve.js）。对战里的能力 / 消耗品 / 装备效果由 battle.js 的 en* 函数结算。
 * ========================================================== */
var ENDLESS = (function () {
  'use strict';
  var D_MAX = 10, STAGES = 3, NODES = 15, GEM0 = 200, ROSTER_MAX = 20, LINE_MAX = 5;
  function no(msg) { return { ok: false, err: msg }; }
  function int(v) { return typeof v === 'number' && isFinite(v) && v === Math.floor(v) ? v : NaN; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pick(L, r) { return L[Math.floor(r() * L.length) % L.length]; }
  function shuffle(L, r) { L = L.slice(); for (var i = L.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = L[i]; L[i] = L[j]; L[j] = t; } return L; }

  /* ---------- 奖励大全 ----------
   * tier：1 普通 2 珍稀 3 传奇；kind：once 选了立刻生效 / equip 装备 / abil 能力 / cons 消耗品；price：商店基础价格（无尽宝石）
   * ic：图标 [形状, 颜色, 字]。数值的结算：once 在这里，其余在 battle.js（enUse / enEndTurn / enSync 等） */
  var IT = {
    c_cumber: { n: 'Cumber的祝福', tier: 1, kind: 'once', price: 50, d: '选择后立即生效：名单里所有存活的精灵恢复 20% 最大体力', ic: ['orb', '#3aa7a0', '祝'] },
    eq_heal8: { n: '愈疗金粒', tier: 1, kind: 'equip', price: 90, d: '装备：在场时每回合结束恢复 8% 最大体力', ic: ['gem', '#e8b830'] },
    cs_flag: { n: '纷争旗帜', tier: 1, kind: 'cons', price: 55, d: '消耗品：本场战斗我方全体伤害 +25%', ic: ['ticket', '#c42f3a', '旗'] },
    cs_fumo: { n: 'fumo炸弹', tier: 1, kind: 'cons', price: 70, d: '消耗品：对对方在场的精灵造成其最大体力 40% 的固定伤害', ic: ['orb', '#e86a8a', '炸'] },
    eq_pp3: { n: '活力轮盘', tier: 1, kind: 'equip', price: 70, d: '装备：在场时每 3 回合，每个技能恢复 1 点 PP', ic: ['coin', '#5b8fd0', '轮'] },
    ab_pow15: { n: '力量暴涨', tier: 1, kind: 'abil', price: 120, d: '能力：每场战斗可以发动一次，发动后本场我方全员伤害 +15%（整次作战都可以用）', ic: ['flask', '#e8603c', '力'] },
    cs_mia: { n: '瘴气侵蚀', tier: 1, kind: 'cons', price: 50, d: '消耗品：给对手全体附加 10 层瘴气（防御大幅下降，但攻击也会上升）', ic: ['orb', '#7b5ac8', '瘴'] },
    cs_burn5: { n: '引燃', tier: 1, kind: 'cons', price: 40, d: '消耗品：让对方在场的精灵烧伤 5 回合', ic: ['flask', '#e8603c', '燃'] },
    cs_burn10: { n: '强力引燃', tier: 1, kind: 'cons', price: 75, d: '消耗品：让对方在场的精灵烧伤 10 回合', ic: ['flask', '#c42f3a', '燃'] },
    cs_poi2: { n: '投毒', tier: 1, kind: 'cons', price: 40, d: '消耗品：让对方在场的精灵中毒 2 层，持续 5 回合', ic: ['flask', '#8a5ac8', '毒'] },
    cs_poi3: { n: '强力投毒', tier: 1, kind: 'cons', price: 75, d: '消耗品：让对方在场的精灵中毒 3 层，持续 7 回合', ic: ['flask', '#5b3a8a', '毒'] },
    cs_crit: { n: '引爆', tier: 1, kind: 'cons', price: 60, d: '消耗品：我方在场的精灵 3 回合内攻击必定致命一击', ic: ['orb', '#f2c94c', '爆'] },
    cs_shield: { n: '护盾发生器', tier: 1, kind: 'cons', price: 50, d: '消耗品：我方在场的精灵获得 25% 最大体力的护盾', ic: ['box', '#5b8fd0', '盾'] },
    eq_hp10: { n: '坚韧护符', tier: 1, kind: 'equip', price: 70, d: '装备：最大体力 +10%', ic: ['gem', '#4caf50'] },
    eq_heal12: { n: '愈疗宝石', tier: 2, kind: 'equip', price: 170, d: '装备：在场时每回合结束恢复 12% 最大体力', ic: ['gem', '#3b8fd9'] },
    eq_pp2: { n: '永动轮盘', tier: 2, kind: 'equip', price: 150, d: '装备：在场时每 2 回合，每个技能恢复 1 点 PP', ic: ['coin', '#3b6fd0', '轮'] },
    ab_ares1: { n: '阿瑞斯冲击', tier: 2, kind: 'abil', price: 210, d: '能力：每场战斗可以发动一次。发动后，我方每次主动攻击有 50% 概率在回合末追加一次「阿瑞斯打击」，造成 60 点固定伤害', ic: ['flask', '#b5452c', '阿'] },
    ab_pow20: { n: '力量之泉', tier: 2, kind: 'abil', price: 230, d: '能力：每场战斗可以发动一次，发动后本场我方全员伤害 +20%', ic: ['flask', '#c42f3a', '泉'] },
    eq_dmg20: { n: '锋锐之牙', tier: 2, kind: 'equip', price: 170, d: '装备：造成的伤害 +20%', ic: ['gem', '#c42f3a'] },
    c_cumber2: { n: 'Cumber的厚礼', tier: 2, kind: 'once', price: 120, d: '选择后立即生效：名单里所有存活的精灵恢复 50% 最大体力', ic: ['orb', '#2f8f86', '礼'] },
    cs_horn: { n: '疾风号角', tier: 2, kind: 'cons', price: 90, d: '消耗品：我方在场的精灵速度 +2 级', ic: ['ticket', '#5b7fc4', '风'] },
    eq_heal16: { n: '愈疗圣物', tier: 3, kind: 'equip', price: 330, d: '装备：在场时每回合结束恢复 16% 最大体力', ic: ['gem', '#c9a227'] },
    ab_echo: { n: '回响形态', tier: 3, kind: 'abil', price: 460, d: '能力：每场战斗可以发动一次。发动后，我方每释放 4 次技能，会再额外释放一次', ic: ['orb', '#8f4fd0', '响'] },
    ab_soul: { n: '超度形态', tier: 3, kind: 'abil', price: 380, d: '能力：每场战斗可以发动一次。发动后，每击败一只敌人，吸收它 30% 最大体力为在场的精灵回复', ic: ['orb', '#5a7aa8', '度'] },
    ab_ghost: { n: '幽灵形态', tier: 3, kind: 'abil', price: 420, d: '能力：每场战斗可以发动一次。发动后，每 3 回合有 1 回合必定闪避对方的攻击', ic: ['orb', '#9aa3b5', '灵'] },
    ab_combo: { n: '凡响连击', tier: 3, kind: 'abil', price: 480, d: '能力：每场战斗可以发动一次。发动后，连续攻击时（不必是同一个技能）每次伤害 +20%，可以无限叠加；用变化技能、道具或换人会中断', ic: ['orb', '#e8603c', '连'] },
    ab_ares2: { n: '阿瑞斯爆裂', tier: 3, kind: 'abil', price: 460, d: '能力：每场战斗可以发动一次。发动后，我方每次主动攻击一定在回合末追加一次「阿瑞斯打击」，造成 100 点固定伤害', ic: ['flask', '#7a1f1f', '裂'] },
    eq_gorgon: { n: '戈尔贡的祝福', tier: 3, kind: 'equip', price: 0, ev: 1, d: '装备：最大体力 +30%（Cumber 的赠礼）', ic: ['drop', '#3b8fd9'] },
    eq_ketos: { n: '坎克托斯的祝福', tier: 3, kind: 'equip', price: 0, ev: 1, d: '装备：造成的伤害 +30%（Cumber 的赠礼）', ic: ['gem', '#2f6fa8'] }
  };
  var TIER_NAME = ['', '普通', '珍稀', '传奇'];
  var KIND_NAME = { once: '立即生效', equip: '装备', abil: '能力', cons: '消耗品' };
  // 能力、消耗品要能在对战里当「道具」用：登记进 battle.js 的 ITEMS（en: true）；装备也登记名字和说明（状态栏显示用）
  if (typeof ITEMS !== 'undefined') Object.keys(IT).forEach(function (k) { if (IT[k].kind !== 'once') ITEMS[k] = { name: IT[k].n, en: true, d: IT[k].d }; });
  function poolOf(tier, kinds, a) { return Object.keys(IT).filter(function (k) { var x = IT[k]; return x.tier === tier && !x.ev && (!kinds || kinds.indexOf(x.kind) >= 0) && !(x.kind === 'abil' && a && a.abil.indexOf(k) >= 0); }); }
  function rollTier(w, r) { var x = r() * (w[0] + w[1] + w[2]); return x < w[0] ? 1 : x < w[0] + w[1] ? 2 : 3; }
  function rollItem(run, w, kinds, r) {
    var t = rollTier(w, r), L = poolOf(t, kinds, run);
    for (var tt = t; !L.length && tt > 0; tt--) L = poolOf(tt, kinds, run);
    if (!L.length) L = poolOf(1, null, run);
    return pick(L, r);
  }

  /* ---------- 敌人的增益（越往后越强） ----------
   * q：深度（0 ~ 约 1.6，进度和难度一起算）；fam：同一类只给一个 */
  var BUFFS = [
    { k: 'eAtk', v: 0.15, q: 0, fam: 'atk' }, { k: 'eDr', v: 0.15, q: 0, fam: 'dr' }, { k: 'regen', v: 0.05, q: 0, fam: 'regen' }, { k: 'thorn', v: 1, q: 0, fam: 'ref' },
    { k: 'eAtk', v: 0.3, q: 0.4, fam: 'atk' }, { k: 'eDr', v: 0.3, q: 0.4, fam: 'dr' }, { k: 'eRef', v: 0.25, q: 0.4, fam: 'ref' }, { k: 'noStatus', v: 1, q: 0.4, fam: 'st' }, { k: 'eSt', v: 0.5, q: 0.4, fam: 'st' }, { k: 'fixRes', v: 0.5, q: 0.5, fam: 'fix' },
    { k: 'rPhys', v: 0.5, q: 0.8, fam: 'ref' }, { k: 'rSpec', v: 0.5, q: 0.8, fam: 'ref' }, { k: 'noStatF', v: 1, q: 0.8, fam: 'ns' }, { k: 'swift', v: 1, q: 0.9, fam: 'swift' },
    { k: 'noPhys', v: 1, q: 1.15, fam: 'imm' }, { k: 'noSpec', v: 1, q: 1.15, fam: 'imm' }, { k: 'noNormal', v: 1, q: 1.4, fam: 'imm', big: 1 }
  ];
  function rollBuffs(n, q, big, r) {
    var fams = {}, out = {};
    for (var t = 0; t < n; t++) {
      var L = BUFFS.filter(function (b) { return b.q <= q && !fams[b.fam] && (!b.big || big); });
      if (!L.length) break;
      var hi = L.filter(function (b) { return b.q >= q - 0.5; }), b = pick(hi.length && r() < 0.6 ? hi : L, r);
      fams[b.fam] = 1; out[b.k] = b.v;
    }
    return out;
  }
  var BUFF_NAME = { eAtk: '增伤', eDr: '受伤减免', regen: '再生', thorn: '荆棘', eRef: '反弹', noStatus: '免疫异常', eSt: '异常抗性', fixRes: '固伤减免', rPhys: '反弹物攻', rSpec: '反弹特攻', noStatF: '禁止变化', swift: '疾行', noPhys: '免疫物攻', noSpec: '免疫特攻', noNormal: '免疫常规伤害' };
  function buffText(b) {
    return Object.keys(b || {}).filter(function (k) { return BUFF_NAME[k]; }).map(function (k) { var v = b[k]; return BUFF_NAME[k] + (typeof v === 'number' && v < 1 && v > 0 && k !== 'regen' ? ' ' + Math.round(v * 100) + '%' : ''); });
  }

  /* ---------- 存档 ---------- */
  function rec(a) { if (!a.endless || typeof a.endless !== 'object') a.endless = { maxD: 1, best: {}, clr: {}, runs: 0, run: null }; var E = a.endless; if (!(E.maxD >= 1)) E.maxD = 1; if (!E.best) E.best = {}; if (!E.clr) E.clr = {}; return E; }
  function run(a) { return rec(a).run; }
  function alive(R) { return R.ros.filter(function (x) { return !x.dead; }); }
  function prog(R) { return R.st * NODES + R.n; }
  function depth(R) { var g = prog(R) / (STAGES * NODES - 1), dd = (R.d - 1) / (D_MAX - 1); return { p: Math.min(1, g), dd: dd, q: Math.min(1, g) * 0.6 + dd }; }
  function snapshot(R) { var c = clone(R); delete c.ck; return c; }
  var NODE = { battle: { n: '战斗', ic: '⚔' }, elite: { n: '精英', ic: '☠' }, reward: { n: '奖励', ic: '🎁' }, shop: { n: '商店', ic: '🛒' }, gamble: { n: '碰碰运气', ic: '🎲' }, boss: { n: 'BOSS', ic: '👑' } };
  /* 大地图（2026-11-02，参考杀戮尖塔）：每个大关卡开始时生成。cols[c] = [{ t, y }]（y：0~1 的纵向位置），
   * links[c][i] = [下一列能走到的节点]。第 1 列都是战斗，最后一列是同一个 BOSS。R.pos：当前所在节点（这一列的序号），R.trail：走过的节点 */
  function pickT(W, r) { var tot = W.reduce(function (s, x) { return s + x[1]; }, 0), x = r() * tot; for (var j = 0; j < W.length; j++) { x -= W[j][1]; if (x < 0) return W[j][0]; } return W[0][0]; }
  function makeMap(r) {
    var cols = [], links = [];
    for (var c = 0; c < NODES; c++) {
      if (c === NODES - 1) { cols.push([{ t: 'boss', y: 0.5 }]); break; }
      var k = c === 0 ? 3 : 2 + Math.floor(r() * 3), col = [];
      for (var i = 0; i < k; i++) {
        var W = c === NODES - 2 ? [['shop', 30], ['reward', 25], ['battle', 30], ['gamble', 15]] : c < 3 ? [['battle', 60], ['reward', 12], ['shop', 10], ['gamble', 18]] : [['battle', 44], ['elite', 13], ['reward', 12], ['shop', 13], ['gamble', 18]];
        col.push({ t: c === 0 ? 'battle' : pickT(W, r), y: k === 1 ? 0.5 : 0.1 + 0.8 * i / (k - 1) + (r() - 0.5) * 0.08 });
      }
      cols.push(col);
    }
    for (c = 0; c < cols.length - 1; c++) {
      var A = cols[c], B = cols[c + 1], L = A.map(function () { return []; }), has = B.map(function () { return 0; });
      A.forEach(function (n, i) {
        var j = A.length === 1 ? 0 : Math.round(i * (B.length - 1) / (A.length - 1)); L[i].push(j); has[j] = 1;
        if (r() < 0.35) { var j2 = Math.max(0, Math.min(B.length - 1, j + (r() < 0.5 ? -1 : 1))); if (L[i].indexOf(j2) < 0) { L[i].push(j2); has[j2] = 1; } }
      });
      has.forEach(function (h, j) { if (h) return; var best = 0, bd = 9; A.forEach(function (n, i) { var d = Math.abs(n.y - B[j].y); if (d < bd) { bd = d; best = i; } }); L[best].push(j); });
      L.forEach(function (x) { x.sort(); });
      links.push(L);
    }
    for (c = 1; c < cols.length - 1; c++) cols[c].forEach(function (n, i) {   // 精英不连续出现、商店不扎堆（简单处理：同一条路上前一个是精英就换成战斗）
      if (n.t !== 'elite') return;
      var prevElite = cols[c - 1].some(function (p, pi) { return p.t === 'elite' && links[c - 1][pi].indexOf(i) >= 0; });
      if (prevElite) n.t = 'battle';
    });
    return { cols: cols, links: links };
  }
  function genNext(R, r) {
    if (!R.map) { R.map = makeMap(r); R.pos = null; R.trail = []; }   // 旧版本开始的作战：补一张地图
    var c = R.n, M = R.map;
    if (c >= M.cols.length) { R.next = []; return; }
    if (c === 0 || R.pos == null || !M.links[c - 1] || !M.links[c - 1][R.pos]) R.next = M.cols[c].map(function (x, i) { return i; });
    else R.next = M.links[c - 1][R.pos].slice();
  }
  function gemsFor(R, t) { return t === 'boss' ? 220 + 40 * R.st : t === 'elite' ? 110 + 25 * R.st : 50 + 12 * R.st; }

  /* ---------- 敌人 ---------- */
  function spPool() {
    var L = (typeof SP !== 'undefined' ? SP : []).concat(typeof EXTRA_SP !== 'undefined' ? EXTRA_SP : []);
    return L.filter(function (s) { return s && s.id && s.id !== 'dummy' && !s.placeholder && typeof SPRITES !== 'undefined' && SPRITES[s.id] && s.base; }).map(function (s) { return s.id; });
  }
  // 敌人等级（2026-11-02 改）：只跟这次作战的进度有关，从 LV40 涨到 LV80（最后的 BOSS）；难度只影响增益和能力。
  // 例外：难度 7、8 最高到 LV100；难度 9 到 LV120、难度 10 到 LV140（超过 100 级显示「LV.??」）
  function lvTop(d) { return d >= 10 ? 140 : d >= 9 ? 120 : d >= 7 ? 100 : 80; }
  function foeLv(R) { var D = depth(R); return Math.round(40 + (lvTop(R.d) - 40) * D.p); }
  function makeFoes(R, t, r) {
    var D = depth(R), lv = foeLv(R), P = spPool(), n = 1, out = [];
    if (t === 'battle') n = prog(R) < 4 ? 1 : Math.min(4, 1 + Math.floor(D.p * 2 + D.dd + r() * 0.9));
    else if (t === 'elite') n = D.p > 0.5 ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var sid = pick(P, r), f = ACC.form({ sid: sid, lv: lv }), nb = 0, big = t !== 'battle';
      if (t === 'battle') nb = Math.min(4, Math.floor(D.p * 2.5 + D.dd * 2 + r()));
      else if (t === 'elite') nb = Math.min(5, 1 + Math.floor(D.p * 2.5 + D.dd * 2 + r()));
      else nb = Math.min(6, 2 + Math.floor(D.p * 2.5 + D.dd * 2 + r()));
      var b = rollBuffs(nb, D.q, big, r);
      var x = { id: sid, lv: lv, lvq: lv > 100 ? 1 : 0, moves: t === 'battle' ? ACC.foeMoves(sid, lv, null, r) : ACC.defaultMoves(sid, lv), nick: (t === 'boss' ? '首领 · ' : t === 'elite' ? '精英 · ' : '') + f.name, img: f.img, boss: b };
      if (t !== 'battle') { x.boss.pp = 99; x.mult = t === 'boss' ? 1.2 + 0.15 * D.dd : 1.1 + 0.1 * D.dd; }
      if (t === 'boss') x.maxhp = Math.round((1400 + 1100 * R.st) * (1 + 1.2 * D.dd));
      if (t === 'elite') x.hpMul = 2.5;
      out.push(x);
    }
    return out;
  }

  /* ---------- 奖励面板 ---------- */
  function pickOpts(R, from, r) {
    var o = [];
    if (from === 'reward') { for (var i = 0; i < 5; i++) o.push({ k: rollItem(R, [50, 38, 12], null, r) }); return { t: 'pick', from: from, opts: uniq(o), need: 1, got: [] }; }
    if (from === 'boss') { var L = shuffle(poolOf(3, null, R), r).slice(0, 4); return { t: 'pick', from: from, opts: L.map(function (k) { return { k: k }; }), need: 2, got: [] }; }
    var el = from === 'elite', w = el ? [45, 45, 10] : [78, 20, 2];
    o.push({ k: 'heal', n: el ? 0.5 : 0.3 });
    o.push({ k: 'gems', n: (el ? 90 : 45) + 15 * R.st });
    o.push({ k: rollItem(R, w, ['cons'], r) });
    o.push({ k: rollItem(R, w, ['equip', 'abil'], r) });
    o.push({ k: rollItem(R, w, null, r) });
    return { t: 'pick', from: from, opts: uniq(o), need: 2, got: [] };
  }
  function uniq(o) { var seen = {}; return o.filter(function (x) { var key = x.k + ':' + (x.n || ''); if (seen[key] && IT[x.k] && IT[x.k].kind === 'abil') return false; seen[key] = 1; return true; }); }
  function healAll(R, f) { alive(R).forEach(function (x) { x.hpr = Math.min(1, (x.hpr || 0) + f); }); }
  function grant(R, k, n) {
    if (k === 'heal') { healAll(R, n); return; }
    if (k === 'gems') { R.gems += n; return; }
    var x = IT[k]; if (!x) return;
    if (x.kind === 'once') { if (k === 'c_cumber') healAll(R, 0.2); if (k === 'c_cumber2') healAll(R, 0.5); return; }
    if (x.kind === 'abil') { if (R.abil.indexOf(k) < 0) R.abil.push(k); return; }
    if (x.kind === 'cons') { R.cons[k] = (R.cons[k] || 0) + 1; return; }
    if (x.kind === 'equip') R.bag.push(k);
  }
  function optName(o) { return o.k === 'heal' ? '补给：全员恢复 ' + Math.round(o.n * 100) + '% 体力' : o.k === 'gems' ? '无尽宝石 ×' + o.n : IT[o.k] ? IT[o.k].n : o.k; }

  /* ---------- 商店 ---------- */
  function makeShop(R, r) {
    var L = [], used = {};
    [[1, 4], [2, 4], [3, 2]].forEach(function (g) {
      var P = shuffle(poolOf(g[0], null, R), r).filter(function (k) { return !used[k]; }).slice(0, g[1]);
      P.forEach(function (k) { used[k] = 1; L.push({ k: k, price: Math.round(IT[k].price * (0.9 + r() * 0.2) / 5) * 5, sold: 0 }); });
    });
    L.push({ k: 'heal', n: 0.3, price: 60, sold: 0 });
    return { t: 'shop', list: L, vb: !!(R.vbOn && !R.vbDone), chat: 0 };
  }

  /* ---------- 剧情事件 ---------- */
  var PLANETS = [
    { n: '芙罗拉星', hint: '我昨晚梦见他躺在一大片草地上，身上全是叶子的味道……' },
    { n: '坎伯兰星', hint: '我总觉得他在一个湿漉漉的地方，说话都带着海风的咸味。' },
    { n: '庞贝星', hint: '我有种感觉，他现在一定热得满头大汗……' },
    { n: '莱汀陨石带', hint: '我梦里一直听见噼里啪啦的声音，头发都竖起来了。' },
    { n: '白之星', hint: '最近我老是打喷嚏，好像他在什么很冷很冷的地方。' }
  ];
  var VB_TALK = [
    { q: '好久不见！你在飞船上有没有好好复习？下次月考我可不会再让着你了。', o: [['当然，第一名还是我的', 10], ['我每天都在刷黄冈秘鉴', 30], ['月考？那是什么，能吃吗', 20]] },
    { q: '你的精灵状态看起来不错嘛。要不要比一比谁的队伍更强？', o: [['你的队伍才是最强的', 30], ['比就比，谁怕谁', 20], ['今天不想比', 5]] },
    { q: '食堂今天的热干面好难吃……我好想念武汉的早餐。', o: [['等回地球我请你过早', 30], ['我觉得还行啊', 5], ['我带了周黑鸭，分你一点', 25]] }
  ];
  var VB_SHOP = [
    { q: 'Vanber 也在逛商店：「这个看起来不错，你说我买不买？」', o: [['买！我觉得很适合你', 25], ['再看看吧', 10]] },
    { q: 'Vanber 冲你挥手：「刚才那场打得真漂亮！」', o: [['多亏你之前教我的', 25], ['小意思', 10]] },
    { q: 'Vanber 小声说：「我宝石不够了……」', o: [['我分你一点宝石吧', 30, 30], ['加油，下一关就有了', 10]] }
  ];
  var EVS = ['vanber', 'threego', 'bttp', 'cumber'];
  function newEvent(R, r) {
    var L = EVS.filter(function (k) { return R.evs.indexOf(k) < 0; }); if (!L.length) L = EVS.slice();
    var k = pick(L, r); R.evs.push(k);
    if (k === 'vanber') { R.vbOn = 1; return { t: 'ev', k: k, i: Math.floor(r() * VB_TALK.length) }; }
    if (k === 'threego') { var two = shuffle(PLANETS.map(function (p, i) { return i; }), r).slice(0, 2), ans = two[Math.floor(r() * 2)]; return { t: 'ev', k: k, two: two, ans: ans }; }
    if (k === 'bttp') return { t: 'ev', k: k, tries: 0, got: [] };
    return { t: 'ev', k: k };
  }
  function vbAdd(R, n, r) {
    if (R.vbDone) return '';
    R.vb = Math.min(100, (R.vb || 0) + n);
    if (R.vb >= 100) { R.vbDone = 1; R.gems += 500; var L = poolOf(3, null, R), k = pick(L, r); grant(R, k); return k; }
    return '';
  }
  function stageStart(R, r) { R.n = 0; R.next = null; R.cur = null; R.vbOn = 0; R.path[R.st] = []; R.map = makeMap(r); R.pos = null; R.trail = []; R.pend = newEvent(R, r); }
  function afterEvent(R, r) { R.pend = null; genNext(R, r); R.ck = snapshot(R); }

  /* ---------- 结算 ---------- */
  function settle(a, R, cleared) {
    var E = rec(a), p = Math.max(R.prog || 0, prog(R)), sc = Math.floor(p / NODES), k = 1 + 0.25 * (R.d - 1);
    var exp = Math.round((p * 1200 + sc * 12000) * k), tok = Math.round((p * 3 + sc * 40) * k);
    a.exp = (a.exp || 0) + exp; if (!a.items) a.items = {}; a.items.enTok = (a.items.enTok || 0) + tok;
    E.best[R.d] = Math.max(E.best[R.d] || 0, p);
    var unlock = false;
    if (cleared) { E.clr[R.d] = (E.clr[R.d] || 0) + 1; if (R.d >= E.maxD && E.maxD < D_MAX) { E.maxD = R.d + 1; unlock = true; } }
    E.run = null;
    return { exp: exp, tok: tok, p: p, sc: sc, unlock: unlock, cleared: !!cleared, d: R.d };
  }

  /* ---------- 交易 ---------- */
  function needRun(a) { var R = run(a); return R ? null : no('现在没有进行中的无尽作战'); }
  if (typeof TX !== 'undefined') {
    TX.add('enStart', function (a, args, env) {
      var E = rec(a); if (E.run) return no('上一次作战还没结束');
      var d = int(args.d); if (!(d >= 1 && d <= E.maxD)) return no('这个难度还没解锁');
      var us = Array.isArray(args.us) ? args.us : [], seen = {}, ros = [];
      us.forEach(function (u) { u = int(u); var m = ACC.mon(a, u); if (!m || seen[u] || ros.length >= ROSTER_MAX) return; seen[u] = 1; ros.push({ u: u, sid: m.sid, spec: ACC.battleMon(a, m), im: { lv: m.lv, ins: Array.isArray(m.ins) ? m.ins.slice() : null, insX: m.insX || 0 }, hpr: 1, dead: 0, eq: [] }); });
      if (!ros.length) return no('至少要选 1 只精灵');
      var R = { d: d, st: 0, n: 0, gems: GEM0, ros: ros, abil: [], cons: {}, bag: [], path: [[]], next: null, cur: null, pend: null, evs: [], vb: 0, vbOn: 0, vbDone: 0, prog: 0, t0: env.now };
      E.run = R; E.runs = (E.runs || 0) + 1;
      stageStart(R, env.rand);
      return { ok: true };
    });
    TX.add('enEv', function (a, args, env) {
      var R = run(a), P = R && R.pend; if (!P || P.t !== 'ev') return no('现在没有剧情事件');
      var o = int(args.o), out = { ok: true };
      if (P.k === 'vanber') { var T = VB_TALK[P.i]; if (!T || !T.o[o]) return no('选项不对'); out.vb = T.o[o][1]; out.vbGift = vbAdd(R, T.o[o][1], env.rand); out.fav = R.vb; afterEvent(R, env.rand); }
      else if (P.k === 'threego') { if (o !== 0 && o !== 1) return no('选项不对'); var right = P.two[o] === P.ans; out.right = right; out.ans = PLANETS[P.ans].n; if (right) R.gems += 300; else alive(R).forEach(function (x) { x.hpr = Math.max(0.01, x.hpr * 0.85); }); afterEvent(R, env.rand); }
      else if (P.k === 'bttp') {
        if (o === 1 || P.got.length >= 2) { afterEvent(R, env.rand); out.left = true; }
        else {
          alive(R).forEach(function (x) { x.hpr = Math.max(0.01, x.hpr - 0.05); }); P.tries++;
          var ch = Math.min(0.9, 0.15 + 0.15 * P.tries); out.tries = P.tries;
          if (env.rand() < ch) { var k = rollItem(R, [0, 1, 0], null, env.rand); grant(R, k); P.got.push(k); out.got = k; }
          if (P.got.length >= 2) { out.woke = true; afterEvent(R, env.rand); }
        }
      }
      else if (P.k === 'cumber') { if (o !== 0 && o !== 1) return no('选项不对'); var g = o === 0 ? 'eq_gorgon' : 'eq_ketos'; R.bag.push(g); out.got = g; afterEvent(R, env.rand); }
      return out;
    });
    TX.add('enGo', function (a, args, env) {
      var R = run(a); if (!R) return no('现在没有进行中的无尽作战');
      if (R.pend || R.cur) return no('先处理完当前的节点');
      if (!R.map || (R.next && typeof R.next[0] === 'string')) genNext(R, env.rand);   // 旧版本开始的作战
      var i = int(args.i); if (!R.next || R.next.indexOf(i) < 0 || !R.map.cols[R.n] || !R.map.cols[R.n][i]) return no('从这里走不到那个节点');
      var t = R.map.cols[R.n][i].t, r = env.rand, out = { ok: true, t: t }; R.next = null; R.pos = i; R.trail.push(i);
      if (t === 'battle' || t === 'elite' || t === 'boss') { R.cur = { t: t, foes: makeFoes(R, t, r) }; return out; }
      R.path[R.st].push(t); R.n++; R.prog = Math.max(R.prog || 0, prog(R));
      if (t === 'reward') R.pend = pickOpts(R, 'reward', r);
      else if (t === 'shop') R.pend = makeShop(R, r);
      else {   // 碰碰运气
        var x = r(), msg = '', got = null;
        if (x < 0.3) { var g = 80 + Math.floor(r() * 121); R.gems += g; msg = '你在角落里捡到一袋无尽宝石：+' + g; }
        else if (x < 0.55) { got = rollItem(R, [70, 28, 2], null, r); grant(R, got); msg = '你发现了一个补给箱：获得「' + IT[got].n + '」'; }
        else if (x < 0.7) { alive(R).forEach(function (q) { q.hpr = Math.max(0.01, q.hpr - 0.1); }); msg = '踩到了陷阱！名单里存活的精灵各损失 10% 最大体力'; }
        else if (x < 0.85) { healAll(R, 0.25); msg = '找到一处温泉，名单里存活的精灵恢复 25% 最大体力'; }
        else if (x < 0.95) { var lose = Math.min(R.gems, 50); R.gems -= lose; msg = '一只调皮的叶子喵叼走了 ' + lose + ' 颗无尽宝石'; }
        else { got = rollItem(R, [0, 0, 1], null, r); grant(R, got); msg = '大吉！你捡到了传奇道具「' + IT[got].n + '」'; }
        R.pend = { t: 'msg', text: msg, got: got };
      }
      return out;
    });
    TX.add('enPick', function (a, args, env) {
      var R = run(a), P = R && R.pend; if (!P || P.t !== 'pick') return no('现在没有可以选的奖励');
      var i = int(args.i);
      if (args.skip) { while (P.got.length < P.need) P.got.push(-1); }
      else { if (!(i >= 0 && i < P.opts.length) || P.got.indexOf(i) >= 0) return no('选项不对'); P.got.push(i); grant(R, P.opts[i].k, P.opts[i].n); }
      var out = { ok: true };
      if (P.got.length >= P.need) {
        R.pend = null;
        if (P.from === 'boss') {
          if (R.st >= STAGES - 1) { out.end = settle(a, R, true); return out; }
          R.st++; stageStart(R, env.rand); out.stage = R.st;
        } else genNext(R, env.rand);
      }
      return out;
    });
    TX.add('enBuy', function (a, args, env) {
      var R = run(a), P = R && R.pend; if (!P || P.t !== 'shop') return no('现在不在商店里');
      var i = int(args.i), L = P.list[i]; if (!L || L.sold) return no('没有这件商品');
      if (R.gems < L.price) return no('无尽宝石不够');
      if (IT[L.k] && IT[L.k].kind === 'abil' && R.abil.indexOf(L.k) >= 0) return no('已经有这个能力了');
      R.gems -= L.price; L.sold = 1; grant(R, L.k, L.n);
      return { ok: true };
    });
    TX.add('enChat', function (a, args, env) {
      var R = run(a), P = R && R.pend; if (!P || P.t !== 'shop' || !P.vb || P.chat) return no('Vanber 不在这里');
      if (P.vq == null) P.vq = Math.floor(env.rand() * VB_SHOP.length);
      var T = VB_SHOP[P.vq], o = int(args.o); if (args.peek) return { ok: true, q: P.vq };
      if (!T.o[o]) return no('选项不对');
      if (T.o[o][2] && R.gems < T.o[o][2]) return no('宝石不够');
      if (T.o[o][2]) R.gems -= T.o[o][2];
      P.chat = 1; var gift = vbAdd(R, T.o[o][1], env.rand);
      return { ok: true, vb: T.o[o][1], fav: R.vb, vbGift: gift };
    });
    TX.add('enLeave', function (a, args, env) {
      var R = run(a), P = R && R.pend; if (!P || (P.t !== 'shop' && P.t !== 'msg')) return no('现在没有要离开的地方');
      R.pend = null; genNext(R, env.rand); return { ok: true };
    });
    TX.add('enEquip', function (a, args, env) {
      var R = run(a); if (!R) return no('现在没有进行中的无尽作战');
      var b = int(args.b), r0 = R.ros[int(args.r)];
      if (!(b >= 0 && b < R.bag.length)) return no('背包里没有这件装备');
      if (!r0 || r0.dead) return no('这只精灵不能装备');
      if (r0.eq.length >= 3) return no('装备槽已经满了（最多 3 件）');
      r0.eq.push(R.bag.splice(b, 1)[0]); return { ok: true };
    });
    TX.add('enUneq', function (a, args, env) {
      var R = run(a); if (!R) return no('现在没有进行中的无尽作战');
      var r0 = R.ros[int(args.r)], s = int(args.s); if (!r0 || !(s >= 0 && s < r0.eq.length)) return no('没有这件装备');
      R.bag.push(r0.eq.splice(s, 1)[0]); return { ok: true };
    });
    TX.add('enQuit', function (a, args, env) {
      var R = run(a); if (!R) return no('现在没有进行中的无尽作战');
      return { ok: true, end: settle(a, R, false) };
    });
    TX.add('enShop', function (a, args, env) {   // 无尽代币商店：限定刻印
      var k = String(args.k || ''), T = TOK_SHOP.filter(function (x) { return x.k === k; })[0]; if (!T) return no('没有这件商品');
      if (!a.items) a.items = {}; if ((a.items.enTok || 0) < T.price) return no('无尽代币不够');
      a.items.enTok -= T.price; a.items[k] = (a.items[k] || 0) + 1; return { ok: true };
    });
  }
  // 无尽代币商店（先上限定刻印，之后再补）
  var TOK_SHOP = ['ins_grass', 'ins_water', 'ins_fire', 'ins_elec', 'ins_ice'].map(function (k) { return { k: k, price: 400 }; });

  /* ---------- 对战（服务器结算） ---------- */
  if (typeof PVE !== 'undefined') PVE.MODES.endless = {
    start: function (a, args, env) {
      var R = run(a); if (!R || !R.cur || R.pend) return { err: '现在没有要打的关卡' };
      var line = Array.isArray(args.line) ? args.line : [], seen = {}, L = [];
      line.forEach(function (v) { v = int(v); var x = R.ros[v]; if (!x || x.dead || seen[v] || L.length >= LINE_MAX) return; seen[v] = 1; L.push(v); });
      if (!L.length) return { err: '至少派 1 只还能战斗的精灵' };
      var items = {}; R.abil.forEach(function (k) { items[k] = 1; }); Object.keys(R.cons).forEach(function (k) { if (R.cons[k] > 0) items[k] = R.cons[k]; });
      var a2 = R.cur.foes.map(function (f) { return clone(f); });
      var t = R.cur.t, lab = '难度 ' + R.d + ' · 第 ' + (R.st + 1) + ' 大关 · 第 ' + (R.n + 1) + ' 关';
      return { p: L.map(function (v) { return clone(R.ros[v].spec); }), a: a2, noItems: true, S: { items: items, en: { on: {}, combo: 0 }, endless: 1 },
        ctx: { line: L, items0: clone(items), t: t, key: R.st + ':' + R.n },
        opt: { foe: '无尽作战', diff: lab + (t === 'boss' ? ' · BOSS' : t === 'elite' ? ' · 精英' : ''), bgm: t === 'boss' ? (R.st >= STAGES - 1 ? 'mingFinal2' : 'mingFinal1') : t === 'elite' ? 'mingBattle2' : 'mingBattle1', back: '无尽作战' } };   // 2026-11-02：配乐用明明教官的试炼系列
    },
    post: function (S, c, a) {   // 开打后：刻印（开局时的）、装备、剩余体力
      var R = run(a); if (!R) return;
      S.sides[0].team.forEach(function (bm, k) {
        var x = R.ros[c.line[k]]; if (!x) return;
        if (typeof SUMMON !== 'undefined' && x.im) SUMMON.insApply(bm, x.im);
        bm.eq = x.eq.slice();
        var mul = 1; bm.eq.forEach(function (q) { if (q === 'eq_gorgon') mul += 0.3; if (q === 'eq_hp10') mul += 0.1; });
        if (mul !== 1) bm.maxhp = Math.round(bm.maxhp * mul);
        bm.hp = Math.max(1, Math.round(bm.maxhp * Math.min(1, x.hpr)));
      });
      S.sides[1].team.forEach(function (bm, k) {   // 精英：体力倍率；增益一开始就亮出来
        var f = R.cur && R.cur.foes[k]; if (f && f.hpMul) bm.maxhp = bm.hp = Math.round(bm.maxhp * f.hpMul);
        if (bm.boss) { bm.boss.seen = bm.boss.seen || {}; Object.keys(bm.boss).forEach(function (q) { if (BUFF_NAME[q]) bm.boss.seen[q] = 1; }); }
      });
      if (typeof enSync === 'function') enSync(S);
    },
    end: function (a, c, B, env) {
      var R = run(a), rep = { res: B.res, quit: !!B.quit };
      if (!R || !R.cur || (c.key && c.key !== R.st + ':' + R.n)) return rep;
      if (B.res === 'win') {
        var lost = [];
        B.S.sides[0].team.forEach(function (bm, k) {
          var x = R.ros[c.line[k]]; if (!x) return;
          if (bm.fainted || bm.hp <= 0) { x.dead = 1; x.hpr = 0; R.bag = R.bag.concat(x.eq); x.eq = []; lost.push(x.u); }
          else x.hpr = Math.max(0.01, bm.hp / bm.maxhp);
        });
        Object.keys(c.items0).forEach(function (k) { if (IT[k] && IT[k].kind === 'cons') { var left = (B.S.items && B.S.items[k]) || 0, used = Math.max(0, c.items0[k] - left); R.cons[k] = Math.max(0, (R.cons[k] || 0) - used); if (!R.cons[k]) delete R.cons[k]; } });
        var t = R.cur.t, g = gemsFor(R, t); R.gems += g;
        R.path[R.st].push(t); R.n++; R.prog = Math.max(R.prog || 0, prog(R)); R.cur = null;
        R.pend = pickOpts(R, t === 'boss' ? 'boss' : t, env.rand);
        rep.gems = g; rep.lost = lost; rep.t = t;
      } else {   // 失败（认输也算）：回到这个大关卡的起点
        if (R.ck) { var keep = R.prog || 0, ck = clone(R.ck); ck.prog = Math.max(ck.prog || 0, keep); ck.ck = clone(R.ck); rec(a).run = ck; }
        else R.cur = null;
        rep.back = true;
      }
      return rep;
    }
  };

  return { D_MAX: D_MAX, STAGES: STAGES, NODES: NODES, GEM0: GEM0, ROSTER_MAX: ROSTER_MAX, LINE_MAX: LINE_MAX, IT: IT, TIER_NAME: TIER_NAME, KIND_NAME: KIND_NAME, NODE: NODE, BUFF_NAME: BUFF_NAME, buffText: buffText,
    lvTop: lvTop, rec: rec, run: run, alive: alive, prog: prog, foeLv: foeLv, optName: optName, PLANETS: PLANETS, VB_TALK: VB_TALK, VB_SHOP: VB_SHOP, TOK_SHOP: TOK_SHOP };
})();
if (typeof module !== 'undefined') module.exports = ENDLESS;
