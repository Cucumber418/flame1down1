/* 每日签到以北京时间、服务器时间结算，重复请求不重复发奖 */
TX.add('signin', function (a, args, env) {
  var day = ACC.dayStr(env.now), month = day.slice(0, 7);
  if (!a.checkin || typeof a.checkin !== 'object') a.checkin = { days: [] };
  if (!Array.isArray(a.checkin.days)) a.checkin.days = [];
  if (a.checkin.days.indexOf(day) >= 0) return { ok: true, already: true, day: day };
  a.checkin.days = a.checkin.days.filter(function (d) { return typeof d === 'string' && d.slice(0, 7) >= month; });
  a.checkin.days.push(day);
  a.exp = (a.exp || 0) + 3000;
  if (!a.items) a.items = {};
  a.items.g_core = (a.items.g_core || 0) + 1;
  return { ok: true, day: day, exp: 3000, core: 1 };
});
