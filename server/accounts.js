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
 *   PUT  /api/save       { data, rev }          上传存档；rev 是这份存档基于的版本号，对不上返回 409
 *   POST /api/password   { old, pass }          修改密码（会让其他设备上的登录失效）
 *   POST /api/logout                            退出登录
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', '..', 'flame1down-data');
var USER_DIR = path.join(DATA_DIR, 'users');
var SESS_FILE = path.join(DATA_DIR, 'sessions.json');
var SESSION_DAYS = 60;
var MAX_BODY = 2 * 1024 * 1024;   // 存档上限 2MB
var NAME_RE = /^[一-龥A-Za-z0-9_]{2,16}$/;

fs.mkdirSync(USER_DIR, { recursive: true });

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
function loadUser(name) { return readJSON(userFile(name), null); }
function saveUser(u) {
  var f = userFile(u.name);
  // 存档每次覆盖前留一份上一版，万一出问题还能找回
  if (fs.existsSync(f)) { try { fs.copyFileSync(f, f + '.prev'); } catch (e) {} }
  writeJSON(f, u);
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
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
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
    try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { cb(e); }
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
      if (pass.length < 6 || pass.length > 64) return reply(res, 400, { error: '密码要 6–64 位' });
      if (body.data != null && !validData(body.data)) return reply(res, 400, { error: '存档格式不对' });
      if (tooMany(ip)) return reply(res, 429, { error: '尝试次数太多，请 15 分钟后再试' });
      if (loadUser(name)) return reply(res, 409, { error: '这个账号名已经被注册了' });
      var salt = crypto.randomBytes(16).toString('hex');
      return hashPass(pass, salt, function (e, h) {
        if (e) return reply(res, 500, { error: '服务器出错了' });
        if (loadUser(name)) return reply(res, 409, { error: '这个账号名已经被注册了' });
        var u = { name: name, salt: salt, hash: h, created: Date.now(), save: null };
        if (body.data) u.save = { data: body.data, rev: 1, savedAt: Date.now() };
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
      var cur = me.save ? me.save.rev : 0;
      if (body.force && me.save && me.save.lock && Date.now() < (me.save.lockUntil || 0) && (body.rev | 0) < me.save.lock) return reply(res, 409, { error: '存档刚由管理员恢复过，请使用服务器上的进度', save: saveOut(me) });   // 恢复存档后不让旧设备强行覆盖
      if (!body.force && (body.rev | 0) !== cur) return reply(res, 409, { error: '存档在别的设备上更新过', save: saveOut(me) });
      me.save = { data: body.data, rev: cur + 1, savedAt: Date.now() };
      saveUser(me);
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

module.exports = { handle: handle, use: function (fn) { extra.push(fn); }, whoIs: whoIs, whoToken: whoToken, loadUser: loadUser, saveUser: saveUser, allUsers: allUsers,
  reply: reply, readBody: readBody, userCount: userCount, resetPassword: resetPassword, listUsers: listUsers, DATA_DIR: DATA_DIR };
