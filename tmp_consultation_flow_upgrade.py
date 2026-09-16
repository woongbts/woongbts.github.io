from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 target, found {count}")
    return text.replace(old, new, 1)


# rates.html
p = Path("rates.html")
s = p.read_text(encoding="utf-8")

s = replace_once(
    s,
    '''        <div class="rate-hero-note">추가지원금, 실시간 재고, 일부 결합·프로모션처럼 최종 확인이 필요한 항목은 매장 문의로 안내합니다.</div>\n      </div>''',
    '''        <div class="rate-hero-note">추가지원금, 실시간 재고, 일부 결합·프로모션처럼 최종 확인이 필요한 항목은 매장 문의로 안내합니다.</div>\n        <div class="rate-hero-shortcuts" aria-label="상담 종류 바로가기">\n          <span>무엇을 알아보고 계세요?</span>\n          <div>\n            <button type="button" data-jump-tab="mobile">휴대폰 바꾸기</button>\n            <button type="button" data-jump-tab="studyphone">공신폰</button>\n            <button type="button" data-jump-tab="mvno">알뜰폰</button>\n            <button type="button" data-jump-tab="prepaid">선불폰</button>\n            <button type="button" data-jump-tab="internet">인터넷·TV</button>\n          </div>\n        </div>\n      </div>''',
    "hero shortcuts",
)

s = replace_once(
    s,
    '''                </button>\n                <select id="plan-select" class="plan-select-native" disabled tabindex="-1" aria-hidden="true"><option value="">기종을 먼저 선택하세요</option></select>''',
    '''                </button>\n                <div class="plan-quick-shortcuts" id="plan-quick-shortcuts" aria-label="요금제 빠른 찾기">\n                  <span>빠른 찾기</span>\n                  <button type="button" data-plan-quick-price="under40" disabled>4만원 미만</button>\n                  <button type="button" data-plan-quick-price="40s" disabled>4만원대</button>\n                  <button type="button" data-plan-quick-price="50plus" disabled>5만원 이상</button>\n                  <button type="button" data-plan-quick-feature="benefit" disabled>혜택형</button>\n                </div>\n                <select id="plan-select" class="plan-select-native" disabled tabindex="-1" aria-hidden="true"><option value="">기종을 먼저 선택하세요</option></select>''',
    "mobile plan shortcuts",
)

s = replace_once(
    s,
    '''              <div class="rate-warning">단말 할부는 24개월·연 5.9% 원리금균등 방식의 예상치입니다. 공시지원금과 실제 개통 조건은 상담 시점에 변경될 수 있습니다.</div>\n              <div class="rate-actions"><a href="tel:0513437677">공신폰 전화상담</a><a class="kakao" href="http://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의</a></div>''',
    '''              <div class="rate-warning">단말 할부는 24개월·연 5.9% 원리금균등 방식의 예상치입니다. 공시지원금과 실제 개통 조건은 상담 시점에 변경될 수 있습니다.</div>\n              <div class="consult-copy-tools">\n                <button type="button" id="copy-studyphone-quote">선택내용 복사</button>\n                <button type="button" id="share-studyphone-quote">공유</button>\n                <button type="button" class="primary" id="consult-studyphone-quote">이 조건으로 상담</button>\n                <small id="studyphone-quote-status" aria-live="polite"></small>\n              </div>\n              <div class="rate-actions"><a href="tel:0513437677">공신폰 전화상담</a><a class="kakao" href="http://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의</a></div>''',
    "studyphone consult tools",
)

s = replace_once(
    s,
    '''              <p id="mvno-summary">통신사와 요금제를 선택하면 자동으로 반영됩니다.</p>\n              <div class="rate-warning">표시 월요금은 현재 등록된 요금제의 기본료 기준입니다. 유심비·개통 가능 여부·프로모션 변경 여부는 매장에서 최종 확인해 주세요.</div>''',
    '''              <p id="mvno-summary">통신사와 요금제를 선택하면 자동으로 반영됩니다.</p>\n              <div class="consult-copy-tools">\n                <button type="button" id="copy-mvno-quote">선택내용 복사</button>\n                <button type="button" id="share-mvno-quote">공유</button>\n                <button type="button" class="primary" id="consult-mvno-quote">이 조건으로 상담</button>\n                <small id="mvno-quote-status" aria-live="polite"></small>\n              </div>\n              <div class="rate-warning">표시 월요금은 현재 등록된 요금제의 기본료 기준입니다. 유심비·개통 가능 여부·프로모션 변경 여부는 매장에서 최종 확인해 주세요.</div>''',
    "mvno consult tools",
)

s = replace_once(
    s,
    '''              <p id="prepaid-summary">통신사와 요금제를 선택하면 자동으로 반영됩니다.</p>\n              <div class="rate-warning">충전·유심·개통 조건과 사용기간은 상품별로 다를 수 있어 매장에서 최종 확인이 필요합니다.</div>''',
    '''              <p id="prepaid-summary">통신사와 요금제를 선택하면 자동으로 반영됩니다.</p>\n              <div class="consult-copy-tools">\n                <button type="button" id="copy-prepaid-quote">선택내용 복사</button>\n                <button type="button" id="share-prepaid-quote">공유</button>\n                <button type="button" class="primary" id="consult-prepaid-quote">이 조건으로 상담</button>\n                <small id="prepaid-quote-status" aria-live="polite"></small>\n              </div>\n              <div class="rate-warning">충전·유심·개통 조건과 사용기간은 상품별로 다를 수 있어 매장에서 최종 확인이 필요합니다.</div>''',
    "prepaid consult tools",
)

s = replace_once(
    s,
    '''              <div><span class="eyebrow">한눈에 비교</span><h3>같은 조건으로 통신사 비교</h3><p>속도와 TV 가입 여부를 고르면 각 통신사의 월 예상요금과 고객사은품 최대 금액을 나란히 보여드립니다.</p></div>\n              <div class="wired-compare-controls">''',
    '''              <div><span class="eyebrow">한눈에 비교</span><h3>같은 조건으로 통신사 비교</h3><p>속도와 TV 가입 여부를 고르면 각 통신사의 월 예상요금과 고객사은품 최대 금액을 나란히 보여드립니다.</p></div>\n              <div class="wired-life-presets" aria-label="생활형 빠른 견적">\n                <span>빠른 선택</span>\n                <button type="button" data-wired-life-preset="internet">인터넷만</button>\n                <button type="button" data-wired-life-preset="tv1" class="active">인터넷 + TV 1대</button>\n                <button type="button" data-wired-life-preset="tv2">인터넷 + TV 2대</button>\n              </div>\n              <div class="wired-compare-controls">''',
    "wired lifestyle presets",
)

s = replace_once(s, "assets/rates.css?v=20260916-12", "assets/rates.css?v=20260916-13", "css version")
s = replace_once(s, "assets/rates.js?v=20260916-17", "assets/rates.js?v=20260916-18", "js version")
p.write_text(s, encoding="utf-8")


# assets/rates.js
p = Path("assets/rates.js")
s = p.read_text(encoding="utf-8")

s = replace_once(
    s,
    "  function setUpdated(id,date){const el=$(id);if(el)el.textContent=date?`상품 데이터 ${date} 기준`:'상품 데이터 확인 중'}\n",
    """  function setUpdated(id,date){const el=$(id);if(el)el.textContent=date?`상품 데이터 ${date} 기준`:'상품 데이터 확인 중'}
  async function copyCustomerConsultText(text){
    if(!text)return false;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true}}catch(e){}
    try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return !!ok}catch(e){return false}
  }
  async function shareCustomerConsultText(title,text,statusId){
    const status=$(statusId);if(!text){if(status)status.textContent='먼저 상품을 선택해 주세요.';return false}
    if(navigator.share){try{await navigator.share({title,text,url:location.href});if(status)status.textContent='공유창을 열었습니다.';return true}catch(e){if(e?.name==='AbortError')return false}}
    const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다. 원하는 곳에 붙여넣어 주세요.':'복사하지 못했습니다. 다시 시도해 주세요.';return ok;
  }
  async function consultWithCustomerText(text,statusId){
    const status=$(statusId);if(!text){if(status)status.textContent='먼저 상품을 선택해 주세요.';return false}
    const ok=await copyCustomerConsultText(text);if(!ok){if(status)status.textContent='선택 내용을 복사하지 못했습니다. 다시 시도해 주세요.';return false}
    if(status)status.textContent='선택 내용을 복사했습니다. 카카오톡 상담창에 붙여넣어 주세요.';window.location.href='http://pf.kakao.com/_nWwNT/chat';return true;
  }
""",
    "consult helpers",
)

s = replace_once(
    s,
    "  }));\n\n  // 휴대폰\n",
    """  }));
  document.querySelectorAll('[data-jump-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.jumpTab,tab=document.querySelector(`.rate-tab[data-tab="${key}"]`),panel=document.querySelector(`.rate-panel[data-panel="${key}"]`);if(!tab||!panel)return;tab.click();setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),20);
  }));

  // 휴대폰
""",
    "hero shortcut listeners",
)

s = replace_once(
    s,
    """  function syncPlanPickerTrigger(){
    const button=$('plan-picker-open'),title=$('plan-picker-selected'),detail=$('plan-picker-selected-detail'),d=currentDevice(),p=currentPlan();if(!button||!title||!detail)return;
""",
    """  function syncPlanQuickShortcuts(){const disabled=!currentDevice();document.querySelectorAll('[data-plan-quick-price],[data-plan-quick-feature]').forEach(btn=>btn.disabled=disabled)}
  function syncPlanPickerTrigger(){
    syncPlanQuickShortcuts();
    const button=$('plan-picker-open'),title=$('plan-picker-selected'),detail=$('plan-picker-selected-detail'),d=currentDevice(),p=currentPlan();if(!button||!title||!detail)return;
""",
    "plan shortcut sync",
)

s = replace_once(
    s,
    "  document.querySelectorAll('[data-plan-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{planPickerState[btn.dataset.planFilterGroup]=btn.dataset.planFilterValue;renderPlanPicker()}));\n",
    """  document.querySelectorAll('[data-plan-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{planPickerState[btn.dataset.planFilterGroup]=btn.dataset.planFilterValue;renderPlanPicker()}));
  document.querySelectorAll('[data-plan-quick-price]').forEach(btn=>btn.addEventListener('click',()=>{if(!currentDevice())return;planPickerState.data='all';planPickerState.feature='all';planPickerState.price=btn.dataset.planQuickPrice||'all';planPickerState.sort='source';planPickerState.query='';if($('plan-picker-search'))$('plan-picker-search').value='';openPlanPicker()}));
  document.querySelectorAll('[data-plan-quick-feature]').forEach(btn=>btn.addEventListener('click',()=>{if(!currentDevice())return;planPickerState.data='all';planPickerState.price='all';planPickerState.feature=btn.dataset.planQuickFeature||'all';planPickerState.sort='source';planPickerState.query='';if($('plan-picker-search'))$('plan-picker-search').value='';openPlanPicker()}));
""",
    "plan shortcut listeners",
)

s = replace_once(
    s,
    "  function renderStudyphonePlanList(){\n",
    """  function studyphoneQuoteText(){
    const d=studyphoneData?.device,p=studyphoneCurrentPlan();if(!d||!p)return '';const scenario=studyphoneScenario(p);
    return ['[웅비통신 공신폰 상담]',`통신사: ${d.provider||'KT M모바일'}`,`기종: ${d.name||'갤럭시 A17 공신폰'}${d.model?' ('+d.model+')':''}`,`요금제: ${p.name}`,`월 기본료: ${won(p.monthly_fee)}`,`통화: ${p.voice||'확인 필요'}`,`문자: ${p.sms||'확인 필요'}`,`데이터: ${p.data||'확인 필요'}`,`공시지원금: ${won(scenario.support)}`,`할부원금: ${won(scenario.principal)}`,`예상 월 납부액: ${won(scenario.total)}`,'※ 실제 개통 조건은 상담 시점에 최종 확인해 주세요.'].join('\\n');
  }
  function renderStudyphonePlanList(){
""",
    "studyphone quote text",
)

s = replace_once(
    s,
    """  $('studyphone-plan-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-studyphone-plan]');if(!b||!studyphonePlan)return;studyphonePlan.value=b.dataset.studyphonePlan;syncStudyphone();document.querySelector('[data-panel="studyphone"]')?.scrollIntoView({behavior:'smooth',block:'start'})});

  // 알뜰폰 후불
""",
    """  $('studyphone-plan-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-studyphone-plan]');if(!b||!studyphonePlan)return;studyphonePlan.value=b.dataset.studyphonePlan;syncStudyphone();document.querySelector('[data-panel="studyphone"]')?.scrollIntoView({behavior:'smooth',block:'start'})});
  $('copy-studyphone-quote')?.addEventListener('click',async()=>{const text=studyphoneQuoteText(),status=$('studyphone-quote-status');if(!text){if(status)status.textContent='요금제를 먼저 선택해 주세요.';return}const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다.':'복사하지 못했습니다. 다시 시도해 주세요.'});
  $('share-studyphone-quote')?.addEventListener('click',()=>shareCustomerConsultText('웅비통신 공신폰 상담',studyphoneQuoteText(),'studyphone-quote-status'));
  $('consult-studyphone-quote')?.addEventListener('click',()=>consultWithCustomerText(studyphoneQuoteText(),'studyphone-quote-status'));

  // 알뜰폰 후불
""",
    "studyphone listeners",
)

s = replace_once(
    s,
    "  mvnoProvider.addEventListener('change',()=>{clearMvnoPickerQuery();fillMvnoPlans()});mvnoPlan.addEventListener('change',()=>{syncMvno();updateMvnoPickerSummary();if(mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)renderMvnoPlanCards()});mvnoSort?.addEventListener('change',fillMvnoPlans);\n",
    """  function mvnoQuoteText(){
    const p=(mvnoData.plans||[]).find(x=>x.id===mvnoPlan.value)||null;if(!p)return '';const provider=(mvnoData.providers||[]).find(x=>x.id===p.provider_id)||null,fee=mvnoPlanFee(p);
    const lines=['[웅비통신 알뜰폰 상담]',`통신사: ${provider?.name||p.provider_id||'확인 필요'}`,`통신망: ${p.network||provider?.network||'확인 필요'}`,`요금제: ${p.name||'확인 필요'}`,`월 기본료: ${hasAmount(fee)?won(fee):'매장 확인'}`];if(p.data)lines.push(`데이터: ${p.data}`);if(p.voice)lines.push(`통화: ${p.voice}`);if(p.sms)lines.push(`문자: ${p.sms}`);lines.push('※ 프로모션·개통 가능 여부는 상담 시점에 최종 확인해 주세요.');return lines.join('\\n');
  }
  mvnoProvider.addEventListener('change',()=>{clearMvnoPickerQuery();fillMvnoPlans()});mvnoPlan.addEventListener('change',()=>{syncMvno();updateMvnoPickerSummary();if(mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)renderMvnoPlanCards()});mvnoSort?.addEventListener('change',fillMvnoPlans);
""",
    "mvno quote text",
)

s = replace_once(
    s,
    """  mvnoPickerOpen?.addEventListener('click',openMvnoPlanPicker);mvnoPickerClose?.addEventListener('click',closeMvnoPlanPicker);mvnoPickerBackdrop?.addEventListener('click',e=>{if(e.target===mvnoPickerBackdrop)closeMvnoPlanPicker()});mvnoPickerSearch?.addEventListener('input',()=>{mvnoPickerQuery=mvnoPickerSearch.value;renderMvnoPlanCards()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)closeMvnoPlanPicker()});

  // 선불폰
""",
    """  mvnoPickerOpen?.addEventListener('click',openMvnoPlanPicker);mvnoPickerClose?.addEventListener('click',closeMvnoPlanPicker);mvnoPickerBackdrop?.addEventListener('click',e=>{if(e.target===mvnoPickerBackdrop)closeMvnoPlanPicker()});mvnoPickerSearch?.addEventListener('input',()=>{mvnoPickerQuery=mvnoPickerSearch.value;renderMvnoPlanCards()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)closeMvnoPlanPicker()});
  $('copy-mvno-quote')?.addEventListener('click',async()=>{const text=mvnoQuoteText(),status=$('mvno-quote-status');if(!text){if(status)status.textContent='요금제를 먼저 선택해 주세요.';return}const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다.':'복사하지 못했습니다. 다시 시도해 주세요.'});
  $('share-mvno-quote')?.addEventListener('click',()=>shareCustomerConsultText('웅비통신 알뜰폰 상담',mvnoQuoteText(),'mvno-quote-status'));
  $('consult-mvno-quote')?.addEventListener('click',()=>consultWithCustomerText(mvnoQuoteText(),'mvno-quote-status'));

  // 선불폰
""",
    "mvno listeners",
)

s = replace_once(
    s,
    """  prepaidProvider.addEventListener('change',fillPrepaidPlans);prepaidPlan.addEventListener('change',syncPrepaid);

  // 인터넷·TV
""",
    """  function prepaidQuoteText(){
    const p=(prepaidData.plans||[]).find(x=>x.id===prepaidPlan.value)||null;if(!p)return '';const provider=(prepaidData.providers||[]).find(x=>x.id===p.provider_id)||null;
    const lines=['[웅비통신 선불폰 상담]',`통신사: ${provider?.name||p.provider_id||'확인 필요'}`,`통신망: ${p.network||provider?.network||'확인 필요'}`,`요금제: ${p.name||'확인 필요'}`,`월 이용료: ${hasAmount(p.monthly_fee)?won(p.monthly_fee):'매장 확인'}`];if(p.data)lines.push(`데이터: ${p.data}`);if(p.voice)lines.push(`통화: ${p.voice}`);if(p.valid_days)lines.push(`사용기간: ${p.valid_days}일`);lines.push('※ 충전·유심·개통 조건은 상담 시점에 최종 확인해 주세요.');return lines.join('\\n');
  }
  prepaidProvider.addEventListener('change',fillPrepaidPlans);prepaidPlan.addEventListener('change',syncPrepaid);
  $('copy-prepaid-quote')?.addEventListener('click',async()=>{const text=prepaidQuoteText(),status=$('prepaid-quote-status');if(!text){if(status)status.textContent='요금제를 먼저 선택해 주세요.';return}const ok=await copyCustomerConsultText(text);if(status)status.textContent=ok?'선택 내용을 복사했습니다.':'복사하지 못했습니다. 다시 시도해 주세요.'});
  $('share-prepaid-quote')?.addEventListener('click',()=>shareCustomerConsultText('웅비통신 선불폰 상담',prepaidQuoteText(),'prepaid-quote-status'));
  $('consult-prepaid-quote')?.addEventListener('click',()=>consultWithCustomerText(prepaidQuoteText(),'prepaid-quote-status'));

  // 인터넷·TV
""",
    "prepaid tools",
)

s = replace_once(
    s,
    "  function renderWiredComparison(){\n    const box=$('wired-compare-results');if(!box)return;\n",
    """  function syncWiredLifePresetButtons(){const withTv=$('wired-compare-tv')?.value==='basic',count=withTv?Math.max(1,Number($('wired-compare-count')?.value||1)):0,key=!withTv?'internet':count===1?'tv1':count===2?'tv2':'';document.querySelectorAll('[data-wired-life-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.wiredLifePreset===key))}
  function renderWiredComparison(){
    const box=$('wired-compare-results');if(!box)return;
""",
    "wired preset sync",
)

s = replace_once(
    s,
    "    const countSel=$('wired-compare-count');if(countSel)countSel.disabled=!withTv;\n",
    "    const countSel=$('wired-compare-count');if(countSel)countSel.disabled=!withTv;syncWiredLifePresetButtons();\n",
    "wired preset state",
)

s = replace_once(
    s,
    """  $('wired-compare-count')?.addEventListener('change',renderWiredComparison);
  $('wired-compare-results')?.addEventListener('click',e=>{
""",
    """  $('wired-compare-count')?.addEventListener('change',renderWiredComparison);
  document.querySelectorAll('[data-wired-life-preset]').forEach(btn=>btn.addEventListener('click',()=>{const tv=$('wired-compare-tv'),count=$('wired-compare-count');if(!tv||!count)return;const preset=btn.dataset.wiredLifePreset;if(preset==='internet')tv.value='none';else{tv.value='basic';count.value=preset==='tv2'?'2':'1'}renderWiredComparison()}));
  $('wired-compare-results')?.addEventListener('click',e=>{
""",
    "wired preset listeners",
)

p.write_text(s, encoding="utf-8")


# assets/rates.css
p = Path("assets/rates.css")
s = p.read_text(encoding="utf-8")
marker = "/* Consultation flow upgrade 2026-09-16 */"
if marker in s:
    raise SystemExit("css marker already exists")
s += r'''

/* Consultation flow upgrade 2026-09-16 */
.rate-hero-shortcuts{margin-top:18px;display:grid;gap:9px;max-width:900px}.rate-hero-shortcuts>span{font-size:.78rem;font-weight:900;color:#45616a}.rate-hero-shortcuts>div{display:flex;gap:8px;flex-wrap:wrap}.rate-hero-shortcuts button{min-height:42px;padding:0 14px;border:1px solid #c8dcdf;border-radius:999px;background:rgba(255,255,255,.9);color:var(--navy);font:inherit;font-size:.8rem;font-weight:900;cursor:pointer}.rate-hero-shortcuts button:hover{border-color:var(--teal);color:var(--teal)}
.plan-quick-shortcuts{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:-3px}.plan-quick-shortcuts>span{font-size:.7rem;font-weight:900;color:#6b8188;margin-right:2px}.plan-quick-shortcuts button{min-height:36px;padding:0 11px;border:1px solid #cfdee1;border-radius:999px;background:#f8fbfb;color:#315462;font:inherit;font-size:.72rem;font-weight:900;cursor:pointer}.plan-quick-shortcuts button:hover:not(:disabled){border-color:var(--teal);color:var(--teal);background:#eef8f6}.plan-quick-shortcuts button:disabled{opacity:.45;cursor:not-allowed}
.consult-copy-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.consult-copy-tools button{min-height:42px;border:1px solid #cbdadd;border-radius:11px;background:#fff;color:var(--navy);font:inherit;font-size:.78rem;font-weight:900;cursor:pointer}.consult-copy-tools button.primary{grid-column:1/-1;background:var(--navy);border-color:var(--navy);color:#fff}.consult-copy-tools small{grid-column:1/-1;min-height:1.05em;color:var(--teal);font-size:.69rem;line-height:1.45}
.wired-life-presets{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:12px 0 2px}.wired-life-presets>span{font-size:.7rem;font-weight:900;color:#6b8188;margin-right:2px}.wired-life-presets button{min-height:38px;padding:0 12px;border:1px solid #cfdee1;border-radius:999px;background:#fff;color:#315462;font:inherit;font-size:.73rem;font-weight:900;cursor:pointer}.wired-life-presets button.active{background:var(--navy);border-color:var(--navy);color:#fff}
@media(max-width:760px){.rate-hero-shortcuts>div{display:grid;grid-template-columns:1fr 1fr}.rate-hero-shortcuts button{width:100%;border-radius:12px;min-height:44px}.plan-quick-shortcuts{display:grid;grid-template-columns:1fr 1fr}.plan-quick-shortcuts>span{grid-column:1/-1}.plan-quick-shortcuts button{width:100%;border-radius:11px;min-height:40px}.consult-copy-tools{grid-template-columns:1fr 1fr}.wired-life-presets{display:grid;grid-template-columns:1fr 1fr}.wired-life-presets>span{grid-column:1/-1}.wired-life-presets button{width:100%;border-radius:11px;min-height:42px}.wired-life-presets button:last-child{grid-column:1/-1}}
'''
p.write_text(s, encoding="utf-8")
