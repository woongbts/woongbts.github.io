# 웅비렌탈 운영 원본

웅비렌탈의 **유일한 운영 원본(Source of Truth)** 은 이 저장소의 `main/rental/` 입니다.

- 운영 URL: https://woongbts.github.io/rental/
- 운영 저장소: `woongbts/woongbts.github.io`
- 운영 경로: `rental/`
- 기존 저장소 `woongbts/woongbirental` 은 레거시 보관용이며 운영 파일을 수정하는 원본으로 사용하지 않습니다.
- 상품/요금/사은품 수정은 반드시 이 저장소 `main` 최신 HEAD를 먼저 확인한 뒤 반영합니다.
- 데이터 검증: `.github/workflows/rental-data-quality.yml`
- 모바일 검증: `.github/workflows/rental-mobile-smoke.yml`

## 고객 화면 원칙

내부 수수료율·판매점 수익·정산 구조는 고객 화면에 표시하지 않습니다. 고객에게는 월 렌탈료와 고객사은품, 계약 조건, 기준월 및 최종 확인 안내만 표시합니다.
