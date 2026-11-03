"""Store-facing Galaxy S26 / iPhone 17 NEW-only and verified A18 policy.

This is a catalogue visibility policy, not a price or subsidy policy.
A New retail SKU is identified by the carrier's actual public model code or
the name supplied by the verified source. Do not relabel old price SKUs.
"""
import re


def retire_old_variant(name, model_code):
    name = re.sub(r"\s+", "", str(name or "")).casefold()
    code = str(model_code or "").upper()
    is_s26_series = "갤럭시s26" in name and "s26fe" not in name
    is_iphone17_series = "아이폰17" in name
    if not (is_s26_series or is_iphone17_series):
        return False
    is_new = "(new)" in name or code.endswith("_NEW") or code.endswith("-NP")
    return not is_new


def source_row_is_retired(row):
    return retire_old_variant(row.get("model_name"), row.get("device_name"))


def catalog_device_is_retired(device):
    return retire_old_variant(device.get("name"), device.get("model_code"))
