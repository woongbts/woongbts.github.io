"""Publish customer-safe subsidy changes and full semantic monitoring stats."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from report_wireless_changes import flatten_supports

REFERENCES = {'SKT': ('SKT-XP-2901', '베스트 109(T 우주)'),
              'KT': ('KT-XP-2582', '초이스110 폰케어'),
              'LGU+': ('LG-XP-1097', '플러스플랜115')}
JOINS = ['기기변경', '번호이동', '신규가입']


def support_delta_stats(old, new):
    old_keys, new_keys = set(old), set(new)
    shared = old_keys & new_keys
    amount_changed = sum(1 for key in shared if old[key] != new[key])
    added = len(new_keys - old_keys)
    removed = len(old_keys - new_keys)
    return {
        'support_amount_change_count': amount_changed,
        'support_entry_added_count': added,
        'support_entry_removed_count': removed,
        'support_delta_count': amount_changed + added + removed,
    }


def build(old_supports, catalog, plans, supports, previous=None, checked_on=None):
    checked_on = checked_on or datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
    old, new = flatten_supports(old_supports), flatten_supports(supports)
    stats = support_delta_stats(old, new)
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
            if '아이폰 17' in device['name'] and '(NEW)' in device['name'] and checked_on < '2026-10-01':
                continue
            for join in JOINS:
                key = carrier, did, join, pid
                before, after = old.get(key), new.get(key)
                if before == after:
                    continue
                changes.append({'carrier': carrier, 'device_id': did, 'device': device['name'],
                                'plan_id': pid, 'plan': expected_name, 'monthly_fee': plan_map[pid]['monthly_fee'],
                                'join': join, 'before': before, 'after': after})
    if not changes and previous:
        result = dict(previous)
        result['refresh_change_count'] = 0
        result['checked_on'] = checked_on
        result.update(stats)
        return result
    content = {'date': checked_on, 'changes': changes}
    revision = hashlib.sha256(json.dumps(content, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    return {'version': 1, 'id': revision, 'date': checked_on, 'checked_on': checked_on,
            'changes': changes, 'refresh_change_count': len(changes), **stats}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--old-supports', required=True)
    parser.add_argument('--output', default='data/support-notice.json')
    args = parser.parse_args()
    load = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
    path = Path(args.output)
    previous = load(path) if path.exists() else None
    now = datetime.now(ZoneInfo('Asia/Seoul'))
    result = build(load(args.old_supports), load('data/catalog.json'), load('data/plans.json'),
                   load('data/supports.json'), previous, checked_on=now.date().isoformat())
    result['refresh_run_id'] = os.environ.get('GITHUB_RUN_ID')
    result['checked_at'] = now.isoformat(timespec='seconds')
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(
        'Support monitoring: '
        f"amount changes={result['support_amount_change_count']}, "
        f"entries added={result['support_entry_added_count']}, "
        f"entries removed={result['support_entry_removed_count']}, "
        f"customer notice changes={result['refresh_change_count']}; "
        f"checked_on={result['checked_on']}"
    )


if __name__ == '__main__':
    main()
