export const FIELD_ALIASES = {
  opened_on: ['개통일','가입일','개통날짜','opened_on'],
  name: ['이름','고객명','성명','name'],
  phone: ['연락처','휴대폰','전화번호','핸드폰','개통번호','mobile','phone'],
  birth_date: ['생년월일','생일','출생일','birthdate','birth_date'],
  carrier: ['통신사','carrier'],
  device_model: ['기종','사용기종','단말기','모델','모델명','device','device_model'],
  rate_plan: ['요금제','요금제명','사용요금제','가입요금제','요금상품','plan','rate_plan'],
  installment_months: ['할부개월수','할부개월','할부기간','installment_months'],
  ad_sms_consent: ['광고수신동의','문자수신동의','광고문자동의','sms동의','ad_sms_consent'],
  consent_at: ['동의일','수신동의일','consent_at']
};

const KEY_FIELDS = new Set(['opened_on','name','phone']);
const PREFERRED_FIELDS = new Set(['birth_date','carrier','device_model','rate_plan','installment_months']);
const EXCLUDED_SHEET = /(선불|유선|렌탈|가망|수입|지출)/i;
const WIRELESS_SHEET = /무선/i;
const SIM_SHEET = /(유심|usim)/i;

export function cleanHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[\s_()\-./]/g,'');
}

const aliasLookup = new Map();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) aliasLookup.set(cleanHeader(alias), field);
}

export function fieldForHeader(value) {
  return aliasLookup.get(cleanHeader(value)) || null;
}

export function detectBestTable(sheets) {
  let best = null;
  for (const sheet of sheets || []) {
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const max = Math.min(rows.length, 25);
    for (let rowIndex = 0; rowIndex < max; rowIndex++) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const fields = new Set(row.map(fieldForHeader).filter(Boolean));
      const keyMatches = [...KEY_FIELDS].filter(field => fields.has(field)).length;
      if (keyMatches < 2 || !fields.has('name') || !fields.has('phone')) continue;
      let score = keyMatches * 10;
      for (const field of PREFERRED_FIELDS) if (fields.has(field)) score += 3;
      if (fields.has('installment_months')) score += 5;
      const sheetName = String(sheet?.name || '');
      if (/무선/.test(sheetName)) score += 8;
      if (/판매일보/.test(sheetName)) score += 3;
      if (EXCLUDED_SHEET.test(sheetName)) score -= 12;
      if (!best || score > best.score) best = { sheetName, headerIndex: rowIndex, score, rows };
    }
  }
  if (!best) throw new Error('고객명/전화번호가 있는 판매일보 헤더를 자동으로 찾지 못했습니다.');
  return best;
}

function detectTableInSheet(sheet, sheetType) {
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

export function rowsToObjects(rows, headerIndex = 0) {
  if (!Array.isArray(rows) || rows.length <= headerIndex + 1) return [];
  const header = (rows[headerIndex] || []).map(v => String(v ?? '').trim());
  return rows.slice(headerIndex + 1).map((values, offset) => {
    const object = {};
    for (let i = 0; i < header.length; i++) {
      if (header[i]) object[header[i]] = values?.[i] ?? '';
    }
    Object.defineProperty(object, '__sourceRow', { value: headerIndex + offset + 2, enumerable: false });
    return object;
  });
}

function cellValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0,10);
  return String(value ?? '').trim();
}

function valueForAliases(row, aliases) {
  const map = new Map(Object.entries(row || {}).map(([key, value]) => [cleanHeader(key), value]));
  for (const alias of aliases) {
    const value = map.get(cleanHeader(alias));
    if (value !== undefined) return value;
  }
  return '';
}

export function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g,'');
  if (digits.length === 10 && digits.startsWith('10')) digits = `0${digits}`;
  return digits;
}

export function normalizeCarrier(value) {
  const text = String(value ?? '').trim();
  const upper = text.toUpperCase().replace(/\s+/g,'');
  if (!upper) return '';
  if (upper.includes('알뜰') || upper.includes('MVNO') || /모바일|프리텔|스노우맨|스카이라이프|모빙|머천드/.test(text)) return '알뜰폰';
  if (upper.startsWith('SK') || upper.includes('SKT')) return 'SKT';
  if (upper.startsWith('KT') || upper.includes('케이티')) return 'KT';
  if (upper.startsWith('LG') || upper.includes('유플')) return 'LGU+';
  return '기타';
}

function validDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const text = String(value).trim();
  const compact = text.replace(/\D/g,'');
  let year, month, day;
  if (/^\d{8}$/.test(compact)) {
    year = Number(compact.slice(0,4)); month = Number(compact.slice(4,6)); day = Number(compact.slice(6,8));
  } else {
    const match = text.replace(/[./]/g,'-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return '';
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
  }
  if (!validDateParts(year, month, day)) return '';
  return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function normalizeBirthDate(value, now = new Date()) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  let compact = String(value).trim().replace(/\D/g,'');
  if (/^\d{5}$/.test(compact)) compact = compact.padStart(6,'0');
  let year, month, day;
  if (/^\d{6}$/.test(compact)) {
    const yy = Number(compact.slice(0,2));
    const pivot = now.getUTCFullYear() % 100;
    year = yy <= pivot ? 2000 + yy : 1900 + yy;
    month = Number(compact.slice(2,4));
    day = Number(compact.slice(4,6));
  } else if (/^\d{8}$/.test(compact)) {
    year = Number(compact.slice(0,4));
    month = Number(compact.slice(4,6));
    day = Number(compact.slice(6,8));
  } else {
    return '';
  }
  if (!validDateParts(year, month, day) || year > now.getUTCFullYear() || year < now.getUTCFullYear() - 120) return '';
  return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function normalizeInstallmentMonths(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^(현금개통|일시불|완납|현금)$/i.test(text.replace(/\s+/g,''))) return 0;
  const match = text.match(/(\d{1,3})/);
  if (!match) return null;
  const months = Number.parseInt(match[1], 10);
  return Number.isFinite(months) && months >= 0 && months <= 60 ? months : null;
}

export function normalizeImportRow(row) {
  const raw = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) raw[field] = valueForAliases(row, aliases);
  return {
    name: cellValue(raw.name).slice(0,80),
    phone: normalizePhone(raw.phone),
    opened_on: normalizeDate(raw.opened_on),
    birth_date: normalizeBirthDate(raw.birth_date),
    carrier: normalizeCarrier(raw.carrier),
    device_model: cellValue(raw.device_model).slice(0,120),
    rate_plan: cellValue(raw.rate_plan).slice(0,160),
    installment_months: normalizeInstallmentMonths(raw.installment_months),
    ad_sms_consent: cellValue(raw.ad_sms_consent),
    consent_at: normalizeDate(raw.consent_at),
    _source_row: row?.__sourceRow || null,
    _raw: raw
  };
}

function isSummaryBoundary(object) {
  return Object.values(object || {}).some(value => {
    const text = String(value ?? '').replace(/\s+/g,'').trim();
    return text === '총계' || text === '합계';
  });
}

export function classifyImportRows(objects, fileName = '') {
  const valid = [];
  const review = [];
  let ignored = 0;
  let summaryReached = false;

  for (const object of objects || []) {
    if (summaryReached) { ignored++; continue; }
    if (isSummaryBoundary(object)) { summaryReached = true; ignored++; continue; }

    const row = normalizeImportRow(object);
    const rawValues = Object.values(row._raw || {}).map(v => String(v ?? '').trim()).filter(Boolean);
    if (!rawValues.length) { ignored++; continue; }

    const name = row.name.trim();
    const rawName = String(row._raw?.name ?? '').trim();
    if (/^(총계|합계|수수료합계|최종수수료)$/i.test(rawName)) { ignored++; continue; }

    const reasons = [];
    if (!name) reasons.push('이름 없음');
    if (!row.phone || row.phone.length < 10 || row.phone.length > 11) reasons.push('전화번호 확인 필요');
    if (String(row._raw?.opened_on ?? '').trim() && !row.opened_on) reasons.push('개통일 형식 확인');
    if (String(row._raw?.birth_date ?? '').trim() && !row.birth_date) reasons.push('생년월일 형식 확인');
    const rawInstallment = String(row._raw?.installment_months ?? '').trim();
    if (rawInstallment && row.installment_months === null && !/중고/i.test(rawInstallment)) reasons.push('할부개월 확인');

    const item = { ...row, _file_name: fileName, _reasons: reasons };
    delete item._raw;
    if (reasons.length) review.push(item);
    else valid.push(item);
  }

  return { valid, review, ignored };
}

export function dedupeImportRows(rows) {
  const identityByPhone = new Map();
  const conflictPhones = new Set();
  const byContract = new Map();
  const allRowsByPhone = new Map();
  const planConflicts = new Set();
  const allRowsByContract = new Map();
  const planKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
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
      row.installment_months ?? '',
      row.service_type === 'sim' ? 'sim' : ''
    ].join('|');
    if (!allRowsByContract.has(contractKey)) allRowsByContract.set(contractKey, []);
    allRowsByContract.get(contractKey).push(row);
    const previous = byContract.get(contractKey);
    if (previous) {
      duplicates++;
      if (previous.rate_plan && row.rate_plan && planKey(previous.rate_plan) !== planKey(row.rate_plan)) planConflicts.add(contractKey);
      if (!previous.rate_plan && row.rate_plan) byContract.set(contractKey, { ...previous, rate_plan: row.rate_plan });
    } else byContract.set(contractKey, { ...row });
  }

  const conflicts = [];
  for (const phone of conflictPhones) {
    for (const row of allRowsByPhone.get(phone) || []) {
      conflicts.push({ ...row, _reasons:['같은 전화번호의 명의자 정보 충돌'] });
    }
  }
  for (const key of planConflicts) {
    for (const row of allRowsByContract.get(key)) {
      if (!conflictPhones.has(String(row.phone || ''))) conflicts.push({ ...row, _reasons: ['같은 계약의 요금제 정보 충돌'] });
    }
  }
  const kept = [...byContract.entries()].filter(([key, row]) => !planConflicts.has(key) && !conflictPhones.has(String(row.phone || ''))).map(([, row]) => row);
  return { rows: kept, conflicts, duplicates };
}

function monthKey(year, month) {
  return year * 12 + (month - 1);
}

function parseRangeMonth(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month, key: monthKey(year, month), label: `${year}.${String(month).padStart(2,'0')}` };
}

export function parseSalesMonthFromFileName(value) {
  const text = String(value || '');
  const base = text.split(/[\\/]/).pop() || text;
  if (!/판매일보/i.test(base)) return null;
  const match = base.match(/(?:^|[_\s-])(\d{2}|\d{4})년[_\s-]*(\d{1,2})월(?:[_\s.-]|판매일보|$)/i);
  if (!match) return null;
  let year = Number(match[1]);
  if (match[1].length === 2) year += 2000;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month, key: monthKey(year, month), label: `${year}.${String(month).padStart(2,'0')}` };
}

export function selectSalesFilesByRange(files, startValue='2019-07', endValue='2026-08') {
  const start = parseRangeMonth(startValue);
  const end = parseRangeMonth(endValue);
  if (!start || !end || start.key > end.key) throw new Error('가져오기 기간을 확인해 주세요.');

  const selectedByMonth = new Map();
  const duplicates = [];
  const outOfRange = [];
  const unmatched = [];

  for (const file of files || []) {
    const name = file?.name || String(file || '');
    if (!/\.(xlsx|xls|csv)$/i.test(name)) { unmatched.push(file); continue; }
    const parsed = parseSalesMonthFromFileName(name);
    if (!parsed) { unmatched.push(file); continue; }
    if (parsed.key < start.key || parsed.key > end.key) { outOfRange.push(file); continue; }

    const previous = selectedByMonth.get(parsed.key);
    if (!previous) {
      selectedByMonth.set(parsed.key, { file, parsed });
      continue;
    }

    const prevModified = Number(previous.file?.lastModified || 0);
    const nextModified = Number(file?.lastModified || 0);
    if (nextModified >= prevModified) {
      duplicates.push(previous.file);
      selectedByMonth.set(parsed.key, { file, parsed });
    } else {
      duplicates.push(file);
    }
  }

  const selectedEntries = [...selectedByMonth.values()].sort((a,b) => a.parsed.key - b.parsed.key);
  const missingMonths = [];
  for (let key = start.key; key <= end.key; key++) {
    if (selectedByMonth.has(key)) continue;
    const year = Math.floor(key / 12);
    const month = (key % 12) + 1;
    missingMonths.push(`${year}.${String(month).padStart(2,'0')}`);
  }

  return {
    files: selectedEntries.map(entry => entry.file),
    months: selectedEntries.map(entry => entry.parsed.label),
    start: start.label,
    end: end.label,
    expectedCount: end.key - start.key + 1,
    duplicates,
    outOfRange,
    unmatched,
    missingMonths
  };
}

export function formatPhone(value) {
  const digits = normalizePhone(value);
  return digits.length === 11 ? `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}` : digits;
}

export function formatInstallment(value) {
  if (value === 0) return '일시불';
  return Number.isFinite(Number(value)) ? `${Number(value)}개월` : '-';
}
