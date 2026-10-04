#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
PRODUCTS=ROOT/"rental/data/products.json"
GIFTS=ROOT/"rental/data/appliance-gift-options.json"
OUT=ROOT/"rental/data/catalog-verification.json"

def load(path,default):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except Exception:return default

def sellable(o):
    text=" ".join(str(o.get(k) or "") for k in ("managementLabel","sourceOption","care"))
    try:m=int(o.get("monthly"))
    except Exception:return False
    return m>0 and not re.search(r"(?:^|\s)단종/",text)

def main():
    pdata=load(PRODUCTS,{"products":[]})
    gdata=load(GIFTS,{})
    checked=str(gdata.get("generatedAt") or pdata.get("updatedAt") or "")[:10]
    items=[]
    counts={"managed":0,"reference":0,"review":0}
    for p in pdata.get("products",[]):
        if p.get("availability")=="inactive" or re.search(r"접수불가|접수중지|단종",str(p.get("name") or "")):continue
        pid=str(p.get("id") or "")
        if not pid:continue
        reasons=[]
        status="reference" if p.get("sourceKind")=="clover-import" else "managed"
        options=[o for o in (p.get("options") or []) if sellable(o)]
        image=bool(str(p.get("image") or "").strip() or (p.get("detailImages") or []))
        if not options:reasons.append("판매가능 옵션 없음")
        if not image:reasons.append("대표/상세 이미지 없음")
        if not str(p.get("model") or "").strip():reasons.append("모델명 확인 필요")
        if reasons:status="review"
        counts[status]+=1
        items.append({
            "id":pid,
            "name":str(p.get("name") or pid),
            "category":str(p.get("category") or ""),
            "status":status,
            "checkedAt":checked,
            "reason":" · ".join(reasons) if reasons else ("외부 공개자료를 웅비렌탈 형식으로 재정리" if status=="reference" else "웅비렌탈 관리 데이터")
        })
    payload={
        "schema":1,
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "checkedAt":checked,
        "summary":counts,
        "items":items
    }
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("catalog verification:",counts)

if __name__=="__main__":main()
