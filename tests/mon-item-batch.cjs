'use strict';
const assert=require('node:assert/strict'),E=require('../server/tx').engine(),A=E.ACC,G=E.GROW,T=E.TX;
const env={now:Date.parse('2026-11-23T08:00:00Z'),rand:()=>.4},copy=x=>JSON.parse(JSON.stringify(x));
function fixture(sid='leaf',lv=5){const a={mons:[],next:1,items:{fruit1:999,fruit2:999,ev50:20,evAny:20,nameTag:2,natAny:3,natRand:20,ivReroll:20,formDev:5,floraJade:500,tgPearl:500},teams:[[]],active:0,exp:0};A.newMon(a,sid,lv,env);return a;}
function run(a,k,n,nat){return T.run(a,'mitem',{u:a.mons[0].u,k,...(n===undefined?{}:{n}),nat},env);}
function reject(a,k,n,nat){const before=copy(a);assert.equal(run(a,k,n,nat).ok,false);assert.deepEqual(copy(a),before);}
for(const n of [0,-1,1.5,'2',null,true,NaN,Infinity,1000]){const a=fixture();reject(a,'fruit1',n);}
let a=fixture();const before=copy(a);G.monItemPreview(a,'fruit1',a.mons[0],20);assert.deepEqual(copy(a),before);
// Batch fruit use equals sequential use, including experience changes after each level-up.
for(const k of ['fruit1','fruit2']){a=fixture();const seq=copy(a),preview=copy(G.monItemPreview(a,k,a.mons[0],10));let sum=0;for(let i=0;i<10;i++){const r=run(seq,k,1);assert(r.ok);sum+=r.g.amt;}const r=run(a,k,10);assert(r.ok);assert.deepEqual(copy(a),copy(seq));assert.equal(r.g.amt,sum);assert.equal(preview.exp,sum);assert.equal(preview.lv,a.mons[0].lv);assert.equal(r.g.lv0,5);assert.equal(r.g.lv1,a.mons[0].lv);assert.equal(r.cost,10);}
a=fixture('leaf',69);a.mons[0].exp=A.expAt(70)-1;assert.equal(G.monItemMax(a,'fruit1',a.mons[0]),1);reject(a,'fruit1',2);assert(run(a,'fruit1',1).ok);assert.equal(a.items.fruit1,998);assert.equal(a.mons[0].lv,70);assert.equal(G.monItemMax(a,'fruit1',a.mons[0]),0);reject(a,'fruit1',1);
// Learning points cannot exceed their cap or consume extra items after it is reached.
a=fixture();a.mons[0].evFree=E.EV_TOTAL-125;assert.equal(G.monItemMax(a,'ev50',a.mons[0]),3);assert.equal(G.monItemPreview(a,'ev50',a.mons[0],3).ev,125);reject(a,'ev50',4);let r=run(a,'ev50',3);assert(r.ok);assert.equal(a.mons[0].evFree,E.EV_TOTAL);assert.equal(a.items.ev50,17);assert(r.msg.includes('125'));reject(a,'ev50',1);
// Unlock the selected skill or form first, then each remaining choice exactly once.
a=fixture('tagore',55);let skills=Array.from(G.jadeMoves(a.mons[0]));const chosen=skills[skills.length-1],n=skills.length;assert.equal(G.monItemMax(a,'tgPearl',a.mons[0]),n);reject(a,'tgPearl',n+1,chosen);r=run(a,'tgPearl',n,chosen);assert(r.ok);assert.equal(r.cost,n*100);assert.equal(a.mons[0].hl[0],chosen);assert.equal(new Set(a.mons[0].hl).size,n);assert.equal(a.items.tgPearl,500-n*100);
a=fixture('tagore',55);assert.equal(G.monItemMax(a,'formDev',a.mons[0]),2);reject(a,'formDev',3);assert(run(a,'formDev',2,'1').ok);assert.deepEqual(Array.from(a.mons[0].fu),[1,0]);assert.equal(a.items.formDev,3);
// One-time effects remain single use, and old callers that omit n still work.
for(const k of ['nameTag','natAny']){a=fixture();reject(a,k,2,'固执');}
a=fixture();a.mons[0].ev={atk:20};a.items.evReset=3;assert.equal(G.monItemMax(a,'evReset',a.mons[0]),1);reject(a,'evReset',2);assert(run(a,'evReset',1).ok);assert.equal(a.mons[0].evFree,20);
a=fixture();assert(run(a,'nameTag',undefined).ok);assert.equal(a.items.nameTag,1);assert.equal(a.mons[0].renameUnlocked,true);
// Random batches retain the last result and are deterministic under recorded replay.
for(const k of ['ivReroll','natRand']){a=fixture();const replay=copy(a);const rand=T.recorder();r=T.run(a,'mitem',{u:1,k,n:5},{...env,rand});assert(r.ok);const replayRand=T.replay(rand.rolls);assert(T.run(replay,'mitem',{u:1,k,n:5},{...env,rand:replayRand}).ok);assert.deepEqual(copy(a),copy(replay));assert.equal(a.items[k],15);assert(r.msg.includes('保留最后一个的随机结果'));}
a=fixture();a.items.fruit1=2;reject(a,'fruit1',3);reject(a,'tgPearl',2);
console.log('PASS bulk monster items: atomic invalid/over-limit rejection, stock and caps, sequential fruit equivalence and previews, aggregate gains, hidden skill/form ordering, single-use effects, legacy callers and random replay');
