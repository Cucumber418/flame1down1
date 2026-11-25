/* 格伦高地：剧情门槛、世界BOSS与兑换，浏览器和服务器共用规则。 */
var HIGHLAND = (function () {
  'use strict';
  var FRIENDS = ['oct', 'unicorn', 'may', 'ace'];
  var RULES = { level: 50, hp: 1000000, turns: 20, daily: 5 };
  var SHOP = [
    { id: 'essence', k: 'e_glen', costs: { xmasBell: 10, highlandPt: 1000 } },
    { id: 'talent', k: 'ivGlen', costs: { highlandPt: 200 } }
  ];
  function read(a) { return CHRISTMAS.story(a).highland || {}; }
  function ready(a) { var k = CHRISTMAS.story(a).knight; return CHRISTMAS.knightOpen(a) && !!(k && k.wins >= 1); }
  function open(a) { var t = read(a).talks || {}; return ready(a) && FRIENDS.every(function (k) { return !!t[k]; }); }
  function rec(a) { return a.christmasStory.highland || (a.christmasStory.highland = { talks: {} }); }
  function day(a, now) { var d = read(a).day, date = ACC.dayStr(now); return d && d.date === date ? d : { date: date, used: 0, damage: 0 }; }
  function rewards(damage) {
    if (!(damage > 0)) return { highlandPt: 0, exp: 0, xmasCandy: 0 };
    return { highlandPt: 70 + Math.min(10, Math.floor(damage / 2000)), exp: 20000 + Math.min(180000, damage * 5), xmasCandy: 10 + Math.min(90, Math.floor(damage / 500)) };
  }
  TX.add('highland', function (a, args) {
    if (!ready(a)) return { ok: false, err: '先在圣诞仙境击败一次鲁普雷希特骑士的召唤精灵' };
    if (args.a === 'talk') {
      if (FRIENDS.indexOf(args.id) < 0) return { ok: false, err: '没有这位伙伴' };
      var r = rec(a); if (!r.talks) r.talks = {}; r.talks[args.id] = true;
      return { ok: true, unlocked: open(a) };
    }
    if (!open(a)) return { ok: false, err: '先点击圣诞仙境中的四位伙伴，听听他们的建议' };
    if (args.a === 'intro') { rec(a).intro = true; return { ok: true }; }
    if (args.a === 'buy') {
      if (!read(a).intro) return { ok: false, err: '先与格伦高地的莫格伦交谈' };
      var s = SHOP.filter(function (x) { return x.id === args.id; })[0], n = args.n;
      if (!s || !Number.isInteger(n) || n < 1 || n > 999) return { ok: false, err: '兑换数量应为1–999的整数' };
      var I = a.items || {}, keys = Object.keys(s.costs);
      if (keys.some(function (k) { return (I[k] || 0) < s.costs[k] * n; })) return { ok: false, err: '兑换所需的圣诞铃铛或高地的认可不足' };
      keys.forEach(function (k) { I[k] -= s.costs[k] * n; }); I[s.k] = (I[s.k] || 0) + n; a.items = I;
      return { ok: true, k: s.k, n: n };
    }
    return { ok: false, err: '没有这个高地活动操作' };
  });
  PVE.MODES.highland = {
    start: function (a, args, env) {
      if (!open(a) || !read(a).intro) return { err: '先完成四位伙伴的对话，再前往格伦高地与莫格伦交谈' };
      if (day(a, env.now).used >= RULES.daily) return { err: '今天的5次挑战已完成，明天再来吧' };
      var team = ACC.team(a); if (!team.length) return { err: '出战配队里还没有精灵' };
      var r = rec(a); r.seq = (r.seq || 0) + 1;
      return { dirty: true, p: team.map(function (m) { return ACC.battleMon(a, m); }),
        a: [{ id: 'glen', lv: RULES.level, maxhp: RULES.hp, nick: '高地之王 · 莫格伦', img: SPRITES.glen,
          moves: ['破石之蹄', '孤高之蹄', '孤王之傲', '碎震裂踢'], boss: { noStatus: 1, noPercent: 1, pp: 99, seen: { noStatus: 1, noPercent: 1 } } }],
        S: { worldBoss: { id: 'glen', limit: RULES.turns, damage: 0 } }, ctx: { id: r.seq },
        opt: { foe: '高地之王 · 莫格伦', diff: '世界BOSS · LV50 · 20回合', bgm: 'boss3', back: '格伦高地' } };
    },
    end: function (a, c, B, env) {
      var out = { res: B.res, quit: B.quit, damage: 0, counted: false }, r = rec(a), S = B.S, w = S && S.worldBoss;
      if ((r.settled || 0) >= c.id) return out;
      r.settled = c.id;
      if (B.quit || B.res !== 'win' || !w || w.id !== 'glen' || !(w.finished || S.sides[1].team[0].fainted)) return out;
      var d = day(a, env.now); if (d.used >= RULES.daily) return out;
      var damage = Number.isSafeInteger(w.damage) && w.damage > 0 ? w.damage : 0, rw = rewards(damage);
      d.used++; d.damage += damage; r.day = d; r.total = (r.total || 0) + damage; r.best = Math.max(r.best || 0, damage); r.runs = (r.runs || 0) + 1;
      ACC.addItems(a, { highlandPt: rw.highlandPt, xmasCandy: rw.xmasCandy }); a.exp = (a.exp || 0) + rw.exp;
      r.last = { at: env.now, damage: damage, reward: rw }; out.damage = damage; out.counted = true; out.reward = rw; out.used = d.used;
      return out;
    }
  };
  return { FRIENDS: FRIENDS, RULES: RULES, SHOP: SHOP, read: read, ready: ready, open: open, day: day, rewards: rewards };
})();
