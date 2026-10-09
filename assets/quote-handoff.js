(() => {
  'use strict';
  window.WoongbiQuoteHandoff = {
    open(text) {
      if (!text) return false;
      document.getElementById('quote-handoff')?.close();
      const previous = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.id = 'quote-handoff';
      dialog.className = 'quote-handoff';
      dialog.setAttribute('aria-labelledby', 'quote-handoff-title');
      dialog.innerHTML = '<h2 id="quote-handoff-title">이 조건으로 상담하세요</h2><ol class="quote-handoff-steps"><li><strong>견적 내용을 복사하세요.</strong> 아래에 선택한 기종·요금제와 예상 금액이 담겨 있습니다.</li><li><strong>카카오톡 상담창에 붙여넣어 보내주세요.</strong> 상담창을 여는 것만으로 견적이 전송되지는 않습니다.</li></ol><label for="quote-handoff-text">상담할 견적 내용</label><textarea id="quote-handoff-text" readonly></textarea><p role="status" aria-live="polite"></p><div class="quote-handoff-actions"><button type="button" data-copy>견적 복사</button><a href="https://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 상담 열기</a><button type="button" data-close>닫기</button></div><p class="quote-handoff-phone"><a href="tel:0513437677">전화 상담 · 051-343-7677</a><span data-phone-guide></span></p>';
      const area = dialog.querySelector('textarea');
      const status = dialog.querySelector('[role="status"]');
      area.value = text;
      const quoteNumber = String(text).match(/^견적번호:\s*(.+)$/m)?.[1]?.trim();
      dialog.querySelector('[data-phone-guide]').textContent = quoteNumber
        ? `전화하실 때 선택한 기종·요금제와 견적번호 ${quoteNumber}를 함께 말씀해 주세요.`
        : '전화하실 때 아래 견적 내용의 기종·요금제와 가입유형을 말씀해 주세요.';
      async function copy() {
        try {
          if (!navigator.clipboard?.writeText) throw Error('unavailable');
          await navigator.clipboard.writeText(text);
          status.textContent = '견적을 복사했습니다. 카카오톡 상담창에 붙여넣어 주세요.';
        } catch {
          status.textContent = '자동 복사가 되지 않았습니다. 아래 선택된 견적을 길게 누르거나 Ctrl+C로 직접 복사해 주세요.';
          if (dialog.open) { area.focus(); area.select(); }
        }
      }
      dialog.querySelector('[data-copy]').addEventListener('click', () => { void copy(); });
      dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); }, {once:true});
      document.body.append(dialog);
      dialog.showModal();
      void copy();
      return true;
    }
  };

  if (typeof location !== 'undefined' && /\/rates\.html$/.test(location.pathname)) {
    const quoteBridge = document.createElement('script');
    quoteBridge.src = '/assets/quote-api-bridge.min.js?v=20261009-carrier-switch3';
    quoteBridge.async = false;
    document.head.appendChild(quoteBridge);

    const recommendBridge = document.createElement('script');
    recommendBridge.src = '/assets/recommend-api-bridge.min.js?v=20261001-2';
    recommendBridge.async = false;
    document.head.appendChild(recommendBridge);
  }
})();
