!function(){if(document.getElementById("woongbi-ai-launcher"))return;const e=document.createElement("style");if(e.id="woongbi-ai-chat-style",e.textContent="\n    .wb-rate-entry{padding:20px 0;background:#f7fafb;border-bottom:1px solid #dbe5e8}.wb-rate-entry-card{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:22px 24px;border:1px solid #d7e1e5;border-radius:20px;background:linear-gradient(135deg,#eff8f8,#fff 55%,#edf4ff);box-shadow:0 10px 28px rgba(16,60,82,.06)}.wb-rate-entry-copy small{display:block;color:#0f766e;font-weight:900;margin-bottom:7px}.wb-rate-entry-copy strong{display:block;font-size:1.35rem;line-height:1.3;color:#103c52}.wb-rate-entry-copy p{margin:7px 0 0;color:#637980;font-size:.86rem;line-height:1.55}.wb-rate-entry-link{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 15px;border-radius:13px;background:#103c52;color:#fff!important;text-decoration:none;font-size:.84rem;font-weight:900}\n    .wb-ai-launcher{position:fixed;right:22px;bottom:22px;z-index:380;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:13px 17px;background:#0f766e;color:#fff;font-weight:900;font-size:.92rem;box-shadow:0 12px 30px rgba(15,118,110,.3);cursor:pointer}.wb-ai-launcher:hover{filter:brightness(1.04);transform:translateY(-1px)}.wb-ai-launcher-dot{width:9px;height:9px;border-radius:50%;background:#8ff5d6;box-shadow:0 0 0 4px rgba(143,245,214,.17)}\n    .wb-ai-panel{position:fixed;right:22px;bottom:82px;z-index:390;width:min(370px,calc(100vw - 28px));height:min(620px,72vh);display:none;grid-template-rows:auto 1fr auto auto;background:#fff;border:1px solid #d7e1e5;border-radius:22px;box-shadow:0 24px 70px rgba(16,60,82,.24);overflow:hidden}.wb-ai-panel.open{display:grid}.wb-ai-head{display:flex;align-items:center;gap:11px;padding:15px 16px;background:linear-gradient(135deg,#103c52,#0f766e);color:#fff}.wb-ai-mark{width:38px;height:38px;border-radius:12px;background:#fff;color:#0f766e;display:flex;align-items:center;justify-content:center;font-size:1.05rem;font-weight:1000}.wb-ai-head-copy{min-width:0;flex:1}.wb-ai-head-copy strong{display:block;font-size:.96rem}.wb-ai-head-copy span{display:block;margin-top:2px;font-size:.72rem;opacity:.82}.wb-ai-close{width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.13);color:#fff;font-size:1.25rem;cursor:pointer}\n    .wb-ai-messages{padding:16px;overflow:auto;background:#f7fafb;scroll-behavior:smooth}.wb-ai-row{display:flex;margin:0 0 11px}.wb-ai-row.user{justify-content:flex-end}.wb-ai-bubble{max-width:84%;padding:11px 13px;border-radius:16px;font-size:.87rem;line-height:1.55;white-space:pre-wrap;word-break:break-word}.wb-ai-row.bot .wb-ai-bubble{background:#fff;border:1px solid #dce6e8;color:#173846;border-bottom-left-radius:5px}.wb-ai-row.user .wb-ai-bubble{background:#0f766e;color:#fff;border-bottom-right-radius:5px}.wb-ai-typing{display:inline-flex;gap:4px;align-items:center}.wb-ai-typing i{width:5px;height:5px;border-radius:50%;background:#8ca0a7;animation:wbAiBlink 1.1s infinite}.wb-ai-typing i:nth-child(2){animation-delay:.16s}.wb-ai-typing i:nth-child(3){animation-delay:.32s}@keyframes wbAiBlink{0%,70%,100%{opacity:.25;transform:translateY(0)}35%{opacity:1;transform:translateY(-2px)}}\n    .wb-ai-quick{display:flex;gap:7px;overflow-x:auto;padding:10px 12px;border-top:1px solid #e2e8eb;background:#fff;cursor:grab;user-select:none;scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior-x:contain}.wb-ai-quick.wb-ai-dragging{cursor:grabbing}.wb-ai-quick::-webkit-scrollbar{display:none}.wb-ai-chip,.wb-ai-rate-chip{flex:0 0 auto;border:1px solid #bfd2d5;border-radius:999px;background:#fff;color:#0f5e59;padding:7px 10px;font-size:.74rem;font-weight:800;cursor:pointer;text-decoration:none}.wb-ai-rate-chip{background:#103c52;color:#fff;border-color:#103c52}\n    .wb-ai-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 12px 8px;background:#fff;border-top:1px solid #e2e8eb}.wb-ai-input{width:100%;min-width:0;border:1px solid #cfdde0;border-radius:13px;padding:10px 11px;font:inherit;font-size:.84rem;outline:none}.wb-ai-input:focus{border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,.1)}.wb-ai-send{border:0;border-radius:13px;background:#103c52;color:#fff;padding:0 14px;font-weight:900;cursor:pointer}.wb-ai-send:disabled{opacity:.48;cursor:default}.wb-ai-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 11px;background:#fff}.wb-ai-note{color:#6d8087;font-size:.65rem;line-height:1.35}.wb-ai-contact{display:flex;gap:6px;flex:0 0 auto}.wb-ai-contact a{font-size:.68rem;font-weight:900;text-decoration:none;padding:6px 8px;border-radius:9px}.wb-ai-phone{background:#e7f2f3;color:#103c52}.wb-ai-kakao{background:#fee500;color:#3c1e1e}\n    @media(max-width:640px){.wb-rate-entry{padding:14px 0}.wb-rate-entry-card{align-items:flex-start;flex-direction:column;gap:13px;padding:17px;border-radius:17px}.wb-rate-entry-copy strong{font-size:1.12rem}.wb-rate-entry-link{width:100%}.wb-ai-launcher{right:8px!important;left:auto!important;bottom:calc(80px + env(safe-area-inset-bottom,0px))!important;width:134px!important;min-width:134px!important;max-width:calc(100vw - 28px)!important;height:52px!important;min-height:52px!important;max-height:52px!important;box-sizing:border-box!important;padding:0 12px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:0!important;border-radius:999px!important;font-size:0!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;opacity:1!important}.wb-ai-launcher>span{display:none!important}.wb-ai-launcher:after{content:'✦ AI에게 질문'!important;display:block!important;color:#fff!important;font-size:15px!important;line-height:1.2!important;font-weight:950!important;letter-spacing:-.02em!important;white-space:nowrap!important}.wb-ai-panel{right:8px;left:auto;bottom:calc(142px + env(safe-area-inset-bottom,0px));width:calc(100vw - 20px);height:min(560px,68vh);border-radius:18px}.wb-ai-bubble{max-width:88%;font-size:.84rem}}\n  ",document.head.appendChild(e),("/"===location.pathname||"/index.html"===location.pathname)&&!document.getElementById("wb-rate-entry")){const e=document.getElementById("services");if(e){const t=document.createElement("section");t.id="wb-rate-entry",t.className="wb-rate-entry",t.innerHTML='<div class="wrap"><div class="wb-rate-entry-card"><div class="wb-rate-entry-copy"><strong>내 월요금, 먼저 알아보세요.</strong><p>휴대폰·알뜰폰·인터넷·TV와 공시지원금·선택약정·결합·복지할인의 구조를 한 화면에서 확인할 수 있습니다.</p></div><a class="wb-rate-entry-link" href="/rates.html">요금 알아보기 →</a></div></div>',e.insertAdjacentElement("afterend",t)}}
// Appended to the existing launcher/entry styles by build_ai_chat_asset.py.
const polish=document.createElement('style');
polish.textContent=`
.wb-ai-panel{width:min(410px,calc(100vw - 28px));height:min(680px,calc(100dvh - 110px));grid-template-rows:auto auto minmax(0,1fr) auto auto;font-family:Pretendard,"Noto Sans KR","Malgun Gothic",system-ui,sans-serif}
.wb-ai-panel:not(.has-conversation){height:min(520px,calc(100dvh - 110px))}.wb-ai-panel *{box-sizing:border-box}.wb-ai-panel>.wb-ai-head{grid-row:1}.wb-ai-panel>.wb-ai-context{grid-row:2;max-height:132px;overflow:auto}.wb-ai-panel>.wb-ai-messages{grid-row:3}.wb-ai-panel>.wb-ai-quick{grid-row:4}.wb-ai-panel>div:last-child{grid-row:5}.wb-ai-panel [hidden]{display:none!important}
.wb-ai-head{padding:15px;gap:10px}.wb-ai-head-copy{min-width:0}.wb-ai-head-copy strong{font-size:18px;line-height:1.45}.wb-ai-head-copy span{font-size:13px;line-height:1.5}.wb-ai-close{width:44px;height:44px;flex:none;font-size:24px}
.wb-ai-context{margin:10px 12px 0;padding:11px 12px;border:1px solid #c7e2db;border-radius:12px;background:#edf8f4;color:#29534f;font-size:14px;line-height:1.6;overflow-wrap:anywhere}.wb-ai-context strong{display:block;font-size:14px;color:#086b5d}.wb-ai-context span{display:block;margin-top:3px}
.wb-ai-messages{padding:14px;min-height:0;overflow-y:auto;overscroll-behavior:contain;scroll-behavior:auto}
.wb-ai-bubble{max-width:94%;font-size:16px;line-height:1.75;padding:12px 14px;color:#173846;overflow-wrap:anywhere}.wb-ai-row.bot .wb-ai-bubble{border-color:#d4e2e4}.wb-ai-row.user .wb-ai-bubble{color:#fff}
.wb-ai-quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:11px 12px;overflow:visible;cursor:auto;user-select:auto}
.wb-ai-chip,.wb-ai-rate-chip{min-width:0;min-height:46px;padding:9px 8px;border-radius:11px;display:flex;align-items:center;justify-content:center;text-align:center;font:inherit;font-size:14px;font-weight:800;line-height:1.5;white-space:normal;text-decoration:none}
.wb-ai-form{padding:10px 12px 8px}.wb-ai-input{font-size:16px;line-height:1.5;min-height:48px;padding:12px;}.wb-ai-send{font-size:16px;min-width:58px;min-height:48px;padding:0 12px}
.wb-ai-foot{align-items:flex-start;gap:10px;flex-wrap:wrap;padding:0 12px 12px}.wb-ai-note{font-size:13px;line-height:1.6;color:#506971;flex:1 1 180px}.wb-ai-contact a{font-size:14px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:8px 10px}
.wb-ai-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;white-space:normal}.wb-ai-actions a,.wb-ai-retry{font:inherit;font-size:14px;font-weight:800;line-height:1.5;min-height:42px;padding:9px 11px;border:1px solid #b9d7d0;border-radius:10px;background:#eef8f4;color:#08685d;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.wb-ai-retry{margin-top:12px}.wb-ai-retry:disabled{opacity:.5;cursor:wait}
.wb-ai-panel :focus-visible{outline:3px solid #238e82;outline-offset:2px}
@media(max-width:640px){.wb-ai-panel{right:10px;left:auto;bottom:12px;width:calc(100% - 20px);height:min(720px,calc(100dvh - 24px));max-height:calc(100dvh - 24px);border-radius:18px}.wb-ai-panel .wb-ai-bubble{font-size:16px;max-width:96%}.wb-ai-panel .wb-ai-head{padding:12px}.wb-ai-panel .wb-ai-head-copy strong{font-size:17px}.wb-ai-panel .wb-ai-quick{gap:7px;padding:9px 11px}.wb-ai-launcher[aria-expanded="true"]{visibility:hidden}}
@media(max-width:640px){body.home-modern #woongbi-ai-panel.wb-ai-panel{right:10px!important;bottom:12px!important;width:calc(100% - 20px)!important;max-height:calc(100dvh - 24px)!important}}
@media(max-height:580px){.wb-ai-panel{bottom:8px;height:calc(100dvh - 16px);max-height:calc(100dvh - 16px)}.wb-ai-context{max-height:84px;overflow:auto}.wb-ai-quick{padding:6px 10px;gap:5px}.wb-ai-chip,.wb-ai-rate-chip{min-height:38px;padding:5px;font-size:13px}.wb-ai-head-copy span{display:none}.wb-ai-note{font-size:12px}}
@media(prefers-reduced-motion:reduce){.wb-ai-typing i{animation:none}.wb-ai-panel *{scroll-behavior:auto}}
`;
document.head.appendChild(polish);
const launcher=document.createElement('button');
launcher.id='woongbi-ai-launcher';launcher.className='wb-ai-launcher';launcher.type='button';
launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','woongbi-ai-panel');launcher.setAttribute('aria-label','웅비통신 AI에게 물어보기');
launcher.innerHTML='<span class="wb-ai-launcher-dot"></span><span>AI에게 물어보기</span>';
const panel=document.createElement('section');panel.id='woongbi-ai-panel';panel.className='wb-ai-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','웅비통신 AI 안내');
panel.innerHTML=`<div class="wb-ai-head"><div class="wb-ai-mark">W</div><div class="wb-ai-head-copy"><strong>웅비통신 AI 안내</strong><span>상품 비교와 매장 이용을 도와드려요</span></div><button class="wb-ai-close" type="button" aria-label="AI 안내 닫기">×</button></div>
<div class="wb-ai-context" hidden><strong>현재 선택한 조건</strong><span></span></div>
<div class="wb-ai-messages" role="log" aria-label="AI 대화" aria-live="polite" aria-relevant="additions text"></div>
<div class="wb-ai-quick" aria-label="빠른 질문과 상품 찾기"></div>
<div><form class="wb-ai-form"><input class="wb-ai-input" type="text" maxlength="200" autocomplete="off" placeholder="편하게 질문해 주세요" aria-label="AI에게 질문"><button class="wb-ai-send" type="submit">전송</button></form><div class="wb-ai-foot"><span class="wb-ai-note">개인정보는 입력하지 마세요.<br>최종 가격·재고·혜택은 상담으로 확인해요.</span><span class="wb-ai-contact"><a class="wb-ai-phone" href="tel:0513437677">전화</a><a class="wb-ai-kakao" href="https://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">카톡</a></span></div></div>`;
document.body.append(launcher,panel);
const messages=panel.querySelector('.wb-ai-messages'),form=panel.querySelector('form'),input=panel.querySelector('input'),sendButton=panel.querySelector('.wb-ai-send'),quick=panel.querySelector('.wb-ai-quick'),contextBox=panel.querySelector('.wb-ai-context');
let busy=false,history=[],composing=false;

function readField(id){
  const node=document.getElementById(id);if(!node)return '';
  if(node.tagName==='SELECT'){const option=node.options[node.selectedIndex];return option?.value?option.textContent.trim():'';}
  return (node.textContent||'').trim();
}
function getContext(){
  const context={page:location.pathname,title:document.title,active_tab:'home'};
  const active=document.querySelector('.rate-panel.active');if(!active)return context;
  context.active_tab=active.dataset.panel||'';
  const fields={mobile:['carrier','join-type','device-select','plan-select','monthly-total','calc-summary'],studyphone:['studyphone-plan','studyphone-total','studyphone-summary'],mvno:['mvno-provider','mvno-plan','mvno-network','mvno-total','mvno-detail','mvno-summary'],prepaid:['prepaid-provider','prepaid-plan','prepaid-network','prepaid-total','prepaid-detail','prepaid-summary'],internet:['internet-carrier','internet-product','tv-product','internet-total','internet-detail','internet-summary']}[context.active_tab]||[];
  const values=fields.map(readField);
  const totalId={mobile:'monthly-total',studyphone:'studyphone-total',mvno:'mvno-total',prepaid:'prepaid-total',internet:'internet-total'}[context.active_tab];
  const ready=/\d[\d,]*원/.test(readField(totalId));
  const complete=context.active_tab!=='mobile'||(readField('device-select')&&readField('plan-select'));
  if(ready&&complete){context.selection=values.slice(0,5).filter(x=>x&&x!=='—').join(' · ').slice(0,700);context.summary=values.slice(5).filter(Boolean).join(' · ').slice(0,500);}
  return context;
}
function makePayload(question,previous,context){return {question,history:[...previous,{role:'user',content:question}].slice(-8),context};}
async function requestAnswer(payload,signal){
  const response=await fetch('https://woongb-ai.woongbts.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||typeof data.answer!=='string'||!data.answer.trim())throw new Error('AI response unavailable');
  return data.answer;
}
function addMessage(text,role){
  const row=document.createElement('div');row.className='wb-ai-row '+role;
  const bubble=document.createElement('div');bubble.className='wb-ai-bubble';bubble.textContent=text;row.appendChild(bubble);messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return bubble;
}
const welcome=addMessage('안녕하세요! 어떤 상품이 궁금하세요?\n아래에서 고르거나 편하게 질문해 주세요.','bot');
function updateContext(){
  const context=getContext(),known=Boolean(context.selection);contextBox.hidden=!known;
  contextBox.querySelector('span').textContent=context.selection||'';
  if(!panel.classList.contains('has-conversation'))welcome.textContent=known?'지금 선택한 조건에서 궁금한 점을 물어보세요.\n월요금과 할인 조건을 쉽게 안내해 드릴게요.':'안녕하세요! 어떤 상품이 궁금하세요?\n아래에서 고르거나 편하게 질문해 주세요.';
  const signature=(known?'selected:':'general:')+context.active_tab;
  if(quick.dataset.mode!==signature){
    quick.dataset.mode=signature;quick.replaceChildren();
    const choices=known?[{label:'이 조건 괜찮나요?',question:'지금 선택한 조건의 월요금과 주의할 점을 쉽게 설명해 주세요.'},{label:'다른 상품 비교',url:'/rates.html'}]:[{label:'내게 맞는 휴대폰 찾기',url:'/rates.html?tab=mobile'},{label:'알뜰폰 요금 알아보기',url:'/rates.html?tab=mvno'}];
    choices.push({label:'인터넷·TV 비교하기',url:'/rates.html?tab=internet'},{label:'영업시간·오시는 길',question:'영업시간과 매장 위치를 알려주세요.'});
    for(const choice of choices){const node=document.createElement(choice.url?'a':'button');node.className=choice.url?'wb-ai-rate-chip':'wb-ai-chip';node.textContent=choice.label;if(choice.url)node.href=choice.url;else{node.type='button';node.addEventListener('click',()=>send(choice.question));}quick.appendChild(node);}
  }
}
function answerActions(bubble,context){
  const actions=document.createElement('div');actions.className='wb-ai-actions';actions.setAttribute('aria-label','답변 다음 단계');
  const rate=document.createElement('a');rate.textContent=context.selection?'선택 조건 다시 보기':'요금 계산하기';rate.href=context.selection&&location.pathname==='/rates.html'?location.pathname+location.search:'/rates.html';
  const contact=document.createElement('a');contact.textContent='매장 카톡 상담';contact.href='https://pf.kakao.com/_nWwNT/chat';contact.target='_blank';contact.rel='noopener noreferrer';actions.append(rate,contact);bubble.appendChild(actions);
}
async function send(raw,retry){
  const question=String(raw||'').trim().slice(0,200);if(!question||busy)return;
  panel.classList.add('has-conversation');
  const context=retry?.context||getContext(),payload=makePayload(question,history,context);
  if(!retry)addMessage(question,'user');
  input.value='';busy=true;sendButton.disabled=true;quick.querySelectorAll('button').forEach(x=>x.disabled=true);if(retry?.button)retry.button.disabled=true;
  const pending=addMessage('답변을 준비하고 있어요…','bot');pending.setAttribute('role','status');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),14000);
  try{
    const answer=await requestAnswer(payload,controller.signal);pending.parentElement.remove();
    const bubble=addMessage(answer,'bot');answerActions(bubble,context);history=[...payload.history,{role:'assistant',content:answer}].slice(-8);
    if(retry?.bubble)retry.bubble.parentElement.remove();
  }catch(error){
    pending.parentElement.remove();if(retry?.bubble)retry.bubble.parentElement.remove();
    const bubble=addMessage(error.name==='AbortError'?'답변이 조금 늦어지고 있어요.\n같은 질문으로 다시 시도하거나 매장에 문의해 주세요.':'답변 연결이 원활하지 않아요.\n다시 시도하거나 전화·카카오톡으로 문의해 주세요.','bot');
    const button=document.createElement('button');button.type='button';button.className='wb-ai-retry';button.textContent='다시 시도';button.addEventListener('click',()=>send(question,{context,button,bubble}));bubble.appendChild(button);answerActions(bubble,context);
  }finally{clearTimeout(timeout);busy=false;sendButton.disabled=false;quick.querySelectorAll('button').forEach(x=>x.disabled=false);if(matchMedia('(min-width:641px)').matches)input.focus();messages.scrollTop=messages.scrollHeight;}
}
function open(){updateContext();panel.classList.add('open');launcher.setAttribute('aria-expanded','true');if(matchMedia('(min-width:641px)').matches)input.focus();else panel.querySelector('.wb-ai-close').focus();}
function close(){panel.classList.remove('open');launcher.setAttribute('aria-expanded','false');launcher.focus();}
launcher.addEventListener('click',()=>panel.classList.contains('open')?close():open());panel.querySelector('.wb-ai-close').addEventListener('click',close);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.classList.contains('open'))close();});
input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});
form.addEventListener('submit',event=>{event.preventDefault();if(!composing)send(input.value);});
document.addEventListener('change',()=>{if(panel.classList.contains('open'))updateContext();});
const calculator=document.querySelector('main .rate-panel')?.parentElement;
if(calculator)new MutationObserver(()=>{if(panel.classList.contains('open'))updateContext();}).observe(calculator,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
updateContext();
}();
