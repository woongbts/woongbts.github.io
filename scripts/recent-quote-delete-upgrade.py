from pathlib import Path

html_path = Path('rates.html')
js_path = Path('assets/rates.js')
css_path = Path('assets/rates.css')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# Cache-bust both changed assets on mobile browsers.
if 'assets/rates.js?v=20260916-13' not in html:
    raise SystemExit('Expected rates.js cache version not found')
html = html.replace('assets/rates.js?v=20260916-13', 'assets/rates.js?v=20260916-14', 1)
if 'assets/rates.css?v=20260916-8' not in html:
    raise SystemExit('Expected rates.css cache version not found')
html = html.replace('assets/rates.css?v=20260916-8', 'assets/rates.css?v=20260916-9', 1)

old_render = '''  function renderRecentQuotes(){
    const box=$('recent-quote-list');if(!box)return;const rows=readRecentQuotes();box.innerHTML='';
    if(!rows.length){box.innerHTML='<p>아직 저장된 견적이 없습니다.</p>';return}
    rows.forEach(row=>{
      const item=document.createElement('button');item.type='button';item.className='recent-quote-item';item.dataset.url=row.url||'';
      const when=row.savedAt?new Date(row.savedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      item.innerHTML=`<span><b>${row.id||'저장 견적'}</b><small>${when}</small></span><strong>${row.device||''}</strong><em>${row.plan||''}${row.monthly?` · ${won(row.monthly)}`:''}</em>`;box.appendChild(item);
    });
  }
'''
new_render = '''  function renderRecentQuotes(){
    const box=$('recent-quote-list');if(!box)return;const rows=readRecentQuotes();box.innerHTML='';
    if(!rows.length){box.innerHTML='<p>아직 저장된 견적이 없습니다.</p>';return}
    rows.forEach(row=>{
      const item=document.createElement('div');item.className='recent-quote-item';
      const open=document.createElement('button');open.type='button';open.className='recent-quote-open';open.dataset.url=row.url||'';
      const when=row.savedAt?new Date(row.savedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      const meta=document.createElement('span'),id=document.createElement('b'),time=document.createElement('small'),device=document.createElement('strong'),detail=document.createElement('em');
      id.textContent=row.id||'저장 견적';time.textContent=when;meta.append(id,time);device.textContent=row.device||'';detail.textContent=`${row.plan||''}${row.monthly?` · ${won(row.monthly)}`:''}`;open.append(meta,device,detail);
      const remove=document.createElement('button');remove.type='button';remove.className='recent-quote-delete';remove.dataset.quoteId=row.id||'';remove.setAttribute('aria-label',`${row.id||'저장 견적'} 삭제`);remove.title='저장 견적 삭제';remove.textContent='×';
      item.append(open,remove);box.appendChild(item);
    });
  }
  function deleteRecentQuote(id){
    if(!id)return;const rows=readRecentQuotes(),next=rows.filter(row=>row.id!==id);if(next.length===rows.length)return;
    writeRecentQuotes(next);renderRecentQuotes();const status=$('quote-action-status');if(status)status.textContent=`${id} 저장 견적을 삭제했습니다.`;
  }
'''
if old_render not in js:
    raise SystemExit('Recent quote render block not found')
js = js.replace(old_render, new_render, 1)

old_listener = "  $('recent-quote-list')?.addEventListener('click',e=>{const btn=e.target.closest('.recent-quote-item');if(btn?.dataset.url)location.href=btn.dataset.url});"
new_listener = "  $('recent-quote-list')?.addEventListener('click',e=>{const remove=e.target.closest('.recent-quote-delete');if(remove){e.preventDefault();e.stopPropagation();deleteRecentQuote(remove.dataset.quoteId);return}const open=e.target.closest('.recent-quote-open');if(open?.dataset.url)location.href=open.dataset.url});"
if old_listener not in js:
    raise SystemExit('Recent quote click listener not found')
js = js.replace(old_listener, new_listener, 1)

css_marker = '/* Recent quote delete control */'
if css_marker in css:
    raise SystemExit('Recent quote delete styles already present')
css += '''\n\n/* Recent quote delete control */\n.recent-quote-item{position:relative;display:block;padding:0;overflow:hidden}.recent-quote-open{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;text-align:left;gap:2px 10px;padding:10px 48px 10px 11px;border:0;background:transparent;color:var(--ink);cursor:pointer;font:inherit}.recent-quote-open>span{display:flex;gap:7px;align-items:center;min-width:0}.recent-quote-open>span b{font-size:.68rem;color:var(--teal)}.recent-quote-open>span small{font-size:.61rem;color:var(--muted)}.recent-quote-open>strong{grid-column:1/2;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recent-quote-open>em{grid-column:2/3;grid-row:1/3;align-self:center;font-style:normal;font-size:.67rem;color:#5b737b;text-align:right;max-width:150px}.recent-quote-open:focus-visible{outline:2px solid var(--teal);outline-offset:-2px}.recent-quote-delete{position:absolute;top:8px;right:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid #d7e3e6;border-radius:50%;background:#fff;color:#75888f;font:inherit;font-size:1.18rem;line-height:1;font-weight:500;cursor:pointer;z-index:2}.recent-quote-delete:hover,.recent-quote-delete:focus-visible{border-color:#d6a7a7;background:#fff7f7;color:#a43d3d;outline:none}@media(max-width:760px){.recent-quote-open{grid-template-columns:1fr;padding-right:48px}.recent-quote-open>em{grid-column:1;grid-row:auto;text-align:left;max-width:none}.recent-quote-delete{top:9px;right:9px}}\n'''

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('Recent quote delete control added')
