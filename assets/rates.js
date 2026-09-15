(function(){
  const won=n=>Number.isFinite(Number(n))?Math.max(0,Math.round(Number(n))).toLocaleString('ko-KR')+'원':'—';
  const $=id=>document.getElementById(id);
  const INSTALLMENT_APR=.059;
  const DEFAULT_CONTRACT_RATE=.25;
  let catalog=null;
  let contractRate=DEFAULT_CONTRACT_RATE;
  let supportSchedules=[];
  let mvnoData={providers:[],plans:[]};
  let prepaidData={providers:[],plans:[]};
  let internetData={providers:[],products:[],bundle_rules:[]};

  const byNewest=(a,b)=>{
    const ao=Number(a?.source_order),bo=Number(b?.source_order);
    if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;
    const ad=String(a?.release_date||''),bd=String(b?.release_date||'');
    if(ad&&bd&&ad!==bd)return bd.localeCompare(ad);
    return String(a?.name||'').localeCompare(String(b?.name||''),'ko');
  };
  const byOrder=(a,b)=>{
    const ao=Number(a?.source_order),bo=Number(b?.source_order);
    if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;
    return String(a?.name||'').localeCompare(String(b?.name||''),'ko');
  };
  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)}
  function clearSelect(select,placeholder){select.innerHTML='';option(select,'',placeholder)}
  function setUpdated(id,date){const el=$(id);if(el)el.textContent=date?`상품 데이터 ${date} 기준`:'상품 데이터 확인 중'}

  document.querySelectorAll('.rate-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x===tab));
    document.querySelectorAll('.rate-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===tab.dataset.tab));
  }));

  // 휴대폰
  const carrier=$('carrier'),joinType=$('join-type'),discountMethod=$('discount-method');
  const deviceSelect=$('device-select'),planSelect=$('plan-select'),monthsSelect=$('installment-months'),welfareType=$('welfare-type');
  function currentDevice(){return (catalog?.devices||[]).find(d=>d.id===deviceSelect.value)||null}
  function currentPlan(){return (catalog?.mobile_plans||[]).find(p=>p.id===planSelect.value)||null}
  function currentSupport(){
    const d=currentDevice(),p=currentPlan();
    if(!d||!p)return null;
    const exact=(catalog?.mobile_supports||[]).find(s=>s.device_id===d.id&&s.plan_id===p.id&&s.join_type===joinType.value);
    if(exact&&Number.isFinite(Number(exact.public_support)))return exact;
    const rule=(supportSchedules||[]).find(r=>r.carrier===carrier.value&&Array.isArray(r.device_ids)&&r.device_ids.includes(d.id)&&Array.isArray(r.join_types)&&r.join_types.includes(joinType.value)&&r.amounts&&Number.isFinite(Number(r.amounts[p.id])));
    return rule?{device_id:d.id,join_type:joinType.value,plan_id:p.id,public_support:Number(rule.amounts[p.id])}:null;
  }
  function installment(principal,months){
    principal=Math.max(0,Number(principal)||0);months=Math.max(1,Number(months)||24);
    if(!principal)return {monthly:0,total:0,fee:0};
    const r=INSTALLMENT_APR/12,factor=Math.pow(1+r,months),monthly=principal*r*factor/(factor-1),total=monthly*months;
    return {monthly,total,fee:Math.max(0,total-principal)};
  }
  function welfareDiscount(type,fee){
    fee=Math.max(0,Number(fee)||0);
    if(type==='disabled_veteran')return {amount:fee*.35,label:'장애인·국가유공자'};
    if(type==='livelihood_medical')return {amount:Math.min(fee,28600),label:'생계·의료급여'};
    if(type==='housing_education_lowincome'){
      const eligible=Math.min(fee,45100),first=Math.min(eligible,12100),rest=Math.max(0,eligible-first);
      return {amount:Math.min(23650,first+rest*.35),label:'주거·교육급여·차상위'};
    }
    if(type==='basic_pension')return {amount:Math.min(12100,fee*.5),label:'기초연금'};
    return {amount:0,label:'미적용'};
  }
  function clearMobileResult(){
    ['principal','device-monthly','installment-fee','plan-discount-view','service-monthly','monthly-total'].forEach(id=>$(id).textContent='—');
    $('welfare-view').textContent=welfareType.value==='none'?'미적용':'선택됨';
  }
  function fillDevices(){
    const keep=deviceSelect.value;clearSelect(deviceSelect,'기종을 선택하세요');
    (catalog?.devices||[]).filter(d=>d.carrier===carrier.value).sort(byNewest).forEach(d=>option(deviceSelect,d.id,d.model?`${d.name} · ${d.model}`:d.name));
    deviceSelect.value=[...deviceSelect.options].some(o=>o.value===keep)?keep:'';fillPlans();
  }
  function eligiblePlans(){return currentDevice()?(catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value).sort(byOrder):[]}
  function fillPlans(){
    const d=currentDevice(),keep=planSelect.value;clearSelect(planSelect,d?'요금제를 선택하세요':'기종을 먼저 선택하세요');planSelect.disabled=!d;
    if(!d){fillInstallments();syncMobile();return}
    eligiblePlans().forEach(p=>option(planSelect,p.id,`${p.name} · ${won(p.monthly_fee)}${p.data?' · '+p.data:''}`));
    planSelect.value=[...planSelect.options].some(o=>o.value===keep)?keep:'';fillInstallments();syncMobile();
  }
  function fillInstallments(){
    const d=currentDevice(),values=Array.isArray(d?.installment_months)&&d.installment_months.length?d.installment_months:[24,30,36],keep=monthsSelect.value;
    monthsSelect.innerHTML='';values.forEach(m=>option(monthsSelect,String(m),`${m}개월`));monthsSelect.disabled=!d;if(values.map(String).includes(keep))monthsSelect.value=keep;
  }
  function syncMobile(){
    const d=currentDevice(),p=currentPlan(),s=currentSupport(),isContract=discountMethod.value==='contract';
    const hasPrice=d&&Number.isFinite(Number(d.retail_price))&&Number(d.retail_price)>0;
    $('device-price-view').textContent=hasPrice?won(d.retail_price):'매장 확인';
    $('plan-fee-view').textContent=p&&Number.isFinite(Number(p.monthly_fee))?won(p.monthly_fee):'—';
    $('discount-amount-label').textContent=isContract?'선택약정 월 할인':'공시지원금';
    $('principal-label').textContent=isContract?'단말 할부원금':'공시지원 반영 할부원금';
    $('plan-discount-label').textContent=isContract?'선택약정 할인':'요금 할인';
    $('extra-support-view').textContent='매장 문의';
    const planFee=Number(p?.monthly_fee)||0,contractDiscount=isContract&&p?planFee*contractRate:0;
    if(isContract){$('discount-amount-view').textContent=p?'-'+won(contractDiscount):'—';$('plan-discount-view').textContent=p?'-'+won(contractDiscount):'—'}
    else{$('discount-amount-view').textContent=s&&Number.isFinite(Number(s.public_support))?won(s.public_support):d&&p?'매장 확인':'—';$('plan-discount-view').textContent='미적용'}
    const note=$('mobile-data-note');
    if(!(catalog?.devices||[]).length)note.textContent='실제 상품 데이터가 아직 등록되지 않았습니다.';
    else if(d&&!hasPrice)note.textContent='이 기종의 현재 출고가는 매장에서 최신 금액을 확인해 주세요.';
    else if(d&&!p)note.textContent='요금제를 선택하세요.';
    else if(isContract&&d&&p)note.textContent='선택약정은 단말 지원금 대신 월 통신요금 25% 할인을 반영합니다.';
    else if(d&&p&&!s)note.textContent='이 가입유형·기종·요금제의 공시지원금은 매장에서 최신 금액을 확인해 주세요.';
    else note.textContent='현재 등록된 공시지원금을 선택한 조건에 맞춰 자동 반영했습니다.';
    if(!d||!p||!hasPrice){clearMobileResult();$('calc-summary').textContent=!hasPrice&&d?'출고가 확인 후 월 납부액을 계산할 수 있습니다.':'통신사, 가입유형, 할인방식, 기종, 요금제를 선택하면 자동으로 계산됩니다.';return}
    if(!isContract&&!s){
      clearMobileResult();$('plan-discount-view').textContent='미적용';const welfare=welfareDiscount(welfareType.value,planFee);
      $('welfare-view').textContent=welfare.amount?`${welfare.label} -${won(welfare.amount)}`:'미적용';$('service-monthly').textContent=won(Math.max(0,planFee-welfare.amount));
      $('calc-summary').textContent=`${carrier.value} · ${d.name} · ${joinType.value} · ${p.name}의 공시지원금은 매장 확인이 필요합니다. 통신요금은 선택 조건 기준으로 표시합니다.`;return;
    }
    const price=Number(d.retail_price),support=isContract?0:(Number(s?.public_support)||0),months=Number(monthsSelect.value)||24,principal=Math.max(0,price-support),inst=installment(principal,months);
    const afterContract=Math.max(0,planFee-contractDiscount),welfare=welfareDiscount(welfareType.value,afterContract),service=Math.max(0,afterContract-welfare.amount),total=inst.monthly+service;
    $('principal').textContent=won(principal);$('device-monthly').textContent=won(inst.monthly);$('installment-fee').textContent=won(inst.fee);$('service-monthly').textContent=won(service);$('monthly-total').textContent=won(total);
    $('welfare-view').textContent=welfare.amount?`${welfare.label} -${won(welfare.amount)}`:'미적용';
    $('calc-summary').textContent=`${carrier.value} · ${d.name} · ${joinType.value} · ${p.name} · ${isContract?'선택약정':'공시지원'} · ${months}개월 기준 예상치입니다.`;
  }
  [carrier,joinType].forEach(el=>el.addEventListener('change',fillDevices));discountMethod.addEventListener('change',fillPlans);deviceSelect.addEventListener('change',fillPlans);planSelect.addEventListener('change',syncMobile);monthsSelect.addEventListener('change',syncMobile);welfareType.addEventListener('change',syncMobile);

  // 알뜰폰 후불
  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan');
  function fillMvnoProviders(){
    clearSelect(mvnoProvider,'통신사를 선택하세요');
    (mvnoData.providers||[]).slice().sort(byOrder).forEach(p=>option(mvnoProvider,p.id,p.name));fillMvnoPlans();
  }
  function fillMvnoPlans(){
    const pid=mvnoProvider.value,provider=(mvnoData.providers||[]).find(p=>p.id===pid);clearSelect(mvnoPlan,pid?'요금제를 선택하세요':'통신사를 먼저 선택하세요');mvnoPlan.disabled=!pid;
    $('mvno-network').textContent=provider?.network||'—';
    const plans=(mvnoData.plans||[]).filter(p=>p.provider_id===pid).sort(byOrder);plans.forEach(p=>option(mvnoPlan,p.id,`${p.name} · ${won(p.special_monthly_fee??p.monthly_fee)}`));
    if(pid&&!plans.length){mvnoPlan.disabled=true;$('mvno-detail').textContent='현재 등록된 요금제 금액은 매장에서 확인해 주세요.'}syncMvno();
  }
  function syncMvno(){
    const p=(mvnoData.plans||[]).find(x=>x.id===mvnoPlan.value)||null,provider=(mvnoData.providers||[]).find(x=>x.id===mvnoProvider.value)||null;
    $('mvno-network').textContent=p?.network||provider?.network||'—';
    if(!p){$('mvno-fee-view').textContent='—';$('mvno-total').textContent='—';$('mvno-summary').textContent=mvnoProvider.value?'요금제 금액은 매장에서 확인해 주세요.':'통신사와 요금제를 선택하면 자동으로 반영됩니다.';return}
    const fee=Number(p.special_monthly_fee??p.monthly_fee)||0;$('mvno-fee-view').textContent=won(fee);$('mvno-total').textContent=won(fee);
    const bits=[];if(p.data)bits.push(`데이터 ${p.data}`);if(p.voice)bits.push(`통화 ${p.voice}`);if(p.sms)bits.push(`문자 ${p.sms}`);$('mvno-detail').textContent=(bits.length?bits.join(' · ')+' · ':'')+'복지할인 미적용';$('mvno-summary').textContent=`${provider?.name||p.provider_id} · ${p.name} 월 기본료입니다.`;
  }
  mvnoProvider.addEventListener('change',fillMvnoPlans);mvnoPlan.addEventListener('change',syncMvno);

  // 선불폰
  const prepaidProvider=$('prepaid-provider'),prepaidPlan=$('prepaid-plan');
  function fillPrepaidProviders(){
    clearSelect(prepaidProvider,'통신사를 선택하세요');(prepaidData.providers||[]).slice().sort(byOrder).forEach(p=>option(prepaidProvider,p.id,p.name));fillPrepaidPlans();
  }
  function fillPrepaidPlans(){
    const pid=prepaidProvider.value,provider=(prepaidData.providers||[]).find(p=>p.id===pid);clearSelect(prepaidPlan,pid?'요금제를 선택하세요':'통신사를 먼저 선택하세요');prepaidPlan.disabled=!pid;$('prepaid-network').textContent=provider?.network||'—';
    const plans=(prepaidData.plans||[]).filter(p=>p.provider_id===pid).sort(byOrder);plans.forEach(p=>option(prepaidPlan,p.id,`${p.name} · ${won(p.monthly_fee)}`));if(pid&&!plans.length){prepaidPlan.disabled=true;$('prepaid-detail').textContent='현재 등록된 선불 요금제 금액은 매장에서 확인해 주세요.'}syncPrepaid();
  }
  function syncPrepaid(){
    const p=(prepaidData.plans||[]).find(x=>x.id===prepaidPlan.value)||null,provider=(prepaidData.providers||[]).find(x=>x.id===prepaidProvider.value)||null;$('prepaid-network').textContent=p?.network||provider?.network||'—';
    if(!p){$('prepaid-fee-view').textContent='—';$('prepaid-total').textContent='—';$('prepaid-summary').textContent=prepaidProvider.value?'요금제 금액은 매장에서 확인해 주세요.':'통신사와 요금제를 선택하면 자동으로 반영됩니다.';return}
    const fee=Number(p.monthly_fee)||0;$('prepaid-fee-view').textContent=won(fee);$('prepaid-total').textContent=won(fee);const bits=[];if(p.data)bits.push(`데이터 ${p.data}`);if(p.voice)bits.push(`통화 ${p.voice}`);if(p.valid_days)bits.push(`${p.valid_days}일`);$('prepaid-detail').textContent=bits.join(' · ')||'선불 요금제';$('prepaid-summary').textContent=`${provider?.name||p.provider_id} · ${p.name} 월 이용료입니다.`;
  }
  prepaidProvider.addEventListener('change',fillPrepaidPlans);prepaidPlan.addEventListener('change',syncPrepaid);

  // 인터넷·TV
  const internetCarrier=$('internet-carrier'),internetProduct=$('internet-product'),internetBundle=$('internet-bundle');
  function fillInternetProviders(){
    clearSelect(internetCarrier,'통신사를 선택하세요');(internetData.providers||[]).slice().sort(byOrder).forEach(p=>option(internetCarrier,p.id,p.name));fillInternetProducts();
  }
  function fillInternetProducts(){
    const pid=internetCarrier.value;clearSelect(internetProduct,pid?'상품을 선택하세요':'통신사를 먼저 선택하세요');internetProduct.disabled=!pid;
    (internetData.products||[]).filter(p=>p.provider_id===pid).sort(byOrder).forEach(p=>option(internetProduct,p.id,p.name));fillInternetBundles();
  }
  function currentInternetProduct(){return (internetData.products||[]).find(p=>p.id===internetProduct.value)||null}
  function eligibleInternetBundles(product){
    if(!product)return [];
    return (internetData.bundle_rules||[]).filter(r=>r.provider_id===product.provider_id&&(!Array.isArray(r.product_ids)||!r.product_ids.length||r.product_ids.includes(product.id))&&(!Number(r.minimum_speed_mbps)||Number(product.speed_mbps)>=Number(r.minimum_speed_mbps))).sort(byOrder);
  }
  function fillInternetBundles(){
    const p=currentInternetProduct();internetBundle.innerHTML='';option(internetBundle,'none','미적용');internetBundle.disabled=!p;
    eligibleInternetBundles(p).forEach(r=>option(internetBundle,r.id,r.name));syncInternet();
  }
  function syncInternet(){
    const p=currentInternetProduct();
    if(!p){['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-discount'].forEach(id=>$(id).textContent='—');$('internet-installation').textContent='매장 확인';$('internet-summary').textContent=internetCarrier.value?'현재 등록된 상품 금액은 매장에서 확인해 주세요.':'통신사와 상품을 선택하면 자동으로 반영됩니다.';return}
    const internetFee=Number(p.internet_fee)||0,tvFee=Number(p.tv_fee)||0,base=internetFee+tvFee,rule=(internetData.bundle_rules||[]).find(r=>r.id===internetBundle.value),discount=rule?Math.min(base,Number(rule.discount)||0):0,total=Math.max(0,base-discount);
    $('internet-fee-view').textContent=won(internetFee);$('tv-fee-view').textContent=won(tvFee);$('internet-base-total').textContent=won(base);$('internet-bundle-discount').textContent=discount?'-'+won(discount):'미적용';$('internet-total').textContent=won(total);$('internet-result-base').textContent=won(base);$('internet-result-discount').textContent=discount?'-'+won(discount):'미적용';$('internet-installation').textContent=Number.isFinite(Number(p.installation_fee))?won(p.installation_fee):'매장 확인';
    const bits=[];if(p.speed_mbps)bits.push(`${p.speed_mbps}Mbps`);if(rule?.kind)bits.push(rule.kind==='mobile'?'모바일 결합':'유선 결합');if(rule?.notes)bits.push(rule.notes);$('internet-detail').textContent=bits.length?bits.join(' · '):'3년 약정 기준 월요금';$('internet-summary').textContent=`${(internetData.providers||[]).find(x=>x.id===p.provider_id)?.name||p.provider_id} · ${p.name} 기준 예상 월요금입니다.`;
  }
  internetCarrier.addEventListener('change',fillInternetProducts);internetProduct.addEventListener('change',fillInternetBundles);internetBundle.addEventListener('change',syncInternet);

  Promise.all([
    fetch('data/catalog.json?v=20260915-9').then(r=>r.json()),
    fetch('data/plans.json?v=20260915-3').then(r=>r.json()),
    fetch('data/supports.json?v=20260915-2').then(r=>r.json()),
    fetch('data/devices-extra.json?v=20260915-3').then(r=>r.json()),
    fetch('data/iphone18.json?v=20260915-1').then(r=>r.json()),
    fetch('data/mvno-postpaid.json?v=20260915-1').then(r=>r.json()),
    fetch('data/prepaid.json?v=20260915-1').then(r=>r.json()),
    fetch('data/internet.json?v=20260915-1').then(r=>r.json())
  ]).then(([base,plans,supports,extra,iphone18,mvno,prepaid,internet])=>{
    catalog=base;const deviceMap=new Map();[...(base?.devices||[]),...(extra?.devices||[]),...(iphone18?.devices||[])].forEach(d=>deviceMap.set(d.id,d));catalog.devices=[...deviceMap.values()];catalog.mobile_plans=plans?.mobile_plans||base?.mobile_plans||[];contractRate=Number(plans?.selection_contract_rate)||DEFAULT_CONTRACT_RATE;supportSchedules=supports?.support_schedules||[];mvnoData=mvno||mvnoData;prepaidData=prepaid||prepaidData;internetData=internet||internetData;
    const mobileDates=[base?.meta?.updated_at,plans?.meta?.updated_at,supports?.meta?.updated_at,extra?.meta?.updated_at,iphone18?.meta?.updated_at].filter(Boolean).sort();setUpdated('catalog-updated',mobileDates.at(-1));setUpdated('mvno-updated',mvnoData?.meta?.updated_at);setUpdated('prepaid-updated',prepaidData?.meta?.updated_at);setUpdated('internet-updated',internetData?.meta?.updated_at);
    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();
  }).catch(()=>{$('mobile-data-note').textContent='상품 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'});
})();