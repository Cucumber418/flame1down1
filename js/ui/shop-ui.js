/* 商城/兑换统一陈列与详情：拖动数量条，报价与提交都重新读取存档 */
var HSSHOP = (function () {
  'use strict';
  var MAP = [
    ['buy','shop','.shop-it'],['tkbuy','token','.tk-it'],['twbuy','tower','.tw-item'],
    ['xmas-buy','christmas','.xmas-good'],['sdbuy','seed','.shop-it'],['smelt','forge','.shop-it'],
    ['gxgo','gx','.gx-card'],['sumbuy','summon','.shop-it'],['bbuy','base','.bs-room,.shop-it'],
    ['tsbuy','tea','.shop-it'],['spabuy','spa','.spa-good'],['spabgmbuy','spaBgm',null],
    ['enbuy','endless','.en-sh'],['orebuy','ore','.shop-it']
  ];
  var selector = MAP.map(function (x) { return '[data-'+x[0]+']'; }).join(','), active = null;
  function esc(s) { return HSUI.esc(String(s == null ? '' : s)); }
  function costIcon(k) { if (k === 'tokens') return '<span class="tk-coin shop-currency-icon" aria-hidden="true">代</span>'; return k === 'energy' || window.HSACC && HSACC.itemName(k) !== k ? HSUI.itemIcon(k) : ''; }
  function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }
  function total(c,n) { return c.steps ? c.steps.slice(0,n).reduce(function(s,x){return s+x;},0) : c.unit*n; }
  function max(o) {
    var n=Math.max(0,Math.floor(o.limit || 0));
    (o.costs || []).forEach(function(c){
      if(c.steps){var sum=0,afford=0;for(var i=0;i<c.steps.length;i++){sum+=c.steps[i];if(sum>c.have)break;afford++;}n=Math.min(n,afford);}
      else if(c.unit>0)n=Math.min(n,Math.floor(c.have/c.unit));
    });
    return n;
  }
  function offer(kind,key,s) { return window.HSACC && HSACC.shopOffer ? HSACC.shopOffer(kind,key,s) : null; }
  function decorate(root) {
    if (!root || !root.querySelectorAll || !window.HSACC || !HSACC.shopOffer) return;
    var buttons=[].slice.call(root.querySelectorAll(selector));if(root.matches&&root.matches(selector))buttons.unshift(root);
    buttons.forEach(function(b){
      if(!b.isConnected || b.closest('#shop-detail'))return;
      var m=MAP.find(function(x){return b.hasAttribute('data-'+x[0]);}),key=b.getAttribute('data-'+m[0]),o=offer(m[1],key,{});if(!o)return;
      var card=m[2]?b.closest(m[2]):null;
      if(!card){card=document.createElement('span');b.replaceWith(card);}
      card.className+=' shop-display-tile';
      card.innerHTML='<button type="button" class="shop-product" data-shop-product="'+esc(m[1])+'" data-shop-key="'+esc(key)+'" aria-haspopup="dialog"><span class="shop-product-icon">'+o.icon+'</span><b>'+esc(o.name)+'</b></button>';
      if(card.parentElement)card.parentElement.classList.add('shop-display-grid');
    });
  }
  function close() {
    if(!active || active.busy)return;
    var a=active;active=null;a.el.remove();
    requestAnimationFrame(function(){var b=[].find.call(document.querySelectorAll('[data-shop-product]'),function(b){return b.dataset.shopProduct===a.kind&&b.dataset.shopKey===a.key&&b.getClientRects().length;});if(b)b.focus({preventScroll:true});});
  }
  function open(kind,key) {
    if(active)return;
    var first=offer(kind,key,{});if(!first)return;
    var d=document.createElement('div');d.className='soc-dlg shop-detail-layer';d.id='shop-detail';
    active={el:d,kind:kind,key:key,selection:{},n:1,busy:false};document.body.appendChild(d);
    function read(){return offer(kind,key,active.selection);}
    function update(message) {
      if(!active || active.el!==d)return;
      var o=read(),available=o?max(o):0,range=d.querySelector('[data-shop-range]');
      active.n=Math.max(1,Math.min(active.n,Math.max(1,available)));
      range.max=Math.max(1,available);range.value=active.n;range.disabled=available<1||active.busy;
      range.style.setProperty('--shop-fill',(available>1?(active.n-1)/(available-1)*100:0)+'%');range.setAttribute('aria-valuetext',active.n+'个，最多'+available+'个');
      d.querySelector('[data-shop-count]').textContent=fmt(active.n);d.querySelector('[data-shop-max]').textContent='最多 '+fmt(available);
      d.querySelector('[data-shop-maximum]').disabled=available<1||active.busy;
      d.querySelector('[data-shop-minimum]').disabled=active.busy;
      d.querySelector('[data-shop-costs]').innerHTML=(o?o.costs:[]).map(function(c){return '<li><span>'+costIcon(c.key)+esc(c.label)+'</span><b>'+fmt(total(c,active.n))+'</b><small>持有 '+fmt(c.have)+'</small></li>';}).join('');
      d.querySelector('[data-shop-output]').textContent=o&&o.give?'获得 '+Object.keys(o.give).map(function(k){return HSACC.itemName(k)+' ×'+fmt(o.give[k]*active.n);}).join('、'):'';
      d.querySelector('[data-shop-error]').textContent=message || (available<1?(o&&o.reason || '资源不足或已达兑换上限'):'');
      d.querySelector('[data-shop-confirm]').disabled=available<1||active.busy;
      d.querySelector('[data-shop-confirm]').textContent=active.busy?'兑换中…':'确认兑换';
      d.querySelector('[data-shop-close]').disabled=active.busy;
      d.querySelectorAll('select').forEach(function(el){el.disabled=active.busy;});
    }
    function draw() {
      var o=read();if(!o){close();return;}
      d.innerHTML='<section class="soc-box shop-detail-box" role="dialog" aria-modal="true" aria-labelledby="shop-detail-title"><header><span class="shop-detail-icon">'+o.icon+'</span><div><small>商品详情</small><h2 id="shop-detail-title">'+esc(o.name)+'</h2></div><button type="button" class="btn ghost" data-shop-close aria-label="关闭商品详情">×</button></header><div class="shop-detail-scroll"><p class="shop-description">'+esc(o.desc)+'</p>'+(o.owned!=null?'<p class="hint">持有 '+fmt(o.owned)+'</p>':'')+(o.note?'<p class="hint">'+esc(o.note)+'</p>':'')+(o.choices||[]).map(function(c){return '<label class="shop-choice">'+esc(c.label)+'<select data-shop-choice="'+esc(c.id)+'">'+c.values.map(function(v){return '<option value="'+esc(v.k)+'"'+(v.k===c.value?' selected':'')+'>'+esc(v.n)+'</option>';}).join('')+'</select></label>';}).join('')+'<div class="shop-quantity-head"><label for="shop-quantity">兑换数量</label><output id="shop-quantity-value" data-shop-count></output></div><input type="range" id="shop-quantity" data-shop-range min="1" max="1" value="1" step="1" aria-describedby="shop-range-hint"><div class="shop-range-ends"><button type="button" data-shop-minimum>1 个</button><button type="button" data-shop-maximum data-shop-max></button></div><p class="hint" id="shop-range-hint">拖到最右，兑换当前资源和限额允许的最大数量</p><ul class="shop-costs" data-shop-costs></ul><p class="shop-output" data-shop-output></p></div><footer><p class="hint red" data-shop-error role="status" aria-live="polite"></p><button type="button" class="btn primary" data-shop-confirm>确认兑换</button></footer></section>';
      update();
    }
    d.addEventListener('input',function(e){if(active.busy)return;if(e.target.matches('[data-shop-range]')){active.n=+e.target.value;update();}});
    d.addEventListener('change',function(e){if(active.busy)return;var id=e.target.dataset.shopChoice;if(id){active.selection[id]=e.target.value;active.n=1;draw();var sel=d.querySelector('[data-shop-choice="'+id+'"]');if(sel)sel.focus();}});
    d.addEventListener('click',function(e){
      if(!active||active.busy)return;
      if(e.target===d||e.target.closest('[data-shop-close]')){close();return;}
      if(e.target.closest('[data-shop-minimum]')){active.n=1;update();return;}
      if(e.target.closest('[data-shop-maximum]')){active.n=Math.max(1,max(read()));update();return;}
      if(!e.target.closest('[data-shop-confirm]'))return;
      var o=read(),n=active.n;if(!o||max(o)<1){update();return;}if(n>max(o)){update('资源或限额已改变，请确认数量');return;}
      active.busy=true;update();
      o.buy(n,function(){if(!active||active.el!==d)return;active.busy=false;close();if(o.after)o.after();HSACC.toast('兑换成功：'+o.name+' ×'+fmt(n));},function(err){if(!active||active.el!==d)return;active.busy=false;update(err || '兑换失败，请重试');});
    });
    draw();d.querySelector('[data-shop-close]').focus({preventScroll:true});
  }
  document.addEventListener('click',function(e){var b=e.target.closest('[data-shop-product]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open(b.dataset.shopProduct,b.dataset.shopKey);},true);
  document.addEventListener('keydown',function(e){if(!active)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}if(e.key!=='Tab')return;var all=[].filter.call(active.el.querySelectorAll('button,input,select'),function(e){return !e.disabled&&e.getClientRects().length;}),first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}},true);
  new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1&&!n.closest('#shop-detail'))decorate(n);});});}).observe(document.body,{childList:true,subtree:true});
  decorate(document.body);
  return {open:open,decorate:decorate,max:max,total:total};
})();
