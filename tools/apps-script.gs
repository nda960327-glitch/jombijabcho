/**
 * MY HOME — 데이터 저장 + 주식 시세 API (Google Apps Script)
 * ============================================================
 * 이 스크립트는 스프레드시트에 붙어 있지 않은 "독립 스크립트"입니다.
 * 처음 실행될 때 내 구글 드라이브에 "MY HOME 데이터" 시트를 자동으로 만들어요.
 * 시트를 미리 만들 필요 없습니다.
 *
 * 설치 (한 번만, 5분)
 *  1. script.google.com 접속 → [새 프로젝트]
 *  2. 편집기의 기본 코드를 전부 지우고, 이 파일 내용을 그대로 붙여넣기 → 저장(💾)
 *  3. 오른쪽 위 [배포] → [새 배포] → 유형 선택(⚙️) → [웹 앱]
 *  4. "다음 사용자 인증 정보로 실행": 나
 *     "액세스 권한이 있는 사용자": 모든 사용자   → [배포]
 *     (권한 허용 창이 뜨면 → 고급 → 프로젝트로 이동 → 허용)
 *  5. 아래 PIN 을 내가 쓸 숫자로 바꾸고 저장 → 배포
 *
 * ⭐ 가장 중요: 아래 PIN 을 반드시 나만 아는 값으로 바꾸세요.
 *    사이트 주소는 공개돼 있지만, 이 PIN 을 모르면 아무것도 읽거나 쓸 수 없습니다.
 *    PIN 은 이 편집기 안에만 있고 깃허브에는 올라가지 않습니다.
 *
 * 기존 시트를 쓰고 싶다면 아래 SHEET_ID 에 시트 ID를 넣으세요 (선택).
 * 넣지 않으면 시트를 알아서 새로 만듭니다.
 *
 * 코드를 고친 뒤에는 [배포] → [배포 관리] → ✏️ → 버전: 새 버전 → [배포] 해야 반영됩니다.
 *    (이렇게 하면 주소가 그대로 유지됩니다. [새 배포]를 누르면 주소가 바뀌어요.)
 * ============================================================
 */

/**
 * 기존 구글시트를 쓰고 싶으면 여기에 시트 ID를 붙여넣으세요.
 * 시트 주소에서 /d/ 와 /edit 사이의 긴 문자열이 ID입니다.
 *   https://docs.google.com/spreadsheets/d/[이 부분]/edit
 * 비워두면 "MY HOME 데이터" 시트를 새로 만들어 씁니다.
 *
 * 기존 시트를 지정해도 안전합니다. 아래 탭 이름이 모두 MY_ 로 시작해서
 * 원래 있던 할일·프로젝트·업무일지 탭은 건드리지 않고 새 탭만 추가합니다.
 */
/**
 * ⭐ 나만 아는 값으로 바꾸세요. 숫자든 글자든 됩니다. (예: '482913')
 * 이 값을 모르면 누구도 내 자산·할일을 읽거나 지울 수 없습니다.
 * 비워두면 아무나 접근할 수 있으니 반드시 채우세요.
 */
var PIN = '';

var SHEET_ID  = '1IW65a8-4D4nkGQfbNSrVRZQYRV4128iRTYtK0d7FJi4';

var SS_NAME   = 'MY HOME 데이터';
var TAB_TODO  = 'MY_할일';
var TAB_ASSET = 'MY_자산';
var TAB_CONF  = 'MY_설정';

/** 종목: 코드는 야후 파이낸스 심볼 (코스닥 .KQ / 코스피 .KS) */
var STOCKS = {
  emtec: { name: '이엠텍', symbol: '091120.KQ' },
  hlb:   { name: 'HLB',    symbol: '028300.KQ' }
};

// ------------------------------------------------------------
// 진입점
// ------------------------------------------------------------
/** 브라우저로 주소만 열었을 때. 데이터는 절대 주지 않는다. */
function doGet(e) {
  return json_({ ok: true, msg: 'MY HOME API 작동 중', needPin: true });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (x) { return json_({ ok: false, error: '요청을 읽지 못했습니다' }); }

  // --- PIN 확인 ---
  if (!PIN) return json_({ ok: false, badPin: true, error: '스크립트에 PIN이 설정되지 않았습니다. Apps Script 편집기에서 PIN을 정하고 다시 배포해 주세요.' });
  if (String(body.pin || '') !== String(PIN)) {
    Utilities.sleep(700);   // 무차별 대입 늦추기
    return json_({ ok: false, badPin: true, error: 'PIN이 맞지 않습니다' });
  }

  if (body.action === 'load') {
    try {
      return json_({ ok: true, state: loadState_(), prices: getPrices_(body.stocks), sheetUrl: getSS_().getUrl() });
    } catch (err) {
      return json_({ ok: false, error: String(err && err.message || err) });
    }
  }

  if (body.action === 'save') {
    var lock = LockService.getScriptLock();
    try { lock.waitLock(15000); } catch (x) { return json_({ ok: false, error: '다른 저장이 진행 중입니다' }); }
    try {
      saveState_(body.state || {});
      return json_({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
      return json_({ ok: false, error: String(err && err.message || err) });
    } finally {
      try { lock.releaseLock(); } catch (x) {}
    }
  }

  return json_({ ok: false, error: '알 수 없는 action: ' + body.action });
}

// ------------------------------------------------------------
// 시세 (야후 파이낸스) — 60초 캐시
// ------------------------------------------------------------
/** 페이지가 보낸 {id: 심볼} 목록이 있으면 그것을, 없으면 위 STOCKS 를 쓴다 */
function getPrices_(extra) {
  var list = {};
  if (extra && typeof extra === 'object' && Object.keys(extra).length) {
    Object.keys(extra).forEach(function (k) {
      var sym = String(extra[k] || '').toUpperCase();
      if (/^[A-Z0-9.\-^=]{1,16}$/.test(sym) && Object.keys(list).length < 20) list[k] = { name: k, symbol: sym };
    });
  } else list = STOCKS;
  var cache = CacheService.getScriptCache();
  var ckey = 'prices:' + Object.keys(list).map(function (k) { return k + '=' + list[k].symbol; }).join(',');
  var hit = cache.get(ckey);
  if (hit) { try { return JSON.parse(hit); } catch (x) {} }

  var out = {};
  Object.keys(list).forEach(function (key) {
    var s = list[key];
    try {
      var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + s.symbol + '?interval=1d&range=1d';
      var res = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
      var meta = JSON.parse(res.getContentText()).chart.result[0].meta;
      out[key] = {
        name: s.name,
        symbol: s.symbol,
        price: Number(meta.regularMarketPrice),
        prev: Number(meta.chartPreviousClose || meta.previousClose || 0),
        marketTime: meta.regularMarketTime ? Number(meta.regularMarketTime) * 1000 : null,   // 마지막 체결 시각
        time: new Date().toISOString()
      };
    } catch (err) {
      out[key] = { name: s.name, symbol: s.symbol, error: String(err && err.message || err) };
    }
  });
  cache.put(ckey, JSON.stringify(out), 60);
  return out;
}

// ------------------------------------------------------------
// 스프레드시트 (없으면 자동 생성)
// ------------------------------------------------------------
function getSS_() {
  // 1) 위에 직접 적어둔 시트가 있으면 그것을 쓴다
  if (SHEET_ID) {
    var ss0 = SpreadsheetApp.openById(SHEET_ID);   // 열리지 않으면 오류를 그대로 보여준다
    initSheets_(ss0);
    return ss0;
  }
  // 2) 전에 만들어 둔 시트가 있으면 재사용
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ssId');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (x) { /* 지워졌으면 새로 만든다 */ }
  }
  // 3) 없으면 새로 만든다
  var ss = SpreadsheetApp.create(SS_NAME);
  props.setProperty('ssId', ss.getId());
  initSheets_(ss);
  var first = ss.getSheets()[0];
  if (first.getName() === 'Sheet1' || first.getName() === '시트1') ss.deleteSheet(first);
  return ss;
}

function tab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#f0ebe3');
    sh.setFrozenRows(1);
  }
  return sh;
}

function initSheets_(ss) {
  tab_(ss, TAB_TODO,  ['id', '할 일', '마감일', '상태', '등록일', '완료일']);
  tab_(ss, TAB_ASSET, ['항목', '심볼', '투자원금', '보유수량', '현재가', '평가금액', '손익']);
  tab_(ss, TAB_CONF,  ['키', '값']);
}

// ------------------------------------------------------------
// 읽기
// ------------------------------------------------------------
function loadState_() {
  var ss = getSS_();
  initSheets_(ss);

  // --- 할일 ---
  var shT = ss.getSheetByName(TAB_TODO);
  var todos = [];
  if (shT.getLastRow() > 1) {
    shT.getRange(2, 1, shT.getLastRow() - 1, 6).getValues().forEach(function (r) {
      var text = String(r[1] || '').trim();
      if (!text) return;
      todos.push({
        id: String(r[0] || '') || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        text: text,
        date: dstr_(r[2]),
        done: String(r[3] || '').indexOf('완료') >= 0,
        created: r[4] ? new Date(r[4]).getTime() : Date.now(),
        doneAt: r[5] ? new Date(r[5]).getTime() : null
      });
    });
  }

  // --- 자산: 보유수량 ---
  var shA = ss.getSheetByName(TAB_ASSET);
  var qty = {}, now = {};
  if (shA.getLastRow() > 1) {
    shA.getRange(2, 1, shA.getLastRow() - 1, 6).getValues().forEach(function (r) {
      var key = String(r[0] || '').trim();
      if (!key) return;
      if (r[3] !== '' && r[3] !== null) qty[key] = Number(r[3]) || 0;
      if (!STOCKS[key] && r[5] !== '' && r[5] !== null) now[key] = Number(r[5]) || 0;
    });
  }

  // --- 설정 ---
  var shC = ss.getSheetByName(TAB_CONF);
  var conf = {};
  if (shC.getLastRow() > 1) {
    shC.getRange(2, 1, shC.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0] || '').trim();
      if (k) conf[k] = r[1];
    });
  }

  var out = {
    todos: todos,
    qty: qty,
    now: now,
    weight: num_(conf.weight),
    weightStart: num_(conf.weightStart),
    langLog: jsonOr_(conf.langLog, {}),
    useStocks: String(conf.useStocks || '') === 'Y',
    savedAt: conf.savedAt ? String(conf.savedAt) : null
  };
  // 'json:이름' 으로 저장된 항목은 그대로 되살린다 (goals, works, order, texts …)
  var chunks = {};
  Object.keys(conf).forEach(function (k) {
    if (k.indexOf('json:') !== 0) return;
    var name = k.slice(5), idx = 0;
    var m = name.match(/^(.*)#(d+)$/);
    if (m) { name = m[1]; idx = Number(m[2]); }
    (chunks[name] = chunks[name] || [])[idx] = String(conf[k] == null ? '' : conf[k]);
  });
  Object.keys(chunks).forEach(function (name) {
    var v = jsonOr_(chunks[name].join(''), undefined);
    if (v !== undefined) out[name] = v;
  });
  return out;
}

// ------------------------------------------------------------
// 쓰기 (페이지의 전체 상태로 덮어쓰기)
// ------------------------------------------------------------
function saveState_(st) {
  var ss = getSS_();
  initSheets_(ss);
  var stockMap = {};
  (st.assets || []).forEach(function (a) { if (a && a.kind === 'stock' && a.symbol) stockMap[a.id] = a.symbol; });
  var prices = getPrices_(stockMap);

  // --- 할일 ---
  var shT = ss.getSheetByName(TAB_TODO);
  if (shT.getLastRow() > 1) shT.getRange(2, 1, shT.getLastRow() - 1, 6).clearContent();
  var todos = st.todos || [];
  if (todos.length) {
    shT.getRange(2, 1, todos.length, 6).setValues(todos.map(function (t) {
      return [
        t.id || '',
        t.text || '',
        t.date || '',
        t.done ? '완료' : '할일',
        t.created ? new Date(t.created) : '',
        t.doneAt ? new Date(t.doneAt) : ''
      ];
    }));
  }

  // --- 자산 ---
  var COST = { emtec: 341224360, hlb: 50673700, cash: 10000000, land: 68000000, garden: 210000000, deposit: 10000000 };
  var LABEL = { emtec: '이엠텍', hlb: 'HLB', cash: '현금', land: '토지 (증평 미암리 300평)', garden: 'stay in 비밀의정원 (보증금+인테리어)', deposit: '내 집 보증금' };
  var shA = ss.getSheetByName(TAB_ASSET);
  if (shA.getLastRow() > 1) shA.getRange(2, 1, shA.getLastRow() - 1, 7).clearContent();
  // 페이지가 자산 목록을 보내면 그것을, 아니면 위 고정 목록을 쓴다
  var list = (st.assets && st.assets.length) ? st.assets.map(function (a) { return { id: a.id, name: a.name, cost: Number(a.cost) || 0, stock: a.kind === 'stock', symbol: a.symbol || '' }; })
    : Object.keys(COST).map(function (k) { return { id: k, name: LABEL[k], cost: COST[k], stock: !!STOCKS[k], symbol: STOCKS[k] ? STOCKS[k].symbol : '' }; });
  var rows = list.map(function (a) {
    var k = a.id, cost = a.cost;
    var q = (st.qty && Number(st.qty[k])) || '';
    var p = prices[k] && prices[k].price ? prices[k].price : '';
    var val;
    if (a.stock && p) val = q ? q * p : '';
    else val = (st.now && st.now[k] !== undefined && st.now[k] !== null) ? Number(st.now[k]) : '';
    return [k, a.symbol, cost, q, p, val, val === '' ? '' : val - cost, a.name];
  });
  if (rows.length) shA.getRange(2, 1, rows.length, 8).setValues(rows);
  shA.getRange(1, 8).setValue('이름').setFontWeight('bold').setBackground('#f0ebe3');

  // --- 설정 ---
  var shC = ss.getSheetByName(TAB_CONF);
  if (shC.getLastRow() > 1) shC.getRange(2, 1, shC.getLastRow() - 1, 2).clearContent();
  var conf = [
    ['weight', st.weight === null || st.weight === undefined ? '' : st.weight],
    ['weightStart', st.weightStart === null || st.weightStart === undefined ? '' : st.weightStart],
    ['langLog', JSON.stringify(st.langLog || {})],
    ['useStocks', st.useStocks ? 'Y' : ''],
    ['savedAt', new Date().toISOString()]
  ];
  // 위에서 따로 다루지 않은 항목(goals, works, order, texts, 앞으로 생길 것)은 통째로 JSON 으로 보관
  var SPECIAL = { todos: 1, qty: 1, now: 1, weight: 1, weightStart: 1, langLog: 1, useStocks: 1, savedAt: 1, showDone: 1 };
  Object.keys(st).forEach(function (k) {
    if (SPECIAL[k]) return;
    var v = st[k];
    if (v === undefined) return;
    var txt = JSON.stringify(v === null ? null : v);
    // 셀 한도(5만 자) 보호: 길면 여러 칸에 나눠 저장 (json:이름#0, json:이름#1 …)
    var CH = 40000;
    if (txt.length <= CH) conf.push(['json:' + k, txt]);
    else for (var i = 0; i * CH < txt.length; i++) conf.push(['json:' + k + '#' + i, txt.slice(i * CH, (i + 1) * CH)]);
  });
  shC.getRange(2, 1, conf.length, 2).setValues(conf);
}

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function dstr_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return null;
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
function num_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}
function jsonOr_(v, dflt) {
  try { return JSON.parse(v); } catch (x) { return dflt; }
}

/** 편집기에서 한 번 눌러 시트 생성 + 권한 승인을 미리 끝낼 때 사용 */
function 준비하기() {
  var ss = getSS_();
  initSheets_(ss);
  Logger.log('시트 주소: ' + ss.getUrl());
  Logger.log('시세: ' + JSON.stringify(getPrices_()));
}
