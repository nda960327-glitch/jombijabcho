// ============================================================
// 구글 시트 공용 로더 — 프로젝트 마스터 / 할일 / 업무일지 / 결정 / 아이디어 / 콘텐츠
// ============================================================
// 시트 '프로젝트' 탭 열 순서 (단순화 버전):
//   A 라벨(이모지+이름, 다른 탭과 동일하게) | B 상태 | C 단계 | D 지금 목표 | E 한줄소개
//   F 지표(자유 형식: "구독자 0, 영상 0") | G 시작 | H 공개(Y/N) | I id(비우면 라벨에서 자동)
// 상태: 진행중 | 준비중 | 씨앗 | 보류 | 완료 (비슷한 말도 인식)   단계: 아이디어 | 검증 | MVP | 운영 | 확장 (또는 0~4)
// 다음 액션은 '할일' 탭의 해당 프로젝트 ⭐/높음 항목에서 자동으로 가져옵니다.
// ============================================================
const SHEET = (() => {
  const SHEET_ID = "1IW65a8-4D4nkGQfbNSrVRZQYRV4128iRTYtK0d7FJi4";
  // headers=1: gviz가 여러 행을 헤더로 합쳐버리는 자동 감지를 끄고 1행만 헤더로 고정
  const csvUrl = tab => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}&_=${Date.now()}`;

  function parseCSV(text) {
    const rows = []; let row = [], cur = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
      else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ""; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ""; if (row.some(v => v.trim())) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some(v => v.trim())) rows.push(row);
    return rows;
  }

  // 날짜 파서: 2026-08-22 / 2026.08.22 / 2026. 8. 22 / 26-08-22 / 8/22/2026 모두 허용
  function parseDate(s) {
    s = (s || "").trim(); if (!s) return null;
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);                   // m/d/yyyy (gviz 기본 로케일)
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    m = s.match(/(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})/);                   // y-m-d (2자리/4자리 연도)
    if (!m) return null;
    const y = +m[1] < 100 ? 2000 + +m[1] : +m[1];
    const d = new Date(y, +m[2] - 1, +m[3]);
    return isNaN(d) ? null : d;
  }
  const fmtDate = d => d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}` : "";
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cell = (r, i) => (r[i] || "").trim();

  // 탭별 헤더 식별자 — gviz는 없는 탭 이름을 요청하면 첫 탭을 돌려주므로, 헤더로 진짜 그 탭인지 검증
  const TAB_HEADER = { "프로젝트": "라벨", "할일": "할 일", "업무일지": "한 일", "결정": "결정", "아이디어": "아이디어", "콘텐츠": "제목/주제", "루틴": "항목" };
  async function loadTab(tab) {
    try {
      const res = await fetch(csvUrl(tab), { cache: "no-store" });
      if (!res.ok) return null;
      const rows = parseCSV(await res.text());
      const key = TAB_HEADER[tab];
      if (key && !rows.slice(0, 8).some(r => r.some(c => (c || "").trim().startsWith(key)))) return null; // 다른 탭이 반환됨
      return rows;
    } catch (e) { return null; }
  }

  const STAGE_NAMES = ["아이디어", "검증", "MVP", "운영", "확장"];
  const EMOJI_RE = /^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;
  const emojiOf = label => { const m = (label || "").match(EMOJI_RE); return m ? m[1] : "🌱"; };
  const nameOf = label => (label || "").replace(EMOJI_RE, "").trim();
  // 관대한 해석기들 — 비슷한 말이면 다 인식
  function statusOf(s) {
    s = (s || "").toLowerCase();
    if (/완료|끝|done|종료/.test(s)) return "done";
    if (/보류|중단|hold|pause|멈/.test(s)) return "hold";
    if (/씨앗|아이디어|seed|구상/.test(s)) return "seed";
    if (/준비|예정|plan|계획|검토/.test(s)) return "plan";
    if (/진행|운영|live|active|ing|중/.test(s)) return "live";
    return "plan";
  }
  function stageOf(s) {
    s = (s || "").trim();
    if (/^\d$/.test(s)) return Math.min(4, +s);
    const i = STAGE_NAMES.findIndex(n => s.includes(n) || s.toUpperCase().includes(n.toUpperCase()));
    if (i >= 0) return i;
    if (/아이디어|구상/.test(s)) return 0; if (/검증|테스트|실험/.test(s)) return 1;
    if (/개발|제작|베타|mvp/i.test(s)) return 2; if (/운영|오픈|출시|런칭/.test(s)) return 3; if (/확장|성장|스케일/.test(s)) return 4;
    return 0;
  }
  const publicOf = s => !/^(n|no|x|아니오|아니요|비공개|숨김|false)$/i.test((s || "").trim());
  // 지표: "구독자 0, 영상 0" / "구독자: 0 / 영상=0" / "구독자 0 · 영상 0" 전부 허용
  function metricsOf(s) {
    return (s || "").split(/[,·\/;\n]+/).map(x => x.trim()).filter(Boolean).map(x => {
      let m = x.match(/^(.*?)\s*[:=]\s*(.+)$/);
      if (m) return { label: m[1].trim(), value: m[2].trim() };
      const i = x.lastIndexOf(" ");
      return i > 0 ? { label: x.slice(0, i).trim(), value: x.slice(i + 1).trim() } : { label: x, value: "" };
    });
  }
  const slug = s => nameOf(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "p";

  // 프로젝트 마스터: 시트 우선, 실패 시 projects.js의 PROJECTS 사용. 로그는 projects.js(id 기준)에서 병합.
  async function loadProjects(prefetchedRows) {
    const local = (typeof PROJECTS !== "undefined") ? PROJECTS : [];
    const rows = prefetchedRows !== undefined ? prefetchedRows : await loadTab("프로젝트");
    if (!rows) return { projects: local.map(p => ({ ...p, label: p.label || null, public: true })), source: "local" };
    const list = rows
      .filter(r => cell(r, 0) && !cell(r, 0).startsWith("라벨") && !cell(r, 0).startsWith("(예시)"))   // 헤더/예시/빈 행 제외
      .map(r => {
        const label = cell(r, 0);
        const id = cell(r, 8) || slug(label);
        const loc = local.find(p => p.id === id);
        return {
          id, label, name: nameOf(label), icon: emojiOf(label),
          status: statusOf(cell(r, 1)), stage: stageOf(cell(r, 2)),
          goal: cell(r, 3), oneliner: cell(r, 4), metrics: metricsOf(cell(r, 5)),
          start: cell(r, 6), public: publicOf(cell(r, 7)),
          next: loc ? (loc.next || []) : [],   // 시트에는 다음액션 열이 없음 — 할일 탭 ⭐에서 파생 (project.js/board.js)
          log: loc ? loc.log : []
        };
      });
    return { projects: list.length ? list : local, source: list.length ? "sheet" : "local" };
  }

  // '할일' 탭 행 → 구조화 (A등록일 B프로젝트 C할일 D마감 E이번주 F상태 G우선순위 H메모 I담당 J완료일)
  function parseTasks(rows, idOf) {
    return (rows || [])
      .filter(r => cell(r, 2) && ["할일", "진행중", "완료", "보류"].includes(cell(r, 5)) && !cell(r, 2).startsWith("(예시)"))
      .map(r => ({ reg: parseDate(r[0]), prj: cell(r, 1), text: cell(r, 2), due: parseDate(r[3]), star: cell(r, 4).includes("⭐"),
                   status: cell(r, 5), pri: cell(r, 6), memo: cell(r, 7), who: cell(r, 8), doneAt: parseDate(r[9]), pid: idOf ? idOf(cell(r, 1)) : null }));
  }

  // 프로젝트 라벨 → id 매핑 도우미 (라벨 정확 일치 → 이름 포함 순)
  function matcher(projects) {
    return label => {
      const L = (label || "").trim();
      if (!L) return null;
      let p = projects.find(p => p.label && p.label === L);
      if (!p) { const t = L.replace(/^\s*\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*\s*/u, "");
        p = projects.find(p => t && (p.name.includes(t) || t.includes(p.name.split(" ")[0]))); }
      return p ? p.id : null;
    };
  }

  return { SHEET_ID, csvUrl, parseCSV, parseDate, fmtDate, esc, cell, loadTab, loadProjects, parseTasks, matcher, STAGE_NAMES };
})();
