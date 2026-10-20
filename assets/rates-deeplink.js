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
      const requestedPlanId=params.get('pp');
      const provider=document.getElementById('prepaid-provider');
      const plan=document.getElementById('prepaid-plan');
      if(!provider||!plan)return;
      // This must work even if the large phone catalog or its UI handler never finishes.
      const fallbackCatalog={
        providers:[{id:'FREETLG',name:'프리티(LGU+망)',network:'LGU+'}],
        plans:[
          {id:'PRE-FREETLG-1521',provider_id:'FREETLG',name:'선불데이터300MB+1Mbps',network:'LGU+',monthly_fee:29700,data:'300MB+1Mbps 무제한',voice:'무제한',sms:'무제한'},
          {id:'PRE-FREETLG-1879',provider_id:'FREETLG',name:'선불 데이터 10.3G',network:'LGU+',monthly_fee:38300,data:'10.3GB+3Mbps 무제한',voice:'무제한',sms:'문자무제한'},
          {id:'PRE-FREETLG-1523',provider_id:'FREETLG',name:'선불 데이터안심 11G',network:'LGU+',monthly_fee:55000,data:'11GB+일 2GB+3Mbps 무제한',voice:'무제한',sms:'무제한'}
        ]
      };
      let catalog=fallbackCatalog;
      let fromLiveCatalog=false,manualChange=false,focusDone=false,ticks=0;
      const getById=id=>document.getElementById(id);
      const hasOption=(select,value)=>[...select.options].some(option=>option.value===value);
      const currency=amount=>Number(amount).toLocaleString('ko-KR')+'원';
      const notifyChange=element=>element.dispatchEvent(new Event('change',{bubbles:true}));
      const onUserChange=event=>{if(event.isTrusted)manualChange=true;};
      provider.addEventListener('change',onUserChange);
      plan.addEventListener('change',onUserChange);
      function restorePrepaid(){
        if(manualChange)return false;
        const chosen=catalog.plans.find(item=>item.id===requestedPlanId);
        if(!chosen)return false;
        const providerId=chosen.provider_id||params.get('pprov')||'FREETLG';
        const company=catalog.providers.find(item=>item.id===providerId);
        // Populate missing providers independently of the main calculator's loader.
        if(!hasOption(provider,providerId)){
          for(const item of catalog.providers){
            if(!hasOption(provider,item.id))provider.add(new Option(item.name,item.id));
          }
        }
        if(!hasOption(provider,providerId))return false;
        if(provider.value!==providerId){provider.value=providerId;notifyChange(provider);}
        // Provider change callbacks can clear the plan select before data is ready.
        const list=catalog.plans.filter(item=>item.provider_id===providerId);
        if(!hasOption(plan,requestedPlanId)){
          plan.replaceChildren(new Option('요금제를 선택하세요',''));
          list.forEach(item=>plan.add(new Option(item.name+' · '+currency(item.monthly_fee),item.id)));
        }
        plan.disabled=false;
        if(!hasOption(plan,requestedPlanId))return false;
        if(plan.value!==requestedPlanId){plan.value=requestedPlanId;notifyChange(plan);}
        if(plan.value!==requestedPlanId||provider.value!==providerId)return false;
        // A secondary safety net if rates.min.js has not registered its handlers.
        const setText=(id,value)=>{
          const node=getById(id);
          if(node&&node.textContent!==value)node.textContent=value;
        };
        setText('prepaid-network',chosen.network||company?.network||'LGU+');
        setText('prepaid-fee-view',currency(chosen.monthly_fee));
        setText('prepaid-total',currency(chosen.monthly_fee));
        setText('prepaid-summary',(company?.name||'프리티(LGU+망)')+' · '+chosen.name+' · 월 '+currency(chosen.monthly_fee)+' 기준입니다.');
        setText('prepaid-detail','데이터 '+chosen.data+' · 통화 '+chosen.voice+' · 문자 '+chosen.sms+'. 충전·유심·개통 조건은 매장에서 최종 확인합니다.'+
          (fromLiveCatalog?'':' (마지막 등록 요금 기준)'));
        if(!focusDone&&/^home-easy-(light|data|unlimited)$/.test(params.get('src')||'')){
          focusDone=true;
          requestAnimationFrame(()=>getById('prepaid-form')?.scrollIntoView({behavior:'auto',block:'start'}));
        }
        return true;
      }
      // Display the linked choice immediately, then replace the fallback with the live catalog.
      restorePrepaid();
      fetch('/data/prepaid.json?v=20261020-prepaid-direct4',{cache:'no-store'})
        .then(response=>{if(!response.ok)throw Error('prepaid-catalog-'+response.status);return response.json();})
        .then(data=>{
          if(!Array.isArray(data.providers)||!Array.isArray(data.plans))throw Error('invalid-prepaid-catalog');
          catalog=data;fromLiveCatalog=true;
          restorePrepaid();
        })
        .catch(()=>{
          const status=getById('prepaid-quote-status');
          if(status)status.textContent='선불폰 요금 데이터 갱신을 확인하지 못했습니다. 표시 금액은 매장에서 다시 확인해 주세요.';
        });
      // Other deferred scripts may reset the dropdowns much later. Repair only
      // the original deep-linked selection; stop as soon as a person changes it.
      const timer=setInterval(()=>{
        if(manualChange||++ticks>240){
          clearInterval(timer);
          provider.removeEventListener('change',onUserChange);
          plan.removeEventListener('change',onUserChange);
          return;
        }
        restorePrepaid();
      },250);
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