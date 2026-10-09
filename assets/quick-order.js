(() => {
  'use strict';
  const root=document.getElementById('quick-order');
  if(!root)return;
  const choices=document.getElementById('home-order-choices');
  const heading=document.getElementById('home-order-choice-title');
  const explanation=document.getElementById('home-order-choice-description');
  if(!choices||!heading||!explanation)return;
  const base='/rates.html?tab=';
  const options={
    mobile:{
      heading:'어떤 휴대폰이 필요하세요?',
      info:'용도를 고르면 해당 휴대폰 추천과 계산 화면으로 바로 이동합니다.',
      items:[
        ['효도폰','부모님께 필요한 기종 추천',base+'mobile&purpose=senior&src=home-easy'],
        ['키즈폰','아이 첫 휴대폰 추천',base+'mobile&purpose=kids&src=home-easy'],
        ['가성비폰','부담 적은 기종 추천',base+'mobile&purpose=value&src=home-easy'],
        ['프리미엄폰','최신·고성능 기종 추천',base+'mobile&purpose=premium&src=home-easy']
      ]
    },
    mvno:{
      heading:'알뜰폰 요금제부터 확인하세요',
      info:'현재 안내 가능한 상품을 비교한 뒤 원하는 요금제로 상담을 신청할 수 있어요.',
      items:[
        ['추천 요금제 보기','데이터·요금 기준 추천 상품',base+'mvno&src=home-easy-recommend'],
        ['전체 요금제 비교','원하는 통신망과 요금제 선택',base+'mvno&src=home-easy-all']
      ]
    },
    prepaid:{
      heading:'선불폰 사용량을 골라보세요',
      info:'매장에서 자주 선택하는 선불 요금제 3종을 먼저 확인하세요.',
      items:[
        ['가볍게 사용','300MB + 1Mbps 상품부터 보기',base+'prepaid&src=home-easy-light'],
        ['데이터 넉넉하게','10.3GB 상품부터 보기',base+'prepaid&src=home-easy-data'],
        ['데이터 무제한 선호','안심 11GB 상품부터 보기',base+'prepaid&src=home-easy-unlimited']
      ]
    },
    internet:{
      heading:'인터넷 속도와 TV만 선택하세요',
      info:'선택한 구성으로 SK·KT·LG의 예상 월요금과 사은품을 비교해요.',
      items:[
        ['100M · 인터넷만','가벼운 인터넷 사용',base+'internet&qs=100&qt=none&src=home-easy'],
        ['500M · 인터넷만','인터넷 중심으로 사용',base+'internet&qs=500&qt=none&src=home-easy'],
        ['500M · 인터넷 + TV','가장 먼저 비교하기 좋은 구성',base+'internet&qs=500&qt=basic&src=home-easy'],
        ['1G · 인터넷 + TV','빠른 인터넷과 TV',base+'internet&qs=1000&qt=basic&src=home-easy']
      ]
    },
    rental:{
      heading:'렌탈 상품을 둘러보세요',
      info:'웅비렌탈에서 제품 사진과 렌탈료·사은품을 확인할 수 있어요.',
      items:[
        ['정수기 · 생활가전','상품별 월 렌탈료 비교','/rental/?src=home-easy'],
        ['맞춤 상품 추천','웅비렌탈에서 AI 추천받기','/rental/?ai=1&src=home-easy']
      ]
    },
    visit:{
      heading:'편한 방법으로 방문을 준비하세요',
      info:'매장 방문 전 전화나 예약으로 상담 시간을 확인해 주세요.',
      items:[
        ['선택한 상품으로 방문 예약','예약 전 상담내용 확인·복사','/visit.html?src=home-easy'],
        ['전화 상담','051-343-7677로 바로 전화','tel:0513437677'],
        ['매장 위치 보기','남산정역 3번 출구 인근','https://naver.me/xLNYT8fk']
      ]
    }
  };
  const buttons=[...root.querySelectorAll('[data-quick-category]')];
  function selectCategory(category,focus=false){
    const entry=options[category];
    if(!entry)return;
    root.dataset.activeCategory=category;
    buttons.forEach(link=>{
      const selected=link.dataset.quickCategory===category;
      link.classList.toggle('is-active',selected);
      if(selected)link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    });
    heading.textContent=entry.heading;
    explanation.textContent=entry.info;
    choices.replaceChildren();
    entry.items.forEach(([title,description,url])=>{
      const link=document.createElement('a');
      link.className='home-order-option';
      link.href=url;
      const copy=document.createElement('span');
      const label=document.createElement('strong');label.textContent=title;
      const note=document.createElement('small');note.textContent=description;
      const arrow=document.createElement('span');arrow.className='home-order-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='→';
      copy.append(label,note);link.append(copy,arrow);
      link.addEventListener('click',()=>{try{window.woongbiTrackConversion?.('home_quick_order_continue',{category})}catch{}});
      choices.append(link);
    });
    if(focus && matchMedia('(max-width:760px)').matches){
      document.getElementById('home-order-choice')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }
  buttons.forEach(link=>link.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();
    selectCategory(link.dataset.quickCategory,true);
    try{window.woongbiTrackConversion?.('home_quick_order_category',{category:link.dataset.quickCategory})}catch{}
  }));
  selectCategory('mobile');
})();
