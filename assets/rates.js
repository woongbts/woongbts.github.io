(function(){
  const money=n=>Number(String(n||'').replace(/[^0-9.-]/g,''))||0;
  const won=n=>Math.max(0,Math.round(n)).toLocaleString('ko-KR')+'원';
  let catalog=null;

  document.querySelectorAll('.rate-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x===tab));
    document.querySelectorAll('.rate-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===tab.dataset.tab));
  }));

  const discountType=document.getElementById('discount-type');
  const supportFields=document.getElementById('support-fields');
  function syncDiscountMode(){supportFields.classList.toggle('is-hidden',discountType.value==='contract')}
  discountType.addEventListener('change',syncDiscountMode);syncDiscountMode();

  function ensureCatalogInputs(){
    const deviceInput=document.getElementById('device-name');
    if(deviceInput&&!document.getElementById('device-list')){
      const dl=document.createElement('datalist');dl.id='device-list';document.body.appendChild(dl);deviceInput.setAttribute('list','device-list');
    }
    if(!document.getElementById('plan-name')){
      const planFee=document.getElementById('plan-fee');
      const feeLabel=planFee&&planFee.closest('label');
      if(feeLabel){
        const label=document.createElement('label');
        label.innerHTML='가능한 요금제<input id="plan-name" type="text" list="plan-list" placeholder="기종을 선택하면 가능한 요금제를 표시합니다"><datalist id="plan-list"></datalist><small style="display:block;margin-top:6px;color:#71858c;font-size:.72rem;line-height:1.45">제로노트의 ‘가능한 요금제’ 기준으로 반영합니다.</small>';
        feeLabel.parentNode.insertBefore(label,feeLabel);
      }
    }
  }

  function bySourceOrder(a,b){
    const ao=Number(a?.source_order);const bo=Number(b?.source_order);
    if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;
    if(Number.isFinite(ao))return -1;if(Number.isFinite(bo))return 1;
    return String(b?.release_date||'').localeCompare(String(a?.release_date||''));
  }

  function currentDevice(){
    if(!catalog)return null;
    const carrier=document.getElementById('carrier').value;
    const name=document.getElementById('device-name').value.trim();
    return (catalog.devices||[]).find(d=>d.carrier===carrier&&(d.name===name||d.model===name))||null;
  }

  function syncCatalogChoices(){
    if(!catalog)return;
    ensureCatalogInputs();
    const carrier=document.getElementById('carrier').value;
    const joinType=document.getElementById('join-type').value;
    const deviceInput=document.getElementById('device-name');
    const deviceList=document.getElementById('device-list');
    const planList=document.getElementById('plan-list');
    const planName=document.getElementById('plan-name');

    const devices=(catalog.devices||[]).filter(d=>d.carrier===carrier).sort(bySourceOrder);
    if(deviceList){
      deviceList.innerHTML='';
      devices.forEach(d=>{const o=document.createElement('option');o.value=d.name;o.label=d.model?`${d.name} · ${d.model}`:d.name;deviceList.appendChild(o)});
    }

    const selected=currentDevice();
    if(selected){
      if(selected.retail_price!=null)document.getElementById('device-price').value=selected.retail_price;
      const support=selected.support&&selected.support[joinType];
      if(support){
        if(support.public!=null)document.getElementById('public-support').value=support.public;
        if(support.extra!=null)document.getElementById('extra-support').value=support.extra;
      }
    }

    const selectedId=selected?.id||null;
    const plans=(catalog.plans||[]).filter(p=>{
      if(p.carrier!==carrier)return false;
      const joins=Array.isArray(p.eligible_join_types)?p.eligible_join_types:[];
      if(joins.length&&!joins.includes(joinType))return false;
      const eligible=Array.isArray(p.eligible_devices)?p.eligible_devices:['*'];
      if(selectedId&&!eligible.includes('*')&&!eligible.includes(selectedId))return false;
      return true;
    }).sort(bySourceOrder);

    if(planList){
      planList.innerHTML='';
      plans.forEach(p=>{const o=document.createElement('option');o.value=p.name;o.label=p.monthly_fee!=null?`${p.name} · ${won(p.monthly_fee)}`:p.name;planList.appendChild(o)});
    }

    if(planName){
      const chosen=plans.find(p=>p.name===planName.value.trim());
      if(chosen&&chosen.monthly_fee!=null)document.getElementById('plan-fee').value=chosen.monthly_fee;
    }
  }

  function bindCatalogEvents(){
    ['carrier','join-type','device-name'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.addEventListener(id==='device-name'?'input':'change',syncCatalogChoices);
    });
    const planName=document.getElementById('plan-name');
    if(planName)planName.addEventListener('input',()=>{
      if(!catalog)return;
      const carrier=document.getElementById('carrier').value;
      const p=(catalog.plans||[]).find(x=>x.carrier===carrier&&x.name===planName.value.trim());
      if(p&&p.monthly_fee!=null)document.getElementById('plan-fee').value=p.monthly_fee;
    });
  }

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
    const planName=document.getElementById('plan-name')?.value.trim();
    const label=mode==='contract'?'선택약정 25% 단순 반영':'공시지원금 반영';
    document.getElementById('calc-summary').textContent=`${carrier} · ${device}${planName?' · '+planName:''} · ${type} · ${label} 기준의 단순 예상치입니다.`;
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

  ensureCatalogInputs();
  fetch('data/catalog.json?v=20260915-2').then(r=>r.json()).then(data=>{
    catalog=data;
    const el=document.getElementById('catalog-updated');
    if(el&&data?.meta){el.textContent=data.meta.updated_at?`상품 데이터 ${data.meta.updated_at} 기준`:'제로노트 기준 상품 데이터 반영 준비 중'}
    syncCatalogChoices();bindCatalogEvents();
  }).catch(()=>{});
})();
