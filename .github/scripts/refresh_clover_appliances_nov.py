#!/usr/bin/env python3
"""Verify November 2026 Clover appliance offers without exposing internal payouts.

Read existing confirmed customer-facing shares and rederive the same percentage rule.
Only overwrite an offer when its original product page verifies price, provider and term.
Fail closed if most current listings cannot be verified.
"""
from __future__ import annotations
import json, re, statistics, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
PRODUCTS=ROOT/"rental/data/products.json"
OPTIONS=ROOT/"rental/data/appliance-gift-options.json"
REPORT=ROOT/"rental/data/november-2026-compare-report.json"
DATE=datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()
MONTH=DATE[:7]
PROVIDERS={"LG헬로렌탈","스마트렌탈","BS ON","이니렌탈","현대유버스","KT가전구독"}
SPECIAL="KT가전구독"

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def clean(s): return re.sub(r"\\s+"," ",str(s or "")).strip()
def normalize(name):
    v=clean(name).replace("LG헬로비전","LG헬로렌탈").replace("현대유버스 (가전)","현대유버스")
    return v

def source_page(product):
    url=str(product.get("sourceUrl") or "")
    if not url.startswith("https://m.clvrental777.com/model/compare.php?model_idx="):
        return product["id"],None,"unsupported_source_url"
    for attempt in range(2):
        try:
            req=Request(url,headers={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9"})
            with urlopen(req,timeout=22) as r:
                body=r.read(1800000).decode("utf-8","replace")
            if "compare_cont" not in body: return product["id"],None,"no_offer_markup"
            soup=BeautifulSoup(body,"html.parser")
            offers={}
            for section in soup.select("div.compare_cont.section"):
                title=section.select_one("h3[data-value]")
                provider=normalize(title.get_text(" ",strip=True) if title else "")
                if provider not in PROVIDERS: continue
                for li in section.select(".radioType_prc li"):
                    term_node=li.find("span")
                    price_node=li.find("em")
                    t=re.search(r"(\\d{2})\\s*개월",term_node.get_text(" ",strip=True) if term_node else "")
                    v=re.sub(r"[^0-9]","",price_node.get_text(" ",strip=True) if price_node else "")
                    if not t or not v: continue
                    term,monthly=int(t.group(1)),int(v)
                    if 12<=term<=96 and 5000<=monthly<=500000:
                        offers[(provider,term)]=monthly
            if offers:return product["id"],offers,None
            return product["id"],None,"no_supported_provider_monthly_offers"
        except Exception as e:
            if attempt: return product["id"],None,type(e).__name__
            time.sleep(.5)
    return product["id"],None,"unknown"

def derive_rates(data):
    buckets={}
    fixed={}
    for row in data.get("products",{}).values():
        for o in row.get("options",[]):
            provider=normalize(o.get("managementLabel") or o.get("management"))
            monthly,term,gift=o.get("monthly"),o.get("term"),o.get("gift")
            if provider not in PROVIDERS: continue
            if provider==SPECIAL:
                if isinstance(gift,int):fixed.setdefault(provider,[]).append(gift)
                continue
            if not all(isinstance(x,int) and x>0 for x in (monthly,term,gift)):continue
            buckets.setdefault(provider,[]).append(2*gift/(monthly*term))
    result={}
    for provider,values in buckets.items():
        if len(values)<5:raise RuntimeError("Insufficient saved examples for "+provider)
        rate=round(statistics.median(values),2)
        if not 0.01<rate<0.3:raise RuntimeError("Invalid inferred rate for "+provider)
        if any(abs(v-rate)>0.005 for v in values):raise RuntimeError("Inconsistent baseline for "+provider)
        result[provider]=rate
    for provider,values in fixed.items():
        if len(set(values))!=1:raise RuntimeError("Inconsistent special baseline")
        result[provider]=("fixed",values[0])
    if PROVIDERS-set(result):raise RuntimeError("Missing baseline for "+str(PROVIDERS-set(result)))
    return result

def gift_for(provider,term,monthly,rates):
    rate=rates[provider]
    if isinstance(rate,tuple):return rate[1]
    return int(monthly*term*rate/2)

def main():
    products=load(PRODUCTS)
    policy=load(OPTIONS)
    rates=derive_rates(policy)
    tracked=[p for p in products.get("products",[]) if p.get("sourceKind")=="clover-import"]
    if len(tracked)<150 or len(policy.get("products",{}))<150:
        raise RuntimeError("Unexpectedly small baseline")
    results={}
    with ThreadPoolExecutor(max_workers=7) as pool:
        futures={pool.submit(source_page,p):p["id"] for p in tracked}
        for future in as_completed(futures):
            pid,offers,error=future.result()
            results[pid]=(offers,error)
    verified=0
    changes=0
    added=0
    removed=0
    unmodified=0
    failures=[]
    examples=[]
    for p in tracked:
        offers,error=results.get(p["id"],(None,"not_checked"))
        if not offers:
            failures.append({"id":p["id"],"reason":error})
            continue
        previous=p.get("options") or []
        old={(normalize(o.get("managementLabel") or o.get("management")),int(o.get("term") or 0)):o for o in previous}
        recognized=len([k for k in offers if k in old])
        if len(previous)>=3 and recognized < max(1,len(previous)//2):
            failures.append({"id":p["id"],"reason":"source_provider_coverage_low",
                             "saved":len(previous),"matched":recognized,"seen":len(offers)})
            continue
        if any(key in old and abs(price-old[key]["monthly"])/max(1,old[key]["monthly"])>.45
               for key,price in offers.items()):
            failures.append({"id":p["id"],"reason":"extreme_price_change_review"})
            continue
        new_options=[]
        for (provider,term),monthly in offers.items():
            key=provider+"-"+str(term)
            before=old.get((provider,term))
            gift=gift_for(provider,term,monthly,rates)
            option=dict(before) if before else {
                "key":key,"management":provider,"managementLabel":provider,"term":term,
                "card":None,"care":"렌탈사별 조건 상담 확인",
                "sourceOption":"공개 월 렌탈료 기준"}
            option["monthly"]=monthly
            option["gift"]=gift
            option["giftPolicyMonth"]=MONTH
            new_options.append(option)
            if before:
                if before.get("monthly")!=monthly or before.get("gift")!=gift:
                    changes+=1
                    if len(examples)<25:examples.append({
                        "id":p["id"],"provider":provider,"term":term,
                        "oldMonthly":before.get("monthly"),"monthly":monthly,
                        "oldGift":before.get("gift"),"gift":gift})
                else:unmodified+=1
            else:added+=1
        removed+=len([key for key in old if key not in offers])
        p["options"]=new_options
        p["rentalCompany"]=" / ".join(sorted(set(x["managementLabel"] for x in new_options)))
        p["giftStatus"]="customer-gift-calculated"
        p["sourceVerifiedAt"]=DATE
        corresponding=policy["products"].get(p["id"])
        if corresponding is None:raise RuntimeError("No policy entry for "+p["id"])
        corresponding["options"]=new_options
        corresponding["rentalCompany"]=p["rentalCompany"]
        corresponding["giftStatus"]="customer-gift-calculated"
        verified+=1
    if verified<120:
        print("Source verification failed; sample:",json.dumps(failures[:15],ensure_ascii=False))
        raise RuntimeError(f"Only {verified}/{len(tracked)} products verified; preserve all original data")
    policy["generatedAt"]=DATE
    policy["productCount"]=len(policy["products"])
    policy["optionCount"]=sum(len(x.get("options",[])) for x in policy["products"].values())
    products["updatedAt"]=DATE
    products["applianceVerification"]={
        "date":DATE,"verified":verified,"total":len(tracked),
        "optionsChanged":changes,"optionsNew":added,"optionsRemoved":removed}
    if policy["productCount"]!=len(tracked):
        raise RuntimeError("Product count drift")
    for pid,entry in policy["products"].items():
        for o in entry.get("options",[]):
            mg=normalize(o.get("managementLabel") or o.get("management"))
            if gift_for(mg,int(o["term"]),int(o["monthly"]),rates)!=int(o["gift"]):
                raise RuntimeError("Gift mismatch "+pid+"/"+str(o.get("key")))
    report={"date":DATE,"source":"https://m.clvrental777.com/",
            "total":len(tracked),"verified":verified,"needsReview":len(failures),
            "optionsChanged":changes,"optionsAdded":added,
            "optionsNoLongerListed":removed,"unchanged":unmodified,
            "exceptions":failures,"examples":examples,
            "note":"Published fields contain customer gifts, not internal commissions. Unverified products preserve previous conditions."}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    PRODUCTS.write_text(json.dumps(products,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    OPTIONS.write_text(json.dumps(policy,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in ("exceptions","examples")},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
