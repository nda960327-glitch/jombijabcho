// ===== 포스트 본문 렌더러: ?id=001 로 posts.js에서 글을 찾아 표시 =====
(function () {
  const page = document.getElementById('postPage');
  if (!page || typeof POSTS === 'undefined') return;

  const id = new URLSearchParams(location.search).get('id');
  const post = POSTS.find(p => p.id === id) || POSTS[0];

  if (!post) {
    page.innerHTML = '<div class="empty-msg"><p>글을 찾을 수 없습니다. 🥀</p>' +
      '<p><a href="blog.html" class="back-to-list">← 목록으로</a></p></div>';
    return;
  }

  document.title = post.title + ' | 좀비잡초';

  // --- 간단 마크다운 → HTML ---
  // 지원: ## 소제목, **강조**, > 인용, - 목록, ![alt](src), <로 시작하는 줄은 HTML 그대로
  function mdToHtml(md) {
    const lines = md.split('\n');
    const out = [];
    let buf = [];        // 문단 버퍼
    let listBuf = [];    // 목록 버퍼
    let htmlBlock = 0;   // HTML 블록 깊이 추적 (0이면 마크다운 모드)

    function inline(s) {
      return s
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    function flushP() {
      if (buf.length) { out.push('<p>' + inline(buf.join('<br>')) + '</p>'); buf = []; }
    }
    function flushList() {
      if (listBuf.length) {
        out.push('<ul>' + listBuf.map(li => '<li>' + inline(li) + '</li>').join('') + '</ul>');
        listBuf = [];
      }
    }

    for (const raw of lines) {
      const line = raw.trimEnd();
      const t = line.trim();

      // HTML 패스스루 (div/svg 블록 등)
      if (htmlBlock > 0 || t.startsWith('<')) {
        flushP(); flushList();
        out.push(line);
        // 여는/닫는 태그로 블록 깊이 추적 (단순 휴리스틱)
        const opens = (line.match(/<(div|svg|table|figure|iframe|ul|ol)\b/g) || []).length;
        const closes = (line.match(/<\/(div|svg|table|figure|iframe|ul|ol)>/g) || []).length;
        htmlBlock += opens - closes;
        if (htmlBlock < 0) htmlBlock = 0;
        continue;
      }

      if (!t) { flushP(); flushList(); continue; }
      if (t.startsWith('## ')) { flushP(); flushList(); out.push('<h2>' + inline(t.slice(3)) + '</h2>'); continue; }
      if (t.startsWith('> '))  { flushP(); flushList(); out.push('<blockquote class="about-quote">' + inline(t.slice(2)) + '</blockquote>'); continue; }
      if (t.startsWith('- '))  { flushP(); listBuf.push(t.slice(2)); continue; }
      buf.push(t);
    }
    flushP(); flushList();
    return out.join('\n');
  }

  const tags = (post.tags || []).map(t => '# ' + t).join(' ');
  page.innerHTML = `
    <div class="post-header">
      <span class="post-cat">${CATEGORY_LABEL[post.cat] || post.cat}</span>
      <h1>${post.title}</h1>
      <div class="post-meta">${post.date} · 좀비잡초</div>
    </div>
    <div class="post-content">${mdToHtml(post.content || '')}</div>
    <div class="post-footer">
      <div class="post-tags">${tags}</div>
      <a href="blog.html" class="back-to-list">← 목록으로</a>
    </div>`;
})();
