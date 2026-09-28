(() => {
  'use strict';
  const launch = document.getElementById('support-notice-open');
  if (!launch || typeof HTMLDialogElement === 'undefined') return;
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const read = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
  const write = (store, key, value) => { try { window[store].setItem(key, value); } catch { /* Optional dismissal memory. */ } };
  const money = n => `${n.toLocaleString('ko-KR')}원`;
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  fetch('/data/support-notice.json', {cache: 'no-store'})
    .then(r => { if (!r.ok) throw Error('unavailable'); return r.json(); })
    .then(data => {
      if (data.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date > today() || !Array.isArray(data.changes)) return;
      if (!data.changes.length) return;
      const changes = data.changes;
      const validAmount = v => v === null || (Number.isSafeInteger(v) && v >= 0);
      if (!changes.every(r => ['SKT', 'KT', 'LGU+'].includes(r.carrier) && typeof r.device === 'string' && typeof r.plan === 'string' && ['기기변경', '번호이동', '신규가입'].includes(r.join) && Number.isSafeInteger(r.monthly_fee) && r.monthly_fee >= 0 && validAmount(r.before) && validAmount(r.after))) return;
      const dialog = el('dialog', undefined, 'support-notice');
      dialog.setAttribute('aria-labelledby', 'support-notice-title');
      const top = el('header', undefined, 'support-notice-top');
      const heading = el('h2', '휴대폰 지원금 주요 변동'); heading.id = 'support-notice-title';
      const close = el('button', '×', 'support-notice-close'); close.type = 'button'; close.setAttribute('aria-label', '지원금 안내 닫기');
      top.append(heading, close);
      const body = el('div', undefined, 'support-notice-body');
      body.append(el('p', `${data.date} 확인된 변경`, 'support-notice-date'), el('p', '대표 요금제 기준으로 확인된 공시지원금 변경입니다. 가입유형과 요금제에 따라 금액이 다릅니다.', 'support-notice-intro'));
      for (const carrier of ['SKT', 'KT', 'LGU+']) {
        const rows = changes.filter(r => r.carrier === carrier);
        if (!rows.length) continue;
        const section = el('section'); section.append(el('h3', carrier));
        const groups = new Map();
        for (const r of rows) {
          const key = JSON.stringify([r.plan, r.monthly_fee, r.join, r.before, r.after]);
          if (!groups.has(key)) groups.set(key, {row: r, names: []});
          groups.get(key).names.push(r.device);
        }
        for (const {row: r, names} of groups.values()) {
          const card = el('article', undefined, 'support-notice-card');
          card.append(el('p', `${r.join} · ${r.plan} (월 ${money(r.monthly_fee)})`, 'support-notice-condition'));
          let label;
          if (r.after === null) label = '현재 지원금은 매장 확인이 필요합니다';
          else if (r.before === null) label = `지원금 신규 확인 · ${money(r.after)}`;
          else label = `${money(r.before)} → ${money(r.after)} (${r.after > r.before ? '+' : '−'}${money(Math.abs(r.after - r.before))})`;
          card.append(el('p', label, 'support-notice-amount'));
          const list = el('ul'); for (const name of [...new Set(names)]) list.append(el('li', name));
          card.append(list); section.append(card);
        }
        body.append(section);
      }
      body.append(el('p', '표시 금액은 단말기 구매에 적용되는 공시지원금이며 현금 지급액이나 최종 구매가는 아닙니다. 선택약정 요금할인과는 다른 할인 방식입니다. 전체 요금제·출고가·재고·최종 가입 조건은 상담 시 확인해 주세요. 변동 없는 항목은 생략합니다.', 'support-notice-footnote'));
      const actions = el('footer', undefined, 'support-notice-actions');
      const hide = el('button', '오늘 보지 않기'); hide.type = 'button';
      const link = el('a', '내 조건으로 요금 알아보기'); link.href = '/rates.html';
      actions.append(hide, link); dialog.append(top, body, actions); document.body.append(dialog);
      let returnFocus;
      const dismiss = () => dialog.close();
      close.addEventListener('click', dismiss);
      hide.addEventListener('click', () => { write('localStorage', 'woongbi-support-hide', today()); dismiss(); });
      dialog.addEventListener('close', () => { document.body.classList.remove('support-notice-active'); if (returnFocus?.isConnected) returnFocus.focus(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismiss(); } });
      const open = () => { returnFocus = document.activeElement; dialog.showModal(); document.body.classList.add('support-notice-active'); close.focus(); write('sessionStorage', 'woongbi-support-seen', data.id); };
      launch.hidden = false; launch.textContent = `지원금 변동 안내 · ${data.date}`; launch.addEventListener('click', open);
      if (data.date === today() && read('localStorage', 'woongbi-support-hide') !== today() && read('sessionStorage', 'woongbi-support-seen') !== data.id) {
        // Avoid interrupting another dialog, a background tab or a customer who already started interacting.
        let interacted = false;
        const onInteraction = () => { interacted = true; };
        window.addEventListener('pointerdown', onInteraction, {once: true});
        window.addEventListener('keydown', onInteraction, {once: true});
        setTimeout(() => { window.removeEventListener('pointerdown', onInteraction); window.removeEventListener('keydown', onInteraction); if (!interacted && !document.hidden && !document.querySelector('dialog[open], [aria-modal="true"][aria-hidden="false"]')) open(); }, 900);
      }
    }).catch(() => { /* An unavailable notice must not block the store website. */ });
})();
