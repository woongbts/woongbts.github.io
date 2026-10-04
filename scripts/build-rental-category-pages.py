#!/usr/bin/env python3
"""Generate SEO category landing pages for Woongbi Rental."""
from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
RENTAL = ROOT / "rental"
PRODUCTS = RENTAL / "data/products.json"
GIFTS = RENTAL / "data/appliance-gift-options.json"
OVERRIDES = RENTAL / "data/catalog-overrides.json"

CATEGORIES = {
    "정수기": ("water-purifier", "정수기 렌탈", "직수·냉온·얼음정수기까지 월요금과 사은품, 관리방식을 한 번에 비교하세요."),
    "공기청정기": ("air-purifier", "공기청정기 렌탈", "공간 크기와 관리방식, 월 렌탈료와 사은품을 비교해 맞는 제품을 찾으세요."),
    "비데·연수기": ("bidet", "비데·연수기 렌탈", "자가관리·방문관리 조건과 월요금, 사은품을 비교하세요."),
    "매트리스·프레임": ("mattress", "매트리스·침대 렌탈", "매트리스·프레임의 사이즈와 케어 조건, 월요금과 혜택을 비교하세요."),
    "안마의자": ("massage-chair", "안마의자 렌탈", "안마의자 렌탈 상품의 월요금과 계약기간, 혜택을 비교하세요."),
    "세탁·건조·의류관리": ("laundry", "세탁기·건조기 렌탈", "세탁기·건조기·의류관리기 렌탈 조건과 월요금을 비교하세요."),
    "냉장고·김치냉장고": ("refrigerator", "냉장고 렌탈", "냉장고·김치냉장고 렌탈 상품의 월요금과 사은품을 비교하세요."),
    "TV·디지털": ("tv-digital", "TV·디지털가전 렌탈", "TV·모니터 등 디지털가전 렌탈 상품을 조건별로 비교하세요."),
    "에어컨·청소기": ("aircon-cleaner", "에어컨·청소기 렌탈", "에어컨·청소기 등 생활 필수 가전의 렌탈 조건을 비교하세요."),
    "주방가전": ("kitchen-appliance", "주방가전 렌탈", "식기세척기와 조리가전 등 주방가전 렌탈 조건을 비교하세요."),
    "생활가전": ("home-appliance", "생활가전 렌탈", "다양한 생활가전 렌탈 상품의 월요금과 혜택을 비교하세요."),
    "건강·뷰티": ("health-beauty", "건강·뷰티가전 렌탈", "건강·뷰티가전 렌탈 상품을 가격과 조건별로 비교하세요."),
    "가구·침대": ("furniture-bed", "가구·침대 렌탈", "생활가구와 침대 렌탈 상품의 월요금과 계약조건을 비교하세요."),
    "레저·자동차": ("leisure-auto", "레저·자동차 렌탈", "레저·자동차 관련 렌탈 상품의 조건과 월요금을 비교하세요."),
}

BRAND_LABELS = {"COWAY":"코웨이","CUCKOO":"쿠쿠","LG퓨리케어":"LG 퓨리케어"}
BRAND_RANK = {"COWAY":1,"LG퓨리케어":2,"SK매직":3,"CUCKOO":4}


def load(path: Path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def sellable(option: dict) -> bool:
    text = " ".join(str(option.get(k) or "") for k in ("managementLabel","sourceOption","care"))
    try:
        monthly = int(option.get("monthly"))
    except (TypeError, ValueError):
        return False
    return monthly > 0 and not re.search(r"(?:^|\s)단종/", text)


def apply_overrides(products, gift_data, override_data):
    overrides = (override_data or {}).get("products", {})
    gifts = (gift_data or {}).get("products", {})
    for product in products:
        pid = str(product.get("id") or "")
        if pid in overrides:
            product.update(overrides[pid])
        if product.get("sourceKind") == "clover-import" and pid in gifts:
            product.update(gifts[pid])


def metrics(product):
    options = [o for o in product.get("options", []) if sellable(o)]
    if not options:
        return None, None
    monthly = [int(o["monthly"]) for o in options]
    gifts = []
    for o in options:
        try:
            gifts.append(int(o.get("gift")))
        except (TypeError, ValueError):
            pass
    return min(monthly), max(gifts) if gifts else None


def image_url(product):
    value = str(product.get("image") or product.get("imageSourceOriginal") or "").strip()
    if value.startswith("assets/"):
        return "/rental/" + value
    return value


def brand_label(value):
    return BRAND_LABELS.get(str(value or ""), str(value or ""))


def product_card(product):
    pid = quote(str(product.get("id") or ""), safe="-_")
    minimum, maximum = metrics(product)
    img = image_url(product)
    model = str(product.get("model") or "")
    brand = brand_label(product.get("brand"))
    image = f'<img src="{html.escape(img, quote=True)}" alt="{html.escape(str(product.get("name") or ""))}" loading="lazy">' if img else '<span>W</span>'
    return f"""<article class="category-product">
      <div class="category-product-image">{image}</div>
      <small>{html.escape(brand)}{(" · " + html.escape(model)) if model else ""}</small>
      <h3>{html.escape(str(product.get("name") or "상품"))}</h3>
      <p>{html.escape(str(product.get("shortDescription") or product.get("category") or ""))}</p>
      <div class="category-product-price">
        <span>월 렌탈료<strong>{(f"{minimum:,}원부터" if minimum is not None else "상담 확인")}</strong></span>
        <span>고객사은품<strong>{(f"최대 {maximum:,}원" if maximum is not None else "상담 확인")}</strong></span>
      </div>
      <a href="product/{pid}/">조건 자세히 보기 →</a>
    </article>"""


def page(category, slug, title, desc, products, policy_date):
    canonical = f"https://woongbts.github.io/rental/{slug}/"
    page_title = f"{title} | 월요금·사은품 비교 | 웅비렌탈"
    top = sorted(products, key=lambda p:(BRAND_RANK.get(str(p.get("brand") or ""),99), metrics(p)[0] or 999999999, str(p.get("name") or "")))[:12]
    cards = "\n".join(product_card(p) for p in top)
    items = [
        {"@type":"ListItem","position":i+1,"url":f"https://woongbts.github.io/rental/product/{quote(str(p.get('id') or ''),safe='-_')}/","name":str(p.get("name") or "")}
        for i,p in enumerate(top)
    ]
    jsonld = json.dumps({"@context":"https://schema.org","@type":"ItemList","name":title,"itemListElement":items},ensure_ascii=False,separators=(",",":"))
    ai_url = "/rental/?ai=1&cat=" + quote(category)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <base href="/rental/">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="{html.escape(desc,quote=True)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="웅비렌탈">
  <meta property="og:title" content="{html.escape(page_title,quote=True)}">
  <meta property="og:description" content="{html.escape(desc,quote=True)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="https://woongbts.github.io/rental/assets/woongbi-rental-icon-180.png">
  <script type="application/ld+json">{jsonld}</script>
  <title>{html.escape(page_title)}</title>
  <meta name="theme-color" content="#168FD1">
  <link rel="icon" href="assets/woongbi-rental-favicon.svg?v=20261003-blue3" type="image/svg+xml">
  <link rel="stylesheet" href="assets/rental.css?v=20261004-core17">
  <link rel="stylesheet" href="assets/category.css?v=20261004-cat1">
</head>
<body class="category-page">
  <header class="site-header"><div class="wrap nav"><a class="brand" href="./" aria-label="웅비렌탈 홈"><img class="brand-mark" src="assets/woongbi-rental-mark.svg?v=20261003-mark2" alt=""><span>웅비렌탈<small>WOONGBI RENTAL</small></span></a><div class="nav-actions"><a class="nav-home-link" href="../" aria-label="웅비통신 홈페이지로 이동"><img src="assets/woongbi-telecom-mark.svg" alt=""><span><strong>웅비통신</strong><small>덕천만덕점</small></span></a><a class="nav-cta" href="http://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카톡 상담</a></div></div></header>
  <main>
    <section class="category-hero"><div class="wrap category-hero-grid"><div><p class="eyebrow dark">웅비렌탈 품목별 가이드</p><h1><em>{html.escape(title)}</em><br>복잡한 조건을 쉽게 비교하세요.</h1><p>{html.escape(desc)}</p><div class="category-hero-actions"><a class="primary" href="{ai_url}">AI로 3개 추천받기</a><a class="ghost" href="./#products">전체 상품 보기</a></div></div><aside class="category-fresh"><span>최근 정책 확인</span><strong>{html.escape(policy_date or "최신 정책")}</strong><small>월요금·사은품·프로모션은 실제 접수 전 최신 조건을 다시 확인합니다.</small></aside></div></section>
    <section class="category-content"><div class="wrap"><div class="category-title-row"><h2>{html.escape(title)} 추천 상품</h2><p>현재 등록 상품 중 브랜드 선호도와 월요금을 함께 보고 대표 상품을 먼저 보여드립니다.</p></div><div class="category-products">{cards}</div>
      <section class="category-help"><h2>렌탈 고를 때 이것만 확인하세요.</h2><div class="category-help-grid"><article><span>01</span><strong>월요금</strong><p>월 납부액과 계약기간을 함께 확인합니다.</p></article><article><span>02</span><strong>관리·설치 조건</strong><p>자가관리·방문관리와 설치 조건을 확인합니다.</p></article><article><span>03</span><strong>사은품·최신 정책</strong><p>사은품과 프로모션은 최종 접수 전 다시 확인합니다.</p></article></div></section>
      <div class="category-trust"><strong>웅비통신 덕천만덕점이 직접 상담합니다.</strong><p>홈페이지에서 본 상품과 조건을 이어 받아 최신 월요금·사은품을 확인하고 렌탈사 공식 절차로 접수를 진행합니다.</p></div>
    </div></section>
  </main>
  <footer class="footer"><div class="wrap footer-inner"><div><strong>웅비렌탈</strong><span>웅비통신 덕천만덕점</span></div><div><a href="tel:0513437677">051-343-7677</a><span>부산 북구 만덕대로178번길 17</span></div></div><div class="wrap footer-note">상품·요금·프로모션·사은품 조건은 변경될 수 있으며 최종 접수 전 상담을 통해 확인합니다.</div></footer>
  <script src="/assets/analytics-config.js?v=20260929-2" defer></script>
  <script src="/assets/conversion-tracker.min.js?v=20261004-ops1" defer></script>
  <script src="/assets/site-analytics.min.js?v=20261004-source1" defer></script>
</body>
</html>"""


def main():
    data = load(PRODUCTS, {"products":[]}) or {"products":[]}
    gift_data = load(GIFTS, {}) or {}
    override_data = load(OVERRIDES, {}) or {}
    products = [dict(p) for p in data.get("products", [])]
    apply_overrides(products, gift_data, override_data)
    active = [
        p for p in products
        if p.get("availability") != "inactive"
        and not re.search(r"접수불가|접수중지|단종", str(p.get("name") or ""))
        and str(p.get("id") or "").strip()
        and any(sellable(o) for o in (p.get("options") or []))
    ]
    policy_date = str(gift_data.get("generatedAt") or data.get("updatedAt") or "")[:10]

    count = 0
    for category,(slug,title,desc) in CATEGORIES.items():
        target = RENTAL / slug
        if target.exists():
            shutil.rmtree(target)
        rows = [p for p in active if p.get("category") == category]
        if not rows:
            continue
        target.mkdir(parents=True,exist_ok=True)
        (target / "index.html").write_text(page(category,slug,title,desc,rows,policy_date),encoding="utf-8")
        count += 1

    print(f"generated {count} rental category pages")


if __name__ == "__main__":
    main()
