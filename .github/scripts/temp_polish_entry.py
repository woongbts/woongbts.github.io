from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Homepage: remove dead script call and make the mobile bar action-oriented.
p = Path('index.html')
s = p.read_text(encoding='utf-8')
old_bar = '<div class="mobile-bar"><a class="btn outline" href="#location">오시는 길</a><a class="btn" href="tel:0513437677">전화 상담·예약</a></div>'
new_bar = '<div class="mobile-bar"><a class="btn outline" href="/rates.html">요금 계산</a><a class="btn" href="tel:0513437677">전화 상담</a></div>'
if old_bar not in s:
    raise SystemExit('Expected mobile bar not found in index.html')
s = s.replace(old_bar, new_bar, 1)
dead = '<script src="assets/ai-chat.js?v=20260915-1" defer></script>'
if dead not in s:
    raise SystemExit('Expected dead ai-chat.js reference not found')
s = s.replace(dead, '', 1)
p.write_text(s, encoding='utf-8')

# Rates page: dedicated social metadata.
p = Path('rates.html')
s = p.read_text(encoding='utf-8')
desc = '  <meta name="description" content="휴대폰·알뜰폰·선불폰·인터넷·TV 요금을 선택 조건에 따라 확인할 수 있는 웅비통신 요금 안내 페이지입니다.">\n'
if desc not in s:
    raise SystemExit('Expected rates description meta not found')
social = '''  <meta name="description" content="휴대폰·알뜰폰·선불폰·인터넷·TV 요금을 선택 조건에 따라 확인할 수 있는 웅비통신 요금 안내 페이지입니다.">
  <link rel="canonical" href="https://woongbts.github.io/rates.html">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="웅비통신 덕천만덕점">
  <meta property="og:title" content="웅비통신 | 휴대폰·알뜰폰 월요금 계산">
  <meta property="og:description" content="기종·요금제·할인방식을 선택하고 예상 월 납부액을 확인해 보세요. 휴대폰·공신폰·알뜰폰·선불폰·인터넷TV 상담.">
  <meta property="og:url" content="https://woongbts.github.io/rates.html">
  <meta property="og:image" content="https://woongbts.github.io/assets/woongbi-rates-og-20260918.jpg">
  <meta property="og:image:secure_url" content="https://woongbts.github.io/assets/woongbi-rates-og-20260918.jpg">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="웅비통신 휴대폰·알뜰폰 월요금 계산">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="웅비통신 | 휴대폰·알뜰폰 월요금 계산">
  <meta name="twitter:description" content="기종·요금제·할인방식을 선택하고 예상 월 납부액을 확인해 보세요.">
  <meta name="twitter:image" content="https://woongbts.github.io/assets/woongbi-rates-og-20260918.jpg">
'''
s = s.replace(desc, social, 1)
p.write_text(s, encoding='utf-8')

# Dedicated 1200x630 OG image for rates.html.
W, H = 1200, 630
img = Image.new('RGB', (W, H), (247, 251, 251))
d = ImageDraw.Draw(img)
top, bottom = (250, 253, 253), (231, 246, 246)
for y in range(H):
    t = y / (H - 1)
    c = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
    d.line((0, y, W, y), fill=c)

navy = (16, 60, 82)
teal = (9, 164, 158)
yellow = (248, 215, 58)
text = (30, 38, 43)
muted = (79, 103, 112)
pale = (225, 244, 245)
white = (255, 255, 255)

bold = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
reg = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
f_badge = ImageFont.truetype(bold, 24, index=3)
f_brand = ImageFont.truetype(bold, 36, index=3)
f_main = ImageFont.truetype(bold, 58, index=3)
f_sub = ImageFont.truetype(reg, 25, index=3)
f_chip = ImageFont.truetype(bold, 19, index=3)
f_small = ImageFont.truetype(bold, 22, index=3)
f_price = ImageFont.truetype(bold, 55, index=3)

d.ellipse((770, -120, 1320, 430), fill=pale)
d.rounded_rectangle((68, 66, 246, 110), 22, fill=teal)
d.text((91, 75), '덕천만덕점', font=f_badge, fill=white)
d.text((68, 134), '웅비통신 요금 알아보기', font=f_brand, fill=navy)
d.text((68, 218), '휴대폰 요금,', font=f_main, fill=text)
d.text((68, 290), '직접 계산해 보세요.', font=f_main, fill=navy)
d.rounded_rectangle((70, 369, 470, 381), 6, fill=yellow)
d.text((68, 411), '기종 · 요금제 · 할인방식을 고르고', font=f_sub, fill=muted)
d.text((68, 450), '예상 월 납부액을 한눈에 확인하세요.', font=f_sub, fill=muted)

chips = ['휴대폰', '공신폰', '알뜰폰', '선불폰', '인터넷·TV']
cx = 68
for chip in chips:
    box = d.textbbox((0, 0), chip, font=f_chip)
    cw = box[2] - box[0] + 34
    d.rounded_rectangle((cx, 516, cx + cw, 558), 21, fill=white, outline=(202, 220, 224))
    d.text((cx + 17, 524), chip, font=f_chip, fill=navy)
    cx += cw + 10
d.text((68, 581), 'woongbts.github.io/rates.html', font=f_small, fill=teal)

# Calculator card visual. The amount is explicitly labeled as an example.
d.rounded_rectangle((735, 105, 1120, 525), 34, fill=white, outline=(199, 221, 225), width=3)
d.rounded_rectangle((770, 145, 1085, 210), 18, fill=(238, 247, 247))
d.text((795, 162), '계산 예시 · 월 예상 납부액', font=f_small, fill=muted)
d.text((790, 236), '38,870원', font=f_price, fill=navy)
d.text((997, 267), '/월', font=f_small, fill=teal)
rows = [('기종', 'Galaxy A17 LTE'), ('요금제', 'T플랜 세이브'), ('할인', '선택약정')]
yy = 335
for label, value in rows:
    d.text((790, yy), label, font=f_chip, fill=muted)
    d.text((870, yy), value, font=f_chip, fill=text)
    yy += 50
d.rounded_rectangle((785, 475, 1070, 510), 17, fill=navy)
d.text((844, 480), '내 조건으로 계산하기', font=f_chip, fill=white)

out = Path('assets/woongbi-rates-og-20260918.jpg')
img.save(out, quality=88, optimize=True, progressive=True)
check = Image.open(out)
assert check.size == (1200, 630), check.size
print('Created', out, check.size, check.mode)
