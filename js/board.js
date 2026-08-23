// ===== 개인 보드: 구글 시트(할일 + 업무일지) + projects.js 통합 뷰 =====
(function () {
  const SHEET_ID = "1IW65a8-4D4nkGQfbNSrVRZQYRV4128iRTYtK0d7FJi4";
  const csvUrl = tab => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_=${Date.now()}`;

  // 시트의 프로젝트 라벨 → projects.js id 매핑 (라벨에 이 단어가 포함되면 매칭)
  const PRJ_MATCH = [
    ["우렁의사", "neurumind"], ["바텐톡", "batentalk"], ["비밀의정원", "secret-garden"],
    ["5secore", "5secore"], ["유튜브", "youtube"]
  ];
  const prjIdOf = label => { const m = PRJ_MATCH.find(([k]) => (label || "").includes(k)); return m ? m[1] : null; };

  // --- CSV 파서 ---
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

  // --- 날짜 유틸 (다양한 표기 허용: 2026-08-22 / 2026.08.22 / 2026. 8. 22) ---
  const today = new Date(); today.setHours(0, 0, 0, 0);
  function parseDate(s) {
    const m = (s || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  const fmt = d => d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}` : "";
  const daysDiff = d => Math.round((d - today) / 86400000);
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // --- 렌더 ---
  const $ = id => document.getElementById(id);
  $("boardDate").textContent = `${fmt(today)} · ${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일`;

  function taskHtml(t) {
    const over = t.due && daysDiff(t.due) < 0;
    const dueTxt = t.due ? (over ? `${-daysDiff(t.due)}일 지남` : daysDiff(t.due) === 0 ? "오늘 마감" : `D-${daysDiff(t.due)}`) : "";
    const pri = t.pri === "높음" ? "pri-high" : t.pri === "중간" ? "pri-mid" : "pri-low";
    return `<div class="task ${over ? "overdue" : ""} ${t.status === "진행중" ? "doing" : ""}">
      <span class="task-prj">${esc(t.prj)}</span>
      <span class="task-text">${esc(t.text)}${t.status === "진행중" ? ' <em style="color:var(--accent);font-size:.75rem;">진행중</em>' : ""}</span>
      ${t.pri ? `<span class="task-pri ${pri}">${esc(t.pri)}</span>` : ""}
      ${dueTxt ? `<span class="task-due ${over ? "over" : ""}">${dueTxt}</span>` : ""}
    </div>`;
  }

  async function load() {
    $("boardLoading").hidden = false; $("boardError").hidden = true; $("boardContent").hidden = true;
    try {
      const [tRes, lRes, dRes] = await Promise.all([
        fetch(csvUrl("할일"), { cache: "no-store" }), fetch(csvUrl("업무일지"), { cache: "no-store" }),
        fetch(csvUrl("결정"), { cache: "no-store" }).catch(() => null) // 결정 탭은 없어도 됨
      ]);
      if (!tRes.ok || !lRes.ok) throw new Error("fetch");
      const tRows = parseCSV(await tRes.text());
      const lRows = parseCSV(await lRes.text());
      const dRows = (dRes && dRes.ok) ? parseCSV(await dRes.text()) : [];

      // 결정: A날짜 B프로젝트 C결정 D이유 E재검토일 F상태(유효/변경/폐기)
      const decisions = dRows
        .map(r => ({ date: parseDate(r[0]), prj: (r[1] || "").trim(), text: (r[2] || "").trim(), why: (r[3] || "").trim(),
                     review: parseDate(r[4]), status: (r[5] || "").trim() || "유효", pid: prjIdOf(r[1]) }))
        .filter(d => d.date && d.text && !d.text.startsWith("(예시)") && d.status !== "폐기")
        .sort((a, b) => b.date - a.date);

      // 할일: A등록일 B프로젝트 C할일 D마감 E이번주 F상태 G우선순위 H메모
      const tasks = tRows
        .filter(r => r[2] && r[2].trim() && ["할일", "진행중", "완료", "보류"].includes((r[5] || "").trim()))
        .map(r => ({
          reg: parseDate(r[0]), prj: (r[1] || "").trim(), text: r[2].trim(), due: parseDate(r[3]),
          star: (r[4] || "").trim().includes("⭐"), status: (r[5] || "").trim(),
          pri: (r[6] || "").trim(), memo: (r[7] || "").trim(), pid: prjIdOf(r[1])
        }))
        .filter(t => !t.text.startsWith("(예시)"));

      // 업무일지: A날짜 B프로젝트 C한일 D배운것
      const logs = lRows
        .map(r => ({ date: parseDate(r[0]), prj: (r[1] || "").trim(), did: (r[2] || "").trim(), learned: (r[3] || "").trim(), pid: prjIdOf(r[1]) }))
        .filter(l => l.date && l.did && !l.did.startsWith("(예시)"))
        .sort((a, b) => b.date - a.date);

      const open = tasks.filter(t => t.status !== "완료" && t.status !== "보류");
      const overdue = open.filter(t => t.due && daysDiff(t.due) < 0);
      const soon = open.filter(t => t.due && daysDiff(t.due) >= 0 && daysDiff(t.due) <= 3);
      const week = open.filter(t => t.star);
      const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
      const doneThisWeek = tasks.filter(t => t.status === "완료");

      // 전체 현황
      $("statRow").innerHTML = `
        <div class="stat-card"><strong>${open.length}</strong><span>남은 할 일</span></div>
        <div class="stat-card"><strong>${week.length}</strong><span>⭐ 이번 주 집중</span></div>
        <div class="stat-card ${overdue.length ? "warn" : "ok"}"><strong>${overdue.length}</strong><span>마감 지남</span></div>
        <div class="stat-card ok"><strong>${doneThisWeek.length}</strong><span>완료 (누적)</span></div>`;

      // 마감
      const due = [...overdue, ...soon].sort((a, b) => a.due - b.due);
      $("dueSection").hidden = due.length === 0;
      $("dueList").innerHTML = due.map(taskHtml).join("");

      // 이번 주
      const sortPri = { "높음": 0, "중간": 1, "낮음": 2 };
      week.sort((a, b) => (sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1));
      $("weekList").innerHTML = week.length ? week.map(taskHtml).join("")
        : '<p class="task-empty">⭐ 표시된 할 일이 없습니다. 시트 "이번주" 열에 ⭐를 찍어보세요.</p>';

      // 프로젝트별
      const STALE_DAYS = 7;
      $("prjGrid").innerHTML = PROJECTS.map(p => {
        const mine = open.filter(t => t.pid === p.id);
        const myStar = mine.filter(t => t.star).length;
        const myOver = mine.filter(t => t.due && daysDiff(t.due) < 0).length;
        const lastLog = logs.find(l => l.pid === p.id);
        const since = lastLog ? -daysDiff(lastLog.date) : null;
        const stale = since === null || since >= STALE_DAYS;
        const nextItems = mine.sort((a, b) => (b.star - a.star) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1))).slice(0, 3);
        return `<div class="prj-board-card ${stale ? "stale" : ""}">
          <div class="pbc-head">
            <span class="icon">${p.icon}</span>
            <h3>${esc(p.name)}</h3>
            <a href="project.html?id=${p.id}">상세 →</a>
          </div>
          <div class="pbc-stats">
            <span>단계 <b>${STAGES[p.stage]}</b></span>
            <span>남은 일 <b>${mine.length}</b></span>
            <span>⭐ <b>${myStar}</b></span>
            ${myOver ? `<span style="color:#f87171;">지남 <b style="color:#f87171;">${myOver}</b></span>` : ""}
          </div>
          <ul class="pbc-next">${nextItems.map(t => `<li>${t.star ? "⭐ " : ""}${esc(t.text)}</li>`).join("") || "<li style='color:var(--text-dim)'>할 일 없음</li>"}</ul>
          <div class="pbc-last ${stale ? "warn" : ""}">
            ${lastLog ? `마지막 기록 ${fmt(lastLog.date)} (${since === 0 ? "오늘" : since + "일 전"})` : "기록 없음"}${stale ? " · ⚠️ 방치 주의" : ""}
          </div>
        </div>`;
      }).join("") + (() => {
        // 프로젝트에 매칭되지 않은 할 일(개인/기타 등)은 별도 카드로
        const etc = open.filter(t => !t.pid);
        if (!etc.length) return "";
        etc.sort((a, b) => (b.star - a.star) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1)));
        return `<div class="prj-board-card">
          <div class="pbc-head"><span class="icon">🏠</span><h3>개인 / 기타</h3></div>
          <div class="pbc-stats"><span>남은 일 <b>${etc.length}</b></span><span>⭐ <b>${etc.filter(t => t.star).length}</b></span></div>
          <ul class="pbc-next">${etc.slice(0, 4).map(t => `<li>${t.star ? "⭐ " : ""}${esc(t.text)}</li>`).join("")}</ul>
        </div>`;
      })();

      // 결정 · 운영 원칙 (프로젝트별 그룹)
      const decSec = $("decisionSection");
      if (decSec) {
        decSec.hidden = decisions.length === 0;
        const groups = {};
        decisions.forEach(d => { (groups[d.prj || "기타"] = groups[d.prj || "기타"] || []).push(d); });
        const reviewSoon = decisions.filter(d => d.review && daysDiff(d.review) <= 7);
        $("decisionList").innerHTML =
          (reviewSoon.length ? `<div class="dec-alert">🔔 재검토 시점: ${reviewSoon.map(d => `<b>${esc(d.text.slice(0, 30))}${d.text.length > 30 ? "…" : ""}</b> (${daysDiff(d.review) < 0 ? -daysDiff(d.review) + "일 지남" : daysDiff(d.review) === 0 ? "오늘" : "D-" + daysDiff(d.review)})`).join(" · ")}</div>` : "") +
          Object.entries(groups).map(([prj, list]) => `
            <div class="dec-group">
              <h3>${esc(prj)}</h3>
              ${list.map(d => `<div class="dec-item ${d.status === "변경" ? "changed" : ""}">
                <div class="dec-text">${esc(d.text)}</div>
                ${d.why ? `<div class="dec-why">${esc(d.why)}</div>` : ""}
                <div class="dec-meta">${fmt(d.date)} 결정${d.review ? ` · 재검토 ${fmt(d.review)}` : ""}${d.status !== "유효" ? ` · ${esc(d.status)}` : ""}</div>
              </div>`).join("")}
            </div>`).join("");
      }

      // 최근 업무일지
      $("logList").innerHTML = logs.slice(0, 10).map(l => `
        <div class="timeline-item">
          <div class="timeline-date">${fmt(l.date)}</div>
          <div class="timeline-content">
            <h3 style="font-size:.95rem;">${esc(l.prj) || "📋"}</h3>
            <p>${esc(l.did)}${l.learned ? `<br><em style="color:var(--accent);">💡 ${esc(l.learned)}</em>` : ""}</p>
          </div>
        </div>`).join("") || '<p class="task-empty">아직 업무일지가 없습니다.</p>';

      $("boardLoading").hidden = true; $("boardContent").hidden = false;
    } catch (e) {
      $("boardLoading").hidden = true; $("boardError").hidden = false;
    }
  }

  $("refreshBtn").addEventListener("click", load);
  load();
})();
