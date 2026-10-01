#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import html
import json
import re

def load_json(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"invalid JSON root: {path}")
    return data

catalog = load_json("data/catalog.json")
plans = load_json("data/plans.json")
supports = load_json("data/supports.json")
overrides = load_json("data/store-overrides.json")
storefront = load_json("data/storefront.json")

site = Path("assets/site-pro.min.js").read_text(encoding="utf-8")
rates = Path("assets/rates.min.js").read_text(encoding="utf-8")
recommend_bridge = Path("assets/recommend-api-bridge.min.js").read_text(encoding="utf-8")
quote_bridge = Path("assets/quote-api-bridge.min.js").read_text(encoding="utf-8")
studyphone_bridge = Path("assets/studyphone-api-bridge.min.js").read_text(encoding="utf-8")
internet_bridge = Path("assets/internet-api-bridge.min.js").read_text(encoding="utf-8")
internet_ui = Path("assets/internet-ui.min.js").read_text(encoding="utf-8")
mvno_bridge = Path("assets/mvno-api-bridge.min.js").read_text(encoding="utf-8")
mvno_display = Path("assets/mvno-display.js").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")
rates_html = Path("rates.html").read_text(encoding="utf-8")

devices = catalog.get("devices") or []
mobile_plans = plans.get("mobile_plans") or []
schedules = supports.get("support_schedules") or []
device_by_id = {d.get("id"): d for d in devices if d.get("id")}
plan_by_id = {p.get("id"): p for p in mobile_plans if p.get("id")}

errors = []
def check(condition, message):
    if not condition:
        errors.append(message)

# Support amounts must never turn an invalid feed value into a free handset.
for schedule in schedules:
    for did in schedule.get("device_ids") or []:
        device = device_by_id.get(did)
        check(device is not None, f"unknown support device: {did}")
        for pid, amount in (schedule.get("amounts") or {}).items():
            check(type(amount) is int and device is not None and 0 <= amount <= device["retail_price"], f"unverified support: {did} {pid}={amount}")

# Core carrier coverage.
for carrier in ("SKT", "KT", "LGU+"):
    check(any(d.get("carrier") == carrier for d in devices), f"no devices for {carrier}")
    check(any(p.get("carrier") == carrier for p in mobile_plans), f"no plans for {carrier}")

# Store-specific Style Folder 2 contract.
style = [d for d in devices if d.get("name") == "스타일폴더2"]
check(len(style) == 2, f"Style Folder 2 count must be 2, got {len(style)}")
check({d.get("carrier") for d in style} == {"SKT", "LGU+"}, "Style Folder 2 must exist only on SKT/LGU+")
check({d.get("model_code") for d in style} == {"AT-M140S", "AT-M140L"}, "Style Folder 2 model codes changed")
check(not any(d.get("carrier") == "KT" and d.get("name") == "스타일폴더2" for d in devices), "Style Folder 2 leaked into KT")
pinned = set((overrides.get("pinned_devices") or {}).keys())
check({"AT-M140S", "AT-M140L"}.issubset(pinned), "store overrides missing Style Folder 2")

for d in style:
    for join in ("기기변경", "번호이동", "신규가입"):
        matched = [
            s for s in schedules
            if d.get("id") in (s.get("device_ids") or [])
            and join in (s.get("join_types") or [])
            and (s.get("amounts") or {})
        ]
        check(bool(matched), f"missing public support: {d.get('id')} {join}")

# Non-handset plans must never leak into the phone calculator.
legacy_2g_3g_plans = [
    p for p in mobile_plans
    if re.search(r"(^|[^a-z0-9])[23]g([^a-z0-9]|$)", str(p.get("name") or "").lower().replace(" ", ""), re.IGNORECASE)
]
check(not legacy_2g_3g_plans, f"legacy 2G/3G plans leaked: {[p.get('name') for p in legacy_2g_3g_plans[:5]]}")

blocked = (
    "아웃도어", "tab", "태블릿", "watch", "워치", "포켓파이", "스마트기기",
    "데이터함께쓰기", "데이터쉐어링", "데이터셰어링", "아이패드", "ipad",
    "세컨드디바이스", "2nddevice", "wearable", "웨어러블", "데이터나눠쓰기",
)
for plan in mobile_plans:
    normalized = str(plan.get("name") or "").lower().replace(" ", "")
    if any(token in normalized for token in blocked):
        errors.append(f"non-handset plan leaked: {plan.get('id')} {plan.get('name')}")
        break

# Homepage uses its current shared calculator-card integration.
cards = ["senior", "senior", "value", "premium"]
check("engine.recommend('senior')" in site and "engine.recommend('value')" in site and "engine.recommend('premium')" in site, "homepage shared recommendation engine missing")
check("card.href=engine.detailUrl(c)" in site, "homepage calculator conditions are not shared")
check("plan-eligibility.js" in index and "plan-eligibility.js" in rates_html, "shared eligibility wiring missing")
check("이런 분들이 많이 찾아오세요" not in index, "duplicate service section returned")

# Recommendation logic is server-owned. Public code must only keep UI/wiring, not the old selection tables/algorithms.
check("/recommend/purpose" in recommend_bridge, "server purpose recommendation wiring missing")
check("/recommend/quick" in recommend_bridge, "server quick recommendation wiring missing")
check("wb-server-card" in recommend_bridge, "server purpose card renderer missing")
check("quick-plan-specs" in recommend_bridge, "server quick plan allowance renderer missing")
check("methodMemory" in recommend_bridge and "aria-pressed" in recommend_bridge, "server recommendation method switching missing")
for marker in ("const fe={senior:", 'jump5:{category:"value"', "function Ke(){", "profiles={light:{min:3e4"):
    check(marker not in rates, f"legacy recommendation logic returned: {marker}")
check("function wbVisibleDevice" in rates and 't.includes("motorola")' in rates, "LGU+ Motorola exclusion guard missing")
check("function wbHandsetPlan" in rates, "handset-plan guard missing")

# Direct-calculator filters and deep-link support.
for marker in ('data-device-brand="samsung"', 'data-device-brand="apple"', 'data-device-brand="other"'):
    check(marker in rates_html, f"device brand filter missing: {marker}")
for marker in ('searchParams.set("d"', 'searchParams.set("p"', 'searchParams.set("m"'):
    check(marker in rates, f"calculator deep-link support missing: {marker}")
check("/quote/mobile" in quote_bridge, "server mobile quote wiring missing")
check("/quote/studyphone" in studyphone_bridge, "server studyphone quote wiring missing")
check("WoongbiStudyphoneApi" in studyphone_bridge, "studyphone server state bridge missing")
check("studyphone-api-bridge.min.js" in rates_html, "studyphone API bridge script missing")
check(not Path("data/studyphone.json").exists(), "public studyphone pricing data returned")
for marker in ("installment_apr", "public_support", "function Qe(e){const t=l?.device", "Math.pow(1+o,t)"):
    check(marker not in rates, f"public studyphone quote logic returned: {marker}")

# Internet/TV pricing, bundle rules, extra-TV formulas and gift matrices are server-owned.
check("/quote/internet" in internet_bridge, "server internet quote wiring missing")
check("WoongbiInternetApi" in internet_bridge and "WoongbiInternetApi" in internet_ui, "internet server state bridge missing")
check("internet-api-bridge.min.js" in rates_html and "internet-ui.min.js" in rates_html, "internet server scripts missing")
check(not Path("data/internet.json").exists(), "public internet pricing data returned")
for marker in ("fallbackSettopFee", "internetDiscountBySpeed", "wbWiredPackageOverride", "SKB_TV_POP180:{100:30", "TV_SMART_PLUS:{100:29", "const Mt=t(\"internet-carrier\")"):
    check(marker not in rates, f"public wired pricing logic returned: {marker}")

# MVNO assortment exclusions and store-curated picks are server-owned.
check("/catalog/mvno" in mvno_bridge, "server MVNO catalog wiring missing")
check("WoongbiMvnoApi" in mvno_bridge and "WoongbiMvnoApi" in rates, "MVNO server state bridge missing")
check("mvno-api-bridge.min.js" in rates_html, "MVNO server bridge script missing")
check(not Path("data/mvno-postpaid.json").exists(), "public MVNO source data returned")
for marker in ("MMOBILE-1295", "SKYLIFE-2069", "UPLUSE-2390", "SMKT", "IYAGISKT"):
    check(marker not in mvno_display, f"public MVNO assortment policy returned: {marker}")
check("data/mvno-postpaid.json" not in rates, "public MVNO JSON fetch returned")

# Key tabs must remain present.
for label in ("휴대폰", "공신폰", "알뜰폰(후불)", "선불폰", "인터넷·TV"):
    check(label in rates_html, f"customer tab missing: {label}")

# Production wiring.
check("assets/ai-chat.js" not in index, "dead ai-chat.js reference returned")
check("assets/rates.min.js?v=" in rates_html, "rates production script missing")
check("assets/site-pro.min.js?v=" in index, "site production script missing")
# Naver business-channel telecom pre-approval visibility contract.
PRECON_URL = "https://ictmarket.or.kr:8443/precon/pop_CertIcon.do?PRECON_REQ_ID=PRE0000119098&amp;YN=1"
check('class="precon-badge"' in index, "top pre-approval badge missing")
check('class="precon-official-mark"' in index and 'src="assets/kait-preconsent-mark.png"' in index, "official pre-approval mark missing")
check(Path("assets/kait-preconsent-mark.png").is_file(), "official pre-approval image asset missing")
check('alt="KAIT 사전승낙 오프라인판매점 마크 · 웅비통신 승낙서 조회"' in index, "pre-approval mark accessible description missing")
check(index.count(PRECON_URL) >= 2, "official pre-approval lookup must remain in both header and footer")
check('대표자 : 신웅비' in index, "representative name missing for Naver business verification")
check('"founder":{"@type":"Person","name":"신웅비"}' in index, "representative structured data missing")

# Quick recommendation v3 contract is rendered by the server bridge.
check('id="quick-data"' not in rates_html, "legacy quick data selector returned")
check('월 부담 가볍게 · 3~4만원대' in rates_html, "quick monthly burden band missing")
check('내 조건으로 3가지 비교' in rates_html, "quick recommendation title missing")
check('/recommend/quick' in recommend_bridge, "smart quick recommendation endpoint missing")
check('quick-plan-specs' in recommend_bridge, "quick plan allowance display missing")

# PWA, local image and measurement hooks.
for path in ("manifest.webmanifest","sw.js","offline.html","404.html","assets/pwa.min.js","assets/analytics-config.js","assets/conversion-tracker.min.js"):
    check(Path(path).exists(), f"missing production support file: {path}")
check('rel="manifest"' in index and 'rel="manifest"' in rates_html, "PWA manifest link missing")
check("conversion-tracker.min.js" in index and "conversion-tracker.min.js" in rates_html, "conversion tracker wiring missing")
check("pwa.min.js" in index and "pwa.min.js" in rates_html, "PWA registration wiring missing")
check(Path("assets/device-images.js").exists(), "shared homepage device images missing")
check("images.samsung.com" not in site, "A37 still depends on external image host")
check("https://woongbts.github.io/rates.html" in Path("sitemap.xml").read_text(encoding="utf-8"), "rates page missing from sitemap")

# Public customer assets must not expose internal commercial/source terms.
forbidden = ("리베이트", "판매점 수수료", "정산금액", "제로노트", "dealer_fee", "commission")
public_text = "\n".join([
    json.dumps(catalog, ensure_ascii=False),
    json.dumps(plans, ensure_ascii=False),
    json.dumps(supports, ensure_ascii=False),
    rates,
    site,
    recommend_bridge,
    quote_bridge,
    studyphone_bridge,
    internet_bridge,
    internet_ui,
    mvno_bridge,
    mvno_display,
]).lower()
for word in forbidden:
    check(word.lower() not in public_text, f"forbidden internal/customer-facing token leaked: {word}")

# Canonical calculator source must match production exactly.
src = Path("src/rates.js").read_text(encoding="utf-8").rstrip()
prod = Path("assets/rates.min.js").read_text(encoding="utf-8").rstrip()
check(src == prod, "src/rates.js and assets/rates.min.js differ")

if errors:
    print("SITE REGRESSION CHECK FAILED")
    for error in errors:
        print(" -", error)
    raise SystemExit(1)

print("SITE REGRESSION CHECK OK")
print(f"devices={len(devices)} plans={len(mobile_plans)} supports={len(schedules)} cards={len(cards)}")
