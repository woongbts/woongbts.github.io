"""Publish customer-safe subsidy changes and full semantic monitoring stats."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from report_wireless_changes import flatten_supports

CARRIERS = ('SKT', 'KT', 'LGU+')
# The complete verified amount-change count is retained in the metadata.
# Keep the customer popup readable: at most one plan per handset and join
# type, and up to this many examples from each carrier.
MAX_NOTICE_PER_CARRIER = 16


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
    # Only compare monetary values which were verified in BOTH published
    # snapshots. Missing support records are 'unknown', never a 0-won change.
    # No external source failure may be converted to a customer claim.
    candidates = []
    for carrier, did, join, pid in sorted(set(old) & set(new)):
        before, after = old[(carrier, did, join, pid)], new[(carrier, did, join, pid)]
        if before == after or carrier not in CARRIERS:
            continue
        device = devices.get(did)
        plan = plan_map.get(pid)
        if not device or not plan or device.get('carrier') != carrier or plan.get('carrier', carrier) != carrier:
            continue
        fee = plan.get('monthly_fee')
        if type(fee) is not int or fee < 0:
            continue
        # Retain the future-device guard for records supplied before launch.
        if '아이폰 17' in device.get('name', '') and '(NEW)' in device.get('name', '') and checked_on < '2026-10-01':
            continue
        candidates.append({
            'carrier': carrier, 'device_id': did, 'device': device.get('name') or device.get('model_code') or did,
            'plan_id': pid, 'plan': plan.get('name') or pid, 'monthly_fee': fee,
            'join': join, 'before': before, 'after': after,
            '_release': device.get('release_date') or '',
        })
    # Prefer major changes, with recent devices as a tiebreaker. Show a
    # representative plan for each affected handset/join without flooding
    # a customer's phone with nearly identical tariff variations.
    candidates.sort(key=lambda row: (
        -abs(row['after'] - row['before']),
        -int((row['_release'] or '0000')[:4] or 0),
        row['carrier'], row['device'], row['join'], row['plan_id'],
    ))
    changes = []
    seen = set()
    per_carrier = {carrier: 0 for carrier in CARRIERS}
    for row in candidates:
        key = (row['carrier'], row['device_id'], row['join'])
        if key in seen or per_carrier[row['carrier']] >= MAX_NOTICE_PER_CARRIER:
            continue
        seen.add(key)
        per_carrier[row['carrier']] += 1
        changes.append({k: v for k, v in row.items() if not k.startswith('_')})
    if not changes and previous:
        result = dict(previous)
        result['refresh_change_count'] = 0
        result['notice_total_count'] = 0
        result['checked_on'] = checked_on
        result.update(stats)
        return result
    # Include every verified amount delta in the revision hash even when
    # the popup can only show a representative subset.
    revision_basis = {
        'date': checked_on,
        'deltas': [(r['carrier'], r['device_id'], r['join'], r['plan_id'], r['before'], r['after']) for r in candidates],
    }
    revision = hashlib.sha256(json.dumps(revision_basis, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    return {'version': 1, 'id': revision, 'date': checked_on, 'checked_on': checked_on,
            'changes': changes, 'refresh_change_count': len(changes),
            'notice_total_count': len(candidates), **stats}


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
