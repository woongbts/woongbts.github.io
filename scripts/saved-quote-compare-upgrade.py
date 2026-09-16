from pathlib import Path
import re

html_path = Path('rates.html')
js_path = Path('assets/rates.js')
css_path = Path('assets/rates.css')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache bust changed assets.
html, n = re.subn(r'assets/rates\.js\?v=20260916-\d+', 'assets/rates.js?v=20260916-16', html, count=1)
if n != 1:
    raise SystemExit('rates.js cache version not found')
html, n = re.subn(r'assets/rates\.css\?v=20260916-\d+', 'assets/rates.css?v=20260916-10', html, count=1)
if n != 1:
    raise SystemExit('rates.css cache version not found')

# Add saved quote comparison controls below recent quotes.
old_html = '''                <div class="recent-quote-title">최근 견적</div>
                <div class="recent-quote-list" id="recent-quote-list"><p>아직 저장된 견적이 없습니다.</p></div>'''
new_html = '''                <div class="recent-quote-title">최근 견적</div>
                <div class="recent-quote-list" id="recent-quote-list"><p>아직 저장된 견적이 없습니다.</p></div>
                <div class="quote-compare-tools" id="quote-compare-tools">
                  <span id="quote-compare-status">비교할 견적 2개를 선택하세요.</span>
                  <button type="button" id="compare-saved-quotes" disabled>선택한 견적 비교</button>
                </div>
                <div class="saved-quote-compare" id="saved-quote-compare" hidden>
                  <div class="saved-quote-compare-head"><div><span>저장 견적 비교</span><strong>두 견적을 한눈에 확인</strong></div><button type="button" id="close-saved-quote-compare">닫기</button></div>
                  <div class="saved-quote-compare-scroll"><div class="saved-quote-compare-table" id="saved-quote-compare-table"></div></div>
                  <p id="saved-quote-compare-diff"></p>
                </div>'''
if old_html not in html:
    raise SystemExit('recent quote HTML anchor not found')
html = html.replace(old_html, new_html, 1)

# Compare selection state.
old_key = "  const RECENT_QUOTE_KEY='woongbi-recent-quotes-v1';\n"
new_key = "  const RECENT_QUOTE_KEY='woongbi-recent-quotes-v1';\n  const recentQuoteCompareSelection=new Set();\n"
if old_key not in js:
    raise SystemExit('RECENT_QUOTE_KEY anchor not found')
js = js.replace(old_key, new_key, 1)

# Replace recent quote rendering with compare toggles and comparison helpers.
start = js.find('  function renderRecentQuotes(){')
end = js.find('  function deleteRecentQuote(id){', start)
if start < 0 or end < 0:
    raise SystemExit('recent quote functions not found')
new_recent = r'''  function renderRecentQuotes(){
    const box=$('recent-quote-list');if(!box)return;const rows=readRecentQuotes(),validIds=new Set(rows.map(row=>row.id).filter(Boolean));
    [...recentQuoteCompareSelection].forEach(id=>{if(!validIds.has(id))recentQuoteCompareSelection.delete(id)});box.innerHTML='';
    if(!rows.length){box.innerHTML='<p>아직 저장된 견적이 없습니다.</p>';syncSavedQuoteCompareControls();return}
    rows.forEach(row=>{
      const item=document.createElement('div');item.className='recent-quote-item';if(recentQuoteCompareSelection.has(row.id))item.classList.add('compare-selected');
      const open=document.createElement('button');open.type='button';open.className='recent-quote-open';open.dataset.url=row.url||'';
      const when=row.savedAt?new Date(row.savedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      const meta=document.createElement('span'),id=document.createElement('b'),time=document.createElement('small'),device=document.createElement('strong'),detail=document.createElement('em');
      id.textContent=row.id||'저장 견적';time.textContent=when;meta.append(id,time);device.textContent=row.device||'';detail.textContent=`${row.plan||''}${row.monthly?` · ${won(row.monthly)}`:''}`;open.append(meta,device,detail);
      const compare=document.createElement('button');compare.type='button';compare.className='recent-quote-compare-toggle';compare.dataset.quoteId=row.id||'';compare.setAttribute('aria-pressed',recentQuoteCompareSelection.has(row.id)?'true':'false');compare.textContent=recentQuoteCompareSelection.has(row.id)?'선택됨':'비교';
      const remove=document.createElement('button');remove.type='button';remove.className='recent-quote-delete';remove.dataset.quoteId=row.id||'';remove.setAttribute('aria-label',`${row.id||'저장 견적'} 삭제`);remove.title='저장 견적 삭제';remove.textContent='×';
      item.append(open,compare,remove);box.appendChild(item);
    });
    syncSavedQuoteCompareControls();
  }
  function savedQuoteCompareData(row){
    if(!row)return null;let params=null;try{params=new URL(row.url||'',location.href).searchParams}catch(e){}
    const deviceId=row.deviceId||params?.get('d')||'',planId=row.planId||params?.get('p')||'';
    const d=(catalog?.devices||[]).find(x=>x.id===deviceId)||null,p=(catalog?.mobile_plans||[]).find(x=>x.id===planId)||null;
    const carrierValue=row.carrier||params?.get('c')||d?.carrier||'',joinValue=row.join||params?.get('j')||'',method=row.method||params?.get('m')||'support',months=row.months||params?.get('mo')||'24',welfare=row.welfare||params?.get('w')||'none';
    const scenario=d&&p?scenarioForSelection(d,p,joinValue,method,months,welfare):null;
    return {id:row.id||'저장 견적',device:row.device||d?.name||'—',carrier:carrierValue||'—',join:joinValue||'—',plan:row.plan||p?.name||'—',method:method==='contract'?'선택약정':'공시지원금',monthly:hasAmount(row.monthly)?Number(row.monthly):(scenario?.known?scenario.monthly:null),total24:hasAmount(row.total24)?Number(row.total24):(scenario?.known?scenario.total24:null),deviceMonthly:hasAmount(row.deviceMonthly)?Number(row.deviceMonthly):(scenario?.known?scenario.inst?.monthly:null),serviceMonthly:hasAmount(row.serviceMonthly)?Number(row.serviceMonthly):(scenario?.known?scenario.service:null)};
  }
  function syncSavedQuoteCompareControls(){
    const button=$('compare-saved-quotes'),status=$('quote-compare-status'),panel=$('saved-quote-compare'),count=recentQuoteCompareSelection.size;
    if(button)button.disabled=count!==2;if(status)status.textContent=count?`${count}/2 선택됨 · ${count===2?'비교할 준비가 됐어요.':'견적을 하나 더 선택하세요.'}`:'비교할 견적 2개를 선택하세요.';
    if(panel&&count!==2)panel.hidden=true;
  }
  function toggleSavedQuoteCompare(id){
    if(!id)return;if(recentQuoteCompareSelection.has(id))recentQuoteCompareSelection.delete(id);else{if(recentQuoteCompareSelection.size>=2){const status=$('quote-action-status');if(status)status.textContent='저장 견적 비교는 2개까지 선택할 수 있습니다.';return}recentQuoteCompareSelection.add(id)}
    renderRecentQuotes();
  }
  function renderSavedQuoteComparison(){
    const panel=$('saved-quote-compare'),table=$('saved-quote-compare-table'),diff=$('saved-quote-compare-diff');if(!panel||!table)return;
    const ids=[...recentQuoteCompareSelection];if(ids.length!==2){syncSavedQuoteCompareControls();return}
    const rows=readRecentQuotes(),left=savedQuoteCompareData(rows.find(row=>row.id===ids[0])),right=savedQuoteCompareData(rows.find(row=>row.id===ids[1]));if(!left||!right)return;
    table.innerHTML='';
    const addCell=(text,cls='')=>{const el=document.createElement('div');el.className=`saved-quote-compare-cell ${cls}`.trim();el.textContent=text;table.appendChild(el)};
    addCell('항목','compare-label compare-header');addCell(left.id,'compare-value compare-header');addCell(right.id,'compare-value compare-header');
    const addRow=(label,a,b,highlight=false)=>{addCell(label,'compare-label');addCell(a,'compare-value'+(highlight?' compare-highlight':''));addCell(b,'compare-value'+(highlight?' compare-highlight':''))};
    addRow('기종',left.device,right.device);addRow('통신사 · 가입',`${left.carrier} · ${left.join}`,`${right.carrier} · ${right.join}`);addRow('요금제',left.plan,right.plan);addRow('할인 방식',left.method,right.method);addRow('월 단말금',hasAmount(left.deviceMonthly)?won(left.deviceMonthly):'확인 필요',hasAmount(right.deviceMonthly)?won(right.deviceMonthly):'확인 필요');addRow('월 통신요금',hasAmount(left.serviceMonthly)?won(left.serviceMonthly):'확인 필요',hasAmount(right.serviceMonthly)?won(right.serviceMonthly):'확인 필요');addRow('예상 월 납부액',hasAmount(left.monthly)?won(left.monthly):'확인 필요',hasAmount(right.monthly)?won(right.monthly):'확인 필요',true);addRow('24개월 총비용',hasAmount(left.total24)?won(left.total24):'확인 필요',hasAmount(right.total24)?won(right.total24):'확인 필요',true);
    const notes=[];if(hasAmount(left.monthly)&&hasAmount(right.monthly))notes.push(`월 납부액 차이 ${won(Math.abs(left.monthly-right.monthly))}`);if(hasAmount(left.total24)&&hasAmount(right.total24))notes.push(`24개월 총비용 차이 ${won(Math.abs(left.total24-right.total24))}`);if(diff)diff.textContent=notes.length?notes.join(' · '):'저장 시점의 조건을 기준으로 비교합니다.';
    panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
'''
js = js[:start] + new_recent + js[end:]

# Deleting a quote should also clear its comparison selection.
old_delete = """  function deleteRecentQuote(id){
    if(!id)return;const rows=readRecentQuotes(),next=rows.filter(row=>row.id!==id);if(next.length===rows.length)return;
    writeRecentQuotes(next);renderRecentQuotes();const status=$('quote-action-status');if(status)status.textContent=`${id} 저장 견적을 삭제했습니다.`;
  }"""
new_delete = """  function deleteRecentQuote(id){
    if(!id)return;const rows=readRecentQuotes(),next=rows.filter(row=>row.id!==id);if(next.length===rows.length)return;
    recentQuoteCompareSelection.delete(id);writeRecentQuotes(next);renderRecentQuotes();const status=$('quote-action-status');if(status)status.textContent=`${id} 저장 견적을 삭제했습니다.`;
  }"""
if old_delete not in js:
    raise SystemExit('deleteRecentQuote block not found')
js = js.replace(old_delete, new_delete, 1)

# Store extra comparison fields for newly saved quotes.
old_row = "monthly:scenario?.known?scenario.monthly:null,savedAt:Date.now()}"
new_row = "monthly:scenario?.known?scenario.monthly:null,total24:scenario?.known?scenario.total24:null,deviceMonthly:scenario?.known?scenario.inst?.monthly:null,serviceMonthly:scenario?.known?scenario.service:null,planFee:scenario?.known?scenario.planFee:null,savedAt:Date.now()}"
if old_row not in js:
    raise SystemExit('saved quote row anchor not found')
js = js.replace(old_row, new_row, 1)

# Add comparison click handling without disturbing delete / open behavior.
old_click = "  $('recent-quote-list')?.addEventListener('click',e=>{const remove=e.target.closest('.recent-quote-delete');if(remove){e.preventDefault();e.stopPropagation();deleteRecentQuote(remove.dataset.quoteId);return}const open=e.target.closest('.recent-quote-open');if(open?.dataset.url)location.href=open.dataset.url});"
new_click = "  $('recent-quote-list')?.addEventListener('click',e=>{const compare=e.target.closest('.recent-quote-compare-toggle');if(compare){e.preventDefault();e.stopPropagation();toggleSavedQuoteCompare(compare.dataset.quoteId);return}const remove=e.target.closest('.recent-quote-delete');if(remove){e.preventDefault();e.stopPropagation();deleteRecentQuote(remove.dataset.quoteId);return}const open=e.target.closest('.recent-quote-open');if(open?.dataset.url)location.href=open.dataset.url});\n  $('compare-saved-quotes')?.addEventListener('click',renderSavedQuoteComparison);\n  $('close-saved-quote-compare')?.addEventListener('click',()=>{const panel=$('saved-quote-compare');if(panel)panel.hidden=true});"
if old_click not in js:
    raise SystemExit('recent quote click handler not found')
js = js.replace(old_click, new_click, 1)

# Final CSS overrides for comparison controls and mobile-friendly table.
css += r'''

/* Saved mobile quote comparison */
.recent-quote-item{position:relative;display:block;padding:0;overflow:hidden}.recent-quote-item.compare-selected{border-color:#8ebbb6;box-shadow:0 0 0 2px rgba(15,118,110,.08)}.recent-quote-open{padding-right:48px;padding-bottom:42px}.recent-quote-compare-toggle{position:absolute;right:8px;bottom:8px;min-width:58px;height:28px;border:1px solid #cbdadd;border-radius:999px;background:#fff;color:#526970;font-size:.62rem;font-weight:900;cursor:pointer;z-index:2}.recent-quote-compare-toggle[aria-pressed="true"]{background:var(--teal);border-color:var(--teal);color:#fff}.quote-compare-tools{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:10px;padding-top:10px;border-top:1px solid #e3ebed}.quote-compare-tools span{font-size:.65rem;color:#60777f;line-height:1.4}.quote-compare-tools button{flex:0 0 auto;min-height:36px;border:0;border-radius:10px;background:var(--navy);color:#fff;padding:0 11px;font-size:.68rem;font-weight:900}.quote-compare-tools button:disabled{background:#e6edef;color:#91a0a5}.saved-quote-compare[hidden]{display:none!important}.saved-quote-compare{margin-top:12px;padding:12px;border:1px solid #cddfe1;border-radius:13px;background:#fff}.saved-quote-compare-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}.saved-quote-compare-head>div{display:grid;gap:2px}.saved-quote-compare-head span{font-size:.62rem;color:var(--teal);font-weight:900}.saved-quote-compare-head strong{font-size:.82rem;color:var(--navy)}.saved-quote-compare-head button{min-height:32px;border:1px solid #d4e1e4;border-radius:9px;background:#fff;color:#526970;font-size:.65rem;font-weight:900}.saved-quote-compare-scroll{overflow-x:auto;overscroll-behavior-x:contain}.saved-quote-compare-table{display:grid;grid-template-columns:minmax(78px,.7fr) repeat(2,minmax(160px,1fr));min-width:470px;border:1px solid #e0e8ea;border-radius:11px;overflow:hidden}.saved-quote-compare-cell{padding:9px 8px;border-right:1px solid #e8eef0;border-bottom:1px solid #e8eef0;font-size:.67rem;line-height:1.4;background:#fff}.saved-quote-compare-cell:nth-child(3n){border-right:0}.saved-quote-compare-label{}.saved-quote-compare-cell.compare-label{color:#70848b;background:#f8fbfb;font-weight:850}.saved-quote-compare-cell.compare-value{color:var(--ink);font-weight:750}.saved-quote-compare-cell.compare-header{background:#eef6f5;color:var(--teal);font-weight:900}.saved-quote-compare-cell.compare-highlight{color:var(--teal);font-size:.72rem;font-weight:950}.saved-quote-compare>p{margin:9px 0 0!important;padding:8px 9px;border-radius:9px;background:#f4f8f9;color:#526970!important;font-size:.65rem!important;line-height:1.45!important}@media(max-width:760px){.recent-quote-open{padding-right:48px;padding-bottom:43px}.quote-compare-tools{align-items:stretch;flex-direction:column}.quote-compare-tools button{width:100%}.saved-quote-compare{padding:11px}.saved-quote-compare-scroll{margin-right:-2px;padding-bottom:3px}.saved-quote-compare-table{min-width:510px}}
'''

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('Saved quote comparison upgraded')
