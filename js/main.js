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

// 로고 길게 누르기(0.7초) → 개인 보드로 이동 (숨은 입구)
const logo = document.querySelector('.logo');
if (logo) {
  let pressTimer = null, longPressed = false;
  const start = () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      if (navigator.vibrate) navigator.vibrate(30);
      location.href = 'board.html';
    }, 700);
  };
  const cancel = () => { clearTimeout(pressTimer); };
  logo.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => logo.addEventListener(ev, cancel));
  logo.addEventListener('click', e => { if (longPressed) e.preventDefault(); });
  logo.addEventListener('contextmenu', e => e.preventDefault()); // 모바일 길게 누를 때 메뉴 방지
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
