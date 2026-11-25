/* 服务器事件驱动的全服小喇叭，所有游戏页面共用。 */
(function () {
  'use strict';
  var queue = [], seen = Object.create(null), seenOrder = [], current = null;
  var MAX_QUEUE = 15, MAX_AGE = 60000;
  function label(e) {
    var name = String(e.name || e.user || '').slice(0, 20);
    if (!name) return '';
    if ((e.kind === 'defeat' || e.kind === 'battle' && e.result === 'lose') && typeof e.opponent === 'string' && e.opponent) return '玩家「' + name + '」被「' + e.opponent.slice(0, 60) + '」击败了！';
    if (e.kind === 'online') return '船员「' + name + '」上线了！';
    if (e.kind === 'mon' && e.mon && SPMAP[e.mon.sid] && (e.rarity === 'rare' || e.rarity === 'special')) {
      var v = HSACC.view(e.mon);
      return '恭喜「' + name + '」获得' + (e.rarity === 'rare' ? '稀有精灵' : '特殊精灵') + '「' + (e.mon.shiny ? '异色·' : '') + v.name + '」！';
    }
    if (e.kind === 'boss' && e.bossInfo) return '恭喜「' + name + '」' + (e.first && !e.bossInfo.weekly ? '首次战胜' : '战胜') + ' BOSS「' + String(e.bossInfo.name).slice(0, 30) + '」·' + String(e.bossInfo.diff).slice(0, 20) + (e.bossInfo.weekly ? '' : '难度') + '！';
    return '';
  }
  function finish(view) {
    if (current !== view) return;
    current = null; clearTimeout(view.timer);
    if (view.animation) view.animation.cancel();
    view.el.remove(); setTimeout(next, 180);
  }
  function next() {
    if (current || document.hidden) return;
    while (queue.length && queue[0].expires < Date.now()) queue.shift();
    if (!queue.length) return;
    var item = queue.shift(), el = document.createElement('aside');
    el.className = 'global-broadcast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true');
    el.innerHTML = '<span class="broadcast-label" aria-hidden="true">📣 全服</span><div class="broadcast-clip"><span class="broadcast-message"></span></div><button type="button" class="broadcast-close" aria-label="关闭本条全服播报">×</button>';
    var text = el.querySelector('.broadcast-message'); text.textContent = item.text;
    document.body.appendChild(el);
    var view = current = { el: el, animation: null, timer: null }, clip = el.querySelector('.broadcast-clip');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var duration = reduce ? 7000 : Math.max(5500, Math.min(12000, (clip.clientWidth + text.scrollWidth) / 110 * 1000));
    if (!reduce && text.animate) {
      view.animation = text.animate([{ transform: 'translateX(' + clip.clientWidth + 'px)' }, { transform: 'translateX(-' + text.scrollWidth + 'px)' }], { duration: duration, easing: 'linear', fill: 'both' });
      view.animation.onfinish = function () { finish(view); };
    } else el.classList.add('broadcast-static');
    view.timer = setTimeout(function () { finish(view); }, duration + 300);
    el.querySelector('.broadcast-close').addEventListener('click', function () { finish(view); });
  }
  function push(e) {
    if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 100 || seen[e.id] || document.hidden) return;
    var text = label(e); if (!text) return;
    seen[e.id] = true; seenOrder.push(e.id); if (seenOrder.length > 200) delete seen[seenOrder.shift()];
    if (queue.length >= MAX_QUEUE) {
      var login = queue.findIndex(function (x) { return x.kind === 'online'; });
      if (login < 0 && e.kind === 'online') return;
      queue.splice(login >= 0 ? login : 0, 1);
    }
    queue.push({ text: text, kind: e.kind, expires: Date.now() + MAX_AGE }); next();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { queue = []; if (current) finish(current); } });
  window.HSBROADCAST = { push: push };
})();
