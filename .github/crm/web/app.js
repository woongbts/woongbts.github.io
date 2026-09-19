import { read, utils } from 'xlsx';
import {
  classifyImportRows, dedupeImportRows, detectBestTable, formatInstallment, formatPhone,
  rowsToObjects
} from './import-utils.js';

const $ = id => document.getElementById(id);
let importRows = [];
let reviewRows = [];
let selectedCustomerId = null;

for (const button of document.querySelectorAll('.tabs button')) button.addEventListener('click', () => openTab(button.dataset.tab));
$('refresh').addEventListener('click', boot);
$('search-customers').addEventListener('click', loadCustomers);
$('filter-query').addEventListener('keydown', event => { if (event.key === 'Enter') loadCustomers(); });
$('read-file').addEventListener('click', readExcel);
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

async function readExcel() {
  const files = [...$('excel-file').files];
  if (!files.length) { alert('Excel(.xls/.xlsx) 또는 CSV 파일을 선택해 주세요.'); return; }

  try {
    importRows = [];
    reviewRows = [];
    const summaries = [];
    let totalIgnored = 0;
    let totalDuplicates = 0;

    for (const file of files) {
      const result = await analyzeFile(file);
      importRows.push(...result.valid);
      reviewRows.push(...result.review);
      totalIgnored += result.ignored;
      summaries.push(`${file.name}: ${result.valid.length}명 / 확인 ${result.review.length}건 · ${result.sheetName} 시트`);
    }

    const deduped = dedupeImportRows(importRows);
    importRows = deduped.rows;
    reviewRows.push(...deduped.conflicts);
    totalDuplicates += deduped.duplicates;

    const serverPreview = importRows.length ? await previewImportRows(importRows) : {new_count:0,update_count:0,unchanged_count:0,conflicts:0};
    const totalReview = reviewRows.length + Number(serverPreview.conflicts || 0);
    $('import-summary').classList.remove('hidden');
    $('import-summary').innerHTML = `<b>자동 분석 완료</b><br>신규 <b>${serverPreview.new_count.toLocaleString('ko-KR')}명</b> · 기존 갱신 <b>${serverPreview.update_count.toLocaleString('ko-KR')}명</b> · 기존 최신정보 유지 <b>${serverPreview.unchanged_count.toLocaleString('ko-KR')}명</b> · 확인 필요 <b>${totalReview.toLocaleString('ko-KR')}건</b><br>같은 번호 최신정보 정리 <b>${totalDuplicates.toLocaleString('ko-KR')}건</b> · 빈칸/합계 제외 <b>${totalIgnored.toLocaleString('ko-KR')}행</b><details><summary>파일별 분석 보기</summary>${summaries.map(esc).join('<br>')}</details>`;

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
  const total = {new_count:0, update_count:0, unchanged_count:0, conflicts:0};
  for (let i=0; i<rows.length; i+=500) {
    const cleanRows = rows.slice(i,i+500).map(({_file_name,_reasons,_source_row,...row}) => row);
    const result = await api('/api/import/preview', { method:'POST', body:JSON.stringify({rows:cleanRows}) });
    total.new_count += Number(result.new_count || 0);
    total.update_count += Number(result.update_count || 0);
    total.unchanged_count += Number(result.unchanged_count || 0);
    total.conflicts += Number(result.conflicts || 0);
  }
  return total;
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

  const detected = detectBestTable(sheets);
  const objects = rowsToObjects(detected.rows, detected.headerIndex);
  const classified = classifyImportRows(objects, file.name);
  return { ...classified, sheetName:detected.sheetName };
}

function renderImportPreview() {
  $('preview-body').innerHTML = importRows.slice(0,12).map(r => `<tr>
    <td>${esc(r.opened_on||'-')}</td><td>${esc(r.name)}</td><td>${esc(formatPhone(r.phone))}</td><td>${esc(r.birth_date||'-')}</td>
    <td>${esc(r.carrier||'-')}</td><td>${esc(r.device_model||'-')}</td><td>${esc(formatInstallment(r.installment_months))}</td></tr>`).join('');

  $('review-body').innerHTML = reviewRows.slice(0,30).map(r => `<tr>
    <td>${esc(r._file_name||'-')}</td><td>${esc(String(r._source_row||'-'))}</td><td>${esc(r.name||'-')}</td><td>${esc(formatPhone(r.phone)||'-')}</td>
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
  const files = [...$('excel-file').files];
  if (!files.length || !importRows.length) return;
  const reviewText = reviewRows.length ? `\n확인 필요 ${reviewRows.length}건은 자동 등록에서 제외됩니다.` : '';
  if (!confirm(`${importRows.length.toLocaleString('ko-KR')}개 회선을 암호화 DB로 가져올까요? 같은 전화번호는 가장 최근 개통정보로 갱신하고, 다른 전화번호는 별도 회선으로 유지합니다. 원본 파일은 서버에 저장하지 않습니다.${reviewText}`)) return;

  $('run-import').disabled=true; $('run-import').textContent='가져오는 중...';
  try {
    const sourceLabel = files.length === 1 ? files[0].name : `판매일보 ${files.length}개 파일`;
    let total={inserted:0,updated:0,skipped:0,conflicts:0};
    for (let i=0;i<importRows.length;i+=500) {
      const cleanRows = importRows.slice(i,i+500).map(({_file_name,_reasons,_source_row,...row}) => row);
      const result=await api('/api/import',{method:'POST',body:JSON.stringify({filename:sourceLabel,rows:cleanRows})});
      total.inserted+=result.inserted; total.updated+=result.updated; total.skipped+=result.skipped; total.conflicts+=result.conflicts||0;
    }
    alert(`완료\n신규 ${total.inserted}개 회선 · 갱신 ${total.updated}개 회선 · 제외 ${total.skipped}행${total.conflicts?` · 충돌 ${total.conflicts}건`:''}`);
    resetImportUi();
    await boot(); openTab('customers');
  } catch(error){showError(error)} finally {$('run-import').disabled=false;$('run-import').textContent='암호화 DB에 가져오기'}
}

function resetImportUi() {
  importRows=[]; reviewRows=[]; $('excel-file').value='';
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
