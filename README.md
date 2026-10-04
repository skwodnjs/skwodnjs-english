# skwodnjs-english

영어 공부용 웹사이트입니다. 현재는 단어장 기능을 우선 구현하고 있습니다.

## 현재 기능

- ChatGPT 스타일의 좌측 단어장 사이드바
- 단어장 생성
- 단어장 이름 수정
- 선택한 단어장을 중앙 표 형태로 표시
- 단어 수동 추가
- CSV 파일 일괄 추가
- 단어 검색
- 단어 수정 및 삭제
- 모바일 사이드바 대응
- 브라우저 `localStorage` 자동 저장

## CSV 형식

권장 형식:

```csv
word,meaning,example
accomplish,"성취하다, 완수하다",She accomplished her goal.
remarkable,"주목할 만한, 놀라운",The result was remarkable.
```

다음 한글 헤더도 인식합니다.

```csv
단어,뜻,예문
```

헤더가 없으면 다음 순서로 해석합니다.

1. 단어
2. 뜻
3. 예문

단어와 뜻은 필수이며 예문은 선택입니다. CSV 필드 내부의 쉼표, 큰따옴표, 줄바꿈도 처리합니다.

## 로컬 실행

정적 사이트이므로 별도의 빌드 과정은 필요하지 않습니다. 간단한 로컬 HTTP 서버를 실행하면 됩니다.

```bash
python -m http.server 8000
```

그 후 `http://localhost:8000`으로 접속합니다.

## Cloudflare Pages 배포

이 저장소는 빌드 과정이 없는 정적 사이트입니다.

Cloudflare Pages에서 GitHub 저장소를 연결한 뒤 다음처럼 설정합니다.

- Framework preset: `None`
- Build command: 비워 둠
- Build output directory: `/`

현재 데이터는 브라우저의 `localStorage`에 저장됩니다. 따라서 같은 사용자가 다른 브라우저나 기기에서 접속하면 데이터가 자동 동기화되지는 않습니다.

## 다음 단계

사용자 계정과 기기 간 동기화가 필요해지면 Cloudflare Workers + D1 기반 저장소로 이전할 예정입니다. UI와 데이터 접근 로직을 분리하여 현재 화면 구조를 유지한 채 백엔드만 교체할 수 있습니다.
