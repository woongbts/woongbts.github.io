(function(){
  if(document.getElementById('woongbi-ai-launcher')) return;

  const API_URL='https://woongb-ai.woongbts.workers.dev';
  const style=document.createElement('style');
  style.id='woongbi-ai-chat-style';
  style.textContent=`
    .wb-ai-launcher{position:fixed;right:22px;bottom:22px;z-index:380;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:13px 17px;background:#0f766e;color:#fff;font-weight:900;font-size:.92rem;box-shadow:0 12px 30px rgba(15,118,110,.3);cursor:pointer}
    .wb-ai-launcher:hover{filter:brightness(1.04);transform:translateY(-1px)}
    .wb-ai-launcher-dot{width:9px;height:9px;border-radius:50%;background:#8ff5d6;box-shadow:0 0 0 4px rgba(143,245,214,.17)}
    .wb-ai-panel{position:fixed;right:22px;bottom:82px;z-index:390;width:min(370px,calc(100vw - 28px));height:min(620px,72vh);display:none;grid-template-rows:auto 1fr auto auto;background:#fff;border:1px solid #d7e1e5;border-radius:22px;box-shadow:0 24px 70px rgba(16,60,82,.24);overflow:hidden}
    .wb-ai-panel.open{display:grid}
    .wb-ai-head{display:flex;align-items:center;gap:11px;padding:15px 16px;background:linear-gradient(135deg,#103c52,#0f766e);color:#fff}
    .wb-ai-mark{width:38px;height:38px;border-radius:12px;background:#fff;color:#0f766e;display:flex;align-items:center;justify-content:center;font-size:1.05rem;font-weight:1000}
    .wb-ai-head-copy{min-width:0;flex:1}.wb-ai-head-copy strong{display:block;font-size:.96rem}.wb-ai-head-copy span{display:block;margin-top:2px;font-size:.72rem;opacity:.82}
    .wb-ai-close{width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.13);color:#fff;font-size:1.25rem;cursor:pointer}
    .wb-ai-messages{padding:16px;overflow:auto;background:#f7fafb;scroll-behavior:smooth}
    .wb-ai-row{display:flex;margin:0 0 11px}.wb-ai-row.user{justify-content:flex-end}.wb-ai-bubble{max-width:84%;padding:11px 13px;border-radius:16px;font-size:.87rem;line-height:1.55;white-space:pre-wrap;word-break:break-word}
    .wb-ai-row.bot .wb-ai-bubble{background:#fff;border:1px solid #dce6e8;color:#173846;border-bottom-left-radius:5px}.wb-ai-row.user .wb-ai-bubble{background:#0f766e;color:#fff;border-bottom-right-radius:5px}
    .wb-ai-typing{display:inline-flex;gap:4px;align-items:center}.wb-ai-typing i{width:5px;height:5px;border-radius:50%;background:#8ca0a7;animation:wbAiBlink 1.1s infinite}.wb-ai-typing i:nth-child(2){animation-delay:.16s}.wb-ai-typing i:nth-child(3){animation-delay:.32s}@keyframes wbAiBlink{0%,70%,100%{opacity:.25;transform:translateY(0)}35%{opacity:1;transform:translateY(-2px)}}
    .wb-ai-quick{display:flex;gap:7px;overflow-x:auto;padding:10px 12px;border-top:1px solid #e2e8eb;background:#fff}.wb-ai-quick::-webkit-scrollbar{display:none}.wb-ai-chip{flex:0 0 auto;border:1px solid #bfd2d5;border-radius:999px;background:#fff;color:#0f5e59;padding:7px 10px;font-size:.74rem;font-weight:800;cursor:pointer}
    .wb-ai-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 12px 8px;background:#fff;border-top:1px solid #e2e8eb}.wb-ai-input{width:100%;min-width:0;border:1px solid #cfdde0;border-radius:13px;padding:10px 11px;font:inherit;font-size:.84rem;outline:none}.wb-ai-input:focus{border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,.1)}.wb-ai-send{border:0;border-radius:13px;background:#103c52;color:#fff;padding:0 14px;font-weight:900;cursor:pointer}.wb-ai-send:disabled{opacity:.48;cursor:default}
    .wb-ai-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 11px;background:#fff}.wb-ai-note{color:#6d8087;font-size:.65rem;line-height:1.35}.wb-ai-contact{display:flex;gap:6px;flex:0 0 auto}.wb-ai-contact a{font-size:.68rem;font-weight:900;text-decoration:none;padding:6px 8px;border-radius:9px}.wb-ai-phone{background:#e7f2f3;color:#103c52}.wb-ai-kakao{background:#fee500;color:#3c1e1e}
    @media(max-width:640px){.wb-ai-launcher{right:14px;bottom:82px;padding:12px 14px;font-size:.84rem}.wb-ai-panel{right:10px;bottom:142px;width:calc(100vw - 20px);height:min(560px,68vh);border-radius:18px}.wb-ai-bubble{max-width:88%;font-size:.84rem}}
  `;
  document.head.appendChild(style);

  const launcher=document.createElement('button');
  launcher.id='woongbi-ai-launcher';
  launcher.className='wb-ai-launcher';
  launcher.type='button';
  launcher.setAttribute('aria-expanded','false');
  launcher.setAttribute('aria-controls','woongbi-ai-panel');
  launcher.innerHTML='<span class="wb-ai-launcher-dot"></span><span>AI에게 물어보기</span>';

  const panel=document.createElement('section');
  panel.id='woongbi-ai-panel';
  panel.className='wb-ai-panel';
  panel.setAttribute('aria-label','웅비통신 AI 안내');
  panel.innerHTML=`
    <div class="wb-ai-head"><div class="wb-ai-mark">W</div><div class="wb-ai-head-copy"><strong>웅비통신 AI 안내</strong><span>영업시간·위치·상품 안내를 도와드려요</span></div><button class="wb-ai-close" type="button" aria-label="AI 안내 닫기">×</button></div>
    <div class="wb-ai-messages" aria-live="polite"></div>
    <div class="wb-ai-quick"><button class="wb-ai-chip" type="button">오늘 영업해요?</button><button class="wb-ai-chip" type="button">알뜰폰도 되나요?</button><button class="wb-ai-chip" type="button">매장 위치 알려줘</button><button class="wb-ai-chip" type="button">인터넷·TV 상담 되나요?</button></div>
    <div><form class="wb-ai-form"><input class="wb-ai-input" type="text" maxlength="200" autocomplete="off" placeholder="궁금한 내용을 입력하세요" aria-label="AI에게 질문"><button class="wb-ai-send" type="submit">전송</button></form><div class="wb-ai-foot"><span class="wb-ai-note">개인정보는 입력하지 마세요.<br>가격·재고·지원금은 매장 확인이 필요합니다.</span><span class="wb-ai-contact"><a class="wb-ai-phone" href="tel:0513437677">전화</a><a class="wb-ai-kakao" href="http://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카톡</a></span></div></div>`;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const messages=panel.querySelector('.wb-ai-messages');
  const form=panel.querySelector('.wb-ai-form');
  const input=panel.querySelector('.wb-ai-input');
  const send=panel.querySelector('.wb-ai-send');
  const close=panel.querySelector('.wb-ai-close');
  let busy=false;

  function addMessage(text,who){
    const row=document.createElement('div');row.className='wb-ai-row '+who;
    const bubble=document.createElement('div');bubble.className='wb-ai-bubble';bubble.textContent=text;
    row.appendChild(bubble);messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return row;
  }
  function addTyping(){
    const row=document.createElement('div');row.className='wb-ai-row bot';row.id='wb-ai-typing-row';
    const bubble=document.createElement('div');bubble.className='wb-ai-bubble';bubble.innerHTML='<span class="wb-ai-typing"><i></i><i></i><i></i></span>';
    row.appendChild(bubble);messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return row;
  }
  function openPanel(){panel.classList.add('open');launcher.setAttribute('aria-expanded','true');setTimeout(()=>input.focus(),80)}
  function closePanel(){panel.classList.remove('open');launcher.setAttribute('aria-expanded','false')}
  launcher.addEventListener('click',()=>panel.classList.contains('open')?closePanel():openPanel());
  close.addEventListener('click',closePanel);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('open'))closePanel()});

  async function ask(question){
    question=String(question||'').trim();if(!question||busy)return;
    addMessage(question,'user');input.value='';busy=true;send.disabled=true;const typing=addTyping();
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      typing.remove();
      if(!response.ok)throw new Error(data.error||'응답 오류');
      addMessage(data.answer||'답변을 불러오지 못했습니다. 매장으로 문의해주세요.','bot');
    }catch(error){
      if(document.body.contains(typing))typing.remove();
      const msg=error&&error.name==='AbortError'?'응답이 조금 늦어지고 있어요. 잠시 후 다시 질문해 주세요.':'AI 안내 연결에 문제가 생겼어요. 전화 051-343-7677 또는 카카오톡으로 문의해 주세요.';
      addMessage(msg,'bot');
    }finally{clearTimeout(timer);busy=false;send.disabled=false;input.focus()}
  }

  form.addEventListener('submit',e=>{e.preventDefault();ask(input.value)});
  panel.querySelectorAll('.wb-ai-chip').forEach(chip=>chip.addEventListener('click',()=>{openPanel();ask(chip.textContent)}));
  addMessage('안녕하세요 👋 웅비통신 AI 안내입니다. 영업시간, 위치, 휴대폰·알뜰폰·인터넷·렌탈 등에 대해 편하게 물어보세요.','bot');
})();