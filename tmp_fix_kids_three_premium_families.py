from pathlib import Path
import re

js_path=Path('assets/rates.js')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

# 1) Customer copy: exactly three kids models, clearer premium lineup.
old="""    kids:'ZEM폰·키즈폰 등 아이에게 맞는 최신 삼성 단말을 우선 살펴보고, 키즈·청소년용 요금제에서 공시지원금과 선택약정의 24개월 총 부담을 비교합니다.',
"""
new="""    kids:'현재 추천하는 키즈폰은 SKT ZEM폰 포켓피스·LGU+ 춘식이2·KT 폼폼푸린 키즈폰 3종입니다. 키즈·청소년용 요금제에서 공시지원금과 선택약정의 24개월 총 부담을 비교합니다.',
"""
if js.count(old)!=1:
    raise SystemExit(f'kids copy anchor count={js.count(old)}')
js=js.replace(old,new,1)

# 2) Fixed kids model ranking/filtering.
old="""  function purposeKidsDeviceRank(d){
    if(purposeIsDeprecatedKidsDevice(d))return 99;
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(d?.carrier==='KT'&&/폼폼푸린|pompompurin/.test(text))return 0;
    if(purposeIsKidsOnlyDevice(d))return 1;
    return deviceBrandKey(d)==='samsung'?2:3;
  }
"""
new="""  function purposeKidsDeviceRank(d){
    if(purposeIsDeprecatedKidsDevice(d))return 99;
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(d?.carrier==='SKT'&&/포켓피스|pocketpiece/.test(text))return 0;
    if(d?.carrier==='LGU+'&&/춘식이2|춘식이키즈2|choonsik2/.test(text))return 1;
    if(d?.carrier==='KT'&&/폼폼푸린|pompompurin/.test(text))return 2;
    return 99;
  }
"""
if js.count(old)!=1:
    raise SystemExit(f'kids rank anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""    else if(category==='kids')rows=rows.filter(d=>purposeIsLowCostDevice(d)||purposeIsKidsOnlyDevice(d));
"""
new="""    else if(category==='kids')rows=rows.filter(d=>purposeKidsDeviceRank(d)<99);
"""
if js.count(old)!=1:
    raise SystemExit(f'kids pool anchor count={js.count(old)}')
js=js.replace(old,new,1)

# 3) Premium family priority and one representative per family before fillers.
anchor="""  function purposePremiumLineupLabel(d){
"""
insert="""  function purposePremiumFamilyKey(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(/s26ultra/.test(text))return 's26ultra';
    if(/s26\\+|s26plus/.test(text))return 's26plus';
    if(/갤럭시s26|galaxys26/.test(text))return 's26';
    if(/폴드8|fold8/.test(text))return 'fold8';
    if(/플립8|flip8/.test(text))return 'flip8';
    if(/아이폰18|iphone18/.test(text))return 'iphone18';
    return 'other';
  }
  function purposePremiumFamilyRank(d){
    const order={s26:0,s26plus:1,s26ultra:2,fold8:3,flip8:4,iphone18:5};
    const key=purposePremiumFamilyKey(d);return Object.prototype.hasOwnProperty.call(order,key)?order[key]:99;
  }
"""
if js.count(anchor)!=1:
    raise SystemExit(f'premium lineup anchor count={js.count(anchor)}')
js=js.replace(anchor,insert+anchor,1)

old="""    if(category==='premium'){
      return rows.sort((a,b)=>purposePremiumStorageRank(a)-purposePremiumStorageRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
"""
new="""    if(category==='premium'){
      return rows.sort((a,b)=>purposePremiumFamilyRank(a)-purposePremiumFamilyRank(b)||purposePremiumStorageRank(a)-purposePremiumStorageRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
"""
if js.count(old)!=1:
    raise SystemExit(f'premium pool sort anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""    }else if(purposeCategory==='premium'){
      rows.sort((a,b)=>purposePremiumStorageRank(a.d)-purposePremiumStorageRank(b.d)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||Math.abs(Number(a.support.support)-450000)-Math.abs(Number(b.support.support)-450000)||Number(a.p.monthly_fee)-Number(b.p.monthly_fee));
    }else rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));
    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):purposeCategory==='premium'?purposePremiumDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }
    return unique;
"""
new="""    }else if(purposeCategory==='premium'){
      rows.sort((a,b)=>purposePremiumFamilyRank(a.d)-purposePremiumFamilyRank(b.d)||purposePremiumStorageRank(a.d)-purposePremiumStorageRank(b.d)||Math.abs(Number(a.support.support)-450000)-Math.abs(Number(b.support.support)-450000)||Number(a.p.monthly_fee)-Number(b.p.monthly_fee)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
    }else rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));
    if(purposeCategory==='premium'){
      const unique=[],seenFamilies=new Set();
      for(const row of rows){const family=purposePremiumFamilyKey(row.d);if(family==='other'||seenFamilies.has(family))continue;seenFamilies.add(family);unique.push(row);if(unique.length>=6)break}
      if(unique.length<6){for(const row of rows){if(unique.includes(row))continue;unique.push(row);if(unique.length>=6)break}}
      return unique;
    }
    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }
    return unique;
"""
if js.count(old)!=1:
    raise SystemExit(f'premium recommendation anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Cache bust reliably with simple string patterns.
html,n=re.subn(r'assets/rates\.js\?v=[^\"]+', 'assets/rates.js?v=20260916-25', html, count=1)
if n!=1:
    raise SystemExit('js cache bust failed')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('fixed kids three-model list and premium family diversity')
