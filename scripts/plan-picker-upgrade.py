from pathlib import Path

ROOT = Path('.')
HTML = ROOT / 'rates.html'
JS = ROOT / 'assets/rates.js'
CSS = ROOT / 'assets/rates.css'

html = HTML.read_text(encoding='utf-8')
js = JS.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'marker not found: {label}')
    return text.replace(old, new, 1)


# ------------------------------------------------------------------
# HTML: replace the long native plan dropdown with a searchable picker.
# Keep the select hidden so all existing quote/calculation logic remains intact.
# ------------------------------------------------------------------
old_plan = '''              <label>요금제<select id="plan-select" disabled><option value="">기종을 먼저 선택하세요</option></select><small class="field-help">선택한 가입유형·기종에서 가입 가능한 요금제만 표시합니다.</small></label>'''
new_plan = '''              <div class="mobile-plan-picker">
                <div class="plan-picker-label"><span>요금제</span><small>선택한 가입유형·기종에서 가입 가능한 요금제만 보여드립니다.</small></div>
                <button type="button" class="plan-picker-open" id="plan-picker-open" disabled>
                  <span class="plan-picker-main"><strong id="plan-picker-selected">기종을 먼저 선택하세요</strong><small id="plan-picker-selected-detail">기종을 선택하면 요금제를 찾을 수 있습니다.</small></span>
                  <b>요금제 찾기</b>
                </button>
                <select id="plan-select" class="plan-select-native" disabled tabindex="-1" aria-hidden="true"><option value="">기종을 먼저 선택하세요</option></select>
                <div class="plan-picker-backdrop" id="plan-picker-backdrop" hidden>
                  <section class="plan-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-picker-title">
                    <div class="plan-picker-head">
                      <div><span>요금제 선택</span><strong id="plan-picker-title">필요한 조건으로 빠르게 찾기</strong></div>
                      <button type="button" id="plan-picker-close" aria-label="요금제 선택창 닫기">닫기</button>
                    </div>
                    <label class="plan-picker-search">요금제 검색<input id="plan-picker-search" type="search" autocomplete="off" placeholder="요금제명, 데이터 용량으로 검색"></label>
                    <div class="plan-filter-group">
                      <span>데이터</span>
                      <div>
                        <button type="button" class="active" data-plan-filter-group="data" data-plan-filter-value="all">전체</button>
                        <button type="button" data-plan-filter-group="data" data-plan-filter-value="light">5GB 이하</button>
                        <button type="button" data-plan-filter-group="data" data-plan-filter-value="normal">5~20GB</button>
                        <button type="button" data-plan-filter-group="data" data-plan-filter-value="heavy">20GB+</button>
                        <button type="button" data-plan-filter-group="data" data-plan-filter-value="unlimited">무제한 표기</button>
                      </div>
                    </div>
                    <div class="plan-filter-group">
                      <span>월 기본료</span>
                      <div>
                        <button type="button" class="active" data-plan-filter-group="price" data-plan-filter-value="all">전체</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="under40">4만원 미만</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="40s">4만원대</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="50plus">5만원 이상</button>
                      </div>
                    </div>
                    <div class="plan-picker-toolbar">
                      <strong id="plan-picker-count">요금제를 불러오는 중입니다.</strong>
                      <label>정렬<select id="plan-picker-sort"><option value="source">기본 순서</option><option value="price">요금 낮은 순</option><option value="data">데이터 많은 순</option></select></label>
                    </div>
                    <div class="plan-picker-list" id="plan-picker-list"></div>
                    <small class="plan-picker-note">표시 내용은 현재 등록된 요금제 정보 기준이며 세부 제공 조건은 최종 상담 시 확인해 주세요.</small>
                  </section>
                </div>
              </div>'''
html = replace_once(html, old_plan, new_plan, 'mobile plan picker html')
html = html.replace('assets/rates.css?v=20260916-5', 'assets/rates.css?v=20260916-6')
html = html.replace('assets/rates.js?v=20260916-8', 'assets/rates.js?v=20260916-9')


# ------------------------------------------------------------------
# JS: picker filtering, cards, and synchronization with hidden select.
# ------------------------------------------------------------------
eligible_marker = '''  function eligiblePlans(){const d=currentDevice();if(!d)return[];const raw=devicePlanIds(d,joinType.value),ids=raw.length?new Set(raw):null;return (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&(!ids||ids.has(p.id))).sort(byOrder)}'''
plan_picker_js = r'''  function eligiblePlans(){const d=currentDevice();if(!d)return[];const raw=devicePlanIds(d,joinType.value),ids=raw.length?new Set(raw):null;return (catalog?.mobile_plans||[]).filter(p=>p.carrier===carrier.value&&(!ids||ids.has(p.id))).sort(byOrder)}
  const planPickerState={data:'all',price:'all',sort:'source',query:''};
  function planPickerTags(p){
    const text=`${p?.name||''} ${p?.data||''}`.toLowerCase(),tags=[];
    [['65+','65+'],['복지','복지'],['이월','이월'],['y덤','Y덤'],['청년','청년'],['키즈','키즈']].forEach(([needle,label])=>{if(text.includes(needle)&&!tags.includes(label))tags.push(label)});
    return tags.slice(0,4);
  }
  function planPickerMatches(p){
    const query=String(planPickerState.query||'').trim().toLowerCase();
    if(query&&!`${p?.name||''} ${p?.data||''} ${p?.monthly_fee??''}`.toLowerCase().includes(query))return false;
    const fee=Number(p?.monthly_fee),gb=planDataGb(p);
    if(planPickerState.price==='under40'&&!(Number.isFinite(fee)&&fee<40000))return false;
    if(planPickerState.price==='40s'&&!(Number.isFinite(fee)&&fee>=40000&&fee<50000))return false;
    if(planPickerState.price==='50plus'&&!(Number.isFinite(fee)&&fee>=50000))return false;
    if(planPickerState.data==='light'&&!(gb!==null&&gb!==Infinity&&gb<=5))return false;
    if(planPickerState.data==='normal'&&!(gb!==null&&gb!==Infinity&&gb>5&&gb<=20))return false;
    if(planPickerState.data==='heavy'&&!(gb!==null&&gb!==Infinity&&gb>20))return false;
    if(planPickerState.data==='unlimited'&&gb!==Infinity)return false;
    return true;
  }
  function planPickerRows(){
    const rows=eligiblePlans().filter(planPickerMatches);
    if(planPickerState.sort==='price')return rows.sort((a,b)=>(Number(a.monthly_fee)||Infinity)-(Number(b.monthly_fee)||Infinity)||byOrder(a,b));
    if(planPickerState.sort==='data')return rows.sort((a,b)=>{const ag=planDataGb(a),bg=planDataGb(b),av=ag===null?-1:ag,bv=bg===null?-1:bg;return bv-av||((Number(a.monthly_fee)||Infinity)-(Number(b.monthly_fee)||Infinity))});
    return rows.sort(byOrder);
  }
  function syncPlanPickerTrigger(){
    const button=$('plan-picker-open'),title=$('plan-picker-selected'),detail=$('plan-picker-selected-detail'),d=currentDevice(),p=currentPlan();if(!button||!title||!detail)return;
    button.disabled=!d;
    if(!d){title.textContent='기종을 먼저 선택하세요';detail.textContent='기종을 선택하면 요금제를 찾을 수 있습니다.';return}
    if(!p){title.textContent='요금제를 선택해 주세요';detail.textContent=`가입 가능한 요금제 ${eligiblePlans().length.toLocaleString('ko-KR')}개에서 찾아보세요.`;return}
    title.textContent=p.name;detail.textContent=`월 ${won(p.monthly_fee)}${p.data?` · 데이터 ${p.data}`:''}`;
  }
  function updatePlanPickerControls(){
    document.querySelectorAll('[data-plan-filter-group]').forEach(btn=>btn.classList.toggle('active',planPickerState[btn.dataset.planFilterGroup]===btn.dataset.planFilterValue));
    const sort=$('plan-picker-sort');if(sort)sort.value=planPickerState.sort;
  }
  function renderPlanPicker(){
    const list=$('plan-picker-list'),count=$('plan-picker-count');if(!list||!count)return;updatePlanPickerControls();list.innerHTML='';
    const rows=planPickerRows();count.textContent=`현재 조건에 맞는 요금제 ${rows.length.toLocaleString('ko-KR')}개`;
    if(!rows.length){const empty=document.createElement('p');empty.className='plan-picker-empty';empty.textContent='조건에 맞는 요금제가 없습니다. 검색어나 필터를 조금 넓혀보세요.';list.appendChild(empty);return}
    rows.forEach(p=>{
      const card=document.createElement('button');card.type='button';card.className='plan-option-card';if(p.id===planSelect.value)card.classList.add('selected');
      const top=document.createElement('span');top.className='plan-option-top';
      const name=document.createElement('strong');name.textContent=p.name;
      const price=document.createElement('b');price.textContent=hasAmount(p.monthly_fee)?won(p.monthly_fee):'매장 확인';
      top.append(name,price);card.appendChild(top);
      const data=document.createElement('small');data.textContent=p.data?`데이터 ${p.data}`:'데이터 제공량은 상담 시 확인';card.appendChild(data);
      const tags=planPickerTags(p);if(tags.length){const tagBox=document.createElement('span');tagBox.className='plan-option-tags';tags.forEach(tag=>{const chip=document.createElement('i');chip.textContent=tag;tagBox.appendChild(chip)});card.appendChild(tagBox)}
      const choose=document.createElement('em');choose.textContent=p.id===planSelect.value?'현재 선택한 요금제':'이 요금제 선택';card.appendChild(choose);
      card.addEventListener('click',()=>{planSelect.value=p.id;closePlanPicker();syncMobile()});list.appendChild(card);
    });
  }
  function openPlanPicker(){
    if(!currentDevice())return;renderPlanPicker();const backdrop=$('plan-picker-backdrop');if(!backdrop)return;backdrop.hidden=false;document.body.classList.add('plan-picker-opened');setTimeout(()=>{const search=$('plan-picker-search');if(search)search.focus({preventScroll:true})},60);
  }
  function closePlanPicker(refocus=true){
    const backdrop=$('plan-picker-backdrop');if(backdrop)backdrop.hidden=true;document.body.classList.remove('plan-picker-opened');if(refocus)$('plan-picker-open')?.focus({preventScroll:true});
  }'''
js = replace_once(js, eligible_marker, plan_picker_js, 'plan picker js helpers')

old_fill = '''  function fillPlans(){
    const d=currentDevice(),keep=planSelect.value;clearSelect(planSelect,d?'요금제를 선택하세요':'기종을 먼저 선택하세요');planSelect.disabled=!d;
    if(!d){fillInstallments();syncMobile();return}
    eligiblePlans().forEach(p=>option(planSelect,p.id,`${p.name} · ${won(p.monthly_fee)}${p.data?' · '+p.data:''}`));
    planSelect.value=[...planSelect.options].some(o=>o.value===keep)?keep:'';fillInstallments();syncMobile();
  }'''
new_fill = '''  function fillPlans(){
    const d=currentDevice(),keep=planSelect.value;clearSelect(planSelect,d?'요금제를 선택하세요':'기종을 먼저 선택하세요');planSelect.disabled=!d;
    if(!d){closePlanPicker(false);fillInstallments();syncPlanPickerTrigger();syncMobile();return}
    eligiblePlans().forEach(p=>option(planSelect,p.id,p.name));
    planSelect.value=[...planSelect.options].some(o=>o.value===keep)?keep:'';fillInstallments();syncPlanPickerTrigger();syncMobile();
  }'''
js = replace_once(js, old_fill, new_fill, 'fill plans picker sync')

old_sync = '''  function syncMobile(){syncMobileCore();syncComparison();syncQuoteBar();syncCalcExplanation();syncQuoteMemory();syncQuoteUrl();syncDeviceCompare()}'''
new_sync = '''  function syncMobile(){syncPlanPickerTrigger();syncMobileCore();syncComparison();syncQuoteBar();syncCalcExplanation();syncQuoteMemory();syncQuoteUrl();syncDeviceCompare()}'''
js = replace_once(js, old_sync, new_sync, 'sync mobile picker trigger')

event_marker = '''  deviceSearch?.addEventListener('input',fillDevices);'''
event_block = r'''  deviceSearch?.addEventListener('input',fillDevices);
  $('plan-picker-open')?.addEventListener('click',openPlanPicker);
  $('plan-picker-close')?.addEventListener('click',()=>closePlanPicker());
  $('plan-picker-backdrop')?.addEventListener('click',e=>{if(e.target===$('plan-picker-backdrop'))closePlanPicker()});
  $('plan-picker-search')?.addEventListener('input',e=>{planPickerState.query=e.target.value||'';renderPlanPicker()});
  $('plan-picker-sort')?.addEventListener('change',e=>{planPickerState.sort=e.target.value||'source';renderPlanPicker()});
  document.querySelectorAll('[data-plan-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{planPickerState[btn.dataset.planFilterGroup]=btn.dataset.planFilterValue;renderPlanPicker()}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('plan-picker-backdrop')?.hidden)closePlanPicker()});'''
js = replace_once(js, event_marker, event_block, 'plan picker events')


# ------------------------------------------------------------------
# CSS: bottom sheet on mobile, centered dialog on desktop, readable cards.
# ------------------------------------------------------------------
css_marker = '/* Mobile plan finder */'
if css_marker not in css:
    css += r'''


/* Mobile plan finder */
.mobile-plan-picker{display:grid;gap:7px}.plan-picker-label{display:grid;gap:4px}.plan-picker-label>span{font-size:.82rem;font-weight:850;color:#46616a}.plan-picker-label>small{color:#819298;font-size:.7rem;font-weight:600;line-height:1.45}.plan-select-native{position:absolute!important;width:1px!important;height:1px!important;min-height:0!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;padding:0!important;border:0!important}.plan-picker-open{width:100%;min-height:64px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;text-align:left;border:1px solid #cddcdf;border-radius:14px;background:#fff;padding:11px 12px;color:var(--ink);font:inherit;cursor:pointer}.plan-picker-open:not(:disabled):hover,.plan-picker-open:not(:disabled):focus-visible{border-color:var(--teal);box-shadow:0 0 0 3px rgba(15,118,110,.09);outline:none}.plan-picker-open:disabled{background:#f4f7f8;color:#9aa9ae;cursor:not-allowed}.plan-picker-main{display:grid;gap:3px;min-width:0}.plan-picker-main strong{font-size:.9rem;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.plan-picker-main small{font-size:.68rem;color:#71868d;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.plan-picker-open>b{font-size:.72rem;color:var(--teal);padding:7px 9px;border-radius:9px;background:#eaf5f3;white-space:nowrap}.plan-picker-open:disabled>b{color:#9aa9ae;background:#e9eef0}.plan-picker-backdrop[hidden]{display:none!important}.plan-picker-backdrop{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,28,38,.54);backdrop-filter:blur(5px)}body.plan-picker-opened{overflow:hidden}.plan-picker-sheet{width:min(680px,100%);max-height:min(760px,calc(100dvh - 48px));display:flex;flex-direction:column;gap:13px;background:#fff;border-radius:22px;padding:19px;box-shadow:0 22px 70px rgba(0,0,0,.26);overflow:hidden}.plan-picker-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.plan-picker-head>div{display:grid;gap:3px}.plan-picker-head span{font-size:.68rem;color:var(--teal);font-weight:900}.plan-picker-head strong{font-size:1.12rem;letter-spacing:-.025em}.plan-picker-head>button{border:1px solid #d5e3e5;background:#fff;border-radius:10px;min-height:36px;padding:0 11px;color:#526970;font-weight:850}.plan-picker-search{display:grid;gap:6px;font-size:.72rem!important;font-weight:850!important;color:#46616a!important}.plan-picker-search input{min-height:46px!important}.plan-filter-group{display:grid;gap:6px}.plan-filter-group>span{font-size:.7rem;font-weight:900;color:#5d747c}.plan-filter-group>div{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.plan-filter-group>div::-webkit-scrollbar{display:none}.plan-filter-group button{flex:0 0 auto;min-height:34px;border:1px solid #d4e1e4;border-radius:999px;background:#fff;color:#567078;padding:0 10px;font-size:.68rem;font-weight:850}.plan-filter-group button.active{background:var(--navy);border-color:var(--navy);color:#fff}.plan-picker-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:2px}.plan-picker-toolbar>strong{font-size:.7rem;color:var(--teal)}.plan-picker-toolbar label{display:flex!important;align-items:center;gap:6px!important;font-size:.68rem!important}.plan-picker-toolbar select{min-height:34px!important;width:auto!important;border-radius:9px!important;padding:5px 26px 5px 8px!important;font-size:.68rem!important}.plan-picker-list{display:grid;gap:8px;overflow:auto;min-height:140px;padding:1px 3px 3px 1px;overscroll-behavior:contain}.plan-option-card{display:grid;gap:6px;text-align:left;border:1px solid #d7e3e6;border-radius:14px;background:#fff;padding:13px;color:var(--ink);font:inherit;cursor:pointer}.plan-option-card:hover,.plan-option-card:focus-visible{border-color:#8fbdb8;outline:none}.plan-option-card.selected{border-color:var(--teal);box-shadow:0 0 0 2px rgba(15,118,110,.1);background:#f8fcfb}.plan-option-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.plan-option-top strong{font-size:.85rem;line-height:1.35;letter-spacing:-.015em}.plan-option-top b{font-size:.93rem;color:var(--teal);white-space:nowrap}.plan-option-card>small{font-size:.7rem;color:#60777f;line-height:1.45}.plan-option-tags{display:flex;gap:5px;flex-wrap:wrap}.plan-option-tags i{font-style:normal;font-size:.62rem;font-weight:900;color:#536e75;background:#eef4f5;border-radius:999px;padding:4px 7px}.plan-option-card>em{font-style:normal;font-size:.66rem;font-weight:900;color:var(--teal);margin-top:1px}.plan-picker-empty{margin:0;padding:18px;border-radius:12px;background:#f4f8f9;color:var(--muted);font-size:.75rem;line-height:1.55}.plan-picker-note{font-size:.64rem;color:#819298;line-height:1.45}
@media(max-width:760px){.plan-picker-backdrop{align-items:flex-end;padding:0}.plan-picker-sheet{width:100%;max-height:88dvh;border-radius:22px 22px 0 0;padding:17px 15px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -16px 50px rgba(0,0,0,.24)}.plan-picker-sheet:before{content:'';width:38px;height:4px;border-radius:999px;background:#cad6d9;margin:-7px auto 2px}.plan-picker-open{min-height:68px}.plan-picker-main strong,.plan-picker-main small{white-space:normal}.plan-option-card{padding:12px}.plan-option-top strong{font-size:.83rem}.plan-option-top b{font-size:.9rem}.plan-picker-toolbar{align-items:flex-end}.plan-picker-toolbar>strong{max-width:55%;line-height:1.35}}
'''

HTML.write_text(html, encoding='utf-8')
JS.write_text(js, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
print('mobile plan picker upgrade applied')
