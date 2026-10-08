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
    const cards=result.querySelectorAll('.purpose-card');
    const state=cards.length ? cards.length+'개 추천 상품을 확인할 수 있어요.' : '조건에 맞는 상품을 불러오는 중이에요.';
    if(resultStatus&&!waiting)resultStatus.textContent=state;
  }
  function scrollToResult(){
    const cards=result.querySelectorAll('.purpose-card');
    if(!cards.length){
      waiting=true;
      resultStatus.textContent='선택한 조건으로 추천 상품을 찾는 중이에요. 잠시만 기다려 주세요.';
      resultButton.disabled=true;
      window.setTimeout(()=>{
        waiting=false;resultButton.disabled=false;
        const found=result.querySelector('.purpose-card');
        if(found)found.scrollIntoView({behavior:'smooth',block:'start'});
        else {
          resultStatus.textContent='상품을 찾지 못했어요. 통신사나 가입유형을 바꾸거나 매장에 전화로 문의해 주세요.';
          result.scrollIntoView({behavior:'smooth',block:'start'});
        }
      },1800);
      return;
    }
    activeStep(3);
    resultStatus.textContent='마음에 드는 상품 아래의 ‘상담 신청하기’를 눌러주세요.';
    result.scrollIntoView({behavior:'smooth',block:'start'});
  }
  resultButton.addEventListener('click',scrollToResult);
  section.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.addEventListener('click',()=>{
    activeStep(2);window.setTimeout(syncStep,100);
    try{window.woongbiTrackConversion?.('rate_calculator_start',{category:'mobile',product_id:'purpose:'+btn.dataset.purposeCategory})}catch{}
  }));
  ['purpose-carrier','purpose-join','purpose-pension'].forEach(id=>byId(id)?.addEventListener('change',()=>{
    activeStep(2);syncStep();
  }));
  result.addEventListener('click',event=>{
    if(event.target.closest('.store-apply-btn'))activeStep(3);
  });
  observer=new MutationObserver(()=>{if(result.querySelectorAll('.purpose-card').length)syncStep();});
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
  syncStep();
  // Preserve the regular full calculator; this is only a simple entry point.
})();
