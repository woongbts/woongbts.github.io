import assert from 'node:assert/strict';
import {
  classifyImportRows, dedupeImportRows, detectBestTable, detectImportTables, normalizeBirthDate,
  normalizeCarrier, normalizeInstallmentMonths, normalizePhone, parseSalesMonthFromFileName,
  rowsToObjects, selectSalesFilesByRange
} from '../web/import-utils.js';

const mobilePrefix = ['0','10'].join('');
const restoredPhone = [mobilePrefix,'4580','6637'].join('');
const formattedPhone = [mobilePrefix,'-6759-','0318'].join('');
const normalizedFormattedPhone = [mobilePrefix,'6759','0318'].join('');
const sheetPhone = [mobilePrefix,'9311','5987'].join('');
const duplicatePhone = [mobilePrefix,'1111','2222'].join('');
const otherLinePhone = [mobilePrefix,'3333','4444'].join('');

assert.equal(normalizePhone('1045806637'), restoredPhone);
assert.equal(normalizePhone(formattedPhone), normalizedFormattedPhone);
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
  { name:'2월 유심', rows:[['구분','개통일','통신사','고객명','개통번호','생년월일','모델명','요금제'],['1','2026-02-01','SK','유심테스트','1012345678','900101','','유심 7GB']] },
  { name:'2월 무선', rows:[
    ['웅비통신 2월 판매일보'],
    ['구분','개통일','통신사','고객명','개통번호','생년월일','모델명','요금제','할부개월수'],
    ['1','2026-02-19','KT(에이딘)','테스트고객','1093115987','730305','SM-S931NK','5G 베이직','24개월'],
    ['총계','','','','','','',''],
    ['지급내역','','SK','','1012345678','','','']
  ] }
];
const detected = detectBestTable(sheets);
assert.equal(detected.sheetName, '2월 무선');
assert.equal(detected.headerIndex, 1);
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
assert.equal(simClassified.valid[0].rate_plan, '유심 7GB');

const objects = rowsToObjects(detected.rows, detected.headerIndex);
const classified = classifyImportRows(objects, 'sample.xlsx');
assert.equal(classified.valid.length, 1);
assert.equal(classified.valid[0].phone, sheetPhone);
assert.equal(classified.valid[0].installment_months, 24);
assert.equal(classified.valid[0].rate_plan, '5G 베이직');
assert.equal(classified.review.length, 0);
assert.equal(classified.ignored, 2);

const historyRows = dedupeImportRows([
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2024-01-01',carrier:'SKT',device_model:'MODEL-A',installment_months:24},
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'MODEL-B',installment_months:24}
]);
assert.equal(historyRows.rows.length, 2);
assert.equal(historyRows.duplicates, 0);

const wirelessAndSim = dedupeImportRows([
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'',installment_months:null,service_type:'wireless'},
  {name:'A',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01',carrier:'KT',device_model:'',installment_months:null,service_type:'sim'}
]);
assert.equal(wirelessAndSim.rows.length, 2);
assert.equal(wirelessAndSim.duplicates, 0);

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

const sameNameDifferentLines = dedupeImportRows([
  {name:'동일명의',phone:duplicatePhone,birth_date:'1980-01-01',opened_on:'2025-01-01'},
  {name:'동일명의',phone:otherLinePhone,birth_date:'1980-01-01',opened_on:'2025-02-01'}
]);
assert.equal(sameNameDifferentLines.rows.length, 2);
assert.equal(sameNameDifferentLines.duplicates, 0);

assert.deepEqual(parseSalesMonthFromFileName('웅비통신_19년_7월_판매일보.xlsx'), {year:2019,month:7,key:24234,label:'2019.07'});
assert.deepEqual(parseSalesMonthFromFileName('웅비통신_26년_8월_판매일보.xlsx'), {year:2026,month:8,key:24319,label:'2026.08'});
assert.equal(parseSalesMonthFromFileName('웅비통신_26년_9월_요금표.xlsx'), null);

const folderFiles = [
  {name:'웅비통신_19년_7월_판매일보.xlsx', lastModified:1},
  {name:'웅비통신_19년_8월_판매일보.xlsx', lastModified:1},
  {name:'웅비통신_19년_8월_판매일보.xlsx', lastModified:2},
  {name:'웅비통신_26년_8월_판매일보.xlsx', lastModified:1},
  {name:'웅비통신_26년_9월_판매일보.xlsx', lastModified:1},
  {name:'메모.xlsx', lastModified:1}
];
const folderSelection = selectSalesFilesByRange(folderFiles, '2019-07', '2026-08');
assert.equal(folderSelection.expectedCount, 86);
assert.equal(folderSelection.files.length, 3);
assert.equal(folderSelection.duplicates.length, 1);
assert.equal(folderSelection.outOfRange.length, 1);
assert.equal(folderSelection.unmatched.length, 1);
assert.equal(folderSelection.missingMonths.length, 83);
assert.equal(folderSelection.files[1].lastModified, 2);

console.log('import-utils tests passed');
