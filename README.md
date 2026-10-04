# skwodnjs-english

Cloudflare Workers + D1 기반 영어 공부용 웹사이트입니다.

## 현재 기능

- ChatGPT 스타일 좌측 사이드바
- `새로 만들기`에서 단어장/문장 선택
- 단어장과 문장 목록 각각 접기/펼치기
- 사이드바에서 목록 이름 수정
- 단어/문장을 표 형태로 표시
- 수동 추가 및 CSV 일괄 추가
- 검색, 수정, 삭제
- 모바일 UI 대응
- Cloudflare D1 서버 저장

## 구조

```text
Browser
  -> Cloudflare Worker (worker.js)
      -> static assets (index.html, styles.css, app.js)
      -> /api/*
          -> D1 binding: DB
```

`worker.js`가 정적 파일과 API를 같은 Worker에서 처리합니다. `wrangler.jsonc`의 `assets.run_worker_first`가 `/api`와 `/api/*` 요청을 Worker 코드로 먼저 보냅니다.

## D1 스키마

`migrations/0001_init.sql`에 초기 스키마가 있습니다.

- `collections`: 단어장, 문장 및 향후 추가될 학습 목록
- `study_items`: 목록에 속하는 공통 학습 항목
- `app_settings`: 앱 설정 확장용

`collections.kind`, `study_items.item_type`, `settings_json`, `metadata_json`을 이용해 숙어, 퀴즈, 오답노트, 복습 상태 등으로 확장할 수 있도록 구성했습니다.

## D1 초기 설정

원격 D1 데이터베이스 생성:

```bash
npx wrangler@latest login
npx wrangler@latest d1 create skwodnjs-english
npx wrangler@latest d1 migrations apply skwodnjs-english --remote
```

이미 데이터베이스를 만들었다면 다시 만들 필요가 없습니다.

### Worker에 D1 연결

현재 `wrangler.jsonc`는 Worker/API 라우팅과 정적 assets만 정의합니다. 기존에 생성한 D1을 Worker에 `DB`라는 이름으로 바인딩해야 합니다.

Cloudflare Dashboard에서:

```text
Workers & Pages
-> skwodnjs-english
-> Bindings
-> Add binding
-> D1 database
```

다음처럼 설정합니다.

```text
Variable name: DB
Database: skwodnjs-english
```

또는 `npx wrangler d1 info skwodnjs-english`로 database ID를 확인한 뒤 `wrangler.jsonc`에 D1 binding을 명시할 수 있습니다.

## 배포

이 프로젝트는 Cloudflare **Worker** 프로젝트를 기준으로 합니다. 기본 Workers Builds 배포 명령인 아래 명령을 사용할 수 있습니다.

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
