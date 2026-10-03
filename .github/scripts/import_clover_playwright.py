#!/usr/bin/env python3
import asyncio,json,re,time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin,urlparse,parse_qs
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/"rental/data/products.json"
REPORT=ROOT/"rental/data/clover-import-report.json"
BASE="https://m.clvrental777.com/"
CATS={"075":"냉난방기","008":"TV·디지털","009":"세탁·건조·의류관리","004":"냉장고·김치냉장고","010":"레저·자동차","006":"주방가전","043":"에어컨·청소기","005":"건강·뷰티","003":"가구·침대","042":"업소용"}
HDR={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9"}

def get(url):
    try:
        with urlopen(Request(url,headers=HDR),timeout=18) as r:return r.read().decode("utf-8","ignore")
    except:return ""

def clean(v):return re.sub(r"\s+"," ",str(v or "")).strip()
def nm(v):return re.sub(r"[^A-Z0-9가-힣]","",str(v or "").upper())
def nn(v):return re.sub(r"[^A-Z0-9가-힣]","",str(v or "").upper())

def catmap(top,item,name):
    t=f"{item} {name}"
    if re.search(r"비데|연수기",t):return "비데·연수기"
    if "정수기" in t:return "정수기"
    if re.search(r"공기청정|공기살균|제습|가습|환기|서큘",t):return "공기청정기"
    if "안마의자" in t:return "안마의자"
    if re.search(r"매트리스|침대프레임|모션베드",t):return "매트리스·프레임"
    if top in ("냉난방기","에어컨·청소기"):return "에어컨·청소기"
    return top

def discover():
    q=deque((root,f"{BASE}model/list.php?ca_id={root}",top) for root,top in CATS.items())
    seen=set();products={}
    while q and len(seen)<240:
        root,url,top=q.popleft()
        if url in seen:continue
        seen.add(url);raw=get(url)
        if not raw:continue
        soup=BeautifulSoup(raw,"html.parser")
        for a in soup.find_all("a",href=True):
            href=urljoin(url,a["href"])
            if "/model/compare.php" in href and "model_idx=" in href:
                mid=(parse_qs(urlparse(href).query).get("model_idx") or [""])[0]
                if mid:products.setdefault(mid,(href,top))
            elif "/model/list.php" in href and "ca_id=" in href:
                cid=(parse_qs(urlparse(href).query).get("ca_id") or [""])[0]
                if cid and cid!=root and cid.startswith(root):
                    child=f"{BASE}model/list.php?ca_id={cid}"
                    if child not in seen:q.append((root,child,top))
        time.sleep(.05)
    return seen,products

def after(lines,label):
    for i,x in enumerate(lines):
        if x==label:
            for y in lines[i+1:i+5]:
                if y and y!=label:return y
    return ""

async def scrape(browser,mid,url,top,sem):
    async with sem:
        page=await browser.new_page(viewport={"width":1280,"height":900})
        try:
            await page.goto(url,wait_until="domcontentloaded",timeout=25000)
            try:
                await page.wait_for_function("document.body.innerText.includes('렌탈사별 가격 비교') || document.body.innerText.includes('최저 월 렌탈료')",{ },timeout=8000)
            except:pass
            await page.wait_for_timeout(500)
            body=await page.locator("body").inner_text()
            lines=[clean(x) for x in body.splitlines() if clean(x)]
            brand=after(lines,"브랜드")
            model=after(lines,"모델명")
            item=after(lines,"품목") or top
            h2s=[clean(x) for x in await page.locator("h2").all_inner_texts()]
            name=next((x for x in h2s if x and ("[" in x or (brand and brand in x)) and "혜택" not in x), "")
            if not name:
                title=clean(await page.title()).split("|")[0].strip()
                name=title if title!="클로바렌탈몰" else ""
            if not brand:
                m=re.match(r"^\[([^\]]+)\]",name)
                if m:brand=m.group(1)
            pairs={}
            for term,price in re.findall(r"(\d{1,3})개월\s*월\s*([\d,]+)원",body):
                t=int(term);p=int(price.replace(",",""))
                if 6<=t<=120 and 1000<=p<=5000000:pairs[t]=min(p,pairs.get(t,p))
            if not name or not pairs:
                return None,{"id":mid,"url":url,"reason":"missing name or contract prices"}
            imgs=await page.locator("img").evaluate_all("(els)=>els.map(e=>({src:e.currentSrc||e.src||'',alt:e.alt||''})).filter(x=>x.src)")
            nkey=nn(name);image=""
            for im in imgs:
                if nn(im["alt"]) and (nn(im["alt"]) in nkey or nkey in nn(im["alt"])):
                    image=im["src"];break
            if not image:
                image=next((im["src"] for im in imgs if "storage.bilrigo.com" in im["src"] and not any(k in im["src"].lower() for k in ["banner","logo","icon"])), "")
            category=catmap(top,item,name)
            opts=[{"key":f"clover-{t}","management":"clover-lowest","managementLabel":"최저가 기준","term":t,
                   "monthly":p,"card":None,"gift":None,"care":"상품별 조건 상담 확인","sourceOption":"클로바렌탈 공개 최저가"}
                  for t,p in sorted(pairs.items())]
            product={"id":f"clv-{mid}","sourceId":mid,"brand":brand or "기타","name":name,"model":model,
              "category":category,"rawCategory":item,"color":"","page":f"product.html?id=clv-{mid}",
              "image":image,"sourceUrl":url,"tags":[category,item,brand or "기타"],
              "promo":"클로바렌탈 공개 상품 기준 · 최종 접수 전 최신 조건 확인",
              "shortDescription":f"{brand+' ' if brand else ''}{item} 렌탈 상품입니다. 계약기간별 월 렌탈료를 확인해 보세요.",
              "highlights":[item,f"{min(pairs)}~{max(pairs)}개월 계약","최종 조건 상담 확인"],
              "manufacturer":brand or "","rentalCompany":"클로바렌탈몰","detailImages":[],
              "options":opts,"sourceKind":"clover-import","availability":"active","giftStatus":"unavailable",
              "imageSourceOriginal":image,"importedFrom":BASE}
            return product,None
        except Exception as e:
            return None,{"id":mid,"url":url,"reason":type(e).__name__+":"+str(e)[:160]}
        finally:
            await page.close()

async def main():
    data=json.loads(DATA.read_text(encoding="utf-8"))
    original=[p for p in data.get("products",[]) if p.get("sourceKind")!="clover-import"]
    prior=[p for p in data.get("products",[]) if p.get("sourceKind")=="clover-import"]
    em={nm(p.get("model")) for p in original if nm(p.get("model"))}
    en={nn((p.get("brand") or "")+" "+(p.get("name") or "")) for p in original}
    pages,cands=discover()
    sem=asyncio.Semaphore(4);parsed=[];errors=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        tasks=[scrape(browser,mid,url,top,sem) for mid,(url,top) in cands.items()]
        done=0
        for coro in asyncio.as_completed(tasks):
            p,e=await coro
            if p:parsed.append(p)
            if e:errors.append(e)
            done+=1
            if done%25==0:print("rendered",done,"/",len(tasks),flush=True)
        await browser.close()
    added=[];dups=[];seenm=set();seenn=set()
    for p in parsed:
        mk=nm(p.get("model"));nk=nn((p.get("brand") or "")+" "+(p.get("name") or ""))
        if (mk and mk in em) or nk in en:
            dups.append({"model":p.get("model"),"name":p.get("name")});continue
        if (mk and mk in seenm) or nk in seenn:continue
        if mk:seenm.add(mk)
        seenn.add(nk);added.append(p)
    data["products"]=original+added;data["updatedAt"]="2026-10-03"
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    by={}
    for p in added:by[p["category"]]=by.get(p["category"],0)+1
    report={"generatedAt":"2026-10-03","existingOriginalPreserved":len(original),"previousImportedRebuilt":len(prior),
      "listPagesScanned":len(pages),"sourceProductsDiscovered":len(cands),"renderedProducts":len(parsed),
      "duplicatesSkipped":len(dups),"newProductsAdded":len(added),"totalProductsAfterImport":len(original)+len(added),
      "newByCategory":dict(sorted(by.items())),"renderErrors":len(errors),"duplicateExamples":dups[:30],"errorExamples":errors[:30]}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in ("duplicateExamples","errorExamples")},ensure_ascii=False,indent=2))

if __name__=="__main__":asyncio.run(main())
