// ===== 콘텐츠 스튜디오: 아이디어 → 원고 → 촬영 → 편집 → 업로드 칸반 (시트 '콘텐츠' 탭) =====
(function () {
  const { loadTab, loadProjects, parseDate, fmtDate, esc, cell } = SHEET;
  const $ = id => document.getElementById(id);
  const STAGES = ["아이디어", "원고", "촬영", "편집", "업로드완료"];
  const HOLD = ["보류", "폐기"];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysDiff = d => Math.round((d - today) / 86400000);
  const dueTxt = d => !d ? "" : (daysDiff(d) < 0 ? `${-daysDiff(d)}일 지남` : daysDiff(d) === 0 ? "오늘" : `D-${daysDiff(d)}`);

  // ---- 쓰기 API (보드와 동일) ----
  const WRITE_KEY = "zj_write_url_v2"; // v2: 옛 주소가 저장된 기기 무시
  const DEFAULT_WRITE_URL = "https://script.google.com/macros/s/AKfycbzYHtUl7iFSqXWBXvL3m167FL6GO25GteG0QethSpO3e5wlmBPk3t1ypQYwH2IfFQoa4w/exec";
  const writeUrl = () => (localStorage.getItem(WRITE_KEY) || DEFAULT_WRITE_URL).trim();
  function msg(text, err) { const m = $("qMsg"); m.hidden = false; m.textContent = text; m.classList.toggle("err", !!err); clearTimeout(msg._t); msg._t = setTimeout(() => { m.hidden = true; }, 5000); }
  async function api(action, payload) {
    const body = JSON.stringify({ action, ...payload });
    try {
      const res = await fetch(writeUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow" });
      const data = await res.json().catch(() => ({ ok: res.ok }));
      if (!data.ok) {
        if (/알 수 없는 action/.test(data.error || "")) throw new Error("시트 스크립트가 구버전이에요 — Apps Script에 새 코드 붙여넣고 '새 버전'으로 재배포해 주세요");
        throw new Error(data.error || "실패");
      }
      return data;
    } catch (e) {
      if (e instanceof TypeError) { try { await fetch(writeUrl(), { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }); return { ok: true, blind: true }; } catch (e2) { msg("저장 실패(네트워크)", true); return null; } }
      msg(e.message, true); return null;
    }
  }
  const reloadSoon = () => { setTimeout(() => load(false), 4000); setTimeout(() => load(false), 20000); };

  // ---- 데이터 ----
  const CACHE_KEY = "zj_studio_cache_v1";
  let ITEMS = [], PROJECTS_ = [];
  async function fetchRows(fromCache) {
    if (fromCache) { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c ? c.rows : null; } catch (e) { return null; } }
    const [cRows, pRows] = await Promise.all([loadTab("콘텐츠"), loadTab("프로젝트")]);
    const rows = { c: cRows, p: pRows };
    if (cRows) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), rows })); } catch (e) {} }
    return rows;
  }
  const stageIdx = s => STAGES.indexOf(s);

  function cardHtml(it) {
    const i = stageIdx(it.stage);
    const prev = i > 0 ? STAGES[i - 1] : null, next = i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
    const t = esc(it.title);
    let acts = "";
    if (it.stage === "아이디어") acts = `<button class="kbtn primary" data-act="stage" data-title="${t}" data-to="원고">채택 → 원고</button><button class="kbtn ghost" data-act="stage" data-title="${t}" data-to="보류">보류</button>`;
    else if (HOLD.includes(it.stage)) acts = `<button class="kbtn" data-act="stage" data-title="${t}" data-to="아이디어">↩ 아이디어로</button>`;
    else acts = `${prev ? `<button class="kbtn" data-act="stage" data-title="${t}" data-to="${prev}">← ${prev}</button>` : ""}${next ? `<button class="kbtn primary" data-act="stage" data-title="${t}" data-to="${next}">${next === "업로드완료" ? "업로드 완료 🚀" : next + " →"}</button>` : ""}`;
    const fields = [];
    if (i >= 1 && i <= 3) fields.push(`<input class="kinput" data-field="script" data-title="${t}" value="${esc(it.script)}" placeholder="📝 원고 링크 (구글 Docs) 붙여넣기">`);
    if (i >= 3) fields.push(`<input class="kinput" data-field="video" data-title="${t}" value="${esc(it.video)}" placeholder="▶ 영상 링크 붙여넣기">`);
    if (i >= 1 && i <= 3) fields.push(`<label class="sub">📅 업로드 예정 <input type="date" class="kinput" data-field="due" data-title="${t}" value="${it.dueRaw}"></label>`);
    const sub = [it.prj ? esc(it.prj) : "", it.due ? `<span style="color:${daysDiff(it.due) < 0 ? "#f87171" : "var(--text-dim)"}">📅 ${dueTxt(it.due)}</span>` : "",
      it.script && i >= 1 ? `<a href="${esc(it.script)}" target="_blank" rel="noopener">원고 ↗</a>` : "", it.video ? `<a href="${esc(it.video)}" target="_blank" rel="noopener">영상 ↗</a>` : "",
      it.date ? `<span>${fmtDate(it.date)}</span>` : ""].filter(Boolean).join(" · ");
    return `<div class="kcard" data-title="${t}"><div class="title">${t}</div>${sub ? `<div class="sub">${sub}</div>` : ""}${fields.join("")}<div class="acts">${acts}</div></div>`;
  }

  function render() {
    STAGES.forEach((s, i) => {
      const list = ITEMS.filter(it => it.stage === s || (i === 0 && !STAGES.includes(it.stage) && !HOLD.includes(it.stage)));
      $("c" + i).textContent = list.length;
      $("k" + i).innerHTML = list.map(cardHtml).join("") || `<div class="kempty">${i === 0 ? "위에 아이디어를 적어보세요" : "비어 있음"}</div>`;
    });
    const hold = ITEMS.filter(it => HOLD.includes(it.stage));
    $("holdDetails").hidden = hold.length === 0;
    $("holdHint").textContent = `${hold.length}개`;
    $("holdList").innerHTML = hold.map(cardHtml).join("");
  }

  let rendered = false;
  async function load(fromCache) {
    if (!rendered) $("boardLoading").hidden = false;
    try {
      const rows = await fetchRows(fromCache);
      if (!rows) { if (fromCache) $("boardLoading").hidden = true; return; }
      if (!rows.c) throw new Error("fetch");
      const { projects } = await loadProjects(rows.p || undefined);
      PROJECTS_ = projects;
      const sel = $("ideaPrj"); const prev = sel.value;
      sel.innerHTML = projects.filter(p => p.public !== false || /유튜브/.test(p.name)).map(p => `<option value="${esc(p.label || p.icon + " " + p.name)}">${esc(p.label || p.icon + " " + p.name)}</option>`).join("");
      const yt = [...sel.options].find(o => /유튜브/.test(o.value)); if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev; else if (yt) sel.value = yt.value;
      ITEMS = rows.c.map(r => ({ date: parseDate(r[0]), prj: cell(r, 1), title: cell(r, 2), stage: cell(r, 3) || "아이디어", script: cell(r, 4), dueRaw: (cell(r, 5).match(/\d{4}-\d{2}-\d{2}/) || [""])[0], due: parseDate(r[5]), video: cell(r, 6), memo: cell(r, 7) }))
        .filter(it => it.title && it.title !== "제목/주제" && !it.title.startsWith("(예시)"));
      render();
      rendered = true;
      $("boardLoading").hidden = true; $("boardError").hidden = true; $("kanban").hidden = false;
    } catch (e) { console.error(e); $("boardLoading").hidden = true; if (!rendered) $("boardError").hidden = false; }
  }

  // ---- 액션 ----
  async function addIdea() {
    const title = $("ideaText").value.trim(); if (!title) { $("ideaText").focus(); return; }
    const prj = $("ideaPrj").value;
    const r = await api("addContent", { prj, title, stage: "아이디어" });
    if (!r) return;
    $("ideaText").value = ""; msg("아이디어 추가 💡" + (r.blind ? " (반영 확인 중…)" : ""));
    ITEMS.unshift({ date: today, prj, title, stage: "아이디어", script: "", dueRaw: "", due: null, video: "", memo: "" }); render();
    reloadSoon();
  }
  $("ideaAdd").addEventListener("click", addIdea);
  $("ideaText").addEventListener("keydown", e => { if (e.key === "Enter") addIdea(); });

  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-act='stage']"); if (!b) return;
    const title = b.dataset.title, to = b.dataset.to;
    const card = b.closest(".kcard"); if (card) card.classList.add("busy");
    const r = await api("updateContent", { title, stage: to });
    if (!r) { if (card) card.classList.remove("busy"); return; }
    const it = ITEMS.find(x => x.title === title); if (it) it.stage = to;
    render(); msg(`→ ${to}` + (r.blind ? " (반영 확인 중…)" : ""));
    reloadSoon();
  });
  document.addEventListener("change", async e => {
    const inp = e.target.closest("input[data-field]"); if (!inp) return;
    const title = inp.dataset.title, field = inp.dataset.field, value = inp.value.trim();
    const payload = { title }; payload[field] = value;
    const r = await api("updateContent", payload);
    if (!r) return;
    const it = ITEMS.find(x => x.title === title);
    if (it) { if (field === "script") it.script = value; if (field === "video") it.video = value; if (field === "due") { it.dueRaw = value; it.due = parseDate(value); } }
    msg("저장됨 ✓"); render(); reloadSoon();
  });
  $("refreshBtn").addEventListener("click", () => { location.href = location.pathname + "?r=" + Date.now(); });

  load(true).then(() => load(false));
})();
