from pathlib import Path
import json, re

repo = Path('.')
data_path = repo / 'data/internet.json'
js_path = repo / 'assets/rates.js'
html_path = repo / 'rates.html'

data = json.loads(data_path.read_text(encoding='utf-8'))
js = js_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')

# -----------------------------------------------------------------------------
# 1) Add SK Telecom as a separate wired provider.
# Only customer-facing product/rate data is stored; no internal policy breakdown.
# -----------------------------------------------------------------------------
provider_order = {'SKB': 1, 'SKTNET': 2, 'KT': 3, 'LGU+': 4, 'LGHELLO': 5, 'SKYLIFE': 6}
providers = [p for p in data.get('providers', []) if p.get('id') != 'SKTNET']
providers.append({'id': 'SKTNET', 'name': 'SK텔레콤', 'source_order': 2})
for p in providers:
    if p.get('id') in provider_order:
        p['source_order'] = provider_order[p['id']]
data['providers'] = sorted(providers, key=lambda x: x.get('source_order', 999))

for key in ('internet_products', 'tv_products', 'settop_products', 'bundle_rules'):
    data[key] = [x for x in data.get(key, []) if x.get('provider_id') != 'SKTNET']

data['internet_products'].extend([
    {'id':'INT-SKTNET-100-WIFI','provider_id':'SKTNET','name':'SKT 인터넷 와이파이','product_key':'SKTNET_100_WIFI','product_group':'WIFI','speed_mbps':100,'monthly_fee':23100,'source_order':1},
    {'id':'INT-SKTNET-500-WIFI','provider_id':'SKTNET','name':'SKT 인터넷 와이파이','product_key':'SKTNET_500_WIFI','product_group':'WIFI','speed_mbps':500,'monthly_fee':34100,'source_order':2},
    {'id':'INT-SKTNET-1G-WIFI','provider_id':'SKTNET','name':'SKT 인터넷 와이파이','product_key':'SKTNET_1G_WIFI','product_group':'WIFI','speed_mbps':1000,'monthly_fee':39600,'source_order':3},
])

data['tv_products'].extend([
    {'id':'TV-SKTNET-ECO','provider_id':'SKTNET','name':'B tv 이코노미','product_key':'SKTNET_TV_ECO','product_group':'BTV','monthly_fee':12100,'source_order':1,'channel_label':'182개','description':'드라마·예능 중심의 기본 채널을 경제적으로 이용하는 실속형 상품','channel_note':'채널 편성은 시점에 따라 변경될 수 있습니다.'},
    {'id':'TV-SKTNET-STD','provider_id':'SKTNET','name':'B tv 스탠다드','product_key':'SKTNET_TV_STD','product_group':'BTV','monthly_fee':15400,'source_order':2,'channel_label':'235개','description':'드라마·예능부터 스포츠 등 인기 채널을 폭넓게 제공하는 상품','channel_note':'채널 편성은 시점에 따라 변경될 수 있습니다.'},
    {'id':'TV-SKTNET-ALL','provider_id':'SKTNET','name':'B tv ALL','product_key':'SKTNET_TV_ALL','product_group':'BTV','monthly_fee':18700,'source_order':3,'channel_label':'255개','description':'B tv의 주요 채널을 폭넓게 제공하는 상위 상품','channel_note':'채널 편성은 시점에 따라 변경될 수 있습니다.'},
])

for tv_id in ('TV-SKTNET-ECO','TV-SKTNET-STD','TV-SKTNET-ALL'):
    data['settop_products'].append({
        'id':f'STB-{tv_id}-SMART3','provider_id':'SKTNET','tv_product_id':tv_id,
        'name':'스마트3 셋톱','product_key':'SETTOP_SMART3','monthly_fee':4400,'source_order':1
    })

# SKT mobile bundle discounts are customer bill discounts; these are safe to expose.
data['bundle_rules'].extend([
    {'id':'SKTNET-YGF-100','provider_id':'SKTNET','kind':'mobile','name':'요즘가족결합 · 100M 인터넷 4,400원 할인','minimum_speed_mbps':1,'maximum_speed_mbps':100,'discount':4400,'tv_extra_discount':1100,'source_order':13,'notes':'인터넷 요금 4,400원 할인 · TV 함께 결합 시 TV 요금 1,100원 추가 할인 · 휴대폰 요금 할인은 별도'},
    {'id':'SKTNET-YGF-500','provider_id':'SKTNET','kind':'mobile','name':'요즘가족결합 · 500M 인터넷 11,000원 할인','minimum_speed_mbps':500,'maximum_speed_mbps':999,'discount':11000,'tv_extra_discount':1100,'source_order':14,'notes':'인터넷 요금 11,000원 할인 · TV 함께 결합 시 TV 요금 1,100원 추가 할인 · 휴대폰 요금 할인은 별도'},
    {'id':'SKTNET-YGF-1G','provider_id':'SKTNET','kind':'mobile','name':'요즘가족결합 · 1G 이상 13,200원 할인','minimum_speed_mbps':1000,'discount':13200,'tv_extra_discount':1100,'source_order':15,'notes':'인터넷 요금 13,200원 할인 · TV 함께 결합 시 TV 요금 1,100원 추가 할인 · 휴대폰 요금 할인은 별도'},
])

data.setdefault('meta', {})['updated_at'] = '2026-09-16'
data['meta']['note'] = '인터넷, TV, 셋톱박스를 별도 상품군으로 관리하며 확인된 월요금을 자동 계산한다.'

data_path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# -----------------------------------------------------------------------------
# 2) Customer-facing maximum gift lookup.
# This intentionally contains ONLY the final maximum customer gift amount.
# No cash/gift-certificate split, payout, source table, or internal policy detail.
# Values are in 만원 and are shown only for exact combinations verified in the
# supplied 2026-09-15 tables. Unmatched combinations remain '매장 확인'.
# -----------------------------------------------------------------------------
old_combo = """  const WIRED_COMBO_DEFAULTS={\n    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},\n    KT:{settopNames:['기가지니3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2640},\n    'LGU+':{settopNames:['4K UHD4','UHD4'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200}\n  };\n"""
new_combo = """  const WIRED_COMBO_DEFAULTS={\n    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},\n    SKTNET:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscountBySpeed:{100:2200,500:6600,1000:6600},tvDiscount:1100},\n    KT:{settopNames:['기가지니3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2640},\n    'LGU+':{settopNames:['4K UHD4','UHD4'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200}\n  };\n\n  const CUSTOMER_GIFT_MAX={\n    SKB:{\n      groups:['BASIC','WIFI','WINGS'],\n      none:{100:30,500:40,1000:40},\n      tv:{\n        TV_BASIC_NEW:{100:57,500:66,1000:66},\n        TV_SMART_PLUS:{100:68,500:80,1000:80},\n        TV_ALL:{100:72,500:84,1000:84},\n        SKB_TV_POP180:{100:51,500:55,1000:55}\n      }\n    },\n    SKTNET:{\n      groups:['WIFI'],\n      none:{100:18.5,500:33.5,1000:38.5},\n      tv:{\n        SKTNET_TV_ECO:{100:51,500:62,1000:67},\n        SKTNET_TV_STD:{100:64,500:77,1000:82},\n        SKTNET_TV_ALL:{100:69,500:82,1000:87}\n      }\n    },\n    KT:{\n      groups:['BASIC','WIFI','WI'],\n      none:{100:28,500:37.5,1000:40},\n      tv:{\n        TV_OTV_BASIC:{100:62,500:72,1000:77},\n        TV_OTV12:{100:63,500:73,1000:78},\n        TV_OTV15:{100:63,500:73,1000:78},\n        TV_OTV_ALLG:{100:76,500:86,1000:90.5}\n      },\n      family:{\n        none:{100:23.5,500:30,1000:32},\n        tv:{\n          TV_OTV_BASIC:{100:55.5,500:62.5,1000:64.5},\n          TV_OTV12:{100:55.5,500:62.5,1000:64.5},\n          TV_OTV15:{100:55.5,500:62.5,1000:64.5},\n          TV_OTV_ALLG:{100:68,500:75.5,1000:77}\n        }\n      }\n    },\n    'LGU+':{\n      groups:['BASIC'],\n      none:{100:36.5,500:46,1000:53},\n      tv:{\n        TV_ECONOMY_PACK:{100:67,500:75,1000:79},\n        TV_BASIC_PACK:{100:67,500:75,1000:79},\n        TV_PREMIUM:{100:70,500:78,1000:82},\n        TV_VOD_PREMIUM:{100:71,500:79,1000:83}\n      }\n    },\n    LGHELLO:{\n      groups:['BASIC'],\n      none:{100:49,160:55,500:60,1000:65},\n      tv:{\n        TV_HD_ECONOMY:{100:50,160:52,500:89,1000:66},\n        TV_UHD_ECONOMY:{100:59,160:72,500:82,1000:87},\n        TV_UHD_NEW_BASIC:{100:64,160:77,500:87,1000:92},\n        TV_UHD_NEWPREMIUM:{100:65,160:77,500:87,1000:92},\n        TV_UHD_PRO_LIGHT:{500:87,1000:92},\n        TV_UHD_PRO_MAX:{500:88,1000:93}\n      }\n    },\n    SKYLIFE:{\n      groups:['BASIC'],\n      none:{100:31,200:33,500:37,1000:37},\n      tv:{\n        TV_IPIT_BASIC:{100:58,200:65,500:73,1000:75},\n        TV_IPIT_PLUS:{100:60,200:67,500:75,1000:77}\n      }\n    }\n  };\n"""
if old_combo not in js:
    raise SystemExit('WIRED_COMBO_DEFAULTS anchor not found')
js = js.replace(old_combo, new_combo, 1)

# Insert gift helpers immediately before fillInternetProducts().
anchor = """  function fillInternetProducts(){\n"""
helpers = """  function customerGiftMax(p,tv){\n    if(!p)return null;\n    const cfg=CUSTOMER_GIFT_MAX[p.provider_id];if(!cfg)return null;\n    const speed=Number(p.speed_mbps),group=String(p.product_group||'').toUpperCase();\n    let scope=cfg;\n    if(p.provider_id==='KT'&&group==='FAMILY')scope=cfg.family||null;\n    else if(Array.isArray(cfg.groups)&&!cfg.groups.includes(group))return null;\n    if(!scope)return null;\n    if(!tv)return hasAmount(scope.none?.[speed])?Number(scope.none[speed]):null;\n    const key=String(tv.product_key||'');\n    return hasAmount(scope.tv?.[key]?.[speed])?Number(scope.tv[key][speed]):null;\n  }\n  function customerGiftText(value){\n    return hasAmount(value)?`최대 ${won(Number(value)*10000)}`:'매장 확인';\n  }\n  function comboInternetDiscount(combo,p){\n    if(!combo)return 0;\n    const speed=Number(p?.speed_mbps);\n    if(combo.internetDiscountBySpeed&&hasAmount(combo.internetDiscountBySpeed[speed]))return Number(combo.internetDiscountBySpeed[speed]);\n    return Number(combo.internetDiscount)||0;\n  }\n""" + anchor
if anchor not in js:
    raise SystemExit('fillInternetProducts anchor not found')
js = js.replace(anchor, helpers, 1)

# Speed-specific SKT wired combo calculation.
old_line = "    const autoInternetDiscount=combo&&internetKnown?Math.min(internetFee,Number(combo.internetDiscount)||0):0;\n"
new_line = "    const autoInternetDiscount=combo&&internetKnown?Math.min(internetFee,comboInternetDiscount(combo,p)):0;\n"
if old_line not in js:
    raise SystemExit('autoInternetDiscount anchor not found')
js = js.replace(old_line, new_line, 1)

# Reset customer gift when no product.
reset_anchor = "      ['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-wired-discount','internet-result-mobile-discount'].forEach(id=>$(id).textContent='—');\n"
if reset_anchor not in js:
    raise SystemExit('internet reset anchor not found')
js = js.replace(reset_anchor, reset_anchor + "      $('internet-customer-gift').textContent='—';\n", 1)

# Render customer gift after monthly result discounts.
render_anchor = "    $('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?(mobileDiscount?'-'+won(mobileDiscount):'미적용'):'매장 확인'):'미적용';\n"
if render_anchor not in js:
    raise SystemExit('internet mobile discount render anchor not found')
render_insert = render_anchor + "    const giftMax=customerGiftMax(p,tvSelected?tv:null);\n    $('internet-customer-gift').textContent=customerGiftText(giftMax);\n"
js = js.replace(render_anchor, render_insert, 1)

# -----------------------------------------------------------------------------
# 3) Add one customer-facing result row. Never expose internal policy wording.
# -----------------------------------------------------------------------------
html_anchor = '                <div><span>모바일 결합 할인</span><b id="internet-result-mobile-discount">—</b></div>\n'
if html_anchor not in html:
    raise SystemExit('internet result HTML anchor not found')
html_insert = html_anchor + '                <div><span>고객사은품</span><b id="internet-customer-gift">—</b></div>\n'
html = html.replace(html_anchor, html_insert, 1)

warning_anchor = '              <p id="internet-summary">통신사와 상품을 선택하면 자동으로 반영됩니다.</p>\n'
if warning_anchor not in html:
    raise SystemExit('internet summary anchor not found')
html = html.replace(warning_anchor, warning_anchor + '              <div class="data-note">고객사은품은 선택 상품 기준 최대 금액이며 지역·설치 조건 등에 따라 달라질 수 있어 최종 상담 시 확인됩니다.</div>\n', 1)

html, count = re.subn(r'assets/rates\.js\?v=[^"\\s]+', 'assets/rates.js?v=20260916-6', html, count=1)
if count != 1:
    raise SystemExit('rates.js cache-buster not found')

js_path.write_text(js, encoding='utf-8')
html_path.write_text(html, encoding='utf-8')
print('Added SK Telecom wired products and customer-facing maximum gifts without internal policy details.')
