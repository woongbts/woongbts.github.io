(() => {
  const header = document.querySelector('body:not(.rate-page) .top');
  const nav = header?.querySelector('.nav');
  const menu = nav?.querySelector('.menu');
  if (!menu || nav.querySelector('.mobile-menu-toggle')) return;
  const phone = window.matchMedia('(max-width:640px)');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mobile-menu-toggle';
  menu.id = menu.id || 'store-main-menu';
  button.setAttribute('aria-controls', menu.id);
  nav.insertBefore(button, menu);
  nav.classList.add('mobile-menu-ready');
  function setOpen(open, restoreFocus = false) {
    const expanded = phone.matches && open;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? '전체 메뉴 닫기' : '전체 메뉴 열기');
    button.textContent = expanded ? '× 닫기' : '☰ 메뉴';
    menu.hidden = phone.matches && !expanded;
    nav.classList.toggle('mobile-menu-open', expanded);
    if (restoreFocus) button.focus();
  }
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false, true);
    }
  });
  phone.addEventListener('change', () => setOpen(false));
  window.addEventListener('pageshow', () => setOpen(false));
  setOpen(false);
})();
