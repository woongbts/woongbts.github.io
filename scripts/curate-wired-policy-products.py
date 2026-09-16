from pathlib import Path
import json

ROOT = Path('.')
DATA = ROOT / 'data/internet.json'
JS = ROOT / 'assets/rates.js'
HTML = ROOT / 'rates.html'

data = json.loads(DATA.read_text(encoding='utf-8'))
js = JS.read_text(encoding='utf-8')
html = HTML.read_text(encoding='utf-8')

# Customer-facing wired products are intentionally limited to combinations
# confirmed in the supplied 2026-09-15 reference tables. Internal policy
# breakdowns are not stored here; only customer-visible product/rate metadata
# and final maximum gift amounts are used.

internet_by_id = {x['id']: x for x in data.get('internet_products', [])}
tv_by_id = {x['id']: x for x in data.get('tv_products', [])}


def keep_internet(pid, **overrides):
    if pid not in internet_by_id:
        raise SystemExit(f'missing internet product: {pid}')
    row = dict(internet_by_id[pid])
    row.update(overrides)
    return row


def keep_tv(pid, **overrides):
    if pid not in tv_by_id:
        raise SystemExit(f'missing tv product: {pid}')
    row = dict(tv_by_id[pid])
    row.update(overrides)
    return row

# -----------------------------------------------------------------------------
# 1) Internet products: only products represented in the supplied tables.
# -----------------------------------------------------------------------------
curated_internet = [
    # SK Broadband
    keep_internet('INT-SKB-INTERNET_100M_WIFI_GIGA', product_group='WIFI', source_order=1),
    keep_internet('INT-SKB-INTERNET_500M_WIFI_GIGA', product_group='WIFI', source_order=2),
    keep_internet('INT-SKB-INTERNET_GIGA_WIFI_GIGA', product_group='WIFI', source_order=3),

    # SK Telecom (already curated previously)
    keep_internet('INT-SKTNET-100-WIFI', product_group='WIFI', source_order=1),
    keep_internet('INT-SKTNET-500-WIFI', product_group='WIFI', source_order=2),
    keep_internet('INT-SKTNET-1G-WIFI', product_group='WIFI', source_order=3),

    # KT general Wi-Fi
    keep_internet('INT-KT-INTERNET_100M_PLUS', product_group='WIFI', source_order=1),
    keep_internet('INT-KT-INTERNET_500M_PLUS', product_group='WIFI', source_order=2),
    keep_internet('INT-KT-INTERNET_GIGA_PLUS', product_group='WIFI', source_order=3),
    # KT family Wi-Fi
    keep_internet('INT-KT-INTERNET_100M_FAM_PLUS', product_group='FAMILY', source_order=4),
    keep_internet('INT-KT-INTERNET_500M_FAM_PLUS', product_group='FAMILY', source_order=5),
    keep_internet('INT-KT-INTERNET_GIGA_FAM_PLUS', product_group='FAMILY', source_order=6),

    # LG U+
    keep_internet('INT-LGU+-INTERNET_100M', product_group='BASIC', source_order=1),
    keep_internet('INT-LGU+-INTERNET_500M_S', product_group='BASIC', source_order=2),
    keep_internet('INT-LGU+-INTERNET_GIGA_S', product_group='BASIC', source_order=3),

    # LG HelloVision
    keep_internet('INT-LGHELLO-INTERNET_100M_LITE_PLUS', product_group='BASIC', source_order=1),
    keep_internet('INT-LGHELLO-INTERNET_100M', product_group='BASIC', source_order=2),
    keep_internet('INT-LGHELLO-INTERNET_GIGA_LITE', product_group='BASIC', source_order=3),
    keep_internet('INT-LGHELLO-INTERNET_GIGA_P', product_group='BASIC', source_order=4),

    # Skylife general bundle / standalone
    keep_internet('INT-SKYLIFE-INTERNET_100M_REGULAR', name='sky WiFi 100M · 일반', product_group='BASIC', source_order=1),
    keep_internet('INT-SKYLIFE-INTERNET_GIGA_200M_REGULAR', name='sky WiFi 200M · 일반', product_group='BASIC', source_order=2),
    keep_internet('INT-SKYLIFE-INTERNET_GIGA_500M', name='sky WiFi 500M · 일반', product_group='BASIC', source_order=3),
    keep_internet('INT-SKYLIFE-INTERNET_GIGA_1G', name='sky WiFi 1G · 일반', product_group='BASIC', source_order=4),
    # Skylife 30% bundle choices shown separately because the gift table differs.
    keep_internet('INT-SKYLIFE-INTERNET_100M', name='sky WiFi 100M · 30% 번들', product_group='BUNDLE30', source_order=5),
    keep_internet('INT-SKYLIFE-INTERNET_GIGA_200M', name='sky WiFi 200M · 30% 번들', product_group='BUNDLE30', source_order=6),
]

data['internet_products'] = curated_internet

# -----------------------------------------------------------------------------
# 2) TV products: only TV rows represented in the supplied tables.
# Channel counts are aligned to those tables.
# -----------------------------------------------------------------------------
curated_tv = [
    # SK Broadband
    keep_tv('TV-SKB-TV_BASIC_NEW', name='B tv 이코노미', channel_label='182개', source_order=1),
    keep_tv('TV-SKB-TV_SMART_PLUS', name='B tv 스탠다드', channel_label='235개', source_order=2),
    keep_tv('TV-SKB-TV_ALL', name='B tv ALL', channel_label='255개', source_order=3),
    keep_tv('TV-SKB-SKB_TV_POP180', name='B tv pop 180', channel_label='184개', source_order=4),

    # SK Telecom
    keep_tv('TV-SKTNET-ECO', channel_label='182개', source_order=1),
    keep_tv('TV-SKTNET-STD', channel_label='235개', source_order=2),
    keep_tv('TV-SKTNET-ALL', channel_label='255개', source_order=3),

    # KT
    keep_tv('TV-KT-TV_OTV_BASIC', name='지니TV 베이직', channel_label='230개', source_order=1),
    keep_tv('TV-KT-TV_OTV12', name='지니TV 라이트', channel_label='240개', source_order=2),
    keep_tv('TV-KT-TV_OTV15', name='지니TV 에센스', channel_label='260개', source_order=3),
    keep_tv('TV-KT-TV_OTV_ALLG', name='지니TV 모든G', channel_label='250개', source_order=4),

    # LG U+
    keep_tv('TV-LGU+-TV_ECONOMY_PACK', name='실속형', channel_label='217개', source_order=1),
    keep_tv('TV-LGU+-TV_BASIC_PACK', name='기본형', channel_label='223개', source_order=2),
    keep_tv('TV-LGU+-TV_PREMIUM', name='프리미엄', channel_label='252개', source_order=3),
    keep_tv('TV-LGU+-TV_VOD_PREMIUM', name='프리미엄 VOD', channel_label='257개', source_order=4),

    # LG HelloVision
    keep_tv('TV-LGHELLO-TV_HD_ECONOMY', name='알뜰형 + HD', channel_label='90개', source_order=1,
            description='필수 채널 위주의 HD 실속형 상품'),
    keep_tv('TV-LGHELLO-TV_UHD_ECONOMY', name='이코노미', channel_label='107개', source_order=2),
    keep_tv('TV-LGHELLO-TV_UHD_NEW_BASIC', name='뉴베이직', channel_label='216개', source_order=3),
    keep_tv('TV-LGHELLO-TV_UHD_NEWPREMIUM', name='뉴프리미엄', channel_label='248개', source_order=4),
    keep_tv('TV-LGHELLO-TV_UHD_PRO_LIGHT', name='IPTV Pro 라이트', channel_label='248개', source_order=5),
    keep_tv('TV-LGHELLO-TV_UHD_PRO_MAX', name='IPTV Pro 맥스', channel_label='248개', source_order=6),

    # Skylife
    keep_tv('TV-SKYLIFE-TV_IPIT_BASIC', name='IPTV 베이직', channel_label='194개', source_order=1),
    keep_tv('TV-SKYLIFE-TV_IPIT_PLUS', name='IPTV 플러스', channel_label='209개', source_order=2),
]

# Add Skylife Choice because it is in the supplied table but was not in the old dataset.
curated_tv.append({
    'id': 'TV-SKYLIFE-TV_IPIT_CHOICE',
    'provider_id': 'SKYLIFE',
    'name': 'IPTV 초이스',
    'product_key': 'TV_IPIT_CHOICE',
    'product_group': '',
    'monthly_fee': None,
    'installation_fee': 0,
    'source_order': 3,
    'channel_label': '209개',
    'description': 'IPTV 플러스 채널 구성에 선택형 부가 혜택을 더한 상품',
    'channel_note': '채널 편성은 지역·시점·사업자 정책에 따라 변경될 수 있습니다.'
})

data['tv_products'] = curated_tv

# -----------------------------------------------------------------------------
# 3) Internal default set-top rows only. The customer does not choose a set-top.
# Keep one policy-table default per TV to make monthly calculations deterministic.
# -----------------------------------------------------------------------------
def stb(tv, provider, name, key, fee, order=1):
    return {
        'id': f'STB-{tv}-{key}', 'provider_id': provider, 'tv_product_id': tv,
        'name': name, 'product_key': key, 'monthly_fee': fee, 'source_order': order
    }

settop = []
for tv in ['TV-SKB-TV_BASIC_NEW','TV-SKB-TV_SMART_PLUS','TV-SKB-TV_ALL','TV-SKB-SKB_TV_POP180']:
    settop.append(stb(tv, 'SKB', '스마트3 셋톱', 'SETTOP_SMART3', 4400))
for tv in ['TV-SKTNET-ECO','TV-SKTNET-STD','TV-SKTNET-ALL']:
    settop.append(stb(tv, 'SKTNET', '스마트3 셋톱', 'SETTOP_SMART3', 4400))
for tv in ['TV-KT-TV_OTV_BASIC','TV-KT-TV_OTV12','TV-KT-TV_OTV15','TV-KT-TV_OTV_ALLG']:
    settop.append(stb(tv, 'KT', '기가지니4', 'SETTOP_GIGAGENIE4', 6600))
for tv in ['TV-LGU+-TV_ECONOMY_PACK','TV-LGU+-TV_BASIC_PACK','TV-LGU+-TV_PREMIUM','TV-LGU+-TV_VOD_PREMIUM']:
    settop.append(stb(tv, 'LGU+', '4K UHD4 셋톱', 'SETTOP_4K_UHD4', 4400))
settop.append(stb('TV-LGHELLO-TV_HD_ECONOMY', 'LGHELLO', 'HD 셋톱', 'SETTOP_HD', 2200))
for tv in ['TV-LGHELLO-TV_UHD_ECONOMY','TV-LGHELLO-TV_UHD_NEW_BASIC','TV-LGHELLO-TV_UHD_NEWPREMIUM','TV-LGHELLO-TV_UHD_PRO_LIGHT','TV-LGHELLO-TV_UHD_PRO_MAX']:
    settop.append(stb(tv, 'LGHELLO', 'UHD 셋톱', 'SETTOP_UHD', 6600))
for tv in ['TV-SKYLIFE-TV_IPIT_BASIC','TV-SKYLIFE-TV_IPIT_PLUS','TV-SKYLIFE-TV_IPIT_CHOICE']:
    settop.append(stb(tv, 'SKYLIFE', '지니TV STB A', 'SETTOP_GINETV_STB_A', 3300))

data['settop_products'] = settop

# Bundle rules can remain only when their provider still exists. Remove rules that
# point at deleted TV IDs.
valid_tv_ids = {x['id'] for x in curated_tv}
valid_providers = {x['id'] for x in data.get('providers', [])}
new_rules = []
for rule in data.get('bundle_rules', []):
    if rule.get('provider_id') not in valid_providers:
        continue
    if 'tv_product_ids' in rule:
        kept = [x for x in rule.get('tv_product_ids', []) if x in valid_tv_ids]
        if not kept:
            continue
        rule = dict(rule)
        rule['tv_product_ids'] = kept
    new_rules.append(rule)
data['bundle_rules'] = new_rules

data.setdefault('meta', {})['updated_at'] = '2026-09-16'
data['meta']['note'] = '고객 선택 상품군을 최신 확인자료의 인터넷·TV 조합에 맞춰 정리하고 최대 고객사은품을 표시한다.'
DATA.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# -----------------------------------------------------------------------------
# 4) Customer-facing maximum gift map. ONLY final maximum gift values are stored.
# No cash/gift-certificate split, commission, guide, or internal policy details.
# Values are in 만원.
# -----------------------------------------------------------------------------
start = js.index('  const CUSTOMER_GIFT_MAX={')
end = js.index('  const byNewest=', start)

gift_block = """  const CUSTOMER_GIFT_MAX={
    SKB:{
      groups:['WIFI'],
      none:{100:30,500:40,1000:40},
      tv:{
        TV_BASIC_NEW:{100:57,500:66,1000:66},
        TV_SMART_PLUS:{100:68,500:80,1000:80},
        TV_ALL:{100:72,500:84,1000:84},
        SKB_TV_POP180:{100:51,500:55,1000:55}
      }
    },
    SKTNET:{
      groups:['WIFI'],
      none:{100:18.5,500:33.5,1000:38.5},
      tv:{
        SKTNET_TV_ECO:{100:51,500:62,1000:67},
        SKTNET_TV_STD:{100:64,500:77,1000:82},
        SKTNET_TV_ALL:{100:69,500:82,1000:87}
      }
    },
    KT:{
      groups:['WIFI'],
      none:{100:28,500:37.5,1000:40},
      tv:{
        TV_OTV_BASIC:{100:62,500:72,1000:77},
        TV_OTV12:{100:63,500:73,1000:78},
        TV_OTV15:{100:63,500:73,1000:78},
        TV_OTV_ALLG:{100:76,500:86,1000:90.5}
      },
      family:{
        none:{100:23.5,500:30,1000:32},
        tv:{
          TV_OTV_BASIC:{100:55.5,500:62.5,1000:64.5},
          TV_OTV12:{100:55.5,500:62.5,1000:64.5},
          TV_OTV15:{100:55.5,500:62.5,1000:64.5},
          TV_OTV_ALLG:{100:68,500:75.5,1000:77}
        }
      }
    },
    'LGU+':{
      groups:['BASIC'],
      none:{100:36.5,500:46,1000:53},
      tv:{
        TV_ECONOMY_PACK:{100:67,500:75,1000:79},
        TV_BASIC_PACK:{100:67,500:75,1000:79},
        TV_PREMIUM:{100:70,500:78,1000:82},
        TV_VOD_PREMIUM:{100:71,500:79,1000:83}
      }
    },
    LGHELLO:{
      groups:['BASIC'],
      none:{100:49,160:55,500:60,1000:65},
      tv:{
        TV_HD_ECONOMY:{100:50,160:54,500:89,1000:66},
        TV_UHD_ECONOMY:{100:59,160:72,500:82,1000:87},
        TV_UHD_NEW_BASIC:{100:64,160:77,500:87,1000:92},
        TV_UHD_NEWPREMIUM:{100:65,160:77,500:87,1000:92},
        TV_UHD_PRO_LIGHT:{160:78,500:87,1000:92},
        TV_UHD_PRO_MAX:{160:78,500:88,1000:93}
      }
    },
    SKYLIFE:{
      groups:['BASIC'],
      none:{100:31,200:33,500:37,1000:37},
      tv:{
        TV_IPIT_BASIC:{100:58,200:65,500:73,1000:75},
        TV_IPIT_PLUS:{100:60,200:67,500:75,1000:77},
        TV_IPIT_CHOICE:{100:65,200:72,500:80,1000:82}
      },
      bundle30:{
        none:{100:31,200:33},
        tv:{
          TV_IPIT_BASIC:{100:30,200:32},
          TV_IPIT_PLUS:{100:32,200:34},
          TV_IPIT_CHOICE:{100:36,200:37}
        }
      }
    }
  };

"""
js = js[:start] + gift_block + js[end:]

# Add zero-discount combo configs for HelloVision/Skylife so their internal
# default set-top fees can be included without exposing a set-top selector.
old_combo = """  const WIRED_COMBO_DEFAULTS={
    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},
    SKTNET:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscountBySpeed:{100:2200,500:6600,1000:6600},tvDiscount:1100},
    KT:{settopNames:['기가지니3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2640},
    'LGU+':{settopNames:['4K UHD4','UHD4'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200}
  };
"""
new_combo = """  const WIRED_COMBO_DEFAULTS={
    SKB:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},
    SKTNET:{settopNames:['스마트3'],fallbackSettopFee:4400,internetDiscountBySpeed:{100:2200,500:6600,1000:6600},tvDiscount:1100},
    KT:{settopNames:['기가지니4'],fallbackSettopFee:6600,internetDiscount:5500,tvDiscount:2640},
    'LGU+':{settopNames:['4K UHD4','UHD4'],fallbackSettopFee:4400,internetDiscount:5500,tvDiscount:2200},
    LGHELLO:{settopNames:['HD 셋톱','UHD 셋톱'],fallbackSettopFee:6600,internetDiscount:0,tvDiscount:0},
    SKYLIFE:{settopNames:['지니TV STB A'],fallbackSettopFee:3300,internetDiscount:0,tvDiscount:0}
  };
"""
if old_combo not in js:
    raise SystemExit('wired combo block changed unexpectedly')
js = js.replace(old_combo, new_combo, 1)

# Route KT family and Skylife 30% bundle rows to their own gift tables.
old_fn = """  function customerGiftMax(p,tv){
    if(!p)return null;
    const cfg=CUSTOMER_GIFT_MAX[p.provider_id];if(!cfg)return null;
    const speed=Number(p.speed_mbps),group=String(p.product_group||'').toUpperCase();
    let scope=cfg;
    if(p.provider_id==='KT'&&group==='FAMILY')scope=cfg.family||null;
    else if(Array.isArray(cfg.groups)&&!cfg.groups.includes(group))return null;
    if(!scope)return null;
    if(!tv)return hasAmount(scope.none?.[speed])?Number(scope.none[speed]):null;
    const key=String(tv.product_key||'');
    return hasAmount(scope.tv?.[key]?.[speed])?Number(scope.tv[key][speed]):null;
  }
"""
new_fn = """  function customerGiftMax(p,tv){
    if(!p)return null;
    const cfg=CUSTOMER_GIFT_MAX[p.provider_id];if(!cfg)return null;
    const speed=Number(p.speed_mbps),group=String(p.product_group||'').toUpperCase();
    let scope=cfg;
    if(p.provider_id==='KT'&&group==='FAMILY')scope=cfg.family||null;
    else if(p.provider_id==='SKYLIFE'&&group==='BUNDLE30')scope=cfg.bundle30||null;
    else if(Array.isArray(cfg.groups)&&!cfg.groups.includes(group))return null;
    if(!scope)return null;
    if(!tv)return hasAmount(scope.none?.[speed])?Number(scope.none[speed]):null;
    const key=String(tv.product_key||'');
    return hasAmount(scope.tv?.[key]?.[speed])?Number(scope.tv[key][speed]):null;
  }
"""
if old_fn not in js:
    raise SystemExit('customerGiftMax function changed unexpectedly')
js = js.replace(old_fn, new_fn, 1)

# Bust caches for the curated data.
js = js.replace("fetch('data/internet.json?v=20260916-1')", "fetch('data/internet.json?v=20260916-2')")
html = html.replace('assets/rates.js?v=20260916-6', 'assets/rates.js?v=20260916-7')

JS.write_text(js, encoding='utf-8')
HTML.write_text(html, encoding='utf-8')

# Validation: customer page/code must not contain internal policy breakdown labels.
for forbidden in ['경품가이드','수수료(부가세별도)','현금','상품권']:
    if forbidden in js or forbidden in html:
        raise SystemExit(f'forbidden customer-facing internal label: {forbidden}')

print('internet counts:', {p: sum(1 for x in data['internet_products'] if x['provider_id']==p) for p in ['SKB','SKTNET','KT','LGU+','LGHELLO','SKYLIFE']})
print('tv counts:', {p: sum(1 for x in data['tv_products'] if x['provider_id']==p) for p in ['SKB','SKTNET','KT','LGU+','LGHELLO','SKYLIFE']})
print('curation complete')
