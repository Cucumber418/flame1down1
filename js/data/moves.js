/* ==========================================================
 * 技能表
 * M[技能名] = { type 属性, cat 物攻/特攻/变化, power 威力, pp, d 描述, custom 特殊效果… }
 * ========================================================== */

/* ---------- 技能 ----------
   cat: 物攻 / 特攻 / 变化；pri: 先制；hidden: 隐藏技能
   fixed 附加固定伤害；drain 吸血比例；hits 连击；acc 命中；crit 'high'
   selfStage / tgtStage 能力等级（chance 概率）；status 异常状态；heal 回复比例
   custom 特殊效果，见 useMove / doStatus */
var M = {
  // —— 堤丰（龙）
  龙息: { type: '龙', cat: '特攻', power: 55, d: '威力55' },
  龙之爪牙: { type: '龙', cat: '物攻', power: 40, fixed: 40, d: '威力40，附加40点固定伤害' },
  磨刀: { type: '普通', cat: '变化', selfStage: { atk: 1 }, d: '提升1级物攻' },
  龙鳞光: { type: '龙', cat: '特攻', power: 70, fixed: 60, d: '威力70，附加60点固定伤害' },
  龙尾猛扫: { type: '龙', cat: '物攻', power: 75, d: '威力75' },
  巨龙之吼: { type: '龙', cat: '特攻', power: 70, pri: 1, clearTgtUp: true, d: '威力70，先制+1，消除对方能力提升效果' },
  龙之逆鳞: { type: '龙', cat: '变化', custom: 'nilin', pp: 5, d: '5回合内受到的伤害不会超过250，超出的部分等额反馈给对方' },
  龙吟崩山震: { type: '龙', cat: '变化', tgtStage: { spd: -2 }, status: { k: '害怕', min: 1, max: 3, chance: 0.3 }, d: '降低对方2级特防，30%概率使对方害怕1-3回合' },
  巨龙堕天啸: { type: '龙', cat: '特攻', power: 105, custom: 'transferDown', pp: 10, d: '威力105，将自身的能力下降状态转移至对方身上' },
  亘古恒压: { type: '龙', cat: '变化', hidden: true, custom: 'genggu', pp: 5, d: '2回合内每回合提升1级特攻，每回合恢复1/6最大体力' },
  巨龙湮灭破: { type: '龙', cat: '特攻', power: 100, hidden: true, custom: 'lowHpDouble', pp: 10, d: '威力100，对方体力低于1/4时威力加倍' },

  // —— 叶粒之果（草）
  飞叶刀: { type: '草', cat: '物攻', power: 35, d: '威力35' },
  木叶庇护: { type: '草', cat: '变化', selfStage: { def: 1, spd: 1 }, d: '提升1级物防、特防' },
  寄生之种: { type: '草', cat: '变化', status: { k: '寄生', min: 5, max: 5, chance: 1, refresh: true }, d: '使对方寄生5回合（每回合吸取对方1/10体力）' },
  猛冲击: { type: '普通', cat: '物攻', power: 60, custom: 'halfHpBoost', d: '威力60，对体力低于1/2者伤害提升50%' },
  吸取: { type: '草', cat: '特攻', power: 60, drain: 0.5, d: '威力60，造成伤害的一半转化为体力回复' },
  花粉: { type: '草', cat: '变化', tgtStage: { acc: -1 }, custom: 'pollen', d: '降低对方1级命中，40%概率改为降低2级' },
  强力吸取: { type: '草', cat: '特攻', power: 80, drain: 0.5, d: '威力80，造成伤害的一半转化为体力回复' },
  光合作用: { type: '草', cat: '变化', heal: 1 / 5, selfStage: { spa: 1 }, pp: 10, d: '恢复1/5体力，提升1级特攻' },
  软化粉: { type: '草', cat: '特攻', power: 50, tgtStage: { atk: -2 }, d: '威力50，降低对方2级物攻' },
  飞叶风暴: { type: '草', cat: '特攻', power: 90, hidden: true, selfStage: { spa: 1 }, selfChance: 0.4, d: '威力90，40%概率提升1级特攻' },
  超级吸取: { type: '草', cat: '特攻', power: 95, hidden: true, drain: 0.5, d: '威力95，造成伤害的一半转化为体力回复' },

  // —— 戈耳贡（水）
  水球: { type: '水', cat: '特攻', power: 40, d: '威力40' },
  悲鸣: { type: '普通', cat: '变化', tgtStage: { atk: -1, spa: -1 }, d: '降低对方1级物攻、特攻' },
  水护盾: { type: '水', cat: '变化', custom: 'shield', pp: 10, d: '获得100点护盾' },
  极速射线: { type: '普通', cat: '特攻', power: 60, pri: 1, d: '威力60，先制+1' },
  傲慢: { type: '普通', cat: '变化', custom: 'noSwitch', pp: 5, d: '5回合内使对方无法切换精灵' },
  灵光: { type: '普通', cat: '变化', selfStage: { spa: 2 }, d: '提升2级特攻' },
  海啸: { type: '水', cat: '特攻', power: 80, clearTgtUp: true, d: '威力80，消除对方能力提升效果' },
  凝视: { type: '普通', cat: '变化', status: { k: '石化', min: 2, max: 3, chance: 0.5 }, d: '50%概率使对方石化2-3回合' },
  水天一色: { type: '水', cat: '变化', custom: 'priorityUp', pp: 5, d: '5回合内所有技能先制+1' },
  灭生之潮: { type: '水', cat: '特攻', power: 85, hidden: true, tgtStage: { atk: -1, spa: -1 }, d: '威力85，降低对方1级物攻、特攻' },
  创生之潮: { type: '水', cat: '特攻', power: 70, hidden: true, selfStage: { spa: 1 }, heal: 1 / 4, pp: 10, d: '威力70，提升1级特攻，恢复1/4体力' },

  // —— 水臂领主（水）
  水枪: { type: '水', cat: '物攻', power: 45, d: '威力45' },
  吸水: { type: '水', cat: '变化', heal: 1 / 3, pp: 10, d: '恢复1/3体力' },
  螺旋水弹: { type: '水', cat: '特攻', power: 25, hits: [2, 5], d: '威力25，连续攻击2-5次' },
  淹没: { type: '水', cat: '特攻', power: 30, status: { k: '溺水', min: 1, max: 3, chance: 0.5 }, d: '威力30，50%概率使对方溺水1-3回合' },
  音速喷射: { type: '水', cat: '物攻', power: 50, pri: 1, d: '威力50，先制+1' },
  逆流: { type: '水', cat: '变化', tgtStage: { spe: -1, acc: -1 }, d: '降低对方1级速度、命中' },
  光滑皮肤: { type: '普通', cat: '变化', custom: 'dodge', pp: 10, d: '3回合内每回合有40%概率闪避攻击' },
  贯穿水枪: { type: '水', cat: '物攻', power: 90, d: '威力90' },
  绝对防御: { type: '普通', cat: '变化', custom: 'absDef', pp: 5, d: '免疫下1次受到的攻击' },
  溺毙: { type: '水', cat: '特攻', power: 140, hidden: true, acc: 40, custom: 'drown', pp: 5, d: '威力140，命中率只有40%，敌人溺水时命中率达到90%；命中后，对方每下降1级能力，附加30点固定伤害' },
  混沌海流: { type: '水', cat: '变化', hidden: true, tgtStage: { spe: -1, acc: -1, def: -1, eva: -1 }, pp: 10, d: '降低对方1级速度、命中、物防、闪避' },

  // —— 六尾风王（草）
  针刺: { type: '草', cat: '物攻', power: 40, d: '威力40' },
  加速: { type: '普通', cat: '变化', selfStage: { spe: 1 }, d: '提升1级速度' },
  种子炸弹: { type: '草', cat: '特攻', power: 70, tgtStage: { spd: -1 }, tgtChance: 0.4, d: '威力70，40%概率降低对方1级特防' },
  香甜气息: { type: '草', cat: '变化', custom: 'immune', pp: 10, d: '5回合内免疫异常状态' },
  绿色幻境: { type: '草', cat: '变化', custom: 'green', pp: 5, d: '5回合内每回合恢复已损失体力的1/5' },
  木叶旋风: { type: '草', cat: '特攻', power: 80, tgtStage: { spd: -1 }, tgtChance: 0.4, d: '威力80，40%概率降低对方1级特防' },
  飞旋一击: { type: '普通', cat: '特攻', power: 60, pri: 1, d: '威力60，先制+1' },
  木叶刺: { type: '草', cat: '物攻', power: 85, d: '威力85' },
  风王结界: { type: '草', cat: '变化', hidden: true, custom: 'reflect', pp: 5, d: '5回合内免疫并反弹异常状态' },
  木叶飓风: { type: '草', cat: '特攻', power: 80, hidden: true, tgtStage: { spd: -1 }, d: '威力80，降低对方1级特防' },

  // —— 帕努托尔（暗影）
  影刃: { type: '暗影', cat: '物攻', power: 55, d: '威力55' },
  颤栗: { type: '暗影', cat: '变化', status: { k: '害怕', min: 2, max: 3, chance: 0.5 }, d: '50%概率使对方害怕2-3回合' },
  原力光线: { type: '普通', cat: '特攻', power: 70, d: '威力70' },
  黑光: { type: '暗影', cat: '变化', tgtStage: { atk: -1, acc: -1 }, d: '降低对方1级物攻、命中' },
  灵魂之刃: { type: '暗影', cat: '物攻', power: 80, drain: 1 / 3, d: '威力80，造成伤害的1/3转化为体力恢复' },
  黑月刀光: { type: '暗影', cat: '物攻', power: 75, selfStage: { atk: 1 }, d: '威力75，提升1级物攻' },
  黑暗之泉: { type: '暗影', cat: '变化', clearSelfDown: true, pp: 10, d: '解除自身能力下降状态' },
  收割: { type: '普通', cat: '物攻', power: 70, koHeal: 1 / 3, d: '威力70，使用此技能击败一名敌人则恢复1/3体力' },
  献以黑暗: { type: '暗影', cat: '变化', custom: 'silence', pp: 5, d: '若先出手，则使对方当回合技能失效' },
  饮血刀光: { type: '暗影', cat: '物攻', power: 80, hidden: true, drain: 1 / 3, selfStage: { atk: 1 }, d: '威力80，造成伤害的1/3转化为体力恢复，提升1级物攻' },
  黑暗收割: { type: '暗影', cat: '物攻', power: 80, hidden: true, koHeal: 1 / 2, d: '威力80，使用此技能击败一名敌人则恢复1/2体力' },

  // —— 坎克托斯（水，原恩佩德）
  水箭: { type: '水', cat: '物攻', power: 50, d: '威力50' },
  祈雨: { type: '水', cat: '变化', custom: 'rain', pp: 10, d: '5回合内每回合对对方附加30点固定伤害' },
  泡沫: { type: '水', cat: '特攻', power: 20, tgtStage: { acc: -1 }, d: '威力20，降低对方1级命中' },
  潜水: { type: '水', cat: '变化', selfStage: { spe: 1 }, custom: 'boostNext', pp: 10, d: '提升1级速度，下一次攻击伤害提升50%' },
  水打击: { type: '水', cat: '物攻', power: 75, d: '威力75' },
  水风暴: { type: '水', cat: '特攻', power: 75, d: '威力75' },
  怒海疾刺: { type: '水', cat: '物攻', power: 85, status: { k: '流血', min: 3, max: 3, chance: 0.4 }, d: '威力85，40%概率使对方流血3回合' },
  巨刃: { type: '普通', cat: '物攻', power: 100, d: '威力100' },
  狂涛疾刃: { type: '水', cat: '物攻', power: 100, hidden: true, status: { k: '流血', min: 3, max: 3, chance: 0.45 }, d: '威力100，45%概率使对方流血3回合' },
  水纹震击: { type: '水', cat: '物攻', power: 75, hidden: true, pri: 1, d: '威力75，先制+1' },

  // —— 泰戈尔（普通）
  重锤: { type: '普通', cat: '物攻', power: 55, d: '威力55' },
  暴锤: { type: '普通', cat: '物攻', power: 45, crit: 'high', d: '威力45，更容易致命一击' },
  头铁: { type: '普通', cat: '变化', selfStage: { def: 1 }, d: '提升1级物防' },
  慈悲气波: { type: '普通', cat: '特攻', power: 70, mercy: true, d: '威力70；如果这次伤害足以击败对方，对方会剩下1点体力' },
  修竹拳: { type: '草', cat: '物攻', power: 85, d: '威力85' },
  若水拳: { type: '水', cat: '物攻', power: 85, d: '威力85' },
  燎燃拳: { type: '火', cat: '物攻', power: 85, d: '威力85' },
  自我崩坏: { type: '普通', cat: '变化', custom: 'selfBreak', pp: 10, d: '损失自身1/2现有体力，提升2级物攻、1级速度、1级命中' },
  普通拳: { type: '普通', cat: '物攻', power: 160, custom: 'normalPunch', pp: 5, d: '威力160，降低自身2级命中' },
  元神崩坏: { type: '普通', cat: '变化', hidden: true, custom: 'selfBreak2', pp: 5, d: '损失自身1/2现有体力，提升2级物攻、1级速度、1级命中，下一次攻击必定致命一击且必中' },
  三相归元: { type: '普通', cat: '变化', hidden: true, custom: 'tri', pp: 5, d: '恢复1/3体力，3回合内使用草、水、火系技能时额外恢复1/3体力' },
  // ===================== 第二批：15 只新精灵的技能 =====================
  // —— 哈尔达蒙（超能）
  幻术: { type: '超能', cat: '特攻', power: 50, d: '威力50' },
  魔眼: { type: '超能', cat: '变化', status: { k: '睡眠', min: 2, max: 3, chance: 0.5 }, d: '50%概率使对方睡眠2-3回合' },
  念力冲击: { type: '超能', cat: '特攻', power: 75, d: '威力75' },
  奥术护盾: { type: '超能', cat: '变化', selfStage: { spd: 2 }, d: '提升2级特防' },
  驱使念力: { type: '超能', cat: '变化', custom: 'nextCrit', pp: 10, d: '下回合必定致命一击' },
  透明射线: { type: '普通', cat: '特攻', power: 80, d: '威力80' },
  飘忽不定: { type: '超能', cat: '变化', selfStage: { spe: 1, eva: 1 }, d: '提升1级速度、闪避' },
  灵光冲击: { type: '超能', cat: '特攻', power: 90, d: '威力90' },
  虚空化: { type: '超能', cat: '变化', custom: 'voidPhys', pp: 10, d: '2回合内闪避物理攻击' },
  顿悟星盘: { type: '超能', cat: '变化', hidden: true, selfStage: { spa: 1, spe: 1 }, custom: 'nextCrit', pp: 10, d: '提升1级特攻、速度，下回合必定致命一击' },
  刹那灭杀: { type: '超能', cat: '特攻', power: 105, crit: 'high', hidden: true, d: '威力105，更容易致命一击' },

  // —— 炽雷天使（电，原法拉第）
  电球: { type: '电', cat: '特攻', power: 50, d: '威力50' },
  电磁波: { type: '电', cat: '变化', status: { k: '麻痹', min: 2, max: 3, chance: 0.5 }, d: '50%概率使对方麻痹2-3回合' },
  屏障: { type: '普通', cat: '变化', selfStage: { spd: 1 }, d: '提升1级特防' },
  电浆炮: { type: '电', cat: '特攻', power: 70, d: '威力70' },
  聚雷: { type: '电', cat: '变化', selfStage: { spa: 1 }, d: '提升1级特攻' },
  闪电烙印: { type: '电', cat: '特攻', power: 70, custom: 'brand', d: '威力70，叠加一层烙印，叠满2层时必定使对方麻痹2回合；之后对方进入烙印冷却（麻痹期间及解除后1回合内无法叠加烙印）' },
  雷暴: { type: '电', cat: '变化', tgtStage: { def: -1, spd: -1 }, d: '降低对方1级物防、特防' },
  饱和电浆炮: { type: '电', cat: '特攻', power: 100, always: true, d: '威力100，必中' },
  电磁感应: { type: '电', cat: '变化', custom: 'induct', pp: 10, d: '5回合内主动攻击命中后提升1级特攻' },
  闪电漩涡: { type: '电', cat: '特攻', power: 80, hidden: true, custom: 'vortex', d: '威力80，3回合内每回合降低对方1级命中' },
  介电崩坏: { type: '电', cat: '变化', hidden: true, tgtStage: { def: -1, spd: -1 }, custom: 'dielectric', d: '降低对方1级物防、特防，对方麻痹时效果翻倍' },

  // —— 朔望月灵（光）
  光刃: { type: '光', cat: '物攻', power: 45, d: '威力45' },
  迷光: { type: '光', cat: '变化', tgtStage: { acc: -1 }, d: '降低对方1级命中' },
  微光射线: { type: '光', cat: '特攻', power: 60, d: '威力60' },
  刺目: { type: '光', cat: '特攻', power: 20, status: { k: '失明', min: 2, max: 3, chance: 1 }, d: '威力20，使对方失明2-3回合' },
  朔月: { type: '光', cat: '变化', custom: 'stealDef', d: '吸取对方1级物防' },
  月银之刃: { type: '光', cat: '物攻', power: 90, custom: 'moonBlade', d: '威力90，造成伤害若低于180则提升1级物攻' },
  望月: { type: '光', cat: '变化', custom: 'stealAtk', d: '吸取对方1级物攻' },
  迷之微笑: { type: '普通', cat: '特攻', power: 0, fixedOnly: 'smile', pp: 3, d: '造成自身等级×2.5的固定伤害（LV100 时为 250）' },
  月神降临: { type: '光', cat: '变化', selfStage: { atk: 2, def: 1, spd: 1 }, pp: 10, d: '提升2级物攻、1级物防、特防' },
  残月之痕: { type: '光', cat: '物攻', power: 20, hidden: true, custom: 'canyue', pp: 15, d: '威力20，每使用一次，威力较上一次翻倍（20→40→80→160），最高160；换下场也会保留，已使用的次数显示在状态栏' },
  月之暗面: { type: '暗影', cat: '变化', hidden: true, custom: 'darkside', pp: 5, d: '将精灵属性、技能属性切换为暗影系，持续5回合；处于暗影系时，此技能变为「月之亮面」，可切换回光系' },

  // —— 霜冻之冠（冰）
  冰刺: { type: '冰', cat: '物攻', power: 50, d: '威力50' },
  降温: { type: '冰', cat: '变化', tgtStage: { def: -1 }, d: '降低对方1级物防' },
  霜冻结界: { type: '冰', cat: '特攻', power: 20, status: { k: '冰冻', min: 1, max: 3, chance: 0.5 }, d: '威力20，50%概率使对方冰冻1-3回合' },
  冰封: { type: '冰', cat: '变化', tgtStage: { spa: -1, spe: -1 }, d: '降低对方1级特攻、速度' },
  切裂: { type: '普通', cat: '物攻', power: 70, d: '威力70' },
  冰冻打击: { type: '冰', cat: '物攻', power: 75, status: { k: '冰冻', min: 1, max: 3, chance: 0.25 }, d: '威力75，25%概率使对方冰冻1-3回合' },
  遁走: { type: '普通', cat: '变化', custom: 'dodgeOne', pp: 10, d: '闪避下1次攻击' },
  极寒冰刺: { type: '冰', cat: '物攻', power: 100, custom: 'iceSpike', d: '威力100，对方冰冻时威力提升50点' },
  冰雹: { type: '冰', cat: '变化', custom: 'hail', pp: 10, d: '5回合内对方每回合受到1/10最大体力值的固定伤害' },
  零度冰破: { type: '冰', cat: '物攻', power: 110, hidden: true, custom: 'zeroBreak', d: '威力110，对方冰冻时附带对方1/8最大体力的固定伤害' },
  急冻打击: { type: '冰', cat: '物攻', power: 70, pri: 1, hidden: true, status: { k: '冰冻', min: 1, max: 3, chance: 0.3 }, d: '威力70，先制+1，30%概率使对方冰冻1-3回合' },

  // —— 亚贝拉赫（远古，原蛮荒遗息）
  秘术冲击: { type: '远古', cat: '特攻', power: 45, d: '威力45' },
  源力: { type: '远古', cat: '变化', selfStage: { atk: 1, def: 1 }, d: '提升1级物攻、物防' },
  灵术涌动: { type: '远古', cat: '变化', custom: 'nextCrit', pp: 10, d: '下回合必定致命一击' },
  传承重击: { type: '远古', cat: '物攻', power: 65, pri: 1, d: '威力65，先制+1' },
  神秘之力: { type: '远古', cat: '变化', custom: 'mystic', pp: 10, d: '60%概率提升1级特攻、物防、特防、速度、命中、闪避' },
  封印: { type: '远古', cat: '变化', custom: 'noBoostFoe', pp: 10, d: '5回合内对方无法提升能力等级' },
  起源暴风: { type: '远古', cat: '特攻', power: 70, tgtStage: { spe: -1 }, custom: 'originStorm', d: '威力70，降低对方1级速度，对方速度每降低1级，威力提升15点' },
  远古意志: { type: '远古', cat: '变化', clearSelfDown: true, selfStage: { spa: 1 }, pp: 10, d: '解除自身能力下降状态，提升1级特攻' },
  天罚: { type: '远古', cat: '特攻', power: 60, custom: 'punish', pp: 10, d: '对方能力提升效果越强，造成伤害越高（试验版：威力60，对方每有1级能力提升，威力+20）' },
  神秘灵核: { type: '远古', cat: '变化', hidden: true, selfStage: { spa: 2, spe: 1 }, pp: 10, d: '提升2级特攻、1级速度' },
  起源巨刃: { type: '远古', cat: '物攻', power: 70, hidden: true, custom: 'originBlade', d: '威力70，必杀速度降低6级的敌人' },

  // —— 赫菲斯托（火）
  火之刃: { type: '火', cat: '物攻', power: 50, d: '威力50' },
  火焰漩涡: { type: '火', cat: '特攻', power: 15, status: { k: '烧伤', min: 2, max: 5, chance: 1 }, d: '威力15，使对方烧伤2-5回合' },
  焚烧: { type: '火', cat: '变化', tgtStage: { def: -2 }, d: '降低对方2级物防' },
  狂乱斩击: { type: '普通', cat: '物攻', power: 65, tgtStage: { def: -1 }, tgtChance: 0.4, d: '威力65，40%概率降低对方1级物防' },
  火焰能量: { type: '火', cat: '变化', selfStage: { atk: 1, spa: 1 }, d: '提升1级物攻、特攻' },
  爆炎斩: { type: '火', cat: '物攻', power: 70, custom: 'blastSlash', d: '威力70，先出手时50%概率使对方烧伤2-5回合' },
  流火: { type: '火', cat: '特攻', power: 50, custom: 'liuhuo', d: '威力50，5回合内火系技能威力提升5点' },
  驭火之力: { type: '火', cat: '物攻', power: 10, hits: [6, 9], custom: 'fireHits', d: '威力10，做出6-9次攻击，对方烧伤时必定达到9次连击' },
  熔化: { type: '火', cat: '变化', custom: 'melt', pp: 10, d: '使对方受到伤害提升20%，持续到战斗结束，可以叠加至多5层' },
  火山突堑: { type: '火', cat: '物攻', power: 70, pri: 1, hidden: true, status: { k: '烧伤', min: 2, max: 5, chance: 0.5 }, d: '威力70，先制+1，50%概率使对方烧伤2-5回合' },
  烧却: { type: '火', cat: '变化', hidden: true, custom: 'burnout', pp: 5, d: '仅可对存在熔化状态的敌人使用，使对方熔化状态直接叠加至5层' },

  // —— 雷公（电）
  电击: { type: '电', cat: '特攻', power: 40, d: '威力40' },
  磁力波: { type: '电', cat: '特攻', power: 20, tgtStage: { spe: -1 }, d: '威力20，降低对方1级速度' },
  雷切: { type: '电', cat: '物攻', power: 60, pri: 1, d: '威力60，先制+1' },
  电磁脉冲: { type: '电', cat: '特攻', power: 70, status: { k: '麻痹', min: 1, max: 3, chance: 0.2 }, d: '威力70，20%概率使对方麻痹1-3回合' },
  雷光之锤: { type: '电', cat: '物攻', power: 90, d: '威力90' },
  电闪光: { type: '电', cat: '变化', tgtStage: { spe: -1, acc: -1 }, d: '降低对方1级速度、命中' },
  恐怖电容: { type: '电', cat: '变化', selfStage: { atk: 2 }, custom: 'capacitor', pp: 10, d: '提升2级物攻' },
  自爆: { type: '普通', cat: '变化', custom: 'selfDestruct', pp: 5, d: '牺牲自己，使对方疲惫2回合，降低对方1级物防、特防' },
  雷击: { type: '电', cat: '特攻', power: 120, acc: 60, hidden: true, status: { k: '麻痹', min: 1, max: 3, chance: 0.9 }, pp: 5, d: '威力120，90%概率使对方麻痹1-3回合，不易命中（命中60%）' },
  舍身爆破: { type: '普通', cat: '物攻', power: 0, hidden: true, fixedOnly: 'selfBlast', pp: 5, d: '牺牲自己，造成等同于自身当前体力值的固定伤害（不低于自身最大体力值的 1/3）' },

  // —— 幽冥水臂（水/暗影）
  幽冥息: { type: '暗影', cat: '特攻', power: 60, d: '威力60' },
  静谧水域: { type: '水', cat: '变化', custom: 'calm', pp: 10, d: '5回合内每回合恢复1/5HP' },
  恶魔触手: { type: '暗影', cat: '物攻', power: 65, custom: 'vuln', d: '威力65，使对方受到伤害增加30%，持续3回合' },
  贯穿水线: { type: '水', cat: '特攻', power: 90, d: '威力90' },
  幽冥结界: { type: '暗影', cat: '变化', custom: 'halfPhys5', pp: 10, d: '5回合内受到物理伤害减半' },
  // 玫瑰星云专属（第十九段 · 码头决战，2026-11-01）
  强烈恒星风: { type: '暗影', cat: '特攻', power: 100, fixed: 100, tgtStage: { def: -3, spd: -3 }, pp: 10, d: '威力100，降低对方3级物防、特防，并附加100点固定伤害（玫瑰星云：开局释放，之后每5回合使用一次）' },
  'O型星超温辐射': { type: '暗影', cat: '特攻', power: 80, custom: 'oStar', pp: 5, d: '威力80，同时对对方背包里所有精灵造成伤害（玫瑰星云第三管体力：每5回合使用一次）' },
  // 2026-11-02：蒂亚戈（战斗）
  爪击: { type: '战斗', cat: '物攻', power: 50, pp: 30, d: '威力50' },
  守御: { type: '战斗', cat: '变化', selfStage: { def: 1, spd: 1 }, pp: 20, d: '提升1级物防、特防' },
  拳刃: { type: '战斗', cat: '物攻', power: 70, pp: 20, d: '威力70' },
  蓄势待发: { type: '战斗', cat: '变化', custom: 'x2next', pp: 15, d: '下一次攻击伤害翻倍' },
  反击风暴: { type: '战斗', cat: '变化', custom: 'counterStorm', pp: 10, d: '5回合内，受到主动攻击时把25%的伤害反弹给对方' },
  迅捷刺击: { type: '战斗', cat: '物攻', power: 80, pri: 1, custom: 'swiftPierce', pp: 15, d: '威力80，先制+1；先出手时，先清空对方的物防强化再造成伤害，每清空1级本次伤害+75%' },
  心眼刀: { type: '战斗', cat: '变化', pri: 2, custom: 'parryTm', pp: 2, d: '先制+2。本回合内化解对方试图展开的回合类效果；化解成功后获得自身等级×2.5的护盾，并回复1点PP' },
  至高之术: { type: '战斗', cat: '变化', pri: 2, hidden: true, custom: 'parryAtk', pp: 2, d: '先制+2。本回合内化解对方试图发动的主动攻击；化解成功后（对方攻击失效后）造成自身等级×2的固定伤害，并回复1点PP' },
  压制弧光: { type: '战斗', cat: '物攻', power: 80, hidden: true, custom: 'suppressArc', pp: 10, d: '威力80，清空对方的物攻强化；成功清空则下回合对方不能使用变化类技能' },
  // 2026-11-02：莱布尼茨（电 · 飞行）
  带电撞击: { type: '电', cat: '物攻', power: 55, pp: 30, d: '威力55' },
  御雷: { type: '电', cat: '变化', selfStage: { atk: 1 }, pp: 20, d: '提升1级物攻' },
  飞撞: { type: '飞行', cat: '物攻', power: 60, tgtStage: { def: -1 }, tgtChance: 0.4, pp: 25, d: '威力60，40%概率降低对方1级物防' },
  风雷滚滚: { type: '电', cat: '变化', custom: 'fenglei', pp: 10, d: '5回合内，自身在场时，每回合结束有一半概率降低对方1级速度，否则提升自身1级速度' },
  霹雳冲击: { type: '电', cat: '物攻', power: 80, selfStage: { atk: 1 }, selfChance: 0.4, pp: 15, d: '威力80，40%概率提升1级物攻' },
  翔月极闪: { type: '飞行', cat: '物攻', power: 90, hidden: true, selfStage: { atk: 1 }, selfChance: 0.4, firstSure: 1, custom: 'spdFix30', pp: 10, d: '威力90，40%概率提升1级物攻，先出手时必定提升；附加等同于双方速度差值30%的固定伤害' },
  贯穿雷刃: { type: '电', cat: '物攻', power: 100, hidden: true, custom: 'pierceDef', pp: 10, d: '威力100，无视对方的物防提升' },
  '氢-α发射线': { type: '暗影', cat: '特攻', power: 80, custom: 'randStatus', pp: 20, d: '威力80，50%几率让对方随机陷入一种异常状态' },
  黑雾潮汐: { type: '暗影', cat: '特攻', power: 65, hidden: true, custom: 'tide', pp: 10, d: '威力65，使用后从下回合起，连续4回合在每回合行动结束后额外发动一次【黑雾潮汐】' },
  混沌水域: { type: '水', cat: '变化', hidden: true, selfStage: { spa: 2 }, custom: 'chaosWater', pp: 10, d: '提升2级特攻，吸取对方1/5当前体力值' },

  // —— 荒芜（草）
  次级吸取: { type: '草', cat: '特攻', power: 35, drain: 0.5, d: '威力35，造成伤害的一半转化为体力回复' },
  缠绕: { type: '草', cat: '变化', tgtStage: { spe: -2 }, d: '降低对方2级速度' },
  生长: { type: '草', cat: '变化', selfStage: { spa: 1 }, d: '提升1级特攻' },
  绿色射线: { type: '草', cat: '特攻', power: 65, d: '威力65' },
  凋零之蚀: { type: '草', cat: '变化', custom: 'wither', pp: 10, d: '使对方每回合损失1/24最大体力，持续到战斗结束；可以叠加，每层再多损失1/24，最多4层' },
  荒芜之触: { type: '草', cat: '特攻', power: 75, custom: 'weak3', d: '威力75，使对方伤害降低30%，持续3回合' },
  枯萎之壤: { type: '草', cat: '变化', tgtStage: { atk: -1, spa: -1, acc: -1 }, d: '降低对方1级物攻、特攻、命中' },
  腐败枷锁: { type: '草', cat: '变化', tgtStage: { spe: -1 }, custom: 'noBoostFoe', pp: 10, d: '降低对方1级速度，使对方5回合内无法提升能力等级' },
  灭却: { type: '普通', cat: '特攻', power: 1, hidden: true, custom: 'annihilate', pp: 2, d: '威力1，PP 2，秒杀成功后恢复本技能全部 PP；5%概率秒杀对方，对方存在的不利状态越多，成功率越高（每多1种不利状态 +10%，最高60%）' },
  瘴毒灭却: { type: '草', cat: '特攻', power: 1, pri: 9, pp: 20, always: true, custom: 'annihilateSure', d: '剧情限定技能：先制 +9，必定命中，直接秒杀目标' },
  按兵不动: { type: '普通', cat: '变化', power: 0, pp: 99, d: '原地不动，不会造成任何效果（剧情限定，用于不会攻击的对象）' },

  // —— 玛西露姆（草）
  毒孢子: { type: '草', cat: '特攻', power: 30, status: { k: '中毒', min: 2, max: 4, chance: 0.5 }, d: '威力30，50%概率使对方中毒2-4回合' },
  催眠孢子: { type: '草', cat: '特攻', power: 30, status: { k: '睡眠', min: 1, max: 3, chance: 0.4 }, d: '威力30，40%概率使对方睡眠1-3回合' },
  毒雾: { type: '草', cat: '特攻', power: 70, custom: 'poisonBoost', d: '威力70，对中毒时伤害提升50%' },
  毒棘鞭: { type: '草', cat: '物攻', power: 75, custom: 'poisonBoost', d: '威力75，对中毒的敌人伤害提升50%' },
  麻醉孢子: { type: '草', cat: '特攻', power: 30, status: { k: '麻痹', min: 1, max: 3, chance: 0.4 }, d: '威力30，40%概率使对方麻痹1-3回合' },
  孢子沼泽: { type: '草', cat: '变化', custom: 'swamp', pp: 10, d: '5回合内异常状态赋予成功率×1.5' },
  以毒攻毒: { type: '草', cat: '变化', hidden: true, custom: 'purge', pp: 5, d: '损失1/2现有体力，藉此清除自身一切不利状态' },
  渗透孢子: { type: '草', cat: '特攻', power: 100, hidden: true, custom: 'poisonHeart', pp: 10, d: '威力100，仅能命中中毒的敌人，命中后使其中毒叠加1层，并延长1回合持续时长' },

  // —— 卡莱奥丹（草）
  飞叶: { type: '草', cat: '物攻', power: 45, d: '威力45' },
  千针叶: { type: '草', cat: '物攻', power: 20, hits: [2, 5], d: '威力20，做出2-5次攻击' },
  魔鬼之叶: { type: '草', cat: '物攻', power: 70, tgtStage: { def: -1 }, tgtChance: 0.45, d: '威力70，45%概率降低对方1级物防' },
  进食: { type: '普通', cat: '物攻', power: 10, fixed: 100, d: '威力10，附加100点固定伤害' },
  吃米饭: { type: '普通', cat: '变化', custom: 'rice', d: '吃一口米饭：随机回复1/5体力、提升1级物攻、提升1级速度三者之一（各1/3）' },
  // —— 奥多亚克（水 · 机械，2026-10-24）：形态技能。稳态下是左边的版本，进入歼灭 / 护阵形态后自动换成对应版本（见 battle.js 的 ODO_VAR）
  歼灭形态: { type: '机械', cat: '变化', pri: 1, custom: 'odoAtk', pp: 10, d: '先制+1，切换为歼灭形态：双攻提升1级，清除异常状态，部分技能切换为歼灭形态的版本（切换后这个技能变成「护阵形态」）' },
  护阵形态: { type: '机械', cat: '变化', pri: 1, custom: 'odoDef', pp: 10, d: '先制+1，切换为护阵形态：双防提升1级，清除能力下降，部分技能切换为护阵形态的版本（切换后这个技能变成「歼灭形态」）' },
  钢铁冲击: { type: '机械', cat: '物攻', power: 70, d: '威力70（歼灭形态下变为「流形蛮冲」，护阵形态下变为「坚守阵地」）' },
  流形蛮冲: { type: '机械', cat: '物攻', power: 95, fixedHit: 50, d: '歼灭形态：威力95，附加50点固定伤害' },
  坚守阵地: { type: '机械', cat: '物攻', power: 75, custom: 'odoShield', d: '护阵形态：威力75，获得50点护盾' },
  全弹发射: { type: '机械', cat: '物攻', power: 145, selfTiredHit: 1, d: '威力145，使用后自身疲惫1回合' },
  自体维修: { type: '机械', cat: '变化', heal: 1 / 4, d: '恢复1/4体力（歼灭形态下变为「全弹搭载」，护阵形态下变为「强效外壳」）' },
  全弹搭载: { type: '机械', cat: '变化', heal: 1 / 4, custom: 'odoBuffAtk', d: '歼灭形态：恢复1/4体力，4回合内自身造成的伤害提升25%' },
  强效外壳: { type: '机械', cat: '变化', heal: 1 / 4, custom: 'odoBuffDef', d: '护阵形态：恢复1/4体力，4回合内自身受到的伤害减少20%' },
  机体引爆: { type: '机械', cat: '变化', hidden: true, custom: 'odoBoom', boom: 100, pp: 5, d: '自爆，对对方造成100点固定伤害（歼灭形态下变为「究极爆破」，护阵形态下变为「重构坚甲」）' },
  究极爆破: { type: '机械', cat: '变化', hidden: true, custom: 'odoBoom', boom: 150, boomDown: 1, pp: 5, d: '歼灭形态：自爆，对对方造成150点固定伤害，并降低对方1级物防、特防' },
  重构坚甲: { type: '机械', cat: '变化', hidden: true, custom: 'odoBoom', boom: 120, boomAlly: 1, pp: 5, d: '护阵形态：自爆，对对方造成120点固定伤害，替换出战的精灵物防、特防提升1级' },
  基要扫描: { type: '机械', cat: '特攻', power: 60, hidden: true, custom: 'odoScan', d: '威力60，提升自身1级命中（歼灭形态下变为「解析导弹」，护阵形态下变为「侵扰投弹」）' },
  解析导弹: { type: '机械', cat: '特攻', power: 65, hidden: true, custom: 'odoMark', d: '歼灭形态：威力65，使对方受到的伤害永久增加10%，最多叠加5层' },
  侵扰投弹: { type: '机械', cat: '特攻', power: 65, hidden: true, custom: 'odoJam', d: '护阵形态：威力65，使对方造成的伤害永久降低8%，最多叠加5层' },
  // —— 光霆主（电 · 光，2026-10-22）
  光辉蚀迹: { type: '光', cat: '特攻', power: 75, custom: 'etch', d: '威力75，叠加一层蚀迹，叠满2层时必定使对方失明2回合；之后对方进入蚀迹冷却（失明期间无法叠加蚀迹）' },
  联觉光晕: { type: '光', cat: '特攻', power: 50, pri: 1, custom: 'copyStages', d: '威力50，先制+1，复制对方的能力上升与下降等级' },
  断觉霆闪: { type: '电', cat: '物攻', power: 95, custom: 'clearSelfDmg', d: '威力95，清空自身的全部能力上升与下降，每清空1级就造成50固定伤害' },
  闪电云: { type: '电', cat: '变化', custom: 'thunderCloud', hidden: true, d: '接下来3回合内每回合末对对方造成100固定伤害' },
  雷明之影: { type: '电', cat: '变化', hidden: true, selfStage: { atk: 1, spa: 1, spe: 1 }, d: '提升1级物攻、特攻、速度' },
  米饭香: { type: '普通', cat: '变化', custom: 'rice3', hidden: true, d: '米饭太香了！连续吃2口米饭，25%几率再吃一口' },
  飞空连击: { type: '飞行', cat: '物攻', power: 10, hits: [6, 10], fixedHit: 5, d: '威力10，连击6-10次，每次攻击附带5点固定伤害' },
  非凡连击: { type: '飞行', cat: '物攻', power: 10, hits: [6, 10], fixedHit: 5, custom: 'riceHits', hidden: true, d: '非同凡响的连击：威力10，连击6-10次，每吃过一口米饭连击数+1（最多15次），每次攻击附带5点固定伤害' },
  // —— 费尔茅斯（火）
  硬化利爪: { type: '普通', cat: '变化', selfStage: { atk: 2, def: 1 }, d: '提升2级物攻、1级物防' },
  爆燃炸弹: { type: '火', cat: '物攻', power: 100, bomb: true, d: '威力100；埋下一颗炸弹，下回合结束时爆炸才造成伤害（即使自己被击倒也会爆炸）' },
  烈焰云: { type: '火', cat: '特攻', power: 95, acc: 70, status: { k: '烧伤', min: 2, max: 4, chance: 1 }, d: '威力95，命中率只有70%；命中后一定使对方烧伤2-4回合' },
  岩洞藏匿: { type: '地面', cat: '变化', pri: 1, custom: 'cave', pp: 10, d: '先制+1；规避本回合受到的攻击，成功规避的话，自身下一次直接攻击的伤害翻倍' },
  烈焰风暴: { type: '火', cat: '特攻', power: 40, hits: [2, 3], custom: 'burnExtend', hidden: true, pp: 10, d: '威力40，随机攻击2-3次；对方烧伤时，每次攻击都让烧伤延长1回合' },
  火灵炸弹: { type: '火', cat: '物攻', power: 100, bomb: true, bombClear: 30, hidden: true, pp: 5, d: '威力100；埋下一颗炸弹，下回合结束时爆炸才造成伤害（即使自己被击倒也会爆炸）；爆炸后清空对方的能力提升，每清除1级附加30点固定伤害' },
  // —— 方头蘑菇（火）
  火球: { type: '火', cat: '特攻', power: 40, d: '威力40' },
  加温: { type: '火', cat: '变化', selfStage: { spa: 1, spd: 1 }, d: '提升1级特攻、特防' },
  旋转冲撞: { type: '普通', cat: '物攻', power: 65, d: '威力65' },
  火焰车: { type: '火', cat: '特攻', power: 95, d: '威力95' },
  净化之焰: { type: '火', cat: '变化', clearTgtUp: true, selfCleanse: true, emblemDown: { atk: -1, spa: -1 }, d: '消除对方的能力提升效果，移除自身的异常状态' },
  回转之焰: { type: '火', cat: '特攻', power: 65, custom: 'lateX2', d: '威力65，后出手时威力翻倍' },
  烈焰冲锋: { type: '火', cat: '物攻', power: 115, recoil: 0.25, d: '威力115，自身受到造成伤害的1/4作为反弹伤害' },
  凝神: { type: '普通', cat: '变化', selfStage: { spa: 2, acc: 1 }, d: '提升2级特攻、1级命中' },
  淬命之焰: { type: '火', cat: '特攻', power: 100, hidden: true, pp: 10, foeNoHeal: 3, d: '威力100，使对方禁疗3回合（无法恢复体力）' },
  余烬涅槃: { type: '火', cat: '变化', pri: 2, hidden: true, pp: 2, heal: 1, selfStage: { spa: 2 }, selfTired: 1, d: '先制+2，恢复全部体力，提升2级特攻，但自身会疲惫（无法行动）1回合' },   // 2026-10-18：由「高温禁锢」改成
  火鸡冲锋: { type: '火', cat: '物攻', power: 100, clearTgtUp: true, clearTgtChance: 0.4, d: '威力100，40%概率消除对方的能力提升效果' },
  白雾: { type: '普通', cat: '变化', custom: 'mist', pp: 10, d: '5回合内免疫能力下降状态' },
  千叶斩: { type: '草', cat: '物攻', power: 85, custom: 'lowHpX2', d: '威力85，自身体力低于1/3时伤害提升100%' },
  草木皆兵: { type: '草', cat: '变化', tgtStage: { atk: -1, spa: -1, def: -1, spd: -1 }, pp: 10, d: '降低对方1级物攻、特攻、物防、特防' },
  盛宴: { type: '普通', cat: '物攻', power: 10, fixedLv: 2, hidden: true, pp: 2, custom: 'feast', d: '威力10，附加等同于自身等级×2的固定伤害；用盛宴击败对方时，恢复本技能全部PP，并且体力上限+50、回复50点体力（可无限叠加）' },
  丛林法则: { type: '草', cat: '变化', hidden: true, custom: 'jungle', pp: 10, d: '3回合内对（体力值与最大体力的比值）低于自己的敌人伤害提升70%' },

  // —— 塞壬（水）
  水泡: { type: '水', cat: '特攻', power: 35, d: '威力35' },
  浪花: { type: '水', cat: '变化', tgtStage: { acc: -1 }, d: '降低对方1级命中' },
  水射线: { type: '水', cat: '特攻', power: 70, d: '威力70' },
  海浪: { type: '水', cat: '特攻', power: 55, tgtStage: { acc: -1 }, d: '威力55，降低对方1级命中' },
  海妖之歌: { type: '超能', cat: '变化', custom: 'siren', pp: 5, d: '5回合后，若对方未击败自己，则对方损失全部体力值（只对唱歌时在场的对手生效，对手换下场就会消失；对「不朽」无效）' },
  寂静之海: { type: '水', cat: '变化', hidden: true, custom: 'silentSea', pp: 10, d: '消除对方所有回合类效果' },
  唤潮之佑: { type: '水', cat: '变化', hidden: true, custom: 'dr40', pp: 10, d: '3回合内受伤减免40%' },

  // —— 骨刃（暗影）
  魔影裂: { type: '暗影', cat: '物攻', power: 70, d: '威力70' },
  碎心刺: { type: '普通', cat: '物攻', power: 80, d: '威力80' },
  夜影封魂: { type: '暗影', cat: '变化', custom: 'weak2', pp: 10, d: '使对方伤害降低30%，持续2回合' },
  碎骨裂髓: { type: '暗影', cat: '变化', custom: 'crit2', pp: 10, d: '下2回合必定致命一击' },
  骨切: { type: '暗影', cat: '物攻', power: 85, custom: 'boneCut', d: '威力85，造成伤害高于200则提升1级速度' },
  不灭之躯: { type: '暗影', cat: '变化', custom: 'endure', pp: 5, d: '下一次受致死攻击时残留1体力' },
  骨斩肉断: { type: '暗影', cat: '变化', hidden: true, selfStage: { atk: 2 }, custom: 'sureHitNext', pp: 10, d: '提升2级物攻，下回合必定命中' },
  寂灭幽映: { type: '暗影', cat: '变化', hidden: true, custom: 'retal', pp: 10, d: '3回合内受到攻击时降低对方1级物攻、特攻、命中' },

  // —— 至高之盾（机械/远古）
  铁拳: { type: '机械', cat: '物攻', power: 50, d: '威力50' },
  盾墙: { type: '机械', cat: '变化', custom: 'halfPhys3', pp: 10, d: '3回合内受到物理伤害减半' },
  董马攻击: { type: '远古', cat: '物攻', power: 70, d: '威力70' },
  董马防御: { type: '远古', cat: '变化', selfStage: { def: 1, spd: 1 }, d: '提升1级物防、特防' },
  董之盾炸碉堡: { type: '远古', cat: '变化', pri: 2, custom: 'bunker', pp: 5, d: '牺牲自己，消除对方能力提升效果，先制+2' },
  坚不可摧: { type: '机械', cat: '变化', custom: 'block100', pp: 10, d: '3回合内每回合抵挡100伤害' },
  勇猛盾击: { type: '机械', cat: '物攻', power: 70, selfStageOne: [{ def: 1 }, { spd: 1 }], d: '威力70，随机提升1级物防或特防' },
  至高剑锋: { type: '机械', cat: '物攻', power: 85, clearSelfDownAtk: true, d: '威力85，解除自身能力下降状态' },
  磁暴反冲: { type: '机械', cat: '变化', custom: 'recoilQ', pp: 10, d: '4回合内受到攻击时，对对方造成75点固定伤害' },
  戳刺: { type: '普通', cat: '物攻', power: 30, hidden: true, tgtStage: { def: -2 }, d: '威力30，降低对方2级物防' },

  // —— 幻境叶果（草/超能）
  盛放: { type: '草', cat: '特攻', power: 75, d: '威力75' },
  幻境汲取: { type: '超能', cat: '特攻', power: 90, drain: 0.5, d: '威力90，造成伤害的一半转化为体力回复' },
  生命折叠: { type: '超能', cat: '变化', custom: 'fold', selfStage: { def: 2, spd: 2 }, pp: 10, d: '损失一半当前体力，提高2级物防、特防' },   // 2026-11-01：原「生命遁迹」
  生命榨取: { type: '草', cat: '特攻', power: 100, drain: 0.5, hidden: true, custom: 'lifeSqueeze', d: '威力100，造成伤害的一半转化为体力回复，若对方寄生则额外吸取对方1/6当前体力值' },
  万灵封印: { type: '超能', cat: '变化', hidden: true, custom: 'seal', pp: 5, d: '5回合内禁止对方提升能力等级，若对方尝试提升能力等级，则使之损失1/4当前体力值' },
  // —— 叶子喵（草 · 光）
  光束: { type: '光', cat: '特攻', power: 45, d: '威力45' },
  谛听: { type: '普通', cat: '变化', custom: 'sure3', pp: 10, d: '3回合内攻击必定命中' },
  光之杖: { type: '光', cat: '变化', selfStage: { spa: 1 }, custom: 'lightStaff', pp: 10, d: '提升1级特攻，并随机提升1级物防或特防（各50%）；使对方2回合内无法恢复体力（禁疗）' },
  闪光飞叶: { type: '草', cat: '特攻', power: 100, custom: 'flashLeaf', pp: 10, d: '威力100，命中后使对方下一次受到攻击时，额外降低其1级命中' },
  灵耳谛听: { type: '普通', cat: '变化', hidden: true, custom: 'ear', pp: 5, d: '3回合内攻击必定命中；期间对方若试图主动闪避（使用提升闪避或闪避攻击的技能），则使其下一次受到的攻击威力翻倍' },
  星星魔法: { type: '光', cat: '特攻', power: 25, hidden: true, custom: 'starMagic', pp: 15, d: '威力25，每使用一次，威力比上一次提升25点，最高125；换下场也会保留。达到最高威力后，命中时有50%概率降低对方1级速度' },
  // —— 巴洛霍尔（普通）：护盾、净化与能力等级锁定
  践踏: { type: '普通', cat: '物攻', power: 10, tgtStage: { def: -1 }, d: '威力10，降低对方1级物防' },
  纯净护盾: { type: '普通', cat: '变化', custom: 'barlowShield', d: '4回合内每回合初获得50点护盾' },
  能量弹: { type: '普通', cat: '物攻', power: 85, fixed: 40, d: '威力85，附加40点固定伤害' },
  纯净领域: { type: '普通', cat: '变化', custom: 'barlowField', d: '5回合内自身在场时，双方能力等级无法变化' },
  纯化: { type: '普通', cat: '特攻', power: 75, custom: 'barlowPurify', hidden: true, d: '威力75，命中后消除对方能力提升，每消除1级恢复自身50点体力' },
  本源之姿: { type: '普通', cat: '变化', custom: 'barlowOrigin', heal: 0.25, hidden: true, d: '恢复1/4最大体力，下2次攻击命中后恢复1/5最大体力' },

  // —— 巴利海雅（普通）：PP消耗与连续施法
  撞击: { type: '普通', cat: '物攻', power: 35, d: '威力35' },
  灵力: { type: '普通', cat: '变化', selfStage: { spa: 1 }, d: '提升自身1级特攻' },
  破防射线: { type: '普通', cat: '特攻', power: 10, tgtStage: { spd: -1 }, d: '威力10，降低对方1级特防' },
  彩色屏障: { type: '普通', cat: '变化', custom: 'baliBarrier', d: '4回合内受到的特殊攻击伤害减半' },
  原力吸收: { type: '普通', cat: '特攻', power: 70, drain: 0.5, custom: 'baliAbsorb', d: '威力70，恢复造成伤害一半的体力，50%概率随机吸取对方1级实际能力' },
  绫彩光束: { type: '普通', cat: '特攻', power: 100, custom: 'baliBeam', d: '威力100，降低对方随机技能2点PP' },
  斑斓之姿: { type: '普通', cat: '变化', custom: 'baliStance', hidden: true, d: '下3次主动攻击拆为威力减半的2次攻击，每次附加完整技能效果' },
  幻想切割: { type: '普通', cat: '特攻', power: 80, custom: 'baliFantasy', hidden: true, d: '威力80，对方技能每缺少1点PP，威力提高5' },

  // —— 查士丁尼（超能）：命运标记与领域
  厄运眷顾: { type: '超能', cat: '特攻', power: 75, custom: 'fateDoom', d: '威力75，命中后使对方获得1层厄运，25%概率额外获得1层' },
  幸运垂降: { type: '超能', cat: '特攻', power: 75, custom: 'fateLuck', d: '威力75，命中后自身获得1层幸运，25%概率额外获得1层' },
  极速: { type: '普通', cat: '变化', selfStage: { spe: 2 }, d: '提升自身2级速度' },
  无常命运: { type: '超能', cat: '变化', custom: 'fateField', pp: 10, d: '展开持续4回合的命运领域。每回合结束时，双方在场精灵同时获得1层幸运或1层厄运，两者概率各为50%；双方获得的标记种类相同' },
  烬燃命运: { type: '火', cat: '特攻', power: 50, custom: 'fateBurn', d: '威力50，命中后清除双方在场精灵的全部幸运与厄运。每清除1层幸运，提升自身1级特攻；每清除1层厄运，降低对方1级特防' },
  逆转命运: { type: '超能', cat: '特攻', power: 80, custom: 'fateSwap', hidden: true, d: '威力80，命中后交换双方在场精灵持有的整组幸运与厄运层数' },
  辩证命运: { type: '超能', cat: '特攻', power: 80, custom: 'fateInvert', hidden: true, d: '威力80，命中后将自身持有的幸运与厄运层数互换' },
  // —— 克莱门蒂（火）
  耀目之曲: { type: '光', cat: '特攻', power: 80, rhythm: 'rhythmLight', d: '威力80，自身附加3回合耀音律，每回合初有60%概率使对方失明1回合' },
  灼灼之音: { type: '火', cat: '特攻', power: 80, rhythm: 'rhythmBurn', d: '威力80，自身附加3回合灼音律，每回合初有60%概率使对方烧伤1回合' },
  眩惑之律: { type: '超能', cat: '特攻', power: 80, rhythm: 'rhythmConfuse', d: '威力80，自身附加3回合惑音律，每回合初有60%概率使对方混乱1回合' },
  星火清籁: { type: '火', cat: '变化', custom: 'clementClean', d: '解除自身能力下降状态，若成功则5回合内免疫能力下降' },
  余烬燃烧: { type: '火', cat: '特攻', power: 90, custom: 'clementEmber', hidden: true, d: '威力90，扣除自身1/5当前体力，附加等量固定伤害' },
  音焚烬灭: { type: '火', cat: '特攻', power: 100, custom: 'clementFinale', hidden: true, d: '威力100，仅能命中存在异常状态的对手，清除对方所有异常状态，每清除一种，吸取对方1级特攻' }
};
(function () {
  for (var n in M) {
    var m = M[n]; m.name = m.name || n; m.pri = m.pri || 0;
    if (m.pp == null) {
      m.pp = m.cat === '变化' ? 15 : m.power >= 140 ? 5 : m.power > 90 ? 10 : m.power > 75 ? 15 : m.power > 50 ? 20 : 30;
    }
  }
})();
// 隐藏技能的学习条件（图鉴原文，都还要求达到 LV50）
// 改过名字的技能：旧名 → 新名（旧存档、旧配招、别人还没更新的存档里还会出现旧名字，读到时换成新名字）
var MOVE_RENAME = { 生命遁迹: '生命折叠', 原力气波: '慈悲气波', 贪能暴涨: '顿悟星盘', 虚空裂变: '刹那灭杀', 寄生种子: '寄生之种', 高温禁锢: '余烬涅槃' };
function moveName(n) { return MOVE_RENAME[n] || n; }
var LEARN = {"烈焰风暴": "用烈焰云击败一名处于烧伤的敌人", "火灵炸弹": "用爆燃炸弹的爆炸击败一名敌人", "淬命之焰": "使用火焰车一次造成超过对方最大体力的伤害", "余烬涅槃": "与同一名敌人交战10回合以上后击败它", "亘古恒压": "在不懈的缠斗中击败对方", "巨龙湮灭破": "让敌人在龙吟崩山震中瓦解", "飞叶风暴": "使用飞叶刀击败一名敌人", "超级吸取": "使用吸取或强力吸取击败一名敌人，并且击败敌人时自身满体力", "灭生之潮": "使用连续的海啸击败敌人", "创生之潮": "使用灵光进行极限的增幅后一击制胜", "溺毙": "在敌人溺水时使用贯穿水枪击败它", "混沌海流": "使用逆流使一名敌人的速度、命中下降6级", "风王结界": "使用香甜气息成功阻挡一次异常状态，并击败对方", "木叶飓风": "使用木叶旋风击败一名敌人", "饮血刀光": "使用黑月刀光强化6级物攻，并使用灵魂之刃击败一名敌人", "黑暗收割": "使用收割击败一名敌人", "狂涛疾刃": "使用怒海疾刺使一名敌人流血，并击败对方", "水纹震击": "使用水打击击败一名敌人", "元神崩坏": "使用自我崩坏后一击制胜", "三相归元": "使用修竹拳、若水拳、燎燃拳后击败敌人", "顿悟星盘": "使用驱使念力后一击制胜", "刹那灭杀": "使用灵光冲击击败一名敌人", "闪电漩涡": "使用闪电烙印麻痹敌人，并击败它", "介电崩坏": "屡次给予对方雷暴的打击", "残月之痕": "使用朔月夺取对方高额物防后一击致胜", "月之暗面": "月神屡次降临后击败敌人", "零度冰破": "在对方冰冻时击碎对方", "急冻打击": "多次使用冰冻打击，让对方不断冰冻", "神秘灵核": "使用神秘之力多次强化后战胜对方", "起源巨刃": "使用起源暴风将对方速度降至最小值后战胜对方", "火山突堑": "使用爆炎斩让敌人在痛苦的燃烧中战败", "烧却": "使用熔化熔尽敌人的护甲后击败对方", "雷击": "使用电磁脉冲使敌人麻痹，并战胜该敌人", "舍身爆破": "使用自爆巨幅削弱敌人", "黑雾潮汐": "使用触手破解敌人的防御后一击制胜", "混沌水域": "使用静谧水域大量恢复后击倒对手", "灭却": "使用凋零之蚀将一名敌人折磨至战斗不能", "以毒攻毒": "在极端严酷的逆境下战胜敌人", "渗透孢子": "在敌人遭受生不如死的异常状态折磨后终结敌人", "盛宴": "使用进食吞吃掉一名防御能力较高的敌人", "丛林法则": "使用多次草木皆兵后残忍地猎杀敌人", "寂静之海": "使用静谧水域恢复大量体力值", "唤潮之佑": "使敌人在浪花与海浪中寸步难行地战败", "骨斩肉断": "削断对方的骨头", "寂灭幽映": "身躯不灭", "戳刺": "以剑与盾配合击败敌人", "生命榨取": "使用幻境汲取吸收大量体力值后击败对方", "万灵封印": "使用生命折叠大幅强化后击败对方"};
var STRUGGLE = { name: '挣扎', type: '普通', cat: '物攻', power: 50, pri: 0, pp: 0, struggle: true, d: '技能PP全部耗尽时使用，自身承受1/4反伤' };
function getMove(n) { return n === '挣扎' ? STRUGGLE : M[n]; }
