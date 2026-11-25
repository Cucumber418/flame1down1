'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-broadcast-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),S=require('../server/social'),activity=require('../server/activity'),E=T.engine();
const sockets=[],server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,tokens={};
 async function api(url,token,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
 for(const name of['hero','watcher','offline','nocharacter']){const a={name,introDone:true,mons:[],next:1,teams:[[]],active:0,items:{},story:{tiger:{done:true},tiger2:{done:true}},exp:0};const m=E.ACC.newMon(a,'wind',70,{now:Date.now(),rand:()=>.5});a.teams[0]=[m.u];const r=await api('/api/register',null,{user:name,pass:'broadcast-password',...(name==='nocharacter'?{}:{data:{'hs-account-v1':JSON.stringify(a)}})});assert.equal(r.status,200);tokens[name]=r.token;}
 function socket(name){const w={readyState:1,messages:[],send(v){this.messages.push(JSON.parse(v));}};sockets.push(w);S.onOpen(w);if(name)S.onMessage(w,{type:'auth',token:tokens[name]});return w;}
 const viewer=socket('watcher'),anon=socket(),owner=socket('hero');const announces=w=>w.messages.filter(m=>m.type==='global-announcement').map(m=>m.event),clear=()=>sockets.forEach(w=>w.messages=[]);
 assert(announces(viewer).some(e=>e.kind==='online'&&e.user==='hero'));assert.equal(announces(anon).length,0);clear();
 const second=socket('hero');assert.equal(announces(viewer).length,0);S.onClose(owner);S.onClose(second);const reconnect=socket('hero');assert.equal(announces(viewer).length,0);socket('nocharacter');assert.equal(announces(viewer).length,0);clear();
 // Client packets cannot forge announcements, even after authentication.
 S.onMessage(reconnect,{type:'global-announcement',event:{kind:'online',name:'forged'}});S.onMessage(anon,{type:'global-announcement',event:{kind:'online',name:'forged'}});assert.equal(announces(viewer).length,0);
 function edit(fn){const u=A.loadUser('hero'),a=JSON.parse(u.save.data['hs-account-v1']);fn(a);u.save.data['hs-account-v1']=JSON.stringify(a);A.saveUser(u);return a;}
 const env={now:Date.now(),rand:()=>.5};edit(a=>E.ACC.newMon(a,'wind',5,env));assert.equal(announces(viewer).length,0);
 edit(a=>E.ACC.newMon(a,'bali',5,env));assert.equal(announces(viewer)[0].rarity,'rare');assert.equal(announces(reconnect)[0].mon.sid,'bali');assert.equal(announces(anon).length,0);clear();
 edit(a=>E.ACC.newMon(a,'firemouse',18,env));assert.equal(announces(viewer).length,0);edit(a=>{a.fmNpc=1;E.ACC.newMon(a,'firemouse',18,env);});assert.equal(announces(viewer)[0].rarity,'special');clear();
 edit(a=>E.ACC.newMon(a,'aegis',10,env));assert.equal(announces(viewer)[0].rarity,'special');clear();
 edit(a=>{const m=E.ACC.newMon(a,'wind',5,env);m.shiny=2;});assert.equal(announces(viewer)[0].rarity,'special');assert.equal(announces(viewer)[0].mon.shiny,2);clear();
 function battle(res,d=0){edit(a=>{const st=E.PVE.MODES.boss.start(a,{k:'tiger',d},env);assert(!st.err,st.err);E.PVE.MODES.boss.end(a,st.ctx,{res,seen:[true],downs:res==='win'?[{lv:25}]:[]},env);});}
 battle('lose');assert.equal(announces(viewer).length,0);battle('win');let got=announces(viewer);assert(got.some(e=>e.kind==='boss'&&e.first&&e.bossInfo.name==='泰戈尔'&&e.bossInfo.diff==='简单'));assert(got.some(e=>e.kind==='mon'&&e.mon.sid==='tagore'&&e.rarity==='special'));clear();
 battle('win');assert.equal(announces(viewer).length,1);assert.equal(announces(viewer)[0].kind,'boss');assert.equal(announces(viewer)[0].first,false);clear();let feed=(await api('/api/activity',tokens.offline)).items;assert.equal(feed.filter(e=>e.kind==='boss').length,2);assert.equal(feed.filter(e=>e.kind==='boss'&&e.first).length,1);assert(feed.some(e=>e.kind==='mon'&&e.rarity==='rare'));assert(feed.some(e=>e.kind==='mon'&&e.rarity==='special'));
 battle('win',1);assert(announces(viewer).some(e=>e.kind==='boss'&&e.bossInfo.diff==='普通'));clear();
 const count=(await api('/api/activity',tokens.watcher)).items.length;A.saveUser(A.loadUser('hero'));assert.equal((await api('/api/activity',tokens.watcher)).items.length,count);assert.equal(announces(viewer).length,0);
 edit(a=>a.bosses.tiger.wins=0);edit(a=>a.bosses.tiger.wins=2);assert.equal(announces(viewer).length,0);assert.equal((await api('/api/activity',tokens.watcher)).items.length,count);
 // Weekly victories also produce a broadcast, without presenting them as a regular first clear.
 edit(a=>a.bosses['tiger:w0']={wins:1,tries:1});assert.equal(announces(viewer).length,1);assert.equal(announces(viewer)[0].bossInfo.weekly,true);clear();feed=(await api('/api/activity',tokens.watcher)).items;assert(feed.some(e=>e.kind==='boss'&&e.bossInfo.weekly));
 assert.equal(activity.monClass(E,{sid:'wind'}),null);assert.equal(activity.monClass(E,{sid:'phantom'}),'special');assert.equal(activity.monClass(E,{sid:'not-a-mon'}),null);
 // Old/imported accounts establish a baseline without replaying achievements to online users.
 const legacy=A.loadUser('hero');delete legacy.activityState;fs.writeFileSync(path.join(dir,'users',Buffer.from('hero').toString('hex')+'.json'),JSON.stringify(legacy));A.saveUser(A.loadUser('hero'));assert.equal(announces(viewer).length,0);
 const late=socket('offline');assert(announces(late).every(e=>e.kind==='online'));assert(!announces(late).some(e=>e.kind==='mon'||e.kind==='boss'));
 const anonBefore=anon.messages.length;S.onMessage(anon,{type:'auth',token:'bad'});assert.equal(announces(anon).length,0);assert(anon.messages.length>anonBefore);
 console.log('PASS broadcast: authenticated online recipients, login/multi-tab/reconnect dedup, no forged packets, rare/special/shiny classification, real boss wins/loss/repeat/difficulties/weekly feed, rollback/import suppression');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{sockets.forEach(w=>S.onClose(w));server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
