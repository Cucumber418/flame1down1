/*
 * Flame1Down - 1 · Windows 客户端（主进程）
 *
 * 客户端本身不带游戏代码：打开后直接连服务器，加载服务器上的游戏网页。
 * 所以游戏更新后客户端不用重装，和用浏览器打开一模一样，只是多了这些：
 *   - 独立窗口，记住大小和位置；F11 全屏，Ctrl + / - / 0 缩放（缩放也会记住）
 *   - 背景音乐不用先点一下页面就能播放；最小化时不降速，联网对战的计时不会被拖慢
 *   - 自带手写字体 Long Cang，不用连 Google（国内经常连不上）
 *   - 关窗口前先把还没上传的进度传完
 *   - 服务器连不上时显示断线页，自动重试，也可以改服务器地址
 *   - 启动后检查服务器上有没有新版客户端
 *
 * 按 Alt 显示菜单。服务器地址存在 %APPDATA%\Flame1Down - 1\settings.json；
 * 打包时如果设置了 F1D_SERVER，会写进 default-server.json 作为默认地址（见 scripts/prepare.js）。
 */
'use strict';

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, net, protocol, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const VERSION = app.getVersion();
const ICON = path.join(__dirname, 'build', 'icon.png');
const FONT_DIR = path.join(__dirname, 'fonts');
const ZOOMS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

// 游戏里用这个判断是不是在客户端里（「关于」里会显示客户端版本，不再显示下载链接）
app.userAgentFallback = app.userAgentFallback + ' Flame1DownClient/' + VERSION;
// 背景音乐不需要先点一下页面才能播放
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('com.flame1down.client');

/* ---------------- 设置 ---------------- */

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {}; } catch (e) { cfg = {}; }
function saveCfg() {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE + '.tmp', JSON.stringify(cfg, null, 2));
    fs.renameSync(SETTINGS_FILE + '.tmp', SETTINGS_FILE);
  } catch (e) { /* 存不了就算了，下次再问 */ }
}
function defaultServer() {
  try { return String(JSON.parse(fs.readFileSync(path.join(__dirname, 'default-server.json'), 'utf8')).server || '').trim(); }
  catch (e) { return ''; }
}

/* ---------------- 服务器地址 ---------------- */

// 玩家可能填「1.2.3.4」「1.2.3.4:8080」「http://1.2.3.4:8080/」或域名。
// 没写端口时依次试 8080 和 80（服务器两种装法都有），能打开 /ping 的就是它。
function candidates(input) {
  const s = String(input || '').trim().replace(/\s+/g, '');
  if (!s) return [];
  const m = /^(https?):\/\/([^/?#]+)/i.exec(s);
  if (m) return [m[1].toLowerCase() + '://' + m[2].toLowerCase()];
  const host = s.split(/[/?#]/)[0].toLowerCase();
  if (!host) return [];
  if (/:\d+$/.test(host)) return ['http://' + host];
  return ['http://' + host + ':8080', 'http://' + host, 'https://' + host];
}
async function ping(origin) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await net.fetch(origin + '/ping', { signal: ac.signal, cache: 'no-store' });
    return r.ok && (await r.text()).trim() === 'ok';
  } catch (e) { return false; }
  finally { clearTimeout(t); }
}
async function resolveServer(input) {
  for (const c of candidates(input)) if (await ping(c)) return c;
  return null;
}

/* ---------------- 自带手写字体 ----------------
 * 游戏页面从 fonts.googleapis.com 加载 Long Cang。这里把这两个请求截下来，换成客户端自带的字体文件；
 * 其他 https 请求原样放行。 */
let fontCss = null;
try { fontCss = fs.readFileSync(path.join(FONT_DIR, 'long-cang.css'), 'utf8'); } catch (e) { fontCss = null; }
function handleHttps(req) {
  try {
    const u = new URL(req.url);
    if (fontCss && u.hostname === 'fonts.googleapis.com' && /^Long Cang/.test(u.searchParams.get('family') || '')) {
      return new Response(fontCss, { headers: { 'content-type': 'text/css; charset=utf-8', 'access-control-allow-origin': '*' } });
    }
    if (u.hostname === 'fonts.gstatic.com' && u.pathname.indexOf('/f1d/') === 0) {
      const f = path.join(FONT_DIR, path.basename(u.pathname));
      if (/\.woff2$/.test(f) && fs.existsSync(f)) {
        return new Response(fs.readFileSync(f), { headers: { 'content-type': 'font/woff2', 'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000' } });
      }
      return new Response('', { status: 404 });
    }
  } catch (e) { /* 地址解析不了就照常放行 */ }
  return net.fetch(req, { bypassCustomProtocolHandlers: true });
}

/* ---------------- 窗口 ---------------- */

let win = null;
let origin = null;        // 正在玩的服务器，例如 http://1.2.3.4:8080
let page = 'none';        // 'game' | 'ui'
let closing = false;
let updateChecked = false;

function onScreen(b) {
  if (!b || !(b.width > 300) || !(b.height > 200)) return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y >= a.y - 20 && b.y < a.y + a.height - 80;
  });
}

function createWindow() {
  const b = onScreen(cfg.bounds) ? cfg.bounds : { width: 1280, height: 860 };
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    minWidth: 900, minHeight: 600,
    show: false,
    title: 'Flame1Down - 1',
    backgroundColor: '#e6e0d0',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });
  if (cfg.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  const wc = win.webContents;

  // 新窗口：同一服务器的就在当前窗口打开，外部链接交给系统浏览器
  wc.setWindowOpenHandler(({ url }) => {
    if (sameServer(url)) wc.loadURL(url);
    else if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (sameServer(url) || url.indexOf('file:') === 0) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3 || page !== 'game') return;   // -3：被新的跳转打断，不算失败
    showUI('offline', desc);
  });
  wc.on('did-finish-load', () => {
    if (page !== 'game') return;
    wc.setZoomFactor(cfg.zoom || 1);
    if (!updateChecked) { updateChecked = true; setTimeout(checkClientUpdate, 4000); }
  });
  wc.on('zoom-changed', (e, dir) => setZoom(dir === 'in' ? 1 : -1));
  wc.on('render-process-gone', (e, d) => {
    if (closing || d.reason === 'clean-exit') return;
    dialog.showMessageBox(win, { type: 'warning', title: 'Flame1Down - 1', message: '游戏页面意外退出了', detail: '点「重新加载」回到游戏。服务器上的进度不受影响。', buttons: ['重新加载'] })
      .then(() => { if (win && !win.isDestroyed()) home(); });
  });
  wc.on('page-title-updated', (e) => { e.preventDefault(); });

  // 关窗口：先把还没传到服务器的进度传完（最多等 6 秒）
  win.on('close', (e) => {
    rememberBounds();
    if (closing || page !== 'game') return;
    e.preventDefault();
    closing = true;
    const flush = "(window.CLOUD && CLOUD.flush ? CLOUD.flush() : Promise.resolve(true))";
    Promise.race([wc.executeJavaScript(flush, true), new Promise((r) => setTimeout(r, 6000))])
      .catch(() => {})
      .then(() => { if (win && !win.isDestroyed()) win.close(); });
  });
  win.on('closed', () => { win = null; });
}

function sameServer(url) {
  if (!origin) return false;
  try { return new URL(url).origin === new URL(origin).origin; } catch (e) { return false; }
}
function rememberBounds() {
  if (!win || win.isDestroyed()) return;
  cfg.maximized = win.isMaximized();
  if (!win.isFullScreen() && !win.isMinimized()) cfg.bounds = win.getNormalBounds();
  saveCfg();
}

function showUI(mode, detail) {
  page = 'ui';
  win.setTitle('Flame1Down - 1');
  win.loadFile(path.join(__dirname, 'ui.html'), { query: { mode: mode, detail: detail || '' } });
}
function openGame(o) {
  origin = o;
  page = 'game';
  win.setTitle('Flame1Down - 1');
  win.loadURL(o + '/');
}
function home() { if (origin) openGame(origin); else start(); }

async function start() {
  if (cfg.server) return openGame(cfg.server);
  const d = defaultServer();
  if (!d) return showUI('setup');
  showUI('connecting');
  const o = await resolveServer(d);
  if (o) { cfg.server = o; saveCfg(); openGame(o); }
  else showUI('offline');
}

/* ---------------- 设置页 / 断线页 ---------------- */

function fromUI(e) { return !!(e.senderFrame && e.senderFrame.url.indexOf('file:') === 0); }
ipcMain.handle('f1d:info', (e) => {
  if (!fromUI(e)) return null;
  return { version: VERSION, server: cfg.server || '', fallback: defaultServer(), electron: process.versions.electron };
});
ipcMain.handle('f1d:connect', async (e, input) => {
  if (!fromUI(e)) return { ok: false };
  if (!candidates(input).length) return { ok: false, error: '请填写服务器地址。' };
  const o = await resolveServer(input);
  if (!o) return { ok: false, error: '连不上这个地址。请检查地址和端口是否正确、服务器是否在运行，或者网络是否正常。' };
  cfg.server = o; saveCfg();
  setTimeout(() => openGame(o), 50);
  return { ok: true, origin: o };
});
ipcMain.handle('f1d:retry', async (e) => {
  if (!fromUI(e)) return { ok: false };
  const target = cfg.server || defaultServer();
  if (!target) return { ok: false };
  const o = cfg.server ? ((await ping(cfg.server)) ? cfg.server : null) : await resolveServer(target);
  if (!o) return { ok: false };
  cfg.server = o; saveCfg();
  setTimeout(() => openGame(o), 50);
  return { ok: true };
});
ipcMain.handle('f1d:back', (e) => {
  if (!fromUI(e)) return false;
  if (!cfg.server) return false;
  openGame(cfg.server);
  return true;
});

/* ---------------- 缩放 ---------------- */

function setZoom(step) {
  if (!win) return;
  const cur = cfg.zoom || 1;
  let i = ZOOMS.findIndex((z) => Math.abs(z - cur) < 0.01);
  if (i < 0) i = ZOOMS.indexOf(1);
  const next = step === 0 ? 1 : ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + step))];
  cfg.zoom = next; saveCfg();
  win.webContents.setZoomFactor(next);
}

/* ---------------- 客户端更新 ---------------- */

function newer(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}
async function checkClientUpdate(manual) {
  if (!origin) return;
  let info = null;
  try {
    const r = await net.fetch(origin + '/download/client.json', { cache: 'no-store' });
    if (r.ok) info = await r.json();
  } catch (e) { info = null; }
  if (!win || win.isDestroyed()) return;
  if (!info || !info.version || !newer(info.version, VERSION)) {
    if (manual) dialog.showMessageBox(win, { type: 'info', title: '检查更新', message: info ? '已经是最新版客户端（v' + VERSION + '）' : '暂时查不到客户端的版本信息', buttons: ['好的'] });
    return;
  }
  if (!manual && cfg.skipVersion === info.version) return;
  const hosted = !!info.file;   // 服务器上有安装包就直接下载，没有就去 QQ 群文件里找
  const r = await dialog.showMessageBox(win, {
    type: 'info', title: '客户端更新',
    message: '有新版客户端 v' + info.version + '（当前 v' + VERSION + '）',
    detail: '游戏内容每次都从服务器加载，不更新客户端也能照常玩。新版客户端改进的是窗口、字体这类外壳功能。\n' +
      (hosted ? '点「下载」会用浏览器下载安装包，' : '新版安装包在船员 QQ 群的群文件里，') + '装好后覆盖旧版即可，进度不受影响。',
    buttons: hosted ? ['下载', '以后再说', '跳过这个版本'] : ['知道了', '跳过这个版本'], defaultId: 0, cancelId: hosted ? 1 : 0
  });
  if (hosted && r.response === 0) shell.openExternal(origin + '/download/windows');
  else if (r.response === (hosted ? 2 : 1)) { cfg.skipVersion = info.version; saveCfg(); }
}

/* ---------------- 菜单（按 Alt 显示） ---------------- */

function about() {
  dialog.showMessageBox(win, {
    type: 'info', title: '关于客户端', icon: ICON,
    message: 'Flame1Down - 1 · Windows 客户端 v' + VERSION,
    detail: '服务器：' + (origin || cfg.server || '未设置') + '\n' +
      'Electron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome + '\n\n' +
      '按 Alt 显示菜单。F5 刷新，F11 全屏，Ctrl + / Ctrl - 缩放，Ctrl 0 恢复原大小。',
    buttons: ['好的']
  });
}
function buildMenu() {
  const tpl = [
    { label: '游戏(&G)', submenu: [
      { label: '回到首页', accelerator: 'Alt+Home', click: () => home() },
      { label: '刷新', accelerator: 'F5', click: () => { if (page === 'game') win.webContents.reload(); else start(); } },
      { label: '刷新（忽略缓存）', accelerator: 'CmdOrCtrl+F5', click: () => { if (page === 'game') win.webContents.reloadIgnoringCache(); } },
      { type: 'separator' },
      { label: '服务器地址…', click: () => showUI('setup') },
      { type: 'separator' },
      { label: '退出', accelerator: 'Alt+F4', click: () => win && win.close() }
    ] },
    { label: '视图(&V)', submenu: [
      { label: '全屏', accelerator: 'F11', click: () => win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' },
      { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => setZoom(1) },
      { label: '放大', accelerator: 'CmdOrCtrl+Plus', visible: false, acceleratorWorksWhenHidden: true, click: () => setZoom(1) },
      { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => setZoom(-1) },
      { label: '原始大小', accelerator: 'CmdOrCtrl+0', click: () => setZoom(0) },
      { type: 'separator' },
      { label: '开发者工具', accelerator: 'CmdOrCtrl+Shift+I', click: () => win.webContents.toggleDevTools() }
    ] },
    { label: '帮助(&H)', submenu: [
      { label: '检查客户端更新', click: () => checkClientUpdate(true) },
      { label: '用浏览器打开游戏', click: () => { if (origin) shell.openExternal(origin + '/'); } },
      { type: 'separator' },
      { label: '关于客户端', click: about }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------------- 启动 ---------------- */

if (!app.requestSingleInstanceLock()) {
  // 已经开着一个了：两个窗口共用同一份本机存档，同时玩会互相覆盖，所以只留一个
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
  });
  app.whenReady().then(() => {
    protocol.handle('https', handleHttps);
    const ALLOW = ['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'notifications'];
    const ses = require('electron').session.defaultSession;
    ses.setPermissionRequestHandler((wc, perm, cb) => cb(ALLOW.indexOf(perm) >= 0));
    ses.setPermissionCheckHandler((wc, perm) => ALLOW.indexOf(perm) >= 0);
    buildMenu();
    createWindow();
    start();
  });
  app.on('window-all-closed', () => app.quit());
}
