'use strict';
const assert=require('node:assert/strict'),E=require('../server/tx').engine(),copy=x=>JSON.parse(JSON.stringify(x));
for(const [attack,types,expected]of[
 ['火',['草','超能'],1.5],['火',['草','冰'],2],['火',['水','龙'],.5],['火',['草','水'],1.25],
 ['地面',['火','飞行'],1],['地面',['草','飞行'],.25],['电',['草','地面'],.25],['电',['水','地面'],1],
 ['普通',['草','超能'],1],['暗影',['光','暗影'],1.25]
]){assert.equal(E.effT(attack,types),expected,attack+' -> '+types.join('/'));assert.equal(E.effT(attack,types.slice().reverse()),expected);}
assert.equal(E.effT('火',[]),1);for(const a of Object.keys(E.TYPE_COLOR))for(const d of Object.keys(E.TYPE_COLOR))assert.equal(E.effT(a,[d]),E.eff(a,d));
assert.equal(E.effT('地面',['飞行']),0);assert.equal(E.effT('电',['地面']),0);assert.equal(E.effT('火',['草']),2);
function battle(target){E.RNG=()=>.5;const S=E.newBattle([{id:'firemouse',lv:60,moves:['火球']}],[{id:target,lv:60,moves:['旋转冲撞']}]);for(const side of S.sides)for(const m of side.team){m.hp=m.maxhp=10000;m.abil={n:'无',d:''};m.stats.atk=m.stats.spa=m.stats.def=m.stats.spd=100;}return S;}
let S=battle('bali');const neutral=E.calcDamage(E.act(S,0),E.act(S,1),E.M['火球'],true,false).dmg;
for(const [target,expected]of[['phantom',1.5],['leaf',2],['siren',.5],['odo',1.25]]){
 S=battle(target);const me=E.act(S,0),foe=E.act(S,1),mv=E.M['火球'],r=E.calcDamage(me,foe,mv,true,false);assert.equal(r.eff,expected);assert(Math.abs(r.dmg-neutral*expected)<=1);assert.equal(E.estAttack(me,foe,mv),r.dmg);const events=[];E.useMove(S,events,0,mv,0);assert.equal(10000-foe.hp,r.dmg);const hit=events.find(e=>e.t==='hit'&&e.side===1&&e.eff!=null);assert(hit);assert.equal(hit.eff,expected);assert(Number.isFinite(E.scoreMove(S,me,foe,mv)));
}
// Battle state and serialized snapshots retain the same dual typing and multiplier after a reload.
S=battle('phantom');const resumed=JSON.parse(E.battleJSON(S,S));for(const state of[S,resumed]){E.RNG=()=>.5;E.useMove(state,[],0,E.M['火球'],0);}assert.deepEqual(copy(S),copy(resumed));assert.deepEqual(copy(E.snap(S).sides[1].types),['草','超能']);
console.log('PASS dual types: fire vs grass/psychic 1.5, double weaknesses/resistances, mixed and zero matchups, type order and single-type stability, real damage/AI/event multipliers, snapshots and deterministic reload');
