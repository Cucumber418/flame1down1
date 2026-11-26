/*
 * Flame1Down - 1 服务器
 *
 * 做两件事：
 * 1. 把游戏网页（仓库根目录下的 index.html、css、js、images）发给浏览器
 * 2. 账号和云存档（/api/...，见 accounts.js）
 * 3. 在 /ws 上开一个 WebSocket：在线状态、好友、切磋邀请、联网对战传话（见 social.js）
 *
 * 启动：node server.js        （默认端口 80，可用环境变量 PORT 改）
 * 检查：浏览器打开 http://服务器IP/ping ，看到 ok 就说明在运行
 *
 * 注意：为了兼容服务器上较老的 Node.js，这里只用老写法（var、function），不用 ?. 之类的新语法。
 */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var WebSocket = require('ws');
var accounts = require('./accounts');
var social = require('./social');
require('./board');   // 讨论区（公开留言板）
require('./bossboard');
require('./highland');
require('./contest');   // 太空竞技场 · 比赛报名
require('./artvote');   // 航行日志 · 立绘更新投票
require('./homelog');   // 茶室动态与留言板
require('./purgewar');
require('./kbwar');   // 2026-10-31：坎伯兰星保卫战
require('./chalboard');   // 全服挑战进度（星球挑战、先驱之塔）   // 瘴气驱逐战（全服共享进度）
require('./hlrestore');   // 2026-10-18：小月亮、骨刃隐藏技能从备份里恢复
require('./cheatfix');   // 2026-10-22：找出改档的账号并恢复到改档前（只运行一次）
require('./restore11');   // 2026-10-21：恢复 @11 被重置前的存档（只运行一次）
require('./pwreset');   // 2026-10-25：一次性重置 Cucumber418 的密码
require('./steal');   // 去好友基地偷经验（交易 homeSteal 用到的服务器部分）
require('./farm');   // 好友种植园、偷菜和种植园动态
require('./helpuse');   // 助战使用记录（上线领取奖励）
require('./friendpt');   // 2026-11-01：友情点、好友送经验
require('./dm');   // 私信   // BOSS攻略板（已通过的玩家、攻略、评分、点赞）
var txs = require('./tx');   // 交易结算（商城、代币商店、抽奖……），规则在 js/engine/tx.js
var pve = require('./pve');   // 单人对战由服务器结算（目前：先驱之塔），规则在 js/engine/pve.js

var PORT = parseInt(process.env.PORT, 10) || 80;
var ROOT = path.resolve(__dirname, '..');           // 仓库根目录
var STARTED = new Date();

/* ---------------- 1. 发网页 ---------------- */

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4'
};
// 这些目录和文件不对外提供
var HIDDEN = ['server', '.git', 'node_modules', 'desktop'];

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

function serveFile(req, res) {
  var urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch (e) { return send(res, 400, 'text/plain; charset=utf-8', '地址有误'); }
  if (urlPath === '/') urlPath = '/index.html';
  var file = path.resolve(ROOT, '.' + urlPath);
  // 防止用 ../ 读到仓库外面的文件
  if (file !== ROOT && file.indexOf(ROOT + path.sep) !== 0) return send(res, 403, 'text/plain; charset=utf-8', '禁止访问');
  var first = path.relative(ROOT, file).split(path.sep)[0];
  if (HIDDEN.indexOf(first) >= 0 || first.charAt(0) === '.') return send(res, 404, 'text/plain; charset=utf-8', '找不到');
  streamFile(req, res, file, urlPath);
}

function streamFile(req, res, file, urlPath, extra) {
  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) return send(res, 404, 'text/plain; charset=utf-8', '找不到：' + urlPath);
    var ext = path.extname(file).toLowerCase();
    var etag = '"' + st.size.toString(16) + '-' + st.mtime.getTime().toString(16) + '"';
    var headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'ETag': etag,
      // 每次都向服务器确认有没有更新：没变时只回 304，不会重新下载；换了图刷新就能看到
      'Cache-Control': 'no-cache'
    };
    if (extra) Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    headers['Accept-Ranges'] = 'bytes';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    // 音乐文件要支持「分段下载」（Range），不然 iPhone / Safari 放不出声音，也没法边下边播
    var m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      var start = m[1] ? parseInt(m[1], 10) : Math.max(0, st.size - parseInt(m[2], 10));
      var end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start: start, end: end }).pipe(res);
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// 存档备份情况（备份由 backup.sh 定时生成，见 README「存档备份」），在 /status 里能看到
var BACKUP_DIR = process.env.BACKUP_DIR || '/opt/flame1down-backups';
function backupInfo() {
  try {
    var f = fs.readdirSync(BACKUP_DIR).filter(function (x) { return /^saves-.*\.tar\.gz$/.test(x); }).sort();
    return { count: f.length, latest: f.length ? f[f.length - 1] : null };
  } catch (e) { return { count: 0, latest: null }; }
}

// Windows 客户端安装包（desktop/ 文件夹，由 GitHub 的「Windows 客户端」流程打包后传到这里）
// 放在存档目录旁边，不放进游戏目录：每次部署游戏都会把游戏目录同步成仓库的样子，放在里面会被删掉
//   /download/client.json   最新版本的信息 { version, file, size, date }
//   /download/windows       下载最新的安装包
var CLIENT_DIR = process.env.CLIENT_DIR || path.join(accounts.DATA_DIR, 'client');
function serveDownload(req, res) {
  var name = req.url.split('?')[0].replace(/^\/download\/?/, '');
  var info = null;
  try { info = JSON.parse(fs.readFileSync(path.join(CLIENT_DIR, 'client.json'), 'utf8')); } catch (e) { info = null; }
  if (name === 'client.json') {
    // 服务器上没有安装包时（平时安装包发在 QQ 群文件里），只报仓库里 desktop/package.json 的版本号，
    // 客户端据此提示「有新版，去群文件下载」，「关于」里也不显示下载按钮
    var latest = null;
    try { latest = JSON.parse(fs.readFileSync(path.join(ROOT, 'desktop', 'package.json'), 'utf8')).version; } catch (e) { latest = null; }
    if (!info || (latest && info.version !== latest)) info = latest ? { version: latest, file: null } : null;
    if (!info) return send(res, 404, 'application/json; charset=utf-8', '{"error":"没有客户端"}');
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(info));
  }
  if (name === '' || name === 'windows') {
    if (!info || !info.file) return send(res, 200, 'text/html; charset=utf-8', '<!doctype html><meta charset="utf-8"><title>Flame1Down - 1 客户端</title><body style="font:16px/1.7 sans-serif;max-width:560px;margin:15vh auto;padding:0 16px;color:#23222b;background:#fbfaf3"><h2>Windows 客户端</h2><p>客户端安装包发在<b>船员 QQ 群的群文件</b>里，请到群文件下载最新版，装好后覆盖旧版即可，进度不受影响。</p></body>');
    res.writeHead(302, { 'Location': '/download/' + encodeURIComponent(info.file), 'Cache-Control': 'no-cache' });
    return res.end();
  }
  try { name = decodeURIComponent(name); } catch (e) { return send(res, 400, 'text/plain; charset=utf-8', '地址有误'); }
  if (!/^[A-Za-z0-9._-]+\.exe$/.test(name)) return send(res, 404, 'text/plain; charset=utf-8', '找不到');
  streamFile(req, res, path.join(CLIENT_DIR, name), '/download/' + name, { 'Content-Disposition': 'attachment; filename="' + name + '"' });
}

var server = http.createServer(function (req, res) {
  if (accounts.handle(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', '不支持');
  if (req.url === '/ping') return send(res, 200, 'text/plain; charset=utf-8', 'ok');
  if (req.url === '/download' || req.url.indexOf('/download/') === 0) return serveDownload(req, res);
  if (req.url === '/status') {
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
      ok: true, since: STARTED.toISOString(), users: accounts.userCount(), players: social.onlineCount(), online: wss.clients.size, rooms: Object.keys(rooms).length, backups: backupInfo(), node: process.version, tx: txs.status(), wallet: accounts.walletStatus(), pve: pve.active()
    }));
  }
  serveFile(req, res);
});

/* ---------------- 3. 联网对战传话 ----------------
 *
 * 浏览器和服务器之间互发 JSON 消息，每条都有 type：
 *
 * 浏览器 → 服务器
 *   { type: 'create', name }            创建房间，服务器回一个 4 位房间号
 *   { type: 'join', code, name }        用房间号加入
 *   { type: 'leave' }                   离开房间
 *   { type: 'relay', data }             把 data 原样转给房间里的另一个人（选队、出招都走这个）
 *
 * 服务器 → 浏览器
 *   { type: 'hello', id }                    连上了
 *   { type: 'created', code, seat: 0 }       房间建好了，你是 0 号位（房主）
 *   { type: 'joined', code, seat: 1, peer }  加入成功，你是 1 号位，peer 是房主名字
 *   { type: 'peer-join', peer }              有人进了你的房间
 *   { type: 'peer-leave' }                   对方离开或掉线了
 *   { type: 'relay', data }                  对方发来的内容
 *   { type: 'error', msg }                   出错（房间号不存在、房间满了等）
 *
 * 服务器不懂对战规则，只负责传话；两边的浏览器用同一个随机种子各自结算。
 */

var rooms = {};            // code -> { seats: [ws, ws], created }
var nextId = 1;
var MAX_MSG = 1024 * 1024;   // 单条消息上限 1MB（联网切磋每回合要传完整战况，最多一百多 KB）

function out(ws, obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 20) || '无名船员'; }
function newCode() {
  for (var i = 0; i < 1000; i++) {
    var c = String(1000 + Math.floor(Math.random() * 9000));
    if (!rooms[c]) return c;
  }
  return null;
}

function leaveRoom(ws) {
  var code = ws.room;
  if (!code || !rooms[code]) { ws.room = null; return; }
  var r = rooms[code];
  r.seats[ws.seat] = null;
  out(r.seats[1 - ws.seat], { type: 'peer-leave' });
  ws.room = null; ws.seat = null;
  if (!r.seats[0] && !r.seats[1]) delete rooms[code];
}

var wss = new WebSocket.Server({ server: server, path: '/ws', maxPayload: MAX_MSG });

wss.on('connection', function (ws) {
  ws.id = nextId++;
  ws.alive = true;
  ws.room = null; ws.seat = null; ws.name = '';
  ws.on('pong', function () { ws.alive = true; if (ws.user) accounts.touchOnline(ws.user); });
  out(ws, { type: 'hello', id: ws.id });
  social.onOpen(ws);

  ws.on('message', function (raw) {
    var msg;
    try { msg = JSON.parse(String(raw)); } catch (e) { return out(ws, { type: 'error', msg: '消息格式不对' }); }
    if (!msg || typeof msg.type !== 'string') return;
    if (social.onMessage(ws, msg)) return;   // 在线状态、切磋邀请、联网对战（见 social.js）

    if (msg.type === 'create') {
      leaveRoom(ws);
      var code = newCode();
      if (!code) return out(ws, { type: 'error', msg: '房间太多了，稍后再试' });
      ws.name = cleanName(msg.name);
      rooms[code] = { seats: [ws, null], created: Date.now() };
      ws.room = code; ws.seat = 0;
      return out(ws, { type: 'created', code: code, seat: 0 });
    }

    if (msg.type === 'join') {
      var c = String(msg.code || '').trim(), r = rooms[c];
      if (!r) return out(ws, { type: 'error', msg: '房间 ' + c + ' 不存在' });
      if (r.seats[0] === ws || r.seats[1] === ws) return;
      if (r.seats[0] && r.seats[1]) return out(ws, { type: 'error', msg: '房间已满' });
      leaveRoom(ws);
      var seat = r.seats[0] ? 1 : 0;
      ws.name = cleanName(msg.name);
      r.seats[seat] = ws; ws.room = c; ws.seat = seat;
      var other = r.seats[1 - seat];
      out(ws, { type: 'joined', code: c, seat: seat, peer: other ? other.name : null });
      if (other) out(other, { type: 'peer-join', peer: ws.name });
      return;
    }

    if (msg.type === 'leave') return leaveRoom(ws);

    if (msg.type === 'relay') {
      var rm = ws.room && rooms[ws.room];
      if (!rm) return out(ws, { type: 'error', msg: '你不在房间里' });
      return out(rm.seats[1 - ws.seat], { type: 'relay', data: msg.data });
    }
  });

  ws.on('close', function () { leaveRoom(ws); social.onClose(ws); });
  ws.on('error', function () {});
});

// 每 30 秒检查一次掉线的连接（比如合上笔记本、断网），清理掉
var beat = setInterval(function () {
  wss.clients.forEach(function (ws) {
    if (!ws.alive) return ws.terminate();
    ws.alive = false;
    try { ws.ping(); } catch (e) {}
  });
  // 只有一个人、超过 2 小时没人来的房间也清掉
  var now = Date.now();
  Object.keys(rooms).forEach(function (code) {
    var r = rooms[code];
    if (now - r.created > 2 * 3600 * 1000 && (!r.seats[0] || !r.seats[1])) {
      [0, 1].forEach(function (s) { if (r.seats[s]) { out(r.seats[s], { type: 'error', msg: '房间已过期' }); r.seats[s].room = null; } });
      delete rooms[code];
    }
  });
}, 30000);
wss.on('close', function () { clearInterval(beat); });

server.listen(PORT, function () {
  console.log('Flame1Down - 1 服务器已启动：端口 ' + PORT + '，网页目录 ' + ROOT + '，存档目录 ' + accounts.DATA_DIR);
});
server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') console.error('端口 ' + PORT + ' 已被别的程序占用（可能装了 nginx / 宝塔）。');
  else if (e.code === 'EACCES') console.error('没有权限使用端口 ' + PORT + '，需要用 root 运行。');
  else console.error(e);
  process.exit(1);
});
