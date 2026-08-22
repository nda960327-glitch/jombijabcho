// ===== 메인 페이지: 프로젝트 카드 + 통합 저니 타임라인 자동 렌더링 =====
(function () {
  if (typeof PROJECTS === 'undefined') return;

  // --- 프로젝트 카드 ---
  const grid = document.getElementById('projectGrid');
  if (grid) {
    grid.innerHTML = PROJECTS.map(p => {
      const st = STATUS_LABEL[p.status] || { text: p.status, cls: 'badge-seed' };
      const bars = STAGES.map((_, i) =>
        `<i class="${i < p.stage ? 'done' : (i === p.stage ? 'current' : '')}"></i>`).join('');
      return `
      <a class="project-card" href="project.html?id=${p.id}" style="display:block;">
        <div class="project-thumb">${p.icon}</div>
        <div class="project-body">
          <span class="badge ${st.cls}">${st.text}</span>
          <h3>${p.name}</h3>
          <p>${p.oneliner}</p>
          <div class="project-meta">
            🎯 ${p.goal}
            <div class="mini-pipeline" title="현재 단계: ${STAGES[p.stage]}">${bars}</div>
          </div>
        </div>
      </a>`;
    }).join('');
  }

  // --- 통합 저니 타임라인: 모든 프로젝트 log 최신순 ---
  const journey = document.getElementById('journeyTimeline');
  if (journey) {
    const entries = [];
    PROJECTS.forEach(p => (p.log || []).forEach(l =>
      entries.push({ date: l.date, text: l.text, prj: p })));
    // "2026.08.22" 형식 문자열은 사전순 정렬 = 시간순 정렬
    entries.sort((a, b) => b.date.localeCompare(a.date));

    journey.innerHTML = entries.slice(0, 8).map(e => `
      <div class="timeline-item">
        <div class="timeline-date">${e.date}</div>
        <div class="timeline-content">
          <h3>${e.prj.icon} ${e.prj.name}</h3>
          <p>${e.text}</p>
        </div>
      </div>`).join('') ||
      '<p class="section-desc">아직 기록이 없습니다.</p>';
  }
})();
