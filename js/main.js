// ===== 좀비잡초 main.js =====

// 헤더 스크롤 효과
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 10);
});

// 모바일 메뉴 토글
const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');
if (navToggle && nav) {
  navToggle.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => nav.classList.remove('open'))
  );
}

// 스크롤 리빌 애니메이션
const revealTargets = document.querySelectorAll(
  '.section-title, .section-desc, .card, .mini-card, .project-card, .timeline-item, .reflection-card, .yt-placeholder, .about-text'
);
revealTargets.forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
revealTargets.forEach(el => io.observe(el));

// D+N 기록 일수 자동 계산 (기록 시작일: 2026-08-22)
const statDays = document.getElementById('statDays');
if (statDays) {
  const start = new Date('2026-08-22T00:00:00');
  const days = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
  statDays.textContent = 'D+' + days;
}
