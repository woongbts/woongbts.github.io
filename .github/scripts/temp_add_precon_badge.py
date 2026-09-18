from pathlib import Path

INDEX = Path('index.html')
CSS = Path('assets/site-pro.css')
VALIDATOR = Path('.github/scripts/validate_site.py')

CERT_URL = 'https://ictmarket.or.kr:8443/precon/pop_CertIcon.do?PRECON_REQ_ID=PRE0000119098&amp;YN=1'

index = INDEX.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')
validator = VALIDATOR.read_text(encoding='utf-8')

old_header = '</nav><a class="btn" href="tel:0513437677">전화 문의</a>'
new_header = (
    '</nav>'
    '<a class="precon-badge" href="' + CERT_URL + '" target="_blank" rel="noopener noreferrer" '
    'aria-label="이동통신 판매점 사전승낙 정보 확인">'
    '<span class="precon-badge-icon" aria-hidden="true">✓</span>'
    '<span class="precon-badge-copy"><strong>사전승낙 판매점</strong><small>KAIT 승낙정보 확인</small></span>'
    '</a>'
    '<a class="btn" href="tel:0513437677">전화 문의</a>'
)
if old_header not in index:
    raise SystemExit('header insertion marker not found')
if 'class="precon-badge"' not in index:
    index = index.replace(old_header, new_header, 1)

index = index.replace('assets/site-pro.css?v=20260911-2', 'assets/site-pro.css?v=20260918-2', 1)

badge_css = '''
/* Naver business-channel review: keep the official pre-approval lookup visible near the top of the main page. */
.precon-badge{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;padding:7px 10px;border:1px solid #a9cbc8;border-radius:12px;background:#f0f8f7;color:var(--blue);line-height:1.15;box-shadow:0 5px 14px rgba(16,60,82,.06)}
.precon-badge:hover{border-color:var(--teal);background:#e8f5f3}
.precon-badge-icon{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:50%;background:var(--teal);color:#fff;font-weight:900;font-size:.9rem;flex:0 0 auto}
.precon-badge-copy{display:block;white-space:nowrap;text-align:left}
.precon-badge-copy strong{display:block;font-size:.77rem;letter-spacing:-.02em}
.precon-badge-copy small{display:block;margin-top:3px;color:var(--muted);font-size:.64rem;font-weight:700}
@media(max-width:980px){.nav{gap:12px}.precon-badge-copy small{display:none}.precon-badge{padding:7px 9px}.precon-badge-copy strong{font-size:.72rem}}
@media(max-width:640px){.nav{gap:7px}.precon-badge{gap:5px;padding:6px 7px;border-radius:10px}.precon-badge-icon{width:23px;height:23px;font-size:.78rem}.precon-badge-copy strong{font-size:.66rem}.nav>.btn{padding-left:9px;padding-right:9px;font-size:.84rem}}
@media(max-width:390px){.precon-badge-copy{display:none}.precon-badge{padding:6px}.nav{gap:6px}}
'''
if '.precon-badge{' not in css:
    css = css.rstrip() + '\n' + badge_css

validator_marker = 'check("assets/site-pro.min.js?v=" in index, "site production script missing")'
validator_add = '''\n# Naver business-channel telecom pre-approval visibility contract.\nPRECON_URL = "https://ictmarket.or.kr:8443/precon/pop_CertIcon.do?PRECON_REQ_ID=PRE0000119098&amp;YN=1"\ncheck('class="precon-badge"' in index, "top pre-approval badge missing")\ncheck('사전승낙 판매점' in index and 'KAIT 승낙정보 확인' in index, "pre-approval badge copy missing")\ncheck(index.count(PRECON_URL) >= 2, "official pre-approval lookup must remain in both header and footer")\n'''
if 'top pre-approval badge missing' not in validator:
    if validator_marker not in validator:
        raise SystemExit('validator insertion marker not found')
    validator = validator.replace(validator_marker, validator_marker + validator_add, 1)

INDEX.write_text(index, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
VALIDATOR.write_text(validator, encoding='utf-8')

assert index.count(CERT_URL) >= 2
assert 'class="precon-badge"' in index
assert 'assets/site-pro.css?v=20260918-2' in index
print('pre-approval badge patch prepared')
