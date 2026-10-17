(() => {
  'use strict';
  const API='https://woongbi-consent.woongbts.workers.dev';
  const END=Date.parse('2026-10-22T21:00:00+09:00');
  const CARRIERS=['SKT','KT','LGU+','상담 후 결정'];
  const MODELS=['256GB','512GB','1TB'];
  const COLORS=['스타 화이트','나이트 스카이','상담 후 결정'];
  // Carrier-specific Duo IDs confirmed from Zeronote's public device list
  // (2026-10-17). The wireless sync enables SKT preorder IDs in catalog.json.
  const DUO_QUOTE={
    SKT:{plan:'SKT-XP-969',devices:{'256GB':'SKT-XD-3053','512GB':'SKT-XD-3056','1TB':'SKT-XD-3059'}},
    KT:{plan:'KT-XP-2605',devices:{'256GB':'KT-XD-3054','512GB':'KT-XD-3057','1TB':'KT-XD-3060'}},
    'LGU+':{plan:'LG-XP-2512',devices:{'256GB':'LG-XD-3055','512GB':'LG-XD-3058','1TB':'LG-XD-3061'}}
  };
  function buildCalculatorUrl(carrier='KT',model='256GB'){
    const entry=DUO_QUOTE[carrier];
    if(!entry||!MODELS.includes(model))throw Error('요금 계산 기준 통신사 또는 용량을 확인해 주세요.');
    const q=new URLSearchParams({tab:'mobile',mode:'direct',brand:'apple',c:carrier,j:'번호이동',
      d:entry.devices[model],p:entry.plan,m:'contract',mo:'24',w:'none'});
    return '/rates.html?'+q.toString();
  }
  function syncCalculatorLinks(){
    const carrier=$('duo-calc-carrier')?.value||'KT';
    document.querySelectorAll('[data-duo-calc]').forEach(link=>{
      const model=link.dataset.duoCalc;
      link.href=buildCalculatorUrl(carrier,model);
      link.setAttribute('aria-label','아이폰 듀오 '+model+' '+carrier+' 예상 월요금 계산하기');
    });
  }
  let policy=null,busy=false,lastSubmission='',opener=null,openedAt=0;
  const $=id=>document.getElementById(id);
  function buildPayload(values,policyVersion){
    const name=String(values.name||'').trim(),phone=String(values.phone||'').replace(/\D/g,'');
    const carrier=String(values.carrier||''),model=String(values.model||''),color=String(values.color||'');
    const inquiry=String(values.inquiry||'').trim();
    if(name.length<2||name.length>40)throw Error('성함을 2자 이상 입력해 주세요.');
    if(!/^01[016789]\d{7,8}$/.test(phone))throw Error('연락받으실 휴대전화번호를 확인해 주세요.');
    if(!CARRIERS.includes(carrier))throw Error('희망 통신사를 선택해 주세요.');
    if(!MODELS.includes(model))throw Error('신청 모델의 용량을 선택해 주세요.');
    if(!COLORS.includes(color))throw Error('희망 색상을 선택해 주세요.');
    if(inquiry.length>1200)throw Error('요청사항은 1,200자 이내로 입력해 주세요.');
    if(/(?:\d[ -]?){12,19}/.test(inquiry))throw Error('요청사항에는 주민등록번호·카드번호·계좌번호를 입력하지 마세요.');
    if(!values.consent||!policyVersion)throw Error('개인정보 수집·이용 안내를 확인하고 동의해 주세요.');
    const productName='아이폰 듀오 사전예약 · '+model+' · '+color;
    const detail='희망 통신사: '+carrier+' / 신청 모델: iPhone Duo '+model+' / 희망 색상: '+color;
    return {category:'mobile',name,phone,inquiry,provider:carrier,
      product_id:'IPHONE-DUO-PREORDER-20261016',product_name:productName,detail,
      quote_text:'[웅비통신 아이폰 듀오 사전예약 상담]\n'+detail+'\n신청 후 매장에서 확인하고 연락드립니다.',
      policy_version:policyVersion,processing_consent:true};
  }
  window.WoongbiDuoPreorder={buildPayload,buildCalculatorUrl};
  function setStatus(message){$('duo-form-status').textContent=message;}
  async function loadPolicy(){
    const submit=$('duo-submit');submit.disabled=true;
    try{
      const response=await fetch(API+'/api/store-application-policy',{headers:{accept:'application/json'},cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data.ok||!data.policy?.version)throw Error();
      policy=data.policy;
      const box=$('duo-policy-copy');box.replaceChildren();
      const rows=[['처리자',policy.operator],['이용 목적',policy.purpose],['필수 항목',policy.items?.required],['선택 항목',policy.items?.optional],['보유 기간',policy.retention],['동의 거부',policy.refusal]];
      rows.forEach(([label,value])=>{if(!value)return;const p=document.createElement('p');p.textContent=label+' · '+value;box.append(p);});
      $('duo-policy-version').textContent='개인정보 처리 안내 '+policy.version;
      setStatus('');submit.disabled=Date.now()>=END;
    }catch{
      policy=null;setStatus('개인정보 안내를 불러오지 못했습니다. 다시 불러오거나 전화·카카오톡으로 문의해 주세요.');
    }
  }
  function close(){if(!busy)$('duo-dialog').close();}
  function open(button){
    opener=button;const dialog=$('duo-dialog');
    if(Date.now()>=END){setStatus('사전예약 기간이 종료되었습니다. 매장으로 문의해 주세요.');return;}
    $('duo-form').reset();$('duo-success').hidden=true;$('duo-form').hidden=false;
    $('duo-retry-policy').hidden=false;openedAt=Date.now();
    setStatus('개인정보 처리 안내를 확인하고 있습니다.');
    dialog.showModal();$('duo-name').focus({preventScroll:true});loadPolicy();
  }
  async function submit(event){
    event.preventDefault();if(busy)return;
    if(Date.now()>=END){setStatus('사전예약 기간이 종료되었습니다. 매장으로 문의해 주세요.');return;}
    if(!policy){setStatus('개인정보 안내를 먼저 불러와 주세요.');return;}
    if(Date.now()-openedAt<600||$('duo-website').value)return;
    let payload;
    try{
      payload=buildPayload(Object.fromEntries(new FormData($('duo-form'))),policy.version);
    }catch(e){setStatus(e.message);return;}
    const signature=JSON.stringify([payload.phone,payload.detail,payload.inquiry]);
    if(lastSubmission===signature){setStatus('이미 접수한 내용입니다. 매장에서 확인 후 연락드리겠습니다.');return;}
    // Contact data stays in the HTTPS request, never in URLs, analytics, or browser storage.
    payload.page_url=location.origin+location.pathname;
    try{const ctx=window.woongbiSiteAnalyticsContext?.()||{};payload.attribution={source:ctx.source||'direct',campaign:ctx.campaign||'',landing_path:location.pathname};}catch{}
    busy=true;$('duo-submit').disabled=true;setStatus('사전예약 신청을 접수하고 있습니다.');
    try{
      const response=await fetch(API+'/api/store-application',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok||!data.ok||!data.receipt?.id)throw Error(data.error||'신청을 접수하지 못했습니다.');
      lastSubmission=signature;$('duo-form').hidden=true;$('duo-success').hidden=false;
      $('duo-receipt').textContent='신청번호 '+String(data.receipt.id).slice(0,8);
      const lookup=$('duo-status-link');lookup.hidden=!data.receipt.lookup_token;
      if(data.receipt.lookup_token)lookup.href='/application-status.html?t='+encodeURIComponent(data.receipt.lookup_token);
      $('duo-form').reset();
      try{window.woongbiTrackConversion?.('store_apply_success',{product_id:payload.product_id,category:'mobile'});}catch{}
      $('duo-success-title').focus({preventScroll:true});
    }catch(e){setStatus((e.message||'접수 중 오류가 발생했습니다.')+' 입력 내용은 유지됩니다. 다시 시도하거나 아래 전화·카카오톡으로 문의해 주세요.');}
    finally{busy=false;$('duo-submit').disabled=false;}
  }
  function boot(){
    $('duo-calc-carrier')?.addEventListener('change',syncCalculatorLinks);
    syncCalculatorLinks();
    const dialog=$('duo-dialog');if(!dialog)return;
    document.querySelectorAll('[data-duo-open]').forEach(button=>{
      button.addEventListener('click',()=>open(button));
      if(Date.now()>=END){button.disabled=true;button.textContent='사전예약 접수 종료';}
    });
    $('duo-form').addEventListener('submit',submit);
    document.querySelectorAll('[data-duo-close]').forEach(button=>button.addEventListener('click',close));
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
    $('duo-retry-policy').addEventListener('click',loadPolicy);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
