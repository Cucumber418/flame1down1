/* ==========================================================
 * 精灵培养的规则（2026-10-25）：服务器和浏览器共用
 *
 * 精灵道具（USE_ITEMS）、等级上限、喂经验、分配学习力……这些会改精灵数值的操作，用服务器网址玩时都走交易（js/engine/tx.js 的 TX）：
 * 服务器先在它的存档上算，浏览器再用同样的随机数重放一遍。这里用 TX.add 注册这些交易。
 * ========================================================== */
var GROW = (function () {
  'use strict';
  var EV_TOTAL0 = EV_TOTAL;
  var USE_ITEMS = {
    ivReroll: { name: '天赋重组合剂', sid: null, kind: 'iv', d: '把你的任意一只精灵的六项天赋（0~31）全部重新随机。新的天赋可能更高，也可能更低。' },
    natTagore: { name: '泰戈尔性格药剂', sid: 'tagore', kind: 'nat', d: '把你的一只泰戈尔（小胖虎、胖虎也可以）的性格改成你指定的性格。' },
    ev50: { name: '50学习力合剂', sid: null, kind: 'ev', amt: 50, d: '为你的任意一只精灵直接增加 50 点学习力。加进「可分配学习力」，再在精灵资料里自己分配；学习力总量最多 ' + EV_TOTAL0 + '。' },   // 2026-10-27：通用学习力合剂拆成 50、100 两种
    evAny: { name: '100学习力合剂', sid: null, kind: 'ev', amt: 100, d: '为你的任意一只精灵直接增加 100 点学习力。加进「可分配学习力」，再在精灵资料里自己分配；学习力总量最多 ' + EV_TOTAL0 + '。' },
    evTagore: { name: '泰戈尔学习力合剂', sid: 'tagore', kind: 'ev', d: '为你的一只泰戈尔（小胖虎、胖虎也可以）直接增加 100 点学习力。加进「可分配学习力」，再在精灵资料里自己分配；学习力总量最多 ' + EV_TOTAL0 + '。' },
    // 竞技代币商店（2026-10-14）
    ivMoon: { name: '小月亮专属天赋重置药剂', sid: 'moon', kind: 'iv2', d: '只能用在小月亮（朔望月灵也可以）身上。把六项天赋全部重新随机，每一项都会掷两次、取较高的一次，比普通的天赋重组合剂更容易出高天赋。', none: '你还没有小月亮。平衡排位第一次达到铂金时会送一只。' },
    ivBone: { name: '凶骨专属天赋重置药剂', sid: 'bone', kind: 'iv2', d: '只能用在凶骨（骨刃一系都可以）身上。把六项天赋全部重新随机，每一项都会掷两次、取较高的一次，比普通的天赋重组合剂更容易出高天赋。', none: '你还没有凶骨。平衡排位第一次达到王者时会送一只。' },
    natAny: { name: '性格胶囊', sid: null, kind: 'nat', d: '把你的任意一只精灵的性格改成你指定的性格。' },
    evReset: { name: '学习力重置胶囊', sid: null, kind: 'evreset', d: '把一只精灵已经分配的学习力全部退回「可分配学习力」，可以重新分配。' },
    fruit1: { name: '成长果实', sid: null, kind: 'exp', rate: 100, d: '给一只精灵直接增加经验。等级越高，得到的经验越多。' },
    fruit2: { name: '迅速成长果实', sid: null, kind: 'exp', rate: 250, d: '给一只精灵直接增加经验，比成长果实效果更好。等级越高，得到的经验越多。' },
    // 瘴气驱逐战（2026-10-17）：100 个让芙罗拉星三种精灵领悟一个隐藏技能
    earthShard: { name: '地球元素', sid: null, sids: ['leaf', 'squid', 'shroom'], kind: 'jade', cost: 100, sd: '从地球带来的元素结晶。专门用于叶粒之果、水臂领主、涅槃方头（三只初始精灵）的隐藏技能和等级上限。', d: '出发前从地球上带来的一小份元素结晶，带着家乡的气息。100 个可以让一只叶粒之果、水臂领主、涅槃方头一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能，解锁后你持有的这一种族都能使用；它们达到 LV70 后，也用它解锁 LV75（500 个）、LV80（1000 个）的等级上限。', none: '你还没有叶粒之果、乌贼领主或涅槃方头。' },
    moonStone: { name: '新月辉石', sid: null, sids: ['moon'], kind: 'jade', cost: 100, sd: '小月亮的专属道具。可以让小月亮领悟隐藏技能，也能提高小月亮的等级上限。', d: '一块映着新月微光的石头。100 个可以让一只小月亮一系（朔望月灵也可以）直接领悟一个还没领悟的隐藏技能，解锁后你持有的小月亮都能使用；小月亮达到 LV70 后，也用它解锁 LV75（500 个）、LV80（1000 个）的等级上限。在竞技代币商店兑换。', none: '你还没有小月亮。平衡排位第一次达到铂金时会送一只。' },
    boneDust: { name: '灵骨粉末', sid: null, sids: ['bone'], kind: 'jade', cost: 100, sd: '骨刃的专属道具。可以让骨刃领悟隐藏技能，也能提高骨刃的等级上限。', d: '泛着幽光的骨粉，摸上去凉凉的。100 个可以让一只骨刃一系（凶骨也可以）直接领悟一个还没领悟的隐藏技能，解锁后你持有的骨刃都能使用；骨刃达到 LV70 后，也用它解锁 LV75（500 个）、LV80（1000 个）的等级上限。在竞技代币商店兑换。', none: '你还没有骨刃一系的精灵。' },
    tgPearl: { name: '虎啸凝珠', sid: null, sids: ['tagore'], kind: 'jade', cost: 100, sd: '困难难度泰戈尔的专属道具。可以让泰戈尔领悟隐藏技能，也能提高泰戈尔的等级上限。', d: '泰戈尔一声虎啸凝成的珠子。100 个可以让一只泰戈尔一系（小胖虎、胖虎也可以）直接领悟一个还没领悟的隐藏技能；泰戈尔达到 LV70 后，也用它解锁 LV75（500 个）、LV80（1000 个）的等级上限。首次击败困难难度的泰戈尔得 80 个，每周挑战每次击败得 15 / 30 / 50 个（简单 / 普通 / 困难）。', none: '你还没有泰戈尔（小胖虎、胖虎也算）。击败简单难度的BOSS「泰戈尔」可以领养一只小胖虎。' },
    brTwig: { name: '莠去津', sid: null, sids: ['barren'], kind: 'jade', cost: 100, sd: '荒芜的专属道具。可以让荒芜领悟隐藏技能，也能提高荒芜的等级上限。', d: '从荒芜体内的古代除草程序里提取出的一小瓶药剂，标签上写着「莠去津」。100 个可以让一只荒芜一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能；荒芜达到 LV70 后，也用它解锁 LV75（500 个）、LV80（1000 个）的等级上限。首次击败普通难度的荒芜得 40 个、困难难度得 80 个，每周挑战每次击败得 15 / 30 / 50 个（简单 / 普通 / 困难）。', none: '你还没有荒芜。击败简单难度的BOSS「荒芜」可以得到一只。' },
    hrDisk: { name: '星盘', sid: null, sids: ['hauris'], kind: 'jade', cost: 100, sd: '幽灵鱼一系的专属道具。可以让幽灵鱼一系领悟隐藏技能。', d: '击败野外随机出现的幽灵鱼时掉落的小星盘，盘面上的星点会自己转动。100 个可以让一只幽灵鱼一系（幽灵鱼、哈蒙德、哈尔达蒙）直接领悟一个还没领悟的隐藏技能。每击败一只幽灵鱼掉落 50–70 个。', none: '你还没有幽灵鱼一系的精灵。' },
    m_lcleaf: { name: '叶子喵的叶片', sid: null, sids: ['leafcat'], kind: 'jade', cost: 2, sd: '叶子喵一系的隐藏技能解锁道具。', d: '旅行精灵叶子喵身上掉下来的叶片。2 片可以让一只叶子喵一系直接领悟一个还没领悟的隐藏技能；5 片可以在冶炼坊合成叶子喵的精元。', none: '你还没有叶子喵一系的精灵。' },
    odoFin: { name: '先祖鳍甲', sid: null, sids: ['odo'], kind: 'jade', cost: 100, sd: '奥多亚克的专属道具。可以让奥多亚克领悟隐藏技能，也能提高奥多亚克的等级上限。', d: '从深海的奥多亚克身上脱落的一片古老鳍甲，表面刻着看不懂的纹路。100 个可以让一只奥多亚克一系（奥多也可以）直接领悟一个还没领悟的隐藏技能；奥多亚克达到 LV70 后，也用它解锁 LV75（500 个）、LV80（1000 个）的等级上限。首次击败普通难度的奥多亚克得 40 个、困难难度得 80 个，每周挑战每次击败得 15 / 30 / 50 个（简单 / 普通 / 困难）。', none: '你还没有奥多亚克（奥多也算）。击败简单难度的BOSS「奥多亚克」可以得到奥多的精元。' },
    deathTok: { name: '死神代币', sid: null, sids: ['pluto'], kind: 'jade', cost: 1, d: '击败先驱之塔第 60 层的死神获得，一个账号最多 3 颗。1 颗可以让帕努托尔一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能；先驱之塔的代币商店里，兑换「帕努托尔的精元」也要用到它。', none: '你还没有帕努托尔。在先驱之塔的代币商店里，用 3000 先驱代币 + 1 颗死神代币可以兑换「帕努托尔的精元」。' },
    // 各星球特产（2026-10-18）：和芙罗拉玉一样，100 个让该星球的普通野生精灵一系领悟一个隐藏技能；也用来解锁同属性精灵的等级上限
    kbDrop: { name: '不化水滴', sid: null, sids: ['pede', 'gorgon', 'siren'], kind: 'jade', cost: 100, gem: '水', sd: '坎伯兰星的特产。可以让坎伯兰星的普通野生精灵领悟隐藏技能，也能提高水系精灵的等级上限。', d: '坎伯兰星浅海里凝成的水滴，永远不会蒸发。100 个可以让一只坎克托斯、戈耳贡、塞壬一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能；水系精灵达到 LV70 后，也可以用它解锁更高的等级上限。在坎伯兰星的野外场景里每天有机会捡到。', none: '你还没有坎克托斯、戈耳贡或塞壬（进化前的形态也算）。去坎伯兰星捕捉吧。' },
    ppAsh: { name: '火山灰烬', sid: null, sids: ['hephaestus', 'firemouse', 'turkey'], kind: 'jade', cost: 100, gem: '火', sd: '庞贝星的特产。可以让庞贝星的普通野生精灵领悟隐藏技能，也能提高火系精灵的等级上限。', d: '庞贝星火山喷出的灰烬，摸上去还是温热的。100 个可以让一只赫菲斯托、费尔茅斯、冲锋火鸡一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能；火系精灵达到 LV70 后，也可以用它解锁更高的等级上限。在庞贝星的野外场景里每天有机会捡到。', none: '你还没有赫菲斯托、费尔茅斯或冲锋火鸡（进化前的形态也算）。去庞贝星捕捉吧。' },
    ltOrb: { name: '闪电球体', sid: null, sids: ['leigong', 'faraday', 'leibniz'], kind: 'jade', cost: 100, gem: '电', sd: '莱汀陨石带的特产。可以让陨石带的普通野生精灵领悟隐藏技能，也能提高电系精灵的等级上限。', d: '雷暴里凝成的一团电光，握在手里噼啪作响。100 个可以让一只雷公、法拉第一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能；电系精灵达到 LV70 后，也可以用它解锁更高的等级上限。在莱汀陨石带的野外场景里每天有机会捡到。', none: '你还没有雷公或法拉第（进化前的形态也算）。去莱汀陨石带捕捉吧。' },
    whFrost: { name: '永久冻土', sid: null, sids: ['frost'], kind: 'jade', cost: 100, gem: '冰', sd: '白之星的特产。可以让白之星的普通野生精灵领悟隐藏技能，也能提高冰系精灵的等级上限。', d: '白之星冰原下挖出的冻土，一万年都不会化开。100 个可以让一只霜冻之冠一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能；冰系精灵达到 LV70 后，也可以用它解锁更高的等级上限。在白之星的野外场景里每天有机会捡到。', none: '你还没有霜冻之冠（进化前的形态也算）。去白之星的永冻冰原捕捉吧。' },
    formDev: { name: '形态切换装置', sid: null, kind: 'form', sd: '给一只精灵永久解锁一个可以切换的外观形态。', d: '黄石 · 冶炼坊用圣晶石和星砂合成的装置。用在一只精灵身上，给这只精灵永久解锁一个它已经长到过的更小形态的样子（比如让最终形态变回第一形态的样子）。解锁之后，在精灵资料的「外观形态」里，原本的形态和解锁过的形态之间随时免费切换。只改变外观，数值、技能都不变；每只精灵分开解锁。' },
    floraJade: { name: '芙罗拉玉', gem: '草', sd: '芙罗拉星的特产。可以让芙罗拉星的普通野生精灵领悟隐藏技能，也能提高草系精灵的等级上限。', sid: null, sids: ['mush', 'wind', 'kaleo'], kind: 'jade', cost: 100, d: '芙罗拉星深处凝成的绿色玉石。100 个可以让一只玛西露姆、六尾风王、卡莱奥丹一系（进化前的形态也可以）直接领悟一个还没领悟的隐藏技能，不用再满足战斗里的领悟条件。隐藏技能要到 LV' + HIDDEN_MIN_LV + ' 才能装备。瘴气驱逐战的全服奖励会发放；芙罗拉星的丛林、草甸里，每天也有机会捡到少量。', none: '你还没有玛西露姆、六尾风王或卡莱奥丹（进化前的形态也算）。去芙罗拉星的丛林、草甸捕捉吧。' }
  };
  USE_ITEMS.natRand = { name: '性格重置胶囊', sid: null, kind: 'natRand', sd: '把一只精灵的性格随机换成另一种。', d: '把你的任意一只精灵的性格随机换成另一种性格（不会和原来的一样）。圣晶石召唤获得。' };   // 2026-11-01
  USE_ITEMS.fencArc = { name: '花剑圆弧', sid: null, sids: ['tiago'], kind: 'jade', cost: 100, sd: '蒂亚戈一系的专属道具。可以让尖盔虫、蒂亚戈领悟隐藏技能。', d: '剑尖划出的一道圆弧，凝成了实体。100 个可以让一只尖盔虫或蒂亚戈领悟一个还没领悟的隐藏技能。使用神秘精灵兑换券时一起获得。', none: '你还没有尖盔虫或蒂亚戈。用神秘精灵兑换券兑换吧。' };   // 2026-11-02
  USE_ITEMS.phLeaf = { name: '魔化之叶', sid: null, sids: ['phantom'], kind: 'jade', cost: 100, sd: '叶粒魔种一系的专属道具。可以让幻境叶果领悟隐藏技能，也能提高它的等级上限。', d: '叶粒魔种一系的专属道具。100 个可以让一只叶粒魔种一系领悟一个隐藏技能，也用来提高幻境叶果的等级上限。召唤代币商店兑换。' };
  USE_ITEMS.iceAncient = { name: '远古冰块', sid: null, sids: ['wild'], kind: 'jade', cost: 100, sd: '亚哆一系的专属道具。可以让亚哆领悟隐藏技能，也能提高亚哆的等级上限。', d: '从白之星冰层深处凿下来的冰块，冻着比冰更古老的东西。100 个可以让一只亚哆一系领悟一个隐藏技能；也用来提高亚哆一系的等级上限。击碎封着亚哆的冰块时获得 80～120 个，击败白之星的野生精灵有 10% 几率掉落 10～20 个。' };   // 2026-11-01
  USE_ITEMS.mmEye = { name: '雷明之眼', sid: null, sids: ['leiming'], kind: 'jade', cost: 100, sd: '雷明灯一系的专属道具。100 个可以让一只雷明灯一系领悟一个隐藏技能。', d: '明明代币抽奖从第 5 个奖池起，每逢 5 的倍数的奖池里有 50 个。100 个可以让一只雷明灯一系（进化前的形态也可以）领悟一个还没领悟的隐藏技能。' };
  // 等级上限：喂经验最高到 LV70；用星球特产 / BOSS专属道具解锁到 75、80
  var CAP_STEPS = [{ lv: 75, jade: 500 }, { lv: 80, jade: 1000 }];
  for (var cl = 82; cl <= 100; cl += 2) CAP_STEPS.push({ lv: cl, jade: 500, grail: 1 });   // 2026-11-01：80 级以后每 2 级突破一次，要 500 个对应道具和 1 个圣杯
  var GEM_OF = { 草: 'floraJade', 水: 'kbDrop', 火: 'ppAsh', 电: 'ltOrb', 冰: 'whFrost' };
  var CAP_SID = { tagore: 'tgPearl', barren: 'brTwig', odo: 'odoFin', wild: 'iceAncient', phantom: 'phLeaf', tiago: 'earthShard', leaf: 'earthShard', squid: 'earthShard', shroom: 'earthShard', moon: 'moonStone', bone: 'boneDust' };
  function capGem(m) { if (CAP_SID[m.sid]) return CAP_SID[m.sid]; var t = SPMAP[m.sid] ? SPMAP[m.sid].types : []; for (var i = 0; i < t.length; i++) if (GEM_OF[t[i]]) return GEM_OF[t[i]]; return null; }
  function capNext(m) { var g = capGem(m); if (!g) return null; var c = ACC.capLv(m); for (var i = 0; i < CAP_STEPS.length; i++) if (CAP_STEPS[i].lv > c) return { lv: CAP_STEPS[i].lv, jade: CAP_STEPS[i].jade, grail: CAP_STEPS[i].grail || 0, k: g }; return null; }
  function formLabel(s, i) { var n = formRawName(s, i); return n ? n.replace('?', '') : s.name + '·' + stageLabel(s, i); }
  function natText(nat) { var n = NATURES[nat]; return n ? BASE_NAME[n[0]] + ' +10%，' + BASE_NAME[n[1]] + ' −10%' : '各项能力无修正'; }
  function itemFits(k, m) { var it = USE_ITEMS[k]; return !!(it && m && (it.sids ? it.sids.indexOf(m.sid) >= 0 : !it.sid || it.sid === m.sid)); }
  function jadeMoves(m) { var have = m.hl || []; return SPMAP[m.sid].hidden.filter(function (n) { return have.indexOf(n) < 0; }); }
  function formOpts(m) {
    var s = SPMAP[m.sid], nat = ACC.stageOf(s, m.lv), fu = Array.isArray(m.fu) ? m.fu : [], out = [];
    for (var i = 0; i < nat; i++) if (fu.indexOf(i) < 0) out.push({ i: i, n: formLabel(s, i) });
    return out;
  }
  function evRoom(m) { return Math.max(0, EV_TOTAL - ACC.evSum(m) - (m.evFree || 0)); }
  function items(a) { if (!a.items || typeof a.items !== 'object') a.items = {}; return a.items; }
  function no(err) { return { ok: false, err: err }; }
  function int(v) { return typeof v === 'number' && isFinite(v) && v === Math.floor(v) ? v : NaN; }
  function monOf(a, args) { return ACC.mon(a, int(args.u)); }
  // 把精灵道具用在 m 身上；nat 是性格药剂要改成的性格（隐藏技能道具时是技能名、形态装置时是形态序号）。返回 { ok, msg, g（加经验的结果） }
  function applyMonItem(a, k, m, nat, rand) {
    var it = USE_ITEMS[k], I = items(a);
    if (!it || !(I[k] > 0)) return no('没有这个道具了。');
    if (!itemFits(k, m)) return no('先选一只' + (it.sids ? it.sids.map(function (x) { return SPMAP[x].name; }).join('、') : it.sid ? SPMAP[it.sid].name : '精灵') + '。');
    var name = ACC.form(m).name;
    if (it.kind === 'jade') {
      if (I[k] < it.cost) return no(it.name + '不够：需要 ' + it.cost + ' 个，你现在有 ' + I[k] + ' 个。');
      var left = jadeMoves(m); if (!left.length) return no(name + ' 已经领悟了全部隐藏技能。');
      if (left.indexOf(nat) < 0) nat = left[0];
      if (!Array.isArray(m.hl)) m.hl = []; m.hl.push(nat);
      I[k] -= it.cost;
      return { ok: true, msg: name + '领悟了隐藏技能「' + nat + '」！' + 'LV' + HIDDEN_MIN_LV + ' 以上的就能在精灵资料的技能栏里装备。' };
    }
    if (it.kind === 'form') {
      var fo = formOpts(m), v = parseInt(nat, 10);
      if (!fo.length) return no(name + ' 没有可以解锁的形态了（要先进化过，已经解锁的不用再解锁）。');
      if (!fo.some(function (x) { return x.i === v; })) v = fo[0].i;
      if (!Array.isArray(m.fu)) m.fu = []; m.fu.push(v); m.fs = v;
      I[k]--;
      return { ok: true, msg: '这只' + SPMAP[m.sid].name + '永久解锁了「' + formLabel(SPMAP[m.sid], v) + '」的样子，已经换上。以后在精灵资料的「外观形态」里随时免费切换。' };
    }
    if (it.kind === 'natRand') {   // 性格重置胶囊：随机换成另一种性格
      var old0 = m.nat, L0 = ACC.NAT_KEYS.filter(function (x) { return x !== m.nat; }); m.nat = L0[Math.floor(rand() * L0.length)]; I[k]--;
      return { ok: true, msg: name + ' 的性格从「' + old0 + '」变成了「' + m.nat + '」（' + natText(m.nat) + '）。' };
    }
    if (it.kind === 'nat') {
      if (!nat || !(nat in NATURES)) return no('先选一个性格。');
      if (nat === m.nat) return no('它已经是「' + nat + '」性格了，换一个吧。');
      var old = m.nat; m.nat = nat; I[k]--;
      return { ok: true, msg: name + ' 的性格从「' + old + '」变成了「' + nat + '」（' + natText(nat) + '）。' };
    }
    if (it.kind === 'iv' || it.kind === 'iv2') {
      var o = ACC.ivOf(m), n = ACC.randIv(rand);
      if (it.kind === 'iv2') { var n2 = ACC.randIv(rand); ACC.STAT_KEYS.forEach(function (x) { n[x] = Math.max(n[x], n2[x]); }); }   // 专属药剂：每项掷两次取高
      m.iv = n; I[k]--;
      return { ok: true, msg: name + ' 的天赋重组了：' + ACC.STAT_KEYS.map(function (x) { return BASE_NAME[x] + ' ' + (o ? o[x] + '→' : '') + n[x]; }).join('，') + '。' };
    }
    if (it.kind === 'exp') {
      var g = ACC.gainExp(a, m, m.lv * it.rate);
      if (!g) return no('这只已经满级了，吃不下了。');
      I[k]--;
      return { ok: true, g: g };
    }
    if (it.kind === 'evreset') {
      var back = ACC.evSum(m);
      if (!back) return no('这只还没有分配过学习力。');
      m.evFree = (m.evFree || 0) + back; m.ev = {}; I[k]--;
      return { ok: true, msg: name + ' 已分配的 ' + back + ' 点学习力全部退回，现在有 ' + m.evFree + ' 点可分配学习力，在精灵资料的「学习力」一栏重新分配。' };
    }
    var amt = it.amt || 100, add = Math.min(amt, evRoom(m));
    if (!add) return no('这只的学习力已经到上限了。');
    m.evFree = (m.evFree || 0) + add; I[k]--;
    return { ok: true, msg: name + ' 获得了 ' + add + ' 点可分配学习力' + (add < amt ? '（已到 ' + EV_TOTAL + ' 上限）' : '') + '，在精灵资料的「学习力」一栏分配。' };
  }

  /* ---------- 交易：改精灵数值的操作 ---------- */
  // 从经验背包给精灵喂经验：{ u, amt }
  TX.add('feed', function (a, args, env) {
    var m = monOf(a, args), amt = int(args.amt);
    if (!m) return no('找不到这只精灵');
    if (!(a.exp > 0)) return no('经验背包里没有经验了。');
    if (!(amt > 0)) return no('请输入要分配的经验数量。');
    if (amt > a.exp) return no('经验不足：经验背包里只有 ' + Math.floor(a.exp) + ' 点。');
    var g = ACC.gainExp(a, m, amt, true);
    return { ok: true, g: g };
  });
  // 分配学习力：{ u, k, d }（已分配的不能退回）
  TX.add('ev', function (a, args, env) {
    var m = monOf(a, args), k = String(args.k || ''), d = int(args.d);
    if (!m || ACC.STAT_KEYS.indexOf(k) < 0 || !(d > 0)) return no('分配不了');
    if (!m.ev || typeof m.ev !== 'object') m.ev = {};
    var ev = m.ev[k] || 0, free = m.evFree || 0;
    d = Math.min(d, free, EV_MAX - ev, EV_TOTAL - ACC.evSum(m));
    if (!(d > 0)) return no('没有可以分配的学习力了');
    m.ev[k] = ev + d; m.evFree = free - d;
    return { ok: true, d: d };
  });
  // 用星球特产 / 专属道具提高等级上限：{ u }
  TX.add('lvcap', function (a, args, env) {
    var m = monOf(a, args); if (!m) return no('找不到这只精灵');
    var nx = capNext(m); if (!nx || !(m.lv >= ACC.BASE_CAP)) return no('现在还不能提高等级上限');
    var I = items(a); if ((I[nx.k] || 0) < nx.jade) return no('道具不够：需要 ' + nx.jade + ' 个。');
    if (nx.grail && (I.grail || 0) < nx.grail) return no('还需要 ' + nx.grail + ' 个圣杯。');
    I[nx.k] -= nx.jade; if (nx.grail) I.grail -= nx.grail; m.lvCap = nx.lv;
    return { ok: true, lv: nx.lv };
  });
  // 用精灵道具：{ u, k, nat }
  TX.add('mitem', function (a, args, env) {
    var m = monOf(a, args); if (!m) return no('找不到这只精灵');
    return applyMonItem(a, String(args.k || ''), m, args.nat == null ? null : String(args.nat), env.rand);
  });

  /* ---------- 温泉：在温泉页面里「开始泡温泉」之后，浏览器每 20 秒报一次，服务器按经过的时间给精灵加经验 ----------
   * a.spa.run = { t0 开始时间, last 上次结算, c: { 编号: 不满 1 点的零头 } }。两次结算隔太久（超过 SPA_GAP：电脑睡眠、断网）这一段不算 */
  var SPA_BASE = 2, SPA_GAP = 45000;
  function spaRec(a) { if (!a.spa || !Array.isArray(a.spa.u)) a.spa = { u: [], got: {} }; if (!a.spa.got) a.spa.got = {}; return a.spa; }
  function spaN(a) { return SPA_BASE + Math.min(TX.D.SPA_EXTRA_MAX, (a.spa && a.spa.extra) || 0); }
  function inHome(a, u) { return !!(a.home && Array.isArray(a.home.mons) && a.home.mons.some(function (x) { return (typeof x === 'number' ? x : x && x.u) === u; })); }
  function spaMons(a) { var S = spaRec(a), seen = {}; return S.u.slice(0, spaN(a)).map(function (u) { if (u == null || seen[u] || inHome(a, u)) return null; seen[u] = 1; return ACC.mon(a, u); }).filter(Boolean); }
  function spaRate(a, m, now) { return (120 + m.lv * 24) * 4 * (a.spa && a.spa.juice > now ? 2 : 1); }
  function spaSettle(a, now) {
    var S = spaRec(a), R = S.run, out = { gains: [], total: 0, ms: 0 };
    if (!R) return out;
    var dt = now - R.last; R.last = now;
    if (dt <= 0 || dt > SPA_GAP) return out;
    S.ms = (S.ms || 0) + dt; out.ms = dt;
    if (!R.c) R.c = {};
    spaMons(a).forEach(function (m) {
      if (m.lv >= ACC.capLv(m)) return;
      var c = (R.c[m.u] || 0) + spaRate(a, m, now) * dt / 3600000, n = Math.floor(c); R.c[m.u] = c - n;
      if (n <= 0) return;
      var g = ACC.gainExp(a, m, n); if (!g) return;
      S.got[m.u] = (S.got[m.u] || 0) + g.amt; out.total += g.amt; out.gains.push(g);
    });
    return out;
  }
  // { a: 'start' | 'tick' | 'end' }
  TX.add('spaRun', function (a, args, env) {
    var S = spaRec(a), act = String(args.a || '');
    if (act === 'start') {
      if (!spaMons(a).length) return no('先放一只精灵进温泉吧。');
      S.run = { t0: env.now, last: env.now, c: {} };
      return { ok: true };
    }
    if (!S.run) return act === 'end' ? { ok: true, gains: [], total: 0 } : no('还没开始泡温泉');
    var r = spaSettle(a, env.now); r.ok = true;
    if (act === 'end') delete S.run;
    return r;
  });

  /* ---------- 茶室展示：展示中的精灵按时间涨经验（每只每小时 30 + 等级 × 6，最多算 24 小时），收回时结算 ----------
   * 自律训练装置：装在展示中的精灵身上，每满 1 天自动结算一次，再开始下一天，共 7 天 */
  var HOME_BASE = 3, HOME_CAP_H = 24, AUTO_DAYS = 7, DAY_MS = 24 * 3600 * 1000;
  function homeRec(a) {
    if (!a.home) a.home = { name: '陆羽茶室', mons: [] };
    if (!Array.isArray(a.home.mons)) a.home.mons = [];
    return a.home;
  }
  function homeMax(a) { return HOME_BASE + Math.min(4, (a.home && a.home.cap) || 0); }
  function homeRate(m) { return 30 + m.lv * 6; }
  function homeMins(x, now) { return Math.max(0, Math.min(HOME_CAP_H * 60, Math.floor((now - x.t) / 60000))); }
  /* ---------- 去好友基地偷经验（2026-11-03） ----------
   * 好友基地里训练满 1 小时的精灵（装了自律装置的除外），每人每轮可以偷一次：偷走它现存经验的 10%，进偷的人的经验背包。
   * 被偷走的记在主人那边的 x.st（这一轮一直扣着，经验最多累计 24 小时，所以收获前补不回来），x.sb 是这一轮偷过的人；收获、收回后清零。
   * 一只精灵这一轮最多被偷走一半（按它现在累计的经验算）；每人每天最多偷 30000（a.stealD = { d: 北京日期, n: 今天偷了多少 }）。 */
  var STEAL_PCT = 0.1, STEAL_HALF = 0.5, STEAL_DAY = 30000, STEAL_MIN = 60;
  function homeGross(x, mo, now) { return Math.floor(homeMins(x, now) * homeRate(mo) / 60); }
  function homeNet(x, mo, now) { return Math.max(0, homeGross(x, mo, now) - (x.st | 0)); }
  function stealLeft(a, now) { var S = a && a.stealD; return Math.max(0, STEAL_DAY - (S && S.d === TX.bjDay(now) ? S.n | 0 : 0)); }
  // 现在 thief 能从这只精灵身上偷多少：{ n, why }（n = 0 时 why 说明原因）
  function stealView(x, mo, thief, cap, now) {
    if (!x || !mo || x.auto) return { n: 0, why: 'auto' };
    if (homeMins(x, now) < STEAL_MIN) return { n: 0, why: 'young' };
    if (Array.isArray(x.sb) && x.sb.indexOf(thief) >= 0) return { n: 0, why: 'done' };
    var g = homeGross(x, mo, now), st = x.st | 0, room = Math.floor(g * STEAL_HALF) - st;
    if (room <= 0) return { n: 0, why: 'half' };
    if (!(cap > 0)) return { n: 0, why: 'cap' };
    var n = Math.min(Math.floor((g - st) * STEAL_PCT), room, cap);
    return n > 0 ? { n: n } : { n: 0, why: 'half' };
  }
  var STEAL_WHY = { auto: '这只精灵装着自律训练装置，偷不了', young: '训练满 1 小时才能偷', done: '这一轮你已经偷过它了，等主人收获以后再来吧', half: '这只精灵已经被偷走一半了，手下留情吧', cap: '今天偷的经验已经到 ' + STEAL_DAY + ' 的上限了' };
  // 服务器在主人的存档上调用（server/steal.js）：扣下被偷的经验，返回 { n, sid, lv } 或 { err }
  function stealFrom(oa, u, thief, cap, now) {
    var H = oa && oa.home, x = null;
    if (H && Array.isArray(H.mons)) H.mons.forEach(function (y) { if (y && typeof y === 'object' && y.u === u) x = y; });
    var mo = x && ACC.mon(oa, u); if (!mo) return { err: '这只精灵已经不在基地里了' };
    var r = stealView(x, mo, thief, cap, now); if (!r.n) return { err: STEAL_WHY[r.why] || '偷不了' };
    x.st = (x.st | 0) + r.n; x.sb = (Array.isArray(x.sb) ? x.sb : []).concat([thief]).slice(-100);
    return { n: r.n, sid: mo.sid, lv: mo.lv };
  }
  // 偷的人这边：{ owner, u }；被偷的那边由服务器改（env.fetch('steal')），这里只把经验放进经验背包、记今天偷了多少
  TX.add('homeSteal', function (a, args, env) {
    var cap = stealLeft(a, env.now); if (cap <= 0) return no(STEAL_WHY.cap);
    var r = env.fetch ? env.fetch('steal', { owner: String(args.owner || ''), u: int(args.u), cap: cap }) : null;
    if (!r) return no('要联网登录以后，才能去好友的基地偷经验');
    if (r.err) return no(r.err);
    var n = Math.max(0, Math.min(cap, r.n | 0)), d = TX.bjDay(env.now), S = a.stealD && a.stealD.d === d ? a.stealD : { d: d, n: 0 };
    S.n = (S.n | 0) + n; a.stealD = S; a.exp = (a.exp || 0) + n;
    return { ok: true, n: n, left: STEAL_DAY - S.n };
  });
  // { a: 'in' | 'out' | 'reap' | 'auto' | 'settle', u }
  TX.add('home', function (a, args, env) {
    var H = homeRec(a), act = String(args.a || ''), u = int(args.u);
    H.mons = H.mons.map(function (x) { return typeof x === 'number' ? { u: x, t: env.now } : x; }).filter(function (x) { return x && ACC.mon(a, x.u); });
    var i = -1; H.mons.forEach(function (x, k) { if (x.u === u) i = k; });
    if (act === 'in') {
      var m = ACC.mon(a, u); if (!m) return no('找不到这只精灵');
      if (i >= 0) return no('它已经在茶室里了');
      if (H.mons.length >= homeMax(a)) return no('茶室已经满了');
      if (a.spa && Array.isArray(a.spa.u) && a.spa.u.indexOf(u) >= 0) return no('它正在泡温泉，先从温泉里带出来吧。');
      H.mons.push({ u: u, t: env.now });
      return { ok: true };
    }
    if (act === 'out') {
      if (i < 0) return no('它不在茶室里');
      var x = H.mons[i], mo = ACC.mon(a, x.u), min = homeMins(x, env.now), amt = homeNet(x, mo, env.now);
      H.mons.splice(i, 1);
      var dh = min >= 60 && typeof QST !== 'undefined' ? QST.hit(a, 'home', 1, env.now) : [];   // 每日任务（js/engine/quest.js）
      return { ok: true, min: min, g: amt > 0 ? ACC.gainExp(a, mo, amt) : null, daily: dh };
    }
    if (act === 'reap') {   // 2026-11-03：训练满 1 小时就能点气泡收获经验，精灵留在原地重新开始计时（经验照旧最多算 24 小时）
      if (i < 0) return no('它不在茶室里');
      var rx = H.mons[i], rm = ACC.mon(a, rx.u), rmin = homeMins(rx, env.now);
      if (rx.auto) return no('它装着自律训练装置，每满 1 天会自动结算');
      if (rmin < 60) return no('训练满 1 小时才能收获');
      var ramt = homeNet(rx, rm, env.now);
      rx.t = env.now; delete rx.st; delete rx.sb;   // 被偷的记录跟着清掉，下一轮重新算
      var rdh = typeof QST !== 'undefined' ? QST.hit(a, 'home', 1, env.now) : [];
      return { ok: true, min: rmin, g: ACC.gainExp(a, rm, ramt), daily: rdh };
    }
    if (act === 'auto') {
      if (i < 0) return no('它不在茶室里');
      var hx = H.mons[i]; if (hx.auto) return no('已经装上了');
      var I = items(a); if (!(I.auto > 0)) return no('没有自律训练装置了');
      I.auto--; hx.auto = { left: AUTO_DAYS, got: 0 };
      return { ok: true };
    }
    if (act === 'settle') {   // 自律训练装置：每满 1 天结算一次
      var out = [];
      H.mons.forEach(function (x) {
        if (!x.auto || !(x.auto.left > 0)) return;
        var m2 = ACC.mon(a, x.u), days = 0, got = 0, last = null;
        while (x.auto.left > 0 && env.now - x.t >= DAY_MS) {
          var amt2 = homeRate(m2) * HOME_CAP_H, g = ACC.gainExp(a, m2, amt2);
          if (g) last = g;
          got += amt2; x.t += DAY_MS; x.auto.left--; days++;
        }
        if (!days) return;
        x.auto.got = (x.auto.got || 0) + got;
        var left = x.auto.left; if (x.auto.left <= 0) delete x.auto;
        out.push({ u: x.u, days: days, got: got, left: left, g: last });
      });
      var dh2 = []; if (typeof QST !== 'undefined') out.forEach(function () { dh2 = dh2.concat(QST.hit(a, 'home', 1, env.now)); });
      return { ok: true, list: out, daily: dh2 };
    }
    return no('不支持的操作');
  });

  /* ---------- 放生（2026-11-01）：经验只看等级，放生点数只看稀有度 ----------
   * 稀有度按获得途径定：野外常见 / 少见（包括只在某个场景出现的）= 常见（2026-11-01 普通、少见合并）；野外标了 rare、奇声号角、神秘精灵 = 稀有；精元孵化（奥多亚克除外）、冰块里的亚哆 = 珍贵
   * 拿不到第二只的精灵（剧情 / 奖励送的）不能放生；开局选的主宠（那个种类里最早获得的一只）不能放生；在配队里的要先移出配队 */
  var REL_TIER = [{ n: '常见', pt: 2 }, { n: '稀有', pt: 10 }, { n: '珍贵', pt: 30 }], REL_SHINY = 3, REL_MAX = 60;
  function relTier(sid) {
    if (sid === 'wild') return 2;
    if (sid === 'odo') return -1;   // 2026-11-01：奥多亚克只能获得一只，不能放生
    for (var hk in HATCH) if (HATCH[hk].sid === sid && HATCH[hk].sum !== 'rare') return 2;
    var t = -1, pools = typeof WILD_POOLS !== 'undefined' ? WILD_POOLS : {}, scene = typeof WILD_SCENE !== 'undefined' ? WILD_SCENE : {};
    Object.keys(pools).forEach(function (k) { pools[k].forEach(function (w) { if (w.sid === sid) t = Math.max(t, w.rare ? 1 : 0); }); });
    Object.keys(scene).forEach(function (k) { scene[k].forEach(function (w) { if (w.sid === sid) t = Math.max(t, 0); }); });
    if (typeof PVE !== 'undefined' && ((PVE.HORN && PVE.HORN.sid === sid) || (PVE.MYSTERY && PVE.MYSTERY.sid === sid))) t = Math.max(t, 1);
    return t;   // -1：只能拥有一只
  }
  function relExp(lv) { return Math.max(20, Math.floor(ACC.expAt(lv) * 0.1)); }
  function relPt(m) { var t = relTier(m.sid); return t < 0 ? 0 : REL_TIER[t].pt * (m.shiny ? REL_SHINY : 1); }
  function starterU(a) { var u = null; (a.mons || []).forEach(function (m) { if (m.sid === a.starter && (u == null || m.u < u)) u = m.u; }); return u; }
  function relBlock(a, m) {   // 不能放生的原因；能放生返回 ''
    if (!m || !SPMAP[m.sid] || SPMAP[m.sid].nodex || m.sid === 'dummy') return '不能放生';
    if (m.u === starterU(a)) return '主宠';
    if (relTier(m.sid) < 0) return '只能拥有一只';
    if ((a.teams || []).some(function (t) { return t && t.indexOf(m.u) >= 0; })) return '在配队里';
    return '';
  }
  // { us: [编号, ...] }
  TX.add('release', function (a, args, env) {
    var us = Array.isArray(args.us) ? args.us.map(int).filter(function (u, i, L) { return L.indexOf(u) === i; }) : [];
    if (!us.length) return no('还没有选要放生的精灵');
    if (us.length > REL_MAX) return no('一次最多放生 ' + REL_MAX + ' 只');
    var ms = us.map(function (u) { return ACC.mon(a, u); });
    for (var i = 0; i < ms.length; i++) { if (!ms[i]) return no('找不到这只精灵'); var why = relBlock(a, ms[i]); if (why) return no('有精灵不能放生（' + why + '）'); }
    var exp = 0, pt = 0;
    ms.forEach(function (m) { exp += relExp(m.lv); pt += relPt(m); });
    a.mons = a.mons.filter(function (m) { return us.indexOf(m.u) < 0; });
    if (a.home && Array.isArray(a.home.mons)) a.home.mons = a.home.mons.filter(function (x) { return us.indexOf(typeof x === 'number' ? x : x && x.u) < 0; });
    if (a.spa && Array.isArray(a.spa.u)) a.spa.u = a.spa.u.map(function (u) { return us.indexOf(u) >= 0 ? null : u; });
    a.exp = (a.exp || 0) + exp; var I = items(a); I.relPt = (I.relPt || 0) + pt;
    return { ok: true, n: ms.length, exp: exp, pt: pt };
  });

  /* ---------- 精灵保育仓：精元放进孵化槽，过一段时间孵化出精灵 ---------- */
  var NURSERY_N = 3;
  var HATCH = { e_odo: { sid: 'odo', lv: 1, min: 480 }, e_leafcat: { sid: 'leafcat', lv: 1, min: 480 }, e_pluto: { sid: 'pluto', lv: 1, min: 720 }, e_leiming: { sid: 'leiming', lv: 1, min: 480, shiny: 0.1 } };   // shiny：孵出异色的概率
  // 2026-11-01 圣晶石召唤：当期 UP 精灵的精元（sum: 'up'，算珍贵）和稀有精灵的精元（sum: 'rare'，不改变这些精灵的稀有度）。召唤池按这份名单，新出的稀有精灵不会自动加进来
  HATCH.e_phantom = { sid: 'phantom', lv: 1, min: 480, sum: 'up' };
  ['kaleo', 'leaf', 'squid', 'shroom', 'turkey', 'siren', 'hauris'].forEach(function (s) { HATCH['e_' + s] = { sid: s, lv: 1, min: 480, sum: 'rare' }; });
  function nurseryRec(a) { if (!a.nursery || !Array.isArray(a.nursery.slots)) a.nursery = { slots: [] }; while (a.nursery.slots.length < NURSERY_N) a.nursery.slots.push(null); return a.nursery; }
  // { a: 'put', i, k } / { a: 'hatch', i }
  TX.add('hatch', function (a, args, env) {
    var N = nurseryRec(a), i = int(args.i), act = String(args.a || '');
    if (!(i >= 0 && i < NURSERY_N)) return no('没有这个孵化槽');
    if (act === 'put') {
      var k = String(args.k || ''), I = items(a);
      if (N.slots[i]) return no('这个孵化槽里已经有精元了');
      if (!HATCH[k] || !(I[k] > 0)) return no('没有这种精元了');
      I[k]--; N.slots[i] = { k: k, t: env.now };
      return { ok: true };
    }
    if (act === 'hatch') {
      var x = N.slots[i], H = x && HATCH[x.k]; if (!H) return no('孵化槽是空的');
      if (env.now - x.t < H.min * 60000) return no('还没到孵化的时候');
      var sh = H.shiny && env.rand() < H.shiny ? 1 : 0;
      var gm = ACC.giveMon(a, H.sid, H.lv, env, sh); N.slots[i] = null;
      return { ok: true, u: gm.m.u, added: gm.added, shiny: !!sh };
    }
    return no('不支持的操作');
  });

  /* ---------- 送精灵：剧情、邮件、排位奖励、炙热核心的火月鼠 ----------
   * 每份只送一次，记在 a.giftGot。{ k: 'story' | 'mail' | 'rank' | 'fm', id } */
  var STORY_GIFT = { mingming: [{ sid: 'aegis', lv: 10 }] };
  var RANK_GIFT = { 4: [{ sid: 'moon', lv: 10 }], 10: [{ sid: 'bone', lv: 10 }] };
  var FM = { need: 3, lv: 18 };
  function rankBest(data) { try { var R = JSON.parse((data && data['hs-rank-v1']) || 'null'); return R ? Math.max(R.best || 0, R.r || 0) : 0; } catch (e) { return 0; } }
  // 神秘精灵兑换券（第一届做题大王争霸赛）：1 张换一只 LV10 的尖盔虫 + 200 个花剑圆弧（2026-11-02）
  var CT_REDEEM = { sid: 'tiago', lv: 10, items: { fencArc: 200 } };
  // S1争霸赛精灵分享券（2026-11-02）：送一只 LV10 尖盔虫 + 200 花剑圆弧给一位好友（服务器记下，对方下次同步邮箱时收到邮件）
  TX.add('ctShare', function (a, args, env) {
    if (!a.items || !(a.items.ctShare >= 1)) return no('没有精灵分享券');
    var r = env.fetch ? env.fetch('ctShare', String(args.to || '')) : null;
    if (!r || !r.ok) return no((r && r.err) || '要联网登录后才能分享');
    a.items.ctShare--; if (!a.items.ctShare) delete a.items.ctShare;
    return { ok: true, to: r.to, name: r.name };
  });
  TX.add('ctRedeem', function (a, args, env) {
    if (!a.items || !(a.items.ctTicket >= 1)) return no('没有神秘精灵兑换券');
    a.items.ctTicket--; if (!a.items.ctTicket) delete a.items.ctTicket;
    var gm = ACC.giveMon(a, CT_REDEEM.sid, CT_REDEEM.lv, env); ACC.seeMon(a, CT_REDEEM.sid, CT_REDEEM.lv); ACC.addItems(a, CT_REDEEM.items);
    return { ok: true, u: gm.m.u, added: gm.added };
  });
  TX.add('gift', function (a, args, env) {
    var k = String(args.k || ''), id = String(args.id || ''), key = k + ':' + id, list = null, extra = {};
    if (!a.giftGot) a.giftGot = {};
    if (a.giftGot[key]) return no('已经领过了');
    if (k === 'story') { if (!ACC.done(a, id)) return no('还没读完这段剧情'); list = STORY_GIFT[id]; }
    else if (k === 'mail') {
      var M0 = (typeof MAILS !== 'undefined' ? MAILS : []).filter(function (x) { return x.id === id; })[0];
      if (M0) { if (M0.to && M0.to.indexOf(a.name) < 0 && M0.to.indexOf(env.user) < 0) return no('这封邮件不是给你的'); list = M0.att && M0.att.mons; }   // to 里写登录账号名或做题家名字都行
      else if (/^ctshare-/.test(id)) { if (!(a.mail || []).some(function (y) { return y && y.id === id; })) return no('没有这封邮件'); list = [{ sid: 'tiago', lv: 10 }]; }   // 好友用「S1争霸赛精灵分享券」送来的尖盔虫（2026-11-02）
      else if (/-king-gift$/.test(id)) { if (rankBest(env.data) < 10) return no('还没达到王者段位'); list = RANK_GIFT[10]; }
    }
    else if (k === 'rank') { var r = int(+id.split(':').pop()); if (!(rankBest(env.data) >= r)) return no('还没达到这个段位'); list = RANK_GIFT[r]; }
    else if (k === 'fm') {
      if (a.fmNpc) return no('火月鼠已经跟你走了');
      var fire = ACC.team(a).filter(function (m) { return SPMAP[m.sid] && SPMAP[m.sid].types.indexOf('火') >= 0; }).length;
      if (fire < FM.need) return no('配队里还要带 ' + FM.need + ' 只火系精灵');
      list = [{ sid: 'firemouse', lv: FM.lv }]; a.fmNpc = 1; extra.fm = true;
    }
    if (!list || !list.length) return no('没有可以领的精灵');
    a.giftGot[key] = env.now;
    var got = list.filter(function (g) { return SPMAP[g.sid]; }).map(function (g) { var gm = ACC.giveMon(a, g.sid, g.lv, env, g.shiny); ACC.seeMon(a, g.sid, g.lv); return { u: gm.m.u, added: gm.added }; });
    return { ok: true, mons: got };
  });

  /* ---------- 冶炼坊：合成、特产互换（2026-10-25 起走交易） ---------- */
  var FORGE = [
    { id: 'cap2', out: { cap2: 1 }, need: { g_sand: 50 } },   // 2026-10-25：星砂 2 → 50
    { id: 'cap3', out: { cap3: 1 }, need: { g_core: 10 } },   // 2026-10-25：圣晶石 4 → 10
    { id: 'pot100', out: { pot100: 1 }, need: { c_herb: 1 } },   // 2026-10-25：hp药水分 100、200 两种
    { id: 'pot200', out: { pot200: 1 }, need: { c_herb: 2 } },
    { id: 'pp10', out: { pp10: 1 }, need: { c_flower: 3 } },   // PP 药水：只合成 10PP、20PP（大的更划算）
    { id: 'pp20', out: { pp20: 1 }, need: { c_flower: 5 } },
    { id: 'antidote', out: { antidote: 1 }, need: { m_psac: 1, c_herb: 5 } },   // 2026-10-27：解毒药剂
    { id: 'bowl', out: { c_bowl: 1 }, need: { c_rice: 500 } },
    { id: 'lcEssence', out: { e_leafcat: 1 }, need: { m_lcleaf: 5 } },
    { id: 'formDev', out: { formDev: 1 }, need: { g_core: 6, g_sand: 300 } },
    { id: 'horn', out: { m_horn: 1 }, need: { m_hfhorn: 60 } }
  ];
  var FORGE_Q = 120;
  // 特产互换：每 GX_IN 个换 GX_OUT 个；马亚尔晶体只能换出去，每 10 个换 10 个
  var GX_KEYS = ['floraJade', 'kbDrop', 'ppAsh', 'ltOrb', 'whFrost'], GX_IN = 10, GX_OUT = 8;
  var GX_SRC = ['m_mcry'].concat(GX_KEYS);
  function gxOut(k) { return k === 'm_mcry' ? 10 : GX_OUT; }
  // { id, n }
  TX.add('forge', function (a, args, env) {
    var r = FORGE.filter(function (x) { return x.id === args.id; })[0], n = int(args.n), I = items(a);
    if (!r) return no('没有这个配方');
    if (!(n >= 1 && n <= FORGE_Q)) return no('数量不对');
    for (var k in r.need) if ((I[k] || 0) < r.need[k] * n) return no('材料不够');
    for (var k2 in r.need) I[k2] -= r.need[k2] * n;
    var gain = {}; for (var o in r.out) { gain[o] = r.out[o] * n; I[o] = (I[o] || 0) + gain[o]; }
    return { ok: true, gain: gain };
  });
  // { from, to, n }
  TX.add('gx', function (a, args, env) {
    var f = String(args.from || ''), t = String(args.to || ''), n = int(args.n), I = items(a);
    if (GX_SRC.indexOf(f) < 0 || GX_KEYS.indexOf(t) < 0 || f === t) return no('换不了');
    if (!(n >= 1 && n <= FORGE_Q) || (I[f] || 0) < GX_IN * n) return no('数量不够');
    I[f] -= GX_IN * n; I[t] = (I[t] || 0) + gxOut(f) * n;
    return { ok: true, out: gxOut(f) * n };
  });

  /* ---------- 太空种植园：种下种子，到时间收获 ----------
   * 药草、活力花卉收获时有 20% 的概率掉 1 颗种子（back），水稻种子一定退回。种子在生态舱的种子商店用能量买（seedShop），
   * 商店还卖额外的种植栏位：基础 4 块田，最多再加 4 块（a.farm.extra） */
  var FARM_N = 4, FARM_EXTRA_MAX = 4, PLOT_PRICE = [2000, 4000, 8000, 16000], SEED_PRICE = 100, SEED_SHOP = ['s_herb', 's_flower'], SEED_SHOP_MAX = 99;
  var SEEDS = {
    s_herb: { name: '药草种子', d: '绿色的药草籽，在恩施 · 生态舱的种子商店出售。种下去要 8 小时，收获药草；收获时有 20% 的概率掉落 1 颗药草种子。', crop: 'c_herb', min: 480, yield: 50, back: 0.2 },
    s_flower: { name: '活力花种子', d: '蓝色的花籽，在恩施 · 生态舱的种子商店出售。种下去要 8 小时，收获活力花卉；收获时有 20% 的概率掉落 1 颗活力花种子。', crop: 'c_flower', min: 480, yield: 50, back: 0.2 },
    s_rice: { name: '水稻种子', d: '在芙罗拉星击败野生精灵时偶尔掉落的稻种。种下去要 12 小时，收获一大把米饭，种子会退回来。', crop: 'c_rice', min: 720, yield: 250, back: 1 }
  };
  function farmN(a) { return FARM_N + Math.max(0, Math.min(FARM_EXTRA_MAX, (a && a.farm && a.farm.extra) | 0)); }
  function farmRec(a) { if (!a.farm || !Array.isArray(a.farm.plots)) a.farm = { plots: [], extra: (a.farm && a.farm.extra) | 0 }; var n = farmN(a); while (a.farm.plots.length < n) a.farm.plots.push(null); return a.farm; }
  // { a: 'plant', i, seed } / { a: 'harvest', i }
  TX.add('farm', function (a, args, env) {
    var F = farmRec(a), i = int(args.i), I = items(a);
    if (!(i >= 0 && i < farmN(a))) return no('没有这块田');
    if (args.a === 'plant') {
      var sd = String(args.seed || '');
      if (F.plots[i]) return no('这块田已经种上了');
      if (!SEEDS[sd] || !(I[sd] > 0)) return no('没有这种种子了');
      I[sd]--; F.plots[i] = { seed: sd, t: env.now };
      return { ok: true };
    }
    if (args.a === 'harvest') {
      var p = F.plots[i], S = p && SEEDS[p.seed]; if (!S) return no('这块田是空的');
      if (env.now - p.t < S.min * 60000) return no('还没成熟');
      var back = S.back >= 1 || env.rand() < S.back ? 1 : 0;
      I[S.crop] = (I[S.crop] || 0) + S.yield; if (back) I[p.seed] = (I[p.seed] || 0) + back; F.plots[i] = null;
      return { ok: true, crop: S.crop, n: S.yield, seed: p.seed, back: back };
    }
    return no('不支持的操作');
  });
  // 种子商店：{ k: 种子, n } 买种子；{ k: 'plot' } 买一块额外的田
  TX.add('seedShop', function (a, args) {
    var F = farmRec(a), I = items(a);
    if (args.k === 'plot') {
      var e = (F.extra | 0), price = PLOT_PRICE[e];
      if (!(e < FARM_EXTRA_MAX) || !price) return no('田已经扩到最多了');
      if ((a.energy || 0) < price) return no('能量不足');
      a.energy -= price; F.extra = e + 1; farmRec(a);
      return { ok: true, k: 'plot', cost: price, n: farmN(a) };
    }
    var k = String(args.k || ''), n = int(args.n);
    if (SEED_SHOP.indexOf(k) < 0) return no('没有这种种子');
    if (!(n >= 1 && n <= SEED_SHOP_MAX)) return no('数量不对');
    var cost = SEED_PRICE * n; if ((a.energy || 0) < cost) return no('能量不足');
    a.energy -= cost; I[k] = (I[k] || 0) + n;
    return { ok: true, k: k, n: n, cost: cost };
  });

  /* ---------- 助战回报：好友借用了你名片上的助战精灵，每次 1000 能量 + 1000 累积经验（借用次数由服务器记） ---------- */
  var HELP_RW = { energy: 1000, exp: 1000 };
  TX.add('help', function (a, args, env) {
    var uses = (env.fetch && env.fetch('help')) || [], n = 0;
    uses.forEach(function (x) { n += Math.max(0, x.n | 0); });
    if (!n) return { ok: true, uses: [], n: 0 };
    a.energy = (a.energy || 0) + HELP_RW.energy * n; a.exp = (a.exp || 0) + HELP_RW.exp * n;
    return { ok: true, uses: uses, n: n };
  });

  /* ---------- 精灵大乱斗的奖励：胜者 2000、败者 1000 累积经验（平局各 1000；自己认输或掉线没有），每天最多 20000 ----------
   * 对战结果由服务器裁判记下（server/pvp.js），{ id: 对局编号 } */
  var BRAWL_WIN = 2000, BRAWL_LOSE = 1000, BRAWL_CAP = 20000;
  TX.add('brawlRw', function (a, args, env) {
    var rec = env.fetch && env.fetch('brawl', String(args.id || ''));
    if (!rec) return no('没有找到这场大乱斗的结果');
    if (!a.stats) a.stats = {};
    var d = TX.bjDay(env.now), had = a.brawlExp && a.brawlExp.d === d ? a.brawlExp.n || 0 : 0;
    var want = rec.none ? 0 : rec.r === 'win' ? BRAWL_WIN : BRAWL_LOSE, give = Math.max(0, Math.min(want, BRAWL_CAP - had));
    var dh = [];
    if (!rec.none) { a.stats.brawls = (a.stats.brawls || 0) + 1; if (typeof QST !== 'undefined') { dh = QST.hit(a, 'brawl', 1, env.now); if (rec.r === 'win') dh = dh.concat(QST.hit(a, 'brawlWin', 1, env.now)); } }
    if (give > 0) { a.brawlExp = { d: d, n: had + give }; a.exp = (a.exp || 0) + give; }
    return { ok: true, want: want, give: give, today: had + give, cap: BRAWL_CAP, none: !!rec.none, r: rec.r, daily: dh };
  });

  return { REL_TIER: REL_TIER, REL_SHINY: REL_SHINY, REL_MAX: REL_MAX, relTier: relTier, relExp: relExp, relPt: relPt, relBlock: relBlock, starterU: starterU, FORGE: FORGE, FORGE_Q: FORGE_Q, GX_KEYS: GX_KEYS, GX_IN: GX_IN, GX_OUT: GX_OUT, GX_SRC: GX_SRC, gxOut: gxOut, FARM_N: FARM_N, FARM_EXTRA_MAX: FARM_EXTRA_MAX, PLOT_PRICE: PLOT_PRICE, SEED_PRICE: SEED_PRICE, SEED_SHOP: SEED_SHOP, SEED_SHOP_MAX: SEED_SHOP_MAX, farmN: farmN, SEEDS: SEEDS, HELP_RW: HELP_RW, BRAWL_WIN: BRAWL_WIN, BRAWL_LOSE: BRAWL_LOSE, BRAWL_CAP: BRAWL_CAP, SPA_GAP: SPA_GAP, spaMons: spaMons, HOME_CAP_H: HOME_CAP_H, STEAL_DAY: STEAL_DAY, homeNet: homeNet, stealLeft: stealLeft, stealView: stealView, stealFrom: stealFrom, AUTO_DAYS: AUTO_DAYS, DAY_MS: DAY_MS, HATCH: HATCH, STORY_GIFT: STORY_GIFT, RANK_GIFT: RANK_GIFT, USE_ITEMS: USE_ITEMS, CAP_STEPS: CAP_STEPS, GEM_OF: GEM_OF, CAP_SID: CAP_SID, capGem: capGem, capNext: capNext, formLabel: formLabel, natText: natText,
    itemFits: itemFits, jadeMoves: jadeMoves, formOpts: formOpts, evRoom: evRoom, applyMonItem: applyMonItem };
})();
if (typeof module !== 'undefined') module.exports = GROW;
