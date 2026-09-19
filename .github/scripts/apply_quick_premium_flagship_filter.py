from pathlib import Path

src = Path("src/rates.js")
out = Path("assets/rates.min.js")
html_path = Path("rates.html")

js = src.read_text(encoding="utf-8")

if "function wbQuickPremiumDevice(e)" not in js:
    marker = 'document.querySelectorAll(".rate-tab")'
    pos = js.find(marker)
    if pos < 0:
        raise SystemExit("rate-tab marker not found")
    helper = (
        'function wbQuickPremiumDevice(e){'
        'const t=`${e?.name||""} ${e?.manufacturer||""} ${e?.model||""} ${e?.model_code||""}`.toLowerCase().replace(/\\s+/g,"");'
        'const n=A(e);'
        'if("apple"===n)return/아이폰|iphone/.test(t);'
        'if("samsung"!==n)return!1;'
        'return/(?:갤럭시|galaxy)?s[0-9]{2}|sm-s[0-9]+|z(?:폴드|플립|fold|flip)|(?:폴드|플립|fold|flip)[0-9]+|sm-f[0-9]+/.test(t)'
        '}'
    )
    js = js[:pos] + helper + js[pos:]

old_filter = 'e=>e.carrier===carrier&&V(e,brand)&&wbVisibleDevice(e)&&n(e.retail_price)&&Number(e.retail_price)>0&&!xe(e)&&!Ce(e)&&!/폴더|folder/i.test(`${e.name||""} ${e.model||""} ${e.model_code||""}`)'
new_filter = 'e=>e.carrier===carrier&&V(e,brand)&&("premium"!==budgetKey||wbQuickPremiumDevice(e))&&wbVisibleDevice(e)&&n(e.retail_price)&&Number(e.retail_price)>0&&!xe(e)&&!Ce(e)&&!/폴더|folder/i.test(`${e.name||""} ${e.model||""} ${e.model_code||""}`)'

if old_filter in js:
    if js.count(old_filter) != 1:
        raise SystemExit(f"unexpected quick device filter count: {js.count(old_filter)}")
    js = js.replace(old_filter, new_filter, 1)
elif new_filter not in js:
    raise SystemExit("quick recommendation device filter pattern not found")

for required in [
    "function wbQuickPremiumDevice(e)",
    'if("apple"===n)return/아이폰|iphone/.test(t)',
    'if("samsung"!==n)return!1',
    '(?:갤럭시|galaxy)?s[0-9]{2}',
    'sm-f[0-9]+',
    '("premium"!==budgetKey||wbQuickPremiumDevice(e))',
]:
    if required not in js:
        raise SystemExit(f"missing expected premium safeguard: {required}")

src.write_text(js.rstrip() + "\n", encoding="utf-8")
out.write_text(js.rstrip() + "\n", encoding="utf-8")

html = html_path.read_text(encoding="utf-8")
old_version = 'assets/rates.min.js?v=20260919-3'
new_version = 'assets/rates.min.js?v=20260919-4'
if old_version in html:
    html = html.replace(old_version, new_version, 1)
elif new_version not in html:
    raise SystemExit("rates asset version marker not found")
html_path.write_text(html, encoding="utf-8")

print("premium quick recommendation flagship filter applied")
