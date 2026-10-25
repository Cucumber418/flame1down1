/* ==========================================================
 * 加载面板（2026-10-25）：耗时比较长的操作（登船、进入对战系统……）在屏幕中间弹出一个小面板，
 * 写着正在加载什么，下面一条进度条和百分比，左边站着一只随机精灵的最小形态（三只初始精灵最常见）。
 *
 * 用法：var L = LOADER.show('正在进入对战系统～');
 *       L.to(0.7)      进度条慢慢走向 70%（等服务器回话时用：越接近越慢，不会停住也不会超过）
 *       L.set(0.8)     直接到 80%（拿到真实进度时用）
 *       L.text('……')   换一句说明
 *       L.done(cb)     走到 100%，稍停一下再关掉，然后 cb()
 *       L.close()      出错时立刻关掉
 * 操作很快就结束（默认 350 毫秒内）时面板根本不出现，不会一闪而过。
 * 放在 cloud.js 之前加载（登船时也要用），精灵图要等 js/data/creatures.js、js/engine/battle.js 加载以后才有，在那之前不显示精灵。
 * ========================================================== */
var LOADER = (function () {
  'use strict';
  var STARTERS = ['leaf', 'squid', 'shroom'];
  var el = null, cur = null;   // cur：当前这一次加载（同一时间只显示一个面板，新的顶替旧的）

  // 随机挑一只：一半机会是三只初始精灵；其余从自己拥有、见过的精灵里挑（不剧透还没遇到的）
  function pickMon() {
    if (typeof SPMAP === 'undefined' || typeof formImg === 'undefined') {   // 登船时精灵资料还没加载完：先用三只初始精灵的图（js/data/assets.js 最先加载）
      var k = STARTERS[Math.floor(Math.random() * 3)], src = typeof PRE_SPRITES !== 'undefined' && PRE_SPRITES[k + '_s1'];
      return src ? { src: src, name: '' } : null;
    }
    var pool = [];
    try {
      var a = JSON.parse(localStorage.getItem('hs-account-v1') || 'null');
      if (a) { (a.mons || []).forEach(function (m) { if (m && pool.indexOf(m.sid) < 0) pool.push(m.sid); }); Object.keys(a.seen || {}).forEach(function (sid) { if (pool.indexOf(sid) < 0) pool.push(sid); }); }
    } catch (e) {}
    pool = pool.filter(function (sid) { return SPMAP[sid] && STARTERS.indexOf(sid) < 0; });
    var sid = !pool.length || Math.random() < 0.5 ? STARTERS[Math.floor(Math.random() * 3)] : pool[Math.floor(Math.random() * pool.length)];
    var s = SPMAP[sid]; if (!s) return null;
    try { return { src: formImg(s, 0), name: s.name }; } catch (e) { return null; }
  }
  function build() {
    if (el) return el;
    el = document.createElement('div'); el.className = 'ld-wrap'; el.hidden = true;
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="ld-box"><span class="tape l"></span><span class="tape r"></span>' +
      '<div class="ld-mon" aria-hidden="true"><img alt=""></div>' +
      '<div class="ld-main"><p class="ld-text"></p><div class="ld-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div><p class="ld-pct">0%</p></div></div>';
    document.body.appendChild(el);
    return el;
  }
  function paint(h) {
    if (h !== cur || !el) return;
    var p = Math.max(0, Math.min(1, h.p)), n = Math.floor(p * 100);
    el.querySelector('.ld-bar i').style.width = (p * 100).toFixed(1) + '%';
    el.querySelector('.ld-bar').setAttribute('aria-valuenow', n);
    el.querySelector('.ld-pct').textContent = n + '%';
  }
  function open(h) {
    if (h !== cur || h.closed) return;
    build(); h.shown = true;
    el.querySelector('.ld-text').textContent = h.msg;
    var m = h.mon || (h.mon = pickMon()), box = el.querySelector('.ld-mon'), img = box.querySelector('img');
    box.hidden = !m; if (m) { img.src = m.src; img.alt = ''; }
    el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
    paint(h);
  }
  function hide(h, cb) {
    if (h.closed) return; h.closed = true; clearInterval(h.tick); clearTimeout(h.wait);
    if (h !== cur) { if (cb) cb(); return; }
    cur = null;
    if (!h.shown || !el) { if (cb) cb(); return; }
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(function () { if (!cur && el) el.hidden = true; if (cb) cb(); }, 180);
  }
  function show(msg, opt) {
    opt = opt || {};
    if (cur) hide(cur);
    var h = { msg: msg || '加载中～', p: 0, goal: 0, cap: 0, closed: false, shown: false, mon: null };
    cur = h;
    h.wait = setTimeout(function () { open(h); }, opt.delay == null ? 350 : opt.delay);
    // 每 80 毫秒走一步：离目标越近走得越慢（只是让等待看起来在动，不会超过 to() 给的上限）
    h.tick = setInterval(function () {
      if (h.p < h.goal) h.p = Math.min(h.goal, h.p + Math.max(0.006, (h.goal - h.p) * 0.25));
      else if (h.p < h.cap) h.p += (h.cap - h.p) * 0.03;
      if (!h.mon && h.shown && el) { var m = pickMon(); if (m) { h.mon = m; var box = el.querySelector('.ld-mon'); box.hidden = false; box.querySelector('img').src = m.src; } }   // 登船时精灵数据后加载
      paint(h);
    }, 80);
    return {
      to: function (cap) { if (cap > h.cap) h.cap = Math.min(0.99, cap); return this; },
      set: function (p) { if (p > h.goal) h.goal = Math.min(1, p); if (h.goal > h.cap) h.cap = h.goal; return this; },
      text: function (t) { h.msg = t; if (h === cur && h.shown && el) el.querySelector('.ld-text').textContent = t; return this; },
      done: function (cb) {
        if (h.closed) { if (cb) cb(); return; }
        if (!h.shown) { hide(h, cb); return; }
        h.goal = h.cap = 1;
        var t0 = Date.now(), iv = setInterval(function () { if (h.p >= 0.999 || Date.now() - t0 > 700) { clearInterval(iv); h.p = 1; paint(h); setTimeout(function () { hide(h, cb); }, 220); } }, 40);
      },
      close: function () { hide(h); }
    };
  }
  // 预加载图片：每加载完一张（或失败、超时）调用 step(已完成, 总数)，全部完成调用 done
  function images(srcs, step, done) {
    var list = (srcs || []).filter(function (s, i, a) { return s && a.indexOf(s) === i; }), n = 0, fin = false;
    if (!list.length) { done(); return; }
    var end = function () { if (fin) return; n++; if (step) step(n, list.length); if (n >= list.length) { fin = true; done(); } };
    var guard = setTimeout(function () { if (!fin) { fin = true; done(); } }, 6000);   // 最多等 6 秒：网络慢时不卡住
    list.forEach(function (s) { var im = new Image(); im.onload = im.onerror = function () { end(); if (fin) clearTimeout(guard); }; im.src = s; });
  }
  return { show: show, images: images, pickMon: pickMon };
})();
