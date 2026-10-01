/* Customer-facing MVNO rendering helpers. Assortment and picks are server-owned. */
(() => {
  const fallbackGroups = [
    {key:'light',title:'월 부담 가볍게',description:'데이터를 적게 쓰고 요금을 낮추고 싶다면'},
    {key:'daily',title:'일상용으로 균형 있게',description:'카카오톡·검색 등 일상 사용량에 맞춰 비교'},
    {key:'data',title:'데이터 넉넉하게',description:'외부에서 데이터를 많이 쓴다면'}
  ];
  function clean(data) {
    return data && typeof data === 'object' ? data : {meta:{},providers:[],plans:[],groups:fallbackGroups,recommendations:{}};
  }
  function recommend(data, selected='all') {
    data=clean(data);
    const groups=Array.isArray(data.groups)&&data.groups.length?data.groups:fallbackGroups;
    const recommendations=data.recommendations||{};
    return groups.filter(group=>selected==='all'||group.key===selected).flatMap(group=>{
      const plans=Array.isArray(recommendations[group.key])?recommendations[group.key]:[];
      return plans.slice(0,selected==='all'?1:3).map(plan=>({plan,group}));
    });
  }
  window.WoongbiMvnoDisplay={clean,recommend,groups:fallbackGroups};
})();
