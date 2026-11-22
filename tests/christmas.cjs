'use strict';
const assert=require('node:assert/strict'),E=require('../server/tx').engine();
const now=Date.parse('2026-11-22T05:00:00Z'),env={now,rand:()=>0},copy=x=>JSON.parse(JSON.stringify(x));
function account(open=true){const a={name:'圣诞旅人',next:1,exp:0,energy:0,mons:[],teams:[[]],active:0,items:{},story:{}};if(open)for(const k of ['school','river','jiuquan'])a.story[k]={done:true};return a;}
let a=account(false);for(const args of [{a:'visit'},{a:'claim',id:'hello'},{a:'all'},{a:'buy',id:'cap1',n:1}])assert.equal(E.TX.run(a,'christmas',args,env).ok,false);
a=account();const before=copy(a);E.CHRISTMAS.read(a,now);assert.deepEqual(a,before);
assert.equal(E.TX.run(a,'christmas',{a:'claim',id:'hello'},env).ok,false);
assert(E.TX.run(a,'signin',{},env).ok);assert.equal(E.CHRISTMAS.read(a,now).progress.signin,1);
assert(E.CHRISTMAS.sceneOpen(a,0));assert(!E.CHRISTMAS.sceneOpen(a,1));assert(!E.CHRISTMAS.sceneOpen(a,2));
assert(E.TX.run(a,'christmas',{a:'door'},env).needsBarlow);
const barlow=E.ACC.newMon(a,'barlow',5,env);assert(E.TX.run(a,'christmas',{a:'door'},env).needsBarlow); // warehouse is insufficient
assert.equal(E.TX.run(a,'christmas',{a:'shopHint'},env).ok,false);
a.teams[0]=[barlow.u];assert(E.TX.run(a,'christmas',{a:'door'},env).cabinOpen);assert.equal(a.mons.length,1);assert(E.CHRISTMAS.sceneOpen(a,1));assert(!E.CHRISTMAS.sceneOpen(a,2));
assert(E.TX.run(a,'christmas',{a:'cabinIntro'},env).ok);assert(E.TX.run(a,'christmas',{a:'visit'},env).ok);
E.QST.pveHits(a,'wild',{downs:1,res:'win'},now);
assert(E.TX.run(a,'christmas',{a:'claim',id:'hello'},env).ok);assert.equal(a.items.xmasBell,1);assert.equal(a.items.xmasCandy,8);
assert(E.TX.run(a,'christmas',{a:'claim',id:'hello'},env).already);assert.equal(a.items.xmasCandy,8);
assert.equal(E.TX.run(a,'christmas',{a:'all'},env).ok,false);
E.QST.pveHits(a,'wild',{downs:3,res:'win'},now);E.QST.pveHits(a,'wild',{downs:1,res:'win'},now);
assert(E.CHRISTMAS.TASKS.every(t=>(a.christmas.progress[t.id]||0)>=t.n));
assert(E.TX.run(a,'christmas',{a:'all'},env).ok);assert(E.TX.run(a,'christmas',{a:'all'},env).already);
for(const t of E.CHRISTMAS.TASKS)assert(E.TX.run(a,'christmas',{a:'claim',id:t.id},env).ok);
assert.equal(a.items.xmasBell,7);assert.equal(a.items.xmasCandy,70);assert.equal(a.items.g_core,1);
assert(E.TX.run(a,'christmas',{a:'shopHint'},env).ok);assert(E.CHRISTMAS.sceneOpen(a,2));assert.equal(E.TX.run(a,'christmas',{a:'buy',id:'cap1',n:1},env).ok,false);assert(E.TX.run(a,'christmas',{a:'shopIntro'},env).ok);
let r=E.TX.run(a,'christmas',{a:'buy',id:'cap1',n:4},env);assert(r.ok);assert.equal(a.items.cap1,4);assert.equal(a.items.xmasCandy,50);
r=E.TX.run(a,'christmas',{a:'buy',id:'formDev',n:1},env);assert(r.ok);assert.equal(a.items.formDev,1);assert.equal(a.items.xmasBell,1);
for(const n of [0,-1,1.5,'2',null,Infinity,1000]){const b=copy(a);assert.equal(E.TX.run(a,'christmas',{a:'buy',id:'formDev',n},env).ok,false);assert.deepEqual(copy(a),b);}
const b=copy(a);assert.equal(E.TX.run(a,'christmas',{a:'buy',id:'formDev',n:1},env).ok,false);assert.deepEqual(copy(a),b);
assert.equal(E.TX.run(a,'christmas',{a:'buy',id:'not-an-item',n:1},env).ok,false);
// Currencies persist across days, tasks and all-complete rewards reset at Beijing midnight.
const next=Date.parse('2026-11-22T16:00:00Z');assert.equal(E.CHRISTMAS.read(a,next).day,'2026-11-23');assert.equal(E.CHRISTMAS.read(a,next).all,false);assert.equal(a.items.xmasCandy,50);assert(E.CHRISTMAS.sceneOpen(a,1));assert(E.CHRISTMAS.sceneOpen(a,2));
assert.equal(E.TX.run(a,'christmas',{a:'all'},{...env,now:next}).ok,false);assert.equal(E.TX.run(a,'christmas',{a:'claim',id:'wild'},{...env,now:next}).ok,false);
console.log('PASS Christmas: Earth/active-backpack Barlow/cabin/task/shop story gates, read-only preview, real sign-in/PVE task progress, daily reset, idempotent task/all rewards, persistent currencies, batch purchases and invalid/insufficient rejection');
