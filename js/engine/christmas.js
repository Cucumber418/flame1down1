/* 海伦娜圣诞活动：每日任务、活动货币与批量兑换由服务器结算 */
var CHRISTMAS = (function () {
  'use strict';
  var TASKS = [
    { id: 'hello', kind: 'wildWin', n: 1, t: '击败1只野生精灵', bell: 1, candy: 8 },
    { id: 'signin', kind: 'signin', n: 1, t: '完成今日签到', bell: 1, candy: 10 },
    { id: 'battle', kind: 'pve', n: 2, t: '参与2场PVE对战', bell: 1, candy: 12 },
    { id: 'wild', kind: 'wildWin', n: 3, t: '击败3只野生精灵', bell: 1, candy: 15 }
  ];
  var SHOP = [
    { id: 'cap1', k: 'cap1', coin: 'xmasCandy', price: 5 },
    { id: 'cap2', k: 'cap2', coin: 'xmasCandy', price: 12 },
    { id: 'pot100', k: 'pot100', coin: 'xmasCandy', price: 6 },
    { id: 'pot200', k: 'pot200', coin: 'xmasCandy', price: 10 },
    { id: 'pp10', k: 'pp10', coin: 'xmasCandy', price: 8 },
    { id: 'pp20', k: 'pp20', coin: 'xmasCandy', price: 14 },
    { id: 'fruit1', k: 'fruit1', coin: 'xmasBell', price: 2 },
    { id: 'formDev', k: 'formDev', coin: 'xmasBell', price: 6 }
  ];
  var ALL = { bell: 3, candy: 25 };
  function open(a) { return PVE.helenaOpen(a); }
  function story(a) { return a.christmasStory || {}; }
  function sceneOpen(a, si) { return open(a) && (si === 0 || si === 1 && !!story(a).cabinOpen || si === 2 && !!story(a).shopOpen); }
  function read(a, now) {
    var day = ACC.dayStr(now), old = a.christmas;
    if (old && old.day === day && old.progress && old.claimed) return old;
    return { day: day, progress: { signin: a.checkin && a.checkin.days && a.checkin.days.indexOf(day) >= 0 ? 1 : 0 }, claimed: {}, all: false };
  }
  function state(a, now) { return a.christmas = read(a, now); }
  function hit(a, kind, n, now) {
    if (!open(a) || !TASKS.some(function (t) { return t.kind === kind; })) return;
    var r = state(a, now);
    TASKS.forEach(function (t) { if (t.kind === kind) r.progress[t.id] = Math.min(t.n, (r.progress[t.id] || 0) + (n || 1)); });
  }
  function give(a, r) {
    if (!a.items) a.items = {};
    a.items.xmasBell = (a.items.xmasBell || 0) + r.bell;
    a.items.xmasCandy = (a.items.xmasCandy || 0) + r.candy;
  }
  TX.add('christmas', function (a, args, env) {
    if (!open(a)) return { ok: false, err: '完成地球主线后开放圣诞活动' };
    if (args.a === 'door') {
      var S = a.christmasStory || (a.christmasStory = {}); S.doorSeen = true;
      if (S.cabinOpen) return { ok: true, cabinOpen: true };
      var team = (a.teams || [])[a.active || 0] || [];
      if (!team.some(function (u) { var m = ACC.mon(a, u); return m && m.sid === 'barlow'; })) return { ok: true, needsBarlow: true };
      S.cabinOpen = true; return { ok: true, cabinOpen: true };
    }
    if (args.a === 'cabinIntro') { if (!sceneOpen(a, 1)) return { ok: false, err: '先敲开城堡大门' }; (a.christmasStory || (a.christmasStory = {})).cabinIntro = true; return { ok: true }; }
    if (args.a === 'shopHint') {
      if (!sceneOpen(a, 1) || !story(a).taskDone && !Object.keys(read(a, env.now).claimed).length && !read(a, env.now).all) return { ok: false, err: '先完成并领取Vanber的一项任务奖励' };
      a.christmasStory.shopOpen = true; return { ok: true };
    }
    if (args.a === 'shopIntro') { if (!sceneOpen(a, 2)) return { ok: false, err: '先完成Vanber的一项任务' }; a.christmasStory.shopIntro = true; return { ok: true }; }
    if (args.a === 'buy') {
      if (!sceneOpen(a, 2) || !story(a).shopIntro) return { ok: false, err: '先完成Vanber的一项任务，再去见杂货铺的主人' };
      var s = SHOP.filter(function (x) { return x.id === args.id; })[0], n = args.n;
      if (!s || !Number.isInteger(n) || n < 1 || n > 999) return { ok: false, err: '兑换数量应为1–999的整数' };
      var I = a.items || {}, cost = s.price * n;
      if (!Number.isSafeInteger(cost) || (I[s.coin] || 0) < cost) return { ok: false, err: '活动货币不足' };
      I[s.coin] -= cost; I[s.k] = (I[s.k] || 0) + n; a.items = I;
      return { ok: true, k: s.k, n: n, cost: cost, coin: s.coin };
    }
    if (!sceneOpen(a, 1)) return { ok: false, err: '先带上巴洛，敲开城堡大门' };
    if (args.a === 'visit') { state(a, env.now); return { ok: true }; }
    var r = state(a, env.now);
    if (args.a === 'all') {
      if (r.all) return { ok: true, already: true };
      if (!TASKS.every(function (t) { return (r.progress[t.id] || 0) >= t.n; })) return { ok: false, err: '先完成今天的全部圣诞任务' };
      r.all = true; a.christmasStory.taskDone = true; give(a, ALL); return { ok: true, bell: ALL.bell, candy: ALL.candy };
    }
    if (args.a === 'claim') {
      var t = TASKS.filter(function (x) { return x.id === args.id; })[0];
      if (!t) return { ok: false, err: '没有这个任务' };
      if (r.claimed[t.id]) return { ok: true, already: true };
      if ((r.progress[t.id] || 0) < t.n) return { ok: false, err: '这个任务还没完成' };
      r.claimed[t.id] = true; a.christmasStory.taskDone = true; give(a, t); return { ok: true, bell: t.bell, candy: t.candy };
    }
    return { ok: false, err: '没有这个圣诞活动操作' };
  });
  return { TASKS: TASKS, SHOP: SHOP, ALL: ALL, read: read, hit: hit, story: story, sceneOpen: sceneOpen };
})();
