(() => {
'use strict';
const product=document.getElementById('visit-product');
const detail=document.getElementById('visit-detail');
const message=document.getElementById('visit-status');
let choice=null;
try{choice=JSON.parse(sessionStorage.getItem('wb_visit_selection_v1')||'null')}catch{}
if(choice&&typeof choice==='object'&&String(choice.product_name||'').trim()){
  product.textContent=String(choice.product_name).slice(0,150);
  detail.textContent=[choice.provider,choice.detail,choice.monthly!=null&&Number.isFinite(Number(choice.monthly))?'예상 월요금: '+Number(choice.monthly).toLocaleString('ko-KR')+'원':''].filter(Boolean).join('\n')||'상품을 확인한 뒤 매장에서 상담해 드립니다.';
}
const text=()=>{
 const result=['[웅비통신 방문 상담 예약]','상품: '+product.textContent,
  detail.textContent==='매장에서 상담할 상품을 함께 알려주세요.'?'':detail.textContent,
  '※ 최신 가격·재고·가입조건은 방문 전 최종 확인'].filter(Boolean).join('\n');
 return result;
};
document.getElementById('visit-copy')?.addEventListener('click',async ()=>{
 try{await navigator.clipboard.writeText(text());message.textContent='선택한 조건이 복사됐어요. 네이버 예약 요청사항에 붙여넣으세요.';}
 catch{message.textContent='기기에서 복사를 허용하지 않았어요. 위 내용을 직접 참고하여 예약해 주세요.';}
});
document.getElementById('visit-book')?.addEventListener('click',()=>{
 try{window.woongbiTrackConversion?.('booking_click',{category:choice?.category||'visit',product_id:choice?.product_id||''})}catch{}
});
})();