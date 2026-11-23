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
    { id: 'tree', k: 'd12', deco: true, coin: 'xmasBell', price: 1 },
    { id: 'fruit1', k: 'fruit1', coin: 'xmasCandy', price: 20 },
    { id: 'fruit2', k: 'fruit2', coin: 'xmasCandy', price: 50 },
    { id: 'crossEssence', k: 'crossEssence', coin: 'xmasCandy', price: 1 },
    { id: 'cap1', k: 'cap1', coin: 'xmasCandy', price: 5 },
    { id: 'cap2', k: 'cap2', coin: 'xmasCandy', price: 12 },
    { id: 'pot100', k: 'pot100', coin: 'xmasCandy', price: 6 },
    { id: 'pot200', k: 'pot200', coin: 'xmasCandy', price: 10 },
    { id: 'pp10', k: 'pp10', coin: 'xmasCandy', price: 8 },
    { id: 'pp20', k: 'pp20', coin: 'xmasCandy', price: 14 },
    { id: 'formDev', k: 'formDev', coin: 'xmasBell', price: 6 }
  ];
  // 活动结束时关闭此开关，主题外观设置不影响活动奖励
  var RANK_EVENT = { enabled: true, season: 'S2', win: 20, lose: 10, draw: 10 };
  function rankCandy(a, season, result, quit) {
    var n = !quit && RANK_EVENT.enabled && season === RANK_EVENT.season && ['win','lose','draw'].indexOf(result) >= 0 ? RANK_EVENT[result] || 0 : 0;
    if (n) ACC.addItems(a, { xmasCandy: n });
    return n;
  }
  var ALL = { bell: 3, candy: 25 };
  // 管口位：上1、右2、下4、左8，顺时针旋转；只验证相邻管口真正连通
  var PIPES = [10,12,5,3,10,3,12,6,5,6,9,9,3,3,10,10];
  var PIPE_START = [1,2,1,3,0,1,2,1,3,1,2,0,2,1,1,1];
  var KNIGHT_LEVELS = [50,60,70], KNIGHT_CANDY = [5,8,12];
  var KNIGHT_POOL = ['leaf','squid','shroom','wind','kaleo','faraday','firemouse','frost','gorgon','pede','siren','turkey','wild','leafcat','barlow','bali'];
  function pipeMask(i, rot) { var m = PIPES[i]; for (var j = 0; j < rot; j++) m = ((m << 1) & 15) | (m >> 3); return m; }
  function pipeReach(rot) {
    if (!Array.isArray(rot) || rot.length !== 16 || !rot.every(function (n) { return Number.isInteger(n) && n >= 0 && n < 4; })) return [];
    var masks = rot.map(function (n, i) { return pipeMask(i, n); }), seen = [], queue = masks[0] & 8 ? [0] : [];
    while (queue.length) {
      var i = queue.shift(); if (seen.indexOf(i) >= 0) continue; seen.push(i);
      [[-4,1,4,i >= 4],[1,2,8,i % 4 < 3],[4,4,1,i < 12],[-1,8,2,i % 4 > 0]].forEach(function (d) { if (d[3] && (masks[i] & d[1]) && (masks[i+d[0]] & d[2]) && seen.indexOf(i+d[0]) < 0) queue.push(i+d[0]); });
    }
    return seen;
  }
  function pipeSolved(rot) { return pipeReach(rot).indexOf(15) >= 0 && !!(pipeMask(15, rot[15]) & 2); }
  function wonderOpen(a) { return open(a) && !!story(a).wonderOpen; }
  function knightOpen(a) { return wonderOpen(a) && !!story(a).knightIntro; }
  function nextTarget(k, slot, rand) { return { id: ++k.seq, sid: KNIGHT_POOL[Math.floor(rand() * KNIGHT_POOL.length)], lv: KNIGHT_LEVELS[slot] }; }
  function knightState(a, rand) {
    var s = story(a), k = s.knight;
    if (!k) { k = s.knight = { seq: 0, wins: 0, slots: [] }; KNIGHT_LEVELS.forEach(function (_, i) { k.slots.push(nextTarget(k, i, rand)); }); }
    return k;
  }
  function knightWin(a, slot, id, rand) {
    var k = story(a).knight, t = k && k.slots[slot];
    if (!t || t.id !== id) return 0;
    var n = KNIGHT_CANDY[slot]; ACC.addItems(a, { xmasCandy: n }); k.wins++; k.slots[slot] = nextTarget(k, slot, rand); return n;
  }
  function open(a) { return PVE.helenaOpen(a); }
  function story(a) { return a.christmasStory || {}; }
  function sceneOpen(a, si) { return open(a) && (si === 0 || si === 1 && !!story(a).cabinOpen || si === 2 && !!story(a).shopOpen); }
  function read(a, now) {
    var day = ACC.dayStr(now), old = a.christmas;
    if (old && old.day === day && old.progress && old.claimed) return old;
    return { day: day, progress: { signin: a.checkin && a.checkin.days && a.checkin.days.indexOf(day) >= 0 ? 1 : 0 }, claimed: {}, all: false };
  }
  function claimable(a, now) {
    if (!sceneOpen(a,1)) return false;
    var r=read(a,now);
    return TASKS.some(function(t){return !r.claimed[t.id] && (r.progress[t.id] || 0)>=t.n;}) || !r.all && TASKS.every(function(t){return (r.progress[t.id] || 0)>=t.n;});
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
    if (args.a === 'pipes') {
      if (!story(a).shopIntro) return { ok: false, err: '先去见杂货铺的Threego' };
      if (wonderOpen(a)) return { ok: true, already: true };
      if (!pipeSolved(args.rot)) return { ok: false, err: '管道还没连通，再转一转试试' };
      a.christmasStory.wonderOpen = true; return { ok: true };
    }
    if (args.a === 'knightIntro') { if (!wonderOpen(a)) return { ok: false, err: '先接通杂货铺角落的管道' }; a.christmasStory.knightIntro = true; return { ok: true }; }
    if (args.a === 'knightVisit') { if (!knightOpen(a)) return { ok: false, err: '先前往圣诞仙境，看看屋外发生了什么' }; knightState(a, env.rand); return { ok: true }; }
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
      I[s.coin] -= cost; a.items = I;
      if (s.deco) { var B=a.baseInv || (a.baseInv={});if(!B.deco)B.deco={};B.deco[s.k]=(B.deco[s.k] || 0)+n; }
      else I[s.k] = (I[s.k] || 0) + n;
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
  PVE.MODES.christmasKnight = {
    start: function (a, args, env) {
      if (!knightOpen(a)) return { err: '先解锁圣诞仙境并完成屋外的剧情' };
      var k = story(a).knight, slot = args.slot, t = k && Number.isInteger(slot) && k.slots[slot];
      if (!t || t.id !== args.id) return { err: '这只精灵已经离开，请重新查看召唤目标' };
      var team = ACC.team(a); if (!team.length) return { err: '出战配队里还没有精灵' };
      var f = ACC.form({ sid: t.sid, lv: t.lv });
      return { p: team.map(function (m) { return ACC.battleMon(a, m); }),
        a: [{ id: t.sid, lv: t.lv, moves: ACC.defaultMoves(t.sid, t.lv), nick: f.name, img: f.img }],
        ctx: { slot: slot, id: t.id, team: team.map(function (m) { return m.u; }) },
        opt: { foe: '讨伐鲁普雷希特骑士', diff: '召唤精灵 · LV' + t.lv, bgm: 'stage', back: '圣诞仙境' } };
    },
    end: function (a, c, B, env) {
      var rep = { res: B.res, quit: B.quit, candy: 0 };
      if (B.res !== 'win' || B.quit) return rep;
      rep.candy = knightWin(a, c.slot, c.id, env.rand);
      if (rep.candy) rep.xp = ACC.battleXp(a, c.team, B.seen, B.downs, env);
      return rep;
    }
  };
  return { TASKS: TASKS, SHOP: SHOP, ALL: ALL, RANK_EVENT: RANK_EVENT, rankCandy: rankCandy, read: read, claimable: claimable, hit: hit, story: story, sceneOpen: sceneOpen,
    PIPES: PIPES, PIPE_START: PIPE_START, pipeMask: pipeMask, pipeReach: pipeReach, pipeSolved: pipeSolved,
    wonderOpen: wonderOpen, knightOpen: knightOpen, knightState: knightState, knightWin: knightWin, KNIGHT_CANDY: KNIGHT_CANDY };
})();
