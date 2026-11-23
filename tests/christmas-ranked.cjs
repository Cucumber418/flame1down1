'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'flame-xmas-rank-'));
const A=require('../server/accounts'),T=require('../server/tx'),E=T.engine();require('../server/pve');const now=Date.now();
function fixture(cap=false){return {a:{name:'赛季旅人',introDone:true,exp:0,tokens:0,items:{xmasCandy:7},mons:[],teams:[[]],active:0,story:{},rankExp:{d:E.PVE.bjDay(now),n:cap?10:0}},data:{'hs-rank-v1':JSON.stringify({season:'S2',r:0,stars:0,w:0,l:0,best:0})}};}
for(const cap of [false,true])for(const [res,n] of [['win',20],['lose',10],['draw',10]]){let f=fixture(cap),r=E.PVE.MODES.rank.end(f.a,{season:'S2'},{res,quit:false},{now,data:f.data});assert.equal(r.candy,n);assert.equal(f.a.items.xmasCandy,7+n);assert.equal(f.a.exp,cap?0:1000);assert.equal(f.a.tokens,cap?0:20);assert.equal(!!r.rexp.full,cap);}
for(const season of [undefined,'S1']){let f=fixture();E.PVE.MODES.rank.end(f.a,{season},{res:'win',quit:false},{now,data:f.data});assert.equal(f.a.items.xmasCandy,7);}
for(const res of ['win','lose','draw']){let f=fixture();assert.equal(E.PVE.MODES.rank.end(f.a,{season:'S2'},{res,quit:true},{now,data:f.data}).candy,0);assert.equal(f.a.items.xmasCandy,7);}
let f=fixture();E.CHRISTMAS.RANK_EVENT.enabled=false;assert.equal(E.PVE.MODES.rank.end(f.a,{season:'S2'},{res:'win',quit:false},{now,data:f.data}).candy,0);E.CHRISTMAS.RANK_EVENT.enabled=true;
for(const res of ['void','flee','season','enabled','toString'])assert.equal(E.CHRISTMAS.rankCandy(f.a,'S2',res,false),0);
f=fixture();assert.equal(E.PVE.MODES.sandbox.end(f.a,{}, {res:'win'}, {now,data:f.data}).candy,undefined);assert.equal(f.a.items.xmasCandy,7);
// Exercise the real session settlement / replay barrier with controlled finished outcomes.
let outcome='win';const resolve=E.resolveTurn;E.resolveTurn=function(S){S.over=outcome;return [];};
const server=http.createServer((q,r)=>{if(!A.handle(q,r)){r.statusCode=404;r.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let token;
async function api(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
f=fixture(true);let r=await api('/api/register',{user:'xmasrank',pass:'rank-test-password',data:{'hs-account-v1':JSON.stringify(f.a),'hs-rank-v1':f.data['hs-rank-v1']}});assert(r.token);token=r.token;let candy=7;
for(const [res,n]of [['win',20],['lose',10],['draw',10]]){outcome=res;r=await api('/api/pve',{op:'draft'});assert(r.ok);r=await api('/api/pve',{op:'start',kind:'rank',args:{pick:0},rules:T.RULES_VERSION});assert(r.ok);let req={op:'act',a:{kind:'move',i:0},seq:1,bid:r.bid};r=await api('/api/pve',req);assert(r.ok,JSON.stringify(r));assert.equal(r.end.rep.candy,n);assert(r.end.rep.rexp.full);candy+=n;let a=JSON.parse((await api('/api/me')).save.data['hs-account-v1']);assert.equal(a.items.xmasCandy,candy);const duplicate=await api('/api/pve',req);assert.deepEqual(duplicate.end,r.end);assert.equal(JSON.parse((await api('/api/me')).save.data['hs-account-v1']).items.xmasCandy,candy);}
console.log('PASS S2 festive win/loss/draw candy, daily XP cap independence, retired season/quit/event-off guards, invalid outcomes, sandbox exclusion and real settlement replay idempotence');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{E.resolveTurn=resolve;server.close();});
