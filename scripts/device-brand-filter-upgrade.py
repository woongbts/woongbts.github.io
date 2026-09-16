from pathlib import Path

ROOT = Path('.')
HTML = ROOT / 'rates.html'
JS = ROOT / 'assets/rates.js'
CSS = ROOT / 'assets/rates.css'

html = HTML.read_text(encoding='utf-8')
js = JS.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'marker not found: {label}')
    return text.replace(old, new, 1)

# HTML: direct calculator brand filter + quick recommendation consistency.
html = replace_once(
    html,
    '<label>선호 브랜드<select id="quick-brand"><option value="all">상관없음</option><option value="samsung">삼성 갤럭시</option><option value="apple">애플 아이폰</option></select></label>',
    '<label>선호 브랜드<select id="quick-brand"><option value="all">상관없음</option><option value="samsung">삼성 갤럭시</option><option value="apple">애플 아이폰</option><option value="other">기타 제조사</option></select></label>',
    'quick brand other option'
)

html = replace_once(
    html,
    '''              <label>상세 계산 기준<select id="discount-method"><option value="support">공시지원금 · 단말 할인</option><option value="contract">선택약정 · 통신요금 25% 할인</option></select><small class="field-help">아래 비교표에서는 공시지원금과 선택약정을 동시에 계산합니다.</small></label>\n              <label>기종 검색<input id="device-search" type="search" autocomplete="off" placeholder="예: 아이폰18, S26, Wide9, SM-M176S"><small class="field-help">기종명이나 모델명으로 검색하세요. 검색 전에는 최신 기종 30개를 표시합니다.</small></label>''',
    '''              <label>상세 계산 기준<select id="discount-method"><option value="support">공시지원금 · 단말 할인</option><option value="contract">선택약정 · 통신요금 25% 할인</option></select><small class="field-help">아래 비교표에서는 공시지원금과 선택약정을 동시에 계산합니다.</small></label>\n              <div class="device-brand-filter" aria-label="기종 브랜드 선택">\n                <span>브랜드</span>\n                <div>\n                  <button type="button" class="active" data-device-brand="all">전체</button>\n                  <button type="button" data-device-brand="samsung">삼성</button>\n                  <button type="button" data-device-brand="apple">애플</button>\n                  <button type="button" data-device-brand="other">기타</button>\n                </div>\n                <small>브랜드를 먼저 고르면 아래 기종 목록을 빠르게 좁힐 수 있습니다.</small>\n              </div>\n              <label>기종 검색<input id="device-search" type="search" autocomplete="off" placeholder="예: 아이폰18, S26, Wide9, SM-M176S"><small class="field-help">선택한 브랜드 안에서 기종명이나 모델명으로 검색하세요. 검색 전에는 최신 기종 30개를 표시합니다.</small></label>''',
    'direct device brand filter'
)

html = html.replace('assets/rates.css?v=20260916-6', 'assets/rates.css?v=20260916-7')
html = html.replace('assets/rates.js?v=20260916-9', 'assets/rates.js?v=20260916-10')

# JS: common Apple / Samsung / Other classification.
js = replace_once(
    js,
    '''  function brandMatch(d,brand){\n    if(brand==='all')return true;const s=`${d?.name||''} ${d?.manufacturer||''} ${d?.model_code||''}`.toLowerCase();\n    if(brand==='apple')return s.includes('아이폰')||s.includes('iphone')||s.includes('apple')||s.includes('애플');\n    if(brand==='samsung')return s.includes('갤럭시')||s.includes('galaxy')||s.includes('samsung')||s.includes('삼성');\n    return true;\n  }''',
    '''  function deviceBrandKey(d){\n    const s=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();\n    if(s.includes('아이폰')||s.includes('iphone')||s.includes('apple')||s.includes('애플'))return 'apple';\n    if(s.includes('갤럭시')||s.includes('galaxy')||s.includes('samsung')||s.includes('삼성'))return 'samsung';\n    return 'other';\n  }\n  function brandMatch(d,brand){return brand==='all'||deviceBrandKey(d)===brand}''',
    'device brand classifier'
)

js = replace_once(
    js,
    '''  const deviceSelect=$('device-select'),deviceSearch=$('device-search'),planSelect=$('plan-select'),monthsSelect=$('installment-months'),welfareType=$('welfare-type');''',
    '''  const deviceSelect=$('device-select'),deviceSearch=$('device-search'),planSelect=$('plan-select'),monthsSelect=$('installment-months'),welfareType=$('welfare-type');\n  let deviceBrandFilter='all';''',
    'device brand state'
)

old_fill = '''  function fillDevices(){\n    const keep=deviceSelect.value,q=String(deviceSearch?.value||'').trim().toLowerCase();clearSelect(deviceSelect,q?'검색 결과를 선택하세요':'기종을 선택하세요');\n    let rows=(catalog?.devices||[]).filter(d=>d.carrier===carrier.value).sort(byNewest);\n    if(q) rows=rows.filter(d=>`${d.name||''} ${d.model||''} ${d.model_code||''}`.toLowerCase().includes(q)).slice(0,100);\n    else rows=rows.slice(0,30);\n    const selected=(catalog?.devices||[]).find(d=>d.id===keep&&d.carrier===carrier.value);\n    if(selected&&!rows.some(d=>d.id===selected.id))rows=[selected,...rows];\n    rows.forEach(d=>option(deviceSelect,d.id,[d.name,d.model_code||d.model].filter(Boolean).join(' · ')));\n    deviceSelect.value=[...deviceSelect.options].some(o=>o.value===keep)?keep:'';\n    if(q&&!rows.length)deviceSelect.options[0].textContent='검색 결과 없음';\n    fillDeviceCompareOptions();\n    fillPlans();\n  }'''
new_fill = '''  function updateDeviceBrandButtons(){\n    document.querySelectorAll('[data-device-brand]').forEach(btn=>btn.classList.toggle('active',btn.dataset.deviceBrand===deviceBrandFilter));\n  }\n  function fillDevices(){\n    const keep=deviceSelect.value,q=String(deviceSearch?.value||'').trim().toLowerCase();clearSelect(deviceSelect,q?'검색 결과를 선택하세요':'기종을 선택하세요');\n    let rows=(catalog?.devices||[]).filter(d=>d.carrier===carrier.value&&brandMatch(d,deviceBrandFilter)).sort(byNewest);\n    if(q) rows=rows.filter(d=>`${d.name||''} ${d.manufacturer||''} ${d.model||''} ${d.model_code||''}`.toLowerCase().includes(q)).slice(0,100);\n    else rows=rows.slice(0,30);\n    const selected=(catalog?.devices||[]).find(d=>d.id===keep&&d.carrier===carrier.value&&brandMatch(d,deviceBrandFilter));\n    if(selected&&!rows.some(d=>d.id===selected.id))rows=[selected,...rows];\n    rows.forEach(d=>option(deviceSelect,d.id,[d.name,d.model_code||d.model].filter(Boolean).join(' · ')));\n    deviceSelect.value=[...deviceSelect.options].some(o=>o.value===keep)?keep:'';\n    if(q&&!rows.length)deviceSelect.options[0].textContent='검색 결과 없음';\n    else if(!q&&!rows.length)deviceSelect.options[0].textContent='선택한 브랜드에 등록된 기종 없음';\n    updateDeviceBrandButtons();\n    fillDeviceCompareOptions();\n    fillPlans();\n  }'''
js = replace_once(js, old_fill, new_fill, 'filtered fillDevices')

js = replace_once(
    js,
    '''  function applyQuickResult(d,p,method){\n    carrier.value=d.carrier;joinType.value=$('quick-join').value;discountMethod.value=method;deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;deviceSearch.value='';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;setMobileMode('direct');syncMobile();document.getElementById('direct-mobile-grid')?.scrollIntoView({behavior:'smooth',block:'start'});\n  }''',
    '''  function applyQuickResult(d,p,method){\n    deviceBrandFilter=deviceBrandKey(d);updateDeviceBrandButtons();carrier.value=d.carrier;joinType.value=$('quick-join').value;discountMethod.value=method;deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;deviceSearch.value='';fillDevices();deviceSelect.value=d.id;fillPlans();planSelect.value=p.id;setMobileMode('direct');syncMobile();document.getElementById('direct-mobile-grid')?.scrollIntoView({behavior:'smooth',block:'start'});\n  }''',
    'quick result brand sync'
)

js = replace_once(
    js,
    '''    const d=(catalog?.devices||[]).find(x=>x.id===did&&x.carrier===carrier.value);if(!d)return false;\n    deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=did;fillPlans();''',
    '''    const d=(catalog?.devices||[]).find(x=>x.id===did&&x.carrier===carrier.value);if(!d)return false;\n    deviceBrandFilter=deviceBrandKey(d);updateDeviceBrandButtons();deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=did;fillPlans();''',
    'restore quote brand sync'
)

js = replace_once(
    js,
    '''  deviceSearch?.addEventListener('input',fillDevices);\n  $('plan-picker-open')?.addEventListener('click',openPlanPicker);''',
    '''  deviceSearch?.addEventListener('input',fillDevices);\n  document.querySelectorAll('[data-device-brand]').forEach(btn=>btn.addEventListener('click',()=>{\n    deviceBrandFilter=btn.dataset.deviceBrand||'all';if(deviceSearch)deviceSearch.value='';deviceSelect.value='';updateDeviceBrandButtons();fillDevices();\n  }));\n  $('plan-picker-open')?.addEventListener('click',openPlanPicker);''',
    'brand filter listeners'
)

# CSS: compact four-way brand chips.
brand_css = '''\n\n/* Device brand filter */\n.device-brand-filter{display:grid;gap:7px}.device-brand-filter>span{font-size:.82rem;font-weight:850;color:#46616a}.device-brand-filter>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.device-brand-filter button{min-height:40px;border:1px solid #cddcdf;border-radius:11px;background:#fff;color:#526b73;font:inherit;font-size:.76rem;font-weight:900;cursor:pointer}.device-brand-filter button.active{background:var(--navy);border-color:var(--navy);color:#fff;box-shadow:0 3px 10px rgba(16,60,82,.12)}.device-brand-filter button:focus-visible{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px rgba(15,118,110,.09)}.device-brand-filter>small{color:#819298;font-size:.7rem;font-weight:600;line-height:1.45}@media(max-width:380px){.device-brand-filter>div{grid-template-columns:1fr 1fr}}\n'''
if '/* Device brand filter */' not in css:
    css += brand_css

HTML.write_text(html, encoding='utf-8')
JS.write_text(js, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
print('device brand filter upgrade applied')
