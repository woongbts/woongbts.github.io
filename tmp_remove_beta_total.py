from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

rates_html_path = Path('rates.html')
rates_js_path = Path('assets/rates.js')
ai_path = Path('assets/ai-chat.js')
index_path = Path('index.html')

rates_html = rates_html_path.read_text(encoding='utf-8')
rates_js = rates_js_path.read_text(encoding='utf-8')
ai = ai_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')

# Main-page rate entry: remove experimental badge now that the feature is established.
ai = replace_once(ai, '<small>새 기능 · BETA</small>', '', 'beta badge')

# Rate page: keep decision logic internally, but remove customer-facing 24-month aggregate totals.
rates_html = replace_once(
    rates_html,
    '등록된 출고가·요금제·공시지원금을 이용해 24개월 총 예상비용을 비교합니다. 확인되지 않은 금액은 임의로 계산하지 않습니다.',
    '등록된 출고가·요금제·공시지원금을 이용해 월 예상 납부액과 할인방식을 비교합니다. 확인되지 않은 금액은 임의로 계산하지 않습니다.',
    'purpose intro',
)
rates_html = replace_once(
    rates_html,
    '<div class="compare-head"><div><strong>공시지원금 vs 선택약정</strong><span>24개월 약정 총비용 · 단말 총 할부액 포함</span></div><b id="compare-best">조건을 선택해 주세요</b></div>',
    '<div class="compare-head"><div><strong>공시지원금 vs 선택약정</strong><span>월 예상 납부액과 할인방식을 비교합니다.</span></div><b id="compare-best">조건을 선택해 주세요</b></div>',
    'compare heading',
)
rates_html = replace_once(
    rates_html,
    '<span>공시지원금</span><strong id="compare-support-monthly">—</strong><small>예상 월 납부액</small><em id="compare-support-total">24개월 총비용 —</em><i id="compare-support-benefit">지원금 —</i>',
    '<span>공시지원금</span><strong id="compare-support-monthly">—</strong><small>예상 월 납부액</small><i id="compare-support-benefit">지원금 —</i>',
    'support total display',
)
rates_html = replace_once(
    rates_html,
    '<span>선택약정 25%</span><strong id="compare-contract-monthly">—</strong><small>예상 월 납부액</small><em id="compare-contract-total">24개월 총비용 —</em><i id="compare-contract-benefit">월 할인 —</i>',
    '<span>선택약정 25%</span><strong id="compare-contract-monthly">—</strong><small>예상 월 납부액</small><i id="compare-contract-benefit">월 할인 —</i>',
    'contract total display',
)
rates_html = replace_once(
    rates_html,
    '<div class="total"><span>24개월 총 예상비용</span><b id="explain-total24">—</b></div>',
    '',
    'explanation total row',
)
rates_html = replace_once(
    rates_html,
    '현재 선택한 요금제를 같은 통신사 다른 기종에 적용해 월 납부액과 24개월 총비용을 비교합니다.',
    '현재 선택한 요금제를 같은 통신사 다른 기종에 적용해 월 납부액과 할인방식을 비교합니다.',
    'device compare description',
)

# Comparison cards: retain total24 internally for choosing the better method, but stop exposing it.
rates_js = replace_once(
    rates_js,
    "    $('compare-support-total').textContent=supportKnown?`24개월 총비용 ${won(support.total24)}`:'24개월 총비용 —';\n",
    '',
    'support total assignment',
)
rates_js = replace_once(
    rates_js,
    "    $('compare-contract-total').textContent=contractKnown?`24개월 총비용 ${won(contract.total24)}`:'24개월 총비용 —';\n",
    '',
    'contract total assignment',
)
rates_js = replace_once(
    rates_js,
    "      $('compare-diff').textContent=diff<500?'현재 조건에서는 두 방식의 24개월 총비용 차이가 크지 않습니다.':`${best} 이용 시 24개월 총 예상비용이 약 ${won(diff)} 낮습니다.`;",
    "      $('compare-diff').textContent=diff<500?'현재 조건에서는 두 방식의 전체 부담 차이가 크지 않습니다.':`${best} 쪽이 전체 부담 기준으로 더 유리합니다.`;",
    'comparison summary',
)

# Recommendation consultation text: monthly amount is enough for the customer-facing summary.
rates_js = replace_once(
    rates_js,
    "`추천 조건: ${method}`,`예상 월 납부액: ${won(row.best.monthly)}`,`24개월 총 예상비용: ${won(row.best.total24)}`]",
    "`추천 조건: ${method}`,`예상 월 납부액: ${won(row.best.monthly)}`]",
    'purpose quote total',
)
rates_js = replace_once(
    rates_js,
    "`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준 · 24개월 총 예상비용 ${won(row.best.total24)}`",
    "`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준으로 계산한 월 예상금액입니다.`",
    'purpose card total',
)
rates_js = replace_once(
    rates_js,
    "card.innerHTML=`<span>${d.carrier} · ${method}</span><strong>${d.name}</strong><em>${p.name}</em><b>${won(best.monthly)} / 월</b><small>24개월 총 예상비용 ${won(best.total24)}</small>`;",
    "card.innerHTML=`<span>${d.carrier} · ${method}</span><strong>${d.name}</strong><em>${p.name}</em><b>${won(best.monthly)} / 월</b>`;",
    'quick recommendation total',
)

# Device compare and saved-quote compare: focus on monthly payment, not aggregate totals.
rates_js = replace_once(
    rates_js,
    "<i>${best?`${bestText} · 24개월 ${won(best.total24)}`:'최종 금액 확인 필요'}</i>",
    "<i>${best?`${bestText} 추천`:'최종 금액 확인 필요'}</i>",
    'device compare total',
)
rates_js = replace_once(
    rates_js,
    "addRow('예상 월 납부액',hasAmount(left.monthly)?won(left.monthly):'확인 필요',hasAmount(right.monthly)?won(right.monthly):'확인 필요',true);addRow('24개월 총비용',hasAmount(left.total24)?won(left.total24):'확인 필요',hasAmount(right.total24)?won(right.total24):'확인 필요',true);",
    "addRow('예상 월 납부액',hasAmount(left.monthly)?won(left.monthly):'확인 필요',hasAmount(right.monthly)?won(right.monthly):'확인 필요',true);",
    'saved quote total row',
)
rates_js = replace_once(
    rates_js,
    "const notes=[];if(hasAmount(left.monthly)&&hasAmount(right.monthly))notes.push(`월 납부액 차이 ${won(Math.abs(left.monthly-right.monthly))}`);if(hasAmount(left.total24)&&hasAmount(right.total24))notes.push(`24개월 총비용 차이 ${won(Math.abs(left.total24-right.total24))}`);if(diff)diff.textContent=notes.length?notes.join(' · '):'저장 시점의 조건을 기준으로 비교합니다.';",
    "const notes=[];if(hasAmount(left.monthly)&&hasAmount(right.monthly))notes.push(`월 납부액 차이 ${won(Math.abs(left.monthly-right.monthly))}`);if(diff)diff.textContent=notes.length?notes.join(' · '):'저장 시점의 조건을 기준으로 비교합니다.';",
    'saved quote total note',
)

# Explanation panel: remove the aggregate field and its DOM update.
rates_js = replace_once(
    rates_js,
    "const ids=['explain-price','explain-device-discount','explain-principal','explain-interest','explain-device-monthly','explain-plan-fee','explain-contract-discount','explain-welfare','explain-service','explain-monthly-total','explain-total24'];",
    "const ids=['explain-price','explain-device-discount','explain-principal','explain-interest','explain-device-monthly','explain-plan-fee','explain-contract-discount','explain-welfare','explain-service','explain-monthly-total'];",
    'explanation ids',
)
rates_js = replace_once(
    rates_js,
    "    $('explain-total24').textContent=won(scenario.total24);\n",
    '',
    'explanation total assignment',
)

# Cache bust updated front-end files.
rates_html, n = re.subn(r'assets/rates\.js\?v=[^\"\']+', 'assets/rates.js?v=20260916-30', rates_html, count=1)
if n != 1:
    raise SystemExit(f'rates.js cache bust: expected 1 match, found {n}')
index, n = re.subn(r'assets/ai-chat\.js\?v=[^\"\']+', 'assets/ai-chat.js?v=20260916-2', index, count=1)
if n != 1:
    raise SystemExit(f'ai-chat cache bust: expected 1 match, found {n}')

# Customer-visible aggregate-total labels must be gone while internal total24 math remains.
combined_visible = rates_html + '\n' + rates_js
for forbidden in ['24개월 총 예상비용', '24개월 총비용', '24개월 약정 총비용', 'explain-total24', 'compare-support-total', 'compare-contract-total']:
    if forbidden in combined_visible:
        raise SystemExit(f'forbidden customer-facing total remains: {forbidden}')
if '새 기능 · BETA' in ai:
    raise SystemExit('beta badge remains')
if 'total24' not in rates_js:
    raise SystemExit('internal total24 calculation was unexpectedly removed')

rates_html_path.write_text(rates_html, encoding='utf-8')
rates_js_path.write_text(rates_js, encoding='utf-8')
ai_path.write_text(ai, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
print('cleanup patch applied')

# trigger workflow retry
