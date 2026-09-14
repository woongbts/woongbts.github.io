(function(){
  const won=n=>Number.isFinite(Number(n))?Math.max(0,Math.round(Number(n))).toLocaleString('ko-KR')+'원':'—';
  const bySourceOrder=(a,b)=>{
    const ao=Number(a?.source_order),bo=Number(b?.source_order);
    if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;
    if(Number.isFinite(ao))return -1;if(Number.isFinite(bo))return 1;
    return String(b?.release_date||'').localeCompare(String(a?.release_date||''));
  };
  let catalog=null;

  document.querySelectorAll('.rate-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x===tab));
    document.querySelectorAll('.rate-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===tab.dataset.tab));
  }));

  const $=id=>document.getElementById(id);
  const carrier=$('carrier'),joinType=$('join-type'),deviceSelect=$('device-select'),planSelect=$('plan-select'),monthsSelect=$('installment-months'),welfareEnabled=$('welfare-enabled');

  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)}
  function clearSelect(select,placeholder){select.innerHTML='';option(select,'',placeholder)}
  function currentDevice(){return (catalog?.devices||[]).find(d=>d.id===deviceSelect.value)||null}
  function currentPlan(){return (catalog?.mobile_plans||[]).find(p=>p.id===planSelect.value)||null}
  function currentSupport(){
    const d=currentDevice(),p=currentPlan();if(!d||!p)return null;
    return (catalog?.mobile_supports||[]).find(s=>s.device_id===d.id&&s.plan_id===p.id&&s.join_type===joinType.value)||null;
  }
  function currentWelfare(){
    const p=currentPlan();if(!p)return null;
    return (catalog?.welfare_discounts||[]).find(w=>w.carrier===carrier.value&&w.plan_id===p.id)||null;
  }

  function fillDevices(){
    const keep=deviceSelect.value;
    clearSelect(deviceSelect,'기종을 선택하세요');
    (catalog?.devices||[]).filter(d=>d.carrier===carrier.value).sort(bySourceOrder).forEach(d=>option(deviceSelect,d.id,d.model?`${d.name} · ${d.model}`:d.name));
    if([...deviceSelect.options].some(o=>o.value===keep))deviceSelect.value=keep;
    else deviceSelect.value='';
    fillPlans();
  }

  function fillPlans(){
    const d=currentDevice();
    const keep=planSelect.value;
    clearSelect(planSelect,d?'가능한 요금제를 선택하세요':'기종을 먼저 선택하세요');
    planSelect.disabled=!d;
    if(!d){syncMobile();return}
    const supportRows=(catalog?.mobile_supports||[]).filter(s=>s.device_id===d.id&&s.join_type===joinType.value);
    const ids=[...new Set(supportRows.map(s=>s.plan_id))];
    (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&ids.includes(p.id)).sort(bySourceOrder).forEach(p=>option(planSelect,p.id,`${p.name} · ${won(p.monthly_fee)}`));
    if([...planSelect.options].some(o=>o.value===keep))planSelect.value=keep;
    else planSelect.value='';
    fillInstallments();syncMobile();
  }

  function fillInstallments(){
    const d=currentDevice();
    const values=Array.isArray(d?.installment_months)&&d.installment_months.length?d.installment_months:[24,30,36];
    const keep=monthsSelect.value;
    monthsSelect.innerHTML='';
    values.forEach(m=>option(monthsSelect,String(m),`${m}개월`));
    monthsSelect.disabled=!d;
    if(values.map(String).includes(keep))monthsSelect.value=keep;
  }

  function syncMobile(){
    const d=currentDevice(),p=currentPlan(),s=currentSupport();
    $('device-price-view').textContent=d&&Number.isFinite(Number(d.retail_price))?won(d.retail_price):'—';
    $('plan-fee-view').textContent=p&&Number.isFinite(Number(p.monthly_fee))?won(p.monthly_fee):'—';
    $('public-support-view').textContent=s&&Number.isFinite(Number(s.public_support))?won(s.public_support):'—';
    const dataNote=$('mobile-data-note');
    if(!(catalog?.devices||[]).length){dataNote.textContent='아직 실제 상품 데이터가 등록되지 않았습니다. 확인된 제로노트 기준값을 넣으면 이 화면이 자동으로 동작합니다.'}
    else if(d&&!p){dataNote.textContent='이 기종과 가입유형에서 가능한 요금제를 선택하세요.'}
    else if(d&&p&&!s){dataNote.textContent='해당 조합의 공시지원금 데이터가 아직 등록되지 않았습니다.'}
    else{dataNote.textContent='공시지원금과 월정액은 선택한 조건에 맞춰 자동 반영됩니다.'}

    if(!d||!p||!s){
      $('principal').textContent='—';$('device-monthly').textContent='—';$('service-monthly').textContent='—';$('monthly-total').textContent='—';$('welfare-view').textContent=welfareEnabled.value==='yes'?'확인 필요':'미적용';
      $('calc-summary').textContent='통신사, 가입유형, 기종, 요금제를 선택하면 자동으로 계산됩니다.';return;
    }

    const price=Number(d.retail_price)||0,support=Number(s.public_support)||0,months=Number(monthsSelect.value)||24,planFee=Number(p.monthly_fee)||0;
    const principal=Math.max(0,price-support),deviceMonthly=principal/months;
    let welfare=0,welfareText='미적용';
    if(welfareEnabled.value==='yes'){
      const w=currentWelfare();
      if(w&&Number.isFinite(Number(w.monthly_discount))){welfare=Math.max(0,Number(w.monthly_discount));welfareText='-'+won(welfare)}
      else welfareText='매장 확인';
    }
    const service=Math.max(0,planFee-welfare),total=deviceMonthly+service;
    $('principal').textContent=won(principal);$('device-monthly').textContent=won(deviceMonthly);$('service-monthly').textContent=won(service);$('monthly-total').textContent=won(total);$('welfare-view').textContent=welfareText;
    $('calc-summary').textContent=`${carrier.value} · ${d.name} · ${joinType.value} · ${p.name} · ${months}개월 기준 예상치입니다.`;
  }

  [carrier,joinType].forEach(el=>el.addEventListener('change',fillDevices));
  deviceSelect.addEventListener('change',fillPlans);
  planSelect.addEventListener('change',syncMobile);
  monthsSelect.addEventListener('change',syncMobile);
  welfareEnabled.addEventListener('change',syncMobile);

  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan');
  function fillMvnoProviders(){
    clearSelect(mvnoProvider,'통신사를 선택하세요');
    const providers=[...new Set((catalog?.mvno_plans||[]).map(p=>p.provider).filter(Boolean))];
    providers.forEach(p=>option(mvnoProvider,p,p));
    fillMvnoPlans();
  }
  function fillMvnoPlans(){
    clearSelect(mvnoPlan,mvnoProvider.value?'요금제를 선택하세요':'통신사를 먼저 선택하세요');
    mvnoPlan.disabled=!mvnoProvider.value;
    (catalog?.mvno_plans||[]).filter(p=>p.provider===mvnoProvider.value).sort(bySourceOrder).forEach(p=>option(mvnoPlan,p.id,`${p.name} · ${won(p.promo_monthly_fee??p.monthly_fee)}`));
    syncMvno();
  }
  function syncMvno(){
    const p=(catalog?.mvno_plans||[]).find(x=>x.id===mvnoPlan.value)||null;
    if(!p){$('mvno-fee-view').textContent='—';$('mvno-total').textContent='—';$('mvno-detail').textContent='알뜰폰은 복지할인을 적용하지 않습니다.';$('mvno-summary').textContent='통신사와 요금제를 선택하면 자동으로 반영됩니다.';return}
    const current=Number(p.promo_monthly_fee??p.monthly_fee)||0;
    $('mvno-fee-view').textContent=won(current);$('mvno-total').textContent=won(current);
    const bits=[];if(p.network)bits.push(`${p.network}망`);if(p.data)bits.push(`데이터 ${p.data}`);if(p.voice)bits.push(`통화 ${p.voice}`);if(p.promo_months)bits.push(`${p.promo_months}개월 프로모션`);if(p.regular_monthly_fee!=null)bits.push(`이후 ${won(p.regular_monthly_fee)}`);
    $('mvno-detail').textContent=(bits.length?bits.join(' · ')+' · ':'')+'복지할인 미적용';
    $('mvno-summary').textContent=`${p.provider} · ${p.name} 기준 현재 월요금입니다.`;
  }
  mvnoProvider.addEventListener('change',fillMvnoPlans);mvnoPlan.addEventListener('change',syncMvno);

  const internetCarrier=$('internet-carrier'),internetProduct=$('internet-product');
  function fillInternet(){
    clearSelect(internetProduct,'상품을 선택하세요');
    (catalog?.internet_products||[]).filter(p=>p.carrier===internetCarrier.value).sort(bySourceOrder).forEach(p=>option(internetProduct,p.id,p.name));
    syncInternet();
  }
  function syncInternet(){
    const p=(catalog?.internet_products||[]).find(x=>x.id===internetProduct.value)||null;
    if(!p){$('internet-fee-view').textContent='—';$('tv-fee-view').textContent='—';$('internet-total').textContent='—';$('internet-summary').textContent='상품을 선택하면 기본 월정액이 자동으로 반영됩니다.';return}
    const i=Number(p.internet_fee)||0,t=Number(p.tv_fee)||0;
    $('internet-fee-view').textContent=won(i);$('tv-fee-view').textContent=won(t);$('internet-total').textContent=won(i+t);
    $('internet-summary').textContent=`${p.carrier} · ${p.name} 기본 월정액 기준입니다.${p.notes?' '+p.notes:''}`;
  }
  internetCarrier.addEventListener('change',fillInternet);internetProduct.addEventListener('change',syncInternet);

  fetch('data/catalog.json?v=20260915-4').then(r=>r.json()).then(data=>{
    catalog=data;
    const meta=data?.meta||{};$('catalog-updated').textContent=meta.updated_at?`상품 데이터 ${meta.updated_at} 기준`:'제로노트 기준 데이터 입력 준비 중';
    fillDevices();fillMvnoProviders();fillInternet();
  }).catch(()=>{$('mobile-data-note').textContent='상품 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'});
})();
