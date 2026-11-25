/* 全服进度动态：只从成功落盘的存档生成，不接受客户端提交动态。 */
'use strict';
var fs=require('fs'),path=require('path'),crypto=require('crypto');
var KEEP=500,listeners=[];
function acc(u){try{var a=JSON.parse(u&&u.save&&u.save.data&&u.save.data['hs-account-v1']||'null');return a&&a.introDone&&Array.isArray(a.mons)?a:null;}catch(e){return null;}}
function rank(u){try{var r=JSON.parse(u&&u.save&&u.save.data&&u.save.data['hs-rank-v1']||'null');if(!r||!Number.isInteger(r.r)||r.r<0||r.r>10)return null;var season=r.season||'S1';return /^S[1-9]\d*$/.test(season)?{season:season,r:r.r,best:Math.max(r.r,Math.min(10,r.best|0))}:null;}catch(e){return null;}}
function key(m){return m&&typeof m.sid==='string'&&Number.isSafeInteger(m.u)&&m.u>0?m.u+':'+m.sid:null;}
function prepare(previous,u,now){
  var a=acc(u),before=acc(previous);if(!a)return [];
  var old=previous&&previous.activityState, state={mons:Object.assign({},old&&old.mons),tasks:Object.assign({},old&&old.tasks),ranks:Object.assign({},old&&old.ranks),bosses:Object.assign({},old&&old.bosses)},out=[];
  function baseline(b){
    if(!b)return;
    Object.keys(b.bosses||{}).forEach(function(k){state.bosses[k]=Math.max(state.bosses[k]||0,Math.max(0,Math.min(1e9,b.bosses[k]&&b.bosses[k].wins|0)));});
    b.mons.forEach(function(m){var k=key(m);if(k)state.mons[k]=Math.max(state.mons[k]||0,Math.min(100,m.lv|0));});
    Object.keys(b.story||{}).forEach(function(k){if(b.story[k]&&b.story[k].done)state.tasks['story:'+k]=1;});
    Object.keys(b.quests||{}).forEach(function(k){if(b.quests[k])state.tasks['quest:'+k]=1;});
  }
  baseline(before||a); // 上线前与导入存档的已有进度不补发历史动态。
  function add(kind,data){out.push(Object.assign({id:crypto.randomBytes(12).toString('hex'),at:now,user:u.name,name:String(a.name||u.name).slice(0,20),kind:kind},data));}
  // 按赛季记录已达到的大段位；首次部署、导入和降段后重新升回均不补发。
  var priorRank=rank(previous), currentRank=rank(u), rankBase=priorRank||currentRank;
  if(rankBase)state.ranks[rankBase.season]=Math.max(state.ranks[rankBase.season]||0,rankBase.best);
  if(currentRank){var wasRank=state.ranks[currentRank.season]||0;if(currentRank.r>wasRank)add('rank',{season:currentRank.season,rank:currentRank.r});state.ranks[currentRank.season]=Math.max(wasRank,currentRank.best);}
  Object.keys(a.bosses||{}).forEach(function(k){var n=Math.max(0,Math.min(1e9,a.bosses[k]&&a.bosses[k].wins|0)),was=state.bosses[k]||0;if(n>was)add('boss',{boss:k,first:!was});state.bosses[k]=Math.max(was,n);});
  a.mons.forEach(function(m){
    var k=key(m);if(!k)return;var lv=Math.max(1,Math.min(100,m.lv|0)),was=state.mons[k]||0;
    var mon={sid:m.sid,lv:lv,shiny:m.shiny===2?2:!!m.shiny};
    if(!was)add('mon',Object.assign({mon:mon},m.sid==='firemouse'&&a.fmNpc&&!(before&&before.fmNpc)?{gift:true}:{}));
    else {var milestone=Math.floor(lv/10)*10;if(milestone>=60&&was<milestone)add('level',{mon:mon,level:milestone});}
    state.mons[k]=Math.max(was,lv);
  });
  ['story','quest'].forEach(function(kind){Object.keys(kind==='story'?a.story||{}:a.quests||{}).forEach(function(k){
    var done=kind==='story'?a.story[k]&&a.story[k].done:a.quests[k],id=kind+':'+k;
    if(done&&!state.tasks[id]){add(kind,{task:k});state.tasks[id]=1;}
  });});
  u.activityState=state;return out;
}
function read(dir){try{var x=JSON.parse(fs.readFileSync(path.join(dir,'activity.json'),'utf8'));return Array.isArray(x)?x:[];}catch(e){return [];}}
function publish(dir,events){if(!events.length)return;var rows=events.slice().reverse().concat(read(dir)).slice(0,KEEP),f=path.join(dir,'activity.json');fs.writeFileSync(f+'.tmp',JSON.stringify(rows));fs.renameSync(f+'.tmp',f);listeners.forEach(function(fn){try{fn(events);}catch(e){console.error('全服播报失败',e.message);}});}
function page(dir,before,limit){var rows=read(dir),start=before?rows.findIndex(function(e){return e.id===before;})+1:0;if(before&&!start)return{items:[],next:null};var visible=rows.slice(start).filter(function(e){return e.kind!=='daily';}),items=visible.slice(0,limit);return{items:items,next:visible.length>items.length&&items.length?items[items.length-1].id:null};}
function monClass(E,m,gift){if(!E||!m||!E.SPMAP[m.sid])return null;var tier=E.GROW.relTier(m.sid);return m.shiny||gift&&m.sid==='firemouse'?'special':tier===1?'rare':tier===2||tier<0?'special':null;}
function bossMeta(E,key){
  if(!E||typeof key!=='string')return null;var parts=key.split(':'),B=E.PVE.BOSSES[parts[0]],d=parts.length===1?0:+parts[1];
  if(parts.length>2||!B)return null;
  if(parts.length===2&&/^w[01]?$/.test(parts[1])){var W=E.PVE.WEEKLIES.find(function(w){return w.boss===parts[0]&&E.PVE.wkKey(w)===parts[1];});return W?{name:B.name,diff:B.lv[W.d].diff+' · 每周挑战',weekly:true}:null;}
  return Number.isInteger(d)&&d>=0&&B.lv[d]?{name:B.name,diff:B.lv[d].diff,weekly:false}:null;
}
module.exports={monClass:monClass,bossMeta:bossMeta,onPublish:function(fn){listeners.push(fn);},prepare:prepare,publish:publish,page:page,KEEP:KEEP};
