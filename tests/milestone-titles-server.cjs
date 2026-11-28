'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-milestones-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),E=T.engine(),ids=['clementiSinger','highlandKing','mingHeir','leafcatOwner'];
const env={now:Date.now(),rand:()=>.5},server=http.createServer((q,r)=>{if(!A.handle(q,r)){r.statusCode=404;r.end();}});
function fixture(){return{v:1,name:'成就旅人',introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{},exp:0,energy:0};}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
async function api(url,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,...await r.json()};}
const tx=(op,args={})=>api('/api/tx',{op,args,rules:T.RULES_VERSION}),read=user=>JSON.parse(A.loadUser(user).save.data['hs-account-v1']);
let a=fixture();a.bosses={'clementi:2':{wins:1}};for(const sid of ['glen','leiming','leafcat'])E.ACC.newMon(a,sid,100,env);
const expected=E.AWD.titleCheck(a,{...env,data:{}},true);
let r=await api('/api/register',{user:'oldmilestone',pass:'milestone-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(r.status,200);token=r.token;
const pair=await Promise.all([tx('title'),tx('title')]);assert(pair.every(r=>r.ok));a=read('oldmilestone');for(const id of ids){assert.equal(a.titles.filter(x=>x===id).length,1);assert.equal(a.titleRw.filter(x=>x===id).length,1);assert(a.titles.includes(id));assert(a.titleRw.includes(id));}
assert.equal(a.exp,expected.sum.exp);assert.equal(a.energy,expected.sum.energy);assert.equal(a.merit,expected.sum.merit);const wallet={exp:a.exp,energy:a.energy,merit:a.merit,meritXp:a.meritXp};assert((await tx('title')).ok);assert.deepEqual(Object.fromEntries(Object.keys(wallet).map(k=>[k,read('oldmilestone')[k]])),wallet);
// Existing achievements and rewards are server-owned, including the new IDs.
r=await api('/api/me');const data=r.save.data,forged=JSON.parse(data['hs-account-v1']);forged.titles=[];forged.titleRw=[];data['hs-account-v1']=JSON.stringify(forged);assert.equal((await api('/api/save',{data,rev:r.save.rev,claims:[]},'PUT')).status,200);for(const id of ids){assert(read('oldmilestone').titles.includes(id));assert(read('oldmilestone').titleRw.includes(id));}assert((await tx('title')).ok);
a=fixture();a.bosses={'clementi:1':{wins:1}};a.nursery={slots:['e_glen','e_leiming','e_leafcat'].map(k=>({k,t:env.now-481*60000}))};
r=await api('/api/register',{user:'newmilestone',pass:'milestone-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(r.status,200);token=r.token;assert((await tx('title')).ok);assert(!(read('newmilestone').titles||[]).some(id=>ids.includes(id)));
for(const [i,id]of [[0,'highlandKing'],[1,'mingHeir'],[2,'leafcatOwner']]){assert((await tx('hatch',{a:'hatch',i})).ok);r=await tx('title');assert(r.ok);assert(read('newmilestone').titles.includes(id));assert(read('newmilestone').titleRw.includes(id));assert(!read('newmilestone').titles.includes('clementiSinger'));}
assert(!read('newmilestone').titles.includes('clementiSinger'));assert((await tx('title')).ok);
console.log('PASS milestone API: historical backfill, concurrent/repeated award dedup, durable rewards, save protection, actual three-species hatching and no ordinary-BOSS false grant');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
