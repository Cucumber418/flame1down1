'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'flame-knight-'));
const A=require('../server/accounts'),T=require('../server/tx');require('../server/pve');const E=T.engine(),C=E.CHRISTMAS,env={now:Date.now(),rand:()=>0},copy=x=>JSON.parse(JSON.stringify(x));
function account(){const a={v:1,name:'仙境旅人',created:env.now,introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{},exp:0,energy:0,christmasStory:{cabinOpen:true,cabinIntro:true,shopOpen:true,shopIntro:true}};for(const k of ['school','river','jiuquan'])a.story[k]={done:true,rewarded:true};for(let i=0;i<5;i++){const m=E.ACC.newMon(a,'barlow',100,env);m.moves=['能量弹','切裂','践踏','纯净护盾'];a.teams[0].push(m.u);}return a;}
const solved=Array(16).fill(0),mode=E.PVE.MODES.christmasKnight,R=E.PVE.regionById('hl_wonderland');
assert(C.pipeSolved(solved));assert(!C.pipeSolved(C.PIPE_START));
for(const bad of [undefined,null,[],Array(15).fill(0),Array(16).fill('0'),Array(16).fill(-1),Array(16).fill(4),Array(16).fill(.5)])assert(!C.pipeSolved(bad));
let a=account();assert(!E.PVE.regionOpen(a,R));assert(mode.start(a,{slot:0,id:1},env).err);assert(!E.TX.run(a,'christmas',{a:'knightIntro'},env).ok);
for(const bad of [C.PIPE_START,[],Array(16).fill(4)]){const before=copy(a);assert(!E.TX.run(a,'christmas',{a:'pipes',rot:bad},env).ok);assert.deepEqual(copy(a),before);}
a.christmasStory.shopIntro=false;assert(!E.TX.run(a,'christmas',{a:'pipes',rot:solved},env).ok);a.christmasStory.shopIntro=true;
assert(E.TX.run(a,'christmas',{a:'pipes',rot:solved},env).ok);assert(C.wonderOpen(a));assert(E.PVE.regionOpen(a,R));assert(E.TX.run(a,'christmas',{a:'pipes',rot:solved},env).already);assert(!E.TX.run(a,'christmas',{a:'knightVisit'},env).ok);
assert(E.TX.run(a,'christmas',{a:'knightIntro'},env).ok);assert(E.TX.run(a,'christmas',{a:'knightVisit'},env).ok);assert.deepEqual(copy(C.story(a).knight.slots.map(x=>x.lv)),[50,60,70]);const targets=copy(C.story(a).knight.slots);
assert(E.TX.run(a,'christmas',{a:'knightVisit'}, {...env,rand:()=>.99}).ok);assert.deepEqual(copy(C.story(a).knight.slots),targets);
for(const args of [{slot:-1,id:1},{slot:3,id:1},{slot:0,id:999},{slot:'0',id:1}])assert(mode.start(a,args,env).err);
for(let slot=0;slot<3;slot++){
 const t=copy(C.story(a).knight.slots[slot]),st=mode.start(a,{slot,id:t.id},env);assert.equal(st.a.length,1);assert.equal(st.a[0].lv,50+slot*10);assert.equal(st.a[0].id,t.sid);assert.equal(st.p.length,5);
 const before=copy(C.story(a).knight);for(const res of ['lose','flee','void'])assert.equal(mode.end(a,st.ctx,{res,quit:res==='lose'},env).candy,0);assert.deepEqual(copy(C.story(a).knight),before);
 const B={res:'win',quit:false,seen:[true,false,false,false,false],downs:[{id:t.sid,lv:t.lv}]};const candy=a.items.xmasCandy||0,r=mode.end(a,st.ctx,B,env);assert.equal(r.candy,[5,8,12][slot]);assert.equal(a.items.xmasCandy,candy+r.candy);assert.notEqual(C.story(a).knight.slots[slot].id,t.id);assert.equal(C.story(a).knight.slots[slot].lv,t.lv);
 assert(mode.start(a,{slot,id:t.id},env).err);assert.equal(mode.end(a,st.ctx,B,env).candy,0);assert.equal(a.items.xmasCandy,candy+r.candy);
}
assert.equal(C.story(a).knight.wins,3);assert.equal(a.items.xmasCandy,25);
a.items.xmasCandy=200;for(const [id,n,cost] of [['fruit1',3,60],['fruit2',2,100]]){assert(E.TX.run(a,'christmas',{a:'buy',id,n},env).ok);assert.equal(a.items[id],n);assert.equal(a.items.xmasCandy,id==='fruit1'?140:40);}const before=copy(a);assert(!E.TX.run(a,'christmas',{a:'buy',id:'fruit2',n:1},env).ok);assert.deepEqual(copy(a),before);
// Real API: permissions, server-owned targets, loss retention, reward replay and refresh/resume.
const server=http.createServer((q,r)=>{if(!A.handle(q,r)){r.statusCode=404;r.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
let r=await api('/api/register',{user:'knighttest',pass:'knight-test-password',data:{'hs-account-v1':JSON.stringify(account())}});token=r.token;assert(token);const rules=T.RULES_VERSION;
assert.equal((await api('/api/pve',{op:'start',kind:'christmasKnight',args:{slot:0,id:1},rules})).status,400);
for(const args of [{a:'pipes',rot:C.PIPE_START},{a:'knightVisit'},{a:'knightIntro'}])assert.equal((await api('/api/tx',{op:'christmas',args,rules})).status,400);
for(const args of [{a:'pipes',rot:solved},{a:'knightIntro'},{a:'knightVisit'}])assert((await api('/api/tx',{op:'christmas',args,rules})).ok);
const saved=()=>api('/api/me').then(r=>JSON.parse(r.save.data['hs-account-v1']));let acc=await saved(),target=acc.christmasStory.knight.slots[0];
const request={op:'start',kind:'christmasKnight',args:{slot:0,id:target.id,sid:'pluto',lv:1,candy:999},rules,ui:{bg:E.BG.hl_wonderland,back:'圣诞仙境',route:{view:'field',planet:'helena',region:'hl_wonderland',scene:0}}};
r=await api('/api/pve',request);assert(r.ok);assert.equal(r.S.sides[1].team.length,1);assert.equal(r.S.sides[1].team[0].id,target.sid);assert.equal(r.S.sides[1].team[0].lv,50);let bid=r.bid;
r=await api('/api/pve',{op:'quit',seq:1,bid});assert(r.end);assert.equal(r.end.rep.candy,0);assert.equal((await saved()).christmasStory.knight.slots[0].id,target.id);
r=await api('/api/pve',request);assert(r.ok);bid=r.bid;
r=await api('/api/pve',{op:'act',seq:1,bid,a:{kind:'move',i:3}});assert(r.ok);let resumed=await api('/api/pve',{op:'resume'});assert(resumed.pending);assert.deepEqual(resumed.S,r.S);assert.equal(resumed.ui.route.region,'hl_wonderland');
let seq=1,last;
for(let i=0;i<120&&!r.end;i++){last=r.S.needSwitch?{op:'repl',k:r.S.sides[0].team.findIndex((m,i)=>!m.fainted&&i!==r.S.sides[0].active)}:{op:'act',a:{kind:'move',i:0}};r=await api('/api/pve',{...last,seq:++seq,bid});assert(r.ok);}
assert(r.end);assert.equal(r.end.res,'win');assert.equal(r.end.rep.candy,5);assert.equal(r.end.rewards.items.xmasCandy,5);acc=await saved();assert.equal(acc.items.xmasCandy,5);assert.notEqual(acc.christmasStory.knight.slots[0].id,target.id);const again=await api('/api/pve',{...last,seq,bid});assert.deepEqual(again,r);assert.equal((await saved()).items.xmasCandy,5);assert.equal((await api('/api/pve',request)).status,400);
console.log('PASS Christmas pipes and gates, target persistence/levels, loss retry, stale target rejection, per-tier rewards, duplicate settlement, candy fruits; real server battle, refresh/resume and idempotent reward replay');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});});
