from pathlib import Path

html_path = Path('rates.html')
js_path = Path('assets/rates.js')
css_path = Path('assets/rates.css')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# ---------------- HTML ----------------
calc_marker = '''              <p id="calc-summary">통신사, 가입유형, 할인방식, 기종, 요금제를 선택하면 자동으로 계산됩니다.</p>'''
calc_insert = '''              <p id="calc-summary">통신사, 가입유형, 할인방식, 기종, 요금제를 선택하면 자동으로 계산됩니다.</p>
              <details class="calc-explain" id="calc-explain">
                <summary>왜 이 금액인가요?</summary>
                <div class="calc-explain-grid">
                  <div><span>출고가</span><b id="explain-price">—</b></div>
                  <div><span>단말 할인</span><b id="explain-device-discount">—</b></div>
                  <div><span>할부원금</span><b id="explain-principal">—</b></div>
                  <div><span>총 할부이자</span><b id="explain-interest">—</b></div>
                  <div><span>월 단말금</span><b id="explain-device-monthly">—</b></div>
                  <div><span>요금제 월정액</span><b id="explain-plan-fee">—</b></div>
                  <div><span>선택약정 할인</span><b id="explain-contract-discount">—</b></div>
                  <div><span>복지할인</span><b id="explain-welfare">—</b></div>
                  <div><span>월 통신요금</span><b id="explain-service">—</b></div>
                  <div class="total"><span>예상 월 납부액</span><b id="explain-monthly-total">—</b></div>
                  <div class="total"><span>24개월 총 예상비용</span><b id="explain-total24">—</b></div>
                </div>
                <p id="explain-note">기종과 요금제를 선택하면 계산 과정을 항목별로 보여드립니다.</p>
              </details>
              <section class="quote-memory" id="quote-memory">
                <div class="quote-memory-head">
                  <div><span>현재 견적번호</span><strong id="quote-number">견적 생성 전</strong></div>
                  <button type="button" id="save-quote">이 견적 저장</button>
                </div>
                <div class="recent-quote-title">최근 견적</div>
                <div class="recent-quote-list" id="recent-quote-list"><p>아직 저장된 견적이 없습니다.</p></div>
              </section>'''
if calc_marker not in html:
    raise SystemExit('calc summary marker not found')
html = html.replace(calc_marker, calc_insert, 1)

mvno_marker = '''            <form class="rate-card rate-form" id="mvno-form" onsubmit="return false">
              <label>알뜰폰 통신사<select id="mvno-provider"><option value="">통신사를 선택하세요</option></select></label>'''
mvno_insert = '''            <form class="rate-card rate-form" id="mvno-form" onsubmit="return false">
              <div class="mvno-filter-box">
                <div class="mvno-filter-head"><div><strong>요금제 빠른 필터</strong><span>특별할인가 기준으로 원하는 조건을 빠르게 좁혀보세요.</span></div><button type="button" id="mvno-filter-reset">초기화</button></div>
                <div class="mvno-filter-group"><span>통신망</span><div><button type="button" class="active" data-mvno-filter-group="network" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="network" data-mvno-filter-value="SKT">SKT망</button><button type="button" data-mvno-filter-group="network" data-mvno-filter-value="KT">KT망</button><button type="button" data-mvno-filter-group="network" data-mvno-filter-value="LGU+">LGU+망</button></div></div>
                <div class="mvno-filter-group"><span>월 기본료</span><div><button type="button" class="active" data-mvno-filter-group="price" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="10000">1만원 이하</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="20000">2만원 이하</button><button type="button" data-mvno-filter-group="price" data-mvno-filter-value="30000">3만원 이하</button></div></div>
                <div class="mvno-filter-group"><span>데이터</span><div><button type="button" class="active" data-mvno-filter-group="data" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="5">5GB 이상</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="10">10GB 이상</button><button type="button" data-mvno-filter-group="data" data-mvno-filter-value="unlimited">무제한 표기</button></div></div>
                <div class="mvno-filter-group"><span>통화</span><div><button type="button" class="active" data-mvno-filter-group="voice" data-mvno-filter-value="all">전체</button><button type="button" data-mvno-filter-group="voice" data-mvno-filter-value="unlimited">무제한·기본제공</button></div></div>
                <label class="mvno-sort-label">정렬<select id="mvno-sort"><option value="source">기본 순서</option><option value="price">요금 낮은 순</option><option value="data">데이터 많은 순</option></select></label>
                <div class="mvno-filter-count" id="mvno-filter-count">통신사 또는 필터를 선택해 주세요.</div>
              </div>
              <label>알뜰폰 통신사<select id="mvno-provider"><option value="">통신사를 선택하세요</option></select></label>'''
if mvno_marker not in html:
    raise SystemExit('mvno form marker not found')
html = html.replace(mvno_marker, mvno_insert, 1)

html = html.replace('assets/rates.css?v=20260916-1', 'assets/rates.css?v=20260916-2', 1)
html = html.replace('assets/rates.js?v=20260916-1', 'assets/rates.js?v=20260916-2', 1)

# ---------------- JS ----------------
state_marker = '''  let suspendUrlSync=true;'''
state_insert = '''  let suspendUrlSync=true;
  let currentQuoteId='';
  let currentQuoteFingerprint='';
  const RECENT_QUOTE_KEY='woongbi-recent-quotes-v1';
  const mvnoFilters={network:'all',price:'all',data:'all',voice:'all'};'''
if state_marker not in js:
    raise SystemExit('state marker not found')
js = js.replace(state_marker, state_insert, 1)

# Quote text gains quote number.
quote_marker = "    const lines=['[웅비통신 간편견적 상담]',`통신사: ${carrier.value}`"
quote_repl = "    ensureQuoteId();\n    const lines=['[웅비통신 간편견적 상담]',`견적번호: ${currentQuoteId}`,`통신사: ${carrier.value}`"
if quote_marker not in js:
    raise SystemExit('quote text marker not found')
js = js.replace(quote_marker, quote_repl, 1)

# Quote URL carries quote id.
url_delete_old = "    ['tab','c','j','d','p','m','mo','w'].forEach(k=>u.searchParams.delete(k));"
url_delete_new = "    ensureQuoteId();\n    ['tab','c','j','d','p','m','mo','w','qid'].forEach(k=>u.searchParams.delete(k));"
if url_delete_old not in js:
    raise SystemExit('buildQuoteUrl delete marker not found')
js = js.replace(url_delete_old, url_delete_new, 1)
url_set_old = "    if(d&&p){u.searchParams.set('tab','mobile');u.searchParams.set('c',carrier.value);u.searchParams.set('j',joinType.value);u.searchParams.set('d',d.id);u.searchParams.set('p',p.id);u.searchParams.set('m',discountMethod.value);u.searchParams.set('mo',monthsSelect.value||'24');u.searchParams.set('w',welfareType.value||'none')}"
url_set_new = "    if(d&&p){u.searchParams.set('tab','mobile');u.searchParams.set('c',carrier.value);u.searchParams.set('j',joinType.value);u.searchParams.set('d',d.id);u.searchParams.set('p',p.id);u.searchParams.set('m',discountMethod.value);u.searchParams.set('mo',monthsSelect.value||'24');u.searchParams.set('w',welfareType.value||'none');if(currentQuoteId)u.searchParams.set('qid',currentQuoteId)}"
if url_set_old not in js:
    raise SystemExit('buildQuoteUrl state marker not found')
js = js.replace(url_set_old, url_set_new, 1)

# Restore qid from shared/saved URL.
restore_start_old = "    const q=new URLSearchParams(location.search),did=q.get('d'),pid=q.get('p');if(!did||!pid)return false;"
restore_start_new = "    const q=new URLSearchParams(location.search),did=q.get('d'),pid=q.get('p'),qid=q.get('qid');if(!did||!pid)return false;"
if restore_start_old not in js:
    raise SystemExit('restore start marker not found')
js = js.replace(restore_start_old, restore_start_new, 1)
restore_end_old = "    setMobileMode('direct');return true;"
restore_end_new = "    setMobileMode('direct');if(qid){currentQuoteId=qid;currentQuoteFingerprint=quoteFingerprint()}syncQuoteMemory();return true;"
if restore_end_old not in js:
    raise SystemExit('restore end marker not found')
js = js.replace(restore_end_old, restore_end_new, 1)

# Insert quote-memory + calculation explanation helpers before syncMobile.
sync_marker = '''  function syncMobile(){syncMobileCore();syncComparison();syncQuoteBar();syncQuoteUrl();syncDeviceCompare()}'''
helpers = r'''  function quoteFingerprint(){
    const d=currentDevice(),p=currentPlan();if(!d||!p)return '';
    return [carrier.value,joinType.value,d.id,p.id,discountMethod.value,monthsSelect.value||'24',welfareType.value||'none'].join('|');
  }
  function makeQuoteId(){
    const n=new Date(),pad=v=>String(v).padStart(2,'0');
    return `WB-${String(n.getFullYear()).slice(-2)}${pad(n.getMonth()+1)}${pad(n.getDate())}-${pad(n.getHours())}${pad(n.getMinutes())}${pad(n.getSeconds())}`;
  }
  function ensureQuoteId(){
    const fp=quoteFingerprint(),el=$('quote-number');
    if(!fp){currentQuoteId='';currentQuoteFingerprint='';if(el)el.textContent='견적 생성 전';return ''}
    if(!currentQuoteId||currentQuoteFingerprint!==fp){currentQuoteFingerprint=fp;currentQuoteId=makeQuoteId()}
    if(el)el.textContent=currentQuoteId;return currentQuoteId;
  }
  function readRecentQuotes(){
    try{const rows=JSON.parse(localStorage.getItem(RECENT_QUOTE_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch(e){return[]}
  }
  function writeRecentQuotes(rows){try{localStorage.setItem(RECENT_QUOTE_KEY,JSON.stringify(rows.slice(0,5)))}catch(e){}}
  function renderRecentQuotes(){
    const box=$('recent-quote-list');if(!box)return;const rows=readRecentQuotes();box.innerHTML='';
    if(!rows.length){box.innerHTML='<p>아직 저장된 견적이 없습니다.</p>';return}
    rows.forEach(row=>{
      const item=document.createElement('button');item.type='button';item.className='recent-quote-item';item.dataset.url=row.url||'';
      const when=row.savedAt?new Date(row.savedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      item.innerHTML=`<span><b>${row.id||'저장 견적'}</b><small>${when}</small></span><strong>${row.device||''}</strong><em>${row.plan||''}${row.monthly?` · ${won(row.monthly)}`:''}</em>`;box.appendChild(item);
    });
  }
  function syncQuoteMemory(){ensureQuoteId();renderRecentQuotes()}
  function saveCurrentQuote(){
    const d=currentDevice(),p=currentPlan();if(!d||!p){$('quote-action-status').textContent='기종과 요금제를 먼저 선택해 주세요.';return}
    ensureQuoteId();const scenario=mobileScenario(discountMethod.value),row={id:currentQuoteId,fingerprint:currentQuoteFingerprint,url:buildQuoteUrl(),carrier:carrier.value,join:joinType.value,device:d.name,deviceId:d.id,plan:p.name,planId:p.id,method:discountMethod.value,months:monthsSelect.value||'24',welfare:welfareType.value||'none',monthly:scenario?.known?scenario.monthly:null,savedAt:Date.now()};
    const rows=readRecentQuotes().filter(x=>x.id!==row.id&&x.fingerprint!==row.fingerprint);rows.unshift(row);writeRecentQuotes(rows);renderRecentQuotes();$('quote-action-status').textContent=`${currentQuoteId} 견적을 이 기기에 저장했습니다.`;
  }
  function syncCalcExplanation(){
    const d=currentDevice(),p=currentPlan(),scenario=mobileScenario(discountMethod.value),isContract=discountMethod.value==='contract';
    const ids=['explain-price','explain-device-discount','explain-principal','explain-interest','explain-device-monthly','explain-plan-fee','explain-contract-discount','explain-welfare','explain-service','explain-monthly-total','explain-total24'];
    if(!d||!p||!scenario?.known){ids.forEach(id=>{if($(id))$(id).textContent='—'});if($('explain-note'))$('explain-note').textContent=d&&p&&!isContract?'공시지원금 확인이 필요한 조건입니다. 확인된 금액만 계산에 반영합니다.':'기종과 요금제를 선택하면 계산 과정을 항목별로 보여드립니다.';return}
    $('explain-price').textContent=won(scenario.price);
    $('explain-device-discount').textContent=isContract?'미적용':(scenario.support?'-'+won(scenario.support):'0원');
    $('explain-principal').textContent=won(scenario.principal);
    $('explain-interest').textContent=won(scenario.inst.fee);
    $('explain-device-monthly').textContent=won(scenario.inst.monthly);
    $('explain-plan-fee').textContent=won(scenario.planFee);
    $('explain-contract-discount').textContent=isContract&&scenario.contractDiscount?'-'+won(scenario.contractDiscount):'미적용';
    $('explain-welfare').textContent=scenario.welfare?.amount?'-'+won(scenario.welfare.amount):'미적용';
    $('explain-service').textContent=won(scenario.service);
    $('explain-monthly-total').textContent=won(scenario.monthly);
    $('explain-total24').textContent=won(scenario.total24);
    $('explain-note').textContent=`월 단말금 ${won(scenario.inst.monthly)} + 월 통신요금 ${won(scenario.service)} = 예상 월 납부액 ${won(scenario.monthly)}입니다. 추가지원금·실시간 프로모션은 포함하지 않습니다.`;
  }
  function syncMobile(){syncMobileCore();syncComparison();syncQuoteBar();syncCalcExplanation();syncQuoteMemory();syncQuoteUrl();syncDeviceCompare()}
'''
if sync_marker not in js:
    raise SystemExit('syncMobile marker not found')
js = js.replace(sync_marker, helpers, 1)

# Save / recent quote events.
event_marker = "  $('mobile-quote-consult')?.addEventListener('click',consultQuote);"
event_insert = "  $('mobile-quote-consult')?.addEventListener('click',consultQuote);\n  $('save-quote')?.addEventListener('click',saveCurrentQuote);\n  $('recent-quote-list')?.addEventListener('click',e=>{const btn=e.target.closest('.recent-quote-item');if(btn?.dataset.url)location.href=btn.dataset.url});"
if event_marker not in js:
    raise SystemExit('quote event marker not found')
js = js.replace(event_marker, event_insert, 1)

# Replace MVNO provider/plan/filter implementation.
mvno_start = js.index("  // 알뜰폰 후불")
mvno_end = js.index("\n  // 선불폰", mvno_start)
old_mvno = js[mvno_start:mvno_end]
new_mvno = r'''  // 알뜰폰 후불
  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan'),mvnoSort=$('mvno-sort');
  function mvnoPlanFee(p){return p?.special_monthly_fee??p?.monthly_fee}
  function mvnoMatchesFilters(p){
    if(mvnoFilters.network!=='all'&&p.network!==mvnoFilters.network)return false;
    if(mvnoFilters.price!=='all'&&(!hasAmount(mvnoPlanFee(p))||Number(mvnoPlanFee(p))>Number(mvnoFilters.price)))return false;
    const data=String(p.data||''),gb=planDataGb(p);
    if(mvnoFilters.data==='unlimited'&&!data.includes('무제한'))return false;
    if(['5','10'].includes(mvnoFilters.data)&&!(gb!==null&&gb>=Number(mvnoFilters.data)))return false;
    const voice=String(p.voice||'').replace(/\s+/g,'');
    if(mvnoFilters.voice==='unlimited'&&!(voice.includes('무제한')||voice.includes('기본제공')))return false;
    return true;
  }
  function sortMvnoPlans(rows){
    const mode=mvnoSort?.value||'source';
    if(mode==='price')return rows.sort((a,b)=>(Number(mvnoPlanFee(a))||Infinity)-(Number(mvnoPlanFee(b))||Infinity)||byOrder(a,b));
    if(mode==='data')return rows.sort((a,b)=>{const ag=planDataGb(a),bg=planDataGb(b),av=ag===null?-1:ag,bv=bg===null?-1:bg;return bv-av||((Number(mvnoPlanFee(a))||Infinity)-(Number(mvnoPlanFee(b))||Infinity))});
    return rows.sort(byOrder);
  }
  function updateMvnoFilterButtons(){document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.classList.toggle('active',mvnoFilters[btn.dataset.mvnoFilterGroup]===btn.dataset.mvnoFilterValue))}
  function fillMvnoProviders(){
    const keep=mvnoProvider.value;clearSelect(mvnoProvider,'통신사를 선택하세요');option(mvnoProvider,'all','전체 통신사');
    (mvnoData.providers||[]).slice().sort(byOrder).forEach(p=>option(mvnoProvider,p.id,p.name));
    if([...mvnoProvider.options].some(o=>o.value===keep))mvnoProvider.value=keep;fillMvnoPlans();
  }
  function fillMvnoPlans(){
    const pid=mvnoProvider.value,provider=(mvnoData.providers||[]).find(p=>p.id===pid);clearSelect(mvnoPlan,pid?'요금제를 선택하세요':'통신사 또는 필터를 선택하세요');
    let plans=(mvnoData.plans||[]).filter(p=>(pid==='all'||!pid||p.provider_id===pid)&&mvnoMatchesFilters(p));
    plans=sortMvnoPlans(plans);
    const providerMap=new Map((mvnoData.providers||[]).map(p=>[p.id,p]));
    plans.forEach(p=>{const fee=mvnoPlanFee(p),prefix=pid==='all'?`${providerMap.get(p.provider_id)?.name||p.provider_id} · `:'';option(mvnoPlan,p.id,`${prefix}${p.name} · ${hasAmount(fee)?won(fee):'매장 확인'}`)});
    mvnoPlan.disabled=!pid||!plans.length;
    if(pid==='all')$('mvno-network').textContent=mvnoFilters.network==='all'?'전체':mvnoFilters.network;
    else $('mvno-network').textContent=provider?.network||'—';
    $('mvno-filter-count').textContent=pid?`${plans.length.toLocaleString('ko-KR')}개 요금제가 현재 조건에 맞습니다.`:'통신사 또는 필터를 선택해 주세요.';
    if(pid&&!plans.length)$('mvno-detail').textContent='현재 필터 조건에 맞는 요금제가 없습니다.';
    syncMvno();
  }
  function syncMvno(){
    const p=(mvnoData.plans||[]).find(x=>x.id===mvnoPlan.value)||null,provider=(mvnoData.providers||[]).find(x=>x.id===(p?.provider_id||mvnoProvider.value))||null;
    $('mvno-network').textContent=p?.network||provider?.network||(mvnoProvider.value==='all'?(mvnoFilters.network==='all'?'전체':mvnoFilters.network):'—');
    if(!p){$('mvno-fee-view').textContent='—';$('mvno-total').textContent='—';$('mvno-summary').textContent=mvnoProvider.value?'필터에 맞는 요금제를 선택하면 월 기본료를 확인할 수 있습니다.':'통신사와 요금제를 선택하면 자동으로 반영됩니다.';return}
    const fee=mvnoPlanFee(p),known=hasAmount(fee);
    $('mvno-fee-view').textContent=known?won(fee):'매장 확인';$('mvno-total').textContent=known?won(fee):'매장 확인';
    const bits=[];if(p.data)bits.push(`데이터 ${p.data}`);if(p.voice)bits.push(`통화 ${p.voice}`);if(p.sms)bits.push(`문자 ${p.sms}`);
    $('mvno-detail').textContent=(bits.length?bits.join(' · ')+' · ':'')+'복지할인 미적용';
    $('mvno-summary').textContent=known?`${provider?.name||p.provider_id} · ${p.name} 특별할인가 기준 월 기본료입니다.`:`${provider?.name||p.provider_id} · ${p.name}의 현재 월요금은 매장에서 확인해 주세요.`;
  }
  mvnoProvider.addEventListener('change',fillMvnoPlans);mvnoPlan.addEventListener('change',syncMvno);mvnoSort?.addEventListener('change',fillMvnoPlans);
  document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.dataset.mvnoFilterGroup,value=btn.dataset.mvnoFilterValue;mvnoFilters[group]=value;updateMvnoFilterButtons();if(!mvnoProvider.value)mvnoProvider.value='all';if(group==='network'&&mvnoProvider.value!=='all'){const pr=(mvnoData.providers||[]).find(p=>p.id===mvnoProvider.value);if(value!=='all'&&pr?.network!==value)mvnoProvider.value='all'}fillMvnoPlans()}));
  $('mvno-filter-reset')?.addEventListener('click',()=>{Object.assign(mvnoFilters,{network:'all',price:'all',data:'all',voice:'all'});if(mvnoSort)mvnoSort.value='source';updateMvnoFilterButtons();fillMvnoPlans()});
'''
js = js[:mvno_start] + new_mvno + js[mvno_end:]

# Ensure recent quote list is rendered even before a mobile quote exists.
load_marker = "    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();"
load_repl = "    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderRecentQuotes();"
if load_marker not in js:
    raise SystemExit('load marker not found')
js = js.replace(load_marker, load_repl, 1)

# ---------------- CSS ----------------
css += r'''

/* Consultation v3: quote memory, transparent math, MVNO filters */
.calc-explain{margin-top:14px;border:1px solid #d5e3e5;border-radius:15px;background:#fff;overflow:hidden}.calc-explain summary{cursor:pointer;list-style:none;padding:13px 14px;font-size:.8rem;font-weight:900;color:var(--navy);background:#f8fbfb}.calc-explain summary::-webkit-details-marker{display:none}.calc-explain summary:after{content:'＋';float:right;color:var(--teal)}.calc-explain[open] summary:after{content:'－'}.calc-explain-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;padding:10px 14px}.calc-explain-grid>div{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #edf2f3;font-size:.73rem}.calc-explain-grid span{color:var(--muted)}.calc-explain-grid b{font-size:.73rem}.calc-explain-grid .total{font-weight:900;color:var(--teal)}.calc-explain>p{margin:0 14px 14px!important;padding:10px 11px;border-radius:10px;background:#eef6f5;font-size:.7rem!important;line-height:1.5!important;color:#52706f!important}
.quote-memory{margin-top:14px;padding:14px;border:1px solid #d5e3e5;border-radius:15px;background:#f8fbfb}.quote-memory-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.quote-memory-head>div{display:grid;gap:3px}.quote-memory-head span,.recent-quote-title{font-size:.67rem;color:var(--muted);font-weight:800}.quote-memory-head strong{font-size:.96rem;color:var(--navy);letter-spacing:-.02em}.quote-memory-head button{border:0;border-radius:10px;background:var(--teal);color:#fff;min-height:38px;padding:0 12px;font-weight:900}.recent-quote-title{margin-top:13px;margin-bottom:7px}.recent-quote-list{display:grid;gap:7px}.recent-quote-list>p{margin:0!important;font-size:.7rem!important;color:var(--muted)!important}.recent-quote-item{display:grid;grid-template-columns:minmax(0,1fr) auto;text-align:left;gap:2px 10px;padding:10px 11px;border:1px solid #d8e4e6;border-radius:11px;background:#fff;color:var(--ink);cursor:pointer}.recent-quote-item>span{display:flex;gap:7px;align-items:center;min-width:0}.recent-quote-item>span b{font-size:.68rem;color:var(--teal)}.recent-quote-item>span small{font-size:.61rem;color:var(--muted)}.recent-quote-item>strong{grid-column:1/2;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recent-quote-item>em{grid-column:2/3;grid-row:1/3;align-self:center;font-style:normal;font-size:.67rem;color:#5b737b;text-align:right;max-width:150px}
.mvno-filter-box{display:grid;gap:10px;padding:14px;border:1px solid #d5e3e5;border-radius:15px;background:#f8fbfb}.mvno-filter-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mvno-filter-head>div{display:grid;gap:3px}.mvno-filter-head strong{font-size:.83rem;color:var(--navy)}.mvno-filter-head span{font-size:.65rem;line-height:1.4;color:var(--muted)}.mvno-filter-head>button{border:1px solid #cddcdf;background:#fff;color:#526970;border-radius:9px;min-height:32px;padding:0 10px;font-size:.67rem;font-weight:900}.mvno-filter-group{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;align-items:start}.mvno-filter-group>span{padding-top:7px;font-size:.67rem;font-weight:900;color:#5c737b}.mvno-filter-group>div{display:flex;gap:6px;flex-wrap:wrap}.mvno-filter-group button{border:1px solid #d1dfe2;background:#fff;color:#5a7078;border-radius:999px;min-height:32px;padding:0 10px;font-size:.66rem;font-weight:850}.mvno-filter-group button.active{background:var(--navy);border-color:var(--navy);color:#fff}.mvno-sort-label{display:grid!important;grid-template-columns:72px minmax(0,210px);align-items:center;gap:8px!important}.mvno-sort-label select{min-height:38px!important}.mvno-filter-count{font-size:.68rem;color:var(--teal);font-weight:800}
@media(max-width:760px){.calc-explain-grid{grid-template-columns:1fr}.quote-memory-head{align-items:stretch}.quote-memory-head button{flex:0 0 auto}.recent-quote-item{grid-template-columns:1fr}.recent-quote-item>em{grid-column:1;grid-row:auto;text-align:left;max-width:none}.mvno-filter-group{grid-template-columns:1fr}.mvno-filter-group>span{padding-top:0}.mvno-sort-label{grid-template-columns:1fr}.mvno-sort-label select{max-width:none}}
'''

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('consultation v3 patch applied')
