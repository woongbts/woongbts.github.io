(() => {
  'use strict';

  const id = new URLSearchParams(location.search).get('id');
  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const IMAGE_REV = '20261003-7f78334';
  const RENTAL_ENTRY_KEY = 'wb_rental_entry_v1';
  const RECENT_KEY = 'wb_rental_recent_v1';
  const RENTAL_APPLICATION_BASE = 'https://woongbi-consent.woongbts.workers.dev';
  let policyGeneratedAt = '';
  let rentalApplicationPolicy = null;
  const rentalAnalyticsPath = () => '/rental/product/' + encodeURIComponent(String(product?.id || id || 'unknown'));
  function trackRental(type, detail = {}) {
    if (typeof window.woongbiTrackConversion !== 'function') return;
    window.woongbiTrackConversion(type, {
      ...detail,
      product_id: product?.id || id || '',
      analyticsPath: rentalAnalyticsPath()
    });
  }
  function rentalEntryLabel() {
    let entry = 'direct';
    try { entry = sessionStorage.getItem(RENTAL_ENTRY_KEY) || 'direct'; } catch (_) {}
    return ({recommend:'추천상품',catalog:'전체상품',direct:'직접 상세페이지'})[entry] || entry;
  }
  function copyTextFallback(text) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly','');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (_) { return false; }
  }
  function showConsultToast(message) {
    let toast = document.getElementById('rental-consult-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rental-consult-toast';
      toast.className = 'rental-consult-toast';
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showConsultToast.timer);
    showConsultToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function consultMessage() {
    const v = currentVariant();
    if (!product || !v) return '';
    const link = new URL(location.href);
    link.hash = '';
    return [
      '[웅비렌탈 상담]',
      '상품: ' + product.name,
      product.model ? '모델: ' + product.model : '',
      '렌탈사/옵션: ' + optionLabel(v.managementLabel || v.management),
      '계약기간: ' + termLabel(v),
      '월 렌탈료: ' + (v.monthly == null ? '상담 확인' : won(v.monthly)),
      '고객사은품: ' + (v.gift == null ? '상담 확인' : won(v.gift)),
      '확인 경로: ' + rentalEntryLabel(),
      '상품 링크: ' + link.toString(),
      '※ 최종 접수 전 최신 정책을 다시 확인해 주세요.'
    ].filter(Boolean).join('\n');
  }
  function copyConsultMessage() {
    const message = consultMessage();
    if (!message) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message)
        .then(() => showConsultToast('선택조건이 복사됐어요. 카톡창에 붙여넣기만 하세요.'))
        .catch(() => {
          const ok = copyTextFallback(message);
          showConsultToast(ok ? '선택조건이 복사됐어요. 카톡창에 붙여넣기만 하세요.' : '카톡이 열리면 상품명과 선택조건을 보내주세요.');
        });
    } else {
      const ok = copyTextFallback(message);
      showConsultToast(ok ? '선택조건이 복사됐어요. 카톡창에 붙여넣기만 하세요.' : '카톡이 열리면 상품명과 선택조건을 보내주세요.');
    }
  }
  const imageCandidatesFor = product => {
    const raw = [product.image, product.imageSourceOriginal, ...((product.detailImages || []).slice(0, 3))].filter(Boolean);
    const candidates = [];
    raw.forEach(src => {
      const value = String(src || '').trim();
      if (!value) return;
      const resolved = value.startsWith('assets/product-images/')
        ? '/rental/' + value + '?v=' + IMAGE_REV
        : value;
      if (!candidates.includes(resolved)) candidates.push(resolved);
      if (value.startsWith('assets/product-images/')) {
        const mirror = 'https://raw.githubusercontent.com/woongbts/woongbts.github.io/main/rental/' + value + '?v=' + IMAGE_REV;
        if (!candidates.includes(mirror)) candidates.push(mirror);
      }
    });
    return candidates;
  };
  const brandLabel = brand => ({
    'COWAY':'코웨이',
    'CUCKOO':'쿠쿠',
    'LG퓨리케어':'LG 퓨리케어',
    'SK매직':'SK매직',
    '청호나이스':'청호나이스',
    '현대큐밍':'현대큐밍',
    '루헨스':'루헨스',
    '유버스':'유버스'
  }[brand] || brand || '');
  const $ = sel => document.querySelector(sel);
  const policyMonthText = value => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}년 ${Number(m[2])}월 기준` : '최신 정책 기준';
  };
  function applyPolicyMonth(value) {
    policyGeneratedAt = value || policyGeneratedAt;
    const text = policyMonthText(policyGeneratedAt);
    document.querySelectorAll('[data-policy-month]').forEach(el => { el.textContent = text; });
  }
  function isSellableOption(option) {
    const text = [option?.managementLabel, option?.sourceOption, option?.care].filter(Boolean).join(' ');
    return !/(?:^|\s)단종\//.test(text);
  }
  function productMetrics(p) {
    const options = (p.options || []).filter(o => isSellableOption(o) && Number.isFinite(Number(o.monthly)));
    const monthly = options.map(o => Number(o.monthly));
    const gifts = options.map(o => Number(o.gift)).filter(Number.isFinite);
    return {minMonthly:monthly.length?Math.min(...monthly):null,maxGift:gifts.length?Math.max(...gifts):null};
  }
  function saveRecentProduct(p) {
    const m = productMetrics(p);
    const row = {id:p.id,name:p.name,model:p.model||'',brand:brandLabel(p.brand),category:p.category||'',page:p.page||('product.html?id='+encodeURIComponent(p.id)),image:imageCandidatesFor(p)[0]||'',minMonthly:m.minMonthly,maxGift:m.maxGift,at:Date.now()};
    let list=[];
    try { list=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]'); } catch (_) {}
    list=[row,...list.filter(x=>x&&x.id!==row.id)].slice(0,5);
    try { localStorage.setItem(RECENT_KEY,JSON.stringify(list)); } catch (_) {}
  }
  function applyProductSeo(p) {
    const m=productMetrics(p);
    const canonical=new URL('product.html?id='+encodeURIComponent(p.id), location.origin + '/rental/').toString();
    const title=`${brandLabel(p.brand)} ${p.name} 렌탈 | 웅비렌탈`;
    const desc=[p.model?('모델 '+p.model):'',m.minMonthly!=null?('월 '+won(m.minMonthly)+'부터'):'',m.maxGift!=null?('고객사은품 최대 '+won(m.maxGift)):'','최종 접수 전 최신 조건 확인'].filter(Boolean).join(' · ');
    document.title=title;
    $('#product-meta-description')?.setAttribute('content',desc);
    $('#product-canonical')?.setAttribute('href',canonical);
    $('#product-og-title')?.setAttribute('content',title);
    $('#product-og-description')?.setAttribute('content',desc);
    $('#product-og-url')?.setAttribute('content',canonical);
    const image=imageCandidatesFor(p)[0];
    if(image) $('#product-og-image')?.setAttribute('content',new URL(image,location.href).toString());
    const jsonld={
      '@context':'https://schema.org','@type':'Product',name:p.name,
      brand:{'@type':'Brand',name:brandLabel(p.brand)||p.brand||'웅비렌탈'},
      model:p.model||undefined,category:p.category||undefined,description:p.shortDescription||desc,url:canonical,
      image:image?[new URL(image,location.href).toString()]:undefined,
      additionalProperty:[
        m.minMonthly!=null?{'@type':'PropertyValue',name:'월 렌탈료',value:won(m.minMonthly)+'부터'}:null,
        m.maxGift!=null?{'@type':'PropertyValue',name:'고객사은품',value:'최대 '+won(m.maxGift)}:null,
        {'@type':'PropertyValue',name:'정책 기준',value:policyMonthText(policyGeneratedAt)}
      ].filter(Boolean)
    };
    const node=$('#product-jsonld'); if(node) node.textContent=JSON.stringify(jsonld);
  }

  function optionLabel(value) {
    let x = String(value || '').trim();
    if (!x) return '';
    x = x.replace(/^단종\//, '');
    x = x.replace(/^기본 조건$/, '기본 옵션');
    x = x.replace(/^방문형(?=$|[·/)]|\s)/, '방문관리');
    x = x.replace(/^셀프형(?=$|[·/)]|\s)/, '셀프관리');
    x = x.replace(/^(방문관리|셀프관리)\)\d+개월$/, '$1');
    x = x.replace(/^킹\(K$/, '킹').replace(/^퀸\(Q$/, '퀸').replace(/^슈퍼싱글\(SS$/, '슈퍼싱글');
    x = x.replace(/^토탈케어\((라지킹|킹|퀸|슈퍼싱글|싱글)$/, '토탈케어 · $1');
    x = x.replace(/6개월\s*반값할인/g, '6개월 반값').replace(/10개월\s*반값할인/g, '10개월 반값');
    x = x.replace(/\/+/g, ' · ').replace(/\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();
    if (x === '슬러지통x') return '슬러지통 없음';
    if (x === '슬러지통o') return '슬러지통 있음';
    return x;
  }

  function optionHeading(category) {
    if (category === '정수기' || category === '공기청정기' || category === '비데·연수기') return '관리방식 / 제품 옵션';
    if (category === '매트리스·프레임') return '사이즈 / 케어 옵션';
    if (category === '주방가전') return '설치 / 제품 옵션';
    return '제품 옵션';
  }

  const managementBox = $('#generic-management');
  const termBox = $('#generic-term');
  let product = null;
  let state = { management: '', term: '' };

  function optionSet() {
    return (product.options || []).filter(o => isSellableOption(o) && o.management === state.management);
  }

  function currentVariant() {
    return (product.options || []).find(o =>
      isSellableOption(o) && o.management === state.management && String(o.term) === String(state.term)
    );
  }

  function renderManagement() {
    const unique = [];
    (product.options || []).filter(isSellableOption).forEach(o => {
      if (!unique.some(x => x.value === o.management)) {
        unique.push({value:o.management, label:optionLabel(o.managementLabel || o.management)});
      }
    });

    managementBox.innerHTML = unique.map(x =>
      '<button type="button" data-value="' + x.value + '">' + x.label + '</button>'
    ).join('');
    managementBox.classList.toggle('single', unique.length === 1);

    managementBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.management = btn.dataset.value;
        const options = optionSet();
        if (!options.some(o => String(o.term) === String(state.term))) {
          state.term = options.length ? String(options[0].term) : '';
        }
        render();
        trackRental('rental_option_select', {management:state.management});
      });
    });
  }

  function termLabel(option) {
    if (!option) return '상품별 조건';
    if (option.termLabel) return option.termLabel;
    const term = String(option.term ?? '').trim();
    return term ? term + '개월' : '상품별 조건';
  }

  function renderTerms() {
    const options = optionSet();
    const terms = [...new Set(options.map(o => String(o.term ?? '')))];
    termBox.innerHTML = terms.map(term => {
      const option = options.find(o => String(o.term ?? '') === term);
      return '<button type="button" data-value="' + term + '">' + termLabel(option) + '</button>';
    }).join('');
    termBox.classList.toggle('single', terms.length === 1);

    termBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.term = btn.dataset.value;
        render();
        trackRental('rental_term_select', {term:String(state.term)});
      });
    });
  }

  function render() {
    renderTerms();
    const v = currentVariant();
    if (!v) return;

    managementBox.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.management);
    });
    termBox.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === String(state.term));
    });

    $('#monthly-fee').textContent = v.monthly == null ? '상담 확인' : won(v.monthly);
    $('#gift-fee').textContent = v.gift == null ? '상담 확인' : won(v.gift);
    $('#care-cycle').textContent = v.care || '상담 확인';
    $('#sticky-selection').textContent = optionLabel(v.managementLabel || v.management) + ' · ' + termLabel(v);
    $('#sticky-monthly').textContent = v.monthly == null ? '상담 확인' : won(v.monthly);
    $('#sticky-gift').textContent = v.gift == null ? '상담 확인' : won(v.gift);

    const cardRow = $('#generic-card-row');
    if (v.card == null) {
      cardRow.hidden = true;
    } else {
      cardRow.hidden = false;
      $('#card-fee').textContent = won(v.card);
    }
  }


  function applicationProvider(v) {
    const option = optionLabel(v?.managementLabel || v?.management || '');
    if (product?.sourceKind === 'clover-import' && /LG헬로렌탈|스마트렌탈|BS ON|이니렌탈|현대유버스|KT가전구독/i.test(option)) return option;
    return brandLabel(product?.brand) || product?.brand || '선택 렌탈사';
  }
  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
  async function loadRentalApplicationPolicy() {
    if (rentalApplicationPolicy) return rentalApplicationPolicy;
    const response = await fetch(RENTAL_APPLICATION_BASE + '/api/rental-application-policy', {mode:'cors',credentials:'omit',cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.policy) throw new Error(data.error || '신청 안내를 불러오지 못했습니다.');
    rentalApplicationPolicy = data.policy;
    return rentalApplicationPolicy;
  }
  function renderRentalApplicationPolicy(policy, provider) {
    const processing = $('#rental-processing-policy');
    const third = $('#rental-third-party-policy');
    const thirdLabel = $('#rental-third-party-label');
    if (processing) {
      processing.replaceChildren();
      const rows = [
        ['처리 목적', policy.purpose],
        ['필수 항목', policy.items?.required],
        ['선택 항목', policy.items?.optional],
        ['보유 기간', policy.retention],
        ['안내', policy.refusal],
        ['결제정보', policy.payment_notice]
      ];
      rows.forEach(([label,value]) => {
        const p=document.createElement('p'),b=document.createElement('b');
        b.textContent=label+' · ';p.append(b,document.createTextNode(String(value||'')));processing.append(p);
      });
    }
    if (thirdLabel) thirdLabel.textContent = '제공받는 자: ' + provider;
    if (third) {
      third.replaceChildren();
      const rows = [
        ['제공받는 자', provider],
        ['제공 목적', policy.third_party?.purpose],
        ['제공 항목', policy.third_party?.items],
        ['보유·이용 기간', policy.third_party?.retention],
        ['동의 거부 안내', policy.third_party?.refusal]
      ];
      rows.forEach(([label,value]) => {
        const p=document.createElement('p'),b=document.createElement('b');
        b.textContent=label+' · ';p.append(b,document.createTextNode(String(value||'')));third.append(p);
      });
    }
  }
  function fillRentalApplicationSummary() {
    const v=currentVariant();
    if(!product||!v)return null;
    const provider=applicationProvider(v);
    $('#rental-apply-product').textContent=[brandLabel(product.brand),product.name,product.model].filter(Boolean).join(' · ');
    $('#rental-apply-condition').textContent=[
      provider,
      optionLabel(v.managementLabel||v.management),
      termLabel(v),
      v.monthly==null?'월요금 상담 확인':'월 '+won(v.monthly),
      v.gift==null?'사은품 상담 확인':'고객사은품 '+won(v.gift)
    ].filter(Boolean).join(' · ');
    return {v,provider};
  }
  async function openRentalApplication() {
    const current=fillRentalApplicationSummary();
    if(!current)return;
    const dialog=$('#rental-apply-dialog'),status=$('#rental-apply-status');
    if(status)status.textContent='개인정보 처리 안내를 확인하는 중입니다.';
    openDialog(dialog);
    trackRental('rental_apply_open',{management:current.v.management||'',term:String(current.v.term??'')});
    try {
      const policy=await loadRentalApplicationPolicy();
      renderRentalApplicationPolicy(policy,current.provider);
      if(status)status.textContent='';
    } catch(error) {
      if(status)status.textContent=error.message||'신청 안내를 불러오지 못했습니다.';
    }
  }
  async function submitRentalApplication(event) {
    event.preventDefault();
    const form=$('#rental-apply-form'),submit=$('#rental-apply-submit'),status=$('#rental-apply-status');
    const current=fillRentalApplicationSummary();
    if(!form||!current||!product)return;
    if(!form.reportValidity())return;
    if(!rentalApplicationPolicy){
      try{rentalApplicationPolicy=await loadRentalApplicationPolicy();renderRentalApplicationPolicy(rentalApplicationPolicy,current.provider);}
      catch(error){status.textContent=error.message||'신청 안내를 불러오지 못했습니다.';return;}
    }
    const method=form.querySelector('input[name="billing_method"]:checked')?.value||'';
    const payload={
      policy_version:rentalApplicationPolicy.version,
      processing_notice_ack:$('#rental-processing-ack')?.checked===true,
      third_party_consent:$('#rental-third-party-consent')?.checked===true,
      name:$('#rental-apply-name')?.value||'',
      phone:$('#rental-apply-phone')?.value||'',
      email:$('#rental-apply-email')?.value||'',
      install_address:$('#rental-apply-address')?.value||'',
      billing_method:method,
      billing_issuer:$('#rental-apply-issuer')?.value||'',
      inquiry:$('#rental-apply-inquiry')?.value||'',
      product_id:product.id,
      product_name:product.name,
      model:product.model||'',
      brand:brandLabel(product.brand)||product.brand||'',
      provider:current.provider,
      management:optionLabel(current.v.managementLabel||current.v.management),
      term:current.v.term??null,
      monthly:current.v.monthly??null,
      gift:current.v.gift??null,
      product_url:location.href
    };
    submit.disabled=true;status.textContent='신청을 안전하게 접수하는 중입니다.';
    trackRental('rental_apply_submit',{management:current.v.management||'',term:String(current.v.term??'')});
    try{
      const response=await fetch(RENTAL_APPLICATION_BASE+'/api/rental-application',{
        method:'POST',mode:'cors',credentials:'omit',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||'신청을 접수하지 못했습니다.');
      trackRental('rental_apply_success',{management:current.v.management||'',term:String(current.v.term??'')});
      status.textContent='신청이 접수되었습니다. 신청번호 '+String(data.receipt?.id||'').slice(0,8)+' · 확인 후 연락드리겠습니다.';
      form.reset();
      $('#rental-apply-product').textContent=[brandLabel(product.brand),product.name,product.model].filter(Boolean).join(' · ');
      fillRentalApplicationSummary();
    }catch(error){
      status.textContent=error.message||'신청을 접수하지 못했습니다. 카카오톡 또는 전화 상담을 이용해 주세요.';
    }finally{submit.disabled=false;}
  }

  function initialize(data) {
    product = (data.products || []).find(p => p.id === id);
    if (!product) throw new Error('product not found');

    applyProductSeo(product);
    $('#breadcrumb-model').textContent = product.model || product.name;
    $('#generic-brand').textContent = brandLabel(product.brand) || 'WOONGBI RENTAL';
    $('#generic-title').textContent = product.name;
    $('#generic-model').textContent = [product.model, product.color].filter(Boolean).join(' · ');
    $('#generic-description').textContent = product.shortDescription || '';
    $('#generic-model-row').textContent = product.model || '-';
    $('#generic-promo').textContent = product.promo || '최신 정책 상담 확인';
    document.body.classList.toggle('appliance-rental-detail', product.sourceKind === 'clover-import');
    const careLabel = $('#care-cycle-label');
    if (careLabel) careLabel.textContent = product.sourceKind === 'clover-import' ? '조건 안내' : '관리주기';
    $('#generic-color').textContent = product.color || '상담 확인';
    $('#generic-tags').innerHTML = (product.tags || []).map(t => '<span>' + t + '</span>').join('');
    $('#generic-highlights').innerHTML = (product.highlights || []).map(t => '<span>' + t + '</span>').join('');

    $('#summary-brand').textContent = brandLabel(product.brand) || '-';
    $('#summary-category').textContent = product.category || '-';
    const optionTitle = product.sourceKind === 'clover-import' ? '렌탈사 선택' : optionHeading(product.category);
    $('#generic-option-label').textContent = optionTitle;
    $('#summary-option-label').textContent = optionTitle;
    $('#summary-management').textContent = [...new Set((product.options || []).filter(isSellableOption).map(o => optionLabel(o.managementLabel || o.management)).filter(Boolean))].join(' / ') || '-';
    $('#summary-terms').textContent = [...new Set((product.options || []).filter(isSellableOption).map(o => termLabel(o)).filter(Boolean))].join(' / ') || '-';

    const img = $('#generic-image');
    const art = $('#generic-art');
    const imageCandidates = imageCandidatesFor(product);

    if (imageCandidates.length) {
      let imageIndex = 0;
      img.alt = product.name;
      img.hidden = true;
      art.hidden = false;

      const tryNextImage = () => {
        imageIndex += 1;
        if (imageIndex < imageCandidates.length) {
          img.src = imageCandidates[imageIndex];
        } else {
          img.hidden = true;
          art.hidden = false;
          img.removeAttribute('src');
        }
      };

      img.addEventListener('load', () => {
        if (img.naturalWidth > 0) {
          img.hidden = false;
          art.hidden = true;
        } else {
          tryNextImage();
        }
      });

      img.addEventListener('error', tryNextImage);
      img.src = imageCandidates[0];
    }

    if (product.sourceUrl) {
      $('#generic-source-note').textContent = product.sourceKind === 'clover-import'
        ? '상품 기본정보와 렌탈사별 공개 조건을 바탕으로 정리했습니다. 최종 접수 전 최신 조건을 다시 확인합니다.'
        : `상품 기본정보는 기존 웅비렌탈 판매자료와 ${policyMonthText(policyGeneratedAt)} 정책을 기준으로 정리했습니다.`;
    }

    const detailImages = (product.detailImages || []).filter(Boolean).slice(0, 24);
    const detailSection = $('#generic-source-detail');
    const detailBox = $('#generic-detail-images');
    if (detailSection && detailBox && detailImages.length) {
      detailBox.innerHTML = detailImages.map((src, index) =>
        '<img src="' + src + '" alt="' + product.name + ' 상세 이미지 ' + (index + 1) + '" loading="lazy" referrerpolicy="no-referrer">'
      ).join('');
      detailSection.hidden = false;
    }

    const first = (product.options || []).find(isSellableOption);
    if (!first) throw new Error('no options');
    state.management = first.management;
    state.term = String(first.term);

    renderManagement();
    render();
    saveRecentProduct(product);
    applyProductSeo(product);

    trackRental('rental_product_view', {entry:rentalEntryLabel()});

    document.querySelectorAll('[data-rental-consult]').forEach(link => {
      link.addEventListener('click', () => {
        const v = currentVariant();
        copyConsultMessage();
        trackRental('rental_kakao_click', {
          entry:rentalEntryLabel(),
          management:v?.management || '',
          term:String(v?.term ?? '')
        });
      });
    });
    document.querySelectorAll('[data-rental-phone]').forEach(link => {
      link.addEventListener('click', () => {
        const v = currentVariant();
        trackRental('rental_phone_click', {
          entry:rentalEntryLabel(),
          management:v?.management || '',
          term:String(v?.term ?? '')
        });
      });
    });
    $('#rental-apply-open')?.addEventListener('click',openRentalApplication);
    $('#rental-apply-sticky')?.addEventListener('click',openRentalApplication);
    $('#rental-apply-close')?.addEventListener('click',()=>closeDialog($('#rental-apply-dialog')));
    $('#rental-apply-dialog')?.addEventListener('click',event=>{if(event.target===$('#rental-apply-dialog'))closeDialog($('#rental-apply-dialog'));});
    $('#rental-apply-form')?.addEventListener('submit',submitRentalApplication);
  }

  Promise.all([
    fetch('data/products.json', {cache:'no-store'}).then(r => {
      if (!r.ok) throw new Error('data fetch failed');
      return r.json();
    }),
    fetch('data/appliance-gift-options.json', {cache:'no-store'})
      .then(r => r.ok ? r.json() : null)
      .catch(() => null),
    fetch('data/catalog-overrides.json', {cache:'no-store'})
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  ])
    .then(([data, giftData, overrideData]) => {
      applyPolicyMonth(giftData?.generatedAt || data?.updatedAt || '');
      const target = (data.products || []).find(p => p.id === id);
      const catalogOverride = overrideData?.products?.[id];
      if (target && catalogOverride) Object.assign(target, catalogOverride);
      const override = giftData?.products?.[id];
      if (target && override && target.sourceKind === 'clover-import') Object.assign(target, override);
      initialize(data);
    })
    .catch(() => {
      $('#generic-title').textContent = '상품 정보를 불러오지 못했습니다.';
      $('#generic-model').textContent = '최신 조건은 상담으로 확인해 주세요.';
      managementBox.innerHTML = '';
      termBox.innerHTML = '';
    });
})();