# myhome — THE WEEKLY Times

project27.kr 에 올라가는 나의 주간 플래너 (단일 페이지, GitHub Pages).
mindinside.kr/blog/ops '운영팀 플래너' 화면을 그대로 옮겨 왔다 (hongcbt `opsplanner.js` · `opscal.js`).

- `index.html` / `css/style.css` — 플래너 화면·스타일 (운영본 그대로 + 동기화 창)
- `js/planner.js` — 플래너 화면 코드 (운영본 그대로, 서버 대신 `MI.get/MI.post` 를 부름)
- `js/app.js` — 그 서버(`/admin/opscal…`)를 브라우저 안에서 흉내 내는 로컬 창구 + 저장·동기화
- 저장: localStorage `myhome.v1` + 구글 Apps Script(`tools/apps-script.gs`, PIN). 시트 `MY_설정` 탭의 `json:ops`, `json:ops_0…` 칸
  - 항목은 3만 자씩 나눠 `ops_0`, `ops_1` … 에 담는다 (서버가 4만 자 넘는 칸을 다시 못 읽기 때문)
  - 예전 대시보드 데이터(todos·goals·assets·diary·stickers…)는 화면에서만 뺐고, 저장할 때 그대로 같이 보낸다
- 미리보기: `node .claude/serve.js` → http://localhost:8788
