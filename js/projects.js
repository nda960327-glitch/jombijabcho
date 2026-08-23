// ============================================================
// 좀비잡초 프로젝트 트래킹 데이터
// ============================================================
// 프로젝트마다 이 파일에서만 관리합니다.
//
//   id      : URL에 쓰이는 고유 영문 아이디 (project.html?id=여기)
//   name    : 프로젝트 이름
//   icon    : 이모지
//   status  : live(진행 중) | plan(준비 중) | seed(씨앗) | hold(보류) | done(완료)
//   stage   : 현재 단계 0~4  →  0 아이디어 / 1 검증 / 2 MVP / 3 운영 / 4 확장
//   oneliner: 한 줄 소개 (무엇을, 누구를 위해, 왜)
//   start   : 시작 시기
//   goal    : 지금 이 프로젝트의 단 하나의 목표 (기한 포함 권장)
//   metrics : 추적할 핵심 숫자들 [{label, value}] — 업데이트할 때마다 값만 고치면 됨
//   next    : 다음에 할 일 목록 (위에서부터 우선순위)
//   log     : 활동 기록. 맨 위에 최신. {date, text} — 이게 쌓이는 게 곧 트래킹!
// ============================================================

const STAGES = ["아이디어", "검증", "MVP", "운영", "확장"];

const PROJECTS = [
  {
    id: "neurumind",
    name: "우렁의사 (느루마인드)",
    icon: "🧠",
    status: "live",
    stage: 3,
    oneliner: "CBT(인지행동치료) 기반 AI 심리상담 · 자기관리 앱. 24시간 곁에 있는 마음 관리 도구. — neurumind.com",
    start: "운영 중",
    goal: "사용자 확보 및 유지율 개선 (목표 수치 정하기)",
    metrics: [
      { label: "사용자", value: "-" },
      { label: "MAU", value: "-" },
      { label: "매출", value: "-" }
    ],
    next: [
      "핵심 지표 정하고 현재 값 기록하기",
      "이번 달 집중할 것 한 가지 정하기"
    ],
    log: [
      { date: "2026.08.22", text: "좀비잡초 트래킹 보드에 등록. 지표 정리부터 시작." }
    ]
  },
  {
    id: "batentalk",
    name: "바텐톡",
    icon: "🍸",
    status: "live",
    stage: 3,
    oneliner: "바텐더들의 익명 커뮤니티. 칵테일 레시피 · 원가 계산 · 채용 · 모임. — barapp.kr",
    start: "운영 중",
    goal: "활성 사용자 늘리기 (목표 수치 정하기)",
    metrics: [
      { label: "가입자", value: "-" },
      { label: "일 방문", value: "-" },
      { label: "게시글", value: "-" }
    ],
    next: [
      "핵심 지표 정하고 현재 값 기록하기",
      "바텐더 커뮤니티 홍보 채널 정하기"
    ],
    log: [
      { date: "2026.08.22", text: "좀비잡초 트래킹 보드에 등록." }
    ]
  },
  {
    id: "secret-garden",
    name: "Stay in 비밀의정원",
    icon: "🌿",
    status: "live",
    stage: 3,
    oneliner: "오프라인 칵테일바. 직접 운영하며 배우는 실전 사업의 현장.",
    start: "운영 중",
    goal: "10/1 운영 원칙 시행 (인건비 ≤600만 · 급여 순이익 연동 · 영업 루틴) → 11/1 점검",
    metrics: [
      { label: "월 인건비", value: "≤600만 목표" },
      { label: "월 매출", value: "-" },
      { label: "월 방문", value: "-" }
    ],
    next: [
      "가게 문제점 정리 → 개선 방향 도출",
      "9월 중 순이익 계산 기준 정하기 (10/1 급여 전환 준비)",
      "월 매출/방문 수 기록 시작하기"
    ],
    log: [
      { date: "2026.08.22", text: "운영 원칙 확정 (10/1 시행): 인건비 상한 월 600만, 급여 순이익 10% 연동, 영업 화~일 18:30~02:30, 사장 출근 시간 고정. 11/1 점검." },
      { date: "2026.08.22", text: "좀비잡초 트래킹 보드에 등록." }
    ]
  },
  {
    id: "5secore",
    name: "5secore",
    icon: "⚡",
    status: "plan",
    stage: 2,
    oneliner: "영어단어를 5초 만에 외우는 암기 앱. 학원가 배포로 시작한다.",
    start: "준비 중",
    goal: "학원가 첫 배포 — 파트너 학원 확보",
    metrics: [
      { label: "파트너 학원", value: "0" },
      { label: "사용 학생", value: "0" }
    ],
    next: [
      "배포용 앱 완성도 점검",
      "타겟 학원 리스트 만들기",
      "학원 제안용 소개 자료 만들기"
    ],
    log: [
      { date: "2026.08.22", text: "좀비잡초 트래킹 보드에 등록. 학원가 배포 전략 수립 단계." }
    ]
  },
  {
    id: "youtube",
    name: "좀비잡초 유튜브",
    icon: "🎬",
    status: "live",
    stage: 1,
    oneliner: "위의 모든 사업을 트래킹하고 자아성찰하는 채널. 성공이 아니라 과정을 보여준다.",
    start: "2026.08",
    goal: "첫 영상 업로드 → 구독자 100명 (2026년 내)",
    metrics: [
      { label: "구독자", value: "0" },
      { label: "업로드 영상", value: "0" },
      { label: "총 조회수", value: "0" }
    ],
    next: [
      "첫 영상 기획: 채널 소개 + 왜 시작하는가",
      "촬영 · 편집 환경 세팅",
      "업로드 루틴 정하기 (주 1회 등)"
    ],
    log: [
      { date: "2026.08.22", text: "채널 개설 (@jombijabcho), 홈페이지 오픈. 기록 시작." }
    ]
  }
];

const STATUS_LABEL = {
  live: { text: "진행 중", cls: "badge-live" },
  plan: { text: "준비 중", cls: "badge-plan" },
  seed: { text: "씨앗", cls: "badge-seed" },
  hold: { text: "보류", cls: "badge-seed" },
  done: { text: "완료", cls: "badge-live" }
};
