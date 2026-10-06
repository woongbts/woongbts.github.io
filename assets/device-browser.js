(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const won=v=>Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v))).toLocaleString('ko-KR')+'원':'확인 필요';
  const state={catalog:null,plans:[],supports:[],carrier:'SKT',join:'번호이동',brand:'all',sort:'recommended',planId:'',query:'',limit:12};
  const brandOf=d=>{
    const t=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    if(/아이폰|iphone|apple|애플/.test(t))return'apple';
    if(/갤럭시|galaxy|samsung|삼성/.test(t))return'samsung';
    return'other';
  };
  const visibleDevice=d=>{
    if(window.WoongbiSalePolicy?.available&&!window.WoongbiSalePolicy.available(d))return false;
    const t=`${d?.name||''} ${d?.manufacturer||''} ${d?.model||''} ${d?.model_code||''}`.toLowerCase();
    if(d?.carrier==='LGU+'&&(t.includes('모토로라')||t.includes('motorola')||t.includes('moto ')))return false;
    return true;
  };
  const eligiblePlans=d=>{
    const by=d?.eligible_plan_ids_by_join_type||{};
    const ids=Array.isArray(by[state.join])?by[state.join]:d?.eligible_plan_ids;
    return Array.isArray(ids)?ids:[];
  };
  const supportFor=(d,planId)=>{
    const vals=[];
    for(const row of state.supports){
      if(row?.carrier!==state.carrier)continue;
      if(!Array.isArray(row.device_ids)||!row.device_ids.includes(d.id))continue;
      if(!Array.isArray(row.join_types)||!row.join_types.includes(state.join))continue;
      const amount=Number(row?.amounts?.[planId]);
      if(Number.isFinite(amount))vals.push(amount);
    }
    return vals.length?Math.max(...vals):null;
  };
  const planById=id=>state.plans.find(p=>p.id===id)||null;
  const carrierPlans=()=>{
    const list=state.plans.filter(p=>p.carrier===state.carrier);
    return list.slice().sort((a,b)=>Number(a.monthly_fee||0)-Number(b.monthly_fee||0)||((a.age_limit==='ALL'||!a.age_limit)?-1:1)-((b.age_limit==='ALL'||!b.age_limit)?-1:1)||Number(a.source_order||9999)-Number(b.source_order||9999));
  };
  const closestPlan=(plans,target=55000)=>{
    if(!plans.length)return null;
    return plans.reduce((best,p)=>Math.abs(Number(p.monthly_fee||0)-target)<Math.abs(Number(best.monthly_fee||0)-target)?p:best,plans[0]);
  };
  function fillPlanSelect(preserve=true){
    const select=$('device-browser-plan'); if(!select)return;
    const plans=carrierPlans();
    const before=preserve?state.planId:'';
    select.innerHTML='';
    for(const p of plans){
      const o=document.createElement('option');o.value=p.id;o.textContent=`${p.name} · ${won(p.monthly_fee)}`;select.append(o);
    }
    const valid=plans.some(p=>p.id===before);
    const picked=valid?before:(closestPlan(plans)?.id||plans[0]?.id||'');
    state.planId=picked;select.value=picked;
  }
  function detailUrl(d){
    const q=new URLSearchParams();
    q.set('c',d.carrier);q.set('j',state.join);q.set('m','support');q.set('d',d.id);q.set('p',state.planId);q.set('mo','24');
    return '/rates.html?'+q.toString();
  }
  function sortRows(rows){
    return rows.sort((a,b)=>{
      if(state.sort==='effective')return (a.effective??Number.MAX_SAFE_INTEGER)-(b.effective??Number.MAX_SAFE_INTEGER)||Number(a.d.source_order||9999)-Number(b.d.source_order||9999);
      if(state.sort==='support')return (b.support??-1)-(a.support??-1)||Number(a.d.source_order||9999)-Number(b.d.source_order||9999);
      if(state.sort==='price')return Number(a.d.retail_price||0)-Number(b.d.retail_price||0)||Number(a.d.source_order||9999)-Number(b.d.source_order||9999);
      if(state.sort==='latest')return String(b.d.release_date||'').localeCompare(String(a.d.release_date||''))||Number(a.d.source_order||9999)-Number(b.d.source_order||9999);
      return Number(a.d.source_order||9999)-Number(b.d.source_order||9999);
    });
  }
  function render(){
    const list=$('device-browser-list'),count=$('device-browser-count'),more=$('device-browser-more'),note=$('device-browser-note');
    if(!list||!state.catalog)return;
    const p=planById(state.planId);
    let rows=(state.catalog.devices||[])
      .filter(d=>visibleDevice(d)&&d.carrier===state.carrier)
      .filter(d=>state.brand==='all'||brandOf(d)===state.brand)
      .filter(d=>!state.query||`${d.name||''} ${d.model||''} ${d.model_code||''}`.toLowerCase().includes(state.query.toLowerCase()))
      .filter(d=>eligiblePlans(d).includes(state.planId))
      .map(d=>{const support=supportFor(d,state.planId);return{d,support,effective:support==null?null:Math.max(0,Number(d.retail_price||0)-support)}});
    sortRows(rows);
    const shown=rows.slice(0,state.limit);
    list.innerHTML='';
    for(const row of shown){
      const d=row.d,article=document.createElement('article');article.className='device-browser-card';
      const image=window.woongbiDeviceImage?.(d)||'';
      const visual=document.createElement('div');visual.className='device-browser-image';
      if(image){const img=document.createElement('img');img.src=image;img.alt=d.name||'휴대폰';img.loading='lazy';img.decoding='async';visual.append(img)}
      else{const fallback=document.createElement('span');fallback.textContent=(d.manufacturer||d.carrier||'PHONE').slice(0,8);visual.append(fallback)}
      const carrier=document.createElement('span');carrier.className='device-browser-carrier';carrier.textContent=d.carrier;
      const name=document.createElement('h4');name.textContent=d.name||'휴대폰';
      const model=document.createElement('p');model.className='device-browser-model';model.textContent=[d.model_code,d.release_date?('출시 '+d.release_date):''].filter(Boolean).join(' · ');
      const facts=document.createElement('div');facts.className='device-browser-facts';
      const f1=document.createElement('div');f1.innerHTML='<span>출고가</span><b>'+won(d.retail_price)+'</b>';
      const f2=document.createElement('div');f2.innerHTML='<span>공시지원금</span><b>'+(row.support==null?'매장 확인':('-'+won(row.support)))+'</b>';
      const f3=document.createElement('div');f3.className='device-browser-effective';f3.innerHTML='<span>공시지원 반영가</span><strong>'+(row.effective==null?'매장 확인':won(row.effective))+'</strong>';
      facts.append(f1,f2,f3);
      const plan=document.createElement('p');plan.className='device-browser-plan';plan.textContent=p?`기준 요금제 · ${p.name} · ${won(p.monthly_fee)}`:'기준 요금제 확인 필요';
      const a=document.createElement('a');a.className='device-browser-calc';a.href=detailUrl(d);a.textContent='이 기종 계산하기';
      a.addEventListener('click',()=>{try{window.woongbiTrackConversion?.('rate_open',{label:'device-browser',product_id:d.id,category:'mobile'})}catch{}});
      article.append(visual,carrier,name,model,facts,plan,a);list.append(article);
    }
    count.textContent=`${rows.length.toLocaleString('ko-KR')}개 기종 · ${p?p.name:'요금제 미선택'} 기준`;
    more.hidden=state.limit>=rows.length;
    if(note){
      const sortLabel={recommended:'추천순',effective:'공시지원 반영가 낮은 순',support:'공시지원금 높은 순',price:'출고가 낮은 순',latest:'최신폰 순'}[state.sort]||'추천순';
      note.textContent=`${state.carrier} · ${state.join} · ${sortLabel}. 공시지원금은 선택한 기준 요금제에서 확인된 값만 표시하며, 매장 추가지원금은 포함하지 않습니다.`;
    }
  }
  function setBrand(value,button){
    state.brand=value;state.limit=12;
    document.querySelectorAll('[data-device-browser-brand]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    render();
  }
  function bind(){
    $('device-browser-carrier')?.addEventListener('change',e=>{state.carrier=e.target.value;state.limit=12;fillPlanSelect(false);render()});
    $('device-browser-join')?.addEventListener('change',e=>{state.join=e.target.value;state.limit=12;render()});
    $('device-browser-plan')?.addEventListener('change',e=>{state.planId=e.target.value;state.limit=12;render()});
    $('device-browser-sort')?.addEventListener('change',e=>{state.sort=e.target.value;state.limit=12;render()});
    $('device-browser-search')?.addEventListener('input',e=>{state.query=e.target.value.trim();state.limit=12;render()});
    document.querySelectorAll('[data-device-browser-brand]').forEach(b=>b.addEventListener('click',()=>setBrand(b.dataset.deviceBrowserBrand,b)));
    $('device-browser-more')?.addEventListener('click',()=>{state.limit+=12;render()});
  }
  async function init(){
    const root=$('device-browser'); if(!root)return;
    root.dataset.state='loading';
    try{
      const [catalog,plans,supports,extra,iphone]=await Promise.all([
        fetch('data/catalog.json?v=20260918-5').then(r=>r.json()),
        fetch('data/plans.json?v=20260922-1').then(r=>r.json()),
        fetch('data/supports.json?v=20260918-4').then(r=>r.json()),
        fetch('data/devices-extra.json?v=20260916-1').then(r=>r.json()).catch(()=>({devices:[]})),
        fetch('data/iphone18.json?v=20260916-1').then(r=>r.json()).catch(()=>({devices:[]}))
      ]);
      const map=new Map();
      [...(catalog.devices||[]),...(extra.devices||[]),...(iphone.devices||[])].forEach(d=>map.set(d.id,d));
      catalog.devices=[...map.values()];
      state.catalog=catalog;state.plans=plans.mobile_plans||catalog.mobile_plans||[];state.supports=supports.support_schedules||[];
      const q=new URLSearchParams(location.search);
      if(['SKT','KT','LGU+'].includes(q.get('c')))state.carrier=q.get('c');
      if(['기기변경','번호이동','신규가입'].includes(q.get('j')))state.join=q.get('j');
      $('device-browser-carrier').value=state.carrier;$('device-browser-join').value=state.join;
      fillPlanSelect(false);
      const qp=q.get('p');if(qp&&state.plans.some(p=>p.id===qp&&p.carrier===state.carrier)){state.planId=qp;$('device-browser-plan').value=qp}
      bind();render();root.dataset.state='ready';
    }catch(e){
      root.dataset.state='error';
      const list=$('device-browser-list');if(list)list.innerHTML='<p class="device-browser-error">기종 목록을 불러오지 못했습니다. 아래 상세 계산에서 직접 선택해 주세요.</p>';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();