(() => {
  'use strict';
  const results=document.getElementById('purpose-results');
  const section=document.getElementById('purpose-recommend');
  if(!results||!section)return;
  const API='https://woongbi-quote-api.woongbts.workers.dev/quote/mobile';
  const pins=[
    {id:'SKT-XD-2824',carrier:'SKT',name:'갤럭시 A17 LTE',planId:'SKT-XP-969',planName:'T플랜 세이브',data:'1.5GB+400Kbps 무제한',voice:'유무선무제한',sms:'무제한'}
  ];
  const cache=new Map();
  let cycle=0,scheduled=false;
  const currentCategory=()=>section.querySelector('[data-purpose-category].active')?.dataset.purposeCategory||'senior';
  const carrier=()=>document.getElementById('purpose-carrier')?.value||'all';
  const join=()=>document.getElementById('purpose-join')?.value||'번호이동';
  const pension=()=>Boolean(document.getElementById('purpose-pension')?.checked);
  const welfareType=()=>pension()?'basic_pension':'none';
  const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
  const safePrice=q=>q?.known===true&&Number.isFinite(Number(q.monthly))&&Number(q.monthly)>=0&&Number(q.planFee)===33000;
  async function quote(item,kind){
    const body={device_id:item.id,plan_id:item.planId,join_type:join(),method:kind,months:24,welfare_type:welfareType()};
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok)throw Error('quote '+response.status);
    const data=await response.json();
    return data?.ok===true?data.quote:null;
  }
  function quoteFor(item){
    const key=[item.id,join(),welfareType()].join(':');
    if(!cache.has(key)){
      const task=Promise.allSettled([quote(item,'support'),quote(item,'contract')]).then(out=>{
        const variants={support:null,contract:null};
        ['support','contract'].forEach((method,i)=>{
          const result=out[i];
          if(result.status==='fulfilled' && safePrice(result.value)) variants[method]=result.value;
        });
        const available=['support','contract'].filter(method=>variants[method]);
        available.sort((a,b)=>Number(variants[a].monthly)-Number(variants[b].monthly));
        return {support:variants.support,contract:variants.contract,best:available[0]||null};
      });
      cache.set(key,task);
    }
    return cache.get(key);
  }
  function linkFor(item,method){
    const params=new URLSearchParams({tab:'mobile',mode:'direct',c:item.carrier,j:join(),
      d:item.id,p:item.planId,m:method||'contract',mo:'24',w:welfareType()});
    return '/rates.html?'+params.toString();
  }
  function createCard(item){
    const card=document.createElement('article');
    card.className='purpose-card wb-server-card purpose-a17-priority';
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
    const reason=document.createElement('p');reason.className='wb-server-reason';
    reason.textContent='T플랜 세이브 기준 · 공시지원금과 선택약정을 비교합니다.';

    const totals=document.createElement('div');totals.className='purpose-card-total';
    const title=document.createElement('span');title.textContent='예상 월 납부액 · 선택약정 25%';
    const price=document.createElement('b');price.textContent='현재 조건 확인 중';
    totals.append(title,price);
    const note=document.createElement('p');note.className='quote-amount-note';
    note.textContent='매장 추가지원금·가족/인터넷 결합 미반영 · 최종 조건은 상담으로 확인';

    const specs=document.createElement('div');specs.className='wb-server-specs';
    [['데이터',item.data],['통화',item.voice]].forEach(([label,value])=>{
      const cell=document.createElement('span'),small=document.createElement('small'),strong=document.createElement('b');
      small.textContent=label;strong.textContent=value;cell.append(small,strong);specs.append(cell);
    });
    const details=document.createElement('details');details.className='recommend-details';
    const summary=document.createElement('summary');summary.textContent='요금 구성·할인 비교 자세히 보기';
    const body=document.createElement('div');body.className='recommend-details-body';
    const breakdown=document.createElement('div');breakdown.className='purpose-card-detail';
    const compare=document.createElement('div');compare.className='wb-server-compare';
    const choices={};
    [['support','공시지원금'],['contract','선택약정 25%']].forEach(([method,label])=>{
      const button=document.createElement('button');button.type='button';button.disabled=true;
      const small=document.createElement('small'),amount=document.createElement('b'),status=document.createElement('span');
      small.textContent=label;amount.textContent='매장 확인';status.textContent='금액 확인 중';
      button.append(small,amount,status);compare.append(button);
      choices[method]={button,amount,status};
      button.addEventListener('click',()=>{
        if(!card._a17View?.quotes?.[method])return;
        card._a17View.preferredMethod=method;
        void updateCard(card,item,++cycle);
      });
    });
    const why=document.createElement('div');why.className='wb-server-why';
    const whyTitle=document.createElement('strong');whyTitle.textContent='왜 부모님용 우선 추천인가요?';
    const whyText=document.createElement('span');
    whyText.textContent='월 33,000원 요금제 기준으로 두 할인방식의 예상 부담을 비교할 수 있습니다.';
    why.append(whyTitle,whyText);
    body.append(breakdown,compare,why);details.append(summary,body);

    const actions=document.createElement('div');actions.className='purpose-card-actions';
    const calc=document.createElement('button');calc.type='button';
    calc.className='senior-a17-details';calc.textContent='조건 바꿔 계산';
    calc.addEventListener('click',()=>{window.location.href=linkFor(item,card.dataset.selectedMethod);});
    const consult=document.createElement('button');consult.type='button';consult.className='primary';
    consult.textContent='이 조건으로 상담';
    consult.addEventListener('click',()=>{
      const v=card._a17View,selected=v?.currentQuote,method=card.dataset.selectedMethod;
      const message=[
        '[웅비통신 자동 추천 상담]',
        '용도: 효도폰 · 부모님용 우선 추천',
        '통신사: '+item.carrier,
        '가입유형: '+join(),
        '기종: '+item.name,
        '요금제: '+item.planName+' / 월 33,000원',
        '선택한 할인방식: '+(method==='support'?'공시지원금':'선택약정 25%'),
        '예상 월 납부액: '+(selected?won(selected.monthly):'매장 확인 필요'),
        ...(welfareType()==='basic_pension'?['기초연금 할인: '+(Number(selected?.welfare?.amount)>0?'-'+won(selected.welfare.amount):'적용 여부 상담 확인')]:[]),
        ...(selected?.total24!=null?['24개월 예상 총부담: '+won(selected.total24)]:[]),
        '매장 추가지원금·가족/인터넷 결합 미반영',
        '※ 실제 가입 가능 여부·지원금·복지 자격은 상담 시 최종 확인합니다.'
      ].join('\n');
      if(!window.WoongbiQuoteHandoff?.open(message)){
        const apply=card.querySelector('[data-store-purpose-apply]');
        if(apply)apply.click();else window.location.href=linkFor(item,method);
      }
    });
    actions.append(calc,consult);
    card.append(top,picture,name,plan,reason,totals,note,specs,details,actions);
    card._a17View={net,title,price,note,breakdown,choices,calc,currentQuote:null,quotes:null,preferredMethod:null,conditionKey:''};
    return card;
  }
  async function updateCard(card,item,version){
    const view=card._a17View;
    if(!view)return;
    const thisJoin=join(),thisWelfare=welfareType(),key=thisJoin+':'+thisWelfare;
    if(view.conditionKey!==key){view.preferredMethod=null;view.conditionKey=key;}
    view.net.textContent=item.carrier+' · '+thisJoin;
    view.price.textContent='현재 조건 확인 중';
    view.quotes=null;view.currentQuote=null;
    const available=await quoteFor(item);
    if(version!==cycle||!card.isConnected||join()!==thisJoin||welfareType()!==thisWelfare)return;
    view.quotes=available;
    const method=view.preferredMethod&&available[view.preferredMethod]
      ?view.preferredMethod:available.best;
    const selected=method?available[method]:null;
    view.currentQuote=selected;
    card.dataset.selectedMethod=method||'contract';
    const welfareDiscount=Number(selected?.welfare?.amount)||0;
    view.title.textContent='예상 월 납부액 · '+(method==='support'?'공시지원금':'선택약정 25%')+
      (thisWelfare==='basic_pension'?(welfareDiscount>0?' · 기초연금 할인 포함':' · 기초연금 할인 확인 필요'):'');
    view.price.textContent=selected?won(selected.monthly):'매장 확인 필요';
    view.breakdown.replaceChildren();
    const addRow=(label,value)=>{
      const row=document.createElement('div'),left=document.createElement('span'),right=document.createElement('b');
      left.textContent=label;right.textContent=value;row.append(left,right);view.breakdown.append(row);
    };
    const amount=value=>Number.isFinite(Number(value))&&value!=null?won(Number(value)):'매장 확인';
    if(selected){
      addRow('월 기기값 · 이자 포함',amount(selected.inst?.monthly));
      addRow('할인 후 통신요금',amount(selected.service));
      if(method==='support')addRow('적용 공시지원금','-'+amount(selected.support));
      else addRow('선택약정 월 할인','-'+amount(selected.contractDiscount));
      if(thisWelfare==='basic_pension'&&Number(selected.welfare?.amount)>0)
        addRow('기초연금 수급자 할인','-'+amount(selected.welfare.amount));
      addRow('문자',item.sms);
    }else addRow('예상 요금','상담 시 확인');
    view.note.textContent='매장 추가지원금·가족/인터넷 결합 미반영 · 최종 조건은 상담으로 확인';
    ['support','contract'].forEach(kind=>{
      const c=view.choices[kind],q=available[kind],isSelected=kind===method,isBest=kind===available.best;
      c.button.disabled=!q;c.button.classList.toggle('selected',Boolean(q&&isSelected));
      c.button.setAttribute('aria-pressed',String(Boolean(q&&isSelected)));
      c.amount.textContent=q?'월 '+won(q.monthly):'매장 확인';
      c.status.textContent=!q?'금액 확인 필요':isSelected?(isBest?'추천 · 선택됨':'선택됨'):(isBest?'추천 · 선택하기':'선택하기');
    });
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
    const alreadyFirst=wanted.every((item,i)=>results.children[i]?.dataset.seniorA17Pin===item.carrier);
    if(!alreadyFirst){
      // Reorder only when needed; otherwise the childList observer would repeat forever.
      for(let i=wanted.length-1;i>=0;i--){
        const item=wanted[i];
        let card=results.querySelector('[data-senior-a17-pin="'+item.carrier+'"]');
        if(!card)card=createCard(item);
        results.insertBefore(card,results.firstChild);
      }
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
