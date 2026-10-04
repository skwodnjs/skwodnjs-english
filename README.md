# skwodnjs-english

Cloudflare Pages + Pages Functions + D1로 구성한 영어 공부용 웹사이트입니다.

현재는 단어장과 문장 목록을 같은 UI 패턴으로 관리합니다. 브라우저 `localStorage`에는 선택한 목록과 사이드바 접힘 상태 같은 UI 설정만 저장하고, 실제 학습 데이터는 Cloudflare D1에 저장합니다.

## 현재 기능

- ChatGPT 스타일의 좌측 사이드바
- 단어장 / 문장 섹션 분리
- 단어장과 문장 섹션 접기 / 펼치기
- 새 단어장 / 새 문장 생성
- 사이드바에서 목록 이름 수정
- 선택한 목록을 중앙 표 형태로 표시
- 단어 및 문장 수동 추가
- CSV 일괄 추가
- 검색
- 항목 수정 및 삭제
- 모바일 사이드바 대응
- Cloudflare D1 서버 저장

## 데이터 구조

현재 화면만을 위한 전용 스키마 대신 이후 기능 확장을 고려해 공통 구조로 설계했습니다.

- `collections`
  - 단어장, 문장 목록 등 학습 항목의 묶음
  - `kind`로 현재 `vocabulary`, `sentence`를 구분
  - `settings_json`으로 목록별 추가 설정을 확장 가능
- `study_items`
  - 단어, 문장 등 실제 학습 항목
  - 공통 필드: 본문, 뜻, 예문, 노트
  - `metadata_json`으로 향후 발음, 태그, 난이도, 복습 상태 등 추가 가능
- `app_settings`
  - 향후 서버 단위 설정용 key-value 저장소

`kind` 컬럼 자체에는 DB 수준의 고정 enum 제약을 두지 않았기 때문에 이후 숙어, 퀴즈, 오답노트 등 새로운 collection type을 추가할 때 기존 테이블을 다시 만들 필요가 없습니다.

## D1 생성 및 초기화

Cloudflare 계정에서 D1 데이터베이스를 하나 생성합니다.

CLI를 사용하는 경우:

```bash
npx wrangler@latest login
npx wrangler@latest d1 create skwodnjs-english
npx wrangler@latest d1 migrations apply skwodnjs-english --remote
```

첫 migration은 `migrations/0001_init.sql`에 있습니다. 기본 단어장, 기본 문장 목록과 예시 단어 3개도 함께 생성됩니다.

## Cloudflare Pages 설정

GitHub 저장소를 Cloudflare Pages에 연결합니다.

- Framework preset: `None`
- Build command: 비워 둠
- Build output directory: `/`

그 다음 Pages 프로젝트에서 D1 binding을 추가합니다.

1. `Workers & Pages`에서 이 Pages 프로젝트 선택
2. `Settings` → `Bindings`
3. `Add` → `D1 database binding`
4. Variable name을 정확히 `DB`로 입력
5. 위에서 만든 `skwodnjs-english` 데이터베이스 선택
6. 저장 후 다시 배포

백엔드는 `functions/api/[[path]].js`의 Pages Function으로 구현되어 있으며 `context.env.DB`를 사용합니다.

정적 파일 요청에 불필요하게 Function이 실행되지 않도록 `_routes.json`에서 `/api/*`만 Function 대상으로 제한했습니다.

## CSV 형식

단어장 권장 형식:

```csv
word,meaning,example
accomplish,"성취하다, 완수하다",She accomplished her goal.
remarkable,"주목할 만한, 놀라운",The result was remarkable.
```

문장 목록 권장 형식:

```csv
sentence,meaning,example
I'm looking forward to it.,기대하고 있어요.,I'm looking forward to seeing you again.
```

한글 헤더 `단어,뜻,예문`과 `문장,뜻,예문`도 인식합니다. 헤더가 없으면 1열=본문, 2열=뜻, 3열=예문으로 해석합니다.

## 로컬 개발

일반 `python -m http.server`로는 Pages Functions와 D1을 실행할 수 없습니다. D1을 포함한 전체 앱을 로컬에서 확인하려면 Wrangler의 Pages 개발 서버를 사용해야 합니다.

Cloudflare Pages 프로젝트에 연결된 D1 database ID를 확인한 뒤 다음처럼 실행할 수 있습니다.

```bash
npx wrangler@latest pages dev . --d1 DB=<DATABASE_ID>
```

로컬 DB에 migration을 적용하려면 Wrangler 설정 파일을 추가하거나 D1 로컬 개발 설정을 사용하면 됩니다.

## 주요 파일

```text
index.html
styles.css
app.js
_routes.json
functions/
  api/
    [[path]].js
migrations/
  0001_init.sql
```
