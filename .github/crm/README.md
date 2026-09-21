# 웅비통신 고객 CRM (비공개 관리자 시스템)

이 디렉터리는 공개 GitHub Pages와 분리해서 배포하는 Cloudflare Worker + D1 기반 CRM 소스다.

## 보안 원칙

- 실제 고객 엑셀/CSV, 고객 이름/전화번호, API 키, 암호화 키를 GitHub에 커밋하지 않는다.
- GitHub Pages에 고객 데이터나 관리자 API를 저장하지 않는다.
- 실서비스는 Cloudflare Access로 관리자 URL 자체를 보호한 뒤 사용한다.
- 이름/전화번호/기기/메모/동의 증빙은 AES-GCM으로 암호화한다.
- 전화번호 중복 검색은 별도의 HMAC-SHA256 키로 생성한 값만 DB에 저장한다.
- 암호화 키와 HMAC 키는 서로 다른 32-byte secret을 사용하고 Cloudflare Secret에만 넣는다.
- 엑셀 원본은 브라우저에서 읽고 정규화한 행만 API로 보낸다. 원본 파일 자체를 서버에 저장하지 않는다.
- SMS 발송은 기본값이 `dry_run`이다. 공급자 연결과 수신동의 정책 검증 전에는 실발송하지 않는다.

## 1차 기능

- Excel(.xls/.xlsx)/CSV 가져오기 및 헤더 자동 매핑
- 이름/전화번호 암호화 저장
- 통신사, 개통일, 할부개월수, 기기명 관리
- 같은 전화번호의 과거 개통을 `customer_contracts` 계약 이력으로 보존
- 광고성 문자 수신동의 상태 및 증빙 기록
- 22~30개월 경과 고객 자동 필터
- 수신동의 고객만 캠페인 대상 산정
- 발송 전 대상수/차단수 미리보기
- 감사로그
- 실문자 발송 어댑터는 계정 연결 후 추가

## 배포 전 필요한 Cloudflare 설정

1. D1 데이터베이스 `woongbi-crm` 생성
2. `migrations/0001_init.sql` 적용
3. `wrangler.toml.example`을 기반으로 실 배포 설정 생성
4. Cloudflare Access로 CRM 도메인을 허용된 관리자 계정만 접근하게 설정
5. 아래 Secret 설정
   - `CRM_DATA_KEY_B64`
   - `CRM_HMAC_KEY_B64`
   - `CF_ACCESS_TEAM_DOMAIN`
   - `CF_ACCESS_AUD`
6. `ALLOWED_ADMIN_EMAILS`에 관리자 이메일 설정
7. `npm install && npm run build && npx wrangler deploy`

키 생성 예시(결과를 채팅이나 GitHub에 붙여넣지 말 것):

```bash
openssl rand -base64 32
openssl rand -base64 32
```

## Excel 권장 열

다음 이름은 자동 인식한다. 순서가 달라도 된다.

- 이름 / 고객명
- 연락처 / 휴대폰 / 전화번호
- 통신사
- 기종 / 사용기종 / 단말기
- 개통일 / 가입일
- 할부개월수 / 할부개월 / 할부기간
- 광고수신동의 / 문자수신동의
- 동의일

주민등록번호, 신분증 이미지, 계좌번호, 카드번호는 이 CRM에 넣지 않는다.


## OneDrive 직접 가져오기 설정

CRM은 Microsoft Graph의 최소 위임 권한 `Files.Read`만 사용해 개인 OneDrive의 `웅비통신/웅비통신 판매일보` 폴더를 브라우저에서 직접 읽는다. 원본 Excel과 Microsoft 액세스 토큰은 Worker/D1/GitHub로 전송하지 않는다.

1. Microsoft Entra 관리센터에서 새 앱 등록
2. 지원 계정 유형에 개인 Microsoft 계정을 포함
3. Authentication > Single-page application(SPA)에 `https://woongbi-crm.woongbts.workers.dev/` 등록
4. Microsoft Graph Delegated permission `Files.Read`만 추가 (`Files.ReadWrite` 불필요)
5. Application (client) ID를 CRM의 최초 1회 설정에 입력
6. CRM에서 Microsoft 계정 연결 후 기간을 선택하고 판매일보를 분석

Client ID는 공개 식별자라 브라우저 localStorage에 저장할 수 있지만, 액세스 토큰은 MSAL의 sessionStorage에만 두고 장기 저장하지 않는다.
