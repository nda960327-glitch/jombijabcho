// ============================================================
// 구글 시트 공용 로더 — 프로젝트 마스터 / 할일 / 업무일지 / 결정 / 아이디어 / 콘텐츠
// ============================================================
// 시트 '프로젝트' 탭 열 순서:
//   A 라벨(다른 탭 드롭다운과 동일, 예 "🧠 우렁의사") | B id(영문, URL용) | C 이름 | D 상태 | E 단계
//   F 한줄소개 | G 시작 | H 목표 | I 지표(" · "로 구분) | J 다음액션(줄바꿈 또는 " / "로 구분) | K 공개(Y/N)
// 상태: 진행중 | 준비중 | 씨앗 | 보류 | 완료     단계: 아이디어 | 검증 | MVP | 운영 | 확장
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
  const TAB_HEADER = { "프로젝트": "라벨", "할일": "할 일", "업무일지": "한 일", "결정": "결정", "아이디어": "아이디어", "콘텐츠": "제목/주제" };
  async function loadTab(tab) {
    try {
      const res = await fetch(csvUrl(tab), { cache: "no-store" });
      if (!res.ok) return null;
      const rows = parseCSV(await res.text());
      const key = TAB_HEADER[tab];
      if (key && !rows.slice(0, 8).some(r => r.some(c => (c || "").trim() === key))) return null; // 다른 탭이 반환됨
      return rows;
    } catch (e) { return null; }
  }

  const STATUS_KEY = { "진행중": "live", "준비중": "plan", "씨앗": "seed", "보류": "hold", "완료": "done" };
  const STAGE_NAMES = ["아이디어", "검증", "MVP", "운영", "확장"];
  const splitList = s => (s || "").split(/\n| \/ /).map(x => x.trim()).filter(Boolean);
  const emojiOf = label => { const m = (label || "").match(/^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/u); return m ? m[1] : "🌱"; };

  // 프로젝트 마스터: 시트 우선, 실패 시 projects.js의 PROJECTS 사용. 로그는 projects.js(id 기준)에서 병합.
  async function loadProjects() {
    const local = (typeof PROJECTS !== "undefined") ? PROJECTS : [];
    const rows = await loadTab("프로젝트");
    if (!rows) return { projects: local.map(p => ({ ...p, label: p.label || null, public: true })), source: "local" };
    const list = rows
      .filter(r => cell(r, 1) && cell(r, 2) && cell(r, 0) !== "라벨")   // 헤더/빈 행 제외
      .map(r => {
        const id = cell(r, 1);
        const loc = local.find(p => p.id === id);
        const stageIdx = STAGE_NAMES.indexOf(cell(r, 4));
        return {
          id, label: cell(r, 0), name: cell(r, 2), icon: emojiOf(cell(r, 0)),
          status: STATUS_KEY[cell(r, 3)] || "plan",
          stage: stageIdx >= 0 ? stageIdx : (/^\d$/.test(cell(r, 4)) ? +cell(r, 4) : 0),
          oneliner: cell(r, 5), start: cell(r, 6), goal: cell(r, 7),
          metrics: cell(r, 8).split("·").map(x => x.trim()).filter(Boolean).map(x => { const i = x.lastIndexOf(" "); return i > 0 ? { label: x.slice(0, i), value: x.slice(i + 1) } : { label: x, value: "" }; }),
          next: splitList(cell(r, 9)),
          public: !/^(n|no|아니오|비공개)$/i.test(cell(r, 10)),
          log: loc ? loc.log : []
        };
      });
    return { projects: list.length ? list : local, source: list.length ? "sheet" : "local" };
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

  return { SHEET_ID, csvUrl, parseCSV, parseDate, fmtDate, esc, cell, loadTab, loadProjects, matcher, STAGE_NAMES };
})();
