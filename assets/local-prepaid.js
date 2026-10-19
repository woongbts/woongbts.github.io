/* Shared prepaid plan cards. All prices sourced from /data/prepaid.json; do not hard-code tariffs in SEO pages. */
(()=>{'use strict';
const ids=['PRE-FREETLG-1521','PRE-FREETLG-1879','PRE-FREETLG-1523'];
const tags=['가볍게 쓰는 분','실속 데이터','데이터 넉넉하게'];
const fallback='요금 확인 중';
const fmt=(v)=>typeof v==='number'?v.toLocaleString('ko-KR')+'원':'매장 문의';
const apply=(root,plan,index)=>{
 const put=(key,val)=>{const n=root.querySelector('[data-plan-'+key+']');if(n)n.textContent=val};
 put('name',plan.name);put('price',fmt(plan.monthly_fee));put('data',plan.data||'상담 시 확인');put('voice',plan.voice||'상담 시 확인');put('sms',plan.sms||'상담 시 확인');
 const link=root.querySelector('[data-plan-link]');if(link){const u=new URL('/rates.html',location.origin);u.searchParams.set('wbtab','prepaid');u.searchParams.set('utm_campaign','prepaid-'+(document.body.dataset.region||'local'));u.searchParams.set('utm_medium','internal');u.searchParams.set('utm_content','plan-'+plan.id);u.searchParams.set('pp',plan.id);u.searchParams.set('pprov',plan.provider_id);u.hash='prepaid-form';link.href=u.pathname+u.search+u.hash;link.textContent='이 요금제로 상담하기 →';link.setAttribute('aria-label',plan.name+' 선택한 상태로 예상요금 확인 및 상담하기')}
 root.hidden=false;
};
async function init(){const els=[...document.querySelectorAll('[data-plan-id]')];if(!els.length)return;
 try{const r=await fetch('/data/prepaid.json',{cache:'no-cache'});if(!r.ok)throw Error('plan data unavailable');const d=await r.json();const map=new Map((d.plans||[]).map(p=>[p.id,p]));let count=0;els.forEach((el,i)=>{const p=map.get(el.dataset.planId);if(p){apply(el,p,i);count++}});const stamp=document.getElementById('prepaid-data-stamp');if(stamp)stamp.textContent='요금 정보 기준일: '+(d.meta?.updated_at||'확인 필요')+' · 실제 가입 가능 여부 및 조건은 상담 시 최종 확인';if(!count)throw Error('plans not found');
 }catch(err){els.forEach(el=>{el.hidden=false;const price=el.querySelector('[data-plan-price]');if(price)price.textContent='매장 문의';const name=el.querySelector('[data-plan-name]');if(name)name.textContent='선불 요금제 상담';const specs=el.querySelector('.specs');if(specs)specs.hidden=true;const link=el.querySelector('[data-plan-link]');if(link){link.href='/rates.html?wbtab=prepaid';link.textContent='전체 선불폰 요금 확인'}});const stamp=document.getElementById('prepaid-data-stamp');if(stamp)stamp.textContent='현재 요금 정보를 불러오지 못했습니다. 최신 조건은 매장에 문의해 주세요.'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
