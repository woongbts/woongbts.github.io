(function(){
  const won=n=>Number.isFinite(Number(n))?Math.max(0,Math.round(Number(n))).toLocaleString('ko-KR')+'원':'—';
  const $=id=>document.getElementById(id);
  const INSTALLMENT_APR=.059;
  const DEFAULT_CONTRACT_RATE=.25;
  let catalog=null;
  let contractRate=DEFAULT_CONTRACT_RATE;

  const byNewest=(a,b)=>{
    const ad=String(a?.release_date||''),bd=String(b?.release_date||'');
    if(ad&&bd&&ad!==bd)return bd.localeCompare(ad);
    if(ad&&!bd)return -1;if(!ad&&bd)return 1;
    const ao=Number(a?.source_order),bo=Number(b?.source_order);
    if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;
    return String(a?.name||'').localeCompare(String(b?.name||''),'ko');
  };
  const byOrder=(a,b)=>{
    const ao=Number(a?.source_order),bo=Number(b?.source_order);
    if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;
    return String(a?.name||'').localeCompare(String(b?.name||''),'ko');
  };

  document.querySelectorAll('.rate-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x===tab));
    document.querySelectorAll('.rate-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===tab.dataset.tab));
  }));

  const carrier=$('carrier');
  const joinType=$('join-type');
  const discountMethod=$('discount-method');
  const deviceSelect=$('device-select');
  const planSelect=$('plan-select');
  const monthsSelect=$('installment-months');
  const welfareType=$('welfare-type');

  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)}
  function clearSelect(select,placeholder){select.innerHTML='';option(select,'',placeholder)}
  function currentDevice(){return (catalog?.devices||[]).find(d=>d.id===deviceSelect.value)||null}
  function currentPlan(){return (catalog?.mobile_plans||[]).find(p=>p.id===planSelect.value)||null}
  function currentSupport(){
    const d=currentDevice(),p=currentPlan();if(!d||!p)return null;
    return (catalog?.mobile_supports||[]).find(s=>s.device_id===d.id&&s.plan_id===p.id&&s.join_type===joinType.value)||null;
  }

  function installment(principal,months){
    principal=Math.max(0,Number(principal)||0);months=Math.max(1,Number(months)||24);
    if(!principal)return {monthly:0,total:0,fee:0};
    const r=INSTALLMENT_APR/12;
    const factor=Math.pow(1+r,months);
    const monthly=principal*r*factor/(factor-1);
    const total=monthly*months;
    return {monthly,total,fee:Math.max(0,total-principal)};
  }

  function welfareDiscount(type,fee){
    fee=Math.max(0,Number(fee)||0);
    if(type==='disabled_veteran')return {amount:fee*.35,label:'장애인·국가유공자'};
    if(type==='livelihood_medical')return {amount:Math.min(fee,28600),label:'생계·의료급여'};
    if(type==='housing_education_lowincome'){
      const eligible=Math.min(fee,45100);
      const first=Math.min(eligible,12100);
      const rest=Math.max(0,eligible-first);
      return {amount:Math.min(23650,first+rest*.35),label:'주거·교육급여·차상위'};
    }
    if(type==='basic_pension')return {amount:Math.min(12100,fee*.5),label:'기초연금'};
    return {amount:0,label:'미적용'};
  }

  function fillDevices(){
    const keep=deviceSelect.value;
    clearSelect(deviceSelect,'기종을 선택하세요');
    (catalog?.devices||[]).filter(d=>d.carrier===carrier.value).sort(byNewest).forEach(d=>option(deviceSelect,d.id,d.model?`${d.name} · ${d.model}`:d.name));
    deviceSelect.value=[...deviceSelect.options].some(o=>o.value===keep)?keep:'';
    fillPlans();
  }

  function eligiblePlans(){
    const d=currentDevice();
    if(!d)return [];
    const all=(catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value).sort(byOrder);
    if(discountMethod.value==='contract')return all;
    const rows=(catalog?.mobile_supports||[]).filter(s=>s.device_id===d.id&&s.join_type===joinType.value);
    if(!rows.length)return all;
    const ids=new Set(rows.map(s=>s.plan_id));
    return all.filter(p=>ids.has(p.id));
  }

  function fillPlans(){
    const d=currentDevice(),keep=planSelect.value;
    clearSelect(planSelect,d?'요금제를 선택하세요':'기종을 먼저 선택하세요');
    planSelect.disabled=!d;
    if(!d){fillInstallments();syncMobile();return}
    eligiblePlans().forEach(p=>option(planSelect,p.id,`${p.name} · ${won(p.monthly_fee)}${p.data?' · '+p.data:''}`));
    planSelect.value=[...planSelect.options].some(o=>o.value===keep)?keep:'';
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

  function clearResult(){
    $('principal').textContent='—';
    $('device-monthly').textContent='—';
    $('installment-fee').textContent='—';
    $('plan-discount-view').textContent='—';
    $('service-monthly').textContent='—';
    $('monthly-total').textContent='—';
    $('welfare-view').textContent=welfareType.value==='none'?'미적용':'선택됨';
  }

  function syncMobile(){
    const d=currentDevice(),p=currentPlan(),s=currentSupport();
    const method=discountMethod.value;
    const isContract=method==='contract';

    $('device-price-view').textContent=d&&Number.isFinite(Number(d.retail_price))?won(d.retail_price):'—';
    $('plan-fee-view').textContent=p&&Number.isFinite(Number(p.monthly_fee))?won(p.monthly_fee):'—';
    $('discount-amount-label').textContent=isContract?'선택약정 월 할인':'공시지원금';
    $('principal-label').textContent=isContract?'단말 할부원금':'공시지원 반영 할부원금';
    $('plan-discount-label').textContent=isContract?'선택약정 할인':'요금 할인';
    $('extra-support-view').textContent=isContract?'해당 없음':'매장 문의';

    const planFee=Number(p?.monthly_fee)||0;
    const contractDiscount=isContract&&p?planFee*contractRate:0;
    if(isContract){
      $('discount-amount-view').textContent=p?'-'+won(contractDiscount):'—';
      $('plan-discount-view').textContent=p?'-'+won(contractDiscount):'—';
    }else{
      $('discount-amount-view').textContent=s&&Number.isFinite(Number(s.public_support))?won(s.public_support):d&&p?'확인 필요':'—';
      $('plan-discount-view').textContent='미적용';
    }

    const note=$('mobile-data-note');
    if(!(catalog?.devices||[]).length)note.textContent='실제 상품 데이터가 아직 등록되지 않았습니다.';
    else if(d&&!p)note.textContent='요금제를 선택하세요.';
    else if(isContract&&d&&p)note.textContent='선택약정은 단말 지원금 대신 월 통신요금 25% 할인을 반영합니다.';
    else if(d&&p&&!s)note.textContent='공시지원금은 가입유형·기종·요금제별 확인값을 순차 반영 중입니다.';
    else note.textContent='출고가·공시지원금·월정액이 선택한 조건에 맞춰 자동 반영됩니다.';

    if(!d||!p){
      clearResult();
      $('calc-summary').textContent='통신사, 가입유형, 할인방식, 기종, 요금제를 선택하면 자동으로 계산됩니다.';
      return;
    }
    if(!isContract&&!s){
      clearResult();
      $('plan-discount-view').textContent='미적용';
      $('calc-summary').textContent=`${carrier.value} · ${d.name} · ${joinType.value} · ${p.name}의 공시지원금 확인이 필요합니다.`;
      return;
    }

    const price=Number(d.retail_price)||0;
    const support=isContract?0:(Number(s?.public_support)||0);
    const months=Number(monthsSelect.value)||24;
    const principal=Math.max(0,price-support);
    const inst=installment(principal,months);
    const afterContract=Math.max(0,planFee-contractDiscount);
    const welfare=welfareDiscount(welfareType.value,afterContract);
    const service=Math.max(0,afterContract-welfare.amount);
    const total=inst.monthly+service;

    $('principal').textContent=won(principal);
    $('device-monthly').textContent=won(inst.monthly);
    $('installment-fee').textContent=won(inst.fee);
    $('service-monthly').textContent=won(service);
    $('monthly-total').textContent=won(total);
    $('welfare-view').textContent=welfare.amount?`${welfare.label} -${won(welfare.amount)}`:'미적용';
    $('calc-summary').textContent=`${carrier.value} · ${d.name} · ${joinType.value} · ${p.name} · ${isContract?'선택약정':'공시지원'} · ${months}개월 기준 예상치입니다.`;
  }

  [carrier,joinType].forEach(el=>el.addEventListener('change',fillDevices));
  discountMethod.addEventListener('change',fillPlans);
  deviceSelect.addEventListener('change',fillPlans);
  planSelect.addEventListener('change',syncMobile);
  monthsSelect.addEventListener('change',syncMobile);
  welfareType.addEventListener('change',syncMobile);

  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan');
  function fillMvnoProviders(){
    clearSelect(mvnoProvider,'통신사를 선택하세요');
    [...new Set((catalog?.mvno_plans||[]).map(p=>p.provider).filter(Boolean))].forEach(p=>option(mvnoProvider,p,p));
    fillMvnoPlans();
  }
  function fillMvnoPlans(){
    clearSelect(mvnoPlan,mvnoProvider.value?'요금제를 선택하세요':'통신사를 먼저 선택하세요');
    mvnoPlan.disabled=!mvnoProvider.value;
    (catalog?.mvno_plans||[]).filter(p=>p.provider===mvnoProvider.value).sort(byOrder).forEach(p=>option(mvnoPlan,p.id,`${p.name} · ${won(p.promo_monthly_fee??p.monthly_fee)}`));
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
    (catalog?.internet_products||[]).filter(p=>p.carrier===internetCarrier.value).sort(byOrder).forEach(p=>option(internetProduct,p.id,p.name));
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

  Promise.all([
    fetch('data/catalog.json?v=20260915-7').then(r=>r.json()),
    fetch('data/plans.json?v=20260915-1').then(r=>r.json())
  ]).then(([base,plans])=>{
    catalog=base;
    catalog.mobile_plans=plans?.mobile_plans||base?.mobile_plans||[];
    contractRate=Number(plans?.selection_contract_rate)||DEFAULT_CONTRACT_RATE;
    const dates=[base?.meta?.updated_at,plans?.meta?.updated_at].filter(Boolean).sort();
    $('catalog-updated').textContent=dates.length?`상품 데이터 ${dates[dates.length-1]} 기준`:'최신 상품 데이터 입력 준비 중';
    fillDevices();fillMvnoProviders();fillInternet();
  }).catch(()=>{$('mobile-data-note').textContent='상품 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'});
})();
