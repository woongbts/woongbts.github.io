from pathlib import Path

src=Path('tmp_fix_value_senior_models.py').read_text(encoding='utf-8')
head=src.split('# Cache bust',1)[0]
tail="""# Cache bust
match=re.search(r'assets/rates[.]js[?]v=[^\"]+',html)
if not match: raise SystemExit('js cache bust target missing')
html=html[:match.start()]+'assets/rates.js?v=20260916-27'+html[match.end():]

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('updated value four-model lineup and senior stylefolder2')
"""
exec(compile(head+tail,'tmp_fix_value_senior_models.py','exec'))
