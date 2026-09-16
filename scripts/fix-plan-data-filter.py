from pathlib import Path

ROOT = Path('.')
JS = ROOT / 'assets/rates.js'
HTML = ROOT / 'rates.html'

js = JS.read_text(encoding='utf-8')
html = HTML.read_text(encoding='utf-8')

old_parser = """  function planDataGb(p){
    const s=String(p?.data||'').toLowerCase().replace(/\\s+/g,'');
    if(!s)return null;if(s.includes('무제한')||s.includes('unlimited'))return Infinity;
    let m=s.match(/([0-9]+(?:\\.[0-9]+)?)gb/);if(m)return Number(m[1]);
    m=s.match(/([0-9]+(?:\\.[0-9]+)?)mb/);if(m)return Number(m[1])/1024;
    return null;
  }
"""
new_parser = """  function planDataText(p){return String(p?.data||'').toLowerCase().replace(/\\s+/g,'')}
  function planHasUnlimited(p){
    const s=planDataText(p);return !!s&&(s.includes('무제한')||s.includes('unlimited'));
  }
  function planDataGb(p){
    const s=planDataText(p);if(!s)return null;
    let m=s.match(/([0-9]+(?:\\.[0-9]+)?)gb/);if(m)return Number(m[1]);
    m=s.match(/([0-9]+(?:\\.[0-9]+)?)mb/);if(m)return Number(m[1])/1024;
    if(planHasUnlimited(p))return Infinity;
    return null;
  }
"""
if old_parser not in js:
    raise SystemExit('planDataGb target not found')
js = js.replace(old_parser, new_parser, 1)

old_filter = "if(planPickerState.data==='unlimited'&&gb!==Infinity)return false;"
new_filter = "if(planPickerState.data==='unlimited'&&!planHasUnlimited(p))return false;"
if old_filter not in js:
    raise SystemExit('plan picker unlimited filter target not found')
js = js.replace(old_filter, new_filter, 1)

old_quick = "function quickPlanMeets(p,need){const gb=planDataGb(p);if(need==='unlimited')return gb===Infinity;return gb!==null&&gb>=Number(need)}"
new_quick = "function quickPlanMeets(p,need){const gb=planDataGb(p);if(need==='unlimited')return planHasUnlimited(p);return gb!==null&&gb>=Number(need)}"
if old_quick not in js:
    raise SystemExit('quick plan target not found')
js = js.replace(old_quick, new_quick, 1)

old_version = 'assets/rates.js?v=20260916-10'
new_version = 'assets/rates.js?v=20260916-11'
if old_version not in html:
    raise SystemExit('rates.js cache version target not found')
html = html.replace(old_version, new_version, 1)

# Guard against the regression that caused quota-based plans with throttled unlimited data
# to be treated as Infinity before their actual GB allowance was parsed.
assert "if(!s)return null;if(s.includes('무제한')" not in js
assert "planPickerState.data==='unlimited'&&!planHasUnlimited(p)" in js
assert "if(need==='unlimited')return planHasUnlimited(p)" in js

JS.write_text(js, encoding='utf-8')
HTML.write_text(html, encoding='utf-8')
