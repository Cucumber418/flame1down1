/*
 * 2026-10-18：小月亮、骨刃隐藏技能恢复
 * 当天 17:36 的更新把小月亮、骨刃改成道具解锁，读档时清掉了玩家以前在战斗中领悟的这两系隐藏技能。
 * 后来决定：已经领悟过的保留。客户端那边的数据已经被清掉了，所以从那次部署之前的存档备份里找回来。
 *
 * 服务器启动后，从 BACKUP_DIR 里挑「截止时间之前最新的一份」备份，解压出所有账号，
 * 记下每个账号的小月亮（moon）、骨刃（bone）各自领悟过哪些隐藏技能，存成 DATA_DIR/hlrestore.json（只算一次）。
 *
 * HTTP 接口（需要登录）：
 *   GET /api/hlrestore   → { ready: true, sp: { moon: [...], bone: [...] } }；还没算好时 { ready: false }
 * 客户端拿到后合并进 acc.hlSp（同一种族共用的隐藏技能解锁表），只合并一次（acc.hlFix）。
 */
'use strict';

var fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
var A = require('./accounts');

var BACKUP_DIR = process.env.BACKUP_DIR || '/opt/flame1down-backups';
var CUTOFF = Date.parse('2026-10-18T09:50:00Z');   // 北京时间 17:50：17:36 那次部署前自动做的备份在这之前
var OUT = path.join(A.DATA_DIR, 'hlrestore.json');
var SIDS = { moon: 1, bone: 1 };
var map = null;

function load() { try { map = JSON.parse(fs.readFileSync(OUT, 'utf8')).users || {}; } catch (e) { map = null; } }
function build() {
  load(); if (map) return;
  var files = [];
  try {
    files = fs.readdirSync(BACKUP_DIR).filter(function (f) { return /^saves-.*\.tar\.gz$/.test(f); })
      .map(function (f) { return { f: f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }; })
      .filter(function (x) { return x.t <= CUTOFF; }).sort(function (a, b) { return b.t - a.t; });
  } catch (e) { console.log('[hlrestore] 读不到备份目录', e.message); }
  var users = {}, src = files.length ? files[0].f : null;
  if (src) {
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hlr-'));
    try {
      cp.execFileSync('tar', ['-xzf', path.join(BACKUP_DIR, src), '-C', tmp]);
      var dirs = []; (function walk(d) { fs.readdirSync(d).forEach(function (n) { var p = path.join(d, n); if (fs.statSync(p).isDirectory()) { if (n === 'users') dirs.push(p); else walk(p); } }); })(tmp);
      dirs.forEach(function (ud) {
        fs.readdirSync(ud).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
          try {
            var u = JSON.parse(fs.readFileSync(path.join(ud, f), 'utf8'));
            var acc = JSON.parse((u.save && u.save.data && u.save.data['hs-account-v1']) || 'null');
            if (!acc || !Array.isArray(acc.mons)) return;
            var sp = {};
            acc.mons.forEach(function (m) {
              if (!m || !SIDS[m.sid]) return;
              var hl = Array.isArray(m.hl) ? m.hl : [];
              (acc.hlSp && Array.isArray(acc.hlSp[m.sid]) ? acc.hlSp[m.sid] : []).concat(hl).forEach(function (n) {
                if (typeof n !== 'string') return; if (!sp[m.sid]) sp[m.sid] = []; if (sp[m.sid].indexOf(n) < 0) sp[m.sid].push(n);
              });
            });
            if (Object.keys(sp).length) users[String(u.name).toLowerCase()] = sp;
          } catch (e) {}
        });
      });
    } catch (e) { console.log('[hlrestore] 解压失败', e.message); }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
  map = users;
  if (src) try { fs.writeFileSync(OUT, JSON.stringify({ from: src, at: Date.now(), users: users })); } catch (e) {}   // 没找到备份就不记下来，下次启动再找
  console.log('[hlrestore] 来源备份 ' + src + '，' + Object.keys(users).length + ' 个账号有小月亮 / 骨刃的隐藏技能');
}
setTimeout(function () { try { build(); } catch (e) { console.log('[hlrestore]', e.message); map = map || {}; } }, 3000);

A.use(function (req, res, url) {
  if (url !== '/api/hlrestore') return false;
  var who = A.whoIs(req);
  if (!who || !A.loadUser(who.user)) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }
  if (!map) { A.reply(res, 200, { ready: false }); return true; }
  A.reply(res, 200, { ready: true, sp: map[String(who.user).toLowerCase()] || {} });
  return true;
});
