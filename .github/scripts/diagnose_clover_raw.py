#!/usr/bin/env python3
import json,time
from pathlib import Path
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup

URLS=[
("clv-8081","https://m.clvrental777.com/model/compare.php?model_idx=8081&ca_id=010"),
("clv-58159","https://m.clvrental777.com/model/compare.php?model_idx=58159&ca_id=043"),
("clv-36320","https://m.clvrental777.com/model/compare.php?model_idx=36320&ca_id=043"),
]
HDR={"User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1","Accept-Language":"ko-KR,ko;q=0.9"}
out=[]
for pid,url in URLS:
    try:
        with urlopen(Request(url,headers=HDR),timeout=20) as r:
            raw=r.read().decode("utf-8","ignore")
        soup=BeautifulSoup(raw,"html.parser")
        text="\n".join(x.strip() for x in soup.stripped_strings if x.strip())
        out.append({"id":pid,"len":len(raw),"text":text[:20000]})
    except Exception as e:
        out.append({"id":pid,"error":repr(e)})
    time.sleep(1.5)
Path("rental/data/clover-raw-diagnostic.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
