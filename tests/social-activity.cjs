'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-activity-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),activity=require('../server/activity');require('../server/social');const E=T.engine();
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function api(url,token,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
 const a={name:'测试船员',introDone:true,mons:[],next:1,teams:[[]],active:0,items:{fruit1:2},exp:0,story:{},quests:{},hlFix:1};const m=E.ACC.newMon(a,'leaf',59,{now:Date.now(),rand:()=>.5});m.exp=E.ACC.expAt(60)-1;
 const one=await api('/api/register',null,{user:'publisher',pass:'activity-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(one.status,200);
 const two=await api('/api/register',null,{user:'stranger',pass:'activity-password'});assert.equal(two.status,200);
 assert.equal((await api('/api/activity')).status,401);assert.deepEqual((await api('/api/activity',two.token)).items,[]);
 const grown=await api('/api/tx',one.token,{v:T.VERSION,op:'mitem',args:{u:m.u,k:'fruit1'}});assert.equal(grown.status,200);
 let out=await api('/api/activity',two.token);assert.equal(out.items.length,1);assert.equal(out.items[0].kind,'level');assert.equal(out.items[0].level,60);assert.equal(out.items[0].user,'publisher');assert(!A.loadUser('stranger').friends?.length);
 function edit(fn){const u=A.loadUser('publisher'),got=JSON.parse(u.save.data['hs-account-v1']);fn(got);u.save.data['hs-account-v1']=JSON.stringify(got);A.saveUser(u);}
 edit(got=>{E.ACC.newMon(got,'bali',5,{now:Date.now(),rand:()=>.5});got.story.flora1={done:true};got.quests.w_first=Date.now();got.daily={date:'2026-11-24',list:[{id:'ar_play3',c:1}]};});
 out=await api('/api/activity',two.token);assert.deepEqual(out.items.map(e=>e.kind).sort(),['daily','level','mon','quest','story']);assert(out.items.some(e=>e.mon?.sid==='bali'&&e.kind==='mon'));
 const ids=out.items.map(e=>e.id);A.saveUser(A.loadUser('publisher'));assert.deepEqual((await api('/api/activity',two.token)).items.map(e=>e.id),ids);
 // Rollback, release/reacquisition of the same instance and renaming cannot republish old milestones/tasks.
 edit(got=>{got.mons[0].lv=59;got.story.flora1.done=false;got.quests={};got.daily.list[0].c=0;got.mons=got.mons.slice(0,1);});
 edit(got=>{got.name='新名字';got.mons[0].lv=60;got.mons.push({u:2,sid:'bali',lv:5});got.story.flora1.done=true;got.quests.w_first=Date.now();got.daily.list[0].c=1;});assert.deepEqual((await api('/api/activity',two.token)).items.map(e=>e.id),ids);
 edit(got=>{got.mons[0].lv=83;});out=await api('/api/activity',two.token);assert.equal(out.items[0].level,80);assert.equal(out.items[0].name,'新名字');
 // Cursor pages stay stable while new saves create newer rows. No password, private messages or full saves are exposed.
 const first=await api('/api/activity?limit=2',two.token);assert.equal(first.items.length,2);assert(first.next);edit(got=>{E.ACC.newMon(got,'glen',1,{now:Date.now(),rand:()=>.5});});const next=await api('/api/activity?limit=2&before='+first.next,two.token);assert.equal(next.items.length,2);assert(next.items.every(e=>!first.items.some(x=>x.id===e.id)));
 const publicText=JSON.stringify(await api('/api/activity',two.token));for(const k of ['password','salt','hash','activityState','hs-account-v1'])assert(!publicText.includes(k));assert.equal((await api('/api/activity',one.token,{text:'forged'})).status,405);
 // Existing users' historic saves become a baseline on first post-deploy write.
 const legacy=A.loadUser('publisher');delete legacy.activityState;const file=path.join(dir,'users',Buffer.from('publisher').toString('hex')+'.json');fs.writeFileSync(file,JSON.stringify(legacy));const count=(await api('/api/activity',two.token)).items.length;A.saveUser(A.loadUser('publisher'));assert.equal((await api('/api/activity',two.token)).items.length,count);
 const reloaded=require('../server/activity');assert.equal(reloaded.page(dir,'',50).items.length,count);
 const junk=Array.from({length:activity.KEEP+5},(_,i)=>({id:'old'+i,kind:'story',task:'flora1'}));activity.publish(dir,junk);assert.equal(activity.page(dir,'',999).items.length,activity.KEEP);assert.equal(activity.page(dir,'missing',20).items.length,0);
 console.log('PASS social activity: authenticated global visibility, real item transaction milestones, obtained monsters/story/world/daily tasks, persistent dedup/rollback/import baseline, stable cursor pages, no private fields and bounded history');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
