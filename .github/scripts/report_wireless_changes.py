#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

JOIN_ORDER = {"기기변경": 0, "번호이동": 1, "신규가입": 2}
CARRIER_ORDER = {"SKT": 0, "KT": 1, "LGU+": 2}


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def money(value):
    return f"{int(value):,}원"


def index_devices(catalog):
    return {row.get("id"): row for row in (catalog.get("devices") or []) if row.get("id")}


def index_plans(plans):
    return {row.get("id"): row for row in (plans.get("mobile_plans") or []) if row.get("id")}


def flatten_supports(supports):
    result = {}
    for rule in supports.get("support_schedules") or []:
        carrier = rule.get("carrier")
        for device_id in rule.get("device_ids") or []:
            for join_type in rule.get("join_types") or []:
                for plan_id, amount in (rule.get("amounts") or {}).items():
                    key = (carrier, device_id, join_type, plan_id)
                    if isinstance(amount, bool) or not isinstance(amount, int) or amount < 0:
                        raise ValueError(f"Invalid support amount: {key}")
                    if key in result and result[key] != amount:
                        raise ValueError(f"Conflicting support schedules: {key}")
                    result[key] = amount
    return result


def display_name(row, fallback):
    if not row:
        return fallback
    return row.get("name") or row.get("model_code") or fallback


def build_report(old_catalog, old_plans, old_supports, new_catalog, new_plans, new_supports):
    old_devices = index_devices(old_catalog)
    new_devices = index_devices(new_catalog)
    old_plan_rows = index_plans(old_plans)
    new_plan_rows = index_plans(new_plans)
    old_flat = flatten_supports(old_supports)
    new_flat = flatten_supports(new_supports)

    lines = ["## 무선 데이터 자동 갱신 변경내역",
             "", "비교 단위: 통신사·기종·가입유형·요금제 조합. 데이터 조회일 변경만으로 지원금 변동을 기록하지 않습니다."]

    added_devices = sorted(set(new_devices) - set(old_devices))
    removed_devices = sorted(set(old_devices) - set(new_devices))
    if added_devices or removed_devices:
        lines.append("")
        lines.append("### 단말기 데이터")
        for did in added_devices:
            row = new_devices[did]
            model = row.get("model_code") or "모델코드 없음"
            lines.append(f"- 신규: {row.get('carrier')} | {display_name(row, did)} | {model}")
        for did in removed_devices:
            row = old_devices[did]
            model = row.get("model_code") or "모델코드 없음"
            lines.append(f"- 삭제: {row.get('carrier')} | {display_name(row, did)} | {model}")

    added_plans = sorted(set(new_plan_rows) - set(old_plan_rows))
    removed_plans = sorted(set(old_plan_rows) - set(new_plan_rows))
    if added_plans or removed_plans:
        lines.append("")
        lines.append("### 요금제 데이터")
        for pid in added_plans:
            row = new_plan_rows[pid]
            lines.append(f"- 신규: {row.get('carrier')} | {display_name(row, pid)}")
        for pid in removed_plans:
            row = old_plan_rows[pid]
            lines.append(f"- 삭제: {row.get('carrier')} | {display_name(row, pid)}")

    changes = []
    for key in set(old_flat) | set(new_flat):
        old_value = old_flat.get(key)
        new_value = new_flat.get(key)
        if old_value == new_value:
            continue
        carrier, device_id, join_type, plan_id = key
        device = new_devices.get(device_id) or old_devices.get(device_id) or {}
        plan = new_plan_rows.get(plan_id) or old_plan_rows.get(plan_id) or {}
        changes.append((
            CARRIER_ORDER.get(carrier, 99),
            carrier or "?",
            display_name(device, device_id),
            JOIN_ORDER.get(join_type, 99),
            join_type or "?",
            display_name(plan, plan_id),
            plan_id,
            old_value,
            new_value,
        ))

    lines.append("")
    lines.append("### 공시지원금")
    if not changes:
        lines.append("- 공시지원금 변동 없음")
    else:
        changes.sort()
        for _, carrier, device_name, _, join_type, plan_name, _pid, old_value, new_value in changes:
            if old_value is None:
                detail = f"신규 등록 {money(new_value)}"
            elif new_value is None:
                detail = f"삭제 (기존 {money(old_value)})"
            else:
                arrow = "↑" if new_value > old_value else "↓"
                detail = f"{money(old_value)} → {money(new_value)} {arrow}"
            lines.append(f"- {carrier} | {device_name} | {join_type} | {plan_name} | {detail}")

    lines.append("")
    lines.append(
        f"변경 건수: 공시지원금 {len(changes)}건 · 단말기 신규 {len(added_devices)}건/삭제 {len(removed_devices)}건 · "
        f"요금제 신규 {len(added_plans)}건/삭제 {len(removed_plans)}건"
    )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--old-catalog", required=True)
    parser.add_argument("--old-plans", required=True)
    parser.add_argument("--old-supports", required=True)
    parser.add_argument("--new-catalog", required=True)
    parser.add_argument("--new-plans", required=True)
    parser.add_argument("--new-supports", required=True)
    parser.add_argument("--step-summary")
    parser.add_argument("--output", help="Full Markdown report for the workflow artifact")
    args = parser.parse_args()

    report = build_report(
        load(args.old_catalog),
        load(args.old_plans),
        load(args.old_supports),
        load(args.new_catalog),
        load(args.new_plans),
        load(args.new_supports),
    )
    print(report)
    if args.output:
        Path(args.output).write_text(report + "\n", encoding="utf-8")
    if args.step_summary:
        with Path(args.step_summary).open("a", encoding="utf-8") as handle:
            lines = report.splitlines()
            preview = lines if len(lines) <= 250 else lines[:245] + [
                "", "표시량을 줄였습니다. 전체 변경내역은 wireless-changes 첨부 파일에서 확인하세요.", lines[-1]]
            handle.write("\n".join(preview) + "\n")


if __name__ == "__main__":
    main()
