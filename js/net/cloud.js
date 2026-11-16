/* ==========================================================
 * 账号登录与云存档
 *
 * 用服务器打开（http://服务器IP...）时：先登录，再从服务器取回存档放进浏览器本地，然后才加载游戏。
 * 游戏照旧读写浏览器本地存档；这里盯着那几个存档键，一有改动就在 2 秒后自动上传。
 * 双击 index.html 本地打开时：不需要登录，和以前完全一样。
 *
 * 必须是 index.html 里第一个加载的脚本，游戏的其他脚本由 CLOUD.boot() 在登录后按顺序加载。
 * ========================================================== */
(function () {
  'use strict';
  // 要同步到服务器的本地存档键（游戏主存档、竞技段位、选将记录、沙盒设置、竞技对战里每只精灵的配招）
  var KEYS = ['hs-account-v1', 'hs-rank-v1', 'hs-draft-v1', 'hs-train-v1', 'hs-loadout-v1'];
  // 进账申报（2026-10-24）：game.js 的 earn() 记下的申报先放这里，随下一次存档上传一起发给服务器，服务器收下后删掉
  var CLAIMS = 'hs-claims-v1';
  var TOK = 'hs-cloud-token', OWNER = 'hs-cloud-owner', REV = 'hs-cloud-rev', DIRTY = 'hs-cloud-dirty', LEGACY = 'hs-legacy-backup', LAST = 'hs-cloud-lastuser';
  var LS = window.localStorage;
  // 登录凭证：勾了「自动登录」存在 localStorage（关掉浏览器也记得，60 天内免登录）；
  // 没勾就存在 sessionStorage（关掉浏览器就要重新登录，适合在别人的电脑上玩）
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function setToken(t, remember) { st.token = t; st.remember = remember; if (remember) { lsSet(TOK, t); ssDel(TOK); } else { ssSet(TOK, t); lsDel(TOK); } }
  function clearToken() { st.token = null; lsDel(TOK); ssDel(TOK); }

  /* ---------- 这台设备记住的账号（2026-11-03，参考赛尔号的登录：最多 3 个，登录时点头像选一个） ----------
   * hs-cloud-accts = [{ user 账号名, tok 登录凭证, name 做题家名字, av 头像, t 最近使用时间 }]，最近用过的排在前面。
   * 登录时勾了「记住密码」才会记进来。记住的是服务器发的登录凭证，不保存密码原文：选中账号后直接用凭证登录，
   * 凭证失效（60 天没用过、或者在别的设备上改了密码）时卡片变成「需要输入密码」，再输一次就好。
   * 记满 3 个后再记新账号，会挤掉最久没用的那个（顺便让它的凭证在服务器上作废）。 */
  var ACCTS = 'hs-cloud-accts', MAX_ACCTS = 3, USER_RE = /^[一-龥A-Za-z0-9_]{2,16}$/;
  function acctsGet() {
    try {
      var a = JSON.parse(lsGet(ACCTS) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return x && typeof x.user === 'string' && USER_RE.test(x.user); }).slice(0, MAX_ACCTS) : [];
    } catch (e) { return []; }
  }
  function acctsSet(a) { if (a.length) lsSet(ACCTS, JSON.stringify(a)); else lsDel(ACCTS); }
  function acctFind(user) { return acctsGet().filter(function (x) { return x.user === user; })[0] || null; }
  function acctEdit(e, patch) { Object.keys(patch).forEach(function (k) { if (patch[k] == null) delete e[k]; else e[k] = patch[k]; }); }
  // 记下（或更新）一个账号，并把它挪到最前面；超过 3 个时挤掉最后面（最久没用）的
  function acctPut(user, patch) {
    var a = acctsGet(), i = -1;
    a.forEach(function (x, j) { if (x.user === user) i = j; });
    var e = i >= 0 ? a.splice(i, 1)[0] : { user: user };
    acctEdit(e, patch || {}); e.t = Date.now(); a.unshift(e);
    a.splice(MAX_ACCTS).forEach(function (x) { revoke(x.tok); });
    acctsSet(a);
  }
  // 只更新已经记住的账号（不挪位置，没记住的不新增）
  function acctPatch(user, patch) {
    var a = acctsGet(), hit = false;
    a.forEach(function (x) { if (x.user === user) { acctEdit(x, patch); hit = true; } });
    if (hit) acctsSet(a);
  }
  function acctDel(user) { acctsSet(acctsGet().filter(function (x) { return x.user !== user; })); }
  // 让一个不再用的登录凭证在服务器上作废（正在用的那个不动）
  function revoke(tok) {
    if (!tok || tok === st.token || !/^[0-9a-f]{64}$/.test(tok)) return;
    try { fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}', cache: 'no-store' }).catch(function () {}); } catch (e) {}
  }
  // 头像只认游戏自己生成的两种写法（js/ui/game.js 的 faceHTML），别的一律不显示
  function avOk(h) { return typeof h === 'string' && (/^<span class="av-face" style="[^"<>]*"><\/span>$/.test(h) || /^<img src="[^"<>]*" alt="">$/.test(h)) ? h : ''; }
  function avHTML(x) { var h = avOk(x.av); return '<span class="pav' + (h ? ' img' : '') + '">' + (h || esc(Array.from(x.name || x.user)[0] || '?')) + '</span>'; }
  // 游戏加载好以后：把做题家名字和头像记到账号卡片上，下次登录时显示
  function syncProfile() {
    if (!st.user || !window.HSACC || !HSACC.acc) return;
    try {
      var a = HSACC.acc(); if (!a) return;
      var av = avOk(HSACC.avatarInner(HSACC.avatarSpec(), a.name));
      var e = acctFind(st.user), name = String(a.name || '').slice(0, 20);
      if (e && (e.name !== name || (e.av || '') !== av)) acctPatch(st.user, { name: name || null, av: av || null });
    } catch (e) {}
  }
  // 账号功能上线前登录过的设备：把上次登录的账号名记成一张卡片
  function acctMigrate() {
    if (acctsGet().length || !USER_RE.test(lsGet(LAST) || '')) return;
    acctPut(lsGet(LAST), lsGet(TOK) && lsGet(OWNER) === lsGet(LAST) ? { tok: lsGet(TOK) } : {});
  }
  var $ = function (id) { return document.getElementById(id); };
  var st = { user: null, token: null, remember: true, rev: 0, applying: false, pushing: false, changeNo: 0, timer: null, retry: 0, scripts: [], status: '', ver: null, txing: false, txq: false, updShown: false };

  function lsGet(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { LS.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { LS.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- 和服务器通信 ---------- */
  function api(method, url, body, opts) {
    var h = { 'Content-Type': 'application/json' };
    if (st.token) h.Authorization = 'Bearer ' + st.token;
    // 2026-10-26：请求超过 25 秒没有回应就放弃（按网络不通处理，调用方会提示重试），免得对战一直卡在「等服务器」
    var ac = typeof AbortController !== 'undefined' && !(opts && opts.keepalive) ? new AbortController() : null, tm = ac ? setTimeout(function () { try { ac.abort(); } catch (e) {} }, 25000) : 0;
    return fetch(url, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, keepalive: !!(opts && opts.keepalive), cache: 'no-store', signal: ac ? ac.signal : undefined })
      .then(function (r) { clearTimeout(tm); return r; }, function (e) { clearTimeout(tm); throw e; })
      .then(function (r) {
        var ct = r.headers.get('Content-Type') || '';
        if (ct.indexOf('application/json') < 0) { var e = new Error('noapi'); e.noapi = true; throw e; }
        return r.json().then(function (j) { j._code = r.status; return j; });
      });
  }

  /* ---------- 本地存档 ⇄ 服务器存档 ---------- */
  function sameData(data) { var c = collect(); data = data || {}; return KEYS.every(function (k) { return (c[k] == null ? null : String(c[k])) === (data[k] == null ? null : String(data[k])); }); }
  function collect() { var d = {}; KEYS.forEach(function (k) { var v = lsGet(k); if (v != null) d[k] = v; }); return d; }
  function claimsGet() { try { var q = JSON.parse(lsGet(CLAIMS) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; } }
  function claimsDrop(sent) {   // 服务器收下了这些申报：从队列里删掉（按编号删，期间新加的留着）
    if (!sent || !sent.length) return;
    var ids = {}; sent.forEach(function (c) { ids[c.c] = 1; });
    var q = claimsGet().filter(function (c) { return !ids[c.c]; });
    if (q.length) lsSet(CLAIMS, JSON.stringify(q)); else lsDel(CLAIMS);
  }
  function claim(list) { if (!st.user || !list || !list.length) return; lsSet(CLAIMS, JSON.stringify(claimsGet().concat(list))); }
  function apply(data) {
    lsDel(CLAIMS);   // 本机存档被服务器上的（或空的）替换掉了，还没上传的申报跟着作废
    st.applying = true;
    KEYS.forEach(function (k) { if (data && data[k] != null) lsSet(k, data[k]); else lsDel(k); });
    st.applying = false;
  }
  // 这台设备上有没有「还没绑定账号」的旧存档（账号系统上线前玩的）
  function legacySave() {
    if (lsGet(OWNER)) return null;
    try { var a = JSON.parse(lsGet('hs-account-v1') || 'null'); if (a && typeof a.name === 'string' && Array.isArray(a.mons)) return a; } catch (e) {}
    return null;
  }
  function backupLegacy() { var d = collect(); if (Object.keys(d).length) lsSet(LEGACY, JSON.stringify({ at: Date.now(), data: d })); }

  // 登录成功后：决定用服务器上的存档还是本机的
  function adopt(user, save, then) {
    var owner = lsGet(OWNER), dirty = lsGet(DIRTY) === '1', localRev = +lsGet(REV) || 0;
    st.user = user;
    function done() { lsSet(OWNER, user); lsSet(REV, String(st.rev)); then(); }
    if (owner === user && dirty) {
      // 本机有这个账号还没上传的进度
      // 关页面时用 keepalive 传上去的那一份，服务器收到了但本机没来得及记下新版本号：内容一样就不算冲突
      if (!save || save.rev === localRev || sameData(save.data)) { st.rev = save ? save.rev : 0; done(); schedule(0); return; }
      // 2026-10-22：存档一律以服务器为准，本机和服务器对不上时直接用服务器的
    }
    if (!owner && legacySave()) backupLegacy();   // 本机没绑定账号的旧存档不再上传，只另存一份备用
    apply(save ? save.data : null);
    st.rev = save ? save.rev : 0;
    lsDel(DIRTY);
    done();
  }

  /* ---------- 自动上传 ---------- */
  function markDirty() { st.changeNo++; lsSet(DIRTY, '1'); setStatus('wait'); schedule(2000); }
  function schedule(ms) { clearTimeout(st.timer); st.timer = setTimeout(push, ms); }
  function push(force) {
    if (!st.user || st.pushing || st.reloading) return;   // 已经换成服务器的进度、等着重新加载：不再上传本机内存里的旧数据
    if (st.txing) { schedule(300); return; }   // 正在结算交易：等它结束再传，免得版本号对不上
    if (lsGet(DIRTY) !== '1' && !force) return;
    st.pushing = true; setStatus('saving');
    var no = st.changeNo, sent = claimsGet();
    api('PUT', '/api/save', { data: collect(), rev: st.rev, force: force === true, claims: sent, v: st.ver })
      .then(function (r) {
        st.pushing = false;
        if (r._code === 200) {
          st.rev = r.rev; lsSet(REV, String(r.rev)); st.retry = 0; claimsDrop(sent);
          if (r.fixed && r.save) { takeCloud(r.save, '有些数值和服务器的记录对不上（' + (r.fixed || '') + '），已按服务器的记录修正。'); return; }
          if (r.fix && st.changeNo === no && window.HSACC && HSACC.patch) { st.applying = true; try { HSACC.patch(r.fix); } finally { st.applying = false; } }   // 服务器悄悄改回了它管的数值（精灵、塔进度、每日记录等）：只换这几项，不弹窗
          if (st.changeNo === no) { lsDel(DIRTY); setStatus('ok'); syncProfile(); } else schedule(1000);
        } else if (r._code === 409) { setStatus('conflict'); takeCloud(r.save, r.cheat ? r.error : '这个账号在别的设备上保存过新的进度，已切换成服务器上的进度。'); }
        else if (r._code === 401) { setStatus('expired'); }
        else { setStatus('err', r.error); retryLater(); }
      })
      .catch(function () { st.pushing = false; setStatus('offline'); retryLater(); });
  }
  function retryLater() { st.retry = Math.min(st.retry + 1, 6); schedule([5, 10, 20, 30, 60, 120][st.retry - 1] * 1000); }
  // 关页面、切到后台时，有没传完的就立刻传
  function flushNow() {
    if (!st.user || st.reloading || lsGet(DIRTY) !== '1') return;
    var body = { data: collect(), rev: st.rev, claims: claimsGet(), v: st.ver };   // 申报留在队列里，下次上传再带一遍，服务器按编号去重
    if (JSON.stringify(body).length < 60000) api('PUT', '/api/save', body, { keepalive: true }).catch(function () {});
    else push();
  }

  // 盯住游戏对本地存档的读写：游戏代码不用改，调用 localStorage.setItem 时这里会知道
  function watchStorage() {
    var P = Storage.prototype, set = P.setItem, del = P.removeItem;
    P.setItem = function (k, v) { if (this === LS && st.reloading && KEYS.indexOf(k) >= 0) return; var old = this === LS ? this.getItem(k) : null; set.call(this, k, v); if (this === LS && !st.applying && KEYS.indexOf(k) >= 0 && old !== String(v)) markDirty(); };
    P.removeItem = function (k) { var had = this === LS && this.getItem(k) != null; del.call(this, k); if (had && !st.applying && KEYS.indexOf(k) >= 0) markDirty(); };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushNow(); });
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('online', function () { schedule(0); });
  }

  /* ---------- 设置中的账号管理；日常同步静默进行 ---------- */
  var STATUS = {
    ok: ['已同步', 'ok'], wait: ['有改动，即将保存', ''], saving: ['保存中…', ''], offline: ['网络断开，恢复后自动保存', 'bad'],
    err: ['保存失败，稍后重试', 'bad'], conflict: ['存档冲突', 'bad'], expired: ['登录已失效', 'bad']
  };
  function setStatus(s, msg) {
    st.status = s; var el = $('cloud-st'); if (!el) return;
    var t = STATUS[s] || ['', '']; el.textContent = msg && s === 'err' ? '保存失败：' + msg : t[0]; el.className = 'cl-st ' + t[1];
    el.hidden = t[1] !== 'bad';
    var rl = $('cloud-relogin'); if (rl) rl.hidden = s !== 'expired';
  }
  function openAccount() {
    if (!st.user || $('cloud-account')) return;
    var trigger = document.activeElement;
    dialog('<h2 id="cloud-account-title">账号管理</h2>' +
      '<p>登录账号：<b>' + esc(st.user) + '</b><br>进度会自动保存到服务器，换设备登录同一个账号就能接着玩。</p>' +
      '<p class="cl-st" id="cloud-st" hidden></p>' +
      '<button type="button" class="btn" id="cloud-relogin" hidden>重新登录</button>' +
      '<form id="cloud-pw" class="cl-pw"><b>修改密码</b><input type="password" id="cl-old" placeholder="原密码" autocomplete="current-password"><input type="password" id="cl-new" placeholder="新密码（至少 6 位）" autocomplete="new-password"><button class="btn" type="submit">确认修改</button><p id="cl-pw-msg"></p></form>' +
      '<button type="button" class="btn" id="cloud-switch">切换账号</button>' +
      '<button type="button" class="btn danger" id="cloud-out">退出登录</button><p class="cl-menu-tip">切换账号：回到登录界面，这个账号记住的密码保留。<br>退出登录：这台设备不再记住这个账号的密码。</p>' +
      '<div class="ob-foot"><button type="button" class="btn primary" data-account-close="1">关闭</button></div>', function (d, close) {
      d.id = 'cloud-account'; d.querySelector('[role="dialog"]').setAttribute('aria-labelledby', 'cloud-account-title');
      function done() { close(); if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true }); }
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-account-close]')) done(); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); done(); } });
      $('cloud-out').addEventListener('click', function () { leave(true); });
      $('cloud-switch').addEventListener('click', function () { leave(false); });
      $('cloud-relogin').addEventListener('click', function () { relogin(); });
      $('cloud-pw').addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('cl-pw-msg'), oldInput = $('cl-old'), newInput = $('cl-new'), np = newInput.value;
        if (np.length < 6) { msg.textContent = '新密码至少 6 位'; return; }
        msg.textContent = '提交中…';
        api('POST', '/api/password', { old: oldInput.value, pass: np }).then(function (r) {
          if (r._code === 200) { msg.textContent = '已修改。其他设备需要用新密码重新登录。'; oldInput.value = ''; newInput.value = ''; }
          else msg.textContent = r.error || '修改失败';
        }).catch(function () { msg.textContent = '连不上服务器'; });
      });
      setStatus(st.status || (lsGet(DIRTY) === '1' ? 'wait' : 'ok'));
      d.querySelector('[data-account-close]').focus({ preventScroll: true });
    });
  }

  // 退出登录（forget = true：这台设备忘掉这个账号的密码）/ 切换账号（forget = false：记住的密码留着，回到登录界面选别的账号）
  function leave(forget) {
    function bye() {
      var e = acctFind(st.user), keep = !forget && e && e.tok && e.tok === st.token;
      (keep ? Promise.resolve() : api('POST', '/api/logout', {}).catch(function () {})).then(function () {
        if (forget) acctPatch(st.user, { tok: null });
        clearToken(); lsDel(OWNER); lsDel(REV); lsDel(DIRTY); apply(null); location.reload();
      });
    }
    if (lsGet(DIRTY) !== '1') return bye();
    // 还有没上传的进度：先试着传一次
    setStatus('saving');
    api('PUT', '/api/save', { data: collect(), rev: st.rev, claims: claimsGet(), v: st.ver }).then(function (r) {
      if (r._code === 200) { lsDel(DIRTY); bye(); }
      else if (confirm('还有进度没能保存到服务器（' + (r.error || '未知原因') + '）。现在退出会丢掉这部分进度，确定退出吗？')) bye();
    }).catch(function () {
      if (confirm('连不上服务器，最近的进度还没保存。现在退出会丢掉这部分进度，确定退出吗？')) bye();
    });
  }

  /* ---------- 弹窗 ---------- */
  function dialog(html, wire) {
    var d = document.createElement('div'); d.className = 'cloud-dlg';
    d.innerHTML = '<div class="onboard cl-card" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span>' + html + '</div>';
    document.body.appendChild(d);
    wire(d, function () { d.remove(); });
  }
  function fmtTime(t) { try { return new Date(t).toLocaleString('zh-CN'); } catch (e) { return ''; } }
  // 存档以服务器为准：拿服务器上的进度覆盖本机，然后重新加载
  function takeCloud(save, msg) {
    if (st.reloading) return;
    apply(save ? save.data : null);
    st.reloading = true;   // 从现在到页面重新加载：游戏内存里还是旧数据，不许它再写回本机存档、也不再上传 st.rev = save ? save.rev : 0; lsSet(REV, String(st.rev)); lsDel(DIRTY);
    dialog('<span class="step">存档</span><h2>已使用服务器上的进度</h2><p>' + esc(msg || '') + '</p><div class="ob-foot"><button class="btn primary" id="cf-ok">好的</button></div>',
      function (d, close) { d.querySelector('#cf-ok').addEventListener('click', function () { close(); location.reload(); }); });
  }
  function askConflict(save, after) {
    dialog('<span class="step">存档冲突</span><h2>两边的进度不一样</h2>' +
      '<p>这个账号在另一台设备上保存过新的进度（' + esc(fmtTime(save && save.savedAt)) + '），和这台设备上还没上传的进度对不上。要保留哪一份？</p>' +
      '<div class="ob-foot"><button class="btn" id="cf-local">用这台设备的进度</button><button class="btn primary" id="cf-cloud">用服务器上的进度</button></div>',
      function (d, close) {
        d.querySelector('#cf-cloud').addEventListener('click', function () { apply(save ? save.data : null); st.rev = save ? save.rev : 0; lsSet(REV, String(st.rev)); lsDel(DIRTY); close(); location.reload(); });
        d.querySelector('#cf-local').addEventListener('click', function () { close(); st.rev = save ? save.rev : 0; lsSet(REV, String(st.rev)); after(); push(true); });
      });
  }
  function askUpload(a, cb) {
    dialog('<span class="step">发现本机存档</span><h2>要带上旧存档吗？</h2>' +
      '<p>这台设备上有一份还没绑定账号的存档：做题家「' + esc(a.name) + '」，' + a.mons.length + ' 只精灵。可以把它保存到这个账号里，以后换设备也能接着玩。</p>' +
      '<div class="ob-foot"><button class="btn" id="up-no">不要，从头开始</button><button class="btn primary" id="up-yes">带上这份存档</button></div>',
      function (d, close) {
        d.querySelector('#up-yes').addEventListener('click', function () { close(); cb(true); });
        d.querySelector('#up-no').addEventListener('click', function () { close(); cb(false); });
      });
  }

  // 让浏览器的「记住密码」弹出保存提示（Chrome、Edge 支持这个接口；Safari 会自己识别登录框）
  function rememberPassword(user, pass, remember) {
    if (!remember || !window.PasswordCredential || !navigator.credentials) return;
    try { navigator.credentials.store(new PasswordCredential({ id: user, password: pass, name: user })).catch(function () {}); } catch (e) {}
  }

  /* ---------- 登录 / 注册界面 ---------- */
  function showLogin(note, onDone) {
    document.body.classList.add('cloud-auth');
    var host = $('cloud-auth');
    if (!host) { host = document.createElement('div'); host.id = 'cloud-auth'; var top = document.querySelector('.topbar'); top.parentNode.insertBefore(host, top.nextSibling); }
    acctMigrate();
    var mode = 'login', legacy = legacySave(), list0 = acctsGet();
    var sel = list0.length ? list0[0].user : '';   // 选中的记住的账号（'' = 其他账号，自己输入）
    var pwMode = false;                              // 选中了记住密码的账号，但想改用密码登录
    function draw() {
      var reg = mode === 'register', list = reg ? [] : acctsGet();
      if (sel && !acctFind(sel)) sel = '';
      var e = !reg && sel ? acctFind(sel) : null, quick = !!(e && e.tok && !pwMode);
      var cards = list.length ? '<div class="cl-accts" role="listbox" aria-label="这台设备记住的账号">' + list.map(function (x) {
        var on = x.user === sel;
        return '<div class="cl-acct' + (on ? ' on' : '') + '"><button type="button" class="cl-acct-b" data-u="' + esc(x.user) + '" role="option" aria-selected="' + on + '">' + avHTML(x) +
          '<b>' + esc(x.name || x.user) + '</b><small>@' + esc(x.user) + '</small><small class="cl-acct-s' + (x.tok ? ' ok' : '') + '">' + (x.tok ? '已记住密码' : '需要输入密码') + '</small></button>' +
          '<button type="button" class="cl-acct-x" data-x="' + esc(x.user) + '" title="从这台设备移除" aria-label="从这台设备移除账号 ' + esc(x.user) + '">×</button></div>';
      }).join('') +
        '<div class="cl-acct other' + (sel ? '' : ' on') + '"><button type="button" class="cl-acct-b" data-u="" role="option" aria-selected="' + !sel + '"><span class="pav">＋</span><b>其他账号</b><small>输入账号名和密码</small></button></div></div>' : '';
      var full = !reg && !sel && list.length >= MAX_ACCTS ? list[list.length - 1] : null;
      var userVal = reg ? '' : (sel || (list.length ? '' : (lsGet(LAST) || '')));
      host.innerHTML = '<div class="onboard cl-card"><span class="tape l"></span><span class="tape r"></span>' +
        '<span class="step">船员登记</span><h2>' + (reg ? '注册新账号' : '登录荆楚号') + '</h2>' +
        '<div class="cl-tabs" role="tablist"><button type="button" role="tab" class="sub' + (reg ? '' : ' on') + '" data-m="login" aria-selected="' + !reg + '">登录</button><button type="button" role="tab" class="sub' + (reg ? ' on' : '') + '" data-m="register" aria-selected="' + reg + '">注册</button></div>' +
        (note ? '<p class="cl-note">' + esc(note) + '</p>' : '') +
        cards +
        '<form id="cl-form" class="cl-form" novalidate>' +
        '<label>账号名<input id="cl-user" name="username" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="16" placeholder="2–16 个字：汉字、字母、数字、下划线" value="' + esc(userVal) + '"' + (sel && !reg ? ' readonly' : '') + '></label>' +
        (quick ? '<div class="cl-saved"><span>🔑 已记住这个账号的密码，直接点「登录」就行。</span><button type="button" class="cl-link" id="cl-usepw">改用密码登录</button></div>'
          : '<label>密码<input id="cl-pass" name="password" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" placeholder="' + (reg ? '至少 6 位' : '') + '"></label>') +
        (reg ? '<label>再输一次密码<input id="cl-pass2" type="password" autocomplete="new-password"></label>' : '') +
        (reg && legacy ? '<label class="cl-chk"><input type="checkbox" id="cl-legacy" checked> 把这台设备上已有的存档（做题家「' + esc(legacy.name) + '」，' + legacy.mons.length + ' 只精灵）带到新账号</label>' : '') +
        '<div class="cl-chks"><label class="cl-chk"><input type="checkbox" id="cl-rem" checked> 记住密码</label><label class="cl-chk"><input type="checkbox" id="cl-auto"> 自动登录</label></div>' +
        '<p class="hint cl-chk-tip">记住密码：账号会出现在上面，下次点一下就能登录（这台设备最多记住 ' + MAX_ACCTS + ' 个）。自动登录：下次打开直接进游戏。在别人的电脑上请都不要勾。</p>' +
        (full ? '<p class="hint cl-full">已经记住了 ' + MAX_ACCTS + ' 个账号，再记住新账号会替换掉最久没用的「' + esc(full.name || full.user) + '」。</p>' : '') +
        '<p class="cl-err" id="cl-err" role="alert"></p>' +
        '<div class="ob-foot"><p class="hint">' + (reg ? '账号名用来登录，和游戏里的做题家名字是分开的。' : '换设备时用同一个账号登录，进度就会跟过来。') + '</p><button class="btn primary" type="submit" id="cl-go">' + (reg ? '注册并开始' : '登录') + '</button></div>' +
        '</form>' +
        '<p class="hint cl-warn">这个网站目前用的是 http 连接，请不要用和微信、银行等其他地方相同的密码。忘记密码可以找管理员重设。</p></div>';
      host.querySelectorAll('.cl-tabs .sub').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-m'); note = ''; pwMode = false; draw(); }); });
      host.querySelectorAll('.cl-acct-b').forEach(function (b) { b.addEventListener('click', function () { sel = b.getAttribute('data-u'); pwMode = false; note = ''; draw(); }); });
      host.querySelectorAll('.cl-acct-x').forEach(function (b) {
        b.addEventListener('click', function () {
          var u = b.getAttribute('data-x'), x = acctFind(u); if (!x) return;
          if (!confirm('从这台设备移除账号「' + (x.name || u) + '」（@' + u + '）？\n账号和进度不会受影响，以后输入密码还能登录。')) return;
          revoke(x.tok); acctDel(u); if (sel === u) { var r = acctsGet(); sel = r.length ? r[0].user : ''; } pwMode = false; draw();
        });
      });
      var rem = $('cl-rem'), auto = $('cl-auto');
      function syncChk() { auto.disabled = !rem.checked; if (!rem.checked) auto.checked = false; }
      rem.addEventListener('change', syncChk); syncChk();
      if (quick) $('cl-usepw').addEventListener('click', function () { pwMode = true; draw(); });
      $('cl-form').addEventListener('submit', submit);
      if (quick) $('cl-go').focus(); else ($('cl-user').value ? $('cl-pass') : $('cl-user')).focus();
    }
    function busy(on) { var go = $('cl-go'); if (!go) return; go.disabled = on; go.textContent = on ? '请稍候…' : (mode === 'register' ? '注册并开始' : '登录'); }
    function finish(user, save) {
      var proceed = function () { host.remove(); document.body.classList.remove('cloud-auth'); onDone(); };
      adopt(user, save, proceed);
    }
    // 选了记住密码的账号：直接用记住的登录凭证
    function quickLogin(e, auto) {
      var err = $('cl-err'), tok = e.tok;
      err.textContent = ''; busy(true); st.token = tok;
      api('GET', '/api/me').then(function (r) {
        if (r._code === 200) { setToken(tok, auto); lsSet(LAST, r.user); acctPut(r.user, { tok: tok }); finish(r.user, r.save); return; }
        st.token = null; busy(false);
        if (r._code === 401) {
          acctPatch(e.user, { tok: null }); pwMode = false;
          note = '「' + (e.name || e.user) + '」记住的密码已经失效（太久没登录，或者在别的设备上改过密码），请输入密码登录。';
          draw(); return;
        }
        err.textContent = r.error || '出错了';
      }).catch(function () { st.token = null; busy(false); err.textContent = '连不上服务器，请检查网络后再试'; });
    }
    function submit(ev) {
      ev.preventDefault();
      var reg = mode === 'register', err = $('cl-err');
      var rem = $('cl-rem').checked, auto = rem && $('cl-auto').checked;
      var e = !reg && sel ? acctFind(sel) : null;
      if (e && e.tok && !pwMode) return quickLogin(e, auto);
      var user = $('cl-user').value.trim(), pass = $('cl-pass').value;
      if (!USER_RE.test(user)) { err.textContent = '账号名要 2–16 个字，只能用汉字、字母、数字和下划线'; return; }
      if (pass.length < 6) { err.textContent = '密码至少 6 位'; return; }
      if (reg && pass !== $('cl-pass2').value) { err.textContent = '两次输入的密码不一样'; return; }
      var body = { user: user, pass: pass };
      var bring = reg && $('cl-legacy') && $('cl-legacy').checked;
      if (bring) body.data = collect();
      err.textContent = ''; busy(true);
      api('POST', reg ? '/api/register' : '/api/login', body).then(function (r) {
        busy(false);
        if (r._code !== 200) { err.textContent = r.error || '出错了'; return; }
        setToken(r.token, auto);
        if (rem) { lsSet(LAST, r.user); var old = acctFind(r.user); if (old && old.tok !== r.token) revoke(old.tok); acctPut(r.user, { tok: r.token }); }
        else { lsDel(LAST); acctPatch(r.user, { tok: null }); }
        rememberPassword(user, pass, rem);
        // 注册时已经决定好旧存档带不带：不带就另存一份备用，之后不再问
        if (reg && !bring && legacySave()) backupLegacy();
        if (reg) { lsSet(OWNER, r.user); lsDel(DIRTY); }
        finish(r.user, r.save);
      }).catch(function () { busy(false); err.textContent = '连不上服务器，请检查网络后再试'; });
    }
    draw();
  }
  // 登录失效（比如在别的设备改了密码）：重新登录后继续上传，不刷新页面
  function relogin() {
    var keep = st.user;
    dialog('<span class="step">登录已失效</span><h2>重新登录</h2><p>请输入账号「' + esc(keep) + '」的密码，登录后会继续保存刚才的进度。</p>' +
      '<form id="rl-form" class="cl-form"><label>密码<input id="rl-pass" type="password" autocomplete="current-password"></label><p class="cl-err" id="rl-err"></p>' +
      '<div class="ob-foot"><button type="button" class="btn" id="rl-x">取消</button><button class="btn primary" type="submit">登录</button></div></form>',
      function (d, close) {
        d.querySelector('#rl-x').addEventListener('click', close);
        d.querySelector('#rl-form').addEventListener('submit', function (e) {
          e.preventDefault();
          api('POST', '/api/login', { user: keep, pass: d.querySelector('#rl-pass').value }).then(function (r) {
            if (r._code !== 200) { d.querySelector('#rl-err').textContent = r.error || '登录失败'; return; }
            var e0 = acctFind(keep); if (e0 && e0.tok) acctPatch(keep, { tok: r.token });   // 记住的旧凭证已经失效：换成新的
            setToken(r.token, st.remember); close();
            if (r.save && r.save.rev !== st.rev) takeCloud(r.save, '这个账号在别的设备上保存过新的进度，已切换成服务器上的进度。'); else { setStatus('wait'); push(); }
          }).catch(function () { d.querySelector('#rl-err').textContent = '连不上服务器'; });
        });
      });
  }

  /* ---------- 加载游戏脚本（按顺序） ---------- */
  function loadGame() {
    var list = st.scripts.slice(), total = list.length || 1;
    var L = window.LOADER ? LOADER.show('正在登船～', { delay: 250 }) : null;   // 加载面板（js/ui/loader.js）：按已经加载的脚本数走进度条
    (function next() {
      if (L) L.set((total - list.length) / total);
      if (!list.length) { if (L) L.done(); if (st.user) { setStatus(lsGet(DIRTY) === '1' ? 'wait' : 'ok'); setTimeout(syncProfile, 1500); } return; }
      var s = document.createElement('script'); s.src = list.shift();
      s.onload = next;
      s.onerror = function () { if (L) L.close(); alert('加载 ' + s.src + ' 失败，请刷新页面重试'); };
      document.body.appendChild(s);
    })();
  }

  /* ---------- 入口 ---------- */
  function boot(scripts) {
    st.scripts = scripts;
    if (location.protocol === 'file:') return loadGame();   // 本地双击打开：不登录
    st.token = lsGet(TOK) || ssGet(TOK); st.remember = !!lsGet(TOK);
    if (!st.token) {
      // 先确认这个服务器有账号功能（放在别的静态网站上时没有，就按本地模式玩）
      return api('GET', '/api/me').then(function () { showLogin('', start); })
        .catch(function (e) { if (e.noapi) loadGame(); else showLogin('连不上服务器，请检查网络后刷新页面。', start); });
    }
    api('GET', '/api/me').then(function (r) {
      if (r._code === 200) { if (st.remember) acctPut(r.user, { tok: st.token }); return adopt(r.user, r.save, start); }
      clearToken(); showLogin('登录已过期，请重新登录。', start);
    }).catch(function (e) {
      if (e.noapi) return loadGame();
      // 连不上服务器但之前登录过：先用本机缓存的进度玩，网络恢复后自动上传
      if (lsGet(OWNER)) { st.user = lsGet(OWNER); st.rev = +lsGet(REV) || 0; start(); setStatus('offline'); retryLater(); }
      else showLogin('连不上服务器，请检查网络后刷新页面。', start);
    });
  }
  function start() { watchStorage(); watchVersion(); loadGame(); }

  // 等本机还没上传的进度传完（最多等 5 秒）。发起切磋前用，保证服务器拿到的是最新的配队
  function flush() {
    return new Promise(function (done) {
      if (lsGet(DIRTY) !== '1') return done(true);
      clearTimeout(st.timer); push();
      var t0 = Date.now(), iv = setInterval(function () {
        if (lsGet(DIRTY) !== '1' || Date.now() - t0 > 5000) { clearInterval(iv); done(lsGet(DIRTY) !== '1'); }
        else if (!st.pushing) push();
      }, 200);
    });
  }
  // 等正在进行的上传结束（最多等 8 秒）
  function idle() {
    return new Promise(function (done) {
      if (!st.pushing) return done();
      var t0 = Date.now(), iv = setInterval(function () { if (!st.pushing || Date.now() - t0 > 8000) { clearInterval(iv); done(); } }, 100);
    });
  }
  /* ---------- 交易（2026-10-24）：商城、代币商店、抽奖等交给服务器结算，规则在 js/engine/tx.js ----------
   * 先把本机还没上传的进度传上去（服务器要按最新的余额结算），再发交易。
   * 返回 { ok, now, rolls } 或 { ok: false, err }；没有登录（本地双击打开）时返回 { local: true }，由本机自己结算。 */
  function tx(op, args) {
    if (!st.user) return Promise.resolve({ local: true });
    if (st.txq) return Promise.resolve({ ok: false, err: '上一笔还在处理，请稍等。' });
    st.txq = true;
    function end(r) { st.txing = false; st.txq = false; return r; }
    return flush().then(idle).then(function () {
      st.txing = true;
      return api('POST', '/api/tx', { op: op, args: args || {}, v: st.ver });
    }).then(function (r) {
      if (r._code === 200 && r.ok) { st.rev = r.rev; lsSet(REV, String(r.rev)); return end(r); }
      if (r._code === 409 && r.update) { end(null); showUpdate(true); return { ok: false, err: '' }; }
      if (r._code === 401) { setStatus('expired'); return end({ ok: false, err: '登录已失效，请先重新登录（设置 → 账号管理）。' }); }
      return end({ ok: false, err: r.error || '没能完成，请稍后再试。' });
    }, function () { return end({ ok: false, err: '连不上服务器，这次没有兑换，请稍后再试。' }); });
  }
  /* ---------- 单人对战（2026-10-24）：先驱之塔由服务器结算（server/pve.js） ----------
   * body = { op: 'start' | 'act' | 'repl' | 'quit', ... }。开打前先把本机进度传上去（服务器按最新的配队和道具开打）。
   * 每次请求期间不上传存档；打完时服务器已经把结果写进存档，这里更新版本号，浏览器再照 end 更新本机存档。
   * 返回服务器的回复；连不上时 { ok: false, net: true, err }（可以原样重试：同一个 seq 服务器只结算一次） */
  function pve(body) {
    if (!st.user) return Promise.resolve({ ok: false, err: '没有登录' });
    function end(r) { st.txing = false; return r; }
    var pre = flush().then(idle);   // 每次都先把本机进度传上去（比如刚用掉的补药），服务器结算时用的是最新的存档
    return pre.then(function () {
      st.txing = true;
      body.v = st.ver;
      return api('POST', '/api/pve', body);
    }).then(function (r) {
      if (r._code === 200 && r.ok) { var rv = (r.end && r.end.rev) || r.rev; if (rv) { st.rev = rv; lsSet(REV, String(rv)); } return end(r); }
      if (r._code === 409 && r.update) { end(null); showUpdate(true); return { ok: false, err: '游戏已经更新了，刷新页面后再来挑战吧。' }; }
      if (r._code === 401) { setStatus('expired'); return end({ ok: false, err: '登录已失效，请先重新登录（设置 → 账号管理）。' }); }
      return end({ ok: false, gone: r._code === 410, draft: !!r.draft, err: r.error || '服务器没有回应，请稍后再试。' });
    }, function () { return end({ ok: false, net: true, err: '网络不稳，没连上服务器。' }); });
  }
  // 本机和服务器对不上时：取回服务器上的存档，用它重新加载
  function resync(msg) {
    api('GET', '/api/me').then(function (r) { if (r._code === 200) takeCloud(r.save, msg); else location.reload(); }).catch(function () { location.reload(); });
  }
  /* ---------- 版本检查：服务器上的游戏更新后，提示开着旧页面的人刷新 ---------- */
  function checkVersion() {
    if (!st.user) return;
    api('GET', '/api/version').then(function (r) {
      if (!r || !r.v) return;
      if (!st.ver) st.ver = r.v; else if (r.v !== st.ver) showUpdate(false);
    }).catch(function () {});
  }
  function showUpdate(force) {
    if ((st.updShown && !force) || document.getElementById('cloud-upd')) return;
    st.updShown = true;
    dialog('<span class="step">游戏更新</span><h2 id="cloud-upd">游戏已经更新了</h2><p>服务器上有新版本。刷新页面就能用上新版本，刷新前会先保存你的进度。' + (force ? '刚才的操作没有完成，也没有扣费，刷新后再试一次吧。' : '') + '</p>' +
      '<div class="ob-foot"><button class="btn" id="upd-later">等会儿再说</button><button class="btn primary" id="upd-now">现在刷新</button></div>',
      function (d, close) {
        d.querySelector('#upd-later').addEventListener('click', close);
        d.querySelector('#upd-now').addEventListener('click', function () { this.disabled = true; this.textContent = '正在保存…'; flush().then(function () { location.reload(); }); });
      });
  }
  function watchVersion() {
    checkVersion();
    setInterval(checkVersion, 3 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkVersion(); });
  }
  window.CLOUD = { boot: boot, user: function () { return st.user; }, token: function () { return st.token; }, account: openAccount, api: api, flush: flush, tx: tx, pve: pve, resync: resync, claim: claim };
})();
