'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});return _;});
const env={now:Date.UTC(2026,10,17),rand:()=>0},copy=x=>JSON.parse(JSON.stringify(x)),mode=C.PVE.MODES.boss;
function account(){const a={mons:[],next:1,teams:[[]],active:0,items:{},exp:0,story:{flora1:{done:true},tiger:{done:true},tiger2:{done:true}},chal:{fl5:{s:[true]}}};const m=C.ACC.newMon(a,'leaf',70,env);a.teams[0]=[m.u];return a;}
function finish(a,k,d,res='win'){const st=mode.start(a,{k,d},env);assert(!st.err,st.err);return mode.end(a,st.ctx,{res,seen:[true],downs:res==='win'?[{lv:C.PVE.BOSSES[k].lv[d].lv}]:[]},env);}
for(const k of Object.keys(C.PVE.BOSSES)){
 const B=C.PVE.BOSSES[k],sid=B.sid;
 if(k==='tiger'){assert.equal(B.lv[0].reward.mon.sid,sid);assert.equal(B.lv[0].reward.mon.lv,10);const a=account();finish(a,k,0);assert.equal(a.mons.find(m=>m.sid===sid).lv,10);continue;}
 assert(!B.lv[0].reward.mon);assert.equal(B.lv[0].reward.items.e_odo,undefined);assert.equal(B.lv[1].reward.mon.sid,sid);assert.equal(B.lv[1].reward.mon.lv,10);
 const a=account();finish(a,k,0);assert.equal(a.mons.filter(m=>m.sid===sid).length,0);assert.equal(a.items.e_odo,undefined);assert.equal(a.items.m_mcry,100);
 finish(a,k,1,'lose');assert.equal(a.mons.filter(m=>m.sid===sid).length,0);
 let rep=finish(a,k,1);assert(rep.first);const got=a.mons.find(m=>m.sid===sid);assert(got);assert.equal(got.lv,10);assert.equal(C.ACC.form(got).stage,0);assert.equal(a.items.m_mcry,300);
 for(const item in B.lv[1].reward.items)assert.equal(a.items[item],item==='m_mcry'?300:B.lv[1].reward.items[item]);
 rep=finish(a,k,1);assert(!rep.first);assert.equal(a.mons.filter(m=>m.sid===sid).length,1);assert.equal(a.items.m_mcry,300);
 // Previously awarded individuals retain level, nickname and training; old eggs also survive.
 const legacy=account(),old=C.ACC.newMon(legacy,sid,60,env);old.nickname='老朋友';old.renameUnlocked=true;old.ev.spa=88;legacy.items.e_odo=1;legacy.bosses={};legacy.bosses[k]={wins:1,tries:1};const saved=copy(old);
 finish(legacy,k,0);assert.deepEqual(copy(old),saved);assert.equal(legacy.items.e_odo,1);
 finish(legacy,k,1);assert.deepEqual(copy(old),saved);assert.equal(legacy.items.e_odo,1);
}
console.log('PASS boss rewards: Tiger exception, no easy spirit/egg, normal grants LV10 first form with original currency, loss/replay safety, old individuals and eggs preserved');
