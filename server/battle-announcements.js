/* 对战结果只由服务器裁判发布：PVE失败小喇叭、玩家对战动态与失败小喇叭。 */
'use strict';
var A = require('./accounts'), activity = require('./activity'), crypto = require('crypto');
function player(u) {
  try { var a = JSON.parse(u.save.data['hs-account-v1']); return a && a.introDone && Array.isArray(a.mons) ? { user: u.name, name: String(a.name || u.name).slice(0, 20) } : null; } catch (e) { return null; }
}
function event(id, p, kind, now) { return { id: crypto.createHash('sha256').update('battle:' + id).digest('hex').slice(0, 24), at: now || Date.now(), user: p.user, name: p.name, kind: kind }; }
function pve(u, sess, now) {
  var S = sess.S, p = player(u);
  if (!p || !S || S.training || sess.defeatAnnounced || ['lose','flee'].indexOf(S.over) < 0) return;
  var E = require('./tx').engine(), foe = E.act(S, 1), name = foe && E.nm(foe).replace(/^【|】$/g, '');
  if (!name) return;
  sess.defeatAnnounced = true;
  activity.notify([Object.assign(event('pve:' + sess.bid + ':' + p.user, p, 'defeat', now), { opponent: String(name).slice(0, 60), quit: !!S.quit || S.over === 'flee' })]);
}
function pvp(m, now) {
  if (!m.S || m.socialDone || ['win','lose','draw'].indexOf(m.S.over) < 0) return;
  var players = (m.users || []).map(function (name) { return player(A.loadUser(name)); });
  if (players.length !== 2 || !players[0] || !players[1]) return;
  var loser = m.S.over === 'win' ? 1 : 0, other = 1 - loser, p = players[loser];
  var mode = m.ct ? '争霸赛' : m.S.pvp && m.S.pvp.brawl ? '精灵大乱斗' : m.S.pvp && m.S.pvp.bal ? '平衡切磋' : '好友切磋';
  var e = Object.assign(event('pvp:' + m.id, p, 'battle', now), { result: m.S.over === 'draw' ? 'draw' : 'lose', opponent: players[other].name, opponentUser: players[other].user, mode: mode, quit: m.quitSide === loser });
  try { activity.publish(A.DATA_DIR, [e]); m.socialDone = true; }
  catch (err) { console.error('对战动态保存失败', err.message); }
}
module.exports = { pve: pve, pvp: pvp };
