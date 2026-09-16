from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 target, found {count}")
    return text.replace(old, new, 1)


# rates.html
p = Path('rates.html')
s = p.read_text(encoding='utf-8')
old_mode = '''<div class="mobile-mode-switch" role="tablist" aria-label="휴대폰 견적 방식">
  <button type="button" class="active" data-mobile-mode="direct">직접 계산하기</button>
  <button type="button" data-mobile-mode="quick">간편 추천받기</button>
</div>
<section class="quick-recommend" id="quick-recommend" hidden>'''
new_mode = '''<div class="mobile-mode-switch" role="tablist" aria-label="휴대폰 견적 방식">
  <button type="button" class="active" data-mobile-mode="purpose">용도별 추천</button>
  <button type="button" data-mobile-mode="direct">직접 계산</button>
  <button type="button" data-mobile-mode="quick">간편 추천</button>
</div>
<section class="purpose-recommend" id="purpose-recommend">
  <div class="purpose-head">
    <div><span class="eyebrow">웅비통신 추천관</span><h3>누구를 위한 휴대폰인가요?</h3><p>등록된 출고가·요금제·공시지원금을 이용해 24개월 총 예상비용을 비교합니다. 확인되지 않은 금액은 임의로 계산하지 않습니다.</p></div>
  </div>
  <div class="purpose-tabs" role="tablist" aria-label="휴대폰 용도 선택">
    <button type="button" class="active" data-purpose-category="senior"><strong>효도폰</strong><small>부모님께 부담 적게</small></button>
    <button type="button" data-purpose-category="kids"><strong>키즈폰</strong><small>아이 첫 휴대폰</small></button>
    <button type="button" data-purpose-category="value"><strong>가성비폰</strong><small>가격·성능 균형</small></button>
    <button type="button" data-purpose-category="premium"><strong>프리미엄폰</strong><small>최신·고성능</small></button>
  </div>
  <div class="purpose-controls">
    <label>통신사<select id="purpose-carrier"><option value="all">전체 통신사</option><option>SKT</option><option>KT</option><option>LGU+</option></select></label>
    <label>가입유형<select id="purpose-join"><option>기기변경</option><option>번호이동</option><option>신규가입</option></select></label>
    <label class="purpose-pension" id="purpose-pension-wrap"><input type="checkbox" id="purpose-pension" checked><span><strong>기초연금 수급자 할인 적용</strong><small>실제 기초연금 수급자에게만 적용되는 예시입니다.</small></span></label>
  </div>
  <div class="purpose-category-note" id="purpose-category-note">출고가가 낮은 기종과 시니어 요금제를 우선 살펴보고, 기초연금 수급자 할인을 적용해 공시지원금과 선택약정 중 24개월 총 부담이 낮은 조건을 보여드립니다.</div>
  <div class="purpose-results" id="purpose-results"><p>추천 조건을 불러오는 중입니다.</p></div>
  <div class="purpose-footnote">※ 실제 가입 가능 여부, 연령·복지 자격, 공시지원금 및 프로모션은 개통 시점에 최종 확인됩니다.</div>
</section>
<section class="quick-recommend" id="quick-recommend" hidden>'''
s = replace_once(s, old_mode, new_mode, 'mobile mode section')
s = replace_once(s, '<div class="rate-grid" id="direct-mobile-grid">', '<div class="rate-grid" id="direct-mobile-grid" hidden>', 'direct grid default hidden')
s = replace_once(s, 'assets/rates.css?v=20260916-13', 'assets/rates.css?v=20260916-14', 'css cache version')
s = replace_once(s, 'assets/rates.js?v=20260916-18', 'assets/rates.js?v=20260916-19', 'js cache version')
p.write_text(s, encoding='utf-8')


# assets/rates.js
p = Path('assets/rates.js')
s = p.read_text(encoding='utf-8')

old_quote_bar = '''  function syncQuoteBar(){
    const bar=$('mobile-quote-bar'),scenario=mobileScenario(discountMethod.value),mobileActive=document.querySelector('[data-panel="mobile"]')?.classList.contains('active');
    if(!bar)return;const show=!!(mobileActive&&scenario?.known);bar.hidden=!show;document.body.classList.toggle('has-mobile-quote-bar',show);
    if(show)$('mobile-quote-bar-total').textContent=won(scenario.monthly);
  }'''
new_quote_bar = '''  function syncQuoteBar(){
    const bar=$('mobile-quote-bar'),scenario=mobileScenario(discountMethod.value),mobileActive=document.querySelector('[data-panel="mobile"]')?.classList.contains('active'),directVisible=!$('direct-mobile-grid')?.hidden;
    if(!bar)return;const show=!!(mobileActive&&directVisible&&scenario?.known);bar.hidden=!show;document.body.classList.toggle('has-mobile-quote-bar',show);
    if(show)$('mobile-quote-bar-total').textContent=won(scenario.monthly);
  }'''
s = replace_once(s, old_quote_bar, new_quote_bar, 'quote bar direct mode guard')

old_mode_js = '''  function setMobileMode(mode){
    const quick=mode==='quick';$('quick-recommend').hidden=!quick;$('direct-mobile-grid').hidden=quick;
    document.querySelectorAll('[data-mobile-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mobileMode===mode));
    if(quick){$('quick-carrier').value=carrier.value;$('quick-join').value=joinType.value}
  }
  function quickPlanMeets(p,need){'''
new_mode_js = '''  let purposeCategory='senior';
  const PURPOSE_COPY={
    senior:'출고가가 낮은 기종과 시니어 요금제를 우선 살펴보고, 기초연금 수급자 할인을 적용해 공시지원금과 선택약정 중 24개월 총 부담이 낮은 조건을 보여드립니다.',
    kids:'출고가가 낮은 기종과 실제 키즈·청소년 요금제를 조합해 공시지원금과 선택약정 중 24개월 총 부담이 낮은 조건을 보여드립니다.',
    value:'출고가와 월 통신요금을 함께 보고, 중저가 기종에서 24개월 총 예상비용이 부담 적은 조합을 보여드립니다.',
    premium:'프리미엄 기종에서 가입 가능한 요금제를 조합해 공시지원금과 선택약정의 24개월 총 예상비용을 비교합니다.'
  };
  function purposeIsLowCostDevice(d){
    const price=Number(d?.retail_price)||0,name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    return price>0&&(price<=650000||/갤럭시\\s*a\\d|galaxy\\s*a\\d|wide|와이드|버디|buddy/.test(name));
  }
  function purposeIsPremiumDevice(d){
    const price=Number(d?.retail_price)||0,name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    return price>=900000||/아이폰|iphone|울트라|ultra|폴드|fold|플립|flip|\\bpro\\b|프로|max|갤럭시\\s*s\\d|galaxy\\s*s\\d/.test(name);
  }
  function purposeDevicePool(category,carrierValue){
    let rows=(catalog?.devices||[]).filter(d=>(carrierValue==='all'||d.carrier===carrierValue)&&hasAmount(d.retail_price)&&Number(d.retail_price)>0);
    if(category==='senior'||category==='kids')rows=rows.filter(purposeIsLowCostDevice);
    else if(category==='value')rows=rows.filter(d=>Number(d.retail_price)<=1000000&&!purposeIsPremiumDevice(d));
    else if(category==='premium')rows=rows.filter(purposeIsPremiumDevice);
    return rows.sort((a,b)=>Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);
  }
  function purposePlanPool(d,category,joinLabel){
    const ids=devicePlanIds(d,joinLabel);if(!ids.length)return[];
    let rows=(catalog?.mobile_plans||[]).filter(p=>p.carrier===d.carrier&&ids.includes(p.id)&&hasAmount(p.monthly_fee));
    if(category==='senior'){
      const senior=rows.filter(p=>planFeatureMatch(p,'senior'));rows=senior.length?senior:rows.filter(p=>Number(p.monthly_fee)<=55000);
    }else if(category==='kids'){
      rows=rows.filter(p=>planFeatureMatch(p,'kids'));
    }else if(category==='value'){
      const value=rows.filter(p=>Number(p.monthly_fee)<=69000);if(value.length)rows=value;
    }else if(category==='premium'){
      const premium=rows.filter(p=>Number(p.monthly_fee)>=50000);if(premium.length)rows=premium;
    }
    return rows.sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee)||byOrder(a,b)).slice(0,40);
  }
  function purposeCandidateForDevice(d,category,joinLabel,usePension){
    const welfare=category==='senior'&&usePension?'basic_pension':'none',plans=purposePlanPool(d,category,joinLabel);let best=null;
    for(const p of plans){
      const support=scenarioForSelection(d,p,joinLabel,'support',24,welfare),contract=scenarioForSelection(d,p,joinLabel,'contract',24,welfare),known=[support,contract].filter(x=>x?.known).sort((a,b)=>a.total24-b.total24);
      if(!known.length)continue;const selected=known[0],row={d,p,best:selected,support,contract,welfare};
      if(!best||row.best.total24<best.best.total24)best=row;
    }
    return best;
  }
  function purposeRecommendations(){
    const carrierValue=$('purpose-carrier')?.value||'all',joinLabel=$('purpose-join')?.value||'기기변경',usePension=!!$('purpose-pension')?.checked,rows=[];
    purposeDevicePool(purposeCategory,carrierValue).forEach(d=>{const row=purposeCandidateForDevice(d,purposeCategory,joinLabel,usePension);if(row)rows.push(row)});
    rows.sort((a,b)=>a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));
    const unique=[],seen=new Set();for(const row of rows){const key=`${row.d.carrier}|${row.d.name}`;if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break}
    return unique;
  }
  function purposeCardLine(label,value,cls=''){
    const line=document.createElement('div');if(cls)line.className=cls;const a=document.createElement('span'),b=document.createElement('b');a.textContent=label;b.textContent=value;line.append(a,b);return line;
  }
  function purposeQuoteText(row){
    if(!row)return '';const method=row.best.method==='support'?'공시지원금':'선택약정 25%',joinLabel=$('purpose-join')?.value||'기기변경',lines=['[웅비통신 용도별 추천 상담]',`용도: ${{senior:'효도폰',kids:'키즈폰',value:'가성비폰',premium:'프리미엄폰'}[purposeCategory]||'휴대폰'}`,`통신사: ${row.d.carrier}`,`가입유형: ${joinLabel}`,`기종: ${row.d.name}`,`요금제: ${row.p.name} / ${won(row.p.monthly_fee)}`,`추천 할인방식: ${method}`,`예상 월 납부액: ${won(row.best.monthly)}`,`24개월 총 예상비용: ${won(row.best.total24)}`];
    if(row.welfare==='basic_pension')lines.push(`기초연금 수급자 할인: -${won(row.best.welfare?.amount||0)}`);
    lines.push('※ 실제 가입 가능 여부·자격·지원금·프로모션은 상담 시점에 최종 확인합니다.');return lines.join('\\n');
  }
  function renderPurposeRecommendations(){
    const box=$('purpose-results'),note=$('purpose-category-note'),pensionWrap=$('purpose-pension-wrap');if(!box)return;if(note)note.textContent=PURPOSE_COPY[purposeCategory]||'';if(pensionWrap)pensionWrap.hidden=purposeCategory!=='senior';
    document.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.purposeCategory===purposeCategory));
    const rows=purposeRecommendations();box.innerHTML='';
    if(!catalog){box.innerHTML='<p>추천 조건을 불러오는 중입니다.</p>';return}
    if(!rows.length){box.innerHTML='<p>현재 등록된 데이터에서 이 조건에 맞는 조합을 찾지 못했습니다. 통신사나 가입유형을 바꾸거나 직접 계산을 이용해 주세요.</p>';return}
    rows.forEach((row,index)=>{
      const card=document.createElement('article');card.className='purpose-card';
      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${$('purpose-join')?.value||'기기변경'}`;rank.textContent=index===0?'현재 조건 낮은 부담':'추천 조합';top.append(badge,rank);
      const name=document.createElement('strong');name.textContent=row.d.name;const plan=document.createElement('em');plan.textContent=row.p.name;
      const total=document.createElement('div');total.className='purpose-card-total';const totalLabel=document.createElement('span'),totalValue=document.createElement('b');totalLabel.textContent='예상 월 납부액';totalValue.textContent=won(row.best.monthly);total.append(totalLabel,totalValue);
      const detail=document.createElement('div');detail.className='purpose-card-detail';detail.append(purposeCardLine('월 기기값 · 이자 포함',won(row.best.inst.monthly)),purposeCardLine('할인 후 통신요금',won(row.best.service)));if(row.welfare==='basic_pension')detail.append(purposeCardLine('기초연금 수급자 할인','-'+won(row.best.welfare?.amount||0),'welfare-line'));
      const compare=document.createElement('div');compare.className='purpose-method-compare';const sText=row.support?.known?won(row.support.monthly):'매장 확인',cText=row.contract?.known?won(row.contract.monthly):'매장 확인';compare.append(purposeCardLine('공시지원 월',sText),purposeCardLine('선택약정 월',cText));
      const best=document.createElement('div');best.className='purpose-best';best.textContent=`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준 · 24개월 총 예상비용 ${won(row.best.total24)}`;
      const actions=document.createElement('div');actions.className='purpose-card-actions';const detailBtn=document.createElement('button'),consultBtn=document.createElement('button');detailBtn.type='button';consultBtn.type='button';detailBtn.textContent='자세히 계산';consultBtn.textContent='이 조건 상담';consultBtn.className='primary';detailBtn.addEventListener('click',()=>applyPurposeResult(row));consultBtn.addEventListener('click',async()=>{const ok=await copyCustomerConsultText(purposeQuoteText(row));if(ok)window.location.href='http://pf.kakao.com/_nWwNT/chat'});actions.append(detailBtn,consultBtn);
      card.append(top,name,plan,total,detail,compare,best,actions);box.appendChild(card);
    });
  }
  function applyPurposeResult(row){
    if(!row)return;deviceBrandFilter=deviceBrandKey(row.d);updateDeviceBrandButtons();carrier.value=row.d.carrier;joinType.value=$('purpose-join')?.value||'기기변경';discountMethod.value=row.best.method;welfareType.value=row.welfare||'none';deviceSearch.value=row.d.name||'';fillDevices();deviceSelect.value=row.d.id;fillPlans();planSelect.value=row.p.id;deviceSearch.value='';fillDevices();deviceSelect.value=row.d.id;fillPlans();planSelect.value=row.p.id;setMobileMode('direct');syncMobile();$('direct-mobile-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function setMobileMode(mode){
    const purpose=mode==='purpose',quick=mode==='quick';$('purpose-recommend').hidden=!purpose;$('quick-recommend').hidden=!quick;$('direct-mobile-grid').hidden=purpose||quick;
    document.querySelectorAll('[data-mobile-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mobileMode===mode));
    if(purpose)renderPurposeRecommendations();if(quick){$('quick-carrier').value=carrier.value;$('quick-join').value=joinType.value}syncQuoteBar();
  }
  function quickPlanMeets(p,need){'''
s = replace_once(s, old_mode_js, new_mode_js, 'purpose recommendation engine')

old_event_block = '''  document.querySelectorAll('[data-mobile-mode]').forEach(btn=>btn.addEventListener('click',()=>setMobileMode(btn.dataset.mobileMode)));
  $('quick-find')?.addEventListener('click',renderQuickRecommendations);'''
new_event_block = '''  document.querySelectorAll('[data-mobile-mode]').forEach(btn=>btn.addEventListener('click',()=>setMobileMode(btn.dataset.mobileMode)));
  document.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.addEventListener('click',()=>{purposeCategory=btn.dataset.purposeCategory||'senior';renderPurposeRecommendations()}));
  ['purpose-carrier','purpose-join','purpose-pension'].forEach(id=>$(id)?.addEventListener('change',renderPurposeRecommendations));
  $('quick-find')?.addEventListener('click',renderQuickRecommendations);'''
s = replace_once(s, old_event_block, new_event_block, 'purpose event listeners')

old_load = '''    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderWiredComparison();renderWiredRecentQuotes();const restoredWired=restoreInternetQuoteFromUrl();renderRecentQuotes();if(!restoredWired)restoreQuoteFromUrl();suspendUrlSync=false;syncMobile();'''
new_load = '''    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderWiredComparison();renderWiredRecentQuotes();renderPurposeRecommendations();const restoredWired=restoreInternetQuoteFromUrl();renderRecentQuotes();const restoredMobile=!restoredWired&&restoreQuoteFromUrl();if(!restoredWired&&!restoredMobile)setMobileMode('purpose');suspendUrlSync=false;syncMobile();'''
s = replace_once(s, old_load, new_load, 'catalog load purpose render')
p.write_text(s, encoding='utf-8')


# assets/rates.css append only once
p = Path('assets/rates.css')
s = p.read_text(encoding='utf-8')
marker = '/* Purpose phone recommendation 2026-09-16 */'
if marker in s:
    raise SystemExit('purpose css marker already exists')
s += '''\n\n/* Purpose phone recommendation 2026-09-16 */
.purpose-recommend{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;margin-bottom:16px;box-shadow:0 8px 24px rgba(16,60,82,.05)}.purpose-recommend[hidden]{display:none!important}.purpose-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:16px}.purpose-head h3{margin:8px 0 6px;font-size:1.3rem;letter-spacing:-.035em}.purpose-head p{margin:0;max-width:760px;color:var(--muted);font-size:.76rem;line-height:1.6}.purpose-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.purpose-tabs button{display:grid;gap:4px;text-align:left;min-height:76px;padding:13px;border:1px solid #d4e1e4;border-radius:14px;background:#f8fbfb;color:var(--ink);font:inherit;cursor:pointer}.purpose-tabs button strong{font-size:.92rem}.purpose-tabs button small{font-size:.67rem;color:var(--muted)}.purpose-tabs button.active{background:var(--navy);border-color:var(--navy);color:#fff}.purpose-tabs button.active small{color:rgba(255,255,255,.72)}.purpose-controls{display:grid;grid-template-columns:180px 180px minmax(260px,1fr);gap:9px;align-items:stretch}.purpose-controls>label:not(.purpose-pension){display:grid;gap:5px;font-size:.72rem;font-weight:900;color:#536d75}.purpose-controls select{width:100%;min-height:46px;border:1px solid #cddcdf;border-radius:11px;background:#fff;padding:8px 10px;color:#183c48;font:inherit}.purpose-pension{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #cfe2df;border-radius:12px;background:#eef8f6;cursor:pointer}.purpose-pension[hidden]{display:none}.purpose-pension input{width:20px;height:20px;accent-color:var(--teal);flex:0 0 auto}.purpose-pension span{display:grid;gap:2px}.purpose-pension strong{font-size:.76rem}.purpose-pension small{font-size:.64rem;color:#5f777c;line-height:1.35}.purpose-category-note{margin-top:10px;padding:11px 12px;border-radius:11px;background:#f2f7f8;color:#527077;font-size:.72rem;line-height:1.55}.purpose-results{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.purpose-results>p{grid-column:1/-1;margin:0;padding:16px;border-radius:12px;background:#f5f8f9;color:var(--muted);font-size:.76rem}.purpose-card{display:flex;flex-direction:column;gap:7px;padding:15px;border:1px solid #d5e3e5;border-radius:15px;background:#fff;box-shadow:0 5px 18px rgba(16,60,82,.045)}.purpose-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.purpose-card-top span{font-size:.66rem;font-weight:900;color:var(--teal)}.purpose-card-top small{font-size:.62rem;color:var(--muted)}.purpose-card>strong{font-size:1.02rem;line-height:1.35}.purpose-card>em{font-style:normal;font-size:.7rem;color:var(--muted);line-height:1.4;min-height:2em}.purpose-card-total{display:grid;gap:2px;margin:3px 0 4px;padding:11px;border-radius:12px;background:#eef8f6}.purpose-card-total span{font-size:.64rem;color:#5e7979;font-weight:850}.purpose-card-total b{font-size:1.42rem;color:var(--teal);letter-spacing:-.04em}.purpose-card-detail,.purpose-method-compare{display:grid;gap:0;border-top:1px solid #e4ecee}.purpose-card-detail>div,.purpose-method-compare>div{display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-size:.67rem}.purpose-card-detail span,.purpose-method-compare span{color:var(--muted)}.purpose-card-detail b,.purpose-method-compare b{font-size:.69rem}.purpose-card-detail .welfare-line b{color:var(--teal)}.purpose-method-compare{margin-top:1px}.purpose-best{margin-top:auto;padding:9px 10px;border-radius:10px;background:#fff8e8;color:#725c28;font-size:.66rem;font-weight:850;line-height:1.45}.purpose-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:2px}.purpose-card-actions button{min-height:39px;border:1px solid #cbdadd;border-radius:10px;background:#fff;color:var(--navy);font:inherit;font-size:.72rem;font-weight:900;cursor:pointer}.purpose-card-actions button.primary{background:var(--navy);border-color:var(--navy);color:#fff}.purpose-footnote{margin-top:12px;color:#73868c;font-size:.66rem;line-height:1.5}
@media(max-width:900px){.purpose-tabs{grid-template-columns:1fr 1fr}.purpose-controls{grid-template-columns:1fr 1fr}.purpose-pension{grid-column:1/-1}.purpose-results{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.mobile-mode-switch{grid-template-columns:1fr 1fr 1fr}.mobile-mode-switch button{font-size:.72rem;padding:0 6px}.purpose-recommend{padding:17px;border-radius:17px}.purpose-tabs{grid-template-columns:1fr 1fr}.purpose-tabs button{min-height:68px}.purpose-controls{grid-template-columns:1fr 1fr}.purpose-results{grid-template-columns:1fr}.purpose-card>em{min-height:0}.purpose-card-total b{font-size:1.35rem}}
'''
p.write_text(s, encoding='utf-8')
