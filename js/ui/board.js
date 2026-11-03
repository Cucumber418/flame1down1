/* ==========================================================
 * 顶栏的「关于」和「讨论」
 *
 * 关于：制作名单、致谢、邀请制的说明。
 * 讨论：所有船员都能看到的公开留言板（服务器接口见 server/board.js）。
 *   有别人发了新留言时，「讨论」按钮上会出现小红点（看过的时间记在这台设备的浏览器里）。
 * 依赖：cloud.js 的 window.CLOUD、game.js 的 window.HSACC、battle-ui.js 的 window.HSUI
 * ========================================================== */
(function () {
  'use strict';
  var A = window.HSACC, C = window.CLOUD, H = window.HSUI;
  var $ = function (id) { return document.getElementById(id); };
  var esc = H ? H.esc : function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var online = !!(C && C.user && C.user());
  var MAX_LEN = 300, SEEN_KEY = 'hs-board-seen';
  function toast(t) { if (A && A.toast) A.toast(t); }
  function dialog(cls, html) {
    var d = document.createElement('div'); d.className = 'soc-dlg'; d.id = 'top-dlg';
    d.innerHTML = '<div class="soc-box ' + cls + '" role="dialog" aria-modal="true"><span class="tape l"></span><span class="tape r"></span>' + html + '</div>';
    var old = $('top-dlg'); if (old) old.remove();
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-tx]')) d.remove(); });
    return d;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('top-dlg')) $('top-dlg').remove(); });

  /* ---------- 关于 ---------- */
  function openAbout() {
    dialog('about-box',
      '<span class="step">关于本舰</span><h2>Flame1Down - 1</h2>' +
      '<p class="ab-lead">荆楚号自一册手绘图鉴启航。纸上的线条化作星海里的精灵，零散的念头渐渐聚成今天这艘船。</p>' +
      '<h4 class="ab-h">制作名录</h4>' +
      '<dl class="ab-credits">' +
        '<dt>程序主笔</dt><dd>Claude</dd>' +
        '<dt>程序设计</dt><dd>Vanber、Cucumber418</dd>' +
        '<dt>人物立绘</dt><dd>Threego（主美）</dd>' +
        '<dt>CG</dt><dd>Threego</dd>' +
        '<dt>剧情脚本</dt><dd>Cucumber418</dd>' +
        '<dt>精灵立绘</dt><dd>Cucumber418<small>多取材于二〇一九年的「黄尔号图鉴」，初时径以相机摄入，今正逐一描摹翻新。</small></dd>' +
        '<dt>配乐</dt><dd>BTTP（原创）、暂多借自「赛尔号」<small>童年旧曲，聊借一用，谨致谢忱。</small></dd>' +
      '</dl>' +
      '<h4 class="ab-h">本舰之约</h4>' +
      '<p>本作纯为热爱而生，不图分文之利，永不以之牟利。</p>' +
      '<h4 class="ab-h">致谢</h4>' +
      '<p>一舟行远，赖众桨同心。谨向每一位登船游玩的船员致以谢忱：诸位的每一场挑战、每一句意见，都是这艘船前行的风帆。你们的认可，是我们最大的动力。</p>' +
      '<div id="ab-client" hidden></div>' +
      '<h4 class="ab-h">登船须知</h4>' +
      '<p class="ab-note">本舰尚在试航，暂不打算广而告之，登船采取<b>邀请制</b>。还望诸位珍重此间清净，<b>请尽量不要把网址发到任何大群里</b>。若有好友想来，欢迎当面相邀，同舟共济。</p>' +
      '<div class="soc-foot"><button type="button" class="btn primary" data-tx="1">好的</button></div>');
    aboutClient();
  }
  // 电脑客户端：在客户端里显示版本；在电脑浏览器里显示下载链接（服务器上有安装包时才显示）
  function aboutClient() {
    var box = $('ab-client'); if (!box) return;
    var m = /Flame1DownClient\/([\d.]+)/.exec(navigator.userAgent || '');
    if (m) {
      box.innerHTML = '<h4 class="ab-h">电脑客户端</h4><p>你正在使用 Windows 客户端 v' + esc(m[1]) + '。按 Alt 可以显示菜单：刷新、全屏、缩放、修改服务器地址。</p>';
      box.hidden = false; return;
    }
    if (!/^https?:$/.test(location.protocol) || !/Windows/.test(navigator.userAgent || '')) return;
    fetch('/download/client.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (info) {
      if (!info || !info.version || !$('ab-client')) return;
      var mb = info.size ? '，约 ' + Math.round(info.size / 1048576) + ' MB' : '';
      box.innerHTML = '<h4 class="ab-h">电脑客户端</h4>' +
        '<p>荆楚号另备 Windows 客户端：独立窗口、自带手写字体、背景音乐无需先点页面。进度与网页版同在服务器上，登录同一账号即可接着玩。</p>' +
        '<p><a class="btn primary" href="/download/windows" style="display:inline-block;text-decoration:none;margin:2px 0">下载 Windows 客户端（v' + esc(info.version) + mb + '）</a></p>' +
        '<p class="ab-note">安装时若 Windows 提示「已保护你的电脑」，点「更多信息」，再点「仍要运行」即可。</p>';
      box.hidden = false;
    }).catch(function () {});
  }

  /* ---------- 讨论 ---------- */
  var B = { posts: [], more: false, me: null, busy: false, latest: 0 };
  function api(m, u, b) { return C.api(m, u, b); }
  function seen() { try { return +localStorage.getItem(SEEN_KEY) || 0; } catch (e) { return 0; } }
  function markSeen(t) { try { if (t > seen()) localStorage.setItem(SEEN_KEY, String(t)); } catch (e) {} badge(false); }
  function badge(on) { var b = $('board-badge'); if (b) b.hidden = !on; }
  function ago(t) {
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    var d = new Date(t); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function titleName(id) { return id && A && A.titleName ? A.titleName(id) : ''; }
  function postHTML(p) {
    var mine = p.user === B.me, tn = titleName(p.title);
    return '<li class="bd-post' + (mine ? ' mine' : '') + '" data-id="' + esc(p.id) + '"><span class="pav' + (p.avatar ? ' img' : '') + '">' + (A && A.avatarInner ? A.avatarInner(p.avatar, p.name || p.user) : esc(Array.from(p.name || p.user || '?')[0] || '?')) + '</span>' +
      '<div class="bd-body"><p class="bd-who"><b>' + esc(p.name) + '</b>' + (tn ? '<span class="chip ttl">' + esc(tn) + '</span>' : '') + '<span class="hint">@' + esc(p.user) + ' · ' + ago(p.t) + '</span></p>' +
      '<p class="bd-text">' + esc(p.text) + '</p>' +
      '<p class="bd-acts"><button type="button" class="linkbtn" data-reply="' + esc(p.name) + '">回复</button>' + (mine ? '<button type="button" class="linkbtn red" data-del="' + esc(p.id) + '">删除</button>' : '') + '</p></div></li>';
  }
  function drawList() {
    var el = $('bd-list'); if (!el) return;
    el.innerHTML = B.posts.length ? B.posts.map(postHTML).join('') : '<li class="bd-empty hint">还没有人留言，来说第一句话吧。</li>';
    var more = $('bd-more'); if (more) more.hidden = !B.more;
  }
  function fetchPage(before) {
    B.busy = true;
    return api('GET', '/api/board?n=40' + (before ? '&before=' + before : '')).then(function (r) {
      B.busy = false;
      if (r._code !== 200) { toast(r.error || '读取讨论区失败'); return; }
      B.me = r.me; B.more = r.more; B.latest = r.latest;
      B.posts = before ? B.posts.concat(r.posts) : r.posts;
      drawList(); markSeen(r.latest);
    }).catch(function () { B.busy = false; var el = $('bd-list'); if (el) el.innerHTML = '<li class="bd-empty hint">连不上服务器</li>'; });
  }
  function openBoard() {
    if (!online) {
      dialog('board-box', '<span class="step">讨论</span><h2>船员留言板</h2><p class="hint">讨论区需要联网：用服务器网址打开游戏并登录账号后才能看到和留言。</p><div class="soc-foot"><button type="button" class="btn" data-tx="1">关闭</button></div>');
      return;
    }
    var d = dialog('board-box',
      '<div class="bd-head"><div><span class="step">讨论</span><h2>船员留言板</h2></div><button type="button" class="btn ghost" data-tx="1">关闭</button></div>' +
      '<p class="hint">这里的留言所有船员都能看到。友善交流，不要发联系方式和网址。</p>' +
      '<form class="bd-form" onsubmit="return false"><textarea id="bd-text" rows="3" maxlength="' + MAX_LEN + '" placeholder="说点什么……攻略、心得、bug、建议都可以"></textarea>' +
      '<div class="bd-form-row"><span class="hint" id="bd-cnt">0 / ' + MAX_LEN + '</span><button type="button" class="btn primary" id="bd-send">发表</button></div></form>' +
      '<ul class="bd-list" id="bd-list"><li class="bd-empty hint">读取中……</li></ul>' +
      '<button type="button" class="btn ghost bd-more" id="bd-more" hidden>加载更早的留言</button>');
    var ta = d.querySelector('#bd-text');
    ta.addEventListener('input', function () { d.querySelector('#bd-cnt').textContent = Array.from(ta.value).length + ' / ' + MAX_LEN; });
    d.addEventListener('click', function (e) {
      var t;
      if (e.target.id === 'bd-send') { send(ta, e.target); return; }
      if (e.target.id === 'bd-more') { if (!B.busy && B.posts.length) fetchPage(B.posts[B.posts.length - 1].t); return; }
      if ((t = e.target.closest('[data-reply]'))) { ta.value = '@' + t.dataset.reply + ' ' + ta.value.replace(/^@\S+\s/, ''); ta.focus(); ta.dispatchEvent(new Event('input')); return; }
      if ((t = e.target.closest('[data-del]'))) {
        if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = '确认删除？'; setTimeout(function () { if (t.isConnected) { t.dataset.armed = ''; t.textContent = '删除'; } }, 3000); return; }
        api('POST', '/api/board-del', { id: t.dataset.del }).then(function (r) {
          if (r._code !== 200) { toast(r.error || '删除失败'); return; }
          B.posts = B.posts.filter(function (p) { return p.id !== t.dataset.del; }); drawList();
        }).catch(function () { toast('连不上服务器'); });
      }
    });
    fetchPage();
  }
  function send(ta, btn) {
    var text = ta.value.trim();
    if (!text) { toast('留言不能是空的'); return; }
    btn.disabled = true;
    api('POST', '/api/board', { text: text }).then(function (r) {
      btn.disabled = false;
      if (r._code !== 200) { toast(r.error || '发送失败'); return; }
      ta.value = ''; ta.dispatchEvent(new Event('input'));
      r.post.avatar = A && A.avatarSpec ? A.avatarSpec() : null; B.posts.unshift(r.post); drawList(); markSeen(r.post.t);
    }).catch(function () { btn.disabled = false; toast('连不上服务器'); });
  }
  // 小红点：别人发了新留言（自己发的不算）
  function poll() {
    if (!online || document.visibilityState !== 'visible' || $('top-dlg')) return;
    api('GET', '/api/board?n=1').then(function (r) {
      if (r._code !== 200 || !r.posts.length) return;
      var p = r.posts[0];
      badge(p.t > seen() && p.user !== r.me);
    }).catch(function () {});
  }

  if ($('about-btn')) $('about-btn').addEventListener('click', openAbout);
  if ($('board-btn')) $('board-btn').addEventListener('click', openBoard);
  if (online) { setTimeout(poll, 3000); setInterval(poll, 120000); }
  window.HSBOARD = { about: openAbout, board: openBoard };
})();
