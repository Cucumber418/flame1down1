/* 排位赛季迁移：浏览器与服务器共用，重复执行不会清空 S2 进度 */
var RANK_SEASON = (function () {
  var id = 'S2';
  function state(r) { return r && r.season === id ? r : { season: id, r: 0, stars: 0, w: 0, l: 0, best: 0 }; }
  function parse(v) { try { return JSON.parse(v || 'null'); } catch (e) { return null; } }
  function migrate(data) {
    if (!data || typeof data !== 'object') return false;
    var old = parse(data['hs-rank-v1']);
    if (old && old.season === id) return false;
    var history = parse(data['hs-rank-history-v1']) || {}, a = parse(data['hs-account-v1']);
    if (old && !history.S1) history.S1 = { rank: old, rewards: a && a.rankRw || null };
    if (Object.keys(history).length) data['hs-rank-history-v1'] = JSON.stringify(history);
    data['hs-rank-v1'] = JSON.stringify(state(null));
    delete data['hs-draft-v1'];
    if (a) {
      a.rankRw = { season: id, got: {}, x2: true, items: true, kingGift: true };
      data['hs-account-v1'] = JSON.stringify(a);
    }
    return true;
  }
  // 已结束赛季的公开徽章资料；只从历史段位读取，不能由名片自填战绩。
  function badges(data) {
    var history = parse(data && data['hs-rank-history-v1']) || {};
    function n(v, max) { return Math.max(0, Math.min(max, Math.floor(+v || 0))); }
    return Object.keys(history).filter(function (s) { return /^S[1-9]\d*$/.test(s) && +s.slice(1) < +id.slice(1) && history[s] && history[s].rank; }).sort(function (a, b) { return +b.slice(1) - +a.slice(1); }).map(function (s) {
      var r = history[s].rank, best = n(Math.max(+r.best || 0, +r.r || 0), 10), dv = r.bestDv >= 1 && r.bestDv <= 5 ? r.bestDv | 0 : best === r.r && r.dv >= 1 && r.dv <= 5 ? r.dv | 0 : 1;
      if (best === r.r && r.dv >= 1 && r.dv <= 5) dv = Math.min(dv, r.dv | 0);
      return { id: s, best: best, bestDv: best >= 4 && best <= 9 ? dv : null, kingBest: best === 10 ? n(Math.max(+r.kingBest || 0, r.r === 10 ? +r.stars || 0 : 0), 1e6) : 0, w: n(r.w, 1e7), l: n(r.l, 1e7) };
    });
  }
  function shownBadges(data, selected) { return badges(data).filter(function (b) { return !Array.isArray(selected) || selected.indexOf(b.id) >= 0; }); }
  return { id: id, state: state, migrate: migrate, badges: badges, shownBadges: shownBadges };
})();
if (typeof module !== 'undefined') module.exports = RANK_SEASON;
