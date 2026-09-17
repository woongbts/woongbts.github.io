import collections
import copy
import json
import os
import pathlib
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.environ.get("WIRELESS_SOURCE_BASE_URL", "").strip().rstrip("/")
if not ROOT:
    import base64
    ROOT = base64.b64decode("aHR0cHM6Ly93d3cueGVyb25vdGUuY28ua3I=").decode("utf-8").rstrip("/")
if not ROOT.startswith("https://"):
    raise SystemExit("WIRELESS_SOURCE_BASE_URL is invalid")

REF = ROOT + "/consult/mobile.php"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
CARRIERS = [("SKT", "SKT", "SKT"), ("KT", "KT", "KT"), ("LGUPLUS", "LGU+", "LG")]
JOIN_QUERIES = [
    ("기기변경", "CHANGE", "support_money_change"),
    ("번호이동", "MNP", "support_money_mnp"),
    ("신규가입", "NEW", "support_money"),
]
BASE = pathlib.Path("data")
TODAY_DATE = datetime.now(ZoneInfo("Asia/Seoul")).date()
TODAY = TODAY_DATE.isoformat()
RECENT_DEVICE_DAYS = 365
RECENT_DEVICE_CUTOFF = (TODAY_DATE - timedelta(days=RECENT_DEVICE_DAYS)).isoformat()


def get_json(path, params=None, attempts=4):
    url = ROOT + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": UA,
                    "Accept": "application/json,text/plain,*/*",
                    "Referer": REF,
                },
            )
            with urllib.request.urlopen(req, timeout=35) as response:
                raw = response.read().decode("utf-8-sig")
                data = json.loads(raw)
                if not isinstance(data, dict):
                    raise ValueError("unexpected source response")
                return data
        except Exception as exc:
            last = exc
            time.sleep(1.0 + attempt * 0.8)
    raise RuntimeError(f"source request failed: {path}") from last


def money(value):
    if value is None:
        return None
    text = str(value).replace(",", "").replace("원", "").strip()
    return int(text) if text.lstrip("-").isdigit() else None


def clean(value):
    return " ".join(str(value or "").replace("\t", " ").split())


def eligible_rows(rows):
    return [
        row
        for row in (rows or [])
        if str(row.get("join_yn", "")).upper() != "N"
        and str(row.get("except_yn", "")).upper() != "Y"
    ]


def load(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def comparable(obj):
    value = copy.deepcopy(obj)
    if isinstance(value, dict) and isinstance(value.get("meta"), dict):
        value["meta"].pop("updated_at", None)
    return value


def preserve_date_if_unchanged(new_obj, old_obj):
    if comparable(new_obj) == comparable(old_obj):
        old_date = (old_obj.get("meta") or {}).get("updated_at")
        if old_date:
            new_obj.setdefault("meta", {})["updated_at"] = old_date


def count_by_carrier(devices):
    result = collections.Counter()
    for device in devices:
        result[device.get("carrier")] += 1
    return dict(result)


def validate_dataset(old_catalog, old_plans, old_supports, catalog, plan_data, supports):
    devices = catalog.get("devices") or []
    plans = plan_data.get("mobile_plans") or []
    schedules = supports.get("support_schedules") or []
    if not devices or not plans or not schedules:
        raise RuntimeError("new dataset is empty")

    old_counts = {
        "devices": len(old_catalog.get("devices") or []),
        "plans": len(old_plans.get("mobile_plans") or []),
        "supports": len(old_supports.get("support_schedules") or []),
    }
    new_counts = {
        "devices": len(devices),
        "plans": len(plans),
        "supports": len(schedules),
    }
    floors = {"devices": 0.10, "plans": 0.65, "supports": 0.05}
    minimums = {"devices": 30, "plans": 20, "supports": 20}
    for key in new_counts:
        old = old_counts[key]
        required = max(minimums[key], int(old * floors[key])) if old else minimums[key]
        if new_counts[key] < required:
            raise RuntimeError(
                f"suspicious {key} drop: old={old} new={new_counts[key]} required>={required}"
            )

    new_carriers = count_by_carrier(devices)
    for carrier in ("SKT", "KT", "LGU+"):
        if new_carriers.get(carrier, 0) < 15:
            raise RuntimeError(f"too few {carrier} recent devices: {new_carriers.get(carrier, 0)}")
    stale = [device.get("id") for device in devices if str(device.get("release_date") or "") < RECENT_DEVICE_CUTOFF]
    if stale:
        raise RuntimeError(f"stale devices leaked into public catalog: {stale[:5]}")

    plan_ids = set()
    for plan in plans:
        pid = plan.get("id")
        if not pid:
            raise RuntimeError("plan without id")
        plan_ids.add(pid)
        fee = plan.get("monthly_fee")
        if fee is not None and not (0 <= int(fee) <= 300000):
            raise RuntimeError(f"invalid monthly fee: {pid}={fee}")

    device_ids = set()
    for device in devices:
        did = device.get("id")
        if not did:
            raise RuntimeError("device without id")
        device_ids.add(did)
        price = device.get("retail_price")
        if price is None or not (0 < int(price) <= 5000000):
            raise RuntimeError(f"invalid retail price: {did}={price}")
        for join_type, ids in (device.get("eligible_plan_ids_by_join_type") or {}).items():
            if join_type not in {"기기변경", "번호이동", "신규가입"}:
                raise RuntimeError(f"unknown join type: {join_type}")
            unknown = [pid for pid in ids if pid not in plan_ids]
            if unknown:
                raise RuntimeError(f"unknown eligible plan id for {did}: {unknown[:3]}")

    known_by_carrier_join = collections.Counter()
    for schedule in schedules:
        ids = schedule.get("device_ids") or []
        if any(did not in device_ids for did in ids):
            raise RuntimeError("support schedule references unknown device")
        amounts = schedule.get("amounts") or {}
        for pid, amount in amounts.items():
            if pid not in plan_ids:
                raise RuntimeError(f"support schedule references unknown plan: {pid}")
            if amount is None or not (0 <= int(amount) <= 5000000):
                raise RuntimeError(f"invalid public support: {pid}={amount}")
        carrier = schedule.get("carrier")
        for join_type in schedule.get("join_types") or []:
            if amounts:
                known_by_carrier_join[(carrier, join_type)] += 1

    for carrier in ("SKT", "KT", "LGU+"):
        for join_type in ("기기변경", "번호이동", "신규가입"):
            if known_by_carrier_join[(carrier, join_type)] < 1:
                raise RuntimeError(f"no verified support rows: {carrier} {join_type}")

    public_dump = json.dumps(
        {"catalog": catalog, "plans": plan_data, "supports": supports},
        ensure_ascii=False,
    ).lower()
    forbidden = ("리베이트", "판매점 수수료", "정산금", "dealer_fee", "commission")
    for word in forbidden:
        if word.lower() in public_dump:
            raise RuntimeError(f"forbidden internal field leaked: {word}")

    return old_counts, new_counts, new_carriers


def main():
    old_catalog = load(BASE / "catalog.json")
    old_plans = load(BASE / "plans.json")
    old_supports = load(BASE / "supports.json")

    all_devices = []
    all_plans = {}
    per_device_support = {}

    for api_carrier, carrier, prefix in CARRIERS:
        device_payload = get_json(
            "/api/data/get_device_list.php",
            {
                "telecom_id": api_carrier,
                "manufacturer_id": "",
                "sort_type1": "PHONE",
                "sort_type2": "RELEASE_DT_DESC",
                "keyword": "",
                "search_group": "",
                "search_support_mnp": "",
            },
        )
        raw_devices = device_payload.get("data") or []
        candidates = []
        for order, device in enumerate(raw_devices, 1):
            price = money(device.get("factory_price"))
            release = clean(device.get("release_dt"))
            if price is None or price <= 0 or release in ("", "0000-00-00"):
                continue
            # Source order is RELEASE_DT_DESC. Keep recent devices only so legacy stock
            # cannot leak back into customer calculators or recommendations.
            if release < RECENT_DEVICE_CUTOFF:
                continue
            candidates.append((order, device))

        def fetch_device(item):
            order, device = item
            source_id = str(device.get("device_idx") or "")
            if not source_id:
                raise RuntimeError("device id missing")
            init = get_json(
                "/api/data/get_consult_init.php",
                {
                    "telecom_id": api_carrier,
                    "device_idx": source_id,
                    "consult_mode": "",
                    "plan_idx": "",
                },
            ).get("data") or {}
            network = clean(init.get("network_type"))
            by_join = {}
            for join_label, join_code, _field in JOIN_QUERIES:
                params = {
                    "telecom_id": api_carrier,
                    "device_idx": source_id,
                    "plan_group": "",
                    "sort_type": "",
                    "join_type": join_code,
                    "join_flag": "ABLE",
                    "plan_idx": "",
                    "keyword": "",
                }
                if network and network != "ALL":
                    params["network_type"] = network
                rows = get_json("/api/data/get_mobile_plan_list.php", params).get("data") or []
                by_join[join_label] = eligible_rows(rows)
            return order, device, init, by_join

        results = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(fetch_device, item) for item in candidates]
            for future in as_completed(futures):
                results.append(future.result())
        results.sort(key=lambda row: row[0])

        for order, device, init, by_join in results:
            union_by_source_id = {}
            eligible_by_join = {}
            support_by_join = {}
            for join_label, _join_code, support_field in JOIN_QUERIES:
                rows = by_join.get(join_label, [])
                ids = []
                amounts = {}
                for plan_order, plan in enumerate(rows, 1):
                    raw_plan_id = str(plan.get("plan_idx") or "")
                    if not raw_plan_id:
                        continue
                    plan_id = f"{prefix}-XP-{raw_plan_id}"
                    ids.append(plan_id)
                    union_by_source_id.setdefault(raw_plan_id, (plan_order, plan))
                    support = money(plan.get(support_field))
                    if support is not None:
                        amounts[plan_id] = support
                eligible_by_join[join_label] = ids
                support_by_join[join_label] = amounts

            if not union_by_source_id:
                continue

            source_device_id = str(device.get("device_idx"))
            device_id = f"{prefix}-XD-{source_device_id}"
            eligible_union = []
            for join_label, _join_code, _field in JOIN_QUERIES:
                for plan_id in eligible_by_join[join_label]:
                    if plan_id not in eligible_union:
                        eligible_union.append(plan_id)

            for raw_plan_id, (plan_order, plan) in union_by_source_id.items():
                plan_id = f"{prefix}-XP-{raw_plan_id}"
                fee = money(plan.get("price"))
                current = all_plans.get(plan_id)
                candidate = {
                    "id": plan_id,
                    "carrier": carrier,
                    "name": clean(plan.get("plan_name")),
                    "monthly_fee": fee,
                    "data": clean(plan.get("data")),
                    "voice": clean(plan.get("voice")),
                    "sms": clean(plan.get("sms")),
                    "video": clean(plan.get("video")),
                    "age_limit": clean(plan.get("age_limit")),
                    "network_type": clean(init.get("network_type")),
                    "source_order": plan_order,
                }
                if current is None:
                    all_plans[plan_id] = candidate
                else:
                    current["source_order"] = min(
                        int(current.get("source_order") or plan_order), plan_order
                    )
                    for key in (
                        "monthly_fee",
                        "data",
                        "voice",
                        "sms",
                        "video",
                        "age_limit",
                        "network_type",
                    ):
                        if current.get(key) in (None, "") and candidate.get(key) not in (None, ""):
                            current[key] = candidate[key]

            all_devices.append(
                {
                    "id": device_id,
                    "carrier": carrier,
                    "name": clean(device.get("model_name")),
                    "model": "",
                    "model_code": clean(device.get("device_name")),
                    "manufacturer": clean(device.get("manufacturer_name")),
                    "release_date": clean(device.get("release_dt")),
                    "retail_price": money(device.get("factory_price")),
                    "factory_price_date": clean(device.get("factory_price_dt")),
                    "announce_date": clean(device.get("announce_dt")),
                    "network_type": clean(init.get("network_type")),
                    "source_order": order,
                    "installment_months": [24, 30, 36],
                    "eligible_plan_ids": eligible_union,
                    "eligible_plan_ids_by_join_type": eligible_by_join,
                }
            )
            per_device_support[(carrier, device_id)] = support_by_join

    plans = list(all_plans.values())
    for carrier in ("SKT", "KT", "LGU+"):
        rows = [plan for plan in plans if plan.get("carrier") == carrier]
        rows.sort(key=lambda plan: (-(plan.get("monthly_fee") or 0), plan.get("name") or ""))
        for index, plan in enumerate(rows, 1):
            plan["source_order"] = index

    raw_rules = []
    for carrier in ("SKT", "KT", "LGU+"):
        for join_type in ("기기변경", "번호이동", "신규가입"):
            groups = collections.defaultdict(lambda: {"amounts": None, "devices": []})
            for (item_carrier, device_id), joins in per_device_support.items():
                if item_carrier != carrier:
                    continue
                amounts = joins.get(join_type, {})
                signature = json.dumps(
                    amounts, sort_keys=True, separators=(",", ":"), ensure_ascii=False
                )
                groups[signature]["amounts"] = amounts
                groups[signature]["devices"].append(device_id)
            for group in groups.values():
                raw_rules.append(
                    {
                        "carrier": carrier,
                        "device_ids": sorted(group["devices"]),
                        "join_types": [join_type],
                        "amounts": group["amounts"],
                    }
                )

    merged = {}
    for rule in raw_rules:
        key = (
            rule["carrier"],
            tuple(rule["device_ids"]),
            json.dumps(rule["amounts"], sort_keys=True, separators=(",", ":"), ensure_ascii=False),
        )
        if key not in merged:
            merged[key] = {
                "carrier": rule["carrier"],
                "device_ids": rule["device_ids"],
                "join_types": [],
                "amounts": rule["amounts"],
            }
        merged[key]["join_types"].extend(rule["join_types"])

    support_schedules = list(merged.values())
    join_rank = {"기기변경": 0, "번호이동": 1, "신규가입": 2}
    for rule in support_schedules:
        rule["join_types"] = sorted(
            set(rule["join_types"]), key=lambda value: join_rank.get(value, 9)
        )
    support_schedules.sort(
        key=lambda rule: (
            rule.get("carrier") or "",
            (rule.get("device_ids") or [""])[0],
            join_rank.get((rule.get("join_types") or [""])[0], 9),
        )
    )

    catalog = {
        "meta": {
            "updated_at": TODAY,
            "status": "public-wireless-data-audited",
            "source_basis": "공개 무선상담 상품 데이터에서 가입유형별로 확인된 값만 반영",
            "notice": "출고가·가입가능 요금제·공시지원금은 확인된 값만 표시하며 추가지원금은 매장 문의로 안내합니다.",
        },
        "rules": old_catalog.get("rules", {}),
        "carriers": ["SKT", "KT", "LGU+"],
        "devices": all_devices,
        "mobile_plans": [],
        "mobile_supports": [],
        "mvno_plans": [],
        "internet_products": [],
        "welfare_types": old_catalog.get("welfare_types", []),
        "schema_guide": old_catalog.get("schema_guide", {}),
    }
    plan_data = {
        "meta": {
            "updated_at": TODAY,
            "note": "통신3사 공개 상담에서 현재 가입 가능한 요금제를 가입유형별로 확인해 반영합니다. 월정액은 확인된 표시값만 사용합니다.",
        },
        "selection_contract_rate": 0.25,
        "mobile_plans": plans,
    }
    supports = {
        "meta": {
            "updated_at": TODAY,
            "note": "기종·가입유형·요금제별로 확인된 공시지원금만 반영하며 추가지원금은 매장 문의로 안내합니다.",
            "unknown_behavior": "store_confirm",
        },
        "support_schedules": support_schedules,
    }

    old_counts, new_counts, by_carrier = validate_dataset(
        old_catalog, old_plans, old_supports, catalog, plan_data, supports
    )
    preserve_date_if_unchanged(catalog, old_catalog)
    preserve_date_if_unchanged(plan_data, old_plans)
    preserve_date_if_unchanged(supports, old_supports)

    (BASE / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (BASE / "plans.json").write_text(
        json.dumps(plan_data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (BASE / "supports.json").write_text(
        json.dumps(supports, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    print(
        json.dumps(
            {
                "date": TODAY,
                "old": old_counts,
                "new": new_counts,
                "devices_by_carrier": by_carrier,
                "result": "validated",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
