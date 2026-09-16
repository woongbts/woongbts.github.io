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
  let studyphoneData={meta:{},device:null,plans:[]};
  let prepaidData={providers:[],plans:[]};
  let internetData={providers:[],internet_products:[],tv_products:[],settop_products:[],bundle_rules:[]};
  const WIRED_COMBO_DEFAULTS={
    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},
    SKTNET:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscountBySpeed:{100:2200,500:6600,1000:6600},tvDiscount:1100},
    KT:{settopNames:['기가지니4'],fallbackSettopFee:6600,internetDiscount:5500,tvDiscount:2640},
    'LGU+':{settopNames:['4K UHD4','UHD4'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},
    LGHELLO:{settopNames:['HD 셋톱','UHD 셋톱'],fallbackSettopFee:6600,internetDiscount:0,tvDiscount:0},
    SKYLIFE:{settopNames:['지니TV STB A'],fallbackSettopFee:3300,internetDiscount:0,tvDiscount:0}
  };

  const CUSTOMER_GIFT_MAX={
    SKB:{
      groups:['WIFI'],
      none:{100:10,500:17,1000:17},
      tv:{
        TV_BASIC_NEW:{100:29,500:37,1000:37},
        TV_SMART_PLUS:{100:29,500:47,1000:47},
        TV_ALL:{100:29,500:47,1000:47},
        SKB_TV_POP180:{100:30,500:35,1000:35}
      }
    },
    SKTNET:{
      groups:['WIFI'],
      none:{100:11,500:17,1000:17},
      tv:{
        SKTNET_TV_ECO:{100:40,500:43,1000:52},
        SKTNET_TV_STD:{100:40,500:43,1000:52},
        SKTNET_TV_ALL:{100:40,500:43,1000:52}
      }
    },
    KT:{
      groups:['WIFI'],
      none:{100:9,500:14,1000:14},
      tv:{
        TV_OTV_BASIC:{100:37,500:45,1000:45},
        TV_OTV12:{100:37,500:45,1000:45},
        TV_OTV15:{100:37,500:45,1000:45},
        TV_OTV_ALLG:{100:37,500:45,1000:45}
      },
      family:{
        none:{100:9,500:14,1000:14},
        tv:{
          TV_OTV_BASIC:{100:37,500:45,1000:45},
          TV_OTV12:{100:37,500:45,1000:45},
          TV_OTV15:{100:37,500:45,1000:45},
          TV_OTV_ALLG:{100:37,500:45,1000:45}
        }
      }
    },
    'LGU+':{
      groups:['BASIC'],
      none:{100:20,500:17,1000:17},
      tv:{
        TV_ECONOMY_PACK:{100:33,500:47,1000:47},
        TV_BASIC_PACK:{100:33,500:47,1000:47},
        TV_PREMIUM:{100:33,500:47,1000:47},
        TV_VOD_PREMIUM:{100:33,500:47,1000:47}
      }
    },
    LGHELLO:{
      groups:['BASIC'],
      none:{100:13,160:13,500:18,1000:20},
      tv:{
        TV_HD_ECONOMY:{100:13,160:13,500:18,1000:20},
        TV_UHD_ECONOMY:{100:30,160:30,500:35,1000:40},
        TV_UHD_NEW_BASIC:{100:30,160:30,500:35,1000:40},
        TV_UHD_NEWPREMIUM:{100:30,160:30,500:35,1000:40},
        TV_UHD_PRO_LIGHT:{160:30,500:35,1000:40},
        TV_UHD_PRO_MAX:{160:30,500:35,1000:40}
      }
    },
    SKYLIFE:{
      groups:['BASIC'],
      none:{100:10,200:12,500:14,1000:15},
      tv:{
        TV_IPIT_BASIC:{100:35,200:36,500:42,1000:48},
        TV_IPIT_PLUS:{100:35,200:36,500:42,1000:48},
        TV_IPIT_CHOICE:{100:35,200:36,500:42,1000:48}
      },
      bundle30:{
        none:{100:10,200:12},
        tv:{}
      }
    }
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
  async function copyCustomerConsultText(text){
    if(!text)return false;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true}}catch(e){}
    try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return !!ok}catch(e){return false}
  }
  async function shareCustomerConsultText(title,text,statusId){
    const status=$(statusId);if(!text){if(status)status.textContent='먼저 상품을 선택해 주세요.';return false}
    if(navigator.share){try{await navigator.share({title,text,url:location.href});if(status)status.textContent='공유창을 열었습니다.';return true}catch(e){if(e?.name==='AbortError')return false}}
    const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다. 원하는 곳에 붙여넣어 주세요.':'복사하지 못했습니다. 다시 시도해 주세요.';return ok;
  }
  async function consultWithCustomerText(text,statusId){
    const status=$(statusId);if(!text){if(status)status.textContent='먼저 상품을 선택해 주세요.';return false}
    const ok=await copyCustomerConsultText(text);if(!ok){if(status)status.textContent='선택 내용을 복사하지 못했습니다. 다시 시도해 주세요.';return false}
    if(status)status.textContent='선택 내용을 복사했습니다. 카카오톡 상담창에 붙여넣어 주세요.';window.location.href='http://pf.kakao.com/_nWwNT/chat';return true;
  }

  let suspendUrlSync=true;
  let currentQuoteId='';
  let currentQuoteFingerprint='';
  const RECENT_QUOTE_KEY='woongbi-recent-quotes-v1';
  const recentQuoteCompareSelection=new Set();
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
  function planDataText(p){return String(p?.data||'').toLowerCase().replace(/\s+/g,'')}
  function planHasUnlimited(p){
    const s=planDataText(p);return !!s&&(s.includes('무제한')||s.includes('unlimited'));
  }
  function planDataGb(p){
    const s=planDataText(p);if(!s)return null;
    let m=s.match(/([0-9]+(?:\.[0-9]+)?)gb/);if(m)return Number(m[1]);
    m=s.match(/([0-9]+(?:\.[0-9]+)?)mb/);if(m)return Number(m[1])/1024;
    if(planHasUnlimited(p))return Infinity;
    return null;
  }
  function deviceBrandKey(d){
    const s=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    if(s.includes('아이폰')||s.includes('iphone')||s.includes('apple')||s.includes('애플'))return 'apple';
    if(s.includes('갤럭시')||s.includes('galaxy')||s.includes('samsung')||s.includes('삼성'))return 'samsung';
    return 'other';
  }
  function brandMatch(d,brand){return brand==='all'||deviceBrandKey(d)===brand}

  document.querySelectorAll('.rate-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x===tab));
    document.querySelectorAll('.rate-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===tab.dataset.tab));
    if(typeof syncQuoteBar==='function')syncQuoteBar();
  }));
  document.querySelectorAll('[data-jump-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.jumpTab,tab=document.querySelector(`.rate-tab[data-tab="${key}"]`),panel=document.querySelector(`.rate-panel[data-panel="${key}"]`);if(!tab||!panel)return;tab.click();setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),20);
  }));

  // 휴대폰
  const carrier=$('carrier'),joinType=$('join-type'),discountMethod=$('discount-method');
  const deviceSelect=$('device-select'),deviceSearch=$('device-search'),planSelect=$('plan-select'),monthsSelect=$('installment-months'),welfareType=$('welfare-type');
  let deviceBrandFilter='all';
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
  function updateDeviceBrandButtons(){
    document.querySelectorAll('[data-device-brand]').forEach(btn=>btn.classList.toggle('active',btn.dataset.deviceBrand===deviceBrandFilter));
  }
  function fillDevices(){
    const keep=deviceSelect.value,q=String(deviceSearch?.value||'').trim().toLowerCase();clearSelect(deviceSelect,q?'검색 결과를 선택하세요':'기종을 선택하세요');
    let rows=(catalog?.devices||[]).filter(d=>d.carrier===carrier.value&&brandMatch(d,deviceBrandFilter)).sort(byNewest);
    if(q) rows=rows.filter(d=>`${d.name||''} ${d.manufacturer||''} ${d.model||''} ${d.model_code||''}`.toLowerCase().includes(q)).slice(0,100);
    else rows=rows.slice(0,30);
    const selected=(catalog?.devices||[]).find(d=>d.id===keep&&d.carrier===carrier.value&&brandMatch(d,deviceBrandFilter));
    if(selected&&!rows.some(d=>d.id===selected.id))rows=[selected,...rows];
    rows.forEach(d=>option(deviceSelect,d.id,[d.name,d.model_code||d.model].filter(Boolean).join(' · ')));
    deviceSelect.value=[...deviceSelect.options].some(o=>o.value===keep)?keep:'';
    if(q&&!rows.length)deviceSelect.options[0].textContent='검색 결과 없음';
    else if(!q&&!rows.length)deviceSelect.options[0].textContent='선택한 브랜드에 등록된 기종 없음';
    updateDeviceBrandButtons();
    fillDeviceCompareOptions();
    fillPlans();
  }
  function eligiblePlans(){const d=currentDevice();if(!d)return[];const raw=devicePlanIds(d,joinType.value),ids=raw.length?new Set(raw):null;return (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&(!ids||ids.has(p.id))).sort(byOrder)}
  const planPickerState={data:'all',price:'all',feature:'all',sort:'source',query:''};
  function planBenefitLabels(p){
    const name=String(p?.name||'').toLowerCase(),labels=[];
    const add=label=>{if(label&&!labels.includes(label))labels.push(label)};
    if(name.includes('넷플릭스'))add('넷플릭스');
    if(name.includes('유튜브 프리미엄'))add('유튜브 프리미엄');
    if(name.includes('디즈니+')||name.includes('디즈니 플러스'))add('디즈니+');
    if(name.includes('티빙&웨이브'))add('티빙·웨이브');
    else if(name.includes('티빙/지니/밀리'))add('티빙·지니·밀리');
    else if(name.includes('티빙'))add('티빙');
    if(name.includes('t 우주')||name.includes('t우주'))add('T우주');
    if(name.includes('google ai')||name.includes('구글 ai'))add('Google AI');
    if(name.includes('구글원+보상패스'))add('구글원·보상패스');
    if(name.includes('위버스'))add('위버스');
    if(name.includes('가전구독'))add('가전구독');
    if(name.includes('폰케어'))add('폰케어');
    if(name.includes('삼성디바이스')||(p?.carrier==='KT'&&name.includes('초이스')&&name.includes('삼성')))add('삼성 혜택');
    if(name.includes('애플디바이스'))add('애플 혜택');
    if(name.includes('마니아디바이스')||(p?.carrier==='KT'&&name.includes('초이스')&&name.includes('디바이스'))||(p?.carrier==='SKT'&&name.includes('베스트')&&name.includes('스마트기기')))add('디바이스 혜택');
    return labels;
  }
  function planFeatureMatch(p,feature){
    if(feature==='all')return true;
    const name=String(p?.name||'').toLowerCase(),age=String(p?.age_limit||'').toUpperCase();
    if(feature==='benefit')return planBenefitLabels(p).length>0;
    if(feature==='senior')return age.includes('65')||age.includes('75')||name.includes('시니어')||name.includes('65+')||name.includes('75+');
    if(feature==='youth')return age==='B_19_34'||name.includes('청년')||name.includes('y덤')||name.includes('유쓰')||name.includes('uth');
    if(feature==='kids')return age==='U_12'||age==='U_18'||name.includes('키즈')||name.includes('청소년')||name.includes('스쿨덤')||name.includes('zem');
    return true;
  }
  function planPickerTags(p){
    const text=`${p?.name||''} ${p?.data||''}`.toLowerCase(),tags=[];
    const benefits=planBenefitLabels(p);if(benefits.length)tags.push('혜택형',...benefits.slice(0,2));
    [['65+','65+'],['75+','75+'],['복지','복지'],['이월','이월'],['y덤','Y덤'],['청년','청년'],['유쓰','청년'],['키즈','키즈'],['청소년','청소년']].forEach(([needle,label])=>{if(text.includes(needle)&&!tags.includes(label))tags.push(label)});
    return tags.slice(0,5);
  }
  function planPickerMatches(p){
    const query=String(planPickerState.query||'').trim().toLowerCase();
    if(query&&!`${p?.name||''} ${p?.data||''} ${p?.monthly_fee??''}`.toLowerCase().includes(query))return false;
    const fee=Number(p?.monthly_fee),gb=planDataGb(p);
    if(planPickerState.price==='under40'&&!(Number.isFinite(fee)&&fee<40000))return false;
    if(planPickerState.price==='40s'&&!(Number.isFinite(fee)&&fee>=40000&&fee<50000))return false;
    if(planPickerState.price==='50plus'&&!(Number.isFinite(fee)&&fee>=50000))return false;
    if(planPickerState.data==='light'&&!(gb!==null&&gb!==Infinity&&gb<=5))return false;
    if(planPickerState.data==='normal'&&!(gb!==null&&gb!==Infinity&&gb>5&&gb<=20))return false;
    if(planPickerState.data==='heavy'&&!(gb!==null&&gb!==Infinity&&gb>20))return false;
    if(planPickerState.data==='unlimited'&&!planHasUnlimited(p))return false;
    if(!planFeatureMatch(p,planPickerState.feature))return false;
    return true;
  }
  function planPickerRows(){
    const rows=eligiblePlans().filter(planPickerMatches);
    if(planPickerState.sort==='price')return rows.sort((a,b)=>(Number(a.monthly_fee)||Infinity)-(Number(b.monthly_fee)||Infinity)||byOrder(a,b));
    if(planPickerState.sort==='data')return rows.sort((a,b)=>{const ag=planDataGb(a),bg=planDataGb(b),av=ag===null?-1:ag,bv=bg===null?-1:bg;return bv-av||((Number(a.monthly_fee)||Infinity)-(Number(b.monthly_fee)||Infinity))});
    return rows.sort(byOrder);
  }
  function syncPlanQuickShortcuts(){const disabled=!currentDevice();document.querySelectorAll('[data-plan-quick-price],[data-plan-quick-feature]').forEach(btn=>btn.disabled=disabled)}
  function syncPlanPickerTrigger(){
    syncPlanQuickShortcuts();
    const button=$('plan-picker-open'),title=$('plan-picker-selected'),detail=$('plan-picker-selected-detail'),d=currentDevice(),p=currentPlan();if(!button||!title||!detail)return;
    button.disabled=!d;
    if(!d){title.textContent='기종을 먼저 선택하세요';detail.textContent='기종을 선택하면 요금제를 찾을 수 있습니다.';return}
    if(!p){title.textContent='요금제를 선택해 주세요';detail.textContent=`가입 가능한 요금제 ${eligiblePlans().length.toLocaleString('ko-KR')}개에서 찾아보세요.`;return}
    title.textContent=p.name;detail.textContent=`월 ${won(p.monthly_fee)}${p.data?` · 데이터 ${p.data}`:''}`;
  }
  function updatePlanPickerControls(){
    document.querySelectorAll('[data-plan-filter-group]').forEach(btn=>btn.classList.toggle('active',planPickerState[btn.dataset.planFilterGroup]===btn.dataset.planFilterValue));
    const sort=$('plan-picker-sort');if(sort)sort.value=planPickerState.sort;
  }
  function renderPlanPicker(){
    const list=$('plan-picker-list'),count=$('plan-picker-count');if(!list||!count)return;updatePlanPickerControls();list.innerHTML='';
    const rows=planPickerRows();count.textContent=`현재 조건에 맞는 요금제 ${rows.length.toLocaleString('ko-KR')}개`;
    if(!rows.length){const empty=document.createElement('p');empty.className='plan-picker-empty';empty.textContent='조건에 맞는 요금제가 없습니다. 검색어나 필터를 조금 넓혀보세요.';list.appendChild(empty);return}
    rows.forEach(p=>{
      const card=document.createElement('button');card.type='button';card.className='plan-option-card';if(planBenefitLabels(p).length)card.classList.add('benefit-plan');if(p.id===planSelect.value)card.classList.add('selected');
      const top=document.createElement('span');top.className='plan-option-top';
      const name=document.createElement('strong');name.textContent=p.name;
      const price=document.createElement('b');price.textContent=hasAmount(p.monthly_fee)?won(p.monthly_fee):'매장 확인';
      top.append(name,price);card.appendChild(top);
      const data=document.createElement('small');data.textContent=p.data?`데이터 ${p.data}`:'데이터 제공량은 상담 시 확인';card.appendChild(data);
      const tags=planPickerTags(p);if(tags.length){const tagBox=document.createElement('span');tagBox.className='plan-option-tags';tags.forEach(tag=>{const chip=document.createElement('i');chip.textContent=tag;if(tag==='혜택형')chip.classList.add('benefit-chip');tagBox.appendChild(chip)});card.appendChild(tagBox)}
      const choose=document.createElement('em');choose.textContent=p.id===planSelect.value?'현재 선택한 요금제':'이 요금제 선택';card.appendChild(choose);
      card.addEventListener('click',()=>{planSelect.value=p.id;closePlanPicker();syncMobile()});list.appendChild(card);
    });
  }
  function openPlanPicker(){
    if(!currentDevice())return;renderPlanPicker();const backdrop=$('plan-picker-backdrop');if(!backdrop)return;backdrop.hidden=false;document.body.classList.add('plan-picker-opened');setTimeout(()=>{const search=$('plan-picker-search');if(search)search.focus({preventScroll:true})},60);
  }
  function closePlanPicker(refocus=true){
    const backdrop=$('plan-picker-backdrop');if(backdrop)backdrop.hidden=true;document.body.classList.remove('plan-picker-opened');if(refocus)$('plan-picker-open')?.focus({preventScroll:true});
  }
  function fillPlans(){
    const d=currentDevice(),keep=planSelect.value;clearSelect(planSelect,d?'요금제를 선택하세요':'기종을 먼저 선택하세요');planSelect.disabled=!d;
    if(!d){closePlanPicker(false);fillInstallments();syncPlanPickerTrigger();syncMobile();return}
    eligiblePlans().forEach(p=>option(planSelect,p.id,p.name));
    planSelect.value=[...planSelect.options].some(o=>o.value===keep)?keep:'';fillInstallments();syncPlanPickerTrigger();syncMobile();
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
    const bar=$('mobile-quote-bar'),scenario=mobileScenario(discountMethod.value),mobileActive=document.querySelector('[data-panel="mobile"]')?.classList.contains('active'),directVisible=!$('direct-mobile-grid')?.hidden;
    if(!bar)return;const show=!!(mobileActive&&directVisible&&scenario?.known);bar.hidden=!show;document.body.classList.toggle('has-mobile-quote-bar',show);
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
    deviceBrandFilter=deviceBrandKey(d);updateDeviceBrandButtons();deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=did;fillPlans();
    if([...planSelect.options].some(o=>o.value===pid))planSelect.value=pid;else return false;
    const mo=q.get('mo');if([...monthsSelect.options].some(o=>o.value===mo))monthsSelect.value=mo;
    deviceSearch.value='';fillDevices();deviceSelect.value=did;fillPlans();planSelect.value=pid;
    if([...monthsSelect.options].some(o=>o.value===mo))monthsSelect.value=mo;
    setMobileMode('direct');if(qid){currentQuoteId=qid;currentQuoteFingerprint=quoteFingerprint()}syncQuoteMemory();return true;
  }
  let purposeCategory='senior';
  const PURPOSE_COPY={
    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5 등 삼성폰을 우선 살펴보고, 사용량과 월 부담의 균형이 좋은 휴대폰 요금제로 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',
    kids:'현재 추천하는 키즈폰은 SKT ZEM폰 포켓피스·LGU+ 춘식이2·KT 폼폼푸린 키즈폰 3종입니다. 키즈·청소년용 요금제에서 공시지원금과 선택약정의 24개월 총 부담을 비교합니다.',
    value:'KT 갤럭시 Jump5와 SKT 갤럭시 퀀텀 시리즈 등 40~70만원대 삼성폰을 우선 보고, 통신사별로 부담과 혜택의 균형이 좋은 요금제를 비교합니다. KT Jump5는 61,000원 구간을 우선 안내합니다.',
    premium:'아이폰18 시리즈·갤럭시 S26 / S26+ / S26 Ultra·Z Fold8 / Z Flip8을 중심으로 256GB를 우선 추천하고 512GB까지만 보여드립니다. 실제 공시지원금이 40~50만원으로 확인되는 조합은 기기값 할인 중심으로 안내합니다.'
  };
  function purposeIsLowCostDevice(d){
    const price=Number(d?.retail_price)||0,name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    return price>0&&(price<=650000||/갤럭시\s*a\d|galaxy\s*a\d|wide|와이드|버디|buddy/.test(name));
  }
  function purposeIsPremiumDevice(d){
    const name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    const currentFamily=/아이폰18|iphone18|갤럭시s26|galaxys26|폴드8|fold8|플립8|flip8/.test(name);
    const storage=purposePremiumStorageGb(d);
    return currentFamily&&(storage===256||storage===512);
  }
  function purposeObsoleteDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    return /쿠키즈미니|쿠키즈|cookizmini|블레이드|blade/.test(text);
  }
  function purposeIsKidsOnlyDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    return /무너2|무너키즈|mooner2|mooner|zem폰|zemphone|포켓피스|pocketpiece|키즈폰|폼폼푸린|pompompurin/.test(text);
  }
  function purposeIsDeprecatedKidsDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    return /신비키즈|신비아파트|신비폰|sinbi/.test(text);
  }
  function purposeKidsDeviceRank(d){
    if(purposeIsDeprecatedKidsDevice(d))return 99;
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    if(d?.carrier==='SKT'&&/포켓피스|pocketpiece/.test(text))return 0;
    if(d?.carrier==='LGU+'&&/춘식이2|춘식이키즈2|choonsik2/.test(text))return 1;
    if(d?.carrier==='KT'&&/폼폼푸린|pompompurin/.test(text))return 2;
    return 99;
  }
  function purposeSourceOrder(row){
    const order=Number(row?.source_order);return Number.isFinite(order)?order:999999;
  }
  function purposeSeniorDeviceRank(d){
    if(purposeIsKidsOnlyDevice(d))return 99;
    const name=`${d?.name||''} ${d?.model||''}`.toLowerCase().replace(/\s+/g,'');
    const model=`${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    if(name.includes('갤럭시a17')||name.includes('galaxya17')||/^sm-a175/.test(model))return 0;
    if(name.includes('wide8')||name.includes('와이드8'))return 1;
    if(name.includes('buddy5')||name.includes('버디5'))return 2;
    return 9;
  }
  function purposeSeniorDeviceFamily(d){
    const rank=purposeSeniorDeviceRank(d);if(rank===0)return'a17';if(rank===1)return'wide8';if(rank===2)return'buddy5';
    return `${d?.name||''}`.toLowerCase().replace(/\s+/g,'');
  }
  function purposeSeniorPlanTarget(carrierName){
    return carrierName==='SKT'?33000:carrierName==='KT'?37000:carrierName==='LGU+'?47000:33000;
  }
  function purposeSeniorPlanRank(p,carrierName){
    const name=`${p?.name||''}`.toLowerCase().replace(/\s+/g,'');
    if(carrierName==='SKT'&&name.includes('t플랜세이브'))return 0;
    if(carrierName==='KT'&&name.includes('베이직')&&name.includes('4gb')&&name.includes('65'))return 0;
    if(carrierName==='LGU+'&&name.includes('데이터플랜')&&name.includes('9gb')&&name.includes('시니어'))return 0;
    if(planFeatureMatch(p,'senior'))return 1;
    return 2;
  }
  function purposeIsSecondDevicePlan(p){
    const text=`${p?.name||''} ${p?.description||''}`.toLowerCase().replace(/\s+/g,'');
    return /데이터(쉐어링|셰어링|함께쓰기|투게더)|함께쓰기|태블릿|tablet|아이패드|ipad|스마트기기|워치|watch|세컨드디바이스|2nddevice/.test(text);
  }
  function purposeSalesBrandRank(d,category){
    const text=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    const samsung=/삼성|samsung|갤럭시|galaxy/.test(text),apple=/애플|apple|아이폰|iphone/.test(text),xiaomi=/샤오미|xiaomi|홍미|redmi/.test(text);
    if(category==='premium'){if(samsung)return 0;if(apple)return 1;if(xiaomi)return 8;return 3}
    if(samsung)return 0;if(apple)return 3;if(xiaomi)return 9;return 2;
  }
  function purposeValueDeviceRank(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    if(d?.carrier==='KT'&&(text.includes('jump5')||text.includes('점프5')))return 0;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀7')||text.includes('quantum7')))return 0;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀6')||text.includes('quantum6')))return 1;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀5')||text.includes('quantum5')))return 2;
    return deviceBrandKey(d)==='samsung'?4:9;
  }
  function purposeValuePlanTarget(carrierName){
    return carrierName==='SKT'?66000:carrierName==='KT'?61000:carrierName==='LGU+'?63000:63000;
  }
  function purposePremiumStorageGb(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    if(/2tb/.test(text))return 2048;
    if(/1tb/.test(text))return 1024;
    if(/512gb|512g/.test(text))return 512;
    if(/256gb|256g/.test(text))return 256;
    if(/128gb|128g/.test(text))return 128;
    return null;
  }
  function purposePremiumStorageRank(d){
    const storage=purposePremiumStorageGb(d);return storage===256?0:storage===512?1:9;
  }
  function purposePremiumDeviceFamily(d){
    const name=String(d?.name||'').toLowerCase().replace(/\b(128gb|256gb|512gb|1tb|2tb)\b/gi,'').replace(/\s+/g,' ').trim();
    return `${d?.carrier||''}|${name}`;
  }
  function purposePremiumFamilyKey(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    if(/s26ultra/.test(text))return 's26ultra';
    if(/s26\+|s26plus/.test(text))return 's26plus';
    if(/갤럭시s26|galaxys26/.test(text))return 's26';
    if(/폴드8|fold8/.test(text))return 'fold8';
    if(/플립8|flip8/.test(text))return 'flip8';
    if(/아이폰18|iphone18/.test(text))return 'iphone18';
    return 'other';
  }
  function purposePremiumFamilyRank(d){
    const order={s26:0,s26plus:1,s26ultra:2,fold8:3,flip8:4,iphone18:5};
    const key=purposePremiumFamilyKey(d);return Object.prototype.hasOwnProperty.call(order,key)?order[key]:99;
  }
  function purposePremiumLineupLabel(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    if(/s26ultra/.test(text))return '갤럭시 S26 시리즈 · Ultra';
    if(/s26\+|s26plus/.test(text))return '갤럭시 S26 시리즈 · S26+';
    if(/갤럭시s26|galaxys26|s26/.test(text))return '갤럭시 S26 시리즈 · S26';
    if(/폴드8|fold8/.test(text))return '갤럭시 Z 폴더블8 · Fold8';
    if(/플립8|flip8/.test(text))return '갤럭시 Z 폴더블8 · Flip8';
    if(/아이폰18|iphone18/.test(text))return 'iPhone 18 시리즈';
    return '프리미엄 라인업';
  }
  function purposePremiumSupportFit(s){
    return !!s?.known&&s.method==='support'&&Number(s.support)>=400000&&Number(s.support)<=500000;
  }
  function purposeDevicePool(category,carrierValue){
    let rows=(catalog?.devices||[]).filter(d=>(carrierValue==='all'||d.carrier===carrierValue)&&hasAmount(d.retail_price)&&Number(d.retail_price)>0&&!purposeObsoleteDevice(d)&&!purposeIsDeprecatedKidsDevice(d));
    if(category==='senior')rows=rows.filter(d=>purposeIsLowCostDevice(d)&&!purposeIsKidsOnlyDevice(d));
    else if(category==='kids')rows=rows.filter(d=>purposeKidsDeviceRank(d)<99);
    else if(category==='value')rows=rows.filter(d=>{
      const price=Number(d.retail_price)||0,rank=purposeValueDeviceRank(d);
      return rank<9&&(rank<=2||(price>=400000&&price<800000));
    });
    else if(category==='premium')rows=rows.filter(purposeIsPremiumDevice);
    if(category==='senior'){
      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    if(category==='kids'){
      return rows.sort((a,b)=>purposeKidsDeviceRank(a)-purposeKidsDeviceRank(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||byNewest(a,b)).slice(0,60);
    }
    if(category==='value'){
      return rows.sort((a,b)=>purposeValueDeviceRank(a)-purposeValueDeviceRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,120);
    }
    if(category==='premium'){
      return rows.sort((a,b)=>purposePremiumFamilyRank(a)-purposePremiumFamilyRank(b)||purposePremiumStorageRank(a)-purposePremiumStorageRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);
  }
  function purposePlanPool(d,category,joinLabel){
    const ids=devicePlanIds(d,joinLabel);if(!ids.length)return[];
    let rows=(catalog?.mobile_plans||[]).filter(p=>p.carrier===d.carrier&&ids.includes(p.id)&&hasAmount(p.monthly_fee)&&Number(p.monthly_fee)>=33000&&!purposeIsSecondDevicePlan(p));
    if(category==='senior'){
      rows=rows.filter(p=>Number(p.monthly_fee)<=55000);
      if(!rows.length)return[];
      const preferred=rows.filter(p=>purposeSeniorPlanRank(p,d.carrier)===0);
      if(preferred.length)rows=preferred;
      else{
        const senior=rows.filter(p=>purposeSeniorPlanRank(p,d.carrier)===1);
        if(senior.length)rows=senior;
      }
      const target=purposeSeniorPlanTarget(d.carrier);
      return rows.sort((a,b)=>purposeSeniorPlanRank(a,d.carrier)-purposeSeniorPlanRank(b,d.carrier)||Math.abs(Number(a.monthly_fee)-target)-Math.abs(Number(b.monthly_fee)-target)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,40);
    }else if(category==='kids'){
      rows=rows.filter(p=>planFeatureMatch(p,'kids'));
    }else if(category==='value'){
      const practical=rows.filter(p=>Number(p.monthly_fee)>=55000&&Number(p.monthly_fee)<=75000);if(practical.length)rows=practical;
      const target=purposeValuePlanTarget(d.carrier);
      return rows.sort((a,b)=>Math.abs(Number(a.monthly_fee)-target)-Math.abs(Number(b.monthly_fee)-target)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,40);
    }else if(category==='premium'){
      rows=rows.filter(p=>Number(p.monthly_fee)>=80000);
      return rows.sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,80);
    }
    return rows.sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee)||byOrder(a,b)).slice(0,40);
  }
  function purposeCandidateForDevice(d,category,joinLabel,usePension){
    if(category==='senior'&&purposeIsKidsOnlyDevice(d))return null;
    const welfare=category==='senior'&&usePension?'basic_pension':'none',plans=purposePlanPool(d,category,joinLabel);let best=null;
    for(const p of plans){
      const support=scenarioForSelection(d,p,joinLabel,'support',24,welfare),contract=scenarioForSelection(d,p,joinLabel,'contract',24,welfare),known=[support,contract].filter(x=>x?.known).sort((a,b)=>a.total24-b.total24);
      if(!known.length)continue;const selected=known[0],row={d,p,best:selected,support,contract,welfare};
      if(category==='senior'){
        if(!best||purposeSeniorPlanRank(p,d.carrier)<purposeSeniorPlanRank(best.p,d.carrier)||(purposeSeniorPlanRank(p,d.carrier)===purposeSeniorPlanRank(best.p,d.carrier)&&row.best.total24<best.best.total24))best=row;
      }else if(category==='value'){
        const target=purposeValuePlanTarget(d.carrier),rowDiff=Math.abs(Number(p.monthly_fee)-target),bestDiff=best?Math.abs(Number(best.p.monthly_fee)-target):Infinity;
        if(!best||rowDiff<bestDiff||(rowDiff===bestDiff&&row.best.total24<best.best.total24))best=row;
      }else if(category==='premium'){
        if(!purposePremiumSupportFit(support))continue;
        row.best=support;
        const rowSupportDiff=Math.abs(Number(support.support)-450000),bestSupportDiff=best?Math.abs(Number(best.support.support)-450000):Infinity;
        if(!best||rowSupportDiff<bestSupportDiff||(rowSupportDiff===bestSupportDiff&&Number(p.monthly_fee)<Number(best.p.monthly_fee))||(rowSupportDiff===bestSupportDiff&&Number(p.monthly_fee)===Number(best.p.monthly_fee)&&support.total24<best.support.total24))best=row;
      }else if(!best||row.best.total24<best.best.total24)best=row;
    }
    return best;
  }
  function purposeRecommendations(){
    const carrierValue=$('purpose-carrier')?.value||'all',joinLabel=$('purpose-join')?.value||'기기변경',usePension=!!$('purpose-pension')?.checked,rows=[];
    purposeDevicePool(purposeCategory,carrierValue).forEach(d=>{const row=purposeCandidateForDevice(d,purposeCategory,joinLabel,usePension);if(row)rows.push(row)});
    if(purposeCategory==='senior'){
      rows.sort((a,b)=>purposeSeniorDeviceRank(a.d)-purposeSeniorDeviceRank(b.d)||purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||purposeSeniorPlanRank(a.p,a.d.carrier)-purposeSeniorPlanRank(b.p,b.d.carrier)||a.best.total24-b.best.total24);
    }else if(purposeCategory==='value'){
      rows.sort((a,b)=>purposeValueDeviceRank(a.d)-purposeValueDeviceRank(b.d)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||Math.abs(Number(a.p.monthly_fee)-purposeValuePlanTarget(a.d.carrier))-Math.abs(Number(b.p.monthly_fee)-purposeValuePlanTarget(b.d.carrier))||a.best.total24-b.best.total24);
    }else if(purposeCategory==='kids'){
      rows.sort((a,b)=>purposeKidsDeviceRank(a.d)-purposeKidsDeviceRank(b.d)||purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
    }else if(purposeCategory==='premium'){
      rows.sort((a,b)=>purposePremiumFamilyRank(a.d)-purposePremiumFamilyRank(b.d)||purposePremiumStorageRank(a.d)-purposePremiumStorageRank(b.d)||Math.abs(Number(a.support.support)-450000)-Math.abs(Number(b.support.support)-450000)||Number(a.p.monthly_fee)-Number(b.p.monthly_fee)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
    }else rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));
    if(purposeCategory==='premium'){
      const unique=[],seenFamilies=new Set();
      for(const row of rows){const family=purposePremiumFamilyKey(row.d);if(family==='other'||seenFamilies.has(family))continue;seenFamilies.add(family);unique.push(row);if(unique.length>=6)break}
      if(unique.length<6){for(const row of rows){if(unique.includes(row))continue;unique.push(row);if(unique.length>=6)break}}
      return unique;
    }
    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }
    return unique;
  }
  function purposeCardLine(label,value,cls=''){
    const line=document.createElement('div');if(cls)line.className=cls;const a=document.createElement('span'),b=document.createElement('b');a.textContent=label;b.textContent=value;line.append(a,b);return line;
  }
  function purposeQuoteText(row){
    if(!row)return '';const method=row.best.method==='support'?'공시지원금':'선택약정 25%',joinLabel=$('purpose-join')?.value||'기기변경',lines=['[웅비통신 용도별 추천 상담]',`용도: ${{senior:'효도폰',kids:'키즈폰',value:'가성비폰',premium:'프리미엄폰'}[purposeCategory]||'휴대폰'}`,`통신사: ${row.d.carrier}`,`가입유형: ${joinLabel}`,`기종: ${row.d.name}`,`요금제: ${row.p.name} / ${won(row.p.monthly_fee)}`,`추천 할인방식: ${method}`,`예상 월 납부액: ${won(row.best.monthly)}`,`24개월 총 예상비용: ${won(row.best.total24)}`];
    if(row.welfare==='basic_pension')lines.push(`기초연금 수급자 할인: -${won(row.best.welfare?.amount||0)}`);
    if(purposeCategory==='premium'&&row.support?.known)lines.push(`공시지원금: -${won(row.support.support)}`,`지원 후 기기값: ${won(row.support.principal)}`);
    lines.push('※ 실제 가입 가능 여부·자격·지원금·프로모션은 상담 시점에 최종 확인합니다.');return lines.join('\n');
  }
  function renderPurposeRecommendations(){
    const box=$('purpose-results'),note=$('purpose-category-note'),pensionWrap=$('purpose-pension-wrap');if(!box)return;if(note)note.textContent=PURPOSE_COPY[purposeCategory]||'';if(pensionWrap)pensionWrap.hidden=purposeCategory!=='senior';
    document.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.purposeCategory===purposeCategory));
    const rows=purposeRecommendations();box.innerHTML='';
    if(!catalog){box.innerHTML='<p>추천 조건을 불러오는 중입니다.</p>';return}
    if(!rows.length){box.innerHTML='<p>현재 등록된 데이터에서 이 조건에 맞는 조합을 찾지 못했습니다. 통신사나 가입유형을 바꾸거나 직접 계산을 이용해 주세요.</p>';return}
    rows.forEach((row,index)=>{
      const card=document.createElement('article');card.className='purpose-card';
      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${$('purpose-join')?.value||'기기변경'}`;rank.textContent=purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):purposeCategory==='value'?(index===0?'가성비 추천':'추천 조합'):purposeCategory==='premium'?(index===0?'공시지원 중심':'기기값 할인 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');top.append(badge,rank);
      const name=document.createElement('strong');name.textContent=row.d.name;const lineup=document.createElement('span');lineup.className='purpose-lineup';lineup.textContent=purposeCategory==='premium'?purposePremiumLineupLabel(row.d):'';const plan=document.createElement('em');plan.textContent=row.p.name;
      const total=document.createElement('div');total.className='purpose-card-total';const totalLabel=document.createElement('span'),totalValue=document.createElement('b');totalLabel.textContent='예상 월 납부액';totalValue.textContent=won(row.best.monthly);total.append(totalLabel,totalValue);
      const detail=document.createElement('div');detail.className='purpose-card-detail';if(purposeCategory==='premium'&&row.support?.known)detail.append(purposeCardLine('공시지원금','-'+won(row.support.support)),purposeCardLine('지원 후 기기값',won(row.support.principal)));detail.append(purposeCardLine('월 기기값 · 이자 포함',won(row.best.inst.monthly)),purposeCardLine('할인 후 통신요금',won(row.best.service)));if(row.welfare==='basic_pension')detail.append(purposeCardLine('기초연금 수급자 할인','-'+won(row.best.welfare?.amount||0),'welfare-line'));
      const compare=document.createElement('div');compare.className='purpose-method-compare';const sText=row.support?.known?won(row.support.monthly):'매장 확인',cText=row.contract?.known?won(row.contract.monthly):'매장 확인';compare.append(purposeCardLine('공시지원 월',sText),purposeCardLine('선택약정 월',cText));
      const best=document.createElement('div');best.className='purpose-best';best.textContent=purposeCategory==='premium'&&row.support?.known?`기기값 할인 중심 · 공시지원금 ${won(row.support.support)} · 지원 후 기기값 ${won(row.support.principal)}`:`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준 · 24개월 총 예상비용 ${won(row.best.total24)}`;
      const actions=document.createElement('div');actions.className='purpose-card-actions';const detailBtn=document.createElement('button'),consultBtn=document.createElement('button');detailBtn.type='button';consultBtn.type='button';detailBtn.textContent='자세히 계산';consultBtn.textContent='이 조건 상담';consultBtn.className='primary';detailBtn.addEventListener('click',()=>applyPurposeResult(row));consultBtn.addEventListener('click',async()=>{const ok=await copyCustomerConsultText(purposeQuoteText(row));if(ok)window.location.href='http://pf.kakao.com/_nWwNT/chat'});actions.append(detailBtn,consultBtn);
      card.append(top,name);if(purposeCategory==='premium'&&lineup.textContent)card.append(lineup);card.append(plan,total,detail,compare,best,actions);box.appendChild(card);
    });
  }
  function applyPurposeResult(row){
    if(!row)return;deviceBrandFilter=deviceBrandKey(row.d);updateDeviceBrandButtons();carrier.value=row.d.carrier;joinType.value=$('purpose-join')?.value||'기기변경';discountMethod.value=row.best.method;welfareType.value=row.welfare||'none';deviceSearch.value=row.d.name||'';fillDevices();deviceSelect.value=row.d.id;fillPlans();planSelect.value=row.p.id;deviceSearch.value='';fillDevices();deviceSelect.value=row.d.id;fillPlans();planSelect.value=row.p.id;setMobileMode('direct');syncMobile();$('direct-mobile-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function setMobileMode(mode){
    const purpose=mode==='purpose',quick=mode==='quick';$('purpose-recommend').hidden=!purpose;$('quick-recommend').hidden=!quick;$('direct-mobile-grid').hidden=purpose||quick;
    document.querySelectorAll('[data-mobile-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mobileMode===mode));
    if(purpose)renderPurposeRecommendations();if(quick){$('quick-carrier').value=carrier.value;$('quick-join').value=joinType.value}syncQuoteBar();
  }
  function quickPlanMeets(p,need){const gb=planDataGb(p);if(need==='unlimited')return planHasUnlimited(p);return gb!==null&&gb>=Number(need)}
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
    deviceBrandFilter=deviceBrandKey(d);updateDeviceBrandButtons();carrier.value=d.carrier;joinType.value=$('quick-join').value;discountMethod.value=method;deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;deviceSearch.value='';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;setMobileMode('direct');syncMobile();document.getElementById('direct-mobile-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
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
    const box=$('recent-quote-list');if(!box)return;const rows=readRecentQuotes(),validIds=new Set(rows.map(row=>row.id).filter(Boolean));
    [...recentQuoteCompareSelection].forEach(id=>{if(!validIds.has(id))recentQuoteCompareSelection.delete(id)});box.innerHTML='';
    if(!rows.length){box.innerHTML='<p>아직 저장된 견적이 없습니다.</p>';syncSavedQuoteCompareControls();return}
    rows.forEach(row=>{
      const item=document.createElement('div');item.className='recent-quote-item';if(recentQuoteCompareSelection.has(row.id))item.classList.add('compare-selected');
      const open=document.createElement('button');open.type='button';open.className='recent-quote-open';open.dataset.url=row.url||'';
      const when=row.savedAt?new Date(row.savedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      const meta=document.createElement('span'),id=document.createElement('b'),time=document.createElement('small'),device=document.createElement('strong'),detail=document.createElement('em');
      id.textContent=row.id||'저장 견적';time.textContent=when;meta.append(id,time);device.textContent=row.device||'';detail.textContent=`${row.plan||''}${row.monthly?` · ${won(row.monthly)}`:''}`;open.append(meta,device,detail);
      const compare=document.createElement('button');compare.type='button';compare.className='recent-quote-compare-toggle';compare.dataset.quoteId=row.id||'';compare.setAttribute('aria-pressed',recentQuoteCompareSelection.has(row.id)?'true':'false');compare.textContent=recentQuoteCompareSelection.has(row.id)?'선택됨':'비교';
      const remove=document.createElement('button');remove.type='button';remove.className='recent-quote-delete';remove.dataset.quoteId=row.id||'';remove.setAttribute('aria-label',`${row.id||'저장 견적'} 삭제`);remove.title='저장 견적 삭제';remove.textContent='×';
      item.append(open,compare,remove);box.appendChild(item);
    });
    syncSavedQuoteCompareControls();
  }
  function savedQuoteCompareData(row){
    if(!row)return null;let params=null;try{params=new URL(row.url||'',location.href).searchParams}catch(e){}
    const deviceId=row.deviceId||params?.get('d')||'',planId=row.planId||params?.get('p')||'';
    const d=(catalog?.devices||[]).find(x=>x.id===deviceId)||null,p=(catalog?.mobile_plans||[]).find(x=>x.id===planId)||null;
    const carrierValue=row.carrier||params?.get('c')||d?.carrier||'',joinValue=row.join||params?.get('j')||'',method=row.method||params?.get('m')||'support',months=row.months||params?.get('mo')||'24',welfare=row.welfare||params?.get('w')||'none';
    const scenario=d&&p?scenarioForSelection(d,p,joinValue,method,months,welfare):null;
    return {id:row.id||'저장 견적',device:row.device||d?.name||'—',carrier:carrierValue||'—',join:joinValue||'—',plan:row.plan||p?.name||'—',method:method==='contract'?'선택약정':'공시지원금',monthly:hasAmount(row.monthly)?Number(row.monthly):(scenario?.known?scenario.monthly:null),total24:hasAmount(row.total24)?Number(row.total24):(scenario?.known?scenario.total24:null),deviceMonthly:hasAmount(row.deviceMonthly)?Number(row.deviceMonthly):(scenario?.known?scenario.inst?.monthly:null),serviceMonthly:hasAmount(row.serviceMonthly)?Number(row.serviceMonthly):(scenario?.known?scenario.service:null)};
  }
  function syncSavedQuoteCompareControls(){
    const button=$('compare-saved-quotes'),status=$('quote-compare-status'),panel=$('saved-quote-compare'),count=recentQuoteCompareSelection.size;
    if(button)button.disabled=count!==2;if(status)status.textContent=count?`${count}/2 선택됨 · ${count===2?'비교할 준비가 됐어요.':'견적을 하나 더 선택하세요.'}`:'비교할 견적 2개를 선택하세요.';
    if(panel&&count!==2)panel.hidden=true;
  }
  function toggleSavedQuoteCompare(id){
    if(!id)return;if(recentQuoteCompareSelection.has(id))recentQuoteCompareSelection.delete(id);else{if(recentQuoteCompareSelection.size>=2){const status=$('quote-action-status');if(status)status.textContent='저장 견적 비교는 2개까지 선택할 수 있습니다.';return}recentQuoteCompareSelection.add(id)}
    renderRecentQuotes();
  }
  function renderSavedQuoteComparison(){
    const panel=$('saved-quote-compare'),table=$('saved-quote-compare-table'),diff=$('saved-quote-compare-diff');if(!panel||!table)return;
    const ids=[...recentQuoteCompareSelection];if(ids.length!==2){syncSavedQuoteCompareControls();return}
    const rows=readRecentQuotes(),left=savedQuoteCompareData(rows.find(row=>row.id===ids[0])),right=savedQuoteCompareData(rows.find(row=>row.id===ids[1]));if(!left||!right)return;
    table.innerHTML='';
    const addCell=(text,cls='')=>{const el=document.createElement('div');el.className=`saved-quote-compare-cell ${cls}`.trim();el.textContent=text;table.appendChild(el)};
    addCell('항목','compare-label compare-header');addCell(left.id,'compare-value compare-header');addCell(right.id,'compare-value compare-header');
    const addRow=(label,a,b,highlight=false)=>{addCell(label,'compare-label');addCell(a,'compare-value'+(highlight?' compare-highlight':''));addCell(b,'compare-value'+(highlight?' compare-highlight':''))};
    addRow('기종',left.device,right.device);addRow('통신사 · 가입',`${left.carrier} · ${left.join}`,`${right.carrier} · ${right.join}`);addRow('요금제',left.plan,right.plan);addRow('할인 방식',left.method,right.method);addRow('월 단말금',hasAmount(left.deviceMonthly)?won(left.deviceMonthly):'확인 필요',hasAmount(right.deviceMonthly)?won(right.deviceMonthly):'확인 필요');addRow('월 통신요금',hasAmount(left.serviceMonthly)?won(left.serviceMonthly):'확인 필요',hasAmount(right.serviceMonthly)?won(right.serviceMonthly):'확인 필요');addRow('예상 월 납부액',hasAmount(left.monthly)?won(left.monthly):'확인 필요',hasAmount(right.monthly)?won(right.monthly):'확인 필요',true);addRow('24개월 총비용',hasAmount(left.total24)?won(left.total24):'확인 필요',hasAmount(right.total24)?won(right.total24):'확인 필요',true);
    const notes=[];if(hasAmount(left.monthly)&&hasAmount(right.monthly))notes.push(`월 납부액 차이 ${won(Math.abs(left.monthly-right.monthly))}`);if(hasAmount(left.total24)&&hasAmount(right.total24))notes.push(`24개월 총비용 차이 ${won(Math.abs(left.total24-right.total24))}`);if(diff)diff.textContent=notes.length?notes.join(' · '):'저장 시점의 조건을 기준으로 비교합니다.';
    panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function deleteRecentQuote(id){
    if(!id)return;const rows=readRecentQuotes(),next=rows.filter(row=>row.id!==id);if(next.length===rows.length)return;
    recentQuoteCompareSelection.delete(id);writeRecentQuotes(next);renderRecentQuotes();const status=$('quote-action-status');if(status)status.textContent=`${id} 저장 견적을 삭제했습니다.`;
  }
  function syncQuoteMemory(){ensureQuoteId();renderRecentQuotes()}
  function saveCurrentQuote(){
    const d=currentDevice(),p=currentPlan();if(!d||!p){$('quote-action-status').textContent='기종과 요금제를 먼저 선택해 주세요.';return}
    ensureQuoteId();const scenario=mobileScenario(discountMethod.value),row={id:currentQuoteId,fingerprint:currentQuoteFingerprint,url:buildQuoteUrl(),carrier:carrier.value,join:joinType.value,device:d.name,deviceId:d.id,plan:p.name,planId:p.id,method:discountMethod.value,months:monthsSelect.value||'24',welfare:welfareType.value||'none',monthly:scenario?.known?scenario.monthly:null,total24:scenario?.known?scenario.total24:null,deviceMonthly:scenario?.known?scenario.inst?.monthly:null,serviceMonthly:scenario?.known?scenario.service:null,planFee:scenario?.known?scenario.planFee:null,savedAt:Date.now()};
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
  function syncMobile(){syncPlanPickerTrigger();syncMobileCore();syncComparison();syncQuoteBar();syncCalcExplanation();syncQuoteMemory();syncQuoteUrl();syncDeviceCompare()}


  [carrier,joinType].forEach(el=>el.addEventListener('change',fillDevices));discountMethod.addEventListener('change',fillPlans);deviceSelect.addEventListener('change',fillPlans);planSelect.addEventListener('change',syncMobile);monthsSelect.addEventListener('change',syncMobile);welfareType.addEventListener('change',syncMobile);
  deviceSearch?.addEventListener('input',fillDevices);
  document.querySelectorAll('[data-device-brand]').forEach(btn=>btn.addEventListener('click',()=>{
    deviceBrandFilter=btn.dataset.deviceBrand||'all';if(deviceSearch)deviceSearch.value='';deviceSelect.value='';updateDeviceBrandButtons();fillDevices();
  }));
  $('plan-picker-open')?.addEventListener('click',openPlanPicker);
  $('plan-picker-close')?.addEventListener('click',()=>closePlanPicker());
  $('plan-picker-backdrop')?.addEventListener('click',e=>{if(e.target===$('plan-picker-backdrop'))closePlanPicker()});
  $('plan-picker-search')?.addEventListener('input',e=>{planPickerState.query=e.target.value||'';renderPlanPicker()});
  $('plan-picker-sort')?.addEventListener('change',e=>{planPickerState.sort=e.target.value||'source';renderPlanPicker()});
  document.querySelectorAll('[data-plan-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{planPickerState[btn.dataset.planFilterGroup]=btn.dataset.planFilterValue;renderPlanPicker()}));
  document.querySelectorAll('[data-plan-quick-price]').forEach(btn=>btn.addEventListener('click',()=>{if(!currentDevice())return;planPickerState.data='all';planPickerState.feature='all';planPickerState.price=btn.dataset.planQuickPrice||'all';planPickerState.sort='source';planPickerState.query='';if($('plan-picker-search'))$('plan-picker-search').value='';openPlanPicker()}));
  document.querySelectorAll('[data-plan-quick-feature]').forEach(btn=>btn.addEventListener('click',()=>{if(!currentDevice())return;planPickerState.data='all';planPickerState.price='all';planPickerState.feature=btn.dataset.planQuickFeature||'all';planPickerState.sort='source';planPickerState.query='';if($('plan-picker-search'))$('plan-picker-search').value='';openPlanPicker()}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('plan-picker-backdrop')?.hidden)closePlanPicker()});
  document.querySelectorAll('.compare-card').forEach(card=>card.addEventListener('click',()=>{discountMethod.value=card.dataset.method;syncMobile()}));
  $('copy-quote')?.addEventListener('click',()=>copyQuote(true));
  $('share-quote')?.addEventListener('click',shareQuote);
  $('consult-quote')?.addEventListener('click',consultQuote);
  $('mobile-quote-detail')?.addEventListener('click',()=>document.getElementById('mobile-result')?.scrollIntoView({behavior:'smooth',block:'start'}));
  $('mobile-quote-consult')?.addEventListener('click',consultQuote);
  $('save-quote')?.addEventListener('click',saveCurrentQuote);
  $('recent-quote-list')?.addEventListener('click',e=>{const compare=e.target.closest('.recent-quote-compare-toggle');if(compare){e.preventDefault();e.stopPropagation();toggleSavedQuoteCompare(compare.dataset.quoteId);return}const remove=e.target.closest('.recent-quote-delete');if(remove){e.preventDefault();e.stopPropagation();deleteRecentQuote(remove.dataset.quoteId);return}const open=e.target.closest('.recent-quote-open');if(open?.dataset.url)location.href=open.dataset.url});
  $('compare-saved-quotes')?.addEventListener('click',renderSavedQuoteComparison);
  $('close-saved-quote-compare')?.addEventListener('click',()=>{const panel=$('saved-quote-compare');if(panel)panel.hidden=true});
  document.querySelectorAll('[data-mobile-mode]').forEach(btn=>btn.addEventListener('click',()=>setMobileMode(btn.dataset.mobileMode)));
  document.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.addEventListener('click',()=>{purposeCategory=btn.dataset.purposeCategory||'senior';renderPurposeRecommendations()}));
  ['purpose-carrier','purpose-join','purpose-pension'].forEach(id=>$(id)?.addEventListener('change',renderPurposeRecommendations));
  $('quick-find')?.addEventListener('click',renderQuickRecommendations);
  ['quick-carrier','quick-join','quick-brand','quick-data','quick-budget'].forEach(id=>$(id)?.addEventListener('change',()=>{$('quick-results').innerHTML='<p>조건이 바뀌었습니다. 추천 3개 찾기를 눌러주세요.</p>'}));
  ['device-compare-2','device-compare-3'].forEach(id=>$(id)?.addEventListener('change',syncDeviceCompare));


  // 공신폰 · KT M모바일 갤럭시 A17
  const studyphonePlan=$('studyphone-plan');
  function studyphoneCurrentPlan(){return (studyphoneData?.plans||[]).find(p=>p.id===studyphonePlan?.value)||null}
  function studyphoneInstallment(principal,months,apr){
    principal=Math.max(0,Number(principal)||0);months=Math.max(1,Number(months)||24);apr=Number(apr)||0;
    if(!principal)return {monthly:0,total:0,fee:0};
    if(!apr){const monthly=principal/months;return {monthly,total:principal,fee:0}}
    const r=apr/12,factor=Math.pow(1+r,months),monthly=principal*r*factor/(factor-1),total=monthly*months;
    return {monthly,total,fee:Math.max(0,total-principal)};
  }
  function studyphoneScenario(plan){
    const d=studyphoneData?.device;if(!d||!plan)return null;
    const retail=Number(d.retail_price)||0,support=Math.max(0,Math.min(retail,Number(plan.public_support)||0)),principal=Math.max(0,retail-support);
    const inst=studyphoneInstallment(principal,Number(d.installment_months)||24,Number(d.installment_apr)||0);
    const service=Number(plan.monthly_fee)||0;
    return {retail,support,principal,inst,service,total:inst.monthly+service};
  }
  function studyphoneQuoteText(){
    const d=studyphoneData?.device,p=studyphoneCurrentPlan();if(!d||!p)return '';const scenario=studyphoneScenario(p);
    return ['[웅비통신 공신폰 상담]',`통신사: ${d.provider||'KT M모바일'}`,`기종: ${d.name||'갤럭시 A17 공신폰'}${d.model?' ('+d.model+')':''}`,`요금제: ${p.name}`,`월 기본료: ${won(p.monthly_fee)}`,`통화: ${p.voice||'확인 필요'}`,`문자: ${p.sms||'확인 필요'}`,`데이터: ${p.data||'확인 필요'}`,`공시지원금: ${won(scenario.support)}`,`할부원금: ${won(scenario.principal)}`,`예상 월 납부액: ${won(scenario.total)}`,'※ 실제 개통 조건은 상담 시점에 최종 확인해 주세요.'].join('\n');
  }
  function renderStudyphonePlanList(){
    const box=$('studyphone-plan-list');if(!box)return;
    const d=studyphoneData?.device,rows=studyphoneData?.plans||[];
    if(!d||!rows.length){box.innerHTML='<p>요금제 데이터를 불러오지 못했습니다.</p>';return}
    box.innerHTML=rows.map(p=>{const s=studyphoneScenario(p);return `<button type="button" class="studyphone-plan-card${studyphonePlan?.value===p.id?' active':''}" data-studyphone-plan="${p.id}"><span>${p.name}</span><strong>${won(p.monthly_fee)}</strong><small>통화 ${p.voice} · 문자 ${p.sms} · 데이터 ${p.data}</small><div><em>공시지원금</em><b>${won(p.public_support)}</b></div><div><em>할부원금</em><b>${won(s.principal)}</b></div><div class="studyphone-card-total"><em>월 예상 납부액</em><b>${won(s.total)}</b></div></button>`}).join('');
  }
  function syncStudyphone(){
    const d=studyphoneData?.device,p=studyphoneCurrentPlan();
    if(!d){return}
    $('studyphone-retail-view').textContent=won(d.retail_price);$('studyphone-retail').textContent=won(d.retail_price);
    if(!p){
      ['studyphone-voice','studyphone-sms','studyphone-data','studyphone-plan-fee','studyphone-total','studyphone-support','studyphone-principal','studyphone-device-monthly','studyphone-interest','studyphone-service-fee'].forEach(id=>{const el=$(id);if(el)el.textContent='—'});
      $('studyphone-summary').textContent='요금제를 선택하면 공시지원금, 할부원금과 월 예상 납부액을 계산합니다.';renderStudyphonePlanList();return;
    }
    const s=studyphoneScenario(p),months=Number(d.installment_months)||24;
    $('studyphone-voice').textContent=p.voice||'—';$('studyphone-sms').textContent=p.sms||'—';$('studyphone-data').textContent=p.data||'—';$('studyphone-plan-fee').textContent=won(p.monthly_fee);
    $('studyphone-total').textContent=won(s.total);$('studyphone-support').textContent=won(s.support);$('studyphone-principal').textContent=won(s.principal);$('studyphone-device-monthly').textContent=won(s.inst.monthly);$('studyphone-interest').textContent=won(s.inst.fee);$('studyphone-service-fee').textContent=won(s.service);
    $('studyphone-summary').textContent=`${p.name} · 할부원금 ${won(s.principal)} · 월 단말금 ${won(s.inst.monthly)} + 요금제 ${won(s.service)} = 월 예상 ${won(s.total)} (${months}개월 기준)`;
    renderStudyphonePlanList();
  }
  function fillStudyphone(){
    if(!studyphonePlan)return;studyphonePlan.innerHTML='';option(studyphonePlan,'','요금제를 선택하세요');(studyphoneData?.plans||[]).forEach(p=>option(studyphonePlan,p.id,`${p.name} · ${won(p.monthly_fee)}`));syncStudyphone();renderStudyphonePlanList();
  }
  studyphonePlan?.addEventListener('change',syncStudyphone);
  $('studyphone-plan-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-studyphone-plan]');if(!b||!studyphonePlan)return;studyphonePlan.value=b.dataset.studyphonePlan;syncStudyphone();document.querySelector('[data-panel="studyphone"]')?.scrollIntoView({behavior:'smooth',block:'start'})});
  $('copy-studyphone-quote')?.addEventListener('click',async()=>{const text=studyphoneQuoteText(),status=$('studyphone-quote-status');if(!text){if(status)status.textContent='요금제를 먼저 선택해 주세요.';return}const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다.':'복사하지 못했습니다. 다시 시도해 주세요.'});
  $('share-studyphone-quote')?.addEventListener('click',()=>shareCustomerConsultText('웅비통신 공신폰 상담',studyphoneQuoteText(),'studyphone-quote-status'));
  $('consult-studyphone-quote')?.addEventListener('click',()=>consultWithCustomerText(studyphoneQuoteText(),'studyphone-quote-status'));

  // 알뜰폰 후불
  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan'),mvnoSort=$('mvno-sort');
  const mvnoPickerOpen=$('mvno-plan-picker-open'),mvnoPickerBackdrop=$('mvno-plan-picker-backdrop'),mvnoPickerClose=$('mvno-plan-picker-close'),mvnoPickerSearch=$('mvno-plan-picker-search'),mvnoPickerList=$('mvno-plan-picker-list'),mvnoPickerCount=$('mvno-plan-picker-count');
  let mvnoPickerQuery='';
  function mvnoPlanFee(p){return p?.special_monthly_fee??p?.monthly_fee}
  function mvnoPriceBandLabel(value){
    return {under10:'1만원 미만','10to20':'1만원 이상 · 2만원 미만','20to30':'2만원 이상 · 3만원 미만',unlimited:'데이터 무제한'}[value]||'';
  }
  function mvnoMatchesFilters(p){
    if(mvnoFilters.network!=='all'&&p.network!==mvnoFilters.network)return false;
    const fee=Number(mvnoPlanFee(p));
    if(mvnoFilters.price==='under10'&&!(hasAmount(mvnoPlanFee(p))&&fee<10000))return false;
    if(mvnoFilters.price==='10to20'&&!(hasAmount(mvnoPlanFee(p))&&fee>=10000&&fee<20000))return false;
    if(mvnoFilters.price==='20to30'&&!(hasAmount(mvnoPlanFee(p))&&fee>=20000&&fee<30000))return false;
    if(mvnoFilters.price==='unlimited'&&!planHasUnlimited(p))return false;
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
  function clearMvnoPickerQuery(){
    mvnoPickerQuery='';if(mvnoPickerSearch)mvnoPickerSearch.value='';
  }
  function filteredMvnoPlans(){
    const pid=mvnoProvider.value;
    let plans=(mvnoData.plans||[]).filter(p=>(pid==='all'||!pid||p.provider_id===pid)&&mvnoMatchesFilters(p));
    return sortMvnoPlans(plans);
  }
  function updateMvnoPickerSummary(plans=filteredMvnoPlans()){
    if(!mvnoPickerOpen)return;
    const selected=(mvnoData.plans||[]).find(p=>p.id===mvnoPlan.value)||null;
    const selectedProvider=(mvnoData.providers||[]).find(p=>p.id===selected?.provider_id)||null;
    const main=$('mvno-plan-picker-selected'),detail=$('mvno-plan-picker-selected-detail');
    mvnoPickerOpen.disabled=!mvnoProvider.value||!plans.length;
    if(selected){
      if(main)main.textContent=selected.name||'선택한 요금제';
      if(detail)detail.textContent=[selectedProvider?.name||selected.provider_id,selected.network?selected.network+'망':'',hasAmount(mvnoPlanFee(selected))?won(mvnoPlanFee(selected)):'매장 확인',selected.data?`데이터 ${selected.data}`:''].filter(Boolean).join(' · ');
      return;
    }
    if(!mvnoProvider.value){
      if(main)main.textContent='통신사 또는 필터를 선택하세요';
      if(detail)detail.textContent='조건을 고르면 요금제를 카드로 비교할 수 있습니다.';
      return;
    }
    if(!plans.length){
      if(main)main.textContent='조건에 맞는 요금제가 없습니다';
      if(detail)detail.textContent='빠른 필터 조건을 조금 넓혀보세요.';
      return;
    }
    if(main)main.textContent=`${plans.length.toLocaleString('ko-KR')}개 요금제에서 선택`;
    if(detail)detail.textContent='월요금·데이터·통화 정보를 카드로 비교해 보세요.';
  }
  function renderMvnoPlanCards(plans=filteredMvnoPlans()){
    if(!mvnoPickerList||!mvnoPickerCount)return;
    const providerMap=new Map((mvnoData.providers||[]).map(p=>[p.id,p]));
    const q=String(mvnoPickerQuery||'').trim().toLowerCase();
    let rows=plans;
    if(q)rows=rows.filter(p=>{
      const provider=providerMap.get(p.provider_id);
      return `${provider?.name||''} ${p.name||''} ${p.network||''} ${p.data||''} ${p.voice||''} ${p.sms||''}`.toLowerCase().includes(q);
    });
    const total=rows.length,visible=rows.slice(0,100);
    mvnoPickerList.innerHTML='';
    mvnoPickerCount.textContent=total>100?`${total.toLocaleString('ko-KR')}개 중 100개 표시 · 검색으로 더 좁혀보세요.`:`${total.toLocaleString('ko-KR')}개 요금제`;
    if(!total){
      const empty=document.createElement('p');empty.className='plan-picker-empty';empty.textContent='검색 또는 현재 필터 조건에 맞는 요금제가 없습니다.';mvnoPickerList.appendChild(empty);return;
    }
    visible.forEach(p=>{
      const provider=providerMap.get(p.provider_id),fee=mvnoPlanFee(p),card=document.createElement('button');
      card.type='button';card.className='plan-option-card';if(p.id===mvnoPlan.value)card.classList.add('selected');
      const top=document.createElement('span');top.className='plan-option-top';
      const name=document.createElement('strong');name.textContent=p.name||'요금제';
      const price=document.createElement('b');price.textContent=hasAmount(fee)?won(fee):'매장 확인';top.append(name,price);
      const meta=document.createElement('small');meta.textContent=[provider?.name||p.provider_id,p.network?`${p.network}망`:null].filter(Boolean).join(' · ');
      const tags=document.createElement('span');tags.className='plan-option-tags';
      [[p.data,'데이터'],[p.voice,'통화'],[p.sms,'문자']].forEach(([value,label])=>{if(!value)return;const chip=document.createElement('i');chip.textContent=`${label} ${value}`;tags.appendChild(chip)});
      const action=document.createElement('em');action.textContent=p.id===mvnoPlan.value?'선택됨':'이 요금제 선택';
      card.append(top,meta,tags,action);
      card.addEventListener('click',()=>{mvnoPlan.value=p.id;syncMvno();updateMvnoPickerSummary(plans);renderMvnoPlanCards(plans);closeMvnoPlanPicker();});
      mvnoPickerList.appendChild(card);
    });
  }
  function openMvnoPlanPicker(){
    if(!mvnoPickerBackdrop||mvnoPickerOpen?.disabled)return;clearMvnoPickerQuery();renderMvnoPlanCards();mvnoPickerBackdrop.hidden=false;document.body.classList.add('plan-picker-opened');setTimeout(()=>mvnoPickerSearch?.focus(),0);
  }
  function closeMvnoPlanPicker(){
    if(!mvnoPickerBackdrop)return;mvnoPickerBackdrop.hidden=true;document.body.classList.remove('plan-picker-opened');mvnoPickerOpen?.focus();
  }
  function fillMvnoProviders(){
    const keep=mvnoProvider.value;clearSelect(mvnoProvider,'통신사를 선택하세요');option(mvnoProvider,'all','전체 통신사');
    (mvnoData.providers||[]).slice().sort(byOrder).forEach(p=>option(mvnoProvider,p.id,p.name));
    if([...mvnoProvider.options].some(o=>o.value===keep))mvnoProvider.value=keep;fillMvnoPlans();
  }
  function fillMvnoPlans(){
    const pid=mvnoProvider.value,provider=(mvnoData.providers||[]).find(p=>p.id===pid),keep=mvnoPlan.value;
    clearSelect(mvnoPlan,pid?'요금제를 선택하세요':'통신사 또는 필터를 선택하세요');
    const plans=filteredMvnoPlans(),providerMap=new Map((mvnoData.providers||[]).map(p=>[p.id,p]));
    plans.forEach(p=>{const fee=mvnoPlanFee(p),prefix=pid==='all'?`${providerMap.get(p.provider_id)?.name||p.provider_id} · `:'';option(mvnoPlan,p.id,`${prefix}${p.name} · ${hasAmount(fee)?won(fee):'매장 확인'}`)});
    if(keep&&plans.some(p=>p.id===keep))mvnoPlan.value=keep;
    mvnoPlan.disabled=!pid||!plans.length;
    if(pid==='all')$('mvno-network').textContent=mvnoFilters.network==='all'?'전체':mvnoFilters.network;
    else $('mvno-network').textContent=provider?.network||'—';
    const bandLabel=mvnoPriceBandLabel(mvnoFilters.price);$('mvno-filter-count').textContent=pid?`${bandLabel?bandLabel+' · ':''}${plans.length.toLocaleString('ko-KR')}개 요금제가 현재 조건에 맞습니다.`:'통신사 또는 필터를 선택해 주세요.';
    if(pid&&!plans.length)$('mvno-detail').textContent='현재 필터 조건에 맞는 요금제가 없습니다.';
    updateMvnoPickerSummary(plans);if(mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)renderMvnoPlanCards(plans);syncMvno();
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
  function mvnoQuoteText(){
    const p=(mvnoData.plans||[]).find(x=>x.id===mvnoPlan.value)||null;if(!p)return '';const provider=(mvnoData.providers||[]).find(x=>x.id===p.provider_id)||null,fee=mvnoPlanFee(p);
    const lines=['[웅비통신 알뜰폰 상담]',`통신사: ${provider?.name||p.provider_id||'확인 필요'}`,`통신망: ${p.network||provider?.network||'확인 필요'}`,`요금제: ${p.name||'확인 필요'}`,`월 기본료: ${hasAmount(fee)?won(fee):'매장 확인'}`];if(p.data)lines.push(`데이터: ${p.data}`);if(p.voice)lines.push(`통화: ${p.voice}`);if(p.sms)lines.push(`문자: ${p.sms}`);lines.push('※ 프로모션·개통 가능 여부는 상담 시점에 최종 확인해 주세요.');return lines.join('\n');
  }
  mvnoProvider.addEventListener('change',()=>{clearMvnoPickerQuery();fillMvnoPlans()});mvnoPlan.addEventListener('change',()=>{syncMvno();updateMvnoPickerSummary();if(mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)renderMvnoPlanCards()});mvnoSort?.addEventListener('change',fillMvnoPlans);
  document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.dataset.mvnoFilterGroup,value=btn.dataset.mvnoFilterValue;mvnoFilters[group]=value;if(group==='price'&&value==='unlimited')mvnoFilters.data='all';if(group==='price'&&value!=='all'&&mvnoSort)mvnoSort.value='price';clearMvnoPickerQuery();updateMvnoFilterButtons();if(!mvnoProvider.value)mvnoProvider.value='all';if(group==='network'&&mvnoProvider.value!=='all'){const pr=(mvnoData.providers||[]).find(p=>p.id===mvnoProvider.value);if(value!=='all'&&pr?.network!==value)mvnoProvider.value='all'}fillMvnoPlans()}));
  $('mvno-filter-reset')?.addEventListener('click',()=>{Object.assign(mvnoFilters,{network:'all',price:'all',data:'all',voice:'all'});if(mvnoSort)mvnoSort.value='source';clearMvnoPickerQuery();updateMvnoFilterButtons();fillMvnoPlans()});
  mvnoPickerOpen?.addEventListener('click',openMvnoPlanPicker);mvnoPickerClose?.addEventListener('click',closeMvnoPlanPicker);mvnoPickerBackdrop?.addEventListener('click',e=>{if(e.target===mvnoPickerBackdrop)closeMvnoPlanPicker()});mvnoPickerSearch?.addEventListener('input',()=>{mvnoPickerQuery=mvnoPickerSearch.value;renderMvnoPlanCards()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)closeMvnoPlanPicker()});
  $('copy-mvno-quote')?.addEventListener('click',async()=>{const text=mvnoQuoteText(),status=$('mvno-quote-status');if(!text){if(status)status.textContent='요금제를 먼저 선택해 주세요.';return}const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다.':'복사하지 못했습니다. 다시 시도해 주세요.'});
  $('share-mvno-quote')?.addEventListener('click',()=>shareCustomerConsultText('웅비통신 알뜰폰 상담',mvnoQuoteText(),'mvno-quote-status'));
  $('consult-mvno-quote')?.addEventListener('click',()=>consultWithCustomerText(mvnoQuoteText(),'mvno-quote-status'));

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
  function prepaidQuoteText(){
    const p=(prepaidData.plans||[]).find(x=>x.id===prepaidPlan.value)||null;if(!p)return '';const provider=(prepaidData.providers||[]).find(x=>x.id===p.provider_id)||null;
    const lines=['[웅비통신 선불폰 상담]',`통신사: ${provider?.name||p.provider_id||'확인 필요'}`,`통신망: ${p.network||provider?.network||'확인 필요'}`,`요금제: ${p.name||'확인 필요'}`,`월 이용료: ${hasAmount(p.monthly_fee)?won(p.monthly_fee):'매장 확인'}`];if(p.data)lines.push(`데이터: ${p.data}`);if(p.voice)lines.push(`통화: ${p.voice}`);if(p.valid_days)lines.push(`사용기간: ${p.valid_days}일`);lines.push('※ 충전·유심·개통 조건은 상담 시점에 최종 확인해 주세요.');return lines.join('\n');
  }
  prepaidProvider.addEventListener('change',fillPrepaidPlans);prepaidPlan.addEventListener('change',syncPrepaid);
  $('copy-prepaid-quote')?.addEventListener('click',async()=>{const text=prepaidQuoteText(),status=$('prepaid-quote-status');if(!text){if(status)status.textContent='요금제를 먼저 선택해 주세요.';return}const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다.':'복사하지 못했습니다. 다시 시도해 주세요.'});
  $('share-prepaid-quote')?.addEventListener('click',()=>shareCustomerConsultText('웅비통신 선불폰 상담',prepaidQuoteText(),'prepaid-quote-status'));
  $('consult-prepaid-quote')?.addEventListener('click',()=>consultWithCustomerText(prepaidQuoteText(),'prepaid-quote-status'));

  // 인터넷·TV
  const internetCarrier=$('internet-carrier'),internetProduct=$('internet-product'),tvProduct=$('tv-product'),tvCount=$('tv-count'),wiredBundle=$('wired-bundle'),mobileBundle=$('mobile-bundle');
  const WIRED_RECENT_QUOTE_KEY='woongbi-wired-quotes-v1';
  let currentWiredQuoteId='',currentWiredQuoteFingerprint='';
  const BASIC_COMPARE_TV={SKB:'TV-SKB-TV_BASIC_NEW',SKTNET:'TV-SKTNET-ECO',KT:'TV-KT-TV_OTV_BASIC','LGU+':'TV-LGU+-TV_ECONOMY_PACK',LGHELLO:'TV-LGHELLO-TV_UHD_NEW_BASIC',SKYLIFE:'TV-SKYLIFE-TV_IPIT_BASIC'};
  const ADDITIONAL_TV_RULES={
    SKB:{kind:'half_base_plus_settop',settop:4400,keys:['TV_BASIC_NEW','TV_SMART_PLUS','TV_ALL']},
    SKTNET:{kind:'half_base_plus_settop',settop:4400,keys:['SKTNET_TV_ECO','SKTNET_TV_STD','SKTNET_TV_ALL']},
    KT:{kind:'fixed_service_plus_settop',settop:6600,fees:{TV_OTV_BASIC:7370,TV_OTV12:7920,TV_OTV15:8800,TV_OTV_ALLG:21340}},
    SKYLIFE:{kind:'fixed_total',fees:{TV_IPIT_BASIC:7700,TV_IPIT_PLUS:8250}}
  };
  function internetProducts(){return internetData.internet_products||internetData.products||[]}
  function tvProducts(){return internetData.tv_products||[]}
  function currentInternetProduct(){return internetProducts().find(p=>p.id===internetProduct.value)||null}
  function currentTvProduct(){return tvProduct.value==='none'?null:(tvProducts().find(p=>p.id===tvProduct.value)||null)}
  function selectedTvCount(){return currentTvProduct()?Math.max(1,Math.min(3,Number(tvCount?.value||1))):0}
  function additionalTvUnit(tv){
    if(!tv)return {known:true,amount:0};
    const rule=ADDITIONAL_TV_RULES[tv.provider_id],key=String(tv.product_key||'');
    if(!rule)return {known:false,amount:0};
    if(rule.kind==='half_base_plus_settop'){
      if(!rule.keys.includes(key)||!hasAmount(tv.monthly_fee??tv.tv_fee))return {known:false,amount:0};
      return {known:true,amount:Number(tv.monthly_fee??tv.tv_fee)*.5+Number(rule.settop||0)};
    }
    if(rule.kind==='fixed_service_plus_settop'){
      if(!hasAmount(rule.fees?.[key]))return {known:false,amount:0};
      return {known:true,amount:Number(rule.fees[key])+Number(rule.settop||0)};
    }
    if(rule.kind==='fixed_total'){
      if(!hasAmount(rule.fees?.[key]))return {known:false,amount:0};
      return {known:true,amount:Number(rule.fees[key])};
    }
    return {known:false,amount:0};
  }
  function additionalTvCalc(tv,count){
    const extra=Math.max(0,Number(count||0)-1);if(!extra)return {known:true,amount:0,unit:0,extra:0};
    const unit=additionalTvUnit(tv);return {known:unit.known,amount:unit.known?unit.amount*extra:0,unit:unit.amount,extra};
  }
  function syncTvCountControl(){
    if(!tvCount)return;const hasTv=!!currentTvProduct();tvCount.disabled=!hasTv;if(!hasTv)tvCount.value='1';
  }
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
  function internetUsageGuide(p){
    const speed=Number(p?.speed_mbps);
    if(!Number.isFinite(speed)||speed<=0)return '속도를 선택하면 일반적인 사용 예시를 안내해 드립니다.';
    if(speed<=200)return `${internetSpeedLabel(p)} · 웹서핑·영상 시청 중심, 1~2인 가구에서 많이 선택하는 속도입니다.`;
    if(speed<1000)return `${internetSpeedLabel(p)} · 여러 기기 동시 사용·OTT·온라인게임을 함께 쓰는 가정에 여유로운 속도입니다.`;
    return `${internetSpeedLabel(p)} · 대용량 다운로드·고화질 스트리밍·여러 기기 동시 사용이 많은 환경에 적합한 상위 속도입니다.`;
  }
  function updateInternetSpeedGuide(){
    const el=$('internet-speed-guide');if(el)el.textContent=internetUsageGuide(currentInternetProduct());
  }
  function updateInternetAvailabilityNote(){
    const el=$('internet-availability-note');if(!el)return;
    const pid=internetCarrier.value;
    const messages={LGHELLO:'헬로비전은 지역에 따라 설치 가능 상품과 망이 달라질 수 있어 주소 확인이 필요합니다.',SKYLIFE:'스카이라이프 인터넷·TV는 설치 주소와 제공 망에 따라 가입 가능 여부를 확인해야 합니다.'};
    if(messages[pid]){el.hidden=false;el.textContent=messages[pid]}else{el.hidden=true;el.textContent=''}
  }
  function pickCompareInternet(providerId,speed){
    const rows=internetProducts().filter(p=>p.provider_id===providerId&&Number(p.speed_mbps)===Number(speed));
    if(!rows.length)return null;
    if(providerId==='KT')return rows.find(p=>String(p.product_group||'').toUpperCase()==='WIFI')||rows[0];
    if(providerId==='SKYLIFE')return rows.find(p=>String(p.product_group||'').toUpperCase()==='BASIC')||rows[0];
    return rows.slice().sort(byOrder)[0];
  }
  function basicCompareTv(providerId){
    const id=BASIC_COMPARE_TV[providerId];return tvProducts().find(t=>t.id===id)||tvProducts().filter(t=>t.provider_id===providerId).sort(byOrder)[0]||null;
  }
  function wiredScenario(p,tv,count=1){
    if(!p||!hasAmount(p.monthly_fee??p.internet_fee))return {known:false};
    const internetFee=Number(p.monthly_fee??p.internet_fee),tvSelected=!!tv;
    const tvKnown=!tvSelected||hasAmount(tv.monthly_fee??tv.tv_fee);if(!tvKnown)return {known:false,gift:customerGiftMax(p,tv)};
    const tvFee=tvSelected?Number(tv.monthly_fee??tv.tv_fee):0,combo=tvSelected?WIRED_COMBO_DEFAULTS[p.provider_id]:null;
    const stb=tvSelected?defaultSettop(p.provider_id,tv):null;
    const settopKnown=!tvSelected||!!combo;if(!settopKnown)return {known:false,gift:customerGiftMax(p,tv)};
    const settopFee=!tvSelected?0:(stb&&hasAmount(stb.monthly_fee)?Number(stb.monthly_fee):Number(combo?.fallbackSettopFee||0));
    const internetDiscount=combo?Math.min(internetFee,comboInternetDiscount(combo,p)):0;
    const tvDiscount=combo?Math.min(tvFee,Number(combo.tvDiscount)||0):0;
    const extra=tvSelected?additionalTvCalc(tv,Math.max(1,Number(count||1))):{known:true,amount:0,extra:0};
    if(!extra.known)return {known:false,gift:customerGiftMax(p,tv),additionalUnknown:true};
    const base=internetFee+tvFee+settopFee+extra.amount,total=Math.max(0,base-internetDiscount-tvDiscount);
    return {known:true,base,total,internetDiscount,tvDiscount,settopFee,additionalTv:extra.amount,tvCount:tvSelected?Math.max(1,Number(count||1)):0,gift:customerGiftMax(p,tv)};
  }
  function escapeWiredHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function syncWiredLifePresetButtons(){const withTv=$('wired-compare-tv')?.value==='basic',count=withTv?Math.max(1,Number($('wired-compare-count')?.value||1)):0,key=!withTv?'internet':count===1?'tv1':count===2?'tv2':'';document.querySelectorAll('[data-wired-life-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.wiredLifePreset===key))}
  function renderWiredComparison(){
    const box=$('wired-compare-results');if(!box)return;
    const speed=Number($('wired-compare-speed')?.value||500),withTv=$('wired-compare-tv')?.value==='basic',count=withTv?Math.max(1,Number($('wired-compare-count')?.value||1)):0;
    const countSel=$('wired-compare-count');if(countSel)countSel.disabled=!withTv;syncWiredLifePresetButtons();
    const providers=(internetData.providers||[]).slice().sort(byOrder),cards=[];
    providers.forEach(provider=>{
      const p=pickCompareInternet(provider.id,speed);if(!p)return;
      const tv=withTv?basicCompareTv(provider.id):null;if(withTv&&!tv)return;
      const s=wiredScenario(p,tv,count),gift=customerGiftText(s.gift),channel=tv?.channel_label?` · ${tv.channel_label} 채널`:'';
      const total=s.known?won(s.total):'매장 확인',extraText=withTv&&count>1?(s.known?`<small class="wired-extra-line">추가 TV ${count-1}대 포함</small>`:'<small class="wired-extra-line">추가 TV 요금 상담 확인</small>'):'';
      cards.push(`<article class="wired-compare-card"><span>${escapeWiredHtml(provider.name)}</span><strong>${total}</strong><small>월 예상요금</small>${extraText}<p>${escapeWiredHtml(internetProductLabel(p))}${tv?`<br>${escapeWiredHtml(tv.name+channel)} · TV ${count}대`:''}</p><div><em>고객사은품</em><b>${escapeWiredHtml(gift)}</b></div><button type="button" data-wired-provider="${escapeWiredHtml(provider.id)}" data-wired-product="${escapeWiredHtml(p.id)}" data-wired-tv="${escapeWiredHtml(tv?.id||'none')}" data-wired-count="${count||1}">이 조건으로 자세히 보기</button></article>`);
    });
    box.innerHTML=cards.length?cards.join(''):'<p>선택한 속도로 비교 가능한 상품이 없습니다.</p>';
  }
  function makeWiredQuoteId(){const d=new Date(),pad=n=>String(n).padStart(2,'0');return `WBI-${String(d.getFullYear()).slice(-2)}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`}
  function wiredQuoteFingerprint(){return [internetCarrier.value,internetProduct.value,tvProduct.value,selectedTvCount()||0,wiredBundle.value,mobileBundle.value].join('|')}
  function syncWiredQuoteId(){
    const p=currentInternetProduct(),el=$('wired-quote-number');if(!el)return;
    if(!p){currentWiredQuoteId='';currentWiredQuoteFingerprint='';el.textContent='견적 생성 전';return}
    const fp=wiredQuoteFingerprint();if(!currentWiredQuoteId||fp!==currentWiredQuoteFingerprint){currentWiredQuoteId=makeWiredQuoteId();currentWiredQuoteFingerprint=fp}el.textContent=currentWiredQuoteId;
  }
  function buildWiredQuoteText(){
    const p=currentInternetProduct(),tv=currentTvProduct(),provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value);if(!p)return '';
    const wiredName=selectedRule(wiredBundle)?.name||((tv&&WIRED_COMBO_DEFAULTS[p.provider_id])?'인터넷+TV 결합 자동적용':'미적용');
    const mobileName=selectedRule(mobileBundle)?.name||'미적용';
    const count=selectedTvCount(),extraText=count>1?$('internet-result-extra-tv')?.textContent||'매장 확인':'미적용';
    return [`[웅비통신 유선견적 ${currentWiredQuoteId||''}]`,`${provider?.name||p.provider_id} / ${internetProductLabel(p)}`,`TV: ${tv?.name||'미가입'}${tv?` / 총 ${count}대`:''}`,`추가 TV 월요금: ${extraText}`,`유선결합: ${wiredName}`,`모바일결합: ${mobileName}`,`예상 월요금: ${$('internet-total')?.textContent||'매장 확인'}`,`고객사은품: ${$('internet-customer-gift')?.textContent||'매장 확인'}`,'※ 실제 가입 조건은 최종 상담 시 확인됩니다.'].join('\n');
  }
  function buildWiredQuoteUrl(){
    const u=new URL(location.href);u.search='';u.searchParams.set('tab','internet');u.searchParams.set('ic',internetCarrier.value);u.searchParams.set('ip',internetProduct.value);u.searchParams.set('itv',tvProduct.value||'none');u.searchParams.set('itvc',String(selectedTvCount()||1));u.searchParams.set('iwb',wiredBundle.value||'none');u.searchParams.set('imb',mobileBundle.value||'none');if(currentWiredQuoteId)u.searchParams.set('iq',currentWiredQuoteId);return u.toString();
  }
  function readWiredQuotes(){try{return JSON.parse(localStorage.getItem(WIRED_RECENT_QUOTE_KEY)||'[]')}catch{return []}}
  function renderWiredRecentQuotes(){
    const box=$('wired-recent-list');if(!box)return;const rows=readWiredQuotes();
    if(!rows.length){box.innerHTML='<p>아직 저장된 유선 견적이 없습니다.</p>';return}
    box.innerHTML=rows.map((q,i)=>`<button type="button" data-wired-recent="${i}"><span>${escapeWiredHtml(q.id)}</span><strong>${escapeWiredHtml(q.label)}</strong><small>${escapeWiredHtml(q.total||'')}</small></button>`).join('');
  }
  function saveWiredQuote(){
    const p=currentInternetProduct();if(!p)return false;syncWiredQuoteId();const provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value),tv=currentTvProduct();
    const count=selectedTvCount();
    const row={id:currentWiredQuoteId,label:`${provider?.name||p.provider_id} · ${internetSpeedLabel(p)}${tv?` + TV ${count}대`:''}`,total:$('internet-total')?.textContent||'',carrier:internetCarrier.value,product:internetProduct.value,tv:tvProduct.value||'none',count:count||1,wired:wiredBundle.value||'none',mobile:mobileBundle.value||'none',saved_at:Date.now()};
    const rows=readWiredQuotes().filter(x=>x.id!==row.id);rows.unshift(row);localStorage.setItem(WIRED_RECENT_QUOTE_KEY,JSON.stringify(rows.slice(0,5)));renderWiredRecentQuotes();return true;
  }
  function applyWiredQuote(q){
    if(!q)return;internetCarrier.value=q.carrier||'';fillInternetProducts();internetProduct.value=q.product||'';tvProduct.value=q.tv||'none';syncTvCountControl();if(tvCount&&currentTvProduct())tvCount.value=String(Math.max(1,Math.min(3,Number(q.count||1))));fillInternetBundles();if([...wiredBundle.options].some(o=>o.value===(q.wired||'none')))wiredBundle.value=q.wired||'none';if([...mobileBundle.options].some(o=>o.value===(q.mobile||'none')))mobileBundle.value=q.mobile||'none';if(q.id){currentWiredQuoteId=q.id;currentWiredQuoteFingerprint=wiredQuoteFingerprint()}syncInternet();
  }
  function restoreInternetQuoteFromUrl(){
    const sp=new URLSearchParams(location.search);if(sp.get('tab')!=='internet'||!sp.get('ic')||!sp.get('ip'))return false;
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='internet'));document.querySelectorAll('.rate-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel==='internet'));
    applyWiredQuote({id:sp.get('iq')||'',carrier:sp.get('ic'),product:sp.get('ip'),tv:sp.get('itv')||'none',count:sp.get('itvc')||'1',wired:sp.get('iwb')||'none',mobile:sp.get('imb')||'none'});return true;
  }

  function customerGiftMax(p,tv){
    if(!p)return null;
    const cfg=CUSTOMER_GIFT_MAX[p.provider_id];if(!cfg)return null;
    const speed=Number(p.speed_mbps),group=String(p.product_group||'').toUpperCase();
    let scope=cfg;
    if(p.provider_id==='KT'&&group==='FAMILY')scope=cfg.family||null;
    else if(p.provider_id==='SKYLIFE'&&group==='BUNDLE30')scope=cfg.bundle30||null;
    else if(Array.isArray(cfg.groups)&&!cfg.groups.includes(group))return null;
    if(!scope)return null;
    if(!tv)return hasAmount(scope.none?.[speed])?Number(scope.none[speed]):null;
    const key=String(tv.product_key||'');
    return hasAmount(scope.tv?.[key]?.[speed])?Number(scope.tv[key][speed]):null;
  }
  function customerGiftText(value){
    return hasAmount(value)?`최대 ${won(Number(value)*10000)}`:'매장 확인';
  }
  function comboInternetDiscount(combo,p){
    if(!combo)return 0;
    const speed=Number(p?.speed_mbps);
    if(combo.internetDiscountBySpeed&&hasAmount(combo.internetDiscountBySpeed[speed]))return Number(combo.internetDiscountBySpeed[speed]);
    return Number(combo.internetDiscount)||0;
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
    syncTvCountControl();
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
    syncTvCountControl();syncTvProductInfo();updateInternetSpeedGuide();updateInternetAvailabilityNote();
    const p=currentInternetProduct(),tv=currentTvProduct(),provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value)||null;
    if(!p){
      ['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-wired-discount','internet-result-mobile-discount'].forEach(id=>$(id).textContent='—');
      if($('extra-tv-fee-view'))$('extra-tv-fee-view').textContent='미적용';if($('internet-result-extra-tv'))$('internet-result-extra-tv').textContent='미적용';
      $('internet-customer-gift').textContent='—';
      $('internet-summary').textContent=internetCarrier.value?'현재 확인된 상품 요금은 매장에서 안내해 드립니다.':'통신사와 상품을 선택하면 자동으로 반영됩니다.';
      syncWiredQuoteId();
      return;
    }

    const internetKnown=hasAmount(p.monthly_fee??p.internet_fee),internetFee=internetKnown?Number(p.monthly_fee??p.internet_fee):null;
    const tvSelected=tvProduct.value!=='none',tvKnown=!tvSelected||!!(tv&&hasAmount(tv.monthly_fee??tv.tv_fee)),tvBaseFee=!tvSelected?0:(tvKnown?Number(tv.monthly_fee??tv.tv_fee):null);
    const combo=tvSelected?WIRED_COMBO_DEFAULTS[p.provider_id]:null;
    const stb=tvSelected?defaultSettop(p.provider_id,tv):null;
    const settopKnown=!tvSelected||!!combo;
    const settopFee=!tvSelected?0:(stb&&hasAmount(stb.monthly_fee)?Number(stb.monthly_fee):Number(combo?.fallbackSettopFee||0));
    const autoInternetDiscount=combo&&internetKnown?Math.min(internetFee,comboInternetDiscount(combo,p)):0;
    const autoTvDiscount=combo&&tvKnown?Math.min(tvBaseFee,Number(combo.tvDiscount)||0):0;
    const autoWiredDiscount=autoInternetDiscount+autoTvDiscount;
    const count=tvSelected?selectedTvCount():0,additionalCalc=tvSelected?additionalTvCalc(tv,count):{known:true,amount:0,extra:0};
    const additionalKnown=additionalCalc.known,additionalTotal=additionalCalc.amount;
    const baseKnown=internetKnown&&tvKnown&&settopKnown&&additionalKnown,base=baseKnown?internetFee+tvBaseFee+settopFee+additionalTotal:null;

    const wiredRule=selectedRule(wiredBundle),mobileRule=selectedRule(mobileBundle);
    const wiredCalc=ruleDiscount(wiredRule,tv),mobileCalc=ruleDiscount(mobileRule,tv);
    const wiredKnown=wiredCalc.known,mobileKnown=mobileCalc.known;
    const extraWiredDiscount=wiredCalc.amount,mobileDiscount=mobileCalc.amount;
    const wiredDiscount=autoWiredDiscount+extraWiredDiscount;
    const totalKnown=baseKnown&&wiredKnown&&mobileKnown,totalDiscount=totalKnown?Math.min(base,wiredDiscount+mobileDiscount):null,total=totalKnown?Math.max(0,base-totalDiscount):null;

    $('internet-fee-view').textContent=internetKnown?won(Math.max(0,internetFee-autoInternetDiscount)):'매장 확인';
    const primaryTvMonthly=tvSelected&&tvKnown&&settopKnown?Math.max(0,tvBaseFee-autoTvDiscount)+settopFee:null;
    $('tv-fee-view').textContent=!tvSelected?'미선택':(primaryTvMonthly!==null&&additionalKnown?won(primaryTvMonthly+additionalTotal):'매장 확인');
    if($('extra-tv-fee-view'))$('extra-tv-fee-view').textContent=!tvSelected||count<=1?'미적용':(additionalKnown?won(additionalTotal):'매장 확인');
    if($('internet-result-extra-tv'))$('internet-result-extra-tv').textContent=!tvSelected||count<=1?'미적용':(additionalKnown?`+${won(additionalTotal)}`:'매장 확인');
    $('internet-base-total').textContent=baseKnown?won(base):'매장 확인';
    $('internet-bundle-discount').textContent=totalKnown?(totalDiscount?'-'+won(totalDiscount):'미적용'):'매장 확인';
    $('internet-total').textContent=totalKnown?won(total):'매장 확인';
    $('internet-result-base').textContent=baseKnown?won(base):'매장 확인';
    $('internet-result-wired-discount').textContent=tvSelected&&combo?(wiredDiscount?'-'+won(wiredDiscount):'미적용'):(wiredRule?(wiredKnown?'-'+won(extraWiredDiscount):'매장 확인'):'미적용');
    $('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?(mobileDiscount?'-'+won(mobileDiscount):'미적용'):'매장 확인'):'미적용';
    const giftMax=customerGiftMax(p,tvSelected?tv:null);
    $('internet-customer-gift').textContent=customerGiftText(giftMax);

    const bits=[],speedLabel=internetSpeedLabel(p);if(speedLabel)bits.push(`인터넷 속도 ${speedLabel}`);if(internetHasWifi(p))bits.push('와이파이 포함');if(tvSelected&&tv?.name)bits.push(`${tv.name} · TV ${count}대`);if(tvSelected&&count>1)bits.push(additionalKnown?`추가 TV ${count-1}대 ${won(additionalTotal)}`:'추가 TV 요금 매장 확인');if(tvSelected&&combo)bits.push('인터넷+TV 결합할인 자동 반영');if(wiredRule?.notes)bits.push(wiredRule.notes);if(mobileRule?.notes)bits.push(mobileRule.notes);
    $('internet-detail').textContent=bits.length?bits.join(' · '):'3년 약정 기준 월요금';
    $('internet-summary').textContent=totalKnown?`${provider?.name||p.provider_id} · ${p.name}${tvSelected&&tv?.name?' + '+tv.name+` · TV ${count}대`:''} 기준 예상 월요금입니다.`:`${provider?.name||p.provider_id} · 선택 상품의 최신 금액은 매장에서 확인해 주세요.`;
    syncWiredQuoteId();
  }
  internetCarrier.addEventListener('change',fillInternetProducts);
  internetProduct.addEventListener('change',fillInternetBundles);
  tvProduct.addEventListener('change',()=>{syncTvCountControl();fillInternetBundles()});
  tvCount?.addEventListener('change',syncInternet);
  wiredBundle.addEventListener('change',syncInternet);
  mobileBundle.addEventListener('change',syncInternet);
  $('wired-compare-speed')?.addEventListener('change',renderWiredComparison);
  $('wired-compare-tv')?.addEventListener('change',renderWiredComparison);
  $('wired-compare-count')?.addEventListener('change',renderWiredComparison);
  document.querySelectorAll('[data-wired-life-preset]').forEach(btn=>btn.addEventListener('click',()=>{const tv=$('wired-compare-tv'),count=$('wired-compare-count');if(!tv||!count)return;const preset=btn.dataset.wiredLifePreset;if(preset==='internet')tv.value='none';else{tv.value='basic';count.value=preset==='tv2'?'2':'1'}renderWiredComparison()}));
  $('wired-compare-results')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-wired-provider]');if(!b)return;
    internetCarrier.value=b.dataset.wiredProvider;fillInternetProducts();internetProduct.value=b.dataset.wiredProduct;tvProduct.value=b.dataset.wiredTv||'none';syncTvCountControl();if(tvCount&&currentTvProduct())tvCount.value=String(Math.max(1,Math.min(3,Number(b.dataset.wiredCount||1))));fillInternetBundles();$('internet-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('save-wired-quote')?.addEventListener('click',()=>{const ok=saveWiredQuote(),s=$('wired-quote-status');if(s)s.textContent=ok?'이 기기에 견적을 저장했습니다.':'상품을 먼저 선택해 주세요.'});
  $('copy-wired-quote')?.addEventListener('click',async()=>{const t=buildWiredQuoteText(),s=$('wired-quote-status');if(!t){if(s)s.textContent='상품을 먼저 선택해 주세요.';return}try{await navigator.clipboard.writeText(t);if(s)s.textContent='견적 내용을 복사했습니다.'}catch{if(s)s.textContent='복사하지 못했습니다. 공유 버튼을 이용해 주세요.'}});
  $('share-wired-quote')?.addEventListener('click',async()=>{const t=buildWiredQuoteText(),u=buildWiredQuoteUrl(),s=$('wired-quote-status');if(!t){if(s)s.textContent='상품을 먼저 선택해 주세요.';return}try{if(navigator.share)await navigator.share({title:'웅비통신 인터넷·TV 견적',text:t,url:u});else{await navigator.clipboard.writeText(u);if(s)s.textContent='같은 견적을 다시 여는 링크를 복사했습니다.'}}catch(e){if(e?.name!=='AbortError'&&s)s.textContent='공유하지 못했습니다.'}});
  $('consult-wired-quote')?.addEventListener('click',async()=>{const t=buildWiredQuoteText(),s=$('wired-quote-status');if(!t){if(s)s.textContent='상품을 먼저 선택해 주세요.';return}try{await navigator.clipboard.writeText(t)}catch{}window.open('http://pf.kakao.com/_nWwNT/chat','_blank','noopener');if(s)s.textContent='견적 내용을 복사했습니다. 상담창에 붙여넣어 주세요.'});
  $('wired-recent-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-wired-recent]');if(!b)return;applyWiredQuote(readWiredQuotes()[Number(b.dataset.wiredRecent)])});
  $('add-mobile-to-wired')?.addEventListener('click',()=>{
    const map={SKB:'SKT',SKTNET:'SKT',KT:'KT','LGU+':'LGU+'},target=map[internetCarrier.value];
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='mobile'));document.querySelectorAll('.rate-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel==='mobile'));
    if(target){carrier.value=target;fillDevices()}document.querySelector('[data-panel="mobile"]')?.scrollIntoView({behavior:'smooth',block:'start'});
  });

  fetch('data/studyphone.json?v=20260916-1').then(r=>r.json()).then(data=>{studyphoneData=data||studyphoneData;setUpdated('studyphone-updated',studyphoneData?.meta?.updated_at);fillStudyphone()}).catch(()=>{const box=$('studyphone-plan-list');if(box)box.innerHTML='<p>공신폰 요금제 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>'});

  Promise.all([
    fetch('data/catalog.json?v=20260916-1').then(r=>r.json()),
    fetch('data/plans.json?v=20260916-1').then(r=>r.json()),
    fetch('data/supports.json?v=20260916-1').then(r=>r.json()),
    fetch('data/devices-extra.json?v=20260916-1').then(r=>r.json()),
    fetch('data/iphone18.json?v=20260916-1').then(r=>r.json()),
    fetch('data/mvno-postpaid.json?v=20260916-1').then(r=>r.json()),
    fetch('data/prepaid.json?v=20260916-1').then(r=>r.json()),
    fetch('data/internet.json?v=20260916-2').then(r=>r.json())
  ]).then(([base,plans,supports,extra,iphone18,mvno,prepaid,internet])=>{
    catalog=base;const deviceMap=new Map();[...(base?.devices||[]),...(extra?.devices||[]),...(iphone18?.devices||[])].forEach(d=>deviceMap.set(d.id,d));catalog.devices=[...deviceMap.values()];catalog.mobile_plans=plans?.mobile_plans||base?.mobile_plans||[];contractRate=Number(plans?.selection_contract_rate)||DEFAULT_CONTRACT_RATE;supportSchedules=supports?.support_schedules||[];mvnoData=mvno||mvnoData;prepaidData=prepaid||prepaidData;internetData=internet||internetData;
    const mobileDates=[base?.meta?.updated_at,plans?.meta?.updated_at,supports?.meta?.updated_at,extra?.meta?.updated_at,iphone18?.meta?.updated_at].filter(Boolean).sort();setUpdated('catalog-updated',mobileDates.at(-1));setUpdated('mvno-updated',mvnoData?.meta?.updated_at);setUpdated('prepaid-updated',prepaidData?.meta?.updated_at);setUpdated('internet-updated',internetData?.meta?.updated_at);
    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderWiredComparison();renderWiredRecentQuotes();renderPurposeRecommendations();const restoredWired=restoreInternetQuoteFromUrl();renderRecentQuotes();const restoredMobile=!restoredWired&&restoreQuoteFromUrl();if(!restoredWired&&!restoredMobile)setMobileMode('purpose');suspendUrlSync=false;syncMobile();
  }).catch(()=>{$('mobile-data-note').textContent='상품 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'});
})();