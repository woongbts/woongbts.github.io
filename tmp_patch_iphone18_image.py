from pathlib import Path
import re

js_path = Path('assets/site-pro.min.js')
html_path = Path('index.html')

js = js_path.read_text(encoding='utf-8')
old_markup = '<div class="iphone18-promo-preview" aria-hidden="true"><strong>iPhone 18</strong></div>'
new_markup = '<div class="iphone18-promo-preview"><img src="/%EC%95%84%EC%9D%B4%ED%8F%B018.jpg?v=20260917-1" alt="iPhone 18"></div>'
assert js.count(old_markup) == 1, f'expected old preview markup once, got {js.count(old_markup)}'
js = js.replace(old_markup, new_markup, 1)

append_marker = 'document.head.appendChild(promoStyle)'
override = 'promoStyle.textContent+="\\n          .iphone18-promo-preview{background:#fff!important;box-shadow:none!important;padding:0!important;overflow:hidden}.iphone18-promo-preview:before,.iphone18-promo-preview:after{display:none!important}.iphone18-promo-preview img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;border-radius:inherit}\\n        ";document.head.appendChild(promoStyle)'
assert js.count(append_marker) == 1, f'expected promo style append once, got {js.count(append_marker)}'
js = js.replace(append_marker, override, 1)
js_path.write_text(js, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
html, count = re.subn(r'assets/site-pro\.min\.js\?v=[0-9-]+', 'assets/site-pro.min.js?v=20260917-6', html, count=1)
assert count == 1, f'expected one site-pro cache reference, got {count}'
html_path.write_text(html, encoding='utf-8')

assert '/%EC%95%84%EC%9D%B4%ED%8F%B018.jpg?v=20260917-1' in js
assert old_markup not in js
assert 'object-fit:contain' in js
assert 'assets/site-pro.min.js?v=20260917-6' in html
print('iPhone 18 banner image patch prepared')
