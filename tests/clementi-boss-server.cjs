'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-clementi-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx');require('../server/pve');
const E=T.engine(),server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
 async function api(body){const r=await fetch(base+'/api/pve',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,...await r.json()};}
 assert.equal((await api({op:'start',kind:'boss',args:{k:'clementi',d:0}})).status,401);
 const a={v:1,name:'bosstest',mons:[],next:1,teams:[[]],active:0,items:{},exp:0,introDone:true,story:{flora1:{done:true}},hlFix:1};
 const m=E.ACC.newMon(a,'gorgon',70,{now:Date.now(),rand:()=>0});a.teams[0]=[m.u];
 let r=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'bosstest',pass:'boss-test-password',data:{'hs-account-v1':JSON.stringify(a)}})});r=await r.json();token=r.token;assert(token);
 assert.equal((await api({op:'start',kind:'boss',args:{k:'clementi',d:1}})).status,400);
 r=await api({op:'start',kind:'boss',args:{k:'clementi',d:0}});assert.equal(r.status,200);assert.equal(r.S.sides[1].team[0].id,'clementi');assert.equal(r.S.sides[1].team[0].maxhp,1000);assert(!r.S.sides[1].team[0].boss.immortal);
 await api({op:'quit',seq:1});const u=A.loadUser('bosstest'),saved=JSON.parse(u.save.data['hs-account-v1']);saved.bosses.clementi.wins=1;u.save.data['hs-account-v1']=JSON.stringify(saved);A.saveUser(u);
 r=await api({op:'start',kind:'boss',args:{k:'clementi',d:1}});assert.equal(r.status,200);const foe=r.S.sides[1].team[0];assert.equal(foe.maxhp,3000);assert.equal(foe.boss.tuning,1);assert.equal(foe.boss.chord,.65);assert.equal(foe.boss.dr,.15);assert(!foe.boss.immortal);
 const action={op:'act',seq:1,a:{kind:'move',i:0}};r=await api(action);assert.equal(r.status,200);assert.equal(r.S.sides[1].team[0].hp,3000);assert.deepEqual(await api(action),r);
 r=await api({op:'quit',seq:2});assert.equal(r.status,200);assert(r.end);assert.equal(JSON.parse(A.loadUser('bosstest').save.data['hs-account-v1']).items.fireNote||0,0);
 assert.equal((await api({op:'start',kind:'boss',args:{k:'clementi',d:2}})).status,400);
 console.log('PASS clementi API: authentication, difficulty gating, authoritative boss generation, odd-turn damage immunity, idempotent turns, quit without rewards and no hard difficulty');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
