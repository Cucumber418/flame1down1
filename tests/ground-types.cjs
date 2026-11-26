'use strict';
const assert=require('node:assert/strict'),E=require('../server/tx').engine();
const copy=x=>JSON.parse(JSON.stringify(x));
for(const t of ['火','电','机械'])assert.equal(E.eff('地面',t),2);
for(const t of ['水','草','冰'])assert.equal(E.eff(t,'地面'),2);
assert.equal(E.eff('地面','草'),.5);assert.equal(E.eff('地面','飞行'),0);assert.equal(E.eff('电','地面'),0);assert.equal(E.eff('地面','普通'),1);assert.equal(E.eff('missing','地面'),1);
assert.equal(E.effT('地面',['火','机械']),4);assert.equal(E.effT('地面',['火','草']),1);assert.equal(E.effT('地面',['火','飞行']),0);assert.equal(E.effT('电',['水','地面']),0);
function battle(target){E.RNG=()=>.5;const S=E.newBattle([{id:'glen',lv:60,moves:['扔石块','飞沙']}],[{id:target,lv:60,moves:['旋转冲撞']}]);for(const side of S.sides)for(const m of side.team){m.maxhp=m.hp=10000;m.abil={n:'无',d:''};for(const k of ['atk','spa','def','spd','spe'])m.stats[k]=100;}return S;}
const mon=(S,i=0)=>E.act(S,i),stone=E.M['扔石块'];let S=battle('bali');const neutral=E.calcDamage(mon(S),mon(S,1),stone,true,false).dmg;
for(const [target,mult]of [['firemouse',2],['faraday',2],['aegis',2],['leaf',.5],['turkey',0]]){S=battle(target);const r=E.calcDamage(mon(S),mon(S,1),stone,true,false);assert.equal(r.eff,mult,target);assert(Math.abs(r.dmg-neutral*mult)<=1,target);const hp=mon(S,1).hp;E.useMove(S,[],0,stone,-1);assert.equal(hp-mon(S,1).hp,r.dmg,target);}
// Immunity blocks fixed additions, multi-hit segments and attack riders as well as ordinary damage.
S=battle('turkey');mon(S).hp=5000;mon(S,1).fx.highlandHits=3;const events=[];E.useMove(S,events,0,{...E.M['碎震裂踢'],hits:[3,3],fixed:200,fixedHit:50,st:'麻痹',chance:1},-1);assert.equal(mon(S,1).hp,10000);assert(!mon(S,1).fx.fracture);assert.deepEqual(copy(mon(S,1).st),{});assert.equal(mon(S,1).fx.highlandHits,3);assert(!events.some(e=>e.t==='hit'&&e.amount>0));assert(events.some(e=>e.text&&e.text.includes('属性免疫')));assert.equal(E.estAttack(mon(S),mon(S,1),{...stone,fixed:500,fixedHit:500,hits:[3,3]}),0);assert.equal(E.scoreMove(S,mon(S),mon(S,1),stone),-1000);
E.useMove(S,[],0,E.M['孤高之蹄'],-1);assert.equal(mon(S).hp,5000);E.doStatus(S,[],0,E.M['飞沙']);assert.equal(mon(S,1).stages.acc,-1);
// Electric attacks cannot damage a ground target; ordinary attacks still can.
S=battle('glen');const electric=Object.values(E.M).find(m=>m.type==='电'&&m.cat==='物攻'&&m.power>0&&!m.custom&&!m.fixedHit);assert(electric);E.useMove(S,[],0,electric,-1);assert.equal(mon(S,1).hp,10000);assert.equal(E.calcDamage(mon(S),mon(S,1),electric,true,true).dmg,0);assert.equal(E.estAttack(mon(S),mon(S,1),electric),0);E.useMove(S,[],0,E.M['旋转冲撞'],-1);assert(mon(S,1).hp<10000);
// Preview calculations on an immune target consume neither random rolls nor a guaranteed critical hit.
S=battle('turkey');mon(S).fx.sureCrit=1;E.RNG=()=>{throw Error('immune damage calculation must not roll');};assert.equal(E.calcDamage(mon(S),mon(S,1),stone,true,false).dmg,0);assert.equal(mon(S).fx.sureCrit,1);
console.log('PASS ground types: outgoing/incoming chart, neutral fallback and zero multipliers, dual-type composition, real damage, immunity to attack riders/fixed packets, unchanged status moves, AI avoidance and deterministic previews');
