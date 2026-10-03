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

def closest_card(a):
    node=a
    fallback=None
    for _ in range(9):
        node=getattr(node,"parent",None)
        if node is None:break
        txt=clean(node.get_text(" ",strip=True))
        if "월 렌탈료" not in txt:continue
        links=[x for x in node.find_all("a",href=True) if "/model/compare.php" in x.get("href","") and "model_idx=" in x.get("href","")]
        if fallback is None:fallback=node
        if len(links)==1:return node
    return fallback

def parse_anchor(a,top,page_url):
    href=urljoin(page_url,a.get("href",""))
    q=parse_qs(urlparse(href).query);mid=(q.get("model_idx") or [""])[0]
    raw_text=clean(a.get_text(" ",strip=True))
    if not mid or not raw_text:return None
    box=closest_card(a)
    if box is None:return None
    boxtext=clean(box.get_text(" ",strip=True))
    mprice=re.search(r"월\s*렌탈료\s*([\d,]+)\s*원",boxtext)
    if not mprice:return None
    monthly=int(mprice.group(1).replace(",",""))
    mcard=re.search(r"카드할인시\s*([\d,]+)\s*원",boxtext)
    card=int(mcard.group(1).replace(",","")) if mcard else None

    text=re.split(r"월\s*렌탈료|카드할인시",raw_text,maxsplit=1)[0].strip()
    text=re.sub(r"^(?:(?:다이렉트|방문관리|셀프관리|사은품|추천|인기|특가|NEW|신상품)\s*)+","",text).strip()
    text=re.sub(r"^\d+개월\s*무료\s*","",text).strip()
    model=""
    mm=re.match(r"^([A-Za-z0-9][A-Za-z0-9._/+()\-]{1,40})\s+(?=\[)",text)
    if mm and re.search(r"\d",mm.group(1)):
        model=mm.group(1);text=text[mm.end():].strip()
    brand="기타";name=text
    mb=re.search(r"\[([^\]]+)\]\s*(.*)",text)
    if mb:
        brand=mb.group(1).strip();name=mb.group(2).strip() or text
    name=re.sub(r"\s*(?:월\s*렌탈료|카드할인시).*","",name).strip()
    if not name:return None

    category=catmap(top,name)
    img=""
    for im in box.find_all("img"):
        src=im.get("src") or im.get("data-src") or im.get("data-original")
        if not src:continue
        full=urljoin(page_url,src)
        low=full.lower()
        if any(x in low for x in ["logo","icon","banner","sprite"]):continue
        img=full;break
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

def better(a,b):
    score=lambda p:(1 if p.get("model") else 0)+(1 if p.get("image") else 0)+(1 if len(p.get("name",""))<100 else 0)
    return a if score(a)>=score(b) else b

def main():
    data=json.loads(DATA.read_text(encoding="utf-8"))
    original=[p for p in data.get("products",[]) if p.get("sourceKind")!="clover-import"]
    prior=[p for p in data.get("products",[]) if p.get("sourceKind")=="clover-import"]
    em={nm(p.get("model")) for p in original if nm(p.get("model"))}
    en={nn((p.get("brand") or "")+" "+(p.get("name") or "")) for p in original}

    found_by_id={};seen_pages=set()
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
                if p:
                    old=found_by_id.get(p["id"])
                    found_by_id[p["id"]]=p if old is None else better(old,p)
            elif "/model/list.php" in href and "ca_id=" in href:
                cid=(parse_qs(urlparse(href).query).get("ca_id") or [""])[0]
                if cid and cid!=root and cid.startswith(root):
                    child=f"{BASE}model/list.php?ca_id={cid}"
                    if child not in seen_pages:queue.append((root,child,top))
        time.sleep(.08)

    added=[];dups=[];seen_model=set();seen_name=set()
    for p in found_by_id.values():
        mk=nm(p.get("model"));nk=nn((p.get("brand") or "")+" "+(p.get("name") or ""))
        if (mk and mk in em) or nk in en:
            dups.append({"model":p.get("model"),"name":p.get("name")});continue
        if (mk and mk in seen_model) or nk in seen_name:continue
        if mk:seen_model.add(mk)
        seen_name.add(nk);added.append(p)

    data["products"]=original+added;data["updatedAt"]="2026-10-03"
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    by={}
    for p in added:by[p["category"]]=by.get(p["category"],0)+1
    report={"generatedAt":"2026-10-03","existingOriginalPreserved":len(original),
      "previousImportedRebuilt":len(prior),"listPagesScanned":len(seen_pages),
      "uniqueSourceProducts":len(found_by_id),"duplicatesSkipped":len(dups),
      "newProductsAdded":len(added),"totalProductsAfterImport":len(original)+len(added),
      "newByCategory":dict(sorted(by.items())),"duplicateExamples":dups[:30]}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":main()
