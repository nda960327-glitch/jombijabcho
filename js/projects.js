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
    id: "youtube",
    name: "좀비잡초 유튜브",
    icon: "🎬",
    status: "live",
    stage: 1,
    oneliner: "사업과 성찰의 과정을 기록하고 공유하는 채널. 성공이 아니라 과정을 보여준다.",
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
  },
  {
    id: "project-a",
    name: "사업 A (이름 미정)",
    icon: "🚀",
    status: "plan",
    stage: 0,
    oneliner: "여기에 한 줄 소개를 적으세요 — 무엇을, 누구를 위해, 왜 만드는가.",
    start: "미정",
    goal: "아이디어 검증: 잠재 고객 10명에게 물어보기",
    metrics: [
      { label: "매출", value: "0원" },
      { label: "고객", value: "0" }
    ],
    next: [
      "아이디어 한 문장으로 정리하기",
      "타겟 고객 정의하기"
    ],
    log: [
      { date: "2026.08.22", text: "프로젝트 슬롯 생성. 내용을 채워야 함." }
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
