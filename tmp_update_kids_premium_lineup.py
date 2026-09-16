from pathlib import Path
import re

js_path=Path('assets/rates.js')
css_path=Path('assets/rates.css')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

old="""    premium:'아이폰18·갤럭시 S26 시리즈·폴드8/플립8을 중심으로 256GB를 우선 추천하고 512GB까지만 보여드립니다. 실제 공시지원금이 40~50만원으로 확인되는 고요금제 조합은 기기값 할인 중심으로 안내합니다.'
"""
new="""    premium:'아이폰18 시리즈·갤럭시 S26 / S26+ / S26 Ultra·Z Fold8 / Z Flip8을 중심으로 256GB를 우선 추천하고 512GB까지만 보여드립니다. 실제 공시지원금이 40~50만원으로 확인되는 조합은 기기값 할인 중심으로 안내합니다.'
"""
if js.count(old)!=1:
    raise SystemExit(f'premium copy anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""  function purposeIsKidsOnlyDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /무너2|무너키즈|mooner2|mooner|zem폰|zemphone|포켓피스|pocketpiece|키즈폰|폼폼푸린/.test(text);
  }
  function purposeKidsDeviceRank(d){
    if(purposeIsKidsOnlyDevice(d))return 0;
    return deviceBrandKey(d)==='samsung'?1:2;
  }
"""
new="""  function purposeIsKidsOnlyDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /무너2|무너키즈|mooner2|mooner|zem폰|zemphone|포켓피스|pocketpiece|키즈폰|폼폼푸린|pompompurin/.test(text);
  }
  function purposeIsDeprecatedKidsDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /신비키즈|신비아파트|신비폰|sinbi/.test(text);
  }
  function purposeKidsDeviceRank(d){
    if(purposeIsDeprecatedKidsDevice(d))return 99;
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(d?.carrier==='KT'&&/폼폼푸린|pompompurin/.test(text))return 0;
    if(purposeIsKidsOnlyDevice(d))return 1;
    return deviceBrandKey(d)==='samsung'?2:3;
  }
"""
if js.count(old)!=1:
    raise SystemExit(f'kids helper anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""  function purposePremiumDeviceFamily(d){
    const name=String(d?.name||'').toLowerCase().replace(/\\b(128gb|256gb|512gb|1tb|2tb)\\b/gi,'').replace(/\\s+/g,' ').trim();
    return `${d?.carrier||''}|${name}`;
  }
"""
new="""  function purposePremiumDeviceFamily(d){
    const name=String(d?.name||'').toLowerCase().replace(/\\b(128gb|256gb|512gb|1tb|2tb)\\b/gi,'').replace(/\\s+/g,' ').trim();
    return `${d?.carrier||''}|${name}`;
  }
  function purposePremiumLineupLabel(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(/s26ultra/.test(text))return '갤럭시 S26 시리즈 · Ultra';
    if(/s26\\+|s26plus/.test(text))return '갤럭시 S26 시리즈 · S26+';
    if(/갤럭시s26|galaxys26|s26/.test(text))return '갤럭시 S26 시리즈 · S26';
    if(/폴드8|fold8/.test(text))return '갤럭시 Z 폴더블8 · Fold8';
    if(/플립8|flip8/.test(text))return '갤럭시 Z 폴더블8 · Flip8';
    if(/아이폰18|iphone18/.test(text))return 'iPhone 18 시리즈';
    return '프리미엄 라인업';
  }
"""
if js.count(old)!=1:
    raise SystemExit(f'premium family anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""    let rows=(catalog?.devices||[]).filter(d=>(carrierValue==='all'||d.carrier===carrierValue)&&hasAmount(d.retail_price)&&Number(d.retail_price)>0&&!purposeObsoleteDevice(d));
"""
new="""    let rows=(catalog?.devices||[]).filter(d=>(carrierValue==='all'||d.carrier===carrierValue)&&hasAmount(d.retail_price)&&Number(d.retail_price)>0&&!purposeObsoleteDevice(d)&&!purposeIsDeprecatedKidsDevice(d));
"""
if js.count(old)!=1:
    raise SystemExit(f'device pool anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""    else if(category==='kids')rows=rows.filter(purposeIsLowCostDevice);
"""
new="""    else if(category==='kids')rows=rows.filter(d=>purposeIsLowCostDevice(d)||purposeIsKidsOnlyDevice(d));
"""
if js.count(old)!=1:
    raise SystemExit(f'kids pool anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""      const name=document.createElement('strong');name.textContent=row.d.name;const plan=document.createElement('em');plan.textContent=row.p.name;
"""
new="""      const name=document.createElement('strong');name.textContent=row.d.name;const lineup=document.createElement('span');lineup.className='purpose-lineup';lineup.textContent=purposeCategory==='premium'?purposePremiumLineupLabel(row.d):'';const plan=document.createElement('em');plan.textContent=row.p.name;
"""
if js.count(old)!=1:
    raise SystemExit(f'card name anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""      card.append(top,name,plan,total,detail,compare,best,actions);box.appendChild(card);
"""
new="""      card.append(top,name);if(purposeCategory==='premium'&&lineup.textContent)card.append(lineup);card.append(plan,total,detail,compare,best,actions);box.appendChild(card);
"""
if js.count(old)!=1:
    raise SystemExit(f'card append anchor count={js.count(old)}')
js=js.replace(old,new,1)

marker='/* Premium lineup label 2026-09-16 */'
if marker not in css:
    css += "\n\n/* Premium lineup label 2026-09-16 */\n.purpose-lineup{display:block;margin-top:-2px;font-size:.7rem;font-weight:900;color:var(--teal);line-height:1.45}\n"

html,n=re.subn(r'assets/rates\.js\?v=[^"]+', 'assets/rates.js?v=20260916-24', html, count=1)
if n!=1:
    raise SystemExit('js cache bust failed')
html,n=re.subn(r'assets/rates\.css\?v=[^"]+', 'assets/rates.css?v=20260916-16', html, count=1)
if n!=1:
    raise SystemExit('css cache bust failed')

js_path.write_text(js,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('kids lifecycle and premium lineup patch applied')
