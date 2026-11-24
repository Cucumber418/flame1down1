'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-rank-feed-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),activity=require('../server/activity');require('../server/social');const E=T.engine();
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function api(url,token,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
 const a={name:'晋级船员',introDone:true,mons:[],next:1,teams:[[]],active:0,items:{},exp:0,story:{}};E.ACC.newMon(a,'leaf',60,{now:Date.now(),rand:()=>.5});
 const owner=await api('/api/register',null,{user:'climber',pass:'rank-feed-password',data:{'hs-account-v1':JSON.stringify(a)}}),viewer=await api('/api/register',null,{user:'viewer',pass:'rank-feed-password'});assert.equal(owner.status,200);assert.equal(viewer.status,200);
 const feed=async()=>{const r=await api('/api/activity',viewer.token);assert.equal(r.status,200);return r.items;};
 // Simulate an existing pre-deploy account: no promotion watermark, already Gold.
 let u=A.loadUser('climber');delete u.activityState.ranks;u.save.data['hs-rank-v1']=JSON.stringify({season:'S2',r:3,best:3,stars:2,w:8,l:3});const file=path.join(dir,'users',Buffer.from('climber').toString('hex')+'.json');fs.writeFileSync(file,JSON.stringify(u));
 A.saveUser(A.loadUser('climber'));assert.deepEqual(await feed(),[]);
 function setRank(r){const u=A.loadUser('climber');u.save.data['hs-rank-v1']=JSON.stringify(Object.assign({season:'S2',r:4,best:4,stars:0,w:9,l:3},r));A.saveUser(u);}
 function win(){const u=A.loadUser('climber'),a=JSON.parse(u.save.data['hs-account-v1']),r=JSON.parse(u.save.data['hs-rank-v1']);const out=E.PVE.MODES.rank.end(a,{r:r.r,season:'S2'},{res:'win',quit:false},{data:u.save.data,now:Date.now(),rand:()=>.5});u.save.data['hs-account-v1']=JSON.stringify(a);A.saveUser(u);return out;}
 assert.equal(win().x.to,4);let rows=await feed();assert.equal(rows.length,1);assert.equal(rows[0].kind,'rank');assert.equal(rows[0].rank,4);assert.equal(rows[0].season,'S2');assert.equal(rows[0].name,'晋级船员');assert(!('stars'in rows[0]));const firstId=rows[0].id;
 // Stars and minor divisions do not create public promotions.
 setRank({dv:5,stars:2});assert.equal(win().x.toDv,4);assert.equal((await feed()).length,1);
 // Dropping and regaining a tier, duplicate writes and rollbacks never republish it.
 setRank({r:3,best:4,stars:2});win();A.saveUser(A.loadUser('climber'));assert.equal((await feed()).length,1);assert.equal((await feed())[0].id,firstId);
 setRank({r:4,best:4,dv:1,stars:2});assert.equal(win().x.to,5);rows=await feed();assert.equal(rows.length,2);assert.equal(rows[0].rank,5);
 setRank({r:0,best:0});setRank({r:4,best:4});assert.equal((await feed()).length,2);
 // Client save uploads cannot forge authoritative ranked progress or feed rows.
 u=A.loadUser('climber');const data=Object.assign({},u.save.data,{'hs-rank-v1':JSON.stringify({season:'S2',r:10,best:10,w:999})});assert.equal((await api('/api/save',owner.token,{rev:u.save.rev,data,claims:[]},'PUT')).status,200);assert.equal((await feed()).length,2);
 // Season-specific high watermarks allow the new season's first promotions.
 function raw(season,r,best){return{name:'climber',save:{data:{'hs-account-v1':JSON.stringify(a),'hs-rank-v1':JSON.stringify({season,r,best})}}};}
 const imported=raw('S2',8,8);assert.deepEqual(activity.prepare(null,imported,1),[]);
 const reset=raw('S3',0,0);assert.deepEqual(activity.prepare(imported,reset,2),[]);const promoted=raw('S3',1,1);let events=activity.prepare(reset,promoted,3);assert.equal(events.length,1);assert.equal(events[0].rank,1);assert.equal(events[0].season,'S3');
 const legacy=raw('S1',10,10),current=raw('S2',0,0);assert.deepEqual(activity.prepare(legacy,current,4),[]);
 activity.publish(dir,[{id:'invalid',kind:'rank',rank:99,season:'S2'},{id:'invalid-season',kind:'rank',rank:5,season:'<script>'}]);assert.equal((await feed()).length,2);
 console.log('PASS ranked activity: real rank settlement, authenticated global feed, major tiers only, persistent dedup/rollback, import baseline, season reset and forged-save protection');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
