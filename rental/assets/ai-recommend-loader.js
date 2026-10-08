(() => {
  'use strict';
  let promise=null;
  function load(){
    if(promise)return promise;
    promise=new Promise((resolve,reject)=>{
      if(window.woongbiRentalAiLoaded)return resolve();
      const s=document.createElement('script');
      s.src='assets/ai-recommend.js?v=20261008-preference2';
      s.defer=true;
      s.onload=()=>{window.woongbiRentalAiLoaded=true;resolve();};
      s.onerror=reject;
      document.head.appendChild(s);
    });
    return promise;
  }
  document.querySelectorAll('[data-ai-recommend-open]').forEach(btn=>{
    btn.addEventListener('pointerenter',()=>{load().catch(()=>{});},{once:true,passive:true});
    btn.addEventListener('focus',()=>{load().catch(()=>{});},{once:true});
    btn.addEventListener('click',async event=>{
      if(window.woongbiRentalAiLoaded)return;
      event.preventDefault();event.stopImmediatePropagation();
      try{await load();setTimeout(()=>btn.click(),0);}catch(_){}
    },{capture:true});
  });
  if(new URLSearchParams(location.search).get('ai')==='1'){
    load().catch(()=>{});
  }
})();