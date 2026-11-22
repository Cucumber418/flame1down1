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
  return { id: id, state: state, migrate: migrate };
})();
if (typeof module !== 'undefined') module.exports = RANK_SEASON;
