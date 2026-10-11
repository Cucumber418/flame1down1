/* ==========================================================
 * 各星球的野外精灵
 * WILD_POOLS[区域] = 可遇到的精灵（lv 等级范围，w 出现权重，rate 捕捉率）；WILD_REGIONS 区域列表（planet 是所在星球）
 * ========================================================== */

var WILD_POOLS = {
  forest: [
    { sid: 'mush', lv: [1, 5], w: 60, rate: 0.65, tag: '较高' },
    { sid: 'wind', lv: [1, 3], w: 35, rate: 0.85, tag: '极高' },
    { sid: 'kaleo', lv: [5, 5], w: 5, rate: 0.45, tag: '中等', rare: true }
  ],
  grass: [
    { sid: 'wind', lv: [1, 3], w: 65, rate: 0.85, tag: '极高' },
    { sid: 'mush', lv: [1, 5], w: 35, rate: 0.65, tag: '较高' }
  ],
  // 坎布尔星（水系）
  kb_sea: [
    { sid: 'pede', lv: [6, 10], w: 55, rate: 0.7, tag: '较高' },
    { sid: 'gorgon', lv: [6, 10], w: 40, rate: 0.65, tag: '较高' },
    { sid: 'siren', lv: [12, 12], w: 5, rate: 0.4, tag: '中等', rare: true }
  ],
  // 庞贝星（火系）
  pp_lava: [
    { sid: 'hephaestus', lv: [8, 14], w: 100, rate: 0.6, tag: '较高' }
  ],
  // 莱汀陨石带（电系）
  lt_belt: [
    { sid: 'leigong', lv: [10, 15], w: 55, rate: 0.6, tag: '较高' },
    { sid: 'faraday', lv: [10, 15], w: 45, rate: 0.55, tag: '中等' }
  ],
  // 白之星（冰系）
  wh_snow: [
    { sid: 'frost', lv: [12, 18], w: 95, rate: 0.55, tag: '中等' },
    { sid: 'wild', lv: [20, 20], w: 5, rate: 0.35, tag: '较低', rare: true }
  ]
};
var WILD_REGIONS = [
  { id: 'forest', planet: 'flora', name: '丛林', en: 'Forest', d: '高大的树木遮住了天空，林下潮湿又安静。玛西很常见，偶尔能撞见稀有的卡莱。', pool: 'forest', bgs: ['fl_path', 'fl_beech', 'fl_sun', 'fl_maple'] },
  { id: 'grass', planet: 'flora', name: '草甸', en: 'Grassland', d: '一望无际的草甸，风吹过时像绿色的海浪。卡罗成群地在这里奔跑。', pool: 'grass', bgs: ['fl_meadow', 'fl_lake'] },
  { id: 'salt', planet: 'flora', name: '盐碱地', en: 'Saline-alkali Land', d: '寸草不生的白色荒原，四处飘着灰紫色的瘴气。着陆舱就是在这里迫降的，目前禁止进入。', boss: '？？？', bgs: ['fl_salt'] }
,
  { id: 'kb_sea', planet: 'kamble', name: '环礁浅海', en: 'Atoll Shallows', d: '温暖的浅海和一圈圈环礁，海水清得能看见底。佩恩和水球常在这里出没，偶尔能听见塞米的歌声。', pool: 'kb_sea' },
  { id: 'pp_lava', planet: 'pompeii', name: '熔岩原', en: 'Lava Field', d: '黑色的火山岩一直铺到天边，脚下的裂缝里还在冒着红光。赫菲斯喜欢在热气里打盹。', pool: 'pp_lava' },
  { id: 'lt_belt', planet: 'laiting', name: '雷暴陨石群', en: 'Storm Belt', d: '大大小小的陨石在电弧里漂浮，到处噼啪作响。锰怪和雷天使在石头之间穿梭。', pool: 'lt_belt' },
  { id: 'wh_snow', planet: 'white', name: '永冻冰原', en: 'Permafrost', d: '一望无际的白色冰原，风里夹着冰晶。铸冰者在冰面下游荡，传说还有一只很少露面的亚当。', pool: 'wh_snow' }
];
