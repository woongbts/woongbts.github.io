(() => {
  'use strict';
  const API='https://woongbi-consent.woongbts.workers.dev';
  const $=id=>document.getElementById(id);
  const CATEGORY_LABEL={studyphone:'공신폰',mvno:'알뜰폰',prepaid:'선불폰',internet:'인터넷·TV'};
  let policy=null,current=null,openedAt=0,lastSubmit=null;

  function digits(value){return String(value||'').replace(/\D/g,'');}
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
      const apply=makeApplyButton('신청하기');
      apply.addEventListener('click',event=>{
        event.stopPropagation();
        openApplication(mvnoCardContext(card,source.dataset.mvnoRecommendDetail||source.dataset.mvnoRecommendConsult));
      });
      actions.append(apply);
    });

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
  function decorateInternet(){
    document.querySelectorAll('.wired-compare-card').forEach(card=>{
      if(card.querySelector('.store-apply-btn'))return;
      const apply=makeApplyButton('신청하기');
      apply.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        const ctx=internetCardContext(card);if(ctx)openApplication(ctx);
      });
      card.append(apply);
    });
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
      host.append(button);
    });
  }
  function decorateAll(){
    decorateStudyphone();decorateMvno();decorateInternet();addSelectedApplyButtons();renderPrepaidProducts();
  }

  async function submit(event){
    event.preventDefault();
    const status=$('store-application-status'),button=$('store-application-submit');
    if(!current)return;
    if(!policy){status.textContent='개인정보 처리 안내를 불러온 뒤 다시 신청해 주세요.';await loadPolicy();return}
    if(Date.now()-openedAt<600){status.textContent='신청 내용을 확인한 뒤 다시 눌러 주세요.';return}
    if($('store-application-honeypot').value){status.textContent='신청을 처리할 수 없습니다.';return}
    const name=$('store-application-name').value.trim();
    const phone=digits($('store-application-phone').value);
    if(name.length<2){status.textContent='이름을 확인해 주세요.';return}
    if(!/^01[016789]\d{7,8}$/.test(phone)){status.textContent='연락처를 확인해 주세요.';return}
    if(!$('store-application-consent').checked){status.textContent='개인정보 수집·이용 동의가 필요합니다.';return}
    const signature=current.product_id+'|'+phone;
    if(lastSubmit&&lastSubmit.signature===signature&&Date.now()-lastSubmit.at<120000){status.textContent='같은 상품 신청이 이미 접수되었습니다. 잠시 후 매장에서 연락드리겠습니다.';return}

    const payload={
      policy_version:policy.version,processing_consent:true,
      category:current.category,name,phone,
      inquiry:$('store-application-inquiry').value.trim(),
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
    }catch(e){status.textContent=e.message||'신청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.';}
    finally{button.disabled=false}
  }

  function boot(){
    const form=$('store-application-form');
    form?.addEventListener('submit',submit);
    $('store-application-close')?.addEventListener('click',closeApplication);
    $('store-application-cancel')?.addEventListener('click',closeApplication);
    $('store-application-dialog')?.addEventListener('click',e=>{if(e.target===$('store-application-dialog'))closeApplication();});
    $('store-application-success-confirm')?.addEventListener('click',()=>$('store-application-success')?.close());
    $('prepaid-provider')?.addEventListener('change',()=>setTimeout(renderPrepaidProducts,0));
    $('prepaid-plan')?.addEventListener('change',()=>setTimeout(renderPrepaidProducts,0));

    const observer=new MutationObserver(()=>queueMicrotask(decorateAll));
    ['studyphone-plan-list','mvno-recommend-list','mvno-plan-picker-list','wired-compare-results'].forEach(id=>{
      const el=$(id);if(el)observer.observe(el,{childList:true,subtree:true});
    });
    loadPolicy();decorateAll();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
