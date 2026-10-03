#!/usr/bin/env python3
import json,re,time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin,urlparse,parse_qs
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/"rental/data/products.json"
REPORT=ROOT/"rental/data/clover-import-report.json"
BASE="https://m.clvrental777.com/"
CATS={"075":"냉난방기","008":"TV·디지털","009":"세탁·건조·의류관리","004":"냉장고·김치냉장고","010":"레저·자동차","006":"주방가전","080":"정수기","001":"생활가전","002":"계절·환경","043":"에어컨·청소기","005":"건강·뷰티","003":"가구·침대","042":"업소용"}
HDR={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9"}

def get(url):
    try:
        with urlopen(Request(url,headers=HDR),timeout=18) as r:return r.read().decode("utf-8","ignore")
    except:return ""

def clean(v):return re.sub(r"\s+"," ",str(v or "")).strip()
def nm(v):return re.sub(r"[^A-Z0-9가-힣]","",str(v or "").upper())
def nn(v):return re.sub(r"[^A-Z0-9가-힣]","",str(v or "").upper())

def catmap(top,name):
    if re.search(r"비데|연수기",name):return "비데·연수기"
    if "정수기" in name:return "정수기"
    if re.search(r"공기청정|공기살균|제습|가습|환기|서큘",name):return "공기청정기"
    if "안마의자" in name:return "안마의자"
    if re.search(r"매트리스|침대프레임|모션베드",name):return "매트리스·프레임"
    if top in ("냉난방기","에어컨·청소기"):return "에어컨·청소기"
    return top

def parse_anchor(a,top,page_url):
    href=urljoin(page_url,a.get("href",""))
    q=parse_qs(urlparse(href).query);mid=(q.get("model_idx") or [""])[0]
    text=clean(a.get_text(" ",strip=True))
    if not mid or not text:return None
    box=a;boxtext=text
    for _ in range(8):
        if not getattr(box,"parent",None):break
        box=box.parent;boxtext=clean(box.get_text(" ",strip=True))
        if "월 렌탈료" in boxtext and len(boxtext)<2200:break
    mprice=re.search(r"월\s*렌탈료\s*([\d,]+)\s*원",boxtext)
    if not mprice:return None
    monthly=int(mprice.group(1).replace(",",""))
    mcard=re.search(r"카드할인시\s*([\d,]+)\s*원",boxtext)
    card=int(mcard.group(1).replace(",","")) if mcard else None
    model=""
    mm=re.match(r"^([^\s\[]+)\s+(?=\[)",text)
    if mm:model=mm.group(1)
    brand="기타";name=text
    mb=re.search(r"\[([^\]]+)\]\s*(.*)",text)
    if mb:brand=mb.group(1).strip();name=mb.group(2).strip() or text
    category=catmap(top,name)
    img=""
    im=box.find("img") if hasattr(box,"find") else None
    if im:
        src=im.get("src") or im.get("data-src") or im.get("data-original")
        if src:img=urljoin(page_url,src)
    return {"id":f"clv-{mid}","sourceId":mid,"brand":brand,"name":name,"model":model,
      "category":category,"rawCategory":top,"color":"","page":href,
      "image":img,"sourceUrl":href,"tags":[category,top,brand],
      "promo":"클로바렌탈 공개 상품 기준 · 최종 접수 전 최신 조건 확인",
      "shortDescription":f"{brand} {top} 렌탈 상품입니다. 공개된 최저 월 렌탈료를 먼저 확인해 보세요.",
      "highlights":[top,"최저 월 렌탈료 기준","최종 조건 상담 확인"],
      "manufacturer":brand,"rentalCompany":"클로바렌탈몰","detailImages":[],
      "options":[{"key":"clover-min","management":"clover-lowest","managementLabel":"최저가 기준",
        "term":"","termLabel":"상품별 조건","monthly":monthly,
        "card":card if card is not None and card<monthly else None,"gift":None,
        "care":"상품별 조건 상담 확인","sourceOption":"클로바렌탈 공개 최저가"}],
      "sourceKind":"clover-import","availability":"active","giftStatus":"unavailable",
      "imageSourceOriginal":img,"importedFrom":BASE}

def main():
    data=json.loads(DATA.read_text(encoding="utf-8"))
    original=[p for p in data.get("products",[]) if p.get("sourceKind")!="clover-import"]
    prior=[p for p in data.get("products",[]) if p.get("sourceKind")=="clover-import"]
    em={nm(p.get("model")) for p in original if nm(p.get("model"))}
    en={nn((p.get("brand") or "")+" "+(p.get("name") or "")) for p in original}
    found=[];seen_pages=set()
    queue=deque((root,f"{BASE}model/list.php?ca_id={root}",top) for root,top in CATS.items())
    while queue and len(seen_pages)<260:
        root,url,top=queue.popleft()
        if url in seen_pages:continue
        seen_pages.add(url);raw=get(url)
        if not raw:continue
        soup=BeautifulSoup(raw,"html.parser")
        for a in soup.find_all("a",href=True):
            href=urljoin(url,a["href"])
            if "/model/compare.php" in href and "model_idx=" in href:
                p=parse_anchor(a,top,url)
                if p:found.append(p)
            elif "/model/list.php" in href and "ca_id=" in href:
                cid=(parse_qs(urlparse(href).query).get("ca_id") or [""])[0]
                if cid and cid!=root and cid.startswith(root):
                    clean_url=f"{BASE}model/list.php?ca_id={cid}"
                    if clean_url not in seen_pages:queue.append((root,clean_url,top))
        time.sleep(.08)
    unique={};dups=[]
    for p in found:
        mk=nm(p.get("model"));nk=nn((p.get("brand") or "")+" "+(p.get("name") or ""))
        if (mk and mk in em) or nk in en:
            dups.append({"model":p.get("model"),"name":p.get("name")});continue
        key=mk or nk or p["id"];unique.setdefault(key,p)
    added=list(unique.values())
    data["products"]=original+added;data["updatedAt"]="2026-10-03"
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    by={}
    for p in added:by[p["category"]]=by.get(p["category"],0)+1
    report={"generatedAt":"2026-10-03","existingOriginalPreserved":len(original),
      "previousImportedRebuilt":len(prior),"listPagesScanned":len(seen_pages),
      "listProductsParsed":len(found),"duplicatesSkipped":len(dups),
      "newProductsAdded":len(added),"totalProductsAfterImport":len(original)+len(added),
      "newByCategory":dict(sorted(by.items())),"duplicateExamples":dups[:30]}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":main()
