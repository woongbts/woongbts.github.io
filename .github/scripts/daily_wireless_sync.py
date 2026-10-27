import collections
import copy
import json
import os
import pathlib
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from official_support import verified_lgu_support
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = os.environ.get("WIRELESS_SOURCE_BASE_URL", "").strip().rstrip("/")
if not ROOT:
    ROOT = "https://www.xeronote.co.kr"
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
# Store-specific exceptions are separated from public-source data.
STORE_OVERRIDES_PATH = pathlib.Path("data/store-overrides.json")
if not STORE_OVERRIDES_PATH.exists():
    raise SystemExit("data/store-overrides.json missing")
_store_overrides = json.loads(STORE_OVERRIDES_PATH.read_text(encoding="utf-8"))
PINNED_DEVICE_META = copy.deepcopy(_store_overrides.get("pinned_devices") or {})
PINNED_MODEL_CODES = set(PINNED_DEVICE_META)
PREORDER_MODELS = copy.deepcopy(_store_overrides.get("preorder_models") or {})


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


def valid_public_support(amount, retail_price):
    return type(amount) is int and type(retail_price) is int and retail_price > 0 and 0 <= amount <= retail_price


def verified_primary_or_official_support(raw_support, retail_price, carrier, model_code,
                                        plan_name, monthly_fee, join_type,
                                        official_lookup=verified_lgu_support):
    """Return (amount, corrected). Never interpret a missing or invalid amount as zero.

    The Zeronote feed is primary. If its amount is invalid for LGU+, official
    verification is optional: unavailable carrier systems cannot block the
    entire Zeronote import, and must not fabricate a replacement subsidy.
    """
    amount = money(raw_support)
    if amount is None:
        return None, False
    if valid_public_support(amount, retail_price):
        return amount, False
    if carrier != "LGU+":
        raise RuntimeError(f"invalid Zeronote subsidy: {carrier} {model_code} {plan_name} {join_type}")
    try:
        corrected = official_lookup(model_code, retail_price, plan_name, monthly_fee, join_type)
        if valid_public_support(corrected, retail_price):
            return corrected, True
    except Exception as exc:
        print(f"[WARN] LGU+ external verification unavailable ({type(exc).__name__}); "
              f"omit unverified subsidy for {model_code} / {join_type}", flush=True)
    return None, False




def clean(value):
    return " ".join(str(value or "").replace("\t", " ").split())


def valid_device_price(price, model_code):
    limit = int((PREORDER_MODELS.get(model_code) or {}).get("max_retail_price", 5000000))
    return type(price) is int and 0 < price <= limit


def preorder_enabled(device, today=TODAY_DATE):
    """Use the source's *carrier-specific* model code, including SKT IP_DUO_*.

    Preorders are visible only from their approved start date and only when
    the source release date exactly matches a configured model. SKT Duo's
    published IP_DUO_* codes must not be confused with earlier A3720 placeholders.
    """
    rule = PREORDER_MODELS.get(clean(device.get("device_name"))) or {}
    return (bool(rule) and rule.get("starts_on", "9999-12-31") <= today.isoformat()
            and clean(device.get("release_dt")) == rule.get("release_on"))


def select_current_devices(raw_devices, carrier, today=TODAY_DATE):
    """Defer source rows that cannot be sold today; reconsider on every run.

    Do not loosen price validation or invent a price to accept a source row.
    Dataset-level completeness checks still fail closed after this filtering.
    """
    candidates, deferred = [], []
    cutoff = (today - timedelta(days=RECENT_DEVICE_DAYS)).isoformat()
    for order, device in enumerate(raw_devices, 1):
        release = clean(device.get("release_dt"))
        price = money(device.get("factory_price"))
        model_code = clean(device.get("device_name"))
        reason = None
        try:
            release_date = datetime.strptime(release, "%Y-%m-%d").date()
        except ValueError:
            reason = "invalid_release_date"
        else:
            if release_date > today and not preorder_enabled(device, today):
                reason = "not_released_yet"
            elif release < cutoff and model_code not in PINNED_MODEL_CODES:
                continue
        if reason is None and not valid_device_price(price, model_code):
            reason = "retail_price_out_of_range"
        if reason:
            deferred.append({
                "carrier": carrier, "source_id": str(device.get("device_idx") or ""),
                "name": clean(device.get("model_name")), "model_code": model_code,
                "release_date": release, "retail_price": price, "reason": reason,
            })
        else:
            candidates.append((order, device))
    return candidates, deferred


def clean_plan_text(value):
    # Collapse repeated + separators from public plan feeds.
    return re.sub(r"\+{2,}", "+", clean(value))


def eligible_rows(rows):
    return [
        row
        for row in (rows or [])
        if str(row.get("join_yn", "")).upper() != "N"
        and str(row.get("except_yn", "")).upper() != "Y"
    ]


def handset_plan_rows(rows):
    blocked = (
        "아웃도어",
        "tab",
        "태블릿",
        "테블릿",
        "함께쓰기",
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
        "wearable",
        "웨어러블",
        "데이터나눠쓰기",
    )
    result = []
    for row in eligible_rows(rows):
        name = clean(row.get("plan_name")).lower().replace(" ", "")
        if re.search(r"(^|[^a-z0-9])[23]g([^a-z0-9]|$)", name, re.IGNORECASE):
            continue
        if any(token in name for token in blocked):
            continue
        result.append(row)
    return result


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
    stale = [
        device.get("id")
        for device in devices
        if str(device.get("release_date") or "") < RECENT_DEVICE_CUTOFF
        and clean(device.get("model_code")) not in PINNED_MODEL_CODES
    ]
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
        normalized_name = clean(plan.get("name")).lower().replace(" ", "")
        if re.search(r"(^|[^a-z0-9])[23]g([^a-z0-9]|$)", normalized_name, re.IGNORECASE):
            raise RuntimeError(f"legacy 2G/3G plan leaked into public catalog: {pid} {plan.get('name')}")
        blocked_plan_tokens = (
            "아웃도어", "tab", "태블릿", "테블릿", "함께쓰기", "watch", "워치", "포켓파이",
            "스마트기기", "데이터함께쓰기", "데이터쉐어링", "데이터셰어링",
            "아이패드", "ipad", "세컨드디바이스", "2nddevice", "wearable", "웨어러블", "데이터나눠쓰기",
        )
        if any(token in normalized_name for token in blocked_plan_tokens):
            raise RuntimeError(f"non-handset plan leaked into public catalog: {pid} {plan.get('name')}")

    device_ids = set()
    for device in devices:
        did = device.get("id")
        if not did:
            raise RuntimeError("device without id")
        device_ids.add(did)
        price = device.get("retail_price")
        if not valid_device_price(price, clean(device.get("model_code"))):
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
            if not all(valid_public_support(amount, next(d["retail_price"] for d in devices if d["id"] == did)) for did in ids):
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
    official_corrections = 0
    unverified_support_skipped = 0
    lgu_official_disabled = False
    deferred_devices = []

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
        candidates, deferred = select_current_devices(raw_devices, carrier)
        deferred_devices.extend(deferred)
        for item in deferred:
            print("[DEFERRED] " + json.dumps(item, ensure_ascii=False), flush=True)

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
                    "sort_type": "NONE",
                    "join_type": join_code,
                    "join_flag": "ABLE",
                    "plan_idx": "",
                    "keyword": "",
                }
                if network and network != "ALL":
                    params["network_type"] = network
                rows = get_json("/api/data/get_mobile_plan_list.php", params).get("data") or []
                by_join[join_label] = handset_plan_rows(rows)
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
                    raw_support = plan.get(support_field)
                    primary_amount = money(raw_support)
                    price = money(device.get("factory_price"))
                    if carrier == "LGU+" and lgu_official_disabled and primary_amount is not None and not valid_public_support(primary_amount, price):
                        # Access-denied official data must not trigger repeated remote calls.
                        support, corrected = None, False
                    else:
                        try:
                            support, corrected = verified_primary_or_official_support(
                                raw_support, price, carrier, clean(device.get("device_name")),
                                clean(plan.get("plan_name")), money(plan.get("price")), join_label,
                            )
                        except RuntimeError:
                            raise
                        if carrier == "LGU+" and primary_amount is not None and not valid_public_support(primary_amount, price) and support is None:
                            lgu_official_disabled = True
                    if support is not None:
                        amounts[plan_id] = support
                        if corrected:
                            official_corrections += 1
                    elif primary_amount is not None:
                        unverified_support_skipped += 1
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
                    "data": clean_plan_text(plan.get("data")),
                    "voice": clean_plan_text(plan.get("voice")),
                    "sms": clean_plan_text(plan.get("sms")),
                    "video": clean_plan_text(plan.get("video")),
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
            model_code = clean(device.get("device_name"))
            preorder_rule = PREORDER_MODELS.get(model_code)
            if preorder_rule:
                current_device = all_devices[-1]
                current_device["source_name"] = current_device["name"]
                current_device["name"] = preorder_rule["display_name"]
                if current_device["release_date"] > TODAY:
                    current_device["sale_status"] = "preorder"
                    current_device["name"] += " (사전예약)"
                    current_device["preorder_starts_on"] = preorder_rule["starts_on"]
                    current_device["preorder_release_date"] = preorder_rule["release_on"]
            if model_code in PINNED_DEVICE_META:
                all_devices[-1].update(copy.deepcopy(PINNED_DEVICE_META[model_code]))
            per_device_support[(carrier, device_id)] = support_by_join

    carrier_order = {"SKT": 0, "KT": 1, "LGU+": 2}
    plans = sorted(
        all_plans.values(),
        key=lambda plan: (
            carrier_order.get(plan.get("carrier"), 9),
            int(plan.get("source_order") or 999999),
            plan.get("name") or "",
        ),
    )

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
    status = {
        "checked_at": datetime.now(ZoneInfo("Asia/Seoul")).isoformat(timespec="seconds"),
        "source": ROOT, "result": "validated", "counts": new_counts,
        "devices_by_carrier": by_carrier, "deferred_devices": deferred_devices,
        "run_id": os.environ.get("GITHUB_RUN_ID", ""),
        "unverified_subsidy_entries_skipped": unverified_support_skipped,
    }
    (BASE / "wireless-sync-status.json").write_text(
        json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write(f"\n### 제로노트 수집 상태\n\n확인: {status['checked_at']}\n\n"
                         f"기종 {new_counts['devices']}개 / 요금제 {new_counts['plans']}개 / "
                         f"지원금 스케줄 {new_counts['supports']}개\n\n"
                         f"출시 예정·검증 보류: {len(deferred_devices)}개 "
                         "(매 실행마다 다시 확인, 상세 내역은 wireless-sync-status.json)\n")

    print(
        json.dumps(
            {
                "date": TODAY,
                "old": old_counts,
                "new": new_counts,
                "devices_by_carrier": by_carrier,
                "result": "validated",
                "official_support_entries_corrected": official_corrections,
                "unverified_subsidy_entries_skipped": unverified_support_skipped,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
