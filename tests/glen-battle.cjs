'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),C=require('../server/tx').engine();
const copy=x=>JSON.parse(JSON.stringify(x)),moves=['破石之蹄','孤高之蹄','孤王之傲','碎震裂踢'];
function battle(foe='leaf') { const S=C.newBattle([{id:'glen',lv:100,moves},{id:'leaf',lv:100,moves:['飞叶刀']}],[{id:foe,lv:100,moves:['扔石块','原力光线','凝神','投掷顽石']},{id:'leaf',lv:100,moves:['飞叶刀']}]);for(const sd of S.sides)for(const m of sd.team){m.maxhp=10000;m.hp=5000;}C.RNG=()=>.5;return S; }
const mon=(S,i=0)=>C.act(S,i),hit=(S,n,i=0)=>C.useMove(S,[],i,C.M[n],-1),status=(S,n,i=0)=>C.doStatus(S,[],i,C.M[n]),end=S=>{C.endOfTurn(S,[]);S.turn++;};
assert.deepEqual(copy(C.SPMAP.glen.base),{hp:114,atk:82,def:100,spa:74,spd:103,spe:70});assert.equal(Object.values(C.SPMAP.glen.base).reduce((a,b)=>a+b),543);assert.deepEqual(copy(C.SPMAP.glen.types),['地面']);assert.equal(C.SPMAP.glen.ability.n,'孤傲');
for(const [lv,n]of [[1,'格伦'],[29,'格伦'],[30,'莫格伦'],[100,'莫格伦']]){const f=C.ACC.form({sid:'glen',lv});assert.equal(f.name,n);assert(fs.existsSync(path.join(__dirname,'..',f.img)));}
for(const n of [...C.SPMAP.glen.moves,...C.SPMAP.glen.hidden]){assert(C.M[n]&&!C.M[n].d.includes('。'));assert(C.M[n].pp>0);}
for(const n of C.SPMAP.glen.hidden){assert(!C.ACC.avail('glen',49,[]).includes(n));assert(C.ACC.avail('glen',50,[]).includes(n));}
assert.equal(C.M['旋转冲撞'].power,65);assert.equal(C.M['践踏'].power,10);assert(!C.RANK_ROSTER.some(m=>m.id==='glen'));
// Stone mark affects only the named move, stays when the user leaves, and clears with its target.
let S=battle();assert.equal(C.movePower(mon(S),mon(S,1),C.M['破石之蹄']),60);hit(S,'破石之蹄');assert(mon(S,1).fx.stoneMark);assert.equal(C.movePower(mon(S),mon(S,1),C.M['破石之蹄']),120);hit(S,'破石之蹄');assert(mon(S,1).fx.stoneMark);assert.equal(C.movePower(mon(S),mon(S,1),C.M['扔石块']),50);C.doSwitch(S,[],0,1,false);assert(mon(S,1).fx.stoneMark);C.doSwitch(S,[],1,1,false);C.doSwitch(S,[],1,0,false);assert(!mon(S,1).fx.stoneMark);
S=battle();mon(S,1).fx.absDef=1;hit(S,'破石之蹄');assert(!mon(S,1).fx.stoneMark);S=battle();mon(S).stages.acc=-6;C.RNG=()=>.99;hit(S,'破石之蹄');assert(!mon(S,1).fx.stoneMark);
S=battle();status(S,'飞沙');assert.equal(mon(S,1).stages.acc,-1);status(S,'踏雪无痕');assert.equal(mon(S).stages.eva,1);assert.equal(mon(S,1).stages.spe,-1);hit(S,'践踏');assert.equal(mon(S,1).stages.def,-1);
for(const roll of [.2,.8]){S=battle();C.RNG=()=>roll;const ev=[];C.useMove(S,ev,0,C.M['投掷顽石'],-1);assert.equal(ev.filter(e=>e.t==='hit'&&e.side===1).length,roll===.2?2:3);}
// Current, stage-modified defenses determine healing, including on KO; misses and no-heal prevent it.
S=battle();mon(S).stages.def=2;mon(S).stages.spd=1;let expected=Math.floor(C.glenDefense(mon(S))*.1);hit(S,'孤高之蹄');assert.equal(mon(S).hp,5000+expected);
S=battle();mon(S,1).hp=1;expected=Math.floor(C.glenDefense(mon(S))*.1);hit(S,'孤高之蹄');assert(mon(S,1).fainted);assert.equal(mon(S).hp,5000+expected);
S=battle();mon(S).tm.noHeal=2;hit(S,'孤高之蹄');assert.equal(mon(S).hp,5000);S=battle();mon(S,1).fx.absDef=1;hit(S,'孤高之蹄');assert.equal(mon(S).hp,5000);
// Pride is an independent shield: exact first/last-mover expiry and no deletion of other shields.
S=battle();mon(S).fx.shield=50;expected=Math.floor(C.glenDefense(mon(S))*.1);status(S,'孤王之傲');assert.equal(mon(S).stages.atk,1);assert.equal(mon(S).fx.prideShield.hp,expected);C.applyDamage(S,[],0,20,1,{});assert.equal(mon(S).fx.prideShield.hp,expected-20);assert.equal(mon(S).fx.shield,50);end(S);assert(!mon(S).fx.prideShield);assert.equal(mon(S).fx.shield,50);
S=battle();S.turnActed[1]=true;status(S,'孤王之傲');end(S);assert(mon(S).fx.prideShield);end(S);assert(!mon(S).fx.prideShield);
for(const fast of [true,false]){S=battle();mon(S).stats.spe=fast?999:1;C.resolveTurn(S,[{kind:'move',i:2},{kind:'move',i:2}]);assert.equal(!!mon(S).fx.prideShield,!fast);if(!fast){C.resolveTurn(S,[{kind:'pass'},{kind:'pass'}]);assert(!mon(S).fx.prideShield);}}
S=battle();status(S,'孤王之傲');expected=mon(S).fx.prideShield.hp;C.applyDamage(S,[],0,expected+13,1,{});assert.equal(mon(S).hp,4987);assert(!mon(S).fx.prideShield);
// Highland reduces all packets of each of three attacks; misses, control, immunity and dots spend no charge.
S=battle();mon(S).abil={n:'无',d:''};const plain=copy(S);status(S,'高地之王');for(let i=0;i<4;i++){let a=mon(S).hp,b=mon(plain).hp;hit(S,'扔石块',1);hit(plain,'扔石块',1);assert.equal(a-mon(S).hp,i<3?Math.floor((b-mon(plain).hp)*.65):b-mon(plain).hp);assert.equal(mon(S).fx.highlandHits,Math.max(0,2-i));}
S=battle();status(S,'高地之王');hit(S,'投掷顽石',1);assert.equal(mon(S).fx.highlandHits,2);assert.deepEqual(copy(mon(S).fx.glenHits),{phys:1,spec:0});assert(!S.glenAttack);
S=battle();mon(S).abil={n:'无',d:''};status(S,'高地之王');let normal=C.calcDamage(mon(S,1),mon(S),C.M['能量弹'],true,false).dmg;hit(S,'能量弹',1);assert.equal(5000-mon(S).hp,Math.floor(normal*.65)+26);assert.equal(mon(S).fx.highlandHits,2);
S=battle();status(S,'高地之王');mon(S).fx.absDef=1;hit(S,'扔石块',1);status(S,'凝神',1);C.applyDamage(S,[],0,10,null,{indirect:true});assert.equal(mon(S).fx.highlandHits,3);assert(!mon(S).fx.glenHits);mon(S,1).stages.acc=-6;C.RNG=()=>.99;hit(S,'扔石块',1);assert.equal(mon(S).fx.highlandHits,3);
S=battle();status(S,'高地之王');mon(S).boss={tuning:true};hit(S,'扔石块',1);assert.equal(mon(S).fx.highlandHits,3);assert(!mon(S).fx.glenHits);
S=battle();status(S,'高地之王');mon(S).fx.shield=9999;hit(S,'扔石块',1);assert.equal(mon(S).hp,5000);assert.equal(mon(S).fx.highlandHits,2);assert.equal(mon(S).fx.glenHits.phys,1);
// Adaptive ability uses each consecutive group of three attacks and does not count fixed follow-ups twice.
S=battle();for(const n of ['扔石块','原力光线','能量弹'])hit(S,n,1);assert.equal(mon(S).stages.def,1);assert.equal(mon(S).stages.spd,0);assert(!mon(S).fx.glenHits);for(const n of ['原力光线','扔石块','原力光线'])hit(S,n,1);assert.equal(mon(S).stages.spd,1);
S=battle();hit(S,'扔石块',1);C.doSwitch(S,[],0,1,false);C.doSwitch(S,[],0,0,false);assert(!mon(S).fx.glenHits);
S=battle();status(S,'纯净领域');for(let i=0;i<3;i++)hit(S,'扔石块',1);assert.equal(mon(S).stages.def,0);assert(!mon(S).fx.glenHits);
// Fracture stores its full snapshot on the victim, distributes integer remainder exactly and refreshes the larger value.
S=battle();expected=Math.floor(C.glenDefense(mon(S))*.15);hit(S,'碎震裂踢');assert.equal(mon(S,1).fx.fracture.total,expected);let before=mon(S,1).hp;for(let i=0;i<3;i++)end(S);assert.equal(before-mon(S,1).hp,expected);assert(!mon(S,1).fx.fracture);
S=battle();mon(S).stats.def=203;mon(S).stats.spd=204;hit(S,'碎震裂踢');assert.equal(mon(S,1).fx.fracture.total,61);let deltas=[];for(let i=0;i<3;i++){before=mon(S,1).hp;end(S);deltas.push(before-mon(S,1).hp);}assert.deepEqual(deltas,[20,20,21]);
S=battle();hit(S,'碎震裂踢');expected=mon(S,1).fx.fracture.total;end(S);mon(S).stats.def=1;mon(S).stats.spd=1;hit(S,'碎震裂踢');assert.equal(mon(S,1).fx.fracture.total,expected);assert.equal(mon(S,1).fx.fracture.elapsed,0);mon(S).stats.def=1000;hit(S,'碎震裂踢');assert.equal(mon(S,1).fx.fracture.total,150);
S=battle();hit(S,'碎震裂踢');expected=mon(S,1).fx.fracture.total;C.doSwitch(S,[],0,1,false);before=mon(S,1).hp;end(S);assert.equal(before-mon(S,1).hp,Math.floor(expected/3));S.sides[0].team[0].fainted=true;before=mon(S,1).hp;end(S);assert(mon(S,1).hp<before);C.doSwitch(S,[],1,1,false);C.doSwitch(S,[],1,0,false);assert(!mon(S,1).fx.fracture);
S=battle('glen');status(S,'高地之王',1);hit(S,'碎震裂踢');assert.equal(mon(S,1).fx.highlandHits,2);before=mon(S,1).hp;end(S);assert(mon(S,1).hp<before);assert.equal(mon(S,1).fx.highlandHits,2);assert.deepEqual(copy(mon(S,1).fx.glenHits),{phys:1,spec:0});
S=battle();mon(S,1).fx.absDef=1;hit(S,'碎震裂踢');assert(!mon(S,1).fx.fracture);
// Delayed bombs count only at impact, including their extra damage, rather than on planting.
S=battle();status(S,'高地之王');hit(S,'爆燃炸弹',1);assert.equal(mon(S).fx.highlandHits,3);end(S);assert(!mon(S).fx.glenHits);end(S);assert.equal(mon(S).fx.highlandHits,2);assert.deepEqual(copy(mon(S).fx.glenHits),{phys:1,spec:0});assert(!S.glenAttack);
// Shared snapshots, AI, PvP and deterministic turn replay include all persistent mechanics.
S=battle();status(S,'高地之王');status(S,'孤王之傲');hit(S,'破石之蹄');hit(S,'碎震裂踢');let snap=C.snap(S);for(const n of ['孤王之傲','高地之王'])assert(snap.sides[0].chips.some(c=>c.t.includes(n)));for(const n of ['破石印记','碎震'])assert(snap.sides[1].chips.some(c=>c.t.includes(n)));for(const n of [...C.SPMAP.glen.moves,...C.SPMAP.glen.hidden])assert(Number.isFinite(C.scoreMove(S,mon(S),mon(S,1),C.M[n])));
assert.equal(C.PVP.spec({sid:'glen',lv:100,moves,ev:{}}).id,'glen');const initial=copy(S),replayed=copy(S);function play(T){let n=0;C.RNG=()=>[.1,.9,.2,.7,.4][n++%5];C.resolveTurn(T,[{kind:'move',i:3},{kind:'move',i:3}]);return copy(T);}assert.deepEqual(play(initial),play(replayed));assert(!initial.glenAttack);
console.log('PASS glen: species/forms/moves, marks, multi-hits, current-defense healing, isolated timed shields/turn order, three-attack mitigation, adaptive defense, target-owned fracture/refresh/remainder/switching, bomb impact, AI, snapshots, PvP and replay');
