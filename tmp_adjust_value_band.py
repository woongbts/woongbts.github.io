from pathlib import Path
p=Path('assets/rates.js')
s=p.read_text(encoding='utf-8')
old1="rank<=2||(price>=400000&&price<=730000)"
new1="rank<=2||(price>=400000&&price<800000)"
old2="Number(p.monthly_fee)>=59000&&Number(p.monthly_fee)<=69000"
new2="Number(p.monthly_fee)>=60000&&Number(p.monthly_fee)<=69000"
if s.count(old1)!=1: raise SystemExit(f'value price band match: {s.count(old1)}')
if s.count(old2)!=1: raise SystemExit(f'value plan band match: {s.count(old2)}')
s=s.replace(old1,new1,1).replace(old2,new2,1)
p.write_text(s,encoding='utf-8')
print('adjusted value price/plan bands')
