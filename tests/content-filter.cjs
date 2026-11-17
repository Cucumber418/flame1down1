'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=require('../js/engine/content'),data=require('../js/data/content-words');
for(const text of ['傻逼','傻 逼','傻-逼','傻\u200b逼','傻\uFE0F逼','傻\u0000逼','傻屄','腦殘','習近平','习 近 平','习近平','六合彩','刷单返利','成人电影','ＦＵＣＫ','fuck you','f.u.c.k you','shit happens'])assert(C.match(text),text);
for(const text of ['',null,'网络正常，联系客服一起玩','免费使用我的基地','classical','shitake','叶粒种子','朔望月灵','奥多亚克','花剑圆弧','网络卡了，我要切换精灵','这个技能是毒属性吗'])assert.equal(C.match(text),null,String(text));
assert.equal(C.match('习近平').category,'politics');assert(C.error('傻逼','名字').startsWith('名字'));assert(!C.error('傻逼').includes('傻逼'));
let old={name:'老玩家',home:{name:'基地'},card:{motto:'你好'},mons:[{u:1,nickname:'小叶'}],tNames:['一队']};
for(const mutate of [a=>a.name='傻逼',a=>a.home.name='习近平',a=>a.card.motto='刷单返利',a=>a.tNames[0]='成人电影',a=>a.mons[0].nickname='傻逼',a=>a.mons.push({u:2,nickname:'习近平'})]){let a=structuredClone(old);mutate(a);assert(C.accountError(a,old));}
let legacy={...old,name:'傻逼'};assert.equal(C.accountError({...legacy,energy:10},legacy),'');assert.equal(C.accountError({...legacy,name:'新名字'},legacy),'');
const encode=a=>({'hs-account-v1':JSON.stringify(a)});assert(C.saveError(encode({...old,name:'习近平'}),encode(old)));assert.equal(C.saveError(encode(old),encode(old)),'');
assert(C.requestError('/api/register',{user:'傻逼',pass:'clean-password'}));assert.equal(C.requestError('/api/login',{user:'傻逼',pass:'习近平'}),'');assert.equal(C.requestError('/api/password',{pass:'傻逼习近平password'}),'');
for(const url of ['/api/board','/api/dm','/api/home-msg','/api/boss-post'])assert(C.requestError(url,{text:'傻逼'}));
const manifest=require('../data/content-filter/manifest.json'),all=fs.readFileSync(path.join(root,'data/content-filter/all.txt'));
assert.equal(crypto.createHash('sha256').update(all).digest('hex'),manifest.sha256);assert.equal(new Set(all.toString().trim().split('\n')).size,manifest.uniqueWords);
for(const k in data.categories)assert.equal(data.categories[k].length,manifest.categories[k]);
const ctx=vm.createContext({console,window:{},atob:b=>Buffer.from(b,'base64').toString('binary'),TextDecoder});
fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/'(js\/(?:data|engine)\/[^']+\.js)'/g,(_,f)=>{vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});return _;});
assert.equal(ctx.CONTENT.version,C.version);
for(const species of Object.values(ctx.SPMAP)){assert.equal(C.match(species.name),null,species.name);for(const f of species.evo||[])if(f.n)assert.equal(C.match(f.n.replace(/\?$/,'')),null,f.n);}
const a={mons:[],teams:[[]],active:0,next:1,items:{nameTag:1}},env={now:Date.now(),rand:()=>0},m=ctx.ACC.newMon(a,'leaf',5,env);
assert.equal(ctx.TX.run(a,'mitem',{u:m.u,k:'nameTag'},env).ok,true);let before=JSON.stringify(a);
assert.equal(ctx.TX.run(a,'monRename',{u:m.u,name:'习近平'},env).ok,false);assert.equal(JSON.stringify(a),before);assert.equal(ctx.TX.run(a,'monRename',{u:m.u,name:'小叶'},env).ok,true);
console.log('PASS content rules: categories, Unicode and separated variants, ASCII boundaries, game names, changed fields, legacy saves, passwords, shared loading, wordlist integrity and rename atomicity');
