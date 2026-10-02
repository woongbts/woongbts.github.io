#!/usr/bin/env python3
import json,re,ssl,time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen

BASE="https://woongbi.vip-rental.com"
OUT=Path(".github/tmp/clover-probe.json")
UA="Mozilla/5.0 (compatible; WoongbiRentalProbe/1.0)"
CTX=ssl._create_unverified_context()

def fetch(url):
    req=Request(url,headers={"User-Agent":UA,"Referer":BASE+"/","Accept-Language":"ko-KR,ko;q=0.9"})
    with urlopen(req,timeout=15,context=CTX) as r:
        return r.read().decode("utf-8","replace")

def load(categ,categ2=0,page=1,mid=""):
    q=urlencode({"page":page,"categ":categ,"categ2":categ2,"orderby":"item_attr-desc","mid":mid})
    return json.loads(fetch(BASE+"/module/vshop/load_board.php?"+q))

home=fetch(BASE+"/")
ids=sorted({int(x) for x in re.findall(r'/categ/(\d+)',home)})
cats=[]
for cid in ids:
    try:
        d=load(cid,0,1,"")
        lst=d.get("list") or []
        submenu=d.get("submenu") or []
        cats.append({
            "id":cid,
            "total":int(d.get("total") or 0),
            "listnum":int(d.get("listnum") or 0),
            "submenu":submenu,
            "sample":[{k:item.get(k) for k in ["id","title","item_name","item_made","cate_id1","cate_id2","item_price","thum_pic"]} for item in lst[:4]]
        })
    except Exception as e:
        cats.append({"id":cid,"error":str(e)})
    time.sleep(.08)
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps({"category_ids":ids,"categories":cats},ensure_ascii=False,indent=2),encoding="utf-8")
