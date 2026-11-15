/* ==========================================================
 * 账号与主线
 * 创建账号、精灵背包/仓库、黄冈秘鉴、星际探索剧情、商城、茶室、任务
 * ========================================================== */

/* ============ 账号系统：创建账号、初始精灵、精灵背包（配队）、精灵仓库、星际探索 ============ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var H = window.HSUI, esc = H.esc, tchip = H.tchip, tchips = H.tchips, atkTip = H.atkTip;
  var KEY = 'hs-account-v1', PKEY = 'hs-page';
  var STARTERS = ['leaf', 'squid', 'shroom'], START_LV = 5, NAME_MAX = 20, TEAM_N = 3, TEAM_SIZE = 5;   // TEAM_N：免费的配队数（2026-10-27：2 → 3；第 4 ~ 10 个用能量解锁，见 TX.D.TEAM_PRICE）
  function tName(i) { var n = typeof acc !== 'undefined' && acc && acc.tNames && acc.tNames[i]; return n ? String(n) : TEAM_NAME0[i]; }   // 配队可以改名（2026-11-02，存在 acc.tNames）
  var TEAM_NAME0 = ['配队一', '配队二', '配队三', '配队四', '配队五', '配队六', '配队七', '配队八', '配队九', '配队十'];
  var NAT_KEYS = Object.keys(NATURES), STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  var BASE_NAME = { hp: '体力', atk: '物攻', def: '物防', spa: '特攻', spd: '特防', spe: '速度' };
  var STAGE = ['一阶', '二阶', '最终形态'];
  var acc = null, page = 'holo';   // 2026-10-27：第一栏改成「全息作战」（大型活动展厅），竞技对战移到太空竞技场里
  // 进账申报的缓冲区（见下面的 earn）。要放在最前面：读存档时的修复代码就会用到
  var claimBuf = [], WALLET_KEYS = ['exp', 'energy', 'tokens', 'twTok', 'merit', 'meritXp'];
  var ui = { sel: null, pick: -1, ob: { step: 1, name: '', starter: null }, f: { type: '', min: 1, max: 100, sort: 'lvd' }, resetArmed: 0, welcome: false };

  /* ---------- 存档 ---------- */
  function valid(a) { return a && typeof a.name === 'string' && Array.isArray(a.mons) && Array.isArray(a.teams); }
  // 隐藏技能只能用道具解锁的种族（2026-10-18，说明见 avail 上方）；读存档时就要用到，所以放在最前面
  var HL_GATED = ACC.HL_GATED;   // 名单在 js/engine/acc.js
  window.HL_GATED = HL_GATED;   // battle.js 里用来跳过战斗中领悟
  try { var raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (valid(raw)) acc = raw; } catch (e) {}
  try { var pg = localStorage.getItem(PKEY); if (pg) page = pg; } catch (e) {}
  if (acc) {   // 清理坏数据
    acc.mons = acc.mons.filter(function (m) { return SPMAP[m.sid]; });
    while (acc.teams.length < TEAM_N + (acc.teamX | 0)) acc.teams.push([]);
    acc.teams = acc.teams.slice(0, Math.max(TEAM_N + (acc.teamX | 0), 2)).map(function (t) { return t.filter(function (u, i) { return mon(u) && t.indexOf(u) === i; }).slice(0, TEAM_SIZE); });
    if (!(acc.active >= 0 && acc.active < acc.teams.length)) acc.active = 0;
    if (acc.introDone == null) acc.introDone = acc.mons.length > 0;   // 旧存档：已有精灵视为看过序章
    if (acc.starter && !acc.rival) acc.rival = rivalOf(acc.starter);
    // 2026-10-24：道具解锁的隐藏技能改成按个体记（m.hl），不再整个种族共用。
    // 以前按种族解锁过的：只保留给当时用道具的那一只——记录里没有是哪一只，就给装备着这个技能的；都没装备，给这一族等级最高的那只。
    // 叶子喵、火鸡、幽灵鱼一系改成道具解锁：以前已经学会（LV50 习得 / 战斗中领悟）的都保留。
    if (!(acc.hlV >= 3) && acc.hlV >= 1) {
      acc.mons.forEach(function (m) {
        if (!SPMAP[m.sid] || ['leafcat', 'turkey', 'hauris'].indexOf(m.sid) < 0) return;
        if (!Array.isArray(m.hl)) m.hl = [];
        SPMAP[m.sid].hidden.forEach(function (n) { if (hidOk(m.lv, m.hl, n) && m.hl.indexOf(n) < 0) m.hl.push(n); });
      });
      if (acc.hlSp) Object.keys(acc.hlSp).forEach(function (sid) {
        var own = acc.mons.filter(function (m) { return m.sid === sid; }); if (!own.length) return;
        (acc.hlSp[sid] || []).map(moveName).forEach(function (n) {
          var eq = own.filter(function (m) { return (m.moves || []).map(moveName).indexOf(n) >= 0; });
          if (!eq.length) eq = [own.slice().sort(function (a, b) { return b.lv - a.lv; })[0]];
          eq.forEach(function (m) { if (!Array.isArray(m.hl)) m.hl = []; if (m.hl.indexOf(n) < 0) m.hl.push(n); });
        });
      });
      acc.hlSpOld = acc.hlSp || null; delete acc.hlSp; acc.hlV = Math.max(acc.hlV || 0, 3);
    }
    acc.mons.forEach(function (m) {
      if (!m.nat || !(m.nat in NATURES)) m.nat = NAT_KEYS[Math.floor(Math.random() * NAT_KEYS.length)];
      if (!m.ev) m.ev = {}; if (!(m.evFree >= 0)) m.evFree = 0;
      if (!ivOk(m.iv)) m.iv = randIv();   // 天赋系统上线前的精灵：补一套随机天赋
      if (acc.expV !== expV() && m.lv >= 1) {   // 经验曲线换版：等级不变，本级进度按比例换算
        var oe = acc.expV === 4 ? v4ExpAt : acc.expV === 3 ? v3ExpAt : acc.expV === 2 ? v2ExpAt : oldExpAt, o0 = oe(m.lv), o1 = oe(Math.min(100, m.lv + 1)), fr = m.lv >= 100 ? 0 : Math.max(0, Math.min(0.999, ((m.exp || 0) - o0) / (o1 - o0)));
        m.exp = m.lv >= 100 ? expAt(100) : Math.floor(expAt(m.lv) + fr * (expAt(m.lv + 1) - expAt(m.lv)));
      }
      if (!(m.exp >= expAt(m.lv))) m.exp = expAt(m.lv);
      if (m.fs != null && !Array.isArray(m.fu)) m.fu = [m.fs | 0];   // 形态切换装置改成永久解锁之前切换过的，算作已经解锁
      // 隐藏技能改为战斗中领悟：旧存档里已经装备着的隐藏技能视为已领悟
      if (Array.isArray(m.moves)) m.moves = m.moves.map(moveName).filter(function (n, i, a) { return a.indexOf(n) === i; });   // 改过名字的技能换成新名字（合并后去重）
      if (Array.isArray(m.hl)) m.hl = m.hl.map(moveName);
      if (!Array.isArray(m.hl)) m.hl = (m.moves || []).filter(function (n) { return M[n] && M[n].hidden && LEARN[n]; });
      if (!(acc.hlV >= 1) && HL_GATED[m.sid] && m.sid !== 'moon' && m.sid !== 'bone' && m.sid !== 'siren' && m.hl.length) { acc.hlReset = (acc.hlReset || 0) + m.hl.length; m.hl = []; }   // 2026-10-18：改成道具解锁，以前领悟的要重新学
      if ((m.sid === 'moon' || m.sid === 'bone' || m.sid === 'siren') && m.hl.length) {   // 小月亮、骨刃、塞壬也改成道具解锁，但以前领悟过的保留：并进这一族共用的解锁表
        if (!acc.hlSp) acc.hlSp = {}; if (!acc.hlSp[m.sid]) acc.hlSp[m.sid] = [];
        m.hl.forEach(function (n) { if (acc.hlSp[m.sid].indexOf(n) < 0) acc.hlSp[m.sid].push(n); });
      }
      var a = avail(m.sid, m.lv, m.hl); m.moves = (m.moves || []).filter(function (n) { return a.indexOf(n) >= 0; });
      if (!m.moves.length) m.moves = defaultMoves(m.sid, m.lv, m.hl);
    });
    if (acc.hlSp) Object.keys(acc.hlSp).forEach(function (k) { if (Array.isArray(acc.hlSp[k])) acc.hlSp[k] = acc.hlSp[k].map(moveName).filter(function (n, i, a) { return a.indexOf(n) === i; }); });   // 改过名字的隐藏技能（高温禁锢 → 余烬涅槃）
    acc.hlV = Math.max(acc.hlV || 0, 2);
    acc.expV = expV();
    if (!(acc.exp >= 0)) acc.exp = 0; if (!(acc.energy >= 0)) acc.energy = 0;
    if (!acc.items || typeof acc.items !== 'object') acc.items = {};
  }
  // 本地测试：用 ?test=tea 打开时，改用测试账号「测试」，并把「陆羽茶室」标成已读完。原来的存档留在 hs-account-v1-user，用 ?test=restore 换回来。
  function localHost() { return location.protocol === 'file:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost'; }
  function localFlag(name) { return new RegExp('(?:^|[?&])' + name + '(?:&|$)').test(location.search); }
  if (localHost() && localFlag('test=restore')) {
    try { var bakAcc = localStorage.getItem(KEY + '-user'); if (bakAcc) localStorage.setItem(KEY, bakAcc); } catch (e) {}
    location.replace(location.pathname + location.hash);
    return;
  } else if (localHost() && localFlag('test=tea')) {
    var teaWas = !!(acc && acc.story && acc.story.tea && acc.story.tea.done && acc.name === '测试');
    try {
      if ((!acc || acc.name !== '测试') && localStorage.getItem(KEY) && !localStorage.getItem(KEY + '-user')) localStorage.setItem(KEY + '-user', localStorage.getItem(KEY));
    } catch (e) {}
    if (!acc || acc.name !== '测试') acc = { v: 1, name: '测试', created: Date.now(), starter: 'leaf', rival: null, next: 1, mons: [], teams: [[], []], active: 0, introDone: true, story: {}, exp: 5000, energy: 20000, items: { cap1: 5, pot200: 5 } };
    if (!acc.story) acc.story = {};
    ['school', 'river', 'jiuquan', 'board', 'flora1', 'tea'].forEach(function (id) {
      var p = acc.story[id] || (acc.story[id] = {});
      p.done = true; p.rewarded = true; if (p.at == null) p.at = 99;
    });
    acc.introDone = true;
    if (!(acc.energy >= 20000)) acc.energy = 20000;
    if (!acc.items) acc.items = {};
    // 只补一次。星砂够做约 50 个加强装置，圣晶石够做 1 个华为装置，药草够做 100 瓶 200hp药水。
    if (acc.testKit !== 2) {
      var testStock = {
        cap1: 10, cap2: 10, cap3: 1, pot100: 10, pot200: 10,
        evAny: 5, evTagore: 5, natTagore: 5, trans: 1, helmet: 1, auto: 1, rename: 3,
        g_sand: 96, g_core: 4, s_herb: 4, c_herb: 200
      };
      Object.keys(testStock).forEach(function (k) { if (!(acc.items[k] >= testStock[k])) acc.items[k] = testStock[k]; });
      if (!(acc.exp >= 20000)) acc.exp = 20000;
      if (!(acc.energy >= 50000)) acc.energy = 50000;
      acc.testKit = 2;
    }
    if (!acc.mons.length) { var tm = newMon('leaf', 20); acc.starter = 'leaf'; acc.rival = rivalOf('leaf'); acc.teams[0] = [tm.u]; }
    if (!teaWas) page = 'explore';
    save(); savePage();
  }
  // 旧的六种采集物、三种种子并进星砂、圣晶石和药草。已经种下的旧种子在打开种植园时清掉。
  var matsBusy = false;
  function migrateMats() {   // 旧的六种采集物、三种种子并进星砂、圣晶石和药草（交易 fix，js/engine/award.js）
    if (!acc || !acc.items || acc.matsV === 1 || matsBusy || !ready()) return;
    matsBusy = true; setTimeout(function () { txRun('fix', { k: 'mats' }, function () { matsBusy = false; }, function () { matsBusy = false; }); }, 0);
  }
  function ready() { return !!(acc && acc.introDone); }
  function save() {
    if (claimBuf.length) { if (window.CLOUD && CLOUD.claim) CLOUD.claim(claimBuf); claimBuf = []; }   // 进账申报和存档一起交给 cloud.js 上传
    try { localStorage.setItem(KEY, JSON.stringify(acc)); } catch (e) {}
  }
  /* ---------- 进账申报（2026-10-24）----------
   * 所有让经验背包、能量、竞技代币、先驱代币、功勋、道具变多的地方都要用 earn(来源, 编号, { exp, energy, tokens, twTok, merit, meritXp, items: { 道具: 数量 } })。
   * earn 先在本机加上，再记一条申报；下次 save() 时申报随存档一起上传。服务器按来源记账：一次性的来源（剧情、邮件、任务、首通……）
   * 同一个编号只认一次；上传的存档里比服务器账上多出来、又没有申报的数值不认。来源列表见 server/claims.js 的 SRC，新增来源要两边一起加。
   * 花掉、用掉（数值变少）不用申报。 */
  function earn(src, id, d) {
    if (!acc || !d) return;
    var c = {}, any = false, it = {};
    WALLET_KEYS.forEach(function (k) { var v = +d[k]; if (v > 0 && isFinite(v)) { c[k] = v; any = true; } });
    if (d.items) for (var k in d.items) { var n = +d.items[k]; if (n > 0 && isFinite(n)) { it[k] = n; any = true; } }
    if (!any) return;
    if (c.exp) acc.exp = (acc.exp || 0) + c.exp;
    if (c.energy) acc.energy = (acc.energy || 0) + c.energy;
    if (c.tokens) acc.tokens = (acc.tokens || 0) + c.tokens;
    if (c.twTok) { var TW = twRec(); TW.tok = (TW.tok || 0) + c.twTok; }
    if (c.merit) acc.merit = (acc.merit || 0) + c.merit;
    if (c.meritXp) acc.meritXp = (acc.meritXp || 0) + c.meritXp;
    if (Object.keys(it).length) { if (!acc.items) acc.items = {}; for (var k2 in it) acc.items[k2] = (acc.items[k2] || 0) + it[k2]; c.items = it; }
    claimBuf.push({ c: Date.now().toString(36) + Math.random().toString(36).slice(2, 10), s: src, i: id == null ? '' : String(id), d: c });
  }
  /* ---------- 交易（2026-10-24）：商城、代币商店、温泉、茶室扩容、矿石换能量、明明代币抽奖都先交给服务器结算 ----------
   * 规则和价格在 js/engine/tx.js。服务器结算成功后，本机用服务器给的随机数和时间再算一遍（结果和服务器一样），然后 done(结果)。
   * 本地双击打开（没有服务器）时直接在本机结算。 */
  var txBusy = false;
  // 一次只结算一笔；上一笔还没结束时排队（最多 20 笔），结束后依次结算
  var txQ = [];
  function txNext() { if (!txBusy && txQ.length) { var q = txQ.shift(); txRun(q[0], q[1], q[2], q[3]); } }
  function txRun(op, args, done, fail) {
    if (txBusy) { if (txQ.length < 20) txQ.push([op, args, done, fail]); else if (fail) fail(''); return; } txBusy = true;
    var C = window.CLOUD, p = C && C.tx ? C.tx(op, args) : Promise.resolve({ local: true });
    p.then(function (r) {
      txBusy = false; setTimeout(txNext, 0);
      if (!r.local && !r.ok) { if (fail) fail(r.err || '没能完成'); else if (r.err) toast(r.err); return; }
      var data = {}; try { data['hs-rank-v1'] = localStorage.getItem('hs-rank-v1'); } catch (e) {}
      var user = C && C.user ? C.user() : null;
      var ext = r.ext || {}, fetch = function (k) { return r.local ? null : ext[k] === undefined ? null : ext[k]; };   // 服务器查到的资料（助战次数、大乱斗结果等）
      var res = TX.run(acc, op, args, r.local ? { now: Date.now(), rand: Math.random, data: data, user: user, fetch: fetch } : { now: r.now, rand: TX.replay(r.rolls), data: data, user: user, fetch: fetch });
      if (!res.ok) {
        if (r.local) { if (fail) fail(res.err); else toast(res.err); return; }
        // 服务器结算成功、本机却算不出来：本机存档和服务器对不上，以服务器为准
        if (C.resync) C.resync('本机的进度和服务器对不上，已切换成服务器上的进度。');
        return;
      }
      save(); done(res);
    }, function () { txBusy = false; setTimeout(txNext, 0); toast('连不上服务器，这次没有兑换，请稍后再试。'); });
  }
  function savePage() { try { localStorage.setItem(PKEY, page); } catch (e) {} }

  /* ---------- 精灵实例 ---------- */
  function mon(u) { return ACC.mon(acc, u); }
  function stageOf(s, lv) { return ACC.stageOf(s, lv); }
  // 异色：true 是第一种异色，2 是第二种（更稀有）
  function shinyV(v) { return ACC.shinyV(v); }
  function rollShiny(w) { var r = Math.random(); return w.shiny2 && r < w.shiny2 ? 2 : !!(w.shiny && r < (w.shiny2 || 0) + w.shiny); }
  // 形态切换装置：每用一个，这只精灵永久解锁一个更小的形态（m.fu 里记着解锁了哪些）；
  // 解锁过的形态和原本的形态之间随时免费切换（m.fs 是现在显示的形态）。只改外观，数值、技能都不变
  function shownStage(m) { return ACC.shownStage(m); }
  function formLabel(s, i) { var n = formRawName(s, i); return n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i); }
  function form(m) { return ACC.form(m); }   // 规则在 js/engine/acc.js（服务器和浏览器共用），下同
  // 普通技能：第 1 个 LV1 习得，之后每 5 级学会下一个（LV5、LV10、LV15……）；隐藏技能暂按 LV50
  function learnLv(i) { return ACC.learnLv(i); }
  function moveLv(sid, mv) { var s = SPMAP[sid], i = s.moves.indexOf(mv); return i >= 0 ? learnLv(i) : 50; }
  // hl：这只精灵已领悟的隐藏技能。有领悟条件的隐藏技能只能在战斗中领悟；没写条件的仍然 LV50 习得。
  // 不传 hl（剧情里的对手）时沿用旧规则：LV50 起隐藏技能全部可用。
  // 技能栏里没法装备的技能，旁边写清楚原因（2026-10-18：隐藏技能不再一律写「LV50 习得」）
  function hlItemOf(sid) { for (var k in USE_ITEMS) if (USE_ITEMS[k].kind === 'jade' && USE_ITEMS[k].sids && USE_ITEMS[k].sids.indexOf(sid) >= 0) return k; return null; }
  function lockText(m, mv) {
    if (!M[mv] || !M[mv].hidden) return 'LV' + moveLv(m.sid, mv) + ' 习得';
    if (HL_GATED[m.sid]) { var it = hlItemOf(m.sid); return (m.hl || []).indexOf(mv) >= 0 ? '已解锁 · LV' + HIDDEN_MIN_LV + ' 才能装备' : '未解锁 · 用 ' + (it ? USE_ITEMS[it].cost : 100) + ' 个「' + (it ? itemName(it) : '道具') + '」解锁'; }
    if (LEARN[mv]) return (m.hl || []).indexOf(mv) >= 0 ? '已领悟 · LV' + HIDDEN_MIN_LV + ' 才能装备' : '未领悟 · 在战斗中' + LEARN[mv];
    return 'LV50 习得';
  }
  function hidOk(lv, hl, n) { return ACC.hidOk(lv, hl, n); }   // 战斗中领悟的隐藏技能也要 LV40 以上才能用（HIDDEN_MIN_LV 在 battle.js）
  /* 2026-10-18：这些精灵的隐藏技能改成只能用道具解锁（星球特产、BOSS专属道具、死神代币、三主宠的地球元素），不再在战斗中领悟。
   * 2026-10-24 起解锁按个体记（m.hl）：道具用在哪一只身上，只有那一只能用（LV40 以上才能装备）。 */
  // HL_GATED 定义在文件开头（读存档时就要用到）
  function spHL(sid) { return (acc && acc.hlSp && acc.hlSp[sid]) || []; }
  function avail(sid, lv, hl) { return ACC.avail(sid, lv, hl); }
  function defaultMoves(sid, lv, hl) { return ACC.defaultMoves(sid, lv, hl); }
  // 电脑精灵的技能表（2026-10-19）：以默认配招为底，60% 换掉 1 个、其中又有 40% 再换 1 个，换成它会的其他技能（不总是最优组合）
  function foeMoves(sid, lv, hl) { return ACC.foeMoves(sid, lv, hl, Math.random); }
  // 商城、兑换、冶炼等列表里的简短介绍（2026-10-19）：有 sd 用 sd，否则只取介绍的第一句
  function shortD(it) { if (!it) return ''; if (it.sd) return it.sd; var d = String(it.d || ''), m = d.match(/^[^。！？]*[。！？]/); return m ? m[0] : d; }
  function randNat() { return ACC.randNat(Math.random); }
  function newMon(sid, lv) { var m = ACC.newMon(acc, sid, lv); save(); return m; }
  // 天赋：六项能力各一个 0~31 的随机数，越高越强（满 31 和天赋系统上线前一样）
  function randIv() { return ACC.randIv(Math.random); }
  function ivOk(iv) { return ACC.ivOk(iv); }
  function ivOf(m) { return ACC.ivOf(m); }
  // 天赋评级（2026-10-17）：按六项天赋合计（0~186）分五档，颜色 白 / 绿 / 蓝 / 紫 / 橙
  var IV_GRADE = [[170, '极品', 'g5'], [150, '稀', 'g4'], [120, '优', 'g3'], [90, '良', 'g2'], [0, '一般', 'g1']];
  function ivGrade(m) { var iv = ivOf(m); if (!iv) return null; var t = STAT_KEYS.reduce(function (a, k) { return a + iv[k]; }, 0); for (var i = 0; i < IV_GRADE.length; i++) if (t >= IV_GRADE[i][0]) return { n: IV_GRADE[i][1], c: IV_GRADE[i][2], s: t }; return null; }
  function ivSumOf(m) { var iv = ivOf(m); return iv ? STAT_KEYS.reduce(function (a, k) { return a + iv[k]; }, 0) : -1; }
  function gradeTag(m) { var g = ivGrade(m); return g ? '<span class="iv-grade ' + g.c + '" title="天赋评级：' + g.n + '（天赋合计 ' + g.s + ' / 186）">' + g.n + '</span>' : ''; }
  function evSum(m) { return STAT_KEYS.reduce(function (a, k) { return a + ((m.ev && m.ev[k]) || 0); }, 0); }
  function natText(nat) { var n = NATURES[nat]; return n ? BASE_NAME[n[0]] + ' +10%，' + BASE_NAME[n[1]] + ' −10%' : '各项能力无修正'; }
  // 胜利后，出战过的精灵各得 1 点可分配学习力（总量不超过 750）
  function giveEv(units, n) { var got = ACC.giveEv(acc, units, n); save(); return got.map(function (u) { return form(mon(u)).name; }); }
  /* 经验：每升一级所需经验以「等级³ 的差」为基础，按等级段调整系数（expK），expTab()[lv] = 到达该等级所需的累计经验
   * 存档 acc.expV 记录经验曲线的版本；曲线改过之后，读档清理坏数据时按「等级不变、本级进度比例不变」换算旧经验
   * （读档清理在文件最上面，比这里先执行，所以表格用到时才生成） */
  var MAX_LV = 100, _expTab = null;
  /* 等级上限（2026-10-18）：喂经验最高到 LV70。草系精灵可以用芙罗拉玉把上限解锁到 75（500 个）、80（1000 个），暂时不能超过 80；其他属性目前最高 70。
   * m.lvCap 是解锁后的上限；在这之前就已经超过 70 级的精灵保留现有等级，但不能再往上升。 */
  var BASE_CAP = 70, CAP_STEPS = GROW.CAP_STEPS;
  function capLv(m) { return ACC.capLv(m); }
  function atCap(m) { return m.lv >= capLv(m); }
  var GEM_OF = GROW.GEM_OF;   // 哪种属性用哪种星球特产解锁等级上限（grow.js）
  var CAP_SID = GROW.CAP_SID;
  function capGem(m) { return GROW.capGem(m); }
  function capNext(m) { return GROW.capNext(m); }
  function expV() { return 5; }
  // lv → lv+1 这一级的系数（相对等级³ 的差）。v2：50 级以上 ×2；v3（2026-10-17，隐藏调整）：50 级以上再 ×4，即 ×8
  function expK(lv) { return ACC.expK(lv); }   // v5（2026-10-18 晚）：60 级以上是 v4 的 0.7 倍（v4 是 ×24，太难升了）
  function expKv4(lv) { return lv < 25 ? 0.6 : lv >= 60 ? 24 : lv >= 50 ? 8 : 1; }
  function expKv3(lv) { return lv < 25 ? 0.6 : lv >= 50 ? 8 : 1; }
  function expKv2(lv) { return lv < 25 ? 0.6 : lv >= 50 ? 2 : 1; }
  function tabOf(k) { var T = [0, 1]; for (var l = 1; l < 100; l++) T[l + 1] = T[l] + Math.round(((l + 1) * (l + 1) * (l + 1) - l * l * l) * k(l)); return T; }
  var _v2Tab = null;
  function v2ExpAt(lv) { if (!_v2Tab) _v2Tab = tabOf(expKv2); return _v2Tab[Math.max(1, Math.min(100, lv))]; }
  var _v4Tab = null;
  function v4ExpAt(lv) { if (!_v4Tab) _v4Tab = tabOf(expKv4); return _v4Tab[Math.max(1, Math.min(100, lv))]; }
  var _v3Tab = null;
  function v3ExpAt(lv) { if (!_v3Tab) _v3Tab = tabOf(expKv3); return _v3Tab[Math.max(1, Math.min(100, lv))]; }
  function expTab() { return ACC.expTab(); }
  function expAt(lv) { return ACC.expAt(lv); }
  function lvOf(exp) { return ACC.lvOf(exp); }
  function oldExpAt(lv) { return lv * lv * lv; }   // 第 1 版曲线（只用于换算旧存档）
  function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }
  function giveExp(m, amt) { return gainExp(m, amt, true); }
  // fromPool：从经验分配器里扣；否则是战斗直接获得
  function gainExp(m, amt, fromPool) {
    var g = ACC.gainExp(acc, m, amt, fromPool); if (!g) return null;
    if (typeof REW !== 'undefined' && REW.collect) REW.gains.push({ u: g.u, lv0: g.lv0, exp0: g.exp0, amt: g.amt });
    save(); return gainMsg(g);
  }
  // 把一次加经验的结果写成提示（服务器结算的也用这个）
  function gainMsg(g) {
    var msg = g.name1 + ' 获得了 ' + fmt(g.amt) + ' 点经验';
    if (g.lv1 > g.lv0) { msg += '，升到了 LV' + g.lv1 + '！'; setTimeout(function () { checkTitles(); renderTitle(); }, 0); }
    else msg += '。';
    if (g.st1 > g.st0) msg += g.name0 + ' 进化成了 ' + g.name1 + '！';
    var regular = g.learned || [], eq = g.equipped || [];
    if (regular.length) msg += '学会了新技能：' + regular.map(function (n) { return '「' + n + '」'; }).join('、') + (eq.length ? (eq.length === regular.length ? '，已自动装备。' : '，其中' + eq.map(function (n) { return '「' + n + '」'; }).join('、') + '已自动装备。') : '。出战技能已满，可在下方替换。');
    if (g.hid && g.hid.length) msg += '领悟了隐藏技能：' + g.hid.map(function (n) { return '「' + n + '」'; }).join('、') + '。';
    return msg;
  }
  function teamsOf(u) { var r = []; acc.teams.forEach(function (t, i) { var k = t.indexOf(u); if (k >= 0) r.push({ t: i, lead: k === 0 }); }); return r; }
  function stat(m, k) { return fullStat(SPMAP[m.sid].base[k], k, m.lv, m.ev, m.nat, ivOf(m)); }

  /* ---------- 顶栏、导航 ---------- */
  function renderTop() {
    document.body.classList.toggle('no-acc', !ready());
    $('onboard').hidden = ready();
    if (!ready()) { renderOnboard(); return; }
    migrateMats(); storyFix();   // 旧存档的剧情补发（服务器结算，js/engine/story.js 的 legacy）
    $('who-name').textContent = acc.name;
    renderRes();
    renderAvatar(); renderGender();
    $('who-info').textContent = '做题家「' + acc.name + '」 · 军衔 ' + milName() + ' · 拥有精灵 ' + acc.mons.length + ' 只 · 创建于 ' + new Date(acc.created).toLocaleDateString('zh-CN');
    checkTitles(); renderTitle();
    if (page === 'arena' && !arenaOpen()) page = 'bag';
    if (page === 'dex' && !dexOpen()) page = 'bag';
    if (page === 'shop') page = 'explore';
    if (page === 'ship' && typeof ex !== 'undefined' && ex) { page = 'explore'; ex.view = 'sites'; ex.planet = 'jingchu'; if (ex.mode === 'replay') ex.mode = null; }   // 2026-10-28：飞船终端 = 荆楚号舰体图
    if (page === 'holo' && typeof ex !== 'undefined' && ex && mmOpen()) { page = 'explore'; ex.view = 'mmArena'; ex.mmFrom = null; }   // 2026-10-27：全息作战 = 直接进明明教官的试炼（全息作战场地）
    navSync();
    syncBattle();
    deliverMail(); checkRankRewards(); daily(); homeSettle();
    setTimeout(function () { storyNewsCheck(); newsCheck(); }, 1500);
    ['holo', 'arena', 'log', 'bag', 'store', 'release', 'dex', 'items', 'social', 'explore'].forEach(function (p) { $('pg-' + p).hidden = p !== page; });
    if (page !== 'bag' && ui.bagPanel) closeBagPanel();
    renderRename();
    if (page === 'arena' && window.HSBATTLE && window.HSBATTLE.renderMode && $('battle').hidden) window.HSBATTLE.renderMode();
    if (page === 'social') { if (window.HSSOCIAL) window.HSSOCIAL.render(); }
    else if (page === 'bag') renderBag();
    else if (page === 'log') renderLog();
    else if (page === 'dex') renderDex2();
    else if (page === 'store') renderStore();
    else if (page === 'release') renderRelease();
    else if (page === 'items') renderItems();
    else if (page === 'explore') renderExplore();
    else if (page === 'holo') renderHolo();
    if (typeof bgmScene === 'function') bgmScene();
  }
  function renderRes() {   /* 2026-11-02：顺便刷新小红点 */
    if (typeof navDots === 'function') setTimeout(navDots, 0);
    $('res').textContent = ''; $('res').hidden = true; setTimeout(renderQBadge, 0); }
  // 导航高亮：明明教官的试炼（全息作战场地、代币抽奖）不管从哪里进，都亮「全息作战」；竞技对战（在太空竞技场里）亮「星际探索」
  // 现在是不是在荆楚号里（舰体图、区域、区域里的设施）：导航亮「飞船终端」
  var SHIP_VIEWS = { summon: 1, area: 1, shop: 1, forge: 1, nursery: 1, medal: 1, farm: 1, seedshop: 1, spa: 1, home: 1, room: 1, teashop: 1, baseshop: 1 };
  // 2026-10-31：空间站、太空竞技场、BOSS挑战、每周挑战也挂在飞船终端里
  var SHIP_SIDE = { jingchu: 1, station: 1, sarena: 1 }, SHIP_HUBS = { bosshub: 1, wkhub: 1, weekly: 1, ewk: 1 };
  function shipCtx() { if (!(page === 'explore' && typeof ex !== 'undefined' && ex && !ex.mode)) return false; var P = ex.view === 'sites' && planetOf(ex.planet); return !!(SHIP_VIEWS[ex.view] || SHIP_HUBS[ex.view] || (ex.view === 'boss' && ex.bossFrom === 'hub') || (P && (SHIP_SIDE[P.id] || P.inStation))); }
  function navSync() {
    var holo = page === 'explore' && typeof ex !== 'undefined' && (ex.view === 'mmArena' || ex.view === 'mmGacha'), ship = shipCtx();
    [].forEach.call(document.querySelectorAll('#mainnav .nav'), function (b) {
      var pg = b.dataset.page, on = holo ? pg === 'holo' : ship ? pg === 'ship' : pg === page || (page === 'arena' && pg === 'ship') || ((page === 'store' || page === 'release' || page === 'dex') && pg === 'bag');   // 精灵仓库、图鉴在「精灵一览」里；荆楚号在「飞船终端」里
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    });
    setTimeout(navDots, 0);
  }
  function go(p) { if (p !== 'explore' && $('en-modal')) $('en-modal').remove(); if (typeof SPA !== 'undefined' && SPA.on && page === 'explore' && ex.view === 'spa' && p !== 'explore') { spaLeaveAsk(function () { go(p); }); return; }
    if (ex.mode === 'replay' && p !== 'explore') { stopTimers(); ex.mode = null; ex.view = 'sites'; } PAGE_Y[page] = HSVIEW.y(); if (p === 'log' && page !== 'log') ui.logSel = null; page = p; ui.pick = -1; savePage(); renderTop(); var y0 = PAGE_Y[p] || 0; HSVIEW.to(0, y0); requestAnimationFrame(function () { if (page === p) HSVIEW.to(0, y0); }); }
  var PAGE_Y = {};   // 2026-11-01：切换大栏时记住每一栏的滚动位置，回来时停在原来的地方
  $('mainnav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-page]'); if (!b || b.disabled) return;
    if (b.classList.contains('lockA')) {
      if (b.dataset.page === 'dex') toast('读完星际探索 · 荆楚号 · 学院部的剧情后，「黄冈秘鉴」才会开放。', prog('board').done ? '前往学院部' : '', '黄冈');
      else toast('读完星际探索 · 荆楚号 · 孝感大厅的剧情后，「竞技对战」才会开放。', prog('board').done ? '前往孝感大厅' : '', '孝感');
      return;
    }
    if (b.dataset.page === 'explore' && (ex.view === 'mmArena' || ex.view === 'mmGacha')) { ex.view = 'sites'; ex.planet = 'station'; }
    if (b.dataset.page === 'explore' && shipCtx()) ex.view = 'planets';   // 在荆楚号里点「星际探索」：回到星图   // 在全息作战里点「星际探索」：回到空间站
    go(b.dataset.page);
  });
  function toast(msg, act, area) {
    if (typeof REW !== 'undefined' && REW.capture && !act) { REW.lines.push(String(msg)); return; }   // 对战刚结束：消息收进奖励面板，不弹提示条
    var t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t);
      t.addEventListener('click', function (e) { var g = e.target.closest('[data-tgo]'); if (g) { t.hidden = true; ex.planet = 'jingchu'; go('explore'); teleport(g.dataset.tgo); } }); }
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (act ? '<button type="button" class="btn" data-tgo="' + (area || '孝感') + '">' + act + '</button>' : '');
    t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, Math.min(12000, 4200 + msg.length * 60));
  }
  // 竞技对战进行中时锁住其他大栏，避免中途离开
  function syncBattle() {
    var inB = !$('battle').hidden, story = typeof ex !== 'undefined' && ex.fighting;
    if ($('arena-crumb')) $('arena-crumb').hidden = inB || story;
    [].forEach.call(document.querySelectorAll('#mainnav .nav'), function (b) {
      var pg = b.dataset.page, lockA = (pg === 'arena' && !arenaOpen()) || (pg === 'dex' && !dexOpen());
      b.disabled = inB && (story || pg !== 'arena');
      if (lockA) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      b.title = inB && b.disabled ? '对战进行中，结束后才能切换' : lockA ? (pg === 'dex' ? '读完星际探索 · 荆楚号 · 学院部的剧情后开放' : '读完星际探索 · 荆楚号的支线「孝感大厅」后开放') : '';
      if (pg === 'arena') { b.classList.toggle('lockA', lockA); b.querySelector('small').textContent = lockA ? '完成孝感大厅支线后开放' : '沙盒调试 · 平衡排位'; }
      if (pg === 'dex') { b.classList.toggle('lockA', lockA); b.querySelector('small').textContent = lockA ? '在学院部解锁' : (acc ? '已点亮 ' + litCount() + ' / ' + DEX_ALL.length + ' 类' : '精灵图鉴'); }
    });
  }
  new MutationObserver(function () { syncBattle(); if (ready() && $('battle').hidden) checkRankRewards(); }).observe($('battle'), { attributes: true, attributeFilter: ['hidden'] });
  // 账号菜单
  $('who-btn').addEventListener('click', function (e) {
    e.stopPropagation(); var m = $('who-menu'); m.hidden = !m.hidden; $('who-btn').setAttribute('aria-expanded', !m.hidden);
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('#who')) { $('who-menu').hidden = true; $('who-btn').setAttribute('aria-expanded', false); } });
  /* ---------- 称号 ---------- */
  var TITLES = [
    // grp：授勋馆里的分组（story 剧情与探索 / lv 等级 / season 排位赛季 / type 属性）
    { id: 'trainee', n: '见习做题家', d: '在黄冈秘鉴中点亮 3 类精灵', ok: function () { return litCount() >= 3; } },
    { id: 'senior', n: '资深做题家', d: '在黄冈秘鉴中点亮 10 类精灵', ok: function () { return litCount() >= 10; } },
    { id: 'elite', n: '精英做题家', d: '在黄冈秘鉴中点亮 30 类精灵', ok: function () { return litCount() >= 30; } },
    { id: 'master', n: '大师做题家', d: '在黄冈秘鉴中点亮 50 类精灵', ok: function () { return litCount() >= 50; } },
    { id: 'scholar', n: '学习王', d: '在黄冈秘鉴中点亮 100 类精灵', ok: function () { return litCount() >= 100; } },
    { id: 'collector', n: '实验班收藏家', d: '拥有 1 类稀有精灵（捕捉后在学院部汇报）', ok: function () { return !!(acc.story && acc.story.rare_r && acc.story.rare_r.done); } },
    { id: 'rare5', n: '考点收藏家', d: '拥有 5 类稀有精灵', ok: function () { return rareKinds() >= 5; } },
    { id: 'rare15', n: '必刷题收藏家', d: '拥有 15 类稀有精灵', ok: function () { return rareKinds() >= 15; } },
    { id: 'purifier', n: '芙罗拉净化者', d: '完成芙罗拉星的星球任务「祛除瘴气」', ok: function () { return !!(acc.purge && acc.purge.n >= 30); } },
    { id: 'force', n: '原力掌控者', d: '击败困难难度的BOSS「泰戈尔」', ok: function () { return bossWon('tiger', 2); } },
    { id: 'guardian', n: '净土守护', d: '击败困难难度的BOSS「荒芜」', ok: function () { return bossWon('barren', 2); } },
    { id: 'odoClean', n: '深海清洁工', d: '击败困难难度的BOSS「奥多亚克」', ok: function () { return bossWon('odo', 2); } },
    { id: 'reaper', n: '死神', d: '击败先驱之塔第 60 层的死神「帕努托尔」', ok: function () { return !!(acc.tower && acc.tower.clears > 0); } },
    { id: 'xcking', n: '行测之王', d: '通过日透骨消的考核，领取挖矿钻头', ok: function () { return !!acc.drill; } },
    { id: 'spa120', n: '温泉爱好者', d: '泡温泉累计 120 分钟', ok: function () { return spaMinTotal() >= 120; } },
    { id: 'spa600', n: '温泉达人', d: '泡温泉累计 600 分钟', ok: function () { return spaMinTotal() >= 600; } },
    { id: 'spa3000', n: '温泉鉴赏家', d: '泡温泉累计 3000 分钟', ok: function () { return spaMinTotal() >= 3000; } }
  ];
  function spaMinTotal() { return Math.floor(((acc.spa && acc.spa.ms) || 0) / 60000); }   // 泡温泉累计时长（2026-10-20 起记录）
  // 等级成就：有 1 只 / 5 只精灵达到 25、50、75、100 级
  TITLES.forEach(function (T) { T.grp = 'story'; });
  // 做题大王争霸赛（2026-10-19）：比赛结束时按名次发（acc.ctPlace[赛事] = 名次，0 是冠军）
  [['s1king', 'S1做题大王', '获得第一届做题大王争霸赛冠军', function (k) { return k === 0; }], ['s1prince', 'S1做题小王', '获得第一届做题大王争霸赛亚军', function (k) { return k === 1; }], ['s1zone', 'S1做题区', '参加第一届做题大王争霸赛', function (k) { return k >= 0; }]].forEach(function (x) {
    TITLES.push({ id: x[0], grp: 'season', n: x[1], d: x[2], ok: function () { var k = acc.ctPlace && acc.ctPlace.quiz1; return k != null && x[3](k); } });
  });
  function lvCount(lv) { return acc.mons.filter(function (m) { return m.lv >= lv; }).length; }
  [[25, '达人'], [50, '高手'], [75, '狂人'], [100, '神人']].forEach(function (L) {
    TITLES.push({ id: 'one' + L[0], grp: 'lv', n: '单科' + L[1], d: '有 1 只精灵达到 ' + L[0] + ' 级', ok: function () { return lvCount(L[0]) >= 1; } });
  });
  [[25, '达人'], [50, '高手'], [75, '狂人'], [100, '神人']].forEach(function (L) {
    TITLES.push({ id: 'all' + L[0], grp: 'lv', n: '全科' + L[1], d: '有 5 只精灵达到 ' + L[0] + ' 级', ok: function () { return lvCount(L[0]) >= 5; } });
  });
  // 排位赛季称号：本赛季（S1）达到某个段位就获得「S1 + 段位名」，例如「S1翡翠」（黑铁是起始段位，不发）
  for (var sr = 1; sr < RANKS.length; sr++) (function (r) {
    TITLES.push({ id: 'S1-' + r, grp: 'season', n: 'S1' + RANKS[r], d: '排位赛季 S1 达到' + RANKS[r] + '段位', season: true, ok: function () { return rankBest() >= r; } });
  })(sr);
  /* 属性称号：按精灵种类数统计（同一条进化线算 1 种，双属性精灵两个属性都算）
   * 收藏家：拥有 N 种该属性的精灵；训练师：N 种 LV50 以上；专家：5 种 LV80 以上 */
  var TITLE_TYPES = Object.keys(TYPE_COLOR).filter(function (t) { return t !== '无'; });
  var TYPE_TIERS = [
    { k: 'c', n: '收藏家', lv: 0, steps: [[3, '见习'], [6, '资深'], [10, '精英'], [15, '大师']] },
    { k: 't', n: '训练师', lv: 50, steps: [[1, '见习'], [3, '资深'], [5, '精英'], [10, '大师']] },
    { k: 'x', n: '专家', lv: 80, steps: [[5, '']] }
  ];
  function typeKinds(t, lv) { var o = {}; acc.mons.forEach(function (m) { var s = SPMAP[m.sid]; if (s && s.types.indexOf(t) >= 0 && m.lv >= lv) o[m.sid] = 1; }); return Object.keys(o).length; }
  TITLE_TYPES.forEach(function (t) {
    TYPE_TIERS.forEach(function (G) {
      G.steps.forEach(function (st) {
        TITLES.push({ id: 'ty' + G.k + st[0] + '-' + t, grp: 'type', type: t, tier: G.k, need: st[0], n: st[1] + t + '系' + G.n,
          d: '拥有 ' + st[0] + ' 种' + (G.lv ? ' LV' + G.lv + ' 以上的' : '') + t + '属性精灵',
          prog: function () { return typeKinds(t, G.lv); }, ok: function () { return typeKinds(t, G.lv) >= st[0]; } });
      });
    });
  });
  /* 称号奖励：每获得一个称号，得累积经验（进经验背包）、能量和功勋点（数额暂定）
   * 功勋点：存档 acc.merit（余额，暂时还没有用途）；每得 1 功勋点同时得 1 功勋经验 acc.meritXp，攒够了在授勋馆晋升军衔 */
  var TITLE_RW = RW.TITLE_RW;
  var TYPE_RW = RW.TYPE_RW;
  function titleRw(T) { return RW.titleRw(T); }   // 规则在 js/engine/rewards.js
  function rwText(r) { return '累积经验 ×' + fmt(r.exp) + '、能量 ×' + fmt(r.energy) + '、功勋点 ×' + fmt(r.merit); }
  function giveMerit(n) { earn('misc', 'merit', { merit: n, meritXp: n }); }   // 旧写法：新代码请直接用 earn，写明来源
  // 军衔：功勋经验攒够当前军衔的晋升所需，就能在授勋馆晋升（消耗功勋经验）。数额暂定
  // 2026-10-18：每个军衔细分成几个阶级（下等兵 / 二等兵 / 一等兵 / 上等兵，下士1~3 …… 大校1~3，将军），晋升的路更长
  var MIL_TIERS = [['下等兵', '二等兵', '一等兵', '上等兵'], '下士', '中士', '上士', '少尉', '中尉', '上尉', '少校', '中校', '上校', '大校', ['将军']];
  var RANKS_MIL = [], MIL_COST = [], MIL_TIER_OF = [];
  MIL_TIERS.forEach(function (t, ti) { (Array.isArray(t) ? t : [t + '1', t + '2', t + '3']).forEach(function (n) { RANKS_MIL.push(n); MIL_TIER_OF.push(ti); }); });
  // 每一阶晋升要的功勋经验：从 80 起，每阶多 10%（数额暂定）。比旧军衔贵得多：旧的中尉大约只够到新的下士2
  for (var mi = 0; mi < RANKS_MIL.length - 1; mi++) MIL_COST.push(Math.round(80 * Math.pow(1.1, mi)));
  var MIL_COST_V1 = [20, 40, 60, 100, 150, 200, 300, 400, 500, 700, 900, 1200], MIL_V2_IDX = [0, 3, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
  // 旧军衔换算、晋升：交易 promote（js/engine/award.js）
  var milBusy = false;
  function milRank() {
    if (acc.milV !== 3) {
      var C = { milRank: acc.milRank, milV: acc.milV, meritXp: acc.meritXp }; AWD.milMigrate(C);
      if (!milBusy) { milBusy = true; setTimeout(function () { txRun('promote', { a: 'migrate' }, function () { milBusy = false; renderTop(); }, function () { milBusy = false; }); }, 0); }
      return C.milRank;
    }
    return Math.max(0, Math.min(RANKS_MIL.length - 1, acc.milRank | 0));
  }
  function milName() { return RANKS_MIL[milRank()]; }
  function promote() {
    var r = milRank(), c = MIL_COST[r];
    if (r >= RANKS_MIL.length - 1 || !((acc.meritXp || 0) >= c)) return;
    txRun('promote', { a: 'up' }, function () { toast('晋升成功！你的军衔现在是「' + milName() + '」。'); renderTop(); if (ex.view === 'medal') renderMedal(); });
  }
  // 称号：服务器判断、发奖励（交易 title，js/engine/award.js）；这里先在本机试算，有新的才去结算
  var titleBusy = false;
  function titleEnv() { var d = {}; try { d['hs-rank-v1'] = localStorage.getItem('hs-rank-v1'); } catch (e) {} return { now: Date.now(), data: d }; }
  function checkTitles() {
    if (!ready() || titleBusy) return;
    var dry = AWD.titleCheck(acc, titleEnv(), true);
    if (!dry.got.length && !dry.paid.length) return;
    titleBusy = true;
    txRun('title', {}, function (r) {
      titleBusy = false; renderRes(); renderTitle();
      var names = (r.got || []).map(titleName).filter(Boolean), sum = r.sum || { exp: 0, energy: 0, merit: 0 }, any = (r.paid || []).length;
      if (names.length) { var tmsg = '获得称号「' + names.join('」「') + '」！' + (any ? '奖励：' + rwText(sum) + '。' : '') + '点右上角的名字即可佩戴。'; toast(tmsg); }
      else if (any) setTimeout(function () { toast('称号奖励到账：' + rwText(sum) + '。'); }, 600);
    }, function () { titleBusy = false; });
  }
  function titleName(id) { var T = TITLES.filter(function (x) { return x.id === id; })[0]; return T ? T.n : ''; }
  function renderTitle() {
    var cur = acc.title && (acc.titles || []).indexOf(acc.title) >= 0 ? acc.title : '';
    $('who-title').textContent = cur ? titleName(cur) : '做题家';
    $('who-title').classList.toggle('has', !!cur);
    // 名字菜单里只列出已经获得的称号；全部称号和获得方式在学院部的授勋馆
    var own = TITLES.filter(function (T) { return (acc.titles || []).indexOf(T.id) >= 0; });
    $('title-box').innerHTML = '<b>称号 <small class="tt-n">' + own.length + '</small></b><div class="tt-list">' + own.map(function (T) {
      return '<label class="tt-opt"><input type="radio" name="title" value="' + T.id + '"' + (cur === T.id ? ' checked' : '') + '><span><b>' + T.n + '</b><small>' + T.d + '</small></span></label>';
    }).join('') + '<label class="tt-opt"><input type="radio" name="title" value=""' + (cur ? '' : ' checked') + '><span><b>不佩戴</b></span></label></div>' +
      '<p class="tt-season">' + (own.length ? '' : '还没有获得称号。') + '所有称号和获得方式，可以在荆楚号 · 黄冈 · 学院部的「授勋馆」查看' + (medalOpen() ? '' : '（读完支线「授勋馆」后开放）') + '。</p>';
  }
  /* ---------- 头像：获得过的任意一种精灵形态都能当头像（存档 acc.avatarF = { sid, st 形态, shiny }） ----------
   * 只显示头部（裁切框见 js/data/avfocus.js，由 tools/avatar_focus.py 生成）。
   * 旧存档的 acc.avatar（一只精灵的编号）仍然认，选了新头像后就不用了。
   * 社交的玩家列表、名片、讨论区都会显示（服务器从存档里读，见 server/social.js 的 avatarOf） */
  function avatarMon() { return acc && acc.avatar != null ? mon(acc.avatar) : null; }
  function avatarCur() {   // 现在的头像：{ sid, st, shiny } 或 null
    var F = acc && acc.avatarF; if (F && SPMAP[F.sid] && F.st >= 0 && F.st <= evoLast(SPMAP[F.sid])) return { sid: F.sid, st: F.st | 0, shiny: shinyV(F.shiny), c: cropOk(F.c) };
    var m = avatarMon(); return m ? { sid: m.sid, st: shownStage(m), shiny: shinyV(m.shiny) } : null;
  }
  function avatarForm(spec) { var s = SPMAP[spec.sid]; return spec.st != null && s.evo[spec.st] ? form({ sid: spec.sid, lv: s.evo[spec.st].lv, shiny: spec.shiny }) : form({ sid: spec.sid, lv: spec.lv, shiny: spec.shiny, fs: spec.fs }); }
  // 玩家自己裁的头像框 c = [左, 上, 边长]（按立绘宽度的比例）；没裁过的用自动算的头部框
  function cropOk(c) { return Array.isArray(c) && c.length === 3 && c.every(function (x) { return typeof x === 'number' && isFinite(x) && x > -3 && x < 4; }) && c[2] > 0.05 ? c : null; }
  function faceHTML(img, crop) {   // 只露出裁剪框里的部分
    var key = String(img).split('?')[0], f = typeof AV_FOCUS !== 'undefined' && AV_FOCUS[key], ar = f ? f[3] : AV_AR[key];
    if (crop && ar) f = crop.concat([ar]);
    if (!f) return '<img src="' + img + '" alt="">';
    var l = f[0], t = f[1], sd = f[2]; ar = f[3];
    if (Math.abs(1 - sd) < 0.002) sd = 0.998; if (Math.abs(ar - sd) < 0.002) sd -= 0.004;
    var px = sd < 1 ? l / (1 - sd) * 100 : 50, py = ar > sd ? t / (ar - sd) * 100 : 50;
    return '<span class="av-face" style="background-image:url(\'' + img + '\');background-size:' + (100 / sd).toFixed(1) + '% auto;background-position:' + px.toFixed(1) + '% ' + py.toFixed(1) + '%"></span>';
  }
  var AV_AR = {};   // 没有自动裁切框的立绘：记下高宽比（加载后才知道）
  function avatarInner(spec, name) {
    if (spec && SPMAP[spec.sid]) return faceHTML(avatarForm(spec).img, cropOk(spec.c));
    return esc(Array.from(name || '?')[0] || '?');
  }
  // 获得过的精灵形态：手里每只精灵长到过的形态（含切换装置解锁的），记进 acc.fgot（精灵送走了也还算）
  function formsGot() {
    if (!acc) return {};
    var G = acc.fgot || (acc.fgot = {}), add = false;
    acc.mons.forEach(function (m) {
      var s = SPMAP[m.sid]; if (!s) return; var nat = stageOf(s, m.lv), sh = shinyV(m.shiny) === 2 ? 2 : m.shiny ? 1 : 0;
      for (var i = 0; i <= nat; i++) { var k = m.sid + ':' + i + ':' + sh; if (!G[k]) { G[k] = 1; add = true; } }
    });
    if (add) save();
    return G;
  }
  function renderAvatar() {
    var c = avatarCur(), av = $('who-av');
    av.innerHTML = avatarInner(c, acc.name); av.classList.toggle('img', !!c);
    $('avatar-box').innerHTML = '<b>头像</b><div class="av-row"><span class="pav' + (c ? ' img' : '') + '">' + avatarInner(c, acc.name) + '</span><span class="hint">' + (c ? esc(avatarForm(c).name) + (c.shiny ? ' · 异色' : '') : '名字首字（默认）') + '</span><button type="button" class="btn" id="av-pick">更换头像</button>' + (c && acc.avatarF ? '<button type="button" class="btn ghost" id="av-crop">调整裁剪</button>' : '') + '</div>';
  }
  function openAvatarPicker() {
    $('who-menu').hidden = true;
    var old = $('av-dlg'); if (old) old.remove();
    var c0 = avatarCur(), curK = c0 ? c0.sid + ':' + c0.st + ':' + (c0.shiny === 2 ? 2 : c0.shiny ? 1 : 0) : '';
    var G = formsGot(), keys = Object.keys(G).filter(function (k) { var p = k.split(':'); return SPMAP[p[0]] && SPMAP[p[0]].evo[+p[1]]; });
    var ord = function (sid) { var n = parseInt((SPMAP[sid].evo[0] || {}).no, 10); return isNaN(n) ? 999 : n; };   // 按图鉴编号排
    keys.sort(function (a, b) { var A_ = a.split(':'), B_ = b.split(':'); return ord(A_[0]) - ord(B_[0]) || A_[0].localeCompare(B_[0]) || A_[1] - B_[1] || A_[2] - B_[2]; });
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'av-dlg';
    d.innerHTML = '<div class="soc-box av-box" role="dialog" aria-modal="true" aria-label="更换头像"><span class="tape l"></span><span class="tape r"></span><span class="step">头像</span><h2>选一只精灵当头像</h2>' +
      '<p class="hint">获得过的精灵形态都能选（包括精灵进化前的样子、异色）。社交、名片和讨论区里，其他船员都会看到。</p>' +
      '<div class="av-grid"><button type="button" class="av-opt' + (c0 ? '' : ' on') + '" data-av=""><span class="pav">' + esc(Array.from(acc.name)[0] || '?') + '</span><small>名字首字</small></button>' +
      keys.map(function (k) { var p = k.split(':'), sp = { sid: p[0], st: +p[1], shiny: +p[2] === 2 ? 2 : !!+p[2] }, f = avatarForm(sp); return '<button type="button" class="av-opt' + (k === curK ? ' on' : '') + '" data-av="' + k + '"><span class="pav img">' + faceHTML(f.img) + '</span><small>' + esc(f.name) + (sp.shiny ? '<span class="shiny-tag">异色</span>' : '') + '</small></button>'; }).join('') +
      '</div><div class="soc-foot"><button type="button" class="btn ghost" data-avx="1">取消</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-avx]')) { d.remove(); return; }
      var b = e.target.closest('[data-av]'); if (!b) return;
      if (b.dataset.av === '') { acc.avatar = null; acc.avatarF = null; save(); renderAvatar(); d.remove(); toast('头像改回了名字首字。'); return; }
      var p = b.dataset.av.split(':'); d.remove();
      openAvatarCrop({ sid: p[0], st: +p[1], shiny: +p[2] === 2 ? 2 : !!+p[2] });   // 选好形态后自己裁剪
    });
  }
  /* 头像裁剪：显示完整立绘，上面一个圆框；拖动圆框选位置，滑块（或滚轮、双指）调大小 */
  function openAvatarCrop(sp) {
    $('who-menu').hidden = true;
    var old = $('avc-dlg'); if (old) old.remove();
    var img = avatarForm(sp).img, key = String(img).split('?')[0], F0 = typeof AV_FOCUS !== 'undefined' && AV_FOCUS[key];
    var same = acc.avatarF && acc.avatarF.sid === sp.sid && acc.avatarF.st === sp.st && shinyV(acc.avatarF.shiny) === shinyV(sp.shiny) && cropOk(acc.avatarF.c);
    var C = same ? acc.avatarF.c.slice() : F0 ? F0.slice(0, 3) : [0, 0, 1], ar = F0 ? F0[3] : AV_AR[key] || 1;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'avc-dlg';
    d.innerHTML = '<div class="soc-box av-box avc-box" role="dialog" aria-modal="true" aria-label="裁剪头像"><span class="tape l"></span><span class="tape r"></span><span class="step">头像</span><h2>裁剪头像</h2>' +
      '<p class="hint">拖动圆框选位置，用滑块（或滚轮、双指）调大小。圆框里的部分就是头像。</p>' +
      '<div class="avc-main"><div class="avc-stage" id="avc-stage"><div class="avc-img" id="avc-img"></div><div class="avc-ring" id="avc-ring" aria-hidden="true"></div></div>' +
      '<div class="avc-side"><b>预览</b><div class="avc-prev"><span class="pav img big" id="avc-p1"></span><span class="pav img" id="avc-p2"></span><span class="pav img" id="avc-p3" style="width:28px;height:28px"></span></div>' +
      '<label class="avc-zoom">缩放<input type="range" id="avc-z" min="0" max="100" step="1"></label><button type="button" class="btn ghost" data-avcreset="1">自动对准头部</button><button type="button" class="btn ghost" data-avcfull="1">显示完整立绘</button></div></div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-avcback="1">换一个形态</button><button type="button" class="btn ghost" data-avcx="1">取消</button><button type="button" class="btn primary" data-avcok="1">用这个头像</button></div></div>';
    document.body.appendChild(d);
    var stage = $('avc-stage'), el = $('avc-img'), z = $('avc-z');
    var SMIN = 0.12, SMAX = Math.max(1.2, ar * 1.1);
    var toZ = function (s) { return Math.round(Math.log(SMAX / s) / Math.log(SMAX / SMIN) * 100); }, fromZ = function (v) { return SMAX * Math.pow(SMIN / SMAX, v / 100); };
    function clamp() { var s = C[2]; C[0] = Math.max(-s / 2, Math.min(1 - s / 2, C[0])); C[1] = Math.max(-s / 2, Math.min(ar - s / 2, C[1])); }
    var D = 1, ring = $('avc-ring');
    function draw() {
      clamp(); var SW = stage.clientWidth || 300, SH = stage.clientHeight || 300;
      D = Math.min(SW, SH / ar) * 0.9; var ox = (SW - D) / 2, oy = (SH - D * ar) / 2;   // 完整立绘缩放后放在中间
      el.style.backgroundImage = 'url(\'' + img + '\')'; el.style.backgroundSize = D + 'px auto'; el.style.backgroundPosition = ox + 'px ' + oy + 'px';
      ring.style.left = (ox + C[0] * D) + 'px'; ring.style.top = (oy + C[1] * D) + 'px'; ring.style.width = ring.style.height = (C[2] * D) + 'px';
      ['avc-p1', 'avc-p2', 'avc-p3'].forEach(function (id) { $(id).innerHTML = faceHTML(img, C); });
      z.value = toZ(C[2]);
    }
    function zoomTo(s) { var cx = C[0] + C[2] / 2, cy = C[1] + C[2] / 2; C[2] = Math.max(SMIN, Math.min(SMAX, s)); C[0] = cx - C[2] / 2; C[1] = cy - C[2] / 2; draw(); }
    if (!F0 && !AV_AR[key]) { var im = new Image(); im.onload = function () { ar = AV_AR[key] = im.naturalHeight / im.naturalWidth; SMAX = Math.max(1.2, ar * 1.1); if (!same) C = [0, (ar - 1) / 2, 1]; draw(); }; im.src = img; }
    draw();
    var drag = null, pts = {};
    stage.addEventListener('pointerdown', function (e) { stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; drag = { x: e.clientX, y: e.clientY }; e.preventDefault(); });
    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var ids = Object.keys(pts);
      if (ids.length >= 2) {   // 双指缩放
        var a = pts[ids[0]], b = pts[ids[1]], d0 = Math.hypot(a.x - b.x, a.y - b.y);
        pts[e.pointerId] = { x: e.clientX, y: e.clientY }; a = pts[ids[0]]; b = pts[ids[1]];
        var d1 = Math.hypot(a.x - b.x, a.y - b.y); if (d0 > 0 && d1 > 0) zoomTo(C[2] * d0 / d1); return;
      }
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      C[0] += (e.clientX - drag.x) / D; C[1] += (e.clientY - drag.y) / D; drag = { x: e.clientX, y: e.clientY }; draw();
    });
    var up = function (e) { delete pts[e.pointerId]; var r = Object.keys(pts); drag = r.length ? { x: pts[r[0]].x, y: pts[r[0]].y } : null; };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', function (e) { e.preventDefault(); zoomTo(C[2] * (e.deltaY > 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
    z.addEventListener('input', function () { zoomTo(fromZ(+z.value)); });
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-avcx]')) { d.remove(); return; }
      if (e.target.closest('[data-avcback]')) { d.remove(); openAvatarPicker(); return; }
      if (e.target.closest('[data-avcreset]')) { if (F0) { C = F0.slice(0, 3); draw(); } return; }
      if (e.target.closest('[data-avcfull]')) { var s = Math.max(1, ar); C = [(1 - s) / 2, (ar - s) / 2, s]; draw(); return; }
      if (e.target.closest('[data-avcok]')) {
        acc.avatarF = { sid: sp.sid, st: sp.st, shiny: sp.shiny, c: C.map(function (x) { return Math.round(x * 10000) / 10000; }) }; acc.avatar = null;
        save(); renderAvatar(); d.remove(); toast('头像换成了「' + avatarForm(sp).name + '」。同步到服务器后，其他船员就能看到。');
      }
    });
  }
  $('avatar-box').addEventListener('click', function (e) { e.stopPropagation(); if (e.target.id === 'av-pick') openAvatarPicker(); if (e.target.id === 'av-crop' && acc.avatarF) openAvatarCrop({ sid: acc.avatarF.sid, st: acc.avatarF.st, shiny: shinyV(acc.avatarF.shiny) }); });
  /* ---------- 改名卡：商城 1000 能量，在名字菜单里使用 ---------- */
  var renaming = false;
  function renderRename() {
    var n = (acc && acc.items && acc.items.rename) || 0, box = $('rename-box');
    if (!acc) { box.innerHTML = ''; return; }
    if (renaming && n > 0) {
      box.innerHTML = '<b>改名</b><form class="rn-form" id="rn-form"><input id="rn-name" type="text" maxlength="' + NAME_MAX + '" autocomplete="off" spellcheck="false" value="' + esc(acc.name) + '" aria-label="新的做题家名字">' +
        '<div class="rn-btns"><button type="button" class="btn ghost" id="rn-x">取消</button><button type="submit" class="btn primary">确认改名</button></div><p class="hint" id="rn-msg">最多 ' + NAME_MAX + ' 个字，会消耗 1 张改名卡。</p></form>';
      var inp = $('rn-name'); inp.focus(); inp.select();
      return;
    }
    box.innerHTML = '<b>改名卡</b><p>持有 ' + n + ' 张。' + (n ? '' : '可在荆楚号 · 荆门 · 物资仓储的商城用 1,000 能量兑换。') + '</p>' +
      '<button type="button" class="btn" id="rn-use"' + (n ? '' : ' disabled') + '>使用改名卡</button>';
  }
  $('rename-box').addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.id === 'rn-use') { renaming = true; renderRename(); }
    else if (e.target.id === 'rn-x') { renaming = false; renderRename(); }
  });
  $('rename-box').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = Array.from($('rn-name').value.trim()).slice(0, NAME_MAX).join('');
    if (!v) { $('rn-msg').textContent = '名字不能为空'; return; }
    if (v === acc.name) { $('rn-msg').textContent = '和现在的名字一样'; return; }
    if (!(acc.items.rename > 0)) { renaming = false; renderRename(); return; }
    var old = acc.name;
    acc.items.rename--; acc.name = v; renaming = false; save();
    $('who-menu').hidden = true; renderTop();
    toast('改名成功：「' + old + '」→「' + v + '」。剧情和名片里都会用新名字。');
  });
  /* ---------- 主角性别：创建账号时选，之后在右上角名字菜单里可以随时换（剧情立绘、名片跟着变） ---------- */
  function gender() { return acc && acc.gender === 'f' ? 'f' : 'm'; }
  function playerArt() { return 'p' + gender(); }
  function renderGender() {
    var box = $('gender-box'); if (!box || !acc) return;
    box.innerHTML = '<b>主角形象</b><div class="gd-opts">' + [['m', '男生'], ['f', '女生']].map(function (g) {
      return '<button type="button" class="gd-opt' + (gender() === g[0] ? ' on' : '') + '" data-gender="' + g[0] + '" aria-pressed="' + (gender() === g[0]) + '"><img src="' + CHARS['p' + g[0]] + '" alt=""><span>' + g[1] + '</span></button>';
    }).join('') + '</div>';
  }
  $('gender-box').addEventListener('click', function (e) {
    e.stopPropagation();
    var b = e.target.closest('[data-gender]'); if (!b || !acc || gender() === b.dataset.gender) return;
    acc.gender = b.dataset.gender; save(); renderGender();
    toast('主角形象已换成' + (acc.gender === 'f' ? '女生' : '男生') + '。剧情立绘和名片都会跟着变。');
  });
  $('title-box').addEventListener('change', function (e) { if (e.target.name === 'title') { acc.title = e.target.value || null; save(); renderTitle(); } });
  $('title-box').addEventListener('click', function (e) { e.stopPropagation(); });
  // 2026-10-21：名字菜单里的「重置存档」按钮已删除（有玩家误点把存档清空了）

  /* ---------- 创建账号：输入名字 → 直接进入省实验中学序章，在张老师指引下挑选精灵 ---------- */
  function clip(v) { return Array.from(v).slice(0, NAME_MAX).join(''); }
  function renderOnboard() {
    var ob = ui.ob, el = $('onboard');
    if (acc && !acc.introDone) {   // 2026-10-22：新玩家要读完全部地球剧情（第一 ~ 三段）才进入游戏
      if (ex.mode !== 'intro' || !$('vn')) { var e0 = INTRO_SITES.filter(function (id) { return !prog(id).done; })[0]; if (!e0) { finishIntro(); return; } startVN(e0, 'intro', el, false); }
      return;
    }
    el.innerHTML = '<div class="onboard"><span class="tape l"></span><span class="tape r"></span>' +
      '<h2>欢迎来到 Flame1Down - 1</h2>' +
      '<p>请先创建账号。选择主角的性别，再给自己起一个做题家名字，最多 ' + NAME_MAX + ' 个字。</p>' +
      '<div class="ob-gender" role="radiogroup" aria-label="性别">' + [['m', '男生'], ['f', '女生']].map(function (g) {
        return '<button type="button" class="ob-g' + ((ob.gender || 'm') === g[0] ? ' on' : '') + '" role="radio" aria-checked="' + ((ob.gender || 'm') === g[0]) + '" data-obg="' + g[0] + '"><img src="' + CHARS['p' + g[0]] + '" alt=""><b>' + g[1] + '</b></button>';
      }).join('') + '</div>' +
      '<form class="namebox" id="ob-form"><input id="ob-name" type="text" autocomplete="off" spellcheck="false" placeholder="输入做题家名字" aria-label="做题家名字" value="' + esc(ob.name) + '">' +
      '<span class="cnt" id="ob-cnt"></span><button class="btn primary" id="ob-next" type="submit">开始</button></form>' +
      '<p class="hint" id="ob-msg">名字会显示在页面最上方，也会出现在剧情对话里。</p></div>';
    var inp = $('ob-name');
    var sync = function () {
      var v = clip(inp.value); if (v !== inp.value) inp.value = v; ob.name = v;
      var n = Array.from(v.trim()).length; $('ob-cnt').textContent = Array.from(v).length + ' / ' + NAME_MAX; $('ob-next').disabled = !n;
    };
    inp.addEventListener('input', sync); sync();
    $('ob-form').addEventListener('submit', function (e) { e.preventDefault(); if (!ob.name.trim()) return; createAccount(ob.name.trim()); });
    el.querySelector('.ob-gender').addEventListener('click', function (e) { var b = e.target.closest('[data-obg]'); if (!b) return; ob.gender = b.dataset.obg; renderOnboard(); });
    setTimeout(function () { try { inp.focus(); } catch (er) {} }, 0);
  }
  $('onboard').addEventListener('click', function (e) { if (ex.mode === 'intro' && $('vn')) vnClick(e); });
  function createAccount(name) {
    acc = { v: 1, name: name, gender: ui.ob.gender === 'f' ? 'f' : 'm', created: Date.now(), starter: null, rival: null, next: 1, mons: [], teams: [[], []], active: 0, introDone: false, story: {}, exp: 0, energy: 0, items: {}, expV: expV(), matsV: 1, milV: 3, split8: 1, titles: [] };
    save(); renderTop(); HSVIEW.to(0, 0);
  }
  // 序章里选定初始精灵；Vanber 选克制主角的那只
  function rivalOf(sid) {
    var t = SPMAP[sid].types[0];
    return STARTERS.filter(function (x) { return x !== sid && eff(SPMAP[x].types[0], t) > 1; })[0] || STARTERS.filter(function (x) { return x !== sid; })[0];
  }
  function pickStarter(sid, then) {   // 走交易（js/engine/story.js）
    txRun('story', { a: 'pick', sid: sid }, function (r) { ui.sel = r.u; if (then) then(); });
  }
  var INTRO_SITES = ['school', 'river', 'jiuquan'];
  function finishIntro() {
    acc.introDone = true; ex.mode = null; ex.view = 'planets'; stopTimers(); save();
    $('onboard').innerHTML = '';
    ui.welcome = true; page = 'bag'; savePage(); renderTop(); HSVIEW.to(0, 0);
  }

  /* ---------- 共用：精灵卡片、资料面板 ---------- */
  function monCard(m, cls, extra) {
    var f = form(m), s = SPMAP[m.sid];
    return '<span class="cimg"><img src="' + f.img + '" alt="">' + (m.shiny ? '<span class="shiny-tag">异色</span>' : '') + '</span><span class="nm">' + esc(f.name) + '</span><span class="lv">LV' + m.lv + '</span><span class="tc">' + tchips(s.types) + '</span>' + (extra || '');
  }
  function evoLine(m) {
    var s = SPMAP[m.sid], st = stageOf(s, m.lv);
    return '<div class="evo-line">' + s.evo.map(function (e, i) {
      var n = formRawName(s, i); n = n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i);
      if ((s.placeholder || s.tbdForms) && i > 0) n = '？';
      return (i ? '<span>→ LV' + e.lv + ' →</span>' : '') + '<b class="' + (i === st ? 'cur' : '') + '">' + esc(n) + '</b>';
    }).join('') + '</div>';
  }
  // 2026-10-24：奥多亚克在背包 / 仓库 / Wiki 里可以切换形态查看技能（只是查看，战斗开始依然是稳态）
  var ODO_FORMS = [['', '稳态'], ['atk', '歼灭形态'], ['def', '护阵形态']];
  function odoMoveAs(n, f) { if (!f) return n; if (n === '歼灭形态' && f === 'atk') return '护阵形态'; return ODO_VAR[n] ? ODO_VAR[n][f === 'atk' ? 0 : 1] : n; }
  function odoImgAs(img, f) { var F = typeof FORM_FX_SPRITES !== 'undefined' && FORM_FX_SPRITES.odo; return f && F && F[f] ? F[f] : img; }
  function odoTabs(cur, attr) { return '<div class="odo-tabs"><span class="hint">查看形态</span>' + ODO_FORMS.map(function (x) { return '<button type="button" class="chip' + (x[0] === cur ? ' on' : '') + '" ' + attr + '="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '<span class="hint">只是查看，战斗开始时依然是稳态</span></div>'; }
  function monDetail(m) {
    if (!m) return '<p class="empty-note">点击一只精灵查看资料、配置技能。</p>';
    var s = SPMAP[m.sid], f = form(m), a = avail(m.sid, m.lv, m.hl || []), n = m.moves.length, ts = teamsOf(m.u);
    var odoOn = m.sid === 'odo' && isFin(s, f.stage), odoF = odoOn && ui.odoF && ui.odoF.u === m.u ? ui.odoF.f : '';
    var free = m.evFree || 0, sum = evSum(m), stats = '', iv = ivOf(m), ivSum = iv ? STAT_KEYS.reduce(function (a, k) { return a + iv[k]; }, 0) : 0;
    STAT_KEYS.forEach(function (k) {
      var b = s.base[k], v = stat(m, k), ev = (m.ev && m.ev[k]) || 0, nm = natureMult(m.nat, k), room = Math.min(free, EV_MAX - ev, EV_TOTAL - sum);
      stats += '<span>' + BASE_NAME[k] + '</span><span class="sv' + (nm > 1 ? ' up' : nm < 1 ? ' dn' : '') + '" title="' + (nm > 1 ? '性格加成 +10%' : nm < 1 ? '性格修正 −10%' : '') + '">' + v + (nm > 1 ? '↑' : nm < 1 ? '↓' : '') + '</span>' +
        '<span class="bar"><i style="width:' + Math.min(100, b / 150 * 100) + '%"></i></span><span class="real"><span class="bs">种族值 ' + b + (iv ? ' · ' : '') + '</span>' + (iv ? '<span class="ivv' + (iv[k] >= 31 ? ' max' : iv[k] >= 26 ? ' hi' : iv[k] <= 5 ? ' lo' : '') + '" title="天赋 0~31，越高越强">天赋 ' + iv[k] + '</span>' : '') + '</span>' +
        '<span class="evc">' +
        '<b title="学习力 ' + ev + ' / ' + EV_MAX + '，能力值 +' + Math.floor(ev / 10) + '">' + ev + '<small>+' + Math.floor(ev / 10) + '</small></b>' +
        '<button type="button" data-ev="' + k + '" data-d="1"' + (room > 0 ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 +1">+1</button><button type="button" data-ev="' + k + '" data-d="10"' + (room > 0 ? '' : ' disabled') + ' aria-label="' + BASE_NAME[k] + '学习力 +10">+10</button></span>';
    });
    stats = '<div class="nat"><b>性格 · ' + m.nat + '</b><span>' + natText(m.nat) + '</span></div>' +
      '<div class="evhead"><b>学习力</b><span>可分配 <b class="' + (free ? 'red' : '') + '">' + free + '</b> · 已分配 ' + sum + ' / ' + EV_TOTAL + '</span><span class="hint">每 10 点学习力 = 1 点能力值，单项最多 ' + EV_MAX + '。战斗胜利后，出战过的精灵各得 1 点。<b>已经分配的学习力不能退回</b>，想好再加。</span></div>' +
      (iv ? '<div class="ivhead"><b>天赋</b><span>合计 ' + ivSum + ' / 186 ' + gradeTag(m) + '</span><span class="hint">每项能力的天赋是 0~31 的随机数，越高越强。用「天赋重组合剂」可以把六项天赋全部重新随机。合计 0~89 一般，90~119 良，120~149 优，150~169 稀，170 以上极品。</span></div>' : '') +
      '<div class="stats evstats">' + stats + '<span class="sum">实际能力值 = LV' + m.lv + ' 的数值（受种族值和天赋影响） + 学习力加成，再乘性格修正' + (s.placeholder ? ' · 数值为占位' : s.unsure && s.unsure.length >= 6 ? ' · 种族值暂定' : '') + '</span></div>';
    var row = function (mv) {
      var M_ = M[odoMoveAs(mv, odoF)] || M[mv], on = m.moves.indexOf(mv) >= 0, ok = a.indexOf(mv) >= 0, id = 'am-' + m.u + '-' + mv;
      var meta = M_.cat + (M_.power ? ' · 威力' + M_.power : '') + (M_.pri ? ' · 先制+' + M_.pri : '') + ' · PP' + M_.pp;
      return '<label class="mrow' + (on ? ' on' : '') + (M_.hidden ? ' hid' : '') + (ok ? '' : ' locked') + '" for="' + id + '">' +
        '<input type="checkbox" id="' + id + '" data-amove="' + mv + '"' + (on ? ' checked' : '') + (ok ? '' : ' disabled') + '>' +
        '<span class="l1"><span class="mn">' + M_.name + '</span>' + atkTip(M_.type) + '<span class="mm">' + meta + '</span>' +
        (M_.hidden ? '<span class="tag sc hidtag" tabindex="0">隐藏<span class="tip" role="tooltip"><b>隐藏技能</b>' + (HL_GATED[m.sid] ? '用道具解锁的特殊技能（解锁一次，同一种族的精灵都能用），精灵要到 LV' + HIDDEN_MIN_LV + ' 以上才能装备' : LEARN[mv] ? '在战斗中领悟的特殊技能，精灵要到 LV' + HIDDEN_MIN_LV + ' 以上才能领悟' : '达到 LV50 时习得') + '</span></span>' : '') +
        (ok ? '' : '<span class="lock">' + lockText(m, mv) + '</span>') + '</span><span class="md">' + esc(M_.d) + '</span></label>';
    };
    var acts = acc.teams.map(function (t, i) {
      var k = t.indexOf(m.u);
      if (k >= 0) return (k > 0 ? '<button class="btn" type="button" data-lead="' + i + '">设为' + tName(i) + '首发</button>' : '') + '<button class="btn ghost" type="button" data-out="' + i + '">移出' + tName(i) + '</button>';
      return '<button class="btn primary" type="button" data-in="' + i + '"' + (t.length >= TEAM_SIZE ? ' disabled title="' + tName(i) + '已满 5 只"' : '') + '>加入' + tName(i) + '</button>';
    }).join('');
    return '<span class="tape r"></span>' +
      '<div class="d-head"><button type="button" class="d-art" data-abig="' + m.sid + '|' + f.stage + '" title="点击查看大图" aria-label="查看' + esc(f.name) + '的大图"><img src="' + (odoF && !m.shiny ? odoImgAs(f.img, odoF) : f.img) + '" alt="' + esc(f.name) + '"></button><div>' +
      '<h3>' + (f.no ? '<span class="dexno">No.' + f.no + '</span>' : '') + esc(f.name) + (f.unsure ? '<i class="q" title="字迹没看清">?</i>' : '') + (m.shiny ? '<span class="shiny-tag big" title="异色精灵：和同类长得不一样的稀有配色">异色</span>' : '') + '</h3>' +
      '<p style="margin:0 0 6px"><span class="lvbig">LV' + m.lv + '</span>' + tchips(s.types) + '</p>' +
      '<p class="hint">' + stageLabel(s, f.stage) + (!isFin(s, f.stage) ? ' · 最终进化为' + (s.placeholder || s.tbdForms ? '？' : s.name) : '') +
      (ts.length ? ' · ' + ts.map(function (x) { return tName(x.t) + (x.lead ? '首发' : ''); }).join('、') : ' · 未加入配队') + '</p>' +
      (f.d ? '<p class="formdesc">' + esc(f.d) + '</p>' : '') + evoLine(m) + formSwitchHTML(m) + (s.placeholder ? '<p class="placeholder-note" style="margin-top:6px">数值和技能还是占位，二阶和最终形态还没画出来</p>' : s.tbdForms ? '<p class="placeholder-note" style="margin-top:6px">二阶和最终形态还没画出来</p>' : '') + '</div></div>' +
      mdFold('exp', '经验', '', expBox(m)) + mdFold('stats', '能力', '性格 · ' + m.nat, stats) +
      mdFold('trait', '特性', esc(s.ability.n), '<div class="trait"><p><b>特性 · ' + esc(s.ability.n) + '</b>　<span class="blue">' + esc(s.ability.d) + '</span></p>' + (s.ability.extra ? '<p class="blue" style="font-size:13px">' + esc(s.ability.extra) + '</p>' : '') +
      (acc.emblems && acc.emblems[m.sid] && EMBLEMS[m.sid] ? '<p><b>纹章 · ' + EMBLEMS[m.sid].m + '</b>　<span class="blue">' + esc(EMBLEMS[m.sid].d) + '</span></p>' : '') + '</div>') +
      mdFold('ins', '刻印', (Array.isArray(m.ins) ? m.ins.filter(Boolean).length : 0) + ' / 3', insHTML(m)) + (monItemsHTML(m) ? mdFold('items', '精灵道具', '', monItemsHTML(m)) : '') +
      mdFold('moves', '出战技能', n + ' / 4', '<div><div class="moves-head"><h4>出战技能 <span class="' + (n === 4 ? 'blue' : 'red') + '">' + n + '/4</span></h4>' +
      '<span class="hint">普通技能 LV1 学会第 1 个，之后每 5 级学会一个；隐藏技能要在战斗中满足特定条件才能领悟</span></div>' +
      (odoOn ? odoTabs(odoF, 'data-odof="' + m.u + '" data-of') : '') +
      '<div class="mlist">' + s.moves.concat(s.hidden).filter(function (mv) { return a.indexOf(mv) >= 0; }).map(row).join('') + '</div>' + nextMoveHint(m) + '</div>') +
      '<div class="d-actions">' + acts + '</div>';
  }
  // 精灵资料的各个板块可以折叠（2026-11-01）：折叠状态记在本机，背包、仓库共用
  var MD_FOLD = {}; try { MD_FOLD = JSON.parse(localStorage.getItem('hs-mdfold') || '{}') || {}; } catch (e) {}
  function mdFold(k, title, sub, inner) {
    if (!inner) return '';
    return '<details class="md-fold" data-mdfold="' + k + '"' + (MD_FOLD[k] ? '' : ' open') + '><summary><b>' + title + '</b>' + (sub ? '<span class="mdf-sub">' + sub + '</span>' : '') + '</summary><div class="mdf-body">' + inner + '</div></details>';
  }
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || !d.dataset || !d.dataset.mdfold) return;
    var k = d.dataset.mdfold; if (d.open) delete MD_FOLD[k]; else MD_FOLD[k] = 1;
    try { localStorage.setItem('hs-mdfold', JSON.stringify(MD_FOLD)); } catch (e2) {}
  }, true);
  // 下一个技能在几级学会（不透露技能名）
  function nextMoveHint(m) {
    var s = SPMAP[m.sid], nx = 0;
    for (var i = 0; i < s.moves.length; i++) if (m.lv < learnLv(i)) { nx = learnLv(i); break; }
    if (!nx && m.lv < 50 && s.hidden.some(function (n) { return !LEARN[n]; })) nx = 50;
    return nx ? '<p class="hint" style="margin-top:6px">下一个技能将在 LV' + nx + ' 学会。</p>' : '';
  }
  function onDetailChange(e) {
    var cb = e.target.closest('input[data-amove]'); if (!cb) return;
    var m = mon(ui.sel); if (!m) return;
    var n = cb.dataset.amove;
    if (cb.checked) { if (m.moves.length >= 4) { cb.checked = false; flash('最多带 4 个技能，先取消一个'); return; } m.moves.push(n); }
    else m.moves.splice(m.moves.indexOf(n), 1);
    save(); renderTop();
  }
  function onDetailClick(e) {
    var m = mon(ui.sel); if (!m) return;
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.abig) { var q = b.dataset.abig.split('|'); H.big(q[0], +q[1]); return; }
    if (b.dataset.insslot) { insPick(m, +b.dataset.insslot); return; }
    if (b.dataset.insx) { if (b.disabled) return; txRun('insX', { u: m.u }, function () { renderTop(); toast(form(m).name + ' 的第 3 个刻印槽开启了！'); }); return; }
    if (b.dataset.ev) {
      var k = b.dataset.ev, d = +b.dataset.d, ev = m.ev[k] || 0, free = m.evFree || 0;
      d = d > 0 ? Math.min(d, free, EV_MAX - ev, EV_TOTAL - evSum(m)) : 0;   // 已分配的学习力不能退回
      if (d > 0) txRun('ev', { u: m.u, k: k, d: d }, function () { renderTop(); });   // 走交易（grow.js）
      return;
    }
    if (b.dataset.lvcap) {
      var nx = capNext(m);
      if (!nx || !(m.lv >= BASE_CAP)) return;
      if ((acc.items[nx.k] || 0) < nx.jade) { toast(itemName(nx.k) + '不够：需要 ' + nx.jade + ' 个。'); return; }
      txRun('lvcap', { u: m.u }, function (res) { renderTop(); toast(form(m).name + ' 的等级上限提高到了 LV' + res.lv + '！现在可以继续喂经验了。'); }); return;
    }
    if (b.dataset.fsw != null) {   // 外观形态：免费切换
      var fi = +b.dataset.fsw, natS = stageOf(SPMAP[m.sid], m.lv);
      if (fi >= natS) delete m.fs; else if (Array.isArray(m.fu) && m.fu.indexOf(fi) >= 0) m.fs = fi; else return;
      save(); renderTop(); return;
    }
    if (b.dataset.muse) {
      var ns = b.closest('.md-it') && b.closest('.md-it').querySelector('[data-mnat]');
      applyMonItem(b.dataset.muse, m, ns && ns.value, function (r) { toast(r.msg); if (r.ok) renderTop(); }); return;
    }
    if (b.dataset.in != null) { var t = acc.teams[+b.dataset.in]; if (t.length < TEAM_SIZE && t.indexOf(m.u) < 0) t.push(m.u); }
    else if (b.dataset.out != null) { var t2 = acc.teams[+b.dataset.out]; t2.splice(t2.indexOf(m.u), 1); }
    else if (b.dataset.lead != null) { var t3 = acc.teams[+b.dataset.lead]; t3.splice(t3.indexOf(m.u), 1); t3.unshift(m.u); }
    else if (b.dataset.give) {
      var need = expAt(Math.min(capLv(m), m.lv + 1)) - m.exp, amt;
      if (b.dataset.give === 'lv') amt = need; else if (b.dataset.give === 'all') amt = acc.exp; else if (b.dataset.give === 'in') amt = Math.floor(+b.closest('.expbox').querySelector('#exp-in').value) || 0; else amt = +b.dataset.give;
      if (!acc.exp) { ui.expMsg = { u: m.u, t: '经验背包里没有经验了。', bad: 1 }; renderTop(); return; }
      if (amt <= 0) { ui.expMsg = { u: m.u, t: '请输入要分配的经验数量。', bad: 1 }; renderTop(); return; }
      if (amt > acc.exp) { ui.expMsg = { u: m.u, t: '经验不足：经验背包里只有 ' + fmt(acc.exp) + ' 点。', bad: 1 }; renderTop(); return; }
      txRun('feed', { u: m.u, amt: Math.floor(amt) }, function (res) {   // 走交易（grow.js）
        var r = res.g ? gainMsg(res.g) : null; ui.expMsg = { u: m.u, t: r || '已经到等级上限 LV' + capLv(m) + ' 了。', bad: !r };
        renderTop();
      });
      return;
    } else return;
    save(); renderTop();
  }
  function expBox(m) {
    var maxed = atCap(m), cur = m.exp - expAt(m.lv), span = maxed ? 1 : expAt(m.lv + 1) - expAt(m.lv), need = maxed ? 0 : expAt(m.lv + 1) - m.exp;
    var room = expAt(capLv(m)) - m.exp, msg = ui.expMsg && ui.expMsg.u === m.u ? ui.expMsg : null;
    return '<div class="expbox"><div class="exp-head"><h4>经验</h4><span class="hint">经验背包：<b class="blue">' + fmt(acc.exp) + '</b> 点</span></div>' +
      '<div class="exp-bar"><i style="width:' + (maxed ? 100 : Math.min(100, cur / span * 100)) + '%"></i></div>' +
      '<p class="exp-txt">LV' + m.lv + (maxed ? ' · 已达等级上限 LV' + capLv(m) : ' · 本级 ' + fmt(cur) + ' / ' + fmt(span) + ' · 距 LV' + (m.lv + 1) + ' 还需 <b>' + fmt(need) + '</b>') + ' · 累计 ' + fmt(m.exp) + '</p>' +
      (maxed ? '' : '<div class="exp-ctl"><button type="button" class="btn" data-give="lv"' + (acc.exp >= need ? '' : ' disabled') + '>升 1 级（' + fmt(need) + '）</button>' +
        '<button type="button" class="btn ghost" data-give="100"' + (acc.exp >= 100 && room >= 100 ? '' : ' disabled') + '>+100</button>' +
        '<button type="button" class="btn ghost" data-give="all"' + (acc.exp ? '' : ' disabled') + '>全部分配</button>' +
        '<span class="exp-in"><input type="number" id="exp-in" min="1" step="1" max="' + Math.min(acc.exp, room) + '" placeholder="数量" inputmode="numeric" aria-label="分配的经验数量"><button type="button" class="btn primary" data-give="in"' + (acc.exp ? '' : ' disabled') + '>分配</button></span></div>') +
      capBox(m) +
      (msg ? '<p class="exp-msg' + (msg.bad ? ' red' : '') + '">' + esc(msg.t) + '</p>' : '') + '</div>';
  }
  // 达到 70 级以后，经验栏里才出现「等级上限」
  function capBox(m) {
    if (m.lv < BASE_CAP) return '';
    var nx = capNext(m), g = capGem(m), have = nx ? acc.items[nx.k] || 0 : 0;
    return '<div class="cap-box"><b>等级上限 LV' + capLv(m) + '</b>' +
      (nx ? '<span class="hint">' + (CAP_SID[m.sid] ? form(m).name : USE_ITEMS[nx.k].gem + '系精灵') + '可以用「' + itemName(nx.k) + '」解锁更高的等级上限。</span><button type="button" class="btn' + (have >= nx.jade ? ' primary' : '') + '" data-lvcap="1"' + (have >= nx.jade && (acc.items.grail || 0) >= (nx.grail || 0) ? '' : ' disabled') + '>用 ' + nx.jade + ' 个' + itemName(nx.k) + (nx.grail ? ' + ' + nx.grail + ' 个圣杯' : '') + '解锁 LV' + nx.lv + ' 上限</button><span class="hint">' + itemName(nx.k) + '：' + fmt(have) + ' 个</span>'
        : '<span class="hint">' + (g ? '已经解锁到目前的最高上限 LV' + CAP_STEPS[CAP_STEPS.length - 1].lv + '，暂时无法再提高。' : '这只精灵目前最高 LV' + capLv(m) + '。提高等级上限的方法，以后会陆续开放。') + '</span>') + '</div>';
  }
  function flash(t) { var el = document.querySelector('#bag-panel .flash') || document.querySelector('.page:not([hidden]) .flash'); if (el) { el.textContent = t; el.classList.add('red'); } }

  /* ---------- 道具与储存箱 ----------
   * 精灵道具：直接用在某只精灵身上的（USE_ITEMS，kind：nat 改性格，ev 加学习力），在精灵资料里就能调出来用，储存箱里也能用
   * 一般道具：捕捉装置、补药（对战中用）、改名卡、自律训练装置、挑战许可
   * 储存箱（主菜单，黄冈秘鉴和社交中间）列出所有道具 */
  var USE_ITEMS = GROW.USE_ITEMS;   // 精灵道具的数据和用法在 js/engine/grow.js（服务器和浏览器共用，2026-10-25）
  var MON_ORDER = ['formDev', 'earthShard', 'floraJade', 'kbDrop', 'ppAsh', 'ltOrb', 'whFrost', 'moonStone', 'boneDust', 'tgPearl', 'brTwig', 'odoFin', 'hrDisk', 'phLeaf', 'fencArc', 'deathTok', 'ivMoon', 'ivBone', 'ivReroll', 'ev50', 'evAny', 'evTagore', 'natAny', 'natRand', 'natTagore', 'evReset', 'fruit1', 'fruit2'], GEN_ORDER = ['trans', 'helmet', 'dive', 'auto', 'rename', 'cap1', 'cap2', 'cap3', 'pot1', 'pot2', 'pot200'];
  // 剧情道具：主线里拿到的，不能使用也不会消耗
  var KEY_ITEMS = {
    trans: { name: '精灵翻译器', d: '汉街总部国际A座的情报显示，这个翻译器能凭一己之力考到雅思 6.5 分。这样一来，翻译精灵的语言也一定能行吧……', img: 'translator' },
    helmet: { name: '烟雾保护头盔', d: 'Bttp 用无人机空投下来的头盔，戴上后在浓密的瘴气里也能呼吸、看清路。很容易摔坏。', img: 'helmet' },
    shovel: { name: '小铲子', d: '编钟通讯站的 Jager 上尉翻了半天柜子才找出来的小铲子，取土样正合适。她说用完要还……但好像一直没来要。', img: 'shovel' },
    dive: { name: '潜水头盔', d: '编钟通讯站的 Jager 上尉发的头盔，Bttp 调过参数。戴上后能在水里呼吸，也能和精灵翻译器连在一起用。从三楼掉下去也砸不坏。', img: 'dive' }
  };
  // 野外采集物：每个区域 2 个采集点，每个点每天 1 次。星砂做加强装置，圣晶石做华为装置。
  var GATHER_ITEMS = {
    g_sand: { name: '星砂', d: '从星球表面收来的矿砂，冶炼坊用来装配加强捕捉装置。', from: '芙罗拉星的丛林和草甸、坎伯兰星的水面、浅水区和深海区、庞贝星的熔岩原', n: 12 },
    g_core: { name: '圣晶石', d: '雷暴和永冻里凝出来的七彩晶石，10 颗可以合成一个华为捕捉装置。', from: '活动「明明教官的试炼」每关每个难度首次通过', n: 1 }
  };
  GATHER_ITEMS.grail = { name: '圣杯', d: '通关一章主线时获得的金色圣杯。精灵 80 级以后，每突破 2 级等级上限，都要用掉 1 个圣杯。', from: '通关每一章主线（之前通关的已补发）', n: 1 };   // 2026-11-01
  GATHER_ITEMS.relPt = { name: '放生点数', d: '放生精灵时获得的点数。稀有度越高的精灵，放生时给的点数越多（异色 ×3）。', from: '精灵一览 · 放生', n: 1 };   // 2026-11-01
  var GATHER_ORDER = ['g_sand', 'g_core', 'grail', 'relPt'];
  // 精灵素材：旅行精灵掉落的叶片，以及合成出来的精元（精元放进神农架 · 精灵保育仓孵化，见 NURSERY）
  var MATS = {
    m_lcleaf: { name: '叶子喵的叶片', d: '旅行精灵叶子喵身上掉下来的叶片，还带着一点光。5 片可以在冶炼坊合成叶子喵的精元。' },
    e_odo: { name: '奥多的精元', d: '击败简单难度的BOSS「奥多亚克」后，从深海里带回来的一团精元。放进神农架 · 精灵保育仓，孵化 8 小时后会诞生一只奥多。', hatch: { sid: 'odo', lv: 1, min: 480 } },
    e_leafcat: { name: '叶子喵的精元', d: '用 5 片叶子喵的叶片凝成的精元。放进神农架 · 精灵保育仓，孵化 8 小时后会诞生一只叶子小小喵。', hatch: { sid: 'leafcat', lv: 1, min: 480 } }
  };
  MATS.e_pluto = { name: '帕努托尔的精元', d: '在先驱之塔的代币商店兑换的精元。放进神农架 · 精灵保育仓，孵化 12 小时后会诞生一只帕努。', hatch: { sid: 'pluto', lv: 1, min: 720 } };
  MATS.m_psac = { name: '蘑菇毒囊', d: '玛西一族身上的毒囊，鼓鼓的，别捏破。1 个加 5 个药草，可以在黄石 · 冶炼坊合成「解毒药剂」。' };   // 2026-10-27
  MATS.m_hfhorn = { name: '赫菲角片', d: '赫菲一系身上掉下来的角片，还带着一点余温。60 片可以在黄石 · 冶炼坊合成「奇声号角」。' };
  MATS.m_sj = { name: '沙姜', d: '长在坎伯兰星深海礁石缝里的沙姜。辰爷说，捣碎了能消肿止痛。' };
  MATS.m_xml = { name: '小米辣', d: '长在坎伯兰星深海礁石缝里的小米辣，光是闻一下眼泪就要出来了。' };
  MATS.m_horn = { name: '奇声号角', d: '用 60 片赫菲角片做成的号角，吹起来声音很奇怪。在坎伯兰星 · 水面的「冥岛」吹响，会引来一只可以捕捉的塞米；和它进入战斗时，号角就会用掉。' };
  MATS.m_mcry = { name: '马亚尔晶体', d: '泰戈尔每周挑战必掉的晶体，凝着马亚尔星系各处的能量。在黄石 · 冶炼坊每 10 个可以换成 10 个任意一种星球特产（芙罗拉玉、不化水滴、火山灰烬、闪电球体、永久冻土）。' };
  MATS.m_cu = { name: '马亚尔煤炭', d: '在芙罗拉星、坎伯兰星的野外挖到的煤炭。可以在荆楚号 · 宜昌的三峡能源核心换成能量。' };
  MATS.m_fe = { name: '马亚尔铁矿', d: '在芙罗拉星、坎伯兰星的野外挖到的铁矿石，比煤炭更值钱。可以在荆楚号 · 宜昌的三峡能源核心换成能量。' };
  // 2026-11-01 圣晶石召唤：当期 UP 精灵和稀有精灵的精元（孵化规则在 grow.js 的 HATCH）
  var SUM_ESS = Object.keys(GROW.HATCH).filter(function (k) { return GROW.HATCH[k].sum; });
  SUM_ESS.forEach(function (k) { var H0 = GROW.HATCH[k], sp0 = SPMAP[H0.sid], n0 = sp0.evo[0].n || sp0.name; MATS[k] = { name: n0 + '的精元', d: (H0.sum === 'up' ? '圣晶石召唤 · 限定精灵的精元。' : '圣晶石召唤获得的稀有精灵精元。') + '放进神农架 · 精灵保育仓，孵化 ' + (H0.min / 60) + ' 小时后会诞生一只' + n0 + '。', hatch: { sid: H0.sid, lv: H0.lv, min: H0.min } }; });
  // 刻印、刻印激活晶片、友情点、召唤代币（js/engine/summon.js）
  var INS_ITEMS = {}, INS_KEYS = Object.keys(SUMMON.INS);
  INS_KEYS.forEach(function (k) { var I0 = SUMMON.INS[k]; INS_ITEMS[k] = { name: I0.name, d: SUMMON.insDesc(k) + '。' + (I0.lim ? '圣晶石召唤 · 限定刻印。' : '常规刻印。') + '在精灵资料的「刻印」里装备，装备后和那只精灵绑定，只在 PVE 对战中生效。' }; });
  INS_ITEMS.insChip = { name: '刻印激活晶片', d: '开启一只精灵的第 3 个刻印槽。在精灵资料的「刻印」里使用。圣晶石召唤有 2% 的概率获得。' };
  INS_ITEMS.fPt = { name: '友情点', d: '友情点召唤用的点数。社交里每天可以给每位好友各送一次经验（双方各 200 点，自己每天从送礼最多拿 2000 点）；借用好友的助战精灵，双方各 100 点（每天最多 1000 点）。' };
  INS_ITEMS.sumTok = { name: '召唤代币', d: '每次圣晶石召唤送 10 个，抽到当期 UP 再送 200 个。可以在召唤代币商店兑换圣晶石、UP 精灵的专属道具和限定刻印。' };
  var MAT_ORDER = SUM_ESS.concat(['m_lcleaf', 'e_leafcat', 'e_pluto', 'e_odo', 'm_psac', 'm_hfhorn', 'm_horn', 'm_mcry', 'm_cu', 'm_fe', 'ctTicket', 'ctShare']);
  // 太空种植园只种药草。min 是成熟分钟，yield 是收获数量。收获时退回种子。
  var SEEDS = GROW.SEEDS;   // 在 js/engine/grow.js

  var CROPS = {
    c_herb: { name: '药草', d: '太空种植园收获的药草。1 份可以在冶炼坊合成一瓶 100hp药水，2 份合成一瓶 200hp药水。' },
    c_rice: { name: '米饭', d: '水稻收获后煮好的米饭，一粒一粒数得清。500 粒可以在冶炼坊盛成一碗饭。' },
    c_flower: { name: '活力花卉', d: '太空种植园收获的蓝色小花，闻一闻就精神了。可以在冶炼坊炼成 pp 药水：3 朵一瓶 10PP、5 朵一瓶 20PP。' },
    c_bowl: { name: '一碗饭', d: '满满一碗香喷喷的米饭。拿到庞贝星的熔岩原，放在一个场景里，说不定会引来爱吃米饭的精灵。' }
  };
  var SEED_ORDER = ['s_herb', 's_flower', 's_rice'];
  var CROP_ORDER = ['c_herb', 'c_flower', 'c_rice', 'c_bowl'];
  var BAG_ORDER = MON_ORDER.concat(GEN_ORDER);
  /* 储存箱里每个道具的说明，分三栏：简介（是什么）、用途（怎么用、能做什么）、获得方式（2026-10-25 整理） */
  var SPEC_OF = { floraJade: ['芙罗拉星', '玛西露姆、六尾风王、卡莱奥丹', '草', '芙罗拉星的丛林、草甸'], kbDrop: ['坎伯兰星', '坎克托斯、戈耳贡、塞壬', '水', '坎伯兰星的水面、浅水区、深海区'], ppAsh: ['庞贝星', '赫菲斯托、费尔茅斯、冲锋火鸡', '火', '庞贝星的熔岩原、饮火城'], ltOrb: ['莱汀陨石带', '雷公、法拉第', '电', '莱汀陨石带'], whFrost: ['白之星', '霜冻之冠', '冰', '白之星'] };
  var SPEC_EWK = { floraJade: '草', kbDrop: '水', ppAsh: '火', ltOrb: '电', whFrost: '冰' };
  var ITEM_INFO = {
    // 战斗道具
    cap1: ['最普通的精灵捕捉装置。', '野外对战时在「道具」页投向野生精灵。对方体力越低、身上有异常状态时越容易成功（占用一回合）。', '荆门 · 物资仓储的商城（200 能量）；世界任务「草甸上的奔跑者」、支线「物资仓储」、排位赛季段位奖励也会送。'],
    cap2: ['加强版的捕捉装置。', '野外对战时使用，捕捉成功率是普通装置的 1.5 倍（占用一回合）。', '黄石 · 冶炼坊用星砂 ×50 合成。'],
    cap3: ['华为出品的捕捉装置，从不失手。', '野外对战时使用，必定捕捉成功（占用一回合）。', '黄石 · 冶炼坊用圣晶石 ×10 合成；先驱之塔的代币商店（80 先驱代币）。'],
    pot1: ['一小瓶补药。', '对战中为出战精灵恢复 30% 最大体力（占用一回合）。', '荆门 · 物资仓储的商城（100 能量）；世界任务「林下的蘑菇」。'],
    pot2: ['浓缩过的补药。', '对战中为出战精灵恢复 50% 最大体力（占用一回合）。', '荆门 · 物资仓储的商城（250 能量）。'],
    antidote: ['用蘑菇毒囊和药草调成的解毒药。', '对战中解除出战精灵身上全部的中毒状态，不管叠了几层（占用一回合）。', '黄石 · 冶炼坊用蘑菇毒囊 ×1、药草 ×5 合成。'],
    m_psac: ['玛西一族身上的毒囊，鼓鼓的，别捏破。', '1 个加 5 个药草，在黄石 · 冶炼坊合成「解毒药剂」。', '在野外击败玛西一族，每只有 10% 的概率掉落。'],
    pot100: ['用药草熬成的 hp 药水。', '对战中为出战精灵恢复 100 点体力（占用一回合）。', '黄石 · 冶炼坊用药草 ×1 合成。'],
    pot200: ['用药草熬成的 hp 药水，比 100hp 药水更浓。', '对战中为出战精灵恢复 200 点体力（占用一回合）。', '黄石 · 冶炼坊用药草 ×2 合成。'],
    pp5: ['用活力花卉炼成的蓝色药水。', '对战中为出战精灵的每个技能各恢复 5 点 PP（占用一回合）。', '已停止合成，手里有的照样能用。'],
    pp10: ['用活力花卉炼成的 pp 药水。', '对战中为出战精灵的每个技能各恢复 10 点 PP（占用一回合）。', '黄石 · 冶炼坊用活力花卉 ×3 合成。'],
    pp20: ['用活力花卉炼成的 pp 药水，比 10PP 药水更浓。', '对战中为出战精灵的每个技能各恢复 20 点 PP（占用一回合）。', '黄石 · 冶炼坊用活力花卉 ×5 合成。'],
    pp15: ['用活力花卉炼成的蓝色药水。', '对战中为出战精灵的每个技能各恢复 15 点 PP（占用一回合）。', '已停止合成，手里有的照样能用。'],
    // 精灵培养
    ivReroll: ['一管调配精灵天赋的合剂。', '用在任意一只精灵身上：六项天赋（0~31）全部重新随机，可能更高也可能更低。', '竞技代币商店（200 竞技代币）；先驱之塔的代币商店（400 先驱代币）。'],
    ivMoon: ['小月亮专用的天赋药剂。', '只能用在小月亮一系：六项天赋重新随机，每项掷两次取较高的一次。', '竞技代币商店（100 竞技代币）。'],
    ivBone: ['凶骨专用的天赋药剂。', '只能用在骨刃一系：六项天赋重新随机，每项掷两次取较高的一次。', '竞技代币商店（100 竞技代币）。'],
    natAny: ['一粒能改变精灵脾气的胶囊。', '用在任意一只精灵身上，把性格改成你指定的性格。', '先驱之塔的代币商店（2,000 先驱代币）。'],
    natTagore: ['泰戈尔专用的性格药剂。', '用在泰戈尔一系（小胖虎、胖虎也可以），把性格改成你指定的性格。', '首次击败困难难度的泰戈尔得 3 个；泰戈尔每周挑战（普通、困难）有机会掉落。'],
    ev50: ['一管小份的学习力合剂。', '用在任意一只精灵身上，增加 50 点可分配学习力，再在精灵资料里自己分配（学习力总量有上限）。', '明明代币抽奖。'],
    evAny: ['一管学习力合剂。', '用在任意一只精灵身上，增加 100 点可分配学习力，再在精灵资料里自己分配（学习力总量有上限）。', '竞技代币商店（100 竞技代币）；先驱之塔的代币商店（150 先驱代币）；BOSS 每周挑战、明明代币抽奖（每逢 4 的倍数的奖池）、排位赛季段位奖励。'],
    evTagore: ['泰戈尔专用的学习力合剂。', '用在泰戈尔一系，增加 100 点可分配学习力。', '泰戈尔每周挑战有机会掉落。'],
    evReset: ['把学习力退回去的胶囊。', '用在一只精灵身上，已经分配的学习力全部退回「可分配学习力」，可以重新分配。', '竞技代币商店（80 竞技代币）；先驱之塔的代币商店（200 先驱代币）。'],
    fruit1: ['一颗饱满的果子。', '用在一只精灵身上，直接增加经验（每颗 = 精灵等级 × 100）。到了等级上限就不能用。', '竞技代币商店（30 竞技代币）。'],
    fruit2: ['长得特别快的果子。', '用在一只精灵身上，直接增加经验（每颗 = 精灵等级 × 250）。到了等级上限就不能用。', '竞技代币商店（60 竞技代币）；先驱之塔的代币商店（60 先驱代币）；明明代币抽奖。'],
    formDev: ['用圣晶石和星砂做成的小装置。', '用在一只精灵身上，永久解锁一个它长到过的更小形态的外观；之后在精灵资料的「外观形态」里随时免费切换。只改外观。', '黄石 · 冶炼坊用圣晶石 ×6、星砂 ×300 合成。'],
    earthShard: ['出发前从地球上带来的元素结晶，带着家乡的气息。', '每 100 个让三只初始精灵（叶粒之果、水臂领主、涅槃方头一系）领悟一个还没领悟的隐藏技能；它们到 LV70 后，也用它解锁 LV75（500 个）、LV80（1,000 个）的等级上限。', '读完黄冈 · 学院部的支线「隐藏技能」得 1,000 个。'],
    moonStone: ['一块映着新月微光的石头。', '每 100 个让小月亮一系领悟一个隐藏技能；到 LV70 后也用它解锁更高的等级上限。', '竞技代币商店（2 竞技代币）。'],
    boneDust: ['泛着幽光的骨粉，摸上去凉凉的。', '每 100 个让骨刃一系领悟一个隐藏技能；到 LV70 后也用它解锁更高的等级上限。', '竞技代币商店（2 竞技代币）。'],
    tgPearl: ['泰戈尔一声虎啸凝成的珠子。', '每 100 个让泰戈尔一系领悟一个隐藏技能；到 LV70 后也用它解锁 LV75（500 个）、LV80（1,000 个）的等级上限。', '首次击败困难难度的泰戈尔得 80 个；泰戈尔每周挑战每次 15 / 30 / 50 个（简单 / 普通 / 困难）。'],
    brTwig: ['从荒芜体内的古代除草程序里提取出的一小瓶药剂。', '每 100 个让荒芜一系领悟一个隐藏技能；到 LV70 后也用它解锁 LV75（500 个）、LV80（1,000 个）的等级上限。', '首次击败普通难度的荒芜得 40 个、困难难度得 80 个；荒芜每周挑战每次 15 / 30 / 50 个（简单 / 普通 / 困难）。'],
    odoFin: ['从深海的奥多亚克身上脱落的古老鳍甲。', '每 100 个让奥多亚克一系领悟一个隐藏技能；到 LV70 后也用它解锁 LV75（500 个）、LV80（1,000 个）的等级上限。', '首次击败普通难度的奥多亚克得 40 个、困难难度得 80 个；奥多亚克每周挑战每次 15 / 30 / 50 个（简单 / 普通 / 困难）。'],
    hrDisk: ['盘面上的星点会自己转动的小星盘。', '每 100 个让幽灵鱼一系（幽灵鱼、哈蒙德、哈尔达蒙）领悟一个隐藏技能。', '击败野外随机出现的幽灵鱼，每只掉落 50–70 个。'],
    deathTok: ['先驱之塔死神留下的代币。', '1 颗让帕努托尔一系领悟一个隐藏技能；在先驱之塔的代币商店兑换「帕努托尔的精元」也要 1 颗。', '击败先驱之塔第 60 层的死神「帕努托尔」获得，一个账号最多 3 颗。'],
    mmEye: ['雷明灯一系的专属结晶。', '每 100 个让雷明灯一系领悟一个隐藏技能。', '明明代币抽奖：从第 5 个奖池起，每逢 5 的倍数的奖池里有 50 个。'],
    // 材料
    g_sand: ['从星球表面收来的矿砂。', '黄石 · 冶炼坊用来合成加强捕捉装置（2 个一个）和形态切换装置。', '各星球野外的采集点，每个点每天 1 次、每次 12 个；瘴气驱逐战的全服里程碑奖励。'],
    g_core: ['雷暴和永冻里凝出来的核。', '黄石 · 冶炼坊用来合成华为捕捉装置（4 个一个）和形态切换装置。', '活动「明明教官的试炼」每关每个难度首次通过；芙罗拉星挑战路线累计星数奖励；瘴气驱逐战的全服里程碑奖励；明明代币抽奖。'],
    s_herb: ['绿色的药草籽。', '在恩施 · 太空种植园种下，8 小时后收获药草 ×50；收获时有 20% 的概率掉落 1 颗药草种子。', '恩施 · 生态舱的种子商店（100 能量）；第一次在芙罗拉星的丛林或草甸采集送 4 颗；支线「伟大的种植园」。'],
    s_flower: ['蓝色的花籽。', '在恩施 · 太空种植园种下，8 小时后收获活力花卉 ×50；收获时有 20% 的概率掉落 1 颗活力花种子。', '恩施 · 生态舱的种子商店（100 能量）。'],
    s_rice: ['芙罗拉星野外的稻种。', '在恩施 · 太空种植园种下，12 小时后收获米饭 ×250，种子会退回来。', '在芙罗拉星击败野生精灵时有 10% 的概率掉落。'],
    c_herb: ['太空种植园收获的药草。', '黄石 · 冶炼坊用 1 份合成 100hp药水、2 份合成 200hp药水。', '在太空种植园种药草种子收获。'],
    c_flower: ['太空种植园收获的蓝色小花，闻一闻就精神了。', '黄石 · 冶炼坊炼成 pp 药水：3 朵一瓶 10PP、5 朵一瓶 20PP，大的更划算。', '在太空种植园种活力花种子收获。'],
    c_rice: ['水稻收获后煮好的米饭，一粒一粒数得清。', '黄石 · 冶炼坊用 500 粒盛成一碗饭。', '在太空种植园种水稻种子收获。'],
    c_bowl: ['满满一碗香喷喷的米饭。', '进入庞贝星 · 熔岩原，在想放的场景里点「放下一碗饭」。之后这个场景刷新精灵时有 2% 的概率是稀有的米饭火鸡；捕捉或击败它之后，这碗饭就被吃掉了。', '黄石 · 冶炼坊用米饭 ×500 合成。'],
    m_lcleaf: ['旅行精灵叶子喵身上掉下来的叶片，还带着一点光。', '每 2 片让叶子喵一系领悟一个隐藏技能；5 片可以在黄石 · 冶炼坊合成叶子喵的精元。', '击败旅行精灵叶子喵时有 50% 的概率掉落。'],
    e_leafcat: ['用叶子喵的叶片凝成的精元。', '放进神农架 · 精灵保育仓，孵化 8 小时后诞生一只叶子小小喵。', '黄石 · 冶炼坊用叶子喵的叶片 ×5 合成。'],
    e_pluto: ['帕努托尔的精元。', '放进神农架 · 精灵保育仓，孵化 12 小时后诞生一只帕努。', '先驱之塔的代币商店（3,000 先驱代币 + 1 颗死神代币）。'],
    e_odo: ['从深海里带回来的一团精元。', '放进神农架 · 精灵保育仓，孵化 8 小时后诞生一只奥多。', '首次击败简单难度的BOSS「奥多亚克」获得。'],
    e_leiming: ['雷明灯的精元。', '放进神农架 · 精灵保育仓，孵化 8 小时后诞生一只雷明灯，有 10% 的概率是异色。', '明明代币抽奖：第 10、30、50、70……个奖池里各有 1 个。'],
    m_hfhorn: ['赫菲一系身上掉下来的角片，还带着一点余温。', '60 片在黄石 · 冶炼坊合成「奇声号角」。', '在庞贝星击败野生的赫菲一系，每只掉落 3–6 片；航行日志的「冥岛的歌声」每天可以领 12–15 片。'],
    m_horn: ['用赫菲角片做成的号角，吹起来声音很奇怪。', '在坎伯兰星 · 水面的「冥岛」吹响，会引来一只可以捕捉的塞米；和它进入战斗时号角就会用掉。', '黄石 · 冶炼坊用赫菲角片 ×60 合成。'],
    m_mcry: ['凝着马亚尔星系各处能量的晶体。', '在黄石 · 冶炼坊的「特产互换」里，每 10 个换成 10 个任意一种星球特产（芙罗拉玉、不化水滴、火山灰烬、闪电球体、永久冻土）。', '每个BOSS每档难度首次击败（简单 100、普通 200、困难 400）；BOSS 每周挑战每次掉落；深渊潜底。'],
    m_cu: ['在野外挖到的马亚尔煤炭。', '在荆楚号 · 宜昌的三峡能源核心换成能量（每块 150 能量，每天有上限）。', '芙罗拉星、坎伯兰星野外的矿点，每处每天挖 1 次（要挖矿钻头）。'],
    m_fe: ['在野外挖到的马亚尔铁矿石，比煤炭更值钱。', '在荆楚号 · 宜昌的三峡能源核心换成能量（每块 250 能量，每天有上限）。', '芙罗拉星、坎伯兰星野外的矿点，每处每天挖 1 次（要挖矿钻头）。'],
    mmTok: ['活动「明明教官的试炼」的代币。', '在全息作战场地或航行日志里抽奖：10 个抽一次，100 个十连。', '通过活动「明明教官的试炼」的关卡（首次通过另有奖励）；明明代币抽奖里也能抽到；读完活动任务「明明教官的试炼」送 500 个。'],
    ctShare: ['第一届做题大王争霸赛所有参赛选手的纪念。', '在储存箱里使用：选一位好友，送 Ta 一只 LV10 的尖盔虫和 200 个花剑圆弧（对方会收到邮件）。', '参加做题大王争霸赛，通过邮件发放。'],
    ctTicket: ['第一届做题大王争霸赛的参赛奖励。', '在储存箱里使用：1 张兑换一只 LV10 的战斗系精灵「尖盔虫」，同时获得 200 个花剑圆弧（解锁它的隐藏技能用）。', '参加做题大王争霸赛，比赛结束后按名次发放。'],
    // 其他
    rename: ['一张可以重写名字的卡片。', '点右上角的名字，在菜单里使用，修改做题家名字（最多 ' + NAME_MAX + ' 个字）。', '荆门 · 物资仓储的商城（1,000 能量）。'],
    auto: ['装在茶室精灵身上的小装置。', '装在茶室里展示中的一只精灵身上：它每训练满 1 天就自动结算经验，再开始下一天，一共 7 天，不用每天回来收。', '天门 · 陆羽茶室大厅的茶室商店（1,500 能量）。'],
    permit: ['挑战BOSS每周挑战用的许可。', '进行「每周挑战」时消耗 1 枚。', '每 12 小时自动恢复 1 枚，最多同时持有 ' + PVE.PERMIT.max + ' 枚。'],
    trans: ['汉街总部国际A座的情报显示，这个翻译器能凭一己之力考到雅思 6.5 分。', '剧情道具：戴上后能听懂精灵说的话。不能使用，也不会消耗。', '主线剧情里获得。'],
    helmet: ['Bttp 用无人机空投下来的头盔，很容易摔坏。', '剧情道具：戴上后在浓密的瘴气里也能呼吸、看清路。不能使用，也不会消耗。', '主线剧情里获得。'],
    dive: ['Jager 上尉发的潜水头盔，Bttp 调过参数。', '剧情道具：戴上后能在水里呼吸，也能和精灵翻译器连在一起用。不能使用，也不会消耗。', '主线剧情里获得。']
  };
  Object.keys(SPEC_OF).forEach(function (k) {
    var P = SPEC_OF[k];
    ITEM_INFO[k] = [P[0] + '的特产。',
      '每 100 个让' + P[1] + '一系（进化前的形态也可以）领悟一个还没领悟的隐藏技能；' + P[2] + '系精灵到 LV70 后，也可以用它解锁更高的等级上限。',
      P[3] + '的野外场景里每天有机会捡到 1~3 个；' + P[2] + '系每周挑战；先驱之塔的代币商店（10 先驱代币）；明明代币抽奖' + (k === 'floraJade' ? '；荒芜每周挑战、瘴气驱逐战的全服里程碑奖励、芙罗拉星挑战路线累计星数奖励' : k === 'kbDrop' ? '；奥多亚克每周挑战' : '') + '；也可以在黄石 · 冶炼坊用别的特产互换。'];
  });
  function itemInfo(k) { var x = ITEM_INFO[k]; return x ? { intro: x[0], use: x[1], get: x[2] } : null; }
  // 形态切换装置还能解锁的形态：已经长到过、比原本形态小、还没解锁过的
  function formOpts(m) { return GROW.formOpts(m); }
  // 精灵资料里的「形态」：解锁过形态的精灵，在原本形态和解锁的形态之间免费切换
  function formSwitchHTML(m) {
    var s = SPMAP[m.sid], nat = stageOf(s, m.lv), cur = shownStage(m), fu = (Array.isArray(m.fu) ? m.fu : []).filter(function (i) { return i < nat; });
    if (!fu.length) return '';
    var list = [nat].concat(fu.slice().sort());
    return '<div class="fsw"><b>外观形态</b>' + list.map(function (i) { return '<button type="button" class="btn' + (i === cur ? ' primary' : '') + '" data-fsw="' + i + '"' + (i === cur ? ' disabled' : '') + '>' + esc(formLabel(s, i)) + (i === nat ? '（原本）' : '') + '</button>'; }).join('') + '<span class="hint">随时免费切换，只改外观</span></div>';
  }
  function itemFits(k, m) { return GROW.itemFits(k, m); }
  function jadeMoves(m) { return GROW.jadeMoves(m); }
  // 把精灵道具用在 m 身上；nat 是性格药剂要改成的性格。返回 { ok, msg }
  function applyMonItem(k, m, nat, done) {   // 走交易（js/engine/grow.js 的 mitem）：服务器先算、本机重放；done({ ok, msg })
    if (!m) { done({ ok: false, msg: '先选一只精灵。' }); return; }
    var it = USE_ITEMS[k];
    if (!it || !(acc.items[k] > 0)) { done({ ok: false, msg: '没有这个道具了。' }); return; }
    txRun('mitem', { u: m.u, k: k, nat: nat == null ? null : String(nat) }, function (res) {
      if (res.g && REW.collect) REW.gains.push({ u: res.g.u, lv0: res.g.lv0, exp0: res.g.exp0, amt: res.g.amt });
      if (res.g) renderTitle();
      done({ ok: true, msg: res.g ? gainMsg(res.g) : res.msg });
    }, function (err) { done({ ok: false, msg: err }); });
  }
  // 精灵资料里的「精灵道具」：只列出能用在这只精灵身上、手里有的
  /* ---------- 刻印（2026-11-01）：规则在 js/engine/summon.js ---------- */
  function insIc(k) { return H.itemIcon(k); }
  function insHTML(m) {
    var R = Array.isArray(m.ins) ? m.ins : [];
    return '<div class="ins-box"><div class="ins-head"><h4>刻印</h4><span class="hint">只在 PVE 对战中生效 · 装备后和这只精灵绑定，不能取下</span></div><div class="ins-slots">' + [0, 1, 2].map(function (i) {
      var k = R[i], I = k && SUMMON.INS[k], op = SUMMON.slotOpen(m, i);
      if (!op) return '<div class="ins-slot lock"><b>槽位 ' + (i + 1) + '</b><span>🔒 ' + SUMMON.slotLock(m, i) + '</span>' + (i === 2 ? '<button type="button" class="btn" data-insx="1"' + ((acc.items.insChip || 0) > 0 ? '' : ' disabled title="还没有刻印激活晶片"') + '>开启（刻印激活晶片 ' + (acc.items.insChip || 0) + '）</button>' : '') + '</div>';
      if (I) return '<button type="button" class="ins-slot on' + (I.lim ? ' lim' : '') + '" data-insslot="' + i + '"><span class="ins-ic">' + insIc(k) + '</span><span class="ins-t"><b>' + esc(I.name) + '</b><small>' + esc(SUMMON.insDesc(k)) + '</small></span><span class="ins-chg">更换</span></button>';
      return '<button type="button" class="ins-slot empty" data-insslot="' + i + '"><b>槽位 ' + (i + 1) + '</b><span>＋ 装备刻印</span></button>';
    }).join('') + '</div></div>';
  }
  function insPick(m, i) {
    var have = INS_KEYS.filter(function (k) { return (acc.items[k] || 0) > 0; }), old = Array.isArray(m.ins) ? m.ins[i] : null;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'ins-dlg';
    d.innerHTML = '<div class="soc-box ins-pick" role="dialog" aria-modal="true" aria-label="装备刻印"><span class="tape l"></span><span class="tape r"></span><span class="step">刻印 · 槽位 ' + (i + 1) + '</span><h2>给' + esc(form(m).name) + '装备刻印</h2>' +
      '<p class="hint">装备后刻印就和这只精灵绑定了，不能取下，也不能给别的精灵用。' + (old ? '这个槽位现在的「' + esc(SUMMON.INS[old].name) + '」会被替换掉（消失）。' : '') + '</p>' +
      (have.length ? '<div class="ins-list">' + have.map(function (k) { var I = SUMMON.INS[k]; return '<button type="button" class="ins-opt' + (I.lim ? ' lim' : '') + '" data-inspick="' + k + '"><span class="ins-ic">' + insIc(k) + '</span><span class="ins-t"><b>' + esc(I.name) + ' <small>×' + acc.items[k] + '</small></b><small>' + esc(SUMMON.insDesc(k)) + '</small></span></button>'; }).join('') + '</div>'
        : '<p class="empty-note">还没有刻印。可以在荆楚号的「召唤」里抽到。</p>') +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-insx2="1">取消</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-insx2]')) { d.remove(); return; }
      var b = e.target.closest('[data-inspick]'); if (!b) return;
      var k = b.dataset.inspick;
      if (!b.classList.contains('armed')) { [].forEach.call(d.querySelectorAll('.ins-opt.armed'), function (x) { x.classList.remove('armed'); }); b.classList.add('armed'); b.querySelector('.ins-t b').insertAdjacentHTML('beforeend', '<em class="ins-ok"> · 再点一次确认装备</em>'); return; }
      d.remove();
      txRun('ins', { u: m.u, i: i, k: k }, function () { renderTop(); toast(form(m).name + ' 装备了「' + SUMMON.INS[k].name + '」！'); });
    });
  }
  function monItemsHTML(m) {
    var ks = MON_ORDER.concat(['m_lcleaf']).filter(function (k) { return acc.items[k] > 0 && itemFits(k, m); });
    if (!ks.length) return '';
    return '<div class="md-items"><h4>精灵道具 <span class="hint">直接用在' + esc(form(m).name) + '身上</span></h4>' + ks.map(function (k) {
      var it = USE_ITEMS[k], act;
      if (it.kind === 'jade') { var jl = jadeMoves(m), jok = jl.length && acc.items[k] >= it.cost; act = jl.length ? '<select data-mnat="1" aria-label="要领悟的隐藏技能">' + jl.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') + '</select><button type="button" class="btn" data-muse="' + k + '"' + (jok ? '' : ' disabled title="需要 ' + it.cost + ' 个"') + '>' + (jok ? '用 ' + it.cost + ' 个领悟' : '需要 ' + it.cost + ' 个') + '</button>' : '<button type="button" class="btn" disabled>隐藏技能已全部领悟</button>'; }
      else if (it.kind === 'form') { var fo = formOpts(m); act = fo.length ? '<select data-mnat="1" aria-label="要解锁的形态">' + fo.map(function (x) { return '<option value="' + x.i + '">' + esc(x.n) + '</option>'; }).join('') + '</select><button type="button" class="btn" data-muse="' + k + '">解锁</button>' : '<button type="button" class="btn" disabled>没有可以解锁的形态</button>'; }
      else if (it.kind === 'nat') act = '<select data-mnat="1" aria-label="新的性格">' + NAT_KEYS.filter(function (n) { return n !== m.nat; }).map(function (n) { return '<option value="' + n + '">' + n + '（' + natText(n) + '）</option>'; }).join('') + '</select><button type="button" class="btn" data-muse="' + k + '">改性格</button>';
      else if (it.kind === 'iv' || it.kind === 'iv2') act = '<button type="button" class="btn" data-muse="' + k + '">使用 · 重组天赋</button>';
      else if (it.kind === 'natRand') act = '<button type="button" class="btn" data-muse="' + k + '">使用 · 随机换性格</button>';
      else if (it.kind === 'exp') act = '<button type="button" class="btn" data-muse="' + k + '"' + (atCap(m) ? ' disabled' : '') + '>' + (atCap(m) ? '已到等级上限' : '使用 · +' + fmt(m.lv * it.rate) + ' 经验') + '</button>';
      else if (it.kind === 'evreset') act = '<button type="button" class="btn" data-muse="' + k + '"' + (evSum(m) ? '' : ' disabled') + '>' + (evSum(m) ? '使用 · 退回 ' + evSum(m) + ' 点' : '没有分配过学习力') + '</button>';
      else { var room = evRoom(m); act = '<button type="button" class="btn" data-muse="' + k + '"' + (room ? '' : ' disabled title="学习力已经到上限了"') + '>' + (room ? '使用 · +' + Math.min(100, room) + ' 学习力' : '学习力已满') + '</button>'; }
      return '<div class="md-it"><b>' + it.name + ' <span class="cnt">×' + acc.items[k] + '</span></b><span class="hint">' + esc(it.kind === 'jade' ? '每 ' + it.cost + ' 个领悟一个隐藏技能' : it.kind === 'form' ? '每个给这只精灵永久解锁一个形态' : it.kind === 'nat' ? '把性格改成你选的性格' : it.kind === 'natRand' ? '性格随机换成另一种' : it.kind === 'iv' ? '六项天赋全部重新随机' : it.kind === 'iv2' ? '六项天赋重新随机，每项掷两次取高' : it.kind === 'exp' ? '直接给这只精灵增加经验' : it.kind === 'evreset' ? '已分配的学习力全部退回' : '直接增加 100 点可分配学习力') + '</span><span class="md-act">' + act + '</span></div>';
    }).join('') + '</div>';
  }
  function growText(min) { return min >= 60 && min % 60 === 0 ? (min / 60) + ' 小时' : min + ' 分钟'; }
  function itemName(k) { var it = INS_ITEMS[k] || ITEMS[k] || USE_ITEMS[k] || SHOP_X[k] || TEA_SHOP[k] || KEY_ITEMS[k] || GATHER_ITEMS[k] || SEEDS[k] || CROPS[k] || MATS[k]; return it ? it.name : k; }
  function evRoom(m) { return GROW.evRoom(m); }
  /* 储存箱分类（2026-10-19 整理）：精灵培养 / 战斗道具 / 材料 / 其他，每类下面再分小组；每个道具都带图标 */
  function ibGroups(wk) {
    var byKind = function (kinds) { return MON_ORDER.filter(function (k) { return USE_ITEMS[k] && kinds.indexOf(USE_ITEMS[k].kind) >= 0; }); };
    var listed = ['m_lcleaf', 'e_leafcat', 'e_pluto', 'e_odo'].concat(SUM_ESS);
    var evt = MAT_ORDER.filter(function (k) { return listed.indexOf(k) < 0; });
    return [
      { id: 'mon', n: '精灵培养', hint: '直接用在精灵身上。也可以在精灵背包、仓库里点开精灵，在资料里使用。', subs: [['特产 · 隐藏技能与等级上限', byKind(['jade'])], ['性格 · 天赋 · 学习力', byKind(['nat', 'natRand', 'iv', 'iv2', 'ev', 'evreset'])], ['经验', byKind(['exp'])], ['形态', byKind(['form'])]] },
      { id: 'battle', n: '战斗道具', hint: '在剧情、野外、BOSS对战的「道具」页使用。', subs: [['捕捉装置', ['cap1', 'cap2', 'cap3']], ['hp药水', ['pot100', 'pot200']], ['PP 药水', ['pp10', 'pp20', 'pp5', 'pp15']], ['解毒药剂', ['antidote']]] },
      { id: 'mat', n: '材料', hint: '拿到黄石 · 冶炼坊合成，或者用在种植园、保育仓。', subs: [['采集物', GATHER_ORDER], ['种子', SEED_ORDER], ['作物', CROP_ORDER], ['精灵素材与精元', listed], ['活动道具', evt]] },
      { id: 'ins', n: '刻印', hint: '在精灵资料的「刻印」里装备；只在 PVE 对战中生效。', subs: [['常规刻印', SUMMON.INS_NORMAL1.concat(SUMMON.INS_NORMAL2)], ['限定刻印', INS_KEYS.filter(function (k) { return SUMMON.INS[k].lim; })], ['刻印激活晶片', ['insChip']]] },
      { id: 'other', n: '其他', hint: '功能道具点开后使用；剧情道具不会消耗。', subs: [['召唤', ['sumTok', 'fPt']], ['功能道具', ['rename', 'auto'].concat(wk ? ['permit'] : [])], ['剧情道具', Object.keys(KEY_ITEMS)]] }
    ];
  }
  function itemsHTML() {
    var wk = weeklyOpen(), pn = wk ? permits() : 0, G = ibGroups(wk);
    var owned = function (k) { return k === 'permit' ? wk : acc.items[k] > 0; };
    var allKeys = []; G.forEach(function (g) { g.subs.forEach(function (sb) { sb[1].forEach(function (k) { if (owned(k)) allKeys.push(k); }); }); });
    if (ui.itSel && allKeys.indexOf(ui.itSel) < 0) ui.itSel = null;
    var tab = ui.itTab || 'all';
    var cnt = function (g) { var n = 0; g.subs.forEach(function (sb) { sb[1].forEach(function (k) { if (owned(k)) n++; }); }); return n; };
    var cell = function (k) {
      var kimg = KEY_ITEMS[k] && KEY_ITEMS[k].img && ITEM_IMG[KEY_ITEMS[k].img];
      var ic = kimg ? '<img class="it-ic" src="' + kimg + '" alt="">' : H.itemIcon(k);
      var n = k === 'permit' ? pn + '/' + PERMIT.max : KEY_ITEMS[k] ? '' : '×' + fmt(acc.items[k]);
      return '<button type="button" class="ib-it' + (ui.itSel === k ? ' sel' : '') + '" data-itsel="' + k + '"><span class="ib-ic">' + ic + '</span><b>' + (k === 'permit' ? '挑战许可' : itemName(k)) + '</b>' + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
    };
    var html = '<section class="itembox"><span class="tape r"></span><div class="ib-tabs" role="tablist">' +
      [{ id: 'all', n: '全部', c: allKeys.length }].concat(G.map(function (g) { return { id: g.id, n: g.n, c: cnt(g) }; })).map(function (t) {
        return '<button type="button" role="tab" class="ib-tab' + (tab === t.id ? ' on' : '') + '" data-ittab="' + t.id + '" aria-selected="' + (tab === t.id) + '">' + t.n + ' <small>' + t.c + '</small></button>';
      }).join('') + '</div><div class="ib-wrap"><div class="ib-main">';
    var shown = 0;
    G.forEach(function (g) {
      if (tab !== 'all' && tab !== g.id) return;
      var body = g.subs.map(function (sb) { var ks = sb[1].filter(owned); if (!ks.length) return ''; shown += ks.length; return '<h4 class="ib-sub">' + sb[0] + '</h4><div class="ib-grid">' + ks.map(cell).join('') + '</div>'; }).join('');
      if (!body && tab === 'all') return;
      html += '<div class="ib-cat"><div class="ib-head"><h3>' + g.n + '</h3><span class="hint">' + g.hint + '</span></div>' + (body || '<p class="empty-note">这一类还没有道具。</p>') + '</div>';
    });
    if (!shown && tab === 'all') html += '<p class="empty-note">储存箱是空的。</p>';
    html += '</div>';
    var k = ui.itSel;
    if (k) {
      var it = USE_ITEMS[k] && USE_ITEMS[k].kind ? USE_ITEMS[k] : null, inf = itemInfo(k), act = '', body = '';
      if (k === 'permit') act = '<p class="hint">当前 ' + pn + ' 枚 · ' + permitNext() + '</p><button type="button" class="btn" data-itgo="weekly">去每周挑战</button>';
      else if (k === 'rename') act = '<button type="button" class="btn primary" data-ituse="rename">使用改名卡</button>';
      else if (k === 'ctShare') act = '<button type="button" class="btn primary" data-ituse="ctShare">分享给好友</button>';
      else if (k === 'ctTicket') act = '<button type="button" class="btn primary" data-ituse="ctTicket">兑换尖盔虫（LV10）+ 200 花剑圆弧</button>';
      else if (k === 'auto') act = '<button type="button" class="btn" data-itgo="home">去我的茶室装上</button>';
      else if (KEY_ITEMS[k] && KEY_ITEMS[k].img && ITEM_IMG[KEY_ITEMS[k].img]) act = '<img class="ib-big" src="' + ITEM_IMG[KEY_ITEMS[k].img] + '" alt="">';
      else if (SEEDS[k]) act = GROW.SEED_SHOP.indexOf(k) >= 0 ? '<button type="button" class="btn" data-itgo="seedshop">去种子商店</button>' : '';
      else if (it) {
        var mons = acc.mons.filter(function (m) { return itemFits(k, m); }).sort(function (a, b) { return b.lv - a.lv; });
        if (!mons.some(function (m) { return m.u === ui.itTarget; })) ui.itTarget = mons.length ? mons[0].u : null;
        var tm = mon(ui.itTarget);
        act = (mons.length ? '<h5 class="ib-act-h">使用</h5>' + '<div class="it-step"><b>1. 选择精灵</b><div class="it-mons">' + mons.map(function (m) {
          var f = form(m), sub = it.kind === 'jade' ? (jadeMoves(m).length ? '还有 ' + jadeMoves(m).length + ' 个隐藏技能可领悟' : '隐藏技能已全部领悟') : it.kind === 'form' ? (formOpts(m).length ? '还能解锁 ' + formOpts(m).length + ' 个形态' : '没有可以解锁的形态') : it.kind === 'nat' ? '性格 ' + m.nat : it.kind === 'exp' ? (atCap(m) ? '已到等级上限' : '可得 ' + fmt(m.lv * it.rate) + ' 经验') : it.kind === 'evreset' ? '已分配 ' + evSum(m) + ' 点' : it.kind === 'iv' || it.kind === 'iv2' ? '天赋合计 ' + (ivOf(m) ? STAT_KEYS.reduce(function (a, x) { return a + m.iv[x]; }, 0) : '？') : '可再加 ' + evRoom(m) + ' 点';
          return '<label class="it-mon' + (m.u === ui.itTarget ? ' on' : '') + '"><input type="radio" name="it-t" value="' + m.u + '"' + (m.u === ui.itTarget ? ' checked' : '') + '><img src="' + f.img + '" alt=""><span><b>' + esc(f.name) + '</b><small>LV' + m.lv + ' · ' + sub + '</small></span></label>';
        }).join('') + '</div></div>' +
          (it.kind === 'jade' ? (tm && jadeMoves(tm).length ? '<div class="it-step"><b>2. 选择隐藏技能</b><select id="it-nat" aria-label="要领悟的隐藏技能">' + jadeMoves(tm).map(function (n) { return '<option value="' + n + '">' + n + '（' + esc(LEARN[n] ? '原本要' + LEARN[n] : '原本 LV50 习得') + '）</option>'; }).join('') + '</select></div>' : '') + '<p class="hint">一次消耗 ' + it.cost + ' 个，你现在有 ' + acc.items[k] + ' 个。</p>'
            : it.kind === 'form' ? (tm && formOpts(tm).length ? '<div class="it-step"><b>2. 选择要解锁的形态</b><select id="it-nat" aria-label="要解锁的形态">' + formOpts(tm).map(function (x) { return '<option value="' + x.i + '">' + esc(x.n) + '</option>'; }).join('') + '</select></div>' : '') + '<p class="hint">给这只精灵永久解锁一个形态，之后在精灵资料里随时免费切换。只改外观，数值和技能都不变。</p>'
            : it.kind === 'nat' ? '<div class="it-step"><b>2. 选择性格</b><select id="it-nat" aria-label="新的性格">' + NAT_KEYS.map(function (n) { var cur = tm && tm.nat === n, pick = ui.itNat && (!tm || ui.itNat !== tm.nat) ? ui.itNat : NAT_KEYS.filter(function (x) { return !tm || x !== tm.nat; })[0]; return '<option value="' + n + '"' + (pick === n ? ' selected' : '') + (cur ? ' disabled' : '') + '>' + n + '（' + natText(n) + '）' + (cur ? ' · 当前' : '') + '</option>'; }).join('') + '</select></div>'
            : it.kind === 'iv' || it.kind === 'iv2' ? '<p class="hint">' + (tm && ivOf(tm) ? esc(form(tm).name) + ' 现在的天赋：' + STAT_KEYS.map(function (x) { return BASE_NAME[x] + ' ' + tm.iv[x]; }).join('，') + '。' : '') + '</p>'
            : it.kind === 'natRand' ? '<p class="hint">' + (tm ? esc(form(tm).name) + ' 现在是「' + tm.nat + '」性格，用了之后会随机变成另一种性格。' : '') + '</p>'
            : it.kind === 'exp' ? '<p class="hint">' + (tm ? esc(form(tm).name) + ' 现在 LV' + tm.lv + '，吃一颗得到 ' + fmt(tm.lv * it.rate) + ' 点经验。' : '') + '</p>'
            : '<p class="hint">' + (tm ? esc(form(tm).name) + ' 学习力：已分配 ' + evSum(tm) + '，可分配 ' + (tm.evFree || 0) + '，还能再加 ' + evRoom(tm) + ' 点。' : '') + '</p>') +
          '<button type="button" class="btn primary" data-ituse="' + k + '"' + ((it.kind === 'jade' && (!tm || !jadeMoves(tm).length || acc.items[k] < it.cost)) || (it.kind === 'form' && (!tm || !formOpts(tm).length)) || (it.kind === 'ev' && tm && !evRoom(tm)) || (it.kind === 'exp' && tm && atCap(tm)) || (it.kind === 'evreset' && tm && !evSum(tm)) ? ' disabled' : '') + '>使用 ' + (it.cost || 1) + ' 个' + itemName(k) + '</button>'
          : '<p class="hint red">' + esc(it.none || '你还没有能用这个道具的精灵（' + (it.sids || [it.sid]).filter(function (x) { return SPMAP[x]; }).map(function (x) { return SPMAP[x].name; }).join('、') + '一系）。') + '</p>');
      }
      else if (MATS[k] && MATS[k].hatch) act = '<button type="button" class="btn" data-itgo="nursery">去精灵保育仓</button>';
      if (SUMMON.INS[k] || k === 'insChip') act = '<button type="button" class="btn" data-itgo="store">去精灵仓库装备</button>';
      else if (k === 'sumTok' || k === 'fPt') act = '<button type="button" class="btn" data-itgo="summon">去召唤</button>';
      var dsc = (INS_ITEMS[k] && INS_ITEMS[k].d) || (ITEMS[k] && ITEMS[k].d) || (USE_ITEMS[k] && USE_ITEMS[k].d) || (KEY_ITEMS[k] && KEY_ITEMS[k].d) || (GATHER_ITEMS[k] && GATHER_ITEMS[k].d) || (SEEDS[k] && SEEDS[k].d) || (CROPS[k] && CROPS[k].d) || (MATS[k] && MATS[k].d) || '';
      body = (inf ? '<dl class="ib-info"><div><dt>简介</dt><dd>' + esc(inf.intro) + '</dd></div><div><dt>用途</dt><dd>' + esc(inf.use) + '</dd></div><div><dt>获得方式</dt><dd>' + esc(inf.get) + '</dd></div></dl>' : '<p>' + esc(dsc) + '</p>') +
        (act ? '<div class="ib-act">' + act + '</div>' : '');
      html += '<div class="ib-detail"><h4><span class="ib-ic">' + (KEY_ITEMS[k] && KEY_ITEMS[k].img && ITEM_IMG[KEY_ITEMS[k].img] ? '' : H.itemIcon(k)) + '</span>' + (k === 'permit' ? '挑战许可' : itemName(k)) + (k !== 'permit' ? ' <small class="cnt">×' + fmt(acc.items[k] || 0) + '</small>' : '') + '</h4>' + body + (ui.itMsg ? '<p class="exp-msg">' + esc(ui.itMsg) + '</p>' : '') + '</div>';
    }
    else if (ui.itMsg) html += '<div class="ib-detail"><p class="exp-msg">' + esc(ui.itMsg) + '</p></div>';   // 道具刚好用完：提示留着
    else html += '<div class="ib-detail ib-empty"><p class="hint">点左边的道具，查看说明和使用方法。</p></div>';
    return html + '</div></section>';
  }
  function renderItems() {
    $('pg-items').innerHTML = '<div class="page-head storage-head"><h2 class="sec">储存箱</h2><span class="storage-energy"><img src="images/items/energy.png" alt="">能量 <b>' + fmt(acc.energy) + '</b></span></div>' + itemsHTML();
  }
  function teamRename(i) {
    var old = $('tren-dlg'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'tren-dlg';
    d.innerHTML = '<form class="soc-box" role="dialog" aria-modal="true" aria-label="配队改名" style="max-width:380px"><span class="step">配队改名</span><h2>' + esc(tName(i)) + '</h2>' +
      '<input id="tren-in" maxlength="10" placeholder="' + TEAM_NAME0[i] + '" value="' + esc(acc.tNames && acc.tNames[i] || '') + '" aria-label="新名字"><p class="hint">最多 10 个字，留空恢复默认名字。</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-trenx="1">取消</button><button type="submit" class="btn primary">保存</button></div></form>';
    document.body.appendChild(d);
    var inp = $('tren-in'); inp.focus(); inp.select();
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-trenx]')) d.remove(); });
    d.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value.replace(/[<>]/g, '').trim().slice(0, 10);
      if (!acc.tNames) acc.tNames = [];
      acc.tNames[i] = v || null; if (!acc.tNames.some(function (x) { return x; })) delete acc.tNames;
      save(); d.remove(); renderBag(); renderRes && renderRes(); toast(v ? '配队改名为「' + v + '」' : '已恢复默认名字');
    });
  }
  function useBagItem(k) {
    if (k === 'rename') { setTimeout(function () { renaming = true; renderRename(); $('who-menu').hidden = false; $('who-btn').setAttribute('aria-expanded', true); HSVIEW.to(0, 0); }, 0); return; }   // 等这次点击处理完再打开名字菜单，免得被「点别处关闭」立刻关上
    if (k === 'ctShare') { ctShareDlg(); return; }
    if (k === 'ctTicket') { txRun('ctRedeem', {}, function (r) { ui.itMsg = '兑换成功！获得 LV10 尖盔虫和 200 个花剑圆弧' + (r && r.added ? '，尖盔虫已加入配队。' : '，尖盔虫在精灵仓库里。'); if (!acc.items.ctTicket) ui.itSel = null; renderItems(); toast(ui.itMsg); }); return; }
    var sel = $('it-nat');
    applyMonItem(k, mon(ui.itTarget), sel && sel.value, function (r) {
      ui.itMsg = r.msg; if (r.ok) ui.itNat = null;
      renderItems(); if (r.ok) toast(r.msg);
    });
  }

  /* ---------- 精灵背包 ---------- */
  function bagMoveCard(m, name, i) {
    var odoF = m.sid === 'odo' && ui.odoF && ui.odoF.u === m.u ? ui.odoF.f : '';
    var mv = M[odoMoveAs(name, odoF)] || M[name];
    if (!mv) return '<div class="bag-skill empty-note">未装备技能</div>';
    return '<button type="button" class="bag-skill" style="--skill-color:' + TYPE_COLOR[mv.type] + '" data-bag-skill="' + i + '" aria-label="' + esc(mv.name) + '，查看技能信息">' +
      '<span class="mn">' + esc(mv.name) + '</span><span class="pp">PP ' + mv.pp + '</span><span class="t2">' + tchip(mv.type) + '<span class="mv-kind">' + mv.cat + '</span><span class="mv-power">威力 ' + (mv.power || '—') + '</span></span>' +
      '<span class="md">' + esc(mv.d) + (mv.pri ? ' · 先制 +' + mv.pri : '') + '</span></button>';
  }
  function bagStats(m) {
    var iv = ivOf(m), free = m.evFree || 0, sum = evSum(m), s = SPMAP[m.sid];
    return '<div class="bag-stat-summary"><span><b>性格 · ' + esc(m.nat) + '</b> · ' + esc(natText(m.nat)) + '</span><span>学习力：可分配 <b>' + free + '</b> · 已分配 ' + sum + '/' + EV_TOTAL + '</span></div><div class="bag-stat-grid">' + STAT_KEYS.map(function (k) {
      var ev = m.ev[k] || 0, room = Math.min(free, EV_MAX - ev, EV_TOTAL - sum), nm = natureMult(m.nat, k);
      return '<article class="bag-stat-card"><header><span>' + BASE_NAME[k] + '</span><strong class="' + (nm > 1 ? 'blue' : nm < 1 ? 'red' : '') + '">' + stat(m, k) + (nm > 1 ? '↑' : nm < 1 ? '↓' : '') + '</strong><small class="bag-stat-meta">种族 ' + s.base[k] + ' · 天赋 ' + (iv ? iv[k] : '？') + '</small></header><div class="bag-stat-ev"><span>学习力 ' + ev + '</span><button type="button" data-ev="' + k + '" data-d="1" aria-label="' + BASE_NAME[k] + '学习力加1"' + (room > 0 ? '' : ' disabled') + '>+1</button><button type="button" data-ev="' + k + '" data-d="10" aria-label="' + BASE_NAME[k] + '学习力加10"' + (room > 0 ? '' : ' disabled') + '>+10</button></div></article>';
    }).join('') + '</div>';
  }
  function bagDetail(m) {
    var tabs = [['base', '基础信息'], ['stats', '能力'], ['moves', '当前技能'], ['ins', '刻印'], ['items', '道具使用']];
    var tab = ui.detailTab || 'base', content = '<p class="empty-note">从左边选择精灵，或点击空位添加。</p>';
    if (m) {
      var source = document.createElement('div'); source.innerHTML = monDetail(m);
      var section = function (key) { var el = source.querySelector('[data-mdfold="' + key + '"] .mdf-body'); return el ? el.innerHTML : ''; };
      if (tab === 'base') {
        var head = source.querySelector('.d-head');
        head.querySelectorAll('.formdesc, .placeholder-note').forEach(function (el) { el.remove(); });
        var note = head.querySelector('.hint'); if (note) note.textContent = stageLabel(SPMAP[m.sid], form(m).stage) + ' · ' + (acc.teams[acc.active][0] === m.u ? '当前配队首发' : '当前配队');
        content = head.outerHTML + '<div class="bag-mon-actions">' + (acc.teams[acc.active][0] === m.u ? '' : '<button type="button" class="btn ghost" data-lead="' + acc.active + '">设为首发</button>') + '<button type="button" class="btn ghost" data-out="' + acc.active + '">移出配队</button></div>';
      } else if (tab === 'moves') {
        var cards = ''; for (var i = 0; i < 4; i++) cards += i < m.moves.length ? bagMoveCard(m, m.moves[i], i) : '<div class="bag-skill empty-note">未装备技能</div>';
        content = '<section class="bag-current-skills"><div class="bag-ability">' + section('trait') + '</div><div class="bag-skill-grid">' + cards + '</div><button type="button" class="btn" data-move-panel="1">更换技能</button></section>';
      } else if (tab === 'stats') content = bagStats(m);
      else content = section(tab) || '<p class="empty-note">暂无可用道具。</p>';
    }
    return '<header class="bag-detail-head"><h2 class="sec">精灵资料</h2><button type="button" class="btn ghost" data-exp-panel="1"' + (acc.teams[acc.active].length ? '' : ' disabled') + '>分配经验</button></header>' +
      '<nav class="bag-detail-tabs" role="tablist" aria-label="精灵资料">' + tabs.map(function (t) { return '<button type="button" role="tab" data-detail-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</nav><div class="bag-detail-body">' + content + '</div>';
  }
  function renderBag() {
    var el = $('pg-bag');
    while (acc.teams.length < TEAM_N + (acc.teamX | 0)) acc.teams.push([]);
    var t = acc.teams[acc.active];
    if (t.indexOf(ui.sel) < 0) ui.sel = t.length ? t[0] : null;
    var body = '';
    for (var k = 0; k < TEAM_SIZE; k++) {
      var m = mon(t[k]);
      body += '<li>' + (m ? '<button type="button" class="slot filled' + (ui.sel === m.u ? ' sel' : '') + '" data-u="' + m.u + '" aria-pressed="' + (ui.sel === m.u) + '">' + (k === 0 ? '<span class="lead">首发</span>' : '') + monCard(m) + '</button>' : '<button type="button" class="slot addslot" data-pickt="' + acc.active + '"><span class="plus">＋</span>添加精灵</button>') + '</li>';
    }
    el.innerHTML = monsTabs('bag') + '<div class="bag-workspace"><section class="current-team teambox active"><div class="team-head"><h3>' + esc(tName(acc.active)) + '</h3><span class="cnt">' + t.length + ' / 5</span><button type="button" class="tm-ren" data-tren="' + acc.active + '" aria-label="配队改名">✎</button></div><ol class="bag tbag" data-team="' + acc.active + '">' + body + '</ol><footer class="bag-team-footer"><button type="button" class="btn" data-team-panel="1">切换配队</button></footer></section><article class="bag-detail" id="bag-detail">' + bagDetail(mon(ui.sel)) + '</article></div>';
    if (ui.bagPanel) renderBagPanel();
  }
  function closeBagPanel() {
    var kind = ui.bagPanel;
    ui.bagPanel = null;
    var d = $('bag-panel'); if (d) d.remove();
    if (page === 'bag' && kind) { var selector = { teams: '[data-team-panel]', exp: '[data-exp-panel]', moves: '[data-move-panel]', pick: '[data-pickt]', skill: '[data-bag-skill="' + ui.skillIdx + '"]' }[kind], trigger = selector && $('pg-bag').querySelector(selector); if (trigger) trigger.focus(); }
  }
  function renderBagPanel() {
    var kind = ui.bagPanel; if (!kind || page !== 'bag') { closeBagPanel(); return; }
    var title = '', content = '', footer = '', m = mon(ui.sel), t = acc.teams[acc.active];
    if (kind === 'teams') {
      title = '切换配队';
      content = '<div class="bag-team-options">' + acc.teams.map(function (team, i) {
        var slots = ''; for (var k = 0; k < TEAM_SIZE; k++) { var mm = mon(team[k]); slots += mm ? '<span><img src="' + form(mm).img + '" alt=""><small>' + esc(form(mm).name) + '</small></span>' : '<span class="empty-note">空位</span>'; }
        return '<button type="button" class="bag-team-option' + (ui.teamChoice === i ? ' on' : '') + '" data-team-choice="' + i + '" aria-pressed="' + (ui.teamChoice === i) + '"><b>' + esc(tName(i)) + (i === acc.active ? ' · 当前配队' : '') + '</b><span class="bag-team-preview">' + slots + '</span></button>';
      }).join('') + '</div>' + teamLockHTML();
      footer = '<button type="button" class="btn primary" data-team-apply="1"' + (ui.teamChoice == null || ui.teamChoice === acc.active || !acc.teams[ui.teamChoice] || !acc.teams[ui.teamChoice].length ? ' disabled' : '') + '>切换为当前配队</button>';
    } else if (kind === 'pick') {
      title = '添加精灵'; var team = acc.teams[ui.pick], list = acc.mons.filter(function (x) { return team.indexOf(x.u) < 0; }).sort(function (a, b) { return b.lv - a.lv; });
      content = '<div class="picker-grid">' + list.map(function (x) { return '<button type="button" class="dmon" data-padd="' + ui.pick + '" data-u="' + x.u + '"><img src="' + form(x).img + '" alt=""><span class="nm">' + esc(form(x).name) + '</span><span class="lv">LV' + x.lv + '</span><span class="tc">' + tchips(SPMAP[x.sid].types) + '</span></button>'; }).join('') + '</div>' + (!list.length ? '<p class="empty-note">仓库里没有可以加入这支配队的精灵。</p>' : '');
    } else if (kind === 'exp' && m) {
      title = '分配经验';
      content = '<div class="bag-exp-targets" aria-label="选择当前配队中的精灵">' + t.map(function (u) { var x = mon(u); return '<button type="button" class="btn' + (u === m.u ? ' primary' : '') + '" data-exp-target="' + u + '" aria-pressed="' + (u === m.u) + '">' + esc(form(x).name) + ' · LV' + x.lv + '</button>'; }).join('') + '</div><h3>' + esc(form(m).name) + '</h3>' + expBox(m);
    } else if (kind === 'moves' && m) {
      title = '更换技能'; var source = document.createElement('div'); source.innerHTML = monDetail(m); var moves = source.querySelector('[data-mdfold="moves"] .mdf-body');
      content = '<p class="hint flash" role="status">选择已学习的技能，最多装备 4 个；更改会自动保存。</p>' + (moves ? moves.innerHTML : '');
    } else if (kind === 'skill' && m) {
      title = '技能效果'; var tmp = document.createElement('div'); tmp.innerHTML = bagMoveCard(m, m.moves[ui.skillIdx], ui.skillIdx); var detail = document.createElement('div'); HSSKILL.fill(tmp.firstElementChild, detail); content = detail.innerHTML;
    } else { closeBagPanel(); return; }
    var d = $('bag-panel'), firstOpen = !d;
    if (!d) {
      d = document.createElement('div'); d.id = 'bag-panel'; d.className = 'soc-dlg'; document.body.appendChild(d);
      d.addEventListener('click', function (e) {
        if (e.target === d || e.target.closest('[data-bag-close]')) { closeBagPanel(); return; }
        var b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.dataset.teamChoice != null) { ui.teamChoice = +b.dataset.teamChoice; renderBagPanel(); return; }
        if (b.dataset.teamApply) { acc.active = ui.teamChoice; ui.sel = acc.teams[acc.active][0]; save(); closeBagPanel(); renderBag(); return; }
        if (b.dataset.expTarget) { ui.sel = +b.dataset.expTarget; renderBag(); return; }
        if (b.dataset.give || b.dataset.lvcap) { onDetailClick(e); return; }
        onBagClick(e);
      });
      d.addEventListener('change', function (e) { if (e.target.matches('[data-amove]')) onDetailChange(e); });
    }
    var y = d.querySelector('.bag-panel-body') ? d.querySelector('.bag-panel-body').scrollTop : 0;
    var focused = document.activeElement, inPanel = d.contains(focused), focusId = inPanel && focused.id;
    var focusData = inPanel && [].find.call(focused.attributes, function (attr) { return attr.name.indexOf('data-') === 0; });
    d.innerHTML = '<section class="soc-box bag-panel-box" role="dialog" aria-modal="true" aria-label="' + title + '"><header class="bag-panel-head"><h2>' + title + '</h2><button type="button" class="btn ghost" data-bag-close="1" aria-label="关闭">关闭</button></header><div class="bag-panel-body">' + content + '</div><footer class="soc-foot">' + footer + '</footer></section>';
    var restore = focusId ? [].find.call(d.querySelectorAll('[id]'), function (el) { return el.id === focusId; }) : focusData ? [].find.call(d.querySelectorAll('[' + focusData.name + ']'), function (el) { return el.getAttribute(focusData.name) === focusData.value; }) : null;
    if (restore && !restore.disabled) restore.focus({ preventScroll: true });
    else if (firstOpen || inPanel) d.querySelector('[data-bag-close]').focus({ preventScroll: true });
    d.querySelector('.bag-panel-body').scrollTop = y;
  }
  document.addEventListener('keydown', function (e) {
    var d = $('bag-panel'); if (!d) return;
    if (e.key === 'Escape') { closeBagPanel(); return; }
    if (e.key === 'Tab') {
      var buttons = [].filter.call(d.querySelectorAll('button, input, select, a[href]'), function (el) { return !el.disabled && el.getClientRects().length; });
      var first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && (document.activeElement === first || !d.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !d.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });
  $('pg-bag').addEventListener('skillinspect', function (e) { var card = e.target.closest('[data-bag-skill]'); if (card) { ui.skillIdx = +card.dataset.bagSkill; ui.bagPanel = 'skill'; renderBagPanel(); } });
  function onBagClick(e) {
    if (dragJust) { e.stopPropagation(); return; }
    var t = e.target;
    if (t.id === 'wel-x') { ui.welcome = false; renderBag(); return; }
    var b = t.closest('button'); if (!b) return;
    if (b.dataset.detailTab) { ui.detailTab = b.dataset.detailTab; renderBag(); return; }
    if (b.dataset.teamPanel) { ui.teamChoice = acc.active; ui.bagPanel = 'teams'; renderBagPanel(); return; }
    if (b.dataset.expPanel) { ui.bagPanel = 'exp'; renderBagPanel(); return; }
    if (b.dataset.movePanel) { ui.bagPanel = 'moves'; renderBagPanel(); return; }
    if (b.dataset.bagSkill != null) { ui.skillIdx = +b.dataset.bagSkill; ui.bagPanel = 'skill'; renderBagPanel(); return; }
    if (b.closest('#bag-detail')) { onDetailClick(e); return; }
    if (b.dataset.rmt != null) { var tm = acc.teams[+b.dataset.rmt]; tm.splice(tm.indexOf(+b.dataset.u), 1); if (!tm.length && acc.active === +b.dataset.rmt) { var nz = acc.teams.findIndex(function (x) { return x.length; }); if (nz >= 0) acc.active = nz; } save(); renderBag(); return; }
    if (b.dataset.topen != null) { var ti = +b.dataset.topen; if (!ui.tOpen) ui.tOpen = {}; ui.tOpen[ti] = !ui.tOpen[ti]; if (!ui.tOpen[ti] && ui.pick === ti) ui.pick = -1; renderBag(); return; }
    if (b.dataset.tren != null) { closeBagPanel(); teamRename(+b.dataset.tren); return; }
    if (b.dataset.tunlock) { var tpz = TX.D.TEAM_PRICE[acc.teamX | 0]; if (!tpz) return; if ((acc.energy || 0) < tpz) { toast('能量不足：解锁需要 ' + fmt(tpz) + ' 能量。'); return; } txRun('teamSlot', {}, function (r) { while (acc.teams.length < r.n) acc.teams.push([]); if (!ui.tOpen) ui.tOpen = {}; ui.tOpen[r.n - 1] = true; save(); renderBag(); renderRes(); toast('解锁了' + tName(r.n - 1) + '！消耗 ' + fmt(r.cost) + ' 能量。'); }); return; }
    if (b.dataset.mtab) { if (b.dataset.mtab === 'dex' && !dexOpen()) { toast('读完星际探索 · 荆楚号 · 学院部的剧情后，「黄冈秘鉴」才会开放。', prog('board').done ? '前往学院部' : '', '黄冈'); return; } go(b.dataset.mtab); return; }
    if (b.dataset.pickt != null) { ui.pick = +b.dataset.pickt; ui.bagPanel = 'pick'; renderBagPanel(); return; }
    if (b.dataset.pickx) { ui.pick = -1; renderBag(); return; }
    if (b.dataset.padd != null) { var tp = acc.teams[+b.dataset.padd], u = +b.dataset.u; if (tp.length < TEAM_SIZE && tp.indexOf(u) < 0) tp.push(u); if (tp.length >= TEAM_SIZE) { ui.pick = -1; closeBagPanel(); } ui.sel = u; save(); renderBag(); return; }
    if (b.dataset.active != null) { acc.active = +b.dataset.active; if (ui.tOpen) delete ui.tOpen[acc.active]; save(); renderBag(); return; }
    if (b.classList.contains('filled')) { ui.sel = +b.dataset.u; renderBag(); }
  }
  $('pg-bag').addEventListener('click', onBagClick);
  $('pg-bag').addEventListener('change', function (e) { if (e.target.closest('#bag-detail')) onDetailChange(e); });
  $('pg-items').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.ittab) { ui.itTab = b.dataset.ittab; renderItems(); return; }
    if (b.dataset.itsel) { ui.itSel = ui.itSel === b.dataset.itsel ? null : b.dataset.itsel; ui.itMsg = ''; renderItems(); if (ui.itSel && window.innerWidth < 860) { var dd = document.querySelector('#pg-items .ib-detail'); if (dd) dd.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    if (b.dataset.ituse) { useBagItem(b.dataset.ituse); return; }
    if (b.dataset.itgo === 'weekly') { ex.view = 'weekly'; go('explore'); return; }
    if (b.dataset.itgo === 'store') { go('store'); return; }
    if (b.dataset.itgo === 'summon') { ex.view = 'summon'; ex.planet = 'jingchu'; go('explore'); return; }
    if (b.dataset.itgo === 'home') { HSACC.goHome(); return; }
    if (b.dataset.itgo === 'nursery') { ex.view = 'nursery'; ex.area = '神农架'; ex.planet = 'jingchu'; go('explore'); return; }
    if (b.dataset.itgo === 'seedshop') { if (!farmOpen()) { toast('读完支线「伟大的种植园」后开放。'); return; } ex.view = 'seedshop'; ex.area = '恩施'; ex.planet = 'jingchu'; go('explore'); return; }
  });
  $('pg-items').addEventListener('change', function (e) {
    if (e.target.name === 'it-t') { ui.itTarget = +e.target.value; ui.itMsg = ''; renderItems(); return; }
    if (e.target.id === 'it-nat') ui.itNat = e.target.value;
  });

  // 配队内拖动排序（鼠标直接拖；触屏长按后拖）
  var drag = null, dragJust = false;
  function dStart() {
    var r = drag.el.getBoundingClientRect(), g = drag.el.cloneNode(true);
    g.classList.add('drag-ghost'); g.classList.remove('sel'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top; drag.ghost = g; document.body.appendChild(g);
    drag.el.classList.add('lifted'); drag.list.classList.add('dragging'); drag.on = true;
  }
  function dMove(x, y) {
    drag.ghost.style.left = (x - drag.dx) + 'px'; drag.ghost.style.top = (y - drag.dy) + 'px';
    var el = document.elementFromPoint(x, y), li = el && el.closest('li'), lis = [].slice.call(drag.list.children);
    var i = li && li.parentNode === drag.list ? lis.indexOf(li) : -1, n = acc.teams[drag.t].length;
    drag.to = i < 0 ? -1 : Math.min(i, n - 1);
    lis.forEach(function (l, k) { var sl = l.querySelector('.slot'); if (sl) sl.classList.toggle('drop-to', k === drag.to && drag.to !== drag.from); });
  }
  function dEnd(commit) {
    if (!drag) return; var d = drag; drag = null; clearTimeout(d.timer); if (!d.on) return;
    d.ghost.remove(); dragJust = true; setTimeout(function () { dragJust = false; }, 0);
    if (commit && d.to >= 0 && d.to !== d.from) { var t = acc.teams[d.t], u = t.splice(d.from, 1)[0]; t.splice(d.to, 0, u); save(); }
    renderBag();
  }
  $('pg-bag').addEventListener('pointerdown', function (e) {
    if (e.button > 0 || e.target.closest('.qx')) return;
    var sl = e.target.closest('.tbag .slot.filled'); if (!sl) return;
    var list = sl.closest('.tbag'), lis = [].slice.call(list.children);
    drag = { el: sl, list: list, t: +list.dataset.team, from: lis.indexOf(sl.parentNode), to: -1, x0: e.clientX, y0: e.clientY, touch: e.pointerType !== 'mouse', on: false };
    if (drag.touch) drag.timer = setTimeout(function () { if (drag && !drag.on) { dStart(); dMove(drag.x0, drag.y0); } }, 280);
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.on) {
      if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) <= 6) return;
      if (drag.touch) { clearTimeout(drag.timer); drag = null; return; }
      dStart();
    }
    dMove(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', function () { dEnd(true); });
  window.addEventListener('pointercancel', function () { dEnd(false); });
  document.addEventListener('touchmove', function (e) { if (drag && drag.on) e.preventDefault(); }, { passive: false });

  /* ---------- 精灵仓库 ---------- */
  var ALL_T = Object.keys(TYPE_COLOR);
  function filtered() {
    var f = ui.f, lo = Math.min(f.min, f.max), hi = Math.max(f.min, f.max);
    var list = acc.mons.filter(function (m) { return (!f.type || SPMAP[m.sid].types.indexOf(f.type) >= 0) && m.lv >= lo && m.lv <= hi; });
    var nm = function (m) { return form(m).name; };
    var cmp = { lvd: function (a, b) { return b.lv - a.lv || a.u - b.u; }, lva: function (a, b) { return a.lv - b.lv || a.u - b.u; }, got: function (a, b) { return a.u - b.u; }, name: function (a, b) { return nm(a).localeCompare(nm(b), 'zh-CN'); },
      ivd: function (a, b) { return ivSumOf(b) - ivSumOf(a) || b.lv - a.lv || a.u - b.u; }, iva: function (a, b) { return ivSumOf(a) - ivSumOf(b) || b.lv - a.lv || a.u - b.u; } }[f.sort] || function (a, b) { return b.lv - a.lv || a.u - b.u; };
    return list.sort(cmp);
  }
  var LV_PRE = [[1, 100, '全部'], [1, 24, 'LV1–24'], [25, 49, 'LV25–49'], [50, 100, 'LV50–100']];
  // 精灵一览（2026-10-27）：背包、仓库合成一栏，上面切换
  function monsTabs(cur) {
    return '<div class="fparts mons-tabs" role="tablist">' + [['bag', '背包'], ['store', '仓库'], ['release', '放生'], ['dex', '图鉴']].map(function (x) { var lk = x[0] === 'dex' && !dexOpen(); return '<button type="button" role="tab" class="tab' + (x[0] === cur ? ' on' : '') + '" aria-selected="' + (x[0] === cur) + '" data-mtab="' + x[0] + '"' + (lk ? ' title="读完荆楚号 · 学院部的剧情后开放"' : '') + '>' + x[1] + (lk ? ' 🔒' : '') + '</button>'; }).join('') + '</div>';
  }
  // 还能解锁的下一个配队
  function teamLockHTML() {
    var x = acc.teamX | 0, n = TEAM_N + x, p = TX.D.TEAM_PRICE[x];
    if (n >= TX.D.TEAM_MAX || !p) return '';
    return '<div class="team-lock"><b>🔒 ' + tName(n) + '</b><span class="hint">还可以再解锁 ' + (TX.D.TEAM_MAX - n) + ' 个配队</span><button class="btn primary" type="button" data-tunlock="1"' + ((acc.energy || 0) < p ? ' disabled title="能量不足"' : '') + '>用 ' + fmt(p) + ' 能量解锁</button></div>';
  }
  function renderStore() {
    var f = ui.f, list = filtered(), m = mon(ui.sel), ivSort = f.sort === 'ivd' || f.sort === 'iva';   // 按天赋排序时，卡片上直接显示天赋评级
    var cnt = {}; acc.mons.forEach(function (x) { SPMAP[x.sid].types.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    var html = monsTabs('store') + '<div class="page-head"><h2 class="sec">精灵仓库</h2><p class="hint flash" role="status"></p></div>' +
      '<div class="filters" id="filters">' +
      '<div class="f-row"><span class="f-lab">属性</span><button type="button" class="fchip' + (!f.type ? ' on' : '') + '" data-ft="">全部<i>' + acc.mons.length + '</i></button>' +
      ALL_T.map(function (t) { return '<button type="button" class="fchip t' + (f.type === t ? ' on' : '') + (cnt[t] ? '' : ' zero') + '" style="--tc:' + TYPE_COLOR[t] + '" data-ft="' + t + '">' + t + '<i>' + (cnt[t] || 0) + '</i></button>'; }).join('') + '</div>' +
      '<div class="f-row"><span class="f-lab">等级</span>' + LV_PRE.map(function (p) { return '<button type="button" class="fchip' + (f.min === p[0] && f.max === p[1] ? ' on' : '') + '" data-flv="' + p[0] + '-' + p[1] + '">' + p[2] + '</button>'; }).join('') +
      '<span class="hint" style="margin-left:6px">自定义</span><input type="number" id="f-min" min="1" max="100" value="' + f.min + '" aria-label="最低等级" inputmode="numeric"><span>–</span><input type="number" id="f-max" min="1" max="100" value="' + f.max + '" aria-label="最高等级" inputmode="numeric"></div>' +
      '<div class="f-foot"><div class="f-row"><label class="f-lab" for="f-sort">排序</label><select id="f-sort">' +
      [['lvd', '等级从高到低'], ['lva', '等级从低到高'], ['ivd', '天赋评级从高到低'], ['iva', '天赋评级从低到高'], ['got', '获得顺序'], ['name', '名称']].map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select><span class="hint">显示 ' + list.length + ' / ' + acc.mons.length + ' 只</span></div>' +
      '</div></div>' +
      '<div class="build"><div><div class="dex-grid" id="store-grid">' +
      (list.length ? list.map(function (x) {
        var ts = teamsOf(x.u);
        return '<button type="button" class="card' + (ui.sel === x.u ? ' sel' : '') + '" data-u="' + x.u + '">' +
          (ts.length ? '<span class="tms">' + ts.map(function (y) { return '<span class="' + (acc.active === y.t ? 'on' : '') + '">' + tName(y.t) + (y.lead ? '·首发' : '') + '</span>'; }).join('') + '</span>' : '') +
          '<img src="' + form(x).img + '" alt="' + esc(form(x).name) + '"><span class="nm">' + esc(form(x).name) + '</span><span class="lv">LV' + x.lv + (ivSort ? gradeTag(x) : '') + '</span><span class="meta">' + tchips(SPMAP[x.sid].types) + '</span></button>';
      }).join('') : '<p class="empty-note">没有符合条件的精灵。</p>') +
      '</div></div><article class="detail" id="store-detail">' + monDetail(m) + '</article></div>';
    $('pg-store').innerHTML = html;
  }
  $('pg-store').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mtab) { if (b.dataset.mtab === 'dex' && !dexOpen()) { toast('读完星际探索 · 荆楚号 · 学院部的剧情后，「黄冈秘鉴」才会开放。', prog('board').done ? '前往学院部' : '', '黄冈'); return; } go(b.dataset.mtab); return; }
    if (b.closest('#store-detail')) { onDetailClick(e); return; }
    if (b.dataset.ft != null) { ui.f.type = b.dataset.ft; renderStore(); return; }
    if (b.dataset.flv) { var p = b.dataset.flv.split('-'); ui.f.min = +p[0]; ui.f.max = +p[1]; renderStore(); return; }
    if (b.classList.contains('card')) { ui.sel = +b.dataset.u; renderStore(); }
  });
  $('pg-store').addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'f-min' || t.id === 'f-max') {
      var v = Math.max(1, Math.min(100, Math.round(+t.value) || (t.id === 'f-min' ? 1 : 100)));
      ui.f[t.id === 'f-min' ? 'min' : 'max'] = v; renderStore(); return;
    }
    if (t.id === 'f-sort') { ui.f.sort = t.value; renderStore(); return; }
    if (t.closest('#store-detail')) onDetailChange(e);
  });

  /* ---------- 精灵放生（2026-11-01）：规则在 js/engine/grow.js 的 release ---------- */
  var REL_TC = ['#3f8fd2', '#b36ad9', '#e0962a'];
  function relSel() { return ui.rel || (ui.rel = {}); }
  function relPicked() { var s = relSel(); return acc.mons.filter(function (m) { return s[m.u] && !GROW.relBlock(acc, m); }); }
  function relTag(m) { var t = GROW.relTier(m.sid); return t < 0 ? '' : '<span class="rel-tier" style="--rc:' + REL_TC[t] + '">' + GROW.REL_TIER[t].n + (m.shiny ? ' · 异色' : '') + '</span>'; }
  function renderRelease() {
    var s = relSel(), list = acc.mons.slice().sort(function (a, b) { var ba = GROW.relBlock(acc, a) ? 1 : 0, bb = GROW.relBlock(acc, b) ? 1 : 0; return ba - bb || a.lv - b.lv || a.u - b.u; });
    var pick = relPicked(), ex0 = 0, pt0 = 0; pick.forEach(function (m) { ex0 += GROW.relExp(m.lv); pt0 += GROW.relPt(m); });
    var html = monsTabs('release') + '<div class="page-head"><h2 class="sec">精灵放生</h2></div>' +
      '<div class="rel-bar"><span class="rel-have">' + H.itemIcon('relPt') + '放生点数 <b>' + fmt((acc.items && acc.items.relPt) || 0) + '</b></span><span class="rel-legend">' + GROW.REL_TIER.map(function (T, i) { return '<span class="rel-tier" style="--rc:' + REL_TC[i] + '">' + T.n + ' ' + T.pt + ' 点</span>'; }).join('') + '</span></div>' +
      '<div class="rel-act"><span>已选 <b>' + pick.length + '</b> 只' + (pick.length ? ' · 可获得 <b>' + fmt(ex0) + '</b> 经验、<b>' + fmt(pt0) + '</b> 放生点数' : '') + '</span><span class="rel-btns"><button type="button" class="btn ghost" data-relall="1" title="不包括异色和超过 30 级的精灵">选中全部常见精灵</button><button type="button" class="btn ghost" data-relclr="1"' + (pick.length ? '' : ' disabled') + '>清空</button><button type="button" class="btn primary" data-relgo="1"' + (pick.length ? '' : ' disabled') + '>放生</button></span></div>' +
      '<div class="dex-grid rel-grid">' + list.map(function (m) {
        var why = GROW.relBlock(acc, m), on = !why && s[m.u];
        return '<button type="button" class="card rel' + (on ? ' sel' : '') + (why ? ' lock' : '') + '" data-relu="' + m.u + '"' + (why ? ' aria-disabled="true"' : ' aria-pressed="' + !!on + '"') + '>' + (on ? '<span class="rel-ck" aria-hidden="true">✓</span>' : '') +
          '<img src="' + form(m).img + '" alt="' + esc(form(m).name) + '"><span class="nm">' + esc(form(m).name) + '</span><span class="lv">LV' + m.lv + '</span>' + relTag(m) +
          '<span class="meta">' + (why ? '🔒 ' + why : '+' + fmt(GROW.relExp(m.lv)) + ' 经验 · +' + GROW.relPt(m) + ' 点') + '</span></button>';
      }).join('') + '</div>';
    $('pg-release').innerHTML = html;
  }
  function releaseAsk() {
    var pick = relPicked(); if (!pick.length) return;
    var ex0 = 0, pt0 = 0; pick.forEach(function (m) { ex0 += GROW.relExp(m.lv); pt0 += GROW.relPt(m); });
    if (pick.length > GROW.REL_MAX) { toast('一次最多放生 ' + GROW.REL_MAX + ' 只。'); return; }
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'rel-dlg';
    d.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true" aria-label="确认放生"><span class="tape l"></span><span class="tape r"></span><span class="step">放生</span><h2>要放生这 ' + pick.length + ' 只精灵吗？</h2>' +
      '<p class="rel-names">' + pick.slice(0, 12).map(function (m) { return esc(form(m).name) + ' LV' + m.lv; }).join('、') + (pick.length > 12 ? ' 等' : '') + '</p>' +
      '<p>将获得 <b>' + fmt(ex0) + '</b> 经验、<b>' + fmt(pt0) + '</b> 放生点数。</p><p class="hint">放生后不能找回。</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-relx="1">再想想</button><button type="button" class="btn primary" data-relok="1">确认放生</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-relx]')) { d.remove(); return; }
      if (!e.target.closest('[data-relok]')) return;
      d.remove();
      txRun('release', { us: pick.map(function (m) { return m.u; }) }, function (res) { ui.rel = {}; if (pick.some(function (m) { return m.u === ui.sel; })) ui.sel = null; renderRes(); renderRelease(); toast('放生了 ' + res.n + ' 只精灵，获得 ' + fmt(res.exp) + ' 经验、' + fmt(res.pt) + ' 放生点数。'); });
    });
  }
  $('pg-release').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mtab) { if (b.dataset.mtab === 'dex' && !dexOpen()) { toast('读完星际探索 · 荆楚号 · 学院部的剧情后，「黄冈秘鉴」才会开放。', prog('board').done ? '前往学院部' : '', '黄冈'); return; } go(b.dataset.mtab); return; }
    var s = relSel(), y = HSVIEW.y();
    if (b.dataset.relu) { var m = mon(+b.dataset.relu), why = m && GROW.relBlock(acc, m); if (why) { toast(why === '在配队里' ? '这只精灵在配队里，先把它移出配队才能放生。' : why === '主宠' ? '主宠是你最初的伙伴，不能放生。' : '这只精灵只能拥有一只，不能放生。'); return; } s[m.u] = !s[m.u]; }
    else if (b.dataset.relall) acc.mons.forEach(function (m) { if (!GROW.relBlock(acc, m) && GROW.relTier(m.sid) === 0 && !m.shiny && m.lv <= 30) s[m.u] = true; });   // 2026-11-03：超过 30 级的不一键选中（练过的精灵要手动选）
    else if (b.dataset.relclr) ui.rel = {};
    else if (b.dataset.relgo) { releaseAsk(); return; }
    else return;
    renderRelease(); HSVIEW.to(0, y);
  });

  /* ---------- 黄冈秘鉴：按进化系点亮 ---------- */
  var DEX_ALL = SP.concat(EXTRA_SP);
  // 没见过的精灵 / 形态：灰色实心剪影，只看得出轮廓。占位图（svg）没有剪影文件时用滤镜压成灰色
  function silTag(sid, i) {
    var p = SILHOUETTES[sid + '_' + (i || 0)];
    return p ? '<img class="sil" src="' + p + '" alt="">' : '<img class="sil fb" src="' + formImg(SPMAP[sid], i || 0) + '" alt="">';
  }
  function owned(sid) { return acc.mons.some(function (m) { return m.sid === sid; }); }
  function litCount() { return acc ? DEX_ALL.filter(function (s) { return owned(s.id); }).length : 0; }
  // 见过：剧情里出现过立绘、或在剧情对战中交过手（竞技对战不算）。只解锁名字，图仍是黑白的
  function seeMon(sid, lv) { if (acc && ACC.seeMon(acc, sid, lv)) save(); }
  function seeStep(st, mons) {
    if (mons === 'all' || st.pick) STARTERS.forEach(function (sid) { seeMon(sid, START_LV); });
    if ((mons === 'pair' || mons === 'all') && acc.rival) seeMon(acc.rival, START_LV);
    if (st.battle && FIGHTS[st.battle]) fightTeam(FIGHTS[st.battle]).forEach(function (x) { if (SPMAP[x.sid] && !SPMAP[x.sid].nodex) seeMon(x.sid, x.lv); });   // 剧情战斗的对手记进图鉴（team 也可以是函数；木桩不算）
    if (mons && mons.indexOf('tw:') === 0) seeMon(mons.slice(3), 3);
    if (mons && mons.indexOf('mon:') === 0) seeMon(mons.split(':')[1], +mons.split(':')[2] || 1);
  }
  // 记录见过 / 获得过的进化形态（图鉴里没见过的形态显示为灰色）
  function markForm(sid, st) { if (ACC.markForm(acc, sid, st)) save(); }
  // 图鉴标题：玩家见过的最高一阶的名字
  function topName(s) {
    var i = evoLast(s); while (i > 0 && !formKnown(s.id, i)) i--;
    return form({ sid: s.id, lv: s.evo[i].lv }).name;
  }
  function formKnown(sid, st) { return !!(acc.forms && acc.forms[sid] && acc.forms[sid][st]); }
  // 旧存档：按已经读过的剧情补记
  function syncSeen() {
    if (!acc) return;
    acc.mons.forEach(function (m) { markForm(m.sid, stageOf(SPMAP[m.sid], m.lv)); });
    if (!acc.story) return;
    Object.keys(acc.story).forEach(function (k) {
      var arr = SCRIPT[k], p = acc.story[k]; if (!arr || !p) return;
      var end = p.done ? arr.length : Math.min(arr.length, (p.at || 0) + 1);
      for (var i = 0; i < end; i++) if (!skipStep(arr[i], p)) seeStep(arr[i], arr[i].mons);
    });
  }
  function seenForm(s) { return form({ sid: s.id, lv: s.evo[acc.seen[s.id]].lv }); }
  var dexSel = null;
  // 图鉴排序（2026-11-02）：按编号倒序（新的在前），没有编号的放在最后
  function dexOrder() { var no = function (s) { var v = parseInt((s.evo && s.evo[0] && s.evo[0].no) || '', 10); return isNaN(v) ? -1 : v; }; return DEX_ALL.map(function (s, i) { return { s: s, i: i, n: no(s) }; }).sort(function (a, b) { return (a.n < 0) - (b.n < 0) || b.n - a.n || a.i - b.i; }).map(function (x) { return x.s; }); }
  function renderDex2() {
    syncSeen();
    var n = litCount(), T = TITLES[0];
    var ns = DEX_ALL.filter(function (s) { return !owned(s.id) && acc.seen && acc.seen[s.id] !== undefined; }).length;
    if (dexSel && !owned(dexSel)) dexSel = null;
    var html = monsTabs('dex') + '<div class="page-head"><h2 class="sec">黄冈秘鉴</h2></div>' +
      '<div class="dex-prog"><span class="tape l"></span><div><b>' + n + '</b> / ' + DEX_ALL.length + ' 类已点亮' + (ns ? '<small class="seen-n">　另有 ' + ns + ' 类见过</small>' : '') + '</div><div class="pbar2"><i style="width:' + (n / DEX_ALL.length * 100) + '%"></i></div>' +
      '<span class="hint">' + ((acc.titles || []).indexOf(T.id) >= 0 ? '已获得称号「' + T.n + '」' : '再点亮 ' + Math.max(0, 3 - n) + ' 类，可获得称号「' + T.n + '」') + '</span></div>' +
      '<div class="build"><div class="dex-grid hg-grid">' + dexOrder().map(function (s) {
        var on = owned(s.id), best = 0;
        acc.mons.forEach(function (m) { if (m.sid === s.id) best = Math.max(best, stageOf(s, m.lv)); });
        var seen = !on && acc.seen && acc.seen[s.id] !== undefined, sf = seen ? seenForm(s) : null;
        // 完全没见过的精灵：只显示一阶形态的全黑剪影
        var img = on ? form({ sid: s.id, lv: s.evo[best].lv }).img : seen ? sf.img : null;
        var no = s.evo && s.evo[0].no ? 'No.' + s.evo[0].no + '–' + s.evo[evoLast(s)].no : '';
        return '<button type="button" class="card hg' + (on ? ' on' : seen ? ' off seen' : ' off unseen') + (dexSel === s.id ? ' sel' : '') + '" data-hg="' + s.id + '"' + (on ? '' : ' aria-disabled="true"') + '>' +
          (no ? '<span class="hgno">' + no + '</span>' : '') + (img ? '<img src="' + img + '" alt="">' : silTag(s.id, 0)) + '<span class="nm">' + (on ? esc(topName(s)) + '系' : seen ? esc(sf.name) : '？？？') + '</span>' +
          '<span class="meta">' + (on ? tchips(s.types) : '<span>' + (seen ? '见过 · 未获得' : '未获得') + '</span>') + '</span></button>';
      }).join('') + '</div><article class="detail" id="hg-detail">' + hgDetail(dexSel) + '</article></div>';
    $('pg-dex').innerHTML = html;
  }
  function hgDetail(sid) {
    if (!sid) return '<p class="empty-note">点击已点亮的精灵，查看秘鉴里记载的资料。灰色的精灵还没有带回来过。</p>';
    var s = SPMAP[sid];
    var forms = s.evo.map(function (e, i) {
      var n = formRawName(s, i); n = n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i); if ((s.placeholder || s.tbdForms) && i > 0) n = '？';
      var img = formImg(s, i), kn = formKnown(s.id, i);
      if (!kn) return '<li class="unk"><span class="hgf">' + silTag(s.id, i) + '</span><b>' + (e.no ? '<span class="dexno">No.' + e.no + '</span>' : '') + '？？？</b><small>' + stageLabel(s, i) + ' · ' + (i === 0 ? 'LV1 起' : 'LV' + e.lv + ' 进化') + '</small><p class="hint">还没有见过这一形态。</p></li>';
      return '<li><button type="button" class="hgf" data-abig="' + s.id + '|' + i + '"><img src="' + img + '" alt=""></button><b>' + (e.no ? '<span class="dexno">No.' + e.no + '</span>' : '') + esc(n) + '</b><small>' + stageLabel(s, i) + ' · ' + (i === 0 ? 'LV1 起' : 'LV' + e.lv + ' 进化') + '</small>' + (e.d ? '<p>' + esc(e.d) + '</p>' : '') + '</li>';
    }).join('');
    var stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(function (k) { var b = s.base[k]; return '<span>' + BASE_NAME[k] + '</span><span>' + b + '</span><span class="bar"><i style="width:' + Math.min(100, b / 150 * 100) + '%"></i></span><span></span>'; }).join('');
    return '<span class="tape r"></span><div class="moves-head"><h3 class="hgt">' + esc(topName(s)) + '系</h3>' + tchips(s.types) + '</div>' +
      '<ol class="hg-forms' + (s.evo.length === 2 ? ' n2' : '') + '">' + forms + '</ol>' +
      '<div class="trait"><p><b>特性 · ' + esc(s.ability.n) + '</b>　<span class="blue">' + esc(s.ability.d) + '</span></p></div>' +
      '<div><h4 style="margin:0 0 6px">种族值</h4><div class="stats">' + stats + '<span class="sum">种族值总和 ' + total(s) + '</span></div></div>';
  }
  function total(s) { var n = 0; for (var k in s.base) n += s.base[k]; return n; }
  $('pg-dex').addEventListener('click', function (e) {
    var mt = e.target.closest('[data-mtab]'); if (mt) { go(mt.dataset.mtab); return; }
    var bg = e.target.closest('[data-abig]'); if (bg) { var q = bg.dataset.abig.split('|'); H.big(q[0], +q[1]); return; }
    var c = e.target.closest('[data-hg]'); if (!c) return;
    if (!owned(c.dataset.hg)) {
      var sd = SPMAP[c.dataset.hg];
      toast(acc.seen && acc.seen[sd.id] !== undefined ? '见过「' + seenForm(sd).name + '」，但还没有把它带回来，秘鉴里只记下了名字。' : '还没有带回过这一类精灵，秘鉴里这一页还是灰的。');
      return;
    }
    dexSel = c.dataset.hg; renderDex2();
  });

  /* ---------- 星际探索：选星球 → 选地点 → 剧情（galgame 式对话） ---------- */
  var PLANETS = [
    { id: 'earth', name: '地球', d: '我们出发的地方。', sites: ['school', 'river', 'jiuquan'] },
    { id: 'jingchu', name: '荆楚号', d: '环绕地球运行的星际探索舰，轮廓和湖北省一模一样。', sites: ['board', 'xiaogan', 'academy', 'storage'], ship: true, after: 'jiuquan' },
    { id: 'station', name: '空间站', d: '停泊在荆楚号后方的空间站，先驱之塔就建在这里。', sites: [], station: true, after: 'flora1' },
    { id: 'sarena', name: '争霸赛', d: '精灵王争霸赛：报名、抽签、赛程和积分榜都在这里。', sites: [], sarena: true, after: 'flora1' },   // 2026-10-19
    { id: 'tower', name: '先驱之塔', d: '空间站里的一座高塔，共 60 层。每一层都守着一批强大的精灵，塔顶住着死神。', sites: [], tower: true, after: 'flora1', inStation: true },
    { id: 'flora', name: '芙罗拉星', d: '草系星球。丛林、草甸和盐碱地里栖息着许多野生精灵。', sites: ['flora1', 'flora2', 'flora3', 'flora4', 'flora5', 'flora6', 'flora7', 'travelcat', 'barrenMys'], wild: true, ptype: '草系星球', color: ['#9fd08a', '#3f7d4a'], get img() { return floraFallen() ? 'images/planets/flora_corrupt.webp?v=3' : 'images/planets/flora.webp?v=3'; }, after: 'board' },
    { id: 'kamble', name: '坎伯兰星', d: '水系星球。整颗星球都被海洋覆盖，从水面一直往下，是浅水区和深不见底的深海区。', sites: ['kb2', 'kb3', 'kb4', 'kb5', 'kb6', 'kb7', 'kb8'], storyIds: ['kb1', 'kb2', 'kb3', 'kb4', 'kb5', 'kb6', 'kb7', 'kb8'], storyEmpty: '第二章 · 坎伯兰星：读完第十一段「盐碱地之下」后，到荆楚号 · 随州 · 编钟通讯站开始。', wild: true, ptype: '水系星球', color: ['#8cc6ea', '#2a6fb0'], get img() { return 'images/planets/kamble_' + kbStage() + '.webp?v=2'; }, after: 'flora1' },
    { id: 'pompeii', name: '庞贝星', d: '火系星球。火山终年喷发，地面被熔岩烤得发烫。', sites: [], wild: true, ptype: '火系星球', color: ['#f2a46b', '#b3401f'], img: 'images/planets/pompeii.webp', after: 'flora1' },
    { id: 'laiting', name: '莱汀陨石带', d: '电系区域。无数陨石在雷暴中漂浮。', sites: [], wild: true, ptype: '电系陨石带', color: ['#f1dd73', '#7a6a1a'], belt: true, img: 'images/planets/laiting.webp', after: 'flora1' },
    { id: 'white', name: '白之星', d: '冰系星球。离太阳最远，整颗星球都裹在冰雪里。', sites: ['iceYado'], storyIds: ['iceYado'], storyEmpty: '读完第一章 · 芙罗拉星后开放世界任务「冰封深处的小精灵？」。', wild: true, ptype: '冰系星球', color: ['#e4f2fa', '#6aa6c8'], img: 'images/planets/white.webp', after: 'flora1' },
    { id: 'kongyan', name: '空岩星', d: '地面系和飞行系的星球。', sites: [], wild: true, ptype: '地面 · 飞行星球', color: ['#e2cfa8', '#8a6a45'], soon: true },
    { id: 'ivy', name: '常春藤前哨站', d: '常春藤在马亚尔星系的据点。', sites: [], ptype: '据点', ivy: true, soon: true }
  ];
  // 坎伯兰星的样子随剧情变化：0 是平常的蓝色，越往后越红（4 最红）。KB_STAGE_SITES 里每读完一段剧情，往后变一档
  var KB_STAGE_SITES = [];
  function kbStage() { return prog('kb8').done ? 0 : prog('kb7').done ? 4 : prog('kb6').done ? 2 : 0; }   // 2026-11-01：打赢玫瑰星云（第十九段）后变回蓝色   // 2026-10-31：保卫战期间变红一些，星云显现之后最红
  // 马亚尔星系：星系图上每颗星球的位置（% 坐标）和大小（占图宽的 %）；没有星球的位置显示「？」
  var MAYAR = { flora: [84.1, 51.4, 12], kamble: [58.3, 63.4, 9], pompeii: [30.4, 42.3, 8.5], laiting: [16.2, 28.2, 11], white: [8.5, 58, 7.5], kongyan: [43.3, 21.1, 8.5], ivy: [59.8, 26.6, 8] };   // 白之星离太阳最远
  var MAYAR_UNK = [[35.9, 28.9], [71.3, 54.3]];
  function regionsOf(pid) { return WILD_REGIONS.filter(function (R) { return R.planet === pid; }); }
  function planetOf(pid) { return PLANETS.filter(function (p) { return p.id === pid; })[0]; }
  // 荆楚号的 17 个部门，对应湖北省的 17 个市州（林区）
  var DEPTS = {
    武汉: ['指挥中枢', '舰桥所在，统筹全舰'], 孝感: ['孝感大厅', '竞技对战与模拟对战系统'], 鄂州: ['鄂州港', '停泊与对接'],
    黄冈: ['学院部', '课堂与做题家培训'], 黄石: ['冶炼工坊', '维修与制造'], 咸宁: ['温泉生活区', '宿舍与休息'],
    随州: ['编钟通讯站', '对外通讯与广播'], 襄阳: ['古城防卫部', '护盾与武备'], 十堰: ['引擎舱', '主引擎与动力'],
    宜昌: ['三峡能源核心', '全舰能源供给'], 恩施: ['生态舱', '种植与氧气循环'], 神农架: ['精灵保育区', '收容与照料野生精灵'],
    荆州: ['典籍馆', '资料与档案'], 荆门: ['物资仓储', '补给与仓库'], 天门: ['陆羽茶室', '船员的休息舱（家园）'],
    潜江: ['食堂', '餐饮补给'], 仙桃: ['体能馆', '体能与失重训练']
  };
  var SITES = {
    school: { name: '省实验中学', planet: 'earth', chapter: '第一段 · 月考之后', bg: 'gate', d: '月考成绩公布后的第二天，张老师有一件「天大的好事」要宣布，还要为你们挑选伙伴精灵。' },
    river: { name: '武昌江边', planet: 'earth', chapter: '第二段 · 江边出发', bg: 'qiyi', d: '出发的日子到了。从起义门到彭刘杨路，再坐大巴驶过长江大桥，一路向西。', after: 'school' },
    jiuquan: { name: '酒泉卫星发射中心', planet: 'earth', chapter: '第三段 · 准备发射', bg: 'jslc', d: '穿过戈壁和沙丘，大巴终于抵达发射中心。在这里，你们遇见了要去太空寻找奶弟的女孩 Threego。', after: 'river' },
    board: { name: '鄂州港', planet: 'jingchu', dept: '鄂州', chapter: '第四段 · 登上荆楚号', bg: 'orbit', d: '火箭升空，进入轨道。等在那里的，是一艘和湖北省地图一模一样的飞船。', after: 'jiuquan', pos: [22, 70] },
    academy: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 黄冈秘鉴', side: true, bg: 'pod_p', d: '学院部里收着一本记录所有精灵的「黄冈秘鉴」。读完后开放「黄冈秘鉴」。', after: 'board', pos: [50, 72] },
    flora1: { name: '盐碱地', planet: 'flora', chapter: '第五段 · 降临芙罗拉', bg: 'fl_salt', d: '第一支地面探索小队降落在了芙罗拉星。可着陆舱偏离了坐标，落进了弥漫着瘴气的盐碱地……', after: 'board' },
    flora2: { name: '卡罗聚集地', planet: 'flora', chapter: '第六段 · 卡罗的不安', bg: 'fl_meadow', d: '小队回到草甸上的卡罗聚集地，却听说有不知名的生物在猎杀被瘴气侵染的精灵。', after: 'flora1' },
    flora3: { name: '丛林边缘', planet: 'flora', chapter: '第七段 · 猎杀者', bg: 'fl_maple', d: '野外的精灵们「败下阵来」的消息传开了。傍晚，丛林边缘的草丛里，三人和卡罗屏住了呼吸……', after: 'flora2', need: function () { return spareN() >= SPARE_N; }, needText: '在芙罗拉星的丛林或草甸「假装击败」' + 5 + ' 只野生精灵，引出猎杀者' },
    flora4: { name: '丛林深处', planet: 'flora', chapter: '第八段 · 深入丛林', bg: 'fl_maple', d: 'Threego 循着点点的气味独自闯进了丛林，Vanber 又被头盔砸晕了。天快黑了，只能一个人进去找她……', after: 'flora3', need: function () { return prog('travelcat').done; }, needText: '完成世界任务「旅行猫」' },
    flora5: { name: '山毛榉林', planet: 'flora', chapter: '第九段 · 林中的猎手', bg: 'fl_beech', d: 'Vanber 也追进了丛林。大家会合之后，那些训练有素的卡莱，又出现了……', after: 'flora4' },
    flora6: { name: '盐碱地边缘', planet: 'flora', chapter: '第十段 · 瘴气之源', bg: 'fl_salt', d: '一行人决定前往盐碱地，去看看瘴气真正的源头。注意：读完这一段后，芙罗拉星的野外环境会永久改变，野生精灵将无法捕捉。', after: 'flora5' },
    // 2026-10-24：全服瘴气驱逐战击破 500 只后开放；读完后芙罗拉星恢复（瘴气精灵移到「瘴气污染的记录」里），第一章完结
    flora7: { name: '盐碱地之下', planet: 'flora', chapter: '第十一段 · 盐碱地之下', bg: 'fl_salt', d: '芙罗拉星上的大多数精灵依然被瘴气缠着。必须从根源上解决问题——这一次，一行人决定真正踏上盐碱地。', after: 'flora6',
      need: function () { pwFetch(); return !!(PW.data && PW.data.total >= 500) && (miaK() >= 10 || prog('flora7').at > 0); },
      get needText() { return PW.data && PW.data.total >= 500 ? '在芙罗拉星的丛林或草甸累计击败 10 只被瘴气污染的野生精灵（' + Math.min(10, miaK()) + ' / 10）' : '全服「瘴气驱逐战」击破数达到 500（目前 ' + (PW.data ? PW.data.total : '?') + ' 只）'; } },   // 2026-10-27：加上本账号累计击败 10 只瘴气污染精灵
    // 2026-10-31：第二章 · 坎伯兰星（未完待续）
    kb1: { name: '编钟通讯站', planet: 'jingchu', dept: '随州', chapter: '第十二段 · 远航', bg: 'bridge2_p', d: '编钟通讯站的 Jager 上尉找到了地面小队：下一站，是一颗被海洋覆盖的星球。', after: 'flora7', pos: [50, 64] },
    kb2: { name: '冥岛', planet: 'kamble', chapter: '第十三段 · 冥岛的歌声', bg: 'kb_isle', d: '穿梭机飞到冥岛上空时，海面上传来一阵奇怪的歌声……', after: 'kb1', fpart: 'story' },
    kb3: { name: '浅水区', planet: 'kamble', chapter: '第十四段 · 墨水结晶', bg: 'kb_lookup', d: '为了找到辰爷、拿到解药，你和 Bttp 潜进了坎伯兰星的海里。', after: 'kb2', fpart: 'story' },
    kb4: { name: '墨迹的尽头', planet: 'kamble', chapter: '第十五段 · 墨迹追踪', bg: 'kb_shore', d: '海面上还残留着一道淡淡的墨迹。只要跟着它，就能找到辰爷和 Threego。', after: 'kb3', fpart: 'story' },
    kb5: { name: '幽深地', planet: 'kamble', chapter: '第十六段 · 深海同行', bg: 'kb_floor', d: '被巨浪拍进深海之后，睁开眼睛，身边的人是……辰爷？', after: 'kb4', fpart: 'story' },
    kb8: { name: '水星码头', planet: 'kamble', chapter: '第十九段 · 玫瑰之战', bg: 'kb_dock', d: '想让坎伯兰星活下去，就只能打败那团星云。这一次，Cumber 也站在了码头上。', after: 'kb7', fpart: 'story' },   // 2026-11-01：第二章最后一段
    kb7: { name: '水星码头', planet: 'kamble', chapter: '第十八段 · 星云显现', bg: 'kb_dock', d: '奥多亚克被击退了。回到码头的时候，一行人以为一切都尘埃落定了……', after: 'kb6', fpart: 'story',
      need: function () { return (acc.kbwK | 0) >= KBW.need || prog('kb7').at > 0; }, get needText() { return '在「坎伯兰星保卫战」里累计击破 ' + KBW.need + ' 只奥多亚克（' + Math.min(KBW.need, acc.kbwK | 0) + ' / ' + KBW.need + '）'; } },
    kb6: { name: '古代神殿', planet: 'kamble', chapter: '第十七段 · Cumberland', bg: 'kb_temple', d: '巨大的水蛇卷着一行人，游进了深海里的一座「神殿」。', after: 'kb5', fpart: 'story' },
    mmTrial: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '活动任务 · 明明教官的试炼', side: true, event: true, bg: 'bridge_p', d: '明明教官说，要带大家去一个「好地方」。读完后开放活动「明明教官的试炼」。', after: 'flora7', pos: [42, 60] },   // 2026-10-24：读完即完成任务，送 500 明明代币
    tea: { name: '陆羽茶室', planet: 'jingchu', dept: '天门', chapter: '支线 · 陆羽茶室', side: true, bg: 'tea_p', d: '从芙罗拉星回来后，舰上要给第一支地面小队分配休息舱。读完后开放你自己的「茶室」（家园）。', after: 'flora1', pos: [50, 84] },
    mingming: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 明明教官的礼物', side: true, bg: 'bridge_p', d: '古城防卫部的明明教官听说你在黄冈秘鉴里点亮了十类精灵，想见见你。', after: 'board', pos: [48, 82], need: function () { return litCount() >= 10; }, needText: '在黄冈秘鉴中点亮 10 类精灵后开放' },
    tiger: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 东北来的泰戈尔', side: true, bg: 'bridge_p', d: '古城防卫部来了一只从东北招募的特殊虎系精灵，专门辅助船员训练。读完后开放BOSS「泰戈尔」的挑战。', after: 'board', pos: [30, 70] },
    tiger2: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 来东北试试', side: true, bg: 'bridge_p', d: '被你打败的泰戈尔一屁股坐在地上，好像有话要说……读完后开放BOSS「泰戈尔」的普通难度。', after: 'tiger', pos: [84, 72], need: function () { return bossWon('tiger'); }, needText: '击败简单难度的泰戈尔后开放' },
    fl_chal: { name: '古城防卫部', planet: 'jingchu', dept: '襄阳', chapter: '支线 · 芙罗拉星挑战', side: true, bg: 'bridge_p', d: '明明教官在芙罗拉星上划出了一条「挑战路线」，一关接一关，每关最多评三颗星。读完后开放芙罗拉星的「挑战」。', after: 'flora1', pos: [66, 56], endText: '「芙罗拉星 · 挑战」已开放：去星际探索 · 芙罗拉星的「挑战」页，从第一关开始。' },
    fl_chal2: { name: '挑战路线 · 第二关', planet: 'flora', chapter: '支线 · 借来的力量', side: true, bg: 'fl_lake', d: '第二关的入口前，明明教官打来了通讯。', after: 'fl_chal', need: function () { return chalStars('fl1') > 0; }, needText: '通过芙罗拉星挑战第一关', fpart: 'challenge', endText: '现在可以带助战精灵出战了。回到第二关，挑 4 只自己的精灵，再带上明明教官的赫菲斯试试吧。' },
    medal: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 授勋馆', side: true, bg: 'pod_p', d: '听说你从明明教官那里领到了董之马，Bttp 想带你去学院部新布置好的一间展厅看看。读完后开放「授勋馆」。', after: 'mingming', pos: [50, 40] },
    rare: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 稀有精灵', side: true, bg: 'pod_p', d: 'Bttp 在黄冈秘鉴里发现了几页几乎空白的记录，想请你帮学院部找一只稀有精灵。', after: 'flora1', pos: [26, 58] },
    hiddenSk: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 隐藏技能', side: true, bg: 'pod_p', d: '你的精灵越来越强了。Bttp 说，是时候告诉你「隐藏技能」的事了。', after: 'board', need: function () { return acc.mons.some(function (m) { return m.lv >= 40; }); }, needText: '有一只精灵达到 LV40', pos: [40, 66], endText: '获得了「地球元素」×1000，已放入储存箱。在储存箱或精灵资料里，对你的初始精灵一系使用，就能解锁隐藏技能。' },
    rare_r: { name: '学院部', planet: 'jingchu', dept: '黄冈', chapter: '支线 · 稀有精灵（汇报）', side: true, bg: 'pod_p', d: '把捕捉到的稀有精灵带回学院部，向 Bttp 汇报。', after: 'rare', pos: [74, 58], need: function () { return !!rareOwned(); }, needText: '捕捉一种稀有精灵后来汇报' },
    storage: { name: '物资仓储', planet: 'jingchu', dept: '荆门', chapter: '支线 · 物资仓储', side: true, bg: 'storage_p', d: '荆楚号即将抵达芙罗拉星，新船员要去物资仓储领取探索物资。读完后，物资仓储里的「商城」开放。', after: 'board', pos: [50, 62] },
    brawl: { name: '孝感大厅', planet: 'jingchu', dept: '孝感', chapter: '支线 · 精灵大乱斗', side: true, bg: 'xiaogan', d: 'Dr.黄 在孝感大厅里鼓捣着一台新搬来的机器，听说你身边已经有 3 只精灵了，想让你试试。读完后开放「精灵大乱斗」。', after: 'xiaogan', pos: [76, 56], need: function () { return acc.mons.length >= 3; }, needText: '持有 3 只精灵后开放' },
    draft: { name: '孝感大厅', planet: 'jingchu', dept: '孝感', chapter: '支线 · 竞技征召', side: true, bg: 'xiaogan', d: 'Dr.黄 听说你已经收集了 10 种精灵，神神秘秘地说要教你一种「真正的切磋」。', after: 'xiaogan', pos: [24, 50], need: function () { return speciesN() >= 10; }, needText: '收集 10 种精灵后开放' },
    core: { name: '三峡能源核心', planet: 'jingchu', dept: '宜昌', chapter: '支线 · 三峡能源核心', side: true, bg: 'energy_core', spot: '三峡能源核心', d: '宜昌的能源核心主人日透骨消，好像有事要拜托新船员。读完后开放「星球采矿」：领挖矿钻头、挖矿、换能量。', after: 'board', pos: [32, 62] },
    spa: { name: '温泉生活区', planet: 'jingchu', dept: '咸宁', chapter: '支线 · 温泉疗养', side: true, bg: 'cabin_p', d: 'Vanber 发现荆楚号的咸宁居然藏着一片温泉疗养区，非要拉你去泡一泡。读完后开放「温泉疗养」。', after: 'flora1', pos: [30, 62] },
    plant: { name: '生态舱', planet: 'jingchu', dept: '恩施', chapter: '支线 · 伟大的种植园', side: true, bg: 'greenhouse_p', d: 'Threego 在地球上最爱种菜，被大家叫作「叶伯伯」。她把荆楚号生态舱的种植业研究了个遍，迫不及待地想带你参观。读完后开放「太空种植园」。', after: 'flora1', pos: [26, 62] },
    iceYado: { name: '永冻冰原', planet: 'white', chapter: '世界任务 · 冰封深处的小精灵？', side: true, bg: 'wh_ice', d: '在基地里做了一个下雪的梦。第二天，Jager 上尉把你派去了白之星……', after: 'flora7' },   // 2026-11-01：读完第一章后开放
    barrenMys: { name: '地下实验室', planet: 'flora', chapter: '世界任务 · 荒芜的谜团？', side: true, bg: 'fl_lab', d: 'Cumber 的话让 Bttp 一直放不下心。和她一起回芙罗拉星，查一查荒芜的来历。', after: 'kb8' },   // 2026-11-01：读完第二章后开放
    travelcat: { name: '山毛榉林', planet: 'flora', chapter: '世界任务 · 旅行猫', side: true, bg: 'fl_beech', spot: '林子深处', d: '独自在芙罗拉星做调研的你，听见山毛榉林深处传来一阵打斗声……读完后，旅行精灵叶子喵会开始在各个星球出现。', after: 'flora2' },
    xiaogan: { name: '孝感大厅', planet: 'jingchu', dept: '孝感', chapter: '支线 · 孝感大厅', side: true, bg: 'xiaogan', d: '舰上切磋对战的地方。听说那里有个奇怪的家伙在等着新船员。读完后开放「竞技对战」。', after: 'board', pos: [50, 66] }
  };
  Object.keys(RW.STORY).forEach(function (k) { if (SITES[k]) SITES[k].reward = RW.STORY[k]; });   // 奖励数额在 js/engine/rewards.js（服务器按它核对）
  // 已有画面的舰内区域；其余区域先用占位画面
  var AREA_BG = { 宜昌: 'energy_core', 黄冈: 'pod_p', 鄂州: 'hangar_p', 孝感: 'xiaogan', 武汉: 'cockpit_p', 咸宁: 'cabin_p', 仙桃: 'gym_p', 荆门: 'storage_p', 恩施: 'greenhouse_p', 天门: 'teahall', 随州: 'bridge2_p', 襄阳: 'bridge_p' };
  var BG_POS = { qiyi: '50% 42%', desert: '50% 40%', jslc: '50% 38%', street: '50% 55%', bridge: '45% 55%', tower: '50% 55%' };
  var BG_NAME = { gate: '校门', school: '校门', flag: '教学楼', garden: '牌坊花园', qiyi: '起义门', street: '彭刘杨路', bridge: '长江大桥', desert: '鸣沙山 · 月牙泉', jslc: '发射中心', tower: '发射塔', launch: '火箭升空', orbit: '地球轨道', hangar: '鄂州港 · 停泊区', cockpit_p: '武汉 · 指挥中枢', hangar_p: '鄂州港 · 停泊区', cabin_p: '温泉生活区', greenhouse_p: '太空温室', pp_lake: '熔浆大湖', pp_slag: '熔渣矿区', pp_fort: '湖心堡垒', pp_core: '炙热核心', fl_lab: '地下实验室', fl_meadow_mia: '瘴气草甸', fl_beech_mia: '瘴气丛林', gym_p: '体能馆', storage_p: '物资仓储', pod_p: '学院部 · 资料室', tea_p: '陆羽茶室 · 04 号舱', teahall: '陆羽茶室 · 大厅', bridge2_p: '编钟通讯站', bridge_p: '古城防卫部', xiaogan: '孝感大厅', paifang: '惟楚有材牌坊', hall: '报告厅', field: '操场', aerial: '校园全景' };
  // 芙罗拉星的场景名；瘴气化后的 *_mia 版本沿用同一个名字
  Object.assign(BG_NAME, { lt_field: '雷暴星尘', lt_jupiter: '巨星之下' });
  Object.assign(BG_NAME, { kb_shore: '黄昏礁滩', kb_dusk: '暮色海面', kb_wave: '巨浪', black: '', kb_dock: '水星码头', kb_isle: '冥岛', kb_lookup: '仰望水面', kb_shoal: '群灵深海', kb_temple: '古代神殿', kb_floor: '幽深地', kb_abyss: '深渊潜底' });
  Object.assign(BG_NAME, { fl_path: '林间小路', fl_lake: '草甸湖畔', fl_beech: '山毛榉林', fl_maple: '丛林边缘', fl_meadow: '草甸', fl_sun: '丛林深处', fl_salt: '盐碱地', fl_village: '叶之村落', fl_horizon: '草甸尽头', fl_jungle_corrupt: '瘴气丛林' });
  Object.keys(BG_NAME).forEach(function (k) { if (BG[k + '_mia']) BG_NAME[k + '_mia'] = BG_NAME[k]; });
  // 角色（立绘为占位）
  var CAST = {
    p: { name: function () { return acc.name; }, color: '#c42f3a', tall: 0.92, get img() { return playerArt(); } },   // 主角立绘按性别：pm 男主 / pf 女主（差分见 CHARS 的 pm_xxx）
    v: { name: function () { return 'Vanber'; }, color: '#2a4ca0', tall: 0.8, img: 'vanber' },   // 差分：sweat 无语、shock 惊讶、smile 笑、shy 慌张
    z: { name: function () { return '张卫国'; }, color: '#5b5866', tall: 1.0, img: 'zwg' },
    t: { name: function () { return 'Threego'; }, color: '#6f8f2a', tall: 1.0, img: 'threego' },
    y: { name: function () { return '点点'; }, color: '#b0603a', tall: 1.0, img: 'dd' },
    b: { name: function () { return 'Bttp'; }, color: '#7a5a7e', tall: 1.0, img: 'bttp' },
    h: { name: function () { return 'Dr.黄'; }, color: '#a8841f', tall: 1.0, img: 'drh' },
    ai: { name: function () { return '舰载广播'; }, color: '#2a7bd8' },
    mm: { name: function () { return '明明教官'; }, color: '#4a6a8a', tall: 1.0, img: 'mm' },   // 2026-10-24：暂定立绘
    tg: { name: function () { return '泰戈尔'; }, color: '#b0702a', tall: 0.92, spr: 'tagore' },
    yd: { name: function () { return '亚哆'; }, color: '#5b8fb8', tall: 0.55, spr: 'wild', sprLv: 15 },   // 2026-11-01：冰层里救出来的亚哆
    kr: { name: function () { return '卡罗'; }, color: '#4f9159', tall: 0.55, spr: 'wind', sprLv: 3 },     // 戴上精灵翻译器之后能听懂的卡罗
    kl: { name: function () { return '卡莱'; }, color: '#3f6d3a', tall: 0.7, spr: 'kaleo', sprLv: 15 },
    lc: { name: function () { return '叶子喵'; }, color: '#5f9a3e', tall: 0.8, spr: 'leafcat', sprLv: 30 },   // 世界任务「旅行猫」里的叶子喵（戴着翻译器能听懂）
    cy: { name: function () { return '辰爷'; }, color: '#3a4a66', tall: 1.0, img: 'cy' },
    hw: { name: function () { return '荒芜'; }, color: '#5a3d6e', tall: 0.95, spr: 'barren', sprLv: 30 },
    r: { name: function () { return '日透骨消'; }, color: '#5a6a8a', tall: 1.0, img: 'rtg' },   // 三峡能源核心主人
    ms: { name: function () { return '玛西'; }, color: '#8a5a9a', tall: 0.55, spr: 'mush', sprLv: 10 },
    cx: { name: function () { return '？？？'; }, color: '#4f7aa8', tall: 1.0, img: 'cumber', sil: true },   // Cumber 现身前的黑色剪影
    cb: { name: function () { return 'Cumber'; }, color: '#4f7aa8', tall: 1.0, img: 'cumber' },   // 2026-10-31：深海基站的 Cumber（差分：oh 惊讶、smile 笑、close 闭眼、angry 生气）
    yn: { name: function () { return '一鸟'; }, color: '#5a2a3a' },   // 常春藤，辰爷的上级（只出声音，立绘待补）
    jg: { name: function () { return 'Jager 上尉'; }, color: '#3f5f7a', tall: 1.0 },   // 2026-10-31：编钟通讯站站长（立绘待补）
    sm: { name: function () { return '塞米'; }, color: '#3f8fc4', tall: 0.5, spr: 'siren', sprLv: 12 },   // 冥岛上唱歌的塞米（戴着翻译器能听懂）
    man: { name: function () { return '男人'; }, color: '#6a6a6a' },
    wom: { name: function () { return '女人'; }, color: '#8a6a7a' }   // 戴着翻译器能听懂的玛西（第八段）   // 「常春藤怀克」，常春藤组织的特工（第八段登场）
  };
  var SCRIPT = STORY_SCRIPT;   // 剧本内容见 js/data/story.js
  function unlocked(id) { var S = SITES[id], a = S.after; return (!a || prog(a).done) && (!S.need || S.need()); }
  // 稀有精灵：野外精灵表里标了 rare 的种类
  // 三主宠虽然也在野外以稀有精灵出现，但开局就有一只，不算支线「稀有精灵」要找的那种
  // （rareList 见上方说明）
  function rareList() { var R = []; for (var k in WILD) WILD[k].forEach(function (w) { if (w.rare && w.sid !== acc.starter && R.indexOf(w.sid) < 0) R.push(w.sid); }); return R; }
  function rareOwned() { var R = rareList(); return acc.mons.filter(function (m) { return R.indexOf(m.sid) >= 0; })[0] || null; }
  // 稀有精灵：野外表里标了 rare 的种类。三主宠也算，但这个账号开局选的那只不算。拥有几类按种类去重
  function rareKinds() { var R = rareList(), o = {}; acc.mons.forEach(function (m) { if (R.indexOf(m.sid) >= 0) o[m.sid] = 1; }); return Object.keys(o).length; }
  function planetOpen(P) { return !P.soon && (!P.after || prog(P.after).done); }   // soon：已经放上星图，内容还没做
  var UNLOCK = { core: '星球采矿', xiaogan: '竞技对战', academy: '黄冈秘鉴', storage: '商城', tea: '茶室', brawl: '精灵大乱斗', tiger2: '泰戈尔 · 普通难度', fl_chal: '芙罗拉星 · 挑战', fl_chal2: '助战精灵', plant: '太空种植园', medal: '授勋馆', spa: '温泉疗养' };
  function brawlOpen() { return !!(acc && acc.story && acc.story.brawl && acc.story.brawl.done); }
  function brawlPlayed() { return !!(acc && acc.stats && acc.stats.brawls > 0); }
  // 平衡模式切磋统一的等级；拥有的精灵种类数（「收集」）；是否参加过竞技征召
  var BAL_LV = 60;
  function speciesN() { var o = {}; (acc ? acc.mons : []).forEach(function (m) { o[m.sid] = 1; }); return Object.keys(o).length; }
  function draftPlayed() { return !!(acc && acc.stats && acc.stats.drafts > 0); }
  function homeOpen() { return !!(acc && acc.story && acc.story.tea && acc.story.tea.done); }
  // 茶室里展示的精灵：[{ u, t: 放出来的时间 }]
  function home() {
    if (!acc.home) acc.home = { name: '我的基地', mons: [] };
    if (acc.home.name === '陆羽茶室') acc.home.name = '我的基地';   // 2026-10-31：茶室改成基地，没改过名的换成新名字
    acc.home.mons = acc.home.mons.map(function (x) { return typeof x === 'number' ? { u: x, t: Date.now() } : x; }).filter(function (x) { return mon(x.u); });
    return acc.home;
  }
  // 太空种植园：读完支线「伟大的种植园」后开放；这条支线上线前已经在种的老玩家照常能进
  function farmOpen() { return !!acc && (prog('plant').done || !!(acc.farm && Array.isArray(acc.farm.plots) && acc.farm.plots.some(Boolean))); }
  function shopOpen() { return !!(acc && acc.story && acc.story.storage && acc.story.storage.done); }
  function dexOpen() { return !!(acc && acc.story && acc.story.academy && acc.story.academy.done); }
  function arenaOpen() { return !!(acc && acc.story && acc.story.xiaogan && acc.story.xiaogan.done); }
  /* 主线章节：一个章节的剧情全部读完后，额外发一份章节大奖（每个存档一次，记在 acc.chapters）
   * wip 表示这一章还没写完（未完待续），写完之前不算通关 */
  var CHAPTERS = [
    { id: 'prologue', n: '序章', d: '从省实验中学出发，一路到登上荆楚号。', sites: ['school', 'river', 'jiuquan', 'board'] },
    { id: 'ch1', n: '第一章 · 芙罗拉星', d: '降落芙罗拉星，追查瘴气和猎杀者的真相。', sites: ['flora1', 'flora2', 'flora3', 'flora4', 'flora5', 'flora6', 'flora7'] },
    { id: 'ch2', n: '第二章 · 坎伯兰星', d: '远航禁闭海洋。', sites: ['kb1', 'kb2', 'kb3', 'kb4', 'kb5', 'kb6', 'kb7', 'kb8'] }   // 2026-11-01：第十九段完结；章节大奖和第一章一样，另加 10 个圣晶石   // 2026-10-31：未完待续   // 2026-10-17：茶室音乐「芙罗拉星」移除，章节大奖改为经验和能量
  ];
  CHAPTERS.forEach(function (x) { x.reward = RW.CHAPTER[x.id] || x.reward || {}; });   // 奖励数额在 js/engine/rewards.js（服务器按它核对）
  function chapterOf(site) { return CHAPTERS.filter(function (C) { return C.sites.indexOf(site) >= 0; })[0] || null; }
  function chapterDone(C) { return !C.wip && C.sites.every(function (id) { return prog(id).done; }); }
  function chapterGot(id) { return !!(acc && acc.chapters && acc.chapters[id]); }
  // 剧情里拿到的东西（如 Threego 的封口费），每个存档只给一次
  function storyGive(site, g, tries) {   // 走交易（js/engine/story.js）：每个存档只给一次
    var pr = prog(site); if (pr.gave && pr.gave[g.id]) return false;
    txRun('story', { a: 'give', site: site, id: g.id }, function () { if (ready()) renderRes(); }, function (err) { if (err === '' && (tries || 0) < 20) setTimeout(function () { storyGive(site, g, (tries || 0) + 1); }, 300); });
    return true;
  }
  // 旧存档的补发：主线奖励调整的差额、物资仓储新增的道具、读完却没发过的奖励、章节大奖等（规则在 js/engine/story.js，先在本机试算，有要补的才去服务器结算）
  var storyFixBusy = false;
  function storyFix() {
    if (storyFixBusy || !ready() || !acc.introDone) return;
    var C = JSON.parse(JSON.stringify(acc)); STY.legacy(C, Date.now());
    if (JSON.stringify(C) === JSON.stringify(acc)) return;
    storyFixBusy = true;
    txRun('story', { a: 'fix' }, function (r) {
      storyFixBusy = false; var f = r.fix || {}; renderRes();
      var bits = []; if (f.exp) bits.push('累积经验 ×' + fmt(f.exp)); if (f.energy) bits.push('能量 ×' + fmt(f.energy)); for (var k in f.items || {}) bits.push(itemName(k) + ' ×' + f.items[k]);
      if (bits.length) setTimeout(function () { toast('剧情奖励补发：' + bits.join('、') + '。'); }, 600);
    }, function () { storyFixBusy = false; });
  }
  function giveItems(o) { if (o) earn('misc', '', { items: o }); }   // 旧写法：新代码请直接用 earn，写明来源
  function rwList(R) { var a = [R.exp ? '累积经验 ×' + fmt(R.exp) : '', R.energy ? '能量 ×' + fmt(R.energy) : '', R.bgm ? '基地音乐「' + bgmName(R.bgm) + '」' : '']; if (R.items) for (var k in R.items) a.push(itemName(k) + ' ×' + R.items[k]); if (R.title) a.push('称号「' + TITLES.filter(function (x) { return x.id === R.title; })[0].n + '」'); if (R.mon) a.push(R.mon); (R.gift || []).forEach(function (g) { a.push(form(g).name + ' LV' + g.lv); }); return a.filter(Boolean); }
  var ex = { view: 'planets', planet: 'earth', site: null, mode: null, host: null, i: 0, typing: false, auto: false, skip: false, timer: null, tick: null, full: '', log: [], pickSel: null };
  function story() { if (!acc.story) acc.story = {}; return acc.story; }
  function prog(site) { var st = story(); if (!st[site]) st[site] = { at: 0, done: false, ch: null }; return st[site]; }
  function monName(sid) { return sid ? form({ sid: sid, lv: START_LV }).name : '精灵'; }
  function starterName() { var m = acc.mons.filter(function (x) { return x.sid === acc.starter; })[0]; return m ? form(m).name : monName(acc.starter); }
  function fill(t) {
    var rm = t.indexOf('{rare}') >= 0 && rareOwned();
    if (rm) t = t.replace(/\{rare\}/g, form(rm).name);
    return t.replace(/\{name\}/g, acc.name).replace(/\{starter\}/g, starterName()).replace(/\{rival\}/g, monName(acc.rival))
      .replace(/\{type\}/g, acc.starter ? SPMAP[acc.starter].types[0] : '').replace(/\{rtype\}/g, acc.rival ? SPMAP[acc.rival].types[0] : '');
  }
  // 立绘差分：剧本某一句写 f: { t: 'smile' }，就换成 CHARS['threego_shy']；没有这张图时用默认立绘
  var FACE_KEY = { t: 'threego', y: 'dd', b: 'bttp', h: 'drh' };
  function standee(k, face) {
    if (CAST[k].spr) return '<img class="vn-art vn-mon" src="' + (CAST[k].sprLv ? form({ sid: CAST[k].spr, lv: CAST[k].sprLv }).img : SPRITES[CAST[k].spr]) + '" alt="" style="height:' + (CAST[k].tall * 100) + '%">';   // 精灵出场：直接用精灵立绘
    if (CAST[k].img) { var src = (face && CHARS[(FACE_KEY[k] || CAST[k].img) + '_' + face]) || CHARS[CAST[k].img]; return '<img class="vn-art" src="' + src + '" alt="" style="height:' + (CAST[k].tall * 100) + '%' + (CAST[k].sil ? ';filter:brightness(0) drop-shadow(0 0 6px rgba(120,190,255,.6))' : '') + '">'; }
    var c = CAST[k], col = c.color, head = 'M100 18c34 0 52 26 52 58s-20 60-52 60-52-28-52-60 18-58 52-58z', body = 'M40 420c-6-80 -8-150 14-200 14-32 34-50 46-54 12 4 32 22 46 54 22 50 20 120 14 200z';
    return '<svg viewBox="0 0 200 420" aria-hidden="true" style="height:' + (c.tall * 100) + '%"><g stroke="#23222b" stroke-width="4" stroke-linejoin="round">' +
      '<path d="' + body + '" fill="#fbfaf3" fill-opacity=".94"/><path d="' + body + '" fill="' + col + '" fill-opacity=".22" stroke-dasharray="11 7"/>' +
      '<path d="' + head + '" fill="#fbfaf3" fill-opacity=".94"/><path d="' + head + '" fill="' + col + '" fill-opacity=".22" stroke-dasharray="11 7"/></g>' +
      '<text x="100" y="86" text-anchor="middle" font-size="40" fill="' + col + '" font-family="Long Cang, KaiTi, cursive">?</text>' +
      '<text x="100" y="250" text-anchor="middle" font-size="22" fill="#75737e" font-family="-apple-system, PingFang SC, sans-serif">立绘占位</text></svg>';
  }
  // 主角的表情：这一句没写 f.p 时，沿用前面几句（最多往回 4 句）里最近的表情，免得别人说话时主角一直是默认的笑脸。
  // 遇到换背景、或者主角自己说了一句没写表情的话，就回到默认立绘。
  function pFace(arr, i) {
    for (var j = i; j >= 0 && j >= i - 4; j--) {
      var s = arr[j];
      if (s.f && s.f.p !== undefined) return s.f.p;
      if (j < i && (s.bg || s.s === 'p')) return null;
    }
    return null;
  }
  function skipStep(st, p) { return (st.only && st.only !== p.ch) || (st.pick && acc.starter) || (st.res && st.res !== (p.bt === 'win' ? 'win' : 'lose')); }
  // 剧情对战的对手配置
  // 剧情对战的对手配置在 js/engine/pve.js（服务器和浏览器共用，2026-10-25）
  var LEAF_ALLY = PVE.LEAF_ALLY, FIGHTS = PVE.FIGHTS;
  function storyMon(m) { return ACC.battleMon(acc, m); }
  // F.pteam：剧情限定，用一支固定的队伍代替玩家自己的配队出战（如操控 Threego 的精灵），不计入经验/学习力
  // F.allyMon：在玩家自己配队的最后加一只固定的助战精灵（如旅行叶子喵），本场战斗结束后也不计入经验/学习力；写法和 F.team 的项一样
  // F.team：精灵数组，或一个返回精灵数组的函数（用于体力/等级要跟玩家首发精灵联动的BOSS，如瘴气玛西露姆）
  // F.team / F.allyMon 的每一项：sid、lv 之外，还可以给 moves（固定技能表）、boss（见 battle.js 的 BOSS_FX）、maxhp（固定体力）、nick（显示名）、img（立绘）、miasma
  function fightTeam(F) { return PVE.fightTeam(F, acc); }
  function resolveFoeEntry(x) { return PVE.resolveFoeEntry(x, Math.random); }
  function startFight(key) {
    var F = FIGHTS[key], team, realN, allyFirst = false;
    if (srvMode()) {
      var host0 = ex.host, cuts0 = (F.cuts || []).map(function (c) { return { hp: c.hp, lines: c.lines.map(function (L) { return { n: L.s === 'n' ? '' : CAST[L.s].name(), t: fill(L.t) }; }) }; });
      return pveRemote('story', { key: key, allyOff: !!ex.allyOff, site: ex.site }, { bg: F.bg ? fightBg(F.bg) : null, corrupt: !!F.corrupt, cuts: cuts0, env: F.env || null,
        pre: function () { host0.hidden = true; if (ex.mode === 'replay') $('pg-explore').hidden = true; } }, function (e, res) {
        var r = e && e.rep, bt = r ? r.res : res;
        if (r && r.own) { var got = xpMsg(r.xp); dailyHit('pve'); if (got.length) toast(got.join('')); }
        ex.fighting = false; document.body.classList.remove('story-fight');
        if (bt !== 'void') prog(ex.site).bt = bt;
        save();
        $('pg-arena').hidden = page !== 'arena' || ex.mode === 'intro' || ex.mode === 'replay';
        host0.hidden = false; if (ex.mode === 'replay') $('pg-explore').hidden = false;
        if (bt === 'void') { toast('这场对战作废了，重新开始这一战吧。'); renderVN(); syncBattle(); return; }
        if (F.mustWin && bt !== 'win') { toast('没能打倒' + (F.foe || '对手') + '……调整一下配队，再来一次吧。'); renderVN(); syncBattle(); return; }   // mustWin：必须打赢才能往下读（第十九段）
        ex.i++; renderVN(); syncBattle(); HSVIEW.to(0, HSVIEW.top(host0) - 8);
      });
    }
    if (F.pteam) {
      team = F.pteam.map(function (x) { return { id: x.sid, lv: x.lv, moves: x.moves || defaultMoves(x.sid, x.lv), nick: x.nick, img: x.img || formImg(SPMAP[x.sid], x.st != null ? x.st : stageOf(SPMAP[x.sid], x.lv)), boss: x.boss ? JSON.parse(JSON.stringify(x.boss)) : undefined }; });
      realN = 0;
    } else {
      team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
      if (!team.length) team = acc.mons.slice(0, 1);
      team = team.slice(0, TEAM_SIZE).map(storyMon);
      realN = team.length;
      if (F.allyMon && !(F.allyOpt && ex.allyOff)) { team = [resolveFoeEntry(F.allyMon)].concat(team.slice(0, TEAM_SIZE - 1)); realN = team.length - 1; allyFirst = true; }   // 助战精灵默认首发   // allyOpt：助战可选，开战前在对战卡上勾选（默认带上）
    }
    var a = fightTeam(F).map(resolveFoeEntry);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    var host = ex.host; host.hidden = true;
    if (ex.mode === 'replay') $('pg-explore').hidden = true;
    $('pg-arena').hidden = false;
    // F.bgm：这一战的专属战斗曲（不先放遇敌曲）；F.preStrike：对方偷袭，开场先出一招；F.cuts：对方体力降到某个数值以下时插播对话（见 battle-ui.js）
    var cuts = (F.cuts || []).map(function (c) { return { hp: c.hp, lines: c.lines.map(function (L) { return { n: L.s === 'n' ? '' : CAST[L.s].name(), t: fill(L.t) }; }) }; });
    window.HSBATTLE.start({ p: team, a: a, foe: F.foe, items: invCopy(), env: F.env || null, bg: F.bg ? fightBg(F.bg) : null, corrupt: !!F.corrupt, bgm: F.bgm || null, bgmDirect: !!F.bgm, preStrike: !!F.preStrike, cuts: cuts, onItem: useInv, onEnd: function (res, seen, downs) {
      if (realN > 0) {
        var o0 = allyFirst ? 1 : 0, got = battleRewards(team.slice(o0, o0 + realN), (seen || []).slice(o0, o0 + realN), downs);   // 助战精灵不拿经验
        dailyHit('pve');
        if (got.length) toast(got.join(''));
      }
      ex.fighting = false; document.body.classList.remove('story-fight'); prog(ex.site).bt = res; save();
      $('pg-arena').hidden = page !== 'arena' || ex.mode === 'intro' || ex.mode === 'replay';
      host.hidden = false; if (ex.mode === 'replay') $('pg-explore').hidden = false;
      if (F.mustWin && res !== 'win') { toast('没能打倒' + (F.foe || '对手') + '……调整一下配队，再来一次吧。'); renderVN(); syncBattle(); return; }
      ex.i++; renderVN(); syncBattle(); HSVIEW.to(0, HSVIEW.top(host) - 8);
    } });
  }
  function stepAt(i) { var arr = SCRIPT[ex.site], p = prog(ex.site); while (i < arr.length && skipStep(arr[i], p)) i++; return i; }
  function carry(i, key, def) { var arr = SCRIPT[ex.site], p = prog(ex.site), v = def; for (var k = 0; k <= i && k < arr.length; k++) if (arr[k][key] !== undefined && !(arr[k].only && arr[k].only !== p.ch)) v = arr[k][key]; return v; }

  function renderExplore() {
    if (ex.view !== 'endless' && $('en-modal')) enModalOff();
    if (ex.shipBack && !shipBackOn()) ex.shipBack = null;
    navSync();
    if (ex.mode === 'intro') return;
    if (typeof SPA !== 'undefined' && SPA.on && ex.view !== 'spa') { var pend = Object.assign({}, ex); ex.view = 'spa'; ex.area = '咸宁'; renderSpa(); spaLeaveAsk(function () { Object.assign(ex, pend); renderExplore(); }); return; }   // 正在泡温泉：离开前先确认
    stopTimers(); setTimeout(bgmScene, 0);
    var el = $('pg-explore');
    if (ex.view === 'vn') { renderVN(); return; }
    if (ex.view === 'field') { renderField(); return; }
    if (ex.view === 'area') { renderArea(); return; }
    if (ex.view === 'quests') ex.view = 'planets';   // 任务面板已经移到顶栏
    if (ex.view === 'home') { if (homeOpen()) { renderHome(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'boss') { if (bossOpen(ex.boss)) { renderBoss(); return; } ex.view = 'planets'; }
    if (ex.view === 'bosshub') { renderBossHub(); return; }
    if (ex.view === 'weekly') { if (weeklyOpen()) { ex.boss = curWk().boss; renderBoss(true); return; } ex.view = 'planets'; }
    if (ex.view !== 'archive' && ex.arcPlay) arcStop();
    if (ex.view === 'archive') { renderArchive(); return; }
    if (ex.view === 'mmArena') { if (mmOpen()) { renderMmArena(); return; } ex.view = 'planets'; }
    if (ex.view === 'mmGacha') { if (acc.mm || mmOpen()) { renderMmGacha(); return; } ex.view = 'planets'; }
    if (ex.view === 'wkhub') { if (weeklyOpen()) { renderWkHub(); return; } ex.view = 'planets'; }
    if (ex.view === 'ewk') { if (weeklyOpen() && ewkType(ex.ewkT)) { renderEwk(); return; } ex.view = 'planets'; }
    if (ex.view === 'room') { if (homeOpen()) { renderRoom(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'teashop') { if (homeOpen()) { renderTeaShop(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'baseshop') { if (homeOpen()) { renderBaseShop(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'shop') { if (shopOpen()) { renderShop(); return; } ex.view = 'area'; renderArea(); return; }
    if (ex.view === 'forge') { renderForge(); return; }
    if (ex.view === 'summon') { renderSummon(); return; }
    if (ex.view === 'endless') { renderEndless(); return; }
    if (ex.view === 'nursery') { renderNursery(); return; }
    if (ex.view === 'medal') { if (medalOpen()) { renderMedal(); return; } ex.view = 'area'; ex.area = '黄冈'; }
    if (ex.view === 'farm') { if (farmOpen()) { renderFarm(); return; } ex.view = 'area'; ex.area = '恩施'; }
    if (ex.view === 'seedshop') { if (farmOpen()) { renderSeedShop(); return; } ex.view = 'area'; ex.area = '恩施'; }
    if (ex.view === 'spa') { if (spaOpen()) { renderSpa(); return; } ex.view = 'area'; ex.area = '咸宁'; }
    var Pp = ex.view === 'sites' && PLANETS.filter(function (p) { return p.id === ex.planet; })[0];
    var html = exHead('');
    if (ex.view === 'planets') {
      // 2026-10-31：空间站、太空竞技场、BOSS挑战、每周挑战移到飞船终端（舰体图右边）
      html += '<div class="gx-rows">' + mayarMap() + '</div>' + arcBarHTML() +
        '<div class="gx-rows"><div class="gx-row">' + planetCard(planetOf('earth')) + '</div></div>';
    } else {
      var P = PLANETS.filter(function (p) { return p.id === ex.planet; })[0];
      html += '<div class="crumb">' + (P.ship ? '' : '<button type="button" class="btn ghost" id="ex-back">‹ ' + (P.inStation ? '返回空间站' : SHIP_SIDE[P.id] ? '返回飞船终端' : '返回星图') + '</button>') + '<b>' + (P.ship ? '飞船终端 · ' : '') + (P.inStation ? '空间站 · ' : MAYAR[P.id] ? '马亚尔星系 · ' : '') + P.name + '</b></div>';
      if (P.ship) { el.innerHTML = html + shipMap(P); return; }
      if (P.wild) { el.innerHTML = html + (P.id === 'flora' ? floraPage() : wildPage(P)); return; }
      if (P.tower) { el.innerHTML = html + towerPage(); return; }
      if (P.station) { el.innerHTML = html + '<div class="planets">' + planetCard(planetOf('tower')) + (prog('flora7').done && mmLive() ? '<button type="button" class="planet' + (mmOpen() ? '' : ' locked') + '"' + (mmOpen() ? ' data-mmarena="1"' : ' disabled') + '><span class="tape l"></span><span class="mm-ic" aria-hidden="true">🛰</span><span class="pn">全息作战场地<span class="chip ptype">限时</span></span><span class="hint">明明教官安置的全息作战场地。活动「明明教官的试炼」期间开放。</span><span class="pc">' + (mmOpen() ? '明明代币 ' + fmt(acc.items.mmTok || 0) + ' · ' + mmLeftText() : '先完成活动任务「明明教官的试炼」') + '</span></button>' : '') + '</div>'; return; }
      if (P.sarena) { el.innerHTML = html + sarenaPage(); return; }
      html += '<div class="sites">' + P.sites.map(function (id) {
        var S = SITES[id], pr = prog(id), started = pr.at > 0 && !pr.done, open = unlocked(id);
        var rw = S.reward ? '<p class="hint">首次读完奖励：' + rwList(S.reward).filter(Boolean).join('、') + (UNLOCK[id] ? '，并开放' + UNLOCK[id] : '') + (pr.rewarded ? '（已领取）' : '') + '</p>' : '';
        return '<article class="site' + (open ? '' : ' locked') + '"><span class="tape r"></span><div class="site-img"><img src="' + BG[S.bg] + '" alt="' + S.name + '" style="object-position:' + (BG_POS[S.bg] || '50% 60%') + '"></div><div class="site-txt">' +
          '<span class="sc-tag' + (S.side ? ' side' : '') + '">' + S.chapter + '</span><h3>' + S.name + '</h3><p class="hint">' + S.d + '</p>' + rw +
          '<p class="site-st ' + (pr.done ? 'blue' : started ? 'red' : '') + '">' + (!open ? '读完「' + SITES[S.after].chapter.split(' · ')[1] + '」后解锁' : pr.done ? '已读完' : started ? '读到一半' : '未读') + '</p>' +
          '<div class="site-act">' + (!open ? '' : started ? '<button type="button" class="btn primary" data-go="' + id + '" data-from="cont">继续剧情</button><button type="button" class="btn" data-go="' + id + '" data-from="0">从头开始</button>'
            : '<button type="button" class="btn primary" data-go="' + id + '" data-from="0">' + (pr.done ? '重温剧情' : '进入') + '</button>') + '</div></div></article>';
      }).join('') + '</div>';
    }
    el.innerHTML = html;
  }
  function sPath(p, k) { k = k || 1; return 'M' + p.map(function (q) { return (q[0] * k).toFixed(1) + ',' + (q[1] * k).toFixed(1); }).join('L') + 'Z'; }
  function shipIcon() {
    return '<svg viewBox="-20 0 840 600" aria-hidden="true"><g transform="rotate(-8 400 300)"><path d="' + sPath(SHIP.outline) + '" transform="translate(0,22)" fill="#4b5260" stroke="#23222b" stroke-width="10"/>' +
      '<path d="' + sPath(SHIP.outline) + '" fill="#e6eaf0" stroke="#23222b" stroke-width="10" stroke-linejoin="round"/>' +
      '<path d="M60,330 C260,300 420,300 780,300 L780,330 C420,330 260,334 60,362 Z" fill="#c42f3a"/></g></svg>';
  }
  function deptOpen(n) { return n === '鄂州' || prog('board').done; }
  function deptSites(n) { return Object.keys(SITES).filter(function (id) { return SITES[id].dept === n; }); }
  function deptTodo(n) { return deptSites(n).filter(function (id) { return unlocked(id) && !prog(id).done; }).length; }
  // 舰体平面图：点击区域即传送
  function shipMap(P) {
    var g = SHIP.regions.map(function (r) {
      var d = DEPTS[r.n], open = deptOpen(r.n), todo = open && deptTodo(r.n), big = r.r > 22;
      return '<g class="dept' + (open ? ' open' : ' lockd') + (todo ? ' todo' : '') + '"' + (open ? ' data-area="' + r.n + '" tabindex="0" role="button" aria-label="传送到' + r.n + ' · ' + d[0] + '"' : '') + '>' +
        '<title>' + r.n + ' · ' + d[0] + '：' + d[1] + (open ? (todo ? '（有可进行的剧情）' : '（点击传送）') : '（登船后开放）') + '</title>' +
        '<path d="' + sPath(r.p) + '"/>' + '<text x="' + r.c[0] + '" y="' + (r.c[1] - (big ? 6 : 0)) + '" class="dn">' + d[0] + '</text>' +
        (big ? '<text x="' + r.c[0] + '" y="' + (r.c[1] + 11) + '" class="df">' + r.n + '</text>' : '') +
        (todo ? '<g transform="translate(' + (r.c[0] + (big ? 30 : 14)) + ',' + (r.c[1] - (big ? 20 : 14)) + ')"><g class="pin"><circle r="10"/><text y="4.5">!</text></g></g>' : '') + '</g>';
    }).join('');
    return '<figure class="shipmap">' + shipQuick() + '<div class="sm-wrap"><svg viewBox="-60 20 880 560" role="img" aria-label="荆楚号舰体平面图">' +
      '<g class="eng">' + [[16, 398, 30], [20, 452, 26], [42, 510, 22], [130, 122, 24], [124, 74, 18]].map(function (e) { return '<path d="M' + (e[0] - 14) + ',' + (e[1] - e[2] / 2) + ' l-' + (e[2] * 1.6) + ',' + (e[2] * .3) + ' l0,' + (e[2] * .4) + ' l' + (e[2] * 1.6) + ',' + (e[2] * .3) + ' Z"/>'; }).join('') + '</g>' +
      '<path class="hull" d="' + sPath(SHIP.outline) + '"/>' + g + '<path class="hull-l" d="' + sPath(SHIP.outline) + '"/></svg>' + shipSide() + '</div>' +
      '<figcaption><span><i class="lg open"></i>可传送</span><span><i class="lg pin">!</i>有可进行的剧情</span><span><i class="lg"></i>登船后开放</span>船尾（西侧）是引擎，船头朝东。</figcaption></figure>' + shipTiles();
  }
  // 舰体图上方（同一个黑框里）的快捷入口：基地、种植园、冶炼、孵化、商城（2026-10-31）
  var SHIP_QUICK = [
    { k: 'home', ic: '🏠', t: '基地', area: '天门', open: function () { return homeOpen(); }, lock: '读完天门支线「陆羽茶室」后开放' },
    { k: 'farm', ic: '🌱', t: '种植园', area: '恩施', open: function () { return farmOpen(); }, lock: '读完支线「伟大的种植园」后开放' },
    { k: 'forge', ic: '🔥', t: '冶炼', area: '黄石', open: function () { return true; } },
    { k: 'nursery', ic: '🥚', t: '孵化', area: '神农架', open: function () { return true; } },
    { k: 'shop', ic: '🛒', t: '商城', area: '荆门', open: function () { return shopOpen(); }, lock: '读完支线「物资仓储」后开放' }
  ];
  function dotHatch() { if (!acc || !acc.nursery || !Array.isArray(acc.nursery.slots)) return false; return acc.nursery.slots.some(function (x) { var H = x && MATS[x.k] && MATS[x.k].hatch; return !!(H && Date.now() - x.t >= H.min * 60000); }); }
  function dotFarm() { return !!acc && farmOpen() && farm().plots.some(farmReady); }
  function dotSummon() { if (!acc) return false; var S0 = acc.sum || {}; return S0.fsDay !== ACC.dayStr(Date.now()) || (S0.free | 0) > 0; }
  var SHIP_DOTS = { nursery: dotHatch, farm: dotFarm, summon: dotSummon };
  function shipDot() { return Object.keys(SHIP_DOTS).some(function (k) { return SHIP_DOTS[k](); }); }
  // 主导航上的小红点：航行日志（没读过的）、飞船终端（有东西可以领 / 免费）
  function navDots() {
    if (!acc) return;
    var want = { log: logUnread() > 0, ship: shipDot() };
    Object.keys(want).forEach(function (pg) {
      var b = document.querySelector('#mainnav .nav[data-page="' + pg + '"]'); if (!b) return;
      var d = b.querySelector('.red-dot');
      if (want[pg] && !d) b.insertAdjacentHTML('beforeend', '<i class="red-dot nav-dot" aria-label="有新内容"></i>'); else if (!want[pg] && d) d.remove();
    });
    [].forEach.call(document.querySelectorAll('[data-smq], [data-summon]'), function (b) {
      var k = b.dataset.smq || (b.dataset.summon ? 'summon' : ''), on = SHIP_DOTS[k] && SHIP_DOTS[k](), d = b.querySelector('.red-dot');
      if (on && !d) b.insertAdjacentHTML('beforeend', '<i class="red-dot" aria-label="可以领取"></i>'); else if (!on && d) d.remove();
    });
  }
  setInterval(navDots, 15000);
  function shipQuick() {
    return '<div class="sm-quick">' + SHIP_QUICK.map(function (q) { var op = q.open(); return '<button type="button" class="sm-q' + (op ? '' : ' locked') + '" data-smq="' + q.k + '"' + (op ? '' : ' title="' + q.lock + '"') + '><span>' + q.ic + '</span><b>' + q.t + '</b></button>'; }).join('') + '</div>';
  }
  function shipQuickGo(k) {
    var q = SHIP_QUICK.filter(function (x) { return x.k === k; })[0]; if (!q) return;
    if (!q.open()) { toast(q.lock); return; }
    ex.shipBack = { k: q.k, y: HSVIEW.y() };   // 从飞船终端点进来的：返回时直接回飞船终端（2026-11-01）
    ex.view = q.k; ex.area = q.area; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
  }
  var SHIP_BACK = { home: { views: ['home'], btn: 'home-back' }, farm: { views: ['farm', 'seedshop'], btn: 'farm-back' }, forge: { views: ['forge'], btn: 'forge-back' }, nursery: { views: ['nursery'], btn: 'nursery-back' }, shop: { views: ['shop'], btn: 'ex-area' } };
  function shipBackOn() { var B = ex.shipBack && SHIP_BACK[ex.shipBack.k]; return B && B.views.indexOf(ex.view) >= 0 ? B : null; }
  if (window.MutationObserver) new MutationObserver(function () { shipBackLabel(); }).observe($('pg-explore'), { childList: true });
  function shipBackLabel() { var B = shipBackOn(); if (!B) return; var el = $(B.btn); if (el) el.textContent = '‹ 返回飞船终端'; }
  $('pg-explore').addEventListener('click', function (e) {
    var b = e.target.closest('button'), B = shipBackOn(); if (!b || !B || b.id !== B.btn) return;
    e.stopImmediatePropagation(); var y = ex.shipBack.y; ex.shipBack = null;
    ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, y || 0);
  }, true);
  // 舰体图右边（同一个黑框里）：空间站、太空竞技场、BOSS挑战、每周挑战（2026-10-31，从星际探索的星图页搬过来）
  function shipSide() {
    var item = function (attr, ic, t, sub, open) { return '<button type="button" class="sm-it' + (open ? '' : ' locked') + '"' + (open ? ' ' + attr : ' disabled') + '><span class="sm-ic">' + ic + '</span><span class="sm-t"><b>' + t + '</b><small>' + sub + '</small></span></button>'; };
    var st = planetOf('station'), sa = planetOf('sarena'), bk = Object.keys(BOSSES), nOpen = bk.filter(bossOpen).length, wk = weeklyOpen();
    return '<div class="sm-side">' +
      item('data-planet="station"', '<img src="images/planets/station.webp" alt="">', '空间站', planetOpen(st) ? '先驱之塔 · 全息作战场地' : '读完「降临芙罗拉」后开放', planetOpen(st)) +
      item('data-goarena="1"', '⚔', '竞技对战', arenaOpen() ? '沙盒调试 · 平衡排位 · 精灵大乱斗' : '读完荆楚号 · 孝感大厅的支线后开放', arenaOpen()) +   // 2026-11-02：太空竞技场拆成两项
      item('data-planet="sarena"', sarenaSvg(), '争霸赛', planetOpen(sa) ? esc(CONTEST.name) : '读完「降临芙罗拉」后开放', planetOpen(sa)) +
      item('data-summon="1"', '<img src="images/items/saint_quartz.webp" alt="">', '召唤', '圣晶石召唤 · 友情点召唤', true) +
      item('data-endless="1"', '♾', '无尽作战', EN.rec(acc).run ? '作战进行中 · 难度 ' + EN.rec(acc).run.d : '已解锁难度 ' + EN.rec(acc).maxD + ' / ' + EN.D_MAX, true) +   // 2026-11-02
      item('data-bosshub="1"', '<img src="' + SPRITES[BOSSES[bk[0]].sid] + '" alt="">', 'BOSS挑战', '已开放 ' + nOpen + ' / ' + bk.length, true) +
      item('data-wkhub="1"', wk ? '<span class="sm-pm">' + permits() + '</span>' : '🔒', '每周挑战', wk ? '挑战许可 ' + permits() + ' / ' + PERMIT.max : '击败困难难度的泰戈尔或荒芜后开放', wk) +
      '</div>';
  }
  // 舰体图下方的区域板块（2026-10-27）：只列出有功能的区域（不列剧情），每块写明有什么功能；点击传送过去（和点舰体图一样）
  function areaFeats(n) {
    var out = [];
    Object.keys(BOSSES).forEach(function (k) { var B = BOSSES[k]; if (B.dept === n && bossOpen(k)) out.push({ t: 'BOSS「' + B.name + '」', s: B.lv.filter(function (L, i) { return levelOpen(k, i); }).map(function (L) { return L.diff; }).join(' / ') }); });
    if (n === '荆门' && shopOpen()) out.push({ t: '商城 · 物资兑换' });
    if (n === '黄石') { out.push({ t: '冶炼坊' , s: '合成捕捉装置、药水等' }); }
    if (n === '咸宁' && spaOpen()) out.push({ t: '温泉疗养' });
    if (n === '恩施' && farmOpen()) { out.push({ t: '太空种植园' }); out.push({ t: '种子商店' }); }
    if (n === '黄冈' && medalOpen()) out.push({ t: '授勋馆' });
    if (n === '宜昌' && coreOpen()) out.push({ t: '星球采矿 · 能量兑换' });
    if (n === '神农架') out.push({ t: '精灵保育仓', s: '孵化精元' });
    if (n === '天门' && homeOpen()) { out.push({ t: '我的房间' }); out.push({ t: '茶室商店' }); out.push({ t: '拜访船员的房间' }); }
    return out;
  }
  function shipTiles() {
    var tiles = SHIP.regions.filter(function (r) { return deptOpen(r.n) && areaFeats(r.n).length; }).map(function (r) {
      var d = DEPTS[r.n], F = areaFeats(r.n), todo = 0, bg = AREA_BG[r.n] && BG[AREA_BG[r.n]];
      return '<button type="button" class="st-tile' + (todo ? ' todo' : '') + '" data-area="' + r.n + '">' +
        '<span class="st-img">' + (bg ? '<img src="' + bg + '" alt="" loading="lazy">' : '<img class="st-ph" src="' + CHARS.ship_icon + '" alt="">') + (todo ? '<i class="st-pin">!</i>' : '') + '</span>' +
        '<span class="st-txt"><b>' + d[0] + '</b><small>' + r.n + '</small>' +
        '<ul class="st-feat">' + F.map(function (f) { return '<li' + (f.hot ? ' class="hot"' : '') + '>' + esc(f.t) + (f.s ? '<em>' + esc(f.s) + '</em>' : '') + '</li>'; }).join('') + '</ul></span></button>';
    });
    return '<h3 class="sec st-h">舰内区域</h3>' + (tiles.length ? '<div class="ship-tiles">' + tiles.join('') + '</div>' : '<p class="hint">暂时还没有可以去的区域。</p>');
  }
  // 区域：传送过来后，点击场景里的剧情点开始剧情
  function renderArea() {
    var n = ex.area, d = DEPTS[n], bg = AREA_BG[n], ids = deptSites(n);
    var mk = ids.map(function (id) {
      var S = SITES[id], pr = prog(id), open = unlocked(id), started = pr.at > 0 && !pr.done, pos = S.pos || [50, 60];
      var st = !open ? (S.need && prog(S.after).done ? S.needText : '读完「' + SITES[S.after].chapter.split(' · ')[1] + '」后开放') : pr.done ? '已读完 · 点击重温' : started ? '读到一半 · 点击继续' : '点击开始';
      return '<button type="button" class="mk' + (S.side ? ' side' : '') + (pr.done ? ' done' : '') + (open ? '' : ' locked') + '"' + (open ? ' data-go="' + id + '" data-from="' + (started ? 'cont' : '0') + '"' : ' disabled') + ' style="left:' + pos[0] + '%;top:' + pos[1] + '%">' +
        '<span class="mk-dot">' + (pr.done ? '✓' : open ? '!' : '锁') + '</span><span class="mk-lab"><b>' + S.chapter + '</b><small>' + st + '</small></span></button>';
    }).join('');
    var rw = ids.map(function (id) { var S = SITES[id], R = S.reward; return R ? '<li><b>' + S.chapter + '</b>：' + S.d + '<br><span class="hint">首次读完奖励：' + rwList(R).filter(Boolean).join('、') + (UNLOCK[id] ? '，并开放' + UNLOCK[id] : '') + (prog(id).rewarded ? '（已领取）' : '') + '</span></li>' : '<li><b>' + S.chapter + '</b>：' + S.d + '</li>'; }).join('');
    $('pg-explore').innerHTML = exHead('') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ex-ship">‹ 返回舰体图</button><b>荆楚号 · ' + d[0] + '</b><span class="hint">' + n + ' · ' + d[1] + '</span></div>' +
      '<div class="area' + (ex.tp ? ' tp' : '') + '"><div class="area-scene">' +
      (bg ? '<img src="' + BG[bg] + '" alt="' + d[0] + '">' : '<div class="area-ph"><img src="' + CHARS.ship_icon + '" alt=""><b>' + d[0] + '</b><span>这片区域的具体样子还在建造中</span></div>') +
      mk + (n === '天门' ? hallSpots() : '') + bossSpots(n) +
      (n === '荆门' ? '<button type="button" class="mk shop' + (shopOpen() ? '' : ' locked') + '"' + (shopOpen() ? ' data-shop="1"' : ' disabled') + ' style="left:74%;top:40%"><span class="mk-dot">' + (shopOpen() ? '商' : '锁') + '</span><span class="mk-lab"><b>商城 · 物资兑换</b><small>' + (shopOpen() ? '普通捕捉装置和补药' : '读完「物资仓储」支线后开放') + '</small></span></button>' : '') +
      (n === '黄石' ? '<button type="button" class="mk shop" data-forge="1" style="left:50%;top:58%"><span class="mk-dot">炼</span><span class="mk-lab"><b>冶炼坊</b><small>合成捕捉装置、hp药水等</small></span></button>' : '') +
      (n === '咸宁' ? '<button type="button" class="mk shop' + (spaOpen() ? '' : ' locked') + '"' + (spaOpen() ? ' data-spa="1"' : ' disabled') + ' style="left:66%;top:52%"><span class="mk-dot">' + (spaOpen() ? '泉' : '锁') + '</span><span class="mk-lab"><b>温泉疗养</b><small>' + (spaOpen() ? spaSummary() : '读完支线「温泉疗养」后开放') + '</small></span></button>' : '') +
      (n === '恩施' ? '<button type="button" class="mk shop' + (farmOpen() ? '' : ' locked') + '"' + (farmOpen() ? ' data-farm="1"' : ' disabled') + ' style="left:62%;top:58%"><span class="mk-dot">' + (farmOpen() ? '种' : '锁') + '</span><span class="mk-lab"><b>太空种植园</b><small>' + (farmOpen() ? '种药草和活力花，做血药和 PP 药水' : '读完支线「伟大的种植园」后开放') + '</small></span></button>' +
        '<button type="button" class="mk shop' + (farmOpen() ? '' : ' locked') + '"' + (farmOpen() ? ' data-seedshop="1"' : ' disabled') + ' style="left:30%;top:44%"><span class="mk-dot">' + (farmOpen() ? '籽' : '锁') + '</span><span class="mk-lab"><b>种子商店</b><small>' + (farmOpen() ? '药草种子、活力花种子、额外的田' : '读完支线「伟大的种植园」后开放') + '</small></span></button>' : '') +
      (n === '黄冈' ? '<button type="button" class="mk shop' + (medalOpen() ? '' : ' locked') + '"' + (medalOpen() ? ' data-medal="1"' : ' disabled') + ' style="left:50%;top:18%"><span class="mk-dot">' + (medalOpen() ? '勋' : '锁') + '</span><span class="mk-lab"><b>授勋馆</b><small>' + (medalOpen() ? '所有称号和获得方式' : '读完支线「授勋馆」后开放') + '</small></span></button>' : '') +
      (n === '宜昌' ? '<button type="button" class="mk shop' + (coreOpen() ? '' : ' locked') + '"' + (coreOpen() ? ' data-core="1"' : ' disabled') + ' style="left:66%;top:50%"><span class="mk-dot">' + (coreOpen() ? '电' : '锁') + '</span><span class="mk-lab"><b>星球采矿 · 日透骨消</b><small>' + (coreOpen() ? '领钻头、修钻头、换能量' : '读完支线「三峡能源核心」后开放') + '</small></span></button>' : '') +
      (n === '神农架' ? '<button type="button" class="mk shop" data-nursery="1" style="left:50%;top:58%"><span class="mk-dot">育</span><span class="mk-lab"><b>精灵保育仓</b><small>孵化精灵的精元</small></span></button>' : '') +
      (ids.length || n === '黄石' || n === '恩施' || n === '神农架' || n === '咸宁' || n === '宜昌' ? '' : '<p class="area-empty">这里暂时没有剧情。</p>') +
      '<div class="tp-fx" aria-hidden="true"><span>传送至 ' + d[0] + '……</span></div></div>' +
      (ids.length ? '<ul class="area-list">' + rw + '</ul>' : '') + '</div>';
    ex.tp = false;
  }
  // 星图上的一张星球卡（荆楚号、空间站、地球、先驱之塔）
  function planetCard(p) {
    var n = p.sites.length, done = p.sites.filter(function (s) { return prog(s).done; }).length, open = planetOpen(p);
    return '<button type="button" class="planet' + (open ? '' : ' locked') + '" data-planet="' + p.id + '"' + (open ? '' : ' disabled') + '><span class="tape l"></span>' + (p.ship ? '<img class="ship-ic" src="' + CHARS.ship_icon + '" alt="">' : p.tower ? towerSvg() : p.sarena ? sarenaSvg() : p.station ? stationSvg() : planetSvg(p.id)) +
      '<span class="pn">' + p.name + (p.wild ? '<span class="chip ptype">' + p.ptype + '</span>' : '') + '</span><span class="hint">' + p.d + '</span><span class="pc">' + (open ? (p.sarena ? CONTEST.name + ' · ' + ({ signup: contestMe() ? '已报名' : '报名中', swiss: '瑞士轮进行中', final: '决赛进行中', done: '已结束' }[CT.data ? CT.data.status : 'signup'] || '报名中') : p.tower ? '当前第 ' + twRec().f + ' 层 · 存档点第 ' + twRec().cp + ' 层' : p.station ? '先驱之塔 · 当前第 ' + twRec().f + ' 层' : '地点 ' + n + ' 个 · 已完成 ' + done) : '读完「' + SITES[p.after].chapter.split(' · ')[1] + '」后解锁') + '</span></button>';
  }
  function sarenaSvg() {
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="78" rx="48" ry="18" fill="#5b8fd0" stroke="#23222b" stroke-width="3"/><path d="M12 78V58c0-10 22-18 48-18s48 8 48 18v20" fill="#e6eaf0" stroke="#23222b" stroke-width="3"/>' +
      '<ellipse cx="60" cy="58" rx="48" ry="18" fill="#f6e6b4" stroke="#23222b" stroke-width="3"/><ellipse cx="60" cy="58" rx="28" ry="9" fill="#c42f3a" stroke="#23222b" stroke-width="2.5"/>' +
      '<path d="M60 40V14" stroke="#23222b" stroke-width="3"/><path d="M60 14l18 6-18 6z" fill="#f2c46b" stroke="#23222b" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  }
  /* ---------- 太空竞技场 · 做题大王争霸赛（2026-10-19，服务器见 server/contest.js；对战走 social.js 的 rule = 'contest'） ----------
   * 报名 → 满 5 人定抽签时间（全服公告）→ 抽签（全服动画，可回放）→ 瑞士轮（每轮 2~3 天，22:00 截止）→ 前两名决赛 → 发奖
   * 太空竞技场页面：报名名单、抽签时间、我的对局（对手在线时「对战」按钮亮起）、赛程和每局回放、积分榜、直播入口 */
  var CONTEST = { id: 'quiz1', name: '第一届做题大王争霸赛' }, CT = { data: null, busy: false, err: '', at: 0 };
  var CT_RW = [{ exp: 300000, t: 1 }, { exp: 200000, t: 1 }, { exp: 150000, t: 1 }, { exp: 120000, t: 1 }];   // 第 1~4 名；之后都按 CT_RW0（兑换券每人 1 张）
  var CT_RW0 = { exp: 80000, t: 1 };
  MATS.ctShare = { name: 'S1争霸赛精灵分享券', d: '第一届做题大王争霸赛所有参赛选手的纪念。在储存箱里使用，可以送一位好友一只 LV10 的尖盔虫和 200 个花剑圆弧。' };   // 2026-11-02
  // 分享券：选一位好友（好友列表从服务器取）
  function ctShareDlg() {
    if (!window.CLOUD || !CLOUD.user || !CLOUD.user()) { toast('要联网登录后才能分享'); return; }
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'cts-dlg';
    var draw = function (list, err) {
      d.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true" style="max-width:480px"><span class="step">S1争霸赛精灵分享券</span><h2>分享给哪位好友？</h2><p>Ta 会收到一封邮件：LV10 尖盔虫 + 200 个花剑圆弧。</p>' +
        (err ? '<p class="hint red">' + esc(err) + '</p>' : !list ? '<p class="hint">正在读取好友列表……</p>' : !list.length ? '<p class="hint">还没有好友。去「社交 → 玩家」里加好友吧。</p>' :
          '<div class="cts-list">' + list.map(function (p) { return '<button type="button" class="btn ghost cts-f" data-ctsto="' + esc(p.user) + '"><b>' + esc(p.name || p.user) + '</b>' + (p.online ? '<small>在线</small>' : '') + '</button>'; }).join('') + '</div>') +
        '<div class="soc-foot"><button type="button" class="btn ghost" data-ctsx="1">取消</button></div></div>';
    };
    draw(null); document.body.appendChild(d);
    CLOUD.api('GET', '/api/players').then(function (r) { draw(r && r.players ? r.players.filter(function (p) { return p.friend && !p.me; }) : null, r && r.players ? '' : '读取好友失败，请稍后再试'); }, function () { draw(null, '读取好友失败，请稍后再试'); });
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-ctsx]')) { d.remove(); return; }
      var b = e.target.closest('[data-ctsto]'); if (!b) return;
      var to = b.dataset.ctsto, nm0 = b.querySelector('b').textContent;
      d.remove();
      txRun('ctShare', { to: to }, function (r) { ui.itMsg = '已分享给「' + (r && r.name || nm0) + '」！Ta 会收到一封邮件。'; if (!acc.items.ctShare) ui.itSel = null; renderItems(); toast(ui.itMsg); });
    });
  }
  MATS.ctTicket = { name: '神秘精灵兑换券', d: '第一届做题大王争霸赛的参赛奖励。在储存箱里使用，1 张兑换一只 LV10 的尖盔虫（战斗系），外加 200 个花剑圆弧。' };   // 2026-11-02 揭晓：尖盔虫   // 2026-10-24：改回待定（之后补充新精灵），不再兑换雷明灯
  function contestMe() { return !!(acc && acc.contest && acc.contest[CONTEST.id]) || !!(CT.data && CT.data.mine); }
  function ctName(u) { return (CT.data && CT.data.names && CT.data.names[u]) || u; }
  function bjText(t) { var d = new Date(t + 8 * 3600 * 1000); return (d.getUTCMonth() + 1) + ' 月 ' + d.getUTCDate() + ' 日 ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2); }
  function leftText(ms) { if (ms <= 0) return '马上'; var h = Math.floor(ms / 3600000), m = Math.ceil(ms % 3600000 / 60000); return h >= 24 ? Math.floor(h / 24) + ' 天 ' + (h % 24) + ' 小时' : h ? h + ' 小时 ' + m + ' 分' : m + ' 分钟'; }
  function contestLoad(cb) {
    if (cb) (CT.cbs = CT.cbs || []).push(cb);
    if (CT.busy || typeof CLOUD === 'undefined' || !CLOUD.api) return; CT.busy = true;
    var done = function () { var L = CT.cbs || []; CT.cbs = []; L.forEach(function (f) { try { f(); } catch (e) {} }); };
    CLOUD.api('GET', '/api/contest').then(function (r) {
      CT.busy = false; CT.at = Date.now();
      if (r._code === 200) { CT.data = r; CT.err = ''; if (r.mine && acc) { if (!acc.contest) acc.contest = {}; if (!acc.contest[CONTEST.id]) { acc.contest[CONTEST.id] = Date.now(); save(); } } ctReward(); }
      else CT.err = r.error || '暂时连不上服务器';
      ctRedraw(); done();
    }).catch(function () { CT.busy = false; CT.err = '暂时连不上服务器'; ctRedraw(); CT.cbs = []; });
  }
  function ctRedraw() { var el = $('ct-box'); if (el) el.innerHTML = contestInner(); }
  function contestSign() {
    if (contestMe() || CT.busy) return;
    if (typeof CLOUD === 'undefined' || !CLOUD.api) { toast('需要登录账号才能报名。'); return; }
    CT.busy = true;
    CLOUD.api('POST', '/api/contest', {}).then(function (r) {
      CT.busy = false;
      if (r._code === 200) { CT.data = r; if (!acc.contest) acc.contest = {}; acc.contest[CONTEST.id] = Date.now(); save(); toast('报名成功！请等待抽签。'); }
      else toast(r.error || '报名失败，请稍后再试。');
      ctRedraw();
    }).catch(function () { CT.busy = false; toast('暂时连不上服务器，请稍后再试。'); });
  }
  // 冠军打完：按名次发奖（每个账号一次，邮箱里领）
  function ctReward() {   // 争霸赛结束：名次奖励邮件和称号由服务器发
    var D = CT.data; if (!D || D.status !== 'done' || !D.ranks || !acc) return;
    if (D.ranks.indexOf(D.me) < 0 || (acc.mailSeen && acc.mailSeen['contest-' + CONTEST.id + '-rw'])) return;
    deliverMail(true);
  }
  function ctStatusText(D) {
    if (!D) return CT.err ? '（' + CT.err + '）' : '正在读取……';
    if (D.status === 'signup') return D.drawAt ? '报名中 · 抽签 ' + bjText(D.drawAt) + ' 开始（还有 ' + leftText(D.drawAt - Date.now()) + '），开始即截止' : '报名中 · 满 ' + D.min + ' 人后确定抽签时间（现在 ' + D.count + ' 人）';
    if (D.status === 'swiss') { var R = D.rounds[D.rounds.length - 1]; return '瑞士轮第 ' + (R ? R.n : 1) + ' / ' + D.swissN + ' 轮进行中' + (R ? ' · ' + bjText(R.deadline) + ' 截止' : ''); }
    if (D.status === 'final') { var F = D.rounds[D.rounds.length - 1]; return '决赛进行中' + (F ? ' · ' + bjText(F.deadline) + ' 截止' : ''); }
    if (D.status === 'done') return '已结束 · 冠军 ' + ctName(D.ranks[0]);
    return '';
  }
  function ctPairRow(p) {
    var res = !p.w ? '<span class="hint">未完成</span>' : '<b class="blue">' + esc(ctName(p.w)) + ' 胜</b> <small>' + (p.how === 'play' ? (p.score ? p.score[0] + ' : ' + p.score[1] : '') : p.how === 'online' ? '对手未上线' : p.how === 'forfeit' ? '对手离开' : '随机判定') + '</small>';
    var reps = (p.replays || []).map(function (x) { return '<button type="button" class="btn ghost ct-rep" data-ctrep="' + esc(x.id) + '">▶ 第 ' + x.game + ' 局</button>'; }).join('');
    return '<li class="ct-pair' + (p.a === CT.data.me || p.b === CT.data.me ? ' me' : '') + '"><span class="ct-vs"><b' + (p.w === p.a ? ' class="win"' : '') + '>' + esc(ctName(p.a)) + '</b> vs <b' + (p.w === p.b ? ' class="win"' : '') + '>' + esc(ctName(p.b)) + '</b></span><span class="ct-res">' + res + '</span>' + (reps ? '<span class="ct-reps">' + reps + '</span>' : '') + '</li>';
  }
  function contestInner() {
    var D = CT.data, me = contestMe();
    var h = '<p class="ct-st">' + esc(ctStatusText(D)) + '</p>';
    if (!D) return h + '<div class="soc-foot">' + (me ? '<button type="button" class="btn" disabled>已报名</button>' : '<button type="button" class="btn primary" data-ctsign="1">报名参赛</button>') + '</div>';
    if (D.status === 'signup') {
      h += '<p class="hint">做题家们，比一比谁才是真正的做题大王！瑞士轮决出前两名，再打决赛。所有参赛者都能得到神秘精灵兑换券和大量经验，名次越高奖励越丰富。</p>' +
        '<div class="ct-names"><b>已报名 ' + D.count + ' 人</b>' + (D.players.length ? D.players.map(function (p) { return '<span class="chip' + (p.user === D.me ? ' me' : '') + '">' + esc(p.name) + '</span>'; }).join('') : '<span class="hint">还没有人报名</span>') + '</div>' +
        '<div class="soc-foot">' + (me ? '<button type="button" class="btn" disabled>已报名 · 等待抽签</button>' : '<button type="button" class="btn primary" data-ctsign="1">报名参赛</button>') + '</div>';
      return h;
    }
    h += '<div class="soc-foot ct-tools"><button type="button" class="btn ghost" data-ctdraw="1">▶ 回放抽签</button></div>';
    // 我的对局
    var M0 = D.myMatch;
    if (M0 && !M0.done) {
      var wsOk = window.HSSOCIAL && window.HSSOCIAL.wsOk && window.HSSOCIAL.wsOk(), can = M0.oppOnline && wsOk;
      h += '<div class="ct-my"><span class="tape l"></span><b>你的' + (M0.final ? '决赛' : '第 ' + M0.round + ' 轮') + '对手：' + esc(M0.oppName) + '</b> <span class="dot' + (M0.oppOnline ? ' on' : '') + '"></span><small>' + (M0.oppOnline ? '在线' : '不在线') + '</small>' +
        (M0.part ? '<p class="hint"><b>上次打到一半：比分 ' + ((M0.part[D.me] | 0) + ' : ' + (M0.part[M0.opp] | 0)) + '，再约会接着打。</b></p>' : '') +
        '<p class="hint">bo3（先赢 2 局），每局各带 6 只、禁对方 1 只，再调整出场顺序和技能，5v5。请在 ' + bjText(M0.deadline) + ' 之前和对手同时上线完成对战；到时还没打，在线时间更长的一方获胜。</p>' +
        '<div class="soc-foot"><button type="button" class="btn primary" data-ctfight="' + esc(M0.opp) + '"' + (can ? '' : ' disabled') + '>' + (can ? '⚔ 对战' : M0.oppOnline ? '正在连接服务器……' : '对手上线后才能对战') + '</button></div></div>';
    } else if (M0 && M0.done) h += '<p class="ct-my done">你这一轮的对局已经结束（' + (M0.w === D.me ? '胜' : '负') + '），等待其他对局。</p>';
    // 重赛（2026-10-26）：双方都在线、都同意、还在这一轮的期限内，可以把已经打完的结果作废重打
    var RM = D.rematch;
    if (RM) { var wsOk2 = window.HSSOCIAL && window.HSSOCIAL.wsOk && window.HSSOCIAL.wsOk(), can2 = RM.oppOnline && wsOk2;
      h += '<div class="ct-my"><b>' + (RM.final ? '决赛' : '第 ' + RM.round + ' 轮') + ' vs ' + esc(RM.oppName) + '（' + (RM.w === D.me ? '胜' : '负') + '）</b><p class="hint">如果这场打得有问题，双方都同意时可以申请重赛：结果作废，重新打一场 bo3。期限：' + bjText(RM.deadline) + '。</p>' +
        '<div class="soc-foot"><button type="button" class="btn" data-ctrematch="' + esc(RM.opp) + '"' + (can2 ? '' : ' disabled') + '>' + (can2 ? '申请重赛' : '对手在线时才能申请') + '</button></div></div>'; }
    // 直播
    if (D.live && D.live.length) h += '<div class="ct-live"><b>🔴 正在直播</b>' + D.live.map(function (L) { return '<button type="button" class="btn ghost" data-ctwatch="' + esc(L.host) + '">' + esc(ctName(L.a)) + ' vs ' + esc(ctName(L.b)) + ' · 观看</button>'; }).join('') + '</div>';
    // 冠军
    if (D.status === 'done' && D.ranks) h += '<div class="ct-podium">' + D.ranks.slice(0, 3).map(function (u, i) { return '<div class="ct-pl p' + (i + 1) + '"><span>' + ['🏆 冠军', '🥈 亚军', '🥉 第 3 名'][i] + '</span><b>' + esc(ctName(u)) + '</b></div>'; }).join('') + '</div>';
    // 赛程
    h += '<h4 class="ct-h">赛程</h4>' + D.rounds.slice().reverse().map(function (R) {
      return '<div class="ct-round"><p><b>' + (R.final ? '决赛' : '第 ' + R.n + ' 轮') + '</b> <small>' + (R.closed ? '已结束' : '截止 ' + bjText(R.deadline)) + '</small></p><ul>' + R.pairs.map(ctPairRow).join('') + (R.bye ? '<li class="ct-pair"><span class="ct-vs"><b>' + esc(ctName(R.bye)) + '</b> 轮空</span><span class="ct-res"><small>直接算胜</small></span></li>' : '') + '</ul></div>';
    }).join('');
    // 积分榜
    if (D.standings && D.standings.length) h += '<h4 class="ct-h">瑞士轮积分</h4><table class="ct-tb"><thead><tr><th>#</th><th>选手</th><th>胜</th><th>负</th><th>对手分</th><th>小分</th></tr></thead><tbody>' +
      D.standings.map(function (x, i) { return '<tr' + (x.user === D.me ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(ctName(x.user)) + '</td><td>' + x.w + '</td><td>' + x.l + '</td><td>' + x.buch + '</td><td>' + (x.gd > 0 ? '+' : '') + x.gd + '</td></tr>'; }).join('') + '</tbody></table><p class="hint">胜场相同时依次比对手分（遇到过的对手的胜场之和）、小分（赢的局数 − 输的局数）。</p>';
    return h;
  }
  function sarenaPage() {
    if (!CT.busy && (!CT.data || Date.now() - CT.at > 15000)) contestLoad();
    clearInterval(ex.ctTick);
    ex.ctTick = setInterval(function () { if (!document.getElementById('ct-box')) { clearInterval(ex.ctTick); return; } contestLoad(); }, 20000);
    return '' +   // 2026-11-02：竞技对战搬到飞船终端，这里只剩争霸赛
      '<article class="log-card ct-card"><span class="tape l"></span><span class="chip log-tag">精灵王争霸赛</span><h3>' + CONTEST.name + '</h3><div id="ct-box">' + contestInner() + '</div></article>';
  }
  function contestLogHTML() {
    var D = CT.data, ns = D && D.notices ? D.notices.slice(-3).reverse() : [];
    return '<article class="log-card ct-card"><span class="tape l"></span><span class="chip log-tag">精灵王争霸赛</span><h3>' + CONTEST.name + '</h3>' +
      '<p>' + esc(ctStatusText(D)) + '</p>' + (ns.length ? '<ul class="ct-news">' + ns.map(function (n) { return '<li><b>' + esc(n.title.replace(CONTEST.name + ' · ', '')) + '</b><small>' + bjText(n.t) + '</small><span>' + esc(n.text) + '</span></li>'; }).join('') + '</ul>' : '<p class="hint">飞船终端里的「争霸赛」开张了！' + (contestMe() ? '你已经报名了。' : '快去报名吧。') + '</p>') +
      '<div class="soc-foot"><button type="button" class="btn primary" data-gosarena="1">去争霸赛</button></div></article>';
  }
  // 抽签动画：报名的船员先按报名顺序摆开 → 翻面洗牌 → 按抽签结果排好 → 两两亮出第一轮对阵
  function ctDrawShow() {
    var D = CT.data; if (!D || !D.order || !D.order.length) { contestLoad(function () { if (CT.data && CT.data.order && CT.data.order.length) ctDrawShow(); }); return; }
    var old = document.querySelector('.ctd'); if (old) old.remove();
    var names = D.players.map(function (p) { return p.user; }).filter(function (u) { return D.order.indexOf(u) >= 0; }), R1 = D.rounds[0] || { pairs: [] };
    if (names.length !== D.order.length) names = D.order.slice().sort();
    var el = document.createElement('div'); el.className = 'ctd';
    el.innerHTML = '<div class="ctd-box"><h2>' + CONTEST.name + ' · 抽签</h2><p class="ctd-msg" id="ctd-msg">共 ' + names.length + ' 名选手</p><div class="ctd-stage" id="ctd-stage">' +
      names.map(function (u, i) { return '<div class="ctd-card" data-u="' + esc(u) + '"><span class="ctd-f">' + esc(ctName(u)) + '</span><span class="ctd-b">?</span></div>'; }).join('') +
      '</div><ul class="ctd-pairs" id="ctd-pairs"></ul><div class="soc-foot"><button type="button" class="btn primary" id="ctd-x">跳过</button></div></div>';
    document.body.appendChild(el);
    var cards = [].slice.call(el.querySelectorAll('.ctd-card')), N = cards.length, cols = Math.min(4, N), timers = [];
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    var rows = Math.ceil(N / cols); el.querySelector('#ctd-stage').style.height = Math.max(120, rows * 58 + 20) + 'px';
    function place(c, k) { c.style.left = (4 + (k % cols) * (92 / cols)) + '%'; c.style.top = (10 + Math.floor(k / cols) * 58) + 'px'; c.style.transform = 'none'; }
    function close() { timers.forEach(clearTimeout); if (el.parentNode) el.remove(); }
    cards.forEach(function (c, i) { place(c, i); });
    at(1200, function () { el.querySelector('#ctd-msg').textContent = '翻面、洗牌……'; cards.forEach(function (c, i) { c.classList.add('flip'); c.style.left = (40 + (i % 3) * 2) + '%'; c.style.top = (10 + (i % 2) * 6) + 'px'; c.style.transform = 'rotate(' + (i * 9 - 20) + 'deg)'; }); });
    for (var r = 0; r < 7; r++) at(1900 + r * 230, function () { cards.forEach(function (c) { c.style.left = (40 + (Math.random() - 0.5) * 50) + '%'; c.style.top = Math.round(10 + Math.random() * Math.max(0, rows * 58 - 50)) + 'px'; c.style.transform = 'rotate(' + Math.round((Math.random() - 0.5) * 50) + 'deg)'; c.style.zIndex = Math.floor(Math.random() * 20); }); });
    at(3700, function () { el.querySelector('#ctd-msg').textContent = '抽签结果！'; });
    D.order.forEach(function (u, k) { at(3800 + k * 180, function () { var c = cards.filter(function (x) { return x.dataset.u === u; })[0]; if (c) { place(c, k); c.style.zIndex = 30 + k; c.classList.remove('flip'); } }); });
    var t1 = 3900 + N * 180;
    R1.pairs.forEach(function (p, k) { at(t1 + 400 + k * 700, function () { var li = document.createElement('li'); li.innerHTML = '<b>' + esc(ctName(p.a)) + '</b> vs <b>' + esc(ctName(p.b)) + '</b>'; el.querySelector('#ctd-pairs').appendChild(li); }); });
    at(t1 + 400 + R1.pairs.length * 700, function () {
      if (R1.bye) { var li = document.createElement('li'); li.innerHTML = '<b>' + esc(ctName(R1.bye)) + '</b> 第一轮轮空'; el.querySelector('#ctd-pairs').appendChild(li); }
      el.querySelector('#ctd-msg').textContent = '第一轮对阵已经确定，去飞船终端的「争霸赛」看看吧！'; el.querySelector('#ctd-x').textContent = '关闭';
    });
    el.addEventListener('click', function (e) { if (e.target.id === 'ctd-x') close(); });
  }
  // 全服公告弹窗（争霸赛的满员、抽签、每轮结果、冠军）
  var ctNoticeQ = [];
  function ctNoticePop(n) {
    if (!n || !acc) return;
    if (!acc.ctSeen) acc.ctSeen = {};
    if (acc.ctSeen[n.id]) return;
    if (!ready() || ex.fighting || ex.view === 'vn' || document.querySelector('.soc-dlg') || document.querySelector('.ctd') || ($('battle') && !$('battle').hidden)) { if (ctNoticeQ.indexOf(n) < 0) ctNoticeQ.push(n); return; }
    acc.ctSeen[n.id] = 1; save();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'ct-dlg';
    d.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span><span class="step">全服公告 · 精灵王争霸赛</span><h2>' + esc(n.title) + '</h2><p>' + esc(n.text) + '</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-ctx="1">知道了</button><button type="button" class="btn primary" data-ctgo2="1">去争霸赛</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-ctx]')) { d.remove(); return; }
      if (e.target.closest('[data-ctgo2]')) { d.remove(); ex.planet = 'sarena'; ex.view = 'sites'; go('explore'); }
    });
  }
  window.HSCT = {
    reload: function () { contestLoad(); },
    notice: function (n) { if (CT.data) { CT.data.notices = (CT.data.notices || []).concat([n]); } contestLoad(); ctNoticePop(n); },
    draw: function () { contestLoad(function () { if (!ex.fighting && !($('battle') && !$('battle').hidden)) ctDrawShow(); }); },
    ready: function (m) {
      if (ex.fighting || ($('battle') && !$('battle').hidden) || document.querySelector('.soc-dlg')) return;
      var d = document.createElement('div'); d.className = 'soc-dlg';
      d.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span><span class="step">' + CONTEST.name + ' · ' + (m.final ? '决赛' : '第 ' + m.round + ' 轮') + '</span><h2>你的对手 ' + esc(m.oppName) + ' 在线！</h2><p class="hint">现在就可以开打：bo3，各带 6 只、禁对方 1 只。</p>' +
        '<div class="soc-foot"><button type="button" class="btn ghost" data-ctx="1">稍后</button><button type="button" class="btn primary" data-ctfight2="1">⚔ 发起对战</button></div></div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) {
        if (e.target === d || e.target.closest('[data-ctx]')) { d.remove(); return; }
        if (e.target.closest('[data-ctfight2]')) { d.remove(); if (window.HSSOCIAL && window.HSSOCIAL.ctAsk) window.HSSOCIAL.ctAsk(m.opp, m.oppName, CONTEST.name + ' · ' + (m.final ? '决赛' : '第 ' + m.round + ' 轮')); }
      });
    },
    refresh: function () { contestLoad(); }
  };
  function stationSvg() { return '<img class="station-ic" src="images/planets/station.webp" alt="">'; }   // 2026-10-27：空间站立绘（照片抠图 + 手绘风格）

  // 马亚尔星系：星系图，点星球进入
  function mayarMap() {
    var pts = Object.keys(MAYAR).map(function (id) {
      var p = planetOf(id), m = MAYAR[id], open = planetOpen(p), lock = open ? '' : p.soon ? '敬请期待' : '读完「' + SITES[p.after].chapter.split(' · ')[1] + '」后解锁';
      return '<button type="button" class="mp' + (open ? '' : ' locked') + '" data-planet="' + id + '"' + (open ? '' : ' disabled') + ' style="left:' + m[0] + '%;top:' + m[1] + '%;width:' + m[2] + '%" title="' + esc(p.name + '：' + (open ? p.d : lock)) + '">' +
        '<span class="mp-ic">' + planetSvg(id) + '</span><span class="mp-lb"><b>' + p.name + '</b><small>' + (open ? p.ptype : p.soon ? p.ptype + ' · 敬请期待' : '未解锁') + '</small></span></button>';
    }).join('') + MAYAR_UNK.map(function (m) { return '<span class="mp unk" style="left:' + m[0] + '%;top:' + m[1] + '%" title="未知星球：更多星球敬请期待">?</span>'; }).join('');
    return '<section class="mayar"><h3>马亚尔星系 <small>点击星球前往</small></h3><div class="mayar-map"><img class="mayar-bg" src="' + BG.mayar + '" alt="马亚尔星系">' + pts + '</div></section>';
  }
  // 进入星球 / 场景时：这一页的图片还没下载完，就先盖上加载面板，全部到了再显示（2026-10-27）
  function loadGate(el, msg) {
    if (!el || typeof LOADER === 'undefined') return;
    var imgs = Array.prototype.filter.call(el.querySelectorAll('img'), function (im) { return im.getAttribute('src') && !im.complete && im.loading !== 'lazy'; });
    if (!imgs.length) return;
    var L = LOADER.show(msg || '加载中～', { delay: 120 }), n = 0, fin = false, tot = imgs.length;
    el.classList.add('gating');
    var end = function () { if (fin) return; fin = true; clearTimeout(g); L.done(function () { el.classList.remove('gating'); }); };
    var g = setTimeout(end, 12000);   // 最多等 12 秒：网络很慢时不卡住
    imgs.forEach(function (im) { var one = function () { n++; L.set(n / tot); if (n >= tot) end(); }; im.addEventListener('load', one, { once: true }); im.addEventListener('error', one, { once: true }); });
  }
  function teleport(n) { ex.view = 'area'; ex.area = n; ex.tp = true; renderExplore(); loadGate($('pg-explore'), '正在传送到' + DEPTS[n][0] + '～'); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); mysteryRoll('荆楚号 · ' + DEPTS[n][0]); }
  function planetSvg(id) {
    var P = planetOf(id); if (P && P.ivy) return ivySvg(); if (P && P.img) return planetImg(P, 120); if (P && P.color) return planetSvgC(P, 120);
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="36" fill="#cfe0f2" stroke="#23222b" stroke-width="3"/>' +
      '<path d="M36 44c8-6 16-4 20 2s12 4 14 10-6 12-14 12-6 10-14 10-14-8-12-16 0-14 6-18z M74 30c6 2 10 8 8 12s-8 2-10-2 0-10 2-10z M78 66c8-2 14 4 12 10s-10 8-14 4-4-12 2-14z" fill="#9cc79a" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="60" cy="60" rx="54" ry="14" fill="none" stroke="#c42f3a" stroke-width="2.5" stroke-dasharray="6 5" transform="rotate(-16 60 60)"/></svg>';
  }
  /* ---------- 芙罗拉星：挑战（关卡副本，未开放）+ 捕捉（随机野生精灵） ---------- */
  var WILD = WILD_POOLS, REGIONS = regionsOf('flora');   // 野外精灵表见 js/data/wild.js
  // 其他星球的示意图（立绘待补）：按星球主色画一个带纹路的圆
  function planetImg(P, w) { return '<img class="planet-img" src="' + P.img + '" alt="' + esc(P.name) + '" width="' + w + '" height="' + w + '">'; }   // 有星球立绘（P.img）的用图，没有的画示意图
  function planetSvgC(P, w) {
    var c = P.color, id = 'pc-' + P.id + w;
    var deco = { kamble: '<path d="M20 52c10-6 20 6 30 0s20-6 30 0 20 6 30 0M20 70c10-6 20 6 30 0s20-6 30 0 20 6 30 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>',
      pompeii: '<path d="M30 80l14-26 10 14 12-30 14 30 10-12 10 24z" fill="' + c[1] + '"/><path d="M58 40l4-14 4 14" stroke="#ffd36b" stroke-width="3" fill="none"/>',
      laiting: '<path d="M58 46l-8 18h11l-6 22 18-26H62l6-14z" fill="#fff6b0" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>',
      white: '<path d="M60 30v60M34 45l52 30M34 75l52-30" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="60" r="6" fill="#fff"/>',
      kongyan: '<path d="M18 96V74h14v-8h16v12h12V62h18v14h12v-6h16v26z" fill="' + c[1] + '" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/><path d="M34 44c4-6 12-6 16 0 4-4 12-2 12 4H30c0-2 2-4 4-4zM70 34c3-4 9-4 12 0 3-3 9-1 9 3H67c0-2 1-3 3-3z" fill="#fff" opacity=".9"/><path d="M56 56l8-4 8 4M62 52l2 6" stroke="#23222b" stroke-width="2" fill="none" stroke-linecap="round"/>' }[P.id] || '';
    if (P.belt) return '<svg viewBox="0 0 120 120" width="' + w + '" aria-hidden="true">' + [[30, 46, 13], [66, 36, 9], [86, 62, 15], [48, 80, 11], [20, 74, 7], [96, 30, 6]].map(function (r) { return '<ellipse cx="' + r[0] + '" cy="' + r[1] + '" rx="' + r[2] + '" ry="' + (r[2] * 0.8) + '" fill="#8b8576" stroke="#23222b" stroke-width="2.5"/>'; }).join('') +
      '<path d="M30 46L48 80M66 36L86 62M48 80L86 62" stroke="#d9b92a" stroke-width="2.5" stroke-dasharray="4 3"/>' + deco + '</svg>';
    return '<svg viewBox="0 0 120 120" width="' + w + '" aria-hidden="true"><defs><clipPath id="' + id + '"><circle cx="60" cy="60" r="36"/></clipPath></defs><g clip-path="url(#' + id + ')"><rect width="120" height="120" fill="' + c[0] + '"/>' + deco + '</g>' +
      '<circle cx="60" cy="60" r="36" fill="none" stroke="#23222b" stroke-width="3"/><ellipse cx="60" cy="60" rx="54" ry="13" fill="none" stroke="' + c[1] + '" stroke-width="2.5" stroke-dasharray="6 5" transform="rotate(-12 60 60)"/></svg>';
  }
  // 常春藤前哨站：缠着常春藤的六边形据点
  function ivySvg() {
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 22l33 19v38l-33 19-33-19V41z" fill="#3a4a3e" stroke="#23222b" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M60 36l21 12v24l-21 12-21-12V48z" fill="#26302a" stroke="#7fb27a" stroke-width="2"/><circle cx="60" cy="60" r="7" fill="#b98cff" stroke="#23222b" stroke-width="2"/>' +
      '<path d="M27 50c10 2 14 10 22 10s10-10 18-8 12 12 26 10" stroke="#5d9a55" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      [[34, 52], [50, 60], [66, 52], [84, 60]].map(function (q) { return '<path d="M' + q[0] + ' ' + q[1] + 'c-6-6-2-12 4-10 6-2 8 6 2 10z" fill="#7fb27a" stroke="#23222b" stroke-width="1.5"/>'; }).join('') +
      '<path d="M60 22v-10M56 12h8" stroke="#23222b" stroke-width="3" stroke-linecap="round"/><path d="M93 41l12-6M27 41l-12-6" stroke="#7d8a80" stroke-width="3"/></svg>';
  }
  function floraSvg(w) {
    return '<svg viewBox="0 0 120 120" width="' + w + '" aria-hidden="true"><defs><clipPath id="fl-c' + w + '"><circle cx="60" cy="60" r="36"/></clipPath></defs>' +
      '<g clip-path="url(#fl-c' + w + ')"><rect width="120" height="120" fill="#9fd08a"/>' +
      '<path d="M20 20h60c-6 10-2 18 6 22-14 4-22 12-24 22-12-6-26-4-42 2z" fill="#3f7d4a"/>' +
      '<path d="M66 70c10-6 22-6 36 0v40H58c4-12 4-28 8-40z" fill="#ece8dc"/><path d="M72 84l8 4 6-6M84 98l10-4" stroke="#bdb7a6" stroke-width="2" fill="none"/>' +
      '<circle cx="36" cy="38" r="3" fill="#2c5e36"/><circle cx="46" cy="30" r="3.5" fill="#2c5e36"/><circle cx="30" cy="50" r="2.5" fill="#2c5e36"/>' +
      '<path d="M40 80c4-2 6 0 8 2M50 88c3-2 5-1 7 1M34 92c3-2 5-1 7 1" stroke="#5c9a4e" stroke-width="2" fill="none" stroke-linecap="round"/></g>' +
      '<circle cx="60" cy="60" r="36" fill="none" stroke="#23222b" stroke-width="3"/>' +
      '<ellipse cx="60" cy="60" rx="54" ry="13" fill="none" stroke="#3f7d4a" stroke-width="2.5" stroke-dasharray="6 5" transform="rotate(14 60 60)"/></svg>';
  }
  function regionArt(id) {
    var bgc = { forest: '#cfe5c4', grass: '#e4f1cf', salt: '#efece4', kb_sea: '#cfe8f6', pp_lava: '#f4d1b8', pp_city: '#f2c2a8', lt_belt: '#2e3142', wh_snow: '#eef6fb' }[id], g = '';
    if (id === 'kb_sea') g = '<path d="M0 60h160v40H0z" fill="#6fb3dd"/>' + [64, 74, 84, 94].map(function (y, k) { return '<path d="M0 ' + y + 'c20-6 20 6 40 0s20-6 40 0 20 6 40 0 20-6 40 0" stroke="#fff" stroke-width="2" fill="none" opacity="' + (0.9 - k * 0.15) + '"/>'; }).join('') + '<ellipse cx="112" cy="58" rx="26" ry="5" fill="#f4e3b2" stroke="#23222b" stroke-width="2"/><path d="M108 56c0-12 4-18 4-22M108 40c-6-4-12-2-14 2M110 38c4-6 12-6 14-2" stroke="#4f9159" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    else if (id === 'pp_lava') g = '<path d="M0 70h160v30H0z" fill="#3a2f2b"/><path d="M40 70l30-44 12 12 10-8 28 40z" fill="#5a4038" stroke="#23222b" stroke-width="2"/><path d="M76 30c-4-8 0-14 6-18" stroke="#9a9a9a" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/><path d="M10 84c20-4 30 6 50 2s30-8 50 0 30 4 40 0" stroke="#f26b2a" stroke-width="4" fill="none"/>';
    else if (id === 'lt_belt') g = [[24, 40, 12], [60, 66, 18], [104, 34, 10], [132, 70, 14], [86, 86, 8]].map(function (r) { return '<ellipse cx="' + r[0] + '" cy="' + r[1] + '" rx="' + r[2] + '" ry="' + (r[2] * 0.75) + '" fill="#8b8576" stroke="#111" stroke-width="2"/>'; }).join('') + '<path d="M36 40l14 10-6 4 12 10M114 36l8 14-6 2 8 14" stroke="#f1dd73" stroke-width="2.5" fill="none" stroke-linejoin="round"/>' + [[12, 14], [148, 20], [80, 12], [140, 92]].map(function (s) { return '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="1.5" fill="#fff"/>'; }).join('');
    else if (id === 'wh_snow') g = '<path d="M0 66c30-6 60-4 90 0s50 2 70-2v36H0z" fill="#fff" stroke="#23222b" stroke-width="2"/><path d="M20 66l18-30 14 18 10-10 20 22" fill="#d7e9f4" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>' + [[110, 20], [130, 40], [60, 18], [146, 14]].map(function (s) { return '<path d="M' + s[0] + ' ' + (s[1] - 5) + 'v10M' + (s[0] - 5) + ' ' + s[1] + 'h10" stroke="#7fb3d1" stroke-width="2" stroke-linecap="round"/>'; }).join('');
    if (id === 'forest') g = [[18, 70, 1], [42, 62, 1.3], [70, 68, 1.1], [96, 60, 1.4], [120, 70, 1], [146, 64, 1.2]].map(function (t) { var x = t[0], y = t[1], k = t[2]; return '<path d="M' + x + ' ' + (y + 30) + 'v' + (-12 * k) + '" stroke="#5b4636" stroke-width="' + (3 * k) + '"/><path d="M' + x + ' ' + (y - 26 * k) + 'l' + (14 * k) + ' ' + (26 * k) + 'h' + (-28 * k) + 'z" fill="#3f7d4a" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/><path d="M' + x + ' ' + (y - 14 * k) + 'l' + (17 * k) + ' ' + (24 * k) + 'h' + (-34 * k) + 'z" fill="#4f9159" stroke="#23222b" stroke-width="2" stroke-linejoin="round"/>'; }).join('');
    else if (id === 'grass') g = '<path d="M0 72c40-10 80-10 160 0v28H0z" fill="#a9d38b" stroke="#23222b" stroke-width="2"/>' + [12, 30, 52, 74, 96, 118, 140].map(function (x, i) { return '<path d="M' + x + ' 92c2-10 4-16 8-22M' + (x + 6) + ' 92c0-8-2-14-6-20M' + (x + 10) + ' 92c3-6 6-9 10-12" stroke="#4f9159" stroke-width="2.2" fill="none" stroke-linecap="round"/>' + (i % 2 ? '<circle cx="' + (x + 4) + '" cy="' + (66 + i) + '" r="2.6" fill="#f2c94c" stroke="#23222b" stroke-width="1"/>' : ''); }).join('') + '<path d="M18 30c10-4 18-4 26 0M100 22c12-4 22-4 30 2" stroke="#9aa5b8" stroke-width="2" fill="none" stroke-linecap="round"/>';
    else if (id === 'salt') g = '<path d="M0 66h160v34H0z" fill="#e3ded0" stroke="#23222b" stroke-width="2"/><path d="M14 80l14 4 10-6 16 8M70 74l12 8 18-4 10 8M118 82l14-6 16 6M30 92l20-2M92 92l24 2" stroke="#b5ad98" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M98 66c0-18 8-30 14-34 2 10 8 14 12 10 2 8 0 18-4 24z" fill="#6d6a75" stroke="#23222b" stroke-width="2" stroke-linejoin="round" opacity=".55"/><text x="110" y="52" text-anchor="middle" font-size="16" fill="#fff" font-family="Long Cang, KaiTi, cursive">?</text>';
    return '<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="100" fill="' + bgc + '"/>' + g + '</svg>';
  }
  function wildKnown(sid) { return owned(sid) ? 'own' : acc.seen && acc.seen[sid] !== undefined ? 'seen' : ''; }
  function invLine() {
    var cap = ['cap1', 'cap2', 'cap3'].map(function (k) { return ITEMS[k].name.replace('精灵捕捉装置', '') + ' ×' + (acc.items[k] || 0); }).join('　');
    var pot = ['pot100', 'pot200'].map(function (k) { return ITEMS[k].name + ' ×' + (acc.items[k] || 0); }).join('　');
    return '<div class="inv"><span><b>捕捉装置</b>　' + cap + '</span><span><b>补药</b>　' + pot + '</span>' +
      (shopOpen() ? '<button type="button" class="btn" data-goshop="1">去物资仓储兑换</button>' : '<span class="hint">在荆楚号 · 荆门 · 物资仓储读完支线后开放商城</span>') + '</div>';
  }
  // 星球的「剧情」页：主线 / 支线 / 画廊三栏，从上往下是 新 → 旧（lockBtn：有任务没完成时卡片上的按钮）
  function storyTabs(sites, lockBtn) {
    var stab = ex.flSt === 'side' ? 'side' : ex.flSt === 'cg' ? 'cg' : 'main';
    var stCard = function (id) {
      var S = SITES[id], pr = prog(id), started = pr.at > 0 && !pr.done, lock = !unlocked(id);
      if (lock && !prog(S.after).done) return '';   // 前一段还没读完的不显示
      if (lock) return '<article class="site fl-story locked"><span class="tape r"></span><div class="site-img"><img src="' + BG[S.bg] + '" alt=""></div><div class="site-txt"><span class="sc-tag">' + S.chapter + '</span><h3>' + S.name + '</h3><p class="hint">' + S.d + '</p>' +
        '<p class="site-st red">任务：' + esc(S.needText || '') + (id === 'flora3' ? '（' + spareN() + ' / ' + SPARE_N + '）' : '') + '</p><div class="site-act">' + (lockBtn || '') + '</div></div></article>';
      return '<article class="site fl-story"><span class="tape r"></span><div class="site-img"><img src="' + BG[S.bg] + '" alt=""></div><div class="site-txt"><span class="sc-tag">' + S.chapter + '</span><h3>' + S.name + '</h3><p class="hint">' + S.d + '</p>' +
        (S.reward ? '<p class="hint">首次读完奖励：' + rwList(S.reward).filter(Boolean).join('、') + (pr.rewarded ? '（已领取）' : '') + '</p>' : '') +
        '<p class="site-st ' + (pr.done ? 'blue' : started ? 'red' : '') + '">' + (pr.done ? '已读完' : started ? '读到一半' : '未读') + '</p><div class="site-act">' +
        (started ? '<button type="button" class="btn primary" data-go="' + id + '" data-from="cont">继续剧情</button><button type="button" class="btn" data-go="' + id + '" data-from="0">从头开始</button>' : '<button type="button" class="btn primary" data-go="' + id + '" data-from="0">' + (pr.done ? '重温剧情' : '进入') + '</button>') + '</div></div></article>';
    };
    var isNew = function (id) { return unlocked(id) && !prog(id).done; };
    var mainIds = sites.filter(function (id) { return !SITES[id].side; }), sideIds = sites.filter(function (id) { return SITES[id].side; });
    var listOf = function (ids, empty) { var h = ids.slice().reverse().map(stCard).join(''); return h || '<p class="hint fl-none">' + (empty || '暂时还没有可以阅读的剧情。') + '</p>'; };
    var nM = mainIds.some(isNew), nS = sideIds.some(isNew);
    return { isNew: isNew, mainIds: mainIds, listOf: listOf, any: sites.some(isNew), html: function (empty) {
      return '<div class="fparts st-tabs" role="tablist"><button type="button" role="tab" class="tab' + (stab === 'main' ? ' on' : '') + '" data-flst="main" aria-selected="' + (stab === 'main') + '">主线' + (nM ? '<i class="q-badge">!</i>' : '') + '</button>' +
        '<button type="button" role="tab" class="tab' + (stab === 'side' ? ' on' : '') + '" data-flst="side" aria-selected="' + (stab === 'side') + '">支线' + (nS ? '<i class="q-badge">!</i>' : '') + '</button>' +
        '<button type="button" role="tab" class="tab' + (stab === 'cg' ? ' on' : '') + '" data-flst="cg" aria-selected="' + (stab === 'cg') + '">画廊</button></div>' +
        (stab === 'cg' ? cgGallery(sites) : listOf(stab === 'side' ? sideIds : mainIds, stab === 'main' ? empty : null));
    } };
  }
  function floraPage() {
    var part = ex.fpart || 'catch';
    var head = '<div class="flora-hero"><span class="tape l"></span>' + planetImg(planetOf('flora'), 150) + '<div><h3>芙罗拉星 <span class="chip ptype">草系星球</span></h3><p class="hint">地表分为丛林、草甸、盐碱地三片区域。</p>' +
      '<div class="fparts" role="tablist"><button type="button" role="tab" class="tab' + (part === 'challenge' ? ' on' : '') + '" data-fpart="challenge" aria-selected="' + (part === 'challenge') + '">挑战</button><button type="button" role="tab" class="tab' + (part === 'catch' ? ' on' : '') + '" data-fpart="catch" aria-selected="' + (part === 'catch') + '">探索</button>' + taskTab('flora', part) + '</div></div></div>';
    // 剧情页（2026-10-17）：分「主线」「支线」两栏，从上往下是 新 → 旧（2026-10-31 抽成 storyTabs，坎伯兰星也用）
    var flSites = PLANETS.filter(function (p) { return p.id === 'flora'; })[0].sites, ST = storyTabs(flSites, '<button type="button" class="btn primary" data-fpart="catch">去丛林 / 草甸</button>'), sp = ST.html;
    var isNew = ST.isNew, mainIds = ST.mainIds, listOf = ST.listOf;
    head = head + (prog('flora1').done ? '' : listOf(mainIds));
    // 有新的主线可以读时，「剧情」页签上显示红点
    var newMain = flSites.some(isNew);
    if (prog('flora1').done) head = head.replace('<div class="fparts" role="tablist">', '<div class="fparts" role="tablist"><button type="button" class="tab' + (part === 'story' ? ' on' : '') + '" data-fpart="story">剧情' + (newMain ? '<i class="q-badge">!</i>' : '') + '</button>');
    if (part === 'story') return head + sp();
    if (part === 'task') return head + planetTasks('flora');
    if (part === 'challenge') return head + chalPage('flora');
    var regs = REGIONS.filter(function (R) { return !R.record || regionOpen(R); }).map(function (R) {
      var BK = Object.keys(BOSSES).filter(function (k) { return BOSSES[k].region === R.id; })[0], locked = !prog('flora1').done;
      return '<article class="region' + (locked ? ' locked' : '') + '"><div class="rg-art">' + (R.bgs && BG[R.bgs[0]] ? '<img src="' + BG[R.bgs[0]] + '" alt="' + R.name + '">' + (R.bgs.length > 1 ? '<span class="rg-more">' + R.bgs.slice(1).map(function (k) { return '<img src="' + BG[k] + '" alt="">'; }).join('') + '</span>' : '') : regionArt(R.id)) + '</div><div class="rg-txt"><h4>' + R.name + ' <small>' + R.en + '</small></h4><p class="hint">' + R.d + '</p>' +
        (BK ? '<p class="rg-boss">BOSS · ' + BOSSES[BK].name + '　<span>' + (bossOpen(BK) ? BOSSES[BK].lv.filter(function (L, i) { return levelOpen(BK, i); }).map(function (L) { return L.diff; }).join(' / ') + ' 难度可挑战' : '暂未开放') + '</span></p>' +
          (prog('flora1').done ? '<button type="button" class="btn primary" data-field="' + R.id + '">进入' + R.name + '</button>' + (bossOpen(BK) ? '' : '<p class="hint">BOSS「' + BOSSES[BK].name + '」：' + BOSSES[BK].lv[0].lockText + '</p>') : '<button type="button" class="btn" disabled>读完主线「降临芙罗拉」后开放</button>') :
          locked ? '<p class="rg-boss">BOSS · ' + R.boss + '　<span>暂未开放</span></p>' : prog('flora1').done ? '<button type="button" class="btn primary" data-field="' + R.id + '">进入' + R.name + '</button>' : '<button type="button" class="btn" disabled>读完主线「降临芙罗拉」后开放</button>') + '</div></article>';
    }).join('');
    var sids = [];
    REGIONS.forEach(function (R) { if (R.record) return; (WILD[R.pool] || []).forEach(function (w) { if (sids.indexOf(w.sid) < 0) sids.push(w.sid); }); });
    var list = sids.map(function (sid) {
      var w, where = [];
      REGIONS.forEach(function (R) { if (R.record) return; (WILD[R.pool] || []).forEach(function (x) { if (x.sid === sid) { w = x; where.push(R.name + ' ' + x.w + '%'); } }); });
      var k = wildKnown(sid), f = form({ sid: sid, lv: w.lv[0] }), sid_ = sid;
      return '<li class="wl ' + (k || 'unk') + '">' + (k ? '<img src="' + f.img + '" alt="">' : silTag(sid_, f.stage)) + '<span><b>' + (k ? esc(f.name) : '？？？') + '</b>' + (w.rare ? '<span class="chip rare">稀有</span>' : '') +
        '<small>LV' + (w.lv[0] === w.lv[1] ? w.lv[0] + '（固定）' : w.lv[0] + '–' + w.lv[1]) + ' · 捕捉率' + w.tag + '</small><small>出现：' + where.join('，') + '</small>' +
        '<small class="wk">' + (k === 'own' ? '已捕捉' : k === 'seen' ? '见过 · 未捕捉' : '未遇见') + '</small></span></li>';
    }).join('');
    var spareTip = spareActive() ? '<div class="spare-note"><span class="tape l"></span><b>主线任务 · 引出猎杀者</b>　手下留情：现在丛林和草甸里的野生精灵不会倒下，体力剩 1 点时就会逃走，算作「假装击败」。已完成 <b>' + spareN() + ' / ' + SPARE_N + '</b>。</div>' : '';
    return head + spareTip + invLine() + '<div class="regions">' + regs + '</div>' +
      '<div class="wild-list"><h4>芙罗拉星的野生精灵</h4><ul>' + list + '</ul><p class="hint">进入丛林或草甸后，精灵会在场景里走动，点中哪只就和哪只对战。对战中可以在「道具」页使用捕捉装置和补药，使用道具会占用一回合；把它打虚弱、或让它陷入异常状态，更容易捕捉成功。打倒野生精灵会获得经验（对方等级越高越多），分给出战过的精灵，也有一部分放进经验背包；同时出战过的精灵获得学习力（对方 LV1–25 得 1 点，LV26–50 得 2 点，LV51–100 得 3 点）。捕捉不算击败，没有经验和学习力。</p></div>';
  }
  function invCopy() { var o = {}; ITEM_ORDER.forEach(function (k) { o[k] = acc.items[k] || 0; }); return o; }
  function useInv(k) { if (ITEMS[k] && ITEMS[k].en) return; acc.items[k] = Math.max(0, (acc.items[k] || 0) - 1); save(); }
  // 每天通过 PVE 战斗直接获得的经验上限（击败精灵的经验，含进经验背包的那部分；BOSS首通、任务等奖励不算）
  var PVE_XP_CAP = 1000000;   // 2026-10-17：120000 → 200000；2026-10-18：→ 400000（静默调整）；2026-10-24：→ 1000000
  function pveLeft() { var d = dayStr(); if (!acc.pveXp || acc.pveXp.d !== d) acc.pveXp = { d: d, n: 0 }; return Math.max(0, PVE_XP_CAP - acc.pveXp.n); }
  // 击败一只精灵：经验 = 等级² × 2 + 20；学习力按对方等级 1 / 2 / 3 点
  function foeExp(lv) { return ACC.foeExp(lv); }   // 2026-10-24：减半（不公开）
  function foeEv(lv) { return ACC.foeEv(lv); }
  function battleRewards(team, seen, downs) {
    downs = downs || []; if (!downs.length) return [];
    var parts = team.filter(function (x, i) { return seen && seen[i]; }); if (!parts.length) parts = team.slice(0, 1);
    var xp = 0, ev = 0; downs.forEach(function (d) { xp += foeExp(d.lv); ev += foeEv(d.lv); });
    var raw = xp, left = pveLeft(); xp = Math.min(xp, left); acc.pveXp.n += xp;
    var share = Math.floor(xp * 0.7 / parts.length), pool = xp - share * parts.length, out = [];
    if (xp > 0) {
      earn('battle', '', { exp: pool });
      out.push('击败了 ' + downs.length + ' 只精灵，共获得 ' + fmt(xp) + ' 点经验' + (xp < raw ? '（今天的战斗经验已达上限 ' + fmt(PVE_XP_CAP) + '）' : '') + '：');
      var lines = parts.map(function (m) { return gainExp(m, share); }).filter(Boolean);
      out.push(lines.join(''));
      out.push('经验背包 +' + fmt(pool) + '。');
    } else out.push('击败了 ' + downs.length + ' 只精灵。今天通过战斗获得的经验已达上限（' + fmt(PVE_XP_CAP) + '），明天再来吧。');
    var got = giveEv(parts.map(function (x) { return x.u; }), ev);
    if (got.length) out.push(got.join('、') + (got.length > 1 ? ' 各' : ' ') + '获得 ' + ev + ' 点学习力。');
    save(); return out;
  }
  /* ---------- 野外场景：精灵在各自的范围内走动，点中才开战 ----------
   * 种类、等级、捕捉率、异色在出现时就用 rollWild 抽好，点到的就是打到的。
   * 芙罗拉的瘴气仍在点击进入战斗时判定。回到场景时，这只离开，再抽一只补上同一片范围。 */
  var FIELD_SLOTS = [
    { hx: 22, hy: 72, r: 10 },
    { hx: 42, hy: 56, r: 9 },
    { hx: 64, hy: 74, r: 10 },
    { hx: 82, hy: 58, r: 8 }
  ];
  var fields = {}, fieldTick = null, fieldRefresh = null;
  // 采集点的位置写死，不放进 fields：换一批精灵、重新进入区域都不会挪走或再抽一次
  var GATHER_SPOTS = [
    { x: 18, y: 86 },
    { x: 78, y: 46 }
  ];
  var GATHER = RW.GATHER;
  function gatherRec() {
    var day = dayNum(Date.now());
    if (!acc.gather || acc.gather.day !== day || !acc.gather.got) acc.gather = { day: day, got: {} };
    return acc.gather;
  }
  function gatherKey(rid, i) { return rid + ':' + i; }
  function gatherNodesHTML(rid, scene, n) {
    var g = GATHER[rid]; if (!g || !GATHER_ITEMS[g.item]) return '';
    var got = gatherRec().got, name = GATHER_ITEMS[g.item].name;
    return GATHER_SPOTS.map(function (s, i) {
      if (n && i % n !== scene) return '';   // 采集点分散在不同场景里
      var done = !!got[gatherKey(rid, i)];
      return '<button type="button" class="wf-node' + (done ? ' done' : '') + '" data-gather="' + i + '" style="left:' + s.x + '%;top:' + s.y + '%" title="' + (done ? '今天已采集' : '采集' + name + ' ×' + g.n) + '" aria-label="' + (done ? name + '，今天已经采集过' : '采集' + name + ' ×' + g.n) + '"><i class="wf-gem" aria-hidden="true"></i><span>' + (done ? '已采集' : name) + '</span></button>';
    }).join('');
  }
  function gatherAt(i) {
    if (ex.fighting) return;
    var R = regionById(ex.region), g = R && GATHER[R.id];
    if (!g || i < 0 || i >= GATHER_SPOTS.length) return;
    var key = gatherKey(R.id, i), name = GATHER_ITEMS[g.item].name;
    if (gatherRec().got[key]) { toast('这个采集点今天已经采过了，明天再来。'); return; }
    txRun('gather', { rid: R.id, i: i }, function (r) {   // 规则在 js/engine/world.js（服务器结算）
      toast('采集到了「' + name + '」×' + r.n + (r.herb ? '，另外找到了药草种子 ×4' : '') + '，已放入储存箱。');
      var el = document.querySelector('#wf-scene [data-gather="' + i + '"]');
      if (!el) return;
      el.classList.add('done');
      el.title = '今天已采集';
      el.setAttribute('aria-label', name + '，今天已经采集过');
      var sp = el.querySelector('span'); if (sp) sp.textContent = '已采集';
    });
  }
  /* ---------- 一碗饭和米饭火鸡 ----------
   * 芙罗拉星的野外战斗：每击败一只野生精灵，10% 掉落水稻种子。种植园 12 小时收获米饭 ×250，冶炼坊 500 粒米饭 = 一碗饭。
   * 一碗饭可以放在庞贝星熔岩原的任意一个场景（acc.riceBowl = { rid, si }），之后这个场景每次刷新精灵有 2% 是米饭火鸡（平时不出现）。
   * 捕捉或击败这只米饭火鸡后，这碗饭被吃掉（acc.riceBowl 清空）；逃跑或输了，饭还在。 */
  var RICE = PVE.RICE;   // 规则在 js/engine/pve.js（服务器和浏览器共用）
  function riceBowlAt(rid, si) { var b = acc && acc.riceBowl; return !!(b && b.rid === rid && b.si === si); }
  function riceSpawn(R, slot) {
    if (slot.si == null || !riceBowlAt(R.id, slot.si) || Math.random() >= RICE.chance) return null;
    var w = (WILD[R.pool] || []).filter(function (x) { return x.sid === RICE.sid; })[0] || { sid: RICE.sid, lv: [RICE.lv, RICE.lv], rate: RICE.rate, tag: '中等', rare: true };
    return { w: w, lv: w.lv[0], bait: true };
  }
  function riceBowlHTML(R, si) {
    if (RICE.regions.indexOf(R.id) < 0) return '';
    if (riceBowlAt(R.id, si)) return '<div class="wf-bowl" title="一碗米饭，等着爱吃米饭的精灵来吃"><span class="wf-bowl-ic" aria-hidden="true">' + H.itemIcon('c_bowl') + '</span><span>一碗米饭</span></div>';
    if (acc.riceBowl || !(acc.items.c_bowl > 0)) return '';
    return '<button type="button" class="wf-bowl put" data-bowl="1"><span class="wf-bowl-ic" aria-hidden="true">' + H.itemIcon('c_bowl') + '</span><span>放下一碗饭</span></button>';
  }
  /* ---------- 三峡能源核心 · 采矿（2026-10-19） ----------
   * 荆楚号 · 宜昌的能源核心主人日透骨消：答对考核题（10 题对 7 题）领挖矿钻头（永久，耐久 80 次，5 题对 3 题修满）。
   * 芙罗拉星、坎伯兰星的每个野外场景里各有一处矿点（马亚尔煤炭 / 铁矿交替），每处每天挖 1 次，挖一次要等 10 秒。
   * 矿石在能源核心换能量，每天最多换 MINE.cap 能量。题库在 js/data/xcq.js（编码过） */
  var DRILL_MAX = TX.D.DRILL_MAX, DRILL_LOW = 0.2;   // 钻头耐久：挖一次 −1，满 80；低于 20% 挖完会提醒；在能源核心答 5 题对 3 题修满
  var MINE = { regions: ['forest', 'grass', 'kb_surf', 'kb_sea', 'kb_deep'], spot: { x: 10, y: 92 }, sec: 10, n: [2, 3], price: TX.D.MINE_PRICE, cap: TX.D.MINE_CAP, quiz: 10, pass: 7, hard: 2 };
  function mineRec() { return TX.mineRec(acc, Date.now()); }   // 规则在 js/engine/tx.js
  function drill() { return acc.drill || null; }   // { dur }：领过钻头就一直有，耐久用完要修
  function oreKind(si) { return si % 2 ? 'm_fe' : 'm_cu'; }
  function oreHTML(R, F, si) {
    if (MINE.regions.indexOf(R.id) < 0) return '';
    var k = oreKind(si), done = !!mineRec().got[R.id + ':' + si], nm = MATS[k].name;
    return '<button type="button" class="wf-ore ' + (k === 'm_fe' ? 'fe' : 'cu') + (done ? ' done' : '') + '" data-ore="' + si + '" style="left:' + MINE.spot.x + '%;top:' + MINE.spot.y + '%" title="' + (done ? '今天已经挖过了' : nm) + '"><span class="ore-ic" aria-hidden="true"></span><span>' + nm + (done ? '（已挖）' : '') + '</span></button>';
  }
  function mineOre(si) {
    si = +si; var R = regionById(ex.region), F = R && fields[R.id]; if (!F || ex.fighting || MINE.regions.indexOf(R.id) < 0) return;
    var M0 = mineRec(), key = R.id + ':' + si;
    if (M0.got[key]) { toast('这处矿点今天已经挖过了，明天再来吧。'); return; }
    if (!drill()) { toast(!coreOpen() ? '这是一处矿点。读完荆楚号 · 宜昌的支线「三峡能源核心」，就能领钻头来挖了。' : '需要挖矿钻头才能采矿。去荆楚号 · 宜昌的「三峡能源核心」找日透骨消领一个吧。'); return; }
    if (drill().dur <= 0) { toast('挖矿钻头的耐久度用完了，去荆楚号 · 宜昌的「三峡能源核心」找日透骨消修一下吧。'); return; }
    if ($('mine-dlg')) return;
    txRun('mine', { a: 'start', rid: R.id, si: si }, function () { mineDlg(si); });   // 开挖、挖完都由服务器结算（js/engine/world.js）
  }
  function mineDlg(si) {
    var k = oreKind(si), d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'mine-dlg';
    d.innerHTML = '<div class="soc-box mine-box" role="dialog" aria-modal="true" aria-label="采矿"><span class="tape l"></span><span class="tape r"></span><h2>正在采集' + MATS[k].name + '</h2>' +
      '<div class="mine-drill ' + (k === 'm_fe' ? 'fe' : 'cu') + '" aria-hidden="true"><span class="ore-ic"></span><i class="drill-bit"></i></div>' +
      '<div class="mine-bar"><i id="mine-fill"></i></div><p class="hint" id="mine-left">钻头转起来了……还要 ' + MINE.sec + ' 秒</p>' + '<p class="hint drill-dur">钻头耐久度 ' + drill().dur + ' / ' + DRILL_MAX + '</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-minex="1">先不挖了</button></div></div>';
    document.body.appendChild(d);
    var t0 = Date.now(), tm = setInterval(function () {
      var f = Math.min(1, (Date.now() - t0) / (MINE.sec * 1000)), el = $('mine-fill'); if (!el) { clearInterval(tm); return; }
      el.style.width = (f * 100) + '%'; $('mine-left').textContent = f < 1 ? '钻头转起来了……还要 ' + Math.ceil(MINE.sec * (1 - f)) + ' 秒' : '挖到了！';
      if (f >= 1) {
        clearInterval(tm);
        var fin = function (tries) {
          txRun('mine', { a: 'end' }, function (r) {
            var du = r.dur;
            $('mine-left').textContent = '挖到了！' + MATS[r.k].name + ' ×' + r.n;
            var dd = d.querySelector('.drill-dur'); if (dd) dd.textContent = '钻头耐久度 ' + du + ' / ' + DRILL_MAX;
            if (du < DRILL_MAX * DRILL_LOW) {   // 耐久不足：在采矿弹窗里提醒，点了才关
              $('mine-left').innerHTML = '挖到了！' + MATS[r.k].name + ' ×' + r.n + '<br><b class="red">' + (du <= 0 ? '钻头的耐久度用完了！' : '钻头耐久度即将不足（' + du + ' / ' + DRILL_MAX + '）') + '</b>去荆楚号 · 宜昌的三峡能源核心找日透骨消修复吧。';
              var ft = d.querySelector('.soc-foot'); ft.innerHTML = '<button type="button" class="btn primary" data-mineok="1">知道了</button>';
            } else setTimeout(function () { d.remove(); renderField(); igCheck(); }, 800);
          }, function (err) {
            if (err === '还没挖完' && tries < 3) { setTimeout(function () { fin(tries + 1); }, 600); return; }
            if (err === '' && tries < 10) { setTimeout(function () { fin(tries + 1); }, 300); return; }   // 上一笔交易还没结束
            $('mine-left').textContent = err || '没挖到，稍后再试试。';
          });
        };
        fin(0);
      }
    }, 100);
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-minex]')) { clearInterval(tm); d.remove(); }
      if (e.target.closest('[data-mineok]')) { d.remove(); renderField(); igCheck(); }
    });
  }
  // 题库：解码 js/data/xcq.js
  var XQ = null;
  function xcqBank() {
    if (XQ) return XQ; if (typeof XCQ === 'undefined') return [];
    try { var key = 'sanxia-LZSLFX', bin = atob(XCQ), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i) ^ key.charCodeAt(i % key.length); XQ = JSON.parse(new TextDecoder('utf-8').decode(u)); } catch (e) { XQ = []; }
    return XQ;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function lzDlg(lines, btns) {
    var d = document.createElement('div'); d.className = 'soc-dlg npc-dlg';
    d.innerHTML = '<div class="soc-box npc-box" role="dialog" aria-modal="true" aria-label="日透骨消"><span class="tape l"></span><span class="tape r"></span>' +
      '<img class="npc-face lz-face" src="' + CHARS.rtg + '" alt="日透骨消"><div class="npc-say"><span class="step">日透骨消 · 三峡能源核心主人</span>' + lines.map(function (x, i) { return '<p class="' + (i ? 'hint' : 'npc-line') + '">' + x + '</p>'; }).join('') + '</div>' +
      '<div class="soc-foot">' + btns.map(function (b, i) { return '<button type="button" class="btn' + (i === btns.length - 1 ? ' primary' : ' ghost') + '" data-lzb="' + i + '"' + (b[2] ? ' disabled' : '') + '>' + esc(b[0]) + '</button>'; }).join('') + '</div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-lzb]'); if (e.target === d || b) { d.remove(); var fn = b && btns[+b.dataset.lzb][1]; if (fn) fn(); } });
  }
  /* ---------- 新支线提醒（2026-10-19）：有新开放的支线时，进游戏弹一次窗告诉玩家 ----------
   * acc.sideSeen 记着已经提醒过的支线；第一次运行时把现有的支线都记为看过（这次新加的 SIDE_NEW 除外） */
  var SIDE_NEW = ['core'];
  function sideCheck() {
    if (ex.baseEdit || !ready() || !acc.introDone || ex.fighting || ex.view === 'vn' || document.querySelector('.soc-dlg') || ($('battle') && !$('battle').hidden)) return;
    if (!acc.sideSeen) { acc.sideSeen = {}; Object.keys(SITES).forEach(function (id) { if (SITES[id].side && SIDE_NEW.indexOf(id) < 0) acc.sideSeen[id] = 1; }); save(); }
    var nw = Object.keys(SITES).filter(function (id) { var S = SITES[id]; return S.side && !S.event && !acc.sideSeen[id] && !prog(id).done && unlocked(id) && (!S.dept || deptOpen(S.dept)); });
    if (!nw.length) return;
    nw.forEach(function (id) { acc.sideSeen[id] = 1; }); save();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'side-dlg';
    d.innerHTML = '<div class="soc-box side-new" role="dialog" aria-modal="true" aria-label="新的支线任务"><span class="tape l"></span><span class="tape r"></span><span class="step">新的支线任务</span><h2>有新的支线任务开放了！</h2><ul>' +
      nw.map(function (id) { var S = SITES[id], P = planetOf(S.planet); return '<li><b>' + esc(S.chapter) + '</b><small>' + esc(P ? P.name : '') + (S.dept ? ' · ' + S.dept + ' · ' + (DEPTS[S.dept] ? DEPTS[S.dept][0] : '') : ' · ' + S.name) + '</small><p class="hint">' + esc(S.d) + '</p></li>'; }).join('') +
      '</ul><div class="soc-foot"><button type="button" class="btn ghost" data-sidex="1">知道了</button><button type="button" class="btn primary" data-sidego="' + nw[0] + '">去看看</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-sidex]')) { d.remove(); return; }
      var g = e.target.closest('[data-sidego]'); if (!g) return; d.remove();
      var S = SITES[g.dataset.sidego]; ex.planet = S.planet;
      if (S.dept) { go('explore'); teleport(S.dept); } else { ex.view = 'sites'; go('explore'); renderExplore(); }
    });
  }
  setInterval(sideCheck, 3000);
  /* ---------- 新手指引（2026-10-24）：弹窗提醒继续主线、去野外捕捉精灵 ----------
   * 主线：下一段可以读了、或者还差任务才能读时，各提醒一次（acc.guide.main 记着提醒过哪一段的哪种状态）
   * 捕捉：能进野外以后，精灵还很少的话提醒一次（acc.guide.caught） */
  function mainNext() { var ids = Object.keys(SITES).filter(function (id) { var S = SITES[id]; return !S.side && !prog(id).done && (!S.after || prog(S.after).done); }); return ids[0] || null; }
  function guideGo(id, part) {
    var S = SITES[id]; ex.planet = S.planet;
    if (S.dept) { go('explore'); teleport(S.dept); return; }
    ex.view = 'sites'; if (S.planet === 'flora') { ex.fpart = part || 'story'; ex.flSt = 'main'; }
    go('explore'); renderExplore();
  }
  function guidePop(step, title, html, btn, fn) {
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'guide-dlg';
    d.innerHTML = '<div class="soc-box side-new" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><span class="tape l"></span><span class="tape r"></span><span class="step">' + esc(step) + '</span><h2>' + esc(title) + '</h2>' + html +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-gdx="1">知道了</button><button type="button" class="btn primary" data-gdgo="1">' + esc(btn) + '</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-gdx]')) { d.remove(); return; }
      if (e.target.closest('[data-gdgo]')) { d.remove(); fn(); }
    });
  }
  function guideCheck() {
    if (ex.baseEdit || !ready() || ex.fighting || ex.view === 'vn' || ex.mode || document.querySelector('.soc-dlg') || ($('battle') && !$('battle').hidden)) return;
    if (!acc.guide) acc.guide = {};
    var G = acc.guide, id = mainNext();
    if (G.coach) return;   // 正在一步一步指引捕捉
    if (id) {
      var S = SITES[id], ok = unlocked(id), key = id + (ok ? ':open' : ':need');
      if (G.main !== key && (ok || S.needText)) {
        G.main = key; save();
        var P = planetOf(S.planet), where = (P ? P.name : '') + (S.dept ? ' · ' + (DEPTS[S.dept] ? DEPTS[S.dept][0] : S.dept) : ' · ' + S.name);
        if (ok) guidePop('主线指引', '继续主线：' + S.chapter, '<p class="hint">' + esc(where) + '</p><p>' + esc(S.d) + '</p>', '前往', function () { guideGo(id, 'story'); });
        else guidePop('主线指引', '下一段主线：' + S.chapter, '<p>要继续主线，先完成这个任务：</p><p><b class="red">' + esc(S.needText) + '</b></p>', '去完成', function () { guideGo(id, S.planet === 'flora' ? 'catch' : 'story'); });
        return;
      }
    }
    if (!G.caught && prog('flora1').done && acc.mons.length < 3) {
      G.caught = 1; save();
      guidePop('新手指引', '去野外捕捉精灵吧', '<p>芙罗拉星的丛林和草甸里有很多野生精灵。点场景里走动的精灵就能和它对战，在对战的「道具」页使用捕捉装置就能把它收进队伍。</p><p class="hint">打到对方体力越低、对方身上有异常状态，越容易捕捉成功。捕捉装置可以在荆楚号 · 荆门 · 物资仓储的商城兑换。</p>', '跟着指引去捕捉', coachStart);
    }
  }
  setInterval(guideCheck, 4000);
  /* 捕捉指引（2026-10-27）：一步一步高亮要点的按钮：星际探索 → 芙罗拉星 → 探索 → 进入丛林 → 点走动的精灵。按当前所在的页面决定提示哪一步 */
  function coachStart() { if (!acc.guide) acc.guide = {}; acc.guide.coach = 1; save(); coachTick(); }
  function coachEnd(msg) { if (acc.guide) { acc.guide.coach = 0; save(); } coachClear(); if (msg) toast(msg); }
  function coachClear() { var b = $('coach'); if (b) b.remove(); document.querySelectorAll('.coach-hl').forEach(function (x) { x.classList.remove('coach-hl'); }); }
  function coachVis(sel) { var L = document.querySelectorAll(sel); for (var i = 0; i < L.length; i++) if (L[i].offsetParent !== null && !L[i].disabled) return L[i]; return null; }
  var coachKey = '';
  function coachTick() {
    if (!acc || !acc.guide || !acc.guide.coach) { if ($('coach')) coachClear(); return; }
    var battleOn = $('battle') && !$('battle').hidden;
    if (!ready() || ex.mode || ex.view === 'vn' || document.querySelector('.soc-dlg') || battleOn) {
      if (battleOn && page === 'explore' && ex.view === 'field') { coachEnd(); return; }   // 已经在野外打起来了：指引结束
      coachClear(); return;
    }
    var t = null, step = '', txt = '', btn = '';
    if (page !== 'explore') { t = coachVis('#mainnav [data-page="explore"]'); step = '第 1 步'; txt = '打开「星际探索」'; }
    else if (ex.view === 'planets') { t = coachVis('#pg-explore [data-planet="flora"]'); step = '第 2 步'; txt = '选择芙罗拉星'; }
    else if (ex.view === 'sites' && ex.planet === 'flora' && (ex.fpart || 'catch') !== 'catch') { t = coachVis('#pg-explore .flora-hero [data-fpart="catch"]'); step = '第 3 步'; txt = '切换到「探索」'; }
    else if (ex.view === 'sites' && ex.planet === 'flora') { t = coachVis('#pg-explore [data-field]'); step = '第 4 步'; txt = '进入丛林（或草甸）'; }
    else if (ex.view === 'field') { step = '最后一步'; txt = '点场景里走动的精灵和它对战。对战时打开「道具」页，投出捕捉装置就能收服它（把它打虚弱更容易成功）。'; }
    else { step = '第 1 步'; txt = '先回到星际探索的星球列表'; btn = '<button type="button" class="btn primary" data-coachback="1">回到星球列表</button>'; }
    var key = page + '|' + ex.view + '|' + ex.planet + '|' + ex.fpart + '|' + step;
    document.querySelectorAll('.coach-hl').forEach(function (x) { if (x !== t) x.classList.remove('coach-hl'); });
    if (t) t.classList.add('coach-hl');
    var b = $('coach');
    if (!b) {
      b = document.createElement('div'); b.id = 'coach'; b.className = 'coach'; document.body.appendChild(b);
      b.addEventListener('click', function (e) {
        if (e.target.closest('[data-coachx]')) { coachEnd('捕捉指引已关闭。'); return; }
        if (e.target.closest('[data-coachback]')) { ex.view = 'planets'; renderExplore(); coachTick(); }
      });
    }
    var html = '<span class="co-step">捕捉指引 · ' + step + '</span><b>' + txt + '</b>' + btn + '<button type="button" class="co-x" data-coachx="1" aria-label="关闭指引">跳过</button>';
    if (b._h !== html) { b.innerHTML = html; b._h = html; }
    if (key !== coachKey) { coachKey = key; if (t) try { t.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (er) {} }
    if (t) {
      var r = t.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      var top = r.bottom + 10 + bh < vh ? r.bottom + 10 : Math.max(8, r.top - bh - 10);
      b.style.left = Math.min(vw - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2)) + 'px'; b.style.top = top + 'px'; b.style.bottom = 'auto'; b.classList.remove('free');
    } else { b.style.left = ''; b.style.top = ''; b.style.bottom = ''; b.classList.add('free'); }
  }
  setInterval(coachTick, 250);
  /* 做题大王争霸赛（2026-10-19）：进游戏后先读一次赛事状态。报名期间还没报名的弹报名窗（每次打开游戏一次）；没看过的全服公告补弹最新一条 */
  var ctPopped = false;
  function ctPopCheck() {
    if (ex.baseEdit || !ready() || !acc.introDone || ex.fighting || ex.view === 'vn' || ($('battle') && !$('battle').hidden)) return;
    if (!CT.data) { if (!CT.busy && !CT.err) contestLoad(); return; }
    if (document.querySelector('.soc-dlg') || document.querySelector('.ctd')) return;
    if (ctNoticeQ.length) { ctNoticePop(ctNoticeQ.shift()); return; }
    if (ctPopped) return;
    ctPopped = true;
    var D = CT.data;
    if (!acc.ctSeen) acc.ctSeen = {};
    var unseen = (D.notices || []).filter(function (n) { return !acc.ctSeen[n.id]; });
    if (unseen.length) { unseen.slice(0, -1).forEach(function (n) { acc.ctSeen[n.id] = 1; }); ctNoticePop(unseen[unseen.length - 1]); return; }
    if (D.status !== 'signup' || contestMe()) return;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'ct-dlg';
    d.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true" aria-label="' + CONTEST.name + '"><span class="tape l"></span><span class="tape r"></span><span class="step">飞船终端 · 争霸赛</span><h2>' + CONTEST.name + ' 报名中！</h2>' +
      '<p>做题家们，比一比谁才是真正的做题大王！' + (D.drawAt ? '抽签将在 ' + bjText(D.drawAt) + ' 开始，开始即截止报名。' : '报名满 ' + D.min + ' 人后确定抽签时间。') + '</p><p class="hint">已报名 <b>' + (D.count || 0) + '</b> 人。所有参赛者都有神秘精灵兑换券和大量经验奖励。也可以之后在星图上空间站右边的「争霸赛」报名。</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-ctx="1">稍后再说</button><button type="button" class="btn primary" data-ctgo="1">立即报名</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-ctx]')) { d.remove(); return; }
      if (e.target.closest('[data-ctgo]')) { d.remove(); contestSign(); }
    });
  }
  setInterval(ctPopCheck, 3000);
  /* ---------- 召唤（2026-11-01）：圣晶石召唤 / 友情点召唤 / 召唤代币商店。规则在 js/engine/summon.js ---------- */
  function sumRec() { return acc.sum || { n: 0, free: 0, pity: 0, fsDay: '', m: '', buy: {} }; }
  function sumGain(g) {   // 一条召唤结果 → { k: 图标键, t: 文字, c: 稀有度 }
    var c = g.up ? 'up' : g.rare ? 'gold' : g.lim || g.chip ? 'hi' : g.ins ? 'mid' : '';
    if (g.exp) return { k: 'exp', t: '经验 ×' + fmt(g.exp), c: c };
    if (g.energy) return { k: 'energy', t: '能量 ×' + fmt(g.energy), c: c };
    var k = Object.keys(g.items || {})[0]; return { k: k, t: itemName(k) + (g.items[k] > 1 ? ' ×' + fmt(g.items[k]) : ''), c: c };
  }
  var SUM_GLYPH = '✦◇⟡✧◆❖✶⟐✷◈';
  function sumCircle() {   // 召唤阵（原创 SVG）：外圈符文、内圈六芒星
    var runes = ''; for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2; runes += '<text x="' + (200 + 168 * Math.cos(a)).toFixed(1) + '" y="' + (200 + 168 * Math.sin(a)).toFixed(1) + '" transform="rotate(' + (i * 15 + 90) + ' ' + (200 + 168 * Math.cos(a)).toFixed(1) + ' ' + (200 + 168 * Math.sin(a)).toFixed(1) + ')">' + SUM_GLYPH[i % SUM_GLYPH.length] + '</text>'; }
    var tri = function (r, rot) { var p = []; for (var j = 0; j < 3; j++) { var a = (j / 3 * 360 + rot) * Math.PI / 180; p.push((200 + r * Math.cos(a)).toFixed(1) + ',' + (200 + r * Math.sin(a)).toFixed(1)); } return '<polygon points="' + p.join(' ') + '"/>'; };
    return '<svg class="sa-circle" viewBox="0 0 400 400" aria-hidden="true"><g class="sa-r1"><circle cx="200" cy="200" r="190"/><circle cx="200" cy="200" r="150"/><g class="sa-runes">' + runes + '</g></g>' +
      '<g class="sa-r2">' + tri(140, -90) + tri(140, 90) + '<circle cx="200" cy="200" r="100"/></g><g class="sa-r3"><circle cx="200" cy="200" r="60"/>' + [0, 45, 90, 135].map(function (d) { return '<line x1="200" y1="130" x2="200" y2="270" transform="rotate(' + d + ' 200 200)"/>'; }).join('') + '</g></svg>';
  }
  function playSummon(list, pool) {
    var G = list.map(sumGain), best = G.some(function (x) { return x.c === 'up'; }) ? 'up' : G.some(function (x) { return x.c === 'gold'; }) ? 'gold' : 'blue';
    var d = document.createElement('div'); d.className = 'sum-anim ' + best + (pool === 'friend' ? ' fr' : ''); d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', '召唤结果');
    d.innerHTML = '<div class="sa-stage">' + sumCircle() + '<div class="sa-core"></div><div class="sa-flash"></div></div>' +
      '<div class="sa-res" hidden><h3>召唤结果</h3><div class="sa-grid">' + G.map(function (x, i) { return '<div class="sa-card ' + x.c + '" style="animation-delay:' + (i * 0.09).toFixed(2) + 's"><span class="sa-ic">' + H.itemIcon(x.k) + '</span><b>' + esc(x.t) + '</b>' + (x.c === 'up' ? '<i>UP</i>' : '') + '</div>'; }).join('') + '</div>' +
      '<div class="sa-foot"><button type="button" class="btn primary" data-sax="1">确定</button></div></div><button type="button" class="btn ghost sa-skip" data-saskip="1">跳过</button>';
    document.body.appendChild(d); bgmScene();
    var shown = false, show = function () { if (shown) return; shown = true; d.classList.add('done'); d.querySelector('.sa-res').hidden = false; var sk = d.querySelector('.sa-skip'); if (sk) sk.remove(); };
    setTimeout(function () { d.classList.add('burst'); }, 2600);
    setTimeout(show, 3300);
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-saskip]')) { show(); return; }
      if (e.target.closest('[data-sax]')) { d.remove(); bgmScene(); renderRes(); if (ex.view === 'summon') renderSummon(); }
    });
  }
  function doSummon(pool, n, free) {
    if (document.querySelector('.sum-anim')) return;
    txRun('summon', { pool: pool, n: n, free: !!free }, function (r) { renderRes(); renderSummon(); playSummon(r.list || [], pool); });
  }
  function sumRates(B) {
    var tot = 0; SUMMON.SAINT_POOL.forEach(function (p) { tot += p.w; });
    var nm = function (p) { return p.k === 'rareEss' ? '稀有精灵的精元（' + SUMMON.rareSids().map(function (s) { return SPMAP[s].evo[0].n || SPMAP[s].name; }).join('、') + '，随机一种）' : p.k === 'limIns' ? '当期限定刻印（' + B.ins.map(function (k) { return SUMMON.INS[k].name; }).join('、') + '，随机一种）' : p.exp ? '经验 ×' + fmt(p.exp) : p.energy ? '能量 ×' + fmt(p.energy) : Object.keys(p.items).map(function (k) { return itemName(k) + (p.items[k] > 1 ? ' ×' + p.items[k] : ''); }).join(''); };
    return '<details class="sum-rates"><summary>概率公示</summary><ul><li><b>' + esc(SPMAP[B.up].evo[0].n) + '的精元（当期 UP）：' + Math.round(SUMMON.UP_RATE * 100) + '%</b>；连续 ' + SUMMON.PITY_SOFT + ' 次没出之后，每次 +6%，第 ' + SUMMON.PITY_HARD + ' 次必出</li>' +
      SUMMON.SAINT_POOL.map(function (p) { return '<li>' + esc(nm(p)) + '：' + (p.w * (1 - SUMMON.UP_RATE) / tot * 100).toFixed(1) + '%</li>'; }).join('') + '</ul></details>';
  }
  function fRates() {
    var tot = 0; SUMMON.FRIEND_POOL.forEach(function (p) { tot += p.w; });
    var nm = function (p) { return p.k === 'gem' ? '星球特产 ×' + p.n + '（芙罗拉玉、不化水滴、火山灰烬、闪电球体、永久冻土，随机一种）' : p.k === 'monItem' ? '精灵道具（成长果实、迅速成长果实、50学习力合剂、学习力重置胶囊，随机一种）' : p.k === 'normIns' ? '常规刻印（初级 90%、强效 10%）' : p.exp ? '经验 ×' + fmt(p.exp) : Object.keys(p.items).map(function (k) { return itemName(k) + ' ×' + p.items[k]; }).join(''); };
    return '<details class="sum-rates"><summary>概率公示</summary><ul>' + SUMMON.FRIEND_POOL.map(function (p) { return '<li>' + esc(nm(p)) + '：' + (p.w / tot * 100).toFixed(1) + '%</li>'; }).join('') + '</ul></details>';
  }
  /* ---------- 无尽作战（2026-11-02，飞船终端右侧）：规则在 js/engine/endless.js ---------- */
  var EN = ENDLESS, enUi = { d: null, pick: {}, line: [], eqB: null, tab: 'run' };
  var EN_NPC = { vanber: ['Vanber', 'vanber'], threego: ['Threego', 'threego'], bttp: ['Bttp', 'bttp'], cumber: ['Cumber', 'cumber'] };
  function enIt(k, n) { var x = EN.IT[k]; return '<span class="en-it t' + (x ? x.tier : 1) + '" title="' + esc(x ? x.d : '') + '">' + H.itemIcon(k) + '<b>' + esc(x ? x.n : k) + '</b>' + (n > 1 ? '<i>×' + n + '</i>' : '') + '</span>'; }
  function enOpt(o) {
    if (o.k === 'heal') return '<span class="en-ic">❤</span><b>补给</b><small>全员恢复 ' + Math.round(o.n * 100) + '% 最大体力（只对还能战斗的精灵）</small>';
    if (o.k === 'gems') return '<span class="en-ic">💎</span><b>无尽宝石 ×' + o.n + '</b><small>在商店里买东西用</small>';
    var x = EN.IT[o.k]; return H.itemIcon(o.k) + '<b>' + esc(x.n) + '</b><em class="en-tier t' + x.tier + '">' + EN.TIER_NAME[x.tier] + ' · ' + EN.KIND_NAME[x.kind] + '</em><small>' + esc(x.d) + '</small>';
  }
  function enHp(x) { var p = Math.max(0, Math.min(1, x.hpr || 0)); return '<div class="hpbar"><i class="' + (p > 0.5 ? '' : p > 0.2 ? 'mid' : 'low') + '" style="width:' + (p * 100).toFixed(1) + '%"></i></div>'; }
  function enRosCard(x, i, R, mode) {   // mode：'line' 选出战（点了切换选中）/ 'open' 名单（点了打开精灵面板）
    var sp = x.spec, on = mode === 'line' && enUi.line.indexOf(i) >= 0, S0 = SPMAP[x.sid], p = Math.round(Math.max(0, Math.min(1, x.hpr || 0)) * 100);
    return '<div class="en-ros' + (x.dead ? ' dead' : '') + (on ? ' on' : '') + '" data-enr="' + i + '" style="--tc:' + (TYPE_COLOR[S0.types[0]] || '#888') + '"><div class="en-rpic"><img src="' + esc(sp.img) + '" alt="">' + (x.dead ? '<span class="en-stamp">倒下</span>' : '') + '</div>' +
      '<div class="en-rt"><b>' + esc(sp.nick) + '</b><small>LV' + sp.lv + ' · ' + (x.dead ? '已倒下' : p + '%') + '</small>' + enHp(x) +
      '<div class="en-eq">' + [0, 1, 2].map(function (s) { var q = x.eq[s]; return q ? '<span class="en-slot full t' + EN.IT[q].tier + '" title="' + esc(EN.IT[q].n) + '">' + H.itemIcon(q) + '</span>' : '<span class="en-slot"></span>'; }).join('') + '</div></div>' +
      (on ? '<span class="en-ord">' + (enUi.line.indexOf(i) + 1) + '</span>' : '') + '</div>';
  }
  function renderEndless() {
    var E = EN.rec(acc), R = E.run, html = exHead('') + '<div class="crumb"><button type="button" class="btn ghost" id="en-back">‹ 返回飞船终端</button><b>荆楚号 · 无尽作战</b></div>';
    if (!R) html += enLobby(E); else html += enRun(R);
    if (enUi.pageHtml !== html || !$('pg-explore').querySelector('.crumb #en-back')) { var w0 = $('en-mapw'), sl = w0 ? w0.scrollLeft : null; $('pg-explore').innerHTML = html; enUi.pageHtml = html; enMapBind(sl); }   // 页面没变就不重画（免得闪）
    enModal(R);
  }
  function enLobby(E) {
    var d = enUi.d && enUi.d <= E.maxD ? enUi.d : E.maxD; enUi.d = d;
    var mons = acc.mons.slice().sort(function (a, b) { return b.lv - a.lv; }), n = Object.keys(enUi.pick).filter(function (u) { return enUi.pick[u] && mon(+u); }).length;
    var diffs = ''; for (var i = 1; i <= EN.D_MAX; i++) diffs += '<button type="button" class="en-d' + (i === d ? ' on' : '') + (i > E.maxD ? ' locked' : '') + '"' + (i > E.maxD ? ' disabled title="通关难度 ' + (i - 1) + ' 后解锁"' : ' data-end="' + i + '"') + '><b>' + (i > E.maxD ? '🔒' : i) + '</b><small>' + (E.clr[i] ? '通关 ' + E.clr[i] + ' 次' : E.best[i] ? '最远 ' + E.best[i] + ' 关' : i > E.maxD ? '未解锁' : '未挑战') + '</small></button>';
    var lvB = EN.lvTop(d);
    return '<section class="en-intro"><h3>无尽作战</h3><p>一次作战有 <b>3 个大关卡</b>，每个大关卡 15 关，最后一关是 BOSS。通关全部 3 个大关卡，解锁下一级难度（共 10 级）。</p>' +
      '<ul><li>开局从你的精灵里挑最多 <b>20 只</b>，练度在开局时固定；每场战斗派最多 5 只。</li><li>体力不会在战斗之间回满（PP 会），倒下的精灵这次作战里不能再上场，装备会脱落回背包。</li>' +
      '<li>每赢一关，选择下一个节点：战斗 / 精英 / 奖励 / 商店 / 碰碰运气。战斗胜利得到无尽宝石，并从奖励里挑选。</li><li>失败回到这个大关卡的起点。随时可以结束作战，按走到的最远进度获得经验和无尽代币。</li></ul></section>' +
      '<h4 class="en-h">选择难度</h4><div class="en-diffs">' + diffs + '</div><p class="hint">难度 ' + d + '：敌人 LV40 ~ ' + (lvB > 100 ? 'LV.??' : 'LV' + lvB) + '，难度越高，敌人的增益和能力越强。开局带 ' + EN.GEM0 + ' 颗无尽宝石。</p>' +
      '<h4 class="en-h">挑选参战精灵 <span class="hint">已选 ' + n + ' / ' + EN.ROSTER_MAX + '</span><button type="button" class="btn ghost" data-enauto="1">按等级自动选</button><button type="button" class="btn ghost" data-enclr="1">清空</button></h4>' +
      '<div class="en-pickgrid">' + mons.map(function (m) { var f = form(m), on = !!enUi.pick[m.u]; return '<button type="button" class="en-pk' + (on ? ' on' : '') + '" data-enpk="' + m.u + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + '</small></button>'; }).join('') + '</div>' +
      '<div class="en-start"><button type="button" class="btn primary big" data-enstart="1"' + (n ? '' : ' disabled') + '>开始作战（难度 ' + d + '）</button></div>' +
      '<h4 class="en-h">无尽代币商店 <span class="hint">' + H.itemIcon('enTok') + ' 无尽代币 ' + fmt(acc.items.enTok || 0) + '</span></h4><div class="shop-grid">' +
      EN.TOK_SHOP.map(function (T) { var I = SUMMON.INS[T.k]; return '<article class="shop-it">' + H.itemIcon(T.k) + '<div class="si-txt"><b>' + esc(I.name) + '</b><p class="hint">限定刻印 · 体力 +25，' + esc(I.fd) + '</p><p class="si-own">持有 ' + (acc.items[T.k] || 0) + '</p></div><div class="si-buy"><span class="si-price">' + H.itemIcon('enTok') + T.price + '</span><button type="button" class="btn primary" data-entok="' + T.k + '"' + ((acc.items.enTok || 0) >= T.price ? '' : ' disabled') + '>兑换</button></div></article>'; }).join('') + '</div>';
  }
  function enRun(R) {   // 页面：顶部信息条 + 大地图（节点内容、精灵、道具都在弹出层里，见 enModal）
    var P = R.pend, pips = '';
    for (var s0 = 0; s0 < EN.STAGES; s0++) pips += '<i class="' + (s0 < R.st ? 'done' : s0 === R.st ? 'on' : '') + '"></i>';
    var nCons = Object.keys(R.cons).reduce(function (n, k) { return n + R.cons[k]; }, 0);
    var hud = '<section class="en-hud"><span class="tape l"></span><span class="tape r"></span><div class="en-hud-l"><span class="en-dbadge"><small>难度</small><b>' + R.d + '</b></span>' +
      '<div class="en-hud-prog"><span class="en-pips" title="大关卡">' + pips + '</span><b>第 ' + (R.st + 1) + ' 大关卡</b><small>第 ' + Math.min(EN.NODES, R.n + 1) + ' / ' + EN.NODES + ' 关</small></div>' +
      '<span class="en-gemc"><i>💎</i><b>' + fmt(R.gems) + '</b><small>无尽宝石</small></span>' +
      (R.vbOn ? '<span class="en-vbc' + (R.vbDone ? ' full' : '') + '"><i>❤</i><b>' + (R.vbDone ? '满' : (R.vb || 0)) + '</b><small>Vanber 好感</small></span>' : '') + '</div>' +
      '<div class="en-hud-r"><button type="button" class="en-hbtn" data-enpanel="ros"><i>🐾</i><span>精灵<small>' + EN.alive(R).length + ' / ' + R.ros.length + '</small></span>' + (R.bag.length ? '<em class="en-badge">' + R.bag.length + '</em>' : '') + '</button>' +
      '<button type="button" class="en-hbtn" data-enpanel="bag"><i>🎒</i><span>道具<small>' + (R.abil.length + nCons + R.bag.length) + ' 件</small></span></button>' +
      '<button type="button" class="en-hbtn quit" data-enquit="1"><i>⏏</i><span>结束<small>结算</small></span></button></div></section>';
    var reopen = R.cur && !P && enUi.hide ? '<div class="en-reopen"><button type="button" class="btn primary big" data-enshow="1">▶ 继续：' + EN.NODE[R.cur.t].n + '</button></div>' : '';
    return hud + (R.map ? enMapHTML(R) : '') + reopen;
  }
  // 弹出层：节点内容（剧情、对战准备、奖励、商店、碰碰运气）和精灵 / 道具面板。返回 { key, html, close }
  function enModalOf(R) {
    var P = R.pend, key = '', html = '', close = false, wide = false;
    if (P && P.t === 'ev') { key = 'ev' + R.st; html = enEvent(R, P); }
    else if (P && P.t === 'pick') { key = 'pick' + R.st + ':' + R.n; html = enPickHTML(R, P); }
    else if (P && P.t === 'shop') { key = 'shop' + R.st + ':' + R.n; html = enShopHTML(R, P); wide = true; }
    else if (P && P.t === 'msg') { key = 'msg' + R.st + ':' + R.n; html = '<section class="en-card en-gam"><div class="en-ch"><span>🎲</span><h3>碰碰运气</h3></div><div class="en-cb"><p class="en-msg">' + esc(P.text) + '</p>' + (P.got ? '<div class="en-gamgot">' + H.itemIcon(P.got) + '<b class="t' + EN.IT[P.got].tier + '">' + esc(EN.IT[P.got].n) + '</b></div>' : '') + '</div><div class="en-cf"><button type="button" class="btn primary big" data-enleave="1">继续前进</button></div></section>'; }
    else if (R.cur && !enUi.hide) { key = 'cur' + R.st + ':' + R.n; html = enPrep(R); wide = true; }
    if (!html && enUi.panel) {
      close = true; wide = true; key = 'p:' + enUi.panel;
      html = enUi.panel === 'mon' ? enMonPanel(R) : enUi.panel === 'bag' ? enBagPanel(R) : enRosPanel(R);
    }
    return { key: key, html: html, close: close, wide: wide };
  }
  function enModal(R) {
    var el = $('en-modal'), M = R ? enModalOf(R) : { html: '' };
    if (!M.html) { if (el) el.remove(); enUi.mKey = null; return; }
    if (!el || enUi.mKey !== M.key) {
      if (el) el.remove();
      el = document.createElement('div'); el.id = 'en-modal'; el.className = 'en-modal';
      el.innerHTML = '<div class="en-mbox"></div>'; document.body.appendChild(el);
      el.addEventListener('click', function (e) { if (e.target === el && enUi.mClose) { enUi.panel = null; renderEndless(); return; } enClick(e); });
      enUi.mKey = M.key; enUi.mHtml = null;
    }
    enUi.mClose = M.close; el.classList.toggle('wide', !!M.wide);
    var box = el.querySelector('.en-mbox');
    if (enUi.mHtml !== M.html) { var sc = box.scrollTop, ls = box.querySelector('.en-blist'), lsc = ls ? ls.scrollTop : 0; box.innerHTML = M.html; box.scrollTop = sc; var ls2 = box.querySelector('.en-blist'); if (ls2) ls2.scrollTop = lsc; enUi.mHtml = M.html; }
    var eo = $('en-order'); if (eo && !eo._sortable) H.sortable(eo, function (keys) { enUi.line = keys.map(Number); renderEndless(); });
  }
  function enModalOff() { var el = $('en-modal'); if (el) el.remove(); enUi.mKey = null; enUi.mHtml = null; }
  function enPickHTML(R, P) {
    var got = P.got.filter(function (g) { return g >= 0; }).length;
    return '<section class="en-card"><div class="en-ch"><span>' + (P.from === 'boss' ? '👑' : P.from === 'reward' ? '🎁' : '🏆') + '</span><h3>' + (P.from === 'boss' ? '击败首领！' : P.from === 'reward' ? '奖励' : '胜利！') + '</h3><em class="en-cnt">' + got + ' / ' + P.need + '</em></div>' +
      '<div class="en-cb"><p class="en-sub">' + (P.from === 'boss' ? '从 4 件传奇道具中选 2 件' : '选择 ' + P.need + ' 项') + '</p><div class="en-opts">' +
      P.opts.map(function (o, k) { var g = P.got.indexOf(k) >= 0, x = EN.IT[o.k]; return '<button type="button" class="en-opt' + (g ? ' got' : '') + (x ? ' t' + x.tier : '') + '"' + (g ? ' disabled' : ' data-enpick="' + k + '"') + '>' + enOpt(o) + (g ? '<span class="en-gotmark">✓ 已选</span>' : '') + '</button>'; }).join('') +
      '</div></div><div class="en-cf"><button type="button" class="btn ghost" data-enskip="1">跳过剩下的</button></div></section>';
  }
  function enShopHTML(R, P) {
    return '<section class="en-card"><div class="en-ch"><span>🛒</span><h3>商店</h3><em class="en-cnt">💎 ' + fmt(R.gems) + '</em></div><div class="en-cb">' +
      (P.vb && !P.chat ? '<div class="en-vbshop"><img src="' + CHARS.vanber_smile + '" alt=""><div><p>Vanber 也在这家商店里！</p><button type="button" class="btn" data-enchat="peek">和 Vanber 聊聊</button></div></div>' : '') + '<div class="en-shop">' +
      P.list.map(function (L, k) { var x = EN.IT[L.k], owned = x && x.kind === 'abil' && R.abil.indexOf(L.k) >= 0; return '<div class="en-sh' + (L.sold ? ' sold' : '') + (x ? ' t' + x.tier : '') + '">' + enOpt(L.k === 'heal' ? { k: 'heal', n: L.n } : L) + '<div class="en-buy"><span>💎 ' + L.price + '</span><button type="button" class="btn primary" data-enbuy="' + k + '"' + (L.sold || owned || R.gems < L.price ? ' disabled' : '') + '>' + (L.sold ? '已售出' : owned ? '已拥有' : '购买') + '</button></div></div>'; }).join('') +
      '</div></div><div class="en-cf"><button type="button" class="btn primary big" data-enleave="1">离开商店</button></div></section>';
  }
  // 精灵名单（点一只打开它的面板，在面板里配置装备）
  function enOrder(R) { return R.ros.map(function (x, i) { return i; }).sort(function (a, b) { return (R.ros[b].spec.lv - R.ros[a].spec.lv) || a - b; }); }   // 名单按等级从高到低（2026-11-03）
  function enRosPanel(R) {
    return '<section class="en-card"><div class="en-ch"><span>🐾</span><h3>参战精灵</h3><em class="en-cnt">存活 ' + EN.alive(R).length + ' / ' + R.ros.length + '</em><button type="button" class="en-x" data-enpanel="" aria-label="关闭">✕</button></div>' +
      '<div class="en-cb"><div class="en-roster">' + enOrder(R).map(function (i) { return enRosCard(R.ros[i], i, R, 'open'); }).join('') + '</div>' + (R.bag.length ? '<p class="en-sub">背包里有 ' + R.bag.length + ' 件装备还没装上。</p>' : '') + '</div></section>';
  }
  function enStats(x) {
    var sp = x.spec, bm = makeMon(sp.id, sp.moves, 1, sp.lv, sp.ev, sp.nat, sp.iv);
    if (typeof SUMMON !== 'undefined' && x.im) SUMMON.insApply(bm, x.im);
    var mul = 1; x.eq.forEach(function (q) { if (q === 'eq_gorgon') mul += 0.3; if (q === 'eq_hp10') mul += 0.1; });
    bm.maxhp = Math.round(bm.maxhp * mul); return bm;
  }
  function enMonPanel(R) {
    var i = enUi.monI | 0, x = R.ros[i]; if (!x) { enUi.panel = 'ros'; return enRosPanel(R); }
    var sp = x.spec, bm = enStats(x), S0 = SPMAP[x.sid], hp = Math.round(bm.maxhp * Math.max(0, Math.min(1, x.hpr || 0)));
    var stats = [['hp', '体力', bm.maxhp], ['atk', '物攻', bm.stats.atk], ['def', '物防', bm.stats.def], ['spa', '特攻', bm.stats.spa], ['spd', '特防', bm.stats.spd], ['spe', '速度', bm.stats.spe]];
    var mx = Math.max.apply(null, stats.slice(1).map(function (q) { return q[2]; }).concat([1]));
    var moves = sp.moves.map(function (n) { var m = M[n]; if (!m) return ''; return '<span class="en-mv" style="--tc:' + (TYPE_COLOR[m.type] || '#888') + '"><b>' + esc(n) + '</b><small>' + m.type + ' · ' + m.cat + (m.power ? ' · ' + m.power : '') + '</small></span>'; }).join('');
    var slots = [0, 1, 2].map(function (s) {
      var q = x.eq[s], I = q && EN.IT[q];
      return q ? '<div class="en-eqs full t' + I.tier + '">' + H.itemIcon(q) + '<div><b>' + esc(I.n) + '</b><small>' + esc(I.d.replace(/^装备：/, '')) + '</small></div><button type="button" class="btn ghost" data-enuq="' + i + '|' + s + '">卸下</button></div>'
        : '<div class="en-eqs empty"><span class="en-eqplus">＋</span><div><b>空装备槽</b><small>' + (x.dead ? '倒下的精灵不能装备' : R.bag.length ? '从下方背包里选一件装上' : '背包里没有装备') + '</small></div></div>';
    }).join('');
    var full = x.eq.length >= 3, bag = R.bag.length ? '<div class="en-eqbag">' + R.bag.map(function (k, b) { var I = EN.IT[k]; return '<div class="en-eqb t' + I.tier + '">' + H.itemIcon(k) + '<div><b>' + esc(I.n) + '</b><small>' + esc(I.d.replace(/^装备：/, '')) + '</small></div><button type="button" class="btn primary" data-enequip="' + b + '|' + i + '"' + (full || x.dead ? ' disabled' : '') + '>装上</button></div>'; }).join('') + '</div>' : '<p class="en-sub">背包里没有闲置的装备。战斗奖励、商店里可以拿到装备。</p>';
    var od = enOrder(R), oi = od.indexOf(i), nav = '<button type="button" class="en-nav" data-enmon="' + od[(oi - 1 + od.length) % od.length] + '" aria-label="上一只">‹</button><button type="button" class="en-nav" data-enmon="' + od[(oi + 1) % od.length] + '" aria-label="下一只">›</button>';
    return '<section class="en-card en-monp"><div class="en-ch"><button type="button" class="en-back" data-enpanel="ros">‹ 名单</button><h3>' + esc(sp.nick) + '</h3><em class="en-cnt">' + (oi + 1) + ' / ' + R.ros.length + '</em>' + nav + '<button type="button" class="en-x" data-enpanel="" aria-label="关闭">✕</button></div>' +
      '<div class="en-cb en-monb"><div class="en-mon-l' + (x.dead ? ' dead' : '') + '"><div class="en-stage" style="--tc:' + (TYPE_COLOR[S0.types[0]] || '#888') + '"><img src="' + esc(sp.img) + '" alt="">' + (x.dead ? '<span class="en-stamp">已倒下</span>' : '') + '</div>' +
        '<div class="en-mon-id"><b>' + esc(sp.nick) + '</b><span>LV' + sp.lv + '</span>' + tchips(S0.types) + '</div>' +
        '<div class="en-hpline"><span>体力</span>' + enHp(x) + '<b>' + hp + ' / ' + bm.maxhp + '</b></div>' +
        '<div class="en-stats">' + stats.slice(1).map(function (q) { return '<span>' + q[1] + '</span><i><em style="width:' + Math.round(q[2] / mx * 100) + '%"></em></i><b>' + q[2] + '</b>'; }).join('') + '</div>' +
        '<h4>技能</h4><div class="en-mvs">' + moves + '</div></div>' +
      '<div class="en-mon-r"><h4>装备 <small>' + x.eq.length + ' / 3</small></h4><div class="en-eqslots">' + slots + '</div><h4>背包里的装备</h4>' + bag + '</div></div></section>';
  }
  // 大地图（2026-11-02，参考杀戮尖塔）：横向，可以拖动；闪烁的节点是现在能走的
  var EN_CX = 116, EN_H = 400;
  function enXY(c, n) { return [60 + c * EN_CX, 34 + n.y * (EN_H - 68)]; }
  function enMapHTML(R) {
    var M = R.map, W = 60 * 2 + (M.cols.length - 1) * EN_CX, lines = '', nodes = '', tr = R.trail || [];
    M.links.forEach(function (L, c) { L.forEach(function (js, i) { js.forEach(function (j) {
      var p = enXY(c, M.cols[c][i]), q = enXY(c + 1, M.cols[c + 1][j]), on = tr[c] === i && tr[c + 1] === j;
      lines += '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '" class="' + (on ? 'on' : '') + '"/>';
    }); }); });
    M.cols.forEach(function (col, c) { col.forEach(function (n, i) {
      var p = enXY(c, n), N = EN.NODE[n.t], boss = n.t === 'boss', cls = 'en-mn ' + n.t;
      var canGo = !R.pend && !R.cur && c === R.n && R.next && R.next.indexOf(i) >= 0;
      if (tr[c] === i && c < R.n) cls += ' done'; else if (R.cur && c === R.n && R.pos === i) cls += ' cur'; else if (canGo) cls += ' go'; else if (c < R.n) cls += ' past';
      nodes += '<g class="' + cls + '"' + (canGo ? ' data-engo="' + i + '"' : '') + ' transform="translate(' + p[0] + ',' + p[1] + ')"><title>' + N.n + '</title><circle r="' + (boss ? 34 : 21) + '"/><text dy="' + (boss ? 10 : 7) + '" font-size="' + (boss ? 28 : 19) + '">' + N.ic + '</text></g>';
    }); });
    return '<div class="en-mapw" id="en-mapw"><svg class="en-svg" width="' + W + '" height="' + EN_H + '" viewBox="0 0 ' + W + ' ' + EN_H + '">' + lines + nodes + '</svg></div>' +
      '<div class="en-legend">' + ['battle', 'elite', 'reward', 'shop', 'gamble', 'boss'].map(function (t) { return '<span>' + EN.NODE[t].ic + ' ' + EN.NODE[t].n + '</span>'; }).join('') + '</div>';
  }
  function enMapBind(keep) {
    var w = $('en-mapw'), R = EN.run(acc); if (!w || !R || !R.map) return;
    var col = Math.max(0, Math.min(R.map.cols.length - 1, R.n)), x = 60 + col * EN_CX;
    w.scrollLeft = keep != null && enUi.mapCol === col ? keep : Math.max(0, x - w.clientWidth / 2); enUi.mapCol = col;
    var st = null;
    w.addEventListener('pointerdown', function (e) { st = { x: e.clientX, l: w.scrollLeft, moved: false }; });
    w.addEventListener('pointermove', function (e) { if (!st) return; var dx = e.clientX - st.x; if (Math.abs(dx) > 5) { st.moved = true; w.classList.add('drag'); } if (st.moved) w.scrollLeft = st.l - dx; });
    var end = function () { if (st && st.moved) { enUi.noClick = Date.now(); } st = null; w.classList.remove('drag'); };
    w.addEventListener('pointerup', end); w.addEventListener('pointerleave', end); w.addEventListener('pointercancel', end);
  }
  // 道具面板（2026-11-02 改）：能力 / 消耗品 / 装备三个分页，左边列表，右边介绍；装备可以直接选精灵装上、卸下
  function enBagPanel(R) {
    var tab = enUi.btab || 'abil', list = [];
    if (tab === 'abil') list = R.abil.map(function (k) { return { id: 'a:' + k, k: k }; });
    else if (tab === 'cons') list = Object.keys(R.cons).map(function (k) { return { id: 'c:' + k, k: k, n: R.cons[k] }; });
    else { list = R.bag.map(function (k, b) { return { id: 'b:' + b, k: k, b: b }; }); R.ros.forEach(function (x, ri) { x.eq.forEach(function (k, si) { list.push({ id: 'e:' + ri + ':' + si, k: k, ri: ri, si: si }); }); }); }
    var sel = list.filter(function (x) { return x.id === enUi.bsel; })[0] || list[0];
    var tabs = '<div class="en-btabs">' + [['abil', '能力', R.abil.length], ['cons', '消耗品', Object.keys(R.cons).reduce(function (n, k) { return n + R.cons[k]; }, 0)], ['equip', '装备', R.bag.length + R.ros.reduce(function (n, x) { return n + x.eq.length; }, 0)]].map(function (t) { return '<button type="button" class="en-btab' + (t[0] === tab ? ' on' : '') + '" data-enbtab="' + t[0] + '">' + t[1] + ' <i>' + t[2] + '</i></button>'; }).join('') + '</div>';
    var left = list.length ? list.map(function (x) { var I = EN.IT[x.k]; return '<button type="button" class="en-bl' + (sel && x.id === sel.id ? ' on' : '') + '" data-enbsel="' + x.id + '">' + H.itemIcon(x.k) + '<span><b class="t' + I.tier + '">' + esc(I.n) + '</b><small>' + (x.n > 1 ? '×' + x.n : x.ri != null ? '装备在 ' + esc(R.ros[x.ri].spec.nick) + ' 身上' : x.b != null ? '背包中' : EN.TIER_NAME[I.tier]) + '</small></span></button>'; }).join('') : '<p class="hint">' + ({ abil: '还没有能力。', cons: '没有消耗品。', equip: '没有装备。' })[tab] + '</p>';
    var right = '';
    if (sel) {
      var I = EN.IT[sel.k];
      right = '<div class="en-bd-h">' + H.itemIcon(sel.k) + '<div><b class="t' + I.tier + '">' + esc(I.n) + '</b><small>' + EN.TIER_NAME[I.tier] + ' · ' + EN.KIND_NAME[I.kind] + (sel.n ? ' · 持有 ' + sel.n : '') + '</small></div></div><p class="en-bd-d">' + esc(I.d) + '</p>';
      if (sel.b != null) {
        var ok = R.ros.map(function (x, ri) { return { x: x, ri: ri }; }).filter(function (o) { return !o.x.dead; });
        right += '<h4>装备给</h4><div class="en-eqto">' + ok.map(function (o) { var full = o.x.eq.length >= 3; return '<button type="button" class="en-eqm"' + (full ? ' disabled title="装备槽已满"' : ' data-enequip="' + sel.b + '|' + o.ri + '"') + '><img src="' + esc(o.x.spec.img) + '" alt=""><b>' + esc(o.x.spec.nick) + '</b><small>' + o.x.eq.length + ' / 3</small></button>'; }).join('') + '</div>';
      } else if (sel.ri != null) right += '<p class="hint">装备在 ' + esc(R.ros[sel.ri].spec.nick) + ' 身上。</p><button type="button" class="btn" data-enuq="' + sel.ri + '|' + sel.si + '">卸下</button>';
    }
    return '<section class="en-card en-bag"><div class="en-ch"><span>🎒</span><h3>道具</h3><button type="button" class="en-x" data-enpanel="" aria-label="关闭">✕</button></div><div class="en-cb">' + tabs + '<div class="en-bwrap"><div class="en-blist">' + left + '</div><div class="en-bdet">' + (right || '<p class="hint">选择左边的道具查看介绍。</p>') + '</div></div></div></section>';
  }
  function enPrep(R) {
    var C = R.cur, live = R.ros.map(function (x, i) { return x.dead ? -1 : i; }).filter(function (i) { return i >= 0; });
    enUi.line = enUi.line.filter(function (i) { return live.indexOf(i) >= 0; });
    var ck = R.st + ':' + R.n; if (enUi.lineFor !== ck) { enUi.lineFor = ck; enUi.step = 'pick'; if (!enUi.line.length && R.lastLine) enUi.line = R.lastLine.filter(function (i) { return live.indexOf(i) >= 0; }).slice(0, EN.LINE_MAX); if (!enUi.line.length) enUi.line = live.slice().sort(function (a, b) { return (R.ros[b].hpr || 0) - (R.ros[a].hpr || 0); }).slice(0, EN.LINE_MAX); }
    if (!enUi.line.length) enUi.step = 'pick';
    return '<section class="en-card en-prep ' + C.t + '"><div class="en-ch"><span>' + EN.NODE[C.t].ic + '</span><h3>' + EN.NODE[C.t].n + '</h3><em class="en-cnt">敌人 ' + C.foes.length + ' 只</em><button type="button" class="en-back" data-enhide="1">收起 ▾</button></div><div class="en-cb"><div class="en-foes">' + C.foes.map(function (f) {
      var bt = EN.buffText(f.boss);
      return '<div class="en-foe"><img src="' + esc(f.img) + '" alt=""><div><b>' + esc(f.nick) + '</b><small>' + (f.lv > 100 ? 'LV.??' : 'LV' + f.lv) + (f.maxhp ? ' · 体力 ' + fmt(f.maxhp) : f.hpMul ? ' · 体力 ×' + f.hpMul : '') + '</small>' + tchips(SPMAP[f.id].types) + '<div class="en-buffs">' + (bt.length ? bt.map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('') : '<span class="none">没有增益</span>') + '</div></div></div>';
    }).join('') + '</div>' + (enUi.step === 'order'
      // 第二步：拖动调整出战顺序（2026-11-02）
      ? '<h4>出战顺序 <span class="hint">按住拖动、或点 ‹ › 调整，排在第一个的就是首发</span></h4><ol class="lu-list" id="en-order">' + enUi.line.map(function (i, k) { var x = R.ros[i], n = enUi.line.length;
          return '<li class="lu-card' + (k ? '' : ' lead') + '" data-k="' + i + '"><span class="lu-no">' + (k ? '第 ' + (k + 1) + ' 位' : '首发') + '</span><img src="' + esc(x.spec.img) + '" alt="" draggable="false"><b>' + esc(x.spec.nick) + '</b><small>LV' + x.spec.lv + ' · 体力 ' + Math.round((x.hpr || 0) * 100) + '%</small>' + tchips(SPMAP[x.sid].types) +
            '<span class="tp-btns">' + (k ? '<button type="button" class="btn ghost lu-lead" data-enmv="-1" data-k2="' + i + '" aria-label="往前挪">‹</button><button type="button" class="btn ghost lu-lead" data-enlead="' + i + '">设为首发</button>' : '') + (k < n - 1 ? '<button type="button" class="btn ghost lu-lead" data-enmv="1" data-k2="' + i + '" aria-label="往后挪">›</button>' : '') + '</span></li>'; }).join('') + '</ol>' +
        '</div><div class="en-cf"><button type="button" class="btn ghost" data-enstep="pick">重新选择</button><button type="button" class="btn primary big" data-enfight="1">开战</button></div></section>'
      // 第一步：选出战的精灵
      : '<h4>选择出战的精灵 <span class="hint">已选 ' + enUi.line.length + ' / ' + EN.LINE_MAX + '</span></h4><div class="en-roster">' + enOrder(R).map(function (i) { return enRosCard(R.ros[i], i, R, 'line'); }).join('') + '</div>' +
        '</div><div class="en-cf"><button type="button" class="btn ghost" data-enreset="1"' + (enUi.line.length ? '' : ' disabled') + '>重置</button><button type="button" class="btn primary big" data-enstep="order"' + (enUi.line.length ? '' : ' disabled') + '>确认</button></div></section>');
  }
  function enEvent(R, P) {
    var N = EN_NPC[P.k], img = CHARS[N[1]] || '', body = '', btns = '';
    if (P.k === 'vanber') { var T = EN.VB_TALK[P.i]; body = '<p>在走廊里遇到了 Vanber。</p><p class="en-say">「' + esc(T.q) + '」</p>'; btns = T.o.map(function (o, k) { return '<button type="button" class="btn" data-enev="' + k + '">' + esc(o[0]) + '</button>'; }).join(''); }
    else if (P.k === 'threego') { body = '<p>Threego 拦住了你，眼睛红红的。</p><p class="en-say">「你……有没有点点的消息？' + esc(EN.PLANETS[P.ans].hint) + '你觉得他会在哪？」</p>'; btns = P.two.map(function (pi, k) { return '<button type="button" class="btn" data-enev="' + k + '">' + esc(EN.PLANETS[pi].n) + '</button>'; }).join(''); }
    else if (P.k === 'bttp') { img = CHARS.bttp || img; body = '<p>Bttp 在补给站的长椅上睡得正香，怀里抱着一个鼓鼓的箱子。</p>' + (P.tries ? '<p>已经叫了 ' + P.tries + ' 次' + (P.got.length ? '，得到了 ' + P.got.map(function (k) { return enIt(k); }).join('') : '，他翻了个身……') + '</p>' : ''); btns = '<button type="button" class="btn primary" data-enev="0">尝试叫醒他</button><button type="button" class="btn ghost" data-enev="1">直接开溜</button>'; }
    else { body = '<p>Cumber 通过通讯器联系了你。</p><p class="en-say">「前面的路不好走，我让我的伙伴给你一点祝福吧。选一个。」</p>'; btns = '<button type="button" class="btn" data-enev="0">戈尔贡的祝福</button><button type="button" class="btn" data-enev="1">坎克托斯的祝福</button>'; }
    return '<section class="en-card en-ev"><div class="en-evpic"><img class="en-npc" src="' + img + '" alt=""></div><div class="en-evt"><h3>' + N[0] + '</h3>' + body + '<div class="en-evbtn">' + btns + '</div></div></section>';
  }
  function enEndMsg(e) {
    if (!e) return;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'en-end';
    d.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true" style="max-width:440px"><span class="step">无尽作战 · 结算</span><h2>' + (e.cleared ? '通关难度 ' + e.d + '！' : '作战结束') + '</h2>' +
      '<p>走到第 ' + e.p + ' 关（完成 ' + e.sc + ' 个大关卡）。</p><p>获得 <b>' + fmt(e.exp) + '</b> 累积经验、<b>' + fmt(e.tok) + '</b> 无尽代币。</p>' + (e.unlock ? '<p class="red">解锁了难度 ' + (e.d + 1) + '！</p>' : '') +
      '<div class="soc-foot"><button type="button" class="btn primary" data-enx="1">好的</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (ev) { if (ev.target === d || ev.target.closest('[data-enx]')) d.remove(); });
  }
  function enTx(op, args, then) { txRun(op, args || {}, function (r) { if (then) then(r); renderEndless(); renderRes && renderRes(); if (r && r.end) enEndMsg(r.end); }); }
  function enFight() {
    var R = EN.run(acc); if (!R || !R.cur) return;
    enModalOff();
    pveRemote('endless', { line: enUi.line.slice() }, { bg: BG.mayar || BG.bridge_p, back: '无尽作战' }, function (e, res) {
      var r = e && e.rep;
      ex.fighting = false; document.body.classList.remove('story-fight');
      ex.view = 'endless'; ex.planet = 'jingchu';
      $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
      renderTop(); syncBattle(); renderEndless(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
      if (r && r.res === 'win') toast('胜利！获得 ' + r.gems + ' 颗无尽宝石' + (r.lost && r.lost.length ? '，有 ' + r.lost.length + ' 只精灵倒下了（装备已回到背包）' : '') + '。');
      else if (r && r.back) toast('作战失败……回到了这个大关卡的起点。');
      else if (res === 'void') toast('这场对战作废了。');
    });
  }
  $('pg-explore').addEventListener('click', function (e) { if (ex.view === 'endless') enClick(e); });
  function enClick(e) {
    var b = e.target.closest('button, [data-enr], [data-engo]'); if (!b || b.disabled) return;
    if (b.dataset.engo != null && enUi.noClick && Date.now() - enUi.noClick < 300) return;   // 刚拖动完地图，不算点击
    var R = EN.run(acc), D = b.dataset;
    if (b.id === 'en-back') { enModalOff(); enUi.panel = null; ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (D.end) { enUi.d = +D.end; renderEndless(); return; }
    if (D.enpk) { var u = +D.enpk; if (enUi.pick[u]) delete enUi.pick[u]; else if (Object.keys(enUi.pick).length < EN.ROSTER_MAX) enUi.pick[u] = 1; else toast('最多选 ' + EN.ROSTER_MAX + ' 只'); renderEndless(); return; }
    if (D.enauto) { enUi.pick = {}; acc.mons.slice().sort(function (a, b2) { return b2.lv - a.lv; }).slice(0, EN.ROSTER_MAX).forEach(function (m) { enUi.pick[m.u] = 1; }); renderEndless(); return; }
    if (D.enclr) { enUi.pick = {}; renderEndless(); return; }
    if (D.enstart) { var us = Object.keys(enUi.pick).map(Number).filter(function (u) { return mon(u); }); enUi.line = []; enUi.eqB = null; enTx('enStart', { d: enUi.d, us: us }); return; }
    if (D.entok) { enTx('enShop', { k: D.entok }, function () { toast('兑换成功：' + SUMMON.INS[D.entok].name); }); return; }
    if (!R) return;
    if (D.enquit) {
      var dd = document.createElement('div'); dd.className = 'soc-dlg';
      dd.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true" style="max-width:420px"><span class="step">结束作战</span><h2>现在结束并结算吗？</h2><p>按这次走到的最远进度（第 ' + Math.max(R.prog || 0, EN.prog(R)) + ' 关）发放经验和无尽代币，结束后不能继续。</p><div class="soc-foot"><button type="button" class="btn ghost" data-x="1">再想想</button><button type="button" class="btn primary" data-ok="1">结束作战</button></div></div>';
      document.body.appendChild(dd);
      dd.addEventListener('click', function (ev) { if (ev.target === dd || ev.target.closest('[data-x]')) { dd.remove(); return; } if (ev.target.closest('[data-ok]')) { dd.remove(); enTx('enQuit'); } });
      return;
    }
    if (D.enev != null) { var P0 = R.pend; enTx('enEv', { o: +D.enev }, function (r) {
      if (!r) return;
      if (P0.k === 'vanber') toast('Vanber 好感 +' + r.vb + (r.vbGift ? '。好感满了！Vanber 送了你 500 颗无尽宝石和「' + EN.IT[r.vbGift].n + '」' : ''));
      else if (P0.k === 'threego') toast(r.right ? 'Threego：「真的吗？我也这么觉得！」她塞给你 300 颗无尽宝石。' : 'Threego：「……我觉得不是那里。」她难过地跑开了，大家都有点受伤。');
      else if (P0.k === 'bttp') toast(r.left ? '你悄悄溜走了。' : r.got ? 'Bttp 迷迷糊糊地塞给你「' + EN.IT[r.got].n + '」' + (r.woke ? '，然后彻底醒了，伸着懒腰走开了。' : '，又睡着了。') : 'Bttp 嘟囔了一句「神还在思考」，又睡着了……');
      else if (P0.k === 'cumber') toast('获得「' + EN.IT[r.got].n + '」，已放进装备背包。');
    }); return; }
    if (D.engo != null) { enUi.line = []; enUi.hide = false; enUi.panel = null; enTx('enGo', { i: +D.engo }); return; }
    if (D.enpick != null) { enTx('enPick', { i: +D.enpick }, function (r) { if (r && r.stage) toast('进入第 ' + (r.stage + 1) + ' 个大关卡！'); }); return; }
    if (D.enskip) { enTx('enPick', { skip: 1 }, function (r) { if (r && r.stage) toast('进入第 ' + (r.stage + 1) + ' 个大关卡！'); }); return; }
    if (D.enbuy != null) { enTx('enBuy', { i: +D.enbuy }); return; }
    if (D.enleave) { enTx('enLeave'); return; }
    if (D.enchat) { enVbChat(); return; }
    if (D.enuq) { var q = D.enuq.split('|'); e.stopPropagation(); enUi.bsel = null; enTx('enUneq', { r: +q[0], s: +q[1] }); return; }
    if (D.enfight) { enFight(); return; }
    if (D.enpanel != null) { enUi.panel = D.enpanel || null; renderEndless(); return; }
    if (D.enmon != null) { enUi.monI = +D.enmon; renderEndless(); return; }
    if (D.enbtab) { enUi.btab = D.enbtab; enUi.bsel = null; renderEndless(); return; }
    if (D.enbsel) { enUi.bsel = D.enbsel; renderEndless(); return; }
    if (D.enequip) { var qq = D.enequip.split('|'); enUi.bsel = null; enTx('enEquip', { b: +qq[0], r: +qq[1] }); return; }
    if (D.enreset) { enUi.line = []; renderEndless(); return; }
    if (D.enmv) { var L0 = enUi.line, j0 = L0.indexOf(+D.k2), j1 = j0 + (+D.enmv); if (j0 >= 0 && j1 >= 0 && j1 < L0.length) { L0[j0] = L0[j1]; L0[j1] = +D.k2; } renderEndless(); return; }
    if (D.enlead) { var kk = +D.enlead; enUi.line = [kk].concat(enUi.line.filter(function (x) { return x !== kk; })); renderEndless(); return; }
    if (D.enstep) { enUi.step = D.enstep; renderEndless(); return; }
    if (D.enhide) { enUi.hide = true; renderEndless(); return; }
    if (D.enshow) { enUi.hide = false; renderEndless(); return; }
    if (D.enr != null) {
      var ri = +D.enr, x = R.ros[ri]; if (!x) return;
      if (enUi.panel === 'ros' && (!R.cur || enUi.hide)) { enUi.panel = 'mon'; enUi.monI = ri; renderEndless(); return; }
      if (x.dead) return;
      if (enUi.panel === 'ros' && (!R.cur || enUi.hide)) { enUi.panel = 'mon'; enUi.monI = ri; renderEndless(); return; }
      if (R.cur && !R.pend && enUi.step !== 'order') { var k = enUi.line.indexOf(ri); if (k >= 0) enUi.line.splice(k, 1); else if (enUi.line.length < EN.LINE_MAX) enUi.line.push(ri); else toast('最多派 ' + EN.LINE_MAX + ' 只'); renderEndless(); }
    }
  }
  function enVbChat() {
    txRun('enChat', { peek: 1 }, function (r) {
      var T = EN.VB_SHOP[r.q]; if (!T) return;
      var d = document.createElement('div'); d.className = 'soc-dlg';
      d.innerHTML = '<div class="soc-box en-ev" role="dialog" aria-modal="true" style="max-width:520px"><img class="en-npc" src="' + CHARS.vanber_smile + '" alt=""><div><h3>Vanber</h3><p class="en-say">' + esc(T.q) + '</p><div class="en-evbtn">' + T.o.map(function (o, k) { return '<button type="button" class="btn" data-vbo="' + k + '">' + esc(o[0]) + '</button>'; }).join('') + '</div></div></div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (ev) {
        if (ev.target === d) { d.remove(); return; }
        var b = ev.target.closest('[data-vbo]'); if (!b) return; d.remove();
        enTx('enChat', { o: +b.dataset.vbo }, function (r2) { if (r2) toast('Vanber 好感 +' + r2.vb + (r2.vbGift ? '。好感满了！Vanber 送了你 500 颗无尽宝石和「' + EN.IT[r2.vbGift].n + '」' : '')); });
      });
    });
  }
  function renderSummon() {
    var tab = ex.sumTab || 'saint', S = sumRec(), B = SUMMON.banner(Date.now()), I = acc.items, core = I.g_core || 0, fp = I.fPt || 0, tok = I.sumTok || 0, today = ACC.dayStr(Date.now());
    var tabs = '<div class="fparts forge-tabs" role="tablist">' + [['saint', '圣晶石召唤'], ['friend', '友情点召唤'], ['shop', '召唤代币商店']].map(function (t) { var on = t[0] === tab; var dt = (t[0] === 'saint' && (S.free | 0) > 0) || (t[0] === 'friend' && S.fsDay !== today); return '<button type="button" role="tab" class="tab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-sumtab="' + t[0] + '" style="position:relative">' + t[1] + (dt ? '<i class="red-dot" aria-label="有免费召唤"></i>' : '') + '</button>'; }).join('') + '</div>';
    var body = '';
    if (tab === 'saint') {
      var upName = SPMAP[B.up].evo[0].n, left = SUMMON.PITY_HARD - (S.pity || 0), toFree = SUMMON.FREE_EVERY - ((S.n || 0) % SUMMON.FREE_EVERY);
      // 横幅（2026-11-01）：UP 精灵拉近成上半身特写居中，稀有精灵的一阶错落地飘在两边（前后有远近）
      var POS = [['l', 1, 22, 100, -8, 0], ['r', 1, 26, 104, 8, 0], ['l', 15, 4, 62, 10, 1], ['r', 16, 6, 64, -10, 1], ['l', 24, 96, 76, -4, 0], ['r', 25, 98, 74, 5, 0], ['l', 8, 128, 56, 6, 1], ['r', 9, 130, 56, -6, 1]];
      var side = SUMMON.rareSids().map(function (s, i) { var P = POS[i % POS.length]; return '<img class="sb-s' + (P[5] ? ' back' : '') + '" style="' + (P[0] === 'l' ? 'left' : 'right') + ':' + P[1] + '%;top:' + P[2] + 'px;--sz:' + P[3] + 'px;--rot:' + P[4] + 'deg;animation-delay:-' + (i * 0.7).toFixed(1) + 's" src="' + formImg(SPMAP[s], 0) + '" alt="' + esc(SPMAP[s].evo[0].n || SPMAP[s].name) + '">'; }).join('');
      var spark = [[12, 30], [30, 70], [44, 18], [58, 60], [72, 24], [86, 66], [20, 120], [80, 130], [50, 8], [64, 110]].map(function (q, i) { return '<i class="sb-spark" style="left:' + q[0] + '%;top:' + q[1] + 'px;animation-delay:' + (i * 0.37).toFixed(2) + 's"></i>'; }).join('');
      body = '<section class="sum-banner saint"><div class="sb-glow"></div><div class="sb-rays"></div>' + spark + side + '<img class="sb-c" src="' + SPRITES[B.up] + '" alt="' + esc(SPMAP[B.up].name) + '"><div class="sb-band"></div>' +
        '<div class="sb-ins">' + B.ins.map(function (k) { return '<span title="' + esc(SUMMON.INS[k].name) + '">' + H.itemIcon(k) + '</span>'; }).join('') + '</div>' +
        '<div class="sb-txt"><span class="sb-kicker">期间限定 · UP</span><h3>圣晶石召唤</h3><p><b>' + esc(upName) + '</b>（' + esc(SPMAP[B.up].name) + '一系）的精元 ' + Math.round(SUMMON.UP_RATE * 100) + '% · 第 ' + SUMMON.PITY_HARD + ' 次必出</p><p class="sb-sub">每次召唤送 ' + SUMMON.TOK_EACH + ' 召唤代币，抽到 UP 再送 ' + SUMMON.TOK_UP + ' · 每召唤 ' + SUMMON.FREE_EVERY + ' 次送 1 次免费召唤</p></div></section>' +
        '<div class="sum-stat"><span>' + H.itemIcon('g_core') + '圣晶石 <b>' + fmt(core) + '</b></span><span>' + H.itemIcon('sumTok') + '召唤代币 <b>' + fmt(tok) + '</b></span><span>距离 UP 保底还有 <b>' + left + '</b> 次（下次 UP 概率 ' + Math.round(SUMMON.upChance(S.pity || 0) * 100) + '%）</span><span>再召唤 <b>' + toFree + '</b> 次送 1 次免费召唤</span></div>' +
        '<div class="sum-btns"><button type="button" class="sum-btn" data-sumgo="saint|1"' + (core >= SUMMON.SAINT_COST ? '' : ' disabled') + '><b>召唤 ×1</b><small>' + H.itemIcon('g_core') + '消耗 圣晶石 ' + SUMMON.SAINT_COST + '</small></button>' +
        '<button type="button" class="sum-btn ten" data-sumgo="saint|10"' + (core >= SUMMON.SAINT_COST * 10 ? '' : ' disabled') + '><b>召唤 ×10</b><small>' + H.itemIcon('g_core') + '消耗 圣晶石 ' + SUMMON.SAINT_COST * 10 + '</small></button>' +
        (S.free > 0 ? '<button type="button" class="sum-btn free" data-sumgo="saint|1|free"><b>免费召唤</b><small>剩余 ' + S.free + ' 次</small></button>' : '') + '</div>' + sumRates(B);
    } else if (tab === 'friend') {
      var fUsed = S.fsDay === today;
      body = '<section class="sum-banner friend"><div class="sb-glow"></div><div class="sb-pile">' + ['exp', 'floraJade', 'kbDrop', 'g_sand', 'fruit2', 'ins_atk1'].map(function (k) { return '<span>' + H.itemIcon(k) + '</span>'; }).join('') + '</div>' +
        '<div class="sb-txt"><span class="sb-kicker">常驻</span><h3>友情点召唤</h3><p>经验、星球特产、星砂、精灵道具和常规刻印</p><p class="sb-sub">每天第一次十连免费 · 友情点：社交里给好友送经验（每位好友每天一次，双方各 200，自己每天最多 2000）、借好友的助战精灵（双方各 100，每天最多 1000）</p></div></section>' +
        '<div class="sum-stat"><span>' + H.itemIcon('fPt') + '友情点 <b>' + fmt(fp) + '</b></span><span>今日免费十连：<b>' + (fUsed ? '已使用' : '可用') + '</b></span></div>' +
        '<div class="sum-btns">' + (fUsed ? '' : '<button type="button" class="sum-btn free" data-sumgo="friend|10|free"><b>免费十连</b><small>每天一次</small></button>') +
        '<button type="button" class="sum-btn" data-sumgo="friend|1"' + (fp >= SUMMON.FRIEND_COST ? '' : ' disabled') + '><b>召唤 ×1</b><small>' + H.itemIcon('fPt') + '消耗 友情点 ' + SUMMON.FRIEND_COST + '</small></button>' +
        '<button type="button" class="sum-btn ten" data-sumgo="friend|10"' + (fp >= SUMMON.FRIEND_COST * 10 ? '' : ' disabled') + '><b>召唤 ×10</b><small>' + H.itemIcon('fPt') + '消耗 友情点 ' + fmt(SUMMON.FRIEND_COST * 10) + '</small></button></div>' + fRates();
    } else {
      var pick = B.ins.indexOf(ex.sumIns) >= 0 ? ex.sumIns : B.ins[0];
      var card = function (T, title, desc, extra) {
        var lim = T.month ? T.month - SUMMON.boughtM(acc, T.k, Date.now()) : null, ok = tok >= T.price && (lim == null || lim > 0);
        return '<article class="shop-it"><span class="tape r"></span>' + H.itemIcon(T.k === 'core' ? 'g_core' : T.k === 'leaf' ? B.leaf : pick) + '<div class="si-txt"><b>' + title + '</b><p class="hint">' + desc + '</p>' + (extra || '') + (lim != null ? '<p class="si-own">本月还能兑换 <b>' + lim + '</b> / ' + T.month + ' 次</p>' : '') + '</div>' +
          '<div class="si-buy"><span class="si-price">' + H.itemIcon('sumTok') + T.price + '</span><button type="button" class="btn primary" data-sumbuy="' + T.k + '"' + (ok ? '' : ' disabled') + '>' + (lim === 0 ? '本月已兑完' : tok >= T.price ? '兑换' : '代币不够') + '</button></div></article>';
      };
      var Ts = {}; SUMMON.TOK_SHOP.forEach(function (T) { Ts[T.k] = T; });
      body = '<div class="sum-stat"><span>' + H.itemIcon('sumTok') + '召唤代币 <b>' + fmt(tok) + '</b></span><span class="hint">圣晶石召唤每次送 ' + SUMMON.TOK_EACH + ' 个，抽到 UP 再送 ' + SUMMON.TOK_UP + ' 个</span></div><div class="shop-grid">' +
        card(Ts.core, '圣晶石 ×1', '每月限 30 次。') +
        card(Ts.leaf, itemName(B.leaf) + ' ×100', esc(shortD(USE_ITEMS[B.leaf]))) +
        card(Ts.ins, '限定刻印 · 自选一个', '每月限 5 次。选一个当期限定刻印：', '<p class="gxc-row">' + B.ins.map(function (k) { return '<button type="button" class="btn ' + (k === pick ? 'primary' : 'ghost') + ' gx-chip" data-sumins="' + k + '" title="' + esc(SUMMON.insDesc(k)) + '">' + esc(SUMMON.INS[k].name) + '</button>'; }).join('') + '</p><p class="hint">' + esc(SUMMON.insDesc(pick)) + '</p>') + '</div>';
    }
    $('pg-explore').innerHTML = exHead('') + '<div class="crumb"><button type="button" class="btn ghost" id="sum-back">‹ 返回飞船终端</button><b>荆楚号 · 召唤</b></div>' + tabs + body;
  }
  $('pg-explore').addEventListener('click', function (e) {
    if (ex.view !== 'summon') return;
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'sum-back') { ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.sumtab) { ex.sumTab = b.dataset.sumtab; renderSummon(); return; }
    if (b.dataset.sumgo) { if (b.disabled) return; var q = b.dataset.sumgo.split('|'); doSummon(q[0], +q[1], q[2] === 'free'); return; }
    if (b.dataset.sumins) { ex.sumIns = b.dataset.sumins; renderSummon(); return; }
    if (b.dataset.sumbuy) {
      if (b.disabled) return; var k = b.dataset.sumbuy, B = SUMMON.banner(Date.now()), pk = B.ins.indexOf(ex.sumIns) >= 0 ? ex.sumIns : B.ins[0];
      txRun('sumShop', { k: k, n: 1, ins: pk }, function () { renderRes(); renderSummon(); toast('兑换成功：' + (k === 'core' ? '圣晶石 ×1' : k === 'leaf' ? itemName(B.leaf) + ' ×100' : SUMMON.INS[pk].name) + '，已放入储存箱。'); });
    }
  });
  /* 友情点：服务器记下的友情点（送经验、借助战）和好友送来的经验，定时领取 */
  var fpBusy = false, fpAt = 0;
  function fpClaimCheck(force) {
    if (fpBusy || !ready() || !bsOnline() || ex.fighting || ($('battle') && !$('battle').hidden)) return;
    if (!force && Date.now() - fpAt < 60000) return;
    fpBusy = true; fpAt = Date.now();
    txRun('fpClaim', {}, function (r) {
      fpBusy = false; if (!r.fp && !r.exp) return; renderRes();
      var who = (r.gifts || []).map(function (g) { return g.name || g.user; });
      toast((who.length ? who.slice(0, 3).join('、') + (who.length > 3 ? ' 等' : '') + ' 送给你 ' + fmt(r.exp) + ' 经验！' : '') + '获得 ' + fmt(r.fp) + ' 友情点。');
    }, function () { fpBusy = false; });
  }
  window.HS_FPCLAIM = function () { setTimeout(function () { fpClaimCheck(true); }, 300); };
  setInterval(fpClaimCheck, 5000);
  /* ---------- 助战回报（2026-10-20）：上线时领取离线期间好友借用自己助战的记录，每次 1000 能量 + 1000 经验 ---------- */
  var HELP_RW = GROW.HELP_RW, helpClaimed = false, helpBusy = false;
  function helpClaimCheck() {
    if (ex.baseEdit || helpClaimed || helpBusy || !ready() || !bsOnline() || ex.fighting || ex.view === 'vn' || ($('battle') && !$('battle').hidden) || document.querySelector('.soc-dlg')) return;
    helpBusy = true;
    txRun('help', {}, function (r) {   // 走交易（grow.js）：借用次数由服务器记，奖励由服务器发
      helpBusy = false; helpClaimed = true;
      var U = (r.uses || []).filter(function (x) { return x.n > 0; }); if (!U.length) return;
      var n = r.n; renderRes();
      var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'help-dlg';
      d.innerHTML = '<div class="soc-box side-new" role="dialog" aria-modal="true" aria-label="助战回报"><span class="tape l"></span><span class="tape r"></span><span class="step">助战回报</span><h2>你不在的时候，有好友借用了你的助战精灵！</h2><ul>' +
        U.map(function (x) { return '<li><b>' + esc(x.name || x.user) + '</b><small>借用了 ' + x.n + ' 次</small></li>'; }).join('') +
        '</ul><p class="hint">每次奖励 ' + fmt(HELP_RW.energy) + ' 能量 + ' + fmt(HELP_RW.exp) + ' 累积经验，共获得 <b>能量 ×' + fmt(HELP_RW.energy * n) + '</b>、<b>累积经验 ×' + fmt(HELP_RW.exp * n) + '</b>。</p>' +
        '<div class="soc-foot"><button type="button" class="btn primary" data-helpx="1">收下</button></div></div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-helpx]')) d.remove(); });
    }, function () { helpBusy = false; });
  }
  setInterval(helpClaimCheck, 3000);
  function coreOpen() { return prog('core').done; }
  function openCore() {
    if (!coreOpen()) { toast('先读完宜昌的支线「三峡能源核心」吧。'); return; }
    var M0 = mineRec(), left = MINE.cap - M0.ex, cu = acc.items.m_cu || 0, fe = acc.items.m_fe || 0;
    lzDlg(['欢迎来到三峡能源核心，我是这里的主人日透骨消。荆楚号上的每一度电，都要从这里过。',
      '最近能源有点紧张：芙罗拉星、坎伯兰星的野外藏着「马亚尔煤炭」和「马亚尔铁矿」，挖回来交给我，我按煤炭 ' + MINE.price.m_cu + '、铁矿 ' + MINE.price.m_fe + ' 能量一块跟你换（每天最多换 ' + fmt(MINE.cap) + ' 能量，今天还能换 ' + fmt(Math.max(0, left)) + '）。',
      !drill() ? '不过钻头可不能随便给人。先过我这一关：' + MINE.quiz + ' 道题，答对 ' + MINE.pass + ' 道就算通过，钻头就一直归你。' : drill().dur >= DRILL_MAX ? '你的钻头状态很好（耐久度 ' + DRILL_MAX + ' / ' + DRILL_MAX + '），去星球上找矿点吧。' : '你的钻头耐久度还剩 ' + drill().dur + ' / ' + DRILL_MAX + '。要修的话，答我 ' + REPAIR.n + ' 道题，对 ' + REPAIR.pass + ' 道就给你修满。',
      '你现在有煤炭 ' + cu + ' 块、铁矿 ' + fe + ' 块。'],
      [['离开', null], ['兑换能量', exchangeOre, !(cu || fe) || left <= 0], !drill() ? ['参加钻头考核', function () { startQuiz(false); }] : ['修复钻头', function () { startQuiz(true); }, drill().dur >= DRILL_MAX]]);
  }
  function exchangeOre() {
    txRun('ore', {}, function (r) {   // 规则在 js/engine/tx.js
      renderRes();
      toast('交出了' + Object.keys(r.used).map(function (k) { return MATS[k].name + ' ×' + r.used[k]; }).join('、') + '，换到能量 ×' + fmt(r.got) + '。今天还能换 ' + fmt(r.left) + '。');
    });
  }
  var REPAIR = { n: 5, pass: 3, hard: 1 };
  function startQuiz(rp) {   // rp：修复钻头（5 题对 3 题）；否则是领钻头的考核（10 题对 7 题）。抽题、判定都由服务器做（js/engine/world.js）
    var B = xcqBank(); if (!B.length) { toast('题库加载失败，刷新一下再试试。'); return; }
    if ($('quiz-dlg')) return;
    txRun('xcq', { a: 'start', rp: !!rp }, function (r) { runQuiz(rp, r.qs.map(function (k) { return B[k]; })); });
  }
  function runQuiz(rp, Qs) {
    var C = rp ? REPAIR : { n: MINE.quiz, pass: MINE.pass, hard: MINE.hard };
    var i = 0, right = 0, wrong = 0, ans = null, showE = false, WRONG_MAX = 3, answers = [], result = null;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'quiz-dlg'; document.body.appendChild(d);
    var title = rp ? '钻头修复' : '钻头考核';
    function submit(tries) {
      txRun('xcq', { a: 'end', ans: answers }, function (r) { result = r; if (r.pass) checkTitles(); draw(); },
        function (err) { if (err === '' && tries < 10) { setTimeout(function () { submit(tries + 1); }, 300); return; } result = { pass: false, err: err || '没能提交答案' }; draw(); });
    }
    function draw() {
      if (i >= Qs.length || (wrong >= WRONG_MAX && ans === null)) {   // 答完，或者错满 3 道直接结束（先让玩家看完第 3 道错题的答案）
        if (!result) {
          if (result === null) { result = false; submit(0); }
          d.innerHTML = '<div class="soc-box quiz-box" role="dialog" aria-modal="true" aria-label="考核结果"><span class="tape l"></span><span class="tape r"></span><h2>正在核对答案……</h2></div>';
          return;
        }
        var ok = !!result.pass;
        d.innerHTML = '<div class="soc-box quiz-box" role="dialog" aria-modal="true" aria-label="考核结果"><span class="tape l"></span><span class="tape r"></span><h2>' + (ok ? (rp ? '修好了！' : '考核通过！') : '没有通过') + '</h2>' +
          '<p class="quiz-score">答对 <b>' + right + '</b> / ' + Qs.length + (wrong >= WRONG_MAX ? '<small>（错满 ' + WRONG_MAX + ' 道，提前结束）</small>' : '') + '</p><p>' + (ok ? (rp ? '日透骨消：「交给我吧……好了，耐久度修满了。」' : '日透骨消：「不错嘛。这把挖矿钻头以后就归你了，拿好。」') + '<br>去芙罗拉星、坎伯兰星的野外找矿点吧，每处矿点每天能挖一次。' : '日透骨消：「' + (wrong >= WRONG_MAX ? '错了 ' + WRONG_MAX + ' 道，这次就到这儿吧。' : '差一点。') + '要答对 ' + C.pass + ' 道、错不超过 ' + (WRONG_MAX - 1) + ' 道才行，再来一次？」') + '</p>' +
          '<div class="soc-foot">' + (ok ? '<button type="button" class="btn primary" data-qx="1">好的</button>' : '<button type="button" class="btn ghost" data-qx="1">下次再来</button><button type="button" class="btn primary" data-qagain="1">重新答题</button>') + '</div></div>';
        return;
      }
      var q = Qs[i], done = ans !== null, good = done && ans === q.a;
      var fb = !done ? '' : '<div class="quiz-fb ' + (good ? 'ok' : 'bad') + '"><b>' + (good ? '✓ 回答正确！' : '✗ 回答错误，正确答案是 ' + 'ABCD'[q.a]) + '</b>' +
        (!good && q.e ? (showE ? '<p class="quiz-exp">' + esc(q.e) + '</p>' : '<button type="button" class="btn ghost" data-qexp="1">查看解析</button>') : '') + '</div>';
      d.innerHTML = '<div class="soc-box quiz-box" role="dialog" aria-modal="true" aria-label="' + title + '"><span class="tape l"></span><span class="tape r"></span><span class="step">' + title + ' · 第 ' + (i + 1) + ' / ' + Qs.length + ' 题 · 已错 ' + wrong + ' / ' + WRONG_MAX + '</span>' +
        '<div class="quiz-bar"><i style="width:' + ((i + (done ? 1 : 0)) / Qs.length * 100) + '%"></i></div><p class="quiz-q">' + (q.s ? '<em class="quiz-tag">' + esc(q.s) + '</em>' : '') + esc(q.q) + '</p>' + (q.img ? '<img class="quiz-img" src="images/quiz/' + q.img + '" alt="题目图">' : '') +
        '<div class="quiz-opts' + (q.o.join('') ? '' : ' fig') + '">' + q.o.map(function (o, k) { var c = !done ? '' : k === q.a ? ' right' : k === ans ? ' wrong' : ' dim'; return '<button type="button" class="quiz-opt' + c + '" data-qo="' + k + '"' + (done ? ' disabled' : '') + '><b>' + 'ABCD'[k] + '</b><span>' + esc(o) + '</span></button>'; }).join('') + '</div>' + fb +
        '<div class="soc-foot"><button type="button" class="btn ghost" data-qx="1">放弃</button>' + (done ? '<button type="button" class="btn primary" data-qnext="1">' + (i + 1 >= Qs.length || wrong >= WRONG_MAX ? '查看结果' : '下一题') + '</button>' : '') + '</div></div>';
    }
    draw();
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-qx]')) { d.remove(); return; }
      if (e.target.closest('[data-qagain]')) { d.remove(); startQuiz(rp); return; }
      if (e.target.closest('[data-qexp]')) { showE = true; draw(); return; }
      if (e.target.closest('[data-qnext]')) { i++; ans = null; showE = false; draw(); return; }
      var o = e.target.closest('[data-qo]'); if (!o || ans !== null || i >= Qs.length) return;
      ans = +o.dataset.qo; answers[i] = ans; if (ans === Qs[i].a) right++; else wrong++; draw();   // 每答一题立刻显示对错
    });
  }
  function coreLogHTML() {
    var M0 = mineRec();
    return '<article class="log-card rice"><span class="tape l"></span><span class="chip log-tag">新活动</span><h3>三峡能源核心 · 星球采矿</h3>' +
      '<p>荆楚号 · 宜昌的能源核心主人<b>日透骨消</b>需要矿石！</p><ol class="rice-steps"><li>到荆楚号 · <b>宜昌</b>的「三峡能源核心」找日透骨消，通过<b>钻头考核</b>（' + MINE.quiz + ' 题答对 ' + MINE.pass + ' 题），领取<b>挖矿钻头</b>（一直有效）。钻头每挖一次掉 1 点耐久，满耐久能挖 ' + DRILL_MAX + ' 次，用旧了回来答 ' + REPAIR.n + ' 题、对 ' + REPAIR.pass + ' 题就能修满。</li>' +
      '<li>在<b>芙罗拉星</b>、<b>坎伯兰星</b>的野外场景里找到<b>马亚尔煤炭</b>、<b>马亚尔铁矿</b>，点一下等 ' + MINE.sec + ' 秒就能挖到。每处矿点每天挖一次。</li>' +
      '<li>把矿石交给日透骨消换能量：煤炭 ' + MINE.price.m_cu + '、铁矿 ' + MINE.price.m_fe + ' 一块，每天最多换 ' + fmt(MINE.cap) + ' 能量。</li></ol>' +
      '<p class="hint">' + (drill() ? '钻头耐久度 ' + drill().dur + ' / ' + DRILL_MAX : '还没领钻头') + ' · 今天已换能量 ' + fmt(M0.ex) + ' / ' + fmt(MINE.cap) + '</p>' +
      (prog('board').done ? '<button type="button" class="btn primary" data-gocore="1">去三峡能源核心</button>' : '') + '</article>';
  }
  /* ---------- 奇声号角 → 塞米 ----------
   * 塞壬一系不会自然出现。击败赫菲一系掉 3–6 片「赫菲角片」（航行日志每天还能领 12–15 片），60 片在冶炼坊合成「奇声号角」。
   * 在坎伯兰星 · 水面的「冥岛」场景吹响号角，场景里会来一只可以捕捉的塞米；和它进入战斗时号角用掉（没打就离开，号角还在）。 */
  var HORN = PVE.HORN;
  function hornMonIn(F, si) { return F.scenes[si] && F.scenes[si].slots.some(function (sl) { return sl.mon && sl.mon.horn && !sl.mon.out; }); }
  // 白之星的冰块（2026-11-01）：每个场景 1% 概率出现，封着一只亚哆；出战配队里同时有草、火、水系精灵才能化开
  function iceHTML(R, F, si) {
    var sc = F.scenes[si]; if (!sc || !sc.ice) return '';
    return '<button type="button" class="wf-node ice-node" data-iceblk="1" style="left:46%;top:72%"><img src="images/items/ice_ancient.webp" alt=""><span>封着精灵的冰块</span></button>';
  }
  function iceBreak(el) {
    var R = regionById(ex.region), F = R && fields[R.id]; if (!F) return;
    if (!teamHasType(['草', '火', '水'])) { toast('冰块冻得太结实了：出战配队里要同时有草系（提供燃料）、火系（点火）、水系（给冰里的精灵降温）精灵。'); return; }
    if (!srvMode()) { toast('需要用服务器网址打开游戏并登录后才能化开冰块。'); return; }
    var sc = F.scenes[F.scene], box = $('wf-scene'); if (el) el.disabled = true;
    var fx = document.createElement('div'); fx.className = 'ice-melt'; fx.innerHTML = '<img src="images/items/ice_ancient.webp" alt=""><i class="im-fire"></i><i class="im-steam"></i><b>草系精灵铺好燃料，火系精灵点火，水系精灵在一旁给冰里的小精灵降温……</b>';
    if (box) box.appendChild(fx);
    setTimeout(function () {
      sc.ice = false; stopField();
      startWildRemote({ ice: 1 }, { sid: 'wild', lv: 20, bg: sc.bg || null, back: R.name, where: '白之星 · ' + R.name + ' · 冰封深处' });
    }, 1900);
  }
  function hornHTML(R, F, si) {
    var sc = F.scenes[si]; if (!sc || sc.bgKey !== HORN.bg || !(acc.items.m_horn > 0) || hornMonIn(F, si)) return '';
    return '<button type="button" class="wf-bowl put" data-horn="1"><span class="wf-bowl-ic" aria-hidden="true">📯</span><span>吹响奇声号角（' + acc.items.m_horn + '）</span></button>';
  }
  function blowHorn() {
    var R = regionById(ex.region), F = R && fields[R.id]; if (!F) return;
    var sc = F.scenes[F.scene]; if (!sc || sc.bgKey !== HORN.bg || !(acc.items.m_horn > 0) || hornMonIn(F, F.scene)) return;
    var sl = sc.slots.filter(function (x) { return !x.mon; })[0] || sc.slots[0];
    var put = function (force) {
      var m = spawnFieldMon(R, sl, force); m.id = ++F.seq; m.horn = true; m.die = Date.now() + 10 * 60000;   // 来了就待 10 分钟
      sl.mon = m; sl.next = 0;
      toast('呜——奇怪的号角声在冥岛上空回荡……水面下传来细细的歌声，一只塞米游了过来！');
      renderField();
    };
    if (srvMode()) {   // 塞米也由服务器刷
      CLOUD.api('POST', '/api/pve', { op: 'wild', kind: 'horn', rid: R.id, si: F.scene, bg: sc.bgKey }).then(function (r) { if (r && r.ok && r.list.length) put({ srv: r.list[0] }); else toast((r && r.error) || '号角没有吹响，稍后再试。'); }).catch(function () { toast('连不上服务器，号角没有吹响。'); });
      return;
    }
    put({ w: { sid: HORN.sid, lv: [HORN.lv, HORN.lv], rate: HORN.rate, tag: '中等', rare: true, w: 0 }, lv: HORN.lv });
  }
  function hornDrop() { return HORN.drop[0] + Math.floor(Math.random() * (HORN.drop[1] - HORN.drop[0] + 1)); }
  function hornDayGot() { return acc.hornDay === dayNum(Date.now()); }
  function hornLogHTML() {
    var f = form({ sid: HORN.sid, lv: HORN.lv }), got = hornDayGot(), have = acc.items.m_hfhorn || 0;
    return '<article class="log-card rice"><span class="tape l"></span><span class="chip log-tag">新活动</span><h3>冥岛的歌声</h3>' +
      '<div class="pick-row"><div class="pick-art rice-art"><img src="' + f.img + '" alt="' + esc(f.name) + '"></div><div class="pick-txt">' +
      '<p>塞米小得像一颗米粒，平时不会出现在野外。不过听到奇怪的号角声，它就会好奇地游过来……</p>' +
      '<ol class="rice-steps"><li>在<b>庞贝星</b>击败野生的<b>赫菲</b>一系，每只掉落 <b>3–6 片赫菲角片</b>；这里每天还能领 <b>12–15 片</b>。</li>' +
      '<li>到黄石 · <b>冶炼坊</b>，用 <b>60 片赫菲角片</b>合成<b>奇声号角</b>。</li>' +
      '<li>在<b>坎伯兰星 · 水面</b>的「<b>冥岛</b>」吹响号角，会来一只可以捕捉的<b>塞米</b>。和它进入战斗时，号角就会用掉。</li></ol>' +
      '</div></div><p class="hint">你现在有赫菲角片 ' + have + ' 片' + (acc.items.m_horn ? '、奇声号角 ' + acc.items.m_horn + ' 个' : '') + '。塞壬一系的隐藏技能用「不化水滴」解锁。</p>' +
      '<button type="button" class="btn' + (got ? '' : ' primary') + '" data-hornday="1"' + (got ? ' disabled' : '') + '>' + (got ? '今天的赫菲角片已经领过了' : '领取今天的赫菲角片') + '</button></article>';
  }
  function putBowl() {
    var R = regionById(ex.region), F = R && fields[R.id];
    if (!F || RICE.regions.indexOf(R.id) < 0 || acc.riceBowl || !(acc.items.c_bowl > 0)) return;
    txRun('bowl', { rid: R.id, si: F.scene }, function () {   // 服务器结算（js/engine/world.js）
      toast('你在这里放下了一碗香喷喷的米饭。等一等，说不定会有爱吃米饭的精灵闻着味道过来……');
      renderField();
    });
  }
  /* ---------- 旅行精灵叶子喵 ----------
   * 全服共享的时间表（按北京时间每个整点算，所有人算出来都一样，不需要服务器）：每小时在某个区域的某个场景停留连续 20 分钟。
   * 每次出现（按小时编号 h 区分）每人只能挑战 1 次（开战就算，acc.travel = { h }），LV30，不能捕捉。
   * 击败：累积经验 ×3000，50% 掉落叶子喵的叶片（5 片在冶炼坊合成精元，精元在神农架 · 精灵保育仓孵化）。 */
  var TRAVEL = PVE.TRAVEL;
  function thash(h) { var x = (h * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995) >>> 0; x ^= x >>> 15; return x >>> 0; }
  function sceneCount(R) { return Math.max(R.pool ? 2 : 1, (R.bgs || []).filter(function (k) { return BG[k]; }).length); }
  function travelAt(now) {
    var h = Math.floor(now / 3600000), s = thash(h + 7919), start = h * 3600000 + (s % 41) * 60000;
    var R = regionById(TRAVEL.regions[(s >>> 8) % TRAVEL.regions.length]);
    return { h: h, start: start, end: start + TRAVEL.dur * 60000, rid: R.id, si: (s >>> 16) % sceneCount(R), spot: TRAVEL.spots[(s >>> 20) % TRAVEL.spots.length], active: now >= start && now < start + TRAVEL.dur * 60000 };
  }
  function travelOpen() { return !!acc && prog('travelcat').done; }   // 读完世界任务「旅行猫」后才会出现
  function travelDone(h) { return !!(acc && acc.travel && acc.travel.h === h); }
  function travelHTML(R, si) {
    var t = travelAt(Date.now()); if (!travelOpen() || !t.active || t.rid !== R.id || t.si !== si) return '';   // 切磋过也不会消失，停留满 20 分钟才走
    var f = form({ sid: TRAVEL.sid, lv: TRAVEL.lv }), met = travelDone(t.h);
    return '<button type="button" class="wf-mon wf-travel' + (met ? ' met' : '') + '" data-travel="' + t.h + '" title="旅行精灵 · ' + esc(f.name) + ' LV' + TRAVEL.lv + '" aria-label="和旅行精灵' + esc(f.name) + '对战" style="left:' + t.spot.x + '%;top:' + t.spot.y + '%;z-index:' + t.spot.y + '"><i class="wf-sh" aria-hidden="true"></i><img src="' + f.img + '" alt=""><span class="wf-tag">' + (met ? '旅行精灵 · 已切磋' : '旅行精灵') + '</span></button>';
  }
  /* ---------- 坎伯兰星保卫战（2026-10-31）：每个整点在坎伯兰星随机几个场景出现奥多亚克（时间表在 js/engine/pve.js 的 kbwAt，全服一样） ---------- */
  var KBW = PVE.KBW;
  function kbwOpenC() { return !!acc && prog('kb6').done; }
  function kbwHTML(R, si) {
    if (!kbwOpenC() || R.planet !== 'kamble') return '';
    return PVE.kbwAt(Date.now(), acc).filter(function (q) { return q.rid === R.id && q.si === si; }).map(function (q) {
      var met = PVE.kbwFought(acc, q.h, q.k);
      return '<button type="button" class="wf-mon wf-odo' + (met ? ' met' : '') + '" data-kbw="' + q.k + '" title="' + esc(q.m.n) + ' LV' + q.m.lv + '" aria-label="迎战' + esc(q.m.n) + '" style="left:' + q.spot.x + '%;top:' + q.spot.y + '%;z-index:' + q.spot.y + '"' + (met ? ' disabled' : '') + '><i class="wf-sh" aria-hidden="true"></i><img src="' + SPRITES.odo + '" alt=""><span class="wf-tag">' + (met ? '已交手 · 整点后会有新的' : esc(q.m.n) + ' · LV' + q.m.lv) + '</span></button>';
    }).join('');
  }
  // 剧情要交的东西（剧本 pay.gather）：在对应区域的场景里出现采集点，点一下 +1（交易 story · gather）
  var SG_SPOTS = { m_sj: { x: 18, y: 84 }, m_xml: { x: 64, y: 86 } };
  function storyGatherList(R) {
    var out = [];
    Object.keys(SCRIPT).forEach(function (site) { if (!SITES[site] || prog(site).done || !unlocked(site)) return; (SCRIPT[site] || []).forEach(function (st) {
      if (!st.pay || st.pay.gather !== R.id) return; var pr = prog(site); if (pr.paid && pr.paid[st.pay.id]) return;
      Object.keys(st.pay.items).forEach(function (k) { out.push({ site: site, k: k, need: st.pay.items[k] }); });
    }); });
    return out;
  }
  // 古代神殿是安静的地方：沙姜、小米辣、奥多亚克都不在这个场景出现（2026-10-31）
  function sceneCalm(R, si) { var bgs = (R.bgs || []).filter(function (k) { return BG[k]; }); return si != null && bgs.length && PVE.KBW.calm.indexOf(bgs[si % bgs.length]) >= 0; }
  function storyGatherHTML(R, si) {
    if (sceneCalm(R, si)) return '';
    return storyGatherList(R).map(function (g) {
      var have = acc.items[g.k] || 0, full = have >= g.need, sp = SG_SPOTS[g.k] || { x: 50, y: 84 };
      return '<button type="button" class="wf-node sg-node' + (full ? ' done' : '') + '" data-sgk="' + g.k + '" data-sgsite="' + g.site + '" style="left:' + sp.x + '%;top:' + sp.y + '%"' + (full ? ' disabled' : '') + '>' + H.itemIcon(g.k) + '<span>' + esc(itemName(g.k)) + ' ' + Math.min(have, g.need) + '/' + g.need + '</span></button>';
    }).join('');
  }
  function storyGather(site, k, el) {
    if (el) el.disabled = true;
    txRun('story', { a: 'gather', site: site, k: k }, function (r) {
      toast('采到了' + itemName(k) + '（' + r.n + ' / ' + r.need + '）' + (r.n >= r.need ? '。够了！' : '。'));
      if (storyGatherList(regionById(ex.region) || {}).every(function (g) { return (acc.items[g.k] || 0) >= g.need; })) setTimeout(function () { toast('沙姜和小米辣都采够了！回到坎伯兰星的「剧情」页，把它们交给辰爷吧。'); }, 1600);
      if (page === 'explore' && ex.view === 'field') renderField();
    }, function (err) { toast(err || '没采到。'); if (el) el.disabled = false; });
  }
  function engageOdo(k) {
    if (ex.fighting) return;
    var R = regionById(ex.region), F = R && fields[R.id], q = PVE.kbwAt(Date.now(), acc).filter(function (x) { return x.k === k; })[0];
    if (!F || !q || q.rid !== R.id || q.si !== F.scene || PVE.kbwFought(acc, q.h, q.k)) { toast('奥多亚克已经潜回深海了。'); renderField(); return; }
    if (!srvMode()) { toast('坎伯兰星保卫战是全服任务，需要用服务器网址打开游戏并登录后才能参与。'); return; }
    var sc = F.scenes[F.scene], P = planetOf(R.planet);
    stopField(); startWildRemote({ odo: k }, { sid: 'odo', lv: q.m.lv, bg: sc.bg || null, back: R.name, where: P.name + ' · ' + R.name + ' · 坎伯兰星保卫战' });
  }
  var KW = { data: null, at: 0, busy: false, err: '' };
  function kbwFetch(force) {
    if (!kbwOpenC() || !pwOnline() || KW.busy) return;
    if (!force && KW.data && Date.now() - KW.at < 30000) return;
    KW.busy = true;
    CLOUD.api('GET', '/api/kbwar').then(function (r) { KW.busy = false; if (r._code === 200) kbwApply(r); else { KW.err = r.error || '读取失败'; kbwRedraw(); } }).catch(function () { KW.busy = false; KW.err = '连不上服务器'; kbwRedraw(); });
  }
  function kbwApply(d) { KW.data = d; KW.at = Date.now(); KW.err = ''; if (d.me > 0 && AWD.kbwMilestones(d.total).some(function (m) { return !(acc.kbwM && acc.kbwM[m]); })) deliverMail(true); kbwRedraw(); }
  function kbwRwText(w) { return '累积经验 ×' + fmt(w.exp) + '、能量 ×' + fmt(w.energy) + '、' + Object.keys(w.items).map(function (k) { return itemName(k) + ' ×' + w.items[k]; }).join('、'); }
  function kbwNext(t) { if (t < 5) return 5; if (t < 20) return 20; if (t < 50) return 50; return (Math.floor(t / 25) + 1) * 25; }
  function kbwPrev(t) { if (t < 5) return 0; if (t < 20) return 5; if (t < 50) return 20; return Math.floor(t / 25) * 25; }
  function kbwInner() {
    var me = acc.kbwK | 0, day = acc.kbwd && acc.kbwd.d === bjDay() ? acc.kbwd.n : 0, now = Date.now(), LA = PVE.kbwAt(now, acc), L = LA.filter(function (q) { return !q.p; }), LP = LA.filter(function (q) { return q.p; });
    var where = function (q) { var R = regionById(q.rid), sc = R.bgs && R.bgs[q.si]; return R.name + (sc && BG_NAME[sc] ? ' · ' + BG_NAME[sc] : ''); };
    var head = '<span class="tape l"></span><span class="tape r"></span><span class="chip log-tag pw-tag">全服任务</span><h3>坎伯兰星保卫战</h3>' +
      '<p>一鸟唤醒了海里所有休眠的奥多亚克。每个整点，坎伯兰星的水面、浅水区、深海区里会随机出现 ' + KBW.per + ' 只不同型号的奥多亚克，每只每人每小时可以迎战一次，不能捕捉。每击破一只，你的经验背包 +' + fmt(KBW.exp) + '，全服进度 +1。每人每天最多计入 ' + KBW.cap + ' 次。</p>' +
      '<div class="pt-bar"><i style="width:' + Math.min(100, me / KBW.need * 100) + '%"></i><em>你的击破 ' + Math.min(me, KBW.need) + ' / ' + KBW.need + (me >= KBW.need ? ' · 第十八段已开放' : ' · 击破 ' + KBW.need + ' 只后开放下一段剧情') + '</em></div>' +
      '<p class="hint">这个小时的奥多亚克（还剩 ' + Math.max(1, Math.ceil((L[0].end - now) / 60000)) + ' 分钟）：' + L.map(function (q) { var R = regionById(q.rid), sc = R.bgs && R.bgs[q.si]; return esc(q.m.n) + '（' + R.name + (sc && BG_NAME[sc] ? ' · ' + BG_NAME[sc] : '') + '）' + (PVE.kbwFought(acc, q.h, q.k) ? ' ✓' : ''); }).join('、') + '</p>' +
      (LP.length ? '<p class="hint"><b>先遣奥多亚克</b>（只有你看得到，不会潜回深海，输了可以再打）：' + LP.map(function (q) { return esc(q.m.n) + '（' + where(q) + '）'; }).join('、') + '</p>' : '');
    if (!pwOnline()) return head + '<p class="hint">坎伯兰星保卫战是全服任务，需要用服务器网址打开游戏并登录后才能参与。</p>';
    var d = KW.data; if (!d) return head + '<p class="hint">' + (KW.err ? esc(KW.err) : '正在读取全服进度……') + '</p>';
    var prev = kbwPrev(d.total), next = kbwNext(d.total), pct = Math.min(100, (d.total - prev) / (next - prev) * 100);
    var ms = [5, 20, 50, 75, 100].filter(function (m) { return m > d.total - 50; }).slice(0, 4); if (ms.indexOf(next) < 0) ms = [next, next + 25, next + 50];
    return head + '<div class="pw-big"><b class="pw-num">' + fmt(d.total) + '</b><span>全服已击破</span></div>' +
      '<div class="pw-bar"><i style="width:' + pct.toFixed(1) + '%"></i><em>' + d.total + ' / ' + next + ' · 下一个全服奖励</em></div>' +
      '<ol class="pw-ms">' + ms.map(function (m) { var ok = d.total >= m; return '<li class="' + (ok ? 'ok' : '') + '"><b>' + m + ' 只</b><span>' + kbwRwText(AWD.kbwReward(m)) + '</span><em>' + (ok ? (d.me > 0 ? '已发放' : '已达成') : '未达成') + '</em></li>'; }).join('') + '</ol>' +
      '<p class="hint">全服击破 5、20、50 只，之后每 25 只，所有击破过奥多亚克的船员都会收到一封奖励邮件。</p>' +
      '<div class="pw-me"><span>你的贡献：<b>' + d.me + '</b> 只</span><span>今天：<b>' + Math.max(d.today || 0, day) + '</b> / ' + KBW.cap + '</span><span>参与船员：<b>' + d.players + '</b> 人</span></div>' +
      (d.top.length ? '<ol class="pw-top">' + d.top.map(function (x, i) { return '<li><span class="pw-rk">' + (i + 1) + '</span><span class="pw-nm">' + esc(x.name) + '</span><b>' + x.n + '</b></li>'; }).join('') + '</ol>' : '<p class="hint">还没有船员击破奥多亚克，来做第一个吧。</p>') +
      '<button type="button" class="btn primary" data-fpart="catch">去坎伯兰星探索</button>';
  }
  function kbwCardHTML(where) {
    if (!kbwOpenC()) return '<article class="pt-card pw-card locked"><span class="tape l"></span><span class="chip log-tag pw-tag">全服任务</span><h3>坎伯兰星保卫战</h3><p class="hint">读完主线第十七段「深海基站」后开始。</p></article>';
    setTimeout(function () { kbwFetch(); }, 0);
    return '<article class="log-card wide pw-card" id="kbw-card-' + where + '">' + kbwInner() + '</article>';
  }
  function kbwRedraw() { ['task', 'log'].forEach(function (w) { var el = $('kbw-card-' + w); if (el) el.innerHTML = kbwInner(); }); }
  setInterval(function () { if ($('kbw-card-task') || $('kbw-card-log')) kbwFetch(); }, 30000);
  // 区域里的BOSS（盐碱地的荒芜）：直接画在场景里，点它进BOSS页；没开放时显示开放条件
  function fieldBossHTML(R, si) {
    if (sceneCalm(R, si)) return '';
    var BK = Object.keys(BOSSES).filter(function (k) { return BOSSES[k].region === R.id; })[0]; if (!BK) return '';
    var B = BOSSES[BK], open = bossOpen(BK);
    return '<button type="button" class="wf-mon wf-boss' + (open ? '' : ' locked') + '"' + (open ? ' data-boss="' + BK + '" data-from="field"' : ' disabled') + ' title="BOSS · ' + esc(B.name) + '" style="left:58%;top:78%;z-index:78"><i class="wf-sh" aria-hidden="true"></i><img src="' + SPRITES[B.sid] + '" alt="' + esc(B.name) + '">' +
      '<span class="wf-tag">' + (open ? 'BOSS · ' + esc(B.name) + '（点击挑战）' : 'BOSS · ' + esc(B.name) + ' · ' + esc(B.lv[0].lockText)) + '</span></button>';
  }
  function engageTravel(h) {
    if (ex.fighting) return;
    var R = regionById(ex.region), F = R && fields[R.id], t = travelAt(Date.now());
    if (!F || t.h !== h || !t.active || t.rid !== R.id || t.si !== F.scene) { toast('叶子喵已经背起行囊，去别的地方旅行了。'); renderField(); return; }
    if (!travelOpen()) return;
    var P = planetOf(R.planet), left = Math.max(1, Math.ceil((t.end - Date.now()) / 60000));
    if (travelDone(h)) {   // 已经切磋过：聊两句，不能再打
      travelDlg(pickOne(TRAVEL_TALK.after).map(function (x) { return x.replace('{left}', left); }), [['再见', null]]);
      return;
    }
    travelDlg(pickOne(TRAVEL_TALK.hello).map(function (x) { return x.replace('{where}', R.name).replace('{planet}', P.name); }), [['下次再说', null], ['开始切磋', function () {
      var t2 = travelAt(Date.now());
      if (t2.h !== h || !t2.active || travelDone(h) || ex.fighting) { toast('叶子喵已经背起行囊，去别的地方旅行了。'); renderField(); return; }
      var sc = F.scenes[F.scene];
      if (srvMode()) { stopField(); startWildRemote({ travel: h }, { sid: TRAVEL.sid, lv: TRAVEL.lv, bg: sc.bg || null, back: R.name, where: P.name + ' · ' + R.name, travel: true }); return; }
      acc.travel = { h: h }; save();
      stopField();
      startWildBattle({ sid: TRAVEL.sid, lv: TRAVEL.lv, rate: 0, noCatch: true, foe: '旅行精灵', bg: sc.bg || null, back: R.name, where: P.name + ' · ' + R.name + ' · 旅行精灵', travel: true });
    }]]);
  }
  // 叶子喵的台词：hello 开战前（{where} 区域、{planet} 星球），win / lose / quit 战斗结束后，after 切磋过之后再点她（{left} 剩余分钟）
  var TRAVEL_TALK = {
    hello: [
      ['{name}！我们又见面啦！', '我刚旅行到{where}，就碰到你了。上次你帮了我，这次我可要拿出真本事了——来切磋一下吧！'],
      ['咦，这不是{name}吗？真巧！', '{planet}的风景好特别，我一路走一路练，已经变强好多了。要不要比划比划？'],
      ['嘿！{name}，这边这边！', '我就知道会在旅行的路上遇见你。别忘了我们说好的——碰到了就要切磋一下！'],
      ['又见面啦，{name}！', '你看，我已经走到{where}了！族里的长辈要是知道，肯定会吓一跳吧。来吧，让我看看你变强了多少！']
    ],
    win: [
      ['好、好厉害……！', '你和你的精灵配合得真好，我输得心服口服。我在这儿再看看风景，过一会儿才出发——下次我一定会赢你的！'],
      ['唔……又输给你了。', '不过我一点都不沮丧哦！跟你切磋，比一个人练习有意思多了。我会在这里再待一阵子，下次见！']
    ],
    lose: [
      ['嘿嘿，这次是我赢啦！', '你的精灵也很努力哦。我会在这里再待一会儿，下次见面，我们再好好比一场！'],
      ['看到了吗？这就是旅行的成果！', '别灰心，你已经很强了。等你再练练，下次说不定就是你赢啦！']
    ],
    quit: [
      ['诶？你要走了吗？', '那下次见面再好好比一场吧！我会在这里再待一会儿。']
    ],
    after: [
      ['今天的切磋就到这里吧！', '我在这儿看看风景，大概再过 {left} 分钟就要出发去下一个地方了。路上碰到我，记得再来找我哦！'],
      ['嗯？还想再比一场吗？', '今天不行啦，我得留点力气赶路。再过 {left} 分钟我就要出发了，下次见！']
    ]
  };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function travelDlg(lines, btns) {
    var f = form({ sid: TRAVEL.sid, lv: TRAVEL.lv }), d = document.createElement('div'); d.className = 'soc-dlg npc-dlg travel-dlg';
    d.innerHTML = '<div class="soc-box npc-box" role="dialog" aria-modal="true" aria-label="叶子喵"><span class="tape l"></span><span class="tape r"></span>' +
      '<img class="npc-face travel-face" src="' + f.img + '" alt="叶子喵"><div class="npc-say"><span class="step">叶子喵</span>' + lines.map(function (x, i) { return '<p class="' + (i ? 'hint' : 'npc-line') + '">' + esc(fill(x)) + '</p>'; }).join('') +
      '<div class="soc-foot">' + btns.map(function (b, i) { return '<button type="button" class="btn' + (i === btns.length - 1 ? ' primary' : ' ghost') + '" data-tbtn="' + i + '">' + esc(b[0]) + '</button>'; }).join('') + '</div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tbtn]');
      if (e.target === d || b) { d.remove(); var fn = b && btns[+b.dataset.tbtn][1]; if (fn) fn(); }
    });
  }
  /* ---------- 通用 NPC 对话框：o = { name, sub, img, face: 'lz'(全身立绘) | 'mon'(精灵), lines, btns: [[文字, 回调]] } ---------- */
  function npcDlg(o) {
    var d = document.createElement('div'); d.className = 'soc-dlg npc-dlg';
    d.innerHTML = '<div class="soc-box npc-box" role="dialog" aria-modal="true" aria-label="' + esc(o.name) + '"><span class="tape l"></span><span class="tape r"></span>' +
      '<img class="npc-face ' + (o.face === 'mon' ? 'travel-face fm-face' : 'lz-face') + '" src="' + o.img + '" alt="' + esc(o.name) + '"><div class="npc-say"><span class="step">' + esc(o.name) + (o.sub ? ' · ' + esc(o.sub) : '') + '</span>' + o.lines.map(function (x, i) { return '<p class="' + (i ? 'hint' : 'npc-line') + '">' + x + '</p>'; }).join('') + '</div>' +
      '<div class="soc-foot">' + o.btns.map(function (b, i) { return '<button type="button" class="btn' + (i === o.btns.length - 1 ? ' primary' : ' ghost') + '" data-npb="' + i + '">' + esc(b[0]) + '</button>'; }).join('') + '</div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-npb]'); if ((e.target === d && o.close !== false) || b) { d.remove(); var fn = b && o.btns[+b.dataset.npb][1]; if (fn) fn(); } });
  }
  /* ---------- 深渊实验室的？？？（静默）：到达坎伯兰星 · 深海的「深渊潜底」时 5% 概率遇到，每天最多一次 ---------- */
  var CUMBER = PVE.CUMBER;
  function cumberSay(face, line, btns) { npcDlg({ name: '？？？', img: CHARS[face] || CHARS.cumber, face: 'lz', lines: [line], btns: btns, close: false }); }
  function cumberCheck() {
    if (!ready() || ex.fighting || ex.view !== 'field' || document.querySelector('.soc-dlg')) return;
    var F = fields[ex.region], sc = F && F.scenes[F.scene]; if (!sc || sc.bgKey !== CUMBER.bg) return;
    var day = dayNum(Date.now()); if (acc.cumberDay === day || Math.random() >= CUMBER.chance) return;
    acc.cumberDay = day; save();
    cumberSay('cumber', '……你怎么在这里？', [['……', function () { cumberFight(sc.bg); }]]);
  }
  function cumberFight(bg) {
    if (srvMode()) return pveRemote('cumber', {}, { bg: bg || null, back: '深渊潜底', pre: function () { stopField(); $('pg-explore').hidden = true; } }, function (e, res) {
      var msg = [], r = e && e.rep;
      if (r) { msg = xpMsg(r.xp); dailyHit('pve'); save(); }
      ex.fighting = false; document.body.classList.remove('story-fight');
      $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
      renderTop(); syncBattle(); if (page === 'explore' && ex.view === 'field') renderField();
      if (msg.length) toast(msg.join(''));
      setTimeout(function () {
        if (r && r.res === 'win') cumberSay('cumber_smile', '我们会再见面的。', [['收下', function () { toast('获得' + itemName('m_mcry') + ' ×' + r.cry + '，已放入储存箱。'); }]]);
        else cumberSay('cumber_close', '这不是你该来的地方。', [['……', null]]);
      }, 600);
    });
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var a = CUMBER.team.map(function (x) { return storyMon({ sid: x.sid, lv: x.lv, moves: foeMoves(x.sid, x.lv) }); });
    stopField(); stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: team.map(storyMon), a: a, foe: '？？？', bg: bg || null, bgm: 'boss3', items: invCopy(), onItem: useInv, back: '深渊潜底',
      onEnd: function (res, seen, downs) {
        var msg = battleRewards(team, seen, downs); dailyHit('pve'); save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); if (page === 'explore' && ex.view === 'field') renderField();
        if (msg.length) toast(msg.join(''));
        setTimeout(function () {
          if (res === 'win') cumberSay('cumber_smile', '我们会再见面的。', [['收下', function () { earn('cumber', '', { items: { m_mcry: CUMBER.cry } }); save(); toast('获得' + itemName('m_mcry') + ' ×' + CUMBER.cry + '，已放入储存箱。'); }]]);
          else cumberSay('cumber_close', '这不是你该来的地方。', [['……', null]]);
        }, 600);
      } });
  }
  /* ---------- 炙热核心的火月鼠（一次性）：说自己太冷，配队里带 3 只火系精灵来温暖它，它就跟你走（LV18） ---------- */
  var FMNPC = { bg: 'pp_core', need: 3, lv: 18, x: 30, y: 80 };
  function fmFireN() { return (acc.teams[acc.active] || []).map(mon).filter(function (m) { return m && SPMAP[m.sid] && SPMAP[m.sid].types.indexOf('火') >= 0; }).length; }
  function fmNpcHTML(F, si) {
    var sc = F.scenes[si]; if (!sc || sc.bgKey !== FMNPC.bg || acc.fmNpc) return '';
    var f = form({ sid: 'firemouse', lv: FMNPC.lv });
    return '<button type="button" class="wf-mon wf-travel fm-npc" data-fmnpc="1" title="瑟瑟发抖的火月鼠" style="left:' + FMNPC.x + '%;top:' + FMNPC.y + '%;z-index:' + FMNPC.y + '"><i class="wf-sh" aria-hidden="true"></i><img src="' + f.img + '" alt=""><span class="wf-tag">💬 瑟瑟发抖的火月鼠</span></button>';
  }
  function fmSay(lines, btns) { npcDlg({ name: '火月鼠', sub: '炙热核心', img: form({ sid: 'firemouse', lv: FMNPC.lv }).img, face: 'mon', lines: lines, btns: btns }); }
  function fmNpcTalk() {
    if (acc.fmNpc || ex.fighting) return;
    var n = fmFireN();
    if (acc.fmAsk && n >= FMNPC.need) {
      fmSay(['哇……好暖和！' + FMNPC.need + ' 团火围着我，尾巴都不抖了！', '火月鼠在你脚边转了好几圈，把一块亮晶晶的金属碎片塞到你手里。'], [['要不要跟我走？', function () {
        fmSay(['嗯！跟着你，就再也不会冷了吧？我要跟你走！'], [['欢迎加入！', function () {
          txRun('gift', { k: 'fm', id: '1' }, function (res) {   // 走交易（grow.js）
            var g = res.mons[0], m = mon(g.u); renderField();
            toast('火月鼠（LV' + m.lv + '，' + m.nat + '）加入了你！' + (g.added ? '已加入' + tName(acc.active) + '。' : '已收入精灵仓库。'));
          });
        }]]);
      }]]);
      return;
    }
    if (acc.fmAsk) { fmSay(['呜……还是好冷……', '<b>提示：</b>配队里带上 ' + FMNPC.need + ' 只火系精灵再来找它，就能让它暖和起来（现在 ' + n + ' / ' + FMNPC.need + '）。'], [['我再去准备一下', null]]); return; }
    fmSay(['好……好冷……这里明明是炙热核心，可我怎么也暖和不起来……'], [
      ['多喝热水', function () { fmSay(['……谢谢，更冷了。'], [['咳，我还是认真想想办法吧', function () { acc.fmAsk = 1; save(); fmNpcTalk(); }]]); }],
      ['我来想办法', function () { acc.fmAsk = 1; save(); fmNpcTalk(); }]]);
  }
  function regionById(rid) { for (var i = 0; i < WILD_REGIONS.length; i++) if (WILD_REGIONS[i].id === rid) return WILD_REGIONS[i]; return null; }
  function stopField() {
    if (fieldTick) { clearInterval(fieldTick); fieldTick = null; }
    if (fieldRefresh) { clearInterval(fieldRefresh); fieldRefresh = null; }
  }
  function stepFieldMon(m, dt) {
    var prev = m.x;
    m.t += m.spd * dt;
    m.x = Math.max(10, Math.min(90, m.hx + Math.cos(m.t) * m.r));
    m.y = Math.max(48, Math.min(88, m.hy + Math.sin(m.t * 0.85) * m.r * 0.5));
    if (m.x > prev + 0.02) m.face = 1; else if (m.x < prev - 0.02) m.face = -1;
  }
  function spawnFieldMon(R, slot, force) {
    var sp;
    if (force && force.srv) sp = force.srv;   // 服务器刷出来的（号角引来的塞米）
    else if (srvMode() && !force) { sp = wqTake(R, slot); if (!sp) return null; }   // 用服务器网址玩时：种类、等级、异色都由服务器掷
    else {
      var hit = force || riceSpawn(R, slot) || rollWild(R.pool, (typeof WILD_SCENE !== 'undefined' && WILD_SCENE[slot.bgKey]) || null), shiny0 = rollShiny(hit.w);
      var corrupt0 = regionFallen(R);
      if (corrupt0) hit = { w: hit.w, lv: 40 + Math.floor(Math.random() * 11), bait: hit.bait };   // 瘴气化后：强制 LV40–50
      sp = { sid: hit.w.sid, lv: hit.lv, rate: hit.w.rate, shiny: shiny0, corrupt: corrupt0, bait: !!hit.bait };
    }
    var shiny = sp.shiny, corrupt = !!sp.corrupt;
    var f = form({ sid: sp.sid, lv: sp.lv, shiny: shiny });
    var img = f.img, name = f.name;
    if (corrupt) {   // 不论实际等级，一律显示最高阶段的立绘（本作里形态只影响显示，不影响能力值，见 assets.js 的说明）
      var s = SPMAP[sp.sid];
      img = shiny === 2 ? (SHINY_SPRITES[sp.sid + '_2'] || SHINY_SPRITES[sp.sid] || SPRITES[sp.sid]) : shiny ? (SHINY_SPRITES[sp.sid] || SPRITES[sp.sid]) : SPRITES[sp.sid];
      var fxs = FORM_FX_SPRITES[sp.sid]; if (fxs) img = (shiny === 2 ? fxs.miasmaShiny2 : shiny ? fxs.miasmaShiny : fxs.miasma) || fxs.miasma || img;   // 有瘴气侵染立绘的（玛西露姆）直接用
      name = '瘴气' + s.name;
    }
    var m = { id: 0, srvId: sp.id || null, sid: sp.sid, lv: sp.lv, rate: sp.rate, shiny: shiny, img: img, name: (shiny && !corrupt ? '异色' : '') + name, bait: !!sp.bait, corrupt: corrupt,
      hx: slot.hx, hy: slot.hy, r: slot.r, t: Math.random() * Math.PI * 2, spd: 0.55 + Math.random() * 0.5, x: slot.hx, y: slot.hy, face: 1 };
    stepFieldMon(m, 0);
    return m;
  }
  // 服务器刷出来的野生精灵：每个场景一个队列，快用完时再要一批
  var WSQ = {}, WSQB = {};   // 注意：WQ 是世界任务，别重名
  function wqFill(R, si, bg) {
    var k = R.id + ':' + si; if (WSQB[k]) return; WSQB[k] = 1;
    CLOUD.api('POST', '/api/pve', { op: 'wild', rid: R.id, si: si, bg: bg || '', n: 6 }).then(function (r) { WSQB[k] = 0; if (r && r.ok) WSQ[k] = (WSQ[k] || []).concat(r.list); }).catch(function () { WSQB[k] = 0; });
  }
  function wqTake(R, slot) {
    var k = R.id + ':' + slot.si, q = WSQ[k], sp = q && q.length ? q.shift() : null;
    if (!q || q.length < 3) wqFill(R, slot.si, slot.bgKey);
    return sp;
  }
  /* 一个区域有好几个场景（有几张背景就有几个，至少 2 个），左右箭头切换；每个场景各有 4 个精灵位置。
   * 每只精灵各自计时：待一会儿（FIELD_LIFE）就淡出离开，隔一小段时间（FIELD_GAP）再在同一片范围里出现一只新的，互不影响。
   * 采集点：第 i 个放在第 i 个场景里（场景比采集点少时轮着放）。 */
  var FIELD_LIFE = [14000, 32000], FIELD_GAP = [1500, 6000], FIELD_FADE = 600;
  function between(r) { return r[0] + Math.random() * (r[1] - r[0]); }
  function fillSlot(R, F, slot, now, first) {
    var m = spawnFieldMon(R, slot); if (!m) { slot.mon = null; slot.next = now + 1200; return null; }   // 服务器那批还没到：过一会儿再试
    m.id = ++F.seq;
    m.die = now + (first ? Math.random() * FIELD_LIFE[1] + 4000 : between(FIELD_LIFE));   // 刚进来时错开，不会一起走
    slot.mon = m; slot.next = 0; return m;
  }
  function fieldState(rid) {
    var R = regionById(rid); if (!R) return null;   // 没有野外表（R.pool）的区域（盐碱地）也能进，只是没有野生精灵
    if (!fields[rid]) {
      var bgs = (R.bgs || []).filter(function (k) { return BG[k]; }), n = sceneCount(R), now = Date.now();
      var fallen = regionFallen(R);
      if (fallen && !R.record) { bgs = bgs.map(floraBg); if (R.id === 'forest') bgs.push('fl_jungle_corrupt'); }   // 瘴气化之后：每个场景换成画了深紫色脉络的 *_mia 版本，丛林再多一张瘴气丛林
      var F = fields[rid] = { seq: 0, scene: Math.floor(Math.random() * n), scenes: [] };
      for (var i = 0; i < n; i++) {
        var sc = { ice: R.id === 'wh_snow' && prog('iceYado').done && Math.random() < 0.01, bgKey: bgs.length ? bgs[i % bgs.length] : '', bg: bgs.length ? BG[bgs[i % bgs.length]] : '', flip: i >= bgs.length && i % 2 === 1, corrupt: fallen && !/_mia$|_corrupt$/.test(bgs[i % bgs.length] || ''), slots: FIELD_SLOTS.map(function (s) { return { hx: s.hx, hy: s.hy, r: s.r, mon: null, next: 0 }; }) };
        sc.slots.forEach(function (sl) { sl.si = i; sl.bgKey = sc.bgKey; if (R.pool) fillSlot(R, F, sl, now, true); });
        F.scenes.push(sc);
      }
    }
    return fields[rid];
  }
  function loadField(rid) { delete fields[rid]; return fieldState(rid); }
  // 不在眼前的场景：按时间补算（离开的离开、该出现的出现）
  function catchUp(R, F, sc, now) {
    sc.slots.forEach(function (sl) {
      if (sl.mon && now >= sl.mon.die + FIELD_FADE) { sl.next = sl.mon.die + FIELD_FADE + between(FIELD_GAP); sl.mon = null; }
      if (!sl.mon && now >= sl.next && R.pool) fillSlot(R, F, sl, now);
    });
  }
  function replaceFieldMon(rid, id) {   // 打完、抓到或逃走：这只离开，过一会儿再补一只
    var F = fields[rid]; if (!F) return;
    F.scenes.forEach(function (sc) { sc.slots.forEach(function (sl) { if (sl.mon && sl.mon.id === id) { sl.mon = null; sl.next = Date.now() + between(FIELD_GAP); } }); });
  }
  function enterField(rid) {
    var R = regionById(rid); if (!R || !regionOpen(R)) return;
    loadField(rid);
    ex.view = 'field'; ex.region = rid; ex.planet = R.planet;
    renderExplore(); loadGate($('pg-explore'), '正在进入' + R.name + '～'); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
    setTimeout(cumberCheck, 400);
  }
  function fieldMonHTML(m, cls) {
    return '<button type="button" class="wf-mon' + (m.face < 0 ? ' flip' : '') + (cls ? ' ' + cls : '') + '" data-wfid="' + m.id + '" data-csid="' + m.sid + '" data-cst="' + (m.corrupt ? 9 : form({ sid: m.sid, lv: m.lv }).stage || 0) + '" data-cctx="' + (m.corrupt ? 'mia' : 'wild') + '" title="' + esc(m.name) + ' LV' + m.lv + '" aria-label="和' + esc(m.name) + '对战" style="left:' + m.x.toFixed(2) + '%;top:' + m.y.toFixed(2) + '%;z-index:' + Math.round(m.y) + '"><i class="wf-sh" aria-hidden="true"></i><img src="' + m.img + '" alt=""></button>';
  }
  function renderField() {
    var R = regionById(ex.region);
    if (!R || !regionOpen(R)) { ex.view = 'sites'; renderExplore(); return; }
    var F = fieldState(R.id), P = planetOf(R.planet), sc = F.scenes[F.scene], n = F.scenes.length;
    catchUp(R, F, sc, Date.now());
    var bg = sc.bg ? '<img class="wf-bg' + (sc.flip ? ' flip' : '') + '" src="' + sc.bg + '" alt="">' : '<div class="wf-ph' + (sc.flip ? ' flip' : '') + '">' + regionArt(R.id) + '</div>';
    var mons = sc.slots.filter(function (sl) { return sl.mon; }).map(function (sl) { return fieldMonHTML(sl.mon); }).join('');
    var nav = n > 1 ? '<button type="button" class="wf-arrow l" data-wfnav="-1" aria-label="上一个场景">‹</button><button type="button" class="wf-arrow r" data-wfnav="1" aria-label="下一个场景">›</button>' +
      '<span class="wf-dots" aria-label="场景 ' + (F.scene + 1) + ' / ' + n + '">' + F.scenes.map(function (x, i) { return '<i class="' + (i === F.scene ? 'on' : '') + '"></i>'; }).join('') + '</span>' : '';
    var spareTip = R.pool && R.planet === 'flora' && spareActive() ? '<div class="spare-note"><span class="tape l"></span><b>主线任务 · 引出猎杀者</b>　手下留情：这些精灵不会倒下，体力剩 1 点时就会逃走，算作「假装击败」。已完成 <b>' + spareN() + ' / ' + SPARE_N + '</b>。</div>' : '';
    $('pg-explore').innerHTML = exHead(R.pool ? '点击场景里走动的精灵，就会和它开战。' : '这里没有野生精灵。点击场景里的BOSS就能挑战它。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="field-back">‹ 返回' + esc(P.name) + '</button><b>' + esc(P.name) + ' · ' + esc(R.name) + '</b>' + (n > 1 ? '<span class="hint">场景 ' + (F.scene + 1) + ' / ' + n + (BG_NAME[sc.bgKey] ? ' · ' + BG_NAME[sc.bgKey] : '') + '</span>' : '') + '</div>' +
      invLine() + spareTip + '<div class="wf-scene' + (sc.corrupt ? ' miasma-bg' : '') + '" id="wf-scene">' + bg + mons + gatherNodesHTML(R.id, F.scene, n) + jadeHTML(R.id, F.scene) + riceBowlHTML(R, F.scene) + oreHTML(R, F, F.scene) + hornHTML(R, F, F.scene) + iceHTML(R, F, F.scene) + travelHTML(R, F.scene) + kbwHTML(R, F.scene) + storyGatherHTML(R, F.scene) + fmNpcHTML(F, F.scene) + fieldBossHTML(R, F.scene) + nav + '</div>' +
      (R.pool ? '<p class="hint">点左右两边的箭头可以切换场景。每只精灵在自己的一小片范围里走动，待一会儿就会离开，过一阵又会有新的精灵出现，各走各的。点中哪只，就和哪只对战；打完、抓到或逃走之后，这只离开，过一会儿会有新的一只补上。采集点固定在场景里，每个每天可以采集 1 次：芙罗拉、坎伯兰、庞贝采到星砂 ×12，莱汀和白之星采到圣晶石 ×1。' + (RICE.regions.indexOf(R.id) >= 0 ? '带着「一碗饭」来的话，可以在任意一个场景里放下它。' : '') + '</p>' : '');
    startFieldMove();
  }
  function startFieldMove() {
    stopField();
    var last = Date.now();
    fieldTick = setInterval(function () {
      if (page !== 'explore' || ex.view !== 'field' || ex.fighting) { stopField(); return; }
      var scene = $('wf-scene'); if (!scene) { stopField(); return; }
      var F = fields[ex.region], R = regionById(ex.region); if (!F || !R) return;
      var sc = F.scenes[F.scene], now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      sc.slots.forEach(function (sl) {
        var m = sl.mon;
        if (!m) {   // 空位：时间到了就出现一只新的（淡入）
          if (R.pool && now >= sl.next) { var nm_ = fillSlot(R, F, sl, now); if (nm_) scene.insertAdjacentHTML('beforeend', fieldMonHTML(nm_, 'wf-in')); }
          return;
        }
        var el = scene.querySelector('[data-wfid="' + m.id + '"]');
        if (now >= m.die && !m.out) { m.out = now; if (el) el.classList.add('wf-out'); }   // 待够了：淡出
        if (m.out && now - m.out >= FIELD_FADE) { if (el) el.remove(); sl.mon = null; sl.next = now + between(FIELD_GAP); return; }
        stepFieldMon(m, dt);
        if (!el) return;
        el.style.left = m.x.toFixed(2) + '%';
        el.style.top = m.y.toFixed(2) + '%';
        el.style.zIndex = String(Math.round(m.y));
        el.classList.toggle('flip', m.face < 0);
      });
    }, 40);
  }
  function fieldNav(d) {
    var F = fields[ex.region]; if (!F) return;
    var n = F.scenes.length; F.scene = (F.scene + d + n) % n;
    renderField();
    setTimeout(cumberCheck, 400);
  }
  function engageField(id) {
    if (ex.fighting) return;
    var R = regionById(ex.region), F = R && fields[R.id]; if (!F || !regionOpen(R)) return;
    var sc = F.scenes[F.scene], m = null; sc.slots.forEach(function (sl) { if (sl.mon && sl.mon.id === id) m = sl.mon; }); if (!m || m.out) return;
    var P = planetOf(R.planet);
    var o = { sid: m.sid, lv: m.lv, rate: m.rate, shiny: shinyV(m.shiny), bg: sc.bg || null, back: R.name, where: P.name + ' · ' + R.name, fieldId: m.id, fieldRid: R.id, bait: !!m.bait, flora: R.planet === 'flora' };
    if (srvMode()) { if (!m.srvId) return; stopField(); return startWildRemote({ id: m.srvId }, o); }   // 由服务器开打：瘴气、手下留情、号角都由服务器判断
    if (m.horn && acc.items.m_horn > 0) { acc.items.m_horn--; save(); o.where += ' · 号角引来的塞米'; }   // 进入战斗：号角用掉
    if (m.corrupt) { o.corrupt = true; o.miasma = 10; o.noCatch = true; o.foe = '瘴气侵蚀的狂暴精灵'; o.where += ' · 瘴气异变'; }
    else if (R.planet === 'flora' && purgeActive() && Math.random() < PURGE.chance) { o.taint = true; o.miasma = 5; o.noCatch = true; o.foe = '被瘴气污染的野生精灵'; o.where += ' · 瘴气精灵'; }
    if (R.planet === 'flora' && spareActive() && !m.corrupt) { o.spare = true; o.where += ' · 手下留情'; }
    stopField();
    startWildBattle(o);
  }
  function rollWild(pool, extra) {   // extra：只在这个场景出现的精灵（WILD_SCENE），和区域表合在一起抽
    var P = extra ? WILD[pool].concat(extra) : WILD[pool], tot = P.reduce(function (a, w) { return a + w.w; }, 0), r = Math.random() * tot, w = P[0];
    for (var i = 0; i < P.length; i++) { r -= P[i].w; if (r < 0) { w = P[i]; break; } }
    return { w: w, lv: w.lv[0] + Math.floor(Math.random() * (w.lv[1] - w.lv[0] + 1)) };
  }
  // 主线任务「引出猎杀者」（读完第六段后开始）：芙罗拉星丛林、草甸的野生精灵不会倒下，体力剩 1 点就逃走，算「假装击败」
  var SPARE_N = 5;
  function spareN() { return (acc && acc.story && acc.story.flora2 && acc.story.flora2.spare) || 0; }
  function spareActive() { return prog('flora2').done && spareN() < SPARE_N; }
  // 第十段「瘴气之源」读完后：芙罗拉星整体瘴气化，野外精灵强制变成瘴气异变的最高阶段（见 spawnFieldMon），bgm 也随之切换
  function floraFallen() { return prog('flora6').done && !prog('flora7').done; }   // 2026-10-24：读完第十一段后芙罗拉星恢复
  function regionFallen(R) { return !!R && R.planet === 'flora' && (R.record || floraFallen()); }   // 「瘴气污染的记录」一直是瘴气化的样子   // 2026-10-17 第八段拆成三段后，改为读完第十段才瘴气化
  // 瘴气化之后，芙罗拉星的背景换成画了瘴气脉络的版本（有 *_mia 图的才换）
  function floraBg(k) { return k && floraFallen() && BG[k + '_mia'] ? k + '_mia' : k; }
  // 对战背景：传入背景键。F.bg 可以写成 'fl_salt' 这样的键，统一在这里换成图片地址
  function fightBg(k) { return BG[k] || null; }
  function regionOpen(R) { if (R.record) return prog('flora7').done; return R.planet === 'flora' ? prog('flora1').done : planetOpen(planetOf(R.planet)); }
  // 服务器结算的野外对战。args：{ id } 服务器刷出来的那只 / { travel } 旅行精灵；o：显示用的资料
  function startWildRemote(args, o) {
    var ui = { bg: o.bg, back: o.back, where: o.where,
      fail: function () {   // 没开成（比如服务器刚更新过，刷出来的精灵都作废了）：换一批，回到场景
        WSQ = {}; if (o.fieldRid) replaceFieldMon(o.fieldRid, o.fieldId);
        if (page === 'explore' && ex.view === 'field') renderField();
      },
      adjust: function (r, u) { var op = r.opt || {}; u.where = o.where + (op.tag || ''); u.corrupt = !!op.corrupt && !/_mia\.|_corrupt\./.test(o.bg || ''); } };
    pveRemote('wild', args, ui, function (e, res) {
      var msg = [], r = e && e.rep, n = r ? r.downs : 0;
      if (o.fieldRid) replaceFieldMon(o.fieldRid, o.fieldId);
      if (r) {
        if (r.spare != null) msg.push('主线任务「引出猎杀者」：已经「假装击败」' + r.spare + ' / ' + r.spareN + ' 只野生精灵。' + (r.spare >= r.spareN ? '天色渐渐暗了下来……去芙罗拉星的「剧情」页，继续主线「猎杀者」。' : ''));
        if (r.caught) { var m = mon(r.caught.u); if (m) msg.push('捕捉到了 ' + (m.shiny ? '异色的' : '') + form(m).name + '（LV' + m.lv + '，' + m.nat + '）！' + (r.caught.added ? '已加入' + tName(acc.active) + '。' : '已收入精灵仓库。')); dailyHit('catch'); }
        if (n) dailyHit('wildWin', n);
        if (r.caught) dailyNote('catch');
        if (r.purge) {
          msg.push('祛除了一只瘴气精灵（' + r.purge.n + ' / ' + r.purge.goal + '）。');
          r.purge.steps.forEach(function (st) {
            msg.push('星球任务「祛除瘴气」：累计击败 ' + st.n + ' 只，经验背包 +' + fmt(st.exp) + '。');
            if (st.title) { msg.push('任务完成！获得称号「' + titleName(st.title) + '」，芙罗拉星的瘴气被彻底祛除了。'); renderTitle(); }
          });
        }
        if (r.pw) {
          if (r.pw.full) msg.push('瘴气驱逐战：今天已经击破 ' + r.pw.cap + ' 次，达到每日上限，明天再来吧。');
          else { msg.push('瘴气驱逐战：击破 +1（今天 ' + r.pw.n + ' / ' + r.pw.cap + '），经验背包 +' + fmt(r.pw.exp) + '。'); if (r.pw.data && !r.pw.data.capped && !r.pw.data.skipped) pwApply(r.pw.data); }
        }
        if (r.kbw) {
          if (r.kbw.full) msg.push('坎伯兰星保卫战：今天已经击破 ' + r.kbw.cap + ' 次，达到每日上限，明天再来吧（剧情需要的击破数照样计入：' + Math.min(r.kbw.me, r.kbw.need) + ' / ' + r.kbw.need + '）。');
          else { msg.push('坎伯兰星保卫战：击破 +1（今天 ' + r.kbw.n + ' / ' + r.kbw.cap + '），经验背包 +' + fmt(r.kbw.exp) + '。' + (r.kbw.me === r.kbw.need ? '你已经击破了 ' + r.kbw.need + ' 只奥多亚克，坎伯兰星的「剧情」页有新的一段了！' : r.kbw.me < r.kbw.need ? '（剧情：' + r.kbw.me + ' / ' + r.kbw.need + '）' : '')); if (r.kbw.data && !r.kbw.data.capped && !r.kbw.data.skipped) kbwApply(r.kbw.data); }
        }
        if (r.trav) msg.push('击败了旅行精灵叶子喵！获得累积经验 ×' + fmt(r.trav.exp) + (r.trav.leaf ? '，她留下了一片「叶子喵的叶片」' : '') + '。');
        if (r.psac) msg.push('它掉下了蘑菇毒囊 ×' + r.psac + '，已放入储存箱（加 5 个药草可以合成解毒药剂）。');
        if (r.horn) msg.push('它掉下了赫菲角片 ×' + r.horn + '，已放入储存箱（60 片可以合成奇声号角）。');
        if (r.iceGot) msg.push('化开的冰块里凿下了远古冰块 ×' + r.iceGot + '，已放入储存箱。');
        if (r.iceDrop) msg.push('它掉下了远古冰块 ×' + r.iceDrop + '，已放入储存箱（100 个可以让亚哆领悟隐藏技能）。');
        if (r.disk) msg.push('它掉下了星盘 ×' + r.disk + '，已放入储存箱（100 个可以让一只幽灵鱼一系领悟隐藏技能）。');
        if (r.bowl) msg.push('放在熔岩原的那碗米饭被吃得一粒不剩。');
        if (r.seeds) msg.push('它掉下了水稻种子 ×' + r.seeds + '，已放入储存箱。');
        dailyHit('pve');
        msg = msg.concat(xpMsg(r.xp));
        save();
      } else if (res === 'void') msg.push('这场对战作废了。');
      if (o.travel) setTimeout(function () { travelDlg(pickOne(n ? TRAVEL_TALK.win : r && r.res === 'lose' ? TRAVEL_TALK.lose : TRAVEL_TALK.quit), [['知道了', null]]); }, 700);   // 打完夸一句；她会留在原地，满 20 分钟才走
      ex.fighting = false; document.body.classList.remove('story-fight');
      $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
      renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
      if (msg.length) toast(msg.join(''));
    });
  }
  function startWildBattle(o) {
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon), a;
    if (o.corrupt) {   // 瘴气异变：强制最高阶段立绘、只会用攻击技能、深度侵蚀双攻 +100%
      var s = SPMAP[o.sid];
      a = [{ id: o.sid, lv: o.lv, moves: puppetMoves(o.sid), nick: '瘴气' + s.name, img: o.shiny === 2 ? (SHINY_SPRITES[o.sid + '_2'] || SHINY_SPRITES[o.sid] || SPRITES[o.sid]) : o.shiny ? (SHINY_SPRITES[o.sid] || SPRITES[o.sid]) : SPRITES[o.sid], shiny: shinyV(o.shiny), miasma: o.miasma, boss: { erode: 1, mute: 1 } }];
    } else {
      a = [storyMon({ sid: o.sid, lv: o.lv, moves: foeMoves(o.sid, o.lv), shiny: shinyV(o.shiny) })];
      if (o.shiny) a[0].nick = '异色' + a[0].nick;
      if (o.taint) { a[0].miasma = o.miasma; a[0].nick = '被污染的' + a[0].nick; }
    }
    seeMon(o.sid, o.lv);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: o.foe || '野生精灵', items: invCopy(), bg: o.bg || null, corrupt: !!o.corrupt && !/_mia\.|_corrupt\./.test(o.bg || ''), bgm: o.corrupt ? 'disCommunication' : null,
      wild: { rate: o.rate, back: o.back, where: o.where, noCatch: !!o.noCatch, spare: !!o.spare },
      onItem: useInv,
      onEnd: function (res, seen, downs) {
        var msg = [];
        if (o.fieldRid) replaceFieldMon(o.fieldRid, o.fieldId);
        if (res === 'spared') {   // 「假装击败」：它逃走了，照样算击败（有经验），并计入主线任务
          downs = (downs || []).concat([{ id: o.sid, lv: o.lv }]);
          var sp = prog('flora2'); sp.spare = Math.min(SPARE_N, (sp.spare || 0) + 1);
          msg.push('主线任务「引出猎杀者」：已经「假装击败」' + sp.spare + ' / ' + SPARE_N + ' 只野生精灵。' + (sp.spare >= SPARE_N ? '天色渐渐暗了下来……去芙罗拉星的「剧情」页，继续主线「猎杀者」。' : ''));
        }
        if (res === 'caught') {
          var m = newMon(o.sid, o.lv), T = acc.teams[acc.active], added = T.length < TEAM_SIZE;
          if (o.shiny) m.shiny = shinyV(o.shiny);
          if (added) T.push(m.u);
          msg.push('捕捉到了 ' + (m.shiny ? '异色的' : '') + form(m).name + '（LV' + o.lv + '，' + m.nat + '）！' + (added ? '已加入' + tName(acc.active) + '。' : '已收入精灵仓库。'));
          dailyHit('catch');
        }
        if (downs && downs.length) { if (!acc.stats) acc.stats = {}; acc.stats.wildWins = (acc.stats.wildWins || 0) + downs.length; dailyHit('wildWin', downs.length); }
        if ((o.taint || (o.corrupt && purgeActive())) && downs && downs.length) msg = msg.concat(purgeHit());   // 瘴气化之后的腐化精灵也计入「祛除瘴气」
        if (o.corrupt && pwOpen() && downs && downs.length) {
          var pd = pwDay();
          if (pd.n < PW.cap) { pd.n++; var pwe = pwExpNow(); earn('pw', '', { exp: pwe }); save(); renderRes(); msg.push('瘴气驱逐战：击破 +1（今天 ' + pd.n + ' / ' + PW.cap + '），经验背包 +' + fmt(pwe) + (pwOnline() ? '。' : '（没有联网，全服进度没有计入）。')); pwHit(); }
          else msg.push('瘴气驱逐战：今天已经击破 ' + PW.cap + ' 次，达到每日上限，明天再来吧。');
        }
        if (o.travel && downs && downs.length) {   // 旅行精灵：累积经验 ×3000，50% 掉落叶片
          var lf = Math.random() < TRAVEL.leaf;
          earn('travel', '', { exp: TRAVEL.exp, items: lf ? { m_lcleaf: 1 } : null });
          msg.push('击败了旅行精灵叶子喵！获得累积经验 ×' + fmt(TRAVEL.exp) + (lf ? '，她留下了一片「叶子喵的叶片」' : '') + '。');
        }
        if (o.travel) setTimeout(function () { travelDlg(pickOne(downs && downs.length ? TRAVEL_TALK.win : res === 'lose' ? TRAVEL_TALK.lose : TRAVEL_TALK.quit), [['知道了', null]]); }, 700);   // 打完夸一句；她会留在原地，满 20 分钟才走
        if (o.sid === 'hephaestus' && downs && downs.length) { var hn = 0; downs.forEach(function () { hn += hornDrop(); }); earn('drop', 'horn', { items: { m_hfhorn: hn } }); msg.push('它掉下了赫菲角片 ×' + hn + '，已放入储存箱（60 片可以合成奇声号角）。'); }
        if (o.sid === 'mush' && downs && downs.length) { var ps0 = 0; downs.forEach(function () { if (Math.random() < 0.1) ps0++; }); if (ps0) { earn('drop', 'psac', { items: { m_psac: ps0 } }); msg.push('它掉下了蘑菇毒囊 ×' + ps0 + '，已放入储存箱。'); } }
        if (o.sid === 'hauris' && downs && downs.length) { var hd = 0; downs.forEach(function () { hd += 50 + Math.floor(Math.random() * 21); }); earn('drop', 'disk', { items: { hrDisk: hd } }); msg.push('它掉下了星盘 ×' + hd + '，已放入储存箱（100 个可以让一只幽灵鱼一系领悟隐藏技能）。'); }   // 2026-10-24
        if (o.bait && (res === 'caught' || (downs && downs.length))) { acc.riceBowl = null; msg.push('放在熔岩原的那碗米饭被吃得一粒不剩。'); }
        if (o.flora && downs && downs.length) {   // 芙罗拉星野外：每击败一只，10% 掉落水稻种子
          var seeds = 0; downs.forEach(function () { if (Math.random() < RICE.seedDrop) seeds++; });
          if (seeds) { earn('drop', 'rice', { items: { s_rice: seeds } }); msg.push('它掉下了水稻种子 ×' + seeds + '，已放入储存箱。'); }
        }
        dailyHit('pve');
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
        if (msg.length) toast(msg.join(''));
      } });
  }
  /* ---------- 星球挑战：从左到右一条链，每个节点是一关，按顺序开放；每关三颗星 ----------
   * 在古城防卫部读完支线「芙罗拉星挑战」后开放。第一次点开第二关时插播支线「借来的力量」，之后可以带助战精灵：
   *   自己的配队里挑 4 只 + 1 只助战（明明教官的 LV30 赫菲斯，或好友名片里的助战精灵，服务器接口 /api/helpers）
   * 星级：1 星 = 击败所有敌人；2、3 星看每关的 s2 / s3（nofaint 无精灵倒下、half 结束时全员体力高于一半、super 用过克制对方属性的技能、nostatus 结束时没有异常状态）
   * 存档：acc.chal[关卡 id] = { s: [星1, 星2, 星3], got: 首通时间 } */
  var CHAL = PVE.CHAL;   // 关卡数据和星级判定在 js/engine/pve.js（服务器和浏览器共用，2026-10-25）
  // 星级要求：固定的几种，加上带参数的 'turns:N'（N 回合内获胜）、'st:状态'（让敌人陷入某种异常）、'heal:N'（累计恢复 N 点体力）
  function starTxt(c) {
    if (STAR_TXT[c]) return STAR_TXT[c];
    var p = c.split(':');
    if (p[0] === 'turns') return '在 ' + p[1] + ' 回合内获胜';
    if (p[0] === 'st') return '让一名敌人陷入「' + p[1] + '」状态';   // 2026-11-01：不再用括号提示技能
    if (p[0] === 'heal') return '战斗中累计恢复 ' + p[1] + ' 点体力';
    return c;
  }
  function starOk(c, S, mine) { return PVE.starOk(c, S, mine); }
  function lvTxt(f) { return f.q ? 'LV.??' : 'LV' + f.lv; }
  // 累计星数奖励（2026-10-17）：acc.chalGot[星数] = 领取时间
  var CHAL_STAR = [
    { n: 30, rw: { bgm: 'floraGrass', exp: 30000, energy: 3000 } },
    { n: 60, rw: { bgm: 'floraForest', exp: 60000, energy: 5000 } },
    { n: 90, rw: { bgm: 'floraFallen', exp: 90000, energy: 8000 } },
    { n: 120, rw: { exp: 120000, energy: 10000, items: { floraJade: 100, g_core: 4 } } },
    { n: 150, rw: { exp: 150000, energy: 15000, items: { floraJade: 200, g_core: 8 } } }
  ];
  var CHAL_STARS = { flora: CHAL_STAR, kamble: AWD.CHAL_STAR_KB };   // 2026-11-01：坎伯兰星的路线也有星数奖励（基地音乐 Cumberland1～3）
  function chalP() { return ex.planet === 'kamble' ? 'kamble' : 'flora'; }
  function chalTotal(P) { return CHAL[P || 'flora'].reduce(function (a, x) { return a + chalStars(x.id); }, 0); }
  function chalGot(n, P) { var k = P === 'kamble' ? 'kb:' + n : n; return !!(acc && acc.chalGot && acc.chalGot[k]); }
  function chalStarHTML(total, P) {
    return '<div class="ch-mile">' + CHAL_STARS[P].map(function (x) {
      var got = chalGot(x.n, P), can = !got && total >= x.n;
      return '<div class="ch-mi' + (got ? ' got' : can ? ' can' : '') + '"><b>★ ' + x.n + '</b><span>' + rwList(x.rw).join('、') + '</span>' +
        (got ? '<em>已领取</em>' : can ? '<button type="button" class="btn primary" data-chstar="' + x.n + '">领取</button>' : '<em>' + total + ' / ' + x.n + '</em>') + '</div>';
    }).join('') + '</div>';
  }
  function claimChalStar(n, P) {
    P = P || 'flora';
    var x = CHAL_STARS[P].filter(function (y) { return y.n === n; })[0]; if (!x || chalGot(n, P) || chalTotal(P) < n) return;
    var R = x.rw;
    txRun('chalStar', { n: n, P: P }, function () {   // 服务器按它记的星数结算（js/engine/award.js）
      renderTop(); toast((P === 'kamble' ? '坎伯兰星' : '芙罗拉星') + '挑战路线累计 ' + n + ' 颗星奖励：' + rwList(R).join('、') + (R.bgm ? '。基地音乐可以在基地里切换。' : '。'));
      if (page === 'explore') renderExplore();
    });
  }
  var STAR_TXT = { win: '击败所有敌人', nofaint: '无精灵倒下', half: '战斗结束时，所有出战精灵的体力都高于一半', super: '使用一次克制对方属性的技能', nostatus: '战斗结束时，所有精灵都不处于异常状态',
    noitem: '整场战斗不使用任何道具', nosw: '整场战斗不主动更换出战精灵', lead: '首发精灵在战斗结束时没有倒下',
    crit: '至少打出一次致命一击', up6: '让我方精灵的任意一项能力等级提升到 +6',
    down6: '让敌人的任意一项能力等级下降到 −6', oneshot: '一次攻击造成超过敌人最大体力的伤害',
    dotko: '用异常状态的持续伤害击败一名敌人' };
  // 对战中的「星级要求」下拉面板：每一条当前的状态
  function starLive(c, S, mine) {
    var cs = S.cs || {}, p = c.split(':');
    var keep = function (bad) { return bad ? ['fail', '已失败'] : ['keep', '保持中']; }, now = function (ok) { return ok ? ['now', '目前满足'] : ['not', '目前不满足']; }, got = function (ok, t) { return ok ? ['done', '已达成'] : ['todo', t || '未达成']; };
    if (c === 'win') return ['todo', '进行中'];
    if (c === 'nofaint') return keep(mine.some(function (m) { return m.fainted; }));
    if (c === 'half') return now(mine.every(function (m) { return !m.fainted && m.hp > m.maxhp / 2; }));
    if (c === 'super') return got(S.se && S.se[0] > 0);
    if (c === 'nostatus') return now(mine.every(function (m) { return m.fainted || !Object.keys(m.st || {}).some(function (k) { return m.st[k] > 0; }); }));
    if (c === 'noitem') return keep(cs.items > 0);
    if (c === 'nosw') return keep(cs.sw > 0);
    if (c === 'lead') return keep(!mine[0] || mine[0].fainted);
    if (c === 'crit') return got(cs.crit > 0);
    if (c === 'up6') return got(cs.up6 > 0);
    if (c === 'down6') return got(cs.down6 > 0);
    if (c === 'oneshot') return got(cs.oneShot > 0);
    if (c === 'dotko') return got(cs.dotKO > 0);
    if (p[0] === 'turns') return S.turn - 1 > +p[1] ? ['fail', '已失败'] : ['keep', '已过 ' + (S.turn - 1) + ' / ' + p[1] + ' 回合'];
    if (p[0] === 'st') return got(cs.st && cs.st[p[1]] > 0);
    if (p[0] === 'heal') return got((cs.heal || 0) >= +p[1], (cs.heal || 0) + ' / ' + p[1]);
    return ['todo', ''];
  }
  var MM_HELPER = { key: 'mm', owner: '明明教官', mon: { sid: 'hephaestus', lv: 30, moves: [] } };
  function chalRec(id) { if (!acc.chal) acc.chal = {}; return acc.chal[id] || null; }
  function chalStars(id) { return PVE.chalStars(acc, id); }
  function chalOpen() { return !!(acc && prog('fl_chal').done); }
  function chalLevelOpen(P, i) { return chalOpen() && (P !== 'kamble' || prog('kb1').done) && (i === 0 || chalStars(CHAL[P][i - 1].id) > 0); }
  function helperSet() { var c = acc && acc.card; return !!(c && ((Array.isArray(c.helpers) && c.helpers.some(function (u) { return mon(u); })) || (c.helper != null && mon(c.helper)))); }
  function helperOk() { return prog('fl_chal2').done; }
  function starRow(n, got) { var h = ''; for (var i = 0; i < 3; i++) h += '<i class="' + (got ? (got[i] ? 'on' : '') : i < n ? 'on' : '') + '">★</i>'; return '<span class="ch-stars">' + h + '</span>'; }
  // 好友的助战精灵（联网时从服务器读，几分钟内用缓存）
  function loadHelpers(force) {
    if (!bsOnline() || ex.hpBusy || (!force && ex.helpers && Date.now() - ex.helpersT < 120000)) return;
    ex.hpBusy = true;
    CLOUD.api('GET', '/api/helpers').then(function (r) {
      ex.hpBusy = false; if (r._code !== 200) return;
      ex.helpers = r.helpers || []; ex.helpersT = Date.now();
      if (page === 'explore' && ex.view === 'sites' && ex.fpart === 'challenge') renderExplore();
      if ($('tp-dlg')) renderTeamPrep();
    }).catch(function () { ex.hpBusy = false; });
  }
  function helperList() {
    var L = [MM_HELPER];
    (ex.helpers || []).forEach(function (h) { if (h && h.mon && SPMAP[h.mon.sid]) L.push({ key: 'u:' + h.user + ':' + (h.u != null ? h.u : 0), user: h.user, owner: h.name || h.user, mon: h.mon }); });
    return L;
  }
  function chalTeam() {   // 这一关的出战精灵：自己的（按配队顺序）+ 助战
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean), tk = acc.active + ':' + team.map(function (m) { return m.u; }).join(',');
    if (!ex.chalOwn || ex.chalTk !== tk) { ex.chalOwn = team.map(function (m) { return m.u; }); ex.chalTk = tk; }   // 配队变了就重新全选
    var HP = ex.chalHelper && helperOk() ? helperList().filter(function (h) { return h.key === ex.chalHelper; })[0] : null;
    if (ex.chalHelper && !HP) ex.chalHelper = null;
    var own = team.filter(function (m) { return ex.chalOwn.indexOf(m.u) >= 0; }).slice(0, HP ? 4 : 5);
    return { team: team, own: own, helper: HP };
  }
  function chalPage(P) {
    if (!chalOpen()) {
      return '<div class="fl-soon"><span class="tape r"></span><b>挑战 · 关卡副本</b><p>古城防卫部的明明教官在芙罗拉星上划出了一条挑战路线：一关接一关，每一关都会根据表现评出 1~3 颗星。</p><p class="stars3" aria-hidden="true">☆ ☆ ☆</p>' +
        (prog('flora1').done ? '<p class="hint">去荆楚号 · 襄阳 · 古城防卫部，找明明教官接取挑战任务。</p><button type="button" class="btn primary" data-tpgo="襄阳">前往古城防卫部</button>' : '<p class="hint">读完主线「降临芙罗拉」后，去古城防卫部找明明教官。</p>') + '</div>';
    }
    if (P === 'kamble' && !prog('kb1').done) return '<div class="fl-soon"><span class="tape r"></span><b>挑战 · 关卡副本</b><p class="hint">读完第二章第十二段「远航」、抵达坎伯兰星后开放。</p></div>';
    if (ex.chalP !== P) { ex.chalP = P; ex.chal = null; }   // 换了星球：重新选关
    var L = CHAL[P], sel = ex.chal != null && L[ex.chal] && chalLevelOpen(P, ex.chal) ? ex.chal : (function () { var k = 0; L.forEach(function (x, i) { if (chalLevelOpen(P, i)) k = i; }); return k; })();
    ex.chal = sel;
    if (helperOk()) loadHelpers();
    var total = L.reduce(function (a, x) { return a + chalStars(x.id); }, 0);
    setTimeout(function () { var c = document.querySelector('.ch-chain'), n = c && c.querySelector('.ch-node.sel'); if (n) c.scrollLeft = n.offsetLeft - c.clientWidth / 2 + n.offsetWidth / 2; }, 0);   // 50 关横向排开：自动滚到选中的那一关
    var chain = '<ol class="ch-chain">' + L.map(function (x, i) {
      var open = chalLevelOpen(P, i), n = chalStars(x.id), r = acc.chal && acc.chal[x.id];
      return '<li class="ch-node' + (open ? '' : ' locked') + (n ? ' clear' : '') + (i === sel ? ' sel' : '') + '"><button type="button" data-chal="' + i + '"' + (open ? '' : ' disabled') + ' aria-label="第 ' + (i + 1) + ' 关' + (open ? '' : '（未开放）') + '">' +
        '<span class="ch-no">' + (open ? i + 1 : '🔒') + '</span>' + starRow(n, r && r.s) + '<b>' + esc(x.n) + '</b></button></li>';
    }).join('') + '</ol>';
    var x = L[sel], rec = acc.chal && acc.chal[x.id], T = chalTeam(), conds = ['win', x.s2, x.s3];
    var foes = x.foes.map(function (f) { var k = wildKnown(f.sid), fm = form(f); return '<li>' + (k ? '<img src="' + fm.img + '" alt="">' : silTag(f.sid, fm.stage)) + '<span><b>' + (k ? esc(fm.name) : '？？？') + '</b><small>' + lvTxt(f) + '</small></span></li>'; }).join('');
    var ownHTML = T.team.map(function (m) {
      var on = T.own.indexOf(m) >= 0, f = form(m), dis = !on && T.own.length >= (T.helper ? 4 : 5);
      return '<button type="button" class="ch-mon' + (on ? ' on' : '') + '" data-chown="' + m.u + '"' + (dis ? ' disabled' : '') + ' aria-pressed="' + on + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + '</small></button>';
    }).join('');
    var helpHTML = !helperOk() ? '<p class="hint">' + (sel >= 1 ? '' : '通过第一关后，第二关会解锁「助战精灵」：可以借一只别人的精灵一起出战。') + '</p>' :
      '<div class="ch-helpers"><button type="button" class="ch-help' + (!T.helper ? ' on' : '') + '" data-chhelp=""><span class="ch-none">不带助战</span></button>' + helperList().map(function (h) {
        var f = form(h.mon), on = T.helper && T.helper.key === h.key;
        return '<button type="button" class="ch-help' + (on ? ' on' : '') + '" data-chhelp="' + esc(h.key) + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + h.mon.lv + ' · ' + esc(h.owner) + '</small></button>';
      }).join('') + '</div><p class="hint">' + (bsOnline() ? (ex.helpers && ex.helpers.length ? '好友在名片里放的助战精灵都在这里。' : '好友在名片里放了助战精灵后，也会出现在这里。') : '联网登录后，还能借用好友名片里的助战精灵。') + '自己也可以在「社交 → 我的名片」里挂一只助战精灵。</p>';
    var ready_ = T.own.length > 0;
    return '<div class="ch-wrap"><div class="ch-head"><b>' + (P === 'kamble' ? '坎伯兰星' : '芙罗拉星') + ' · 挑战路线</b><span class="hint">共 ' + L.length + ' 关 · 已获得 ' + total + ' / ' + L.length * 3 + ' 颗星</span></div>' + chalStarHTML(total, P) + chain +
      '<article class="ch-detail"><span class="tape r"></span><div class="ch-dh"><span class="sc-tag">第 ' + (sel + 1) + ' 关</span><h3>' + esc(x.n) + '</h3>' + starRow(chalStars(x.id), rec && rec.s) + '</div>' +
      '<div class="ch-cols"><div><h4>敌人</h4><ul class="ch-foes">' + foes + '</ul>' +
      '<h4>星级要求</h4><ol class="ch-conds">' + conds.map(function (c, k) { var got = rec && rec.s[k]; return '<li class="' + (got ? 'ok' : '') + '"><span class="ch-star">' + (got ? '★' : '☆') + '</span>' + starTxt(c) + '</li>'; }).join('') + '</ol>' +
      '<p class="ch-rw"><b>首次通关奖励</b>　' + rwList(x.reward).map(function (t) { return '<span class="chip">' + t + '</span>'; }).join(' ') + (rec && rec.got ? '<span class="hint">（已领取）</span>' : '') + '</p></div>' +
      '<div><h4>出战精灵 <span class="hint">' + (T.helper ? '自己的 ' + T.own.length + ' / 4 只 + 1 只助战' : '自己的 ' + T.own.length + ' / 5 只') + '，点一下选上或取下</span></h4><div class="ch-mons">' + (ownHTML || '<p class="hint">当前配队是空的。</p>') + '</div>' +
      '<h4>助战精灵</h4>' + helpHTML + '</div></div>' +
      '<div class="ch-go"><button type="button" class="btn primary" data-chgo="' + sel + '"' + (ready_ ? '' : ' disabled') + '>开始挑战</button><span class="hint">战斗中可以使用补药；挑战失败不会有任何损失，可以反复挑战。</span></div></article>' + cbHTML(P) + '</div>';
  }
  // 出战顺序：自己的精灵用 'u' + 编号，助战精灵用 'h'；排在第一个的就是首发
  function chalLineup() {
    var T = chalTeam(), L = T.own.map(function (m) { return { k: 'u' + m.u, m: m }; });
    if (T.helper) L.push({ k: 'h', h: T.helper });
    var ord = ex.chalOrder || [];
    L.sort(function (a, b) { var ia = ord.indexOf(a.k), ib = ord.indexOf(b.k); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    return L;
  }
  function helperSpec(Hp) { var hm = storyMon({ sid: Hp.mon.sid, lv: Hp.mon.lv, moves: Hp.mon.moves || [], ev: Hp.mon.ev || null, nat: Hp.mon.nat || null, iv: Hp.mon.iv || null, shiny: shinyV(Hp.mon.shiny) }); hm.nick = hm.nick + '（' + Hp.owner + '）'; return hm; }
  // 首发选择面板：选好精灵、点「开始挑战」后弹出，拖动（或点「设为首发」）调整出战顺序
  function openLineup(P, i) {
    var x = CHAL[P][i]; if (!x) return;
    var L = chalLineup(); if (!L.some(function (e) { return e.m; })) return;
    var old = $('lu-dlg'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'lu-dlg';
    var card = function (e) {
      var f = e.m ? form(e.m) : form(e.h.mon), lv = e.m ? e.m.lv : e.h.mon.lv;
      return '<li class="lu-card" data-k="' + e.k + '"><span class="lu-no"></span><img src="' + f.img + '" alt="" draggable="false"><b>' + esc(f.name) + '</b><small>LV' + lv + (e.h ? ' · 助战（' + esc(e.h.owner) + '）' : '') + '</small>' + tchips(SPMAP[e.m ? e.m.sid : e.h.mon.sid].types) +
        '<button type="button" class="btn ghost lu-lead" data-lulead="' + e.k + '">设为首发</button></li>';
    };
    d.innerHTML = '<div class="soc-box lu-box" role="dialog" aria-modal="true" aria-label="选择首发"><span class="tape l"></span><span class="tape r"></span>' +
      '<span class="step">第 ' + (i + 1) + ' 关「' + esc(x.n) + '」</span><h2>出战顺序</h2><p class="hint">按住精灵拖动可以调整顺序，排在第一个的就是首发；也可以点「设为首发」。</p>' +
      '<ol class="lu-list" id="lu-list">' + L.map(card).join('') + '</ol>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-lux="1">返回修改</button><button type="button" class="btn primary" data-lugo="1">开始战斗</button></div></div>';
    document.body.appendChild(d);
    var list = d.querySelector('#lu-list');
    var mark = function () { Array.prototype.forEach.call(list.children, function (li, k) { li.querySelector('.lu-no').textContent = k ? '第 ' + (k + 1) + ' 位' : '首发'; li.classList.toggle('lead', !k); }); };
    var order = function () { return Array.prototype.map.call(list.children, function (li) { return li.dataset.k; }); };
    mark();
    // 拖动排序（和精灵背包统一，见 battle-ui.js 的 HSUI.sortable）
    HSUI.sortable(list, function () { mark(); });
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (t === d || t.closest('[data-lux]')) { ex.chalOrder = order(); d.remove(); return; }
      if (t.closest('[data-lulead]')) { var li = t.closest('.lu-card'); list.insertBefore(li, list.firstChild); mark(); return; }
      if (t.closest('[data-lugo]')) { ex.chalOrder = order(); d.remove(); startChal(P, i, ex.chalOrder); }
    });
  }
  function sconds0(x) { return ['win', x.s2, x.s3]; }
  function chalStarsOpt(i, x, sconds) {
    return { title: '第 ' + (i + 1) + ' 关「' + x.n + '」星级要求', list: function (S) { var mine = S.sides[0].team, rec = acc.chal && acc.chal[x.id]; return sconds.map(function (c, k) { var st = starLive(c, S, mine); return { t: starTxt(c), st: st[0], s: st[1], had: !!(rec && rec.s[k]) }; }); } };
  }
  function startChalRemote(P, i, x, sconds) {
    var L = chalLineup(), HP = null;
    L.forEach(function (e) { if (e.h) HP = e.h; });
    var helper = HP ? (HP.key === 'mm' ? 'mm' : { user: HP.user, u: +String(HP.key).split(':').pop() }) : null;
    if (bsOnline()) L.forEach(function (e) { if (e.h && e.h.user) CLOUD.api('POST', '/api/helper-use', { owner: e.h.user }).catch(function () {}); });   // 借了好友的助战：给主人记一次
    pveRemote('chal', { P: P, i: i, line: L.map(function (e) { return e.m ? e.m.u : 'h'; }), helper: helper }, { bg: BG[x.bg] || null, stars: chalStarsOpt(i, x, sconds) }, function (e, res) {
      var msg = [];
      if (e) {
        var r = e.rep;
        if (r.res === 'win' && r.ok) {
          msg.push('挑战第 ' + (i + 1) + ' 关「' + x.n + '」通过！本次 ' + r.ok.filter(Boolean).length + ' 颗星' + (r.after > r.before && r.before ? '，最好成绩提升到 ' + r.after + ' 颗星' : '') + '。');
          var miss = sconds.filter(function (c, k) { return !r.ok[k]; }).map(starTxt);
          if (miss.length) msg.push('没拿到的星：' + miss.join('；') + '。');
          if (r.first) msg.push('首次通关奖励：' + rwList(x.reward).join('、') + '。');
          if (CHAL[P][i + 1] && !r.before) { ex.chal = i + 1; msg.push('第 ' + (i + 2) + ' 关已开放。'); }
          var tot = chalTotal(P), mi = CHAL_STARS[P].filter(function (y) { return tot >= y.n && !chalGot(y.n, P); });
          if (mi.length) msg.push('累计星数达到 ' + mi[mi.length - 1].n + ' 颗，挑战页上方可以领取星数奖励！');
        } else if (r.res !== 'win') msg.push(e.quit ? '退出了挑战。' : '挑战失败了……调整一下出战精灵再来吧。');
        dailyHit('pve');
        msg = msg.concat(xpMsg(r.xp));
        save();
      } else if (res === 'void') msg.push('这场对战作废了，关卡记录没有变化。');
      bossBack('sites', function () { ex.planet = P; ex.fpart = 'challenge'; });
      if (msg.length) toast(msg.join(''));
    });
  }
  function startChal(P, i, ord) {
    var x = CHAL[P][i]; if (!x || !chalLevelOpen(P, i)) return;
    var T = chalTeam(); if (!T.own.length) return;
    ex.chalOrder = ord || ex.chalOrder;
    if (srvMode()) return startChalRemote(P, i, x, sconds0(x));
    var L = chalLineup(), own = L.filter(function (e) { return e.m; }).map(function (e) { return e.m; });
    var p = L.map(function (e) { return e.m ? storyMon(e.m) : helperSpec(e.h); });
    if (bsOnline()) L.forEach(function (e) { if (e.h && e.h.user) CLOUD.api('POST', '/api/helper-use', { owner: e.h.user }).catch(function () {}); });   // 借了好友的助战：给主人记一次
    var a = x.foes.map(function (f) { seeMon(f.sid, Math.min(f.lv, MAX_LV)); var o = storyMon({ sid: f.sid, lv: f.lv, moves: [] }); if (f.q) o.lvq = 1; return o; });
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    var sconds = ['win', x.s2, x.s3];
    window.HSBATTLE.start({ p: p, a: a, foe: '挑战第 ' + (i + 1) + ' 关「' + x.n + '」', bgm: 'stage',
      stars: { title: '第 ' + (i + 1) + ' 关「' + x.n + '」星级要求', list: function (S) { var mine = S.sides[0].team, rec = acc.chal && acc.chal[x.id]; return sconds.map(function (c, k) { var st = starLive(c, S, mine); return { t: starTxt(c), st: st[0], s: st[1], had: !!(rec && rec.s[k]) }; }); } }, items: invCopy(), bg: BG[x.bg] || null, onItem: useInv,
      onEnd: function (res, seen, downs, quit, S) {
        var msg = [];
        if (res === 'win' && S) {
          var mine = S.sides[0].team, conds = ['win', x.s2, x.s3];
          var ok = conds.map(function (c) { return starOk(c, S, mine); });
          if (!acc.chal) acc.chal = {};
          var r = acc.chal[x.id] || (acc.chal[x.id] = { s: [false, false, false] }), before = chalStars(x.id);
          ok.forEach(function (v, k) { if (v) r.s[k] = true; });
          msg.push('挑战第 ' + (i + 1) + ' 关「' + x.n + '」通过！本次 ' + ok.filter(Boolean).length + ' 颗星' + (chalStars(x.id) > before && before ? '，最好成绩提升到 ' + chalStars(x.id) + ' 颗星' : '') + '。');
          var miss = conds.filter(function (c, k) { return !ok[k]; }).map(starTxt);
          if (miss.length) msg.push('没拿到的星：' + miss.join('；') + '。');
          if (!r.got) { r.got = Date.now(); earn('chalFirst', x.id, { exp: x.reward.exp, energy: x.reward.energy, items: x.reward.items }); msg.push('首次通关奖励：' + rwList(x.reward).join('、') + '。'); }
          if (CHAL[P][i + 1] && !before) { ex.chal = i + 1; msg.push('第 ' + (i + 2) + ' 关已开放。'); }
          var tot = chalTotal(P), mi = CHAL_STARS[P].filter(function (y) { return tot >= y.n && !chalGot(y.n, P); });
          if (mi.length) msg.push('累计星数达到 ' + mi[mi.length - 1].n + ' 颗，挑战页上方可以领取星数奖励！');
        } else if (res !== 'win') msg.push(quit ? '退出了挑战。' : '挑战失败了……调整一下出战精灵再来吧。');
        dailyHit('pve');
        var ownSeen = seen ? L.map(function (e, k) { return e.m ? seen[k] : null; }).filter(function (v) { return v !== null; }) : null;
        msg = msg.concat(battleRewards(own, ownSeen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'sites'; ex.planet = P; ex.fpart = 'challenge';
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
        if (msg.length) toast(msg.join(''));
      } });
  }
  function chalClick(b) {
    if (b.dataset.chstar) { claimChalStar(+b.dataset.chstar, chalP()); renderExplore(); return true; }
    if (b.dataset.tpgo) { ex.planet = 'jingchu'; teleport(b.dataset.tpgo); return true; }
    if (b.dataset.chal != null && b.dataset.chal !== undefined && !b.disabled) {
      var i = +b.dataset.chal; ex.chal = i;
      // 第一次点开第二关：插播支线「借来的力量」，读完自动选上明明教官的赫菲斯
      if (i === 1 && chalP() === 'flora' && unlocked('fl_chal2') && !prog('fl_chal2').done) { ex.chalHelper = 'mm'; startVN('fl_chal2', 'replay', $('pg-explore'), true); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return true; }
      renderExplore(); return true;
    }
    if (b.dataset.chown) {
      var u = +b.dataset.chown, k = ex.chalOwn.indexOf(u);
      if (k >= 0) ex.chalOwn.splice(k, 1); else ex.chalOwn.push(u);
      renderExplore(); return true;
    }
    if (b.dataset.chhelp !== undefined) {
      ex.chalHelper = b.dataset.chhelp || null;
      if (ex.chalHelper) { var T = chalTeam(); if (T.own.length > 4) ex.chalOwn = T.own.slice(0, 4).map(function (m) { return m.u; }); }
      renderExplore(); return true;
    }
    if (b.dataset.chgo) {
      var gi = +b.dataset.chgo;
      if (gi === 1 && chalP() === 'flora' && unlocked('fl_chal2') && !prog('fl_chal2').done) { ex.chalHelper = 'mm'; startVN('fl_chal2', 'replay', $('pg-explore'), true); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return true; }   // 第二关：先强制播完明明教官的助战教学
      openLineup(chalP(), gi); return true;
    }
    return false;
  }



  /* ---------- CG 画廊（2026-10-17）：星球剧情页的第三栏，展示这颗星球的剧情里已经看过的 CG ---------- */
  var CG_NAME = { travelcat: '初遇叶子喵', leafsave: '光芒乍现' };
  function cgSrc(k, land) { var c = CG[k]; if (!c) return ''; var o = land ? c.land : c; return o ? (o[gender()] || o.m) : ''; }
  function cgList(sites) {   // 按剧情顺序列出这些剧情里出现的 CG：[{ k, site }]
    var out = [];
    sites.forEach(function (id) { (SCRIPT[id] || []).forEach(function (st) { if (st.cg && CG[st.cg] && !out.some(function (x) { return x.k === st.cg; })) out.push({ k: st.cg, site: id }); }); });
    return out;
  }
  function cgGot(k, site) { return !!((acc.cgSeen && acc.cgSeen[k]) || prog(site).done); }
  function cgGallery(sites) {
    var L = cgList(sites), n = L.filter(function (x) { return cgGot(x.k, x.site); }).length;
    if (!L.length) return '<p class="hint fl-none">这颗星球的剧情里还没有 CG。</p>';
    return '<p class="hint cg-count">已解锁 ' + n + ' / ' + L.length + ' 张 · 点击查看大图</p><div class="cg-grid">' + L.map(function (x) {
      var S = SITES[x.site], got = cgGot(x.k, x.site);
      return got ? '<button type="button" class="cg-th" data-cgview="' + x.k + '"><span class="cg-img" style="background-image:url(' + cgSrc(x.k) + ')"></span><b>' + esc(CG_NAME[x.k] || x.k) + '</b><small>' + esc(S.chapter) + '</small></button>'
        : '<div class="cg-th locked"><span class="cg-img"><i>？</i></span><b>？？？</b><small>在「' + esc(S.chapter) + '」中解锁</small></div>';
    }).join('') + '</div>';
  }
  function openCgView(k) {
    var old = $('cgv-dlg'); if (old) old.remove();
    var land = cgSrc(k, true), d = document.createElement('div'); d.className = 'cgv-dlg'; d.id = 'cgv-dlg';
    d.innerHTML = '<div class="cgv-box" role="dialog" aria-modal="true" aria-label="' + esc(CG_NAME[k] || 'CG') + '"><img id="cgv-img" src="' + cgSrc(k) + '" alt="' + esc(CG_NAME[k] || '') + '">' +
      '<div class="cgv-bar"><b>' + esc(CG_NAME[k] || k) + '</b>' + (land ? '<button type="button" class="btn" data-cgflip="1">切换横版 / 竖版</button>' : '') + '<button type="button" class="btn primary" data-cgx="1">关闭</button></div></div>';
    document.body.appendChild(d);
    var isLand = false;
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-cgflip]')) { isLand = !isLand; $('cgv-img').src = cgSrc(k, isLand); return; }
      if (e.target === d || e.target.closest('[data-cgx]')) d.remove();
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('cgv-dlg')) $('cgv-dlg').remove(); });

  /* ---------- 对战结束后的奖励面板（2026-10-18） ----------
   * 所有用 HSBATTLE.start 开始的对战（野外、剧情、挑战、BOSS、先驱之塔……），结束时的提示都收进一个面板：
   *   上面一行一种奖励，下面是出战精灵的经验条特写（从原来的位置涨到现在的位置，升级的会先涨满）。点「确定」关闭。 */
  var REW = { collect: false, capture: false, lines: [], gains: [] };
  function rewWrap() {
    if (!window.HSBATTLE || HSBATTLE._rew) return;
    var start0 = HSBATTLE.start;
    HSBATTLE.start = function (opt) {
      var end0 = opt.onEnd;
      REW.exp0 = acc ? (acc.exp || 0) : 0;   // 2026-10-27：开战时的经验背包，结算时算这一场加了多少
      opt.onEnd = function () {
        REW = { collect: true, capture: true, lines: [], gains: [], res: arguments[0], exp0: REW.exp0 };
        try { return end0 && end0.apply(this, arguments); }
        finally { REW.collect = false; setTimeout(rewShow, 0); }   // 等同一轮里排队的提示（如新称号）也收进来，马上弹出
      };
      return start0(opt);
    };
    HSBATTLE._rew = true;
  }
  function rewShow() {
    REW.capture = false;
    var rows = [];
    REW.lines.forEach(function (t) { String(t).split(/(?<=[。！：])/).forEach(function (x) { x = x.trim().replace(/：$/, '。'); if (x && !/^[^，。]*获得了 [\d,]+ 点经验/.test(x) && !/^经验背包 \+[\d,]+。?$/.test(x)) rows.push(x); }); });
    var pool = acc && REW.exp0 != null ? Math.max(0, Math.round((acc.exp || 0) - REW.exp0)) : 0;   // 这一场进经验背包的经验（单独一块显示）   // 每只精灵各自的经验在下面的经验条里显示
    var g = {}, order = [];
    REW.gains.forEach(function (x) { if (!g[x.u]) { g[x.u] = { u: x.u, lv0: x.lv0, exp0: x.exp0, amt: 0 }; order.push(x.u); } g[x.u].amt += x.amt; });
    if (!rows.length && !order.length && !pool) return;
    var old = $('rew-dlg'); if (old) old.remove();
    var frac = function (lv, exp) { if (lv >= MAX_LV) return 1; var a = expAt(lv), b = expAt(lv + 1); return Math.max(0, Math.min(1, (exp - a) / (b - a))); };
    var monsH = order.map(function (u) {
      var x = g[u], m = mon(u); if (!m) return '';
      var f = form(m), up = m.lv > x.lv0, f0 = frac(x.lv0, x.exp0), f1 = atCap(m) ? 1 : frac(m.lv, m.exp);
      return '<li class="rw-mon"><img src="' + f.img + '" alt=""><div class="rw-mt"><b>' + esc(f.name) + '</b><span class="rw-lv">LV' + x.lv0 + (up ? ' → <em>LV' + m.lv + '</em>' : '') + '</span>' +
        '<div class="rw-bar" data-f0="' + f0 + '" data-f1="' + f1 + '" data-up="' + (m.lv - x.lv0) + '"><i style="width:' + (f0 * 100) + '%"></i></div>' +
        '<b class="rw-num" data-n="' + x.amt + '">+0 经验</b>' + (up || atCap(m) ? '<small>' + (up ? '升级了！' : '') + (atCap(m) ? (up ? ' · ' : '') + '已到等级上限' : '') + '</small>' : '') + '</div></li>';
    }).join('');
    var d = document.createElement('div'); d.className = 'soc-dlg rew-dlg'; d.id = 'rew-dlg';
    d.innerHTML = '<div class="soc-box rew-box" role="dialog" aria-modal="true" aria-label="战斗奖励"><span class="tape l"></span><span class="tape r"></span><h2>' + ({ win: '胜利！', lose: '失败了', caught: '捕捉成功！', flee: '顺利逃走了', spared: '手下留情' }[REW.res] || '战斗结算') + '</h2>' +
      (rows.length ? '<ul class="rw-rows">' + rows.map(function (t, i) { return '<li style="animation-delay:' + (i * 70) + 'ms">' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (pool ? '<h4 class="rw-h">经验背包</h4><div class="rw-pool"><img src="images/items/exp.png" alt=""><div><b class="rw-pool-n rw-num" data-n="' + pool + '">+0 经验</b><small>现在共有 ' + fmt(acc.exp || 0) + ' 点，可以分配给任意精灵</small></div></div>' : '') +
      (monsH ? '<h4 class="rw-h">出战精灵</h4><ul class="rw-mons">' + monsH + '</ul>' : '') +
      '<div class="soc-foot"><button type="button" class="btn primary" data-rewok="1">确定</button></div></div>';
    document.body.appendChild(d);
    // 经验条动画：升级的先涨满（每升一级涨满一次），再涨到现在的位置
    // 经验背包、出战精灵的经验数字：从 0 滚到这一场加的数
    Array.prototype.forEach.call(d.querySelectorAll('.rw-num'), function (pn) { var tgt = +pn.dataset.n, t0 = performance.now(); (function tick(now) { var k = Math.min(1, (now - t0) / 900); pn.textContent = '+' + fmt(Math.round(tgt * (1 - Math.pow(1 - k, 3)))) + ' 经验'; if (k < 1 && pn.isConnected) requestAnimationFrame(tick); })(t0); });
    Array.prototype.forEach.call(d.querySelectorAll('.rw-bar'), function (bar) {
      var i = bar.querySelector('i'), f1 = +bar.dataset.f1, up = +bar.dataset.up, step = 0;
      var next = function () {
        if (step < up) { step++; i.style.transition = 'width .45s ease-in'; i.style.width = '100%'; setTimeout(function () { i.style.transition = 'none'; i.style.width = '0%'; void i.offsetWidth; next(); }, 480); }
        else { i.style.transition = 'width .7s ease-out'; i.style.width = (f1 * 100) + '%'; }
      };
      setTimeout(next, 350);
    });
    d.addEventListener('click', function (e) { if (e.target.closest('[data-rewok]')) d.remove(); });
  }
  rewWrap();
  /* ---------- 获得物品弹窗（2026-10-19）：战斗以外拿到道具（采集、领取、合成、邮件、兑换……）也弹一个和战斗结算一样的面板 ----------
   * 做法：每次点击之后对比道具数量，有增加的就弹出来（同时列出这次一起得到的能量、经验背包）。战斗中 / 战斗结算面板开着时不弹（战斗面板已经会列出来） */
  var IG = { snap: null, acc: null };
  function igSnap() { return { it: Object.assign({}, acc.items || {}), en: acc.energy || 0, ex: acc.exp || 0 }; }
  function igBusy() { return ex.fighting || ($('battle') && !$('battle').hidden) || !!$('rew-dlg') || !!$('ig-dlg') || document.body.classList.contains('story-fight'); }
  function igCheck() {
    if (!ready()) { IG.snap = null; return; }
    if (!IG.snap || IG.acc !== acc) { IG.snap = igSnap(); IG.acc = acc; return; }
    var cur = igSnap(), old = IG.snap, gain = [];
    Object.keys(cur.it).forEach(function (k) { var d = (cur.it[k] || 0) - (old.it[k] || 0); if (d > 0) gain.push([k, d]); });
    if (igBusy() || !gain.length) { IG.snap = cur; return; }   // 战斗里得到的东西由战斗结算面板列出
    IG.snap = cur;
    var rows = gain.map(function (g) { return '<li class="ig-row"><span class="ig-ic">' + H.itemIcon(g[0]) + '</span><b>' + esc(itemName(g[0])) + '</b><em>×' + fmt(g[1]) + '</em><small>持有 ' + fmt(cur.it[g[0]]) + '</small></li>'; });
    if (cur.en > old.en) rows.push('<li class="ig-row"><span class="ig-ic">' + H.itemIcon('energy') + '</span><b>能量</b><em>×' + fmt(cur.en - old.en) + '</em></li>');
    if (cur.ex > old.ex) rows.push('<li class="ig-row"><span class="ig-ic">' + H.itemIcon('exp') + '</span><b>经验背包</b><em>×' + fmt(cur.ex - old.ex) + '</em></li>');
    var d = document.createElement('div'); d.className = 'soc-dlg rew-dlg ig-dlg'; d.id = 'ig-dlg';
    d.innerHTML = '<div class="soc-box rew-box" role="dialog" aria-modal="true" aria-label="获得物品"><span class="tape l"></span><span class="tape r"></span><h2>获得物品</h2>' +
      '<ul class="rw-rows ig-rows">' + rows.map(function (r, i) { return r.replace('<li class="ig-row">', '<li class="ig-row" style="animation-delay:' + (i * 70) + 'ms">'); }).join('') + '</ul>' +
      '<p class="hint">已放入储存箱。</p><div class="soc-foot"><button type="button" class="btn primary" data-igok="1">确定</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-igok]')) { d.remove(); IG.snap = igSnap(); } });
  }
  document.addEventListener('click', function () { setTimeout(igCheck, 80); setTimeout(igCheck, 1200); }, true);   // 点完之后看一眼（有的奖励要等服务器回来，再看一次）
  /* ---------- 全服挑战进度（2026-10-17）：星球挑战页、先驱之塔页下方，服务器见 server/chalboard.js ---------- */
  var CB = {};
  function cbFetch(k) {
    var C = CB[k] || (CB[k] = { data: null, at: 0, busy: false });
    if (!pwOnline() || C.busy || (C.data && Date.now() - C.at < 30000)) return;
    C.busy = true;
    CLOUD.api('GET', '/api/chalboard?k=' + k).then(function (r) { C.busy = false; if (r._code === 200) { C.data = r; C.at = Date.now(); var el = $('cb-' + k); if (el) el.innerHTML = cbInner(k); } })
      .catch(function () { C.busy = false; });
  }
  function cbVal(k, r) { return k === 'tower' ? (r.s ? '通关 ' + r.s + ' 次' : '最高第 ' + r.v + ' 层') : '第 ' + r.v + ' 关 · ★' + r.s; }
  function cbInner(k) {
    var h = '<h4>全服挑战进度</h4>';
    if (!pwOnline()) return h + '<p class="hint">联网登录后，可以看到全服船员的挑战进度。</p>';
    var d = CB[k] && CB[k].data; if (!d) return h + '<p class="hint">正在读取……</p>';
    if (!d.players) return h + '<p class="hint">还没有船员开始挑战。来做第一个吧！</p>';
    var mx = Math.max.apply(null, d.buckets.map(function (b) { return b.n; }).concat([1]));
    return h + '<p class="hint">共 ' + d.players + ' 位船员参与' + (d.me ? '，你排第 <b>' + d.me.rank + '</b> 名（' + cbVal(k, d.me) + '）' : '') + '。' + (k === 'tower' ? '按通关次数、最高层数排名。' : '按最远关卡、星数排名。') + '</p>' +
      '<ul class="cb-bars">' + d.buckets.map(function (b) { return '<li><span>' + esc(b.label) + '</span><i><em style="width:' + (b.n / mx * 100).toFixed(1) + '%"></em></i><b>' + b.n + ' 人</b></li>'; }).join('') + '</ul>' +
      '<ol class="cb-top">' + d.top.map(function (r, i) { return '<li class="' + (d.me && r.user === d.me.user ? 'me' : '') + '"><span class="cb-rk">' + (i + 1) + '</span><span class="cb-nm">' + esc(r.name) + '</span><span class="cb-v">' + cbVal(k, r) + '</span></li>'; }).join('') + '</ol>';
  }
  function cbHTML(k) { setTimeout(function () { cbFetch(k); }, 0); return '<article class="cb-card" id="cb-' + k + '">' + cbInner(k) + '</article>'; }
  /* ---------- 先驱之塔（2026-10-17） ----------
   * 星球列表里排在荆楚号后面，读完第五段「降临芙罗拉」后开放。共 60 层，从下往上一层一层打。
   * 第 1、11、21、31、41、51 层自动存档；挑战失败（或中途退出）回到最近的存档点。
   * 第 1~59 层：玩家能获得的各种精灵，LV40 → LV80，每层 1~3 只，体力偏高，各带 1~2 个特性（逢 10 的层是 1 只更强的守层者）。
   * 第 60 层：死神「帕努托尔」LV80、体力 10000，【不朽】【肃穆】【死神】。击败后：称号「死神」、死神代币（一个账号最多 3 颗）、大量经验和代币，回到第 1 层。
   * 每天从塔里最多拿 150000 经验、1000 先驱代币（正好是通关两次的量）。
   * 存档：acc.tower = { f 当前层, cp 存档点, best 最高通过层, clears 通关次数, death 已获得的死神代币, tok 先驱代币, day: { d, exp, tok } } */
  // 先驱之塔的规则（层数、对手、奖励）在 js/engine/pve.js，服务器和本机共用（2026-10-24）
  var TOWER = PVE.TOWER, twLv = PVE.twLv, twExp = PVE.twExp, twTok = PVE.twTok, twFloor = PVE.twFloor;
  var TW_SHOP = TX.D.TW_SHOP;   // 商品和价格在 js/engine/tx.js
  function twRec() { return TX.twRec(acc, Date.now()); }
  function twExp0(f) { return f >= TOWER.top ? 16000 : 400 + 20 * f; }   // 调整前（补偿邮件用）
  function twTok0(f) { return f >= TOWER.top ? 232 : 2 + Math.floor(f / 10); }
  function fxNames(fx) { return BOSS_FX.filter(function (x) { return fx[x.k]; }).map(function (x) { return x; }); }
  function towerSvg() {
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 8 L72 30 H48 Z" fill="#c42f3a" stroke="#23222b" stroke-width="3" stroke-linejoin="round"/>' +
      '<rect x="46" y="30" width="28" height="78" fill="#e6eaf0" stroke="#23222b" stroke-width="3"/>' +
      [40, 54, 68, 82, 96].map(function (y) { return '<rect x="55" y="' + y + '" width="10" height="7" rx="2" fill="#f2c46b" stroke="#23222b" stroke-width="2"/>'; }).join('') +
      '<path d="M34 108 H86" stroke="#23222b" stroke-width="4" stroke-linecap="round"/></svg>';
  }
  function towerPage() {
    var T = twRec(), tab = ex.twTab === 'shop' ? 'shop' : 'climb';
    var head = '<div class="tw-head"><div class="tw-stat"><b>第 ' + T.f + ' 层</b><span>当前</span></div><div class="tw-stat"><b>第 ' + T.cp + ' 层</b><span>存档点</span></div><div class="tw-stat"><b>' + T.clears + '</b><span>通关次数</span></div>' +
      '<div class="tw-stat"><b>' + fmt(T.tok) + '</b><span>先驱代币</span></div><div class="tw-stat"><b>' + (acc.items.deathTok || 0) + '</b><span>死神代币</span></div></div>' +
      '<p class="hint tw-day">今天从先驱之塔获得：累积经验 ' + fmt(T.day.exp) + ' / ' + fmt(TOWER.dayExp) + '，先驱代币 ' + T.day.tok + ' / ' + TOWER.dayTok + '（北京时间 0 点重置）</p>' +
      '<div class="fparts" role="tablist"><button type="button" role="tab" class="tab' + (tab === 'climb' ? ' on' : '') + '" data-twtab="climb">挑战</button><button type="button" role="tab" class="tab' + (tab === 'shop' ? ' on' : '') + '" data-twtab="shop">代币商店</button></div>';
    return '<div class="tw-wrap">' + head + (tab === 'shop' ? towerShop(T) : towerClimb(T)) + '</div>';
  }
  function towerClimb(T) {
    var ladder = '<ol class="tw-ladder">';
    for (var f = TOWER.top; f >= 1; f--) {
      var cls = f < T.f ? 'done' : f === T.f ? 'cur' : 'lock';
      ladder += '<li class="tw-fl ' + cls + (f === TOWER.top ? ' top' : '') + (f % 10 === 0 && f < TOWER.top ? ' gate' : '') + '" title="第 ' + f + ' 层' + (TOWER.cps.indexOf(f) >= 0 ? '（存档点）' : '') + '">' + (TOWER.cps.indexOf(f) >= 0 ? '<i class="tw-cp" aria-hidden="true">⚑</i>' : '') + (f === TOWER.top ? '☠' : f) + '</li>';
    }
    ladder += '</ol>';
    var F = twFloor(T.f), team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (F.boss && (!ex.twPick || !team.some(function (m) { return m.u === ex.twPick; }))) ex.twPick = team.length ? team[0].u : null;
    var foes = F.foes.map(function (x) {
      var fm = form({ sid: x.sid, lv: x.lv }), k = wildKnown(x.sid) || F.boss;
      return '<li class="tw-foe"><img src="' + fm.img + '" alt=""><div><b>' + (F.boss ? '死神 · ' : '') + esc(fm.name) + '</b><small>LV' + x.lv + ' · 体力 ' + fmt(x.hp) + '</small><div class="tw-fx">' +
        fxNames(x.fx).map(function (z) { return '<span class="chip boss-diff" title="' + esc(z.d({ boss: x.fx, hp: x.hp })) + '">' + z.t + '</span>'; }).join('') + '</div>' +
        '<ul class="tw-fxd">' + fxNames(x.fx).map(function (z) { return '<li><b>【' + z.t + '】</b>' + esc(z.d({ boss: x.fx, hp: x.hp })) + '</li>'; }).join('') + '</ul></div></li>';
    }).join('');
    var ge = Math.min(twExp(T.f), Math.max(0, TOWER.dayExp - T.day.exp)), gt = Math.min(twTok(T.f), Math.max(0, TOWER.dayTok - T.day.tok));
    var teamHTML = F.boss ? '<h4>出战精灵 <span class="hint">【肃穆】只能派一只精灵单挑，点一下选择</span></h4><div class="ch-mons">' + team.map(function (m) { var f = form(m), on = m.u === ex.twPick; return '<button type="button" class="ch-mon' + (on ? ' on' : '') + '" data-twpick="' + m.u + '" aria-pressed="' + on + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + '</small></button>'; }).join('') + '</div>'
      : '<p class="hint">使用当前的出战配队（' + tName(acc.active) + '，' + team.length + ' 只）。战斗中可以使用补药。</p>';
    return '<div class="tw-cols">' + ladder + '<article class="tw-detail"><span class="tape r"></span><span class="sc-tag">' + (F.boss ? '塔顶 · 第 60 层' : F.gate ? '第 ' + T.f + ' 层 · 守层者' : '第 ' + T.f + ' 层') + '</span>' +
      '<h3>' + (F.boss ? '死神「帕努托尔」' : '第 ' + T.f + ' 层') + '</h3><ul class="tw-foes">' + foes + '</ul>' +
      '<p class="ch-rw"><b>通过奖励</b>　<span class="chip">累积经验 ×' + fmt(twExp(T.f)) + '</span> <span class="chip">先驱代币 ×' + twTok(T.f) + '</span>' + (F.boss ? ' <span class="chip">死神代币 ×1（' + T.death + ' / ' + TOWER.deathMax + '）</span> <span class="chip">称号「死神」</span>' : '') +
      (ge < twExp(T.f) || gt < twTok(T.f) ? '<span class="hint">（今天的塔内奖励快到上限了：这一层实际只能拿到经验 ×' + fmt(ge) + '、代币 ×' + gt + '）</span>' : '') + '</p>' +
      teamHTML +
      '<div class="ch-go"><button type="button" class="btn primary" data-twgo="1"' + (team.length ? '' : ' disabled') + '>挑战第 ' + T.f + ' 层</button><span class="hint">第 1、11、21、31、41、51 层自动存档；挑战失败或中途退出，会回到存档点第 ' + T.cp + ' 层。' + (F.boss ? '击败死神后回到第 1 层。' : '') + '</span></div></article></div>' + cbHTML('tower');
  }
  function towerShop(T) {
    return '<p class="hint">用先驱代币兑换道具。性格在这个世界里格外珍稀，所以性格胶囊很贵。</p><div class="tw-shop">' + TW_SHOP.map(function (x, i) {
      var it = USE_ITEMS[x.k] || MATS[x.k] || ITEMS[x.k], ok = T.tok >= x.cost && (!x.death || (acc.items.deathTok || 0) >= x.death);
      return '<article class="tw-item"><b>' + itemName(x.k) + '</b><p class="hint">' + esc(it ? it.sd || it.d : '') + '</p><p class="tw-cost">' + fmt(x.cost) + ' 先驱代币' + (x.death ? ' + ' + x.death + ' 死神代币' : '') + '</p>' +
        '<button type="button" class="btn' + (ok ? ' primary' : '') + '" data-twbuy="' + i + '"' + (ok ? '' : ' disabled') + '>兑换</button>' + (acc.items[x.k] ? '<span class="hint">已有 ' + acc.items[x.k] + '</span>' : '') + '</article>';
    }).join('') + '</div>';
  }
  // 先驱之塔（2026-10-19）：开战前先确认阵容
  function twConfirm() {
    var T = twRec(), F = twFloor(T.f), team = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!team.length) return;
    team = F.boss ? [mon(ex.twPick) || team[0]] : team.slice(0, TEAM_SIZE);
    var d = document.createElement('div'); d.className = 'soc-dlg';
    d.innerHTML = '<div class="soc-box tw-confirm" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span><span class="step">先驱之塔 · ' + (F.boss ? '第 60 层 · 死神' : '第 ' + T.f + ' 层') + '</span><h2>确认出战阵容</h2>' +
      '<p class="hint">' + (F.boss ? '塔顶只能派 1 只精灵。' : '当前出战配队（' + tName(acc.active) + '），按顺序出场，第 1 只首发。') + '失败或中途退出会回到最近的存档点。</p>' +
      '<div class="twc-team">' + team.map(function (m, i) { var f = form(m); return '<div class="twc-mon"><span class="me-no">' + (i + 1) + '</span><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + '</small></div>'; }).join('') + '</div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-twc="team">调整配队</button><button type="button" class="btn ghost" data-twc="x">取消</button><button type="button" class="btn primary" data-twc="go">开战</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-twc]');
      if (e.target === d || (b && b.dataset.twc === 'x')) { d.remove(); return; }
      if (!b) return;
      d.remove();
      if (b.dataset.twc === 'go') startTower(); else go('bag');
    });
  }
  // 用服务器网址玩时，先驱之塔由服务器开打和结算（server/pve.js）；本地双击打开时在本机结算（下面的 startTower）
  var twBusy = false;
  function startTower() {
    if (!srvMode()) return startTowerLocal();
    pveRemote('tower', { pick: ex.twPick }, { back: '先驱之塔' }, function (e, res) {
      var msg = [];
      if (e) {
        var r = e.rep, f = r.f;
        dailyHit('pve');
        if (r.res === 'win') {
          msg.push('先驱之塔第 ' + f + ' 层通过！' + (r.ge || r.gt ? '获得累积经验 ×' + fmt(r.ge) + '、先驱代币 ×' + r.gt + (r.ge < twExp(f) || r.gt < twTok(f) ? '（已到今天的塔内奖励上限）' : '') + '。' : '今天从先驱之塔获得的奖励已经到上限了。'));
          if (r.boss) { msg.push(r.death ? '获得「死神代币」×1（' + r.T.death + ' / ' + TOWER.deathMax + '）。' : '死神代币已经拿满 ' + TOWER.deathMax + ' 颗了。'); msg.push('塔顶的光芒把你送回了第 1 层。'); }
          else if (r.cp) msg.push('到达第 ' + r.T.f + ' 层，进度已自动存档。');
        } else msg.push((r.quit ? '退出了挑战' : '挑战失败了') + '……回到存档点第 ' + r.T.cp + ' 层。');
        msg = msg.concat(xpMsg(r.xp));
        save();
      } else if (res === 'void') msg.push('这场对战作废了，塔的进度没有变化。');
      bossBack('sites', function () { ex.planet = 'tower'; ex.twTab = 'climb'; });
      renderExplore();
      if (msg.length) toast(msg.join(''));
    });
  }
  function startTowerLocal() {
    var T = twRec(), f = T.f, F = twFloor(f);
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!team.length) return;
    team = F.boss ? [mon(ex.twPick) || team[0]] : team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon);
    var a = F.foes.map(function (x) { seeMon(x.sid, x.lv); var fm = form({ sid: x.sid, lv: x.lv }); return { id: x.sid, lv: x.lv, moves: F.boss ? defaultMoves(x.sid, x.lv) : foeMoves(x.sid, x.lv), nick: (F.boss ? '死神 · ' : '') + fm.name, img: fm.img, maxhp: x.hp, boss: JSON.parse(JSON.stringify(x.fx)) }; });
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: '先驱之塔', diff: F.boss ? '第 60 层 · 死神' : '第 ' + f + ' 层', bgm: F.boss ? 'boss3' : 'stage', items: invCopy(), onItem: useInv, back: '先驱之塔',
      onEnd: function (res, seen, downs, quit) {
        var msg = [];
        dailyHit('pve');
        if (res === 'win') {
          var ge = Math.min(twExp(f), Math.max(0, TOWER.dayExp - T.day.exp)), gt = Math.min(twTok(f), Math.max(0, TOWER.dayTok - T.day.tok));
          T.day.exp += ge; T.day.tok += gt; earn('tower', f, { exp: ge, twTok: gt }); T.best = Math.max(T.best, f);
          msg.push('先驱之塔第 ' + f + ' 层通过！' + (ge || gt ? '获得累积经验 ×' + fmt(ge) + '、先驱代币 ×' + gt + (ge < twExp(f) || gt < twTok(f) ? '（已到今天的塔内奖励上限）' : '') + '。' : '今天从先驱之塔获得的奖励已经到上限了。'));
          if (F.boss) {
            T.clears++;
            if (T.death < TOWER.deathMax) { T.death++; earn('towerDeath', T.death, { items: { deathTok: 1 } }); msg.push('获得「死神代币」×1（' + T.death + ' / ' + TOWER.deathMax + '）。'); } else msg.push('死神代币已经拿满 ' + TOWER.deathMax + ' 颗了。');
            T.f = 1; T.cp = 1; msg.push('塔顶的光芒把你送回了第 1 层。');
          } else { T.f = f + 1; if (TOWER.cps.indexOf(T.f) >= 0) { T.cp = T.f; msg.push('到达第 ' + T.f + ' 层，进度已自动存档。'); } }
        } else { T.f = T.cp; msg.push((quit ? '退出了挑战' : '挑战失败了') + '……回到存档点第 ' + T.cp + ' 层。'); }
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'sites'; ex.planet = 'tower'; ex.twTab = 'climb';
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
        if (msg.length) toast(msg.join(''));
      } });
  }
  function towerClick(b) {
    if (b.dataset.twtab) { ex.twTab = b.dataset.twtab; renderExplore(); return true; }
    if (b.dataset.twpick) { ex.twPick = +b.dataset.twpick; renderExplore(); return true; }
    if (b.dataset.twgo) { twConfirm(); return true; }
    if (b.dataset.twbuy != null && b.dataset.twbuy !== undefined) {
      var T = twRec(), x = TW_SHOP[+b.dataset.twbuy]; if (!x) return true;
      if (T.tok < x.cost || (x.death && (acc.items.deathTok || 0) < x.death)) { toast('代币不够。'); return true; }
      txRun('tower', { i: +b.dataset.twbuy }, function () {
        renderExplore();
        toast('兑换了「' + itemName(x.k) + '」，已放入储存箱。' + (x.k === 'e_pluto' ? '放进神农架 · 精灵保育仓就能孵化。' : ''));
      });
      return true;
    }
    return false;
  }
  // 其他星球的探索页（只有捕捉）
  function wildPage(P) {
    var regs = regionsOf(P.id);
    var stIds = P.storyIds || P.sites || [], hasStory = stIds.length > 0, ST = hasStory ? storyTabs(stIds) : null;
    var hasChal = !!CHAL[P.id], part = ex.fpart === 'task' ? 'task' : ex.fpart === 'story' && hasStory ? 'story' : ex.fpart === 'challenge' && hasChal ? 'challenge' : 'catch';
    var head = '<div class="flora-hero"><span class="tape l"></span>' + (P.img ? planetImg(P, 150) : planetSvgC(P, 150)) + '<div><h3 style="color:' + P.color[1] + '">' + P.name + ' <span class="chip ptype">' + P.ptype + '</span></h3><p class="hint">' + P.d + (P.img ? '' : '星球立绘还在绘制中，这里先用示意图。') + '</p>' +
      '<div class="fparts" role="tablist">' + (hasStory ? '<button type="button" role="tab" class="tab' + (part === 'story' ? ' on' : '') + '" data-fpart="story" aria-selected="' + (part === 'story') + '">剧情' + (ST.any ? '<i class="q-badge">!</i>' : '') + '</button>' : '') +
      (hasChal ? '<button type="button" role="tab" class="tab' + (part === 'challenge' ? ' on' : '') + '" data-fpart="challenge" aria-selected="' + (part === 'challenge') + '">挑战</button>' : '') +
      '<button type="button" role="tab" class="tab' + (part === 'catch' ? ' on' : '') + '" data-fpart="catch" aria-selected="' + (part === 'catch') + '">探索</button>' + taskTab(P.id, part) + '</div></div></div>';
    if (part === 'task') return head + planetTasks(P.id);
    if (part === 'challenge') return head + chalPage(P.id);
    if (part === 'story') return head + ST.html(P.storyEmpty);
    var cards = regs.map(function (R) {
      var bgs = (R.bgs || []).filter(function (k) { return BG[k]; });
      return '<article class="region"><div class="rg-art">' + (bgs.length ? '<img src="' + BG[bgs[0]] + '" alt="' + R.name + '">' : regionArt(R.id)) + '</div><div class="rg-txt"><h4>' + R.name + ' <small>' + R.en + '</small></h4><p class="hint">' + R.d + '</p>' +
        '<button type="button" class="btn primary" data-field="' + R.id + '">进入' + R.name + '</button></div></article>';
    }).join('');
    var list = [];
    var seenSid = {};   // 同一种精灵在几个区域都有时，合成一条，「出现」里列出各个区域
    regs.forEach(function (R) { (WILD[R.pool] || []).forEach(function (w) {
      if (seenSid[w.sid]) return; seenSid[w.sid] = 1;
      var k = wildKnown(w.sid), f = form({ sid: w.sid, lv: w.lv[0] }), sid_ = w.sid;
      var where = []; regs.forEach(function (R2) { (WILD[R2.pool] || []).forEach(function (x) { if (x.sid === w.sid) where.push(x.bait ? R2.name + '（放了一碗饭的场景）' + Math.round(RICE.chance * 100) + '%' : R2.name + ' ' + x.w + '%'); }); });
      list.push('<li class="wl ' + (k || 'unk') + '">' + (k ? '<img src="' + f.img + '" alt="">' : silTag(sid_, f.stage)) + '<span><b>' + (k ? esc(f.name) : '？？？') + '</b>' + (w.rare ? '<span class="chip rare">稀有</span>' : '') +
        '<small>LV' + (w.lv[0] === w.lv[1] ? w.lv[0] + '（固定）' : w.lv[0] + '–' + w.lv[1]) + ' · 捕捉率' + w.tag + '</small><small>出现：' + where.join(' · ') + '</small>' +
        '<small class="wk">' + (k === 'own' ? '已捕捉' : k === 'seen' ? '见过 · 未捕捉' : '未遇见') + '</small></span></li>');
    }); });
    regs.forEach(function (R) { (R.bgs || []).forEach(function (bk) { ((typeof WILD_SCENE !== 'undefined' && WILD_SCENE[bk]) || []).forEach(function (w) {   // 只在某个场景出现的精灵
      if (seenSid[w.sid]) return; seenSid[w.sid] = 1;
      var tot = (WILD[R.pool] || []).reduce(function (a, x) { return a + x.w; }, 0), pct = Math.round(w.w / (tot + w.w) * 100);
      var k = wildKnown(w.sid), f = form({ sid: w.sid, lv: w.lv[0] });
      list.push('<li class="wl ' + (k || 'unk') + '">' + (k ? '<img src="' + f.img + '" alt="">' : silTag(w.sid, f.stage)) + '<span><b>' + (k ? esc(f.name) : '？？？') + '</b>' + (w.rare ? '<span class="chip rare">稀有</span>' : '') +
        '<small>LV' + (w.lv[0] === w.lv[1] ? w.lv[0] + '（固定）' : w.lv[0] + '–' + w.lv[1]) + ' · 捕捉率' + w.tag + '</small><small>出现：' + R.name + ' · ' + (BG_NAME[bk] || '某个场景') + ' ' + pct + '%</small>' +
        '<small class="wk">' + (k === 'own' ? '已捕捉' : k === 'seen' ? '见过 · 未捕捉' : '未遇见') + '</small></span></li>');
    }); }); });
    return head + invLine() + '<div class="regions">' + cards + '</div>' +
      '<div class="wild-list"><h4>' + P.name + '的野生精灵</h4><ul>' + list.join('') + '</ul><p class="hint">进入区域后，精灵会在场景里走动，点中哪只就和哪只对战。捕捉、经验和学习力的规则和芙罗拉星一样。</p></div>';
  }

  /* ---------- 星球任务：每颗星球的专属任务 ---------- */
  // 芙罗拉星 · 祛除瘴气：任务完成前，在芙罗拉星作战有 10% 概率遇到瘴气精灵（自带 5 层瘴气，无法捕捉），击败它们累计计数
  var PURGE = PVE.PURGE;
  var PURGE_OLD = { 1: 300, 5: 1000, 10: 2000, 20: 4000, 30: 12000 };   // ×10 之前（补差额用）
  function purgeRec() { if (!acc.purge) acc.purge = { n: 0, got: {} }; return acc.purge; }
  function purgeActive() { return prog('flora1').done && purgeRec().n < PURGE.goal; }
  function purgeHit() {
    var P = purgeRec(), out = []; P.n++;
    out.push('祛除了一只瘴气精灵（' + P.n + ' / ' + PURGE.goal + '）。');
    PURGE.steps.forEach(function (s) {
      if (P.n >= s.n && !P.got[s.n]) {
        P.got[s.n] = Date.now(); earn('purge', s.n, { exp: s.exp });
        out.push('星球任务「祛除瘴气」：累计击败 ' + s.n + ' 只，经验背包 +' + fmt(s.exp) + '。');
        if (s.title) { if (acc.titles.indexOf(s.title) < 0) acc.titles.push(s.title); out.push('任务完成！获得称号「' + titleName(s.title) + '」，芙罗拉星的瘴气被彻底祛除了。'); renderTitle(); }
      }
    });
    save(); return out;
  }
  function planetTaskList(pid) { return pid === 'flora' ? ['purge', 'war'] : pid === 'kamble' ? ['kbw'] : []; }
  function taskTab(pid, part) {
    var n = pid === 'flora' && prog('flora1').done && purgeRec().n < PURGE.goal ? 1 : pid === 'kamble' && kbwOpenC() && (acc.kbwK | 0) < KBW.need ? 1 : 0;
    return '<button type="button" role="tab" class="tab' + (part === 'task' ? ' on' : '') + '" data-fpart="task" aria-selected="' + (part === 'task') + '">星球任务' + (n ? '<i class="q-badge">' + n + '</i>' : '') + '</button>';
  }
  function planetTasks(pid) {
    if (pid === 'kamble') return kbwCardHTML('task');
    if (!planetTaskList(pid).length) return '<div class="fl-soon"><span class="tape r"></span><b>星球任务</b><p>这颗星球暂时还没有专属任务。</p><p class="hint">敬请期待。</p></div>';
    var P = purgeRec(), open = prog('flora1').done, done = P.n >= PURGE.goal;
    var steps = PURGE.steps.map(function (s) {
      var got = P.got[s.n];
      return '<li class="pt-step' + (got ? ' got' : '') + '"><span class="pt-n">' + s.n + ' 只</span><span>经验背包 +' + fmt(s.exp) + (s.title ? '，称号「' + titleName(s.title) + '」' : '') + '</span><span class="pt-st">' + (got ? '已获得' : P.n + ' / ' + s.n) + '</span></li>';
    }).join('');
    return '<article class="pt-card"><span class="tape l"></span><span class="chip log-tag">剧情任务</span><h3>祛除瘴气</h3>' +
      '<p>盐碱地的瘴气正慢慢渗进丛林和草甸，有些野生精灵已经被侵染了。击败这些瘴气精灵，就能把它们身上的瘴气祛除。</p>' +
      '<p class="hint">' + (done ? '任务已完成。' : !open ? '读完主线「降临芙罗拉」后开始。' : floraFallen() ? '芙罗拉星上的精灵已经被腐化了。在丛林、草甸击败这些腐化精灵，也能祛除它们身上的瘴气。' : '在芙罗拉星的丛林、草甸作战时，有 10% 的概率遇到瘴气精灵。它们自带 5 层瘴气，无法捕捉，只能击败。') + '</p>' +
      '<div class="pt-bar"><i style="width:' + Math.min(100, P.n / PURGE.goal * 100) + '%"></i><em>已祛除 ' + Math.min(P.n, PURGE.goal) + ' / ' + PURGE.goal + '</em></div>' +
      '<ol class="pt-steps">' + steps + '</ol>' +
      (open && !done ? '<p class="hint">去「探索」页的丛林或草甸作战即可。</p><button type="button" class="btn primary" data-fpart="catch">去丛林 / 草甸</button>' : '') + '</article>' +
      (pwOpen() ? pwCardHTML('task') : '<article class="pt-card pw-card locked"><span class="tape l"></span><span class="chip log-tag pw-tag">全服任务</span><h3>瘴气驱逐战</h3><p class="hint">完成目前的主线（第十段）后解锁。</p></article>');
  }

  /* ---------- 瘴气驱逐战（芙罗拉星 · 全服共享进度的星球任务，2026-10-17） ----------
   * 完成目前主线的最后一段（第十段 · 瘴气之源）后开放。服务器见 server/purgewar.js。
   * 在芙罗拉星野外击败腐化精灵：自己经验背包 +1000，全服击破 +1。
   * 全服击破 10 / 50 / 100、之后每 50 只：贡献过（击破 ≥ 1）的船员各收到一封奖励邮件（经验、能量、芙罗拉玉、星砂、圣晶石，数额暂定） */
  var PW = { exp: 1000, cap: 50, data: null, at: 0, busy: false, err: '' };   // cap：每人每天最多计入 50 次击破（服务器同样限制）
  function pwDay() { var d = bjDay(); if (!acc.pwd || acc.pwd.d !== d) acc.pwd = { d: d, n: 0 }; return acc.pwd; }
  // 全服击破满 1000 后，每只的经验降到 1/4；每个账号的前 5 次仍按原来的给（不对玩家公布）
  function pwExpNow() { var d = PW.data; return d && d.total >= 1000 && (d.me || 0) >= 5 ? Math.floor(PW.exp / 4) : PW.exp; }
  function pwOpen() { return prog('flora6').done; }
  function miaK() { return Math.max(acc.miaK | 0, (PW.data && PW.data.me) | 0); }   // 本账号累计击败的瘴气污染精灵（驱逐战个人贡献也算）   // 芙罗拉星恢复以后，驱逐战在「瘴气污染的记录」里继续
  function pwOnline() { return !!(window.CLOUD && CLOUD.user && CLOUD.user()); }
  function pwMilestones(upTo) { var L = [10, 50, 100]; for (var m = 150; m <= upTo; m += 50) L.push(m); return L.filter(function (x) { return x <= upTo; }); }
  function pwNext(t) { if (t < 10) return 10; if (t < 50) return 50; if (t < 100) return 100; return (Math.floor(t / 50) + 1) * 50; }
  function pwPrev(t) { if (t < 10) return 0; if (t < 50) return 10; if (t < 100) return 50; return Math.floor(t / 50) * 50; }
  function pwReward(m) {
    if (m === 10) return { exp: 5000, energy: 1000, items: { floraJade: 20, g_sand: 24, g_core: 1 } };
    if (m === 50) return { exp: 15000, energy: 3000, items: { floraJade: 50, g_sand: 48, g_core: 2 } };
    if (m === 100) return { exp: 30000, energy: 5000, items: { floraJade: 100, g_sand: 96, g_core: 4 } };
    return { exp: 20000, energy: 4000, items: { floraJade: 60, g_sand: 48, g_core: 2 } };
  }
  function pwRwText(w) { return '累积经验 ×' + fmt(w.exp) + '、能量 ×' + fmt(w.energy) + '、' + Object.keys(w.items).map(function (k) { return itemName(k) + ' ×' + w.items[k]; }).join('、'); }
  function pwRec() { if (!acc.pw) acc.pw = { got: {} }; if (!acc.pw.got) acc.pw.got = {}; return acc.pw; }
  function pwApply(d) { PW.data = d; PW.at = Date.now(); PW.err = ''; pwClaim(); pwRedraw(); }
  function pwFetch(force) {
    if (!pwOpen() || !pwOnline() || PW.busy) return;
    if (!force && PW.data && Date.now() - PW.at < 30000) return;
    PW.busy = true;
    CLOUD.api('GET', '/api/purgewar').then(function (r) { PW.busy = false; if (r._code === 200) pwApply(r); else { PW.err = r.error || '读取失败'; pwRedraw(); } })
      .catch(function () { PW.busy = false; PW.err = '连不上服务器'; pwRedraw(); });
  }
  function pwHit() { if (!pwOnline()) return; CLOUD.api('POST', '/api/purgewar-hit', {}).then(function (r) { if (r._code === 200) pwApply(r); }).catch(function () {}); }
  // 全服达到里程碑：给贡献过的自己发奖励邮件（每个里程碑只发一次）
  function pwClaim() {   // 全服达到里程碑：奖励邮件由服务器投递
    var d = PW.data; if (!d || !(d.me > 0)) return;
    var got = (acc.pw && acc.pw.got) || {};
    if (pwMilestones(d.total).some(function (m) { return !got[m]; })) deliverMail(true);
  }
  function pwInner() {
    var d = PW.data, head = '<span class="tape l"></span><span class="tape r"></span><span class="chip log-tag pw-tag">全服任务</span><h3>瘴气驱逐战</h3>' +
      '<p>芙罗拉星已经被腐化。所有船员一起，在芙罗拉星的丛林、草甸击败腐化精灵：每击破一只，你的经验背包 +' + fmt(PW.exp) + '，全服进度 +1。每人每天最多计入 ' + PW.cap + ' 次。</p>';
    if (!pwOnline()) return head + '<p class="hint">瘴气驱逐战是全服任务，需要用服务器网址打开游戏并登录后才能参与。</p>';
    if (!d) return head + '<p class="hint">' + (PW.err ? esc(PW.err) : '正在读取全服进度……') + '</p>';
    var prev = pwPrev(d.total), next = pwNext(d.total), pct = Math.min(100, (d.total - prev) / (next - prev) * 100);
    var ms = [10, 50, 100].concat([150, 200, 250]).filter(function (m) { return m > d.total - 100; }).slice(0, 5);
    if (ms.indexOf(next) < 0) ms = [next, next + 50, next + 100];
    return head +
      '<div class="pw-big"><b class="pw-num">' + fmt(d.total) + '</b><span>全服已击破</span></div>' +
      '<div class="pw-bar"><i style="width:' + pct.toFixed(1) + '%"></i><em>' + d.total + ' / ' + next + ' · 下一个全服奖励</em></div>' +
      '<ol class="pw-ms">' + ms.map(function (m) { var ok = d.total >= m; return '<li class="' + (ok ? 'ok' : '') + '"><b>' + m + ' 只</b><span>' + pwRwText(pwReward(m)) + '</span><em>' + (ok ? (d.me > 0 ? '已发放' : '已达成') : '未达成') + '</em></li>'; }).join('') + '</ol>' +
      '<p class="hint">全服击破 10、50、100 只，之后每 50 只，所有击破过腐化精灵的船员都会收到一封奖励邮件。之后的奖励和 150 只的一样。</p>' +
      '<div class="pw-me"><span>你的贡献：<b>' + d.me + '</b> 只</span><span>今天：<b>' + Math.max(d.today || 0, pwDay().n) + '</b> / ' + PW.cap + '</span><span>参与船员：<b>' + d.players + '</b> 人</span></div>' +
      (d.top.length ? '<ol class="pw-top">' + d.top.map(function (x, i) { return '<li><span class="pw-rk">' + (i + 1) + '</span><span class="pw-nm">' + esc(x.name) + '</span><b>' + x.n + '</b></li>'; }).join('') + '</ol>' : '<p class="hint">还没有船员击破腐化精灵，来做第一个吧。</p>') +
      '<button type="button" class="btn primary" data-golog="flora-catch" data-fpart="catch">去芙罗拉星的丛林 / 草甸</button>';
  }
  function pwCardHTML(where) {
    if (!pwOpen()) return where === 'log' ? '<article class="log-card wide pw-card locked"><span class="tape l"></span><span class="chip log-tag pw-tag">全服任务</span><h3>瘴气驱逐战</h3><p class="hint">完成目前的主线（第十段 · 瘴气之源）后解锁。</p></article>' : '';
    setTimeout(function () { pwFetch(); }, 0);
    return '<article class="log-card wide pw-card" id="pw-card-' + where + '">' + pwInner() + '</article>';
  }
  function pwRedraw() { ['log', 'task'].forEach(function (w) { var el = $('pw-card-' + w); if (el) el.innerHTML = pwInner(); }); }
  setInterval(function () { if ($('pw-card-log') || $('pw-card-task')) pwFetch(); }, 30000);

  /* 芙罗拉玉：瘴气驱逐战开放后，芙罗拉星丛林、草甸的场景里每天有一定概率冒出来（每个场景每天最多一块，捡到 1~3 个） */
  // 每个星球的野外场景里每天刷新的特产（芙罗拉玉要等瘴气驱逐战开放）
  var GEM_SPOT = RW.GEM_SPOT;   // 每个星球的野外场景里每天刷新的特产（rewards.js）
  function jadeSpot(rid, scene) {
    var k = GEM_SPOT[rid]; if (!k || (k === 'floraJade' && !pwOpen())) return null;
    var g = seeded(bjDay() + ':jade:' + rid + ':' + scene + ':' + (acc.created || 0));
    return g() < 0.35 ? { x: 15 + Math.floor(g() * 66), y: 68 + Math.floor(g() * 16), n: 1 + Math.floor(g() * 3), k: k } : null;
  }
  function jadeRec() { var d = bjDay(); if (!acc.jade || acc.jade.d !== d) acc.jade = { d: d, got: {} }; return acc.jade; }
  function jadeHTML(rid, scene) {
    var J = jadeSpot(rid, scene); if (!J) return '';
    var got = !!jadeRec().got[rid + ':' + scene];
    return got ? '' : '<button type="button" class="wf-node wf-jade gem-' + J.k + '" data-jade="' + scene + '" style="left:' + J.x + '%;top:' + J.y + '%" title="' + itemName(J.k) + ' ×' + J.n + '" aria-label="捡起' + itemName(J.k) + ' ×' + J.n + '"><i class="wf-gem" aria-hidden="true"></i><span>' + itemName(J.k) + '</span></button>';
  }
  function jadeAt(scene) {
    var R = regionById(ex.region), J = R && jadeSpot(R.id, scene); if (!J) return;
    var rec = jadeRec(), key = R.id + ':' + scene; if (rec.got[key]) return;
    txRun('jade', { rid: R.id, scene: scene }, function (r) {   // 服务器结算（js/engine/world.js）
      toast('捡到了「' + itemName(r.k) + '」×' + r.n + '，已放入储存箱。' + (USE_ITEMS[r.k].sd || ''));
      var el = document.querySelector('#wf-scene [data-jade]'); if (el) el.remove();
    });
  }

  /* ---------- 神秘精灵：每天 16:00–24:00，切换场景时有 3% 概率出现（真身是 LV10 幽灵鱼） ---------- */
  var MYSTERY = PVE.MYSTERY;   // 规则在 js/engine/pve.js
  function mysteryTime() { return PVE.mysteryTime(Date.now()); }
  function mysteryRoll(where) {
    if (!ready() || ex.fighting || !mysteryTime() || $('mys')) return;
    if (srvMode()) {   // 出不出现、是不是异色由服务器掷（2026-10-25）
      CLOUD.api('POST', '/api/pve', { op: 'wild', kind: 'mystery' }).then(function (r) { var sp = r && r.ok && r.list[0]; if (sp && !ex.fighting && !$('mys')) mysteryShow(where, !!sp.shiny, sp.id); }).catch(function () {});
      return;
    }
    if (Math.random() >= MYSTERY.chance) return;
    mysteryShow(where, Math.random() < MYSTERY.shiny, null);
  }
  function mysteryShow(where, sh, sid) {
    var d = document.createElement('div'); d.id = 'mys'; d.className = 'mys'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', '神秘精灵');
    d.dataset.where = where || '星际探索';
    if (sh) d.dataset.shiny = '1'; if (sid) d.dataset.sid = sid;
    d.innerHTML = '<div class="mys-box"><span class="tape l"></span><div class="mys-art"><img src="' + form({ sid: MYSTERY.sid, lv: MYSTERY.lv, shiny: sh }).img + '" alt=""></div><b>神秘精灵出现了！</b><p>一团忽明忽暗的影子从' + esc(d.dataset.where) + '的角落里飘了出来，正盯着你看。</p>' +
      '<div class="row"><button type="button" class="btn primary" data-mys="go">迎战</button><button type="button" class="btn" data-mys="no">放它离开</button></div></div>';
    document.body.appendChild(d);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mys]'); if (!b) return;
    var d = $('mys'), where = d ? d.dataset.where : '星际探索', sh = !!(d && d.dataset.shiny), msid = d && d.dataset.sid; if (d) d.remove();
    if (b.dataset.mys === 'go' && srvMode()) { if (msid) startWildRemote({ id: +msid }, { sid: MYSTERY.sid, lv: MYSTERY.lv, back: where, where: '神秘精灵 · ' + where }); return; }
    if (b.dataset.mys === 'go') startWildBattle({ sid: MYSTERY.sid, lv: MYSTERY.lv, rate: MYSTERY.rate, shiny: sh, back: where, where: '神秘精灵 · ' + where, foe: '神秘精灵' });
    else toast('神秘的影子一闪，消失不见了。');
  });

  /* ---------- 排位赛季奖励：首次达到每个段位各奖励一次，达到铂金送 LV10 小月亮 ---------- */
  var SEASON = 'S1';
  // 2026-10-11 起段位奖励翻倍（RANK_RW_OLD 是翻倍前的标准，用来给之前领过的玩家算补发差额）
  var RANK_RW_OLD = RW.RANK_RW_OLD;   // 数额在 js/engine/rewards.js
  var RANK_GIFT = { 4: [{ sid: 'moon', lv: 10 }], 10: [{ sid: 'bone', lv: 10 }] };   // 铂金送小月亮，王者送凶骨（骨刃一阶）
  // 2026-10-11 起各段位额外送道具（之前已经领过的段位，差的道具用邮箱补发）
  // 段位不再发放加强装置和华为装置，这两种只能在冶炼坊合成。翡翠、钻石、星耀改为普通捕捉装置。
  var RANK_ITEMS = RW.RANK_ITEMS;
  var RANK_RW = RANK_RW_OLD.map(function (R, r) { return R && { exp: R.exp * 2, energy: R.energy * 2, gift: RANK_GIFT[r], title: 'S1-' + r, items: RANK_ITEMS[r] }; });
  function itemsText(o) { return o ? Object.keys(o).map(function (k) { return itemName(k) + ' ×' + o[k]; }).join('、') : ''; }
  function rankBest() { try { var r = JSON.parse(localStorage.getItem('hs-rank-v1') || 'null'); return r ? Math.max(r.best || 0, r.r || 0) : 0; } catch (e) { return 0; } }
  function rankRec() { return acc.rankRw && acc.rankRw.season === SEASON && acc.rankRw.got ? acc.rankRw : { season: SEASON, got: {} }; }   // 只读：记录由服务器写（js/engine/award.js）
  var rankRwBusy = false;
  function checkRankRewards() {   // 服务器按它记的最高段位结算（交易 rankRw，js/engine/award.js）
    if (!ready() || rankRwBusy || !AWD.rankPending(acc, titleEnv().data).length) return;
    rankRwBusy = true;
    txRun('rankRw', {}, function (r) {
      rankRwBusy = false; var msg = [];
      (r.list || []).forEach(function (x) {
        var R = x.rw, line = '首次达到' + RANKS[x.r] + '段位：累积经验 +' + fmt(R.exp) + '，能量 +' + fmt(R.energy) + (R.items ? '，' + itemsText(R.items) : '');
        (x.gift || []).forEach(function (g) { var m = mon(g.u); if (m) line += '，并获得了 ' + form(m).name + ' LV' + m.lv + '！'; });
        msg.push(line + '。');
      });
      renderTop();
      if (msg.length) setTimeout(function () { toast('排位赛季奖励 · ' + msg.join('')); }, 500);
    }, function () { rankRwBusy = false; });
  }

  /* ---------- 邮箱 ----------
   * acc.mail：邮件列表（新的在前）；acc.mailSeen：已经投递过的邮件编号，删掉了也不会重发
   * 全服邮件写在 js/data/mail.js；按每个人情况算的补发，在这里用 sendMail() */
  var MAIL_MAX = 100;
  function dayStr() { return ACC.dayStr(Date.now()); }   // 北京时间的日期（2026-10-25 起和服务器一致）
  function mails() { if (!Array.isArray(acc.mail)) acc.mail = []; if (!acc.mailSeen) acc.mailSeen = {}; return acc.mail; }
  function hasAtt(a) { return !!(a && (a.exp || a.energy || a.merit || a.tokens || a.twTok || (a.items && Object.keys(a.items).length) || (a.mons && a.mons.length) || (a.deco && Object.keys(a.deco).length))); }
  function attList(a) {
    var r = []; if (!a) return r;
    if (a.exp) r.push('累积经验 ×' + fmt(a.exp)); if (a.energy) r.push('能量 ×' + fmt(a.energy)); if (a.merit) r.push('功勋点 ×' + fmt(a.merit)); if (a.tokens) r.push('竞技代币 ×' + fmt(a.tokens)); if (a.twTok) r.push('先驱代币 ×' + fmt(a.twTok));
    if (a.items) for (var k in a.items) r.push(itemName(k) + ' ×' + a.items[k]);
    (a.mons || []).forEach(function (g) { if (SPMAP[g.sid]) r.push((g.shiny ? '异色' : '') + form(g).name + ' LV' + g.lv); });
    for (var dk in a.deco || {}) if (TX.D.BASE_DECO[dk]) r.push('基地摆件「' + TX.D.BASE_DECO[dk].n + '」×' + a.deco[dk]);
    return r;
  }
  function sendMail(m) {
    var L = mails();
    if (m.id && acc.mailSeen[m.id]) return false;
    if (m.id) acc.mailSeen[m.id] = Date.now();
    L.unshift({ id: m.id || 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), date: m.date || dayStr(), from: m.from || '荆楚号舰务处',
      title: m.title, body: m.body || '', att: hasAtt(m.att) ? m.att : null, read: false, got: !hasAtt(m.att) });
    // 超过上限时，先删最旧的已读已领邮件
    while (L.length > MAIL_MAX) { var k = -1; for (var i = L.length - 1; i >= 0; i--) if (L[i].read && L[i].got) { k = i; break; } if (k < 0) break; L.splice(k, 1); }
    return true;
  }
  /* ---------- 登录奖励（都通过邮箱发） ----------
   * 离线经验：距离上次在线超过 20 分钟再打开游戏，每离线 1 分钟给 6 点累积经验（游戏开着时每 2 分钟记一次在线时间）
   * 每日登录：每天（北京时间）3000 累积经验；没登录的日子，下次登录时一起补发（从创建账号那天算起） */
  var OFFLINE_GAP = 20 * 60000, OFFLINE_RATE = 6, OFFLINE_MAX_MIN = 3 * 24 * 60, LOGIN_EXP = 3000, onlineSeen = false;   // 离线经验最多算 3 天
  function dayNum(t) { return Math.floor((t + 8 * 3600e3) / 86400000); }
  function loginRewards() {   // 离线经验、每日登录奖励由服务器投递（deliverMail → 交易 mail sync）
    if (!ready()) return;
    onlineSeen = true;
    deliverMail(true);
  }
  // 关页面时 visibilitychange 和 pagehide 会连着触发：几秒内已经记过就不再改，免得存档在上传之后又变了（下次打开会误报存档冲突）
  function markOnline() { if (ready() && !(Date.now() - (acc.lastActive || 0) < 5000)) { acc.lastActive = Date.now(); save(); } }
  setInterval(function () { if (ready() && onlineSeen) markOnline(); }, 120000);
  document.addEventListener('visibilitychange', function () {
    if (!ready()) return;
    if (document.visibilityState === 'hidden') markOnline();
    else { loginRewards(); renderMailBadge(); }   // 电脑睡眠后回来、跨过 0 点：补发离线经验和当天的登录奖励
  });
  window.addEventListener('pagehide', markOnline);
  function mailTodo() { return ready() ? mails().filter(function (m) { return !m.read || !m.got; }).length : 0; }
  function renderMailBadge() { var b = $('mail-badge'), n = mailTodo(); b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
  /* 2026-10-18：17:36 那次更新清掉了小月亮、骨刃以前领悟的隐藏技能，后来决定保留。
   * 已经被清掉的，从服务器上那次部署前的存档备份里找回来（server/hlrestore.js），合并一次 */
  var hlFixBusy = false;
  function hlFix() {
    if (!ready() || acc.hlFix || hlFixBusy || !(window.CLOUD && CLOUD.user && CLOUD.user() && CLOUD.api)) return;
    hlFixBusy = true;
    CLOUD.api('GET', '/api/hlrestore').then(function (r) {
      hlFixBusy = false;
      if (!r || r._code !== 200 || !r.ready || !ready() || acc.hlFix) return;
      var got = [];
      ['moon', 'bone'].forEach(function (sid) {
        var L = (r.sp && Array.isArray(r.sp[sid]) ? r.sp[sid] : []).filter(function (n) { return typeof n === 'string' && SPMAP[sid] && (SPMAP[sid].hidden || []).indexOf(moveName(n)) >= 0; }).map(moveName);
        if (!L.length) return; var own = acc.mons.filter(function (m) { return m.sid === sid; }); if (!own.length) return;
        L.forEach(function (n) { var eq = own.filter(function (m) { return (m.moves || []).indexOf(n) >= 0; }); if (!eq.length) eq = [own.slice().sort(function (a, b) { return b.lv - a.lv; })[0]]; var add = 0; eq.forEach(function (m) { if (!Array.isArray(m.hl)) m.hl = []; if (m.hl.indexOf(n) < 0) { m.hl.push(n); add = 1; } }); if (add) got.push(SPMAP[sid].name + '「' + n + '」'); });
      });
      acc.hlFix = 1;
      if (got.length) sendMail({ id: 'hl-fix', title: '小月亮、骨刃的隐藏技能已恢复', body: '{name}，你好！\n小月亮、骨刃之前已经领悟过的隐藏技能，这次全部保留，不需要重新学习。已经帮你恢复：' + got.join('、') + '。\n以后还没领悟的，可以用「新月辉石」「灵骨粉末」解锁（竞技代币商店兑换）。给你添麻烦了！' });
      save(); renderTop();
    }, function () { hlFixBusy = false; });
  }
  // 投递邮件（全服邮件、登录奖励、离线经验、里程碑、名次、旧存档补发）：服务器结算（交易 mail，js/engine/award.js）；隔 30 秒以上才去一次，force 立刻去
  var mailSyncAt = 0, mailBusy = false;
  function deliverMail(force) {
    if (!ready()) return;
    hlFix();
    mails();
    // 2026-10-18：部分精灵的隐藏技能改成只能用道具解锁，发封说明邮件（没有附件）
    if (acc.hlReset > 0 && sendMail({ id: 'hl-reset', title: '隐藏技能的学习方式调整', body: '{name}，你好！\n部分精灵的隐藏技能，现在改成用道具解锁：芙罗拉星、坎伯兰星、庞贝星、莱汀陨石带、白之星的普通野生精灵用各自星球的特产，泰戈尔、荒芜、帕努托尔用BOSS专属道具，三只初始精灵用「地球元素」。\n解锁一次，你持有的同一种族的精灵就都能使用（LV40 以上才能装备）。\n你之前在战斗中领悟的这些精灵的隐藏技能需要重新学习。学院部的 Bttp 也有话要跟你说，记得去黄冈 · 学院部看看。' })) save();
    if (mailBusy || (!force && Date.now() - mailSyncAt < 30000)) { renderMailBadge(); return; }
    mailBusy = true; mailSyncAt = Date.now();
    txRun('mail', { a: 'sync' }, function (r) { mailBusy = false; renderMailBadge(); if (r.n && $('mailbox')) { var bx = $('mailbox').querySelector('.mailbox'); if (bx) bx.innerHTML = mailHTML(); } },
      function (err) { mailBusy = false; if (err === '') mailSyncAt = 0; renderMailBadge(); });
  }
  // 领附件：服务器结算（交易 mail get / all）。done(领到的东西的文字列表)
  function claimMail(m, done) {
    if (!m || m.got) return;
    txRun('mail', { a: 'get', id: m.id }, function (r) { renderTop(); done(attList(m.att)); });
  }
  function claimAll(done) {
    var got = []; mails().forEach(function (m) { if (!m.got) got = got.concat(attList(m.att)); });
    if (!got.length) return;
    txRun('mail', { a: 'all' }, function () { renderTop(); done(got); });
  }
  var mailOpen = null;
  function mailHTML() {
    var L = mails(), left = L.filter(function (m) { return !m.got; }).length;
    var items = L.map(function (m, i) {
      var on = mailOpen === m.id, A = attList(m.att);
      return '<li class="mb-item' + (m.read ? '' : ' unread') + (on ? ' open' : '') + '"><button type="button" class="mb-head" data-mbopen="' + i + '" aria-expanded="' + on + '">' +
        '<span class="mb-dot" aria-hidden="true"></span><span class="mb-t"><b>' + esc(m.title) + '</b><small>' + esc(m.from) + ' · ' + esc(m.date) + '</small></span>' +
        (A.length ? '<span class="chip mb-att' + (m.got ? ' got' : '') + '">' + (m.got ? '已领取' : '附件') + '</span>' : '') + '</button>' +
        (on ? '<div class="mb-body">' + esc(m.body.replace(/\{name\}/g, acc.name)).split('\n').map(function (p) { return '<p>' + p + '</p>'; }).join('') +
          (A.length ? '<div class="mb-atts"><b>附件</b>' + A.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') + '</div>' +
            (m.got ? '<p class="hint">附件已领取</p>' : '<button type="button" class="btn primary" data-mbget="' + i + '">领取附件</button>') : '') + '</div>' : '') + '</li>';
    }).join('');
    return '<span class="tape l"></span><span class="tape r"></span><span class="step">荆楚号 · 船员邮箱</span><h2>邮箱</h2>' +
      '<div class="mb-tools"><span class="hint">共 ' + L.length + ' 封' + (left ? '，' + left + ' 封有附件没领' : '') + '</span>' +
      '<button type="button" class="btn ghost" data-mbclean="1"' + (L.some(function (m) { return m.read && m.got; }) ? '' : ' disabled') + '>删除已读已领</button>' +
      '<button type="button" class="btn primary" data-mball="1"' + (left ? '' : ' disabled') + '>一键领取</button></div>' +
      (L.length ? '<ul class="mb-list">' + items + '</ul>' : '<p class="hint mb-empty">邮箱是空的。</p>') +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-mbx="1">关闭</button></div>';
  }
  function openMailbox() {
    deliverMail(true);
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'mailbox';
    var box = document.createElement('div'); box.className = 'soc-box mailbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '邮箱');
    d.appendChild(box); document.body.appendChild(d);
    var L = mails();
    if (!mailOpen && L[0]) { mailOpen = L[0].id; if (!L[0].read) { L[0].read = true; save(); } }
    function draw() { var L0 = box.querySelector('.mb-list'), y = L0 ? L0.scrollTop : 0; box.innerHTML = mailHTML(); var L1 = box.querySelector('.mb-list'); if (L1) L1.scrollTop = y; renderMailBadge(); }
    draw();
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-mbx]')) { d.remove(); return; }
      var t;
      if ((t = e.target.closest('[data-mbopen]'))) { var m = mails()[+t.dataset.mbopen]; mailOpen = mailOpen === m.id ? null : m.id; if (!m.read) { m.read = true; save(); } draw(); return; }
      if ((t = e.target.closest('[data-mbget]'))) { claimMail(mails()[+t.dataset.mbget], function (got) { renderRes(); draw(); if (got.length) toast('领取了：' + got.join('、') + '。'); }); return; }
      if (e.target.closest('[data-mball]')) {
        claimAll(function (all) { renderRes(); draw(); if (all.length) toast('一键领取了 ' + all.length + ' 项附件：' + all.join('、') + '。'); }); return;
      }
      if (e.target.closest('[data-mbclean]')) { acc.mail = mails().filter(function (m) { return !(m.read && m.got); }); save(); draw(); return; }
    });
  }
  $('mail-btn').addEventListener('click', openMailbox);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('mailbox')) $('mailbox').remove(); });

  /* ---------- 每日任务：每天 0:00 刷新，一共 7 个：3 个竞技对战任务，开放了精灵大乱斗的话大概率有 1 个大乱斗任务，其余从探索类里抽 ----------
   * 2026-10-12 起奖励翻倍（rw 里已经是翻倍后的数），当天已经领过的按差额补发到邮箱 */
  var DAILY_N = QST.DAILY_N, DAILY = QST.DAILY;   // 任务表和抽取规则在 js/engine/quest.js（服务器和浏览器共用）
  var DAILY_X10_OLD = { ar_play3: 600, ar_rank2: 800, ar_win1: 1000, ar_sand1: 400, bw_1: 1000, bw_win1: 1200, wd_win5: 800, wd_catch1: 600, bs_1: 600, hm_1: 600, pve_2: 600 };   // 2026-10-18 晚：每日任务经验提高（×5）之前的经验（补差额用）
  var DAILY_OLD = { ar_play3: [300, 100], ar_rank2: [400, 120], ar_win1: [500, 150], ar_sand1: [200, 80], wd_win5: [400, 120], wd_catch1: [300, 150], bs_1: [300, 100], hm_1: [300, 100], pve_2: [300, 100] };   // 翻倍前的奖励（补差额用）
  function todayKey() { return PVE.bjDay(Date.now()); }   // 北京时间（2026-10-25 起和服务器一致）
  var dailyTold = {};
  function daily() {
    if (!ready()) return null;
    var before = acc.daily ? JSON.stringify(acc.daily) : '';
    var D = QST.daily(acc, Date.now());
    if (JSON.stringify(D) !== before) save();
    return D;
  }
  // 每日任务的进度：用服务器网址玩时由服务器加（对战结算、交易），这里只提示刚完成的；本地双击打开时在本机加
  function dailyHit(kind, n) {
    if (!ready()) return;
    if (!srvMode()) { QST.hit(acc, kind, n, Date.now()); save(); }
    dailyNote(kind);
  }
  function dailyNote(kind) {
    var D = daily(); if (!D) return; var out = [];
    D.list.forEach(function (t) { var d = DAILY[t.id], k = D.date + ':' + t.id; if (d && (!kind || d.kind === kind) && t.p >= d.n && !t.c && !dailyTold[k]) { dailyTold[k] = 1; out.push(d.t); } });
    if (out.length) setTimeout(function () { toast('每日任务完成：' + out.join('、') + '。到航行日志或任务面板领取奖励。'); }, 1200);
  }
  function dailyClaimable() { var D = daily(); return D ? D.list.filter(function (t) { return !t.c && t.p >= DAILY[t.id].n; }).length : 0; }
  function claimDaily(i, after) {
    var D = daily(), t = D && D.list[i]; if (!t || t.c || t.p < DAILY[t.id].n) return;
    txRun('daily', { i: i }, function (r) {   // 服务器结算（js/engine/quest.js）
      renderRes(); if (after) after();
      toast('领取了每日任务奖励：累积经验 +' + fmt(r.exp) + '，能量 +' + fmt(r.energy) + '。');
    });
  }
  window.HSEV = function (type, d) {
    if (!ready()) return;
    if (type === 'hidden') {   // 战斗中领悟了隐藏技能
      d.forEach(function (g) { var m = mon(g.u); if (!m) return; if (!m.hl) m.hl = []; if (m.hl.indexOf(g.mv) < 0) m.hl.push(g.mv); });
      save(); return;
    }
    if (type === 'bossfx') { if (!acc.seenFx) acc.seenFx = {}; if (!acc.seenFx[d.k]) { acc.seenFx[d.k] = Date.now(); save(); } return; }   // 隐藏的BOSS特效第一次发动（之后在BOSS页显示）
    if (type !== 'arena') return;
    dailyHit('arena');
    if (d.rank) { dailyHit('rankPlay'); if (d.result === 'win') dailyHit('rankWin'); } else dailyHit('sandbox');
    if (d.srv) {   // 服务器结算的（2026-10-25）：奖励服务器已经发了，这里只写提示
      var rx = d.srv.rexp; renderRes();
      if (rx && !rx.full) return '平衡排位奖励：累积经验 +' + fmt(rx.exp) + '，竞技代币 +' + rx.tok + '（今天第 ' + rx.n + ' / ' + rx.max + ' 局）';
      if (rx && rx.full) return '今天的 ' + rx.max + ' 局平衡排位奖励已经领完了';
      return;
    }
    // 平衡排位：每天前 10 局各给 1000 累积经验和 20 竞技代币（认输不算）
    if (d.rank && !d.quit) {
      var n = rankToday();
      if (n < RANK_EXP_N) { acc.rankExp = { d: bjDay(), n: n + 1 }; earn('rankExp', bjDay() + ':' + (n + 1), { exp: RANK_EXP, tokens: RANK_TOKEN }); save(); renderRes(); return '平衡排位奖励：累积经验 +' + fmt(RANK_EXP) + '，竞技代币 +' + RANK_TOKEN + '（今天第 ' + (n + 1) + ' / ' + RANK_EXP_N + ' 局）'; }
      return '今天的 ' + RANK_EXP_N + ' 局平衡排位奖励已经领完了';
    }
  };
  // 2026-10-14 起每局 1000 经验（每天 10 局共 10000）并掉落 20 竞技代币；RANK_EXP_OLD 用来给当天已经打过的局补差额
  var RANK_EXP = 1000, RANK_EXP_N = 10, RANK_TOKEN = 20, RANK_EXP_OLD = 600;
  function rankToday() { return acc && acc.rankExp && acc.rankExp.d === bjDay() ? acc.rankExp.n || 0 : 0; }
  function dailyHTML() {
    var D = daily(); if (!D) return '';
    return '<ul class="daily">' + D.list.map(function (t, i) {
      var d = DAILY[t.id], ok = t.p >= d.n, lock = d.arena && !arenaOpen();
      return '<li class="dl' + (t.c ? ' done' : ok ? ' ok' : '') + '">' + (d.brawl ? '<span class="chip dl-tag bw">大乱斗</span>' : d.arena ? '<span class="chip dl-tag">竞技</span>' : '<span class="chip dl-tag ex">探索</span>') +
        '<span class="dl-t"><b>' + esc(d.t) + '</b><small>奖励：累积经验 ×' + fmt(d.rw.exp) + '、能量 ×' + fmt(d.rw.energy) + (lock ? ' · 完成孝感大厅支线后才能进行竞技对战' : '') + '</small></span>' +
        '<span class="dl-p"><i style="width:' + Math.round(t.p / d.n * 100) + '%"></i><em>' + t.p + ' / ' + d.n + '</em></span>' +
        (t.c ? '<span class="dl-st">已领取</span>' : ok ? '<button type="button" class="btn primary" data-dclaim="' + i + '">领取</button>' : '<span class="dl-st">进行中</span>') + '</li>';
    }).join('') + '</ul><p class="hint">每天 0:00 刷新。每天 7 个：必定有 3 个竞技对战任务，开放精灵大乱斗后经常会有 1 个大乱斗任务，其余从探索类任务里抽取。</p>';
  }

  /* ---------- 航行日志：活动、每日任务、排位奖励、下期预告 ---------- */
  // 「近期改动」专栏：内容写在 js/data/changelog.js，最新一条展开，更早的折叠
  function changelogHTML() {
    var L = typeof CHANGELOG !== 'undefined' ? CHANGELOG : [];
    if (!L.length) return '';
    var one = function (c) { return '<div class="cl-entry"><p class="cl-h"><b>' + esc(c.title) + '</b><span>' + esc(c.date) + '</span></p><ul>' + c.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; };
    return '<article class="log-card wide changelog"><span class="tape l"></span><span class="chip log-tag">近期改动</span><h3>更新公告</h3>' +
      '<p class="hint">技能、数值和玩法的改动都会公布在这里，最新的在最上面。</p>' + L.slice(0, 1).map(one).join('') +
      (L.length > 1 ? '<details class="cl-more"><summary>更早的改动（' + (L.length - 1) + ' 条）</summary>' + L.slice(1).map(one).join('') + '</details>' : '') + '</article>';
  }
  // 「精灵改动」专栏（2026-10-19）：内容写在 js/data/monchanges.js。加强红色 ▲、削弱绿色 ▼、调整灰色 ◆
  function monChangesHTML() {
    var L = typeof MON_CHANGES !== 'undefined' ? MON_CHANGES : [];
    var mark = { up: ['▲', '加强'], down: ['▼', '削弱'], adj: ['◆', '调整'] };
    var one = function (c) {
      var s = SPMAP[c.sid], img = s ? (SPRITES[c.sid] || '') : '';
      return '<div class="mc-entry"><div class="mc-head">' + (img ? '<img src="' + img + '" alt="">' : '') + '<b>' + esc(c.boss || (s ? s.name : c.sid)) + '</b>' + (c.boss ? '<span class="chip mc-boss">BOSS</span>' : '') + '<span class="mc-date">' + esc(c.date) + '</span></div><ul>' +
        c.items.map(function (x) { var m = mark[x[0]] || mark.adj; return '<li class="mc-' + (mark[x[0]] ? x[0] : 'adj') + '"><span class="mc-tag">' + m[0] + ' ' + m[1] + '</span>' + esc(x[1]) + '</li>'; }).join('') + '</ul></div>';
    };
    return '<article class="log-card mon-changes"><span class="tape r"></span><span class="chip log-tag">平衡调整</span><h3>精灵改动</h3>' +
      '<p class="hint"><span class="mc-key up">▲ 加强</span><span class="mc-key down">▼ 削弱</span><span class="mc-key adj">◆ 调整</span>　最新的在最上面。</p>' +
      (L.length ? L.slice(0, 4).map(one).join('') + (L.length > 4 ? '<details class="cl-more"><summary>更早的改动（' + (L.length - 4) + ' 条）</summary>' + L.slice(4).map(one).join('') + '</details>' : '') : '<p class="hint">暂时没有精灵改动。</p>') + '</article>';
  }
  /* 每天第一次打开游戏：弹出半屏的「更新公告」，列出上次看过之后新增的改动（没有新的就显示最新一条）。
   * 看过哪些记在存档里（newsSeen），所以换设备也不会重复算「新」；当天弹过就不再弹（newsDay）。
   * 正在对战或看剧情时先不弹，等结束后再弹。 */
  function clKey(c) { return c.date + '|' + c.title; }
  function newsCheck() {
    if (ex.baseEdit || !ready() || typeof CHANGELOG === 'undefined' || !CHANGELOG.length || acc.newsDay === dayStr()) return;
    if (!$('battle').hidden || ex.fighting || (ex.mode && (ex.mode === 'intro' || ex.view === 'vn')) || $('news') || $('mailbox') || $('story-news')) return;
    var first = !Array.isArray(acc.newsSeen), seen = first ? [] : acc.newsSeen;   // 第一次弹：只列最近 3 条，不然一下子十几条太多
    var fresh = first ? CHANGELOG.slice(0, 3) : CHANGELOG.filter(function (c) { return seen.indexOf(clKey(c)) < 0; });
    var list = fresh.length ? fresh.slice(0, 5) : CHANGELOG.slice(0, 1);
    acc.newsDay = dayStr(); acc.newsSeen = CHANGELOG.slice(0, 60).map(clKey); save();
    var d = document.createElement('div'); d.className = 'soc-dlg news-dlg'; d.id = 'news';
    d.innerHTML = '<div class="soc-box news-box" role="dialog" aria-modal="true" aria-labelledby="news-h"><span class="tape l"></span><span class="tape r"></span>' +
      '<div class="news-top"><span class="step">航行日志 · ' + dayStr() + '</span><h2 id="news-h">' + (first ? '最近的更新公告' : fresh.length ? '有 ' + fresh.length + ' 条新的更新公告' : '今天的航行日志') + '</h2></div>' +
      '<div class="news-list">' + list.map(function (c) {
        var isNew = fresh.indexOf(c) >= 0;
        return '<div class="cl-entry"><p class="cl-h"><b>' + esc(c.title) + '</b>' + (isNew ? '<span class="news-new">新</span>' : '') + '<span>' + esc(c.date) + '</span></p><ul>' + c.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + (first || fresh.length > list.length ? '<p class="hint">更早的改动都在航行日志的「更新公告」里。</p>' : '') + '</div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-nlog="1">去航行日志</button><button type="button" class="btn primary" data-nx="1">知道了</button></div></div>';
    document.body.appendChild(d);
    var close = function () { d.remove(); };
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-nx]')) { close(); return; }
      if (e.target.closest('[data-nlog]')) { close(); if ($('battle').hidden) go('log'); }
    });
    document.addEventListener('keydown', function esc0(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc0); } });
    d.querySelector('[data-nx]').focus();
  }
  setInterval(function () { if (document.visibilityState === 'visible') { storyNewsCheck(); newsCheck(); } }, 20000);
  /* 新剧情上线通知（2026-10-31）：每推出一批新剧情，在 STORY_NEWS 最前面加一条；每个存档只弹一次（记在 storyNews） */
  var STORY_NEWS = [
    { id: 'kb-4', title: '第二章 · 完结', sub: '第十九段 · 玫瑰之战', card: 'nebula', site: 'kb8', d: '想让坎伯兰星活下去，就只能打败那团星云。这一次，Cumber 和她的老朋友们也会站在你身边。' },
    { id: 'kb-3', title: '坎伯兰星保卫战', sub: '第十八段 · 星云显现', card: 'nebula', site: 'kb7', d: '一鸟唤醒了海里所有休眠的奥多亚克。和全服船员一起守住深海基站吧——然后，迎接从深海升起的东西。' },
    { id: 'kb-2', title: '第二章 · 坎伯兰星（续）', sub: '第十五段 ～ 第十七段', card: 'kb', site: 'kb4', d: '顺着墨迹追上辰爷，被巨浪拍进深海，在海底遇见一位十九世纪的调查队员。' },
    { id: 'kb-1', title: '第二章 · 坎伯兰星', sub: '第十二段 ～ 第十四段', card: 'kb', site: 'kb1', d: '远航禁闭海洋。荆楚号的下一站，是一颗被海洋覆盖的星球。' }
  ];
  function storyNewsCheck() {
    if (ex.baseEdit || !ready() || !acc.introDone || !STORY_NEWS.length) return;
    if (!$('battle').hidden || ex.fighting || (ex.mode && (ex.mode === 'intro' || ex.view === 'vn')) || $('news') || $('mailbox') || $('story-news') || document.querySelector('.soc-dlg')) return;
    var seen = Array.isArray(acc.storyNews) ? acc.storyNews : [], N = STORY_NEWS.filter(function (x) { return seen.indexOf(x.id) < 0; })[0];
    if (!N) return;
    acc.storyNews = STORY_NEWS.map(function (x) { return x.id; }).concat(seen.filter(function (k) { return !STORY_NEWS.some(function (x) { return x.id === k; }); })).slice(0, 50); save();
    var tgt = MAIN_Q.filter(function (id) { return unlocked(id) && !prog(id).done; })[0];   // 从最早一段还没读的主线开始（没读过上一批的也能接上）
    if (!tgt || MAIN_Q.indexOf(tgt) < MAIN_Q.indexOf(chapterOf(N.site) ? chapterOf(N.site).sites[0] : N.site)) tgt = null;
    var site = tgt || N.site, S = SITES[site], open = unlocked(site), C = N.card && CARDS[N.card];
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'story-news';
    d.innerHTML = '<div class="soc-box sn-box" role="dialog" aria-modal="true" aria-label="新剧情上线"><span class="tape l"></span><span class="tape r"></span>' +
      (C ? '<div class="sn-art"><img class="sn-bg" src="' + BG[C.bg] + '" alt=""><img class="sn-card" src="' + C.img + '" alt=""></div>' : '') +
      '<span class="step">新剧情上线</span><h2>' + esc(N.title) + '</h2><p class="sn-sub">' + esc(N.sub) + '</p><p>' + esc(N.d) + '</p>' +
      '<p class="hint">' + (prog(site).done ? '你已经读过了。' : open ? '从「' + esc(S.chapter) + '」开始：' + (S.dept ? '荆楚号 · ' + S.dept + ' · ' + S.name : PLANETS.filter(function (p) { return p.id === S.planet; })[0].name + ' · 剧情') + '。' : '开放条件：' + (prog(S.after).done && S.needText ? esc(S.needText) : '读完「' + esc(SITES[S.after].chapter) + '」') + '。') + '</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-snx="1">知道了</button>' + (open ? '<button type="button" class="btn primary" data-sngo="' + site + '">前往</button>' : '<button type="button" class="btn primary" data-snq="1">查看主线任务</button>') + '</div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-snx]')) { d.remove(); return; }
      var g = e.target.closest('[data-sngo]'); if (g) { d.remove(); questGo(g.dataset.sngo); return; }
      if (e.target.closest('[data-snq]')) { d.remove(); openQuests('main'); }
    });
  }
  var QQ_GROUP = '1124145809';   // 航行日志最上方显示的船员 QQ 群
  $('pg-log').addEventListener('click', function (e) {
    var gb = e.target.closest('[data-gift]'); if (gb && !gb.disabled && ready()) { gb.disabled = true; txRun('compGift', { id: gb.dataset.gift }, function () { toast(gb.dataset.gift === 'sum1' ? '领取了召唤上线纪念：圣晶石 ×30！去荆楚号的「召唤」试试手气吧。' : gb.dataset.gift === 'base1' ? '领取了基地改版纪念礼包！三个纪念摆件已经放进基地的摆件库。' : '领取了补偿大礼包！经验已放进经验背包，道具已放入储存箱。'); renderRes(); renderLog(); }, function () { gb.disabled = false; }); return; }
    if (!e.target.closest('[data-copyqq]')) return;
    var done = function () { toast('群号 ' + QQ_GROUP + ' 已复制，打开 QQ 搜索加群即可。'); };
    // 网站是 http 打开的，浏览器不给用新的剪贴板接口，先用老办法复制
    var ta = document.createElement('textarea'); ta.value = QQ_GROUP; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, 99);
    var ok = false; try { ok = document.execCommand('copy'); } catch (er) {}
    ta.remove();
    if (ok) { done(); return; }
    try { navigator.clipboard.writeText(QQ_GROUP).then(done, function () { toast('QQ 群号：' + QQ_GROUP + '（没能自动复制，请长按群号手动复制）'); }); } catch (er) { toast('QQ 群号：' + QQ_GROUP + '（没能自动复制，请长按群号手动复制）'); }
  });
  // 精灵推荐：每期推荐一只精灵和它的一个技能，换一期只改 PICK
  var PICK = { no: 1, sid: 'tagore', lv: 25, move: '慈悲气波', title: '胖虎 · 抓精灵的好帮手',
    body: ['想抓的精灵总是一不小心就被打倒？试试胖虎的<b>「慈悲气波」</b>：就算这一下足以击败对方，也会给它留下 <b>1 点体力</b>。',
      '对方体力越低越好抓。先用慈悲气波把野生精灵打到只剩 1 点体力，再扔捕捉装置，稀有精灵和异色精灵都不怕失手。'],
    how: '击败古城防卫部简单难度的泰戈尔，可以领养一只小胖虎。它在 LV15 学会慈悲气波，LV25 进化成胖虎。' };
  // 航行日志 · 旅行精灵叶子喵（规则见 TRAVEL；只说在不在，不说在哪，让船员们互相通知）
  function travelLogHTML() {
    var now = Date.now(), t = travelAt(now), f = form({ sid: TRAVEL.sid, lv: TRAVEL.lv }), hm = function (ms) { var d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
    var nx = t.start > now ? t : travelAt((t.h + 1) * 3600000);
    var st = !travelOpen() ? '先去完成芙罗拉星的世界任务「旅行猫」，叶子喵才会开始在各个星球旅行。' : t.active ? (travelDone(t.h) ? '这一次的叶子喵你已经挑战过了，下一次大约在 ' + hm(travelAt((t.h + 1) * 3600000).start) + ' 出现。' : '叶子喵正在某个星球旅行！还会停留 ' + Math.max(1, Math.ceil((t.end - now) / 60000)) + ' 分钟——它在哪儿？问问其他船员吧。')
      : '叶子喵正在赶路，下一次大约在 ' + hm(nx.start) + ' 出现，停留 ' + TRAVEL.dur + ' 分钟。';
    return '<article class="log-card travel"><span class="tape r"></span><span class="chip log-tag">旅行精灵</span><h3>旅行精灵叶子喵</h3>' +
      '<div class="pick-row"><div class="pick-art travel-art"><img src="' + f.img + '" alt="' + esc(f.name) + '"></div><div class="pick-txt">' +
      '<p>叶子喵背着魔杖到处旅行，每个小时都会在某个星球的某个场景里停留<b>连续 20 分钟</b>。所有船员看到的都是同一只，发现了记得告诉大家！</p>' +
      '<p>它是 <b>LV30</b> 的强敌，不能捕捉；每次出现，每名船员只能挑战 <b>1 次</b>。击败它可以获得<b>累积经验 ×3,000</b>，还有 <b>50%</b> 的概率掉落「叶子喵的叶片」。</p>' +
      '<p><b>5 片叶片</b>在黄石 · 冶炼坊合成「叶子喵的精元」，放进神农架 · <b>精灵保育仓</b>孵化 <b>8 小时</b>，就能得到属于你的叶子喵！</p>' +
      '</div></div><p class="log-st' + (travelOpen() && t.active && !travelDone(t.h) ? ' on' : '') + '">' + st + '</p>' + (!travelOpen() ? (prog('flora2').done ? '<button type="button" class="btn primary" data-golog="travelcat">去做世界任务「旅行猫」</button>' : '<p class="hint">读完芙罗拉星主线「卡罗的不安」后，世界任务「旅行猫」就会开放。</p>') : '') + '</article>';
  }
  // 航行日志 · 稀有野怪：爱吃米饭的米饭火鸡（规则见 RICE）
  // 航行日志 · 新精灵莱克（2026-11-02）：莱汀陨石带的稀有精灵
  function leibnizLogHTML() {
    var s = SPMAP.leibniz, sh = SHINY_SPRITES.leibniz_s1;
    return '<article class="log-card rice lb-log"><span class="tape l"></span><span class="chip log-tag">获取精灵</span><h3>陨石带的飞翼 · 莱克</h3>' +
      '<div class="pick-row"><div class="pick-art lb-art"><img src="' + formImg(s, 0) + '" alt="莱克">' + (sh ? '<img class="lb-sh" src="' + sh + '" alt="异色莱克">' : '') + '</div><div class="pick-txt">' +
      '<p>新精灵<b>莱克</b>（电 · 飞行）登场！它在陨石带中不断穿梭飞行，稍不留神就会撞到锰怪身上。</p>' +
      '<p>莱克 → LV25 莱克蝠 → LV50 <b>莱布尼茨</b>。特性「疾驰」：攻击命中时，附加双方速度差 10% 的固定伤害。</p>' +
      '<ol class="rice-steps"><li>在<b>莱汀陨石带</b>的野外，有很小的概率遇到莱克（稀有精灵）。</li><li>其中 <b>3%</b> 是蓝色的<b>异色</b>莱克！</li><li>隐藏技能和等级上限用<b>闪电球体</b>解锁。</li></ol>' +
      '</div></div></article>';
  }
  function riceLogHTML() {
    var f = form({ sid: RICE.sid, lv: RICE.lv }), b = acc && acc.riceBowl;
    var st = b ? '你已经在熔岩原放了一碗饭，去那里等等看吧。' : acc && acc.items.c_bowl > 0 ? '你手里有 ' + acc.items.c_bowl + ' 碗饭，带去庞贝星的熔岩原吧。' : '';
    return '<article class="log-card rice"><span class="tape l"></span><span class="chip log-tag">稀有野怪</span><h3>爱吃米饭的米饭火鸡</h3>' +
      '<div class="pick-row"><div class="pick-art rice-art"><img src="' + f.img + '" alt="' + esc(f.name) + '"></div><div class="pick-txt">' +
      '<p>它总是背着一筐米饭，平时很难见到。不过只要闻到米饭的香味，它就会自己找上门来！</p>' +
      '<ol class="rice-steps"><li>在<b>芙罗拉星</b>击败野生精灵，每只有 <b>10%</b> 的概率掉落<b>水稻种子</b>。</li>' +
      '<li>在恩施 · <b>太空种植园</b>种下，<b>12 小时</b>后收获一大把米饭。</li>' +
      '<li>到黄石 · <b>冶炼坊</b>，用 <b>500 粒米饭</b>盛成<b>一碗饭</b>。</li>' +
      '<li>把这碗饭放在<b>庞贝星 · 熔岩原</b>的一个场景里。之后这个场景里有 <b>2%</b> 的概率出现米饭火鸡。</li></ol>' +
      '</div></div><p class="hint">捕捉或击败米饭火鸡之后，那碗饭就被吃光了，想再见到它要重新盛一碗。太空种植园在读完恩施的支线「伟大的种植园」后开放。' + (st ? '<b> ' + st + '</b>' : '') + '</p></article>';
  }
  function pickHTML() {
    var f = form({ sid: PICK.sid, lv: PICK.lv }), M0 = M[PICK.move];
    return '<article class="log-card pick"><span class="tape r"></span><span class="chip log-tag">精灵推荐 · 第 ' + PICK.no + ' 期</span><h3>' + esc(PICK.title) + '</h3>' +
      '<div class="pick-row"><div class="pick-art"><img src="' + f.img + '" alt="' + esc(f.name) + '"></div><div class="pick-txt">' + PICK.body.map(function (t) { return '<p>' + t + '</p>'; }).join('') +
      (M0 ? '<p class="pick-mv"><b>' + esc(PICK.move) + '</b> · ' + esc(M0.type) + '系 · ' + esc(M0.cat) + ' · 威力 ' + M0.power + '</p>' : '') + '</div></div>' +
      '<p class="hint">' + PICK.how + '</p></article>';
  }
  /* 航行日志 · 立绘更新投票（服务器 server/artvote.js 计票；每人最多 5 只，截止前可以改）
   * ART_VOTE：还没有完全换上新立绘的精灵（某一阶还是旧图或占位图）。新立绘换上后从这里删掉即可 */
  var ART_VOTE = ['dragon', 'squid', 'wind', 'pluto', 'pede', 'tagore', 'faraday', 'frost', 'wild', 'inkarm', 'barren', 'mush', 'kaleo', 'siren', 'bone', 'aegis', 'phantom', 'shroom', 'turkey', 'firemouse'];
  // 已经换上新立绘的形态（其余形态待更新）
  var ART_NEW = { hephaestus: [0, 1, 2], barren: [1], wind: [0], tagore: [1, 2], faraday: [0], mush: [0], kaleo: [0], shroom: [0], turkey: [0, 1, 2], squid: [0, 1, 2] };
  var AV_END = Date.UTC(2026, 9, 16, 16, 0, 0);   // 北京时间 10 月 16 日 24:00 截止（服务器也按这个时间）
  var AV = { data: null, picks: null, busy: false, err: '', t: 0 };
  function avOnline() { return !!(window.CLOUD && CLOUD.user && CLOUD.user()); }
  function avLoad() {
    if (!avOnline() || AV.busy) return;
    AV.busy = true;
    CLOUD.api('GET', '/api/artvote').then(function (r) {
      AV.busy = false;
      if (r._code !== 200) { AV.err = r.error || '读取失败'; avDraw(); return; }
      AV.data = r; AV.t = Date.now(); AV.err = ''; if (!AV.picks) AV.picks = r.mine.slice(); avDraw();
    }).catch(function () { AV.busy = false; AV.err = '连不上服务器'; avDraw(); });
  }
  function avDraw() { var el = $('artvote'); if (el) el.innerHTML = artVoteInner(); }
  function artVoteInner() {
    var closed = Date.now() >= AV_END || !!(AV.data && AV.data.closed);
    if (!avOnline()) return '<p class="hint">投票需要联网：用服务器网址打开游戏并登录后才能投票。</p>';
    if (AV.err) return '<p class="hint red">' + esc(AV.err) + '</p>';
    if (!AV.data) return '<p class="hint">正在读取投票……</p>';
    var T = AV.data.tally || {}, picks = AV.picks || [], mine = AV.data.mine || [], max = Math.max(1, Math.max.apply(null, ART_VOTE.map(function (k) { return T[k] || 0; })));
    var L = ART_VOTE.filter(function (k) { return SPMAP[k]; });
    var kn = function (k) { return owned(k) || !!(acc.forms && acc.forms[k] && acc.forms[k].some(Boolean)) || !!(acc.seen && acc.seen[k] !== undefined); };
    // 截止后按票数排；投票中把见过的精灵排在前面（没见过的和图鉴一样只显示剪影）
    L = L.slice().sort(closed ? function (a, b) { return (T[b] || 0) - (T[a] || 0); } : function (a, b) { return kn(b) - kn(a); });
    var changed = picks.length !== mine.length || picks.some(function (k) { return mine.indexOf(k) < 0; });
    var tiles = L.map(function (k) {
      var s = SPMAP[k], known = kn(k);
      var i = known ? (function () { var j = evoLast(s); while (j > 0 && !formKnown(k, j)) j--; return j; })() : 0;
      var nm = known ? topName(s) : '？？？', img = known ? '<img src="' + formImg(s, i) + '" alt="">' : silTag(k, 0);
      var done = ART_NEW[k] || [], todo = s.evo.map(function (e, j) { return j; }).filter(function (j) { return done.indexOf(j) < 0; });
      var on = picks.indexOf(k) >= 0, n = T[k] || 0;
      return '<button type="button" class="av-it' + (on ? ' on' : '') + '" data-avpick="' + k + '"' + (closed ? ' disabled' : '') + ' aria-pressed="' + on + '">' +
        '<span class="av-img">' + img + '</span><b>' + esc(nm) + '</b><small>待更新：' + (todo.length === s.evo.length ? '全部形态' : todo.map(function (j) { return stageLabel(s, j); }).join('、')) + '</small>' +
        '<span class="av-bar"><i style="width:' + (n / max * 100) + '%"></i></span><small class="av-n">' + n + ' 票</small>' + (on ? '<span class="av-ck">✓</span>' : '') + '</button>';
    }).join('');
    return '<p class="av-top"><span>已选 <b class="' + (picks.length ? 'red' : '') + '">' + picks.length + '</b> / ' + AV.data.max + '</span><span class="hint">已有 ' + AV.data.voters + ' 名船员投票' + (mine.length ? ' · 你已投票' : '') + '</span>' +
      (closed ? '<b class="red">投票已截止</b>' : '<button type="button" class="btn primary" data-avsend="1"' + (changed ? '' : ' disabled') + '>' + (mine.length ? '修改投票' : '提交投票') + '</button>') + '</p>' +
      '<div class="av-grid">' + tiles + '</div>';
  }
  function artVoteHTML() {
    if (avOnline() && (!AV.data || Date.now() - AV.t > 60000)) setTimeout(avLoad, 0);   // 打开航行日志时，超过 1 分钟就刷新票数
    var closed = Date.now() >= AV_END;
    return '<article class="log-card wide artvote"><span class="tape l"></span><span class="chip log-tag">立绘更新投票</span><h3>下一批想先换新立绘的精灵</h3>' +
      '<p>这些精灵还有形态没换上新立绘。选出你最想先看到新样子的精灵，<b>每人最多选 5 只</b>，截止前可以随时修改。票数最高的会优先安排！</p>' +
      '<p class="log-st' + (closed ? '' : ' on') + '">' + (closed ? '投票已于 10 月 16 日截止，感谢参与！' : '10 月 16 日 24:00 截止') + '</p>' +
      '<div id="artvote">' + artVoteInner() + '</div></article>';
  }
  // 航行日志 · BOSS「奥多亚克」困难难度（2026-10-27：原来是荒芜的卡片）
  function odoLogHTML() {
    var hard = levelOpen('odo', 2), won = bossWon('odo', 2), L = BOSSES.odo.lv[2];
    var st = won ? '你已经击败了困难难度的奥多亚克。' : hard ? '困难难度已经开放，可以挑战了！' : '击败普通难度的奥多亚克后开放。';
    return '<article class="log-card next wide barren-log"><span class="tape r"></span><span class="chip log-tag">BOSS挑战</span><h3>水系BOSS「奥多亚克」· 困难难度</h3>' +
      '<div class="next-art"><img src="' + SPRITES.odo + '" alt=""></div>' +
      '<p>坎伯兰星深海古代神殿附近的奥多亚克，会在歼灭形态和护阵形态之间切换，最后还会进入「虹霓暴走」。LV' + L.lv + '，' + L.hpText + '，首次击败获得' + rwList(L.reward).join('、') + '。</p>' +
      '<p class="log-st' + (hard ? ' on' : '') + '">' + st + '</p>' +
      (bossOpen('odo') ? '<button type="button" class="btn" data-golog="boss-odo">去看看</button>' : '') + '</article>';
  }
  // 补偿大礼包（2026-10-28）：航行日志最上面，每人领一次，领完卡片消失（服务器结算：js/engine/tx.js 的 compGift）
  function giftLogHTML(only) {
    return (only ? [only] : ['base1', 'comp1']).map(function (id) {
      var G = TX.D.GIFTS[id]; if (!G || (acc.gifts && acc.gifts[id])) return '';
      var list = rwList({ exp: G.exp, energy: G.energy, items: G.items }).concat(Object.keys(G.deco || {}).map(function (k) { return '摆件「' + TX.D.BASE_DECO[k].n + '」×' + G.deco[k]; }));
      var intro = id === 'base1' ? '茶室升级成了「基地」！为了庆祝基地改版，送每位船员一套纪念摆件——三只初始精灵的小形态，镀了一层淡淡的金属光泽。领取后在基地点「编辑基地」就能摆出来；基地商城里也可以用 3,000 能量继续购买。' : '感谢各位船员的耐心！这份补偿每个账号都能领一次：';
      var art = id === 'base1' ? '<div class="gift-art">' + Object.keys(G.deco).map(function (k) { return '<img src="' + DECO_IMG[k] + '" alt="">'; }).join('') + '</div>' : '';
      return '<article class="log-card wide gift-card"><span class="tape l"></span><span class="tape r"></span><span class="chip log-tag">限时领取</span><h3>🎁 ' + G.name + '</h3>' + art +
        '<p>' + intro + '</p><ul class="gift-list">' + list.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '<div class="soc-foot"><button type="button" class="btn primary" data-gift="' + id + '">立即领取</button></div></article>';
    }).join('');
  }
  /* 航行日志（2026-11-01 改版）：左边一竖条标题（类型-名称），点标题在右边显示内容。每日任务不放在这里；更新公告在最下面 */
  function summonLogHTML() {
    var B = SUMMON.banner(Date.now()), nm = SPMAP[B.up].evo[0].n;
    return '<article class="log-card wide sum-log"><span class="tape l"></span><span class="chip log-tag">新玩法</span><h3>圣晶石召唤</h3>' +
      '<div class="next-art"><img src="' + SPRITES[B.up] + '" alt=""></div>' +
      '<p>荆楚号上开放了「召唤」！用圣晶石召唤，可以抽到当期 UP 精灵<b>' + esc(nm) + '</b>的精元（5%，第 50 次必出）、稀有精灵的精元、限定刻印、刻印激活晶片、性格重置胶囊等丰厚奖励。每次召唤送召唤代币，可以在代币商店兑换。</p>' +
      '<p>还有<b>友情点召唤</b>：每天免费十连一次。给好友送经验、借好友的助战精灵都能得到友情点。</p>' +
      '<p>全新的<b>刻印</b>系统：每只精灵可以装 3 个刻印，只在 PVE 对战中生效。</p>' +
      (acc.gifts && acc.gifts.sum1 ? '<p class="log-st">已领取召唤上线纪念：圣晶石 ×30</p>' : '<div class="sum-gift">' + H.itemIcon('g_core') + '<span><b>召唤上线纪念</b>：圣晶石 ×30（每位船员一次）</span><button type="button" class="btn primary" data-gift="sum1">领取</button></div>') +
      '<button type="button" class="btn' + (acc.gifts && acc.gifts.sum1 ? ' primary' : '') + '" data-golog="summon">去召唤</button></article>';
  }
  // 基地全面翻新（2026-11-03）：房型宣传图 + 纪念礼包 + 传送到自己的基地
  function baseLogHTML() {
    var R = TX.D.BASE_ROOMS, ks = Object.keys(R), cur = ks.indexOf(ui.logRoom) >= 0 ? ui.logRoom : ks[0], G = TX.D.GIFTS.base1, got = acc.gifts && acc.gifts.base1, op = homeOpen();
    var gift = !G ? '' : got ? '<p class="log-st">已领取基地改版纪念礼包</p>' : '<div class="sum-gift base-gift"><span class="bg-deco">' + Object.keys(G.deco).map(function (k) { return '<img src="' + DECO_IMG[k] + '" alt="">'; }).join('') + '</span><span><b>' + esc(G.name) + '</b>：' + Object.keys(G.deco).map(function (k) { return '摆件「' + esc(TX.D.BASE_DECO[k].n) + '」'; }).join('、') + '（每位船员一次）</span><button type="button" class="btn primary" data-gift="base1">领取</button></div>';
    return '<article class="log-card wide base-log"><span class="tape l"></span><span class="tape r"></span><span class="chip log-tag">版本更新</span><h3>基地全面翻新！</h3>' +
      '<div class="bl-main"><img src="' + BASE_UI[cur].img + '" alt="' + esc(R[cur].n) + '"><span class="bl-cap">' + esc(R[cur].n) + (R[cur].price ? ' · ' + fmt(R[cur].price) + ' 能量' : ' · 默认房型') + '</span></div>' +
      '<div class="bl-thumbs">' + ks.map(function (k) { return '<button type="button" class="bl-th' + (k === cur ? ' on' : '') + '" data-logroom="' + k + '"><img src="' + BASE_UI[k].img + '" alt=""><span>' + esc(R[k].n) + '</span></button>'; }).join('') + '</div>' +
      '<p>原来的茶室升级成了<b>基地</b>！一共 ' + ks.length + ' 种房型：星空甲板、海底穹顶、沙海舰桥、雪原树屋，在基地商城里用能量购买，随时切换。</p>' +
      '<p>点「编辑基地」可以自由摆放<b>摆件</b>：地板摆件放在地上，墙饰挂在墙上，按住拖动、左右转向，最多摆 40 个。精元转化仪可以直接孵化精元，留言板能收到好友的留言，展示的精灵也会在基地里走来走去。</p>' +
      '<p>好友可以来拜访你的基地，在「社交」里点「基地」就能去看看大家布置得怎么样。</p>' + gift +
      (op ? '<button type="button" class="btn primary" data-golog="myhome">前往我的基地</button>' : '<p class="hint">读完荆楚号 · 天门支线「陆羽茶室」后开放基地。</p>') + '</article>';
  }
  function logEntries() {
    var E = [], add = function (t, h) { if (h) E.push({ t: t, h: h }); };
    var now = new Date(), on = mysteryTime();
    var wait = on ? '' : (function () { var t = new Date(now); t.setHours(MYSTERY.from, 0, 0, 0); var m = Math.max(0, Math.round((t - now) / 60000)); return '距离今天的活动开始还有 ' + Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分钟'; })();
    ['comp1'].forEach(function (id) { var G0 = TX.D.GIFTS[id]; if (G0 && !(acc.gifts && acc.gifts[id])) add('限时领取-' + G0.name, giftLogHTML(id)); });   // 还没领的礼包放在最上面（领完自动消失）；基地改版纪念礼包改在「基地全面翻新！」里领（2026-11-03）
    add('版本更新-基地全面翻新！', baseLogHTML());
    add('船员交流-QQ群', '<article class="log-card wide qq-card"><span class="tape l"></span><span class="tape r"></span><div class="qq-txt"><span class="chip log-tag">船员交流</span><h3>QQ 群：<b class="qq-no">' + QQ_GROUP + '</b></h3><p class="hint">攻略、组队切磋、bug 反馈、新精灵立绘抢先看，都在群里。</p></div><button type="button" class="btn primary" data-copyqq="1">复制群号</button></article>');
    add('新玩法-圣晶石召唤', summonLogHTML());
    add('获取精灵-陨石带的飞翼莱克', leibnizLogHTML());
    add('限时活动-明明教官的试炼', mmLogHTML());
    var war = ui.logWar === 'pw' ? 'pw' : 'kbw';
    add('全服任务-坎伯兰星保卫战', '<div class="fparts log-war" role="tablist">' + [['kbw', '坎伯兰星保卫战'], ['pw', '瘴气驱逐战']].map(function (x) { return '<button type="button" role="tab" class="tab' + (war === x[0] ? ' on' : '') + '" aria-selected="' + (war === x[0]) + '" data-logwar="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' + (war === 'pw' ? pwCardHTML('log') : kbwCardHTML('log')));
    add('获取精灵-旅行精灵叶子喵', travelLogHTML());
    add('获取精灵-冥岛的歌声', hornLogHTML());
    add('获取精灵-爱吃米饭的米饭火鸡', riceLogHTML());
    add('精灵推荐-' + PICK.title, pickHTML());
    // 其他公告：标题按卡片里的类型标签和标题自动拼
    [monChangesHTML(), contestLogHTML(), odoLogHTML(), coreLogHTML(), '<article class="log-card ev"><span class="tape l"></span><span class="chip log-tag">限时活动</span><h3>神秘精灵出没</h3>' +
        '<p>每天 <b>16:00–24:00</b>，在星际探索的任何场景，都有 <b>3%</b> 的概率刷出一只神秘精灵！</p><p class="hint">它是什么？只有遇到过的人才知道。</p>' +
        '<p class="log-st ' + (on ? 'on' : '') + '">' + (on ? '活动进行中，今天 24:00 结束' : wait) + '</p></article>',       (function () {   // 困难泰戈尔上线：按玩家进度提示下一步（不剧透隐藏特效）
        var h = levelOpen('tiger', 2), won = bossWon('tiger', 2), tip = won ? '你已经击败了困难难度的泰戈尔，每周挑战已开放。' : h ? '在荆楚号 · 襄阳 · 古城防卫部挑战。' : bossWon('tiger', 1) ? '' : bossOpen('tiger') ? '先击败普通难度的泰戈尔，困难难度就会开放。' : '读完荆楚号 · 襄阳 · 古城防卫部的支线「东北来的泰戈尔」后，就能开始挑战泰戈尔。';
        return '<article class="log-card next tiger-hard"><span class="tape l"></span><span class="chip log-tag">BOSS挑战</span><h3>泰戈尔 · 困难难度已上线</h3>' +
          '<div class="next-art"><img src="' + SPRITES.tagore + '" alt=""></div><p>古城防卫部的泰戈尔终于拿出了真本事！这是它最强的状态，来看看你的队伍能不能接住它的全力一击。</p>' +
          '<p>首次击败获得称号<b>「原力掌控者」</b>、泰戈尔性格药剂 ×3、累积经验 ×50,000，并开放每周挑战。</p><p class="hint">据说……它还藏着一手。' + tip + '</p>' +
          (h ? '<button type="button" class="btn" data-golog="boss-tiger">去挑战</button>' : '') + '</article>';
      })()].forEach(function (h) {
      if (!h) return; var tmp = document.createElement('div'); tmp.innerHTML = h;
      tmp.querySelectorAll('.log-card, .pt-card').forEach(function (el) { var tg = el.querySelector('.log-tag'), h3 = el.querySelector('h3'); add((tg ? tg.textContent.replace(/\s*·.*$/, '') : '公告') + '-' + (h3 ? h3.textContent.replace(/^🎁\s*/, '') : ''), el.outerHTML); });
    });
    add('更新公告-近期改动', changelogHTML());
    return E;
  }
  // 小红点（2026-11-02）：航行日志没读过的条目、飞船终端里可以领取 / 免费的东西
  function logKeyOf(t) { return t === '更新公告-近期改动' && typeof CHANGELOG !== 'undefined' && CHANGELOG[0] ? t + '|' + CHANGELOG[0].date + CHANGELOG[0].title : t; }
  function logRead() { return acc.logRead || (acc.logRead = {}); }
  var LOG_KEYS = null;   // 上次算出来的全部条目（算航行日志的小红点用）
  function logUnread() { if (!acc) return 0; if (!LOG_KEYS) { try { LOG_KEYS = logEntries().map(function (x) { return logKeyOf(x.t); }); } catch (e) { LOG_KEYS = []; } } var R = logRead(); return LOG_KEYS.filter(function (k) { return !R[k]; }).length; }
  function logMarkRead(t) { var k = logKeyOf(t), R = logRead(); if (!R[k]) { R[k] = Date.now(); save(); navDots(); } }
  function renderLog() {
    var E = logEntries(), sel = E.filter(function (x) { return x.t === ui.logSel; })[0] ? ui.logSel : (E.filter(function (x) { return x.t === '版本更新-基地全面翻新！'; })[0] || E[0]).t;   // 每次进入航行日志默认显示「新玩法-圣晶石召唤」
    ui.logSel = sel; LOG_KEYS = E.map(function (x) { return logKeyOf(x.t); });
    logMarkRead(sel);
    $('pg-log').innerHTML = '<div class="page-head"><h2 class="sec">航行日志</h2></div>' +
      '<div class="log-split"><nav class="log-nav" role="tablist" aria-label="航行日志">' + E.map(function (x) { var p = x.t.split('-'), ty = p.length > 1 ? p.shift() : '', nm = p.join('-'), on = x.t === sel; return '<button type="button" role="tab" class="log-nv' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-logsel="' + esc(x.t) + '">' + (ty ? '<small>' + esc(ty) + '</small>' : '') + '<b>' + esc(nm) + '</b>' + (!logRead()[logKeyOf(x.t)] && x.t !== sel ? '<i class="red-dot" aria-label="未读"></i>' : '') + '</button>'; }).join('') + '</nav>' +
      '<div class="log-view">' + E.map(function (x) { return '<section class="log-sec" data-logsec="' + esc(x.t) + '"' + (x.t === sel ? '' : ' hidden') + '>' + x.h + '</section>'; }).join('') + '</div></div>';
  }
  $('pg-log').addEventListener('click', function (e) {
    var b = e.target.closest('[data-logsel]');
    if (b) { ui.logSel = b.dataset.logsel; logMarkRead(ui.logSel); var rd = b.querySelector('.red-dot'); if (rd) rd.remove(); [].forEach.call(document.querySelectorAll('#pg-log .log-nv'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }); [].forEach.call(document.querySelectorAll('#pg-log .log-sec'), function (x) { x.hidden = x.dataset.logsec !== ui.logSel; }); if (window.innerWidth <= 760) { var v = document.querySelector('#pg-log .log-view'); if (v) v.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    var w = e.target.closest('[data-logwar]'); if (w) { ui.logWar = w.dataset.logwar; renderLog(); return; }
  });
  /* 航行日志（2026-11-01）：各个内容先显示成小板块，点开才是完整面板；完整的卡片放在隐藏的 #log-store 里
   * （很多卡片会按 id 原地刷新，所以打开面板时把卡片节点搬进面板，关掉再搬回去）。更新公告放在最下面，只显示最新一条的摘要 */
  var LOG_OPEN = null;
  function logKey(el) { var h = el.querySelector('h3'); return (h ? h.textContent : '') + '|' + el.className; }
  function logTiles() {
    var st = $('log-store'), box = $('log-tiles'); if (!st || !box) return;
    var cards = Array.prototype.filter.call(st.children, function (el) { return el.classList.contains('log-card') && !el.classList.contains('changelog'); });
    box.innerHTML = cards.map(function (el, i) {
      var tag = el.querySelector('.log-tag'), h = el.querySelector('h3'), img = el.querySelector('img'), lst = el.querySelector('.log-st');
      var ttl = h ? h.textContent : '', hot = /限时|新活动|全服|争霸|领取/.test(tag ? tag.textContent : '');
      return '<button type="button" class="log-tile' + (hot ? ' hot' : '') + '" data-logi="' + i + '"><span class="chip log-tag">' + esc(tag ? tag.textContent : '公告') + '</span>' +
        (img && img.getAttribute('src') ? '<img src="' + esc(img.getAttribute('src')) + '" alt="">' : '') + '<b>' + esc(ttl) + '</b>' + (lst ? '<small>' + esc(lst.textContent) + '</small>' : '') + '<span class="lt-go" aria-hidden="true">›</span></button>';
    }).join('');
    box._cards = cards;
    if (LOG_OPEN) { var hit = cards.concat(Array.prototype.slice.call(st.querySelectorAll('.changelog'))).filter(function (el) { return logKey(el) === LOG_OPEN; })[0]; LOG_OPEN = null; if (hit) logOpen(hit, true); }
  }
  function logOpen(el, quiet) {
    logClose(); LOG_OPEN = logKey(el);
    var ov = document.createElement('div'); ov.className = 'log-panel' + (quiet ? ' quiet' : ''); ov.id = 'log-panel'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="log-panel-box"><button type="button" class="btn ghost lp-x" data-logx="1" aria-label="关闭">✕</button></div>';
    $('pg-log').appendChild(ov); ov.firstChild.appendChild(el);
  }
  function logClose() {
    var ov = $('log-panel'); if (!ov) return; var el = ov.querySelector('.log-card'), st = $('log-store');
    if (el && st) st.appendChild(el); ov.remove(); LOG_OPEN = null;
  }
  function changelogMini() {
    var L = typeof CHANGELOG !== 'undefined' ? CHANGELOG : []; if (!L.length) return '';
    var c = L[0];
    return '<div class="cl-mini"><span class="chip log-tag">更新公告</span><b>' + esc(c.title) + '</b><span class="cl-mini-d">' + esc(c.date) + '</span>' +
      '<span class="cl-mini-t">' + esc(c.items.slice(0, 2).join('；')) + (c.items.length > 2 ? '……' : '') + '</span><button type="button" class="btn ghost" data-clall="1">查看全部</button></div>';
  }
  $('pg-log').addEventListener('click', function (e) {
    var t = e.target.closest('[data-logi]'); if (t) { var c = ($('log-tiles') || {})._cards; if (c && c[+t.dataset.logi]) logOpen(c[+t.dataset.logi]); return; }
    if (e.target.closest('[data-clall]')) { var cl = document.querySelector('#log-store .changelog'); if (cl) logOpen(cl); return; }
    if (e.target.closest('[data-logx]') || (e.target.classList && e.target.classList.contains('log-panel'))) { logClose(); return; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('log-panel')) logClose(); });
  /* ---------- 竞技代币商店（2026-10-14） ----------
   * 竞技代币：平衡排位每天前 10 局每局掉 20 个。商店在竞技对战 · 平衡排位的段位卡里打开（弹窗）。
   * 卖的都是精灵道具，买到后放进储存箱，在储存箱或精灵资料里使用。 */
  var TOKEN_SHOP = TX.D.TOKEN_SHOP;   // 商品和价格在 js/engine/tx.js
  function tokens() { return (acc && acc.tokens) || 0; }
  function tokenBarHTML() {
    if (!ready()) return '';
    return '<div class="tk-bar"><span class="tape l"></span><span class="tk-coin" aria-hidden="true">代</span><span class="tk-txt"><b>竞技代币 ' + fmt(tokens()) + '</b><small>平衡排位每天前 ' + RANK_EXP_N + ' 局每局掉落 ' + RANK_TOKEN + ' 个，可以兑换天赋药剂、学习力合剂、成长果实等</small></span>' +
      '<button type="button" class="btn primary" data-tkshop="1">竞技代币商店</button></div>';
  }
  var tkQty = {};
  function tokenShopHTML() {
    var bal = tokens();
    return '<span class="tape l"></span><span class="tape r"></span><span class="step">荆楚号 · 孝感大厅</span><h2>竞技代币商店</h2>' +
      '<div class="shop-bal tk-bal">持有竞技代币 <b>' + fmt(bal) + '</b><span class="hint">兑换的道具放进储存箱，在储存箱或精灵资料里使用</span></div>' +
      '<div class="tk-list">' + TOKEN_SHOP.map(function (T) {
        var it = USE_ITEMS[T.k], q = tkQty[T.k] || 1, cost = T.price * q, ok = bal >= cost;
        return '<article class="tk-it"><div class="si-txt"><b>' + esc(it.name) + '</b><p class="hint">' + esc(shortD(it)) + '</p><p class="si-own">持有 <b>' + (acc.items[T.k] || 0) + '</b></p></div>' +
          '<div class="si-buy"><span class="si-price">' + T.price + ' <small>代币</small></span>' +
          '<div class="qty"><button type="button" class="btn ghost" data-tkq="' + T.k + '" data-d="-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-tkq="' + T.k + '" data-d="1" aria-label="增加"' + (q >= 20 ? ' disabled' : '') + '>+</button></div>' +
          '<button type="button" class="btn primary" data-tkbuy="' + T.k + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '兑换 · ' + cost : '代币不足') + '</button></div></article>';
      }).join('') + '</div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-tkx="1">关闭</button></div>';
  }
  function openTokenShop() {
    if (!ready() || $('tkshop')) return;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'tkshop';
    var box = document.createElement('div'); box.className = 'soc-box mailbox tkshop'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '竞技代币商店');
    d.appendChild(box); document.body.appendChild(d);
    function draw() { var L0 = box.querySelector('.tk-list'), y = L0 ? L0.scrollTop : 0; box.innerHTML = tokenShopHTML(); var L1 = box.querySelector('.tk-list'); if (L1) L1.scrollTop = y; }   // 点 +1 等重画时保持列表的滚动位置
    function close() { d.remove(); if (window.HSBATTLE && HSBATTLE.renderMode && $('battle').hidden) HSBATTLE.renderMode(); }
    draw();
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-tkx]')) { close(); return; }
      var t;
      if ((t = e.target.closest('[data-tkq]'))) { var k0 = t.dataset.tkq; tkQty[k0] = Math.max(1, Math.min(20, (tkQty[k0] || 1) + +t.dataset.d)); draw(); return; }
      if ((t = e.target.closest('[data-tkbuy]')) && !t.disabled) {
        var k = t.dataset.tkbuy, T = TOKEN_SHOP.filter(function (x) { return x.k === k; })[0], q = tkQty[k] || 1, cost = T ? T.price * q : 0;
        if (!T || tokens() < cost) return;
        txRun('token', { k: k, n: q }, function (r) {
          tkQty[k] = 1; if (d.isConnected) draw();
          toast('兑换成功：' + itemName(k) + ' ×' + r.n + '，消耗 ' + r.cost + ' 竞技代币。已放进储存箱。');
        });
      }
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-tkshop]')) openTokenShop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('tkshop')) $('tkshop').remove(); });

  // 排位赛季的段位奖励表：显示在竞技对战 · 平衡排位的段位卡下面（battle-ui.js 通过 HSACC.rankRwHTML 调用）
  function rankRwHTML() {
    if (!ready()) return '';
    var best = rankBest(), rec = rankRec(), gotN = 0, allN = 0;
    var rows = RANK_RW.map(function (R, r) {
      if (!R) return '';
      var got = rec.got[r]; allN++; if (got) gotN++;
      return '<tr class="' + (got ? 'got' : r <= best ? 'ok' : '') + (R.gift ? ' big' : '') + '"><td>' + RANKS[r] + '</td><td>累积经验 ×' + fmt(R.exp) + '，能量 ×' + fmt(R.energy) + '，称号「' + titleName(R.title) + '」' + (R.items ? '，' + itemsText(R.items) : '') + (R.gift ? '，<b class="red">' + R.gift.map(function (g) { return form(g).name + ' LV' + g.lv; }).join('、') + '</b>' : '') + '</td><td>' + (got ? '已领取' : '未达成') + '</td></tr>';
    }).join('');
    return '<details class="rk-rw" open><summary><b>排位赛季 ' + SEASON + ' · 首次达到段位的奖励</b><span class="hint">已领取 ' + gotN + ' / ' + allN + '</span></summary>' +
      '<p>本赛季最高段位：<b>' + rankFull(best, (function () { try { var r = fixRank(JSON.parse(localStorage.getItem('hs-rank-v1') || 'null')); return r && r.bestDv; } catch (e) { return 0; } })()) + '</b>。每个段位第一次达到时发放一次，并获得赛季称号（如「S1翡翠」）；<b>达到铂金送 LV10 的' + form({ sid: 'moon', lv: 10 }).name + '，达到王者送 LV10 的' + form({ sid: 'bone', lv: 10 }).name + '</b>。</p>' +
      '<table class="rank-rw"><thead><tr><th>段位</th><th>奖励</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
  }
  $('pg-log').addEventListener('click', function (e) {
    var c = e.target.closest('[data-dclaim]'); if (c) { claimDaily(+c.dataset.dclaim, renderLog); return; }
    if (e.target.closest('[data-gocore]')) { ex.planet = 'jingchu'; go('explore'); teleport('宜昌'); return; }
    var ml = e.target.closest('[data-mmlog]'); if (ml) { var mk = ml.dataset.mmlog; if (mk === 'task') { ex.planet = 'jingchu'; go('explore'); teleport('襄阳'); return; } ex.mmFrom = page === 'holo' ? 'holo' : mk === 'gacha' ? 'log' : 'arena'; ex.view = mk === 'gacha' ? 'mmGacha' : 'mmArena'; go('explore'); renderExplore(); return; }
    if (e.target.closest('[data-gosarena]')) { ex.planet = 'sarena'; ex.view = 'sites'; go('explore'); return; }
    var hd = e.target.closest('[data-hornday]'); if (hd && !hd.disabled && ready() && !hornDayGot()) { txRun('hornDay', {}, function (r) { toast('领取了赫菲角片 ×' + r.n + '，已放入储存箱。'); renderLog(); }); return; }
    var ap = e.target.closest('[data-avpick]');
    if (ap && !ap.disabled && AV.data) {
      var k = ap.dataset.avpick, P = AV.picks || (AV.picks = []), i = P.indexOf(k);
      if (i >= 0) P.splice(i, 1); else if (P.length >= AV.data.max) { toast('最多只能选 ' + AV.data.max + ' 只，先取消一只吧。'); return; } else P.push(k);
      avDraw(); return;
    }
    if (e.target.closest('[data-avsend]') && AV.data && !AV.busy) {
      AV.busy = true;
      CLOUD.api('POST', '/api/artvote', { picks: AV.picks || [] }).then(function (r) {
        AV.busy = false;
        if (r._code !== 200) { toast(r.error || '投票失败'); return; }
        AV.data = r; AV.picks = r.mine.slice(); avDraw(); toast(r.mine.length ? '投票成功！截止前还可以修改。' : '已经撤回了你的投票。');
      }).catch(function () { AV.busy = false; toast('连不上服务器，稍后再试'); });
      return;
    }
    var lr = e.target.closest('[data-logroom]'); if (lr) { ui.logRoom = lr.dataset.logroom; var lv0 = document.querySelector('.log-view'), lsc = lv0 ? lv0.scrollTop : 0; renderLog(); var lv1 = document.querySelector('.log-view'); if (lv1) lv1.scrollTop = lsc; return; }   // 基地翻新：切换宣传图
    var g = e.target.closest('[data-golog]'); if (g) { if (g.dataset.golog === 'boss-barren') { ex.view = 'boss'; ex.boss = 'barren'; go('explore'); return; } if (g.dataset.golog === 'boss-odo') { ex.view = 'boss'; ex.boss = 'odo'; go('explore'); return; }
      if (g.dataset.golog === 'summon') { ex.view = 'summon'; ex.planet = 'jingchu'; go('explore'); return; }
      if (g.dataset.golog === 'myhome') { ex.view = 'home'; ex.area = '天门'; ex.planet = 'jingchu'; go('explore'); renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
      if (g.dataset.golog === 'flora-catch') { ex.planet = 'flora'; ex.view = 'sites'; ex.fpart = 'catch'; go('explore'); renderExplore(); return; }
      if (g.dataset.golog === 'travelcat') { ex.planet = 'flora'; ex.view = 'sites'; ex.fpart = 'story'; ex.flSt = 'side'; go('explore'); renderExplore(); return; }
      if (g.dataset.golog === 'boss-tiger') { ex.view = 'boss'; ex.boss = 'tiger'; ex.bossK = 'tiger'; ex.bossD = 2; go('explore'); return; } go(g.dataset.golog); }
  });

  /* ---------- BOSS：常驻在舰上部门或星球上，可反复挑战；每个BOSS分几档难度 ----------
   * lv：各档难度，按顺序解锁（open 返回是否开放）。boss 是BOSS的特殊能力，规则写在 js/engine/battle.js 的 BOSS_FX 里：
   *   noStatus 免疫异常状态 · feud 东北的纷争（物攻 +30%） · ne 来东北试试 · dr 星球聚能（减伤比例） · mia 瘴气领域 · puppet 瘴毒傀儡 · pp BOSS技能的 PP
   * 战绩存在 acc.bosses[记录名]：简单难度沿用BOSS id（兼容旧存档），其他难度是「id:序号」，每周挑战是「id:w」 */
  // BOSS、每周挑战、属性每周挑战的数据和规则在 js/engine/pve.js（服务器和浏览器共用，2026-10-25）
  var ONLY3 = PVE.ONLY3, BOSSES = PVE.BOSSES, BOSS_CRY = PVE.BOSS_CRY, WEEKLIES = PVE.WEEKLIES;
  function wkKey(W) { return PVE.wkKey(W); }   // 战绩：困难难度沿用原来的「id:w」，简单、普通是「id:w0」「id:w1」
  function wkOpen(W) { return PVE.wkOpen(acc, W); }
  function curWk() { var W = WEEKLIES[ex.wk | 0]; return wkOpen(W) ? W : WEEKLIES.filter(wkOpen)[0] || WEEKLIES[0]; }
  /* ---------- 属性每周挑战（2026-10-20）：草、水、火、冰、电各一个BOSS，和泰戈尔、荒芜的每周挑战并列 ----------
   * BOSS 每周（北京时间周一 0 点）从该属性的野生精灵里随机抽一种（最终形态），分简单 / 普通 / 困难三档，都能直接挑战；
   * 获胜消耗 1 枚挑战许可（和其他每周挑战共用），掉落对应属性的特产。战绩存在 acc.bosses['ewk_属性:难度'] */
  var EWK = PVE.EWK;
  function wkNum(t) { return PVE.wkNum(t); }   // 按北京时间的周一分周
  function ewkPool(t) { return PVE.ewkPool(t); }
  function ewkType(t) { return PVE.ewkType(t); }
  function ewkSid(t) { return PVE.ewkSid(t, Date.now()); }
  function ewkBg(sid) { if (/^(leaf|squid|shroom)$/.test(sid) && BG.field) return BG.field;   // 地球挑战：放地球的操场
    for (var i = 0; i < WILD_REGIONS.length; i++) { var R = WILD_REGIONS[i]; if ((WILD[R.pool] || []).some(function (w) { return w.sid === sid; }) && R.bgs && BG[R.bgs[0]]) return BG[floraBg(R.bgs[0])]; } return null; }
  function ewkLeft() { var end = (wkNum(Date.now()) + 1) * 7 - 3, ms = end * 86400000 - 8 * 3600e3 - Date.now(), h = Math.max(0, Math.floor(ms / 3600000)); return h >= 24 ? Math.floor(h / 24) + ' 天 ' + (h % 24) + ' 小时' : h + ' 小时'; }
  function ewkLabel(T) { return T.team ? '地球挑战' : T.t + '系每周挑战'; }
  function ewkName(T, sid) { return T.team ? T.team.map(function (x) { return SPMAP[x].name; }).join(' · ') : SPMAP[sid].name; }
  function ewkCardHTML(pn) {
    return EWK.types.map(function (T) {
      var sid = ewkSid(T.t); if (!sid) return '';
      return '<button type="button" class="weekly-card ewk-card" data-ewk="' + T.t + '"><span class="tape l"></span><img src="' + SPRITES[sid] + '" alt=""><span class="wk-txt"><span class="chip boss-diff d1">' + (T.team ? '地球挑战 · 每周挑战' : T.t + '系 · 每周挑战') + '</span><b>' + esc(ewkName(T, sid)) + '</b>' +
        '<small>简单 / 普通 / 困难 · 获胜消耗 1 枚挑战许可 · 掉落' + itemName(T.item) + (T.team ? '（比属性挑战多 ' + Math.round((T.dropMul - 1) * 100) + '%）' : ' · 本周还剩 ' + ewkLeft()) + '</small></span><span class="wk-pm"><b>' + pn + '</b> / ' + PERMIT.max + '<small>挑战许可（共用）</small></span></button>';
    }).join('');
  }
  var PERMIT = PVE.PERMIT;   // 每 12 小时恢复 1 枚，最多 24 枚
  function recKey(k, d) { return PVE.recKey(k, d); }
  function bossRec(k, d) { return PVE.bossRec(acc, k, d); }
  function bossWon(k, d) { return PVE.bossWon(acc, k, d); }
  function bossOpen(k) { var B = BOSSES[k]; return !!(B && B.lv[0].open(acc, Date.now())); }
  function levelOpen(k, d) { return PVE.levelOpen(acc, k, d, Date.now()); }
  // 默认选中：已开放的难度里第一档还没击败的；都击败了就选最高档
  function bossSel(k) {
    var B = BOSSES[k], d = ex.bossK === k ? ex.bossD : -1;
    if (d >= 0 && d < B.lv.length && levelOpen(k, d)) return d;
    for (var i = 0; i < B.lv.length; i++) if (levelOpen(k, i) && !bossWon(k, i)) return i;
    for (var j = B.lv.length - 1; j >= 0; j--) if (levelOpen(k, j)) return j;
    return 0;
  }
  function bossWhere(B) { return B.dept ? DEPTS[B.dept][0] : planetOf(B.planet).name + ' · ' + WILD_REGIONS.filter(function (R) { return R.id === B.region; })[0].name; }
  function weeklyOpen() { return PVE.weeklyOpen(acc); }
  // 挑战许可：第一次开放每周挑战时送 1 枚，之后每 12 小时恢复 1 枚
  function permits() { var o = JSON.stringify(acc.permit || null), n = PVE.permits(acc, Date.now()); if (JSON.stringify(acc.permit || null) !== o) save(); return n; }
  function permitNext() { var n = permits(); if (n >= PERMIT.max) return '已满'; var ms = Math.max(0, acc.permit.t + PERMIT.every - Date.now()), m = Math.ceil(ms / 60000); return '下一枚 ' + Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分后恢复'; }
  function bossSpots(n) {
    return Object.keys(BOSSES).filter(function (k) { return BOSSES[k].dept === n; }).map(function (k) {
      var B = BOSSES[k], open = bossOpen(k), won = B.lv.filter(function (L, i) { return bossWon(k, i); }).length;
      var opened = B.lv.filter(function (L, i) { return levelOpen(k, i); }).length;
      return '<button type="button" class="mk shop boss' + (open ? '' : ' locked') + '"' + (open ? ' data-boss="' + k + '"' : ' disabled') + ' style="left:' + B.pos[0] + '%;top:' + B.pos[1] + '%"><span class="mk-dot">' + (open ? 'B' : '锁') + '</span><span class="mk-lab"><b>BOSS · ' + B.name + '</b><small>' +
        (open ? B.lv.slice(0, opened).map(function (L) { return L.diff; }).join(' / ') + (won ? ' · 已击败 ' + won + ' 档' : '') : B.lv[0].lockText) + '</small></span></button>';
    }).join('');
  }
  // SECRET_FX：第一次发动前只显示「？？？」的隐藏BOSS特效（触发后 acc.seenFx[键名] 会被 HSEV('bossfx',...) 记下）
  var SECRET_FX = PVE.SECRET_FX;   // 2026-10-24 起所有BOSS特性都是第一次发动前显示「？？？」（见 fxRules）
  // 2026-10-24：特性改成第一次发动前显示「？？？」之前就挑战过的BOSS难度，它的特性视为都见过了（第二形态之类的隐藏特效除外）
  function seedSeenFx() { if (PVE.seedSeenFx(acc, Date.now())) save(); }
  try { Object.defineProperty(window, 'HS_SEENFX', { get: function () { return acc && acc.seenFx; }, configurable: true }); } catch (e) {}
  function fxRules(L) {
    seedSeenFx();
    var fake = { boss: Object.assign({}, L.boss || {}, { rebirthKnown: !!(acc.seenFx && acc.seenFx.rebirth) }), hp: L.hp }, out = [];   // 没打出过第二形态时，和第二形态有关的说明全部隐藏
    if (L.only) out.push(['【元素亲和】', '只有' + L.only.join('、') + '系技能才能命中它']);
    if (L.boss) BOSS_FX.forEach(function (f) {
      if (!L.boss[f.k]) return;
      if (!(acc.seenFx && acc.seenFx[f.k])) { out.push(['【？？？】', '尚未揭晓。打一场看看它会什么……']); return; }
      out.push(['【' + (f.nm ? f.nm(fake) : f.h) + '】', f.d(fake).split('\n')[0]]);
    });
    var pastKnown = !!(acc.seenFx && acc.seenFx.past);
    if (L.boss && L.boss.past && pastKnown) ['eternal', 'relive', 'sy'].forEach(function (k) { var f = BOSS_FX.filter(function (x) { return x.k === k; })[0]; out.push(['复活后 · 【' + f.h + '】', f.d(fake)]); });
    return out;
  }
  function rewardText(R) {
    var a = [];
    if (R.mon) a.push(form(R.mon).name + ' LV' + R.mon.lv);
    if (R.emblem) a.push(EMBLEMS[R.emblem].n);
    if (R.title) a.push('称号「' + titleName(R.title) + '」');
    if (R.items) for (var k in R.items) a.push(itemName(k) + ' ×' + R.items[k]);
    if (R.exp) a.push('累积经验 ×' + fmt(R.exp));
    if (R.bgm) a.push('基地音乐「' + bgmName(R.bgm) + '」');
    if (R.later) a.push('奖励将在之后添加');
    return a.join('、');
  }
  // 星际探索 · BOSS挑战：所有BOSS集中在这里，点进去就是各自的BOSS页
  function renderBossHub() {
    var cards = Object.keys(BOSSES).map(function (k) {
      var B = BOSSES[k], open = bossOpen(k);
      var lv = B.lv.map(function (L, i) { var op = levelOpen(k, i), won = bossWon(k, i); return '<span class="hb-lv' + (won ? ' won' : op ? ' op' : '') + '">' + L.diff + (won ? ' ✓' : op ? '' : ' 🔒') + '</span>'; }).join('');
      return '<article class="boss-hub-it' + (open ? '' : ' locked') + '"><span class="tape r"></span><div class="hb-art"><img src="' + BG[floraBg(B.bg)] + '" alt="" class="boss-bg"><img src="' + SPRITES[B.sid] + '" alt="" class="boss-mon"></div>' +
        '<div class="hb-txt"><h3>' + B.name + '</h3><p class="hint">' + esc(bossWhere(B)) + ' · ' + esc(B.d) + '</p><p class="hb-lvs">' + lv + '</p>' +
        (open ? '<button type="button" class="btn primary" data-boss="' + k + '" data-from="hub">挑战</button>' : '<button type="button" class="btn" disabled>' + esc(B.lv[0].lockText) + '</button>') + '</div></article>';
    }).join('');
    $('pg-explore').innerHTML = exHead('所有BOSS都集中在这里。难度依次开放，每档难度第一次击败都有奖励。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ex-back">‹ 返回飞船终端</button><b>BOSS挑战</b></div>' +
      (weeklyOpen() ? '<p class="hint">每周挑战在星球列表上方单独入口，挑战许可 ' + permits() + ' / ' + PERMIT.max + '。</p>' : '') +
      '<div class="boss-hub">' + cards + '</div>';
  }
  function renderBoss(weekly) {
    var WK = weekly ? curWk() : null, k = ex.boss, B = BOSSES[k], d = weekly ? WK.d : bossSel(k), L = B.lv[d], won = bossWon(k, d);
    var rec = (acc.bosses && acc.bosses[recKey(k, weekly ? wkKey(WK) : d)]) || {}, open = weekly ? weeklyOpen() : levelOpen(k, d), pn = weekly ? permits() : 0;
    var tabs = weekly ? '<div class="fparts boss-tabs" role="tablist">' + WEEKLIES.map(function (x, i) { return [x, i]; }).filter(function (p) { return p[0].boss === k; }).map(function (p) {
      var op = wkOpen(p[0]), on = p[0] === WK;
      return '<button type="button" role="tab" class="tab' + (on ? ' on' : '') + (op ? '' : ' lock') + '" aria-selected="' + on + '"' + (op ? ' data-wkd="' + p[1] + '"' : ' disabled title="先击败' + B.lv[p[0].d].diff + '难度的' + B.name + '"') + '>' + (op ? '' : '🔒 ') + B.lv[p[0].d].diff + (bossWon(k, wkKey(p[0])) ? ' ✓' : '') + '</button>';
    }).join('') + '</div>' : '<div class="fparts boss-tabs" role="tablist">' + B.lv.map(function (x, i) {
      var op = levelOpen(k, i);
      return '<button type="button" role="tab" class="tab' + (i === d ? ' on' : '') + (op ? '' : ' lock') + '" aria-selected="' + (i === d) + '"' + (op ? ' data-bossd="' + i + '"' : ' disabled title="' + esc(x.lockText) + '"') + '>' + (op ? '' : '🔒 ') + x.diff + (bossWon(k, i) ? ' ✓' : '') + '</button>';
    }).join('') + '</div>';
    var rules = fxRules(L).map(function (r) { return '<li><b>特殊</b>' + esc(r[0]) + '：' + esc(r[1]) + '</li>'; }).join('');
    var rw = weekly ? '每次击败获得累积经验 ×' + fmt(WK.exp) + '、' + rwList({ items: WK.item }).join('、') + (WK.cry ? '、' + itemName('m_mcry') + ' ×' + WK.cry[0] + '–' + WK.cry[1] : '') + '，并随机掉落 ' + WK.drops.map(dropName).join(' / ') + ' 之一'
      : (won ? '已领取（首次击败：' + rewardText(L.reward) + '）；再次击败只获得经验和学习力' : '首次击败：' + rewardText(L.reward) + '；另有经验和学习力');
    var btn = weekly ? '<button type="button" class="btn primary" data-weeklygo="1"' + (pn > 0 ? '' : ' disabled') + '>开始挑战（获胜时消耗 1 枚挑战许可）</button><p class="hint permit-line">挑战许可 <b>' + pn + '</b> / ' + PERMIT.max + ' · ' + permitNext() + '</p>'
      : open ? '<button type="button" class="btn primary" data-bossgo="' + k + '" data-d="' + d + '">开始挑战</button>' : '<button type="button" class="btn" disabled>' + esc(L.lockText) + '</button>';
    $('pg-explore').innerHTML = exHead(weekly ? '每周挑战：和' + L.diff + '难度的' + B.name + '一模一样，每次获胜消耗 1 枚挑战许可，输了不消耗。' : 'BOSS可以反复挑战。难度依次开放，每档难度第一次击败都有奖励。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="boss-back">‹ 返回' + (weekly ? '每周挑战' : ex.bossFrom === 'hub' ? 'BOSS挑战' : bossWhere(B)) + '</button><b>' + (weekly ? '每周挑战 · ' : 'BOSS · ') + B.name + '</b></div>' + tabs +
      '<article class="boss-card"><span class="tape l"></span><div class="boss-art"><img src="' + BG[floraBg(B.bg)] + '" alt="" class="boss-bg"><img src="' + SPRITES[B.sid] + '" alt="' + B.name + '" class="boss-mon"></div>' +
      '<div class="boss-txt"><span class="chip boss-diff d' + d + '">' + (weekly ? '每周挑战 · ' : '') + L.diff + '难度</span><h3>' + B.name + '</h3><p class="hint">' + esc(B.d) + '</p>' +
      '<ul class="boss-rules"><li><b>等级</b>LV' + L.lv + '</li><li><b>体力</b>' + (L.hpText || fmt(L.hp)) + '</li>' + rules +
      '<li><b>奖励</b>' + rw + '</li><li><b>战绩</b>' + (rec.wins || 0) + ' 胜 / ' + (rec.tries || 0) + ' 次挑战</li></ul>' +
      '<p class="hint">' + (weekly && srvMode() ? '开打前可以选择好友的助战精灵和出战顺序（精灵来自' + tName(acc.active) + '）。' : '会使用你当前的出战配队（' + tName(acc.active) + '）。') + (L.only ? '记得带上会' + L.only.join('、') + '系技能的精灵。' : '') + '对战中可以使用补药。</p>' +
      btn + '</div></article>' + (weekly ? '' : '<section class="bsoc" id="bsoc"><p class="hint">读取攻略中……</p></section>');
    if (!weekly) bsocLoad(k, d);
  }
  /* ---------- BOSS攻略板（每个难度一块，服务器见 server/bossboard.js）----------
   * 已通过的玩家（服务器从存档里读）、攻略留言（通过后才能发，每人一条，1~5 星评分）、赞 / 踩 / 欢乐 */
  var BS_MAX = 500;
  function bsOnline() { return !!(window.CLOUD && CLOUD.user && CLOUD.user()); }
  function bsocLoad(k, d) {
    var key = k + ':' + d; ex.bs = ex.bs && ex.bs.key === key ? ex.bs : { key: key, k: k, d: d, data: null, edit: false, stars: 0, draft: '' };
    if (!bsOnline()) { var el0 = $('bsoc'); if (el0) el0.innerHTML = '<h3 class="bs-h">通关玩家 · 攻略</h3><p class="hint">攻略板需要联网：用服务器网址打开游戏并登录后才能看到。</p>'; return; }
    CLOUD.api('GET', '/api/boss?k=' + k + '&d=' + d).then(function (r) {
      if (!ex.bs || ex.bs.key !== key) return;
      if (r._code !== 200) { var e1 = $('bsoc'); if (e1) e1.innerHTML = '<p class="hint">' + esc(r.error || '读取失败') + '</p>'; return; }
      ex.bs.data = r;
      var mine = r.posts.filter(function (p) { return p.me; })[0];
      if (mine && !ex.bs.edit) { ex.bs.stars = mine.stars; }
      bsocDraw();
    }).catch(function () { var e2 = $('bsoc'); if (e2) e2.innerHTML = '<p class="hint">连不上服务器</p>'; });
  }
  function starsTxt(n) { var h = ''; for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= n ? 'on' : '') + '">★</i>'; return '<span class="bs-stars">' + h + '</span>'; }
  function bsAgo(t) { var s0 = (Date.now() - t) / 1000; if (s0 < 60) return '刚刚'; if (s0 < 3600) return Math.floor(s0 / 60) + ' 分钟前'; if (s0 < 86400) return Math.floor(s0 / 3600) + ' 小时前'; var dd = new Date(t); return (dd.getMonth() + 1) + '月' + dd.getDate() + '日'; }
  function bsocDraw() {
    var el = $('bsoc'), S = ex.bs, r = S && S.data; if (!el || !r) return;
    var B = BOSSES[S.k], L = B.lv[S.d], mine = r.posts.filter(function (p) { return p.me; })[0];
    var clears = r.clears.length ? r.clears.slice(0, 40).map(function (c) { return '<span class="bs-clr' + (c.me ? ' me' : '') + '" title="@' + esc(c.user) + '"><span class="pav' + (c.avatar ? ' img' : '') + '">' + avatarInner(c.avatar, c.name) + '</span>' + esc(c.name) + '</span>'; }).join('') + (r.clears.length > 40 ? '<span class="hint">等 ' + r.clears.length + ' 人</span>' : '')
      : '<p class="hint">还没有人通过' + L.diff + '难度。第一个通过的会是你吗？</p>';
    var form = '';
    if (r.canPost && (!mine || S.edit)) {
      var st = S.stars || 0;
      form = '<div class="bs-form"><b>' + (mine ? '修改你的攻略' : '你已经通过了这个难度，写一份攻略吧') + '</b>' +
        '<div class="bs-pick" role="radiogroup" aria-label="评分">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="' + (n <= st ? 'on' : '') + '" data-bsstar="' + n + '" aria-label="' + n + ' 星">★</button>'; }).join('') + '<span class="hint">' + (st ? st + ' 星' : '给这个难度打个分（1~5 星）') + '</span></div>' +
        '<textarea id="bs-text" rows="4" maxlength="' + BS_MAX + '" placeholder="带了哪几只精灵、怎么打的、要注意什么……">' + esc(S.draft || (mine ? mine.text : '')) + '</textarea>' +
        '<div class="bs-row"><span class="hint" id="bs-cnt">' + Array.from(S.draft || (mine ? mine.text : '')).length + ' / ' + BS_MAX + '</span>' + (mine ? '<button type="button" class="btn ghost" data-bsx="1">取消</button>' : '') + '<button type="button" class="btn primary" data-bssend="1">' + (mine ? '保存修改' : '发表攻略') + '</button></div></div>';
    } else if (!r.canPost) form = '<p class="hint bs-lock">通过' + L.diff + '难度之后，可以在这里发攻略、给这个难度打分。</p>';
    var posts = r.posts.length ? r.posts.map(function (p) {
      var vb = function (v, ico, lab) { return '<button type="button" class="bs-v' + (p.my[v] ? ' on' : '') + '" data-bsvote="' + v + '" data-id="' + esc(p.id) + '"' + (p.me ? ' disabled title="不能给自己投票"' : ' title="' + lab + '"') + '>' + ico + ' <b>' + p[v] + '</b></button>'; };
      return '<li class="bs-post' + (p.me ? ' mine' : '') + '"><span class="pav' + (p.avatar ? ' img' : '') + '">' + avatarInner(p.avatar, p.name) + '</span><div class="bs-body">' +
        '<p class="bs-who"><b>' + esc(p.name) + '</b>' + starsTxt(p.stars) + '<span class="hint">' + bsAgo(p.edited || p.t) + (p.edited ? '（修改过）' : '') + '</span></p>' +
        '<p class="bs-text">' + esc(p.text) + '</p><p class="bs-acts">' + vb('up', '👍', '赞') + vb('down', '👎', '踩') + vb('fun', '😂', '欢乐') +
        (p.me ? '<button type="button" class="linkbtn" data-bsedit="1">修改</button><button type="button" class="linkbtn red" data-bsdel="' + esc(p.id) + '">删除</button>' : '') + '</p></div></li>';
    }).join('') : '<li class="hint bs-none">还没有攻略。</li>';
    el.innerHTML = '<span class="tape r"></span><div class="bs-top"><h3 class="bs-h">' + B.name + ' · ' + L.diff + '难度</h3>' +
      (r.posts.length ? '<span class="bs-avg">' + starsTxt(Math.round(r.avg)) + ' <b>' + r.avg.toFixed(1) + '</b> <small>' + r.posts.length + ' 份评价</small></span>' : '<span class="hint">暂无评分</span>') + '</div>' +
      '<h4>已通过的玩家 <small>' + r.clears.length + ' 人</small></h4><div class="bs-clears">' + clears + '</div>' +
      '<h4>攻略 · 留言 <small>按赞数排序</small></h4>' + form + '<ul class="bs-list">' + posts + '</ul>';
  }
  function bsocClick(e) {
    var S = ex.bs, t; if (!S) return;
    if ((t = e.target.closest('[data-bsstar]'))) { var ta = $('bs-text'); if (ta) S.draft = ta.value; S.stars = +t.dataset.bsstar; bsocDraw(); return; }
    if (e.target.closest('[data-bsedit]')) { S.edit = true; S.draft = ''; bsocDraw(); var t2 = $('bs-text'); if (t2) t2.focus(); return; }
    if (e.target.closest('[data-bsx]')) { S.edit = false; S.draft = ''; bsocLoad(S.k, S.d); return; }
    if ((t = e.target.closest('[data-bssend]'))) {
      var text = ($('bs-text') || {}).value || '';
      if (!S.stars) { toast('先点星星给这个难度打个分（1~5 星）。'); return; }
      if (!text.trim()) { toast('攻略不能是空的。'); return; }
      t.disabled = true;
      CLOUD.api('POST', '/api/boss-post', { k: S.k, d: S.d, text: text, stars: S.stars }).then(function (r) {
        if (r._code !== 200) { t.disabled = false; toast(r.error || '发表失败'); return; }
        S.edit = false; S.draft = ''; toast(r.edited ? '攻略已修改。' : '攻略已发表，其他船员可以看到了。'); bsocLoad(S.k, S.d);
      }).catch(function () { t.disabled = false; toast('连不上服务器'); });
      return;
    }
    if ((t = e.target.closest('[data-bsvote]'))) {
      if (t.disabled) return;
      CLOUD.api('POST', '/api/boss-vote', { k: S.k, d: S.d, id: t.dataset.id, v: t.dataset.bsvote }).then(function (r) {
        if (r._code !== 200) { toast(r.error || '操作失败'); return; }
        var P = S.data.posts.filter(function (p) { return p.id === t.dataset.id; })[0]; if (P) { P.up = r.up; P.down = r.down; P.fun = r.fun; P.my = r.my; }
        bsocDraw();
      }).catch(function () { toast('连不上服务器'); });
      return;
    }
    if ((t = e.target.closest('[data-bsdel]'))) {
      if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = '确认删除？'; return; }
      CLOUD.api('POST', '/api/boss-del', { k: S.k, d: S.d, id: t.dataset.bsdel }).then(function (r) {
        if (r._code !== 200) { toast(r.error || '删除失败'); return; }
        S.stars = 0; bsocLoad(S.k, S.d);
      }).catch(function () { toast('连不上服务器'); });
    }
  }
  $('pg-explore').addEventListener('input', function (e) { if (e.target.id === 'bs-text' && ex.bs) { ex.bs.draft = e.target.value; var c = $('bs-cnt'); if (c) c.textContent = Array.from(e.target.value).length + ' / ' + BS_MAX; } });
  function dropName(D) { return D.items ? Object.keys(D.items).map(function (k) { return itemName(k) + (D.items[k] > 1 ? ' ×' + D.items[k] : ''); }).join('、') : D.energy ? '能量 ×' + fmt(D.energy) : '累积经验 ×' + fmt(D.exp); }
  // 每档难度第一次击败的奖励
  function firstReward(L, fk) {
    var R = L.reward, out = [];
    if (R.mon) {
      var m = newMon(R.mon.sid, R.mon.lv), T = acc.teams[acc.active], added = T.length < TEAM_SIZE;
      if (added) T.push(m.u);
      out.push('获得了 ' + form(m).name + '（LV' + R.mon.lv + '，' + m.nat + '）！' + (added ? '已加入' + tName(acc.active) + '。' : '已收入精灵仓库。'));
    }
    if (R.emblem) { if (!acc.emblems) acc.emblems = {}; acc.emblems[R.emblem] = 1; out.push('获得了「' + EMBLEMS[R.emblem].n + '」！以后你的' + SPMAP[R.emblem].name + '（包括还没进化的）都会带着它：' + EMBLEMS[R.emblem].d + '。'); }
    if (R.title && acc.titles.indexOf(R.title) < 0) { acc.titles.push(R.title); out.push('获得称号「' + titleName(R.title) + '」！点右上角的名字即可佩戴。'); }
    if (R.items || R.exp) earn('bossFirst', fk, { items: R.items, exp: R.exp });
    if (R.items) { out.push('获得 ' + Object.keys(R.items).map(function (k) { return itemName(k) + ' ×' + R.items[k]; }).join('、') + '，可以在精灵资料或「储存箱」里使用。'); }
    if (R.exp) { out.push('累积经验 +' + fmt(R.exp) + '，已放进经验背包。'); }
    if (R.bgm) { acc.mailSeen['barren-bgm'] = Date.now(); out.push('获得茶室音乐「' + bgmName(R.bgm) + '」！去陆羽茶室 · 我的房间就能换上，来拜访你茶室的船员也都能听到。'); }
    if (R.later) out.push('这一档难度的首次击败奖励将在之后添加，到时会通过邮箱补发给已经击败过的船员。');
    return out;
  }
  function weeklyReward(W) {
    var D = W.drops[Math.floor(Math.random() * W.drops.length)];
    var fix = Object.assign({}, W.item);
    if (W.cry) fix.m_mcry = (fix.m_mcry || 0) + W.cry[0] + Math.floor(Math.random() * (W.cry[1] - W.cry[0] + 1));
    var wi = Object.assign({}, fix); if (D.items) for (var wk in D.items) wi[wk] = (wi[wk] || 0) + D.items[wk];
    earn('weekly', '', { exp: W.exp + (D.exp || 0), energy: D.energy, items: wi });
    return ['每周挑战奖励：累积经验 +' + fmt(W.exp) + '、' + rwList({ items: fix }).join('、') + '；掉落了「' + dropName(D) + '」！'];
  }
  /* ---------- 服务器结算的单人对战（2026-10-25）：用服务器网址玩时，BOSS、挑战等由服务器开打和结算 ----------
   * 规则在 js/engine/pve.js 的 MODES。服务器改完存档后把整份存档发回来，这里直接换上（adoptAcc），再照服务器给的结果写提示。
   * 本地双击打开（没有服务器）时仍走原来的本机结算。 */
  function srvMode() { return !!(window.CLOUD && CLOUD.user()); }
  function patchAcc(fx) {   // 服务器改回的几项（cloud.js 上传后）：只换这几项
    if (!acc || !fx || typeof fx !== 'object') return;
    for (var k in fx) { if (fx[k] === null) delete acc[k]; else acc[k] = fx[k]; }
    save(); try { renderRes(); } catch (e) {}   // 不重画整页（剧情、对战画面开着时会被打断）
  }
  window.HS_CORE = function () { return (acc && acc.items && acc.items.g_core) || 0; };   // 对战里花圣晶石复活用（battle-ui.js 的 coreAsk）
  window.HS_ADOPT = function (js) { adoptAcc(js); renderRes(); };
  window.HS_USECORE = function () { if (!acc || !(acc.items.g_core > 0)) return false; acc.items.g_core--; save(); renderRes(); return true; };
  function adoptAcc(js) {
    try { var a = typeof js === 'string' ? JSON.parse(js) : js; if (!valid(a)) return false; acc = a; save(); return true; } catch (e) { return false; }
  }
  var pveBusy = false;
  // kind、args：服务器上的模式和参数；ui = { bg, back, pre() }；done(e, res)：e 是服务器的结算结果（作废时为 null）
  // 对战用到的图（双方精灵、背景）：进对战前先下载好，加载面板的进度条跟着走
  function battleImgs(S, bg) {
    var out = [];
    (S && S.sides || []).forEach(function (sd) { (sd.team || []).forEach(function (t) { var sp = t && SPMAP[t.id]; out.push(t && t.img ? t.img : sp ? formImg(sp, stageOf(sp, t.lv || 1)) : null); }); });
    if (typeof bg === 'string' && /[\/.]/.test(bg)) out.push(bg);
    return out;
  }
  function pveRemote(kind, args, ui, done) {
    if (pveBusy) return; pveBusy = true;
    var L = LOADER.show(ui.loadText || '正在进入对战系统～'); L.to(0.7);   // 加载面板（js/ui/loader.js）：很快就进去时不会出现
    CLOUD.pve({ op: 'start', kind: kind, args: args }).then(function (r) {
      if (!r || !r.ok) { pveBusy = false; L.close(); if (r && r.err) toast(r.err); if (ui.fail) ui.fail(r); return; }
      if (r.acc) adoptAcc(r.acc);
      L.set(0.72).text(ui.loadText2 || '正在布置战场～');
      LOADER.images(battleImgs(r.S, ui.bg), function (n, t) { L.set(0.72 + 0.27 * n / t); }, function () { L.done(function () { pveBusy = false; go(r); }); });
    }, function () { pveBusy = false; L.close(); });
    function go(r) {
      var o = r.opt || {}, endE = null;
      if (ui.adjust) ui.adjust(r, ui);
      if (r.S.wild) { r.S.wild.where = ui.where || ''; r.S.wild.back = ui.back || ''; }
      stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
      if (ui.pre) ui.pre(); else $('pg-explore').hidden = true;
      $('pg-arena').hidden = false;
      window.HSBATTLE.start({ S: r.S, seq: r.seq || 0, resume: !!r.resume, remote: CLOUD.pve, foe: o.foe, diff: o.diff, bgm: o.bgm || null, bgmAt: o.bgmAt || null, back: ui.back || null, bg: ui.bg || null, corrupt: !!ui.corrupt, cuts: ui.cuts || null, stars: ui.stars || null, preEvs: r.pre || null, env: ui.env || null, wild: r.S.wild || null, onItem: useInv,
        onSrvEnd: function (e) { endE = e; if (e && e.acc) adoptAcc(e.acc); },
        onEnd: function (res, seen, downs, quit, endS) {
          var e = endE || (endS && endS.srvEnd) || null;
          if (e && !endE && e.acc) adoptAcc(e.acc);
          done(e && !e.err ? e : null, res);
        } });
    }
  }
  // 服务器结算的战斗经验（ACC.battleXp 的结果）写成提示
  function xpMsg(x) {
    if (!x || !x.n) return [];
    var out = [];
    if (x.xp > 0) {
      out.push('击败了 ' + x.n + ' 只精灵，共获得 ' + fmt(x.xp) + ' 点经验' + (x.xp < x.raw ? '（今天的战斗经验已达上限 ' + fmt(PVE_XP_CAP) + '）' : '') + '：');
      out.push((x.gains || []).map(function (g) { if (REW.collect) REW.gains.push({ u: g.u, lv0: g.lv0, exp0: g.exp0, amt: g.amt }); return gainMsg(g); }).join(''));
      out.push('经验背包 +' + fmt(x.pool) + '。');
    } else out.push('击败了 ' + x.n + ' 只精灵。今天通过战斗获得的经验已达上限（' + fmt(PVE_XP_CAP) + '），明天再来吧。');
    var got = (x.evGot || []).map(function (u) { var m = mon(u); return m ? form(m).name : ''; }).filter(Boolean);
    if (got.length) out.push(got.join('、') + (got.length > 1 ? ' 各' : ' ') + '获得 ' + x.ev + ' 点学习力。');
    return out;
  }
  // BOSS首次击败奖励（服务器已经发了）写成提示，和 firstReward 的一样
  function firstMsg(fr) {
    var out = []; if (!fr) return out;
    if (fr.mon) { var m = mon(fr.mon.u); if (m) out.push('获得了 ' + form(m).name + '（LV' + m.lv + '，' + m.nat + '）！' + (fr.mon.added ? '已加入' + tName(acc.active) + '。' : '已收入精灵仓库。')); }
    if (fr.emblem) out.push('获得了「' + EMBLEMS[fr.emblem].n + '」！以后你的' + SPMAP[fr.emblem].name + '（包括还没进化的）都会带着它：' + EMBLEMS[fr.emblem].d + '。');
    if (fr.title) out.push('获得称号「' + titleName(fr.title) + '」！点右上角的名字即可佩戴。');
    if (fr.items) out.push('获得 ' + Object.keys(fr.items).map(function (k) { return itemName(k) + ' ×' + fr.items[k]; }).join('、') + '，可以在精灵资料或「储存箱」里使用。');
    if (fr.exp) out.push('累积经验 +' + fmt(fr.exp) + '，已放进经验背包。');
    if (fr.bgm) out.push('获得茶室音乐「' + bgmName(fr.bgm) + '」！去陆羽茶室 · 我的房间就能换上，来拜访你茶室的船员也都能听到。');
    if (fr.later) out.push('这一档难度的首次击败奖励将在之后添加，到时会通过邮箱补发给已经击败过的船员。');
    return out;
  }
  // BOSS / 每周挑战结束后回到原来的界面
  function bossBack(view, set) {
    ex.fighting = false; document.body.classList.remove('story-fight');
    ex.view = view; set();
    $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
    renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
  }
  /* ---------- 自选出战面板（2026-10-27）：每周挑战、明明教官的试炼开打前，选好友的助战精灵、调整出战顺序（排第一的是首发） ----------
   * 自己的精灵来自当前配队，可以让某只休息；带助战时自己最多 4 只。选好后 go({ line: [精灵编号 或 'h'], helper: { user, u } 或 null, key: 助战的 key }) */
  function tpTeam() { return (acc.teams[acc.active] || []).map(mon).filter(Boolean).slice(0, TEAM_SIZE); }
  function tpHelpers() { return helperList().filter(function (h) { return h.key !== 'mm'; }); }
  function tpHelper() { return ex.tp && ex.tp.helper ? tpHelpers().filter(function (h) { return h.key === ex.tp.helper; })[0] || null : null; }
  function tpSync() {
    var team = tpTeam(), tk = acc.active + ':' + team.map(function (m) { return m.u; }).join(',');
    if (!ex.tp || ex.tp.tk !== tk) ex.tp = { tk: tk, helper: ex.tp ? ex.tp.helper : null, order: team.map(function (m) { return 'u' + m.u; }), off: {} };
    var T = ex.tp; team.forEach(function (m) { if (T.order.indexOf('u' + m.u) < 0) T.order.push('u' + m.u); });
    if (T.order.indexOf('h') < 0) T.order.push('h');
    var HP = tpHelper(), max = HP ? TEAM_SIZE - 1 : TEAM_SIZE, on = T.order.filter(function (k) { return k !== 'h' && !T.off[k] && team.some(function (m) { return 'u' + m.u === k; }); });
    while (on.length > max) T.off[on.pop()] = 1;   // 带上助战后超出 5 只：顺序最后的那只先休息
    return { team: team, HP: HP, max: max };
  }
  function tpLineup() {
    var X = tpSync(), T = ex.tp, out = [];
    T.order.forEach(function (k) {
      if (k === 'h') { if (X.HP) out.push({ k: 'h', h: X.HP }); return; }
      var m = X.team.filter(function (x) { return 'u' + x.u === k; })[0]; if (m && !T.off[k]) out.push({ k: k, m: m });
    });
    return out;
  }
  function tpArgs(args, tp) {
    if (!tp) return args;
    args.line = tp.line; args.helper = tp.helper;
    if (tp.helper && bsOnline()) CLOUD.api('POST', '/api/helper-use', { owner: tp.helper.user }).catch(function () {});   // 借了好友的助战：给主人记一次
    return args;
  }
  // 「再来一局」前检查：精灵都还在配队里、助战还借得到；返回出战列表（给预览用），不行就返回 null
  function tpValid(tp) {
    if (!tp || !Array.isArray(tp.line)) return null;
    var team = tpTeam(), out = [];
    for (var i = 0; i < tp.line.length; i++) {
      var v = tp.line[i];
      if (v === 'h') { var H = tpHelpers().filter(function (h) { return h.key === tp.key; })[0] || tp.hp; if (!H) return null; out.push({ h: H }); continue; }
      var m = team.filter(function (x) { return x.u === v; })[0]; if (!m) return null; out.push({ m: m });
    }
    return out.length ? out : null;
  }
  function openTeamPrep(title, go) {
    var old = $('tp-dlg'); if (old) old.remove();
    ex.tpGo = go; ex.tpTitle = title; loadHelpers(); renderTeamPrep();
  }
  function renderTeamPrep() {
    var d = $('tp-dlg'), box = d && d.querySelector('.soc-box'), sc = box ? box.scrollTop : 0, sd = d ? d.scrollTop : 0;
    if (!d) {
      d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'tp-dlg'; document.body.appendChild(d);
      d.addEventListener('click', function (e) {
        var t = e.target, T = ex.tp; if (!T) return;
        if (t === d || t.closest('[data-tpx]')) { d.remove(); return; }
        var b;
        if ((b = t.closest('[data-tphelp]'))) { T.helper = b.dataset.tphelp || null; renderTeamPrep(); return; }
        if ((b = t.closest('[data-tpmv]'))) { var vis = tpLineup().map(function (x) { return x.k; }), k0 = b.dataset.k2, j = vis.indexOf(k0), j2 = j + (+b.dataset.tpmv); if (j >= 0 && j2 >= 0 && j2 < vis.length) { var other = vis[j2], o = T.order.slice(), a1 = o.indexOf(k0), a2 = o.indexOf(other); o[a1] = other; o[a2] = k0; T.order = o; } renderTeamPrep(); return; }
        if ((b = t.closest('[data-tplead]'))) { var k = b.dataset.tplead; T.order = [k].concat(T.order.filter(function (x) { return x !== k; })); renderTeamPrep(); return; }
        if ((b = t.closest('[data-tpoff]'))) { var X = tpSync(), on = tpLineup().filter(function (x) { return x.m; }); if (on.length > 1) T.off[b.dataset.tpoff] = 1; else toast('至少要带一只自己的精灵。'); void X; renderTeamPrep(); return; }
        if ((b = t.closest('[data-tpon]'))) { var X2 = tpSync(), on2 = tpLineup().filter(function (x) { return x.m; }); if (on2.length < X2.max) delete T.off[b.dataset.tpon]; else toast(X2.HP ? '带助战时自己最多 ' + X2.max + ' 只，先让一只休息。' : '最多 ' + X2.max + ' 只。'); renderTeamPrep(); return; }
        if (t.closest('[data-tpgo]')) {
          var L = tpLineup(); if (!L.some(function (x) { return x.m; })) return;
          var HP = tpHelper(), go = ex.tpGo;
          d.remove();
          if (go) go({ line: L.map(function (x) { return x.m ? x.m.u : 'h'; }), helper: HP ? { user: HP.user, u: +String(HP.key).split(':').pop() } : null, key: HP ? HP.key : null, hp: HP });
        }
      });
    }
    var X = tpSync(), T = ex.tp, L = tpLineup(), rest = X.team.filter(function (m) { return T.off['u' + m.u]; });
    var helps = tpHelpers(), card = function (e, i) {
      var f = e.m ? form(e.m) : form(e.h.mon), lv = e.m ? e.m.lv : e.h.mon.lv;
      return '<li class="lu-card' + (i ? '' : ' lead') + '" data-k="' + e.k + '"><span class="lu-no">' + (i ? '第 ' + (i + 1) + ' 位' : '首发') + '</span><img src="' + f.img + '" alt="" draggable="false"><b>' + esc(f.name) + '</b><small>LV' + lv + (e.h ? ' · 助战（' + esc(e.h.owner) + '）' : '') + '</small>' + tchips(SPMAP[e.m ? e.m.sid : e.h.mon.sid].types) +
        '<span class="tp-btns">' + (i ? '<button type="button" class="btn ghost lu-lead" data-tpmv="-1" data-k2="' + e.k + '" aria-label="往前挪">‹</button><button type="button" class="btn ghost lu-lead" data-tplead="' + e.k + '">设为首发</button>' : '') + (i < L.length - 1 ? '<button type="button" class="btn ghost lu-lead" data-tpmv="1" data-k2="' + e.k + '" aria-label="往后挪">›</button>' : '') + (e.m ? '<button type="button" class="btn ghost lu-lead" data-tpoff="' + e.k + '">休息</button>' : '') + '</span></li>';
    };
    d.innerHTML = '<div class="soc-box lu-box" role="dialog" aria-modal="true" aria-label="选择助战和首发"><span class="tape l"></span><span class="tape r"></span>' +
      '<span class="step">' + esc(ex.tpTitle || '') + '</span><h2>助战与出战顺序</h2>' +
      '<h4>助战精灵 <span class="hint">好友名片里的助战精灵，带上后自己最多 ' + (TEAM_SIZE - 1) + ' 只</span></h4>' +
      '<div class="ch-helpers"><button type="button" class="ch-help' + (!X.HP ? ' on' : '') + '" data-tphelp=""><span class="ch-none">不带助战</span></button>' + helps.map(function (h) {
        var f = form(h.mon), on = X.HP && X.HP.key === h.key;
        return '<button type="button" class="ch-help' + (on ? ' on' : '') + '" data-tphelp="' + esc(h.key) + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + h.mon.lv + ' · ' + esc(h.owner) + '</small></button>';
      }).join('') + '</div>' +
      (helps.length ? '' : '<p class="hint">' + (bsOnline() ? (ex.hpBusy ? '正在读取好友的助战精灵……' : '好友在「社交 → 我的名片」里放了助战精灵后，会出现在这里。') : '联网登录后，可以借用好友名片里的助战精灵。') + '</p>') +
      '<h4>出战顺序 <span class="hint">按住拖动、或点 ‹ › 调整，排在第一个的就是首发</span></h4>' +
      '<ol class="lu-list" id="tp-list">' + L.map(card).join('') + '</ol>' +
      (rest.length ? '<h4>休息中</h4><div class="ch-mons">' + rest.map(function (m) { var f = form(m); return '<button type="button" class="ch-mon" data-tpon="u' + m.u + '"><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + ' · 点一下上场</small></button>'; }).join('') + '</div>' : '') +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-tpx="1">取消</button><button type="button" class="btn primary" data-tpgo="1"' + (L.some(function (x) { return x.m; }) ? '' : ' disabled') + '>开始战斗</button></div></div>';
    var list = $('tp-list');
    if (window.HSUI && HSUI.sortable) HSUI.sortable(list, function (keys) { ex.tp.order = keys.concat(ex.tp.order.filter(function (k) { return keys.indexOf(k) < 0; })); renderTeamPrep(); });
    box = d.querySelector('.soc-box'); if (box) box.scrollTop = sc; d.scrollTop = sd;
  }
  function startBossRemote(k, d, weekly, tp) {
    var B = BOSSES[k], WK = weekly ? WEEKLIES.filter(function (x) { return x.boss === k && x.d === d; })[0] : null; if (weekly && !WK) return;
    var L = B.lv[d]; if (!L || !(weekly ? wkOpen(WK) : L.open(acc, Date.now()))) return;
    if (weekly && permits() < 1) { toast('挑战许可用完了。' + permitNext() + '。'); return; }
    if (weekly && !tp) { openTeamPrep('每周挑战 · ' + B.name, function (t) { startBossRemote(k, d, true, t); }); return; }   // 2026-10-27：先选助战和出战顺序
    pveRemote(weekly ? 'weekly' : 'boss', tpArgs({ k: k, d: d }, tp), { bg: BG[floraBg(B.bg)], back: weekly ? '每周挑战' : bossWhere(B) }, function (e, res) {
      var msg = [], first = false;
      if (e) {
        var r = e.rep;
        dailyHit('boss'); dailyHit('pve');
        if (r.res === 'win') {
          first = !!r.first;
          msg.push(weekly ? '每周挑战：击败了BOSS「' + B.name + '」！' : '击败了' + L.diff + '难度的BOSS「' + B.name + '」！');
          if (weekly) { msg.push('每周挑战奖励：累积经验 +' + fmt(r.wk.exp) + '、' + rwList({ items: r.wk.fix }).join('、') + '；掉落了「' + dropName(r.wk.drop) + '」！'); msg.push('消耗了 1 枚挑战许可。'); }
          else if (first) {
            msg = msg.concat(firstMsg(r.fr));
            if (B.lv[d + 1] && levelOpen(k, d + 1)) msg.push(B.lv[d + 1].diff + '难度已开放。');
            if (WEEKLIES.some(function (x) { return x.boss === k && x.d === d; })) msg.push('「' + B.name + '」' + L.diff + '难度的每周挑战已开放：在星际探索的星球列表上方进入，每次获胜消耗 1 枚挑战许可。');
            if (r.weeklyNew) msg.push('「每周挑战」已开放：在星际探索的星球列表上方进入，每次获胜消耗 1 枚挑战许可（已送你 1 枚）。');
          }
        }
        msg = msg.concat(xpMsg(r.xp));
        save();
      } else if (res === 'void') msg.push('这场对战作废了，战绩和挑战许可都没有变化。');
      bossBack(weekly ? 'weekly' : 'boss', function () { ex.boss = k; ex.bossK = k; ex.bossD = first && !weekly && levelOpen(k, d + 1) ? d + 1 : d; });
      if (first && !weekly && k === 'tiger' && d === 0 && page === 'explore' && unlocked('tiger2') && !prog('tiger2').done) {
        msg.push('泰戈尔好像有话要说……');
        startVN('tiger2', 'replay', $('pg-explore'), true);
      }
      if (msg.length) toast(msg.join(''));
    });
  }
  function startBoss(k, d, weekly) {
    if (srvMode()) return startBossRemote(k, d, weekly);
    var B = BOSSES[k], WK = weekly ? WEEKLIES.filter(function (x) { return x.boss === k && x.d === d; })[0] : null; if (weekly && !WK) return;
    var L = B.lv[d]; if (!L || !(weekly ? wkOpen(WK) : L.open(acc, Date.now()))) return;
    if (weekly && permits() < 1) { toast('挑战许可用完了。' + permitNext() + '。'); return; }   // 2026-10-18：只有打赢才消耗挑战许可
    seedSeenFx();
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var p = team.map(storyMon);
    var bossFx = L.boss ? JSON.parse(JSON.stringify(L.boss)) : null;
    if (bossFx && bossFx.past && acc.seenFx && acc.seenFx.past) bossFx.pastKnown = 1;   // 「东北的往事」第一次发动之前不显示
    if (bossFx && bossFx.rebirth && acc.seenFx && acc.seenFx.rebirth) bossFx.rebirthKnown = 1;   // 「枯萎中蜕生」第一次发动之前不显示
    var a = L.team ? L.team.map(function (T) {   // 多只BOSS（奥多亚克困难）：形态切换技能不放进技能表
      return { id: B.sid, lv: L.lv, moves: T.moves || defaultMoves(B.sid, L.lv).filter(function (n) { return n !== '歼灭形态' && n !== '护阵形态'; }), nick: T.nick, img: SPRITES[B.sid], maxhp: T.maxhp, odoForm: T.odoForm, boss: JSON.parse(JSON.stringify(T.boss)) };
    }) : [{ id: B.sid, lv: L.lv, moves: defaultMoves(B.sid, L.lv), nick: B.name, img: SPRITES[B.sid], maxhp: L.hp, onlyHit: L.only, boss: bossFx }];
    seeMon(B.sid, L.lv);
    var rec = bossRec(k, weekly ? wkKey(WK) : d); rec.tries++; save();
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: p, a: a, foe: 'BOSS', diff: weekly ? '每周挑战' : L.diff + '难度', bgm: L.bgm, bgmAt: L.bgmAt, items: invCopy(), onItem: useInv, bg: BG[floraBg(B.bg)], back: weekly ? '每周挑战' : bossWhere(B),
      onEnd: function (res, seen, downs) {
        var msg = [], first = false, wasWeekly = weeklyOpen();
        dailyHit('boss'); dailyHit('pve');
        if (res === 'win') {
          first = !rec.wins; rec.wins++;
          msg.push(weekly ? '每周挑战：击败了BOSS「' + B.name + '」！' : '击败了' + L.diff + '难度的BOSS「' + B.name + '」！');
          if (weekly) { permits(); acc.permit.n = Math.max(0, acc.permit.n - 1); msg = msg.concat(weeklyReward(WK)); msg.push('消耗了 1 枚挑战许可。'); }
          else if (first) {
            msg = msg.concat(firstReward(L, k + ':' + d));
            if (B.lv[d + 1] && levelOpen(k, d + 1)) msg.push(B.lv[d + 1].diff + '难度已开放。');
            if (WEEKLIES.some(function (x) { return x.boss === k && x.d === d; })) msg.push('「' + B.name + '」' + L.diff + '难度的每周挑战已开放：在星际探索的星球列表上方进入，每次获胜消耗 1 枚挑战许可。');
            if (!wasWeekly && weeklyOpen()) msg.push('「每周挑战」已开放：在星际探索的星球列表上方进入，每次获胜消耗 1 枚挑战许可（已送你 1 枚）。');
          }
        }
        msg = msg.concat(battleRewards(team, seen, downs));
        if (weeklyOpen()) permits();
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = weekly ? 'weekly' : 'boss'; ex.boss = k; ex.bossK = k; ex.bossD = first && !weekly && levelOpen(k, d + 1) ? d + 1 : d;   // 第一次打赢后自动切到下一档
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
        // 第一次打赢简单难度的泰戈尔：它有话要说（小剧情，介绍普通难度）
        if (first && !weekly && k === 'tiger' && d === 0 && page === 'explore' && unlocked('tiger2') && !prog('tiger2').done) {
          msg.push('泰戈尔好像有话要说……');
          startVN('tiger2', 'replay', $('pg-explore'), true);
        }
        if (msg.length) toast(msg.join(''));
      } });
  }

  function weeklyCardsHTML() {
    var pn = permits(), html = '';
        // 2026-11-01：每个BOSS的三档难度合成一张卡（和属性挑战一样），进去再切难度
        var seen = {};
        WEEKLIES.forEach(function (W) {
          if (seen[W.boss]) return; seen[W.boss] = 1;
          var all = WEEKLIES.map(function (x, i) { return [x, i]; }).filter(function (p) { return p[0].boss === W.boss; }), op = all.filter(function (p) { return wkOpen(p[0]); });
          if (!op.length) return; var WB = BOSSES[W.boss], pick = op[op.length - 1];
          html += '<button type="button" class="weekly-card" data-weekly="' + (pick[1] + 1) + '"><span class="tape l"></span><img src="' + SPRITES[WB.sid] + '" alt=""><span class="wk-txt"><span class="chip boss-diff d1">BOSS · 每周挑战</span><b>' + WB.name + '</b>' +
            '<small>' + all.map(function (p) { return WB.lv[p[0].d].diff + (wkOpen(p[0]) ? '' : '🔒'); }).join(' / ') + ' · 获胜消耗 1 枚挑战许可 · 掉落' + rwList({ items: pick[0].item }).join('、').replace(/ ×\d+/, '') + '等</small></span><span class="wk-pm"><b>' + pn + '</b> / ' + PERMIT.max + '<small>挑战许可（共用）</small></span></button>';
        });
    return html + ewkCardHTML(pn);
  }
  function renderWkHub() {
    $('pg-explore').innerHTML = exHead('所有每周挑战都在这里，挑战许可共用：每 12 小时恢复 1 枚，最多 ' + PERMIT.max + ' 枚。获胜才消耗，输了不消耗。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="wkhub-back">‹ 返回飞船终端</button><b>每周挑战</b></div>' +
      '<p class="hint permit-line">挑战许可 <b>' + permits() + '</b> / ' + PERMIT.max + ' · ' + permitNext() + '</p><div class="boss-row">' + weeklyCardsHTML() + '</div>';
  }
  function renderEwk() {
    var T = ewkType(ex.ewkT), sid = ewkSid(T.t), S = SPMAP[sid], d = ex.ewkD | 0, L = EWK.lv[d], pn = permits(), DR = PVE.ewkDrop(T, L), nm0 = ewkName(T, sid), lb = ewkLabel(T);
    var rec = (acc.bosses && acc.bosses[recKey('ewk_' + T.t, d)]) || {};
    var tabs = '<div class="fparts boss-tabs" role="tablist">' + EWK.lv.map(function (x, i) { return '<button type="button" role="tab" class="tab' + (i === d ? ' on' : '') + '" aria-selected="' + (i === d) + '" data-ewkd="' + i + '">' + x.diff + (bossWon('ewk_' + T.t, i) ? ' ✓' : '') + '</button>'; }).join('') + '</div>';
    var rules = fxRules(L).map(function (r) { return '<li><b>特殊</b>' + esc(r[0]) + '：' + esc(r[1]) + '</li>'; }).join('');
    var bg = ewkBg(sid);
    $('pg-explore').innerHTML = exHead(T.team ? '地球挑战：从地球一起出发的三只伙伴——' + nm0 + '——会按顺序轮流上场，全部击败才算获胜。掉落的地球元素比属性挑战更多。三档难度都能直接挑战，获胜消耗 1 枚挑战许可，输了不消耗。' : T.t + '系每周挑战：BOSS 每周一 0 点从' + T.t + '系野生精灵里随机换一只。三档难度都能直接挑战，获胜消耗 1 枚挑战许可，输了不消耗。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ewk-back">‹ 返回每周挑战</button><b>每周挑战 · ' + (T.team ? '地球挑战' : T.t + '系 · ' + esc(S.name)) + '</b></div>' + tabs +
      '<article class="boss-card"><span class="tape l"></span><div class="boss-art">' + (bg ? '<img src="' + bg + '" alt="" class="boss-bg">' : '') + (T.team ? '<span class="ewk-trio">' + T.team.map(function (x) { return '<img src="' + SPRITES[x] + '" alt="' + esc(SPMAP[x].name) + '">'; }).join('') + '</span>' : '<img src="' + SPRITES[sid] + '" alt="' + esc(S.name) + '" class="boss-mon">') + '</div>' +
      '<div class="boss-txt"><span class="chip boss-diff d' + d + '">' + lb + ' · ' + L.diff + '难度</span><h3>' + esc(nm0) + '</h3><p class="hint">' + (T.team ? '三只轮流上场，打倒一只换下一只。' : '本周的' + T.t + '系BOSS，还剩 ' + ewkLeft() + ' 换下一只。') + '</p>' +
      '<ul class="boss-rules"><li><b>等级</b>LV' + L.lv + '</li><li><b>体力</b>' + (T.team ? '每只 ' + fmt(Math.round(L.hp * T.hpMul)) + '（共 ' + T.team.length + ' 只）' : fmt(L.hp)) + '</li>' + rules +
      '<li><b>奖励</b>每次击败获得' + itemName(T.item) + ' ×' + DR[0] + '–' + DR[1] + '、累积经验 ×' + fmt(L.exp) + '，另有经验和学习力</li><li><b>战绩</b>' + (rec.wins || 0) + ' 胜 / ' + (rec.tries || 0) + ' 次挑战</li></ul>' +
      '<p class="hint">' + (srvMode() ? '开打前可以选择好友的助战精灵和出战顺序（精灵来自' + tName(acc.active) + '）。' : '会使用你当前的出战配队（' + tName(acc.active) + '）。') + '对战中可以使用补药。</p>' +
      '<button type="button" class="btn primary" data-ewkgo="1"' + (pn > 0 ? '' : ' disabled') + '>开始挑战（获胜时消耗 1 枚挑战许可）</button><p class="hint permit-line">挑战许可 <b>' + pn + '</b> / ' + PERMIT.max + ' · ' + permitNext() + '</p></div></article>';
  }
  function startEwkRemote(t, d, tp) {
    var T = ewkType(t), sid = T && ewkSid(t), L = EWK.lv[d]; if (!sid || !L || !weeklyOpen()) return;
    if (permits() < 1) { toast('挑战许可用完了。' + permitNext() + '。'); return; }
    if (!tp) { openTeamPrep('每周挑战 · ' + (T.team ? '地球挑战' : t + '系 · ' + SPMAP[sid].name), function (x) { startEwkRemote(t, d, x); }); return; }   // 2026-10-27：先选助战和出战顺序
    pveRemote('ewk', tpArgs({ t: t, d: d }, tp), { bg: ewkBg(sid), back: '每周挑战' }, function (e, res) {
      var msg = [];
      if (e) {
        var r = e.rep, S = SPMAP[r.sid];
        dailyHit('boss'); dailyHit('pve');
        if (r.res === 'win') msg.push(ewkLabel(T) + '：击败了' + L.diff + '难度的「' + ewkName(T, r.sid) + '」！获得' + itemName(r.drop.item) + ' ×' + r.drop.n + '、累积经验 +' + fmt(r.drop.exp) + '。消耗了 1 枚挑战许可。');
        msg = msg.concat(xpMsg(r.xp));
        save();
      } else if (res === 'void') msg.push('这场对战作废了，战绩和挑战许可都没有变化。');
      bossBack('ewk', function () { ex.ewkT = t; ex.ewkD = d; });
      if (msg.length) toast(msg.join(''));
    });
  }
  function startEwk(t, d) {
    if (srvMode()) return startEwkRemote(t, d);
    var T = ewkType(t), sid = T && ewkSid(t), L = EWK.lv[d]; if (!sid || !L || !weeklyOpen()) return;
    if (permits() < 1) { toast('挑战许可用完了。' + permitNext() + '。'); return; }
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var a = PVE.ewkFoes(T, L, Date.now());
    a.forEach(function (f) { seeMon(f.id, L.lv); });
    var rec = bossRec('ewk_' + t, d); rec.tries++; save();
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: team.map(storyMon), a: a, foe: 'BOSS', diff: ewkLabel(T) + ' · ' + L.diff, bgm: L.bgm, ordered: !!T.team, items: invCopy(), onItem: useInv, bg: ewkBg(sid), back: '每周挑战',
      onEnd: function (res, seen, downs) {
        var msg = [];
        dailyHit('boss'); dailyHit('pve');
        if (res === 'win') {
          rec.wins++; permits(); acc.permit.n = Math.max(0, acc.permit.n - 1);
          var DR = PVE.ewkDrop(T, L), n = DR[0] + Math.floor(Math.random() * (DR[1] - DR[0] + 1)), it = {}; it[T.item] = n;
          earn('ewk', '', { items: it, exp: L.exp });
          msg.push(ewkLabel(T) + '：击败了' + L.diff + '难度的「' + ewkName(T, sid) + '」！获得' + itemName(T.item) + ' ×' + n + '、累积经验 +' + fmt(L.exp) + '。消耗了 1 枚挑战许可。');
        }
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'ewk'; ex.ewkT = t; ex.ewkD = d;
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
        if (msg.length) toast(msg.join(''));
      } });
  }
  /* ---------- 剧情回顾（2026-10-20）：星际探索第一排的入口，集中重温剧情 ----------
   * 主线（按章节，可以一口气连播）、支线（含世界任务）、画廊（所有 CG）、音乐鉴赏（只列出听过的曲子）、角色立绘（只显示见过的角色，资料按剧情进度揭示） */
  var ARC_TABS = [['main', '主线任务'], ['side', '支线任务'], ['world', '世界任务'], ['event', '活动任务'], ['cg', '画廊'], ['music', '音乐鉴赏'], ['chars', '角色立绘']];
  // 2026-11-03：曲名统一从 audio.js 的 NAMES 取（HSTRACK），这里只写在哪里播放
  var MUSIC = [
    ['ui', '主界面'], ['uiOld', '主界面（旧版）'], ['base', '基地'], ['summon', '荆楚号 · 召唤'], ['arena', '竞技对战'], ['earth', '地球的剧情'],
    ['faceEnemy', '剧情对战开场'], ['normal', '野外与剧情对战'], ['stage', '星球挑战'], ['pvp', '竞技对战与切磋'],
    ['boss', '简单难度BOSS战'], ['boss2', '普通难度BOSS战'], ['boss3', '困难难度BOSS战与每周挑战'], ['tigerFinal', '？'],
    ['flora', '芙罗拉星'], ['floraGrass', '芙罗拉星 · 草甸'], ['floraForest', '芙罗拉星 · 丛林'], ['floraFallen', '瘴气化之后的芙罗拉星'], ['floraLab', '盐碱地 · 地下实验室'],
    ['grassTalk', '剧情'], ['memory', '剧情'], ['saver', '剧情'], ['disCommunication', '瘴气化之后的野外对战'], ['beforeEnd', '？'],
    ['spa', '温泉疗养'], ['kb', '坎伯兰星'], ['kbSurface', '坎伯兰星 · 水面'], ['kbShallow', '坎伯兰星 · 浅海'], ['kbDeep', '坎伯兰星 · 深海'], ['kbDeep2', '坎伯兰星保卫战'], ['kbDeep3', '星云显现之后的坎伯兰星'],
    ['temple', '坎伯兰星 · 古代神殿'], ['vitalVoyage', '？'], ['finalStar', '剧情'], ['decision', '剧情'], ['ngc2237', '玫瑰星云'],
    ['pompeii', '庞贝星'], ['pompeiiField', '庞贝星 · 熔岩原'], ['pompeiiCity', '庞贝星 · 饮火城'], ['warriorsCity', '庞贝星 · 标题画面'], ['mingTheme', '明明教官的试炼 · 无尽作战'], ['mingBattle1', '明明教官的试炼 · 关卡'], ['mingBattle2', '明明教官的试炼 · 高难 / 最终试炼'], ['mingFinal1', '明明教官的试炼 · 通常 · 第三只精灵'], ['mingFinal2', '明明教官的试炼 · 高难 / 最终试炼 · 第三只精灵']
  ].map(function (m) { return [m[0], window.HSTRACK ? HSTRACK(m[0]) : m[0], m[1]]; });
  var MUSIC_ALIAS = { disComScene: 'disCommunication', faceEnemyScene: 'faceEnemy' };
  window.HSHEARD = function (k) {
    if (!acc || !k || k === 'silence') return; k = MUSIC_ALIAS[k] || k;
    if (!acc.heard) acc.heard = {}; if (acc.heard[k]) return; acc.heard[k] = Date.now(); save();
  };
  function heard(k) {
    if (k === 'ui' || (acc.heard && acc.heard[k])) return true;
    // 这个功能上线之前就听过的：剧本里写了这首曲子、而且已经读完的剧情也算
    for (var id in SCRIPT) if (prog(id).done && SCRIPT[id].some(function (st) { return st.bgm && (MUSIC_ALIAS[st.bgm] || st.bgm) === k; })) return true;
    return false;
  }
  // 角色：k 是剧本里的说话人；facts = [[读完哪段剧情后揭示, 文字]]
  var ARC_CHARS = [
    { k: 'p', facts: [['', '省实验中学的学生，月考全年级第一，被选入了星际探索计划。']] },
    { k: 'v', facts: [['school', '你的朋友，月考全年级第二，和你一起被选入星际探索计划。挑选伙伴精灵时，她选了克制你的那一只。'], ['flora2', '随身带着 Dr.黄 交给小队的精灵翻译器。'], ['flora3', '为了接住空投下来的烟雾保护头盔，用头去接，被砸晕了（头盔完好无损）。'], ['spa', '发现荆楚号的咸宁居然藏着一片温泉疗养区。']] },
    { k: 'z', facts: [['school', '班主任兼物理老师，带你们参加星际探索计划。口头禅是「李比鱼」（你比如）和「摸擦力」（摩擦力），叮嘱里总要讲两句物理。'], ['board', '一路把你们送到酒泉，在发射塔前道别，留在了地球。']] },
    { k: 't', facts: [['jiuquan', '为了寻找点点，独自从格拉斯哥偷渡到了酒泉卫星发射中心。给了你 1000 能量当封口费。'], ['board', '藏在物资箱里混上了火箭，入轨后才钻出来。'], ['plant', '在地球上最爱种菜，阳台和楼顶都种满了，小区里的叔叔阿姨叫她「叶伯伯」。'], ['flora4', '追着点点的气味独自闯进丛林，被瘴气玛西抓走，关在叶之村落，后来被救了出来。'], ['flora6', '一时冲动踏上了盐碱地。']] },
    { k: 'y', facts: [['jiuquan', 'Threego 一直在找的人，会叫她「姐姐」。半年前登上飞船之后，就和大家失去了联系。'], ['flora5', '说过自己「不会死，会活着等姐姐找到他」。']] },
    { k: 'b', facts: [['board', '省实验的学生，比你们早一批登上荆楚号，在鄂州港迎接新船员。自称「神」，说到得意处眼镜会发光。'], ['academy', '在学院部管着记录所有精灵的「黄冈秘鉴」。'], ['flora3', '派无人机给地面小队空投了烟雾保护头盔。'], ['flora5', '交给 Vanber 一颗炸弹，结果「困了睡觉就忘了」说。']] },
    { k: 'h', facts: [['xiaogan', '省实验的学生，常驻孝感大厅，介绍模拟对战系统。'], ['flora2', '把精灵翻译器交给了地面小队，只说「以前在别的地方用过差不多的」。'], ['brawl', '说自己以前在很远很远的地方玩过差不多的东西，打了很久很久……被追问时慌忙岔开了话题。']] },
    { k: 'ai', facts: [['board', '荆楚号的舰内系统语音。']] },
    { k: 'mm', facts: [['mingming', '古城防卫部的教官，给队员们配备机械精灵董之盾。'], ['fl_chal2', '按防卫部「出任务可以向队友借精灵」的老规矩，把自己的 LV30 赫菲斯借给你助战。']] },
    { k: 'tg', facts: [['tiger', '从东北招募的特殊虎系精灵，常驻古城防卫部，辅助船员们训练。'], ['tiger2', '在东北受过语言训练，一开口就是东北话。']] },
    { k: 'kr', facts: [['flora2', '芙罗拉星草甸上的原住民。被瘴气污染时袭击过小队，瘴气散去后带你们逃到了草甸。戴上翻译器就能听懂它说话。'], ['flora5', '说盐碱地几千年来一直静静地在那里，一次小地震之后才开始冒瘴气。']] },
    { k: 'kl', facts: [['flora3', '在丛林里专门猎杀瘴气精灵的「猎杀者」，不回应翻译器。'], ['flora5', '原本是住在林子最深处的森林守护者。'], ['flora6', '猎杀瘴气精灵的卡莱，是被辰爷用瘴气驯化的。']] },
    { k: 'ms', facts: [['flora4', '丛林里被瘴气玛西围攻的小玛西，戴着翻译器能听懂它说话。']] },
    { k: 'lc', facts: [['travelcat', '芙罗拉星上很少见的叶子喵一族。族里要求隐居，她却向往远方，在星球之间旅行。'], ['flora4', '每回来一次，就发现家里的瘴气浓了一点。一族的村子叫「叶之村落」。'], ['flora6', '叶子喵一族生来带着一点净化的光；她在外面走了很远、打了很多场，光已经强到能把瘴气挡在外面。']] },
    { k: 'cy', facts: [['flora5', '代号「常春藤怀克」，常春藤组织的特工。戴眼镜，高雅而高傲，自称「一鸟大人派我来驱赶这颗星球上的一切生灵」。'], ['flora6', '用瘴气驯化了一大批卡莱。']] },
    { k: 'r', facts: [['core', '荆楚号 · 宜昌三峡能源核心的主人。']] }
  ];
  function arcSeen(k) {
    if (k === 'p') return true;
    for (var id in SCRIPT) if (prog(id).done && SCRIPT[id].some(function (st) { return st.s === k; })) return true;
    return false;
  }
  function arcFirst(k) { for (var id in SITES) if (SCRIPT[id] && SCRIPT[id].some(function (st) { return st.s === k; })) return id; return null; }
  function arcImgs(k) {   // [默认, 差分...]；精灵角色用精灵立绘
    var C = CAST[k]; if (!C) return [];
    var base = k === 'p' ? playerArt() : C.img;
    if (base) return [CHARS[base]].concat(Object.keys(CHARS).filter(function (x) { return x.indexOf(base + '_') === 0; }).map(function (x) { return CHARS[x]; })).filter(Boolean);
    if (C.spr) return [form({ sid: C.spr, lv: C.sprLv || 1 }).img];
    return [];
  }
  function arcRow(id, kind) {
    var S = SITES[id], pr = prog(id), done = pr.done, open = unlocked(id);
    if (!done && !open) return '<li class="arc-it locked"><span class="arc-no">？</span><div><b>？？？</b><small>' + (kind === 'side' ? '尚未开放' : '继续推进剧情后解锁') + '</small></div></li>';
    var P = planetOf(S.planet);
    return '<li class="arc-it' + (done ? '' : ' unread') + '"><img src="' + BG[S.bg] + '" alt="" class="arc-th"><div><span class="sc-tag">' + esc(S.chapter) + '</span><b>' + esc(S.name) + '</b><small>' + esc(P ? P.name : '') + (done ? '' : ' · 还没读') + '</small>' + (done ? '<p class="hint">' + esc(S.d) + '</p>' : '') + '</div>' +
      (done ? '<button type="button" class="btn" data-arcplay="' + id + '">重温</button>' : '<button type="button" class="btn ghost" data-arcgo="' + id + '">去阅读</button>') + '</li>';
  }
  function arcMain() {
    var used = {}, h = '';
    var doneAll = Object.keys(SITES).filter(function (id) { return !SITES[id].side && prog(id).done; });
    h += '<div class="arc-bar2"><p class="hint">已读完主线 ' + doneAll.length + ' 段。重温不会再发奖励。</p>' + (doneAll.length ? '<button type="button" class="btn primary" data-arcall="1">▶ 从头连播主线</button>' : '') + '</div>';
    CHAPTERS.forEach(function (C) {
      C.sites.forEach(function (id) { used[id] = 1; });
      var rows = C.sites.filter(function (id) { return SITES[id]; }).map(function (id) { return arcRow(id, 'main'); });
      var shown = [], hid = false; rows.forEach(function (r) { if (r.indexOf('arc-it locked') >= 0) { if (!hid) shown.push(r); hid = true; } else shown.push(r); });
      if (!C.sites.some(function (id) { return prog(id).done || unlocked(id); })) return;
      h += '<section class="arc-sec"><h3>' + esc(C.n) + (C.wip ? ' <small>（未完待续）</small>' : '') + '</h3><p class="hint">' + esc(C.d) + '</p><ol class="arc-list">' + shown.join('') + '</ol></section>';
    });
    var rest = Object.keys(SITES).filter(function (id) { return !SITES[id].side && !used[id] && (prog(id).done || unlocked(id)); });
    if (rest.length) h += '<section class="arc-sec"><h3>其他</h3><ol class="arc-list">' + rest.map(function (id) { return arcRow(id, 'main'); }).join('') + '</ol></section>';
    return h;
  }
  function arcSide(kind) {   // 2026-10-24：支线 / 世界任务 / 活动任务分成三个并列的分页
    var ids = Object.keys(SITES).filter(function (id) {
      var S = SITES[id]; if (!S.side) return false;
      var k = S.event ? 'event' : S.chapter.indexOf('世界任务') === 0 ? 'world' : 'side';
      return k === kind;
    });
    var vis = ids.filter(function (id) { return prog(id).done || unlocked(id); });
    var n = ids.filter(function (id) { return prog(id).done; }).length, nm = kind === 'event' ? '活动任务' : kind === 'world' ? '世界任务' : '支线';
    return '<p class="hint">已读完 ' + n + ' / ' + ids.length + ' 段' + nm + '。还没开放的不会显示。</p>' +
      '<section class="arc-sec"><ol class="arc-list">' + (vis.map(function (id) { return arcRow(id, 'side'); }).join('') || '<li class="hint">还没有开放的' + nm + '。</li>') + '</ol></section>';
  }
  function arcMusic() {
    var n = MUSIC.filter(function (m) { return heard(m[0]); }).length;
    return '<p class="hint">听过的曲子会出现在这里（' + n + ' / ' + MUSIC.length + '）。试听时背景音乐会暂停。</p><ol class="arc-music">' + MUSIC.map(function (m, i) {
      var ok = heard(m[0]), on = ex.arcPlay === m[0];
      return ok ? '<li class="' + (on ? 'on' : '') + '"><span class="arc-no">' + (i + 1) + '</span><div><b>' + esc(m[1]) + '</b><small>' + esc(m[2]) + '</small></div><button type="button" class="btn' + (on ? ' primary' : '') + '" data-arcmus="' + m[0] + '">' + (on ? '■ 停止' : '▶ 试听') + '</button></li>'
        : '<li class="locked"><span class="arc-no">' + (i + 1) + '</span><div><b>？？？</b><small>还没听过</small></div></li>';
    }).join('') + '</ol>';
  }
  function arcChars() {
    var L = ARC_CHARS.filter(function (c) { return CAST[c.k] && arcSeen(c.k); });
    var met = acc.cumberDay != null;
    var cards = L.map(function (c) {
      var C = CAST[c.k], imgs = arcImgs(c.k), f1 = (c.facts[0] && c.facts[0][0]) || arcFirst(c.k), known = c.facts.filter(function (f) { return !f[0] || prog(f[0]).done; }), more = known.length < c.facts.length;
      var sel = (ex.arcFace && ex.arcFace[c.k]) | 0; if (sel >= imgs.length) sel = 0;
      return '<article class="arc-ch"><span class="tape r"></span><div class="arc-face' + (C.img || c.k === 'p' ? '' : ' arc-mon') + '">' + (imgs.length ? '<img src="' + imgs[sel] + '" alt="' + esc(C.name()) + '">' : '<span class="arc-ini" style="background:' + C.color + '">' + esc(C.name().slice(0, 1)) + '</span>') + '</div>' +
        '<div class="arc-cht"><h3 style="color:' + C.color + '">' + esc(C.name()) + '</h3>' + (f1 && c.k !== 'p' ? '<small class="hint">首次登场：' + esc(SITES[f1].chapter) + '</small>' : '') +
        '<ul>' + known.map(function (f) { return '<li>' + esc(fill(f[1])) + '</li>'; }).join('') + (more ? '<li class="hint">？？？（继续推进剧情，会知道更多）</li>' : '') + '</ul>' +
        (imgs.length > 1 ? '<div class="arc-vars">' + imgs.map(function (u, i) { return '<button type="button" class="' + (i === sel ? 'on' : '') + '" data-arcface="' + c.k + '|' + i + '" aria-label="差分 ' + (i + 1) + '"><img src="' + u + '" alt=""></button>'; }).join('') + '</div>' : '') + '</div></article>';
    });
    if (met) cards.push('<article class="arc-ch"><span class="tape r"></span><div class="arc-face"><img src="' + CHARS.cumber + '" alt="？？？"></div><div class="arc-cht"><h3>？？？</h3><small class="hint">在坎伯兰星 · 深渊潜底遇到</small><ul><li>在深海里遇到的神秘女子，问你：「……你怎么在这里？」</li><li class="hint">？？？</li></ul></div></article>');
    return '<p class="hint">已经遇见 ' + cards.length + ' 位角色。资料会随着剧情推进逐渐揭示。</p><div class="arc-chars">' + cards.join('') + '</div>';
  }
  var arcAudio = null;
  function arcStop() { if (arcAudio) { arcAudio.pause(); arcAudio = null; } if (ex.arcPlay) { ex.arcPlay = null; if (window.HSAUDIO && HSAUDIO.hold) HSAUDIO.hold(false); } }
  function arcMus(k) {
    if (ex.arcPlay === k) { arcStop(); renderArchive(); return; }
    arcStop(); var src = window.HSAUDIO && HSAUDIO.src && HSAUDIO.src(k === 'ui' ? 'uiNew' : k); if (!src) return;
    if (HSAUDIO.hold) HSAUDIO.hold(true);
    arcAudio = new Audio(src); arcAudio.loop = true; arcAudio.volume = Math.max(0.05, HSAUDIO.vol ? HSAUDIO.vol() : 0.6); var pp = arcAudio.play(); if (pp) pp.catch(function () {});
    ex.arcPlay = k; renderArchive();
  }
  function renderArchive() {
    var tab = ex.arcTab || 'main';
    var body = tab === 'side' ? arcSide('side') : tab === 'world' ? arcSide('world') : tab === 'event' ? arcSide('event') : tab === 'cg' ? cgGallery(Object.keys(SITES)) : tab === 'music' ? arcMusic() : tab === 'chars' ? arcChars() : arcMain();
    $('pg-explore').innerHTML = exHead('在这里重温读过的剧情、看过的 CG、听过的音乐和遇见过的角色。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="arc-back">‹ 返回星际探索</button><b>剧情回顾</b></div>' +
      '<div class="fparts arc-tabs" role="tablist">' + ARC_TABS.map(function (t) { return '<button type="button" role="tab" class="tab' + (t[0] === tab ? ' on' : '') + '" aria-selected="' + (t[0] === tab) + '" data-arctab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="arc-body">' + body + '</div>';
  }
  function arcBarHTML() {
    var main = Object.keys(SITES).filter(function (id) { return !SITES[id].side; }), side = Object.keys(SITES).filter(function (id) { return SITES[id].side; });
    var nm = main.filter(function (id) { return prog(id).done; }).length, ns = side.filter(function (id) { return prog(id).done; }).length;
    return '<button type="button" class="arc-entry" data-archive="1"><span class="tape l"></span><span class="arc-e-ic" aria-hidden="true">📖</span><span class="arc-e-txt"><b>剧情回顾</b><small>主线 ' + nm + ' 段 · 支线 ' + ns + ' 段 · 画廊 · 音乐鉴赏 · 角色立绘</small></span><span class="wk-pm">›</span></button>';
  }
  /* ---------- Wiki（2026-10-24）：顶栏入口，按图鉴编号列出所有精灵的全部技能，
   * 标出隐藏技能用什么道具解锁、等级上限用什么道具提升，以及精灵的获得方式；可以按属性筛选 ---------- */
  // 2026-11-03：按游戏里实际的获得途径重新核对（野外出现的地点由 wikiGet 按 js/data/wild.js 自动补上）
  var SUM_RARE = '圣晶石召唤：抽到稀有精灵的精元（随机一种），在精灵保育仓孵化';
  var WIKI_GET = {
    leaf: '初始精灵（三选一）；芙罗拉星丛林、草甸的稀有野生精灵；' + SUM_RARE,
    squid: '初始精灵（三选一）；坎伯兰星水面、浅水区的稀有野生精灵；' + SUM_RARE,
    shroom: '初始精灵（三选一）；庞贝星熔岩原、饮火城的稀有野生精灵；' + SUM_RARE,
    kaleo: '芙罗拉星丛林的稀有野生精灵；' + SUM_RARE,
    leibniz: '莱汀陨石带 · 雷暴陨石群的稀有野生精灵「莱克」（3% 是异色）',
    turkey: '在庞贝星熔岩原的某个场景放下一碗米饭（冶炼坊用米饭合成）后，那个场景刷新精灵时偶尔会出现；' + SUM_RARE,
    siren: '在坎伯兰星水面的冥岛吹响奇声号角后出现；' + SUM_RARE,
    hauris: '每天 16:00–24:00 切换探索场景时偶尔出现的神秘精灵「幽灵鱼」（LV10，可以捕捉）；' + SUM_RARE,
    phantom: '圣晶石召唤：当期 UP 精灵叶粒魔种的精元（每抽 5%，第 50 抽必出），在精灵保育仓孵化',
    tagore: '首次击败简单难度的BOSS「泰戈尔」（荆楚号 · 襄阳 · 古城防卫部），获得 LV10 小胖虎',
    barren: '首次击败简单难度的BOSS「荒芜」（芙罗拉星 · 盐碱地），获得 LV10 枯叶灵',
    odo: '首次击败简单难度的BOSS「奥多亚克」（坎伯兰星 · 深海区），获得「奥多的精元」，在精灵保育仓孵化',
    leafcat: '击败旅行精灵叶子喵有机会掉落叶片，5 片在黄石 · 冶炼坊合成「叶子喵的精元」，在精灵保育仓孵化（叶子喵要完成世界任务「旅行猫」后才会出现）',
    pluto: '先驱之塔的代币商店：用先驱代币和死神代币兑换「帕努托尔的精元」，在精灵保育仓孵化',
    leiming: '活动「明明教官的试炼」：明明代币抽奖第 10、30、50、70……个奖池的「雷明灯的精元」，在精灵保育仓孵化（10% 是异色）',
    moon: '平衡排位首次达到铂金段位的奖励（LV10 小月亮）',
    bone: '平衡排位首次达到王者段位的奖励（LV10 凶骨）',
    aegis: '支线「明明教官的礼物」（荆楚号 · 襄阳 · 古城防卫部），获得 LV10 董之马',
    wild: '世界任务「冰封深处的小精灵？」（白之星，读完第一章后开放）送一只 LV15 亚哆；之后永冻冰原上偶尔会出现封着亚哆的冰块，出战配队同时带草、火、水系精灵就能化开冰块，和 LV20～25 的亚哆对战并捕捉（每小时一次）',
    firemouse: '庞贝星饮火城 · 炙热核心的野生精灵（只在这个场景出现）；炙热核心里那只瑟瑟发抖的火月鼠：出战配队带 3 只火系精灵去找它说话，它会跟你走（LV18，每个账号一次）',
    tiago: '第一届做题大王争霸赛：参赛奖励「神秘精灵兑换券」在储存箱里兑换（LV10）；参赛选手也可以用「S1争霸赛精灵分享券」送给好友（LV10）',
    dragon: '星际探索中暂时无法获得；竞技对战（平衡排位、模拟对战）里可以直接使用',
    inkarm: '星际探索中暂时无法获得；竞技对战（平衡排位、模拟对战）里可以直接使用'
  };
  function wikiNo(s) { var n = (s.evo || []).map(function (e) { return e.no; }).filter(Boolean); return n.length ? +n[0] : 9999; }   // 没有编号的排在最后
  function wikiGet(sid) {
    var where = [];
    WILD_REGIONS.forEach(function (R) {
      if (R.record) return;   // 瘴气污染的记录：驱逐战用的地图，不能捕捉
      var hit = (WILD[R.pool] || []).some(function (w) { return w.sid === sid && w.w > 0; }) || (R.bgs || []).some(function (bk) { return ((typeof WILD_SCENE !== 'undefined' && WILD_SCENE[bk]) || []).some(function (w) { return w.sid === sid && w.w > 0; }); });   // w = 0 的不会自然出现（米饭火鸡、亚哆）
      if (hit) { var P = planetOf(R.planet); where.push((P ? P.name + ' · ' : '') + R.name); }
    });
    var t = WIKI_GET[sid] || '';
    if (where.length && !/野生精灵/.test(t)) t = (t ? t + '；' : '') + '野外：' + where.join('、');
    return t || '暂未开放获得';
  }
  function wikiItem(k, tail) { var inf = itemInfo(k); return '<div class="wk-it"><b>' + esc(itemName(k)) + '</b>' + (tail ? '<span class="wk-tail">' + esc(tail) + '</span>' : '') + (inf && inf.get ? '<small>获得方式：' + esc(inf.get) + '</small>' : '') + '</div>'; }   // 2026-10-27：只写获得方式
  /* 2026-10-24：Wiki 改成和竞技对战「精灵图鉴」一样的样式：左边卡片网格（按图鉴编号），右边资料面板 */
  var WK = { sel: null, t: '', v: null };
  function wikiNoText(s) { var a = (s.evo || []).map(function (e) { return e.no; }).filter(Boolean); return a.length ? 'No.' + a[0] + (a.length > 1 ? '–' + a[a.length - 1] : '') : ''; }
  function wikiGrid(list) {
    return list.map(function (s) {
      var no = wikiNoText(s);
      return '<div class="cw"><button type="button" class="card' + (WK.sel === s.id ? ' sel' : '') + '" data-wks="' + s.id + '">' + (no ? '<span class="hgno">' + no + '</span>' : '') +
        '<img src="' + SPRITES[s.id] + '" alt=""><span class="nm">' + esc(s.name) + '</span><span class="meta">' + tchips(s.types) + '<span>种族值 ' + total(s) + '</span></span></button></div>';
    }).join('');
  }
  function wikiDetail(s) {
    if (!s) return '<p class="empty-note">点击左边的精灵，查看它的全部技能、特性、获得方式和培养道具。</p>';
    var v = WK.v != null && s.evo && s.evo[WK.v] ? WK.v : (s.evo ? evoLast(s) : 0), fin = !s.evo || isFin(s, v), ev = s.evo ? s.evo[v] : {};
    var odoF = s.id === 'odo' && fin ? (WK.of || '') : '';
    var vName = fin ? s.name : String(ev.n || s.name).replace('?', ''), vImg = odoImgAs(s.evo ? formImg(s, v) : SPRITES[s.id], odoF), vLore = ev.d || (fin ? s.lore || '' : '');
    var evo = '';
    if (s.evo && s.evo.length > 1) {
      evo = '<div class="evo"><div class="evo-head"><h4>进化链</h4><span class="hint">点击形态查看它的立绘和介绍</span></div><ol class="evo-row' + (s.evo.length === 2 ? ' n2' : '') + '">' + s.evo.map(function (e, i) {
        var n = isFin(s, i) ? s.name : String(formRawName(s, i) || s.name).replace('?', '');
        return (i ? '<li class="evo-arrow" aria-hidden="true"><span>LV' + e.lv + '</span></li>' : '') + '<li><button type="button" class="evo-card' + (isFin(s, i) ? ' final' : '') + (i === v ? ' cur' : '') + '" data-wkv="' + i + '"><span class="evo-img"><img src="' + formImg(s, i) + '" alt=""></span>' +
          '<span class="evo-name">' + esc(n) + '</span><span class="evo-lv">' + (e.no ? 'No.' + e.no + ' · ' : '') + stageLabel(s, i) + ' · ' + (i === 0 ? 'LV1 起' : 'LV' + e.lv + ' 进化') + '</span></button></li>';
      }).join('') + '</ol></div>';
    }
    var stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(function (k) { var b = s.base[k]; return '<span>' + BASE_NAME[k] + '</span><span>' + b + '</span><span class="bar"><i style="width:' + Math.min(100, b / 150 * 100) + '%"></i></span><span class="real">LV100：' + calcStat(b, k) + '</span>'; }).join('') + '<span class="sum">种族值总和 ' + total(s) + '</span>';
    var mv = function (n, i, hid) {
      var m = M[odoMoveAs(n, odoF)] || M[n]; if (!m) return ''; var shown = m.name || n;
      var how = hid ? (HL_GATED[s.id] ? '道具解锁' : 'LV50' + (LEARN[n] ? ' · ' + LEARN[n] : '')) : 'LV' + (i ? i * 5 : 1);
      return '<div class="mrow wk-mrow' + (hid ? ' hid' : '') + '"><span class="wk-lv">' + esc(how) + '</span><span class="l1"><span class="mn">' + esc(shown) + '</span>' + tchips([m.type]) + '<span class="mm">' + m.cat + (m.power ? ' · 威力' + m.power : '') + (m.pri ? ' · 先制+' + m.pri : '') + ' · PP' + m.pp + '</span>' + (hid ? '<span class="tag">隐藏</span>' : '') + '</span><span class="md">' + esc(m.d || '') + '</span></div>';
    };
    var jade = Object.keys(USE_ITEMS).filter(function (k) { return USE_ITEMS[k].kind === 'jade' && (USE_ITEMS[k].sids || []).indexOf(s.id) >= 0; });
    var cap = capGem({ sid: s.id });
    return '<span class="tape r"></span>' +
      '<div class="d-head"><div class="d-art wk-zoomable" data-wkzoom="1" title="点击查看大图"><img src="' + vImg + '" alt="' + esc(vName) + '"></div><div><h3>' + (ev.no ? '<span class="dexno">No.' + ev.no + '</span>' : '') + esc(vName) + '</h3>' + tchips(s.types) +
      (s.evo && !fin ? '<p class="formnote">' + stageLabel(s, v) + '形态 · 下方的能力、特性和技能按最终形态「' + esc(s.name) + '」显示</p>' : '') + (vLore ? '<p class="lore">' + esc(vLore) + '</p>' : '') + '</div></div>' +
      '<div class="wk-get2"><b>获得方式</b><span>' + esc(wikiGet(s.id)) + '</span></div>' + evo +
      '<div class="stats">' + stats + '</div>' +
      (s.ability ? '<div class="trait"><p><b>特性 · ' + esc(s.ability.n) + '</b>　<span class="blue">' + esc(s.ability.d || '') + '</span></p></div>' : '') +
      '<div><div class="moves-head"><h4>全部技能</h4><span class="hint">普通技能按等级习得；带「隐藏」的要另外领悟</span></div>' + (s.id === 'odo' && fin ? odoTabs(odoF, 'data-wkof') : '') + '<div class="mlist">' +
      (s.moves || []).map(function (n, i) { return mv(n, i, false); }).join('') + (s.hidden || []).map(function (n) { return mv(n, 0, true); }).join('') + '</div></div>' +
      '<div class="wk-items2"><h4>培养道具</h4><p class="wk-lab">隐藏技能解锁</p>' + (jade.length ? jade.map(function (k) { return wikiItem(k, USE_ITEMS[k].cost + ' 个领悟一个'); }).join('') : '<p class="hint">' + (HL_GATED[s.id] ? '暂无' : '不需要道具，LV50 习得') + '</p>') +
      '<p class="wk-lab">等级上限提升</p>' + (cap ? wikiItem(cap, CAP_STEPS.map(function (c0) { return 'LV' + c0.lv + ' 需 ' + c0.jade + ' 个'; }).join('，')) : '<p class="hint">暂无（上限 LV' + BASE_CAP + '）</p>') + '</div>';
  }
  // Wiki · 异常状态（2026-11-02）：说明取自对战引擎的 ST_DESC，相关技能只列精灵能学会的
  var WK_ST_GROUP = [['控制类', '中了之后不能行动', ['害怕', '麻痹', '冰冻', '睡眠', '石化', '疲惫']], ['持续伤害类', '每回合结束时损失体力', ['烧伤', '冻伤', '中毒', '寄生', '溺水', '流血']], ['干扰类', '能行动，但会出岔子', ['失明', '混乱']]];
  function wikiStatus() {
    var learn = {}; SP.concat(EXTRA_SP).forEach(function (s) { if (!s || !s.id || s.placeholder) return; (s.moves || []).concat(s.hidden || []).forEach(function (n) { (learn[n] = learn[n] || []).indexOf(s.name) < 0 && learn[n].push(s.name); }); });
    var rel = function (k) { return Object.keys(learn).filter(function (n) { var m = M[n]; return m && ((m.status && m.status.k === k) || (m.d && m.d.indexOf(k) >= 0)); }); };
    var seen = {}, html = '<p class="hint">异常状态都有持续回合数，到期自动解除。同属性的精灵会免疫对应的状态（见各条说明）。点上方「精灵资料」可以查看会这些技能的精灵。</p>';
    var card = function (k) { seen[k] = 1; var r = rel(k); return '<div class="wk-stc"><b>' + esc(k) + '</b><p>' + esc(ST_DESC[k]) + '</p>' + (r.length ? '<small>相关技能：' + r.map(function (n) { return '<span title="' + esc(learn[n].join('、')) + '">' + esc(n) + '</span>'; }).join('') + '</small>' : '') + '</div>'; };
    WK_ST_GROUP.forEach(function (g) { var ks = g[2].filter(function (k) { return ST_DESC[k]; }); if (ks.length) html += '<h4 class="wk-sth">' + g[0] + '<span class="hint">' + g[1] + '</span></h4><div class="wk-stg">' + ks.map(card).join('') + '</div>'; });
    var rest = Object.keys(ST_DESC).filter(function (k) { return !seen[k]; });
    if (rest.length) html += '<h4 class="wk-sth">其他</h4><div class="wk-stg">' + rest.map(card).join('') + '</div>';
    return html;
  }
  function openWiki() {
    var old = $('wiki-dlg'); if (old) old.remove();
    var list = SP.concat(EXTRA_SP).filter(function (s) { return s && s.id && s.id !== 'dummy' && !s.placeholder && SPRITES[s.id]; }).sort(function (a, b) { var x = wikiNo(a), y = wikiNo(b); return (x === 9999) - (y === 9999) || y - x; });
    var types = []; list.forEach(function (s) { s.types.forEach(function (t) { if (types.indexOf(t) < 0) types.push(t); }); });
    if (!WK.sel || !SPMAP[WK.sel]) WK.sel = list[0] && list[0].id;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'wiki-dlg';
    d.innerHTML = '<div class="soc-box wiki-box" role="dialog" aria-modal="true" aria-label="Wiki"><span class="tape l"></span><span class="tape r"></span><div class="wk-top"><h2>Wiki</h2><div class="wk-parts" role="tablist"></div><button type="button" class="btn ghost" data-wkx="1">关闭</button></div>' +
      '<div class="wk-st" hidden></div><div class="wk-filter"></div><div class="build wk-build"><div><p class="hint" id="wk-cnt"></p><div class="dex-grid" id="wk-grid"></div></div><article class="detail" id="wk-detail"></article></div></div>';
    document.body.appendChild(d);
    var draw = function (scroll) {
      var st = WK.part === 'st';
      d.querySelector('.wk-parts').innerHTML = [['mon', '精灵资料'], ['st', '异常状态']].map(function (x) { var on = (WK.part || 'mon') === x[0]; return '<button type="button" role="tab" aria-selected="' + on + '" class="chip' + (on ? ' on' : '') + '" data-wkpart="' + x[0] + '">' + x[1] + '</button>'; }).join('');
      d.querySelector('.wk-st').hidden = !st; d.querySelector('.wk-filter').hidden = st; d.querySelector('.wk-build').hidden = st;
      if (st) { d.querySelector('.wk-st').innerHTML = wikiStatus(); return; }
      var L = WK.t ? list.filter(function (s) { return s.types.indexOf(WK.t) >= 0; }) : list;
      d.querySelector('.wk-filter').innerHTML = '<button type="button" class="chip' + (WK.t ? '' : ' on') + '" data-wkt="">全部</button>' + types.map(function (t) { return '<button type="button" class="chip' + (WK.t === t ? ' on' : '') + '" data-wkt="' + esc(t) + '">' + esc(t) + '</button>'; }).join('');
      d.querySelector('#wk-cnt').textContent = '共 ' + L.length + ' 系精灵，按图鉴编号排列。';
      d.querySelector('#wk-grid').innerHTML = wikiGrid(L);
      var det = d.querySelector('#wk-detail'), sp = SPMAP[WK.sel];
      try { det.innerHTML = wikiDetail(sp); } catch (err) { det.innerHTML = '<p class="hint">这一条资料读取出错：' + esc(err && err.message || String(err)) + '</p>'; }
      if (scroll) { var bx = d.querySelector('.wiki-box'); if (window.innerWidth < 900) det.scrollIntoView({ block: 'start', behavior: 'smooth' }); else if (bx) bx.scrollTo({ top: det.offsetTop - 10, behavior: 'smooth' }); }
    };
    draw(false);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-wkx]')) { d.remove(); return; }
      var pt = e.target.closest('[data-wkpart]'); if (pt) { WK.part = pt.dataset.wkpart; draw(false); return; }
      var b = e.target.closest('[data-wkt]'); if (b) { WK.t = b.dataset.wkt || ''; draw(false); return; }
      var c = e.target.closest('[data-wks]'); if (c) { WK.sel = c.dataset.wks; WK.v = null; WK.of = ''; draw(true); return; }
      var of = e.target.closest('[data-wkof]'); if (of) { WK.of = of.dataset.wkof || ''; draw(false); return; }
      var v = e.target.closest('[data-wkv]'); if (v) { WK.v = +v.dataset.wkv; draw(false); return; }
      var z = e.target.closest('[data-wkzoom]'); if (z) { var zi = z.querySelector('img'); if (zi) wikiZoom(zi.src, zi.alt); }
    });
  }
  // Wiki 里点立绘看大图（2026-11-02）
  function wikiZoom(src, name) {
    var o = $('wk-zoom'); if (o) o.remove();
    var z = document.createElement('div'); z.id = 'wk-zoom'; z.className = 'wk-zoom'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', '精灵大图');
    z.innerHTML = '<figure><img src="' + src + '" alt="' + esc(name || '') + '"><figcaption>' + esc(name || '') + '</figcaption></figure><button type="button" class="lb-close" aria-label="关闭">×</button>';
    document.body.appendChild(z);
    var close = function () { z.remove(); document.removeEventListener('keydown', key, true); };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    z.addEventListener('click', close);
  }
  document.addEventListener('click', function (e) {   // 奥多亚克：背包 / 仓库资料里切换查看的形态
    var b = e.target.closest && e.target.closest('[data-odof]'); if (!b) return;
    var u = +b.dataset.odof, m = mon(u), det = b.closest('.detail'), inBag = b.closest('#bag-panel, #bag-detail'); if (!m || (!det && !inBag)) return;
    ui.odoF = { u: u, f: b.dataset.of || '' };
    if (inBag) renderBag(); else det.innerHTML = monDetail(m);
  });
  // 2026-10-24：改成在 document 上监听（按钮被重新渲染也不会失效），出错时把原因提示出来
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#wiki-btn')) return;
    try { openWiki(); } catch (err) { var o = $('wiki-dlg'); if (o) o.remove(); toast('Wiki 打开失败：' + (err && err.message || err)); try { console.error(err); } catch (e2) {} }
  });
  /* ---------- 活动 · 明明教官的试炼（2026-10-24，首个大型活动） ----------
   * 读完第十一段 → 活动任务「明明教官的试炼」（古城防卫部）→ 空间站「全息作战场地」开放（限时）。
   * 关卡按日期每天开放一个属性：水、火、草、电、冰；五个都开放后的第二天开放「明明的最终试炼」。
   * 每关打败对方 3 只精灵（按顺序上场，前两只弱一些，第三只强）；通常 / 高难两种难度；赢了给明明代币，每关每个难度首次通过另有奖励。
   * 明明代币在航行日志或场地里抽奖：10 个抽一次、100 个十连；每个奖池 20 个固定奖励，抽完进下一个奖池（每天最多解锁 100 个奖池）。
   * 存档 acc.mm = { clr: { '水:0': 首通时间 }, wins: 次数, g: { n 当前奖池, left [剩余奖励序号], d 日期, opened 今天解锁的奖池数 } } */
  var BJ_DAY = 86400000;
  // 活动的时间、关卡、奖励在 js/engine/pve.js（服务器和浏览器共用，2026-10-25）
  var MM = PVE.MM, MM_NICK = PVE.MM_NICK, MM_TEAM = PVE.MM_TEAM, MM_TEAM_HARD = PVE.MM_TEAM_HARD, MM_DIFF = PVE.MM_DIFF, MM_FINAL = PVE.MM_FINAL;
  MATS.mmTok = { name: '明明代币', d: '活动「明明教官的试炼」里通过关卡获得，可以在全息作战场地或航行日志里抽奖：10 个抽一次，100 个十连。' };
  MATS.e_leiming = { name: '雷明灯的精元', d: '明明代币抽奖第 10、30、50、70……个奖池里的奖励。放进神农架 · 精灵保育仓，孵化 8 小时后会诞生一只雷明灯，有 10% 的概率是异色。', hatch: { sid: 'leiming', lv: 1, min: 480 } };
  if (MON_ORDER.indexOf('mmEye') < 0) MON_ORDER.splice(MON_ORDER.indexOf('boneDust') + 1, 0, 'mmEye');
  ['mmTok', 'e_leiming'].forEach(function (k) { if (MAT_ORDER.indexOf(k) < 0) MAT_ORDER.push(k); });
  function mmRec() { if (!acc.mm) acc.mm = { clr: {}, wins: 0 }; if (!acc.mm.clr) acc.mm.clr = {}; return acc.mm; }
  function mmDay(t) { return Math.floor(((t || Date.now()) - MM.start) / BJ_DAY); }
  function mmLive() { var t = Date.now(); return t >= MM.start && t < MM.end; }
  function mmOpen() { return !!acc && prog('mmTrial').done && mmLive(); }
  function mmStageOpen(i) { return mmDay() >= i; }   // i = 0..4 五个属性，5 = 最终试炼
  function mmOpenText(i) { var t = MM.start + i * BJ_DAY, d = new Date(t + 8 * 3600e3); return (d.getUTCMonth() + 1) + ' 月 ' + d.getUTCDate() + ' 日开放'; }
  function mmFoes(type, d) { return PVE.mmFoes(type, d); }
  function mmFinalFoes() {
    var pool = []; MM.order.forEach(function (t) { ((MM_TEAM_HARD[t]) || MM_TEAM[t]).forEach(function (sid) { if (pool.indexOf(sid) < 0) pool.push(sid); }); });
    var a = pool[Math.floor(Math.random() * pool.length)], b; do { b = pool[Math.floor(Math.random() * pool.length)]; } while (b === a);
    return [{ sid: a, lv: 75, nick: MM_NICK[a] || null, boss: { mmGift: 1, pp: 99 } }, { sid: b, lv: 75, nick: MM_NICK[b] || null, boss: { mmGift: 1, pp: 99 } },
      { sid: 'leiming', lv: 85, nick: '明明教官的光霆主', maxhp: 4500, boss: { dr: 0.25, lmBoost: 1, focus: 1, pp: 99 } }];   // 2026-10-24：加强
  }
  function mmFoeSpec(x) {
    var mv = defaultMoves(x.sid, x.lv), o = { id: x.sid, lv: x.lv, moves: mv, nick: x.nick || form({ sid: x.sid, lv: x.lv }).name, img: SPRITES[x.sid], maxhp: x.maxhp, boss: x.boss };
    seeMon(x.sid, x.lv); return o;
  }
  function mmTokRange(d) { return d === 'f' ? MM_FINAL.tok : MM_DIFF[d].tok; }
  function mmStartRemote(key, d, tp) {
    var fin = key === 'final';
    if (!tp) { openTeamPrep('明明教官的试炼 · ' + (fin ? '明明的最终试炼' : key + '系关卡（' + MM_DIFF[d].n + '）'), function (x) { mmStartRemote(key, d, x); }); return; }   // 2026-10-27：先选助战和出战顺序
    pveRemote('mm', tpArgs({ key: key, d: d }, tp), { bg: BG.bridge_p, back: '全息作战场地' }, function (e, res) {
      var msg = [];
      if (e) {
        var r = e.rep;
        dailyHit('pve');
        if (r.res === 'win') {
          msg.push('通过了' + (fin ? '「明明的最终试炼」' : key + '系关卡（' + MM_DIFF[d].n + '）') + '！获得明明代币 ×' + r.tok + '。');
          if (r.first) msg.push('首次通过奖励：明明代币 ×' + r.first.tok + '、累积经验 ×' + fmt(r.first.exp) + '、圣晶石 ×' + (r.first.core || 1) + '。');
          if (r.grail) msg.push('所有属性关卡的通常难度都通过了！明明教官送你 1 个圣杯，已经发到邮箱。');
        }
        msg = msg.concat(xpMsg(r.xp));
        save();
      } else if (res === 'void') msg.push('这场对战作废了。');
      bossBack('mmArena', function () {});
      if (msg.length) toast(msg.join(''));
      if (e || res !== 'void') setTimeout(function () { mmAgain(key, d, tp); }, 400);   // 2026-10-27：同样的阵容再来一局？
    });
  }
  function mmAgain(key, d, tp, tries) {
    if (!mmOpen() || ex.fighting || page !== 'explore' || ex.view !== 'mmArena') return;
    if (document.querySelector('.soc-dlg')) { if ((tries || 0) < 600) setTimeout(function () { mmAgain(key, d, tp, (tries || 0) + 1); }, 400); return; }   // 先等战斗奖励面板关掉，再问（每个关卡、每种难度都会问）
    var L = tpValid(tp); if (!L) return;
    var fin = key === 'final', dlg = document.createElement('div'); dlg.className = 'soc-dlg'; dlg.id = 'mm-again';
    dlg.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true" aria-label="再来一局"><span class="tape l"></span><span class="tape r"></span><span class="step">明明教官的试炼</span><h2>再来一局？</h2>' +
      '<p>用相同的阵容（包括助战）和首发，再挑战一次' + (fin ? '「明明的最终试炼」' : key + '系关卡（' + MM_DIFF[d].n + '）') + '。</p>' +
      '<div class="tp-again">' + L.map(function (e, i) { var f = e.m ? form(e.m) : form(e.h.mon); return '<span class="tp-mini' + (i ? '' : ' lead') + '"><img src="' + f.img + '" alt=""><small>' + (i ? '' : '首发 · ') + esc(f.name) + (e.h ? '（助战）' : '') + '</small></span>'; }).join('') + '</div>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-agx="1">不了</button><button type="button" class="btn" data-agedit="1">调整阵容</button><button type="button" class="btn primary" data-aggo="1">再来一局</button></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg || ev.target.closest('[data-agx]')) { dlg.remove(); return; }
      if (ev.target.closest('[data-agedit]')) { dlg.remove(); mmStartRemote(key, d); return; }
      if (ev.target.closest('[data-aggo]')) { dlg.remove(); mmStartRemote(key, d, tp); }
    });
  }
  function mmStart(key, d) {   // key = 属性 或 'final'
    if (!mmOpen()) return;
    if (srvMode()) return mmStartRemote(key, d ? 1 : 0);
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var fin = key === 'final', foes = fin ? mmFinalFoes() : mmFoes(key, d), a = foes.map(mmFoeSpec);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: team.map(storyMon), a: a, foe: '明明教官的试炼', diff: fin ? '明明的最终试炼' : key + '系关卡 · ' + MM_DIFF[d].n, ordered: true, bgm: fin || d === 1 ? 'mingBattle2' : 'mingBattle1', bgmAt: { 2: fin || d === 1 ? 'mingFinal2' : 'mingFinal1' },   // 高难和最终试炼：MingBattle2 → 第三只 MingFinalBattle2
      items: invCopy(), onItem: useInv, bg: BG.bridge_p, back: '全息作战场地',
      onEnd: function (res, seen, downs) {
        var msg = [], R = mmRec(), ck = fin ? 'final' : key + ':' + d;
        dailyHit('pve');
        if (res === 'win') {
          var rg = mmTokRange(fin ? 'f' : d), tok = rg[0] + Math.floor(Math.random() * (rg[1] - rg[0] + 1)), it = { mmTok: tok };
          R.wins = (R.wins || 0) + 1;
          msg.push('通过了' + (fin ? '「明明的最终试炼」' : key + '系关卡（' + MM_DIFF[d].n + '）') + '！获得明明代币 ×' + tok + '。');
          if (!R.clr[ck]) {
            R.clr[ck] = Date.now(); var F = fin ? MM_FINAL.first : MM_DIFF[d].first;
            var gc = fin ? PVE.MM_CORE.fin : PVE.MM_CORE.lv; earn('mmFirst', ck, { exp: F.exp, items: { mmTok: F.tok, g_core: gc } });
            msg.push('首次通过奖励：明明代币 ×' + F.tok + '、累积经验 ×' + fmt(F.exp) + '、圣晶石 ×' + gc + '。');
          }
          earn('mm', '', { items: it });
        }
        msg = msg.concat(battleRewards(team, seen, downs));
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'mmArena';
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
        if (msg.length) toast(msg.join(''));
      } });
  }
  function mmLeftText() { var ms = MM.end - Date.now(), dd = Math.floor(ms / BJ_DAY), h = Math.floor(ms % BJ_DAY / 3600000); return ms <= 0 ? '已结束' : '剩余 ' + (dd ? dd + ' 天 ' : '') + h + ' 小时'; }
  function renderMmArena() {
    var R = mmRec(), tok = acc.items.mmTok || 0;
    var stage = function (t, i) {
      var open = mmStageOpen(i), f = MM_TEAM[t], img = SPRITES[f[2]];
      return '<article class="mm-st' + (open ? '' : ' locked') + '"><span class="tape r"></span><div class="mm-art">' + (open ? '<img src="' + img + '" alt="">' : '<span class="mm-lock">🔒</span>') + '</div><div class="mm-txt"><h3>' + t + '系关卡</h3>' +
        (open ? '<p class="hint">对手：' + f.map(function (sid) { return esc(MM_NICK[sid] || SPMAP[sid].name); }).join('、') + '</p><div class="mm-btns">' + MM_DIFF.map(function (D, d) { var c = R.clr[t + ':' + d]; return '<button type="button" class="btn' + (d ? ' primary' : '') + '" data-mmgo="' + t + '" data-d="' + d + '">' + D.n + (c ? ' ✓' : '') + '</button>'; }).join('') + '</div>'
          : '<p class="hint">' + mmOpenText(i) + '</p>') + '</div></article>';
    };
    var finOpen = mmStageOpen(5);
    $('pg-explore').innerHTML = holoHead('') +
      '<div class="crumb"><button type="button" class="btn ghost" id="mm-back">‹ 返回' + (ex.mmFrom === 'holo' ? '全息作战' : '空间站') + '</button><b>空间站 · 全息作战场地</b><span class="hint">限时活动 · ' + mmLeftText() + '</span></div>' +
      '<div class="mm-bar"><span>明明代币 <b>' + fmt(tok) + '</b></span><button type="button" class="btn primary" data-mmgacha="1">去抽奖</button></div>' +
      '<div class="mm-grid">' + MM.order.map(stage).join('') +
      '<article class="mm-st final' + (finOpen ? '' : ' locked') + '"><span class="tape r"></span><div class="mm-art">' + (finOpen ? '<img src="' + SPRITES.leiming + '" alt="">' : '<span class="mm-lock">🔒</span>') + '</div><div class="mm-txt"><h3>明明的最终试炼</h3>' +
        (finOpen ? '<p class="hint">最后，明明教官会亲自带着光霆主上场。</p><div class="mm-btns"><button type="button" class="btn primary" data-mmgo="final" data-d="0">挑战' + (R.clr.final ? ' ✓' : '') + '</button></div>'
          : '<p class="hint">' + mmOpenText(5) + '</p>') + '</div></article></div>';
  }
  /* ----- 明明代币抽奖 ----- */
  function mmPool(n) { return TX.mmPool(n); }   // 奖池内容在 js/engine/tx.js
  function mmPrizeText(z) { return z.exp ? '累积经验 ×' + fmt(z.exp) : Object.keys(z.items).map(function (k) { return itemName(k) + ' ×' + z.items[k]; }).join('、'); }
  function mmG() { return TX.mmG(acc, Date.now()); }
  var MM_POOL_DAY = TX.D.MM_POOL_DAY;
  function mmDraw(times) {
    var cost = TX.D.MM_COST * times;
    if ((acc.items.mmTok || 0) < cost) { toast('明明代币不够，需要 ' + cost + ' 个。'); return; }
    txRun('mm', { times: times }, function (r) {   // 抽奖规则在 js/engine/tx.js，由服务器掷随机数
      var got = r.got.map(function (z) { return (z.big ? '★ ' : '') + mmPrizeText(z); });
      renderRes();
      if (IG.acc === acc) IG.snap = igSnap();   // 抽奖有自己的结果面板，不再弹「获得物品」
      if (got.length) mmShowDraw(got, r.stop); else if (r.stop) toast(r.stop);
      if (ex.view === 'mmGacha') renderMmGacha();
    });
  }
  function mmShowDraw(got, stop) {
    var d = document.createElement('div'); d.className = 'soc-dlg';
    d.innerHTML = '<div class="soc-box side-new" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span><span class="step">明明代币抽奖</span><h2>抽到了 ' + got.length + ' 个奖励</h2><ul class="mm-got">' + got.map(function (t) { return '<li' + (t.indexOf('★') === 0 ? ' class="big"' : '') + '>' + esc(t) + '</li>'; }).join('') + '</ul>' + (stop ? '<p class="hint">' + esc(stop) + '</p>' : '') +
      '<div class="soc-foot"><button type="button" class="btn primary" data-gotx="1">好的</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-gotx]')) d.remove(); });
  }
  function renderMmGacha() {
    var G = mmG(), P = mmPool(G.n), tok = acc.items.mmTok || 0;
    $('pg-explore').innerHTML = holoHead('用明明代币抽奖：每个奖池有 20 个固定奖励，抽完一个奖池就会进入下一个。每逢 4 的倍数的奖池，50学习力合剂换成 100学习力合剂。从第 5 个奖池起，每逢 5 的倍数的奖池都有 50 个「雷明之眼」；第 10、30、50、70……个奖池还有「雷明灯的精元」（孵出的雷明灯 10% 是异色）。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="mmg-back">‹ 返回' + (ex.mmFrom === 'log' ? '航行日志' : ex.mmFrom === 'holo' ? '全息作战' : '全息作战场地') + '</button><b>明明代币抽奖 · 第 ' + G.n + ' 个奖池</b></div>' +
      '<div class="mm-bar"><span>明明代币 <b>' + fmt(tok) + '</b></span><span>剩余 <b>' + G.left.length + '</b> / 20</span><span class="hint">今天已解锁 ' + G.opened + ' / ' + MM_POOL_DAY + ' 个新奖池</span>' +
      '<button type="button" class="btn" data-mmdraw="1"' + (tok >= 10 ? '' : ' disabled') + '>抽一次（10）</button><button type="button" class="btn primary" data-mmdraw="10"' + (tok >= 100 ? '' : ' disabled') + '>十连抽（100）</button></div>' +
      '<ol class="mm-pool">' + P.map(function (z, i) { var left = G.left.indexOf(i) >= 0; return '<li class="' + (left ? '' : 'got') + (z.big ? ' big' : '') + '"><span class="mmp-ic">' + H.itemIcon(z.exp ? 'exp' : Object.keys(z.items)[0]) + '</span><span class="mmp-t">' + esc(mmPrizeText(z)) + '</span>' + (left ? '' : '<em>已抽到</em>') + '</li>'; }).join('') + '</ol>';
  }
  function mmEventPop() {
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'mm-pop';
    d.innerHTML = '<div class="soc-box side-new" role="dialog" aria-modal="true" aria-label="新活动"><span class="tape l"></span><span class="tape r"></span><span class="step">新活动</span><h2>明明教官的试炼</h2>' +
      '<p>首个大型活动开始了！先到荆楚号 · 襄阳 · 古城防卫部，完成活动任务「明明教官的试炼」。</p><p class="hint">之后可以在空间站的全息作战场地挑战水、火、草、电、冰五个属性的关卡（每天开放一个），赢取明明代币抽奖。活动' + mmLeftText() + '。</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-mmx="1">知道了</button><button type="button" class="btn primary" data-mmpopgo="1">去古城防卫部</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-mmx]')) { d.remove(); return; }
      if (e.target.closest('[data-mmpopgo]')) { d.remove(); ex.planet = 'jingchu'; go('explore'); teleport('襄阳'); }
    });
  }
  /* ---------- 全息作战（2026-10-27）：原来「竞技对战」那一栏，改成大型活动展厅。竞技对战搬到星际探索 · 太空竞技场 ---------- */
  function renderHolo() {   // 活动没开放（还没解锁 / 已结束）时才会停在这一页；开放时直接进全息作战场地
    var el = $('pg-holo'); if (!el || !acc) return;
    var live = mmLive(), f7 = prog('flora7').done;
    el.innerHTML = '<div class="page-head holo-head"><h2 class="sec">全息作战 · 明明教官的试炼</h2></div>' +
      '<article class="holo-card' + (live ? ' live' : ' ended') + '"><span class="tape l"></span><span class="tape r"></span><span class="chip log-tag">' + (live ? '进行中' : Date.now() < MM.start ? '即将开始' : '已结束') + '</span>' +
      '<div class="holo-art"><img src="' + (CHARS.mm || '') + '" alt=""></div><div class="holo-txt"><h3>明明教官的试炼</h3>' +
      '' +
      (live ? '<p class="hint">活动' + mmLeftText() + ' · ' + (f7 ? '先完成古城防卫部的活动任务「明明教官的试炼」' : '读完主线第十一段后参加') + '</p>' : '<p class="hint">活动已经结束了，下一次大型活动敬请期待。</p>') +
      '<div class="soc-foot">' + (live && f7 ? '<button type="button" class="btn primary" data-mmlog="task">去古城防卫部</button>' : (acc.mm ? '<button type="button" class="btn" data-mmlog="gacha">代币抽奖</button>' : '')) + '</div></div></article>';
  }
  $('pg-holo').addEventListener('click', function (e) {
    var ml = e.target.closest('[data-mmlog]'); if (ml) { var mk = ml.dataset.mmlog; if (mk === 'task') { ex.planet = 'jingchu'; go('explore'); teleport('襄阳'); return; } ex.mmFrom = 'holo'; ex.view = mk === 'gacha' ? 'mmGacha' : 'mmArena'; go('explore'); renderExplore(); return; }
    if (e.target.closest('[data-gosarena]')) { ex.planet = 'sarena'; ex.view = 'sites'; go('explore'); return; }
  });
  $('arena-back').addEventListener('click', function () { ex.planet = 'jingchu'; ex.view = 'sites'; go('explore'); });   // 2026-11-02：竞技对战在飞船终端里
  function mmLogHTML() {
    if (!acc || !prog('flora7').done || !mmLive()) return '';
    var open = prog('mmTrial').done;
    return '<article class="log-card wide mm-card"><span class="tape l"></span><span class="tape r"></span><span class="chip log-tag">限时活动</span><h3>明明教官的试炼</h3>' +
      '' +
      '<p class="hint">活动' + mmLeftText() + (open ? ' · 明明代币 ' + fmt(acc.items.mmTok || 0) : ' · 先完成古城防卫部的活动任务「明明教官的试炼」') + '</p>' +
      '<div class="soc-foot">' + (open ? '<button type="button" class="btn" data-mmlog="gacha">代币抽奖</button><button type="button" class="btn primary" data-mmlog="arena">传送到全息作战场地</button>' : '<button type="button" class="btn primary" data-mmlog="task">去古城防卫部</button>') + '</div></article>';
  }
  /* ---------- 商城：荆门 · 物资仓储 ---------- */
  var shopQty = {};
  // 不在战斗里用的商品
  var SHOP_X = { rename: { name: '改名卡', price: TX.D.RENAME_PRICE, d: '使用后可以修改做题家名字（最多 ' + NAME_MAX + ' 个字）。兑换后点右上角的名字，在菜单里使用。' } };
  function goods(k) { return ITEMS[k] || SHOP_X[k]; }
  function renderShop() {
    var grp = [['捕捉装置', ['cap1']], ['其他', ['rename']]];
    $('pg-explore').innerHTML = exHead('荆楚号 · 荆门物资仓储的商城。这里用能量兑换普通捕捉装置和改名卡。加强捕捉装置、华为捕捉装置和 200hp药水在黄石 · 冶炼坊合成。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ex-area">‹ 返回物资仓储</button><b>物资仓储 · 商城</b></div>' +
      '<div class="shop-bal"><span class="tape l"></span>当前能量 <b>' + fmt(acc.energy) + '</b></div>' +
      grp.map(function (g) {
        return '<h3 class="shop-h">' + g[0] + '</h3><div class="shop-grid">' + g[1].map(function (k) {
          var it = goods(k), q = shopQty[k] || 1, cost = it.price * q, ok = acc.energy >= cost;
          return '<article class="shop-it"><span class="tape r"></span>' + H.itemIcon(k) + '<div class="si-txt"><b>' + it.name + '</b><p class="hint">' + esc(shortD(it)) + '</p>' +
            '<p class="si-own">持有 <b>' + (acc.items[k] || 0) + '</b></p></div>' +
            '<div class="si-buy"><span class="si-price">' + fmt(it.price) + ' <small>能量</small></span>' +
            '<div class="qty"><button type="button" class="btn ghost" data-q="' + k + '|-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-q="' + k + '|1" aria-label="增加"' + (q >= 99 ? ' disabled' : '') + '>+</button></div>' +
            '<button type="button" class="btn primary" data-buy="' + k + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '兑换 · ' + fmt(cost) : '能量不足') + '</button></div></article>';
        }).join('') + '</div>';
      }).join('');
  }
  function shopClick(e) {
    var q = e.target.closest('[data-q]'); if (q) { if (!q.disabled) { var a = q.dataset.q.split('|'); shopQty[a[0]] = Math.max(1, Math.min(99, (shopQty[a[0]] || 1) + +a[1])); renderShop(); } return true; }
    var b = e.target.closest('[data-buy]'); if (!b) return false; if (b.disabled) return true;
    var k = b.dataset.buy, n = shopQty[k] || 1, cost = goods(k).price * n;
    if (acc.energy < cost) return true;
    txRun('shop', { k: k, n: n }, function (r) {
      shopQty[k] = 1; renderRes(); if (ex.view === 'shop') renderShop(); renderRename();
      toast('兑换成功：' + goods(k).name + ' ×' + r.n + '，消耗 ' + fmt(r.cost) + ' 能量。' + (k === 'rename' ? '点右上角的名字即可使用。' : ''));
    });
    return true;
  }

  /* ---------- 精灵保育仓：神农架 · 精灵保育区 ----------
   * 3 个孵化槽，放入精元后开始计时（MATS[k].hatch.min 分钟），时间到了点「孵化」得到精灵。存档 acc.nursery = { slots: [{ k, t } | null ×3] } */
  var NURSERY_N = 3;
  function nursery() {
    if (!acc.nursery || !Array.isArray(acc.nursery.slots)) acc.nursery = { slots: [] };
    while (acc.nursery.slots.length < NURSERY_N) acc.nursery.slots.push(null);
    acc.nursery.slots = acc.nursery.slots.slice(0, NURSERY_N).map(function (x) { return x && MATS[x.k] && MATS[x.k].hatch ? x : null; });
    return acc.nursery;
  }
  function hatchLeft(x) { return Math.max(0, x.t + MATS[x.k].hatch.min * 60000 - Date.now()); }
  /* ---------- 温泉疗养（荆楚号 · 咸宁 · 温泉生活区）----------
   * 带 2 只精灵泡温泉：只要游戏开着（在线），它们就一直涨经验，离线不算。
   * 效率：每只每小时 120 + 等级 × 24 点（茶室展示是 30 + 等级 × 6，离线经验是每分钟 6 点进经验背包）。数额暂定
   * 存档 acc.spa = { u: [精灵编号或 null, ...], got: { 编号: 累计获得 } }；SPA.last 只在内存里，所以关掉游戏期间不会算经验 */
  /* 2026-10-18 温泉大更新：
   *   - 温泉大厅（背景 spa_hall）：在水里放精灵（下方有一层水面，精灵在水面上自由浮动），点「开始泡温泉」才开始计时、涨经验。
   *   - 泡温泉期间必须留在温泉页面：离开时弹窗确认，离开后这次就结束了，下次要重新开始。
   *   - 经验是以前的 4 倍：每只每小时 (120 + 等级 × 24) × 4；喝了「经验翻倍橘子汁」期间再 ×2。
   *   - 休息室（背景 spa_lounge）：用能量买东西：经验翻倍橘子汁、泡温泉精灵栏位 +1（价格 3000 起，每次 ×3）。
   * 存档 acc.spa = { u: [精灵编号或 null…], got: { 编号: 累计 }, extra: 已买的栏位, juice: 橘子汁效果到期时间 } */
  var SPA_BASE = 2, SPA_EXTRA_MAX = TX.D.SPA_EXTRA_MAX, SPA_TICK = 2000, SPA_GAP = 30000, SPA_JUICE = TX.D.SPA_JUICE;   // 价格在 js/engine/tx.js
  var SPA = { on: false, t0: 0, last: 0, carry: {}, sess: {}, total: 0 };
  // 温泉音乐：默认 spa；GrassTalk、Memory 在休息室用能量解锁
  var SPA_BGM = TX.D.SPA_BGM;
  function spaBgmOwn(k) { return k === 'spa' || !!(acc && acc.spa && acc.spa.bgmOwn && acc.spa.bgmOwn[k]); }
  function spaBgm() { var k = acc && acc.spa && acc.spa.bgm; return k && spaBgmOwn(k) ? k : 'spa'; }
  function spaOpen() { return !!(acc && prog('spa').done); }
  function spaN() { return SPA_BASE + Math.min(SPA_EXTRA_MAX, (acc.spa && acc.spa.extra) || 0); }
  function spaSlotPrice() { return TX.spaSlotPrice(acc.spa && acc.spa.extra); }
  function spa() { if (!acc.spa || !Array.isArray(acc.spa.u)) acc.spa = { u: [], got: {} }; var n = spaN(); while (acc.spa.u.length < n) acc.spa.u.push(null); acc.spa.u = acc.spa.u.slice(0, n).map(function (u) { return u != null && mon(u) ? u : null; }); if (!acc.spa.got) acc.spa.got = {}; return acc.spa; }
  function juiceOn() { return !!(acc.spa && acc.spa.juice > Date.now()); }
  function spaRate(m) { return (120 + m.lv * 24) * 4 * (juiceOn() ? 2 : 1); }
  function spaMons() { return spa().u.map(mon).filter(Boolean); }
  function inTea(u) { return !!(acc.home && Array.isArray(acc.home.mons) && acc.home.mons.some(function (x) { return (typeof x === 'number' ? x : x.u) === u; })); }
  function spaSummary() { var L = spaMons(); return L.length ? L.map(function (m) { return form(m).name; }).join('、') + ' 在温泉里' : '带精灵一起泡温泉'; }
  function spaPut(i, u) {
    var S = spa(); if (!(i >= 0 && i < spaN())) return;
    if (u != null) {
      var m = mon(u); if (!m) return;
      if (inTea(u)) { toast('它正在茶室里展示，先从茶室收回来吧。'); return; }
      var j = S.u.indexOf(u); if (j >= 0) S.u[j] = null;
      S.u[i] = u;
    } else S.u[i] = null;
    ex.spaPick = null; save(); renderSpa();
  }
  function spaStart() {
    if (!spaMons().length) { toast('先放一只精灵进温泉吧。'); return; }
    txRun('spaRun', { a: 'start' }, function () {   // 走交易（grow.js）：经验由服务器按时间算
      SPA.on = true; SPA.t0 = Date.now(); SPA.last = Date.now(); SPA.carry = {}; SPA.sess = {}; SPA.total = 0; SPA.sent = Date.now();
      renderSpa(); toast('开始泡温泉了！留在这个页面，精灵们就会一直涨经验。');
    });
  }
  function spaEnd(quiet) {
    if (!SPA.on) return;
    var min = Math.floor((Date.now() - SPA.t0) / 60000);
    SPA.on = false;
    var fin = function (r) { if (r) spaGot(r); if (!quiet) toast('这次泡了 ' + durText(min) + '，精灵们一共获得了 ' + fmt(SPA.total) + ' 点经验。'); };
    txRun('spaRun', { a: 'end' }, fin, function () { fin(null); });
  }
  // 服务器结算的温泉经验：记到这次的统计里，升级的提示一下
  function spaGot(r) {
    var msgs = [];
    (r.gains || []).forEach(function (g) { SPA.sess[g.u] = (SPA.sess[g.u] || 0) + g.amt; if (g.lv1 > g.lv0) msgs.push(g.name1 + ' 升到了 LV' + g.lv1 + '！'); });
    SPA.total += r.total || 0;
    if (r.ms) { var m1 = spaMinTotal(), m0 = Math.floor((((acc.spa && acc.spa.ms) || 0) - r.ms) / 60000); if (m1 !== m0 && [120, 600, 3000].some(function (x) { return m0 < x && m1 >= x; })) checkTitles(); }
    if (msgs.length) { toast('温泉疗养：' + msgs.join(' ')); if (page === 'explore' && ex.view === 'spa') renderSpa(); return; }
    spaHud();
  }
  // 离开温泉的确认弹窗：留下就什么都不变；离开就结束这次泡温泉，再执行原本要做的事
  function spaLeaveAsk(go_) {
    var old = $('spa-leave'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'spa-leave';
    d.innerHTML = '<div class="soc-box" role="dialog" aria-modal="true" aria-label="离开温泉"><h2>真的要离开吗？</h2><p>精灵们正泡得舒服呢。离开之后就不能继续获得经验了，下次要重新开始泡温泉。</p>' +
      '<p class="hint">这次已经泡了 ' + durText(Math.floor((Date.now() - SPA.t0) / 60000)) + '，获得经验 ' + fmt(SPA.total) + '。</p>' +
      '<div class="soc-foot"><button type="button" class="btn" data-spastay="1">再泡一会儿</button><button type="button" class="btn primary" data-spago="1">离开</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target.closest('[data-spago]')) { d.remove(); spaEnd(); go_(); return; }
      if (e.target === d || e.target.closest('[data-spastay]')) d.remove();
    });
  }
  window.addEventListener('beforeunload', function (e) { if (SPA.on) { e.preventDefault(); e.returnValue = ''; } });
  // 每 2 秒结算一次；只有在温泉页面里、并且已经「开始泡温泉」才算。两次结算间隔太久（电脑睡眠）就不算这段
  function spaTick() {   // 每 15 秒让服务器结算一次（只有在温泉页面里、并且已经「开始泡温泉」才报）
    if (!SPA.on || !ready() || !spaOpen()) return;
    if (!(page === 'explore' && ex.view === 'spa')) return;
    if (Date.now() - (SPA.sent || 0) < 15000) return;
    SPA.sent = Date.now();
    txRun('spaRun', { a: 'tick' }, function (r) { spaGot(r); }, function () {});
  }
  setInterval(spaTick, SPA_TICK);
  setInterval(function () { if (SPA.on && page === 'explore' && ex.view === 'spa') spaHud(); }, 1000);
  function hms(ms) { var t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s2 = t % 60; return (h ? h + ':' : '') + (m < 10 && h ? '0' : '') + m + ':' + (s2 < 10 ? '0' : '') + s2; }
  // 只刷新计时、经验数字和经验条，不重画整个页面（精灵浮动的动画不会被打断）
  function spaHud() {
    var t = $('spa-time'); if (!t) return;
    t.textContent = hms(Date.now() - SPA.t0);
    var g = $('spa-gain'); if (g) g.textContent = '+' + fmt(SPA.total);
    var jt = $('spa-juice'); if (jt) jt.textContent = juiceOn() ? '经验翻倍中 · 还剩 ' + hms(acc.spa.juice - Date.now()) : '';
    spaMons().forEach(function (m) {
      var el = document.querySelector('[data-spabar="' + m.u + '"]'); if (!el) return;
      var maxed = atCap(m), need = maxed ? 0 : expAt(m.lv + 1) - m.exp, span = maxed ? 1 : expAt(m.lv + 1) - expAt(m.lv);
      el.querySelector('i').style.width = (maxed ? 100 : Math.min(100, (span - need) / span * 100)) + '%';
      var gl = document.querySelector('[data-spagain="' + m.u + '"]'); if (gl) gl.textContent = '+' + fmt(SPA.sess[m.u] || 0);
    });
  }
  // 精灵在水面上的位置：分在左右两边，中间留给泡温泉的主角（单数号在左、双数号在右，各自均匀排开）
  function spaHx(i, n) {
    var left = i % 2 === 0, k = Math.floor(i / 2), cnt = left ? Math.ceil(n / 2) : Math.floor(n / 2);
    var a = left ? 7 : 66, b = left ? 34 : 93;
    return +(cnt > 1 ? a + k * (b - a) / (cnt - 1) : (a + b) / 2).toFixed(1);
  }
  function renderSpa() {
    var S = spa(), pick = ex.spaPick, L = spaMons(), on = SPA.on;
    // 水面上浮着的精灵：位置按栏位分开，每只的漂浮节奏不一样
    var floats = S.u.map(function (u, i) {
      var m = mon(u); if (!m) return '';
      var f = form(m), x = 12 + (i * 76 / Math.max(1, S.u.length - 1 || 1)) % 80;
      var hx = spaHx(i, S.u.length);
      return '<div class="spa-float" data-csid="' + m.sid + '" data-cst="' + (f.stage || 0) + '" data-cctx="spa" data-hx="' + hx + '" style="left:' + hx + '%;animation-delay:-' + (i * 1.7) + 's"><img src="' + f.img + '" alt="' + esc(f.name) + '"><span>' + esc(f.name) + '</span></div>';
    }).join('');
    var hud = on ? '<div class="spa-hud"><div><small>已泡时长</small><b id="spa-time">' + hms(Date.now() - SPA.t0) + '</b></div><div class="spa-hud-g"><small>本次获得经验</small><b id="spa-gain">+' + fmt(SPA.total) + '</b></div><em id="spa-juice">' + (juiceOn() ? '经验翻倍中 · 还剩 ' + hms(acc.spa.juice - Date.now()) : '') + '</em></div>' : '';
    var cards = S.u.map(function (u, i) {
      var m = mon(u);
      if (!m) return '<button type="button" class="spa-card empty' + (pick === i ? ' on' : '') + '" data-spaslot="' + i + '"><b>＋</b><span>' + (i + 1) + ' 号位 · 放一只精灵</span></button>';
      var f = form(m), maxed = atCap(m), need = maxed ? 0 : expAt(m.lv + 1) - m.exp, span = maxed ? 1 : expAt(m.lv + 1) - expAt(m.lv);
      return '<div class="spa-card"><img src="' + f.img + '" alt=""><div class="spa-ct"><b>' + esc(f.name) + ' <span class="lvbig">LV' + m.lv + '</span></b>' +
        '<div class="exp-bar" data-spabar="' + m.u + '"><i style="width:' + (maxed ? 100 : Math.min(100, (span - need) / span * 100)) + '%"></i></div>' +
        '<small>' + (maxed ? '已到等级上限' : '每小时 +' + fmt(spaRate(m))) + (on ? ' · 本次 <b class="spa-g" data-spagain="' + m.u + '">+' + fmt(SPA.sess[m.u] || 0) + '</b>' : '') + '</small>' +
        '<span class="spa-acts"><button type="button" class="btn ghost" data-spaslot="' + i + '">换一只</button><button type="button" class="btn ghost" data-spaout="' + i + '">起身</button></span></div></div>';
    }).join('');
    var list = '';
    if (pick != null) {
      var A = acc.mons.slice().sort(function (a, b) { return b.lv - a.lv; });
      list = '<div class="spa-pick"><h4>选一只精灵放进 ' + (pick + 1) + ' 号位 <span class="hint">茶室里展示中的精灵要先收回</span></h4><div class="spa-list">' + A.map(function (m) {
        var f = form(m), inS = S.u.indexOf(m.u) >= 0, tea = inTea(m.u);
        return '<button type="button" class="spa-it' + (inS ? ' on' : '') + '" data-spain="' + m.u + '"' + (tea ? ' disabled' : '') + '><img src="' + f.img + '" alt=""><b>' + esc(f.name) + '</b><small>LV' + m.lv + (tea ? ' · 茶室展示中' : inS ? ' · 泡着呢' : ' · 每小时 +' + fmt(spaRate(m))) + '</small></button>';
      }).join('') + '</div></div>';
    }
    $('pg-explore').innerHTML = exHead(on ? '正在泡温泉：留在这个页面，精灵们就会一直涨经验。离开就结束这一次。' : '把精灵放进温泉，点「开始泡温泉」。泡温泉期间要一直留在这个页面。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="spa-back">‹ 返回温泉生活区</button><b>咸宁 · 温泉大厅</b></div>' +
      '<div class="spa-hall' + (on ? ' soaking' : '') + '" style="background-image:url(images/backgrounds/spa_hall.jpg?v=2)">' + hud +
        '<div class="spa-steam" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
        '<div class="spa-pool"><div class="spa-wave" aria-hidden="true"></div>' + floats +
        (on ? '<img class="spa-player" src="images/characters/spa_' + gender() + '.webp" alt="' + esc(acc.name) + '">' : '') + '</div></div>' +
      '<div class="spa-ctl">' + (on ? '<button type="button" class="btn" data-spaend="1">起身离开</button>' : '<button type="button" class="btn primary big" data-spastart="1"' + (L.length ? '' : ' disabled') + '>开始泡温泉</button>') +
        '<button type="button" class="btn" data-sparoom="1">去休息室</button><span class="hint">泡温泉的精灵会持续获得经验，等级越高涨得越快，直接加给精灵，不占每日战斗经验上限。' + (juiceOn() ? '<b class="red">经验翻倍橘子汁生效中！</b>' : '') + '</span></div>' +
      '<div class="spa-cards">' + cards + '</div>' + list;
  }
  // 休息室：在温泉页面里打开的面板（不算离开温泉），用能量买东西
  function openSpaRoom() {
    var old = $('spa-room'); if (old) old.remove();
    var price = spaSlotPrice();
    var d = document.createElement('div'); d.className = 'soc-dlg spa-room-dlg'; d.id = 'spa-room';
    d.innerHTML = '<div class="soc-box spa-room" role="dialog" aria-modal="true" aria-label="温泉休息室" style="background-image:linear-gradient(rgba(20,16,10,.35),rgba(20,16,10,.7)),url(images/backgrounds/spa_lounge.jpg)">' +
      '<h2>温泉休息室</h2><p class="spa-rm-sub">能量 <b>' + fmt(acc.energy || 0) + '</b></p><div class="spa-goods">' +
      '<article class="spa-good"><b>经验翻倍橘子汁</b><p>冰镇的橘子汁。喝下后 ' + SPA_JUICE.min + ' 分钟内，温泉经验翻倍（可以叠加时长）。</p>' + (juiceOn() ? '<p class="hint">生效中，还剩 ' + hms(acc.spa.juice - Date.now()) + '</p>' : '') +
        '<button type="button" class="btn primary" data-spabuy="juice"' + ((acc.energy || 0) >= SPA_JUICE.price ? '' : ' disabled') + '>' + fmt(SPA_JUICE.price) + ' 能量 · 来一杯</button></article>' +
      '<article class="spa-good"><b>泡温泉精灵栏位 +1</b><p>现在 ' + spaN() + ' 个栏位，最多 ' + (SPA_BASE + SPA_EXTRA_MAX) + ' 个。每次扩建的价格是上一次的 3 倍。</p>' +
        (price ? '<button type="button" class="btn primary" data-spabuy="slot"' + ((acc.energy || 0) >= price ? '' : ' disabled') + '>' + fmt(price) + ' 能量 · 扩建</button>' : '<button type="button" class="btn" disabled>已经扩建到最多了</button>') + '</article>' +
      '<article class="spa-good"><b>温泉音乐</b><p>选一首在温泉里放的曲子。</p><div class="spa-bgms">' + SPA_BGM.map(function (x) {
        var own = spaBgmOwn(x.k), cur = spaBgm() === x.k;
        return own ? '<button type="button" class="btn' + (cur ? ' primary' : '') + '" data-spabgm="' + x.k + '">' + (cur ? '♪ ' : '') + HSTRACK(x.k) + (cur ? ' · 播放中' : '') + '</button>'
          : '<button type="button" class="btn" data-spabgmbuy="' + x.k + '"' + ((acc.energy || 0) >= x.price ? '' : ' disabled') + '>🔒 ' + HSTRACK(x.k) + ' · ' + fmt(x.price) + ' 能量解锁</button>';
      }).join('') + '</div></article>' +
      '</div><div class="soc-foot"><button type="button" class="btn" data-spax="1">回到温泉</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var bg = e.target.closest('[data-spabgm]'), bb = e.target.closest('[data-spabgmbuy]');
      if (bg) { acc.spa.bgm = bg.dataset.spabgm; save(); bgmScene(); openSpaRoom(); return; }
      if (bb) { var X = SPA_BGM.filter(function (x) { return x.k === bb.dataset.spabgmbuy; })[0]; if (!X || (acc.energy || 0) < X.price) return; txRun('spa', { k: 'bgm', m: X.k }, function () { renderRes(); bgmScene(); toast('解锁了温泉音乐「' + HSTRACK(X.k) + '」，已经换上。'); if (d.isConnected) openSpaRoom(); }); return; }
      var b = e.target.closest('[data-spabuy]');
      if (b) {
        var k = b.dataset.spabuy;
        var after = function () { renderRes(); renderSpa(); if (d.isConnected) openSpaRoom(); };
        if (k === 'juice') { if ((acc.energy || 0) < SPA_JUICE.price) return; txRun('spa', { k: 'juice' }, function () { toast('咕嘟咕嘟……接下来温泉经验翻倍！'); after(); }); }
        if (k === 'slot') { var pr = spaSlotPrice(); if (!pr || (acc.energy || 0) < pr) return; txRun('spa', { k: 'slot' }, function () { spa(); save(); toast('温泉扩建好了，现在可以泡 ' + spaN() + ' 只精灵。'); after(); }); }
        return;
      }
      if (e.target === d || e.target.closest('[data-spax]')) d.remove();
    });
  }
  /* ---------- 授勋馆（荆楚号 · 黄冈 · 学院部）：展示所有称号和获得方式 ---------- */
  function medalOpen() { return !!(acc && prog('medal').done); }
  function renderMedal() {
    if (!acc.titles) acc.titles = [];
    var has = function (T) { return (acc.titles || []).indexOf(T.id) >= 0; };
    var card = function (T, sub) {
      var own = has(T);
      var rw = titleRw(T);
      return '<div class="md-card' + (own ? ' own' : '') + '"><span class="md-ic" aria-hidden="true">' + (own ? '★' : '☆') + '</span><span class="md-tx"><b>' + T.n + '</b><small>' + T.d + (sub ? ' · ' + sub : '') + '</small><small class="md-rw">经验 ' + fmt(rw.exp) + ' · 能量 ' + fmt(rw.energy) + ' · 功勋 ' + rw.merit + '</small></span><span class="md-st">' + (own ? '已获得' : '未获得') + '</span></div>';
    };
    var grp = function (g) { return TITLES.filter(function (T) { return T.grp === g; }); };
    var sec = function (h, L, note) { var n = L.filter(has).length; return '<section class="md-sec"><h3>' + h + ' <small>' + n + ' / ' + L.length + '</small></h3>' + (note ? '<p class="hint">' + note + '</p>' : '') + '<div class="md-grid">' + L.map(function (T) { return card(T); }).join('') + '</div></section>'; };
    var all = TITLES.length, got = TITLES.filter(has).length;
    if (TITLE_TYPES.indexOf(ex.mdType) < 0) ex.mdType = TITLE_TYPES.reduce(function (b, x) { return typeKinds(x, 0) > typeKinds(b, 0) ? x : b; }, TITLE_TYPES[0]);   // 默认打开精灵种类最多的属性
    var t = ex.mdType, TT = grp('type');
    var tabs = '<div class="md-tabs" role="tablist">' + TITLE_TYPES.map(function (x) {
      var L = TT.filter(function (T) { return T.type === x; }), n = L.filter(has).length;
      return '<button type="button" role="tab" aria-selected="' + (x === t) + '" class="md-tab' + (x === t ? ' on' : '') + '" data-mdtype="' + x + '" style="--tc:' + TYPE_COLOR[x] + '">' + x + '<small>' + n + '/' + L.length + '</small></button>';
    }).join('') + '</div>';
    var rows = TYPE_TIERS.map(function (G) {
      var L = TT.filter(function (T) { return T.type === t && T.tier === G.k; }), cur = L[0].prog();
      return '<div class="md-row"><h4>' + t + '系' + G.n + ' <small>' + (G.lv ? 'LV' + G.lv + ' 以上的' : '') + t + '属性精灵：现在 ' + cur + ' 种</small></h4><div class="md-grid">' + L.map(function (T) { return card(T, has(T) || cur >= T.need ? '' : '还差 ' + (T.need - cur) + ' 种'); }).join('') + '</div></div>';
    }).join('');
    var nT = TT.filter(has).length;
    $('pg-explore').innerHTML = exHead('授勋馆里记录着荆楚号上所有的称号。已经获得的称号可以在右上角的名字菜单里佩戴。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="medal-back">‹ 返回学院部</button><b>黄冈 · 授勋馆</b><span class="hint">已获得 ' + got + ' / ' + all + '</span></div>' +
      milHTML() + sec('剧情与探索', grp('story')) + sec('等级', grp('lv')) + sec('排位赛季 S1', grp('season'), '每达到一个新段位获得一个。') +
      '<section class="md-sec"><h3>属性称号 <small>' + nT + ' / ' + TT.length + '</small></h3><p class="hint">按精灵的种类数计算：同一条进化线的精灵算 1 种，有两个属性的精灵两个属性都算。</p>' + tabs + rows + '</section>';
  }
  function milHTML() {
    var r = milRank(), top = r >= RANKS_MIL.length - 1, c = MIL_COST[r], xp = acc.meritXp || 0;
    return '<section class="mil"><div class="mil-badge"><small>军衔</small><b>' + milName() + '</b></div><div class="mil-tx">' +
      '<p>功勋点 <b>' + fmt(acc.merit || 0) + '</b> · 功勋经验 <b>' + fmt(xp) + '</b>' + (top ? '' : ' / ' + fmt(c)) + '</p>' +
      (top ? '<p class="hint">已经是最高军衔了。</p>' : '<div class="exp-bar"><i style="width:' + Math.min(100, xp / c * 100) + '%"></i></div><p class="hint">下一级：' + RANKS_MIL[r + 1] + '（晋升消耗 ' + fmt(c) + ' 功勋经验）。每获得一个称号都会得到功勋点，同时得到等额的功勋经验。</p>') +
      '<p class="mil-path">' + MIL_TIERS.map(function (t, ti) { var cur = MIL_TIER_OF[r]; return '<span class="' + (ti < cur ? 'past' : ti === cur ? 'cur' : '') + '">' + (ti === cur ? RANKS_MIL[r] : Array.isArray(t) ? (ti === 0 ? '士兵' : t[0]) : t) + '</span>'; }).join('<i>›</i>') + '</p></div>' +
      (top ? '' : '<button type="button" class="btn primary" data-promote="1"' + (xp >= c ? '' : ' disabled') + '>晋升</button>') + '</section>';
  }
  function renderNursery() {
    var cards = nurseryCards();
    $('pg-explore').innerHTML = exHead('精灵保育仓有 3 个孵化槽。把精元放进去，过一段时间就会孵化出精灵（叶子喵的精元要 8 小时）。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="nursery-back">‹ 返回精灵保育区</button><b>神农架 · 精灵保育仓</b></div>' + nurseryBody(cards);
    nurseryTick();
  }
  function nurseryCards() {
    var N = nursery(), ess = MAT_ORDER.filter(function (k) { return MATS[k].hatch && acc.items[k] > 0; });
    return N.slots.map(function (x, i) {
      if (!x) return '<article class="farm-plot"><b>孵化槽 ' + (i + 1) + '</b><p class="hint">空着</p>' + (ess.length ? '<div class="farm-acts">' + ess.map(function (k) { return '<button type="button" class="btn" data-incub="' + i + '|' + k + '">放入' + itemName(k) + '</button>'; }).join('') + '</div>' : '<p class="hint">没有可以孵化的精元。</p>') + '</article>';
      var H_ = MATS[x.k].hatch, left = hatchLeft(x), nm = form({ sid: H_.sid, lv: H_.lv }).name;
      return '<article class="farm-plot' + (left ? ' grow' : ' ready') + '"><b>孵化槽 ' + (i + 1) + ' · ' + itemName(x.k) + '</b>' +
        (left ? '<p class="hint">还要 <span data-hatchleft="' + i + '">' + farmLeftText({ t: x.t, seed: null, _ms: left }) + '</span>，会诞生一只' + esc(nm) + '。</p>' : '<p class="hint">精元在发光……可以孵化了！</p><div class="farm-acts"><button type="button" class="btn primary" data-hatch="' + i + '">孵化</button></div>') + '</article>';
    }).join('');
  }
  // 孵化面板的内容（保育仓页面和基地里的精元转化仪共用，孵化槽是同一套，2026-11-01）
  function nurseryBody(cards) { return stockBar('精元', MAT_ORDER.filter(function (k) { return MATS[k].hatch; })) + '<div class="farm-plots">' + cards + '</div>'; }
  function nurseryInPanel() { return ex.view === 'home' && ex.bpanel === 'nursery'; }
  function nurseryRefresh() { if (nurseryInPanel()) renderHome(); else if (ex.view === 'nursery') renderNursery(); }
  function nurseryTick() {
    clearInterval(ex.farmTick);
    ex.farmTick = setInterval(function () {
      if ((ex.view !== 'nursery' && !nurseryInPanel()) || !document.querySelector('.farm-plots')) { clearInterval(ex.farmTick); return; }
      var flip = false;
      nursery().slots.forEach(function (x, i) { if (!x) return; var el = document.querySelector('[data-hatchleft="' + i + '"]'), left = hatchLeft(x); if (!left && el) flip = true; else if (el) el.textContent = farmLeftText({ _ms: left }); });
      if (flip) nurseryRefresh();
    }, 1000);
  }
  function nurseryPut(i, k) {
    var N = nursery(); if (i < 0 || i >= NURSERY_N || N.slots[i] || !MATS[k] || !MATS[k].hatch || !(acc.items[k] > 0)) return;
    txRun('hatch', { a: 'put', i: i, k: k }, function () {   // 走交易（grow.js）：放入的时间由服务器记
      toast('把「' + itemName(k) + '」放进了孵化槽 ' + (i + 1) + '，' + growText(MATS[k].hatch.min) + '后可以孵化。');
      nurseryRefresh();
    });
  }
  function nurseryHatch(i) {
    var N = nursery(), x = N.slots[i]; if (!x || hatchLeft(x)) return;
    txRun('hatch', { a: 'hatch', i: i }, function (res) {   // 走交易（grow.js）：孵出的精灵由服务器生成
      var m = mon(res.u);
      nurseryRefresh(); renderRes && renderRes();
      if (m) hatchReveal(m, res);
    });
  }
  // 孵化完成的展示面板（2026-11-02）
  function hatchReveal(m, res) {
    var old = $('hatch-dlg'); if (old) old.remove();
    var f = form(m), s = SPMAP[m.sid] || {}, iv = ivOf(m);
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'hatch-dlg';
    d.innerHTML = '<div class="soc-box hatch-box' + (res.shiny ? ' shiny' : '') + '" role="dialog" aria-modal="true" aria-label="孵化完成"><span class="tape l"></span><span class="tape r"></span><span class="step">孵化完成</span>' +
      '<h2>诞生了' + (res.shiny ? '异色的' : '') + esc(f.name) + '！</h2>' +
      '<div class="hatch-pic"><i class="hatch-glow"></i><img src="' + f.img + '" alt="' + esc(f.name) + '"></div>' +
      '<div class="hatch-tags">' + (s.types || []).map(function (t) { return '<span class="hatch-t" style="--tc:' + (TYPE_COLOR[t] || '#888') + '">' + t + '</span>'; }).join('') + '<span>LV' + m.lv + '</span><span>' + esc(m.nat || '') + '性格</span>' + (s.ability ? '<span>特性 ' + esc(s.ability.n) + '</span>' : '') + '</div>' +
      (iv ? '<p class="hatch-iv">天赋：' + STAT_KEYS.map(function (k) { return BASE_NAME[k] + ' <b>' + iv[k] + '</b>'; }).join('　') + '</p>' : '') +
      '<p class="hint">' + (res.added ? '已加入' + esc(tName(acc.active)) + '。' : '配队已满，已收入精灵仓库。') + '</p>' +
      '<div class="soc-foot"><button type="button" class="btn primary" data-hatchx="1">好的</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-hatchx]')) d.remove(); });
  }

  /* ---------- 冶炼坊：黄石 · 冶炼工坊 ----------
   * 加强装置吃星砂，华为装置吃圣晶石，200hp药水吃药草。商城不卖这三样。 */
  var FORGE = GROW.FORGE;   // 配方在 js/engine/grow.js
  var FORGE_Q = GROW.FORGE_Q;
  /* 特产互换（2026-10-19）：芙罗拉玉、不化水滴、火山灰烬、闪电球体、永久冻土之间互换，每 GX_IN 个换 GX_OUT 个
   * （换出比换入少，避免来回换刷数量） */
  var GX_KEYS = GROW.GX_KEYS, GX_IN = GROW.GX_IN, GX_OUT = GROW.GX_OUT;
  var GX_SRC = ['m_mcry'].concat(GX_KEYS);   // 马亚尔晶体（2026-10-19）：只能换出去，每 10 个换 10 个
  function gxOut(k) { return k === 'm_mcry' ? 10 : GX_OUT; }
  function gxState() {
    if (GX_SRC.indexOf(ex.gxFrom) < 0) ex.gxFrom = GX_SRC.filter(function (k) { return (acc.items[k] || 0) >= GX_IN; })[0] || GX_KEYS[0];
    if (GX_KEYS.indexOf(ex.gxTo) < 0 || ex.gxTo === ex.gxFrom) ex.gxTo = GX_KEYS.filter(function (k) { return k !== ex.gxFrom; })[0];
    var max = Math.min(FORGE_Q, Math.floor((acc.items[ex.gxFrom] || 0) / GX_IN)), q = Math.max(1, Math.min(FORGE_Q, shopQty.gx || 1));
    if (q > max && max > 0) q = max;
    return { from: ex.gxFrom, to: ex.gxTo, max: max, q: q };
  }
  function gxHTML() {
    var g = gxState(), have = acc.items[g.from] || 0, ok = g.max >= g.q;
    function chips(sel, attr, skip, list) { return (list || GX_KEYS).map(function (k) { return '<button type="button" class="btn ' + (k === sel ? 'primary' : 'ghost') + ' gx-chip" data-' + attr + '="' + k + '"' + (k === skip ? ' disabled' : '') + '>' + itemName(k) + ' <small>' + (acc.items[k] || 0) + '</small></button>'; }).join(''); }
    return '<article class="shop-it gx-card"><span class="tape r"></span>' + H.itemIcon(g.to) + '<div class="si-txt"><b>特产互换</b><p class="hint">各星球特产之间可以互相转换：每 ' + GX_IN + ' 个换成 ' + GX_OUT + ' 个；马亚尔晶体每 10 个换成 10 个任意特产。</p>' +
      '<p class="gxc-row"><span>拿出</span>' + chips(g.from, 'gxfrom', null, GX_SRC) + '</p><p class="gxc-row"><span>换成</span>' + chips(g.to, 'gxto', g.from) + '</p>' +
      '<p class="forge-need">消耗 ' + itemName(g.from) + ' <b class="' + (have >= GX_IN * g.q ? 'ok' : 'short') + '">' + have + '</b>/' + GX_IN * g.q + ' → 得到 ' + itemName(g.to) + ' ×' + gxOut(g.from) * g.q + '</p></div>' +
      '<div class="si-buy"><span class="si-price">转换</span><div class="qty"><button type="button" class="btn ghost" data-gxq="-1" aria-label="减少"' + (g.q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + g.q + '</span><button type="button" class="btn ghost" data-gxq="1" aria-label="增加"' + (g.q >= Math.min(FORGE_Q, Math.max(1, g.max)) ? ' disabled' : '') + '>+</button></div>' +
      '<button type="button" class="btn primary" data-gxgo="1"' + (ok ? '' : ' disabled') + '>' + (ok ? '转换' : '数量不足') + '</button></div></article>';
  }
  function gxGo() {
    var g = gxState(); if (g.max < 1 || g.from === g.to) return;
    var n = Math.min(g.q, g.max);
    txRun('gx', { from: g.from, to: g.to, n: n }, function () {   // 走交易（grow.js）
      shopQty.gx = 1;
      toast('转换成功：' + itemName(g.from) + ' ×' + GX_IN * n + ' → ' + itemName(g.to) + ' ×' + gxOut(g.from) * n + '，已放入储存箱。');
      renderForge();
    });
  }
  function forgeOf(id) { for (var i = 0; i < FORGE.length; i++) if (FORGE[i].id === id) return FORGE[i]; return null; }
  function forgeMax(r) {
    var n = FORGE_Q;
    for (var k in r.need) n = Math.min(n, Math.floor((acc.items[k] || 0) / r.need[k]));
    return Math.max(0, n);
  }
  function forgeOutText(r, n) {
    var a = []; n = n || 1;
    for (var k in r.out) a.push(itemName(k) + ' ×' + r.out[k] * n);
    return a.join('、');
  }
  function stockBar(title, keys) {
    return '<div class="forge-stock"><span class="tape l"></span><b>' + title + '</b>' + keys.map(function (k) {
      return '<span>' + itemName(k) + ' <b>' + (acc.items[k] || 0) + '</b></span>';
    }).join('') + '</div>';
  }
  // 2026-11-01：冶炼坊按种类分栏（一次只显示一个种类），不再列出持有的材料
  var FORGE_CAT = [['cap', '捕捉装置', ['cap2', 'cap3']], ['med', '药剂', ['pot100', 'pot200', 'pp10', 'pp20', 'antidote']], ['ess', '精元', ['lcEssence']], ['tool', '道具', null], ['gx', '特产互换', []]];
  function forgeCatOf(r) { for (var i = 0; i < FORGE_CAT.length; i++) if (FORGE_CAT[i][2] && FORGE_CAT[i][2].indexOf(r.id) >= 0) return FORGE_CAT[i][0]; return 'tool'; }   // 没归类的配方都算「道具」
  function renderForge() {
    if (!FORGE_CAT.some(function (c) { return c[0] === ex.fgCat; })) ex.fgCat = 'cap';
    var tabs = '<div class="fparts forge-tabs" role="tablist">' + FORGE_CAT.map(function (c) { var on = c[0] === ex.fgCat; return '<button type="button" role="tab" class="tab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-fgcat="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
    var cards = ex.fgCat === 'gx' ? gxHTML() : FORGE.filter(function (r) { return forgeCatOf(r) === ex.fgCat; }).map(function (r) {
      var max = forgeMax(r), q = Math.max(1, Math.min(FORGE_Q, shopQty['fg-' + r.id] || 1));
      if (q > max && max > 0) q = max;
      var ok = max >= q;
      var outK = Object.keys(r.out)[0];
      var needs = Object.keys(r.need).map(function (k) {
        var have = acc.items[k] || 0, ask = r.need[k] * q;
        return itemName(k) + ' <b class="' + (have >= ask ? 'ok' : 'short') + '">' + have + '</b>/' + ask;
      }).join(' · ');
      return '<article class="shop-it"><span class="tape r"></span>' + H.itemIcon(outK) + '<div class="si-txt"><b>' + forgeOutText(r, 1) + '</b><p class="hint">' + esc(shortD(ITEMS[outK] || USE_ITEMS[outK] || CROPS[outK] || MATS[outK])) + '</p>' +
        '<p class="forge-need">消耗 ' + needs + '</p><p class="si-own">持有 <b>' + (acc.items[outK] || 0) + '</b></p></div>' +
        '<div class="si-buy"><span class="si-price">合成</span>' +
        '<div class="qty"><button type="button" class="btn ghost" data-fq="' + r.id + '|-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-fq="' + r.id + '|1" aria-label="增加"' + (q >= Math.min(FORGE_Q, Math.max(1, max)) ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="btn primary" data-smelt="' + r.id + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '合成' : '材料不足') + '</button></div></article>';
    }).join('');
    $('pg-explore').innerHTML = exHead('') +
      '<div class="crumb"><button type="button" class="btn ghost" id="forge-back">‹ 返回冶炼工坊</button><b>黄石 · 冶炼坊</b></div>' +
      tabs + '<div class="shop-grid">' + cards + '</div>';
  }
  function forgeCraft(id) {
    var r = forgeOf(id); if (!r) return;
    var max = forgeMax(r), n = Math.max(1, Math.min(max, shopQty['fg-' + id] || 1));
    if (!max || n < 1) return;
    txRun('forge', { id: id, n: n }, function () {   // 走交易（grow.js）
      shopQty['fg-' + id] = 1;
      toast('合成成功：' + forgeOutText(r, n) + '，已放入储存箱。');
      renderForge();
    });
  }

  /* ---------- 太空种植园：恩施 · 生态舱 ----------
   * 四块田。种下 1 颗药草种子，8 小时后收获药草 ×50，种子退回。离开游戏也照常计时。 */
  function farmN() { return GROW.farmN(acc); }   // 基础 4 块田，种子商店能再买 4 块
  function farm() {   // 只读：田由交易改（js/engine/grow.js）
    var F = acc.farm && Array.isArray(acc.farm.plots) ? acc.farm : { plots: [] }, n = farmN(), out = [];
    for (var i = 0; i < n; i++) { var p = F.plots[i]; out.push(p && SEEDS[p.seed] && p.t > 0 ? p : null); }
    return { plots: out, extra: F.extra | 0 };
  }
  function farmReady(p) { return !!(p && Date.now() - p.t >= SEEDS[p.seed].min * 60000); }
  function farmLeftText(p) {
    var sec = p._ms != null ? Math.ceil(p._ms / 1000) : Math.max(0, Math.ceil((SEEDS[p.seed].min * 60000 - (Date.now() - p.t)) / 1000));   // _ms：直接给剩余毫秒（精灵保育仓用）
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ' 小时 ' : '') + (h || m ? m + ' 分 ' : '') + s + ' 秒';
  }
  /* 2026-11-04：种植园改成和基地一样的场景（背景 images/base/farm.jpg），左边是功能菜单，左下角「前往基地」。
   * 6 块田按背景图摆：t 是田的中心，b 是田上方的气泡（正好盖住原图里手套图标的位置）；还没开的田显示锁。
   * 田的顺序就是存档里 acc.farm.plots 的顺序：前 4 块是基础的，后 2 块是种子商店扩建的（2026-11-04 起一共 6 块）。 */
  var FARM_POS = [
    { t: [41.1, 61.7], b: [40.9, 38.5] }, { t: [59.6, 61.7], b: [58.7, 38.5] }, { t: [75.5, 61.7], b: [75.9, 38.5] },
    { t: [33.6, 73.9], b: [33.4, 50.5] }, { t: [52.0, 73.9], b: [52.0, 50.5] }, { t: [70.5, 73.9], b: [70.9, 50.5] }
  ];
  var SPROUT_SVG = '<svg class="it-ic" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#23422b" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M32 58V30" fill="none"/><path d="M32 38c-2-10-10-14-20-13 1 10 8 15 20 13z" fill="#7cc95a"/><path d="M32 31c2-11 11-16 22-15-1 11-10 16-22 15z" fill="#5fb548"/></g></svg>';
  function farmReadyN() { if (!acc || !farmOpen()) return 0; return farm().plots.filter(farmReady).length; }
  function farmClock(p) {   // 气泡下面的短倒计时：2:05:33
    var sec = Math.max(0, Math.ceil((SEEDS[p.seed].min * 60000 - (Date.now() - p.t)) / 1000)), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function farmState(i, F) { var p = F.plots[i]; return i >= farmN() ? 'lock' : !p ? 'empty' : farmReady(p) ? 'ready' : 'grow'; }
  function farmPlotHTML(i, F) {
    F = F || farm(); var P = FARM_POS[i], st = farmState(i, F), p = F.plots[i], S = p && SEEDS[p.seed];
    var ic = st === 'lock' ? '<span class="fp-sym">🔒</span>' : st === 'empty' ? '<span class="fp-sym">＋</span>' : H.itemIcon(st === 'ready' ? S.crop : p.seed);
    var lab = st === 'lock' ? '扩建' : st === 'empty' ? '种植' : st === 'ready' ? '收获' : farmClock(p);
    var tip = '田 ' + (i + 1) + (st === 'lock' ? '：还没开，可以在种子商店扩建' : st === 'empty' ? '：空着，点一下种植' : st === 'ready' ? ' · ' + itemName(p.seed) + '：成熟了，点一下收获「' + itemName(S.crop) + '」×' + S.yield : ' · ' + itemName(p.seed) + '：还要 ' + farmLeftText(p));
    return '<div class="fp fp-' + st + '" data-fp="' + i + '">' +
      '<button type="button" class="fp-soil" data-fpi="' + i + '" style="left:' + P.t[0] + '%;top:' + P.t[1] + '%" aria-label="' + esc(tip) + '">' + (st === 'grow' || st === 'ready' ? '<span class="fp-crop' + (st === 'ready' ? ' ripe' : '') + '">' + (st === 'ready' ? H.itemIcon(S.crop) : SPROUT_SVG) + '</span>' : '') + '</button>' +
      '<button type="button" class="fp-bub' + (P.b[1] < 45 ? ' up' : '') + '" data-fpi="' + i + '" style="left:' + P.b[0] + '%;top:' + P.b[1] + '%" title="' + esc(tip) + '" aria-label="' + esc(tip) + '"><span class="fp-ic">' + ic + '</span><span class="fp-lab" data-fpclock="' + i + '">' + lab + '</span></button></div>';
  }
  // 左边的功能菜单（样式和基地的一样）
  function farmSideHTML() {
    var F = farm(), nEmpty = F.plots.filter(function (p, i) { return !p && i < farmN(); }).length, nReady = F.plots.filter(farmReady).length, nSeed = SEED_ORDER.reduce(function (t, k) { return t + (acc.items[k] || 0); }, 0);
    var it = function (attr, ic, t, sub, badge) { return '<button type="button" class="bs-it" ' + attr + ' title="' + t + '"><span class="bs-ic" aria-hidden="true">' + ic + (badge ? '<i class="bs-badge">' + badge + '</i>' : '') + '</span><span class="bs-t"><b>' + t + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; };
    var hid = false; try { hid = localStorage.getItem('hs-fside-hide') === '1'; } catch (e) {}
    return '<div class="base-side farm-side' + (hid ? ' hid' : '') + '"><button type="button" class="bs-tog" data-bstog="hs-fside-hide" aria-label="' + (hid ? '展开' : '收起') + '种植园菜单" title="' + (hid ? '展开' : '收起') + '"><span aria-hidden="true">◀</span></button><div class="bs-list">' +
      it('data-fharvest="1"', '🧺', '一键收获', nReady ? nReady + ' 块成熟了' : '还没有成熟的', nReady) +
      it('data-fpanel="sowall"', '🌱', '一键种植', nEmpty ? '空田 ' + nEmpty + ' 块' : '没有空田') +
      it('data-fpanel="shop"', '🛍', '种子商店', '能量 ' + fmt(acc.energy)) +
      it('data-fpanel="stock"', '📦', '作物仓库', '种子 ' + nSeed + ' 颗') + '</div></div>';
  }
  // 场景左下角的「前往基地 / 前往种植园」（有东西可以收的时候带红点）
  function sceneGoHTML(to) {
    if (to === 'farm') return farmOpen() ? '<button type="button" class="scene-go" data-gofarm="1" title="前往种植园"><span class="sg-ic" aria-hidden="true">🌱</span><b>前往种植园</b>' + (farmReadyN() ? '<i class="sg-dot" aria-label="有成熟的作物"></i>' : '') + '</button>' : '';
    var dot = homeOpen() && home().mons.some(homeFull);
    return homeOpen() ? '<button type="button" class="scene-go" data-gohome="1" title="前往基地"><span class="sg-ic" aria-hidden="true">🏠</span><b>前往基地</b>' + (dot ? '<i class="sg-dot" aria-label="有精灵可以收获经验"></i>' : '') + '</button>' : '';
  }
  function renderFarm() {
    var F = farm(), plots = FARM_POS.map(function (P, i) { return farmPlotHTML(i, F); }).join('');
    $('pg-explore').innerHTML = exHead('点田上方的气泡种植、收获。药草、活力花 8 小时成熟（各 ×50，收获时 20% 掉落 1 颗种子）；水稻 12 小时成熟（米饭 ×250，种子退回）。离开游戏也照常计时。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="farm-back">‹ 返回生态舱</button><b class="home-name">太空种植园</b><span class="hint">恩施 · 生态舱 · ' + farmN() + ' / ' + FARM_POS.length + ' 块田</span></div>' +
      '<div class="base-stage"><div class="home-room farm-room" id="farm-room"><img class="home-bg" src="images/base/farm.jpg" alt="太空种植园">' + plots + farmSideHTML() + sceneGoHTML('home') + '</div></div>' +
      (ex.fpanel ? farmPanelHTML(ex.fpanel) : '');
    clearInterval(ex.farmTick);
    ex.farmTick = setInterval(function () {
      if (ex.view !== 'farm' || !$('farm-room')) { clearInterval(ex.farmTick); return; }
      var F2 = farm(), flip = false;
      F2.plots.forEach(function (p, i) {
        if (!p || i >= farmN()) return;
        var el = document.querySelector('[data-fpclock="' + i + '"]'), w = document.querySelector('#farm-room .fp[data-fp="' + i + '"]');
        if (farmReady(p)) { if (w && !w.classList.contains('fp-ready')) { w.outerHTML = farmPlotHTML(i, F2); flip = true; } }
        else if (el) el.textContent = farmClock(p);
      });
      if (flip) farmSideRefresh();
    }, 1000);
  }
  // 只更新改动的那几块田和左边菜单，不整页重画
  function farmRefresh(list) {
    if (ex.view !== 'farm' || !$('farm-room')) return;
    var F = farm();
    (list || FARM_POS.map(function (P, i) { return i; })).forEach(function (i) { var w = document.querySelector('#farm-room .fp[data-fp="' + i + '"]'); if (w) w.outerHTML = farmPlotHTML(i, F); });
    farmSideRefresh();
    var hn = document.querySelector('#pg-explore .crumb .hint'); if (hn) hn.textContent = '恩施 · 生态舱 · ' + farmN() + ' / ' + FARM_POS.length + ' 块田';
  }
  function farmSideRefresh() { var sd = document.querySelector('#farm-room .farm-side'); if (sd) sd.outerHTML = farmSideHTML(); }
  /* 种植园的弹窗：sow:i 给一块田选种子；sowall 一键种植；shop 种子商店；stock 作物仓库 */
  function farmPanel(k) {
    ex.fpanel = k || null;
    var old = document.querySelector('#pg-explore .bp-dlg'), top = old ? old.scrollTop : 0, h = k ? farmPanelHTML(k) : '';
    if (old) old.remove();
    if (h) { $('pg-explore').insertAdjacentHTML('beforeend', h); var d = document.querySelector('#pg-explore .bp-dlg'); if (d && old) d.scrollTop = top; }
  }
  function farmPanelHTML(k) {
    var body = '', ttl = '', cls = '', owned = SEED_ORDER.filter(function (s0) { return acc.items[s0] > 0; });
    var seedBtn = function (attr, s0, extra) { var S = SEEDS[s0]; return '<button type="button" class="fs-seed" ' + attr + '>' + H.itemIcon(s0) + '<span><b>' + esc(itemName(s0)) + '</b><small>持有 ' + acc.items[s0] + ' 颗 · ' + growText(S.min) + '成熟，收获「' + esc(itemName(S.crop)) + '」×' + S.yield + (extra ? ' · ' + extra : '') + '</small></span></button>'; };
    var noSeed = '<p class="hint">没有可以种的种子。药草种子、活力花种子在种子商店用能量买；水稻种子在芙罗拉星击败野生精灵时有 10% 的概率掉落。</p><div class="soc-foot" style="justify-content:flex-start"><button type="button" class="btn primary" data-fpanel="shop">去种子商店</button></div>';
    if (k.indexOf('sow:') === 0) {
      var i = +k.slice(4), F = farm(); if (farmState(i, F) !== 'empty') return '';
      ttl = '田 ' + (i + 1) + ' · 种点什么？';
      body = owned.length ? '<div class="fs-list">' + owned.map(function (s0) { return seedBtn('data-fsow="' + i + '|' + s0 + '"', s0); }).join('') + '</div>' : noSeed;
    } else if (k === 'sowall') {
      var empty = farm().plots.filter(function (p, j) { return !p && j < farmN(); }).length;
      ttl = '一键种植';
      body = !empty ? '<p class="hint">没有空着的田。</p>' : owned.length ? '<p class="hint">把空着的 ' + empty + ' 块田都种上同一种种子（种子不够时能种几块种几块）。</p><div class="fs-list">' + owned.map(function (s0) { return seedBtn('data-fsowall="' + s0 + '"', s0, '能种 ' + Math.min(empty, acc.items[s0]) + ' 块'); }).join('') + '</div>' : noSeed;
    } else if (k === 'shop') { ttl = '种子商店'; cls = ' wide'; body = seedShopBody(); }
    else if (k === 'stock') {
      ttl = '作物仓库';
      body = stockBar('种子', SEED_ORDER) + stockBar('作物', CROP_ORDER) + '<p class="hint">药草：黄石 · 冶炼坊 1 份合成 100hp药水、2 份合成 200hp药水。活力花卉：3 朵炼成 10PP 药水、5 朵炼成 20PP 药水。米饭：500 粒在冶炼坊盛成一碗饭，可以在庞贝星熔岩原引来米饭火鸡。</p>';
    } else return '';
    return '<div class="soc-dlg bp-dlg"><div class="soc-box bp-box' + cls + '" role="dialog" aria-modal="true" aria-label="' + ttl + '"><span class="tape l"></span><span class="tape r"></span><h2>' + ttl + '</h2>' + body +
      '<div class="soc-foot"><button type="button" class="btn primary" data-bpx="1">关闭</button></div></div></div>';
  }
  function farmPlotClick(i) {
    var F = farm(), st = farmState(i, F), p = F.plots[i];
    if (st === 'lock') { farmPanel('shop'); toast('这块田还没开，可以在种子商店的「额外种植栏位」扩建。'); return; }
    if (st === 'empty') { farmPanel('sow:' + i); return; }
    if (st === 'ready') { farmHarvest(i); return; }
    toast('田 ' + (i + 1) + ' 种着「' + itemName(p.seed) + '」，还要 ' + farmLeftText(p) + '，收获「' + itemName(SEEDS[p.seed].crop) + '」×' + SEEDS[p.seed].yield + '。');
  }
  function farmPlant(i, seed, quiet, done) {
    var F = farm();
    if (i < 0 || i >= farmN() || F.plots[i] || !SEEDS[seed] || !(acc.items[seed] > 0)) { if (done) done(false); return; }
    txRun('farm', { a: 'plant', i: i, seed: seed }, function () {   // 走交易（grow.js）：种下的时间由服务器记
      if (!quiet) toast('在田 ' + (i + 1) + ' 种下了「' + itemName(seed) + '」，' + growText(SEEDS[seed].min) + '后可以收获。');
      if (ex.view === 'farm') farmRefresh([i]); if (done) done(true);
    }, function (err) { if (err) toast(err); if (done) done(false); });
  }
  function farmHarvest(i, quiet, done) {
    var F = farm(), p = F.plots[i];
    if (!p || !farmReady(p)) { if (done) done(null); return; }
    txRun('farm', { a: 'harvest', i: i }, function (res) {   // 走交易（grow.js）
      var S0 = SEEDS[res.seed] || {};
      if (!quiet) toast('收获了「' + itemName(res.crop) + '」×' + res.n + '，' + (S0.back >= 1 ? '种子已退回。' : res.back ? '还掉落了 1 颗「' + itemName(res.seed) + '」！' : '这次没有掉落种子。'));
      if (ex.view === 'farm') {
        farmRefresh([i]);
        var w = document.querySelector('#farm-room .fp[data-fp="' + i + '"] .fp-soil'); if (w) { w.classList.remove('pop'); void w.offsetWidth; w.classList.add('pop'); }
      }
      if (done) done(res);
    }, function (err) { if (err) toast(err); if (done) done(null); });
  }
  function farmHarvestAll() {
    var list = []; farm().plots.forEach(function (p, i) { if (farmReady(p)) list.push(i); });
    if (!list.length) { toast('还没有成熟的作物。'); return; }
    var left = list.length, got = {}, seeds = {};
    list.forEach(function (i) {
      farmHarvest(i, true, function (res) {
        if (res) { got[res.crop] = (got[res.crop] || 0) + res.n; if (res.back) seeds[res.seed] = (seeds[res.seed] || 0) + 1; }
        if (--left) return;
        var g = Object.keys(got).map(function (k) { return '「' + itemName(k) + '」×' + got[k]; }), sd = Object.keys(seeds).filter(function (k) { return (SEEDS[k] || {}).back < 1; }).map(function (k) { return '「' + itemName(k) + '」×' + seeds[k]; });
        if (g.length) toast('收获了 ' + g.join('、') + (sd.length ? '，还掉落了 ' + sd.join('、') : '') + '。');
      });
    });
  }
  function farmSowAll(seed) {
    var empty = []; farm().plots.forEach(function (p, i) { if (!p && i < farmN()) empty.push(i); });
    var n = Math.min(empty.length, acc.items[seed] || 0); if (!n) return;
    farmPanel(null);
    var left = n, ok = 0;
    empty.slice(0, n).forEach(function (i) { farmPlant(i, seed, true, function (y) { if (y) ok++; if (!--left && ok) toast('种下了 ' + ok + ' 块「' + itemName(seed) + '」，' + growText(SEEDS[seed].min) + '后可以收获。'); }); });
  }

  /* ---------- 种子商店：恩施 · 生态舱（交易 seedShop，js/engine/grow.js）：药草种子、活力花种子各 100 能量，另卖额外的种植栏位 ---------- */
  function seedShopBody() {
    var cards = GROW.SEED_SHOP.map(function (k) {
      var q = shopQty['sd-' + k] || 1, cost = GROW.SEED_PRICE * q, ok = acc.energy >= cost, S = SEEDS[k];
      return '<article class="shop-it"><span class="tape r"></span>' + H.itemIcon(k) + '<div class="si-txt"><b>' + esc(S.name) + '</b><p class="hint">' + growText(S.min) + '成熟，收获「' + itemName(S.crop) + '」×' + S.yield + '；收获时有 ' + Math.round(S.back * 100) + '% 的概率掉落 1 颗种子。</p>' +
        '<p class="si-own">持有 <b>' + (acc.items[k] || 0) + '</b></p></div>' +
        '<div class="si-buy"><span class="si-price">' + fmt(GROW.SEED_PRICE) + ' <small>能量</small></span>' +
        '<div class="qty"><button type="button" class="btn ghost" data-sdq="' + k + '|-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-sdq="' + k + '|1" aria-label="增加"' + (q >= GROW.SEED_SHOP_MAX ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="btn primary" data-sdbuy="' + k + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '购买 · ' + fmt(cost) : '能量不足') + '</button></div></article>';
    }).join('');
    var ext = farm().extra, price = GROW.PLOT_PRICE[ext], full = ext >= GROW.FARM_EXTRA_MAX || !price;
    cards += '<article class="shop-it"><span class="tape r"></span><svg class="it-ic" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#23222b" stroke-width="2.5" stroke-linejoin="round"><path d="M6 44l26-12 26 12-26 12z" fill="#b98a5a"/><path d="M14 44l18-8M22 48l18-8M30 52l18-8" stroke="#8a6440" stroke-width="2"/><path d="M32 8v18M23 17h18" stroke="#4caf50" stroke-width="5" stroke-linecap="round"/></g></svg>' +
      '<div class="si-txt"><b>额外种植栏位</b><p class="hint">太空种植园多开一块田。基础 ' + GROW.FARM_N + ' 块，最多再开 ' + GROW.FARM_EXTRA_MAX + ' 块，每块越来越贵。</p><p class="si-own">现在 <b>' + farmN() + '</b> 块田</p></div>' +
      '<div class="si-buy"><span class="si-price">' + (full ? '已满' : fmt(price) + ' <small>能量</small>') + '</span>' +
      '<button type="button" class="btn primary" data-sdbuy="plot"' + (!full && acc.energy >= price ? '' : ' disabled') + '>' + (full ? '已经扩到最多了' : acc.energy >= price ? '购买 · ' + fmt(price) : '能量不足') + '</button></div></article>';
    return '<div class="shop-bal"><span class="tape l"></span>当前能量 <b>' + fmt(acc.energy) + '</b></div><div class="shop-grid">' + cards + '</div>';
  }
  function renderSeedShop() {
    $('pg-explore').innerHTML = exHead('生态舱的种子商店：用能量买药草种子（绿色）和活力花种子（蓝色），还能给太空种植园多开几块田。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="farm-back">‹ 返回生态舱</button><b>恩施 · 种子商店</b><button type="button" class="btn" data-farm="1">太空种植园</button></div>' + seedShopBody();
  }
  // 买完东西：在种植园里就刷新弹窗和田，在种子商店页就重画商店
  function seedShopRefresh() { if (ex.view === 'farm') { farmPanel('shop'); farmRefresh(); } else renderSeedShop(); }
  function seedShopClick(b) {
    if (b.dataset.sdq) { var a = b.dataset.sdq.split('|'), key = 'sd-' + a[0]; shopQty[key] = Math.max(1, Math.min(GROW.SEED_SHOP_MAX, (shopQty[key] || 1) + +a[1])); seedShopRefresh(); return; }
    var k = b.dataset.sdbuy;
    if (k === 'plot') { txRun('seedShop', { k: 'plot' }, function (r) { renderRes(); seedShopRefresh(); toast('太空种植园多开了一块田，现在一共 ' + r.n + ' 块。消耗 ' + fmt(r.cost) + ' 能量。'); }); return; }
    var n = shopQty['sd-' + k] || 1;
    txRun('seedShop', { k: k, n: n }, function (r) { shopQty['sd-' + k] = 1; renderRes(); seedShopRefresh(); toast('买到了「' + itemName(r.k) + '」×' + r.n + '，消耗 ' + fmt(r.cost) + ' 能量。'); });
  }

  /* ---------- 茶室（家园）：自定义名字，安排精灵在舱里休息 ---------- */
  var HOME_BASE = 3, HOME_POS = [[20, 88], [47, 84], [73, 70], [34, 66], [60, 60], [88, 92], [8, 70]], HOME_CAP_H = 24;
  // 茶室能同时展示几只：基础 3 只，茶室商店的「茶室精灵容量 +1」每买一次多 1 只（最多买 4 次）
  function homeMax() { return HOME_BASE + Math.min(4, (acc && acc.home && acc.home.cap) || 0); }
  /* 茶室音乐：自己和来拜访的船员在茶室里都会听到（曲子见 js/ui/audio.js）
   * 大厅（默认，和陆羽茶室大厅一样）和地球一开始就有；芙罗拉星是击败普通难度荒芜的奖励 */
  var HOME_BGM = [
    { k: 'base', n: HSTRACK('base'), d: '默认' },   // 2026-11-01：基地默认音乐换成 Base，「大厅」从基地音乐里移除（选过大厅的自动换成基地）
    { k: 'earth', n: HSTRACK('earth'), d: '自动解锁' },
    { k: 'floraGrass', n: HSTRACK('floraGrass'), d: '芙罗拉星挑战路线累计 30 颗星后领取', own: function () { return chalGot(30); } },
    { k: 'floraForest', n: HSTRACK('floraForest'), d: '芙罗拉星挑战路线累计 60 颗星后领取', own: function () { return chalGot(60); } },
    { k: 'floraFallen', n: HSTRACK('floraFallen'), d: '芙罗拉星挑战路线累计 90 颗星后领取', own: function () { return chalGot(90); } },
    { k: 'kbSurface', n: HSTRACK('kbSurface'), d: '坎伯兰星挑战路线累计 30 颗星后领取', own: function () { return chalGot(30, 'kamble'); } },
    { k: 'kbShallow', n: HSTRACK('kbShallow'), d: '坎伯兰星挑战路线累计 60 颗星后领取', own: function () { return chalGot(60, 'kamble'); } },
    { k: 'kbDeep', n: HSTRACK('kbDeep'), d: '坎伯兰星挑战路线累计 90 颗星后领取', own: function () { return chalGot(90, 'kamble'); } }
  ];
  function bgmName(k) { var b = HOME_BGM.filter(function (x) { return x.k === k; })[0]; return b ? b.n : k; }
  function bgmOwned(k) { var b = HOME_BGM.filter(function (x) { return x.k === k; })[0]; return !!b && (!b.own || b.own()); }
  function homeBgm() { var k = acc && acc.home && acc.home.bgm; return k && bgmOwned(k) ? k : 'base'; }
  // 茶室音乐（2026-10-17 改成一个按钮）：点开后列出所有已解锁的曲目，点一首就换上
  function openBgmPicker() {
    var old = $('bgm-dlg'); if (old) old.remove();
    var cur = homeBgm(), own = HOME_BGM.filter(function (b) { return bgmOwned(b.k); }), lock = HOME_BGM.length - own.length;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'bgm-dlg';
    d.innerHTML = '<div class="soc-box bgm-box" role="dialog" aria-modal="true" aria-label="茶室音乐"><span class="tape l"></span><span class="tape r"></span><h2>茶室音乐</h2><p class="hint">选一首放在你的茶室里，来拜访的船员也会听到。</p>' +
      '<ul class="bgm-list">' + own.map(function (b) { var on = b.k === cur; return '<li><button type="button" class="bgm-it' + (on ? ' on' : '') + '" data-bgmset="' + b.k + '" aria-pressed="' + on + '"><span class="bgm-ic" aria-hidden="true">' + (on ? '▶' : '♪') + '</span><b>' + esc(b.n) + '</b><small>' + esc(on ? '正在播放' : b.d) + '</small></button></li>'; }).join('') + '</ul>' +
      (lock ? '<p class="hint">还有 ' + lock + ' 首曲目没有解锁。</p>' : '') +
      '<div class="soc-foot"><button type="button" class="btn primary" data-bgmx="1">关闭</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bgmset]');
      if (b && bgmOwned(b.dataset.bgmset)) { home().bgm = b.dataset.bgmset; save(); bgmScene(); d.remove(); renderExplore(); toast('茶室音乐换成了「' + bgmName(b.dataset.bgmset) + '」，来拜访的船员也会听到。'); return; }
      if (e.target === d || e.target.closest('[data-bgmx]')) d.remove();
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-bgmopen]')) openBgmPicker(); });
  function homeBgmBar() {
    var cur = homeBgm(), n = HOME_BGM.filter(function (b) { return bgmOwned(b.k); }).length;
    return '<div class="hm-bgm"><b>基地音乐</b><button type="button" class="btn bgm-btn" data-bgmopen="1"><span aria-hidden="true">♪</span> ' + esc(bgmName(cur)) + ' <small>（已解锁 ' + n + ' 首）</small></button><span class="hint">你和来拜访的船员在基地里都会听到。</span></div>';
  }
  /* 茶室商店（茶室大厅）
   * auto：7日自律训练装置，装在展示中的精灵身上；每满 1 天自动收回结算经验、再开始下一天，一共 7 天
   * cap：茶室精灵容量 +1，价格依次 2000 / 5000 / 10000 / 20000 能量，最多 4 次 */
  var AUTO_DAYS = 7, DAY_MS = 24 * 3600 * 1000, CAP_PRICE = TX.D.CAP_PRICE;   // 价格在 js/engine/tx.js
  var TEA_SHOP = { auto: { name: '7日自律训练装置', price: TX.D.AUTO_PRICE, d: '装在基地里展示中的一只精灵身上。它每训练满 1 天，就自动收回、结算经验，再开始下一天，一共 7 天。7 天里不用每天回来收精灵。' } };
  // 展示经验：每小时 30 + LV × 6 点，按分钟累计，最多累计 24 小时（离线也照样计时）
  function homeRate(m) { return 30 + m.lv * 6; }
  function homeMins(x) { return Math.max(0, Math.min(HOME_CAP_H * 60, Math.floor((Date.now() - x.t) / 60000))); }
  function homeExp(x) { var m = mon(x.u); return m ? Math.max(0, Math.floor(homeMins(x) * homeRate(m) / 60) - (x.st | 0)) : 0; }   // 2026-11-03：减去被好友偷走的（x.st，收获后清零）
  function durText(min) { var h = Math.floor(min / 60), mm = min % 60; return (h ? h + ' 小时 ' : '') + mm + ' 分钟'; }
  function homeTag(x) { var m = mon(x.u), f = form(m), min = homeMins(x); return esc(f.name) + ' · LV' + m.lv + '<small>已展示 ' + durText(min) + (min >= HOME_CAP_H * 60 ? '（已满）' : '') + ' · 经验 +' + fmt(homeExp(x)) + (x.st ? '（被偷走 ' + fmt(x.st) + '）' : '') + '</small>' + (x.auto ? '<small class="hm-auto">自律训练 · 还剩 ' + x.auto.left + ' 天' + (x.auto.got ? ' · 已结算 ' + fmt(x.auto.got) : '') + '</small>' : ''); }
  // 2026-11-03：训练满 1 小时的精灵头上冒气泡，点一下收获经验、重新开始计时（经验最多算 24 小时；装了自律装置的会自动结算，不冒）
  function homeFull(x) { return !x.auto && homeMins(x) >= 60; }
  function homeReadyBub(x) { return '<button type="button" class="hm-ready" data-hreap="' + x.u + '" title="点一下收获经验并重新开始计时" aria-label="收获 ' + esc(form(mon(x.u)).name) + ' 的训练经验"><img src="images/items/exp.png" alt="">+' + fmt(homeExp(x)) + '</button>'; }
  function homeReap(u, el) {
    if (el) el.disabled = true;
    txRun('home', { a: 'reap', u: u }, function (res) {
      var m = mon(u), msg = res.g ? gainMsg(res.g) : null;
      dailyNote('home');   // 进度由交易加（grow.js）
      renderRes();
      // 只改这一只精灵（不整页重画，别的精灵接着走，不会跳回原位）
      var f = document.querySelector('.home-room .hm-fig[data-hu="' + u + '"]');
      if (f) {
        var bub = f.querySelector('.hm-ready'); if (bub) bub.remove();
        var im = f.querySelector('.hm-poke img'), fm = form(m); if (im && im.getAttribute('src') !== fm.img) im.src = fm.img;   // 升级后进化了：换立绘
        f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop');
      }
      home().mons.forEach(function (x, i) { var t = document.querySelector('[data-htag="' + i + '"]'); if (t) t.innerHTML = homeTag(x); });
      var dl = document.querySelector('#pg-explore .bp-dlg'); if (dl && ex.bpanel) { var ph = basePanelHTML(ex.bpanel), top = dl.scrollTop; if (ph) { dl.outerHTML = ph; var d2 = document.querySelector('#pg-explore .bp-dlg'); if (d2) d2.scrollTop = top; } }
      toast(form(m).name + ' 训练了 ' + durText(res.min) + '，收获了经验，重新开始计时。' + (msg || ''));
    }, function (err) { if (el) el.disabled = false; if (err) toast(err); });
  }
  // 自律训练装置：每满 1 天自动结算一次（离线也算，下次打开游戏时补上）
  function homeSettle(quiet) {
    if (!acc || !acc.home || !Array.isArray(acc.home.mons)) return;
    var due = acc.home.mons.some(function (x) { return x && x.auto && x.auto.left > 0 && Date.now() - x.t >= DAY_MS; }); if (!due) return;
    txRun('home', { a: 'settle' }, function (res) {   // 走交易（grow.js）：服务器按时间结算
      var out = [];
      (res.list || []).forEach(function (x) {
        var m = mon(x.u); if (!m) return;
        out.push(form(m).name + ' 自律训练了 ' + x.days + ' 天，获得 ' + fmt(x.got) + ' 经验' + (x.left > 0 ? '（装置还剩 ' + x.left + ' 天）' : '（7 天训练完成，装置用完了）') + '。');
        dailyNote('home');   // 进度由交易加（grow.js）
      });
      if (out.length && !quiet) setTimeout(function () { toast('茶室：' + out.join('')); }, 2500);   // 晚一点弹，免得被每日任务的提示盖掉
    });
  }
  /* 家园里的精灵走来走去（自己的茶室、拜访别人的茶室、朋友的房间都用 .home-room .hm-fig）：
   * 和野外一样，每只围着自己的位置慢慢绕小圈，往左走时转身；离得近的排在前面 */
  setInterval(function () {
    var figs = document.querySelectorAll('.home-room .hm-fig'); if (!figs.length) return;
    var now = performance.now() / 1000;
    // 2026-11-01：地板摆件有碰撞体积（脚下一圈椭圆），精灵走到那里会被推开
    var solids = Array.prototype.map.call(document.querySelectorAll('.home-room .bdeco:not(.wall)'), function (d) {
      var w = parseFloat(d.style.width) || 6; return { x: parseFloat(d.style.left) || 0, y: (parseFloat(d.style.top) || 0) - w * 0.12, rx: w * 0.5, ry: w * 0.28 };
    });
    Array.prototype.forEach.call(figs, function (f) {
      var D = f.dataset;
      if (!D.hx) { D.hx = parseFloat(f.style.left) || 50; D.hy = parseFloat(f.style.top) || 80; D.ph = Math.random() * 6.283; D.sp = 0.22 + Math.random() * 0.22; D.px = D.hx; }
      var t = now * +D.sp + +D.ph, x = Math.max(8, Math.min(92, +D.hx + Math.cos(t) * 9)), y = Math.max(45, Math.min(96, +D.hy + Math.sin(t * 0.85) * 4));
      var fw = parseFloat(f.style.getPropertyValue('--fw')) || 6;
      solids.forEach(function (c) {
        var rx = c.rx + fw * 0.3, ry = c.ry + fw * 0.15, dx = (x - c.x) / rx, dy = (y - c.y) / ry, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < 1) { if (dd < 0.001) { dx = 1; dy = 0; dd = 1; } x = c.x + dx / dd * rx; y = c.y + dy / dd * ry; }
      });
      x = Math.max(4, Math.min(96, x)); y = Math.max(40, Math.min(99, y));
      f.style.left = x.toFixed(2) + '%'; f.style.top = y.toFixed(2) + '%'; f.style.zIndex = Math.round(y);
      if (x > +D.px + 0.005) f.classList.remove('flip'); else if (x < +D.px - 0.005) f.classList.add('flip');
      D.px = x;
    });
  }, 50);
  /* 温泉里的精灵：在水面上左右漂，往左漂时转身（上下起伏和摇晃交给 CSS 的 spaFloat） */
  setInterval(function () {
    var fl = document.querySelectorAll('.spa-hall .spa-float'); if (!fl.length) return;
    var now = performance.now() / 1000;
    Array.prototype.forEach.call(fl, function (f) {
      var D = f.dataset;
      if (!D.ph) { D.ph = Math.random() * 6.283; D.sp = 0.12 + Math.random() * 0.12; D.px = D.hx; }
      var x = +D.hx + Math.sin(now * +D.sp + +D.ph) * 5;
      x = +D.hx < 50 ? Math.max(5, Math.min(37, x)) : Math.max(63, Math.min(95, x));   // 不往中间漂，免得被主角挡住
      f.style.left = x.toFixed(2) + '%';
      if (x > +D.px + 0.002) f.classList.remove('flip'); else if (x < +D.px - 0.002) f.classList.add('flip');
      D.px = x;
    });
  }, 50);
  /* 精灵的悄悄话：拿到精灵翻译器后，野外、温泉、茶室里走动的精灵偶尔冒一个气泡（台词见 js/data/chatter.js） */
  function hasTrans() { return !!(acc && ((acc.items && acc.items.trans > 0) || prog('flora2').done)); }
  function chatLine(sid, st, ctx) {
    if (ctx === 'mia') return pickOne(CHATTER_MIA);
    var C = (typeof CHATTER !== 'undefined' && CHATTER[sid]) || {}, own = (C.all || []).concat(C[ctx] || [], (C.stage && C.stage[st]) || [], C[ctx + '_' + st] || []);
    var gen = (typeof CHATTER_GEN !== 'undefined' && CHATTER_GEN[ctx]) || [];
    return own.length && (Math.random() < 0.75 || !gen.length) ? pickOne(own) : gen.length ? pickOne(gen) : '';
  }
  setInterval(function () {
    if (typeof CHATTER === 'undefined' || document.hidden || !ready() || !hasTrans()) return;
    var els = document.querySelectorAll('[data-cctx]'); if (!els.length) return;
    var talking = document.querySelectorAll('.chat-bub').length;
    Array.prototype.forEach.call(els, function (el) {
      if (talking >= 2 || el.querySelector('.chat-bub, .hm-ready') || !el.offsetParent || el.classList.contains('wf-out')) return;
      if (Math.random() > 0.05) return;
      var t = chatLine(el.dataset.csid, +el.dataset.cst || 0, el.dataset.cctx); if (!t) return;
      var b = document.createElement('span'); b.className = 'chat-bub'; b.textContent = t; b.setAttribute('aria-hidden', 'true');
      el.appendChild(b); talking++;
      var box = el.closest('.wf-scene, .spa-hall, .home-room'), pr = box && box.getBoundingClientRect(), br = b.getBoundingClientRect();   // 靠边的精灵：气泡往里挪，免得被裁掉
      if (pr) { var dx = br.left < pr.left + 6 ? pr.left + 6 - br.left : br.right > pr.right - 6 ? pr.right - 6 - br.right : 0; if (dx) { b.style.marginLeft = dx + 'px'; b.style.setProperty('--tail', (-dx) + 'px'); } }
      setTimeout(function () { b.classList.add('out'); setTimeout(function () { b.remove(); }, 400); }, 3200 + t.length * 90);
    });
  }, 1500);
  function renderHome() {
    homeSettle(); var H = home();
    clearInterval(ex.homeTick);
    ex.homeTick = setInterval(function () {
      if (ex.view !== 'home' || !document.querySelector('.home-room')) { clearInterval(ex.homeTick); return; }
      var sg = document.querySelector('#pg-explore .scene-go[data-gofarm]'); if (sg) { var hasDot = !!sg.querySelector('.sg-dot'), want = farmReadyN() > 0; if (hasDot !== want) sg.outerHTML = sceneGoHTML('farm'); }   // 种植园有成熟的作物：亮红点
      H.mons.forEach(function (x, i) {
        var t = document.querySelector('[data-htag="' + i + '"]'); if (t) t.innerHTML = homeTag(x);
        var f = document.querySelector('.home-room .hm-fig[data-hu="' + x.u + '"]');
        if (f && homeFull(x) && !f.querySelector('.hm-ready') && !document.querySelector('.base-stage.editing')) f.insertAdjacentHTML('afterbegin', homeReadyBub(x));
      });
    }, 20000);
    var E0 = ex.baseEdit, LY = E0 || baseLayout();
    // 2026-10-31：基地里的精灵只显示精灵本身；鼠标悬停看基本信息；点击是摸摸（2026-11-01 改回，面板在「精灵展示」里看）
    var figs = H.mons.map(function (x, i) {
      var m = mon(x.u), f = form(m), p = baseMonPos(LY.room, i);
      return '<div class="hm-fig' + (H.mons.length > 3 ? ' many' : '') + '" data-csid="' + m.sid + '" data-cst="' + (f.stage || 0) + '" data-cctx="home" data-hu="' + m.u + '" style="left:' + p[0] + '%;top:' + p[1] + '%;--fw:' + baseFigW(m.sid, f.stage, LY.room, p[1]) + '">' + (homeFull(x) && !E0 ? homeReadyBub(x) : '') + '<button type="button" class="hm-poke" data-hpoke="1" aria-label="摸摸' + esc(f.name) + '"><img src="' + f.img + '" alt=""></button><span class="hm-tip" data-htag="' + i + '">' + homeTag(x) + '</span></div>';
    }).join('');
    var title = ex.homeEdit
      ? '<form class="home-edit" onsubmit="return false"><input id="home-name" maxlength="10" value="' + esc(H.name || '我的基地') + '" aria-label="基地名字"><button type="button" class="btn primary" id="home-ok">保存</button><button type="button" class="btn ghost" id="home-cancel">取消</button><span class="hint">最多 10 个字</span></form>'
      : '<b class="home-name">' + esc(H.name || '我的基地') + '</b><button type="button" class="btn ghost" id="home-rn">改名</button>';
    var dl0 = document.querySelector('.bp-dlg'), dlTop = dl0 ? dl0.scrollTop : 0, pan = ex.bpanel ? basePanelHTML(ex.bpanel) : '';
    if (!pan) ex.bpanel = null;
    $('pg-explore').innerHTML = exHead('') +
      '<div class="crumb"><button type="button" class="btn ghost" id="home-back">‹ 返回大厅</button>' + title + '</div>' +
      '<div class="base-stage' + (E0 ? ' editing' : '') + '">' + baseRoomHTML(LY, figs + (H.mons.length || E0 ? '' : '<p class="home-empty">基地里空荡荡的。点左边的「精灵展示」放几只精灵出来，或者点「基地编辑」摆上摆件吧。</p>') + (E0 ? '' : baseSideHTML() + sceneGoHTML('farm')), E0) + '</div>' +
      (E0 ? baseEditBar() : '') + (!E0 && window.HSSOCIAL && HSSOCIAL.friendBases ? HSSOCIAL.friendBases() : '') + pan;
    var dl1 = document.querySelector('.bp-dlg'); if (dl1 && dl0) dl1.scrollTop = dlTop;
  }
  // 基地画面左边悬停的入口（2026-10-31，参考飞船终端舰体图右边的入口）
  function baseOnline() { var SO = window.HSSOCIAL; return !!(SO && SO.homeBoard && (!SO.online || SO.online())); }
  function baseSideHTML() {
    var H = home(), SO = window.HSSOCIAL, nNew = baseOnline() && SO.homeNew ? SO.homeNew() : 0;
    var it = function (attr, ic, t, sub, badge) { return '<button type="button" class="bs-it" ' + attr + ' title="' + t + '"><span class="bs-ic" aria-hidden="true">' + ic + (badge ? '<i class="bs-badge">' + badge + '</i>' : '') + '</span><span class="bs-t"><b>' + t + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; };
    var hid = false; try { hid = localStorage.getItem('hs-bside-hide') === '1'; } catch (e) {}
    return '<div class="base-side' + (hid ? ' hid' : '') + '"><button type="button" class="bs-tog" data-bstog="1" aria-label="' + (hid ? '展开' : '收起') + '基地菜单" title="' + (hid ? '展开' : '收起') + '"><span aria-hidden="true">◀</span></button><div class="bs-list">' +
      (baseOnline() ? it('data-bpanel="log"', '📰', '基地动态', nNew ? nNew + ' 条新动态' : '谁来过', nNew) + it('data-bpanel="msg"', '💬', '留言板', '船员的留言') : '') +
      it('data-bgmopen="1"', '♪', '基地音乐', bgmName(homeBgm())) +
      it('data-bpanel="mons"', '🐾', '精灵展示', H.mons.length + ' / ' + homeMax() + ' 只') +
      it('data-bedit="1"', '✎', '基地编辑', '房型和摆件') +
      it('data-bpanel="shop"', '🛍', '基地商城', '能量 ' + fmt(acc.energy)) + '</div></div>';
  }
  function basePanelHTML(k) {
    var body = '', cls = '', ttl = '';
    if (k === 'log' || k === 'msg') { if (!baseOnline()) return ''; ttl = k === 'log' ? '基地动态' : '留言板'; body = HSSOCIAL.homeBoard(null, k); }
    else if (k === 'mons') { ttl = '精灵展示'; cls = ' wide'; body = baseMonsBody(); }
    else if (k === 'shop') { ttl = '基地商城'; cls = ' wide'; body = baseShopBody(); }
    else if (k.indexOf('mon:') === 0) { cls = ' bp-mon'; body = baseMonBody(+k.slice(4)); if (!body) return ''; }
    else if (k === 'nursery') { ttl = '精元转化仪'; cls = ' wide'; body = '<p class="hint">和神农架 · 精灵保育仓的孵化槽是同一套，在这里放进去、在那边孵化也一样。</p>' + nurseryBody(nurseryCards()); setTimeout(nurseryTick, 0); }
    else if (k === 'mm') { cls = ' mm-box'; body = mmPortraitBody(); }
    else return '';
    return '<div class="soc-dlg bp-dlg"><div class="soc-box bp-box' + cls + '" role="dialog" aria-modal="true"' + (ttl ? ' aria-label="' + ttl + '"' : '') + '><span class="tape l"></span><span class="tape r"></span>' + (ttl ? '<h2>' + ttl + '</h2>' : '') + body +
      '<div class="soc-foot"><button type="button" class="btn primary" data-bpx="1">关闭</button></div></div></div>';
  }
  // 精灵展示面板：放出、收回精灵；给展示中的精灵装自律训练装置
  function baseMonsBody() {
    var H = home(), nAuto = acc.items.auto || 0, ins = H.mons.map(function (x) { return x.u; });
    var list = acc.mons.slice();   // 2026-11-01：顺序固定，点了放出 / 收回也不会跳到最上面
    var cards = list.map(function (m) {
      var on = ins.indexOf(m.u) >= 0, f = form(m), full = !on && H.mons.length >= homeMax(), x = on ? H.mons[ins.indexOf(m.u)] : null;
      var armed = on && ex.hmArm === m.u;
      return '<div class="hm-cell"><button type="button" class="card hm-card' + (on ? ' on' : '') + (armed ? ' armed' : '') + '" data-hm="' + m.u + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + on + '"><img src="' + f.img + '" alt=""><span class="nm">' + esc(f.name) + '</span><span class="meta">LV' + m.lv + (armed ? ' · 再点一次收回（装置剩余天数作废）' : on ? (x.auto ? ' · 自律训练中 · 还剩 ' + x.auto.left + ' 天' : ' · 展示中，点击收回') : ' · 每小时 ' + homeRate(m) + ' 经验') + '</span></button>' +
        (on && !x.auto ? '<button type="button" class="btn hm-autobtn" data-hauto="' + m.u + '"' + (nAuto ? '' : ' disabled') + '>' + (nAuto ? '装上自律装置' : '没有自律装置') + '</button>' : '') + '</div>';
    }).join('');
    return '<p class="hint">展示中 <b>' + H.mons.length + ' / ' + homeMax() + '</b> 只。展示越久、等级越高，收回时经验越多，最多累计 ' + HOME_CAP_H + ' 小时，离开游戏也照常计时。点卡片放出或收回。</p>' +
      '<div class="hm-autobar"><b>7日自律训练装置</b><span class="hint">持有 ' + nAuto + ' 个' + (nAuto ? '，点展示中精灵下面的「装上自律装置」使用' : '，可以在茶室大厅的茶室商店兑换') + '。装上后每满 1 天自动结算经验并重新开始，一共 7 天；中途收回精灵，剩下的天数作废。</span></div>' +
      '<div class="hm-grid">' + cards + '</div>';
  }
  // 点基地里的精灵弹出的面板
  function baseMonBody(u) {
    var H = home(), x = H.mons.filter(function (y) { return y.u === u; })[0], m = x && mon(u); if (!m) return '';
    var f = form(m), min = homeMins(x), nAuto = acc.items.auto || 0, armed = ex.hmArm === u;
    return '<div class="bpm-top"><img class="bpm-img" src="' + f.img + '" alt=""><div class="bpm-txt"><h2>' + esc(f.name) + '</h2><p class="bpm-lv">LV' + m.lv + '</p>' +
      '<ul class="bpm-st"><li>已展示 <b>' + durText(min) + '</b>' + (min >= HOME_CAP_H * 60 ? '（已满 ' + HOME_CAP_H + ' 小时）' : '') + '</li><li>现在收回可得 <b>+' + fmt(homeExp(x)) + '</b> 经验</li>' + (x.st ? '<li>这一轮被好友偷走了 <b>' + fmt(x.st) + '</b> 经验（收获后重新计算）</li>' : '') + '<li>每小时 <b>' + homeRate(m) + '</b> 经验</li>' +
      (x.auto ? '<li class="hm-auto">自律训练中 · 还剩 <b>' + x.auto.left + '</b> 天' + (x.auto.got ? ' · 已结算 ' + fmt(x.auto.got) + ' 经验' : '') + '</li>' : '') + '</ul></div></div>' +
      '<div class="bpm-act">' + (homeFull(x) ? '<button type="button" class="btn primary" data-hreap="' + u + '">收获经验并重新计时</button>' : '') + '<button type="button" class="btn" data-hpoke2="' + u + '">摸摸它</button>' +
      (x.auto ? '' : '<button type="button" class="btn" data-hauto="' + u + '"' + (nAuto ? '' : ' disabled') + '>装上自律装置（持有 ' + nAuto + '）</button>') +
      '<button type="button" class="btn ' + (armed ? 'primary' : 'ghost') + '" data-hm="' + u + '">' + (armed ? '再点一次收回（装置剩余天数作废）' : '收回') + '</button></div>';
  }
  /* ---------- 基地（2026-10-31，取代原来的茶室）：2.5D 房间，可以换房型、摆放摆件 ----------
   * 房型、摆件在基地商城用能量买（js/engine/tx.js 的 baseBuy，记在 acc.baseInv）；摆放记在 acc.home.layout = { room, deco: [{ k, x, y, f }] }
   * x、y 是摆件脚底在房间里的位置（百分比）；f = 1 左右翻转。地板摆件只能放在地板区域，墙壁摆件只能挂在墙壁区域（见下面的 BASE_UI） */
  /* 2026-10-31：地板、墙壁按每个房型的画面描出来（多边形，百分比坐标）：floor 能走、能放地板摆件的地面；wall 能挂墙壁摆件的墙面；block 地面上不能放东西的地方（地洞、控制台；海底穹顶的水池和右边白色平台都能走）；mons 精灵展示的站位 */
  var BASE_UI = {
    r1: { img: 'images/base/room1.jpg', floor: [[[0,50],[4,40],[8,33],[14,30],[22,36],[27,31],[40,27],[58,27],[70,30],[76,32],[86,32],[90,44],[95,58],[97,70],[93,80],[84,88],[82,93],[80,100],[0,100]]], wall: [], block: [], mons: [[22,88],[46,82],[70,72],[34,66],[58,60],[84,66],[8,76]] },
    r2: { img: 'images/base/room2.jpg', floor: [[[0,63],[9,55],[14,51],[24,44],[33,41],[42,41],[54,43],[66,43],[72,47],[75,54],[82,60],[92,63],[100,61],[100,100],[0,100]],[[54,30],[55,25],[58,21],[62,19],[72,18.5],[80,19],[88,21],[93,25],[96,30],[98,38],[98,50],[96,57],[92,60],[88,61],[80,58],[75,53],[73,46],[71,41],[64,38],[57,36]]], wall: [[[0,16],[8,8],[30,2],[32,22],[30,32],[18,37],[9,50],[6,56],[0,59]],[[35,4],[54,4],[56,22],[35,22]],[[58,0],[100,0],[100,32],[94,24],[84,19],[62,18],[57,10]]], block: [], mons: [[14,82],[80,82],[48,72],[84,42],[18,66],[76,96],[6,94]] },
    r3: { img: 'images/base/room3.jpg', floor: [[[33,47],[67,47],[85,61],[88,70],[90,82],[91,100],[9,100],[10,82],[12,70],[15,61]]], wall: [[[17,8],[29,2],[25,20],[23,43],[17,43]],[[71,2],[83,8],[83,43],[77,43],[75,20]],[[4,36],[15,30],[15,58],[11,74],[5,70]],[[85,30],[96,36],[95,70],[89,74],[85,58]]], block: [[[45,47],[55,47],[55,56],[45,56]]], mons: [[22,88],[47,82],[74,72],[32,68],[62,64],[80,92],[18,74]] },
    r4: { img: 'images/base/room4.jpg', floor: [[[24,42],[31,34],[45,30],[58,29],[70,32],[80,39],[86,46],[90,56],[92,70],[90,82],[84,90],[72,94],[66,100],[22,100],[20,92],[13,76],[10,66],[16,60],[22,58],[26,52]]], wall: [[[22,8],[40,4],[60,0],[82,0],[86,12],[88,30],[85,40],[80,37],[70,30],[58,27],[45,28],[30,32],[24,37],[22,26]]], block: [], mons: [[26,90],[74,88],[80,66],[26,68],[62,40],[44,42],[20,78]] }
  };
  var DECO_IMG = { d1: 'images/base/deco1.webp', d2: 'images/base/deco2.webp', d3: 'images/base/deco3.webp', d4: 'images/base/deco4.webp', d5: 'images/base/deco5.webp', d6: 'images/base/deco6.webp', d7: 'images/base/deco7.webp', d8: 'images/base/deco8.webp', d9: 'images/base/deco9.webp', d10: 'images/base/deco10.webp', d11: 'images/base/deco11.webp' };
  // 可以点的摆件（2026-11-01）：发现纪念弹出说明；精元转化仪打开孵化；留言板打开留言
  var DECO_ACT = { d1: 'char', d2: 'char', d3: 'char', d4: 'char', d5: '叶粒种子', d6: '水臂乌贼', d7: '方头蘑菇', d8: 'nursery', d9: 'mm', d10: 'msg', d11: 'cup' };
  var DECO_SIZE = { d8: 1.75 };   // 精元转化仪画得大一些（2026-11-01）
  // 明明画像的面板：大图 + 荣誉（2026-11-01）
  var MM_HONORS = ['军衔：少校', '湖北理科高考优胜者', '华中科技大学光学与电子信息学院优秀毕业生', '荆楚号古城防卫部总教官'];
  function mmPortraitBody() {
    return '<div class="mm-por"><div class="mm-frame"><img src="' + CHARS.mm + '" alt="明明教官"></div><div class="mm-txt"><h2>明明教官</h2><p class="hint">古城防卫部</p><h4>荣誉</h4><ul>' + MM_HONORS.map(function (t) { return '<li>🏅 ' + esc(t) + '</li>'; }).join('') + '</ul></div></div>';
  }
  // 黑洞家摆件的角色介绍（2026-11-03）：点摆件弹出，样式和明明画像一样
  var DECO_CHAR = {
    d1: { sub: '黑洞独角兽', t: ['世界上最后一只黑洞独角兽，耳朵里的黑洞直接连着多维宇宙；为了躲避宇宙猎人的追杀，被逃出孤儿院的山楂和 OCT 捡回了家。', '性格友好又容易害羞，平时忌讳使用魔法，却是个痴迷魔术的狂热爱好者，只是出人意料地没什么天赋。'] },
    d2: { sub: '飞狼族', t: ['沿用了孤儿院里的名字 October，种族是飞狼族，但在孤儿院没机会练习，其实不太会飞，可能还有点恐高。', '家里最靠谱的那一个，总穿着家居服，把家务打理得井井有条，还喜欢偷偷买可爱的东西（但不承认）。'] },
    d3: { sub: '牌牌', t: ['戴着高礼帽、眼睛上贴着扑克牌纹样眼罩的神秘人物，大家都叫他「牌牌」。', '关于他的事情知道得还不多，真实身份仍然是个谜。'] },
    d4: { sub: '山楂', t: ['在孤儿院被赐名 May，更喜欢被叫作「山楂」；是只兔子，因为当年用女孩子的身份更容易混进孤儿院内部，习惯了穿女装。', '三无，身手很好，曾经是家务全能的女仆长；逃出孤儿院后放松下来变得懒散，最爱发呆睡觉，偶尔做点保安工作打打杂。'] }
  };
  function decoCharBody(k) {
    var C = DECO_CHAR[k], X = TX.D.BASE_DECO[k] || {}; if (!C) return '';
    return '<div class="mm-por ch-por"><div class="mm-frame ch-frame"><img src="' + DECO_IMG[k] + '" alt="' + esc(X.n || '') + '"></div><div class="mm-txt"><h2>' + esc(X.n || '') + '</h2><p class="hint">黑洞家 · ' + esc(C.sub) + '</p>' +
      C.t.map(function (x) { return '<p class="ch-line">' + esc(x) + '</p>'; }).join('') + '</div></div>';
  }
  function baseInv() { var B = (acc && acc.baseInv) || {}; return { rooms: B.rooms || {}, deco: B.deco || {} }; }
  function roomOwned(k) { return k === 'r1' || !!baseInv().rooms[k]; }
  function decoOwn(k) { return baseInv().deco[k] | 0; }
  function baseLayout() { var H = home(); if (!H.layout || typeof H.layout !== 'object') H.layout = { room: 'r1', deco: [] }; if (!roomOwned(H.layout.room) || !BASE_UI[H.layout.room]) H.layout.room = 'r1'; if (!Array.isArray(H.layout.deco)) H.layout.deco = []; return H.layout; }
  function decoLayer(k) { var X = TX.D.BASE_DECO[k]; return X ? X.layer : 'floor'; }
  function inPoly(x, y, P) { var c = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function baseOk(R, layer, x, y) { return R[layer].some(function (P) { return inPoly(x, y, P); }) && !(layer === 'floor' && R.block.some(function (P) { return inPoly(x, y, P); })); }
  var baseGrid = {};
  // 可以放的点（每 1% 一个），拖出范围时吸到最近的一个；房间图是 1400×817，纵向 1% 只有横向的 0.58 那么长
  function baseSnap(room, layer, x, y) {
    var R = BASE_UI[room] || BASE_UI.r1; if (baseOk(R, layer, x, y)) return [x, y];
    var key = room + layer, G = baseGrid[key];
    if (!G) { G = baseGrid[key] = []; for (var gx = 2; gx <= 98; gx++) for (var gy = 3; gy <= 99; gy++) if (baseOk(R, layer, gx, gy)) G.push([gx, gy]); }
    var best = null, bd = 1e9; G.forEach(function (q) { var dx = q[0] - x, dy = (q[1] - y) * 0.58, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = q; } });
    return best ? [best[0], best[1]] : [x, y];
  }
  function floorTop(room) { var R = BASE_UI[room] || BASE_UI.r1, t = 100; (R.floor[0] || []).forEach(function (q) { t = Math.min(t, q[1]); }); return t; }   // 只看主地板（海底穹顶右边的白色平台单独一块，比主地板高，不参与纵深计算）
  // 基地里精灵的大小（2026-10-31）：按进化阶段来，一阶最小、最终形态最大（单形态的算最终形态）；越靠里（越往上）画得越小
  function baseFigW(sid, stage, room, y) {
    var S0 = SPMAP[sid], n = S0 && S0.evo ? S0.evo.length : 1, fr = n > 1 ? Math.min(1, (stage || 0) / (n - 1)) : 1;
    var ft = floorTop(room), dep = 0.82 + 0.3 * Math.max(0, Math.min(1, (y - ft) / (100 - ft)));
    return Math.round((5 + 6 * fr) * dep * 100) / 100;
  }
  function baseMonPos(room, i) { var R = BASE_UI[room] || BASE_UI.r1; return R.mons[i] || R.mons[0]; }
  function baseZonesSVG(room) {
    var R = BASE_UI[room] || BASE_UI.r1, pg = function (P, c) { return '<polygon class="' + c + '" points="' + P.map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '"/>'; };
    return '<svg class="base-zones" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + R.wall.map(function (P) { return pg(P, 'zw'); }).join('') + R.floor.map(function (P) { return pg(P, 'zf'); }).join('') + R.block.map(function (P) { return pg(P, 'zb'); }).join('') + '</svg>';
  }
  // 越靠里（越往上）的地板摆件画得越小，看起来有纵深
  function decoHTML(d, i, room, edit, sel) {
    var fl = floorTop(room), wall = decoLayer(d.k) === 'wall', q = baseSnap(room, wall ? 'wall' : 'floor', +d.x || 50, +d.y || 80);
    d = { k: d.k, x: q[0], y: q[1], f: d.f };
    var sc = wall ? 0.9 : 0.72 + 0.42 * Math.max(0, Math.min(1, (d.y - fl) / (100 - fl)));
    return '<div class="bdeco' + (wall ? ' wall' : '') + (d.f ? ' flip' : '') + (edit && sel === i ? ' sel' : '') + (!edit && DECO_ACT[d.k] ? ' act' : '') + '" data-dk="' + d.k + '" data-bi="' + i + '" style="left:' + d.x + '%;top:' + d.y + '%;width:' + (7.2 * sc * (DECO_SIZE[d.k] || 1)).toFixed(2) + '%;z-index:' + (edit && sel === i ? 150 : wall ? 2 : Math.round(d.y)) + '"><img src="' + (DECO_IMG[d.k] || '') + '" alt="' + esc((TX.D.BASE_DECO[d.k] || {}).n || '') + '" draggable="false"></div>';
  }
  function baseRoomHTML(L, inner, edit) {
    L = L || { room: 'r1', deco: [] }; var R = BASE_UI[L.room] || BASE_UI.r1;
    return '<div class="home-room base-room' + (edit ? ' editing' : '') + '" id="base-room"><img class="home-bg" src="' + R.img + '" alt="">' +
      (L.deco || []).map(function (d, i) { return decoHTML(d, i, L.room, !!edit, edit ? edit.sel : -1); }).join('') + (edit ? baseZonesSVG(L.room) : '') + (inner || '') + '</div>';
  }
  function baseEditBar() {
    var E0 = ex.baseEdit, used = {}; E0.deco.forEach(function (d) { used[d.k] = (used[d.k] | 0) + 1; });
    var sel = E0.deco[E0.sel];
    var myRooms = Object.keys(TX.D.BASE_ROOMS).filter(roomOwned), myDeco = Object.keys(TX.D.BASE_DECO).filter(function (k) { return decoOwn(k) > 0; });
    return '<div class="base-edit be-sheet' + (ex.beMin ? ' min' : '') + '"><div class="be-head"><button type="button" class="btn ghost be-min" data-bemin="1" aria-label="' + (ex.beMin ? '展开' : '收起') + '">' + (ex.beMin ? '▲' : '▼') + '</button><b>编辑基地</b><span class="hint">拖动摆件调整位置，最多摆 ' + TX.D.BASE_DECO_MAX + ' 个。<span class="be-lg"><i class="zf"></i>地板（放地板摆件）<i class="zw"></i>墙壁（挂墙壁摆件）<i class="zb"></i>不能放</span></span>' +
      '<span class="be-save"><button type="button" class="btn ghost" data-becancel="1">取消</button><button type="button" class="btn primary" data-besave="1">保存</button></span></div>' +
      (sel ? '<div class="be-sel"><b>已选中：' + esc(TX.D.BASE_DECO[sel.k].n) + '</b><button type="button" class="btn" data-beflip="1">↔ 左右转向</button><button type="button" class="btn ghost" data-bedel="1">收进摆件库</button></div>' : '') +
      '<div class="be-body"><h4>房型</h4><div class="be-rooms">' + myRooms.map(function (k) {
        var on = E0.room === k;
        return '<button type="button" class="be-room' + (on ? ' on' : '') + '" data-beroom="' + k + '"><img src="' + BASE_UI[k].img + '" alt=""><b>' + esc(TX.D.BASE_ROOMS[k].n) + '</b><small>' + (on ? '使用中' : '点击换上') + '</small></button>';
      }).join('') + '</div>' +
      '<h4>摆件库 <span class="hint">点一下放进基地</span></h4>' + (myDeco.length ? '<div class="be-decos">' + myDeco.map(function (k) {
        var left = decoOwn(k) - (used[k] | 0), X = TX.D.BASE_DECO[k];
        return '<button type="button" class="be-deco" data-beadd="' + k + '"' + (left > 0 && E0.deco.length < TX.D.BASE_DECO_MAX ? '' : ' disabled') + '><img src="' + DECO_IMG[k] + '" alt=""><b>' + esc(X.n) + '</b><small>' + (X.layer === 'wall' ? '墙壁' : '地板') + ' · ' + (left > 0 ? '还能放 ' + left + ' 个' : '已全部摆出') + '</small></button>';
      }).join('') + '</div>' : '<p class="hint">还没有摆件，去<button type="button" class="linkbtn" data-bshop="1">基地商城</button>买几个吧。</p>') + '</div></div>';
  }
  function baseClamp(d, room) {
    var q = baseSnap(room, decoLayer(d.k) === 'wall' ? 'wall' : 'floor', Math.max(1, Math.min(99, +d.x || 50)), Math.max(1, Math.min(100, +d.y || 80)));
    d.x = Math.round(q[0] * 10) / 10; d.y = Math.round(q[1] * 10) / 10;
    return d;
  }
  $('pg-explore').addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('bp-dlg')) { ex.bpanel = null; ex.fpanel = null; ex.hmArm = null; e.target.remove(); return; }
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.bshop && ex.view === 'home') { ex.bpanel = 'shop'; renderHome(); return; }
    if (b.dataset.bstog) { var sd = b.closest('.base-side'), h2 = sd.classList.toggle('hid'), skey = b.dataset.bstog === '1' ? 'hs-bside-hide' : b.dataset.bstog; try { localStorage.setItem(skey, h2 ? '1' : '0'); } catch (er) {} b.setAttribute('aria-label', (h2 ? '展开' : '收起') + (skey === 'hs-bside-hide' ? '基地菜单' : '种植园菜单')); b.title = h2 ? '展开' : '收起'; return; }
    if (b.dataset.bpanel) { ex.bpanel = b.dataset.bpanel; renderHome(); return; }
    if (b.dataset.bpx) { ex.bpanel = null; ex.fpanel = null; ex.hmArm = null; var dlx = document.querySelector('.bp-dlg'); if (dlx) dlx.remove(); return; }
    if (b.dataset.hmon) { ex.bpanel = 'mon:' + b.dataset.hmon; renderHome(); return; }
    if (b.dataset.hpoke2) {
      var fg = document.querySelector('#base-room .hm-fig[data-hu="' + b.dataset.hpoke2 + '"]'), im = document.querySelector('.bp-dlg .bpm-img');
      [fg, im].forEach(function (z) { if (z) { z.classList.remove('hop'); void z.offsetWidth; z.classList.add('hop'); } }); return;
    }
    if (b.dataset.bemin) { ex.beMin = !ex.beMin; var bar0 = document.querySelector('.base-edit'); if (bar0) bar0.outerHTML = baseEditBar(); return; }
    if (b.dataset.bshop) { if (ex.baseEdit && !confirmLeaveEdit()) return; ex.baseEdit = null; ex.view = 'baseshop'; ex.area = '天门'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.bedit) { ex.bpanel = null; var L0 = baseLayout(); ex.baseEdit = { room: L0.room, deco: L0.deco.map(function (d) { return { k: d.k, x: d.x, y: d.y, f: d.f ? 1 : 0 }; }), sel: -1 }; renderHome(); var rm = $('base-room'); if (rm) HSVIEW.to(0, HSVIEW.top(rm) - 10); return; }
    var E0 = ex.baseEdit; if (!E0) return;
    if (b.dataset.becancel) { ex.baseEdit = null; renderHome(); return; }
    if (b.dataset.besave) { var H = home(); H.layout = { room: E0.room, deco: E0.deco.map(function (d) { return baseClamp({ k: d.k, x: d.x, y: d.y, f: d.f ? 1 : 0 }, E0.room); }) }; ex.baseEdit = null; save(); renderHome(); toast('基地布置已保存。'); return; }
    if (b.dataset.beroom) { var k = b.dataset.beroom; if (!roomOwned(k)) { toast('这个房型要在基地商城用 ' + fmt(TX.D.BASE_ROOMS[k].price) + ' 能量购买。'); return; } E0.room = k; E0.deco.forEach(function (d) { baseClamp(d, k); }); renderHome(); return; }
    if (b.dataset.beadd) { var dk = b.dataset.beadd, fl = floorTop(E0.room); E0.deco.push(baseClamp({ k: dk, x: 40 + Math.random() * 20, y: decoLayer(dk) === 'wall' ? fl * 0.5 : fl + (100 - fl) * 0.55, f: 0 }, E0.room)); E0.sel = E0.deco.length - 1; renderHome(); return; }
    if (b.dataset.beflip && E0.deco[E0.sel]) { E0.deco[E0.sel].f = E0.deco[E0.sel].f ? 0 : 1; renderHome(); return; }
    if (b.dataset.bedel && E0.deco[E0.sel]) { E0.deco.splice(E0.sel, 1); E0.sel = -1; renderHome(); return; }
  });
  function confirmLeaveEdit() { return true; }   // 编辑中离开：直接放弃没保存的改动
  // 点摆件（不在编辑模式时）：发现纪念弹出说明；自己基地里的精元转化仪打开孵化、留言板打开留言
  document.addEventListener('click', function (e) {
    var el = e.target.closest('.bdeco.act'); if (!el || ex.baseEdit) return;
    var k = el.dataset.dk, A = DECO_ACT[k], mine = !!el.closest('#pg-explore'); if (!A) return;
    if (A === 'nursery') { if (!mine) { toast('这是主人的精元转化仪。'); return; } ex.bpanel = 'nursery'; renderHome(); return; }
    if (A === 'mm') {
      if (mine) { ex.bpanel = 'mm'; renderHome(); return; }
      var dm = document.createElement('div'); dm.className = 'soc-dlg'; dm.innerHTML = '<div class="soc-box bp-box mm-box" role="dialog" aria-modal="true">' + mmPortraitBody() + '<div class="soc-foot"><button type="button" class="btn primary" data-decox="1">关闭</button></div></div>';
      document.body.appendChild(dm); dm.addEventListener('click', function (ev) { if (ev.target === dm || ev.target.closest('[data-decox]')) dm.remove(); }); return;
    }
    if (A === 'char') {
      var dch = document.createElement('div'); dch.className = 'soc-dlg'; dch.innerHTML = '<div class="soc-box bp-box mm-box" role="dialog" aria-modal="true">' + decoCharBody(k) + '<div class="soc-foot"><button type="button" class="btn primary" data-decox="1">关闭</button></div></div>';
      document.body.appendChild(dch); dch.addEventListener('click', function (ev) { if (ev.target === dch || ev.target.closest('[data-decox]')) dch.remove(); }); return;
    }
    if (A === 'cup') {   // 冠军奖杯（2026-11-02）：冠军和夺冠主力精灵由服务器按决赛的回放算（server/contest.js）
      var dc = document.createElement('div'); dc.className = 'soc-dlg'; dc.id = 'cup-dlg';
      var cupDraw = function (txt) { dc.innerHTML = '<div class="soc-box deco-box cup-box" role="dialog" aria-modal="true"><img src="' + DECO_IMG.d11 + '" alt=""><h3>' + esc(TX.D.BASE_DECO.d11.n) + '</h3><p>' + txt + '</p><div class="soc-foot"><button type="button" class="btn primary" data-decox="1">关闭</button></div></div>'; };
      cupDraw('正在读取冠军资料……'); document.body.appendChild(dc);
      dc.addEventListener('click', function (ev) { if (ev.target === dc || ev.target.closest('[data-decox]')) dc.remove(); });
      var C0 = window.CLOUD; if (!C0 || !C0.api) { cupDraw('要联网后才能查看冠军资料。'); return; }
      C0.api('GET', '/api/contest/champ').then(function (r) {
        if (!r || !r.name) { cupDraw('冠军资料暂时读不到。'); return; }
        var ms = (r.mons || []).map(function (x) { return x.nick || (SPMAP[x.id] && SPMAP[x.id].name) || x.id; });
        cupDraw('<b>' + esc(r.name) + '</b> 获得了第一届做题大王争霸赛的冠军' + (ms.length ? '，' + (r.gender === 'f' ? '她' : '他') + '的夺冠主力精灵是 <b>' + ms.map(esc).join('</b>、<b>') + '</b>' : '') + '。');
      }, function () { cupDraw('冠军资料暂时读不到。'); });
      return;
    }
    if (A === 'msg') { if (!mine) { toast('留言板在下面，给主人留句话吧。'); return; } if (!baseOnline()) { toast('留言板需要联网：用服务器网址打开游戏并登录后才能用。'); return; } ex.bpanel = 'msg'; renderHome(); return; }
    var old = $('deco-dlg'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'deco-dlg';
    d.innerHTML = '<div class="soc-box deco-box" role="dialog" aria-modal="true"><img src="' + DECO_IMG[k] + '" alt=""><h3>' + esc(TX.D.BASE_DECO[k].n) + '</h3><p>2019 年，在省实验中学 4 班发现了' + A + '。</p><div class="soc-foot"><button type="button" class="btn primary" data-decox="1">知道了</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (ev) { if (ev.target === d || ev.target.closest('[data-decox]')) d.remove(); });
  });
  // 编辑模式下拖动摆件（鼠标、触屏都可以）
  (function () {
    var drag = null;
    $('pg-explore').addEventListener('pointerdown', function (e) {
      var E0 = ex.baseEdit; if (!E0) return;
      var el = e.target.closest('#base-room .bdeco'); if (!el) { if (e.target.closest('#base-room') && E0.sel >= 0) { E0.sel = -1; renderHome(); } return; }
      e.preventDefault();
      var i = +el.dataset.bi, room = $('base-room').getBoundingClientRect();
      if (E0.sel !== i) { E0.sel = i; Array.prototype.forEach.call(document.querySelectorAll('#base-room .bdeco'), function (x) { var j = +x.dataset.bi, on = j === i; x.classList.toggle('sel', on); if (E0.deco[j]) x.style.zIndex = on ? 150 : decoLayer(E0.deco[j].k) === 'wall' ? 2 : Math.round(E0.deco[j].y); }); var bar = document.querySelector('.base-edit'); if (bar) bar.outerHTML = baseEditBar(); }
      drag = { i: i, el: $('base-room').querySelector('.bdeco[data-bi="' + i + '"]'), rect: room, x0: e.clientX, y0: e.clientY, dx: E0.deco[i].x, dy: E0.deco[i].y };
      try { $('base-room').setPointerCapture(e.pointerId); } catch (er) {}
    });
    $('pg-explore').addEventListener('pointermove', function (e) {
      if (!drag || !ex.baseEdit) return;
      var E0 = ex.baseEdit, d = E0.deco[drag.i]; if (!d) return;
      if (!drag.el || !drag.el.isConnected) { drag.el = document.querySelector('#base-room .bdeco[data-bi="' + drag.i + '"]'); if (!drag.el) return; }   // 拖动途中基地被重画过：重新找一下这个摆件
      d.x = drag.dx + (e.clientX - drag.x0) / drag.rect.width * 100; d.y = drag.dy + (e.clientY - drag.y0) / drag.rect.height * 100;
      baseClamp(d, E0.room);
      var tmp = document.createElement('div'); tmp.innerHTML = decoHTML(d, drag.i, E0.room, true, drag.i); var nw = tmp.firstChild;
      drag.el.style.left = nw.style.left; drag.el.style.top = nw.style.top; drag.el.style.width = nw.style.width; drag.el.style.zIndex = nw.style.zIndex;
    });
    var end = function () { drag = null; };
    $('pg-explore').addEventListener('pointerup', end); $('pg-explore').addEventListener('pointercancel', end);
  })();
  /* 基地商城：房型（买一次）、摆件（可以买很多个） */
  function renderBaseShop() {
    $('pg-explore').innerHTML = exHead('基地商城：用能量购买基地的房型和摆件。买到的在基地的「编辑基地」里使用。') +
      '<div class="crumb"><button type="button" class="btn ghost" data-bhome="1">‹ 返回基地</button><b>基地商城</b></div>' + baseShopBody();
  }
  function baseShopRefresh() { if (ex.view === 'home') renderHome(); else renderBaseShop(); }
  function baseShopBody() {
    var q = function (k) { return Math.max(1, Math.min(20, shopQty['bd-' + k] || 1)); };
    return '<div class="shop-bal"><span class="tape l"></span>当前能量 <b>' + fmt(acc.energy) + '</b></div>' +
      '<h3 class="sec bs-h">房型</h3><div class="bs-rooms">' + Object.keys(TX.D.BASE_ROOMS).map(function (k) {
        var R = TX.D.BASE_ROOMS[k], own = roomOwned(k);
        return '<article class="bs-room"><span class="tape r"></span><img src="' + BASE_UI[k].img + '" alt=""><div class="bs-txt"><b>' + esc(R.n) + '</b>' +
          (own ? '<span class="hint">' + (R.price ? '已拥有' : '默认房型') + '</span>' : '<button type="button" class="btn primary" data-bbuy="room|' + k + '"' + (acc.energy >= R.price ? '' : ' disabled') + '>' + (acc.energy >= R.price ? '购买 · ' + fmt(R.price) + ' 能量' : '能量不足（' + fmt(R.price) + '）') + '</button>') + '</div></article>';
      }).join('') + '</div>' +
      '<h3 class="sec bs-h">摆件</h3><div class="shop-grid">' + Object.keys(TX.D.BASE_DECO).filter(function (k) { return !TX.D.BASE_DECO[k].noShop; }).map(function (k) {
        var X = TX.D.BASE_DECO[k], n = q(k), cost = X.price * n, ok = acc.energy >= cost;
        return '<article class="shop-it"><span class="tape r"></span><img class="bs-deco" src="' + DECO_IMG[k] + '" alt=""><div class="si-txt"><b>' + esc(X.n) + '</b><p class="hint">' + (X.layer === 'wall' ? '墙壁摆件' : '地板摆件') + '，可以买很多个。</p><p class="si-own">持有 <b>' + decoOwn(k) + '</b></p></div>' +
          '<div class="si-buy"><span class="si-price">' + fmt(X.price) + ' <small>能量</small></span>' +
          '<div class="qty"><button type="button" class="btn ghost" data-bq="' + k + '|-1"' + (n <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + n + '</span><button type="button" class="btn ghost" data-bq="' + k + '|1"' + (n >= 20 ? ' disabled' : '') + '>+</button></div>' +
          '<button type="button" class="btn primary" data-bbuy="deco|' + k + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '购买 · ' + fmt(cost) : '能量不足') + '</button></div></article>';
      }).join('') + '</div>';
  }
  $('pg-explore').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.bhome) { ex.view = 'home'; ex.area = '天门'; renderExplore(); return; }
    if (b.dataset.bq) { var p = b.dataset.bq.split('|'); shopQty['bd-' + p[0]] = Math.max(1, Math.min(20, (shopQty['bd-' + p[0]] || 1) + (+p[1]))); baseShopRefresh(); return; }
    if (b.dataset.bbuy) {
      var q2 = b.dataset.bbuy.split('|'), t = q2[0], k = q2[1], n = t === 'deco' ? Math.max(1, Math.min(20, shopQty['bd-' + k] || 1)) : 1;
      b.disabled = true;
      txRun('baseBuy', { t: t, k: k, n: n }, function (r) {
        shopQty['bd-' + k] = 1; renderRes(); baseShopRefresh();
        toast(t === 'room' ? '买到了房型「' + TX.D.BASE_ROOMS[k].n + '」！在基地点「编辑基地」就能换上。' : '买到了「' + TX.D.BASE_DECO[k].n + '」×' + r.n + '，消耗 ' + fmt(r.cost) + ' 能量。在基地点「编辑基地」摆出来吧。');
      }, function () { b.disabled = false; });
    }
  });
  function renderTeaShop() {
    var nCap = Math.min(4, (acc.home && acc.home.cap) || 0), capPrice = CAP_PRICE[nCap], A0 = TEA_SHOP.auto, q = shopQty.tsauto || 1, cost = A0.price * q, ok = acc.energy >= cost;
    $('pg-explore').innerHTML = exHead('陆羽茶室大厅里的小商店，卖茶室专用的东西。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="ts-back">‹ 返回茶室大厅</button><b>陆羽茶室 · 茶室商店</b></div>' +
      '<div class="shop-bal"><span class="tape l"></span>当前能量 <b>' + fmt(acc.energy) + '</b></div>' +
      '<div class="shop-grid">' +
      '<article class="shop-it"><span class="tape r"></span><span class="it-ic ts-ic" aria-hidden="true">⏱</span><div class="si-txt"><b>' + A0.name + '</b><p class="hint">' + esc(A0.d) + '</p>' +
        '<p class="si-own">持有 <b>' + (acc.items.auto || 0) + '</b></p></div>' +
        '<div class="si-buy"><span class="si-price">' + fmt(A0.price) + ' <small>能量</small></span>' +
        '<div class="qty"><button type="button" class="btn ghost" data-tsq="-1" aria-label="减少"' + (q <= 1 ? ' disabled' : '') + '>−</button><span aria-live="polite">' + q + '</span><button type="button" class="btn ghost" data-tsq="1" aria-label="增加"' + (q >= 20 ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="btn primary" data-tsbuy="auto"' + (ok ? '' : ' disabled') + '>' + (ok ? '兑换 · ' + fmt(cost) : '能量不足') + '</button></div></article>' +
      '<article class="shop-it"><span class="tape r"></span><span class="it-ic ts-ic" aria-hidden="true">＋</span><div class="si-txt"><b>基地精灵容量 +1</b><p class="hint">基地里能同时展示的精灵多 1 只。基础 ' + HOME_BASE + ' 只，最多买 4 次，价格依次 ' + CAP_PRICE.map(fmt).join(' / ') + ' 能量。</p>' +
        '<p class="si-own">现在能展示 <b>' + homeMax() + '</b> 只 · 已购买 <b>' + nCap + '</b> / 4</p></div>' +
        '<div class="si-buy">' + (capPrice ? '<span class="si-price">' + fmt(capPrice) + ' <small>能量</small></span><button type="button" class="btn primary" data-tsbuy="cap"' + (acc.energy >= capPrice ? '' : ' disabled') + '>' + (acc.energy >= capPrice ? '扩容' : '能量不足') + '</button>' : '<span class="hint">已经扩到最大（' + homeMax() + ' 只）了</span>') + '</div></article>' +
      '</div>';
  }
  function teaShopBuy(k) {
    if (k === 'auto') {
      var q = shopQty.tsauto || 1, cost = TEA_SHOP.auto.price * q;
      if (acc.energy < cost) return;
      txRun('tea', { k: 'auto', n: q }, function (r) {
        shopQty.tsauto = 1; renderRes(); if (ex.view === 'teashop') renderTeaShop();
        toast('兑换成功：7日自律训练装置 ×' + r.n + '，消耗 ' + fmt(r.cost) + ' 能量。去「我的房间」给展示中的精灵装上。');
      });
      return;
    }
    if (k === 'cap') {
      var H = home(), n = Math.min(4, H.cap || 0), price = CAP_PRICE[n];
      if (!price || acc.energy < price) return;
      txRun('tea', { k: 'cap' }, function () {
        renderRes(); if (ex.view === 'teashop') renderTeaShop();
        toast('茶室扩容成功！现在可以同时展示 ' + homeMax() + ' 只精灵。');
      });
    }
  }
  // 大厅：从这里进入自己和朋友们的房间
  var ROOMS = [
    { k: 'me', pos: [16, 60] },
    { k: 't', n: 'Threego 的房间', pos: [33, 34] },
    { k: 'h', n: 'Dr.黄 的房间', pos: [67, 34] },
    { k: 'b', n: 'Bttp 的房间', pos: [84, 60] }
  ];
  function hallSpots() {
    var open = homeOpen();
    return '<button type="button" class="mk shop' + (open ? '' : ' locked') + '"' + (open ? ' data-teashop="1"' : ' disabled') + ' style="left:50%;top:72%"><span class="mk-dot">' + (open ? '商' : '锁') + '</span><span class="mk-lab"><b>茶室商店</b><small>' + (open ? '自律训练装置 · 基地扩容' : '读完「陆羽茶室」支线后开放') + '</small></span></button>' + ROOMS.map(function (R) {
      var me = R.k === 'me', label = me ? (open ? '我的基地 · ' + esc(home().name) : '我的基地') : R.n, inside = !me && open && npcHome(R.k);
      return '<button type="button" class="mk shop home' + (me ? '' : ' fr') + (inside ? ' npc-in' : '') + (open ? '' : ' locked') + '"' + (open ? (me ? ' data-home="1"' : ' data-room="' + R.k + '"') : ' disabled') + ' style="left:' + R.pos[0] + '%;top:' + R.pos[1] + '%"><span class="mk-dot">' + (open ? (me ? '家' : '门') : '锁') + '</span><span class="mk-lab"><b>' + label + '</b><small>' + (open ? (me ? '你的基地：展示精灵、摆放摆件' : inside ? '● 主人在家 · 点击拜访' : '点击拜访') : '读完「陆羽茶室」支线后开放') + '</small></span></button>';
    }).join('');
  }
  // Threego 房间里固定展示：LV8 小胖虎 + LV7 的「被玩家主宠克制的那只初始精灵」
  function weakStarter() {
    var my = acc.starter && SPMAP[acc.starter].types[0];
    return STARTERS.filter(function (sid) { return sid !== acc.starter && my && eff(my, SPMAP[sid].types[0]) > 1; })[0] || STARTERS.filter(function (sid) { return sid !== acc.starter; })[0];
  }
  /* ---------- 朋友回家：Threego / Dr.黄 / Bttp 每天在随机时段回房间，对话后可以对战 ----------
   * 时段和携带的精灵都用「北京时间的日期」做种子算出来，所有玩家同一天看到的一样（全服共通）。
   * 精灵等级 = 玩家出战配队平均等级 −5 / 0 / +5（三个等级随机分给三只）。电脑操作为白银段位水平。
   * 胜利奖励 3000 累积经验，每个人每天最多领一次。 */
  // 朋友们的房间：NPC 资料和每天的安排在 js/engine/pve.js（服务器和浏览器共用，2026-10-25）
  var NPC_WIN_EXP = PVE.NPC_WIN_EXP, NPC_HOURS = PVE.NPC_HOURS, NPC_FROM = PVE.NPC_FROM, NPC_TO = PVE.NPC_TO, NPC_AI_RANK = PVE.NPC_AI_RANK, NPC = PVE.NPC, NPC_SECRET = PVE.NPC_SECRET, NPC_POOL = PVE.NPC_POOL;
  function bjNow() { return new Date(Date.now() + 8 * 3600e3); }
  function bjDay() { return PVE.bjDay(Date.now()); }
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = (h + 0x6D2B79F5) | 0; var t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function npcPlan(k, day) { return PVE.npcPlan(k, day || bjDay()); }
  function npcHome(k) { if (!NPC[k]) return false; var P = npcPlan(k), d = bjNow(), h = d.getUTCHours() + d.getUTCMinutes() / 60; return h >= P.start && h < P.end; }
  function npcWon(k) { return !!(acc.npcWin && acc.npcWin.d === bjDay() && acc.npcWin[k]); }
  function teamAvgLv() {
    var t = (acc.teams[acc.active] || []).map(mon).filter(Boolean); if (!t.length) t = acc.mons;
    return t.length ? Math.round(t.reduce(function (a, m) { return a + m.lv; }, 0) / t.length) : START_LV;
  }
  function npcTeam(k) {
    var avg = teamAvgLv();
    return npcPlan(k).team.map(function (x) { var lv = Math.max(1, Math.min(100, avg + x.rel)); var o = storyMon({ sid: x.sid, lv: lv, moves: [], nat: x.nat }); delete o.u; delete o.hl; return o; });
  }
  function npcArt(k, face) { var N = NPC[k]; return CHARS[(face ? N.img + '_' + face : N.img)] || CHARS[N.img]; }
  function npcTalk(k) {
    if (!npcHome(k)) { toast(NPC[k].name + ' 刚刚出门了。'); renderRoom(); return; }
    var N = NPC[k], L = N.lines[Math.floor(Math.random() * N.lines.length)], won = npcWon(k);
    var d = document.createElement('div'); d.className = 'soc-dlg npc-dlg';
    d.innerHTML = '<div class="soc-box npc-box" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span>' +
      '<img class="npc-face" src="' + npcArt(k, L[0]) + '" alt="' + esc(N.name) + '"><div class="npc-say"><span class="step">' + esc(N.name) + '</span><p class="npc-line">' + esc(fill(L[1])) + '</p>' +
      '<p class="hint">' + esc(N.name) + ' 会带 3 只精灵，实力与你相当。' + (won ? '今天已经领过 ' + esc(N.name) + ' 的胜利奖励了，还可以继续切磋。' : '获胜可得 ' + fmt(NPC_WIN_EXP) + ' 累积经验（每天一次）。') + '</p>' +
      '<div class="soc-foot"><button type="button" class="btn ghost" data-npcx="1">下次再说</button><button type="button" class="btn primary" data-npcgo="1">开始对战</button></div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-npcx]')) { d.remove(); return; }
      if (e.target.closest('[data-npcgo]')) { d.remove(); npcFight(k); }
    });
  }
  function npcFight(k) {
    if (!npcHome(k)) { toast(NPC[k].name + ' 刚刚出门了。'); renderRoom(); return; }
    if (srvMode()) return pveRemote('npc', { k: k }, { bg: BG.tea_p, back: NPC[k].name + ' 的房间' }, function (e, res) {
      var N = NPC[k], msg = '', r = e && e.rep;
      if (r && r.res === 'win') msg = r.exp ? '击败了 ' + N.name + '！累积经验 +' + fmt(r.exp) + '，已放进经验背包。' : '又赢了 ' + N.name + '！今天的胜利奖励已经领过了，明天再来。';
      else if (r && r.res === 'lose') msg = N.name + '：嘿嘿，下次再来挑战吧！';
      else if (res === 'void') msg = '这场对战作废了。';
      save();
      ex.fighting = false; document.body.classList.remove('story-fight');
      ex.view = 'room'; ex.room = k; ex.area = '天门';
      $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
      renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
      if (msg) toast(msg);
    });
    var N = NPC[k], team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    team = team.slice(0, TEAM_SIZE);
    var a = npcTeam(k);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight'); syncBattle();
    $('pg-explore').hidden = true; $('pg-arena').hidden = false;
    window.HSBATTLE.start({ p: team.map(storyMon), a: a, foe: N.name, bg: BG.tea_p, back: N.name + ' 的房间', ai: rankAI(NPC_AI_RANK),
      onEnd: function (res, seen, downs) {
        var msg = '';
        (downs || []).forEach(function (x) { seeMon(x.id, x.lv); });
        if (res === 'win') {
          if (!npcWon(k)) {
            if (!acc.npcWin || acc.npcWin.d !== bjDay()) acc.npcWin = { d: bjDay() };
            acc.npcWin[k] = 1; earn('npc', bjDay() + ':' + k, { exp: NPC_WIN_EXP });
            msg = '击败了 ' + N.name + '！累积经验 +' + fmt(NPC_WIN_EXP) + '，已放进经验背包。';
          } else msg = '又赢了 ' + N.name + '！今天的胜利奖励已经领过了，明天再来。';
        } else if (res === 'lose') msg = N.name + '：嘿嘿，下次再来挑战吧！';
        save();
        ex.fighting = false; document.body.classList.remove('story-fight');
        ex.view = 'room'; ex.room = k; ex.area = '天门';
        $('pg-arena').hidden = page !== 'arena'; $('pg-explore').hidden = page !== 'explore';
        renderTop(); syncBattle(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
        if (msg) toast(msg);
      } });
  }
  // 房间里固定展示的精灵：Threego 是小胖虎和被玩家主宠克制的初始精灵，Dr.黄 是董之马（至高之盾的一阶）
  function roomShow(k) { return k === 't' ? [{ sid: 'tagore', lv: 8 }, { sid: weakStarter(), lv: 7 }] : k === 'h' ? [{ sid: 'aegis', lv: 10 }] : []; }
  function renderRoom() {
    var R = ROOMS.filter(function (x) { return x.k === ex.room; })[0], list = roomShow(R.k);
    var figs = list.map(function (x, i) {
      var f = form(x), p = HOME_POS[i];
      return '<div class="hm-fig" data-csid="' + x.sid + '" data-cst="' + (f.stage || 0) + '" data-cctx="home" style="left:' + p[0] + '%;top:' + p[1] + '%"><button type="button" class="hm-poke" data-hpoke="1" aria-label="摸摸' + esc(f.name) + '"><img src="' + f.img + '" alt=""></button><span class="hm-tag">' + esc(f.name) + ' · LV' + x.lv + '</span></div>';
    }).join('');
    var N = NPC[R.k], inside = N && npcHome(R.k), won = N && npcWon(R.k);
    $('pg-explore').innerHTML = exHead('朋友们的房间暂时都长得一样。他们每天会在某个时间回来待一阵子，在家时可以找他们对战。') +
      '<div class="crumb"><button type="button" class="btn ghost" id="home-back">‹ 返回大厅</button><b class="home-name">' + R.n + '</b></div>' +
      '<div class="home-room"><img class="home-bg" src="' + BG.tea_p + '" alt="' + R.n + '">' + figs +
      (inside ? '<button type="button" class="npc-stand" data-npctalk="' + R.k + '" aria-label="和 ' + esc(N.name) + ' 对话"><img src="' + npcArt(R.k) + '" alt=""><span class="npc-bubble">！</span></button>' : '') +
      (list.length || inside ? '' : '<p class="home-empty">房间的主人不在，这里还没有展示精灵。</p>') + '</div>' +
      (N ? '<div class="tea-bar npc-bar"><span class="tape l"></span><div class="tea-txt"><b>' + (inside ? esc(N.name) + ' 在家' : esc(N.name) + ' 不在房间里') + '</b>' +
        '<p class="hint">' + (inside ? '点房间里的 ' + esc(N.name) + ' 或右边的按钮和 TA 说话，会进入对战。胜利奖励 ' + fmt(NPC_WIN_EXP) + ' 累积经验，每天一次。快去通知其他船员来拜访' + N.pron + '吧！' : esc(N.away) + N.pron + '会在什么时候回来呢？不妨问问其他船员吧。') + '</p>' +
        '<p class="tea-left">今天的胜利奖励：<b>' + (won ? '已领取' : '未领取') + '</b></p></div>' +
        '<button type="button" class="btn primary" data-npctalk="' + R.k + '"' + (inside ? '' : ' disabled') + '>' + (inside ? '对话' : '不在家') + '</button></div>' : '') +
      (list.length ? '<p class="hint" style="margin-top:8px">' + (N ? esc(N.name) : '主人') + ' 在房间里展示着' + (R.k === 't' ? '她' : '他') + '的伙伴。点它们可以摸摸。</p>' : '');
  }
  function saveHomeName() {
    var ip = $('home-name'); if (!ip) return;
    var v = Array.from(ip.value.trim()).slice(0, 10).join('');
    if (!v) { toast('名字不能为空。'); return; }
    home().name = v; save(); ex.homeEdit = false; renderHome(); toast('基地改名为「' + v + '」。');
  }
  function toggleHomeMon(u) {
    var H = home(), i = -1;
    H.mons.forEach(function (x, k) { if (x.u === u) i = k; });
    if (i >= 0) {
      if (H.mons[i].auto && ex.hmArm !== u) { ex.hmArm = u; renderHome(); setTimeout(function () { if (ex.hmArm === u) { ex.hmArm = null; if (ex.view === 'home') renderHome(); } }, 4000); return; }
      ex.hmArm = null;
      txRun('home', { a: 'out', u: u }, function (res) {   // 走交易（grow.js）：经验由服务器按展示时间算
        var m = mon(u), msg = res.g ? gainMsg(res.g) : null;
        if (res.min >= 60) dailyNote('home');   // 进度由交易加（grow.js）
        renderHome(); renderRes();
        toast(form(m).name + ' 回来了（展示了 ' + durText(res.min) + '）。' + (msg || '展示时间太短，还没有获得经验。'));
      });
      return;
    }
    if (H.mons.length >= homeMax()) return;
    txRun('home', { a: 'in', u: u }, function () { renderHome(); });
  }
  $('pg-explore').addEventListener('keydown', function (e) { if (e.target.id === 'home-name') { if (e.key === 'Enter') { e.preventDefault(); saveHomeName(); } else if (e.key === 'Escape') { ex.homeEdit = false; renderHome(); } } });

  /* ---------- 任务：主线 / 支线 / 世界 ---------- */
  var MAIN_Q = ['school', 'river', 'jiuquan', 'board', 'flora1', 'flora2', 'flora3', 'flora4', 'flora5', 'flora6', 'flora7', 'kb1', 'kb2', 'kb3', 'kb4', 'kb5', 'kb6', 'kb7', 'kb8'], EVENT_Q = ['mmTrial'], SIDE_Q = ['academy', 'xiaogan', 'brawl', 'draft', 'storage', 'tiger', 'tiger2', 'tea', 'rare', 'mingming', 'medal', 'spa', 'fl_chal', 'hiddenSk'];
  // 世界任务（奖励暂定）
  var WQ = [
    { id: 'w_first', n: '初到芙罗拉', d: '荆楚号已经抵达芙罗拉星。去丛林或草甸，和那里的野生精灵过过招吧。', where: '芙罗拉星 · 丛林 / 草甸', steps: [{ t: '在芙罗拉星击败 1 只野生精灵', k: 'wins', n: 1 }], after: 'flora1', go: 'flora' },
    { id: 'w_karo', n: '草甸上的奔跑者', d: '卡罗成群地在草甸上奔跑，捕捉率很高，很适合用来练习捕捉。', where: '芙罗拉星 · 草甸', steps: [{ t: '捕捉 1 只卡罗', k: 'own:wind', n: 1 }], after: 'flora1', go: 'flora' },
    { id: 'w_mush', n: '林下的蘑菇', d: '丛林的树荫下，常能看到玛西的身影。', where: '芙罗拉星 · 丛林', steps: [{ t: '捕捉 1 只玛西', k: 'own:mush', n: 1 }], after: 'flora1', go: 'flora' },
    { id: 'w_hunt', n: '荒野试炼', d: '多和野生精灵交手，伙伴们才会变强。', where: '芙罗拉星 · 丛林 / 草甸', steps: [{ t: '在芙罗拉星击败 10 只野生精灵', k: 'wins', n: 10 }], after: 'flora1', go: 'flora' },
    { id: 'w_kaleo', n: '丛林里的掠食者', d: '有人在丛林深处见过一只卡莱。它只在丛林出现，而且很少露面。', where: '芙罗拉星 · 丛林', steps: [{ t: '捕捉 1 只卡莱', k: 'own:kaleo', n: 1 }], after: 'flora1', go: 'flora' },
    { id: 'w_travel', n: '旅行猫', d: '叶子喵是芙罗拉星上很少见的精灵。听说最近有人在山毛榉林里见过一只……', where: '芙罗拉星 · 剧情', steps: [{ t: '读完芙罗拉星的剧情「旅行猫」', k: 'story:travelcat', n: 1 }], after: 'flora2', go: 'flora', fpart: 'story' },
    { id: 'w_yado', n: '冰封深处的小精灵？', d: '白之星的冰层深处，好像有精灵的信号……', where: '白之星 · 剧情', steps: [{ t: '读完白之星的世界任务「冰封深处的小精灵？」', k: 'story:iceYado', n: 1 }], after: 'flora7', go: 'white', fpart: 'story' },
    { id: 'w_barren', n: '荒芜的谜团？', d: 'Cumber 说，芙罗拉星的瘴气是莠去津的变种。那只荒芜，到底是什么？', where: '芙罗拉星 · 剧情', steps: [{ t: '读完芙罗拉星的世界任务「荒芜的谜团？」', k: 'story:barrenMys', n: 1 }], after: 'kb8', go: 'flora', fpart: 'story' },
    { id: 'w_dex', n: '见习做题家', d: '黄冈秘鉴里亮起的页数越多，做题家就越受人尊敬。', where: '黄冈秘鉴', steps: [{ t: '在黄冈秘鉴中点亮 3 类精灵', k: 'lit', n: 3 }], after: 'academy', go: 'dex' }
  ];
  WQ.forEach(function (x) { x.reward = RW.QUEST[x.id] || x.reward; });   // 奖励数额在 js/engine/rewards.js（服务器按它核对）
  function qStat(k) {
    if (!acc.stats) acc.stats = {};
    if (k === 'wins') return acc.stats.wildWins || 0;
    if (k === 'lit') return litCount();
    if (k.indexOf('story:') === 0) return prog(k.slice(6)).done ? 1 : 0;
    if (k.indexOf('own:') === 0) { var sid = k.slice(4); return acc.mons.filter(function (m) { return m.sid === sid; }).length; }
    return 0;
  }
  function qClaimed(id) { return !!(acc.quests && acc.quests[id]); }
  // 状态：lock 未解锁 / todo 可进行 / doing 进行中 / claim 可领取 / done 已完成
  function qState(id) {
    var W = wq(id);
    if (W) {
      if (W.after && !prog(W.after).done) return 'lock';
      if (qClaimed(id)) return 'done';
      return W.steps.every(function (x) { return qStat(x.k) >= x.n; }) ? 'claim' : 'doing';
    }
    var pr = prog(id); if (!unlocked(id)) return 'lock';
    if (id === 'tiger') return bossWon('tiger') ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'tiger2') return bossWon('tiger', 1) ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'brawl') return brawlPlayed() ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'draft') return pr.done && draftPlayed() ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'rare') return prog('rare_r').done ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'fl_chal') return pr.done && chalStars('fl2') > 0 && helperSet() ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    if (id === 'flora2') return pr.done && spareN() >= SPARE_N ? 'done' : pr.done || pr.at > 0 ? 'doing' : 'todo';
    return pr.done ? 'done' : pr.at > 0 ? 'doing' : 'todo';
  }
  function wq(id) { for (var i = 0; i < WQ.length; i++) if (WQ[i].id === id) return WQ[i]; return null; }
  var QLAB = { lock: '未解锁', todo: '可进行', doing: '进行中', claim: '可领取', done: '已完成' };
  function qList(tab) { return tab === 'main' ? MAIN_Q : tab === 'side' ? SIDE_Q : tab === 'event' ? EVENT_Q.filter(function (id) { return id !== 'mmTrial' || mmLive() || prog(id).done; }) : tab === 'daily' ? [] : WQ.map(function (w) { return w.id; }); }
  function qTodo(tab) { if (tab === 'daily') { var D = daily(); return D ? D.list.filter(function (t) { return !t.c; }).length : 0; } return qList(tab).filter(function (id) { var st = qState(id); return st === 'todo' || st === 'doing' || st === 'claim'; }).length; }
  function holoHead(hint) { return '<div class="page-head ex-head holo-head"><h2 class="sec">全息作战 · 明明教官的试炼</h2>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>'; }   // 明明教官的试炼不管从哪里进，标题都是「全息作战」
  function exHead(hint) {
    return '<div class="page-head ex-head"><h2 class="sec">' + (shipCtx() ? '飞船终端' : '星际探索') + '</h2>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  }
  function qName(id) { var W = wq(id); return W ? W.n : SITES[id].chapter.split(' · ')[1]; }
  function qWhere(id) {
    var W = wq(id); if (W) return W.where;
    var S = SITES[id], P = PLANETS.filter(function (p) { return p.id === S.planet; })[0];
    return P.name + ' · ' + (S.dept ? S.dept + ' · ' + DEPTS[S.dept][0] : S.name);
  }
  // 一个任务的完整信息：状态、步骤（ok 已完成，p 进度文字）、奖励、介绍、未开放原因
  function qInfo(id) {
    var W = wq(id), st = qState(id), steps, R, desc, need = '';
    if (W) {
      desc = W.d; R = W.reward;
      steps = W.steps.map(function (x) { var v = Math.min(qStat(x.k), x.n); return { t: x.t, ok: v >= x.n, p: v + ' / ' + x.n }; });
      if (st === 'lock') need = '读完「' + SITES[W.after].chapter.split(' · ')[1] + '」后开放。';
    } else {
      var S = SITES[id], pr = prog(id); desc = S.d; R = S.reward;
      steps = [{ t: '前往 ' + qWhere(id), ok: pr.done || pr.at > 0 }, { t: '读完剧情「' + qName(id) + '」', ok: pr.done }];
      if (S.chapter.indexOf('准备发射') >= 0) steps.splice(1, 0, { t: '和 Threego 进行剧情对战', ok: pr.done || !!pr.bt });
      if (id === 'brawl') steps = [{ t: '在孝感大厅听 Dr.黄 介绍精灵大乱斗', ok: pr.done }, { t: '打一场精灵大乱斗（竞技对战 → 精灵大乱斗，需要有其他船员在线）', ok: brawlPlayed() }];
      if (id === 'tiger') { steps = [{ t: '在古城防卫部听舰载广播介绍泰戈尔', ok: pr.done }, { t: '挑战并击败BOSS「泰戈尔」（只有水、火、草系技能能命中它）', ok: bossWon('tiger') }]; R = { mon: '小胖虎 LV10（首次击败）' }; }
      if (id === 'draft') steps = [{ t: '在孝感大厅听 Dr.黄 介绍竞技征召', ok: pr.done }, { t: '和其他船员打一场竞技征召（社交 → 向在线玩家宣战 → 5v5 · 平衡模式 · 竞技征召，胜负都算）', ok: draftPlayed() }];
      if (id === 'tiger2') { steps = [{ t: '在古城防卫部听泰戈尔介绍普通难度', ok: pr.done }, { t: '挑战并击败普通难度的「泰戈尔」（LV40，体力 1500，东北的纷争：物攻永久提升 30%）', ok: bossWon('tiger', 1) }]; R = { mon: '普通拳纹章、累积经验 ×20,000（首次击败普通难度）' }; }
      if (id === 'flora2') steps = [{ t: '前往 ' + qWhere(id), ok: pr.done || pr.at > 0 }, { t: '读完剧情「' + qName(id) + '」', ok: pr.done }, { t: '在芙罗拉星的丛林或草甸「假装击败」野生精灵（这个任务里野生精灵不会倒下，体力剩 1 点时就会逃走）', ok: spareN() >= SPARE_N, p: spareN() + ' / ' + SPARE_N }];
      if (id === 'fl_chal') steps = [{ t: '在古城防卫部听明明教官介绍挑战路线', ok: pr.done }, { t: '通过芙罗拉星挑战第二关（星际探索 → 芙罗拉星 → 挑战）', ok: chalStars('fl2') > 0 }, { t: '自己也挂一只助战精灵：社交 → 我的名片 → 助战精灵', ok: helperSet() }];
      if (id === 'rare') { var rr = prog('rare_r'); steps = [{ t: '在学院部听 Bttp 说明任务', ok: pr.done }, { t: '捕捉一种稀有精灵（芙罗拉星的丛林深处可能会有）', ok: rr.done || !!rareOwned() }, { t: '回到学院部，向 Bttp 汇报', ok: rr.done }]; R = SITES.rare_r.reward; desc = S.d; }
      if (st === 'lock') need = S.need && prog(S.after).done && !S.need() ? S.needText + (id === 'mingming' ? '（当前 ' + litCount() + ' / 10）' : id === 'brawl' ? '（当前持有 ' + acc.mons.length + ' 只）' : id === 'draft' ? '（当前 ' + speciesN() + ' / 10 种）' : id === 'flora3' ? '（当前 ' + spareN() + ' / ' + SPARE_N + '）' : '') + '。' : '先读完「' + SITES[S.after].chapter.split(' · ')[1] + '」。';
    }
    return { W: W, st: st, steps: steps, R: R, desc: desc, need: need };
  }
  function qDetail(id) {
    if (!id) return '<p class="empty-note">点击左边的任务，查看需要做什么。</p>';
    var I = qInfo(id), W = I.W, st = I.st, steps = I.steps, R = I.R, desc = I.desc, need = I.need;
    var rw = R ? rwList(R) : []; if (!W && UNLOCK[id]) rw.push('开放「' + UNLOCK[id] + '」');
    var cur = steps.filter(function (x) { return !x.ok; })[0];
    var act = st === 'lock' ? '' : st === 'claim' ? '<button type="button" class="btn primary" data-qclaim="' + id + '">领取奖励</button>'
      : st === 'done' ? (W ? '' : '<button type="button" class="btn" data-qgo="' + id + '">前往重温</button>')
      : '<button type="button" class="btn primary" data-qgo="' + id + '">' + (W ? '前往' : st === 'doing' ? '前往继续' : '前往') + ' ' + esc(qWhere(id).split(' · ').slice(-1)[0]) + '</button>';
    var CHd = !W && chapterOf(id);
    return '<span class="tape r"></span><span class="q-kind">' + (W ? '世界任务' : SITES[id].side ? '支线任务' : '主线任务' + (CHd ? ' · ' + esc(CHd.n) : '')) + '</span><h3 class="q-title">' + esc(qName(id)) + '</h3>' +
      '<p class="q-st ' + st + '">' + QLAB[st] + '</p><p>' + esc(desc) + '</p>' +
      '<h4>需要做什么</h4><ol class="q-steps">' + steps.map(function (x) { return '<li class="' + (x.ok ? 'ok' : x === cur && st !== 'lock' ? 'cur' : '') + '"><span class="qs-dot">' + (x.ok ? '✓' : '') + '</span>' + esc(x.t) + (x.p ? '<b class="qs-p">' + x.p + '</b>' : '') + '</li>'; }).join('') + '</ol>' +
      (need ? '<p class="hint red">' + need + '</p>' : '') +
      '<p class="q-where"><b>地点</b>　' + esc(qWhere(id)) + '</p>' +
      (rw.length ? '<p class="q-rw"><b>奖励</b>　' + rw.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join(' ') + (st === 'done' && (W || prog(id).rewarded) ? '<span class="hint">（已领取）</span>' : '') + '</p>' : '') +
      '<div class="q-act">' + act + '</div>';
  }
  function renderQuests() {
    var tab = ex.qtab || 'main', ids = qList(tab);
    if (!ex.qsel || ids.indexOf(ex.qsel) < 0) {
      var pick = null; ['claim', 'doing', 'todo', 'done'].some(function (k) { var f = ids.filter(function (id) { return qState(id) === k; }); if (f.length) { pick = k === 'done' ? f[f.length - 1] : f[0]; return true; } });
      ex.qsel = pick;
    }
    var tabs = [['main', '主线任务'], ['side', '支线任务'], ['event', '活动任务'], ['world', '世界任务'], ['daily', '每日任务']].map(function (t) { var n = qTodo(t[0]); return '<button type="button" role="tab" class="tab' + (tab === t[0] ? ' on' : '') + '" aria-selected="' + (tab === t[0]) + '" data-qtab="' + t[0] + '">' + t[1] + (n ? '<i class="q-badge">' + n + '</i>' : '') + '</button>'; }).join('');
    var body = $('quest-body'); if (!body) return;
    renderQBadge();
    if (tab === 'daily') {
      body.innerHTML = '<div class="fparts q-tabs" role="tablist">' + tabs + '</div>' +
        '<article class="detail log-card wide">' + dailyHTML() + '</article>';
      return;
    }
    var lastCh = null;
    var list = ids.map(function (id) {
      var st = qState(id), CH = tab === 'main' ? chapterOf(id) : null, head = '';
      if (CH && CH !== lastCh) {   // 主线按章节分组，章节标题上写通关状态和章节大奖
        lastCh = CH;
        var got = chapterGot(CH.id);
        head = '<p class="q-chap"><b>' + esc(CH.n) + '</b><span class="' + (got ? 'ok' : '') + '">' + (got ? '已通关' : CH.wip ? '未完待续' : '进行中') + '</span><small>章节大奖：' + (rwList(CH.reward).filter(Boolean).join('、') || '待定') + (got ? '（已领取）' : '') + '</small></p>';
      }
      return head + '<button type="button" class="q-item ' + st + (ex.qsel === id ? ' sel' : '') + '" data-q="' + id + '"><span class="qi-n">' + esc(qName(id)) + '</span><span class="qi-w">' + esc(qWhere(id)) + '</span><span class="q-st ' + st + '">' + QLAB[st] + '</span></button>';
    }).join('');
    if (tab === 'main' && ids.every(function (id) { return qState(id) === 'done'; })) list += '<p class="hint q-more">后续主线正在制作中（未完待续）。</p>';
    body.innerHTML = '<div class="fparts q-tabs" role="tablist">' + tabs + '</div>' +
      '<div class="q-wrap"><div class="q-list">' + list + '</div><article class="detail q-detail" id="q-detail">' + qDetail(ex.qsel) + '</article></div>';
  }
  function questGo(id) {
    var W = wq(id); closeQuests();
    if (W) {
      if (W.go === 'dex') { if (dexOpen()) go('dex'); return; }
      ex.planet = W.go; ex.view = 'sites'; ex.fpart = W.fpart || 'catch'; go('explore'); renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return;
    }
    if (id === 'mmTrial' && prog(id).done && mmOpen()) { ex.planet = 'station'; ex.view = 'mmArena'; go('explore'); renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }   // 读完活动任务后直接去全息作战场地
    var S = SITES[id]; ex.planet = S.planet; go('explore');
    if (id === 'fl_chal' && prog('fl_chal').done) { if (chalStars('fl2') > 0 && !helperSet()) { go('social'); toast('在「我的名片」里选一只助战精灵，保存名片即可。'); return; } ex.planet = 'flora'; ex.view = 'sites'; ex.fpart = 'challenge'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (S.dept) { teleport(S.dept); return; }
    ex.view = 'sites'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8);
  }
  function claimQuest(id) {
    var W = wq(id); if (!W || qState(id) !== 'claim') return;
    var R = W.reward;
    txRun('quest', { id: id }, function () {   // 服务器按它的存档判断（js/engine/quest.js）
      renderRes(); renderQuests();
      toast('完成世界任务「' + W.n + '」！获得 ' + rwList(R).join('、') + '。');
    });
  }

  /* ---------- 顶栏「任务」：在名字旁边。鼠标移上去看进行中任务的进度，点开是完整的任务面板 ---------- */
  function qAllTodo() { try { return qTodo('main') + qTodo('side') + qTodo('event') + qTodo('world') + dailyClaimable(); } catch (e) { return 0; } }
  function renderQBadge() { var b = $('qtop-badge'); if (!b || !ready()) return; var n = qAllTodo(); b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
  function openQuests(tab) {
    if (!ready()) return;
    hideQPeek();
    if (tab) { ex.qtab = tab; ex.qsel = null; }
    var d = $('quest-dlg');
    if (!d) {
      d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'quest-dlg';
      d.innerHTML = '<div class="soc-box quest-box" role="dialog" aria-modal="true" aria-label="任务"><span class="tape l"></span><span class="tape r"></span>' +
        '<div class="quest-head"><div><span class="step">任务</span><h2>任务面板</h2></div><button type="button" class="btn ghost" data-qx="1">关闭</button></div>' +
        '<p class="hint">主线、支线、活动、世界任务和每日任务。点一个任务，查看需要做什么，并可以一键前往。</p><div id="quest-body"></div></div>';
      document.body.appendChild(d);
      d.addEventListener('click', questClick);
    }
    renderQuests();
  }
  function closeQuests() { var d = $('quest-dlg'); if (d) d.remove(); }
  function questClick(e) {
    var d = $('quest-dlg');
    if (e.target === d || e.target.closest('[data-qx]')) { closeQuests(); return; }
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.qtab) { ex.qtab = b.dataset.qtab; ex.qsel = null; renderQuests(); return; }
    if (b.dataset.q) { ex.qsel = b.dataset.q; renderQuests(); var q = $('q-detail'); if (q && window.innerWidth < 760) q.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (b.dataset.qgo) { questGo(b.dataset.qgo); return; }
    if (b.dataset.dclaim) { claimDaily(+b.dataset.dclaim, function () { renderQuests(); if (page === 'log') renderLog(); }); return; }
    if (b.dataset.qclaim) { claimQuest(b.dataset.qclaim); return; }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('quest-dlg')) closeQuests(); });
  // 悬停小窗：只列进行中 / 可领取的任务，每个写出当前这一步和进度
  function qPeekHTML() {
    var rows = [];
    [['main', '主线'], ['side', '支线'], ['event', '活动'], ['world', '世界']].forEach(function (T) {
      qList(T[0]).forEach(function (id) {
        var st = qState(id); if (st !== 'doing' && st !== 'claim') return;
        var I = qInfo(id), done = I.steps.filter(function (x) { return x.ok; }).length, n = I.steps.length;
        var cur = I.steps.filter(function (x) { return !x.ok; })[0];
        var pct = cur && cur.p ? (function () { var m = /(\d+) \/ (\d+)/.exec(cur.p); return m ? +m[1] / +m[2] : done / n; })() : done / n;
        rows.push('<li class="qp-row ' + st + '" data-qpeek="' + id + '"><span class="qp-k">' + T[1] + '</span><b>' + esc(qName(id)) + '</b>' +
          '<span class="qp-step">' + (st === 'claim' ? '已完成，可以领取奖励' : esc(cur ? cur.t : '')) + '</span>' +
          '<span class="qp-bar"><i style="width:' + Math.round((st === 'claim' ? 1 : pct) * 100) + '%"></i></span><em>' + (st === 'claim' ? '可领取' : cur && cur.p ? cur.p : '第 ' + (done + 1) + ' / ' + n + ' 步') + '</em></li>');
      });
    });
    var D = daily(), dl = '';
    if (D) {
      var c = D.list.filter(function (t) { return t.c; }).length, ok = D.list.filter(function (t) { return !t.c && t.p >= DAILY[t.id].n; }).length;
      dl = '<li class="qp-row daily' + (ok ? ' claim' : '') + '" data-qpeek="daily"><span class="qp-k">每日</span><b>今天的每日任务</b><span class="qp-step">已领取 ' + c + ' 个' + (ok ? '，还有 ' + ok + ' 个可以领取' : '') + '</span>' +
        '<span class="qp-bar"><i style="width:' + Math.round((c + ok) / D.list.length * 100) + '%"></i></span><em>' + (c + ok) + ' / ' + D.list.length + '</em></li>';
    }
    return '<p class="qp-h"><b>进行中的任务</b><span class="hint">点击打开任务面板</span></p>' +
      (rows.length ? '<ul class="qp-list">' + rows.join('') + dl + '</ul>' : '<ul class="qp-list">' + dl + '</ul><p class="hint qp-none">没有进行中的主线、支线或世界任务。</p>');
  }
  var qPeekT = 0;
  function showQPeek() {
    if (!ready() || $('quest-dlg')) return;
    clearTimeout(qPeekT);
    var p = $('qtop-pop'); p.innerHTML = qPeekHTML(); p.hidden = false;
  }
  function hideQPeek() { clearTimeout(qPeekT); var p = $('qtop-pop'); if (p) p.hidden = true; }
  if ($('qtop-wrap')) {
    var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    $('qtop-wrap').addEventListener('mouseenter', function () { if (canHover) showQPeek(); });
    $('qtop-wrap').addEventListener('mouseleave', function () { qPeekT = setTimeout(hideQPeek, 150); });
    $('qtop-btn').addEventListener('click', function () { openQuests(); });
    $('qtop-pop').addEventListener('click', function (e) {
      var r = e.target.closest('[data-qpeek]'); if (!r) { openQuests(); return; }
      var id = r.dataset.qpeek;
      if (id === 'daily') { openQuests('daily'); return; }
      ex.qtab = wq(id) ? 'world' : SITES[id].event ? 'event' : SITES[id].side ? 'side' : 'main'; ex.qsel = id; openQuests();
    });
  }

  $('pg-explore').addEventListener('click', function (e) {
    if (ex.mode === 'replay' && $('vn')) { vnClick(e); return; }
    if (ex.view === 'shop' && shopClick(e)) return;
    if (e.target.closest('#bsoc')) { bsocClick(e); return; }
    var b = e.target.closest('button, .dept.open'); if (!b) return;
    if (chalClick(b)) return;
    if (towerClick(b)) return;
    if (b.dataset.smq) { shipQuickGo(b.dataset.smq); return; }
    if (b.dataset.area) { teleport(b.dataset.area); return; }
    if (b.dataset.npctalk) { npcTalk(b.dataset.npctalk); return; }
    if (b.dataset.room) { ex.view = 'room'; ex.room = b.dataset.room; ex.area = '天门'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); mysteryRoll('荆楚号 · 陆羽茶室'); return; }
    if (b.dataset.home) { ex.view = 'home'; ex.area = '天门'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); mysteryRoll('荆楚号 · 陆羽茶室'); return; }
    if (b.dataset.endless) { ex.view = 'endless'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.summon) { ex.view = 'summon'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.bosshub) { ex.view = 'bosshub'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.boss) { var BB = BOSSES[b.dataset.boss]; ex.bossFrom = b.dataset.from || null; ex.view = 'boss'; ex.boss = b.dataset.boss; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); mysteryRoll(BB.dept ? '荆楚号 · ' + DEPTS[BB.dept][0] : bossWhere(BB)); return; }
    if (b.dataset.bossd) { ex.bossK = ex.boss; ex.bossD = +b.dataset.bossd; renderBoss(); return; }
    if (b.dataset.bossgo) { startBoss(b.dataset.bossgo, +b.dataset.d || 0); return; }
    if (b.dataset.weekly) { ex.wk = (+b.dataset.weekly || 1) - 1; ex.view = 'weekly'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.wkd) { ex.wk = +b.dataset.wkd; renderExplore(); return; }   // 每周挑战里切换难度
    if (b.dataset.weeklygo) { startBoss(curWk().boss, curWk().d, true); return; }
    if (b.dataset.archive) { ex.view = 'archive'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.arctab) { ex.arcTab = b.dataset.arctab; renderArchive(); return; }
    if (b.id === 'arc-back') { arcStop(); ex.view = 'planets'; renderExplore(); return; }
    if (b.dataset.arcmus) { arcMus(b.dataset.arcmus); return; }
    if (b.dataset.arcface) { var af = b.dataset.arcface.split('|'); if (!ex.arcFace) ex.arcFace = {}; ex.arcFace[af[0]] = +af[1]; renderArchive(); return; }
    if (b.dataset.arcplay) { arcStop(); ex.arcQ = []; ex.arc = true; startVN(b.dataset.arcplay, 'replay', $('pg-explore'), true); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.arcall) { arcStop(); var aq = Object.keys(SITES).filter(function (id) { return !SITES[id].side && prog(id).done; }); ex.arc = true; ex.arcQ = aq.slice(1); startVN(aq[0], 'replay', $('pg-explore'), true); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.arcgo) { var AS = SITES[b.dataset.arcgo]; ex.arc = false; ex.planet = AS.planet; if (AS.dept) { ex.view = 'area'; ex.area = AS.dept; } else { ex.view = 'sites'; if (AS.planet === 'flora') { ex.fpart = 'story'; ex.flSt = AS.side ? 'side' : 'main'; } } renderExplore(); return; }
    if (b.dataset.mmarena) { ex.view = 'mmArena'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.mmgo) { mmStart(b.dataset.mmgo, +b.dataset.d || 0); return; }
    if (b.dataset.goarena) { if (!arenaOpen()) { toast('读完星际探索 · 荆楚号 · 孝感大厅的剧情后，「竞技对战」才会开放。', prog('board').done ? '前往孝感大厅' : '', '孝感'); return; } go('arena'); return; }   // 太空竞技场 → 竞技对战
    if (b.dataset.mmgacha) { if (ex.mmFrom !== 'holo') ex.mmFrom = 'arena'; ex.view = 'mmGacha'; renderExplore(); return; }
    if (b.dataset.mmdraw) { mmDraw(+b.dataset.mmdraw || 1); return; }
    if (b.id === 'mm-back') { if (ex.mmFrom === 'holo') { ex.mmFrom = null; ex.view = 'planets'; go('holo'); return; } ex.view = 'sites'; ex.planet = 'station'; renderExplore(); return; }
    if (b.id === 'mmg-back') { if (ex.mmFrom === 'log') { go('log'); return; } if (ex.mmFrom === 'holo') { ex.mmFrom = null; ex.view = 'planets'; go('holo'); return; } ex.view = 'mmArena'; renderExplore(); return; }
    if (b.dataset.wkhub) { ex.view = 'wkhub'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.id === 'wkhub-back') { ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.ewk) { ex.ewkT = b.dataset.ewk; ex.view = 'ewk'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.ewkd) { ex.ewkD = +b.dataset.ewkd; renderEwk(); return; }
    if (b.dataset.ewkgo) { startEwk(ex.ewkT, ex.ewkD | 0); return; }
    if (b.id === 'ewk-back') { ex.view = 'wkhub'; renderExplore(); return; }
    if (b.id === 'boss-back') {
      var BK2 = BOSSES[ex.boss];
      if (ex.view === 'weekly') ex.view = 'wkhub';
      else if (ex.bossFrom === 'hub') ex.view = 'bosshub';
      else if (ex.bossFrom === 'field' && BK2.region) { enterField(BK2.region); return; }
      else if (BK2.dept) { ex.view = 'area'; ex.area = BK2.dept; }
      else { ex.view = 'sites'; ex.planet = BK2.planet; ex.fpart = 'catch'; }
      renderExplore(); return;
    }
    if (b.id === 'home-back') { ex.view = 'area'; ex.area = '天门'; renderExplore(); return; }
    if (b.id === 'home-rn') { ex.homeEdit = true; renderHome(); var ip = $('home-name'); if (ip) { ip.focus(); ip.select(); } return; }
    if (b.id === 'home-ok') { saveHomeName(); return; }
    if (b.id === 'home-cancel') { ex.homeEdit = false; renderHome(); return; }
    if (b.dataset.hreap) { homeReap(+b.dataset.hreap, b); return; }
    if (b.dataset.hm) { toggleHomeMon(+b.dataset.hm); return; }
    if (b.dataset.hauto) {
      var hx = home().mons.filter(function (x) { return x.u === +b.dataset.hauto; })[0];
      if (!hx || hx.auto || !(acc.items.auto > 0)) return;
      txRun('home', { a: 'auto', u: hx.u }, function () { renderHome(); });
      toast('给 ' + form(mon(hx.u)).name + ' 装上了 7日自律训练装置：每满 1 天自动结算经验，一共 7 天。'); return;
    }
    if (b.dataset.teashop) { ex.view = 'teashop'; ex.area = '天门'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.tsbuy) { teaShopBuy(b.dataset.tsbuy); return; }
    if (b.dataset.tsq) { shopQty.tsauto = Math.max(1, Math.min(20, (shopQty.tsauto || 1) + +b.dataset.tsq)); renderTeaShop(); return; }
    if (b.id === 'ts-back') { ex.view = 'area'; ex.area = '天门'; renderExplore(); return; }
    if (b.dataset.hpoke) { var f = b.closest('.hm-fig'); f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop'); return; }
    if (b.dataset.shop) { ex.view = 'shop'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.nursery) { ex.view = 'nursery'; ex.area = '神农架'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.spa) { if (!spaOpen()) return; ex.view = 'spa'; ex.area = '咸宁'; ex.planet = 'jingchu'; ex.spaPick = null; spa(); renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.id === 'spa-back') { ex.view = 'area'; ex.area = '咸宁'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.spaslot != null && b.dataset.spaslot !== '') { ex.spaPick = ex.spaPick === +b.dataset.spaslot ? null : +b.dataset.spaslot; renderSpa(); return; }
    if (b.dataset.spain) { spaPut(ex.spaPick, +b.dataset.spain); return; }
    if (b.dataset.spaout != null && b.dataset.spaout !== '') { spaPut(+b.dataset.spaout, null); return; }
    if (b.dataset.spastart) { spaStart(); return; }
    if (b.dataset.spaend) { spaLeaveAsk(function () { renderSpa(); }); return; }
    if (b.dataset.sparoom) { openSpaRoom(); return; }
    if (b.dataset.medal) { if (!medalOpen()) return; ex.view = 'medal'; ex.area = '黄冈'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.id === 'medal-back') { ex.view = 'area'; ex.area = '黄冈'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.promote) { promote(); return; }
    if (b.dataset.mdtype) { ex.mdType = b.dataset.mdtype; renderMedal(); return; }
    if (b.id === 'nursery-back') { ex.view = 'area'; ex.area = '神农架'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.incub) { nurseryPut(+b.dataset.incub.split('|')[0], b.dataset.incub.split('|')[1]); return; }
    if (b.dataset.hatch) { nurseryHatch(+b.dataset.hatch); return; }
    if (b.dataset.core) { openCore(); return; }
    if (b.dataset.forge) { ex.view = 'forge'; ex.area = '黄石'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.fq) { var fq = b.dataset.fq.split('|'), fr = forgeOf(fq[0]); if (fr && !b.disabled) { shopQty['fg-' + fq[0]] = Math.max(1, Math.min(FORGE_Q, (shopQty['fg-' + fq[0]] || 1) + +fq[1])); renderForge(); } return; }
    if (b.dataset.smelt) { forgeCraft(b.dataset.smelt); return; }
    if (b.dataset.fgcat) { ex.fgCat = b.dataset.fgcat; renderForge(); return; }
    if (b.dataset.gxfrom) { ex.gxFrom = b.dataset.gxfrom; if (ex.gxTo === ex.gxFrom) ex.gxTo = null; shopQty.gx = 1; renderForge(); return; }
    if (b.dataset.gxto) { ex.gxTo = b.dataset.gxto; renderForge(); return; }
    if (b.dataset.gxq) { if (!b.disabled) { shopQty.gx = Math.max(1, Math.min(FORGE_Q, (shopQty.gx || 1) + +b.dataset.gxq)); renderForge(); } return; }
    if (b.dataset.gxgo) { gxGo(); return; }
    if (b.id === 'forge-back') { ex.view = 'area'; ex.area = '黄石'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.farm) { if (!farmOpen()) return; ex.view = 'farm'; ex.area = '恩施'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.fpi != null && b.dataset.fpi !== '') { farmPlotClick(+b.dataset.fpi); return; }
    if (b.dataset.fpanel) { farmPanel(b.dataset.fpanel); return; }
    if (b.dataset.fharvest) { farmHarvestAll(); return; }
    if (b.dataset.fsow) { var fq = b.dataset.fsow.split('|'); farmPanel(null); farmPlant(+fq[0], fq[1]); return; }
    if (b.dataset.fsowall) { farmSowAll(b.dataset.fsowall); return; }
    if (b.dataset.gofarm) { if (!farmOpen()) return; ex.bpanel = null; ex.fpanel = null; ex.baseEdit = null; ex.view = 'farm'; ex.area = '恩施'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.gohome) { if (!homeOpen()) return; ex.bpanel = null; ex.fpanel = null; ex.view = 'home'; ex.area = '天门'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.sow != null && b.dataset.sow !== '') { var si = +b.dataset.sow, sel = document.querySelector('[data-sowsel="' + si + '"]'); if (sel) farmPlant(si, sel.value); return; }
    if (b.dataset.seedshop) { if (!farmOpen()) return; ex.view = 'seedshop'; ex.area = '恩施'; ex.planet = 'jingchu'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.sdq || b.dataset.sdbuy) { if (!b.disabled) seedShopClick(b); return; }
    if (b.dataset.reap != null && b.dataset.reap !== '') { farmHarvest(+b.dataset.reap); return; }
    if (b.id === 'farm-back') { ex.view = 'area'; ex.area = '恩施'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.fpart) { ex.fpart = b.dataset.fpart; renderExplore(); return; }
    if (b.dataset.flst) { ex.flSt = b.dataset.flst; renderExplore(); return; }
    if (b.dataset.cgview) { openCgView(b.dataset.cgview); return; }
    if (b.dataset.field && !b.disabled) { enterField(b.dataset.field); return; }
    if (b.dataset.gather != null && b.dataset.gather !== '') { gatherAt(+b.dataset.gather); return; }
    if (b.dataset.jade != null) { jadeAt(+b.dataset.jade); return; }
    if (b.dataset.bowl) { putBowl(); return; }
    if (b.dataset.horn) { blowHorn(); return; }
    if (b.dataset.ore) { mineOre(b.dataset.ore); return; }
    if (b.dataset.travel) { engageTravel(+b.dataset.travel); return; }
    if (b.dataset.kbw) { engageOdo(+b.dataset.kbw); return; }
    if (b.dataset.sgk) { storyGather(b.dataset.sgsite, b.dataset.sgk, b); return; }
    if (b.dataset.iceblk) { iceBreak(b); return; }
    if (b.dataset.fmnpc) { fmNpcTalk(); return; }
    if (b.dataset.wfid) { engageField(+b.dataset.wfid); return; }
    if (b.dataset.wfnav) { fieldNav(+b.dataset.wfnav); return; }
    if (b.id === 'field-back') { var FR = regionById(ex.region); ex.view = 'sites'; if (FR) ex.planet = FR.planet; ex.fpart = 'catch'; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.dataset.goshop) { ex.planet = 'jingchu'; ex.area = '荆门'; ex.view = 'shop'; ex.tp = true; renderExplore(); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); return; }
    if (b.id === 'ex-area') { ex.view = 'area'; renderExplore(); return; }
    if (b.id === 'ex-ship') { ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); return; }
    if (b.dataset.ctsign) { contestSign(); return; }
    if (b.dataset.ctdraw) { ctDrawShow(); return; }
    if (b.dataset.ctrematch) { if (window.HSSOCIAL && window.HSSOCIAL.ctRematch) window.HSSOCIAL.ctRematch(b.dataset.ctrematch); return; }
    if (b.dataset.ctfight) { if (window.HSSOCIAL && window.HSSOCIAL.ctAsk) { var M1 = CT.data && CT.data.myMatch; window.HSSOCIAL.ctAsk(b.dataset.ctfight, M1 ? M1.oppName : '', CONTEST.name + (M1 ? ' · ' + (M1.final ? '决赛' : '第 ' + M1.round + ' 轮') : '')); } return; }
    if (b.dataset.ctwatch) { if (window.HSSOCIAL && window.HSSOCIAL.watch) window.HSSOCIAL.watch(b.dataset.ctwatch); return; }
    if (b.dataset.ctrep) { if (window.HSSOCIAL && window.HSSOCIAL.replay) window.HSSOCIAL.replay(b.dataset.ctrep); return; }
    if (b.dataset.planet && !b.disabled) { ex.planet = b.dataset.planet; ex.view = 'sites'; renderExplore(); loadGate($('pg-explore'), '正在前往' + planetOf(b.dataset.planet).name + '～'); mysteryRoll(planetOf(b.dataset.planet).name); return; }
    if (b.id === 'ex-back') { var P_ = ex.view === 'sites' && planetOf(ex.planet); if (P_ && P_.inStation) { ex.planet = 'station'; renderExplore(); return; } if (ex.view === 'bosshub' || (P_ && SHIP_SIDE[P_.id])) { ex.view = 'sites'; ex.planet = 'jingchu'; renderExplore(); return; } ex.view = 'planets'; renderExplore(); return; }
    if (b.dataset.go && unlocked(b.dataset.go)) { ex.arc = false; startVN(b.dataset.go, 'replay', $('pg-explore'), b.dataset.from === '0'); HSVIEW.to(0, HSVIEW.top($('pg-explore')) - 8); }
  });

  $('pg-explore').addEventListener('keydown', function (e) { var g = e.target.closest && e.target.closest('.dept.open'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  /* ----- 对话舞台 ----- */
  // 剧情开始时在后台静默预加载这一段要用到的 CG 和背景图，免得播到时才开始下载（2026-10-17）
  var PRELOAD = {};
  function preloadImg(src) { if (!src || PRELOAD[src]) return PRELOAD[src]; var im = new Image(); im.decoding = 'async'; im.src = src; PRELOAD[src] = im; return im; }
  function preloadVN(site) {
    var arr = SCRIPT[site] || [];
    arr.forEach(function (st) {
      if (st.cg && CG[st.cg]) { preloadImg(CG[st.cg][gender()] || CG[st.cg].m); if (CG[st.cg].land) preloadImg(CG[st.cg].land[gender()] || CG[st.cg].land.m); }   // 横版收尾图也一起预加载
      if (st.bg && BG[st.bg]) preloadImg(BG[st.bg]);
    });
  }
  // 这一段剧情要用到的全部图片（背景、CG、人物立绘和表情、出场的精灵和道具）：开始前先全部下载好（2026-10-27）
  function vnAssets(site) {
    var arr = SCRIPT[site] || [], out = [], on = [], rx = /src="([^"]+)"/g, m;
    var grab = function (html) { if (!html) return; rx.lastIndex = 0; while ((m = rx.exec(html))) out.push(m[1]); };
    if (SITES[site] && BG[SITES[site].bg]) out.push(BG[SITES[site].bg]);
    var siteBak = ex.site; ex.site = site;
    try {
      arr.forEach(function (st, i) {
        if (st.bg && BG[st.bg]) out.push(BG[st.bg]);
        if (st.card && CARDS[st.card]) { out.push(BG[CARDS[st.card].bg]); out.push(CARDS[st.card].img); }
        if (st.cg && CG[st.cg]) { out.push(CG[st.cg][gender()] || CG[st.cg].m); if (CG[st.cg].land) out.push(CG[st.cg].land[gender()] || CG[st.cg].land.m); }
        if (st.on !== undefined) on = st.on || [];
        try { if (st.mons) grab(monsHTML(st.mons)); } catch (e1) {}
        on.forEach(function (o) { try { if (CAST[o[0]]) grab(standee(o[0], o[0] === 'p' ? pFace(arr, i) : st.f && st.f[o[0]])); } catch (e2) {} });
        if (st.s === 'b' && CAST.b) try { grab(standee('b', st.f && st.f.b)); } catch (e3) {}
      });
    } catch (e) {}
    ex.site = siteBak;
    return out.filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  }
  var vnLoading = null;
  function startVN(site, mode, host, fromStart) {
    if (vnLoading === site) return;
    var list = vnAssets(site), left = list.filter(function (src) { var im = PRELOAD[src]; return !(im && im.complete); });
    if (!left.length) { startVN0(site, mode, host, fromStart); return; }
    vnLoading = site; if (mode === 'intro' && host) host.innerHTML = '';
    var L = LOADER.show('正在载入剧情「' + (SITES[site] ? SITES[site].name : '') + '」～', { delay: 150 }), n = 0, fin = false;
    var end = function () { if (fin) return; fin = true; clearTimeout(guard); L.done(function () { if (vnLoading !== site) return; vnLoading = null; startVN0(site, mode, host, fromStart); }); };
    var guard = setTimeout(end, 20000);   // 最多等 20 秒：网络很慢时不卡住
    left.forEach(function (src) {
      var im = preloadImg(src), one = function () { n++; L.set(n / left.length); if (n >= left.length) end(); };
      if (im.complete) one(); else { im.addEventListener('load', one, { once: true }); im.addEventListener('error', one, { once: true }); }
    });
  }
  function startVN0(site, mode, host, fromStart) {
    var pr; ex.site = site; pr = prog(site);
    if (mode !== 'intro') $('onboard').innerHTML = '';
    if (fromStart) { pr.at = 0; pr.ch = null; }
    ex.finPending = null;
    ex.mode = mode; ex.host = host; ex.view = mode === 'replay' ? 'vn' : ex.view;
    ex.i = stepAt(pr.at); ex.log = []; ex.auto = false; ex.skip = false; ex.pickSel = null; ex.curBg = null; ex.curCg = null;
    renderVN(); bgmScene();
  }
  function renderVN() {
    ex.curBg = null;   // 整个舞台会重建（例如剧情对战打完回来），背景图要重新设置，不然会是空白
    var S = SITES[ex.site], P = PLANETS.filter(function (p) { return p.id === S.planet; })[0], intro = ex.mode === 'intro';
    ex.host.innerHTML = (intro ? '<div class="vn-intro-head"><span class="sc-tag">' + S.chapter + '</span><span class="hint">点击画面、按空格或回车继续。读完地球上的三段剧情后进入游戏。</span></div>' : '') +
      '<div class="vn" id="vn" tabindex="0" aria-label="剧情对话，点击或按空格继续">' +
      '<img class="vn-bg" id="vn-bg" alt=""><img class="vn-bg vn-bg2" id="vn-bg2" alt="">' +
      '<div class="vn-chars" id="vn-chars"></div>' +
      '<div class="vn-mons" id="vn-mons"></div>' +
      '<div class="vn-cgwrap" id="vn-cg"><div class="vn-cg-bg" id="vn-cg-bg" aria-hidden="true"></div><div class="vn-cg-pic" id="vn-cg-pic"></div></div>' +
      '<div class="vn-fx" id="vn-fx" aria-hidden="true"></div>' +
      '<div class="vn-top"><span class="vn-loc">' + P.name + ' · ' + S.name + '<small id="vn-spot"></small></span><span class="vn-ch">' + S.chapter + '</span>' +
      '<span class="vn-btns"><button type="button" data-vn="hide" title="隐藏界面，欣赏背景和立绘（H 键）">隐藏</button><button type="button" data-vn="log">记录</button><button type="button" data-vn="auto" id="vn-auto">自动</button><button type="button" data-vn="skip" id="vn-skip">跳过</button>' + (intro ? '' : '<button type="button" data-vn="exit">退出</button>') + '</span></div>' +
      '<div class="vn-box" id="vn-box"><div class="vn-name" id="vn-name"></div><p class="vn-text" id="vn-text"></p><span class="vn-next" id="vn-next" aria-hidden="true">▼</span></div>' +
      '<div class="vn-choices" id="vn-choices" hidden></div>' +
      '<div class="vn-pick" id="vn-pick" hidden></div>' +
      '<div class="vn-log" id="vn-log" hidden></div>' +
      '<div class="vn-end" id="vn-end" hidden></div><div class="vn-restore" aria-hidden="true">点击任意处恢复界面</div></div>' +
      (intro ? '' : '<p class="hint vn-tip">点击画面、按空格或回车继续；人物立绘目前为占位。</p>');
    var cgPic = $('vn-cg-pic'), cgWrap = $('vn-cg');
    cgPic.addEventListener('animationend', function (e) {
      if (e.animationName === 'vncgScroll') { cgWrap.classList.remove('play'); cgWrap.classList.add('shake'); }
      else if (e.animationName === 'vncgShake') { cgWrap.classList.remove('shake'); cgWrap.classList.add('full'); cgFit(); }   // 定格：按屏幕比例挑竖版 / 横版，铺满或居中
    });
    show();
    try { $('vn').focus({ preventScroll: true }); } catch (er) {}
  }
  function stopTimers() { clearTimeout(ex.timer); clearInterval(ex.tick); ex.timer = null; ex.tick = null; clearInterval(ex.farmTick); stopField(); }
  function setBg(k) {
    if (ex.curBg === k) return;
    var a = $('vn-bg'), b = $('vn-bg2');
    if (!ex.curBg) { a.src = BG[k]; } else { b.src = BG[k]; b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); setTimeout(function () { if (a.isConnected) { a.src = BG[k]; b.classList.remove('in'); } }, 520); }
    a.style.objectPosition = b.style.objectPosition = BG_POS[k] || '';
    ex.curBg = k; $('vn-spot').textContent = ' · ' + ((ex.site && SITES[ex.site] && SITES[ex.site].spot) || BG_NAME[k] || '');   // spot：画面借用别处背景时，地点名按剧情写
  }
  // 剧情画面特效（剧本行写 fx）：boom 爆炸白光（炸弹）、light 温暖的光芒爆裂（叶子喵登场）、purple 深紫色瘴气涌出、quake 画面震动
  function vnFx(k) {
    var f = $('vn-fx'), v = $('vn'); if (!f || !v) return;
    if (ex.skip) return;
    f.className = 'vn-fx'; v.classList.remove('quake'); void f.offsetWidth;
    if (k === 'quake') { v.classList.add('quake'); return; }
    f.classList.add(k); if (k === 'boom' || k === 'purple') v.classList.add('quake');
  }
  // 剧情 CG：整屏竖图，出现时先从上往下「扫」过一遍，接一下screen shake，再定格展示完整画面；按主角性别选图
  /* CG 定格时适配屏幕：竖版（约 0.7）和横版（约 3:1）里挑和画面比例更接近的一张；
   * 比例差得不多就铺满（裁掉一点边），差得多就完整居中，空出来的地方用同一张图放大、模糊垫底，不留黑边 */
  var CG_AR = {};
  function cgFit() {
    var w = $('vn-cg'), pic = $('vn-cg-pic'), bg = $('vn-cg-bg'), k = ex.curCg; if (!w || !pic || !k || !CG[k] || !w.classList.contains('full')) return;
    var box = w.getBoundingClientRect(), ar = box.width / Math.max(1, box.height);
    var cands = [{ src: CG[k][gender()] || CG[k].m, land: false }]; if (CG[k].land) cands.push({ src: CG[k].land[gender()] || CG[k].land.m, land: true });
    cands.forEach(function (c) { if (!CG_AR[c.src]) { var im = preloadImg(c.src); if (im && im.naturalWidth) CG_AR[c.src] = im.naturalWidth / im.naturalHeight; else if (im) im.addEventListener('load', function () { CG_AR[c.src] = im.naturalWidth / im.naturalHeight; cgFit(); }, { once: true }); } c.ar = CG_AR[c.src] || (c.land ? 3 : 0.7); c.miss = Math.abs(Math.log(ar / c.ar)); });
    cands.sort(function (a, b) { return a.miss - b.miss; });
    var c = cands[0], url = 'url(' + c.src + ')';
    pic.style.backgroundImage = url; if (bg) bg.style.backgroundImage = url;
    w.classList.toggle('land', c.land);
    w.classList.toggle('fill', c.miss < Math.log(1.3));   // 比例差不到 1.3 倍：直接铺满
  }
  window.addEventListener('resize', function () { cgFit(); });
  function setCG(k) {
    var w = $('vn-cg'); if (!w) return;
    if (!k) { if (ex.curCg) { w.classList.remove('show', 'play', 'shake', 'full', 'land', 'fill'); ex.curCg = null; } return; }
    if (ex.curCg === k) return;
    ex.curCg = k;
    if (!acc.cgSeen) acc.cgSeen = {}; if (!acc.cgSeen[k]) { acc.cgSeen[k] = Date.now(); save(); }   // CG 画廊：记下看过的
    var src = CG[k] ? (CG[k][gender()] || CG[k].m) : '';
    $('vn-cg-pic').style.backgroundImage = src ? 'url(' + src + ')' : 'none';
    w.classList.remove('play', 'shake', 'full', 'land', 'fill'); if ($('vn-cg-bg')) $('vn-cg-bg').style.backgroundImage = 'none';
    void w.offsetWidth;
    w.classList.add('show');
    var go_ = function () { if (ex.curCg !== k) return; void w.offsetWidth; w.classList.add('play'); };
    var im = src && preloadImg(src);
    if (im && !im.complete) { var t0 = setTimeout(go_, 4000); im.addEventListener('load', function () { clearTimeout(t0); go_(); }, { once: true }); }   // 还没下载完：等图到了再开始运镜（最多等 4 秒）
    else go_();
  }
  function monsHTML(mode) {
    var img = function (sid, cls, label) { return '<figure class="vn-mon ' + cls + '"><img src="' + form({ sid: sid, lv: START_LV }).img + '" alt=""><figcaption>' + esc(label) + '</figcaption></figure>'; };
    if (mode === 'all') return STARTERS.map(function (sid, i) { return img(sid, ['a1', 'a2', 'a3'][i], monName(sid)); }).join('');
    if (mode && mode.indexOf('tw:') === 0) { var tsid = mode.slice(3); return '<figure class="vn-mon tw"><img src="' + form({ sid: tsid, lv: 3 }).img + '" alt=""><figcaption>被污染的' + esc(form({ sid: tsid, lv: 3 }).name) + '</figcaption></figure>'; }
    if (mode && mode.indexOf('item:') === 0) { var ip = mode.split(':'); return ITEM_IMG[ip[1]] ? '<figure class="vn-mon tw plain item"><img src="' + ITEM_IMG[ip[1]] + '" alt=""><figcaption>' + esc(ip[2] || '') + '</figcaption></figure>' : ''; }   // item:道具图:标签（剧情里出现的道具）
    if (mode && mode.indexOf('mon:') === 0) { var mp = mode.split(':'); return '<figure class="vn-mon tw plain"><img src="' + form({ sid: mp[1], lv: +mp[2] || 1 }).img + '" alt=""><figcaption>' + esc(mp[3] || form({ sid: mp[1], lv: +mp[2] || 1 }).name) + '</figcaption></figure>'; }   // mon:精灵:等级:标签
    if (mode && mode.indexOf('mia:') === 0) { var xp = mode.split(':'), xl = +xp[2] || 1, xf = form({ sid: xp[1], lv: xl }), fx = typeof FORM_FX_SPRITES !== 'undefined' && FORM_FX_SPRITES[xp[1]]; return '<figure class="vn-mon tw plain mia"><img src="' + (fx && fx.miasma && xl >= 50 ? fx.miasma : xf.img) + '" alt=""><figcaption>' + esc(xp[3] || '瘴气' + xf.name) + '</figcaption></figure>'; }   // mia:精灵:等级:标签（瘴气变异的样子，带紫色光晕）
    if (mode && mode.indexOf('team:') === 0) {   // 配队里某种属性的精灵（第十一段：水系精灵一起喷水）
      var tt = mode.slice(5), L = (acc.teams[acc.active] || []).map(mon).filter(function (m) { return m && SPMAP[m.sid] && SPMAP[m.sid].types.indexOf(tt) >= 0; }).slice(0, 4);
      return '<div class="vn-team">' + L.map(function (m) { return '<figure class="vn-mon tw plain spray"><img src="' + form(m).img + '" alt=""><figcaption>' + esc(form(m).name) + '</figcaption></figure>'; }).join('') + '</div>';
    }
    if (mode === 'mine' && acc.starter) return img(acc.starter, 'me', starterName());
    if (mode === 'pair' && acc.starter) return img(acc.starter, 'me', starterName()) + (acc.rival ? img(acc.rival, 'rv', monName(acc.rival)) : '');
    return '';
  }
  function show() {
    stopTimers();
    var arr = SCRIPT[ex.site], pr = prog(ex.site);
    ex.i = stepAt(ex.i);
    if ($('vn-card') && !(arr[ex.i] && arr[ex.i].card)) { $('vn-card').remove(); $('vn-box').hidden = false; }
    if (ex.i >= arr.length) { finish(); return; }
    pr.at = ex.i; save();
    var st = arr[ex.i], on = carry(ex.i, 'on', []), mons = carry(ex.i, 'mons', '');
    $('vn').classList.toggle('memory', !!carry(ex.i, 'memory', false));
    setBg(carry(ex.i, 'bg', SITES[ex.site].bg));
    setCG(carry(ex.i, 'cg', null));
    if (st.bgm !== undefined) setTimeout(bgmScene, 0);   // 剧本切歌：立刻换，不等 0.5 秒的轮询
    if (st.fx) vnFx(st.fx);
    seeStep(st, st.mons !== undefined ? st.mons : mons);
    if (st.give) storyGive(ex.site, st.give);
    var monsH = monsHTML(mons); if ($('vn-mons').dataset.k !== mons + acc.starter) { $('vn-mons').innerHTML = monsH; $('vn-mons').dataset.k = mons + acc.starter; }
    $('vn-chars').innerHTML = on.map(function (o) {
      var k = o[0], pos = o[1], speak = st.s === k;
      return '<div class="vn-fig ' + pos + (CAST[k].img || CAST[k].spr ? ' art' : '') + (CAST[k].full ? ' full' : '') + (speak ? ' speak' : st.s && st.s !== 'n' && !st.choice ? ' dim' : '') + '" style="--cc:' + CAST[k].color + '">' + standee(k, k === 'p' ? pFace(arr, ex.i) : st.f && st.f[k]) + '<span class="vn-tag">' + esc(CAST[k].name()) + '</span></div>';
    }).join('');
    // Bttp 不在现场、通过无线电说话时：在画面右上方显示他的全息投影（荆楚号上的剧情是当面说话，不显示）
    if (st.s === 'b' && !on.some(function (o) { return o[0] === 'b'; }) && SITES[ex.site].planet !== 'jingchu') {
      var hk = 'holo:' + ex.site, hold = $('vn-chars').dataset.holo === hk;
      $('vn-chars').insertAdjacentHTML('beforeend', '<div class="vn-fig holo art' + (hold ? ' still' : '') + '" style="--cc:' + CAST.b.color + '">' + standee('b', st.f && st.f.b) + '<span class="vn-tag">' + esc(CAST.b.name()) + ' · 全息通讯</span><i class="holo-base" aria-hidden="true"></i></div>');
      $('vn-chars').dataset.holo = hk;
    } else $('vn-chars').dataset.holo = '';
    $('vn-choices').hidden = true; $('vn-pick').hidden = true; $('vn-box').classList.remove('wait');
    if (st.card && showCard(st.card)) { $('vn-box').hidden = true; ex.skip = false; ex.auto = false; ex.typing = false; ex.full = ''; syncBtns(); return; }
    if (st.choice) {
      $('vn-box').classList.add('wait'); $('vn-choices').hidden = false;
      $('vn-choices').innerHTML = st.choice.map(function (c) { return '<button type="button" class="vn-opt" data-ch="' + c.k + '">' + esc(fill(c.t)) + '</button>'; }).join('');
      ex.skip = false; syncBtns(); return;
    }
    if (st.pick || st.battle || (st.pay && !paidOk(st.pay))) { ex.skip = false; ex.auto = false; syncBtns(); }
    var nar = st.s === 'n', name = nar ? '' : CAST[st.s].name();
    $('vn-name').textContent = name; $('vn-name').hidden = nar; $('vn-name').style.setProperty('--cc', nar ? '' : CAST[st.s].color);
    $('vn-box').classList.toggle('narr', nar);
    ex.full = fill(st.t); ex.shown = 0; ex.typing = true; $('vn-next').hidden = true;
    ex.log.push({ n: name, t: ex.full });
    var chars = Array.from(ex.full), txt = $('vn-text');
    if (ex.skip) { txt.textContent = ex.full; ex.typing = false; ex.timer = setTimeout(next, 70); return; }
    txt.textContent = '';
    ex.tick = setInterval(function () { ex.shown++; txt.textContent = chars.slice(0, ex.shown).join(''); if (ex.shown >= chars.length) doneTyping(); }, 32);
  }
  function doneTyping() {
    clearInterval(ex.tick); ex.tick = null; ex.typing = false;
    $('vn-text').textContent = ex.full;
    var st = SCRIPT[ex.site][ex.i];
    if (st && st.pick) { openPick(); return; }
    if (st && st.battle) { openFight(st.battle); return; }
    if (st && st.needType && !teamHasType(st.needType)) { openNeedType(st.needType); return; }
    if (st && st.pay && !paidOk(st.pay)) { openPay(st.pay); return; }
    $('vn-next').hidden = false;
    if (ex.auto) ex.timer = setTimeout(next, 1200 + Array.from(ex.full).length * 45);
  }
  // 全屏标题演出（2026-10-31，剧本行写 card）：背景 + 标题图，标题图上扫过一道光；点击继续
  var CARDS = { kb: { bg: 'kb_isle', img: 'images/cg/kb_title.webp' }, nebula: { bg: 'black', img: 'images/cg/nebula_reveal.webp' }, kbclear: { bg: 'black', img: 'images/cg/kb_clear.webp' } };   // kbclear：第二章通关「雾海突破」   // nebula：星云显现（第二章后面用）
  function showCard(k) {
    var C = CARDS[k], v = $('vn'); if (!C || !v) return false;
    if ($('vn-card')) $('vn-card').remove();
    var el = document.createElement('div'); el.className = 'vn-card'; el.id = 'vn-card';
    el.innerHTML = '<img class="vc-bg" src="' + BG[C.bg] + '" alt=""><img class="vc-art" src="' + C.img + '" alt=""><i class="vc-shine" aria-hidden="true" style="-webkit-mask-image:url(' + C.img + ');mask-image:url(' + C.img + ')"></i><span class="vc-tip">点击继续</span>';
    v.appendChild(el); ex.cardAt = Date.now();
    return true;
  }
  // 剧本里要交东西（pay：{ id, items }）：交过才能往下读（交易 story · pay，服务器扣道具）
  function paidOk(P) { var pr = prog(ex.site); return !!(pr.paid && pr.paid[P.id]); }
  function openPay(P) {
    var el = $('vn-pick'), ok = Object.keys(P.items).every(function (k) { return (acc.items[k] || 0) >= P.items[k]; });
    el.hidden = false; $('vn-box').classList.add('wait');
    el.innerHTML = '<div class="vn-fight vn-pay"><b>交出道具</b><div class="vp-items">' + Object.keys(P.items).map(function (k) {
      var have = acc.items[k] || 0;
      return '<span class="vp-it' + (have >= P.items[k] ? '' : ' short') + '"><span class="vp-ic">' + H.itemIcon(k) + '</span><b>' + esc(itemName(k)) + ' ×' + P.items[k] + '</b><small>持有 ' + fmt(have) + '</small></span>';
    }).join('') + '</div>' +
      (ok ? '' : '<p class="hint">数量不够。' + esc(P.hint || '药草可以在荆楚号 · 恩施 · 生态舱的「太空种植园」种出来。可以先点右上角「退出」，准备好以后回来，会从这里接着读。') + '</p>') +
      '<button type="button" class="btn primary" data-vn="pay"' + (ok ? '' : ' disabled') + '>交出</button></div>';
  }
  // 剧本里要求配队里有某种属性的精灵（needType）：没有就停在这里，调整配队后点「重新检查」继续
  function teamHasType(t) { if (Array.isArray(t)) return t.every(teamHasType); return (acc.teams[acc.active] || []).map(mon).filter(Boolean).some(function (m) { return SPMAP[m.sid] && SPMAP[m.sid].types.indexOf(t) >= 0; }); }   // t 可以是数组：每种属性都要有
  function openNeedType(t) {
    if (Array.isArray(t)) { var miss = t.filter(function (x) { return !teamHasType(x); }); t = miss.join('系、'); }
    var el = $('vn-pick'); el.hidden = false; $('vn-box').classList.add('wait');
    el.innerHTML = '<div class="vn-fight"><b>需要一只' + t + '系精灵</b><p>在当前出战配队（' + tName(acc.active) + '）里放一只' + t + '系精灵，再继续剧情。</p><p class="hint">可以先点右上角「退出」，到「精灵背包」调整配队，回来时会从这里接着读。</p><button type="button" class="btn primary" data-vn="needok">重新检查</button></div>';
  }
  function openFight(key) {
    var F = FIGHTS[key], el = $('vn-pick'), fteam = fightTeam(F), f0 = fteam[0];
    var mineImg = F.pteam ? (F.pteam[0].img || formImg(SPMAP[F.pteam[0].sid], F.pteam[0].st != null ? F.pteam[0].st : stageOf(SPMAP[F.pteam[0].sid], F.pteam[0].lv))) : (((acc.teams[acc.active] || []).map(mon).filter(Boolean)[0] || acc.mons[0]) ? form((acc.teams[acc.active] || []).map(mon).filter(Boolean)[0] || acc.mons[0]).img : '');
    var foeImg = f0.img || (f0.moves || f0.boss ? (f0.sid === 'dummy' ? '' : formImg(SPMAP[f0.sid], stageOf(SPMAP[f0.sid], f0.lv))) : form({ sid: f0.sid, lv: f0.lv }).img);
    var foeName = f0.nick || form({ sid: f0.sid, lv: f0.lv }).name;
    el.hidden = false;
    el.innerHTML = '<div class="vn-fight"><b>剧情对战</b><div class="vf-row"><img src="' + mineImg + '" alt=""><span class="vs">VS</span><img src="' + foeImg + '" alt=""></div>' +
      '<p>' + (F.pteam ? esc(F.pteam[0].nick || SPMAP[F.pteam[0].sid].name) + '（LV' + F.pteam[0].lv + '）' : '你的出战配队（' + tName(acc.active) + '）') + '对阵 ' + (F.desc ? esc(F.desc) : esc(F.foe) + ' 的 ' + esc(foeName) + '（LV' + f0.lv + '）') + '</p>' +
      (F.allyMon && F.allyOpt ? '<label class="vf-ally"><input type="checkbox" data-vnally="1"' + (ex.allyOff ? '' : ' checked') + '> 带上' + esc(F.allyMon.nick || SPMAP[F.allyMon.sid].name) + '（LV' + F.allyMon.lv + '）助战' + (F.allyMon.boss && F.allyMon.boss.purify ? '　<span class="hint">剧情限定特性「净化光芒」：对瘴气精灵伤害 +100%</span>' : '') + '</label>' : '') +
      '<button type="button" class="btn primary" data-vn="fight" data-fk="' + key + '">开始对战</button></div>';
  }
  function openPick() {
    var el = $('vn-pick'), sel = ex.pickSel;
    el.hidden = false;
    el.innerHTML = '<div class="vp-cards" role="radiogroup" aria-label="选择初始精灵">' + STARTERS.map(function (sid) {
      var s = SPMAP[sid], f = form({ sid: sid, lv: START_LV });
      return '<button type="button" class="vp-card' + (sel === sid ? ' sel' : '') + '" role="radio" aria-checked="' + (sel === sid) + '" data-pk="' + sid + '">' +
        '<img src="' + f.img + '" alt=""><span class="nm">' + esc(f.name) + '</span><span class="tc">' + tchips(s.types) + '<span class="chip">LV' + START_LV + '</span></span>' +
        (f.d ? '<span class="fd">' + esc(f.d) + '</span>' : '') + '<span class="ab">特性 · ' + esc(s.ability.n) + '</span><span class="ad">' + esc(s.ability.d) + '</span>' +
        (s.placeholder ? '<span class="placeholder-note">数值和技能还是占位</span>' : '') + '</button>';
    }).join('') + '</div><div class="vp-foot"><span>' + (sel ? '选择 <b>' + esc(monName(sel)) + '</b> 作为你的伙伴？选定后不能更换。' : '点击一只精灵') + '</span>' +
      '<button type="button" class="btn primary" data-vn="pickok"' + (sel ? '' : ' disabled') + '>就选它了</button></div>';
  }
  function next() {
    if (!$('vn')) return;
    if (ex.typing) { doneTyping(); return; }
    var st = SCRIPT[ex.site][ex.i]; if (st && (st.choice || st.pick || st.battle || (st.pay && !paidOk(st.pay)))) return;
    if (st && st.card && $('vn-card') && Date.now() - (ex.cardAt || 0) < 2600) return;   // 标题演出至少放完入场动画
    ex.i++; show();
  }
  // 第一次读完第十段后弹出：芙罗拉星已经被腐化
  // 坎伯兰星变色（2026-10-31）：第十七段读完 → 稍微变红（保卫战开始）；第十八段读完 → 最红
  function kbShiftNotice(to) {
    if ($('fallen-dlg')) return;
    var from = to === 4 ? 2 : to === 0 ? 4 : 0, war = to === 2, calm = to === 0;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'fallen-dlg';
    d.innerHTML = '<div class="soc-box fallen-box" role="dialog" aria-modal="true" aria-label="坎伯兰星"><span class="step">坎伯兰星</span><h2>' + (war ? '异变' : calm ? '平静' : '星云显现') + '</h2>' +
      '<div class="fallen-planet" aria-hidden="true"><img class="fp-a" src="images/planets/kamble_' + from + '.webp?v=2" alt=""><img class="fp-b" src="images/planets/kamble_' + to + '.webp?v=2" alt=""><i class="fp-fog kb"></i></div>' +
      (war ? '<p>坎伯兰星的颜色发生了变化，海面隐隐泛着红光。</p><p>沉睡在海底的机械精灵，正在一个接一个地苏醒。</p>' +
        '<div class="pw-open"><span class="chip log-tag pw-tag">全服任务</span><b>坎伯兰星保卫战已开启</b><span>坎伯兰星的三个野外区域会出现奥多亚克，所有船员一起击退它们。在航行日志和坎伯兰星的「星球任务」里查看。</span></div>'
        : calm ? '<p>玫瑰星云沉入了海底。</p><p>坎伯兰星，恢复了原本的蓝色。</p>' : '<p>坎伯兰星被染成了血一样的红色。</p><p class="hint">第十九段「玫瑰之战」已经开放。</p>') +
      '<div class="soc-foot">' + (war ? '<button type="button" class="btn" data-fallenlog="1">去看看</button>' : '') + '<button type="button" class="btn primary" data-fallenx="1">知道了</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target.closest('[data-fallenlog]')) { d.remove(); go('log'); } });
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-fallenx]')) d.remove(); });
  }
  function floraFallenNotice() {
    if ($('fallen-dlg')) return;
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'fallen-dlg';
    d.innerHTML = '<div class="soc-box fallen-box" role="dialog" aria-modal="true" aria-label="芙罗拉星"><span class="step">芙罗拉星</span><h2>腐化</h2>' +
      '<div class="fallen-planet" aria-hidden="true"><img class="fp-a" src="images/planets/flora.webp?v=3" alt=""><img class="fp-b" src="images/planets/flora_corrupt.webp?v=3" alt=""><i class="fp-fog"></i></div>' +
      '<p>现在，芙罗拉星和星球上的绝大多数精灵，已经被瘴气腐化了。</p>' +
      '<p>尽力驱散这些诅咒吧……如果有用的话。</p>' +
      '<p class="hint">芙罗拉星的野外遇到的精灵都变成了腐化精灵，无法捕捉。击败它们，同样计入星球任务「祛除瘴气」。</p>' +
      '<div class="pw-open"><span class="chip log-tag pw-tag">全服任务</span><b>瘴气驱逐战已开启</b><span>所有船员一起击败腐化精灵，推进全服进度条，达到里程碑就能领取奖励。在航行日志和芙罗拉星的「星球任务」里查看。</span></div>' +
      '<div class="soc-foot"><button type="button" class="btn" data-fallenlog="1">去看看</button><button type="button" class="btn primary" data-fallenx="1">知道了</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target.closest('[data-fallenlog]')) { d.remove(); go('log'); } });
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-fallenx]')) d.remove(); });
  }
  // 读完一段：进度、奖励、章节大奖由服务器结算（交易 story，js/engine/story.js）
  function finish(tries, site0) {
    stopTimers();
    var site = site0 || ex.site; if (ex.site !== site) return;
    if (!site0 && $('vn-end') && !$('vn-end').hidden) return;   // 结束画面已经在了（点背景不再重画，免得奖励那一栏消失）
    var pr = prog(site);
    if (pr.done) { if (!site0 && ex.finPending === site) return; pr.at = 0; save(); finishShow(null, null, false); return; }
    if (!site0 && ex.finPending === site) return;   // 已经在结算这一段了（连点）
    ex.finPending = site;
    txRun('story', { a: 'done', site: site }, function (r) {
      ex.finPending = null;
      if (ex.site !== site) return;
      var R = r.reward || null, chPaid = r.chapters && r.chapters.length ? CHAPTERS.filter(function (C) { return C.id === r.chapters[r.chapters.length - 1]; })[0] : null;
      if (R && R.gift && R.gift.length) setTimeout(function () { txRun('gift', { k: 'story', id: site }, function () { renderTop(); }); }, 0);   // 送的精灵走交易（grow.js）
      finishShow(R, chPaid, !r.again);
    }, function (err) {
      if (err === '' && (tries || 0) < 20) { setTimeout(function () { finish((tries || 0) + 1, site); }, 300); return; }   // 上一笔交易还没结束
      ex.finPending = null;
      if (ex.site !== site) return;
      toast('这段剧情的进度没能保存：' + (err || '请稍后再试') + '。');
      finishShow(null, null, false, err || '进度没能保存');
    });
  }
  function finishShow(R, chPaid, firstDone, failMsg) {
    var intro = ex.mode === 'intro';
    if (!$('vn-end')) { if (R || chPaid) renderRes(); return; }   // 已经离开剧情画面了
    if (ex.site === 'flora6' && firstDone) setTimeout(floraFallenNotice, 600);
    if ((ex.site === 'kb6' || ex.site === 'kb7' || ex.site === 'kb8') && firstDone) { fields = {}; var kbTo = ex.site === 'kb8' ? 0 : ex.site === 'kb7' ? 4 : 2; setTimeout(function () { kbShiftNotice(kbTo); }, 600); }
    if (ex.site === 'flora7' && firstDone) { fields = {}; if (mmLive()) setTimeout(mmEventPop, 900); }   // 芙罗拉星恢复：野外场景重建；弹出新活动   // 第一次读完第十段：芙罗拉星被腐化的提示
    if (chPaid) renderRes();
    if (R && ready()) renderRes();
    var nxt = Object.keys(SITES).filter(function (id) { return SITES[id].after === ex.site && !SITES[id].side; })[0] || Object.keys(SITES).filter(function (id) { return SITES[id].after === ex.site && unlocked(id); })[0];
    if (R && R.title) { checkTitles(); renderTitle(); }
    var nxtP = nxt && PLANETS.filter(function (p) { return p.id === SITES[nxt].planet; })[0];
    if (UNLOCK[ex.site]) syncBattle();
    ex.auto = false; ex.skip = false;
    $('vn-chars').innerHTML = ''; $('vn-mons').innerHTML = ''; $('vn-box').hidden = true; $('vn-choices').hidden = true;
    $('vn-end').hidden = false;
    $('vn-end').innerHTML = '<div class="vn-endbox"><span class="sc-tag">' + SITES[ex.site].chapter + '</span><b>完</b>' + (failMsg ? '<p><b class="red">' + esc(failMsg) + '</b></p>' : '') +
      (R ? '<p>获得奖励</p><div class="vn-reward">' + rwList(R).map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '') +
      (ex.site === 'rare' && !nxt ? '<p><b class="red">任务：捕捉一种稀有精灵，然后回学院部汇报。</b></p>' : '') + (R && R.title ? '<p><b class="red">获得称号「' + TITLES.filter(function (x) { return x.id === R.title; })[0].n + '」！</b><br><span class="hint">点击右上角的名字即可佩戴</span></p>' : '') +
      (chPaid ? '<div class="vn-chap"><b>「' + chPaid.n + '」完成！</b><p>章节大奖</p><div class="vn-reward">' + rwList(chPaid.reward).map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div></div>' : '') +
      (nxt && !unlocked(nxt) && SITES[nxt].needText && !SITES[ex.site].endText ? '<p><b class="red">任务：' + SITES[nxt].needText + '。</b></p>' : '') +
      (UNLOCK[ex.site] && !SITES[ex.site].endText ? '<p><b class="red">「' + UNLOCK[ex.site] + '」已开放！</b>' + (ex.site === 'storage' ? '<br><span class="hint">在荆楚号 · 荆门 · 物资仓储里进入</span>' : ex.site === 'medal' ? '<br><span class="hint">在荆楚号 · 黄冈 · 学院部里进入</span>' : '') + '</p>' : '') +
      '<p>' + (SITES[ex.site].endText ? SITES[ex.site].endText : nxt && !unlocked(nxt) ? '完成任务后，下一段「' + SITES[nxt].chapter.split(' · ')[1] + '」就会开放。' : nxt ? (SITES[nxt].event ? '活动任务「' : SITES[nxt].side ? '支线「' : '下一段「') + SITES[nxt].chapter.split(' · ')[1] + '」已解锁，可在星际探索 · ' + nxtP.name + (SITES[nxt].dept ? ' · ' + DEPTS[SITES[nxt].dept][0] : '') + '中继续。' : '后续剧情正在制作中。') + '</p>' +
      '<div class="row">' + (intro ? (INTRO_SITES.indexOf(ex.site) >= 0 && INTRO_SITES[INTRO_SITES.indexOf(ex.site) + 1] ? '<button type="button" class="btn primary" data-vn="inext" data-nx="' + INTRO_SITES[INTRO_SITES.indexOf(ex.site) + 1] + '">继续下一段</button>' : '<button type="button" class="btn primary" data-vn="enter">进入游戏</button>')
        : ex.arc ? '<button type="button" class="btn" data-vn="replay">重温一遍</button>' + (ex.arcQ && ex.arcQ.length ? '<button type="button" class="btn" data-vn="next" data-nx="' + ex.arcQ[0] + '">连播下一段：' + esc(SITES[ex.arcQ[0]].chapter) + '</button>' : '') + '<button type="button" class="btn primary" data-vn="exit">返回剧情回顾</button>'
        : '<button type="button" class="btn" data-vn="replay">重温一遍</button>' + (nxt && unlocked(nxt) ? '<button type="button" class="btn" data-vn="next" data-nx="' + nxt + '">继续下一段</button>' : '') + '<button type="button" class="btn primary" data-vn="exit">' + (SITES[ex.site].dept ? '返回区域' : '返回地点') + '</button>') + '</div></div>';
    syncBtns();
  }
  function syncBtns() { var a = $('vn-auto'), s = $('vn-skip'); if (a) a.classList.toggle('on', ex.auto); if (s) s.classList.toggle('on', ex.skip); }
  function setUiOff(on) { var v = $('vn'); if (!v) return; v.classList.toggle('ui-off', on); if (on) { ex.autoWas = ex.auto; ex.auto = false; stopTimers(); if (ex.typing) doneTyping(); syncBtns(); } }
  function vnClick(e) {
    if ($('vn') && $('vn').classList.contains('ui-off') && e.target.closest('#vn')) { setUiOff(false); return; }
    if (e.target.closest('.vf-ally')) { var cb = $('vn-pick').querySelector('[data-vnally]'); if (cb) setTimeout(function () { ex.allyOff = !cb.checked; }, 0); return; }   // 助战勾选框：不要触发「下一句」
    var b = e.target.closest('button');
    if (b && b.dataset.ch) { prog(ex.site).ch = b.dataset.ch; ex.i++; show(); return; }
    if (b && b.dataset.pk) { ex.pickSel = b.dataset.pk; openPick(); return; }
    if (b && b.dataset.vn) {
      var a = b.dataset.vn;
      if (a === 'fight') { startFight(b.dataset.fk); return; }
      if (a === 'pickok' && ex.pickSel) { if (acc.starter) { ex.i++; show(); return; } if (ex.picking) return; ex.picking = true; pickStarter(ex.pickSel, function () { ex.picking = false; ex.i++; show(); }); setTimeout(function () { ex.picking = false; }, 8000); return; }
      if (a === 'exit' && ex.arc) { stopTimers(); ex.mode = null; ex.arc = false; ex.arcQ = []; ex.view = 'archive'; renderExplore(); return; }
      if (a === 'exit') { stopTimers(); ex.mode = null; ex.planet = SITES[ex.site].planet; if (SITES[ex.site].fpart) ex.fpart = SITES[ex.site].fpart; if (SITES[ex.site].dept) { ex.view = 'area'; ex.area = SITES[ex.site].dept; } else ex.view = 'sites'; renderExplore(); return; }
      if (a === 'replay') { startVN(ex.site, 'replay', ex.host, true); return; }
      if (a === 'next' && ex.arc && ex.arcQ && ex.arcQ[0] === b.dataset.nx) ex.arcQ.shift();
      if (a === 'next') { startVN(b.dataset.nx, 'replay', ex.host, prog(b.dataset.nx).done || !prog(b.dataset.nx).at); return; }
      if (a === 'needok') { var nst = SCRIPT[ex.site][ex.i]; if (nst && nst.needType && !teamHasType(nst.needType)) { toast('出战配队里还没有' + [].concat(nst.needType).filter(function (x) { return !teamHasType(x); }).join('系、') + '系精灵。'); return; } $('vn-pick').hidden = true; $('vn-box').classList.remove('wait'); next(); return; }
      if (a === 'pay') {
        var pst = SCRIPT[ex.site][ex.i]; if (!pst || !pst.pay) return;
        if (paidOk(pst.pay)) { $('vn-pick').hidden = true; $('vn-box').classList.remove('wait'); next(); return; }
        b.disabled = true;
        txRun('story', { a: 'pay', site: ex.site, id: pst.pay.id }, function () { renderRes(); $('vn-pick').hidden = true; $('vn-box').classList.remove('wait'); next(); }, function (err) { b.disabled = false; toast(err || '没能交出去，请稍后再试。'); });
        return;
      }
      if (a === 'enter') { finishIntro(); return; }
      if (a === 'inext') { startVN(b.dataset.nx, 'intro', ex.host, true); return; }
      if (a === 'auto') { ex.auto = !ex.auto; ex.skip = false; syncBtns(); if (ex.auto && !ex.typing && !ex.tick) ex.timer = setTimeout(next, 600); return; }
      if (a === 'skip') { ex.skip = !ex.skip; ex.auto = false; syncBtns(); if (ex.skip) { if (ex.typing) doneTyping(); next(); } return; }
      if (a === 'log') { openLog(); return; }
      if (a === 'hide') { setUiOff(true); return; }
      if (a === 'logx') { $('vn-log').hidden = true; return; }
      return;
    }
    if (e.target.closest('#vn-log') || e.target.closest('#vn-end') || e.target.closest('.vn-top') || e.target.closest('#vn-pick')) return;
    if (!e.target.closest('#vn')) return;
    if (ex.skip) { ex.skip = false; syncBtns(); return; }
    next();
  }
  function openLog() {
    var l = $('vn-log');
    l.innerHTML = '<div class="vn-loghead"><b>对话记录</b><button type="button" class="btn ghost" data-vn="logx">关闭</button></div><div class="vn-logbody">' +
      (ex.log.length ? ex.log.map(function (x) { return '<p>' + (x.n ? '<b>' + esc(x.n) + '</b>' : '<i>旁白</i>') + esc(x.t) + '</p>'; }).join('') : '<p class="hint">还没有对话。</p>') + '</div>';
    l.hidden = false; var body = l.querySelector('.vn-logbody'); body.scrollTop = body.scrollHeight;
  }
  document.addEventListener('keydown', function (e) {
    var vn = $('vn'); if (!vn || !ex.mode) return;
    if (ex.mode === 'replay' && page !== 'explore') return;
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (vn.classList.contains('ui-off')) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'h' || e.key === 'H') { e.preventDefault(); setUiOff(false); } return; }
    if ((e.key === 'h' || e.key === 'H') && $('vn-end').hidden) { setUiOff(true); return; }
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault(); if (!$('vn-log').hidden || !$('vn-end').hidden || !$('vn-pick').hidden) return; next();
    } else if (e.key === 'Escape' && !$('vn-log').hidden) $('vn-log').hidden = true;
  });

  /* ---------- 拜访别人的茶室：挑战茶室里展示的精灵 ----------
   * 每天前 5 场各奖励 1000 累积经验（进经验背包），赢输都算，认输不算；0 点刷新 */
  var TEA_DAILY = PVE.TEA_DAILY, TEA_EXP = PVE.TEA_EXP;
  function teaLeft() { var t = acc && acc.teaFight; return t && t.d === todayKey() ? Math.max(0, TEA_DAILY - (t.n || 0)) : TEA_DAILY; }
  function teaFight(opt) {
    if (srvMode() && opt.user) return pveRemote('tea', { owner: opt.user }, { bg: BG.tea_p, back: '基地', pre: function () { ['holo', 'log', 'bag', 'store', 'release', 'dex', 'items', 'social', 'explore'].forEach(function (pg) { $('pg-' + pg).hidden = true; }); $('who-menu').hidden = true; } }, function (e, res) {
      ex.fighting = false; document.body.classList.remove('story-fight');
      var r = e && e.rep, msg = '', quit = !!(e && e.quit);
      if (!r) msg = res === 'void' ? '这场对战作废了，不计入奖励次数。' : '';
      else if (r.quit) msg = '认输的茶室对战不计入奖励次数。';
      else if (r.exp) msg = '茶室对战奖励：累积经验 +' + fmt(r.exp) + '，已放进经验背包。今天还能领 ' + r.left + ' 次。';
      else msg = '今天的 ' + TEA_DAILY + ' 次茶室对战奖励已经领完了，明天 0 点刷新。';
      go('social');
      if (msg) setTimeout(function () { toast(msg); }, 300);
      if (opt.onDone) opt.onDone(r ? r.res : res, quit);
    });
    var team = (acc.teams[acc.active] || []).map(mon).filter(Boolean);
    if (!team.length) team = acc.mons.slice(0, 1);
    var p = team.slice(0, TEAM_SIZE).map(storyMon);
    stopTimers(); ex.fighting = true; document.body.classList.add('story-fight');
    ['holo', 'log', 'bag', 'store', 'release', 'dex', 'items', 'social', 'explore'].forEach(function (pg) { $('pg-' + pg).hidden = true; });
    $('pg-arena').hidden = false; $('who-menu').hidden = true;
    window.HSBATTLE.start({ p: p, a: opt.foe, foe: opt.owner + '的基地', bg: BG.tea_p, back: '基地', onEnd: function (res, seen, downs, quit) {
      ex.fighting = false; document.body.classList.remove('story-fight');
      var msg = '';
      if (quit) msg = '认输的茶室对战不计入奖励次数。';
      else if (teaLeft() > 0) {
        var t = acc.teaFight && acc.teaFight.d === todayKey() ? acc.teaFight : { d: todayKey(), n: 0 };
        t.n++; acc.teaFight = t; earn('tea', t.d + ':' + t.n, { exp: TEA_EXP }); save();
        msg = '茶室对战奖励：累积经验 +' + fmt(TEA_EXP) + '，已放进经验背包。今天还能领 ' + teaLeft() + ' 次。';
      } else msg = '今天的 ' + TEA_DAILY + ' 次茶室对战奖励已经领完了，明天 0 点刷新。';
      go('social');
      setTimeout(function () { toast(msg); }, 300);
      if (opt.onDone) opt.onDone(res, quit);
    } });
  }

  /* ---------- 精灵大乱斗（竞技对战的第三种模式，联网） ----------
   * 6 只精灵统一 LV60、学会所有隐藏技能、配招为技能表的最后 4 个、无学习力，性格由服务器随机
   * 胜者 2000、败者 1000 累积经验（平局各 1000；自己认输或自己掉线没有奖励），每天最多 20000 */
  var BRAWL_WIN = 2000, BRAWL_LOSE = 1000, BRAWL_CAP = 20000, BRAWL_LV = 60;
  function brawlSpec(raw) {
    var s = raw && SPMAP[raw.sid]; if (!s) return null;
    var all = s.moves.concat(s.hidden).filter(function (n, i, a) { return M[n] && a.indexOf(n) === i; });
    var f = form({ sid: raw.sid, lv: BRAWL_LV });
    return { id: raw.sid, lv: BRAWL_LV, moves: all.slice(-4), nick: f.name, img: f.img, ev: {}, nat: raw.nat && NATURES[raw.nat] ? raw.nat : null };
  }
  function brawlToday() { return acc.brawlExp && acc.brawlExp.d === bjDay() ? acc.brawlExp.n || 0 : 0; }
  function brawlReward(result, noReward, id, cb) {   // 奖励由服务器按它记下的对局结果发（交易 brawlRw，见 grow.js）
    var first = !brawlPlayed();
    var fin = function (r) {
      if (!noReward) { dailyNote('brawl'); dailyNote('brawlWin'); }   // 进度由交易加（grow.js）
      if (!noReward && first && brawlPlayed()) setTimeout(function () { toast('支线「精灵大乱斗」完成！随时可以再来和其他船员打大乱斗。'); }, 4200);
      renderRes(); if (cb) cb(r);
    };
    txRun('brawlRw', { id: String(id || '') }, function (r) { fin({ want: r.want, give: r.give, today: r.today, cap: r.cap }); }, function () { fin({ want: 0, give: 0, today: brawlToday(), cap: BRAWL_CAP }); });
  }

  /* ---------- 给社交页（social.js）用的接口 ---------- */
  window.HSACC = {
    acc: function () { return acc; }, ready: ready, save: save, toast: toast, go: go, page: function () { return page; }, renderRes: renderRes,
    titleName: titleName, mon: mon, fmt: fmt, milRank: milRank, avatarInner: avatarInner, avatarSpec: function () { return avatarCur(); },
    npcPlan: npcPlan, npcHome: npcHome,
    sendMail: sendMail, openMailbox: openMailbox,
    rankToday: rankToday, adopt: adoptAcc, patch: patchAcc, RANK_EXP: { exp: RANK_EXP, n: RANK_EXP_N, token: RANK_TOKEN }, tokenBarHTML: tokenBarHTML, openTokenShop: openTokenShop, rankRwHTML: rankRwHTML, openQuests: openQuests, gender: gender,
    brawlOpen: brawlOpen, brawlSpec: brawlSpec, brawlReward: brawlReward, brawlToday: brawlToday, BRAWL: { win: BRAWL_WIN, lose: BRAWL_LOSE, cap: BRAWL_CAP, lv: BRAWL_LV },
    // 平衡模式切磋：LV60、性格无修正、没有学习力和纹章，技能可以从全部技能里选（没选就用竞技对战里记住的配招）
    balSpec: function (raw) {
      var s = raw && SPMAP[raw.sid]; if (!s) return null;
      var own = s.moves.concat(s.hidden);
      var mv = (raw.moves || []).filter(function (n, i, a) { return M[n] && own.indexOf(n) >= 0 && a.indexOf(n) === i; }).slice(0, 4);
      if (!mv.length) mv = window.HSBATTLE && HSBATTLE.loadout ? HSBATTLE.loadout(raw.sid) : s.def.slice();
      var f = form({ sid: raw.sid, lv: BAL_LV });
      return { id: raw.sid, lv: BAL_LV, moves: mv, nick: f.name, img: f.img, ev: {}, nat: null };
    },
    BAL_LV: BAL_LV, speciesN: speciesN, homeOpen: homeOpen,
    homeRefresh: function () { if (page === 'explore' && ex.view === 'home' && !ex.fighting && !ex.baseEdit && document.querySelector('.home-room')) renderHome(); },
    goHome: function () { if (!homeOpen()) { toast('读完星际探索 · 荆楚号 · 天门「陆羽茶室」支线后，才有自己的茶室。'); return; } ex.planet = 'jingchu'; ex.area = '天门'; ex.view = 'home'; go('explore'); },
    // 参加过一次竞技征召（支线任务「竞技征召」用）
    noteDraft: function () { if (!acc.stats) acc.stats = {}; acc.stats.drafts = (acc.stats.drafts || 0) + 1; save(); },
    teaFight: teaFight, teaLeft: teaLeft, TEA_DAILY: TEA_DAILY, TEA_EXP: TEA_EXP,
    // 去好友基地偷经验（2026-11-03，规则在 js/engine/grow.js）
    homeStolen: function (u, user, n) {   // 好友刚偷走了基地里一只精灵的经验（服务器推送）：本机记录跟着扣，基地画面就地更新
      if (!acc || !(n > 0)) return;
      var H = home(), x = H.mons.filter(function (y) { return y && y.u === u; })[0]; if (!x) return;
      x.st = (x.st | 0) + n; x.sb = (Array.isArray(x.sb) ? x.sb : []).concat([String(user || '')]).slice(-100); save();
      if (ex.view !== 'home') return;
      H.mons.forEach(function (y, i) { var t = document.querySelector('[data-htag="' + i + '"]'); if (t) t.innerHTML = homeTag(y); });
      var b = document.querySelector('.home-room .hm-fig[data-hu="' + u + '"] .hm-ready'); if (b) b.outerHTML = homeReadyBub(x);
    },
    homeSteal: function (owner, u, ok, fail) { txRun('homeSteal', { owner: owner, u: u }, function (res) { renderRes(); if (ok) ok(res); }, fail); }, homePos: HOME_POS, baseRoom: baseRoomHTML, baseMonPos: baseMonPos, baseFigW: baseFigW,
    view: function (m) { var f = form(m); return { name: f.name, img: f.img, stage: f.stage, shiny: f.shiny }; },
    // 把服务器发来的精灵资料变成对战用的精灵（逐项检查，不信任外来数据）
    spec: function (raw) {
      var s = raw && SPMAP[raw.sid]; if (!s) return null;
      var lv = Math.max(1, Math.min(100, Math.round(+raw.lv || 1)));
      var own = s.moves.concat(s.hidden);
      var mv = (raw.moves || []).filter(function (n, i, a) { return M[n] && own.indexOf(n) >= 0 && a.indexOf(n) === i; }).slice(0, 4);
      if (!mv.length) mv = defaultMoves(raw.sid, lv, []);
      var ev = {}; STAT_KEYS.forEach(function (k) { var v = raw.ev && +raw.ev[k]; if (v > 0) ev[k] = Math.min(300, Math.round(v)); });
      var iv = ivOk(raw.iv) ? STAT_KEYS.reduce(function (o, k) { o[k] = raw.iv[k]; return o; }, {}) : null;   // 没带天赋的按满天赋
      var f = form({ sid: raw.sid, lv: lv, shiny: shinyV(raw.shiny) });
      return { id: raw.sid, lv: lv, moves: mv, nick: f.name, img: f.img, shiny: shinyV(raw.shiny), ev: ev, iv: iv, nat: raw.nat && NATURES[raw.nat] ? raw.nat : null, emblem: raw.emblem && EMBLEMS[raw.sid] ? EMBLEMS[raw.sid].m : null };
    },
    inBattle: function () { return !$('battle').hidden; },
    // 联网切磋：像剧情对战一样切到对战画面，锁住其他大栏
    enterBattle: function () {
      stopTimers(); ex.fighting = true; document.body.classList.add('story-fight');
      ['holo', 'log', 'bag', 'store', 'release', 'dex', 'items', 'social', 'explore'].forEach(function (p) { $('pg-' + p).hidden = true; });
      $('pg-arena').hidden = false; $('who-menu').hidden = true;
    },
    leaveBattle: function () { ex.fighting = false; document.body.classList.remove('story-fight'); go('social'); }
  };

  /* ---------- 界面音乐：按当前所在的界面选曲（对战中由战斗音乐盖过，见 js/ui/audio.js） ---------- */
  var FLORA_SCENES = { flora: 1, floraGrass: 1, floraForest: 1 };
  function sceneNow() {
    var vb = vnBgm(); if (vb) return vb;   // 剧本里逐行指定的曲目（bgm 字段）优先，瘴气化之后重读也按剧本放
    var k = sceneNowRaw();
    if ((page === 'explore' && ex.view === 'home') || (page === 'social' && window.HSSOCIAL && HSSOCIAL.visitBgm && HSSOCIAL.visitBgm())) return k;   // 茶室音乐按选的曲目原样放，不受瘴气化替换（Flora1 = 草甸、Flora2 = 丛林）
    return FLORA_SCENES[k] && floraFallen() ? 'floraFallen' : k;   // 第八段结尾瘴气化之后，芙罗拉星的界面音乐统一换成 floraFallen（flora3-TheGreatCover）
  }
  // 剧本行可以写 bgm: '曲目键'（见 audio.js 的 TRACKS/SCENES），从这一行起一直生效，直到下一个写了 bgm 的行；'silence' 表示停止音乐
  function vnBgm() {
    if (!(ex.site && SCRIPT[ex.site] && $('vn') && (page === 'explore' || ex.mode === 'intro') && (ex.mode === 'intro' || (ex.mode === 'replay' && ex.view === 'vn')))) return null;
    return carry(Math.min(ex.i || 0, SCRIPT[ex.site].length - 1), 'bgm', null);
  }
  function sceneNowRaw() {
    var vnSite = ex.site && SITES[ex.site] && (ex.mode === 'intro' || (ex.mode === 'replay' && ex.view === 'vn')) ? SITES[ex.site].planet : null;
    if (vnSite === 'earth') return 'earth';            // 地球上的剧情（含序章）
    if (!ready()) return 'ui';
    if (document.querySelector('.sum-anim')) return 'summon';   // 2026-11-01：召唤曲只在召唤动画里放，召唤页面用默认的曲子
    if (page === 'arena') return 'arena';              // 竞技大厅
    if (page === 'holo') return mmLive() ? 'mingTheme' : 'ui';
    if (page === 'explore' && ex.view === 'endless') return 'mingTheme';   // 无尽作战（2026-11-02）   // 全息作战（大型活动展厅）
    if (page === 'explore' && ex.view === 'home') return homeBgm();
    if (page === 'explore' && ex.view === 'spa') return spaBgm();   // 温泉：默认 spa，休息室里可以解锁别的   // 自己的茶室：放自己选的茶室音乐
    if (page === 'social' && window.HSSOCIAL && HSSOCIAL.visitBgm) { var vb = HSSOCIAL.visitBgm(); if (vb) return vb; }   // 拜访别人的茶室：放主人选的
    if (page === 'explore') {
      if (vnSite === 'flora') return 'flora';
      // 2026-10-31：第十八段里见过玫瑰星云之后，坎伯兰星的所有地方（星球界面、剧情页、野外、古代神殿、BOSS页）都换成 Cumberland5
      if (prog('kb8').done) {   // 2026-11-01：第二章通关后，坎伯兰星的曲子变回原来的；只有深海区（野外和奥多亚克BOSS页）从 Cumberland3 换成 Cumberland4
        if (vnSite === 'kamble' || (ex.view === 'sites' && ex.planet === 'kamble')) return 'kb';
        if (ex.view === 'boss' && BOSSES[ex.boss] && BOSSES[ex.boss].region === 'kb_deep') return 'kbDeep2';
        if (ex.view === 'field' && regionById(ex.region) && regionById(ex.region).planet === 'kamble') {
          var sck = fields[ex.region] && fields[ex.region].scenes && fields[ex.region].scenes[fields[ex.region].scene];
          if (sck && sck.bgKey === 'kb_temple') return 'temple';
          return ex.region === 'kb_sea' ? 'kbShallow' : ex.region === 'kb_surf' ? 'kbSurface' : ex.region === 'kb_deep' ? 'kbDeep2' : 'kb';
        }
      }
      var kbArea = vnSite === 'kamble' || (ex.view === 'sites' && ex.planet === 'kamble') || (ex.view === 'field' && ex.region !== 'kb_deep' && regionById(ex.region) && regionById(ex.region).planet === 'kamble');   // 深海区（野外和奥多亚克BOSS页）维持原来的曲子（保卫战开始后是 Cumberland4）
      if (kbArea && nebulaSeen()) return 'kbDeep3';
      if (vnSite === 'kamble') return 'kb';
      if (ex.view === 'mmArena' || ex.view === 'mmGacha') return 'mingTheme';
      if (ex.view === 'field' && ex.region === 'pp_city') return 'pompeiiCity';   // 2026-11-03：庞贝星 · 饮火城
      if (ex.view === 'field' && ex.region === 'pp_lava') return 'pompeiiField';   // 庞贝星 · 熔岩原
      if (ex.view === 'sites' && ex.planet === 'pompeii') return 'pompeii';   // 庞贝星主界面
      if (ex.view === 'field' && ex.region === 'fl_record') return 'floraFallen';
      if (ex.view === 'sites' && ex.planet === 'flora') return 'flora';
      if (ex.view === 'field' && fields[ex.region] && regionById(ex.region) && regionById(ex.region).planet === 'flora') {   // 芙罗拉星野外：草甸放 floraGrass，丛林放 floraForest
        var rid_ = regionById(ex.region).id;
        return rid_ === 'grass' ? 'floraGrass' : rid_ === 'forest' ? 'floraForest' : 'flora';
      }
      if (ex.view === 'boss' && BOSSES[ex.boss] && BOSSES[ex.boss].planet === 'flora') return 'flora';
      if (ex.view === 'boss' && BOSSES[ex.boss] && BOSSES[ex.boss].region === 'kb_deep') return 'kbDeep';   // 奥多亚克的BOSS页
      if (ex.view === 'field' && fields[ex.region] && fields[ex.region].scenes) { var sc_ = fields[ex.region].scenes[fields[ex.region].scene]; if (sc_ && sc_.bgKey === 'kb_temple') return 'temple'; }   // 坎伯兰星 · 古代神殿
      if ((ex.view === 'sites' && ex.planet === 'kamble') || (ex.view === 'field' && regionById(ex.region) && regionById(ex.region).planet === 'kamble')) { if (kbwOpenC()) return 'kbDeep2'; }   // 2026-10-31：坎伯兰星保卫战开始后，星球界面和野外都放 Cumberland4
      if (ex.view === 'sites' && ex.planet === 'kamble') return 'kb';   // 坎伯兰星界面
      if (ex.view === 'field' && regionById(ex.region) && regionById(ex.region).planet === 'kamble') return ex.region === 'kb_sea' ? 'kbShallow' : ex.region === 'kb_surf' ? 'kbSurface' : ex.region === 'kb_deep' ? 'kbDeep' : 'kb';   // 2026-10-19：水面换成 Cumberland1Surface
    }
    return 'ui';
  }
  function nebulaSeen() { var p7 = prog('kb7'); if (p7.done) return true; var i7 = (SCRIPT.kb7 || []).findIndex(function (st) { return st.battle === 'nebula'; }); return i7 >= 0 && p7.at >= i7; }
  function bgmScene() { if (window.HSAUDIO && HSAUDIO.scene) HSAUDIO.scene(sceneNow()); }
  setInterval(bgmScene, 500);

  // 2026-11-03：每次打开游戏（登录后）默认进自己的基地；基地还没开放的照旧回到上次的页面
  if (ready() && homeOpen()) { page = 'explore'; ex.planet = 'jingchu'; ex.area = '天门'; ex.view = 'home'; ex.mode = null; }
  renderTop(); syncBattle(); bgmScene();
})();
