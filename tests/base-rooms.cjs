'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const E = require('../server/tx').engine(), env = { now: Date.parse('2026-11-23T08:00:00Z'), rand: () => .5 };
const copy = x => JSON.parse(JSON.stringify(x));
function account() { return { energy: 100000, items: { xmasBell: 10 }, baseInv: { rooms: {}, deco: { d12: 2 } }, story: { school: { done: true }, river: { done: true }, jiuquan: { done: true } }, christmasStory: { cabinOpen: true, shopOpen: true, shopIntro: true } }; }
function buy(a, k) { return E.TX.run(a, 'baseBuy', { t: 'room', k }, env); }
function ice(a, n = 1) { return E.TX.run(a, 'christmas', { a: 'buy', id: 'iceRoom', n }, env); }
function reject(a, run) { const before = copy(a); assert.equal(run().ok, false); assert.deepEqual(copy(a), before); }
for (const k of ['r5', 'r7']) {
  const a = account(); assert(buy(a, k).ok); assert.equal(a.energy, 70000); assert.equal(a.baseInv.rooms[k], env.now); assert.equal(a.baseInv.deco.d12, 2);
  reject(a, () => buy(a, k));
  const poor = account(); poor.energy = 29999; reject(poor, () => buy(poor, k));
}
for (const k of ['r6', 'r8', 'r9']) { const a = account(); reject(a, () => buy(a, k)); }
let a = account(), replay = copy(a); assert(ice(a).ok); assert.equal(a.items.xmasBell, 5); assert.equal(a.baseInv.rooms.r6, env.now); assert.equal(a.baseInv.deco.d12, 2); assert.equal(a.energy, 100000); assert.equal(a.items.r6, undefined);
assert(ice(replay).ok); assert.deepEqual(copy(a), copy(replay)); reject(a, () => ice(a));
for (const n of [0, -1, 1.5, 2, '1', null, 1000]) { const b = account(); reject(b, () => ice(b, n)); }
a = account(); a.items.xmasBell = 4; reject(a, () => ice(a));
a = account(); delete a.baseInv; assert(ice(a).ok); assert.equal(a.baseInv.rooms.r6, env.now);
for (const field of ['shopOpen', 'shopIntro']) { const b = account(); b.christmasStory[field] = false; reject(b, () => ice(b)); }
a = account(); a.story = {}; reject(a, () => ice(a));
// A future accidentally priced special room must still be rejected by the energy shop.
const special = E.TX.D.BASE_ROOMS.r8; special.price = 30000;
a = account(); reject(a, () => buy(a, 'r8')); special.price = 0;
// All rooms have placement geometry; every monster starts on a valid, unblocked floor.
const source = fs.readFileSync(require.resolve('../js/ui/game.js'), 'utf8');
const ui = vm.runInNewContext('(' + source.match(/var BASE_UI = (\{[\s\S]*?\n  \});/)[1] + ')');
const geometry = source.slice(source.indexOf('  function inPoly('), source.indexOf('  var baseGrid ='));
const ctx = vm.createContext({}); vm.runInContext(geometry, ctx);
assert.deepEqual(Object.keys(ui), Object.keys(E.TX.D.BASE_ROOMS));
for (const k of ['r5', 'r6', 'r7', 'r8', 'r9']) {
  assert.equal(ui[k].mons.length, 7);
  for (const [x, y] of ui[k].mons) assert(ctx.baseOk(ui[k], 'floor', x, y), k + ' monster floor: ' + x + ',' + y);
}
// The shared product detail must show the right source and single-room limit.
const offers = vm.createContext({ TX: E.TX, CHRISTMAS: E.CHRISTMAS, BASE_UI: ui, acc: account(), ready: () => true, fmt: String, itemName: k => k });
for (const [start, end] of [['  function baseInv()', '  function baseLayout()'], ['  function shopOffer(', '  /* ---------- 商城：']]) {
  vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), offers);
}
for (const k of ['r6', 'r8', 'r9']) { const offer = offers.shopOffer('base', 'room|' + k); assert.equal(offer.limit, 0); assert.equal(offer.costs.length, 0); assert(!offer.desc.includes('默认房型')); }
for (const k of ['r5', 'r7']) { const offer = offers.shopOffer('base', 'room|' + k); assert.equal(offer.limit, 1); assert.equal(offer.costs[0].unit, 30000); }
let offer = offers.shopOffer('christmas', 'iceRoom'); assert.equal(offer.limit, 1); assert.equal(offer.costs[0].unit, 5); assert.equal(offer.costs[0].key, 'xmasBell');
offers.acc.baseInv.rooms.r6 = env.now; offer = offers.shopOffer('christmas', 'iceRoom'); assert.equal(offer.limit, 0); assert.equal(offer.reason, '已拥有此房型');
console.log('PASS base rooms: energy and bell purchases, ownership and replay, invalid quantities and story gates, restricted-room rejection, furniture preservation and spawn geometry');
