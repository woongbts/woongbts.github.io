#!/usr/bin/env python3
import json,ssl
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen

BASE="https://woongbi.vip-rental.com"
OUT=Path(".github/tmp/clover-probe.json")
UA="Mozilla/5.0 (compatible; WoongbiRentalProbe/1.0)"

def load(categ,categ2=0,page=1,mid=""):
    q=urlencode({"page":page,"categ":categ,"categ2":categ2,"orderby":"item_attr-desc","mid":mid})
    req=Request(BASE+"/module/vshop/load_board.php?"+q,headers={"User-Agent":UA,"Referer":BASE+"/"})
    with urlopen(req,timeout=15,context=ssl._create_unverified_context()) as r:
        return json.loads(r.read().decode("utf-8","replace"))

d=load(1068,1091,1,2252)
c=d.get("cont") or {}
out={
  "top":{k:d.get(k) for k in ["ResultCode","ResultMessage","ServerUrl","home_id","total","listnum","categ"]},
  "cont":{k:c.get(k) for k in ["id","title","item_name","item_made","item_field1","item_field2","item_field3","item_price","item_oprice","item_opt1_t","item_opt2_t","item_opt3_t","item_opt4_t","option1","option2","option3","option4","thum_pic","fpic3","content","cate_id1","cate_id2","field1","field2","field3","field4"]}
}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
