'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'flame-daily-rewards-'));
const A=require('../server/accounts'),T=require('../server/tx'),E=T.engine(),now=Date.parse('2026-11-23T15:59:59Z'),env={now,rand:()=>.5};
function fixture(){const a={v:1,name:'每日旅人',introDone:true,next:1,mons:[],teams:[[]],active:0,items:{g_core:0},energy:0,exp:0,story:{},created:now-30*864e5,lastActive:now,loginDay:E.ACC.dayNum(now)-20};for(const id of Object.keys(E.STORY_SCRIPT))a.story[id]={done:true,rewarded:true};return a;}
function complete(a,at=now){const D=E.QST.daily(a,at);D.list.forEach(t=>t.p=E.QST.DAILY[t.id].n);return D;}
const run=(a,op,args={},at=now)=>E.TX.run(a,op,args,{now:at,rand:()=>.5});
assert(Object.values(E.RW.DAILY).every(r=>r.exp===5000));
let a=fixture(),r=run(a,'signin');assert(r.ok);assert.equal(r.exp,5000);assert.equal(r.core,2);assert.equal(a.exp,5000);assert.equal(a.items.g_core,2);assert(run(a,'signin').already);assert.equal(a.exp,5000);
a=fixture();assert(!run(a,'dailyAll').ok);let D=complete(a);assert.equal(D.list.length,7);D.list[6].p--;assert(!run(a,'dailyAll').ok);assert.equal(a.exp,0);D.list[6].p++;
assert(E.QST.dailyAllReady(a,now));r=run(a,'dailyAll');assert(r.ok&&!r.already);assert.equal(a.exp,10000);assert.equal(a.items.g_core,2);assert(D.allClaimed);assert(D.list.every(t=>!t.c));assert(run(a,'dailyAll').already);assert.equal(a.exp,10000);
for(let i=0;i<D.list.length;i++){r=run(a,'daily',{i});assert(r.ok);assert.equal(r.exp,5000);}assert.equal(a.exp,45000);assert.equal(a.items.g_core,2);assert(run(a,'dailyAll').already);assert(!run(a,'daily',{i:0}).ok);assert.equal(a.exp,45000);
const next=now+1000;assert(!run(a,'dailyAll',{day:D.date},next).ok);assert(!a.daily.allClaimed);assert.equal(a.daily.date,'2026-11-24');complete(a,next);assert(run(a,'dailyAll',{},next).ok);assert.equal(a.exp,55000);assert.equal(a.items.g_core,4);assert(run(a,'dailyAll',{},next).already);
// Old claims remain claimed; completing the remaining tasks still unlocks the new pack.
a=fixture();D=complete(a);D.list[0].c=1;assert(run(a,'dailyAll').ok);assert(!run(a,'daily',{i:0}).ok);
// New players receive fewer tasks until exploration opens; all assigned tasks count.
a=fixture();a.story={};D=complete(a);assert(D.list.length>0&&D.list.length<7);assert(run(a,'dailyAll').ok);
// Repeated IDs cannot impersonate a full completed task list.
a=fixture();D=complete(a);D.list[1]={...D.list[0]};assert(!run(a,'dailyAll').ok);
// Stop generating daily and backfill login mail while retaining genuine old mail and offline XP.
a=fixture();a.mail=[{id:'login-old',title:'每日登录奖励',att:{exp:3000}}];a.mailSeen={'login-old':1};E.AWD.sync(a,env);assert.deepEqual(a.mail.filter(m=>/^login-/.test(m.id)).map(m=>m.id),['login-old']);assert(run(a,'mail',{a:'get',id:'login-old'}).ok);assert.equal(a.exp,3000);E.AWD.sync(a,{...env,now:now+3*864e5});assert.deepEqual(a.mail.filter(m=>/^login-/.test(m.id)).map(m=>m.id),['login-old']);assert(a.mail.some(m=>m.title==='离线经验'));
const server=http.createServer((q,r)=>{if(!A.handle(q,r)){r.statusCode=404;r.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
let acc=fixture();complete(acc,Date.now());r=await api('/api/register',{user:'dailytest',pass:'daily-test-password',data:{'hs-account-v1':JSON.stringify(acc)}});assert(r.token);token=r.token;
const responses=await Promise.all([api('/api/tx',{op:'dailyAll',args:{exp:999999,core:999},rules:T.RULES_VERSION}),api('/api/tx',{op:'dailyAll',args:{},rules:T.RULES_VERSION})]);assert(responses.every(r=>r.ok));
let saved=await api('/api/me');acc=JSON.parse(saved.save.data['hs-account-v1']);assert.equal(acc.exp,10000);assert.equal(acc.items.g_core,2);assert(acc.daily.allClaimed);
// Uploading a cleared flag cannot reopen an already received reward.
const user=A.loadUser('dailytest'),C=require('../server/claims'),forged=JSON.parse(JSON.stringify(user.save.data));const fa=JSON.parse(forged['hs-account-v1']);fa.daily.allClaimed=false;forged['hs-account-v1']=JSON.stringify(fa);const fixed=C.onUpload(user,[],user.save.data,forged,{claims:true,v:T.VERSION});assert(JSON.parse(fixed.data['hs-account-v1']).daily.allClaimed);
assert((await api('/api/tx',{op:'dailyAll',args:{},rules:T.RULES_VERSION})).ok);assert.equal(JSON.parse((await api('/api/me')).save.data['hs-account-v1']).exp,10000);
console.log('PASS new sign-in and per-task rewards, all-completion before individual claims, duplicates/concurrent API, Beijing midnight, legacy claims, assigned task counts, forgery rejection, retired login mail and retained offline/old rewards');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
