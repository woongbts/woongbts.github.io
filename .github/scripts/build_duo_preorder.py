"""Build the shared homepage campaign and standalone iPhone Duo preorder page."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = '20261016-duo1'

CARD = '''<div class="duo-card">
  <div class="duo-copy">
    <span class="duo-eyebrow">WOONGBI TELECOM · PRE-ORDER</span>
    <h2 id="duo-title">iPhone Duo<span>사전예약은 웅비통신에서.</span></h2>
    <p>새롭게 펼쳐지는 iPhone.<br>원하는 용량과 색상을 남겨주시면, 매장에서 확인하고 연락드릴게요.</p>
    <div class="duo-dates"><span><b>사전예약</b> 10.16(금) 21:00 ~ 10.22(목) 21:00</span><span><b>개통 시작</b> 10.23(금)</span></div>
    <p>스타 화이트 · 나이트 스카이<br>256GB · 512GB · 1TB</p>
    <div class="duo-actions"><button type="button" class="duo-primary" data-duo-open>아이폰 듀오 사전예약 신청 →</button><a href="/iphone-duo/">용량·출고가 안내</a><a href="tel:0513437677">전화 문의</a></div>
    <p class="duo-fine">신청은 매장 상담 접수이며, 개통·계약·재고 배정을 확정하지 않습니다.<br>최종 가격과 혜택은 상담 후 안내합니다.</p>
  </div>
  <figure class="duo-film">
    <video controls playsinline preload="none" poster="/assets/media/iphone-duo-preorder-20261016.jpg" aria-label="웅비통신 아이폰 듀오 사전예약 안내 영상">
      <source src="/assets/media/iphone-duo-preorder-20261016.mp4" type="video/mp4">
      <p>영상 재생을 지원하지 않는 브라우저입니다. 위 사전예약 안내를 확인해 주세요.</p>
    </video>
    <figcaption>웅비통신 아이폰 듀오 사전예약 안내<br>제품 이미지는 참고용입니다.</figcaption>
  </figure>
</div>'''

DIALOG = '''<dialog id="duo-dialog" class="duo-dialog" aria-labelledby="duo-dialog-title">
  <header><div><small>웅비통신 덕천만덕점</small><h2 id="duo-dialog-title">아이폰 듀오 사전예약 신청</h2></div><button class="duo-close" type="button" data-duo-close aria-label="사전예약 신청창 닫기">×</button></header>
  <form id="duo-form" class="duo-form">
    <p class="duo-form-intro">원하는 모델과 연락처를 남겨주세요.<br>신청 후 매장에서 예약 내용과 가입 조건을 확인하고 연락드립니다.</p>
    <div class="duo-fields">
      <label class="duo-name-field" for="duo-name">이름 (필수)<input id="duo-name" name="name" autocomplete="name" maxlength="40" minlength="2" placeholder="성함을 입력해 주세요" required></label>
      <label class="duo-phone-field" for="duo-phone">연락처 (필수)<input id="duo-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="13" placeholder="010-0000-0000" required></label>
      <label class="duo-wide" for="duo-carrier">희망 통신사 (필수)<select id="duo-carrier" name="carrier" required><option value="">통신사를 선택해 주세요</option><option>SKT</option><option>KT</option><option>LGU+</option><option>상담 후 결정</option></select></label>
      <label for="duo-model">신청 모델·용량 (필수)<select id="duo-model" name="model" required><option value="">용량 선택</option><option value="256GB">iPhone Duo 256GB</option><option value="512GB">iPhone Duo 512GB</option><option value="1TB">iPhone Duo 1TB</option></select></label>
      <label for="duo-color">희망 색상 (필수)<select id="duo-color" name="color" required><option value="">색상 선택</option><option>스타 화이트</option><option>나이트 스카이</option><option>상담 후 결정</option></select></label>
      <label class="duo-wide" for="duo-inquiry">기타 요청사항 (선택)<textarea id="duo-inquiry" name="inquiry" rows="3" maxlength="1200" placeholder="번호이동·기기변경, 연락 가능한 시간 등 궁금한 내용을 적어주세요. (선택)"></textarea><small>주민등록번호·카드번호·계좌번호는 입력하지 마세요.</small></label>
    </div>
    <label class="duo-trap" aria-hidden="true">웹사이트<input id="duo-website" name="website" tabindex="-1" autocomplete="off"></label>
    <details class="duo-policy"><summary>개인정보 수집·이용 안내</summary><p>희망 통신사·모델·색상은 선택 상품·견적 조건으로 접수합니다.</p><div id="duo-policy-copy">개인정보 처리 안내를 불러오고 있습니다.</div><small id="duo-policy-version"></small><p><a href="/privacy.html" target="_blank" rel="noopener">개인정보 처리방침 보기</a></p></details>
    <label class="duo-consent"><input type="checkbox" name="consent" id="duo-consent" required><span>사전예약 상담 접수를 위한 개인정보 수집·이용에 동의합니다. <b>(필수)</b></span></label>
    <p id="duo-form-status" class="duo-form-status" role="status" aria-live="polite"></p>
    <button type="button" id="duo-retry-policy" class="duo-policy-retry">개인정보 안내 다시 불러오기</button>
    <p class="duo-fine">신청만으로 구매·개통이 확정되지 않습니다. 예약 내용은 상담 과정에서 변경하거나 취소할 수 있습니다.</p>
    <button type="submit" id="duo-submit" class="duo-submit" disabled>사전예약 신청 접수</button>
    <div class="duo-contact"><a href="tel:0513437677">전화 051-343-7677</a><a href="https://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의</a></div>
  </form>
  <section id="duo-success" class="duo-success" hidden><h3 id="duo-success-title" tabindex="-1">신청이 접수되었습니다.</h3><p>웅비통신에서 신청 내용을 확인하고 연락드리겠습니다.<br>방문·개통 일정과 최종 조건은 상담 후 확정됩니다.</p><p id="duo-receipt"></p><a id="duo-status-link" hidden>신청 진행상태 확인 →</a><button class="duo-submit" type="button" data-duo-close>확인</button></section>
</dialog>'''

CAMPAIGN = '<section id="iphone18-promo" class="duo-section" aria-labelledby="duo-title"><div class="wrap" id="iphone-duo-preorder">\n' + CARD + '\n</div></section>'
# The existing legacy homepage checks this ID before injecting the old iPhone 18 card.
START, END = '<!-- DUO CAMPAIGN START -->', '<!-- DUO CAMPAIGN END -->'
home = ROOT / 'index.html'
text = home.read_text(encoding='utf-8')
block = START + '\n' + CAMPAIGN + '\n' + DIALOG + '\n' + END
if START in text:
    before, rest = text.split(START, 1)
    _, after = rest.split(END, 1)
    text = before + block + after
else:
    marker = '<section class="content modern-services" id="services">'
    assert marker in text
    text = text.replace(marker, block + '\n' + marker, 1)
css = f'<link rel="stylesheet" href="/assets/iphone-duo-preorder.css?v={VERSION}">'
js = f'<script src="/assets/iphone-duo-preorder.js?v={VERSION}" defer></script>'
if 'href="/assets/iphone-duo-preorder.css?' not in text:
    text = text.replace('</head>', css + '</head>', 1)
if 'src="/assets/iphone-duo-preorder.js?' not in text:
    text = text.replace('</body>', js + '</body>', 1)
home.write_text(text, encoding='utf-8')

page = ROOT / 'iphone-duo/index.html'
page.parent.mkdir(exist_ok=True)
page.write_text('''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#103c52">
<title>아이폰 듀오 사전예약 | 웅비통신 덕천만덕점</title>
<meta name="description" content="웅비통신 아이폰 듀오 사전예약. 2026년 10월 16일 21시부터 10월 22일 21시까지. 용량·색상·출고가를 확인하고 상담 신청하세요.">
<link rel="canonical" href="https://woongbts.github.io/iphone-duo/">
<meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="아이폰 듀오 사전예약은 웅비통신에서"><meta property="og:description" content="10.16 21:00 ~ 10.22 21:00 · 스타 화이트·나이트 스카이 · 256GB·512GB·1TB"><meta property="og:url" content="https://woongbts.github.io/iphone-duo/"><meta property="og:image" content="https://woongbts.github.io/assets/media/iphone-duo-preorder-20261016.jpg"><link rel="icon" href="/assets/woongbi-mark.svg">''' + css + '''</head>
<body class="duo-page"><nav class="duo-page-nav" aria-label="매장 메뉴"><a href="/">W · 웅비통신 덕천만덕점</a><a href="tel:0513437677">전화 문의</a></nav><main>
<section class="duo-section" aria-labelledby="duo-title">''' + CARD.replace('<h2 ', '<h1 ').replace('</h2>', '</h1>').replace('href="/iphone-duo/">용량·출고가 안내', 'href="#duo-models">용량·출고가 안내') + '''</section>
<section class="duo-details" id="duo-models"><h2>용량과 출고가를 확인하세요.</h2><div class="duo-models">
<article class="duo-model"><h3>256GB</h3><p>출고가</p><strong>3,300,000원</strong></article>
<article class="duo-model"><h3>512GB</h3><p>출고가</p><strong>3,597,000원</strong></article>
<article class="duo-model"><h3>1TB</h3><p>출고가</p><strong>4,191,000원</strong></article></div>
<p class="duo-color-note">희망 색상 <span class="duo-dot white"></span><b>스타 화이트</b> <span class="duo-dot navy"></span><b>나이트 스카이</b></p>
<p class="duo-fine">출고가는 할인 전 단말기 가격입니다. 통신사·요금제·가입유형에 따라 실제 구매 조건이 달라집니다. 희망 모델·색상의 배정 여부와 최종 조건은 상담 후 안내합니다.</p>
<div class="duo-actions"><button class="duo-primary" type="button" data-duo-open>원하는 모델로 사전예약 신청 →</button><a href="https://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 상담</a></div></section>
</main>''' + DIALOG + '''<footer><strong>웅비통신 덕천만덕점</strong><br>부산광역시 북구 만덕대로178번길 17 · 051-343-7677<br>월–토 11:00–20:00 · 일요일 휴무<br><a href="/privacy.html">개인정보 처리방침</a> · <a href="/">홈페이지로</a></footer>''' + js + '''</body></html>''', encoding='utf-8')
print('Homepage Duo campaign and standalone preorder page built')
