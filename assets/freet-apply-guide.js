/* One short preparation step before the unchanged Freet application. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const prepaid = params.get('type') === 'prepaid';
  const title = prepaid ? '프리티 선불폰 온라인 개통 신청' : '프리티 후불 알뜰폰 온라인 개통 신청';
  $('apply-heading').textContent = title;
  document.title = title + ' | 웅비통신 덕천만덕점';
  $('postpaid-retention').hidden = prepaid;
  $('prepaid-retention').hidden = !prepaid;
  $('back-to-calculator').href = prepaid ? '/rates.html?tab=prepaid' : '/rates.html?tab=mvno#freet-postpaid-feature';
  $('apply-lead').textContent = '요금제를 미리 고르지 않아도 신청할 수 있습니다. 아래에서 준비사항을 확인하고 프리티 신청서로 이동하세요.';
  $('next-step').replaceChildren();
  const emphasis = document.createElement('b');
  emphasis.textContent = (prepaid ? '선불' : '후불') + ' · 통신망 · 요금제';
  $('next-step').append('다음 프리티 화면에서 ', emphasis, '를 선택하고 본인인증을 진행합니다. 마지막 확인 화면에서 요금제명과 월요금을 확인해 주세요.');
  const planId = params.get('plan');
  if (!planId) return;
  $('chosen-plan').hidden = false;
  if (!(prepaid ? /^PRE-FREET(?:SKT|KT|LG)-[A-Z0-9-]+$/i : /^FREET(?:SKT|KT|LG)-[A-Z0-9-]+$/i).test(planId)) {
    $('chosen-status').textContent = '선택하신 요금제를 확인하지 못했습니다. 프리티 신청서에서 요금제를 직접 선택해 주세요.';
    return;
  }
  let copyText = '';
  $('copy-plan').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      $('copy-status').textContent = '통신망과 요금제명을 복사했습니다. 프리티 신청서에서 같은 상품을 찾아 선택해 주세요.';
    } catch {
      $('copy-status').textContent = '자동 복사가 되지 않습니다. 위 통신망과 요금제명을 길게 누르거나 드래그해 복사해 주세요.';
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents($('chosen-name'));
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
  (async () => {
    try {
      const data = prepaid
        ? await fetch('/data/prepaid.json', {cache:'no-store'}).then(r => {if (!r.ok) throw Error('catalog');return r.json();})
        : await window.WoongbiMvnoApi.loadCatalog();
      const plan = data.plans?.find(item => item.id === planId);
      if (!plan) throw Error('missing plan');
      const network = plan.network === 'LGU+' ? 'LG U+' : plan.network;
      if (!plan.name || !network) throw Error('incomplete plan');
      copyText = '프리티 ' + network + '망 · ' + plan.name;
      $('chosen-name').textContent = copyText;
      const fee = Number(plan.special_monthly_fee ?? plan.monthly_fee);
      $('chosen-facts').textContent = (prepaid ? '선불' : '후불') + (Number.isFinite(fee) && fee > 0 ? ' · 월 ' + fee.toLocaleString('ko-KR') + '원' : ' · 요금은 신청서에서 확인해 주세요');
      $('chosen-status').textContent = '비교하신 상품을 다시 찾기 위한 메모입니다. 최종 요금과 가입 가능 여부는 프리티 신청서에서 확인해 주세요.';
      $('chosen-content').hidden = false;
    } catch {
      $('chosen-status').textContent = '선택하신 요금제 정보를 불러오지 못했습니다. 요금제 비교 화면에서 다시 확인하거나 프리티 신청서에서 직접 선택해 주세요.';
    }
  })();
})();
