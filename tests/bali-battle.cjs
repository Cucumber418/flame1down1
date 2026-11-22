'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});return _;});
const copy=x=>JSON.parse(JSON.stringify(x)),moves=['原力吸收','绫彩光束','斑斓之姿','幻想切割'];
function battle(foe='leaf'){
 const S=C.newBattle([{id:'bali',lv:100,moves},{id:'leaf',lv:100,moves:['飞叶刀']}],[{id:foe,lv:100,moves:['飞叶刀','凝神','原力光线','透明射线']}]);
 for(const sd of S.sides)for(const m of sd.team){m.hp=500;m.maxhp=10000;} C.RNG=()=>.5; return S;
}
const mon=(S,i=0)=>C.act(S,i),hit=(S,n,i=0,slot=-1,extra=false)=>C.useMove(S,[],i,C.M[n],slot,extra),stance=S=>C.doStatus(S,[],0,C.M['斑斓之姿']);
assert.deepEqual(copy(C.SPMAP.bali.base),{hp:85,atk:75,def:80,spa:115,spd:85,spe:95});
assert.deepEqual(copy(C.SPMAP.bali.types),['普通']);assert.equal(C.SPMAP.bali.ability.n,'绫彩');
assert.equal(Object.values(C.SPMAP.bali.base).reduce((a,b)=>a+b),535);
for(const [lv,name]of [[1,'巴利'],[24,'巴利'],[25,'巴利恒'],[49,'巴利恒'],[50,'巴利海雅']]){const f=C.ACC.form({sid:'bali',lv});assert.equal(f.name,name);assert(fs.existsSync(path.join(root,f.img)));}
for(const n of [...C.SPMAP.bali.moves,...C.SPMAP.bali.hidden])assert(C.M[n]&&!C.M[n].d.includes('。'),n);
for(const n of C.SPMAP.bali.hidden){assert(!C.ACC.avail('bali',49).includes(n));assert(C.ACC.avail('bali',50).includes(n));}
// Four-turn barrier halves special attack damage, leaving physical and fixed damage alone.
let S=battle(),a=mon(S),b=mon(S,1);const spec=C.calcDamage(b,a,C.M['原力光线'],true,true).dmg,phys=C.calcDamage(b,a,C.M['飞叶刀'],true,true).dmg;
C.doStatus(S,[],0,C.M['彩色屏障']);assert.equal(a.tm.halfSpec,4);assert(Math.abs(C.calcDamage(b,a,C.M['原力光线'],true,true).dmg-spec/2)<=1);assert.equal(C.calcDamage(b,a,C.M['飞叶刀'],true,true).dmg,phys);
let hp=a.hp;C.applyDamage(S,[],0,40,1,{});assert.equal(a.hp,hp-40);for(let n=3;n>=0;n--){C.endOfTurn(S,[]);assert.equal(a.tm.halfSpec||0,n);}
// Ability observes actual losses on either side, includes ordinary use, and pays only once.
S=battle();a=mon(S);b=mon(S,1);let pp=b.moves[1].pp;hit(S,'凝神',1,1);assert.equal(b.moves[1].pp,pp-1);assert.equal(a.hp,500);C.endOfTurn(S,[]);assert.equal(a.hp,515);C.endOfTurn(S,[]);assert.equal(a.hp,515);
S=battle('bali');hit(S,'绫彩光束',0,1);assert.equal(mon(S,1).fx.rainbowPP,1);assert.equal(mon(S).fx.rainbowPP,2);C.endOfTurn(S,[]);assert.equal(mon(S).hp,530);assert(mon(S,1).hp<=515);
S=battle();b=mon(S,1);b.moves.forEach(sl=>sl.pp=0);b.moves[3].pp=1;hit(S,'绫彩光束');assert.equal(b.moves[3].pp,0);C.endOfTurn(S,[]);assert.equal(mon(S).hp,515);hit(S,'绫彩光束');assert(b.moves.every(sl=>sl.pp===0));C.endOfTurn(S,[]);assert.equal(mon(S).hp,515);
S=battle();b=mon(S,1);pp=b.moves[0].pp;hit(S,'绫彩光束');b.moves[2].pp=b.moves[2].max;mon(S).tm.noHeal=2;C.endOfTurn(S,[]);assert.equal(mon(S).hp,500);delete mon(S).tm.noHeal;C.endOfTurn(S,[]);assert.equal(mon(S).hp,500);
S=battle();b=mon(S,1);b.boss={ppInf:true};pp=b.moves[1].pp;hit(S,'凝神',1,1);assert.equal(b.moves[1].pp,pp);C.endOfTurn(S,[]);assert.equal(mon(S).hp,500);
// Faster PP depletion cancels a queued skill; it cannot fire for free or spend a stance charge.
S=battle();a=mon(S);b=mon(S,1);a.stats.spe=999;b.moves=[{n:'凝神',pp:1,max:C.M['凝神'].pp}];b.fx.prismAttacks=3;
C.resolveTurn(S,[{kind:'move',i:1},{kind:'move',i:0}]);assert.equal(b.moves[0].pp,0);assert.equal(b.stages.spa,0);assert.equal(b.fx.prismAttacks,3);assert.equal(a.hp,515);
for(const boss of [{ppInf:true},{immortal:true}]){S=battle();mon(S,1).boss=boss;const beforePP=C.missingPP(mon(S,1));hit(S,'绫彩光束');assert.equal(C.missingPP(mon(S,1)),beforePP);C.endOfTurn(S,[]);assert.equal(mon(S).hp,500);}
S=battle();mon(S,1).boss={immortal:true,ppLim:true};hit(S,'绫彩光束');assert.equal(C.missingPP(mon(S,1)),2);
S=battle();b=mon(S,1);C.spendPP(S,[],1,0,2);b.moves[0].pp=b.moves[0].max;C.endOfTurn(S,[]);assert.equal(mon(S).hp,530);
S=battle();mon(S).hp=mon(S).maxhp-1;hit(S,'绫彩光束');C.endOfTurn(S,[]);assert.equal(mon(S).hp,mon(S).maxhp);
// Missing PP is a current sum over all equipped moves, including recovery and depleted slots.
S=battle();a=mon(S);b=mon(S,1);assert.equal(C.movePower(a,b,C.M['幻想切割']),80);b.moves[0].pp-=3;b.moves[1].pp-=2;assert.equal(C.movePower(a,b,C.M['幻想切割']),105);b.moves[0].pp++;assert.equal(C.movePower(a,b,C.M['幻想切割']),100);
// Drain uses dealt damage; 50% stat steal excludes accuracy/evasion and respects protection/caps.
S=battle();C.RNG=()=>.1;hp=mon(S,1).hp;hit(S,'原力吸收');assert.equal(mon(S).hp,500+Math.floor((hp-mon(S,1).hp)/2));assert.equal(mon(S).stages.atk,1);assert.equal(mon(S,1).stages.atk,-1);assert.equal(mon(S).stages.acc,0);
S=battle();C.RNG=()=>.5;hit(S,'原力吸收');assert.equal(mon(S).stages.spa,0);
for(const protection of ['mist']){S=battle();C.RNG=()=>.1;mon(S,1).tm[protection]=3;hit(S,'原力吸收');assert.equal(mon(S).stages.atk,0);assert.equal(mon(S,1).stages.atk,0);}
S=battle();C.RNG=()=>.1;mon(S,1).stages.atk=-6;hit(S,'原力吸收');assert.equal(mon(S).stages.atk,0);
// Stance repeats complete effects, while charging one PP and one of three attacks.
S=battle();stance(S);pp=mon(S).moves[1].pp;const before=C.missingPP(mon(S,1));hit(S,'绫彩光束',0,1);assert.equal(C.missingPP(mon(S,1))-before,4);assert.equal(mon(S).moves[1].pp,pp-1);assert.equal(mon(S).fx.prismAttacks,2);C.endOfTurn(S,[]);assert.equal(mon(S).hp,560);
hit(S,'灵力');assert.equal(mon(S).fx.prismAttacks,2);hit(S,'破防射线');assert.equal(mon(S,1).stages.spd,-2);hit(S,'破防射线');assert.equal(mon(S,1).stages.spd,-4);assert.equal(mon(S).fx.prismAttacks,0);hit(S,'破防射线');assert.equal(mon(S,1).stages.spd,-5);
S=battle();stance(S);C.RNG=()=>.1;hit(S,'原力吸收');assert.equal(mon(S).stages.atk,2);assert.equal(mon(S,1).stages.atk,-2);
S=battle();stance(S);const half={...C.M['幻想切割'],prismHalf:true};hp=mon(S,1).hp;const expected=C.calcDamage(mon(S),mon(S,1),half,true,true).dmg;hit(S,'幻想切割');assert(Math.abs(hp-mon(S,1).hp-expected*2)<=2);
// Immobilization/confusion/parry preserve charges, misses consume an attack, extras never do.
S=battle();stance(S);mon(S).st['睡眠']=2;pp=mon(S).moves[1].pp;hit(S,'绫彩光束',0,1);assert.equal(mon(S).fx.prismAttacks,3);assert.equal(mon(S).moves[1].pp,pp);
S=battle();stance(S);mon(S).st['混乱']=2;C.RNG=()=>.1;hit(S,'绫彩光束');assert.equal(mon(S).fx.prismAttacks,3);assert.equal(C.missingPP(mon(S,1)),0);
S=battle();stance(S);S.silenced[0]=true;hit(S,'绫彩光束');assert.equal(mon(S).fx.prismAttacks,3);assert.equal(C.missingPP(mon(S,1)),0);
S=battle('tiago');stance(S);S.parry=[null,{k:'parryAtk',ok:0}];hit(S,'绫彩光束');assert.equal(mon(S).fx.prismAttacks,3);assert.equal(C.missingPP(mon(S,1)),0);
S=battle();stance(S);mon(S).stages.acc=-6;C.RNG=()=>.99;hit(S,'绫彩光束');assert.equal(mon(S).fx.prismAttacks,2);assert.equal(C.missingPP(mon(S,1)),0);
S=battle();stance(S);hit(S,'绫彩光束',0,-1,true);assert.equal(mon(S).fx.prismAttacks,3);assert.equal(C.missingPP(mon(S,1)),2);
S=battle();stance(S);mon(S,1).hp=1;let events=[];C.useMove(S,events,0,C.M['幻想切割'],-1);assert(mon(S,1).fainted);assert.equal(events.filter(e=>e.t==='use').length,1);
S=battle();stance(S);C.doSwitch(S,[],0,1,false);C.doSwitch(S,[],0,0,false);assert(!mon(S).fx.prismAttacks);
// Snapshots, AI, PvP, server loading and deterministic replay see the shared state.
S=battle();stance(S);C.doStatus(S,[],0,C.M['彩色屏障']);const snap=C.snap(S);assert(snap.sides[0].chips.some(x=>x.t.includes('斑斓之姿')));assert(snap.sides[0].chips.some(x=>x.t.includes('特伤减半')));
for(const n of [...C.SPMAP.bali.moves,...C.SPMAP.bali.hidden])assert(Number.isFinite(C.scoreMove(S,mon(S),mon(S,1),C.M[n])));
assert.equal(C.PVP.spec({sid:'bali',lv:100,moves,ev:{}}).id,'bali');
const original=copy(S),replayed=copy(S);function play(T){let n=0;C.RNG=()=>[.1,.9,.2,.7,.4][n++%5];C.resolveTurn(T,[{kind:'move',i:1},{kind:'move',i:1}]);return copy(T);}assert.deepEqual(play(original),play(replayed));
const server=require('../server/tx').engine();assert.equal(server.SPMAP.bali.name,'巴利海雅');assert.equal(server.M['斑斓之姿'].custom,'baliStance');
console.log('PASS bali: forms/assets, special barrier, PP loss/healing/exhaustion/infinite PP, current missing PP, drain/stat steal, complete double effects/one PP/three attacks, status/miss/KO/switch, snapshots, AI, PvP, server and replay');
