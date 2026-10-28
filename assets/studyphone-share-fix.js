(()=>{'use strict';
const button=document.getElementById('share-studyphone-quote');
if(!button)return;
button.addEventListener('click',async event=>{
 event.preventDefault();event.stopImmediatePropagation();
 const status=document.getElementById('studyphone-quote-status');
 const plan=document.getElementById('studyphone-plan');
 if(!plan||!plan.value){if(status)status.textContent='요금제를 먼저 선택해 주세요.';return;}
 const url=new URL('/rates.html',location.origin);url.searchParams.set('tab','studyphone');url.searchParams.set('sp',plan.value);
 const planName=plan.selectedOptions[0]?.textContent?.trim()||'선택 요금제';
 const title='웅비통신 공신폰 상담';
 const message='[웅비통신 공신폰 상담]\\n갤럭시 A17 공신폰 · KT M모바일\\n선택 요금제: '+planName+'\\n아래 링크에서 요금제와 예상 납부액을 확인하세요.\\n※ 실제 개통 조건은 상담 시점에 최종 확인해 주세요.';
 try{
  if(navigator.share){await navigator.share({title,text:message,url:url.href});if(status)status.textContent='공유창을 열었습니다.';return;}
  const text=message+'\\n'+url.href;
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
  else{const el=document.createElement('textarea');el.value=text;el.style.position='fixed';el.style.opacity='0';document.body.appendChild(el);el.select();const ok=document.execCommand('copy');el.remove();if(!ok)throw Error('copy failed');}
  if(status)status.textContent='공신폰 상담 링크를 복사했습니다. 원하는 곳에 붙여넣어 주세요.';
 }catch(err){if(err?.name==='AbortError')return;if(status)status.textContent='자동 공유에 실패했습니다. 주소를 복사해 주세요: '+url.href;}
},true);
})();