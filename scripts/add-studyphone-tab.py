from pathlib import Path

ROOT=Path('.')
HTML=ROOT/'rates.html'
CSS=ROOT/'assets/rates.css'

html=HTML.read_text(encoding='utf-8')
css=CSS.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'marker not found: {label}')
    return text.replace(old,new,1)

html=replace_once(
    html,
    '<span class="rate-badge">휴대폰·알뜰폰·인터넷 간편견적</span>',
    '<span class="rate-badge">휴대폰·공신폰·알뜰폰·인터넷 간편견적</span>',
    'hero badge'
)
html=replace_once(
    html,
    '<p>휴대폰부터 알뜰폰·선불폰·인터넷·TV까지 선택한 조건에 맞춰 확인 가능한 금액을 자동으로 계산합니다.</p>',
    '<p>휴대폰부터 공신폰·알뜰폰·선불폰·인터넷·TV까지 선택한 조건에 맞춰 필요한 정보를 확인할 수 있습니다.</p>',
    'hero text'
)
html=replace_once(
    html,
    '<button class="rate-tab active" data-tab="mobile" type="button">휴대폰</button>\n          <button class="rate-tab" data-tab="mvno" type="button">알뜰폰(후불)</button>',
    '<button class="rate-tab active" data-tab="mobile" type="button">휴대폰</button>\n          <button class="rate-tab" data-tab="studyphone" type="button">공신폰</button>\n          <button class="rate-tab" data-tab="mvno" type="button">알뜰폰(후불)</button>',
    'top tab'
)

study_panel='''        <section class="rate-panel" data-panel="studyphone">
          <div class="rate-panel-head"><div><span class="eyebrow">공신폰</span><h2>KT M모바일 · 갤럭시 A17 공신폰</h2></div><span class="updated">단일 기종 전용 상담</span></div>
          <div class="studyphone-hero">
            <div class="studyphone-product">
              <div class="studyphone-brand">KT M모바일 전용</div>
              <div class="studyphone-device">
                <span>Samsung Galaxy</span>
                <strong>갤럭시 A17 공신폰</strong>
                <b>SM-A175</b>
              </div>
              <div class="studyphone-tags"><span>LTE</span><span>128GB</span><span>6GB RAM</span><span>5,000mAh</span></div>
              <p>공신폰 문의가 많은 고객을 위해 통신사와 기종을 고정한 전용 상담 화면입니다. 별도의 기종 검색 없이 필요한 가입 조건만 매장에서 빠르게 확인해 드립니다.</p>
              <div class="studyphone-specs">
                <div><span>통신사</span><strong>KT M모바일</strong></div>
                <div><span>기종</span><strong>갤럭시 A17 공신폰</strong></div>
                <div><span>모델명</span><strong>SM-A175</strong></div>
                <div><span>저장공간</span><strong>128GB</strong></div>
              </div>
            </div>
            <div class="rate-card studyphone-result">
              <span class="result-label">공신폰 상담</span>
              <strong>Galaxy A17</strong>
              <div class="result-breakdown">
                <div><span>취급 통신사</span><b>KT M모바일</b></div>
                <div><span>취급 모델</span><b>SM-A175</b></div>
                <div><span>단말대금</span><b>매장 확인</b></div>
                <div><span>이용 요금제</span><b>매장 확인</b></div>
                <div><span>예상 월 납부액</span><b>매장 확인</b></div>
                <div><span>기능 제한 범위</span><b>상담 확인</b></div>
              </div>
              <p>공신폰은 일반 스마트폰과 이용 목적이 다른 만큼 개통 유형, 적용 요금제, 재고와 기능 제한 범위를 확인한 뒤 안내합니다.</p>
              <div class="studyphone-note">가격이나 조건을 임의로 표시하지 않고 상담 시점의 실제 개통 조건으로 최종 안내합니다.</div>
              <div class="rate-actions"><a href="tel:0513437677">공신폰 전화상담</a><a class="kakao" href="http://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의</a></div>
            </div>
          </div>
        </section>

'''
html=replace_once(
    html,
    '        <section class="rate-panel" data-panel="mvno">',
    study_panel+'        <section class="rate-panel" data-panel="mvno">',
    'studyphone panel'
)
html=html.replace('assets/rates.css?v=20260916-10','assets/rates.css?v=20260916-11')

css_block='''\n\n/* Dedicated study phone tab */
.studyphone-hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(300px,.92fr);gap:16px}.studyphone-product{background:linear-gradient(145deg,#103c52 0%,#0f766e 100%);color:#fff;border-radius:22px;padding:26px;box-shadow:0 12px 30px rgba(16,60,82,.14)}.studyphone-brand{display:inline-flex;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);font-size:.72rem;font-weight:900}.studyphone-device{display:grid;gap:5px;margin:25px 0 16px}.studyphone-device>span{font-size:.78rem;opacity:.72;font-weight:800}.studyphone-device>strong{font-size:clamp(2rem,5vw,3.15rem);line-height:1.05;letter-spacing:-.055em}.studyphone-device>b{font-size:1rem;opacity:.86}.studyphone-tags{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}.studyphone-tags span{padding:6px 9px;border-radius:9px;background:rgba(255,255,255,.12);font-size:.69rem;font-weight:850}.studyphone-product>p{margin:0 0 20px;font-size:.85rem;line-height:1.7;color:rgba(255,255,255,.82)}.studyphone-specs{display:grid;grid-template-columns:1fr 1fr;gap:9px}.studyphone-specs>div{padding:12px;border-radius:13px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12)}.studyphone-specs span{display:block;font-size:.65rem;opacity:.68;margin-bottom:5px}.studyphone-specs strong{display:block;font-size:.84rem}.studyphone-result{position:static}.studyphone-result>strong{display:block;font-size:clamp(2rem,5vw,3.1rem);line-height:1.05;letter-spacing:-.05em;color:var(--teal);margin:8px 0 20px}.studyphone-note{padding:12px 13px;border-radius:12px;background:#eef6f5;color:#52706f;font-size:.73rem;line-height:1.55}@media(max-width:760px){.studyphone-hero{grid-template-columns:1fr}.studyphone-product{padding:20px;border-radius:18px}.studyphone-specs{grid-template-columns:1fr 1fr}.studyphone-device{margin-top:20px}.studyphone-device>strong{font-size:2.15rem}}\n'''
if '/* Dedicated study phone tab */' not in css:
    css += css_block

HTML.write_text(html,encoding='utf-8')
CSS.write_text(css,encoding='utf-8')
print('studyphone tab patch complete')
