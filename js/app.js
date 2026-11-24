/* ============================================
   MY HOME — app.js  (저장 · 동기화 · 플래너 로컬 서버)
   화면은 js/planner.js — mindinside.kr/blog/ops '운영팀 플래너'(THE WEEKLY Times)를 그대로 옮긴 것.
   그 화면이 부르던 서버(/admin/opscal…, hongcbt opscal.js)를 여기서 브라우저 안에서 똑같이 흉내 낸다.
   저장: localStorage(이 기기) + 구글 Apps Script(PIN, 폰·컴퓨터 공유) — tools/apps-script.gs 그대로.
   ============================================ */
(function () {
  'use strict';

  const KEY = 'myhome.v1';
  const API_KEY = 'myhome.api2';
  const PIN_KEY = 'myhome.pin';
  const APP_VER = '20261124a';
  /** 저장 서버 주소. 서버가 PIN을 확인하므로 주소가 공개돼도 내용은 열리지 않는다. */
  const DEFAULT_API = 'https://script.google.com/macros/s/AKfycby-lVpo55ltoCZupAziQQrs_OeLUhPMM1h98HfJcZhDEX6ZlvoHQFCGyGaA0F9qmF-YKw/exec';
  // 시트 한 칸은 5만 자까지. 서버(apps-script.gs)는 4만 자가 넘으면 여러 칸으로 나눠 적지만,
  // 읽을 때 다시 붙이는 부분이 깨져 있어서(#(d+)) 4만 자 넘는 항목은 못 읽는다 → 여기서 3만 자씩 나눠 따로 담는다.
  const PART_MAX = 30000;
  const ME = { by: '나', email: '' };
  const HL_COLORS = ['#fff176', '#ffcc80', '#f8bbd0', '#c5e1a5', '#b3e5fc', '#d1c4e9', '#ffab91', '#cfd8dc'];
  const KINDS = ['event', 'task', 'memo', 'wmemo'];
  const STATUS = ['todo', 'doing', 'done'];
  const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const COLOR = /^#[0-9a-f]{6}$/i;

  /* ---------- 상태 ----------
     state 는 시트에 저장되는 전체 객체. 예전 대시보드 항목(todos·goals·assets·diary…)도 지우지 않고 그대로 들고 다닌다.
     플래너 데이터: state.ops = { v, parts, people, lastCarry }, 항목은 state.ops_0, state.ops_1 … 에 나눠 담는다. */
  let state = loadLocal();
  let OPS = unpack(state);
  let apiUrl = DEFAULT_API;
  let pin = '';
  try {
    const ov = localStorage.getItem(API_KEY) || '';
    apiUrl = (ov && ov !== DEFAULT_API) ? ov : DEFAULT_API;
    pin = localStorage.getItem(PIN_KEY) || '';
  } catch (e) { apiUrl = DEFAULT_API; pin = ''; }

  function loadLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
    } catch (e) { return {}; }
  }
  function fixItem(r) {
    return {
      id: String(r.id), kind: KINDS.indexOf(r.kind) >= 0 ? r.kind : 'event', day: String(r.day),
      start: r.start || '', end: r.end || '', title: r.title || '', memo: r.memo || '', owner: r.owner || '',
      status: r.status || '', doneAt: Number(r.doneAt) || 0, origDay: r.origDay || '', carried: Number(r.carried) || 0,
      repeat: r.repeat || '', until: r.until || '', skips: Array.isArray(r.skips) ? r.skips : [],
      created: Number(r.created) || Date.now(), createdBy: r.createdBy || '', updated: Number(r.updated) || Number(r.created) || Date.now(), updatedBy: r.updatedBy || ''
    };
  }
  function unpack(s) {
    const m = (s.ops && typeof s.ops === 'object') ? s.ops : {};
    const n = Number(m.parts) || 0;
    let items = [];
    for (let i = 0; i < n; i++) { const p = s['ops_' + i]; if (Array.isArray(p)) items = items.concat(p); }
    return {
      items: items.filter(r => r && r.id && DAY.test(String(r.day))).map(fixItem),
      people: Array.isArray(m.people) ? m.people.filter(p => p && p.name && COLOR.test(p.color)) : [],
      lastCarry: typeof m.lastCarry === 'string' ? m.lastCarry : ''
    };
  }
  function pack() {
    const parts = []; let cur = [], len = 2;
    OPS.items.forEach(it => {
      const l = JSON.stringify(it).length + 1;
      if (cur.length && len + l > PART_MAX) { parts.push(cur); cur = []; len = 2; }
      cur.push(it); len += l;
    });
    if (cur.length) parts.push(cur);
    Object.keys(state).forEach(k => { if (/^ops_\d+$/.test(k)) delete state[k]; });
    parts.forEach((p, i) => { state['ops_' + i] = p; });
    state.ops = { v: 1, parts: parts.length, people: OPS.people, lastCarry: OPS.lastCarry };
    if (window.MI && window.MI.packCrm) window.MI.packCrm(state);   // 사람 관리(js/crm.js)도 같은 방식으로 crm_0… 에
  }
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  let pendingSave = null, dirty = false;
  /** 이 기기에 먼저 저장하고, PIN 이 있으면 1.5초 뒤 시트에도 */
  function save() {
    pack(); saveLocal();
    if (!pin) return;
    dirty = true;
    clearTimeout(pendingSave);
    setSync('저장 대기 중…', 'wait');
    pendingSave = setTimeout(pushToCloud, 1500);
  }

  /* ---------- 날짜 잔손 (서버 opscal.js 와 같게 'YYYY-MM-DD' 글자, UTC 로 셈) ---------- */
  const p2 = n => (n < 10 ? '0' : '') + n;
  const toD = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
  const ofD = t => t.getUTCFullYear() + '-' + p2(t.getUTCMonth() + 1) + '-' + p2(t.getUTCDate());
  const addDays = (d, n) => { const t = toD(d); t.setUTCDate(t.getUTCDate() + n); return ofD(t); };
  const mondayOf = d => { const t = toD(d); const w = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - w); return ofD(t); };
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const dayLabel = d => { const t = toD(d); return (t.getUTCMonth() + 1) + '/' + t.getUTCDate() + ' (' + WD[t.getUTCDay()] + ')'; };
  function weekNo(d) {
    const t = toD(d); const w = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - w + 3);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t - y0) / 86400000 - 3 + ((y0.getUTCDay() + 6) % 7)) / 7);
  }
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ---------- 플래너 로컬 서버 (opscal.js 를 옮긴 것) ---------- */
  const byDay = (a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : (a.start < b.start ? -1 : a.start > b.start ? 1 : a.created - b.created);
  // 화면에 주는 모양 — 반복 일정은 날짜마다 펼친 것(series 1, baseDay = 처음 날)
  function out(r, day) {
    const o = Object.assign({}, r); delete o.skips;
    o.series = day ? 1 : 0; o.baseDay = r.day; if (day) o.day = day;
    return o;
  }
  // 반복 일정 펼치기 — 기간 안에 드는 날마다 한 줄
  function expand(rows, from, to) {
    const res = [];
    for (const r of rows) {
      if (!r.repeat) { if (r.day >= from && r.day <= to) res.push(out(r)); continue; }
      if (r.day > to || (r.until && r.until < from)) continue;
      const skips = new Set(r.skips);
      const end = r.until && r.until < to ? r.until : to;
      const push = d => { if (d >= from && d <= end && !skips.has(d)) res.push(out(r, d)); };
      if (r.repeat === 'weekly') {
        let d = r.day;
        if (d < from) { const k = Math.floor((toD(from) - toD(d)) / (7 * 86400000)); d = addDays(d, 7 * k); }
        for (let i = 0; i < 120 && d <= end; i++, d = addDays(d, 7)) push(d);
      } else if (r.repeat === 'monthly') {
        const b = toD(r.day), dd = b.getUTCDate();
        for (let k = 0; k < 600; k++) {
          const t = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + k, dd));
          if (t.getUTCDate() !== dd) continue;       // 그달에 그 날짜가 없다(31일 등)
          const d = ofD(t); if (d > end) break; push(d);
        }
      }
    }
    return res.sort(byDay);
  }
  const findRow = id => OPS.items.find(r => r.id === id) || null;
  // 지난 못 한 일 → 이번 주 월요일로 (몇 번 돌려도 같다)
  function carryOver(toMonday, by) {
    let n = 0; const t = Date.now();
    OPS.items.forEach(r => {
      if (r.kind !== 'task' || r.status === 'done' || r.repeat || r.day >= toMonday) return;
      if (!r.origDay) r.origDay = r.day;
      r.carried += 1; r.day = toMonday; r.updated = t; r.updatedBy = by || '월요일 자동 이월'; n++;
    });
    return n;
  }
  const ok = o => Object.assign({ ok: true, _st: 200 }, o);
  const bad = (st, error, message) => ({ _st: st, error, message });

  function apiGet(path) {
    const u = new URL(path, 'http://x'), q = k => u.searchParams.get(k) || '';
    const act = (u.pathname.match(/^\/admin\/opscal(?:\/(search|done|weekly))?$/) || [])[1];
    if (act === undefined && u.pathname !== '/admin/opscal') return bad(404, 'not-found');
    if (!act) {
      const from = q('from'), to = q('to');
      if (!DAY.test(from) || !DAY.test(to) || to < from) return bad(400, 'range');
      const overdue = OPS.items.filter(r => r.kind === 'task' && r.status !== 'done' && !r.repeat && r.day < from).sort(byDay).slice(-200).map(r => out(r));
      return ok({ me: ME, today: todayStr(), items: expand(OPS.items, from, to), overdue, people: OPS.people, colors: HL_COLORS });
    }
    if (act === 'search') {
      const k = q('q').trim().slice(0, 40).toLowerCase();
      if (!k) return ok({ items: [] });
      const has = v => String(v || '').toLowerCase().indexOf(k) >= 0;
      return ok({ items: OPS.items.filter(r => has(r.title) || has(r.memo) || has(r.owner)).sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : 0).slice(0, 100).map(r => out(r)) });
    }
    if (act === 'done') {
      const before = DAY.test(q('before')) ? q('before') : '9999-12-31';
      const all = OPS.items.filter(r => r.kind === 'task' && r.status === 'done');
      const rs = all.filter(r => r.day < before).sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : b.doneAt - a.doneAt);
      let items = rs.slice(0, 60), more = rs.length > 60;
      // 같은 날짜가 두 쪽에 걸치지 않게 — 다음 쪽은 마지막 날짜 '앞'부터. 마지막 날의 나머지는 이 쪽에 다 싣는다.
      if (more) { const last = items[items.length - 1].day; items = items.filter(r => r.day !== last).concat(rs.filter(r => r.day === last)); }
      return ok({ me: ME, items: items.map(r => out(r)), next: more ? items[items.length - 1].day : '', total: all.length, people: OPS.people });
    }
    if (act === 'weekly') {
      const week = DAY.test(q('week')) ? mondayOf(q('week')) : addDays(mondayOf(todayStr()), -7);
      const w = weeklyMail(week);
      return ok({ week, subject: w.subject, html: w.html });
    }
    return bad(404, 'not-found');
  }

  function apiPost(path, body) {
    const act = (path.match(/^\/admin\/opscal\/(save|delete|status|move|people|carry|endrepeat)$/) || [])[1];
    body = body || {};
    const t = Date.now();
    if (act === 'save') {
      const kind = KINDS.indexOf(body.kind) >= 0 ? body.kind : 'event';
      let day = s(body.day, 10);
      const title = s(body.title, 200).trim(), memo = s(body.memo, 3000).trim(), owner = s(body.owner, 40).trim();
      const start = kind === 'event' ? s(body.start, 5) : '', end = kind === 'event' ? s(body.end, 5) : '';
      const status = kind === 'task' ? (STATUS.indexOf(body.status) >= 0 ? body.status : 'todo') : '';
      const repeat = kind === 'event' && ['weekly', 'monthly'].indexOf(body.repeat) >= 0 ? body.repeat : '';
      const until = repeat ? s(body.until, 10) : '';
      if (!DAY.test(day)) return bad(400, 'day', '날짜를 골라 주세요.');
      if (kind === 'wmemo') day = mondayOf(day);
      if (until && (!DAY.test(until) || until < day)) return bad(400, 'until', '반복 끝 날짜가 시작보다 빨라요.');
      if ((start && !HM.test(start)) || (end && !HM.test(end))) return bad(400, 'time', '시간을 다시 골라 주세요.');
      if (end && !start) return bad(400, 'time', '시작 시간을 먼저 적어 주세요.');
      if (start && end && end < start) return bad(400, 'time', '끝나는 시간이 시작보다 빨라요.');
      const isMemo = kind === 'memo' || kind === 'wmemo';
      if (!isMemo && !title) return bad(400, 'title', '제목을 적어 주세요.');
      if (isMemo && !title && !memo) return bad(400, 'title', '메모를 적어 주세요.');
      let id = s(body.id, 40), r;
      if (id) {
        r = findRow(id);
        if (!r) return bad(404, 'gone', '이미 지워진 항목이에요.');
        // 반복 일정의 한 날을 열어 고쳐도 시작 날짜는 그대로(화면이 baseDay 를 보낸다). 반복 방식이 바뀌면 빼 둔 날(skips)은 지운다.
        const doneAt = status === 'done' ? (r.status === 'done' && r.doneAt ? r.doneAt : t) : 0;
        const skips = repeat && repeat === r.repeat ? r.skips : [];
        Object.assign(r, { kind, day, start, end, title, memo, owner, status, doneAt, repeat, until, skips, updated: t, updatedBy: ME.by });
      } else {
        id = 'oi_' + t.toString(36) + Math.random().toString(36).slice(2, 8);
        r = fixItem({ id, kind, day, start, end, title, memo, owner, status, doneAt: status === 'done' ? t : 0, repeat, until, created: t, createdBy: ME.by, updated: t, updatedBy: ME.by });
        OPS.items.push(r);
      }
      save();
      return ok({ item: out(r) });
    }
    if (act === 'delete') {
      const id = s(body.id, 40), day = s(body.day, 10);
      if (!id) return bad(400, 'missing');
      if (body.only && DAY.test(day)) {
        const r = findRow(id);
        if (r) { if (r.skips.indexOf(day) < 0) r.skips.push(day); r.skips = r.skips.slice(-300); r.updated = t; r.updatedBy = ME.by; save(); }
        return ok({});
      }
      OPS.items = OPS.items.filter(r => r.id !== id); save();
      return ok({});
    }
    if (act === 'endrepeat') {
      // 반복 끝내기 — from 부터 앞으로는 없애고 그 전 것은 남긴다. 시작 날부터 끝내면 통째로 지운다.
      const id = s(body.id, 40), from = s(body.from, 10), r = findRow(id);
      if (!r || !r.repeat) return bad(404, 'gone', '이미 지워진 반복 일정이에요.');
      if (!DAY.test(from)) return bad(400, 'missing');
      if (from <= r.day) { OPS.items = OPS.items.filter(x => x.id !== id); save(); return ok({ removed: 1 }); }
      const u = addDays(from, -1);
      if (!r.until || r.until > u) r.until = u;
      r.updated = t; r.updatedBy = ME.by; save();
      return ok({ removed: 0, item: out(r) });
    }
    if (act === 'status') {
      const id = s(body.id, 40), st = String(body.status || ''), r = findRow(id);
      if (!id || STATUS.indexOf(st) < 0) return bad(400, 'missing');
      if (!r || r.kind !== 'task') return bad(404, 'gone', '이미 지워진 할 일이에요.');
      r.status = st; r.doneAt = st === 'done' ? t : 0; r.updated = t; r.updatedBy = ME.by; save();
      return ok({ item: out(r) });
    }
    if (act === 'move') {
      const id = s(body.id, 40), day = s(body.day, 10), r = findRow(id);
      if (!id || !DAY.test(day)) return bad(400, 'missing');
      if (!r) return bad(404, 'gone', '이미 지워진 항목이에요.');
      if (r.repeat) return bad(400, 'series', '반복 일정은 열어서 날짜를 고쳐 주세요.');
      r.day = r.kind === 'wmemo' ? mondayOf(day) : day; r.updated = t; r.updatedBy = ME.by; save();
      return ok({ item: out(r) });
    }
    if (act === 'people') {
      const list = Array.isArray(body.people) ? body.people.slice(0, 30) : null;
      if (!list) return bad(400, 'missing');
      const seen = {}, clean = [];
      list.forEach(p => {
        const name = s(p && p.name, 20).trim().replace(/[|{}@]/g, ''), color = String((p && p.color) || '');
        if (!name || seen[name] || !COLOR.test(color)) return;
        seen[name] = 1; clean.push({ name, color: color.toLowerCase() });
      });
      OPS.people = clean; save();
      return ok({ people: OPS.people });
    }
    if (act === 'carry') {
      const n = carryOver(mondayOf(todayStr()), ME.by);
      if (n) save();
      return ok({ moved: n });
    }
    return bad(404, 'not-found');
  }

  /* ---------- 주간 마감 보고 (opscal.js weeklyMail 을 옮긴 것 — 메일로 보내지는 않고 미리보기만) ---------- */
  function hlMail(text, colors) {
    return esc(text).replace(/\{@([^|{}]{1,20})\|([^{}]{1,500})\}/g, (m0, who, tx) =>
      `<span style="background:${colors[who] || '#fff176'};padding:0 2px;border-radius:2px;">${tx}</span>`).replace(/\n/g, '<br>');
  }
  function weeklyMail(mon) {
    const sun = addDays(mon, 6), nMon = addDays(mon, 7), horizon = addDays(mon, 20);
    const people = OPS.people;
    const colors = {}; people.forEach(p => { colors[p.name] = p.color; });
    const byDC = (a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : a.created - b.created;
    const wk = OPS.items.filter(r => (r.kind === 'task' || r.kind === 'memo') && r.day >= mon && r.day <= sun).sort(byDC);
    const tasks = wk.filter(r => r.kind === 'task');
    const done = tasks.filter(r => r.status === 'done'), doing = tasks.filter(r => r.status === 'doing'), todo = tasks.filter(r => r.status !== 'done' && r.status !== 'doing');
    const dayMemos = wk.filter(r => r.kind === 'memo');
    const wmemo = OPS.items.filter(r => r.kind === 'wmemo' && r.day === mon).sort(byDC);
    const upcoming = expand(OPS.items, nMon, horizon).filter(r => r.kind === 'event' || (r.kind === 'task' && r.status !== 'done'));
    const upEv = upcoming.filter(r => r.kind === 'event'), upTask = upcoming.filter(r => r.kind === 'task');
    const total = OPS.items.filter(r => r.kind === 'task' && r.status === 'done').length;
    const tm = toD(mon), ts = toD(sun);
    const range = `${tm.getUTCFullYear()}. ${tm.getUTCMonth() + 1}. ${tm.getUTCDate()} (월) – ${ts.getUTCMonth() + 1}. ${ts.getUTCDate()} (일)`;
    const subject = `[MY HOME] 주간 마감 ${tm.getUTCMonth() + 1}/${tm.getUTCDate()}~${ts.getUTCMonth() + 1}/${ts.getUTCDate()} — 완료 ${done.length} · 진행 ${doing.length} · 못 한 일 ${todo.length}`;
    const SITE = location.origin + location.pathname;

    const SERIF = "Georgia,'Times New Roman','Nanum Myeongjo',serif";
    const SANS = "-apple-system,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
    const pill = o => o ? `<span style="display:inline-block;font-size:11px;line-height:1;padding:4px 7px;border-radius:999px;background:${colors[o] || '#eeeeee'};color:#2b2b2b;font-weight:700;white-space:nowrap;">${esc(o)}</span>` : '';
    const mark = { done: '&#10003;', doing: '&#9680;', todo: '&#9675;' };
    const line = (r, sym, extra) => `<tr>
      <td style="width:22px;padding:9px 0;vertical-align:top;font-size:14px;color:#1a1a1a;">${sym}</td>
      <td style="width:64px;padding:9px 6px 9px 0;vertical-align:top;font-size:12px;color:#8a8278;white-space:nowrap;">${dayLabel(r.day)}</td>
      <td style="padding:9px 8px 9px 0;vertical-align:top;font-size:14px;line-height:1.55;color:#1a1a1a;">${hlMail(r.title, colors)}${extra || ''}${r.memo ? `<div style="font-size:12px;color:#7a7268;margin-top:2px;">${hlMail(r.memo, colors)}</div>` : ''}</td>
      <td style="padding:9px 0;vertical-align:top;text-align:right;white-space:nowrap;">${pill(r.owner)}</td></tr>`;
    const table = (rows, empty) => rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #1a1a1a;">${rows}</table>`
      : `<p style="margin:0;padding:12px 0;border-top:1px solid #1a1a1a;font-size:13px;color:#9a9288;">${empty}</p>`;
    const sep = '<tr><td colspan="4" style="border-bottom:1px dashed #cfc8bd;font-size:0;line-height:0;">&nbsp;</td></tr>';
    const rowsOf = (list, fn) => list.map(fn).join(sep);
    const section = (no, title, sub, content) => `
    <tr><td style="padding:30px 0 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${SERIF};font-size:20px;color:#1a1a1a;letter-spacing:.01em;"><span style="font-style:italic;color:#9a9288;font-size:15px;margin-right:6px;">${no}</span>${title}</td>
        <td style="text-align:right;font-size:11px;color:#9a9288;letter-spacing:.06em;">${sub}</td></tr></table></td></tr>
    <tr><td>${content}</td></tr>`;
    const tile = (n, label, color) => `<td width="33%" style="padding:0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a1a1a;"><tr><td style="padding:14px 6px 12px;text-align:center;">
      <div style="font-family:${SERIF};font-size:34px;line-height:1;color:${color};">${n}</div>
      <div style="font-size:11px;letter-spacing:.12em;color:#5a544c;margin-top:6px;">${label}</div></td></tr></table></td>`;
    const carriedNote = r => r.carried ? ` <span style="font-size:11px;color:#b5651d;">↪ ${esc(dayLabel(r.origDay || r.day))}부터 ${r.carried}주째</span>` : '';
    const timeOf = r => r.start ? r.start + (r.end ? '–' + r.end : '') : '하루 종일';
    const evRows = rowsOf(upEv, r => `<tr>
      <td colspan="2" style="width:86px;padding:9px 6px 9px 0;vertical-align:top;font-size:12px;color:#8a8278;white-space:nowrap;">${dayLabel(r.day)}<br><span style="color:#1a1a1a;font-weight:700;">${esc(timeOf(r))}</span></td>
      <td style="padding:9px 8px 9px 0;vertical-align:top;font-size:14px;line-height:1.55;color:#1a1a1a;">${hlMail(r.title, colors)}${r.repeat ? ` <span style="font-size:11px;color:#9a9288;">${r.repeat === 'weekly' ? '매주' : '매월'}</span>` : ''}</td>
      <td style="padding:9px 0;vertical-align:top;text-align:right;white-space:nowrap;">${pill(r.owner)}</td></tr>`);
    const memos = wmemo.concat(dayMemos);
    const btn = (href, label, dark) => `<a href="${href}" target="_blank" style="display:inline-block;padding:13px 22px;margin:4px;border:1px solid #1a1a1a;background:${dark ? '#1a1a1a' : '#ffffff'};color:${dark ? '#ffffff' : '#1a1a1a'};font-size:13px;font-weight:700;letter-spacing:.04em;text-decoration:none;">${label}</a>`;
    const legend = people.length ? `<p style="margin:18px 0 0;font-size:11px;color:#8a8278;">담당 색 &nbsp;${people.map(p => `<span style="display:inline-block;margin:2px 6px 2px 0;"><span style="display:inline-block;width:10px;height:10px;background:${p.color};border:1px solid #d6cfc4;vertical-align:-1px;"></span> ${esc(p.name)}</span>`).join('')}</p>` : '';

    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#efebe4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efebe4;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fcfbf8;border:1px solid #d6cfc4;font-family:${SANS};color:#1a1a1a;">
  <tr><td style="padding:34px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:11px;letter-spacing:.22em;color:#5a544c;">MY HOME</td>
      <td style="text-align:right;font-size:11px;letter-spacing:.12em;color:#5a544c;">WEEK ${weekNo(mon)} · ${tm.getUTCFullYear()}</td></tr></table>
    <div style="font-family:${SERIF};font-size:40px;line-height:1.1;letter-spacing:.02em;margin:14px 0 6px;color:#1a1a1a;">THE WEEKLY <span style="font-style:italic;">Times</span></div>
    <div style="border-top:3px double #1a1a1a;border-bottom:1px solid #1a1a1a;padding:7px 0;font-size:12px;letter-spacing:.06em;color:#3a352f;">${range} &nbsp;·&nbsp; 이번 주 마감 보고</div>
  </td></tr>
  <tr><td style="padding:22px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${tile(done.length, '완료', '#1a1a1a')}${tile(doing.length, '진행 중', '#b5651d')}${tile(todo.length, '못 한 일', '#b3261e')}
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 36px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${section('i.', '이번 주에 한 일', 'DONE', table(rowsOf(done, r => line(r, mark.done)), '이번 주에 완료한 일이 없어요.'))}
    ${section('ii.', '진행 중인 일', 'IN PROGRESS', table(rowsOf(doing, r => line(r, mark.doing, carriedNote(r))), '진행 중인 일이 없어요.'))}
    ${section('iii.', '완료하지 못한 일', 'CARRY OVER', (todo.length ? '<p style="margin:0 0 8px;font-size:12px;color:#7a7268;">다음 주 월요일 칸으로 넘어가요.</p>' : '') + table(rowsOf(todo, r => line(r, mark.todo, carriedNote(r))), '못 한 일이 없어요. 잘했어요!'))}
    ${section('iv.', '앞으로 일정', 'NEXT 2 WEEKS', table(evRows, '다음 두 주에 잡힌 일정이 없어요.'))}
    ${section('v.', '앞으로 할 일', 'TO DO', table(rowsOf(upTask, r => line(r, r.status === 'doing' ? mark.doing : mark.todo, carriedNote(r))), '다음 두 주에 정해 둔 할 일이 없어요.'))}
    ${memos.length ? section('vi.', '메모', 'NOTES', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8d6;border-left:3px solid #e8c547;"><tr><td style="padding:12px 14px;font-size:13px;line-height:1.7;color:#3a352f;">${memos.map(r => `<div style="margin:0 0 6px;">${r.kind === 'memo' ? `<b style="color:#8a8278;font-weight:400;">${dayLabel(r.day)}</b> &nbsp;` : ''}${r.title ? `<b>${hlMail(r.title, colors)}</b> ` : ''}${hlMail(r.memo, colors)}</div>`).join('')}</td></tr></table>`) : ''}
  </table></td></tr>
  <tr><td style="padding:26px 32px 8px;text-align:center;">
    ${btn(SITE + '?view=done', '지금까지 한 일 자세히 보기 (' + total + ')', true)}${btn(SITE, '이번 주 플래너 열기', false)}
  </td></tr>
  <tr><td style="padding:6px 36px 30px;">
    ${legend}
    <p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #d6cfc4;font-size:11px;line-height:1.7;color:#9a9288;">MY HOME 주간 플래너가 만든 주간 마감 보고예요. 매주 월요일 아침에 못 한 일은 이번 주 월요일 칸으로 넘어가요.</p>
  </td></tr>
</table></td></tr></table></body></html>`;
    return { subject, html };
  }

  /* ---------- 플래너가 쓰는 창구 (마인드 인사이드의 window.MI 자리) ---------- */
  const $ = id => document.getElementById(id);
  let toastT = null;
  const MI = window.MI = {
    API: '',
    esc,
    session: () => '',
    setAuth: () => {},
    toast(msg) {
      const t = $('toast'); if (!t) return;
      t.textContent = msg; t.classList.add('on');
      clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
    },
    get(p) { try { return Promise.resolve(apiGet(p)); } catch (e) { return Promise.reject(e); } },
    post(p, b) { try { return Promise.resolve(apiPost(p, b)); } catch (e) { return Promise.reject(e); } },
    openSync() { openSyncDlg(); },
    getState: () => state,          // js/crm.js 가 처음 읽을 때
    saveAll: () => save(),          // js/crm.js 가 고친 뒤 — 이 기기 저장 + 1.5초 뒤 시트
    redraw: null   // planner.js 가 채운다
  };
  const redraw = () => { if (MI.redraw) MI.redraw(); };

  /* ---------- 동기화 (예전 대시보드와 같은 서버·같은 PIN) ---------- */
  const OLD_MSG = '서버가 아직 옛 버전이에요. Apps Script에서 [배포] → [배포 관리] → ✏️ → 버전 "새 버전" → [배포]까지 해야 반영됩니다.';
  let syncing = false, lastPull = 0;

  function setSync(msg, kind) {
    kind = kind || 'none';
    const el = $('syncState'), badge = $('syncBadge');
    if (el) { el.textContent = msg; el.className = 'sync-state ' + kind; }
    if (badge) {
      badge.textContent = { ok: '☁️ 저장됨', wait: '☁️ 저장 중…', err: '⚠️ 동기화 오류', none: '🔒 동기화 잠김' }[kind];
      badge.className = 'tl sync-badge ' + kind;
      badge.title = msg;
    }
    if ($('pinForget')) $('pinForget').hidden = !pin;
    if ($('pinInput')) { $('pinInput').value = ''; $('pinInput').placeholder = pin ? '잠금 해제됨' : 'PIN'; }
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

  /** 서버 내용을 받아들인다. 서버에 없는 항목은 이 기기 것을 그대로 둔다. */
  function adoptRemote(remote) {
    if (!remote || !((remote.todos && remote.todos.length) || remote.savedAt)) return false;
    state = Object.assign({}, state, remote);
    OPS = unpack(state);
    saveLocal();
    if (MI.onCrmState) MI.onCrmState(state);
    return true;
  }

  async function pullFromCloud(silent) {
    if (!pin) return;
    if (dirty || syncing) { await pushToCloud(); return; }   // 아직 안 올린 고침이 있으면 먼저 올린다(덮어쓰지 않게)
    if (!silent) setSync('불러오는 중…', 'wait');
    try {
      const data = await callApi('load', {});
      lastPull = Date.now();
      if (dirty) return;                                     // 불러오는 사이에 고쳤으면 이번 것은 버린다
      adoptRemote(data.state || {});
      redraw();
      setSync(`불러옴 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
    } catch (err) {
      if (err.oldVersion) forgetPin(OLD_MSG);
      else if (err.badPin) forgetPin(err.message);
      else setSync('불러오기 실패: ' + err.message + ' (이 기기 저장본을 보는 중)', 'err');
    }
  }

  let dirtyWhileSyncing = false;
  async function pushToCloud() {
    if (!pin) return;
    if (syncing) { dirtyWhileSyncing = true; return; }       // 저장 중에 또 바뀌면, 끝난 뒤 한 번 더 보낸다
    clearTimeout(pendingSave);
    syncing = true; dirty = false;
    setSync('저장 중…', 'wait');
    try {
      pack();
      await callApi('save', { state });
      setSync(`저장됨 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
    } catch (err) {
      dirty = true;
      if (err.oldVersion) forgetPin(OLD_MSG);
      else if (err.badPin) forgetPin(err.message);
      else setSync('저장 실패: ' + err.message + ' (이 기기에는 저장돼 있어요)', 'err');
    } finally {
      syncing = false;
      if (dirtyWhileSyncing) { dirtyWhileSyncing = false; pushToCloud(); }
    }
  }

  function forgetPin(msg) {
    pin = ''; dirty = false;
    try { localStorage.removeItem(PIN_KEY); } catch (e) {}
    setSync(msg || '잠겼습니다. PIN을 넣어주세요.', 'none');
    if (!$('dlg-sync').hidden) showSyncErr(msg || 'PIN이 맞지 않아요.');
  }

  /* ---------- 동기화 창 ---------- */
  function openSyncDlg() {
    $('syncVer').textContent = '버전 ' + APP_VER + (apiUrl === DEFAULT_API ? '' : ' · 사용자 지정 주소');
    $('apiUrl').value = apiUrl === DEFAULT_API ? '' : apiUrl;
    $('syncErr').hidden = true;
    $('dlg-sync').hidden = false;
    if (!pin) setTimeout(() => $('pinInput').focus(), 50);
  }
  function showSyncErr(msg) { const e = $('syncErr'); e.textContent = msg; e.hidden = !msg; }

  async function unlock() {
    const v = $('pinInput').value.trim();
    if (!v) { showSyncErr('PIN을 넣어주세요.'); $('pinInput').focus(); return; }
    showSyncErr('');
    const b = $('pinSave'); b.disabled = true; b.textContent = '확인 중…';
    pin = v;
    try { localStorage.setItem(PIN_KEY, v); } catch (e) {}
    try {
      const data = await callApi('load', {});
      lastPull = Date.now();
      adoptRemote(data.state || {});
      setSync(`불러옴 · ${new Date().toLocaleTimeString('ko-KR')}`, 'ok');
      autoCarry(); redraw();
      $('dlg-sync').hidden = true;
      MI.toast('잠금을 풀었어요');
    } catch (err) {
      pin = '';
      try { localStorage.removeItem(PIN_KEY); } catch (e) {}
      const why = err.oldVersion ? OLD_MSG
        : err.badPin ? err.message
        : /fetch|network|load failed/i.test(err.message) ? '서버에 연결하지 못했어요. 인터넷이나 광고 차단 설정을 확인해 주세요. (' + err.message + ')'
        : '오류: ' + err.message;
      showSyncErr(why); setSync(why, 'err');
    } finally {
      b.disabled = false; b.textContent = '잠금 풀기';
    }
  }

  function wireSync() {
    $('pinSave').addEventListener('click', unlock);
    $('pinInput').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); unlock(); }
    });
    $('pinForget').addEventListener('click', () => {
      if (dirty) pushToCloud();
      forgetPin('이 기기에서 잠갔어요. 다시 열려면 PIN을 넣으세요.');
    });
    $('apiSync').addEventListener('click', async () => {
      if (!pin) { showSyncErr('먼저 PIN을 넣어주세요.'); $('pinInput').focus(); return; }
      await pushToCloud(); await pullFromCloud(true);
      if (!dirty) MI.toast('동기화했어요');
    });
    $('apiSave').addEventListener('click', () => {
      const v = $('apiUrl').value.trim();
      if (v && (v.indexOf('https://script.google.com/macros/s/') !== 0 || v.slice(-5) !== '/exec')) {
        showSyncErr('주소 형식이 달라요. https://script.google.com/macros/s/…/exec 형태여야 합니다.');
        return;
      }
      apiUrl = v || DEFAULT_API;
      try { v ? localStorage.setItem(API_KEY, v) : localStorage.removeItem(API_KEY); } catch (e) {}
      setSync('주소를 바꿨어요.', 'none');
      if (pin) pullFromCloud(); else showSyncErr('주소를 바꿨어요. PIN을 넣어주세요.');
    });
    $('syncReset').addEventListener('click', () => {
      if (!confirm('이 기기의 저장값을 지우고 최신 파일로 다시 엽니다. 시트(서버)에 저장된 내용은 그대로예요.')) return;
      try { localStorage.clear(); } catch (e) {}
      location.replace(location.pathname + '?r=' + Date.now());
    });
    $('exportBtn').addEventListener('click', () => {
      pack();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `myhome-${todayStr()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('importFile').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('형식 오류');
          const n = unpack(data).items.length;
          if (!confirm(`플래너 항목 ${n}개가 든 파일로 지금 내용을 통째로 바꿀까요?`)) return;
          state = data; OPS = unpack(state); if (MI.onCrmState) MI.onCrmState(state); save(); redraw(); MI.toast('불러왔어요');
        } catch (err) { alert('불러오기 실패: ' + err.message); }
        e.target.value = '';
      };
      r.readAsText(f);
    });
  }

  /* ---------- 월요일 자동 이월 (서버 opsWeeklyTick 자리) — 월요일 아침 8시가 지나 처음 열 때 한 번 ---------- */
  function autoCarry() {
    const t = todayStr(), mon = mondayOf(t);
    if (t === mon && new Date().getHours() < 8) return;
    if (OPS.lastCarry >= mon) return;
    const n = carryOver(mon, '월요일 자동 이월');
    OPS.lastCarry = mon; save();
    if (n) { redraw(); MI.toast('지난주 못 한 일 ' + n + '개를 이번 주 월요일로 옮겼어요'); }
  }

  /* ---------- 시작 (planner.js 까지 읽힌 뒤) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    wireSync();
    if (pin && apiUrl) {
      setSync('불러오는 중…', 'wait');
      pullFromCloud().then(autoCarry);
    } else {
      setSync('PIN을 넣으면 폰·컴퓨터와 같이 보여요. 지금은 이 브라우저에만 저장돼요.', 'none');
      autoCarry();
      openSyncDlg();
    }
    setInterval(() => { if (pin && !document.hidden) pullFromCloud(true); }, 30 * 60 * 1000);
    // 다른 기기에서 고친 것을 보려고 — 탭으로 돌아오면(1분 넘게 지났을 때) 다시 불러온다
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && pin && Date.now() - lastPull > 60 * 1000) pullFromCloud(true);
    });
    // 날짜가 바뀌면(자정을 넘겨 켜 둔 탭) 오늘 칸·이월을 다시
    let day0 = todayStr();
    setInterval(() => { const d = todayStr(); if (d !== day0) { day0 = d; autoCarry(); redraw(); } }, 60 * 1000);
    window.addEventListener('beforeunload', () => { if (dirty && pin) pushToCloud(); });
  });
})();
