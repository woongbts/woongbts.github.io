#!/usr/bin/env python3
import json,re,time
from pathlib import Path
from urllib.parse import urljoin,urlparse,parse_qs
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/"rental/data/products.json"
REPORT=ROOT/"rental/data/clover-import-report.json"
BASE="https://m.clvrental777.com/"
CATS={
"075":"냉난방기","008":"TV·디지털","009":"세탁·건조·의류관리",
"004":"냉장고·김치냉장고","010":"레저·자동차","006":"주방가전",
"080":"정수기","001":"생활가전","002":"계절·환경","043":"에어컨·청소기",
"005":"건강·뷰티","003":"가구·침대","042":"업소용"}
UA={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9"}

def get(url):
    try:
        with urlopen(Request(url,headers=UA),timeout=15) as r:
            return r.read().decode("utf-8","ignore")
    except Exception:
        return ""

def clean(s): return re.sub(r"\s+"," ",str(s or "")).strip()
def nmodel(s): return re.sub(r"[^A-Z0-9가-힣]","",str(s or "").upper())
def nname(s): return re.sub(r"[^A-Z0-9가-힣]","",str(s or "").upper())

def after(strings,label):
    for i,s in enumerate(strings):
        if clean(s)==label:
            for v in strings[i+1:i+5]:
                v=clean(v)
                if v and v!=label:return v
    return ""

def category(top,item,name):
    t=f"{item} {name}"
    if re.search(r"비데|연수기",t):return "비데·연수기"
    if "정수기" in t:return "정수기"
    if re.search(r"공기청정|공기살균|제습|가습|환기|서큘",t):return "공기청정기"
    if "안마의자" in t:return "안마의자"
    if re.search(r"매트리스|침대프레임|모션베드",t):return "매트리스·프레임"
    if top in ("냉난방기","에어컨·청소기"):return "에어컨·청소기"
    return top

def parse_product(url,top):
    raw=get(url)
    if not raw:return None,"fetch"
    soup=BeautifulSoup(raw,"html.parser")
    ss=[clean(x) for x in soup.stripped_strings if clean(x)]
    text=" ".join(ss)
    title=""
    for h in soup.find_all(["h1","h2"]):
        x=clean(h.get_text(" ",strip=True))
        if x and "[" in x and len(x)>5:
            title=x;break
    if not title and soup.title:
        title=clean(soup.title.get_text(" ",strip=True)).split("|")[0].strip()
    brand=after(ss,"브랜드")
    model=after(ss,"모델명")
    item=after(ss,"품목") or top
    if not title:return None,"name"
    if not brand:
        m=re.match(r"^\[([^\]]+)\]",title)
        brand=m.group(1) if m else "기타"
    pairs={}
    for term,price in re.findall(r"(\d{1,3})개월\s*월\s*([\d,]+)원",text):
        t=int(term);p=int(price.replace(",",""))
        if 6<=t<=120 and 1000<=p<=5000000:
            pairs[t]=min(p,pairs.get(t,p))
    if not pairs:return None,"price"
    card=None
    m=re.search(r"카드할인시\s*([\d,]+)원",text)
    if m:
        try:card=int(m.group(1).replace(",",""))
        except:pass
    q=parse_qs(urlparse(url).query)
    mid=(q.get("model_idx") or [""])[0]
    cat=category(top,item,title)
    opts=[]
    for t,p in sorted(pairs.items()):
        opts.append({"key":f"clover-{t}","management":"clover-lowest",
        "managementLabel":"최저가 기준","term":t,"monthly":p,
        "card":card if card is not None and card<p else None,
        "gift":None,"care":"상품별 조건 상담 확인","sourceOption":"클로바렌탈 공개 최저가"})
    product={"id":f"clv-{mid}","sourceId":mid,"brand":brand,"name":title,
    "model":model,"category":cat,"rawCategory":item,"color":"",
    "page":f"product.html?id=clv-{mid}","image":"","sourceUrl":url,
    "tags":[x for x in [cat,item,brand] if x][:5],
    "promo":"클로바렌탈 공개 상품 기준 · 최종 접수 전 최신 조건 확인",
    "shortDescription":f"{brand} {item} 렌탈 상품입니다. 계약기간별 월 렌탈료를 확인해 보세요.",
    "highlights":[item,"계약기간별 월요금","최종 조건 상담 확인"],
    "manufacturer":brand,"rentalCompany":"클로바렌탈몰","detailImages":[],
    "options":opts,"sourceKind":"clover-import","availability":"active",
    "giftStatus":"unavailable","importedFrom":BASE}
    return product,None

def main():
    data=json.loads(DATA.read_text(encoding="utf-8"))
    original=[p for p in data.get("products",[]) if p.get("sourceKind")!="clover-import"]
    old_imported=[p for p in data.get("products",[]) if p.get("sourceKind")=="clover-import"]
    em={nmodel(p.get("model")) for p in original if nmodel(p.get("model"))}
    en={nname((p.get("brand") or "")+" "+(p.get("name") or "")) for p in original}
    candidates={}
    for ca,top in CATS.items():
        url=f"{BASE}model/list.php?ca_id={ca}"
        raw=get(url)
        if not raw:continue
        soup=BeautifulSoup(raw,"html.parser")
        for a in soup.find_all("a",href=True):
            href=urljoin(url,a["href"])
            if "/model/compare.php" not in href or "model_idx=" not in href:continue
            mid=(parse_qs(urlparse(href).query).get("model_idx") or [""])[0]
            if mid:candidates[mid]=(href,top)
        time.sleep(.15)
    parsed=[];errors=[]
    for i,(mid,(url,top)) in enumerate(candidates.items(),1):
        p,e=parse_product(url,top)
        if p:parsed.append(p)
        else:errors.append({"id":mid,"url":url,"reason":e})
        if i%20==0:print("parsed",i,"/",len(candidates),flush=True)
        time.sleep(.08)
    added=[];dups=[];seen_m=set();seen_n=set()
    for p in parsed:
        mk=nmodel(p.get("model"));nk=nname((p.get("brand") or "")+" "+(p.get("name") or ""))
        if (mk and mk in em) or nk in en:
            dups.append({"model":p.get("model"),"name":p.get("name")});continue
        if (mk and mk in seen_m) or nk in seen_n:continue
        if mk:seen_m.add(mk)
        seen_n.add(nk);added.append(p)
    data["products"]=original+added
    data["updatedAt"]="2026-10-03"
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    by={}
    for p in added:by[p["category"]]=by.get(p["category"],0)+1
    report={"generatedAt":"2026-10-03","existingOriginalPreserved":len(original),
    "previousImportedRebuilt":len(old_imported),"productCandidates":len(candidates),
    "parsedProducts":len(parsed),"duplicatesSkipped":len(dups),
    "newProductsAdded":len(added),"totalProductsAfterImport":len(original)+len(added),
    "newByCategory":dict(sorted(by.items())),"parseErrors":len(errors),
    "duplicateExamples":dups[:20],"errorExamples":errors[:20]}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":main()
