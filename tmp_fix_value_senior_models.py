from pathlib import Path
import re

js_path=Path('assets/rates.js')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

# Customer copy
old="""    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5 등 삼성폰을 우선 살펴보고, 사용량과 월 부담의 균형이 좋은 휴대폰 요금제로 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',
"""
new="""    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5를 우선 살펴보고, 스마트폰 사용이 익숙하지 않은 분께는 스타일폴더2도 함께 안내합니다. 사용량과 월 부담의 균형이 좋은 요금제로 24개월 총 예상비용을 비교하며, 복지 할인은 실제 자격 확인 시 적용됩니다.',
"""
if js.count(old)!=1: raise SystemExit(f'senior copy anchor count={js.count(old)}')
js=js.replace(old,new,1)
old="""    value:'KT 갤럭시 Jump5와 SKT 갤럭시 퀀텀 시리즈 등 40~70만원대 삼성폰을 우선 보고, 통신사별로 부담과 혜택의 균형이 좋은 요금제를 비교합니다. KT Jump5는 61,000원 구간을 우선 안내합니다.',
"""
new="""    value:'갤럭시 퀀텀7·Jump5·A27·A37을 중심으로 가격과 성능의 균형을 비교합니다. 통신사별로 부담과 혜택이 자연스러운 요금제를 우선하며, KT Jump5는 61,000원 구간을 먼저 살펴봅니다.',
"""
if js.count(old)!=1: raise SystemExit(f'value copy anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Senior ranking: A17 -> Wide8 -> Buddy5 -> SKT StyleFolder2 AT-M140S
old="""    if(name.includes('buddy5')||name.includes('버디5'))return 2;
    return 9;
  }
  function purposeSeniorDeviceFamily(d){
    const rank=purposeSeniorDeviceRank(d);if(rank===0)return'a17';if(rank===1)return'wide8';if(rank===2)return'buddy5';
    return `${d?.name||''}`.toLowerCase().replace(/\\s+/g,'');
  }
"""
new="""    if(name.includes('buddy5')||name.includes('버디5'))return 2;
    if(d?.carrier==='SKT'&&(name.includes('스타일폴더2')||model==='at-m140s'))return 3;
    return 9;
  }
  function purposeSeniorDeviceFamily(d){
    const rank=purposeSeniorDeviceRank(d);if(rank===0)return'a17';if(rank===1)return'wide8';if(rank===2)return'buddy5';if(rank===3)return'stylefolder2';
    return `${d?.name||''}`.toLowerCase().replace(/\\s+/g,'');
  }
"""
if js.count(old)!=1: raise SystemExit(f'senior rank anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Value families fixed to four named models. A27 will become live automatically when catalog data appears.
old="""  function purposeValueDeviceRank(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(d?.carrier==='KT'&&(text.includes('jump5')||text.includes('점프5')))return 0;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀7')||text.includes('quantum7')))return 0;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀6')||text.includes('quantum6')))return 1;
    if(d?.carrier==='SKT'&&(text.includes('퀀텀5')||text.includes('quantum5')))return 2;
    return deviceBrandKey(d)==='samsung'?4:9;
  }
"""
new="""  function purposeValueFamilyKey(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    if(d?.carrier==='SKT'&&(text.includes('퀀텀7')||text.includes('quantum7')))return 'quantum7';
    if(d?.carrier==='KT'&&(text.includes('jump5')||text.includes('점프5')))return 'jump5';
    if(/갤럭시a27|galaxya27|\\ba27\\b/.test(text))return 'a27';
    if(/갤럭시a37|galaxya37|\\ba37\\b/.test(text))return 'a37';
    return 'other';
  }
  function purposeValueDeviceRank(d){
    const order={quantum7:0,jump5:1,a27:2,a37:3};
    const key=purposeValueFamilyKey(d);return Object.prototype.hasOwnProperty.call(order,key)?order[key]:99;
  }
"""
if js.count(old)!=1: raise SystemExit(f'value rank anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""    else if(category==='value')rows=rows.filter(d=>{
      const price=Number(d.retail_price)||0,rank=purposeValueDeviceRank(d);
      return rank<9&&(rank<=2||(price>=400000&&price<800000));
    });
"""
new="""    else if(category==='value')rows=rows.filter(d=>purposeValueDeviceRank(d)<99);
"""
if js.count(old)!=1: raise SystemExit(f'value pool anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Value recommendations: exactly target families, with safe A27 placeholder while catalog is missing.
old="""    if(purposeCategory==='premium'){
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
new="""    if(purposeCategory==='premium'){
      const unique=[],seenFamilies=new Set();
      for(const row of rows){const family=purposePremiumFamilyKey(row.d);if(family==='other'||seenFamilies.has(family))continue;seenFamilies.add(family);unique.push(row);if(unique.length>=6)break}
      if(unique.length<6){for(const row of rows){if(unique.includes(row))continue;unique.push(row);if(unique.length>=6)break}}
      return unique;
    }
    if(purposeCategory==='value'){
      const desired=['quantum7','jump5','a27','a37'],byFamily=new Map();
      for(const row of rows){const family=purposeValueFamilyKey(row.d);if(family!=='other'&&!byFamily.has(family))byFamily.set(family,row)}
      const out=[];for(const family of desired){
        if(byFamily.has(family))out.push(byFamily.get(family));
        else if(family==='a27'&&carrierValue==='all')out.push({placeholder:true,family:'a27',d:{carrier:'매장 확인',name:'갤럭시 A27'}});
      }
      return out;
    }
    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }
    return unique;
"""
if js.count(old)!=1: raise SystemExit(f'recommendation unique anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Placeholder quote helper before card renderer.
anchor="""  function renderPurposeRecommendations(){
"""
insert="""  function purposePlaceholderQuoteText(row){
    if(!row?.placeholder)return '';
    const joinLabel=$('purpose-join')?.value||'기기변경';
    return ['[웅비통신 용도별 추천 상담]','용도: 가성비폰',`가입유형: ${joinLabel}`,`기종: ${row.d?.name||'갤럭시 A27'}`,'현재 조건: 매장 확인','※ 현재 등록된 판매 데이터에 계산 가능한 조건이 없어 상담 시점에 확인합니다.'].join('\\n');
  }
"""
if js.count(anchor)!=1: raise SystemExit(f'render anchor count={js.count(anchor)}')
js=js.replace(anchor,insert+anchor,1)

# Render placeholder safely without fabricated amounts.
old="""    rows.forEach((row,index)=>{
      const card=document.createElement('article');card.className='purpose-card';
"""
new="""    rows.forEach((row,index)=>{
      if(row.placeholder){
        const card=document.createElement('article');card.className='purpose-card purpose-card-placeholder';
        const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent='매장 확인';rank.textContent='가성비 후보';top.append(badge,rank);
        const name=document.createElement('strong');name.textContent=row.d?.name||'갤럭시 A27';
        const plan=document.createElement('em');plan.textContent='현재 등록된 판매 조건 확인 중';
        const total=document.createElement('div');total.className='purpose-card-total';const totalLabel=document.createElement('span'),totalValue=document.createElement('b');totalLabel.textContent='예상 월 납부액';totalValue.textContent='매장 확인';total.append(totalLabel,totalValue);
        const detail=document.createElement('div');detail.className='purpose-card-detail';detail.append(purposeCardLine('출고가·지원금','매장 확인'),purposeCardLine('가입 가능 요금제','매장 확인'));
        const best=document.createElement('div');best.className='purpose-best';best.textContent='확인되지 않은 금액은 임의로 계산하지 않습니다.';
        const actions=document.createElement('div');actions.className='purpose-card-actions';const consultBtn=document.createElement('button');consultBtn.type='button';consultBtn.textContent='이 모델 상담';consultBtn.className='primary';consultBtn.addEventListener('click',async()=>{const ok=await copyCustomerConsultText(purposePlaceholderQuoteText(row));if(ok)window.location.href='http://pf.kakao.com/_nWwNT/chat'});actions.append(consultBtn);
        card.append(top,name,plan,total,detail,best,actions);box.appendChild(card);return;
      }
      const card=document.createElement('article');card.className='purpose-card';
"""
if js.count(old)!=1: raise SystemExit(f'card render anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Cache bust
html,n=re.subn(r'assets/rates\\.js\\?v=[^\"]+', 'assets/rates.js?v=20260916-27', html, count=1)
if n!=1: raise SystemExit('js cache bust failed')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('updated value four-model lineup and senior stylefolder2')
