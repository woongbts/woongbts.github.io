(function(){
  const s=document.createElement('script');
  s.src='assets/site-pro-core.js?v=20260912-1';
  s.onload=function(){
    const cards=document.querySelectorAll('.principle');
    if(cards[1]){const copy=cards[1].querySelector('p');if(copy)copy.textContent='상품보다 고객의 사용 패턴과 필요한 조건을 먼저 파악합니다.';}
    if(cards[2]){const title=cards[2].querySelector('h3');const copy=cards[2].querySelector('p');if(title)title.textContent='팔았다고 끝이라 생각하지 않겠습니다';if(copy)copy.innerHTML='구매 이후 몇년이 지나도 언제든 문의주시면<br>최선을 다해 상담드리겠습니다.';}

    const services=document.querySelector('#services .grid');
    if(services){
      services.innerHTML=`
        <article class="card"><span class="number">01 / 휴대폰</span><h3>휴대폰</h3><p>신규가입, 기기변경, 번호이동 등 휴대폰 구매와 변경을 상담합니다.</p><a href="tel:0513437677">전화로 문의하기 →</a></article>
        <article class="card"><span class="number">02 / 알뜰폰·선불폰</span><h3>알뜰폰·선불폰</h3><p>사용 패턴과 원하는 조건을 확인해 알뜰폰·선불폰 개통을 상담합니다.</p><a href="tel:0513437677">전화로 문의하기 →</a></article>
        <article class="card"><span class="number">03 / 인터넷·TV</span><h3>인터넷·TV</h3><p>신규가입, 이전설치, 재약정 등 현재 이용 상황부터 확인합니다.</p><a href="tel:0513437677">전화로 문의하기 →</a></article>
        <article class="card rental-service-card"><span class="number">04 / 정수기·가전렌탈</span><h3>정수기·가전렌탈</h3><p>정수기와 생활가전 렌탈 상품을 각각 편하게 확인해 보세요.</p><div class="rental-buttons"><a class="rental-link rental-water-link" href="http://woongbi.vip-rental.com" target="_blank" rel="noopener noreferrer">정수기 렌탈 보기 →</a><a class="rental-link rental-appliance-link" href="https://clvrental777.com/" target="_blank" rel="noopener noreferrer">생활가전 렌탈 보기 →</a></div></article>`;
    }

    if(!document.getElementById('service-grid-2x2')){
      const serviceStyle=document.createElement('style');serviceStyle.id='service-grid-2x2';serviceStyle.textContent=`
        #services .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #services .card{min-width:0}
        #services .rental-buttons{display:flex;gap:9px;flex-wrap:wrap;margin-top:auto;padding-top:16px}
        #services .rental-buttons .rental-link{display:inline-flex;align-items:center;justify-content:center;flex:1 1 180px;min-height:44px;margin:0!important;padding:10px 13px!important;border:1px solid transparent;border-radius:12px;color:#fff!important;font-size:.82rem;font-weight:900;text-align:center;text-decoration:none;box-shadow:0 7px 16px rgba(16,60,82,.13);transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
        #services .rental-buttons .rental-water-link{background:#0f766e!important;border-color:#0f766e!important}
        #services .rental-buttons .rental-appliance-link{background:#2563eb!important;border-color:#2563eb!important;color:#fff!important}
        #services .rental-buttons .rental-link:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(16,60,82,.18);filter:brightness(1.05)}
        @media(max-width:640px){#services .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}#services .card{padding:16px!important}#services .card .number{font-size:.68rem}#services .card h3{font-size:1rem;line-height:1.35}#services .card p{font-size:.8rem;line-height:1.48}#services .card>a:not(.rental-link){font-size:.78rem}#services .rental-buttons{gap:6px;padding-top:10px}#services .rental-buttons .rental-link{flex:1 1 100%;min-height:39px;padding:8px!important;font-size:.72rem}}
      `;document.head.appendChild(serviceStyle);
    }

    const about=document.getElementById('about');
    if(about){
      const heading=about.querySelector('h2');if(heading)heading.innerHTML='오래 믿고 찾을 수 있는<br>동네 통신매장이 되겠습니다.';
      const facts=about.querySelector('.facts');if(facts)facts.remove();
      const ownerCopy=about.querySelector('.owner-note p');if(ownerCopy)ownerCopy.textContent='복잡한 조건보다 이해하기 쉬운 설명으로, 필요할 때 다시 찾아올 수 있는 매장을 지향합니다.';
      if(!document.getElementById('about-compact-style')){const st=document.createElement('style');st.id='about-compact-style';st.textContent='#about .strengths{grid-template-columns:minmax(0,760px)!important;justify-content:start}#about .owner-note{max-width:760px}';document.head.appendChild(st);}
    }

    const quickCta=document.querySelector('.quick-cta');if(quickCta)quickCta.remove();
    const lowerReviews=document.getElementById('reviews');if(lowerReviews)lowerReviews.remove();
    const steps=document.querySelector('.steps');if(steps&&steps.closest('section'))steps.closest('section').remove();
    const bottomContact=document.querySelector('.contact');if(bottomContact)bottomContact.remove();

    const nav=document.querySelector('.menu');
    if(nav){
      const reviewLink=nav.querySelector('a[href="#reviews"]');if(reviewLink)reviewLink.href='#review-highlight';
      if(!nav.querySelector('a[href="#news"]')){const a=document.createElement('a');a.href='#news';a.textContent='웅비통신 소식';const social=nav.querySelector('a[href="/links.html"]');social?nav.insertBefore(a,social):nav.appendChild(a);}
    }

    const locationActions=document.querySelector('#location .actions');
    if(locationActions&&!locationActions.querySelector('.naver-booking-link')){
      const booking=document.createElement('a');
      booking.className='btn naver-booking-link';
      booking.style.background='#2563eb';booking.style.borderColor='#2563eb';booking.style.color='#fff';
      booking.href='https://pcmap.place.naver.com/place/1853546364/ticket?bookingRedirectUrl=https%3A%2F%2Fm.booking.naver.com%2Fbooking%2F6%2Fbizes%2F281910%3Ftheme%3Dplace%26service-target%3Dmap-pc%26entry%3Dbmp%26lang%3Dko&entry=bmp&fromPanelNum=2&timestamp=202609111203&locale=ko&svcName=map_pcv5&searchText=%EC%9B%85%EB%B9%84%ED%86%B5%EC%8B%A0&area=bmp';
      booking.target='_blank';booking.rel='noopener noreferrer';booking.textContent='네이버 예약하기';
      const kakao=locationActions.querySelector('a.kakao');
      kakao?locationActions.insertBefore(booking,kakao):locationActions.appendChild(booking);
    }

    if(!document.getElementById('woongbi-news-style')){
      const st=document.createElement('style');st.id='woongbi-news-style';st.textContent=`
        #news{background:#f7fafb;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
        .news-head{display:flex;justify-content:space-between;align-items:end;gap:24px}
        .news-head h2{margin-bottom:0}.news-more{font-weight:900;color:var(--teal);text-decoration:underline;text-underline-offset:4px;white-space:nowrap}
        .news-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:26px}
        .news-card{display:flex;flex-direction:column;min-height:205px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 8px 24px rgba(16,60,82,.05);transition:.2s ease}
        .news-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(16,60,82,.09)}
        .news-meta{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.news-source{display:inline-flex;align-items:center;border-radius:999px;background:#dff3f0;color:#075f59;font-size:.72rem;font-weight:900;padding:5px 8px}.news-date{color:var(--muted);font-size:.76rem}
        .news-card h3{font-size:1.03rem;line-height:1.48;color:var(--blue);margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.news-card p{font-size:.86rem;line-height:1.55;color:var(--muted);margin:10px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.news-open{margin-top:auto;padding-top:16px;color:var(--teal);font-weight:900;font-size:.84rem}
        .news-empty{grid-column:1/-1;background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;color:var(--muted)}
        @media(max-width:820px){.news-head{align-items:flex-start;flex-direction:column;gap:8px}.news-grid{display:flex;overflow-x:auto;gap:12px;scroll-snap-type:x mandatory;padding-bottom:8px;-webkit-overflow-scrolling:touch}.news-grid::-webkit-scrollbar{display:none}.news-card{flex:0 0 min(82vw,320px);min-height:205px;scroll-snap-align:start}.news-empty{flex:1 0 100%}}
      `;document.head.appendChild(st);
    }

    if(!document.getElementById('news')){
      const section=document.createElement('section');section.className='content';section.id='news';
      section.innerHTML=`<div class="wrap"><p class="eyebrow">웅비통신 소식</p><div class="news-head"><h2>매장에서 전하는<br>새로운 소식과 이야기</h2><a class="news-more" href="https://blog.naver.com/swb3301" target="_blank" rel="noopener noreferrer">네이버 블로그 더 보기 →</a></div><div class="news-grid" id="news-grid"><div class="news-empty">최신 소식을 불러오는 중입니다.</div></div></div>`;
      const principles=document.getElementById('principles');
      principles?principles.insertAdjacentElement('afterend',section):document.querySelector('main').appendChild(section);
    }

    const grid=document.getElementById('news-grid');
    if(grid){
      fetch('news.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('news');return r.json()}).then(data=>{
        const items=Array.isArray(data.items)?data.items.slice(0,3):[];
        if(!items.length){grid.innerHTML='<a class="news-empty" href="https://blog.naver.com/swb3301" target="_blank" rel="noopener noreferrer">웅비통신 네이버 블로그에서 최신 소식을 확인해 주세요 →</a>';return;}
        grid.innerHTML=items.map(item=>`<a class="news-card" href="${item.url}" target="_blank" rel="noopener noreferrer"><div class="news-meta"><span class="news-source">${item.source||'BLOG'}</span><span class="news-date">${item.date||''}</span></div><h3>${escapeNews(item.title||'')}</h3>${item.summary?`<p>${escapeNews(item.summary)}</p>`:''}<span class="news-open">원문 보기 →</span></a>`).join('');
      }).catch(()=>{grid.innerHTML='<a class="news-empty" href="https://blog.naver.com/swb3301" target="_blank" rel="noopener noreferrer">웅비통신 네이버 블로그에서 최신 소식을 확인해 주세요 →</a>';});
    }
  };
  document.head.appendChild(s);
  function escapeNews(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
})();