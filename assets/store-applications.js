(() => {
  'use strict';
  const API='https://woongbi-consent.woongbts.workers.dev';
  const $=id=>document.getElementById(id);
  const CATEGORY_LABEL={studyphone:'공신폰',mvno:'알뜰폰',prepaid:'선불폰',internet:'인터넷·TV'};
  let policy=null,current=null,openedAt=0,lastSubmit=null;
  let salesSignals=new Map();

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
      const share=document.createElement('button');share.type='button';share.className='store-share-btn';share.dataset.storeShare=category;share.textContent='같은 조건 공유';
      share.addEventListener('click',()=>shareCondition(category,getContext));
      host.append(button,share);
      if(!host.querySelector('.store-apply-trust')){
        const trust=document.createElement('small');trust.className='store-apply-trust';trust.textContent='신청만으로 개통·계약 확정 X · 개인정보 암호화 저장 · 매장에서 최종 조건 재확인';host.append(trust);
      }
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
    loadPolicy();loadSalesSignals();decorateAll();syncCrossSell();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
