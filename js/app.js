/* ============================================
   MY HOME — app.js
   할일 / 자산 평가금액 / 체중 / 언어 체크는 localStorage에 저장
   ============================================ */
(function () {
  'use strict';

  const KEY = 'myhome.v1';

  /* ---------- 고정 데이터 ---------- */
  const ASSETS = [
    { id: 'emtec', name: '이엠텍', where: '토스증권', cost: 341224360, kind: 'stock' },
    { id: 'hlb',   name: 'HLB',    where: '키움증권', cost: 50673700,  kind: 'stock' },
    { id: 'cash',  name: '현금',   where: '계좌',     cost: 10000000,  kind: 'cash' },
    { id: 'land',  name: '토지 (증평 미암리 300평)', where: '부동산', cost: 68000000, kind: 'land' },
  ];
  const JEONSE = { total: 300000000, paid: 30000000, loan: 200000000, need: 70000000 };
  const CAR = 16890000;
  const HOUSE = 300000000;
  const TARGET_WEIGHT = 44;

  const GOALS = [
    { emoji: '🏡', title: '증평 미암리에 집 짓기', desc: '300평 땅 위에 3억짜리 내 집. 가장 큰 꿈.', tag: '집', bar: 'house' },
    { emoji: '🚗', title: '캐스퍼 터보 디에센셜', desc: '1,689만 원. 스마트센스1 · 컴포트 · 액티브2 · 스타일.', tag: '차', bar: 'car' },
    { emoji: '🏠', title: '전세 잔금 7,000만 원 마련', desc: '계약금 3천만 납입 완료, 대출 2억, 잔금 7천만.', tag: '전세', bar: 'jeonse' },
    { emoji: '✨', title: '눈 · 코 성형', desc: '하고 싶은 것. 상담부터 차근차근.', tag: '성형' },
    { emoji: '⚖️', title: '44kg까지 다이어트', desc: '건강하게, 꾸준하게.', tag: '다이어트', bar: 'weight' },
    { emoji: '👶', title: '아이', desc: '아이는 낳고 싶다. 결혼은 생각 없음. 내 방식대로.', tag: '아이' },
    { emoji: '🗣', title: '일본어 · 중국어 배우기', desc: '그리고 영어로 글을 더 잘 읽기.', tag: '언어' },
    { emoji: '🎸', title: '밴드: 드럼 · 기타', desc: '악기 하나는 제대로. 언어로 하는 취미도.', tag: '취미' },
    { emoji: '✈️', title: '소중한 사람들과 여행', desc: '가족과 추억 남기기. 이게 제일 소중.', tag: '여행' },
  ];

  const WORKS = [
    { name: '우렁의사', desc: '앱 만들기. 개발 진행 중.', status: 'build', label: '개발 중' },
    { name: 'stay in 비밀의정원', desc: '오프라인 칵테일 가게. 자동으로 굴러가는 중.', status: 'run', label: '자동 운영' },
    { name: '바텐톡', desc: '앱 상용화 남음.', status: 'todo', label: '상용화 대기' },
    { name: '캐치걸', desc: '앱 상용화 남음.', status: 'todo', label: '상용화 대기' },
  ];

  const LANGS = [
    { id: 'ja', name: '🇯🇵 일본어' },
    { id: 'zh', name: '🇨🇳 중국어' },
    { id: 'en', name: '🇬🇧 영어 읽기' },
  ];

  /* ---------- 저장소 ---------- */
  const defaultState = () => ({ todos: [], now: {}, weight: null, lang: {}, langLog: {} });
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { return defaultState(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가 환경 */ }
  }

  /* ---------- 유틸 ---------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => ymd(new Date());
  const won = n => Math.round(n).toLocaleString('ko-KR') + ' 원';
  const signed = n => (n > 0 ? '+' : '') + Math.round(n).toLocaleString('ko-KR');
  function korean(n) {
    // 469898060 → "4억 6,990만"
    const neg = n < 0; n = Math.abs(Math.round(n));
    const eok = Math.floor(n / 1e8);
    const man = Math.round((n % 1e8) / 1e4);
    let s = '';
    if (eok) s += eok + '억 ';
    if (man || !eok) s += man.toLocaleString('ko-KR') + '만';
    return (neg ? '-' : '') + s.trim() + ' 원';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function pct(a, b) { return Math.max(0, Math.min(100, (a / b) * 100)); }
  function dateLabel(s) {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const w = '일월화수목금토'[dt.getDay()];
    return `${m}/${d} (${w})`;
  }
  function daysFromToday(s) {
    const [y, m, d] = s.split('-').map(Number);
    const a = new Date(y, m - 1, d), b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  }

  /* ---------- 헤더 ---------- */
  function renderHeader() {
    const d = new Date();
    const w = '일요일 월요일 화요일 수요일 목요일 금요일 토요일'.split(' ')[d.getDay()];
    $('#todayLabel').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${w}`;
    const h = d.getHours();
    const g = h < 5 ? '아직 깨어 있네. 오늘도 수고했어' : h < 12 ? '좋은 아침. 오늘도 한 걸음' : h < 18 ? '좋은 오후. 지금 이것부터' : '좋은 저녁. 오늘 한 일을 돌아보자';
    $('#greeting').textContent = g;
  }

  /* ---------- 자산 ---------- */
  function currentValue(a) {
    const v = state.now[a.id];
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }
  function renderAssets() {
    const body = $('#assetBody');
    body.innerHTML = '';
    let totalCost = 0, totalNow = 0, anyNow = false;
    ASSETS.forEach(a => {
      const now = currentValue(a);
      const nowV = now === null ? a.cost : now;
      const pnl = nowV - a.cost;
      totalCost += a.cost; totalNow += nowV; if (now !== null) anyNow = true;
      const tr = document.createElement('tr');
      const cls = now === null ? 'flat' : pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'flat';
      const pnlText = now === null ? '—' : `${signed(pnl)} (${signed(pnl / a.cost * 100).replace(/(\.\d)\d+/, '$1')}%)`;
      tr.innerHTML = `
        <td class="name">${esc(a.name)}</td>
        <td class="where">${esc(a.where)}</td>
        <td class="num">${won(a.cost)}</td>
        <td class="num"><input class="now" data-id="${a.id}" inputmode="numeric" placeholder="${a.cost.toLocaleString('ko-KR')}" value="${now === null ? '' : now.toLocaleString('ko-KR')}"></td>
        <td class="num pnl ${cls}">${pnlText}</td>`;
      body.appendChild(tr);
    });
    $('#assetTotalCost').textContent = won(totalCost);
    $('#assetTotalNow').textContent = anyNow ? won(totalNow) : '—';
    const tp = totalNow - totalCost;
    const tpEl = $('#assetTotalPnl');
    tpEl.textContent = anyNow ? `${signed(tp)} (${signed(tp / totalCost * 100).replace(/(\.\d)\d+/, '$1')}%)` : '—';
    tpEl.className = 'num pnl ' + (anyNow ? (tp > 0 ? 'up' : tp < 0 ? 'down' : 'flat') : 'flat');

    // 요약
    $('#sumAssets').textContent = korean(totalCost);
    const sub = $('#sumAssetsNow');
    if (anyNow) {
      sub.textContent = `평가 ${korean(totalNow)} · ${signed(tp)} 원`;
      sub.className = 'stat-sub ' + (tp > 0 ? 'up' : tp < 0 ? 'down' : '');
    } else { sub.textContent = '평가금액 입력 시 손익 표시'; sub.className = 'stat-sub'; }

    // 전세: 현금으로 얼마나 채웠나
    const cash = currentValue(ASSETS[2]) ?? ASSETS[2].cost;
    const short = Math.max(0, JEONSE.need - cash);
    $('#sumJeonse').textContent = short ? korean(short) + ' 더' : '준비 완료';
    $('#jeonseBar').style.width = pct(cash, JEONSE.need) + '%';
    $('#jeonseNote').textContent = short
      ? `현금 ${korean(cash)} 보유 → 잔금까지 ${korean(short)} 부족`
      : `현금 ${korean(cash)} 보유 → 잔금 준비 완료`;

    // 차
    $('#carBar').style.width = pct(cash, CAR) + '%';
    $('#carNote').textContent = cash >= CAR ? '현금으로 바로 가능' : `현금 기준 ${Math.round(pct(cash, CAR))}% · ${korean(CAR - cash)} 더 필요`;

    // 집
    const landNow = currentValue(ASSETS[3]) ?? ASSETS[3].cost;
    $('#houseBar').style.width = pct(landNow, HOUSE) + '%';
    $('#houseNote').textContent = `땅값 ${korean(landNow)} 확보 · 건축비 ${korean(HOUSE)} 목표`;

    renderGoals();
  }
  $('#assetBody').addEventListener('change', e => {
    const inp = e.target.closest('input.now'); if (!inp) return;
    const raw = inp.value.replace(/[^\d.-]/g, '');
    if (raw === '') delete state.now[inp.dataset.id];
    else { const n = Number(raw); if (isFinite(n)) state.now[inp.dataset.id] = n; }
    save(); renderAssets();
  });
  $('#assetBody').addEventListener('focusin', e => {
    const inp = e.target.closest('input.now'); if (!inp) return;
    inp.value = inp.value.replace(/,/g, ''); inp.select();
  });

  /* ---------- 목표 카드 ---------- */
  function goalProgress(key) {
    const cash = currentValue(ASSETS[2]) ?? ASSETS[2].cost;
    if (key === 'car') return { p: pct(cash, CAR), note: `현금 기준 ${Math.round(pct(cash, CAR))}%` };
    if (key === 'jeonse') return { p: pct(cash, JEONSE.need), note: `${korean(Math.max(0, JEONSE.need - cash))} 남음` };
    if (key === 'house') { const l = currentValue(ASSETS[3]) ?? ASSETS[3].cost; return { p: pct(l, HOUSE), note: `땅 확보 · 건축비 ${Math.round(pct(l, HOUSE))}%` }; }
    if (key === 'weight') {
      if (!state.weight) return { p: 0, note: '현재 체중을 입력해줘' };
      const start = state.weightStart || state.weight;
      const left = Math.max(0, state.weight - TARGET_WEIGHT);
      const p = start > TARGET_WEIGHT ? pct(start - state.weight, start - TARGET_WEIGHT) : 100;
      return { p, note: left ? `${left.toFixed(1)}kg 남음` : '목표 달성!' };
    }
    return null;
  }
  function renderGoals() {
    const grid = $('#goalGrid');
    grid.innerHTML = GOALS.map((g, i) => {
      const pr = g.bar ? goalProgress(g.bar) : null;
      return `<article class="goal">
        <span class="goal-emoji">${g.emoji}</span>
        <h3>${esc(g.title)}</h3>
        <p>${esc(g.desc)}</p>
        ${pr ? `<div class="bar"><div class="bar-fill ${g.bar === 'weight' ? 'pink' : ''}" style="width:${pr.p}%"></div></div><p class="bar-note">${esc(pr.note)}</p>` : ''}
        <button class="goal-add" data-tag="${esc(g.tag)}">+ 할일</button>
      </article>`;
    }).join('');
  }

  /* ---------- 일 ---------- */
  function renderWork() {
    $('#workGrid').innerHTML = WORKS.map(w => {
      const open = state.todos.filter(t => !t.done && t.text.startsWith(`[${w.name}]`)).length;
      return `<article class="work">
        <span class="chip ${w.status}">${w.label}</span>
        <h3>${esc(w.name)}</h3>
        <p>${esc(w.desc)}</p>
        <span class="work-open muted">${open ? `남은 할일 ${open}개` : '남은 할일 없음'}</span>
        <button class="goal-add" data-tag="${esc(w.name)}">+ 할일</button>
      </article>`;
    }).join('');
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.goal-add'); if (!b) return;
    const inp = $('#todoText');
    inp.value = `[${b.dataset.tag}] `;
    inp.focus();
    $('#side').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- 달력 ---------- */
  let calCursor = new Date(); calCursor.setDate(1);
  let selectedDate = null;

  function renderCalendar() {
    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    $('#calTitle').textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    const grid = $('#calGrid'); grid.innerHTML = '';
    const today = todayStr();
    const byDate = {};
    state.todos.forEach(t => { if (t.date) (byDate[t.date] = byDate[t.date] || []).push(t); });
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const s = ymd(d);
      const items = (byDate[s] || []).slice().sort((a, b) => a.done - b.done);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day' + (d.getMonth() !== m ? ' other' : '') + (s === today ? ' today' : '') + (s === selectedDate ? ' selected' : '') + (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '');
      btn.dataset.date = s;
      const shown = items.slice(0, 3);
      btn.innerHTML = `<span class="day-num">${d.getDate()}</span>` +
        shown.map(t => `<span class="day-item ${t.done ? 'done' : ''}" title="${esc(t.text)}">${esc(t.text)}</span>`).join('') +
        (items.length > 3 ? `<span class="day-more">+${items.length - 3}</span>` : '') +
        (items.length && window.innerWidth <= 600 ? `<span class="day-more">${items.filter(t => !t.done).length}개</span>` : '');
      grid.appendChild(btn);
    }
  }
  $('#calGrid').addEventListener('click', e => {
    const day = e.target.closest('.day'); if (!day) return;
    selectedDate = day.dataset.date;
    $('#todoDate').value = selectedDate;
    renderCalendar(); renderTodos();
    $('#todoText').focus();
  });
  $('#calPrev').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
  $('#calNext').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
  $('#calToday').addEventListener('click', () => { calCursor = new Date(); calCursor.setDate(1); selectedDate = todayStr(); $('#todoDate').value = selectedDate; renderCalendar(); renderTodos(); });

  /* ---------- 할일 ---------- */
  function renderTodos() {
    const today = todayStr();
    const groups = { late: [], today: [], sel: [], soon: [], none: [], done: [] };
    state.todos.forEach(t => {
      if (t.done) return groups.done.push(t);
      if (!t.date) return groups.none.push(t);
      if (selectedDate && selectedDate !== today && t.date === selectedDate) return groups.sel.push(t);
      if (t.date < today) return groups.late.push(t);
      if (t.date === today) return groups.today.push(t);
      groups.soon.push(t);
    });
    const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.created - b.created;
    Object.values(groups).forEach(g => g.sort(byDate));
    groups.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

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
    const section = (cls, title, list, extra) => list.length
      ? `<div class="todo-group ${cls}"><h4><span>${title}</span><span>${list.length}</span></h4><ul class="todo-list">${list.map(item).join('')}</ul></div>` : '';

    const openCount = state.todos.filter(t => !t.done).length;
    let html = '';
    if (selectedDate && selectedDate !== today) html += section('sel', `📌 ${dateLabel(selectedDate)}`, groups.sel);
    html += section('late', '⏰ 지난 일', groups.late);
    html += section('today', '☀️ 오늘', groups.today);
    html += section('soon', '📅 예정', groups.soon);
    html += section('none', '📝 언제든', groups.none);
    if (groups.done.length) html += `<div class="todo-group finished ${state.showDone ? 'open' : ''}"><h4><span>✔ 완료 ${state.showDone ? '▾' : '▸'}</span><span>${groups.done.length}</span></h4><ul class="todo-list">${groups.done.slice(0, 30).map(item).join('')}</ul></div>`;
    if (!html) html = '<p class="todo-empty">아직 할일이 없어요.<br>위에 적어보자.</p>';
    $('#todoGroups').innerHTML = html;
    $('#sideCount').textContent = openCount ? `남은 일 ${openCount}개` : '';

    // 요약
    const todayOpen = groups.today.length + groups.late.length + (selectedDate === today ? 0 : 0);
    $('#sumTodos').textContent = groups.today.length + '개';
    $('#sumTodosSub').textContent = groups.late.length ? `지난 일 ${groups.late.length}개도 있어요` : groups.today.length ? '오늘 안에 끝내자' : '남은 일이 없어요';
    void todayOpen;

    renderWork();
  }

  $('#todoForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#todoText').value.trim();
    if (!text) return;
    const date = $('#todoDate').value || null;
    state.todos.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, date, done: false, created: Date.now() });
    save();
    $('#todoText').value = '';
    renderTodos(); renderCalendar();
    $('#todoText').focus();
  });
  $('#todoText').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); $('#todoForm').requestSubmit(); }
  });
  $('#todoDateClear').addEventListener('click', () => { $('#todoDate').value = ''; selectedDate = null; renderCalendar(); renderTodos(); });
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
    const p = start > TARGET_WEIGHT ? pct(start - state.weight, start - TARGET_WEIGHT) : 100;
    bar.style.width = p + '%';
    note.textContent = left > 0
      ? `${state.weight}kg → 44kg · ${left.toFixed(1)}kg 남음` + (start !== state.weight ? ` · 시작 ${start}kg에서 ${(start - state.weight).toFixed(1)}kg 감량` : '')
      : `🎉 목표 달성! (${state.weight}kg)`;
  }
  wIn.addEventListener('change', () => {
    const v = parseFloat(wIn.value);
    if (!isFinite(v) || v <= 0) { state.weight = null; }
    else { if (!state.weightStart) state.weightStart = v; state.weight = v; }
    save(); renderWeight(); renderGoals();
  });

  /* ---------- 언어 체크 (매일 리셋, 연속일) ---------- */
  function renderLang() {
    const today = todayStr();
    $('#langList').innerHTML = LANGS.map(l => {
      const log = state.langLog[l.id] || [];
      const on = log.includes(today);
      // 연속일: 오늘 또는 어제부터 거꾸로
      let streak = 0, d = new Date();
      if (!on) d.setDate(d.getDate() - 1);
      while (log.includes(ymd(d))) { streak++; d.setDate(d.getDate() - 1); }
      return `<li class="${on ? 'on' : ''}"><input type="checkbox" data-id="${l.id}" ${on ? 'checked' : ''}><span>${l.name}</span><span class="streak">${streak ? `🔥 ${streak}일` : `총 ${log.length}일`}</span></li>`;
    }).join('');
  }
  $('#langList').addEventListener('change', e => {
    const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
    const id = cb.dataset.id, today = todayStr();
    const log = state.langLog[id] = state.langLog[id] || [];
    if (cb.checked) { if (!log.includes(today)) log.push(today); }
    else { const i = log.indexOf(today); if (i >= 0) log.splice(i, 1); }
    save(); renderLang();
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
        state = Object.assign(defaultState(), data); save(); renderAll();
      } catch (err) { alert('불러오기 실패: ' + err.message); }
      e.target.value = '';
    };
    r.readAsText(f);
  });

  /* ---------- 시작 ---------- */
  function renderAll() {
    renderHeader(); renderAssets(); renderWork(); renderCalendar(); renderTodos(); renderWeight(); renderLang();
  }
  renderAll();
  window.addEventListener('resize', (() => { let t; return () => { clearTimeout(t); t = setTimeout(renderCalendar, 150); }; })());
})();
