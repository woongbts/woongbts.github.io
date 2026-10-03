#!/usr/bin/env python3
import json,re,time
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[2]
PRODUCTS=ROOT/"rental/data/products.json"
OUT=ROOT/"rental/data/clover-offers.json"
HDR={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9"}

def fetch(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers=HDR),timeout=18) as r:
                return r.read().decode("utf-8","ignore")
        except Exception:
            time.sleep(.5*(attempt+1))
    return ""

def extract(item):
    url=item.get("sourceUrl") or ""
    if not url:return item.get("id"),{"ok":False,"reason":"no-source-url"}
    raw=fetch(url)
    if not raw:return item.get("id"),{"ok":False,"reason":"fetch-failed","url":url}
    m=re.search(r"goodsData\s*=\s*(\{.*?\})\s*;\s*goodsThumb\s*=",raw,re.S)
    if not m:
        return item.get("id"),{"ok":False,"reason":"goodsData-not-found","url":url}
    try:
        goods=json.loads(m.group(1))
    except Exception as e:
        return item.get("id"),{"ok":False,"reason":"json:"+str(e)[:140],"url":url}
    offers=[]
    for index_no,g in goods.items():
        company=(g.get("companyName") or "").strip()
        if not company:continue
        for opt in g.get("options") or []:
            try:
                term=int(str(opt.get("io_contract_months") or "").strip())
                monthly=int(str(opt.get("io_price") or "").replace(",","").strip())
            except Exception:
                continue
            if term<=0 or monthly<=0:continue
            offers.append({
                "indexNo":str(index_no),
                "companyName":company,
                "sellerCode":str(g.get("mb_id") or ""),
                "term":term,
                "monthly":monthly
            })
    # exact duplicate rows can exist in markup; dedupe while preserving order
    seen=set();unique=[]
    for o in offers:
        k=(o["companyName"],o["term"],o["monthly"])
        if k in seen:continue
        seen.add(k);unique.append(o)
    return item.get("id"),{"ok":bool(unique),"url":url,"offers":unique,"reason":"" if unique else "no-offers"}

def main():
    data=json.loads(PRODUCTS.read_text(encoding="utf-8"))
    items=[p for p in data.get("products",[]) if p.get("sourceKind")=="clover-import"]
    previous={}
    if OUT.exists():
        try:
            previous=json.loads(OUT.read_text(encoding="utf-8")).get("items",{})
        except Exception:
            previous={}
    results={k:v for k,v in previous.items() if isinstance(v,dict) and v.get("ok")}
    pending=[p for p in items if not results.get(p.get("id"),{}).get("ok")]
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs={ex.submit(extract,p):p for p in pending}
        done=0
        for fut in as_completed(futs):
            pid,res=fut.result()
            if res.get("ok") or pid not in results:
                results[pid]=res
            done+=1
            if done%25==0:print("done",done,"/",len(pending),flush=True)
    ok=sum(1 for v in results.values() if v.get("ok"))
    offers=sum(len(v.get("offers") or []) for v in results.values() if v.get("ok"))
    out={
        "generatedAt":"2026-10-03",
        "source":"m.clvrental777.com public comparison pages",
        "importedProducts":len(items),
        "productsWithOffers":ok,
        "offerRows":offers,
        "items":results
    }
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in out.items() if k!="items"},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
