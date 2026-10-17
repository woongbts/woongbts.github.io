(() => {
  'use strict';
  const won = n => Math.round(n).toLocaleString('ko-KR')+'원';
  function estimate(card, tier, quote, options={}) {
    const unavailable = reason => ({available:false, reason});
    if(!card || !tier) return unavailable('카드와 전월실적 구간을 선택해 주세요.');
    if(card.category!=='POST') return unavailable('단말기 카드 할부가 필요한 상품입니다. 아래 할부금액·기간·수수료 조건을 확인해 주세요.');
    if(!quote?.known || !Number.isFinite(quote.monthly) || !Number.isFinite(quote.service)) return unavailable('기종·요금제를 선택하고 월 납부액 계산을 완료해 주세요.');
    if(!options.confirmed) return unavailable('아래 카드별 조건을 확인하고 조건 충족 여부를 선택해 주세요.');
    if(!tier.verified || card.calculation==='details') return unavailable('이 카드는 별도 조건이 있어 원문 혜택을 먼저 확인해 주세요.');
    const month=Number(options.month||1);
    if(!Number.isInteger(month)||month<1||month>120) return unavailable('할인 적용 회차는 1~120회로 입력해 주세요.');
    const today=options.today||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
    if(tier.promotion){
      if(!card.promotion || !card.promotionDeadline || today>card.promotionDeadline || today.slice(0,7)!==card.checkedAt.slice(0,7)) return unavailable('이번 달 신규발급 프로모션 확인 전입니다. 기본 혜택 구간을 선택해 주세요.');
      if(!card.promotionMonths) return unavailable('프로모션 제공기간을 원문에서 확인해 주세요. 할인액을 확정 계산하지 않습니다.');
      if(month>card.promotionMonths) return unavailable('선택한 프로모션의 제공기간이 지난 회차입니다. 기본 혜택을 다시 선택해 주세요.');
    } else if(card.basicMonths && month>card.basicMonths && card.calculation!=='family-percent'){
      return unavailable('첫 기본 할인기간 이후에는 조건이 달라집니다. 아래 원문에서 후속 혜택을 확인해 주세요.');
    }
    const service=Math.max(0,quote.service);
    let discount=Number(tier.amount)||0;
    if(card.calculation==='family-percent'){
      const rate=month<=24?.25:.15;
      const cap=tier.minSpend>=700000?25000:17000;
      discount=Math.min(Math.floor(service*rate),cap);
      if(tier.promotion){
        if(service<68000) return unavailable('이 프로모션은 통신요금 68,000원 이상 조건입니다. 기본 구간으로 비교해 주세요.');
        discount=Math.min(discount+7000,tier.amount);
      }
    } else if(card.calculation==='kbank-percent'){
      const spend=tier.minSpend;
      const rate=spend>=1000000?.2:spend>=500000?.1:.05;
      if(service<(spend>=1000000?40000:100000)) return unavailable('해당 구간의 최소 통신요금 조건을 충족하지 않습니다.');
      discount=Math.min(Math.floor(service*rate),tier.amount);
    } else if(card.calculation==='ibk-percent') discount=Math.min(Math.floor(service*.05),50000);
    if(card.id==='74'&&service<10000) return unavailable('이 카드는 통신료 10,000원 이상 조건입니다.');
    discount=Math.max(0,Math.min(discount,service,quote.monthly));
    return {available:true, discount, before:quote.monthly, after:Math.max(0,quote.monthly-discount)};
  }
  if(typeof module!=='undefined'&&module.exports) module.exports={estimate};
  if(typeof document==='undefined') return;
  const $=id=>document.getElementById(id);
  const section=$('mobile-affiliate-cards');
  if(!section) return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:''}catch{return ''}};
  let payload=null,carrier='',context=null,selected='',tierId='',result=null,restored=false;
  const type=$('mobile-card-type'),select=$('mobile-card-select'),tierSelect=$('mobile-card-tier');
  const month=$('mobile-card-month'),confirmed=$('mobile-card-confirmed');
  const selectedCard=()=>payload?.cards.find(c=>c.id===selected&&c.carrier===carrier)||null;
  const selectedTier=()=>selectedCard()?.tiers.find(t=>t.id===tierId)||null;
  const quote=()=>document.documentElement.dataset.quoteApi==='ready'&&$('monthly-total')?.textContent!=='—'?window.WoongbiQuoteApi?.getCurrent?.()||null:null;
  function setOptions(node,first,rows){node.replaceChildren(new Option(first,''),...rows.map(([name,value])=>new Option(name,value)))}
  function resetConditions(){tierId='';confirmed.checked=false;month.value='1'}
  function updateOptions(){
    const cards=(payload?.cards||[]).filter(c=>c.carrier===carrier&&c.category===type.value);
    setOptions(select,'카드 미적용 · 기본 견적 유지',cards.map(c=>[c.name,c.id]));
    select.value=cards.some(c=>c.id===selected)?selected:'';selected=select.value;
    $('mobile-card-count').textContent=payload?`${carrier} ${cards.length}개 · 제로노트 확인 ${payload.checkedAt}`:'카드 정보를 불러오는 중입니다.';
    renderCard();
  }
  function renderCard(){
    const card=selectedCard();$('mobile-card-detail').hidden=!card;
    if(!card){result=null;$('mobile-card-result').hidden=true;return}
    const artwork=$('mobile-card-image');artwork.src=card.image;artwork.alt=card.name+' 카드 이미지';
    $('mobile-card-name').textContent=card.name;
    $('mobile-card-fee').textContent=`연회비 국내 ${card.annualDomestic===null?'원문 참고':won(card.annualDomestic)} / 해외 ${card.annualInternational===null?'원문 참고':won(card.annualInternational)}`;
    $('mobile-card-kind').textContent=card.category==='PRE'?'단말기 카드 할부형':'통신요금 청구할인·캐시백형';
    $('mobile-card-benefit').textContent=card.benefit;
    $('mobile-card-conditions').textContent=card.conditions||'아래 제로노트 및 카드사 안내를 확인해 주세요.';
    $('mobile-card-promotion').textContent=card.promotion||'현재 별도 프로모션 안내가 없습니다.';
    const issue=safeUrl(card.issueUrl),link=$('mobile-card-issuer');link.hidden=!issue;if(issue)link.href=issue;
    $('mobile-card-source').href='https://www.xeronote.co.kr/consult/mobile.php';
    $('mobile-card-installments').textContent=card.category==='PRE'?`최소 카드 할부금액 ${card.minFinancing===null?'원문 참고':won(card.minFinancing)} · `+card.installments.map(d=>`${d.months}개월 / 연 ${d.interest}%`).join(' · '):'통신요금 자동납부 및 카드별 전월실적·이용조건 기준';
    const tiers=card.tiers.filter(t=>t.verified&&t.minSpend!==null);
    setOptions(tierSelect,'전월실적·혜택 구간을 선택하세요',tiers.map(t=>[`${t.label} · ${card.calculation.includes('percent')?'월 최대 ':''}${won(t.amount)}${t.promotion?' (조건 충족 시)':''}`,t.id]));
    tierSelect.value=tiers.some(t=>t.id===tierId)?tierId:'';tierId=tierSelect.value;
    $('mobile-card-control').hidden=card.category!=='POST'||!tiers.length||card.calculation==='details';
    $('mobile-card-light-note').hidden=card.category==='POST';
    $('mobile-card-tier-list').innerHTML=tiers.map(t=>`<div><span>${esc(t.label)}</span><strong>월 ${card.calculation.includes('percent')?'최대 ':''}${won(t.amount)}</strong></div>`).join('');
    renderResult();
  }
  function renderResult(){
    const card=selectedCard();if(!card)return;
    result=estimate(card,selectedTier(),quote(),{month:Number(month.value),confirmed:confirmed.checked});
    const box=$('mobile-card-result');box.hidden=false;
    $('mobile-card-result-status').textContent=result.available?'선택한 카드 조건을 충족한 경우의 예상 월 부담입니다.':result.reason;
    $('mobile-card-before').textContent=quote()?.known?won(quote().monthly):'—';
    $('mobile-card-discount').textContent=result.available?'−'+won(result.discount):'—';
    $('mobile-card-after').textContent=result.available?won(result.after):'—';
    $('mobile-card-amounts').hidden=card.category!=='POST';
    // Keep the core quote explicitly before the optional card scenario.
    syncUrl();
  }
  function appendUrl(url){
    for(const key of ['ccard','ctier','cmonth','celigible'])url.searchParams.delete(key);
    if(selectedCard()){
      url.searchParams.set('ccard',selected);if(tierId)url.searchParams.set('ctier',tierId);
      url.searchParams.set('cmonth',month.value||'1');if(confirmed.checked)url.searchParams.set('celigible','1');
    }
    return url;
  }
  function syncUrl(){
    if(!restored)return;
    const url=appendUrl(new URL(location.href));history.replaceState(null,'',url.toString());
  }
  function quoteLines(){
    const card=selectedCard();if(!card)return [];
    const lines=[`제휴카드 비교: ${card.name} (${card.category==='POST'?'청구할인/캐시백':'단말 카드 할부형'})`];
    const tier=selectedTier();if(tier)lines.push(`카드 전월실적·혜택: ${tier.label} / 할인 ${month.value}회차`);
    if(result?.available)lines.push(`카드 예상 할인/캐시백: 월 ${won(result.discount)}`,`카드 혜택 반영 후 예상 월 부담: ${won(result.after)} (조건 충족 가정, 연회비 별도)`);
    else lines.push('카드 혜택은 별도 조건 확인 후 적용되며 기본 월 납부액에는 합산하지 않았습니다.');
    return lines;
  }
  window.WoongbiMobileCards={estimate,appendUrl,quoteLines};
  function updateContext(){
    const next=$('carrier')?.value||'';
    const signature=[$('device-select')?.value,$('plan-select')?.value,next].join('|');
    if(context!==null&&signature!==context){confirmed.checked=false;result=null}
    context=signature;
    if(next!==carrier){carrier=next;selected='';resetConditions();updateOptions()}
    else renderResult();
  }
  type.addEventListener('change',()=>{selected='';resetConditions();updateOptions();syncUrl()});
  select.addEventListener('change',()=>{selected=select.value;resetConditions();renderCard();syncUrl()});
  tierSelect.addEventListener('change',()=>{tierId=tierSelect.value;confirmed.checked=false;renderResult()});
  month.addEventListener('input',renderResult);confirmed.addEventListener('change',renderResult);
  ['carrier','join-type','device-select','plan-select','discount-method','installment-months','welfare-type'].forEach(id=>$(id)?.addEventListener('change',()=>{updateContext();syncUrl()}));
  window.addEventListener('woongbi:quote-ready',updateContext);
  window.addEventListener('woongbi:quote-unavailable',()=>{result=null;renderResult()});
  fetch('data/mobile-affiliate-cards.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('cards');return r.json()}).then(data=>{
    if(data.schemaVersion!==1||!Array.isArray(data.cards))throw Error('schema');
    payload=data;carrier=$('carrier').value;
    const params=new URLSearchParams(location.search),card=payload.cards.find(c=>c.id===params.get('ccard')&&c.carrier===carrier);
    if(card){selected=card.id;type.value=card.category;tierId=params.get('ctier')||'';month.value=params.get('cmonth')||'1';confirmed.checked=params.get('celigible')==='1'}
    restored=true;updateOptions();
  }).catch(()=>{$('mobile-card-count').textContent='카드 정보를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.';select.disabled=true});
})();
