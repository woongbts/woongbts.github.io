#!/usr/bin/env python3
import json, re, time
from pathlib import Path
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
PRODUCTS=ROOT/"rental/data/products.json"
OUT=ROOT/"rental/data/clover-offers-public.json"
HDR={
  "User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept-Language":"ko-KR,ko;q=0.9"
}

def fetch_text(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers=HDR),timeout=22) as r:
                raw=r.read().decode("utf-8","ignore")
            soup=BeautifulSoup(raw,"html.parser")
            return "\n".join(x.strip() for x in soup.stripped_strings if x.strip())
        except Exception:
            time.sleep(0.9*(attempt+1))
    return ""

def parse_offers(text):
    if not text or "렌탈사별 가격 비교" not in text:
        return []
    section=text.split("렌탈사별 가격 비교",1)[1]
    for stop in ["상품 상세정보","제휴카드 할인\nclose","렌탈신청\n원하는"]:
        if stop in section:
            section=section.split(stop,1)[0]
    rows=[]
    pattern=re.compile(r"(?m)^([^\n]+)\n((?:\d{2,3}개월\n월\n[\d,]+\n원\n?)+)")
    for m in pattern.finditer(section):
        company=m.group(1).strip()
        if not company or company in {"자세히 보기","빠른설치","특가 프로모션","3일이내 설치","다이렉트","접기","펼치기","최저가"}:
            continue
        offers=[]
        for term,price in re.findall(r"(\d{2,3})개월\n월\n([\d,]+)\n원",m.group(2)):
            t=int(term); p=int(price.replace(",",""))
            if 12<=t<=120 and 1000<=p<=5000000:
                offers.append({"term":t,"monthly":p})
        if offers:
            rows.append({"rentalCompany":company,"offers":offers})
    # de-duplicate company + offer combinations
    out=[]; seen=set()
    for row in rows:
        key=(row["rentalCompany"],tuple((o["term"],o["monthly"]) for o in row["offers"]))
        if key in seen: continue
        seen.add(key); out.append(row)
    return out

data=json.loads(PRODUCTS.read_text(encoding="utf-8"))
products=[p for p in data.get("products",[]) if p.get("sourceKind")=="clover-import" and p.get("sourceUrl")]
results=[]
for i,p in enumerate(products,1):
    text=fetch_text(p["sourceUrl"])
    parsed=parse_offers(text)
    results.append({
      "id":p["id"],"sourceUrl":p["sourceUrl"],"name":p.get("name"),
      "rentalCompanies":parsed
    })
    if i%20==0:
        print(f"scraped {i}/{len(products)}",flush=True)
    time.sleep(0.18)

results.sort(key=lambda x:x["id"])
summary={
  "productsRequested":len(products),
  "productsWithOffers":sum(1 for r in results if r["rentalCompanies"]),
  "productsWithoutOffers":sum(1 for r in results if not r["rentalCompanies"]),
  "totalCompanyBlocks":sum(len(r["rentalCompanies"]) for r in results),
  "companyLabels":sorted({c["rentalCompany"] for r in results for c in r["rentalCompanies"]})
}
OUT.write_text(json.dumps({"summary":summary,"products":results},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(summary,ensure_ascii=False,indent=2))
