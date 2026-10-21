(() => {
  'use strict';
  const section = document.getElementById('monthly-benefits');
  const grid = document.getElementById('monthly-benefits-grid');
  const period = document.getElementById('monthly-benefits-period');
  const status = document.getElementById('monthly-benefits-status');
  if (!section || !grid) return;

  // Only recommend products and option combinations registered in the public catalog.
  const PICKS = [
    {id:'clover-1702',option:'self-option-60',label:'1만원대 실속형',subtitle:'부담 적게 시작하는 정수 전용'},
    {id:'chp-7220n',option:'self-60',label:'인기 냉온정수기',subtitle:'월요금과 사은품을 함께 비교'},
    {id:'clover-2242',option:'visit-option-60',label:'프리미엄 얼음정수기',subtitle:'얼음 기능과 방문관리 중심'}
  ];
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'
  }).formatToParts(now);
  const year = dateParts.find(p=>p.type==='year')?.value || String(now.getFullYear());
  const month = dateParts.find(p=>p.type==='month')?.value || String(now.getMonth()+1).padStart(2,'0');
  const currentMonth = year+'-'+month;
  const won = amount => Number(amount).toLocaleString('ko-KR')+'원';
  if(period) period.textContent = year+'년 '+Number(month)+'월 등록 혜택';
  
  function node(tag, className, value) {
    const n=document.createElement(tag);
    if(className)n.className=className;
    if(value != null)n.textContent=String(value);
    return n;
  }
  function detailsUrl(product, option) {
    if(!product?.page || !option)return null;
    try {
      const u = new URL(product.page,location.href);
      if(u.origin!==location.origin || !u.pathname.startsWith('/rental/'))return null;
      u.searchParams.set('mgmt',option.management);
      u.searchParams.set('term',String(option.term));
      u.searchParams.set('src','monthly-benefits');
      return u.toString();
    }catch{return null;}
  }
  function makeCard(product, option, pick) {
    const link=detailsUrl(product,option);
    if(!link)return null;
    const card=node('article','monthly-benefit-card');
    const top=node('div','monthly-benefit-card-top');
    top.append(node('span','monthly-benefit-category',pick.label),
      node('span','monthly-benefit-brand',product.brand||'웅비렌탈'));
    card.append(top);

    const media=node('div','monthly-benefit-media');
    const fallback=node('span','monthly-benefit-image-fallback','상품 이미지 준비 중');
    media.append(fallback);
    if(product.image && /^assets\/product-images\/[^/?#]+\.(?:webp|png|jpg|jpeg)$/i.test(product.image)){
      const img=document.createElement('img');
      img.src=product.image;
      img.alt=product.name+' 상품 이미지';
      img.loading='lazy';
      img.decoding='async';
      img.addEventListener('load',()=>fallback.remove(),{once:true});
      img.addEventListener('error',()=>img.remove(),{once:true});
      media.append(img);
    }
    card.append(media);

    const title=node('h3','monthly-benefit-name',product.name);
    const model=node('p','monthly-benefit-model',product.model||'');
    const sub=node('p','monthly-benefit-subtitle',pick.subtitle);
    const condition=node('p','monthly-benefit-condition',
      (option.managementLabel||option.care||'관리조건 확인')+' · '+option.term+'개월');
    card.append(title,model,sub,condition);
    const price=node('div','monthly-benefit-pricing');
    const monthly=node('div','monthly-benefit-price');
    monthly.append(node('span','','월 렌탈료'),node('strong','',won(option.monthly)));
    price.append(monthly);
    const gift=Number(option.gift);
    if(option.gift!=null && Number.isFinite(gift) && gift>0) {
      const giftBox=node('div','monthly-benefit-gift');
      giftBox.append(node('span','','예상 사은품'),
        node('strong','',won(Math.floor(gift/1000)*1000)));
      price.append(giftBox);
    } else {
      const giftBox=node('div','monthly-benefit-gift');
      giftBox.append(node('span','','사은품'),node('strong','','상담 확인'));
      price.append(giftBox);
    }
    card.append(price);
    const action=node('a','monthly-benefit-action','이 조건 자세히 보기 →');
    action.href=link;
    action.addEventListener('click',()=>{
      try{window.woongbiTrackConversion?.('rental_monthly_benefit_click',
        {product_id:product.id,management:option.management,term:option.term})}catch{}
    });
    card.append(action);
    return card;
  }
  fetch('data/featured.json?v=20261021-monthly-benefits1',{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw Error('catalog unavailable');return response.json();})
    .then(data=>{
      const list=Array.isArray(data.products)?data.products:[];
      const cards=[];
      for(const pick of PICKS){
        const product=list.find(x=>x.id===pick.id && x.availability!=='inactive');
        const option=product?.options?.find(x=>x.key===pick.option);
        // Do not show last month's incentives as if they were current.
        if(!option || option.giftPolicyMonth!==currentMonth ||
            !Number.isFinite(Number(option.monthly)) || Number(option.monthly)<=0)continue;
        const card=makeCard(product,option,pick);
        if(card)cards.push(card);
      }
      grid.replaceChildren();
      if(!cards.length){
        section.hidden=true;
        return;
      }
      grid.append(...cards);
      if(status)status.textContent='표시 금액과 사은품은 '+year+'년 '+Number(month)+'월 등록 조건 기준입니다. 관리방식·약정·제휴카드와 최종 접수 조건은 상담 시 확인합니다.';
    })
    .catch(()=>{
      section.hidden=true;
    });
})();