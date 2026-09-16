from pathlib import Path
import re

js_path=Path('assets/rates.js')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

old="""    premium:'아이폰18 시리즈·갤럭시 S26 / S26+ / S26 Ultra·Z Fold8 / Z Flip8을 중심으로 256GB를 우선 추천하고 512GB까지만 보여드립니다. 실제 공시지원금이 40~50만원으로 확인되는 고요금제 조합은 기기값 할인 중심으로 안내합니다.'
"""
new="""    premium:'아이폰18 시리즈·갤럭시 S26 / S26+ / S26 Ultra·Z Fold8 / Z Flip8을 중심으로 256GB를 우선 추천하고 512GB까지만 보여드립니다. 실제 확인 가능한 공시지원금이 큰 조합을 우선해 기기값 할인 중심으로 안내합니다.'
"""
if js.count(old)!=1:
    raise SystemExit(f'premium copy anchor count={js.count(old)}')
js=js.replace(old,new,1)

old="""      }else if(category==='premium'){
        if(!purposePremiumSupportFit(support))continue;
        row.best=support;
        const rowSupportDiff=Math.abs(Number(support.support)-450000),bestSupportDiff=best?Math.abs(Number(best.support.support)-450000):Infinity;
        if(!best||rowSupportDiff<bestSupportDiff||(rowSupportDiff===bestSupportDiff&&Number(p.monthly_fee)<Number(best.p.monthly_fee))||(rowSupportDiff===bestSupportDiff&&Number(p.monthly_fee)===Number(best.p.monthly_fee)&&support.total24<best.support.total24))best=row;
      }else if(!best||row.best.total24<best.best.total24)best=row;
"""
new="""      }else if(category==='premium'){
        if(!support?.known)continue;
        row.best=support;
        const rowFit=purposePremiumSupportFit(support)?0:1,bestFit=best?(purposePremiumSupportFit(best.support)?0:1):99;
        const rowSupport=Number(support.support)||0,bestSupport=best?(Number(best.support.support)||0):-1;
        const rowSupportDiff=Math.abs(rowSupport-450000),bestSupportDiff=best?Math.abs(bestSupport-450000):Infinity;
        if(!best||rowFit<bestFit||(rowFit===bestFit&&rowFit===0&&rowSupportDiff<bestSupportDiff)||(rowFit===bestFit&&rowFit===1&&rowSupport>bestSupport)||(rowFit===bestFit&&rowSupport===bestSupport&&Number(p.monthly_fee)<Number(best.p.monthly_fee))||(rowFit===bestFit&&rowSupport===bestSupport&&Number(p.monthly_fee)===Number(best.p.monthly_fee)&&support.total24<best.support.total24))best=row;
      }else if(!best||row.best.total24<best.best.total24)best=row;
"""
if js.count(old)!=1:
    raise SystemExit(f'premium candidate anchor count={js.count(old)}')
js=js.replace(old,new,1)

html,n=re.subn(r'assets/rates\.js\?v=[^\"]+', 'assets/rates.js?v=20260916-26', html, count=1)
if n!=1:
    raise SystemExit('js cache bust failed')

js_path.write_text(js,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('premium support gate relaxed with verified-support fallback')
