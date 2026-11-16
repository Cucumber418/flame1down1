'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});return _;});
const {ACC:A,GROW:G,TX:T}=ctx,now=Date.UTC(2026,10,16),env={now,rand:()=>0},copy=x=>JSON.parse(JSON.stringify(x));
const owner=()=>{const a={mons:[],next:1,teams:[[]],active:0,items:{},home:{mons:[]}};for(let i=0;i<18;i++)A.newMon(a,'leaf',5,env);return a;};
let a=owner();const slots=()=>copy(G.homeSlots(a)), run=(args)=>T.run(a,'home',args,env);
function fail(args){const before=copy(a);assert.equal(run(args).ok,false);assert.deepEqual(copy(a),copy(before));}
assert.deepEqual(slots(),[null,null,null]);
assert.equal(run({a:'put',slot:2,u:1,from:null}).ok,true);assert.equal(slots()[2].u,1);assert.equal(slots()[0],null);
assert.equal(run({a:'put',slot:0,u:2,from:null}).ok,true);assert.equal(slots()[0].u,2);assert.equal(slots()[1],null);
for(const slot of [-1,3,0.5,'1',null])fail({a:'put',slot,u:3,from:null});
fail({a:'put',slot:1,u:999,from:null});fail({a:'put',slot:1,u:1,from:null});fail({a:'put',slot:2,u:3,from:null});
a.spa={u:[3]};fail({a:'put',slot:1,u:3,from:null});delete a.spa;
let old=a.home.mons.find(x=>x.u===1);old.t=now-3600000;old.st=5;let expected=G.homeNet(old,a.mons[0],now),exp=a.mons[0].exp;
let before=copy(a),args={a:'put',slot:2,u:3,from:1},r=run(args);assert.equal(r.ok,true);assert.equal(a.mons[0].exp,exp+expected);assert.equal(slots()[2].u,3);assert.equal(slots()[0].u,2);assert.equal(slots()[1],null);assert.equal(slots()[2].t,now);
assert.equal(T.run(before,'home',args,env).ok,true);assert.deepEqual(copy(a),copy(before));fail(args);
assert.equal(run({a:'out',u:2}).ok,true);assert.equal(slots()[0],null);assert.equal(slots()[2].u,3);
assert.equal(run({a:'in',u:4}).ok,true);assert.equal(slots()[0].u,4);assert.equal(slots()[2].u,3);
// Old saves gain stable slots only when changed; reading the panel is pure.
a=owner();a.home.mons=[{u:1,t:now},{u:2,t:now},{u:3,t:now}];before=copy(a);assert.deepEqual(slots().map(x=>x.u),[1,2,3]);assert.deepEqual(copy(a),copy(before));
assert.equal(run({a:'out',u:2}).ok,true);assert.deepEqual(slots().map(x=>x&&x.u),[1,null,3]);
a.home.cap=4;assert.equal(slots().length,7);assert.equal(run({a:'put',slot:6,u:5,from:null}).ok,true);assert.equal(slots()[6].u,5);
// Expired auto days settle before removal; a replacement cannot collect twice.
a=owner();a.home.mons=[{u:1,t:now-25*3600000,auto:{left:7,got:0}}];exp=a.mons[0].exp;r=run({a:'put',slot:0,u:2,from:1});assert.equal(r.ok,true);assert.equal(r.settled.length,1);assert(a.mons[0].exp>exp);assert.equal(slots()[0].auto,undefined);fail({a:'put',slot:0,u:3,from:1});
assert.equal(G.homeSlots(copy(a))[0].u,2);
console.log('PASS home slots: legacy migration, empty/expanded slots, atomic replacement, experience, auto settlement, stable positions, invalid and stale selection, replay and save');
