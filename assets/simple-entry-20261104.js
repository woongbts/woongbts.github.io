(() => {
  'use strict';
  const panel=document.getElementById('home-self-compare');
  if(!panel)return;
  const openPanel=()=>{
    panel.hidden=false;
    document.querySelectorAll('a[href="#home-self-compare"]').forEach(link=>link.setAttribute('aria-expanded','true'));
    panel.scrollIntoView({behavior:'auto',block:'start'});
    panel.querySelector('#home-direct-title')?.focus({preventScroll:true});
  };
  document.querySelectorAll('a[href="#home-self-compare"]').forEach(link=>{
    link.setAttribute('aria-controls','home-self-compare');
    link.setAttribute('aria-expanded',panel.hidden?'false':'true');
    link.addEventListener('click',event=>{
      event.preventDefault();
      openPanel();
    });
  });
  if(location.hash==='#home-self-compare')openPanel();
})();
