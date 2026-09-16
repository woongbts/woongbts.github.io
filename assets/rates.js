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

  let suspendUrlSync=true;
  let currentQuoteId='';
  let currentQuoteFingerprint='';
  const RECENT_QUOTE_KEY='woongbi-recent-quotes-v1';
  const mvnoFilters={network:'all',price:'all',data:'all',voice:'all'};
  function devicePlanIds(d,joinLabel){
    if(!d)return [];
    const byJoin=d.eligible_plan_ids_by_join_type||{};
    const source=Array.isArray(byJoin[joinLabel])?byJoin[joinLabel]:d.eligible_plan_ids;
    return Array.isArray(source)?source:[];
  }
  function planEligibleForDevice(d,p,joinLabel){
    if(!d||!p)return false;
    const ids=devicePlanIds(d,joinLabel);return !ids.length||ids.includes(p.id);
  }
  function supportForSelection(d,p,joinLabel){
    if(!d||!p)return null;
    const exact=(catalog?.mobile_supports||[]).find(s=>s.device_id===d.id&&s.plan_id===p.id&&s.join_type===joinLabel);
    if(exact&&hasAmount(exact.public_support))return exact;
    const rule=(supportSchedules||[]).find(r=>r.carrier===d.carrier&&Array.isArray(r.device_ids)&&r.device_ids.includes(d.id)&&Array.isArray(r.join_types)&&r.join_types.includes(joinLabel)&&r.amounts&&hasAmount(r.amounts[p.id]));
    return rule?{device_id:d.id,join_type:joinLabel,plan_id:p.id,public_support:Number(rule.amounts[p.id])}:null;
  }
  function scenarioForSelection(d,p,joinLabel,method,months,welfareKey){
    if(!d||!p||!planEligibleForDevice(d,p,joinLabel)||!hasAmount(d.retail_price)||Number(d.retail_price)<=0)return null;
    const price=Number(d.retail_price),planFee=Number(p.monthly_fee)||0,term=Number(months)||24,supportRow=supportForSelection(d,p,joinLabel);
    if(method==='support'&&!supportRow)return {known:false};
    const support=method==='support'?Number(supportRow?.public_support||0):0,principal=Math.max(0,price-support),inst=installment(principal,term);
    const contractDiscount=method==='contract'?planFee*contractRate:0,afterContract=Math.max(0,planFee-contractDiscount),welfare=welfareDiscount(welfareKey||'none',afterContract),service=Math.max(0,afterContract-welfare.amount);
    return {known:true,method,price,planFee,support,contractDiscount,principal,inst,service,welfare,monthly:inst.monthly+service,total24:inst.total+service*24};
  }
  function planDataGb(p){
    const s=String(p?.data||'').toLowerCase().replace(/\s+/g,'');
    if(!s)return null;if(s.includes('무제한')||s.includes('unlimited'))return Infinity;
    let m=s.match(/([0-9]+(?:\.[0-9]+)?)gb/);if(m)return Number(m[1]);
    m=s.match(/([0-9]+(?:\.[0-9]+)?)mb/);if(m)return Number(m[1])/1024;
    return null;
  }
  function brandMatch(d,brand){
    if(brand==='all')return true;const s=`${d?.name||''} ${d?.manufacturer||''} ${d?.model_code||''}`.toLowerCase();
    if(brand==='apple')return s.includes('아이폰')||s.includes('iphone')||s.includes('apple')||s.includes('애플');
    if(brand==='samsung')return s.includes('갤럭시')||s.includes('galaxy')||s.includes('samsung')||s.includes('삼성');
    return true;
  }

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
  function currentSupport(){return supportForSelection(currentDevice(),currentPlan(),joinType.value)}
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
    fillDeviceCompareOptions();
    fillPlans();
  }
  function eligiblePlans(){const d=currentDevice();if(!d)return[];const raw=devicePlanIds(d,joinType.value),ids=raw.length?new Set(raw):null;return (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&(!ids||ids.has(p.id))).sort(byOrder)}
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

  function mobileScenario(method){return scenarioForSelection(currentDevice(),currentPlan(),joinType.value,method,monthsSelect.value,welfareType.value)}
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
    ensureQuoteId();
    const lines=['[웅비통신 간편견적 상담]',`견적번호: ${currentQuoteId}`,`통신사: ${carrier.value}`,`가입유형: ${joinType.value}`,`기종: ${d.name}${d.model_code?' ('+d.model_code+')':''}`,`요금제: ${p.name} / ${won(p.monthly_fee)}`,`계산기준: ${method}`,`할부: ${monthsSelect.value||24}개월`,`복지할인: ${welfareType.options[welfareType.selectedIndex]?.text||'미적용'}`];
    if(scenario?.known)lines.push(`예상 월 납부액: ${won(scenario.monthly)}`);
    lines.push('추가지원금·재고·프로모션은 매장에서 최종 확인 부탁드립니다.');
    lines.push(`견적 링크: ${buildQuoteUrl()}`);
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
    if(navigator.share){try{await navigator.share({title:'웅비통신 간편견적',text,url:buildQuoteUrl()});$('quote-action-status').textContent='견적 공유창을 열었습니다.';return}catch(e){if(e?.name==='AbortError')return}}
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
  function buildQuoteUrl(){
    const u=new URL(location.href),d=currentDevice(),p=currentPlan();
    ensureQuoteId();
    ['tab','c','j','d','p','m','mo','w','qid'].forEach(k=>u.searchParams.delete(k));
    if(d&&p){u.searchParams.set('tab','mobile');u.searchParams.set('c',carrier.value);u.searchParams.set('j',joinType.value);u.searchParams.set('d',d.id);u.searchParams.set('p',p.id);u.searchParams.set('m',discountMethod.value);u.searchParams.set('mo',monthsSelect.value||'24');u.searchParams.set('w',welfareType.value||'none');if(currentQuoteId)u.searchParams.set('qid',currentQuoteId)}
    return u.toString();
  }
  function syncQuoteUrl(){if(suspendUrlSync)return;const d=currentDevice(),p=currentPlan();if(!d||!p)return;history.replaceState(null,'',buildQuoteUrl())}
  function restoreQuoteFromUrl(){
    const q=new URLSearchParams(location.search),did=q.get('d'),pid=q.get('p'),qid=q.get('qid');if(!did||!pid)return false;
    const c=q.get('c');if(['SKT','KT','LGU+'].includes(c))carrier.value=c;
    const j=q.get('j');if(['기기변경','번호이동','신규가입'].includes(j))joinType.value=j;
    const method=q.get('m');if(['support','contract'].includes(method))discountMethod.value=method;
    const w=q.get('w');if([...welfareType.options].some(o=>o.value===w))welfareType.value=w;
    const d=(catalog?.devices||[]).find(x=>x.id===did&&x.carrier===carrier.value);if(!d)return false;
    deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=did;fillPlans();
    if([...planSelect.options].some(o=>o.value===pid))planSelect.value=pid;else return false;
    const mo=q.get('mo');if([...monthsSelect.options].some(o=>o.value===mo))monthsSelect.value=mo;
    deviceSearch.value='';fillDevices();deviceSelect.value=did;fillPlans();planSelect.value=pid;
    if([...monthsSelect.options].some(o=>o.value===mo))monthsSelect.value=mo;
    setMobileMode('direct');if(qid){currentQuoteId=qid;currentQuoteFingerprint=quoteFingerprint()}syncQuoteMemory();return true;
  }
  function setMobileMode(mode){
    const quick=mode==='quick';$('quick-recommend').hidden=!quick;$('direct-mobile-grid').hidden=quick;
    document.querySelectorAll('[data-mobile-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mobileMode===mode));
    if(quick){$('quick-carrier').value=carrier.value;$('quick-join').value=joinType.value}
  }
  function quickPlanMeets(p,need){const gb=planDataGb(p);if(need==='unlimited')return gb===Infinity;return gb!==null&&gb>=Number(need)}
  function quickRecommendations(){
    const c=$('quick-carrier').value,j=$('quick-join').value,brand=$('quick-brand').value,need=$('quick-data').value,budget=Number($('quick-budget').value)||0;
    const devices=(catalog?.devices||[]).filter(d=>d.carrier===c&&brandMatch(d,brand)&&hasAmount(d.retail_price)&&Number(d.retail_price)>0).sort(byNewest).slice(0,140),out=[];
    for(const d of devices){
      const ids=devicePlanIds(d,j);if(!ids.length)continue;
      const plans=(catalog?.mobile_plans||[]).filter(p=>p.carrier===c&&ids.includes(p.id)&&hasAmount(p.monthly_fee)&&quickPlanMeets(p,need)).sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee));
      const p=plans[0];if(!p)continue;
      const s=scenarioForSelection(d,p,j,'support',24,'none'),ct=scenarioForSelection(d,p,j,'contract',24,'none'),known=[s,ct].filter(x=>x?.known);
      if(!known.length)continue;known.sort((a,b)=>a.total24-b.total24);const best=known[0];
      if(budget&&best.monthly>budget)continue;
      out.push({d,p,best,s,ct});
    }
    out.sort((a,b)=>a.best.monthly-b.best.monthly||String(b.d.release_date||'').localeCompare(String(a.d.release_date||'')));
    return out.slice(0,3);
  }
  function renderQuickRecommendations(){
    const box=$('quick-results'),rows=quickRecommendations();box.innerHTML='';
    if(!rows.length){const p=document.createElement('p');p.textContent='현재 조건에 정확히 맞는 후보가 없습니다. 예산이나 데이터 조건을 한 단계 넓혀보세요.';box.appendChild(p);return}
    rows.forEach(({d,p,best})=>{
      const card=document.createElement('article');card.className='quick-result-card';
      const method=best.method==='support'?'공시지원금':'선택약정 25%';
      card.innerHTML=`<span>${d.carrier} · ${method}</span><strong>${d.name}</strong><em>${p.name}</em><b>${won(best.monthly)} / 월</b><small>24개월 총 예상비용 ${won(best.total24)}</small>`;
      const btn=document.createElement('button');btn.type='button';btn.textContent='이 조건으로 계산하기';btn.addEventListener('click',()=>applyQuickResult(d,p,best.method));card.appendChild(btn);box.appendChild(card);
    });
  }
  function applyQuickResult(d,p,method){
    carrier.value=d.carrier;joinType.value=$('quick-join').value;discountMethod.value=method;deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;deviceSearch.value='';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;setMobileMode('direct');syncMobile();document.getElementById('direct-mobile-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function fillDeviceCompareOptions(){
    const a=$('device-compare-1'),b=$('device-compare-2'),c=$('device-compare-3');if(!a||!b||!c)return;
    const current=currentDevice(),keepB=b.value,keepC=c.value;let rows=(catalog?.devices||[]).filter(d=>d.carrier===carrier.value).sort(byNewest).slice(0,120);
    if(current&&!rows.some(d=>d.id===current.id))rows=[current,...rows];
    a.innerHTML='';if(current)option(a,current.id,current.name);else option(a,'','기종 선택 후 표시');a.disabled=true;
    [[b,keepB],[c,keepC]].forEach(([sel,keep])=>{clearSelect(sel,'비교 기종 선택');rows.filter(d=>!current||d.id!==current.id).forEach(d=>option(sel,d.id,[d.name,d.model_code].filter(Boolean).join(' · ')));if([...sel.options].some(o=>o.value===keep))sel.value=keep});
  }
  function syncDeviceCompare(){
    const box=$('device-compare-results');if(!box)return;const p=currentPlan(),base=currentDevice();
    if(!base||!p){box.innerHTML='<p>기종과 요금제를 선택한 뒤 비교할 기종을 추가해 주세요.</p>';return}
    const ids=[base.id,$('device-compare-2').value,$('device-compare-3').value].filter((v,i,a)=>v&&a.indexOf(v)===i);
    if(ids.length<2){box.innerHTML='<p>비교 기종을 하나 이상 추가하면 같은 요금제로 나란히 비교합니다.</p>';return}
    box.innerHTML='';ids.forEach((id,index)=>{
      const d=(catalog?.devices||[]).find(x=>x.id===id);const card=document.createElement('article');card.className='device-compare-card';
      if(!d||!planEligibleForDevice(d,p,joinType.value)){card.innerHTML=`<span>${index===0?'현재 선택':'비교 기종'}</span><strong>${d?.name||'기종'}</strong><em>선택한 요금제로 가입 불가</em>`;box.appendChild(card);return}
      const s=scenarioForSelection(d,p,joinType.value,'support',monthsSelect.value,welfareType.value),ct=scenarioForSelection(d,p,joinType.value,'contract',monthsSelect.value,welfareType.value),known=[s,ct].filter(x=>x?.known).sort((a,b)=>a.total24-b.total24),best=known[0];
      const supportText=s?.known?won(s.support):'매장 확인',supportMonthly=s?.known?won(s.monthly):'매장 확인',contractMonthly=ct?.known?won(ct.monthly):'—',bestText=best?(best.method==='support'?'공시지원':'선택약정'):'확인 필요';
      card.innerHTML=`<span>${index===0?'현재 선택':'비교 기종'}</span><strong>${d.name}</strong><em>출고가 ${won(d.retail_price)}</em><div><small>공시지원금</small><b>${supportText}</b></div><div><small>공시 월납부</small><b>${supportMonthly}</b></div><div><small>선약 월납부</small><b>${contractMonthly}</b></div><i>${best?`${bestText} · 24개월 ${won(best.total24)}`:'최종 금액 확인 필요'}</i>`;box.appendChild(card);
    });
  }
  function quoteFingerprint(){
    const d=currentDevice(),p=currentPlan();if(!d||!p)return '';
    return [carrier.value,joinType.value,d.id,p.id,discountMethod.value,monthsSelect.value||'24',welfareType.value||'none'].join('|');
  }
  function makeQuoteId(){
    const n=new Date(),pad=v=>String(v).padStart(2,'0');
    return `WB-${String(n.getFullYear()).slice(-2)}${pad(n.getMonth()+1)}${pad(n.getDate())}-${pad(n.getHours())}${pad(n.getMinutes())}${pad(n.getSeconds())}`;
  }
  function ensureQuoteId(){
    const fp=quoteFingerprint(),el=$('quote-number');
    if(!fp){currentQuoteId='';currentQuoteFingerprint='';if(el)el.textContent='견적 생성 전';return ''}
    if(!currentQuoteId||currentQuoteFingerprint!==fp){currentQuoteFingerprint=fp;currentQuoteId=makeQuoteId()}
    if(el)el.textContent=currentQuoteId;return currentQuoteId;
  }
  function readRecentQuotes(){
    try{const rows=JSON.parse(localStorage.getItem(RECENT_QUOTE_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch(e){return[]}
  }
  function writeRecentQuotes(rows){try{localStorage.setItem(RECENT_QUOTE_KEY,JSON.stringify(rows.slice(0,5)))}catch(e){}}
  function renderRecentQuotes(){
    const box=$('recent-quote-list');if(!box)return;const rows=readRecentQuotes();box.innerHTML='';
    if(!rows.length){box.innerHTML='<p>아직 저장된 견적이 없습니다.</p>';return}
    rows.forEach(row=>{
      const item=document.createElement('button');item.type='button';item.className='recent-quote-item';item.dataset.url=row.url||'';
      const when=row.savedAt?new Date(row.savedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      item.innerHTML=`<span><b>${row.id||'저장 견적'}</b><small>${when}</small></span><strong>${row.device||''}</strong><em>${row.plan||''}${row.monthly?` · ${won(row.monthly)}`:''}</em>`;box.appendChild(item);
    });
  }
  function syncQuoteMemory(){ensureQuoteId();renderRecentQuotes()}
  function saveCurrentQuote(){
    const d=currentDevice(),p=currentPlan();if(!d||!p){$('quote-action-status').textContent='기종과 요금제를 먼저 선택해 주세요.';return}
    ensureQuoteId();const scenario=mobileScenario(discountMethod.value),row={id:currentQuoteId,fingerprint:currentQuoteFingerprint,url:buildQuoteUrl(),carrier:carrier.value,join:joinType.value,device:d.name,deviceId:d.id,plan:p.name,planId:p.id,method:discountMethod.value,months:monthsSelect.value||'24',welfare:welfareType.value||'none',monthly:scenario?.known?scenario.monthly:null,savedAt:Date.now()};
    const rows=readRecentQuotes().filter(x=>x.id!==row.id&&x.fingerprint!==row.fingerprint);rows.unshift(row);writeRecentQuotes(rows);renderRecentQuotes();$('quote-action-status').textContent=`${currentQuoteId} 견적을 이 기기에 저장했습니다.`;
  }
  function syncCalcExplanation(){
    const d=currentDevice(),p=currentPlan(),scenario=mobileScenario(discountMethod.value),isContract=discountMethod.value==='contract';
    const ids=['explain-price','explain-device-discount','explain-principal','explain-interest','explain-device-monthly','explain-plan-fee','explain-contract-discount','explain-welfare','explain-service','explain-monthly-total','explain-total24'];
    if(!d||!p||!scenario?.known){ids.forEach(id=>{if($(id))$(id).textContent='—'});if($('explain-note'))$('explain-note').textContent=d&&p&&!isContract?'공시지원금 확인이 필요한 조건입니다. 확인된 금액만 계산에 반영합니다.':'기종과 요금제를 선택하면 계산 과정을 항목별로 보여드립니다.';return}
    $('explain-price').textContent=won(scenario.price);
    $('explain-device-discount').textContent=isContract?'미적용':(scenario.support?'-'+won(scenario.support):'0원');
    $('explain-principal').textContent=won(scenario.principal);
    $('explain-interest').textContent=won(scenario.inst.fee);
    $('explain-device-monthly').textContent=won(scenario.inst.monthly);
    $('explain-plan-fee').textContent=won(scenario.planFee);
    $('explain-contract-discount').textContent=isContract&&scenario.contractDiscount?'-'+won(scenario.contractDiscount):'미적용';
    $('explain-welfare').textContent=scenario.welfare?.amount?'-'+won(scenario.welfare.amount):'미적용';
    $('explain-service').textContent=won(scenario.service);
    $('explain-monthly-total').textContent=won(scenario.monthly);
    $('explain-total24').textContent=won(scenario.total24);
    $('explain-note').textContent=`월 단말금 ${won(scenario.inst.monthly)} + 월 통신요금 ${won(scenario.service)} = 예상 월 납부액 ${won(scenario.monthly)}입니다. 추가지원금·실시간 프로모션은 포함하지 않습니다.`;
  }
  function syncMobile(){syncMobileCore();syncComparison();syncQuoteBar();syncCalcExplanation();syncQuoteMemory();syncQuoteUrl();syncDeviceCompare()}


  [carrier,joinType].forEach(el=>el.addEventListener('change',fillDevices));discountMethod.addEventListener('change',fillPlans);deviceSelect.addEventListener('change',fillPlans);planSelect.addEventListener('change',syncMobile);monthsSelect.addEventListener('change',syncMobile);welfareType.addEventListener('change',syncMobile);
  deviceSearch?.addEventListener('input',fillDevices);
  document.querySelectorAll('.compare-card').forEach(card=>card.addEventListener('click',()=>{discountMethod.value=card.dataset.method;syncMobile()}));
  $('copy-quote')?.addEventListener('click',()=>copyQuote(true));
  $('share-quote')?.addEventListener('click',shareQuote);
  $('consult-quote')?.addEventListener('click',consultQuote);
  $('mobile-quote-detail')?.addEventListener('click',()=>document.getElementById('mobile-result')?.scrollIntoView({behavior:'smooth',block:'start'}));
  $('mobile-quote-consult')?.addEventListener('click',consultQuote);
  $('save-quote')?.addEventListener('click',saveCurrentQuote);
  $('recent-quote-list')?.addEventListener('click',e=>{const btn=e.target.closest('.recent-quote-item');if(btn?.dataset.url)location.href=btn.dataset.url});
  document.querySelectorAll('[data-mobile-mode]').forEach(btn=>btn.addEventListener('click',()=>setMobileMode(btn.dataset.mobileMode)));
  $('quick-find')?.addEventListener('click',renderQuickRecommendations);
  ['quick-carrier','quick-join','quick-brand','quick-data','quick-budget'].forEach(id=>$(id)?.addEventListener('change',()=>{$('quick-results').innerHTML='<p>조건이 바뀌었습니다. 추천 3개 찾기를 눌러주세요.</p>'}));
  ['device-compare-2','device-compare-3'].forEach(id=>$(id)?.addEventListener('change',syncDeviceCompare));

  // 알뜰폰 후불
  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan'),mvnoSort=$('mvno-sort');
  function mvnoPlanFee(p){return p?.special_monthly_fee??p?.monthly_fee}
  function mvnoMatchesFilters(p){
    if(mvnoFilters.network!=='all'&&p.network!==mvnoFilters.network)return false;
    if(mvnoFilters.price!=='all'&&(!hasAmount(mvnoPlanFee(p))||Number(mvnoPlanFee(p))>Number(mvnoFilters.price)))return false;
    const data=String(p.data||''),gb=planDataGb(p);
    if(mvnoFilters.data==='unlimited'&&!data.includes('무제한'))return false;
    if(['5','10'].includes(mvnoFilters.data)&&!(gb!==null&&gb>=Number(mvnoFilters.data)))return false;
    const voice=String(p.voice||'').replace(/\s+/g,'');
    if(mvnoFilters.voice==='unlimited'&&!(voice.includes('무제한')||voice.includes('기본제공')))return false;
    return true;
  }
  function sortMvnoPlans(rows){
    const mode=mvnoSort?.value||'source';
    if(mode==='price')return rows.sort((a,b)=>(Number(mvnoPlanFee(a))||Infinity)-(Number(mvnoPlanFee(b))||Infinity)||byOrder(a,b));
    if(mode==='data')return rows.sort((a,b)=>{const ag=planDataGb(a),bg=planDataGb(b),av=ag===null?-1:ag,bv=bg===null?-1:bg;return bv-av||((Number(mvnoPlanFee(a))||Infinity)-(Number(mvnoPlanFee(b))||Infinity))});
    return rows.sort(byOrder);
  }
  function updateMvnoFilterButtons(){document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.classList.toggle('active',mvnoFilters[btn.dataset.mvnoFilterGroup]===btn.dataset.mvnoFilterValue))}
  function fillMvnoProviders(){
    const keep=mvnoProvider.value;clearSelect(mvnoProvider,'통신사를 선택하세요');option(mvnoProvider,'all','전체 통신사');
    (mvnoData.providers||[]).slice().sort(byOrder).forEach(p=>option(mvnoProvider,p.id,p.name));
    if([...mvnoProvider.options].some(o=>o.value===keep))mvnoProvider.value=keep;fillMvnoPlans();
  }
  function fillMvnoPlans(){
    const pid=mvnoProvider.value,provider=(mvnoData.providers||[]).find(p=>p.id===pid);clearSelect(mvnoPlan,pid?'요금제를 선택하세요':'통신사 또는 필터를 선택하세요');
    let plans=(mvnoData.plans||[]).filter(p=>(pid==='all'||!pid||p.provider_id===pid)&&mvnoMatchesFilters(p));
    plans=sortMvnoPlans(plans);
    const providerMap=new Map((mvnoData.providers||[]).map(p=>[p.id,p]));
    plans.forEach(p=>{const fee=mvnoPlanFee(p),prefix=pid==='all'?`${providerMap.get(p.provider_id)?.name||p.provider_id} · `:'';option(mvnoPlan,p.id,`${prefix}${p.name} · ${hasAmount(fee)?won(fee):'매장 확인'}`)});
    mvnoPlan.disabled=!pid||!plans.length;
    if(pid==='all')$('mvno-network').textContent=mvnoFilters.network==='all'?'전체':mvnoFilters.network;
    else $('mvno-network').textContent=provider?.network||'—';
    $('mvno-filter-count').textContent=pid?`${plans.length.toLocaleString('ko-KR')}개 요금제가 현재 조건에 맞습니다.`:'통신사 또는 필터를 선택해 주세요.';
    if(pid&&!plans.length)$('mvno-detail').textContent='현재 필터 조건에 맞는 요금제가 없습니다.';
    syncMvno();
  }
  function syncMvno(){
    const p=(mvnoData.plans||[]).find(x=>x.id===mvnoPlan.value)||null,provider=(mvnoData.providers||[]).find(x=>x.id===(p?.provider_id||mvnoProvider.value))||null;
    $('mvno-network').textContent=p?.network||provider?.network||(mvnoProvider.value==='all'?(mvnoFilters.network==='all'?'전체':mvnoFilters.network):'—');
    if(!p){$('mvno-fee-view').textContent='—';$('mvno-total').textContent='—';$('mvno-summary').textContent=mvnoProvider.value?'필터에 맞는 요금제를 선택하면 월 기본료를 확인할 수 있습니다.':'통신사와 요금제를 선택하면 자동으로 반영됩니다.';return}
    const fee=mvnoPlanFee(p),known=hasAmount(fee);
    $('mvno-fee-view').textContent=known?won(fee):'매장 확인';$('mvno-total').textContent=known?won(fee):'매장 확인';
    const bits=[];if(p.data)bits.push(`데이터 ${p.data}`);if(p.voice)bits.push(`통화 ${p.voice}`);if(p.sms)bits.push(`문자 ${p.sms}`);
    $('mvno-detail').textContent=(bits.length?bits.join(' · ')+' · ':'')+'복지할인 미적용';
    $('mvno-summary').textContent=known?`${provider?.name||p.provider_id} · ${p.name} 특별할인가 기준 월 기본료입니다.`:`${provider?.name||p.provider_id} · ${p.name}의 현재 월요금은 매장에서 확인해 주세요.`;
  }
  mvnoProvider.addEventListener('change',fillMvnoPlans);mvnoPlan.addEventListener('change',syncMvno);mvnoSort?.addEventListener('change',fillMvnoPlans);
  document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.dataset.mvnoFilterGroup,value=btn.dataset.mvnoFilterValue;mvnoFilters[group]=value;updateMvnoFilterButtons();if(!mvnoProvider.value)mvnoProvider.value='all';if(group==='network'&&mvnoProvider.value!=='all'){const pr=(mvnoData.providers||[]).find(p=>p.id===mvnoProvider.value);if(value!=='all'&&pr?.network!==value)mvnoProvider.value='all'}fillMvnoPlans()}));
  $('mvno-filter-reset')?.addEventListener('click',()=>{Object.assign(mvnoFilters,{network:'all',price:'all',data:'all',voice:'all'});if(mvnoSort)mvnoSort.value='source';updateMvnoFilterButtons();fillMvnoPlans()});

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
  function internetSpeedLabel(p){
    const mbps=Number(p?.speed_mbps);
    if(!Number.isFinite(mbps)||mbps<=0)return '';
    if(mbps>=1000){
      const gbps=mbps/1000;
      return `${Number.isInteger(gbps)?gbps:gbps.toFixed(1)}G`;
    }
    return `${mbps}M`;
  }
  function internetHasWifi(p){
    const name=String(p?.name||'').toLowerCase(),group=String(p?.product_group||'').toUpperCase();
    return group==='WIFI'||group==='WINGS'||name.includes('와이파이')||name.includes('wifi')||name.includes('wi-fi')||name.includes('윙즈');
  }
  function internetProductLabel(p){
    const name=String(p?.name||''),speed=internetSpeedLabel(p),wifi=internetHasWifi(p);
    const normalizedName=name.replace(/\s+/g,'').toUpperCase();
    const normalizedSpeed=String(speed).replace(/\s+/g,'').toUpperCase();
    const parts=[];
    if(speed&&!normalizedName.includes(normalizedSpeed))parts.push(speed);
    if(wifi)parts.push('와이파이 포함');
    return parts.length?`${name} (${parts.join(', ')})`:name;
  }
  function fillInternetProducts(){
    const pid=internetCarrier.value,items=internetProducts().filter(p=>p.provider_id===pid).sort(byOrder);
    clearSelect(internetProduct,pid?'인터넷 상품을 선택하세요':'통신사를 먼저 선택하세요');
    items.forEach(p=>option(internetProduct,p.id,internetProductLabel(p)));
    internetProduct.disabled=!pid||!items.length;

    tvProduct.innerHTML='';
    if(pid){
      option(tvProduct,'none','TV 미선택');
      tvProducts().filter(p=>p.provider_id===pid).sort(byOrder).forEach(p=>option(tvProduct,p.id,p.channel_label?`${p.name} · ${p.channel_label}`:p.name));
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
      (!Number(r.maximum_speed_mbps)||Number(product.speed_mbps)<=Number(r.maximum_speed_mbps))&&
      (!r.requires_tv||!!currentTvProduct())&&
      (!Array.isArray(r.tv_product_ids)||!r.tv_product_ids.length||r.tv_product_ids.includes(currentTvProduct()?.id))
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
  function ruleDiscount(rule,tv){
    if(!rule)return {known:true,amount:0};
    if(!hasAmount(rule.discount))return {known:false,amount:0};
    let amount=Number(rule.discount)||0;
    if(tv&&hasAmount(rule.tv_extra_discount))amount+=Number(rule.tv_extra_discount)||0;
    return {known:true,amount};
  }
  function syncTvProductInfo(){
    const box=$('tv-product-info'),tv=currentTvProduct();if(!box)return;
    if(!tv){box.innerHTML='TV 상품을 선택하면 채널수와 기본 특징을 보여드립니다.';return}
    const channel=tv.channel_label?`<b>${tv.channel_label} 채널</b>`:'<b>채널수 상담 확인</b>';
    box.innerHTML=`<span>${channel}<strong>${tv.name}</strong></span><p>${tv.description||'상품별 채널 구성과 혜택은 상담 시 확인해 주세요.'}</p><small>${tv.channel_note||'채널 편성은 시점에 따라 변경될 수 있습니다.'}</small>`;
  }
  function defaultSettop(providerId,tv){
    const cfg=WIRED_COMBO_DEFAULTS[providerId];if(!cfg||!tv)return null;
    const list=(internetData.settop_products||[]).filter(x=>x.provider_id===providerId&&(!x.tv_product_id||x.tv_product_id===tv.id));
    return list.find(x=>cfg.settopNames.some(n=>String(x.name||'').includes(n)))||list.find(x=>hasAmount(x.monthly_fee))||null;
  }
  function syncInternet(){
    syncTvProductInfo();
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
    const wiredCalc=ruleDiscount(wiredRule,tv),mobileCalc=ruleDiscount(mobileRule,tv);
    const wiredKnown=wiredCalc.known,mobileKnown=mobileCalc.known;
    const extraWiredDiscount=wiredCalc.amount,mobileDiscount=mobileCalc.amount;
    const wiredDiscount=autoWiredDiscount+extraWiredDiscount;
    const totalKnown=baseKnown&&wiredKnown&&mobileKnown,totalDiscount=totalKnown?Math.min(base,wiredDiscount+mobileDiscount):null,total=totalKnown?Math.max(0,base-totalDiscount):null;

    $('internet-fee-view').textContent=internetKnown?won(Math.max(0,internetFee-autoInternetDiscount)):'매장 확인';
    $('tv-fee-view').textContent=!tvSelected?'미선택':(tvKnown&&settopKnown?won(Math.max(0,tvBaseFee-autoTvDiscount)+settopFee):'매장 확인');
    $('internet-base-total').textContent=baseKnown?won(base):'매장 확인';
    $('internet-bundle-discount').textContent=totalKnown?(totalDiscount?'-'+won(totalDiscount):'미적용'):'매장 확인';
    $('internet-total').textContent=totalKnown?won(total):'매장 확인';
    $('internet-result-base').textContent=baseKnown?won(base):'매장 확인';
    $('internet-result-wired-discount').textContent=tvSelected&&combo?(wiredDiscount?'-'+won(wiredDiscount):'미적용'):(wiredRule?(wiredKnown?'-'+won(extraWiredDiscount):'매장 확인'):'미적용');
    $('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?(mobileDiscount?'-'+won(mobileDiscount):'미적용'):'매장 확인'):'미적용';

    const installParts=[];
    if(hasAmount(p.installation_fee))installParts.push(Number(p.installation_fee));else installParts.push(null);
    if(tvSelected){
      if(stb&&hasAmount(stb.installation_fee))installParts.push(Number(stb.installation_fee));
      else if(tv&&hasAmount(tv.installation_fee)&&Number(tv.installation_fee)>0)installParts.push(Number(tv.installation_fee));
      else installParts.push(null);
    }
    $('internet-installation').textContent=installParts.every(v=>v!==null)?won(installParts.reduce((a,b)=>a+b,0)):'매장 확인';

    const bits=[],speedLabel=internetSpeedLabel(p);if(speedLabel)bits.push(`인터넷 속도 ${speedLabel}`);if(internetHasWifi(p))bits.push('와이파이 포함');if(tvSelected&&tv?.name)bits.push(tv.name);if(tvSelected&&combo)bits.push('인터넷+TV 결합할인 자동 반영');if(wiredRule?.notes)bits.push(wiredRule.notes);if(mobileRule?.notes)bits.push(mobileRule.notes);
    $('internet-detail').textContent=bits.length?bits.join(' · '):'3년 약정 기준 월요금';
    $('internet-summary').textContent=totalKnown?`${provider?.name||p.provider_id} · ${p.name}${tvSelected&&tv?.name?' + '+tv.name:''} 기준 예상 월요금입니다.`:`${provider?.name||p.provider_id} · 선택 상품의 최신 금액은 매장에서 확인해 주세요.`;
  }
  internetCarrier.addEventListener('change',fillInternetProducts);
  internetProduct.addEventListener('change',fillInternetBundles);
  tvProduct.addEventListener('change',fillInternetBundles);
  wiredBundle.addEventListener('change',syncInternet);
  mobileBundle.addEventListener('change',syncInternet);

  Promise.all([
    fetch('data/catalog.json?v=20260916-1').then(r=>r.json()),
    fetch('data/plans.json?v=20260916-1').then(r=>r.json()),
    fetch('data/supports.json?v=20260916-1').then(r=>r.json()),
    fetch('data/devices-extra.json?v=20260916-1').then(r=>r.json()),
    fetch('data/iphone18.json?v=20260916-1').then(r=>r.json()),
    fetch('data/mvno-postpaid.json?v=20260916-1').then(r=>r.json()),
    fetch('data/prepaid.json?v=20260916-1').then(r=>r.json()),
    fetch('data/internet.json?v=20260916-1').then(r=>r.json())
  ]).then(([base,plans,supports,extra,iphone18,mvno,prepaid,internet])=>{
    catalog=base;const deviceMap=new Map();[...(base?.devices||[]),...(extra?.devices||[]),...(iphone18?.devices||[])].forEach(d=>deviceMap.set(d.id,d));catalog.devices=[...deviceMap.values()];catalog.mobile_plans=plans?.mobile_plans||base?.mobile_plans||[];contractRate=Number(plans?.selection_contract_rate)||DEFAULT_CONTRACT_RATE;supportSchedules=supports?.support_schedules||[];mvnoData=mvno||mvnoData;prepaidData=prepaid||prepaidData;internetData=internet||internetData;
    const mobileDates=[base?.meta?.updated_at,plans?.meta?.updated_at,supports?.meta?.updated_at,extra?.meta?.updated_at,iphone18?.meta?.updated_at].filter(Boolean).sort();setUpdated('catalog-updated',mobileDates.at(-1));setUpdated('mvno-updated',mvnoData?.meta?.updated_at);setUpdated('prepaid-updated',prepaidData?.meta?.updated_at);setUpdated('internet-updated',internetData?.meta?.updated_at);
    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderRecentQuotes();restoreQuoteFromUrl();suspendUrlSync=false;syncMobile();
  }).catch(()=>{$('mobile-data-note').textContent='상품 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'});
})();