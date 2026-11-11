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

/* Customer-readable mobile quote summary · 2026-11-11 */
(() => {
  'use strict';
  const previewButton = document.getElementById('customer-quote-preview');
  if (!previewButton) return;
  const $ = id => document.getElementById(id);
  const api = () => window.WoongbiQuoteApi;
  const quoteData = () => {
    const source = api();
    const state = source?.state?.();
    const quote = state && source?.getCurrent?.(state.method);
    return state && quote?.known && Number.isFinite(Number(quote.monthly))
      ? {state,quote} : null;
  };
  const won = value => Number.isFinite(Number(value)) && value !== null
    ? Math.round(Number(value)).toLocaleString('ko-KR') + '원' : '상담 확인';
  const selected = id => {
    const element = $(id);
    return String(element?.selectedOptions?.[0]?.textContent || element?.value || '—').trim().slice(0,180);
  };
  const visibility = () => {
    previewButton.hidden = !quoteData() ||
      document.documentElement.dataset.quoteApi !== 'ready';
  };
  window.addEventListener('woongbi:quote-ready',visibility);
  window.addEventListener('woongbi:quote-unavailable',() => {previewButton.hidden = true;});
  document.addEventListener('change',event => {
    if(event.target?.closest?.('#mobile-form')) previewButton.hidden = true;
  },true);
  visibility();

  const addRow = (parent,label,value) => {
    const row = document.createElement('div');
    row.className = 'customer-quote-line';
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = label;
    definition.textContent = String(value);
    row.append(term,definition);
    parent.append(row);
  };
  function showPreview(){
    const result=quoteData();
    if(!result){
      previewButton.hidden = true;
      api()?.sync?.();
      return;
    }
    const {state,quote}=result;
    const dialog=document.createElement('dialog');
    dialog.className='customer-quote-dialog';
    dialog.setAttribute('aria-labelledby','customer-quote-heading');
    dialog.innerHTML =
      '<header class="customer-quote-top"><div><small>웅비통신 덕천만덕점 · 고객용 예상 견적</small><h2 id="customer-quote-heading">내 휴대폰 견적서</h2></div><button type="button" class="customer-quote-close" aria-label="견적서 닫기">✕</button></header>'+
      '<p class="customer-quote-ref"></p>'+
      '<div class="customer-quote-total"><span>예상 월 납부액</span><strong></strong><small>월 단말 할부금 + 월 통신요금 · 제휴카드 미적용</small></div>'+
      '<dl class="customer-quote-details"></dl>'+
      '<div class="customer-quote-period"><strong>24개월 참고 총 부담</strong><b></b><small></small></div>'+
      '<p class="customer-quote-disclaimer">위 금액은 선택한 요금제·할인방식을 유지할 때의 예상치입니다. 요금제 변경 가능일과 변경 후 월요금, 부가서비스·위약금·추가지원금·실제 개통 가능 여부는 상담 시 확인합니다. 견적 링크를 다시 열면 그 시점의 상품 데이터로 재계산되므로 작성 당시 금액이 보장되지 않습니다.</p>'+
      '<div class="customer-quote-actions"><button type="button" data-customer-share>견적 공유</button><button type="button" data-customer-visit>방문 상담 예약</button><button type="button" data-customer-consult>카카오톡 상담</button></div>';
    const number=String($('quote-number')?.textContent||'').trim();
    dialog.querySelector('.customer-quote-ref').textContent =
      (number && number!=='견적 생성 전' ? number+' · ' : '')+
      new Date().toLocaleString('ko-KR',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+' 기준';
    dialog.querySelector('.customer-quote-total strong').textContent=won(quote.monthly);
    const details=dialog.querySelector('.customer-quote-details');
    addRow(details,'통신사',selected('carrier'));
    addRow(details,'가입유형',selected('join-type'));
    addRow(details,'휴대폰',selected('device-select'));
    addRow(details,'요금제',selected('plan-select'));
    addRow(details,'할인방식',state.method==='contract'?'선택약정 25%':'공시지원금');
    addRow(details,'단말 할부기간',(Number(state.months)||24)+'개월');
    addRow(details,'월 단말기 할부',won(quote.inst?.monthly));
    addRow(details,'월 통신요금',won(quote.service));
    const period=dialog.querySelector('.customer-quote-period');
    const is24=Number(state.months)===24 && Number.isFinite(Number(quote.total24));
    period.querySelector('b').textContent=is24?won(quote.total24):'24개월 할부 선택 시 확인';
    period.querySelector('small').textContent=is24
      ? '현재 요금제·할인 조건을 24개월 유지한 계산 기준 · 정책 변동 및 추가혜택 제외'
      : '다른 할부기간을 선택한 상태입니다. 24개월 비교는 계산기에서 할부기간을 변경해 확인해 주세요.';
    const close=()=>dialog.close();
    dialog.querySelector('.customer-quote-close').addEventListener('click',close);
    dialog.querySelector('[data-customer-share]').addEventListener('click',()=>{
      close();
      $('share-quote')?.click();
    });
    dialog.querySelector('[data-customer-visit]').addEventListener('click',()=>{
      close();
      document.querySelector('#mobile-quote-choice [data-rate-quote-action="visit"]')?.click();
    });
    dialog.querySelector('[data-customer-consult]').addEventListener('click',()=>{
      close();
      $('consult-quote')?.click();
    });
    dialog.addEventListener('close',()=>{
      dialog.remove();
      previewButton.focus({preventScroll:true});
    },{once:true});
    document.body.append(dialog);
    if(typeof dialog.showModal==='function') dialog.showModal();
    else {dialog.setAttribute('open','');dialog.setAttribute('role','dialog');}
  }
  previewButton.addEventListener('click',showPreview);
})();
