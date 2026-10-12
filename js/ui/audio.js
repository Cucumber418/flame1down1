/* ==========================================================
 * 背景音乐与声音设置
 *
 * 所有曲子都已经调成同样的响度（约 -16 LUFS），切换时不会忽大忽小。
 * 界面音乐（不在对战时播放，由 game.js 按当前所在的界面决定，见 HSAUDIO.scene）：
 *   ui      一般界面：精灵背包、仓库、航行日志、社交、荆楚号等
 *   arena   竞技大厅：竞技对战页面（选精灵、匹配）
 *   earth   地球 1：地球上的剧情（含序章）
 *   flora   芙 1：芙罗拉星的界面和剧情
 * 茶室里放主人选的「茶室音乐」（大厅 = ui、地球 = earth、芙罗拉星 = flora），自己和来拜访的船员都听得到（见 game.js 的 HOME_BGM）。
 * 战斗音乐（对战开始时由 battle-ui.js 调用 HSAUDIO.play，对战结束后回到界面音乐）：
 *   normal  寻常：野外对战、剧情对战、茶室和朋友家的对战
 *   boss    首领战（简单难度）
 *   boss2   首领战（普通、困难难度和每周挑战）
 *   pvp     竞技对战、切磋、精灵大乱斗
 * 切歌时先淡出再淡入；界面音乐切回来时从上次停下的地方接着放。切到别的标签页会暂停。
 * 声音设置（战斗音乐、界面音乐两个开关和音量）存在这台设备的浏览器里，不跟账号同步。
 * 对外：window.HSAUDIO.play(战斗曲目) / stop(淡出毫秒) / scene(界面曲目)
 * ========================================================== */
(function () {
  'use strict';
  var V = '?v=3';
  var TRACKS = {
    normal: 'audio/bgm_normal.mp3', boss: 'audio/bgm_boss.mp3', boss2: 'audio/bgm_boss2.mp3', pvp: 'audio/bgm_pvp.mp3',
    ui: 'audio/bgm_ui.mp3', arena: 'audio/bgm_arena.mp3', earth: 'audio/bgm_earth.mp3', flora: 'audio/bgm_flora.mp3'
  };
  var SCENES = { ui: 1, arena: 1, earth: 1, flora: 1 };
  var KEY = 'hs-sound-v1';
  var cfg = { music: true, ui: true, vol: 60 };
  try {
    var sv = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (sv) { cfg.music = sv.music !== false; cfg.ui = sv.ui !== false; if (sv.vol >= 0 && sv.vol <= 100) cfg.vol = sv.vol; }
  } catch (e) {}
  function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  var el = new Audio(); el.loop = true; el.preload = 'none';
  var ctx = null, gain = null, level = 0, fadeT = null, unlocked = false;
  var battle = null, scene = null, cur = null, pos = {}, switching;   // switching：正在淡出、准备换成的曲目（undefined 表示没有在换）
  // 用 Web Audio 的增益来调音量（iPhone 上直接改 audio.volume 没有效果）
  // 有 Web Audio 时音量只由增益控制，播放器自身的音量固定为 1（否则页面刚打开时设的 0 会一直留着，导致完全没声音）
  function setLevel(v) { level = v; if (gain) { gain.gain.value = v; if (el.volume !== 1) el.volume = 1; } else el.volume = Math.max(0, Math.min(1, v)); }
  function allowed(k) { return !!k && (SCENES[k] ? cfg.ui : cfg.music); }
  function target() { return allowed(cur) ? cfg.vol / 100 : 0; }
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
  function want() { var k = battle || scene; return allowed(k) ? k : null; }
  function startTrack(k, fromStart) {
    cur = k;
    if (el.dataset.k !== k) { el.src = TRACKS[k] + V; el.dataset.k = k; }
    try { el.currentTime = fromStart ? 0 : (pos[k] || 0); } catch (e) {}
    setLevel(0);
    if (!unlocked || document.visibilityState === 'hidden') return;
    var p = el.play(); if (p) p.catch(function () {});
    fadeTo(target(), fromStart ? 900 : 1200);
  }
  // 让正在放的曲子和「应该放的」一致：不一样就先淡出再换
  function sync(fromStart, outMs) {
    var k = want();
    if (k === cur && !fromStart) {
      if (k && unlocked && el.paused && document.visibilityState !== 'hidden') { var p = el.play(); if (p) p.catch(function () {}); fadeTo(target(), 600); }
      return;
    }
    if (switching === k && !fromStart) return;
    switching = k;
    var go = function () {
      switching = undefined;
      if (cur && !el.paused) pos[cur] = SCENES[cur] ? el.currentTime : 0;
      el.pause();
      if (want() !== k) { cur = null; sync(); return; }   // 淡出期间又换了界面
      if (k) startTrack(k, fromStart); else cur = null;
    };
    if (cur && !el.paused && level > 0.01) fadeTo(0, outMs == null ? 500 : outMs, go); else go();
  }
  // 浏览器要求用户点过页面之后才能出声：第一次点击时把播放器「解锁」
  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { ctx = new AC(); gain = ctx.createGain(); ctx.createMediaElementSource(el).connect(gain); gain.connect(ctx.destination); el.volume = 1; gain.gain.value = level; } catch (e) { ctx = null; gain = null; } }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (!unlocked) {
      unlocked = true;
      if (cur) startTrack(cur, false);
      else {   // 现在没有要放的曲子（比如关了音乐）：也在这次点击里静音播放一下，让 Safari 之后允许它出声
        if (!el.src) { el.src = TRACKS.ui + V; el.dataset.k = 'ui'; }
        setLevel(0); var p = el.play(); if (p) p.then(function () { if (!cur) el.pause(); }).catch(function () {});
        sync();
      }
    }
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);

  function play(kind) {
    if (!TRACKS[kind] || SCENES[kind]) kind = 'normal';
    battle = kind;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    sync(true, 300);
  }
  function stop(ms) { battle = null; sync(false, ms == null ? 1200 : ms); }
  function setScene(k) { if (!SCENES[k]) k = 'ui'; if (scene === k) return; scene = k; if (!battle) sync(); }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { if (!el.paused) { if (cur && SCENES[cur]) pos[cur] = el.currentTime; el.pause(); } }
    else if (cur && unlocked && allowed(cur)) { var p = el.play(); if (p) p.catch(function () {}); fadeTo(target(), 600); }
  });

  /* ---------- 顶栏的「声音」设置 ---------- */
  var btn = document.getElementById('snd-btn'), menu = document.getElementById('snd-menu');
  function on() { return (cfg.music || cfg.ui) && cfg.vol > 0; }
  function drawBtn() { if (btn) { btn.querySelector('span').textContent = on() ? '🔊' : '🔇'; btn.setAttribute('aria-label', '声音：战斗音乐' + (cfg.music ? '开' : '关') + '，界面音乐' + (cfg.ui ? '开' : '关') + '，音量 ' + cfg.vol); } }
  function drawMenu() {
    if (!menu) return;
    var any = cfg.music || cfg.ui;
    menu.innerHTML = '<b>声音</b>' +
      '<label class="snd-row"><input type="checkbox" id="snd-music"' + (cfg.music ? ' checked' : '') + '> 战斗音乐</label>' +
      '<label class="snd-row"><input type="checkbox" id="snd-ui"' + (cfg.ui ? ' checked' : '') + '> 界面音乐</label>' +
      '<label class="snd-row snd-vol' + (any ? '' : ' off') + '">音量 <input type="range" id="snd-vol" min="0" max="100" step="5" value="' + cfg.vol + '"' + (any ? '' : ' disabled') + '><output id="snd-out">' + cfg.vol + '</output></label>' +
      '<p>界面：一般界面、竞技大厅、地球剧情、芙罗拉星各有一首。战斗：野外和剧情对战放「寻常」，首领战放「Boss / Boss2」，竞技对战、切磋和大乱斗放「PVP」。设置只保存在这台设备上。</p>';
  }
  if (btn && menu) {
    drawBtn();
    btn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) drawMenu(); });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    menu.addEventListener('input', function (e) {
      if (e.target.id === 'snd-vol') { cfg.vol = +e.target.value; document.getElementById('snd-out').textContent = cfg.vol; saveCfg(); drawBtn(); if (cur) fadeTo(target(), 150); }
    });
    menu.addEventListener('change', function (e) {
      if (e.target.id !== 'snd-music' && e.target.id !== 'snd-ui') return;
      cfg[e.target.id === 'snd-music' ? 'music' : 'ui'] = e.target.checked; saveCfg(); drawBtn(); drawMenu();
      sync(false, 300);
    });
    document.addEventListener('click', function () { if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  }

  window.HSAUDIO = { play: play, stop: stop, scene: setScene, now: function () { return { battle: battle, scene: scene, cur: cur, playing: !el.paused }; } };
})();
