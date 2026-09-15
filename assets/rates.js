(function(){
  const won=n=>Number.isFinite(Number(n))?Math.max(0,Math.round(Number(n))).toLocaleString('ko-KR')+'원':'—';
  const $=id=>document.getElementById(id);
  const hasAmount=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const amountText=v=>hasAmount(v)?won(v):'매장 확인';
  const INSTALLMENT_APR=.059;
  const DEFAULT_CONTRACT_RATE=.25;
  let catalog=null;
  let contractRate=DEFAULT_CONTRACT_RATE;
  let supportSchedules=[];
  let mvnoData={providers:[],plans:[]};
  let prepaidData={providers:[],plans:[]};
  let internetData={providers:[],internet_products:[],tv_products:[],settop_products:[],bundle_rules:[]};
  const WIRED_COMBO_DEFAULTS={
    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},
    KT:{settopNames:['기가지니3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2640},
    'LGU+':{settopNames:['4K UHD4','UHD4'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200}
  };

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
    if(typeof syncQuoteBar==='function')syncQuoteBar();
  }));

  // 휴대폰
  const carrier=$('carrier'),joinType=$('join-type'),discountMethod=$('discount-method');
  const deviceSelect=$('device-select'),deviceSearch=$('device-search'),planSelect=$('plan-select'),monthsSelect=$('installment-months'),welfareType=$('welfare-type');
  function currentDevice(){return (catalog?.devices||[]).find(d=>d.id===deviceSelect.value)||null}
  function currentPlan(){return (catalog?.mobile_plans||[]).find(p=>p.id===planSelect.value)||null}
  function currentSupport(){
    const d=currentDevice(),p=currentPlan();
    if(!d||!p)return null;
    const exact=(catalog?.mobile_supports||[]).find(s=>s.device_id===d.id&&s.plan_id===p.id&&s.join_type===joinType.value);
    if(exact&&hasAmount(exact.public_support))return exact;
    const rule=(supportSchedules||[]).find(r=>r.carrier===carrier.value&&Array.isArray(r.device_ids)&&r.device_ids.includes(d.id)&&Array.isArray(r.join_types)&&r.join_types.includes(joinType.value)&&r.amounts&&hasAmount(r.amounts[p.id]));
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
    const keep=deviceSelect.value,q=String(deviceSearch?.value||'').trim().toLowerCase();clearSelect(deviceSelect,q?'검색 결과를 선택하세요':'기종을 선택하세요');
    let rows=(catalog?.devices||[]).filter(d=>d.carrier===carrier.value).sort(byNewest);
    if(q) rows=rows.filter(d=>`${d.name||''} ${d.model||''} ${d.model_code||''}`.toLowerCase().includes(q)).slice(0,100);
    else rows=rows.slice(0,30);
    const selected=(catalog?.devices||[]).find(d=>d.id===keep&&d.carrier===carrier.value);
    if(selected&&!rows.some(d=>d.id===selected.id))rows=[selected,...rows];
    rows.forEach(d=>option(deviceSelect,d.id,[d.name,d.model_code||d.model].filter(Boolean).join(' · ')));
    deviceSelect.value=[...deviceSelect.options].some(o=>o.value===keep)?keep:'';
    if(q&&!rows.length)deviceSelect.options[0].textContent='검색 결과 없음';
    fillPlans();
  }
  function eligiblePlans(){const d=currentDevice();if(!d)return[];const byJoin=d.eligible_plan_ids_by_join_type||{};const source=Array.isArray(byJoin[joinType.value])?byJoin[joinType.value]:d.eligible_plan_ids;const ids=Array.isArray(source)?new Set(source):null;return (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&(!ids||ids.has(p.id))).sort(byOrder)}
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
  function syncMobileCore(){
    const d=currentDevice(),p=currentPlan(),s=currentSupport(),isContract=discountMethod.value==='contract';
    const hasPrice=d&&hasAmount(d.retail_price)&&Number(d.retail_price)>0;
    $('device-price-view').textContent=hasPrice?won(d.retail_price):'매장 확인';
    $('plan-fee-view').textContent=p&&hasAmount(p.monthly_fee)?won(p.monthly_fee):'—';
    $('discount-amount-label').textContent=isContract?'선택약정 월 할인':'공시지원금';
    $('principal-label').textContent=isContract?'단말 할부원금':'공시지원 반영 할부원금';
    $('plan-discount-label').textContent=isContract?'선택약정 할인':'요금 할인';
    $('extra-support-view').textContent='매장 문의';
    const planFee=Number(p?.monthly_fee)||0,contractDiscount=isContract&&p?planFee*contractRate:0;
    if(isContract){$('discount-amount-view').textContent=p?'-'+won(contractDiscount):'—';$('plan-discount-view').textContent=p?'-'+won(contractDiscount):'—'}
    else{$('discount-amount-view').textContent=s&&hasAmount(s.public_support)?won(s.public_support):d&&p?'매장 확인':'—';$('plan-discount-view').textContent='미적용'}
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

  function mobileScenario(method){
    const d=currentDevice(),p=currentPlan();
    if(!d||!p||!hasAmount(d.retail_price)||Number(d.retail_price)<=0)return null;
    const price=Number(d.retail_price),planFee=Number(p.monthly_fee)||0,months=Number(monthsSelect.value)||24;
    const supportRow=currentSupport();
    if(method==='support'&&!supportRow)return {known:false};
    const support=method==='support'?Number(supportRow.public_support||0):0;
    const principal=Math.max(0,price-support),inst=installment(principal,months);
    const contractDiscount=method==='contract'?planFee*contractRate:0;
    const afterContract=Math.max(0,planFee-contractDiscount),welfare=welfareDiscount(welfareType.value,afterContract),service=Math.max(0,afterContract-welfare.amount);
    return {known:true,method,price,planFee,support,contractDiscount,principal,inst,service,welfare,monthly:inst.monthly+service,total24:inst.total+service*24};
  }
  function syncComparison(){
    const support=mobileScenario('support'),contract=mobileScenario('contract');
    const supportKnown=support?.known===true,contractKnown=contract?.known===true;
    $('compare-support-monthly').textContent=supportKnown?won(support.monthly):(support&&support.known===false?'매장 확인':'—');
    $('compare-support-total').textContent=supportKnown?`24개월 총비용 ${won(support.total24)}`:'24개월 총비용 —';
    $('compare-support-benefit').textContent=supportKnown?`공시지원금 ${won(support.support)}`:'지원금 —';
    $('compare-contract-monthly').textContent=contractKnown?won(contract.monthly):'—';
    $('compare-contract-total').textContent=contractKnown?`24개월 총비용 ${won(contract.total24)}`:'24개월 총비용 —';
    $('compare-contract-benefit').textContent=contractKnown?`월 선택약정 할인 ${won(contract.contractDiscount)}`:'월 할인 —';
    document.querySelectorAll('.compare-card').forEach(card=>card.classList.toggle('active',card.dataset.method===discountMethod.value));
    if(supportKnown&&contractKnown){
      const diff=Math.abs(support.total24-contract.total24),best=support.total24<=contract.total24?'공시지원금':'선택약정';
      $('compare-best').textContent=diff<500?`두 방식이 비슷해요`:`${best} 쪽이 유리`;
      $('compare-diff').textContent=diff<500?'현재 조건에서는 두 방식의 24개월 총비용 차이가 크지 않습니다.':`${best} 이용 시 24개월 총 예상비용이 약 ${won(diff)} 낮습니다.`;
    }else if(contractKnown&&support&&support.known===false){
      $('compare-best').textContent='공시지원금 확인 필요';$('compare-diff').textContent='선택약정은 계산됐고, 공시지원금은 매장에서 최신 금액을 확인해 비교해 드립니다.';
    }else{$('compare-best').textContent='조건을 선택해 주세요';$('compare-diff').textContent='기종과 요금제를 선택하면 두 방식의 차이를 한눈에 비교합니다.'}
  }
  function quoteText(){
    const d=currentDevice(),p=currentPlan();if(!d||!p)return '';
    const scenario=mobileScenario(discountMethod.value),method=discountMethod.value==='contract'?'선택약정 25%':'공시지원금';
    const lines=['[웅비통신 간편견적 상담]',`통신사: ${carrier.value}`,`가입유형: ${joinType.value}`,`기종: ${d.name}${d.model_code?' ('+d.model_code+')':''}`,`요금제: ${p.name} / ${won(p.monthly_fee)}`,`계산기준: ${method}`,`할부: ${monthsSelect.value||24}개월`,`복지할인: ${welfareType.options[welfareType.selectedIndex]?.text||'미적용'}`];
    if(scenario?.known)lines.push(`예상 월 납부액: ${won(scenario.monthly)}`);
    lines.push('추가지원금·재고·프로모션은 매장에서 최종 확인 부탁드립니다.');
    return lines.join('\n');
  }
  async function copyQuote(showStatus=true){
    const text=quoteText();if(!text){if(showStatus)$('quote-action-status').textContent='기종과 요금제를 먼저 선택해 주세요.';return false}
    try{await navigator.clipboard.writeText(text);if(showStatus)$('quote-action-status').textContent='견적을 복사했습니다.';return true}catch(e){
      const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(showStatus)$('quote-action-status').textContent=ok?'견적을 복사했습니다.':'견적 복사에 실패했습니다.';return ok;
    }
  }
  async function shareQuote(){
    const text=quoteText();if(!text){$('quote-action-status').textContent='기종과 요금제를 먼저 선택해 주세요.';return}
    if(navigator.share){try{await navigator.share({title:'웅비통신 간편견적',text,url:location.href});$('quote-action-status').textContent='견적 공유창을 열었습니다.';return}catch(e){if(e?.name==='AbortError')return}}
    await copyQuote(true);
  }
  async function consultQuote(){
    const ok=await copyQuote(false);
    if(!ok){$('quote-action-status').textContent='기종과 요금제를 먼저 선택해 주세요.';return}
    $('quote-action-status').textContent='견적을 복사했습니다. 카카오톡 상담창에 붙여넣어 주세요.';
    window.location.href='http://pf.kakao.com/_nWwNT/chat';
  }
  function syncQuoteBar(){
    const bar=$('mobile-quote-bar'),scenario=mobileScenario(discountMethod.value),mobileActive=document.querySelector('[data-panel="mobile"]')?.classList.contains('active');
    if(!bar)return;const show=!!(mobileActive&&scenario?.known);bar.hidden=!show;document.body.classList.toggle('has-mobile-quote-bar',show);
    if(show)$('mobile-quote-bar-total').textContent=won(scenario.monthly);
  }
  function syncMobile(){syncMobileCore();syncComparison();syncQuoteBar()}

  [carrier,joinType].forEach(el=>el.addEventListener('change',fillDevices));discountMethod.addEventListener('change',fillPlans);deviceSelect.addEventListener('change',fillPlans);planSelect.addEventListener('change',syncMobile);monthsSelect.addEventListener('change',syncMobile);welfareType.addEventListener('change',syncMobile);
  deviceSearch?.addEventListener('input',fillDevices);
  document.querySelectorAll('.compare-card').forEach(card=>card.addEventListener('click',()=>{discountMethod.value=card.dataset.method;syncMobile()}));
  $('copy-quote')?.addEventListener('click',()=>copyQuote(true));
  $('share-quote')?.addEventListener('click',shareQuote);
  $('consult-quote')?.addEventListener('click',consultQuote);
  $('mobile-quote-detail')?.addEventListener('click',()=>document.getElementById('mobile-result')?.scrollIntoView({behavior:'smooth',block:'start'}));
  $('mobile-quote-consult')?.addEventListener('click',consultQuote);

  // 알뜰폰 후불
  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan');
  function fillMvnoProviders(){
    clearSelect(mvnoProvider,'통신사를 선택하세요');
    (mvnoData.providers||[]).slice().sort(byOrder).forEach(p=>option(mvnoProvider,p.id,p.name));fillMvnoPlans();
  }
  function fillMvnoPlans(){
    const pid=mvnoProvider.value,provider=(mvnoData.providers||[]).find(p=>p.id===pid);clearSelect(mvnoPlan,pid?'요금제를 선택하세요':'통신사를 먼저 선택하세요');mvnoPlan.disabled=!pid;
    $('mvno-network').textContent=provider?.network||'—';
    const plans=(mvnoData.plans||[]).filter(p=>p.provider_id===pid).sort(byOrder);
    plans.forEach(p=>{const fee=p.special_monthly_fee??p.monthly_fee;option(mvnoPlan,p.id,`${p.name} · ${hasAmount(fee)?won(fee):'매장 확인'}`)});
    if(pid&&!plans.length){mvnoPlan.disabled=true;$('mvno-detail').textContent='확인된 요금제 금액은 매장에서 안내해 드립니다.'}
    syncMvno();
  }
  function syncMvno(){
    const p=(mvnoData.plans||[]).find(x=>x.id===mvnoPlan.value)||null,provider=(mvnoData.providers||[]).find(x=>x.id===mvnoProvider.value)||null;
    $('mvno-network').textContent=p?.network||provider?.network||'—';
    if(!p){$('mvno-fee-view').textContent='—';$('mvno-total').textContent='—';$('mvno-summary').textContent=mvnoProvider.value?'현재 확인된 요금은 매장에서 안내해 드립니다.':'통신사와 요금제를 선택하면 자동으로 반영됩니다.';return}
    const fee=p.special_monthly_fee??p.monthly_fee,known=hasAmount(fee);
    $('mvno-fee-view').textContent=known?won(fee):'매장 확인';$('mvno-total').textContent=known?won(fee):'매장 확인';
    const bits=[];if(p.data)bits.push(`데이터 ${p.data}`);if(p.voice)bits.push(`통화 ${p.voice}`);if(p.sms)bits.push(`문자 ${p.sms}`);
    $('mvno-detail').textContent=(bits.length?bits.join(' · ')+' · ':'')+'복지할인 미적용';
    $('mvno-summary').textContent=known?`${provider?.name||p.provider_id} · ${p.name} 월 기본료입니다.`:`${provider?.name||p.provider_id} · ${p.name}의 현재 월요금은 매장에서 확인해 주세요.`;
  }
  mvnoProvider.addEventListener('change',fillMvnoPlans);mvnoPlan.addEventListener('change',syncMvno);

  // 선불폰
  const prepaidProvider=$('prepaid-provider'),prepaidPlan=$('prepaid-plan');
  function fillPrepaidProviders(){
    clearSelect(prepaidProvider,'통신사를 선택하세요');
    const providers=(prepaidData.providers||[]).slice().sort(byOrder);
    providers.forEach(p=>option(prepaidProvider,p.id,p.name));
    if(!providers.length)$('prepaid-detail').textContent='확인된 선불폰 상품은 매장에서 안내해 드립니다.';
    fillPrepaidPlans();
  }
  function fillPrepaidPlans(){
    const pid=prepaidProvider.value,provider=(prepaidData.providers||[]).find(p=>p.id===pid);
    clearSelect(prepaidPlan,pid?'요금제를 선택하세요':'통신사를 먼저 선택하세요');prepaidPlan.disabled=!pid;$('prepaid-network').textContent=provider?.network||'—';
    const plans=(prepaidData.plans||[]).filter(p=>p.provider_id===pid).sort(byOrder);
    plans.forEach(p=>option(prepaidPlan,p.id,`${p.name} · ${hasAmount(p.monthly_fee)?won(p.monthly_fee):'매장 확인'}`));
    if(pid&&!plans.length){prepaidPlan.disabled=true;$('prepaid-detail').textContent='확인된 선불 요금은 매장에서 안내해 드립니다.'}
    syncPrepaid();
  }
  function syncPrepaid(){
    const p=(prepaidData.plans||[]).find(x=>x.id===prepaidPlan.value)||null,provider=(prepaidData.providers||[]).find(x=>x.id===prepaidProvider.value)||null;
    $('prepaid-network').textContent=p?.network||provider?.network||'—';
    if(!p){$('prepaid-fee-view').textContent='—';$('prepaid-total').textContent='—';$('prepaid-summary').textContent=prepaidProvider.value?'현재 확인된 요금은 매장에서 안내해 드립니다.':'통신사와 요금제를 선택하면 자동으로 반영됩니다.';return}
    const known=hasAmount(p.monthly_fee);
    $('prepaid-fee-view').textContent=known?won(p.monthly_fee):'매장 확인';$('prepaid-total').textContent=known?won(p.monthly_fee):'매장 확인';
    const bits=[];if(p.data)bits.push(`데이터 ${p.data}`);if(p.voice)bits.push(`통화 ${p.voice}`);if(p.valid_days)bits.push(`${p.valid_days}일`);
    $('prepaid-detail').textContent=bits.join(' · ')||'선불 요금제';
    $('prepaid-summary').textContent=known?`${provider?.name||p.provider_id} · ${p.name} 월 이용료입니다.`:`${provider?.name||p.provider_id} · ${p.name}의 현재 이용료는 매장에서 확인해 주세요.`;
  }
  prepaidProvider.addEventListener('change',fillPrepaidPlans);prepaidPlan.addEventListener('change',syncPrepaid);

  // 인터넷·TV
  const internetCarrier=$('internet-carrier'),internetProduct=$('internet-product'),tvProduct=$('tv-product'),wiredBundle=$('wired-bundle'),mobileBundle=$('mobile-bundle');
  function internetProducts(){return internetData.internet_products||internetData.products||[]}
  function tvProducts(){return internetData.tv_products||[]}
  function currentInternetProduct(){return internetProducts().find(p=>p.id===internetProduct.value)||null}
  function currentTvProduct(){return tvProduct.value==='none'?null:(tvProducts().find(p=>p.id===tvProduct.value)||null)}
  function fillInternetProviders(){
    clearSelect(internetCarrier,'통신사를 선택하세요');
    (internetData.providers||[]).slice().sort(byOrder).forEach(p=>option(internetCarrier,p.id,p.name));
    fillInternetProducts();
  }
  function fillInternetProducts(){
    const pid=internetCarrier.value,items=internetProducts().filter(p=>p.provider_id===pid).sort(byOrder);
    clearSelect(internetProduct,pid?'인터넷 상품을 선택하세요':'통신사를 먼저 선택하세요');
    items.forEach(p=>option(internetProduct,p.id,p.name));
    internetProduct.disabled=!pid||!items.length;

    tvProduct.innerHTML='';
    if(pid){
      option(tvProduct,'none','TV 미선택');
      tvProducts().filter(p=>p.provider_id===pid).sort(byOrder).forEach(p=>option(tvProduct,p.id,p.name));
      tvProduct.disabled=false;
    }else{
      option(tvProduct,'','통신사를 먼저 선택하세요');tvProduct.disabled=true;
    }
    if(pid&&!items.length)$('internet-detail').textContent='현재 확인된 인터넷 상품 요금은 매장에서 안내해 드립니다.';
    fillInternetBundles();
  }
  function eligibleInternetBundles(product,kind){
    if(!product)return [];
    return (internetData.bundle_rules||[]).filter(r=>
      r.provider_id===product.provider_id&&
      r.kind===kind&&
      (!Array.isArray(r.product_ids)||!r.product_ids.length||r.product_ids.includes(product.id))&&
      (!Number(r.minimum_speed_mbps)||Number(product.speed_mbps)>=Number(r.minimum_speed_mbps))&&
      (!Number(r.maximum_speed_mbps)||Number(product.speed_mbps)<=Number(r.maximum_speed_mbps))
    ).sort(byOrder);
  }
  function fillBundleSelect(select,kind){
    const p=currentInternetProduct();select.innerHTML='';
    const autoCombo=kind==='wired'&&p&&tvProduct.value!=='none'&&WIRED_COMBO_DEFAULTS[p.provider_id];
    if(autoCombo)option(select,'auto-combo','인터넷+TV 결합 자동적용');
    else option(select,'none','미적용');
    eligibleInternetBundles(p,kind).forEach(r=>option(select,r.id,r.name));
    select.disabled=!p;
    select.value=autoCombo?'auto-combo':'none';
  }
  function fillInternetBundles(){
    fillBundleSelect(wiredBundle,'wired');fillBundleSelect(mobileBundle,'mobile');syncInternet();
  }
  function selectedRule(select){return (internetData.bundle_rules||[]).find(r=>r.id===select.value)||null}
  function defaultSettop(providerId,tv){
    const cfg=WIRED_COMBO_DEFAULTS[providerId];if(!cfg||!tv)return null;
    const list=(internetData.settop_products||[]).filter(x=>x.provider_id===providerId&&(!x.tv_product_id||x.tv_product_id===tv.id));
    return list.find(x=>cfg.settopNames.some(n=>String(x.name||'').includes(n)))||list.find(x=>hasAmount(x.monthly_fee))||null;
  }
  function syncInternet(){
    const p=currentInternetProduct(),tv=currentTvProduct(),provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value)||null;
    if(!p){
      ['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-wired-discount','internet-result-mobile-discount'].forEach(id=>$(id).textContent='—');
      $('internet-installation').textContent='매장 확인';
      $('internet-summary').textContent=internetCarrier.value?'현재 확인된 상품 요금은 매장에서 안내해 드립니다.':'통신사와 상품을 선택하면 자동으로 반영됩니다.';
      return;
    }

    const internetKnown=hasAmount(p.monthly_fee??p.internet_fee),internetFee=internetKnown?Number(p.monthly_fee??p.internet_fee):null;
    const tvSelected=tvProduct.value!=='none',tvKnown=!tvSelected||!!(tv&&hasAmount(tv.monthly_fee??tv.tv_fee)),tvBaseFee=!tvSelected?0:(tvKnown?Number(tv.monthly_fee??tv.tv_fee):null);
    const combo=tvSelected?WIRED_COMBO_DEFAULTS[p.provider_id]:null;
    const stb=tvSelected?defaultSettop(p.provider_id,tv):null;
    const settopKnown=!tvSelected||!!combo;
    const settopFee=!tvSelected?0:(stb&&hasAmount(stb.monthly_fee)?Number(stb.monthly_fee):Number(combo?.fallbackSettopFee||0));
    const autoInternetDiscount=combo&&internetKnown?Math.min(internetFee,Number(combo.internetDiscount)||0):0;
    const autoTvDiscount=combo&&tvKnown?Math.min(tvBaseFee,Number(combo.tvDiscount)||0):0;
    const autoWiredDiscount=autoInternetDiscount+autoTvDiscount;
    const baseKnown=internetKnown&&tvKnown&&settopKnown,base=baseKnown?internetFee+tvBaseFee+settopFee:null;

    const wiredRule=selectedRule(wiredBundle),mobileRule=selectedRule(mobileBundle);
    const wiredKnown=!wiredRule||hasAmount(wiredRule.discount),mobileKnown=!mobileRule||hasAmount(mobileRule.discount);
    const extraWiredDiscount=wiredRule&&wiredKnown?Number(wiredRule.discount):0,mobileDiscount=mobileRule&&mobileKnown?Number(mobileRule.discount):0;
    const wiredDiscount=autoWiredDiscount+extraWiredDiscount;
    const totalKnown=baseKnown&&wiredKnown&&mobileKnown,totalDiscount=totalKnown?Math.min(base,wiredDiscount+mobileDiscount):null,total=totalKnown?Math.max(0,base-totalDiscount):null;

    $('internet-fee-view').textContent=internetKnown?won(Math.max(0,internetFee-autoInternetDiscount)):'매장 확인';
    $('tv-fee-view').textContent=!tvSelected?'미선택':(tvKnown&&settopKnown?won(Math.max(0,tvBaseFee-autoTvDiscount)+settopFee):'매장 확인');
    $('internet-base-total').textContent=baseKnown?won(base):'매장 확인';
    $('internet-bundle-discount').textContent=totalKnown?(totalDiscount?'-'+won(totalDiscount):'미적용'):'매장 확인';
    $('internet-total').textContent=totalKnown?won(total):'매장 확인';
    $('internet-result-base').textContent=baseKnown?won(base):'매장 확인';
    $('internet-result-wired-discount').textContent=tvSelected&&combo?(wiredDiscount?'-'+won(wiredDiscount):'미적용'):(wiredRule?(wiredKnown?'-'+won(extraWiredDiscount):'매장 확인'):'미적용');
    $('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?'-'+won(mobileDiscount):'매장 확인'):'미적용';

    const installParts=[];
    if(hasAmount(p.installation_fee))installParts.push(Number(p.installation_fee));else installParts.push(null);
    if(tvSelected){
      if(stb&&hasAmount(stb.installation_fee))installParts.push(Number(stb.installation_fee));
      else if(tv&&hasAmount(tv.installation_fee)&&Number(tv.installation_fee)>0)installParts.push(Number(tv.installation_fee));
      else installParts.push(null);
    }
    $('internet-installation').textContent=installParts.every(v=>v!==null)?won(installParts.reduce((a,b)=>a+b,0)):'매장 확인';

    const bits=[];if(p.speed_mbps)bits.push(`${p.speed_mbps}Mbps`);if(tvSelected&&tv?.name)bits.push(tv.name);if(tvSelected&&combo)bits.push('인터넷+TV 결합할인 자동 반영');if(wiredRule?.notes)bits.push(wiredRule.notes);if(mobileRule?.notes)bits.push(mobileRule.notes);
    $('internet-detail').textContent=bits.length?bits.join(' · '):'3년 약정 기준 월요금';
    $('internet-summary').textContent=totalKnown?`${provider?.name||p.provider_id} · ${p.name}${tvSelected&&tv?.name?' + '+tv.name:''} 기준 예상 월요금입니다.`:`${provider?.name||p.provider_id} · 선택 상품의 최신 금액은 매장에서 확인해 주세요.`;
  }
  internetCarrier.addEventListener('change',fillInternetProducts);
  internetProduct.addEventListener('change',fillInternetBundles);
  tvProduct.addEventListener('change',fillInternetBundles);
  wiredBundle.addEventListener('change',syncInternet);
  mobileBundle.addEventListener('change',syncInternet);

  Promise.all([
    fetch('data/catalog.json?v=20260915-14').then(r=>r.json()),
    fetch('data/plans.json?v=20260915-14').then(r=>r.json()),
    fetch('data/supports.json?v=20260915-14').then(r=>r.json()),
    fetch('data/devices-extra.json?v=20260915-14').then(r=>r.json()),
    fetch('data/iphone18.json?v=20260915-14').then(r=>r.json()),
    fetch('data/mvno-postpaid.json?v=20260915-14').then(r=>r.json()),
    fetch('data/prepaid.json?v=20260915-14').then(r=>r.json()),
    fetch('data/internet.json?v=20260915-14').then(r=>r.json())
  ]).then(([base,plans,supports,extra,iphone18,mvno,prepaid,internet])=>{
    catalog=base;const deviceMap=new Map();[...(base?.devices||[]),...(extra?.devices||[]),...(iphone18?.devices||[])].forEach(d=>deviceMap.set(d.id,d));catalog.devices=[...deviceMap.values()];catalog.mobile_plans=plans?.mobile_plans||base?.mobile_plans||[];contractRate=Number(plans?.selection_contract_rate)||DEFAULT_CONTRACT_RATE;supportSchedules=supports?.support_schedules||[];mvnoData=mvno||mvnoData;prepaidData=prepaid||prepaidData;internetData=internet||internetData;
    const mobileDates=[base?.meta?.updated_at,plans?.meta?.updated_at,supports?.meta?.updated_at,extra?.meta?.updated_at,iphone18?.meta?.updated_at].filter(Boolean).sort();setUpdated('catalog-updated',mobileDates.at(-1));setUpdated('mvno-updated',mvnoData?.meta?.updated_at);setUpdated('prepaid-updated',prepaidData?.meta?.updated_at);setUpdated('internet-updated',internetData?.meta?.updated_at);
    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();
  }).catch(()=>{$('mobile-data-note').textContent='상품 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'});
})();