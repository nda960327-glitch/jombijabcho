/**
 * 좀비잡초 보드 — 시트 쓰기 API (Google Apps Script)
 * ------------------------------------------------------------
 * 설치 (5단계, 1회만):
 *  1. 시트 열기 → 상단 메뉴 [확장 프로그램] → [Apps Script]
 *  2. 열린 편집기의 코드를 전부 지우고 이 파일 내용을 붙여넣기 → 저장(💾)
 *  3. 오른쪽 위 [배포] → [새 배포] → 유형 선택(⚙️) → [웹 앱]
 *  4. "다음 사용자 인증 정보로 실행": 나 / "액세스 권한이 있는 사용자": 모든 사용자 → [배포]
 *     (권한 허용 창이 뜨면 → 고급 → 프로젝트로 이동 → 허용)
 *  5. 생성된 "웹 앱 URL"(https://script.google.com/macros/s/…/exec)을 복사해
 *     보드 맨 아래 [⚙️ 빠른 입력 설정] 칸에 붙여넣고 저장
 * ------------------------------------------------------------
 * 코드를 수정한 뒤에는 [배포] → [배포 관리] → ✏️ → 버전: 새 버전 → [배포] 해야 반영됩니다.
 */

const TAB = { 할일: "할일", 일지: "업무일지", 아이디어: "아이디어", 루틴: "루틴", 결정: "결정", 콘텐츠: "콘텐츠" };

function doGet(e) {
  return json_({ ok: true, msg: "좀비잡초 보드 API 작동 중", time: new Date().toISOString() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const today = today_();
    let result;
    switch (body.action) {
      case "addTask": {      // {prj, text, due, star, pri, who, memo}
        const sh = ss.getSheetByName(TAB.할일);
        const row = nextRow_(sh, 3);
        sh.getRange(row, 1, 1, 10).setValues([[today, body.prj || "", body.text || "", body.due || "", body.star ? "⭐" : "", "할일", body.pri || "중간", body.memo || "", body.who || "", ""]]);
        result = { row };
        break;
      }
      case "doneTask": {     // {text, prj}
        const sh = ss.getSheetByName(TAB.할일);
        const r = findRow_(sh, 3, body.text, 2, body.prj);
        if (!r) throw new Error("할 일을 찾지 못했습니다: " + body.text);
        sh.getRange(r, 6).setValue("완료");
        sh.getRange(r, 10).setValue(today);
        result = { row: r };
        break;
      }
      case "undoTask": {     // {text, prj}
        const sh = ss.getSheetByName(TAB.할일);
        const r = findRow_(sh, 3, body.text, 2, body.prj);
        if (!r) throw new Error("할 일을 찾지 못했습니다");
        sh.getRange(r, 6).setValue("할일"); sh.getRange(r, 10).setValue("");
        result = { row: r };
        break;
      }
      case "toggleStar": {   // {text, prj}
        const sh = ss.getSheetByName(TAB.할일);
        const r = findRow_(sh, 3, body.text, 2, body.prj);
        if (!r) throw new Error("할 일을 찾지 못했습니다");
        const cur = String(sh.getRange(r, 5).getValue());
        sh.getRange(r, 5).setValue(cur.indexOf("⭐") >= 0 ? "" : "⭐");
        result = { row: r, star: cur.indexOf("⭐") < 0 };
        break;
      }
      case "setStatus": {    // {text, prj, status}  status: 할일|진행중|완료|보류
        const sh = ss.getSheetByName(TAB.할일);
        const r = findRow_(sh, 3, body.text, 2, body.prj);
        if (!r) throw new Error("할 일을 찾지 못했습니다");
        sh.getRange(r, 6).setValue(body.status || "할일");
        if (body.status === "완료") sh.getRange(r, 10).setValue(today);
        result = { row: r };
        break;
      }
      case "addLog": {       // {prj, did, learned}
        const sh = ss.getSheetByName(TAB.일지);
        const row = nextRow_(sh, 3);
        sh.getRange(row, 1, 1, 4).setValues([[today, body.prj || "", body.did || "", body.learned || ""]]);
        result = { row };
        break;
      }
      case "addIdea": {      // {text, desc, field, pull, feas}
        const sh = ss.getSheetByName(TAB.아이디어);
        const row = nextRow_(sh, 2);
        sh.getRange(row, 1, 1, 8).setValues([[today, body.text || "", body.desc || "", body.field || "", body.pull || "", body.feas || "", "씨앗", ""]]);
        result = { row };
        break;
      }
      case "checkRoutine": { // {item}
        const sh = ss.getSheetByName(TAB.루틴);
        const r = findRow_(sh, 1, body.item);
        if (!r) throw new Error("루틴을 찾지 못했습니다");
        sh.getRange(r, 5).setValue(today);
        result = { row: r };
        break;
      }
      case "addDecision": {  // {prj, text, why, review}
        const sh = ss.getSheetByName(TAB.결정);
        const row = nextRow_(sh, 3);
        sh.getRange(row, 1, 1, 6).setValues([[today, body.prj || "", body.text || "", body.why || "", body.review || "", "유효"]]);
        result = { row };
        break;
      }
      case "addContent": {   // {prj, title, stage, script, due}
        const sh = ss.getSheetByName(TAB.콘텐츠);
        const row = nextRow_(sh, 3);
        sh.getRange(row, 1, 1, 8).setValues([[today, body.prj || "", body.title || "", body.stage || "아이디어", body.script || "", body.due || "", "", ""]]);
        result = { row };
        break;
      }
      default:
        throw new Error("알 수 없는 action: " + body.action);
    }
    return json_({ ok: true, action: body.action, result });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ---- helpers ----
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Seoul", "yyyy-MM-dd");
}
// keyCol 열이 비어있는 첫 행 (맨 아래 다음 행)
function nextRow_(sh, keyCol) {
  const vals = sh.getRange(1, keyCol, Math.max(sh.getLastRow(), 1), 1).getValues();
  let last = 0;
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() !== "") last = i + 1;
  return last + 1;
}
// col 열의 값이 text와 같은(공백 무시) 행 찾기. 선택적으로 col2==text2 조건
function findRow_(sh, col, text, col2, text2) {
  const n = sh.getLastRow(); if (n < 1) return 0;
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();
  const a = sh.getRange(1, col, n, 1).getValues();
  const b = col2 ? sh.getRange(1, col2, n, 1).getValues() : null;
  for (let i = n - 1; i >= 0; i--) {          // 아래(최신)부터
    if (norm(a[i][0]) === norm(text) && (!col2 || !text2 || norm(b[i][0]) === norm(text2))) return i + 1;
  }
  return 0;
}
