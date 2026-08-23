// ============================================================
// 좀비잡초 글 데이터 — 여기에만 글을 추가하면 됩니다!
// ============================================================
// 새 글 쓰는 법: 아래 배열 맨 위에 { } 블록 하나를 복사해서 추가.
//   id      : 고유 번호 (겹치지만 않으면 됨)
//   cat     : business(사업일지) | reflection(자기성찰) | mindmap(마인드맵) | youtube(유튜브)
//   icon    : 목록 썸네일에 표시할 이모지
//   title   : 제목
//   excerpt : 목록에 보이는 요약 (한두 문장)
//   date    : 표시할 날짜
//   tags    : 해시태그 배열
//   project : (선택) 연결할 프로젝트 id — 해당 프로젝트 페이지의 "관련 기록"에 자동 표시됨
//   content : 본문. 간단 마크다운 지원:
//             ## 소제목 / **강조** / > 인용 / - 목록 / ![설명](이미지주소)
//             <로 시작하는 줄은 HTML 그대로 출력 (SVG 마인드맵 삽입 가능)
// ============================================================

const POSTS = [
  {
    id: "002",
    cat: "business",
    icon: "🌿",
    project: "secret-garden",
    title: "비밀의정원 운영 원칙을 다시 세우다 — 인건비, 영업시간, 그리고 10월의 전환",
    excerpt: "오프라인 칵테일바 운영의 기본 구조를 숫자로 못 박았다. 고정 인건비 상한, 10월부터의 성과 연동, 주 6일 영업 루틴. 결정은 기록해야 지켜진다.",
    date: "2026. 8. 22.",
    tags: ["비밀의정원", "운영", "결정"],
    content: `
여러 사업을 동시에 굴리다 보면 가장 먼저 흐려지는 게 **오프라인 매장의 기본 규칙**이다. 매일 돌아가는 곳이라 "알아서 되겠지"가 되기 쉽다. 오늘 비밀의정원의 운영 원칙을 다시 세우고 숫자로 못 박았다.

## 결정한 것

**1. 인건비 상한 — 월 600만원 이하**
가게 인건비(급여 총액)를 월 600만원 이하로 맞춘다. 바앱(바텐톡) 관련 비용도 이 안에 포함해서 관리한다. 매장 하나가 감당할 수 있는 고정비의 선을 먼저 그은 것.

**2. 10월부터 급여를 순이익의 10%로 전환**
고정 급여 구조에서 성과 연동 구조로 바꾼다. 가게가 잘 되면 같이 잘 되고, 어려우면 같이 버티는 구조. 10월 1일 시행 — 그날 다시 점검한다.

**3. 영업 루틴 — 화~일, 18:30 ~ 02:30**
주 6일 영업, 월요일 휴무 + 격주 일요일 휴무. 새벽 2시 라스트오더, 2시부터 마감 시작. "언제 열고 언제 닫는지"를 고정해야 직원도 손님도 나도 예측이 된다.

**4. 사장 출근 시간 고정 — 밤 9시~11시 (일요일은 8시~1시)**
매일 매장에 있는 대신, 현장을 보는 시간을 고정한다. 나머지 시간은 다른 프로젝트(우렁의사, 바텐톡, 5secore)에 쓴다.

## 왜 지금인가

> 결정은 머릿속에 있으면 매일 다시 고민하게 되고, 적어두면 한 번만 고민하면 된다.

프로젝트가 다섯 개다. 비밀의정원은 그중 유일한 오프라인 사업이고, 가장 많은 고정비가 나가는 곳이다. 여기의 규칙이 흔들리면 다른 프로젝트에 쓸 시간과 돈이 같이 흔들린다. 그래서 "매장은 이 규칙대로 돌아간다"를 먼저 고정해두고, 나는 그 위에서 움직이기로 했다.

## 다시 볼 날

- **10월 1일**: 급여 구조 전환 시행 — 인건비 600만 이하가 지켜지고 있는지 확인
- **9월 30일**: 영업시간·휴무·출근 루틴이 한 달 동안 유지됐는지 돌아보기

결정은 기록해야 지켜지고, 재검토일이 있어야 결정이 된다. 이 글은 그 첫 번째 기록이다.
`
  },
  {
    id: "001",
    cat: "mindmap",
    icon: "🧠",
    title: "좀비잡초 채널 설계 마인드맵",
    excerpt: "유튜브 채널 '좀비잡초'를 어떤 구조로 키워갈지, 머릿속 지도를 마인드맵으로 정리했다. 사업 · 성찰 · 기록 · 소통 네 갈래의 뿌리.",
    date: "2026. 8. 22.",
    tags: ["마인드맵", "채널설계", "시작"],
    content: `
유튜브 채널 **좀비잡초**를 시작하기 전에, 머릿속에 있는 그림을 마인드맵으로 먼저 정리했다. 아이디어가 많을수록 지도가 필요하다.

## 채널의 뿌리 구조

<div class="mindmap-wrap">
<svg viewBox="0 0 760 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="좀비잡초 채널 마인드맵">
  <defs><style>
    .mm-line { stroke: #263241; stroke-width: 2; fill: none; }
    .mm-line-accent { stroke: #4ade80; stroke-width: 2.5; fill: none; }
    .mm-center { fill: #14532d; stroke: #4ade80; stroke-width: 2; }
    .mm-node { fill: #1a232e; stroke: #263241; stroke-width: 1.5; }
    .mm-leaf { fill: #131a22; stroke: #263241; stroke-width: 1; }
    .mm-t-center { fill: #e6edf3; font: 900 20px "Noto Sans KR", sans-serif; }
    .mm-t-node { fill: #4ade80; font: 700 15px "Noto Sans KR", sans-serif; }
    .mm-t-leaf { fill: #94a3b3; font: 400 12.5px "Noto Sans KR", sans-serif; }
  </style></defs>
  <path class="mm-line-accent" d="M380,230 C300,230 280,110 210,95"/>
  <path class="mm-line-accent" d="M380,230 C300,230 280,350 210,365"/>
  <path class="mm-line-accent" d="M380,230 C460,230 480,110 550,95"/>
  <path class="mm-line-accent" d="M380,230 C460,230 480,350 550,365"/>
  <path class="mm-line" d="M150,80 C100,75 90,40 60,38"/>
  <path class="mm-line" d="M150,95 C100,100 90,130 60,132"/>
  <path class="mm-line" d="M150,350 C100,345 90,315 60,312"/>
  <path class="mm-line" d="M150,365 C100,370 90,400 60,402"/>
  <path class="mm-line" d="M610,80 C660,75 670,40 700,38"/>
  <path class="mm-line" d="M610,95 C660,100 670,130 700,132"/>
  <path class="mm-line" d="M610,350 C660,345 670,315 700,312"/>
  <path class="mm-line" d="M610,365 C660,370 670,400 700,402"/>
  <rect class="mm-center" x="290" y="195" width="180" height="70" rx="35"/>
  <text class="mm-t-center" x="380" y="238" text-anchor="middle">🌱 좀비잡초</text>
  <rect class="mm-node" x="120" y="70" width="110" height="44" rx="22"/>
  <text class="mm-t-node" x="175" y="97" text-anchor="middle">🚀 사업</text>
  <rect class="mm-node" x="120" y="342" width="110" height="44" rx="22"/>
  <text class="mm-t-node" x="175" y="369" text-anchor="middle">🪞 성찰</text>
  <rect class="mm-node" x="530" y="70" width="110" height="44" rx="22"/>
  <text class="mm-t-node" x="585" y="97" text-anchor="middle">📹 기록</text>
  <rect class="mm-node" x="530" y="342" width="110" height="44" rx="22"/>
  <text class="mm-t-node" x="585" y="369" text-anchor="middle">💬 소통</text>
  <rect class="mm-leaf" x="8" y="22" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="60" y="42" text-anchor="middle">앱 개발</text>
  <rect class="mm-leaf" x="8" y="118" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="60" y="138" text-anchor="middle">수익 모델</text>
  <rect class="mm-leaf" x="8" y="298" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="60" y="318" text-anchor="middle">회고 일기</text>
  <rect class="mm-leaf" x="8" y="388" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="60" y="408" text-anchor="middle">배운 것들</text>
  <rect class="mm-leaf" x="648" y="22" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="700" y="42" text-anchor="middle">유튜브 영상</text>
  <rect class="mm-leaf" x="648" y="118" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="700" y="138" text-anchor="middle">성장 지표</text>
  <rect class="mm-leaf" x="648" y="298" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="700" y="318" text-anchor="middle">댓글 · 피드백</text>
  <rect class="mm-leaf" x="648" y="388" width="104" height="30" rx="15"/>
  <text class="mm-t-leaf" x="700" y="408" text-anchor="middle">커뮤니티</text>
</svg>
<p class="mm-caption">좀비잡초 채널의 네 가지 뿌리 — 사업 · 성찰 · 기록 · 소통</p>
</div>

## 이 마인드맵의 의미

채널의 중심은 결국 하나다. **과정을 남기는 것.** 사업이 잘되든 안되든, 그 과정에서 배운 것과 느낀 것을 기록하고 공유하면 그 자체로 자산이 된다.

마인드맵은 계속 업데이트된다. 가지가 자라고, 어떤 가지는 시들 것이다. 그것도 전부 기록이다.
`
  }
];

const CATEGORY_LABEL = {
  business: "🚀 사업일지",
  reflection: "🪞 자기성찰",
  mindmap: "🧠 마인드맵",
  youtube: "▶ 유튜브"
};
