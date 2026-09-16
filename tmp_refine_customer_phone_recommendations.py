from pathlib import Path

path=Path('assets/rates.js')
text=path.read_text(encoding='utf-8')

def replace_once(old,new,label):
    global text
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text=text.replace(old,new,1)

replace_once(
"""    value:'KT 갤럭시 Jump5와 SKT 갤럭시 퀀텀 시리즈 등 40~70만원대 삼성폰을 우선 보고, 6만원대 휴대폰 요금제로 24개월 부담을 비교합니다.',
    premium:'갤럭시 S·폴드/플립·아이폰 시리즈에서 8만원 이상 고요금제를 살펴보고, 실제 공시지원금이 40~50만원으로 확인되는 조합을 기기값 할인 중심으로 보여드립니다.'""",
"""    value:'KT 갤럭시 Jump5와 SKT 갤럭시 퀀텀 시리즈 등 40~70만원대 삼성폰을 우선 보고, 통신사별로 부담과 혜택의 균형이 좋은 요금제를 비교합니다. KT Jump5는 61,000원 구간을 우선 안내합니다.',
    premium:'아이폰18·갤럭시 S26 시리즈·폴드8/플립8을 중심으로 256GB를 우선 추천하고 512GB까지만 보여드립니다. 실제 공시지원금이 40~50만원으로 확인되는 고요금제 조합은 기기값 할인 중심으로 안내합니다.'""",
'purpose copy')

replace_once(
"""  function purposeIsPremiumDevice(d){
    const name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /아이폰|iphone|갤럭시s\\d|galaxys\\d|폴드|fold|플립|flip/.test(name);
  }""",
"""  function purposeIsPremiumDevice(d){
    const name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    const currentFamily=/아이폰18|iphone18|갤럭시s26|galaxys26|폴드8|fold8|플립8|flip8/.test(name);
    const storage=purposePremiumStorageGb(d);
    return currentFamily&&(storage===256||storage===512);
  }""",
'premium family filter')

replace_once(
"""  function purposeValuePlanTarget(carrierName){
    return carrierName==='SKT'?66000:carrierName==='KT'?65000:carrierName==='LGU+'?63000:65000;
  }
  function purposePremiumDeviceFamily(d){""",
"""  function purposeValuePlanTarget(carrierName){
    return carrierName==='SKT'?66000:carrierName==='KT'?61000:carrierName==='LGU+'?63000:63000;
  }
  function purposePremiumStorageGb(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(/2tb/.test(text))return 2048;
    if(/1tb/.test(text))return 1024;
    if(/512gb|512g/.test(text))return 512;
    if(/256gb|256g/.test(text))return 256;
    if(/128gb|128g/.test(text))return 128;
    return null;
  }
  function purposePremiumStorageRank(d){
    const storage=purposePremiumStorageGb(d);return storage===256?0:storage===512?1:9;
  }
  function purposePremiumDeviceFamily(d){""",
'value target and premium storage helpers')

replace_once(
"""    if(category==='premium'){
      return rows.sort((a,b)=>purposeSourceOrder(a)-purposeSourceOrder(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }""",
"""    if(category==='premium'){
      return rows.sort((a,b)=>purposePremiumStorageRank(a)-purposePremiumStorageRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }""",
'premium device sorting')

replace_once(
"""    }else if(category==='value'){
      rows=rows.filter(p=>Number(p.monthly_fee)>=60000&&Number(p.monthly_fee)<=69000);
      const target=purposeValuePlanTarget(d.carrier);
      return rows.sort((a,b)=>Math.abs(Number(a.monthly_fee)-target)-Math.abs(Number(b.monthly_fee)-target)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,40);""",
"""    }else if(category==='value'){
      const practical=rows.filter(p=>Number(p.monthly_fee)>=55000&&Number(p.monthly_fee)<=75000);if(practical.length)rows=practical;
      const target=purposeValuePlanTarget(d.carrier);
      return rows.sort((a,b)=>Math.abs(Number(a.monthly_fee)-target)-Math.abs(Number(b.monthly_fee)-target)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,40);""",
'value plan practical range')

replace_once(
"""    }else if(purposeCategory==='premium'){
      rows.sort((a,b)=>purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||Math.abs(Number(a.support.support)-450000)-Math.abs(Number(b.support.support)-450000)||Number(a.p.monthly_fee)-Number(b.p.monthly_fee));""",
"""    }else if(purposeCategory==='premium'){
      rows.sort((a,b)=>purposePremiumStorageRank(a.d)-purposePremiumStorageRank(b.d)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||Math.abs(Number(a.support.support)-450000)-Math.abs(Number(b.support.support)-450000)||Number(a.p.monthly_fee)-Number(b.p.monthly_fee));""",
'premium recommendation sorting')

path.write_text(text,encoding='utf-8')
print('customer-oriented value and premium recommendations updated')
