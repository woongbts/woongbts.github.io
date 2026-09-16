from pathlib import Path
import json, copy, re

DATA_PATH = Path('data/internet.json')
JS_PATH = Path('assets/rates.js')
HTML_PATH = Path('rates.html')

# These values are transcribed from the user-provided 2026-09-15 wired policy sheets.
POLICY_DATE = '2026-09-15'

data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
js = JS_PATH.read_text(encoding='utf-8')
html = HTML_PATH.read_text(encoding='utf-8')

# 1) Add SK Telecom as a separate wired provider.
providers = data.setdefault('providers', [])
if not any(p.get('id') == 'SKT' for p in providers):
    providers.append({'id': 'SKT', 'name': 'SK텔레콤', 'source_order': 2})
order = {'SKB': 1, 'SKT': 2, 'KT': 3, 'LGU+': 4, 'LGHELLO': 5, 'SKYLIFE': 6}
for p in providers:
    if p.get('id') in order:
        p['source_order'] = order[p['id']]

internet_products = data.setdefault('internet_products', [])
# Verified SKT Wi-Fi-inclusive prices from the supplied SK Telecom policy sheet.
skt_internet = [
    {'id':'INT-SKT-WIFI-100M','provider_id':'SKT','name':'WIFI 인터넷','product_key':'SKT_WIFI_100M','product_group':'WIFI','speed_mbps':100,'monthly_fee':23100,'source_order':1},
    {'id':'INT-SKT-WIFI-500M','provider_id':'SKT','name':'WIFI 인터넷','product_key':'SKT_WIFI_500M','product_group':'WIFI','speed_mbps':500,'monthly_fee':34100,'source_order':2},
    {'id':'INT-SKT-WIFI-1G','provider_id':'SKT','name':'WIFI 인터넷','product_key':'SKT_WIFI_1G','product_group':'WIFI','speed_mbps':1000,'monthly_fee':39600,'source_order':3},
]
for row in skt_internet:
    if not any(x.get('id') == row['id'] for x in internet_products):
        internet_products.append(row)

# Clone the matching B tv tiers from SK Broadband so pricing/set-top behavior stays consistent,
# then apply SKT's channel counts from the supplied policy sheet.
tv_products = data.setdefault('tv_products', [])
skb_tvs = [x for x in tv_products if x.get('provider_id') == 'SKB']
channel_map = {
    '이코노미': ('182개', '기본 채널 중심의 B tv 실속형 상품입니다.'),
    '스탠다드': ('235개', '영화·예능·교양 등 주요 채널을 폭넓게 제공하는 B tv 상품입니다.'),
    'ALL': ('255개', 'B tv의 다양한 채널을 폭넓게 이용하는 상위 상품입니다.'),
}
tv_id_map = {}
for keyword, (channels, desc) in channel_map.items():
    src = next((x for x in skb_tvs if keyword.lower() in str(x.get('name','')).lower()), None)
    if not src:
        raise SystemExit(f'SKB TV source not found for {keyword}; aborting')
    new_id = str(src.get('id')).replace('SKB', 'SKT')
    if new_id == src.get('id'):
        new_id = f"TV-SKT-{re.sub(r'[^A-Za-z0-9]+','-',keyword).strip('-').upper()}"
    tv_id_map[src['id']] = new_id
    if not any(x.get('id') == new_id for x in tv_products):
        row = copy.deepcopy(src)
        row['id'] = new_id
        row['provider_id'] = 'SKT'
        row['channel_label'] = channels
        row['description'] = desc
        row['channel_note'] = '채널 편성은 시점에 따라 변경될 수 있습니다.'
        tv_products.append(row)

# Clone Smart3 set-top rows for SKT and remap linked TV ids.
settop_products = data.setdefault('settop_products', [])
skb_settops = [x for x in settop_products if x.get('provider_id') == 'SKB' and '스마트3' in str(x.get('name',''))]
if not skb_settops:
    raise SystemExit('SKB Smart3 set-top source not found; aborting')
for src in skb_settops:
    linked = src.get('tv_product_id')
    # If source is TV-specific, only clone rows that map to one of the three SKT TV tiers.
    if linked and linked not in tv_id_map:
        continue
    row = copy.deepcopy(src)
    row['id'] = str(src.get('id')).replace('SKB','SKT')
    if row['id'] == src.get('id'):
        row['id'] = f"STB-SKT-{len([x for x in settop_products if x.get('provider_id')=='SKT'])+1}"
    row['provider_id'] = 'SKT'
    if linked:
        row['tv_product_id'] = tv_id_map[linked]
    if not any(x.get('id') == row['id'] for x in settop_products):
        settop_products.append(row)

# Reuse the already-verified SK Broadband mobile/wired bundle rule structure for SKT,
# remapping only rules that can apply to the verified 100M/500M/1G SKT products.
bundle_rules = data.setdefault('bundle_rules', [])
internet_id_map = {
    'INT-SKB-INTERNET_100M_WIFI_GIGA': 'INT-SKT-WIFI-100M',
    'INT-SKB-INTERNET_500M_WIFI_GIGA': 'INT-SKT-WIFI-500M',
    'INT-SKB-INTERNET_GIGA_WIFI_GIGA': 'INT-SKT-WIFI-1G',
}
existing_skt_rules = {r.get('id') for r in bundle_rules if r.get('provider_id') == 'SKT'}
for src in [r for r in bundle_rules if r.get('provider_id') == 'SKB']:
    row = copy.deepcopy(src)
    old_ids = row.get('product_ids')
    if isinstance(old_ids, list) and old_ids:
        mapped = [internet_id_map[x] for x in old_ids if x in internet_id_map]
        if not mapped:
            continue
        row['product_ids'] = mapped
    row['provider_id'] = 'SKT'
    row['id'] = str(row.get('id','SKB-RULE')).replace('SKB','SKT')
    # Map TV ids when a rule explicitly lists them.
    for key in ('tv_product_ids','eligible_tv_ids'):
        if isinstance(row.get(key), list):
            row[key] = [tv_id_map.get(x, x) for x in row[key] if x in tv_id_map or not str(x).startswith('TV-SKB')]
    if row['id'] not in existing_skt_rules:
        bundle_rules.append(row)
        existing_skt_rules.add(row['id'])

# 2) Customer gift maximum rules (cash + gift certificate), based on the 'guide maximum' in supplied sheets.
# Rules are intentionally limited to combinations visible in the provided policy tables; other combinations show store confirmation.
gift_rules = []
def add(provider, speed, tv_mode, amount, *, keywords=None, scope='일반정책'):
    gift_rules.append({
        'provider_id': provider,
        'speed_mbps': speed,
        'tv_mode': tv_mode,
        'tv_keywords': keywords or [],
        'max_gift_won': amount,
        'source_date': POLICY_DATE,
        'scope': scope,
    })

# SK Broadband: general table + Busan retail maximum for Standard/ALL at 500M/1G.
add('SKB',100,'none',100000)
add('SKB',100,'any',290000)
add('SKB',500,'none',170000)
add('SKB',500,'specific',470000,keywords=['스탠다드','ALL'],scope='부산 소매정책')
add('SKB',500,'any',370000)
add('SKB',1000,'none',170000)
add('SKB',1000,'specific',470000,keywords=['스탠다드','ALL'],scope='부산 소매정책')
add('SKB',1000,'any',370000)

# SK Telecom.
for speed, solo, bundle in [(100,110000,400000),(500,170000,430000),(1000,170000,520000)]:
    add('SKT',speed,'none',solo)
    add('SKT',speed,'any',bundle)

# KT (same maxima apply to the family rows shown on the supplied sheet).
for speed, solo, bundle in [(100,90000,370000),(500,140000,450000),(1000,140000,450000)]:
    add('KT',speed,'none',solo)
    add('KT',speed,'any',bundle)

# LG U+ general policy.
for speed, solo, bundle in [(100,200000,330000),(500,170000,470000),(1000,170000,470000)]:
    add('LGU+',speed,'none',solo)
    add('LGU+',speed,'any',bundle)

# LG HelloVision. The low-cost '알뜰형+HD' follows the internet-only guide maximum; other listed TV tiers use the higher TV maximum.
hello_other = ['이코노미','뉴베이직','뉴프리미엄','IPTV Pro라이트','IPTV Pro맥스']
for speed, solo, other in [(100,130000,300000),(160,130000,300000),(500,180000,350000),(1000,200000,400000)]:
    add('LGHELLO',speed,'none',solo)
    add('LGHELLO',speed,'specific',solo,keywords=['알뜰형'])
    add('LGHELLO',speed,'specific',other,keywords=hello_other)

# KT Skylife general bundle policy.
for speed, solo, bundle in [(100,100000,350000),(200,120000,360000),(500,140000,420000),(1000,150000,480000)]:
    add('SKYLIFE',speed,'none',solo)
    add('SKYLIFE',speed,'any',bundle)

data['gift_rules'] = gift_rules
meta = data.setdefault('meta', {})
meta['gift_policy_updated_at'] = POLICY_DATE
meta['gift_policy_note'] = '고객 사은품은 제공된 2026-09-15 유선 정책표의 경품가이드 최대(현금+상품권 합산) 기준이며 실제 지급액은 상품/지역/가입조건 및 정책 변동에 따라 달라질 수 있다.'

# 3) JS: gift data support + SKT combo behavior + display.
old_init = "let internetData={providers:[],internet_products:[],tv_products:[],settop_products:[],bundle_rules:[]};"
new_init = "let internetData={providers:[],internet_products:[],tv_products:[],settop_products:[],bundle_rules:[],gift_rules:[]};"
if old_init not in js:
    raise SystemExit('internetData init anchor not found')
js = js.replace(old_init, new_init, 1)

old_combo = "    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},\n    KT:"
new_combo = "    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},\n    SKT:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},\n    KT:"
if old_combo not in js:
    raise SystemExit('WIRED_COMBO_DEFAULTS anchor not found')
js = js.replace(old_combo, new_combo, 1)

old_combo_line = "    const combo=tvSelected?WIRED_COMBO_DEFAULTS[p.provider_id]:null;"
new_combo_line = "    const comboBase=tvSelected?WIRED_COMBO_DEFAULTS[p.provider_id]:null;\n    const combo=comboBase&&p.provider_id==='SKT'?{...comboBase,internetDiscount:Number(p.speed_mbps)>=500?5500:1100}:comboBase;"
if old_combo_line not in js:
    raise SystemExit('combo line anchor not found')
js = js.replace(old_combo_line, new_combo_line, 1)

# Insert gift helpers before syncInternet.
anchor = "  function syncInternet(){\n"
if anchor not in js:
    raise SystemExit('syncInternet anchor not found')
helpers = """  function customerGiftRule(product,tv){
    if(!product)return null;
    const rules=(internetData.gift_rules||[]).filter(r=>r.provider_id===product.provider_id&&Number(r.speed_mbps)===Number(product.speed_mbps));
    const tvSelected=tvProduct.value!=='none';
    if(!tvSelected)return rules.find(r=>r.tv_mode==='none')||null;
    const name=String(tv?.name||'').toLowerCase();
    const specific=rules.find(r=>r.tv_mode==='specific'&&Array.isArray(r.tv_keywords)&&r.tv_keywords.some(k=>name.includes(String(k).toLowerCase())));
    return specific||rules.find(r=>r.tv_mode==='any')||null;
  }
  function customerGiftText(rule){
    if(!rule||!hasAmount(rule.max_gift_won))return '매장 확인';
    const man=Number(rule.max_gift_won)/10000;
    return `최대 ${Number.isInteger(man)?man:man.toFixed(1)}만원`;
  }
"""
js = js.replace(anchor, helpers + anchor, 1)

old_reset = "      ['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-wired-discount','internet-result-mobile-discount'].forEach(id=>$(id).textContent='—');"
new_reset = "      ['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-wired-discount','internet-result-mobile-discount','internet-customer-gift'].forEach(id=>$(id).textContent='—');"
if old_reset not in js:
    raise SystemExit('internet reset anchor not found')
js = js.replace(old_reset, new_reset, 1)

old_result = "    $('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?(mobileDiscount?'-'+won(mobileDiscount):'미적용'):'매장 확인'):'미적용';\n\n    const bits=[]"
new_result = "    $('internet-result-mobile-discount').textContent=mobileRule?(mobileKnown?(mobileDiscount?'-'+won(mobileDiscount):'미적용'):'매장 확인'):'미적용';\n    const giftRule=customerGiftRule(p,tvSelected?tv:null);\n    $('internet-customer-gift').textContent=customerGiftText(giftRule);\n\n    const bits=[]"
if old_result not in js:
    raise SystemExit('internet result gift anchor not found')
js = js.replace(old_result, new_result, 1)

# 4) HTML: add customer gift row and clarify policy basis.
old_row = '                <div><span>모바일 결합 할인</span><b id="internet-result-mobile-discount">—</b></div>\n'
new_row = old_row + '                <div><span>고객 사은품 (현금+상품권)</span><b id="internet-customer-gift">—</b></div>\n'
if old_row not in html:
    raise SystemExit('internet result row anchor not found')
html = html.replace(old_row, new_row, 1)

old_warning = '표시 금액은 등록된 3년 약정 기준입니다. 셋톱박스·공유기·추가 회선·프로모션 등 최종 가입 조건에 따라 실제 청구액은 달라질 수 있습니다.'
new_warning = '표시 금액은 등록된 3년 약정 기준입니다. 고객 사은품은 2026-09-15 정책표의 경품가이드 최대(현금+상품권 합산) 기준이며, 상품·지역·가입조건 및 정책 변동에 따라 실제 지급액과 청구액은 달라질 수 있습니다.'
if old_warning not in html:
    raise SystemExit('internet warning anchor not found')
html = html.replace(old_warning, new_warning, 1)

html, count = re.subn(r'assets/rates\\.js\\?v=[^"\\s]+', 'assets/rates.js?v=20260916-6', html, count=1)
if count != 1:
    raise SystemExit('rates.js cache-buster anchor not found')

DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
JS_PATH.write_text(js, encoding='utf-8')
HTML_PATH.write_text(html, encoding='utf-8')

print('SKT provider added:', any(p.get('id')=='SKT' for p in providers))
print('SKT internet products:', len([x for x in internet_products if x.get('provider_id')=='SKT']))
print('SKT TV products:', len([x for x in tv_products if x.get('provider_id')=='SKT']))
print('SKT set-top products:', len([x for x in settop_products if x.get('provider_id')=='SKT']))
print('Gift rules:', len(gift_rules))
