'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), ctx = vm.createContext({console, window:{}, atob:b=>Buffer.from(b,'base64').toString('binary'), TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g, (_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});return _;});
const {ACC:A, TX:T} = ctx, env = {now:Date.UTC(2026,10,16),rand:()=>0}, copy=x=>JSON.parse(JSON.stringify(x));
let a = {mons:[],teams:[[]],active:0,next:1,items:{g_core:10},energy:40000};
let m = A.newMon(a,'leaf',5,env), other = A.newMon(a,'leaf',5,env), base = A.form(m).name;
function run(op,args){return T.run(a,op,args,env);}
function fail(op,args){const before=copy(a);assert.equal(run(op,args).ok,false);assert.deepEqual(copy(a),before);}
fail('monRename',{u:m.u,name:'小叶'});
assert.equal(run('forge',{id:'nameTag',n:2}).ok,true);assert.equal(a.items.g_core,0);assert.equal(a.items.nameTag,2);
fail('forge',{id:'nameTag',n:1});
assert.equal(run('shop',{k:'nameTag',n:2}).cost,40000);assert.equal(a.energy,0);assert.equal(a.items.nameTag,4);
fail('shop',{k:'nameTag',n:1});fail('shop',{k:'nameTag',n:1.5});
assert.equal(run('mitem',{u:m.u,k:'nameTag'}).ok,true);assert.equal(a.items.nameTag,3);assert.equal(m.renameUnlocked,true);assert.equal(other.renameUnlocked,undefined);
fail('mitem',{u:m.u,k:'nameTag'});fail('mitem',{u:999,k:'nameTag'});
for(let i=0;i<30;i++)assert.equal(run('monRename',{u:m.u,name:' 小叶'+i+' '}).ok,true);
assert.equal(a.items.nameTag,3);assert.equal(A.form(m).name,'小叶29');assert.equal(A.form(other).name,base);assert.equal(A.battleMon(a,m).nick,'小叶29');
fail('monRename',{u:other.u,name:'小叶'});fail('monRename',{u:999,name:'小叶'});fail('monRename',{u:String(m.u),name:'小叶'});
for(const name of ['太'.repeat(13),'<img>', 'a\nb','a\u202eb',null,{},123])fail('monRename',{u:m.u,name});
assert.equal(run('monRename',{u:m.u,name:'🌱'.repeat(12)}).ok,true);assert.equal(A.form(m).name,'🌱'.repeat(12));
const saved=copy(a);assert.equal(A.form(saved.mons[0]).name,'🌱'.repeat(12));
const before=copy(a), args={u:m.u,name:'永久小叶'};assert.equal(run('monRename',args).ok,true);assert.equal(T.run(before,'monRename',args,env).ok,true);assert.deepEqual(copy(a),before);
m.lv=100;assert.equal(A.form(m).name,'永久小叶');assert.equal(run('monRename',{u:m.u,name:'  '}).ok,true);assert.equal(A.form(m).name,A.form({sid:m.sid,lv:m.lv}).name);assert.equal(m.renameUnlocked,true);
a.items.nameTag=0;assert.equal(run('monRename',{u:m.u,name:'免费'}).ok,true);fail('mitem',{u:other.u,k:'nameTag'});
console.log('PASS rename rules: crafting, purchase, individual unlock, no repeated charges, validation, Unicode, replay, persistence, evolution, battle name and reset');
