// ===== 개인 보드 "관제탑": 시트(프로젝트·할일·업무일지·결정·아이디어·콘텐츠·루틴) 통합 =====
(function () {
  const { loadTab, loadProjects, parseTasks, matcher, parseDate, fmtDate, esc, cell, STAGE_NAMES } = SHEET;
  const $ = id => document.getElementById(id);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const daysDiff = d => Math.round((d - today) / 86400000);          // 미래 +, 과거 -
  const ago = d => -daysDiff(d);
  const sortPri = { "높음": 0, "중간": 1, "낮음": 2 };
  const isMe = who => !who || /^(나|본인|me|사장|내가)$/i.test(who);
  const dueTxt = d => !d ? "" : (daysDiff(d) < 0 ? `${-daysDiff(d)}일 지남` : daysDiff(d) === 0 ? "오늘 마감" : `D-${daysDiff(d)}`);
  const priCls = p => p === "높음" ? "pri-high" : p === "중간" ? "pri-mid" : "pri-low";
  const SL = (typeof STATUS_LABEL !== "undefined") ? STATUS_LABEL : {};

  $("boardDate").textContent = `${fmtDate(today)} · ${DOW[today.getDay()]}요일`;

  // ===== 쓰기 API (Apps Script 웹앱) — URL은 이 기기 localStorage에 저장 =====
  const WRITE_KEY = "zj_write_url";
  // 기본 쓰기 API 주소 (Apps Script 웹앱). 기기별로 다른 주소를 쓰려면 보드 ⚙️ 설정에 저장 → 그게 우선.
  const DEFAULT_WRITE_URL = "https://script.google.com/macros/s/AKfycbwkAHwgvwg4n81ZlpDdSXM-m2DgEbC86-PYbwPw9Yjf2oZHl8mkZuFEdnnZJRXcFb0y3w/exec";
  const writeUrl = () => (localStorage.getItem(WRITE_KEY) || DEFAULT_WRITE_URL).trim();
  const canWrite = () => /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(writeUrl());
  let PRJ_LABELS = [];
  function msg(text, err) { const m = $("qMsg"); m.hidden = false; m.textContent = text; m.classList.toggle("err", !!err); clearTimeout(msg._t); msg._t = setTimeout(() => { m.hidden = true; }, 4000); }
  async function api(action, payload) {
    if (!canWrite()) { msg("빠른 입력이 아직 설정되지 않았어요 — 아래 ⚙️ 설정을 먼저 해주세요.", true); return null; }
    const body = JSON.stringify({ action, ...payload });
    try {
      const res = await fetch(writeUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow" });
      const data = await res.json().catch(() => ({ ok: res.ok }));
      if (!data.ok) throw new Error(data.error || "실패");
      return data;
    } catch (e) {
      // CORS/리다이렉트 문제(예: 구글 계정 여러 개 로그인)면 응답을 못 읽을 뿐 요청은 전달됨 → no-cors로 한 번 더 보내고 성공으로 간주
      if (e instanceof TypeError) {
        try { await fetch(writeUrl(), { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }); return { ok: true, blind: true }; }
        catch (e2) { msg("저장 실패(네트워크): " + e2.message, true); return null; }
      }
      msg("저장 실패: " + e.message, true); return null;
    }
  }
  // 시트 → 공개 CSV 반영이 몇 초~1분 걸리므로: 화면은 즉시 바꾸고, 뒤에서 두 번 다시 읽음
  const reloadSoon = () => { setTimeout(load, 4000); setTimeout(load, 20000); };
  async function act(action, payload, okText, el) {
    if (el) el.classList.add("busy");
    const r = await api(action, payload);
    if (!r) { if (el) el.classList.remove("busy"); return; }
    msg((okText || "저장됨 ✓") + (r.blind ? " (시트 반영 확인 중…)" : ""));
    if (el) {
      el.classList.remove("busy");
      if (action === "doneTask" || action === "checkRoutine") { el.classList.add("done"); el.style.transition = "opacity .5s"; setTimeout(() => { el.style.opacity = "0.35"; }, 50); }
      if (action === "toggleStar") { const b = el.querySelector('[data-act="star"]'); if (b) b.classList.toggle("on"); }
    }
    reloadSoon();
  }
  // 데이터 속성으로 이벤트 위임
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const task = b.closest(".task");
    const a = b.dataset.act, text = b.dataset.text, prj = b.dataset.prj;
    if (a === "done") act("doneTask", { text, prj }, "완료 ✓ 수고했어요", task);
    else if (a === "star") act("toggleStar", { text, prj }, "⭐ 변경됨", task);
    else if (a === "doing") act("setStatus", { text, prj, status: "진행중" }, "진행중으로 표시", task);
    else if (a === "routine") act("checkRoutine", { item: text }, "루틴 확인 ✓", task);
  });
  // 왼쪽 동그라미 = 완료 체크, 오른쪽 ⭐ = 이번 주 토글
  const chkBtn = t => !canWrite() ? "" : `<button class="chk" data-act="done" data-text="${esc(t.text)}" data-prj="${esc(t.prj)}" title="완료">✓</button>`;
  const starBtn = t => !canWrite() ? "" : `<button class="tbtn ${t.star ? "on" : ""}" data-act="star" data-text="${esc(t.text)}" data-prj="${esc(t.prj)}" title="이번 주 토글">⭐</button>`;

  function taskHtml(t, extra = "") {
    const over = t.due && daysDiff(t.due) < 0;
    return `<div class="task ${over ? "overdue" : ""} ${t.status === "진행중" ? "doing" : ""}">
      ${chkBtn(t)}${extra}
      <span class="task-text">${esc(t.text)}${t.status === "진행중" ? ' <em style="color:var(--accent);font-size:.75rem;">진행중</em>' : ""}${!isMe(t.who) ? ` <span class="task-who">👤 ${esc(t.who)}</span>` : ""}</span>
      ${t.pri === "높음" ? `<span class="task-pri pri-high">높음</span>` : ""}
      ${t.due ? `<span class="task-due ${over ? "over" : ""}">${dueTxt(t.due)}</span>` : ""}
      ${starBtn(t)}
      <span class="task-prj">${esc(t.prj)}</span>
    </div>`;
  }
  // 프로젝트 행 펼치기/접기
  document.addEventListener("click", e => {
    const h = e.target.closest(".prj-row-head"); if (!h || e.target.closest("a")) return;
    h.parentElement.classList.toggle("open");
  });

  // ===== 빠른 입력 파서 =====
  // 할 일: "재고 발주 !높음 ⭐ ~8/30 @현영"  / 일지: "한 일 // 배운 것" / 결정: "결정 // 이유 ~10/1"
  function parseQuick(type, raw) {
    let s = " " + raw.trim() + " ";
    const out = {};
    const m = s.match(/~\s?(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2})/);
    if (m) { let d = m[1]; if (/^\d{1,2}\/\d{1,2}$/.test(d)) { const [mm, dd] = d.split("/"); d = `${today.getFullYear()}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`; } out.due = d; s = s.replace(m[0], " "); }
    const w = s.match(/@(\S+)/); if (w) { out.who = w[1]; s = s.replace(w[0], " "); }
    const p = s.match(/!(높음|중간|낮음|상|중|하|high|mid|low)/i); if (p) { out.pri = /높|상|high/i.test(p[1]) ? "높음" : /낮|하|low/i.test(p[1]) ? "낮음" : "중간"; s = s.replace(p[0], " "); }
    if (/⭐|\*\*|\B#주\B/.test(s)) { out.star = true; s = s.replace(/⭐|\*\*/g, " "); }
    const parts = s.split("//").map(x => x.replace(/\s+/g, " ").trim());
    out.text = parts[0]; out.second = parts[1] || "";
    return out;
  }
  async function quickAdd() {
    const type = $("qType").value, prj = $("qPrj").value, raw = $("qText").value;
    if (!raw.trim()) return;
    const q = parseQuick(type, raw);
    let r;
    if (type === "task") r = await api("addTask", { prj, text: q.text, due: q.due || "", star: !!q.star, pri: q.pri || "중간", who: q.who || "" });
    else if (type === "log") r = await api("addLog", { prj, did: q.text, learned: q.second });
    else if (type === "idea") r = await api("addIdea", { text: q.text, desc: q.second, field: prj && !/개인/.test(prj) ? prj : "" });
    else if (type === "decision") r = await api("addDecision", { prj, text: q.text, why: q.second, review: q.due || "" });
    if (!r) return;
    $("qText").value = "";
    msg({ task: "할 일 추가됨 ✓", log: "일지 기록됨 ✓", idea: "아이디어 심었어요 🌱", decision: "결정 기록됨 📌" }[type] + (r.blind ? " (시트 반영 확인 중…)" : ""));
    // 즉시 화면 반영 (낙관적 표시)
    if (type === "task") {
      const t = { prj, text: q.text, due: q.due ? SHEET.parseDate(q.due) : null, star: !!q.star, status: "할일", pri: q.pri || "중간", who: q.who || "" };
      const html = taskHtml(t, `<span class="focus-why">방금 추가</span>`);
      (q.star ? $("weekList") : $("allTasksList")).insertAdjacentHTML("afterbegin", html);
      if (q.star) { const e = $("weekList").querySelector(".task-empty"); if (e) e.remove(); }
    } else if (type === "log") {
      $("logList").insertAdjacentHTML("afterbegin", `<div class="timeline-item"><div class="timeline-date">${fmtDate(today)}</div><div class="timeline-content"><h3 style="font-size:.95rem;">${esc(prj)}</h3><p>${esc(q.text)}${q.second ? `<br><em style="color:var(--accent);">💡 ${esc(q.second)}</em>` : ""}</p></div></div>`);
      $("logDetails").open = true;
    }
    reloadSoon();
  }
  $("qAdd").addEventListener("click", quickAdd);
  $("qText").addEventListener("keydown", e => { if (e.key === "Enter") quickAdd(); });
  $("qType").addEventListener("change", () => {
    const t = $("qType").value;
    $("qText").placeholder = { task: "한 줄로 적고 Enter — 예: 재고 발주 !높음 ⭐ ~8/30 @현영", log: "오늘 한 일 // 배운 것 (선택)", idea: "아이디어 // 한 줄 설명", decision: "결정 내용 // 이유 ~10/1(재검토일)" }[t];
    $("qPrj").style.display = t === "idea" ? "none" : "";
  });
  function refreshWriteUI() {
    const on = canWrite();
    $("quickBar").classList.toggle("disabled", !on);
    $("quickOff").hidden = on;
    $("setupHint").textContent = on ? "연결됨 ✓" : "미설정";
    $("writeUrl").value = writeUrl();
  }
  $("saveWriteUrl").addEventListener("click", () => { localStorage.setItem(WRITE_KEY, $("writeUrl").value.trim()); refreshWriteUI(); msg(canWrite() ? "저장됨 — 이제 보드에서 바로 입력할 수 있어요 ✓" : "URL 형식이 맞지 않아요 (…/exec 로 끝나야 함)", !canWrite()); load(); });
  $("testWriteUrl").addEventListener("click", async () => {
    try { const res = await fetch($("writeUrl").value.trim()); const d = await res.json(); msg(d.ok ? "연결 OK: " + d.msg : "응답 이상", !d.ok); }
    catch (e) { msg("연결 실패 — 배포 설정(액세스: 모든 사용자)을 확인하세요", true); }
  });
  refreshWriteUI();

  // ---- 루틴 주기 해석: 오늘 체크 대상인지 / 밀렸는지 ----
  function routineState(r) {
    const f = r.freq || ""; const last = r.last; const since = last ? ago(last) : 999;
    const dowSet = s => new Set((s.match(/[월화수목금토일]/g) || []).map(k => DOW.indexOf(k)));
    let due = false, over = false, label = f;
    if (/매일/.test(f)) { due = since >= 1; over = since >= 2; }
    else if (/격주/.test(f)) { const d = dowSet(f); const todayMatch = !d.size || d.has(today.getDay()); due = todayMatch && since >= 13; over = since >= 16; }
    else if (/매주/.test(f)) { const d = dowSet(f); const todayMatch = !d.size || d.has(today.getDay()); due = (todayMatch && since >= 1) || since >= 8; over = since >= 8; }
    else if (/매월/.test(f)) { const m = f.match(/(\d{1,2})/); const day = m ? +m[1] : 1; due = (today.getDate() === day && since >= 1) || since >= 32; over = since >= 32; }
    else { due = since >= 7; over = since >= 10; }
    return { due, over, since, label };
  }

  async function load() {
    $("boardLoading").hidden = false; $("boardError").hidden = true; $("boardContent").hidden = true;
    try {
      const [{ projects }, tRows, lRows, dRows, iRows, cRows, rRows] = await Promise.all([
        loadProjects(), loadTab("할일"), loadTab("업무일지"), loadTab("결정"), loadTab("아이디어"), loadTab("콘텐츠"), loadTab("루틴")
      ]);
      if (!tRows || !lRows) throw new Error("fetch");
      const idOf = matcher(projects);
      // 빠른 입력 프로젝트 선택지
      PRJ_LABELS = projects.map(p => p.label || (p.icon + " " + p.name));
      const sel = $("qPrj"); const prev = sel.value;
      sel.innerHTML = PRJ_LABELS.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
      if (prev && PRJ_LABELS.includes(prev)) sel.value = prev;

      const tasks = parseTasks(tRows, idOf);
      const logs = lRows
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), did: cell(r, 2), learned: cell(r, 3), pid: idOf(cell(r, 1)) }))
        .filter(l => l.date && l.did && !l.did.startsWith("(예시)")).sort((a, b) => b.date - a.date);
      const decisions = (dRows || [])
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), text: cell(r, 2), why: cell(r, 3), review: parseDate(r[4]), status: cell(r, 5) || "유효" }))
        .filter(d => d.date && d.text && !d.text.startsWith("(예시)") && d.status !== "폐기").sort((a, b) => b.date - a.date);
      const ideas = (iRows || [])
        .map(r => ({ date: parseDate(r[0]), text: cell(r, 1), desc: cell(r, 2), field: cell(r, 3), pull: +cell(r, 4) || 0, feas: +cell(r, 5) || 0, status: cell(r, 6) || "씨앗" }))
        .filter(i => i.text && !i.text.startsWith("(예시)") && i.text !== "아이디어");
      const CSTAGES = ["아이디어", "원고", "촬영", "편집", "업로드완료"];
      const contents = (cRows || [])
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), title: cell(r, 2), stage: cell(r, 3), script: cell(r, 4), due: parseDate(r[5]), video: cell(r, 6) }))
        .filter(c => c.title && !c.title.startsWith("(예시)") && c.title !== "제목/주제");
      const routines = (rRows || [])
        .map(r => ({ item: cell(r, 0), prj: cell(r, 1), who: cell(r, 2), freq: cell(r, 3), last: parseDate(r[4]), memo: cell(r, 5) }))
        .filter(r => r.item && r.item !== "항목" && !r.item.startsWith("(예시)"))
        .map(r => ({ ...r, ...routineState(r) }));

      const open = tasks.filter(t => t.status !== "완료" && t.status !== "보류");
      const mine = open.filter(t => isMe(t.who));
      const delegated = open.filter(t => !isMe(t.who));
      const overdue = open.filter(t => t.due && daysDiff(t.due) < 0);
      const soon = open.filter(t => t.due && daysDiff(t.due) >= 0 && daysDiff(t.due) <= 3);
      const week = open.filter(t => t.star);
      const done = tasks.filter(t => t.status === "완료");
      const doneThisWeek = done.filter(t => t.doneAt && ago(t.doneAt) <= 7);
      const logsThisWeek = logs.filter(l => ago(l.date) <= 7);
      const routinesDue = routines.filter(r => r.due);

      // ===== 1. 전체 현황 =====
      $("statRow").innerHTML = `
        <div class="stat-card"><strong>${mine.length}</strong><span>내 할 일</span></div>
        <div class="stat-card"><strong>${delegated.length}</strong><span>맡긴 일</span></div>
        <div class="stat-card ${overdue.length ? "warn" : "ok"}"><strong>${overdue.length}</strong><span>마감 지남</span></div>
        <div class="stat-card ok"><strong>${doneThisWeek.length}<span style="font-size:.8rem;color:var(--text-dim);font-weight:400;"> / ${done.length}</span></strong><span>이번 주 완료 / 누적</span></div>`;

      // ===== 2. 지금 이것부터 (내 할 일 중 상위 3) =====
      const scored = mine.map(t => {
        let s = 100, why = "";
        if (t.due && daysDiff(t.due) < 0) { s = 1000 - daysDiff(t.due); }
        else if (t.due && daysDiff(t.due) === 0) { s = 900; }
        else if (t.star && t.pri === "높음") { s = 800; why = "⭐ + 높음"; }
        else if (t.due && daysDiff(t.due) <= 3) { s = 700 - daysDiff(t.due); }
        else if (t.star) { s = 600; why = "⭐ 이번 주"; }
        else if (t.pri === "높음") { s = 500; why = "우선순위 높음"; }
        if (t.status === "진행중") { s += 50; }
        return { t, s, why };
      }).sort((a, b) => b.s - a.s).slice(0, 3);
      $("focusList").innerHTML = scored.length
        ? scored.map((x, i) => taskHtml(x.t, `<span class="focus-num">${i + 1}</span>`).replace(/<\/div>\s*$/, `${x.why ? `<span class="focus-why">${x.why}</span>` : ""}</div>`)).join("")
        : '<p class="task-empty">내 할 일이 비어 있어요. 시트 할일 탭에 하나만 적고 ⭐를 찍어보세요.</p>';

      // ===== 3. 재검토 결정 / 콘텐츠 마감은 '지금 이것부터' 아래 한 줄 메모로만 =====
      const notes = [];
      decisions.filter(d => d.review && daysDiff(d.review) <= 7).forEach(d => notes.push(`📌 결정 재검토 ${daysDiff(d.review) <= 0 ? "오늘" : "D-" + daysDiff(d.review)}: ${esc(d.text.slice(0, 30))}`));
      contents.filter(c => c.due && c.stage !== "업로드완료" && daysDiff(c.due) <= 3).forEach(c => notes.push(`🎬 ${esc(c.title)} 업로드 ${dueTxt(c.due)}`));
      if (notes.length) $("focusList").insertAdjacentHTML("beforeend", `<p class="task-empty" style="padding:6px 0 0;">${notes.join(" · ")}</p>`);

      // ===== 4. 루틴 =====
      $("routineSection").hidden = routines.length === 0;
      if (routines.length) {
        $("routineHint").textContent = `${routinesDue.length}개 확인 필요 · 나머지 ${routines.length - routinesDue.length}개 정상`;
        $("routineList").innerHTML = routinesDue.length ? routinesDue.map(r => `
          <div class="task ${r.over ? "routine-over" : ""}">
            <span class="task-prj">${esc(r.prj)}</span>
            <span class="task-text">${esc(r.item)} <span class="task-who">👤 ${esc(r.who || "-")}</span></span>
            <span class="task-stage">${esc(r.label)}</span>
            <span class="task-due ${r.over ? "over" : ""}">${r.since >= 999 ? "미확인" : r.since === 0 ? "오늘 확인" : r.since + "일 전 확인"}</span>
            ${canWrite() ? `<button class="tbtn" data-act="routine" data-text="${esc(r.item)}" title="오늘 확인함">✓ 확인</button>` : ""}
          </div>`).join("") : '<p class="task-empty">오늘 체크할 루틴이 없습니다. ✓</p>';
      }

      // ===== 5. 위임 현황 =====
      $("delegSection").hidden = delegated.length === 0;
      if (delegated.length) {
        $("delegHint").textContent = `${delegated.length}건`;
        const byWho = {};
        delegated.forEach(t => { (byWho[t.who] = byWho[t.who] || []).push(t); });
        // 루틴 담당도 합산 표시
        const routineByWho = {};
        routines.filter(r => !isMe(r.who)).forEach(r => { (routineByWho[r.who] = routineByWho[r.who] || []).push(r); });
        const people = [...new Set([...Object.keys(byWho), ...Object.keys(routineByWho)])];
        $("delegGrid").innerHTML = people.map(who => {
          const list = (byWho[who] || []).sort((a, b) => ((a.due || 9e15) - (b.due || 9e15)));
          const needs = list.filter(t => t.due && daysDiff(t.due) < 0).length + (routineByWho[who] || []).filter(r => r.over).length;
          const rts = routineByWho[who] || [];
          return `<div class="deleg-card ${needs ? "needs" : ""}">
            <div class="deleg-head"><div class="deleg-avatar">${esc(who.slice(0, 1))}</div><h3>${esc(who)}</h3><span>${list.length}건${rts.length ? ` · 루틴 ${rts.length}` : ""}${needs ? ` · <b style="color:#facc15">확인 ${needs}</b>` : ""}</span></div>
            <ul class="deleg-list">
              ${list.map(t => `<li><span class="d-prj">${esc(t.prj)}</span><span>${esc(t.text)}</span><span class="d-due ${t.due && daysDiff(t.due) < 0 ? "over" : ""}">${t.due ? dueTxt(t.due) : (t.status === "진행중" ? "진행중" : "기한 없음")}</span></li>`).join("")}
              ${rts.map(r => `<li><span class="d-prj">🔁</span><span>${esc(r.item)}</span><span class="d-due ${r.over ? "over" : ""}">${r.since >= 999 ? "미확인" : r.since + "일 전"}</span></li>`).join("")}
            </ul></div>`;
        }).join("");
      }

      // ===== 6. 이번 주 =====
      week.sort((a, b) => (sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1));
      $("weekHint").textContent = `${week.length}개`;
      const perPrj = {}; week.forEach(t => { perPrj[t.prj] = (perPrj[t.prj] || 0) + 1; });
      const overPrj = Object.entries(perPrj).filter(([, n]) => n > 3).map(([p]) => p);
      $("weekWarn").innerHTML = (week.length > 7 ? `<div class="week-warn">⭐가 ${week.length}개예요. 한 주에 7개 이하를 권장합니다 — 덜 중요한 건 ⭐를 지우세요.</div>` : "") +
        (overPrj.length ? `<div class="week-warn">프로젝트당 ⭐ 3개 초과: ${overPrj.map(esc).join(", ")}</div>` : "");
      $("weekList").innerHTML = week.length ? week.map(t => taskHtml(t)).join("")
        : '<p class="task-empty">⭐ 표시된 할 일이 없습니다. 시트 "이번주" 열에 ⭐를 찍어보세요.</p>';

      // ===== 7. 프로젝트 (한 줄 목록) — 빨강: 마감 지난 일 있음 / 노랑: 2주+ 기록 없음 또는 목표 없음 =====
      const health = projects.map(p => {
        const my = open.filter(t => t.pid === p.id);
        const over = my.filter(t => t.due && daysDiff(t.due) < 0).length;
        const last = logs.find(l => l.pid === p.id); const since = last ? ago(last.date) : null;
        const active = p.status === "live" || p.status === "plan";
        let h = "gray";
        if (active) h = over ? "red" : ((p.status === "live" && since !== null && since >= 14) || !p.goal || p.goal === "-") ? "yellow" : "green";
        return { p, my, over, since, last, h, active };
      });
      const order = { red: 0, yellow: 1, green: 2, gray: 3 };
      health.sort((a, b) => order[a.h] - order[b.h]);
      const cnt = k => health.filter(x => x.h === k).length;
      $("healthSummary").innerHTML = `${cnt("red") ? `<span class="health-dot h-red"></span>${cnt("red")} ` : ""}${cnt("yellow") ? `<span class="health-dot h-yellow"></span>${cnt("yellow")} ` : ""}<span class="health-dot h-green"></span>${cnt("green")} · ${projects.length}개`;
      $("prjGrid").innerHTML = health.map(({ p, my, over, since, last, h, active }) => {
        const nextItems = [...my].sort((a, b) => (b.star - a.star) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1))).slice(0, 4);
        const starN = my.filter(t => t.star).length;
        return `<div class="prj-row h-${h} ${active ? "" : "inactive"}">
          <div class="prj-row-head">
            <span class="icon">${p.icon}</span>
            <span class="name"><span class="health-dot h-${h}"></span>${esc(p.name)}</span>
            <span class="meta">${STAGE_NAMES[p.stage]} · 할 일 <b>${my.length}</b>${starN ? ` · ⭐<b>${starN}</b>` : ""}${over ? ` · <b style="color:#f87171">지남 ${over}</b>` : ""}${p.public === false ? " · 🔒" : ""}</span>
            <span class="chev">▶</span>
          </div>
          <div class="prj-row-body">
            ${p.goal && p.goal !== "-" ? `<div class="goal">🎯 ${esc(p.goal)}</div>` : `<div class="goal" style="color:var(--text-dim)">🎯 목표를 정하세요 (시트 프로젝트 탭)</div>`}
            <ul>${nextItems.map(t => `<li>${chkBtn(t)}<span>${t.star ? "⭐ " : ""}${esc(t.text)}</span>${!isMe(t.who) ? `<span class="task-who">👤${esc(t.who)}</span>` : ""}${t.due ? `<span class="task-due ${daysDiff(t.due) < 0 ? "over" : ""}">${dueTxt(t.due)}</span>` : ""}</li>`).join("") || "<li style='color:var(--text-dim)'>할 일 없음 — 위 입력 바에서 추가</li>"}</ul>
            <div class="foot"><span>${last ? `마지막 기록 ${fmtDate(last.date)}${since ? ` (${since}일 전)` : " (오늘)"}` : "아직 기록 없음"}</span><a href="project.html?id=${encodeURIComponent(p.id)}">공개 페이지 →</a></div>
          </div>
        </div>`;
      }).join("");

      // ===== 8. 이번 주 돌아보기 (일요일만 펼침) =====
      const isSun = today.getDay() === 0;
      $("reviewDetails").open = isSun;
      $("reviewHint").textContent = `완료 ${doneThisWeek.length} · 일지 ${logsThisWeek.length}일`;
      $("reviewBox").innerHTML = `
        <div class="review-stats">
          <span>이번 주 완료 <b>${doneThisWeek.length}</b></span>
          <span>업무일지 <b>${logsThisWeek.length}</b>일</span>
          <span>💡 배운 것 <b>${logsThisWeek.filter(l => l.learned).length}</b></span>
          <span>남은 ⭐ <b>${week.length}</b></span>
        </div>
        <ul class="review-q">
          <li>이번 주 가장 잘한 결정 하나는?</li>
          <li>나를 막은 것은 무엇이었나 — 사람, 돈, 시간, 체력?</li>
          <li>다음 주 딱 하나만 끝낸다면 무엇을?</li>
        </ul>
        <p class="review-cta">${isSun ? "오늘은 일요일 — " : ""}답이 떠오르면 클로드에게 "이번 주 정리해줘" 한마디면 블로그 회고 글이 됩니다.</p>`;

      // ===== 9. 접힌 섹션: 콘텐츠 =====
      $("contentDetails").hidden = contents.length === 0;
      if (contents.length) {
        const inProg = contents.filter(c => c.stage !== "업로드완료");
        $("contentHint").textContent = `진행 ${inProg.length} · 완료 ${contents.length - inProg.length}`;
        $("pipeRow").innerHTML = CSTAGES.map(s => `<div class="pipe-step ${s === "업로드완료" ? "done" : ""}"><strong>${contents.filter(c => c.stage === s).length}</strong><span>${s}</span></div>`).join("");
        $("contentList").innerHTML = inProg.sort((a, b) => (CSTAGES.indexOf(b.stage) - CSTAGES.indexOf(a.stage)) || ((a.due || 9e15) - (b.due || 9e15))).map(c => `
          <div class="task"><span class="task-prj">${esc(c.prj)}</span><span class="task-text">${esc(c.title)}</span><span class="task-stage">${esc(c.stage)}</span>
            ${c.script ? `<a class="task-link" href="${esc(c.script)}" target="_blank" rel="noopener">원고 ↗</a>` : ""}${c.due ? `<span class="task-due ${daysDiff(c.due) < 0 ? "over" : ""}">${dueTxt(c.due)}</span>` : ""}</div>`).join("") || '<p class="task-empty">진행 중인 콘텐츠가 없습니다.</p>';
      }
      // 아이디어
      $("ideaDetails").hidden = ideas.length === 0;
      if (ideas.length) {
        const alive = ideas.filter(i => i.status === "씨앗" || i.status === "검토중").sort((a, b) => (b.pull + b.feas) - (a.pull + a.feas));
        $("ideaCount").textContent = `씨앗 ${alive.length} · 승격 ${ideas.filter(i => i.status === "승격").length} · 전체 ${ideas.length}`;
        $("ideaList").innerHTML = alive.slice(0, 8).map(i => `
          <div class="task"><span class="task-text"><strong>${esc(i.text)}</strong>${i.desc ? ` <span style="color:var(--text-dim)">— ${esc(i.desc)}</span>` : ""}</span>
            ${i.field ? `<span class="idea-field">${esc(i.field)}</span>` : ""}<span class="idea-score" title="끌림+실현가능">${i.pull}+${i.feas}</span><span class="task-stage">${esc(i.status)}</span></div>`).join("") + (alive.length > 8 ? `<p class="task-empty">… 외 ${alive.length - 8}개</p>` : "");
      }
      // 결정
      $("decisionDetails").hidden = decisions.length === 0;
      if (decisions.length) {
        $("decisionHint").textContent = `${decisions.length}건`;
        const groups = {}; decisions.forEach(d => { (groups[d.prj || "기타"] = groups[d.prj || "기타"] || []).push(d); });
        $("decisionList").innerHTML = Object.entries(groups).map(([prj, list]) => `<div class="dec-group"><h3>${esc(prj)}</h3>` +
          list.map(d => `<div class="dec-item ${d.status === "변경" ? "changed" : ""}"><div class="dec-text">${esc(d.text)}</div>${d.why ? `<div class="dec-why">${esc(d.why)}</div>` : ""}
            <div class="dec-meta">${fmtDate(d.date)} 결정${d.review ? ` · 재검토 ${fmtDate(d.review)}` : ""}${d.status !== "유효" ? ` · ${esc(d.status)}` : ""}</div></div>`).join("") + `</div>`).join("");
      }
      // 업무일지
      $("logHint").textContent = `최근 ${Math.min(10, logs.length)}개`;
      $("logList").innerHTML = logs.slice(0, 10).map(l => `
        <div class="timeline-item"><div class="timeline-date">${fmtDate(l.date)}</div>
          <div class="timeline-content"><h3 style="font-size:.95rem;">${esc(l.prj) || "📋"}</h3>
          <p>${esc(l.did)}${l.learned ? `<br><em style="color:var(--accent);">💡 ${esc(l.learned)}</em>` : ""}</p></div></div>`).join("") || '<p class="task-empty">아직 업무일지가 없습니다.</p>';
      // 전체 할 일
      $("allTasksHint").textContent = `남은 ${open.length} · 완료 ${done.length}`;
      $("allTasksList").innerHTML = [...open].sort((a, b) => ((a.due || 9e15) - (b.due || 9e15)) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1))).map(t => taskHtml(t)).join("") || '<p class="task-empty">남은 할 일이 없습니다.</p>';

      $("boardLoading").hidden = true; $("boardContent").hidden = false;
    } catch (e) {
      console.error(e);
      $("boardLoading").hidden = true; $("boardError").hidden = false;
    }
  }

  $("refreshBtn").addEventListener("click", load);
  load();
})();
