from pathlib import Path

src = Path("src/rates.js")
out = Path("assets/rates.min.js")
html_path = Path("rates.html")

js = src.read_text(encoding="utf-8")

if "function wbGeneralRecommendPlan(e)" not in js:
    marker = 'document.querySelectorAll(".rate-tab")'
    pos = js.find(marker)
    if pos < 0:
        raise SystemExit("rate-tab marker not found")
    helper = (
        'function wbGeneralRecommendPlan(e){'
        'if(!wbHandsetPlan(e))return!1;'
        'const t=`${e?.name||""} ${e?.description||""} ${e?.data||""}`.toLowerCase().replace(/\\s+/g,"");'
        'const n=String(e?.age_limit||"ALL").toUpperCase();'
        'if(n&&!(["ALL","O_19"].includes(n)))return!1;'
        'if(/복지|장애|국가유공|유공자|기초생활|생계|의료급여|차상위|기초연금|손누리|소리누리|군인|현역병사|함께쓰기|데이터함께쓰기|데이터쉐어링|데이터셰어링|데이터나눠쓰기|데이터투게더|태블릿|테블릿|tablet|아이패드|ipad|워치|watch|스마트기기|세컨드디바이스|2nddevice|웨어러블|wearable|포켓파이|데이터전용|사물인터넷|iot|표준요금제|lte표준|데이터차단/.test(t))return!1;'
        'const o=q(e);return 0!==o}'
    )
    js = js[:pos] + helper + js[pos:]

old_pool = 'const e=J().filter(e=>n(e.monthly_fee)&&!wbPlanRestricted(e)),t=e.length?e:J().filter(e=>n(e.monthly_fee)),o=[]'
new_pool = 'const e=J().filter(e=>n(e.monthly_fee)&&wbGeneralRecommendPlan(e)&&!wbPlanRestricted(e)),t=e.length?e:J().filter(e=>n(e.monthly_fee)&&wbGeneralRecommendPlan(e)&&!wbPlanRestricted(e)),o=[]'
if old_pool in js:
    js = js.replace(old_pool, new_pool, 1)
elif new_pool not in js:
    raise SystemExit("recommended plan pool pattern not found")

old_quick = '||!wbHandsetPlan(p)||!n(p.monthly_fee))continue;'
new_quick = '||!wbGeneralRecommendPlan(p)||!n(p.monthly_fee))continue;'
if old_quick in js:
    if js.count(old_quick) != 1:
        raise SystemExit(f"unexpected quick-plan match count: {js.count(old_quick)}")
    js = js.replace(old_quick, new_quick, 1)
elif new_quick not in js:
    raise SystemExit("quick recommendation plan filter pattern not found")

for required in [
    "function wbGeneralRecommendPlan(e)",
    "복지|장애|국가유공",
    "태블릿|테블릿|tablet",
    "데이터투게더",
    "!wbGeneralRecommendPlan(p)",
]:
    if required not in js:
        raise SystemExit(f"missing expected safeguard: {required}")

src.write_text(js.rstrip() + "\n", encoding="utf-8")
out.write_text(js.rstrip() + "\n", encoding="utf-8")

html = html_path.read_text(encoding="utf-8")
old_version = 'assets/rates.min.js?v=20260919-2'
new_version = 'assets/rates.min.js?v=20260919-3'
if old_version in html:
    html = html.replace(old_version, new_version, 1)
elif new_version not in html:
    raise SystemExit("rates asset version marker not found")
html_path.write_text(html, encoding="utf-8")

print("general recommendation special-plan filter applied")
