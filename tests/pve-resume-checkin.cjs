'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),cp=require('child_process');
if(process.env.PVE_TEST_WORKER){
 const A=require('../server/accounts');require('../server/tx');require('../server/pve');
 const s=http.createServer((q,r)=>{if(!A.handle(q,r)){r.statusCode=404;r.end();}});s.listen(0,'127.0.0.1',()=>process.send({port:s.address().port}));
}else{(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-resume-'));process.env.DATA_DIR=dir;const E=require('../server/tx').engine(),T=require('../server/tx');
 const a={v:1,name:'续战测试',introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{pot100:3,g_core:0},energy:0,exp:0};
 for(const id of ['school','river','jiuquan'])a.story[id]={done:true,rewarded:true};const m=E.ACC.newMon(a,'barlow',100,{now:Date.now(),rand:()=>.5});m.moves=['纯净护盾','能量弹','践踏','遁走'];a.teams[0]=[m.u];
 // Beijing midnight, duplicate claim, month rollover: exactly one daily reward.
 let acc={exp:0,items:{}},t=Date.parse('2026-11-30T15:59:59Z');
 assert(E.TX.run(acc,'signin',{}, {now:t}).ok);assert.equal(acc.exp,5000);assert.equal(acc.items.g_core,2);assert(E.TX.run(acc,'signin',{}, {now:t}).already);assert.equal(acc.exp,5000);
 assert(E.TX.run(acc,'signin',{}, {now:t+1000}).ok);assert.equal(acc.exp,10000);assert.equal(acc.items.g_core,4);assert.deepEqual(JSON.parse(JSON.stringify(acc.checkin.days)),['2026-12-01']);
 let worker,base,token;
 async function boot(){worker=cp.fork(__filename,[],{env:{...process.env,PVE_TEST_WORKER:'1'},stdio:['ignore','pipe','pipe','ipc']});const msg=await new Promise((r,j)=>{worker.once('message',r);worker.once('error',j);worker.once('exit',code=>j(new Error('worker exited '+code)));});base='http://127.0.0.1:'+msg.port;}
 async function stop(){const w=worker;if(!w)return;worker=null;await new Promise(r=>{w.once('exit',r);w.kill('SIGTERM');});}
 async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 try{
 await boot();let r=await api('/api/register',{user:'resumetest',pass:'resume-test-password',data:{'hs-account-v1':JSON.stringify(a)}});token=r.token;assert(token);
 const version=await api('/api/version');assert(version.rules);assert.equal(version.rules,T.RULES_VERSION);
 let sign=await api('/api/tx',{op:'signin',rules:version.rules,v:'cosmetic-old-version'});assert(sign.ok);let user=await api('/api/me');let saved=JSON.parse(user.save.data['hs-account-v1']);assert.equal(saved.exp,5000);assert.equal(saved.items.g_core,2);
 assert((await api('/api/tx',{op:'signin',rules:version.rules})).ok);saved=JSON.parse((await api('/api/me')).save.data['hs-account-v1']);assert.equal(saved.exp,5000);assert.equal(saved.items.g_core,2);
 const spawn=await api('/api/pve',{op:'wild',rid:'hl_castle',si:0,bg:'hl_castle',n:1});assert(spawn.list.length);
 const request={op:'start',kind:'wild',args:{id:spawn.list[0].id},ui:{bg:E.BG.hl_castle,back:'圣诞城堡',route:{view:'field',planet:'helena',region:'hl_castle'}},rules:version.rules,v:'cosmetic-old-version'};
 assert.equal((await api('/api/pve',{...request,rules:'old-battle-rules'})).status,409);
 r=await api('/api/pve',request);assert(r.ok);const bid=r.bid;assert(bid);assert.equal((await api('/api/pve',request)).pending,true);
 r=await api('/api/pve',{op:'act',seq:1,bid,a:{kind:'move',i:0}});assert(r.ok&&!r.end);const replay=await api('/api/pve',{op:'act',seq:1,bid,a:{kind:'move',i:0}});assert.deepEqual(replay,r);
 const wrong=await api('/api/pve',{op:'act',seq:30,bid,a:{kind:'move',i:0}});assert.equal(wrong.retryResume,true);assert((await api('/api/pve',{op:'status'})).pending);
 r=await api('/api/pve',{op:'act',seq:2,bid,a:{kind:'item',key:'pot100'}});assert(r.ok&&!r.end);const before=r.S;
 await stop();await boot();r=await api('/api/pve',{op:'resume',rules:'old-battle-rules'});assert(r.ok&&r.resume);assert.equal(r.seq,2);assert.equal(r.bid,bid);assert.deepEqual(r.S,before);assert.equal(r.ui.route.region,'hl_castle');
 const quit=await api('/api/pve',{op:'quit',seq:3,bid});assert(quit.end);assert.equal((await api('/api/pve',{op:'status'})).pending,false);assert.deepEqual(await api('/api/pve',{op:'quit',seq:3,bid}),quit);
 saved=JSON.parse((await api('/api/me')).save.data['hs-account-v1']);assert.equal(saved.items.pot100,2);assert(!saved.items.crossEssence);
 await stop();await boot();assert.deepEqual(await api('/api/pve',{op:'quit',seq:3,bid}),quit);assert.equal((await api('/api/pve',{op:'status'})).pending,false);
 console.log('PASS PVE persistence through restart, exact state/PP/items/sequence, duplicate replies, progress mismatch preservation, abandon; rule vs cosmetic versions; daily sign-in duplicate/midnight/month rewards');
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});}
