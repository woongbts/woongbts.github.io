"""Read public carrier support when the primary feed contains an invalid amount."""
import json
import re
import urllib.parse
import urllib.request
from functools import lru_cache

BASE = "https://www.lguplus.com"
JOIN_CODES = {"기기변경": "1", "번호이동": "2", "신규가입": "3"}


def normalized_plan(value):
    return re.sub(r"\s+", "", str(value or "").lower()).replace("uth", "유쓰")


def normalized_model(value):
    return re.sub(r"1t$", "1TB", str(value or "").upper().replace(" ", ""), flags=re.I)


def valid_public_support(amount, price):
    return type(amount) is int and type(price) is int and price > 0 and 0 <= amount <= price


def get_public_json(path, params):
    request = urllib.request.Request(
        BASE + path + "?" + urllib.parse.urlencode(params),
        headers={"User-Agent": "Mozilla/5.0 Chrome/140 Safari/537.36",
                 "Referer": BASE + "/mobile/financing-model", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        data = json.load(response)
    if not isinstance(data, dict):
        raise RuntimeError("invalid official support response")
    return data


@lru_cache(maxsize=1)
def official_plans():
    data = get_public_json("/uhdc/fo/prdv/mdlbsufu/v1/mdlb-pp-list", {"hphnPpGrpKwrdCd": "00"})
    return [p for group in data.get("dvicMdlbSufuPpList", [])
            for p in group.get("dvicMdlbSufuPpDetlList", [])]


@lru_cache(maxsize=64)
def official_rows(plan_code, join_type, keyword):
    params = {"onlnOrdrPsblEposDivsCd": "N", "urcHphnEntrPsblKdCd": JOIN_CODES[join_type],
              "urcMblPpCd": plan_code, "shwd": keyword, "sortOrd": "01",
              "urcWlcmAplyDivsCd": "NONE", "pageNo": 1, "rowSize": 100}
    data = get_public_json("/uhdc/fo/prdv/mdlbsufu/v2/mdlb-sufu-list", params)
    rows = data.get("dvicMdlbSufuDtoList", [])
    if int(data.get("totalCnt", 0)) > len(rows):
        raise RuntimeError("official support result was truncated")
    return rows


def verified_lgu_support(model_code, price, plan_name, monthly_fee, join_type):
    plans = [p for p in official_plans()
             if normalized_plan(p.get("urcMblPpNm")) == normalized_plan(plan_name)
             and str(p.get("urcPpBasfAmt")) == str(monthly_fee)]
    codes = {p["urcMblPpCd"] for p in plans}
    if len(codes) != 1:
        raise RuntimeError("official plan could not be matched unambiguously")
    # Exact model code determines the result; the family keyword just limits the response.
    keyword = re.match(r"SM-S\d+", model_code)
    keyword = keyword.group(0) if keyword else model_code
    rows = official_rows(next(iter(codes)), join_type, keyword)
    matches = [r for r in rows if normalized_model(r.get("urcTrmMdlCd")) == normalized_model(model_code)
               and r.get("dlvrPrc") == price]
    if len(matches) != 1:
        raise RuntimeError("official device could not be matched unambiguously")
    row = matches[0]
    # Carrier support only: never include the online store's distribution subsidy or total.
    amount = row.get("basicPlanPuanSuptAmt")
    if not valid_public_support(amount, price) or amount != row.get("sixPlanPuanSuptAmt"):
        raise RuntimeError("official support requires a different retention condition")
    return amount

