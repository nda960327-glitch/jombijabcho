// ===== 블로그 목록: posts.js 데이터로 자동 렌더링 =====
(function () {
  const listEl = document.getElementById('postList');
  const emptyMsg = document.getElementById('emptyMsg');
  const postCount = document.getElementById('postCount');
  const catLinks = document.querySelectorAll('#categoryList a');
  if (!listEl || typeof POSTS === 'undefined') return;

  // 글 목록 렌더링
  function render(cat) {
    const posts = cat === 'all' ? POSTS : POSTS.filter(p => p.cat === cat);
    listEl.innerHTML = posts.map(p => `
      <article class="post-item" data-cat="${p.cat}">
        <a href="post.html?id=${p.id}" class="post-link">
          <div class="post-text">
            <span class="post-cat">${CATEGORY_LABEL[p.cat] || p.cat}</span>
            <h2>${p.title}</h2>
            <p>${p.excerpt}</p>
            <div class="post-meta">${p.date} · 좀비잡초</div>
          </div>
          <div class="post-thumb">${p.icon || '🌱'}</div>
        </a>
      </article>`).join('');
    if (emptyMsg) emptyMsg.hidden = posts.length > 0;
  }

  // 전체 글 수 + 카테고리별 글 수
  if (postCount) postCount.textContent = POSTS.length;
  catLinks.forEach(link => {
    const cat = link.dataset.cat;
    const count = cat === 'all' ? POSTS.length : POSTS.filter(p => p.cat === cat).length;
    const em = link.querySelector('em');
    if (em) em.textContent = '(' + count + ')';

    link.addEventListener('click', e => {
      e.preventDefault();
      catLinks.forEach(l => l.classList.remove('cat-active'));
      link.classList.add('cat-active');
      render(cat);
    });
  });

  render('all');
})();
