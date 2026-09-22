// Activation requires owner-approved text, retention and evidence disposal policy.
export const CONSENT_POLICY = Object.freeze({
  version: 'WB-CONSENT-20260922-DRAFT',
  approved: false,
  retentionYears: 3,
  operator: '웅비통신 덕천만덕점',
  title: '고객관리 알림 선택 신청',
  purpose: '약정·요금할인 종료 시점 안내, 통신비·결합할인 점검, 기기변경 및 매장 혜택·프로모션 안내',
  items: '성명, 휴대전화번호, 가입 통신사, 개통일 및 최근 거래일',
  retention: '동의일로부터 3년 또는 동의 철회 시까지 중 먼저 도래하는 때',
  refusal: '모두 선택 사항입니다. 동의하지 않아도 개통·A/S·기본 상담 이용에는 제한이 없습니다.',
  withdrawal: '매장 방문 또는 대표전화 051-343-7677로 동의 철회를 요청할 수 있습니다. 접수·본인 확인·처리 절차는 운영자 최종 확인 전입니다.',
  advertising: '통신상품, 요금·결합 혜택, 기기변경, 매장 행사 및 프로모션 정보를 선택한 채널로 안내합니다.',
  channels: { ad_sms: '문자(SMS/MMS)', ad_kakao: '카카오톡', ad_call: '전화' },
  pending: ['최종 동의 문구', '만료 시 개인정보 파기 절차', '동의 증빙 보존기간 및 파기 절차', '철회 접수 연락처와 처리 절차', '미성년자·대리인 동의 절차']
});
