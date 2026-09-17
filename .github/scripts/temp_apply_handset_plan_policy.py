from pathlib import Path
import re

sync = Path('.github/scripts/daily_wireless_sync.py')
s = sync.read_text(encoding='utf-8')

# Keep the source's ABLE result, but remove accessory/device-service plans that are
# not normal smartphone rate plans. Xeronote's ABLE response itself can include
# tablet/watch/outdoor/pocket-WiFi rows, so join_yn alone is not sufficient.
anchor = '''def eligible_rows(rows):
    return [
        row
        for row in (rows or [])
        if str(row.get("join_yn", "")).upper() != "N"
        and str(row.get("except_yn", "")).upper() != "Y"
    ]
'''
assert s.count(anchor) == 1, s.count(anchor)
addition = anchor + '''\n\ndef handset_plan_rows(rows):
    blocked = (
        "아웃도어",
        "tab",
        "태블릿",
        "watch",
        "워치",
        "포켓파이",
        "스마트기기",
        "데이터함께쓰기",
        "데이터쉐어링",
        "데이터셰어링",
        "아이패드",
        "ipad",
        "세컨드디바이스",
        "2nddevice",
    )
    result = []
    for row in eligible_rows(rows):
        name = clean(row.get("plan_name")).lower().replace(" ", "")
        if any(token in name for token in blocked):
            continue
        result.append(row)
    return result
'''
s = s.replace(anchor, addition, 1)

# Xeronote labels NONE as its default/popular order. Use it explicitly instead of
# an empty sort value, and continue to request ABLE (currently available) plans.
old = '                    "sort_type": "",\n                    "join_type": join_code,\n                    "join_flag": "ABLE",'
new = '                    "sort_type": "NONE",\n                    "join_type": join_code,\n                    "join_flag": "ABLE",'
assert s.count(old) == 1, s.count(old)
s = s.replace(old, new, 1)

old = '                by_join[join_label] = eligible_rows(rows)\n'
new = '                by_join[join_label] = handset_plan_rows(rows)\n'
assert s.count(old) == 1, s.count(old)
s = s.replace(old, new, 1)

# Preserve Xeronote's returned order. The old code overwrote source_order by
# monthly fee descending, which made the customer UI diverge from the source list.
old = '''    plans = list(all_plans.values())
    for carrier in ("SKT", "KT", "LGU+"):
        rows = [plan for plan in plans if plan.get("carrier") == carrier]
        rows.sort(key=lambda plan: (-(plan.get("monthly_fee") or 0), plan.get("name") or ""))
        for index, plan in enumerate(rows, 1):
            plan["source_order"] = index
'''
new = '''    carrier_order = {"SKT": 0, "KT": 1, "LGU+": 2}
    plans = sorted(
        all_plans.values(),
        key=lambda plan: (
            carrier_order.get(plan.get("carrier"), 9),
            int(plan.get("source_order") or 999999),
            plan.get("name") or "",
        ),
    )
'''
assert s.count(old) == 1, s.count(old)
s = s.replace(old, new, 1)

# Validate that accessory-plan names can never leak into the public phone catalog.
needle = '''        fee = plan.get("monthly_fee")
        if fee is not None and not (0 <= int(fee) <= 300000):
            raise RuntimeError(f"invalid monthly fee: {pid}={fee}")
'''
assert s.count(needle) == 1, s.count(needle)
extra = needle + '''        normalized_name = clean(plan.get("name")).lower().replace(" ", "")
        blocked_plan_tokens = (
            "아웃도어", "tab", "태블릿", "watch", "워치", "포켓파이",
            "스마트기기", "데이터함께쓰기", "데이터쉐어링", "데이터셰어링",
            "아이패드", "ipad", "세컨드디바이스", "2nddevice",
        )
        if any(token in normalized_name for token in blocked_plan_tokens):
            raise RuntimeError(f"non-handset plan leaked into public catalog: {pid} {plan.get('name')}")
'''
s = s.replace(needle, extra, 1)

sync.write_text(s, encoding='utf-8')

# Bust customer-side caches for the refreshed wireless data.
js = Path('assets/rates.min.js')
j = js.read_text(encoding='utf-8')
for filename in ('catalog', 'plans', 'supports'):
    pattern = rf'data/{filename}\.json\?v=\d{{8}}-\d+'
    replacement = f'data/{filename}.json?v=20260918-3'
    j, count = re.subn(pattern, replacement, j, count=1)
    assert count == 1, (filename, count)
js.write_text(j, encoding='utf-8')

html = Path('rates.html')
h = html.read_text(encoding='utf-8')
h, count = re.subn(r'assets/rates\.min\.js\?v=\d{8}-\d+', 'assets/rates.min.js?v=20260918-3', h, count=1)
assert count == 1, count
html.write_text(h, encoding='utf-8')

print('handset plan availability policy applied')
