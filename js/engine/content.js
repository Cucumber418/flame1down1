/* Shared offline moderation for player-written text. Never scan passwords, story or battle data. */
var CONTENT = (function (data) {
  'use strict';
  var root = Object.create(null), labels = { politics: '政治敏感', adult: '色情', ads: '广告', abuse: '辱骂', gamblingFraud: '赌博诈骗' };
  var traditional = { '習':'习','澤':'泽','東':'东','國':'国','產':'产','黨':'党','獨':'独','輪':'轮','幹':'干','體':'体','賣':'卖','買':'买','賭':'赌','詐':'诈','騙':'骗','媽':'妈','罵':'骂','傻':'傻','屄':'逼','筆':'笔','腦':'脑','殘':'残','癱':'瘫','賤':'贱','貨':'货','雞':'鸡','陰':'阴','莖':'茎','愛':'爱','殺':'杀','豬':'猪','滅':'灭','門':'门','萬':'万','歲':'岁','偉':'伟','華':'华','學':'学','運':'运','動':'动','總':'总','書':'书','記':'记','領':'领','導':'导','軍':'军','權':'权','獎':'奖','獲':'获','獻':'献','紅':'红','亂':'乱','榮':'荣','發':'发','網':'网','號':'号','錢':'钱','幣':'币','開':'开','辦':'办','證':'证','貸':'贷','臺':'台','獄':'狱','陳':'陈','劉':'刘','張':'张','鄧':'邓','溫':'温','寶':'宝' };
  function prepare(value) {
    var s = typeof value === 'string' ? value : '', chars = [], gaps = [], gap = true;
    if (s.normalize) s = s.normalize('NFKC');
    Array.from(s.toLowerCase()).forEach(function (c) {
      c = traditional[c] || c;
      if (/[\s\p{P}\p{S}\p{Cf}\p{Cc}\p{M}]/u.test(c)) { gap = true; return; }
      chars.push(c); gaps.push(gap); gap = false;
    });
    return { chars: chars, gaps: gaps };
  }
  function normalize(value) { return prepare(value).chars.join(''); }
  Object.keys(data.categories).forEach(function (cat) {
    data.categories[cat].forEach(function (word) {
      var key = normalize(word); if (!key) return;
      var node = root;
      Array.from(key).forEach(function (c) { node = node[c] || (node[c] = Object.create(null)); });
      if (!node.end) node.end = { word: word, category: cat, ascii: /^[a-z0-9]+$/.test(key) };
    });
  });
  function match(value) {
    var prepared = prepare(value), text = prepared.chars, gaps = prepared.gaps;
    for (var i = 0; i < text.length; i++) {
      var node = root;
      for (var j = i; j < text.length && node[text[j]]; j++) {
        node = node[text[j]];
        if (node.end && (!node.end.ascii || ((gaps[i] || !/[a-z0-9]/.test(text[i - 1] || '')) && (gaps[j + 1] || !/[a-z0-9]/.test(text[j + 1] || ''))))) return { word: node.end.word, category: node.end.category };
      }
    }
    return null;
  }
  function error(value, label) { return match(value) ? (label || '内容') + '含有敏感词，请修改后再试。' : ''; }
  function accountError(a, old) {
    if (!a || typeof a !== 'object') return '';
    old = old || {};
    var fields = [[a.name, old.name, '做题家名字'], [a.home && a.home.name, old.home && old.home.name, '基地名字'], [a.card && a.card.motto, old.card && old.card.motto, '名片签名']];
    (Array.isArray(a.tNames) ? a.tNames : []).forEach(function (v, i) { fields.push([v, old.tNames && old.tNames[i], '配队名字']); });
    var previous = Object.create(null);
    (Array.isArray(old.mons) ? old.mons : []).forEach(function (m) { if (m) previous[m.u] = m.nickname; });
    (Array.isArray(a.mons) ? a.mons : []).forEach(function (m) { if (m) fields.push([m.nickname, previous[m.u], '精灵名字']); });
    for (var i = 0; i < fields.length; i++) if (fields[i][0] !== fields[i][1]) { var e = error(fields[i][0], fields[i][2]); if (e) return e; }
    return '';
  }
  function saveError(data, before) {
    var a, old;
    try { a = JSON.parse(data && data['hs-account-v1'] || 'null'); old = JSON.parse(before && before['hs-account-v1'] || 'null'); } catch (e) { return ''; }
    return accountError(a, old);
  }
  function requestError(url, body) {
    if (!body) return '';
    url = String(url).split('?')[0];
    if (url === '/api/register') return error(body.user, '账号名') || saveError(body.data);
    if (['/api/board','/api/dm','/api/home-msg','/api/boss-post'].indexOf(url) >= 0) return error(body.text, '内容');
    if (url === '/api/home-ev') return error(body.mon, '精灵名字');
    return '';
  }
  return { version: data.version, categories: labels, normalize: normalize, match: match, error: error, accountError: accountError, saveError: saveError, requestError: requestError };
})(typeof CONTENT_WORDS !== 'undefined' ? CONTENT_WORDS : require('../data/content-words'));
if (typeof module !== 'undefined') module.exports = CONTENT;
