from pathlib import Path
import re

path=Path('assets/rates.js')
text=path.read_text(encoding='utf-8')

def replace_once(old,new,label):
    global text
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text=text.replace(old,new,1)

replace_once(
"""    value:'삼성 중저가 기종을 우선 살펴보고, 휴대폰용 월 33,000원 이상 요금제에서 기기값과 통신요금을 함께 비교합니다.',
    premium:'프리미엄 휴대폰과 월 33,000원 이상 휴대폰용 요금제에서 공시지원금과 선택약정의 24개월 총 예상비용을 비교합니다.'""",
"""    value:'KT 갤럭시 Jump5와 SKT 갤럭시 퀀텀 시리즈 등 40~70만원대 삼성폰을 우선 보고, 6만원대 휴대폰 요금제로 24개월 부담을 비교합니다.',
    premium:'갤럭시 S·폴드/플립·아이폰 시리즈에서 8만원 이상 고요금제를 살펴보고, 실제 공시지원금이 40~50만원으로 확인되는 조합을 기기값 할인 중심으로 보여드립니다.'""",
'category copy')

replace_once(
"""  function purposeIsPremiumDevice(d){
    const price=Number(d?.retail_price)||0,name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    return price>=900000||/아이폰|iphone|울트라|ultra|폴드|fold|플립|flip|\\bpro\\b|프로|max|갤럭시\\s*s\\d|galaxy\\s*s\\d/.test(name);
  }""",
"""  function purposeIsPremiumDevice(d){
    const name=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /아이폰|iphone|갤럭시s\\d|galaxys\\d|폴드|fold|플립|flip/.test(name);
  }""",
'premium device filter')

replace_once(
"""  function purposeSalesBrandRank(d,category){
    const text=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    const samsung=/삼성|samsung|갤럭시|galaxy/.test(text),apple=/애플|apple|아이폰|iphone/.test(text),xiaomi=/샤오미|xiaomi|홍미|redmi/.test(text);
    if(category==='premium'){if(samsung)return 0;if(apple)return 1;if(xiaomi)return 8;return 3}
    if(samsung)return 0;if(apple)return 3;if(xiaomi)return 9;return 2;
  }
  function purposeDevicePool(category,carrierValue){""",
"""  function purposeSalesBrandRank(d,category){
    const text=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    const samsung=/삼성|samsung|갤럭시|galaxy/.test(text),apple=/애플|apple|아이폰|iphone/.test(text),xiaomi=/샤오미|xiaomi|홍미|redmi/.test(text);
    if(category==='premium'){if(samsung)return 0;if(apple)return 1;if(xiaomi)return 8;return 3}
    if(samsung)return 0;if(apple)return 3;if(xiaomi)return 9;return 2;
  }
  function purposeValueDeviceRank(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(d?.carrier==='KT'&&(text.includes('jump5')||text.includes('점프5')))return 0;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀7')||text.includes('quantum7')))return 0;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀6')||text.includes('quantum6')))return 1;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀5')||text.includes('quantum5')))return 2;
    return deviceBrandKey(d)==='samsung'?4:9;
  }
  function purposeValuePlanTarget(carrierName){
    return carrierName==='SKT'?66000:carrierName==='KT'?65000:carrierName==='LGU+'?63000:65000;
  }
  function purposePremiumDeviceFamily(d){
    const name=String(d?.name||'').toLowerCase().replace(/\\b(128gb|256gb|512gb|1tb|2tb)\\b/gi,'').replace(/\\s+/g,' ').trim();
    return `${d?.carrier||''}|${name}`;
  }
  function purposePremiumSupportFit(s){
    return !!s?.known&&s.method==='support'&&Number(s.support)>=400000&&Number(s.support)<=500000;
  }
  function purposeDevicePool(category,carrierValue){""",
'value/premium helpers')

replace_once(
"""    if(category==='senior'||category==='kids')rows=rows.filter(purposeIsLowCostDevice);
    else if(category==='value')rows=rows.filter(d=>Number(d.retail_price)<=1000000&&!purposeIsPremiumDevice(d));
    else if(category==='premium')rows=rows.filter(purposeIsPremiumDevice);
    if(category==='senior'){
      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    if(category==='kids'){
      return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||byNewest(a,b)).slice(0,60);
    }
    return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);""",
"""    if(category==='senior'||category==='kids')rows=rows.filter(purposeIsLowCostDevice);
    else if(category==='value')rows=rows.filter(d=>{
      const price=Number(d.retail_price)||0,rank=purposeValueDeviceRank(d);
      return rank<9&&(rank<=2||(price>=400000&&price<=730000));
    });
    else if(category==='premium')rows=rows.filter(purposeIsPremiumDevice);
    if(category==='senior'){
      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    if(category==='kids'){
      return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||byNewest(a,b)).slice(0,60);
    }
    if(category==='value'){
      return rows.sort((a,b)=>purposeValueDeviceRank(a)-purposeValueDeviceRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,120);
    }
    if(category==='premium'){
      return rows.sort((a,b)=>purposeSourceOrder(a)-purposeSourceOrder(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);""",
'device pool')

replace_once(
"""    }else if(category==='value'){
      const value=rows.filter(p=>Number(p.monthly_fee)<=69000);if(value.length)rows=value;
    }else if(category==='premium'){
      const premium=rows.filter(p=>Number(p.monthly_fee)>=50000);if(premium.length)rows=premium;
    }
    return rows.sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee)||byOrder(a,b)).slice(0,40);""",
"""    }else if(category==='value'){
      rows=rows.filter(p=>Number(p.monthly_fee)>=59000&&Number(p.monthly_fee)<=69000);
      const target=purposeValuePlanTarget(d.carrier);
      return rows.sort((a,b)=>Math.abs(Number(a.monthly_fee)-target)-Math.abs(Number(b.monthly_fee)-target)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,40);
    }else if(category==='premium'){
      rows=rows.filter(p=>Number(p.monthly_fee)>=80000);
      return rows.sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,80);
    }
    return rows.sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee)||byOrder(a,b)).slice(0,40);""",
'plan pool')

replace_once(
"""      if(category==='senior'){
        if(!best||purposeSeniorPlanRank(p,d.carrier)<purposeSeniorPlanRank(best.p,d.carrier)||(purposeSeniorPlanRank(p,d.carrier)===purposeSeniorPlanRank(best.p,d.carrier)&&row.best.total24<best.best.total24))best=row;
      }else if(!best||row.best.total24<best.best.total24)best=row;""",
"""      if(category==='senior'){
        if(!best||purposeSeniorPlanRank(p,d.carrier)<purposeSeniorPlanRank(best.p,d.carrier)||(purposeSeniorPlanRank(p,d.carrier)===purposeSeniorPlanRank(best.p,d.carrier)&&row.best.total24<best.best.total24))best=row;
      }else if(category==='value'){
        const target=purposeValuePlanTarget(d.carrier),rowDiff=Math.abs(Number(p.monthly_fee)-target),bestDiff=best?Math.abs(Number(best.p.monthly_fee)-target):Infinity;
        if(!best||rowDiff<bestDiff||(rowDiff===bestDiff&&row.best.total24<best.best.total24))best=row;
      }else if(category==='premium'){
        if(!purposePremiumSupportFit(support))continue;
        row.best=support;
        const rowSupportDiff=Math.abs(Number(support.support)-450000),bestSupportDiff=best?Math.abs(Number(best.support.support)-450000):Infinity;
        if(!best||rowSupportDiff<bestSupportDiff||(rowSupportDiff===bestSupportDiff&&Number(p.monthly_fee)<Number(best.p.monthly_fee))||(rowSupportDiff===bestSupportDiff&&Number(p.monthly_fee)===Number(best.p.monthly_fee)&&support.total24<best.support.total24))best=row;
      }else if(!best||row.best.total24<best.best.total24)best=row;""",
'candidate selection')

replace_once(
"""    if(purposeCategory==='senior'){
      rows.sort((a,b)=>purposeSeniorDeviceRank(a.d)-purposeSeniorDeviceRank(b.d)||purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||purposeSeniorPlanRank(a.p,a.d.carrier)-purposeSeniorPlanRank(b.p,b.d.carrier)||a.best.total24-b.best.total24);
    }else if(purposeCategory==='kids'||purposeCategory==='value'){
      rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
    }else rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));
    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }""",
"""    if(purposeCategory==='senior'){
      rows.sort((a,b)=>purposeSeniorDeviceRank(a.d)-purposeSeniorDeviceRank(b.d)||purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||purposeSeniorPlanRank(a.p,a.d.carrier)-purposeSeniorPlanRank(b.p,b.d.carrier)||a.best.total24-b.best.total24);
    }else if(purposeCategory==='value'){
      rows.sort((a,b)=>purposeValueDeviceRank(a.d)-purposeValueDeviceRank(b.d)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||Math.abs(Number(a.p.monthly_fee)-purposeValuePlanTarget(a.d.carrier))-Math.abs(Number(b.p.monthly_fee)-purposeValuePlanTarget(b.d.carrier))||a.best.total24-b.best.total24);
    }else if(purposeCategory==='kids'){
      rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
    }else if(purposeCategory==='premium'){
      rows.sort((a,b)=>purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||Math.abs(Number(a.support.support)-450000)-Math.abs(Number(b.support.support)-450000)||Number(a.p.monthly_fee)-Number(b.p.monthly_fee));
    }else rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));
    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):purposeCategory==='premium'?purposePremiumDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }""",
'recommendation sorting')

replace_once(
"""    if(row.welfare==='basic_pension')lines.push(`기초연금 수급자 할인: -${won(row.best.welfare?.amount||0)}`);
    lines.push('※ 실제 가입 가능 여부·자격·지원금·프로모션은 상담 시점에 최종 확인합니다.');return lines.join('\\n');""",
"""    if(row.welfare==='basic_pension')lines.push(`기초연금 수급자 할인: -${won(row.best.welfare?.amount||0)}`);
    if(purposeCategory==='premium'&&row.support?.known)lines.push(`공시지원금: -${won(row.support.support)}`,`지원 후 기기값: ${won(row.support.principal)}`);
    lines.push('※ 실제 가입 가능 여부·자격·지원금·프로모션은 상담 시점에 최종 확인합니다.');return lines.join('\\n');""",
'quote support emphasis')

replace_once(
"""      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${$('purpose-join')?.value||'기기변경'}`;rank.textContent=purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');top.append(badge,rank);
      const name=document.createElement('strong');name.textContent=row.d.name;const plan=document.createElement('em');plan.textContent=row.p.name;
      const total=document.createElement('div');total.className='purpose-card-total';const totalLabel=document.createElement('span'),totalValue=document.createElement('b');totalLabel.textContent='예상 월 납부액';totalValue.textContent=won(row.best.monthly);total.append(totalLabel,totalValue);
      const detail=document.createElement('div');detail.className='purpose-card-detail';detail.append(purposeCardLine('월 기기값 · 이자 포함',won(row.best.inst.monthly)),purposeCardLine('할인 후 통신요금',won(row.best.service)));if(row.welfare==='basic_pension')detail.append(purposeCardLine('기초연금 수급자 할인','-'+won(row.best.welfare?.amount||0),'welfare-line'));
      const compare=document.createElement('div');compare.className='purpose-method-compare';const sText=row.support?.known?won(row.support.monthly):'매장 확인',cText=row.contract?.known?won(row.contract.monthly):'매장 확인';compare.append(purposeCardLine('공시지원 월',sText),purposeCardLine('선택약정 월',cText));
      const best=document.createElement('div');best.className='purpose-best';best.textContent=`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준 · 24개월 총 예상비용 ${won(row.best.total24)}`;""",
"""      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${$('purpose-join')?.value||'기기변경'}`;rank.textContent=purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):purposeCategory==='value'?(index===0?'가성비 추천':'추천 조합'):purposeCategory==='premium'?(index===0?'공시지원 중심':'기기값 할인 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');top.append(badge,rank);
      const name=document.createElement('strong');name.textContent=row.d.name;const plan=document.createElement('em');plan.textContent=row.p.name;
      const total=document.createElement('div');total.className='purpose-card-total';const totalLabel=document.createElement('span'),totalValue=document.createElement('b');totalLabel.textContent='예상 월 납부액';totalValue.textContent=won(row.best.monthly);total.append(totalLabel,totalValue);
      const detail=document.createElement('div');detail.className='purpose-card-detail';if(purposeCategory==='premium'&&row.support?.known)detail.append(purposeCardLine('공시지원금','-'+won(row.support.support)),purposeCardLine('지원 후 기기값',won(row.support.principal)));detail.append(purposeCardLine('월 기기값 · 이자 포함',won(row.best.inst.monthly)),purposeCardLine('할인 후 통신요금',won(row.best.service)));if(row.welfare==='basic_pension')detail.append(purposeCardLine('기초연금 수급자 할인','-'+won(row.best.welfare?.amount||0),'welfare-line'));
      const compare=document.createElement('div');compare.className='purpose-method-compare';const sText=row.support?.known?won(row.support.monthly):'매장 확인',cText=row.contract?.known?won(row.contract.monthly):'매장 확인';compare.append(purposeCardLine('공시지원 월',sText),purposeCardLine('선택약정 월',cText));
      const best=document.createElement('div');best.className='purpose-best';best.textContent=purposeCategory==='premium'&&row.support?.known?`기기값 할인 중심 · 공시지원금 ${won(row.support.support)} · 지원 후 기기값 ${won(row.support.principal)}`:`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준 · 24개월 총 예상비용 ${won(row.best.total24)}`;""",
'card support emphasis')

path.write_text(text,encoding='utf-8')
print('updated assets/rates.js')
