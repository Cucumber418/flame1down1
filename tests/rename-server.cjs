'use strict';
const fs=require('fs'), os=require('os'), path=require('path'), http=require('http'), assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-rename-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'), T=require('../server/tx');
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}}), E=T.engine();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 let token;async function api(url,body,method){const r=await fetch(base+url,{method:method||'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return{status:r.status,...await r.json()};}
 const a={v:1,name:'renametest',introDone:true,mons:[],next:1,teams:[[]],active:0,items:{g_core:5},energy:20000,exp:0,hlFix:1};
 E.ACC.newMon(a,'leaf',5,{now:Date.now(),rand:()=>0});E.ACC.newMon(a,'leaf',5,{now:Date.now(),rand:()=>0});
 let r=await api('/api/register',{user:'renametest',pass:'renametest-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(r.status,200);token=r.token;
 const tx=(op,args)=>api('/api/tx',{v:T.VERSION,op,args}), read=()=>JSON.parse(A.loadUser('renametest').save.data['hs-account-v1']);
 assert.equal((await tx('monRename',{u:1,name:'未解锁'})).status,400);
 assert.equal((await tx('forge',{id:'nameTag',n:1})).status,200);assert.equal(read().items.g_core,0);
 assert.equal((await tx('shop',{k:'nameTag',n:1})).status,200);assert.equal(read().energy,0);
 const pair=await Promise.all([tx('mitem',{u:1,k:'nameTag'}),tx('mitem',{u:1,k:'nameTag'})]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,400]);assert.equal(read().items.nameTag,1);
 for(const name of ['小叶','再改一次','免费改名'])assert.equal((await tx('monRename',{u:1,name})).status,200);
 assert.equal(read().mons[0].nickname,'免费改名');assert.equal(read().items.nameTag,1);assert.equal((await tx('monRename',{u:2,name:'别的个体'})).status,400);
 let save=A.loadUser('renametest').save, edited=JSON.parse(save.data['hs-account-v1']);delete edited.mons[0].renameUnlocked;delete edited.mons[0].nickname;edited.mons[1].renameUnlocked=true;edited.mons[1].nickname='伪造';
 r=await api('/api/save',{rev:save.rev,data:{...save.data,'hs-account-v1':JSON.stringify(edited)},claims:[]},'PUT');assert.equal(r.status,200);
 assert.equal(read().mons[0].renameUnlocked,true);assert.equal(read().mons[0].nickname,'免费改名');assert.equal(read().mons[1].renameUnlocked,undefined);assert.equal(read().mons[1].nickname,undefined);
 assert.equal((await tx('monRename',{u:1,name:''})).status,200);assert.equal(read().mons[0].nickname,undefined);assert.equal(read().mons[0].renameUnlocked,true);
 console.log('PASS rename API: purchase, crafting, concurrent unlock, free renames, individual permission, save protection and reset');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
