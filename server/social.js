/*
 * 社交：玩家列表、好友、名片、在线状态、切磋邀请
 *
 * 名片里的信息（做题家名字、称号、展示精灵、个人宣言、段位）都从玩家的云存档里读出来，
 * 所以玩家在游戏里改了名片，存档同步到服务器后别人就能看到。
 *
 * HTTP 接口（需要登录）：
 *   GET  /api/players            所有玩家的简要信息 + 在线状态 + 是否好友
 *   GET  /api/card?user=账号名    某个玩家的完整名片
 *   POST /api/friends { user, on }   加好友 / 删好友（单向，像「关注」）
 *   GET  /api/home?user=账号名    拜访某人的茶室：茶室名字、展示中的精灵（用于观看和挑战）；同时记进主人的茶室动态（见 homelog.js）
 *   GET  /api/helpers            好友名片里的助战精灵（星球挑战里可以借用）
 *
 * WebSocket 消息（在 server.js 的 /ws 上）：
 *   → { type:'auth', token }                     用登录凭证认证，之后才算「在线」
 *   ← { type:'presence', user, online, busy }    有人上线 / 下线 / 开始或结束对战
 *   → { type:'challenge', to, mode, rule, pick }  向某人发起切磋（mode = 1、3、5；rule = normal 常规 / balance 平衡；
 *                                                  pick = blind 普通盲选 / draft 竞技征召，竞技征召只有 5v5 平衡模式能选）
 *   ← { type:'challenged', id, from, fromName, mode, rule, pick }   有人向你宣战
 *   → { type:'ch-reply', id, ok, reason }        接受 / 拒绝
 *   → { type:'ch-cancel', id }                   发起方取消
 *   ← { type:'ch-end', id, reason }              邀请结束（拒绝、超时、取消、对方忙）
 *   ← { type:'match', id, side, mode, peer, peerName, teams }   开打。side 0 是发起方，负责结算
 *   → { type:'mm', id, data } / ← { type:'mm', data }            对战中双方互发的消息（服务器只转发）
 *   → { type:'mm-over', id }                     对战结束
 *   ← { type:'mm-end', reason }                  对方掉线或离开
 *
 * 平衡模式（接受后先进入选人阶段，服务器当裁判，双方看不到对方还没公开的选择）：
 *   ← { type:'prep', id, side, kind, mode, phase, left, allowed, need, done, pools, bans }   当前阶段的状态（每次有变化都会发）
 *   → { type:'prep', id, phase, picks:[种类], moves:{种类:[技能]} }   提交这个阶段的选择
 *   → { type:'prep-quit', id }                   退出（对方收到 mm-end）
 *   普通盲选：phase = pick，双方各从自己拥有的精灵种类里选 N 只并配技能。
 *   竞技征召：pool（各带 8~10 种）→ ban（各禁用对方 3 种）→ pick（从自己剩下的里选 5 只并配技能）。
 *   某个阶段超时，没交的一方由服务器代选。全部选完后照常发 match（带 bal:true），精灵统一 LV60、性格无修正、无学习力、无纹章。
 *
 * 精灵大乱斗：
 *   → { type:'brawl-start', us:[u,u,u] }         从出战配队里选 3 只开始匹配
 *   ← { type:'brawl-wait', id, n, seconds }      已向 n 位在线玩家发出邀请
 *   ← { type:'brawl-invite', id, from, fromName, seconds }   有人在匹配大乱斗（小弹窗）
 *   → { type:'brawl-accept', id, us:[u,u,u] }    接受，并选好自己的 3 只
 *   → { type:'brawl-cancel', id }                发起方取消匹配
 *   ← { type:'brawl-end', id, reason, msg }      匹配结束（超时、取消、被别人接走、出错）
 *   开打后和切磋一样走 match / mm 消息，match 里带 brawl:true，6 只精灵由服务器洗牌后每人分 3 只
 *
 * 观战（任何对战都能看：野外、剧情、BOSS、茶室、竞技对战、切磋、大乱斗）：
 *   正在对战的玩家把画面（战况快照 + 战斗记录 + 动画提示）不停地发给服务器，服务器转给观众。
 *   → { type:'cast', op:'start', head:{ label, foe, pvp } }   开始转播（对战一开始就发）
 *   → { type:'cast', op:'f', snap, log:[[文字, 样式]], fx:[...] }   画面更新（大约每 0.25 秒一次）
 *   → { type:'cast', op:'end', title, sub }                   对战结束
 *   ← { type:'cast-viewers', n, names }                       有几个人在看你
 *   → { type:'cast-invite' }                                  两名玩家对战时，任一方都可以向全服在线玩家发观战邀请
 *   ← { type:'watch-invite', user, name, peerName, label }    收到全服观战邀请
 *   → { type:'watch-start', user } / { type:'watch-stop' }    开始 / 停止观战。只能看自己加了好友的人，或者发过全服邀请的对战
 *   ← { type:'watch', op:'full' | 'f' | 'end', ... }          观战画面；op=err 表示看不了（msg 写原因）
 *   presence 和玩家列表里的 battle 是对战标签（例如「野外 · 雷暴陨石群」），watchOpen 表示发过全服邀请、谁都能看
 */
'use strict';

var crypto = require('crypto');
var A = require('./accounts');
var pvp = require('./pvp');   // 联网对战的服务器裁判（2026-10-24）

var CH_SECONDS = 30;          // 宣战弹窗等待回应的时间
var BRAWL_SECONDS = 60;       // 大乱斗等待别人接受的时间
var BRAWL_LV = 60;
var MODES = [1, 3, 5];
var BAL_LV = 60;
var PREP_SEC = { pool: 90, ban: 60, pick: 150, ct6: 120, ctban: 60, ctset: 120 };   // ctset：争霸赛禁用之后，调整出战顺序和技能（2026-10-26）   // 平衡模式各选人阶段的时间
var DRAFT_MIN = 8, DRAFT_MAX = 10, DRAFT_BAN = 3;

/* ---------- 从存档里读出名片 ---------- */
function parseSave(u) {
  var d = (u && u.save && u.save.data) || {}, acc = null, rank = null;
  try { acc = JSON.parse(d['hs-account-v1'] || 'null'); } catch (e) {}
  try { rank = JSON.parse(d['hs-rank-v1'] || 'null'); } catch (e) {}
  if (!acc || typeof acc.name !== 'string' || !Array.isArray(acc.mons)) acc = null;
  return { acc: acc, rank: rank };
}
function int(v, lo, hi) { v = Math.round(+v || 0); return Math.max(lo, Math.min(hi, v)); }
function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
function monOut(m, acc) {
  var ev = {};
  if (m.ev && typeof m.ev === 'object') ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) { if (m.ev[k]) ev[k] = int(m.ev[k], 0, 300); });
  var iv = null;   // 天赋：六项 0~31，缺项就整套不发（对方按满天赋算）
  if (m.iv && typeof m.iv === 'object' && ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every(function (k) { return typeof m.iv[k] === 'number' && isFinite(m.iv[k]); })) { iv = {}; ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) { iv[k] = int(m.iv[k], 0, 31); }); }
  return {
    sid: str(m.sid, 32), lv: int(m.lv, 1, 100), nat: str(m.nat, 8) || null, ev: ev, iv: iv,
    emblem: !!(acc && acc.emblems && acc.emblems[m.sid]),
    shiny: m.shiny === 2 ? 2 : !!m.shiny, fs: m.fs != null && m.fs >= 0 && m.fs <= 2 ? m.fs | 0 : undefined,   // fs：形态切换装置切换的外观；击败普通难度泰戈尔得到的纹章（按精灵种类）
    moves: Array.isArray(m.moves) ? m.moves.filter(function (x) { return typeof x === 'string'; }).slice(0, 4).map(function (x) { return x.slice(0, 32); }) : []
  };
}
function monByU(acc, u) { for (var i = 0; i < acc.mons.length; i++) if (acc.mons[i] && acc.mons[i].u === u) return acc.mons[i]; return null; }
function activeTeam(acc) {
  var t = Array.isArray(acc.teams) ? acc.teams[acc.active | 0] : null;
  var list = (Array.isArray(t) ? t : []).map(function (u) { return monByU(acc, u); }).filter(Boolean);
  return list.length ? list : acc.mons.slice(0, 1);
}
// 拥有的精灵种类（平衡模式只看种类，不看等级）
function ownedSids(name) {
  var u = A.loadUser(name), acc = u && parseSave(u).acc, out = [];
  if (!acc) return out;
  acc.mons.forEach(function (m) { var s = m && str(m.sid, 32); if (s && out.indexOf(s) < 0) out.push(s); });
  return out;
}
// 头像：存档里 avatar 是一只精灵的编号；这只精灵不在了就没有头像（显示名字首字）
function avatarOf(acc) {
  var F = acc && acc.avatarF;   // 新头像：获得过的任意形态 { sid, st, shiny }
  if (F && typeof F.sid === 'string' && /^[a-z0-9_]{1,32}$/.test(F.sid)) return { sid: F.sid, st: Math.max(0, Math.min(2, F.st | 0)), shiny: F.shiny === 2 ? 2 : !!F.shiny,
    c: Array.isArray(F.c) && F.c.length === 3 && F.c.every(function (x) { return typeof x === 'number' && isFinite(x) && x > -3 && x < 4; }) ? F.c.map(function (x) { return Math.round(x * 10000) / 10000; }) : undefined };   // c：玩家自己裁的框
  var m = acc && acc.avatar != null ? monByU(acc, acc.avatar) : null;
  return m ? { sid: str(m.sid, 32), lv: int(m.lv, 1, 100), shiny: m.shiny === 2 ? 2 : !!m.shiny, fs: m.fs != null && m.fs >= 0 && m.fs <= 2 ? m.fs | 0 : undefined } : null;
}
// 助战精灵：名片里设置的一只（acc.card.helper 是精灵编号），星球挑战里好友可以借用
function helperOf(acc) { var u = acc && acc.card && acc.card.helper; return u != null ? monByU(acc, u) : null; }
// 2026-10-20：名片最多放 3 只助战（acc.card.helpers）；老存档只有 acc.card.helper
function helpersOf(acc) { var c = acc && acc.card; if (!c) return []; var L = Array.isArray(c.helpers) ? c.helpers.slice(0, 3) : c.helper != null ? [c.helper] : []; return L.map(function (u) { return monByU(acc, u); }).filter(Boolean); }
function showMons(acc) {
  var c = acc.card && Array.isArray(acc.card.show) ? acc.card.show : [];
  return c.slice(0, 5).map(function (u) { return monByU(acc, u); }).filter(Boolean);
}
// 精灵大乱斗：读完孝感大厅的支线「精灵大乱斗」才开放
function brawlOk(acc) { return !!(acc && acc.story && acc.story.brawl && acc.story.brawl.done); }
// 茶室：读完「陆羽茶室」支线才开放，最多展示 3 只
function homeOf(acc) {
  var open = !!(acc.story && acc.story.tea && acc.story.tea.done), h = acc.home || {};
  var cap = 3 + Math.min(4, int(h.cap, 0, 4));   // 茶室商店扩容：最多 7 只
  var raw = (Array.isArray(h.mons) ? h.mons : []).slice(0, cap).map(function (x) { var o = x && typeof x === 'object' ? x : { u: x }; return { x: o, m: monByU(acc, o.u) }; }).filter(function (r) { return r.m; });
  var mons = raw.map(function (r) { return r.m; });
  // 茶室音乐：大厅（默认）/ 地球 / 芙罗拉星（主线第一章通关后才有）
  var flora = !!((acc.chapters && acc.chapters.ch1) || (acc.mailSeen && acc.mailSeen['barren-bgm']));   // 主线第一章通关（之前击败普通荒芜拿到的也保留）
  var cg = acc.chalGot || {}, cbgm = { floraGrass: 30, floraForest: 60, floraFallen: 90, kbSurface: 'kb:30', kbShallow: 'kb:60', kbDeep: 'kb:90' };   // 坎伯兰星的挑战路线也有（2026-11-01）   // 芙罗拉星挑战累计星数奖励的茶室音乐
  var bgm = h.bgm === 'earth' || (cbgm[h.bgm] && cg[cbgm[h.bgm]]) ? h.bgm : 'base';   // 2026-11-01：没选过的、选的是已移除的「大厅」，都用基地默认音乐 Base   // 「芙罗拉星」2026-10-17 移除
  var L = h.layout && typeof h.layout === 'object' ? h.layout : {}, rooms = (acc.baseInv && acc.baseInv.rooms) || {};   // 2026-10-31：基地的房型和摆件（拜访时显示）
  var layout = { room: /^r[1-4]$/.test(L.room) && (L.room === 'r1' || rooms[L.room]) ? L.room : 'r1', deco: (Array.isArray(L.deco) ? L.deco : []).slice(0, 40).filter(function (d) { return d && /^d\d+$/.test(d.k); }).map(function (d) { return { k: d.k, x: +d.x || 50, y: +d.y || 80, f: d.f ? 1 : 0 }; }) };
  return { open: open, name: str(h.name, 10) || '我的基地', mons: open ? mons : [], raw: open ? raw : [], bgm: bgm, layout: layout };
}
var KING_R = 10;   // 王者（段位表见 js/engine/ranked.js 的 RANKS）
// 军衔：新存档（milV 3）直接读；还没上线换算的旧存档按 game.js 的 milMigrate 同样的规则算出新阶级
var MIL_COST_V1 = [20, 40, 60, 100, 150, 200, 300, 400, 500, 700, 900, 1200], MIL_V2_IDX = [0, 3, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
function milOf(acc) {
  if (acc.milV === 3) return int(acc.milRank, 0, 34);
  var old = acc.milRank | 0;
  if (acc.milV === 2) { var o2 = 0; MIL_V2_IDX.forEach(function (x, i) { if (x <= old) o2 = i; }); old = o2; }
  old = Math.max(0, Math.min(12, old));
  var pool = +acc.meritXp || 0; for (var i = 0; i < old; i++) pool += MIL_COST_V1[i];
  var r = 0; while (r < 34 && pool >= Math.round(80 * Math.pow(1.1, r))) { pool -= Math.round(80 * Math.pow(1.1, r)); r++; }
  return r;
}
function rankOut(r) {
  if (!r) return { r: 0, best: 0, w: 0, l: 0, stars: 0, kingBest: 0 };
  var cur = int(r.r, 0, 99), stars = int(r.stars, 0, 1e6), best = int(Math.max(r.best || 0, r.r || 0), 0, 99);
  var div = function (t, v) { return t >= 4 && t <= 9 ? (v >= 1 && v <= 5 ? int(v, 1, 5) : 1) : null; };   // 铂金到宗师的小段（V=5 … I=1），旧存档没有就按 I 段
  return { r: cur, dv: div(cur, r.dv), best: best, bestDv: div(best, best === cur && !(r.bestDv >= 1) ? r.dv : r.bestDv), w: int(r.w, 0, 1e7), l: int(r.l, 0, 1e7), stars: stars,
    kingBest: Math.max(int(r.kingBest, 0, 1e6), cur === KING_R ? stars : 0) };   // 王者达到过的最高星数
}

function summary(u, me) {
  var p = parseSave(u), acc = p.acc, on = isOnline(u.name);
  var cw = on && castOf(u.name);
  var o = { user: u.name, online: on, busy: on && isBusy(u.name), battle: on ? battleOf(u.name) : null, watchOpen: !!(cw && cw.cast.open), friend: !!(me && me.friends && me.friends.indexOf(u.name) >= 0),
    fan: !!(me && u.friends && u.friends.indexOf(me.name) >= 0), me: !!(me && me.name === u.name), lastSeen: lastSeen[u.name] || (u.save && u.save.savedAt) || u.created };
  if (!acc || !acc.introDone) { o.noChar = true; return o; }
  o.name = str(acc.name, 20); o.title = str(acc.title, 20) || null; o.avatar = avatarOf(acc); o.gender = acc.gender === 'f' ? 'f' : 'm';   // 主角形象（名片上显示）
  o.monsN = acc.mons.length; o.teamN = activeTeam(acc).length;
  o.mil = milOf(acc);   // 军衔（名字和换算规则见 game.js 的 RANKS_MIL / milMigrate）
  o.show = showMons(acc).map(function (m) { return { sid: str(m.sid, 32), lv: int(m.lv, 1, 100) }; });
  var ro = rankOut(p.rank); o.rank = ro.best; o.rankDv = ro.bestDv; if (ro.best === KING_R) o.rankStars = ro.kingBest;
  var hm = homeOf(acc); o.homeOpen = hm.open; o.homeN = hm.mons.length;
  var E = require('./tx').engine(); o.farmOpen = !!(E && E.GROW && E.GROW.farmOpen(acc)); o.farmN = o.farmOpen ? E.GROW.farmN(acc) : 0;
  o.brawl = brawlOk(acc);
  return o;
}
function card(u, me) {
  var o = summary(u, me);
  delete o.lastSeen;
  if (o.noChar) return o;
  var acc = parseSave(u).acc, species = {};
  acc.mons.forEach(function (m) { if (m && m.sid) species[m.sid] = 1; });
  o.created = acc.created || u.created; o.speciesN = Object.keys(species).length;
  o.motto = acc.card ? str(acc.card.motto, 200) : '';
  o.show = showMons(acc).map(function (m) { return monOut(m, acc); });
  o.helpers = helpersOf(acc).map(function (m) { return monOut(m, acc); }); o.helper = o.helpers[0] || null;
  o.rankInfo = rankOut(parseSave(u).rank);
  try { o.prog = require('./chalboard').progOf(acc); } catch (e) {}   // 挑战进度（名片里二级点开）
  o.titles = Array.isArray(acc.titles) ? acc.titles.filter(function (x) { return typeof x === 'string'; }).slice(0, 300) : [];
  return o;
}
function gameName(name) { var u = A.loadUser(name), acc = u && parseSave(u).acc; return acc ? str(acc.name, 20) : name; }
function teamSpec(name, n) { var u = A.loadUser(name), acc = u && parseSave(u).acc; return acc ? activeTeam(acc).slice(0, n).map(function (m) { return monOut(m, acc); }) : []; }

/* ---------- 在线状态 ---------- */
var online = {};      // 账号名 -> [ws, ...]
var lastSeen = {};
var allSockets = [];
function isOnline(name) { return !!(online[name] && online[name].length); }
function isBusy(name) { return (online[name] || []).some(function (w) { return !!w.match || !!w.cast; }); }
function castOf(name) { return (online[name] || []).filter(function (w) { return !!w.cast; })[0] || null; }
function battleOf(name) { var c = castOf(name); return c ? c.cast.head.label : isBusy(name) ? '切磋' : null; }
function out(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function toUser(name, obj) { (online[name] || []).forEach(function (w) { out(w, obj); }); }
function presence(name) {
  var c = castOf(name), msg = { type: 'presence', user: name, online: isOnline(name), busy: isBusy(name), battle: battleOf(name), watchOpen: !!(c && c.cast.open) };
  allSockets.forEach(function (w) { if (w.user) out(w, msg); });
}

/* ---------- 精灵大乱斗 ---------- */
var brawls = {};      // id -> { id, ws, user, sids, timer, invited: [账号名] }
// 检查选的 3 只都在这个人的出战配队里，返回它们的种类
function brawlPick(name, us) {
  var u = A.loadUser(name), acc = u && parseSave(u).acc;
  if (!acc) return { err: '还没有创建角色' };
  if (!brawlOk(acc)) return { err: '还没有开放精灵大乱斗' };
  var team = activeTeam(acc);
  if (team.length < 3) return { err: '出战配队里至少要有 3 只精灵' };
  if (!Array.isArray(us) || us.length !== 3) return { err: '要选 3 只精灵' };
  var picked = [];
  for (var i = 0; i < 3; i++) {
    var m = team.filter(function (x) { return x.u === us[i]; })[0];
    if (!m || picked.indexOf(m) >= 0) return { err: '选的精灵不在出战配队里' };
    picked.push(m);
  }
  return { sids: picked.map(function (m) { return str(m.sid, 32); }) };
}
function eligible(name, exceptWs) { var u = A.loadUser(name); return isOnline(name) && !isBusy(name) && u && brawlOk(parseSave(u).acc) && !Object.keys(brawls).some(function (k) { return brawls[k].user === name; }); }
function endBrawl(b, reason, msg, skipUser) {
  if (!brawls[b.id]) return;
  delete brawls[b.id]; clearTimeout(b.timer);
  out(b.ws, { type: 'brawl-end', id: b.id, reason: reason, msg: msg || '', side: 'from' });
  b.invited.forEach(function (n) { if (n !== skipUser) toUser(n, { type: 'brawl-end', id: b.id, reason: reason, side: 'to' }); });
}
var NAT_LIST = ['孤独', '固执', '调皮', '勇敢', '大胆', '淘气', '无虑', '悠闲', '保守', '稳重', '马虎', '冷静', '沉着', '温顺', '慎重', '狂妄', '胆小', '急躁', '开朗', '天真', '害羞', '实干', '坦率', '浮躁', '认真'];
function dealBrawl(a, b) {
  var pool = a.map(function (sid) { return { sid: sid, owner: 0 }; }).concat(b.map(function (sid) { return { sid: sid, owner: 1 }; }));
  for (var i = pool.length - 1; i > 0; i--) { var j = crypto.randomInt(i + 1), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  pool.forEach(function (x) { x.lv = BRAWL_LV; x.nat = NAT_LIST[crypto.randomInt(NAT_LIST.length)]; });
  return [pool.slice(0, 3), pool.slice(3, 6)];
}

/* ---------- 切磋邀请与对战 ---------- */
var challenges = {};  // id -> { id, from(ws), fromUser, to, mode, timer }
var matches = {};     // id -> { id, socks:[host, guest], users:[..] }
function newId() { return crypto.randomBytes(8).toString('hex'); }
function endChallenge(c, reason, skip) {
  if (!challenges[c.id]) return;
  delete challenges[c.id]; clearTimeout(c.timer);
  out(c.from, { type: 'ch-end', id: c.id, reason: reason, side: 'from' });
  (online[c.to] || []).forEach(function (w) { if (w !== skip) out(w, { type: 'ch-end', id: c.id, reason: reason, side: 'to' }); });
}
function endMatch(id, leaver, reason) {
  var m = matches[id]; if (!m) return;
  delete matches[id];
  if (m.prep) clearTimeout(m.prep.timer);
  if (leaver && m.srv) pvp.leave(m, leaver.user);   // 大乱斗中途有人离开：记下结果（没离开的一方能领奖励）
  pvp.stop(m);
  if (m.ct) setTimeout(function () { ctAfter(m, leaver, reason); }, 0);
  m.socks.forEach(function (w) {
    if (w.match === id) w.match = null;
    if (w !== leaver && reason) out(w, { type: 'mm-end', id: id, reason: reason });
  });
  m.users.forEach(presence);
}

/* ---------- 平衡模式的选人阶段 ---------- */
function prepStart(m, c) {
  m.prep = { kind: c.pick, mode: c.mode, owned: [ownedSids(m.users[0]), ownedSids(m.users[1])], pools: null, bans: null, sub: [null, null] };
  prepPhase(m, c.pick === 'draft' ? 'pool' : 'pick');
}
function prepPhase(m, ph) {
  var P = m.prep; P.phase = ph; P.sub = [null, null]; clearTimeout(P.timer);
  P.deadline = Date.now() + PREP_SEC[ph] * 1000;
  P.timer = setTimeout(function () { prepAuto(m); }, PREP_SEC[ph] * 1000 + 3000);   // 多等 3 秒，给网络延迟留余地
  prepSend(m);
}
// 这个阶段 side 可以选的种类
function prepAllowed(P, side) {
  if (P.phase === 'ct6') return P.owned[side];
  if (P.phase === 'ctban') return P.pools[1 - side];
  if (P.phase === 'ctset') return ctLeft(P, side);
  if (P.phase === 'pool') return P.owned[side];
  if (P.phase === 'ban') return P.pools[1 - side];
  if (P.kind === 'draft') return P.pools[side].filter(function (s) { return P.bans[1 - side].indexOf(s) < 0; });
  return P.owned[side];
}
// 要选几只：[最少, 最多]
function prepNeed(P, side) {
  var n = prepAllowed(P, side).length;
  if (P.phase === 'ct6') return [Math.min(CT_PICK, n), Math.min(CT_PICK, n)];
  if (P.phase === 'ctban') return [Math.min(CT_BAN, Math.max(0, n - 1)), Math.min(CT_BAN, Math.max(0, n - 1))];
  if (P.phase === 'ctset') { var cl = Math.min(5, ctLeft(P, side).length); return [cl, cl]; }
  if (P.phase === 'pool') return [Math.min(DRAFT_MIN, n), Math.min(DRAFT_MAX, n)];
  if (P.phase === 'ban') return [Math.min(DRAFT_BAN, n), Math.min(DRAFT_BAN, n)];
  var k = Math.min(P.mode, n); return [k, k];
}
function prepSend(m) {
  var P = m.prep;
  [0, 1].forEach(function (side) {
    var v = { type: 'prep', id: m.id, side: side, kind: P.kind, mode: P.mode, phase: P.phase, left: Math.max(0, Math.round((P.deadline - Date.now()) / 1000)),
      allowed: prepAllowed(P, side), need: prepNeed(P, side), done: [!!P.sub[side], !!P.sub[1 - side]], peerName: m.names[1 - side],
      mine: P.sub[side] ? P.sub[side].picks : null };
    if (P.pools) v.pools = [P.pools[side], P.pools[1 - side]];           // [我带的, 对方带的]
    if (P.bans) v.bans = [P.bans[side], P.bans[1 - side]];               // [我禁的（对方的）, 对方禁的（我的）]
    if (P.kind === 'ct') {
      v.ct = { label: ctLabel(Object.assign({ game: 1 }, m.ct)), cards: P.cm[side].list.map(ctCard) };
      if (P.pools) v.ct.foe = P.pools[1 - side].map(function (u) { var x = P.cm[1 - side].list.filter(function (y) { return String(y.u) === u; })[0]; return x ? ctCard(x) : null; }).filter(Boolean);
      if (P.phase === 'ctset') {   // 调整阶段：自己剩下的每只能用哪些技能、现在带着哪些
        v.ct.avail = {}; v.ct.cur = {};
        ctLeft(P, side).forEach(function (u) { var x = P.cm[side].list.filter(function (y) { return String(y.u) === u; })[0]; if (!x) return; v.ct.avail[u] = ctAvail(x); v.ct.cur[u] = Array.isArray(x.moves) ? x.moves.slice(0, 4) : []; });
        if (P.sub[side]) v.ct.sent = P.sub[side].moves || {};
      }
    }
    out(m.socks[side], v);
  });
}
function cleanMoves(o, picks) {
  var r = {};
  if (o && typeof o === 'object') picks.forEach(function (sid) {
    var a = o[sid]; if (!Array.isArray(a)) return;
    r[sid] = a.filter(function (x) { return typeof x === 'string'; }).slice(0, 4).map(function (x) { return x.slice(0, 32); });
  });
  return r;
}
function prepSubmit(m, side, msg) {
  var P = m.prep;
  if (msg.phase !== P.phase || P.sub[side]) return;
  var ok = prepAllowed(P, side), need = prepNeed(P, side), picks = Array.isArray(msg.picks) ? msg.picks.map(function (x) { return String(x).slice(0, 32); }) : [];
  var bad = picks.some(function (x, i) { return ok.indexOf(x) < 0 || picks.indexOf(x) !== i; });
  if (bad || picks.length < need[0] || picks.length > need[1]) { out(m.socks[side], { type: 'prep-err', id: m.id, msg: '选择不符合要求，请重新选' }); prepSend(m); return; }
  P.sub[side] = { picks: picks, moves: P.phase === 'pick' ? cleanMoves(msg.moves, picks) : P.phase === 'ctset' ? ctCleanMoves(P, side, msg.moves, picks) : {} };
  if (P.sub[0] && P.sub[1]) prepNext(m); else prepSend(m);
}
// 超时：没交的一方由服务器代选（带前几种、随机禁用、选前几只并用默认技能）
function prepAuto(m) {
  var P = m.prep; if (!P || !matches[m.id]) return;
  [0, 1].forEach(function (side) {
    if (P.sub[side]) return;
    var ok = prepAllowed(P, side).slice(), need = prepNeed(P, side);
    if (P.phase === 'ban') for (var i = ok.length - 1; i > 0; i--) { var j = crypto.randomInt(i + 1), t = ok[i]; ok[i] = ok[j]; ok[j] = t; }
    P.sub[side] = { picks: ok.slice(0, need[1]), moves: {}, auto: true };
  });
  prepNext(m);
}
function prepNext(m) {
  var P = m.prep;
  if (P.phase === 'ct6') { P.pools = [P.sub[0].picks, P.sub[1].picks]; prepPhase(m, 'ctban'); return; }
  if (P.phase === 'ctban') { P.bans = [P.sub[0].picks, P.sub[1].picks]; prepPhase(m, 'ctset'); return; }   // 2026-10-26：禁用之后各自调整出战顺序、换技能
  if (P.phase === 'ctset') {
    clearTimeout(P.timer);
    P.order = [P.sub[0].picks, P.sub[1].picks]; P.ctMoves = [P.sub[0].moves || {}, P.sub[1].moves || {}];
    var nameOf = function (side, u) { var x = P.cm[side].list.filter(function (y) { return String(y.u) === u; })[0]; return x ? str(x.sid, 32) : ''; };
    m.ct.teams = ctTeams(m);
    m.ct.banInfo = [P.bans[0].map(function (u) { return nameOf(1, u); }), P.bans[1].map(function (u) { return nameOf(0, u); })];   // [发起方禁掉的（应战方的）种类, 应战方禁掉的（发起方的）种类]
    m.ct.auto = [!!P.sub[0].auto, !!P.sub[1].auto];
    delete m.prep;
    ctSendMatch(m);
    return;
  }
  if (P.phase === 'pool') { P.pools = [P.sub[0].picks, P.sub[1].picks]; prepPhase(m, 'ban'); return; }
  if (P.phase === 'ban') { P.bans = [P.sub[0].picks, P.sub[1].picks]; prepPhase(m, 'pick'); return; }
  clearTimeout(P.timer);
  var teams = [0, 1].map(function (side) { var S = P.sub[side]; return S.picks.map(function (sid) { return { sid: sid, lv: BAL_LV, moves: S.moves[sid] || [] }; }); });
  var auto = [!!P.sub[0].auto, !!P.sub[1].auto], kind = P.kind, mode = P.mode, reveal = { pools: P.pools, bans: P.bans };
  delete m.prep;
  var base = { type: 'match', id: m.id, mode: mode, bal: true, rule: 'balance', pick: kind, names: m.names, auto: auto, draft: kind === 'draft' ? reveal : null, srv: !!m.srvOk };
  out(m.socks[0], Object.assign({}, base, { side: 0, peer: m.users[1], peerName: m.names[1], teams: teams }));
  out(m.socks[1], Object.assign({}, base, { side: 1, peer: m.users[0], peerName: m.names[0] }));
  if (m.srvOk) pvp.start(m, teams, 'balSpec', { mode: mode, bal: true, pick: kind });
}

/* ---------- 做题大王争霸赛（rule = 'contest'，见 contest.js） ----------
 * 选人：各从自己的精灵里带 6 只（ct6）→ 各禁对方 1 只（ctban）→ 剩下的按带的顺序取前 5 只，按背包里的练度打 5v5。每局都重新选（2026-10-25）。
 * 一个系列 bo3：每局打完双方各报一次结果（ct-res），先赢 2 局的胜；中途有人离开或在选人时退出，对方直接赢下整个系列。
 * 每局都向全服开放观战（决赛还会给全服在线玩家发观战邀请），发起方的转播画面会存成回放。 */
var CT_PICK = 6, CT_BAN = 1, CT_GAP = 6000, rematches = {};
function contest() { return require('./contest'); }
function ctMons(name) {
  var u = A.loadUser(name), acc = u && parseSave(u).acc;
  if (!acc) return { acc: null, list: [] };
  return { acc: acc, list: acc.mons.filter(function (m) { return m && m.u != null && m.sid; }) };
}
function ctCard(m) { return { u: String(m.u), sid: str(m.sid, 32), lv: int(m.lv, 1, 100), shiny: m.shiny === 2 ? 2 : !!m.shiny, fs: m.fs != null && m.fs >= 0 && m.fs <= 2 ? m.fs | 0 : undefined, nick: str(m.nick, 20) || undefined }; }
function ctLabel(ct) { return contest().NAME + ' · ' + (ct.final ? '决赛' : '第 ' + ct.round + ' 轮') + ' · 第 ' + ct.game + ' 局（bo3）'; }
function ctPrepStart(m) {
  var A0 = ctMons(m.users[0]), B0 = ctMons(m.users[1]);
  m.prep = { kind: 'ct', mode: 5, cm: [A0, B0], owned: [A0.list.map(function (x) { return String(x.u); }), B0.list.map(function (x) { return String(x.u); })], pools: null, bans: null, sub: [null, null] };
  prepPhase(m, 'ct6');
}
// 禁用之后剩下的（按带的顺序）
function ctLeft(P, side) { var ban = (P.bans && P.bans[1 - side]) || []; return (P.pools[side] || []).filter(function (u) { return ban.indexOf(u) < 0; }); }
// 这只精灵现在能用的技能（按等级和已解锁的隐藏技能，规则在 js/engine/acc.js）
function ctAvail(mm) {
  try { var E = require('./tx').engine(); if (E && E.ACC) return E.ACC.avail(mm.sid, mm.lv, Array.isArray(mm.hl) ? mm.hl : []); } catch (e) {}
  return Array.isArray(mm.moves) ? mm.moves.slice() : [];
}
function ctCleanMoves(P, side, o, picks) {
  var r = {};
  if (o && typeof o === 'object') picks.forEach(function (u) {
    var a = o[u], mm = P.cm[side].list.filter(function (x) { return String(x.u) === u; })[0]; if (!Array.isArray(a) || !mm) return;
    var ok = ctAvail(mm), got = a.filter(function (x, i) { return typeof x === 'string' && ok.indexOf(x) >= 0 && a.indexOf(x) === i; }).slice(0, 4);
    if (got.length) r[u] = got;
  });
  return r;
}
function ctTeams(m) {
  var P = m.prep;
  return [0, 1].map(function (side) {
    var C0 = P.cm[side], list = P.order && P.order[side] && P.order[side].length ? P.order[side] : ctLeft(P, side).slice(0, 5), mv = (P.ctMoves && P.ctMoves[side]) || {};
    return list.map(function (u) {
      var mm = C0.list.filter(function (x) { return String(x.u) === u; })[0]; if (!mm) return null;
      var o = monOut(mm, C0.acc); if (mv[u] && mv[u].length) o.moves = mv[u].slice(); return o;
    }).filter(Boolean);
  });
}
function ctSendMatch(m) {
  var ct = m.ct, names = m.names;
  var base = { type: 'match', id: m.id, mode: 5, rule: 'contest', names: names, ct: { round: ct.round, final: ct.final, game: ct.game, wins: ct.wins.slice(), label: ctLabel(ct), bans: ct.banInfo }, srv: !!m.srvOk };
  out(m.socks[0], Object.assign({}, base, { side: 0, peer: m.users[1], peerName: names[1], teams: ct.teams }));
  out(m.socks[1], Object.assign({}, base, { side: 1, peer: m.users[0], peerName: names[0] }));
  if (m.srvOk) pvp.start(m, ct.teams, 'spec', { mode: 5 });
  m.open = true;
  m.users.forEach(presence);
  if (ct.final) setTimeout(function () {   // 决赛：给全服在线玩家发观战邀请
    if (!matches[m.id]) return;
    Object.keys(online).forEach(function (u) { if (m.users.indexOf(u) < 0) toUser(u, { type: 'watch-invite', user: m.users[0], name: names[0], peer: m.users[1], peerName: names[1], label: ctLabel(ct) }); });
  }, 5000);
}
function ctAfter(m, leaver, reason) {
  var ct = m.ct, C = contest();
  if (ct.done) return;
  var started = ct.game > 1 || ct.wins[0] || ct.wins[1];
  if (m.prep && !started) { m.socks.forEach(function (w) { if (w !== leaver) out(w, { type: 'ct-series', cancel: true }); }); return; }   // 第 1 局还在选人就退出 / 掉线：这次不算，之后可以再约
  // 2026-10-26：系列打到一半中断——不再直接判整个系列负。两局之间（选人时）退出：比分照旧；对战中离开：这一局算离开的一方输。
  // 没决出胜负就记下进度（contest.savePart），下次再约接着打
  if (reason === 'left' || reason === 'quit') {
    var ls0 = leaver === m.socks[0] ? 0 : leaver === m.socks[1] ? 1 : -1;
    if (!m.prep && ls0 >= 0) { ct.wins[1 - ls0]++; ct.game++; }
    if (ct.wins[0] >= 2 || ct.wins[1] >= 2) {
      ct.done = true; var sc0 = {}; sc0[m.users[0]] = ct.wins[0]; sc0[m.users[1]] = ct.wins[1];
      C.report(ct.key, m.users[ct.wins[0] >= 2 ? 0 : 1], sc0, 'play');
      m.socks.forEach(function (w) { out(w, { type: 'ct-series', done: true, win: m.users[ct.wins[0] >= 2 ? 0 : 1], wins: ct.wins, how: 'play' }); });
      return;
    }
    var pw = {}; pw[m.users[0]] = ct.wins[0]; pw[m.users[1]] = ct.wins[1];
    C.savePart(ct.key, pw, ct.game);
    m.socks.forEach(function (w) { if (w !== leaver) out(w, { type: 'ct-series', paused: true, wins: ct.wins, next: ct.game }); });
    return;
  }
  var finish = function (wSide, how) {
    ct.done = true;
    var sc = {}; sc[m.users[0]] = ct.wins[0]; sc[m.users[1]] = ct.wins[1];
    if (how === 'forfeit') { sc[m.users[wSide]] = 2; }
    C.report(ct.key, m.users[wSide], sc, how);
    m.socks.forEach(function (w) { out(w, { type: 'ct-series', done: true, win: m.users[wSide], wins: ct.wins, how: how }); });
  };
  if (reason === 'left' || reason === 'quit') {   // 有人中途离开 / 选人时退出：对方赢下整个系列
    var ls = leaver === m.socks[0] ? 0 : leaver === m.socks[1] ? 1 : -1;
    if (ls >= 0) finish(1 - ls, 'forfeit');
    return;
  }
  if (reason !== 'over') return;
  if (ct.res != null) ct.wins[ct.res]++;
  ct.res = null;
  if (ct.wins[0] >= 2 || ct.wins[1] >= 2) { finish(ct.wins[0] >= 2 ? 0 : 1, 'play'); return; }
  m.socks.forEach(function (w) { out(w, { type: 'ct-series', done: false, wins: ct.wins, next: ct.game + 1, seconds: CT_GAP / 1000 }); });
  setTimeout(function () {
    var ok = m.socks.every(function (w) { return w.readyState === 1 && !w.match; });
    if (!ok) {   // 下一局开始时有一方不在了
      var pw2 = {}; pw2[m.users[0]] = ct.wins[0]; pw2[m.users[1]] = ct.wins[1];
      C.savePart(ct.key, pw2, ct.game + 1);   // 2026-10-26：记下进度，下次再约接着打
      m.socks.forEach(function (w) { if (w.readyState === 1) out(w, { type: 'ct-series', paused: true, wins: ct.wins, next: ct.game + 1 }); });
      return;
    }
    var nid = newId();
    ct.game++;
    var nm2 = { id: nid, socks: m.socks, users: m.users, names: m.names, ct: ct, open: true, srvOk: m.srvOk };
    matches[nid] = nm2; m.socks.forEach(function (w) { w.match = nid; });
    ct.teams = null; ct.banInfo = null; ctPrepStart(nm2);   // 2026-10-25：每局都重新选出战精灵（带 6 只、禁 1 只）和出战顺序
  }, CT_GAP);
}

/* ---------- 观战 ---------- */
var CAST_LOG = 80, INVITE_GAP = 60 * 1000;
function viewerNames(C) { return C.viewers.map(function (v) { return gameName(v.user); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 50); }
// 观众有变化：告诉对战的人，也告诉每个观众（大家都能看到谁在看）
function castViewers(w) {
  var C = w.cast; if (!C) return;
  var names = viewerNames(C), n = names.length;
  out(w, { type: 'cast-viewers', n: n, names: names });
  C.viewers.forEach(function (v) { out(v, { type: 'watch', op: 'viewers', user: w.user, n: n, names: names }); });
}
function unwatch(v) {
  var w = v.watching; v.watching = null;
  if (!w || !w.cast) return;
  var n = w.cast.viewers.length;
  w.cast.viewers = w.cast.viewers.filter(function (x) { return x !== v; });
  if (w.cast.viewers.length !== n) castViewers(w);
}
function castEnd(w, title, sub) {
  var C = w.cast; if (!C) return;
  w.cast = null;
  if (w.rec) {   // 争霸赛：存回放
    var R0 = w.rec; w.rec = null;
    if (R0.frames.length) { R0.end = { title: str(title, 40), sub: str(sub, 200) }; delete R0.last; try { contest().saveReplay(R0.key, R0.game, R0); } catch (e) {} }
  }
  C.viewers.forEach(function (v) { if (v.watching === w) v.watching = null; out(v, { type: 'watch', op: 'end', user: w.user, title: str(title, 40), sub: str(sub, 200) }); });
  if (w.user) presence(w.user);
}
function cleanLog(a) { return (Array.isArray(a) ? a : []).slice(0, 60).map(function (x) { return Array.isArray(x) ? [str(x[0], 300), str(x[1], 12)] : null; }).filter(Boolean); }
function onCast(ws, msg) {
  if (!ws.user) return;
  if (msg.op === 'start') {
    var old = ws.cast, h = msg.head || {};
    ws.cast = { head: { label: str(h.label, 40) || '对战', foe: str(h.foe, 30), pvp: !!ws.match, name: gameName(ws.user) }, snap: null, log: [], viewers: old ? old.viewers : [], open: !!(old && old.open && ws.match), t: Date.now() };
    if (ws.match && matches[ws.match]) ws.cast.open = ws.cast.open || !!matches[ws.match].open;
    if (h.resume && Array.isArray(msg.log)) ws.cast.log = cleanLog(msg.log).slice(-CAST_LOG);
    if (msg.snap && typeof msg.snap === 'object') ws.cast.snap = msg.snap;
    var cm = ws.match && matches[ws.match];
    if (cm && cm.ct && cm.socks[0] === ws && !h.resume) { ws.rec = { key: cm.ct.key, game: cm.ct.game, head: ws.cast.head, names: cm.names, label: ctLabel(cm.ct), t0: Date.now(), frames: [], last: '' }; if (ws.cast.snap) { ws.rec.frames.push([0, ws.cast.snap, null, null]); ws.rec.last = JSON.stringify(ws.cast.snap); } }
    ws.cast.viewers.forEach(function (v) { sendFull(v, ws); });
    presence(ws.user);
    return;
  }
  var C = ws.cast; if (!C) return;
  if (msg.op === 'f') {
    var lg = cleanLog(msg.log), fx = Array.isArray(msg.fx) ? msg.fx.slice(0, 40) : [];
    if (msg.snap && typeof msg.snap === 'object') C.snap = msg.snap;
    if (lg.length) { C.log = C.log.concat(lg); if (C.log.length > CAST_LOG) C.log = C.log.slice(-CAST_LOG); }
    if (C.viewers.length) { var f = { type: 'watch', op: 'f', user: ws.user, snap: msg.snap || null, log: lg, fx: fx }; C.viewers.forEach(function (v) { out(v, f); }); }
    if (ws.rec && ws.rec.frames.length < 20000) {   // 争霸赛回放：画面没变化又没有记录、动画的帧不存
      var sj = msg.snap ? JSON.stringify(msg.snap) : '';
      var snapChanged = sj && sj !== ws.rec.last;
      if (snapChanged || lg.length || fx.length) { ws.rec.frames.push([Date.now() - ws.rec.t0, snapChanged ? msg.snap : null, lg.length ? lg : null, fx.length ? fx : null]); if (snapChanged) ws.rec.last = sj; }
    }
    return;
  }
  if (msg.op === 'end') castEnd(ws, msg.title, msg.sub);
}
function sendFull(v, w) {
  var C = w.cast;
  var names = viewerNames(C);
  out(v, { type: 'watch', op: 'full', user: w.user, head: C.head, snap: C.snap, log: C.log, n: names.length, names: names });
}
function canWatch(ws, name) {
  var me = A.loadUser(ws.user), w = castOf(name);
  if (!w) return { err: '对方现在没有在对战' };
  if (!(w.cast.open || (me && Array.isArray(me.friends) && me.friends.indexOf(name) >= 0))) return { err: '只能观战自己的好友（或者发出了全服观战邀请的对战）' };
  return { w: w };
}

function onMessage(ws, msg) {
  switch (msg.type) {
    case 'auth': {
      var who = A.whoToken(msg.token);
      if (!who) { out(ws, { type: 'auth-fail' }); return true; }
      if (ws.user === who.user) return true;
      ws.user = who.user; ws.pv = msg.pv | 0;   // pv ≥ 2：支持服务器裁判
      var first = !isOnline(who.user);
      (online[who.user] = online[who.user] || []).push(ws);
      out(ws, { type: 'authed', user: who.user });
      if (first) presence(who.user);
      return true;
    }
    case 'challenge': {
      if (!ws.user) return true;
      var to = String(msg.to || ''), mode = MODES.indexOf(+msg.mode) >= 0 ? +msg.mode : 1;
      if (msg.rule === 'contest') {
        var cp = contest().pairOf(ws.user, String(msg.to || ''));
        var cto = String(msg.to || ''), cerr = !cp ? '你们不是这一轮还没打完的对手' : !isOnline(cto) ? '对方不在线' : ws.match ? '你正在对战中' : isBusy(cto) ? '对方正在对战中' : '';
        Object.keys(challenges).forEach(function (k) { if (challenges[k].from === ws) cerr = cerr || '你已经在等待另一个人回应了'; });
        if (cerr) { out(ws, { type: 'ch-end', id: null, reason: 'error', msg: cerr, side: 'from' }); return true; }
        var cc = { id: newId(), from: ws, fromUser: ws.user, to: cto, mode: 5, rule: 'contest', pick: null, ct: cp };
        challenges[cc.id] = cc;
        cc.timer = setTimeout(function () { endChallenge(cc, 'timeout'); }, CH_SECONDS * 1000);
        var clab = contest().NAME + ' · ' + (cp.final ? '决赛' : '第 ' + cp.round + ' 轮') + '（bo3）';
        out(ws, { type: 'ch-sent', id: cc.id, to: cto, toName: gameName(cto), mode: 5, rule: 'contest', label: clab, seconds: CH_SECONDS });
        toUser(cto, { type: 'challenged', id: cc.id, from: ws.user, fromName: gameName(ws.user), mode: 5, rule: 'contest', label: clab, final: cp.final, seconds: CH_SECONDS });
        return true;
      }
      var rule = msg.rule === 'balance' ? 'balance' : 'normal', pick = rule === 'balance' && mode === 5 && msg.pick === 'draft' ? 'draft' : rule === 'balance' ? 'blind' : null;
      var err = to === ws.user ? '不能向自己宣战' : !A.loadUser(to) ? '没有这个玩家' : !isOnline(to) ? '对方不在线' :
        ws.match ? '你正在对战中' : isBusy(to) ? '对方正在对战中' : !teamSpec(ws.user, 1).length ? '你还没有精灵' : !teamSpec(to, 1).length ? '对方还没有精灵' : '';
      if (!err && pick === 'draft') err = ownedSids(ws.user).length < DRAFT_MIN ? '竞技征召要求至少拥有 ' + DRAFT_MIN + ' 种精灵' : ownedSids(to).length < DRAFT_MIN ? '对方的精灵不到 ' + DRAFT_MIN + ' 种，不能进行竞技征召' : '';
      Object.keys(challenges).forEach(function (k) { if (challenges[k].from === ws) err = err || '你已经在等待另一个人回应了'; });
      if (err) { out(ws, { type: 'ch-end', id: null, reason: 'error', msg: err, side: 'from' }); return true; }
      var c = { id: newId(), from: ws, fromUser: ws.user, to: to, mode: mode, rule: rule, pick: pick };
      challenges[c.id] = c;
      c.timer = setTimeout(function () { endChallenge(c, 'timeout'); }, CH_SECONDS * 1000);
      out(ws, { type: 'ch-sent', id: c.id, to: to, toName: gameName(to), mode: mode, rule: rule, pick: pick, seconds: CH_SECONDS });
      toUser(to, { type: 'challenged', id: c.id, from: ws.user, fromName: gameName(ws.user), mode: mode, rule: rule, pick: pick, seconds: CH_SECONDS });
      return true;
    }
    case 'ch-cancel': {
      var c1 = challenges[msg.id];
      if (c1 && c1.from === ws) endChallenge(c1, 'cancel');
      return true;
    }
    case 'ch-reply': {
      var c2 = challenges[msg.id];
      if (!c2 || ws.user !== c2.to) return true;
      if (!msg.ok) { endChallenge(c2, msg.reason === 'busy' ? 'busy' : 'declined'); return true; }
      if (c2.from.readyState !== 1 || c2.from.match || ws.match) { endChallenge(c2, 'gone'); return true; }
      delete challenges[c2.id]; clearTimeout(c2.timer);
      (online[c2.to] || []).forEach(function (w) { if (w !== ws) out(w, { type: 'ch-end', id: c2.id, reason: 'taken', side: 'to' }); });
      var id = c2.id, host = c2.from, md0 = pvp.mode({ socks: [host, ws] });
      if (!md0.srv && !md0.legacy) { var oldMsg = '有一方的游戏版本太旧，请刷新页面后再来'; out(host, { type: 'ch-end', id: id, reason: 'error', msg: oldMsg, side: 'from' }); out(ws, { type: 'ch-end', id: id, reason: 'error', msg: oldMsg, side: 'to' }); return true; }
      if (c2.rule === 'contest') {
        var cp2 = contest().pairOf(c2.fromUser, c2.to);
        if (!cp2) { out(host, { type: 'ch-end', id: id, reason: 'error', msg: '这场对局已经结束了', side: 'from' }); out(ws, { type: 'ch-end', id: id, reason: 'error', msg: '这场对局已经结束了', side: 'to' }); return true; }
        matches[id] = { id: id, socks: [host, ws], users: [c2.fromUser, c2.to], names: [gameName(c2.fromUser), gameName(c2.to)], open: true,
          ct: { key: cp2.key, round: cp2.round, final: cp2.final, game: cp2.part ? cp2.part.game || 1 : 1, wins: cp2.part ? [cp2.part.wins[c2.fromUser] | 0, cp2.part.wins[c2.to] | 0] : [0, 0], res: null }, srvOk: md0.srv };   // part：上次打到一半的进度，接着打
        host.match = id; ws.match = id;
        ctPrepStart(matches[id]);
        presence(c2.fromUser); presence(c2.to);
        return true;
      }
      if (c2.rule === 'balance') {   // 平衡模式：先进入选人阶段
        if (c2.pick === 'draft' && (ownedSids(c2.fromUser).length < DRAFT_MIN || ownedSids(c2.to).length < DRAFT_MIN)) { out(host, { type: 'ch-end', id: id, reason: 'error', msg: '有一方的精灵不到 ' + DRAFT_MIN + ' 种', side: 'from' }); out(ws, { type: 'ch-end', id: id, reason: 'error', msg: '有一方的精灵不到 ' + DRAFT_MIN + ' 种', side: 'to' }); return true; }
        matches[id] = { id: id, socks: [host, ws], users: [c2.fromUser, c2.to], names: [gameName(c2.fromUser), gameName(c2.to)], srvOk: md0.srv };
        host.match = id; ws.match = id;
        prepStart(matches[id], c2);
        presence(c2.fromUser); presence(c2.to);
        return true;
      }
      var teams = [teamSpec(c2.fromUser, c2.mode), teamSpec(c2.to, c2.mode)];
      if (!teams[0].length || !teams[1].length) { out(host, { type: 'ch-end', id: id, reason: 'error', msg: '有一方没有精灵', side: 'from' }); out(ws, { type: 'ch-end', id: id, reason: 'error', msg: '有一方没有精灵', side: 'to' }); return true; }
      var names = [gameName(c2.fromUser), gameName(c2.to)];
      matches[id] = { id: id, socks: [host, ws], users: [c2.fromUser, c2.to], names: names, srvOk: md0.srv };
      host.match = id; ws.match = id;
      out(host, { type: 'match', id: id, side: 0, mode: c2.mode, peer: c2.to, peerName: names[1], names: names, teams: teams, srv: md0.srv });
      out(ws, { type: 'match', id: id, side: 1, mode: c2.mode, peer: c2.fromUser, peerName: names[0], names: names, srv: md0.srv });
      if (md0.srv) pvp.start(matches[id], teams, 'spec', { mode: c2.mode });
      presence(c2.fromUser); presence(c2.to);
      return true;
    }
    case 'brawl-start': {
      if (!ws.user) return true;
      if (ws.match) { out(ws, { type: 'brawl-end', reason: 'error', msg: '你正在对战中', side: 'from' }); return true; }
      if (Object.keys(brawls).some(function (k) { return brawls[k].ws === ws; })) return true;
      var pk = brawlPick(ws.user, msg.us);
      if (pk.err) { out(ws, { type: 'brawl-end', reason: 'error', msg: pk.err, side: 'from' }); return true; }
      var who2 = Object.keys(online).filter(function (n) { return n !== ws.user && eligible(n); });
      if (!who2.length) { out(ws, { type: 'brawl-end', reason: 'error', msg: '现在没有其他可以匹配的在线玩家', side: 'from' }); return true; }
      var bw = { id: newId(), ws: ws, user: ws.user, sids: pk.sids, invited: who2 };
      brawls[bw.id] = bw;
      bw.timer = setTimeout(function () { endBrawl(bw, 'timeout'); }, BRAWL_SECONDS * 1000);
      out(ws, { type: 'brawl-wait', id: bw.id, n: who2.length, seconds: BRAWL_SECONDS });
      var fromName = gameName(ws.user);
      who2.forEach(function (n) { toUser(n, { type: 'brawl-invite', id: bw.id, from: ws.user, fromName: fromName, seconds: BRAWL_SECONDS }); });
      return true;
    }
    case 'brawl-cancel': {
      var bc = brawls[msg.id];
      if (bc && bc.ws === ws) endBrawl(bc, 'cancel');
      return true;
    }
    case 'brawl-accept': {
      var ba = brawls[msg.id];
      if (!ba || !ws.user || ba.invited.indexOf(ws.user) < 0) { out(ws, { type: 'brawl-end', id: msg.id, reason: 'gone', side: 'to' }); return true; }
      if (ws.match || ba.ws.readyState !== 1 || ba.ws.match) { out(ws, { type: 'brawl-end', id: msg.id, reason: 'gone', side: 'to' }); return true; }
      var pk2 = brawlPick(ws.user, msg.us);
      if (pk2.err) { out(ws, { type: 'brawl-end', id: msg.id, reason: 'error', msg: pk2.err, side: 'to' }); return true; }
      var md2 = pvp.mode({ socks: [ba.ws, ws] });
      if (!md2.srv && !md2.legacy) { out(ws, { type: 'brawl-end', id: msg.id, reason: 'error', msg: '有一方的游戏版本太旧，请刷新页面后再来', side: 'to' }); return true; }
      endBrawl(ba, 'taken', '', ws.user);   // 其他被邀请的人：已经被接走了（发起方这里随后收到 match）
      var mid = ba.id, host2 = ba.ws, teams2 = dealBrawl(ba.sids, pk2.sids), names2 = [gameName(ba.user), gameName(ws.user)];
      matches[mid] = { id: mid, socks: [host2, ws], users: [ba.user, ws.user], names: names2, srvOk: md2.srv };
      host2.match = mid; ws.match = mid;
      out(host2, { type: 'match', id: mid, side: 0, mode: 3, brawl: true, peer: ws.user, peerName: names2[1], names: names2, teams: teams2, srv: md2.srv });
      out(ws, { type: 'match', id: mid, side: 1, mode: 3, brawl: true, peer: ba.user, peerName: names2[0], names: names2, teams: teams2, srv: md2.srv });
      if (md2.srv) pvp.start(matches[mid], teams2, 'brawlSpec', { mode: 3, brawl: true });
      presence(ba.user); presence(ws.user);
      return true;
    }
    case 'prep': {
      var mp = matches[msg.id];
      if (!mp || !mp.prep || ws.match !== msg.id) return true;
      prepSubmit(mp, mp.socks[0] === ws ? 0 : 1, msg);
      return true;
    }
    case 'prep-quit': {
      var mq = matches[msg.id];
      if (mq && mq.prep && ws.match === msg.id) endMatch(msg.id, ws, 'quit');
      return true;
    }
    case 'mm': {
      var m = matches[msg.id];
      if (!m || ws.match !== msg.id) return true;
      if (m.srv) { pvp.onMsg(m, m.socks[0] === ws ? 0 : 1, msg.data); return true; }   // 服务器裁判：交给 pvp.js 结算
      out(m.socks[m.socks[0] === ws ? 1 : 0], { type: 'mm', id: msg.id, data: msg.data });
      return true;
    }
    case 'cast': onCast(ws, msg); return true;
    case 'ct-rematch': {   // 争霸赛重赛：向对手申请（双方都在线、还在期限内）
      var rto = String(msg.to || ''), rmx = contest().rematchable(ws.user);
      if (!rmx || rmx.opp !== rto) { out(ws, { type: 'ct-rematch-res', ok: false, msg: '现在不能重赛（已经过了期限，或者下一轮已经开打）' }); return true; }
      if (!isOnline(rto)) { out(ws, { type: 'ct-rematch-res', ok: false, msg: '对手不在线' }); return true; }
      var rid = newId(); rematches[rid] = { from: ws.user, to: rto, t: Date.now() };
      setTimeout(function () { if (rematches[rid]) { delete rematches[rid]; toUser(ws.user, { type: 'ct-rematch-res', ok: false, msg: gameName(rto) + ' 没有回应' }); } }, 30000);
      toUser(rto, { type: 'ct-rematch-ask', id: rid, from: ws.user, fromName: gameName(ws.user), round: rmx.round, final: rmx.final });
      out(ws, { type: 'ct-rematch-res', ok: true, sent: true, msg: '已经向 ' + gameName(rto) + ' 申请重赛，等待对方同意……' });
      return true;
    }
    case 'ct-rematch-reply': {
      var rq = rematches[msg.id]; if (!rq || rq.to !== ws.user) return true;
      delete rematches[msg.id];
      if (!msg.ok) { toUser(rq.from, { type: 'ct-rematch-res', ok: false, msg: gameName(rq.to) + ' 不同意重赛' }); return true; }
      var vr = contest().voidPair(rq.from, rq.to);
      [rq.from, rq.to].forEach(function (u) { toUser(u, { type: 'ct-rematch-res', ok: !!vr.ok, done: !!vr.ok, msg: vr.ok ? '双方同意重赛，上一场的结果已经作废，可以重新对战了' : vr.err }); });
      return true;
    }
    case 'ct-res': {   // 争霸赛：一局打完，双方各报一次结果（以先收到的为准）
      var mr = matches[msg.id];
      if (!mr || !mr.ct || ws.match !== msg.id || mr.ct.res != null || mr.srv) return true;   // 服务器裁判的对局：结果由服务器记，不听浏览器报的
      var sd = mr.socks[0] === ws ? 0 : 1, r = msg.r;
      if (r === 'win') mr.ct.res = sd; else if (r === 'lose') mr.ct.res = 1 - sd;   // 平局不计，重打这一局
      return true;
    }
    case 'danmaku': {   // 观众发弹幕 / 表情：只有观众能看到，争霸赛的回放里也会保留
      var dw = castOf(String(msg.user || ''));
      if (!dw || ws.watching !== dw || !ws.user) return true;
      if (ws.dmAt && Date.now() - ws.dmAt < 1500) return true;
      ws.dmAt = Date.now();
      var dtx = str(msg.text, 30).replace(/[\u0000-\u001f]/g, '').trim(), de = str(msg.e, 32);
      if (!dtx && !de) return true;
      var dmo = { type: 'watch', op: 'dm', user: dw.user, name: gameName(ws.user), text: dtx, e: de || undefined };
      dw.cast.viewers.forEach(function (v) { out(v, dmo); });
      if (dw.rec) dw.rec.frames.push([Date.now() - dw.rec.t0, null, null, null, [dmo.name, dtx, de || '']]);
      return true;
    }
    case 'cast-invite': {
      var mi = ws.match && matches[ws.match];
      if (!ws.cast || !mi || mi.prep) { out(ws, { type: 'cast-invited', ok: false, msg: '只有和其他玩家对战时才能邀请全服观战' }); return true; }
      if (mi.invitedAt && Date.now() - mi.invitedAt < INVITE_GAP) { out(ws, { type: 'cast-invited', ok: false, msg: '刚刚已经邀请过了，过一会儿再试' }); return true; }
      mi.invitedAt = Date.now(); mi.open = true;
      mi.socks.forEach(function (w) { if (w.cast) w.cast.open = true; });
      var side = mi.socks[0] === ws ? 0 : 1, peerName = gameName(mi.users[1 - side]), myName = gameName(ws.user), n = 0;
      Object.keys(online).forEach(function (u) {
        if (mi.users.indexOf(u) >= 0) return;
        n++; toUser(u, { type: 'watch-invite', user: ws.user, name: myName, peer: mi.users[1 - side], peerName: peerName, label: ws.cast.head.label });
      });
      out(ws, { type: 'cast-invited', ok: true, n: n });
      out(mi.socks[1 - side], { type: 'cast-note', msg: myName + ' 向全服发出了观战邀请' });
      mi.users.forEach(presence);
      return true;
    }
    case 'watch-start': {
      if (!ws.user) return true;
      var wn = String(msg.user || '');
      if (wn === ws.user) { out(ws, { type: 'watch', op: 'err', msg: '不能观战自己' }); return true; }
      var cw = canWatch(ws, wn);
      if (cw.err) { out(ws, { type: 'watch', op: 'err', user: wn, msg: cw.err }); return true; }
      if (ws.watching !== cw.w) { unwatch(ws); ws.watching = cw.w; cw.w.cast.viewers.push(ws); castViewers(cw.w); }
      sendFull(ws, cw.w);
      return true;
    }
    case 'watch-stop': unwatch(ws); return true;
    case 'mm-over': {
      var m2 = matches[msg.id];
      if (m2 && m2.srv && !pvp.over(m2)) return true;   // 服务器裁判的对局还没打完：不能靠这条消息提前结束（要认输就发 quit）
      if (m2 && ws.match === msg.id) endMatch(msg.id, ws, 'over');
      return true;
    }
  }
  return false;
}

function onOpen(ws) { allSockets.push(ws); }
function onClose(ws) {
  allSockets = allSockets.filter(function (w) { return w !== ws; });
  Object.keys(brawls).forEach(function (k) { if (brawls[k].ws === ws) endBrawl(brawls[k], 'cancel'); });
  Object.keys(challenges).forEach(function (k) {
    var c = challenges[k];
    if (c.from === ws) endChallenge(c, 'cancel');
    else if (c.to === ws.user && (online[ws.user] || []).length <= 1) endChallenge(c, 'gone');
  });
  if (ws.match) endMatch(ws.match, ws, 'left');
  unwatch(ws);
  if (ws.cast) castEnd(ws, '转播中断', '对方离开了游戏');
  if (ws.user && online[ws.user]) {
    online[ws.user] = online[ws.user].filter(function (w) { return w !== ws; });
    if (!online[ws.user].length) { delete online[ws.user]; lastSeen[ws.user] = Date.now(); presence(ws.user); }
  }
}

/* ---------- HTTP 接口 ---------- */
A.use(function (req, res, url) {
  if (url !== '/api/players' && url !== '/api/card' && url !== '/api/friends' && url !== '/api/home' && url !== '/api/helpers') return false;
  var who = A.whoIs(req), me = who && A.loadUser(who.user);
  if (!me) { A.reply(res, 401, { error: '登录已失效，请重新登录' }); return true; }

  if (url === '/api/players' && req.method === 'GET') {
    var list = A.allUsers().map(function (u) { return summary(u, me); }).filter(function (p) { return p.me || !p.noChar; });   // 2026-10-27：还没创建角色的不进玩家列表
    list.sort(function (a, b) { return (b.me - a.me) || (b.online - a.online) || (b.friend - a.friend) || ((b.lastSeen || 0) - (a.lastSeen || 0)); });
    list.forEach(function (p) { delete p.lastSeen; });   // 2026-10-26：不再对外显示上次在线时间（只用来排序）
    A.reply(res, 200, { me: me.name, players: list });
    return true;
  }
  // 星球挑战：我加了好友的人里，名片上放了助战精灵的
  if (url === '/api/helpers' && req.method === 'GET') {
    var hl = [];
    (Array.isArray(me.friends) ? me.friends : []).forEach(function (n) {
      var fu = A.loadUser(n), fa = fu && parseSave(fu).acc;
      if (fa && fa.introDone) helpersOf(fa).forEach(function (hm) { hl.push({ user: fu.name, name: str(fa.name, 20), u: hm.u, mon: monOut(hm, fa) }); });
    });
    A.reply(res, 200, { helpers: hl });
    return true;
  }
  if (url === '/api/card' && req.method === 'GET') {
    var q = /[?&]user=([^&]*)/.exec(req.url), name = q ? decodeURIComponent(q[1]) : '', u = name && A.loadUser(name);
    if (!u) A.reply(res, 404, { error: '没有这个玩家' });
    else A.reply(res, 200, card(u, me));
    return true;
  }
  if (url === '/api/home' && req.method === 'GET') {
    var qh = /[?&]user=([^&]*)/.exec(req.url), hn = qh ? decodeURIComponent(qh[1]) : '', hu = hn && A.loadUser(hn);
    if (!hu) { A.reply(res, 404, { error: '没有这个玩家' }); return true; }
    var ha = parseSave(hu).acc;
    if (!ha || !ha.introDone) { A.reply(res, 200, { user: hu.name, noChar: true }); return true; }
    var hm = homeOf(ha);
    if (hm.open && hu.name !== me.name) require('./homelog').visit(hu.name, me.name);   // 记进主人的茶室动态
    // 2026-11-03：好友来访时，每只精灵现在能偷多少经验（规则在 js/engine/grow.js，偷走由交易 homeSteal 结算）
    var steal = null, stealLeft = 0, isFriend = hu.name !== me.name && Array.isArray(me.friends) && me.friends.indexOf(hu.name) >= 0, E = require('./tx').engine();
    if (isFriend && E && E.GROW) {
      var ma = parseSave(me).acc, now = Date.now(); stealLeft = E.GROW.stealLeft(ma, now);
      steal = hm.raw.map(function (r) { var v = E.GROW.stealView(r.x, r.m, me.name, stealLeft, now); return { u: r.m.u, n: v.n, why: v.why || null }; });
    }
    A.reply(res, 200, { user: hu.name, name: str(ha.name, 20), me: hu.name === me.name, open: hm.open, homeName: hm.name, bgm: hm.bgm, layout: hm.layout, mons: hm.mons.map(function (m) { return monOut(m, ha); }), online: isOnline(hu.name), friend: isFriend, farmOpen: !!(E && E.GROW && E.GROW.farmOpen(ha)), steal: steal, stealLeft: stealLeft, stealDay: E && E.GROW ? E.GROW.STEAL_DAY : 0 });
    return true;
  }
  if (url === '/api/friends' && req.method === 'POST') {
    A.readBody(req, function (err, body) {
      if (err) return A.reply(res, 400, { error: '请求格式不对' });
      me = A.loadUser(who.user);   // 重新读一次，避免覆盖刚刚同步上来的存档
      var t = A.loadUser(String(body.user || ''));
      if (!t) return A.reply(res, 404, { error: '没有这个玩家' });
      if (t.name === me.name) return A.reply(res, 400, { error: '不能加自己为好友' });
      var f = Array.isArray(me.friends) ? me.friends : [];
      f = f.filter(function (x) { return x !== t.name; });
      if (body.on) f.push(t.name);
      me.friends = f.slice(-200);
      A.saveUser(me);
      A.reply(res, 200, { friends: me.friends });
    });
    return true;
  }
  A.reply(res, 405, { error: '不支持' });
  return true;
});

// 星球挑战借好友的助战精灵（server/pve.js 用）：me 加了 owner 好友、owner 名片上放了编号 unit 的精灵时，返回 { owner, mon }
function friendHelper(me, owner, unit) {
  if (!me || !Array.isArray(me.friends) || me.friends.indexOf(owner) < 0) return null;
  var fu = A.loadUser(owner), fa = fu && parseSave(fu).acc; if (!fa || !fa.introDone) return null;
  var hm = helpersOf(fa).filter(function (m) { return m.u === unit; })[0];
  return hm ? { owner: str(fa.name, 20) || fu.name, mon: monOut(hm, fa) } : null;
}
// 拜访别人的茶室时的对手（server/pve.js 用）：主人茶室里展示的精灵
function homeFoes(owner, me) {
  var hu = A.loadUser(owner), ha = hu && parseSave(hu).acc; if (!ha || !ha.introDone || hu.name === me) return null;
  var hm = homeOf(ha); if (!hm.open) return null;
  return { owner: str(ha.name, 20) || hu.name, mons: hm.mons.map(function (m) { return monOut(m, ha); }) };
}
module.exports = { friendHelper: friendHelper, homeFoes: homeFoes, toAll: function (obj) { allSockets.forEach(function (w) { if (w.user) out(w, obj); }); }, castLabel: function (name) { var c = castOf(name); return c ? c.cast.head.label : null; }, isBusy: isBusy, toUser: toUser, gameName: gameName, isOnline: isOnline, avatarOf: function (name) { var u = A.loadUser(name), acc = u && parseSave(u).acc; return acc ? avatarOf(acc) : null; }, onMessage: onMessage, onOpen: onOpen, onClose: onClose, onlineCount: function () { return Object.keys(online).length; } };
