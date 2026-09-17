from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
old='assets/site-pro.min.js?v=20260917-2'
new='assets/site-pro.min.js?v=20260917-3'
if old not in s:
    raise SystemExit('expected site-pro cache version not found')
s=s.replace(old,new,1)
if new not in s:
    raise SystemExit('new cache version missing')
p.write_text(s,encoding='utf-8')
print('site-pro cache version bumped')
