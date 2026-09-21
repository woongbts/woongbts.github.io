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

for (const button of document.querySelectorAll('.tabs button')) button.addEventListener('click', () => openTab(button.dataset.tab));
$('refresh').addEventListener('click', boot);
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
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id===`panel-${tab}`));
}

async function loadCustomers() {
  const params = new URLSearchParams({ limit:'150' });
  const query = $('filter-query').value.trim();
  if (query) params.set('q', query);
  if ($('filter-carrier').value) params.set('carrier',$('filter-carrier').value);
  if ($('filter-consent').value) params.set('consent',$('filter-consent').value);
  if ($('filter-installment').value) params.set('installment_months',$('filter-installment').value);
  if ($('filter-due').checked) { params.set('months_min','22'); params.set('months_max','30'); }
  $('customer-body').innerHTML = '<tr><td colspan="9" class="muted">불러오는 중...</td></tr>';
  try {
    const data = await api(`/api/customers?${params}`);
    $('search-result-note').textContent = query ? `“${query}” 검색 결과 ${data.customers.length}건` : '';
    if (!data.customers.length) { $('customer-body').innerHTML='<tr><td colspan="9" class="muted">조건에 맞는 고객이 없습니다.</td></tr>'; return; }
    $('customer-body').innerHTML = data.customers.map(c => `<tr>
      <td>${esc(c.opened_on||'-')}</td><td>${esc(c.name)}</td><td>${esc(c.phone_masked)}</td><td>${esc(c.birth_date||'-')}</td>
      <td>${esc(c.carrier||'-')}</td><td>${esc(c.device_model||'-')}</td><td>${esc(formatInstallment(c.installment_months))}</td>
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
    selectedCustomerId = id;
    $('detail-name').textContent = c.name;
    $('detail-list').innerHTML = `<dt>개통일</dt><dd>${esc(c.opened_on||'-')}</dd><dt>연락처</dt><dd>${esc(formatPhone(c.phone))}</dd><dt>생년월일</dt><dd>${esc(c.birth_date||'-')}</dd><dt>통신사</dt><dd>${esc(c.carrier||'-')}</dd><dt>단말기</dt><dd>${esc(c.device_model||'-')}</dd><dt>할부개월</dt><dd>${esc(formatInstallment(c.installment_months))}</dd><dt>개통 후 경과</dt><dd>${c.months_since_open==null?'-':`${c.months_since_open}개월`}</dd><dt>문자동의</dt><dd>${consentLabel(c.ad_sms_status)}</dd>`;
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
    <p>${esc(line.opened_on||'-')} · ${esc(line.device_model||'-')} · ${esc(formatInstallment(line.installment_months))}</p>
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
    <p>${esc(contract.device_model || '-')} · ${esc(formatInstallment(contract.installment_months))}${contract.current_snapshot ? ' · 기존 현재정보' : ''}</p>
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
    const serverPreview = importRows.length ? await previewImportRows(importRows) : {new_customer_count:0,new_contract_count:0,existing_contract_count:0,conflicts:0};
    const totalReview = reviewRows.length + Number(serverPreview.conflicts || 0);
    const errorNote = fileErrors.length
      ? `<br><b>⚠ 파일 분석 실패 ${fileErrors.length}개</b><details><summary>실패 파일 보기</summary>${fileErrors.map(esc).join('<br>')}</details>`
      : '';

    $('import-summary').classList.remove('hidden');
    $('import-summary').innerHTML = `<b>자동 분석 완료</b><br>신규 고객 <b>${Number(serverPreview.new_customer_count || 0).toLocaleString('ko-KR')}명</b> · 기존 고객 새 계약 <b>${Number(serverPreview.new_contract_count || 0).toLocaleString('ko-KR')}건</b> · 이미 등록된 계약 <b>${Number(serverPreview.existing_contract_count || 0).toLocaleString('ko-KR')}건</b> · 확인 필요 <b>${totalReview.toLocaleString('ko-KR')}건</b><br>동일 계약 중복 정리 <b>${totalDuplicates.toLocaleString('ko-KR')}건</b> · 빈칸/합계 제외 <b>${totalIgnored.toLocaleString('ko-KR')}행</b>${importSelectionNote}${errorNote}<details><summary>파일별 분석 보기</summary>${summaries.map(esc).join('<br>')}</details>`;

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
    <td>${esc(r.carrier||'-')}</td><td>${esc(r.device_model||'-')}</td><td>${esc(formatInstallment(r.installment_months))}</td></tr>`).join('');

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
    let total={newCustomers:0,newContracts:0,existingContracts:0,skipped:0,conflicts:0};
    for (let i=0;i<importRows.length;i+=500) {
      $('import-progress').textContent = `암호화 DB 저장 중 · ${Math.min(i + 500, importRows.length).toLocaleString('ko-KR')}/${importRows.length.toLocaleString('ko-KR')} 계약`;
      await nextPaint();
      const cleanRows = importRows.slice(i,i+500).map(({_file_name,_reasons,_source_row,_sheet_name,...row}) => row);
      const result=await api('/api/import',{method:'POST',body:JSON.stringify({filename:sourceLabel,rows:cleanRows})});
      total.newCustomers += Number(result.new_customer_count ?? result.inserted ?? 0);
      total.newContracts += Number(result.new_contract_count ?? result.updated ?? 0);
      total.existingContracts += Number(result.existing_contract_count ?? 0);
      total.skipped += Number(result.skipped || 0);
      total.conflicts += Number(result.conflicts || 0);
    }
    $('import-progress').textContent = `등록 완료 · 신규 고객 ${total.newCustomers} · 새 계약 ${total.newContracts}`;
    alert(`완료\n신규 고객 ${total.newCustomers}명 · 기존 고객 새 계약 ${total.newContracts}건 · 이미 등록된 계약 ${total.existingContracts}건 · 제외 ${total.skipped}행${total.conflicts?` · 충돌 ${total.conflicts}건`:''}`);
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