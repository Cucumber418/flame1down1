'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});return _;});
const copy=x=>JSON.parse(JSON.stringify(x)),moves=['纯净护盾','纯净领域','纯化','本源之姿'];
function battle(){const S=C.newBattle([{id:'barlow',lv:100,moves},{id:'leaf',lv:100,moves:['飞叶刀']},{id:'fate',lv:100,moves:['幻术']}],[{id:'leaf',lv:100,moves:['飞叶刀','凝神']},{id:'bali',lv:100,moves:['绫彩光束']}]);for(const sd of S.sides)for(const m of sd.team){m.maxhp=1000;m.hp=400;}C.RNG=()=>.5;return S;}
const mon=(S,i=0)=>C.act(S,i),hit=(S,n,i=0)=>C.useMove(S,[],i,C.M[n],-1),status=(S,n,i=0)=>C.doStatus(S,[],i,C.M[n]),end=S=>{C.endOfTurn(S,[]);S.turn++;};
assert.deepEqual(copy(C.SPMAP.barlow.base),{hp:84,atk:106,def:85,spa:80,spd:80,spe:89});assert.equal(Object.values(C.SPMAP.barlow.base).reduce((a,b)=>a+b),524);
assert.deepEqual(copy(C.SPMAP.barlow.types),['普通']);assert.equal(C.SPMAP.barlow.ability.n,'纯净');
for(const [lv,name]of [[1,'巴洛'],[24,'巴洛'],[25,'巴洛恒'],[49,'巴洛恒'],[50,'巴洛霍尔']]){const f=C.ACC.form({sid:'barlow',lv});assert.equal(f.name,name);assert(fs.existsSync(path.join(root,f.img)));}
for(const n of [...C.SPMAP.barlow.moves,...C.SPMAP.barlow.hidden])assert(C.M[n]&&!C.M[n].d.includes('。'),n);
for(const n of C.SPMAP.barlow.hidden){assert(!C.ACC.avail('barlow',49).includes(n));assert(C.ACC.avail('barlow',50).includes(n));}
assert.equal(C.M['纯净护盾'].d,'4回合内每回合初获得50点护盾');
// Physical move effects and the separate fixed-damage packet.
let S=battle();hit(S,'践踏');assert.equal(mon(S,1).stages.def,-1);
S=battle();const base=copy(S);C.useMove(base,[],0,{...C.M['能量弹'],fixed:0},-1);hit(S,'能量弹');assert.equal(mon(S,1).hp,mon(base,1).hp-40);
// Shield: immediate hidden grant, then once per start, stacking; four-turn duration and switching.
S=battle();status(S,'纯净护盾');assert.equal(mon(S).fx.shield,50);assert.equal(mon(S).tm.pureShield,4);C.barlowStart(S,[]);assert.equal(mon(S).fx.shield,50);
for(let turn=2;turn<=4;turn++){end(S);C.barlowStart(S,[]);assert.equal(mon(S).fx.shield,50*turn);C.barlowStart(S,[]);assert.equal(mon(S).fx.shield,50*turn);}
end(S);C.barlowStart(S,[]);assert.equal(mon(S).fx.shield,200);assert(!mon(S).tm.pureShield);
S=battle();status(S,'纯净护盾');C.applyDamage(S,[],0,30,1,{});assert.equal(mon(S).fx.shield,20);assert.equal(mon(S).hp,400);end(S);C.barlowStart(S,[]);assert.equal(mon(S).fx.shield,70);status(S,'纯净护盾');assert.equal(mon(S).fx.shield,120);assert.equal(mon(S).tm.pureShield,4);
C.doSwitch(S,[],0,1,false);C.doSwitch(S,[],0,0,false);assert(!mon(S).tm.pureShield);assert(!mon(S).fx.shield);
S=battle();status(S,'纯净护盾');end(S);mon(S).st['睡眠']=2;C.resolveTurn(S,[{kind:'move',i:2},{kind:'pass'}]);assert.equal(mon(S).fx.shield,100);
// Field locks all seven stages, including clear/copy/transfer/steal; it never clears existing levels.
S=battle();mon(S).stages.atk=3;mon(S).stages.spa=-2;mon(S,1).stages.def=2;mon(S,1).stages.spe=-1;status(S,'纯净领域');assert(C.pureFieldActive(S));
let own=copy(mon(S).stages),foe=copy(mon(S,1).stages);C.changeStages(S,[],0,{atk:1,spa:1,acc:-1},1);C.changeStages(S,[],1,{def:-1,eva:1},0);assert.deepEqual(copy(mon(S).stages),own);assert.deepEqual(copy(mon(S,1).stages),foe);assert.equal(C.clearUps(S,[],1),0);
for(const n of ['联觉光晕','断觉霆闪','巨龙堕天啸','至高剑锋','纯化','迅捷刺击']){mon(S,1).hp=10000;hit(S,n);assert.deepEqual(copy(mon(S).stages),own,n);assert.deepEqual(copy(mon(S,1).stages),foe,n);}
for(const n of ['黑暗之泉','星火清籁','远古意志','朔月','望月']){status(S,n);assert.deepEqual(copy(mon(S).stages),own,n);assert.deepEqual(copy(mon(S,1).stages),foe,n);}assert(!mon(S).tm.mist);
// Clearing own levels cannot manufacture fixed damage while the field prevents the payment.
S=battle();mon(S).stages.atk=2;status(S,'纯净领域');const fixedBase=copy(S);C.useMove(fixedBase,[],0,{...C.M['断觉霆闪'],custom:null},-1);hit(S,'断觉霆闪');assert.equal(mon(S,1).hp,mon(fixedBase,1).hp);assert.equal(mon(S).stages.atk,2);
S=battle();status(S,'纯净领域');for(let t=4;t>=0;t--){end(S);assert.equal(mon(S).tm.pureField||0,t);}assert(!C.pureFieldActive(S));C.changeStages(S,[],1,{atk:1},0);assert.equal(mon(S,1).stages.atk,1);
S=battle();status(S,'纯净领域');C.doSwitch(S,[],0,1,false);assert(!C.pureFieldActive(S));C.changeStages(S,[],1,{atk:1},0);assert.equal(mon(S,1).stages.atk,1);C.doSwitch(S,[],0,0,false);assert(!mon(S).tm.pureField);
S=battle();status(S,'纯净领域');mon(S).fainted=true;assert(!C.pureFieldActive(S));C.changeStages(S,[],1,{atk:1},0);assert.equal(mon(S,1).stages.atk,1);
S=battle();status(S,'纯净领域',1);C.changeStages(S,[],0,{atk:1});assert.equal(mon(S).stages.atk,0);C.changeStages(S,[],1,{atk:1});assert.equal(mon(S,1).stages.atk,0);
// Purification heals per actual positive level removed, including accuracy/evasion; no healing on miss/blocked clears.
S=battle();mon(S,1).stages={atk:2,def:-2,spa:3,spd:0,spe:0,acc:1,eva:1};hit(S,'纯化');assert.equal(mon(S).hp,750);assert.equal(mon(S,1).stages.def,-2);assert.equal(C.posSum(mon(S,1)),0);
S=battle();hit(S,'纯化');assert.equal(mon(S).hp,400);
S=battle();mon(S,1).stages.atk=6;mon(S).hp=900;hit(S,'纯化');assert.equal(mon(S).hp,1000);
S=battle();mon(S,1).stages.atk=2;mon(S).tm.noHeal=2;hit(S,'纯化');assert.equal(mon(S).hp,400);assert.equal(mon(S,1).stages.atk,0);
S=battle();mon(S,1).stages.atk=2;status(S,'纯净领域');hit(S,'纯化');assert.equal(mon(S).hp,400);assert.equal(mon(S,1).stages.atk,2);
S=battle();mon(S,1).stages.atk=2;mon(S,1).fx.absDef=1;hit(S,'纯化');assert.equal(mon(S).hp,400);assert.equal(mon(S,1).stages.atk,2);
S=battle();mon(S,1).stages.atk=2;mon(S,1).hp=1;hit(S,'纯化');assert(mon(S,1).fainted);assert.equal(mon(S).hp,500);
// Origin grants immediate quarter healing and exactly two heals after successful attacks.
S=battle();mon(S).hp=100;status(S,'本源之姿');assert.equal(mon(S).hp,350);assert.equal(mon(S).fx.originHits,2);hit(S,'践踏');assert.equal(mon(S).hp,550);assert.equal(mon(S).fx.originHits,1);status(S,'磨刀');assert.equal(mon(S).fx.originHits,1);hit(S,'践踏');assert.equal(mon(S).hp,750);assert.equal(mon(S).fx.originHits,0);hit(S,'践踏');assert.equal(mon(S).hp,750);
S=battle();status(S,'本源之姿');mon(S,1).fx.absDef=1;hit(S,'能量弹');assert.equal(mon(S).fx.originHits,2);mon(S).stages.acc=-6;C.RNG=()=>.99;hit(S,'能量弹');assert.equal(mon(S).fx.originHits,2);
S=battle();status(S,'本源之姿');mon(S).tm.noHeal=2;const hp=mon(S).hp;hit(S,'践踏');assert.equal(mon(S).hp,hp);assert.equal(mon(S).fx.originHits,1);
S=battle();status(S,'本源之姿');mon(S,1).fx.shield=1000;const shieldHP=mon(S).hp;hit(S,'践踏');assert.equal(mon(S,1).hp,400);assert.equal(mon(S).hp,shieldHP+200);
S=battle();status(S,'本源之姿');C.doSwitch(S,[],0,1,false);C.doSwitch(S,[],0,0,false);assert(!mon(S).fx.originHits);
// Purity only triggers on replacement, cleans allies on the bench, and preserves beneficial marks/status/HP.
function marks(m){m.perm={melt:2,wither:2,miasma:2,odoMark:2,odoJam:2,star:3,rice:2};m.fate={luck:2,doom:2};}
S=battle();for(const sd of S.sides)for(const m of sd.team)marks(m);C.resolveTurn(S,[{kind:'pass'},{kind:'pass'}]);assert.equal(S.sides[0].team[1].perm.melt,2);
C.doSwitch(S,[],0,1,false);marks(S.sides[0].team[1]);S.sides[0].team[2].perm.wither=true;const dead=copy(S.sides[0].team[2]);S.sides[0].team[2].fainted=true;
const beforeHP=S.sides[0].team[1].hp;C.doSwitch(S,[],0,0,false);let bench=S.sides[0].team[1];for(const k of ['melt','wither','miasma','odoMark','odoJam'])assert.equal(bench.perm[k],1);assert.equal(bench.fate.doom,1);assert.equal(bench.fate.luck,2);assert.equal(bench.hp,beforeHP);assert.equal(bench.perm.star,3);assert.equal(mon(S).perm.melt,2);assert.equal(mon(S,1).perm.melt,2);assert.equal(S.sides[0].team[2].perm.wither,true);
S.sides[0].team[2].fainted=false;C.doSwitch(S,[],0,1,false);C.doSwitch(S,[],0,0,false);assert(!S.sides[0].team[2].perm.wither);assert(!bench.perm.melt);assert.equal(bench.fate.doom,0);
// Shared server/PvP snapshots and deterministic replay preserve timers and remaining hit charges.
S=battle();status(S,'纯净护盾');status(S,'纯净领域');status(S,'本源之姿');const snap=C.snap(S);for(const label of ['纯净护盾','纯净领域','本源之姿'])assert(snap.sides[0].chips.some(c=>c.t.includes(label)));
for(const n of [...C.SPMAP.barlow.moves,...C.SPMAP.barlow.hidden])assert(Number.isFinite(C.scoreMove(S,mon(S),mon(S,1),C.M[n])));
assert.equal(C.PVP.spec({sid:'barlow',lv:100,moves,ev:{}}).id,'barlow');const server=require('../server/tx').engine();assert.equal(server.SPMAP.barlow.name,'巴洛霍尔');assert.equal(server.M['纯化'].custom,'barlowPurify');
const initial=copy(S),replay=copy(S);function play(T){let n=0;C.RNG=()=>[.1,.9,.2,.7,.4][n++%5];C.resolveTurn(T,[{kind:'move',i:2},{kind:'move',i:1}]);return copy(T);}assert.deepEqual(play(initial),play(replay));
console.log('PASS barlow: forms/learning/assets, physical/fixed damage, hidden opening shield and duration, complete stage lock/expiry/switch/KO, actual dispel healing, successful-hit charges, bench mark cleansing, snapshots, AI, PvP, server and deterministic replay');
