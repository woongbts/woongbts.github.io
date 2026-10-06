(() => {
  'use strict';
  const track=(type,detail={})=>{try{window.woongbiTrackConversion?.(type,detail)}catch{}};
  if(location.pathname==='/rates.html'){
    let started=false,lastMobile='',lastInternet='';
    const currentCategory=()=>{
      const active=document.querySelector('.rate-tab.active');
      return active?.dataset.tab||new URLSearchParams(location.search).get('wbtab')||new URLSearchParams(location.search).get('tab')||'mobile';
    };
    const start=event=>{
      if(started)return;
      if(!event.target.closest('.rate-content'))return;
      started=true;track('rate_calculator_start',{category:currentCategory()});
    };
    document.addEventListener('change',start,true);
    document.addEventListener('click',start,true);

    const mobile=document.getElementById('monthly-total');
    if(mobile)new MutationObserver(()=>{
      const v=(mobile.textContent||'').trim();
      if(v&&v!=='—'&&v!==lastMobile){lastMobile=v;track('mobile_quote_result_view',{category:'mobile'});}
    }).observe(mobile,{childList:true,subtree:true,characterData:true});

    const internet=document.getElementById('wired-compare-results');
    if(internet)new MutationObserver(()=>{
      const cards=internet.querySelectorAll('.wired-compare-card').length;
      const key=cards+'|'+(internet.textContent||'').slice(0,120);
      if(cards&&key!==lastInternet){lastInternet=key;track('internet_compare_view',{category:'internet',count:cards});}
    }).observe(internet,{childList:true,subtree:true,characterData:true});
  }
})();