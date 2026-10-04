(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (_) { return fallback; } };
  const escapeHtml = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const events = () => read('wb_conversion_events_v1',[]);
  const feedback = () => read('wb_rental_ai_feedback_v1',[]);
  const sourceOf = row => row?.source || row?.detail?.source || row?.acquisition?.source || row?.attribution?.utm_source || row?.attribution?.src || 'direct';
  const count = (rows,type) => rows.filter(x=>x.type===type).length;
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;
  const grouped = (rows,getter) => rows.reduce((acc,row)=>{const k=String(getter(row)||'unknown');acc[k]=(acc[k]||0)+1;return acc;},{});
  const top = (obj,n=6) => Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,n);

  async function policyData(){
    try{
      const r=await fetch('data/policy-alerts.json',{cache:'no-store'});
      if(!r.ok) throw Error('no report');
      return await r.json();
    }catch(_){return {alertCount:0,alerts:[],status:'unavailable'};}
  }
  async function giftData(){
    try{
      const r=await fetch('data/appliance-gift-options.json',{cache:'no-store'});
      if(!r.ok) throw Error('no policy');
      return await r.json();
    }catch(_){return {};}
  }

  function renderKpis(rows){
    const views=count(rows,'rental_product_view');
    const ai=count(rows,'rental_ai_recommend');
    const quote=count(rows,'rental_quote_open');
    const kakao=count(rows,'rental_ai_kakao')+count(rows,'rental_kakao_click');
    const apply=count(rows,'rental_apply_success');
    const shares=count(rows,'rental_ai_share')+count(rows,'rental_quote_share');
    const data=[
      ['상품 상세',views,'조회 이벤트'],
      ['AI 추천',ai,pct(ai,count(rows,'rental_ai_open'))+'% 추천 실행'],
      ['한눈견적',quote,pct(quote,ai)+'% / AI추천'],
      ['카톡 상담',kakao,pct(kakao,views||ai)+'% 전환'],
      ['신청 완료',apply,pct(apply,views||ai)+'% 전환'],
      ['공유',shares,'추천·견적 공유']
    ];
    $('#ops-kpis').innerHTML=data.map(([label,value,sub])=>'<article class="ops-kpi"><span>'+label+'</span><strong>'+value+'</strong><small>'+sub+'</small></article>').join('');
  }

  function renderFunnel(rows){
    const opens=count(rows,'rental_ai_open');
    const rec=count(rows,'rental_ai_recommend');
    const detail=count(rows,'rental_ai_product_click')+count(rows,'rental_product_view');
    const quote=count(rows,'rental_quote_open');
    const contact=count(rows,'rental_ai_kakao')+count(rows,'rental_kakao_click');
    const apply=count(rows,'rental_apply_success');
    const stages=[['AI 열기',opens,100],['추천',rec,pct(rec,opens)],['상세',detail,pct(detail,rec||opens)],['견적',quote,pct(quote,rec||detail)],['상담',contact,pct(contact,rec||detail)],['신청',apply,pct(apply,rec||detail)]];
    $('#ops-funnel').innerHTML=stages.map(([l,v,p])=>'<div class="ops-stage"><span>'+l+'</span><strong>'+v+'</strong><small>'+p+'%</small></div>').join('');
  }

  function renderSources(rows){
    const groups=grouped(rows,sourceOf);
    const entries=top(groups,8);
    const max=entries[0]?.[1]||1;
    $('#ops-sources').innerHTML=entries.length?entries.map(([k,v])=>'<div class="ops-bar-row"><span title="'+escapeHtml(k)+'">'+escapeHtml(k)+'</span><div class="ops-bar-track"><div class="ops-bar-fill" style="width:'+Math.max(5,Math.round(v/max*100))+'%"></div></div><b>'+v+'</b></div>').join(''):'<div class="ops-empty">아직 유입 이벤트가 없습니다.</div>';
  }

  function renderAi(rows){
    const up=feedback().filter(x=>x.value==='up').length;
    const down=feedback().filter(x=>x.value==='down').length;
    const items=[
      ['AI 열기',count(rows,'rental_ai_open')],
      ['추천 실행',count(rows,'rental_ai_recommend')],
      ['결과 공유',count(rows,'rental_ai_share')],
      ['비교담기',count(rows,'rental_ai_compare')],
      ['한눈견적',count(rows,'rental_quote_open')],
      ['👍 도움됨 / 👎 안맞음',up+' / '+down]
    ];
    $('#ops-ai').innerHTML=items.map(([k,v])=>'<div class="ops-list-row"><span>'+k+'</span><b>'+v+'</b></div>').join('');
  }

  function renderProducts(rows){
    const products=grouped(rows.filter(x=>x.detail?.product_id),x=>x.detail.product_id);
    const categories=grouped(rows.filter(x=>x.detail?.category),x=>x.detail.category);
    const lines=[
      ...top(categories,3).map(([k,v])=>['품목 · '+k,v]),
      ...top(products,5).map(([k,v])=>['상품 · '+k,v])
    ];
    $('#ops-products').innerHTML=lines.length?lines.map(([k,v])=>'<div class="ops-list-row"><span title="'+escapeHtml(k)+'">'+escapeHtml(k)+'</span><b>'+v+'</b></div>').join(''):'<div class="ops-empty">아직 상품 이벤트가 없습니다.</div>';
  }

  function renderPolicy(report){
    $('#ops-policy-date').textContent=report.sourcePolicyDate?('기준 '+report.sourcePolicyDate):'변경 리포트';
    const alerts=Array.isArray(report.alerts)?report.alerts:[];
    if(!alerts.length){
      $('#ops-policy').innerHTML='<div class="ops-empty">최근 감지된 중요 정책 변경이 없습니다.</div>';
      return;
    }
    $('#ops-policy').innerHTML=alerts.slice(0,30).map(a=>{
      const level=a.level==='danger'?'danger':a.level==='warn'?'warn':'';
      return '<div class="ops-policy-item '+level+'"><i>'+escapeHtml(a.type||'변경')+'</i><div><strong>'+escapeHtml(a.title||a.product_id||'정책 변경')+'</strong><p>'+escapeHtml(a.message||'')+'</p></div><small>'+escapeHtml(a.product_id||'')+'</small></div>';
    }).join('');
  }

  function renderSystem(rows,report,gift){
    const analytics=window.WOONGBI_ANALYTICS||{};
    let first='direct',last='direct';
    try{first=localStorage.getItem('wb_site_first_source_v1')||first;last=sessionStorage.getItem('wb_site_source_v1')||last;}catch(_){}
    const items=[
      ['서버 페이지뷰',analytics.siteAnalyticsEndpoint?'연결됨':'미설정',analytics.siteAnalyticsEndpoint?'ok':'warn-text'],
      ['서버 전환수집',analytics.siteConversionEndpoint?'연결됨':'미설정',analytics.siteConversionEndpoint?'ok':'warn-text'],
      ['첫 유입',first,''],
      ['현재 유입',last,''],
      ['정책 기준일',gift.generatedAt||'확인 불가',gift.generatedAt?'ok':'warn-text'],
      ['정책 경고',String(report.alertCount||0),(report.alertCount||0)?'warn-text':'ok'],
      ['브라우저 이벤트',String(rows.length),''],
      ['AI 피드백',String(feedback().length),'']
    ];
    $('#ops-system').innerHTML=items.map(([k,v,c])=>'<div><span>'+k+'</span><strong class="'+c+'">'+escapeHtml(v)+'</strong><small>'+((c==='ok')?'정상':c==='warn-text'?'확인 필요':'')+'</small></div>').join('');
  }

  function exportCsv(){
    const rows=events();
    const header=['at','type','path','source','product_id','category'];
    const csv=[header.join(',')].concat(rows.map(r=>header.map(k=>{
      let v=k==='source'?sourceOf(r):k==='product_id'?r.detail?.product_id:k==='category'?r.detail?.category:r[k];
      return '"'+String(v??'').replace(/"/g,'""')+'"';
    }).join(','))).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='woongbi-rental-events.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  async function render(){
    const rows=events().slice(-500);
    const [report,gift]=await Promise.all([policyData(),giftData()]);
    renderKpis(rows);renderFunnel(rows);renderSources(rows);renderAi(rows);renderProducts(rows);renderPolicy(report);renderSystem(rows,report,gift);
    const dates=rows.map(x=>String(x.at||'').slice(0,10)).filter(Boolean);
    $('#ops-period').textContent=dates.length?(dates[0]+' ~ '+dates[dates.length-1]):'이 브라우저';
  }

  $('#ops-refresh')?.addEventListener('click',render);
  $('#ops-export')?.addEventListener('click',exportCsv);
  render();
})();