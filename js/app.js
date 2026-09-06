/* ============================================
   MY HOME — app.js
   저장: 구글 Apps Script(웹) + localStorage(오프라인 캐시)
   시세: Apps Script가 야후 파이낸스에서 가져와 전달
   ============================================ */
(function () {
  'use strict';

  const KEY = 'myhome.v1';
  const API_KEY = 'myhome.api2';   // 예전 키(myhome.api)에 남은 옛 주소는 무시한다
  const APP_VER = '20260906e';
  const PIN_KEY = 'myhome.pin';
  /**
   * 저장 서버 주소.
   * 서버가 PIN을 확인하므로 이 주소가 공개돼도 내용은 열리지 않습니다.
   * (PIN 검사가 없는 버전을 배포하면 이 전제가 깨집니다. 반드시 PIN 버전을 유지하세요.)
   */
  const DEFAULT_API = 'https://script.google.com/macros/s/AKfycbywuEhAog3R8aU3EfOLSXaE97YUcOenOczh-_TY2wWM9En8uiuBNnjMRT6P16aFYEdEuw/exec';

  /* ---------- 고정 데이터 ---------- */
  const ASSETS = [
    { id: 'emtec', name: '이엠텍', where: '토스증권', cost: 341224360, kind: 'stock' },
    { id: 'hlb',   name: 'HLB',    where: '키움증권', cost: 50673700,  kind: 'stock' },
    { id: 'cash',  name: '현금',   where: '계좌',     cost: 10000000,  kind: 'cash' },
    { id: 'land',  name: '토지 (증평 미암리 300평)', where: '부동산', cost: 68000000, kind: 'land' },
  ];
  const JEONSE = { total: 300000000, paid: 30000000, loan: 200000000, need: 70000000, fee: 1000000 };
  const CAR = 16890000;
  const HOUSE = 300000000;

  /* 도장깨기: 위에서부터 순서대로 채운다 (같은 돈이 중복 계산되지 않음) */
  const LADDER = [
    { id: 'jeonse', emoji: '🏠', title: '전세 잔금 + 중개수수료', amount: JEONSE.need + JEONSE.fee, desc: '잔금 7,000만 + 수수료 100만' },
    { id: 'car',    emoji: '🚗', title: '캐스퍼 터보 디에센셜',   amount: CAR,                      desc: '스마트센스1 · 컴포트 · 액티브2 · 스타일' },
    { id: 'house',  emoji: '🏡', title: '증평 미암리 집 짓기',     amount: HOUSE, long: true,        desc: '땅은 이미 내 것. 그 위에 집을' },
  ];
  const TARGET_WEIGHT = 44;

  const GOALS = [
    { emoji: '🏡', title: '증평 미암리에 집 짓기', desc: '300평 땅은 이미 내 것. 건축비 3억이 마지막 칸.', tag: '집', bar: 'house' },
    { emoji: '🚗', title: '캐스퍼 터보 디에센셜', desc: '1,689만 원. 전세를 통과해야 열리는 2번 칸.', tag: '차', bar: 'car' },
    { emoji: '🏠', title: '전세 잔금 + 중개수수료 7,100만 원', desc: '계약금 3천만 완료, 대출 2억. 도장깨기 1번 칸.', tag: '전세', bar: 'jeonse' },
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

  /* ---------- 상태 ---------- */
  const defaultState = () => ({ todos: [], qty: {}, now: {}, weight: null, weightStart: null, langLog: {}, showDone: false, useStocks: false });
  let state = load();
  let prices = {};          // { emtec: {price, prev, name}, ... }
  let apiUrl = DEFAULT_API;
  let pin = '';
  let syncing = false;
  let pendingSave = null;

  try {
    localStorage.removeItem('myhome.api');            // 옛 주소 저장값 제거
    const ov = localStorage.getItem(API_KEY) || '';
    apiUrl = (ov && ov !== DEFAULT_API) ? ov : DEFAULT_API;
    pin = localStorage.getItem(PIN_KEY) || '';
  } catch (e) { apiUrl = DEFAULT_API; pin = ''; }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { return defaultState(); }
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
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
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

  /* ---------- 자산 ---------- */
  /** 각 항목의 현재 평가금액. 모르면 null */
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

    // 요약
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

    // 시세 안내문
    const note = $('#quoteNote');
    const any = Object.keys(prices).length;
    if (!pin) note.textContent = '시세를 자동으로 가져오려면 아래 ☁️ 동기화에서 PIN을 넣어주세요.';
    else if (!any) note.textContent = '시세를 불러오는 중…';
    else {
      const t = prices.emtec && prices.emtec.time ? new Date(prices.emtec.time) : new Date();
      const errs = Object.keys(prices).filter(k => prices[k].error);
      note.textContent = errs.length
        ? `시세 일부 실패: ${errs.join(', ')}`
        : `시세 기준 ${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())} · 장 마감 후에는 종가가 표시돼요`;
    }

    renderGoals();
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
  /** 가용 자금 = 현금 (+ 선택 시 주식 평가금액) */
  function poolAmount() {
    let sum = valueOf(ASSETS[2]) ?? ASSETS[2].cost;
    if (state.useStocks) ASSETS.forEach(a => { if (a.kind === 'stock') sum += (valueOf(a) ?? a.cost); });
    return sum;
  }
  /** 위 칸부터 순서대로 채운다. 남은 돈만 다음 칸으로 내려간다. */
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

    $('#jeonseNote').textContent = rows[0].short <= 0
      ? '✓ 잔금과 수수료 준비 완료'
      : `${korean(rows[0].short)} 더 모으면 이 칸 통과`;

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

  /* ---------- 목표 ---------- */
  function goalProgress(key) {
    if (key !== 'weight') {
      const r = allocate().find(x => x.step.id === key);
      if (!r) return null;
      return { p: r.p, note: r.short <= 0 ? '✓ 준비 완료' : `${korean(r.short)} 남음` };
    }
    if (key === 'weight') {
      if (!state.weight) return { p: 0, note: '현재 체중을 적어줘' };
      const start = state.weightStart || state.weight;
      const left = Math.max(0, state.weight - TARGET_WEIGHT);
      const p = start > TARGET_WEIGHT ? pct(start - state.weight, start - TARGET_WEIGHT) : 100;
      return { p, note: left ? `${left.toFixed(1)}kg 남음` : '목표 달성!' };
    }
    return null;
  }
  function renderGoals() {
    $('#goalGrid').innerHTML = GOALS.map(g => {
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
    $('#side').scrollIntoView({ behavior: 'smooth', block: 'start' });
    inp.focus();
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
    const narrow = window.innerWidth <= 600;
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const s = ymd(d);
      const items = (byDate[s] || []).slice().sort((a, b) => a.done - b.done);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day' + (d.getMonth() !== m ? ' other' : '') + (s === today ? ' today' : '')
        + (s === selectedDate ? ' selected' : '') + (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '');
      btn.dataset.date = s;
      const open = items.filter(t => !t.done).length;
      btn.innerHTML = `<span class="day-num">${d.getDate()}</span>` + (narrow
        ? (items.length ? `<span class="day-dot">${open || '✓'}</span>` : '')
        : items.slice(0, 3).map(t => `<span class="day-item ${t.done ? 'done' : ''}" title="${esc(t.text)}">${esc(t.text)}</span>`).join('')
          + (items.length > 3 ? `<span class="day-more">+${items.length - 3}</span>` : ''));
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

    renderWork();
  }

  $('#todoForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#todoText').value.trim();
    if (!text) return;
    state.todos.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text, date: $('#todoDate').value || null, done: false, created: Date.now()
    });
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

  /** Apps Script 는 GET 으로 데이터를 주지 않는다. 모두 POST + PIN. */
  async function callApi(action, extra) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // preflight 회피
      body: JSON.stringify(Object.assign({ action, pin }, extra || {}))
    });
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(data.error || '서버 오류');
      err.badPin = !!data.badPin;
      // 옛 스크립트는 load 를 모른다 → 배포가 갱신되지 않은 것
      err.oldVersion = String(data.error || '').indexOf('알 수 없는 action') >= 0;
      throw err;
    }
    return data;
  }

  async function pullFromCloud(silent) {
    if (!pin) return;
    if (!silent) setSync('불러오는 중…', 'wait');
    try {
      const data = await callApi('load');
      prices = data.prices || {};
      const remote = data.state || {};
      if ((remote.todos && remote.todos.length) || remote.savedAt) {
        state = Object.assign(defaultState(), {
          todos: remote.todos || [],
          qty: remote.qty || {},
          now: remote.now || {},
          weight: remote.weight,
          weightStart: remote.weightStart,
          langLog: remote.langLog || {},
          useStocks: !!remote.useStocks,
          showDone: state.showDone
        });
        saveLocal();
      }
      renderAll();
      setSync(`불러옴 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
    } catch (err) {
      if (err.oldVersion) forgetPin(OLD_MSG);
      else if (err.badPin) forgetPin(err.message);
      else { setSync('불러오기 실패: ' + err.message + ' (이 기기 저장본을 보는 중)', 'err'); renderAll(); }
    }
  }

  async function pushToCloud() {
    if (!pin || syncing) return;
    syncing = true;
    setSync('저장 중…', 'wait');
    try {
      await callApi('save', { state });
      setSync(`저장됨 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
    } catch (err) {
      if (err.oldVersion) forgetPin(OLD_MSG);
      else if (err.badPin) forgetPin(err.message);
      else setSync('저장 실패: ' + err.message + ' (이 기기에는 저장돼 있어요)', 'err');
    } finally { syncing = false; }
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
    const m = $('#pinModal');
    m.hidden = false;
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
    await pullFromCloud();
    $('#pinModalOk').disabled = false;
    $('#pinModalOk').textContent = '잠금 풀기';
    if (pin) closePinModal();     // 성공하면 pin 이 남아 있다
  }
  $('#pinModalOk').addEventListener('click', submitModalPin);
  $('#pinModalInput').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); submitModalPin(); }
  });
  $('#pinModalLater').addEventListener('click', () => {
    closePinModal();
    setSync('나중에 하기로 했어요. 지금은 이 브라우저에만 저장됩니다.', 'none');
  });
  $('#pinModal').addEventListener('click', e => { if (e.target === $('#pinModal')) closePinModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOpen) closePinModal(); });
  $('#syncBadge').addEventListener('click', e => {
    if (pin) return;              // 이미 열려 있으면 동기화 섹션으로 이동
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
  if (apiUrl !== DEFAULT_API) $('#apiUrl').value = apiUrl;
  if (pin && apiUrl) pullFromCloud();
  else if (!apiUrl) setSync('아직 저장 서버 주소가 코드에 없어요. 아래 [주소가 바뀌었다면]을 펼쳐 주소를 넣어주세요.', 'none');
  else {
    setSync('PIN을 넣으면 저장된 내용을 불러옵니다. 지금은 이 브라우저 저장본만 보여요.', 'none');
    openPinModal();
  }

  // 30분마다 시세 갱신
  setInterval(() => { if (pin && !document.hidden) pullFromCloud(true); }, 30 * 60 * 1000);
  window.addEventListener('resize', (() => { let t; return () => { clearTimeout(t); t = setTimeout(renderCalendar, 150); }; })());
})();
