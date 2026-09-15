from pathlib import Path
import re

html_path=Path('rates.html')
js_path=Path('assets/rates.js')
css_path=Path('assets/rates.css')
html=html_path.read_text(encoding='utf-8')
js=js_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')

# --- HTML: quick recommendation mode ---
if 'id="quick-recommend"' not in html:
    old='''          <div class="rate-panel-head"><div><span class="eyebrow">휴대폰</span><h2>공시지원 / 선택약정 비교</h2></div><span class="updated" id="catalog-updated">데이터 기준 확인 중</span></div>\n          <div class="rate-grid">'''
    new='''          <div class="rate-panel-head"><div><span class="eyebrow">휴대폰</span><h2>공시지원 / 선택약정 비교</h2></div><span class="updated" id="catalog-updated">데이터 기준 확인 중</span></div>
          <div class="mobile-mode-switch" role="tablist" aria-label="휴대폰 견적 방식">
            <button type="button" class="active" data-mobile-mode="direct">직접 계산하기</button>
            <button type="button" data-mobile-mode="quick">간편 추천받기</button>
          </div>
          <section class="quick-recommend" id="quick-recommend" hidden>
            <div class="quick-title"><strong>조건만 고르면 추천 3개</strong><span>현재 등록된 기종·가입 가능 요금제·공시지원금을 이용해 월 납부액이 낮은 후보를 찾습니다.</span></div>
            <div class="quick-fields">
              <label>통신사<select id="quick-carrier"><option>SKT</option><option>KT</option><option>LGU+</option></select></label>
              <label>가입유형<select id="quick-join"><option>기기변경</option><option>번호이동</option><option>신규가입</option></select></label>
              <label>선호 브랜드<select id="quick-brand"><option value="all">상관없음</option><option value="samsung">삼성 갤럭시</option><option value="apple">애플 아이폰</option></select></label>
              <label>데이터 사용량<select id="quick-data"><option value="5">5GB 이상</option><option value="10" selected>10GB 이상</option><option value="50">50GB 이상</option><option value="unlimited">무제한</option></select></label>
              <label>월 예산<select id="quick-budget"><option value="0">예산 제한 없음</option><option value="50000">5만원 이하</option><option value="70000" selected>7만원 이하</option><option value="100000">10만원 이하</option><option value="150000">15만원 이하</option></select></label>
            </div>
            <button type="button" class="quick-find" id="quick-find">추천 3개 찾기</button>
            <div class="quick-results" id="quick-results"><p>조건을 선택한 뒤 추천을 눌러주세요.</p></div>
          </section>
          <div class="rate-grid" id="direct-mobile-grid">'''
    if old not in html:
        raise SystemExit('mobile panel marker not found')
    html=html.replace(old,new,1)

# --- HTML: device comparison ---
if 'id="device-compare-tool"' not in html:
    marker='''              <div class="quote-tools">'''
    block='''              <section class="device-compare-tool" id="device-compare-tool">
                <div class="compare-head"><div><strong>기종 2~3개 비교</strong><span>현재 선택한 요금제를 같은 통신사의 다른 기종에도 적용해 월 납부액과 24개월 총비용을 비교합니다.</span></div></div>
                <div class="device-compare-selects">
                  <label>현재 기종<select id="device-compare-1" disabled><option value="">기종 선택 후 표시</option></select></label>
                  <label>비교 기종 1<select id="device-compare-2"><option value="">비교 기종 선택</option></select></label>
                  <label>비교 기종 2<select id="device-compare-3"><option value="">비교 기종 선택</option></select></label>
                </div>
                <div class="device-compare-results" id="device-compare-results"><p>기종과 요금제를 선택한 뒤 비교할 기종을 추가해 주세요.</p></div>
              </section>
              <div class="quote-tools">'''
    if marker not in html:
        raise SystemExit('quote-tools marker not found')
    html=html.replace(marker,block,1)

html=html.replace('assets/rates.css?v=20260915-4','assets/rates.css?v=20260916-1')
html=html.replace('assets/rates.css?v=20260915-5','assets/rates.css?v=20260916-1')
html=html.replace('assets/rates.js?v=20260915-14','assets/rates.js?v=20260916-1')
html=html.replace('assets/rates.js?v=20260915-15','assets/rates.js?v=20260916-1')

# --- JS helpers ---
helper_marker="  function setUpdated(id,date){const el=$(id);if(el)el.textContent=date?`상품 데이터 ${date} 기준`:'상품 데이터 확인 중'}\n"
if 'function scenarioForSelection(' not in js:
    helper=r'''  let suspendUrlSync=true;
  function devicePlanIds(d,joinLabel){
    if(!d)return [];
    const byJoin=d.eligible_plan_ids_by_join_type||{};
    const source=Array.isArray(byJoin[joinLabel])?byJoin[joinLabel]:d.eligible_plan_ids;
    return Array.isArray(source)?source:[];
  }
  function planEligibleForDevice(d,p,joinLabel){
    if(!d||!p)return false;
    const ids=devicePlanIds(d,joinLabel);return !ids.length||ids.includes(p.id);
  }
  function supportForSelection(d,p,joinLabel){
    if(!d||!p)return null;
    const exact=(catalog?.mobile_supports||[]).find(s=>s.device_id===d.id&&s.plan_id===p.id&&s.join_type===joinLabel);
    if(exact&&hasAmount(exact.public_support))return exact;
    const rule=(supportSchedules||[]).find(r=>r.carrier===d.carrier&&Array.isArray(r.device_ids)&&r.device_ids.includes(d.id)&&Array.isArray(r.join_types)&&r.join_types.includes(joinLabel)&&r.amounts&&hasAmount(r.amounts[p.id]));
    return rule?{device_id:d.id,join_type:joinLabel,plan_id:p.id,public_support:Number(rule.amounts[p.id])}:null;
  }
  function scenarioForSelection(d,p,joinLabel,method,months,welfareKey){
    if(!d||!p||!planEligibleForDevice(d,p,joinLabel)||!hasAmount(d.retail_price)||Number(d.retail_price)<=0)return null;
    const price=Number(d.retail_price),planFee=Number(p.monthly_fee)||0,term=Number(months)||24,supportRow=supportForSelection(d,p,joinLabel);
    if(method==='support'&&!supportRow)return {known:false};
    const support=method==='support'?Number(supportRow?.public_support||0):0;
    const principal=Math.max(0,price-support),inst=installment(principal,term);
    const contractDiscount=method==='contract'?planFee*contractRate:0;
    const afterContract=Math.max(0,planFee-contractDiscount),welfare=welfareDiscount(welfareKey||'none',afterContract),service=Math.max(0,afterContract-welfare.amount);
    return {known:true,method,price,planFee,support,contractDiscount,principal,inst,service,welfare,monthly:inst.monthly+service,total24:inst.total+service*24};
  }
  function planDataGb(p){
    const s=String(p?.data||'').toLowerCase().replace(/\s+/g,'');
    if(!s)return null;if(s.includes('무제한')||s.includes('unlimited'))return Infinity;
    let m=s.match(/([0-9]+(?:\.[0-9]+)?)gb/);if(m)return Number(m[1]);
    m=s.match(/([0-9]+(?:\.[0-9]+)?)mb/);if(m)return Number(m[1])/1024;
    return null;
  }
  function brandMatch(d,brand){
    if(brand==='all')return true;
    const s=`${d?.name||''} ${d?.manufacturer||''} ${d?.model_code||''}`.toLowerCase();
    if(brand==='apple')return s.includes('아이폰')||s.includes('iphone')||s.includes('apple')||s.includes('애플');
    if(brand==='samsung')return s.includes('갤럭시')||s.includes('galaxy')||s.includes('samsung')||s.includes('삼성');
    return true;
  }
'''
    if helper_marker not in js: raise SystemExit('setUpdated marker not found')
    js=js.replace(helper_marker,helper_marker+'\n'+helper,1)

# currentSupport generalized
js=re.sub(r"  function currentSupport\(\)\{.*?\n  \}\n  function installment", "  function currentSupport(){return supportForSelection(currentDevice(),currentPlan(),joinType.value)}\n  function installment", js, count=1, flags=re.S)

# eligiblePlans generalized
js=js.replace("  function eligiblePlans(){const d=currentDevice();if(!d)return[];const byJoin=d.eligible_plan_ids_by_join_type||{};const source=Array.isArray(byJoin[joinType.value])?byJoin[joinType.value]:d.eligible_plan_ids;const ids=Array.isArray(source)?new Set(source):null;return (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&(!ids||ids.has(p.id))).sort(byOrder)}",
              "  function eligiblePlans(){const d=currentDevice();if(!d)return[];const raw=devicePlanIds(d,joinType.value),ids=raw.length?new Set(raw):null;return (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&(!ids||ids.has(p.id))).sort(byOrder)}")

# sync compare selectors from fillDevices
if 'fillDeviceCompareOptions();\n    fillPlans();' not in js:
    js=js.replace("    if(q&&!rows.length)deviceSelect.options[0].textContent='검색 결과 없음';\n    fillPlans();",
                  "    if(q&&!rows.length)deviceSelect.options[0].textContent='검색 결과 없음';\n    fillDeviceCompareOptions();\n    fillPlans();",1)

# mobileScenario generalized
js=re.sub(r"  function mobileScenario\(method\)\{.*?\n  \}\n  function syncComparison", "  function mobileScenario(method){return scenarioForSelection(currentDevice(),currentPlan(),joinType.value,method,monthsSelect.value,welfareType.value)}\n  function syncComparison", js, count=1, flags=re.S)

# quote includes shareable URL
if '견적 링크:' not in js:
    js=js.replace("    lines.push('추가지원금·재고·프로모션은 매장에서 최종 확인 부탁드립니다.');\n    return lines.join('\\n');",
                  "    lines.push('추가지원금·재고·프로모션은 매장에서 최종 확인 부탁드립니다.');\n    lines.push(`견적 링크: ${buildQuoteUrl()}`);\n    return lines.join('\\n');",1)
js=js.replace("navigator.share({title:'웅비통신 간편견적',text,url:location.href})","navigator.share({title:'웅비통신 간편견적',text,url:buildQuoteUrl()})")

# Advanced features block
if 'function buildQuoteUrl()' not in js:
    marker="  function syncMobile(){syncMobileCore();syncComparison();syncQuoteBar()}\n"
    advanced=r'''  function buildQuoteUrl(){
    const u=new URL(location.href),d=currentDevice(),p=currentPlan();
    ['tab','c','j','d','p','m','mo','w'].forEach(k=>u.searchParams.delete(k));
    if(d&&p){
      u.searchParams.set('tab','mobile');u.searchParams.set('c',carrier.value);u.searchParams.set('j',joinType.value);
      u.searchParams.set('d',d.id);u.searchParams.set('p',p.id);u.searchParams.set('m',discountMethod.value);
      u.searchParams.set('mo',monthsSelect.value||'24');u.searchParams.set('w',welfareType.value||'none');
    }
    return u.toString();
  }
  function syncQuoteUrl(){
    if(suspendUrlSync)return;
    const d=currentDevice(),p=currentPlan();if(!d||!p)return;
    history.replaceState(null,'',buildQuoteUrl());
  }
  function restoreQuoteFromUrl(){
    const q=new URLSearchParams(location.search),did=q.get('d'),pid=q.get('p');if(!did||!pid)return false;
    const c=q.get('c');if(['SKT','KT','LGU+'].includes(c))carrier.value=c;
    const j=q.get('j');if(['기기변경','번호이동','신규가입'].includes(j))joinType.value=j;
    const method=q.get('m');if(['support','contract'].includes(method))discountMethod.value=method;
    const w=q.get('w');if([...welfareType.options].some(o=>o.value===w))welfareType.value=w;
    const d=(catalog?.devices||[]).find(x=>x.id===did&&x.carrier===carrier.value);if(!d)return false;
    deviceSearch.value=d.name||'';fillDevices();deviceSelect.value=did;fillPlans();
    if(![...planSelect.options].some(o=>o.value===pid))return false;
    planSelect.value=pid;
    const mo=q.get('mo');if([...monthsSelect.options].some(o=>o.value===mo))monthsSelect.value=mo;
    syncMobile();return true;
  }
  function setMobileMode(mode){
    const quick=mode==='quick';
    document.querySelectorAll('[data-mobile-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mobileMode===mode));
    const q=$('quick-recommend'),grid=$('direct-mobile-grid');if(q)q.hidden=!quick;if(grid)grid.hidden=quick;
    if(!quick)syncQuoteBar();else{const bar=$('mobile-quote-bar');if(bar)bar.hidden=true;document.body.classList.remove('has-mobile-quote-bar')}
  }
  function runQuickRecommend(){
    const qc=$('quick-carrier').value,qj=$('quick-join').value,brand=$('quick-brand').value,dataNeed=$('quick-data').value,budget=Number($('quick-budget').value)||0;
    const minGb=dataNeed==='unlimited'?Infinity:Number(dataNeed)||0;
    const devices=(catalog?.devices||[]).filter(d=>d.carrier===qc&&brandMatch(d,brand)&&hasAmount(d.retail_price)&&Number(d.retail_price)>0).sort(byNewest).slice(0,120);
    const candidates=[];
    devices.forEach(d=>{
      const ids=devicePlanIds(d,qj);let plans=(catalog?.mobile_plans||[]).filter(p=>p.carrier===qc&&(!ids.length||ids.includes(p.id)));
      plans=plans.filter(p=>{const gb=planDataGb(p);return minGb===Infinity?gb===Infinity:(gb===Infinity||(gb!==null&&gb>=minGb))});
      let best=null;
      plans.forEach(p=>{
        const s=scenarioForSelection(d,p,qj,'support',24,'none'),c=scenarioForSelection(d,p,qj,'contract',24,'none');
        [s,c].forEach(sc=>{if(!sc?.known)return;if(budget&&sc.monthly>budget)return;if(!best||sc.monthly<best.sc.monthly)best={d,p,sc}})
      });
      if(best)candidates.push(best);
    });
    candidates.sort((a,b)=>a.sc.monthly-b.sc.monthly||a.sc.total24-b.sc.total24);
    const top=candidates.slice(0,3),box=$('quick-results');
    if(!top.length){box.innerHTML='<p>조건에 맞는 자동 추천 후보를 찾지 못했습니다. 예산이나 데이터 조건을 넓혀보세요.</p>';return}
    box.innerHTML=top.map((x,i)=>`<button type="button" class="quick-result-card" data-device="${x.d.id}" data-plan="${x.p.id}" data-method="${x.sc.method}" data-carrier="${qc}" data-join="${qj}"><span>추천 ${i+1}</span><strong>${x.d.name}</strong><em>${x.p.name}</em><b>${won(x.sc.monthly)} / 월</b><small>${x.sc.method==='support'?'공시지원금':'선택약정'} · 24개월 총 ${won(x.sc.total24)}</small></button>`).join('');
  }
  function applyQuickRecommendation(btn){
    carrier.value=btn.dataset.carrier;joinType.value=btn.dataset.join;discountMethod.value=btn.dataset.method;
    const d=(catalog?.devices||[]).find(x=>x.id===btn.dataset.device);deviceSearch.value=d?.name||'';fillDevices();
    deviceSelect.value=btn.dataset.device;fillPlans();planSelect.value=btn.dataset.plan;monthsSelect.value='24';welfareType.value='none';
    setMobileMode('direct');syncMobile();document.getElementById('mobile-result')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function fillDeviceCompareOptions(){
    const sels=[$('device-compare-1'),$('device-compare-2'),$('device-compare-3')].filter(Boolean),d=currentDevice();if(!sels.length)return;
    const rows=(catalog?.devices||[]).filter(x=>x.carrier===carrier.value).sort(byNewest);
    sels.forEach((sel,idx)=>{const keep=idx===0?(d?.id||''):sel.value;clearSelect(sel,idx===0?'기종 선택 후 표시':'비교 기종 선택');rows.forEach(x=>option(sel,x.id,x.name));sel.value=[...sel.options].some(o=>o.value===keep)?keep:'';sel.disabled=idx===0});
    syncDeviceCompare();
  }
  function syncDeviceCompare(){
    const box=$('device-compare-results');if(!box)return;const p=currentPlan();if(!p){box.innerHTML='<p>기종과 요금제를 먼저 선택해 주세요.</p>';return}
    const ids=[$('device-compare-1')?.value,$('device-compare-2')?.value,$('device-compare-3')?.value].filter(Boolean),seen=new Set(),cards=[];
    ids.forEach(id=>{if(seen.has(id))return;seen.add(id);const d=(catalog?.devices||[]).find(x=>x.id===id);if(!d)return;const sc=scenarioForSelection(d,p,joinType.value,discountMethod.value,monthsSelect.value,welfareType.value);
      if(!sc){cards.push(`<div class="device-compare-card"><strong>${d.name}</strong><span>현재 요금제 가입 불가</span></div>`);return}
      if(!sc.known){cards.push(`<div class="device-compare-card"><strong>${d.name}</strong><span>공시지원금 매장 확인</span></div>`);return}
      cards.push(`<div class="device-compare-card"><strong>${d.name}</strong><b>${won(sc.monthly)} / 월</b><span>출고가 ${won(d.retail_price)}</span><span>24개월 총 ${won(sc.total24)}</span></div>`)
    });
    box.innerHTML=cards.length?cards.join(''):'<p>비교할 기종을 추가해 주세요.</p>';
  }
  function syncMobile(){syncMobileCore();syncComparison();syncQuoteBar();syncDeviceCompare();syncQuoteUrl()}
'''
    if marker not in js: raise SystemExit('syncMobile marker not found')
    js=js.replace(marker,advanced,1)

# Event handlers for v2
if "$('quick-find')?.addEventListener" not in js:
    event_marker="  $('mobile-quote-consult')?.addEventListener('click',consultQuote);\n"
    extra=r'''  document.querySelectorAll('[data-mobile-mode]').forEach(b=>b.addEventListener('click',()=>setMobileMode(b.dataset.mobileMode)));
  $('quick-find')?.addEventListener('click',runQuickRecommend);
  $('quick-results')?.addEventListener('click',e=>{const btn=e.target.closest('.quick-result-card');if(btn)applyQuickRecommendation(btn)});
  [$('device-compare-2'),$('device-compare-3')].filter(Boolean).forEach(el=>el.addEventListener('change',syncDeviceCompare));
'''
    if event_marker not in js: raise SystemExit('event marker not found')
    js=js.replace(event_marker,event_marker+extra,1)

# Data load: restore sharable quote, then enable URL sync
old_load="    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();\n"
if old_load in js and 'restoreQuoteFromUrl();suspendUrlSync=false' not in js:
    js=js.replace(old_load,"    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();\n    restoreQuoteFromUrl();suspendUrlSync=false;syncMobile();\n",1)

# --- CSS ---
if '/* Advanced consulting v2 */' not in css:
    css += r'''

/* Advanced consulting v2 */
.mobile-mode-switch{display:flex;gap:8px;margin:0 0 14px}.mobile-mode-switch button{flex:1;min-height:44px;border:1px solid #cddcdf;background:#fff;color:#476068;border-radius:12px;font-weight:900}.mobile-mode-switch button.active{background:var(--navy);border-color:var(--navy);color:#fff}.quick-recommend{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(16,60,82,.05)}.quick-title{display:grid;gap:4px;margin-bottom:14px}.quick-title strong{font-size:1.05rem}.quick-title span{font-size:.75rem;color:var(--muted);line-height:1.5}.quick-fields{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.quick-fields label{display:grid;gap:6px;font-size:.75rem;font-weight:850;color:#46616a}.quick-fields select{min-height:44px;border:1px solid #cddcdf;border-radius:11px;background:#fff;padding:8px;color:var(--ink);font:inherit}.quick-find{width:100%;margin-top:12px;min-height:46px;border:0;border-radius:12px;background:var(--teal);color:#fff;font-weight:900}.quick-results{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.quick-results>p{grid-column:1/-1;margin:0;padding:12px;background:#f5f9fa;border-radius:12px;color:var(--muted);font-size:.76rem}.quick-result-card{display:grid;gap:5px;text-align:left;border:1px solid #d5e3e5;background:#f8fbfb;border-radius:14px;padding:13px;color:var(--ink)}.quick-result-card span{font-size:.65rem;font-weight:900;color:var(--teal)}.quick-result-card strong{font-size:.93rem}.quick-result-card em{font-style:normal;font-size:.7rem;color:var(--muted)}.quick-result-card b{font-size:1.1rem;color:var(--teal)}.quick-result-card small{font-size:.66rem;color:#60777f}.device-compare-tool{margin-top:16px;padding:16px;border:1px solid #d5e3e5;border-radius:16px;background:#fff}.device-compare-selects{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.device-compare-selects label{display:grid;gap:5px;font-size:.7rem;font-weight:850;color:#60777f}.device-compare-selects select{min-height:42px;border:1px solid #cddcdf;border-radius:10px;background:#fff;padding:8px;color:var(--ink)}.device-compare-results{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.device-compare-results>p{grid-column:1/-1;margin:0;padding:10px;background:#f8fbfb;border-radius:10px;color:var(--muted);font-size:.7rem}.device-compare-card{display:grid;gap:4px;padding:12px;border-radius:12px;background:#f8fbfb;border:1px solid #dce7e9}.device-compare-card strong{font-size:.8rem}.device-compare-card b{color:var(--teal);font-size:1rem}.device-compare-card span{font-size:.65rem;color:var(--muted)}
@media(max-width:760px){.quick-fields{grid-template-columns:1fr 1fr}.quick-fields label:last-child{grid-column:1/-1}.quick-results{grid-template-columns:1fr}.device-compare-selects,.device-compare-results{grid-template-columns:1fr}.mobile-mode-switch{position:sticky;top:76px;z-index:20;background:var(--bg);padding:6px 0}.quick-recommend{padding:16px;border-radius:16px}}
'''

html_path.write_text(html,encoding='utf-8')
js_path.write_text(js,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
print('consulting v2 patch applied')
