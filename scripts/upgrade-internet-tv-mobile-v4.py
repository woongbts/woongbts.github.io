from pathlib import Path
import json

ROOT = Path('.')
html_path = ROOT / 'rates.html'
js_path = ROOT / 'assets/rates.js'
css_path = ROOT / 'assets/rates.css'
data_path = ROOT / 'data/internet.json'

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
data = json.loads(data_path.read_text(encoding='utf-8'))

# ---------- TV product descriptions / channel information ----------
def set_tv_detail(tv):
    provider = tv.get('provider_id', '')
    name = str(tv.get('name', ''))
    n = name.lower()
    channel_label = None
    desc = None

    if provider == 'SKB':
        if 'pop 230' in n:
            channel_label, desc = '228개', '드라마·예능·스포츠 등 주요 채널을 폭넓게 구성한 B tv pop 상품'
        elif 'pop 180' in n:
            channel_label, desc = '184개', '주요 인기 채널 중심으로 구성한 B tv pop 상품'
        elif 'pop 100' in n:
            channel_label, desc = '111개', '필수 채널 위주로 구성한 B tv pop 실속 상품'
        elif '캐치온' in name:
            channel_label, desc = '256개', 'B tv All 기반에 영화 채널 캐치온을 더한 상품'
        elif '스탠다드' in name:
            channel_label = '234개'
            desc = '드라마·예능부터 스포츠·골프 등 인기 채널을 폭넓게 제공' + (' · B tv+ 콘텐츠 혜택 포함' if '+' in name else '')
        elif 'all' in n:
            channel_label = '254개'
            desc = 'B tv의 주요 전체 채널을 폭넓게 제공' + (' · B tv+ 콘텐츠 혜택 포함' if '+' in name else '')
        elif '이코노미' in name:
            channel_label, desc = '183개', '드라마·예능 중심의 기본 채널을 경제적으로 이용하는 실속형 상품'
        elif 'btv+ max' in n:
            desc = 'B tv+ 콘텐츠 혜택을 강화한 상위 상품 · 세부 채널수는 상담 시 확인'
    elif provider == 'KT':
        if '스카이라이프' in name:
            if '라이트' in name:
                channel_label, desc = '223개', '지니 TV와 스카이라이프 채널을 함께 이용하는 라이트 상품'
            elif '에센스' in name or '엔터' in name or '키즈' in name:
                channel_label = '226개'
                desc = '지니 TV 스카이라이프 채널 구성' + (' · 엔터/VOD 혜택 포함' if '엔터' in name else '')
            else:
                desc = '지니 TV 스카이라이프 결합형 상품 · 세부 채널수는 상담 시 확인'
        elif '디즈니' in name and '모든g' in n:
            channel_label, desc = '약 250개', '주요 지니 TV 채널과 디즈니+ 스탠다드 멤버십 제공'
        elif '모든g' in n:
            channel_label, desc = '약 250개', '주요 실시간 채널과 무결제·무광고 VOD 혜택을 제공'
        elif '에센스 플러스' in name:
            channel_label, desc = '269개', '지니 TV 에센스 채널에 매월 VOD 이용권 혜택을 더한 상품'
        elif '에센스' in name:
            channel_label, desc = '269개', '지상파·종편·드라마·스포츠 등 폭넓은 채널을 제공하는 상위 상품'
        elif '라이트' in name:
            channel_label, desc = '243개', '주요 인기 채널을 폭넓게 제공하는 중간형 상품'
        elif '베이직' in name:
            channel_label, desc = '239개', '지니 TV의 주요 기본 채널을 고르게 제공하는 기본형 상품'
        elif '넷플릭스' in name:
            channel_label, desc = '약 260개', '지니 TV 주요 채널과 넷플릭스 멤버십을 함께 이용하는 상품'
        elif any(k in name for k in ['VOD', '키즈', '뮤즈', '슈퍼', '티빙']):
            desc = '지니 TV 실시간 채널에 선택한 콘텐츠·VOD 혜택을 더한 상품 · 세부 채널수는 상담 시 확인'
    elif provider == 'LGU+':
        if name == '실속형':
            channel_label, desc = '약 216개', '자주 보는 기본 인기 채널 중심의 실속형 상품'
        elif name == '기본형':
            channel_label, desc = '222개', '지상파·종편·예능·드라마 등 주요 채널을 고르게 제공'
        elif name == '고급형':
            channel_label, desc = '235개', '기본형보다 채널 구성을 넓히고 프리미엄 클럽 혜택을 제공'
        elif name == '프리미엄':
            channel_label, desc = '약 251개', '다양한 인기 채널과 프리미엄 클럽 혜택을 제공하는 상위 상품'
        elif '기본형 방송패스' in name:
            channel_label, desc = '222개', '기본형 채널에 지상파·JTBC 월정액 혜택을 더한 상품'
        elif '프리미엄' in name:
            channel_label = '257개'
            extras = []
            for key, label in [('방송패스','지상파·JTBC 콘텐츠'),('VOD','VOD 쿠폰'),('디즈니','디즈니+'),('티빙','티빙'),('넷플릭스','넷플릭스'),('유플레이','유플레이'),('내맘대로','선택형 부가서비스')]:
                if key in name:
                    extras.append(label)
            desc = 'U+tv의 폭넓은 프리미엄 채널과 UHD팩' + (f" · {' · '.join(extras)} 혜택 포함" if extras else '')
    elif provider == 'LGHELLO':
        if 'UHD 이코노미' in name:
            channel_label, desc = '약 110개', '주요 채널을 빠짐없이 담은 UHD 실속형 상품'
        elif 'UHD 뉴베이직' in name:
            channel_label, desc = '약 245개', '골프·스포츠·재방 전문 채널까지 폭넓게 제공하는 인기 상품'
        elif 'UHD 뉴프리미엄' in name:
            channel_label, desc = '약 245개', '헬로tv의 폭넓은 채널을 제공하는 프리미엄 UHD 상품'
        elif 'HD 이코노미' in name:
            desc = '지역별 주요 실속 채널을 제공하는 HD 상품 · 채널수는 지역에 따라 달라질 수 있음'
        elif 'HD 뉴베이직' in name:
            desc = '지역별 주요 인기 채널을 폭넓게 제공하는 HD 상품 · 채널수는 지역에 따라 달라질 수 있음'
        elif 'UHD Pro' in name:
            desc = '헬로tv Pro 기반의 UHD/IP 방송 상품 · 세부 채널수는 지역 및 상품에 따라 확인 필요'
    elif provider == 'SKYLIFE':
        if 'ipit TV 베이직' in name:
            channel_label, desc = '약 195개', '핵심 채널을 실속 있게 제공하는 IPTV 기본형 상품'
        elif 'ipit TV 플러스' in name:
            channel_label, desc = '209개', '더 많은 실시간 채널과 OTT 앱 연동을 지원하는 IPTV 상품'
        elif 'sky All' in name:
            channel_label, desc = '241개', 'UHD 6개·고화질 203개·오디오 32개를 포함한 스카이라이프 대표 상품'
        elif 'sky 포인트' in name:
            channel_label, desc = '241개', 'sky All 채널에 매월 선택형 부가팩 혜택을 더한 상품'

    if channel_label:
        tv['channel_label'] = channel_label
    else:
        tv.pop('channel_label', None)
    if desc:
        tv['description'] = desc
    else:
        tv['description'] = '상품별 채널 구성과 부가 혜택은 상담 시 확인해 주세요.'
    tv['channel_note'] = '채널 편성은 지역·시점·사업자 정책에 따라 변경될 수 있습니다.'

for tv in data.get('tv_products', []):
    set_tv_detail(tv)

# ---------- Verified mobile + home bundle rules ----------
new_ids = {
    'SKB-YGF-100','SKB-YGF-500','SKB-YGF-1G',
    'KT-TOTAL-100-L1','KT-TOTAL-100-L2','KT-TOTAL-100-L3',
    'KT-TOTAL-500-L1','KT-TOTAL-500-L2',
    'LG-EASY-100','LG-EASY-500','LG-EASY-1G','LG-TOGETHER-500M',
    'HELLO-MOBILE-TV','SKYLIFE-MOBILE-CHECK'
}
rules = [r for r in data.get('bundle_rules', []) if r.get('id') not in new_ids]

rules += [
    {'id':'SKB-YGF-100','provider_id':'SKB','kind':'mobile','name':'요즘가족결합 · 100M 인터넷 4,400원 할인','minimum_speed_mbps':1,'maximum_speed_mbps':100,'discount':4400,'tv_extra_discount':1100,'source_order':10,'notes':'인터넷 요금 4,400원 할인 · TV 함께 결합 시 TV 요금 1,100원 추가 할인 · 휴대폰 요금 할인은 별도'},
    {'id':'SKB-YGF-500','provider_id':'SKB','kind':'mobile','name':'요즘가족결합 · 500M 인터넷 11,000원 할인','minimum_speed_mbps':500,'maximum_speed_mbps':999,'discount':11000,'tv_extra_discount':1100,'source_order':11,'notes':'인터넷 요금 11,000원 할인 · TV 함께 결합 시 TV 요금 1,100원 추가 할인 · 휴대폰 요금 할인은 별도'},
    {'id':'SKB-YGF-1G','provider_id':'SKB','kind':'mobile','name':'요즘가족결합 · 1G 이상 13,200원 할인','minimum_speed_mbps':1000,'discount':13200,'tv_extra_discount':1100,'source_order':12,'notes':'인터넷 요금 13,200원 할인 · TV 함께 결합 시 TV 요금 1,100원 추가 할인 · 휴대폰 요금 할인은 별도'},

    {'id':'KT-TOTAL-100-L1','provider_id':'KT','kind':'mobile','name':'총액결합 · 100M / 모바일 합계 22,000원 미만','minimum_speed_mbps':1,'maximum_speed_mbps':100,'discount':1650,'source_order':20,'notes':'인터넷 청구 1,650원 할인 · 휴대폰 청구 할인은 별도'},
    {'id':'KT-TOTAL-100-L2','provider_id':'KT','kind':'mobile','name':'총액결합 · 100M / 모바일 합계 22,000~64,899원','minimum_speed_mbps':1,'maximum_speed_mbps':100,'discount':3300,'source_order':21,'notes':'인터넷 청구 3,300원 할인 · 휴대폰 청구 할인은 별도'},
    {'id':'KT-TOTAL-100-L3','provider_id':'KT','kind':'mobile','name':'총액결합 · 100M / 모바일 합계 64,900원 이상','minimum_speed_mbps':1,'maximum_speed_mbps':100,'discount':5500,'source_order':22,'notes':'인터넷 청구 5,500원 할인 · 구간별 휴대폰 청구 할인은 별도'},
    {'id':'KT-TOTAL-500-L1','provider_id':'KT','kind':'mobile','name':'총액결합 · 500M~1G / 모바일 합계 22,000원 미만','minimum_speed_mbps':500,'maximum_speed_mbps':1000,'discount':2200,'source_order':23,'notes':'인터넷 청구 2,200원 할인 · 휴대폰 청구 할인은 별도'},
    {'id':'KT-TOTAL-500-L2','provider_id':'KT','kind':'mobile','name':'총액결합 · 500M~1G / 모바일 합계 22,000원 이상','minimum_speed_mbps':500,'maximum_speed_mbps':1000,'discount':5500,'source_order':24,'notes':'인터넷 청구 5,500원 할인 · 구간별 휴대폰 청구 할인은 별도'},

    {'id':'LG-EASY-100','provider_id':'LGU+','kind':'mobile','name':'참 쉬운 가족결합 · 100/200M 5,500원 할인','minimum_speed_mbps':1,'maximum_speed_mbps':200,'discount':5500,'source_order':30,'notes':'인터넷 요금 5,500원 할인 · 휴대폰 회선별 할인은 별도'},
    {'id':'LG-EASY-500','provider_id':'LGU+','kind':'mobile','name':'참 쉬운 가족결합 · 500M 9,900원 할인','minimum_speed_mbps':500,'maximum_speed_mbps':999,'discount':9900,'source_order':31,'notes':'인터넷 요금 9,900원 할인 · 휴대폰 회선별 할인은 별도'},
    {'id':'LG-EASY-1G','provider_id':'LGU+','kind':'mobile','name':'참 쉬운 가족결합 · 1G 13,200원 할인','minimum_speed_mbps':1000,'maximum_speed_mbps':1000,'discount':13200,'source_order':32,'notes':'인터넷 요금 13,200원 할인 · 휴대폰 회선별 할인은 별도'},
    {'id':'LG-TOGETHER-500M','provider_id':'LGU+','kind':'mobile','name':'U+ 투게더 · 500M 이상 11,000원 할인','minimum_speed_mbps':500,'discount':11000,'source_order':33,'notes':'500M 이상 인터넷 월 11,000원 할인 · 휴대폰 요금 할인은 결합 인원에 따라 별도'},
]

hello_tv_ids = [tv['id'] for tv in data.get('tv_products', []) if tv.get('provider_id') == 'LGHELLO' and ('UHD 뉴베이직' in tv.get('name','') or 'UHD 뉴프리미엄' in tv.get('name',''))]
if hello_tv_ids:
    rules.append({'id':'HELLO-MOBILE-TV','provider_id':'LGHELLO','kind':'mobile','name':'헬로모바일+헬로TV · TV 2,200원 할인','discount':2200,'requires_tv':True,'tv_product_ids':hello_tv_ids,'source_order':40,'notes':'UHD 뉴베이직/뉴프리미엄 + 헬로모바일 기본료 11,000원 이상 요금제 결합 시 TV 수신료 2,200원 할인'})

rules.append({'id':'SKYLIFE-MOBILE-CHECK','provider_id':'SKYLIFE','kind':'mobile','name':'스카이라이프 모바일 결합 · 할인금액 상담 확인','discount':None,'requires_tv':True,'source_order':50,'notes':'모바일 요금제·회선과 TV 상품에 따라 혜택이 달라 최종 할인금액은 매장에서 확인'})

data['bundle_rules'] = rules
data.setdefault('meta', {})['updated_at'] = '2026-09-16'
data['meta']['tv_info_note'] = 'TV 채널수는 각 사업자 공개 안내를 바탕으로 표시하며 편성 변경 시 달라질 수 있다.'
data['meta']['mobile_bundle_note'] = '인터넷/TV 청구서에 직접 적용되는 확인 가능한 할인만 자동 계산하며 휴대폰 청구 할인은 별도 안내한다.'

data_path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# ---------- HTML ----------
old = '<label>TV 상품<select id="tv-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>\n              <div class="field-row two">'
new = '<label>TV 상품<select id="tv-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>\n              <div id="tv-product-info" class="tv-product-info">TV 상품을 선택하면 채널수와 기본 특징을 보여드립니다.</div>\n              <div class="field-row two">'
if old not in html:
    raise SystemExit('TV selector marker not found')
html = html.replace(old, new, 1)
old_help = '<small class="field-help">선택한 인터넷 상품에서 적용 가능한 결합만 표시합니다.</small>'
new_help = '<small class="field-help">선택한 인터넷·TV 조건에서 적용 가능한 결합만 표시합니다. 모바일 결합은 인터넷/TV 청구 할인만 월 납부액에 반영하며 휴대폰 요금 할인은 별도입니다.</small>'
if old_help not in html:
    raise SystemExit('Internet bundle help marker not found')
html = html.replace(old_help, new_help, 1)
html = html.replace('assets/rates.css?v=20260916-2', 'assets/rates.css?v=20260916-3')
html = html.replace('assets/rates.js?v=20260916-2', 'assets/rates.js?v=20260916-3')
html_path.write_text(html, encoding='utf-8')

# ---------- JavaScript ----------
old_tv_options = "      tvProducts().filter(p=>p.provider_id===pid).sort(byOrder).forEach(p=>option(tvProduct,p.id,p.name));"
new_tv_options = "      tvProducts().filter(p=>p.provider_id===pid).sort(byOrder).forEach(p=>option(tvProduct,p.id,p.channel_label?`${p.name} · ${p.channel_label}`:p.name));"
if old_tv_options not in js:
    raise SystemExit('TV options marker not found')
js = js.replace(old_tv_options, new_tv_options, 1)

old_eligible = """      (!Number(r.maximum_speed_mbps)||Number(product.speed_mbps)<=Number(r.maximum_speed_mbps))\n    ).sort(byOrder);"""
new_eligible = """      (!Number(r.maximum_speed_mbps)||Number(product.speed_mbps)<=Number(r.maximum_speed_mbps))&&\n      (!r.requires_tv||!!currentTvProduct())&&\n      (!Array.isArray(r.tv_product_ids)||!r.tv_product_ids.length||r.tv_product_ids.includes(currentTvProduct()?.id))\n    ).sort(byOrder);"""
if old_eligible not in js:
    raise SystemExit('eligible bundle marker not found')
js = js.replace(old_eligible, new_eligible, 1)

marker = "  function selectedRule(select){return (internetData.bundle_rules||[]).find(r=>r.id===select.value)||null}\n"
helper = r'''  function ruleDiscount(rule,tv){
    if(!rule)return {known:true,amount:0};
    if(!hasAmount(rule.discount))return {known:false,amount:0};
    let amount=Number(rule.discount)||0;
    if(tv&&hasAmount(rule.tv_extra_discount))amount+=Number(rule.tv_extra_discount)||0;
    return {known:true,amount};
  }
  function syncTvProductInfo(){
    const box=$('tv-product-info'),tv=currentTvProduct();if(!box)return;
    if(!tv){box.innerHTML='TV 상품을 선택하면 채널수와 기본 특징을 보여드립니다.';return}
    const channel=tv.channel_label?`<b>${tv.channel_label} 채널</b>`:'<b>채널수 상담 확인</b>';
    box.innerHTML=`<span>${channel}<strong>${tv.name}</strong></span><p>${tv.description||'상품별 채널 구성과 혜택은 상담 시 확인해 주세요.'}</p><small>${tv.channel_note||'채널 편성은 시점에 따라 변경될 수 있습니다.'}</small>`;
  }
'''
if marker not in js:
    raise SystemExit('selectedRule marker not found')
js = js.replace(marker, marker + helper, 1)

old_discount = """    const wiredRule=selectedRule(wiredBundle),mobileRule=selectedRule(mobileBundle);\n    const wiredKnown=!wiredRule||hasAmount(wiredRule.discount),mobileKnown=!mobileRule||hasAmount(mobileRule.discount);\n    const extraWiredDiscount=wiredRule&&wiredKnown?Number(wiredRule.discount):0,mobileDiscount=mobileRule&&mobileKnown?Number(mobileRule.discount):0;\n    const wiredDiscount=autoWiredDiscount+extraWiredDiscount;"""
new_discount = """    const wiredRule=selectedRule(wiredBundle),mobileRule=selectedRule(mobileBundle);\n    const wiredCalc=ruleDiscount(wiredRule,tv),mobileCalc=ruleDiscount(mobileRule,tv);\n    const wiredKnown=wiredCalc.known,mobileKnown=mobileCalc.known;\n    const extraWiredDiscount=wiredCalc.amount,mobileDiscount=mobileCalc.amount;\n    const wiredDiscount=autoWiredDiscount+extraWiredDiscount;"""
if old_discount not in js:
    raise SystemExit('bundle discount calculation marker not found')
js = js.replace(old_discount, new_discount, 1)

# Show TV info whenever Internet calculation refreshes.
old_sync = "  function syncInternet(){\n    const p=currentInternetProduct(),tv=currentTvProduct(),provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value)||null;"
new_sync = "  function syncInternet(){\n    syncTvProductInfo();\n    const p=currentInternetProduct(),tv=currentTvProduct(),provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value)||null;"
if old_sync not in js:
    raise SystemExit('syncInternet marker not found')
js = js.replace(old_sync, new_sync, 1)

# Better mobile-discount result wording for an unknown verified condition.
old_mobile_result = "$('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?'-'+won(mobileDiscount):'매장 확인'):'미적용';"
new_mobile_result = "$('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?(mobileDiscount?'-'+won(mobileDiscount):'미적용'):'매장 확인'):'미적용';"
if old_mobile_result not in js:
    raise SystemExit('mobile result marker not found')
js = js.replace(old_mobile_result, new_mobile_result, 1)

# Bust data caches after Internet data update.
js = js.replace('v=20260915-15', 'v=20260916-1')
js_path.write_text(js, encoding='utf-8')

# ---------- CSS ----------
css_add = r'''

/* Internet / TV information upgrade */
.tv-product-info{padding:13px 14px;border:1px solid #d5e3e5;border-radius:14px;background:#f8fbfb;color:#526970;font-size:.74rem;line-height:1.55}.tv-product-info span{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tv-product-info b{display:inline-flex;padding:4px 7px;border-radius:999px;background:#e4f2ef;color:#0f665f;font-size:.68rem}.tv-product-info strong{color:var(--ink);font-size:.8rem}.tv-product-info p{margin:7px 0 3px;font-size:.74rem!important;line-height:1.55!important;color:#526970!important}.tv-product-info small{display:block;color:#829197;font-size:.65rem}.rate-form #mobile-bundle option{font-size:.86rem}
'''
if '/* Internet / TV information upgrade */' not in css:
    css += css_add
css_path.write_text(css, encoding='utf-8')

print('Updated TV descriptions, mobile bundle rules, Internet UI and calculation logic.')
