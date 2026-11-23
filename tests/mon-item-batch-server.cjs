'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-bulk-item-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),E=T.engine();require('../server/social');
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}}),copy=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
 async function api(url,body){const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return{status:r.status,...await r.json()};}
 const a={v:1,name:'batchitem',introDone:true,mons:[],next:1,teams:[[]],active:0,energy:0,exp:0,items:{ev50:3,fruit1:10,xmasBell:30},story:{school:{done:true},river:{done:true},jiuquan:{done:true}},christmasStory:{cabinOpen:true,shopOpen:true,shopIntro:true},hlFix:1};E.ACC.newMon(a,'leaf',5,{now:Date.now(),rand:()=>.4});a.teams[0]=[1];
 let r=await api('/api/register',{user:'batchitem',pass:'batch-item-test-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(r.status,200);token=r.token;
 const tx=(op,args)=>api('/api/tx',{v:T.VERSION,op,args}),read=()=>JSON.parse(A.loadUser('batchitem').save.data['hs-account-v1']);
 let before=read();r=await tx('mitem',{u:1,k:'fruit1',n:5});assert.equal(r.status,200);const replay=copy(before);assert(E.TX.run(replay,'mitem',{u:1,k:'fruit1',n:5},{now:r.now,rand:E.TX.replay(r.rolls)}).ok);assert.deepEqual(copy(read()),copy(replay));
 const pair=await Promise.all([tx('mitem',{u:1,k:'ev50',n:3}),tx('mitem',{u:1,k:'ev50',n:3})]);assert.deepEqual(pair.map(r=>r.status).sort(),[200,400]);assert.equal(read().items.ev50,0);assert.equal(read().mons[0].evFree,150);
 for(const n of [0,-1,1.5,'2',999]){before=read();assert.equal((await tx('mitem',{u:1,k:'fruit1',n})).status,400);assert.deepEqual(copy(read()),copy(before));}
 assert.equal((await tx('christmas',{a:'buy',id:'ivReroll',n:2})).status,200);assert.equal((await tx('christmas',{a:'buy',id:'natRand',n:2})).status,200);assert.equal(read().items.xmasBell,4);
 for(const k of ['ivReroll','natRand']){before=read();r=await tx('mitem',{u:1,k,n:2});assert.equal(r.status,200);const replay=copy(before);assert(E.TX.run(replay,'mitem',{u:1,k,n:2},{now:r.now,rand:E.TX.replay(r.rolls)}).ok);assert.deepEqual(copy(read()),copy(replay));assert.equal(read().items[k],0);}
 console.log('PASS bulk item API: persistent batch use, one request per batch, atomic concurrent stock use, invalid quantity rejection, Threego prices and deterministic random replay');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
