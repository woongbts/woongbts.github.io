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
      const planId=params.get('pp');
      const providerId=params.get('pprov');
      // Keep both selects consistent: the catalog and other tab handlers may
      // populate/reset their values shortly after the deep-link runs.
      let tries=0, stable=0, userChanged=false;
      const provider=document.getElementById('prepaid-provider');
      const plan=document.getElementById('prepaid-plan');
      if(!provider||!plan)return;
      const stopOnManualChange=e=>{if(e.isTrusted)userChanged=true;};
      provider.addEventListener('change',stopOnManualChange);
      plan.addEventListener('change',stopOnManualChange);
      const reconcile=()=>{
        if(userChanged||++tries>240){
          clearInterval(timer);
          provider.removeEventListener('change',stopOnManualChange);
          plan.removeEventListener('change',stopOnManualChange);
          return;
        }
        const providerReady=!providerId||[...provider.options].some(o=>o.value===providerId);
        if(!providerReady)return;
        if(providerId&&provider.value!==providerId)setSelect('prepaid-provider',providerId);
        const planReady=[...plan.options].some(o=>o.value===planId);
        if(planReady&&plan.value!==planId)setSelect('prepaid-plan',planId);
        if(providerReady&&planReady&&(!providerId||provider.value===providerId)&&plan.value===planId)stable++;
        else stable=0;
        if(stable>=8){
          clearInterval(timer);
          provider.removeEventListener('change',stopOnManualChange);
          plan.removeEventListener('change',stopOnManualChange);
          // Home prepaid picks should land on the selected plan, not above the recommendation cards.
          if(/^home-easy-(light|data|unlimited)$/.test(params.get('src')||'')){
            requestAnimationFrame(()=>document.getElementById('prepaid-form')?.scrollIntoView({behavior:'auto',block:'start'}));
          }
        }
      };
      const timer=setInterval(reconcile,180);
      reconcile();
    }
  }
  function restoreMobilePurpose(){
    if(requested!=='mobile')return;
    const purpose=params.get('purpose');
    if(!['senior','kids','value','premium'].includes(purpose))return;
    const apply=()=>{
      const mode=document.querySelector('[data-mobile-mode="purpose"]');
      const target=document.querySelector('[data-purpose-category="'+purpose+'"]');
      const section=document.getElementById('purpose-recommend');
      if(!mode||!target||!section)return false;
      if(!mode.classList.contains('active')||section.hidden)mode.click();
      if(!target.classList.contains('active'))target.click();
      if(mode.classList.contains('active')&&target.classList.contains('active')&&!section.hidden){
        section.scrollIntoView({behavior:'instant',block:'start'});
        return true;
      }
      return false;
    };
    // Some calculator modules finish binding after data arrives. Retry until
    // the requested category is genuinely visible, never just change labels.
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(apply()||attempts>=60)clearInterval(timer);
    },250);
    setTimeout(apply,60);
  }
  function restoreMobileDirect(){
    if(requested!=='mobile'||params.get('purpose')||params.get('mode')!=='direct')return;
    const brand=params.get('brand');
    const requestedDevice=params.get('d'),requestedPlan=params.get('p');
    waitFor(()=>document.querySelector('[data-mobile-mode="direct"]'),mode=>{
      if(!mode.classList.contains('active'))mode.click();
      // The calculator's own deep-link handler already restores the device and
      // plan when data is ready. Clicking a brand tab *afterwards* would redraw
      // the device picker and clear both values, leaving the quote as "—".
      // Reconcile the exact selected device/plan without resetting the brand.
      if(requestedDevice&&requestedPlan){
        const restoreQuote=()=>{
          const device=document.getElementById('device-select');
          const plan=document.getElementById('plan-select');
          if(!device||!plan)return false;
          const carrier=params.get('c'),join=params.get('j');
          if(['SKT','KT','LGU+'].includes(carrier)){
            const select=document.getElementById('carrier');
            if(select&&select.value!==carrier)setSelect('carrier',carrier);
          }
          if(['번호이동','기기변경','신규가입'].includes(join)){
            const select=document.getElementById('join-type');
            if(select&&select.value!==join)setSelect('join-type',join);
          }
          if(![...device.options].some(option=>option.value===requestedDevice))return false;
          if(device.value!==requestedDevice)setSelect('device-select',requestedDevice);
          if(![...plan.options].some(option=>option.value===requestedPlan))return false;
          if(plan.value!==requestedPlan)setSelect('plan-select',requestedPlan);
          const method=params.get('m'),months=params.get('mo'),welfare=params.get('w');
          if(['support','contract'].includes(method)&&document.getElementById('discount-method')?.value!==method)
            setSelect('discount-method',method);
          if(months&&document.getElementById('installment-months')?.value!==months)
            setSelect('installment-months',months);
          if(welfare&&document.getElementById('welfare-type')?.value!==welfare)
            setSelect('welfare-type',welfare);
          return device.value===requestedDevice&&plan.value===requestedPlan;
        };
        waitFor(restoreQuote,()=>setTimeout(()=>document.getElementById('mobile-form')?.scrollIntoView({behavior:'auto',block:'start'}),100),120);
        return;
      }
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