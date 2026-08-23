// ===== 개인 보드 (경량판): 입력 바 → 지금 이것부터 → 맡긴 일 → 프로젝트 → 할 일 =====
(function () {
  const { loadTab, loadProjects, parseTasks, matcher, parseDate, fmtDate, esc, cell, STAGE_NAMES } = SHEET;
  const $ = id => document.getElementById(id);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const daysDiff = d => Math.round((d - today) / 86400000);
  const ago = d => -daysDiff(d);
  const sortPri = { "높음": 0, "중간": 1, "낮음": 2 };
  const isMe = who => !who || /^(나|본인|me|사장|내가)$/i.test(who);
  const dueTxt = d => !d ? "" : (daysDiff(d) < 0 ? `${-daysDiff(d)}일 지남` : daysDiff(d) === 0 ? "오늘" : `D-${daysDiff(d)}`);
  const SL = (typeof STATUS_LABEL !== "undefined") ? STATUS_LABEL : {};
  $("boardDateText").textContent = `${fmtDate(today)} · ${DOW[today.getDay()]}요일`;

  // ===== 쓰기 API =====
  const WRITE_KEY = "zj_write_url";
  const DEFAULT_WRITE_URL = "https://script.google.com/macros/s/AKfycbwkAHwgvwg4n81ZlpDdSXM-m2DgEbC86-PYbwPw9Yjf2oZHl8mkZuFEdnnZJRXcFb0y3w/exec";
  const writeUrl = () => (localStorage.getItem(WRITE_KEY) || DEFAULT_WRITE_URL).trim();
  const canWrite = () => /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(writeUrl());
  function msg(text, err) { const m = $("qMsg"); m.hidden = false; m.textContent = text; m.classList.toggle("err", !!err); clearTimeout(msg._t); msg._t = setTimeout(() => { m.hidden = true; }, 4000); }
  async function api(action, payload) {
    if (!canWrite()) { msg("빠른 입력 미설정 — 아래 ⚙️ 설정", true); return null; }
    const body = JSON.stringify({ action, ...payload });
    try {
      const res = await fetch(writeUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow" });
      const data = await res.json().catch(() => ({ ok: res.ok }));
      if (!data.ok) throw new Error(data.error || "실패");
      return data;
    } catch (e) {
      if (e instanceof TypeError) {
        try { await fetch(writeUrl(), { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }); return { ok: true, blind: true }; }
        catch (e2) { msg("저장 실패(네트워크): " + e2.message, true); return null; }
      }
      msg("저장 실패: " + e.message, true); return null;
    }
  }
  const reloadSoon = () => { setTimeout(() => load(false), 4000); setTimeout(() => load(false), 20000); };
  async function act(action, payload, okText, el) {
    if (el) el.classList.add("busy");
    const r = await api(action, payload);
    if (!r) { if (el) el.classList.remove("busy"); return; }
    msg((okText || "저장됨 ✓") + (r.blind ? " (반영 확인 중…)" : ""));
    if (el) {
      el.classList.remove("busy");
      if (action === "doneTask") { el.classList.add("done"); el.style.opacity = "0.35"; }
      if (action === "toggleStar") { const b = el.querySelector('[data-act="star"]'); if (b) b.classList.toggle("on"); }
    }
    reloadSoon();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (b) {
      const task = b.closest(".task, li");
      const a = b.dataset.act, text = b.dataset.text, prj = b.dataset.prj;
      if (a === "done") act("doneTask", { text, prj }, "완료 ✓", task);
      else if (a === "star") act("toggleStar", { text, prj }, "⭐ 변경", task);
      return;
    }
    const h = e.target.closest(".prj-row-head");
    if (h && !e.target.closest("a")) h.parentElement.classList.toggle("open");
  });
  const chkBtn = t => !canWrite() ? "" : `<button class="chk" data-act="done" data-text="${esc(t.text)}" data-prj="${esc(t.prj)}" title="완료">✓</button>`;
  const starBtn = t => !canWrite() ? "" : `<button class="tbtn ${t.star ? "on" : ""}" data-act="star" data-text="${esc(t.text)}" data-prj="${esc(t.prj)}" title="중요 표시">⭐</button>`;
  function taskHtml(t, extra = "") {
    const over = t.due && daysDiff(t.due) < 0;
    return `<div class="task ${over ? "overdue" : ""} ${t.status === "진행중" ? "doing" : ""}">
      ${chkBtn(t)}${extra}
      <span class="task-text">${t.star ? "⭐ " : ""}${esc(t.text)}${!isMe(t.who) ? ` <span class="task-who">👤 ${esc(t.who)}</span>` : ""}</span>
      ${t.pri === "높음" ? `<span class="task-pri pri-high">높음</span>` : ""}
      ${t.due ? `<span class="task-due ${over ? "over" : ""}">${dueTxt(t.due)}</span>` : ""}
      ${starBtn(t)}
      <span class="task-prj">${esc(t.prj)}</span>
    </div>`;
  }

  // ===== 빠른 입력 =====
  function parseQuick(raw) {
    let s = " " + raw.trim() + " "; const out = {};
    const m = s.match(/~\s?(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2})/);
    if (m) { let d = m[1]; if (/^\d{1,2}\/\d{1,2}$/.test(d)) { const [mm, dd] = d.split("/"); d = `${today.getFullYear()}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`; } out.due = d; s = s.replace(m[0], " "); }
    const w = s.match(/@(\S+)/); if (w) { out.who = w[1]; s = s.replace(w[0], " "); }
    const p = s.match(/!(높음|중간|낮음|상|중|하|high|mid|low)/i); if (p) { out.pri = /높|상|high/i.test(p[1]) ? "높음" : /낮|하|low/i.test(p[1]) ? "낮음" : "중간"; s = s.replace(p[0], " "); }
    if (/⭐|\*\*/.test(s)) { out.star = true; s = s.replace(/⭐|\*\*/g, " "); }
    const parts = s.split("//").map(x => x.replace(/\s+/g, " ").trim());
    out.text = parts[0]; out.second = parts[1] || ""; return out;
  }
  // 옵션 버튼/칸 (기호 입력과 병행 — 버튼 값이 우선)
  $("optStar").addEventListener("click", () => $("optStar").classList.toggle("on"));
  function resetOpts() {
    $("optStar").classList.remove("on"); $("optDue").value = ""; $("optPri").value = "중간"; $("optWho").value = "";
    $("optLearned").value = ""; $("optDesc").value = ""; $("optWhy").value = ""; $("optReview").value = "";
  }
  async function quickAdd() {
    const type = $("qType").value, prj = $("qPrj").value, raw = $("qText").value;
    if (!raw.trim()) { $("qText").focus(); return; }
    const q = parseQuick(raw); let r;
    if (type === "task") {
      const star = $("optStar").classList.contains("on") || !!q.star;
      const due = $("optDue").value || q.due || "";
      const pri = $("optPri").value !== "중간" ? $("optPri").value : (q.pri || "중간");
      const who = $("optWho").value.trim() || q.who || "";
      q.star = star; q.due = due; q.pri = pri; q.who = who;
      r = await api("addTask", { prj, text: q.text, due, star, pri, who });
    }
    else if (type === "log") { q.second = $("optLearned").value.trim() || q.second; r = await api("addLog", { prj, did: q.text, learned: q.second }); }
    else if (type === "idea") r = await api("addIdea", { text: q.text, desc: $("optDesc").value.trim() || q.second, field: prj && !/개인/.test(prj) ? prj : "" });
    else if (type === "decision") r = await api("addDecision", { prj, text: q.text, why: $("optWhy").value.trim() || q.second, review: $("optReview").value || q.due || "" });
    if (!r) return;
    $("qText").value = ""; resetOpts();
    msg({ task: "할 일 추가됨 ✓", log: "일지 기록됨 ✓", idea: "아이디어 심었어요 🌱", decision: "결정 기록됨 📌" }[type] + (r.blind ? " (반영 확인 중…)" : ""));
    if (type === "task") {
      const t = { prj, text: q.text, due: q.due ? parseDate(q.due) : null, star: !!q.star, status: "할일", pri: q.pri || "중간", who: q.who || "" };
      $("allTasksList").insertAdjacentHTML("afterbegin", taskHtml(t, `<span class="focus-why">방금 추가</span>`));
      const e = $("allTasksList").querySelector(".task-empty"); if (e) e.remove();
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
    $("qText").placeholder = { task: "할 일을 적고 Enter", log: "오늘 한 일을 적고 Enter", idea: "아이디어를 적고 Enter", decision: "결정한 내용을 적고 Enter" }[t];
    $("qPrj").style.display = t === "idea" ? "none" : "";
    ["Task", "Log", "Idea", "Decision"].forEach(k => { $("opts" + k).hidden = k.toLowerCase() !== t; });
  });
  function refreshWriteUI() {
    const on = canWrite();
    $("quickBar").classList.toggle("disabled", !on); $("quickOff").hidden = on;
    $("setupHint").textContent = on ? "연결됨 ✓" : "미설정"; $("writeUrl").value = writeUrl();
  }
  $("saveWriteUrl").addEventListener("click", () => { localStorage.setItem(WRITE_KEY, $("writeUrl").value.trim()); refreshWriteUI(); msg(canWrite() ? "저장됨 ✓" : "URL 형식이 맞지 않아요 (…/exec)", !canWrite()); load(false); });
  $("testWriteUrl").addEventListener("click", async () => {
    try { const res = await fetch($("writeUrl").value.trim()); const d = await res.json(); msg(d.ok ? "연결 OK: " + d.msg : "응답 이상", !d.ok); }
    catch (e) { msg("연결 실패 — 배포 설정(액세스: 모든 사용자) 확인", true); }
  });
  refreshWriteUI();

  // ===== 데이터: 기기 캐시로 즉시 표시 → 뒤에서 갱신 =====
  const CACHE_KEY = "zj_board_cache_v2";
  const TABS = ["프로젝트", "할일", "업무일지", "결정", "아이디어", "콘텐츠"];
  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { return null; } };
  async function fetchAll(fromCache) {
    if (fromCache) { const c = readCache(); return c && c.rows ? c.rows : null; }
    const arr = await Promise.all(TABS.map(loadTab));
    const rows = {}; TABS.forEach((t, i) => rows[t] = arr[i]);
    if (rows["할일"]) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), rows })); } catch (e) {} }
    return rows;
  }

  let rendered = false;
  async function load(fromCache) {
    const first = !rendered;
    if (first) $("boardLoading").hidden = false; else $("boardUpdating").hidden = false;
    $("boardError").hidden = true;
    try {
      const rows = await fetchAll(fromCache);
      if (!rows) { if (fromCache) $("boardLoading").hidden = true; return; }           // 캐시 없음 → 네트워크 로드가 이어서 처리
      if (!rows["할일"]) throw new Error("fetch");
      const { projects } = await loadProjects(rows["프로젝트"]);
      const idOf = matcher(projects);

      // 입력 바 프로젝트 선택지
      const labels = projects.map(p => p.label || (p.icon + " " + p.name));
      const sel = $("qPrj"); const prev = sel.value;
      sel.innerHTML = labels.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
      if (prev && labels.includes(prev)) sel.value = prev;

      const tasks = parseTasks(rows["할일"], idOf);
      // 담당 이름 자동완성 목록 (할일 담당 + 기본 이름)
      const names = [...new Set(["나", "준", "현영", "경이", ...tasks.map(t => t.who).filter(Boolean)])];
      $("whoList").innerHTML = names.map(n => `<option value="${esc(n)}">`).join("");
      const logs = (rows["업무일지"] || [])
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), did: cell(r, 2), learned: cell(r, 3), pid: idOf(cell(r, 1)) }))
        .filter(l => l.date && l.did && !l.did.startsWith("(예시)")).sort((a, b) => b.date - a.date);
      const decisions = (rows["결정"] || [])
        .map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), text: cell(r, 2), why: cell(r, 3), review: parseDate(r[4]), status: cell(r, 5) || "유효" }))
        .filter(d => d.date && d.text && !d.text.startsWith("(예시)") && d.status !== "폐기").sort((a, b) => b.date - a.date);
      const ideas = (rows["아이디어"] || [])
        .map(r => ({ text: cell(r, 1), desc: cell(r, 2), field: cell(r, 3), pull: +cell(r, 4) || 0, feas: +cell(r, 5) || 0, status: cell(r, 6) || "씨앗" }))
        .filter(i => i.text && !i.text.startsWith("(예시)") && i.text !== "아이디어");
      const CSTAGES = ["아이디어", "원고", "촬영", "편집", "업로드완료"];
      const contents = (rows["콘텐츠"] || [])
        .map(r => ({ prj: cell(r, 1), title: cell(r, 2), stage: cell(r, 3), script: cell(r, 4), due: parseDate(r[5]) }))
        .filter(c => c.title && !c.title.startsWith("(예시)") && c.title !== "제목/주제");

      const open = tasks.filter(t => t.status !== "완료" && t.status !== "보류");
      const mine = open.filter(t => isMe(t.who));
      const delegated = open.filter(t => !isMe(t.who));
      const overdue = open.filter(t => t.due && daysDiff(t.due) < 0);
      const done = tasks.filter(t => t.status === "완료");
      const doneThisWeek = done.filter(t => t.doneAt && ago(t.doneAt) <= 7);

      // 1. 현황
      $("statRow").innerHTML = `
        <div class="stat-card"><strong>${mine.length}</strong><span>내 할 일</span></div>
        <div class="stat-card"><strong>${delegated.length}</strong><span>맡긴 일</span></div>
        <div class="stat-card ${overdue.length ? "warn" : "ok"}"><strong>${overdue.length}</strong><span>마감 지남</span></div>
        <div class="stat-card ok"><strong>${doneThisWeek.length}<span style="font-size:.8rem;color:var(--text-dim);font-weight:400;"> / ${done.length}</span></strong><span>이번 주 완료 / 누적</span></div>`;

      // 2. 지금 이것부터 (상위 3)
      const score = t => {
        let s = 100;
        if (t.due && daysDiff(t.due) < 0) s = 1000 - daysDiff(t.due);
        else if (t.due && daysDiff(t.due) === 0) s = 900;
        else if (t.star && t.pri === "높음") s = 800;
        else if (t.due && daysDiff(t.due) <= 3) s = 700 - daysDiff(t.due);
        else if (t.star) s = 600;
        else if (t.pri === "높음") s = 500;
        if (t.status === "진행중") s += 50;
        return s;
      };
      const top = [...mine].sort((a, b) => score(b) - score(a)).slice(0, 3);
      $("focusList").innerHTML = top.length
        ? top.map((t, i) => taskHtml(t, `<span class="focus-num">${i + 1}</span>`)).join("")
        : '<p class="task-empty">할 일이 비어 있어요. 위 입력 바에 하나만 적어보세요.</p>';
      const notes = [];
      decisions.filter(d => d.review && daysDiff(d.review) <= 7).forEach(d => notes.push(`📌 결정 재검토 ${daysDiff(d.review) <= 0 ? "오늘" : "D-" + daysDiff(d.review)}: ${esc(d.text.slice(0, 30))}`));
      contents.filter(c => c.due && c.stage !== "업로드완료" && daysDiff(c.due) <= 3).forEach(c => notes.push(`🎬 ${esc(c.title)} 업로드 ${dueTxt(c.due)}`));
      if (notes.length) $("focusList").insertAdjacentHTML("beforeend", `<p class="task-empty" style="padding:6px 0 0;">${notes.join(" · ")}</p>`);

      // 3. 맡긴 일
      $("delegSection").hidden = delegated.length === 0;
      if (delegated.length) {
        $("delegHint").textContent = `${delegated.length}건`;
        const byWho = {}; delegated.forEach(t => { (byWho[t.who] = byWho[t.who] || []).push(t); });
        $("delegGrid").innerHTML = Object.entries(byWho).map(([who, list]) => {
          list.sort((a, b) => ((a.due || 9e15) - (b.due || 9e15)));
          const needs = list.filter(t => t.due && daysDiff(t.due) < 0).length;
          return `<div class="deleg-card ${needs ? "needs" : ""}">
            <div class="deleg-head"><div class="deleg-avatar">${esc(who.slice(0, 1))}</div><h3>${esc(who)}</h3><span>${list.length}건${needs ? ` · <b style="color:#facc15">확인 ${needs}</b>` : ""}</span></div>
            <ul class="deleg-list">${list.map(t => `<li>${chkBtn(t)}<span class="d-prj">${esc(t.prj)}</span><span>${esc(t.text)}</span><span class="d-due ${t.due && daysDiff(t.due) < 0 ? "over" : ""}">${t.due ? dueTxt(t.due) : ""}</span></li>`).join("")}</ul></div>`;
        }).join("");
      }

      // 4. 프로젝트 (한 줄 목록)
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
        const items = [...my].sort((a, b) => (b.star - a.star) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1)) || ((a.due || 9e15) - (b.due || 9e15))).slice(0, 5);
        return `<div class="prj-row h-${h} ${active ? "" : "inactive"}">
          <div class="prj-row-head">
            <span class="icon">${p.icon}</span>
            <span class="name">${esc(p.name)}</span>
            <span class="meta">${STAGE_NAMES[p.stage]} · 할 일 <b>${my.length}</b>${over ? ` · <b style="color:#f87171">지남 ${over}</b>` : ""}${p.public === false ? " · 🔒" : ""}</span>
            <span class="chev">▶</span>
          </div>
          <div class="prj-row-body">
            <div class="goal">${p.goal && p.goal !== "-" ? `🎯 ${esc(p.goal)}` : `<span style="color:var(--text-dim)">🎯 목표 없음 — 시트 프로젝트 탭에 한 줄</span>`}</div>
            <ul>${items.map(t => `<li>${chkBtn(t)}<span>${t.star ? "⭐ " : ""}${esc(t.text)}</span>${!isMe(t.who) ? `<span class="task-who">👤${esc(t.who)}</span>` : ""}${t.due ? `<span class="task-due ${daysDiff(t.due) < 0 ? "over" : ""}">${dueTxt(t.due)}</span>` : ""}</li>`).join("") || "<li style='color:var(--text-dim)'>할 일 없음 — 위 입력 바에서 추가</li>"}</ul>
            <div class="foot"><span>${last ? `마지막 기록 ${fmtDate(last.date)}${since ? ` (${since}일 전)` : " (오늘)"}` : "아직 기록 없음"}</span><a href="project.html?id=${encodeURIComponent(p.id)}">공개 페이지 →</a></div>
          </div>
        </div>`;
      }).join("");

      // 5. 할 일 전체 (⭐ → 마감 → 우선순위)
      $("allTasksHint").textContent = `남은 ${open.length} · 완료 ${done.length}`;
      $("allTasksList").innerHTML = [...open].sort((a, b) => (b.star - a.star) || ((a.due || 9e15) - (b.due || 9e15)) || ((sortPri[a.pri] ?? 1) - (sortPri[b.pri] ?? 1))).map(t => taskHtml(t)).join("") || '<p class="task-empty">남은 할 일이 없습니다. 🌱</p>';

      // 6. 접힌 섹션
      $("contentDetails").hidden = contents.length === 0;
      if (contents.length) {
        const inProg = contents.filter(c => c.stage !== "업로드완료");
        $("contentHint").textContent = `진행 ${inProg.length} · 완료 ${contents.length - inProg.length}`;
        $("pipeRow").innerHTML = CSTAGES.map(s => `<div class="pipe-step ${s === "업로드완료" ? "done" : ""}"><strong>${contents.filter(c => c.stage === s).length}</strong><span>${s}</span></div>`).join("");
        $("contentList").innerHTML = inProg.map(c => `<div class="task"><span class="task-text">${esc(c.title)}</span><span class="task-stage">${esc(c.stage)}</span>${c.script ? `<a class="task-link" href="${esc(c.script)}" target="_blank" rel="noopener">원고 ↗</a>` : ""}${c.due ? `<span class="task-due">${dueTxt(c.due)}</span>` : ""}<span class="task-prj">${esc(c.prj)}</span></div>`).join("") || '<p class="task-empty">진행 중인 콘텐츠가 없습니다.</p>';
      }
      $("ideaDetails").hidden = ideas.length === 0;
      if (ideas.length) {
        const alive = ideas.filter(i => i.status === "씨앗" || i.status === "검토중").sort((a, b) => (b.pull + b.feas) - (a.pull + a.feas));
        $("ideaCount").textContent = `씨앗 ${alive.length} · 전체 ${ideas.length}`;
        $("ideaList").innerHTML = alive.slice(0, 8).map(i => `<div class="task"><span class="task-text"><strong>${esc(i.text)}</strong>${i.desc ? ` <span style="color:var(--text-dim)">— ${esc(i.desc)}</span>` : ""}</span>${i.field ? `<span class="idea-field">${esc(i.field)}</span>` : ""}<span class="idea-score">${i.pull}+${i.feas}</span></div>`).join("");
      }
      $("decisionDetails").hidden = decisions.length === 0;
      if (decisions.length) {
        $("decisionHint").textContent = `${decisions.length}건`;
        const groups = {}; decisions.forEach(d => { (groups[d.prj || "기타"] = groups[d.prj || "기타"] || []).push(d); });
        $("decisionList").innerHTML = Object.entries(groups).map(([prj, list]) => `<div class="dec-group"><h3>${esc(prj)}</h3>` +
          list.map(d => `<div class="dec-item"><div class="dec-text">${esc(d.text)}</div>${d.why ? `<div class="dec-why">${esc(d.why)}</div>` : ""}<div class="dec-meta">${fmtDate(d.date)}${d.review ? ` · 재검토 ${fmtDate(d.review)}` : ""}</div></div>`).join("") + `</div>`).join("");
      }
      $("logHint").textContent = `최근 ${Math.min(10, logs.length)}개`;
      $("logList").innerHTML = logs.slice(0, 10).map(l => `<div class="timeline-item"><div class="timeline-date">${fmtDate(l.date)}</div><div class="timeline-content"><h3 style="font-size:.95rem;">${esc(l.prj) || "📋"}</h3><p>${esc(l.did)}${l.learned ? `<br><em style="color:var(--accent);">💡 ${esc(l.learned)}</em>` : ""}</p></div></div>`).join("") || '<p class="task-empty">아직 업무일지가 없습니다.</p>';

      rendered = true;
      $("boardLoading").hidden = true; $("boardUpdating").hidden = true; $("boardContent").hidden = false;
    } catch (e) {
      console.error(e);
      $("boardLoading").hidden = true; $("boardUpdating").hidden = true;
      if (!rendered) $("boardError").hidden = false;
    }
  }

  // 새로고침 = 페이지 자체를 다시 받아옴 (캐시된 옛 버전 방지). 주소 뒤에 시각을 붙여 강제 갱신
  $("refreshBtn").addEventListener("click", () => { location.href = location.pathname + "?r=" + Date.now(); });
  load(true).then(() => load(false));   // 캐시로 즉시 → 네트워크로 갱신
})();
