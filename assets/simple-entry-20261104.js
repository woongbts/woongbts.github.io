(() => {
  'use strict';
  const panel=document.getElementById('home-self-compare');
  const toggle=document.getElementById('home-direct-toggle');
  if(!panel)return;
  const triggers=[...document.querySelectorAll('a[href="#home-self-compare"]')];
  const sync=()=>{
    const expanded=!panel.hidden;
    triggers.forEach(link=>{
      link.setAttribute('aria-controls','home-self-compare');
      link.setAttribute('aria-expanded',String(expanded));
    });
    if(toggle){
      toggle.setAttribute('aria-expanded',String(expanded));
      const heading=toggle.querySelector('strong');
      const description=toggle.querySelector('span');
      const arrow=toggle.querySelector('b');
      if(heading)heading.textContent=expanded?'상품별 메뉴 접기':'상품별 비교·개통신청';
      if(description)description.textContent=expanded?'다시 누르면 메뉴가 닫혀요':'원하는 상품 바로 찾기';
      if(arrow)arrow.textContent=expanded?'↑':'→';
    }
  };
  const setOpen=(expanded,focusPanel=true)=>{
    panel.hidden=!expanded;
    sync();
    if(expanded&&focusPanel){
      panel.scrollIntoView({behavior:'auto',block:'start'});
      panel.querySelector('#home-direct-title')?.focus({preventScroll:true});
    }
    if(!expanded)toggle?.focus();
  };
  triggers.forEach(link=>link.addEventListener('click',event=>{
    event.preventDefault();
    setOpen(true);
  }));
  toggle?.addEventListener('click',()=>setOpen(panel.hidden));
  if(location.hash==='#home-self-compare')setOpen(true,false);
  else sync();
})();
