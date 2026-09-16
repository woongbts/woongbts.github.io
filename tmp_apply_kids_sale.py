from pathlib import Path

js_path=Path('assets/rates.js')
css_path=Path('assets/rates.css')
html_path=Path('rates.html')
js=js_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')

old_copy="    kids:'현재 추천하는 키즈폰은 SKT ZEM폰 포켓피스·LGU+ 춘식이2·KT 폼폼푸린 키즈폰 3종입니다. 키즈·청소년용 요금제에서 공시지원금과 선택약정의 24개월 총 부담을 비교합니다.',"
new_copy="    kids:'신규가입 한정 키즈폰 특가 3종입니다. SKT ZEM폰 포켓피스·KT 폼폼푸린 키즈폰·LGU+ 갤럭시 A17 키즈폰 무너2를 기기값 0원 행사 조건으로 안내합니다. 재고와 행사 조건은 상담 시점에 최종 확인됩니다.',"
assert old_copy in js, 'kids copy anchor missing'
js=js.replace(old_copy,new_copy,1)

anchor="  function purposeCuratedRow(key,usePension=false){"
assert anchor in js, 'curated row anchor missing'
kids_code=r"""  const PURPOSE_KIDS_PROMOS={
    pocketpiece:{carrier:'SKT',name:'ZEM폰 포켓피스',modelCode:'SM-A175N_ZEM',price:349800,planName:'ZEM플랜 스마트',planFee:19800,monthly:14850,promoLabel:'SALE',promoText:'기기값 0원 특가'},
    pompompurin:{carrier:'KT',name:'폼폼푸린 키즈폰',modelCode:'SM-A175NK-KP',price:349800,planName:'키즈24',planFee:24000,monthly:24000,promoLabel:'특가',promoText:'기기값 0원 행사'},
    mooner2:{carrier:'LGU+',name:'갤럭시 A17 키즈폰 무너2',modelCode:'SM-A175N-M2',price:369500,planName:'데이터플랜300MB(키즈)+0.7GB',planFee:28000,monthly:28000,promoLabel:'SALE',promoText:'기기값 0원 행사'}
  };
  function purposeKidsPromoRow(key){
    const q=PURPOSE_KIDS_PROMOS[key];if(!q)return null;
    const best={known:true,method:'promo',price:Number(q.price),planFee:Number(q.planFee),support:0,contractDiscount:Math.max(0,Number(q.planFee)-Number(q.monthly)),principal:0,inst:{monthly:0,total:0},service:Number(q.monthly),welfare:{amount:0},monthly:Number(q.monthly),total24:Number(q.monthly)*24};
    return {curated:true,kidsPromo:true,promoLabel:q.promoLabel,promoText:q.promoText,joinLabel:'신규가입',d:{id:`kids-promo-${key}`,carrier:q.carrier,name:q.name,model_code:q.modelCode,retail_price:q.price},p:{id:`kids-promo-plan-${key}`,carrier:q.carrier,name:q.planName,monthly_fee:q.planFee},best,support:{known:false},contract:{known:false},welfare:'none'};
  }
  function purposeCuratedKidsRows(carrierValue,joinLabel){
    if(joinLabel!=='신규가입')return [];
    return ['pocketpiece','pompompurin','mooner2'].map(purposeKidsPromoRow).filter(row=>row&&(carrierValue==='all'||row.d.carrier===carrierValue));
  }
"""
js=js.replace(anchor,kids_code+anchor,1)

old_rec="    if(purposeCategory==='value')return purposeCuratedValueRows(carrierValue,joinLabel);\n    purposeDevicePool(purposeCategory,carrierValue).forEach(d=>{"
new_rec="    if(purposeCategory==='value')return purposeCuratedValueRows(carrierValue,joinLabel);\n    if(purposeCategory==='kids')return purposeCuratedKidsRows(carrierValue,joinLabel);\n    purposeDevicePool(purposeCategory,carrierValue).forEach(d=>{"
assert old_rec in js, 'recommendation anchor missing'
js=js.replace(old_rec,new_rec,1)

old_quote="    if(!row)return '';const method=row.best.method==='support'?'공시지원금':'선택약정 25%',joinLabel=$('purpose-join')?.value||'기기변경',lines=['[웅비통신 용도별 추천 상담]',`용도: ${{senior:'효도폰',kids:'키즈폰',value:'가성비폰',premium:'프리미엄폰'}[purposeCategory]||'휴대폰'}`,`통신사: ${row.d.carrier}`,`가입유형: ${joinLabel}`,`기종: ${row.d.name}`,`요금제: ${row.p.name} / ${won(row.p.monthly_fee)}`,`추천 할인방식: ${method}`,`예상 월 납부액: ${won(row.best.monthly)}`,`24개월 총 예상비용: ${won(row.best.total24)}`];"
new_quote="    if(!row)return '';const method=row.kidsPromo?'신규가입 특가':row.best.method==='support'?'공시지원금':'선택약정 25%',joinLabel=row.joinLabel||$('purpose-join')?.value||'기기변경',lines=['[웅비통신 용도별 추천 상담]',`용도: ${{senior:'효도폰',kids:'키즈폰',value:'가성비폰',premium:'프리미엄폰'}[purposeCategory]||'휴대폰'}`,`통신사: ${row.d.carrier}`,`가입유형: ${joinLabel}`,`기종: ${row.d.name}`,`요금제: ${row.p.name} / ${won(row.p.monthly_fee)}`,`추천 조건: ${method}`,`예상 월 납부액: ${won(row.best.monthly)}`,`24개월 총 예상비용: ${won(row.best.total24)}`];if(row.kidsPromo)lines.push('기기값: 0원 행사','※ 신규가입 한정 · 해당 요금제 및 행사 조건 기준');"
assert old_quote in js, 'quote anchor missing'
js=js.replace(old_quote,new_quote,1)

old_render_start="    const box=$('purpose-results'),note=$('purpose-category-note'),pensionWrap=$('purpose-pension-wrap');if(!box)return;if(note)note.textContent=PURPOSE_COPY[purposeCategory]||'';if(pensionWrap)pensionWrap.hidden=purposeCategory!=='senior';\n    document.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.purposeCategory===purposeCategory));\n    const rows=purposeRecommendations();box.innerHTML='';"
new_render_start="    const box=$('purpose-results'),note=$('purpose-category-note'),pensionWrap=$('purpose-pension-wrap');if(!box)return;if(note)note.textContent=PURPOSE_COPY[purposeCategory]||'';if(pensionWrap)pensionWrap.hidden=purposeCategory!=='senior';\n    document.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.purposeCategory===purposeCategory));\n    if(purposeCategory==='kids'&&$('purpose-join')&&$('purpose-join').value!=='신규가입')$('purpose-join').value='신규가입';\n    const rows=purposeRecommendations();box.innerHTML='';"
assert old_render_start in js, 'render start anchor missing'
js=js.replace(old_render_start,new_render_start,1)

old_card="      const card=document.createElement('article');card.className='purpose-card';\n      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${row.joinLabel||$('purpose-join')?.value||'기기변경'}`;rank.textContent=row.curated?'실제 매장 견적':purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):purposeCategory==='value'?(index===0?'가성비 추천':'추천 조합'):purposeCategory==='premium'?(index===0?'공시지원 중심':'기기값 할인 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');top.append(badge,rank);"
new_card="      const card=document.createElement('article');card.className=row.kidsPromo?'purpose-card kids-sale-card':'purpose-card';\n      const top=document.createElement('div');top.className='purpose-card-top';const badge=document.createElement('span'),rank=document.createElement('small');badge.textContent=`${row.d.carrier} · ${row.joinLabel||$('purpose-join')?.value||'기기변경'}`;rank.textContent=row.kidsPromo?(row.promoLabel||'SALE'):row.curated?'실제 매장 견적':purposeCategory==='senior'?(index===0?'매장 추천 조합':'추천 조합'):purposeCategory==='value'?(index===0?'가성비 추천':'추천 조합'):purposeCategory==='premium'?(index===0?'공시지원 중심':'기기값 할인 조합'):(index===0?'현재 조건 낮은 부담':'추천 조합');top.append(badge,rank);"
assert old_card in js, 'card anchor missing'
js=js.replace(old_card,new_card,1)

old_detail="      const total=document.createElement('div');total.className='purpose-card-total';const totalLabel=document.createElement('span'),totalValue=document.createElement('b');totalLabel.textContent='예상 월 납부액';totalValue.textContent=won(row.best.monthly);total.append(totalLabel,totalValue);\n      const detail=document.createElement('div');detail.className='purpose-card-detail';if(purposeCategory==='premium'&&row.support?.known)detail.append(purposeCardLine('공시지원금','-'+won(row.support.support)),purposeCardLine('지원 후 기기값',won(row.support.principal)));detail.append(purposeCardLine('월 기기값 · 이자 포함',won(row.best.inst.monthly)),purposeCardLine('할인 후 통신요금',won(row.best.service)));if(row.welfare==='basic_pension')detail.append(purposeCardLine('기초연금 수급자 할인','-'+won(row.best.welfare?.amount||0),'welfare-line'));\n      const compare=document.createElement('div');compare.className='purpose-method-compare';const sText=row.support?.known?won(row.support.monthly):'매장 확인',cText=row.contract?.known?won(row.contract.monthly):'매장 확인';compare.append(purposeCardLine('공시지원 월',sText),purposeCardLine('선택약정 월',cText));\n      const best=document.createElement('div');best.className='purpose-best';best.textContent=purposeCategory==='premium'&&row.support?.known?`기기값 할인 중심 · 공시지원금 ${won(row.support.support)} · 지원 후 기기값 ${won(row.support.principal)}`:`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준 · 24개월 총 예상비용 ${won(row.best.total24)}`;"
new_detail="      const total=document.createElement('div');total.className='purpose-card-total';const totalLabel=document.createElement('span'),totalValue=document.createElement('b');totalLabel.textContent='예상 월 납부액';totalValue.textContent=won(row.best.monthly);total.append(totalLabel,totalValue);\n      const promo=document.createElement('div');if(row.kidsPromo){promo.className='kids-zero-deal';promo.innerHTML=`<span>${row.promoLabel||'SALE'}</span><strong>${row.promoText||'기기값 0원 행사'}</strong><small>신규가입 한정 · 해당 요금제 기준</small>`}\n      const detail=document.createElement('div');detail.className='purpose-card-detail';if(purposeCategory==='premium'&&row.support?.known)detail.append(purposeCardLine('공시지원금','-'+won(row.support.support)),purposeCardLine('지원 후 기기값',won(row.support.principal)));if(row.kidsPromo)detail.append(purposeCardLine('기기값','0원'),purposeCardLine('월 통신요금',won(row.best.service)));else detail.append(purposeCardLine('월 기기값 · 이자 포함',won(row.best.inst.monthly)),purposeCardLine('할인 후 통신요금',won(row.best.service)));if(row.welfare==='basic_pension')detail.append(purposeCardLine('기초연금 수급자 할인','-'+won(row.best.welfare?.amount||0),'welfare-line'));\n      const compare=document.createElement('div');compare.className='purpose-method-compare';if(row.kidsPromo){compare.classList.add('kids-sale-condition');compare.textContent='신규가입 한정 특가 · 재고 및 행사 조건은 상담 시 최종 확인'}else{const sText=row.support?.known?won(row.support.monthly):'매장 확인',cText=row.contract?.known?won(row.contract.monthly):'매장 확인';compare.append(purposeCardLine('공시지원 월',sText),purposeCardLine('선택약정 월',cText))}\n      const best=document.createElement('div');best.className='purpose-best';best.textContent=row.kidsPromo?`기기값 0원 행사 · ${row.p.name} 기준 월 ${won(row.best.monthly)}`:purposeCategory==='premium'&&row.support?.known?`기기값 할인 중심 · 공시지원금 ${won(row.support.support)} · 지원 후 기기값 ${won(row.support.principal)}`:`${row.best.method==='support'?'공시지원금':'선택약정 25%'} 기준 · 24개월 총 예상비용 ${won(row.best.total24)}`;"
assert old_detail in js, 'detail anchor missing'
js=js.replace(old_detail,new_detail,1)

old_actions="      const actions=document.createElement('div');actions.className='purpose-card-actions';const detailBtn=document.createElement('button'),consultBtn=document.createElement('button');detailBtn.type='button';consultBtn.type='button';detailBtn.textContent='자세히 계산';consultBtn.textContent='이 조건 상담';consultBtn.className='primary';detailBtn.addEventListener('click',()=>applyPurposeResult(row));consultBtn.addEventListener('click',async()=>{const ok=await copyCustomerConsultText(purposeQuoteText(row));if(ok)window.location.href='http://pf.kakao.com/_nWwNT/chat'});if(row.curated){consultBtn.style.gridColumn='1 / -1';actions.append(consultBtn)}else actions.append(detailBtn,consultBtn);\n      card.append(top,name);if(purposeCategory==='premium'&&lineup.textContent)card.append(lineup);card.append(plan,total,detail,compare,best,actions);box.appendChild(card);"
new_actions="      const actions=document.createElement('div');actions.className='purpose-card-actions';const detailBtn=document.createElement('button'),consultBtn=document.createElement('button');detailBtn.type='button';consultBtn.type='button';detailBtn.textContent='자세히 계산';consultBtn.textContent=row.kidsPromo?'이 특가 상담':'이 조건 상담';consultBtn.className='primary';detailBtn.addEventListener('click',()=>applyPurposeResult(row));consultBtn.addEventListener('click',async()=>{const ok=await copyCustomerConsultText(purposeQuoteText(row));if(ok)window.location.href='http://pf.kakao.com/_nWwNT/chat'});if(row.curated){consultBtn.style.gridColumn='1 / -1';actions.append(consultBtn)}else actions.append(detailBtn,consultBtn);\n      card.append(top,name);if(purposeCategory==='premium'&&lineup.textContent)card.append(lineup);card.append(plan);if(row.kidsPromo)card.append(promo);card.append(total,detail,compare,best,actions);box.appendChild(card);"
assert old_actions in js, 'actions anchor missing'
js=js.replace(old_actions,new_actions,1)

css_marker='/* Kids phone sale cards 2026-09-16 */'
if css_marker not in css:
    css += r'''

/* Kids phone sale cards 2026-09-16 */
.purpose-card.kids-sale-card{position:relative;overflow:hidden;border:2px solid #ffc2ad;background:linear-gradient(180deg,#fff 0%,#fffaf7 100%);box-shadow:0 12px 28px rgba(216,72,28,.09)}
.purpose-card.kids-sale-card .purpose-card-top small{background:#ff5a36;color:#fff;border-radius:999px;padding:5px 9px;font-weight:950;letter-spacing:.02em}
.kids-zero-deal{margin:10px 0 12px;padding:14px 15px;border-radius:16px;background:linear-gradient(135deg,#fff0ea,#ffe2d6);border:1px solid #ffc4b2}
.kids-zero-deal span{display:inline-flex;padding:3px 7px;border-radius:999px;background:#ff5a36;color:#fff;font-size:.68rem;font-weight:950;margin-bottom:6px}
.kids-zero-deal strong{display:block;color:#d84418;font-size:1.32rem;font-weight:950;letter-spacing:-.035em}
.kids-zero-deal small{display:block;margin-top:5px;color:#865343;font-size:.72rem;font-weight:750;line-height:1.4}
.kids-sale-card .purpose-card-total{background:#fff5ef;border-color:#ffd2c1}
.kids-sale-card .purpose-card-total b{color:#d84418}
.purpose-method-compare.kids-sale-condition{display:block;padding:10px 12px;border-radius:12px;background:#fff8e8;color:#725c28;font-size:.74rem;font-weight:800;line-height:1.45}
'''

html=html.replace('assets/rates.css?v=20260916-16','assets/rates.css?v=20260916-17')
html=html.replace('assets/rates.js?v=20260916-28','assets/rates.js?v=20260916-29')

js_path.write_text(js,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
print('Applied kids sale cards')
