(() => {
  'use strict';
  let started=false;
  function load(src){
    return new Promise((resolve,reject)=>{
      if(document.querySelector('script[data-lazy-src="'+src+'"]')) return resolve();
      const s=document.createElement('script');
      s.src=src;s.defer=true;s.dataset.lazySrc=src;
      s.onload=resolve;s.onerror=reject;
      document.head.appendChild(s);
    });
  }
  function start(){
    if(started)return;started=true;
    Promise.allSettled([
      load('/assets/home-recommend-api.min.js?v=20261001-1'),
      load('/assets/ai-chat.min.js?v=20261002-1')
    ]);
  }
  ['pointerdown','touchstart','keydown'].forEach(type=>window.addEventListener(type,start,{once:true,passive:true}));
  if('requestIdleCallback' in window) requestIdleCallback(start,{timeout:2800});
  else setTimeout(start,2200);
})();