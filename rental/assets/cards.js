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
      return '<article class="affiliate-card"><small>'+esc(p.name)+'</small><h3>'+esc(card.name)+'</h3><p class="annual">연회비 '+esc(card.annualFee||'카드사 확인')+'</p>'+(card.promo?'<span class="promo">프로모션 포함 가능 · 발급 전 확인</span>':'')+(tiers?'<div class="card-tiers">'+tiers+'</div>':'')+'<div class="card-max">월 최대 '+won(maxDiscount(card))+' 할인</div></article>';
    }).join('');
  }
  fetch('data/affiliate-cards.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(json=>{
    data=json;active=new URLSearchParams(location.search).get('provider')||json.providers?.[0]?.id||'';
    $('#cards-updated').textContent='정보 확인 '+(json.checkedAt||'')+' · 실제 발급 전 최신 조건 확인';
    $('#cards-notice').textContent=json.notice||'';
    renderCards();
  }).catch(()=>{$('#card-grid').innerHTML='<div class="card-notice"><strong>카드 정보를 잠시 불러오지 못했습니다.</strong><p>카카오톡 상담으로 현재 적용 가능한 제휴카드를 확인해 주세요.</p></div>'});
  $('#card-provider-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-provider]');if(!b||!data)return;active=b.dataset.provider;renderCards();history.replaceState(null,'','cards/?provider='+encodeURIComponent(active));});
})();