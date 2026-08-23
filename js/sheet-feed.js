// ============================================================
// 구글 시트 '업무일지' 탭 → 메인 JOURNEY 피드 자동 표시 (sheet-data.js 사용)
// ============================================================
(async function () {
  const journey = document.getElementById('journeyTimeline');
  if (!journey || typeof SHEET === 'undefined') return;
  try {
    const rows = await SHEET.loadTab("업무일지");
    if (!rows) return;
    const entries = rows
      .map(r => ({ date: SHEET.parseDate(r[0]), prj: SHEET.cell(r, 1), did: SHEET.cell(r, 2), learned: SHEET.cell(r, 3) }))
      .filter(e => e.date && e.did && !e.did.startsWith("(예시)"))
      .sort((a, b) => b.date - a.date);
    if (!entries.length) return;
    journey.dataset.fromSheet = "1";
    journey.innerHTML = entries.slice(0, 10).map(e => `
      <div class="timeline-item">
        <div class="timeline-date">${SHEET.fmtDate(e.date)}</div>
        <div class="timeline-content">
          <h3>${SHEET.esc(e.prj) || "📋 업무일지"}</h3>
          <p>${SHEET.esc(e.did)}${e.learned ? `<br><em style="color:var(--accent);">💡 ${SHEET.esc(e.learned)}</em>` : ""}</p>
        </div>
      </div>`).join("");
  } catch (e) { /* 연동 실패 시 기존 로그 유지 */ }
})();
