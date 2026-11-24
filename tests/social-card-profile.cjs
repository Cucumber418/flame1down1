'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-card-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),season=require('../js/data/rank-season');require('../server/social');const E=T.engine();
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function api(url,token,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
 const a={name:'名片主人',introDone:true,mons:[],next:1,teams:[[]],active:0,items:{},exp:0,story:{},emblems:{leaf:1},card:{show:[1]}};
 const m=E.ACC.newMon(a,'leaf',70,{now:1234567890000,rand:()=>.5});m.ev={atk:240,hp:100};m.evFree=32;m.ins=['ins_atk2','ins_hp1',null];m.insX=true;m.nickname='小叶';m.renameUnlocked=true;m.lvCap=80;
 E.ACC.newMon(a,'bali',50,{now:1234567890000,rand:()=>.5});
 const owner=await api('/api/register',null,{user:'owner',pass:'card-test-password',data:{'hs-account-v1':JSON.stringify(a)}}),viewer=await api('/api/register',null,{user:'viewer',pass:'card-test-password'});assert.equal(owner.status,200);assert.equal(viewer.status,200);
 let u=A.loadUser('owner');u.save.data['hs-rank-history-v1']=JSON.stringify({S1:{rank:{r:3,best:4,bestDv:3,w:125,l:27},rewards:{private:'must not leak'}},S2:{rank:{r:10,w:999}},S9:{rank:{r:10}}});A.saveUser(u);
 assert.equal((await api('/api/card?user=owner')).status,401);
 let c=await api('/api/card?user=owner',viewer.token);assert.deepEqual(c.badges,[{id:'S1',best:4,bestDv:3,kingBest:0,w:125,l:27}]);assert.equal(c.show.length,1);const shown=c.show[0];assert.deepEqual(shown.iv,JSON.parse(JSON.stringify(m.iv)));assert.deepEqual(shown.ev,m.ev);assert.equal(shown.evFree,32);assert.deepEqual(shown.ins,m.ins);assert.equal(shown.insX,true);assert.equal(shown.nickname,'小叶');assert.equal(shown.got,m.got);assert.equal(shown.lvCap,80);assert.equal(shown.emblem,true);assert(!JSON.stringify(c).includes('must not leak'));assert(!JSON.stringify(c.show).includes('bali'));assert(!('items'in c));assert(!('u'in shown));
 // Selecting badges is editable, but fabricated season IDs and forged archive statistics are ignored.
 u=A.loadUser('owner');let edited=JSON.parse(u.save.data['hs-account-v1']);edited.card.badges=['S9'];let data=Object.assign({},u.save.data,{'hs-account-v1':JSON.stringify(edited),'hs-rank-history-v1':JSON.stringify({S1:{rank:{r:10,w:999999}}})});
 assert.equal((await api('/api/save',owner.token,{rev:u.save.rev,data,claims:[]},'PUT')).status,200);assert.deepEqual((await api('/api/card?user=owner',viewer.token)).badges,[]);
 u=A.loadUser('owner');edited=JSON.parse(u.save.data['hs-account-v1']);edited.card.badges=['S1','S9'];u.save.data['hs-account-v1']=JSON.stringify(edited);A.saveUser(u);assert.deepEqual((await api('/api/card?user=owner',viewer.token)).badges,c.badges);
 const king=season.badges({'hs-rank-history-v1':JSON.stringify({S1:{rank:{r:10,best:10,stars:7,kingBest:42,w:6,l:9}}})})[0];assert.equal(king.kingBest,42);assert.equal(king.bestDv,null);
 assert.deepEqual(season.badges({}),[]);assert.deepEqual((await api('/api/card?user=viewer',owner.token)).badges,undefined);
 // The badge projection never mutates the season archive.
 const before=JSON.stringify(u.save.data);season.shownBadges(u.save.data,[]);assert.equal(JSON.stringify(u.save.data),before);
 console.log('PASS card badges: archived highest division/stars and W/L, selection/forgery protection, displayed-monster-only public training/inscription data, auth and privacy');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
