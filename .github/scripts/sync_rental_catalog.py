#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import math
import re
import ssl
import time
import unicodedata
from pathlib import Path
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

BASE = "https://woongbi.vip-rental.com"
UA = "Mozilla/5.0 (compatible; WoongbiRentalCatalogSync/2.0)"
OUT = Path("rental/data/products.json")
PAGE_SIZE = 24

ROOTS = {
    1057: "SK매직",
    1058: "LG퓨리케어",
    1059: "COWAY",
    1060: "청호나이스",
    1061: "현대큐밍",
    1068: "CUCKOO",
    1069: "루헨스",
    1226: "유버스",
}

CATEGORY_MAP = {
    "정수기": "정수기",
    "정수기/제빙기": "정수기",
    "공기청정기": "공기청정기",
    "공기청정기/제습기": "공기청정기",
    "비데": "비데·연수기",
    "비데/연수기": "비데·연수기",
    "연수기": "비데·연수기",
    "주방가전": "주방가전",
    "생활가전": "생활가전",
    "생활가전/펫드라이룸": "생활가전",
    "냉장고/김치냉장고": "냉장고·김치냉장고",
    "스타일러/세탁·건조": "세탁·건조·의류관리",
    "에어컨/청소기": "에어컨·청소기",
    "안마의자": "안마의자",
    "매트리스/프레임": "매트리스·프레임",
}

ctx = ssl._create_unverified_context()


def get_json(categ: int, page: int = 1, categ2: int = 0, mid: str = "") -> dict:
    q = urlencode({
        "page": page,
        "categ": categ,
        "categ2": categ2,
        "orderby": "item_attr-desc",
        "mid": mid,
    })
    req = Request(
        BASE + "/module/vshop/load_board.php?" + q,
        headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9", "Referer": BASE + "/"},
    )
    with urlopen(req, timeout=20, context=ctx) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def norm_space(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def as_int(value):
    s = re.sub(r"[^0-9.-]", "", str(value or ""))
    try:
        return int(float(s))
    except Exception:
        return None


def slug(value: str) -> str:
    s = unicodedata.normalize("NFKD", value or "")
    s = re.sub(r"[^A-Za-z0-9가-힣]+", "-", s).strip("-").lower()
    return s or "option"


def normalize_category(label: str) -> str:
    label = norm_space(label)
    return CATEGORY_MAP.get(label, label or "기타")


def clean_title(title: str) -> str:
    title = norm_space(title)
    return re.sub(r"^\[[^\]]+\]\s*", "", title).strip()


def parse_detail_images(content: str) -> list[str]:
    if not content:
        return []
    urls = []
    for raw in re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content, re.I):
        u = html.unescape(raw).strip()
        if not u or u.startswith("data:"):
            continue
        if u.startswith("//"):
            u = "https:" + u
        elif u.startswith("/"):
            u = BASE + u
        if u not in urls:
            urls.append(u)
        if len(urls) >= 24:
            break
    return urls


def thumbnail_url(server_url: str, home_id: str, filename: str) -> str | None:
    filename = norm_space(filename)
    if not filename:
        return None
    server_url = server_url or "/module/vshop/imagefile.php?wsize=970&r=2&img="
    path = f"{home_id}/{filename}" if home_id else filename
    return BASE + server_url + quote(path, safe="/")


def extract_term(text: str):
    text = norm_space(text)
    nums = [int(x) for x in re.findall(r"(?<!\d)(36|48|60|72|84|24)(?!\d)", text)]
    return nums[-1] if nums else None


def management_info(text: str):
    raw = norm_space(text)
    base = re.sub(r"\)?\s*(36|48|60|72|84|24)\s*$", "", raw).strip(" ()_")
    base = base.replace("_", " · ")
    if "셀프" in raw or "자가" in raw:
        key = "self-" + slug(base)
        label = base or "셀프관리"
    elif "방문" in raw:
        key = "visit-" + slug(base)
        label = base or "방문관리"
    else:
        key = "standard-" + slug(base or "기본")
        label = base or "기본 조건"
    return key, label


def make_options(item: dict) -> list[dict]:
    option1 = item.get("option1") or []
    result = []
    seen = set()
    if isinstance(option1, list):
        for idx, opt in enumerate(option1):
            if isinstance(opt, dict):
                text = norm_space(opt.get("text"))
                monthly = as_int(opt.get("value"))
            else:
                text = norm_space(opt)
                monthly = None
            if monthly is None:
                continue
            term = extract_term(text)
            key, label = management_info(text)
            sig = (key, term, monthly)
            if sig in seen:
                continue
            seen.add(sig)
            result.append({
                "key": f"{key}-{term or idx+1}",
                "management": key,
                "managementLabel": label,
                "term": term or 0,
                "monthly": monthly,
                "card": None,
                "gift": None,
                "care": label,
                "sourceOption": text,
            })
    if not result:
        monthly = as_int(item.get("item_price"))
        if monthly is not None:
            result.append({
                "key": "standard-base",
                "management": "standard",
                "managementLabel": "기본 조건",
                "term": 0,
                "monthly": monthly,
                "card": None,
                "gift": None,
                "care": "상세 조건 상담 확인",
                "sourceOption": "",
            })
    return result


def keyword_tags(title: str, category: str, option_labels: list[str]) -> list[str]:
    pool = title + " " + category + " " + " ".join(option_labels)
    candidates = [
        "얼음", "냉온", "직수", "냉수", "온수", "커피", "미니", "무전원",
        "펫", "제습", "공기청정", "비데", "연수", "안마", "매트리스",
        "냉장고", "김치냉장고", "식기세척", "에어컨", "청소기", "건조",
        "스타일러", "자가관리", "셀프", "방문관리"
    ]
    out = [category]
    for k in candidates:
        if k in pool and k not in out:
            out.append(k)
        if len(out) >= 5:
            break
    return out


def generic_highlights(title: str, category: str, options: list[dict]) -> list[str]:
    out = []
    terms = sorted({o.get("term") for o in options if o.get("term")})
    labels = []
    for o in options:
        label = o.get("managementLabel")
        if label and label not in labels:
            labels.append(label)
    if labels:
        out.append(" / ".join(labels[:2]))
    if terms:
        out.append(" / ".join(f"{t}개월" for t in terms[:4]))
    for key in ["얼음", "냉온", "직수", "커피", "무전원", "제습", "펫", "안마", "매트리스", "식기세척", "건조", "에어컨"]:
        if key in title and key not in out:
            out.append(key + " 기능")
        if len(out) >= 4:
            break
    if len(out) < 2:
        out.append("조건별 월 렌탈료 확인")
    return out[:4]


def model_key(model: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (model or "").upper())


def scrape() -> tuple[list[dict], dict]:
    products = []
    stats = {}
    seen_ids = set()

    for root, brand in ROOTS.items():
        first = get_json(root, 1)
        if str(first.get("ResultCode")) != "100":
            stats[brand] = {"error": first.get("ResultMessage")}
            continue
        total = int(first.get("total") or 0)
        listnum = int(first.get("listnum") or PAGE_SIZE)
        submenus = first.get("submenu") or []
        submap = {str(x.get("id")): normalize_category(x.get("label")) for x in submenus if isinstance(x, dict)}
        pages = max(1, math.ceil(total / max(1, listnum)))
        rows = []

        for page in range(1, pages + 1):
            data = first if page == 1 else get_json(root, page)
            rows.extend(data.get("list") or [])
            if page < pages:
                time.sleep(0.08)

        added = 0
        server_url = first.get("ServerUrl") or ""
        home_id = first.get("home_id") or "rental"
        for item in rows:
            pid = str(item.get("id") or "")
            if not pid or pid in seen_ids:
                continue
            seen_ids.add(pid)
            title = clean_title(item.get("title"))
            model = norm_space(item.get("item_name"))
            category = submap.get(str(item.get("cate_id2")), "기타")
            options = make_options(item)
            if not title or not options:
                continue
            option2 = item.get("option2") or []
            colors = " / ".join(norm_space(x) for x in option2 if norm_space(x)) if isinstance(option2, list) else ""
            detail_images = parse_detail_images(item.get("content") or "")
            image = thumbnail_url(server_url, home_id, item.get("thum_pic"))
            labels = [o["managementLabel"] for o in options]
            tags = keyword_tags(title, category, labels)
            highlights = generic_highlights(title, category, options)
            products.append({
                "id": "clover-" + pid,
                "sourceId": pid,
                "brand": brand,
                "name": title,
                "model": model or f"상품번호 {pid}",
                "category": category,
                "rawCategory": norm_space(next((x.get("label") for x in submenus if str(x.get("id")) == str(item.get("cate_id2"))), "")),
                "color": colors,
                "page": "product.html?id=clover-" + pid,
                "image": image,
                "sourceUrl": f"{BASE}/categ/{root}/{pid}",
                "tags": tags,
                "promo": "기존 웅비렌탈 공개 상품 조건 기준",
                "shortDescription": f"{brand} {category} · 조건별 월 렌탈료를 확인하세요.",
                "highlights": highlights,
                "manufacturer": norm_space(item.get("item_made")),
                "rentalCompany": norm_space(item.get("item_field1")),
                "detailImages": detail_images,
                "options": options,
                "sourceKind": "clover-public",
            })
            added += 1
        stats[brand] = {"sourceTotal": total, "imported": added, "pages": pages}

    return products, stats


def merge_curated(imported: list[dict], current: dict) -> list[dict]:
    current_products = current.get("products") or []
    curated_by_model = {
        model_key(p.get("model")): p
        for p in current_products
        if p.get("model") and not str(p.get("id", "")).startswith("clover-")
    }
    out = []
    used_models = set()
    for p in imported:
        mk = model_key(p.get("model"))
        curated = curated_by_model.get(mk)
        if curated:
            merged = dict(p)
            # Curated content wins where we intentionally added verified prices/gifts or dedicated landing pages.
            for key in ["id", "page", "options", "promo", "shortDescription", "highlights", "tags", "color"]:
                if curated.get(key) not in (None, "", [], {}):
                    merged[key] = curated[key]
            if curated.get("image"):
                merged["image"] = curated["image"]
            merged["detailImages"] = p.get("detailImages") or curated.get("detailImages") or []
            merged["sourceId"] = p.get("sourceId")
            merged["sourceUrl"] = p.get("sourceUrl")
            out.append(merged)
            used_models.add(mk)
        else:
            out.append(p)

    # Keep curated products that are temporarily absent from the source catalog.
    for p in current_products:
        mk = model_key(p.get("model"))
        if not str(p.get("id", "")).startswith("clover-") and mk not in used_models:
            out.append(p)
    return out


def main():
    current = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"products": []}
    imported, stats = scrape()
    products = merge_curated(imported, current)
    payload = {
        "updatedAt": "2026-10-02",
        "policyMonth": current.get("policyMonth", "2026-10"),
        "policyStatus": current.get("policyStatus", "synced"),
        "policySourceLabel": current.get("policySourceLabel", "2026년 10월 렌탈 정책"),
        "catalogSource": "woongbi.vip-rental.com public catalog",
        "catalogStats": stats,
        "products": products,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"products": len(products), "stats": stats}, ensure_ascii=False))


if __name__ == "__main__":
    main()
