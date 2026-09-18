import * as XLSX from 'xlsx';

const $ = id => document.getElementById(id);
let importRows = [];
let selectedCustomerId = null;

const headers = {
  name:['이름','고객명','성명','name'], phone:['연락처','휴대폰','전화번호','핸드폰','mobile','phone'],
  carrier:['통신사','carrier'], device_model:['기종','사용기종','단말기','모델','device','device_model'],
  opened_on:['개통일','가입일','개통날짜','opened_on'], contract_months:['약정개월','약정기간','contract_months'],
  ad_sms_consent:['광고수신동의','문자수신동의','광고문자동의','sms동의','ad_sms_consent'], consent_at:['동의일','수신동의일','consent_at']
};

for (const button of document.querySelectorAll('.tabs button')) button.addEventListener('click', () => openTab(button.dataset.tab));
$('refresh').addEventListener('click', boot);
$('search-customers').addEventListener('click', loadCustomers);
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
      ? 'Cloudflare Access 인증 · 암호화 DB · 문자 실발송 활성 상태'
      : 'Cloudflare Access 인증 · 암호화 DB · 문자 실발송은 안전을 위해 잠금 상태';
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
  if ($('filter-carrier').value) params.set('carrier',$('filter-carrier').value);
  if ($('filter-consent').value) params.set('consent',$('filter-consent').value);
  if ($('filter-due').checked) { params.set('months_min','22'); params.set('months_max','30'); }
  if ($('filter-phone').value.trim()) params.set('phone',$('filter-phone').value.trim());
  $('customer-body').innerHTML = '<tr><td colspan="8" class="muted">불러오는 중...</td></tr>';
  try {
    const data = await api(`/api/customers?${params}`);
    if (!data.customers.length) { $('customer-body').innerHTML='<tr><td colspan="8" class="muted">조건에 맞는 고객이 없습니다.</td></tr>'; return; }
    $('customer-body').innerHTML = data.customers.map(c => `<tr>
      <td>${esc(c.name)}</td><td>${esc(c.phone_masked)}</td><td>${esc(c.carrier||'-')}</td><td>${esc(c.device_model||'-')}</td>
      <td>${esc(c.opened_on||'-')}</td><td>${c.months_since_open==null?'-':`${c.months_since_open}개월`}</td>
      <td><span class="badge ${c.ad_sms_status}">${consentLabel(c.ad_sms_status)}</span></td>
      <td><button data-detail="${c.id}">상세</button></td></tr>`).join('');
    document.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => showCustomer(b.dataset.detail)));
  } catch (error) { showError(error); }
}

async function showCustomer(id) {
  try {
    const {customer:c} = await api(`/api/customers/${id}`);
    selectedCustomerId = id;
    $('detail-name').textContent = c.name;
    $('detail-list').innerHTML = `<dt>연락처</dt><dd>${esc(formatPhone(c.phone))}</dd><dt>통신사</dt><dd>${esc(c.carrier||'-')}</dd><dt>기종</dt><dd>${esc(c.device_model||'-')}</dd><dt>개통일</dt><dd>${esc(c.opened_on||'-')}</dd><dt>약정</dt><dd>${c.contract_months}개월</dd><dt>문자동의</dt><dd>${consentLabel(c.ad_sms_status)}</dd>`;
    const now = new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset()); $('consent-at').value = now.toISOString().slice(0,16);
    $('customer-dialog').showModal();
  } catch (error) { showError(error); }
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
  const file = $('excel-file').files[0];
  if (!file) { alert('Excel 또는 CSV 파일을 선택해 주세요.'); return; }
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval:'' });
    importRows = raw.map(normalizeExcelRow).filter(r => r.name || r.phone);
    $('import-summary').classList.remove('hidden');
    $('import-summary').textContent = `${file.name} · ${importRows.length.toLocaleString('ko-KR')}행 확인. 이름/연락처가 없는 행은 가져오기에서 제외됩니다.`;
    $('preview-wrap').classList.remove('hidden'); $('run-import').classList.remove('hidden');
    $('preview-body').innerHTML = importRows.slice(0,10).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(formatPhone(r.phone))}</td><td>${esc(r.carrier||'-')}</td><td>${esc(r.device_model||'-')}</td><td>${esc(r.opened_on||'-')}</td><td>${esc(String(r.contract_months||24))}개월</td><td>${esc(String(r.ad_sms_consent||'미확인'))}</td></tr>`).join('');
  } catch (error) { showError(new Error(`파일을 읽지 못했습니다: ${error.message}`)); }
}

function normalizeExcelRow(row) {
  const normalized = {};
  const map = new Map(Object.entries(row).map(([k,v]) => [cleanHeader(k), v]));
  for (const [key, aliases] of Object.entries(headers)) {
    for (const alias of aliases) { const v = map.get(cleanHeader(alias)); if (v!==undefined) { normalized[key]=cellValue(v); break; } }
  }
  normalized.phone = String(normalized.phone||'').replace(/\D/g,'');
  normalized.opened_on = excelDate(normalized.opened_on);
  normalized.consent_at = excelDate(normalized.consent_at);
  normalized.contract_months = Number.parseInt(normalized.contract_months,10) || 24;
  return normalized;
}

async function runImport() {
  const file = $('excel-file').files[0];
  if (!file || !importRows.length) return;
  if (!confirm(`${importRows.length.toLocaleString('ko-KR')}행을 암호화 DB로 가져올까요? 원본 파일은 서버에 저장하지 않습니다.`)) return;
  $('run-import').disabled=true; $('run-import').textContent='가져오는 중...';
  try {
    let total={inserted:0,updated:0,skipped:0};
    for (let i=0;i<importRows.length;i+=500) {
      const result=await api('/api/import',{method:'POST',body:JSON.stringify({filename:file.name,rows:importRows.slice(i,i+500)})});
      total.inserted+=result.inserted; total.updated+=result.updated; total.skipped+=result.skipped;
    }
    alert(`완료\n신규 ${total.inserted}명 · 갱신 ${total.updated}명 · 제외 ${total.skipped}행`);
    importRows=[]; $('excel-file').value=''; $('preview-wrap').classList.add('hidden'); $('run-import').classList.add('hidden'); await boot(); openTab('customers');
  } catch(error){showError(error)} finally {$('run-import').disabled=false;$('run-import').textContent='암호화 DB에 가져오기'}
}

async function previewCampaign() {
  try {
    const data=await api('/api/campaigns/preview',{method:'POST',body:JSON.stringify({months_min:$('camp-min').value,months_max:$('camp-max').value,carrier:$('camp-carrier').value})});
    $('campaign-result').classList.remove('hidden');
    $('campaign-result').innerHTML=`전체 후보 <b>${data.total_candidates.toLocaleString('ko-KR')}명</b> · 수신동의 확인 <b>${data.eligible.toLocaleString('ko-KR')}명</b> · 미확인/거부 자동 제외 <b>${data.blocked_or_unknown.toLocaleString('ko-KR')}명</b><br>실발송 상태: <b>${data.sms_mode==='enabled'?'활성':'잠금'}</b>`;
  } catch(error){showError(error)}
}

function cleanHeader(v){return String(v||'').toLowerCase().replace(/[\s_()\-]/g,'')}
function cellValue(v){return v instanceof Date?v.toISOString().slice(0,10):String(v??'').trim()}
function excelDate(v){if(!v)return'';if(v instanceof Date)return v.toISOString().slice(0,10);const s=String(v).trim().replace(/[./]/g,'-');const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:s}
function consentLabel(v){return v==='granted'?'동의':v==='revoked'?'수신거부':'미확인'}
function formatPhone(v){const s=String(v||'').replace(/\D/g,'');return s.length===11?`${s.slice(0,3)}-${s.slice(3,7)}-${s.slice(7)}`:s}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showError(error){console.error(error);alert(error.message||'오류가 발생했습니다.')}

boot();
