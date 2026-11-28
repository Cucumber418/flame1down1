'use strict';
const assert=require('node:assert/strict'),E=require('../server/tx').engine();
function battle(){const S=E.newBattle([{id:'firemouse',lv:60,moves:['爆燃炸弹','火灵炸弹']},{id:'leaf',lv:60,moves:['撞击']}],[{id:'leaf',lv:60,moves:['爆燃炸弹','火灵炸弹']},{id:'squid',lv:60,moves:['撞击']}]);for(const side of S.sides)for(const m of side.team){m.maxhp=20000;m.hp=20000;}E.RNG=()=>.5;return S;}
for(const name of ['爆燃炸弹','火灵炸弹'])for(const from of [0,1]){
 const S=battle(),plant=[];E.useMove(S,plant,from,E.M[name],-1);assert.equal(S.bombs.length,1);assert(plant.some(e=>e.t==='use'&&e.move===name&&!e.bomb));assert(!plant.some(e=>e.bomb));
 const early=[];E.endOfTurn(S,early);assert(!early.some(e=>e.bomb));S.turn++;
 E.doSwitch(S,[],from,1,false);E.doSwitch(S,[],1-from,1,false);const owner=S.sides[from].team[0];owner.fainted=true;owner.hp=0;
 if(name==='火灵炸弹')E.act(S,1-from).stages.atk=2;
 const hp=E.act(S,1-from).hp,evs=[];E.endOfTurn(S,evs);const blast=evs.filter(e=>e.t==='use'&&e.bomb);assert.equal(blast.length,1);assert.equal(blast[0].side,from);assert.equal(blast[0].target,1-from);assert.equal(blast[0].move,name);assert.equal(blast[0].type,'火');assert.equal(blast[0].snap.sides[from].id,from===0?'leaf':'squid');assert.equal(blast[0].snap.sides[1-from].id,from===0?'squid':'leaf');assert(E.act(S,1-from).hp<hp);assert.equal(S.bombs.length,0);
 if(name==='火灵炸弹')assert.equal(E.act(S,1-from).stages.atk,0);
}
// Both sides may detonate at the same end, and a blocked blast still has a target-side presentation event.
let S=battle();E.useMove(S,[],0,E.M['爆燃炸弹'],-1);E.useMove(S,[],1,E.M['火灵炸弹'],-1);S.turn=2;let evs=[];E.endOfTurn(S,evs);assert.deepEqual(evs.filter(e=>e.bomb).map(e=>[e.side,e.target,e.move]),[[0,1,'爆燃炸弹'],[1,0,'火灵炸弹']]);
S=battle();E.useMove(S,[],0,E.M['爆燃炸弹'],-1);S.turn=2;E.act(S,1).onlyHit=['水'];const hp=E.act(S,1).hp;evs=[];E.endOfTurn(S,evs);assert(evs.some(e=>e.bomb&&e.target===1));assert.equal(E.act(S,1).hp,hp);
console.log('PASS bomb presentation events: planting unchanged, delayed detonation target, both sides, switched target/caster, fainted caster, added damage/boost clearing, simultaneous and blocked explosions');
