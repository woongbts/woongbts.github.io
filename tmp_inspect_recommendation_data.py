import json,re
from pathlib import Path
base=json.loads(Path('data/catalog.json').read_text(encoding='utf-8'))
plans_data=json.loads(Path('data/plans.json').read_text(encoding='utf-8'))
supports_data=json.loads(Path('data/supports.json').read_text(encoding='utf-8'))
devices=base.get('devices',[]); plans=plans_data.get('mobile_plans',[]); schedules=supports_data.get('support_schedules',[])
plan_by_id={p.get('id'):p for p in plans}

def second_device(p):
    t=(str(p.get('name',''))+' '+str(p.get('description',''))).lower().replace(' ','')
    return any(k in t for k in ['태블릿','tablet','워치','watch','함께쓰기','쉐어링','셰어링','투게더','아이패드','ipad','스마트기기','세컨드디바이스','2nddevice'])
def ids_for(d,join='기기변경'):
    by=d.get('eligible_plan_ids_by_join_type') or {}
    arr=by.get(join)
    return arr if isinstance(arr,list) else (d.get('eligible_plan_ids') or [])
def support(d,p,join='기기변경'):
    for r in schedules:
        if r.get('carrier')!=d.get('carrier'): continue
        if d.get('id') not in (r.get('device_ids') or []): continue
        if join not in (r.get('join_types') or []): continue
        amounts=r.get('amounts') or {}
        if p.get('id') in amounts:
            try:return float(amounts[p.get('id')])
            except:return None
    return None
def value_rank(d):
    t=(str(d.get('name',''))+' '+str(d.get('model_code',''))).lower().replace(' ','')
    if d.get('carrier')=='KT' and ('jump5' in t or '점프5' in t): return 0
    if d.get('carrier')=='SKT' and ('퀀텀7' in t or 'quantum7' in t): return 0
    if d.get('carrier')=='SKT' and ('퀀텀6' in t or 'quantum6' in t): return 1
    if d.get('carrier')=='SKT' and ('퀀텀5' in t or 'quantum5' in t): return 2
    samsung=any(k in t for k in ['삼성','samsung','갤럭시','galaxy'])
    return 4 if samsung else 9
def value_target(c): return {'SKT':66000,'KT':65000,'LGU+':63000}.get(c,65000)

value=[]
for d in devices:
    price=float(d.get('retail_price') or 0); rank=value_rank(d)
    if rank>=9 or not (rank<=2 or (400000<=price<800000)): continue
    cands=[]
    for pid in ids_for(d):
        p=plan_by_id.get(pid)
        if not p or second_device(p): continue
        fee=float(p.get('monthly_fee') or 0)
        if 60000<=fee<=69000: cands.append(p)
    if not cands: continue
    target=value_target(d.get('carrier'))
    p=min(cands,key=lambda x:(abs(float(x.get('monthly_fee') or 0)-target),x.get('source_order',999999)))
    value.append((rank,d.get('source_order',999999),d,p))
print('VALUE TOP')
for _,__,d,p in sorted(value,key=lambda x:(x[0],x[1]))[:10]:
    print(d.get('carrier'),d.get('name'),d.get('retail_price'),'|',p.get('name'),p.get('monthly_fee'))
assert any(d.get('carrier')=='KT' and 'Jump5' in str(d.get('name')) for _,__,d,p in value)
assert any(d.get('carrier')=='SKT' and '퀀텀7' in str(d.get('name')) for _,__,d,p in value)

premium=[]
for d in devices:
    compact=(str(d.get('name',''))+' '+str(d.get('model_code',''))).lower().replace(' ','')
    if not re.search(r'아이폰|iphone|갤럭시s\d|galaxys\d|폴드|fold|플립|flip',compact): continue
    best=None
    for pid in ids_for(d):
        p=plan_by_id.get(pid)
        if not p or second_device(p): continue
        fee=float(p.get('monthly_fee') or 0)
        if fee<80000: continue
        sup=support(d,p)
        if sup is None or not 400000<=sup<=500000: continue
        key=(abs(sup-450000),fee,p.get('source_order',999999))
        if best is None or key<best[0]: best=(key,p,sup)
    if best: premium.append((d.get('source_order',999999),d,best[1],best[2]))
print('PREMIUM TOP')
for _,d,p,sup in sorted(premium,key=lambda x:x[0])[:15]:
    print(d.get('carrier'),d.get('name'),'|',p.get('name'),p.get('monthly_fee'),'| support',int(sup))
assert premium
assert all(400000<=sup<=500000 and float(p.get('monthly_fee') or 0)>=80000 for _,d,p,sup in premium)
print('validation ok')
