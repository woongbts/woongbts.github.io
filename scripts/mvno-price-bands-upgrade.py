from pathlib import Path

html_path = Path('rates.html')
js_path = Path('assets/rates.js')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

old_price = '''                <div class="mvno-filter-group"><span>월 기본료</span><div><button type="button" class="active" data-mvno-filter-group="price" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="10000">1만원 이하</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="20000">2만원 이하</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="30000">3만원 이하</button></div></div>'''
new_price = '''                <div class="mvno-filter-group"><span>빠른 구간</span><div><button type="button" class="active" data-mvno-filter-group="price" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="under10">1만원 미만</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="10to20">1만원 이상 · 2만원 미만</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="20to30">2만원 이상 · 3만원 미만</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="unlimited">무제한</button></div><small class="field-help">가격 구간은 특별할인가 기준이며, 무제한은 데이터 제공 표기에 ‘무제한’이 있는 요금제를 모아 보여줍니다.</small></div>'''
if old_price not in html:
    raise SystemExit('MVNO old price filter markup not found')
html = html.replace(old_price, new_price, 1)

old_data = '''                <div class="mvno-filter-group"><span>데이터</span><div><button type="button" class="active" data-mvno-filter-group="data" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="5">5GB 이상</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="10">10GB 이상</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="unlimited">무제한 표기</button></div></div>'''
new_data = '''                <div class="mvno-filter-group"><span>데이터</span><div><button type="button" class="active" data-mvno-filter-group="data" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="5">5GB 이상</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="10">10GB 이상</button></div></div>'''
if old_data not in html:
    raise SystemExit('MVNO old data filter markup not found')
html = html.replace(old_data, new_data, 1)

html = html.replace('assets/rates.js?v=20260916-12', 'assets/rates.js?v=20260916-13', 1)

old_fee_func = "  function mvnoPlanFee(p){return p?.special_monthly_fee??p?.monthly_fee}\n"
new_fee_func = """  function mvnoPlanFee(p){return p?.special_monthly_fee??p?.monthly_fee}\n  function mvnoPriceBandLabel(value){\n    return {under10:'1만원 미만','10to20':'1만원 이상 · 2만원 미만','20to30':'2만원 이상 · 3만원 미만',unlimited:'데이터 무제한'}[value]||'';\n  }\n"""
if old_fee_func not in js:
    raise SystemExit('mvnoPlanFee function not found')
js = js.replace(old_fee_func, new_fee_func, 1)

old_price_logic = "    if(mvnoFilters.price!=='all'&&(!hasAmount(mvnoPlanFee(p))||Number(mvnoPlanFee(p))>Number(mvnoFilters.price)))return false;"
new_price_logic = """    const fee=Number(mvnoPlanFee(p));\n    if(mvnoFilters.price==='under10'&&!(hasAmount(mvnoPlanFee(p))&&fee<10000))return false;\n    if(mvnoFilters.price==='10to20'&&!(hasAmount(mvnoPlanFee(p))&&fee>=10000&&fee<20000))return false;\n    if(mvnoFilters.price==='20to30'&&!(hasAmount(mvnoPlanFee(p))&&fee>=20000&&fee<30000))return false;\n    if(mvnoFilters.price==='unlimited'&&!planHasUnlimited(p))return false;"""
if old_price_logic not in js:
    raise SystemExit('old MVNO price logic not found')
js = js.replace(old_price_logic, new_price_logic, 1)

old_count = "    $('mvno-filter-count').textContent=pid?`${plans.length.toLocaleString('ko-KR')}개 요금제가 현재 조건에 맞습니다.`:'통신사 또는 필터를 선택해 주세요.';"
new_count = "    const bandLabel=mvnoPriceBandLabel(mvnoFilters.price);$('mvno-filter-count').textContent=pid?`${bandLabel?bandLabel+' · ':''}${plans.length.toLocaleString('ko-KR')}개 요금제가 현재 조건에 맞습니다.`:'통신사 또는 필터를 선택해 주세요.';"
if old_count not in js:
    raise SystemExit('MVNO count line not found')
js = js.replace(old_count, new_count, 1)

old_click = "  document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.dataset.mvnoFilterGroup,value=btn.dataset.mvnoFilterValue;mvnoFilters[group]=value;updateMvnoFilterButtons();if(!mvnoProvider.value)mvnoProvider.value='all';if(group==='network'&&mvnoProvider.value!=='all'){const pr=(mvnoData.providers||[]).find(p=>p.id===mvnoProvider.value);if(value!=='all'&&pr?.network!==value)mvnoProvider.value='all'}fillMvnoPlans()}));"
new_click = "  document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.dataset.mvnoFilterGroup,value=btn.dataset.mvnoFilterValue;mvnoFilters[group]=value;if(group==='price'&&value==='unlimited')mvnoFilters.data='all';if(group==='price'&&value!=='all'&&mvnoSort)mvnoSort.value='price';updateMvnoFilterButtons();if(!mvnoProvider.value)mvnoProvider.value='all';if(group==='network'&&mvnoProvider.value!=='all'){const pr=(mvnoData.providers||[]).find(p=>p.id===mvnoProvider.value);if(value!=='all'&&pr?.network!==value)mvnoProvider.value='all'}fillMvnoPlans()}));"
if old_click not in js:
    raise SystemExit('MVNO filter click handler not found')
js = js.replace(old_click, new_click, 1)

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('MVNO price bands updated')
