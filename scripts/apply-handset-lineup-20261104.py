#!/usr/bin/env python3
"""Safely apply already verified NEW-only model visibility to public data.

This trims retired device IDs from the catalogue and support-rule memberships.
It never fabricates or changes a price, subsidy amount, plan, or eligibility.
"""
from pathlib import Path
import json
import sys

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE / ".github" / "scripts"))
from handset_model_policy import catalog_device_is_retired

CATALOG = BASE / "data" / "catalog.json"
SUPPORT = BASE / "data" / "supports.json"


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    support = json.loads(SUPPORT.read_text(encoding="utf-8"))
    original = catalog["devices"]
    removed = [d for d in original if catalog_device_is_retired(d)]
    kept = [d for d in original if not catalog_device_is_retired(d)]
    ids = {d["id"] for d in kept}
    print("retired variants hidden:", len(removed), {c:sum(x["carrier"]==c for x in removed) for c in ("SKT","KT","LGU+")})
    if len(kept) < 100 or len(removed) < 10:
        raise ValueError("Unexpected model filter count: check actual data before any write")

    for carrier in ("SKT", "KT", "LGU+"):
        a18 = [d for d in kept if d["carrier"]==carrier and d.get("name")=="갤럭시 A18 LTE"]
        if len(a18) != 1 or a18[0]["retail_price"] != 425700:
            raise ValueError("Missing verified A18 for " + carrier)
        if sum(d["carrier"]==carrier for d in kept) < 25:
            raise ValueError("Carrier completeness failed: " + carrier)

    # SKT A18 needs the public SKT 33,000-won plan and a plan-specific
    # support rule, not an estimated/invented amount.
    sk = next(d for d in kept if d["carrier"]=="SKT" and d["name"]=="갤럭시 A18 LTE")
    if "SKT-XP-969" not in sk.get("eligible_plan_ids_by_join_type",{}).get("번호이동",[]):
        raise ValueError("A18 cannot use requested T Plan Save / MNP")
    rules = support.get("support_schedules") or []
    matched = [r for r in rules if sk["id"] in r.get("device_ids",[])
       and "번호이동" in r.get("join_types",[])
       and isinstance((r.get("amounts") or {}).get("SKT-XP-969"), int)]
    if not matched:
        raise ValueError("No verified support amount for A18 T Plan Save")

    adjusted = []
    for rule in rules:
        pruned = [i for i in rule["device_ids"] if i in ids]
        if pruned:
            rule["device_ids"] = pruned
            adjusted.append(rule)
    if not adjusted or any(i not in ids for r in adjusted for i in r["device_ids"]):
        raise ValueError("Invalid support rules after pruning")

    catalog["devices"] = kept
    support["support_schedules"] = adjusted
    catalog["meta"]["updated_at"] = "2026-11-04"
    catalog["meta"]["model_visibility_note"] = "S26/17 series: only carrier-verified NEW price SKUs. A18 LTE: 3 carriers, 425,700원."
    support["meta"]["updated_at"] = "2026-11-04"
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",",":")),encoding="utf-8")
    SUPPORT.write_text(json.dumps(support, ensure_ascii=False, separators=(",",":")),encoding="utf-8")
    print("updated public catalogue:",len(kept),"devices; support schedules:",len(adjusted))
    print("SKT A18: SKU",sk["model_code"],"verified T Plan Save/MNP support:",matched[0]["amounts"]["SKT-XP-969"])
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
