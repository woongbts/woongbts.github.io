(() => {
  const panel=document.getElementById('home-self-compare');
  document.querySelectorAll('a[href="#home-self-compare"]').forEach(trigger=>trigger.addEventListener('click',event=>{
    if(!panel)return;
    event.preventDefault();panel.open=true;
    panel.querySelector('summary')?.focus();
    panel.scrollIntoView({behavior:'auto',block:'start'});
  }));
  if(panel&&location.hash==='#home-self-compare')panel.open=true;
})();
