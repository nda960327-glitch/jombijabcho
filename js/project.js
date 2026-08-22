// ===== 프로젝트 상세 렌더러: ?id=xxx 로 projects.js에서 찾아 표시 =====
(function () {
  const page = document.getElementById('projectPage');
  if (!page || typeof PROJECTS === 'undefined') return;

  const id = new URLSearchParams(location.search).get('id');
  const prj = PROJECTS.find(p => p.id === id) || PROJECTS[0];

  if (!prj) {
    page.innerHTML = '<div class="empty-msg"><p>프로젝트를 찾을 수 없습니다. 🥀</p>' +
      '<p><a href="index.html#projects" class="back-to-list">← 목록으로</a></p></div>';
    return;
  }

  document.title = prj.name + ' | 좀비잡초';
  const st = STATUS_LABEL[prj.status] || { text: prj.status, cls: 'badge-seed' };

  // 단계 파이프라인
  const pipeline = STAGES.map((s, i) => {
    const cls = i < prj.stage ? 'done' : (i === prj.stage ? 'current' : '');
    return `<div class="stage ${cls}"><span class="stage-dot"></span><span class="stage-label">${s}</span></div>`;
  }).join('<div class="stage-line"></div>');

  // 핵심 지표
  const metrics = (prj.metrics || []).map(m =>
    `<div class="metric"><strong>${m.value}</strong><span>${m.label}</span></div>`).join('');

  // 다음 액션
  const next = (prj.next || []).map((n, i) =>
    `<li><span class="next-num">${i + 1}</span>${n}</li>`).join('');

  // 활동 로그
  const log = (prj.log || []).map(l => `
    <div class="timeline-item">
      <div class="timeline-date">${l.date}</div>
      <div class="timeline-content"><p>${l.text}</p></div>
    </div>`).join('');

  // 이 프로젝트와 연결된 블로그 글 (posts.js의 project 필드)
  let related = '';
  if (typeof POSTS !== 'undefined') {
    const rel = POSTS.filter(p => p.project === prj.id);
    if (rel.length) {
      related = `
        <h2 class="prj-h2">📝 관련 기록</h2>
        <div class="related-posts">` +
        rel.map(p => `<a href="post.html?id=${p.id}" class="related-post">
            <span>${p.icon || '🌱'}</span>
            <div><strong>${p.title}</strong><em>${p.date}</em></div>
          </a>`).join('') + `</div>`;
    }
  }

  page.innerHTML = `
    <div class="prj-header">
      <div class="prj-title-row">
        <span class="prj-icon">${prj.icon}</span>
        <div>
          <span class="badge ${st.cls}">${st.text}</span>
          <h1>${prj.name}</h1>
          <p class="prj-oneliner">${prj.oneliner}</p>
        </div>
      </div>
    </div>

    <div class="prj-pipeline">${pipeline}</div>

    <div class="prj-grid">
      <div class="prj-card prj-goal">
        <h2 class="prj-h2">🎯 지금의 목표</h2>
        <p class="goal-text">${prj.goal}</p>
        <div class="prj-meta">시작: ${prj.start}</div>
      </div>
      <div class="prj-card">
        <h2 class="prj-h2">📊 핵심 지표</h2>
        <div class="metric-row">${metrics}</div>
      </div>
    </div>

    <div class="prj-card">
      <h2 class="prj-h2">⚡ 다음 액션</h2>
      <ol class="next-list">${next || '<li>다음 할 일을 정하세요.</li>'}</ol>
    </div>

    <div class="prj-card">
      <h2 class="prj-h2">🌱 활동 로그</h2>
      <div class="timeline prj-timeline">${log || '<p class="prj-meta">아직 기록이 없습니다.</p>'}</div>
    </div>

    ${related}

    <div class="post-footer">
      <div></div>
      <a href="index.html#projects" class="back-to-list">← 프로젝트 목록으로</a>
    </div>`;
})();
