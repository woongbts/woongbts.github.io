from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    return text.replace(old, new, 1)


p = Path('.github/crm/web/import-utils.js')
text = p.read_text()
text = replace_once(text,
    "const SKIP_SHEET = /(유심|선불|유선|렌탈|가망|수입|지출)/i;",
    "const EXCLUDED_SHEET = /(선불|유선|렌탈|가망|수입|지출)/i;\nconst WIRELESS_SHEET = /무선/i;\nconst SIM_SHEET = /(유심|usim)/i;",
    'sheet constants')
text = text.replace('if (SKIP_SHEET.test(sheetName)) score -= 12;', 'if (EXCLUDED_SHEET.test(sheetName)) score -= 12;')
marker = "export function rowsToObjects(rows, headerIndex = 0) {"
addition = '''function detectTableInSheet(sheet, sheetType) {
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
  let best = null;
  const max = Math.min(rows.length, 25);
  for (let rowIndex = 0; rowIndex < max; rowIndex++) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const fields = new Set(row.map(fieldForHeader).filter(Boolean));
    if (!fields.has('name') || !fields.has('phone')) continue;
    let score = 20;
    if (fields.has('opened_on')) score += 10;
    for (const field of PREFERRED_FIELDS) if (fields.has(field)) score += 3;
    if (!best || score > best.score) best = {
      sheetName: String(sheet?.name || ''), headerIndex: rowIndex, score, rows, sheetType
    };
  }
  return best;
}

export function detectImportTables(sheets) {
  const detected = [];
  for (const sheet of sheets || []) {
    const name = String(sheet?.name || '');
    if (EXCLUDED_SHEET.test(name)) continue;
    const sheetType = SIM_SHEET.test(name) ? 'sim' : WIRELESS_SHEET.test(name) ? 'wireless' : '';
    if (!sheetType) continue;
    const table = detectTableInSheet(sheet, sheetType);
    if (table) detected.push(table);
  }
  if (detected.length) {
    return detected.sort((a, b) => (a.sheetType === 'wireless' ? 0 : 1) - (b.sheetType === 'wireless' ? 0 : 1));
  }
  const fallback = detectBestTable(sheets);
  return [{ ...fallback, sheetType: SIM_SHEET.test(fallback.sheetName) ? 'sim' : 'wireless' }];
}

'''
if marker not in text:
    raise SystemExit('rowsToObjects marker not found')
text = text.replace(marker, addition + marker, 1)
text = replace_once(text,
    "      row.installment_months ?? ''\n    ].join('|');",
    "      row.installment_months ?? '',\n      row.service_type === 'sim' ? 'sim' : ''\n    ].join('|');",
    'client contract key')
p.write_text(text)


p = Path('.github/crm/web/app.js')
text = p.read_text()
text = replace_once(text,
    '  classifyImportRows, dedupeImportRows, detectBestTable, formatInstallment, formatPhone,\n  rowsToObjects, selectSalesFilesByRange',
    '  classifyImportRows, dedupeImportRows, detectImportTables, formatInstallment, formatPhone,\n  rowsToObjects, selectSalesFilesByRange',
    'app imports')
text = replace_once(text,
    "        summaries.push(`${file.name}: ${result.valid.length}명 / 확인 ${result.review.length}건 · ${result.sheetName} 시트`);",
    "        summaries.push(`${file.name}: ${result.valid.length}건 / 확인 ${result.review.length}건 · ${result.sheetSummaries.join(' / ')}`);",
    'file summary')
old_preview = '''async function previewImportRows(rows) {
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
}
'''
new_preview = '''async function previewImportRows(rows) {
  if (rows.length > 5000) throw new Error('미리보기는 한 번에 최대 5,000개 계약까지 확인할 수 있습니다.');
  const cleanRows = rows.map(({_file_name,_reasons,_source_row,_sheet_name,...row}) => row);
  return api('/api/import/preview', { method:'POST', body:JSON.stringify({rows:cleanRows}) });
}
'''
text = replace_once(text, old_preview, new_preview, 'preview aggregation')
old_analyze = '''  const detected = detectBestTable(sheets);
  const objects = rowsToObjects(detected.rows, detected.headerIndex);
  const classified = classifyImportRows(objects, file.name);
  return { ...classified, sheetName:detected.sheetName };
'''
new_analyze = '''  const detectedTables = detectImportTables(sheets);
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
'''
text = replace_once(text, old_analyze, new_analyze, 'analyzeFile multi sheet')
text = text.replace("const cleanRows = importRows.slice(i,i+500).map(({_file_name,_reasons,_source_row,...row}) => row);",
                    "const cleanRows = importRows.slice(i,i+500).map(({_file_name,_reasons,_source_row,_sheet_name,...row}) => row);")
text = replace_once(text,
    "    <div><b>${esc(contract.opened_on || '-')}</b><span>${esc(contract.carrier || '-')}</span></div>",
    "    <div><b>${esc(contract.opened_on || '-')}</b><span>${contract.service_type === 'sim' ? '유심' : '무선'} · ${esc(contract.carrier || '-')}</span></div>",
    'contract history service type')
text = replace_once(text,
    "    <td>${esc(r._file_name||'-')}</td><td>${esc(String(r._source_row||'-'))}</td><td>${esc(r.name||'-')}</td><td>${esc(formatPhone(r.phone)||'-')}</td>",
    "    <td>${esc(r._file_name||'-')}${r._sheet_name ? ` · ${esc(r._sheet_name)}` : ''}</td><td>${esc(String(r._source_row||'-'))}</td><td>${esc(r.name||'-')}</td><td>${esc(formatPhone(r.phone)||'-')}</td>",
    'review source sheet')
p.write_text(text)


p = Path('.github/crm/src/worker.js')
text = p.read_text()
schema_marker = "      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_customer_contracts_opened_on ON customer_contracts(opened_on)')\n    ]);"
schema_new = "      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_customer_contracts_opened_on ON customer_contracts(opened_on)')\n    ]);\n    const contractInfo = await env.DB.prepare('PRAGMA table_info(customer_contracts)').all();\n    const contractColumns = new Set((contractInfo.results || []).map(row => String(row.name)));\n    if (!contractColumns.has('service_type')) {\n      await env.DB.exec(\"ALTER TABLE customer_contracts ADD COLUMN service_type TEXT CHECK (service_type IN ('wireless','sim') OR service_type IS NULL)\");\n    }"
text = replace_once(text, schema_marker, schema_new, 'service_type schema')
text = replace_once(text,
    "  const contractResult = await env.DB.prepare(`SELECT id, opened_on, carrier, device_model_enc, installment_months, created_at",
    "  const contractResult = await env.DB.prepare(`SELECT id, opened_on, carrier, device_model_enc, installment_months, service_type, created_at",
    'contract query service_type')
text = replace_once(text,
    "      installment_months: contract.installment_months,\n      created_at: contract.created_at",
    "      installment_months: contract.installment_months,\n      service_type: contract.service_type || 'wireless',\n      created_at: contract.created_at",
    'contract response service_type')
text = replace_once(text,
    "      installment_months: row.installment_months,\n      current_snapshot: true",
    "      installment_months: row.installment_months,\n      service_type: 'wireless',\n      current_snapshot: true",
    'fallback service_type')
text = replace_once(text,
    "      installment_months: normalizeInstallmentMonths(raw.installment_months),\n      consent: normalizeConsent(raw.ad_sms_consent),",
    "      installment_months: normalizeInstallmentMonths(raw.installment_months),\n      service_type: raw.service_type === 'sim' ? 'sim' : 'wireless',\n      consent: normalizeConsent(raw.ad_sms_consent),",
    'prepare service_type')
old_contract_hash = '''async function contractHmac(row, env) {
  const device = String(row.device_model || '').trim().replace(/\\s+/g, '').toLowerCase();
  const value = [
    normalizePhone(row.phone || ''),
    row.opened_on || '',
    row.carrier || '',
    device,
    row.installment_months ?? ''
  ].join('|');
  return hmacDigest(`contract:${value}`, env);
}
'''
new_contract_hash = '''async function contractHmac(row, env) {
  const device = String(row.device_model || '').trim().replace(/\\s+/g, '').toLowerCase();
  const parts = [
    normalizePhone(row.phone || ''),
    row.opened_on || '',
    row.carrier || '',
    device,
    row.installment_months ?? ''
  ];
  // Preserve the legacy wireless hash so already-imported wireless contracts remain idempotent.
  const value = row.service_type === 'sim' ? ['sim', ...parts].join('|') : parts.join('|');
  return hmacDigest(`contract:${value}`, env);
}
'''
text = replace_once(text, old_contract_hash, new_contract_hash, 'contract HMAC')
old_insert = '''    contractStatements.push(env.DB.prepare(`INSERT INTO customer_contracts
      (id,customer_id,opened_on,carrier,device_model_enc,installment_months,contract_hmac,source_type,source_ref,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), current.id, row.opened_on, row.carrier, contractDeviceEnc, row.installment_months, row.contract_hash, 'excel', batchId, now, now));'''
new_insert = '''    contractStatements.push(env.DB.prepare(`INSERT INTO customer_contracts
      (id,customer_id,opened_on,carrier,device_model_enc,installment_months,contract_hmac,source_type,source_ref,created_at,updated_at,service_type)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), current.id, row.opened_on, row.carrier, contractDeviceEnc, row.installment_months, row.contract_hash, 'excel', batchId, now, now, row.service_type));'''
text = replace_once(text, old_insert, new_insert, 'contract insert service_type')
p.write_text(text)


p = Path('.github/crm/web/index.html')
text = p.read_text()
text = text.replace('월별 판매일보를 직접 분석합니다.', '월별 판매일보의 무선·유심 탭을 모두 직접 분석합니다.')
text = text.replace('자동 인식: <b>개통일 · 이름 · 연락처 · 생년월일 · 통신사 · 단말기 · 할부개월수</b><br>', '자동 인식: <b>무선·유심 탭 · 개통일 · 이름 · 연락처 · 생년월일 · 통신사 · 단말기 · 할부개월수</b><br>유심 탭은 단말기·할부 정보가 없어도 고객정보를 등록합니다.<br>')
p.write_text(text)


p = Path('.github/crm/tests/import-utils.test.mjs')
text = p.read_text()
text = replace_once(text,
    '  classifyImportRows, dedupeImportRows, detectBestTable, normalizeBirthDate,',
    '  classifyImportRows, dedupeImportRows, detectBestTable, detectImportTables, normalizeBirthDate,',
    'test imports')
test_marker = "assert.equal(detected.headerIndex, 1);\n"
test_add = '''assert.equal(detected.headerIndex, 1);
const importTables = detectImportTables(sheets);
assert.equal(importTables.length, 2);
assert.equal(importTables[0].sheetType, 'wireless');
assert.equal(importTables[0].sheetName, '2월 무선');
assert.equal(importTables[1].sheetType, 'sim');
assert.equal(importTables[1].sheetName, '2월 유심');
const simObjects = rowsToObjects(importTables[1].rows, importTables[1].headerIndex);
const simClassified = classifyImportRows(simObjects, 'sample.xlsx');
assert.equal(simClassified.valid.length, 1);
assert.equal(simClassified.review.length, 0);
assert.equal(simClassified.valid[0].installment_months, null);
'''
text = replace_once(text, test_marker, test_add, 'multi sheet tests')
history_marker = "assert.equal(historyRows.duplicates, 0);\n"
history_add = '''assert.equal(historyRows.duplicates, 0);

const wirelessAndSim = dedupeImportRows([
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'',installment_months:null,service_type:'wireless'},
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'',installment_months:null,service_type:'sim'}
]);
assert.equal(wirelessAndSim.rows.length, 2);
assert.equal(wirelessAndSim.duplicates, 0);
'''
text = replace_once(text, history_marker, history_add, 'wireless sim dedupe test')
p.write_text(text)


p = Path('.github/crm/tests/worker-schema.test.mjs')
text = p.read_text()
text = replace_once(text,
    "    assert.ok(contracts.results.some(column => column.name === 'contract_hmac'));",
    "    assert.ok(contracts.results.some(column => column.name === 'contract_hmac'));\n    assert.ok(contracts.results.some(column => column.name === 'service_type'));",
    'schema test service_type')
p.write_text(text)
