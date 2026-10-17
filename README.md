# 머니 (개인 재무 앱)

iPhone Safari용 정적 웹앱. 빌드 없음, 서버 없음. 데이터는 기기(localStorage)에 저장.

- `engine.js` 계산 엔진 (설계: ../design/03-데이터모델-계산원칙.md). 화면은 이 결과만 보여줌
- `app.js` 화면, `app.css` 디자인 기준 (../design/05-디자인방향.md)
- `sync.js` 구글 드라이브 동기화 자리 (OAuth 클라이언트 준비 후)
- `test/engine.test.js` 설계서 테스트 시나리오 9개 + 결정 규칙. `node test/engine.test.js`

로컬 실행: `python3 -m http.server` 후 http://localhost:8000
단축어 연결: `…/#/import?t=<복사한 글자>` 로 열면 캡처 가져오기 화면이 바로 열림
