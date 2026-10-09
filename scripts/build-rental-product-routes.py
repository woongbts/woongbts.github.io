#!/usr/bin/env python3
"""Generate clean, crawlable rental product routes for GitHub Pages.

Source of truth stays in rental/product.html + rental/data/products.json.
Generated pages live at /rental/product/<id>/ and are not edited by hand.
"""
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
TEMPLATE = RENTAL / "product.html"
OUT = RENTAL / "product"


def brand_label(value: str) -> str:
    return {
        "COWAY": "코웨이",
        "CUCKOO": "쿠쿠",
        "LG퓨리케어": "LG 퓨리케어",
    }.get(value, value or "")


def sellable(option: dict) -> bool:
    text = " ".join(str(option.get(k) or "") for k in ("managementLabel", "sourceOption", "care"))
    try:
        float(option.get("monthly"))
    except (TypeError, ValueError):
        return False
    return not re.search(r"(?:^|\s)단종/", text)


def metrics(product: dict):
    options = [o for o in product.get("options", []) if sellable(o)]
    monthly = [int(o["monthly"]) for o in options if o.get("monthly") is not None]
    gifts = []
    for o in options:
        try:
            gifts.append(int(o.get("gift")))
        except (TypeError, ValueError):
            pass
    return (
        min(monthly) if monthly else None,
        max(monthly) if monthly else None,
        max(gifts) if gifts else None,
        len(options),
    )


def replace_meta(source: str, product: dict) -> str:
    pid = str(product.get("id") or "")
    brand = brand_label(str(product.get("brand") or ""))
    name = str(product.get("name") or "상품")
    model = str(product.get("model") or "")
    category = str(product.get("category") or "")
    minimum, maximum_monthly, maximum_gift, offer_count = metrics(product)
    canonical = f"https://woongbts.github.io/rental/product/{quote(pid, safe='-_')}/"
    title = f"{brand} {name} 렌탈 | 웅비렌탈".strip()
    desc_parts = [f"모델 {model}" if model else ""]
    if minimum is not None:
        desc_parts.append(f"월 {minimum:,}원부터")
    if maximum_gift is not None:
        desc_parts.append(f"고객사은품 최대 {maximum_gift:,}원")
    desc_parts.append("최종 접수 전 최신 조건 확인")
    desc = " · ".join(x for x in desc_parts if x)

    image = str(product.get("image") or "").strip()
    if image.startswith("assets/"):
        image = "https://woongbts.github.io/rental/" + image
    elif not image:
        image = "https://woongbts.github.io/rental/assets/woongbi-rental-icon-180.png"

    jsonld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "brand": {"@type": "Brand", "name": brand or "웅비렌탈"},
        "model": model or None,
        "sku": pid,
        "category": category or None,
        "description": desc,
        "url": canonical,
        "image": [image] if image else None,
        "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "KRW",
            "lowPrice": minimum,
            "highPrice": maximum_monthly if maximum_monthly is not None else minimum,
            "offerCount": max(1, offer_count),
            "availability": "https://schema.org/InStock",
            "url": canonical,
            "priceSpecification": {
                "@type": "UnitPriceSpecification",
                "price": minimum,
                "priceCurrency": "KRW",
                "unitText": "월 렌탈료",
            },
        } if minimum is not None else None,
    }
    jsonld = {k: v for k, v in jsonld.items() if v not in (None, "", [])}

    source = source.replace("<head>", '<head>\n  <base href="/rental/">', 1)
    source = re.sub(r'(<meta name="description" id="product-meta-description" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(desc, quote=True) + m.group(2), source, count=1)
    source = re.sub(r'(<link rel="canonical" id="product-canonical" href=")[^"]*(">)', lambda m: m.group(1) + canonical + m.group(2), source, count=1)
    source = re.sub(r'(<meta property="og:title" id="product-og-title" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(title, quote=True) + m.group(2), source, count=1)
    source = re.sub(r'(<meta property="og:description" id="product-og-description" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(desc, quote=True) + m.group(2), source, count=1)
    source = re.sub(r'(<meta property="og:url" id="product-og-url" content=")[^"]*(">)', lambda m: m.group(1) + canonical + m.group(2), source, count=1)
    source = re.sub(r'(<meta property="og:image" id="product-og-image" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(image, quote=True) + m.group(2), source, count=1)
    source = re.sub(r'(<meta property="og:image:alt" id="product-og-image-alt" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(f"{brand} {name} 렌탈 상품 이미지", quote=True) + m.group(2), source, count=1)
    source = re.sub(r'(<meta name="twitter:title" id="product-twitter-title" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(title, quote=True) + m.group(2), source, count=1)
    source = re.sub(r'(<meta name="twitter:description" id="product-twitter-description" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(desc, quote=True) + m.group(2), source, count=1)
    source = re.sub(r'(<meta name="twitter:image" id="product-twitter-image" content=")[^"]*(">)', lambda m: m.group(1) + html.escape(image, quote=True) + m.group(2), source, count=1)
    source = re.sub(r'<script type="application/ld\+json" id="product-jsonld">.*?</script>', '<script type="application/ld+json" id="product-jsonld">' + json.dumps(jsonld, ensure_ascii=False, separators=(",", ":")) + '</script>', source, count=1)
    source = re.sub(r"<title>.*?</title>", "<title>" + html.escape(title) + "</title>", source, count=1)

    # The base HTML must identify the product even before JavaScript executes.
    # The existing client-side renderer updates these same IDs with live policy data.
    escaped_name = html.escape(name)
    escaped_brand = html.escape(brand or "웅비렌탈")
    model_text = " · ".join(
        str(x).strip() for x in (model, product.get("color")) if str(x or "").strip()
    )
    raw_summary = str(
        product.get("shortDescription") or product.get("description") or ""
    ).strip()
    # Keep initial copy concise and unique to the actual catalog entry.
    summary = raw_summary[:280] if raw_summary else (
        f"{brand} {name} 렌탈 상품입니다. 계약기간과 관리방식에 따른 조건을 비교할 수 있습니다."
    )
    price_facts = []
    if minimum is not None:
        price_facts.append(f"월 렌탈료 {minimum:,}원부터")
    if maximum_gift is not None:
        price_facts.append(f"고객사은품 최대 {maximum_gift:,}원")
    if price_facts:
        summary += " " + " · ".join(price_facts) + (
            ". 금액과 혜택은 동일 옵션 기준이 아닐 수 있으며 "
            "신청 전 선택 조건별 최신 정책을 확인합니다."
        )
    tags = product.get("tags") if isinstance(product.get("tags"), list) else []
    highlights = product.get("highlights")
    highlights = highlights if isinstance(highlights, list) else tags
    highlights_html = "".join(
        f"<span>{html.escape(str(value))}</span>"
        for value in highlights[:8] if str(value or "").strip()
    )

    initial_values = (
        ('<b id="breadcrumb-model">상품 상세</b>',
         f'<b id="breadcrumb-model">{html.escape(model or name)}</b>'),
        ('<span class="brand-label" id="generic-brand">WOONGBI RENTAL</span>',
         f'<span class="brand-label" id="generic-brand">{escaped_brand}</span>'),
        ('<h1 id="generic-title">상품 정보를 불러오는 중입니다.</h1>',
         f'<h1 id="generic-title">{escaped_name}</h1>'),
        ('<p class="model" id="generic-model"></p>',
         f'<p class="model" id="generic-model">{html.escape(model_text)}</p>'),
        ('<p id="generic-description" class="generic-product-description"></p>',
         f'<p id="generic-description" class="generic-product-description">{html.escape(summary)}</p>'),
        ('<div id="generic-highlights" class="generic-highlight-list" aria-label="핵심 특징"></div>',
         f'<div id="generic-highlights" class="generic-highlight-list" aria-label="핵심 특징">{highlights_html}</div>'),
    )
    for before, after in initial_values:
        if source.count(before) != 1:
            raise ValueError(f"Missing or duplicated product template anchor: {before}")
        source = source.replace(before, after, 1)

    return source


def main():
    data = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    template = TEMPLATE.read_text(encoding="utf-8")
    products = [
        p for p in data.get("products", [])
        if p.get("availability") != "inactive"
        and not re.search(r"접수불가|접수중지|단종", str(p.get("name") or ""))
        and str(p.get("id") or "").strip()
    ]

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    for product in products:
        pid = quote(str(product["id"]), safe="-_")
        target = OUT / pid
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(replace_meta(template, product), encoding="utf-8")

    print(f"generated {len(products)} clean rental product routes")


if __name__ == "__main__":
    main()
