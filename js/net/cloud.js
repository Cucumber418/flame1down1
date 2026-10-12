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
  var TOK = 'hs-cloud-token', OWNER = 'hs-cloud-owner', REV = 'hs-cloud-rev', DIRTY = 'hs-cloud-dirty', LEGACY = 'hs-legacy-backup', LAST = 'hs-cloud-lastuser';
  var LS = window.localStorage;
  // 登录凭证：勾了「自动登录」存在 localStorage（关掉浏览器也记得，60 天内免登录）；
  // 没勾就存在 sessionStorage（关掉浏览器就要重新登录，适合在别人的电脑上玩）
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function setToken(t, remember) { st.token = t; st.remember = remember; if (remember) { lsSet(TOK, t); ssDel(TOK); } else { ssSet(TOK, t); lsDel(TOK); } }
  function clearToken() { st.token = null; lsDel(TOK); ssDel(TOK); }
  var $ = function (id) { return document.getElementById(id); };
  var st = { user: null, token: null, remember: true, rev: 0, applying: false, pushing: false, changeNo: 0, timer: null, retry: 0, scripts: [], status: '' };

  function lsGet(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { LS.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { LS.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- 和服务器通信 ---------- */
  function api(method, url, body, opts) {
    var h = { 'Content-Type': 'application/json' };
    if (st.token) h.Authorization = 'Bearer ' + st.token;
    return fetch(url, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, keepalive: !!(opts && opts.keepalive), cache: 'no-store' })
      .then(function (r) {
        var ct = r.headers.get('Content-Type') || '';
        if (ct.indexOf('application/json') < 0) { var e = new Error('noapi'); e.noapi = true; throw e; }
        return r.json().then(function (j) { j._code = r.status; return j; });
      });
  }

  /* ---------- 本地存档 ⇄ 服务器存档 ---------- */
  function sameData(data) { var c = collect(); data = data || {}; return KEYS.every(function (k) { return (c[k] == null ? null : String(c[k])) === (data[k] == null ? null : String(data[k])); }); }
  function collect() { var d = {}; KEYS.forEach(function (k) { var v = lsGet(k); if (v != null) d[k] = v; }); return d; }
  function apply(data) {
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
      return askConflict(save, function () { done(); });
    }
    if (!owner && legacySave()) {
      if (!save) {
        // 新账号、云端是空的：问要不要把本机旧存档带上来
        return askUpload(legacySave(), function (yes) {
          if (yes) { st.rev = 0; done(); markDirty(); }
          else { backupLegacy(); apply(null); st.rev = 0; done(); }
        });
      }
      backupLegacy();   // 云端已有进度：本机旧存档另存一份备用，不会丢
    }
    apply(save ? save.data : null);
    st.rev = save ? save.rev : 0;
    lsDel(DIRTY);
    done();
  }

  /* ---------- 自动上传 ---------- */
  function markDirty() { st.changeNo++; lsSet(DIRTY, '1'); setStatus('wait'); schedule(2000); }
  function schedule(ms) { clearTimeout(st.timer); st.timer = setTimeout(push, ms); }
  function push(force) {
    if (!st.user || st.pushing) return;
    if (lsGet(DIRTY) !== '1' && !force) return;
    st.pushing = true; setStatus('saving');
    var no = st.changeNo;
    api('PUT', '/api/save', { data: collect(), rev: st.rev, force: force === true })
      .then(function (r) {
        st.pushing = false;
        if (r._code === 200) {
          st.rev = r.rev; lsSet(REV, String(r.rev)); st.retry = 0;
          if (st.changeNo === no) { lsDel(DIRTY); setStatus('ok'); } else schedule(1000);
        } else if (r._code === 409) { setStatus('conflict'); askConflict(r.save, function () {}); }
        else if (r._code === 401) { setStatus('expired'); }
        else { setStatus('err', r.error); retryLater(); }
      })
      .catch(function () { st.pushing = false; setStatus('offline'); retryLater(); });
  }
  function retryLater() { st.retry = Math.min(st.retry + 1, 6); schedule([5, 10, 20, 30, 60, 120][st.retry - 1] * 1000); }
  // 关页面、切到后台时，有没传完的就立刻传
  function flushNow() {
    if (!st.user || lsGet(DIRTY) !== '1') return;
    var body = { data: collect(), rev: st.rev };
    if (JSON.stringify(body).length < 60000) api('PUT', '/api/save', body, { keepalive: true }).catch(function () {});
    else push();
  }

  // 盯住游戏对本地存档的读写：游戏代码不用改，调用 localStorage.setItem 时这里会知道
  function watchStorage() {
    var P = Storage.prototype, set = P.setItem, del = P.removeItem;
    P.setItem = function (k, v) { var old = this === LS ? this.getItem(k) : null; set.call(this, k, v); if (this === LS && !st.applying && KEYS.indexOf(k) >= 0 && old !== String(v)) markDirty(); };
    P.removeItem = function (k) { var had = this === LS && this.getItem(k) != null; del.call(this, k); if (had && !st.applying && KEYS.indexOf(k) >= 0) markDirty(); };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushNow(); });
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('online', function () { schedule(0); });
  }

  /* ---------- 顶部的账号条 ---------- */
  var STATUS = {
    ok: ['已同步', 'ok'], wait: ['有改动，即将保存', ''], saving: ['保存中…', ''], offline: ['网络断开，恢复后自动保存', 'bad'],
    err: ['保存失败，稍后重试', 'bad'], conflict: ['存档冲突', 'bad'], expired: ['登录已失效', 'bad']
  };
  function setStatus(s, msg) {
    st.status = s; var el = $('cloud-st'); if (!el) return;
    var t = STATUS[s] || ['', '']; el.textContent = msg && s === 'err' ? '保存失败：' + msg : t[0]; el.className = 'cl-st ' + t[1];
    var rl = $('cloud-relogin'); if (rl) rl.hidden = s !== 'expired';
  }
  function renderBar() {
    var mh = document.querySelector('.masthead'); if (!mh || $('cloud-bar')) return;
    var bar = document.createElement('div'); bar.className = 'cloud-bar'; bar.id = 'cloud-bar';
    bar.innerHTML = '<button type="button" class="cloud-pill" id="cloud-pill" aria-haspopup="true" aria-expanded="false"><span class="cl-ic" aria-hidden="true">☁</span><b>' + esc(st.user) + '</b><span class="cl-st" id="cloud-st"></span></button>' +
      '<div class="cloud-menu" id="cloud-menu" hidden>' +
      '<p>登录账号：<b>' + esc(st.user) + '</b><br>进度会自动保存到服务器，换设备登录同一个账号就能接着玩。</p>' +
      '<button type="button" class="btn" id="cloud-relogin" hidden>重新登录</button>' +
      '<form id="cloud-pw" class="cl-pw"><b>修改密码</b><input type="password" id="cl-old" placeholder="原密码" autocomplete="current-password"><input type="password" id="cl-new" placeholder="新密码（至少 6 位）" autocomplete="new-password"><button class="btn" type="submit">确认修改</button><p id="cl-pw-msg"></p></form>' +
      '<button type="button" class="btn danger" id="cloud-out">退出登录</button></div>';
    mh.appendChild(bar);
    var pill = $('cloud-pill'), menu = $('cloud-menu');
    pill.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; pill.setAttribute('aria-expanded', String(!menu.hidden)); });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { if (!menu.hidden) { menu.hidden = true; pill.setAttribute('aria-expanded', 'false'); } });
    $('cloud-out').addEventListener('click', logout);
    $('cloud-relogin').addEventListener('click', function () { relogin(); });
    $('cloud-pw').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = $('cl-pw-msg'), np = $('cl-new').value;
      if (np.length < 6) { msg.textContent = '新密码至少 6 位'; return; }
      msg.textContent = '提交中…';
      api('POST', '/api/password', { old: $('cl-old').value, pass: np }).then(function (r) {
        if (r._code === 200) { msg.textContent = '已修改。其他设备需要用新密码重新登录。'; $('cl-old').value = ''; $('cl-new').value = ''; }
        else msg.textContent = r.error || '修改失败';
      }).catch(function () { msg.textContent = '连不上服务器'; });
    });
    setStatus(lsGet(DIRTY) === '1' ? 'wait' : 'ok');
  }

  function logout() {
    function bye() {
      api('POST', '/api/logout', {}).catch(function () {}).then(function () {
        clearToken(); lsDel(OWNER); lsDel(REV); lsDel(DIRTY); apply(null); location.reload();
      });
    }
    if (lsGet(DIRTY) !== '1') return bye();
    // 还有没上传的进度：先试着传一次
    setStatus('saving');
    api('PUT', '/api/save', { data: collect(), rev: st.rev }).then(function (r) {
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
    var mode = 'login', legacy = legacySave();
    function draw() {
      var reg = mode === 'register';
      host.innerHTML = '<div class="onboard cl-card"><span class="tape l"></span><span class="tape r"></span>' +
        '<span class="step">船员登记</span><h2>' + (reg ? '注册新账号' : '登录荆楚号') + '</h2>' +
        '<div class="cl-tabs" role="tablist"><button type="button" role="tab" class="sub' + (reg ? '' : ' on') + '" data-m="login" aria-selected="' + !reg + '">登录</button><button type="button" role="tab" class="sub' + (reg ? ' on' : '') + '" data-m="register" aria-selected="' + reg + '">注册</button></div>' +
        (note ? '<p class="cl-note">' + esc(note) + '</p>' : '') +
        '<form id="cl-form" class="cl-form" novalidate>' +
        '<label>账号名<input id="cl-user" name="username" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="16" placeholder="2–16 个字：汉字、字母、数字、下划线" value="' + esc(reg ? '' : (lsGet(LAST) || '')) + '"></label>' +
        '<label>密码<input id="cl-pass" name="password" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" placeholder="' + (reg ? '至少 6 位' : '') + '"></label>' +
        (reg ? '<label>再输一次密码<input id="cl-pass2" type="password" autocomplete="new-password"></label>' : '') +
        (reg && legacy ? '<label class="cl-chk"><input type="checkbox" id="cl-legacy" checked> 把这台设备上已有的存档（做题家「' + esc(legacy.name) + '」，' + legacy.mons.length + ' 只精灵）带到新账号</label>' : '') +
        '<label class="cl-chk"><input type="checkbox" id="cl-remember" checked> 自动登录：下次打开不用再输密码（在别人的电脑上请取消勾选）</label>' +
        '<p class="cl-err" id="cl-err" role="alert"></p>' +
        '<div class="ob-foot"><p class="hint">' + (reg ? '账号名用来登录，和游戏里的做题家名字是分开的。' : '换设备时用同一个账号登录，进度就会跟过来。') + '</p><button class="btn primary" type="submit" id="cl-go">' + (reg ? '注册并开始' : '登录') + '</button></div>' +
        '</form>' +
        '<p class="hint cl-warn">这个网站目前用的是 http 连接，请不要用和微信、银行等其他地方相同的密码。忘记密码可以找管理员重设。</p></div>';
      host.querySelectorAll('.cl-tabs .sub').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-m'); note = ''; draw(); }); });
      $('cl-form').addEventListener('submit', submit);
      ($('cl-user').value ? $('cl-pass') : $('cl-user')).focus();
    }
    function submit(e) {
      e.preventDefault();
      var reg = mode === 'register', user = $('cl-user').value.trim(), pass = $('cl-pass').value, err = $('cl-err'), go = $('cl-go');
      if (!/^[一-龥A-Za-z0-9_]{2,16}$/.test(user)) { err.textContent = '账号名要 2–16 个字，只能用汉字、字母、数字和下划线'; return; }
      if (pass.length < 6) { err.textContent = '密码至少 6 位'; return; }
      if (reg && pass !== $('cl-pass2').value) { err.textContent = '两次输入的密码不一样'; return; }
      var body = { user: user, pass: pass };
      var bring = reg && $('cl-legacy') && $('cl-legacy').checked;
      if (bring) body.data = collect();
      err.textContent = ''; go.disabled = true; go.textContent = '请稍候…';
      api('POST', reg ? '/api/register' : '/api/login', body).then(function (r) {
        go.disabled = false; go.textContent = reg ? '注册并开始' : '登录';
        if (r._code !== 200) { err.textContent = r.error || '出错了'; return; }
        var remember = $('cl-remember').checked;
        setToken(r.token, remember); lsSet(LAST, r.user);
        rememberPassword(user, pass, remember);
        // 注册时已经决定好旧存档带不带：不带就另存一份备用，之后不再问
        if (reg && !bring && legacySave()) backupLegacy();
        if (reg) { lsSet(OWNER, r.user); lsDel(DIRTY); }
        var proceed = function () { host.remove(); document.body.classList.remove('cloud-auth'); onDone(); };
        adopt(r.user, r.save, proceed);
      }).catch(function () { go.disabled = false; go.textContent = reg ? '注册并开始' : '登录'; err.textContent = '连不上服务器，请检查网络后再试'; });
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
            setToken(r.token, st.remember); close();
            if (r.save && r.save.rev !== st.rev) askConflict(r.save, function () {}); else { setStatus('wait'); push(true); }
          }).catch(function () { d.querySelector('#rl-err').textContent = '连不上服务器'; });
        });
      });
  }

  /* ---------- 加载游戏脚本（按顺序） ---------- */
  function loadGame() {
    var list = st.scripts.slice();
    (function next() {
      if (!list.length) { if (st.user) renderBar(); return; }
      var s = document.createElement('script'); s.src = list.shift();
      s.onload = next;
      s.onerror = function () { alert('加载 ' + s.src + ' 失败，请刷新页面重试'); };
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
      if (r._code === 200) return adopt(r.user, r.save, start);
      clearToken(); showLogin('登录已过期，请重新登录。', start);
    }).catch(function (e) {
      if (e.noapi) return loadGame();
      // 连不上服务器但之前登录过：先用本机缓存的进度玩，网络恢复后自动上传
      if (lsGet(OWNER)) { st.user = lsGet(OWNER); st.rev = +lsGet(REV) || 0; start(); setStatus('offline'); retryLater(); }
      else showLogin('连不上服务器，请检查网络后刷新页面。', start);
    });
  }
  function start() { watchStorage(); loadGame(); }

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
  window.CLOUD = { boot: boot, user: function () { return st.user; }, token: function () { return st.token; }, api: api, flush: flush };
})();
