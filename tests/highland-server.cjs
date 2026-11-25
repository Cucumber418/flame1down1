'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),cp=require('child_process');
if(process.env.HIGHLAND_TEST_WORKER){const A=require('../server/accounts');require('../server/tx');require('../server/pve');require('../server/highland');const s=http.createServer((q,r)=>{if(!A.handle(q,r)){r.statusCode=404;r.end();}});s.listen(0,'127.0.0.1',()=>process.send(s.address().port));return;}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-highland-'));process.env.DATA_DIR=dir;
const T=require('../server/tx'),E=T.engine(),H=E.HIGHLAND,env={now:Date.now(),rand:()=>.5};let child,base,token;
function fixture(){const a={v:1,name:'高地挑战者',created:env.now,introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{pot200:200,xmasBell:10,highlandPt:1200},exp:0,energy:0,christmasStory:{cabinOpen:true,cabinIntro:true,shopOpen:true,shopIntro:true,wonderOpen:true,knightIntro:true,knight:{wins:1}}};for(const k of ['school','river','jiuquan'])a.story[k]={done:true,rewarded:true};for(let i=0;i<5;i++){const m=E.ACC.newMon(a,'glen',100,env);m.moves=['破石之蹄','孤高之蹄','孤王之傲','碎震裂踢'];a.teams[0].push(m.u);}return a;}
async function launch(){child=cp.fork(__filename,[],{env:{...process.env,HIGHLAND_TEST_WORKER:'1'},stdio:['ignore','pipe','pipe','ipc']});let errors='';child.stderr.on('data',d=>errors+=d);base='http://127.0.0.1:'+await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('exit',c=>reject(new Error('worker '+c+': '+errors)));});}
async function stop(){if(!child)return;const c=child;child=null;await new Promise(r=>{c.once('exit',r);c.kill('SIGTERM');});}
async function api(route,body,method){const r=await fetch(base+route,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,...await r.json()};}
const req=(op,args={})=>api('/api/pve',{op,...args,rules:T.RULES_VERSION}),saved=()=>api('/api/me').then(r=>({me:r,a:JSON.parse(r.save.data['hs-account-v1'])}));
(async()=>{await launch();assert.equal((await api('/api/highland')).status,401);let r=await api('/api/register',{user:'highlandtest',pass:'highland-test-password',data:{'hs-account-v1':JSON.stringify(fixture())}});token=r.token;assert(token);
assert.equal((await req('start',{kind:'highland',args:{}})).status,400);
for(const id of H.FRIENDS)assert((await api('/api/tx',{op:'highland',args:{a:'talk',id},rules:T.RULES_VERSION})).ok);
assert((await api('/api/tx',{op:'highland',args:{a:'intro'},rules:T.RULES_VERSION})).ok);
for(const id of ['talent','essence'])assert((await api('/api/tx',{op:'highland',args:{a:'buy',id,n:1},rules:T.RULES_VERSION})).ok);let acc=(await saved()).a;assert.equal(acc.items.e_glen,1);assert.equal(acc.items.ivGlen,1);assert.equal(acc.items.highlandPt,0);assert.equal(acc.items.xmasBell,0);
r=await req('start',{kind:'highland',args:{hp:1,lv:1,damage:1e9,turns:1},ui:{bg:E.BG.hl_highland,back:'格伦高地',route:{view:'field',planet:'helena',region:'hl_wonderland',scene:1}}});assert(r.ok);assert.equal(r.S.sides[1].team[0].lv,50);assert.equal(r.S.sides[1].team[0].maxhp,1000000);assert.equal(r.S.worldBoss.limit,20);let bid=r.bid;
r=await req('act',{bid,seq:1,a:{kind:'move',i:0}});assert(r.ok);assert(r.S.worldBoss.damage>0);const live=r.S;
await stop();await launch();r=await req('resume');assert(r.pending);assert.equal(r.bid,bid);assert.deepEqual(r.S,live);assert.equal(r.ui.route.scene,1);
r=await req('quit',{bid,seq:2});assert(r.end);assert(!r.end.rep.counted);assert.equal((await saved()).a.christmasStory.highland.total,undefined);assert.equal((await api('/api/highland')).players,0);
let total=0;
for(let run=0;run<5;run++){
 r=await req('start',{kind:'highland',args:{}});assert(r.ok);bid=r.bid;assert.equal(r.S.sides[1].team[0].hp,1000000);assert.equal(r.S.worldBoss.damage,0);let seq=0,last;
 for(let turn=0;turn<40&&!r.end;turn++){
  const me=r.S.sides[0].team[r.S.sides[0].active];last=r.S.needSwitch?{op:'repl',k:r.S.sides[0].team.findIndex(m=>!m.fainted)}:{op:'act',a:me.hp<me.maxhp*.75?{kind:'item',key:'pot200'}:{kind:'move',i:me.moves[1].pp>0?1:0}};
  r=await req(last.op,{...last,bid,seq:++seq});assert(r.ok,JSON.stringify(r));
 }
 assert(r.end,'trial must stop by round20');assert.equal(r.end.res,'win');assert(r.end.rep.counted);assert.equal(r.end.rep.used,run+1);assert.equal(r.S.turn,21);assert(r.end.rep.damage>0);total+=r.end.rep.damage;
 const repeated=await req(last.op,{...last,bid,seq});assert.deepEqual(repeated,r);assert.equal((await saved()).a.christmasStory.highland.runs,run+1);
}
assert.equal((await req('start',{kind:'highland',args:{}})).status,400);acc=(await saved()).a;assert.equal(acc.christmasStory.highland.total,total);assert(acc.items.highlandPt>=350);
for(const scope of ['total','today']){const b=await api('/api/highland?scope='+scope);assert(b.ok);assert.equal(b.me.damage,total);assert.equal(b.me.runs,5);assert.equal(b.total,total);assert.equal(b.rows.length,1);}
assert.equal((await api('/api/highland?page=-1')).status,400);
// Client-uploaded rank, daily allowance and currency tampering are restored by existing server-owned-field checks.
let {me,a}=await saved(),data=me.save.data;a.christmasStory.highland.total=999999999;a.christmasStory.highland.day.used=0;a.items.highlandPt=99999;data['hs-account-v1']=JSON.stringify(a);
await api('/api/save',{data,rev:me.save.rev,claims:[]},'PUT');acc=(await saved()).a;assert.equal(acc.christmasStory.highland.total,total);assert.equal(acc.christmasStory.highland.day.used,5);assert(acc.items.highlandPt<99999);
const A=require('../server/accounts');for(let i=0;i<12;i++){const seed=fixture();seed.name='排行旅人'+i;seed.christmasStory.highland={total:total+10000+i*100,best:1000,runs:2,day:{date:E.ACC.dayStr(Date.now()),used:1,damage:1000+i}};A.saveUser({name:'rankseed'+i,created:env.now,save:{rev:1,savedAt:env.now,data:{'hs-account-v1':JSON.stringify(seed)}}});}let first=await api('/api/highland'),second=await api('/api/highland?page=1');assert.equal(first.players,13);assert.equal(first.pages,2);assert.equal(first.rows.length,10);assert.equal(second.rows.length,3);assert.equal(new Set(first.rows.concat(second.rows).map(r=>r.user)).size,13);assert.equal(first.rows[0].damage,total+11100);assert(first.me.rank>10);assert.deepEqual(Object.keys(first.rows[0]).sort(),['best','damage','name','rank','runs','user']);
console.log('PASS highland API: auth, gated dialogs, dual-currency exchanges, authoritative boss, real 20-round battles, server restart/resume, free retreat, five daily settlements, replay idempotence, live today/total leaderboard and forged-save rejection');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
