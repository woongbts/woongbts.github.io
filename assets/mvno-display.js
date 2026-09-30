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
    {key:'data',title:'데이터 넉넉하게',description:'외부에서 데이터를 많이 쓴다면',match:p=>gb(p)>=15 || /일\s*2GB/.test(p.data || '')}
  ];
  // Customer-facing store assortment. Business settlement details are private.
  const picks = {
    light:['MMOBILE-1295','UPLUSE-1705','HELLOUPLUS-1492'],
    daily:['SKYLIFE-2069','MMOBILE-2148','UPLUSE-1623'],
    data:['UPLUSE-2390','SKYLIFE-2084','7MOBILE-1685']
  };
  function recommend(data, selected='all') {
    const plans = new Map(clean(data).plans.map(p=>[p.id,p]));
    return groups.filter(g=>selected==='all'||g.key===selected).flatMap(g=>{
      return picks[g.key].map(id=>plans.get(id)).filter(p=>p && Number.isFinite(fee(p)) && fee(p)>0 && g.match(p)).slice(0, selected==='all'?1:3).map(plan=>({plan,group:g}));
    });
  }
  window.WoongbiMvnoDisplay={clean,recommend,groups};
})();
