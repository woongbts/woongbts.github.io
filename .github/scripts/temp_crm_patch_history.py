from pathlib import Path
import re


def replace_between(text, start, end, replacement):
    i = text.index(start)
    j = text.index(end, i)
    return text[:i] + replacement.rstrip() + "\n\n" + text[j:]


# Worker: contract-history schema and history-aware import.
p = Path('.github/crm/src/worker.js')
text = p.read_text()

ensure_schema = r'''async function ensureSchema(env) {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const info = await env.DB.prepare('PRAGMA table_info(customers)').all();
    const columns = new Set((info.results || []).map(row => String(row.name)));
    if (!columns.has('birth_date_enc')) {
      await env.DB.exec('ALTER TABLE customers ADD COLUMN birth_date_enc TEXT');
    }
    if (!columns.has('installment_months')) {
      await env.DB.exec('ALTER TABLE customers ADD COLUMN installment_months INTEGER CHECK (installment_months IS NULL OR installment_months BETWEEN 0 AND 60)');
    }
    await env.DB.exec('CREATE INDEX IF NOT EXISTS idx_customers_installment_months ON customers(installment_months)');
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS customer_contracts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      opened_on TEXT,
      carrier TEXT CHECK (carrier IN ('SKT','KT','LGU+','알뜰폰','기타') OR carrier IS NULL),
      device_model_enc TEXT,
      installment_months INTEGER CHECK (installment_months IS NULL OR installment_months BETWEEN 0 AND 60),
      contract_hmac TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'excel',
      source_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_customer_contracts_customer ON customer_contracts(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_contracts_opened_on ON customer_contracts(opened_on);`);
  })().catch(error => {
    schemaReadyPromise = null;
    throw error;
  });
  return schemaReadyPromise;
}'''
text = replace_between(text, 'async function ensureSchema(env) {', 'async function dashboard(env) {', ensure_schema)

get_customer = r'''async function getCustomer(env, id) {
  const row = await env.DB.prepare(`SELECT c.*,
    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') ad_sms_status
    FROM customers c WHERE c.id=? LIMIT 1`).bind(id).first();
  if (!row) throw httpError(404, '고객을 찾을 수 없습니다.');

  const name = await decryptText(row.name_enc, env);
  const phone = await decryptText(row.phone_enc, env);
  const birthDate = row.birth_date_enc ? await decryptText(row.birth_date_enc, env) : '';
  const relatedLines = [];

  if (name && birthDate) {
    const peers = await env.DB.prepare(`SELECT id, name_enc, phone_enc, birth_date_enc, carrier, device_model_enc, opened_on, installment_months
      FROM customers WHERE customer_status='active' AND id<>?
      ORDER BY COALESCE(opened_on,'0000-00-00') DESC, created_at DESC LIMIT 5000`).bind(id).all();
    const personName = normalizePersonName(name);
    for (const peer of peers.results || []) {
      if (!peer.birth_date_enc) continue;
      const peerBirth = await decryptText(peer.birth_date_enc, env);
      if (peerBirth !== birthDate) continue;
      const peerName = await decryptText(peer.name_enc, env);
      if (normalizePersonName(peerName) !== personName) continue;
      relatedLines.push({
        id: peer.id,
        phone: await decryptText(peer.phone_enc, env),
        carrier: peer.carrier,
        device_model: peer.device_model_enc ? await decryptText(peer.device_model_enc, env) : '',
        opened_on: peer.opened_on,
        installment_months: peer.installment_months
      });
    }
  }

  const contractResult = await env.DB.prepare(`SELECT id, opened_on, carrier, device_model_enc, installment_months, created_at
    FROM customer_contracts WHERE customer_id=?
    ORDER BY COALESCE(opened_on,'0000-00-00') DESC, created_at DESC LIMIT 200`).bind(id).all();
  const contracts = [];
  for (const contract of contractResult.results || []) {
    contracts.push({
      id: contract.id,
      opened_on: contract.opened_on,
      carrier: contract.carrier,
      device_model: contract.device_model_enc ? await decryptText(contract.device_model_enc, env) : '',
      installment_months: contract.installment_months,
      created_at: contract.created_at
    });
  }
  if (!contracts.length && row.opened_on) {
    contracts.push({
      id: `snapshot-${id}`,
      opened_on: row.opened_on,
      carrier: row.carrier,
      device_model: row.device_model_enc ? await decryptText(row.device_model_enc, env) : '',
      installment_months: row.installment_months,
      current_snapshot: true
    });
  }

  return json({ ok: true, customer: {
    id: row.id,
    name,
    phone,
    birth_date: birthDate,
    carrier: row.carrier,
    device_model: row.device_model_enc ? await decryptText(row.device_model_enc, env) : '',
    opened_on: row.opened_on,
    installment_months: row.installment_months,
    months_since_open: monthsBetween(row.opened_on, new Date()),
    ad_sms_status: row.ad_sms_status,
    related_lines: relatedLines,
    contracts,
    created_at: row.created_at,
    updated_at: row.updated_at
  }});
}'''
text = replace_between(text, 'async function getCustomer(env, id) {', 'async function previewImport(request, env) {', get_customer)

import_region = r'''async function prepareImportRows(rows, env) {
  const identities = new Map();
  const conflictPhones = new Set();
  const normalized = [];
  let invalid = 0;
  let duplicate = 0;

  for (const raw of rows) {
    const name = String(raw.name || '').trim().slice(0, 80);
    const phone = normalizePhone(raw.phone || '');
    if (!name || phone.length < 10 || phone.length > 11) { invalid++; continue; }
    const row = {
      name,
      phone,
      birth_date: normalizeBirthDate(raw.birth_date),
      carrier: normalizeCarrier(raw.carrier),
      device_model: String(raw.device_model || '').trim().slice(0, 120),
      opened_on: normalizeDate(raw.opened_on),
      installment_months: normalizeInstallmentMonths(raw.installment_months),
      consent: normalizeConsent(raw.ad_sms_consent),
      consent_at: normalizeDateTime(raw.consent_at)
    };
    row.phone_hash = await phoneHmac(phone, env);
    row.contract_hash = await contractHmac(row, env);
    const identity = identities.get(row.phone_hash);
    const nameKey = normalizePersonName(name);
    if (identity) {
      if ((identity.name_key && nameKey && identity.name_key !== nameKey) ||
          (identity.birth_date && row.birth_date && identity.birth_date !== row.birth_date)) {
        conflictPhones.add(row.phone_hash);
      }
    } else {
      identities.set(row.phone_hash, { name_key: nameKey, birth_date: row.birth_date || '' });
    }
    normalized.push(row);
  }

  const byContract = new Map();
  for (const row of normalized) {
    if (conflictPhones.has(row.phone_hash)) continue;
    if (byContract.has(row.contract_hash)) { duplicate++; continue; }
    byContract.set(row.contract_hash, row);
  }
  const conflicts = normalized.filter(row => conflictPhones.has(row.phone_hash)).length;
  return { rows: [...byContract.values()], invalid, duplicate, conflicts };
}

async function loadExistingCustomers(prepared, env) {
  const hashes = [...new Set(prepared.map(row => row.phone_hash))];
  const existing = new Map();
  for (let i = 0; i < hashes.length; i += 80) {
    const chunk = hashes.slice(i, i + 80);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const found = await env.DB.prepare(`SELECT id, phone_hmac, name_enc, birth_date_enc, opened_on FROM customers WHERE phone_hmac IN (${placeholders})`).bind(...chunk).all();
    for (const item of found.results || []) {
      item._name = await decryptText(item.name_enc, env);
      item._birth = item.birth_date_enc ? await decryptText(item.birth_date_enc, env) : '';
      existing.set(item.phone_hmac, item);
    }
  }
  return existing;
}

async function loadExistingContractHashes(prepared, env) {
  const hashes = [...new Set(prepared.map(row => row.contract_hash))];
  const existing = new Set();
  for (let i = 0; i < hashes.length; i += 80) {
    const chunk = hashes.slice(i, i + 80);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const found = await env.DB.prepare(`SELECT contract_hmac FROM customer_contracts WHERE contract_hmac IN (${placeholders})`).bind(...chunk).all();
    for (const item of found.results || []) existing.add(item.contract_hmac);
  }
  return existing;
}

function identityMatchesExisting(current, row) {
  if (!current) return true;
  if (current._name && normalizePersonName(current._name) !== normalizePersonName(row.name)) return false;
  if (current._birth && row.birth_date && current._birth !== row.birth_date) return false;
  return true;
}

async function previewImport(request, env) {
  const body = await readJson(request);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw httpError(400, '미리 확인할 고객 행이 없습니다.');
  if (rows.length > 5000) throw httpError(400, '한 번에 최대 5,000개 계약까지 미리 확인할 수 있습니다.');

  const prepared = await prepareImportRows(rows, env);
  const existingCustomers = await loadExistingCustomers(prepared.rows, env);
  const existingContracts = await loadExistingContractHashes(prepared.rows, env);
  const wouldExist = new Set(existingCustomers.keys());
  let newCustomerCount = 0;
  let newContractCount = 0;
  let existingContractCount = 0;
  let conflicts = prepared.conflicts;

  for (const row of prepared.rows) {
    const current = existingCustomers.get(row.phone_hash);
    if (current && !identityMatchesExisting(current, row)) { conflicts++; continue; }
    if (existingContracts.has(row.contract_hash)) { existingContractCount++; continue; }
    if (!wouldExist.has(row.phone_hash)) {
      newCustomerCount++;
      wouldExist.add(row.phone_hash);
    } else {
      newContractCount++;
    }
  }

  return json({
    ok: true,
    new_customer_count: newCustomerCount,
    new_contract_count: newContractCount,
    existing_contract_count: existingContractCount,
    invalid_count: prepared.invalid,
    duplicate_count: prepared.duplicate,
    conflicts,
    new_count: newCustomerCount,
    update_count: newContractCount,
    unchanged_count: existingContractCount
  });
}

async function importCustomers(request, env, user) {
  const body = await readJson(request);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw httpError(400, '가져올 고객 행이 없습니다.');
  if (rows.length > 5000) throw httpError(400, '한 번에 최대 5,000개 계약까지 가져올 수 있습니다.');

  const preparedResult = await prepareImportRows(rows, env);
  const prepared = [...preparedResult.rows].sort((a, b) =>
    a.phone_hash.localeCompare(b.phone_hash) || String(a.opened_on || '').localeCompare(String(b.opened_on || ''))
  );
  if (!prepared.length) throw httpError(400, '유효한 이름/연락처 계약 행이 없습니다.');

  const existingCustomers = await loadExistingCustomers(prepared, env);
  const existingContracts = await loadExistingContractHashes(prepared, env);
  const now = new Date().toISOString();
  const batchId = crypto.randomUUID();
  const customerStatements = [];
  const contractStatements = [];
  const consentStatements = [];
  let newCustomers = 0;
  let newContracts = 0;
  let alreadyRegistered = 0;
  let snapshotUpdates = 0;
  let conflicts = preparedResult.conflicts;
  let skipped = preparedResult.invalid + preparedResult.duplicate + preparedResult.conflicts;

  for (const row of prepared) {
    let current = existingCustomers.get(row.phone_hash);
    if (current && !identityMatchesExisting(current, row)) {
      conflicts++; skipped++; continue;
    }
    if (existingContracts.has(row.contract_hash)) {
      alreadyRegistered++; skipped++; continue;
    }

    const wasNewCustomer = !current;
    if (!current) {
      const id = crypto.randomUUID();
      const nameEnc = await encryptText(row.name, env);
      const phoneEnc = await encryptText(row.phone, env);
      const birthEnc = row.birth_date ? await encryptText(row.birth_date, env) : null;
      const deviceEnc = row.device_model ? await encryptText(row.device_model, env) : null;
      customerStatements.push(env.DB.prepare(`INSERT INTO customers
        (id,phone_hmac,name_enc,phone_enc,birth_date_enc,carrier,device_model_enc,opened_on,installment_months,source_type,source_ref,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, row.phone_hash, nameEnc, phoneEnc, birthEnc, row.carrier, deviceEnc, row.opened_on, row.installment_months, 'excel', batchId, now, now));
      current = { id, phone_hmac: row.phone_hash, _name: row.name, _birth: row.birth_date || '', opened_on: row.opened_on || '' };
      existingCustomers.set(row.phone_hash, current);
      newCustomers++;
    } else if (!current.opened_on || (row.opened_on && row.opened_on >= current.opened_on)) {
      const nameEnc = await encryptText(row.name, env);
      const phoneEnc = await encryptText(row.phone, env);
      const birthEnc = row.birth_date ? await encryptText(row.birth_date, env) : null;
      const deviceEnc = row.device_model ? await encryptText(row.device_model, env) : null;
      customerStatements.push(env.DB.prepare(`UPDATE customers SET
        name_enc=?, phone_enc=?, birth_date_enc=COALESCE(?,birth_date_enc), carrier=COALESCE(?,carrier),
        device_model_enc=COALESCE(?,device_model_enc), opened_on=COALESCE(?,opened_on),
        installment_months=COALESCE(?,installment_months), source_type='excel', source_ref=?, updated_at=?
        WHERE id=?`)
        .bind(nameEnc, phoneEnc, birthEnc, row.carrier, deviceEnc, row.opened_on, row.installment_months, batchId, now, current.id));
      current._name = row.name;
      if (row.birth_date) current._birth = row.birth_date;
      if (row.opened_on) current.opened_on = row.opened_on;
      snapshotUpdates++;
    }

    const contractDeviceEnc = row.device_model ? await encryptText(row.device_model, env) : null;
    contractStatements.push(env.DB.prepare(`INSERT INTO customer_contracts
      (id,customer_id,opened_on,carrier,device_model_enc,installment_months,contract_hmac,source_type,source_ref,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), current.id, row.opened_on, row.carrier, contractDeviceEnc, row.installment_months, row.contract_hash, 'excel', batchId, now, now));
    existingContracts.add(row.contract_hash);
    if (!wasNewCustomer) newContracts++;

    if (row.consent === 'granted' && row.consent_at) {
      consentStatements.push(env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), current.id, 'ad_sms', 'granted', row.consent_at, 'imported_record', await encryptText('기존 동의기록이 있는 Excel 행에서 가져옴', env), now));
    } else if (row.consent === 'revoked') {
      consentStatements.push(env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,revoked_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), current.id, 'ad_sms', 'revoked', row.consent_at || now, 'imported_record', await encryptText(row.consent_at ? '기존 수신거부 기록을 Excel에서 가져옴' : 'Excel에 수신거부로 표시됨(원 거부일 미기재)', env), row.consent_at || now, now));
    }
  }

  for (let i = 0; i < customerStatements.length; i += 80) await env.DB.batch(customerStatements.slice(i, i + 80));
  for (let i = 0; i < contractStatements.length; i += 80) await env.DB.batch(contractStatements.slice(i, i + 80));
  for (let i = 0; i < consentStatements.length; i += 80) await env.DB.batch(consentStatements.slice(i, i + 80));

  const filenameEnc = body.filename ? await encryptText(String(body.filename).slice(0, 200), env) : null;
  await env.DB.prepare(`INSERT INTO import_batches (id,original_filename_enc,row_count,inserted_count,updated_count,skipped_count,created_at,created_by) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(batchId, filenameEnc, rows.length, newCustomers, newContracts, skipped, now, user.email).run();
  await audit(env, user.email, 'customer_import', 'import_batch', batchId, {
    rows: rows.length, new_customers: newCustomers, new_contracts: newContracts,
    already_registered: alreadyRegistered, snapshot_updates: snapshotUpdates,
    skipped, conflicts
  });

  return json({
    ok: true,
    batch_id: batchId,
    new_customer_count: newCustomers,
    new_contract_count: newContracts,
    existing_contract_count: alreadyRegistered,
    snapshot_update_count: snapshotUpdates,
    inserted: newCustomers,
    updated: newContracts,
    skipped,
    conflicts
  });
}'''
text = replace_between(text, 'async function previewImport(request, env) {', 'async function recordConsent(request, env, user, customerId) {', import_region)

hmac_region = r'''async function hmacDigest(value, env) {
  const raw = base64Bytes(String(env.CRM_HMAC_KEY_B64 || ''));
  if (raw.byteLength !== 32) throw httpError(503, 'CRM 검색 키가 설정되지 않았습니다.');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(String(value)));
  return [...new Uint8Array(signed)].map(v => v.toString(16).padStart(2,'0')).join('');
}

async function phoneHmac(phone, env) {
  return hmacDigest(phone, env);
}

async function contractHmac(row, env) {
  const device = String(row.device_model || '').trim().replace(/\s+/g, '').toLowerCase();
  const value = [
    normalizePhone(row.phone || ''),
    row.opened_on || '',
    row.carrier || '',
    device,
    row.installment_months ?? ''
  ].join('|');
  return hmacDigest(`contract:${value}`, env);
}'''
text = replace_between(text, 'async function phoneHmac(phone, env) {', 'function normalizePhone(value) {', hmac_region)

text = re.sub(
    r"headers\.set\('content-security-policy',\s*\"[^\"]*\"\);",
    "headers.set('content-security-policy', \"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://*.1drv.com https://*.live.com https://*.microsoftpersonalcontent.com; frame-src https://login.microsoftonline.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'\");",
    text,
    count=1
)
p.write_text(text)


# Browser-side import de-duplication now preserves distinct contracts.
p = Path('.github/crm/web/import-utils.js')
text = p.read_text()
dedupe = r'''export function dedupeImportRows(rows) {
  const identityByPhone = new Map();
  const conflictPhones = new Set();
  const byContract = new Map();
  const allRowsByPhone = new Map();
  let duplicates = 0;

  const nameKey = value => String(value || '').trim().replace(/\s+/g, '').toLowerCase();
  const deviceKey = value => String(value || '').trim().replace(/\s+/g, '').toLowerCase();

  for (const row of rows || []) {
    const phone = String(row.phone || '');
    const identity = identityByPhone.get(phone);
    const nextIdentity = { name: nameKey(row.name), birth: String(row.birth_date || '') };
    if (identity) {
      if ((identity.name && nextIdentity.name && identity.name !== nextIdentity.name) ||
          (identity.birth && nextIdentity.birth && identity.birth !== nextIdentity.birth)) {
        conflictPhones.add(phone);
      }
    } else {
      identityByPhone.set(phone, nextIdentity);
    }
    if (!allRowsByPhone.has(phone)) allRowsByPhone.set(phone, []);
    allRowsByPhone.get(phone).push(row);

    const contractKey = [
      phone,
      row.opened_on || '',
      row.carrier || '',
      deviceKey(row.device_model),
      row.installment_months ?? ''
    ].join('|');
    if (byContract.has(contractKey)) duplicates++;
    else byContract.set(contractKey, row);
  }

  const conflicts = [];
  for (const phone of conflictPhones) {
    for (const row of allRowsByPhone.get(phone) || []) {
      conflicts.push({ ...row, _reasons:['같은 전화번호의 명의자 정보 충돌'] });
    }
  }
  const kept = [...byContract.values()].filter(row => !conflictPhones.has(String(row.phone || '')));
  return { rows: kept, conflicts, duplicates };
}'''
text = replace_between(text, 'export function dedupeImportRows(rows) {', 'function monthKey(year, month) {', dedupe)
p.write_text(text)


# Tests: historical contracts preserved, exact duplicate collapsed, holder conflict blocked.
p = Path('.github/crm/tests/import-utils.test.mjs')
text = p.read_text()
start = text.index('const d = dedupeImportRows([')
end = text.index('const sameNameDifferentLines', start)
tests = r'''const historyRows = dedupeImportRows([
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2024-01-01',carrier:'SKT',device_model:'MODEL-A',installment_months:24},
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'MODEL-B',installment_months:24}
]);
assert.equal(historyRows.rows.length, 2);
assert.equal(historyRows.duplicates, 0);

const exactDuplicate = dedupeImportRows([
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'MODEL-B',installment_months:24},
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'MODEL-B',installment_months:24}
]);
assert.equal(exactDuplicate.rows.length, 1);
assert.equal(exactDuplicate.duplicates, 1);

const holderConflict = dedupeImportRows([
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01'},
  {name:'B',phone:duplicatePhone,birth_date:'1981-01-01',opened_on:'2026-01-01'}
]);
assert.equal(holderConflict.rows.length, 0);
assert.equal(holderConflict.conflicts.length, 2);

'''
text = text[:start] + tests + text[end:]
p.write_text(text)
