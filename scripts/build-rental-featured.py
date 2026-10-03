#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "rental/data/products.json"
GIFTS = ROOT / "rental/data/appliance-gift-options.json"
OUT = ROOT / "rental/data/featured.json"

CATEGORIES = ["정수기", "공기청정기", "비데·연수기", "안마의자", "매트리스·프레임"]
PREFS = [
    re.compile(r"coway|코웨이", re.I),
    re.compile(r"퓨리케어|lg", re.I),
    re.compile(r"sk매직|sk magic", re.I),
    re.compile(r"cuckoo|쿠쿠", re.I),
]
LIMITS = {"정수기":45000, "공기청정기":40000, "비데·연수기":30000, "안마의자":120000, "매트리스·프레임":65000}

def metrics(product):
    options = [o for o in product.get("options", []) if isinstance(o.get("monthly"), (int, float))]
    if not options:
        return None
    monthly = [int(o["monthly"]) for o in options]
    gifts = [int(o["gift"]) for o in options if isinstance(o.get("gift"), (int, float))]
    if not gifts:
        return None
    return min(monthly), max(gifts)

def score(product):
    value = metrics(product)
    if not value:
        return -1
    monthly, gift = value
    over = max(0, monthly - LIMITS.get(product.get("category"), 50000))
    return gift - monthly * 1.55 - over * 4.5

def slim(product):
    return {
        "id": product.get("id"),
        "brand": product.get("brand"),
        "name": product.get("name"),
        "model": product.get("model") or "",
        "category": product.get("category"),
        "page": product.get("page"),
        "image": product.get("image") or "",
        "imageSourceOriginal": product.get("imageSourceOriginal") or "",
        "detailImages": (product.get("detailImages") or [])[:1],
        "availability": product.get("availability"),
        "sourceKind": product.get("sourceKind") or "",
        "options": product.get("options") or [],
        "highlights": (product.get("highlights") or [])[:3],
    }

def main():
    data = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    gifts = json.loads(GIFTS.read_text(encoding="utf-8"))
    merged = []
    for original in data.get("products", []):
        product = dict(original)
        override = (gifts.get("products") or {}).get(str(product.get("id") or ""))
        if override and product.get("sourceKind") == "clover-import":
            product.update(override)
        merged.append(product)

    chosen = {}
    for category in CATEGORIES:
        candidates = [
            p for p in merged
            if p.get("category") == category
            and p.get("availability") != "inactive"
            and not re.search(r"단종|접수불가|접수중지", str(p.get("name") or ""))
            and metrics(p)
        ]
        groups = [
            sorted(candidates, key=score, reverse=True)[:6],
            sorted(candidates, key=lambda p: metrics(p)[0])[:5],
            sorted(candidates, key=lambda p: metrics(p)[1], reverse=True)[:5],
        ]
        for pref in PREFS:
            groups.append(sorted(
                [p for p in candidates if pref.search(str(p.get("brand") or ""))],
                key=score, reverse=True
            )[:2])
        for group in groups:
            for product in group:
                chosen[str(product.get("id"))] = product

    output = {
        "generatedAt": gifts.get("generatedAt") or data.get("updatedAt") or "",
        "categories": CATEGORIES,
        "products": [slim(p) for p in chosen.values()],
    }
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
