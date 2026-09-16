from pathlib import Path
import re

ROOT=Path('.')
HTML=ROOT/'rates.html'
JS=ROOT/'assets/rates.js'
CSS=ROOT/'assets/rates.css'

html=HTML.read_text(encoding='utf-8')
js=JS.read_text(encoding='utf-8')
css=CSS.read_text(encoding='utf-8')

new_panel='''        <section class="rate-panel" data-panel="studyphone">
          <div class="rate-panel-head"><div><span class="eyebrow">공신폰</span><h2>KT M모바일 · 갤럭시 A17 공신폰</h2></div><span class="updated" id="studyphone-updated">상품 데이터 확인 중</span></div>
          <div class="studyphone-hero studyphone-detail-layout">
            <div class="studyphone-product">
              <div class="studyphone-brand">KT M모바일 전용</div>
              <div class="studyphone-device">
                <span>Samsung Galaxy</span>
                <strong>갤럭시 A17 공신폰</strong>
                <b>SM-A175</b>
              </div>
              <div class="studyphone-tags"><span>LTE</span><span>128GB</span><span>6GB RAM</span><span>5,000mAh</span></div>
              <p>공신폰 문의가 많은 고객을 위해 실제 취급 중인 단일 기종과 확인된 전용 요금제만 안내합니다.</p>
              <div class="studyphone-specs">
                <div><span>통신사</span><strong>KT M모바일</strong></div>
                <div><span>기종</span><strong>갤럭시 A17 공신폰</strong></div>
                <div><span>모델명</span><strong>SM-A175</strong></div>
                <div><span>출고가</span><strong id="studyphone-retail-view">319,000원</strong></div>
              </div>
              <div class="studyphone-picker">
                <label>공신폰 요금제
                  <select id="studyphone-plan"><option value="">요금제를 선택하세요</option></select>
                </label>
                <div class="studyphone-plan-info">
                  <div><span>통화</span><strong id="studyphone-voice">—</strong></div>
                  <div><span>문자</span><strong id="studyphone-sms">—</strong></div>
                  <div><span>데이터</span><strong id="studyphone-data">—</strong></div>
                  <div><span>월 기본료</span><strong id="studyphone-plan-fee">—</strong></div>
                </div>
              </div>
            </div>
            <div class="rate-card studyphone-result">
              <span class="result-label">예상 월 납부액</span>
              <strong id="studyphone-total">—</strong>
              <div class="result-breakdown">
                <div><span>출고가</span><b id="studyphone-retail">319,000원</b></div>
                <div><span>공시지원금</span><b id="studyphone-support">—</b></div>
                <div><span>할부원금</span><b id="studyphone-principal">—</b></div>
                <div><span>월 단말금 · 24개월</span><b id="studyphone-device-monthly">—</b></div>
                <div><span>총 할부이자 · 연 5.9%</span><b id="studyphone-interest">—</b></div>
                <div><span>요금제 월정액</span><b id="studyphone-service-fee">—</b></div>
              </div>
              <p id="studyphone-summary">요금제를 선택하면 공시지원금, 할부원금과 월 예상 납부액을 계산합니다.</p>
              <div class="studyphone-note">공시지원금만 단말대금에서 차감해 계산합니다. 판매점 수수료·리베이트는 고객 계산과 화면에 반영하지 않습니다.</div>
              <div class="rate-warning">단말 할부는 24개월·연 5.9% 원리금균등 방식의 예상치입니다. 공시지원금과 실제 개통 조건은 상담 시점에 변경될 수 있습니다.</div>
              <div class="rate-actions"><a href="tel:0513437677">공신폰 전화상담</a><a class="kakao" href="http://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의</a></div>
            </div>
          </div>
          <section class="studyphone-plan-table-wrap">
            <div class="studyphone-list-head"><div><span class="eyebrow">요금제 7종</span><h3>공신폰 요금제 한눈에 보기</h3></div><p>아래 요금제만 공신폰 계산에 사용합니다. 카드를 누르면 위 견적에 바로 반영됩니다.</p></div>
            <div class="studyphone-plan-list" id="studyphone-plan-list"><p>요금제 데이터를 불러오고 있습니다.</p></div>
          </section>
        </section>
'''

pattern=r'        <section class="rate-panel" data-panel="studyphone">.*?        </section>\n\n        <section class="rate-panel" data-panel="mvno">'
if not re.search(pattern, html, flags=re.S):
    raise SystemExit('studyphone panel marker not found')
html=re.sub(pattern,new_panel+'\n        <section class="rate-panel" data-panel="mvno">',html,count=1,flags=re.S)
html=html.replace('assets/rates.css?v=20260916-11','assets/rates.css?v=20260916-12')
html=html.replace('assets/rates.js?v=20260916-16','assets/rates.js?v=20260916-17')

# add studyphone data state
old="  let mvnoData={providers:[],plans:[]};\n  let prepaidData={providers:[],plans:[]};"
new="  let mvnoData={providers:[],plans:[]};\n  let studyphoneData={meta:{},device:null,plans:[]};\n  let prepaidData={providers:[],plans:[]};"
if old not in js:
    raise SystemExit('data state marker not found')
js=js.replace(old,new,1)

study_js=r'''
  // 공신폰 · KT M모바일 갤럭시 A17
  const studyphonePlan=$('studyphone-plan');
  function studyphoneCurrentPlan(){return (studyphoneData?.plans||[]).find(p=>p.id===studyphonePlan?.value)||null}
  function studyphoneInstallment(principal,months,apr){
    principal=Math.max(0,Number(principal)||0);months=Math.max(1,Number(months)||24);apr=Number(apr)||0;
    if(!principal)return {monthly:0,total:0,fee:0};
    if(!apr){const monthly=principal/months;return {monthly,total:principal,fee:0}}
    const r=apr/12,factor=Math.pow(1+r,months),monthly=principal*r*factor/(factor-1),total=monthly*months;
    return {monthly,total,fee:Math.max(0,total-principal)};
  }
  function studyphoneScenario(plan){
    const d=studyphoneData?.device;if(!d||!plan)return null;
    const retail=Number(d.retail_price)||0,support=Math.max(0,Math.min(retail,Number(plan.public_support)||0)),principal=Math.max(0,retail-support);
    const inst=studyphoneInstallment(principal,Number(d.installment_months)||24,Number(d.installment_apr)||0);
    const service=Number(plan.monthly_fee)||0;
    return {retail,support,principal,inst,service,total:inst.monthly+service};
  }
  function renderStudyphonePlanList(){
    const box=$('studyphone-plan-list');if(!box)return;
    const d=studyphoneData?.device,rows=studyphoneData?.plans||[];
    if(!d||!rows.length){box.innerHTML='<p>요금제 데이터를 불러오지 못했습니다.</p>';return}
    box.innerHTML=rows.map(p=>{const s=studyphoneScenario(p);return `<button type="button" class="studyphone-plan-card${studyphonePlan?.value===p.id?' active':''}" data-studyphone-plan="${p.id}"><span>${p.name}</span><strong>${won(p.monthly_fee)}</strong><small>통화 ${p.voice} · 문자 ${p.sms} · 데이터 ${p.data}</small><div><em>공시지원금</em><b>${won(p.public_support)}</b></div><div><em>할부원금</em><b>${won(s.principal)}</b></div><div class="studyphone-card-total"><em>월 예상 납부액</em><b>${won(s.total)}</b></div></button>`}).join('');
  }
  function syncStudyphone(){
    const d=studyphoneData?.device,p=studyphoneCurrentPlan();
    if(!d){return}
    $('studyphone-retail-view').textContent=won(d.retail_price);$('studyphone-retail').textContent=won(d.retail_price);
    if(!p){
      ['studyphone-voice','studyphone-sms','studyphone-data','studyphone-plan-fee','studyphone-total','studyphone-support','studyphone-principal','studyphone-device-monthly','studyphone-interest','studyphone-service-fee'].forEach(id=>{const el=$(id);if(el)el.textContent='—'});
      $('studyphone-summary').textContent='요금제를 선택하면 공시지원금, 할부원금과 월 예상 납부액을 계산합니다.';renderStudyphonePlanList();return;
    }
    const s=studyphoneScenario(p),months=Number(d.installment_months)||24;
    $('studyphone-voice').textContent=p.voice||'—';$('studyphone-sms').textContent=p.sms||'—';$('studyphone-data').textContent=p.data||'—';$('studyphone-plan-fee').textContent=won(p.monthly_fee);
    $('studyphone-total').textContent=won(s.total);$('studyphone-support').textContent=won(s.support);$('studyphone-principal').textContent=won(s.principal);$('studyphone-device-monthly').textContent=won(s.inst.monthly);$('studyphone-interest').textContent=won(s.inst.fee);$('studyphone-service-fee').textContent=won(s.service);
    $('studyphone-summary').textContent=`${p.name} · 할부원금 ${won(s.principal)} · 월 단말금 ${won(s.inst.monthly)} + 요금제 ${won(s.service)} = 월 예상 ${won(s.total)} (${months}개월 기준)`;
    renderStudyphonePlanList();
  }
  function fillStudyphone(){
    if(!studyphonePlan)return;studyphonePlan.innerHTML='';option(studyphonePlan,'','요금제를 선택하세요');(studyphoneData?.plans||[]).forEach(p=>option(studyphonePlan,p.id,`${p.name} · ${won(p.monthly_fee)}`));syncStudyphone();renderStudyphonePlanList();
  }
  studyphonePlan?.addEventListener('change',syncStudyphone);
  $('studyphone-plan-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-studyphone-plan]');if(!b||!studyphonePlan)return;studyphonePlan.value=b.dataset.studyphonePlan;syncStudyphone();document.querySelector('[data-panel="studyphone"]')?.scrollIntoView({behavior:'smooth',block:'start'})});

'''
marker='  // 알뜰폰 후불\n'
if marker not in js:
    raise SystemExit('mvno marker not found')
js=js.replace(marker,study_js+marker,1)

fetch_block="""  fetch('data/studyphone.json?v=20260916-1').then(r=>r.json()).then(data=>{studyphoneData=data||studyphoneData;setUpdated('studyphone-updated',studyphoneData?.meta?.updated_at);fillStudyphone()}).catch(()=>{const box=$('studyphone-plan-list');if(box)box.innerHTML='<p>공신폰 요금제 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>'});\n\n"""
promise_marker='  Promise.all([\n'
if promise_marker not in js:
    raise SystemExit('Promise marker not found')
js=js.replace(promise_marker,fetch_block+promise_marker,1)

css_block=r'''

/* Study phone detailed calculator */
.studyphone-detail-layout{align-items:start}.studyphone-picker{margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.18)}.studyphone-picker label{display:grid;gap:7px;font-size:.75rem;font-weight:900;color:rgba(255,255,255,.78)}.studyphone-picker select{width:100%;min-height:48px;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:#fff;color:#163e49;padding:10px 12px;font:inherit;font-weight:750}.studyphone-plan-info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.studyphone-plan-info>div{padding:11px 12px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12)}.studyphone-plan-info span{display:block;font-size:.62rem;opacity:.68;margin-bottom:4px}.studyphone-plan-info strong{font-size:.85rem}.studyphone-plan-table-wrap{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:0 8px 24px rgba(16,60,82,.05)}.studyphone-list-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:14px}.studyphone-list-head h3{margin:7px 0 0;font-size:1.3rem;letter-spacing:-.035em}.studyphone-list-head p{max-width:480px;margin:0;color:var(--muted);font-size:.74rem;line-height:1.55;text-align:right}.studyphone-plan-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.studyphone-plan-list>p{grid-column:1/-1;margin:0;padding:14px;background:#f4f8f9;border-radius:12px;color:var(--muted);font-size:.76rem}.studyphone-plan-card{display:grid;gap:6px;text-align:left;border:1px solid #d5e3e5;border-radius:14px;background:#f8fbfb;padding:14px;color:var(--ink);font:inherit;cursor:pointer}.studyphone-plan-card.active{border-color:var(--teal);box-shadow:0 0 0 2px rgba(15,118,110,.1);background:#f4fbfa}.studyphone-plan-card>span{font-size:.82rem;font-weight:900;line-height:1.35}.studyphone-plan-card>strong{font-size:1.16rem;color:var(--teal)}.studyphone-plan-card>small{font-size:.67rem;line-height:1.45;color:var(--muted)}.studyphone-plan-card>div{display:flex;justify-content:space-between;gap:12px;padding-top:6px;border-top:1px solid #e3ecee;font-size:.69rem}.studyphone-plan-card em{font-style:normal;color:var(--muted)}.studyphone-plan-card b{font-size:.7rem}.studyphone-plan-card .studyphone-card-total b{color:var(--teal);font-size:.8rem}.studyphone-result .studyphone-note{margin-top:12px}@media(max-width:760px){.studyphone-plan-list{grid-template-columns:1fr}.studyphone-list-head{align-items:flex-start;flex-direction:column}.studyphone-list-head p{text-align:left}.studyphone-plan-info{grid-template-columns:1fr 1fr}.studyphone-plan-table-wrap{padding:17px;border-radius:17px}}
'''
if '/* Study phone detailed calculator */' not in css:
    css+=css_block

HTML.write_text(html,encoding='utf-8')
JS.write_text(js,encoding='utf-8')
CSS.write_text(css,encoding='utf-8')
print('studyphone detailed calculator patch complete')
