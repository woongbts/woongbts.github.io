(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const IDS=['PRE-FREETLG-1521','PRE-FREETLG-1879','PRE-FREETLG-1523'];
  const COPY={
    'PRE-FREETLG-1521':{tag:'가볍게',note:'통화·문자는 넉넉하게, 데이터는 가볍게 쓰는 분들이 많이 고릅니다.'},
    'PRE-FREETLG-1879':{tag:'실속 데이터',note:'월 데이터도 넉넉히 쓰면서 요금 부담을 맞추려는 분들이 많이 찾습니다.'},
    'PRE-FREETLG-1523':{tag:'데이터 무제한',note:'데이터 사용량이 많은 분들이 가장 많이 비교하는 무제한형 요금제입니다.'}
  };
  const won=v=>Number(v||0).toLocaleString('ko-KR')+'원';
  async function init(){
    const root=$('prepaid-recommend'); if(!root)return;
    const list=$('prepaid-recommend-list'); if(!list)return;
    try{
      const data=await fetch('data/prepaid.json?v=20260917-2').then(r=>r.json());
      const providers=new Map((data.providers||[]).map(p=>[p.id,p]));
      const plans=IDS.map(id=>(data.plans||[]).find(p=>p.id===id)).filter(Boolean);
      list.innerHTML='';
      plans.forEach((plan,index)=>{
        const card=document.createElement('article');card.className='prepaid-recommend-card';
        const top=document.createElement('div');top.className='prepaid-recommend-top';
        const badge=document.createElement('span');badge.textContent=COPY[plan.id]?.tag||'추천';
        const popular=document.createElement('small');popular.textContent='매장 인기';
        top.append(badge,popular);
        const name=document.createElement('h3');name.textContent=plan.name;
        const provider=document.createElement('p');provider.className='prepaid-recommend-provider';provider.textContent=providers.get(plan.provider_id)?.name||'프리티(LGU+망)';
        const price=document.createElement('strong');price.className='prepaid-recommend-price';price.textContent=won(plan.monthly_fee);
        const specs=document.createElement('div');specs.className='prepaid-recommend-specs';
        [['데이터',plan.data],['통화',plan.voice],['문자',plan.sms]].forEach(([label,value])=>{
          const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('b');
          a.textContent=label;b.textContent=value||'확인 필요';row.append(a,b);specs.append(row);
        });
        const note=document.createElement('p');note.className='prepaid-recommend-note';note.textContent=COPY[plan.id]?.note||'매장에서 많이 비교하는 선불 요금제입니다.';
        const button=document.createElement('button');button.type='button';button.textContent='이 요금제 선택';button.dataset.prepaidRecommend=plan.id;
        card.append(top,name,provider,price,specs,note,button);list.append(card);
      });
      root.hidden=!plans.length;
    }catch(e){
      root.hidden=true;
    }
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-prepaid-recommend]');if(!btn)return;
    const provider=$('prepaid-provider'),plan=$('prepaid-plan');if(!provider||!plan)return;
    provider.value='FREETLG';provider.dispatchEvent(new Event('change',{bubbles:true}));
    const id=btn.dataset.prepaidRecommend;
    if([...plan.options].some(o=>o.value===id)){
      plan.value=id;plan.dispatchEvent(new Event('change',{bubbles:true}));
      $('prepaid-form')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();