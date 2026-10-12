(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const request=byId('store-benefit-request');
  const basePrice=byId('store-benefit-base-price');
  const status=byId('store-benefit-request-status');
  if(!request||!basePrice||!status)return;
  const selected=id=>{
    const field=byId(id);
    return field?.selectedOptions?.[0]?.textContent?.trim()||'';
  };
  const money=n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원';
  function currentQuote(){
    // Display the existing server-calculated amount, never a guessed store discount.
    const quote=window.WoongbiQuoteApi?.getCurrent?.();
    return quote?.known===true&&Number.isFinite(Number(quote.monthly))&&Number(quote.monthly)>=0?quote:null;
  }
  function update(){
    const device=byId('device-select')?.value;
    const plan=byId('plan-select')?.value;
    if(!device||!plan){
      basePrice.textContent='기종·요금제 선택 후 표시';
      return;
    }
    const quote=currentQuote();
    basePrice.textContent=quote?money(quote.monthly):'현재 조건 계산·확인 중';
  }
  const fields=['carrier','join-type','discount-method','device-select','plan-select','installment-months','welfare-type'];
  fields.forEach(id=>byId(id)?.addEventListener('change',()=>{
    basePrice.textContent='현재 조건 계산·확인 중';
    status.textContent='선택한 기종·요금제를 기준으로 매장 혜택과 최종 납부금액을 확인 요청할 수 있습니다.';
    queueMicrotask(update);
  }));
  window.addEventListener('woongbi:quote-ready',update);
  window.addEventListener('woongbi:quote-unavailable',update);
  window.addEventListener('woongbi:quote-api-loaded',update);

  request.addEventListener('click',()=>{
    const device=byId('device-select');
    const plan=byId('plan-select');
    if(!device?.value||!plan?.value){
      status.textContent='먼저 통신사·기종·요금제를 선택해 주세요.';
      byId('mobile-form')?.scrollIntoView({behavior:'smooth',block:'start'});
      (!device?.value?device:plan)?.focus?.();
      return;
    }
    const apply=byId('mobile-form')?.querySelector('[data-store-mobile-apply]');
    if(!apply){
      status.textContent='상담 신청창을 불러오지 못했습니다. 아래 기존 상담 버튼이나 매장 전화를 이용해 주세요.';
      return;
    }
    apply.click(); // Reuse the existing privacy-consent-guarded consultation flow.
    const dialog=byId('store-application-dialog');
    if(!dialog?.open){
      status.textContent='상담 신청창을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      return;
    }
    const quote=currentQuote();
    const method=selected('discount-method')||'할인방식 확인';
    const discount=byId('discount-method')?.value==='contract'?'선택약정':'공시지원';
    const lines=[
      '[매장 추가혜택 및 최종 납부금액 확인 요청]',
      '기종: '+selected('device-select'),
      '통신사: '+selected('carrier'),
      '가입유형: '+selected('join-type'),
      '요금제: '+selected('plan-select'),
      '할인방식: '+(method||discount),
      '할부기간: '+selected('installment-months'),
      '복지할인: '+selected('welfare-type'),
      quote?'현재 홈페이지 예상 월 납부액(매장 추가혜택 미반영): '+money(quote.monthly):
        '현재 홈페이지 예상 월 납부액: 자동 확인 필요',
      '확인 요청: 매장 추가지원금 적용 여부와 가능 금액(없을 수 있음), 요금제 유지기간 및 변경 시 조건, 부가서비스 가입 필요 여부·월 비용·유지기간, 매장 혜택 반영 후 최종 월 납부액과 24개월 총 납부금액을 알려주세요.'
    ];
    const inquiry=byId('store-application-inquiry');
    if(inquiry){
      inquiry.value=lines.join('\n').slice(0,1200);
      inquiry.dispatchEvent(new Event('input',{bubbles:true}));
      const optional=dialog.querySelector('.store-inquiry-optional');
      if(optional)optional.open=true;
    }
    const summary=byId('store-application-summary');
    if(summary)summary.textContent+=' · 홈페이지 예상 금액은 매장 추가지원금 미반영이며, 최종 금액은 별도 확인합니다.';
    const intro=byId('store-application-intro-description');
    if(intro)intro.textContent='기종·요금제와 추가혜택 확인 요청을 함께 접수합니다. 실제 할인 제공 여부, 유지조건, 부가서비스 및 최종 금액은 매장에서 확인 후 안내합니다. 접수만으로 개통·결제되지 않습니다.';
    status.textContent='상담 신청창에서 확인 요청 항목을 작성했습니다. 내용을 확인한 뒤 원하시면 접수해 주세요.';
  });
  update();
})();
