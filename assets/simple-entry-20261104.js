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
      toggle.textContent=expanded?'− 상품별 메뉴 접기':'＋ 상품별 비교·개통신청 메뉴 보기';
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
