(function () {
  'use strict';
  var busy = false, prompted = '', visited = '', visitBusy = false;
  function today() { return ACC.dayStr(Date.now()); }
  function checked() { var a = HSACC.acc(); return a && a.checkin && Array.isArray(a.checkin.days) ? a.checkin.days : []; }
  function open() {
    if (!window.HSACC || !HSACC.ready() || HSACC.inBattle() || document.getElementById('checkin-dlg')) return;
    var day = today(), year = +day.slice(0, 4), month = +day.slice(5, 7), start = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(), count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var dates = checked(), cells = '';
    for (var n = 0; n < start; n++) cells += '<span class="ci-empty"></span>';
    for (var i = 1; i <= count; i++) {
      var date = day.slice(0, 8) + ('0' + i).slice(-2), done = dates.indexOf(date) >= 0;
      cells += '<span class="ci-day' + (date === day ? ' today' : '') + (done ? ' signed' : '') + '"><b>' + i + '</b><small>' + (done ? '✓ 已签到' : date === day ? '今日' : '') + '</small></span>';
    }
    var login = HSACC.acc().checkin || {}, progress = '<div class="ci-progress"><span>累计登录 <b>' + (login.totalLogin || 0) + '</b> 天 · 每5天额外3圣晶石</span><span>连续登录 <b>' + (login.streak || 0) + '</b> 天 · 每5天额外5圣晶石</span></div>';
    var doneToday = dates.indexOf(day) >= 0, d = document.createElement('div'); d.id = 'checkin-dlg'; d.className = 'soc-dlg';
    d.innerHTML = '<div class="soc-box ci-box" role="dialog" aria-modal="true" aria-labelledby="ci-title"><span class="tape l"></span><div><span class="step">' + year + '年' + month + '月</span><h2 id="ci-title">每日签到</h2><p class="hint">每日领取5000累积经验与2枚圣晶石</p></div>' + progress + '<div class="ci-calendar">' + ['日','一','二','三','四','五','六'].map(function (w) { return '<span class="ci-week">' + w + '</span>'; }).join('') + cells + '</div><p class="hint" data-ci-msg>' + (login.bonusDay === day && login.lastBonus ? '今日登录额外奖励：圣晶石 ×' + login.lastBonus : '北京时间每日零点刷新，两项登录奖励可叠加') + '</p><div class="soc-foot"><button class="btn" data-ci-close>关闭</button><button class="btn primary" data-ci-sign' + (doneToday ? ' disabled' : '') + '>' + (doneToday ? '今日已签到' : '签到领取') + '</button></div></div>';
    document.body.appendChild(d); prompted = day;
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-ci-close]')) { if (!busy) d.remove(); return; }
      var b = e.target.closest('[data-ci-sign]'); if (!b || b.disabled || busy) return;
      busy = true; b.disabled = true;
      HSACC.signin(function (r) {
        busy = false; d.remove(); open();
        var msg = document.querySelector('[data-ci-msg]'); if (msg) msg.textContent = r.already ? '今天已经领取过了' : '已获得5000累积经验与2枚圣晶石' + (HSACC.acc().checkin.lastBonus ? '，今日登录另获圣晶石 ×' + HSACC.acc().checkin.lastBonus : '');
        HSACC.renderRes();
      }, function (err) { busy = false; b.disabled = false; d.querySelector('[data-ci-msg]').textContent = err || '网络不稳，请重试'; });
    });
    d.querySelector('[data-ci-close]').focus();
  }
  function check() {
    if (window.HSACC && HSACC.ready() && document.visibilityState === 'visible' && visited !== today() && !visitBusy) {
      visitBusy = true;
      HSACC.loginVisit(function (r) { visited = r.day; visitBusy = false; HSACC.renderRes(); if (r.bonus) HSACC.toast('登录奖励：' + (r.totalBonus ? '累计登录圣晶石 ×' + r.totalBonus : '') + (r.totalBonus && r.streakBonus ? '，' : '') + (r.streakBonus ? '连续登录圣晶石 ×' + r.streakBonus : ''));  }, function () { visitBusy = false; });
      return;
    }
    if (!window.HSACC || !HSACC.ready() || document.visibilityState !== 'visible' || HSACC.inBattle() || HSACC.resumePending() || document.querySelector('.soc-dlg') || document.querySelector('#vn:not([hidden])')) return;
    var day = today(); if (prompted === day || checked().indexOf(day) >= 0) return;
    var key = 'hs-checkin-prompt:' + ((window.CLOUD && CLOUD.user()) || (HSACC.acc().created || 'local'));
    if (localStorage.getItem(key) === day) return;
    localStorage.setItem(key, day); open();
  }
  window.HSCHECKIN = { open: open };
  setInterval(check, 2000);
})();
