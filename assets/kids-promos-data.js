(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const VERSION='data-20261006-1';
  let deals=[];
  const won=v=>Number(v||0).toLocaleString('ko-KR')+'원';
  const kidsActive=()=>document.querySelector('[data-purpose-category="kids"]')?.classList.contains('active');
  function imageFor(d){try{return window.woongbiDeviceImage?.({name:d.name,model_code:d.model})||''}catch{return''}}
  function line(label,value,cls=''){const row=document.createElement('div');if(cls)row.className=cls;const a=document.createElement('span'),b=document.createElement('b');a.textContent=label;b.textContent=value;row.append(a,b);return row}
  function consultText(d){return [
    '[웅비통신 키즈폰 특가 상담]','통신사: '+d.carrier,'가입유형: 신규가입','기종: '+d.name+' ('+d.model+')','출고가: '+won(d.price),
    '요금제: '+d.plan+' / '+won(d.planFee),'데이터: '+d.data,'통화: '+d.voice,'문자: '+d.sms,'영상·부가통화: '+d.video,
    '할인/지원 기준: '+d.method,d.discount?'선택약정 월 할인: -'+won(d.discount):'',d.publicSupport?'공시지원금: -'+won(d.publicSupport):'',
    d.extraSupport?'추가지원금: -'+won(d.extraSupport):'','기기값: 0원 행사','예상 월 납부액: '+won(d.monthly),'가입조건: '+d.age,
    '주요 안내: '+(d.benefits||[]).join(' · '),'※ 신규가입 한정 · 재고·지원금·프로모션은 상담 시점에 최종 확인합니다.'
  ].filter(Boolean).join('\n')}
  function render(){
    if(!kidsActive()||!deals.length)return;
    const box=$('purpose-results');if(!box)return;
    const join=$('purpose-join');if(join)join.value='신규가입';
    const note=$('purpose-category-note');
    if(note)note.textContent='신규가입 한정 키즈폰 특가입니다. 데이터·통화·문자·영상/부가통화와 할인·지원 조건은 등록된 최신 정책 데이터 기준이며, 재고와 최종 행사 조건은 상담 시점에 다시 확인합니다.';
    const carrier=$('purpose-carrier')?.value||'all';
    const rows=deals.filter(d=>d.active!==false&&(carrier==='all'||d.carrier===carrier));
    box.innerHTML='';
    if(!rows.length){box.innerHTML='<p>선택한 통신사의 키즈폰 특가가 없습니다.</p>';return}
    rows.forEach(d=>{
      const card=document.createElement('article');card.className='purpose-card kids-sale-card';card.dataset.kidsPolicyVersion=VERSION;
      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),sale=document.createElement('small');badge.textContent=d.carrier+' · 신규가입';sale.textContent='특가';top.append(badge,sale);
      const name=document.createElement('strong');name.textContent=d.name;
      const imgUrl=imageFor(d),imageFrame=imgUrl?document.createElement('div'):null;
      if(imageFrame){imageFrame.className='device-card-image purpose-device-image';const img=document.createElement('img');img.src=imgUrl;img.alt=d.name;img.loading='lazy';img.decoding='async';imageFrame.append(img)}
      const plan=document.createElement('em');plan.textContent=d.plan;
      const promo=document.createElement('div');promo.className='kids-zero-deal';promo.innerHTML='<span>특가</span><strong>기기값 0원 행사</strong><small>'+d.age+'</small>';
      const total=document.createElement('div');total.className='purpose-card-total';total.append(line('예상 월 납부액 · 신규가입 특가',won(d.monthly)));
      const amount=document.createElement('p');amount.className='quote-amount-note';amount.textContent=(d.discount?d.method+' · 월 '+won(d.discount)+' 할인':'공시지원 '+won(d.publicSupport)+' + 추가지원 '+won(d.extraSupport))+' · 실제 개통 전 최종 조건 재확인';
      const specs=document.createElement('div');specs.className='wb-v2-specs kids-policy-specs';
      [['데이터',d.data],['통화',d.voice],['문자',d.sms],['영상·부가',d.video]].forEach(([l,v])=>{const item=document.createElement('span'),s=document.createElement('small'),b=document.createElement('b');s.textContent=l;b.textContent=v;item.append(s,b);specs.append(item)});
      const details=document.createElement('details');details.className='recommend-details kids-policy-details';const summary=document.createElement('summary');summary.textContent='요금·지원·제공량 자세히 보기';const body=document.createElement('div');body.className='recommend-details-body';const detail=document.createElement('div');detail.className='purpose-card-detail kids-policy-lines';
      detail.append(line('출고가',won(d.price)),line('요금제 기본료',won(d.planFee)),line('월 통신요금',won(d.monthly)),line('데이터',d.data),line('통화',d.voice),line('문자',d.sms),line('영상·부가통화',d.video));
      if(d.discount)detail.append(line('선택약정 월 할인','-'+won(d.discount)));if(d.publicSupport)detail.append(line('공시지원금','-'+won(d.publicSupport)));if(d.extraSupport)detail.append(line('추가지원금','-'+won(d.extraSupport)));detail.append(line('기기값','0원','kids-device-zero'));
      const cond=document.createElement('div');cond.className='purpose-method-compare kids-sale-condition kids-policy-notes';const ct=document.createElement('strong');ct.textContent='가입·이용 조건';const ul=document.createElement('ul');[d.age,...(d.benefits||[]),'재고·지원금·프로모션은 상담 시 최종 확인'].forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.append(li)});cond.append(ct,ul);
      const best=document.createElement('div');best.className='purpose-best';best.textContent='기기값 0원 행사 · '+d.plan+' 기준 월 '+won(d.monthly);body.append(detail,cond,best);details.append(summary,body);
      const actions=document.createElement('div');actions.className='purpose-card-actions';const consult=document.createElement('button');consult.type='button';consult.className='primary';consult.style.gridColumn='1 / -1';consult.textContent='이 특가 상담';consult.addEventListener('click',()=>{try{window.woongbiTrackConversion?.('kids_promo_consult',{product_id:'kids-promo-'+d.key,category:'kids'});}catch{}const text=consultText(d);if(window.WoongbiQuoteHandoff?.open)window.WoongbiQuoteHandoff.open(text);else navigator.clipboard?.writeText?.(text)});actions.append(consult);
      card.append(top);if(imageFrame)card.append(imageFrame);card.append(name,plan,promo,total,amount,specs,details,actions);box.append(card);
    });
  }
  function ensure(){if(!kidsActive()||!deals.length)return;const box=$('purpose-results');if(!box)return;const cards=[...box.querySelectorAll('.kids-sale-card')];if(!cards.length||cards.some(c=>c.dataset.kidsPolicyVersion!==VERSION)||[...box.querySelectorAll('.wb-v2-specs b')].some(el=>/확인\s*필요/.test(el.textContent||'')))render()}
  fetch('/data/kids-promos.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{deals=(data.products||[]).filter(Boolean);render();}).catch(()=>{});
  document.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.purposeCategory==='kids')setTimeout(render,0)}));
  ['purpose-carrier','purpose-join'].forEach(id=>$(id)?.addEventListener('change',()=>{if(kidsActive())setTimeout(render,0)}));
  const target=$('purpose-results');if(target)new MutationObserver(()=>queueMicrotask(ensure)).observe(target,{childList:true,subtree:true,characterData:true});
  window.addEventListener('woongbi:quote-ready',ensure);
})();