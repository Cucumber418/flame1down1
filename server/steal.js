/*
 * 去好友基地偷经验（2026-11-03）
 *
 * 偷的人发起交易 POST /api/tx { op: 'homeSteal', args: { owner, u } }（规则在 js/engine/grow.js）。
 * 交易里用 env.fetch('steal') 走到这里：检查是不是好友、基地开没开，然后在主人的存档上扣下被偷的经验（x.st、x.sb），
 * 存回去，并记进主人的基地动态。主人的 home.mons 是只由服务器改的字段（server/claims.js 的 OWNED），
 * 所以不用改主人的存档版本号：主人下次上传时会自动换成这里改过的。
 */
'use strict';

var A = require('./accounts');
var T = require('./tx');

T.hook('steal', function (u, arg) {
  var E = T.engine(); if (!E || !E.GROW) return { err: '服务器暂时不能处理，请稍后再试' };
  arg = arg && typeof arg === 'object' ? arg : {};
  var owner = String(arg.owner || ''), mu = +arg.u, cap = Math.max(0, Math.floor(+arg.cap || 0));
  if (!owner || owner === u.name) return { err: '不能偷自己基地里的经验' };
  if (!(Array.isArray(u.friends) && u.friends.indexOf(owner) >= 0)) return { err: '只能去好友的基地偷经验，先把对方加为好友吧' };
  var o = A.loadUser(owner), oa = null;
  try { oa = JSON.parse((o && o.save && o.save.data && o.save.data['hs-account-v1']) || 'null'); } catch (e) {}
  if (!oa || !(oa.story && oa.story.tea && oa.story.tea.done)) return { err: '对方的基地还没开放' };
  var r = E.GROW.stealFrom(oa, mu, u.name, cap, Date.now());
  if (r.err) return { err: r.err };
  o.save.data['hs-account-v1'] = JSON.stringify(oa);
  A.saveUser(o);
  try { require('./homelog').steal(owner, u.name, { u: mu, sid: r.sid, lv: r.lv, n: r.n }); } catch (e) {}
  return { n: r.n };
});
