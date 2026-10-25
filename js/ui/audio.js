/* ==========================================================
 * 背景音乐与声音设置
 *
 * 所有曲子都已经调成同样的响度（约 -16 LUFS），切换时不会忽大忽小。
 * 界面音乐（不在对战时播放，由 game.js 按当前所在的界面决定，见 HSAUDIO.scene）：
 *   ui          一般界面：精灵背包、仓库、航行日志、社交、荆楚号等
 *   arena       竞技大厅：竞技对战页面（选精灵、匹配）
 *   earth       地球：地球上的剧情（含序章）
 *   flora       芙罗拉星界面：芙罗拉星主页、剧情、盐碱地、荒芜BOSS页（FloraBackground）
 *   floraGrass  芙罗拉星 · 草甸：草甸野外场景（Flora1）
 *   floraForest 芙罗拉星 · 丛林：丛林野外场景（Flora2）
 *   剧情专用（剧本行 bgm 字段，2026-10-17 第八段起）：grassTalk（GrassTalk）、memory（Memory）、saver（Saver）、
 *               disComScene（剧情里循环放的 dis-communication）、faceEnemyScene（剧情里循环放的 FaceTheEnemy）、silence（音乐停止）
 *   floraFallen 芙罗拉星 · 瘴气化：第八段结尾全星瘴气化之后，替换上面三首 flora/floraGrass/floraForest（flora3-TheGreatCover）
 * 茶室里放主人选的「茶室音乐」（大厅 = ui、地球 = earth、芙罗拉星 = flora），自己和来拜访的船员都听得到（见 game.js 的 HOME_BGM）。
 * 战斗音乐（对战开始时由 battle-ui.js 调用 HSAUDIO.play，对战结束后回到界面音乐）：
 *   normal      寻常：野外对战、剧情对战、茶室和朋友家的对战
 *   boss        BOSS战（简单难度）
 *   boss2       BOSS战（普通难度）
 *   boss3       BOSS战（困难难度和每周挑战）
 *   tigerFinal  泰戈尔困难最终形态：困难泰戈尔复活（东北的往事）之后切换成这首
 *   stage       关卡战斗：星球挑战的所有关卡
 *   pvp         竞技对战、切磋、精灵大乱斗
 *   faceEnemy   剧情遇敌（FaceTheEnemy）：2026-10-17 起不再在战斗里放；只在剧情对话里遇敌前后用（剧本行 bgm: 'faceEnemyScene'）
 *   disCommunication 瘴气化之后芙罗拉星的野外对战曲（dis-communication）：取代 normal，由 game.js 的 startWildBattle 按 o.corrupt 传入
 * 切歌时先淡出再淡入；界面音乐切回来时从上次停下的地方接着放。切到别的标签页会暂停。
 * 声音设置（战斗音乐、界面音乐两个开关和音量）存在这台设备的浏览器里，不跟账号同步。
 * 对外：window.HSAUDIO.play(战斗曲目[, 播完后接的曲目]) / stop(淡出毫秒) / scene(界面曲目)
 * ========================================================== */
(function () {
  'use strict';
  var V = '?v=4';
  var TRACKS = {
    normal: 'audio/bgm_normal.mp3', boss: 'audio/bgm_boss.mp3', boss2: 'audio/bgm_boss2.mp3', boss3: 'audio/bgm_boss3.mp3', tigerFinal: 'audio/bgm_tiger_final.mp3',
    stage: 'audio/bgm_stage.mp3', pvp: 'audio/bgm_pvp.mp3', faceEnemy: 'audio/bgm_face_enemy.mp3', disCommunication: 'audio/bgm_dis_communication.mp3',
    ui: 'audio/bgm_ui_hms.mp3', arena: 'audio/bgm_arena.mp3', earth: 'audio/bgm_earth.mp3',
    flora: 'audio/bgm_flora.mp3', floraGrass: 'audio/bgm_flora_grass.mp3', floraForest: 'audio/bgm_flora_forest.mp3', floraFallen: 'audio/bgm_flora_fallen.mp3',
    beforeEnd: 'audio/bgm_before_end.mp3', spa: 'audio/bgm_spa.mp3', temple: 'audio/bgm_temple.mp3', kb: 'audio/bgm_kb.mp3', kbShallow: 'audio/bgm_kb_shallow.mp3', kbSurface: 'audio/bgm_kb_surface.mp3', kbDeep: 'audio/bgm_kb_deep.mp3', vitalVoyage: 'audio/bgm_vital_voyage.mp3', kbDeep2: 'audio/bgm_kb_deep2.mp3', kbDeep3: 'audio/bgm_kb_deep3.mp3',   // kb：坎伯兰星界面；kbShallow：坎伯兰星浅水区   // temple：坎伯兰星 · 古代神殿场景   // spa：温泉的默认音乐（2026-10-18）
    // 剧情里逐行切换的曲目（剧本行写 bgm: '键名'，见 game.js 的 sceneNowRaw）
    grassTalk: 'audio/bgm_grass_talk.mp3', memory: 'audio/bgm_memory.mp3', saver: 'audio/bgm_saver.mp3',
    disComScene: 'audio/bgm_dis_communication.mp3', faceEnemyScene: 'audio/bgm_face_enemy.mp3',
    // 2026-10-24 上传，用法之后再定：FloraLab、MingTraining 系列（MingTheme / MingBattle1、2 / MingFinalBattle1、2）、PompeiiCity
    floraLab: 'audio/bgm_flora_lab.mp3', mingTheme: 'audio/bgm_ming_theme.mp3', mingBattle1: 'audio/bgm_ming_battle1.mp3', mingBattle2: 'audio/bgm_ming_battle2.mp3',
    mingFinal1: 'audio/bgm_ming_final1.mp3', mingFinal2: 'audio/bgm_ming_final2.mp3', pompeiiCity: 'audio/bgm_pompeii_city.mp3'
  };
  // silence：剧情里「音乐突然停止」，没有曲子
  var SCENES = { kbDeep: 1, kbDeep2: 1, kbDeep3: 1, floraLab: 1, pompeiiCity: 1, mingTheme: 1, kb: 1, kbShallow: 1, kbSurface: 1, temple: 1, spa: 1, ui: 1, arena: 1, earth: 1, flora: 1, floraGrass: 1, floraForest: 1, floraFallen: 1, grassTalk: 1, memory: 1, saver: 1, disComScene: 1, faceEnemyScene: 1, silence: 1 };
  var ONESHOT = { faceEnemy: 1 };
  var FRESH = { disComScene: 1 };   // 每次开始放都从头放，不记上次停下的位置（剧情里的 dis-communication）   // 不循环；播完触发 chainNext 指定的下一首
  var KEY = 'hs-sound-v1';
  var cfg = { music: true, ui: true, vol: 60, uiOld: false };   // uiOld：主界面换回旧版音乐（2026-10-19 主界面默认换成 HMS_JC）
  var UI_NEW = 'audio/bgm_ui_hms.mp3', UI_OLD = 'audio/bgm_ui.mp3';
  try {
    var sv = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (sv) { cfg.music = sv.music !== false; cfg.ui = sv.ui !== false; if (sv.vol >= 0 && sv.vol <= 100) cfg.vol = sv.vol; cfg.uiOld = !!sv.uiOld; }
  } catch (e) {}
  TRACKS.ui = cfg.uiOld ? UI_OLD : UI_NEW;
  function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  var el = new Audio(); el.loop = true; el.preload = 'none';
  var ctx = null, gain = null, level = 0, fadeT = null, unlocked = false;
  var battle = null, scene = null, cur = null, pos = {}, switching;   // switching：正在淡出、准备换成的曲目（undefined 表示没有在换）
  var chainNext = null;   // 当前是不循环的一次性曲目时，播完了要自动接上的下一首
  el.addEventListener('ended', function () {
    if (ONESHOT[cur] && chainNext) { var nx = chainNext; chainNext = null; play(nx); }
  });
  // 用 Web Audio 的增益来调音量（iPhone 上直接改 audio.volume 没有效果）
  // 有 Web Audio 时音量只由增益控制，播放器自身的音量固定为 1（否则页面刚打开时设的 0 会一直留着，导致完全没声音）
  function setLevel(v) { level = v; if (gain) { gain.gain.value = v; if (el.volume !== 1) el.volume = 1; } else el.volume = Math.max(0, Math.min(1, v)); }
  function allowed(k) { return !!k && (SCENES[k] ? cfg.ui : cfg.music); }
  var held = false;   // 音乐鉴赏试听时暂停背景音乐
  function target() { return !held && allowed(cur) ? cfg.vol / 100 : 0; }
  function hold(on) { on = !!on; if (held === on) return; held = on; if (on) fadeTo(0, 300, function () { if (held) el.pause(); }); else if (cur && unlocked && document.visibilityState !== 'hidden') { var p = el.play(); if (p) p.catch(function () {}); fadeTo(target(), 600); } }
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
  function want() { var k = battle || scene; return k !== 'silence' && allowed(k) ? k : null; }
  function startTrack(k, fromStart) {
    cur = k;
    try { if (window.HSHEARD) window.HSHEARD(k === 'ui' && cfg.uiOld ? 'uiOld' : k); } catch (e) {}   // 剧情回顾 · 音乐鉴赏：记下听过的曲子
    el.loop = !ONESHOT[k];
    if (el.dataset.k !== k) { el.src = TRACKS[k] + V; el.dataset.k = k; }
    try { el.currentTime = fromStart ? 0 : (pos[k] || 0); } catch (e) {}
    setLevel(0);
    if (!unlocked || document.visibilityState === 'hidden') return;
    var p = el.play(); if (p) p.catch(function () {});
    fadeTo(target(), fromStart ? 900 : 1200);
  }
  // 让正在放的曲子和「应该放的」一致：不一样就先淡出再换
  // 换的是同一首曲子（只是键名不同，比如剧情里的 disComScene 和战斗里的 disCommunication）：不重新开始，接着往下放
  function sameTrack(k) {
    if (!k || !cur || k === cur || TRACKS[k] !== TRACKS[cur] || el.paused) return false;
    cur = k; el.dataset.k = k; el.loop = !ONESHOT[k]; return true;
  }
  function sync(fromStart, outMs) {
    var k = want();
    if (sameTrack(k)) return;
    if (k === cur && !fromStart) {
      if (k && unlocked && el.paused && document.visibilityState !== 'hidden') { var p = el.play(); if (p) p.catch(function () {}); fadeTo(target(), 600); }
      return;
    }
    if (switching === k && !fromStart) return;
    switching = k;
    var go = function () {
      switching = undefined;
      if (cur && !el.paused) pos[cur] = SCENES[cur] && !FRESH[cur] ? el.currentTime : 0;
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

  function play(kind, then) {
    if (!TRACKS[kind] || SCENES[kind]) kind = 'normal';
    battle = kind;
    chainNext = ONESHOT[kind] ? (then || 'normal') : null;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    sync(true, 300);
  }
  function stop(ms) { battle = null; sync(false, ms == null ? 1200 : ms); }
  function setScene(k) { if (!SCENES[k]) k = 'ui'; if (scene === k) return; scene = k; if (!battle) sync(); }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { if (!el.paused) { if (cur && SCENES[cur]) pos[cur] = el.currentTime; el.pause(); } }
    else if (cur && unlocked && allowed(cur)) { var p = el.play(); if (p) p.catch(function () {}); fadeTo(target(), 600); }
  });

  /* ---------- 顶栏的「设置」（2026-10-25：原来的「声音」按钮改为设置，里面有声音和技能特效开关） ---------- */
  var btn = document.getElementById('snd-btn'), menu = document.getElementById('snd-menu');
  function on() { return (cfg.music || cfg.ui) && cfg.vol > 0; }
  function drawBtn() { if (btn) { btn.setAttribute('aria-label', '设置。声音：战斗音乐' + (cfg.music ? '开' : '关') + '，界面音乐' + (cfg.ui ? '开' : '关') + '，音量 ' + cfg.vol); } }
  function drawMenu() {
    if (!menu) return;
    var any = cfg.music || cfg.ui;
    var fxOn = window.HSFX ? HSFX.on() : true;
    menu.innerHTML = '<b>声音</b>' +
      '<label class="snd-row"><input type="checkbox" id="snd-music"' + (cfg.music ? ' checked' : '') + '> 战斗音乐</label>' +
      '<label class="snd-row"><input type="checkbox" id="snd-ui"' + (cfg.ui ? ' checked' : '') + '> 界面音乐</label>' +
      '<label class="snd-row snd-vol' + (any ? '' : ' off') + '">音量 <input type="range" id="snd-vol" min="0" max="100" step="5" value="' + cfg.vol + '"' + (any ? '' : ' disabled') + '><output id="snd-out">' + cfg.vol + '</output></label>' +
      '<label class="snd-row">主界面 <select id="snd-uitrack"><option value="new"' + (cfg.uiOld ? '' : ' selected') + '>HMS_JC</option><option value="old"' + (cfg.uiOld ? ' selected' : '') + '>旧版</option></select></label>' +
      '<b class="set-h">对战</b><label class="snd-row"><input type="checkbox" id="set-fx"' + (fxOn ? ' checked' : '') + '> 技能特效</label>';
  }
  if (btn && menu) {
    drawBtn();
    btn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) drawMenu(); });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    menu.addEventListener('input', function (e) {
      if (e.target.id === 'snd-vol') { cfg.vol = +e.target.value; document.getElementById('snd-out').textContent = cfg.vol; saveCfg(); drawBtn(); if (cur) fadeTo(target(), 150); }
    });
    menu.addEventListener('change', function (e) {
      if (e.target.id === 'snd-uitrack') {
        cfg.uiOld = e.target.value === 'old'; saveCfg(); TRACKS.ui = cfg.uiOld ? UI_OLD : UI_NEW; delete pos.ui;
        if (el.dataset.k === 'ui') { el.dataset.k = ''; if (cur === 'ui') sync(true, 300); }
        return;
      }
      if (e.target.id === 'set-fx') { if (window.HSFX) HSFX.set(e.target.checked); return; }
      if (e.target.id !== 'snd-music' && e.target.id !== 'snd-ui') return;
      cfg[e.target.id === 'snd-music' ? 'music' : 'ui'] = e.target.checked; saveCfg(); drawBtn(); drawMenu();
      sync(false, 300);
    });
    document.addEventListener('click', function () { if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  }

  window.HSAUDIO = { play: play, stop: stop, scene: setScene, hold: hold, tracks: TRACKS, src: function (k) { return k === 'uiOld' ? UI_OLD + V : k === 'uiNew' ? UI_NEW + V : TRACKS[k] ? TRACKS[k] + V : null; }, vol: function () { return cfg.vol / 100; }, now: function () { return { battle: battle, scene: scene, cur: cur, playing: !el.paused }; } };
})();
