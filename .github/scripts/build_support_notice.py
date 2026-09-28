"""Publish reference-plan support changes, never unverified retail prices."""
import argparse
import hashlib
import json
from pathlib import Path
from report_wireless_changes import flatten_supports

REFERENCES = {'SKT': ('SKT-XP-2901', '베스트 109(T 우주)'),
              'KT': ('KT-XP-2582', '초이스110 폰케어'),
              'LGU+': ('LG-XP-1097', '플러스플랜115')}
JOINS = ['기기변경', '번호이동', '신규가입']


def build(old_supports, catalog, plans, supports, previous=None):
    day = supports['meta']['updated_at']
    old, new = flatten_supports(old_supports), flatten_supports(supports)
    plan_map = {p['id']: p for p in plans['mobile_plans']}
    devices = {d['id']: d for d in catalog['devices']}
    changes = []
    for carrier, (pid, expected_name) in REFERENCES.items():
        if pid not in plan_map or plan_map[pid]['name'] != expected_name:
            raise ValueError('Reference plan changed; verify customer notice configuration')
        for did, device in devices.items():
            if device['carrier'] != carrier:
                continue
            # Store-confirmed October applicability. Do not advertise future NEW SKUs in September.
            if '아이폰 17' in device['name'] and '(NEW)' in device['name'] and day < '2026-10-01':
                continue
            for join in JOINS:
                key = carrier, did, join, pid
                before, after = old.get(key), new.get(key)
                if before == after:
                    continue
                changes.append({'carrier': carrier, 'device_id': did, 'device': device['name'],
                                'plan': expected_name, 'monthly_fee': plan_map[pid]['monthly_fee'],
                                'join': join, 'before': before, 'after': after})
    if not changes and previous:
        result = dict(previous)
        result['checked_on'] = day
        return result
    content = {'date': day, 'changes': changes}
    revision = hashlib.sha256(json.dumps(content, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    return {'version': 1, 'id': revision, 'date': day, 'checked_on': day, 'changes': changes}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--old-supports', required=True)
    parser.add_argument('--output', default='data/support-notice.json')
    args = parser.parse_args()
    load = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
    path = Path(args.output)
    previous = load(path) if path.exists() else None
    result = build(load(args.old_supports), load('data/catalog.json'), load('data/plans.json'),
                   load('data/supports.json'), previous)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Customer notice: {len(result['changes'])} reference-plan changes; date={result['date']}")


if __name__ == '__main__':
    main()
