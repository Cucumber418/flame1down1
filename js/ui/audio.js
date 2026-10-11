/* ==========================================================
 * 战斗背景音乐与声音设置
 *
 * 三首曲子都已经调成同样的响度（约 -16 LUFS），切换时不会忽大忽小：
 *   normal  寻常：野外对战、剧情对战、茶室和朋友家的对战
 *   boss    首领战
 *   pvp     竞技对战、切磋、精灵大乱斗
 * 对战开始时淡入、结束时淡出，切到别的标签页会暂停。
 * 声音设置（开关、音量）存在这台设备的浏览器里，不跟账号同步（手机和电脑可以设得不一样）。
 * 对外：window.HSAUDIO.play(曲目) / stop(淡出毫秒)
 * ========================================================== */
(function () {
  'use strict';
  var TRACKS = { normal: 'audio/bgm_normal.mp3?v=1', boss: 'audio/bgm_boss.mp3?v=1', pvp: 'audio/bgm_pvp.mp3?v=1' };
  var KEY = 'hs-sound-v1';
  var cfg = { music: true, vol: 60 };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) { cfg.music = sv.music !== false; if (sv.vol >= 0 && sv.vol <= 100) cfg.vol = sv.vol; } } catch (e) {}
  function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  var el = new Audio(); el.loop = true; el.preload = 'none';
  var ctx = null, gain = null, cur = null, level = 0, fadeT = null;
  // 用 Web Audio 的增益来调音量（iPhone 上直接改 audio.volume 没有效果）
  function setLevel(v) { level = v; if (gain) gain.gain.value = v; else el.volume = Math.max(0, Math.min(1, v)); }
  function target() { return cfg.music ? cfg.vol / 100 : 0; }
  function fadeTo(to, ms, done) {
    clearInterval(fadeT);
    var from = level, t0 = Date.now();
    if (!ms) { setLevel(to); if (done) done(); return; }
    fadeT = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      setLevel(from + (to - from) * k);
      if (k >= 1) { clearInterval(fadeT); if (done) done(); }
    }, 40);
  }
  // 浏览器要求用户点过页面之后才能出声：第一次点击时把播放器「解锁」
  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { ctx = new AC(); gain = ctx.createGain(); ctx.createMediaElementSource(el).connect(gain); gain.connect(ctx.destination); gain.gain.value = level; } catch (e) { ctx = null; gain = null; } }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (!el.src && !cur) {
      el.src = TRACKS.normal; el.dataset.k = 'normal';
      var p = el.play(); if (p) p.then(function () { if (!cur) el.pause(); }).catch(function () {});
    }
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);

  function play(kind) {
    if (!TRACKS[kind]) kind = 'normal';
    cur = kind;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (el.dataset.k !== kind) { el.src = TRACKS[kind]; el.dataset.k = kind; }
    try { el.currentTime = 0; } catch (e) {}
    setLevel(0);
    if (!cfg.music) return;
    var p = el.play(); if (p) p.catch(function () {});
    fadeTo(target(), 900);
  }
  function stop(ms) {
    cur = null;
    fadeTo(0, ms == null ? 1200 : ms, function () { if (!cur) el.pause(); });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { if (!el.paused) el.pause(); }
    else if (cur && cfg.music) { var p = el.play(); if (p) p.catch(function () {}); }
  });

  /* ---------- 顶栏的「声音」设置 ---------- */
  var btn = document.getElementById('snd-btn'), menu = document.getElementById('snd-menu');
  function drawBtn() { if (btn) { btn.querySelector('span').textContent = cfg.music && cfg.vol > 0 ? '🔊' : '🔇'; btn.setAttribute('aria-label', '声音：' + (cfg.music ? '开，音量 ' + cfg.vol : '关')); } }
  function drawMenu() {
    if (!menu) return;
    menu.innerHTML = '<b>声音</b>' +
      '<label class="snd-row"><input type="checkbox" id="snd-music"' + (cfg.music ? ' checked' : '') + '> 战斗背景音乐</label>' +
      '<label class="snd-row snd-vol' + (cfg.music ? '' : ' off') + '">音量 <input type="range" id="snd-vol" min="0" max="100" step="5" value="' + cfg.vol + '"' + (cfg.music ? '' : ' disabled') + '><output id="snd-out">' + cfg.vol + '</output></label>' +
      '<button type="button" class="btn ghost" id="snd-test">' + (cur ? '正在播放' : '试听') + '</button>' +
      '<p>野外、剧情对战播放「寻常」，首领战播放「Boss」，竞技对战、切磋和大乱斗播放「PVP」。设置只保存在这台设备上。</p>';
  }
  var testing = false;
  if (btn && menu) {
    drawBtn();
    btn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) drawMenu(); });
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.id === 'snd-test') {
        if (cur && !testing) return;
        if (testing) { testing = false; stop(400); e.target.textContent = '试听'; }
        else { testing = true; play('normal'); e.target.textContent = '停止试听'; }
      }
    });
    menu.addEventListener('input', function (e) {
      if (e.target.id === 'snd-vol') { cfg.vol = +e.target.value; document.getElementById('snd-out').textContent = cfg.vol; saveCfg(); drawBtn(); if (cur) fadeTo(target(), 150); }
    });
    menu.addEventListener('change', function (e) {
      if (e.target.id !== 'snd-music') return;
      cfg.music = e.target.checked; saveCfg(); drawBtn(); drawMenu();
      if (cur) { if (cfg.music) { var p = el.play(); if (p) p.catch(function () {}); fadeTo(target(), 500); } else fadeTo(0, 300, function () { el.pause(); }); }
    });
    document.addEventListener('click', function () {
      if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (testing) { testing = false; stop(400); } }
    });
  }

  window.HSAUDIO = { play: function (k) { testing = false; play(k); }, stop: stop };
})();
