from pathlib import Path
import re

js_path=Path('assets/rates.js')
css_path=Path('assets/rates.css')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old,new,1)

old_obsolete="""  function purposeObsoleteDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /쿠키즈미니|쿠키즈|cookizmini|블레이드|blade/.test(text);
  }
"""
new_obsolete="""  function purposeObsoleteDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /쿠키즈미니|쿠키즈|cookizmini|블레이드|blade/.test(text);
  }
  function purposeIsKidsOnlyDevice(d){
    const text=`${d?.name||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase().replace(/\\s+/g,'');
    return /무너2|무너키즈|mooner2|mooner/.test(text);
  }
  function purposeKidsDeviceRank(d){
    if(purposeIsKidsOnlyDevice(d))return 0;
    return deviceBrandKey(d)==='samsung'?1:2;
  }
"""
js=replace_once(js,old_obsolete,new_obsolete,'kids-only helper')

old_pool="""    if(category==='senior'||category==='kids')rows=rows.filter(purposeIsLowCostDevice);
    else if(category==='value')rows=rows.filter(d=>{
"""
new_pool="""    if(category==='senior')rows=rows.filter(d=>purposeIsLowCostDevice(d)&&!purposeIsKidsOnlyDevice(d));
    else if(category==='kids')rows=rows.filter(purposeIsLowCostDevice);
    else if(category==='value')rows=rows.filter(d=>{
"""
js=replace_once(js,old_pool,new_pool,'senior kids pool split')

old_kids_sort="""    if(category==='kids'){
      return rows.sort((a,b)=>purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||byNewest(a,b)).slice(0,60);
    }
"""
new_kids_sort="""    if(category==='kids'){
      return rows.sort((a,b)=>purposeKidsDeviceRank(a)-purposeKidsDeviceRank(b)||purposeSalesBrandRank(a,category)-purposeSalesBrandRank(b,category)||byNewest(a,b)).slice(0,60);
    }
"""
js=replace_once(js,old_kids_sort,new_kids_sort,'kids sorting')

old_rec_kids="""    }else if(purposeCategory==='kids'){
      rows.sort((a,b)=>purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
"""
new_rec_kids="""    }else if(purposeCategory==='kids'){
      rows.sort((a,b)=>purposeKidsDeviceRank(a.d)-purposeKidsDeviceRank(b.d)||purposeSalesBrandRank(a.d,purposeCategory)-purposeSalesBrandRank(b.d,purposeCategory)||a.best.total24-b.best.total24||purposeSourceOrder(a.d)-purposeSourceOrder(b.d));
"""
js=replace_once(js,old_rec_kids,new_rec_kids,'kids result sorting')

# Keep the sheet interactive while allowing the page behind it to scroll.
old_css="body.plan-picker-opened{overflow:hidden}.plan-picker-sheet{"
new_css="body.plan-picker-opened{overflow:auto}.plan-picker-backdrop{pointer-events:none}.plan-picker-sheet{pointer-events:auto;"
css=replace_once(css,old_css,new_css,'plan picker scroll unlock')

# The background is now intentionally scrollable/interactable, so do not expose it as a strict modal dialog.
html=html.replace('role="dialog" aria-modal="true" aria-labelledby="plan-picker-title"','role="dialog" aria-labelledby="plan-picker-title"')
html=html.replace('role="dialog" aria-modal="true" aria-labelledby="mvno-plan-picker-title"','role="dialog" aria-labelledby="mvno-plan-picker-title"')

# Cache bust changed JS/CSS.
html,repl_css=re.subn(r'assets/rates\.css\?v=[^\"]+', 'assets/rates.css?v=20260916-15', html, count=1)
html,repl_js=re.subn(r'assets/rates\.js\?v=[^\"]+', 'assets/rates.js?v=20260916-21', html, count=1)
if repl_css!=1 or repl_js!=1:
    raise SystemExit(f'cache bust failed css={repl_css} js={repl_js}')

js_path.write_text(js,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('senior/kids recommendation and plan picker scroll updated')
