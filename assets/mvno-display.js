/* Store assortment and customer-facing MVNO comparison. */
(() => {
  const excluded = new Set(['SMKT', 'SMSKT', 'IYAGISKT', 'IYAGIKT', 'IYAGILG']);
  function clean(data) {
    const providers = (data?.providers || []).filter(p => !excluded.has(p.id) && !/스노우맨|이야기모바일/.test(p.name || ''));
    const allowed = new Set(providers.map(p => p.id));
    return {...data, providers, plans:(data?.plans || []).filter(p => allowed.has(p.provider_id))};
  }
  function gb(plan) {
    const match = String(plan.data || '').match(/([\d.]+)\s*(GB|MB)/i);
    return match ? Number(match[1]) / (match[2].toUpperCase() === 'MB' ? 1000 : 1) : 0;
  }
  const fee = p => Number(p.special_monthly_fee ?? p.monthly_fee);
  const groups = [
    {key:'light',title:'월 부담 가볍게',description:'데이터를 적게 쓰고 요금을 낮추고 싶다면',match:p=>gb(p)<5},
    {key:'daily',title:'일상용으로 균형 있게',description:'카카오톡·검색 등 일상 사용량에 맞춰 비교',match:p=>gb(p)>=5 && gb(p)<15},
    {key:'data',title:'데이터 넉넉하게',description:'외부에서 데이터를 많이 쓴다면',match:p=>gb(p)>=15}
  ];
  function recommend(data, selected='all') {
    const eligible = clean(data).plans.filter(p=>Number.isFinite(fee(p)) && fee(p)>0 && gb(p)>0 && !/청소년|키즈|어린이|시니어|만\s*\d|디바이스|데이터전용/.test(p.name || '') && /무제한|기본제공|[1-9]\d*\s*분/.test(p.voice || ''));
    return groups.filter(g=>selected==='all'||g.key===selected).flatMap(g=>{
      const seen = new Set();
      return eligible.filter(g.match).sort((a,b)=>fee(a)-fee(b)||String(a.id).localeCompare(String(b.id))).filter(p=>{
        const key=[p.provider_id,p.name,p.data,p.voice,p.sms].join('|');
        if(seen.has(key))return false;seen.add(key);return true;
      }).slice(0, selected==='all'?1:3).map(plan=>({plan,group:g}));
    });
  }
  window.WoongbiMvnoDisplay={clean,recommend,groups};
})();
