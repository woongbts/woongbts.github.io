from pathlib import Path
import re

html_path = Path('rates.html')
js_path = Path('assets/rates.js')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

# Mobile browser cache-bust for the changed JavaScript.
if 'assets/rates.js?v=20260916-14' not in html:
    raise SystemExit('Expected rates.js cache version not found')
html = html.replace('assets/rates.js?v=20260916-14', 'assets/rates.js?v=20260916-15', 1)

old_plan = '''              <label>요금제<select id="mvno-plan" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>'''
new_plan = '''              <div class="mobile-plan-picker mvno-plan-picker">
                <div class="plan-picker-label"><span>요금제</span><small>위 빠른 필터에 맞는 요금제를 카드로 비교해 선택할 수 있습니다.</small></div>
                <button type="button" class="plan-picker-open" id="mvno-plan-picker-open" disabled>
                  <span class="plan-picker-main"><strong id="mvno-plan-picker-selected">통신사 또는 필터를 선택하세요</strong><small id="mvno-plan-picker-selected-detail">조건을 고르면 요금제를 카드로 비교할 수 있습니다.</small></span>
                  <b>요금제 보기</b>
                </button>
                <select id="mvno-plan" class="plan-select-native" disabled tabindex="-1" aria-hidden="true"><option value="">통신사를 먼저 선택하세요</option></select>
                <div class="plan-picker-backdrop" id="mvno-plan-picker-backdrop" hidden>
                  <section class="plan-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="mvno-plan-picker-title">
                    <div class="plan-picker-head">
                      <div><span>알뜰폰 요금제</span><strong id="mvno-plan-picker-title">월요금·데이터·통화를 한눈에 비교</strong></div>
                      <button type="button" id="mvno-plan-picker-close" aria-label="알뜰폰 요금제 선택창 닫기">닫기</button>
                    </div>
                    <label class="plan-picker-search">요금제 검색<input id="mvno-plan-picker-search" type="search" autocomplete="off" placeholder="통신사, 요금제명, 데이터·통화로 검색"></label>
                    <div class="plan-picker-toolbar"><strong id="mvno-plan-picker-count">요금제를 불러오는 중입니다.</strong><small>위 빠른 필터와 정렬이 그대로 적용됩니다.</small></div>
                    <div class="plan-picker-list" id="mvno-plan-picker-list"></div>
                    <small class="plan-picker-note">월요금은 현재 등록된 특별할인가 기준입니다. 유심비·개통 가능 여부·프로모션 변경 여부는 최종 상담 시 확인해 주세요.</small>
                  </section>
                </div>
              </div>'''
if old_plan not in html:
    raise SystemExit('MVNO native plan label not found')
html = html.replace(old_plan, new_plan, 1)

old_decl = "  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan'),mvnoSort=$('mvno-sort');"
new_decl = """  const mvnoProvider=$('mvno-provider'),mvnoPlan=$('mvno-plan'),mvnoSort=$('mvno-sort');
  const mvnoPickerOpen=$('mvno-plan-picker-open'),mvnoPickerBackdrop=$('mvno-plan-picker-backdrop'),mvnoPickerClose=$('mvno-plan-picker-close'),mvnoPickerSearch=$('mvno-plan-picker-search'),mvnoPickerList=$('mvno-plan-picker-list'),mvnoPickerCount=$('mvno-plan-picker-count');
  let mvnoPickerQuery='';"""
if old_decl not in js:
    raise SystemExit('MVNO declaration not found')
js = js.replace(old_decl, new_decl, 1)

marker = "  function fillMvnoProviders(){"
helpers = r'''  function clearMvnoPickerQuery(){
    mvnoPickerQuery='';if(mvnoPickerSearch)mvnoPickerSearch.value='';
  }
  function filteredMvnoPlans(){
    const pid=mvnoProvider.value;
    let plans=(mvnoData.plans||[]).filter(p=>(pid==='all'||!pid||p.provider_id===pid)&&mvnoMatchesFilters(p));
    return sortMvnoPlans(plans);
  }
  function updateMvnoPickerSummary(plans=filteredMvnoPlans()){
    if(!mvnoPickerOpen)return;
    const selected=(mvnoData.plans||[]).find(p=>p.id===mvnoPlan.value)||null;
    const selectedProvider=(mvnoData.providers||[]).find(p=>p.id===selected?.provider_id)||null;
    const main=$('mvno-plan-picker-selected'),detail=$('mvno-plan-picker-selected-detail');
    mvnoPickerOpen.disabled=!mvnoProvider.value||!plans.length;
    if(selected){
      if(main)main.textContent=selected.name||'선택한 요금제';
      if(detail)detail.textContent=[selectedProvider?.name||selected.provider_id,selected.network?selected.network+'망':'',hasAmount(mvnoPlanFee(selected))?won(mvnoPlanFee(selected)):'매장 확인',selected.data?`데이터 ${selected.data}`:''].filter(Boolean).join(' · ');
      return;
    }
    if(!mvnoProvider.value){
      if(main)main.textContent='통신사 또는 필터를 선택하세요';
      if(detail)detail.textContent='조건을 고르면 요금제를 카드로 비교할 수 있습니다.';
      return;
    }
    if(!plans.length){
      if(main)main.textContent='조건에 맞는 요금제가 없습니다';
      if(detail)detail.textContent='빠른 필터 조건을 조금 넓혀보세요.';
      return;
    }
    if(main)main.textContent=`${plans.length.toLocaleString('ko-KR')}개 요금제에서 선택`;
    if(detail)detail.textContent='월요금·데이터·통화 정보를 카드로 비교해 보세요.';
  }
  function renderMvnoPlanCards(plans=filteredMvnoPlans()){
    if(!mvnoPickerList||!mvnoPickerCount)return;
    const providerMap=new Map((mvnoData.providers||[]).map(p=>[p.id,p]));
    const q=String(mvnoPickerQuery||'').trim().toLowerCase();
    let rows=plans;
    if(q)rows=rows.filter(p=>{
      const provider=providerMap.get(p.provider_id);
      return `${provider?.name||''} ${p.name||''} ${p.network||''} ${p.data||''} ${p.voice||''} ${p.sms||''}`.toLowerCase().includes(q);
    });
    const total=rows.length,visible=rows.slice(0,100);
    mvnoPickerList.innerHTML='';
    mvnoPickerCount.textContent=total>100?`${total.toLocaleString('ko-KR')}개 중 100개 표시 · 검색으로 더 좁혀보세요.`:`${total.toLocaleString('ko-KR')}개 요금제`;
    if(!total){
      const empty=document.createElement('p');empty.className='plan-picker-empty';empty.textContent='검색 또는 현재 필터 조건에 맞는 요금제가 없습니다.';mvnoPickerList.appendChild(empty);return;
    }
    visible.forEach(p=>{
      const provider=providerMap.get(p.provider_id),fee=mvnoPlanFee(p),card=document.createElement('button');
      card.type='button';card.className='plan-option-card';if(p.id===mvnoPlan.value)card.classList.add('selected');
      const top=document.createElement('span');top.className='plan-option-top';
      const name=document.createElement('strong');name.textContent=p.name||'요금제';
      const price=document.createElement('b');price.textContent=hasAmount(fee)?won(fee):'매장 확인';top.append(name,price);
      const meta=document.createElement('small');meta.textContent=[provider?.name||p.provider_id,p.network?`${p.network}망`:null].filter(Boolean).join(' · ');
      const tags=document.createElement('span');tags.className='plan-option-tags';
      [[p.data,'데이터'],[p.voice,'통화'],[p.sms,'문자']].forEach(([value,label])=>{if(!value)return;const chip=document.createElement('i');chip.textContent=`${label} ${value}`;tags.appendChild(chip)});
      const action=document.createElement('em');action.textContent=p.id===mvnoPlan.value?'선택됨':'이 요금제 선택';
      card.append(top,meta,tags,action);
      card.addEventListener('click',()=>{mvnoPlan.value=p.id;syncMvno();updateMvnoPickerSummary(plans);renderMvnoPlanCards(plans);closeMvnoPlanPicker();});
      mvnoPickerList.appendChild(card);
    });
  }
  function openMvnoPlanPicker(){
    if(!mvnoPickerBackdrop||mvnoPickerOpen?.disabled)return;clearMvnoPickerQuery();renderMvnoPlanCards();mvnoPickerBackdrop.hidden=false;document.body.classList.add('plan-picker-opened');setTimeout(()=>mvnoPickerSearch?.focus(),0);
  }
  function closeMvnoPlanPicker(){
    if(!mvnoPickerBackdrop)return;mvnoPickerBackdrop.hidden=true;document.body.classList.remove('plan-picker-opened');mvnoPickerOpen?.focus();
  }
'''
if marker not in js:
    raise SystemExit('fillMvnoProviders marker not found')
js = js.replace(marker, helpers + marker, 1)

pattern = re.compile(r"  function fillMvnoPlans\(\)\{.*?\n  \}\n  function syncMvno\(\)\{", re.S)
replacement = r'''  function fillMvnoPlans(){
    const pid=mvnoProvider.value,provider=(mvnoData.providers||[]).find(p=>p.id===pid),keep=mvnoPlan.value;
    clearSelect(mvnoPlan,pid?'요금제를 선택하세요':'통신사 또는 필터를 선택하세요');
    const plans=filteredMvnoPlans(),providerMap=new Map((mvnoData.providers||[]).map(p=>[p.id,p]));
    plans.forEach(p=>{const fee=mvnoPlanFee(p),prefix=pid==='all'?`${providerMap.get(p.provider_id)?.name||p.provider_id} · `:'';option(mvnoPlan,p.id,`${prefix}${p.name} · ${hasAmount(fee)?won(fee):'매장 확인'}`)});
    if(keep&&plans.some(p=>p.id===keep))mvnoPlan.value=keep;
    mvnoPlan.disabled=!pid||!plans.length;
    if(pid==='all')$('mvno-network').textContent=mvnoFilters.network==='all'?'전체':mvnoFilters.network;
    else $('mvno-network').textContent=provider?.network||'—';
    const bandLabel=mvnoPriceBandLabel(mvnoFilters.price);$('mvno-filter-count').textContent=pid?`${bandLabel?bandLabel+' · ':''}${plans.length.toLocaleString('ko-KR')}개 요금제가 현재 조건에 맞습니다.`:'통신사 또는 필터를 선택해 주세요.';
    if(pid&&!plans.length)$('mvno-detail').textContent='현재 필터 조건에 맞는 요금제가 없습니다.';
    updateMvnoPickerSummary(plans);if(mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)renderMvnoPlanCards(plans);syncMvno();
  }
  function syncMvno(){'''
js, count = pattern.subn(replacement, js, count=1)
if count != 1:
    raise SystemExit(f'fillMvnoPlans replacement failed: {count}')

old_events = """  mvnoProvider.addEventListener('change',fillMvnoPlans);mvnoPlan.addEventListener('change',syncMvno);mvnoSort?.addEventListener('change',fillMvnoPlans);
  document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.dataset.mvnoFilterGroup,value=btn.dataset.mvnoFilterValue;mvnoFilters[group]=value;if(group==='price'&&value==='unlimited')mvnoFilters.data='all';if(group==='price'&&value!=='all'&&mvnoSort)mvnoSort.value='price';updateMvnoFilterButtons();if(!mvnoProvider.value)mvnoProvider.value='all';if(group==='network'&&mvnoProvider.value!=='all'){const pr=(mvnoData.providers||[]).find(p=>p.id===mvnoProvider.value);if(value!=='all'&&pr?.network!==value)mvnoProvider.value='all'}fillMvnoPlans()}));
  $('mvno-filter-reset')?.addEventListener('click',()=>{Object.assign(mvnoFilters,{network:'all',price:'all',data:'all',voice:'all'});if(mvnoSort)mvnoSort.value='source';updateMvnoFilterButtons();fillMvnoPlans()});"""
new_events = """  mvnoProvider.addEventListener('change',()=>{clearMvnoPickerQuery();fillMvnoPlans()});mvnoPlan.addEventListener('change',()=>{syncMvno();updateMvnoPickerSummary();if(mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)renderMvnoPlanCards()});mvnoSort?.addEventListener('change',fillMvnoPlans);
  document.querySelectorAll('[data-mvno-filter-group]').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.dataset.mvnoFilterGroup,value=btn.dataset.mvnoFilterValue;mvnoFilters[group]=value;if(group==='price'&&value==='unlimited')mvnoFilters.data='all';if(group==='price'&&value!=='all'&&mvnoSort)mvnoSort.value='price';clearMvnoPickerQuery();updateMvnoFilterButtons();if(!mvnoProvider.value)mvnoProvider.value='all';if(group==='network'&&mvnoProvider.value!=='all'){const pr=(mvnoData.providers||[]).find(p=>p.id===mvnoProvider.value);if(value!=='all'&&pr?.network!==value)mvnoProvider.value='all'}fillMvnoPlans()}));
  $('mvno-filter-reset')?.addEventListener('click',()=>{Object.assign(mvnoFilters,{network:'all',price:'all',data:'all',voice:'all'});if(mvnoSort)mvnoSort.value='source';clearMvnoPickerQuery();updateMvnoFilterButtons();fillMvnoPlans()});
  mvnoPickerOpen?.addEventListener('click',openMvnoPlanPicker);mvnoPickerClose?.addEventListener('click',closeMvnoPlanPicker);mvnoPickerBackdrop?.addEventListener('click',e=>{if(e.target===mvnoPickerBackdrop)closeMvnoPlanPicker()});mvnoPickerSearch?.addEventListener('input',()=>{mvnoPickerQuery=mvnoPickerSearch.value;renderMvnoPlanCards()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mvnoPickerBackdrop&&!mvnoPickerBackdrop.hidden)closeMvnoPlanPicker()});"""
if old_events not in js:
    raise SystemExit('MVNO event block not found')
js = js.replace(old_events, new_events, 1)

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('MVNO card picker upgraded')
