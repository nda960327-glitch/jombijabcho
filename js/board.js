// ===== 개인 보드: 시트(프로젝트·할일·업무일지·결정·아이디어·콘텐츠) 통합 뷰 =====
(function () {
  const { loadTab, loadProjects, matcher, parseDate, fmtDate, esc, cell, STAGE_NAMES } = SHEET;
  const $ = id => document.getElementById(id);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysDiff = d => Math.round((d - today) / 86400000);
  const sortPri = { "높음": 0, "중간": 1, "낮음": 2 };

  $("boardDate").textContent = `${fmtDate(today)} · ${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일`;

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
      const [{ projects }, tRows, lRows, dRows, iRows, cRows] = await Promise.all([
        loadProjects(), loadTab("할일"), loadTab("업무일지"), loadTab("결정"), loadTab("아이디어"), loadTab("콘텐츠")
      ]);
      if (!tRows || !lRows) throw new Error("fetch");
      const idOf = matcher(projects);

      // ---- 할일: A등록일 B프로젝트 C할일 D마감 E이번주 F상태 G우선순위 H메모
      const tasks = tRows
        .filter(r => cell(r, 2) && ["할일", "진행중", "완료", "보류"].includes(cell(r, 5)))
        .map(r => ({ prj: cell(r, 1), text: cell(r, 2), due: parseDate(r[3]), star: cell(r, 4).includes("⭐"),
                     status: cell(r, 5), pri: cell(r, 6), pid: idOf(cell(r, 1)) }))
        .filter(t => !t.text.startsWith("(예시)"));
      // ---- 업무일지: A날짜 B프로젝트 C한일 D배운것
      const logs = lRows
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), did: cell(r, 2), learned: cell(r, 3), pid: idOf(cell(r, 1)) }))
        .filter(l => l.date && l.did && !l.did.startsWith("(예시)")).sort((a, b) => b.date - a.date);
      // ---- 결정: A날짜 B프로젝트 C결정 D이유 E재검토일 F상태
      const decisions = (dRows || [])
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), text: cell(r, 2), why: cell(r, 3), review: parseDate(r[4]), status: cell(r, 5) || "유효" }))
        .filter(d => d.date && d.text && !d.text.startsWith("(예시)") && d.status !== "폐기").sort((a, b) => b.date - a.date);
      // ---- 아이디어: A날짜 B아이디어 C한줄설명 D분야 E끌림 F실현가능 G상태 H메모
      const ideas = (iRows || [])
        .map(r => ({ date: parseDate(r[0]), text: cell(r, 1), desc: cell(r, 2), field: cell(r, 3), pull: +cell(r, 4) || 0, feas: +cell(r, 5) || 0, status: cell(r, 6) || "씨앗" }))
        .filter(i => i.text && !i.text.startsWith("(예시)") && i.text !== "아이디어");
      // ---- 콘텐츠: A날짜 B프로젝트 C제목 D단계 E원고링크 F업로드예정 G영상링크 H메모
      const CSTAGES = ["아이디어", "원고", "촬영", "편집", "업로드완료"];
      const contents = (cRows || [])
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), title: cell(r, 2), stage: cell(r, 3), script: cell(r, 4), due: parseDate(r[5]), video: cell(r, 6) }))
        .filter(c => c.title && !c.title.startsWith("(예시)") && c.title !== "제목/주제");

      const open = tasks.filter(t => t.status !== "완료" && t.status !== "보류");
      const overdue = open.filter(t => t.due && daysDiff(t.due) < 0);
      const soon = open.filter(t => t.due && daysDiff(t.due) >= 0 && daysDiff(t.due) <= 3);
      const week = open.filter(t => t.star);
      const done = tasks.filter(t => t.status === "완료");

      // ---- 전체 현황
      $("statRow").innerHTML = `
        <div class="stat-card"><strong>${open.length}</strong><span>남은 할 일</span></div>
        <div class="stat-card"><strong>${week.length}</strong><span>⭐ 이번 주 집중</span></div>
        <div class="stat-card ${overdue.length ? "warn" : "ok"}"><strong>${overdue.length}</strong><span>마감 지남</span></div>
        <div class="stat-card ok"><strong>${done.length}</strong><span>완료 (누적)</span></div>`;

      // ---- 마감
      const due = [...overdue, ...soon].sort((a, b) => a.due - b.due);
      $("dueSection").hidden = due.length === 0;
      $("dueList").innerHTML = due.map(taskHtml).join("");

      // ---- 이번 주
      week.sort((a, b) => (sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1));
      $("weekList").innerHTML = week.length ? week.map(taskHtml).join("")
        : '<p class="task-empty">⭐ 표시된 할 일이 없습니다. 시트 "이번주" 열에 ⭐를 찍어보세요.</p>';

      // ---- 프로젝트별 (비공개 프로젝트 포함 — 보드는 개인용)
      const STALE_DAYS = 7;
      const order = { live: 0, plan: 1, seed: 2, hold: 3, done: 4 };
      const sortedPrj = [...projects].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
      $("prjGrid").innerHTML = sortedPrj.map(p => {
        const mine = open.filter(t => t.pid === p.id);
        const myStar = mine.filter(t => t.star).length;
        const myOver = mine.filter(t => t.due && daysDiff(t.due) < 0).length;
        const lastLog = logs.find(l => l.pid === p.id);
        const since = lastLog ? -daysDiff(lastLog.date) : null;
        const active = p.status === "live" || p.status === "plan";
        const stale = active && (since === null || since >= STALE_DAYS);
        const nextItems = mine.sort((a, b) => (b.star - a.star) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1))).slice(0, 3);
        const st = (typeof STATUS_LABEL !== "undefined" && STATUS_LABEL[p.status]) || { text: p.status, cls: "badge-seed" };
        return `<div class="prj-board-card ${stale ? "stale" : ""}" style="${active ? "" : "opacity:.7"}">
          <div class="pbc-head"><span class="icon">${p.icon}</span><h3>${esc(p.name)}</h3><a href="project.html?id=${encodeURIComponent(p.id)}">상세 →</a></div>
          <div class="pbc-stats">
            <span class="badge ${st.cls}" style="margin:0;">${st.text}</span>
            <span>단계 <b>${STAGE_NAMES[p.stage]}</b></span>
            <span>남은 일 <b>${mine.length}</b></span>
            <span>⭐ <b>${myStar}</b></span>
            ${myOver ? `<span style="color:#f87171;">지남 <b style="color:#f87171;">${myOver}</b></span>` : ""}
            ${p.public === false ? `<span title="사이트 비공개">🔒</span>` : ""}
          </div>
          <ul class="pbc-next">${nextItems.map(t => `<li>${t.star ? "⭐ " : ""}${esc(t.text)}</li>`).join("") || (p.next && p.next.length ? p.next.slice(0, 2).map(n => `<li style="color:var(--text-dim)">${esc(n)}</li>`).join("") : "<li style='color:var(--text-dim)'>할 일 없음</li>")}</ul>
          <div class="pbc-last ${stale ? "warn" : ""}">${lastLog ? `마지막 기록 ${fmtDate(lastLog.date)} (${since === 0 ? "오늘" : since + "일 전"})` : "기록 없음"}${stale ? " · ⚠️ 방치 주의" : ""}</div>
        </div>`;
      }).join("") + (() => {
        const etc = open.filter(t => !t.pid);
        if (!etc.length) return "";
        etc.sort((a, b) => (b.star - a.star) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1)));
        return `<div class="prj-board-card"><div class="pbc-head"><span class="icon">🏠</span><h3>개인 / 기타</h3></div>
          <div class="pbc-stats"><span>남은 일 <b>${etc.length}</b></span><span>⭐ <b>${etc.filter(t => t.star).length}</b></span></div>
          <ul class="pbc-next">${etc.slice(0, 4).map(t => `<li>${t.star ? "⭐ " : ""}${esc(t.text)}</li>`).join("")}</ul></div>`;
      })();

      // ---- 콘텐츠 파이프라인
      $("contentSection").hidden = contents.length === 0;
      if (contents.length) {
        $("pipeRow").innerHTML = CSTAGES.map(s => {
          const n = contents.filter(c => c.stage === s).length;
          return `<div class="pipe-step ${s === "업로드완료" ? "done" : ""}"><strong>${n}</strong><span>${s}</span></div>`;
        }).join("");
        const inProgress = contents.filter(c => c.stage !== "업로드완료")
          .sort((a, b) => (CSTAGES.indexOf(b.stage) - CSTAGES.indexOf(a.stage)) || ((a.due || 9e15) - (b.due || 9e15)));
        $("contentList").innerHTML = inProgress.map(c => `
          <div class="task">
            <span class="task-prj">${esc(c.prj)}</span>
            <span class="task-text">${esc(c.title)}</span>
            <span class="task-stage">${esc(c.stage)}</span>
            ${c.script ? `<a class="task-link" href="${esc(c.script)}" target="_blank" rel="noopener">원고 ↗</a>` : ""}
            ${c.due ? `<span class="task-due ${daysDiff(c.due) < 0 ? "over" : ""}">${daysDiff(c.due) < 0 ? -daysDiff(c.due) + "일 지남" : daysDiff(c.due) === 0 ? "오늘" : "D-" + daysDiff(c.due)}</span>` : ""}
          </div>`).join("") || '<p class="task-empty">진행 중인 콘텐츠가 없습니다.</p>';
      }

      // ---- 아이디어 창고
      $("ideaSection").hidden = ideas.length === 0;
      if (ideas.length) {
        const alive = ideas.filter(i => i.status === "씨앗" || i.status === "검토중");
        const promoted = ideas.filter(i => i.status === "승격").length;
        $("ideaCount").textContent = `씨앗 ${alive.length} · 승격 ${promoted} · 전체 ${ideas.length}`;
        alive.sort((a, b) => (b.pull + b.feas) - (a.pull + a.feas));
        $("ideaList").innerHTML = alive.slice(0, 6).map(i => `
          <div class="task">
            <span class="task-text"><strong>${esc(i.text)}</strong>${i.desc ? ` <span style="color:var(--text-dim)">— ${esc(i.desc)}</span>` : ""}</span>
            ${i.field ? `<span class="idea-field">${esc(i.field)}</span>` : ""}
            <span class="idea-score" title="끌림+실현가능">${i.pull}+${i.feas}</span>
            <span class="task-stage">${esc(i.status)}</span>
          </div>`).join("") + (alive.length > 6 ? `<p class="task-empty">… 외 ${alive.length - 6}개 (시트에서 보기)</p>` : "");
      }

      // ---- 결정 · 운영 원칙
      $("decisionSection").hidden = decisions.length === 0;
      if (decisions.length) {
        const groups = {};
        decisions.forEach(d => { (groups[d.prj || "기타"] = groups[d.prj || "기타"] || []).push(d); });
        const reviewSoon = decisions.filter(d => d.review && daysDiff(d.review) <= 7);
        $("decisionList").innerHTML =
          (reviewSoon.length ? `<div class="dec-alert">🔔 재검토 시점: ${reviewSoon.map(d => `<b>${esc(d.text.slice(0, 30))}${d.text.length > 30 ? "…" : ""}</b> (${daysDiff(d.review) < 0 ? -daysDiff(d.review) + "일 지남" : daysDiff(d.review) === 0 ? "오늘" : "D-" + daysDiff(d.review)})`).join(" · ")}</div>` : "") +
          Object.entries(groups).map(([prj, list]) => `<div class="dec-group"><h3>${esc(prj)}</h3>` +
            list.map(d => `<div class="dec-item ${d.status === "변경" ? "changed" : ""}">
                <div class="dec-text">${esc(d.text)}</div>${d.why ? `<div class="dec-why">${esc(d.why)}</div>` : ""}
                <div class="dec-meta">${fmtDate(d.date)} 결정${d.review ? ` · 재검토 ${fmtDate(d.review)}` : ""}${d.status !== "유효" ? ` · ${esc(d.status)}` : ""}</div>
              </div>`).join("") + `</div>`).join("");
      }

      // ---- 최근 업무일지
      $("logList").innerHTML = logs.slice(0, 10).map(l => `
        <div class="timeline-item"><div class="timeline-date">${fmtDate(l.date)}</div>
          <div class="timeline-content"><h3 style="font-size:.95rem;">${esc(l.prj) || "📋"}</h3>
          <p>${esc(l.did)}${l.learned ? `<br><em style="color:var(--accent);">💡 ${esc(l.learned)}</em>` : ""}</p></div></div>`).join("")
        || '<p class="task-empty">아직 업무일지가 없습니다.</p>';

      $("boardLoading").hidden = true; $("boardContent").hidden = false;
    } catch (e) {
      console.error(e);
      $("boardLoading").hidden = true; $("boardError").hidden = false;
    }
  }

  $("refreshBtn").addEventListener("click", load);
  load();
})();
