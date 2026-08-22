// ============================================================
// 구글 시트 연동: '업무일지' 탭을 JOURNEY 피드에 자동 표시
// ============================================================
// 설정법:
//   1. 구글 시트에서: 파일 → 공유 → 웹에 게시
//   2. "전체 문서" 대신 '업무일지' 탭만 선택, 형식은 CSV
//   3. 생성된 URL을 아래 SHEET_CSV_URL에 붙여넣기
// 주의: 웹에 게시하면 그 탭은 누구나 볼 수 있게 됩니다.
//       '할일'과 '대시보드' 탭은 게시하지 마세요 (비공개 유지).
// ============================================================

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1IW65a8-4D4nkGQfbNSrVRZQYRV4128iRTYtK0d7FJi4/gviz/tq?tqx=out:csv&sheet=%EC%97%85%EB%AC%B4%EC%9D%BC%EC%A7%80"; // 업무일지 탭

// --- CSV 파서 (따옴표, 쉼표, 줄바꿈 처리) ---
function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = "";
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
      } else cur += ch;
    }
  }
  row.push(cur);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

// --- 업무일지 → JOURNEY 피드에 병합 ---
async function loadSheetFeed() {
  if (!SHEET_CSV_URL) return;
  const journey = document.getElementById('journeyTimeline');
  if (!journey) return;

  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) return;
    const rows = parseCSV(await res.text());

    // 헤더 행(날짜/프로젝트/...)과 제목·예시 행 제외, 날짜가 있는 행만
    const entries = rows
      .filter(r => /^\d{4}[-.]\d{1,2}[-.]\d{1,2}/.test((r[0] || "").trim()))
      .map(r => ({
        date: r[0].trim().replace(/-/g, "."),
        prj: (r[1] || "").trim(),
        did: (r[2] || "").trim(),
        learned: (r[3] || "").trim()
      }))
      .filter(e => e.did && !e.did.startsWith("(예시)"));

    if (!entries.length) return;
    entries.sort((a, b) => b.date.localeCompare(a.date));

    const html = entries.slice(0, 10).map(e => `
      <div class="timeline-item">
        <div class="timeline-date">${e.date}</div>
        <div class="timeline-content">
          <h3>${e.prj || "📋 업무일지"}</h3>
          <p>${e.did}${e.learned ? `<br><em style="color:var(--accent);">💡 ${e.learned}</em>` : ""}</p>
        </div>
      </div>`).join("");

    // 시트 일지가 있으면 JOURNEY를 시트 기준으로 교체 (최신 소스 우선)
    journey.innerHTML = html;
  } catch (e) {
    // 연동 실패 시 조용히 기존 로그 유지
  }
}
loadSheetFeed();
