import json
from pathlib import Path

for filename in ['data/catalog.json','data/mobile-public.json']:
    p=Path(filename)
    if not p.exists():
        continue
    data=json.loads(p.read_text(encoding='utf-8'))
    print('\n###', filename)
    devices=data.get('devices',[])
    plans=data.get('mobile_plans', data.get('plans',[]))
    supports=data.get('mobile_supports', data.get('supports',[]))
    print('devices',len(devices),'plans',len(plans),'supports',len(supports))
    print('\nVALUE DEVICES')
    for d in devices:
        text=' '.join(str(d.get(k,'')) for k in ['carrier','name','model','model_code']).lower()
        if any(k in text for k in ['점프','jump','퀀텀','quantum']):
            print({k:d.get(k) for k in ['id','carrier','name','model','model_code','release_date','retail_price','source_order']})
    print('\n60K PLANS')
    for p0 in plans:
        fee=p0.get('monthly_fee')
        try: fee=float(fee)
        except: continue
        if 58000 <= fee <= 69000:
            text=(str(p0.get('name',''))+' '+str(p0.get('description',''))).lower().replace(' ','')
            if not any(k in text for k in ['태블릿','tablet','워치','watch','함께쓰기','쉐어링','셰어링','투게더','아이패드','ipad','스마트기기']):
                print({k:p0.get(k) for k in ['id','carrier','name','monthly_fee','source_order']})
    print('\nPREMIUM SUPPORT 400-500K ON HIGH PLANS')
    plan_by_id={p0.get('id'):p0 for p0 in plans}
    device_by_id={d.get('id'):d for d in devices}
    count=0
    for s in supports:
        try: amount=float(s.get('public_support'))
        except: continue
        if not 400000 <= amount <= 500000: continue
        d=device_by_id.get(s.get('device_id')); p0=plan_by_id.get(s.get('plan_id'))
        if not d or not p0: continue
        try: fee=float(p0.get('monthly_fee'))
        except: continue
        if fee < 70000: continue
        name=(str(d.get('name',''))+' '+str(d.get('model',''))).lower()
        if not any(k in name for k in ['갤럭시 s','galaxy s','폴드','fold','플립','flip','아이폰','iphone']): continue
        print({'carrier':d.get('carrier'),'device':d.get('name'),'plan':p0.get('name'),'fee':p0.get('monthly_fee'),'support':s.get('public_support'),'join':s.get('join_type')})
        count+=1
        if count>=80: break
