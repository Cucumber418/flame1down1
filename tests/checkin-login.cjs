'use strict';
const assert=require('node:assert/strict'),E=require('../server/tx').engine();
const start=Date.parse('2026-11-27T04:00:00Z'),DAY=86400e3;
function fixture(){return {exp:0,items:{}};}
function run(a,op,n){return E.TX.run(a,op,{}, {now:start+n*DAY});}
// Two five-day milestones, across a month boundary, additive with daily sign-in.
let a=fixture();for(let n=0;n<10;n++){
 const r=run(a,'loginVisit',n);assert.equal(r.total,n+1);assert.equal(r.streak,n+1);assert.equal(r.bonus,(n+1)%5===0?8:0);
 assert.equal(run(a,'loginVisit',n).bonus,0);assert(run(a,'signin',n).ok);assert(run(a,'signin',n).already);
 assert.equal(a.items.g_core,(n+1)+8*Math.floor((n+1)/5));
}assert.equal(a.exp,30000);assert.equal(a.checkin.totalLogin,10);assert.equal(a.checkin.streak,10);
// Actual login counts without clicking sign-in; missed dates do not count as logins.
a=fixture();for(let n=0;n<5;n++)run(a,'loginVisit',n*2);assert.equal(a.checkin.totalLogin,5);assert.equal(a.checkin.streak,1);assert.equal(a.items.g_core,3);assert.equal(a.exp,0);
// A gap resets only the consecutive counter; five new consecutive days pay again.
a=fixture();for(let n=0;n<5;n++)run(a,'loginVisit',n);assert.equal(a.items.g_core,8);
for(let n=7;n<12;n++)run(a,'loginVisit',n);assert.equal(a.checkin.totalLogin,10);assert.equal(a.checkin.streak,5);assert.equal(a.items.g_core,16);
// Old recorded dates migrate once, no backfilled offline dates or duplicate milestones.
a={exp:0,items:{},checkin:{days:['2026-11-27','2026-11-28','2026-11-29','2026-11-30','2026-12-01']}};
assert.equal(run(a,'loginVisit',4).bonus,8);assert.equal(a.checkin.totalLogin,5);assert.equal(run(a,'loginVisit',4).bonus,0);assert.equal(a.items.g_core,8);
// Beijing midnight and year boundary are one new login day, not the browser's timezone.
a=fixture();let now=Date.parse('2026-12-31T15:59:59Z');E.TX.run(a,'loginVisit',{}, {now});E.TX.run(a,'loginVisit',{}, {now:now+1000});assert.equal(a.checkin.totalLogin,2);assert.equal(a.checkin.streak,2);assert.equal(a.checkin.lastLogin,'2027-01-01');
console.log('PASS actual login milestones: cumulative/consecutive multiples of five, stacked daily rewards, duplicates, gaps, cross-month/year/midnight, legacy migration');
