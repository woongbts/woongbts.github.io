"""Import the public Zeronote card feed. Publish a complete snapshot or nothing.

Run monthly on the 5th (Asia/Seoul), and manually when a policy changes.
The source's discount field can mix basic and promotional caps; retain labels,
source terms and separate these rows rather than treating the largest as basic.
"""
import argparse
import concurrent.futures
import hashlib
import html
import json
import os
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

BASE = 'https://www.xeronote.co.kr'
CARRIERS = [('SKT', 'SKT'), ('KT', 'KT'), ('LGUPLUS', 'LGU+')]
KINDS = [('POST', 'CHARGE'), ('PRE', 'LIGHT'), ('PRE', 'SAVE')]


def clean(value):
    value = re.sub(r'<br\s*/?>', '\n', str(value or ''), flags=re.I)
    value = html.unescape(re.sub(r'<[^>]*>', '', value))
    return re.sub(r'\n{3,}', '\n\n', value.replace('\r', '')).strip()


def integer(value):
    return int(value) if str(value).isdigit() else None


def request(path, binary=False):
    url = urllib.parse.urljoin(BASE, path)
    if urllib.parse.urlparse(url).hostname != 'www.xeronote.co.kr':
        raise ValueError('Unexpected source host')
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0', 'Referer': BASE+'/consult/mobile.php'})
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = response.read(4_000_001)
            if len(raw) > 4_000_000:
                raise ValueError('Oversized card response')
            return raw if binary else json.loads(raw.decode('utf-8-sig'))
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)



# Xeronote explicitly marks some "included spend" sections unverified, while
# retaining detailed exclusions. Preserve genuine source inclusions when they
# appear in a later refresh. Only replace literal missing placeholders.
# Official rules checked 2026-10-17:
# SKT Hyundai: https://www.hyundaicard.com/HCSP/hdc_SKT_ed3_MSKTE3_2606.html
# LGU+ Hyundai: https://www.hyundaicard.com/cpu/ug/CPUUG2001_0405.hc?c=02904
# KB T-economy: https://card.kbcard.com/CRD/DVIEW/HCAMCXPRICAC0076?cooperationcode=04288&mainCC=a
# Hana U+ Family: https://m.hanacard.co.kr/MPACMM101M.web?CD_PD_SEQ=14109
SPEND_INCLUDED_OFFICIAL = {
    "68": "전월 1일~말일 국내외 일시불 및 할부 이용금액(아래 실적 제외 항목은 미포함). 할부금액은 이용월에 전액 합산하고, 교통·해외 등 무승인 거래는 매입 접수월에 반영. ※ 하나카드 공식 안내 기준",
    "80": "전월 1일~말일 국내외 일시불 및 할부 이용금액(아래 실적 제외 항목은 미포함). 할부금액은 이용월에 전액 합산하고, 교통·해외 등 무승인 거래는 매입 접수월에 반영. ※ 하나카드 공식 안내 기준",
    "218": "전월 1일~말일 본인·가족카드의 일시불 및 할부 이용금액(아래 실적 제외 항목은 미포함). 사후 승인 가맹점은 매출전표 접수월 기준. ※ 현대카드 공식 안내 기준",
    "224": "전월 1일~말일 본인·가족카드의 일시불 및 할부 이용금액(아래 실적 제외 항목은 미포함). 사후 승인 가맹점은 매출전표 접수월 기준. ※ 현대카드 공식 안내 기준",
    "243": "전월 1일~말일 본인·가족카드의 일시불 및 할부 승인금액(아래 실적 제외 항목은 미포함). 해외 이용분은 매입 완료 기준이며, 취소분은 취소전표 접수월에 차감. ※ KB국민카드 공식 안내 기준",
    "322": "전월 1일~말일 본인·가족카드의 일시불 및 할부 이용금액(아래 실적 제외 항목은 미포함). 사후 승인 가맹점은 매출전표 접수월 기준. ※ 현대카드 공식 안내 기준",
    "328": "전월 1일~말일 본인·가족카드의 일시불 및 할부 이용금액(아래 실적 제외 항목은 미포함). 사후 승인 가맹점은 매출전표 접수월 기준. ※ 현대카드 공식 안내 기준"
}
SPEND_INCLUDED_FALLBACK = "해당 카드의 일반 결제 이용금액 중 아래 ‘전월실적 미포함’ 항목에 해당하지 않는 금액(카드사에서 인정하는 거래에 한함).\n\n※ 포함되는 개별 업종과 해외·할부·교통·간편결제 인정 여부는 제공된 자료에 별도 기재되지 않아 카드사 상품설명서 확인이 필요합니다."

def normalize_spend_inclusion(conditions, card_idx):
    placeholder = r'■\s*전월\s*실적\s*포함\s*[:：]\s*미\s*확인'
    replacement = '■ 전월실적 포함 : ' + SPEND_INCLUDED_OFFICIAL.get(str(card_idx), SPEND_INCLUDED_FALLBACK)
    return re.sub(placeholder, lambda _: replacement, conditions, count=1)

def normalize(detail, carrier, checked):
    idx = str(detail['card_idx'])
    benefit, promo = clean(detail.get('benefit')), clean(detail.get('promotion_contents'))
    if not detail.get('card_name') or not benefit:
        raise ValueError('Missing card identity or benefits: '+idx)
    tiers = []
    for row in detail.get('discount') or []:
        label = clean(row.get('charge_money'))
        spend = re.search(r'(\d+(?:\.\d+)?)\s*만원', label)
        amount = integer(row.get('monthly_discount'))
        if amount is None or not 0 <= amount <= 1000000:
            raise ValueError('Invalid discount: '+idx)
        tiers.append({'id': str(row['discount_idx']), 'label': label,
                      'minSpend': round(float(spend[1])*10000) if spend else None,
                      'amount': amount, 'promotion': '프로모션' in label})
    # Period limits are explicit in the benefits, not guessed from installment length.
    period = re.search(r'^■\s*(?:(?:기본\s*(?:할인|혜택))\s*\(?\s*)?(?:1\s*[~～-]\s*)?(\d+)\s*개월\s*(?:까지|간|\))', benefit[:200], re.M)
    period_months = int(period[1]) if period else None
    if re.search(r'25개월차\s*부터[^\n]*M포인트', benefit):
        period_months = 24
    # Percentage cards must use the actual telecom fee, never the source cap alone.
    calculation = 'fixed'
    if idx in ('80', '68') and '25%' in benefit and '15%' in benefit:
        calculation = 'family-percent'
    elif idx == '126' and '5%' in benefit and '20%' in benefit:
        calculation = 'kbank-percent'
    elif idx == '391' and re.search(r'KT\s*통신요금[^\n]*5%', benefit):
        calculation = 'ibk-percent'
        tiers = [{'id': 'ibk-5', 'label': '100만원 이상 · 통신요금 5%',
                  'minSpend': 1000000, 'amount': 50000, 'promotion': False}]
    elif not tiers or re.search(r'통신(?:요금|료)[^\n]*\d+%', benefit[:500]) or (detail['category']=='POST' and '장기할부 선택시' in benefit[:150]):
        calculation = 'details'
    # Discrepant source rows remain visible but cannot silently become an estimate.
    lines = [re.sub(r'\s+', '', line) for line in benefit.splitlines()]
    for tier in tiers:
        tier['verified'] = bool(tier['promotion'] and promo) or calculation.endswith('percent')
        if not tier['promotion'] and tier['minSpend'] is not None:
            spend = f"{tier['minSpend']/10000:g}"
            tier['verified'] = tier['verified'] or any(re.search(
                r'(?<!\d)'+re.escape(spend)+r'만원[^\n]{0,80}?'+re.escape(f"{tier['amount']:,}")+r'원', line) for line in lines)
    # Recover a clearly stated basic tier if the source picker has a different threshold.
    seen = False
    if calculation=='fixed':
        for line in benefit.splitlines():
            if seen and line.startswith('■'):break
            m=re.search(r'전월\s*실적\s*(\d+)\s*만원\s*이상[^\n]*?([\d,]+)원\s*(?:할인|캐시백)',line)
            if not m:continue
            seen=True;spend=int(m[1])*10000;amount=int(m[2].replace(',',''))
            if not any(not t['promotion'] and t['minSpend']==spend and t['amount']==amount for t in tiers):
                tiers.append({'id':'basic-text-'+str(spend),'label':m[1]+'만원 이상','minSpend':spend,'amount':amount,'promotion':False,'verified':True})
    promo_benefit = re.split(r'-\s*혜택\s*[:：]', promo, maxsplit=1)[-1]
    limits = [int(n) for n in re.findall(r'(\d+)\s*(?:개월\s*간|회\s*추가|개월\s*동안)', promo_benefit)]
    promo_months = min(limits) if limits else None
    deadlines = re.findall(r'(?:~|～)\s*(\d{2,4})[.년/-]\s*(\d{1,2})[.월/-]\s*(\d{1,2})', promo)
    expiry = None
    if deadlines:
        y,m,d = map(int, deadlines[0]); y += 2000 if y<100 else 0
        expiry = f'{y:04}-{m:02}-{d:02}'
    promo_bill=re.search(r'통신\s*(?:요금|료)\s*([\d,]+)\s*원\s*이상',promo)
    if calculation=='kbank-percent':
        for tier in tiers:
            for line in benefit.splitlines():
                m=re.search(r'전월실적\s*(\d+)만원\s*이상\s*&\s*통신요금\s*(\d+)만원\s*이상시\s*통신요금의\s*(\d+)%',line)
                if m and int(m[1])*10000==tier['minSpend']:
                    tier['rate']=int(m[3])/100;tier['minBill']=int(m[2])*10000
    return {
        'id': idx, 'carrier': carrier, 'name': clean(detail['card_name']),
        'category': detail['category'], 'type': detail['card_type'],
        'annualDomestic': integer(detail.get('annual_fee_dom')),
        'annualInternational': integer(detail.get('annual_fee_int')),
        'autopayRequired': detail.get('auto_transfer') == 'Y',
        'minFinancing': integer(detail.get('min_charge')),
        'contact': clean(detail.get('issue_contact')), 'issueMethod': clean(detail.get('issue_method')),
        'issueUrl': detail.get('issue_url') or '', 'benefit': benefit,
        'conditions': normalize_spend_inclusion(clean(detail.get('contents')), idx), 'promotion': promo,
        'tiers': tiers, 'calculation': calculation,
        'basicMonths': period_months, 'promotionMonths': promo_months,
        'promotionDeadline': expiry, 'checkedAt': checked,
        'promotionMinBill': int(promo_bill[1].replace(',','')) if promo_bill else None,
        'installments': [{'months': integer(d.get('installment_month')),
                          'interest': str(d.get('interest') or '')} for d in detail.get('div') or []],
        'sourceUrl': BASE+'/api/data/get_card_info.php?card_idx='+idx,
        'imageSource': urllib.parse.urljoin(BASE, detail.get('card_image') or ''),
    }


def collect(fetch=request, checked=None):
    checked = checked or datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
    refs = []
    counts = {}
    for source_carrier, carrier in CARRIERS:
        counts[carrier] = 0
        for category, kind in KINDS:
            query = urllib.parse.urlencode({'telecom_id':source_carrier,'category':category,
                'card_type':kind,'sort_type':'DISCOUNT','dif_card_idx':''})
            result = fetch('/api/data/get_card_list.php?'+query)
            rows = result.get('data') or []
            if result.get('result',{}).get('result_cnt') != len(rows):
                raise ValueError('Incomplete card list: '+carrier+'/'+kind)
            if kind in ('CHARGE','LIGHT') and not rows:
                raise ValueError('Unexpected empty card category: '+carrier+'/'+kind)
            for row in rows:
                if row.get('category')!=category or row.get('card_type')!=kind:
                    raise ValueError('Wrong category in card feed')
                refs.append((str(row['card_idx']),carrier,category,kind))
            counts[carrier] += len(rows)
    if len({r[0] for r in refs}) != len(refs):
        raise ValueError('Duplicate source card identity')
    def detail(ref):
        idx,carrier,category,kind=ref
        result=fetch('/api/data/get_card_info.php?card_idx='+idx)
        row=result.get('data') or {}
        if result.get('result',{}).get('result_cnt')!=1 or str(row.get('card_idx'))!=idx or row.get('category')!=category or row.get('card_type')!=kind:
            raise ValueError('Incomplete/mismatched card detail: '+idx)
        return normalize(row,carrier,checked)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        cards=list(pool.map(detail,refs))
    return {'schemaVersion':1,'checkedAt':checked,'source':BASE+'/consult/mobile.php',
            'counts':counts,'cards':cards}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--fixture-dir',type=Path)
    args=parser.parse_args()
    def fixture(path):
        if 'get_card_list' in path:
            p=urllib.parse.parse_qs(urllib.parse.urlparse(path).query)
            name='xero-cards-'+p['telecom_id'][0]+'-'+p['card_type'][0]+'.json'
            return json.loads((args.fixture_dir/name).read_text(encoding='utf-8'))
        idx=urllib.parse.parse_qs(urllib.parse.urlparse(path).query)['card_idx'][0]
        return json.loads((args.fixture_dir/'xero-card-details'/(idx+'.json')).read_text(encoding='utf-8'))
    payload=collect(fixture if args.fixture_dir else request)
    path=Path('data/mobile-affiliate-cards.json')
    old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
    # Never accept an unexplained collapse of a previously complete feed.
    if old:
        for carrier,count in old.get('counts',{}).items():
            if payload['counts'].get(carrier,0)<count*.65:
                raise ValueError('Large source removal requires review; previous snapshot preserved: '+carrier)
    def artwork(card):
        raw=request(card['imageSource'],True)
        ext='.jpg' if raw.startswith(b'\xff\xd8') else '.png' if raw.startswith(b'\x89PNG') else '.gif' if raw.startswith(b'GIF8') else None
        if ext is None:raise ValueError('Invalid card artwork: '+card['id'])
        rel='assets/mobile-cards/'+card['id']+'-'+hashlib.sha256(raw).hexdigest()[:12]+ext
        return card,rel,raw
    # Finish every network request and validation before changing published files.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        images=list(pool.map(artwork,payload['cards']))
    for card,rel,raw in images:
        card['image']=rel
        dest=Path(rel);dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(raw)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');os.replace(temp,path)
    print('Zeronote affiliate-card snapshot:',payload['checkedAt'],payload['counts'])


if __name__=='__main__':main()
