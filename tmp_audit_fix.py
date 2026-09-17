from pathlib import Path
import re

p=Path('tmp_ai_context_upgrade.py')
s=p.read_text(encoding='utf-8')
new='''def source_rows(pid):
    merged = {}
    for join_type in ("MNP", "NEW", "CHANGE"):
        for join_flag in ("ABLE", "MAIN"):
            try:
                rows = get_json("/api/data/get_mobile_plan_list.php", {
                    "telecom_id": pid, "device_idx": "", "plan_group": "USIM", "sort_type": "",
                    "join_type": join_type, "join_flag": join_flag, "plan_idx": "", "keyword": ""
                }).get("data") or []
            except Exception:
                continue
            for r in rows:
                if str(r.get("prepay_yn") or "").upper() != "Y":
                    continue
                idx = str(r.get("plan_idx") or "").strip()
                fee = money(r.get("monthly_fee"))
                if not idx or fee is None:
                    continue
                merged[idx] = {
                    "id": f"PRE-{pid}-{idx}",
                    "provider_id": pid,
                    "name": clean(r.get("plan_name")),
                    "network": {"MOBINGSKT":"SKT","FREETSKT":"SKT","MOBINGKT":"KT","FREETKT":"KT","MOBINGLG":"LGU+","FREETLG":"LGU+"}[pid],
                    "monthly_fee": fee,
                    "voice": clean(r.get("voice_offer")),
                    "sms": clean(r.get("sms_offer")),
                    "data": clean(r.get("data_offer")),
                }
    return list(merged.values())


def audit_prepaid():'''
s2,n=re.subn(r'def source_rows\(pid\):.*?\n\ndef audit_prepaid\(\):',new,s,flags=re.S)
if n!=1:
    raise SystemExit(f'patch count {n}')
p.write_text(s2,encoding='utf-8')
print('audit fixer applied')
