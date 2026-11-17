'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});return _;});
const C=ctx,copy=x=>JSON.parse(JSON.stringify(x)),moves=['厄运眷顾','幸运垂降','无常命运','烬燃命运'];
function battle(a='fate',b='leaf') {const S=C.newBattle([{id:a,lv:100,moves},{id:'leaf',lv:100,moves:['幻术']}],[{id:b,lv:100,moves:['幻术']}]);for(const side of S.sides)for(const m of side.team){m.maxhp=800;m.hp=400;}C.RNG=()=>0.5;return S;}
const mon=(S,i=0)=>C.act(S,i),marks=(S,i=0)=>copy(C.fateState(mon(S,i)));
function gain(S,i,k,n=1){C.gainFate(S,[],i,k,n);}
function hit(S,name,roll=.5){C.RNG=()=>roll;C.useMove(S,[],0,C.M[name],-1);}
function directOnly(S,name,roll=.5){C.RNG=()=>roll;C.useMove(S,[],0,{...C.M[name],custom:null},-1);}
assert.deepEqual(copy(C.SPMAP.fate.base),{hp:120,atk:60,def:70,spa:110,spd:70,spe:100});assert.deepEqual(copy(C.SPMAP.fate.types),['超能']);assert.equal(C.SPMAP.fate.ability.n,'无常');
assert(C.EXTRA_SP.some(s=>s.id==='fate'));assert(!C.SP.some(s=>s.id==='fate'));
for(const [lv,name] of [[1,'fate1'],[24,'fate1'],[25,'fate2'],[49,'fate2'],[50,'fate3']]){let f=C.ACC.form({sid:'fate',lv});assert.equal(f.name,name);assert(fs.existsSync(path.join(root,f.img)));}
assert(!C.ACC.avail('fate',49,[]).includes('逆转命运'));assert(C.ACC.avail('fate',50,[]).includes('逆转命运'));assert(C.ACC.avail('fate',50,[]).includes('辩证命运'));
let S=battle();gain(S,0,'luck');assert.equal(mon(S).hp,500);assert.deepEqual(marks(S),{luck:1,doom:0});
S=battle('leaf','tagore');gain(S,1,'doom');assert.equal(mon(S,1).hp,300);assert.deepEqual(marks(S,1),{luck:0,doom:1}); // Universal, even without 无常.
S=battle();mon(S).fate={luck:2,doom:0};gain(S,0,'luck');assert.equal(mon(S).hp,300);assert.deepEqual(marks(S),{luck:0,doom:1});
S=battle();mon(S).fate={luck:0,doom:2};gain(S,0,'doom');assert.equal(mon(S).hp,500);assert.deepEqual(marks(S),{luck:1,doom:0});
S=battle();mon(S).fate={luck:2,doom:2};gain(S,0,'luck');assert.equal(mon(S).hp,500);assert.deepEqual(marks(S),{luck:1,doom:0});
S=battle();mon(S).fate={luck:1,doom:0};gain(S,0,'luck',2);assert.equal(mon(S).hp,400);assert.deepEqual(marks(S),{luck:0,doom:1});
S=battle();mon(S).hp=50;mon(S).fate={luck:0,doom:2};gain(S,0,'doom');assert.equal(mon(S).fainted,true);assert.equal(mon(S).hp,0);assert.deepEqual(marks(S),{luck:0,doom:3});
S=battle();mon(S).tm.noHeal=3;mon(S).fate={luck:0,doom:2};gain(S,0,'doom');assert.equal(mon(S).hp,300);assert.deepEqual(marks(S),{luck:1,doom:0});
S=battle();mon(S).fx.shield=1000;mon(S).boss={fixRes:.9};gain(S,0,'doom');assert.equal(mon(S).hp,300);assert.equal(mon(S).fx.shield,1000);
S=battle();gain(S,0,'luck',2);C.doSwitch(S,[],0,1,false);assert.equal(C.fateCount(mon(S),'luck'),0);C.doSwitch(S,[],0,0,false);assert.equal(C.fateCount(mon(S),'luck'),2);assert.equal(C.fateCount(mon(battle()),'luck'),0);
S=battle();mon(S).fate={luck:2,doom:1};C.doStatus(S,[],0,C.M['以毒攻毒']);assert.deepEqual(marks(S),{luck:2,doom:1});
// 25% is a single extra-layer roll; hit damage remains unchanged.
for(const [roll,n] of [[.249,2],[.25,1],[.5,1]]){S=battle();let baseline=copy(S);directOnly(baseline,'厄运眷顾',roll);hit(S,'厄运眷顾',roll);assert.equal(mon(S,1).hp,mon(baseline,1).hp-100*n);assert.equal(C.fateCount(mon(S,1),'doom'),n);}
S=battle();hit(S,'幸运垂降',.1);assert.equal(mon(S).hp,600);assert.deepEqual(marks(S),{luck:2,doom:0});
S=battle();mon(S,1).hp=1;hit(S,'幸运垂降',.5);assert.equal(mon(S,1).fainted,true);assert.equal(mon(S).hp,500); // Self effect still applies on a KO.
S=battle();mon(S).stages.acc=-6;C.RNG=()=>.99;C.useMove(S,[],0,C.M['幸运垂降'],-1);assert.deepEqual(marks(S),{luck:0,doom:0});assert.equal(mon(S).hp,400);
// Swap/invert/clear are transfers, never fresh gains or conversions.
S=battle();mon(S).fate={luck:2,doom:1};mon(S,1).fate={luck:0,doom:2};let hp=mon(S).hp;hit(S,'逆转命运');assert.equal(mon(S).hp,hp);assert.deepEqual(marks(S),{luck:0,doom:2});assert.deepEqual(marks(S,1),{luck:2,doom:1});assert.notEqual(mon(S).fate,mon(S,1).fate);
hp=mon(S).hp;hit(S,'辩证命运');assert.equal(mon(S).hp,hp);assert.deepEqual(marks(S),{luck:2,doom:0});
S=battle();mon(S).fate={luck:2,doom:1};mon(S,1).fate={luck:1,doom:2};let baseline=copy(S);directOnly(baseline,'烬燃命运');hit(S,'烬燃命运');assert.equal(mon(S).hp,400);assert.equal(mon(S,1).hp,mon(baseline,1).hp);assert.equal(mon(S).stages.spa,3);assert.equal(mon(S,1).stages.spd,-3);assert.deepEqual(marks(S),{luck:0,doom:0});assert.deepEqual(marks(S,1),{luck:0,doom:0});
S=battle();mon(S).fate={luck:2,doom:2};mon(S,1).fate={luck:2,doom:2};mon(S).stages.spa=5;mon(S,1).stages.spd=-5;mon(S,1).hp=mon(S,1).maxhp=80000;hit(S,'烬燃命运');assert.equal(mon(S).stages.spa,6);assert.equal(mon(S,1).stages.spd,-6);
S=battle();mon(S).fate={luck:2,doom:2};mon(S,1).tm.mist=3;mon(S).tm.noBoost=3;hit(S,'烬燃命运');assert.equal(mon(S).stages.spa,0);assert.equal(mon(S,1).stages.spd,0);assert.deepEqual(marks(S),{luck:0,doom:0});
S=battle();C.doStatus(S,[],0,C.M['极速']);assert.equal(mon(S).stages.spe,2);
// Shared field: one random draw per round, four ticks including the cast round, no stacking.
S=battle();C.doStatus(S,[],0,C.M['无常命运']);let calls=0;C.RNG=()=>{calls++;return .9;};for(let n=0;n<4;n++)C.endOfTurn(S,[]);assert.equal(S.fateTurns,0);assert.equal(calls,4);assert.deepEqual(marks(S),marks(S,1));hp=mon(S).hp;C.endOfTurn(S,[]);assert.equal(mon(S).hp,hp);assert.equal(calls,4);
S=battle();C.doStatus(S,[],0,C.M['无常命运']);C.fateTick(S,[]);assert.equal(S.fateTurns,3);C.doStatus(S,[],0,C.M['无常命运']);assert.equal(S.fateTurns,4);C.doSwitch(S,[],0,1,false);C.RNG=()=>.1;C.fateTick(S,[]);assert.equal(C.fateCount(mon(S),'luck'),1);assert.equal(C.fateCount(S.sides[0].team[0],'luck'),0);
S=battle();S.sides[0].team.length=1;mon(S).hp=50;mon(S,1).hp=50;S.fateTurns=1;C.RNG=()=>.9;C.endOfTurn(S,[]);C.checkOver(S,[]);assert.equal(S.over,'draw');
S=battle();mon(S).hp=800;mon(S).fate={luck:2,doom:0};gain(S,0,'luck');assert.equal(mon(S).hp,600); // Healing caps before conversion damage.
S=battle();mon(S).boss={fixRes:.5};C.loseHp(S,[],0,100,'固伤回归检查');assert.equal(mon(S).hp,350); // Existing non-fate fixed damage still respects resistance.
S=battle('fate','tiago');S.parry=[null,{k:'parryTm',ok:0}];C.useMove(S,[],0,C.M['无常命运'],-1);assert.equal(S.fateTurns,undefined);assert.equal(S.parry[1].ok,1);
S=battle();mon(S,1).fx.absDef=1;hit(S,'厄运眷顾');assert.deepEqual(marks(S,1),{luck:0,doom:0});
// Snapshot and persisted battle state carry all counters and remaining turns.
S=battle();mon(S).fate={luck:1,doom:2};S.fateTurns=3;let snapshot=C.snap(S);assert(snapshot.sides[0].chips.some(x=>x.t==='幸运 ×1'));assert(snapshot.sides[0].chips.some(x=>x.t==='厄运 ×2'));assert(snapshot.sides.every(sd=>sd.chips.some(x=>x.t==='命运 3')));assert.deepEqual(marks(copy(S)),marks(S));
let original=copy(S),replayed=copy(S),rolls=[.1,.8,.23,.9,.49,.75];function play(state){let i=0;C.RNG=()=>rolls[i++%rolls.length];C.resolveTurn(state,[{kind:'move',i:0},{kind:'move',i:0}]);return copy(state);}assert.deepEqual(play(original),play(replayed));
const own={sid:'fate',lv:100,moves,ev:{}};assert.equal(C.PVP.spec(own).id,'fate');assert(Number.isFinite(C.scoreMove(S,mon(S),mon(S,1),C.M['无常命运'])));
console.log('PASS fate: species/assets/learning, universal layers, conversion chains, lethal order, healing prevention, exact HP loss, persistence, 25% extra, hit/miss/KO, transfer/invert/burn, caps, shared field timing, draw, snapshots, PvP and deterministic replay');
