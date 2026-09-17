from pathlib import Path

p = Path('assets/site-pro.min.js')
s = p.read_text(encoding='utf-8')

repls = [
    ('const l=new Date("2026-09-18T00:00:00+09:00");if(new Date<l&&!document.getElementById("iphone18-promo")){', 'if(!document.getElementById("iphone18-promo")){'),
    ('iPhone 18 사전예약 안내', 'iPhone 18 상담 안내'),
    ('iPhone 18 사전예약 영상 보기', 'iPhone 18 소개 영상 보기'),
    ('기간 한정 · 사전예약', '상시 상담 · iPhone 18'),
    ('<h2>iPhone 18 사전예약</h2>', '<h2>iPhone 18 상담하세요</h2>'),
    ('<p class="iphone18-period">9월 12일 오후 9시 ~ 9월 17일</p>', '<p class="iphone18-period">기기변경 · 번호이동 · 요금제 상담</p>'),
    ('<p class="iphone18-description">짧은 영상으로 사전예약 소식을 빠르게 확인해 보세요.</p>', '<p class="iphone18-description">iPhone 18 구매 조건과 월 납부금이 궁금하시면 편하게 상담해 보세요.</p>'),
    ('▶ 사전예약 영상 보기', '▶ iPhone 18 영상 보기'),
    ('iPhone 18 사전예약 영상', 'iPhone 18 소개 영상'),
]

for old, new in repls:
    if old not in s:
        raise SystemExit(f'missing expected text: {old}')
    s = s.replace(old, new)

# Guard against stale campaign copy in the live script.
for forbidden in ['기간 한정 · 사전예약', '9월 12일 오후 9시 ~ 9월 17일', 'iPhone 18 사전예약', '2026-09-18T00:00:00+09:00']:
    if forbidden in s:
        raise SystemExit(f'stale campaign copy remains: {forbidden}')

for required in ['상시 상담 · iPhone 18', 'iPhone 18 상담하세요', '기기변경 · 번호이동 · 요금제 상담', '▶ iPhone 18 영상 보기']:
    if required not in s:
        raise SystemExit(f'missing new copy: {required}')

p.write_text(s, encoding='utf-8')
print('iPhone 18 consultation banner patch prepared')
