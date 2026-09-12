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

    const promoEnd=new Date('2026-09-18T00:00:00+09:00');
    if(new Date()<promoEnd&&!document.getElementById('iphone18-promo')){
      if(!document.getElementById('iphone18-promo-style')){
        const pst=document.createElement('style');pst.id='iphone18-promo-style';pst.textContent=`
          .iphone18-promo{padding:26px 0;background:#fff;border-bottom:1px solid var(--line)}
          .iphone18-promo-card{display:grid;grid-template-columns:170px minmax(0,1fr);gap:28px;align-items:center;padding:24px 28px;border:1px solid #d7e1e5;border-radius:22px;background:linear-gradient(135deg,#f7fafb 0%,#fff 52%,#edf5ff 100%);box-shadow:0 12px 30px rgba(16,60,82,.07)}
          .iphone18-promo-preview{width:150px;height:220px;margin:auto;border:0;border-radius:28px;background:linear-gradient(160deg,#101215,#283447 55%,#101215);box-shadow:0 15px 30px rgba(8,20,32,.22);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;position:relative;overflow:hidden}
          .iphone18-promo-preview:before{content:'';position:absolute;inset:7px;border:1px solid rgba(255,255,255,.15);border-radius:22px}.iphone18-promo-preview:after{content:'iPhone 18';position:absolute;left:0;right:0;bottom:26px;color:rgba(255,255,255,.72);font-size:.78rem;font-weight:800;letter-spacing:.02em}
          .iphone18-play{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding-left:4px;background:#fff;color:#111;font-size:1.25rem;box-shadow:0 9px 24px rgba(0,0,0,.28)}
          .iphone18-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#111827;color:#fff;font-size:.76rem;font-weight:900;margin-bottom:10px}.iphone18-promo-copy h2{font-size:clamp(1.8rem,3vw,2.45rem);margin:0;line-height:1.2}.iphone18-period{margin-top:8px;color:#2563eb;font-weight:900}.iphone18-description{margin-top:8px;color:var(--muted);font-size:.95rem}.iphone18-promo-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}.iphone18-video-button{background:#111827!important;border-color:#111827!important}.iphone18-video-modal{position:fixed;inset:0;z-index:420;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(3,11,18,.88);backdrop-filter:blur(8px)}.iphone18-video-modal.open{display:flex}.iphone18-video-panel{position:relative;width:min(430px,94vw);max-height:92vh;display:flex;flex-direction:column;align-items:center}.iphone18-video-close{position:absolute;z-index:2;right:-4px;top:-46px;width:40px;height:40px;border:1px solid rgba(255,255,255,.42);border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font-size:1.45rem;cursor:pointer}.iphone18-video{display:block;width:auto;max-width:100%;height:auto;max-height:78vh;aspect-ratio:9/16;background:#000;border-radius:20px;box-shadow:0 22px 60px rgba(0,0,0,.42)}.iphone18-video-fallback{margin-top:12px;color:#fff;text-decoration:underline;text-underline-offset:3px;font-size:.86rem}.promo-video-open{overflow:hidden}
          @media(max-width:640px){.iphone18-promo{padding:16px 0}.iphone18-promo-card{grid-template-columns:92px minmax(0,1fr);gap:15px;padding:16px;border-radius:18px}.iphone18-promo-preview{width:82px;height:126px;border-radius:18px}.iphone18-promo-preview:before{inset:5px;border-radius:14px}.iphone18-promo-preview:after{bottom:13px;font-size:.57rem}.iphone18-play{width:38px;height:38px;font-size:.9rem}.iphone18-badge{font-size:.65rem;margin-bottom:7px}.iphone18-promo-copy h2{font-size:1.35rem}.iphone18-period{font-size:.82rem;margin-top:5px}.iphone18-description{display:none}.iphone18-promo-actions{margin-top:11px;gap:6px}.iphone18-promo-actions .btn{min-height:40px;padding:8px 10px;font-size:.75rem}}
        `;document.head.appendChild(pst);
      }
      const promo=document.createElement('section');promo.className='iphone18-promo';promo.id='iphone18-promo';promo.setAttribute('aria-label','iPhone 18 사전예약 안내');
      promo.innerHTML=`<div class="wrap"><div class="iphone18-promo-card"><button class="iphone18-promo-preview iphone18-video-open" type="button" aria-label="iPhone 18 사전예약 영상 보기"><span class="iphone18-play">▶</span></button><div class="iphone18-promo-copy"><span class="iphone18-badge">기간 한정 · 사전예약</span><h2>iPhone 18 사전예약</h2><p class="iphone18-period">9월 12일 오후 9시 ~ 9월 17일</p><p class="iphone18-description">짧은 영상으로 사전예약 소식을 빠르게 확인해 보세요.</p><div class="iphone18-promo-actions"><button class="btn iphone18-video-button iphone18-video-open" type="button">▶ 사전예약 영상 보기</button><a class="btn outline" href="tel:0513437677">전화 문의</a></div></div></div></div>`;
      const hero=document.querySelector('.hero');hero?hero.insertAdjacentElement('afterend',promo):document.querySelector('main').prepend(promo);
      const modal=document.createElement('div');modal.className='iphone18-video-modal';modal.id='iphone18-video-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','iPhone 18 사전예약 영상');modal.setAttribute('aria-hidden','true');
      modal.innerHTML=`<div class="iphone18-video-panel"><button class="iphone18-video-close" type="button" aria-label="영상 닫기">×</button><video class="iphone18-video" id="iphone18-video" controls playsinline preload="metadata"><source src="F10E20A7-B603-486B-A07A-513890E13988.mov" type="video/quicktime">브라우저에서 영상을 재생할 수 없습니다.</video><a class="iphone18-video-fallback" href="F10E20A7-B603-486B-A07A-513890E13988.mov" target="_blank" rel="noopener noreferrer">영상이 재생되지 않으면 새 창에서 열기</a></div>`;
      document.body.appendChild(modal);
      const video=modal.querySelector('#iphone18-video'),close=modal.querySelector('.iphone18-video-close');let lastPromoTrigger=null;
      function openPromoVideo(e){lastPromoTrigger=e.currentTarget;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('promo-video-open');if(video)video.play().catch(()=>{});if(close)close.focus();}
      function closePromoVideo(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('promo-video-open');if(video){video.pause();try{video.currentTime=0}catch(e){}}if(lastPromoTrigger)lastPromoTrigger.focus();}
      promo.querySelectorAll('.iphone18-video-open').forEach(el=>el.addEventListener('click',openPromoVideo));if(close)close.addEventListener('click',closePromoVideo);modal.addEventListener('click',e=>{if(e.target===modal)closePromoVideo()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closePromoVideo()});
    }

    const locationActions=document.querySelector('#location .actions');
    if(locationActions){
      if(!locationActions.querySelector('.naver-booking-link')){
        const booking=document.createElement('a');
        booking.className='btn naver-booking-link';
        booking.style.background='#2563eb';booking.style.borderColor='#2563eb';booking.style.color='#fff';
        booking.href='https://pcmap.place.naver.com/place/1853546364/ticket?bookingRedirectUrl=https%3A%2F%2Fm.booking.naver.com%2Fbooking%2F6%2Fbizes%2F281910%3Ftheme%3Dplace%26service-target%3Dmap-pc%26entry%3Dbmp%26lang%3Dko&entry=bmp&fromPanelNum=2&timestamp=202609111203&locale=ko&svcName=map_pcv5&searchText=%EC%9B%85%EB%B9%84%ED%86%B5%EC%8B%A0&area=bmp';
        booking.target='_blank';booking.rel='noopener noreferrer';booking.textContent='네이버 예약하기';
        const kakao=locationActions.querySelector('a.kakao');
        kakao?locationActions.insertBefore(booking,kakao):locationActions.appendChild(booking);
      }
      if(!locationActions.querySelector('.kakao-friend-link')){
        const friend=document.createElement('a');
        friend.className='btn kakao-friend-link';
        friend.style.background='#3c1e1e';friend.style.borderColor='#3c1e1e';friend.style.color='#fff';
        friend.href='http://pf.kakao.com/_nWwNT/friend';
        friend.target='_blank';friend.rel='noopener noreferrer';friend.textContent='카카오톡 친구추가';
        locationActions.appendChild(friend);
      }
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