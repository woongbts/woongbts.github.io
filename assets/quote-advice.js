(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let lastKey='';

  function won(v){return Number(v||0).toLocaleString('ko-KR')+'원';}
  function ensureBox(){
    let box=$('quote-advice');
    if(box)return box;
    const summary=$('calc-summary');
    if(!summary)return null;
    box=document.createElement('section');
    box.id='quote-advice';
    box.className='quote-advice';
    box.hidden=true;
    box.setAttribute('aria-live','polite');
    box.innerHTML='<div class="quote-advice-head"><span>이 견적 한줄 정리</span><strong id="quote-advice-title"></strong></div><p id="quote-advice-reason"></p><div class="quote-advice-check"><b>같이 확인할 것</b><span id="quote-advice-check"></span></div>';
    summary.insertAdjacentElement('afterend',box);
    return box;
  }
  function selectedLabel(id){
    const el=$(id);
    return el?.options?.[el.selectedIndex]?.textContent?.trim()||'';
  }
  function render(){
    const box=ensureBox(); if(!box)return;
    const api=window.WoongbiQuoteApi;
    const support=api?.getCurrent?.('support');
    const contract=api?.getCurrent?.('contract');
    const device=$('device-select')?.value||'';
    const plan=$('plan-select')?.value||'';
    if(!device||!plan||(!support?.known&&!contract?.known)){box.hidden=true;return}

    const current=$('discount-method')?.value||'support';
    let title='',reason='';
    if(support?.known&&contract?.known){
      const diff=Math.abs(Number(support.monthly)-Number(contract.monthly));
      if(diff<=2000){
        title='두 할인방식의 월 차이가 크지 않아요.';
        reason='월 납부액 차이는 '+won(diff)+' 정도입니다. 월요금만 보기보다 공시지원금 규모와 선택약정 유지조건을 함께 비교하는 편이 좋습니다.';
      }else if(Number(support.monthly)<Number(contract.monthly)){
        title='현재 조건에서는 공시지원금 쪽 월 부담이 더 낮아요.';
        reason='선택약정보다 예상 월 납부액이 약 '+won(diff)+' 낮습니다. 단말 지원금이 월 단말금에 바로 반영되는 조건입니다.';
      }else{
        title='현재 조건에서는 선택약정 쪽 월 부담이 더 낮아요.';
        reason='공시지원금보다 예상 월 납부액이 약 '+won(diff)+' 낮습니다. 단말 지원금 대신 통신요금 25% 할인 효과가 더 큰 조건입니다.';
      }
    }else if(current==='support'&&support?.known){
      title='현재 공시지원금 기준 예상금액입니다.';
      reason='확인된 지원금을 단말기 가격에 반영해 계산했습니다. 선택약정 금액이 확인되면 두 방식을 함께 비교해 드립니다.';
    }else if(contract?.known){
      title='현재 선택약정 기준 예상금액입니다.';
      reason='단말 지원금 없이 통신요금 25% 할인을 반영한 예상금액입니다.';
    }else{
      box.hidden=true;return;
    }
    const check='가족·인터넷 결합, 매장 추가지원금, 요금제 유지기간·부가서비스·재고는 최종 상담에서 다시 확인합니다.';
    $('quote-advice-title').textContent=title;
    $('quote-advice-reason').textContent=reason;
    $('quote-advice-check').textContent=check;
    box.hidden=false;

    const key=[device,plan,current,support?.monthly,contract?.monthly].join('|');
    if(key!==lastKey){
      lastKey=key;
      try{window.woongbiTrackConversion?.('mobile_quote_result_view',{device_id:device,plan_id:plan,method:current,advice:title});}catch{}
    }
  }
  function schedule(){setTimeout(render,0);setTimeout(render,250);}
  window.addEventListener('woongbi:quote-ready',schedule);
  window.addEventListener('woongbi:quote-api-loaded',schedule);
  window.addEventListener('woongbi:quote-unavailable',schedule);
  ['carrier','join-type','discount-method','device-select','plan-select','installment-months','welfare-type'].forEach(id=>$(id)?.addEventListener('change',schedule));
  document.addEventListener('DOMContentLoaded',schedule,{once:true});
})();