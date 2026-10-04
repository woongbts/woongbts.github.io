#!/usr/bin/env python3
import json
import re
from datetime import date
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "rental/data/products.json"
GIFTS = ROOT / "rental/data/appliance-gift-options.json"
RATES = {
    "LG헬로렌탈": Decimal("0.12"),
    "스마트렌탈": Decimal("0.09"),
    "BS ON": Decimal("0.07"),
    "이니렌탈": Decimal("0.10"),
    "현대유버스": Decimal("0.07"),
}
errors = []
warnings = []

def load(path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)

products_data = load(PRODUCTS)
gift_data = load(GIFTS)
products = products_data.get("products", [])
ids = [str(p.get("id") or "") for p in products]

if len(ids) != len(set(ids)):
    errors.append("상품 ID가 중복되어 있습니다.")

product_ids = set(ids)
active = [
    p for p in products
    if p.get("availability") != "inactive"
    and not re.search(r"접수불가|접수중지", str(p.get("name") or ""))
]

for p in active:
    pid = str(p.get("id") or "")
    if not pid:
        errors.append("ID가 없는 활성 상품이 있습니다.")
        continue
    if not re.fullmatch(r"[A-Za-z0-9._-]+", pid):
        errors.append(f"{pid}: 상품 ID에 URL 경로로 쓰기 어려운 문자가 있습니다.")
    sellable_options = []
    for o in (p.get("options") or []):
        text = " ".join(str(o.get(k) or "") for k in ("managementLabel", "sourceOption", "care"))
        try:
            monthly = int(o.get("monthly"))
        except (TypeError, ValueError):
            continue
        if monthly > 0 and not re.search(r"(?:^|\\s)단종/", text):
            sellable_options.append(o)
    if not sellable_options:
        errors.append(f"{pid}: 판매 가능한 월요금 옵션이 없습니다.")
    for o in sellable_options:
        monthly = int(o.get("monthly"))
        if monthly < 5000 or monthly > 500000:
            warnings.append(f"{pid}: 월요금 이상치 확인 필요: {monthly:,}원")
        gift = o.get("gift")
        term = o.get("term")
        try:
            if gift is not None and term is not None and int(gift) > monthly * int(term):
                warnings.append(f"{pid}: 사은품이 총 렌탈료보다 큽니다.")
        except (TypeError, ValueError):
            pass
    image = str(p.get("image") or "").strip()
    details = [str(x).strip() for x in (p.get("detailImages") or []) if str(x).strip()]
    if not image and not details:
        errors.append(f"{pid}: 활성 상품에 이미지가 없습니다.")
    if image.startswith("assets/"):
        image_path = ROOT / "rental" / image
        if not image_path.exists():
            errors.append(f"{pid}: 로컬 이미지 파일이 없습니다: {image}")
    if re.search(r"접수불가|접수중지", str(p.get("name") or "")):
        errors.append(f"{pid}: 접수불가 상품이 활성 상태입니다.")

gift_products = gift_data.get("products", {})
option_count = 0
for pid, payload in gift_products.items():
    if pid not in product_ids:
        errors.append(f"{pid}: 사은품 조건에만 있고 상품 데이터에는 없습니다.")
    options = payload.get("options", [])
    option_count += len(options)
    seen_keys = set()
    for o in options:
        key = str(o.get("key") or "")
        if key in seen_keys:
            errors.append(f"{pid}: 옵션 키가 중복입니다: {key}")
        seen_keys.add(key)
        company = str(o.get("managementLabel") or o.get("management") or "")
        try:
            monthly = int(o.get("monthly"))
            term = int(o.get("term"))
            gift = int(o.get("gift"))
        except (TypeError, ValueError):
            errors.append(f"{pid}/{key}: 월요금·계약기간·사은품 숫자 형식이 올바르지 않습니다.")
            continue
        if monthly <= 0 or term <= 0 or gift < 0:
            errors.append(f"{pid}/{key}: 금액 또는 계약기간이 올바르지 않습니다.")
            continue
        if company == "KT가전구독":
            expected = 40000
        elif company in RATES:
            expected = int(Decimal(monthly) * Decimal(term) * RATES[company] / Decimal(2))
        else:
            errors.append(f"{pid}/{key}: 등록되지 않은 렌탈사입니다: {company}")
            continue
        if gift != expected:
            errors.append(f"{pid}/{key}: 고객사은품 {gift:,}원 != 계산값 {expected:,}원")

if gift_data.get("productCount") != len(gift_products):
    errors.append("appliance-gift-options.json의 productCount가 실제 상품 수와 다릅니다.")
if gift_data.get("optionCount") != option_count:
    errors.append("appliance-gift-options.json의 optionCount가 실제 옵션 수와 다릅니다.")

generated = str(gift_data.get("generatedAt") or "")
try:
    y, m, _ = map(int, generated.split("-"))
    today = date.today()
    if (y, m) != (today.year, today.month):
        errors.append(f"사은품 기준월이 오래되었습니다: {generated} (현재 {today.year}-{today.month:02d})")
except Exception:
    errors.append("사은품 generatedAt 날짜를 확인할 수 없습니다.")

print(f"활성상품 {len(active)}개 / 종합가전 사은품상품 {len(gift_products)}개 / 옵션 {option_count}개 검사")
for msg in warnings:
    print(f"WARNING: {msg}")
if errors:
    print("\n검사 실패:")
    for msg in errors:
        print(f"- {msg}")
    raise SystemExit(1)
print("렌탈 데이터 품질 검사 통과")
