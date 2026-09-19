from pathlib import Path

worker_path = Path('.github/crm/src/worker.js')
worker = worker_path.read_text(encoding='utf-8')
route_marker = """  if (method === 'POST' && url.pathname === '/api/import') {
    return importCustomers(request, env, user);
  }
"""
route_insert = """  if (method === 'POST' && url.pathname === '/api/import/preview') {
    return previewImport(request, env);
  }
""" + route_marker
assert route_marker in worker, 'import route marker not found'
worker = worker.replace(route_marker, route_insert, 1)

func_marker = "async function importCustomers(request, env, user) {\n"
preview_func = r"""async function previewImport(request, env) {
  const body = await readJson(request);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw httpError(400, '미리 확인할 고객 행이 없습니다.');
  if (rows.length > 5000) throw httpError(400, '한 번에 최대 5,000명까지 미리 확인할 수 있습니다.');

  const preparedByHash = new Map();
  const conflictedHashes = new Set();
  let invalid = 0;
  let duplicate = 0;
  let conflicts = 0;

  for (const raw of rows) {
    const name = String(raw.name || '').trim().slice(0, 80);
    const phone = normalizePhone(raw.phone || '');
    if (!name || phone.length < 10 || phone.length > 11) { invalid++; continue; }
    const phoneHash = await phoneHmac(phone, env);
    if (conflictedHashes.has(phoneHash)) { invalid++; continue; }
    const row = {
      name,
      phone_hash: phoneHash,
      birth_date: normalizeBirthDate(raw.birth_date),
      opened_on: normalizeDate(raw.opened_on)
    };
    const previous = preparedByHash.get(phoneHash);
    if (previous) {
      duplicate++;
      if (previous.birth_date && row.birth_date && previous.birth_date !== row.birth_date) {
        preparedByHash.delete(phoneHash);
        conflictedHashes.add(phoneHash);
        conflicts++;
        continue;
      }
      if ((row.opened_on || '') >= (previous.opened_on || '')) preparedByHash.set(phoneHash, row);
    } else {
      preparedByHash.set(phoneHash, row);
    }
  }

  const prepared = [...preparedByHash.values()];
  const hashes = prepared.map(row => row.phone_hash);
  const existing = new Map();
  for (let i = 0; i < hashes.length; i += 80) {
    const chunk = hashes.slice(i, i + 80);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const found = await env.DB.prepare(`SELECT id, phone_hmac, birth_date_enc, opened_on FROM customers WHERE phone_hmac IN (${placeholders})`).bind(...chunk).all();
    for (const item of found.results || []) existing.set(item.phone_hmac, item);
  }

  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  for (const row of prepared) {
    const current = existing.get(row.phone_hash);
    if (!current) { newCount++; continue; }
    const existingBirth = current.birth_date_enc ? await decryptText(current.birth_date_enc, env) : '';
    if (existingBirth && row.birth_date && existingBirth !== row.birth_date) {
      conflicts++;
      continue;
    }
    if (current.opened_on && row.opened_on && row.opened_on < current.opened_on) {
      unchangedCount++;
      continue;
    }
    updateCount++;
  }

  return json({
    ok: true,
    new_count: newCount,
    update_count: updateCount,
    unchanged_count: unchangedCount,
    invalid_count: invalid,
    duplicate_count: duplicate,
    conflicts
  });
}

"""
assert func_marker in worker, 'import function marker not found'
worker = worker.replace(func_marker, preview_func + func_marker, 1)
worker_path.write_text(worker, encoding='utf-8')

app_path = Path('.github/crm/web/app.js')
app = app_path.read_text(encoding='utf-8')
old_summary = """    $('import-summary').classList.remove('hidden');
    $('import-summary').innerHTML = `<b>자동 분석 완료</b><br>등록/갱신 대상 <b>${importRows.length.toLocaleString('ko-KR')}명</b> · 확인 필요 <b>${reviewRows.length.toLocaleString('ko-KR')}건</b> · 같은 번호 최신정보 정리 <b>${totalDuplicates.toLocaleString('ko-KR')}건</b> · 빈칸/합계 제외 <b>${totalIgnored.toLocaleString('ko-KR')}행</b><details><summary>파일별 분석 보기</summary>${summaries.map(esc).join('<br>')}</details>`;
"""
new_summary = """    const serverPreview = importRows.length ? await previewImportRows(importRows) : {new_count:0,update_count:0,unchanged_count:0,conflicts:0};
    const totalReview = reviewRows.length + Number(serverPreview.conflicts || 0);
    $('import-summary').classList.remove('hidden');
    $('import-summary').innerHTML = `<b>자동 분석 완료</b><br>신규 <b>${serverPreview.new_count.toLocaleString('ko-KR')}명</b> · 기존 갱신 <b>${serverPreview.update_count.toLocaleString('ko-KR')}명</b> · 기존 최신정보 유지 <b>${serverPreview.unchanged_count.toLocaleString('ko-KR')}명</b> · 확인 필요 <b>${totalReview.toLocaleString('ko-KR')}건</b><br>같은 번호 최신정보 정리 <b>${totalDuplicates.toLocaleString('ko-KR')}건</b> · 빈칸/합계 제외 <b>${totalIgnored.toLocaleString('ko-KR')}행</b><details><summary>파일별 분석 보기</summary>${summaries.map(esc).join('<br>')}</details>`;
"""
assert old_summary in app, 'summary marker not found'
app = app.replace(old_summary, new_summary, 1)

analyze_marker = "async function analyzeFile(file) {\n"
preview_js = r"""async function previewImportRows(rows) {
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

"""
assert analyze_marker in app, 'analyze function marker not found'
app = app.replace(analyze_marker, preview_js + analyze_marker, 1)
app_path.write_text(app, encoding='utf-8')

assert "'/api/import/preview'" in worker
assert 'async function previewImportRows' in app
assert '기존 갱신' in app
