'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),E=require('../server/tx').engine(),H=E.HIGHLAND,M=E.PVE.MODES.highland,copy=x=>JSON.parse(JSON.stringify(x));
const now=Date.parse('2026-11-25T07:00:00Z'),env={now,rand:()=>.5};
function account(){const a={v:1,name:'高地旅人',introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{},exp:0,energy:0,christmasStory:{cabinOpen:true,cabinIntro:true,shopOpen:true,shopIntro:true,wonderOpen:true,knightIntro:true,knight:{wins:1}}};for(const k of ['school','river','jiuquan'])a.story[k]={done:true,rewarded:true};for(let i=0;i<5;i++){const m=E.ACC.newMon(a,'glen',100,env);a.teams[0].push(m.u);}return a;}
function unlock(a){assert(E.TX.run(a,'highland',{a:'talk',id:'may'},env).ok);assert(H.open(a));assert(E.TX.run(a,'highland',{a:'intro'},env).ok);return a;}
function start(a,options={}){const st=M.start(a,options,env);assert(!st.err,st.err);const S=E.newBattle(st.p,st.a);Object.assign(S,copy(st.S),{noLimit:true});return{st,S};}
const mon=(S,i=0)=>E.act(S,i);
let a=account(),before=copy(a);assert(!H.open(a));assert(M.start(a,{},env).err);assert.deepEqual(copy(a),before);
a.christmasStory.knight.wins=0;assert(!E.TX.run(a,'highland',{a:'talk',id:'oct'},env).ok);a.christmasStory.knight.wins=1;
assert(!E.TX.run(a,'highland',{a:'talk',id:'other'},env).ok);
a.christmasStory.highland={talks:{oct:true}};assert(!H.open(a));assert(!E.TX.run(a,'highland',{a:'intro'},env).ok);assert(M.start(a,{},env).err);
for(const id of H.FRIENDS){const fresh=account();assert(E.TX.run(fresh,'highland',{a:'talk',id},env).unlocked);assert.deepEqual(copy(H.read(fresh).talks),{oct:true,unicorn:true,may:true,ace:true});}
assert(E.TX.run(a,'highland',{a:'talk',id:'ace'},env).unlocked);before=copy(a);assert(E.TX.run(a,'highland',{a:'talk',id:'ace'},env).unlocked);assert.deepEqual(copy(a),before);assert(M.start(a,{},env).err);assert(E.TX.run(a,'highland',{a:'intro'},env).ok);
let{st,S}=start(a,{level:1,hp:1,turns:1,damage:1e9});assert.equal(mon(S,1).lv,50);assert.equal(mon(S,1).hp,1000000);assert.equal(S.worldBoss.limit,20);assert.equal(H.day(a,now).used,0);assert(fs.existsSync(path.join(__dirname,'..',E.BG.hl_highland)));
// Every status is blocked; percentage damage is blocked through both damage entry points and real skills.
for(const k of Object.keys(E.ST_DESC))E.addStatus(S,[],1,k,3,0);assert.deepEqual(copy(mon(S,1).st),{});
assert.equal(E.applyDamage(S,[],1,500000,0,{percent:true}),0);assert.equal(E.loseHp(S,[],1,200000,'按比例扣血',true,{percent:true}),0);assert.equal(S.worldBoss.damage,0);
E.doStatus(S,[],0,E.M['混沌水域']);assert.equal(mon(S,1).hp,1000000);assert.equal(S.worldBoss.damage,0);
// Count actual post-shield HP damage, including fixed damage, with no subtraction for boss healing or self-costs.
mon(S,1).fx.shield=100;E.applyDamage(S,[],1,150,0,{});assert.equal(S.worldBoss.damage,50);E.heal(S,[],1,50);assert.equal(S.worldBoss.damage,50);E.loseHp(S,[],1,30,'碎震',true);assert.equal(S.worldBoss.damage,80);E.applyDamage(S,[],1,10,1,{cost:true});assert.equal(S.worldBoss.damage,80);
const mercy=start(a);mon(mercy.S,1).hp=1;E.useMove(mercy.S,[],0,E.M['慈悲气波'],-1);assert.equal(mon(mercy.S,1).hp,1);assert.equal(mercy.S.worldBoss.damage,0);
// Surviving round 20 completes exactly once even though the ordinary PVE timer is unlimited.
S=E.newBattle(st.p,st.a);Object.assign(S,copy(st.S),{noLimit:true});for(let i=0;i<19;i++){E.resolveTurn(S,[{kind:'pass'},{kind:'pass'}]);assert(!S.over);}E.applyDamage(S,[],1,2500,0,{});E.resolveTurn(S,[{kind:'pass'},{kind:'pass'}]);assert.equal(S.turn,21);assert.equal(S.over,'win');assert(S.worldBoss.finished);
let r=M.end(a,st.ctx,{res:S.over,quit:false,S},env);assert(r.counted);assert.equal(r.damage,2500);assert.equal(r.reward.highlandPt,40);assert.equal(a.items.highlandPt,40);assert.equal(a.exp,r.reward.exp);before=copy(a);assert(!M.end(a,st.ctx,{res:S.over,quit:false,S},env).counted);assert.deepEqual(copy(a),before);
// Retreat, defeat (including on the last round), void and incomplete results spend no allowance or score.
for(const [res,quit]of[['lose',true],['lose',false],['void',false],['flee',true],['win',false]]){const b=start(a);b.S.worldBoss.damage=999999;before=copy(H.day(a,now));const total=H.read(a).total;assert(!M.end(a,b.st.ctx,{res,quit,S:b.S},env).counted);assert.deepEqual(copy(H.day(a,now)),before);assert.equal(H.read(a).total,total);}
let b=start(a);b.S.turn=20;b.S.sides[0].team.forEach(m=>{m.fainted=true;m.hp=0;});E.resolveTurn(b.S,[{kind:'pass'},{kind:'pass'}]);assert.equal(b.S.over,'lose');assert(!M.end(a,b.st.ctx,{res:'lose',quit:false,S:b.S},env).counted);
// Early KO counts only remaining HP, not overkill, and reloading a serialized battle preserves counters.
b=start(a);E.applyDamage(b.S,[],1,1000100,0,{});E.checkOver(b.S,[]);assert.equal(b.S.worldBoss.damage,1000000);assert.equal(b.S.over,'win');assert(M.end(a,b.st.ctx,{res:'win',quit:false,S:copy(b.S)},env).counted);
for(let i=H.day(a,now).used;i<5;i++){b=start(a);b.S.worldBoss.finished=true;b.S.worldBoss.damage=100;assert(M.end(a,b.st.ctx,{res:'win',quit:false,S:b.S},env).counted);}assert.equal(H.day(a,now).used,5);assert(M.start(a,{},env).err);
const tomorrow=Date.parse('2026-11-25T16:00:00Z');assert.equal(H.day(a,tomorrow).used,0);assert(!M.start(a,{}, {...env,now:tomorrow}).err);
for(const [damage,points]of [[0,40],[1,40],[999,40],[1000,40],[1100,40],[2500,40],[3999,40],[4000,40],[4100,41],[9999,99],[10000,100],[1000000,100]])assert.equal(H.rewards(damage).highlandPt,points);assert.deepEqual(copy(H.rewards(0)),{highlandPt:40,exp:0,xmasCandy:0});
const zero=unlock(account()),z=start(zero);z.S.worldBoss.finished=true;const zr=M.end(zero,z.st.ctx,{res:'win',quit:false,S:z.S},env);assert(zr.counted);assert.equal(zr.reward.highlandPt,40);assert.equal(H.day(zero,now).used,1);
// Both currencies are charged atomically, exact quantities and duplicate purchases are intentional.
a=unlock(account());a.items={xmasBell:20,highlandPt:2500};
for(const n of [0,-1,1.5,'1',null,Infinity,1000]){before=copy(a);assert(!E.TX.run(a,'highland',{a:'buy',id:'essence',n},env).ok);assert.deepEqual(copy(a),before);}
assert(E.TX.run(a,'highland',{a:'buy',id:'essence',n:2},env).ok);assert.deepEqual(copy(a.items),{xmasBell:0,highlandPt:500,e_glen:2});
before=copy(a);assert(!E.TX.run(a,'highland',{a:'buy',id:'essence',n:1},env).ok);assert.deepEqual(copy(a),before);
assert(E.TX.run(a,'highland',{a:'buy',id:'talent',n:2},env).ok);assert.equal(a.items.ivGlen,2);assert.equal(a.items.highlandPt,100);
assert(E.GROW.itemFits('ivGlen',a.mons[0]));assert(!E.GROW.itemFits('ivGlen',{sid:'barlow'}));assert(E.GROW.applyMonItem(a,'ivGlen',a.mons[0],null,()=>.5).ok);assert.equal(a.items.ivGlen,1);
assert(E.TX.run(a,'hatch',{a:'put',i:0,k:'e_glen'},env).ok);assert(!E.TX.run(a,'hatch',{a:'hatch',i:0},env).ok);const hatch=E.TX.run(a,'hatch',{a:'hatch',i:0},{...env,now:now+480*60000});assert(hatch.ok);assert.equal(E.ACC.mon(a,hatch.u).sid,'glen');assert.equal(E.ACC.mon(a,hatch.u).lv,1);
console.log('PASS highland: single council story gate from any of four NPCs, authoritative LV50/1M/20-round boss, status/percentage immunity, actual damage counter, early KO, failed/quit/void exclusion, daily reset/cap, idempotent settlement, 40–100 damage-scaled recognition and zero-damage completion minimum, atomic batch exchange, species-only talent and hatch');
