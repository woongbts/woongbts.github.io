from pathlib import Path
import re

NOTICE='페이지 구성·콘텐츠·상담 로직의 무단 복제 및 상업적 이용을 금합니다.'

# Main page
p=Path('index.html')
s=p.read_text(encoding='utf-8')
old='<p class="copyright">© 2026 웅비통신 덕천만덕점. All rights reserved.</p>'
new=old+f'<p class="copyright copyright-notice">{NOTICE}</p>'
if NOTICE not in s:
    if old not in s: raise SystemExit('index copyright marker missing')
    s=s.replace(old,new,1)
s=re.sub(r'assets/site-pro(?:\.min)?\.js\?v=[^"\']+', 'assets/site-pro.min.js?v=20260917-1', s)
s=re.sub(r'assets/ai-chat(?:\.min)?\.js\?v=[^"\']+', 'assets/ai-chat.min.js?v=20260917-1', s)
p.write_text(s,encoding='utf-8')

# Rates page
p=Path('rates.html')
s=p.read_text(encoding='utf-8')
marker='<p>표시 금액은 상담을 돕기 위한 예상치이며 실제 개통 조건과 다를 수 있습니다.</p>'
addition=marker+f'<p class="copyright-notice">© 2026 웅비통신 덕천만덕점 · {NOTICE}</p>'
if NOTICE not in s:
    if marker not in s: raise SystemExit('rates footer marker missing')
    s=s.replace(marker,addition,1)
s=re.sub(r'assets/rates(?:\.min)?\.js\?v=[^"\']+', 'assets/rates.min.js?v=20260917-1', s)
p.write_text(s,encoding='utf-8')

# Links page
p=Path('links.html')
s=p.read_text(encoding='utf-8')
marker='<p class="foot">웅비통신 덕천만덕점 · 부산 북구 만덕대로178번길 17</p>'
addition=marker+f'\n<p class="foot">© 2026 웅비통신 덕천만덕점 · {NOTICE}</p>'
if NOTICE not in s:
    if marker not in s: raise SystemExit('links footer marker missing')
    s=s.replace(marker,addition,1)
p.write_text(s,encoding='utf-8')

copyright='''# Copyright / Usage Notice\n\nCopyright © 2026 웅비통신 덕천만덕점. All rights reserved.\n\n이 저장소의 웹페이지 구성, 문구, 디자인 요소, 상담 흐름, 요금 계산 및 추천 로직은 별도의 명시적 허가가 없는 한 복제, 재배포, 변형 후 재사용 또는 상업적 이용을 허용하지 않습니다.\n\n이 저장소에 오픈소스 라이선스가 명시적으로 부여되지 않은 파일은 공개되어 있다는 이유만으로 재사용 허가가 부여되는 것이 아닙니다. 제3자 라이브러리·상표·서비스에 관한 권리는 각 권리자에게 있습니다.\n\n문의: 웅비통신 덕천만덕점 / 051-343-7677\n'''
Path('COPYRIGHT.md').write_text(copyright,encoding='utf-8')

# Small footer style; do not touch core design.
for css_name in ['assets/site-pro.css','assets/rates.css']:
    cp=Path(css_name)
    css=cp.read_text(encoding='utf-8')
    rule='\n.copyright-notice{opacity:.72;font-size:.76rem;line-height:1.55;margin-top:6px}\n'
    if '.copyright-notice{' not in css:
        css+=rule
    cp.write_text(css,encoding='utf-8')

print('hardening copy patch OK')
