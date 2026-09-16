import json
from pathlib import Path

base=json.loads(Path('data/catalog.json').read_text(encoding='utf-8'))
plans_data=json.loads(Path('data/plans.json').read_text(encoding='utf-8'))
supports_data=json.loads(Path('data/supports.json').read_text(encoding='utf-8'))
devices=base.get('devices',[])
plans=plans_data.get('mobile_plans',[])
schedules=supports_data.get('support_schedules',[])
plan_by_id={p.get('id'):p for p in plans}
device_by_id={d.get('id'):d for d in devices}
print('devices',len(devices),'plans',len(plans),'schedules',len(schedules))

print('\nVALUE DEVICES + ELIGIBLE 60K PLANS')
for d in devices:
    text=' '.join(str(d.get(k,'')) for k in ['carrier','name','model','model_code']).lower()
    if not any(k in text for k in ['점프5','jump5','퀀텀7','퀀텀6','퀀텀5']):
        continue
    print('\nDEVICE', {k:d.get(k) for k in ['id','carrier','name','model_code','release_date','retail_price','source_order']})
    ids=set()
    by_join=d.get('eligible_plan_ids_by_join_type') or {}
    for arr in by_join.values():
        if isinstance(arr,list): ids.update(arr)
    if not ids: ids.update(d.get('eligible_plan_ids') or [])
    candidates=[]
    for pid in ids:
        p=plan_by_id.get(pid)
        if not p: continue
        try: fee=float(p.get('monthly_fee'))
        except: continue
        textp=(str(p.get('name',''))+' '+str(p.get('description',''))).lower().replace(' ','')
        if 59000<=fee<=69000 and not any(k in textp for k in ['태블릿','tablet','워치','watch','함께쓰기','쉐어링','셰어링','투게더','아이패드','ipad','스마트기기']):
            candidates.append(p)
    for p in sorted(candidates,key=lambda x:(abs(float(x.get('monthly_fee'))-65000),x.get('source_order',999999)))[:12]:
        print('  PLAN', {k:p.get(k) for k in ['id','carrier','name','monthly_fee','source_order']})

print('\nPREMIUM 400-500K SUPPORT ON HIGH PLANS')
rows=[]
for rule in schedules:
    carrier=rule.get('carrier')
    joins=rule.get('join_types') or []
    amounts=rule.get('amounts') or {}
    for did in rule.get('device_ids') or []:
        d=device_by_id.get(did)
        if not d: continue
        name=(str(d.get('name',''))+' '+str(d.get('model_code',''))).lower()
        if not any(k in name for k in ['갤럭시 s','galaxy s','폴드','fold','플립','flip','아이폰','iphone']):
            continue
        for pid,amount0 in amounts.items():
            try: amount=float(amount0)
            except: continue
            if not 400000<=amount<=500000: continue
            p=plan_by_id.get(pid)
            if not p: continue
            try: fee=float(p.get('monthly_fee'))
            except: continue
            textp=(str(p.get('name',''))+' '+str(p.get('description',''))).lower().replace(' ','')
            if fee<70000 or any(k in textp for k in ['태블릿','tablet','워치','watch','함께쓰기','쉐어링','셰어링','투게더','아이패드','ipad','스마트기기']):
                continue
            rows.append((carrier,d.get('source_order',999999),fee,amount,d.get('name'),p.get('name'),joins))
for row in sorted(rows,key=lambda x:(x[0],x[1],-x[2],abs(x[3]-450000)))[:120]:
    print({'carrier':row[0],'device':row[4],'plan':row[5],'fee':row[2],'support':row[3],'joins':row[6]})
print('premium matches',len(rows))
