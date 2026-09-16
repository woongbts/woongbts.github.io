from pathlib import Path

path = Path('assets/rates.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "senior:'A17·Wide8·Buddy5와 현재 등록된 최근 기종을 우선 살펴보고, 월 33,000원 이상 구간의 현재 요금제에서 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',",
        "senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5와 최근 출시 기종을 우선 살펴보고, 3만~4만원대 중심의 현재 요금제에서 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',"
    ),
    (
        "kids:'출고가가 낮은 기종과 실제 키즈·청소년 요금제를 조합해 공시지원금과 선택약정 중 24개월 총 부담이 낮은 조건을 보여드립니다.',",
        "kids:'현재 등록된 최근 출시 저가형 기종과 실제 키즈·청소년 요금제를 조합해 공시지원금과 선택약정 중 24개월 총 부담이 낮은 조건을 보여드립니다.',"
    ),
    (
        "    if(category==='senior'){\n      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);\n    }\n    return rows.sort((a,b)=>Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);",
        "    if(category==='senior'){\n      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);\n    }\n    if(category==='kids'){\n      return rows.sort(byNewest).slice(0,60);\n    }\n    return rows.sort((a,b)=>Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);"
    ),
    (
        "rank.textContent=index===0?'현재 조건 낮은 부담':'추천 조합';",
        "rank.textContent=purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');"
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one match, got {count}: {old[:90]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('purpose recommendation refinements applied')
