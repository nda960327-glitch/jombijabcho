// ===== 프로젝트 상세 렌더러 (시트 '프로젝트' 탭 + 업무일지 연동, 실패 시 projects.js) =====
(async function () {
  const page = document.getElementById('projectPage');
  if (!page) return;

  const id = new URLSearchParams(location.search).get('id');
  const { projects } = (typeof SHEET !== 'undefined')
    ? await SHEET.loadProjects()
    : { projects: (typeof PROJECTS !== 'undefined') ? PROJECTS : [] };
  const prj = projects.find(p => p.id === id) || projects[0];
  const STG = (typeof STAGES !== 'undefined') ? STAGES : ["아이디어", "검증", "MVP", "운영", "확장"];
  const SL = (typeof STATUS_LABEL !== 'undefined') ? STATUS_LABEL : {};
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  if (!prj) {
    page.innerHTML = '<div class="empty-msg"><p>프로젝트를 찾을 수 없습니다. 🥀</p><p><a href="index.html#projects" class="back-to-list">← 목록으로</a></p></div>';
    return;
  }
  document.title = prj.name + ' | 좀비잡초';
  const st = SL[prj.status] || { text: prj.status, cls: 'badge-seed' };

  // 활동 로그 = projects.js 로그 + 시트 업무일지(이 프로젝트 라벨) 병합
  let logs = (prj.log || []).map(l => ({ date: l.date, text: l.text }));
  let nextActions = prj.next || [];
  if (typeof SHEET !== 'undefined') {
    const idOf = SHEET.matcher(projects);
    const [rows, tRows] = await Promise.all([SHEET.loadTab("업무일지"), SHEET.loadTab("할일")]);
    // 다음 액션: 할일 탭의 이 프로젝트 미완료 항목 (⭐ → 높음 → 마감순), 최대 5개
    if (tRows) {
      const pri = { "높음": 0, "중간": 1, "낮음": 2 };
      const mine = SHEET.parseTasks(tRows, idOf).filter(t => t.pid === prj.id && t.status !== "완료" && t.status !== "보류")
        .sort((a, b) => (b.star - a.star) || ((pri[a.pri] ?? 1) - (pri[b.pri] ?? 1)) || ((a.due || 9e15) - (b.due || 9e15)));
      if (mine.length) nextActions = mine.slice(0, 5).map(t => (t.star ? "⭐ " : "") + t.text);
    }
    if (rows) {
      rows.forEach(r => {
        const d = SHEET.parseDate(r[0]); const did = SHEET.cell(r, 2);
        if (!d || !did || did.startsWith("(예시)")) return;
        if (idOf(SHEET.cell(r, 1)) !== prj.id) return;
        const learned = SHEET.cell(r, 3);
        logs.push({ date: SHEET.fmtDate(d), text: did + (learned ? ` — 💡 ${learned}` : "") });
      });
    }
  }
  logs.sort((a, b) => b.date.localeCompare(a.date));

  const pipeline = STG.map((s, i) => {
    const cls = i < prj.stage ? 'done' : (i === prj.stage ? 'current' : '');
    return `<div class="stage ${cls}"><span class="stage-dot"></span><span class="stage-label">${s}</span></div>`;
  }).join('<div class="stage-line"></div>');
  const metrics = (prj.metrics || []).map(m => `<div class="metric"><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span></div>`).join('');
  const next = nextActions.map((n, i) => `<li><span class="next-num">${i + 1}</span>${esc(n)}</li>`).join('');
  const log = logs.map(l => `
    <div class="timeline-item"><div class="timeline-date">${esc(l.date)}</div><div class="timeline-content"><p>${esc(l.text)}</p></div></div>`).join('');

  let related = '';
  if (typeof POSTS !== 'undefined') {
    const rel = POSTS.filter(p => p.project === prj.id);
    if (rel.length) {
      related = `<h2 class="prj-h2">📝 관련 기록</h2><div class="related-posts">` +
        rel.map(p => `<a href="post.html?id=${p.id}" class="related-post"><span>${p.icon || '🌱'}</span><div><strong>${esc(p.title)}</strong><em>${esc(p.date)}</em></div></a>`).join('') + `</div>`;
    }
  }

  page.innerHTML = `
    <div class="prj-header"><div class="prj-title-row">
      <span class="prj-icon">${prj.icon}</span>
      <div><span class="badge ${st.cls}">${st.text}</span><h1>${esc(prj.name)}</h1><p class="prj-oneliner">${esc(prj.oneliner)}</p></div>
    </div></div>
    <div class="prj-pipeline">${pipeline}</div>
    <div class="prj-grid">
      <div class="prj-card prj-goal"><h2 class="prj-h2">🎯 지금의 목표</h2><p class="goal-text">${esc(prj.goal) || "목표를 정하세요"}</p><div class="prj-meta">시작: ${esc(prj.start)}</div></div>
      <div class="prj-card"><h2 class="prj-h2">📊 핵심 지표</h2><div class="metric-row">${metrics || '<span class="prj-meta">지표 없음</span>'}</div></div>
    </div>
    <div class="prj-card"><h2 class="prj-h2">⚡ 다음 액션</h2><ol class="next-list">${next || '<li>다음 할 일을 정하세요.</li>'}</ol></div>
    <div class="prj-card"><h2 class="prj-h2">🌱 활동 로그</h2><div class="timeline prj-timeline">${log || '<p class="prj-meta">아직 기록이 없습니다.</p>'}</div></div>
    ${related}
    <div class="post-footer"><div></div><a href="index.html#projects" class="back-to-list">← 프로젝트 목록으로</a></div>`;
})();
