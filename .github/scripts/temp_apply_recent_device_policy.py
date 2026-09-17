from pathlib import Path

sync=Path('.github/scripts/daily_wireless_sync.py')
s=sync.read_text(encoding='utf-8')

# 1) Keep the public wireless catalog focused on devices released within the latest 12 months.
old='from datetime import datetime\n'
new='from datetime import datetime, timedelta\n'
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

old='TODAY = datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()\n'
new='TODAY_DATE = datetime.now(ZoneInfo("Asia/Seoul")).date()\nTODAY = TODAY_DATE.isoformat()\nRECENT_DEVICE_DAYS = 365\nRECENT_DEVICE_CUTOFF = (TODAY_DATE - timedelta(days=RECENT_DEVICE_DAYS)).isoformat()\n'
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

old='''            if price is None or price <= 0 or release in ("", "0000-00-00"):\n                continue\n            candidates.append((order, device))\n'''
new='''            if price is None or price <= 0 or release in ("", "0000-00-00"):\n                continue\n            # Source order is RELEASE_DT_DESC. Keep recent devices only so legacy stock\n            # cannot leak back into customer calculators or recommendations.\n            if release < RECENT_DEVICE_CUTOFF:\n                continue\n            candidates.append((order, device))\n'''
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

old='floors = {"devices": 0.65, "plans": 0.65, "supports": 0.50}\n    minimums = {"devices": 25, "plans": 20, "supports": 20}\n'
new='floors = {"devices": 0.10, "plans": 0.65, "supports": 0.05}\n    minimums = {"devices": 30, "plans": 20, "supports": 20}\n'
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

old='''    new_carriers = count_by_carrier(devices)\n    for carrier in ("SKT", "KT", "LGU+"):\n        if new_carriers.get(carrier, 0) < 5:\n            raise RuntimeError(f"too few {carrier} devices: {new_carriers.get(carrier, 0)}")\n\n    plan_ids = set()\n'''
new='''    new_carriers = count_by_carrier(devices)\n    for carrier in ("SKT", "KT", "LGU+"):\n        if new_carriers.get(carrier, 0) < 15:\n            raise RuntimeError(f"too few {carrier} recent devices: {new_carriers.get(carrier, 0)}")\n    stale = [device.get("id") for device in devices if str(device.get("release_date") or "") < RECENT_DEVICE_CUTOFF]\n    if stale:\n        raise RuntimeError(f"stale devices leaked into public catalog: {stale[:5]}")\n\n    plan_ids = set()\n'''
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
sync.write_text(s,encoding='utf-8')

# 2) Update customer recommendation behavior to match the recent-device catalog.
js=Path('assets/rates.min.js')
j=js.read_text(encoding='utf-8')

old='senior:"매장에서 자주 안내하는 A17·Wide8·Buddy5를 우선 살펴보고, 스마트폰 사용이 익숙하지 않은 분께는 스타일폴더2도 함께 안내합니다. 사용량과 월 부담을 함께 살펴보며, 복지 할인은 실제 자격 확인 시 적용됩니다."'
new='senior:"최근 출시된 Wide9·Buddy5·A37·A17 같은 보급형 기종을 우선 살펴봅니다. 사용량과 월 부담을 함께 살펴보며, 복지 할인은 실제 자격 확인 시 적용됩니다."'
assert j.count(old)==1, j.count(old)
j=j.replace(old,new,1)

old='stylefolder2:{category:"senior",carrier:"SKT",deviceId:"SKT-XD-2636",name:"스타일폴더2",modelCode:"AT-M140S",price:237600,planName:"T플랜 세이브",planFee:33e3,deviceMonthly:10520,installmentFee:14880,contractDiscount:8250,welfareAmount:12100},'
assert j.count(old)==1, j.count(old)
j=j.replace(old,'',1)

start=j.index('function $e(e)')
end=j.index('function Ee(e)',start)
new_func='function $e(e){if(xe(e))return 99;const t=`${e?.name||""} ${e?.model||""}`.toLowerCase().replace(/\\s+/g,""),n=`${e?.model_code||""}`.toLowerCase().replace(/\\s+/g,"");return t.includes("wide9")||t.includes("와이드9")?0:t.includes("buddy5")||t.includes("버디5")?1:t.includes("갤럭시a37")||t.includes("galaxya37")||/^sm-a376/.test(n)?2:t.includes("갤럭시a17")||t.includes("galaxya17")||/^sm-a175/.test(n)?3:9}'
j=j[:start]+new_func+j[end:]
start=j.index('function Ee(e)')
end=j.index('function Le(e,t)',start)
new_func='function Ee(e){const t=$e(e);return 0===t?"wide9":1===t?"buddy5":2===t?"a37":3===t?"a17":`${e?.name||""}`.toLowerCase().replace(/\\s+/g,"")}'
j=j[:start]+new_func+j[end:]

marker='if("senior"===ve&&"기기변경"===r&&("all"===e||"SKT"===e)){'
a=j.find(marker)
assert a>=0, a
b=j.find('return l}',a)
assert b>=0, b
j=j[:a]+'return l}'+j[b+len('return l}'):]

needle='filter(t=>t.carrier===e&&V(t,a)&&n(t.retail_price)&&Number(t.retail_price)>0)'
replacement='filter(t=>t.carrier===e&&V(t,a)&&n(t.retail_price)&&Number(t.retail_price)>0&&!xe(t)&&!Ce(t)&&!/폴더|folder/i.test(`${t.name||""} ${t.model||""} ${t.model_code||""}`))'
count=j.count(needle)
assert count>=1, count
j=j.replace(needle,replacement,1)

for old,new in [
    ('data/catalog.json?v=20260916-1','data/catalog.json?v=20260918-2'),
    ('data/plans.json?v=20260916-1','data/plans.json?v=20260918-2'),
    ('data/supports.json?v=20260916-1','data/supports.json?v=20260918-2'),
]:
    assert j.count(old)==1, (old,j.count(old))
    j=j.replace(old,new,1)
js.write_text(j,encoding='utf-8')

html=Path('rates.html')
h=html.read_text(encoding='utf-8')
old='assets/rates.min.js?v=20260918-1'
new='assets/rates.min.js?v=20260918-2'
assert h.count(old)==1, h.count(old)
h=h.replace(old,new,1)
html.write_text(h,encoding='utf-8')
print('recent device policy patch applied')
