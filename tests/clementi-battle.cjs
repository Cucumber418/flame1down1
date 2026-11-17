'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});return _;});
const copy=x=>JSON.parse(JSON.stringify(x)),moves=['耀目之曲','灼灼之音','眩惑之律','星火清籁'];
function battle(foe='leaf') {
  const S=C.newBattle([{id:'clementi',lv:100,moves},{id:'leaf',lv:100,moves:['飞叶刀']}],[{id:foe,lv:60,moves:['飞叶刀']}]);
  for(const sd of S.sides)for(const m of sd.team){m.hp=500;m.maxhp=1000;}
  C.RNG=()=>.5;return S;
}
const mon=(S,i=0)=>C.act(S,i),hit=(S,n)=>C.useMove(S,[],0,C.M[n],-1);
function rhythms(S,keys=['rhythmLight','rhythmBurn','rhythmConfuse']){for(const k of keys)mon(S).tm[k]=3;}
assert.deepEqual(copy(C.SPMAP.clementi.base),{hp:108,atk:70,def:88,spa:103,spd:72,spe:94});
assert.deepEqual(copy(C.SPMAP.clementi.types),['火']);assert.equal(C.SPMAP.clementi.ability.n,'终律');
assert.equal(Object.values(C.SPMAP.clementi.base).reduce((a,b)=>a+b),535);
for(const [lv,name]of [[1,'克莱'],[29,'克莱'],[30,'克莱门蒂']]){const f=C.ACC.form({sid:'clementi',lv});assert.equal(f.name,name);assert(fs.existsSync(path.join(root,f.img)));}
for(const n of C.SPMAP.clementi.moves)assert(C.M[n],n);
for(const n of ['余烬燃烧','音焚烬灭']){assert(!C.ACC.avail('clementi',49,[]).includes(n));assert(C.ACC.avail('clementi',50,[]).includes(n));}
// Rhythms belong to the caster, last the next three starts, and never stack.
let S=battle();hit(S,'耀目之曲');assert.equal(mon(S).tm.rhythmLight,3);assert.equal(mon(S,1).tm.rhythmLight,undefined);
C.endOfTurn(S,[]);assert.equal(mon(S).tm.rhythmLight,3);
let rolls=0;C.RNG=()=>{rolls++;return .9;};for(let n=2;n>=0;n--){C.rhythmStart(S,[]);assert.equal(mon(S).tm.rhythmLight||0,n);}
C.rhythmStart(S,[]);assert.equal(rolls,3);
S=battle();hit(S,'耀目之曲');C.rhythmStart(S,[]);hit(S,'耀目之曲');assert.equal(mon(S).tm.rhythmLight,3);
for(const [r,expected]of [[.599,1],[.6,0]]){S=battle();rhythms(S,['rhythmLight']);C.RNG=()=>r;C.rhythmStart(S,[]);assert.equal(mon(S,1).st['失明']||0,expected);}
S=battle();mon(S).stages.acc=-6;C.RNG=()=>.99;hit(S,'灼灼之音');assert.equal(mon(S).tm.rhythmBurn,undefined);
S=battle();mon(S,1).fx.absDef=1;hit(S,'耀目之曲');assert.equal(mon(S).tm.rhythmLight,undefined);
S=battle();mon(S,1).hp=1;hit(S,'耀目之曲');assert(mon(S,1).fainted);assert.equal(mon(S).tm.rhythmLight,3);
// Coda counts actual status applications, extends only this activation, and drains once.
S=battle();rhythms(S);C.rhythmStart(S,[]);assert.deepEqual(copy(mon(S,1).st),{'失明':2,'烧伤':2,'混乱':2});assert.equal(mon(S).hp,580);assert.equal(mon(S,1).hp,420);
assert(Object.keys(C.RHYTHMS).every(k=>!mon(S).tm[k]));C.endOfTurn(S,[]);assert.equal(mon(S,1).st['混乱'],1);C.endOfTurn(S,[]);assert(!mon(S,1).st['混乱']);
S=battle();rhythms(S);let seq=[.1,.9,.1];C.RNG=()=>seq.shift();C.rhythmStart(S,[]);assert.equal(mon(S,1).st['烧伤'],undefined);assert.equal(mon(S,1).st['失明'],2);assert.equal(mon(S).tm.rhythmBurn,undefined);assert.equal(mon(S).hp,580);
S=battle();mon(S).abil={n:'无',d:''};rhythms(S);C.rhythmStart(S,[]);assert.equal(mon(S,1).st['失明'],1);assert.equal(mon(S).tm.rhythmLight,2);assert.equal(mon(S).hp,500);
S=battle('clementi');rhythms(S,['rhythmLight','rhythmBurn']);C.rhythmStart(S,[]);assert.equal(mon(S,1).st['烧伤'],undefined);assert.equal(mon(S,1).st['失明'],1);assert.equal(mon(S).hp,500);
for(const protection of ['immune','reflect']){S=battle();rhythms(S);mon(S,1).tm[protection]=3;C.rhythmStart(S,[]);assert.equal(mon(S).hp,500);assert.deepEqual(copy(mon(S,1).st),{});assert.equal(mon(S).tm.rhythmLight,2);}
S=battle();rhythms(S);mon(S,1).boss={noStatus:1};C.rhythmStart(S,[]);assert.equal(mon(S).hp,500);assert.equal(mon(S).tm.rhythmLight,2);
S=battle();rhythms(S);mon(S,1).st={'失明':3,'烧伤':3,'混乱':3};C.rhythmStart(S,[]);assert.equal(mon(S).hp,500);assert.equal(mon(S,1).st['失明'],3);
S=battle();rhythms(S);mon(S).tm.noHeal=2;C.rhythmStart(S,[]);assert.equal(mon(S).hp,500);assert.equal(mon(S,1).hp,420);
S=battle();rhythms(S);mon(S,1).hp=20;mon(S,1).fx.shield=100;mon(S,1).boss={fixRes:.9};C.rhythmStart(S,[]);assert.equal(mon(S).hp,520);assert.equal(mon(S,1).hp,0);assert.equal(mon(S,1).fx.shield,100);
S=battle();rhythms(S);C.doSwitch(S,[],0,1,false);C.doSwitch(S,[],0,0,false);assert(Object.keys(C.RHYTHMS).every(k=>!mon(S).tm[k]));
// Purification grants protection only after clearing actual negative stages.
S=battle();mon(S).stages.spa=2;mon(S).stages.spe=-3;mon(S).stages.acc=-1;C.doStatus(S,[],0,C.M['星火清籁']);assert.equal(mon(S).stages.spa,2);assert.equal(mon(S).stages.spe,0);assert.equal(mon(S).stages.acc,0);assert.equal(mon(S).tm.mist,5);
C.changeStages(S,[],0,{spa:-1},1);assert.equal(mon(S).stages.spa,2);mon(S).tm.mist=2;C.doStatus(S,[],0,C.M['星火清籁']);assert.equal(mon(S).tm.mist,2);
S=battle();C.doStatus(S,[],0,C.M['星火清籁']);assert.equal(mon(S).tm.mist,undefined);
// Ember pays current HP, including on a main-hit KO; blocked hits cost nothing.
S=battle();let baseline=copy(S);C.useMove(baseline,[],0,{...C.M['余烬燃烧'],custom:null},-1);hit(S,'余烬燃烧');assert.equal(mon(S).hp,400);assert.equal(mon(S,1).hp,mon(baseline,1).hp-100);
S=battle();mon(S).hp=1;hit(S,'余烬燃烧');assert.equal(mon(S).hp,1);assert(!mon(S).fainted);
S=battle();mon(S,1).hp=1;hit(S,'余烬燃烧');assert(mon(S,1).fainted);assert.equal(mon(S).hp,400);
S=battle();mon(S,1).fx.absDef=1;hit(S,'余烬燃烧');assert.equal(mon(S).hp,500);
S=battle();mon(S).fx.shield=100;mon(S).boss={fixRes:.9};hit(S,'余烬燃烧');assert.equal(mon(S).hp,400);assert.equal(mon(S).fx.shield,100);
// Finale requires a real abnormal status, removes each kind once, and steals actual stages.
S=battle();hit(S,'音焚烬灭');assert.equal(mon(S,1).hp,500);mon(S,1).fate={doom:2,luck:0};hit(S,'音焚烬灭');assert.equal(mon(S,1).hp,500);
function finale(){const T=battle();mon(T,1).hp=mon(T,1).maxhp=10000;mon(T,1).st={'失明':2,'烧伤':2,'中毒':3};mon(T,1).fx.poison=3;mon(T,1).fate={luck:1,doom:2};return T;}
S=finale();hit(S,'音焚烬灭');assert.deepEqual(copy(mon(S,1).st),{});assert.equal(mon(S,1).fx.poison,undefined);assert.equal(mon(S).stages.spa,3);assert.equal(mon(S,1).stages.spa,-3);assert.deepEqual(copy(mon(S,1).fate),{luck:1,doom:2});
S=finale();mon(S,1).tm.mist=3;hit(S,'音焚烬灭');assert.deepEqual(copy(mon(S,1).st),{});assert.equal(mon(S).stages.spa,0);assert.equal(mon(S,1).stages.spa,0);
S=finale();mon(S).stages.spa=5;mon(S,1).stages.spa=-5;hit(S,'音焚烬灭');assert.equal(mon(S).stages.spa,6);assert.equal(mon(S,1).stages.spa,-6);
S=finale();mon(S,1).stages.spa=-6;hit(S,'音焚烬灭');assert.equal(mon(S).stages.spa,0);
S=finale();mon(S).tm.noBoost=3;hit(S,'音焚烬灭');assert.equal(mon(S).stages.spa,0);assert.equal(mon(S,1).stages.spa,-3);
// Start-phase KO does not consume attack PP or strike a fainted target.
S=battle();rhythms(S);mon(S,1).hp=20;let pp=mon(S).moves[0].pp;C.resolveTurn(S,[{kind:'move',i:0},{kind:'move',i:0}]);assert.equal(S.over,'win');assert.equal(mon(S).moves[0].pp,pp);
S=battle();S.sides[1].team.push(copy(S.sides[0].team[1]));rhythms(S);mon(S,1).hp=20;pp=mon(S).moves[0].pp;C.resolveTurn(S,[{kind:'move',i:0},{kind:'move',i:0}]);assert(!S.over);assert.equal(S.sides[1].active,1);assert.equal(mon(S).moves[0].pp,pp);
S=battle();rhythms(S);const snapshot=C.snap(S);assert.equal(snapshot.sides[0].chips.filter(x=>/音律/.test(x.t)).length,3);assert.deepEqual(copy(snapshot.sides[0].chips.slice(0,3).map(x=>x.t)),['耀音律 3','灼音律 3','惑音律 3']);
let original=copy(S),replayed=copy(S);function play(T){let n=0;C.RNG=()=>[.1,.9,.2,.7,.4][n++%5];C.resolveTurn(T,[{kind:'move',i:0},{kind:'move',i:0}]);return copy(T);}assert.deepEqual(play(original),play(replayed));
for(const n of [...moves,'余烬燃烧','音焚烬灭'])assert(Number.isFinite(C.scoreMove(S,mon(S),mon(S,1),C.M[n])));
assert.equal(C.PVP.spec({sid:'clementi',lv:100,moves,ev:{}}).id,'clementi');
for(const n of ['逆转命运','辩证命运'])assert(!C.M[n].d.includes('不触发'));
console.log('PASS clementi: species/forms/assets, rhythm timing and chance, actual success/immunity/reflection, coda duration/drain/KO, switching, purification, Ember HP/fixed damage, Finale status/steal/caps, snapshots, PvP, AI and deterministic replay');
