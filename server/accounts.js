/*
 * 账号与云存档
 *
 * 数据放在仓库外面的 DATA_DIR（默认 /opt/flame1down-data），git pull 更新代码不会碰到它，网页也读不到它。
 *   users/<名字的十六进制>.json   一个账号一个文件：名字、密码哈希、存档
 *   sessions.json                  登录凭证（只存凭证的哈希）
 *
 * 密码用 scrypt 加盐哈希保存，服务器上不存明文。
 *
 * 接口（都是 JSON；登录后的请求带请求头 Authorization: Bearer <token>）：
 *   POST /api/register   { user, pass, data? }  注册；data 是可选的初始存档（把本机旧存档带上来）
 *   POST /api/login      { user, pass }         登录，返回 token 和存档
 *   GET  /api/me                                用 token 取回账号和存档
 *   PUT  /api/save       { data, rev, claims }  上传存档；rev 是这份存档基于的版本号，对不上返回 409；claims 是进账申报（见 claims.js）
 *   POST /api/password   { old, pass }          修改密码（会让其他设备上的登录失效）
 *   POST /api/logout                            退出登录
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var CONTENT = require('../js/engine/content');

var DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', '..', 'flame1down-data');
var USER_DIR = path.join(DATA_DIR, 'users');
var SESS_FILE = path.join(DATA_DIR, 'sessions.json');
var SESSION_DAYS = 60;
var MAX_BODY = 2 * 1024 * 1024;   // 存档上限 2MB
var NAME_RE = /^[一-龥A-Za-z0-9_]{2,16}$/;

fs.mkdirSync(USER_DIR, { recursive: true });
var claims = require('./claims');   // 进账申报与钱包核对（2026-10-24）
claims.init(DATA_DIR);

/* ---------- 文件读写（先写临时文件再改名，断电也不会写坏一半） ---------- */
function readJSON(file, dflt) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return dflt; }
}
function writeJSON(file, obj) {
  var tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}
function userFile(name) { return path.join(USER_DIR, Buffer.from(name.toLowerCase(), 'utf8').toString('hex') + '.json'); }
// 存档进度粗略打分：精灵等级总和 + 读完的剧情数 × 20（用来识别「被重置」的存档）
function progScore(data) {
  var acc = null; try { acc = JSON.parse((data || {})['hs-account-v1'] || 'null'); } catch (e) {}
  if (!acc || !Array.isArray(acc.mons)) return 0;
  var lv = 0; acc.mons.forEach(function (m) { lv += (m && m.lv) | 0; });
  var st = 0; if (acc.story) for (var k in acc.story) if (acc.story[k] && acc.story[k].done) st++;
  return lv + st * 20;
}
/* ---------- 防改档（2026-10-22）：上传的存档和服务器上那份比，数值涨得离谱就拒收 ----------
 * 只看几项关键数值：经验背包、能量、竞技代币、先驱代币、道具数量、精灵等级（换算成大致的总经验 lv³）。
 * 门槛放得很宽（正常游戏、补发邮件都不会碰到），只拦直接改数值的情况。 */
function stats(data) {
  var acc = null; try { acc = JSON.parse((data || {})['hs-account-v1'] || 'null'); } catch (e) {}
  if (!acc || typeof acc !== 'object') return null;
  var num = function (v) { v = +v; return isFinite(v) ? v : 1e18; };
  var o = { exp: num(acc.exp || 0), energy: num(acc.energy || 0), tokens: num(acc.tokens || 0), twTok: num((acc.tower && acc.tower.tok) || 0), item: 0, itemSum: 0, mxp: 0, maxLv: 0, mons: Array.isArray(acc.mons) ? acc.mons.length : 0 };
  if (acc.items && typeof acc.items === 'object') for (var k in acc.items) { var n = num(acc.items[k] || 0); o.itemSum += n; if (n > o.item) o.item = n; }
  (Array.isArray(acc.mons) ? acc.mons : []).forEach(function (m) { var lv = num(m && m.lv || 0); o.mxp += Math.pow(Math.min(lv, 1000), 3); if (lv > o.maxLv) o.maxLv = lv; });
  return o;
}
var CHEAT = {
  abs: { exp: 60e6, energy: 30e6, tokens: 2e6, twTok: 2e6, item: 200000, maxLv: 100, mons: 3000 },
  // 每次上传相对上一份最多涨多少：base + perHour × 间隔小时数
  delta: { exp: [20e6, 3e6], energy: [3e6, 5e5], tokens: [2e5, 5e4], twTok: [1e5, 3e4], itemSum: [50000, 10000], mxp: [25e6, 4e6] }
};
function cheatCheck(oldData, newData, dtMs) {
  var b = stats(newData); if (!b) return null;
  for (var k in CHEAT.abs) if (b[k] > CHEAT.abs[k]) return k + ' 超出上限（' + b[k] + '）';
  var a = stats(oldData); if (!a) return null;
  var h = Math.max(1 / 60, (dtMs || 0) / 3600000);
  for (var d in CHEAT.delta) { var lim = CHEAT.delta[d][0] + CHEAT.delta[d][1] * h; if (b[d] - a[d] > lim) return d + ' 一次涨了 ' + Math.round(b[d] - a[d]) + '（上限 ' + Math.round(lim) + '）'; }
  return null;
}
// 每天（北京时间）累计涨幅上限：防止每次只涨一点、靠频繁上传慢慢刷
var DAY_CAP = { exp: 30e6, energy: 5e6, tokens: 3e5, twTok: 2e5, itemSum: 80000, mxp: 40e6 };
function dayCheck(u, oldData, newData) {
  var a = stats(oldData), b = stats(newData); if (!a || !b) return null;
  var d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  var g = u.gain && u.gain.d === d ? u.gain : { d: d };
  for (var k in DAY_CAP) { var inc = Math.max(0, b[k] - a[k]); if ((g[k] || 0) + inc > DAY_CAP[k]) return k + ' 今天累计涨幅超出上限'; }
  for (var k2 in DAY_CAP) g[k2] = (g[k2] || 0) + Math.max(0, b[k2] - a[k2]);
  u.gain = g; return null;
}
function cheatLog(name, why) { try { fs.appendFileSync(path.join(DATA_DIR, 'cheat.log'), new Date().toISOString() + '\t' + name + '\t' + why + '\n'); } catch (e) {} }
function loadUser(name) { var u = readJSON(userFile(name), null); if (u && u.save && require('../js/data/rank-season').migrate(u.save.data)) { u.save.rev = (u.save.rev || 0) + 1; u.save.savedAt = Date.now(); saveUser(u); } return u; }
function saveUser(u) {
  var f = userFile(u.name), events = [];
  try { events = require('./activity').prepare(readJSON(f, null), u, Date.now()); } catch (err) { console.error('动态生成失败', err.message); }
  // 存档每次覆盖前留一份上一版，万一出问题还能找回
  if (fs.existsSync(f)) { try { fs.copyFileSync(f, f + '.prev'); } catch (e) {} }
  writeJSON(f, u);
  try { require('./activity').publish(DATA_DIR, events); } catch (err) { console.error('动态写入失败', err.message); }
}

/* ---------- 登录凭证 ---------- */
var sessions = readJSON(SESS_FILE, {});   // sha256(token) -> { user, exp }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function saveSessions() {
  var now = Date.now();
  Object.keys(sessions).forEach(function (k) { if (sessions[k].exp < now) delete sessions[k]; });
  writeJSON(SESS_FILE, sessions);
}
function newSession(name) {
  var token = crypto.randomBytes(32).toString('hex');
  sessions[sha(token)] = { user: name, exp: Date.now() + SESSION_DAYS * 864e5 };
  saveSessions();
  return token;
}
function whoIs(req) {
  var m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization || '');
  return m ? whoToken(m[1]) : null;
}
// 用登录凭证找到账号（WebSocket 连接认证也用这个）
function whoToken(token) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null;
  var m = [null, token];
  var s = sessions[sha(m[1])];
  if (!s || s.exp < Date.now()) return null;
  // 每次使用时顺延有效期（每天最多写一次文件）
  var exp = Date.now() + SESSION_DAYS * 864e5;
  if (exp - s.exp > 864e5) { s.exp = exp; saveSessions(); }
  return { user: s.user, key: sha(m[1]) };
}

/* ---------- 密码 ---------- */
function hashPass(pass, salt, cb) {
  crypto.scrypt(pass, salt, 64, function (err, buf) { cb(err, buf && buf.toString('hex')); });
}
function checkPass(u, pass, cb) {
  hashPass(pass, u.salt, function (err, h) {
    if (err) return cb(false);
    cb(crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex')));
  });
}

/* ---------- 防止暴力猜密码：同一个 IP 15 分钟内最多失败 10 次 ---------- */
var fails = {};
function tooMany(ip) { var f = fails[ip]; return !!(f && f.n >= 10 && Date.now() - f.t < 15 * 60e3); }
function addFail(ip) { var f = fails[ip]; if (!f || Date.now() - f.t > 15 * 60e3) f = fails[ip] = { n: 0, t: Date.now() }; f.n++; }
setInterval(function () { var now = Date.now(); Object.keys(fails).forEach(function (k) { if (now - fails[k].t > 15 * 60e3) delete fails[k]; }); }, 10 * 60e3).unref();

/* ---------- HTTP 小工具 ---------- */
function reply(res, code, obj) {
  if (res.headersSent) return;   // 已经回过了（比如处理到一半出错）：不再回第二次
  var body = JSON.stringify(obj);   // 先转好再写响应头：转不了时抛出的错误由调用方处理，不会留下半截响应
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, cb) {
  var chunks = [], size = 0, done = false;
  req.on('data', function (c) {
    if (done) return;
    size += c.length;
    if (size > MAX_BODY) { done = true; cb(new Error('too big')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', function () {
    if (done) return; done = true;
    var body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { cb(e); return; }
    try { cb(null, body); } catch (e) {   // 处理时出错：记下来，回「请求格式不对」（已经回过的就不再回）
      console.error('处理请求出错', req.method, req.url, e && e.stack);
      try { cb(e); } catch (e2) {}
    }
  });
}
function clientIp(req) { return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'; }
function saveOut(u) { return u.save ? { data: u.save.data, rev: u.save.rev, savedAt: u.save.savedAt } : null; }
function validData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  return Object.keys(d).every(function (k) { return /^hs-[a-z0-9-]{1,40}$/.test(k) && typeof d[k] === 'string'; });
}

/* ---------- 各个接口 ---------- */
var extra = [];   // 其他模块（社交）注册的接口
function handle(req, res) {
  var url = req.url.split('?')[0];
  if (url.indexOf('/api/') !== 0) return false;
  for (var i = 0; i < extra.length; i++) if (extra[i](req, res, url)) return true;
  var ip = clientIp(req);

  if (url === '/api/me' && req.method === 'GET') {
    var w = whoIs(req), u = w && loadUser(w.user);
    if (!u) return reply(res, 401, { error: '登录已失效，请重新登录' }), true;
    return reply(res, 200, { user: u.name, save: saveOut(u) }), true;
  }

  if (req.method !== 'POST' && req.method !== 'PUT') return reply(res, 405, { error: '不支持' }), true;

  readBody(req, function (err, body) {
    if (err) return reply(res, 400, { error: err.message === 'too big' ? '存档太大了' : '请求格式不对' });

    if (url === '/api/register' && req.method === 'POST') {
      var name = String(body.user || '').trim(), pass = String(body.pass || '');
      if (!NAME_RE.test(name)) return reply(res, 400, { error: '账号名要 2–16 个字，只能用汉字、字母、数字和下划线' });
      var contentErr = CONTENT.error(name, '账号名') || CONTENT.saveError(body.data);
      if (contentErr) return reply(res, 400, { error: contentErr });
      if (pass.length < 6 || pass.length > 64) return reply(res, 400, { error: '密码要 6–64 位' });
      if (body.data != null && !validData(body.data)) return reply(res, 400, { error: '存档格式不对' });
      if (tooMany(ip)) return reply(res, 429, { error: '尝试次数太多，请 15 分钟后再试' });
      if (loadUser(name)) return reply(res, 409, { error: '这个账号名已经被注册了' });
      var salt = crypto.randomBytes(16).toString('hex');
      return hashPass(pass, salt, function (e, h) {
        if (e) return reply(res, 500, { error: '服务器出错了' });
        if (loadUser(name)) return reply(res, 409, { error: '这个账号名已经被注册了' });
        var u = { name: name, salt: salt, hash: h, created: Date.now(), save: null };
        if (body.data && !cheatCheck(null, body.data, 0)) u.save = { data: body.data, rev: 1, savedAt: Date.now() };
        saveUser(u);
        addFail(ip);   // 注册也计入次数，防止有人批量注册
        reply(res, 200, { token: newSession(name), user: name, save: saveOut(u) });
      });
    }

    if (url === '/api/login' && req.method === 'POST') {
      if (tooMany(ip)) return reply(res, 429, { error: '尝试次数太多，请 15 分钟后再试' });
      var u2 = loadUser(String(body.user || '').trim());
      if (!u2) { addFail(ip); return reply(res, 401, { error: '账号或密码不对' }); }
      return checkPass(u2, String(body.pass || ''), function (ok) {
        if (!ok) { addFail(ip); return reply(res, 401, { error: '账号或密码不对' }); }
        reply(res, 200, { token: newSession(u2.name), user: u2.name, save: saveOut(u2) });
      });
    }

    var who = whoIs(req), me = who && loadUser(who.user);
    if (!me) return reply(res, 401, { error: '登录已失效，请重新登录' });

    if (url === '/api/save' && req.method === 'PUT') {
      if (!validData(body.data)) return reply(res, 400, { error: '存档格式不对' });
      var contentErr = CONTENT.saveError(body.data, me.save && me.save.data);
      if (contentErr) return reply(res, 400, { error: contentErr });
      var cur = me.save ? me.save.rev : 0;
      // 管理员恢复过的存档（save.guard）：保护期内拒绝进度明显倒退的上传（不管是不是强行覆盖）
      var G = me.save && me.save.guard;
      if (G && Date.now() < G.until && progScore(body.data) < G.min) return reply(res, 409, { error: '存档刚由管理员恢复过，请使用服务器上的进度', save: saveOut(me) });
      var why = cheatCheck(me.save && me.save.data, body.data, me.save ? Date.now() - (me.save.savedAt || 0) : 0) || ((body.rev | 0) === cur ? dayCheck(me, me.save && me.save.data, body.data) : null);
      if (why) { cheatLog(me.name, why); return reply(res, 409, { error: '存档数值异常，已恢复为服务器上的进度', cheat: true, save: saveOut(me) }); }
      if ((body.rev | 0) !== cur) return reply(res, 409, { error: '存档在别的设备上更新过', save: saveOut(me) });
      // 进账申报 + 钱包核对：试运行模式只记录，正式模式会把多出来的数值改回去
      var W = claims.onUpload(me, body.claims, me.save && me.save.data, body.data, { claims: Array.isArray(body.claims), v: body.v });
      me.save = { data: W.data, rev: cur + 1, savedAt: Date.now(), guard: G && Date.now() < G.until ? G : undefined };
      saveUser(me);
      if (W.fixed) return reply(res, 200, { rev: me.save.rev, savedAt: me.save.savedAt, fixed: W.fixed, save: saveOut(me) });
      if (W.sync && W.sync.length) {   // 服务器悄悄改回了自己管的数值：把改过的这几项发回去
        var fx = {}, A2 = null; try { A2 = JSON.parse(W.data['hs-account-v1']); } catch (e) {}
        if (A2) W.sync.forEach(function (k) { fx[k] = A2[k] === undefined ? null : A2[k]; });
        return reply(res, 200, { rev: me.save.rev, savedAt: me.save.savedAt, fix: fx });
      }
      return reply(res, 200, { rev: me.save.rev, savedAt: me.save.savedAt });
    }

    if (url === '/api/password' && req.method === 'POST') {
      var np = String(body.pass || '');
      if (np.length < 6 || np.length > 64) return reply(res, 400, { error: '新密码要 6–64 位' });
      if (tooMany(ip)) return reply(res, 429, { error: '尝试次数太多，请 15 分钟后再试' });
      return checkPass(me, String(body.old || ''), function (ok) {
        if (!ok) { addFail(ip); return reply(res, 401, { error: '原密码不对' }); }
        var s2 = crypto.randomBytes(16).toString('hex');
        hashPass(np, s2, function (e, h) {
          if (e) return reply(res, 500, { error: '服务器出错了' });
          me.salt = s2; me.hash = h; saveUser(me);
          // 其他设备上的登录全部失效，只保留当前这个
          Object.keys(sessions).forEach(function (k) { if (sessions[k].user === me.name && k !== who.key) delete sessions[k]; });
          saveSessions();
          reply(res, 200, { ok: true });
        });
      });
    }

    if (url === '/api/logout' && req.method === 'POST') {
      delete sessions[who.key]; saveSessions();
      return reply(res, 200, { ok: true });
    }

    reply(res, 404, { error: '没有这个接口' });
  });
  return true;
}

function userCount() { try { return fs.readdirSync(USER_DIR).filter(function (f) { return /\.json$/.test(f); }).length; } catch (e) { return 0; } }

/* ---------- 给管理脚本用 ---------- */
function resetPassword(name, pass, cb) {
  var u = loadUser(name);
  if (!u) return cb(new Error('没有这个账号：' + name));
  var salt = crypto.randomBytes(16).toString('hex');
  hashPass(pass, salt, function (e, h) {
    if (e) return cb(e);
    u.salt = salt; u.hash = h; saveUser(u);
    Object.keys(sessions).forEach(function (k) { if (sessions[k].user === u.name) delete sessions[k]; });
    saveSessions();
    cb(null, u.name);
  });
}
function listUsers() {
  return fs.readdirSync(USER_DIR).filter(function (f) { return /\.json$/.test(f); }).map(function (f) {
    var u = readJSON(path.join(USER_DIR, f), null);
    return u && { name: u.name, created: u.created, savedAt: u.save ? u.save.savedAt : null, rev: u.save ? u.save.rev : 0 };
  }).filter(Boolean);
}

function allUsers() {
  return fs.readdirSync(USER_DIR).filter(function (f) { return /\.json$/.test(f); })
    .map(function (f) { return readJSON(path.join(USER_DIR, f), null); }).filter(Boolean);
}

// 服内所有已注册船员互为好友；旧关注名单仅保留作存档兼容。
function areFriends(a, b) { if (typeof a === 'string') a = loadUser(a); if (typeof b === 'string') b = loadUser(b); return !!(a && b && a.name && b.name && a.name !== b.name); }

module.exports = { areFriends: areFriends, handle: handle, use: function (fn) { extra.push(fn); }, whoIs: whoIs, whoToken: whoToken, loadUser: loadUser, saveUser: saveUser, allUsers: allUsers,
  reply: reply, readBody: readBody, userCount: userCount, walletStatus: claims.status, resetPassword: resetPassword, listUsers: listUsers, DATA_DIR: DATA_DIR, progScore: progScore, cheatCheck: cheatCheck, cheatStats: stats };

// 所有账号进入 S2；保留已拥有的精灵、道具与旧赛季称号
fs.readdirSync(USER_DIR).filter(function (f) { return /^[0-9a-f]+\.json$/.test(f); }).forEach(function (f) { var u = readJSON(path.join(USER_DIR, f), null); if (u && u.name) loadUser(u.name); });
