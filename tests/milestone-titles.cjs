'use strict';
const assert=require('node:assert/strict'),E=require('../server/tx').engine(),copy=x=>JSON.parse(JSON.stringify(x));
const env={now:Date.now(),rand:()=>.5,data:{}},ids=['clementiSinger','highlandKing','mingHeir','leafcatOwner'];
function account(){return{v:1,name:'成就测试',introDone:true,next:1,mons:[],teams:[[]],active:0,story:{},items:{},exp:0,energy:0};}
function earned(a){return Array.from(E.AWD.titleCheck(a,env,true).got).filter(id=>ids.includes(id));}
assert.deepEqual(Array.from(E.AWD.MILESTONE_TITLES,t=>t.n),['热门歌手','高地之王','明明继承人','叶子猫']);
assert.equal(new Set(Array.from(E.AWD.TITLES,t=>t.id)).size,E.AWD.TITLES.length);
let a=account();assert.deepEqual(earned(a),[]);
for(const key of ['clementi','clementi:1','clementi:w0','clementi:w1']){a=account();a.bosses={[key]:{wins:5}};assert(!earned(a).includes('clementiSinger'));}
a=account();a.bosses={'clementi:2':{wins:0,tries:1}};assert(!earned(a).includes('clementiSinger'));a.bosses['clementi:2'].wins=1;assert(earned(a).includes('clementiSinger'));
for(const [sid,id]of [['glen','highlandKing'],['leiming','mingHeir'],['leafcat','leafcatOwner']])for(const lv of [1,100]){a=account();E.ACC.newMon(a,sid,lv,env);const before=copy(a);assert.deepEqual(earned(a),[id]);assert.deepEqual(copy(a),before);const result=E.TX.run(a,'title',{},env);assert(result.ok);assert(result.got.includes(id));assert(result.paid.includes(id));assert(a.titles.includes(id));assert(a.titleRw.includes(id));}
// Seen forms and unhatched essences cannot stand in for actually obtaining a spirit.
a=account();for(const sid of ['glen','leiming','leafcat'])E.ACC.seeMon(a,sid,100);a.items={e_glen:1,e_leiming:1,e_leafcat:1};assert.deepEqual(earned(a),[]);
// An old account receives all qualifying titles and their rewards once, including after evolving.
a=account();a.bosses={'clementi:2':{wins:1}};for(const sid of ['glen','leiming','leafcat'])E.ACC.newMon(a,sid,100,env);
const before=copy(a),r=E.TX.run(a,'title',{},env);assert(r.ok);assert.deepEqual(Array.from(r.got).filter(id=>ids.includes(id)),ids);for(const id of ids){assert(a.titles.includes(id));assert(a.titleRw.includes(id));const def=E.RW.titleOf(id);assert(def);const rw=E.RW.titleRw(def);assert.deepEqual(copy(E.RW.expect('title',id)),{items:{},exp:rw.exp,energy:rw.energy,merit:rw.merit,meritXp:rw.merit});}
assert.equal(a.exp-before.exp,r.sum.exp);assert.equal(a.energy-before.energy,r.sum.energy);assert.equal(a.merit||0,r.sum.merit);assert.equal(a.meritXp||0,r.sum.merit);
const paid=copy(a),repeat=E.TX.run(a,'title',{},env);assert.deepEqual(Array.from(repeat.got),[]);assert.deepEqual(Array.from(repeat.paid),[]);assert.deepEqual(copy(a),paid);
a.mons=[];a.bosses={};E.TX.run(a,'title',{},env);for(const id of ids)assert(a.titles.includes(id)); // Earned titles stay earned.
a=account();a.titles=ids.slice();const back=E.TX.run(a,'title',{},env);assert.deepEqual(Array.from(back.got),[]);assert.deepEqual(Array.from(back.paid),ids);assert.equal(E.TX.run(a,'title',{},env).paid.length,0);
console.log('PASS milestone titles: exact hard-BOSS gate, three species and evolved forms, no sightings/essence false grants, pure preview, retrospective award/reward backfill, whitelist, permanence and idempotence');
