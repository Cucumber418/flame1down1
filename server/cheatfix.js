/*
 * 2026-10-22：有玩家直接改本地存档里的数值（经验等）再上传覆盖了云端。
 * 服务器启动后（只运行一次）：取最近 4 天的存档备份，逐个账号按时间比较相邻两份存档，
 * 「经验背包 + 精灵等级折算经验」「能量」「道具总数」涨得超出正常范围，或者数值超出绝对上限，就认定是改档；
 * 把这个账号恢复到改档之前最晚的一份备份（原存档另存到 DATA_DIR/cheatfix-before/）。
 * 结果写在 DATA_DIR/cheatfix.json，可以访问 GET /api/cheatfix 查看（只有账号、时间和数值，不含存档内容）。
 */
'use strict';

var fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
var A = require('./accounts');

var BACKUP_DIR = process.env.BACKUP_DIR || '/opt/flame1down-backups';
var OUT = path.join(A.DATA_DIR, 'cheatfix.json');
var DAYS = 4, BJ = 8 * 3600e3;
function bj(t) { return t ? new Date(t + BJ).toISOString().replace('T', ' ').slice(0, 19) : null; }

// 两份存档之间正常能涨多少（h = 间隔小时）。先驱之塔奖励补发邮件按通关层数算，一并放宽
function towerComp(data) {
  var acc = null; try { acc = JSON.parse((data || {})['hs-account-v1'] || 'null'); } catch (e) {}
  var T = acc && acc.tower; if (!T) return 0;
  var nf = (T.clears || 0) * 60 + Math.max(0, (T.f || 1) - 1), e = 0;
  for (var i = 0; i < nf; i++) { var f = i % 60 + 1; e += (f >= 60 ? 16000 : 400 + 20 * f) * 9; }
  return e;
}
function judge(a, b, h, newData) {
  var S = A.cheatStats, x = S(a), y = S(newData); if (!y) return null;
  var ABS = { exp: 60e6, energy: 30e6, item: 200000, maxLv: 100 };
  for (var k in ABS) if (y[k] > ABS[k]) return k + ' = ' + Math.round(y[k]) + '（超出上限 ' + ABS[k] + '）';
  if (!x) return null;
  var T0 = x.exp + x.mxp, T1 = y.exp + y.mxp, lim = 3e6 + 1e6 * h + towerComp(newData) + 1e6;
  if (T1 - T0 > lim) return '经验（背包 + 精灵等级折算）涨了 ' + Math.round(T1 - T0) + '（正常上限约 ' + Math.round(lim) + '）';
  if (y.energy - x.energy > 5e5 + 1e5 * h) return '能量涨了 ' + Math.round(y.energy - x.energy);
  if (y.itemSum - x.itemSum > 2e4 + 2e3 * h) return '道具总数涨了 ' + Math.round(y.itemSum - x.itemSum);
  return null;
}

function run() {
  var prev = null; try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  if (prev && prev.done) return;
  var rep = { done: true, at: bj(Date.now()), flagged: [], note: '' };
  var since = Date.now() - DAYS * 86400e3, files = [];
  try {
    files = fs.readdirSync(BACKUP_DIR).filter(function (f) { return /^saves-.*\.tar\.gz$/.test(f); })
      .map(function (f) { return { f: f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }; })
      .filter(function (x) { return x.t >= since; }).sort(function (a, b) { return a.t - b.t; });
  } catch (e) { rep.note = '读不到备份目录：' + e.message; }
  // 每个账号：[{ src, data, savedAt }]，按时间排；同一份存档（savedAt 一样）只留一次
  var snaps = {};
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfx-'));
  files.forEach(function (x, i) {
    var dir = path.join(tmp, 'b'); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} fs.mkdirSync(dir);
    try { cp.execFileSync('tar', ['-xzf', path.join(BACKUP_DIR, x.f), '-C', dir, '--wildcards', '*/users/*.json'], { stdio: 'ignore' }); } catch (e) {}
    var ud = null; (function walk(d) { fs.readdirSync(d).forEach(function (n) { var p = path.join(d, n); if (fs.statSync(p).isDirectory()) { if (n === 'users') ud = p; else walk(p); } }); })(dir);
    if (!ud) return;
    fs.readdirSync(ud).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
      var u = null; try { u = JSON.parse(fs.readFileSync(path.join(ud, f), 'utf8')); } catch (e) {}
      if (!u || !u.name || !u.save || !u.save.data) return;
      var L = snaps[u.name] || (snaps[u.name] = []);
      if (L.length && L[L.length - 1].savedAt === u.save.savedAt) return;
      L.push({ src: x.f, data: u.save.data, savedAt: u.save.savedAt || x.t });
    });
  });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  // 加上当前服务器上的存档
  A.allUsers().forEach(function (u) {
    if (!u || !u.save || !u.save.data) return;
    var L = snaps[u.name] || (snaps[u.name] = []);
    if (!L.length || L[L.length - 1].savedAt !== u.save.savedAt) L.push({ src: '当前存档', data: u.save.data, savedAt: u.save.savedAt });
  });
  var bdir = path.join(A.DATA_DIR, 'cheatfix-before');
  Object.keys(snaps).forEach(function (name) {
    var L = snaps[name], k = -1, why = null;
    for (var i = 0; i < L.length; i++) {
      var h = i ? Math.max(1 / 60, (L[i].savedAt - L[i - 1].savedAt) / 3600e3) : 0;
      why = judge(i ? L[i - 1].data : null, null, h, L[i].data);
      if (why) { k = i; break; }
    }
    if (k < 0) return;
    var item = { user: name, why: why, at: bj(L[k].savedAt), src: L[k].src };
    if (k === 0) { item.note = '最早的备份里就已经异常，没有可以恢复的干净存档，没有改动'; rep.flagged.push(item); return; }
    var good = L[k - 1], cur = A.loadUser(name);
    if (!cur) return;
    try { fs.mkdirSync(bdir, { recursive: true }); fs.writeFileSync(path.join(bdir, Buffer.from(name).toString('hex') + '.json'), JSON.stringify(cur)); } catch (e) {}
    var gs = A.cheatStats(good.data), bs = A.cheatStats(cur.save.data);
    cur.save = { data: good.data, rev: (cur.save.rev || 0) + 1, savedAt: Date.now() };
    A.saveUser(cur);
    item.restoredTo = { src: good.src, savedAt: bj(good.savedAt), exp: gs && gs.exp, energy: gs && gs.energy };
    item.before = { exp: bs && bs.exp, energy: bs && bs.energy };
    rep.flagged.push(item);
    console.log('[cheatfix] 恢复 ' + name + ' → ' + good.src + '（' + why + '）');
  });
  fs.writeFileSync(OUT, JSON.stringify(rep, null, 1));
}

setTimeout(function () { try { run(); } catch (e) { console.log('[cheatfix] 出错', e && e.stack); } }, 5000);

A.use(function (req, res, url) {
  if (url !== '/api/cheatfix') return false;
  var r = null; try { r = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  var log = ''; try { log = fs.readFileSync(path.join(A.DATA_DIR, 'cheat.log'), 'utf8').split('\n').slice(-50).join('\n'); } catch (e) {}
  A.reply(res, 200, { fix: r || { done: false }, rejected: log });
  return true;
});
