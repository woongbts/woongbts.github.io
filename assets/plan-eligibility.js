(()=>{
  const name=p=>String(p?.name||'').toLowerCase().replace(/\s+/g,'');
  function labels(p){
    const n=name(p),a=String(p?.age_limit||'ALL').toUpperCase(),out=[];
    if(/복지|장애|국가유공|유공자|손누리|소리누리|기초생활|차상위/.test(n))out.push('복지 대상자용');
    if(/현역병|군인/.test(n))out.push('군인 대상자용');
    const ages={B_19_34:'만 19~34세',B_65_74:'만 65~74세',O_65:'만 65세 이상',O_75:'만 75세 이상',U_12:'만 12세 이하',U_18:'만 18세 이하',U_34:'만 34세 이하'};
    if(ages[a])out.push(ages[a]);
    if(/청년|유쓰|uth|y덤/.test(n))out.push('청년 전용');
    if(/시니어|65\+|75\+/.test(n))out.push('시니어 대상');
    if(/키즈|청소년|zem|스쿨덤/.test(n))out.push('어린이·청소년용');
    return [...new Set(out)];
  }
  function allowed(p,category='general'){
    const tags=labels(p),a=String(p?.age_limit||'ALL').toUpperCase();
    if(tags.some(t=>/복지|군인|청년|어린이/.test(t)))return false;
    if(category==='senior')return ['ALL','O_19','B_65_74','O_65','O_75',''].includes(a);
    return !tags.length&&['ALL','O_19',''].includes(a);
  }
  window.WoongbiPlanEligibility={labels,allowed};
})();
