(function(){
  const money=n=>Number(String(n||'').replace(/[^0-9.-]/g,''))||0;
  const won=n=>Math.max(0,Math.round(n)).toLocaleString('ko-KR')+'원';

  document.querySelectorAll('.rate-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x===tab));
    document.querySelectorAll('.rate-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===tab.dataset.tab));
  }));

  const discountType=document.getElementById('discount-type');
  const supportFields=document.getElementById('support-fields');
  function syncDiscountMode(){supportFields.classList.toggle('is-hidden',discountType.value==='contract')}
  discountType.addEventListener('change',syncDiscountMode);syncDiscountMode();

  document.getElementById('mobile-form').addEventListener('submit',e=>{
    e.preventDefault();
    const mode=discountType.value;
    const price=money(document.getElementById('device-price').value);
    const support=mode==='support'?money(document.getElementById('public-support').value):0;
    const extra=mode==='support'?money(document.getElementById('extra-support').value):0;
    const upfront=money(document.getElementById('upfront').value);
    const months=money(document.getElementById('installment-months').value)||24;
    const plan=money(document.getElementById('plan-fee').value);
    const bundle=money(document.getElementById('bundle-discount').value);
    const welfare=money(document.getElementById('welfare-discount').value);
    const card=money(document.getElementById('card-discount').value);
    const other=money(document.getElementById('other-monthly').value);
    const principal=Math.max(0,price-support-extra-upfront);
    const deviceMonthly=principal/months;
    const contractDiscount=mode==='contract'?plan*.25:0;
    const serviceMonthly=Math.max(0,plan-contractDiscount-bundle-welfare-card)+other;
    const total=deviceMonthly+serviceMonthly;
    document.getElementById('principal').textContent=won(principal);
    document.getElementById('device-monthly').textContent=won(deviceMonthly);
    document.getElementById('service-monthly').textContent=won(serviceMonthly);
    document.getElementById('monthly-total').textContent=won(total);
    const carrier=document.getElementById('carrier').value;
    const device=document.getElementById('device-name').value.trim()||'선택 기종';
    const type=document.getElementById('join-type').value;
    const label=mode==='contract'?'선택약정 25% 단순 반영':'공시지원금 반영';
    document.getElementById('calc-summary').textContent=`${carrier} · ${device} · ${type} · ${label} 기준의 단순 예상치입니다.`;
  });

  document.getElementById('mvno-form').addEventListener('submit',e=>{
    e.preventDefault();
    const promo=money(document.getElementById('mvno-promo').value);
    const promoMonths=Math.min(12,Math.max(0,money(document.getElementById('mvno-months').value)));
    const after=money(document.getElementById('mvno-after').value);
    const annual=promo*promoMonths+after*(12-promoMonths);
    const avg=annual/12;
    document.getElementById('mvno-average').textContent=won(avg);
    const name=document.getElementById('mvno-name').value.trim()||'선택 요금제';
    document.getElementById('mvno-summary').textContent=`${name}을 12개월 사용한다고 가정하면 총 ${won(annual)}, 월평균 ${won(avg)} 정도입니다.`;
  });

  document.getElementById('internet-form').addEventListener('submit',e=>{
    e.preventDefault();
    const internet=money(document.getElementById('internet-fee').value);
    const tv=money(document.getElementById('tv-fee').value);
    const bundle=money(document.getElementById('internet-bundle').value);
    const card=money(document.getElementById('internet-card').value);
    const total=Math.max(0,internet+tv-bundle-card);
    document.getElementById('internet-total').textContent=won(total);
    document.getElementById('internet-summary').textContent=`${document.getElementById('internet-speed').value} 기준 단순 예상치입니다. 설치비·장비임대료·프로모션은 포함하지 않았습니다.`;
  });

  fetch('data/catalog.json?v=20260915-1').then(r=>r.json()).then(data=>{
    const el=document.getElementById('catalog-updated');
    if(el&&data?.meta){el.textContent=data.meta.updated_at?`상품 데이터 ${data.meta.updated_at} 기준`:'상품 데이터 업데이트 준비 중'}
  }).catch(()=>{});
})();