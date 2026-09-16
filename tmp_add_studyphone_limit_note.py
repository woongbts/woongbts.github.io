from pathlib import Path

p = Path('rates.html')
s = p.read_text(encoding='utf-8')
old = '공신폰 문의가 많은 고객을 위해 실제 취급 중인 단일 기종과 확인된 전용 요금제만 안내합니다.'
new = '공신폰 문의가 많은 고객을 위해 실제 취급 중인 단일 기종과 확인된 전용 요금제만 안내합니다. 카카오톡 X · 인터넷 X · 전화·메시지·카메라·사전 등 기본 기능만 제공됩니다.'
if old not in s:
    raise SystemExit('target text not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('updated rates.html')
