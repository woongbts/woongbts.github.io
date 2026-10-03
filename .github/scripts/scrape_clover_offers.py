#!/usr/bin/env python3
import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[2]
PRODUCTS=ROOT/"rental/data/products.json"
OUT=ROOT/"rental/data/clover-offers-public.json"

def clean(s):
    return re.sub(r"\s+"," ",str(s or "")).strip()

def company_from(prefix, alt):
    bad={"최저가","다이렉트","빠른설치","자세히 보기","제휴카드 할인","렌탈 안내사항","접기","펼치기","무료 배송비","무료 설치비"}
    candidates=[]
    if alt:
        candidates.append(clean(alt))
    for line in [clean(x) for x in prefix.split("\n") if clean(x)]:
        if line in bad: continue
        if re.match(r"^\d{1,3}개월$",line): continue
        if re.match(r"^월\s*[\d,]+원$",line): continue
        if "카드" in line or "설치비" in line or "배송비" in line: continue
        candidates.append(line)
    for c in candidates:
        c=re.sub(r"\s+"," ",c).strip()
        if not c or len(c)>80: continue
        # Common rendered form repeats the logo alt, e.g. "이니렌탈 이니렌탈".
        parts=c.split()
        if len(parts)>=2 and len(parts)%2==0 and parts[:len(parts)//2]==parts[len(parts)//2:]:
            c=" ".join(parts[:len(parts)//2])
        if c:
            return c
    return ""

def parse_block(item):
    alt=clean(item.get("alt"))
    text=str(item.get("text") or "")
    # Require at least one contract-price pair.
    pairs=[]
    for m in re.finditer(r"(\d{1,3})개월\s*(?:\n|\s)*월\s*([\d,]+)원",text):
        term=int(m.group(1)); monthly=int(m.group(2).replace(",",""))
        if 6<=term<=120 and 1000<=monthly<=5000000:
            pairs.append({"term":term,"monthly":monthly})
    if not pairs:
        return None
    first=re.search(r"\d{1,3}개월",text)
    prefix=text[:first.start()] if first else text[:250]
    company=company_from(prefix,alt)
    if not company:
        return None
    # Reject obvious product/main-image false positives.
    if len(company)>50 or "상품" in company or "상세" in company:
        return None
    uniq={}
    for p in pairs:
        uniq[p["term"]]=min(p["monthly"],uniq.get(p["term"],p["monthly"]))
    return {"rentalCompany":company,"offers":[{"term":t,"monthly":uniq[t]} for t in sorted(uniq,reverse=True)]}

async def scrape_one(browser, product, sem):
    async with sem:
        page=await browser.new_page(viewport={"width":1280,"height":900})
        try:
            await page.goto(product["sourceUrl"],wait_until="domcontentloaded",timeout=30000)
            try:
                await page.wait_for_function("document.body && document.body.innerText.includes('렌탈사별 가격 비교')",timeout=10000)
            except Exception:
                pass
            await page.wait_for_timeout(900)
            items=await page.locator("img").evaluate_all("""els => els.map(img => {
              const alt=(img.getAttribute('alt')||'').trim();
              let n=img.parentElement;
              for(let i=0;i<11 && n;i++,n=n.parentElement){
                const t=(n.innerText||'').trim();
                if(/\d{1,3}개월/.test(t) && /월\s*[\d,]+원/.test(t) && t.length<5000){
                  return {alt,text:t};
                }
              }
              return null;
            }).filter(Boolean)""")
            parsed=[]
            seen=set()
            for item in items:
                b=parse_block(item)
                if not b: continue
                key=(b["rentalCompany"],tuple((x["term"],x["monthly"]) for x in b["offers"]))
                if key in seen: continue
                seen.add(key); parsed.append(b)
            # Fallback from body text if no logo container was found.
            if not parsed:
                body=await page.locator("body").inner_text()
                segment=body.split("렌탈사별 가격 비교",1)[-1].split("상품 상세정보",1)[0]
                chunks=re.split(r"(?=자세히 보기)",segment)
                for ch in chunks:
                    ps=[]
                    for m in re.finditer(r"(\d{1,3})개월\s*\n?\s*월\s*([\d,]+)원",ch):
                        t=int(m.group(1)); mo=int(m.group(2).replace(",",""))
                        if 6<=t<=120 and 1000<=mo<=5000000: ps.append({"term":t,"monthly":mo})
                    if not ps: continue
                    prefix=ch[:re.search(r"\d{1,3}개월",ch).start()]
                    comp=company_from(prefix,"")
                    if comp:
                        parsed.append({"rentalCompany":comp,"offers":ps})
            return {"id":product["id"],"sourceUrl":product["sourceUrl"],"name":product.get("name"),"rentalCompanies":parsed}
        except Exception as e:
            return {"id":product["id"],"sourceUrl":product.get("sourceUrl"),"name":product.get("name"),"error":type(e).__name__+":"+str(e)[:220],"rentalCompanies":[]}
        finally:
            await page.close()

async def main():
    data=json.loads(PRODUCTS.read_text(encoding="utf-8"))
    products=[p for p in data.get("products",[]) if p.get("sourceKind")=="clover-import" and p.get("sourceUrl")]
    sem=asyncio.Semaphore(5)
    results=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        tasks=[scrape_one(browser,p,sem) for p in products]
        done=0
        for coro in asyncio.as_completed(tasks):
            r=await coro; results.append(r); done+=1
            if done%20==0: print(f"scraped {done}/{len(tasks)}",flush=True)
        await browser.close()
    results.sort(key=lambda x:x["id"])
    summary={
      "productsRequested":len(products),
      "productsWithOffers":sum(1 for r in results if r.get("rentalCompanies")),
      "productsWithoutOffers":sum(1 for r in results if not r.get("rentalCompanies")),
      "companyLabels":sorted({c["rentalCompany"] for r in results for c in r.get("rentalCompanies",[])})
    }
    OUT.write_text(json.dumps({"summary":summary,"products":results},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=="__main__":
    asyncio.run(main())
