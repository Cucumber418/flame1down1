'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flame-rooms-')); process.env.DATA_DIR = dir;
const A = require('../server/accounts'), T = require('../server/tx'); require('../server/social');
const server = http.createServer((q, s) => { if (!A.handle(q, s)) { s.statusCode = 404; s.end(); } });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port; let token;
  async function api(url, body, method) {
    const r = await fetch(base + url, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, ...await r.json() };
  }
  const a = { v: 1, name: 'roomtest', introDone: true, next: 1, mons: [], teams: [[]], active: 0, energy: 100000, exp: 0, items: { xmasBell: 10 }, story: { school: { done: true }, river: { done: true }, jiuquan: { done: true }, tea: { done: true } }, christmasStory: { cabinOpen: true, shopOpen: true, shopIntro: true }, home: { mons: [], layout: { room: 'r1', deco: [] } }, hlFix: 1 };
  let r = await api('/api/register', { user: 'roomtest', pass: 'room-test-password', data: { 'hs-account-v1': JSON.stringify(a) } });
  assert.equal(r.status, 200); token = r.token;
  const tx = (op, args) => api('/api/tx', { v: T.VERSION, op, args });
  const read = () => JSON.parse(A.loadUser('roomtest').save.data['hs-account-v1']);
  for (const k of ['r5', 'r7']) assert.equal((await tx('baseBuy', { t: 'room', k, n: 1 })).status, 200);
  assert.equal(read().energy, 40000);
  const pair = await Promise.all([tx('christmas', { a: 'buy', id: 'iceRoom', n: 1 }), tx('christmas', { a: 'buy', id: 'iceRoom', n: 1 })]);
  assert.deepEqual(pair.map(x => x.status).sort(), [200, 400]); assert.equal(read().items.xmasBell, 5); assert(read().baseInv.rooms.r6);
  for (const k of ['r6', 'r8', 'r9']) assert.equal((await tx('baseBuy', { t: 'room', k, n: 1 })).status, 400);
  for (const k of ['r5', 'r6', 'r7', 'r8', 'r9']) {
    const save = A.loadUser('roomtest').save, edited = JSON.parse(save.data['hs-account-v1']);
    edited.home.layout = { room: k, deco: [] };
    if (k === 'r8' || k === 'r9') edited.baseInv.rooms[k] = Date.now(); // forged ownership is ignored
    r = await api('/api/save', { rev: save.rev, data: { ...save.data, 'hs-account-v1': JSON.stringify(edited) }, claims: [] }, 'PUT'); assert.equal(r.status, 200);
    r = await api('/api/home?user=roomtest'); assert.equal(r.status, 200); assert.equal(r.layout.room, ['r8', 'r9'].includes(k) ? 'r1' : k);
  }
  assert.equal(read().baseInv.rooms.r8, undefined); assert.equal(read().baseInv.rooms.r9, undefined);
  console.log('PASS base rooms API: energy purchases, concurrent single Christmas exchange, saved layouts, visitor rendering and forged ownership rejection');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { server.close(); server.closeAllConnections(); fs.rmSync(dir, { recursive: true, force: true }); });
