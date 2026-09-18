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

# Main four-card contract and calculator deep links.
cards = storefront.get("cards") or []
check(len(cards) == 4, f"storefront card count must be 4, got {len(cards)}")
rendered = len(re.findall(r'<article class="deal-card" data-calculator-url="', site))
check(rendered == 4, f"rendered homepage deal-card count must be 4, got {rendered}")

site_unescaped = html.unescape(site)
for card in cards:
    name = card.get("name") or ""
    url = card.get("calculator_url") or ""
    check(bool(name) and name in site, f"homepage card missing: {name}")
    check(bool(url) and url in site_unescaped, f"homepage card link changed: {name}")
    query = parse_qs(urlparse(url).query)
    did = (query.get("d") or [""])[0]
    pid = (query.get("p") or [""])[0]
    carrier = (query.get("c") or [""])[0]
    join = (query.get("j") or [""])[0]
    method = (query.get("m") or [""])[0]

    check(did in device_by_id, f"storefront unknown device: {name} {did}")
    check(pid in plan_by_id, f"storefront unknown plan: {name} {pid}")
    check(join in ("기기변경", "번호이동", "신규가입"), f"storefront invalid join type: {name}")
    check(method in ("support", "contract"), f"storefront invalid discount method: {name}")

    if did in device_by_id:
        device = device_by_id[did]
        check(device.get("carrier") == carrier, f"storefront device/carrier mismatch: {name}")
        eligible = (device.get("eligible_plan_ids_by_join_type") or {}).get(join) or device.get("eligible_plan_ids") or []
        check(pid in eligible, f"storefront plan is not eligible for device/join: {name}")
    if pid in plan_by_id:
        check(plan_by_id[pid].get("carrier") == carrier, f"storefront plan/carrier mismatch: {name}")

# Recommendation and known-quote invariants.
for marker in ("갤럭시 Jump5 5G", "갤럭시 A37 5G", "갤럭시 퀀텀7", "51910", "55740", "62340"):
    check(marker in rates, f"value-phone regression marker missing: {marker}")
check("스타일폴더2" in rates, "senior Style Folder 2 recommendation missing")
check("function wbVisibleDevice" in rates and 't.includes("motorola")' in rates, "LGU+ Motorola exclusion guard missing")
check("function wbHandsetPlan" in rates, "handset-plan guard missing")

# Direct-calculator filters and deep-link support.
for marker in ('data-device-brand="samsung"', 'data-device-brand="apple"', 'data-device-brand="other"'):
    check(marker in rates_html, f"device brand filter missing: {marker}")
for marker in ('searchParams.set("d"', 'searchParams.set("p"', 'searchParams.set("m"'):
    check(marker in rates, f"calculator deep-link support missing: {marker}")

# Key tabs must remain present.
for label in ("휴대폰", "공신폰", "알뜰폰(후불)", "선불폰", "인터넷·TV"):
    check(label in rates_html, f"customer tab missing: {label}")

# Production wiring.
check("assets/ai-chat.js" not in index, "dead ai-chat.js reference returned")
check("assets/rates.min.js?v=" in rates_html, "rates production script missing")
check("assets/site-pro.min.js?v=" in index, "site production script missing")

# PWA, local image and measurement hooks.
for path in ("manifest.webmanifest","sw.js","offline.html","404.html","assets/pwa.min.js","assets/analytics-config.js","assets/conversion-tracker.min.js"):
    check(Path(path).exists(), f"missing production support file: {path}")
check('rel="manifest"' in index and 'rel="manifest"' in rates_html, "PWA manifest link missing")
check("conversion-tracker.min.js" in index and "conversion-tracker.min.js" in rates_html, "conversion tracker wiring missing")
check("pwa.min.js" in index and "pwa.min.js" in rates_html, "PWA registration wiring missing")
check("/IMG_2451.webp?v=20260918-1" in site, "A37 local image missing")
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
