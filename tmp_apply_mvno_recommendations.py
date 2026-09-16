from pathlib import Path

html_path=Path('rates.html')
js_path=Path('assets/rates.js')
css_path=Path('assets/rates.css')
html=html_path.read_text(encoding='utf-8')
js=js_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')

old_html='''        <section class="rate-panel" data-panel="mvno">\n          <div class="rate-panel-head"><div><span class="eyebrow">알뜰폰 · 후불</span><h2>통신사와 요금제를 선택</h2></div><span class="updated" id="mvno-updated">데이터 기준 확인 중</span></div>\n          <div class="rate-grid">'''
new_html='''        <section class="rate-panel" data-panel="mvno">\n          <div class="rate-panel-head"><div><span class="eyebrow">알뜰폰 · 후불</span><h2>통신사와 요금제를 선택</h2></div><span class="updated" id="mvno-updated">데이터 기준 확인 중</span></div>\n          <div class="mvno-mode-switch" role="tablist" aria-label="알뜰폰 요금제 보기 방식">\n            <button type="button" class="active" data-mvno-mode="recommend">추천 요금제</button>\n            <button type="button" data-mvno-mode="all">전체 요금제 찾기</button>\n          </div>\n          <section class="mvno-recommend" id="mvno-recommend">\n            <div class="mvno-recommend-head">\n              <div><span class="eyebrow">웅비통신 추천</span><h3>많이 쓰는 7GB대부터 골라봤어요</h3><p>월 부담, 데이터 구성, 통화 조건을 함께 보고 매장에서 안내하기 좋은 요금제를 먼저 보여드립니다.</p></div>\n              <div class="mvno-recommend-points"><span>7GB 중심</span><span>2만원 안팎</span><span>통화 넉넉하게</span></div>\n            </div>\n            <div class="mvno-recommend-list" id="mvno-recommend-list"><p>추천 요금제를 불러오는 중입니다.</p></div>\n            <small class="mvno-recommend-note">표시 월요금은 현재 등록된 특별할인가 기준입니다. 개통 가능 여부와 프로모션은 상담 시점에 최종 확인됩니다.</small>\n            <small class="mvno-recommend-status" id="mvno-recommend-status" aria-live="polite"></small>\n          </section>\n          <div class="rate-grid" id="mvno-all-grid" hidden>'''
if old_html not in html:
    raise SystemExit('MVNO html anchor not found')
html=html.replace(old_html,new_html,1)
html=html.replace('assets/rates.css?v=20260916-17','assets/rates.css?v=20260916-18',1)
html=html.replace('assets/rates.js?v=20260916-30','assets/rates.js?v=20260916-31',1)

js_anchor="  let mvnoPickerQuery='';\n"
js_block="""  let mvnoPickerQuery='';
  let mvnoMode='recommend';
  const MVNO_RECOMMENDED_PLANS=[
    {id:'MMOBILE-2148',badge:'대표 추천',reason:'7GB + 1Mbps · 통화 넉넉하게',description:'월 2만원 안쪽에서 데이터와 통화를 균형 있게 쓰기 좋은 KT망 요금제'},
    {id:'UPLUSE-1623',badge:'LGU+망 추천',reason:'7GB + 1Mbps · 통화·문자 넉넉하게',description:'7GB 소진 뒤에도 1Mbps로 이어서 쓸 수 있어 일상용으로 설명하기 쉬운 구성'},
    {id:'7MOBILE-1684',badge:'SKT망 추천',reason:'7GB + 1Mbps · 통화·문자 넉넉하게',description:'SKT망을 선호하면서 월 2만원 안팎의 7GB 요금제를 찾는 고객에게 적합'},
    {id:'SKYLIFE-2069',badge:'1만원대 추천',reason:'7GB + 1Mbps · 통화 넉넉하게',description:'7GB급을 1만원대에서 찾는 고객에게 먼저 비교해 보기 좋은 KT망 요금제'},
    {id:'MMOBILE-2149',badge:'데이터 더 필요하면',reason:'10GB + 1Mbps · 통화 넉넉하게',description:'7GB가 조금 부족한 고객에게 큰 가격 차이 없이 한 단계 올려 제안하기 좋은 구성'},
    {id:'HELLOUPLUS-2240',badge:'5GB 실속',reason:'5GB + 1Mbps · 통화 넉넉하게',description:'데이터 사용량이 많지 않은 고객에게 월 부담을 낮춰 제안하기 좋은 LGU+망 요금제'}
  ];
  function setMvnoMode(mode){
    mvnoMode=mode==='all'?'all':'recommend';
    document.querySelectorAll('[data-mvno-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mvnoMode===mvnoMode));
    const recommend=$('mvno-recommend'),all=$('mvno-all-grid');
    if(recommend)recommend.hidden=mvnoMode!=='recommend';
    if(all)all.hidden=mvnoMode!=='all';
  }
  function renderMvnoRecommendations(){
    const box=$('mvno-recommend-list');if(!box)return;
    const providerMap=new Map((mvnoData.providers||[]).map(p=>[p.id,p]));
    const planMap=new Map((mvnoData.plans||[]).map(p=>[p.id,p]));
    box.innerHTML='';let shown=0;
    MVNO_RECOMMENDED_PLANS.forEach(item=>{
      const p=planMap.get(item.id);if(!p)return;shown+=1;
      const provider=providerMap.get(p.provider_id),fee=mvnoPlanFee(p),card=document.createElement('article');card.className='mvno-recommend-card';
      const head=document.createElement('div');head.className='mvno-recommend-card-head';
      const badge=document.createElement('span');badge.textContent=item.badge;
      const network=document.createElement('small');network.textContent=[provider?.name||p.provider_id,p.network?`${p.network}망`:null].filter(Boolean).join(' · ');head.append(badge,network);
      const name=document.createElement('h4');name.textContent=p.name||'추천 요금제';
      const price=document.createElement('div');price.className='mvno-recommend-price';price.innerHTML=`<span>월 기본료</span><strong>${hasAmount(fee)?won(fee):'매장 확인'}</strong>`;
      const reason=document.createElement('b');reason.className='mvno-recommend-reason';reason.textContent=item.reason;
      const desc=document.createElement('p');desc.textContent=item.description;
      const tags=document.createElement('div');tags.className='mvno-recommend-tags';
      [[p.data,'데이터'],[p.voice,'통화'],[p.sms,'문자']].forEach(([value,label])=>{if(!value)return;const chip=document.createElement('span');chip.textContent=`${label} ${value}`;tags.appendChild(chip)});
      const actions=document.createElement('div');actions.className='mvno-recommend-actions';
      const detail=document.createElement('button');detail.type='button';detail.dataset.mvnoRecommendDetail=p.id;detail.textContent='자세히 보기';
      const consult=document.createElement('button');consult.type='button';consult.className='primary';consult.dataset.mvnoRecommendConsult=p.id;consult.textContent='이 요금제 상담';actions.append(detail,consult);
      card.append(head,name,price,reason,desc,tags,actions);box.appendChild(card);
    });
    if(!shown)box.innerHTML='<p>추천 요금제를 불러오지 못했습니다. 전체 요금제에서 확인해 주세요.</p>';
  }
  function applyMvnoRecommendedPlan(planId){
    const p=(mvnoData.plans||[]).find(x=>x.id===planId);if(!p)return false;
    Object.assign(mvnoFilters,{network:'all',price:'all',data:'all',voice:'all'});if(mvnoSort)mvnoSort.value='source';clearMvnoPickerQuery();updateMvnoFilterButtons();
    mvnoProvider.value=p.provider_id;fillMvnoPlans();mvnoPlan.value=p.id;syncMvno();updateMvnoPickerSummary();return true;
  }
"""
if js_anchor not in js:
    raise SystemExit('MVNO JS anchor not found')
js=js.replace(js_anchor,js_block,1)

event_anchor="""  $('consult-mvno-quote')?.addEventListener('click',()=>consultWithCustomerText(mvnoQuoteText(),'mvno-quote-status'));

  // 선불폰
"""
event_block="""  $('consult-mvno-quote')?.addEventListener('click',()=>consultWithCustomerText(mvnoQuoteText(),'mvno-quote-status'));
  document.querySelectorAll('[data-mvno-mode]').forEach(btn=>btn.addEventListener('click',()=>setMvnoMode(btn.dataset.mvnoMode)));
  $('mvno-recommend-list')?.addEventListener('click',e=>{
    const detail=e.target.closest('[data-mvno-recommend-detail]'),consult=e.target.closest('[data-mvno-recommend-consult]');
    const planId=detail?.dataset.mvnoRecommendDetail||consult?.dataset.mvnoRecommendConsult;if(!planId)return;
    if(!applyMvnoRecommendedPlan(planId))return;
    if(detail){setMvnoMode('all');setTimeout(()=>$('mvno-all-grid')?.scrollIntoView({behavior:'smooth',block:'start'}),20);return}
    consultWithCustomerText(mvnoQuoteText(),'mvno-recommend-status');
  });

  // 선불폰
"""
if event_anchor not in js:
    raise SystemExit('MVNO event anchor not found')
js=js.replace(event_anchor,event_block,1)

load_anchor="fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderWiredComparison();"
load_replace="fillDevices();fillMvnoProviders();renderMvnoRecommendations();setMvnoMode('recommend');fillPrepaidProviders();fillInternetProviders();renderWiredComparison();"
if load_anchor not in js:
    raise SystemExit('MVNO load anchor not found')
js=js.replace(load_anchor,load_replace,1)

css_add=r'''

/* MVNO curated recommendations 2026-09-16 */
.mvno-mode-switch{display:flex;gap:8px;margin:0 0 14px}.mvno-mode-switch button{flex:1;min-height:44px;border:1px solid #cddcdf;background:#fff;color:#476068;border-radius:12px;font-weight:900;cursor:pointer}.mvno-mode-switch button.active{background:var(--navy);border-color:var(--navy);color:#fff}.mvno-recommend{margin-bottom:16px;padding:22px;background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 8px 24px rgba(16,60,82,.05)}.mvno-recommend[hidden]{display:none!important}.mvno-recommend-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px}.mvno-recommend-head h3{margin:8px 0 5px;font-size:1.35rem;letter-spacing:-.035em}.mvno-recommend-head p{margin:0;max-width:650px;color:var(--muted);font-size:.79rem;line-height:1.6}.mvno-recommend-points{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.mvno-recommend-points span{padding:6px 9px;border-radius:999px;background:#eef6f5;color:#356863;font-size:.68rem;font-weight:900}.mvno-recommend-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.mvno-recommend-list>p{grid-column:1/-1;margin:0;padding:14px;background:#f4f8f9;border-radius:12px;color:var(--muted);font-size:.76rem}.mvno-recommend-card{display:flex;flex-direction:column;min-width:0;padding:16px;border:1px solid #d5e3e5;border-radius:16px;background:linear-gradient(180deg,#fff 0%,#f8fbfb 100%)}.mvno-recommend-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.mvno-recommend-card-head>span{padding:5px 8px;border-radius:999px;background:#e4f2ef;color:#0f665f;font-size:.66rem;font-weight:900;white-space:nowrap}.mvno-recommend-card-head>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:.63rem}.mvno-recommend-card h4{margin:11px 0 7px;font-size:.96rem;line-height:1.4;letter-spacing:-.025em}.mvno-recommend-price{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:12px;border-radius:13px;background:#eef8f6}.mvno-recommend-price span{color:#628078;font-size:.66rem;font-weight:800}.mvno-recommend-price strong{color:var(--teal);font-size:1.45rem;line-height:1;letter-spacing:-.045em}.mvno-recommend-reason{margin-top:10px;font-size:.75rem;color:#315c5a}.mvno-recommend-card>p{margin:6px 0 10px;color:#61777e;font-size:.71rem;line-height:1.5}.mvno-recommend-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:auto}.mvno-recommend-tags span{padding:5px 7px;border:1px solid #d9e6e7;border-radius:999px;background:#fff;color:#5c7279;font-size:.62rem}.mvno-recommend-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.mvno-recommend-actions button{min-height:39px;border:1px solid #cbdadd;border-radius:10px;background:#fff;color:var(--navy);font-weight:900;cursor:pointer}.mvno-recommend-actions button.primary{background:var(--navy);border-color:var(--navy);color:#fff}.mvno-recommend-note,.mvno-recommend-status{display:block;margin-top:12px;color:#7a8d93;font-size:.67rem;line-height:1.5}.mvno-recommend-status{color:var(--teal);font-weight:800;min-height:1em}
@media(max-width:900px){.mvno-recommend-list{grid-template-columns:1fr 1fr}.mvno-recommend-head{align-items:flex-start;flex-direction:column}.mvno-recommend-points{justify-content:flex-start}}
@media(max-width:760px){.mvno-mode-switch{display:grid;grid-template-columns:1fr 1fr}.mvno-recommend{padding:17px;border-radius:17px}.mvno-recommend-list{grid-template-columns:1fr}.mvno-recommend-card{padding:15px}.mvno-recommend-price strong{font-size:1.35rem}}
'''
if '/* MVNO curated recommendations 2026-09-16 */' not in css:
    css += css_add

html_path.write_text(html,encoding='utf-8')
js_path.write_text(js,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
print('patched rates.html, rates.js, rates.css')
