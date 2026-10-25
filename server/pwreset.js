/*
 * 一次性重置账号密码（只运行一次，记录在 DATA_DIR/pwreset.json）。
 * 这里只放加密后的结果（scrypt，盐 + 哈希），不放明文密码。
 */
'use strict';
var fs = require('fs'), path = require('path');
var A = require('./accounts');
var OUT = path.join(A.DATA_DIR, 'pwreset.json');
var JOBS = [{ id: 'cucumber418-20261025', user: 'Cucumber418', salt: 'ff894b09f1fceea7c26815097c964b14', hash: '1e07479ce06b86bde37f29726a28523699559b79a4f58ac163d4c2ec54cf6728edd728553d95c2652f0f3f4b07328d442996e091d8be2c353d5c6db8be91ec4f' }];
function run() {
  var done = {}; try { done = JSON.parse(fs.readFileSync(OUT, 'utf8')) || {}; } catch (e) {}
  JOBS.forEach(function (J) {
    if (done[J.id]) return;
    var u = A.loadUser(J.user);
    if (!u) { done[J.id] = { at: Date.now(), ok: false, note: '找不到账号' }; console.log('[pwreset] 找不到账号 ' + J.user); return; }
    u.salt = J.salt; u.hash = J.hash; A.saveUser(u);
    done[J.id] = { at: Date.now(), ok: true, user: u.name };
    console.log('[pwreset] 已重置 ' + u.name + ' 的密码');
  });
  try { fs.writeFileSync(OUT, JSON.stringify(done, null, 1)); } catch (e) {}
}
setTimeout(function () { try { run(); } catch (e) { console.log('[pwreset] 出错', e && e.stack); } }, 2000);
A.use(function (req, res, url) {
  if (url !== '/api/pwreset') return false;
  var r = {}; try { r = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  var o = {}; Object.keys(r).forEach(function (k) { o[k] = { ok: r[k].ok, note: r[k].note || '' }; });
  A.reply(res, 200, o); return true;
});
