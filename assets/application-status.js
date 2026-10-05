(() => {
  'use strict';
  const API='https://woongbi-consent.woongbts.workers.dev';
  const view=document.getElementById('status-view');
  const refresh=document.getElementById('status-refresh');
  const token=new URLSearchParams(location.search).get('t')||'';
  const rentalSteps=[
    ['new','신청 접수','웅비렌탈에서 신청 내용을 확인합니다.'],
    ['contacted','고객 연락','요금·사은품·설치조건을 다시 안내합니다.'],
    ['submitted','렌탈사 공식 접수','렌탈사 공식 절차로 계약을 진행합니다.'],
    ['completed','설치·처리 완료','신청 처리가 완료된 상태입니다.']
  ];
  const storeSteps=[
    ['new','신청 접수','웅비통신에서 신청 내용을 확인합니다.'],
    ['contacted','고객 연락','선택 상품과 최종 조건을 안내합니다.'],
    ['completed','상담·처리 완료','상담 또는 신청 처리가 완료된 상태입니다.']
  ];
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function render(data){
    const steps=data.application_type==='rental'?rentalSteps:storeSteps;
    const currentIndex=steps.findIndex(x=>x[0]===data.status);
    const cancelled=data.status==='cancelled';
    view.className='';
    view.innerHTML=
      '<div class="summary"><span>'+esc(data.service)+' · 신청번호 '+esc(data.receipt)+'</span><strong>'+esc(data.product_name)+'</strong>'+
      (data.provider?'<small>'+esc(data.provider)+'</small>':'')+
      '<small>현재 상태 · '+esc(data.status_label)+' · '+new Date(data.updated_at).toLocaleString('ko-KR')+'</small></div>'+
      (cancelled?'<p class="error">현재 신청은 취소 처리된 상태입니다. 자세한 내용은 매장으로 문의해 주세요.</p>':
      '<ol class="steps">'+steps.map((step,i)=>{
        const cls=i<currentIndex?'done':i===currentIndex?'active':'';
        return '<li class="'+cls+'"><span>'+(i+1)+'</span><div><b>'+esc(step[1])+'</b><small>'+esc(step[2])+'</small></div></li>';
      }).join('')+'</ol>')+
      '<p class="note">실제 개통·계약·설치 일정은 상품과 진행 상황에 따라 달라질 수 있습니다. 상태가 바로 갱신되지 않았다면 매장 확인 후 순차적으로 반영됩니다.</p>';
  }
  async function load(){
    if(!token){view.className='error';view.textContent='신청 상태 조회 링크가 올바르지 않습니다.';return}
    view.className='loading';view.textContent='신청 상태를 확인하는 중입니다.';
    try{
      const res=await fetch(API+'/api/application-status?token='+encodeURIComponent(token),{headers:{accept:'application/json'},cache:'no-store'});
      const data=await res.json();
      if(!res.ok||!data.ok)throw new Error(data.error||'신청 상태를 확인할 수 없습니다.');
      render(data);
    }catch(e){view.className='error';view.textContent=e.message||'신청 상태를 확인할 수 없습니다.';}
  }
  refresh?.addEventListener('click',load);
  load();
})();