(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  const requested=params.get('tab')||params.get('wbtab');
  const allowed=new Set(['mobile','studyphone','mvno','prepaid','internet']);
  if(!allowed.has(requested))return;

  function waitFor(test,done,tries=40){
    let count=0;
    const tick=()=>{
      let value=null;try{value=test()}catch{}
      if(value)return done(value);
      if(++count<tries)setTimeout(tick,150);
    };
    tick();
  }
  function setSelect(id,value){
    const el=document.getElementById(id);
    if(!el||!value||![...el.options].some(o=>o.value===value))return false;
    el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  function restoreSelection(){
    if(requested==='studyphone'&&params.get('sp')){
      waitFor(()=>setSelect('studyphone-plan',params.get('sp')),()=>{});
    }
    if(requested==='mvno'&&params.get('mp')){
      const provider=params.get('mprov');
      const selectPlan=()=>waitFor(()=>setSelect('mvno-plan',params.get('mp')),()=>{});
      if(provider)waitFor(()=>setSelect('mvno-provider',provider),()=>setTimeout(selectPlan,80));else selectPlan();
    }
    if(requested==='prepaid'&&params.get('pp')){
      const provider=params.get('pprov');
      const selectPlan=()=>waitFor(()=>setSelect('prepaid-plan',params.get('pp')),()=>{});
      if(provider)waitFor(()=>setSelect('prepaid-provider',provider),()=>setTimeout(selectPlan,80));else selectPlan();
    }
  }
  function restoreMobilePurpose(){
    if(requested!=='mobile')return;
    const purpose=params.get('purpose');
    if(!purpose)return;
    const allowedPurpose=new Set(['senior','kids','value','premium']);
    if(!allowedPurpose.has(purpose))return;
    waitFor(()=>document.querySelector('[data-mobile-mode="purpose"]'),mode=>{
      mode.click();
      setTimeout(()=>{
        const target=document.querySelector('[data-purpose-category="'+purpose+'"]');
        if(target){target.click();document.getElementById('purpose-recommend')?.scrollIntoView({behavior:'auto',block:'start'});}
      },120);
    });
  }
  function openRequestedTab(){
    const tab=document.querySelector('.rate-tab[data-tab="'+requested+'"]');
    const panel=document.querySelector('.rate-panel[data-panel="'+requested+'"]');
    if(!tab||!panel)return;
    tab.click();
    setTimeout(()=>{restoreSelection();restoreMobilePurpose();},120);
    if(requested!=='mobile')requestAnimationFrame(()=>panel.scrollIntoView({behavior:'auto',block:'start'}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',openRequestedTab,{once:true});
  else openRequestedTab();
})();