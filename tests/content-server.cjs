'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-content-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx'),S=require('../server/social');for(const f of ['board','bossboard','dm','homelog'])require('../server/'+f);
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}}),E=T.engine(),tokens={},sockets=[];
const read=user=>JSON.parse(A.loadUser(user).save.data['hs-account-v1']),write=(user,a)=>{const u=A.loadUser(user);u.save.data['hs-account-v1']=JSON.stringify(a);A.saveUser(u);};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function api(user,url,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(tokens[user]?{Authorization:'Bearer '+tokens[user]}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,...await r.json()};}
 for(const user of ['filtertest','cleanpeer']){const a={v:1,name:user,introDone:true,mons:[],next:1,teams:[[]],active:0,items:{nameTag:1},exp:0,energy:0,story:{tea:{done:true}},home:{mons:[],name:'我的基地'},card:{motto:'你好'},tNames:['一队'],bosses:{tiger:{wins:1}},hlFix:1};E.ACC.newMon(a,'leaf',5,{now:Date.now(),rand:()=>0});let r=await api(null,'/api/register',{user,pass:'习近平傻逼password',data:{'hs-account-v1':JSON.stringify(a)}});assert.equal(r.status,200);tokens[user]=r.token;}
 let r=await api(null,'/api/register',{user:'习近平',pass:'clean-password'});assert.equal(r.status,400);assert.equal(A.loadUser('习近平'),null);
 r=await api(null,'/api/register',{user:'badseed',pass:'clean-password',data:{'hs-account-v1':JSON.stringify({...read('filtertest'),name:'傻逼'})}});assert.equal(r.status,400);assert.equal(A.loadUser('badseed'),null);
 const put=async mutate=>{const u=A.loadUser('filtertest'),a=read('filtertest');mutate(a);const r=await api('filtertest','/api/save',{rev:u.save.rev,data:{...u.save.data,'hs-account-v1':JSON.stringify(a)},claims:[]},'PUT');return r;};
 for(const mutate of [a=>a.name='傻逼',a=>a.home.name='习近平',a=>a.card.motto='六合彩',a=>a.tNames[0]='傻逼',a=>a.mons[0].nickname='成人电影']){const before=JSON.stringify(A.loadUser('filtertest').save);r=await put(mutate);assert.equal(r.status,400);assert.match(r.error,/敏感词/);assert.equal(JSON.stringify(A.loadUser('filtertest').save),before);}
 const tx=(op,args)=>api('filtertest','/api/tx',{v:T.VERSION,op,args});assert.equal((await tx('mitem',{u:1,k:'nameTag'})).status,200);const before=read('filtertest');assert.equal((await tx('monRename',{u:1,name:'习 近 平'})).status,400);assert.deepEqual(read('filtertest'),before);assert.equal((await tx('monRename',{u:1,name:'小叶'})).status,200);
 for(const [url,body] of [['/api/board',{}],['/api/boss-post',{k:'tiger',d:0,stars:4}],['/api/dm',{to:'cleanpeer'}],['/api/home-msg',{owner:'filtertest'}]]){r=await api('filtertest',url,{...body,text:'傻\u200b逼'});assert.equal(r.status,400,url);assert.match(r.error,/敏感词/);}
 assert.equal((await api('filtertest','/api/board',{text:'网络正常，一起玩吧'})).status,200);
 assert.equal((await api('filtertest','/api/home-msg',{owner:'filtertest',text:'欢迎来到我的基地'})).status,200);
 assert.equal((await api('filtertest','/api/boss-post',{k:'tiger',d:0,stars:4,text:'注意回复体力'})).status,200);
 assert.equal((await api('filtertest','/api/friends',{user:'cleanpeer',on:true})).status,200);
 assert.equal((await api('filtertest','/api/dm',{to:'cleanpeer',text:'一起挑战吧'})).status,200);
 assert.equal((await api('filtertest','/api/home-ev',{owner:'cleanpeer',kind:'poke',mon:'习近平'})).status,400);
 function socket(user){const w={readyState:1,messages:[],send(v){this.messages.push(JSON.parse(v));}};sockets.push(w);S.onOpen(w);S.onMessage(w,{type:'auth',token:tokens[user]});return w;}
 const host=socket('cleanpeer'),viewer=socket('filtertest');S.onMessage(host,{type:'cast',op:'start',head:{label:'测试对战'}});viewer.watching=host;host.cast.viewers.push(viewer);viewer.messages=[];
 S.onMessage(viewer,{type:'danmaku',user:'cleanpeer',text:'习近平'});assert(viewer.messages.some(x=>x.type==='content-error'));assert.equal(viewer.dmAt,undefined);assert(!viewer.messages.some(x=>x.op==='dm'));
 viewer.messages=[];S.onMessage(viewer,{type:'danmaku',user:'cleanpeer',text:'加油'});assert(viewer.messages.some(x=>x.op==='dm'&&x.text==='加油'));
 let legacy=read('filtertest');legacy.name='傻逼';write('filtertest',legacy);assert.equal((await put(a=>a.active=0)).status,200);assert.equal((await api(null,'/api/login',{user:'filtertest',pass:'习近平傻逼password'})).status,200);
 console.log('PASS content API: raw registration/save bypasses rejected, legacy and passwords preserved, rename atomicity, public/private messages, boss guide, home events and WebSocket filtering without rate consumption');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{sockets.forEach(w=>S.onClose(w));server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
