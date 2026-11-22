'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const E = require('../server/tx').engine(), ctx = vm.createContext({ SPMAP: E.SPMAP });
vm.runInContext(fs.readFileSync(require.resolve('../js/ui/scene-motion.js'), 'utf8'), ctx);
const S = ctx.SCENE_MOTION;
assert.equal(S.kind('barlow', 2, 'hl_castle'), 'ground');
assert.equal(S.kind('fate', 0, 'hl_castle'), 'air');
assert.equal(S.kind('turkey', 0, 'fl_path'), 'air');
assert.equal(S.kind('frost', 0, 'wh_ice'), 'air');
assert.equal(S.kind('frost', 1, 'wh_ice'), 'ground');
// Underwater and open sea permit swimming even for species that cannot fly.
for (const sid of Object.keys(E.SPMAP)) for (const bg of ['kb_lookup','kb_shoal','kb_floor','kb_abyss','kb_temple','kb_dusk']) {
  const p = S.position(sid, 0, bg, 40, 48);
  assert.equal(p.kind, 'water'); assert(p.y < 50);
}
assert.equal(S.kind('barlow', 2, 'lt_field'), 'space');
assert.equal(S.kind('barlow', 2, 'kb_shore'), 'ground');
// Known native floor heights, cover cropping, and mirrored asymmetric coastlines.
assert.equal(S.floor('fl_meadow_mia', 50), 62);
assert.equal(S.floor('fl_meadow', 50, { w: 1600, h: 400, iw: 1600, ih: 900 }), 14.5);
assert(S.floor('kb_dock', 8) > 93); assert(S.floor('kb_dock', 92) < 67);
assert.equal(S.floor('kb_dock', 8, { flip: true }), S.floor('kb_dock', 92));
// A long orbit must remain on-screen and below the floor after resize/crop changes.
for (const R of E.WILD_REGIONS) for (const bg of R.bgs) for (const view of [null, { w: 390, h: 650, iw: 1672, ih: 941 }, { w: 1200, h: 300, iw: 1672, ih: 941, flip: true }]) {
  for (let t = 0; t < 100; t += .17) {
    const p = S.position('barlow', 2, bg, 50 + Math.cos(t) * 45, 65 + Math.sin(t * .85) * 29, view);
    assert(p.x >= 8 && p.x <= 92 && p.y >= 30 && p.y <= 97);
    if (p.kind === 'ground') assert(p.y > S.floor(bg, p.x, view));
  }
}
console.log('PASS scene movement: grounded forms, flying forms, water/space, cropped and mirrored terrain, long orbits');
