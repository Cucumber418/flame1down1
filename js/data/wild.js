/* ==========================================================
 * 各星球的野外精灵
 * WILD_POOLS[区域] = 可遇到的精灵（lv 等级范围，w 出现权重，rate 捕捉率）；WILD_REGIONS 区域列表（planet 是所在星球）
 * ========================================================== */

var WILD_POOLS = {
  forest: [
    { sid: 'mush', lv: [1, 5], w: 64.25, rate: 0.65, tag: '较高', shiny: 0.05, shiny2: 0.005 },   // 5% 蓝色异色，0.5% 黄色异色
    { sid: 'wind', lv: [1, 3], w: 35, rate: 0.85, tag: '极高' },
    { sid: 'kaleo', lv: [5, 5], w: 0.5, rate: 0.45, tag: '中等', rare: true },
    { sid: 'leaf', lv: [5, 5], w: 0.25, rate: 0.45, tag: '中等', rare: true }   // 三主宠：各在对应属性的星球 0.25% 出现（野外场景里一次能看到好几只精灵，稀有精灵的概率调得很低）
  ],
  grass: [
    { sid: 'wind', lv: [1, 3], w: 64.75, rate: 0.85, tag: '极高' },
    { sid: 'mush', lv: [1, 5], w: 35, rate: 0.65, tag: '较高', shiny: 0.05, shiny2: 0.005 },
    { sid: 'leaf', lv: [5, 5], w: 0.25, rate: 0.45, tag: '中等', rare: true }
  ],
  // 坎伯兰星（水系）：水面 → 浅水区 → 深海区，越往下越强
  kb_surf: [
    { sid: 'gorgon', lv: [6, 10], w: 59.75, rate: 0.65, tag: '较高' },
    { sid: 'pede', lv: [6, 10], w: 40, rate: 0.7, tag: '较高' },
    { sid: 'squid', lv: [10, 10], w: 0.25, rate: 0.45, tag: '中等', rare: true }
  ],
  kb_sea: [
    { sid: 'pede', lv: [8, 12], w: 59.25, rate: 0.7, tag: '较高' },
    { sid: 'gorgon', lv: [8, 12], w: 40.5, rate: 0.65, tag: '较高' },
    // 塞壬（塞米）不会自然出现：在冥岛吹响「奇声号角」才会来（见 game.js 的 HORN）
    { sid: 'squid', lv: [10, 10], w: 0.25, rate: 0.45, tag: '中等', rare: true }
  ],
  kb_deep: [
    { sid: 'pede', lv: [12, 16], w: 50, rate: 0.65, tag: '较高' },
    { sid: 'gorgon', lv: [12, 16], w: 50, rate: 0.6, tag: '较高' }
  ],
  // 庞贝星（火系）
  pp_lava: [
    { sid: 'hephaestus', lv: [8, 14], w: 99.75, rate: 0.6, tag: '较高' },
    { sid: 'turkey', lv: [12, 12], w: 0, rate: 0.45, tag: '中等', rare: true, bait: 'rice' },   // 米饭火鸡：平时不出现；在熔岩原的某个场景放一碗饭后，那个场景每次刷新精灵有 2% 是它（见 game.js 的 RICE）
    { sid: 'shroom', lv: [12, 12], w: 0.25, rate: 0.45, tag: '中等', rare: true }
  ],
  pp_city: [   // 饮火城：没有米饭火鸡
    { sid: 'hephaestus', lv: [10, 16], w: 99.75, rate: 0.6, tag: '较高' },
    { sid: 'shroom', lv: [12, 12], w: 0.25, rate: 0.45, tag: '中等', rare: true }
  ],
  // 莱汀陨石带（电系）
  lt_belt: [
    { sid: 'leigong', lv: [10, 15], w: 55, rate: 0.6, tag: '较高', shiny: 0.03 },   // 3% 是异色（红色）
    { sid: 'faraday', lv: [10, 15], w: 45, rate: 0.55, tag: '中等' }
  ],
  // 白之星（冰系）
  wh_snow: [
    { sid: 'frost', lv: [12, 18], w: 99.5, rate: 0.55, tag: '中等' },
    { sid: 'wild', lv: [20, 20], w: 0.5, rate: 0.35, tag: '较低', rare: true }
  ]
};
// 只在某个场景出现的精灵（按背景键）：和所在区域的野外表合在一起抽。w 按区域表总权重 100 来算，11.1 ≈ 这个场景里 10%
WILD_POOLS.fl_record = WILD_POOLS.forest.concat(WILD_POOLS.grass).filter(function (w) { return !w.rare; });
var WILD_SCENE = {
  pp_core: [{ sid: 'firemouse', lv: [14, 18], w: 11.1, rate: 0.5, tag: '中等', shiny: 0.03 }]   // 火月鼠：只在饮火城 · 炙热核心
};
var WILD_REGIONS = [
  { id: 'forest', planet: 'flora', name: '丛林', en: 'Forest', d: '高大的树木遮住了天空，林下潮湿又安静。玛西很常见，偶尔能撞见稀有的卡莱。', pool: 'forest', bgs: ['fl_path', 'fl_beech', 'fl_sun', 'fl_maple'] },
  { id: 'grass', planet: 'flora', name: '草甸', en: 'Grassland', d: '一望无际的草甸，风吹过时像绿色的海浪。卡罗成群地在这里奔跑。', pool: 'grass', bgs: ['fl_meadow', 'fl_lake', 'fl_horizon'] },
  // 2026-10-24：芙罗拉星恢复以后，用来做「瘴气驱逐战」的地方：两张瘴气化的地图（草甸、丛林），里面依然是瘴气精灵
  { id: 'fl_record', planet: 'flora', name: '瘴气污染的记录', en: 'Miasma Record', record: true, d: '芙罗拉星被瘴气污染时的记录。草甸和丛林依旧缠满深紫色的脉络，里面的瘴气精灵可以继续用来进行瘴气驱逐战。', pool: 'fl_record', bgs: ['fl_meadow_mia', 'fl_beech_mia'] },
  { id: 'salt', planet: 'flora', name: '盐碱地', en: 'Saline-alkali Land', d: '寸草不生的白色荒原，四处飘着灰紫色的瘴气。着陆舱就是在这里迫降的。瘴气的源头——草系BOSS「荒芜」就潜伏在地底。这里没有野生精灵。', boss: '荒芜', bgs: ['fl_salt'] }
,
  { id: 'kb_surf', planet: 'kamble', name: '水面', en: 'Surface', d: '码头的灯照着翻涌的海浪，远处的冥岛不时喷出高高的水柱。这里的精灵最温和。传说在冥岛吹响号角，会引来唱歌的小精灵。', pool: 'kb_surf', bgs: ['kb_dock', 'kb_isle'] },
  { id: 'kb_sea', planet: 'kamble', name: '浅水区', en: 'Shallows', d: '阳光还能照进来的一层海水，抬头就能看见水面，鱼群成片游过。', pool: 'kb_sea', bgs: ['kb_lookup', 'kb_shoal'] },
  { id: 'kb_deep', planet: 'kamble', name: '深海区', en: 'Deep Sea', d: '光几乎照不到的深处，幽深的沙丘间沉睡着一座古代神殿，还有一条不知道谁留下的发光管道。这里的精灵更强。', pool: 'kb_deep', bgs: ['kb_floor', 'kb_temple', 'kb_abyss'] },
  { id: 'pp_lava', planet: 'pompeii', name: '熔岩原', en: 'Lava Field', d: '熔浆汇成的大湖一眼望不到边，湖岸上是堆满熔渣的旧矿区。赫菲喜欢在热气里打盹。', pool: 'pp_lava', bgs: ['pp_lake', 'pp_slag'] },
  { id: 'pp_city', planet: 'pompeii', name: '饮火城', en: 'Firedrink City', d: '熔岩湖中央矗立着一座古老的堡垒，再往里走就是星球炙热的核心。赫菲在这里长得更壮实。', pool: 'pp_city', bgs: ['pp_fort', 'pp_core'] },
  { id: 'lt_belt', planet: 'laiting', name: '雷暴陨石群', en: 'Storm Belt', d: '大大小小的陨石在电弧里漂浮，到处噼啪作响。锰怪和雷元素在石头之间穿梭。', pool: 'lt_belt' },
  { id: 'wh_snow', planet: 'white', name: '永冻冰原', en: 'Permafrost', d: '一望无际的白色冰原，风里夹着冰晶。铸冰者在冰面下游荡，传说还有一只很少露面的亚当。', pool: 'wh_snow' }
];
