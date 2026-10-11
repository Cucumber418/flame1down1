/* ==========================================================
 * 电脑 AI
 * 电脑选技能、换精灵的逻辑
 * ========================================================== */

/* ---------- 电脑 AI ---------- */
function estAttack(me, foe, mv) {
  if (mv.cat === '变化') return 0;
  if (mv.custom === 'poisonHeart' && !(foe.st['中毒'] > 0)) return 0;
  if (mv.fixedOnly) return fixedAmount(me, foe, mv) * hitChance(me, foe, mv);
  if (mv.custom === 'originBlade' && foe.stages.spe <= -6) return foe.hp + 1;
  var d = calcDamage(me, foe, mv, true, true).dmg;
  if (mv.hits) d *= mv.custom === 'fireHits' && foe.st['烧伤'] > 0 ? 9 : (mv.hits[0] + mv.hits[1]) / 2;
  if (mv.custom === 'annihilate') d += foe.hp * Math.min(0.6, 0.05 + 0.1 * negCount(foe));
  return (d + (mv.fixed || 0)) * hitChance(me, foe, mv);
}
function bestEst(me, foe) {
  var b = 0;
  me.moves.forEach(function (s) { if (s.pp > 0) b = Math.max(b, estAttack(me, foe, M[s.n])); });
  return b;
}
var CUSTOM_SCORE = { nextCrit: 18, voidPhys: 22, induct: 16, stealDef: 22, stealAtk: 24, darkside: 26, hail: 28, mystic: 34, noBoostFoe: 12,
  seal: 14, melt: 30, calm: 26, halfPhys5: 22, halfPhys3: 18, chaosWater: 30, wither: 34, swamp: 10, mist: 10, jungle: 22, siren: 36,
  silentSea: 0, dr40: 22, weak2: 18, crit2: 30, endure: 16, sureHitNext: 0, retal: 20, block100: 24, recoilQ: 18, dodgeOne: 18, capacitor: 0 };
function scoreMove(S, me, foe, mv) {
  var hpR = me.hp / me.maxhp, s = 0;
  if (mv.cat !== '变化') {
    var d = estAttack(me, foe, mv);
    if (mv.fixedOnly === 'selfBlast') return d >= foe.hp && hpR < 0.5 ? 210 : (hpR < 0.25 ? d / foe.maxhp * 100 : -50);
    if (d >= foe.hp) return 200 + mv.pri * 60 + hitChance(me, foe, mv) * 20;
    s = d / foe.maxhp * 100;
    if (mv.drain && hpR < 0.6) s += 12;
    if (mv.custom === 'transferDown' && STG.some(function (k) { return me.stages[k] < 0; })) s += 15;
    if (mv.custom === 'tide' && !me.tm.tide) s += 30;
    if (mv.custom === 'vuln' && !foe.tm.vuln) s += 10;
    if (mv.custom === 'weak3' && !foe.tm.weak) s += 10;
    if (mv.custom === 'canyue') s += 6 * Math.min(4, me.flags.canyue || 0);
    if (mv.tgtStage) s += 4;
    if (mv.status && (!foe.st[mv.status.k] || mv.status.k === '中毒') && !(mv.status.k === '流血' && typesOf(foe).indexOf('机械') >= 0)) s += 18 * mv.status.chance;
    return s;
  }
  if (mv.heal) s += hpR < 0.55 ? 75 * (1 - hpR) + 15 : 0;
  if (mv.selfStage) for (var k in mv.selfStage) if (me.stages[k] < 4 && !me.tm.noBoost && !me.tm.seal) s += (hpR > 0.5 ? 16 : 4) * mv.selfStage[k];
  if (mv.selfStage && me.tm.seal > 0) s -= 40;
  if (mv.tgtStage) for (var k2 in mv.tgtStage) if (foe.stages[k2] > -4 && !foe.tm.mist) s += 9 * Math.abs(mv.tgtStage[k2]);
  var stImmune = mv.status && ((mv.status.k === '寄生' && typesOf(foe).indexOf('草') >= 0) || (mv.status.k === '流血' && typesOf(foe).indexOf('机械') >= 0));
  if (mv.status && !stImmune && (!foe.st[mv.status.k] || mv.status.k === '中毒') && !foe.tm.immune && !foe.tm.reflect) s += 38 * mv.status.chance;
  if (stImmune && !mv.tgtStage) s -= 40;
  if (mv.status && foe.tm.reflect) s -= 30;
  var faster = speedOf(me) > speedOf(foe);
  var c = mv.custom;
  switch (c) {
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
    case 'green': s += me.tm.green ? 0 : 40 * (1 - hpR) + 12; break;
    case 'silence': s += faster ? 34 : 0; break;
    case 'rain': s += me.tm.rain ? 0 : 26; break;
    case 'boostNext': s += me.fx.boostNext ? 0 : 14; break;
    case 'selfBreak': s += hpR > 0.65 && me.stages.atk < 4 ? 38 : 0; break;
    case 'selfBreak2': s += hpR > 0.65 && !me.fx.sureCrit ? 52 : 0; break;
    case 'tri': s += me.tm.tri ? 0 : (hpR < 0.6 ? 45 : 12); break;
    case 'selfDestruct': case 'bunker': s += hpR < 0.2 ? 40 + (c === 'bunker' ? posSum(foe) * 12 : 0) : -60; break;
    case 'burnout': s += foe.perm.melt > 0 && foe.perm.melt < 5 ? 50 : -60; break;
    case 'melt': s += (foe.perm.melt || 0) < 5 ? CUSTOM_SCORE.melt : -40; break;
    case 'wither': s += foe.perm.wither ? -40 : CUSTOM_SCORE.wither; break;
    case 'silentSea': s += Object.keys(foe.tm).length * 12; break;
    case 'purge': s += negCount(me) * 15 - (hpR < 0.4 ? 40 : 10); break;
    case 'siren': s += me.tm.siren ? -40 : (hpR > 0.5 ? 36 : 10); break;
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
  if (mv.clearSelfDown) { var neg = 0; STG.forEach(function (k) { if (me.stages[k] < 0) neg -= me.stages[k]; }); s += neg * 14; }
  return s;
}
// 电脑难度参数：randomP 乱出招概率；noise 估分噪声；switchP 考虑换人的概率；dumbRepl 倒下后随便换
var AI_DEFAULT = { randomP: 0, noise: 0.15, switchP: 0.3, dumbRepl: false };
function aiChoose(S) {
  var me = act(S, 1), foe = act(S, 0), P = S.ai || AI_DEFAULT;
  var usable = []; me.moves.forEach(function (slot, idx) { if (slot.pp > 0 && !moveBlocked(me, slot)) usable.push(idx); });
  if (usable.length && RNG() < P.randomP) return { kind: 'move', i: usable[Math.floor(RNG() * usable.length)] };
  if (!me.tm.noSwitch && !bossOf(S) && RNG() < P.switchP) {   // 首领战里电脑不主动换人（傀儡要打倒才会换回首领）
    var threat = bestEst(foe, me) / Math.max(1, me.hp), mine = bestEst(me, foe) / Math.max(1, foe.hp);
    if (threat >= 1 && mine < 1) {
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
    if (slot.pp <= 0 || moveBlocked(me, slot)) return;
    var v = scoreMove(S, me, foe, M[slot.n]) * (1 - P.noise + RNG() * 2 * P.noise);
    if (!best || v > best.v) best = { v: v, i: idx };
  });
  return { kind: 'move', i: best ? best.i : -1 };
}
function aiPickReplacement(S) {
  var foe = act(S, 0), bestK = aliveIdx(S, 1)[0], bestV = -1e9;
  if (S.ai && S.ai.dumbRepl && RNG() < S.ai.dumbRepl) { var al = aliveIdx(S, 1); return al[Math.floor(RNG() * al.length)]; }
  aliveIdx(S, 1).forEach(function (k) {
    var c = S.sides[1].team[k];
    var v = bestEst(c, foe) / Math.max(1, foe.hp) - bestEst(foe, c) / Math.max(1, c.hp) + RNG() * 0.2;
    if (v > bestV) { bestV = v; bestK = k; }
  });
  return bestK;
}
