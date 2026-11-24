'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-friends-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),S=require('../server/social');
require('../server/dm');require('../server/friendpt');require('../server/helpuse');require('../server/farm');require('../server/steal');
const E=T.engine(),server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function api(url,token,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
 const tokens={};for(const name of ['alice','bobby','carol']){
  const a={v:1,name,introDone:true,mons:[],next:1,teams:[[]],active:0,story:name==='carol'?{}:{tea:{done:true},plant:{done:true}},items:{},energy:0,exp:0};
  const m=E.ACC.newMon(a,'leaf',60,{now:Date.now(),rand:()=>.5});a.card={show:[m.u],helpers:[m.u]};
  const out=await api('/api/register',null,{user:name,pass:'everyone-test-password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(out.status,200);tokens[name]=out.token;
  assert.equal((A.loadUser(name).friends||[]).length,0);
 }
 assert(A.areFriends('alice','bobby'));assert(A.areFriends('bobby','alice'));assert(!A.areFriends('alice','alice'));assert(!A.areFriends('alice','missing'));
 assert.equal((await api('/api/players')).status,401);
 for(const user of ['alice','bobby']){const list=await api('/api/players',tokens[user]);assert.equal(list.players.filter(p=>p.friend).length,2);assert(list.players.filter(p=>!p.me).every(p=>p.friend));}
 assert.equal((await api('/api/card?user=bobby',tokens.alice)).friend,true);
 const old=await api('/api/friends',tokens.alice,{user:'bobby',on:false});assert.equal(old.status,200);assert.deepEqual(old.friends.sort(),['bobby','carol']);assert.equal((await api('/api/card?user=bobby',tokens.alice)).friend,true);
 assert.equal((await api('/api/friends',tokens.alice,{user:'missing',on:true})).status,404);
 const helpers=await api('/api/helpers',tokens.alice);assert.deepEqual(helpers.helpers.map(h=>h.user).sort(),['bobby','carol']);assert(S.friendHelper('alice','bobby',1));assert.equal(S.friendHelper('alice','bobby',999),null);assert.equal(S.friendHelper('alice','alice',1),null);
 assert.equal((await api('/api/helper-use',tokens.alice,{owner:'bobby'})).ok,true);assert.equal((await api('/api/helper-use',tokens.alice,{owner:'alice'})).ok,false);
 assert.equal((await api('/api/dm?with=bobby',tokens.alice)).canSend,true);
 assert.equal((await api('/api/dm',tokens.alice,{to:'bobby',text:'一起去看看新星球吧'})).status,200);
 assert.equal((await api('/api/dm?with=alice',tokens.bobby)).msgs.length,1);
 assert.deepEqual((await api('/api/dm?with=bobby',tokens.carol)).msgs,[]);assert.deepEqual((await api('/api/dm-list',tokens.carol)).convs,[]);
 assert.equal((await api('/api/dm',tokens.alice,{to:'alice',text:'你好'})).status,400);
 assert.equal((await api('/api/fp-gift',tokens.alice,{user:'bobby'})).status,200);assert.equal((await api('/api/fp-gift',tokens.alice,{user:'bobby'})).status,400);assert.equal((await api('/api/fp-gift',tokens.alice,{user:'alice'})).status,400);
 assert.equal((await api('/api/home?user=bobby',tokens.alice)).friend,true);assert.equal((await api('/api/home?user=carol',tokens.alice)).open,false);
 assert.equal((await api('/api/farm?user=bobby',tokens.alice)).friend,true);assert.equal((await api('/api/farm?user=carol',tokens.alice)).open,false);
 assert.equal((await api('/api/farm-log?user=bobby',tokens.alice)).status,403);
 assert.equal((await api('/api/tx',tokens.alice,{v:T.VERSION,op:'homeSteal',args:{owner:'carol',u:1}})).status,400);
 for(const name of Object.keys(tokens))assert.equal((A.loadUser(name).friends||[]).length,0);
 console.log('PASS all-server friends: empty legacy lists, symmetric membership, old-client compatibility, helpers, direct messages and privacy, gift dedup, locked bases/farms and private logs');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
