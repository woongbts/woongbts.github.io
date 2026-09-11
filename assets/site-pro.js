(function(){
  const s=document.createElement('script');
  s.src='assets/site-pro-core.js?v=20260912-1';
  s.onload=function(){
    const cards=document.querySelectorAll('.principle');
    if(cards[1]){const copy=cards[1].querySelector('p');if(copy)copy.textContent='상품보다 고객의 사용 패턴과 필요한 조건을 먼저 파악합니다.';}
    if(cards[2]){const title=cards[2].querySelector('h3');const copy=cards[2].querySelector('p');if(title)title.textContent='팔았다고 끝이라 생각하지 않겠습니다';if(copy)copy.innerHTML='구매 이후 몇년이 지나도 언제든 문의주시면<br>최선을 다해 상담드리겠습니다.';}

    const nav=document.querySelector('.menu');
    if(nav&&!nav.querySelector('a[href="#news"]')){
      const a=document.createElement('a');a.href='#news';a.textContent='웅비통신 소식';
      const social=nav.querySelector('a[href="/links.html"]');
      social?nav.insertBefore(a,social):nav.appendChild(a);
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
      const reviews=document.getElementById('reviews');
      reviews?reviews.insertAdjacentElement('afterend',section):document.querySelector('main').appendChild(section);
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