/* ==========================================================
 * 刻印 + 召唤（2026-11-01）
 *
 * 刻印：每只精灵 3 个刻印槽。第 1 个默认开放，第 2 个 LV60 开放，第 3 个用「刻印激活晶片」开启（m.insX = 1）。
 *   刻印是道具（ins_*），装备时从储存箱里扣掉，记在 m.ins[槽位] 上，从此和这只精灵绑定（换上新的，旧的就没了）。
 *   只在 PVE 生效：服务器开 PVE 对战时（server/pve.js 的 startMode，排位、切磋除外）调用 insApply 加到对战精灵身上。
 *   常规刻印加能力值；限定刻印（圣晶石召唤）体力 +25，另有特效，写在对战精灵的 insFx 上，由 battle.js 结算：
 *     grass 恢复量 +15%；water 受到攻击后 20% 降低对方物攻 / 特攻随机一项 1 级；fire 连击数 15% +1；
 *     elec 每回合开始 20% 速度 +1；ice 受到攻击时 20% 减免 20 点伤害。同一种特效装两个也只算一次。
 *
 * 召唤（荆楚号右边的「召唤」）：
 *   圣晶石召唤：3 圣晶石一次、30 圣晶石十连；每抽 10 次（付费的）送 1 次免费召唤；每抽送 10 召唤代币，抽到当期 UP 再送 200。
 *     当期 UP 精灵的精元 5%（第 36 抽起每抽 +6%，第 50 抽必出，抽到后重新计数）；其他奖励见 SAINT_POOL。
 *   友情点召唤：100 友情点一次、1000 友情点十连，每天第一次十连免费。奖励见 FRIEND_POOL。
 *   召唤代币商店：20 → 1 圣晶石（每月 30 次）；100 → 100 个当期 UP 精灵的专属道具；100 → 当期限定刻印自选一个（每月 5 次）。
 *   以后换 UP：在 BANNERS 末尾加一期（from 是开始日期），旧的自动下架。
 * 友情点：好友之间每天送一次经验（双方各 200 友情点），借助战双方各 100（每天有上限）。由服务器记账（server/friendpt.js），
 *   交易 fpClaim 领取。
 * ========================================================== */
var SUMMON = (function () {
  'use strict';
  function items(a) { if (!a.items || typeof a.items !== 'object') a.items = {}; return a.items; }
  function no(msg) { return { ok: false, err: msg }; }
  function int(v) { return typeof v === 'number' && isFinite(v) && v === Math.floor(v) ? v : NaN; }
  function pickW(L, r) { var tot = 0, i; for (i = 0; i < L.length; i++) tot += L[i].w; var x = r * tot; for (i = 0; i < L.length; i++) { x -= L[i].w; if (x < 0) return L[i]; } return L[L.length - 1]; }

  /* ---------- 刻印 ---------- */
  var STATS = [['hp', '体力', '体'], ['atk', '物攻', '攻'], ['def', '物防', '防'], ['spa', '特攻', '特'], ['spd', '特防', '抗'], ['spe', '速度', '速']];
  var INS = {}, INS_NORMAL1 = [], INS_NORMAL2 = [];
  STATS.forEach(function (s) {
    var a = {}, b = {}; a[s[0]] = s[0] === 'hp' ? 20 : 15; b[s[0]] = s[0] === 'hp' ? 50 : 30;
    INS['ins_' + s[0] + '1'] = { name: '初级' + s[1] + '刻印', st: a, tier: 1, ch: s[2] }; INS_NORMAL1.push('ins_' + s[0] + '1');
    INS['ins_' + s[0] + '2'] = { name: '强效' + s[1] + '刻印', st: b, tier: 2, ch: s[2] }; INS_NORMAL2.push('ins_' + s[0] + '2');
  });
  INS.ins_grass = { name: '灵魄之草', st: { hp: 25 }, fx: 'grass', lim: 1, ch: '草', fd: '恢复量 +15%' };
  INS.ins_water = { name: '幽静之水', st: { hp: 25 }, fx: 'water', lim: 1, ch: '水', fd: '受到攻击后有 20% 几率降低对方物攻、特攻中随机 1 项 1 级' };
  INS.ins_fire = { name: '不息之火', st: { hp: 25 }, fx: 'fire', lim: 1, ch: '火', fd: '连击时，连击数有 15% 几率 +1' };
  INS.ins_elec = { name: '迅疾之电', st: { hp: 25 }, fx: 'elec', lim: 1, ch: '电', fd: '每回合开始时有 20% 几率提升 1 级速度' };
  INS.ins_ice = { name: '肃穆之冰', st: { hp: 25 }, fx: 'ice', lim: 1, ch: '冰', fd: '每回合受到攻击时有 20% 几率减免 20 点伤害' };
  var STAT_NAME = {}; STATS.forEach(function (s) { STAT_NAME[s[0]] = s[1]; });
  function insDesc(k) { var I = INS[k]; if (!I) return ''; var p = Object.keys(I.st).map(function (s) { return STAT_NAME[s] + ' +' + I.st[s]; }); if (I.fd) p.push(I.fd); return p.join('，'); }
  var INS_LV2 = 60;
  function insRec(m) { if (!Array.isArray(m.ins)) m.ins = [null, null, null]; while (m.ins.length < 3) m.ins.push(null); return m.ins; }
  function slotOpen(m, i) { return i === 0 || (i === 1 && m.lv >= INS_LV2) || (i === 2 && !!m.insX); }
  function slotLock(m, i) { return slotOpen(m, i) ? '' : i === 1 ? 'LV' + INS_LV2 + ' 开放' : '用刻印激活晶片开启'; }
  // 对战精灵（newBattle 之后）加上刻印：bm 是对战里的精灵，m 是存档里的精灵
  function insApply(bm, m) {
    if (!bm || !m || !Array.isArray(m.ins)) return;
    var add = {}, fx = {};
    m.ins.forEach(function (k, i) { var I = INS[k]; if (!I || !slotOpen(m, i)) return; for (var s in I.st) add[s] = (add[s] || 0) + I.st[s]; if (I.fx) fx[I.fx] = k; });
    if (add.hp) { bm.maxhp += add.hp; bm.hp += add.hp; }
    if (bm.stats) ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (s) { if (add[s]) bm.stats[s] += add[s]; });
    if (Object.keys(fx).length) bm.insFx = fx;
  }
  // { u, i, k }：把刻印 k 装进 i 号槽（原来有的会被替换掉）
  TX.add('ins', function (a, args, env) {
    var m = ACC.mon(a, int(args.u)), i = int(args.i), k = String(args.k || ''), I = items(a);
    if (!m) return no('找不到这只精灵');
    if (!(i >= 0 && i < 3)) return no('没有这个刻印槽');
    if (!slotOpen(m, i)) return no('这个刻印槽还没开放（' + slotLock(m, i) + '）');
    if (!INS[k] || !(I[k] > 0)) return no('没有这个刻印了');
    var R = insRec(m), old = R[i];
    I[k]--; R[i] = k;
    return { ok: true, old: old };
  });
  // { u }：用 1 个刻印激活晶片开启第 3 个刻印槽
  TX.add('insX', function (a, args, env) {
    var m = ACC.mon(a, int(args.u)), I = items(a);
    if (!m) return no('找不到这只精灵');
    if (m.insX) return no('第 3 个刻印槽已经开启了');
    if (!(I.insChip > 0)) return no('没有刻印激活晶片');
    I.insChip--; m.insX = 1; insRec(m);
    return { ok: true };
  });

  /* ---------- 召唤 ---------- */
  // 每一期：up 是 UP 精灵，ess 是它的精元，leaf 是它的专属道具（代币商店卖），ins 是这一期的限定刻印
  var BANNERS = [
    { id: 's1', from: '2026-11-01', up: 'phantom', ess: 'e_phantom', leaf: 'phLeaf', ins: ['ins_grass', 'ins_water', 'ins_fire', 'ins_elec', 'ins_ice'] }
  ];
  function banner(now) { var d = ACC.dayStr(now), B = BANNERS[0]; BANNERS.forEach(function (x) { if (x.from <= d) B = x; }); return B; }
  var SAINT_COST = 3, FRIEND_COST = 100, TOK_EACH = 10, TOK_UP = 200, FREE_EVERY = 10, PITY_SOFT = 35, PITY_STEP = 0.06, PITY_HARD = 50, UP_RATE = 0.05;
  // 当前能获得的稀有精灵（野外标了 rare、奇声号角、神秘精灵）：圣晶石召唤 8% 抽到其中一只的精元
  function rareSids() { return Object.keys(SPMAP).filter(function (s) { return GROW.relTier(s) === 1 && GROW.HATCH['e_' + s]; }); }
  // UP 以外的奖励（总权重 95，加上 UP 的 5% 正好 100%）
  var SAINT_POOL = [
    { w: 8, k: 'rareEss' }, { w: 2, items: { insChip: 1 } }, { w: 12, k: 'limIns' },
    { w: 13, items: { natRand: 1 } }, { w: 8, items: { cap3: 1 } },
    { w: 22, exp: 20000 }, { w: 10, exp: 50000 }, { w: 10, energy: 3000 }, { w: 10, items: { g_sand: 60 } }
  ];
  // 友情点召唤（权重按千分比）：十连平均约 30000 经验、150 个星球特产、20 个星砂
  var FRIEND_ITEMS = [{ w: 40, k: 'fruit1' }, { w: 20, k: 'fruit2' }, { w: 25, k: 'ev50' }, { w: 15, k: 'evReset' }];
  var FRIEND_POOL = [
    { w: 350, exp: 5000 }, { w: 125, exp: 10000 }, { w: 300, k: 'gem', n: 50 }, { w: 100, items: { g_sand: 20 } },
    { w: 50, k: 'monItem' }, { w: 75, k: 'normIns' }
  ];
  function sumRec(a) { if (!a.sum || typeof a.sum !== 'object') a.sum = { n: 0, free: 0, pity: 0, fsDay: '', m: '', buy: {} }; if (!a.sum.buy) a.sum.buy = {}; return a.sum; }
  function upChance(pity) { return pity + 1 >= PITY_HARD ? 1 : pity + 1 > PITY_SOFT ? UP_RATE + (pity + 1 - PITY_SOFT) * PITY_STEP : UP_RATE; }
  function grant(a, g, out) {
    if (g.exp) a.exp = (a.exp || 0) + g.exp;
    if (g.energy) a.energy = (a.energy || 0) + g.energy;
    var I = items(a); for (var k in g.items || {}) I[k] = (I[k] || 0) + g.items[k];
    out.push(g);
  }
  function saintOne(a, B, rand, R) {
    var S = sumRec(a), out = null;
    if (rand() < upChance(S.pity)) { S.pity = 0; var it = {}; it[B.ess] = 1; out = { items: it, up: 1 }; }
    else {
      S.pity++;
      var p = pickW(SAINT_POOL, rand());
      if (p.k === 'rareEss') { var L = rareSids(), s = L[Math.floor(rand() * L.length)], i2 = {}; i2['e_' + s] = 1; out = { items: i2, rare: 1 }; }
      else if (p.k === 'limIns') { var ik = B.ins[Math.floor(rand() * B.ins.length)], i3 = {}; i3[ik] = 1; out = { items: i3, lim: 1 }; }
      else out = { exp: p.exp, energy: p.energy, items: p.items ? JSON.parse(JSON.stringify(p.items)) : undefined, chip: p.items && p.items.insChip ? 1 : undefined };
    }
    var I = items(a); I.sumTok = (I.sumTok || 0) + TOK_EACH + (out.up ? TOK_UP : 0);
    grant(a, out, R);
  }
  function friendOne(a, rand, R) {
    var p = pickW(FRIEND_POOL, rand()), out;
    if (p.k === 'gem') { var gk = GROW.GX_KEYS[Math.floor(rand() * GROW.GX_KEYS.length)], i1 = {}; i1[gk] = p.n; out = { items: i1 }; }
    else if (p.k === 'monItem') { var mi = pickW(FRIEND_ITEMS, rand()), i2 = {}; i2[mi.k] = 1; out = { items: i2 }; }
    else if (p.k === 'normIns') { var L = rand() < 0.9 ? INS_NORMAL1 : INS_NORMAL2, i3 = {}; i3[L[Math.floor(rand() * L.length)]] = 1; out = { items: i3, ins: 1 }; }
    else out = { exp: p.exp, items: p.items ? JSON.parse(JSON.stringify(p.items)) : undefined };
    grant(a, out, R);
  }
  // { pool: 'saint' | 'friend', n: 1 | 10, free }：free = 用免费次数（圣晶石召唤的累计赠送 / 友情点召唤的每日十连）
  TX.add('summon', function (a, args, env) {
    var pool = String(args.pool || ''), n = int(args.n), I = items(a), S = sumRec(a), R = [], B = banner(env.now), cost = 0, freeUsed = 0;
    if (n !== 1 && n !== 10) return no('召唤次数不对');
    if (pool === 'saint') {
      if (args.free) { if (n !== 1) return no('免费召唤一次只能抽一次'); if (!(S.free > 0)) return no('没有免费召唤次数'); S.free--; freeUsed = 1; }
      else { cost = SAINT_COST * n; if ((I.g_core || 0) < cost) return no('圣晶石不够：需要 ' + cost + ' 个'); I.g_core -= cost; }
      for (var i = 0; i < n; i++) saintOne(a, B, env.rand, R);
      if (!freeUsed) { var before = S.n; S.n += n; S.free += Math.floor(S.n / FREE_EVERY) - Math.floor(before / FREE_EVERY); }
      return { ok: true, list: R, cost: cost, free: freeUsed, pity: S.pity };
    }
    if (pool === 'friend') {
      var d = ACC.dayStr(env.now);
      if (args.free) { if (n !== 10) return no('每日免费的是十连'); if (S.fsDay === d) return no('今天的免费十连已经用过了'); S.fsDay = d; freeUsed = 1; }
      else { cost = FRIEND_COST * n; if ((I.fPt || 0) < cost) return no('友情点不够：需要 ' + cost + ' 点'); I.fPt -= cost; }
      for (var j = 0; j < n; j++) friendOne(a, env.rand, R);
      return { ok: true, list: R, cost: cost, free: freeUsed };
    }
    return no('没有这个召唤');
  });
  // 召唤代币商店：{ k: 'core' | 'leaf' | 'ins', n, ins }
  var TOK_SHOP = [
    { k: 'core', price: 20, give: function () { return { g_core: 1 }; }, month: 30 },
    { k: 'leaf', price: 100, give: function (B) { var o = {}; o[B.leaf] = 100; return o; } },
    { k: 'ins', price: 100, give: function (B, pick) { var o = {}; o[pick] = 1; return o; }, month: 5 }
  ];
  function monthKey(now) { return ACC.dayStr(now).slice(0, 7); }
  function boughtM(a, k, now) { var S = sumRec(a); if (S.m !== monthKey(now)) return 0; return S.buy[k] || 0; }
  TX.add('sumShop', function (a, args, env) {
    var T = TOK_SHOP.filter(function (x) { return x.k === args.k; })[0], n = int(args.n), I = items(a), S = sumRec(a), B = banner(env.now);
    if (!T) return no('没有这件商品');
    if (!(n >= 1 && n <= 99)) return no('数量不对');
    if (T.k === 'ins' && B.ins.indexOf(String(args.ins || '')) < 0) return no('先选一个刻印');
    if (T.month && boughtM(a, T.k, env.now) + n > T.month) return no('这个月最多兑换 ' + T.month + ' 次（还剩 ' + Math.max(0, T.month - boughtM(a, T.k, env.now)) + ' 次）');
    var cost = T.price * n; if ((I.sumTok || 0) < cost) return no('召唤代币不够');
    I.sumTok -= cost;
    if (S.m !== monthKey(env.now)) { S.m = monthKey(env.now); S.buy = {}; }
    if (T.month) S.buy[T.k] = (S.buy[T.k] || 0) + n;
    var g = T.give(B, String(args.ins || '')); for (var k in g) I[k] = (I[k] || 0) + g[k] * n;
    return { ok: true };
  });

  /* ---------- 友情点 ---------- */
  // 服务器记下的友情点（送经验、借助战）和好友送来的经验：领取时一起进账
  TX.add('fpClaim', function (a, args, env) {
    var r = (env.fetch && env.fetch('fp')) || null;
    if (!r || (!r.fp && !r.exp)) return { ok: true, fp: 0, exp: 0, gifts: [] };
    var I = items(a); I.fPt = (I.fPt || 0) + Math.max(0, r.fp | 0); a.exp = (a.exp || 0) + Math.max(0, r.exp | 0);
    return { ok: true, fp: r.fp | 0, exp: r.exp | 0, gifts: r.gifts || [] };
  });

  return { INS: INS, STATS: STATS, INS_NORMAL1: INS_NORMAL1, INS_NORMAL2: INS_NORMAL2, INS_LV2: INS_LV2, insDesc: insDesc, insRec: insRec, slotOpen: slotOpen, slotLock: slotLock, insApply: insApply,
    BANNERS: BANNERS, banner: banner, SAINT_COST: SAINT_COST, FRIEND_COST: FRIEND_COST, TOK_EACH: TOK_EACH, TOK_UP: TOK_UP, FREE_EVERY: FREE_EVERY, PITY_SOFT: PITY_SOFT, PITY_HARD: PITY_HARD, UP_RATE: UP_RATE,
    SAINT_POOL: SAINT_POOL, FRIEND_POOL: FRIEND_POOL, FRIEND_ITEMS: FRIEND_ITEMS, rareSids: rareSids, upChance: upChance, sumRec: sumRec, TOK_SHOP: TOK_SHOP, boughtM: boughtM };
})();
if (typeof module !== 'undefined') module.exports = SUMMON;
