#!/usr/bin/env python3
import json,re,ssl
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request,urlopen

URL="https://woongbi.vip-rental.com/module/vshop/tpl/basic/js/vshop3.js"
OUT=Path(".github/tmp/clover-probe.json")
UA="Mozilla/5.0 (compatible; WoongbiRentalProbe/1.0)"

def fetch(url):
    req=Request(url,headers={"User-Agent":UA,"Accept-Language":"ko-KR,ko;q=0.9"})
    ctx=ssl._create_unverified_context() if urlparse(url).netloc=="woongbi.vip-rental.com" else None
    with urlopen(req,timeout=15,context=ctx) as r:
        return r.read().decode(r.headers.get_content_charset() or "utf-8","replace")

js=fetch(URL)
snips=[]
for pat in ["load_board.php","axios.get","getDatas","pageNum","categ =","categ2","m_id","plink"]:
    start=0; found=0
    while True:
        i=js.find(pat,start)
        if i<0 or found>=12: break
        snips.append({"pattern":pat,"text":js[max(0,i-800):min(len(js),i+1500)]})
        start=i+len(pat); found+=1
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps({"url":URL,"length":len(js),"snippets":snips},ensure_ascii=False,indent=2),encoding="utf-8")
