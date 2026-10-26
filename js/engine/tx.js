/* ==========================================================
 * 交易规则（2026-10-24）：商城、各种代币商店、温泉、茶室扩容、矿石换能量、明明代币抽奖
 *
 * 这份文件服务器和浏览器都会加载，两边用的是同一套价格和规则：
 *   1. 玩家点「兑换 / 抽奖」时，浏览器先把请求发给服务器（js/net/cloud.js 的 CLOUD.tx）
 *   2. 服务器用这里的 TX.run 在它保存的存档上结算：检查余额、扣钱、发东西、写进存档（server/tx.js）
 *   3. 服务器把结算用到的随机数和时间发回来，浏览器用同样的随机数再跑一次 TX.run，两边结果完全一样
 * 双击本地 index.html 打开（没有服务器）时，浏览器直接自己结算。
 *
 * 改价格、加商品：只改这个文件里的 TX.D，界面会跟着变。
 * 加一种新的交易：在 OPS 里加一项，返回 { ok: true, ... } 或 { ok: false, err: '原因' }。
 * 注意：规则里只能用 env.now（时间）和 env.rand()（随机数），不要直接用 Date.now() / Math.random()，
 * 否则服务器和浏览器算出来的结果会不一样。
 * ========================================================== */
var TX = (function () {
  'use strict';

  /* ---------- 价格表 ---------- */
  var D = {
    // 荆门 · 物资仓储的商城（能量）：捕捉装置、补药的价格写在 battle.js 的 ITEMS 里
    SHOP: ['cap1', 'rename'],   // 2026-10-25：体力补药、强能体力补药下架
    SHOP_MAX: 99, RENAME_PRICE: 1000,
    // 竞技代币商店
    TOKEN_SHOP: [
      { k: 'moonStone', price: 2 }, { k: 'boneDust', price: 2 },   // 2026-10-18：小月亮、骨刃的隐藏技能和等级上限道具
      { k: 'ivMoon', price: 100 }, { k: 'ivBone', price: 100 }, { k: 'evAny', price: 100 },
      { k: 'fruit1', price: 30 }, { k: 'fruit2', price: 60 },
      { k: 'evReset', price: 80 },
      { k: 'ivReroll', price: 200 }
    ], TOKEN_MAX: 20,
    // 先驱之塔的代币商店（先驱代币；death 表示还要死神代币）
    TW_SHOP: [
      { k: 'floraJade', cost: 10 }, { k: 'kbDrop', cost: 10 }, { k: 'ppAsh', cost: 10 }, { k: 'ltOrb', cost: 10 }, { k: 'whFrost', cost: 10 }, { k: 'fruit2', cost: 60 }, { k: 'cap3', cost: 80 }, { k: 'evAny', cost: 150 }, { k: 'evReset', cost: 200 },
      { k: 'ivReroll', cost: 400 }, { k: 'natAny', cost: 2000 }, { k: 'e_pluto', cost: 3000, death: 1 }
    ],
    // 陆羽茶室大厅的茶室商店
    AUTO_PRICE: 1500, AUTO_MAX: 20, CAP_PRICE: [2000, 5000, 10000, 20000],
    // 温泉休息室
    SPA_JUICE: { price: 500, min: 30 }, SPA_EXTRA_MAX: 4,
    SPA_BGM: [{ k: 'spa', n: 'Spa', price: 0 }, { k: 'grassTalk', n: 'GrassTalk', price: 10000 }, { k: 'memory', n: 'Memory', price: 15000 }],
    // 三峡能源核心：矿石换能量
    MINE_PRICE: { m_cu: 150, m_fe: 250 }, MINE_CAP: 3000, DRILL_MAX: 80,
    // 明明代币抽奖：10 个抽一次；每天最多解锁 100 个新奖池
    MM_COST: 10, MM_POOL_DAY: 100
  };
  function spaSlotPrice(extra) { var e = extra || 0; return e >= D.SPA_EXTRA_MAX ? 0 : 3000 * Math.pow(3, e); }
  // 明明代币抽奖的第 n 个奖池：20 个固定奖励（学习力合剂一般是 50 的，每逢 4 的倍数的奖池是 100 的）
  function mmPool(n) {
    var P = [];
    [2000, 2000, 2000, 2000, 6000, 6000, 6000, 20000].forEach(function (e) { P.push({ exp: e }); });
    P[2] = { items: { pot100: 1 } }; P[3] = { items: { pp10: 1 } };   // 2026-10-27：两份 2000 经验换成 1 瓶 100hp药水、1 瓶 10PP药水
    [['floraJade', 10], ['floraJade', 10], ['ltOrb', 10], ['kbDrop', 10], ['ppAsh', 10], ['whFrost', 10], ['mmTok', 5], ['mmTok', 5], ['mmTok', 20], ['fruit2', 2], [n % 4 === 0 ? 'evAny' : 'ev50', 1], ['g_core', 1]].forEach(function (x) { var it = {}; it[x[0]] = x[1]; P.push({ items: it }); });
    if (n >= 5 && n % 5 === 0) P[0] = { items: { mmEye: 50 }, big: 1 };   // 第 5 个奖池起，每逢 5 的倍数：雷明之眼 ×50
    if (n >= 10 && n % 20 === 10) P[1] = { items: { e_leiming: 1 }, big: 1 };   // 第 10、30、50、70……个奖池：雷明灯的精元
    return P;
  }

  /* ---------- 存档里的几块记录（和 game.js 里同名函数做的事一样） ---------- */
  function bjDay(now) { var d = new Date(now + 8 * 3600e3); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }
  function dayNum(now) { return Math.floor((now + 8 * 3600e3) / 86400000); }
  function items(acc) { if (!acc.items || typeof acc.items !== 'object') acc.items = {}; return acc.items; }
  function give(acc, o) { var I = items(acc); for (var k in o) I[k] = (I[k] || 0) + o[k]; }
  function twRec(acc, now) {
    if (!acc.tower) acc.tower = { f: 1, cp: 1, best: 0, clears: 0, death: 0, tok: 0 };
    var T = acc.tower, d = bjDay(now); if (!T.day || T.day.d !== d) T.day = { d: d, exp: 0, tok: 0 };
    return T;
  }
  function mineRec(acc, now) {
    var day = dayNum(now);
    if (acc.mine && acc.mine.drill && !acc.drill) acc.drill = { dur: D.DRILL_MAX };   // 钻头改成永久之前领过的（当天有效那版）：直接给一个满耐久的
    if (!acc.mine || acc.mine.day !== day) acc.mine = { day: day, got: {}, ex: 0 };
    return acc.mine;
  }
  function mmRec(acc) { if (!acc.mm) acc.mm = { clr: {}, wins: 0 }; if (!acc.mm.clr) acc.mm.clr = {}; return acc.mm; }
  function mmG(acc, now) {
    var R = mmRec(acc), d = bjDay(now);
    if (!R.g) R.g = { n: 1, left: mmPool(1).map(function (x, i) { return i; }), d: d, opened: 0 };
    if (R.g.d !== d) { R.g.d = d; R.g.opened = 0; }
    if (Array.isArray(R.g.left)) R.g.left = R.g.left.filter(function (i) { return i >= 0 && i < 20; });   // 奖池短暂改成过 22 个，多出来的格子去掉
    return R.g;
  }
  function spaRec(acc) { if (!acc.spa || !Array.isArray(acc.spa.u)) acc.spa = { u: [], got: {} }; if (!acc.spa.got) acc.spa.got = {}; return acc.spa; }
  function num(v) { v = +v; return isFinite(v) ? v : 0; }
  function cnt(v, max) { return typeof v === 'number' && v === Math.floor(v) && v >= 1 && v <= max ? v : 0; }   // 数量必须是 1~max 的整数
  function price(k) { return k === 'rename' ? D.RENAME_PRICE : (typeof ITEMS !== 'undefined' && ITEMS[k] && ITEMS[k].price) || 0; }
  function no(err) { return { ok: false, err: err }; }

  /* ---------- 各种交易 ---------- */
  var OPS = {
    // 物资仓储商城：{ k, n }
    shop: function (acc, a) {
      var k = a.k, n = cnt(a.n, D.SHOP_MAX), p = price(k);
      if (D.SHOP.indexOf(k) < 0 || !p || !n) return no('没有这件商品');
      var cost = p * n; if (num(acc.energy) < cost) return no('能量不足');
      acc.energy = num(acc.energy) - cost; var o = {}; o[k] = n; give(acc, o);
      return { ok: true, k: k, n: n, cost: cost };
    },
    // 竞技代币商店：{ k, n }
    token: function (acc, a) {
      var T = D.TOKEN_SHOP.filter(function (x) { return x.k === a.k; })[0], n = cnt(a.n, D.TOKEN_MAX);
      if (!T || !n) return no('没有这件商品');
      var cost = T.price * n; if (num(acc.tokens) < cost) return no('竞技代币不足');
      acc.tokens = num(acc.tokens) - cost; var o = {}; o[T.k] = n; give(acc, o);
      return { ok: true, k: T.k, n: n, cost: cost };
    },
    // 先驱之塔代币商店：{ i } 第几件商品
    tower: function (acc, a, env) {
      var x = D.TW_SHOP[a.i | 0], T = twRec(acc, env.now), I = items(acc);
      if (!x || a.i !== (a.i | 0)) return no('没有这件商品');
      if (num(T.tok) < x.cost || (x.death && (I.deathTok || 0) < x.death)) return no('代币不够。');
      T.tok = num(T.tok) - x.cost; if (x.death) I.deathTok -= x.death;
      var o = {}; o[x.k] = 1; give(acc, o);
      return { ok: true, k: x.k };
    },
    // 茶室商店：{ k: 'auto', n } 自律训练装置；{ k: 'cap' } 茶室精灵容量 +1
    tea: function (acc, a) {
      if (a.k === 'auto') {
        var n = cnt(a.n, D.AUTO_MAX), cost = D.AUTO_PRICE * n;
        if (!n) return no('数量不对');
        if (num(acc.energy) < cost) return no('能量不足');
        acc.energy = num(acc.energy) - cost; give(acc, { auto: n });
        return { ok: true, k: 'auto', n: n, cost: cost };
      }
      if (a.k === 'cap') {
        if (!acc.home) acc.home = { name: '陆羽茶室', mons: [] };
        var c = Math.min(4, acc.home.cap || 0), p = D.CAP_PRICE[c];
        if (!p) return no('已经扩到最大了');
        if (num(acc.energy) < p) return no('能量不足');
        acc.energy = num(acc.energy) - p; acc.home.cap = c + 1;
        return { ok: true, k: 'cap', cost: p };
      }
      return no('没有这件商品');
    },
    // 温泉休息室：{ k: 'juice' } 橘子汁；{ k: 'slot' } 栏位 +1；{ k: 'bgm', m: 曲子 } 解锁音乐
    spa: function (acc, a, env) {
      var S = spaRec(acc);
      if (a.k === 'juice') {
        if (num(acc.energy) < D.SPA_JUICE.price) return no('能量不足');
        acc.energy = num(acc.energy) - D.SPA_JUICE.price; S.juice = Math.max(env.now, S.juice || 0) + D.SPA_JUICE.min * 60000;
        return { ok: true, k: 'juice' };
      }
      if (a.k === 'slot') {
        var p = spaSlotPrice(S.extra);
        if (!p) return no('已经扩到最大了');
        if (num(acc.energy) < p) return no('能量不足');
        acc.energy = num(acc.energy) - p; S.extra = (S.extra || 0) + 1;
        return { ok: true, k: 'slot', cost: p };
      }
      if (a.k === 'bgm') {
        var X = D.SPA_BGM.filter(function (x) { return x.k === a.m; })[0];
        if (!X) return no('没有这首曲子');
        if (num(acc.energy) < X.price) return no('能量不足');
        acc.energy = num(acc.energy) - X.price; if (!S.bgmOwn) S.bgmOwn = {}; S.bgmOwn[X.k] = 1; S.bgm = X.k;
        return { ok: true, k: 'bgm', m: X.k, n: X.n };
      }
      return no('没有这件商品');
    },
    // 三峡能源核心：把煤炭、铁矿换成能量（每天有上限）
    ore: function (acc, a, env) {
      var M0 = mineRec(acc, env.now), I = items(acc), left = D.MINE_CAP - (M0.ex || 0), got = 0, used = {};
      ['m_fe', 'm_cu'].forEach(function (k) { var p = D.MINE_PRICE[k]; while ((I[k] || 0) > 0 && left >= p) { I[k]--; left -= p; got += p; used[k] = (used[k] || 0) + 1; } });
      if (!got) return no(left <= 0 ? '今天能换的能量已经到上限了，明天再来吧。' : '矿石不够换了。');
      M0.ex = (M0.ex || 0) + got; acc.energy = num(acc.energy) + got;
      return { ok: true, got: got, used: used, left: D.MINE_CAP - M0.ex };
    },
    // 明明代币抽奖：{ times: 1 或 10 }
    mm: function (acc, a, env) {
      var times = a.times === 10 ? 10 : a.times === 1 ? 1 : 0; if (!times) return no('抽奖次数不对');
      var G = mmG(acc, env.now), I = items(acc), cost = D.MM_COST * times;
      if ((I.mmTok || 0) < cost) return no('明明代币不够，需要 ' + cost + ' 个。');
      var got = [], spent = 0, stop = '';
      for (var i = 0; i < times; i++) {
        if (!G.left.length) {
          if (G.opened >= D.MM_POOL_DAY) { stop = '今天已经解锁了 ' + D.MM_POOL_DAY + ' 个奖池，明天再来吧。'; break; }
          G.n++; G.opened++; G.left = mmPool(G.n).map(function (x, k) { return k; });
        }
        var pick = Math.floor(env.rand() * G.left.length), idx = G.left.splice(pick, 1)[0], z = mmPool(G.n)[idx];
        if (z.exp) acc.exp = num(acc.exp) + z.exp; else give(acc, z.items);
        spent += D.MM_COST; got.push(z);
      }
      I.mmTok = (I.mmTok || 0) - spent;
      return { ok: true, got: got, stop: stop };
    }
  };

  // 结算一笔交易：acc 是存档对象（会被直接修改），env = { now: 时间戳, rand: 随机数函数 }
  function run(acc, op, args, env) {
    if (!acc || typeof acc !== 'object' || !OPS.hasOwnProperty(op)) return no('不支持的操作');
    return OPS[op](acc, args || {}, env || { now: Date.now(), rand: Math.random });
  }
  // 服务器用：记下用到的随机数，发给浏览器
  function recorder() { var rolls = [], f = function () { var r = Math.random(); rolls.push(r); return r; }; f.rolls = rolls; return f; }
  // 浏览器用：按服务器给的随机数重放
  function replay(rolls) { var i = 0; rolls = Array.isArray(rolls) ? rolls : []; return function () { return i < rolls.length ? +rolls[i++] : 0; }; }

  // 别的规则文件（如 grow.js）加交易用
  function add(name, fn) { OPS[name] = fn; }
  return { D: D, run: run, add: add, recorder: recorder, replay: replay, mmPool: mmPool, spaSlotPrice: spaSlotPrice, bjDay: bjDay, dayNum: dayNum, twRec: twRec, mineRec: mineRec, mmG: mmG, ops: Object.keys(OPS) };
})();
if (typeof module !== 'undefined') module.exports = TX;
