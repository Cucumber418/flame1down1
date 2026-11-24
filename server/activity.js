/* 全服进度动态：只从成功落盘的存档生成，不接受客户端提交动态。 */
'use strict';
var fs=require('fs'),path=require('path'),crypto=require('crypto');
var KEEP=500;
function acc(u){try{var a=JSON.parse(u&&u.save&&u.save.data&&u.save.data['hs-account-v1']||'null');return a&&a.introDone&&Array.isArray(a.mons)?a:null;}catch(e){return null;}}
function key(m){return m&&typeof m.sid==='string'&&Number.isSafeInteger(m.u)&&m.u>0?m.u+':'+m.sid:null;}
function prepare(previous,u,now){
  var a=acc(u),before=acc(previous);if(!a)return [];
  var old=previous&&previous.activityState, state={mons:Object.assign({},old&&old.mons),tasks:Object.assign({},old&&old.tasks),daily:Object.assign({},old&&old.daily)},out=[];
  function baseline(b){
    if(!b)return;
    b.mons.forEach(function(m){var k=key(m);if(k)state.mons[k]=Math.max(state.mons[k]||0,Math.min(100,m.lv|0));});
    Object.keys(b.story||{}).forEach(function(k){if(b.story[k]&&b.story[k].done)state.tasks['story:'+k]=1;});
    Object.keys(b.quests||{}).forEach(function(k){if(b.quests[k])state.tasks['quest:'+k]=1;});
    if(b.daily&&/^\d{4}-\d{2}-\d{2}$/.test(b.daily.date))(b.daily.list||[]).forEach(function(t){if(t&&t.c)state.daily[b.daily.date+':'+t.id]=1;});
  }
  baseline(before||a); // 上线前与导入存档的已有进度不补发历史动态。
  function add(kind,data){out.push(Object.assign({id:crypto.randomBytes(12).toString('hex'),at:now,user:u.name,name:String(a.name||u.name).slice(0,20),kind:kind},data));}
  a.mons.forEach(function(m){
    var k=key(m);if(!k)return;var lv=Math.max(1,Math.min(100,m.lv|0)),was=state.mons[k]||0;
    var mon={sid:m.sid,lv:lv,shiny:m.shiny===2?2:!!m.shiny};
    if(!was)add('mon',{mon:mon});
    else {var milestone=Math.floor(lv/10)*10;if(milestone>=60&&was<milestone)add('level',{mon:mon,level:milestone});}
    state.mons[k]=Math.max(was,lv);
  });
  ['story','quest'].forEach(function(kind){Object.keys(kind==='story'?a.story||{}:a.quests||{}).forEach(function(k){
    var done=kind==='story'?a.story[k]&&a.story[k].done:a.quests[k],id=kind+':'+k;
    if(done&&!state.tasks[id]){add(kind,{task:k});state.tasks[id]=1;}
  });});
  if(a.daily&&/^\d{4}-\d{2}-\d{2}$/.test(a.daily.date))(a.daily.list||[]).forEach(function(t){var id=a.daily.date+':'+(t&&t.id);if(t&&t.c&&!state.daily[id]){add('daily',{task:t.id});state.daily[id]=1;}});
  var days=Object.keys(state.daily).map(function(k){return k.slice(0,10);}).sort(),oldest=days[Math.max(0,days.length-70)]||'';
  Object.keys(state.daily).forEach(function(k){if(k.slice(0,10)<oldest)delete state.daily[k];});
  u.activityState=state;return out;
}
function read(dir){try{var x=JSON.parse(fs.readFileSync(path.join(dir,'activity.json'),'utf8'));return Array.isArray(x)?x:[];}catch(e){return [];}}
function publish(dir,events){if(!events.length)return;var rows=events.slice().reverse().concat(read(dir)).slice(0,KEEP),f=path.join(dir,'activity.json');fs.writeFileSync(f+'.tmp',JSON.stringify(rows));fs.renameSync(f+'.tmp',f);}
function page(dir,before,limit){var rows=read(dir),start=before?rows.findIndex(function(e){return e.id===before;})+1:0;if(before&&!start)return{items:[],next:null};var items=rows.slice(start,start+limit);return{items:items,next:start+items.length<rows.length&&items.length?items[items.length-1].id:null};}
module.exports={prepare:prepare,publish:publish,page:page,KEEP:KEEP};
