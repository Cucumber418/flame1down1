/* 登录天数与签到均以北京时间、服务器时间结算；跨月保留累计与连续记录 */
var CHECKIN = (function () {
  function visit(a, now) {
    var day = ACC.dayStr(now), c = a.checkin;
    if (!c || typeof c !== 'object') c = a.checkin = { days: [] };
    if (!Array.isArray(c.days)) c.days = [];
    if (c.loginV !== 1) {
      // 旧版签到日期是可确认的登录记录，不把未登录日期的补发邮件算入天数
      var days = c.days.filter(function (d, i, all) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= day && all.indexOf(d) === i; }).sort();
      c.totalLogin = days.length; c.lastLogin = days[days.length - 1] || ''; c.streak = days.length ? 1 : 0;
      for (var i = days.length - 1; i > 0 && Date.parse(days[i]) - Date.parse(days[i - 1]) === 86400e3; i--) c.streak++;
      c.totalPaid = 0; c.streakPaid = 0; c.loginV = 1;
    }
    var logged = false;
    if (!c.lastLogin || c.lastLogin < day) {
      var consecutive = c.lastLogin && Date.parse(day) - Date.parse(c.lastLogin) === 86400e3;
      c.streak = consecutive ? c.streak + 1 : 1;
      if (!consecutive) c.streakPaid = 0;
      c.totalLogin++; c.lastLogin = day; logged = true;
    }
    var totalSteps = Math.floor(c.totalLogin / 5), streakSteps = Math.floor(c.streak / 5);
    var totalBonus = Math.max(0, totalSteps - c.totalPaid) * 3, streakBonus = Math.max(0, streakSteps - c.streakPaid) * 5;
    c.totalPaid = totalSteps; c.streakPaid = streakSteps;
    var bonus = totalBonus + streakBonus;
    if (c.bonusDay !== day) { c.bonusDay = day; c.lastBonus = 0; }
    if (bonus) { if (!a.items) a.items = {}; a.items.g_core = (a.items.g_core || 0) + bonus; c.lastBonus += bonus; }
    return { ok: true, day: day, logged: logged, total: c.totalLogin, streak: c.streak, bonus: bonus, totalBonus: totalBonus, streakBonus: streakBonus };
  }
  return { visit: visit };
})();
TX.add('loginVisit', function (a, args, env) { return CHECKIN.visit(a, env.now); });
TX.add('signin', function (a, args, env) {
  var login = CHECKIN.visit(a, env.now), day = login.day, month = day.slice(0, 7);
  if (typeof CHRISTMAS !== 'undefined') CHRISTMAS.hit(a, 'signin', 1, env.now);
  if (a.checkin.days.indexOf(day) >= 0) return { ok: true, already: true, day: day, login: login };
  a.checkin.days = a.checkin.days.filter(function (d) { return typeof d === 'string' && d.slice(0, 7) >= month; });
  a.checkin.days.push(day);
  a.exp = (a.exp || 0) + 5000;
  if (!a.items) a.items = {};
  a.items.g_core = (a.items.g_core || 0) + 2;
  return { ok: true, day: day, exp: 5000, core: 2, login: login };
});
