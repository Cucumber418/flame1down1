/*
 * 2026-10-21：账号 @11 的存档被重置了，找回重置前最晚的一份存档（只运行一次）
 *
 * 服务器启动后：把 BACKUP_DIR 里的每一份备份（按时间排序）都取出 @11 的存档，加上当前服务器上的存档，
 * 逐份比较「建号时间」和进度（精灵数、等级总和、读完的剧情数）。
 * 建号时间变了、或者进度一下子掉到一半以下的那一份，就是重置之后的第一份；它前面那份就是「重置前最晚的存档」。
 * 把那份存档写回 @11（版本号 +1；短时间内拒绝用旧设备强行覆盖），原来的存档另存为 DATA_DIR/restore11-before.json。
 * 结果写在 DATA_DIR/restore11.json，可以访问 GET /api/restore11 查看（只有时间和进度数字，不含存档内容）。
 */
'use strict';

var fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
var A = require('./accounts');

var NAME = '11';
var BACKUP_DIR = process.env.BACKUP_DIR || '/opt/flame1down-backups';
var OUT = path.join(A.DATA_DIR, 'restore11b.json');   // 2026-10-21 第二次：第一次恢复后又被旧设备上的重置存档覆盖了，重新恢复并加上保护
var HEX = Buffer.from(NAME.toLowerCase(), 'utf8').toString('hex') + '.json';
var BJ = 8 * 3600 * 1000;

function bj(t) { return t ? new Date(t + BJ).toISOString().replace('T', ' ').slice(0, 19) : null; }
function sum(u) {
  var d = u && u.save && u.save.data, acc = null;
  try { acc = JSON.parse((d || {})['hs-account-v1'] || 'null'); } catch (e) {}
  if (!acc || !Array.isArray(acc.mons)) return null;
  var lv = 0; acc.mons.forEach(function (m) { lv += (m && m.lv) | 0; });
  var st = 0; if (acc.story) for (var k in acc.story) if (acc.story[k] && acc.story[k].done) st++;
  return { created: acc.created || 0, name: acc.name, mons: acc.mons.length, lv: lv, story: st, intro: !!acc.introDone, rev: u.save.rev, savedAt: u.save.savedAt };
}
function score(s) { return s ? s.lv + s.story * 20 : 0; }

function run() {
  var prev = null; try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  if (prev && prev.done) return;
  var rep = { done: true, at: bj(Date.now()), account: NAME, snaps: [], reset: null, restored: null, note: '' };
  var live = A.loadUser(NAME);
  if (!live) { rep.note = '找不到账号 @' + NAME; fs.writeFileSync(OUT, JSON.stringify(rep, null, 1)); console.log('[restore11]', rep.note); return; }
  var files = [];
  try {
    files = fs.readdirSync(BACKUP_DIR).filter(function (f) { return /^saves-.*\.tar\.gz$/.test(f); })
      .map(function (f) { return { f: f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }; }).sort(function (a, b) { return a.t - b.t; });
  } catch (e) { rep.note = '读不到备份目录：' + e.message; }
  var snaps = [];
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r11-'));
  files.forEach(function (x, i) {
    var dir = path.join(tmp, String(i)); fs.mkdirSync(dir);
    try { cp.execFileSync('tar', ['-xzf', path.join(BACKUP_DIR, x.f), '-C', dir, '--wildcards', '*/users/' + HEX], { stdio: 'ignore' }); } catch (e) {}
    var found = null; (function walk(d) { fs.readdirSync(d).forEach(function (n) { var p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (n === HEX) found = p; }); })(dir);
    if (!found) return;
    var u = null; try { u = JSON.parse(fs.readFileSync(found, 'utf8')); } catch (e) {}
    var s = sum(u); if (s) snaps.push({ src: x.f, t: x.t, s: s, u: u });
  });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  var ls = sum(live); if (ls) snaps.push({ src: '当前服务器存档', t: Date.now(), s: ls, u: live });
  rep.snaps = snaps.map(function (x) { return { src: x.src, time: bj(x.t), savedAt: bj(x.s.savedAt), created: bj(x.s.created), name: x.s.name, mons: x.s.mons, lvSum: x.s.lv, story: x.s.story, rev: x.s.rev }; });
  // 从后往前找最近一次重置：建号时间变了，或者进度掉到前一份的一半以下
  var k = -1;
  for (var i = snaps.length - 1; i > 0; i--) {
    var a = snaps[i - 1].s, b = snaps[i].s;
    if ((a.created && b.created && a.created !== b.created) || score(b) < score(a) * 0.5) { k = i; break; }
  }
  if (k < 0) { rep.note = '没有在备份里找到重置的痕迹，没有改动存档'; fs.writeFileSync(OUT, JSON.stringify(rep, null, 1)); console.log('[restore11]', rep.note); return; }
  var good = snaps[k - 1], bad = snaps[k];
  rep.reset = { between: [good.src, bad.src], after: bj(good.s.savedAt), before: bj(bad.s.savedAt || bad.t), newCreated: bj(bad.s.created) };
  var cur = A.loadUser(NAME);
  fs.writeFileSync(path.join(A.DATA_DIR, 'restore11b-before.json'), JSON.stringify(cur));
  var rev = (cur.save ? cur.save.rev : 0) + 1;
  var sc = A.progScore(good.u.save.data);
  cur.save = { data: good.u.save.data, rev: rev, savedAt: Date.now(), guard: { min: Math.floor(sc * 0.6), until: Date.now() + 14 * 86400000 } };
  A.saveUser(cur);
  rep.restored = { from: good.src, savedAt: bj(good.s.savedAt), mons: good.s.mons, lvSum: good.s.lv, story: good.s.story, newRev: rev };
  fs.writeFileSync(OUT, JSON.stringify(rep, null, 1));
  console.log('[restore11] 已恢复 @' + NAME + ' 到 ' + good.src + '（' + bj(good.s.savedAt) + '）');
}

setTimeout(function () { try { run(); } catch (e) { console.log('[restore11] 出错', e && e.stack); } }, 3000);

A.use(function (req, res, url) {
  if (url !== '/api/restore11') return false;
  var r = null, r1 = null; try { r = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  try { r1 = JSON.parse(fs.readFileSync(path.join(A.DATA_DIR, 'restore11.json'), 'utf8')); } catch (e) {}
  var L = A.loadUser(NAME), now = L && sum(L);
  A.reply(res, 200, { second: r || { done: false }, first: r1, now: now && { savedAt: bj(now.savedAt), mons: now.mons, lvSum: now.lv, story: now.story, rev: now.rev, created: bj(now.created) } });
  return true;
});
