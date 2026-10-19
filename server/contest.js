/*
 * 太空竞技场 · 比赛报名（2026-10-19）：第一届做题大王争霸赛，目前只收报名，之后抽签
 *
 * 报名名单存在 DATA_DIR/contest.json：{ quiz1: { 账号名: 报名时间(ms) } }
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/contest        { id, mine: 是否已报名, at: 报名时间, count: 报名人数 }
 *   POST /api/contest        报名（重复报名不会多算）
 * 看名单：sudo cat /var/lib/flame1down1/contest.json（或 DATA_DIR 下的 contest.json）
 */
'use strict';

var path = require('path');
var fs = require('fs');
var A = require('./accounts');

var FILE = path.join(A.DATA_DIR, 'contest.json');
var CUR = 'quiz1';

function load() { try { var d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } }
function store(d) { var tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
function summary(d, me) { var L = d[CUR] || {}; return { id: CUR, mine: !!L[me], at: L[me] || 0, count: Object.keys(L).length }; }

A.use(function (req, res, url) {
  if (url !== '/api/contest') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  if (req.method === 'GET') { A.reply(res, 200, summary(load(), me.name)); return true; }
  if (req.method !== 'POST') { A.reply(res, 405, { error: '不支持' }); return true; }
  A.readBody(req, function (err) {
    if (err) return A.reply(res, 400, { error: '请求格式不对' });
    var d = load(); if (!d[CUR]) d[CUR] = {};
    if (!d[CUR][me.name]) { d[CUR][me.name] = Date.now(); store(d); }
    A.reply(res, 200, summary(d, me.name));
  });
  return true;
});

module.exports = { load: load, FILE: FILE };
