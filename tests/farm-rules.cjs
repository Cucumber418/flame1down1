'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), ctx = vm.createContext({console, window:{}, atob:b=>Buffer.from(b,'base64').toString('binary'), TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g, (_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});return _;});
const {GROW:G,TX:T}=ctx, now=Date.UTC(2026,10,15,15,59,59), copy=x=>JSON.parse(JSON.stringify(x));
function owner(seed='s_herb'){return {introDone:true,story:{plant:{done:true}},items:{},farm:{plots:[{seed,t:now-G.SEEDS[seed].min*60000}],extra:0}};}
const env={now,rand:()=>0};
let a=owner(), p=a.farm.plots[0];
assert.equal(G.farmStealView(p,'alice',3000,now-1).why,'young');
assert.equal(G.farmStealFrom(a,-1,'alice',3000,now).err,'没有这块田');
assert.equal(G.farmStealFrom(a,0.5,'alice',3000,now).err,'没有这块田');
assert.equal(G.farmStealFrom(a,0,'alice',0,now).err.includes('上限'),true);
let first=G.farmStealFrom(a,0,'alice',3000,now);assert.equal(first.n,5);
assert.equal(G.farmStealView(p,'alice',3000,now).why,'done');
let total=first.n;for(let i=0;i<30;i++){const r=G.farmStealFrom(a,0,'visitor'+i,3000,now);if(!r.err)total+=r.n;}
assert.equal(total,25);assert.equal(G.farmNet(p),25);assert.equal(G.farmStealView(p,'last',3000,now).why,'half');
let before=copy(a.farm), harvest=T.run(a,'farm',{a:'harvest',i:0},env);
assert.equal(harvest.n,25);assert.equal(harvest.back,1);assert.equal(a.items.c_herb+total,50);assert.equal(a.farm.plots[0],null);
let replay={items:{},farm:before};assert.equal(T.run(replay,'farm',{a:'harvest',i:0},env).n,25);
assert.equal(T.run(a,'farm',{a:'harvest',i:0},env).ok,false);
assert.equal(T.run(a,'farm',{a:'plant',i:0,seed:'s_herb'},env).ok,true);assert.equal(a.farm.plots[0].st,undefined);assert.equal(a.farm.plots[0].sb,undefined);
assert.equal(G.farmStealView(a.farm.plots[0],'alice',3000,now+480*60000).n,5);
a=owner('s_rice');let rice=G.farmStealFrom(a,0,'alice',3,now);assert.equal(rice.n,3);harvest=T.run(a,'farm',{a:'harvest',i:0},env);assert.equal(harvest.n,247);assert.equal(harvest.back,1);
let thief={items:{},farmStealD:{d:T.bjDay(now),n:2998}}, source=owner();
let result=T.run(thief,'farmSteal',{owner:'owner',i:0},{...env,fetch:(k,args)=>G.farmStealFrom(source,args.i,'alice',args.cap,now)});
assert.equal(result.n,2);assert.equal(result.left,0);assert.equal(thief.items.c_herb,2);assert.equal(source.farm.plots[0].st,2);
assert.equal(T.run(thief,'farmSteal',{owner:'owner',i:0},env).ok,false);
assert.equal(G.farmStealLeft(thief,now+1000),3000); // 北京时间零点
let local={items:{}};assert.equal(T.run(local,'farmSteal',{owner:'owner',i:0},env).ok,false);assert.equal(local.farmStealD,undefined);
for(const i of[null,'0',NaN,-1,0.5]){const r=T.run({items:{}},'farmSteal',{owner:'owner',i},{...env,fetch:()=>null});assert.equal(r.ok,false);}
assert.equal(G.farmOpen({farm:{plots:[{seed:'s_rice',t:1}]}}),true); // 老存档
console.log('PASS farm rules: maturity, once per round, half retained, conservation, seeds, quota, Beijing midnight, replay, invalid input');
