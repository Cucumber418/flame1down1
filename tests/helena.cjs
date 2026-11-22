'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flame-helena-'));process.env.DATA_DIR=dir;
const A=require('../server/accounts'),T=require('../server/tx');require('../server/pve');
const E=T.engine(),env={now:Date.now(),rand:()=>.5},copy=x=>JSON.parse(JSON.stringify(x));
function fixture(open=true){const a={v:1,name:'雪旅人',introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{},energy:10000,exp:0};if(open)for(const id of ['school','river','jiuquan'])a.story[id]={done:true,rewarded:true,core:true,gave:{bribe:true}};const m=E.ACC.newMon(a,'barlow',100,env);m.moves=['能量弹','践踏','切裂','遁走'];a.teams[0]=[m.u];return a;}
const regions=E.WILD_REGIONS.filter(r=>r.planet==='helena'),castle=E.PVE.regionById('hl_castle');assert.equal(regions.length,1);
for(const R of regions){assert(!E.PVE.regionOpen(fixture(false),R));assert(E.PVE.regionOpen(fixture(),R));assert.equal(E.PVE.sceneCount(R),3);for(const b of R.bgs)assert(fs.existsSync(path.join(__dirname,'..',E.BG[b])));}
for(const missing of ['school','river','jiuquan']){const a=fixture();delete a.story[missing];assert(!E.PVE.helenaOpen(a));}
assert.equal(E.PVE.wildRoll(fixture(),castle,0,'hl_castle','',()=>0).sid,'barlow');assert.equal(E.PVE.wildRoll(fixture(),castle,0,'hl_castle','',()=>.999).sid,'bali');assert.equal(E.PVE.wildRoll(fixture(),castle,1,'hl_castle','',()=>0),null);
assert.equal(E.PVE.wildRoll(fixture(),castle,0,'kb_isle','horn',()=>0),null);assert.equal(E.PVE.wildRoll(fixture(),castle,0,'pp_core','',()=>0),null);
for(const [si,bg] of [[1,'hl_cabin'],[2,'hl_shop']]){assert.equal(E.PVE.wildRoll(fixture(),castle,si,bg,'',()=>0),null);assert.equal(E.PVE.wildRoll(fixture(),castle,si,'','',()=>0),null);assert(!E.PVE.sceneWild(castle,si,bg));}
assert.equal(E.PVE.regionById('hl_cabin').id,'hl_castle');assert.equal(E.PVE.regionById('hl_shop').id,'hl_castle');
assert(E.STY.unlocked(fixture(),'helenaArrival',env));assert(!E.STY.unlocked(fixture(false),'helenaArrival',env));assert(E.STORY_SCRIPT.helenaArrival.some(s=>s.s==='mm'&&s.t.includes('黑洞')));
let a=fixture();assert(E.TX.run(a,'story',{a:'done',site:'helenaArrival'},env).ok);assert(a.story.helenaArrival.done);assert(E.TX.run(a,'story',{a:'done',site:'helenaArrival'},env).again);assert.equal(E.TX.run(fixture(false),'story',{a:'done',site:'helenaArrival'},env).ok,false);
// Per-defeated-wild inclusive drops; capture, defeat-free loss and other locations do not award essences.
function settle(result,downs,rand=()=>0,rid='hl_castle'){const a=fixture(),ctx={o:{sid:'barlow',lv:5,rid},team:[a.mons[0].u]};const r=E.PVE.MODES.wild.end(a,ctx,{res:result,downs,seen:[a.mons[0].u]}, {...env,rand});return {a,r};}
for(const [roll,n]of [[0,1],[1/6,2],[.999999,6]]){const {a,r}=settle('win',[{id:'barlow',lv:5}],()=>roll);assert.equal(a.items.crossEssence,n);assert.equal(r.crossDrop,n);}
assert.equal(settle('win',[{id:'barlow',lv:5},{id:'bali',lv:10}],()=>.999).r.crossDrop,12);
for(const result of ['lose','caught','quit'])assert(!settle(result,[]).a.items.crossEssence);assert(!settle('win',[{id:'barlow',lv:5}],()=>0,'forest').a.items.crossEssence);
// Both families use the same item, item-gated hidden skills and existing cap costs; other species are rejected.
for(const sid of ['bali','barlow']){a=fixture();const m=E.ACC.newMon(a,sid,40,env);a.items.crossEssence=200;for(const name of E.SPMAP[sid].hidden)assert(!E.ACC.avail(sid,100,[]).includes(name));assert(E.TX.run(a,'mitem',{u:m.u,k:'crossEssence'},env).ok);assert.equal(a.items.crossEssence,100);assert(E.ACC.avail(sid,40,m.hl).includes(m.hl[0]));assert(E.TX.run(a,'mitem',{u:m.u,k:'crossEssence'},env).ok);a.items.crossEssence=100;assert.equal(E.TX.run(a,'mitem',{u:m.u,k:'crossEssence'},env).ok,false);assert.equal(a.items.crossEssence,100);m.lv=70;a.items.crossEssence=1000;assert.equal(E.GROW.capNext(m).k,'crossEssence');assert(E.TX.run(a,'lvcap',{u:m.u},env).ok);assert.equal(m.lvCap,75);m.lv=75;assert(E.TX.run(a,'lvcap',{u:m.u},env).ok);assert.equal(m.lvCap,80);assert.equal(a.items.crossEssence,0);}
a=fixture();const leaf=E.ACC.newMon(a,'leaf',40,env);a.items.crossEssence=100;assert.equal(E.TX.run(a,'mitem',{u:leaf.u,k:'crossEssence'},env).ok,false);assert.equal(a.items.crossEssence,100);
const server=http.createServer((q,s)=>{if(!A.handle(q,s)){s.statusCode=404;s.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
async function api(body){const r=await fetch(base+'/api/pve',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,...await r.json()};}
assert.equal((await api({op:'wild',rid:'hl_castle',si:0,bg:'hl_castle',n:1})).status,401);
const locked=fixture(false);let reg=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'helenatest',pass:'helena-test-password',data:{'hs-account-v1':JSON.stringify(locked)}})});reg=await reg.json();token=reg.token;assert(token);
assert.equal((await api({op:'wild',rid:'hl_castle',si:0,bg:'hl_castle',n:1})).status,400);
let u=A.loadUser('helenatest');const saved=fixture();u.save.data['hs-account-v1']=JSON.stringify(saved);A.saveUser(u);
const batch=await api({op:'wild',rid:'hl_castle',si:0,bg:'hl_castle',n:6});assert.equal(batch.status,200);assert.equal(batch.list.length,6);assert(batch.list.every(m=>['barlow','bali'].includes(m.sid)));
for(const [si,bg] of [[1,'hl_cabin'],[2,'hl_shop']]){const r=await api({op:'wild',rid:'hl_castle',si,bg,n:6});assert.equal(r.status,200);assert.equal(r.list.length,0);}
const invalid=await api({op:'wild',rid:'hl_castle',si:1,bg:'hl_castle',n:6});assert.equal(invalid.list.length,0);
let r=await api({op:'start',kind:'wild',args:{id:batch.list[0].id}});assert.equal(r.status,200);
let seq=1;while(!r.end&&seq<12)r=await api({op:'act',seq:seq++,a:{kind:'move',i:0}});assert(r.end);assert.equal(r.end.res,'win');const drops=JSON.parse(A.loadUser('helenatest').save.data['hs-account-v1']).items.crossEssence;assert(drops>=1&&drops<=6);
const repeated=await api({op:'act',seq:seq-1,a:{kind:'move',i:0}});assert.deepEqual(repeated,r);assert.equal(JSON.parse(A.loadUser('helenatest').save.data['hs-account-v1']).items.crossEssence,drops);
console.log('PASS Helena: Earth gate, one location/three linked scenes, common/rare pool, no indoor wilds, first story idempotency, 1–6 drops/no capture rewards, two-family hidden skills and level caps, authenticated spawning and authoritative battle/drop replay');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();server.closeAllConnections();fs.rmSync(dir,{recursive:true,force:true});});
