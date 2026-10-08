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
    if(!['senior','kids','value','premium'].includes(purpose))return;
    waitFor(()=>document.querySelector('[data-mobile-mode="purpose"]'),mode=>{
      if(!mode.classList.contains('active'))mode.click();
      const apply=()=>{
        const target=document.querySelector('[data-purpose-category="'+purpose+'"]');
        if(!target)return false;
        if(!target.classList.contains('active'))target.click();
        const section=document.getElementById('purpose-recommend');
        if(section&&!section.hidden)section.scrollIntoView({behavior:'instant',block:'start'});
        return true;
      };
      // The calculator initializes asynchronously, so re-apply the requested
      // purpose after the first render rather than relying on a single click.
      setTimeout(apply,180);
      setTimeout(apply,700);
      waitFor(()=>document.querySelector('[data-purpose-category="'+purpose+'"]'),apply,60);
    });
  }
  function restoreMobileDirect(){
    if(requested!=='mobile'||params.get('purpose')||params.get('mode')!=='direct')return;
    const brand=params.get('brand');
    waitFor(()=>document.querySelector('[data-mobile-mode="direct"]'),mode=>{
      mode.click();
      if(['apple','samsung','other','all'].includes(brand)){
        const applyBrand=()=>{
          document.querySelector('[data-device-brand="'+brand+'"]')?.click();
          document.querySelector('[data-device-browser-brand="'+brand+'"]')?.click();
        };
        applyBrand();
        waitFor(()=>document.getElementById('device-browser')?.dataset.state==='ready',applyBrand,60);
      }
      setTimeout(()=>document.getElementById('device-browser')?.scrollIntoView({behavior:'auto',block:'start'}),120);
    });
  }
  function restoreInternetQuick(){
    if(requested!=='internet')return;
    const speed=params.get('qs'),tv=params.get('qt');
    if(!['100','500','1000'].includes(speed)&&!['none','basic'].includes(tv))return;
    const apply=()=>{
      if(['100','500','1000'].includes(speed))setSelect('wired-compare-speed',speed);
      if(['none','basic'].includes(tv))setSelect('wired-compare-tv',tv);
    };
    setTimeout(apply,140);
    waitFor(()=>document.querySelector('.wired-compare-card'),apply,60);
  }
  function showQuickJourney(){
    const src=params.get('src')||'';
    if(!/^home-easy(?:-|$)/.test(src))return;
    const helper=document.getElementById('rate-easy-flow');
    if(helper)helper.hidden=false;
  }
  function openRequestedTab(){
    const tab=document.querySelector('.rate-tab[data-tab="'+requested+'"]');
    const panel=document.querySelector('.rate-panel[data-panel="'+requested+'"]');
    if(!tab||!panel)return;
    showQuickJourney();
    tab.click();
    setTimeout(()=>{restoreSelection();restoreMobilePurpose();restoreMobileDirect();restoreInternetQuick();},120);
    if(requested!=='mobile')requestAnimationFrame(()=>panel.scrollIntoView({behavior:'auto',block:'start'}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',openRequestedTab,{once:true});
  else openRequestedTab();
})();