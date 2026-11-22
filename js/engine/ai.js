/* ==========================================================
 * 电脑 AI
 * 电脑选技能、换精灵的逻辑
 * ========================================================== */

/* ---------- 电脑 AI ---------- */
function estAttack(me, foe, mv) {
  if (mv.cat === '变化') return 0;
  if (mv.custom === 'clementFinale' && !hasStatus(foe)) return 0;
  if (mv.custom === 'poisonHeart' && !(foe.st['中毒'] > 0)) return 0;
  if (mv.fixedOnly) return fixedAmount(me, foe, mv) * hitChance(me, foe, mv);
  if (mv.custom === 'originBlade' && foe.stages.spe <= -6) return foe.hp + 1;
  var d = calcDamage(me, foe, mv, true, true).dmg;
  if (mv.hits) { var hn = mv.custom === 'fireHits' && foe.st['烧伤'] > 0 ? 9 : mv.custom === 'riceHits' ? Math.min(15, (mv.hits[0] + mv.hits[1]) / 2 + ((me.perm && me.perm.rice) || 0)) : (mv.hits[0] + mv.hits[1]) / 2; d = d * hn + (mv.fixedHit || 0) * hn; }
  if (mv.custom === 'annihilate') d += foe.hp * Math.min(0.6, 0.05 + 0.1 * negCount(foe));
  if (mv.mercy) d = Math.min(d, Math.max(0, foe.hp - 1));   // 慈悲气波打不倒对方
  return (d + addFixed(me, mv)) * hitChance(me, foe, mv);
}
function bestEst(me, foe) {
  var b = 0;
  me.moves.forEach(function (s) { if (s.pp > 0) b = Math.max(b, estAttack(me, foe, M[s.n])); });
  return b;
}
var CUSTOM_SCORE = { nextCrit: 18, voidPhys: 22, induct: 16, stealDef: 22, stealAtk: 24, darkside: 26, hail: 28, mystic: 34, noBoostFoe: 12,
  seal: 14, melt: 30, calm: 26, halfPhys5: 22, halfPhys3: 18, chaosWater: 30, wither: 34, swamp: 10, mist: 10, jungle: 22, siren: 36,
  silentSea: 0, dr40: 22, weak2: 18, crit2: 30, endure: 16, sureHitNext: 0, retal: 20, block100: 24, recoilQ: 18, dodgeOne: 18, capacitor: 0, rice: 16, rice3: 34 };
function scoreMove(S, me, foe, mv) {
  var hpR = me.hp / me.maxhp, s = 0, locked = pureFieldActive(S);
  if (mv.cat !== '变化') {
    var d = estAttack(me, foe, mv);
    if (mv.fixedOnly === 'selfBlast') return d >= foe.hp && hpR < 0.5 ? 210 : (hpR < 0.25 ? d / foe.maxhp * 100 : -50);
    if (d >= foe.hp) return 200 + mv.pri * 60 + hitChance(me, foe, mv) * 20;
    s = d / foe.maxhp * 100;
    if (mv.drain && hpR < 0.6) s += 12;
    if (mv.custom === 'transferDown' && STG.some(function (k) { return me.stages[k] < 0; })) s += 15;
    if (mv.custom === 'baliBeam' && missingPP(foe) < foe.moves.reduce(function (n, sl) { return n + sl.max; }, 0)) s += ability(me) === '绫彩' ? 12 : 5;
    if (mv.custom === 'baliAbsorb' && !locked) s += 5;
    if (mv.rhythm && !me.tm[mv.rhythm]) s += ability(me) === '终律' ? 24 : 14;
    if (mv.custom === 'clementEmber') s += Math.floor(me.hp / 5) / foe.maxhp * 70 - (hpR < 0.3 ? 15 : 3);
    if (mv.custom === 'clementFinale' && !hasStatus(foe)) return -100;
    if (mv.custom === 'clementFinale') s += 8 * Object.keys(foe.st).filter(function (k) { return foe.st[k] > 0 && ST_DESC[k]; }).length;
    if (mv.custom === 'fateLuck') s += (fateCount(me, 'luck') === 2 ? -10 : hpR < 0.85 ? 15 : 0);
    if (mv.custom === 'fateDoom') s += fateCount(foe, 'doom') === 2 ? -8 : 15;
    if (mv.custom === 'fateBurn') s += 7 * Math.min(6 - me.stages.spa, fateCount(me, 'luck') + fateCount(foe, 'luck')) + 5 * Math.min(6 + foe.stages.spd, fateCount(me, 'doom') + fateCount(foe, 'doom'));
    if (mv.custom === 'fateInvert' && fateCount(me, 'luck') === 2 && fateCount(me, 'doom') < 2) s += 10; // 避免下次获得幸运时立即转化反噬
    if (mv.custom === 'tide' && !me.tm.tide) s += 30;
    if (mv.custom === 'vuln' && !foe.tm.vuln) s += 10;
    if (mv.custom === 'weak3' && !foe.tm.weak) s += 10;
    if (mv.custom === 'canyue') s += 6 * Math.min(4, me.flags.canyue || 0);
    if (mv.custom === 'barlowPurify' && !locked) s += Math.min(45, posSum(foe) * (hpR < 0.8 ? 12 : 6));
    if (mv.tgtStage && !locked) s += 4;
    if (mv.status && (!foe.st[mv.status.k] || mv.status.k === '中毒') && !(mv.status.k === '流血' && typesOf(foe).indexOf('机械') >= 0)) s += 18 * mv.status.chance;
    return s;
  }
  if (mv.heal || mv.healLost) s += hpR < 0.4 ? (mv.healLost ? 30 : 45) * (1 - hpR) + 6 : 0;   // 2026-10-24：电脑少用回血技能（原来体力 55% 以下就积极回血）
  if (mv.selfStage && !locked) for (var k in mv.selfStage) if (me.stages[k] < 4 && !me.tm.noBoost && !me.tm.seal) s += (hpR > 0.5 ? 16 : 4) * mv.selfStage[k];
  if (mv.selfStage && me.tm.seal > 0) s -= 40;
  if (mv.selfStageOne && !locked && !me.tm.noBoost && !me.tm.seal) s += hpR > 0.5 ? 8 : 2;
  if (mv.tgtStage && !locked) for (var k2 in mv.tgtStage) if (foe.stages[k2] > -4 && !foe.tm.mist) s += 9 * Math.abs(mv.tgtStage[k2]);
  var stImmune = mv.status && ((mv.status.k === '寄生' && typesOf(foe).indexOf('草') >= 0) || (mv.status.k === '流血' && typesOf(foe).indexOf('机械') >= 0));
  if (mv.status && !stImmune && (!foe.st[mv.status.k] || mv.status.k === '中毒' || (mv.status.refresh && foe.st[mv.status.k] <= 2)) && !foe.tm.immune && !foe.tm.reflect) s += 38 * mv.status.chance;
  if (stImmune && !mv.tgtStage) s -= 40;
  if (mv.clearTgtUp && !locked && mv.cat === '变化') { var up = 0; STG.forEach(function (k) { if (foe.stages[k] > 0) up += foe.stages[k]; }); s += up ? 14 * up : -25; }
  if (mv.status && foe.tm.reflect) s -= 30;
  var faster = speedOf(me) > speedOf(foe);
  var c = mv.custom;
  switch (c) {
    case 'barlowShield': s += me.tm.pureShield ? -20 : 24; break;
    case 'barlowField': s += locked ? -20 : (foe.moves.some(function (sl) { var m = M[sl.n]; return sl.pp > 0 && m && (m.selfStage || m.tgtStage); }) ? 24 : 5); break;
    case 'barlowOrigin': s += me.fx.originHits ? -15 : 16; break;
    case 'baliBarrier': s += me.tm.halfSpec ? -20 : (foe.moves.some(function (sl) { return sl.pp > 0 && M[sl.n] && M[sl.n].cat === '特攻'; }) ? 24 : -10); break;
    case 'baliStance': s += me.fx.prismAttacks ? -20 : (hpR > 0.4 ? 30 : 8); break;
    case 'clementClean': s += !locked && STG.some(function (k) { return me.stages[k] < 0; }) ? 30 : -20; break;
    case 'stealAtk': case 'stealDef': s += locked ? -20 : CUSTOM_SCORE[c]; break;
    case 'fateField': s += S.fateTurns > 0 ? -10 : 16; break;
    case 'sure3': s += me.tm.sure3 || me.tm.ear ? -20 : 10; break;
    case 'ear': s += me.tm.ear ? -20 : 16; break;
    case 'lightStaff': s += foe.tm.noHeal ? 4 : 14; break;
    case 'nilin': s += me.tm.cap ? 0 : 28; break;
    case 'genggu': s += me.tm.genggu ? 0 : 45; break;
    case 'shield': s += me.fx.shield ? 0 : 24; break;
    case 'noSwitch': s += foe.tm.noSwitch ? 0 : 8; break;
    case 'priorityUp': s += me.tm.prio ? 0 : (faster ? 6 : 26); break;
    case 'dodge': s += me.tm.dodge ? 0 : 24; break;
    case 'absDef': s += me.fx.absDef ? 0 : 26; break;
    case 'immune': s += me.tm.immune ? 0 : 12; break;
    case 'reflect': s += me.tm.reflect ? 0 : 22; break;
    case 'green': s += me.tm.green || hpR >= 0.5 ? 0 : 25 * (1 - hpR); break;
    case 'silence': s += faster ? 34 : 0; break;
    case 'rain': s += me.tm.rain ? 0 : 26; break;
    case 'boostNext': s += me.fx.boostNext ? 0 : 14; break;
    case 'selfBreak': s += hpR > 0.65 && me.stages.atk < 4 ? 38 : 0; break;
    case 'selfBreak2': s += hpR > 0.65 && !me.fx.sureCrit ? 52 : 0; break;
    case 'tri': s += me.tm.tri ? 0 : (hpR < 0.6 ? 45 : 12); break;
    case 'selfDestruct': case 'bunker': s += hpR < 0.2 ? 40 + (c === 'bunker' ? posSum(foe) * 12 : 0) : -60; break;
    case 'burnout': s += foe.perm.melt > 0 && foe.perm.melt < 5 ? 50 : -60; break;
    case 'melt': s += (foe.perm.melt || 0) < 5 ? CUSTOM_SCORE.melt : -40; break;
    case 'wither': s += witherN(foe) >= WITHER_MAX ? -40 : CUSTOM_SCORE.wither * Math.max(0.35, 1 - 0.15 * witherN(foe)); break;   // 可以叠加，叠得越多收益越低
    case 'silentSea': s += Object.keys(foe.tm).length * 12; break;
    case 'purge': s += negCount(me) * 15 - (hpR < 0.4 ? 40 : 10); break;
    case 'siren': s += foe.tm.sirenOn || (foe.boss && foe.boss.immortal) ? -40 : (hpR > 0.5 ? 36 : 10); break;
    case 'chaosWater': s += foe.hp / foe.maxhp * 30; break;
    case 'nextCrit': s += me.fx.sureCrit ? -20 : 18; break;
    case 'darkside': if (me.tm.darkside > 0) { var lt = effT('光', typesOf(foe)), dk = effT('暗影', typesOf(foe)); s += lt > dk ? 30 : -30; } else s += CUSTOM_SCORE.darkside; break;
    default:
      if (c && CUSTOM_SCORE[c] != null) {
        var tmKey = { voidPhys: 'voidPhys', induct: 'induct', darkside: 'darkside', hail: 'hail', calm: 'calm', halfPhys5: 'halfPhys', halfPhys3: 'halfPhys', swamp: 'swamp', mist: 'mist', jungle: 'jungle', dr40: 'dr40', crit2: 'crit2', retal: 'retal', block100: 'block', recoilQ: 'recoil' }[c];
        var foeKey = { noBoostFoe: 'noBoost', seal: 'seal', weak2: 'weak' }[c];
        if ((tmKey && me.tm[tmKey]) || (foeKey && foe.tm[foeKey]) || (c === 'endure' && me.fx.endure) || (c === 'dodgeOne' && me.fx.absDef)) s -= 20;
        else s += CUSTOM_SCORE[c];
        if (c === 'calm') s += 30 * (1 - hpR);
      }
  }
  if (mv.clearSelfDown && !locked) { var neg = 0; STG.forEach(function (k) { if (me.stages[k] < 0) neg -= me.stages[k]; }); s += neg * 14; }
  return s;
}
// 电脑难度参数：randomP 乱出招概率；noise 估分噪声；switchP 考虑换人的概率；dumbRepl 倒下后随便换
var AI_DEFAULT = { randomP: 0.12, noise: 0.3, switchP: 0.3, dumbRepl: false };
// 2026-10-19：所有电脑都笨一点——至少 12% 的回合随便放招，估分噪声至少 ±30%（不会每回合都选最优技能）
var AI_DUMB = { randomP: 0.12, noise: 0.3 };
function aiChoose(S) {
  var me = act(S, 1), foe = act(S, 0), P0 = S.ai || AI_DEFAULT, P = {};
  for (var pk in P0) P[pk] = P0[pk];
  P.randomP = Math.max(P.randomP || 0, AI_DUMB.randomP); P.noise = Math.max(P.noise || 0, AI_DUMB.noise);
  // 2026-10-21：BOSS / 每周挑战的泰戈尔前两回合不用自我崩坏、元神崩坏
  var early = me.boss && me.id === 'tagore' && S.turn <= 2, healCd = me.boss && me.boss.healCd && S.bossHealAt != null && S.turn - S.bossHealAt < me.boss.healCd;
  // 2026-11-01：所有 PVE 的 BOSS（每周挑战、BOSS 挑战、剧情 BOSS 等带 boss 的对手）几乎不用百分比回复的变化技能（吸水、光合作用等），只有 5% 的回合会考虑
  var noPctHeal = !S.pvp && me.boss && RNG() >= 0.05;
  var pctHeal = function (slot) { var mv = M[slot.n]; return !!(mv && mv.cat === '变化' && mv.heal && !mv.custom); };
  var banned = function (slot) { return (early && (slot.n === '自我崩坏' || slot.n === '元神崩坏')) || (healCd && M[slot.n] && M[slot.n].heal) || (noPctHeal && pctHeal(slot)); };   // healCd：回血技能隔这么多回合才能再用
  // 2026-10-24：BOSS奥多亚克（简单 / 普通）从第 2 回合起每 2 回合切换一次形态；困难难度三只是固定形态，不带形态技能
  if (me.boss && me.boss.neb) {   // 玫瑰星云（第十九段）：每 5 回合放一次强烈恒星风，其余回合用氢-α发射线
    var want = S.nebP3 != null && (S.turn - S.nebP3) % 5 === 0 ? 'O型星超温辐射' : S.turn % 5 === 0 ? '强烈恒星风' : '氢-α发射线', ni = me.moves.findIndex(function (slot) { return slot.n === want; });
    if (ni >= 0) return { kind: 'move', i: ni };
  }
  if (me.boss && me.id === 'odo' && S.turn >= 2 && S.turn % 2 === 0) {
    var oi = me.moves.findIndex(function (slot) { return slot.n === '歼灭形态' && slot.pp > 0 && !moveBlocked(me, slot); });
    if (oi >= 0) return { kind: 'move', i: oi };
  }
  var usable = []; me.moves.forEach(function (slot, idx) { if (slot.pp > 0 && !moveBlocked(me, slot) && !banned(slot)) usable.push(idx); });
  if (usable.length && RNG() < P.randomP) return { kind: 'move', i: usable[Math.floor(RNG() * usable.length)] };
  if (!me.tm.noSwitch && !bossOf(S) && !S.ordered && RNG() < P.switchP) {   // ordered：按顺序上场的对战（明明教官的试炼）不主动换人   // BOSS战里电脑不主动换人（傀儡要打倒才会换回BOSS）
    var threat = bestEst(foe, me) / Math.max(1, me.hp), mine = bestEst(me, foe) / Math.max(1, foe.hp);
    if (threat >= (P.threat || 1) && mine < 1) {
      var bestK = -1, bestV = -1e9;
      aliveIdx(S, 1).forEach(function (k) {
        if (k === S.sides[1].active) return;
        var c = S.sides[1].team[k], v = bestEst(c, foe) / foe.hp - bestEst(foe, c) / c.hp;
        if (v > bestV) { bestV = v; bestK = k; }
      });
      if (bestK >= 0 && bestEst(foe, S.sides[1].team[bestK]) < S.sides[1].team[bestK].hp * 0.6) return { kind: 'switch', to: bestK };
    }
  }
  var best = null;
  me.moves.forEach(function (slot, idx) {
    if (slot.pp <= 0 || moveBlocked(me, slot) || banned(slot)) return;
    var v = scoreMove(S, me, foe, M[slot.n]) * (1 - P.noise + RNG() * 2 * P.noise);
    if (!best || v > best.v) best = { v: v, i: idx };
  });
  if (!best && noPctHeal) { noPctHeal = false; me.moves.forEach(function (slot, idx) { if (!best && slot.pp > 0 && !moveBlocked(me, slot) && !banned(slot)) best = { v: 0, i: idx }; }); }   // 只剩回复技能可用时照样用
  return { kind: 'move', i: best ? best.i : -1 };
}
function aiPickReplacement(S) {
  if (S.ordered || S.sides[1].team.some(function (t) { return t.boss && t.boss.orderRepl; })) return aliveIdx(S, 1)[0];   // 按顺序上场（奥多亚克困难：歼灭 → 护阵 → 虹霓暴走）
  var foe = act(S, 0), bestK = aliveIdx(S, 1)[0], bestV = -1e9;
  if (S.ai && S.ai.dumbRepl && RNG() < S.ai.dumbRepl) { var al = aliveIdx(S, 1); return al[Math.floor(RNG() * al.length)]; }
  aliveIdx(S, 1).forEach(function (k) {
    var c = S.sides[1].team[k];
    var v = bestEst(c, foe) / Math.max(1, foe.hp) - bestEst(foe, c) / Math.max(1, c.hp) + RNG() * 0.2;
    if (v > bestV) { bestV = v; bestK = k; }
  });
  return bestK;
}
