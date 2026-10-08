(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const easy=byId('mobile-easy-intro');
  const advanced=byId('mobile-easy-advanced');
  const section=byId('purpose-recommend');
  const result=byId('purpose-results');
  const resultButton=byId('mobile-easy-see-results');
  const resultStatus=byId('mobile-easy-result-status');
  if(!easy||!advanced||!section||!result||!resultButton)return;
  const stages=[...easy.querySelectorAll('.mobile-easy-steps li')];
  const label={senior:'효도폰',kids:'키즈폰',value:'가성비폰',premium:'프리미엄폰'};
  const params=new URLSearchParams(location.search);
  const seniorPanel=byId('senior-phone-kind');
  const seniorButtons=[...(seniorPanel?.querySelectorAll('[data-senior-type]')||[])];
  const kindStatus=byId('senior-phone-kind-note');
  const seniorHint=byId('purpose-category-note');
  const PHONE_KINDS=['smartphone','folder'];
  let seniorType=paramsSeniorType();
  function paramsSeniorType(){
    const requested=new URLSearchParams(location.search).get('senior_type');
    return PHONE_KINDS.includes(requested)?requested:'smartphone';
  }
  function folderName(value){
    const text=String(value||'').toLowerCase().replace(/\\s+/g,'');
    if(/갤럭시z?(폴드|플립)|galaxyz?(fold|flip)|zfold|zflip|폴드[678]|플립[678]/.test(text))return false;
    return /스타일폴더|stylefolder|folderphone|폴더폰|폴더형|버튼형|피처폰|featurephone|와인폰|와인스마트|at-m140|폴더2/.test(text);
  }
  function visibleSeniorCards(){
    return [...result.querySelectorAll('.purpose-card')].filter(card=>!card.hidden&&card.style.display!=='none');
  }
  function filterSeniorCards(){
    const senior=current()==='senior';
    const isSmart=seniorType==='smartphone';
    if(seniorPanel)seniorPanel.hidden=!senior;
    if(senior)document.documentElement.dataset.seniorPhoneType=seniorType;
    else delete document.documentElement.dataset.seniorPhoneType;
    seniorButtons.forEach(btn=>{
      const selected=btn.dataset.seniorType===seniorType;
      btn.classList.toggle('is-selected',selected);
      btn.setAttribute('aria-pressed',String(selected));
    });
    const cards=[...result.querySelectorAll('.purpose-card')];
    cards.forEach(card=>{
      if(!senior){card.hidden=false;card.style.display='';return;}
      const title=card.querySelector(':scope > strong, h3, h4')?.textContent||'';
      const detected=card.dataset.seniorKind || (folderName(title)?'folder':'smartphone');
      card.dataset.seniorKind=detected;
      const show=detected===seniorType;
      card.hidden=!show;
      card.style.display=show?'':'none';
    });
    const old=result.querySelector('.senior-type-empty');
    if(!senior){old?.remove();return;}
    const visible=visibleSeniorCards();
    if(cards.length&&!visible.length){
      if(!old){
        const empty=document.createElement('div');
        empty.className='senior-type-empty';
        empty.innerHTML='<strong></strong><span></span>';
        result.append(empty);
      }
      const target=result.querySelector('.senior-type-empty');
      target.querySelector('strong').textContent=isSmart?'현재 조건에 맞는 일반 스마트폰이 없어요.':'현재 조건에 맞는 버튼형 폴더폰이 없어요.';
      target.querySelector('span').textContent='통신사·가입유형을 바꿔보시거나 매장에 문의해 주세요. 다른 종류의 휴대폰을 대신 보여드리지는 않습니다.';
    }else old?.remove();
    if(kindStatus)kindStatus.textContent=isSmart
      ?'카카오톡·사진·유튜브를 사용하는 부모님께 알맞은 일반 스마트폰부터 보여드립니다.'
      :'통화·문자 위주로 사용할 버튼형 폴더폰만 보여드립니다.';
    if(seniorHint)seniorHint.textContent=isSmart
      ?'일반 스마트폰 추천 · 화면 보기와 카카오톡 사용을 고려합니다. 공시지원금·선택약정과 최종 가입조건은 상담 시 확인해 주세요.'
      :'버튼형 폴더폰 추천 · 통화·문자 중심으로 비교합니다. 공시지원금·선택약정과 최종 가입조건은 상담 시 확인해 주세요.';
  }

  let waiting=false;
  let observer=null;
  const current=()=>document.querySelector('[data-purpose-category].active')?.dataset.purposeCategory||params.get('purpose')||'senior';
  function activeStep(n){
    stages.forEach((el,index)=>{
      const current=index+1===n;
      el.classList.toggle('is-current',current);
      if(current)el.setAttribute('aria-current','step');
      else el.removeAttribute('aria-current');
    });
  }
  function syncStep(){
    const active=label[current()]||'휴대폰';
    const choice=document.querySelector('#mobile-easy-result-guide .mobile-easy-current');
    if(choice)choice.textContent=active+' 추천 확인하기';
    filterSeniorCards();
    const cards=visibleSeniorCards();
    const state=cards.length ? cards.length+'개 추천 상품을 확인할 수 있어요.' : (result.querySelector('.senior-type-empty')?'현재 조건에서 맞는 상품이 없어요. 다른 조건을 선택해 주세요.':'조건에 맞는 상품을 불러오는 중이에요.');
    if(resultStatus&&!waiting)resultStatus.textContent=state;
  }
  function scrollToResult(){
    filterSeniorCards();
    const first=visibleSeniorCards()[0];
    const go=()=>{
      waiting=false;
      resultButton.disabled=false;
      activeStep(3);
      resultStatus.textContent='마음에 드는 상품 아래의 ‘상담 신청하기’를 눌러주세요.';
      result.scrollIntoView({behavior:'smooth',block:'start'});
    };
    if(first){go();return;}
    if(waiting)return;
    waiting=true;
    resultStatus.textContent='선택한 조건으로 추천 상품을 찾는 중이에요. 잠시만 기다려 주세요.';
    resultButton.disabled=true;
    let timer;
    const pendingObserver=new MutationObserver(()=>{
      filterSeniorCards();
      if(visibleSeniorCards().length){
        pendingObserver.disconnect();window.clearTimeout(timer);go();
      }
    });
    pendingObserver.observe(result,{childList:true});
    timer=window.setTimeout(()=>{
      pendingObserver.disconnect();waiting=false;resultButton.disabled=false;
      filterSeniorCards();
      if(visibleSeniorCards().length)go();
      else {
        resultStatus.textContent='추천 상품을 불러오지 못했어요. 통신사·가입유형을 바꾸거나 매장에 전화로 문의해 주세요.';
        result.scrollIntoView({behavior:'smooth',block:'start'});
      }
    },9000);
  }
  seniorButtons.forEach(btn=>btn.addEventListener('click',()=>{
    const type=btn.dataset.seniorType;
    if(!PHONE_KINDS.includes(type)||type===seniorType)return;
    seniorType=type;
    activeStep(2);
    filterSeniorCards();
    syncStep();
    window.dispatchEvent(new CustomEvent('woongbi:senior-phone-type-change',{detail:{type}}));
    try{window.woongbiTrackConversion?.('rate_calculator_start',{category:'mobile',product_id:'senior:'+type})}catch{}
  }));
  resultButton.addEventListener('click',scrollToResult);
  section.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.addEventListener('click',()=>{
    activeStep(2);window.setTimeout(()=>{filterSeniorCards();syncStep();},100);
    try{window.woongbiTrackConversion?.('rate_calculator_start',{category:'mobile',product_id:'purpose:'+btn.dataset.purposeCategory})}catch{}
  }));
  ['purpose-carrier','purpose-join','purpose-pension'].forEach(id=>byId(id)?.addEventListener('change',()=>{
    activeStep(2);syncStep();
  }));
  result.addEventListener('click',event=>{
    if(event.target.closest('.store-apply-btn'))activeStep(3);
  });
  observer=new MutationObserver(()=>{filterSeniorCards();syncStep();});
  observer.observe(result,{childList:true,subtree:false});
  if(params.get('mode')==='direct')advanced.open=true;
  document.querySelectorAll('[data-mobile-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.mobileMode!=='purpose')advanced.open=true;
    else {
      activeStep(1);
      section.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }));
  if(params.get('purpose')){
    activeStep(2);
  }else activeStep(1);
  filterSeniorCards();
  syncStep();
  // Preserve the regular full calculator; this is only a simple entry point.
})();
