(() => {
  'use strict';
  if (typeof HTMLDialogElement === 'undefined') return;
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const read = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
  const write = (store, key, value) => { try { window[store].setItem(key, value); } catch { /* Optional dismissal memory. */ } };
  const money = n => `${n.toLocaleString('ko-KR')}원`;
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  fetch('/data/support-notice.json', {cache: 'no-store'})
    .then(r => { if (!r.ok) throw Error('unavailable'); return r.json(); })
    .then(data => {
      if (data.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date > today() || !Array.isArray(data.changes)) return;
      // Avoid showing last month's subsidies as today's news to new visitors.
      // Historical changes stay archived in the JSON, but do not auto-popup.
      const todayUtc = Date.parse(today() + 'T00:00:00Z');
      const noticeUtc = Date.parse(data.date + 'T00:00:00Z');
      if (!Number.isFinite(noticeUtc) || !Number.isFinite(todayUtc) ||
          todayUtc - noticeUtc > 7 * 86400000) return;
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
      body.append(el('p', `${data.date} 변경${data.date < today() ? ' · 지난 공지' : ''}`, 'support-notice-date'));
      const summaries = new Map();
      for (const row of changes) {
        if (row.before === null || row.after === null || row.before === row.after) continue;
        const key = JSON.stringify([row.join, row.before, row.after]);
        if (!summaries.has(key)) summaries.set(key, {row, count: 0});
        summaries.get(key).count++;
      }
      if (summaries.size) {
        const summary = el('div', undefined, 'support-notice-summary');
        
        for (const {row, count} of [...summaries.values()].slice(0, 3)) summary.append(el('p', `${row.join} · ${money(row.before)} → ${money(row.after)}`));
        body.append(summary);
      }
      if (!summaries.size) body.append(el('p', `새 지원금 조건 ${changes.length}건이 확인됐습니다.`, 'support-notice-summary'));
      const details = el('details', undefined, 'support-notice-details');
      details.append(el('summary', '적용 기종·요금제 보기'));
      for (const carrier of ['SKT', 'KT', 'LGU+']) {
        const rows = changes.filter(r => r.carrier === carrier);
        if (!rows.length) continue;
        const section = el('section'); section.append(el('h3', carrier));
        const groups = new Map();
        for (const r of rows) {
          const key = JSON.stringify([r.plan, r.monthly_fee, r.join, r.before, r.after]);
          if (!groups.has(key)) groups.set(key, {row: r, models: []});
          groups.get(key).models.push(r);
        }
        for (const {row: r, models} of groups.values()) {
          const card = el('article', undefined, 'support-notice-card');
          card.append(el('p', `${r.join} · ${r.plan} (월 ${money(r.monthly_fee)})`, 'support-notice-condition'));
          let label;
          if (r.after === null) label = '현재 지원금은 매장 확인이 필요합니다';
          else if (r.before === null) label = `지원금 신규 확인 · ${money(r.after)}`;
          else label = `${money(r.before)} → ${money(r.after)} (${r.after > r.before ? '+' : '−'}${money(Math.abs(r.after - r.before))})`;
          card.append(el('p', label, 'support-notice-amount'));
          const list = el('ul');
          for (const model of models) {
            const item = el('li', undefined, 'support-notice-model');
            if (model.after !== null && typeof model.device_id === 'string' && typeof model.plan_id === 'string') {
              const url = new URL('/rates.html', location.origin);
              for (const [key, value] of Object.entries({tab:'mobile', c:model.carrier, j:model.join, d:model.device_id, p:model.plan_id, m:'support', mo:'24', w:'none'})) url.searchParams.set(key, value);
              const calculate = el('a', model.device); calculate.href = url.href; calculate.setAttribute('aria-label', `${model.carrier} ${model.device} ${model.join} 이 조건으로 계산`); item.append(calculate);
            } else item.append(el('span', model.device));
            list.append(item);
          }
          card.append(list); section.append(card);
        }
        details.append(section);
      }
      if (typeof data.checked_at === 'string' && !Number.isNaN(Date.parse(data.checked_at))) details.append(el('p', `데이터 확인: ${new Date(data.checked_at).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'})}`, 'support-notice-checked'));
      body.append(details);
      const totalVerified = Number.isSafeInteger(data.notice_total_count) && data.notice_total_count >= changes.length
        ? data.notice_total_count : changes.length;
      const scope = totalVerified > changes.length
        ? `확인된 금액 변동 ${totalVerified.toLocaleString('ko-KR')}건 중 대표 ${changes.length}건을 표시합니다. `
        : '확인된 지원금 금액 변동을 표시합니다. ';
      body.append(el('p', `${scope}통신사·기종·가입유형·요금제마다 금액이 다르므로 현재 조건은 계산기에서 다시 확인하세요.`, 'support-notice-footnote'));
      const actions = el('footer', undefined, 'support-notice-actions');
      const hide = el('button', '오늘 보지 않기'); hide.type = 'button';
      const link = el('a', '요금 계산기'); link.href = '/rates.html';
      actions.append(hide, link); dialog.append(top, body, actions); document.body.append(dialog);
      let returnFocus;
      const dismiss = () => dialog.close();
      close.addEventListener('click', dismiss);
      hide.addEventListener('click', () => { write('localStorage', 'woongbi-support-hide', today()); dismiss(); });
      dialog.addEventListener('close', () => { write('sessionStorage', 'woongbi-support-seen', `${today()}:${data.id}`); write('localStorage', 'woongbi-support-dismissed', data.id); document.body.classList.remove('support-notice-active'); if (returnFocus?.isConnected) returnFocus.focus(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismiss(); } });
      const open = () => { returnFocus = document.activeElement; dialog.showModal(); document.body.classList.add('support-notice-active'); close.focus(); };
      if (read('localStorage', 'woongbi-support-dismissed') !== data.id && read('localStorage', 'woongbi-support-hide') !== today() && read('sessionStorage', 'woongbi-support-seen') !== `${today()}:${data.id}`) {
        // Avoid interrupting another dialog, a background tab or a customer who already started interacting.
        let interacted = false;
        const onInteraction = () => { interacted = true; };
        window.addEventListener('pointerdown', onInteraction, {once: true});
        window.addEventListener('keydown', onInteraction, {once: true});
        setTimeout(() => { window.removeEventListener('pointerdown', onInteraction); window.removeEventListener('keydown', onInteraction); if (!interacted && !document.hidden && !document.querySelector('dialog[open], [aria-modal="true"][aria-hidden="false"]')) open(); }, 900);
      }
    }).catch(() => { /* An unavailable notice must not block the store website. */ });
})();
