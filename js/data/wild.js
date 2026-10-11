/* ==========================================================
 * 芙罗拉星野外精灵
 * WILD_POOLS[区域] = 可遇到的精灵（lv 等级范围，w 出现权重，rate 捕捉率）；WILD_REGIONS 区域列表
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
  ]
};
var WILD_REGIONS = [
  { id: 'forest', name: '丛林', en: 'Forest', d: '高大的树木遮住了天空，林下潮湿又安静。玛西很常见，偶尔能撞见稀有的卡莱。', pool: 'forest', bgs: ['fl_path', 'fl_beech', 'fl_sun', 'fl_maple'] },
  { id: 'grass', name: '草甸', en: 'Grassland', d: '一望无际的草甸，风吹过时像绿色的海浪。卡罗成群地在这里奔跑。', pool: 'grass', bgs: ['fl_meadow', 'fl_lake'] },
  { id: 'salt', name: '盐碱地', en: 'Saline-alkali Land', d: '寸草不生的白色荒原，四处飘着灰紫色的瘴气。着陆舱就是在这里迫降的，目前禁止进入。', boss: '？？？', bgs: ['fl_salt'] }
];
