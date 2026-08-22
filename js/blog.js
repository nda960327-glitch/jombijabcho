// ===== 블로그 카테고리 필터 =====
const catLinks = document.querySelectorAll('#categoryList a');
const posts = document.querySelectorAll('.post-item');
const emptyMsg = document.getElementById('emptyMsg');
const postCount = document.getElementById('postCount');

// 전체 글 수 표시
if (postCount) postCount.textContent = posts.length;

// 카테고리별 글 수 자동 계산
catLinks.forEach(link => {
  const cat = link.dataset.cat;
  const count = cat === 'all'
    ? posts.length
    : document.querySelectorAll('.post-item[data-cat="' + cat + '"]').length;
  const em = link.querySelector('em');
  if (em) em.textContent = '(' + count + ')';
});

// 필터링
catLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    catLinks.forEach(l => l.classList.remove('cat-active'));
    link.classList.add('cat-active');

    const cat = link.dataset.cat;
    let visible = 0;
    posts.forEach(p => {
      const show = cat === 'all' || p.dataset.cat === cat;
      p.hidden = !show;
      if (show) visible++;
    });
    if (emptyMsg) emptyMsg.hidden = visible > 0;
  });
});
