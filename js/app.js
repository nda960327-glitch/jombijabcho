/* ============================================
   MY HOME — app.js
   저장: 구글 Apps Script(웹) + localStorage(오프라인 캐시)
   시세: Apps Script가 야후 파이낸스에서 가져와 전달
   ============================================ */
(function () {
  'use strict';

  const KEY = 'myhome.v1';
  const API_KEY = 'myhome.api2';   // 예전 키(myhome.api)에 남은 옛 주소는 무시한다
  const APP_VER = '20260908g';
  const PIN_KEY = 'myhome.pin';
  /**
   * 저장 서버 주소.
   * 서버가 PIN을 확인하므로 이 주소가 공개돼도 내용은 열리지 않습니다.
   * (PIN 검사가 없는 버전을 배포하면 이 전제가 깨집니다. 반드시 PIN 버전을 유지하세요.)
   */
  const DEFAULT_API = 'https://script.google.com/macros/s/AKfycby-lVpo55ltoCZupAziQQrs_OeLUhPMM1h98HfJcZhDEX6ZlvoHQFCGyGaA0F9qmF-YKw/exec';

  /* ---------- 고정 데이터 (자산·도장깨기) ---------- */
  const ASSETS = [
    { id: 'emtec', name: '이엠텍', where: '토스증권', cost: 341224360, kind: 'stock' },
    { id: 'hlb',   name: 'HLB',    where: '키움증권', cost: 50673700,  kind: 'stock' },
    { id: 'cash',  name: '현금',   where: '계좌',     cost: 10000000,  kind: 'cash' },
    { id: 'land',  name: '토지 (증평 미암리 300평)', where: '부동산', cost: 68000000, kind: 'land' },
  ];
  const JEONSE = { total: 300000000, paid: 30000000, loan: 200000000, need: 70000000, fee: 1000000 };
  const CAR = 16890000;
  const HOUSE = 300000000;
  const LADDER = [
    { id: 'jeonse', emoji: '🏠', title: '전세 잔금 + 중개수수료', amount: JEONSE.need + JEONSE.fee, desc: '잔금 7,000만 + 수수료 100만' },
    { id: 'car',    emoji: '🚗', title: '캐스퍼 터보 디에센셜',   amount: CAR,                      desc: '스마트센스1 · 컴포트 · 액티브2 · 스타일' },
    { id: 'house',  emoji: '🏡', title: '증평 미암리 집 짓기',     amount: HOUSE, long: true,        desc: '땅은 이미 내 것. 그 위에 집을' },
  ];
  const TARGET_WEIGHT = 44;

  /* 처음 한 번만 쓰이는 기본 목표/일. 이후에는 저장된 데이터(state.goals / state.works)를 쓴다. */
  const SEED_GOALS = [
    { emoji: '🏡', title: '증평 미암리에 집 짓기', desc: '300평 땅은 이미 내 것. 건축비 3억이 마지막 칸.', tag: '집', bar: 'house' },
    { emoji: '🚗', title: '캐스퍼 터보 디에센셜', desc: '1,689만 원. 전세를 통과해야 열리는 2번 칸.', tag: '차', bar: 'car' },
    { emoji: '🏠', title: '전세 잔금 + 중개수수료 7,100만 원', desc: '계약금 3천만 완료, 대출 2억. 도장깨기 1번 칸.', tag: '전세', bar: 'jeonse' },
    { emoji: '✨', title: '눈 · 코 성형', desc: '하고 싶은 것. 상담부터 차근차근.', tag: '성형', bar: '' },
    { emoji: '⚖️', title: '44kg까지 다이어트', desc: '건강하게, 꾸준하게.', tag: '다이어트', bar: 'weight' },
    { emoji: '👶', title: '아이', desc: '아이는 낳고 싶다. 결혼은 생각 없음. 내 방식대로.', tag: '아이', bar: '' },
    { emoji: '🗣', title: '일본어 · 중국어 배우기', desc: '그리고 영어로 글을 더 잘 읽기.', tag: '언어', bar: '' },
    { emoji: '🎸', title: '밴드: 드럼 · 기타', desc: '악기 하나는 제대로. 언어로 하는 취미도.', tag: '취미', bar: '' },
    { emoji: '✈️', title: '소중한 사람들과 여행', desc: '가족과 추억 남기기. 이게 제일 소중.', tag: '여행', bar: '' },
  ];
  const SEED_WORKS = [
    { emoji: '🐌', title: '우렁의사', desc: '앱 만들기. 개발 진행 중.', tag: '우렁의사', status: 'build' },
    { emoji: '🍸', title: 'stay in 비밀의정원', desc: '오프라인 칵테일 가게. 자동으로 굴러가는 중.', tag: '비밀의정원', status: 'run' },
    { emoji: '📱', title: '바텐톡', desc: '앱 상용화 남음.', tag: '바텐톡', status: 'todo' },
    { emoji: '📱', title: '캐치걸', desc: '앱 상용화 남음.', tag: '캐치걸', status: 'todo' },
  ];
  const STATUS_LABEL = { build: '개발 중', run: '자동 운영', todo: '상용화 대기', pause: '잠시 멈춤', done: '완료' };
  const SECTIONS = ['summary', 'year', 'month', 'goals', 'money', 'work', 'calendar', 'diary', 'me'];
  const MOODS = ['😊', '😌', '🥳', '😐', '😢', '😡', '😴', '🤒', '💪', '🥲'];

  const LANGS = [
    { id: 'ja', name: '🇯🇵 일본어' },
    { id: 'zh', name: '🇨🇳 중국어' },
    { id: 'en', name: '🇬🇧 영어 읽기' },
  ];

  /* ---------- 상태 ---------- */
  const defaultState = () => ({
    todos: [], qty: {}, now: {}, weight: null, weightStart: null, langLog: {}, showDone: false, useStocks: false,
    goals: null, works: null, order: null, texts: {}, memo: '', diary: null, events: [], days: {}, showTodos: true, months: {}, years: {}, panels: {}, treeCounts: true
  });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let state = load();
  let prices = {};
  let apiUrl = DEFAULT_API;
  let pin = '';
  let syncing = false;
  let pendingSave = null;

  try {
    localStorage.removeItem('myhome.api');
    const ov = localStorage.getItem(API_KEY) || '';
    apiUrl = (ov && ov !== DEFAULT_API) ? ov : DEFAULT_API;
    pin = localStorage.getItem(PIN_KEY) || '';
  } catch (e) { apiUrl = DEFAULT_API; pin = ''; }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return migrate(defaultState());
      return migrate(Object.assign(defaultState(), JSON.parse(raw)));
    } catch (e) { return migrate(defaultState()); }
  }
  /** 없는 항목은 기본값으로 채운다 (예전 저장본, 옛 서버 응답 모두 대응) */
  function migrate(s) {
    if (!Array.isArray(s.goals)) s.goals = SEED_GOALS.map(g => Object.assign({ id: uid(), notes: [] }, g));
    if (!Array.isArray(s.works)) s.works = SEED_WORKS.map(w => Object.assign({ id: uid(), notes: [] }, w));
    s.goals.forEach(g => { if (!g.id) g.id = uid(); if (!Array.isArray(g.notes)) g.notes = []; if (g.bar === undefined) g.bar = ''; });
    s.works.forEach(w => { if (!w.id) w.id = uid(); if (!Array.isArray(w.notes)) w.notes = []; if (!w.status) w.status = 'build'; if (!w.tag) w.tag = w.title; });
    if (!Array.isArray(s.order) || !s.order.length) s.order = SECTIONS.slice();
    s.order = s.order.filter(k => SECTIONS.indexOf(k) >= 0);
    SECTIONS.forEach(k => {
      if (s.order.indexOf(k) >= 0) return;
      if (k === 'month') { const gi = s.order.indexOf('goals'); s.order.splice(gi >= 0 ? gi : 1, 0, k); }   // 목표 바로 위에
      else if (k === 'year') { const mi = s.order.indexOf('month'); s.order.splice(mi >= 0 ? mi : 1, 0, k); }  // 이번 달 바로 위에
      else s.order.push(k);
    });
    if (!s.texts || typeof s.texts !== 'object') s.texts = {};
    if (typeof s.memo !== 'string') s.memo = '';
    delete s.groups;
    if (!Array.isArray(s.events)) s.events = [];
    s.events = s.events.filter(e => e && e.start).map(e => Object.assign({ id: uid(), title: '', end: e.start, color: 'blue', memo: '' }, e));
    s.events.forEach(e => { if (!e.end || e.end < e.start) e.end = e.start; });
    if (!s.days || typeof s.days !== 'object') s.days = {};
    if (typeof s.showTodos !== 'boolean') s.showTodos = true;
    if (!s.panels || typeof s.panels !== 'object') s.panels = {};
    if (typeof s.treeCounts !== 'boolean') s.treeCounts = true;
    if (!s.years || typeof s.years !== 'object') s.years = {};
    Object.keys(s.years).forEach(k => { const m = s.years[k]; if (!m || typeof m !== 'object') { delete s.years[k]; return; } if (!Array.isArray(m.items)) m.items = []; m.items.forEach(i => { if (!i.id) i.id = uid(); }); if (typeof m.memo !== 'string') m.memo = ''; });
    if (!s.months || typeof s.months !== 'object') s.months = {};
    Object.keys(s.months).forEach(k => { const m = s.months[k]; if (!m || typeof m !== 'object') { delete s.months[k]; return; } if (!Array.isArray(m.items)) m.items = []; m.items.forEach(i => { if (!i.id) i.id = uid(); }); if (typeof m.memo !== 'string') m.memo = ''; });
    if (!s.diary || typeof s.diary !== 'object') s.diary = { id: 'diary', emoji: '📔', title: '다이어리', desc: '', tag: '일기', notes: [], boards: [], hidden: false };
    s.diary.id = 'diary'; if (!Array.isArray(s.diary.notes)) s.diary.notes = []; if (!s.diary.title) s.diary.title = '다이어리'; if (!s.diary.emoji) s.diary.emoji = '📔';
    s.diary.notes.forEach(n => { if (!n.date) n.date = ymd(new Date(n.at || Date.now())); if (typeof n.mood !== 'string') n.mood = ''; });
    [].concat(s.goals, s.works, [s.diary]).forEach(it => {
      delete it.group;
      if (typeof it.hidden !== 'boolean') it.hidden = false;
      if (typeof it.collapsed !== 'boolean') it.collapsed = false;   // 카테고리 트리에서 접힘
      if (!Array.isArray(it.boards)) it.boards = [];                 // 세부 게시판
      it.boards.forEach(b => { if (!b.id) b.id = uid(); if (typeof b.name !== 'string') b.name = ''; });
      const bids = it.boards.map(b => b.id);
      (it.notes || []).forEach(n => { if (typeof n.board !== 'string' || (n.board && bids.indexOf(n.board) < 0)) n.board = ''; });
    });
    return s;
  }
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  /** 로컬에 먼저 저장하고, 연결돼 있으면 1.5초 뒤 웹에도 저장 */
  function save() {
    saveLocal();
    if (!pin) return;
    clearTimeout(pendingSave);
    setSync('저장 대기 중…', 'wait');
    pendingSave = setTimeout(pushToCloud, 1500);
  }

  /* ---------- 유틸 ---------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => ymd(new Date());
  const won = n => Math.round(n).toLocaleString('ko-KR') + ' 원';
  const signed = n => (n > 0 ? '+' : '') + Math.round(n).toLocaleString('ko-KR');
  const pct1 = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  function korean(n) {
    const neg = n < 0; n = Math.abs(Math.round(n));
    if (n < 10000) return (neg ? '-' : '') + n.toLocaleString('ko-KR') + ' 원';
    const eok = Math.floor(n / 1e8);
    const man = Math.round((n % 1e8) / 1e4);
    let s = '';
    if (eok) s += eok + '억 ';
    if (man) s += man.toLocaleString('ko-KR') + '만';
    return (neg ? '-' : '') + s.trim() + ' 원';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function pct(a, b) { return Math.max(0, Math.min(100, (a / b) * 100)); }
  function dateLabel(s) {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${m}/${d} (${'일월화수목금토'[dt.getDay()]})`;
  }
  function daysFromToday(s) {
    const [y, m, d] = s.split('-').map(Number);
    const a = new Date(y, m - 1, d), b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  }
  function whenLabel(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ---------- 헤더 ---------- */
  function renderHeader() {
    const d = new Date();
    const w = '일요일 월요일 화요일 수요일 목요일 금요일 토요일'.split(' ')[d.getDay()];
    $('#todayLabel').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${w}`;
    const h = d.getHours();
    $('#greeting').textContent = h < 5 ? '아직 깨어 있네. 오늘도 수고했어'
      : h < 12 ? '좋은 아침. 오늘도 한 걸음'
      : h < 18 ? '좋은 오후. 지금 이것부터'
      : '좋은 저녁. 오늘 한 일을 돌아보자';
  }

  /* ---------- 문구 수정 (꾸미기 모드) ---------- */
  const TEXT_DEFAULTS = {};
  $$('[data-t]').forEach(el => { TEXT_DEFAULTS[el.dataset.t] = el.textContent.trim(); });
  function applyTexts() {
    $$('[data-t]').forEach(el => {
      const k = el.dataset.t;
      const v = state.texts[k];
      const want = (typeof v === 'string' && v.trim()) ? v : TEXT_DEFAULTS[k];
      if (el.textContent !== want && document.activeElement !== el) el.textContent = want;
    });
  }
  let editing = false;
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    $('#editBar').hidden = !on;
    $('#editToggle').textContent = on ? '✏️ 꾸미는 중' : '✏️ 꾸미기';
    $$('[data-t]').forEach(el => { el.contentEditable = on ? 'true' : 'false'; el.spellcheck = false; });
    $$('.sec-tools').forEach(el => { el.hidden = !on; });
    renderGoals(); renderWork();
  }
  $('#editToggle').addEventListener('click', () => setEditing(!editing));
  $('#editDone').addEventListener('click', () => setEditing(false));
  document.addEventListener('focusout', e => {
    const el = e.target.closest && e.target.closest('[data-t]');
    if (!el || !editing) return;
    const k = el.dataset.t;
    const v = el.textContent.replace(/\s+/g, ' ').trim();
    if (!v || v === TEXT_DEFAULTS[k]) delete state.texts[k]; else state.texts[k] = v;
    applyTexts(); save();
  });
  document.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('[data-t]');
    if (!el || !editing) return;
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = state.texts[el.dataset.t] || TEXT_DEFAULTS[el.dataset.t]; el.blur(); }
  });
  document.addEventListener('paste', e => {
    const el = e.target.closest && e.target.closest('[data-t]');
    if (!el || !editing) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '));
  });
  $('#resetTexts').addEventListener('click', () => {
    if (!confirm('제목·문구와 위젯 순서를 처음 상태로 되돌릴까요? 목표·일 카드와 기록은 그대로예요.')) return;
    state.texts = {}; state.order = SECTIONS.slice();
    applyTexts(); applyOrder(); save();
  });

  /* ---------- 할일 창 보이기/숨기기 ---------- */
  function applySide() {
    document.body.classList.toggle('no-side', !state.showTodos);
    $('#side').hidden = !state.showTodos;
    $('#showTodosToggle').checked = !!state.showTodos;
    if (state.showTodos) renderPanel();
  }
  $('#showTodosToggle').addEventListener('change', e => { state.showTodos = e.target.checked; applySide(); save(); });
  /** 할일 입력으로 보내기: 창이 있으면 사이드바, 없으면 오늘 날짜 창 */
  function sendToTodo(prefix) {
    if (state.showTodos) {
      const inp = $('#todoText');
      inp.value = prefix;
      $('#side').scrollIntoView({ behavior: 'smooth', block: 'start' });
      inp.focus();
    } else {
      openDay(todayStr());
      const inp = $('#dmTodoText');
      inp.value = prefix;
      setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 60);
    }
  }

  /* ---------- 오른쪽 패널 (그 날의 일정·메모·할일·일기) ---------- */
  const PANEL_KEYS = ['events', 'memo', 'todos', 'diary', 'upcoming'];
  function panelOpen(k) { return state.panels[k] !== false; }   // 기본은 펼침
  function shiftDay(n) {
    const [y, m, d] = (selectedDate || todayStr()).split('-').map(Number);
    const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n);
    selectedDate = ymd(dt);
    calCursor = new Date(dt.getFullYear(), dt.getMonth(), 1);
    $('#todoDate').value = selectedDate;
    renderCalendar(); renderTodos(); renderPanel();
  }
  $('#sideDayPrev').addEventListener('click', () => shiftDay(-1));
  $('#sideDayNext').addEventListener('click', () => shiftDay(1));
  $('#sideDayToday').addEventListener('click', () => {
    selectedDate = todayStr();
    calCursor = new Date(); calCursor.setDate(1);
    $('#todoDate').value = selectedDate;
    renderCalendar(); renderTodos(); renderPanel();
  });
  $('#sidePanels').addEventListener('click', e => {
    const head = e.target.closest('.panel-h'); if (!head) return;
    const key = head.closest('.panel').dataset.panel;
    state.panels[key] = !panelOpen(key);
    save(); applyPanels();
  });
  function applyPanels() {
    $$('#sidePanels .panel').forEach(p => {
      const open = panelOpen(p.dataset.panel);
      p.classList.toggle('closed', !open);
      p.querySelector('.panel-b').hidden = !open;
      p.querySelector('.tw').textContent = open ? '▾' : '▸';
    });
  }
  function renderPanel() {
    if (!state.showTodos) return;
    const sd = selectedDate || todayStr();
    const [yy, mm, dd] = sd.split('-').map(Number);
    const wd = '일월화수목금토'[new Date(yy, mm - 1, dd).getDay()];
    const diff = daysFromToday(sd), hol = HOLIDAYS[sd];
    $('#sideDayLabel').textContent = (diff === 0 ? '오늘' : diff === 1 ? '내일' : diff === -1 ? '어제' : diff > 0 ? `D-${diff}` : `${-diff}일 전`) + (hol ? ' · ' + hol : '');
    $('#sideDayTitle').textContent = `${mm}월 ${dd}일 (${wd})`;
    $('#sideDayTitle').className = hol || wd === '일' ? 'sun' : wd === '토' ? 'sat' : '';

    // 일정
    const evs = eventsOn(sd);
    $('#pnEventsN').textContent = evs.length || '';
    $('#pnEvents').innerHTML = (evs.length ? evs.map(e => `<div class="pn-ev" data-ev="${e.id}"><span class="ev-dot ev-${e.color}"></span><div class="pn-ev-body"><b>${esc(e.title || '(제목 없음)')}</b><div class="muted small">${evRange(e)}${e.memo ? ' · ' + esc(e.memo) : ''}</div></div></div>`).join('')
      : '<p class="muted small pn-empty">이 날 일정이 없어요.</p>')
      + '<button type="button" class="text-btn pn-add" id="pnAddEvent">＋ 일정 추가</button>';

    // 메모 + 표시
    const meta = dayOf(sd);
    $('#pnMemoN').textContent = meta.memo ? '있음' : '';
    if (document.activeElement !== $('#pnMemoText')) $('#pnMemoText').value = meta.memo || '';
    $('#pnStickers').innerHTML = `<button type="button" class="mood sm ${!meta.sticker ? 'on' : ''}" data-sticker="">없음</button>` + STICKERS.slice(0, 8).map(st => `<button type="button" class="mood sm ${meta.sticker === st ? 'on' : ''}" data-sticker="${st}">${st}</button>`).join('');
    $('#pnHls').innerHTML = `<button type="button" class="hl-btn sm none ${!meta.hl ? 'on' : ''}" data-hl="" title="없음">×</button>` + HL_COLORS.map(c => `<button type="button" class="hl-btn sm hl-${c} ${meta.hl === c ? 'on' : ''}" data-hl="${c}"></button>`).join('');

    // 일기
    const di = state.diary.notes.find(n => n.date === sd);
    $('#pnDiaryN').textContent = di ? (di.mood || '✓') : '';
    $('#pnDiary').innerHTML = di
      ? `<div class="pn-diary" data-pid="${di.id}"><b>${esc(postTitle(di))}</b><p class="muted small">${esc((di.text || '').slice(0, 80))}</p></div><button type="button" class="text-btn pn-add" id="pnOpenDiary">일기 열기</button>`
      : `<p class="muted small pn-empty">이 날 일기가 없어요.</p><button type="button" class="text-btn pn-add" id="pnWriteDiary">＋ 이 날 일기 쓰기</button>`;

    // 다가오는 일정
    const today = todayStr();
    const up = state.events.filter(e => e.end >= today).sort((x, y) => x.start.localeCompare(y.start)).slice(0, 5);
    $('#pnUpN').textContent = up.length || '';
    $('#pnUpcoming').innerHTML = up.length ? up.map(e => {
      const dd2 = daysBetween(today, e.start);
      const tag = dd2 > 0 ? `D-${dd2}` : (e.start <= today && e.end >= today ? '진행 중' : '오늘');
      return `<div class="pn-ev" data-date="${e.start}"><span class="ev-dot ev-${e.color}"></span><div class="pn-ev-body"><b>${esc(e.title || '(제목 없음)')}</b><div class="muted small">${evRange(e)}</div></div><span class="up-tag ${dd2 <= 0 ? 'now' : ''}">${tag}</span></div>`;
    }).join('') : '<p class="muted small pn-empty">예정된 일정이 없어요.</p>';

    applyPanels();
  }
  let pnMemoTimer = null;
  $('#pnMemoText').addEventListener('input', () => {
    const sd = selectedDate || todayStr();
    setDay(sd, { memo: $('#pnMemoText').value.trim() });
    clearTimeout(pnMemoTimer);
    pnMemoTimer = setTimeout(() => { save(); renderCalendar(); $('#pnMemoN').textContent = dayOf(sd).memo ? '있음' : ''; }, 600);
  });
  $('#pnStickers').addEventListener('click', e => { const b2 = e.target.closest('[data-sticker]'); if (!b2) return; setDay(selectedDate, { sticker: b2.dataset.sticker }); save(); renderPanel(); renderCalendar(); });
  $('#pnHls').addEventListener('click', e => { const b2 = e.target.closest('[data-hl]'); if (!b2) return; setDay(selectedDate, { hl: b2.dataset.hl }); save(); renderPanel(); renderCalendar(); });
  $('#pnEvents').addEventListener('click', e => {
    if (e.target.closest('#pnAddEvent')) { openDay(selectedDate); setTimeout(() => $('#dmEvTitle').focus(), 80); return; }
    const row = e.target.closest('.pn-ev'); if (row) openDay(selectedDate);
  });
  $('#pnDiary').addEventListener('click', e => {
    if (e.target.closest('#pnWriteDiary')) { openDiaryDate(selectedDate); return; }
    if (e.target.closest('#pnOpenDiary') || e.target.closest('.pn-diary')) {
      const di = state.diary.notes.find(n => n.date === selectedDate);
      if (di) { current = { kind: 'diary', id: 'diary' }; openPost(di.id); }
    }
  });
  $('#pnUpcoming').addEventListener('click', e => {
    const row = e.target.closest('[data-date]'); if (!row) return;
    selectedDate = row.dataset.date;
    const [y2, m2] = selectedDate.split('-').map(Number);
    calCursor = new Date(y2, m2 - 1, 1);
    $('#todoDate').value = selectedDate;
    renderCalendar(); renderTodos(); renderPanel();
    $('#calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- 섹션 순서 ---------- */
  function applyOrder() {
    const main = $('#main');
    const bySec = {};
    $$('[data-sec]', main).forEach(el => { bySec[el.dataset.sec] = el; });
    const fixed = $$('[data-fixed]', main);
    state.order.forEach(k => { if (bySec[k]) main.appendChild(bySec[k]); });
    fixed.forEach(el => main.appendChild(el));
  }
  document.addEventListener('click', e => {
    const up = e.target.closest('.sec-up'), down = e.target.closest('.sec-down');
    if (!up && !down) return;
    const sec = e.target.closest('[data-sec]').dataset.sec;
    const i = state.order.indexOf(sec);
    const j = up ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= state.order.length) return;
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    applyOrder(); save();
    e.target.closest('[data-sec]').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---------- 자산 ---------- */
  function valueOf(a) {
    if (a.kind === 'stock') {
      const q = Number(state.qty[a.id]);
      const p = prices[a.id] && prices[a.id].price;
      return (q > 0 && p > 0) ? q * p : null;
    }
    const v = state.now[a.id];
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  function renderAssets() {
    const body = $('#assetBody');
    body.innerHTML = '';
    let totalCost = 0, totalNow = 0, anyNow = false;

    ASSETS.forEach(a => {
      const val = valueOf(a);
      const use = val === null ? a.cost : val;
      const pnl = use - a.cost;
      totalCost += a.cost; totalNow += use; if (val !== null) anyNow = true;

      const cls = val === null ? 'flat' : pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'flat';
      const pnlText = val === null ? '—' : `${signed(pnl)}<br><span class="pnl-pct">${pct1(pnl / a.cost * 100)}</span>`;

      let qtyCell, priceCell, valCell;
      if (a.kind === 'stock') {
        const q = state.qty[a.id];
        qtyCell = `<input class="qty" data-id="${a.id}" inputmode="numeric" placeholder="수량" value="${q ? Number(q).toLocaleString('ko-KR') : ''}">`;
        const p = prices[a.id];
        priceCell = p && p.price
          ? `${p.price.toLocaleString('ko-KR')}<br><span class="chg ${p.prev && p.price >= p.prev ? 'up' : 'down'}">${p.prev ? pct1((p.price - p.prev) / p.prev * 100) : ''}</span>`
          : '<span class="muted">—</span>';
        valCell = val === null ? '<span class="muted">수량 입력</span>' : won(val);
      } else {
        qtyCell = '<span class="muted">—</span>';
        priceCell = '<span class="muted">—</span>';
        const v = state.now[a.id];
        valCell = `<input class="now" data-id="${a.id}" inputmode="numeric" placeholder="${a.cost.toLocaleString('ko-KR')}" value="${(typeof v === 'number') ? v.toLocaleString('ko-KR') : ''}">`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="name">${esc(a.name)}</td>
        <td class="where">${esc(a.where)}</td>
        <td class="num">${won(a.cost)}</td>
        <td class="num">${qtyCell}</td>
        <td class="num">${priceCell}</td>
        <td class="num">${valCell}</td>
        <td class="num pnl ${cls}">${pnlText}</td>`;
      body.appendChild(tr);
    });

    $('#assetTotalCost').textContent = won(totalCost);
    $('#assetTotalNow').textContent = anyNow ? won(totalNow) : '—';
    const tp = totalNow - totalCost;
    const tpEl = $('#assetTotalPnl');
    tpEl.innerHTML = anyNow ? `${signed(tp)}<br><span class="pnl-pct">${pct1(tp / totalCost * 100)}</span>` : '—';
    tpEl.className = 'num pnl ' + (anyNow ? (tp > 0 ? 'up' : tp < 0 ? 'down' : 'flat') : 'flat');

    $('#sumAssets').textContent = anyNow ? korean(totalNow) : korean(totalCost);
    const sub = $('#sumAssetsNow');
    if (anyNow) {
      sub.textContent = `원금 ${korean(totalCost)} · ${signed(tp)} 원 (${pct1(tp / totalCost * 100)})`;
      sub.className = 'stat-sub ' + (tp > 0 ? 'up' : tp < 0 ? 'down' : '');
    } else {
      sub.textContent = '원금 기준 · 수량을 넣으면 평가금액이 나와요';
      sub.className = 'stat-sub';
    }

    renderLadder();
    renderQuoteNote();
    renderGoals();
  }

  /** 시세 안내: 체결 시각 기준으로 표시 (서버가 주면), 아니면 가져온 시각 */
  function renderQuoteNote() {
    const note = $('#quoteNote');
    const keys = Object.keys(prices);
    if (!pin) { note.textContent = '시세를 자동으로 가져오려면 아래 ☁️ 동기화에서 PIN을 넣어주세요.'; return; }
    if (!keys.length) { note.textContent = '시세를 불러오는 중…'; return; }
    const errs = keys.filter(k => prices[k].error);
    if (errs.length) { note.textContent = `시세 일부 실패: ${errs.map(k => prices[k].name || k).join(', ')}`; return; }
    const p = prices.emtec || prices[keys[0]];
    const mt = p.marketTime ? new Date(p.marketTime) : null;
    const ft = p.time ? new Date(p.time) : new Date();
    if (mt) {
      const isToday = ymd(mt) === todayStr();
      const ageMin = Math.max(0, Math.round((Date.now() - mt.getTime()) / 60000));
      const label = `${mt.getMonth() + 1}/${mt.getDate()} ${pad(mt.getHours())}:${pad(mt.getMinutes())}`;
      note.textContent = isToday && ageMin < 60
        ? `${label} 체결가 · 약 ${ageMin}분 전 · 15분쯤 지연될 수 있어요`
        : `${label} 종가 기준 · 장이 열리면 자동으로 바뀌어요 (30분마다 갱신)`;
    } else {
      note.textContent = `시세 가져온 시각 ${ft.getMonth() + 1}/${ft.getDate()} ${pad(ft.getHours())}:${pad(ft.getMinutes())} · 장 마감 후에는 종가가 표시돼요`;
    }
  }

  $('#assetBody').addEventListener('change', e => {
    const q = e.target.closest('input.qty');
    if (q) {
      const raw = q.value.replace(/[^\d.]/g, '');
      if (raw === '') delete state.qty[q.dataset.id];
      else { const n = Number(raw); if (isFinite(n) && n >= 0) state.qty[q.dataset.id] = n; }
      save(); renderAssets(); return;
    }
    const inp = e.target.closest('input.now');
    if (!inp) return;
    const raw = inp.value.replace(/[^\d.-]/g, '');
    if (raw === '') delete state.now[inp.dataset.id];
    else { const n = Number(raw); if (isFinite(n)) state.now[inp.dataset.id] = n; }
    save(); renderAssets();
  });
  $('#assetBody').addEventListener('focusin', e => {
    const inp = e.target.closest('input.qty, input.now'); if (!inp) return;
    inp.value = inp.value.replace(/,/g, ''); inp.select();
  });

  /* ---------- 도장깨기 ---------- */
  function poolAmount() {
    let sum = valueOf(ASSETS[2]) ?? ASSETS[2].cost;
    if (state.useStocks) ASSETS.forEach(a => { if (a.kind === 'stock') sum += (valueOf(a) ?? a.cost); });
    return sum;
  }
  function allocate() {
    let left = poolAmount();
    return LADDER.map(step => {
      const got = Math.min(left, step.amount);
      left -= got;
      return { step, got, short: step.amount - got, p: pct(got, step.amount) };
    });
  }
  function renderLadder() {
    const rows = allocate();
    const cashV = valueOf(ASSETS[2]) ?? ASSETS[2].cost;
    const ci = $('#cashInput');
    if (document.activeElement !== ci) ci.value = cashV.toLocaleString('ko-KR');
    $('#useStocks').checked = !!state.useStocks;
    $('#ladderPool').textContent = '가용 자금 ' + korean(poolAmount());

    $('#ladderList').innerHTML = rows.map((r, i) => {
      const done = r.short <= 0;
      const active = !done && rows.slice(0, i).every(x => x.short <= 0);
      const fill = done ? '' : active ? 'gold' : 'dim';
      const status = done ? '✓ 준비 완료' : active ? '지금 이 칸' : '순서 대기';
      return `<li class="step ${done ? 'done' : ''} ${active ? 'active' : ''} ${r.step.long ? 'long' : ''}">
        <span class="step-rank">${done ? '✓' : i + 1}</span>
        <div class="step-body">
          <div class="step-top">
            <span class="step-title">${r.step.emoji} ${esc(r.step.title)}${r.step.long ? ' <em>장기</em>' : ''}</span>
            <span class="step-amt">${won(r.step.amount)}</span>
          </div>
          <div class="bar"><div class="bar-fill ${fill}" style="width:${r.p}%"></div></div>
          <div class="step-note"><b>${status}</b> · ${korean(r.got)} / ${korean(r.step.amount)}${done ? '' : ' · ' + korean(r.short) + ' 남음'}</div>
          <div class="step-desc">${esc(r.step.desc)}</div>
        </div>
      </li>`;
    }).join('');

    const nowRows = rows.filter(r => !r.step.long);
    const need = nowRows.reduce((a, r) => a + r.step.amount, 0);
    const got = nowRows.reduce((a, r) => a + r.got, 0);
    const shortAll = need - got;
    $('#ladderTotal').innerHTML = `당장 목표 <b>${korean(need)}</b> 중 <b>${korean(got)}</b> 확보 · <b class="need">${korean(shortAll)}</b> 더 필요`;
    $('#sumJeonse').textContent = shortAll > 0 ? korean(shortAll) + ' 더' : '준비 완료';
    $('#sumJeonseSub').textContent = `${korean(need)} 중 ${korean(got)} 확보 · 전세 → 차 순서`;
    $('#jeonseNote').textContent = rows[0].short <= 0 ? '✓ 잔금과 수수료 준비 완료' : `${korean(rows[0].short)} 더 모으면 이 칸 통과`;
    const landNow = valueOf(ASSETS[3]) ?? ASSETS[3].cost;
    $('#houseBar').style.width = pct(landNow, HOUSE) + '%';
    $('#houseNote').textContent = `땅값 ${korean(landNow)}은 이미 확보 · 건축비는 도장깨기 3번째 칸`;
  }
  $('#cashInput').addEventListener('change', e => {
    const raw = e.target.value.replace(/[^\d.]/g, '');
    if (raw === '') delete state.now.cash; else state.now.cash = Number(raw) || 0;
    save(); renderAssets();
  });
  $('#cashInput').addEventListener('focusin', e => { e.target.value = e.target.value.replace(/,/g, ''); e.target.select(); });
  $('#useStocks').addEventListener('change', e => { state.useStocks = e.target.checked; save(); renderAssets(); });

  /* ---------- 목표 / 일 카드 ---------- */
  function goalProgress(key) {
    if (!key) return null;
    if (key === 'weight') {
      if (!state.weight) return { p: 0, note: '현재 체중을 적어줘' };
      const start = state.weightStart || state.weight;
      const left = Math.max(0, state.weight - TARGET_WEIGHT);
      const p = start > TARGET_WEIGHT ? pct(start - state.weight, start - TARGET_WEIGHT) : 100;
      return { p, note: left ? `${left.toFixed(1)}kg 남음` : '목표 달성!' };
    }
    const r = allocate().find(x => x.step.id === key);
    if (!r) return null;
    return { p: r.p, note: r.short <= 0 ? '✓ 준비 완료' : `${korean(r.short)} 남음` };
  }
  function listOf(kind) { return kind === 'work' ? state.works : kind === 'diary' ? [state.diary] : state.goals; }
  function findItem(kind, id) { return listOf(kind).find(x => x.id === id); }
  function openTodos(tag) { return state.todos.filter(t => !t.done && t.text.startsWith(`[${tag}]`)).length; }

  function cardHtml(kind, it) {
    const pr = kind === 'goal' ? goalProgress(it.bar) : null;
    const noteCount = (it.notes || []).length;
    const open = it.tag ? openTodos(it.tag) : 0;
    const chip = kind === 'work' ? `<span class="chip ${esc(it.status)}">${esc(STATUS_LABEL[it.status] || it.status)}</span>` : '';
    return `<article class="goal item ${kind}" data-kind="${kind}" data-id="${it.id}" draggable="${editing ? 'true' : 'false'}" tabindex="0" role="button" title="누르면 자세히">
      ${editing ? '<span class="drag-handle" title="끌어서 순서 바꾸기">⋮⋮</span>' : ''}
      ${chip}
      <span class="goal-emoji">${esc(it.emoji || '📌')}</span>
      <h3>${esc(it.title || '(제목 없음)')}</h3>
      <p>${esc(it.desc || '')}</p>
      ${pr ? `<div class="bar"><div class="bar-fill ${it.bar === 'weight' ? 'pink' : ''}" style="width:${pr.p}%"></div></div><p class="bar-note">${esc(pr.note)}</p>` : ''}
      <div class="card-foot">
        ${it.tag ? `<button type="button" class="goal-add" data-tag="${esc(it.tag)}">+ 할일</button>` : ''}
        <span class="card-meta muted">${open ? `할일 ${open}` : ''}${open && noteCount ? ' · ' : ''}${noteCount ? `<button type="button" class="link-btn card-notes" data-kind="${kind}" data-id="${it.id}">📝 기록 ${noteCount}</button>` : ''}</span>
      </div>
    </article>`;
  }
  function renderGrid(kind) {
    const grid = $(kind === 'work' ? '#workGrid' : '#goalGrid');
    const all = listOf(kind), shown = all.filter(it => !it.hidden), hiddenN = all.length - shown.length;
    grid.innerHTML = shown.map(it => cardHtml(kind, it)).join('')
      + `<button type="button" class="goal add-card" data-add="${kind}"><span class="goal-emoji">＋</span><h3>${kind === 'work' ? '일 추가' : '목표 추가'}</h3><p>${kind === 'work' ? '새로 시작한 일, 앱, 가게' : '새로운 꿈, 하고 싶은 것'}</p>${hiddenN ? `<span class="muted small">홈에서 숨긴 카드 ${hiddenN}개 · 전체보기에서 관리</span>` : ''}</button>`;
  }
  function renderGoals() { renderGrid('goal'); }
  function renderWork() { renderGrid('work'); }

  // 카드 클릭 → 상세 / + 할일 / 추가
  document.addEventListener('click', e => {
    const addBtn = e.target.closest('.goal-add');
    if (addBtn) {
      e.stopPropagation();
      closeItemModal();
      sendToTodo(`[${addBtn.dataset.tag}] `);
      return;
    }
    const notesBtn = e.target.closest('.card-notes');
    if (notesBtn) { e.stopPropagation(); current = { kind: notesBtn.dataset.kind, id: notesBtn.dataset.id }; openList(); return; }
    const add = e.target.closest('.add-card');
    if (add) { addItem(add.dataset.add); return; }
    const card = e.target.closest('.item[data-id]');
    if (card && !e.target.closest('.drag-handle')) openItemModal(card.dataset.kind, card.dataset.id);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest && e.target.closest('.item[data-id]');
    if (card && e.target === card) { e.preventDefault(); openItemModal(card.dataset.kind, card.dataset.id); }
  });
  function addItem(kind) {
    const it = kind === 'work'
      ? { id: uid(), emoji: '🛠', title: '', desc: '', tag: '', status: 'build', notes: [] }
      : { id: uid(), emoji: '🌟', title: '', desc: '', tag: '', bar: '', notes: [] };
    listOf(kind).push(it);
    save(); renderGrid(kind);
    openItemModal(kind, it.id, true);
  }

  // 드래그로 순서 바꾸기 (꾸미기 모드)
  let dragging = null;
  document.addEventListener('dragstart', e => {
    const card = e.target.closest && e.target.closest('.item[data-id]');
    if (!card || !editing) { e.preventDefault(); return; }
    dragging = { kind: card.dataset.kind, id: card.dataset.id };
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (x) {}
  });
  document.addEventListener('dragend', () => {
    $$('.item.dragging').forEach(c => c.classList.remove('dragging'));
    $$('.item.drop-before, .item.drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
    dragging = null;
  });
  document.addEventListener('dragover', e => {
    if (!dragging) return;
    const card = e.target.closest && e.target.closest('.item[data-id]');
    if (!card || card.dataset.kind !== dragging.kind) return;
    e.preventDefault();
    const r = card.getBoundingClientRect();
    const before = (e.clientX - r.left) < r.width / 2;
    $$('.item.drop-before, .item.drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
    card.classList.add(before ? 'drop-before' : 'drop-after');
  });
  document.addEventListener('drop', e => {
    if (!dragging) return;
    const card = e.target.closest && e.target.closest('.item[data-id]');
    if (!card || card.dataset.kind !== dragging.kind) return;
    e.preventDefault();
    const list = listOf(dragging.kind);
    const from = list.findIndex(x => x.id === dragging.id);
    let to = list.findIndex(x => x.id === card.dataset.id);
    if (from < 0 || to < 0) return;
    const r = card.getBoundingClientRect();
    const before = (e.clientX - r.left) < r.width / 2;
    const [moved] = list.splice(from, 1);
    if (from < to) to -= 1;
    list.splice(before ? to : to + 1, 0, moved);
    save(); renderGrid(dragging.kind);
  });

  /* ---------- 카드 상세 팝업 ---------- */
  let current = null;   // { kind, id }
  let itemOpen = false;
  function openItemModal(kind, id, isNew) {
    const it = findItem(kind, id); if (!it) return;
    current = { kind, id };
    itemOpen = true;
    $('#imEmoji').value = it.emoji || '';
    $('#imTitle').value = it.title || '';
    $('#imDesc').value = it.desc || '';
    $('#imTag').value = it.tag || '';
    $('#imBarWrap').hidden = kind !== 'goal';
    $('#imStatusWrap').hidden = kind !== 'work';
    if (kind === 'goal') $('#imBar').value = it.bar || '';
    else $('#imStatus').value = it.status || 'build';
    $('#imShow').checked = !it.hidden;
    $('#imSaved').textContent = '';
    board.postId = null; board.draft = null; board.listBoard = 'all'; board.editBoards = false;
    renderTeaser(); renderList(); showView('card');
    $('#itemModal').hidden = false;
    if (isNew) setTimeout(() => $('#imTitle').focus(), 50);
  }
  function closeItemModal() {
    if (!itemOpen) return;
    itemOpen = false; board.draft = null;
    if (!document.body.classList.contains('on-board')) current = null;
    $('#itemModal').hidden = true;
  }
  function curItem() { return current ? findItem(current.kind, current.id) : null; }
  function touched() {
    const it = curItem(); if (!it) return;
    save();
    $('#imSaved').textContent = '저장됨 · ' + new Date().toLocaleTimeString('ko-KR');
    if (current.kind === 'diary') renderDiary(); else renderGrid(current.kind);
  }
  function bindField(sel, key, transform) {
    const el = $(sel);
    const handler = () => {
      const it = curItem(); if (!it) return;
      it[key] = transform ? transform(el.value) : el.value;
      touched();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  }
  bindField('#imEmoji', 'emoji', v => v.trim());
  bindField('#imTitle', 'title', v => v.trim());
  bindField('#imDesc', 'desc', v => v.trim());
  bindField('#imTag', 'tag', v => v.replace(/[\[\]]/g, '').trim());
  bindField('#imBar', 'bar');
  bindField('#imStatus', 'status');
  $('#imShow').addEventListener('change', e => { const it = curItem(); if (!it) return; it.hidden = !e.target.checked; touched(); });
  /** 카드의 세부 게시판 이름 */
  function boardName(it, bid) { const b = (it.boards || []).find(x => x.id === bid); return b ? (b.name || '(이름 없음)') : ''; }
  function fillBoardSelect(sel, it, val) {
    sel.innerHTML = '<option value="">미분류</option>' + (it.boards || []).map(b => `<option value="${b.id}">${esc(b.name || '(이름 없음)')}</option>`).join('');
    sel.value = val || '';
    if (sel.value !== (val || '')) sel.value = '';
  }

  /* ---------- 기록 게시판 (카드마다 글 목록 · 보기 · 쓰기 · 수정) ---------- */
  const board = { view: 'card', postId: null, draft: null, listBoard: 'all', editBoards: false };
  const PHOTO_MAX = 240;      // 긴 변 기준 픽셀. 알아볼 정도로만 작게.
  const PHOTO_Q = 0.6;
  const PHOTO_LIMIT = 6;      // 글 하나당 사진 수
  function showView(v) {
    board.view = v;
    const onPage = v === 'list' || v === 'post' || v === 'edit' || v === 'hub' || v === 'all';
    const hubLike = v === 'hub' || v === 'all';
    $('#imViewCard').hidden = onPage;
    $('#bdViewHub').hidden = v !== 'hub';
    $('#bdViewAll').hidden = v !== 'all';
    $('#bdViewList').hidden = v !== 'list';
    $('#bdViewPost').hidden = v !== 'post';
    $('#bdViewEdit').hidden = v !== 'edit';
    $('#bdEdit').hidden = v !== 'post';
    $('#bdDelete').hidden = v !== 'post';
    $('#bdNew').hidden = !(v === 'list' || v === 'post');
    $('#bdBackList').textContent = (v === 'list' || hubLike) ? '← 대시보드' : '← 목록으로';
    document.body.classList.toggle('on-board', onPage);
    $('#boardPage').hidden = !onPage;
    if (onPage) {
      $('#itemModal').hidden = true; itemOpen = false;
      const it = hubLike ? null : curItem();
      if (it) {
        $('#bdCardEmoji').textContent = it.emoji || '📌';
        $('#bdCardTitle').textContent = it.title || '(제목 없음)';
        $('#bdCardKind').textContent = current.kind === 'diary' ? '나의 하루' : (current.kind === 'work' ? '하는 일' : '꿈과 목표') + ' · 기록';
      } else if (v === 'hub') {
        $('#bdCardEmoji').textContent = '📚';
        $('#bdCardTitle').textContent = hub.kind === 'work' ? '하는 일 게시판' : hub.kind === 'goal' ? '꿈과 목표 게시판' : hub.kind === 'diary' ? '다이어리' : '기록 게시판 전체';
        $('#bdCardKind').textContent = '전체보기';
      } else if (v === 'all') {
        $('#bdCardEmoji').textContent = hub.q ? '🔍' : '📚';
        $('#bdCardTitle').textContent = hub.q ? `"${hub.q}" 찾기` : '전체 글';
        $('#bdCardKind').textContent = '모든 게시판';
      }
      window.scrollTo({ top: 0 });
    } else {
      const box = $('#itemModal .modal-box'); if (box) box.scrollTop = 0;
    }
  }
  /** 주소(#post/..., #write/..., #edit/...)로 페이지를 연다. 뒤로 가기가 동작한다. */
  function go(sub, replace) {
    const hash = '#' + sub;
    if (location.hash === hash) { route(); return; }
    if (replace) history.replaceState(null, '', location.pathname + location.search + hash); else location.hash = sub;
    if (replace) route();
  }
  function route() {
    const hb = location.hash.match(/^#boards(?:\/(goal|work|diary))?$/);
    if (hb) { hub.kind = hb[1] || null; renderHub(); showView('hub'); return; }
    const ap = location.hash.match(/^#posts(?:\/(.*))?$/);
    if (ap) { hub.q = ap[1] ? decodeURIComponent(ap[1]) : ''; renderAllPosts(); showView('all'); return; }
    const m = location.hash.match(/^#(list|post|write|edit)\/(goal|work|diary)\/([^/]+)(?:\/([^/]+))?$/);
    if (!m) {
      // 페이지에서 나옴 → 대시보드. 카드가 있었다면 카드 창을 다시 연다.
      if (document.body.classList.contains('on-board')) {
        const back = current;
        $('#boardPage').hidden = true; document.body.classList.remove('on-board');
        board.draft = null;
        if (back && back.kind !== 'diary' && findItem(back.kind, back.id)) openItemModal(back.kind, back.id);
      }
      return;
    }
    const kind = m[2], id = m[3], pid = m[4];
    if (!findItem(kind, id)) { history.replaceState(null, '', location.pathname + location.search); route(); return; }
    current = { kind, id };
    if (m[1] === 'list') {
      const it = findItem(kind, id);
      board.listBoard = !pid ? 'all' : pid === 'none' ? '' : (it.boards.some(b => b.id === pid) ? pid : 'all');
      renderList(); showView('list');
    }
    else if (m[1] === 'post') renderPostPage(pid);
    else if (m[1] === 'edit') renderEditorPage(pid);
    else renderEditorPage(null);
  }
  window.addEventListener('hashchange', route);
  function postsOf(it) {
    const arr = (it.notes || []).slice();
    if (it.id === 'diary') return arr.sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.at || 0) - (x.at || 0));
    return arr.sort((x, y) => (y.at || 0) - (x.at || 0));
  }
  function diaryLabel(n) { return n.date ? dateLabel(n.date) : whenLabel(n.at); }
  function postTitle(n) {
    const base = (n.title && n.title.trim()) || (n.text || '').split('\n')[0].trim().slice(0, 40) || (n.photos && n.photos.length ? '(사진)' : (n.date ? diaryLabel(n) + ' 일기' : '(제목 없음)'));
    return (n.mood ? n.mood + ' ' : '') + base;
  }
  function postItemHtml(n, it) {
    const thumb = n.photos && n.photos.length ? `<img class="post-thumb" src="${n.photos[0]}" alt="">` : '';
    const snip = (n.text || '').replace(/\s+/g, ' ').trim().slice(0, 70);
    const bn = it && n.board ? boardName(it, n.board) : '';
    return `<li data-pid="${n.id}" tabindex="0">${thumb}<div class="post-item-body">
      <div class="post-item-title">${bn ? `<span class="todo-tag">${esc(bn)}</span>` : ''}${esc(postTitle(n))}</div>
      ${snip ? `<div class="post-item-snip muted small">${esc(snip)}</div>` : ''}
      <div class="muted small">${it && it.id === 'diary' ? diaryLabel(n) : whenLabel(n.at)}${n.photos && n.photos.length ? ` · 사진 ${n.photos.length}` : ''}</div>
    </div></li>`;
  }
  function renderTeaser() {
    const it = curItem(); if (!it) return;
    const ps = postsOf(it);
    $('#imNoteCount').textContent = ps.length ? `${ps.length}개` : '';
    $('#imRecent').innerHTML = ps.length
      ? ps.slice(0, 3).map(n => postItemHtml(n, it)).join('')
      : '<li class="im-empty muted small">아직 글이 없어요. 새 글 쓰기로 첫 기록을 남겨보자.</li>';
  }
  function renderList() {
    const it = curItem(); if (!it) return;
    const all = postsOf(it);
    const f = board.listBoard;   // 'all' | '' (미분류) | boardId
    const countOf = bid => all.filter(n => (n.board || '') === bid).length;
    $('#listBoards').innerHTML =
      `<button type="button" class="chip-btn ${f === 'all' ? 'on' : ''}" data-board="all">전체 ${all.length}</button>` +
      (it.boards || []).map(b => `<button type="button" class="chip-btn ${f === b.id ? 'on' : ''}" data-board="${b.id}">${esc(b.name || '(이름 없음)')} ${countOf(b.id)}</button>`).join('') +
      (countOf('') || !it.boards.length ? `<button type="button" class="chip-btn ${f === '' ? 'on' : ''}" data-board="">미분류 ${countOf('')}</button>` : '') +
      `<button type="button" class="chip-btn ghost" data-board="__edit">${board.editBoards ? '✓ 관리 끝' : '⚙️ 세부 게시판 관리'}</button>`;
    $('#listBoardEditor').hidden = !board.editBoards;
    if (board.editBoards) {
      $('#listBoardList').innerHTML = it.boards.length ? it.boards.map(b =>
        `<li data-bid="${b.id}"><input value="${esc(b.name)}" maxlength="20" placeholder="세부 게시판 이름"><span class="muted small">${countOf(b.id)}개</span><button type="button" class="text-btn board-up" title="위로">▲</button><button type="button" class="text-btn board-down" title="아래로">▼</button><button type="button" class="text-btn danger board-del">지우기</button></li>`).join('')
        : '<li class="muted small">아직 세부 게시판이 없어요. 아래에서 만들어 보세요.</li>';
    }
    const ps = f === 'all' ? all : all.filter(n => (n.board || '') === f);
    $('#bdPosts').innerHTML = ps.length ? ps.map(n => postItemHtml(n, it)).join('') : `<li class="im-empty muted small">${f === 'all' ? '아직 글이 없어요.' : '이 세부 게시판에는 아직 글이 없어요.'}</li>`;
  }
  $('#listBoards').addEventListener('click', e => {
    const b = e.target.closest('.chip-btn'); if (!b) return;
    if (b.dataset.board === '__edit') { board.editBoards = !board.editBoards; renderList(); return; }
    openList(true, b.dataset.board === 'all' ? null : (b.dataset.board || 'none'));
  });
  $('#listBoardAdd').addEventListener('submit', e => {
    e.preventDefault();
    const it = curItem(); if (!it) return;
    const name = $('#listBoardName').value.trim(); if (!name) return;
    it.boards.push({ id: uid(), name });
    $('#listBoardName').value = '';
    touched(); renderList();
  });
  $('#listBoardList').addEventListener('change', e => {
    const li = e.target.closest('li[data-bid]'); const it = curItem(); if (!li || !it) return;
    const b = it.boards.find(x => x.id === li.dataset.bid); if (!b) return;
    b.name = li.querySelector('input').value.trim(); touched(); renderList();
  });
  $('#listBoardList').addEventListener('click', e => {
    const li = e.target.closest('li[data-bid]'); const it = curItem(); if (!li || !it) return;
    const i = it.boards.findIndex(x => x.id === li.dataset.bid); if (i < 0) return;
    if (e.target.closest('.board-del')) {
      const b = it.boards[i];
      if (!confirm(`"${b.name}" 세부 게시판을 지울까요? 안의 글 ${(it.notes || []).filter(n => n.board === b.id).length}개는 미분류로 남아요.`)) return;
      (it.notes || []).forEach(n => { if (n.board === b.id) n.board = ''; });
      it.boards.splice(i, 1);
      if (board.listBoard === b.id) board.listBoard = 'all';
    } else if (e.target.closest('.board-up')) { if (i === 0) return; [it.boards[i - 1], it.boards[i]] = [it.boards[i], it.boards[i - 1]]; }
    else if (e.target.closest('.board-down')) { if (i >= it.boards.length - 1) return; [it.boards[i + 1], it.boards[i]] = [it.boards[i], it.boards[i + 1]]; }
    else return;
    touched(); renderList();
  });
  function openList(replace, bid) {
    if (!current) return;
    const seg = bid === undefined ? (board.listBoard === 'all' ? '' : '/' + (board.listBoard || 'none')) : (bid ? '/' + bid : '');
    go(`list/${current.kind}/${current.id}${seg}`, replace);
  }
  function openPost(pid, replace) { if (!current) return; go(`post/${current.kind}/${current.id}/${pid}`, replace); }
  function openEditor(pid) { if (!current) return; go(pid ? `edit/${current.kind}/${current.id}/${pid}` : `write/${current.kind}/${current.id}`); }
  function renderPostPage(pid) {
    const it = curItem(); const n = it && it.notes.find(x => x.id === pid);
    if (!n) { go('', true); return; }
    board.postId = pid;
    $('#bdPostTitle').textContent = postTitle(n);
    const bn = n.board ? boardName(it, n.board) : '';
    $('#bdPostMeta').textContent = (it.id === 'diary' && n.date ? diaryLabel(n) + ' · ' : '') + (bn ? bn + ' · ' : '') + whenLabel(n.at) + (n.updatedAt ? ` · 수정 ${whenLabel(n.updatedAt)}` : '');
    if (n.html) {
      $('#bdPostPhotos').innerHTML = '';
      $('#bdPostBody').innerHTML = sanitizeHtml(n.html);
    } else {
      $('#bdPostPhotos').innerHTML = (n.photos || []).map(p => `<img src="${p}" alt="" class="post-photo">`).join('');
      $('#bdPostBody').innerHTML = esc(n.text || '').replace(/\n/g, '<br>');
    }
    const ps = postsOf(it), i = ps.findIndex(x => x.id === pid);
    $('#bdPrev').disabled = i >= ps.length - 1;   // 목록은 최신순 → 이전 글은 더 오래된 글
    $('#bdNext').disabled = i <= 0;
    $('#bdPrev').dataset.pid = i < ps.length - 1 ? ps[i + 1].id : '';
    $('#bdNext').dataset.pid = i > 0 ? ps[i - 1].id : '';
    showView('post');
  }
  function renderEditorPage(pid) {
    const it = curItem(); if (!it) return;
    const n = pid ? it.notes.find(x => x.id === pid) : null;
    if (pid && !n) { go('', true); return; }
    board.draft = { id: n ? n.id : null, title: n ? (n.title || '') : '' };
    fillBoardSelect($('#bdBoard'), it, n ? (n.board || '') : (board.listBoard === 'all' ? '' : board.listBoard));
    const isDiary = it.id === 'diary';
    $('#bdDateWrap').hidden = !isDiary;
    $('#bdMoodWrap').hidden = !isDiary;
    if (isDiary) {
      $('#bdDate').value = n ? (n.date || todayStr()) : (board.presetDate || todayStr());
      board.presetDate = null;
      board.draftMood = n ? (n.mood || '') : '';
      renderMoodPick();
    }
    $('#bdEditTitle').textContent = n ? (isDiary ? '일기 수정' : '글 수정') : (isDiary ? '오늘의 일기' : '새 글');
    $('#bdTitle').value = board.draft.title;
    // 예전 글(사진 배열 + 줄글)은 편집 가능한 서식으로 바꿔서 연다
    edBody.innerHTML = n
      ? (n.html ? sanitizeHtml(n.html)
        : (n.photos || []).map(p => `<img src="${p}" class="pic size-m pos-center" alt="">`).join('') + '<p>' + esc(n.text || '').replace(/\n/g, '<br>') + '</p>')
      : '';
    $('#bdEditNote').textContent = '';
    $('#imgTools').hidden = true; selectedImg = null;
    showView('edit');
    setTimeout(() => $(n ? '#bdEditor' : '#bdTitle').focus(), 50);
  }
  $('#bdPrev').addEventListener('click', e => { if (e.target.dataset.pid) openPost(e.target.dataset.pid); });
  $('#bdNext').addEventListener('click', e => { if (e.target.dataset.pid) openPost(e.target.dataset.pid); });
  function saveDraft() {
    const it = curItem(); if (!it || !board.draft) return;
    const title = $('#bdTitle').value.trim();
    const html = sanitizeHtml(edBody.innerHTML);
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const text = tmp.innerText.replace(/\u00a0/g, ' ').trim();
    const photos = Array.from(tmp.querySelectorAll('img')).map(i => i.getAttribute('src')).filter(Boolean);
    if (!title && !text && !photos.length && !(it.id === 'diary' && board.draftMood)) { $('#bdEditNote').textContent = '내용을 적어주세요.'; edBody.focus(); return; }
    if (board.draft.id) {
      const n = it.notes.find(x => x.id === board.draft.id);
      if (n) { n.title = title; n.text = text; n.html = html; n.photos = photos; n.board = $('#bdBoard').value || ''; n.updatedAt = Date.now(); if (it.id === 'diary') { n.date = $('#bdDate').value || n.date || todayStr(); n.mood = board.draftMood || ''; } }
      board.postId = board.draft.id;
    } else {
      const n = { id: uid(), title, text, html, photos, board: $('#bdBoard').value || '', at: Date.now() };
      if (it.id === 'diary') { n.date = $('#bdDate').value || todayStr(); n.mood = board.draftMood || ''; }
      it.notes.push(n); board.postId = n.id;
    }
    board.draft = null;
    touched(); renderTeaser(); renderList();
    openPost(board.postId, true);
  }

  /* ---------- 서식 편집기 ---------- */
  const edBody = $('#bdEditor');
  let selectedImg = null;
  const ALLOWED_FONTS = ['Nanum Myeongjo', 'Nanum Pen Script', 'Gaegu', 'Do Hyeon', 'Noto Sans KR'];
  const SIZE_MAP = { 1: '.75em', 2: '.88em', 3: '1em', 4: '1.2em', 5: '1.5em', 6: '2em', 7: '2.6em' };
  const IMG_CLASSES = ['pic', 'size-s', 'size-m', 'pos-left', 'pos-center', 'pos-right', 'pos-float'];
  /** 저장·표시 전에 허용된 태그/속성만 남긴다. 사진은 data: 이미지만. */
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
    const root = doc.body.firstChild;
    const ALLOW = { P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, SPAN: 1, DIV: 1, IMG: 1, UL: 1, OL: 1, LI: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, FONT: 1 };
    const walk = node => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) { ch.remove(); return; }
        let el = ch;
        if (!ALLOW[el.tagName]) {                       // 허용 안 된 태그는 내용만 남긴다
          const frag = doc.createDocumentFragment();
          while (el.firstChild) frag.appendChild(el.firstChild);
          el.replaceWith(frag);
          return walk(node);
        }
        if (el.tagName === 'FONT') {                     // <font> → <span style>
          const sp = doc.createElement('span');
          const st = [];
          const face = el.getAttribute('face'), size = el.getAttribute('size'), color = el.getAttribute('color');
          if (face && ALLOWED_FONTS.indexOf(face.replace(/['"]/g, '')) >= 0) st.push('font-family:' + face.replace(/['"]/g, ''));
          if (size && SIZE_MAP[size]) st.push('font-size:' + SIZE_MAP[size]);
          if (color && /^#[0-9a-f]{3,6}$/i.test(color)) st.push('color:' + color);
          if (st.length) sp.setAttribute('style', st.join(';'));
          while (el.firstChild) sp.appendChild(el.firstChild);
          el.replaceWith(sp); el = sp;
        }
        const keepStyle = [];
        const style = el.getAttribute('style') || '';
        style.split(';').forEach(rule => {
          const m = rule.match(/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i); if (!m) return;
          const k = m[1].toLowerCase(), v = m[2].replace(/['"]/g, '');
          if (k === 'font-family' && ALLOWED_FONTS.some(f => v.indexOf(f) >= 0)) keepStyle.push('font-family:' + ALLOWED_FONTS.find(f => v.indexOf(f) >= 0));
          else if (k === 'font-size' && /^([\d.]+(px|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/.test(v)) keepStyle.push('font-size:' + v);
          else if (k === 'color' && /^(#[0-9a-f]{3,6}|rgb\([\d\s,]+\))$/i.test(v)) keepStyle.push('color:' + v);
          else if (k === 'text-align' && /^(left|center|right)$/.test(v)) keepStyle.push('text-align:' + v);
        });
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter(c => IMG_CLASSES.indexOf(c) >= 0);
        const src = el.tagName === 'IMG' ? el.getAttribute('src') : null;
        Array.from(el.attributes).forEach(at => el.removeAttribute(at.name));
        if (keepStyle.length) el.setAttribute('style', keepStyle.join(';'));
        if (el.tagName === 'IMG') {
          if (!src || src.indexOf('data:image/') !== 0) { el.remove(); return; }
          el.setAttribute('src', src); el.setAttribute('alt', '');
          if (cls.indexOf('pic') < 0) cls.push('pic');
          if (!cls.some(c => c.indexOf('size-') === 0)) cls.push('size-m');
          if (!cls.some(c => c.indexOf('pos-') === 0)) cls.push('pos-center');
        }
        if (cls.length) el.setAttribute('class', cls.join(' '));
        walk(el);
      });
    };
    walk(root);
    return root.innerHTML;
  }
  function exec(cmd, val) {
    edBody.focus();
    try { document.execCommand('styleWithCSS', false, cmd === 'fontSize' ? false : true); } catch (e) {}
    document.execCommand(cmd, false, val == null ? null : val);
  }
  $('#edToolbar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });  // 선택 영역 유지
  $('#edToolbar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cmd) exec(b.dataset.cmd);
    else if (b.dataset.color) exec('foreColor', b.dataset.color);
  });
  $('#edFont').addEventListener('change', e => { if (e.target.value) exec('fontName', e.target.value); else exec('removeFormat'); e.target.value = ''; });
  $('#edSize').addEventListener('change', e => { if (e.target.value) exec('fontSize', e.target.value); e.target.value = ''; });
  // 붙여넣기는 글자만
  edBody.addEventListener('paste', e => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, t);
  });
  // 사진 선택 → 도구 표시
  edBody.addEventListener('click', e => {
    const img = e.target.closest('img');
    if (selectedImg) selectedImg.classList.remove('selected');
    selectedImg = img || null;
    if (img) { img.classList.add('selected'); $('#imgTools').hidden = false; }
    else $('#imgTools').hidden = true;
  });
  $('#imgTools').addEventListener('mousedown', e => e.preventDefault());
  $('#imgTools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !selectedImg) return;
    const v = b.dataset.img;
    if (v === 'remove') { selectedImg.remove(); selectedImg = null; $('#imgTools').hidden = true; return; }
    const group = v.indexOf('size-') === 0 ? 'size-' : 'pos-';
    Array.from(selectedImg.classList).forEach(c => { if (c.indexOf(group) === 0) selectedImg.classList.remove(c); });
    selectedImg.classList.add(v);
  });
  function insertImage(dataUrl) {
    edBody.focus();
    const html = `<img src="${dataUrl}" class="pic size-m pos-center" alt="">`;
    const sel = window.getSelection();
    if (sel && sel.rangeCount && edBody.contains(sel.anchorNode)) document.execCommand('insertHTML', false, html);
    else edBody.insertAdjacentHTML('beforeend', html);
  }

  /** 사진을 아주 작게 줄인다 (긴 변 PHOTO_MAX px, JPEG). 방향 정보(EXIF)도 반영. */
  async function shrinkImage(file) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      src = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
    }
    const w = src.width, h = src.height, k = Math.min(1, PHOTO_MAX / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(src, 0, 0, cw, ch);
    return c.toDataURL('image/jpeg', PHOTO_Q);
  }
  $('#bdPhoto').addEventListener('change', async e => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length || !board.draft) return;
    const have = edBody.querySelectorAll('img').length;
    const room = PHOTO_LIMIT - have;
    let note = files.length > room ? `사진은 글 하나에 ${PHOTO_LIMIT}장까지예요.` : '';
    $('#bdEditNote').textContent = '사진 줄이는 중…';
    for (const f of files.slice(0, Math.max(0, room))) {
      try { insertImage(await shrinkImage(f)); }
      catch (x) { note = '사진을 읽지 못했어요: ' + f.name; }
    }
    $('#bdEditNote').textContent = note;
  });
  $('#imOpenBoard').addEventListener('click', () => openList());
  $('#imNewPost').addEventListener('click', () => openEditor(null));
  $('#bdNew').addEventListener('click', () => openEditor(null));
  $('#bdBackList').addEventListener('click', () => {
    if (board.view === 'list' || board.view === 'hub' || board.view === 'all') go('', true);
    else openList(true);
  });
  $('#bdEdit').addEventListener('click', () => openEditor(board.postId));
  $('#bdDelete').addEventListener('click', () => {
    const it = curItem(); if (!it || !board.postId) return;
    if (!confirm('이 글을 지울까요?')) return;
    it.notes = it.notes.filter(x => x.id !== board.postId);
    board.postId = null;
    touched(); renderTeaser(); renderList();
    openList(true);
  });
  $('#bdCancel').addEventListener('click', () => {
    const wasEditing = board.draft && board.draft.id;
    board.draft = null;
    if (wasEditing) openPost(wasEditing, true); else openList(true);
  });
  $('#bdSave').addEventListener('click', saveDraft);
  edBody.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveDraft(); } });
  // 편집기 글씨체 미리보기용: <font face> 를 화면에서 바로 보이게
  edBody.addEventListener('input', () => { $('#bdEditNote').textContent = ''; });
  function postClick(e) {
    const li = e.target.closest('li[data-pid]'); if (!li) return;
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    openPost(li.dataset.pid);
  }
  $('#imRecent').addEventListener('click', postClick);
  $('#bdPosts').addEventListener('click', postClick);
  $('#bdPosts').addEventListener('keydown', postClick);

  $('#imTodo').addEventListener('click', () => {
    const it = curItem(); if (!it) return;
    const tag = it.tag || it.title;
    if (!tag) { $('#imTag').focus(); return; }
    closeItemModal();
    sendToTodo(`[${tag}] `);
  });
  function moveCurrent(delta) {
    if (!current) return;
    const list = listOf(current.kind);
    const i = list.findIndex(x => x.id === current.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    touched();
    $('#imSaved').textContent = `순서 ${j + 1}번째로 옮겼어요`;
  }
  $('#imLeft').addEventListener('click', () => moveCurrent(-1));
  $('#imRight').addEventListener('click', () => moveCurrent(1));
  $('#imDelete').addEventListener('click', () => {
    const it = curItem(); if (!it) return;
    const name = it.title || '(제목 없음)';
    if (!confirm(`"${name}" 카드를 지울까요?\n기록 ${it.notes.length}개도 함께 사라져요.`)) return;
    const kind = current.kind;
    if (kind === 'work') state.works = state.works.filter(x => x.id !== it.id);
    else state.goals = state.goals.filter(x => x.id !== it.id);
    closeItemModal(); save(); renderGrid(kind);
  });
  $('#imClose').addEventListener('click', closeItemModal);
  $('#itemModal').addEventListener('click', e => { if (e.target === $('#itemModal')) closeItemModal(); });

  /* ---------- 달력 ---------- */
  let calCursor = new Date(); calCursor.setDate(1);
  let selectedDate = todayStr();

  /* ---------- 달력: 일정 · 기간 일정 · 메모 · 형광펜 · 스티커 · 공휴일 ---------- */
  const EV_COLORS = ['blue', 'green', 'yellow', 'pink', 'purple', 'orange'];
  const HL_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'];
  const STICKERS = ['⭐', '❤️', '🎉', '✈️', '🍰', '💊', '💰', '🏋️', '📚', '🎵', '🌧️', '☀️', '🍺', '🎬', '💇', '🩺'];
  const HOLIDAYS = {
    '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴', '2026-03-01': '삼일절', '2026-03-02': '대체공휴일',
    '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일', '2026-06-06': '현충일', '2026-08-15': '광복절', '2026-08-17': '대체공휴일',
    '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴', '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
    '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '대체공휴일', '2027-03-01': '삼일절',
    '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체공휴일',
    '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체공휴일', '2027-10-09': '한글날', '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일'
  };
  function dayOf(sd) { return state.days[sd] || {}; }
  function setDay(sd, patch) {
    const d = Object.assign({}, state.days[sd] || {}, patch);
    Object.keys(d).forEach(k => { if (!d[k]) delete d[k]; });
    if (Object.keys(d).length) state.days[sd] = d; else delete state.days[sd];
  }
  function eventsOn(sd) { return state.events.filter(e => e.start <= sd && sd <= e.end).sort((x, y) => x.start.localeCompare(y.start) || (x.end.localeCompare(y.end))); }
  function evRange(e) { return e.start === e.end ? dateLabel(e.start) : `${dateLabel(e.start)} ~ ${dateLabel(e.end)} (${daysBetween(e.start, e.end) + 1}일)`; }
  function daysBetween(a1, b1) { const [y1, m1, d1] = a1.split('-').map(Number), [y2, m2, d2] = b1.split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000); }

  function renderCalendar() {
    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    $('#calTitle').textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    const grid = $('#calGrid'); grid.innerHTML = '';
    const today = todayStr();
    const byDate = {};
    state.todos.forEach(t => { if (t.date) (byDate[t.date] = byDate[t.date] || []).push(t); });
    const narrow = window.innerWidth <= 600;
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const sd = ymd(d);
      const items = (byDate[sd] || []).slice().sort((p, q) => p.done - q.done);
      const meta = dayOf(sd), evs = eventsOn(sd), hol = HOLIDAYS[sd];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day' + (d.getMonth() !== m ? ' other' : '') + (sd === today ? ' today' : '')
        + (sd === selectedDate ? ' selected' : '') + (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '')
        + (hol ? ' holiday' : '') + (meta.hl ? ' hl-' + meta.hl : '') + (meta.memo ? ' has-memo' : '');
      btn.dataset.date = sd;
      const open = items.filter(t => !t.done).length;
      const top = `<span class="day-top"><span class="day-num">${d.getDate()}</span>${meta.sticker ? `<span class="day-sticker">${meta.sticker}</span>` : ''}${meta.memo ? '<span class="day-memo-ic">📝</span>' : ''}</span>`
        + (hol && !narrow ? `<span class="day-hol">${esc(hol)}</span>` : '');
      const bars = evs.slice(0, narrow ? 3 : 3).map(ev => {
        const showTitle = !narrow && (sd === ev.start || d.getDay() === 0 || i === 0);
        return `<span class="ev ev-${EV_COLORS.indexOf(ev.color) >= 0 ? ev.color : 'blue'}${sd === ev.start ? ' ev-s' : ''}${sd === ev.end ? ' ev-e' : ''}" title="${esc(ev.title)}">${showTitle ? esc(ev.title) : '&nbsp;'}</span>`;
      }).join('') + (evs.length > 3 ? `<span class="day-more">일정 +${evs.length - 3}</span>` : '');
      const room = Math.max(0, 3 - Math.min(evs.length, 3));
      const todosHtml = narrow
        ? (items.length ? `<span class="day-dot">${open || '✓'}</span>` : '')
        : items.slice(0, room).map(t => `<span class="day-item ${t.done ? 'done' : ''}" title="${esc(t.text)}">${esc(t.text)}</span>`).join('')
          + (items.length > room ? `<span class="day-more">할일 +${items.length - room}</span>` : '');
      btn.innerHTML = top + bars + todosHtml;
      grid.appendChild(btn);
    }
    renderUpcoming();
  }

  function renderUpcoming() {
    const today = todayStr();
    const list = state.events.filter(e => e.end >= today).sort((x, y) => x.start.localeCompare(y.start)).slice(0, 6);
    const box = $('#calUpcoming');
    if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<h4>🗓 다가오는 일정</h4><ul>' + list.map(e => {
      const dd = daysBetween(today, e.start);
      const tag = dd > 0 ? `D-${dd}` : (e.end >= today && e.start <= today ? '진행 중' : '오늘');
      return `<li data-ev="${e.id}" data-date="${e.start}"><span class="ev-dot ev-${e.color}"></span><b>${esc(e.title || '(제목 없음)')}</b><span class="muted small">${evRange(e)}</span><span class="up-tag ${dd <= 0 ? 'now' : ''}">${tag}</span></li>`;
    }).join('') + '</ul>';
  }
  $('#calUpcoming').addEventListener('click', e => { const li = e.target.closest('li[data-date]'); if (li) openDay(li.dataset.date); });

  // ----- 말풍선 (마우스만 올려도) -----
  const tip = $('#calTip');
  const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  function tipHtml(sd) {
    const meta = dayOf(sd), evs = eventsOn(sd), todos = state.todos.filter(t => t.date === sd), hol = HOLIDAYS[sd];
    const di = state.diary.notes.find(n => n.date === sd);
    let html = `<div class="tip-head">${meta.sticker ? meta.sticker + ' ' : ''}${dateLabel(sd)}${hol ? ` <em class="tip-hol">${esc(hol)}</em>` : ''}</div>`;
    if (meta.memo) html += `<div class="tip-memo">📝 ${esc(meta.memo).replace(/\n/g, '<br>')}</div>`;
    if (evs.length) html += '<div class="tip-sec">' + evs.map(e => `<div class="tip-ev"><span class="ev-dot ev-${e.color}"></span>${esc(e.title || '(제목 없음)')}<span class="muted small"> · ${evRange(e)}</span>${e.memo ? `<div class="muted small tip-ev-memo">${esc(e.memo)}</div>` : ''}</div>`).join('') + '</div>';
    if (todos.length) html += '<div class="tip-sec">' + todos.map(t => `<div class="tip-todo ${t.done ? 'done' : ''}">${t.done ? '✓' : '○'} ${esc(t.text)}</div>`).join('') + '</div>';
    if (di) html += `<div class="tip-sec muted small">📔 ${di.mood ? di.mood + ' ' : ''}일기 있음</div>`;
    if (!meta.memo && !evs.length && !todos.length && !di) html += '<div class="muted small">메모·일정 없음 · 눌러서 추가</div>';
    return html;
  }
  function showTip(cell) {
    tip.innerHTML = tipHtml(cell.dataset.date);
    tip.hidden = false;
    const r = cell.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2; left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
    let top = r.bottom + 6; if (top + th > window.innerHeight - 8) top = r.top - th - 6;
    tip.style.left = left + 'px'; tip.style.top = Math.max(8, top) + 'px';
  }
  if (canHover) {
    $('#calGrid').addEventListener('mouseover', e => { const c = e.target.closest('.day'); if (c) showTip(c); });
    $('#calGrid').addEventListener('mouseleave', () => { tip.hidden = true; });
    window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  }

  // ----- 날짜 상세 팝업 -----
  let dayOpen = null, dayEditing = null, dmMemoTimer = null;
  function openDay(sd) {
    dayOpen = sd; dayEditing = null;
    selectedDate = sd; $('#todoDate').value = sd;
    tip.hidden = true;
    renderDay();
    $('#dayModal').hidden = false;
    renderCalendar(); renderTodos(); renderPanel();
  }
  function closeDay() { dayOpen = null; dayEditing = null; $('#dayModal').hidden = true; }
  function renderDay() {
    const sd = dayOpen; if (!sd) return;
    const meta = dayOf(sd), hol = HOLIDAYS[sd];
    const [yy, mm, dd] = sd.split('-').map(Number);
    $('#dmTitle').textContent = `${meta.sticker ? meta.sticker + ' ' : ''}${yy}년 ${mm}월 ${dd}일 ${'일월화수목금토'[new Date(yy, mm - 1, dd).getDay()]}요일`;
    const diff = daysFromToday(sd);
    $('#dmSub').textContent = (hol ? hol + ' · ' : '') + (diff === 0 ? '오늘' : diff > 0 ? `D-${diff}` : `${-diff}일 전`);
    $('#dmStickers').innerHTML = `<button type="button" class="mood ${!meta.sticker ? 'on' : ''}" data-sticker="">없음</button>` + STICKERS.map(st => `<button type="button" class="mood ${meta.sticker === st ? 'on' : ''}" data-sticker="${st}">${st}</button>`).join('');
    $('#dmHls').innerHTML = `<button type="button" class="hl-btn none ${!meta.hl ? 'on' : ''}" data-hl="" title="없음">×</button>` + HL_COLORS.map(c => `<button type="button" class="hl-btn hl-${c} ${meta.hl === c ? 'on' : ''}" data-hl="${c}"></button>`).join('');
    if (document.activeElement !== $('#dmMemo')) $('#dmMemo').value = meta.memo || '';
    const evs = eventsOn(sd);
    $('#dmEvents').innerHTML = evs.length ? evs.map(e => `<li data-ev="${e.id}"><span class="ev-dot ev-${e.color}"></span><div class="dm-ev-body"><b>${esc(e.title || '(제목 없음)')}</b><div class="muted small">${evRange(e)}${e.memo ? ' · ' + esc(e.memo) : ''}</div></div><button type="button" class="text-btn dm-ev-edit">수정</button><button type="button" class="todo-del" title="삭제">×</button></li>`).join('') : '<li class="muted small dm-empty">이 날 일정이 없어요. 아래에서 추가해요.</li>';
    if (!dayEditing) {
      $('#dmEvTitle').value = ''; $('#dmEvStart').value = sd; $('#dmEvEnd').value = sd; $('#dmEvMemo').value = '';
      $('#dmEvSave').textContent = '일정 추가'; $('#dmEvCancel').hidden = true;
      dmColor = 'blue';
    }
    renderEvColors();
    const todos = state.todos.filter(t => t.date === sd);
    $('#dmTodos').innerHTML = todos.length ? todos.map(t => `<li class="todo ${t.done ? 'done' : ''}" data-id="${t.id}"><input type="checkbox" ${t.done ? 'checked' : ''}><div class="todo-body"><div class="todo-text">${esc(t.text)}</div></div><button type="button" class="todo-del" title="삭제">×</button></li>`).join('') : '<li class="muted small dm-empty">이 날 할일이 없어요.</li>';
    const di = state.diary.notes.find(n => n.date === sd);
    $('#dmDiary').innerHTML = di ? `📔 이 날 일기가 있어요 · <button type="button" class="link-btn" id="dmOpenDiary">열기</button>` : `📔 <button type="button" class="link-btn" id="dmWriteDiary">이 날 일기 쓰기</button>`;
  }
  let dmColor = 'blue';
  function renderEvColors() {
    $('#dmEvColors').innerHTML = EV_COLORS.map(c => `<button type="button" class="hl-btn ev-${c} ${dmColor === c ? 'on' : ''}" data-color="${c}"></button>`).join('');
  }
  $('#dmClose').addEventListener('click', closeDay);
  $('#dayModal').addEventListener('click', e => { if (e.target === $('#dayModal')) closeDay(); });
  $('#dmStickers').addEventListener('click', e => { const b = e.target.closest('[data-sticker]'); if (!b || !dayOpen) return; setDay(dayOpen, { sticker: b.dataset.sticker }); save(); renderDay(); renderCalendar(); });
  $('#dmHls').addEventListener('click', e => { const b = e.target.closest('[data-hl]'); if (!b || !dayOpen) return; setDay(dayOpen, { hl: b.dataset.hl }); save(); renderDay(); renderCalendar(); });
  $('#dmMemo').addEventListener('input', () => {
    if (!dayOpen) return;
    setDay(dayOpen, { memo: $('#dmMemo').value.trim() });
    clearTimeout(dmMemoTimer); dmMemoTimer = setTimeout(() => { save(); renderCalendar(); }, 600);
  });
  $('#dmEvColors').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (!b) return; dmColor = b.dataset.color; renderEvColors(); });
  $('#dmEvStart').addEventListener('change', () => { if ($('#dmEvEnd').value < $('#dmEvStart').value) $('#dmEvEnd').value = $('#dmEvStart').value; });
  $('#dmEventForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#dmEvTitle').value.trim();
    let st = $('#dmEvStart').value, en = $('#dmEvEnd').value || st;
    if (!title) { $('#dmEvTitle').focus(); return; }
    if (!st) return;
    if (en < st) en = st;
    if (dayEditing) {
      const ev = state.events.find(x => x.id === dayEditing);
      if (ev) { ev.title = title; ev.start = st; ev.end = en; ev.color = dmColor; ev.memo = $('#dmEvMemo').value.trim(); }
      dayEditing = null;
    } else {
      state.events.push({ id: uid(), title, start: st, end: en, color: dmColor, memo: $('#dmEvMemo').value.trim() });
    }
    save(); renderDay(); renderCalendar(); renderPanel();
  });
  $('#dmEvCancel').addEventListener('click', () => { dayEditing = null; renderDay(); });
  $('#dmEvents').addEventListener('click', e => {
    const li = e.target.closest('li[data-ev]'); if (!li) return;
    const ev = state.events.find(x => x.id === li.dataset.ev); if (!ev) return;
    if (e.target.closest('.todo-del')) {
      if (!confirm(`"${ev.title}" 일정을 지울까요?`)) return;
      state.events = state.events.filter(x => x !== ev); dayEditing = null;
      save(); renderDay(); renderCalendar(); return;
    }
    if (e.target.closest('.dm-ev-edit')) {
      dayEditing = ev.id;
      $('#dmEvTitle').value = ev.title; $('#dmEvStart').value = ev.start; $('#dmEvEnd').value = ev.end; $('#dmEvMemo').value = ev.memo || '';
      dmColor = ev.color; renderEvColors();
      $('#dmEvSave').textContent = '일정 저장'; $('#dmEvCancel').hidden = false;
      $('#dmEvTitle').focus();
    }
  });
  $('#dmTodoForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#dmTodoText').value.trim(); if (!text || !dayOpen) return;
    state.todos.push({ id: uid(), text, date: dayOpen, done: false, created: Date.now() });
    $('#dmTodoText').value = '';
    save(); renderDay(); renderTodos(); renderCalendar(); renderPanel();
  });
  $('#dmTodos').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const t = state.todos.find(x => x.id === li.dataset.id); if (!t) return;
    if (e.target.closest('.todo-del')) { if (!t.done && !confirm(`삭제할까요?\n"${t.text}"`)) return; state.todos = state.todos.filter(x => x !== t); }
    else if (e.target.matches('input[type=checkbox]')) { t.done = e.target.checked; t.doneAt = t.done ? Date.now() : null; }
    else return;
    save(); renderDay(); renderTodos(); renderCalendar();
  });
  $('#dmDiary').addEventListener('click', e => {
    if (e.target.closest('#dmOpenDiary')) { const di = state.diary.notes.find(n => n.date === dayOpen); closeDay(); if (di) { current = { kind: 'diary', id: 'diary' }; openPost(di.id); } }
    else if (e.target.closest('#dmWriteDiary')) { const sd = dayOpen; closeDay(); openDiaryDate(sd); }
  });

  $('#calGrid').addEventListener('click', e => {
    const day = e.target.closest('.day'); if (!day) return;
    openDay(day.dataset.date);
  });
  $('#calPrev').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
  $('#calNext').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
  $('#calToday').addEventListener('click', () => {
    calCursor = new Date(); calCursor.setDate(1);
    selectedDate = todayStr(); $('#todoDate').value = selectedDate;
    renderCalendar(); renderTodos();
  });

  /* ---------- 할일 ---------- */
  function renderTodos() {
    const today = todayStr();
    const g = { late: [], today: [], sel: [], soon: [], none: [], done: [] };
    state.todos.forEach(t => {
      if (t.done) return g.done.push(t);
      if (!t.date) return g.none.push(t);
      if (selectedDate && selectedDate !== today && t.date === selectedDate) return g.sel.push(t);
      if (t.date < today) return g.late.push(t);
      if (t.date === today) return g.today.push(t);
      g.soon.push(t);
    });
    const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.created || 0) - (b.created || 0);
    Object.values(g).forEach(x => x.sort(byDate));
    g.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

    const item = t => {
      const m = t.text.match(/^\[([^\]]+)\]\s*(.*)$/);
      const tag = m ? `<span class="todo-tag">${esc(m[1])}</span>` : '';
      const text = m ? m[2] : t.text;
      let meta = '';
      if (t.date) {
        const diff = daysFromToday(t.date);
        const rel = diff === 0 ? '오늘' : diff === 1 ? '내일' : diff === -1 ? '어제' : diff < 0 ? `${-diff}일 지남` : `D-${diff}`;
        meta = `<div class="todo-meta ${(!t.done && diff < 0) ? 'late' : ''}">${dateLabel(t.date)} · ${rel}</div>`;
      }
      return `<li class="todo ${t.done ? 'done' : ''}" data-id="${t.id}">
        <input type="checkbox" ${t.done ? 'checked' : ''} aria-label="완료">
        <div class="todo-body"><div class="todo-text">${tag}${esc(text)}</div>${meta}</div>
        <button class="todo-del" title="삭제">×</button>
      </li>`;
    };
    const sec = (cls, title, list) => list.length
      ? `<div class="todo-group ${cls}"><h4><span>${title}</span><span>${list.length}</span></h4><ul class="todo-list">${list.map(item).join('')}</ul></div>` : '';

    let html = '';
    if (selectedDate && selectedDate !== today) html += sec('sel', `📌 ${dateLabel(selectedDate)}`, g.sel);
    html += sec('late', '⏰ 지난 일', g.late);
    html += sec('today', '☀️ 오늘', g.today);
    html += sec('soon', '📅 예정', g.soon);
    html += sec('none', '📝 언제든', g.none);
    if (g.done.length) {
      html += `<div class="todo-group finished ${state.showDone ? 'open' : ''}"><h4><span>✔ 완료 ${state.showDone ? '▾' : '▸'}</span><span>${g.done.length}</span></h4><ul class="todo-list">${g.done.slice(0, 30).map(item).join('')}</ul></div>`;
    }
    if (!html) html = '<p class="todo-empty">아직 할일이 없어요.<br>위에 적어보자.</p>';
    $('#todoGroups').innerHTML = html;

    const openCount = state.todos.filter(t => !t.done).length;
    $('#sideCount').textContent = openCount ? `남은 일 ${openCount}개` : '';
    $('#sumTodos').textContent = g.today.length + '개';
    $('#sumTodosSub').textContent = g.late.length ? `지난 일 ${g.late.length}개도 있어요`
      : g.today.length ? '오늘 안에 끝내자' : '남은 일이 없어요';

    renderWork(); renderGoals();
    if (state.showTodos) renderPanel();
  }

  $('#todoForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#todoText').value.trim();
    if (!text) return;
    state.todos.push({ id: uid(), text, date: $('#todoDate').value || null, done: false, created: Date.now() });
    save();
    $('#todoText').value = '';
    renderTodos(); renderCalendar();
    $('#todoText').focus();
  });
  $('#todoText').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); $('#todoForm').requestSubmit(); }
  });
  $('#todoDateClear').addEventListener('click', () => {
    $('#todoDate').value = ''; selectedDate = null; renderCalendar(); renderTodos();
  });
  $('#todoGroups').addEventListener('click', e => {
    const h = e.target.closest('.todo-group.finished h4');
    if (h) { state.showDone = !state.showDone; save(); renderTodos(); return; }
    const li = e.target.closest('.todo'); if (!li) return;
    const t = state.todos.find(x => x.id === li.dataset.id); if (!t) return;
    if (e.target.closest('.todo-del')) {
      if (!t.done && !confirm(`삭제할까요?\n"${t.text}"`)) return;
      state.todos = state.todos.filter(x => x !== t);
    } else if (e.target.matches('input[type=checkbox]')) {
      t.done = e.target.checked; t.doneAt = t.done ? Date.now() : null;
    } else return;
    save(); renderTodos(); renderCalendar();
  });

  /* ---------- 체중 ---------- */
  const wIn = $('#weightInput');
  function renderWeight() {
    if (state.weight) wIn.value = state.weight;
    const bar = $('#weightBar'), note = $('#weightNote');
    if (!state.weight) { bar.style.width = '0%'; note.textContent = '현재 체중을 적으면 남은 kg가 보여요.'; return; }
    const start = state.weightStart || state.weight;
    const left = state.weight - TARGET_WEIGHT;
    bar.style.width = (start > TARGET_WEIGHT ? pct(start - state.weight, start - TARGET_WEIGHT) : 100) + '%';
    note.textContent = left > 0
      ? `${state.weight}kg → 44kg · ${left.toFixed(1)}kg 남음` + (start !== state.weight ? ` · 시작 ${start}kg에서 ${(start - state.weight).toFixed(1)}kg 감량` : '')
      : `🎉 목표 달성! (${state.weight}kg)`;
  }
  wIn.addEventListener('change', () => {
    const v = parseFloat(wIn.value);
    if (!isFinite(v) || v <= 0) state.weight = null;
    else { if (!state.weightStart) state.weightStart = v; state.weight = v; }
    save(); renderWeight(); renderGoals();
  });

  /* ---------- 게시판 허브: 전체보기 · 그룹 · 홈 표시 · 전체 글 · 찾기 ---------- */
  const hub = { kind: null, q: '', manage: false };
  function allCards() {
    return state.goals.map(it => ({ kind: 'goal', it })).concat(state.works.map(it => ({ kind: 'work', it })), [{ kind: 'diary', it: state.diary }]);
  }
  function renderHub() {
    $('#hubKinds').innerHTML = [['', '전체'], ['goal', '🌱 꿈과 목표'], ['work', '🛠 하는 일'], ['diary', '📔 다이어리']].map(([k, label]) =>
      `<button type="button" class="hub-tab ${(hub.kind || '') === k ? 'on' : ''}" data-kind="${k}">${label}</button>`).join('');
    const rows = allCards().filter(c => !hub.kind || c.kind === hub.kind);
    $('#hubList').innerHTML = rows.length ? rows.map(({ kind, it }) => {
      const notes = it.notes || [], n = notes.length;
      const last = n ? Math.max.apply(null, notes.map(x => x.updatedAt || x.at || 0)) : 0;
      const subs = (it.boards || []).map(bd => `<button type="button" class="sub-chip" data-board="${bd.id}">${esc(bd.name || '(이름 없음)')} ${notes.filter(x => x.board === bd.id).length}</button>`).join('');
      const unfiled = notes.filter(x => !x.board).length;
      return `<li class="hub-row ${it.hidden ? 'is-hidden' : ''}" data-kind="${kind}" data-id="${it.id}">
        <span class="hub-emoji">${esc(it.emoji || '📌')}</span>
        <div class="hub-main">
          <div class="hub-title"><b>${esc(it.title || '(제목 없음)')}</b> <span class="muted small">${kind === 'work' ? '하는 일' : kind === 'diary' ? '나의 하루' : '꿈과 목표'}</span></div>
          <div class="muted small">글 ${n}개${last ? ' · 마지막 ' + whenLabel(last) : ''}${it.hidden ? ' · 홈에서 숨김' : ''}</div>
          ${subs || unfiled ? `<div class="sub-chips">${subs}${(it.boards || []).length && unfiled ? `<button type="button" class="sub-chip" data-board="none">미분류 ${unfiled}</button>` : ''}</div>` : ''}
        </div>
        ${kind === 'diary' ? '' : `<label class="switch hub-show" title="홈 화면에 표시"><input type="checkbox" ${it.hidden ? '' : 'checked'}><span>홈</span></label>`}
        <button type="button" class="text-btn hub-open">열기 →</button>
      </li>`;
    }).join('') : '<li class="muted small hub-empty">여기에 해당하는 게시판이 없어요.</li>';
    $('#hubQ').value = hub.q || '';
    renderTree();
  }

  /* ---------- 카테고리 트리 (게시판 → 세부 게시판, 글 개수, 접기/펼치기, 관리) ---------- */
  function renderTree() {
    const cards = allCards().filter(c => !hub.kind || c.kind === hub.kind);
    const mg = hub.manage;
    $('#hubManage').textContent = mg ? '✓ 관리 끝' : '⚙️ 카테고리 관리';
    $('#hubManage').classList.toggle('on', mg);
    $('#treeHelp').textContent = mg ? '이름을 고치고 ▲▼로 순서를 바꿔요. ＋로 세부 게시판을 만들어요.' : '▾▸로 펼치고 접어요. 접은 상태는 저장돼요.';
    $('#hubTree').innerHTML = cards.length ? cards.map(({ kind, it }) => {
      const notes = it.notes || [];
      const total = notes.length;
      const unfiled = notes.filter(n => !n.board).length;
      const subs = (it.boards || []).map((bd, i) => {
        const n = notes.filter(x => x.board === bd.id).length;
        return `<li class="tree-sub" data-bid="${bd.id}">
          <div class="tree-row sub">
            <span class="tree-branch">└</span>
            ${mg ? `<input class="tree-rename" value="${esc(bd.name)}" maxlength="20" placeholder="세부 게시판 이름">`
                 : `<button type="button" class="tree-link" data-act="opensub">${esc(bd.name || '(이름 없음)')}</button>`}
            <span class="tree-n">${n}</span>
            ${mg ? `<span class="tree-ctl"><button type="button" data-act="subup" title="위로" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-act="subdown" title="아래로" ${i >= it.boards.length - 1 ? 'disabled' : ''}>▼</button><button type="button" data-act="subdel" class="del" title="지우기">×</button></span>` : ''}
          </div>
        </li>`;
      }).join('');
      const unfiledRow = (it.boards.length && unfiled) || (mg && it.boards.length)
        ? `<li class="tree-sub unfiled"><div class="tree-row sub"><span class="tree-branch">└</span><button type="button" class="tree-link muted" data-act="openunfiled">미분류</button><span class="tree-n">${unfiled}</span></div></li>` : '';
      const addRow = mg ? `<li class="tree-add"><form class="tree-add-form"><span class="tree-branch">└</span><input placeholder="새 세부 게시판" maxlength="20"><button type="submit" class="primary">＋</button></form></li>` : '';
      const list = listOf(kind), idx = list.indexOf(it);
      return `<li class="tree-card ${it.collapsed ? 'collapsed' : ''} ${it.hidden ? 'is-hidden' : ''}" data-kind="${kind}" data-id="${it.id}">
        <div class="tree-row">
          <button type="button" class="tw-btn" data-act="toggle" title="${it.collapsed ? '펼치기' : '접기'}">${it.collapsed ? '▸' : '▾'}</button>
          <button type="button" class="tree-link is-main" data-act="open"><span class="tree-emoji">${esc(it.emoji || '📌')}</span> ${esc(it.title || '(제목 없음)')}</button>
          <span class="tree-n total">${total}</span>
          ${mg && kind !== 'diary' ? `<span class="tree-ctl"><button type="button" data-act="cardup" title="위로" ${idx === 0 ? 'disabled' : ''}>▲</button><button type="button" data-act="carddown" title="아래로" ${idx >= list.length - 1 ? 'disabled' : ''}>▼</button><button type="button" data-act="carddel" class="del" title="게시판 삭제">×</button></span>` : ''}
        </div>
        <ul class="tree-subs" ${it.collapsed ? 'hidden' : ''}>${subs}${unfiledRow}${addRow}${!subs && !mg ? '<li class="tree-sub none muted small">세부 게시판 없음</li>' : ''}</ul>
      </li>`;
    }).join('') : '<li class="muted small">게시판이 없어요.</li>';
    if (mg) {
      const k = hub.kind === 'work' ? 'work' : 'goal';
      $('#hubTree').insertAdjacentHTML('beforeend', `<li class="tree-add-card"><form class="tree-add-card-form">
        <select name="kind"><option value="goal" ${k === 'goal' ? 'selected' : ''}>🌱 꿈과 목표</option><option value="work" ${k === 'work' ? 'selected' : ''}>🛠 하는 일</option></select>
        <input name="title" placeholder="새 게시판 이름" maxlength="60">
        <button type="submit" class="primary">＋ 게시판</button>
      </form></li>`);
    }
    $('#treeOpts').hidden = !mg;
    $('#treeCounts').checked = !!state.treeCounts;
    $('#hubTree').classList.toggle('no-counts', !state.treeCounts);
  }
  $('#hubManage').addEventListener('click', () => { hub.manage = !hub.manage; renderTree(); });
  $('#treeExpandAll').addEventListener('click', () => { allCards().forEach(c => { c.it.collapsed = false; }); save(); renderTree(); });
  $('#treeCollapseAll').addEventListener('click', () => { allCards().forEach(c => { c.it.collapsed = true; }); save(); renderTree(); });
  $('#treeCounts').addEventListener('change', e => { state.treeCounts = e.target.checked; save(); renderTree(); });
  $('#hubTree').addEventListener('submit', e => {
    const f = e.target.closest('.tree-add-card-form'); if (!f) return;
    e.preventDefault();
    const kind = f.kind.value === 'work' ? 'work' : 'goal';
    const title = f.title.value.trim(); if (!title) { f.title.focus(); return; }
    const it = kind === 'work'
      ? { id: uid(), emoji: '🛠', title, desc: '', tag: title, status: 'build', notes: [], boards: [], hidden: false, collapsed: false }
      : { id: uid(), emoji: '🌟', title, desc: '', tag: title, bar: '', notes: [], boards: [], hidden: false, collapsed: false };
    listOf(kind).push(it);
    save(); renderHub(); renderGoals(); renderWork();
    const again = $('#hubTree .tree-add-card-form input'); if (again) again.focus();
  });
  // 게시판 로고(이모지·제목) → 카테고리 트리가 있는 전체보기 화면. 전체보기에서 누르면 대시보드.
  $('#bdCardLogo').addEventListener('click', () => {
    const v = board.view;
    if (v === 'hub' || v === 'all') { go('', true); return; }
    const kind = current ? current.kind : null;
    go('boards' + (kind ? '/' + kind : ''));
  });
  $('#topHome').addEventListener('click', () => {
    if (document.body.classList.contains('on-board')) { current = null; go('', true); }
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#hubTree').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const cardLi = b.closest('.tree-card'); if (!cardLi) return;
    const kind = cardLi.dataset.kind, it = findItem(kind, cardLi.dataset.id); if (!it) return;
    const act = b.dataset.act;
    const subLi = b.closest('.tree-sub');
    const bid = subLi ? subLi.dataset.bid : null;
    if (act === 'toggle') { it.collapsed = !it.collapsed; save(); renderTree(); return; }
    if (act === 'open') { current = { kind, id: it.id }; openList(false, null); return; }
    if (act === 'opensub') { current = { kind, id: it.id }; openList(false, bid); return; }
    if (act === 'openunfiled') { current = { kind, id: it.id }; openList(false, 'none'); return; }
    if (act === 'cardup' || act === 'carddown') {
      const list = listOf(kind), i = list.indexOf(it), j = act === 'cardup' ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      save(); renderHub(); renderGoals(); renderWork(); return;
    }
    if (act === 'subup' || act === 'subdown') {
      const i = it.boards.findIndex(x => x.id === bid), j = act === 'subup' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= it.boards.length) return;
      [it.boards[i], it.boards[j]] = [it.boards[j], it.boards[i]];
      save(); renderTree(); return;
    }
    if (act === 'carddel') {
      const n = (it.notes || []).length;
      if (!confirm(`"${it.title || '(제목 없음)'}" 게시판을 지울까요?\n${n ? '안에 있는 글 ' + n + '개도 전부 삭제돼요.' : '글은 없어요.'}\n이 작업은 되돌릴 수 없어요.`)) return;
      if (kind === 'work') state.works = state.works.filter(x => x.id !== it.id);
      else state.goals = state.goals.filter(x => x.id !== it.id);
      if (current && current.id === it.id) current = null;
      save(); renderHub(); renderGoals(); renderWork(); return;
    }
    if (act === 'subdel') {
      const bd = it.boards.find(x => x.id === bid); if (!bd) return;
      const n = (it.notes || []).filter(x => x.board === bid).length;
      if (!confirm(`"${bd.name}" 세부 게시판을 지울까요? 안의 글 ${n}개는 미분류로 남아요.`)) return;
      (it.notes || []).forEach(x => { if (x.board === bid) x.board = ''; });
      it.boards = it.boards.filter(x => x.id !== bid);
      save(); renderHub(); return;
    }
  });
  $('#hubTree').addEventListener('change', e => {
    const inp = e.target.closest('.tree-rename'); if (!inp) return;
    const cardLi = inp.closest('.tree-card'), subLi = inp.closest('.tree-sub');
    const it = findItem(cardLi.dataset.kind, cardLi.dataset.id); if (!it) return;
    const bd = it.boards.find(x => x.id === subLi.dataset.bid); if (!bd) return;
    bd.name = inp.value.trim(); save(); renderTree();
  });
  $('#hubTree').addEventListener('submit', e => {
    const f = e.target.closest('.tree-add-form'); if (!f) return;
    e.preventDefault();
    const cardLi = f.closest('.tree-card'); const it = findItem(cardLi.dataset.kind, cardLi.dataset.id); if (!it) return;
    const name = f.querySelector('input').value.trim(); if (!name) return;
    it.boards.push({ id: uid(), name });
    it.collapsed = false;
    save(); renderHub();
    const again = $(`#hubTree .tree-card[data-id="${it.id}"] .tree-add-form input`); if (again) again.focus();
  });
  $('#hubKinds').addEventListener('click', e => {
    const b = e.target.closest('.hub-tab'); if (!b) return;
    go('boards' + (b.dataset.kind ? '/' + b.dataset.kind : ''), true);
  });
  $('#hubList').addEventListener('change', e => {
    const li = e.target.closest('.hub-row'); if (!li) return;
    const it = findItem(li.dataset.kind, li.dataset.id); if (!it) return;
    if (e.target.matches('.hub-show input')) it.hidden = !e.target.checked;
    save(); renderHub(); renderGoals(); renderWork();
  });
  $('#hubList').addEventListener('click', e => {
    const li = e.target.closest('.hub-row'); if (!li) return;
    const sub = e.target.closest('.sub-chip');
    if (sub) { current = { kind: li.dataset.kind, id: li.dataset.id }; openList(false, sub.dataset.board); return; }
    if (e.target.closest('.hub-open') || e.target.closest('.hub-main') || e.target.closest('.hub-emoji')) {
      current = { kind: li.dataset.kind, id: li.dataset.id }; openList(false, null);
    }
  });
  $('#hubSearch').addEventListener('submit', e => { e.preventDefault(); go('posts/' + encodeURIComponent($('#hubQ').value.trim())); });
  $('#hubAllPosts').addEventListener('click', () => go('posts'));

  // 전체 글 · 찾기
  function renderAllPosts() {
    const q = (hub.q || '').trim().toLowerCase();
    let rows = [];
    allCards().forEach(({ kind, it }) => (it.notes || []).forEach(n => rows.push({ kind, it, n })));
    if (q) rows = rows.filter(r => ((r.n.title || '') + ' ' + (r.n.text || '') + ' ' + (r.it.title || '') + ' ' + (r.n.board ? boardName(r.it, r.n.board) : '')).toLowerCase().indexOf(q) >= 0);
    rows.sort((a, b) => (b.n.at || 0) - (a.n.at || 0));
    $('#allQ').value = hub.q || '';
    $('#allInfo').textContent = q ? `"${hub.q}" 검색 결과 ${rows.length}개` : `모든 게시판의 글 ${rows.length}개 · 최신순`;
    $('#allPosts').innerHTML = rows.length ? rows.map(({ kind, it, n }) => {
      const thumb = n.photos && n.photos.length ? `<img class="post-thumb" src="${n.photos[0]}" alt="">` : '';
      const snip = (n.text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `<li data-kind="${kind}" data-id="${it.id}" data-pid="${n.id}" tabindex="0">${thumb}<div class="post-item-body">
        <div class="post-item-title">${esc(postTitle(n))}</div>
        ${snip ? `<div class="post-item-snip muted small">${esc(snip)}</div>` : ''}
        <div class="muted small"><span class="todo-tag">${esc(it.emoji || '')} ${esc(it.title || '')}${n.board ? ' · ' + esc(boardName(it, n.board)) : ''}</span> ${whenLabel(n.at)}${n.photos && n.photos.length ? ` · 사진 ${n.photos.length}` : ''}</div>
      </div></li>`;
    }).join('') : `<li class="im-empty muted small">${q ? '찾은 글이 없어요.' : '아직 글이 없어요.'}</li>`;
  }
  $('#allSearch').addEventListener('submit', e => { e.preventDefault(); go('posts/' + encodeURIComponent($('#allQ').value.trim()), true); });
  $('#allClear').addEventListener('click', () => go('posts', true));
  function allPostClick(e) {
    const li = e.target.closest('li[data-pid]'); if (!li) return;
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    current = { kind: li.dataset.kind, id: li.dataset.id };
    openPost(li.dataset.pid);
  }
  $('#allPosts').addEventListener('click', allPostClick);
  $('#allPosts').addEventListener('keydown', allPostClick);

  /* ---------- 이번 달 메모 (월별 목표 체크리스트) ---------- */
  let monthCursor = (() => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); })();
  const thisMonthKey = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  function monthOf(key) { return state.months[key] || { items: [], memo: '' }; }
  function ensureMonth(key) { if (!state.months[key]) state.months[key] = { items: [], memo: '' }; return state.months[key]; }
  function prevMonthKey(key) { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function cleanMonth(key) { const m = state.months[key]; if (m && !m.items.length && !m.memo) delete state.months[key]; }
  function renderMonth() {
    const [y, m] = monthCursor.split('-').map(Number);
    const cur = monthOf(monthCursor);
    const isNow = monthCursor === thisMonthKey();
    $('#monthTitle').textContent = `${y}년 ${m}월` + (isNow ? '' : monthCursor < thisMonthKey() ? ' · 지난 달' : ' · 다음 달');
    const done = cur.items.filter(i => i.done).length, total = cur.items.length;
    $('#monthProgressText').textContent = total ? `${done} / ${total} 완료${done === total ? ' 🎉' : ''}` : '';
    $('#monthBar').style.width = (total ? done / total * 100 : 0) + '%';
    $('#monthList').innerHTML = cur.items.length ? cur.items.map((i, idx) =>
      `<li class="${i.done ? 'on' : ''}" data-id="${i.id}"><input type="checkbox" ${i.done ? 'checked' : ''}><span class="month-text ${i.done ? 'done' : ''}">${esc(i.text)}</span><span class="month-btns"><button type="button" class="link-btn m-up" title="위로">▲</button><button type="button" class="link-btn m-down" title="아래로">▼</button><button type="button" class="todo-del" title="삭제">×</button></span></li>`).join('')
      : '<li class="muted small month-empty">아직 없어요. 위에 이번 달 목표를 적어보자.</li>';
    const prev = monthOf(prevMonthKey(monthCursor));
    const leftover = prev.items.filter(i => !i.done && !cur.items.some(c => c.text === i.text));
    $('#monthCarry').hidden = !leftover.length;
    $('#monthCarry').textContent = `지난 달에서 안 끝난 ${leftover.length}개 가져오기`;
    if (document.activeElement !== $('#monthMemo')) $('#monthMemo').value = cur.memo || '';
  }
  $('#monthPrev').addEventListener('click', () => { monthCursor = prevMonthKey(monthCursor); renderMonth(); });
  $('#monthNext').addEventListener('click', () => { const [y, m] = monthCursor.split('-').map(Number); const d = new Date(y, m, 1); monthCursor = d.getFullYear() + '-' + pad(d.getMonth() + 1); renderMonth(); });
  $('#monthToday').addEventListener('click', () => { monthCursor = thisMonthKey(); renderMonth(); });
  $('#monthAdd').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#monthText').value.trim(); if (!text) return;
    ensureMonth(monthCursor).items.push({ id: uid(), text, done: false });
    $('#monthText').value = '';
    save(); renderMonth(); $('#monthText').focus();
  });
  $('#monthList').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const mo = ensureMonth(monthCursor); const i = mo.items.findIndex(x => x.id === li.dataset.id); if (i < 0) return;
    if (e.target.closest('.todo-del')) { if (!mo.items[i].done && !confirm(`"${mo.items[i].text}" 지울까요?`)) return; mo.items.splice(i, 1); }
    else if (e.target.closest('.m-up')) { if (i === 0) return; [mo.items[i - 1], mo.items[i]] = [mo.items[i], mo.items[i - 1]]; }
    else if (e.target.closest('.m-down')) { if (i >= mo.items.length - 1) return; [mo.items[i + 1], mo.items[i]] = [mo.items[i], mo.items[i + 1]]; }
    else if (e.target.matches('input[type=checkbox]')) { mo.items[i].done = e.target.checked; }
    else return;
    cleanMonth(monthCursor); save(); renderMonth();
  });
  $('#monthCarry').addEventListener('click', () => {
    const prev = monthOf(prevMonthKey(monthCursor)); const cur = ensureMonth(monthCursor);
    prev.items.filter(i => !i.done && !cur.items.some(c => c.text === i.text)).forEach(i => cur.items.push({ id: uid(), text: i.text, done: false }));
    save(); renderMonth();
  });
  let monthMemoTimer = null;
  $('#monthMemo').addEventListener('input', () => {
    ensureMonth(monthCursor).memo = $('#monthMemo').value;
    clearTimeout(monthMemoTimer); monthMemoTimer = setTimeout(() => { cleanMonth(monthCursor); save(); }, 700);
  });

  /* ---------- 올해 목표 (연간 체크리스트) ---------- */
  let yearCursor = String(new Date().getFullYear());
  const thisYearKey = () => String(new Date().getFullYear());
  function yearOf(key) { return state.years[key] || { items: [], memo: '' }; }
  function ensureYear(key) { if (!state.years[key]) state.years[key] = { items: [], memo: '' }; return state.years[key]; }
  function cleanYear(key) { const m = state.years[key]; if (m && !m.items.length && !m.memo) delete state.years[key]; }
  function renderYear() {
    const cur = yearOf(yearCursor);
    const isNow = yearCursor === thisYearKey();
    $('#yearTitle').textContent = `${yearCursor}년 목표` + (isNow ? '' : yearCursor < thisYearKey() ? ' · 지난해' : ' · 내년');
    const done = cur.items.filter(i => i.done).length, total = cur.items.length;
    $('#yearProgressText').textContent = total ? `${done} / ${total} 완료${done === total ? ' 🎉' : ''}` : '';
    $('#yearBar').style.width = (total ? done / total * 100 : 0) + '%';
    if (isNow) {
      const now = new Date(), end = new Date(now.getFullYear(), 11, 31);
      const left = Math.round((end - now) / 86400000);
      const passed = Math.round((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + 1;
      $('#yearDays').textContent = `올해 ${passed}일째 · ${left}일 남음 (${Math.round(passed / 365 * 100)}% 지나감)`;
    } else $('#yearDays').textContent = '';
    $('#yearList').innerHTML = cur.items.length ? cur.items.map(i =>
      `<li class="${i.done ? 'on' : ''}" data-id="${i.id}"><input type="checkbox" ${i.done ? 'checked' : ''}><span class="month-text ${i.done ? 'done' : ''}">${esc(i.text)}</span><span class="month-btns"><button type="button" class="link-btn m-up" title="위로">▲</button><button type="button" class="link-btn m-down" title="아래로">▼</button><button type="button" class="link-btn m-tomonth" title="이번 달 메모로 내리기">이번 달로</button><button type="button" class="todo-del" title="삭제">×</button></span></li>`).join('')
      : '<li class="muted small month-empty">아직 없어요. 올해 꼭 이루고 싶은 것을 적어보자.</li>';
    const prev = yearOf(String(Number(yearCursor) - 1));
    const leftover = prev.items.filter(i => !i.done && !cur.items.some(c => c.text === i.text));
    $('#yearCarry').hidden = !leftover.length;
    $('#yearCarry').textContent = `지난해에서 안 끝난 ${leftover.length}개 가져오기`;
    if (document.activeElement !== $('#yearMemo')) $('#yearMemo').value = cur.memo || '';
  }
  $('#yearPrev').addEventListener('click', () => { yearCursor = String(Number(yearCursor) - 1); renderYear(); });
  $('#yearNext').addEventListener('click', () => { yearCursor = String(Number(yearCursor) + 1); renderYear(); });
  $('#yearToday').addEventListener('click', () => { yearCursor = thisYearKey(); renderYear(); });
  $('#yearAdd').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#yearText').value.trim(); if (!text) return;
    ensureYear(yearCursor).items.push({ id: uid(), text, done: false });
    $('#yearText').value = '';
    save(); renderYear(); $('#yearText').focus();
  });
  $('#yearList').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const yr = ensureYear(yearCursor); const i = yr.items.findIndex(x => x.id === li.dataset.id); if (i < 0) return;
    if (e.target.closest('.todo-del')) { if (!yr.items[i].done && !confirm(`"${yr.items[i].text}" 지울까요?`)) return; yr.items.splice(i, 1); }
    else if (e.target.closest('.m-up')) { if (i === 0) return; [yr.items[i - 1], yr.items[i]] = [yr.items[i], yr.items[i - 1]]; }
    else if (e.target.closest('.m-down')) { if (i >= yr.items.length - 1) return; [yr.items[i + 1], yr.items[i]] = [yr.items[i], yr.items[i + 1]]; }
    else if (e.target.closest('.m-tomonth')) {
      const mo = ensureMonth(thisMonthKey());
      if (!mo.items.some(c => c.text === yr.items[i].text)) mo.items.push({ id: uid(), text: yr.items[i].text, done: false });
      monthCursor = thisMonthKey(); save(); renderMonth(); $('#month').scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    else if (e.target.matches('input[type=checkbox]')) { yr.items[i].done = e.target.checked; }
    else return;
    cleanYear(yearCursor); save(); renderYear();
  });
  $('#yearCarry').addEventListener('click', () => {
    const prev = yearOf(String(Number(yearCursor) - 1)); const cur = ensureYear(yearCursor);
    prev.items.filter(i => !i.done && !cur.items.some(c => c.text === i.text)).forEach(i => cur.items.push({ id: uid(), text: i.text, done: false }));
    save(); renderYear();
  });
  let yearMemoTimer = null;
  $('#yearMemo').addEventListener('input', () => {
    ensureYear(yearCursor).memo = $('#yearMemo').value;
    clearTimeout(yearMemoTimer); yearMemoTimer = setTimeout(() => { cleanYear(yearCursor); save(); }, 700);
  });

  /* ---------- 다이어리 위젯 ---------- */
  function diaryFor(date) { return state.diary.notes.find(n => n.date === date); }
  function diaryStreak() {
    const set = new Set(state.diary.notes.map(n => n.date));
    let d = new Date(), streak = 0;
    if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
    while (set.has(ymd(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }
  function renderMoodPick() {
    $('#bdMoodWrap').innerHTML = '<span class="muted small">오늘 기분</span>' + MOODS.map(m => `<button type="button" class="mood ${board.draftMood === m ? 'on' : ''}" data-mood="${m}">${m}</button>`).join('');
  }
  $('#bdMoodWrap').addEventListener('click', e => {
    const b = e.target.closest('.mood'); if (!b) return;
    board.draftMood = board.draftMood === b.dataset.mood ? '' : b.dataset.mood;
    renderMoodPick();
  });
  function renderDiary() {
    const today = todayStr();
    const t = diaryFor(today);
    const d = new Date();
    $('#diaryTodayLabel').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
    $('#diaryTodayState').textContent = t ? (t.mood ? t.mood + ' ' : '') + (t.title || t.text ? '오늘 일기를 썼어요' : '오늘 기분만 남겼어요') : '아직 오늘 일기가 없어요';
    const st = diaryStreak(), total = state.diary.notes.length;
    $('#diaryStreak').textContent = (st ? `🔥 ${st}일 연속` : '오늘부터 다시 시작') + (total ? ` · 총 ${total}편` : '');
    $('#diaryWrite').textContent = t ? '오늘 일기 이어 쓰기' : '오늘 일기 쓰기';
    $('#diaryMoods').innerHTML = MOODS.map(m => `<button type="button" class="mood ${t && t.mood === m ? 'on' : ''}" data-mood="${m}">${m}</button>`).join('');
    // 최근 14일
    const strip = [];
    for (let i = 13; i >= 0; i--) {
      const dd = new Date(); dd.setDate(dd.getDate() - i);
      const key = ymd(dd), n = diaryFor(key);
      strip.push(`<button type="button" class="day-dot2 ${n ? 'has' : ''} ${key === today ? 'today' : ''}" data-date="${key}" title="${dateLabel(key)}">${n ? (n.mood || '●') : dd.getDate()}</button>`);
    }
    $('#diaryStrip').innerHTML = strip.join('');
    const recent = postsOf(state.diary).slice(0, 4);
    $('#diaryRecent').innerHTML = recent.length ? recent.map(n => postItemHtml(n, state.diary)).join('') : '<li class="im-empty muted small">첫 일기를 남겨보자. 한 줄이면 충분해요.</li>';
  }
  function openDiaryDate(date) {
    current = { kind: 'diary', id: 'diary' };
    const n = diaryFor(date);
    if (n) openPost(n.id);
    else { board.presetDate = date; openEditor(null); }
  }
  $('#diaryWrite').addEventListener('click', () => openDiaryDate(todayStr()));
  $('#diaryStrip').addEventListener('click', e => { const b = e.target.closest('.day-dot2'); if (b) openDiaryDate(b.dataset.date); });
  $('#diaryRecent').addEventListener('click', e => {
    const li = e.target.closest('li[data-pid]'); if (!li) return;
    current = { kind: 'diary', id: 'diary' }; openPost(li.dataset.pid);
  });
  $('#diaryMoods').addEventListener('click', e => {
    const b = e.target.closest('.mood'); if (!b) return;
    const today = todayStr();
    let n = diaryFor(today);
    if (!n) { n = { id: uid(), date: today, mood: '', title: '', text: '', html: '', photos: [], board: '', at: Date.now() }; state.diary.notes.push(n); }
    n.mood = n.mood === b.dataset.mood ? '' : b.dataset.mood;
    if (!n.mood && !n.title && !n.text && !(n.photos || []).length) state.diary.notes = state.diary.notes.filter(x => x !== n);
    save(); renderDiary();
  });

  /* ---------- 호로록 메모장 ---------- */
  const memoText = $('#memoText');
  let memoTimer = null;
  function renderMemo() {
    if (document.activeElement !== memoText) memoText.value = state.memo || '';
    $('#memoFab').classList.toggle('has-memo', !!(state.memo || '').trim());
  }
  function openMemo() {
    $('#memoPanel').hidden = false;
    $('#memoFab').classList.add('open');
    renderMemo();
    setTimeout(() => { memoText.focus(); memoText.setSelectionRange(memoText.value.length, memoText.value.length); }, 40);
  }
  function closeMemo() {
    $('#memoPanel').hidden = true;
    $('#memoFab').classList.remove('open');
  }
  $('#memoFab').addEventListener('click', () => { $('#memoPanel').hidden ? openMemo() : closeMemo(); });
  $('#memoClose').addEventListener('click', closeMemo);
  memoText.addEventListener('input', () => {
    state.memo = memoText.value;
    $('#memoState').textContent = '적는 중…';
    clearTimeout(memoTimer);
    memoTimer = setTimeout(() => {
      save();
      $('#memoState').textContent = pin ? '저장됨 · ' + new Date().toLocaleTimeString('ko-KR') : '이 기기에 저장됨';
      $('#memoFab').classList.toggle('has-memo', !!state.memo.trim());
    }, 700);
  });
  $('#memoClear').addEventListener('click', () => {
    if (!state.memo.trim() || !confirm('메모장을 비울까요?')) return;
    state.memo = ''; memoText.value = ''; save(); renderMemo();
    $('#memoState').textContent = '비웠어요';
    memoText.focus();
  });
  $('#memoToTodo').addEventListener('click', () => {
    const lines = (memoText.value || '').split('\n');
    const i = lines.findIndex(l => l.trim());
    if (i < 0) return;
    const line = lines[i].trim();
    lines.splice(i, 1);
    state.memo = lines.join('\n'); memoText.value = state.memo;
    state.todos.push({ id: uid(), text: line, date: null, done: false, created: Date.now() });
    save(); renderTodos(); renderCalendar(); renderMemo();
    $('#memoState').textContent = '할일로 보냈어요: ' + line.slice(0, 20);
  });

  /* ---------- 언어 ---------- */
  function renderLang() {
    const today = todayStr();
    $('#langList').innerHTML = LANGS.map(l => {
      const log = state.langLog[l.id] || [];
      const on = log.indexOf(today) >= 0;
      let streak = 0, d = new Date();
      if (!on) d.setDate(d.getDate() - 1);
      while (log.indexOf(ymd(d)) >= 0) { streak++; d.setDate(d.getDate() - 1); }
      return `<li class="${on ? 'on' : ''}"><input type="checkbox" data-id="${l.id}" ${on ? 'checked' : ''}><span>${l.name}</span><span class="streak">${streak ? `🔥 ${streak}일` : `총 ${log.length}일`}</span></li>`;
    }).join('');
  }
  $('#langList').addEventListener('change', e => {
    const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
    const id = cb.dataset.id, today = todayStr();
    const log = state.langLog[id] = state.langLog[id] || [];
    const i = log.indexOf(today);
    if (cb.checked) { if (i < 0) log.push(today); } else if (i >= 0) log.splice(i, 1);
    save(); renderLang();
  });

  /* ---------- 동기화 ---------- */
  const OLD_MSG = '서버가 아직 옛 버전이에요. Apps Script에서 [배포] → [배포 관리] → ✏️ → 버전 "새 버전" → [배포]까지 해야 반영됩니다. 저장만으로는 바뀌지 않아요.';

  function setSync(msg, kind) {
    const el = $('#syncState'), badge = $('#syncBadge');
    el.textContent = msg;
    el.className = 'sync-state ' + (kind || '');
    badge.textContent = { ok: '☁️ 저장됨', wait: '☁️ 저장 중…', err: '⚠️ 오류', none: '🔒 잠김' }[kind || 'none'];
    badge.className = 'sync-badge ' + (kind || 'none');
    $('#pinForget').hidden = !pin;
    $('#pinInput').value = '';
    $('#pinInput').placeholder = pin ? '잠금 해제됨' : 'PIN';
  }

  async function callApi(action, extra) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, pin }, extra || {}))
    });
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(data.error || '서버 오류');
      err.badPin = !!data.badPin;
      err.oldVersion = String(data.error || '').indexOf('알 수 없는 action') >= 0;
      throw err;
    }
    return data;
  }

  /** 서버 응답을 상태에 반영. 서버가 모르는 항목(옛 배포)은 이 기기 값을 유지한다. */
  function adoptRemote(remote) {
    if (!((remote.todos && remote.todos.length) || remote.savedAt)) return false;
    const keep = k => (remote[k] !== undefined && remote[k] !== null) ? remote[k] : state[k];
    state = migrate(Object.assign(defaultState(), {
      todos: remote.todos || [],
      qty: remote.qty || {},
      now: remote.now || {},
      weight: remote.weight,
      weightStart: remote.weightStart,
      langLog: remote.langLog || {},
      useStocks: !!remote.useStocks,
      showDone: state.showDone,
      goals: keep('goals'), works: keep('works'), order: keep('order'), texts: keep('texts'), memo: keep('memo'), diary: keep('diary'), events: keep('events'), days: keep('days'), showTodos: remote.showTodos === undefined ? state.showTodos : !!remote.showTodos, panels: keep('panels'), treeCounts: remote.treeCounts === undefined ? state.treeCounts : !!remote.treeCounts, months: keep('months'), years: keep('years')
    }));
    saveLocal();
    return true;
  }

  async function pullFromCloud(silent) {
    if (!pin) return;
    if (!silent) setSync('불러오는 중…', 'wait');
    try {
      const data = await callApi('load');
      prices = data.prices || {};
      adoptRemote(data.state || {});
      renderAll();
      setSync(`불러옴 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
    } catch (err) {
      if (err.oldVersion) forgetPin(OLD_MSG);
      else if (err.badPin) forgetPin(err.message);
      else { setSync('불러오기 실패: ' + err.message + ' (이 기기 저장본을 보는 중)', 'err'); renderAll(); }
    }
  }

  let dirtyWhileSyncing = false;
  async function pushToCloud() {
    if (!pin) return;
    if (syncing) { dirtyWhileSyncing = true; return; }   // 저장 중에 또 바뀌면, 끝난 뒤 한 번 더 보낸다
    syncing = true;
    setSync('저장 중…', 'wait');
    try {
      await callApi('save', { state });
      setSync(`저장됨 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
    } catch (err) {
      if (err.oldVersion) forgetPin(OLD_MSG);
      else if (err.badPin) forgetPin(err.message);
      else setSync('저장 실패: ' + err.message + ' (이 기기에는 저장돼 있어요)', 'err');
    } finally {
      syncing = false;
      if (dirtyWhileSyncing) { dirtyWhileSyncing = false; pushToCloud(); }
    }
  }

  function forgetPin(msg) {
    pin = '';
    try { localStorage.removeItem(PIN_KEY); } catch (e) {}
    prices = {};
    setSync(msg || '잠겼습니다. PIN을 넣어주세요.', 'none');
    if (modalOpen) showModalError(msg || 'PIN이 맞지 않아요.');
    renderAll();
  }

  /* ---------- PIN 팝업 ---------- */
  let modalOpen = false;
  function openPinModal() {
    modalOpen = true;
    const vEl = $('#pinModalVer'); if (vEl) vEl.textContent = '버전 ' + APP_VER + (apiUrl === DEFAULT_API ? '' : ' · 사용자 지정 주소');
    $('#pinModal').hidden = false;
    $('#pinModalErr').hidden = true;
    const i = $('#pinModalInput');
    i.value = '';
    setTimeout(() => i.focus(), 50);
  }
  function closePinModal() {
    modalOpen = false;
    $('#pinModal').hidden = true;
    $('#pinModalInput').value = '';
  }
  function showModalError(msg) {
    const e = $('#pinModalErr');
    e.textContent = msg;
    e.hidden = false;
    const i = $('#pinModalInput');
    i.value = ''; i.focus();
  }
  async function submitModalPin() {
    const v = $('#pinModalInput').value.trim();
    if (!v) { showModalError('PIN을 넣어주세요.'); return; }
    if (!apiUrl) { showModalError('저장 서버 주소가 아직 없어요. 아래 ☁️ 동기화에서 주소를 먼저 넣어주세요.'); return; }
    $('#pinModalErr').hidden = true;
    $('#pinModalOk').disabled = true;
    $('#pinModalOk').textContent = '확인 중…';
    pin = v;
    try { localStorage.setItem(PIN_KEY, v); } catch (e) {}
    try {
      const data = await callApi('load');
      prices = data.prices || {};
      adoptRemote(data.state || {});
      renderAll();
      setSync(`불러옴 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
      closePinModal();
    } catch (err) {
      pin = '';
      try { localStorage.removeItem(PIN_KEY); } catch (e) {}
      const why = err.oldVersion ? OLD_MSG
        : err.badPin ? err.message
        : /fetch|network|load failed/i.test(err.message) ? '서버에 연결하지 못했어요. 인터넷이나 광고 차단 설정을 확인해 주세요. (' + err.message + ')'
        : '오류: ' + err.message;
      showModalError(why);
      setSync(why, 'err');
    } finally {
      $('#pinModalOk').disabled = false;
      $('#pinModalOk').textContent = '잠금 풀기';
    }
  }
  $('#pinModalReset').addEventListener('click', () => {
    if (!confirm('이 기기의 저장값을 지우고 최신 파일로 다시 엽니다. 서버에 저장된 내용은 그대로예요.')) return;
    try { localStorage.clear(); } catch (e) {}
    location.replace(location.pathname + '?r=' + Date.now());
  });
  $('#pinModalOk').addEventListener('click', submitModalPin);
  $('#pinModalInput').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); submitModalPin(); }
  });
  $('#pinModalLater').addEventListener('click', () => {
    closePinModal();
    setSync('나중에 하기로 했어요. 지금은 이 브라우저에만 저장됩니다.', 'none');
  });
  $('#pinModal').addEventListener('click', e => { if (e.target === $('#pinModal')) closePinModal(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#memoPanel').hidden) { closeMemo(); return; }
    if (dayOpen) { closeDay(); return; }
    if (modalOpen) closePinModal();
    else if (document.body.classList.contains('on-board')) { if (board.view === 'list' || board.view === 'hub' || board.view === 'all') go('', true); else openList(true); }
    else if (itemOpen) closeItemModal();
  });
  $('#syncBadge').addEventListener('click', e => {
    if (pin) return;
    e.preventDefault();
    openPinModal();
  });

  function unlock() {
    if (!apiUrl) {
      setSync('아직 저장 서버 주소가 코드에 없어요. 아래 [주소가 바뀌었다면]을 펼쳐 주소를 넣고 [주소 바꾸기]를 먼저 눌러주세요.', 'none');
      return;
    }
    const v = $('#pinInput').value.trim();
    if (!v) { setSync('PIN을 넣어주세요.', 'none'); $('#pinInput').focus(); return; }
    pin = v;
    try { localStorage.setItem(PIN_KEY, v); } catch (e) {}
    pullFromCloud();
  }
  $('#pinSave').addEventListener('click', () => {
    if ($('#pinInput').value.trim()) unlock(); else openPinModal();
  });
  $('#pinInput').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); unlock(); }
  });
  $('#pinForget').addEventListener('click', () => {
    forgetPin('이 기기에서 잠갔어요. 다시 열려면 PIN을 넣으세요.');
  });
  $('#apiSync').addEventListener('click', () => {
    if (!pin) { setSync('먼저 PIN을 넣어주세요.', 'none'); $('#pinInput').focus(); return; }
    pushToCloud().then(() => pullFromCloud(true));
  });
  $('#apiSave').addEventListener('click', () => {
    const v = $('#apiUrl').value.trim();
    if (v && (v.indexOf('https://script.google.com/macros/s/') !== 0 || v.slice(-5) !== '/exec')) {
      alert('주소 형식이 달라요.\nhttps://script.google.com/macros/s/…/exec 형태여야 합니다.');
      return;
    }
    apiUrl = v || DEFAULT_API;
    try { v ? localStorage.setItem(API_KEY, v) : localStorage.removeItem(API_KEY); } catch (e) {}
    setSync('주소를 바꿨어요. PIN을 다시 넣어주세요.', 'none');
    if (pin) pullFromCloud();
  });

  /* ---------- 내보내기 / 불러오기 ---------- */
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `myhome-${todayStr()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data !== 'object' || !Array.isArray(data.todos)) throw new Error('형식 오류');
        if (!confirm(`할일 ${data.todos.length}개를 포함한 데이터로 덮어쓸까요?`)) return;
        state = migrate(Object.assign(defaultState(), data)); save(); renderAll();
      } catch (err) { alert('불러오기 실패: ' + err.message); }
      e.target.value = '';
    };
    r.readAsText(f);
  });

  /* ---------- 시작 ---------- */
  function renderAll() {
    applyTexts(); applyOrder(); applySide();
    renderHeader(); renderAssets(); renderWork(); renderCalendar(); renderTodos(); renderWeight(); renderLang(); renderMemo(); renderDiary(); renderMonth(); renderYear();
    if (dayOpen) renderDay();
    if (document.body.classList.contains('on-board')) {
      if (board.view === 'post' && board.postId) renderPostPage(board.postId);
      else if (board.view === 'list') renderList();
      else if (board.view === 'hub') renderHub();
      else if (board.view === 'all') renderAllPosts();
    }
  }
  renderAll();
  route();
  if (apiUrl !== DEFAULT_API) $('#apiUrl').value = apiUrl;
  if (pin && apiUrl) pullFromCloud();
  else if (!apiUrl) setSync('아직 저장 서버 주소가 코드에 없어요. 아래 [주소가 바뀌었다면]을 펼쳐 주소를 넣어주세요.', 'none');
  else {
    setSync('PIN을 넣으면 저장된 내용을 불러옵니다. 지금은 이 브라우저 저장본만 보여요.', 'none');
    openPinModal();
  }

  setInterval(() => { if (pin && !document.hidden) pullFromCloud(true); }, 30 * 60 * 1000);
  window.addEventListener('resize', (() => { let t; return () => { clearTimeout(t); t = setTimeout(renderCalendar, 150); }; })());
})();
