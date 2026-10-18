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
  // 坎伯兰星（水系）
  kb_sea: [
    { sid: 'pede', lv: [6, 10], w: 59.25, rate: 0.7, tag: '较高' },
    { sid: 'gorgon', lv: [6, 10], w: 40, rate: 0.65, tag: '较高' },
    { sid: 'siren', lv: [12, 12], w: 0.5, rate: 0.4, tag: '中等', rare: true },
    { sid: 'squid', lv: [10, 10], w: 0.25, rate: 0.45, tag: '中等', rare: true }
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
var WILD_SCENE = {
  pp_core: [{ sid: 'firemouse', lv: [14, 18], w: 11.1, rate: 0.5, tag: '中等' }]   // 火月鼠：只在饮火城 · 炙热核心
};
var WILD_REGIONS = [
  { id: 'forest', planet: 'flora', name: '丛林', en: 'Forest', d: '高大的树木遮住了天空，林下潮湿又安静。玛西很常见，偶尔能撞见稀有的卡莱。', pool: 'forest', bgs: ['fl_path', 'fl_beech', 'fl_sun', 'fl_maple'] },
  { id: 'grass', planet: 'flora', name: '草甸', en: 'Grassland', d: '一望无际的草甸，风吹过时像绿色的海浪。卡罗成群地在这里奔跑。', pool: 'grass', bgs: ['fl_meadow', 'fl_lake', 'fl_horizon'] },
  { id: 'salt', planet: 'flora', name: '盐碱地', en: 'Saline-alkali Land', d: '寸草不生的白色荒原，四处飘着灰紫色的瘴气。着陆舱就是在这里迫降的。瘴气的源头——草系首领「荒芜」就潜伏在地底。这里没有野生精灵。', boss: '荒芜', bgs: ['fl_salt'] }
,
  { id: 'kb_sea', planet: 'kamble', name: '环礁浅海', en: 'Atoll Shallows', d: '温暖的浅海和一圈圈环礁，海水清得能看见底。佩恩和水球常在这里出没，偶尔能听见塞米的歌声。', pool: 'kb_sea' },
  { id: 'pp_lava', planet: 'pompeii', name: '熔岩原', en: 'Lava Field', d: '熔浆汇成的大湖一眼望不到边，湖岸上是堆满熔渣的旧矿区。赫菲斯喜欢在热气里打盹。', pool: 'pp_lava', bgs: ['pp_lake', 'pp_slag'] },
  { id: 'pp_city', planet: 'pompeii', name: '饮火城', en: 'Firedrink City', d: '熔岩湖中央矗立着一座古老的堡垒，再往里走就是星球炙热的核心。赫菲斯在这里长得更壮实。', pool: 'pp_city', bgs: ['pp_fort', 'pp_core'] },
  { id: 'lt_belt', planet: 'laiting', name: '雷暴陨石群', en: 'Storm Belt', d: '大大小小的陨石在电弧里漂浮，到处噼啪作响。锰怪和雷天使在石头之间穿梭。', pool: 'lt_belt' },
  { id: 'wh_snow', planet: 'white', name: '永冻冰原', en: 'Permafrost', d: '一望无际的白色冰原，风里夹着冰晶。铸冰者在冰面下游荡，传说还有一只很少露面的亚当。', pool: 'wh_snow' }
];
