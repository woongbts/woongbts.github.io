(() => {
  'use strict';
  const results=document.getElementById('purpose-results');
  const section=document.getElementById('purpose-recommend');
  if(!results||!section)return;
  const API='https://woongbi-quote-api.woongbts.workers.dev/quote/mobile';
  const pins=[
    {id:'SKT-XD-2824',carrier:'SKT',name:'갤럭시 A17 LTE',planId:'SKT-XP-969',planName:'T플랜 세이브'},
    {id:'LG-XD-2826',carrier:'LGU+',name:'갤럭시 A17 LTE',planId:'LG-XP-2512',planName:'데이터플랜1.5GB'}
  ];
  const cache=new Map();
  let cycle=0,scheduled=false;
  const currentCategory=()=>section.querySelector('[data-purpose-category].active')?.dataset.purposeCategory||'senior';
  const carrier=()=>document.getElementById('purpose-carrier')?.value||'all';
  const join=()=>document.getElementById('purpose-join')?.value||'번호이동';
  const pension=()=>Boolean(document.getElementById('purpose-pension')?.checked);
  const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
  const safePrice=q=>q?.known===true&&Number.isFinite(Number(q.monthly))&&Number(q.monthly)>=0&&Number(q.planFee)===33000;
  async function quote(item,kind){
    const body={device_id:item.id,plan_id:item.planId,join_type:join(),method:kind,months:24,welfare_type:'none'};
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok)throw Error('quote '+response.status);
    const data=await response.json();
    return data?.ok===true?data.quote:null;
  }
  function quoteFor(item){
    const key=[item.id,join()].join(':');
    if(!cache.has(key)){
      const task=Promise.allSettled([quote(item,'support'),quote(item,'contract')]).then(out=>{
        const choices=out.map((o,i)=>o.status==='fulfilled'?{q:o.value,method:i===0?'support':'contract'}:null)
          .filter(x=>x&&safePrice(x.q)).sort((a,b)=>Number(a.q.monthly)-Number(b.q.monthly));
        return choices[0]||null;
      });
      cache.set(key,task);
    }
    return cache.get(key);
  }
  function linkFor(item,method){
    const params=new URLSearchParams({tab:'mobile',mode:'direct',c:item.carrier,j:join(),
      d:item.id,p:item.planId,m:method||'contract',mo:'24',w:'none'});
    return '/rates.html?'+params.toString();
  }
  function createCard(item){
    const card=document.createElement('article');
    card.className='purpose-card purpose-a17-priority';
    card.dataset.seniorA17Pin=item.carrier;
    card.dataset.seniorKind='smartphone';
    card.dataset.deviceId=item.id;
    card.dataset.planId=item.planId;
    card.dataset.selectedMethod='contract';
    const top=document.createElement('div');top.className='purpose-card-top';
    const net=document.createElement('span');net.textContent=item.carrier+' · '+join();
    const badge=document.createElement('small');badge.textContent='부모님용 우선 추천';
    top.append(net,badge);
    const picture=document.createElement('div');picture.className='device-card-image purpose-device-image';
    const img=document.createElement('img');img.src='/assets/device-images/galaxya17.png';
    img.alt=item.name;img.loading='lazy';img.decoding='async';picture.append(img);
    const name=document.createElement('strong');name.textContent=item.name;
    const plan=document.createElement('em');plan.textContent=item.planName+' · 월 33,000원';
    const totals=document.createElement('div');totals.className='purpose-card-total';
    const title=document.createElement('span');title.textContent='예상 월 납부액 · 기기값 + 통신요금';
    const price=document.createElement('b');price.textContent='현재 조건 확인 중';
    totals.append(title,price);
    const note=document.createElement('p');note.className='quote-amount-note';
    note.textContent='번호이동 · 24개월 기준 · 최신 공시지원금 및 선택약정 확인 중';
    const actions=document.createElement('div');actions.className='purpose-card-actions';
    const details=document.createElement('a');details.href=linkFor(item,'contract');
    details.className='senior-a17-details';details.textContent='이 조건으로 계산하기 →';
    actions.append(details);
    card.append(top,picture,name,plan,totals,note,actions);
    card._a17View={net,price,note,details};
    return card;
  }
  async function updateCard(card,item,version){
    const view=card._a17View;
    if(!view)return;
    const thisJoin=join();
    view.net.textContent=item.carrier+' · '+thisJoin;
    view.price.textContent='현재 조건 확인 중';
    view.note.textContent='24개월 기준 · 공시지원금·선택약정 계산 중';
    view.details.href=linkFor(item,'contract');
    const chosen=await quoteFor(item);
    if(version!==cycle||!card.isConnected||join()!==thisJoin)return;
    if(chosen){
      view.price.textContent=won(chosen.q.monthly);
      card.dataset.selectedMethod=chosen.method;
      view.note.textContent=(chosen.method==='support'?'공시지원금':'선택약정 25%')+
        ' · 24개월 단말 할부이자 포함 · '+(pension()?'기초연금 할인 별도 확인':'복지할인 미적용');
      view.details.href=linkFor(item,chosen.method);
    }else{
      view.price.textContent='매장 확인 필요';
      view.note.textContent='현재 공시지원금·선택약정 견적을 확인하지 못했습니다. 금액은 상담 시 안내합니다.';
    }
  }
  function syncCards(){
    if(currentCategory()!=='senior'){
      results.querySelectorAll('[data-senior-a17-pin]').forEach(card=>card.remove());
      return;
    }
    const selected=carrier();
    const wanted=pins.filter(x=>selected==='all'||selected===x.carrier);
    results.querySelectorAll('[data-senior-a17-pin]').forEach(card=>{
      if(!wanted.some(x=>x.carrier===card.dataset.seniorA17Pin))card.remove();
    });
    // Keep the original server recommendations intact, only ensure A17 precedes them.
    let next=results.firstChild;
    for(let i=wanted.length-1;i>=0;i--){
      const item=wanted[i];
      let card=results.querySelector('[data-senior-a17-pin="'+item.carrier+'"]');
      if(!card){card=createCard(item);results.insertBefore(card,results.firstChild);}
      else if(card!==results.firstChild)results.insertBefore(card,results.firstChild);
    }
    const loading=[...results.children].filter(node=>node.tagName==='P'&&/추천 조건을 불러오는 중/.test(node.textContent||''));
    if(wanted.length)loading.forEach(node=>node.remove());
    const stamp=++cycle;
    wanted.forEach(item=>{
      const card=results.querySelector('[data-senior-a17-pin="'+item.carrier+'"]');
      if(card)void updateCard(card,item,stamp);
    });
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;syncCards();});
  }
  section.querySelectorAll('[data-purpose-category]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(schedule,0)));
  ['purpose-carrier','purpose-join','purpose-pension'].forEach(id=>
    document.getElementById(id)?.addEventListener('change',()=>setTimeout(schedule,0)));
  window.addEventListener('woongbi:senior-phone-type-change',schedule);
  const observer=new MutationObserver(schedule);
  observer.observe(results,{childList:true,subtree:false});
  schedule();
})();
