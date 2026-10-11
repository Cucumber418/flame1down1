/*
 * 管理账号（在服务器终端里运行）
 *
 *   sudo node /opt/flame1down1/server/admin.js list                  列出所有账号
 *   sudo node /opt/flame1down1/server/admin.js reset 账号名 新密码     帮忘记密码的人重设密码
 *
 * 重设密码后会自动重启游戏服务，让旧的登录失效。
 */
'use strict';
var accounts = require('./accounts');
var cmd = process.argv[2];

function fmt(t) { return t ? new Date(t).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—'; }

if (cmd === 'list') {
  var us = accounts.listUsers();
  console.log('共 ' + us.length + ' 个账号（存档目录 ' + accounts.DATA_DIR + '）');
  us.sort(function (a, b) { return a.created - b.created; }).forEach(function (u) {
    console.log('  ' + u.name + '    注册 ' + fmt(u.created) + '    最后保存 ' + fmt(u.savedAt) + '    第 ' + u.rev + ' 版');
  });
  process.exit(0);
} else if (cmd === 'reset' && process.argv[3] && process.argv[4]) {
  var pass = process.argv[4];
  if (pass.length < 6) { console.error('新密码至少 6 位'); process.exit(1); }
  accounts.resetPassword(process.argv[3], pass, function (err, name) {
    if (err) { console.error(err.message); process.exit(1); }
    console.log('已把 ' + name + ' 的密码改成：' + pass);
    try { require('child_process').execSync('systemctl restart flame1down'); console.log('游戏服务已重启'); }
    catch (e) { console.log('请手动重启：sudo systemctl restart flame1down'); }
    process.exit(0);
  });
} else {
  console.log('用法：\n  sudo node /opt/flame1down1/server/admin.js list\n  sudo node /opt/flame1down1/server/admin.js reset 账号名 新密码');
}
