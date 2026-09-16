from pathlib import Path

path = Path('assets/rates.js')
text = path.read_text(encoding='utf-8')


def replace_function(src: str, name: str, replacement: str) -> str:
    marker = f'  function {name}('
    start = src.find(marker)
    if start < 0:
        raise SystemExit(f'function not found: {name}')
    brace = src.find('{', start)
    if brace < 0:
        raise SystemExit(f'opening brace not found: {name}')
    depth = 0
    in_single = in_double = in_template = False
    escaped = False
    in_line_comment = in_block_comment = False
    i = brace
    while i < len(src):
        ch = src[i]
        nxt = src[i + 1] if i + 1 < len(src) else ''
        if in_line_comment:
            if ch == '\n':
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if ch == '*' and nxt == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if escaped:
            escaped = False
            i += 1
            continue
        if (in_single or in_double or in_template) and ch == '\\':
            escaped = True
            i += 1
            continue
        if not (in_single or in_double or in_template):
            if ch == '/' and nxt == '/':
                in_line_comment = True
                i += 2
                continue
            if ch == '/' and nxt == '*':
                in_block_comment = True
                i += 2
                continue
        if not (in_double or in_template) and ch == "'":
            in_single = not in_single
            i += 1
            continue
        if not (in_single or in_template) and ch == '"':
            in_double = not in_double
            i += 1
            continue
        if not (in_single or in_double) and ch == '`':
            in_template = not in_template
            i += 1
            continue
        if not (in_single or in_double or in_template):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    return src[:start] + replacement.rstrip() + src[end:]
        i += 1
    raise SystemExit(f'closing brace not found: {name}')

old_copy = "    senior:'출고가가 낮은 기종과 시니어 요금제를 우선 살펴보고, 기초연금 수급자 할인을 적용해 공시지원금과 선택약정 중 24개월 총 부담이 낮은 조건을 보여드립니다.',"
new_copy = "    senior:'A17·Wide8·Buddy5와 현재 등록된 최근 기종을 우선 살펴보고, 월 33,000원 이상 구간의 현재 요금제에서 24개월 총 예상비용을 비교합니다. 복지 할인은 실제 자격 확인 시 적용됩니다.',"
if old_copy not in text:
    raise SystemExit('senior copy marker not found')
text = text.replace(old_copy, new_copy, 1)

helper_marker = '  function purposeDevicePool(category,carrierValue){'
if 'function purposeObsoleteDevice(' not in text:
    helpers = r'''  function purposeObsoleteDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    return /쿠키즈미니|쿠키즈|cookizmini|블레이드|blade/.test(text);
  }
  function purposeSourceOrder(row){
    const order=Number(row?.source_order);return Number.isFinite(order)?order:999999;
  }
  function purposeSeniorDeviceRank(d){
    const name=`${d?.name||''} ${d?.model||''}`.toLowerCase().replace(/\s+/g,'');
    const model=`${d?.model_code||''}`.toLowerCase().replace(/\s+/g,'');
    if(name.includes('갤럭시a17')||name.includes('galaxya17')||/^sm-a175/.test(model))return 0;
    if(name.includes('wide8')||name.includes('와이드8'))return 1;
    if(name.includes('buddy5')||name.includes('버디5'))return 2;
    return 9;
  }
  function purposeSeniorDeviceFamily(d){
    const rank=purposeSeniorDeviceRank(d);if(rank===0)return'a17';if(rank===1)return'wide8';if(rank===2)return'buddy5';
    return `${d?.name||''}`.toLowerCase().replace(/\s+/g,'');
  }
  function purposeSeniorPlanTarget(carrierName){
    return carrierName==='SKT'?33000:carrierName==='KT'?37000:carrierName==='LGU+'?47000:33000;
  }
  function purposeSeniorPlanRank(p,carrierName){
    const name=`${p?.name||''}`.toLowerCase().replace(/\s+/g,'');
    if(carrierName==='SKT'&&name.includes('t플랜세이브'))return 0;
    if(carrierName==='KT'&&name.includes('베이직')&&name.includes('4gb')&&name.includes('65'))return 0;
    if(carrierName==='LGU+'&&name.includes('데이터플랜')&&name.includes('9gb')&&name.includes('시니어'))return 0;
    if(planFeatureMatch(p,'senior'))return 1;
    return 2;
  }
'''
    if helper_marker not in text:
        raise SystemExit('purpose device pool marker not found')
    text = text.replace(helper_marker, helpers + helper_marker, 1)

text = replace_function(text, 'purposeDevicePool', r'''  function purposeDevicePool(category,carrierValue){
    let rows=(catalog?.devices||[]).filter(d=>(carrierValue==='all'||d.carrier===carrierValue)&&hasAmount(d.retail_price)&&Number(d.retail_price)>0&&!purposeObsoleteDevice(d));
    if(category==='senior'||category==='kids')rows=rows.filter(purposeIsLowCostDevice);
    else if(category==='value')rows=rows.filter(d=>Number(d.retail_price)<=1000000&&!purposeIsPremiumDevice(d));
    else if(category==='premium')rows=rows.filter(purposeIsPremiumDevice);
    if(category==='senior'){
      return rows.sort((a,b)=>purposeSeniorDeviceRank(a)-purposeSeniorDeviceRank(b)||purposeSourceOrder(a)-purposeSourceOrder(b)||Number(a.retail_price)-Number(b.retail_price)).slice(0,180);
    }
    return rows.sort((a,b)=>Number(a.retail_price)-Number(b.retail_price)||byNewest(a,b)).slice(0,180);
  }''')

text = replace_function(text, 'purposePlanPool', r'''  function purposePlanPool(d,category,joinLabel){
    const ids=devicePlanIds(d,joinLabel);if(!ids.length)return[];
    let rows=(catalog?.mobile_plans||[]).filter(p=>p.carrier===d.carrier&&ids.includes(p.id)&&hasAmount(p.monthly_fee));
    if(category==='senior'){
      rows=rows.filter(p=>Number(p.monthly_fee)>=33000&&Number(p.monthly_fee)<=55000);
      if(!rows.length)return[];
      const preferred=rows.filter(p=>purposeSeniorPlanRank(p,d.carrier)===0);
      if(preferred.length)rows=preferred;
      else{
        const senior=rows.filter(p=>purposeSeniorPlanRank(p,d.carrier)===1);
        if(senior.length)rows=senior;
      }
      const target=purposeSeniorPlanTarget(d.carrier);
      return rows.sort((a,b)=>purposeSeniorPlanRank(a,d.carrier)-purposeSeniorPlanRank(b,d.carrier)||Math.abs(Number(a.monthly_fee)-target)-Math.abs(Number(b.monthly_fee)-target)||purposeSourceOrder(a)-purposeSourceOrder(b)||byOrder(a,b)).slice(0,40);
    }else if(category==='kids'){
      rows=rows.filter(p=>planFeatureMatch(p,'kids'));
    }else if(category==='value'){
      const value=rows.filter(p=>Number(p.monthly_fee)<=69000);if(value.length)rows=value;
    }else if(category==='premium'){
      const premium=rows.filter(p=>Number(p.monthly_fee)>=50000);if(premium.length)rows=premium;
    }
    return rows.sort((a,b)=>Number(a.monthly_fee)-Number(b.monthly_fee)||byOrder(a,b)).slice(0,40);
  }''')

text = replace_function(text, 'purposeCandidateForDevice', r'''  function purposeCandidateForDevice(d,category,joinLabel,usePension){
    const welfare=category==='senior'&&usePension?'basic_pension':'none',plans=purposePlanPool(d,category,joinLabel);let best=null;
    for(const p of plans){
      const support=scenarioForSelection(d,p,joinLabel,'support',24,welfare),contract=scenarioForSelection(d,p,joinLabel,'contract',24,welfare),known=[support,contract].filter(x=>x?.known).sort((a,b)=>a.total24-b.total24);
      if(!known.length)continue;const selected=known[0],row={d,p,best:selected,support,contract,welfare};
      if(category==='senior'){
        if(!best||purposeSeniorPlanRank(p,d.carrier)<purposeSeniorPlanRank(best.p,d.carrier)||(purposeSeniorPlanRank(p,d.carrier)===purposeSeniorPlanRank(best.p,d.carrier)&&row.best.total24<best.best.total24))best=row;
      }else if(!best||row.best.total24<best.best.total24)best=row;
    }
    return best;
  }''')

text = replace_function(text, 'purposeRecommendations', r'''  function purposeRecommendations(){
    const carrierValue=$('purpose-carrier')?.value||'all',joinLabel=$('purpose-join')?.value||'기기변경',usePension=!!$('purpose-pension')?.checked,rows=[];
    purposeDevicePool(purposeCategory,carrierValue).forEach(d=>{const row=purposeCandidateForDevice(d,purposeCategory,joinLabel,usePension);if(row)rows.push(row)});
    if(purposeCategory==='senior'){
      rows.sort((a,b)=>purposeSeniorDeviceRank(a.d)-purposeSeniorDeviceRank(b.d)||purposeSourceOrder(a.d)-purposeSourceOrder(b.d)||purposeSeniorPlanRank(a.p,a.d.carrier)-purposeSeniorPlanRank(b.p,b.d.carrier)||a.best.total24-b.best.total24);
    }else rows.sort((a,b)=>a.best.total24-b.best.total24||Number(a.d.retail_price)-Number(b.d.retail_price));
    const unique=[],seen=new Set();for(const row of rows){
      const key=purposeCategory==='senior'?purposeSeniorDeviceFamily(row.d):`${row.d.carrier}|${row.d.name}`;
      if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=6)break;
    }
    return unique;
  }''')

checks = [
    'purposeObsoleteDevice', 'purposeSeniorDeviceRank', 'purposeSeniorPlanRank',
    "Number(p.monthly_fee)>=33000", "name.includes('t플랜세이브')",
    "name.includes('베이직')", "name.includes('데이터플랜')",
    'A17·Wide8·Buddy5'
]
for token in checks:
    if token not in text:
        raise SystemExit(f'missing expected token after patch: {token}')

path.write_text(text, encoding='utf-8')
print('Senior purpose recommendation refresh applied')
