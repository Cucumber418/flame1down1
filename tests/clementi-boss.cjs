'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});return _;});
const copy=x=>JSON.parse(JSON.stringify(x)),mon=(S,i=1)=>C.act(S,i),boss=C.PVE.BOSSES.clementi;
function battle(fx={tuning:1,chord:.65},turn=1){const S=C.newBattle([{id:'leaf',lv:100,moves:['慈悲气波','飞叶刀','寄生之种','混沌水域']}],[{id:'clementi',lv:65,maxhp:1000,moves:['耀目之曲','灼灼之音','眩惑之律','星火清籁'],boss:copy(fx)}]);S.turn=turn;mon(S,0).hp=mon(S,0).maxhp=1000;C.RNG=()=>.5;return S;}
assert.equal(boss.planet,'pompeii');assert.equal(boss.region,'pp_city');assert.equal(boss.lv.length,2);
for(const L of boss.lv){assert(L.boss.dr>0);assert(!L.boss.immortal);assert(!L.boss.noStatus);}
assert(!boss.lv[0].boss.tuning);assert(!boss.lv[0].boss.chord);assert.equal(boss.lv[1].boss.chord,.65);
// Tuning: normal and fixed attack damage are direct; status/reflection/end effects are indirect.
let S=battle();mon(S).fx.shield=100;assert.equal(C.applyDamage(S,[],1,150,0,{eff:1}),0);assert.equal(mon(S).hp,1000);assert.equal(mon(S).fx.shield,100);
assert.equal(C.applyDamage(S,[],1,150,0,{}),0);assert.equal(C.loseHp(S,[],1,100,'反伤'),100);assert.equal(mon(S).hp,900);
S=battle({},1);assert.equal(C.applyDamage(S,[],1,100,0,{}),100);assert.equal(C.loseHp(S,[],1,100,'中毒'),100);
S=battle(undefined,2);assert.equal(C.applyDamage(S,[],1,100,0,{}),100);assert.equal(C.loseHp(S,[],1,100,'中毒'),0);assert.equal(C.applyDamage(S,[],1,100,null,{}),0);assert.equal(C.applyDamage(S,[],1,100,0,{indirect:true}),0);
// Chord reduces status and percentage damage once, but not ordinary fixed damage or duration.
S=battle({chord:.65});assert.equal(C.loseHp(S,[],1,100,'因流血受到伤害'),35);assert.equal(C.loseHp(S,[],1,100,'百分比',true,{percent:true}),35);assert.equal(C.applyDamage(S,[],1,100,0,{percent:true}),35);assert.equal(C.applyDamage(S,[],1,100,0,{}),100);
C.addStatus(S,[],1,'睡眠',5,0);assert.equal(mon(S).st['睡眠'],5);C.changeStages(S,[],1,{spd:-2},0);assert.equal(mon(S).stages.spd,-2);
S=battle();mon(S).st['中毒']=3;mon(S).fx.poison=2;C.endOfTurn(S,[]);assert.equal(mon(S).hp,957);assert.equal(mon(S).st['中毒'],2);
S=battle(undefined,2);mon(S).st['中毒']=3;mon(S).fx.poison=2;C.endOfTurn(S,[]);assert.equal(mon(S).hp,1000);assert.equal(mon(S).st['中毒'],2);
// Percentage fate loss, field damage, and leech healing use actual mitigated HP loss.
S=battle();C.gainFate(S,[],1,'doom',1);assert.equal(mon(S).hp,957);
S=battle(undefined,2);C.gainFate(S,[],1,'doom',1);assert.equal(mon(S).hp,1000);assert.equal(C.fateCount(mon(S),'doom'),1);
S=battle();mon(S,0).hp=500;C.doStatus(S,[],0,C.M['混沌水域']);assert.equal(mon(S).hp,930);assert.equal(mon(S,0).hp,570);
S=battle(undefined,2);mon(S,0).hp=500;C.doStatus(S,[],0,C.M['混沌水域']);assert.equal(mon(S).hp,1000);assert.equal(mon(S,0).hp,500);
S=battle();mon(S).tm.hail=0;mon(S,0).tm.hail=2;C.endOfTurn(S,[]);assert.equal(mon(S).hp,965);
// Direct percentage add-on: only the add-on receives Chord, and odd rounds block both parts.
S=battle({chord:.65});mon(S).st['冰冻']=2;let baseline=copy(S);C.useMove(baseline,[],0,{...C.M['零度冰破'],custom:null},-1);C.useMove(S,[],0,C.M['零度冰破'],-1);assert.equal(mon(S).hp,mon(baseline).hp-43);
S=battle();C.useMove(S,[],0,C.M['慈悲气波'],-1);assert.equal(mon(S).hp,1000);
// Resource costs remain costs, including on even rounds. Healing is never damage.
S=battle(undefined,2);C.useMove(S,[],1,C.M['余烬燃烧'],-1);assert.equal(mon(S).hp,800);C.heal(S,[],1,100);assert.equal(mon(S).hp,900);
// One 50% control escape roll per round; no cleansing and no extra attack.
for(const status of Object.keys(C.CANT_ACT))for(const [r,success]of [[.499,true],[.5,false]]){
 S=battle();mon(S).st[status]=3;let rolls=0;C.RNG=()=>{rolls++;return r;};assert.equal(C.cantAct(S,[],mon(S)),!success);assert.equal(mon(S).st[status],3);assert.equal(C.cantAct(S,[],mon(S)),true);assert.equal(rolls,1);S.turn++;assert.equal(C.cantAct(S,[],mon(S)),!success);assert.equal(rolls,2);
}
S=battle();mon(S).st={'睡眠':3,'麻痹':3};C.RNG=()=>.1;let pp=mon(S).moves[0].pp;C.useMove(S,[],1,C.M['耀目之曲'],0);assert.equal(mon(S).moves[0].pp,pp-1);assert.equal(mon(S).tm.rhythmLight,3);assert.equal(mon(S).st['睡眠'],3);
S=battle();mon(S).st['睡眠']=3;C.RNG=()=>.9;pp=mon(S).moves[0].pp;C.useMove(S,[],1,C.M['耀目之曲'],0);assert.equal(mon(S).moves[0].pp,pp);assert.equal(mon(S).tm.rhythmLight,undefined);
// Shared PvE rules: sequential unlock, one-time rewards and repeatable weekly source.
const env={now:Date.UTC(2026,10,17),rand:()=>0},A={mons:[],teams:[[]],active:0,next:1,items:{},exp:0,energy:0,story:{flora1:{done:true}}};
let player=C.ACC.newMon(A,'leaf',70,env);A.teams[0]=[player.u];const B=C.PVE.MODES.boss,W=C.PVE.MODES.weekly,args={k:'clementi',d:0};
assert(B.start(A,{...args,d:1},env).err);assert(W.start(A,args,env).err);let st=B.start(A,args,env);assert(!st.err);assert.equal(st.a[0].maxhp,1000);assert(!st.a[0].boss.tuning);
let outcome={res:'win',seen:[true],downs:[{lv:40}]};let rep=B.end(A,st.ctx,outcome,env);assert(rep.first);assert.equal(A.mons.filter(m=>m.sid==='clementi').length,1);assert.equal(A.items.m_mcry,100);assert(boss.lv[1].open(A,env.now));
st=B.start(A,args,env);rep=B.end(A,st.ctx,outcome,env);assert(!rep.first);assert.equal(A.mons.filter(m=>m.sid==='clementi').length,1);assert.equal(A.items.m_mcry,100);
st=B.start(A,{...args,d:1},env);assert(!st.err);assert.equal(st.a[0].maxhp,3000);assert.equal(st.a[0].boss.chord,.65);assert(!st.a[0].boss.immortal);B.end(A,st.ctx,outcome,env);assert.equal(A.items.fireNote,40);
st=W.start(A,{...args,d:1},env);assert(!st.err);let permits=A.permit.n;W.end(A,st.ctx,{...outcome,res:'lose'},env);assert.equal(A.permit.n,permits);assert.equal(A.items.fireNote,40);
st=W.start(A,{...args,d:1},env);W.end(A,st.ctx,outcome,env);assert.equal(A.items.fireNote,70);assert.equal(A.permit.n,permits-1);
// Exclusive item unlock is per individual, uses 100 notes, and is also the cap currency.
let own=C.ACC.newMon(A,'clementi',40,env),other=C.ACC.newMon(A,'clementi',40,env);A.items.fireNote=200;
assert(!C.ACC.avail('clementi',100,[]).includes('音焚烬灭'));assert.equal(C.TX.run(A,'mitem',{u:player.u,k:'fireNote'},env).ok,false);assert.equal(A.items.fireNote,200);
assert(C.TX.run(A,'mitem',{u:own.u,k:'fireNote'},env).ok);assert.equal(A.items.fireNote,100);assert.equal(own.hl.length,1);assert.equal(other.hl.length,0);assert(C.ACC.avail('clementi',40,own.hl).includes(own.hl[0]));
assert(C.TX.run(A,'mitem',{u:own.u,k:'fireNote'},env).ok);assert.equal(A.items.fireNote,0);A.items.fireNote=100;assert.equal(C.TX.run(A,'mitem',{u:own.u,k:'fireNote'},env).ok,false);assert.equal(A.items.fireNote,100);
own.lv=70;assert.equal(C.GROW.capNext(own).k,'fireNote');A.items.fireNote=500;assert(C.TX.run(A,'lvcap',{u:own.u},env).ok);assert.equal(A.items.fireNote,0);assert.equal(own.lvCap,75);
assert(fs.existsSync(path.join(root,C.SPRITES.clementi)));assert(C.SPRITES.clementi.endsWith('.png'));assert(fs.existsSync(path.join(root,'images/items/fire_note.svg')));
console.log('PASS clementi boss: two difficulties, tuning direct/indirect phases, chord status/percentage reduction, fate/leech/hail/add-ons/costs, control recovery once per round, no immortal, unlocks/first and weekly rewards, exclusive item learning and level caps');
