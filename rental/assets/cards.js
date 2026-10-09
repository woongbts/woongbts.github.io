(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const won=n=>Number(n).toLocaleString('ko-KR')+'원';
  let data=null,active='';
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function maxDiscount(card){return card.maxDiscount||Math.max(0,...(card.tiers||[]).map(x=>Number(x.discount)||0))}
  function renderTabs(){
    $('#card-provider-tabs').innerHTML=(data.providers||[]).map((p,i)=>'<button type="button" data-provider="'+esc(p.id)+'" class="'+((active||data.providers[0]?.id)===p.id?'active':'')+'">'+esc(p.name)+'</button>').join('');
  }
  function renderCards(){
    const p=(data.providers||[]).find(x=>x.id===active)||data.providers?.[0];
    if(!p){$('#card-grid').innerHTML='<p>제휴카드 정보를 준비 중입니다.</p>';return}
    active=p.id;renderTabs();
    $('#card-grid').innerHTML=(p.cards||[]).map(card=>{
      const tiers=(card.tiers||[]).map(t=>'<div class="card-tier"><span>전월 '+Math.round(t.spend/10000).toLocaleString('ko-KR')+'만원 이상</span><strong>'+won(t.discount)+' 할인</strong></div>').join('');
      const promo=card.promo?.tiers?.length?'<details class="card-detail promo-detail"><summary>'+esc(card.promo.title||'신규발급 프로모션')+'</summary><p>'+esc([card.promo.period,card.promo.duration].filter(Boolean).join(' · '))+'</p>'+(card.promo.eligibility?'<dl><dt>대상</dt><dd>'+esc(card.promo.eligibility)+'</dd></dl>':'')+(card.promo.activation?'<dl><dt>등록</dt><dd>'+esc(card.promo.activation)+'</dd></dl>':'')+'<div class="card-tiers">'+card.promo.tiers.map(t=>'<div class="card-tier"><span>전월 '+Math.round(t.spend/10000).toLocaleString('ko-KR')+'만원 이상</span><strong>'+won(t.discount)+' 할인</strong></div>').join('')+'</div></details>':'';
      const notes=[card.billingType?'<dl><dt>할인방식</dt><dd>'+esc(card.billingType)+'</dd></dl>':'',card.autopayRequired?'<dl><dt>필수</dt><dd>렌탈/구독요금 카드 자동납부 등록</dd></dl>':'',card.exclusions?'<dl><dt>실적제외</dt><dd>'+esc(card.exclusions)+'</dd></dl>':'',card.bonus?'<dl><dt>추가혜택</dt><dd>'+esc(card.bonus)+'</dd></dl>':''].join('');
      const cautions=(card.cautions||[]).length?'<ul>'+card.cautions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'';
      return '<article class="affiliate-card"><small>'+esc(p.name)+(card.issuer?' · '+esc(card.issuer):'')+'</small><h3>'+esc(card.name)+'</h3><p class="annual">연회비 '+esc(card.annualFee||'카드사 확인')+(card.applyContact?' · 문의 '+esc(card.applyContact):'')+'</p><div class="card-tiers">'+tiers+'</div><div class="card-max"><span class="card-max-label">기본 월 최대</span><strong class="card-max-amount">'+won(maxDiscount(card))+'</strong><span class="card-max-unit">할인</span></div>'+promo+'<details class="card-detail"><summary>발급·실적·유의사항</summary>'+notes+cautions+'<p class="card-verified">정보 확인 '+esc(card.verifiedAt||data.checkedAt||'최신 확인 필요')+'</p></details></article>';
    }).join('');
  }
  fetch('data/affiliate-cards.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(json=>{
    data=json;active=new URLSearchParams(location.search).get('provider')||json.providers?.[0]?.id||'';
    $('#cards-updated').textContent='정보 확인 '+(json.checkedAt||'')+' · 실제 발급 전 최신 조건 확인';
    $('#cards-notice').textContent=json.notice||'';
    renderCards();
  }).catch(()=>{$('#card-grid').innerHTML='<div class="card-notice"><strong>카드 정보를 잠시 불러오지 못했습니다.</strong><p>카카오톡 상담으로 현재 적용 가능한 제휴카드를 확인해 주세요.</p></div>'});
  $('#card-provider-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-provider]');if(!b||!data)return;active=b.dataset.provider;renderCards();history.replaceState(null,'','cards/?provider='+encodeURIComponent(active));});
  $('#card-compare-jump')?.addEventListener('click',()=>{
    const target=$('#affiliate-cards');
    if(!target)return;
    target.scrollIntoView({behavior:'smooth',block:'start'});
    history.replaceState(null,'',location.pathname+location.search+'#affiliate-cards');
  });
})();