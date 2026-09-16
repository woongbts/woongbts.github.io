from pathlib import Path

path = Path('assets/rates.js')
text = path.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)

replace_once(
"""  const PURPOSE_COPY={
    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5와 최근 출시 기종을 우선 살펴보고, 3만~4만원대 중심의 현재 요금제에서 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',
    kids:'현재 등록된 최근 출시 저가형 기종과 실제 키즈·청소년 요금제를 조합해 공시지원금과 선택약정 중 24개월 총 부담이 낮은 조건을 보여드립니다.',
    value:'출고가와 월 통신요금을 함께 보고, 중저가 기종에서 24개월 총 예상비용이 부담 적은 조합을 보여드립니다.',
    premium:'프리미엄 기종에서 가입 가능한 요금제를 조합해 공시지원금과 선택약정의 24개월 총 예상비용을 비교합니다.'
  };""",
"""  const PURPOSE_COPY={
    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5 등 삼성폰을 우선 살펴보고, 휴대폰용 월 33,000원 이상 요금제에서 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',
    kids:'최근 출시 삼성 보급형을 우선 살펴보고, 휴대폰용 월 33,000원 이상 키즈·청소년 요금제에서 공시지원금과 선택약정의 24개월 총 부담을 비교합니다.',
    value:'삼성 중저가 기종을 우선 살펴보고, 휴대폰용 월 33,000원 이상 요금제에서 기기값과 통신요금을 함께 비교합니다.',
    premium:'프리미엄 휴대폰과 월 33,000원 이상 휴대폰용 요금제에서 공시지원금과 선택약정의 24개월 총 예상비용을 비교합니다.'
  };""",
'purpose copy')

replace_once(
"""  function purposeSeniorPlanRank(p,carrierName){
    const name=`${p?.name||''}`.toLowerCase().replace(/\\s+/g,'');
    if(carrierName==='SKT'&&name.includes('t플랜세이브'))return 0;
    if(carrierName==='KT'&&name.includes('베이직')&&name.includes('4gb')&&name.includes('65'))return 0;
    if(carrierName==='LGU+'&&name.includes('데이터플랜')&&name.includes('9gb')&&name.includes('시니어'))return 0;
    if(planFeatureMatch(p,'senior'))return 1;
    return 2;
  }
  function purposeDevicePool(category,carrierValue){""",
"""  function purposeSeniorPlanRank(p,carrierName){
    const name=`${p?.name||''}`.toLowerCase().replace(/\\s+/g,'');
    if(carrierName==='SKT'&&name.includes('t플랜세이브'))return 0;
    if(carrierName==='KT'&&name.includes('베이직')&&name.includes('4gb')&&name.includes('65'))return 0;
    if(carrierName==='LGU+'&&name.includes('데이터플랜')&&name.includes('9gb')&&name.includes('시니어'))return 0;
    if(planFeatureMatch(p,'senior'))return 1;
    return 2;
  }
  function purposeIsSecondDevicePlan(p){
    const text=`${p?.name||''} ${p?.description||''}`.toLowerCase().replace(/\\s+/g,'');
    return /데이터(쉐어링|셰어링|함께쓰기|투게더)|함께쓰기|태블릿|tablet|아이패드|ipad|스마트기기|워치|watch|세컨드디바이스|2nddevice/.test(text);
  }
  function purposeSalesBrandRank(d,category){
    const text=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    const samsung=/삼성|samsung|갤럭시|galaxy/.test(text),apple=/애플|apple|아이폰|iphone/.test(text),xiaomi=/샤오미|xiaomi|홍미|redmi/.test(text);
    if(category==='premium'){if(samsung)return 0;if(apple)return 1;if(xiaomi)return 8;return 3}
    if(samsung)return 0;if(apple)return 3;if(xiaomi)return 9;return 2;
  }
  function purposeDevicePool(category,carrierValue){""",
'helper functions')

replace_once(
"""    if(category==='senior'){
      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    if(category==='kids'){
      return rows.sort(byNewest).slice(0,60);
    }
    return rows.sort((a,b)=>Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);""",
"""    if(category==='senior'){
      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    if(category==='kids'){
      return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||byNewest(a,b)).slice(0,60);
    }
    return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);""",
'device sorting')

replace_once(
"""    let rows=(catalog?.mobile_plans||[]).filter(p=>p.carrier===d.carrier&&ids.includes(p.id)&&hasAmount(p.monthly_fee));
    if(category==='senior'){
      rows=rows.filter(p=>Number(p.monthly_fee)>=33000&&Number(p.monthly_fee)<=55000);""",
"""    let rows=(catalog?.mobile_plans||[]).filter(p=>p.carrier===d.carrier&&ids.includes(p.id)&&hasAmount(p.monthly_fee)&&Number(p.monthly_fee)>=33000&&!purposeIsSecondDevicePlan(p));
    if(category==='senior'){
      rows=rows.filter(p=>Number(p.monthly_fee)<=55000);""",
'plan filters')

replace_once(
"""    if(purposeCategory==='senior'){
      rows.sort((a,b)=>purposeSeniorDeviceRank(a.d)-purposeSeniorDeviceRank(b.d)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||purposeSeniorPlanRank(a.p,a.d.carrier)-purposeSeniorPlanRank(b.p,b.d.carrier)||a.best.total24-b.best.total24);
    }else rows.sort((a,b)=>a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));""",
"""    if(purposeCategory==='senior'){
      rows.sort((a,b)=>purposeSeniorDeviceRank(a.d)-purposeSeniorDeviceRank(b.d)||purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||purposeSeniorPlanRank(a.p,a.d.carrier)-purposeSeniorPlanRank(b.p,b.d.carrier)||a.best.total24-b.best.total24);
    }else if(purposeCategory==='kids'||purposeCategory==='value'){
      rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
    }else rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));""",
'recommendation sorting')

path.write_text(text, encoding='utf-8')
print('updated assets/rates.js')
