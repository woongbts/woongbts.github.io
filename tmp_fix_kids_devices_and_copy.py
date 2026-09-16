from pathlib import Path
import re

js_path=Path('assets/rates.js')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

old="""  const PURPOSE_COPY={
    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5 등 삼성폰을 우선 살펴보고, 휴대폰용 월 33,000원 이상 요금제에서 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',
    kids:'최근 출시 삼성 보급형을 우선 살펴보고, 휴대폰용 월 33,000원 이상 키즈·청소년 요금제에서 공시지원금과 선택약정의 24개월 총 부담을 비교합니다.',
"""
new="""  const PURPOSE_COPY={
    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5 등 삼성폰을 우선 살펴보고, 사용량과 월 부담의 균형이 좋은 휴대폰 요금제로 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',
    kids:'ZEM폰·키즈폰 등 아이에게 맞는 최신 삼성 단말을 우선 살펴보고, 키즈·청소년용 요금제에서 공시지원금과 선택약정의 24개월 총 부담을 비교합니다.',
"""
if js.count(old)!=1:
    raise SystemExit(f'purpose copy anchor count={js.count(old)}')
js=js.replace(old,new,1)

old_kids="""  function purposeIsKidsOnlyDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /무너2|무너키즈|mooner2|mooner/.test(text);
  }
"""
new_kids="""  function purposeIsKidsOnlyDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /무너2|무너키즈|mooner2|mooner|zem폰|zemphone|포켓피스|pocketpiece|키즈폰|폼폼푸린/.test(text);
  }
"""
if js.count(old_kids)!=1:
    raise SystemExit(f'kids helper anchor count={js.count(old_kids)}')
js=js.replace(old_kids,new_kids,1)

html,n=re.subn(r'assets/rates\.js\?v=[^\"]+', 'assets/rates.js?v=20260916-23', html, count=1)
if n!=1:
    raise SystemExit('js cache bust failed')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('kids-only device classification and customer copy updated')
