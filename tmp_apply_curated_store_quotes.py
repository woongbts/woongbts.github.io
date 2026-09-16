from pathlib import Path
import re

js_path=Path('assets/rates.js')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

# Customer-facing copy follows the actual store quote sheets supplied on 2026-09-16.
old="""    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5 등 삼성폰을 우선 살펴보고, 사용량과 월 부담의 균형이 좋은 휴대폰 요금제로 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',
"""
new="""    senior:'매장에서 자주 안내하는 A17·Wide8·Buddy5를 우선 살펴보고, 스마트폰 사용이 익숙하지 않은 분께는 스타일폴더2도 함께 안내합니다. 사용량과 월 부담을 함께 살펴보며, 복지 할인은 실제 자격 확인 시 적용됩니다.',
"""
if js.count(old)!=1: raise SystemExit(f'senior copy anchor count={js.count(old)}')
js=js.replace(old,new,1)
old="""    value:'KT 갤럭시 Jump5와 SKT 갤럭시 퀀텀 시리즈 등 40~70만원대 삼성폰을 우선 보고, 통신사별로 부담과 혜택의 균형이 좋은 요금제를 비교합니다. KT Jump5는 61,000원 구간을 우선 안내합니다.',
"""
new="""    value:'매장에서 실제로 자주 안내하는 갤럭시 Jump5·A37·퀀텀7의 기기변경 견적을 한눈에 비교합니다. 확인된 매장 견적을 기준으로 월 기기값과 통신요금을 함께 보여드립니다.',
"""
if js.count(old)!=1: raise SystemExit(f'value copy anchor count={js.count(old)}')
js=js.replace(old,new,1)

anchor="""  function purposeIsLowCostDevice(d){
"""
insert="""  const PURPOSE_CURATED_QUOTES={
    stylefolder2:{category:'senior',carrier:'SKT',deviceId:'SKT-XD-2636',name:'스타일폴더2',modelCode:'AT-M140S',price:237600,planName:'T플랜 세이브',planFee:33000,deviceMonthly:10520,installmentFee:14880,contractDiscount:8250,welfareAmount:12100},
    jump5:{category:'value',carrier:'KT',deviceId:'KT-XD-2895',name:'갤럭시 Jump5 5G',modelCode:'SM-A276K',price:545600,planName:'베이직 4GB',planFee:37000,deviceMonthly:24160,installmentFee:34240,contractDiscount:9250,welfareAmount:0},
    a37:{category:'value',carrier:'KT',deviceId:'KT-XD-2893',name:'갤럭시 A37 5G',modelCode:'SM-A376NK',price:598400,planName:'베이직 4GB',planFee:37000,deviceMonthly:26490,installmentFee:37360,contractDiscount:9250,welfareAmount:0},
    quantum7:{category:'value',carrier:'SKT',deviceId:'SKT-XD-2944',name:'갤럭시 퀀텀7',modelCode:'SM-A576S',price:717200,planName:'라이트 39',planFee:39000,deviceMonthly:31750,installmentFee:44800,contractDiscount:9750,welfareAmount:0}
  };
  function purposeCuratedRow(key,usePension=false){
    const q=PURPOSE_CURATED_QUOTES[key];if(!q)return null;
    const welfareAmount=key==='stylefolder2'&&usePension?Number(q.welfareAmount||0):0;
    const service=Math.max(0,Number(q.planFee)-Number(q.contractDiscount)-welfareAmount),monthly=Number(q.deviceMonthly)+service;
    const welfare=welfareAmount>0?'basic_pension':'none';
    const best={known:true,method:'contract',price:Number(q.price),planFee:Number(q.planFee),support:0,contractDiscount:Number(q.contractDiscount),principal:Number(q.price),inst:{monthly:Number(q.deviceMonthly),total:Number(q.price)+Number(q.installmentFee)},service,welfare:{amount:welfareAmount},monthly,total24:monthly*24};
    return {curated:true,joinLabel:'기기변경',d:{id:q.deviceId,carrier:q.carrier,name:q.name,model_code:q.modelCode,retail_price:q.price},p:{id:`curated-${key}`,carrier:q.carrier,name:q.planName,monthly_fee:q.planFee},best,support:{known:false},contract:best,welfare};
  }
  function purposeCuratedValueRows(carrierValue,joinLabel){
    if(joinLabel!=='기기변경')return [];
    return ['jump5','a37','quantum7'].map(key=>purposeCuratedRow(key,false)).filter(row=>row&&(carrierValue==='all'||row.d.carrier===carrierValue));
  }
"""
if js.count(anchor)!=1: raise SystemExit(f'curated insert anchor count={js.count(anchor)}')
js=js.replace(anchor,insert+anchor,1)

# Short-circuit value recommendations to the three exact store quote sheets.
old="""  function purposeRecommendations(){
    const carrierValue=$('purpose-carrier')?.value||'all',joinLabel=$('purpose-join')?.value||'기기변경',usePension=!!$('purpose-pension')?.checked,rows=[];
    purposeDevicePool(purposeCategory,carrierValue).forEach(d=>{const row=purposeCandidateForDevice(d,purposeCategory,joinLabel,usePension);if(row)rows.push(row)});
"""
new="""  function purposeRecommendations(){
    const carrierValue=$('purpose-carrier')?.value||'all',joinLabel=$('purpose-join')?.value||'기기변경',usePension=!!$('purpose-pension')?.checked,rows=[];
    if(purposeCategory==='value')return purposeCuratedValueRows(carrierValue,joinLabel);
    purposeDevicePool(purposeCategory,carrierValue).forEach(d=>{const row=purposeCandidateForDevice(d,purposeCategory,joinLabel,usePension);if(row)rows.push(row)});
"""
if js.count(old)!=1: raise SystemExit(f'purposeRecommendations start anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Add StyleFolder2 as the fourth senior recommendation for the verified device-change quote.
old="""    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }
    return unique;
  }
"""
new="""    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }
    if(purposeCategory==='senior'&&joinLabel==='기기변경'&&(carrierValue==='all'||carrierValue==='SKT')){
      const filtered=unique.filter(row=>String(row?.d?.model_code||'').toUpperCase()!=='AT-M140S'&&!String(row?.d?.name||'').replace(/\\s+/g,'').includes('스타일폴더2'));
      const style=purposeCuratedRow('stylefolder2',usePension);if(style)filtered.splice(Math.min(3,filtered.length),0,style);return filtered.slice(0,6);
    }
    return unique;
  }
"""
if js.count(old)!=1: raise SystemExit(f'senior insertion anchor count={js.count(old)}')
js=js.replace(old,new,1)

# Make curated cards explicit and prevent direct-calculator mismatch with static verified quotes.
old="""      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${$('purpose-join')?.value||'기기변경'}`;rank.textContent=purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):purposeCategory==='value'?(index===0?'가성비 추천':'추천 조합'):purposeCategory==='premium'?(index===0?'공시지원 중심':'기기값 할인 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');top.append(badge,rank);
"""
new="""      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${row.joinLabel||$('purpose-join')?.value||'기기변경'}`;rank.textContent=row.curated?'실제 매장 견적':purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):purposeCategory==='value'?(index===0?'가성비 추천':'추천 조합'):purposeCategory==='premium'?(index===0?'공시지원 중심':'기기값 할인 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');top.append(badge,rank);
"""
if js.count(old)!=1: raise SystemExit(f'card top anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""      const actions=document.createElement('div');actions.className='purpose-card-actions';const detailBtn=document.createElement('button'),consultBtn=document.createElement('button');detailBtn.type='button';consultBtn.type='button';detailBtn.textContent='자세히 계산';consultBtn.textContent='이 조건 상담';consultBtn.className='primary';detailBtn.addEventListener('click',()=>applyPurposeResult(row));consultBtn.addEventListener('click',async()=>{const ok=await copyCustomerConsultText(purposeQuoteText(row));if(ok)window.location.href='http://pf.kakao.com/_nWwNT/chat'});actions.append(detailBtn,consultBtn);
"""
new="""      const actions=document.createElement('div');actions.className='purpose-card-actions';const detailBtn=document.createElement('button'),consultBtn=document.createElement('button');detailBtn.type='button';consultBtn.type='button';detailBtn.textContent='자세히 계산';consultBtn.textContent='이 조건 상담';consultBtn.className='primary';detailBtn.addEventListener('click',()=>applyPurposeResult(row));consultBtn.addEventListener('click',async()=>{const ok=await copyCustomerConsultText(purposeQuoteText(row));if(ok)window.location.href='http://pf.kakao.com/_nWwNT/chat'});if(row.curated){consultBtn.style.gridColumn='1 / -1';actions.append(consultBtn)}else actions.append(detailBtn,consultBtn);
"""
if js.count(old)!=1: raise SystemExit(f'actions anchor count={js.count(old)}')
js=js.replace(old,new,1)

html,n=re.subn(r'assets/rates\.js\?v=[^\"]+', 'assets/rates.js?v=20260916-28', html, count=1)
if n!=1: raise SystemExit('js cache bust failed')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('Applied curated ZeroNote store quote cards')
