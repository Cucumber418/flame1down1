'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-farm-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx');require('../server/social');require('../server/farm');
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
const E=T.engine(), read=name=>JSON.parse(A.loadUser(name).save.data['hs-account-v1']);
function write(name,a){let u=A.loadUser(name);u.save.data['hs-account-v1']=JSON.stringify(a);A.saveUser(u);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
async function api(token,url,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
const tokens={};for(const name of['owner','alice','bobby','stranger']){const a={v:1,name,introDone:true,mons:[],teams:[[]],active:0,story:{plant:{done:true},tea:{done:true}},items:{},energy:0,exp:0};let r=await api(null,'/api/register',{user:name,pass:'farm-test-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(r.status,200);tokens[name]=r.token;}
let own=read('owner');own.farm={plots:[{seed:'s_herb',t:Date.now()-481*60000},{seed:'s_rice',t:Date.now()-721*60000},null,null],extra:0};write('owner',own);const stale=JSON.parse(JSON.stringify(A.loadUser('owner').save));
assert.equal((await api(null,'/api/farm?user=owner')).status,401);assert.equal((await api(tokens.stranger,'/api/farm?user=owner')).status,200);assert.equal((await api(tokens.alice,'/api/farm-log?user=owner')).status,403);
for(const who of['alice','bobby'])assert.equal((await api(tokens[who],'/api/friends',{user:'owner',on:true})).status,200);
let visit=await api(tokens.alice,'/api/farm?user=owner');assert.equal(visit.plots[0].steal.n,5);assert.equal(visit.homeOpen,true);assert.equal(visit.plots[0].sb,undefined);assert.equal((await api(tokens.alice,'/api/home?user=owner')).farmOpen,true);
const tx=(who,op,args)=>api(tokens[who],'/api/tx',{v:T.VERSION,op,args});
assert.equal((await tx('owner','farmSteal',{owner:'owner',i:0})).status,400);assert.equal((await tx('stranger','farmSteal',{owner:'missing',i:0})).status,400);
const [one,two]=await Promise.all([tx('alice','farmSteal',{owner:'owner',i:0}),tx('alice','farmSteal',{owner:'owner',i:0})]);assert.deepEqual([one.status,two.status].sort(),[200,400]);assert.equal(read('alice').items.c_herb,5);assert.equal(read('owner').farm.plots[0].st,5);
assert.equal((await tx('bobby','farmSteal',{owner:'owner',i:0})).status,200);assert.equal(read('bobby').items.c_herb,4);
let staleUpload=await api(tokens.owner,'/api/save',{rev:stale.rev,data:stale.data,claims:[]},'PUT');assert.equal(staleUpload.status,200);assert.equal(read('owner').farm.plots[0].st,9);
let harvest=await tx('owner','farm',{a:'harvest',i:0});assert.equal(harvest.status,200);assert.equal(harvest.ext.farmBefore.plots[0].st,9);let replay=JSON.parse(stale.data['hs-account-v1']);replay.farm=harvest.ext.farmBefore;assert.equal(E.TX.run(replay,'farm',{a:'harvest',i:0},{now:harvest.now,rand:E.TX.replay(harvest.rolls)}).n,41);assert.equal(read('owner').items.c_herb+read('alice').items.c_herb+read('bobby').items.c_herb,50);
let al=read('alice');al.farmStealD={d:E.TX.bjDay(Date.now()),n:2999};write('alice',al);assert.equal((await tx('alice','farmSteal',{owner:'owner',i:1})).status,200);assert.equal(read('alice').items.c_rice,1);assert.equal(read('alice').farmStealD.n,3000);assert.equal((await tx('alice','farmSteal',{owner:'owner',i:2})).status,400);
let current=A.loadUser('alice').save, edited=JSON.parse(JSON.stringify(current.data)), ea=JSON.parse(edited['hs-account-v1']);ea.farmStealD.n=0;edited['hs-account-v1']=JSON.stringify(ea);assert.equal((await api(tokens.alice,'/api/save',{rev:current.rev,data:edited,claims:[]},'PUT')).status,200);assert.equal(read('alice').farmStealD.n,3000);
await api(tokens.bobby,'/api/friends',{user:'owner',on:false});assert.equal((await api(tokens.bobby,'/api/farm?user=owner')).status,200);assert.equal((await api(tokens.bobby,'/api/farm?user=owner')).friend,true);
assert((await api(tokens.owner,'/api/farm-log?peek=1')).newLog>0);let log=await api(tokens.owner,'/api/farm-log');assert(log.logs.some(e=>e.kind==='steal'&&e.user==='alice'&&e.n===5));assert(log.logs.some(e=>e.kind==='harvest'&&e.n===41&&e.stolen===9));assert.equal((await api(tokens.owner,'/api/farm-log?peek=1')).newLog,0);assert.equal((await api(tokens.owner,'/api/farm-log',{kind:'steal'})).status,405);
assert.equal((await tx('owner','farm',{a:'harvest',i:1})).status,200);assert.equal(read('owner').items.c_rice,249);assert.equal(read('owner').items.s_rice,1);
console.log('PASS farm API: auth, all-server friendship, concurrent duplicate theft, quota protection, stale uploads/replay, conservation, private logs and seeds');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
