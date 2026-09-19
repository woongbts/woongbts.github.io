import assert from 'node:assert/strict';
import {
  classifyImportRows, dedupeImportRows, detectBestTable, normalizeBirthDate,
  normalizeCarrier, normalizeInstallmentMonths, normalizePhone, rowsToObjects
} from '../web/import-utils.js';

assert.equal(normalizePhone('1045806637'), '01045806637');
assert.equal(normalizePhone('010-6759-0318'), '01067590318');
assert.equal(normalizeBirthDate('861005', new Date('2026-09-19T00:00:00Z')), '1986-10-05');
assert.equal(normalizeBirthDate('190318', new Date('2026-09-19T00:00:00Z')), '2019-03-18');
assert.equal(normalizeCarrier('SK(PS)'), 'SKT');
assert.equal(normalizeCarrier('KT(에이딘)'), 'KT');
assert.equal(normalizeCarrier('LG(북부산)'), 'LGU+');
assert.equal(normalizeCarrier('KT엠모바일(민텔)'), '알뜰폰');
assert.equal(normalizeInstallmentMonths('24개월'), 24);
assert.equal(normalizeInstallmentMonths('현금개통'), 0);
assert.equal(normalizeInstallmentMonths('중고'), null);

const sheets = [
  { name:'2월 유심', rows:[['구분','개통일','통신사','고객명','개통번호','생년월일','모델명'],['1','2026-02-01','SK','유심고객','1012345678','900101','']] },
  { name:'2월 무선', rows:[['웅비통신 2월 판매일보'],['구분','개통일','통신사','고객명','개통번호','생년월일','모델명','할부개월수'],['1','2026-02-19','KT(에이딘)','홍길동','1093115987','730305','SM-S931NK','24개월'],['총계','','','','','','','']] }
];
const detected = detectBestTable(sheets);
assert.equal(detected.sheetName, '2월 무선');
assert.equal(detected.headerIndex, 1);

const objects = rowsToObjects(detected.rows, detected.headerIndex);
const classified = classifyImportRows(objects, 'sample.xlsx');
assert.equal(classified.valid.length, 1);
assert.equal(classified.valid[0].phone, '01093115987');
assert.equal(classified.valid[0].installment_months, 24);
assert.equal(classified.ignored, 1);

const d = dedupeImportRows([
  {name:'A',phone:'01011112222',birth_date:'1980-01-01',opened_on:'2024-01-01'},
  {name:'A',phone:'01011112222',birth_date:'1980-01-01',opened_on:'2025-01-01'}
]);
assert.equal(d.rows.length, 1);
assert.equal(d.rows[0].opened_on, '2025-01-01');
assert.equal(d.duplicates, 1);

console.log('import-utils tests passed');
