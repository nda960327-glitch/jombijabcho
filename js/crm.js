/* THE PEOPLE Times — 사람 관리(CRM) 코너.
   플래너 제목 옆 [👥 사람 관리] 단추로 연다. 데이터는 플래너와 같은 저장소(state)에 crm·crm_0… 으로 담겨
   구글 시트 동기화(PIN)를 그대로 탄다. 원칙: 세 가지 방문(입·손·발), 잘 듣기, 말 옮기지 않기, 도와준 일은 잊기,
   구체적인 칭찬, 이름·사정 기억하기, 자주 보기, 끝인상, 사과 먼저, 짝의 법칙(모두와 친해지려 애쓰지 않기).
   클릭 처리는 data-c* 속성만 쓴다 — planner.js 가 #ops 전체에서 data-a·data-id 등을 잡기 때문. */
(function () {
  'use strict';
  const W = window.MI, E = W.esc, $ = id => document.getElementById(id);
  const PART_MAX = 30000;
  const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

  /* ---------- 고정 값 ---------- */
  const CIRCLES = [
    { k: 'core', n: '핵심', c: 14, col: '#f8bbd0', d: '서로를 먼저 생각하는 사이 · 인생에 한둘이면 행복' },
    { k: 'close', n: '가까운', c: 30, col: '#ffcc80', d: '자주 보고 마음을 나누는 사이' },
    { k: 'wide', n: '넓은', c: 90, col: '#c5e1a5', d: '간간이 안부를 묻는 사이' },
    { k: 'work', n: '일·거래', c: 60, col: '#b3e5fc', d: '사업 파트너·고객·직원' },
    { k: 'care', n: '조심', c: 0, col: '#cfd8dc', d: '불편하거나 경쟁하는 사이 · 가까이 두되 싸우지 않기' }
  ];
  const CI = {}; CIRCLES.forEach(c => { CI[c.k] = c; });
  const BONDS = { virtue: '서로 위하는', pleasure: '즐거움(취미)', utility: '이익(일)' };
  const WAYS = {
    mouth: { n: '입', i: '📞', d: '전화·말·칭찬' },
    hand: { n: '손', i: '✉️', d: '편지·메시지·선물' },
    foot: { n: '발', i: '🚶', d: '찾아감·병문안' },
    meal: { n: '밥', i: '🍚', d: '함께 식사' },
    recv: { n: '받음', i: '📥', d: '상대가 먼저 연락' }
  };
  const WAY_KEYS = Object.keys(WAYS);
  const CADENCES = [[0, '정하지 않음'], [7, '1주'], [14, '2주'], [30, '1달'], [60, '2달'], [90, '3달'], [180, '6달'], [365, '1년']];

  // 오늘의 원칙 — 날마다 하나씩 돌아가며 맨 위에 보인다
  const RULES = [
    ['입의 방문', '전화 한 통, 칭찬 한마디로 용기를 주세요.'],
    ['손의 방문', '짧은 편지나 메시지로 진심을 전하세요.'],
    ['발의 방문', '아프거나 어려울 때 찾아가는 사람이 오래 기억돼요.'],
    ['잘 듣기', '마이크를 상대에게 넘기세요. 잘 듣는 것이 힘이에요.'],
    ['말 옮기지 않기', '들은 말은 내 안에서 끝내요. 그래야 사람들이 마음을 열어요.'],
    ['조금 더 돕기', '도울 일이 보이면 기대보다 조금 더 도와주세요.'],
    ['도운 일은 잊기', '돌려받을 기대를 하면 섭섭함이 생겨요. 그래서 여기엔 "준 것" 칸이 없어요.'],
    ['구체적인 칭찬', '"좋았어"보다 "그때 그 결정이 좋았어". 다른 사람에게 칭찬을 전하면 두 배가 돼요.'],
    ['이름 기억하기', '이름을 잊는 건 관심이 모자란 거예요. 가족 이름까지 적어 두세요.'],
    ['나를 낮추기', '자신 있는 사람은 자기를 주장하지 않고 남에게 맞춰요.'],
    ['도움 청하기', '도움을 청하는 건 상대의 능력을 높이 사는 일이에요. 갚을 준비만 해 두세요.'],
    ['빈틈 보이기', '완벽해 보이면 다가오기 어려워요. 가끔 허점을 보여 주세요.'],
    ['조언은 초대받았을 때만', '해결책부터 내밀면 귀를 닫아요. 먼저 들어 주세요.'],
    ['자주 보기', '자주 보면 정이 들어요. 못 만나면 좋아할 만한 글 하나라도 보내세요.'],
    ['끝은 격려로', '아쉬운 말을 했다면 꼭 격려로 마무리하세요. 시작보다 끝이 중요해요.'],
    ['뒷담화 멈추기', '"또 시작이야" 하고 화제를 바꾸세요. 만족은 짧고 후회는 길어요.'],
    ['함께 밥 먹고 싶은 사람', '먹고 마시며 나눈 이야기는 더 쉽게 풀려요.'],
    ['콤플렉스는 건드리지 않기', '"틀린 말 했어?"는 관계를 무너뜨려요.'],
    ['믿어 주기', '가능성을 믿어 주면 사람은 그 기대에 맞춰 자라요.'],
    ['적당한 거리', '말하고 싶지 않은 것까지 알려 하면 관심이 아니라 간섭이에요.'],
    ['사과 먼저', '"미안해"가 먼저, 해명은 그다음이에요.'],
    ['감사 찾기', '당연한 일에서도 고마운 점을 찾아 말해 주세요.'],
    ['먼저 주기', '씨앗은 시간이 걸려요. 거두려면 먼저 뿌려야 해요.'],
    ['끝인상', '첫인상은 못 바꿔도 끝인상은 언제든 바꿀 수 있어요. 만난 뒤 인사로 마무리하세요.'],
    ['노크의 법칙', '내가 먼저 문을 두드리고, 내 모습을 먼저 보여 주세요.'],
    ['거울의 법칙', '거울은 먼저 웃지 않아요. 내가 먼저 웃어요.'],
    ['짝의 법칙', '모두와 친해지려 애쓰지 마세요. 통하는 사람에게 마음을 쓰세요.'],
    ['그럴 만한 사정', '화가 나면 "그럴 만한 사정이 있겠지" 하고 그 사람 자리에 서 보세요.'],
    ['축하와 위로', '누구의 성공도 축하할 기회를 놓치지 말고, 슬픔엔 위로를 잊지 마세요.'],
    ['사람 부자', '상대를 존중하고 마음을 쓰면, 보고 싶어 찾아오는 사람이 많아져요.']
  ];
  // 원칙 화면 — 붙여 주신 글들을 짧게 묶은 것
  const BOOK = [
    ['세 가지 방문', ['입의 방문 — 전화·말로 부드럽게, 칭찬하고 용기 주기', '손의 방문 — 편지로 진솔한 마음 전하기', '발의 방문 — 병들거나 어려울 때 찾아가기']],
    ['인맥관리 7가지', ['잘 듣는다', '말을 옮기지 않는다', '남을 도와준다 — 기대보다 조금 더', '도와준 사실은 잊어버린다', '칭찬해 준다', '인간성 좋은 사람으로 기억된다', '나를 낮춘다']],
    ['친구를 만들고 지키는 법', ['도움을 요청한다', '작은 비밀을 나눈다', '허점을 보여 준다', '최고의 우정은 서로를 먼저 생각하는 사이 — 이익·즐거움으로 만난 사이는 그 이유가 끝나면 멀어진다']],
    ['적을 만들지 않고, 대하는 법', ['도와주고 자랑하지 않는다', '초대받지 않은 조언을 하지 않는다', '남에게 손해를 끼치지 않는다', '불편한 사람도 가까이 두고 무엇을 하는지 안다', '박멸하려 하지 않는다']],
    ['끌리는 사람', ['좋은 인상은 한 번의 잘못으로 무너진다', '때와 장소에 맞는 옷차림', '자주 보면 정든다 — 간간이 안부·읽을거리', '칭찬은 구체적으로, 제3자를 통해', '다름을 인정한다', '옳은 말보다 이해해 주는 사람', '뒷담화를 멈춘다', '함께 밥 먹고 싶은 사람', '콤플렉스는 건드리지 않는다', '믿어 준다', '너무 멀지도 가깝지도 않게', '사과 먼저, 변명은 나중에', '당연한 일에도 감사', '먼저 베푼다', '끝인상을 챙긴다', '기대 이상의 추가 서비스']],
    ['인간관계 5가지 법칙', ['노크 — 내가 먼저 문을 연다', '거울 — 내가 먼저 웃는다', '베풂 — 먼저 주고 그다음에 받는다', '짝 — 억지로 친해지려 하지 않는다', '낭만 — 이중 잣대를 버린다']],
    ['호감을 얻는 10가지', ['이름을 기억한다', '편안한 사람이 된다', '일 문제로 화내지 않는다', '겸손하다', '다른 사람 사정에 관심을 갖는다', '까탈 부리지 않는다', '오해는 진지하게 푼다', '내가 먼저 좋아한다', '성공은 축하, 슬픔엔 위로', '사람들에게 힘을 더한다']],
    ['화나고 힘들 때', ['"참자" — 첫 순간이 성패를 가른다', '"원래 그런 거"', '"웃긴다" — 문제를 단순하게', '"좋다, 까짓 것"', '"그럴 만한 사정이 있겠지"', '"내가 왜 너 때문에"', '"시간이 약"', '"새옹지마"', '즐거웠던 순간을 떠올린다', '눈을 감고 심호흡']],
    ['가치를 떨어뜨리는 말버릇', ['고민을 상습적으로 말하고 다니기', '생각해 보기도 전에 묻기', '이유 없이 맞장구치기', '"네"를 듣고도 계속 설득하기', '"죄송해요" 남용', '맡지 않은 일에 "제가 해 볼게요"', '반대 의견에 "왜요?" 되묻기']]
  ];

  /* ---------- 데이터 ---------- */
  let P = [], L = [];
  const p2 = n => (n < 10 ? '0' : '') + n;
  const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const pd = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diff = (a, b) => Math.round((pd(b) - pd(a)) / 86400000);   // b - a (일)
  const today = () => ymd(new Date());
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const lab = s => { const d = pd(s); return (d.getMonth() + 1) + '/' + d.getDate() + ' (' + WD[d.getDay()] + ')'; };
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const nid = k => k + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function fixP(r) {
    return {
      t: 'p', id: String(r.id), name: str(r.name, 40), nick: str(r.nick, 40),
      circle: CI[r.circle] ? r.circle : 'close', bond: BONDS[r.bond] ? r.bond : '',
      cadence: Number(r.cadence) >= 0 ? Number(r.cadence) : 30,
      tags: str(r.tags, 200), phone: str(r.phone, 40), bday: DAY.test(r.bday || '') ? r.bday : '',
      dates: Array.isArray(r.dates) ? r.dates.filter(x => x && x.l && DAY.test(x.d)).map(x => ({ l: str(x.l, 40), d: x.d, y: !!x.y })) : [],
      family: str(r.family, 500), likes: str(r.likes, 500), praise: str(r.praise, 1000), situation: str(r.situation, 1000),
      hard: !!r.hard, needs: str(r.needs, 1000), secret: str(r.secret, 2000), caution: str(r.caution, 500), memo: str(r.memo, 3000),
      thanks: Array.isArray(r.thanks) ? r.thanks.filter(x => x && x.tx).map(x => ({ id: String(x.id || nid('th')), tx: str(x.tx, 300), day: DAY.test(x.day || '') ? x.day : today(), done: !!x.done })) : [],
      arch: !!r.arch, created: Number(r.created) || Date.now(), updated: Number(r.updated) || Date.now()
    };
  }
  function fixL(r) {
    return {
      t: 'l', id: String(r.id), pid: String(r.pid), day: r.day, way: WAYS[r.way] ? r.way : 'mouth',
      memo: str(r.memo, 3000), fu: str(r.fu, 200), fuDay: DAY.test(r.fuDay || '') ? r.fuDay : '', fuDone: !!r.fuDone,
      created: Number(r.created) || Date.now()
    };
  }
  function unpack(st) {
    const m = (st && st.crm && typeof st.crm === 'object') ? st.crm : {};
    const n = Number(m.parts) || 0;
    let all = [];
    for (let i = 0; i < n; i++) { const p = st['crm_' + i]; if (Array.isArray(p)) all = all.concat(p); }
    P = all.filter(r => r && r.t === 'p' && r.id && r.name).map(fixP);
    const ids = new Set(P.map(p => p.id));
    L = all.filter(r => r && r.t === 'l' && r.id && ids.has(String(r.pid)) && DAY.test(String(r.day))).map(fixL);
  }
  // app.js 의 pack() 이 저장할 때마다 부른다
  W.packCrm = function (st) {
    const parts = []; let cur = [], len = 2;
    P.concat(L).forEach(it => {
      const l = JSON.stringify(it).length + 1;
      if (cur.length && len + l > PART_MAX) { parts.push(cur); cur = []; len = 2; }
      cur.push(it); len += l;
    });
    if (cur.length) parts.push(cur);
    Object.keys(st).forEach(k => { if (/^crm_\d+$/.test(k)) delete st[k]; });
    parts.forEach((p, i) => { st['crm_' + i] = p; });
    st.crm = { v: 1, parts: parts.length };
  };
  // 동기화로 내용이 바뀌면 app.js 가 부른다
  W.onCrmState = function (st) { unpack(st); if (on) draw(); badge(); };
  unpack(W.getState());
  const save = () => W.saveAll();

  const pById = id => P.find(p => p.id === id) || null;
  const logsOf = id => L.filter(l => l.pid === id).sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : b.created - a.created);
  function lastOf(id) { let m = ''; L.forEach(l => { if (l.pid === id && l.day > m) m = l.day; }); return m; }
  function dueOf(p) {
    if (!p.cadence || p.arch) return '';
    const base = lastOf(p.id) || ymd(new Date(p.created));
    return addD(base, p.cadence);
  }
  // 생일·기념일 — 오늘 기준 다음(또는 막 지난) 날
  function nextOf(d, yearly, t) {
    if (!yearly) return d;
    const y = +t.slice(0, 4), md = d.slice(4);
    let c = y + md; if (diff(t, c) < -3) c = (y + 1) + md;
    if (!DAY.test(c)) c = c.slice(0, 8) + '28';        // 2/29
    return c;
  }
  function upcoming(t, ahead) {
    const out = [];
    P.forEach(p => {
      if (p.arch) return;
      const add = (label, d, yearly, kind) => { const n = nextOf(d, yearly, t), k = diff(t, n); if (k >= -3 && k <= ahead) out.push({ p, label, day: n, k, kind }); };
      if (p.bday) add('생일', p.bday, true, 'bday');
      p.dates.forEach(x => add(x.l, x.d, x.y, 'date'));
    });
    return out.sort((a, b) => a.k - b.k);
  }
  const dname = p => p.nick ? p.name + ' (' + p.nick + ')' : p.name;
  const callName = p => p.nick || p.name;
  function ago(d, t) { if (!d) return '연락 기록 없음'; const k = diff(d, t); return k <= 0 ? '오늘 연락' : k === 1 ? '어제 연락' : k + '일 전 연락'; }
  function dueTxt(due, t) { if (!due) return ''; const k = diff(t, due); return k < 0 ? (-k) + '일 지남' : k === 0 ? '오늘' : 'D-' + k; }

  /* ---------- 화면 상태 ---------- */
  let on = false, tab = 'today', cf = '', q = '', sort = 'due', showArch = false, openId = '', secretOpen = false;
  const RT0 = { kick: '', h1: '' };

  function setMode(v) {
    on = v;
    const ops = $('ops'); ops.classList.toggle('crm-mode', v);
    $('crm-view').hidden = !v; $('crm-rt').hidden = !v;
    const kick = document.querySelector('.mast .kick'), h1 = document.querySelector('.mast h1');
    if (!RT0.kick) { RT0.kick = kick.innerHTML; RT0.h1 = h1.innerHTML; }
    kick.innerHTML = v ? 'MY HOME · 사람 관리' : RT0.kick;
    h1.innerHTML = v ? 'THE PEOPLE <i>Times</i>' : RT0.h1;
    document.title = (v ? 'THE PEOPLE Times' : 'THE WEEKLY Times') + ' · MY HOME';
    try { history.replaceState(null, '', location.pathname + (v ? '#crm' : '')); } catch (e) {}
    if (v) draw(); else if (W.redraw) W.redraw();
    badge(); window.scrollTo(0, 0);
  }
  // 플래너 쪽 단추에 '오늘 챙길 사람 수'
  function badge() {
    const b = $('crm-go'); if (!b) return;
    if (on) { b.innerHTML = '📰 주간 플래너로'; b.title = '주간 플래너로 돌아가기'; return; }
    const n = todayCount();
    b.innerHTML = '👥 사람 관리' + (n ? ' <b>' + n + '</b>' : '');
    b.title = n ? '오늘 챙길 사람 ' + n + '명' : '사람 관리 (CRM)';
  }
  function todayCount() {
    const t = today(), ids = new Set();
    P.forEach(p => { const d = dueOf(p); if (d && d <= t) ids.add(p.id); if (p.hard && !p.arch) ids.add(p.id); });
    upcoming(t, 3).forEach(u => ids.add(u.p.id));
    L.forEach(l => { if (l.fu && !l.fuDone && l.fuDay && l.fuDay <= t) ids.add(l.pid); });
    return ids.size;
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    const t = today(), act = P.filter(p => !p.arch);
    $('crm-rt').innerHTML = 'PEOPLE · ' + act.length + '명<b>' + (tab === 'today' ? '오늘 ' + lab(t) : tab === 'people' ? '사람들' : tab === 'log' ? '지난 기록' : '관계의 원칙') + '</b>';
    const T = [['today', '오늘 챙기기'], ['people', '사람들'], ['log', '기록'], ['book', '원칙']];
    let h = '<div class="bar crm-bar"><button type="button" class="ib" data-ca="back">◀ 플래너</button><span class="seg">'
      + T.map(x => '<button type="button" class="ib' + (tab === x[0] ? ' on' : '') + '" data-ct="' + x[0] + '">' + x[1] + '</button>').join('')
      + '</span><span class="sp"></span>'
      + '<input class="in srch" id="crm-q" type="search" placeholder="사람 찾기 (이름·별명·태그)" value="' + E(q) + '" aria-label="사람 찾기">'
      + '<button type="button" class="ib" data-ca="log">+ 연락 기록</button><button type="button" class="ib dk" data-ca="new">+ 사람</button></div>';
    if (tab === 'today') h += drawToday(t);
    else if (tab === 'people') h += drawPeople(t);
    else if (tab === 'log') h += drawLog(t);
    else h += drawBook();
    $('crm-view').innerHTML = h;
  }

  const pill = p => '<span class="pill" style="--oc:' + CI[p.circle].col + '">' + CI[p.circle].n + '</span>';
  const wayBtns = (p, ways) => (ways || ['mouth', 'hand', 'foot', 'meal']).map(w => '<button type="button" class="cw" data-cl="' + E(p.id) + '" data-cw="' + w + '" title="' + WAYS[w].n + '의 방문 — ' + WAYS[w].d + ' 기록">' + WAYS[w].i + '</button>').join('');
  const plannerBtn = (title, day) => '<button type="button" class="cw" data-cpl="' + E(title) + '" data-cpd="' + (day || '') + '" title="플래너 할 일로 넣기">🗓</button>';

  function drawToday(t) {
    if (!P.length) return '<div class="crm-empty"><p class="big">아직 적어 둔 사람이 없어요.</p><p>소중한 사람부터 한 명씩 — 이름, 가족 이름, 좋아하는 것, 요즘 사정을 적어 두면<br>연락할 때가 되면 여기서 알려 드려요.</p><p><button type="button" class="ib dk" data-ca="new">+ 첫 사람 적기</button></p>' + ruleCard(t) + '</div>';
    const act = P.filter(p => !p.arch);
    // i. 연락할 때
    const due = act.map(p => ({ p, due: dueOf(p) })).filter(x => x.due && diff(t, x.due) <= 3)
      .sort((a, b) => (diff(b.due, t) / (b.p.cadence || 1)) - (diff(a.due, t) / (a.p.cadence || 1)) || (a.due < b.due ? -1 : 1));
    // ii. 다가오는 날
    const up = upcoming(t, 21);
    // iii. 힘든 때
    const hard = act.filter(p => p.hard);
    // iv. 약속·끝인상, 감사
    const fus = L.filter(l => l.fu && !l.fuDone).sort((a, b) => (a.fuDay || '9') < (b.fuDay || '9') ? -1 : 1);
    const ths = []; act.forEach(p => p.thanks.forEach(x => { if (!x.done) ths.push({ p, x }); }));
    // v. 도울 수 있는 일
    const needs = act.filter(p => p.needs.trim());

    const mon = t.slice(0, 7), cnt = { mouth: 0, hand: 0, foot: 0, meal: 0, recv: 0 }, met = new Set();
    L.forEach(l => { if (l.day.slice(0, 7) === mon) { cnt[l.way]++; met.add(l.pid); } });
    const core = act.filter(p => p.circle === 'core' || p.circle === 'close');
    const coreMet = core.filter(p => met.has(p.id)).length;

    let h = ruleCard(t);
    h += '<div class="crm-tiles">'
      + tile(cnt.mouth, '📞 입의 방문', '이번 달') + tile(cnt.hand, '✉️ 손의 방문', '이번 달') + tile(cnt.foot + cnt.meal, '🚶 발·🍚 밥', '이번 달')
      + tile(coreMet + '<small>/' + core.length + '</small>', '핵심·가까운 사람', '이번 달 만난')
      + '</div>';
    h += '<div class="crm-grid">';
    h += sec('i.', '연락할 때가 됐어요', 'KEEP IN TOUCH', due.length, due.map(x => {
      const p = x.p, k = diff(t, x.due);
      return '<li class="' + (k < 0 ? 'late' : '') + '">' + nameBtn(p) + ' ' + pill(p)
        + '<span class="sub">' + E(ago(lastOf(p.id), t)) + ' · 주기 ' + cadTxt(p.cadence) + ' · <b>' + dueTxt(x.due, t) + '</b></span>'
        + (p.situation ? '<span class="nt">요즘: ' + E(p.situation.slice(0, 60)) + '</span>' : '')
        + '<span class="acts">' + wayBtns(p) + '<button type="button" class="cw" data-cmsg="' + E(p.id) + '" title="보낼 문구 만들기">💬</button>' + plannerBtn('📞 ' + p.name + ' 안부 연락', t) + '</span></li>';
    }), '연락이 밀린 사람이 없어요. 잘하고 있어요!');
    h += sec('ii.', '다가오는 날', 'CELEBRATE', up.length, up.map(u => {
      const p = u.p, k = u.k;
      return '<li>' + nameBtn(p) + ' <b class="dd' + (k <= 0 ? ' now' : '') + '">' + (k === 0 ? '오늘' : k < 0 ? (-k) + '일 전' : 'D-' + k) + '</b> '
        + E(u.label) + ' <span class="sub">' + lab(u.day) + (u.kind === 'bday' && p.bday && +p.bday.slice(0, 4) > 1900 ? ' · ' + (+u.day.slice(0, 4) - +p.bday.slice(0, 4)) + '번째' : '') + '</span>'
        + '<span class="acts"><button type="button" class="cw" data-cmsg="' + E(p.id) + '" data-ck="' + (k > 0 || u.kind === 'bday' ? 'congrats' : 'hi') + '" title="축하 문구">🎉</button>' + wayBtns(p, ['mouth', 'hand', 'foot']) + plannerBtn('🎉 ' + p.name + ' ' + u.label + ' 챙기기', k > 1 ? addD(u.day, -1) : t) + '</span></li>';
    }), '3주 안에 생일·기념일이 없어요.');
    h += sec('iii.', '힘든 때 — 발의 방문', 'BE THERE', hard.length, hard.map(p =>
      '<li>' + nameBtn(p) + ' ' + pill(p) + (p.situation ? '<span class="nt">' + E(p.situation.slice(0, 80)) + '</span>' : '')
      + '<span class="acts"><button type="button" class="cw" data-cmsg="' + E(p.id) + '" data-ck="comfort" title="위로 문구">🤍</button>' + wayBtns(p, ['foot', 'mouth', 'hand']) + plannerBtn('🚶 ' + p.name + ' 찾아가기', t) + '</span></li>'),
      '힘든 일을 겪는 사람으로 적어 둔 사람이 없어요. 사람 카드에서 "지금 힘든 때"를 켜 두면 여기 보여요.');
    h += sec('iv.', '약속한 일 · 끝인상', 'FOLLOW UP', fus.length, fus.map(l => {
      const p = pById(l.pid); if (!p) return '';
      const k = l.fuDay ? diff(t, l.fuDay) : null;
      return '<li class="' + (k !== null && k < 0 ? 'late' : '') + '"><button type="button" class="ck2" data-cfu="' + E(l.id) + '" title="했어요">○</button>' + nameBtn(p) + ' ' + E(l.fu)
        + (l.fuDay ? ' <span class="sub">' + (k < 0 ? (-k) + '일 지남' : k === 0 ? '오늘' : lab(l.fuDay)) + '</span>' : '')
        + '<span class="acts">' + plannerBtn(p.name + ' — ' + l.fu, l.fuDay && l.fuDay > t ? l.fuDay : t) + '</span></li>';
    }), '남은 약속이 없어요. 만난 뒤엔 "끝인상" 인사를 잊지 마세요.');
    h += sec('v.', '고마운 일 — 표현하기', 'SAY THANKS', ths.length, ths.map(o =>
      '<li><button type="button" class="ck2" data-cth="' + E(o.p.id) + '|' + E(o.x.id) + '" title="고맙다고 했어요">○</button>' + nameBtn(o.p) + ' ' + E(o.x.tx) + ' <span class="sub">' + lab(o.x.day) + '</span>'
      + '<span class="acts"><button type="button" class="cw" data-cmsg="' + E(o.p.id) + '" data-ck="thanks" title="감사 문구">🙏</button></span></li>'),
      '표현하지 못한 고마움이 없어요. 받은 도움은 사람 카드에 적어 두세요.');
    h += sec('vi.', '내가 도울 수 있는 일', 'GIVE FIRST', needs.length, needs.map(p =>
      '<li>' + nameBtn(p) + ' <span class="nt">' + E(p.needs.slice(0, 100)) + '</span></li>'),
      '사람들의 이야기를 듣다 보면 도울 일이 생겨요. 사람 카드 "도울 수 있는 일"에 적어 두세요.');
    h += '</div>';
    return h;
  }
  const cadTxt = c => { const f = CADENCES.find(x => x[0] === c); return f ? f[1] : c + '일'; };
  const tile = (n, l, s) => '<div class="tl2"><b>' + n + '</b><span>' + l + '</span><small>' + s + '</small></div>';
  const nameBtn = p => '<button type="button" class="nm2" data-cp="' + E(p.id) + '">' + E(dname(p)) + '</button>';
  function sec(no, title, en, n, rows, empty) {
    rows = rows.filter(Boolean);
    return '<section class="crm-sec"><h3><i>' + no + '</i> ' + title + ' <small>' + en + '</small><b>' + n + '</b></h3>'
      + (rows.length ? '<ul>' + rows.join('') + '</ul>' : '<p class="nm">' + empty + '</p>') + '</section>';
  }
  function ruleCard(t) {
    const i = Math.floor(pd(t).getTime() / 86400000) % RULES.length, r = RULES[(i + RULES.length) % RULES.length];
    return '<div class="crm-rule"><small>오늘의 원칙</small><b>' + E(r[0]) + '</b> — ' + E(r[1]) + ' <button type="button" class="lk" data-ct="book">원칙 모두 보기</button></div>';
  }

  function matchQ(p) {
    if (!q) return true;
    const k = q.toLowerCase(), has = v => String(v || '').toLowerCase().indexOf(k) >= 0;
    return has(p.name) || has(p.nick) || has(p.tags) || has(p.family) || has(p.likes) || has(p.situation) || has(p.memo);   // 비밀 칸은 찾지 않는다
  }
  function drawPeople(t) {
    const list = P.filter(p => (showArch ? p.arch : !p.arch) && (!cf || p.circle === cf) && matchQ(p));
    const cnt = {}; P.forEach(p => { if (!p.arch) cnt[p.circle] = (cnt[p.circle] || 0) + 1; });
    const nArch = P.filter(p => p.arch).length;
    const dueK = p => { const d = dueOf(p); return d ? diff(t, d) : 99999; };
    list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'ko')
      : sort === 'recent' ? (a, b) => (lastOf(b.id) || '').localeCompare(lastOf(a.id) || '')
        : (a, b) => dueK(a) - dueK(b) || a.name.localeCompare(b.name, 'ko'));
    let h = '<div class="bar2 crm-f"><button type="button" class="lgd' + (!cf ? ' on' : '') + '" data-cc="">전체 ' + P.filter(p => !p.arch).length + '</button>'
      + CIRCLES.map(c => '<button type="button" class="lgd' + (cf === c.k ? ' on' : cf ? ' off' : '') + '" data-cc="' + c.k + '" title="' + E(c.d) + '"><i style="background:' + c.col + '"></i>' + c.n + ' ' + (cnt[c.k] || 0) + '</button>').join('')
      + '<span class="tools"><select class="in" id="crm-sort" aria-label="정렬"><option value="due"' + (sort === 'due' ? ' selected' : '') + '>연락할 차례</option><option value="recent"' + (sort === 'recent' ? ' selected' : '') + '>최근 연락</option><option value="name"' + (sort === 'name' ? ' selected' : '') + '>이름</option></select>'
      + (nArch || showArch ? '<button type="button" class="tl" data-ca="arch">' + (showArch ? '← 지금 사람들' : '보관함 ' + nArch) + '</button>' : '') + '</span></div>';
    if (!list.length) return h + '<p class="ops-empty">' + (q ? "'" + E(q) + "' 찾은 사람이 없어요." : P.length ? '이 묶음에 사람이 없어요.' : '아직 적어 둔 사람이 없어요.') + '</p>';
    h += '<div class="crm-cards">' + list.map(p => {
      const last = lastOf(p.id), due = dueOf(p), k = due ? diff(t, due) : null;
      return '<div class="pc" data-cp="' + E(p.id) + '" style="--oc:' + CI[p.circle].col + '"><div class="pt"><b>' + E(p.name) + '</b>' + (p.nick ? '<span class="nk">' + E(p.nick) + '</span>' : '') + pill(p) + (p.hard ? '<span class="hd">힘든 때</span>' : '') + '</div>'
        + '<div class="pm">' + E(ago(last, t)) + (due ? ' · <span class="' + (k < 0 ? 'late' : k <= 3 ? 'soon' : '') + '">' + dueTxt(due, t) + '</span>' : '') + (p.bond ? ' · ' + BONDS[p.bond] : '') + '</div>'
        + (p.situation ? '<div class="ps">' + E(p.situation.slice(0, 70)) + '</div>' : '')
        + (p.tags ? '<div class="tg">' + p.tags.split(/[,\s]+/).filter(Boolean).slice(0, 6).map(x => '<span>#' + E(x.replace(/^#/, '')) + '</span>').join('') + '</div>' : '')
        + '<div class="acts">' + wayBtns(p) + '</div></div>';
    }).join('') + '</div>';
    return h;
  }
  function drawLog(t) {
    const list = L.filter(l => { const p = pById(l.pid); return p && matchQ(p); }).sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : b.created - a.created);
    if (!list.length) return '<p class="ops-empty">' + (q ? "'" + E(q) + "'의 기록이 없어요." : '아직 연락 기록이 없어요. 전화·메시지·만남 뒤에 [+ 연락 기록]으로 한 줄 남겨 보세요.') + '</p>';
    let h = '<div class="lst">', cur = '';
    list.slice(0, 400).forEach(l => {
      const p = pById(l.pid), m = l.day.slice(0, 7);
      if (m !== cur) { cur = m; const n = list.filter(x => x.day.slice(0, 7) === m).length; h += '<h4>' + (+m.slice(0, 4)) + '. ' + (+m.slice(5, 7)) + '월 <small>' + n + '번</small></h4>'; }
      h += '<div class="r" data-clog="' + E(l.id) + '"><span class="d">' + lab(l.day) + '</span><span class="k" title="' + WAYS[l.way].d + '">' + WAYS[l.way].i + ' ' + WAYS[l.way].n + '</span><span class="x"><b>' + E(dname(p)) + '</b>'
        + (l.memo ? '<div>' + E(l.memo) + '</div>' : '') + (l.fu ? '<div class="fu">' + (l.fuDone ? '✓ ' : '→ ') + E(l.fu) + (l.fuDay ? ' · ' + lab(l.fuDay) : '') + '</div>' : '') + '</span></div>';
    });
    return h + (list.length > 400 ? '<p class="m">최근 400개까지 보여요.</p>' : '') + '</div>';
  }
  function drawBook() {
    return '<div class="crm-book">' + BOOK.map((b, i) => '<section><h3><i>' + ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'][i] + '.</i> ' + E(b[0]) + '</h3><ol>' + b[1].map(x => '<li>' + E(x) + '</li>').join('') + '</ol></section>').join('')
      + '<section class="how"><h3>이 코너를 쓰는 법</h3><ol>'
      + '<li><b>사람 적기</b> — 이름·별명·가족 이름·좋아하는 것·생일을 적어요. 이름과 사정을 기억하는 것이 관심의 시작이에요.</li>'
      + '<li><b>묶음과 주기</b> — 핵심(2주)·가까운(1달)·넓은(3달)·일(2달). 주기가 지나면 "오늘 챙기기"에 떠요. "조심" 묶음은 주기 없이 기록만 — 모두와 친해지려 애쓰지 않아요.</li>'
      + '<li><b>세 가지 방문 기록</b> — 📞입·✉️손·🚶발·🍚밥 단추로 한 줄 남겨요. 만나고 나면 "끝인상" 인사가 자동으로 약속에 들어가요.</li>'
      + '<li><b>칭찬 거리·사정·도울 일</b> — 들은 것을 적어 두면 다음에 구체적으로 칭찬하고, 먼저 도울 수 있어요. 💬 단추가 그걸 넣어 문구를 만들어 줘요.</li>'
      + '<li><b>받은 도움</b>만 적어요 — 고맙다고 말했는지 챙기려고요. 내가 준 도움은 적지 않아요(잊어버리기).</li>'
      + '<li><b>🔒 비밀</b> — 털어놓은 이야기는 비밀 칸에. 눌러야 보이고, 찾기·인쇄에 나오지 않아요.</li>'
      + '<li><b>🗓</b> 단추는 그 일을 주간 플래너의 할 일로 넣어요.</li></ol></section></div>';
  }

  /* ---------- 사람 보기 창 ---------- */
  function openPerson(id) {
    const p = pById(id); if (!p) return;
    openId = id; secretOpen = false; drawPerson(); $('crm-dlg-p').hidden = false;
  }
  function drawPerson() {
    const p = pById(openId); if (!p) { $('crm-dlg-p').hidden = true; return; }
    const t = today(), last = lastOf(p.id), due = dueOf(p), logs = logsOf(p.id);
    const row = (k, v, cls) => v ? '<div class="kv' + (cls ? ' ' + cls : '') + '"><span>' + k + '</span><div>' + E(v) + '</div></div>' : '';
    const dates = [];
    if (p.bday) dates.push('생일 ' + (+p.bday.slice(5, 7)) + '/' + (+p.bday.slice(8, 10)) + (+p.bday.slice(0, 4) > 1900 ? ' (' + p.bday.slice(0, 4) + ')' : ''));
    p.dates.forEach(x => dates.push(x.l + ' ' + (x.y ? (+x.d.slice(5, 7)) + '/' + (+x.d.slice(8, 10)) + ' 매년' : lab(x.d) + ' ' + x.d.slice(0, 4))));
    let h = '<div class="ph"><div><h3>' + E(p.name) + (p.nick ? ' <small>' + E(p.nick) + '</small>' : '') + '</h3><div class="pm">' + pill(p) + (p.bond ? ' · ' + BONDS[p.bond] + ' 우정' : '') + ' · ' + E(ago(last, t)) + (due ? ' · 다음 연락 ' + dueTxt(due, t) : '') + (p.hard ? ' · <span class="hd">지금 힘든 때</span>' : '') + (p.arch ? ' · 보관함' : '') + '</div></div>'
      + '<button type="button" class="ib" data-cedit="' + E(p.id) + '">고치기</button></div>';
    h += '<div class="qa">' + WAY_KEYS.map(w => '<button type="button" class="ib" data-cl="' + E(p.id) + '" data-cw="' + w + '">' + WAYS[w].i + ' ' + WAYS[w].n + '</button>').join('')
      + '<button type="button" class="ib" data-cmsg="' + E(p.id) + '">💬 문구</button>' + plannerBtn('📞 ' + p.name + ' 연락', t).replace('class="cw"', 'class="ib"').replace('>🗓<', '>🗓 플래너<')
      + (p.phone ? '<a class="ib" href="tel:' + E(p.phone.replace(/[^\d+]/g, '')) + '">전화</a><a class="ib" href="sms:' + E(p.phone.replace(/[^\d+]/g, '')) + '">문자</a>' : '') + '</div>';
    h += '<div class="kvs">' + row('요즘 사정', p.situation) + row('칭찬 거리', p.praise) + row('도울 수 있는 일', p.needs) + row('가족', p.family) + row('좋아하는 것', p.likes)
      + row('중요한 날', dates.join(' · ')) + row('조심할 것', p.caution, 'warn') + row('전화', p.phone) + row('태그', p.tags) + row('메모', p.memo) + '</div>';
    if (p.secret) h += '<div class="sec2">' + (secretOpen ? '<div class="kv"><span>🔒 비밀</span><div>' + E(p.secret) + '</div></div><button type="button" class="lk" data-csec="0">가리기</button>'
      : '<button type="button" class="lk" data-csec="1">🔒 털어놓은 이야기 보기 — 옮기지 않기</button>') + '</div>';
    h += '<h4>받은 도움 · 고마운 일 <small>표현했는지 챙겨요</small></h4><ul class="ths">' + p.thanks.map(x => '<li class="' + (x.done ? 'dn' : '') + '"><button type="button" class="ck2" data-cth="' + E(p.id) + '|' + E(x.id) + '">' + (x.done ? '●' : '○') + '</button>' + E(x.tx) + ' <span class="sub">' + lab(x.day) + (x.done ? ' · 고맙다고 했어요' : '') + '</span><button type="button" class="lk x" data-cthx="' + E(x.id) + '" aria-label="지우기">×</button></li>').join('') + '</ul>'
      + '<div class="tr"><input type="text" class="in" id="crm-th-in" maxlength="300" placeholder="예: 이사할 때 차를 빌려줬다"><button type="button" class="ib" data-ca="thadd" style="flex:0 0 auto">+ 적기</button></div>';
    h += '<h4>연락 기록 <small>' + logs.length + '번</small></h4>' + (logs.length ? '<div class="lst">' + logs.slice(0, 60).map(l => '<div class="r" data-clog="' + E(l.id) + '"><span class="d">' + lab(l.day) + '</span><span class="k">' + WAYS[l.way].i + ' ' + WAYS[l.way].n + '</span><span class="x">' + (E(l.memo) || '<span class="m">메모 없음</span>') + (l.fu ? '<div class="fu">' + (l.fuDone ? '✓ ' : '→ ') + E(l.fu) + (l.fuDay ? ' · ' + lab(l.fuDay) : '') + '</div>' : '') + '</span></div>').join('') + '</div>' : '<p class="nm">아직 기록이 없어요.</p>');
    $('crm-p-body').innerHTML = h;
  }

  /* ---------- 사람 고치기 창 ---------- */
  let editId = '', fDates = [];
  function openEdit(id) {
    const p = id ? pById(id) : null; editId = p ? p.id : '';
    $('crm-e-h').textContent = p ? p.name + ' 고치기' : '사람 적기';
    const v = (k, x) => { $('crm-e-' + k).value = x || ''; };
    v('name', p && p.name); v('nick', p && p.nick); v('phone', p && p.phone); v('tags', p && p.tags); v('bday', p && p.bday);
    v('family', p && p.family); v('likes', p && p.likes); v('praise', p && p.praise); v('situation', p && p.situation); v('needs', p && p.needs);
    v('secret', p && p.secret); v('caution', p && p.caution); v('memo', p && p.memo);
    $('crm-e-circle').innerHTML = CIRCLES.map(c => '<option value="' + c.k + '"' + ((p ? p.circle : 'close') === c.k ? ' selected' : '') + '>' + c.n + ' — ' + c.d + '</option>').join('');
    $('crm-e-bond').innerHTML = '<option value="">모르겠음</option>' + Object.keys(BONDS).map(k => '<option value="' + k + '"' + (p && p.bond === k ? ' selected' : '') + '>' + BONDS[k] + '</option>').join('');
    $('crm-e-cad').innerHTML = CADENCES.map(c => '<option value="' + c[0] + '"' + ((p ? p.cadence : 30) === c[0] ? ' selected' : '') + '>' + c[1] + '</option>').join('')
      + (p && !CADENCES.some(c => c[0] === p.cadence) ? '<option value="' + p.cadence + '" selected>' + p.cadence + '일</option>' : '');
    $('crm-e-cad').dataset.touched = p ? '1' : '';
    $('crm-e-hard').checked = !!(p && p.hard);
    fDates = p ? p.dates.map(x => Object.assign({}, x)) : []; drawDates();
    $('crm-e-arch').hidden = !p; $('crm-e-arch').textContent = p && p.arch ? '보관함에서 꺼내기' : '보관함으로';
    $('crm-e-del').hidden = !p; $('crm-e-err').hidden = true;
    $('crm-dlg-e').hidden = false; setTimeout(() => $('crm-e-name').focus(), 50);
  }
  function drawDates() {
    $('crm-e-dates').innerHTML = fDates.map((x, i) => '<div class="tr dt"><input type="text" class="in" maxlength="40" value="' + E(x.l) + '" data-cdl="' + i + '" placeholder="무슨 날 (결혼기념일·수술·개업…)"><input type="date" class="in" value="' + x.d + '" data-cdd="' + i + '"><label class="ckl"><input type="checkbox" data-cdy="' + i + '"' + (x.y ? ' checked' : '') + '>매년</label><button type="button" class="lk x" data-cdx="' + i + '" aria-label="빼기">×</button></div>').join('');
  }
  function saveEdit() {
    const g = k => $('crm-e-' + k).value.trim();
    const name = g('name');
    if (!name) { const e = $('crm-e-err'); e.textContent = '이름을 적어 주세요.'; e.hidden = false; $('crm-e-name').focus(); return; }
    const dates = fDates.filter(x => x.l.trim() && DAY.test(x.d));
    const data = {
      name, nick: g('nick'), phone: g('phone'), tags: g('tags'), bday: DAY.test(g('bday')) ? g('bday') : '',
      circle: $('crm-e-circle').value, bond: $('crm-e-bond').value, cadence: Number($('crm-e-cad').value) || 0, hard: $('crm-e-hard').checked,
      family: g('family'), likes: g('likes'), praise: g('praise'), situation: g('situation'), needs: g('needs'), secret: g('secret'), caution: g('caution'), memo: g('memo'), dates
    };
    let p = editId ? pById(editId) : null;
    if (p) Object.assign(p, fixP(Object.assign({}, p, data, { updated: Date.now() })), { id: p.id });
    else { p = fixP(Object.assign({ id: nid('cp'), created: Date.now() }, data)); P.push(p); }
    if (editId) { const i = P.findIndex(x => x.id === editId); P[i] = p; }
    save(); $('crm-dlg-e').hidden = true; W.toast('저장했어요');
    draw(); badge();
    if (!editId) { openId = p.id; }
    if (openId === p.id) { drawPerson(); $('crm-dlg-p').hidden = false; }
  }

  /* ---------- 연락 기록 창 ---------- */
  let logId = '', logWay = 'mouth';
  function openLog(pid, way, id) {
    const l = id ? L.find(x => x.id === id) : null;
    if (!P.filter(p => !p.arch).length && !l) { W.toast('먼저 사람을 적어 주세요'); openEdit(''); return; }
    logId = l ? l.id : '';
    const sel = l ? l.pid : (pid || openId || '');
    const opts = P.filter(p => !p.arch || p.id === sel).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    $('crm-l-h').textContent = l ? '연락 기록 고치기' : '연락 기록';
    $('crm-l-p').innerHTML = (sel ? '' : '<option value="">누구와?</option>') + opts.map(p => '<option value="' + E(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + E(dname(p)) + '</option>').join('');
    $('crm-l-day').value = l ? l.day : today();
    setWay(l ? l.way : (way || 'mouth'));
    $('crm-l-memo').value = l ? l.memo : '';
    $('crm-l-fu').value = l ? l.fu : ''; $('crm-l-fud').value = l ? l.fuDay : '';
    $('crm-l-fdone').checked = !!(l && l.fuDone); $('crm-l-fdw').hidden = !l || !l.fu;
    $('crm-l-pl').checked = false;
    $('crm-l-del').hidden = !l; $('crm-l-err').hidden = true;
    fillSituation();
    $('crm-dlg-l').hidden = false; setTimeout(() => $('crm-l-memo').focus(), 50);
  }
  function setWay(w) {
    logWay = w;
    [].forEach.call(document.querySelectorAll('#crm-l-way [data-cwy]'), b => b.classList.toggle('on', b.getAttribute('data-cwy') === w));
    $('crm-l-wd').textContent = WAYS[w].d;
    // 만나고 온 날엔 끝인상 인사를 기본으로 (새 기록일 때만)
    if (!logId) $('crm-l-end').checked = (w === 'meal' || w === 'foot');
    $('crm-l-endw').hidden = !!logId;
  }
  function fillSituation() {
    const p = pById($('crm-l-p').value);
    $('crm-l-sit').value = p ? p.situation : ''; $('crm-l-hard').checked = !!(p && p.hard);
    $('crm-l-sitw').hidden = !p;
  }
  function saveLog() {
    const pid = $('crm-l-p').value, day = $('crm-l-day').value, err = m => { const e = $('crm-l-err'); e.textContent = m; e.hidden = false; };
    const p = pById(pid);
    if (!p) return err('누구와 연락했는지 골라 주세요.');
    if (!DAY.test(day)) return err('날짜를 골라 주세요.');
    let fu = $('crm-l-fu').value.trim(), fuDay = $('crm-l-fud').value;
    if (fuDay && !DAY.test(fuDay)) fuDay = '';
    const ends = !logId && $('crm-l-end').checked;
    if (ends && !fu) { fu = '만나서 고마웠다고 인사 남기기 (끝인상)'; if (!fuDay) fuDay = addD(day, 1); }
    let l = logId ? L.find(x => x.id === logId) : null;
    const data = { pid, day, way: logWay, memo: $('crm-l-memo').value.trim(), fu, fuDay, fuDone: logId ? $('crm-l-fdone').checked : false };
    if (l) Object.assign(l, fixL(Object.assign({}, l, data)));
    else { l = fixL(Object.assign({ id: nid('cl'), created: Date.now() }, data)); L.push(l); }
    // 근황 고치기
    const sit = $('crm-l-sit').value.trim(), hard = $('crm-l-hard').checked;
    if (sit !== p.situation || hard !== p.hard) { p.situation = sit.slice(0, 1000); p.hard = hard; p.updated = Date.now(); }
    save();
    const toPl = $('crm-l-pl').checked && l.fu;
    $('crm-dlg-l').hidden = true;
    W.toast(WAYS[l.way].i + ' ' + p.name + ' — 기록했어요');
    if (toPl) toPlanner(p.name + ' — ' + l.fu, l.fuDay && l.fuDay > today() ? l.fuDay : today());
    draw(); badge(); if (!$('crm-dlg-p').hidden) drawPerson();
  }

  /* ---------- 문구 만들기 창 ---------- */
  let msgPid = '', msgKind = 'hi', polite = false;
  const MSG_KINDS = [['hi', '안부'], ['praise', '칭찬'], ['thanks', '감사'], ['congrats', '축하'], ['comfort', '위로'], ['sorry', '사과'], ['meal', '밥 약속']];
  const MSG_TIPS = {
    hi: '자주 보면 정이 들어요. 그 사람이 좋아할 만한 글·사진 하나를 같이 보내도 좋아요.',
    praise: '구체적으로 — 무엇이 어떻게 좋았는지. 다른 사람에게 칭찬을 전하는 것도 효과가 커요.',
    thanks: '당연한 일에서도 고마운 점을 찾아 말해 주세요.',
    congrats: '누구의 성공도 축하할 기회를 놓치지 마세요.',
    comfort: '해결책이나 조언은 빼고, 곁에 있다는 것만. 할 수 있으면 찾아가세요(발의 방문).',
    sorry: '사과 먼저, 변명은 나중에. "내 탓이야 · 너를 존중해 · 우리 관계가 소중해".',
    meal: '함께 밥 먹고 싶은 사람이 되세요. 그 사람이 좋아하는 음식으로.'
  };
  function compose(p, kind) {
    const n = callName(p), j = polite;
    const end = (a, b) => j ? b : a;
    const sit = p.situation ? p.situation.split(/[\n.。]/)[0].trim().slice(0, 50) : '';
    const like = p.likes ? p.likes.split(/[,\n·]/)[0].trim() : '';
    const th = p.thanks.filter(x => !x.done).slice(-1)[0] || p.thanks.slice(-1)[0];
    const up = upcoming(today(), 30).filter(u => u.p.id === p.id)[0];
    const hi = j ? n + (/님$/.test(n) ? '' : '님') + ', 안녕하세요. ' : n + ', ';
    const praise = p.praise ? p.praise.replace(/[.。]$/, '') : '';
    switch (kind) {
      case 'praise': return hi + (praise ? end(praise + ' — 그거 정말 대단한 것 같아. 옆에서 보면서 늘 많이 배워.', praise + ' — 정말 대단하신 것 같아요. 옆에서 보면서 늘 많이 배웁니다.')
        : end('[무엇이 어떻게 좋았는지 구체적으로] 정말 좋았어. 고마워.', '[무엇이 어떻게 좋았는지 구체적으로] 정말 좋았어요. 감사합니다.'));
      case 'thanks': return hi + (th ? th.tx.replace(/[.。]$/, '') + end(' — 그때 정말 고마웠어. 덕분에 큰 힘이 됐어.', ' — 그때 정말 감사했어요. 덕분에 큰 힘이 됐습니다.') : end('늘 고마워. 말은 잘 안 했지만 많이 힘이 돼.', '늘 감사드려요. 말씀은 잘 못 드렸지만 큰 힘이 됩니다.'));
      case 'congrats': return hi + (up ? up.label + end(' 축하해! ', ' 축하드려요! ') : end('정말 축하해! ', '진심으로 축하드려요! ')) + end('네가 그동안 애쓴 걸 알아서 더 기뻐. 조만간 밥 한번 사 줄게.', '그동안 애쓰신 걸 알아서 더 기쁩니다. 조만간 식사 한번 대접할게요.');
      case 'comfort': return hi + end('요즘 많이 힘들지. 굳이 말 안 해도 괜찮아. 필요한 거 있으면 언제든 말해 줘. 조만간 얼굴 보러 갈게.', '요즘 많이 힘드시죠. 굳이 말씀 안 하셔도 괜찮아요. 필요한 게 있으면 언제든 말씀해 주세요. 조만간 찾아뵐게요.');
      case 'sorry': return hi + end('내가 잘못했어. 미안해. [무엇을 잘못했는지 한 줄] 네가 많이 서운했을 것 같아. 너랑 사이가 나한텐 정말 소중해.', '제가 잘못했습니다. 죄송해요. [무엇을 잘못했는지 한 줄] 많이 서운하셨을 것 같아요. 저에게 정말 소중한 관계입니다.');
      case 'meal': return hi + end('요즘 얼굴 못 본 지 오래됐다. ' + (like ? like + ' 먹으러 갈래? ' : '밥 한번 먹자. ') + '편한 날 알려 줘.', '뵌 지 오래됐네요. ' + (like ? like + ' 드시러 가실래요? ' : '식사 한번 같이 하시죠. ') + '편하신 날 알려 주세요.');
      default: return hi + end('잘 지내? 문득 생각나서 연락했어. ', '잘 지내시죠? 문득 생각나서 연락드려요. ') + (sit ? end('지난번에 얘기한 거(' + sit + ') 요즘은 좀 어때?', '지난번에 말씀하신 일(' + sit + ')은 요즘 어떠세요?') : end('요즘 어떻게 지내?', '요즘 어떻게 지내세요?')) + end(' 시간 되면 밥 한번 먹자.', ' 시간 되시면 식사 한번 해요.');
    }
  }
  function openMsg(pid, kind) {
    const p = pById(pid); if (!p) return;
    msgPid = pid; msgKind = kind || (p.hard ? 'comfort' : 'hi');
    polite = /[님씨]$|선생|교수|대표|사장|원장|팀장|부장|과장|이사/.test(p.nick || p.name) || p.circle === 'work';
    $('crm-m-h').textContent = '💬 ' + p.name + '에게 보낼 문구';
    drawMsg(); $('crm-dlg-m').hidden = false;
  }
  function drawMsg() {
    const p = pById(msgPid); if (!p) return;
    $('crm-m-k').innerHTML = MSG_KINDS.map(k => '<button type="button" class="ib' + (k[0] === msgKind ? ' on' : '') + '" data-cmk="' + k[0] + '">' + k[1] + '</button>').join('');
    $('crm-m-tone').innerHTML = '<button type="button" class="ib' + (!polite ? ' on' : '') + '" data-cmt="0">편하게</button><button type="button" class="ib' + (polite ? ' on' : '') + '" data-cmt="1">존댓말</button>';
    $('crm-m-tx').value = compose(p, msgKind);
    $('crm-m-tip').textContent = MSG_TIPS[msgKind];
    $('crm-m-sms').hidden = !p.phone;
    if (p.phone) $('crm-m-sms').href = 'sms:' + p.phone.replace(/[^\d+]/g, '') + '?body=' + encodeURIComponent($('crm-m-tx').value);
  }
  function copyText(tx) {
    const done = () => W.toast('복사했어요 — 붙여 넣어 보내세요');
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(tx).then(done, fallback); } else fallback();
    function fallback() { const a = $('crm-m-tx'); a.focus(); a.select(); try { document.execCommand('copy'); done(); } catch (e) { W.toast('복사가 안 돼요. 글을 길게 눌러 복사해 주세요'); } }
  }

  /* ---------- 플래너로 ---------- */
  function toPlanner(title, day) {
    W.post('/admin/opscal/save', { kind: 'task', day: day || today(), title: title.slice(0, 200), memo: '👥 사람 관리에서', owner: '', status: 'todo' })
      .then(j => { W.toast(j && j.ok ? '🗓 플래너 ' + lab(day || today()) + ' 할 일로 넣었어요' : '플래너에 넣지 못했어요'); });
  }

  /* ---------- 이벤트 ---------- */
  function wire() {
    $('crm-go').addEventListener('click', () => setMode(!on));
    $('crm-view').addEventListener('click', e => {
      const g = s => e.target.closest('[' + s + ']'), at = (el, s) => el.getAttribute(s);
      let el;
      if ((el = g('data-ca'))) {
        const k = at(el, 'data-ca');
        if (k === 'back') setMode(false);
        else if (k === 'new') openEdit('');
        else if (k === 'log') openLog('', 'mouth');
        else if (k === 'arch') { showArch = !showArch; draw(); }
        return;
      }
      if ((el = g('data-ct'))) { tab = at(el, 'data-ct'); draw(); window.scrollTo(0, document.querySelector('.paper').offsetTop); return; }
      if ((el = g('data-cc')) !== null && el) { cf = at(el, 'data-cc'); draw(); return; }
      if ((el = g('data-cw'))) { e.stopPropagation(); openLog(at(el, 'data-cl'), at(el, 'data-cw')); return; }
      if ((el = g('data-cmsg'))) { openMsg(at(el, 'data-cmsg'), at(el, 'data-ck')); return; }
      if ((el = g('data-cpl'))) { toPlanner(at(el, 'data-cpl'), at(el, 'data-cpd')); return; }
      if ((el = g('data-cfu'))) { const l = L.find(x => x.id === at(el, 'data-cfu')); if (l) { l.fuDone = true; save(); draw(); badge(); W.toast('했어요 ✓'); } return; }
      if ((el = g('data-cth'))) { thDone(at(el, 'data-cth')); return; }
      if ((el = g('data-clog'))) { openLog('', '', at(el, 'data-clog')); return; }
      if ((el = g('data-cp'))) { openPerson(at(el, 'data-cp')); return; }
    });
    $('crm-view').addEventListener('keydown', e => {
      if (e.target.id !== 'crm-q' || e.key !== 'Enter' || e.isComposing) return;
      q = e.target.value.trim(); if (q && tab !== 'log') tab = 'people'; draw();
      const x = $('crm-q'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); }
    });
    $('crm-view').addEventListener('search', e => { if (e.target.id === 'crm-q' && !e.target.value) { q = ''; draw(); } }, true);
    $('crm-view').addEventListener('change', e => { if (e.target.id === 'crm-sort') { sort = e.target.value; draw(); } });

    // 사람 보기 창
    $('crm-dlg-p').addEventListener('click', e => {
      const g = s => e.target.closest('[' + s + ']'), at = (el, s) => el.getAttribute(s);
      let el;
      if (e.target === $('crm-dlg-p') || g('data-cclose')) { $('crm-dlg-p').hidden = true; return; }
      if ((el = g('data-cedit'))) { openEdit(at(el, 'data-cedit')); return; }
      if ((el = g('data-cw'))) { openLog(at(el, 'data-cl'), at(el, 'data-cw')); return; }
      if ((el = g('data-cmsg'))) { openMsg(at(el, 'data-cmsg')); return; }
      if ((el = g('data-cpl'))) { toPlanner(at(el, 'data-cpl'), at(el, 'data-cpd')); return; }
      if ((el = g('data-csec'))) { secretOpen = at(el, 'data-csec') === '1'; drawPerson(); return; }
      if ((el = g('data-cth'))) { thDone(at(el, 'data-cth')); return; }
      if ((el = g('data-cthx'))) { const p = pById(openId); if (p && confirm('이 고마운 일을 지울까요?')) { p.thanks = p.thanks.filter(x => x.id !== at(el, 'data-cthx')); save(); drawPerson(); draw(); } return; }
      if ((el = g('data-clog'))) { openLog('', '', at(el, 'data-clog')); return; }
      if ((el = g('data-ca')) && at(el, 'data-ca') === 'thadd') thAdd();
    });
    $('crm-dlg-p').addEventListener('keydown', e => { if (e.target.id === 'crm-th-in' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); thAdd(); } });

    // 사람 고치기 창
    $('crm-e-f').addEventListener('submit', e => { e.preventDefault(); saveEdit(); });
    $('crm-e-circle').addEventListener('change', function () { if (!$('crm-e-cad').dataset.touched) $('crm-e-cad').value = String(CI[this.value].c); });
    $('crm-e-cad').addEventListener('change', function () { this.dataset.touched = '1'; });
    $('crm-e-dadd').addEventListener('click', () => { fDates.push({ l: '', d: today(), y: true }); drawDates(); const x = document.querySelector('[data-cdl="' + (fDates.length - 1) + '"]'); if (x) x.focus(); });
    $('crm-e-dates').addEventListener('input', e => {
      const t = e.target, i = +(t.getAttribute('data-cdl') || t.getAttribute('data-cdd') || t.getAttribute('data-cdy'));
      if (t.hasAttribute('data-cdl')) fDates[i].l = t.value; else if (t.hasAttribute('data-cdd')) fDates[i].d = t.value; else if (t.hasAttribute('data-cdy')) fDates[i].y = t.checked;
    });
    $('crm-e-dates').addEventListener('change', e => { const t = e.target; if (t.hasAttribute('data-cdy')) fDates[+t.getAttribute('data-cdy')].y = t.checked; });
    $('crm-e-dates').addEventListener('click', e => { const x = e.target.closest('[data-cdx]'); if (x) { fDates.splice(+x.getAttribute('data-cdx'), 1); drawDates(); } });
    $('crm-e-del').addEventListener('click', () => {
      const p = pById(editId); if (!p) return;
      if (!confirm("'" + p.name + "'과(와) 연락 기록 " + logsOf(p.id).length + '개를 모두 지울까요?\n지우면 되돌릴 수 없어요. (안 보이게만 하려면 [보관함으로])')) return;
      P = P.filter(x => x.id !== p.id); L = L.filter(x => x.pid !== p.id); save();
      $('crm-dlg-e').hidden = true; $('crm-dlg-p').hidden = true; draw(); badge(); W.toast('지웠어요');
    });
    $('crm-e-arch').addEventListener('click', () => {
      const p = pById(editId); if (!p) return;
      p.arch = !p.arch; p.updated = Date.now(); save();
      $('crm-dlg-e').hidden = true; draw(); badge(); drawPerson(); W.toast(p.arch ? '보관함으로 옮겼어요 — 연락 알림이 멈춰요' : '보관함에서 꺼냈어요');
    });

    // 연락 기록 창
    $('crm-l-way').innerHTML = WAY_KEYS.map(w => '<button type="button" class="ib" data-cwy="' + w + '">' + WAYS[w].i + ' ' + WAYS[w].n + '</button>').join('');
    $('crm-l-way').addEventListener('click', e => { const b = e.target.closest('[data-cwy]'); if (b) setWay(b.getAttribute('data-cwy')); });
    $('crm-l-p').addEventListener('change', fillSituation);
    $('crm-l-fu').addEventListener('input', function () { if (this.value.trim() && !$('crm-l-fud').value) $('crm-l-fud').value = addD($('crm-l-day').value || today(), 7); });
    $('crm-l-f').addEventListener('submit', e => { e.preventDefault(); saveLog(); });
    $('crm-l-del').addEventListener('click', () => {
      if (!logId || !confirm('이 연락 기록을 지울까요?')) return;
      L = L.filter(x => x.id !== logId); save(); $('crm-dlg-l').hidden = true; draw(); badge(); if (!$('crm-dlg-p').hidden) drawPerson(); W.toast('지웠어요');
    });

    // 문구 창
    $('crm-dlg-m').addEventListener('click', e => {
      const k = e.target.closest('[data-cmk]'), t = e.target.closest('[data-cmt]');
      if (k) { msgKind = k.getAttribute('data-cmk'); drawMsg(); }
      else if (t) { polite = t.getAttribute('data-cmt') === '1'; drawMsg(); }
    });
    $('crm-m-tx').addEventListener('input', () => { const p = pById(msgPid); if (p && p.phone) $('crm-m-sms').href = 'sms:' + p.phone.replace(/[^\d+]/g, '') + '?body=' + encodeURIComponent($('crm-m-tx').value); });
    $('crm-m-copy').addEventListener('click', () => copyText($('crm-m-tx').value));
    $('crm-m-log').addEventListener('click', () => { const pid = msgPid; $('crm-dlg-m').hidden = true; openLog(pid, 'hand'); $('crm-l-memo').value = MSG_KINDS.find(k => k[0] === msgKind)[1] + ' 메시지: ' + $('crm-m-tx').value.slice(0, 200); });

    // 창 닫기 (사람 보기 창 위에 뜬 창은 그 창만)
    [].forEach.call(document.querySelectorAll('.crm-dlg'), d => d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-cclose]')) d.hidden = true;
    }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ['crm-dlg-p', 'crm-dlg-e', 'crm-dlg-l', 'crm-dlg-m'].forEach(id => { $(id).hidden = true; }); });
  }
  function thAdd() {
    const p = pById(openId), i = $('crm-th-in'); if (!p || !i) return;
    const tx = i.value.trim(); if (!tx) { i.focus(); return; }
    p.thanks.push({ id: nid('th'), tx: tx.slice(0, 300), day: today(), done: false }); p.updated = Date.now();
    save(); drawPerson(); draw(); badge();
    const n = $('crm-th-in'); if (n) n.focus();
  }
  function thDone(v) {
    const a = v.split('|'), p = pById(a[0]); if (!p) return;
    const x = p.thanks.find(z => z.id === a[1]); if (!x) return;
    x.done = !x.done; p.updated = Date.now(); save(); draw(); badge(); if (!$('crm-dlg-p').hidden) drawPerson();
    if (x.done) W.toast('고마움을 표현했어요 🙏');
  }

  wire(); badge();
  if (location.hash === '#crm') setMode(true);
  setInterval(badge, 10 * 60 * 1000);
})();
