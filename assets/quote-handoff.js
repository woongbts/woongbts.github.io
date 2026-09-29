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
      dialog.innerHTML = '<h2 id="quote-handoff-title">선택한 견적으로 상담하기</h2><p>견적을 복사한 뒤 카카오톡 상담창에 붙여넣어 주세요. 상담창을 여는 것만으로 견적이 전송되지는 않습니다.</p><label for="quote-handoff-text">상담할 견적 내용</label><textarea id="quote-handoff-text" readonly></textarea><p role="status" aria-live="polite"></p><div class="quote-handoff-actions"><button type="button" data-copy>견적 복사</button><a href="https://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카카오톡 상담 열기</a><button type="button" data-close>닫기</button></div>';
      const area = dialog.querySelector('textarea');
      const status = dialog.querySelector('[role="status"]');
      area.value = text;
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
})();
