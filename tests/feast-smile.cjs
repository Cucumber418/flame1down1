'use strict';
const assert=require('node:assert/strict'),C=require('../server/tx').engine(),copy=x=>JSON.parse(JSON.stringify(x));
const feast=C.M['盛宴'],smile=C.M['迷之微笑'];
function battle(lv=100,id='kaleo',moves=['盛宴']){const S=C.newBattle([{id,lv,moves}],[{id:'leaf',lv:100,moves:['凝神']}]);for(const sd of S.sides)for(const m of sd.team){m.hp=5000;m.maxhp=10000;m.abil={n:'无',d:''};}C.RNG=()=>.5;return S;}
assert.equal(feast.fixedLv,1.5);assert(feast.d.includes('等级×1.5'));assert(smile.d.includes('等级×1～2.5'));
// Real damage includes the lowered fixed part, rounded to whole HP at all levels.
for(const lv of [1,37,60,100]){const S=battle(lv),control=copy(S);C.useMove(S,[],0,feast,0);C.useMove(control,[],0,{...feast,fixedLv:0,custom:null},0);assert.equal(control.sides[1].team[0].hp-S.sides[1].team[0].hp,Math.floor(lv*1.5));assert.equal(S.sides[0].team[0].moves[0].pp,1);}
// A feast KO still restores PP, raises maximum HP and heals exactly as before.
let S=battle(),me=C.act(S,0),foe=C.act(S,1);foe.hp=C.calcDamage(me,foe,feast,true,false).dmg+1;C.useMove(S,[],0,feast,0);assert(foe.fainted);assert.equal(me.moves[0].pp,me.moves[0].max);assert.equal(me.maxhp,10050);assert.equal(me.hp,5050);
// Random fixed damage reaches both inclusive integer endpoints, including at odd levels.
for(const lv of [1,37,60,100])for(const roll of [0,.25,.5,.999999]){S=battle(lv,'moon',['迷之微笑']);me=C.act(S,0);foe=C.act(S,1);C.RNG=()=>roll;const low=lv,high=Math.floor(lv*2.5),expected=low+Math.floor(roll*(high-low+1));C.useMove(S,[],0,smile,0);assert.equal(5000-foe.hp,expected);assert.equal(me.moves[0].pp,2);}
// Preview and AI evaluation use the mean and must never draw battle randomness.
S=battle(37,'moon',['迷之微笑']);C.RNG=()=>{throw Error('Preview consumed a random roll');};assert.equal(C.fixedAmount(C.act(S,0),C.act(S,1),smile,true),(37+92)/2);assert.equal(C.estAttack(C.act(S,0),C.act(S,1),smile),(37+92)/2);assert(Number.isFinite(C.scoreMove(S,C.act(S,0),C.act(S,1),smile)));
// Fixed damage still uses the common shield and immunity pipeline.
S=battle(100,'moon',['迷之微笑']);C.act(S,1).fx.shield=75;C.RNG=()=>0;C.useMove(S,[],0,smile,0);assert.equal(C.act(S,1).hp,4975);assert.equal(C.act(S,1).fx.shield,0);
S=battle(100,'moon',['迷之微笑']);C.act(S,1).fx.absDef=1;let calls=0;C.RNG=()=>{calls++;return .5;};C.useMove(S,[],0,smile,0);assert.equal(C.act(S,1).hp,5000);assert.equal(calls,1); // Accuracy only; no damage roll for a blocked attack.
// Recorded server random values reproduce the same result and all state changes.
S=battle(100,'moon',['迷之微笑']);const replayed=copy(S),rand=C.TX.recorder();C.RNG=rand;C.useMove(S,[],0,smile,0);C.RNG=C.TX.replay(rand.rolls);C.useMove(replayed,[],0,smile,0);assert.deepEqual(copy(S),copy(replayed));
console.log('PASS feast/smile: level-scaled real damage, feast KO rewards, inclusive random range/odd levels, deterministic AI mean, shields/misses and recorded replay');
