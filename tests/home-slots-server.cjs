'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-home-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx');require('../server/social');
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}}),E=T.engine();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
 async function api(url,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
 const a={v:1,name:'hometest',introDone:true,mons:[],next:1,teams:[[]],active:0,items:{},exp:0,story:{tea:{done:true}},home:{mons:[],cap:4},hlFix:1};
 for(let i=0;i<15;i++)E.ACC.newMon(a,'leaf',5,{now:Date.now(),rand:()=>0});a.home.mons=[{u:1,t:Date.now()-3600000},{u:2,t:Date.now()}];
 let r=await api('/api/register',{user:'hometest',pass:'home-test-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(r.status,200);token=r.token;
 const tx=args=>api('/api/tx',{v:T.VERSION,op:'home',args}),read=()=>JSON.parse(A.loadUser('hometest').save.data['hs-account-v1']);
 assert.equal((await tx({a:'put',slot:6,u:13,from:null})).status,200);assert.equal(E.GROW.homeSlots(read())[6].u,13);
 const pair=await Promise.all([tx({a:'put',slot:0,u:14,from:1}),tx({a:'put',slot:0,u:15,from:1})]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,400]);
 assert.equal(require('../server/social').homeFoes('hometest','visitor').mons.length,3);
 let got=read(),slots=E.GROW.homeSlots(got);assert.equal(slots[1].u,2);assert.equal(slots[6].u,13);assert(got.mons[0].exp>a.mons[0].exp);assert.equal(got.home.mons.length,3);
 assert.equal((await tx({a:'put',slot:2,u:13,from:null})).status,400);
 r=await api('/api/home?user=hometest');assert.equal(r.status,200);assert.deepEqual(r.mons.map(m=>m.homeSlot).sort((a,b)=>a-b),[0,1,6]);
 const save=A.loadUser('hometest').save,edited=JSON.parse(save.data['hs-account-v1']);edited.home.mons=[];
 r=await api('/api/save',{rev:save.rev,data:{...save.data,'hs-account-v1':JSON.stringify(edited)},claims:[]},'PUT');assert.equal(r.status,200);assert.equal(read().home.mons.length,3);
 console.log('PASS home slots API: atomic concurrent switch, retained experience and positions, duplicate prevention, visitor slots and save protection');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
