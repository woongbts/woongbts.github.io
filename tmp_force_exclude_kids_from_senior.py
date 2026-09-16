from pathlib import Path
import re

js_path=Path('assets/rates.js')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

old="""  function purposeCandidateForDevice(d,category,joinLabel,usePension){
    const welfare=category==='senior'&&usePension?'basic_pension':'none',plans=purposePlanPool(d,category,joinLabel);let best=null;
"""
new="""  function purposeCandidateForDevice(d,category,joinLabel,usePension){
    if(category==='senior'&&purposeIsKidsOnlyDevice(d))return null;
    const welfare=category==='senior'&&usePension?'basic_pension':'none',plans=purposePlanPool(d,category,joinLabel);let best=null;
"""
if js.count(old)!=1:
    raise SystemExit(f'candidate guard anchor count={js.count(old)}')
js=js.replace(old,new,1)

old_rank="""  function purposeSeniorDeviceRank(d){
    const name=`${d?.name||''} ${d?.model||''}`.toLowerCase().replace(/\\s+/g,'');
"""
new_rank="""  function purposeSeniorDeviceRank(d){
    if(purposeIsKidsOnlyDevice(d))return 99;
    const name=`${d?.name||''} ${d?.model||''}`.toLowerCase().replace(/\\s+/g,'');
"""
if js.count(old_rank)!=1:
    raise SystemExit(f'senior rank anchor count={js.count(old_rank)}')
js=js.replace(old_rank,new_rank,1)

html,n=re.subn(r'assets/rates\.js\?v=[^\"]+', 'assets/rates.js?v=20260916-22', html, count=1)
if n!=1:
    raise SystemExit('js cache bust failed')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('force senior kids exclusion applied')
