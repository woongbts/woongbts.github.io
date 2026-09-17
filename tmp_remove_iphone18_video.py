from pathlib import Path
import re

js_path = Path('assets/site-pro.min.js')
html_path = Path('index.html')

text = js_path.read_text(encoding='utf-8')
start = 'if(!document.getElementById("iphone18-promo")){'
end = 'const m=document.querySelector("#location .actions");'
si = text.find(start)
ei = text.find(end, si)
if si < 0 or ei < 0:
    raise SystemExit('iPhone 18 promo block not found')

new_block = r'''if(!document.getElementById("iphone18-promo")){if(!document.getElementById("iphone18-promo-style")){const promoStyle=document.createElement("style");promoStyle.id="iphone18-promo-style",promoStyle.textContent="\n          .iphone18-promo{padding:26px 0;background:#fff;border-bottom:1px solid var(--line)}\n          .iphone18-promo-card{display:grid;grid-template-columns:170px minmax(0,1fr);gap:28px;align-items:center;padding:24px 28px;border:1px solid #d7e1e5;border-radius:22px;background:linear-gradient(135deg,#f7fafb 0%,#fff 52%,#edf5ff 100%);box-shadow:0 12px 30px rgba(16,60,82,.07)}\n          .iphone18-promo-preview{width:150px;height:220px;margin:auto;border-radius:28px;background:linear-gradient(160deg,#101215,#283447 55%,#101215);box-shadow:0 15px 30px rgba(8,20,32,.22);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;color:#fff;text-align:center}\n          .iphone18-promo-preview:before{content:'';position:absolute;inset:7px;border:1px solid rgba(255,255,255,.15);border-radius:22px}\n          .iphone18-promo-preview:after{content:'';position:absolute;top:14px;left:50%;width:48px;height:6px;transform:translateX(-50%);border-radius:999px;background:rgba(255,255,255,.17)}\n          .iphone18-promo-preview strong{position:relative;z-index:1;margin-top:96px;font-size:.82rem;letter-spacing:.02em;color:rgba(255,255,255,.82)}\n          .iphone18-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#111827;color:#fff;font-size:.76rem;font-weight:900;margin-bottom:10px}.iphone18-promo-copy h2{font-size:clamp(1.8rem,3vw,2.45rem);margin:0;line-height:1.2}.iphone18-period{margin-top:8px;color:#2563eb;font-weight:900}.iphone18-description{margin-top:8px;color:var(--muted);font-size:.95rem}.iphone18-promo-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}\n          @media(max-width:640px){.iphone18-promo{padding:16px 0}.iphone18-promo-card{grid-template-columns:92px minmax(0,1fr);gap:15px;padding:16px;border-radius:18px}.iphone18-promo-preview{width:82px;height:126px;border-radius:18px}.iphone18-promo-preview:before{inset:5px;border-radius:14px}.iphone18-promo-preview:after{top:9px;width:30px;height:4px}.iphone18-promo-preview strong{margin-top:55px;font-size:.58rem}.iphone18-badge{font-size:.65rem;margin-bottom:7px}.iphone18-promo-copy h2{font-size:1.35rem}.iphone18-period{font-size:.82rem;margin-top:5px}.iphone18-description{display:none}.iphone18-promo-actions{margin-top:11px;gap:6px}.iphone18-promo-actions .btn{min-height:40px;padding:8px 10px;font-size:.75rem}}\n        ",document.head.appendChild(promoStyle)}const promoSection=document.createElement("section");promoSection.className="iphone18-promo",promoSection.id="iphone18-promo",promoSection.setAttribute("aria-label","iPhone 18 상담 안내"),promoSection.innerHTML='<div class="wrap"><div class="iphone18-promo-card"><div class="iphone18-promo-preview" aria-hidden="true"><strong>iPhone 18</strong></div><div class="iphone18-promo-copy"><span class="iphone18-badge">iPhone 18 상담</span><h2>iPhone 18 상담하세요</h2><p class="iphone18-period">기기변경 · 번호이동 · 요금제 상담</p><p class="iphone18-description">iPhone 18 구매 조건과 월 납부금이 궁금하시면 편하게 상담해 보세요.</p><div class="iphone18-promo-actions"><a class="btn" href="/rates.html">조건 확인하기 →</a><a class="btn outline" href="tel:0513437677">전화 문의</a></div></div></div></div>';const heroSection=document.querySelector(".hero");heroSection?heroSection.insertAdjacentElement("afterend",promoSection):document.querySelector("main").prepend(promoSection)}'''

updated = text[:si] + new_block + text[ei:]
js_path.write_text(updated, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')
html2, count = re.subn(r'assets/site-pro\.min\.js\?v=[^"\']+', 'assets/site-pro.min.js?v=20260917-4', html, count=1)
if count != 1:
    raise SystemExit(f'cache reference update count={count}')
html_path.write_text(html2, encoding='utf-8')

# Safety checks limited to the rewritten promo block.
check = updated[updated.find(start):updated.find(end, updated.find(start))]
for forbidden in ('사전예약', 'iphone18-video', '.mov', '영상 보기'):
    if forbidden in check:
        raise SystemExit(f'forbidden promo token remains: {forbidden}')
for required in ('iPhone 18 상담하세요', '조건 확인하기', '기기변경 · 번호이동 · 요금제 상담'):
    if required not in check:
        raise SystemExit(f'required promo token missing: {required}')
print('iPhone 18 promo converted to consultation-only card')
