from pathlib import Path

p = Path('rates.html')
s = p.read_text(encoding='utf-8')
old = '카카오톡 X · 인터넷 X · 전화·메시지·카메라·사전 등 기본 기능만 제공됩니다.'
new = '공신폰은 카카오톡 X · 인터넷 X · 전화·메시지·카메라·사전 등 기본 기능만 제공됩니다.'
if old not in s:
    raise SystemExit('target text not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('updated rates.html')
