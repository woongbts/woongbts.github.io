from pathlib import Path


def replace_between(text, start, end, replacement):
    i = text.index(start)
    j = text.index(end, i)
    return text[:i] + replacement.rstrip() + "\n\n" + text[j:]


# Frontend app: OneDrive direct import + contract history UI + history-aware summaries.
p = Path('.github/crm/web/app.js')
text = p.read_text()
if "from './onedrive.js'" not in text:
    text = text.replace(
        "} from './import-utils.js';\n",
        "} from './import-utils.js';\nimport { connectOneDrive, disconnectOneDrive, discoverOneDriveSalesFiles, downloadOneDriveFiles, getOneDriveStatus, getStoredOneDriveClientId, setStoredOneDriveClientId } from './onedrive.js';\n",
        1,
    )

if "$('od-save-client').addEventListener" not in text:
    text = text.replace(
        "$('read-folder').addEventListener('click', () => readExcel('folder'));\n",
        "$('read-folder').addEventListener('click', () => readExcel('folder'));\n$('od-save-client').addEventListener('click', saveOneDriveClientId);\n$('od-connect').addEventListener('click', connectOneDriveUi);\n$('od-import').addEventListener('click', readOneDrive);\n$('od-disconnect').addEventListener('click', disconnectOneDriveUi);\n",
        1,
    )

if 'await refreshOneDriveStatus();' not in text.split('async function boot()', 1)[1].split('function openTab', 1)[0]:
    text = text.replace(
        "  try {\n    const [health, dash] = await Promise.all([api('/api/health'), api('/api/dashboard')]);",
        "  try {\n    await refreshOneDriveStatus();\n    const [health, dash] = await Promise.all([api('/api/health'), api('/api/dashboard')]);",
        1,
    )

if 'renderContractHistory(c.contracts || []);' not in text:
    text = text.replace(
        "    renderRelatedLines(c.related_lines || []);\n",
        "    renderRelatedLines(c.related_lines || []);\n    renderContractHistory(c.contracts || []);\n",
        1,
    )

if 'function renderContractHistory(contracts)' not in text:
    marker = 'async function saveConsent() {'
    idx = text.index(marker)
    ui_functions = r'''function renderContractHistory(contracts) {
  const wrap = $('contract-history-wrap');
  if (!contracts.length) {
    wrap.classList.add('hidden');
    $('contract-history').innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  $('contract-history-count').textContent = `${contracts.length}건`;
  $('contract-history').innerHTML = contracts.map(contract => `<article class="contract-history-item">
    <div><b>${esc(contract.opened_on || '-')}</b><span>${esc(contract.carrier || '-')}</span></div>
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

'''
    text = text[:idx] + ui_functions + text[idx:]

# Refactor local/folder import to a common analyzer callable by OneDrive.
if 'async function analyzeSelectedFiles(files' not in text:
    read_start = text.index("async function readExcel(mode='files') {")
    common_start = text.index('  selectedImportFiles = files;\n  try {', read_start)
    preview_start = text.index('\nasync function previewImportRows(rows) {', common_start)
    common_segment = text[common_start:preview_start]
    common_body = common_segment.replace('  selectedImportFiles = files;\n', '', 1)
    replacement = (
        "  return analyzeSelectedFiles(files, importSelectionNote);\n}\n\n"
        "async function analyzeSelectedFiles(files, selectionNote='') {\n"
        "  selectedImportFiles = files;\n"
        "  importSelectionNote = selectionNote;\n"
        + common_body.lstrip()
    )
    text = text[:common_start] + replacement + text[preview_start:]

text = text.replace(
    "const serverPreview = importRows.length ? await previewImportRows(importRows) : {new_count:0,update_count:0,unchanged_count:0,conflicts:0};",
    "const serverPreview = importRows.length ? await previewImportRows(importRows) : {new_customer_count:0,new_contract_count:0,existing_contract_count:0,conflicts:0};",
)
text = text.replace(
    "$('import-progress').textContent = `D1 기존 고객과 비교 중 · ${importRows.length.toLocaleString('ko-KR')}개 회선`;",
    "$('import-progress').textContent = `D1 기존 고객·계약 이력과 비교 중 · ${importRows.length.toLocaleString('ko-KR')}개 계약`;",
)
old_summary = "$('import-summary').innerHTML = `<b>자동 분석 완료</b><br>신규 <b>${serverPreview.new_count.toLocaleString('ko-KR')}명</b> · 기존 갱신 <b>${serverPreview.update_count.toLocaleString('ko-KR')}명</b> · 기존 최신정보 유지 <b>${serverPreview.unchanged_count.toLocaleString('ko-KR')}명</b> · 확인 필요 <b>${totalReview.toLocaleString('ko-KR')}건</b><br>같은 번호 최신정보 정리 <b>${totalDuplicates.toLocaleString('ko-KR')}건</b> · 빈칸/합계 제외 <b>${totalIgnored.toLocaleString('ko-KR')}행</b>${importSelectionNote}${errorNote}<details><summary>파일별 분석 보기</summary>${summaries.map(esc).join('<br>')}</details>`;"
new_summary = "$('import-summary').innerHTML = `<b>자동 분석 완료</b><br>신규 고객 <b>${Number(serverPreview.new_customer_count || 0).toLocaleString('ko-KR')}명</b> · 기존 고객 새 계약 <b>${Number(serverPreview.new_contract_count || 0).toLocaleString('ko-KR')}건</b> · 이미 등록된 계약 <b>${Number(serverPreview.existing_contract_count || 0).toLocaleString('ko-KR')}건</b> · 확인 필요 <b>${totalReview.toLocaleString('ko-KR')}건</b><br>동일 계약 중복 정리 <b>${totalDuplicates.toLocaleString('ko-KR')}건</b> · 빈칸/합계 제외 <b>${totalIgnored.toLocaleString('ko-KR')}행</b>${importSelectionNote}${errorNote}<details><summary>파일별 분석 보기</summary>${summaries.map(esc).join('<br>')}</details>`;"
if old_summary in text:
    text = text.replace(old_summary, new_summary)
text = text.replace(
    "$('import-progress').textContent = `분석 완료 · ${files.length}개 파일 · 등록 후보 ${importRows.length.toLocaleString('ko-KR')}개 회선`;",
    "$('import-progress').textContent = `분석 완료 · ${files.length}개 파일 · 등록 후보 ${importRows.length.toLocaleString('ko-KR')}개 계약`;",
)

preview_func = r'''async function previewImportRows(rows) {
  const total = {new_customer_count:0, new_contract_count:0, existing_contract_count:0, conflicts:0};
  for (let i=0; i<rows.length; i+=500) {
    const cleanRows = rows.slice(i,i+500).map(({_file_name,_reasons,_source_row,...row}) => row);
    const result = await api('/api/import/preview', { method:'POST', body:JSON.stringify({rows:cleanRows}) });
    total.new_customer_count += Number(result.new_customer_count || result.new_count || 0);
    total.new_contract_count += Number(result.new_contract_count || result.update_count || 0);
    total.existing_contract_count += Number(result.existing_contract_count || result.unchanged_count || 0);
    total.conflicts += Number(result.conflicts || 0);
  }
  return total;
}'''
text = replace_between(text, 'async function previewImportRows(rows) {', 'async function analyzeFile(file) {', preview_func)

run_import = r'''async function runImport() {
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
      const cleanRows = importRows.slice(i,i+500).map(({_file_name,_reasons,_source_row,...row}) => row);
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
}'''
text = replace_between(text, 'async function runImport() {', 'function resetImportUi() {', run_import)
p.write_text(text)


# HTML: OneDrive direct card and customer contract history panel.
p = Path('.github/crm/web/index.html')
text = p.read_text()
if 'id="od-import"' not in text:
    anchor = '      <div class="bulk-import-card">\n'
    card = '''      <div class="onedrive-card">
        <div class="bulk-import-head">
          <div><strong>OneDrive에서 바로 가져오기</strong><small>OneDrive의 <b>웅비통신/웅비통신 판매일보</b> 폴더를 CRM이 읽어 월별 판매일보를 직접 분석합니다. 원본 Excel은 CRM 서버나 GitHub에 저장하지 않습니다.</small></div>
          <span id="od-status" class="connection-state pending">설정 확인 중</span>
        </div>
        <div class="bulk-range">
          <label>시작월<input id="od-start" type="month" value="2019-07"></label>
          <label>종료월<input id="od-end" type="month" value="2026-08"></label>
        </div>
        <div class="onedrive-actions">
          <button id="od-connect" class="onedrive-connect">Microsoft 계정 연결</button>
          <button id="od-import" class="primary-inline">OneDrive 판매일보 자동 분석</button>
          <button id="od-disconnect">연결 해제</button>
        </div>
        <details id="onedrive-setup" class="onedrive-setup">
          <summary>최초 1회 Microsoft 앱 설정</summary>
          <p class="sub">Microsoft Entra 앱 등록에서 SPA 리디렉션 URI를 <b>https://woongbi-crm.woongbts.workers.dev/</b> 로 등록하고, Microsoft Graph 위임 권한 <b>Files.Read</b>만 허용합니다. Client ID는 비밀키가 아니며 이 브라우저에만 저장됩니다.</p>
          <div class="client-id-row"><input id="od-client-id" autocomplete="off" placeholder="Application (client) ID"><button id="od-save-client">Client ID 저장</button></div>
        </details>
        <small class="privacy-note">Microsoft 로그인 토큰은 브라우저 세션에만 보관하며 CRM API·D1·GitHub로 전송하지 않습니다.</small>
      </div>

'''
    text = text.replace(anchor, card + anchor, 1)

text = text.replace(
    '같은 전화번호는 가장 최근 개통정보로 갱신하고, 이름이 같아도 전화번호가 다르면 별도 회선으로 유지합니다.',
    '같은 전화번호의 과거 개통은 계약 이력으로 모두 보존하고, 고객 목록에는 가장 최근 개통정보를 표시합니다. 이름이 같아도 전화번호가 다르면 별도 회선으로 유지합니다.'
)

if 'id="contract-history-wrap"' not in text:
    related_anchor = '      <section id="related-lines-wrap" class="related-lines-wrap hidden">\n'
    panel = '''      <section id="contract-history-wrap" class="contract-history-wrap hidden">
        <div class="related-lines-head">
          <h3>계약 이력 <span id="contract-history-count"></span></h3>
          <small>같은 전화번호의 과거 개통을 삭제하지 않고 보존합니다.</small>
        </div>
        <div id="contract-history"></div>
      </section>

'''
    text = text.replace(related_anchor, panel + related_anchor, 1)
p.write_text(text)


# Styles.
p = Path('.github/crm/web/styles.css')
text = p.read_text()
if '.onedrive-card{' not in text:
    text += r'''
.onedrive-card{margin:14px 0 16px;padding:16px;border:1px solid #b9d7e7;border-radius:15px;background:#f5fbff}.onedrive-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.onedrive-connect{background:#fff;color:#184f70;border-color:#91bdd4}.primary-inline{background:#117f73;color:#fff;border-color:#117f73}.connection-state{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;font-size:.76rem;font-weight:800;white-space:nowrap}.connection-state.pending{background:#fff3d9;color:#805b12}.connection-state.connected{background:#e4f6ed;color:#137447}.onedrive-setup{margin-top:10px;border-top:1px solid #d7e7ef;padding-top:8px}.onedrive-setup summary{cursor:pointer;font-weight:800;color:#48666f}.client-id-row{display:flex;gap:8px}.client-id-row input{flex:1;min-width:180px}.contract-history-wrap{margin:14px 0;padding:14px;border:1px solid #d6e3ef;border-radius:14px;background:#f8fbff}.contract-history-item{padding:10px 0;border-top:1px solid #e6edf3}.contract-history-item:first-child{border-top:0}.contract-history-item div{display:flex;gap:9px;align-items:center}.contract-history-item span{font-size:.82rem;color:#58717d}.contract-history-item p{margin:4px 0 0;color:#667c83;font-size:.84rem}@media(max-width:760px){.onedrive-actions,.client-id-row{display:grid;grid-template-columns:1fr}.onedrive-actions button,.client-id-row button{width:100%}}
'''
p.write_text(text)


# README: final fields and OneDrive security/setup.
p = Path('.github/crm/README.md')
text = p.read_text()
text = text.replace('- 통신사, 개통일, 약정개월, 기기명 관리', '- 통신사, 개통일, 할부개월수, 기기명 관리\n- 같은 전화번호의 과거 개통을 `customer_contracts` 계약 이력으로 보존')
text = text.replace('- 약정개월 / 약정기간', '- 할부개월수 / 할부개월 / 할부기간')
if '## OneDrive 직접 가져오기 설정' not in text:
    text += '''\n\n## OneDrive 직접 가져오기 설정\n\nCRM은 Microsoft Graph의 최소 위임 권한 `Files.Read`만 사용해 개인 OneDrive의 `웅비통신/웅비통신 판매일보` 폴더를 브라우저에서 직접 읽는다. 원본 Excel과 Microsoft 액세스 토큰은 Worker/D1/GitHub로 전송하지 않는다.\n\n1. Microsoft Entra 관리센터에서 새 앱 등록\n2. 지원 계정 유형에 개인 Microsoft 계정을 포함\n3. Authentication > Single-page application(SPA)에 `https://woongbi-crm.woongbts.workers.dev/` 등록\n4. Microsoft Graph Delegated permission `Files.Read`만 추가 (`Files.ReadWrite` 불필요)\n5. Application (client) ID를 CRM의 최초 1회 설정에 입력\n6. CRM에서 Microsoft 계정 연결 후 기간을 선택하고 판매일보를 분석\n\nClient ID는 공개 식별자라 브라우저 localStorage에 저장할 수 있지만, 액세스 토큰은 MSAL의 sessionStorage에만 두고 장기 저장하지 않는다.\n'''
p.write_text(text)
