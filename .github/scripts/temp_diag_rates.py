from pathlib import Path
import json

s=Path('assets/rates.min.js').read_text(encoding='utf-8')
for start_term,end_term in [('function ye','function ee'),('function Ke','function je'),('function Fe','function Be')]:
    a=s.find(start_term)
    b=s.find(end_term,a+1) if a>=0 else -1
    print(f'\n===== {start_term} =====')
    print(s[a:b if b>0 else a+7000])

print('\n===== catalog matches =====')
obj=json.loads(Path('data/mobile-public.json').read_text(encoding='utf-8'))
print(type(obj), obj.keys() if isinstance(obj,dict) else len(obj))
devs=obj.get('devices',[]) if isinstance(obj,dict) else []
plans=obj.get('mobile_plans',[]) if isinstance(obj,dict) else []
for d in devs:
    text=' '.join(str(d.get(k,'')) for k in ('name','model','model_code')).lower().replace(' ','')
    if any(x in text for x in ['jump5','점프5','a376','a37','퀀텀7','quantum7','a576']):
        print('DEVICE',json.dumps(d,ensure_ascii=False))
for p in plans:
    text=str(p.get('name','')).lower().replace(' ','')
    if ('베이직' in p.get('name','') and '4GB' in p.get('name','')) or '라이트39' in text or '라이트 39' in p.get('name',''):
        print('PLAN',json.dumps(p,ensure_ascii=False))
