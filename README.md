# skwodnjs-english

Cloudflare Workers + D1 기반 영어 공부용 웹사이트입니다.

## 현재 기능

- ChatGPT 스타일 좌측 사이드바
- `새로 만들기`에서 단어장/문장 선택
- 단어장과 문장 목록 각각 접기/펼치기
- 단어/문장을 표 형태로 표시
- 수동 추가 및 CSV 일괄 추가
- 검색, 수정, 삭제
- 비밀번호 기반 수정 권한
- 로그인/로그아웃 및 비밀번호 변경
- 모바일 UI 대응
- Cloudflare D1 서버 저장

읽기는 공개되어 있고 생성, 이름 변경, 항목 추가, 수정, 삭제는 로그인된 세션만 수행할 수 있습니다. 초기 비밀번호는 `1234`이며 배포 후 바로 변경하는 것을 권장합니다.

## 구조

```text
Browser
  -> Cloudflare Worker (worker.js)
      -> static assets (index.html, styles.css, app.js)
      -> /api/*
          -> D1 binding: DB
```

`worker.js`가 정적 파일과 API를 같은 Worker에서 처리합니다. `wrangler.jsonc`의 `assets.run_worker_first`가 `/api`와 `/api/*` 요청을 Worker 코드로 먼저 보냅니다.

## 인증

사용자 계정 시스템은 사용하지 않습니다. 하나의 관리 비밀번호로 수정 권한을 제어합니다.

- 초기 비밀번호: `1234`
- 비밀번호는 PBKDF2-SHA256 해시 형태로 D1 `app_settings`에 저장
- 로그인 성공 시 임의 세션 토큰을 발급
- 브라우저에는 `HttpOnly`, `SameSite=Lax` 쿠키로 세션 저장
- D1에는 세션 토큰 원문이 아니라 SHA-256 해시만 저장
- 세션 유효기간: 30일
- 비밀번호 변경 시 기존 세션을 모두 폐기하고 현재 브라우저에 새 세션을 발급
- 비로그인 상태의 POST/PATCH/PUT/DELETE API 요청은 서버에서 401로 거부

인증 스키마는 `migrations/0002_auth.sql`에 있으며 Worker도 배포 시 필요한 인증 테이블과 초기 설정이 없으면 자동 생성합니다.

## D1 스키마

- `collections`: 단어장, 문장 및 향후 추가될 학습 목록
- `study_items`: 목록에 속하는 공통 학습 항목
- `app_settings`: 앱 설정 및 비밀번호 해시
- `auth_sessions`: 로그인 세션

`collections.kind`, `study_items.item_type`, `settings_json`, `metadata_json`을 이용해 숙어, 퀴즈, 오답노트, 복습 상태 등으로 확장할 수 있도록 구성했습니다.

## D1 초기 설정

원격 D1 데이터베이스 생성 및 migration 적용:

```bash
npx wrangler@latest login
npx wrangler@latest d1 create skwodnjs-english
npx wrangler@latest d1 migrations apply skwodnjs-english --remote
```

이미 데이터베이스를 만들었다면 다시 만들 필요가 없습니다. 새 migration이 추가된 경우 같은 `migrations apply` 명령을 다시 실행하면 아직 적용되지 않은 migration만 적용됩니다.

현재 `wrangler.jsonc`에는 다음 D1이 `DB` binding으로 등록되어 있습니다.

```text
Database: skwodnjs-english
Binding: DB
```

## 배포

이 프로젝트는 Cloudflare Worker 프로젝트를 기준으로 합니다.

```bash
npx wrangler deploy
```

GitHub repository가 Worker에 연결되어 있고 Deploy command가 `npx wrangler deploy`라면 `main`에 push될 때 자동 배포됩니다.

## CSV 형식

단어장:

```csv
word,meaning,example
accomplish,"성취하다, 완수하다",She accomplished her goal.
```

문장:

```csv
sentence,meaning,example
How have you been?,잘 지냈어?,How have you been since graduation?
```

한글 헤더(`단어,뜻,예문`, `문장,뜻,예문`)도 인식합니다. 헤더가 없으면 1열=내용, 2열=뜻, 3열=예문으로 해석합니다.