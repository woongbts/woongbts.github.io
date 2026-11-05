/* Customer paths: show results first, retain every calculation and consultation option. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const purpose=$('purpose-recommend');
  if(purpose){
    const senior=$('senior-phone-kind');
    const title=$('mobile-easy-condition-title');
    const controls=purpose.querySelector('.purpose-controls');
    const guide=$('mobile-easy-result-guide');
    if(senior&&title&&controls&&guide){
      const options=document.createElement('details');options.id='customer-purpose-options';options.className='customer-purpose-options';
      const summary=document.createElement('summary');
      const description=document.createElement('span');description.id='customer-purpose-current';
      const label=document.createElement('b');label.textContent='조건 바꾸기';summary.append(description,label);options.append(summary);
      senior.before(options);options.append(senior,title,controls,guide);
      const update=()=>{
        const carrier=$('purpose-carrier')?.selectedOptions[0]?.textContent||'전체 통신사';
        const join=$('purpose-join')?.value||'번호이동';
        const type=purpose.querySelector('[data-senior-type][aria-pressed="true"] strong')?.textContent||'일반 스마트폰';
        const isSenior=purpose.querySelector('[data-purpose-category].active')?.dataset.purposeCategory==='senior';
        const pension=$('purpose-pension')?.checked?' · 기초연금 할인 적용':'';
        description.textContent=carrier+' · '+join+(isSenior?' · '+type:'')+pension+' 기준';
      };
      purpose.addEventListener('change',update);
      purpose.addEventListener('click',e=>{if(e.target.closest('[data-purpose-category],[data-senior-type]'))setTimeout(update,150)});
      window.addEventListener('woongbi:senior-phone-type-change',update);update();
      const head=purpose.querySelector('.purpose-head p');if(head)head.textContent='용도를 고르면 아래에 추천 상품이 보입니다. 통신사·가입유형은 ‘조건 바꾸기’에서 수정하세요.';
    }
  }
  // Keep one primary application action; secondary paths remain in a disclosure.
  const results=$('purpose-results');
  if(results){
    let queued=false;
    const simplify=()=>{
      queued=false;
      results.querySelectorAll('.purpose-card-actions').forEach(actions=>{
        const primary=actions.querySelector(':scope > .store-apply-btn');if(!primary)return;
        let more=actions.querySelector(':scope > .customer-card-more');
        const secondary=[...actions.children].filter(n=>n!==primary&&n!==more);
        if(!secondary.length)return;
        if(!more){more=document.createElement('details');more.className='customer-card-more';const summary=document.createElement('summary');summary.textContent='상세 조건·다른 상담 방법';more.append(summary);actions.append(more);}
        secondary.forEach(n=>more.append(n));
      });
    };
    new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(simplify)}}).observe(results,{childList:true,subtree:true});simplify();
  }
  const location=document.querySelector('.home-entry-phone')||document.querySelector('.rate-tabs');
  if(location){
    const button=document.createElement('button');button.type='button';button.className='customer-inline-ai';button.textContent='AI에게 질문하기';
    button.addEventListener('click',()=>{$('woongbi-ai-launcher')?.click()});location.insertAdjacentElement('afterend',button);
  }
})();
