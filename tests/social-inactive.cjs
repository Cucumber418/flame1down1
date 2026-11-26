'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'flame-inactive-'));
const A=require('../server/accounts'),T=require('../server/tx'),social=require('../server/social'),E=T.engine(),sockets=[],realNow=Date.now;
const now=realNow(),limit=14*864e5;Date.now=()=>now;
const server=http.createServer((q,r)=>{if(!A.handle(q,r)){r.statusCode=404;r.end();}});
function fixture(name){const a={name,introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{},exp:0};const m=E.ACC.newMon(a,'leaf',60,{now,rand:()=>.5});a.teams[0]=[m.u];return a;}
function edit(name,fn){const u=A.loadUser(name);fn(u);A.saveUser(u);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,tokens={};
async function api(url,user,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+tokens[user]}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,...await r.json()};}
for(const name of ['viewer','recent','stale','older','legacy','returner']){const r=await api('/api/register',null,{user:name,pass:'inactive-password',data:{'hs-account-v1':JSON.stringify(fixture(name))}});assert(r.token);tokens[name]=r.token;assert.equal(A.loadUser(name).lastOnline,now);}
edit('viewer',u=>u.lastOnline=now-limit*2);edit('recent',u=>u.lastOnline=now-limit+1);edit('stale',u=>u.lastOnline=now-limit);edit('older',u=>u.lastOnline=now-limit-1);edit('returner',u=>u.lastOnline=now-limit*2);
edit('legacy',u=>{delete u.lastOnline;const a=JSON.parse(u.save.data['hs-account-v1']);a.checkin={lastLogin:E.ACC.dayStr(now-16*864e5)};u.save.data['hs-account-v1']=JSON.stringify(a);u.save.savedAt=now;});
let r=await api('/api/players','viewer');assert.deepEqual(r.players.map(p=>p.user).sort(),['recent','viewer']);for(const p of r.players){assert(!('lastOnline'in p));assert(!('lastSeen'in p));assert(!('hidden'in p));}
// Server-only rewards/save timestamps do not make inactive players look recently online.
edit('stale',u=>{const a=JSON.parse(u.save.data['hs-account-v1']);a.items.xmasCandy=3;u.save.data['hs-account-v1']=JSON.stringify(a);u.save.savedAt=now;});assert(!(await api('/api/players','viewer')).players.some(p=>p.user==='stale'));
assert((await api('/api/card?user=stale','viewer')).friend);assert(A.areFriends('viewer','stale'));
// A hidden player's own view always includes themselves, and a successful login restores public visibility.
assert((await api('/api/players','older')).players.some(p=>p.me&&p.user==='older'));
r=await api('/api/login',null,{user:'returner',pass:'inactive-password'});assert(r.token);assert.equal(A.loadUser('returner').lastOnline,now);assert((await api('/api/players','viewer')).players.some(p=>p.user==='returner'));
// Existing-session WebSocket auth also restores visibility, without requiring a new password login.
const w={readyState:1,messages:[],send(s){this.messages.push(JSON.parse(s));}};sockets.push(w);social.onOpen(w);social.onMessage(w,{type:'auth',token:tokens.stale,pv:2});assert.equal(A.loadUser('stale').lastOnline,now);assert((await api('/api/players','viewer')).players.some(p=>p.user==='stale'&&p.online));
edit('stale',u=>u.lastOnline=now-limit*2);assert((await api('/api/players','viewer')).players.some(p=>p.user==='stale'&&p.online));const rev=A.loadUser('stale').save.rev;A.touchOnline('stale');assert.equal(A.loadUser('stale').lastOnline,now);assert.equal(A.loadUser('stale').save.rev,rev);
social.onClose(w);sockets.pop();assert.equal(A.loadUser('stale').lastOnline,now);const file=path.join(process.env.DATA_DIR,'users',Buffer.from('stale').toString('hex')+'.json');assert.equal(JSON.parse(fs.readFileSync(file)).lastOnline,now);assert((await api('/api/players','viewer')).players.some(p=>p.user==='stale'&&!p.online));
// Legacy users can be restored by a known recent login day even if their save was last written earlier.
edit('legacy',u=>{delete u.lastOnline;u.save.savedAt=now-limit*2;const a=JSON.parse(u.save.data['hs-account-v1']);a.checkin.lastLogin=E.ACC.dayStr(now-864e5);u.save.data['hs-account-v1']=JSON.stringify(a);});assert((await api('/api/players','viewer')).players.some(p=>p.user==='legacy'));
assert.equal((await api('/api/players')).status,401);assert(!fs.readFileSync(path.join(__dirname,'../js/data/changelog.js'),'utf8').includes('两周未上线'));
console.log('PASS inactive player list: exact 14-day boundary, self/online exceptions, metadata separate from auto-save/rewards, legacy real-login fallback, login/token reconnect restoration, durable disconnect/heartbeat timestamps, unchanged save revision/friendship/profile access and no public timestamps');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{sockets.forEach(w=>social.onClose(w));Date.now=realNow;server.close();server.closeAllConnections();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
