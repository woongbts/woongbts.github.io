#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PRODUCTS=ROOT/"rental/data/products.json"
GIFTS=ROOT/"rental/data/appliance-gift-options.json"
SNAPSHOT=ROOT/"rental/data/policy-snapshot.json"
REPORT=ROOT/"rental/data/policy-alerts.json"

def load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def sellable(o):
    text=" ".join(str(o.get(k) or "") for k in ("managementLabel","sourceOption","care"))
    try: monthly=int(o.get("monthly"))
    except Exception: return False
    return monthly>0 and not re.search(r"(?:^|\s)단종/",text)

def build_state():
    pdata=load(PRODUCTS,{"products":[]})
    gdata=load(GIFTS,{})
    gift_overrides=gdata.get("products",{})
    rows={}
    active_products={}
    for raw in pdata.get("products",[]):
        if raw.get("availability")=="inactive" or re.search(r"접수불가|접수중지|단종",str(raw.get("name") or "")): continue
        p=dict(raw);pid=str(p.get("id") or "")
        if not pid: continue
        if p.get("sourceKind")=="clover-import" and pid in gift_overrides:
            p.update(gift_overrides[pid])
        active_products[pid]={"name":str(p.get("name") or pid),"category":str(p.get("category") or "")}
        for o in p.get("options",[]) or []:
            if not sellable(o): continue
            mgmt=str(o.get("managementLabel") or o.get("management") or "")
            term=str(o.get("term") or "")
            key="|".join([pid,mgmt,term])
            try: gift=int(o.get("gift")) if o.get("gift") is not None else None
            except Exception: gift=None
            rows[key]={"product_id":pid,"name":active_products[pid]["name"],"category":active_products[pid]["category"],"management":mgmt,"term":term,"monthly":int(o.get("monthly")),"gift":gift}
    raw=json.dumps({"products":active_products,"options":rows},ensure_ascii=False,sort_keys=True,separators=(",",":"))
    return {
        "schema":1,
        "sourcePolicyDate":str(gdata.get("generatedAt") or pdata.get("updatedAt") or "")[:10],
        "fingerprint":hashlib.sha256(raw.encode()).hexdigest(),
        "products":active_products,
        "options":rows,
    }

def money(n): return f"{int(n):,}원" if n is not None else "없음"

def compare(old,new):
    alerts=[]
    oldp=old.get("products",{});newp=new.get("products",{})
    for pid in sorted(set(oldp)-set(newp)):
        alerts.append({"level":"danger","type":"상품중단","product_id":pid,"title":oldp[pid].get("name",pid),"message":"이전 스냅샷에 있던 활성 상품이 현재 데이터에서 사라졌습니다."})
    for pid in sorted(set(newp)-set(oldp)):
        alerts.append({"level":"info","type":"신규상품","product_id":pid,"title":newp[pid].get("name",pid),"message":"새 활성 상품이 추가되었습니다."})
    oldo=old.get("options",{});newo=new.get("options",{})
    for key in sorted(set(oldo)&set(newo)):
        a,b=oldo[key],newo[key]
        pm0,pm1=a.get("monthly"),b.get("monthly")
        if pm0 and pm1 and pm0!=pm1:
            diff=pm1-pm0;rate=abs(diff)/pm0
            if abs(diff)>=1000 or rate>=0.05:
                alerts.append({"level":"warn" if diff<0 else "danger","type":"월요금","product_id":b["product_id"],"title":b["name"],"message":f"{b['management']} · {b['term']}개월: {money(pm0)} → {money(pm1)} ({diff:+,}원)"})
        g0,g1=a.get("gift"),b.get("gift")
        if g0 is not None and g1 is not None and g0!=g1:
            diff=g1-g0;rate=abs(diff)/max(g0,1)
            if abs(diff)>=20000 or rate>=0.15:
                alerts.append({"level":"warn" if diff>0 else "danger","type":"사은품","product_id":b["product_id"],"title":b["name"],"message":f"{b['management']} · {b['term']}개월: {money(g0)} → {money(g1)} ({diff:+,}원)"})
    return alerts[:250]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--issue-body",action="store_true")
    args=parser.parse_args()
    current=build_state()
    previous=load(SNAPSHOT,{})
    if args.issue_body:
        report=load(REPORT,{"alerts":[]})
        print(f"## 웅비렌탈 정책 변경 감지\n\n기준일: {report.get('sourcePolicyDate') or '-'}\n\n중요 변경: **{report.get('alertCount',0)}건**\n")
        for a in report.get("alerts",[])[:80]:
            print(f"- **[{a.get('type','변경')}] {a.get('title','')}** — {a.get('message','')}")
        return
    if previous.get("fingerprint")==current["fingerprint"]:
        print("정책 데이터 변경 없음")
        return
    alerts=[] if not previous.get("fingerprint") else compare(previous,current)
    report={
        "schema":1,
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "sourcePolicyDate":current.get("sourcePolicyDate",""),
        "previousFingerprint":previous.get("fingerprint",""),
        "currentFingerprint":current["fingerprint"],
        "alertCount":len(alerts),
        "alerts":alerts,
        "status":"baseline" if not previous.get("fingerprint") else ("changed" if alerts else "updated-no-material-alert"),
    }
    SNAPSHOT.write_text(json.dumps(current,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"정책 스냅샷 갱신 / 중요 변경 {len(alerts)}건")

if __name__=="__main__":
    main()
