import {renderHandwriting} from '../consent-web/handwriting.js';
import { read, utils } from 'xlsx';
import {
  classifyImportRows, dedupeImportRows, detectImportTables, formatInstallment, formatPhone,
  rowsToObjects, selectSalesFilesByRange
} from './import-utils.js';
import { connectOneDrive, disconnectOneDrive, discoverOneDriveSalesFiles, downloadOneDriveFiles, getOneDriveStatus, getStoredOneDriveClientId, setStoredOneDriveClientId } from './onedrive.js';

const $ = id => document.getElementById(id);
let importRows = [];
let reviewRows = [];
let selectedImportFiles = [];
let importSelectionNote = '';
let selectedCustomerId = null;
let intakeCursor=null;let intakeLoading=false;
let consentPolicy=null;
let consentLinkTimer;

for (const button of document.querySelectorAll('.tabs button')) button.addEventListener('click', () => openTab(button.dataset.tab));
$('refresh').addEventListener('click', boot);
$('reload-intakes').addEventListener('click',()=>loadIntakes());
$('more-intakes').addEventListener('click',()=>loadIntakes(true));
$('search-customers').addEventListener('click', loadCustomers);
$('filter-query').addEventListener('keydown', event => { if (event.key === 'Enter') loadCustomers(); });
$('read-file').addEventListener('click', () => readExcel('files'));
$('read-folder').addEventListener('click', () => readExcel('folder'));
$('od-save-client').addEventListener('click', saveOneDriveClientId);
$('od-connect').addEventListener('click', connectOneDriveUi);
$('od-import').addEventListener('click', readOneDrive);
$('od-disconnect').addEventListener('click', disconnectOneDriveUi);
$('run-import').addEventListener('click', runImport);
$('preview-campaign').addEventListener('click', previewCampaign);
$('save-consent').addEventListener('click', saveConsent);
$('issue-consent').addEventListener('click', issueConsentLink);
$('withdraw-consent').addEventListener('click', withdrawCustomerConsent);
$('copy-consent-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('consent-link').value);}catch{showError(new Error('링크를 선택하여 직접 복사해 주세요.'));}});
$('customer-dialog').addEventListener('close',clearConsentLink);
$('send-campaign').addEventListener('click', () => alert('실발송은 아직 잠겨 있습니다. 문자업체 계정과 발신번호 등록 후 활성화합니다.'));

async function api(path, options={}) {
  const response = await fetch(path, { ...options, headers:{'content-type':'application/json', ...(options.headers||{})} });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
  return data;
}

async function boot() {
  try {
    await refreshOneDriveStatus();
    const [health, dash] = await Promise.all([api('/api/health'), api('/api/dashboard')]);
    $('security').textContent = health.sms_mode === 'enabled'
      ? 'Cloudflare Access 인증 · D1 + AES-GCM 암호화 저장 · 원본파일 미보관 · 문자 실발송 활성 상태'
      : 'Cloudflare Access 인증 · D1 + AES-GCM 암호화 저장 · 원본파일 미보관 · 문자 실발송은 안전을 위해 잠금 상태';
    $('security').classList.toggle('warn', health.sms_mode !== 'enabled');
    $('stat-total').textContent = dash.total.toLocaleString('ko-KR');
    $('stat-due').textContent = dash.maturity_22_30.toLocaleString('ko-KR');
    $('stat-consent').textContent = dash.consent_granted.toLocaleString('ko-KR');
    $('stat-blocked').textContent = (dash.consent_revoked + dash.consent_unknown).toLocaleString('ko-KR');
    await loadCustomers();
  } catch (error) { showError(error); }
}

function openTab(tab) {
  if(tab==='intakes')loadIntakes();
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id===`panel-${tab}`));
}

async function loadCustomers() {
  const params = new URLSearchParams({ limit:'150' });
  const query = $('filter-query').value.trim();
  if (query) params.set('q', query);
  if ($('filter-carrier').value) params.set('carrier',$('filter-carrier').value);
  if ($('filter-service-type').value) params.set('service_type',$('filter-service-type').value);
  if ($('filter-consent').value) params.set('consent',$('filter-consent').value);
  if ($('filter-installment').value) params.set('installment_months',$('filter-installment').value);
  if ($('filter-due').checked) { params.set('months_min','22'); params.set('months_max','30'); }
  $('customer-body').innerHTML = '<tr><td colspan="11" class="muted">불러오는 중...</td></tr>';
  try {
    const data = await api(`/api/customers?${params}`);
    $('search-result-note').textContent = query ? `“${query}” 검색 결과 ${data.customers.length}건` : '';
    if (!data.customers.length) { $('customer-body').innerHTML='<tr><td colspan="11" class="muted">조건에 맞는 고객이 없습니다.</td></tr>'; return; }
    $('customer-body').innerHTML = data.customers.map(c => `<tr>
      <td>${esc(c.opened_on||'-')}</td><td>${esc(c.name)}</td><td>${esc(c.phone_masked)}</td><td>${esc(c.birth_date||'-')}</td>
      <td>${c.service_type === 'sim' ? '유심' : c.service_type === 'wireless' ? '휴대폰' : '미확인'}</td><td>${esc(c.carrier||'-')}</td><td>${esc(c.device_model||'-')}</td><td>${esc(c.rate_plan||'-')}</td><td>${esc(formatInstallment(c.installment_months))}</td>
      <td><span class="badge ${c.ad_sms_status}">${consentLabel(c.ad_sms_status)}</span></td>
      <td><button data-detail="${c.id}">상세</button></td></tr>`).join('');
    bindDetailButtons();
  } catch (error) { showError(error); }
}

function bindDetailButtons() {
  document.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => showCustomer(b.dataset.detail)));
}

async function showCustomer(id) {
  try {
    const {customer:c} = await api(`/api/customers/${id}`);
    clearConsentLink();
    selectedCustomerId = id;
    $('consent-adult').checked=false;
    await loadConsentManagement(id);
    $('detail-name').textContent = c.name;
    $('detail-list').innerHTML = `<dt>개통일</dt><dd>${esc(c.opened_on||'-')}</dd><dt>연락처</dt><dd>${esc(formatPhone(c.phone))}</dd><dt>생년월일</dt><dd>${esc(c.birth_date||'-')}</dd><dt>개통구분</dt><dd>${c.service_type === 'sim' ? '유심' : c.service_type === 'wireless' ? '휴대폰' : '미확인'}</dd><dt>통신사</dt><dd>${esc(c.carrier||'-')}</dd><dt>단말기</dt><dd>${esc(c.device_model||'-')}</dd><dt>요금제</dt><dd>${esc(c.rate_plan||'-')}</dd><dt>할부개월</dt><dd>${esc(formatInstallment(c.installment_months))}</dd><dt>개통 후 경과</dt><dd>${c.months_since_open==null?'-':`${c.months_since_open}개월`}</dd><dt>문자동의</dt><dd>${consentLabel(c.ad_sms_status)}</dd>`;
    renderRelatedLines(c.related_lines || []);
    renderContractHistory(c.contracts || []);
    const now = new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset()); $('consent-at').value = now.toISOString().slice(0,16);
    $('customer-dialog').showModal();
  } catch (error) { showError(error); }
}

function renderRelatedLines(lines) {
  const wrap = $('related-lines-wrap');
  if (!lines.length) {
    wrap.classList.add('hidden');
    $('related-lines').innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  $('related-lines-count').textContent = `${lines.length}개`;
  $('related-lines').innerHTML = lines.map(line => `<article class="related-line">
    <div><b>${esc(formatPhone(line.phone))}</b><span>${esc(line.carrier||'-')}</span></div>
    <p>${esc(line.opened_on||'-')} · ${line.service_type === 'sim' ? '유심' : line.service_type === 'wireless' ? '휴대폰' : '미확인'} · ${esc(line.device_model||'-')} · ${esc(line.rate_plan||'-')} · ${esc(formatInstallment(line.installment_months))}</p>
    <button type="button" data-detail="${line.id}">이 회선 보기</button>
  </article>`).join('');
  bindDetailButtons();
}

function renderContractHistory(contracts) {
  const wrap = $('contract-history-wrap');
  if (!contracts.length) {
    wrap.classList.add('hidden');
    $('contract-history').innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  $('contract-history-count').textContent = `${contracts.length}건`;
  $('contract-history').innerHTML = contracts.map(contract => `<article class="contract-history-item">
    <div><b>${esc(contract.opened_on || '-')}</b><span>${contract.service_type === 'sim' ? '유심' : '무선'} · ${esc(contract.carrier || '-')}</span></div>
    <p>${esc(contract.device_model || '-')} · ${esc(contract.rate_plan || '-')} · ${esc(formatInstallment(contract.installment_months))}${contract.current_snapshot ? ' · 기존 현재정보' : ''}</p>
  </article>`).join('');
}

async function refreshOneDriveStatus() {
  const clientId = getStoredOneDriveClientId();
  if ($('od-client-id') && !$('od-client-id').value) $('od-client-id').value = clientId;
  const status = await getOneDriveStatus();
  const label = $('od-status');
  if (!status.configured) {
    label.textContent = '설정 필요';
    label.className = 'connection-state pending';
    return;
  }
  if (status.connected) {
    label.textContent = `연결됨 · ${status.account || 'Microsoft 계정'}`;
    label.className = 'connection-state connected';
  } else {
    label.textContent = 'Client ID 저장됨 · 계정 연결 필요';
    label.className = 'connection-state pending';
  }
}

async function saveOneDriveClientId() {
  try {
    setStoredOneDriveClientId($('od-client-id').value);
    await refreshOneDriveStatus();
    alert('Microsoft Client ID를 이 브라우저에 저장했습니다. Client ID는 비밀키가 아닙니다.');
  } catch (error) { showError(error); }
}

async function connectOneDriveUi() {
  try {
    const typed = $('od-client-id').value.trim();
    if (typed && typed !== getStoredOneDriveClientId()) setStoredOneDriveClientId(typed);
    $('od-status').textContent = 'Microsoft 로그인 중...';
    await connectOneDrive();
    await refreshOneDriveStatus();
  } catch (error) { showError(error); await refreshOneDriveStatus(); }
}

async function disconnectOneDriveUi() {
  try {
    await disconnectOneDrive();
    await refreshOneDriveStatus();
  } catch (error) { showError(error); }
}

async function readOneDrive() {
  try {
    if (!getStoredOneDriveClientId()) {
      $('onedrive-setup').open = true;
      throw new Error('Microsoft Client ID를 먼저 저장한 뒤 OneDrive를 연결해 주세요.');
    }
    $('import-progress').classList.remove('hidden');
    const progress = message => { $('import-progress').textContent = message; };
    const allFiles = await discoverOneDriveSalesFiles(progress);
    const selection = selectSalesFilesByRange(allFiles, $('od-start').value, $('od-end').value);
    if (!selection.files.length) throw new Error('선택한 기간의 OneDrive 판매일보를 찾지 못했습니다.');
    const missing = selection.missingMonths.length
      ? `<br><b>⚠ 누락 월:</b> ${esc(selection.missingMonths.join(', '))}`
      : '<br><b>월별 파일:</b> 기간 내 모든 월 확인';
    const note = `<br><b>OneDrive 직접 연결:</b> ${esc(selection.start)} ~ ${esc(selection.end)} · 대상 <b>${selection.files.length}개 파일</b> / 예상 ${selection.expectedCount}개월 · 중복 사본 ${selection.duplicates.length}개 제외 · 범위 밖 ${selection.outOfRange.length}개 제외 · 기타 파일 ${selection.unmatched.length}개 제외${missing}`;
    const files = await downloadOneDriveFiles(selection.files, progress);
    await analyzeSelectedFiles(files, note);
  } catch (error) {
    showError(error);
  }
}

async function saveConsent() {
  if (!selectedCustomerId) return;
  const status = $('consent-status').value;
  const evidence = $('consent-evidence').value.trim();
  if (status==='granted' && !evidence) { alert('동의로 기록하려면 증빙 내용을 적어주세요.'); return; }
  try {
    await api(`/api/customers/${selectedCustomerId}/consent`, { method:'POST', body:JSON.stringify({
      status, method:$('consent-method').value, captured_at:$('consent-at').value, evidence
    })});
    $('customer-dialog').close(); $('consent-evidence').value=''; await boot();
  } catch (error) { showError(error); }
}

function nextPaint() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function readExcel(mode='files') {
  let files = [];
  importSelectionNote = '';

  if (mode === 'folder') {
    const rawFiles = [...$('excel-folder').files];
    if (!rawFiles.length) { alert('PC의 OneDrive 동기화 폴더에서 “웅비통신 판매일보” 폴더를 선택해 주세요.'); return; }
    try {
      const selection = selectSalesFilesByRange(rawFiles, $('folder-start').value, $('folder-end').value);
      files = selection.files;
      if (!files.length) { alert('선택한 기간에 해당하는 판매일보 파일을 찾지 못했습니다.'); return; }
      const missing = selection.missingMonths.length
        ? `<br><b>⚠ 누락 월:</b> ${esc(selection.missingMonths.join(', '))}`
        : '<br><b>월별 파일:</b> 기간 내 모든 월 확인';
      importSelectionNote = `<br><b>폴더 범위:</b> ${esc(selection.start)} ~ ${esc(selection.end)} · 대상 <b>${files.length}개 파일</b> / 예상 ${selection.expectedCount}개월 · 중복 사본 ${selection.duplicates.length}개 제외 · 범위 밖 ${selection.outOfRange.length}개 제외 · 기타 파일 ${selection.unmatched.length}개 제외${missing}`;
    } catch (error) {
      showError(error);
      return;
    }
  } else {
    files = [...$('excel-file').files];
    if (!files.length) { alert('Excel(.xls/.xlsx) 또는 CSV 파일을 선택해 주세요.'); return; }
    importSelectionNote = `<br><b>직접 선택:</b> ${files.length}개 파일`;
  }

  return analyzeSelectedFiles(files, importSelectionNote);
}

async function analyzeSelectedFiles(files, selectionNote='') {
  selectedImportFiles = files;
  importSelectionNote = selectionNote;
try {
    importRows = [];
    reviewRows = [];
    const summaries = [];
    const fileErrors = [];
    let totalIgnored = 0;
    let totalDuplicates = 0;

    $('import-progress').classList.remove('hidden');
    $('import-progress').textContent = `분석 준비 중 · ${files.length}개 파일`;
    $('run-import').classList.add('hidden');
    await nextPaint();

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      $('import-progress').textContent = `판매일보 분석 중 ${index + 1}/${files.length} · ${file.name}`;
      await nextPaint();
      try {
        const result = await analyzeFile(file);
        importRows.push(...result.valid);
        reviewRows.push(...result.review);
        totalIgnored += result.ignored;
        summaries.push(`${file.name}: ${result.valid.length}건 / 확인 ${result.review.length}건 · ${result.sheetSummaries.join(' / ')}`);
      } catch (error) {
        fileErrors.push(`${file.name}: ${error.message}`);
        summaries.push(`${file.name}: 파일 분석 실패`);
      }
    }

    const deduped = dedupeImportRows(importRows);
    importRows = deduped.rows;
    reviewRows.push(...deduped.conflicts);
    totalDuplicates += deduped.duplicates;

    $('import-progress').textContent = `D1 기존 고객·계약 이력과 비교 중 · ${importRows.length.toLocaleString('ko-KR')}개 계약`;
    await nextPaint();
    const serverPreview = importRows.length ? await previewImportRows(importRows) : {new_customer_count:0,new_contract_count:0,existing_contract_count:0,plan_backfill_count:0,plan_conflict_count:0,conflicts:0};
    const serverReview = new Map((serverPreview.review_rows || []).map(item => [item.input_index, item.reason]));
    importRows = importRows.filter((row, index) => {
      if (!serverReview.has(index)) return true;
      reviewRows.push({ ...row, _reasons: [serverReview.get(index)] });
      return false;
    });
    const totalReview = reviewRows.length;
    const errorNote = fileErrors.length
      ? `<br><b>⚠ 파일 분석 실패 ${fileErrors.length}개</b><details><summary>실패 파일 보기</summary>${fileErrors.map(esc).join('<br>')}</details>`
      : '';

    $('import-summary').classList.remove('hidden');
    $('import-summary').innerHTML = `<b>자동 분석 완료</b><br>신규 고객 <b>${Number(serverPreview.new_customer_count || 0).toLocaleString('ko-KR')}명</b> · 기존 고객 새 계약 <b>${Number(serverPreview.new_contract_count || 0).toLocaleString('ko-KR')}건</b> · 이미 등록된 계약 <b>${Number(serverPreview.existing_contract_count || 0).toLocaleString('ko-KR')}건</b> · 요금제 보충 예정 <b>${Number(serverPreview.plan_backfill_count || 0).toLocaleString('ko-KR')}건</b> · 요금제 불일치 <b>${Number(serverPreview.plan_conflict_count || 0).toLocaleString('ko-KR')}건</b> · 확인 필요 <b>${totalReview.toLocaleString('ko-KR')}건</b><br>동일 계약 중복 정리 <b>${totalDuplicates.toLocaleString('ko-KR')}건</b> · 빈칸/합계 제외 <b>${totalIgnored.toLocaleString('ko-KR')}행</b>${importSelectionNote}${errorNote}<details><summary>파일별 분석 보기</summary>${summaries.map(esc).join('<br>')}</details>`;

    $('import-progress').textContent = `분석 완료 · ${files.length}개 파일 · 등록 후보 ${importRows.length.toLocaleString('ko-KR')}개 계약`;
    renderImportPreview();
    $('preview-wrap').classList.toggle('hidden', !importRows.length);
    $('review-wrap').classList.toggle('hidden', !reviewRows.length);
    $('run-import').classList.toggle('hidden', !importRows.length);
  } catch (error) {
    resetImportUi();
    showError(new Error(`파일을 읽지 못했습니다: ${error.message}`));
  }
}

async function previewImportRows(rows) {
  if (rows.length > 5000) throw new Error('미리보기는 한 번에 최대 5,000개 계약까지 확인할 수 있습니다.');
  const cleanRows = rows.map(({_file_name,_reasons,_source_row,_sheet_name,...row}) => row);
  return api('/api/import/preview', { method:'POST', body:JSON.stringify({rows:cleanRows}) });
}

async function analyzeFile(file) {
  const lower = file.name.toLowerCase();
  let sheets;
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = read(await file.arrayBuffer(), { type:'array', cellDates:true });
    sheets = workbook.SheetNames.map(name => ({
      name,
      rows: utils.sheet_to_json(workbook.Sheets[name], { header:1, raw:true, defval:'' })
    }));
  } else if (lower.endsWith('.csv')) {
    sheets = [{ name:'CSV', rows:parseCsv(await file.text()) }];
  } else {
    throw new Error(`${file.name}: 지원 형식은 .xls, .xlsx 또는 .csv 입니다.`);
  }

  const detectedTables = detectImportTables(sheets);
  const combined = { valid:[], review:[], ignored:0, sheetSummaries:[] };
  for (const detected of detectedTables) {
    const objects = rowsToObjects(detected.rows, detected.headerIndex);
    const classified = classifyImportRows(objects, file.name);
    const sheetLabel = detected.sheetType === 'sim' ? '유심' : '무선';
    combined.valid.push(...classified.valid.map(row => ({
      ...row, service_type:detected.sheetType, _sheet_name:detected.sheetName
    })));
    combined.review.push(...classified.review.map(row => ({
      ...row, service_type:detected.sheetType, _sheet_name:detected.sheetName
    })));
    combined.ignored += classified.ignored;
    combined.sheetSummaries.push(`${detected.sheetName}(${sheetLabel}) ${classified.valid.length}건`);
  }
  return combined;
}

function renderImportPreview() {
  $('preview-body').innerHTML = importRows.slice(0,12).map(r => `<tr>
    <td>${esc(r.opened_on||'-')}</td><td>${esc(r.name)}</td><td>${esc(formatPhone(r.phone))}</td><td>${esc(r.birth_date||'-')}</td>
    <td>${r.service_type === 'sim' ? '유심' : '휴대폰'}</td><td>${esc(r.carrier||'-')}</td><td>${esc(r.device_model||'-')}</td><td>${esc(r.rate_plan||'-')}</td><td>${esc(formatInstallment(r.installment_months))}</td></tr>`).join('');

  $('review-body').innerHTML = reviewRows.slice(0,30).map(r => `<tr>
    <td>${esc(r._file_name||'-')}${r._sheet_name ? ` · ${esc(r._sheet_name)}` : ''}</td><td>${esc(String(r._source_row||'-'))}</td><td>${esc(r.name||'-')}</td><td>${esc(formatPhone(r.phone)||'-')}</td>
    <td>${esc((r._reasons||[]).join(', '))}</td></tr>`).join('');
}

function parseCsv(text) {
  const rows=[]; let row=[], cell='', quoted=false;
  const input=String(text||'').replace(/^\uFEFF/, '');
  for (let i=0;i<input.length;i++) {
    const ch=input[i];
    if (quoted) {
      if (ch==='"' && input[i+1]==='"') { cell+='"'; i++; }
      else if (ch==='"') quoted=false;
      else cell+=ch;
    } else if (ch==='"') quoted=true;
    else if (ch===',') { row.push(cell); cell=''; }
    else if (ch==='\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row=[]; cell=''; }
    else cell+=ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

async function runImport() {
  const files = selectedImportFiles;
  if (!files.length || !importRows.length) return;
  const reviewText = reviewRows.length ? `\n확인 필요 ${reviewRows.length}건은 자동 등록에서 제외됩니다.` : '';
  if (!confirm(`${importRows.length.toLocaleString('ko-KR')}개 계약 후보를 암호화 DB로 가져올까요? 같은 전화번호의 과거 계약은 계약 이력으로 보존하고, 고객 목록에는 가장 최근 개통정보를 표시합니다. 다른 전화번호는 별도 회선으로 유지합니다. 원본 파일은 서버에 저장하지 않습니다.${reviewText}`)) return;

  $('run-import').disabled=true; $('run-import').textContent='가져오는 중...';
  $('import-progress').classList.remove('hidden');
  try {
    const sourceLabel = files.length === 1 ? files[0].name : `판매일보 ${files.length}개 파일`;
    let total={newCustomers:0,newContracts:0,existingContracts:0,planBackfilled:0,planConflicts:0,skipped:0,conflicts:0};
    for (let i=0;i<importRows.length;i+=500) {
      $('import-progress').textContent = `암호화 DB 저장 중 · ${Math.min(i + 500, importRows.length).toLocaleString('ko-KR')}/${importRows.length.toLocaleString('ko-KR')} 계약`;
      await nextPaint();
      const cleanRows = importRows.slice(i,i+500).map(({_file_name,_reasons,_source_row,_sheet_name,...row}) => row);
      const result=await api('/api/import',{method:'POST',body:JSON.stringify({filename:sourceLabel,rows:cleanRows})});
      total.newCustomers += Number(result.new_customer_count ?? result.inserted ?? 0);
      total.newContracts += Number(result.new_contract_count ?? result.updated ?? 0);
      total.existingContracts += Number(result.existing_contract_count ?? 0);
      total.planBackfilled += Number(result.plan_backfill_count ?? 0);
      total.planConflicts += Number(result.plan_conflict_count ?? 0);
      total.skipped += Number(result.skipped || 0);
      total.conflicts += Number(result.conflicts || 0);
    }
    $('import-progress').textContent = `등록 완료 · 신규 고객 ${total.newCustomers} · 새 계약 ${total.newContracts}`;
    alert(`완료\n신규 고객 ${total.newCustomers}명 · 기존 고객 새 계약 ${total.newContracts}건 · 이미 등록된 계약 ${total.existingContracts}건 · 요금제 보충 ${total.planBackfilled}건${total.planConflicts?` · 요금제 불일치 ${total.planConflicts}건(자동 덮어쓰기 안 함)`:''} · 제외 ${total.skipped}행${total.conflicts?` · 충돌 ${total.conflicts}건`:''}`);
    resetImportUi();
    await boot(); openTab('customers');
  } catch(error){showError(error)} finally {$('run-import').disabled=false;$('run-import').textContent='암호화 DB에 가져오기'}
}

function resetImportUi() {
  importRows=[]; reviewRows=[]; selectedImportFiles=[]; importSelectionNote='';
  $('excel-file').value=''; $('excel-folder').value='';
  $('import-progress').classList.add('hidden'); $('import-progress').textContent='';
  $('import-summary').classList.add('hidden'); $('preview-wrap').classList.add('hidden'); $('review-wrap').classList.add('hidden'); $('run-import').classList.add('hidden');
  $('preview-body').innerHTML=''; $('review-body').innerHTML='';
}

async function previewCampaign() {
  try {
    const data=await api('/api/campaigns/preview',{method:'POST',body:JSON.stringify({months_min:$('camp-min').value,months_max:$('camp-max').value,carrier:$('camp-carrier').value})});
    $('campaign-result').classList.remove('hidden');
    $('campaign-result').innerHTML=`전체 후보 <b>${data.total_candidates.toLocaleString('ko-KR')}명</b> · 수신동의 확인 <b>${data.eligible.toLocaleString('ko-KR')}명</b> · 미확인/거부 자동 제외 <b>${data.blocked_or_unknown.toLocaleString('ko-KR')}명</b><br>실발송 상태: <b>${data.sms_mode==='enabled'?'활성':'잠금'}</b>`;
  } catch(error){showError(error)}
}

function consentLabel(v){return v==='granted'?'동의':v==='revoked'?'수신거부':'미확인'}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showError(error){console.error(error);alert(error.message||'오류가 발생했습니다.')}

boot();

function clearConsentLink(){
  clearTimeout(consentLinkTimer);$('consent-link').value='';$('consent-link-wrap').hidden=true;
}
async function loadConsentManagement(id){
  const [policy,history]=await Promise.all([api('/api/consent-policy'),api('/api/customers/'+id+'/consent-history')]);
  consentPolicy=policy.policy;
  $('consent-policy-state').textContent=consentPolicy.approved?'고객 직접 선택 · 모든 항목 선택 사항':'준비 중 — 최종 문구와 파기 절차 확인 후 사용 가능합니다.';
  $('issue-consent').disabled=!consentPolicy.approved;
  const labels={purpose:'수집·이용 목적',items:'수집 항목',retention:'보유·이용기간',refusal:'거부권',withdrawal:'철회 방법',advertising:'광고 안내'};
  $('consent-policy-preview').innerHTML='<dl>'+Object.entries(labels).map(([k,label])=>'<dt>'+label+'</dt><dd>'+esc(consentPolicy[k])+'</dd>').join('')+'</dl><p>문자(SMS/MMS) · 카카오톡 · 전화는 각각 별도 선택합니다.</p><p>확인할 항목: '+esc(consentPolicy.pending.join(' / ')||'없음')+'</p>';
  const label={marketing_use:'개인정보 이용',ad_sms:'문자',ad_kakao:'카카오톡',ad_call:'전화'};
  const state={consented:'동의',denied:'미동의',withdrawn:'철회'};
  $('consent-events').innerHTML=history.events.length?history.events.map(e=>'<article><b>'+esc(new Date(e.captured_at).toLocaleString('ko-KR'))+'</b><p>'+Object.entries(e.choices).map(([k,v])=>esc(label[k]+': '+state[v])).join(' · ')+'</p><small>'+esc((e.version||'철회 기록')+' · '+(e.capture_method==='customer_link'?'고객 직접 선택':'매장 철회 접수'))+'</small>'+consentEvidence(e)+'</article>').join(''):'새 동의 이력이 없습니다. 기존 미확인 고객은 자동 동의 처리하지 않습니다.';
}
async function issueConsentLink(){
  if(!selectedCustomerId||!$('consent-adult').checked){showError(new Error('성인 고객 본인의 직접 선택 여부를 확인해 주세요.'));return;}
  const id=selectedCustomerId;$('issue-consent').disabled=true;clearConsentLink();
  try{
    const r=await api('/api/customers/'+id+'/consent-session',{method:'POST',body:JSON.stringify({adult_confirmed:true})});
    if(id!==selectedCustomerId||!$('customer-dialog').open)return;
    $('consent-link').value=r.url;$('consent-link-wrap').hidden=false;
    $('consent-link-expiry').textContent=new Date(r.expires_at).toLocaleTimeString('ko-KR')+'까지 1회 사용 가능 · 재발급하면 이전 링크는 취소됩니다.';
    consentLinkTimer=setTimeout(clearConsentLink,Math.max(0,Date.parse(r.expires_at)-Date.now()));
  }catch(e){showError(e);}finally{$('issue-consent').disabled=!consentPolicy?.approved;}
}
async function withdrawCustomerConsent(){
  if(!selectedCustomerId||!confirm('고객의 철회 요청을 확인했나요? 개인정보 마케팅 이용과 문자·카카오톡·전화 동의를 모두 철회하고, 발급된 링크를 취소합니다.'))return;
  try{
    await api('/api/customers/'+selectedCustomerId+'/consent-withdraw',{method:'POST',body:JSON.stringify({confirmed:true})});
    clearConsentLink();await loadConsentManagement(selectedCustomerId);await loadCustomers();
    alert('전체 동의 철회를 기록했습니다. 마케팅 대상에서 제외됩니다.');
  }catch(e){showError(e);}
}

function consentEvidence(event){
  if(!event.form)return '';
  const f=event.form;
  const reminder=event.first_confirmation_due?'<p>최초 수신동의 확인 안내 기준일: '+esc(event.first_confirmation_due.slice(0,10))+' (동의 자동 만료일이 아닙니다)</p>':'';
  return reminder+'<details><summary>당시 동의 문구 보기</summary><p>'+[f.purpose,f.items,f.retention,f.refusal,f.withdrawal,f.advertising].map(esc).join('</p><p>')+'</p><small>문구 확인값 '+esc(event.form_hash)+'</small></details>';
}
async function loadIntakes(more=false){
 if(intakeLoading)return;intakeLoading=true;$('reload-intakes').disabled=true;$('more-intakes').disabled=true;
 try{
  const data=await api('/api/consent-intakes'+(more&&intakeCursor?'?before='+encodeURIComponent(intakeCursor):''));
  $('intake-readiness').textContent=data.collection_enabled?'신규 접수 가능':data.collection_message+' 기존 접수의 확인·철회는 계속 이용할 수 있습니다.';
  intakeCursor=data.next_cursor;$('more-intakes').hidden=!intakeCursor;
  if(!more)$('intake-list').replaceChildren();
  for(const item of data.items){
   const card=document.createElement('article');card.className='intake-card';
   const match={exact:'이름·번호가 일치하는 기존 고객',different_name:'기존 번호와 이름 불일치 — 확인 필요',phone_only:'번호 일치 — 손글씨 이름을 확인해 주세요',new:'신규 접수'};
   const channels=Object.entries(item.effective_choices||item.choices).filter(([k,v])=>k.startsWith('ad_')&&v).map(([k])=>({ad_sms:'문자',ad_kakao:'카카오톡',ad_call:'전화'})[k]);
   card.innerHTML='<h3>'+esc(item.name||'손글씨 이름 확인')+' · '+esc(formatPhone(item.phone))+'</h3><p>'+esc(match[item.match])+' · <b>'+(item.status==='confirmed'?'직원 확인 완료':'확인 대기')+'</b></p><p>선택 내역: '+esc(Object.hasOwn(item.choices,'customer_care')?('상담 관리 '+(item.choices.customer_care?'동의':'미동의')+' / 마케팅 이용 '+(item.choices.marketing_use?'동의':'미동의')):'고객관리·마케팅 이용 동의(이전 문구)')+' · 현재 광고 채널: '+esc(channels.join(', ')||'선택 없음')+'</p><p>접수 '+esc(new Date(item.captured_at).toLocaleString('ko-KR'))+' · 보유기한 '+esc(item.expires_at.slice(0,10))+'</p><details><summary>당시 동의 문구</summary><p>'+[item.form.purpose,item.form.items,item.form.retention,item.form.refusal,item.form.withdrawal,item.form.advertising,item.form.channel_notice,item.form.linkage_notice,item.form.record_notice].map(esc).join('</p><p>')+'</p><small>'+esc(item.form.version)+'</small></details>';
   const actions=document.createElement('div');actions.className='intake-actions';
   const handwritingReview=item.has_handwriting?addHandwritingReview(card,item):null;
   if(item.status==='pending'){
    const button=document.createElement('button');button.type='button';button.textContent='본인 접수 확인';
    button.disabled=item.match==='different_name';
    button.addEventListener('click',()=>actOnIntake(item.id,'review',handwritingReview?handwritingReview.value():{}));actions.append(button);
   }
   if(item.customer_id){const b=document.createElement('button');b.type='button';b.textContent='연결된 고객 보기';b.addEventListener('click',()=>showCustomer(item.customer_id));actions.append(b);}
   for(const [mode,label] of [['withdraw','고객 요청으로 전체 철회'],['delete','잘못된 접수 삭제']]){
    const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent=label;b.addEventListener('click',()=>actOnIntake(item.id,mode));actions.append(b);
   }
   card.append(actions);addIntakeComplianceControls(card,item);$('intake-list').append(card);
  }
  $('intake-result').textContent=$('intake-list').children.length?$('intake-list').children.length+'건 표시':'접수 내역이 없습니다.';
 }catch(e){$('intake-result').textContent=e.message;}
 finally{intakeLoading=false;$('reload-intakes').disabled=false;$('more-intakes').disabled=false;}
}
async function actOnIntake(id,mode,extra={}){
 const messages={review:'고객 본인이 직접 작성한 접수임을 확인했나요? 기존 고객정보나 문자 수신동의 상태는 자동 변경하지 않습니다.',withdraw:'고객 본인의 전체 철회 요청을 확인했나요? 처리 후 매장명·철회일·처리 결과를 고객에게 안내해 주세요. 같은 전화번호의 접수 정보를 삭제하고, 기존 고객의 개인정보 마케팅 이용과 광고 수신동의를 모두 철회합니다.',channel:'고객 본인의 해당 채널 수신동의 철회 요청을 확인했나요? 같은 번호의 기존 접수에 반영합니다. 다른 채널은 유지하고 새 동의를 부여하지 않습니다.',notice:'매장명, 동의·철회 사실과 날짜, 처리 결과(정기 안내는 유지·철회 방법)를 실제로 고객에게 안내했나요? 이 버튼은 문자나 카카오톡을 발송하지 않으며, 지금 안내를 완료했다는 기록만 남깁니다.',delete:'이 잘못된 접수 1건을 삭제할까요? 되돌릴 수 없으며, 기존 고객의 동의 상태는 바꾸지 않습니다.'};
 if(!confirm(messages[mode]))return;
 try{const result=await api('/api/consent-intakes/'+id+'/'+(['review','channel','notice'].includes(mode)?mode:'remove'),{method:'POST',body:JSON.stringify({confirmed:true,...extra,withdraw:mode==='withdraw',notice_confirmed:mode==='withdraw'})});await loadIntakes();if(result.notice)alert(result.notice);}catch(e){showError(e);}
}

function addHandwritingReview(card,item){
 const details=document.createElement('details'),title=document.createElement('summary');title.textContent='손글씨 이름·서명 확인';details.append(title);
 const content=document.createElement('div');details.append(content);card.append(details);
 const label=document.createElement('label');label.textContent='손글씨를 읽고 이름 입력';
 const input=document.createElement('input');input.type='text';input.maxLength=40;input.autocomplete='off';input.value=item.name||'';input.disabled=item.status==='confirmed';label.append(input);
 const checkedLabel=document.createElement('label'),checked=document.createElement('input');checked.type='checkbox';checked.disabled=true;checkedLabel.append(checked,document.createTextNode('손글씨 이름과 서명을 확인했습니다.'));
 if(item.status==='pending')card.append(label,checkedLabel);
 let loaded=false,loading=false;
 details.addEventListener('toggle',async()=>{
  if(!details.open||loaded||loading)return;loading=true;content.textContent='불러오는 중…';
  try{
   const data=await api('/api/consent-intakes/'+item.id+'/handwriting');content.replaceChildren();
   for(const [key,text] of [['handwriting_name','고객 손글씨 이름'],['signature','고객 손글씨 서명']]){
    const caption=document.createElement('p');caption.textContent=text;const canvas=document.createElement('canvas');canvas.width=760;canvas.height=280;canvas.className='intake-handwriting';canvas.setAttribute('aria-label',text);
    content.append(caption,canvas);renderHandwriting(canvas,data[key]||[]);
   }
   loaded=true;checked.disabled=false;
  }catch(e){content.textContent=e.message;}
  finally{loading=false;}
 });
 return {value:()=>({name:input.value,handwriting_checked:loaded&&checked.checked})};
}

function addIntakeComplianceControls(card,item){
 const channels={ad_sms:'문자',ad_kakao:'카카오톡',ad_call:'전화'};
 const group=document.createElement('div');group.className='intake-actions';
 for(const [key,label] of Object.entries(channels)){
  if(!(item.effective_choices||item.choices)[key])continue;
  const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent=label+'만 수신동의 철회';
  b.addEventListener('click',()=>actOnIntake(item.id,'channel',{channel:key}));group.append(b);
 }
 card.append(group);
 for(const task of item.notice_tasks||[]){
  const row=document.createElement('div');row.className='intake-notice-task';
  const p=document.createElement('p');p.textContent=task.label+' · 안내 기한 '+new Date(task.due).toLocaleDateString('ko-KR')+(Date.parse(task.due)<Date.now()?' · 기한 경과':'');
  const select=document.createElement('select');select.setAttribute('aria-label',task.label+' 실제 안내 방법');
  for(const [value,label] of [['','안내 방법 선택'],['in_person','매장에서 직접 안내'],['paper','서면 교부'],['sms','문자 안내'],['kakao','카카오톡 안내'],['phone','전화 안내']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  const button=document.createElement('button');button.type='button';button.textContent='실제 안내 완료 기록';
  button.disabled=task.target==='periodic'&&Date.now()<Date.parse(task.due)-30*86400000;
  button.addEventListener('click',()=>{if(!select.value){showError(new Error('실제로 안내한 방법을 선택해 주세요.'));return;}actOnIntake(item.id,'notice',{target:task.target,method:select.value});});
  row.append(p,select,button);card.append(row);
 }
 if(item.actions?.length){
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='철회·안내 처리 기록';details.append(summary);
  for(const a of item.actions){const p=document.createElement('p');p.textContent=new Date(a.created_at).toLocaleString('ko-KR')+' · '+(a.kind==='channel_withdrawal'?(channels[a.target]+' 수신동의 철회'):'고객 안내 완료 · '+({in_person:'매장',paper:'서면',sms:'문자',kakao:'카카오톡',phone:'전화'}[a.method]||a.method));details.append(p);}
  card.append(details);
 }
}
