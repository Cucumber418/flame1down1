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
    SHOP: ['cap1', 'rename', 'nameTag'],   // 2026-10-25：体力补药、强能体力补药下架
    SHOP_MAX: 99, RENAME_PRICE: 1000, NAME_TAG_PRICE: 20000,
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
    ], TOWER_MAX: 999,
    // 陆羽茶室大厅的茶室商店
    AUTO_PRICE: 1500, AUTO_MAX: 20, CAP_PRICE: [2000, 5000, 10000, 20000],
    // 温泉休息室
    SPA_JUICE: { price: 500, min: 30 }, SPA_EXTRA_MAX: 4,
    SPA_BGM: [{ k: 'spa', n: 'Spa', price: 0 }, { k: 'grassTalk', n: 'GrassTalk', price: 10000 }, { k: 'memory', n: 'Memory', price: 15000 }],
    // 三峡能源核心：矿石换能量
    MINE_PRICE: { m_cu: 150, m_fe: 250 }, MINE_CAP: 3000, DRILL_MAX: 80,
    // 明明代币抽奖：10 个抽一次；每天最多解锁 100 个新奖池
    MM_COST: 10, MM_POOL_DAY: 100,
    // 基地：r1 默认；能量房型限购一次；noShop 房型只能通过注明的渠道获得。layer：floor 地板 / wall 墙壁
    BASE_ROOMS: { r1: { n: '星空甲板', price: 0 }, r2: { n: '海底穹顶', price: 30000 }, r3: { n: '沙海舰桥', price: 30000 }, r4: { n: '雪原树屋', price: 30000 },
      r5: { n: '藤蔓树屋', price: 30000 }, r6: { n: '圣诞冰屋', price: 0, noShop: 1, source: '圣诞活动 · Threego杂货铺，5 个圣诞铃铛兑换' },
      r7: { n: '星河观景舱', price: 30000 }, r8: { n: '极寒冰宫', price: 0, noShop: 1, source: '暂不可获得' }, r9: { n: '生态树舱', price: 0, noShop: 1, source: '暂不可获得' } },
    BASE_DECO: { d12: { n: '圣诞树', price: 0, layer: 'floor', noShop: 1 }, d1: { n: 'Unicorn', price: 5000, layer: 'floor' }, d2: { n: 'OCT', price: 5000, layer: 'floor' }, d3: { n: 'Ace', price: 5000, layer: 'floor' }, d4: { n: 'May', price: 5000, layer: 'floor' },
      d5: { n: '叶粒种子发现纪念', price: 3000, layer: 'floor' }, d6: { n: '水臂乌贼发现纪念', price: 3000, layer: 'floor' }, d7: { n: '方头蘑菇发现纪念', price: 3000, layer: 'floor' },
      d8: { n: '精元转化仪', price: 10000, layer: 'floor' }, d9: { n: '明明画像', price: 5000, layer: 'wall' }, d10: { n: '留言板', price: 10000, layer: 'wall' },
      d11: { n: '第一届做题大王争霸赛冠军奖杯', price: 0, layer: 'wall', noShop: 1 } },   // d11：2026-11-02 冠军奖杯（邮件发给冠军，商城不卖）   // d8–d10：2026-11-01（精元转化仪点击打开孵化，留言板点击打开留言）   // d5–d7：2026-10-31 基地改版纪念
    BASE_DECO_MAX: 40,   // 基地里最多同时摆 40 个
    // 补偿礼包（2026-10-28）：每个账号每个礼包只能领一次（acc.gifts[礼包] 记领取时间）
    GIFTS: { comp1: { name: '补偿大礼包', exp: 300000, energy: 50000, items: { m_mcry: 500, tgPearl: 200, brTwig: 200 } },
      base1: { name: '基地改版纪念礼包', deco: { d5: 1, d6: 1, d7: 1 } },
      sum1: { name: '召唤上线纪念', items: { g_core: 30 } } },   // 2026-11-01：航行日志 · 圣晶石召唤页面领取   // deco：直接放进基地的摆件库
    // 配队（2026-10-27）：最多 10 个，前 3 个免费，第 4 个起用能量解锁（下面是第 4 ~ 10 个的价格）
    TEAM_FREE: 3, TEAM_MAX: 10, TEAM_PRICE: [5000, 10000, 20000, 30000, 50000, 80000, 120000]
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
  function price(k) { return k === 'nameTag' ? D.NAME_TAG_PRICE : k === 'rename' ? D.RENAME_PRICE : (typeof ITEMS !== 'undefined' && ITEMS[k] && ITEMS[k].price) || 0; }
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
      var x = D.TW_SHOP[a.i | 0], T = twRec(acc, env.now), I = items(acc), n = cnt(a.n === undefined ? 1 : a.n, D.TOWER_MAX);
      if (!x || !n || a.i !== (a.i | 0)) return no('没有这件商品');
      if (num(T.tok) < x.cost * n || (x.death && (I.deathTok || 0) < x.death * n)) return no('代币不够。');
      T.tok = num(T.tok) - x.cost * n; if (x.death) I.deathTok -= x.death * n;
      var o = {}; o[x.k] = n; give(acc, o);
      return { ok: true, k: x.k, n: n };
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
        var c = Math.min(4, acc.home.cap || 0), n = cnt(a.n === undefined ? 1 : a.n, 4-c), p = D.CAP_PRICE.slice(c,c+n).reduce(function (s,x) { return s+x; },0);
        if (!n || !p) return no('已经扩到最大了');
        if (num(acc.energy) < p) return no('能量不足');
        acc.energy = num(acc.energy) - p; acc.home.cap = c + n;
        return { ok: true, k: 'cap', cost: p };
      }
      return no('没有这件商品');
    },
    // 温泉休息室：{ k: 'juice' } 橘子汁；{ k: 'slot' } 栏位 +1；{ k: 'bgm', m: 曲子 } 解锁音乐
    // 基地商城：{ t: 'room' | 'deco', k, n }。买到的记在 acc.baseInv = { rooms: { r2: 时间 }, deco: { d1: 个数 } }
    baseBuy: function (acc, a, env) {
      if (!acc.baseInv || typeof acc.baseInv !== 'object') acc.baseInv = {};
      var B = acc.baseInv; if (!B.rooms) B.rooms = {}; if (!B.deco) B.deco = {};
      if (a.t === 'room') {
        var R = D.BASE_ROOMS[a.k]; if (!R || !R.price || R.noShop) return no('没有这个房型');
        if (B.rooms[a.k]) return no('已经有这个房型了');
        if (num(acc.energy) < R.price) return no('能量不足');
        acc.energy = num(acc.energy) - R.price; B.rooms[a.k] = env.now;
        return { ok: true, t: 'room', k: a.k, cost: R.price };
      }
      var X = D.BASE_DECO[a.k], n = cnt(a.n, 20); if (!X || !n || X.noShop) return no('没有这个摆件');
      var cost = X.price * n; if (num(acc.energy) < cost) return no('能量不足');
      acc.energy = num(acc.energy) - cost; B.deco[a.k] = (B.deco[a.k] | 0) + n;
      return { ok: true, t: 'deco', k: a.k, n: n, cost: cost };
    },
    // 领补偿礼包：{ id }
    compGift: function (acc, a, env) {
      var G = D.GIFTS[a.id]; if (!G) return no('没有这个礼包');
      if (!acc.gifts || typeof acc.gifts !== 'object') acc.gifts = {};
      if (acc.gifts[a.id]) return no('已经领过了');
      acc.gifts[a.id] = env.now;
      acc.exp = num(acc.exp) + (G.exp || 0); acc.energy = num(acc.energy) + (G.energy || 0); if (G.items) give(acc, G.items);
      if (G.deco) { if (!acc.baseInv || typeof acc.baseInv !== 'object') acc.baseInv = {}; if (!acc.baseInv.deco) acc.baseInv.deco = {}; for (var dk in G.deco) acc.baseInv.deco[dk] = (acc.baseInv.deco[dk] | 0) + G.deco[dk]; }
      return { ok: true, id: a.id };
    },
    // 解锁一个新配队（第 4 个起）：acc.teamX = 已经买了几个
    teamSlot: function (acc) {
      var x = acc.teamX | 0, p = D.TEAM_PRICE[x];
      if (!p || D.TEAM_FREE + x >= D.TEAM_MAX) return no('配队已经是最多的了');
      if (num(acc.energy) < p) return no('能量不足');
      acc.energy = num(acc.energy) - p; acc.teamX = x + 1;
      if (!Array.isArray(acc.teams)) acc.teams = [];
      while (acc.teams.length < D.TEAM_FREE + acc.teamX) acc.teams.push([]);
      return { ok: true, cost: p, n: D.TEAM_FREE + acc.teamX };
    },
    spa: function (acc, a, env) {
      var S = spaRec(acc);
      if (a.k === 'juice') {
        var n = cnt(a.n === undefined ? 1 : a.n, 99); if (!n) return no('数量不对');
        if (num(acc.energy) < D.SPA_JUICE.price * n) return no('能量不足');
        acc.energy = num(acc.energy) - D.SPA_JUICE.price * n; S.juice = Math.max(env.now, S.juice || 0) + D.SPA_JUICE.min * 60000 * n;
        return { ok: true, k: 'juice' };
      }
      if (a.k === 'slot') {
        var e = S.extra || 0, n = cnt(a.n === undefined ? 1 : a.n,D.SPA_EXTRA_MAX-e), p = 0; for (var j=0;j<n;j++) p += spaSlotPrice(e+j);
        if (!n || !p) return no('已经扩到最大了');
        if (num(acc.energy) < p) return no('能量不足');
        acc.energy = num(acc.energy) - p; S.extra = (S.extra || 0) + n;
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
      if (a.k !== undefined) { var p0 = D.MINE_PRICE[a.k], n0 = cnt(a.n, D.MINE_CAP); if (typeof p0 !== 'number' || !n0 || (I[a.k] || 0) < n0 || n0 * p0 > left) return no('矿石不足或已达今日上限'); I[a.k] -= n0; got = n0 * p0; used[a.k] = n0; left -= got; }
      else ['m_fe', 'm_cu'].forEach(function (k) { var p = D.MINE_PRICE[k]; while ((I[k] || 0) > 0 && left >= p) { I[k]--; left -= p; got += p; used[k] = (used[k] || 0) + 1; } });
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
