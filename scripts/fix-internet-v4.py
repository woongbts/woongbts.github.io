from pathlib import Path
import json

path = Path('data/internet.json')
data = json.loads(path.read_text(encoding='utf-8'))

# Correct pre-existing LGU+ speed metadata so bundle eligibility follows the real product speed.
lg_speed = {
    'INTERNET_2.5G_S': 2500,
    'INTERNET_2.5G': 2500,
    'INTERNET_5G': 5000,
    'INTERNET_10G': 10000,
}
for p in data.get('internet_products', []):
    if p.get('provider_id') == 'LGU+' and p.get('product_key') in lg_speed:
        p['speed_mbps'] = lg_speed[p['product_key']]

# Refine a few TV descriptions where a generic family description hid the actual included benefit.
for tv in data.get('tv_products', []):
    name = tv.get('name', '')
    provider = tv.get('provider_id')
    if provider == 'SKB':
        if name == 'Btv ALL + 지상파':
            tv['description'] = 'B tv All의 폭넓은 채널에 지상파 콘텐츠 혜택을 더한 상품'
        elif '넷플릭스' in name:
            base = 'B tv 스탠다드' if '스탠다드' in name else 'B tv All'
            tv['description'] = f'{base} 채널과 넷플릭스 멤버십을 함께 이용하는 상품'
    elif provider == 'KT' and '디즈니+ 초이스' in name:
        tv['description'] = '지니 TV 실시간 채널과 디즈니+ 멤버십을 함께 이용하는 상품 · 세부 채널수는 상담 시 확인'

path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('Internet data accuracy fixes applied.')
