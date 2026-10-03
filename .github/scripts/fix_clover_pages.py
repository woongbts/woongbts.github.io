#!/usr/bin/env python3
import json
from pathlib import Path
p=Path("rental/data/products.json")
data=json.loads(p.read_text(encoding="utf-8"))
for item in data.get("products",[]):
    if item.get("sourceKind")=="clover-import":
        item["page"]=item.get("sourceUrl") or item.get("page")
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
