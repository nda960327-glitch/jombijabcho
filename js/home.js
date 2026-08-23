// ===== 메인 페이지: 프로젝트 카드 + 통합 저니 타임라인 (시트 '프로젝트' 탭 우선, 실패 시 projects.js) =====
(async function () {
  const grid = document.getElementById('projectGrid');
  const journey = document.getElementById('journeyTimeline');
  if (!grid && !journey) return;

  const { projects } = (typeof SHEET !== 'undefined')
    ? await SHEET.loadProjects()
    : { projects: (typeof PROJECTS !== 'undefined') ? PROJECTS : [] };
  const shown = projects.filter(p => p.public !== false);
  const STG = (typeof STAGES !== 'undefined') ? STAGES : ["아이디어", "검증", "MVP", "운영", "확장"];
  const SL = (typeof STATUS_LABEL !== 'undefined') ? STATUS_LABEL : {};
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // --- 프로젝트 카드 ---
  if (grid) {
    grid.innerHTML = shown.map(p => {
      const st = SL[p.status] || { text: p.status, cls: 'badge-seed' };
      const bars = STG.map((_, i) => `<i class="${i < p.stage ? 'done' : (i === p.stage ? 'current' : '')}"></i>`).join('');
      return `
      <a class="project-card" href="project.html?id=${encodeURIComponent(p.id)}" style="display:block;">
        <div class="project-thumb">${p.icon}</div>
        <div class="project-body">
          <span class="badge ${st.cls}">${st.text}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.oneliner)}</p>
          <div class="project-meta">
            🎯 ${esc(p.goal)}
            <div class="mini-pipeline" title="현재 단계: ${STG[p.stage]}">${bars}</div>
          </div>
        </div>
      </a>`;
    }).join('') || '<p class="section-desc">등록된 프로젝트가 없습니다.</p>';
    // 프로젝트 수 뱃지
    const countEl = document.getElementById('projectCount');
    if (countEl) countEl.textContent = shown.length;
  }

  // --- 통합 저니 타임라인 (projects.js 로그 기반 기본값; 시트 업무일지가 있으면 sheet-feed.js가 덮어씀) ---
  if (journey && !journey.dataset.fromSheet) {
    const entries = [];
    shown.forEach(p => (p.log || []).forEach(l => entries.push({ date: l.date, text: l.text, prj: p })));
    entries.sort((a, b) => b.date.localeCompare(a.date));
    if (entries.length && !journey.innerHTML.trim()) {
      journey.innerHTML = entries.slice(0, 8).map(e => `
        <div class="timeline-item">
          <div class="timeline-date">${e.date}</div>
          <div class="timeline-content"><h3>${e.prj.icon} ${esc(e.prj.name)}</h3><p>${esc(e.text)}</p></div>
        </div>`).join('');
    }
  }
})();
