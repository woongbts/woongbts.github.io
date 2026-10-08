(() => {
  'use strict';
  const API='https://woongbi-consent.woongbts.workers.dev';
  const $=id=>document.getElementById(id);
  const CATEGORY_LABEL={mobile:'휴대폰',studyphone:'공신폰',mvno:'알뜰폰',prepaid:'선불폰',internet:'인터넷·TV'};
  let policy=null,current=null,openedAt=0,lastSubmit=null;
  let salesSignals=new Map();
  let selectedInternetCard=null;

  function digits(value){return String(value||'').replace(/\D/g,'');}
  function hasSensitivePaymentNumber(value){return /(?:\d[ -]?){12,19}/.test(String(value||''));}
  function moneyValue(text){
    const raw=String(text||'');
    if(/미지급/.test(raw))return 0;
    const d=raw.replace(/[^0-9]/g,'');
    return d?Number(d):null;
  }
  function selectedText(id){
    const el=$(id); return el?.selectedOptions?.[0]?.textContent?.trim()||'';
  }
  function cleanPlanName(text){
    return String(text||'').replace(/\s*·\s*[0-9,]+원.*$/,'').trim();
  }
  function safeText(el){return el?.textContent?.trim()||'';}
  function categoryLabel(category){return CATEGORY_LABEL[category]||category||'상담';}
  function acquisitionContext(){
    try{
      const c=window.woongbiSiteAnalyticsContext?.()||{};
      return {source:c.source||'direct',campaign:c.campaign||'',landing_path:c.landing_path||location.pathname};
    }catch{return {source:'direct',campaign:'',landing_path:location.pathname};}
  }
  function trackStore(type,ctx={}){
    try{window.woongbiTrackConversion?.(type,{product_id:ctx.product_id||'',category:ctx.category||''});}catch{}
  }
  function quoteLines(ctx){
    return [
      '[웅비통신 '+categoryLabel(ctx.category)+' 상담 신청]',
      '상품: '+ctx.product_name,
      ctx.provider?'통신사/사업자: '+ctx.provider:'',
      ctx.monthly!=null?'예상 월요금: '+Number(ctx.monthly).toLocaleString('ko-KR')+'원':'',
      ctx.gift!=null?'고객사은품: '+Number(ctx.gift).toLocaleString('ko-KR')+'원':'',
      ctx.detail?'조건: '+ctx.detail:'',
      '※ 신청 후 웅비통신 덕천만덕점에서 확인 후 연락드립니다.'
    ].filter(Boolean).join('\n');
  }

  async function loadSalesSignals(){
    try{
      const res=await fetch(API+'/api/recommendation-signals',{headers:{accept:'application/json'},cache:'no-store'});
      const data=await res.json();
      salesSignals=new Map((data?.signals?.store||[]).map(row=>[String(row.product_id),row]));
      decorateAll();
    }catch{salesSignals=new Map();}
  }

  async function loadPolicy(){
    try{
      const response=await fetch(API+'/api/store-application-policy',{headers:{accept:'application/json'},cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data.ok)throw Error(data.error||'개인정보 안내를 불러오지 못했습니다.');
      policy=data.policy;
      renderPolicy();
    }catch(e){
      policy=null;
      const state=$('store-application-policy-state');
      if(state)state.textContent='개인정보 처리 안내를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  function renderPolicy(){
    const box=$('store-application-policy-text'),state=$('store-application-policy-state');
    if(!box||!policy)return;
    box.innerHTML='';
    const rows=[
      ['이용 목적',policy.purpose],
      ['필수 항목',policy.items?.required],
      ['선택 항목',policy.items?.optional],
      ['보유 기간',policy.retention],
      ['동의 거부 안내',policy.refusal]
    ];
    rows.forEach(([label,value])=>{
      if(!value)return;
      const p=document.createElement('p'),b=document.createElement('b');
      b.textContent=label+' · ';p.append(b,document.createTextNode(String(value)));box.append(p);
    });
    if(state)state.textContent='개인정보 처리 안내 '+policy.version;
  }

  function openApplication(ctx){
    if(!ctx?.product_id||!ctx?.product_name)return;
    current={...ctx,quote_text:ctx.quote_text||quoteLines(ctx),page_url:location.href};
    trackStore('store_apply_open',ctx);
    const dialog=$('store-application-dialog');
    if(!dialog)return;
    $('store-application-category').textContent=categoryLabel(ctx.category);
    $('store-application-title').textContent=ctx.product_name;
    $('store-application-summary').textContent=[
      ctx.provider,
      ctx.monthly!=null?'월 '+Number(ctx.monthly).toLocaleString('ko-KR')+'원':'',
      ctx.gift!=null?'사은품 '+Number(ctx.gift).toLocaleString('ko-KR')+'원':'',
      ctx.detail
    ].filter(Boolean).join(' · ');
    $('store-application-name').value='';
    $('store-application-phone').value='';
    $('store-application-inquiry').value='';
    const internetFields=$('store-internet-fields');
    const submitBtn=$('store-application-submit');
    if(submitBtn)submitBtn.textContent=ctx.category==='internet'?'다음 · 설치정보 입력':'이 조건으로 상담 신청';
    const fallback=$('store-application-fallback');if(fallback)fallback.hidden=true;
    if(dialog)dialog.dataset.applicationCategory=ctx.category;
    const isInternet=ctx.category==='internet';
    if(internetFields)internetFields.hidden=!isInternet;
    if(isInternet && internetFields && 'open' in internetFields)internetFields.open=false;
    const carrierInput=$('store-application-internet-carrier');
    const emailInput=$('store-application-email');
    const addressInput=$('store-application-address');
    if(carrierInput)carrierInput.value=isInternet?(ctx.provider||''):'';
    if(emailInput){emailInput.value='';emailInput.required=false;}
    if(addressInput){addressInput.value='';addressInput.required=false;}
    document.querySelectorAll('input[name="store_billing_method"]').forEach(input=>{input.checked=false;input.required=false;});
    $('store-application-consent').checked=false;
    $('store-application-honeypot').value='';
    $('store-application-status').textContent=policy?'':'개인정보 처리 안내를 확인하는 중입니다.';
    openedAt=Date.now();
    if(typeof dialog.showModal==='function')dialog.showModal(); else dialog.setAttribute('open','');
    $('store-application-name').focus({preventScroll:true});
  }
  function closeApplication(){
    const dialog=$('store-application-dialog');
    if(dialog?.open)dialog.close(); else dialog?.removeAttribute('open');
  }
  function showSuccess(receipt){
    const dialog=$('store-application-success');
    const id=$('store-application-receipt');
    if(id)id.textContent=receipt?.id?'신청번호 '+String(receipt.id).slice(0,8):'';
    const statusLink=$('store-application-status-link');
    if(statusLink){
      if(receipt?.lookup_token){
        statusLink.href='/application-status.html?t='+encodeURIComponent(receipt.lookup_token);
        statusLink.hidden=false;
      }else{
        statusLink.hidden=true;
        statusLink.removeAttribute('href');
      }
    }
    if(typeof dialog?.showModal==='function')dialog.showModal(); else dialog?.setAttribute('open','');
  }

  function studyphoneContext(planId){
    const option=[...($('studyphone-plan')?.options||[])].find(x=>x.value===planId);
    const planName=cleanPlanName(option?.textContent||safeText(document.querySelector('.studyphone-plan-card[data-studyphone-plan="'+CSS.escape(planId)+'"] span')));
    const monthly=moneyValue(safeText($('studyphone-total'))) ?? moneyValue(safeText($('studyphone-plan-fee')));
    const detail=safeText($('studyphone-summary'))||safeText(document.querySelector('.studyphone-plan-card[data-studyphone-plan="'+CSS.escape(planId)+'"] small'));
    return {category:'studyphone',product_id:'studyphone:'+planId,product_name:'갤럭시 A17 공신폰 · '+(planName||'공신폰 요금제'),provider:'KT M모바일',monthly,gift:null,detail};
  }
  function selectedMobileContext(){
    const model=$('device-select'),plan=$('plan-select');
    if(!model?.value || !plan?.value)return null;
    const provider=selectedText('carrier');
    const join=selectedText('join-type');
    const discount=selectedText('discount-method');
    const monthly=moneyValue(safeText($('monthly-total')));
    const detail=[join,selectedText('plan-select'),discount,selectedText('installment-months')||'',safeText($('quote-action-status'))].filter(Boolean).join(' · ');
    return {
      category:'mobile',product_id:'mobile:'+provider+':'+model.value+':'+plan.value,
      product_name:selectedText('device-select')||'휴대폰',provider,monthly,gift:null,detail
    };
  }
  function purposeMobileContext(card){
    const purpose=document.querySelector('[data-purpose-category].active')?.dataset.purposeCategory||'senior';
    const cards=[...card.parentElement.querySelectorAll('.purpose-card')];
    const index=Math.max(0,cards.indexOf(card));
    const productName=safeText(card.querySelector(':scope > strong, h3, h4'))||'추천 휴대폰';
    const provider=safeText(card.querySelector('.purpose-card-top span'))||selectedText('purpose-carrier');
    const deviceId=card.dataset.deviceId||'';
    const planId=card.dataset.planId||'';
    const monthly=moneyValue(safeText(card.querySelector('.purpose-card-total b')));
    const discount=card.dataset.selectedMethod==='support'?'공시지원금'
      :card.dataset.selectedMethod==='contract'?'선택약정 25%'
      :card.dataset.selectedMethod==='promo'?'신규가입 특가':'할인방식 상담 확인';
    const detail=[purpose==='senior'?'효도폰':purpose==='kids'?'키즈폰':purpose==='value'?'가성비폰':'프리미엄폰',
      selectedText('purpose-join'),safeText(card.querySelector('em')),discount,
      safeText(card.querySelector('.quote-amount-note'))].filter(Boolean).join(' · ');
    const identity=deviceId&&planId?deviceId+':'+planId+':'+(card.dataset.selectedMethod||'') : purpose+':'+index;
    return {category:'mobile',product_id:'mobile-purpose:'+identity,product_name:productName,provider,monthly,gift:null,detail};
  }

  function selectedMvnoContext(){
    const plan=$('mvno-plan'),id=plan?.value;
    if(!id)return null;
    const planName=cleanPlanName(selectedText('mvno-plan'));
    const provider=selectedText('mvno-provider').replace(/^전체 통신사$/,'')||safeText(document.querySelector('#mvno-plan-picker-selected-detail'))?.split(' · ')[0];
    return {category:'mvno',product_id:'mvno:'+id,product_name:planName||'알뜰폰 요금제',provider,monthly:moneyValue(safeText($('mvno-total'))),gift:null,detail:safeText($('mvno-detail'))||safeText($('mvno-summary'))};
  }
  function mvnoCardContext(card,planId){
    const provider=safeText(card.querySelector('.mvno-recommend-card-head small'));
    const name=safeText(card.querySelector('h4'))||'알뜰폰 요금제';
    const detail=[...card.querySelectorAll('.mvno-easy-specs p')].map(safeText).filter(Boolean).join(' · ');
    return {category:'mvno',product_id:'mvno:'+planId,product_name:name,provider,monthly:moneyValue(safeText(card.querySelector('.mvno-recommend-price strong'))),gift:null,detail};
  }
  function prepaidContext(planId){
    const option=[...($('prepaid-plan')?.options||[])].find(x=>x.value===planId);
    return {
      category:'prepaid',
      product_id:'prepaid:'+planId,
      product_name:cleanPlanName(option?.textContent||'선불폰 요금제'),
      provider:selectedText('prepaid-provider'),
      monthly:moneyValue(safeText($('prepaid-total')))||moneyValue(option?.textContent),
      gift:null,
      detail:safeText($('prepaid-detail'))||safeText($('prepaid-summary'))
    };
  }
  function selectedInternetContext(){
    const id=$('internet-product')?.value;
    if(!id)return null;
    const tv=$('tv-product')?.value;
    const count=$('tv-count')?.value||'1';
    const productName=selectedText('internet-product')+(tv&&tv!=='none'?' + '+selectedText('tv-product')+' · TV '+count+'대':'');
    return {
      category:'internet',product_id:'internet:'+id+':'+(tv||'none')+':'+count,
      product_name:productName||'인터넷·TV',
      provider:selectedText('internet-carrier'),
      monthly:moneyValue(safeText($('internet-total'))),
      gift:moneyValue(safeText($('internet-customer-gift'))),
      detail:safeText($('internet-detail'))||safeText($('internet-summary'))
    };
  }
  function internetCardContext(card){
    const detailButton=card.querySelector('[data-wired-provider]');
    if(!detailButton)return null;
    const provider=safeText(card.querySelector(':scope > span'));
    const detail=safeText(card.querySelector('p'));
    const id=[detailButton.dataset.wiredProduct,detailButton.dataset.wiredTv||'none',detailButton.dataset.wiredCount||'1'].join(':');
    return {
      category:'internet',product_id:'internet:'+id,
      product_name:(detail||provider+' 인터넷·TV').replace(/\s+/g,' '),
      provider,
      monthly:moneyValue(safeText(card.querySelector(':scope > strong'))),
      gift:moneyValue(safeText(card.querySelector('div b'))),
      detail
    };
  }

  function buildConditionShareUrl(category){
    const u=new URL('/rates.html',location.origin);
    ['src','utm_source','utm_medium','utm_campaign','utm_term'].forEach(key=>{const value=new URLSearchParams(location.search).get(key);if(value)u.searchParams.set(key,value);});
    if(category==='studyphone'){
      const id=$('studyphone-plan')?.value;if(!id)return '';
      u.searchParams.set('tab','studyphone');u.searchParams.set('sp',id);
    }else if(category==='mvno'){
      const id=$('mvno-plan')?.value;if(!id)return '';
      u.searchParams.set('tab','mvno');u.searchParams.set('mp',id);
      const provider=$('mvno-provider')?.value;if(provider)u.searchParams.set('mprov',provider);
    }else if(category==='prepaid'){
      const id=$('prepaid-plan')?.value;if(!id)return '';
      u.searchParams.set('tab','prepaid');u.searchParams.set('pp',id);
      const provider=$('prepaid-provider')?.value;if(provider)u.searchParams.set('pprov',provider);
    }else if(category==='internet'){
      const id=$('internet-product')?.value;if(!id)return '';
      u.searchParams.set('tab','internet');
      u.searchParams.set('ic',$('internet-carrier')?.value||'');
      u.searchParams.set('ip',id);
      u.searchParams.set('itv',$('tv-product')?.value||'none');
      u.searchParams.set('itvc',$('tv-count')?.value||'1');
      u.searchParams.set('iwb',$('wired-bundle')?.value||'none');
      u.searchParams.set('imb',$('mobile-bundle')?.value||'none');
      const q=safeText($('wired-quote-number'));if(q&&q!=='견적 생성 전')u.searchParams.set('iq',q);
    }else return '';
    return u.toString();
  }
  async function shareCondition(category,getContext){
    const ctx=getContext(),url=buildConditionShareUrl(category);
    if(!ctx||!url){alert('먼저 상품이나 요금제를 선택해 주세요.');return}
    const text=(ctx.quote_text||quoteLines(ctx))+'\n같은 조건 다시 보기: '+url;
    try{
      if(navigator.share)await navigator.share({title:'웅비통신 '+categoryLabel(category)+' 견적',text,url});
      else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();
      }
      const status=category==='internet'?$('wired-quote-status'):category==='mvno'?$('mvno-quote-status'):category==='prepaid'?$('prepaid-quote-status'):$('studyphone-quote-status');
      if(status)status.textContent=navigator.share?'견적을 공유했습니다.':'같은 조건 링크와 견적을 복사했습니다.';
    }catch(e){
      if(e?.name!=='AbortError')alert('견적을 공유하지 못했습니다.');
    }
  }

  function makeApplyButton(label='신청하기'){
    const button=document.createElement('button');
    button.type='button';button.className='store-apply-btn';button.textContent=label;
    return button;
  }
  function decorateStudyphone(){
    const list=$('studyphone-plan-list'); if(!list)return;
    [...list.querySelectorAll(':scope > .studyphone-plan-card')].forEach(card=>{
      if(card.dataset.storeWrapped)return;
      card.dataset.storeWrapped='1';
      const wrap=document.createElement('div');wrap.className='store-studyphone-item';
      card.before(wrap);wrap.append(card);
      const apply=makeApplyButton('신청하기');
      apply.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        card.click();
        setTimeout(()=>openApplication(studyphoneContext(card.dataset.studyphonePlan)),50);
      });
      wrap.append(apply);
    });
  }
  function decorateMvno(){
    document.querySelectorAll('.mvno-recommend-card').forEach(card=>{
      const actions=card.querySelector('.mvno-recommend-actions');
      if(!actions||actions.querySelector('.store-apply-btn'))return;
      const source=actions.querySelector('[data-mvno-recommend-detail],[data-mvno-recommend-consult]');
      if(!source)return;
      const planId=source.dataset.mvnoRecommendDetail||source.dataset.mvnoRecommendConsult;
      const signal=salesSignals.get('mvno:'+planId);
      if(signal && !card.querySelector('.store-sales-signal')){
        const badge=document.createElement('small');badge.className='store-sales-signal';
        badge.textContent='실제 완료 데이터 반영 · '+Number(signal.completed||0)+'건';
        card.querySelector('.mvno-recommend-card-head')?.append(badge);
      }
      const apply=makeApplyButton('신청하기');
      apply.addEventListener('click',event=>{
        event.stopPropagation();
        openApplication(mvnoCardContext(card,source.dataset.mvnoRecommendDetail||source.dataset.mvnoRecommendConsult));
      });
      actions.append(apply);
    });
    const recommendList=$('mvno-recommend-list');
    if(recommendList && !recommendList.dataset.salesSorted){
      const cards=[...recommendList.querySelectorAll(':scope > .mvno-recommend-card')];
      const signaled=cards.filter(card=>{
        const source=card.querySelector('[data-mvno-recommend-detail],[data-mvno-recommend-consult]');
        const id=source?.dataset.mvnoRecommendDetail||source?.dataset.mvnoRecommendConsult||'';
        return salesSignals.has('mvno:'+id);
      });
      if(signaled.length>=2){
        const original=new Map(cards.map((card,index)=>[card,index]));
        cards.sort((a,b)=>{
          const sa=a.querySelector('[data-mvno-recommend-detail],[data-mvno-recommend-consult]');
          const sb=b.querySelector('[data-mvno-recommend-detail],[data-mvno-recommend-consult]');
          const ia=sa?.dataset.mvnoRecommendDetail||sa?.dataset.mvnoRecommendConsult||'';
          const ib=sb?.dataset.mvnoRecommendDetail||sb?.dataset.mvnoRecommendConsult||'';
          const aa=salesSignals.get('mvno:'+ia),bb=salesSignals.get('mvno:'+ib);
          const boostA=aa?Math.min(12,Number(aa.completed||0)*2+Number(aa.conversion||0)/25):0;
          const boostB=bb?Math.min(12,Number(bb.completed||0)*2+Number(bb.conversion||0)/25):0;
          return boostB-boostA || original.get(a)-original.get(b);
        }).forEach(card=>recommendList.append(card));
        recommendList.dataset.salesSorted='1';
      }
    }

    const list=$('mvno-plan-picker-list'); if(!list)return;
    [...list.querySelectorAll(':scope > .plan-option-card')].forEach(card=>{
      if(card.dataset.storeWrapped)return;
      card.dataset.storeWrapped='1';
      const wrap=document.createElement('div');wrap.className='store-mvno-picker-item';
      card.before(wrap);wrap.append(card);
      const apply=makeApplyButton('신청');
      apply.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        card.click();
        setTimeout(()=>{const ctx=selectedMvnoContext();if(ctx)openApplication(ctx);},60);
      });
      wrap.append(apply);
    });
  }
  function renderPrepaidProducts(){
    const select=$('prepaid-plan'),provider=$('prepaid-provider'),host=$('store-prepaid-products');
    if(!select||!host)return;
    const plans=[...select.options].filter(x=>x.value);
    host.hidden=!provider?.value||!plans.length;
    if(host.hidden){host.innerHTML='';return}
    const title=document.createElement('div');title.className='store-prepaid-head';title.innerHTML='<strong>신청 가능한 선불 요금제</strong><small>요금제를 고르면 매장에서 확인 후 연락드립니다.</small>';
    const list=document.createElement('div');list.className='store-prepaid-list';
    plans.forEach(option=>{
      const row=document.createElement('article');
      const name=cleanPlanName(option.textContent),price=(option.textContent.match(/[0-9,]+원/)||[])[0]||'요금 상담 확인';
      row.innerHTML='<div><strong></strong><small></small></div>';
      row.querySelector('strong').textContent=name;row.querySelector('small').textContent=price;
      const apply=makeApplyButton('신청하기');
      apply.addEventListener('click',()=>{
        select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));
        setTimeout(()=>openApplication(prepaidContext(option.value)),30);
      });
      row.append(apply);list.append(row);
    });
    host.replaceChildren(title,list);
  }
  function ensureInternetSelectionBar(){
    let bar=$('desktop-internet-selection');
    if(bar)return bar;
    bar=document.createElement('div');
    bar.id='desktop-internet-selection';
    bar.className='desktop-internet-selection';
    bar.hidden=true;
    bar.innerHTML='<div><span>현재 선택</span><strong id="desktop-internet-selection-title">인터넷·TV 조건을 선택해 주세요.</strong><small id="desktop-internet-selection-detail"></small></div><button type="button" id="desktop-internet-selection-apply">이 조건으로 신청하기</button>';
    document.body.append(bar);
    $('desktop-internet-selection-apply')?.addEventListener('click',()=>{
      const ctx=selectedInternetCard?internetCardContext(selectedInternetCard):null;
      if(ctx)openApplication(ctx);
    });
    return bar;
  }
  function selectInternetCard(card){
    if(!card)return;
    document.querySelectorAll('.wired-compare-card.is-selected').forEach(el=>el.classList.remove('is-selected'));
    selectedInternetCard=card;
    card.classList.add('is-selected');
    const ctx=internetCardContext(card),bar=ensureInternetSelectionBar();
    if(!ctx||!bar)return;
    const price=ctx.monthly!=null?'월 '+Number(ctx.monthly).toLocaleString('ko-KR')+'원':'월요금 확인';
    $('desktop-internet-selection-title').textContent=[ctx.provider,price].filter(Boolean).join(' · ');
    $('desktop-internet-selection-detail').textContent=ctx.detail||'선택한 조건으로 신청할 수 있습니다.';
    bar.hidden=false;
  }
  function enhanceInternetRecommendations(){
    const cards=[...document.querySelectorAll('.wired-compare-card')];
    if(!cards.length){const bar=$('desktop-internet-selection');if(bar)bar.hidden=true;selectedInternetCard=null;return}
    if(selectedInternetCard&&!cards.includes(selectedInternetCard)){selectedInternetCard=null;const bar=$('desktop-internet-selection');if(bar)bar.hidden=true;}
    const rows=cards.map((card,index)=>({
      card,index,
      price:moneyValue(safeText(card.querySelector(':scope > strong'))),
      gift:moneyValue(safeText(card.querySelector(':scope > div b')))
    })).filter(row=>row.price!=null);
    if(!rows.length)return;
    const priced=rows.filter(row=>row.price>0);
    const gifted=rows.filter(row=>row.gift!=null);
    const low=priced.length?priced.reduce((a,b)=>b.price<a.price?b:a):null;
    const high=gifted.length?gifted.reduce((a,b)=>Number(b.gift||0)>Number(a.gift||0)?b:a):null;
    const prices=priced.map(x=>x.price),gifts=gifted.map(x=>Number(x.gift||0));
    const minP=prices.length?Math.min(...prices):0,maxP=prices.length?Math.max(...prices):0;
    const minG=gifts.length?Math.min(...gifts):0,maxG=gifts.length?Math.max(...gifts):0;
    const balanced=rows.reduce((best,row)=>{
      const priceScore=row.price&&maxP>minP?(maxP-row.price)/(maxP-minP):.5;
      const giftScore=row.gift!=null&&maxG>minG?(Number(row.gift)-minG)/(maxG-minG):.5;
      const score=priceScore+giftScore;
      return !best||score>best.score?{row,score}:best;
    },null)?.row||null;
    rows.forEach(row=>{
      const labels=[];
      if(low&&row.card===low.card)labels.push('월요금 낮음');
      if(high&&row.card===high.card)labels.push('사은품 높음');
      if(balanced&&row.card===balanced.card)labels.push('균형형');
      const key=labels.join('|');
      if(row.card.dataset.recommendBadges===key)return;
      row.card.dataset.recommendBadges=key;
      let box=row.card.querySelector('.wired-recommend-badges');
      if(!labels.length){box?.remove();return}
      if(!box){box=document.createElement('div');box.className='wired-recommend-badges';row.card.prepend(box);}
      box.innerHTML=labels.map(label=>'<span>'+label+'</span>').join('');
    });
  }
  function visitHandoff(ctx){
    if(!ctx?.product_name){alert('먼저 상품을 선택해 주세요.');return;}
    // Store only product/quote details on this device. Never store name or phone.
    const selection={
      category:String(ctx.category||'').slice(0,40),
      product_id:String(ctx.product_id||'').slice(0,120),
      product_name:String(ctx.product_name||'').slice(0,150),
      provider:String(ctx.provider||'').slice(0,100),
      detail:String(ctx.detail||'').slice(0,550),
      monthly:Number.isFinite(Number(ctx.monthly))&&ctx.monthly!=null?Number(ctx.monthly):null
    };
    try{sessionStorage.setItem('wb_visit_selection_v1',JSON.stringify(selection));}catch{}
    try{window.woongbiTrackConversion?.('visit_handoff_start',{category:selection.category,product_id:selection.product_id});}catch{}
    location.assign('/visit.html?src=rates');
  }
  function visitButton(ctx){
    const button=document.createElement('button');button.type='button';
    button.className='store-visit-btn';button.textContent='이 상품 방문 예약';
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const selected=typeof ctx==='function'?ctx():ctx;
      visitHandoff(selected);
    });
    return button;
  }
  function decorateMobile(){
    const host=$('mobile-form');
    if(host && !host.querySelector('[data-store-mobile-apply]')){
      const button=makeApplyButton('선택한 휴대폰으로 상담 신청');
      button.dataset.storeMobileApply='1';
      button.type='button';
      button.addEventListener('click',()=>{
        const ctx=selectedMobileContext();
        if(!ctx){alert('휴대폰 기종과 요금제를 먼저 선택해 주세요.');return;}
        openApplication(ctx);
      });
      const trust=document.createElement('small');
      trust.className='store-apply-trust';
      trust.textContent='접수만으로 개통·결제되지 않습니다. 실제 가입 조건은 매장에서 확인합니다.';
      host.append(button,visitButton(selectedMobileContext),trust);
    }
    const container=$('purpose-results');
    if(container)container.querySelectorAll('.purpose-card').forEach(card=>{
      if(card.querySelector('[data-store-purpose-apply]'))return;
      const button=makeApplyButton('이 휴대폰으로 상담 신청');
      button.dataset.storePurposeApply='1';button.type='button';
      button.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        openApplication(purposeMobileContext(card));
      });
      const actions=card.querySelector('.purpose-card-actions')||card;
      actions.append(button,visitButton(()=>purposeMobileContext(card)));
    });
  }

  function decorateInternet(){
    document.querySelectorAll('.wired-compare-card').forEach(card=>{
      if(!card.querySelector('.store-apply-btn')){
        const apply=makeApplyButton('신청하기');
        apply.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          selectInternetCard(card);
          const ctx=internetCardContext(card);if(ctx)openApplication(ctx);
        });
        card.append(apply,visitButton(()=>internetCardContext(card)));
      }
    });
    enhanceInternetRecommendations();
  }
  function addSelectedApplyButtons(){
    const specs=[
      ['studyphone','.rate-panel[data-panel="studyphone"] .consult-copy-tools',()=>{const id=$('studyphone-plan')?.value;return id?studyphoneContext(id):null;}],
      ['mvno','.rate-panel[data-panel="mvno"] .consult-copy-tools',selectedMvnoContext],
      ['prepaid','.rate-panel[data-panel="prepaid"] .consult-copy-tools',()=>{const id=$('prepaid-plan')?.value;return id?prepaidContext(id):null;}],
      ['internet','.rate-panel[data-panel="internet"] .wired-quote-tools',selectedInternetContext]
    ];
    specs.forEach(([category,selector,getContext])=>{
      const host=document.querySelector(selector);if(!host||host.querySelector('[data-store-selected-apply="'+category+'"]'))return;
      const button=makeApplyButton('온라인 신청하기');button.dataset.storeSelectedApply=category;
      button.addEventListener('click',()=>{
        const ctx=getContext();
        if(!ctx){alert('먼저 상품이나 요금제를 선택해 주세요.');return}
        openApplication(ctx);
      });
      const share=document.createElement('button');share.type='button';share.className='store-share-btn';share.dataset.storeShare=category;share.textContent='같은 조건 공유';
      share.addEventListener('click',()=>shareCondition(category,getContext));
      host.append(button,share,visitButton(getContext));
      if(!host.querySelector('.store-apply-trust')){
        const trust=document.createElement('small');trust.className='store-apply-trust';trust.textContent='신청만으로 개통·계약 확정 X · 개인정보 암호화 저장 · 매장에서 최종 조건 재확인';host.append(trust);
      }
    });
  }
  function decorateAll(){
    decorateMobile();decorateStudyphone();decorateMvno();decorateInternet();addSelectedApplyButtons();renderPrepaidProducts();
  }

  function revealInternetStep(){
    const section=$('store-internet-fields');
    if(current?.category!=='internet'||!section||section.open)return false;
    const name=$('store-application-name')?.value?.trim()||'';
    const phone=digits($('store-application-phone')?.value||'');
    const status=$('store-application-status');
    if(name.length<2){if(status)status.textContent='먼저 성함을 입력해 주세요.';$('store-application-name')?.focus();return true;}
    if(!/^01[016789]\\d{7,8}$/.test(phone)){if(status)status.textContent='연락받으실 휴대폰 번호를 확인해 주세요.';$('store-application-phone')?.focus();return true;}
    section.open=true;
    const email=$('store-application-email'),address=$('store-application-address');
    if(email)email.required=true;
    if(address)address.required=true;
    document.querySelectorAll('input[name="store_billing_method"]').forEach(input=>input.required=true);
    const button=$('store-application-submit');
    if(button)button.textContent='정보 확인 후 상담 신청';
    if(status)status.textContent='마지막으로 인터넷 설치정보를 입력해 주세요.';
    section.scrollIntoView({behavior:'smooth',block:'start'});
    return true;
  }
  function showApplicationFallback(){
    const box=$('store-application-fallback');
    if(box)box.hidden=false;
  }
  async function copyApplicationQuote(){
    const quote=current?.quote_text||'';
    if(!quote)return;
    const status=$('store-application-status');
    try{await navigator.clipboard.writeText(quote);if(status)status.textContent='선택하신 상품 조건만 복사했어요. 카카오톡에 붙여넣어 주세요.';}
    catch{if(status)status.textContent='조건을 복사하지 못했습니다. 카카오톡 상담에서 상품명을 알려주세요.';}
  }

  async function submit(event){
    event.preventDefault();
    const status=$('store-application-status'),button=$('store-application-submit');
    if(!current)return;
    if(revealInternetStep())return;
    if(!policy){status.textContent='개인정보 처리 안내를 불러온 뒤 다시 신청해 주세요.';await loadPolicy();return}
    if(Date.now()-openedAt<600){status.textContent='신청 내용을 확인한 뒤 다시 눌러 주세요.';return}
    if($('store-application-honeypot').value){status.textContent='신청을 처리할 수 없습니다.';return}
    const name=$('store-application-name').value.trim();
    const phone=digits($('store-application-phone').value);
    const inquiry=$('store-application-inquiry').value.trim();
    const isInternet=current.category==='internet';
    const email=isInternet?$('store-application-email').value.trim():'';
    const installAddress=isInternet?$('store-application-address').value.trim():'';
    const billingMethod=isInternet?(document.querySelector('input[name="store_billing_method"]:checked')?.value||''):'';
    if(name.length<2){status.textContent='이름을 확인해 주세요.';return}
    if(!/^01[016789]\d{7,8}$/.test(phone)){status.textContent='연락처를 확인해 주세요.';return}
    if(isInternet&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status.textContent='이메일주소를 확인해 주세요.';$('store-application-email')?.focus();return}
    if(isInternet&&installAddress.length<5){status.textContent='설치주소를 확인해 주세요.';$('store-application-address')?.focus();return}
    if(isInternet&&!['bank','card'].includes(billingMethod)){status.textContent='자동이체 방식을 선택해 주세요.';return}
    if(hasSensitivePaymentNumber(inquiry)){status.textContent='계좌번호·카드번호는 문의사항에 입력하지 마세요. 실제 결제정보는 통신사 공식 접수 단계에서 확인합니다.';return}
    if(!$('store-application-consent').checked){status.textContent='개인정보 수집·이용 동의가 필요합니다.';return}
    const signature=current.product_id+'|'+phone;
    if(lastSubmit&&lastSubmit.signature===signature&&Date.now()-lastSubmit.at<120000){status.textContent='같은 상품 신청이 이미 접수되었습니다. 잠시 후 매장에서 연락드리겠습니다.';return}

    const payload={
      policy_version:policy.version,processing_consent:true,
      category:current.category,name,phone,
      inquiry,
      email,install_address:installAddress,billing_method:billingMethod,
      internet_carrier:isInternet?(current.provider||''):'',
      product_id:current.product_id,product_name:current.product_name,
      provider:current.provider||'',monthly:current.monthly,gift:current.gift,
      detail:current.detail||'',quote_text:current.quote_text||quoteLines(current),page_url:current.page_url||location.href,
      attribution:acquisitionContext()
    };
    button.disabled=true;status.textContent='신청을 접수하고 있습니다.';
    trackStore('store_apply_submit',current);
    try{
      const response=await fetch(API+'/api/store-application',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
      });
      const data=await response.json();
      if(!response.ok||!data.ok)throw Error(data.error||'신청을 접수하지 못했습니다.');
      lastSubmit={signature,at:Date.now()};
      trackStore('store_apply_success',current);
      closeApplication();showSuccess(data.receipt);
    }catch(e){status.textContent=(e.message||'접수 오류가 발생했습니다.')+' 카카오톡이나 전화로도 상담하실 수 있어요.';showApplicationFallback();}
    finally{button.disabled=false}
  }

  function syncCrossSell(){
    const active=document.querySelector('.rate-tab.active')?.dataset.tab||new URLSearchParams(location.search).get('wbtab')||new URLSearchParams(location.search).get('tab')||'mobile';
    const link=$('rate-cross-sell-primary');if(!link)return;
    if(active==='internet'){
      link.href='/rates.html?src=internet-crosssell';
      link.querySelector('b').textContent='휴대폰 요금도 같이 계산';
      link.querySelector('small').textContent='인터넷과 묶을 휴대폰 요금까지 같이 확인해 보세요.';
      link.querySelector('span').textContent='휴대폰 계산 →';
    }else{
      link.href='/rates.html?tab=internet&src=telecom-crosssell';
      link.querySelector('b').textContent='인터넷·TV 결합 확인';
      link.querySelector('small').textContent='휴대폰과 함께 쓰는 결합조건을 같이 비교해 보세요.';
      link.querySelector('span').textContent='인터넷·TV 확인 →';
    }
  }
  document.addEventListener('click',e=>{if(e.target.closest('.rate-tab'))setTimeout(syncCrossSell,80);});

  // Other site components may hand off a selected product to the same
  // secure, consent-gated form; no PII is put in query strings.
  window.WoongbiStoreApplication={open:openApplication};
  function boot(){
    const form=$('store-application-form');
    form?.addEventListener('submit',submit);
    form?.addEventListener('click',event=>{
      if(!event.target.closest('#store-application-submit'))return;
      if(current?.category==='internet' && !$('store-internet-fields')?.open){
        event.preventDefault();
        revealInternetStep();
      }
    },true);
    $('store-application-fallback-copy')?.addEventListener('click',copyApplicationQuote);
    $('store-internet-fields')?.addEventListener('toggle',()=>{
      if(current?.category!=='internet')return;
      const open=$('store-internet-fields').open;
      const email=$('store-application-email'),address=$('store-application-address');
      if(email)email.required=open;
      if(address)address.required=open;
      document.querySelectorAll('input[name="store_billing_method"]').forEach(input=>input.required=open);
    });
    $('store-application-close')?.addEventListener('click',closeApplication);
    $('store-application-cancel')?.addEventListener('click',closeApplication);
    $('store-application-dialog')?.addEventListener('click',e=>{if(e.target===$('store-application-dialog'))closeApplication();});
    $('store-application-success-confirm')?.addEventListener('click',()=>$('store-application-success')?.close());
    $('prepaid-provider')?.addEventListener('change',()=>setTimeout(renderPrepaidProducts,0));
    $('prepaid-plan')?.addEventListener('change',()=>setTimeout(renderPrepaidProducts,0));
    $('wired-compare-results')?.addEventListener('click',event=>{
      const detail=event.target.closest('[data-wired-provider]');
      const card=event.target.closest('.wired-compare-card');
      if(detail&&card)selectInternetCard(card);
    });
    ensureInternetSelectionBar();

    const observer=new MutationObserver(()=>queueMicrotask(decorateAll));
    ['studyphone-plan-list','mvno-recommend-list','mvno-plan-picker-list','wired-compare-results','purpose-results'].forEach(id=>{
      const el=$(id);if(el)observer.observe(el,{childList:true,subtree:true});
    });
    loadPolicy();loadSalesSignals();decorateAll();syncCrossSell();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
