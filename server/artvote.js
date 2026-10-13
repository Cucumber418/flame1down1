/*
 * 立绘更新投票（航行日志）：每名玩家最多选 5 只精灵，截止前可以改
 *
 * 票存在 DATA_DIR/artvote.json：{ votes: { 账号名: [sid, ...] } }
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/artvote              { mine: [sid], tally: { sid: 票数 }, voters: 投票人数, deadline, closed }
 *   POST /api/artvote { picks }    提交（覆盖自己之前的选择；空数组 = 撤回）
 * 候选名单在前端（js/ui/game.js 的 ART_VOTE），这里只检查格式和数量。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'artvote.json');
var MAX = 5;
var DEADLINE = Date.UTC(2026, 9, 16, 16, 0, 0);   // 北京时间 2026-10-17 00:00，即 10 月 16 日当天结束

function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return d && typeof d.votes === 'object' ? d : { votes: {} }; } catch (e) { return { votes: {} }; } }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function summary(d, me) {
  var tally = {}, voters = 0;
  Object.keys(d.votes).forEach(function (u) { var L = d.votes[u]; if (!Array.isArray(L) || !L.length) return; voters++; L.forEach(function (s) { tally[s] = (tally[s] || 0) + 1; }); });
  return { mine: d.votes[me] || [], tally: tally, voters: voters, deadline: DEADLINE, closed: Date.now() >= DEADLINE, max: MAX };
}

A.use(function (req, res, url) {
  if (url !== '/api/artvote') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  if (req.method === 'GET') { A.reply(res, 200, summary(load(), me.name)); return true; }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '不支持' }); return true; }
  A.readBody(req, function (err, body) {
    if (err) return A.reply(res, 400, { error: '请求格式不对' });
    if (Date.now() >= DEADLINE) return A.reply(res, 403, { error: '投票已经截止了' });
    var picks = Array.isArray(body.picks) ? body.picks : null;
    if (!picks) return A.reply(res, 400, { error: '参数不对' });
    picks = picks.filter(function (s, i, a) { return typeof s === 'string' && /^[a-z0-9_]{1,32}$/.test(s) && a.indexOf(s) === i; });
    if (picks.length > MAX) return A.reply(res, 400, { error: '最多只能选 ' + MAX + ' 只' });
    var d = load();
    if (picks.length) d.votes[me.name] = picks; else delete d.votes[me.name];
    store(d);
    A.reply(res, 200, summary(d, me.name));
  });
  return true;
});

module.exports = { load: load, FILE: FILE, DEADLINE: DEADLINE };
