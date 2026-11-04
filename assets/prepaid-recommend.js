(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const IDS=['PRE-FREETSKT-1518','PRE-FREETKT-1429','PRE-FREETLG-1523'];
  const COPY={
    'PRE-FREETSKT-1518':{tag:'SKT망 · 기본형',note:'선불 데이터 300MB와 기본제공 통화·문자를 비교하는 구성입니다.'},
    'PRE-FREETKT-1429':{tag:'KT망 · 15GB',note:'15GB 제공 이후의 데이터 속도 조건까지 비교해 보세요.'},
    'PRE-FREETLG-1523':{tag:'LG U+망 · 넉넉한 데이터',note:'일일 추가 데이터 제공 조건을 포함해 비교해 보세요.'}
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
        const popular=document.createElement('small');popular.textContent='프리티 선불';
        top.append(badge,popular);
        const name=document.createElement('h3');name.textContent=plan.name;
        const provider=document.createElement('p');provider.className='prepaid-recommend-provider';provider.textContent=providers.get(plan.provider_id)?.name||'프리티 선불';
        const price=document.createElement('strong');price.className='prepaid-recommend-price';price.textContent=won(plan.monthly_fee);
        const specs=document.createElement('div');specs.className='prepaid-recommend-specs';
        [['데이터',plan.data],['통화',plan.voice],['문자',plan.sms]].forEach(([label,value])=>{
          const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('b');
          a.textContent=label;b.textContent=value||'확인 필요';row.append(a,b);specs.append(row);
        });
        const note=document.createElement('p');note.className='prepaid-recommend-note';note.textContent=COPY[plan.id]?.note||'프리티 선불 상품의 개통 조건은 신청 단계에서 확인합니다.';
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
    provider.value=btn.dataset.prepaidRecommend.split('-')[1]||'FREETLG';provider.dispatchEvent(new Event('change',{bubbles:true}));
    const id=btn.dataset.prepaidRecommend;
    if([...plan.options].some(o=>o.value===id)){
      plan.value=id;plan.dispatchEvent(new Event('change',{bubbles:true}));
      $('prepaid-form')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();