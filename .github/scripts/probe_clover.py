#!/usr/bin/env python3
import json,ssl
from pathlib import Path
from urllib.parse import urlencode,urlparse
from urllib.request import Request,urlopen

BASE="https://woongbi.vip-rental.com"
OUT=Path(".github/tmp/clover-probe.json")
UA="Mozilla/5.0 (compatible; WoongbiRentalProbe/1.0)"

def fetch_json(url):
    req=Request(url,headers={"User-Agent":UA,"Accept-Language":"ko-KR,ko;q=0.9","Referer":BASE+"/"})
    ctx=ssl._create_unverified_context()
    with urlopen(req,timeout=15,context=ctx) as r:
        return json.loads(r.read().decode("utf-8","replace"))

def load(categ,categ2=0,page=1,mid=""):
    q=urlencode({"page":page,"categ":categ,"categ2":categ2,"orderby":"item_attr-desc","mid":mid})
    return fetch_json(BASE+"/module/vshop/load_board.php?"+q)

samples={}
for cid in [1057,1058,1059,1060,1061,1062,1063,1064,1065,1066,1068,1069,1070,1071,1073,1074,1075,1076,1077,1078,1079,1080,1081,1082,1083,1084,1086,1087,1088,1090,1091,1092,1093,1094,1095,1096,1100,1115,1118,1120,1121,1123,1172,1208,1226,1227,1228,1229,1230,1237,1245,1246]:
    try:
        d=load(cid)
        samples[str(cid)]={
          "ResultCode":d.get("ResultCode"),
          "total":d.get("total"),
          "listnum":d.get("listnum"),
          "submenu":d.get("submenu"),
          "list_sample":(d.get("list") or [])[:2],
          "keys":sorted(d.keys())
        }
    except Exception as e:
        samples[str(cid)]={"error":str(e)}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(samples,ensure_ascii=False,indent=2),encoding="utf-8")
