// 머니 v2 화면. 숫자는 모두 Core(core.js)가 기본 정보와 가계부에서 계산하고, 여기서는 보여주고 입력만 받음.
(function () {
  'use strict';
  const C = window.Core;
  const KEY = 'money.v2';
  const OLDKEY = 'money.v1';
  const VERSION = '2.2';

  // ---------- 저장 ----------
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  let migrated = false;
  let S; // 아래 도우미가 준비된 뒤 load()
  const view = { tab: 'home', P: null, cat: 'all' };
  function load() {
    const s = readJSON(KEY);
    const base = C.emptyState();
    if (s && s.v === 2) { for (const k of Object.keys(base)) if (s[k] == null) s[k] = base[k]; return s; }
    const old = readJSON(OLDKEY);
    if (old && old.version) { try { migrated = true; return fromV1(old); } catch (e) { migrated = false; } }
    return base;
  }
  function save() {
    S.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장 공간이 부족해요. 백업을 내보내 주세요'); }
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- 도우미 ----------
  const now = () => Date.now();
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => Math.round(Math.abs(n || 0)).toLocaleString('ko-KR');
  const wonS = (n) => (n < 0 ? '−' : '') + won(n);
  const md = (d) => (d ? Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) : '');
  const mName = (m) => Number(m.slice(5, 7)) + '월';
  const ymName = (m) => m.slice(2, 4) + '년 ' + Number(m.slice(5, 7)) + '월';
  const parseAmt = (s) => { const t = String(s == null ? '' : s); const n = Number(t.replace(/[^0-9]/g, '')); return (/^\s*[-−]/.test(t) ? -1 : 1) * (isFinite(n) ? n : 0); };
  const curP = () => C.periodOf(S, today());
  const acct = (id) => S.accounts.find((a) => a.id === id);
  const card = (id) => S.cards.find((c) => c.id === id);
  const refName = (r) => (!r ? '' : r.type === 'card' ? (card(r.id) || {}).name || '카드' : (acct(r.id) || {}).name || '계좌');
  const ago = (t) => {
    if (!t) return '확인 전';
    const d = C.daysBetween(new Date(t).toISOString().slice(0, 10), today());
    return d <= 0 ? '오늘 확인' : d === 1 ? '어제 확인' : d + '일 전 확인';
  };
  const dayText = (x) => x.dayText || (x.day ? x.day + '일' + (x.approx ? ' 전후' : '') : '');
  const amtText = (x, n) => (x.approx ? '약 ' : '') + won(n == null ? x.amount : n) + '원';

  // ---------- 아이콘 ----------
  const sv = (d, w) => '<svg width="' + (w || 20) + '" height="' + (w || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const I = {
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 22),
    plus: sv('<path d="M12 5v14M5 12h14"/>', 26),
    right: sv('<path d="m9 6 6 6-6 6"/>', 16),
    left: sv('<path d="m15 6-6 6 6 6"/>', 20),
    home: sv('<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>', 24),
    book: sv('<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/>', 24),
    flow: sv('<path d="M4 17.5 9 12l3.5 3.5L20 8"/><path d="M15 8h5v5"/>', 24),
    grid: sv('<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>', 24),
    rightL: sv('<path d="m9 6 6 6-6 6"/>', 20),
    close: sv('<path d="M6 6l12 12M18 6 6 18"/>', 22),
    check: sv('<path d="m5 12 5 5 9-10"/>', 16),
    scan: sv('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8"/>', 18),
  };

  // ---------- 알림·시트 ----------
  let toastT;
  function toast(msg) {
    const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600);
  }
  let sheet = null;
  function openSheet(def) { sheet = def; paintSheet(); document.getElementById('scrim').hidden = false; const el = document.getElementById('sheet'); el.hidden = false; requestAnimationFrame(() => el.classList.add('on')); }
  function paintSheet() {
    if (!sheet) return;
    const el = document.getElementById('sheet');
    const sc = el.querySelector('.sheet-body'); const top = sc ? sc.scrollTop : 0;
    el.innerHTML = '<div class="sheet-head"><b>' + esc(sheet.title) + '</b>' + (sheet.headRight ? sheet.headRight() : '') + '<button class="icon-btn" data-act="closeSheet" aria-label="닫기">' + I.close + '</button></div>' +
      '<div class="sheet-body">' + sheet.body() + '</div>' + (sheet.foot ? '<div class="sheet-foot">' + sheet.foot() + '</div>' : '');
    el.querySelector('.sheet-body').scrollTop = top;
    if (sheet.mount) sheet.mount(el);
    if (sheet.focus && !sheet.focused) { sheet.focused = true; const f = el.querySelector(sheet.focus); if (f) setTimeout(() => f.focus(), 60); }
  }
  function closeSheet() {
    const el = document.getElementById('sheet'); el.classList.remove('on');
    document.getElementById('scrim').hidden = true; el.hidden = true; sheet = null;
  }
  const val = (name) => { const el = document.querySelector('#sheet [name="' + name + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };

  // 입력 칸 하나
  const dayOpts = Array.from({ length: 31 }, (_, i) => [i + 1, i + 1 + '일']);
  function field(f) {
    const lab = '<span class="lab">' + esc(f.label) + (f.sub ? ' <em>' + esc(f.sub) + '</em>' : '') + '</span>';
    if (f.type === 'switch') return '<label class="switch"><span>' + esc(f.label) + (f.hint ? '<small>' + esc(f.hint) + '</small>' : '') + '</span><input type="checkbox" name="' + f.name + '"' + (f.value ? ' checked' : '') + '><i></i></label>';
    if (f.type === 'select') return '<label class="field">' + lab + '<select class="input" name="' + f.name + '">' + f.options.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(f.value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>';
    if (f.type === 'money') return '<label class="field">' + lab + '<div class="money"><input class="input" name="' + f.name + '" inputmode="numeric" data-live="money" value="' + (f.value != null && f.value !== '' ? won(f.value) : '') + '" placeholder="' + esc(f.ph || '0') + '"><span>원</span></div></label>';
    if (f.type === 'html') return f.html;
    return '<label class="field">' + lab + '<input class="input" name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value == null ? '' : f.value) + '" placeholder="' + esc(f.ph || '') + '"' + (f.type === 'number' ? ' inputmode="decimal"' : '') + '></label>';
  }
  function formSheet(title, fields, onSave, onDelete, note) {
    openSheet({
      title,
      body: () => fields.map(field).join('') + (note ? '<p class="hint">' + note + '</p>' : ''),
      foot: () => '<button class="btn" data-act="formSave">저장</button>' + (onDelete ? '<button class="btn ghost danger" data-act="formDelete">삭제</button>' : ''),
    });
    sheet.onSave = onSave; sheet.onDelete = onDelete;
  }
  const LINKED = '저장했어요 · 모든 탭에 반영됐어요';

  // ---------- 화면 틀 ----------
  // 아래 메뉴는 자주 보는 4개만. 나머지는 '전체' 안에서 들어감
  const NAV = [['home', '현황', 'home'], ['book', '가계부', 'book'], ['flow', '흐름', 'flow'], ['more', '전체', 'grid']];
  const SUB = ['fixed', 'loans', 'accounts', 'cards', 'income', 'debts', 'input', 'settings'];
  const TABS = NAV.concat(SUB.map((k) => [k]));
  const navOf = (t) => SUB.includes(t) ? 'more' : t;
  function render() {
    const app = document.getElementById('app');
    if (!S.accounts.length && !S.started) { app.innerHTML = welcome(); return; }
    if (!view.P) view.P = curP();
    const fn = { more: moreScreen, input: inputScreen, home: homeScreen, book: bookScreen, flow: flowScreen, fixed: fixedScreen, loans: loansScreen, accounts: accountsScreen, cards: cardsScreen, income: incomeScreen, debts: debtsScreen, settings: settingsScreen }[view.tab] || homeScreen;
    const st = C.status(S, today());
    const t0 = today(); const nc = st.nextCards[0];
    const mast = view.tab === 'home' ? homeMast(st) : '';
    const nv = navOf(view.tab);
    const link = ([k, l, ic]) => '<a href="#/' + k + '"' + (nv === k ? ' class="on" aria-current="page"' : '') + '>' + I[ic] + '<span>' + l + '</span></a>';
    app.innerHTML = mast + '<main class="screen' + (mast ? '' : ' top') + '">' + pageHead(st) + fn() + '</main>' +
      '<nav class="bnav" aria-label="메뉴"><div class="bnav-in">' + NAV.slice(0, 2).map(link).join('') +
      '<button class="bnav-add" data-act="addRecord" aria-label="가계부 기록">' + I.plus + '</button>' + NAV.slice(2).map(link).join('') + '</div></nav>';
    if (view.tab === 'input') inputPreview();
  }
  const head = (title, right, tab) => tab ? '<a class="sec-head" href="#/' + tab + '"><h2>' + title + '</h2><span>' + (right || '') + I.right + '</span></a>' : '<div class="sec-head"><h2>' + title + '</h2><span>' + (right || '') + '</span></div>';
  function periodBar() {
    const P = view.P; const r = C.periodRange(S, P);
    return '<div class="period"><button class="icon-btn" data-act="period" data-d="-1" aria-label="이전 달">' + I.left + '</button><div><b>' + mName(P) + ' 급여주기</b><span>' + md(r.start) + ' – ' + md(r.end) + (P === curP() ? ' · 지금' : '') + '</span></div><button class="icon-btn" data-act="period" data-d="1" aria-label="다음 달">' + I.rightL + '</button></div>';
  }
  const row = (o) => '<' + (o.act ? 'button' : 'div') + ' class="row' + (o.cls ? ' ' + o.cls : '') + '"' + (o.act ? ' data-act="' + o.act + '"' + Object.entries(o.data || {}).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('') : '') + '>' +
    (o.lead != null ? '<span class="lead">' + o.lead + '</span>' : '') +
    '<span class="grow"><span class="t">' + o.t + '</span>' + (o.s ? '<span class="s">' + o.s + '</span>' : '') + (o.extra || '') + '</span>' +
    '<span class="end"><span class="amt' + (o.amtCls ? ' ' + o.amtCls : '') + '">' + o.amt + '</span>' + (o.end ? '<span class="s">' + o.end + '</span>' : '') + '</span>' + (o.act ? '<span class="chev">' + I.right + '</span>' : '') + '</' + (o.act ? 'button' : 'div') + '>';
  const badge = (t, c) => ' <span class="badge' + (c ? ' ' + c : '') + '">' + esc(t) + '</span>';
  const meter = (r) => '<span class="meter"><i style="width:' + Math.min(100, Math.max(0, r * 100)) + '%"' + (r > 0.9 ? ' class="hot"' : '') + '></i></span>';

  // 탭마다 제목 + 확인 날짜 배지 + 한 줄 설명 (이전 대시보드처럼)
  const shortDate = (ms) => { if (!ms) return ''; const d = new Date(ms); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; };
  function checkBadge() {
    const ca = Math.max(0, ...S.cards.map((c) => Math.max(0, ...Object.values(c.app || {}).map((x) => x.at || 0))));
    const aa = Math.max(0, ...S.accounts.map((a) => a.balanceAt || 0));
    return [ca ? shortDate(ca) + ' 카드' : '', aa ? shortDate(aa) + ' 계좌 확인' : ''].filter(Boolean).join(' · ');
  }
  function pageHead() {
    const H = {
      input: ['데이터 입력', '', '여기만 고치면 다른 탭의 계산이 모두 같이 바뀌어요.'],
      home: null,
      book: ['가계부', '', '쓴 돈을 적으면 잔액·카드값·월간 흐름에 바로 들어가요.'],
      flow: ['월간 흐름', '급여일 기준', '입금은 위에, 출금은 아래 날짜순이에요. 항목을 누르면 그 달만 바꿀 수 있어요.'],
      fixed: ['구독·고정비', '', '통장 출금과 카드 청구를 나눠서 보여줘요.'],
      loans: ['대출·예상 이자', checkBadge().split(' · ').pop() || '', '납입일 순서로 정리하고, 같은 은행은 함께 묶었어요.'],
      accounts: ['계좌 현황', checkBadge().split(' · ').pop() || '', '통장별 잔액·남은 한도와 전체 사용 가능 금액이에요.'],
      cards: ['카드·할부', '', '카드앱 현재액에 아직 안 보이는 것만 더해요.'],
      income: ['수입 항목', '', '해당 월 흐름에 들어가는 수입을 모아서 보여줘요.'],
      debts: ['갚을·받을 돈', '', '임시출금, 빌린 돈, 받을 돈을 따로 관리해요.'],
      settings: ['설정', '', ''],
      more: ['전체', '', '매달 나가는 돈, 내 돈, 관리 메뉴를 모아 뒀어요.'],
    }[view.tab];
    if (!H) return '';
    if (!H) return '';
    const back = SUB.includes(view.tab) ? '<a class="back" href="#/more">' + I.left + '전체</a>' : '';
    return '<div class="page-head">' + back + '<div class="ph-row"><h2>' + H[0] + '</h2>' + (H[1] ? '<span class="chk">' + esc(H[1]) + '</span>' : '') + '</div>' + (H[2] ? '<p>' + H[2] + '</p>' : '') + '</div>';
  }
  const BANK = [[/국민|KB/i, 'kb', '국민'], [/신한/, 'sh', '신한'], [/하나/, 'hn', '하나'], [/토스/, 'ts', '토스'], [/우리/, 'wr', '우리'], [/농협|NH/i, 'nh', '농협'], [/카카오/, 'kk', '카카오'], [/삼성/, 'ss', '삼성'], [/현대/, 'hd', '현대'], [/롯데/, 'lt', '롯데']];
  const bankChip = (name) => { const b = BANK.find((x) => x[0].test(name || '')); return '<span class="bank ' + (b ? b[1] : 'etc') + '">' + esc(b ? b[2] : (name || '').slice(0, 2)) + '</span>'; };

  // ===== 이번 급여로 버티면 (이전 대시보드의 전체자금예상) =====
  function hero(link) {
    const st = C.status(S, today());
    const ahead = st.daysLeft <= 10;
    const P = ahead ? C.addMonths(st.P, 1) : st.P;
    const f = C.flow(S, P, today());
    const short = f.left < 0; const L = f.lines;
    const lines = [['수입', L.income, 'in'], ['카드값', -L.card], ['통장 고정비', -L.fixed], ['대출·이자', -L.loan], ['가계부 통장 지출', -L.living], ['정산·기타', -L.other]].filter((x, i) => i < 4 || x[1]);
    return '<' + (link ? 'a href="#/flow"' : 'section') + ' class="hero tint ' + (short ? 'red' : 'amber') + '"><span class="hero-label">전체자금예상 <span class="pill-s">' + (short ? '부족' : '여유') + '</span></span>' +
      '<span class="hero-num">' + (short ? '− ' : '+ ') + won(f.left) + '원</span><span class="hero-sub">' + (ahead ? md(C.addDays(st.end, 1)) + ' 급여로 ' + mName(P) + ' 버티면' : mName(P) + ' 수입과 전체 지출 기준') + '</span>' +
      '<div class="hero-lines">' + lines.map(([l, n, c]) => '<div><span>' + l + '</span><b' + (c ? ' class="' + c + '"' : '') + '>' + (n > 0 ? '+' : n < 0 ? '−' : '') + won(n) + '</b></div>').join('') + '</div></' + (link ? 'a' : 'section') + '>';
  }

  // ===== 현황: 머리 카드 (지금 쓸 수 있는 돈) =====
  function homeMast(st) {
    const t = today();
    const ahead = st.daysLeft <= 10; const P = ahead ? C.addMonths(st.P, 1) : st.P;
    const f = C.flow(S, P, t); const short = f.left < 0;
    return '<header class="masthead"><div class="mast home"><div class="mast-top"><div><p class="mast-lab">지금 쓸 수 있는 돈</p><b class="mast-num">' + wonS(st.spendable) + '<em>원</em></b></div>' +
      '<a class="mast-btn" href="#/settings" aria-label="설정">' + I.gear + '</a></div>' +
      '<p class="mast-sub">' + mName(st.P) + ' 급여주기 · ' + md(st.start) + ' – ' + md(st.end) + ' · <b>' + st.daysLeft + '일 남음</b></p>' +
      '<div class="mast-chips"><a href="#/flow" class="' + (short ? 'bad' : 'good') + '"><span>' + (ahead ? mName(P) + ' 급여로' : '이번 급여로') + '</span><b>' + (short ? '부족 −' : '여유 +') + won(f.left) + '</b></a>' +
      '<a href="#/flow" class="' + (st.forecast < 0 ? 'bad' : '') + '"><span>' + md(st.end) + ' 예상 잔액</span><b>' + wonS(st.forecast) + '</b></a></div></div></header>';
  }

  // ===== 현황 =====
  function homeScreen() {
    const t = today(); const st = C.status(S, t);
    let h = '';

    // 1. 지금 확인할 것: 놓치면 손해 보는 것만
    const todo = [];
    const aa = Math.max(0, ...S.accounts.map((a) => a.balanceAt || 0));
    const stale = aa ? C.daysBetween(new Date(aa).toISOString().slice(0, 10), t) : 99;
    if (S.accounts.length && stale >= 3) todo.push({ act: 'href', href: '#/input', ic: 'blue', t: '계좌 잔액 확인한 지 ' + (aa ? stale + '일' : '오래') + ' 됐어요', s: '은행앱 숫자를 다시 적으면 예상이 정확해져요' });
    st.nextCards.forEach((b) => { if (!b.app) todo.push({ act: 'cardApp', data: { id: b.cardId, m: b.payMonth }, ic: 'indigo', t: esc(b.card.name) + ' 결제 예정액을 아직 안 봤어요', s: md(b.payDate) + ' 출금 · 카드앱 숫자를 적어 주세요' }); else if (b.pending.length) todo.push({ act: 'cardApp', data: { id: b.cardId, m: b.payMonth }, ic: 'indigo', t: esc(b.card.name) + '에 아직 안 보이는 것 ' + b.pending.length + '건', s: '카드앱에 떴으면 반영됨으로 표시해요' }); });
    soonList().forEach((x) => { const n = daysTo(x.info.contractEnd); todo.push({ act: 'fixedInfo', data: { id: x.id }, ic: 'amber', t: esc(x.name) + ' 약정이 ' + (n < 0 ? '끝났어요' : n + '일 뒤 끝나요'), s: n < 0 ? '요금이 올랐는지 확인해요' : '바꿀지, 이어갈지 정해요' }); });
    const soon3 = st.upcoming.filter((x) => !x.skip && !x.done && x.dir === 'out' && C.daysBetween(t, x.date) <= 3);
    if (soon3.length) todo.push({ act: 'href', href: '#/flow', ic: 'red', t: '3일 안에 나갈 돈 ' + soon3.length + '건, ' + won(soon3.reduce((a, x) => a + x.amount, 0)) + '원', s: soon3.map((x) => esc(x.name)).slice(0, 3).join(', ') + (soon3.length > 3 ? ' 외' : '') });
    if (todo.length) h += '<section class="card todo">' + head('지금 확인할 것', todo.length + '건') + todo.map((x) => '<' + (x.act === 'href' ? 'a href="' + x.href + '"' : 'button data-act="' + x.act + '"' + Object.entries(x.data || {}).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('')) + ' class="row"><span class="lead"><span class="dot ' + x.ic + '"></span></span><span class="grow"><span class="t">' + x.t + '</span><span class="s">' + x.s + '</span></span><span class="chev">' + I.right + '</span></' + (x.act === 'href' ? 'a' : 'button') + '>').join('') + '</section>';

    // 2. 이번 주기 한눈에: 수입 / 나갈 돈 / 남는 돈 + 진행 막대
    const f = C.flow(S, st.P, t); const L = f.lines;
    const out = L.card + L.fixed + L.loan + L.living + L.other;
    const elapsed = Math.min(1, Math.max(0, C.daysBetween(st.start, t) / Math.max(1, C.daysBetween(st.start, st.end))));
    const done = f.schedule.filter((x) => !x.skip && x.dir === 'out' && x.date <= t).reduce((a, x) => a + x.amount, 0) + L.living;
    h += '<a class="card period-card" href="#/flow">' + head(mName(st.P) + ' 급여주기', st.daysLeft + '일 남음' + I.right) +
      '<div class="trio"><div><span>수입</span><b class="in">' + won(L.income) + '</b></div><div><span>나갈 돈</span><b>' + won(out) + '</b></div><div><span>남는 돈</span><b class="' + (f.left < 0 ? 'warn' : '') + '">' + wonS(f.left) + '</b></div></div>' +
      '<div class="prog"><i style="width:' + Math.round(100 * Math.min(1, out ? done / out : 0)) + '%"></i><u style="left:' + Math.round(elapsed * 100) + '%"></u></div><div class="prog-lab"><span>나간 돈 ' + won(done) + '</span><span>오늘 · ' + Math.round(elapsed * 100) + '% 지남</span></div></a>';

    // 3. 다가오는 입출금 3건
    const up = st.upcoming.filter((x) => !x.skip && !x.done);
    if (up.length) h += '<section class="card">' + head('다가오는 입출금', up.length + '건 · −' + won(st.outflow), 'flow') + up.slice(0, 3).map((x) => schedRow(x, st.P)).join('') + '</section>';

    // 4. 내 돈: 계좌·카드값·대출 한 줄씩
    const nc = st.nextCards[0]; const Ls = C.loanSummary(S, t);
    const mine = (href, ic, lab, t1, amt, cls) => '<a class="row" href="' + href + '"><span class="lead"><span class="m-ic ' + ic + '">' + lab + '</span></span><span class="grow"><span class="t">' + t1[0] + '</span><span class="s">' + t1[1] + '</span></span><span class="end"><span class="amt' + (cls ? ' ' + cls : '') + '">' + amt + '</span></span><span class="chev">' + I.right + '</span></a>';
    h += '<section class="card">' + head('내 돈', '') +
      mine('#/accounts', 'teal', '계', ['계좌 ' + S.accounts.length + '개', aa ? shortDate(aa) + ' 확인 · 마통 남은 한도 포함' : '잔액을 아직 안 적었어요'], wonS(st.spendable)) +
      (nc ? mine('#/cards', 'indigo', '카', [mName(nc.payMonth) + ' 카드값', md(nc.payDate) + ' 출금 · ' + st.nextCards.map((b) => esc(b.card.name)).join(' + ')], '−' + won(st.nextCardTotal)) : '') +
      (Ls.total ? mine('#/loans', 'red', '대', ['대출 남은 돈', '매달 내 부담 ' + won(Ls.monthlySelf) + '원' + (Ls.order[0] ? ' · 먼저 갚을 것 ' + esc(Ls.order[0].name) : '')], won(Ls.total)) : '') +
      (st.local ? mine('#/accounts', 'green', '지', ['지역화폐', '쓸 수 있는 돈과 따로 세요'], won(st.local)) : '') + '</section>';

    // 5. 이번 달 가계부
    const cats = Object.entries(f.byCat).sort((a, b) => b[1] - a[1]);
    const recent = S.records.filter((r) => r.type !== 'settle').slice().sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1)).slice(0, 3);
    h += '<section class="card">' + head('이번 달 가계부', won(f.spent) + '원', 'book');
    if (cats.length) { const mx = cats[0][1]; h += '<div class="catbars">' + cats.slice(0, 3).map(([c, v]) => '<div><span>' + esc(c) + '</span><span class="bar"><i style="width:' + (v / mx) * 100 + '%"></i></span><b>' + won(v) + '</b></div>').join('') + '</div>'; }
    h += recent.length ? recent.map(recRow).join('') : '<button class="empty-cta" data-act="addRecord">오늘 쓴 돈을 기록해 보세요 ' + I.right + '</button>';
    h += '</section>';

    // 6. 갚을·받을 돈
    const open = st.debts.filter((x) => x.left > 0);
    if (open.length) h += '<section class="card">' + head('갚을·받을 돈', won(st.payable) + '원', 'debts') + open.map(debtRow).join('') + '</section>';
    return h;
  }
  function acctRow(x) {
    const a = x.account; const od = a.type === 'overdraft';
    const used = od ? Math.max(0, -x.balance) : 0;
    return row({ act: 'balance', data: { id: a.id }, lead: bankChip(a.name), t: esc(a.name) + (a.include === false ? badge('합계 제외', 'gray') : ''), s: od ? won(used) + ' / ' + won(a.limit) + ' 사용' : ago(a.balanceAt), extra: od && a.limit ? meter(used / a.limit) : '', amt: wonS(x.available), end: od ? '남은 한도' : '' });
  }
  function recRow(r) {
    const plus = r.type === 'income' || (r.type === 'settle' && r.to);
    const isT = r.type === 'transfer';
    return row({ act: 'editRecord', data: { id: r.id }, t: esc(isT ? refName(r.from) + ' → ' + refName(r.to) : r.memo || r.cat || '기록'), s: md(r.date) + (r.cat && r.memo ? ' · ' + esc(r.cat) : '') + ' · ' + esc(isT ? '이체' : refName(r.from || r.to)), amt: isT ? won(r.amount) : (plus ? '+' : '') + won(r.amount), amtCls: plus ? 'in' : isT ? 'muted' : '' });
  }
  function schedRow(x, P) {
    const st = x.skip ? badge('건너뜀', 'gray') : x.edited ? badge('이번 달만', 'blue') : '';
    return row({ act: 'sched', data: { k: x.key, p: P }, cls: x.skip ? 'off' : '', lead: '<span class="date">' + md(x.date) + '</span>', t: esc(x.name) + st, s: esc((acct(x.acct) || {}).name || '') + (x.done ? ' · 완료' : ''), amt: (x.dir === 'in' ? '+' : '') + (x.approx && !x.edited ? '약 ' : '') + won(x.amount), amtCls: x.dir === 'in' ? 'in' : '' });
  }
  function debtRow(x) {
    const d = x.debt;
    return row({ act: 'debt', data: { id: d.id }, t: esc(d.who) + (x.done ? badge('완료', 'gray') : x.settled ? badge('일부 정산', 'blue') : ''), s: esc(d.reason || '') + (d.due ? ' · ' + md(d.due) + ' 예정' : ''), amt: (d.dir === 'recv' ? '+' : '') + won(x.left), amtCls: d.dir === 'recv' ? 'in' : '' });
  }

  // ===== 입력 (이전 대시보드의 데이터 입력: 여기만 고치면 모든 탭에 반영) =====
  function inputScreen() {
    const t = today(); const P = curP(); const st = C.status(S, t);
    const sch = C.schedule(S, P, t).filter((x) => x.dir === 'in');
    let h = '<div class="intro"><b>데이터 입력</b><span>여기만 고치면 다른 탭이 모두 같이 바뀌어요.</span></div>';
    h += '<section class="card">' + head(mName(P) + ' 급여주기 수입', '실제로 들어온 금액') + (sch.length ? sch.map((x) => inRow('in:' + x.key, x.name, x.amount, md(x.date) + ' · 기본 ' + won(x.planned) + '원')).join('') : '<p class="hint">정기 수입이 없어요. 수입 탭에서 급여를 추가해 주세요.</p>') + '</section>';
    h += '<section class="card">' + head('카드앱 현재액', '결제 예정 금액 그대로') + (st.nextCards.length ? st.nextCards.map((b) => inRow('card:' + b.cardId + ':' + b.payMonth, b.card.name + ' · ' + mName(b.payMonth) + ' 결제', b.app ? b.app.amount : '', b.app ? ago(b.app.at) : '아직 안 적었어요')).join('') : '<p class="hint">카드가 없어요.</p>') + '</section>';
    const pend = [];
    st.nextCards.forEach((b) => b.pending.forEach((it) => pend.push({ b, it })));
    if (pend.length) h += '<section class="card">' + head('카드앱에 아직 안 보이는 것', '보이면 체크') + '<p class="hint">카드앱 금액을 적으면 그 전 날짜 것은 들어 있다고 보고 빠져요.</p>' + pend.map(({ b, it }) => '<label class="row check"><input type="checkbox" data-k="refl:' + esc(it.key) + '"><span class="grow"><span class="t">' + esc(it.name) + '</span><span class="s">' + esc(b.card.name) + (it.date ? ' · ' + md(it.date) : '') + (it.src === 'record' ? ' · 가계부' : ' · 고정비') + '</span></span><span class="amt">' + won(it.amount) + '</span></label>').join('') + '<button class="link-btn" data-act="addRecord" data-card="1">+ 카드앱에 아직 없는 사용 추가</button></section>';
    h += '<section class="card">' + head('계좌 현재잔액', '은행앱 숫자 그대로') + st.accts.map((x) => {
      const a = x.account; const od = a.type === 'overdraft';
      return inRow('bal:' + a.id, a.name + (od ? ' · 사용 중인 금액' : ''), od ? Math.max(0, -x.balance) : x.balance, od ? '한도 ' + won(a.limit) + ' · 남은 한도 ' + wonS(x.available) + ' · ' + ago(a.balanceAt) : ago(a.balanceAt));
    }).join('') + '</section>';
    h += '<section class="card">' + head('일회성 입출금', '') + '<p class="hint">가족 정산, 수당처럼 한 번만 오간 돈은 가계부에 적으면 흐름과 잔액에 같이 들어가요.</p><button class="btn soft" data-act="addRecord">가계부에 기록하기</button></section>';
    h += '<div class="input-bar"><div id="inPreview"></div><div class="grid2"><button class="btn ghost" data-act="inputReset">변경 취소</button><button class="btn" data-act="inputSave">저장하고 반영</button></div></div>';
    return h;
  }
  const inRow = (k, label, v, sub) => '<label class="in-row"><span class="grow"><span class="t">' + esc(label) + '</span><span class="s">' + esc(sub || '') + '</span></span><span class="money"><input class="input" inputmode="numeric" data-live="money" data-k="' + esc(k) + '" data-orig="' + (v === '' ? '' : Math.round(v)) + '" value="' + (v === '' ? '' : won(v)) + '" placeholder="0"><span>원</span></span></label>';
  // 고친 칸을 상태에 적용 (미리보기는 복사본에, 저장은 진짜에)
  function applyInputs(s, root) {
    const t = today(); const P = C.periodOf(s, t); let n = 0;
    root.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      if (k.indexOf('refl:') === 0) {
        const key = k.slice(5);
        if (!el.checked) return; // 체크한 것만 반영됨으로
        const b = C.status(s, t).nextCards.find((x) => x.items.some((i) => i.key === key)); if (!b) return;
        const it = b.items.find((i) => i.key === key);
        if (it.src === 'record') { const r = s.records.find((y) => y.id === it.id); if (r) r.reflected = true; } else { s.over[key] = Object.assign({}, s.over[key], { reflected: true }); }
        n++; return;
      }
      if (el.value.trim() === '' && el.dataset.orig === '') return;
      const v = Math.abs(parseAmt(el.value));
      if (String(v) === el.dataset.orig) return;
      n++;
      if (k.indexOf('in:') === 0) {
        const key = k.slice(3); const it = C.schedule(s, P, t).find((x) => x.key === key);
        const o = Object.assign({}, s.over[key]); if (it && v === it.planned) delete o.amount; else o.amount = v; s.over[key] = o;
      } else if (k.indexOf('card:') === 0) {
        const [, id, m] = k.split(':'); const c = s.cards.find((x) => x.id === id); c.app = Object.assign({}, c.app, { [m]: { amount: v, at: now(), date: t } });
      } else if (k.indexOf('bal:') === 0) {
        const a = s.accounts.find((x) => x.id === k.slice(4)); a.balance = a.type === 'overdraft' ? -v : v; a.balanceAt = now(); a.balanceDate = t;
      }
    });
    return n;
  }
  function inputPreview() {
    const el = document.getElementById('inPreview'); if (!el) return;
    const tmp = JSON.parse(JSON.stringify(S)); const n = applyInputs(tmp, document.querySelector('.screen'));
    const st = C.status(tmp, today()); const ahead = st.daysLeft <= 10;
    const f = C.flow(tmp, ahead ? C.addMonths(st.P, 1) : st.P, today());
    el.innerHTML = '<div class="pv"><span>' + (n ? '고친 칸 ' + n + '개 · 저장하면' : '지금') + '</span><b>쓸 수 있는 돈 ' + wonS(st.spendable) + '</b><b class="' + (f.left < 0 ? 'warn' : '') + '">' + (ahead ? '다음 급여로' : '이번 급여로') + ' ' + won(f.left) + (f.left < 0 ? ' 부족' : ' 남음') + '</b></div>';
  }

  // ===== 가계부 =====
  function bookScreen() {
    const P = view.P; const f = C.flow(S, P, today());
    const recs = f.records.filter((r) => view.cat === 'all' || r.cat === view.cat || (view.cat === '수입' && r.type === 'income'));
    let h = periodBar();
    const inc = f.records.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0);
    h += '<section class="card"><div class="tri"><div><span>쓴 돈</span><b>' + won(f.spent) + '</b></div><div><span>카드</span><b>' + won(f.spentCard) + '</b></div><div><span>통장·현금</span><b>' + won(f.spent - f.spentCard) + '</b></div></div>' +
      (inc ? '<p class="hint">가계부 수입 +' + won(inc) + '원 (급여·대납금은 수입 탭에서 자동으로 들어가요)</p>' : '') + '</section>';
    const cats = Object.entries(f.byCat).sort((a, b) => b[1] - a[1]);
    if (cats.length) h += '<div class="chips">' + [['all', '전체']].concat(cats.map(([c]) => [c, c])).map(([k, l]) => '<button class="chip' + (view.cat === k ? ' on' : '') + '" data-act="bookCat" data-k="' + esc(k) + '">' + esc(l) + (k !== 'all' ? ' ' + won(f.byCat[k]) : '') + '</button>').join('') + '</div>';
    const days = {};
    recs.slice().sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1)).forEach((r) => { (days[r.date] = days[r.date] || []).push(r); });
    const keys = Object.keys(days);
    h += keys.length ? keys.map((d) => {
      const out = days[d].filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
      const wd = '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
      return '<section class="card tight"><div class="day-head"><span>' + md(d) + ' (' + wd + ')</span><span>' + (out ? '−' + won(out) : '') + '</span></div>' + days[d].map(recRow).join('') + '</section>';
    }).join('') : '<section class="card"><button class="empty-cta" data-act="addRecord">이 달 기록이 없어요. + 버튼으로 기록해 보세요 ' + I.right + '</button></section>';
    h += '<div class="grid2"><button class="btn ghost" data-act="capture">' + I.scan + ' 캡처로 가져오기</button><button class="btn ghost" data-act="addRecord">기록하기</button></div>';
    return h;
  }

  // ===== 월간 흐름 =====
  function flowScreen() {
    const P = view.P; const t = today(); const f = C.flow(S, P, t);
    const L = f.lines; const short = f.left < 0;
    let h = periodBar();
    h += '<section class="hero tint ' + (short ? 'red' : 'amber') + '"><span class="hero-label">전체자금예상 <span class="pill-s">' + (short ? '부족' : '여유') + '</span></span><span class="hero-num">' + (short ? '− ' : '+ ') + won(f.left) + '원</span><span class="hero-sub">' + mName(P) + ' 월 수입과 전체 지출 기준</span>' +
      '<div class="hero-lines">' + [['월 유입', L.income, 'in'], ['해당 월 카드값', -L.card], ['통장 고정비', -L.fixed], ['대출·이자·상환', -L.loan], ['가계부 통장 지출', -L.living], ['정산·기타', -L.other]].filter((x, i) => i < 4 || x[1]).map(([l, n, c]) => '<div><span>' + l + '</span><b' + (c ? ' class="' + c + '"' : '') + '>' + (n > 0 ? '+' : n < 0 ? '−' : '') + won(n) + '</b></div>').join('') + '</div></section>';
    const ins = f.schedule.filter((x) => x.dir === 'in'); const outs = f.schedule.filter((x) => x.dir === 'out');
    const all = C.schedule(S, P, t).filter((x) => x.skip);
    h += '<section class="card">' + head('들어오는 돈', '+' + won(L.income)) + (ins.map((x) => schedRow(x, P)).join('') || '<p class="hint">이 달 정기 수입이 없어요</p>') + f.records.filter((r) => r.type === 'income').map(recRow).join('') + '</section>';
    h += '<section class="card">' + head('나가는 돈', '날짜순') + (outs.map((x) => schedRow(x, P)).join('') || '<p class="hint">이 달 정기 출금이 없어요</p>') +
      (L.living ? row({ act: 'goBook', t: '가계부 통장·체크 지출', s: f.records.filter((r) => r.type === 'expense' && r.from && r.from.type === 'account').length + '건', amt: won(L.living) }) : '') +
      all.map((x) => schedRow(x, P)).join('') + '</section>';
    h += '<p class="hint center">항목을 누르면 이번 달만 금액·날짜를 바꾸거나 건너뛸 수 있어요.</p>';
    return h;
  }

  // ===== 고정비 =====
  function fixedScreen() {
    const P = curP();
    const on = (x) => x.active !== false && !(x.until && P > x.until);
    const g = (type) => S.fixed.filter((x) => x.pay && x.pay.type === type && x.cat !== '대출').sort((a, b) => a.day - b.day);
    const total = (xs) => xs.filter(on).reduce((a, x) => a + x.amount, 0);
    const fr = (x) => row({ act: 'fixedInfo', data: { id: x.id }, cls: on(x) ? '' : 'off', lead: '<span class="date">' + esc(dayText(x)) + '</span>', t: esc(x.name) + (x.active === false ? badge('해지', 'gray') : x.until ? badge(ymName(x.until) + '까지', 'gray') : '') + (x.from && x.from > P ? badge(mName(x.from) + '부터', 'blue') : '') + endBadge(x), s: esc([x.info && x.info.provider, x.info && x.info.plan, refName(x.pay)].filter(Boolean).join(' · ')) + (x.note ? ' · ' + esc(x.note) : ''), amt: on(x) ? amtText(x) : '0원', end: on(x) ? '' : amtText(x) });
    const acc = g('account'), cd = g('card');
    let h = '<section class="hero plain"><span class="hero-label">구독·고정비 전체</span><span class="hero-num">' + (S.fixed.some((x) => x.approx) ? '약 ' : '') + won(total(acc) + total(cd)) + '원</span><div class="mini"><div><span>통장 출금</span><b>' + won(total(acc)) + '</b></div><div><span>카드 청구</span><b>' + won(total(cd)) + '</b></div></div></section>';
    h += soonCard();
    h += '<section class="card">' + head('통장 출금', won(total(acc)) + '원') + (acc.map(fr).join('') || '<p class="hint">없어요</p>') + '</section>';
    h += '<section class="card">' + head('카드 청구', won(total(cd)) + '원') + (cd.map(fr).join('') || '<p class="hint">없어요</p>') + '</section>';
    const li = S.fixed.filter((x) => x.cat === '대출');
    if (li.length) h += '<p class="hint center">대출 이자 ' + li.length + '건은 대출 탭에서 보여요 (분류 \'대출\').</p>';
    h += '<button class="btn ghost" data-act="editFixed">고정비 추가</button><p class="hint center">항목을 누르면 가입한 곳·약정·해지 방법 같은 정보를 볼 수 있어요.</p>';
    return h;
  }

  // ----- 고정비의 잊기 쉬운 정보 -----
  const INFO_KEYS = ['provider', 'plan', 'holder', 'contractEnd', 'howTo', 'contact'];
  const INFO_LAB = { provider: '가입한 곳', plan: '요금제·상품', holder: '명의·가입 번호', contractEnd: '약정·할인 끝', howTo: '해지·변경 방법', contact: '사이트·고객센터' };
  const daysTo = (d) => C.daysBetween(today(), d);
  function endBadge(x) {
    const e = x.info && x.info.contractEnd; if (!e || x.active === false) return '';
    const n = daysTo(e);
    return n < 0 ? badge('약정 끝남', 'gray') : n <= 60 ? badge('약정 D-' + n, 'warn') : '';
  }
  // 약정이 60일 안에 끝나거나 이미 끝난 것 (해지 안 한 것만)
  const soonList = () => S.fixed.filter((x) => x.active !== false && x.info && x.info.contractEnd && daysTo(x.info.contractEnd) <= 60).sort((a, b) => a.info.contractEnd < b.info.contractEnd ? -1 : 1);
  function soonCard() {
    const xs = soonList(); if (!xs.length) return '';
    return '<section class="card notice">' + head('약정·할인 확인할 것', xs.length + '건') + xs.map((x) => { const n = daysTo(x.info.contractEnd); return row({ act: 'fixedInfo', data: { id: x.id }, t: esc(x.name), s: esc(x.info.contractEnd.replace(/-/g, '.')) + (n < 0 ? ' 끝남 · 요금이 올랐는지 확인해요' : ' 끝나요 · 바꿀지 정해요'), amt: n < 0 ? '끝남' : 'D-' + n, amtCls: 'warn' }); }).join('') + '</section>';
  }
  function fixedInfo(id) {
    const x = S.fixed.find((y) => y.id === id); if (!x) return;
    const inf = x.info || {};
    const has = INFO_KEYS.some((k) => inf[k]);
    openSheet({
      title: x.name,
      body: () => '<div class="info-top"><b>' + amtText(x) + '</b><span>매월 ' + esc(dayText(x)) + ' · ' + esc(refName(x.pay)) + (x.cat ? ' · ' + esc(x.cat) : '') + '</span></div>' +
        (has ? '<div class="info-list">' + INFO_KEYS.filter((k) => inf[k]).map((k) => '<div><span>' + INFO_LAB[k] + '</span><b>' + esc(k === 'contractEnd' ? inf[k].replace(/-/g, '.') + (daysTo(inf[k]) >= 0 ? ' (D-' + daysTo(inf[k]) + ')' : ' (끝남)') : inf[k]) + '</b></div>').join('') + '</div>'
          : '<p class="hint">가입한 곳, 요금제, 약정 끝나는 날, 해지 방법을 적어 두면 나중에 찾을 필요가 없어요.</p>') +
        (x.note ? '<p class="hint">메모 · ' + esc(x.note) + '</p>' : ''),
      foot: () => '<button class="btn" data-act="editFixed" data-id="' + x.id + '">' + (has ? '고치기' : '정보 적기') + '</button>',
    });
  }

  // ===== 전체: 아래 메뉴에 없는 화면 모음 =====
  function moreScreen() {
    const t = today(); const P = curP(); const st = C.status(S, t);
    const on = (x) => x.active !== false && !(x.until && P > x.until) && !(x.from && x.from > P);
    const fx = S.fixed.filter((x) => on(x) && x.cat !== '대출');
    const L = C.loanSummary(S, t);
    const inc = S.incomes.filter(on);
    const pay = S.debts.filter((d) => d.dir === 'pay').reduce((a, d) => a + C.debtStatus(S, d).left, 0);
    const get = S.debts.filter((d) => d.dir !== 'pay').reduce((a, d) => a + C.debtStatus(S, d).left, 0);
    const item = (tab, name, sub, amt, ic) => '<a class="row" href="#/' + tab + '"><span class="lead"><span class="m-ic ' + ic + '">' + name.slice(0, 1) + '</span></span><span class="grow"><span class="t">' + name + '</span><span class="s">' + sub + '</span></span><span class="end"><span class="amt">' + amt + '</span></span><span class="chev">' + I.right + '</span></a>';
    const grp = (title, rows) => '<section class="card menu"><h3 class="grp">' + title + '</h3>' + rows.join('') + '</section>';
    let h = soonCard();
    h += grp('매달 나가는 돈', [
      item('fixed', '구독·고정비', fx.length + '개 · 통신비·보험·구독', '월 ' + won(fx.reduce((a, x) => a + x.amount, 0)), 'blue'),
      item('cards', '카드·할부', S.cards.length + '개 카드 · 할부 ' + S.installments.length + '건', won(st.nextCardTotal || 0), 'indigo'),
      item('loans', '대출', '매달 내 부담 ' + won(L.monthlySelf) + '원', won(L.total), 'red'),
    ]);
    h += grp('내 돈', [
      item('accounts', '계좌', S.accounts.length + '개 · 쓸 수 있는 돈', wonS(st.spendable), 'teal'),
      item('income', '수입', inc.length + '개 · 급여·정기 수입', '월 ' + won(inc.reduce((a, x) => a + x.amount, 0)), 'green'),
      item('debts', '갚을·받을 돈', '받을 돈 ' + won(get) + '원', won(pay), 'amber'),
    ]);
    h += grp('관리', [
      item('input', '한 번에 입력', '잔액·카드값을 한 화면에서 고쳐요', '', 'gray'),
      item('settings', '설정·백업', '급여일, 분류, 백업 내보내기', '', 'gray'),
    ]);
    return h;
  }

  // ===== 대출 =====
  function loansScreen() {
    const t = today(); const L = C.loanSummary(S, t);
    let h = '<section class="hero plain"><span class="hero-label">대출 총액</span><span class="hero-num">' + won(L.total) + '원</span><div class="mini"><div><span>마이너스통장</span><b>' + won(L.odTotal) + '</b></div><div><span>일반대출</span><b>' + won(L.loanTotal) + '</b></div><div><span>매달 내 부담</span><b>' + won(L.monthlySelf) + '</b></div><div><span>가족 대납</span><b>' + won(L.monthlyFamily) + '</b></div></div></section>';
    const loans = L.loans.slice().sort((a, b) => (a.loan.payDay || 0) - (b.loan.payDay || 0));
    h += '<section class="card">' + head('납입일 순 대출 일정', '월 ' + won(L.monthlySelf + L.monthlyFamily)) + (loans.map((x) => {
      const l = x.loan;
      return row({ act: 'editLoan', data: { id: l.id }, lead: bankChip(l.bank || refName({ type: 'account', id: l.accountId })), t: esc(l.name) + (l.familyPayer ? badge(l.familyPayer + ' 대납', 'blue') : '') + (l.active === false ? badge('끝남', 'gray') : ''),
        cls: 'wrap' + (l.active === false ? ' off' : ''), s: esc(dayText({ day: l.payDay, approx: l.approx, dayText: l.dayText })) + ' · 잔액 ' + won(x.amount) + (l.rate ? ' · ' + l.rate + '%' : '') + (x.paid ? ' · 납입 ' + x.paid + '회 반영' : ''), end: '이자 약 ' + won(x.interest), amt: amtText({ approx: l.approx }, l.monthly || 0) });
    }).join('') + L.interestFixed.slice().sort((a, b) => a.day - b.day).map((f) => row({ act: 'editFixed', data: { id: f.id }, lead: bankChip(refName(f.pay)), cls: 'wrap', t: esc(f.name), s: esc(dayText(f)) + ' · 이자' + (f.note ? ' · ' + esc(f.note) : ''), amt: amtText(f) })).join('') || '<p class="hint">대출이 없어요</p>') + '</section>';
    // 은행별 월 납입
    const by = {};
    L.loans.filter((x) => x.loan.active !== false).forEach((x) => { const k = (x.loan.bank || '기타') + (x.loan.familyPayer ? ' · ' + x.loan.familyPayer + ' 대납' : ''); by[k] = (by[k] || 0) + (x.loan.monthly || 0); });
    L.interestFixed.forEach((f) => { const k = refName(f.pay); by[k] = (by[k] || 0) + f.amount; });
    if (Object.keys(by).length) h += '<section class="card">' + head('은행별 월 납입', '') + Object.entries(by).map(([k, v]) => row({ t: esc(k), amt: '약 ' + won(v) + '원' })).join('') + row({ t: '<b>본인 부담 합계</b>', amt: '<b>약 ' + won(L.monthlySelf) + '원</b>', s: '대출 납입 + 이자' }) + '</section>';
    if (L.overdrafts.length) h += '<section class="card">' + head('마이너스통장', won(L.odTotal) + '원') + L.overdrafts.map((o) => row({ act: 'editAccount', data: { id: o.account.id }, t: esc(o.account.name), s: '한도 ' + won(o.account.limit) + ' · 남은 한도 ' + wonS(o.left) + (o.account.rate ? ' · ' + o.account.rate + '%' : ''), extra: o.account.limit ? meter(o.used / o.account.limit) : '', amt: won(o.used), end: o.account.rate ? '이자 약 ' + won(o.used * o.account.rate / 1200) : '' })).join('') + '</section>';
    if (L.order.length) h += '<section class="card">' + head('상환 우선순위', '금리 높은 순') + L.order.map((x, i) => row({ lead: '<span class="rank' + (i < 2 ? ' hot' : '') + '">' + (i + 1) + '</span>', t: esc(x.name), s: won(x.amount) + '원', amt: x.rate + '%', amtCls: i < 2 ? 'warn' : '' })).join('') + '</section>';
    h += '<button class="btn ghost" data-act="editLoan">대출 추가</button><p class="hint center">납입일이 지나면 원금 부분(납입액 − 이자)만큼 잔액이 자동으로 줄어요.</p>';
    return h;
  }

  // ===== 계좌 =====
  function accountsScreen() {
    const st = C.status(S, today());
    const odUsed = st.accts.filter((x) => x.account.type === 'overdraft').reduce((a, x) => a + Math.max(0, -x.balance), 0);
    let h = '<section class="hero plain"><span class="hero-label">총 사용 가능 금액</span><span class="hero-num">' + wonS(st.spendable) + '원</span><div class="mini"><div><span>마통 사용 합계</span><b>' + won(odUsed) + '</b></div><div><span>지역화폐</span><b>' + won(st.local) + '</b></div></div></section>';
    h += st.accts.map((x) => {
      const a = x.account; const od = a.type === 'overdraft'; const used = od ? Math.max(0, -x.balance) : 0;
      const kv = (k, v) => '<div><span>' + k + '</span><b>' + v + '</b></div>';
      return '<section class="card"><div class="acct-head"><div><h2>' + bankChip(a.name) + ' ' + esc(a.name) + '</h2><span class="s">' + (od ? '마이너스통장' : a.type === 'local' ? '지역화폐' : '입출금') + ' · ' + ago(a.balanceAt) + '</span></div><button class="btn sm soft" data-act="balance" data-id="' + a.id + '">잔액 고치기</button></div>' +
        '<div class="big-num">' + wonS(x.available) + '원<span>' + (od ? '남은 한도' : '현재 잔액') + '</span></div>' + (od && a.limit ? meter(used / a.limit) : '') +
        '<div class="kv">' + (od ? kv('현재 사용액', won(used)) + kv('총 한도', won(a.limit)) : '') + (a.rate ? kv('이율', '연 ' + a.rate + '%') + (od ? kv('매월 예상 이자', '약 ' + won(used * a.rate / 1200)) : '') : '') + (a.purpose ? kv('주요 용도', esc(a.purpose)) : '') + '</div>' +
        '<button class="link-btn" data-act="editAccount" data-id="' + a.id + '">계좌 정보 고치기</button></section>';
    }).join('');
    h += '<button class="btn ghost" data-act="editAccount">계좌 추가</button><p class="hint center">잔액은 마지막에 적은 은행앱 숫자에 그 뒤 가계부 기록과 지난 고정비·대출·카드대금을 더하고 뺀 값이에요.</p>';
    return h;
  }

  // ===== 카드·할부 =====
  function cardsScreen() {
    const st = C.status(S, today());
    let h = '';
    for (const b of st.nextCards) {
      const c = b.card;
      h += '<section class="card"><div class="acct-head"><div><h2>' + bankChip(c.name) + ' ' + esc(c.name) + '</h2><span class="s">' + md(b.payDate) + ' ' + esc((acct(c.accountId) || {}).name || '') + ' 출금</span></div><button class="icon-btn" data-act="editCard" data-id="' + c.id + '" aria-label="카드 정보">' + I.gear + '</button></div>' +
        '<div class="big-num">' + won(b.total) + '원<span>' + mName(b.payMonth) + ' 결제 예상</span></div>' +
        '<div class="kv"><div><span>카드앱 현재액 · ' + (b.app ? ago(b.app.at) : '확인 전') + '</span><b>' + (b.app ? won(b.app.amount) : '–') + '</b></div><div><span>아직 안 보이는 것</span><b>+' + won(b.pendingTotal) + '</b></div>' + (b.instTotal ? '<div><span>그중 할부</span><b>' + won(b.instTotal) + '</b></div>' : '') + '</div>' +
        (b.pending.length ? '<div class="sub-list">' + b.pending.map((it) => row({ act: 'toggleRefl', data: { k: it.key, id: b.cardId, m: b.payMonth }, t: esc(it.name), s: (it.date ? md(it.date) + ' · ' : '') + (it.src === 'record' ? '가계부' : it.inst ? '할부' : '고정비') + ' · 누르면 반영됨', amt: won(it.amount) })).join('') + '</div>' : '') +
        '<button class="btn soft" data-act="cardApp" data-id="' + c.id + '" data-m="' + b.payMonth + '">카드앱 금액 입력</button></section>';
    }
    if (!S.cards.length) h += '<section class="card"><p class="hint">카드가 없어요.</p></section>';
    // 할부
    const P = curP();
    const trend = C.installmentTrend(S, C.addMonths(P, -1), 30);
    if (trend.length) {
      const mx = trend.reduce((a, r) => (r.total > a.total ? r : a), trend[0]);
      const cardsIn = S.cards.filter((c) => trend.some((r) => r.byCard[c.id]));
      h += '<section class="hero plain"><span class="hero-label">할부 남은 청구</span><span class="hero-num">' + won(trend.reduce((a, r) => a + r.total, 0)) + '원</span><div class="mini"><div><span>최대 청구월</span><b>' + ymName(mx.month) + '</b></div><div><span>최대 월 할부액</span><b>' + won(mx.total) + '</b></div><div><span>할부 종료 예상</span><b>' + ymName(trend[trend.length - 1].month) + '</b></div></div></section>';
      const cols = ' style="grid-template-columns:1.25fr repeat(' + (cardsIn.length + 1) + ',minmax(0,1fr))"';
      h += '<section class="card"><div class="sec-head"><h2>월별 할부 청구 추이</h2></div><div class="table"><div class="tr th"' + cols + '><span>청구월</span>' + cardsIn.map((c) => '<span>' + esc(c.name) + '</span>').join('') + '<span>합계</span></div>' +
        trend.map((r) => '<div class="tr' + (r === mx ? ' hot' : '') + '"' + cols + '><span>' + ymName(r.month) + '</span>' + cardsIn.map((c) => '<span>' + won(r.byCard[c.id] || 0) + '</span>').join('') + '<b>' + won(r.total) + '</b></div>').join('') + '</div></section>';
    }
    h += '<section class="card">' + head('할부 목록', S.installments.length + '건') + (S.installments.map((i) => {
      const end = C.addMonths(i.startMonth, i.months - 1);
      return row({ act: 'editInst', data: { id: i.id }, cls: end < C.addMonths(P, -1) ? 'off' : '', t: esc(i.name), s: esc((card(i.cardId) || {}).name || '') + ' · ' + ymName(i.startMonth) + '~' + ymName(end) + ' · ' + i.months + '개월' + (i.note ? ' · ' + esc(i.note) : ''), amt: won(Array.isArray(i.amounts) ? i.amounts[0] : i.amount) + '/월' });
    }).join('') || '<p class="hint">할부가 없어요</p>') + '</section>';
    h += '<div class="grid2"><button class="btn ghost" data-act="editCard">카드 추가</button><button class="btn ghost" data-act="editInst">할부 추가</button></div>';
    return h;
  }

  // ===== 수입 =====
  function incomeScreen() {
    const P = view.P; const t = today(); const f = C.flow(S, P, t);
    let h = periodBar();
    const sch = f.schedule.filter((x) => x.dir === 'in'); const recs = f.records.filter((r) => r.type === 'income');
    h += '<section class="hero plain"><span class="hero-label">' + mName(P) + ' 흐름 반영 총 수입</span><span class="hero-num in">' + won(f.lines.income) + '원</span><div class="mini">' + sch.map((x) => '<div><span>' + esc(x.name) + '</span><b>' + won(x.amount) + '</b></div>').join('') + (recs.length ? '<div><span>가계부 수입</span><b>' + won(recs.reduce((a, r) => a + r.amount, 0)) + '</b></div>' : '') + '</div></section>';
    h += '<section class="card">' + head('이 달 들어오는 돈', '누르면 실제 금액') + (sch.map((x) => schedRow(x, P)).join('') + recs.map(recRow).join('') || '<p class="hint">없어요</p>') + '</section>';
    const fam = S.loans.filter((l) => l.familyPayer && l.active !== false);
    h += '<section class="card">' + head('매달 들어오는 돈', '') + S.incomes.map((x) => row({ act: 'editIncome', data: { id: x.id }, cls: x.active === false || (x.until && P > x.until) ? 'off' : '', lead: '<span class="date">' + esc(dayText(x)) + '</span>', t: esc(x.name) + (x.until ? badge(ymName(x.until) + '까지', 'gray') : '') + (x.active === false ? badge('끝남', 'gray') : ''), s: esc((acct(x.accountId) || {}).name || '') + (x.note ? ' · ' + esc(x.note) : ''), amt: amtText(x), amtCls: 'in' })).join('') +
      fam.map((l) => row({ act: 'editLoan', data: { id: l.id }, lead: '<span class="date">' + l.payDay + '일</span>', t: esc(l.familyPayer) + ' 대납금', s: esc(l.name) + ' 납입용 · 대출에서 고쳐요', amt: won(l.familyAmount || l.monthly) + '원', amtCls: 'in' })).join('') +
      (!S.incomes.length && !fam.length ? '<p class="hint">정기 수입이 없어요</p>' : '') + '</section>';
    h += '<button class="btn ghost" data-act="editIncome">정기 수입 추가</button><p class="hint center">급여는 급여일이 들어 있는 다음 달 흐름의 수입이에요. 상여가 들어간 달은 이 달 항목을 눌러 실제 금액으로 바꿔 주세요.</p>';
    return h;
  }

  // ===== 갚을·받을 돈 =====
  function debtsScreen() {
    const st = C.status(S, today());
    const pay = st.debts.filter((x) => x.debt.dir === 'pay'), recv = st.debts.filter((x) => x.debt.dir === 'recv');
    let h = '<section class="hero plain"><span class="hero-label">상환할 돈</span><span class="hero-num">' + won(st.payable) + '원</span><div class="mini"><div><span>받을 돈</span><b class="in">' + won(st.receivable) + '</b></div><div><span>건수</span><b>' + st.debts.filter((x) => x.left > 0).length + '건</b></div></div></section>';
    h += '<section class="card">' + head('갚을 돈', won(st.payable) + '원') + (pay.map(debtRow).join('') || '<p class="hint">없어요</p>') + '</section>';
    h += '<section class="card">' + head('받을 돈', won(st.receivable) + '원') + (recv.map(debtRow).join('') || '<p class="hint">없어요</p>') + '</section>';
    h += '<button class="btn ghost" data-act="editDebt">추가</button><p class="hint center">사업계좌에서 잠깐 가져온 돈(임시출금)도 갚을 돈으로 적어요. 정산하면 계좌 잔액이 같이 바뀌어요.</p>';
    return h;
  }

  // ===== 설정 =====
  function settingsScreen() {
    return '<section class="card">' + head('설정', '') + row({ act: 'setPayDay', t: '급여일 (급여주기 시작일)', amt: '매월 ' + S.settings.payDay + '일' }) + '</section>' +
      '<section class="card">' + head('데이터', '') + row({ act: 'backup', t: '백업 내보내기·가져오기', s: '이전 정보 묶음 붙여넣기도 여기서 해요', amt: '' }) +
      (readJSON(OLDKEY) ? row({ act: 'remigrate', t: '예전 버전 앱 데이터 다시 가져오기', s: '지금 데이터는 바뀌어요', amt: '' }) : '') + '</section>' +
      '<p class="hint center">홈 화면에 추가해서 쓰면 Safari가 데이터를 지우지 않아요.<br>공유 버튼 → 홈 화면에 추가<br>버전 ' + VERSION + '</p>';
  }

  // ===== 처음 =====
  function welcome() {
    return '<main class="screen welcome"><div class="wl-top"><h1>머니</h1><p>급여일 기준으로 이번 급여로 버틸 수 있는지,<br>카드값·대출·고정비를 한 곳에서 봐요.</p></div>' +
      '<button class="btn" data-act="editAccount">계좌부터 추가하기</button><button class="btn ghost" data-act="backup">이전 정보 묶음·백업으로 시작</button>' +
      '<label class="field"><span class="lab">급여일</span><select class="input" id="wPay">' + dayOpts.slice(0, 28).map(([v, l]) => '<option value="' + v + '"' + (v === S.settings.payDay ? ' selected' : '') + '>매월 ' + l + '</option>').join('') + '</select></label></main>';
  }

  // ===== 시트: 가계부 기록 =====
  function methodOptions(sel, withCards) {
    return S.accounts.map((a) => '<option value="account:' + a.id + '"' + (sel === 'account:' + a.id ? ' selected' : '') + '>' + esc(a.name) + ' (통장·체크)</option>').join('') +
      (withCards ? S.cards.map((c) => '<option value="card:' + c.id + '"' + (sel === 'card:' + c.id ? ' selected' : '') + '>' + esc(c.name) + ' (신용)</option>').join('') : '');
  }
  const refOf = (v) => { if (!v) return null; const [type, id] = v.split(':'); return { type, id }; };
  const refVal = (r) => (r ? r.type + ':' + r.id : '');
  let last = readJSON('money.v2.last') || {};
  function recordSheet(existing, preset) {
    const x = existing ? JSON.parse(JSON.stringify(existing)) : Object.assign({ type: 'expense', amount: 0, date: today(), memo: '', cat: last.cat || '식비', from: refOf(last.method) || (S.accounts[0] ? { type: 'account', id: S.accounts[0].id } : null) }, preset || {});
    if (existing && existing.type === 'settle') return settleEdit(existing);
    const f = { type: x.type, cat: x.cat };
    openSheet({
      title: existing ? '기록 고치기' : '가계부 기록', focus: existing ? null : '[name=amt]',
      headRight: () => existing ? '' : '<button class="pill" data-act="capture">' + I.scan + '<span>캡처</span></button>',
      body() {
        let h = '<div class="seg">' + [['expense', '지출'], ['income', '수입'], ['transfer', '이체']].map(([k, l]) => '<button data-act="recType" data-k="' + k + '"' + (f.type === k ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</div>';
        h += '<div class="money big"><input class="input" name="amt" inputmode="numeric" data-live="money" value="' + (x.amount ? won(x.amount) : '') + '" placeholder="0"><span>원</span></div>';
        h += '<div class="chips">' + [1000, 10000, 50000].map((n) => '<button class="chip" data-act="addAmt" data-n="' + n + '">+' + (n >= 10000 ? n / 10000 + '만' : '1천') + '</button>').join('') + '</div>';
        if (f.type !== 'transfer') {
          const cats = f.type === 'income' ? ['급여', '용돈', '정산', '환급', '수당', '기타'] : S.categories;
          h += '<div class="cats">' + cats.map((c) => '<button class="cat' + (f.cat === c ? ' on' : '') + '" data-act="recCat" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>';
        }
        if (f.type === 'expense') h += '<label class="field"><span class="lab">결제수단</span><select class="input" name="from" data-live="hint">' + methodOptions(refVal(x.from), true) + '</select></label>';
        if (f.type === 'income') h += '<label class="field"><span class="lab">들어온 계좌</span><select class="input" name="to" data-live="hint">' + methodOptions(refVal(x.to), false) + '</select></label>';
        if (f.type === 'transfer') h += '<div class="grid2"><label class="field"><span class="lab">보낸 계좌</span><select class="input" name="from">' + methodOptions(refVal(x.from), false) + '</select></label><label class="field"><span class="lab">받은 계좌</span><select class="input" name="to">' + methodOptions(refVal(x.to) || (S.accounts[1] ? 'account:' + S.accounts[1].id : ''), false) + '</select></label></div>';
        h += '<div class="grid2"><label class="field"><span class="lab">날짜</span><input class="input" type="date" name="date" value="' + x.date + '" data-live="hint"></label><label class="field"><span class="lab">메모</span><input class="input" name="memo" value="' + esc(x.memo || '') + '" placeholder="가게 이름 등"></label></div>';
        return h;
      },
      foot: () => '<p class="hint center" id="recHint"></p><button class="btn" data-act="saveRecord">저장</button>' + (existing ? '<button class="btn ghost danger" data-act="deleteRecord" data-id="' + existing.id + '">기록 삭제</button>' : ''),
      mount: recHint,
    });
    sheet.rec = { x, f, existing };
  }
  function recHint() {
    const el = document.getElementById('recHint'); if (!el || !sheet || !sheet.rec) return;
    const f = sheet.rec.f; const d = val('date') || today(); let t = '';
    if (f.type === 'expense') {
      const r = refOf(val('from'));
      if (r && r.type === 'card') { const c = card(r.id); t = c.name + ' ' + mName(C.payMonthOf(c, d)) + ' 결제 카드값에 더해져요'; }
      else if (r) t = (acct(r.id) || {}).name + ' 잔액과 ' + mName(C.periodOf(S, d)) + ' 흐름에서 빠져요';
    } else if (f.type === 'income') { const r = refOf(val('to')); if (r) t = (acct(r.id) || {}).name + ' 잔액과 ' + mName(C.periodOf(S, d)) + ' 수입에 더해져요' + (f.cat === '급여' ? ' · 정기 급여는 수입 탭에 이미 있어요' : ''); }
    else t = '내 계좌끼리 옮긴 거라 합계는 그대로예요';
    el.textContent = t;
  }
  function saveRecord() {
    const { f, existing } = sheet.rec;
    const amount = Math.abs(parseAmt(val('amt'))); if (!amount) return toast('금액을 적어 주세요');
    const r = existing ? S.records.find((y) => y.id === existing.id) : { id: uid(), at: now() };
    r.type = f.type; r.amount = amount; r.date = val('date') || today(); r.memo = (val('memo') || '').trim();
    r.cat = f.type === 'transfer' ? null : f.cat;
    r.from = f.type === 'income' ? null : refOf(val('from')); r.to = f.type === 'expense' ? null : refOf(val('to'));
    if (f.type === 'transfer' && refVal(r.from) === refVal(r.to)) return toast('보낸 계좌와 받은 계좌가 같아요');
    if (r.from && r.from.type === 'card') r.payMonth = C.payMonthOf(card(r.from.id), r.date); else { delete r.payMonth; delete r.reflected; }
    if (!existing) S.records.push(r);
    if (f.type === 'expense') { last = { cat: f.cat, method: refVal(r.from) }; try { localStorage.setItem('money.v2.last', JSON.stringify(last)); } catch (e) { /* 편의 기능 */ } }
    save(); closeSheet(); render();
    toast(existing ? '고쳤어요 · 현황과 잔액에 반영됐어요' : '기록했어요 · ' + (r.from && r.from.type === 'card' ? '카드값' : '잔액') + '에 반영됐어요');
  }
  function settleEdit(r) {
    formSheet('정산 기록 고치기', [{ name: 'amt', label: '금액', type: 'money', value: r.amount }, { name: 'date', label: '날짜', type: 'date', value: r.date }],
      () => { const a = Math.abs(parseAmt(val('amt'))); if (!a) return toast('금액을 적어 주세요'); r.amount = a; r.date = val('date') || r.date; return true; },
      () => { S.records = S.records.filter((y) => y !== r); return true; });
  }

  // ===== 시트: 이번 달 일정 하나 (이번 달만 / 건너뛰기 / 기본 정보 고치기) =====
  function schedSheet(key, P) {
    const it = C.schedule(S, P, today()).find((x) => x.key === key); if (!it) return;
    if (it.src === 'card') return cardApp(it.id, it.payMonth);
    const src = { income: ['editIncome', '정기 수입'], loan: ['editLoan', '대출'], family: ['editLoan', '대출'], fixed: ['editFixed', '고정비'] }[it.src];
    openSheet({
      title: it.name,
      body: () => '<div class="kv"><div><span>기본 금액</span><b>' + won(it.planned) + '원</b></div><div><span>기본 날짜</span><b>' + md(it.plannedDate) + '</b></div><div><span>계좌</span><b>' + esc((acct(it.acct) || {}).name || '') + '</b></div></div>' +
        field({ name: 'amt', label: mName(P) + ' 실제 금액', type: 'money', value: it.amount }) + field({ name: 'date', label: '날짜', type: 'date', value: it.date }) +
        '<p class="hint">이번 달만 바뀌어요. 매달 바뀌는 거면 아래 \'' + src[1] + ' 고치기\'로 바꿔 주세요.</p>',
      foot: () => '<button class="btn" data-act="schedSave" data-k="' + esc(key) + '" data-p="' + P + '">이번 달만 저장</button><div class="grid2"><button class="btn ghost" data-act="schedSkip" data-k="' + esc(key) + '">' + (it.skip ? '건너뛰기 취소' : '이번 달 건너뛰기') + '</button><button class="btn ghost" data-act="' + src[0] + '" data-id="' + it.id + '">' + src[1] + ' 고치기</button></div>' + (it.edited ? '<button class="btn ghost" data-act="schedReset" data-k="' + esc(key) + '">기본값으로 되돌리기</button>' : ''),
    });
    sheet.item = it;
  }

  // ===== 시트: 카드앱 금액 =====
  function cardApp(id, m) {
    const c = card(id);
    openSheet({
      title: c.name + ' ' + mName(m) + ' 결제', focus: '[name=amt]',
      body() {
        const b = C.cardBill(S, id, m);
        return field({ name: 'amt', label: '카드앱 결제 예정 금액', type: 'money', value: b.app ? b.app.amount : '', sub: b.app ? ago(b.app.at) : '' }) +
          '<p class="hint">카드앱 숫자를 적으면 그 뒤에 쓴 것과 아직 청구 안 된 고정비만 더해요. 할부는 카드앱 금액에 들어 있다고 봐요.</p>' +
          '<div class="sub-list">' + (b.items.filter((x) => !x.inst).map((it) => '<button class="row" data-act="toggleRefl" data-k="' + esc(it.key) + '" data-id="' + id + '" data-m="' + m + '"><span class="grow"><span class="t">' + esc(it.name) + '</span><span class="s">' + (it.date ? md(it.date) + ' · ' : '') + (it.included ? '카드앱에 있음' : '아직 안 보임 · 더함') + '</span></span><span class="amt' + (it.included ? ' muted' : '') + '">' + won(it.amount) + '</span><span class="tick' + (it.included ? ' on' : '') + '">' + I.check + '</span></button>').join('') || '<p class="hint">이 결제월 고정비·가계부 사용이 없어요</p>') + '</div>' +
          '<div class="kv"><div><span>예상 카드값</span><b>' + won(b.total) + '원</b></div></div>' +
          field({ name: 'paid', label: '실제 출금액 (출금 후, 선택)', type: 'money', value: b.paidAmount != null ? b.paidAmount : '' });
      },
      foot: () => '<button class="btn" data-act="cardAppSave" data-id="' + id + '" data-m="' + m + '">저장</button>',
    });
  }
  function toggleRefl(k, id, m) {
    const b = C.cardBill(S, id, m); const it = b.items.find((x) => x.key === k); if (!it) return;
    if (it.src === 'record') { const r = S.records.find((y) => y.id === it.id); r.reflected = !it.included; } else S.over[k] = Object.assign({}, S.over[k], { reflected: !it.included });
    save(); render(); if (sheet) paintSheet();
  }

  // ===== 시트: 기본 정보 =====
  const acctOpts = () => S.accounts.map((a) => [a.id, a.name]);
  const payOpts = () => S.accounts.map((a) => ['account:' + a.id, a.name + ' (통장)']).concat(S.cards.map((c) => ['card:' + c.id, c.name + ' (카드)']));
  const num = (v) => Number(String(v || '').replace(/[^0-9.]/g, '')) || null;

  function editAccount(id) {
    const a = id ? acct(id) : null;
    const f = [
      { name: 'name', label: '이름', value: a ? a.name : '', ph: '예: 국민' },
      { name: 'type', label: '종류', type: 'select', value: a ? a.type : 'bank', options: [['bank', '입출금'], ['overdraft', '마이너스통장'], ['local', '지역화폐']] },
      { name: 'limit', label: '마이너스통장 한도', type: 'money', value: a ? a.limit : '', ph: '마이너스통장일 때만' },
      { name: 'rate', label: '이율 % (선택)', type: 'number', value: a ? a.rate : '', ph: '예: 5.1' },
      { name: 'purpose', label: '주요 용도 (선택)', value: a ? a.purpose || '' : '', ph: '예: 급여 수령·카드대금' },
      { name: 'include', label: '쓸 수 있는 돈에 합산', type: 'switch', value: a ? a.include !== false : true },
    ];
    if (!a) f.push({ name: 'bal', label: '지금 은행앱 잔액 (마이너스통장은 사용 중인 금액)', type: 'money' });
    formSheet(a ? '계좌 정보' : '계좌 추가', f, () => {
      const name = val('name').trim(); if (!name) return toast('이름을 적어 주세요');
      const x = a || { id: uid() };
      x.name = name; x.type = val('type'); x.include = val('include'); x.purpose = val('purpose').trim(); x.rate = num(val('rate'));
      if (x.type === 'overdraft') x.limit = Math.abs(parseAmt(val('limit'))); else delete x.limit;
      if (!a) { const v = Math.abs(parseAmt(val('bal'))); x.balance = x.type === 'overdraft' ? -v : v; x.balanceAt = now(); x.balanceDate = today(); S.accounts.push(x); S.started = true; }
      return a ? LINKED : true;
    }, a ? () => {
      const used = S.records.some((r) => (r.from && r.from.id === a.id) || (r.to && r.to.id === a.id)) || S.fixed.some((x) => x.pay && x.pay.id === a.id) || S.loans.some((l) => l.accountId === a.id) || S.cards.some((c) => c.accountId === a.id) || S.incomes.some((x) => x.accountId === a.id);
      if (used) { toast('이 계좌를 쓰는 항목이 있어서 지울 수 없어요'); return false; }
      S.accounts = S.accounts.filter((y) => y !== a); return true;
    } : null, '계좌번호·실명은 적지 않아요.');
  }
  function balanceSheet(id) {
    const a = acct(id); const od = a.type === 'overdraft'; const bal = C.accountBalance(S, id, today());
    const est = od ? Math.max(0, -bal) : bal;
    openSheet({
      title: a.name + (od ? ' 사용 중인 금액' : ' 잔액'), focus: '[name=amt]',
      body: () => '<div class="money big"><input class="input" name="amt" inputmode="numeric" data-live="money" data-est="' + est + '" value="' + won(est) + '"><span>원</span></div>' +
        '<div class="kv"><div><span>앱이 계산한 금액</span><b>' + won(est) + '</b></div><div><span>차이</span><b id="gap">0</b></div></div>' +
        '<p class="hint">은행앱 숫자를 그대로 적어 주세요. 차이는 가계부에 안 적은 입출금이에요. 저장하면 이 숫자부터 다시 계산해요.' + (od ? ' 마이너스통장은 쓴 금액(−로 보이는 숫자)을 적어요.' : '') + '</p>',
      foot: () => '<button class="btn" data-act="saveBalance" data-id="' + id + '">저장</button>',
    });
  }
  function editCard(id) {
    const c = id ? card(id) : null;
    if (!S.accounts.length) return toast('출금 계좌를 먼저 추가해 주세요');
    formSheet(c ? '카드 정보' : '카드 추가', [
      { name: 'name', label: '이름', value: c ? c.name : '', ph: '예: 삼성카드' },
      { name: 'payDay', label: '결제일', type: 'select', value: c ? c.payDay : 15, options: dayOpts },
      { name: 'offset', label: '사용기간', type: 'select', value: c ? (c.offset == null ? 1 : c.offset) : 1, options: [[1, '전월 1일~말일 사용분'], [2, '전전월 사용분'], [0, '당월 사용분']] },
      { name: 'accountId', label: '출금 계좌', type: 'select', value: c ? c.accountId : S.accounts[0].id, options: acctOpts() },
    ], () => {
      const name = val('name').trim(); if (!name) return toast('이름을 적어 주세요');
      const x = c || { id: uid() };
      x.name = name; x.payDay = Number(val('payDay')); x.offset = Number(val('offset')); x.accountId = val('accountId');
      if (!c) S.cards.push(x);
      // 가계부 카드 사용의 결제월도 새 사용기간으로
      S.records.forEach((r) => { if (r.from && r.from.type === 'card' && r.from.id === x.id) r.payMonth = C.payMonthOf(x, r.date); });
      return c ? LINKED : true;
    }, c ? () => {
      if (S.records.some((r) => r.from && r.from.id === c.id) || S.fixed.some((x) => x.pay && x.pay.id === c.id) || S.installments.some((i) => i.cardId === c.id)) { toast('이 카드를 쓰는 항목이 있어서 지울 수 없어요'); return false; }
      S.cards = S.cards.filter((y) => y !== c); return true;
    } : null);
  }
  function editFixed(id) {
    const x = id ? S.fixed.find((y) => y.id === id) : null;
    const info = (x && x.info) || {};
    if (!payOpts().length) return toast('계좌나 카드를 먼저 추가해 주세요');
    formSheet(x ? '고정비 고치기' : '고정비 추가', [
      { name: 'name', label: '이름', value: x ? x.name : '', ph: '예: 월세, 넷플릭스' },
      { name: 'amount', label: '금액', type: 'money', value: x ? x.amount : '' },
      { name: 'day', label: '매월 날짜', type: 'select', value: x ? x.day : 25, options: dayOpts },
      { name: 'dayText', label: '날짜 표시 (선택)', value: x ? x.dayText || '' : '', ph: '예: 24일-25일, 말일' },
      { name: 'pay', label: '내는 곳', type: 'select', value: x ? refVal(x.pay) : payOpts()[0][0], options: payOpts() },
      { name: 'cat', label: '분류', type: 'select', value: x ? x.cat || '기타' : '구독', options: S.categories.map((c) => [c, c]) },
      { name: 'approx', label: '금액·날짜가 조금씩 달라요', type: 'switch', value: x ? x.approx : false, hint: '"약 ○원", "○일 전후"로 보여요' },
      { name: 'from', label: '시작 급여월 (선택)', type: 'month', value: x ? x.from || '' : '' },
      { name: 'until', label: '끝나는 급여월 (선택)', type: 'month', value: x ? x.until || '' : '' },
      { name: 'note', label: '메모 (선택)', value: x ? x.note || '' : '', ph: '예: 청구할인 10% 반영' },
      { name: 'active', label: '사용 중', type: 'switch', value: x ? x.active !== false : true, hint: '끄면 해지로 보여요' },
      { type: 'html', html: '<p class="group-lab">잊기 쉬운 정보 <em>선택 · 비밀번호는 적지 마세요</em></p>' },
      { name: 'provider', label: '가입한 곳', value: info.provider || '', ph: '예: SKT, 넷플릭스, ○○보험' },
      { name: 'plan', label: '요금제·상품', value: info.plan || '', ph: '예: 5G 슬림, 프리미엄' },
      { name: 'holder', label: '명의·가입 번호', value: info.holder || '', ph: '예: 본인 010-****-1234' },
      { name: 'contractEnd', label: '약정·할인 끝나는 날', type: 'date', value: info.contractEnd || '' },
      { name: 'howTo', label: '해지·변경 방법', value: info.howTo || '', ph: '예: 앱 > 마이 > 요금제 변경' },
      { name: 'contact', label: '사이트·고객센터', value: info.contact || '', ph: '예: 114, tworld.co.kr' },
    ], () => {
      const name = val('name').trim(); const amount = Math.abs(parseAmt(val('amount')));
      if (!name || !amount) return toast('이름과 금액을 적어 주세요');
      const y = x || { id: uid(), from: curP() };
      Object.assign(y, { name, amount, day: Number(val('day')), dayText: val('dayText').trim(), pay: refOf(val('pay')), cat: val('cat'), approx: val('approx'), from: val('from') || (x ? null : curP()), until: val('until') || null, note: val('note').trim(), active: val('active') });
      const inf = {}; for (const k of INFO_KEYS) { const v = (val(k) || '').trim(); if (v) inf[k] = v; }
      if (Object.keys(inf).length) y.info = inf; else delete y.info;
      if (!x) S.fixed.push(y);
      return LINKED;
    }, x ? () => { S.fixed = S.fixed.filter((y) => y !== x); return true; } : null, '이번 달만 금액이 다르면 월간 흐름에서 그 항목을 눌러 바꿔요.');
  }
  function editIncome(id) {
    const x = id ? S.incomes.find((y) => y.id === id) : null;
    if (!S.accounts.length) return toast('계좌를 먼저 추가해 주세요');
    formSheet(x ? '정기 수입 고치기' : '정기 수입 추가', [
      { name: 'name', label: '이름', value: x ? x.name : '', ph: '예: 급여, 회수금' },
      { name: 'amount', label: '금액', type: 'money', value: x ? x.amount : '' },
      { name: 'day', label: '매월 날짜', type: 'select', value: x ? x.day : S.settings.payDay, options: dayOpts },
      { name: 'accountId', label: '들어오는 계좌', type: 'select', value: x ? x.accountId : S.accounts[0].id, options: acctOpts() },
      { name: 'salary', label: '급여예요', type: 'switch', value: x ? x.salary : !S.incomes.length },
      { name: 'approx', label: '금액이 조금씩 달라요', type: 'switch', value: x ? x.approx : false },
      { name: 'from', label: '시작 급여월 (선택)', type: 'month', value: x ? x.from || '' : '' },
      { name: 'until', label: '끝나는 급여월 (선택)', type: 'month', value: x ? x.until || '' : '', ph: '' },
      { name: 'note', label: '메모 (선택)', value: x ? x.note || '' : '' },
      { name: 'active', label: '받는 중', type: 'switch', value: x ? x.active !== false : true },
    ], () => {
      const name = val('name').trim(); const amount = Math.abs(parseAmt(val('amount')));
      if (!name || !amount) return toast('이름과 금액을 적어 주세요');
      const y = x || { id: uid() };
      Object.assign(y, { name, amount, day: Number(val('day')), accountId: val('accountId'), salary: val('salary'), approx: val('approx'), from: val('from') || null, until: val('until') || null, note: val('note').trim(), active: val('active') });
      if (!x) S.incomes.push(y);
      return LINKED;
    }, x ? () => { S.incomes = S.incomes.filter((y) => y !== x); return true; } : null, '끝나는 달을 적으면 그 달 흐름까지만 들어가요.');
  }
  function editLoan(id) {
    const l = id ? S.loans.find((y) => y.id === id) : null;
    if (!S.accounts.length) return toast('납입 계좌를 먼저 추가해 주세요');
    const cur = l ? C.loanBalance(S, l, today()).amount : '';
    formSheet(l ? '대출 고치기' : '대출 추가', [
      { name: 'bank', label: '은행', value: l ? l.bank || '' : '', ph: '예: 국민' },
      { name: 'name', label: '대출 이름', value: l ? l.name : '', ph: '예: 신용대출' },
      { name: 'balance', label: '남은 원금 (지금)', type: 'money', value: cur },
      { name: 'rate', label: '금리 %', type: 'number', value: l ? l.rate : '', ph: '예: 4.5' },
      { name: 'monthly', label: '월 납입액', type: 'money', value: l ? l.monthly : '' },
      { name: 'payDay', label: '납입일', type: 'select', value: l ? l.payDay : 25, options: dayOpts },
      { name: 'dayText', label: '날짜 표시 (선택)', value: l ? l.dayText || '' : '', ph: '예: 월초, 11일-15일' },
      { name: 'accountId', label: '나가는 계좌', type: 'select', value: l ? l.accountId : S.accounts[0].id, options: acctOpts() },
      { name: 'approx', label: '납입액이 조금씩 달라요', type: 'switch', value: l ? l.approx : true },
      { name: 'familyPayer', label: '납입금을 보내 주는 사람 (선택)', value: l ? l.familyPayer || '' : '', ph: '예: 엄마' },
      { name: 'familyAmount', label: '보내 주는 금액 (납입액과 다를 때만)', type: 'money', value: l ? l.familyAmount || '' : '' },
      { name: 'note', label: '메모 (선택)', value: l ? l.note || '' : '', ph: '예: 5/26부터 금리 변동' },
      { name: 'active', label: '갚는 중', type: 'switch', value: l ? l.active !== false : true },
    ], () => {
      const name = val('name').trim(); if (!name) return toast('이름을 적어 주세요');
      const x = l || { id: uid(), from: curP() };
      const bal = Math.abs(parseAmt(val('balance')));
      if (!l || bal !== cur) { x.balance = bal; x.balanceDate = today(); }
      Object.assign(x, { bank: val('bank').trim(), name, rate: num(val('rate')), monthly: Math.abs(parseAmt(val('monthly'))), payDay: Number(val('payDay')), dayText: val('dayText').trim(), accountId: val('accountId'), approx: val('approx'),
        familyPayer: val('familyPayer').trim() || null, familyAmount: Math.abs(parseAmt(val('familyAmount'))) || null, note: val('note').trim(), active: val('active') });
      if (!l) S.loans.push(x);
      return LINKED;
    }, l ? () => { S.loans = S.loans.filter((y) => y !== l); return true; } : null, '납입일마다 나가는 계좌 잔액에서 빠지고, 원금 부분만큼 남은 원금이 줄어요. 보내 주는 사람을 적으면 같은 날 대납금이 수입으로 들어와요.');
  }
  function editInst(id) {
    const x = id ? S.installments.find((y) => y.id === id) : null;
    if (!S.cards.length) return toast('카드를 먼저 추가해 주세요');
    formSheet(x ? '할부 고치기' : '할부 추가', [
      { name: 'name', label: '이름', value: x ? x.name : '', ph: '예: 노트북' },
      { name: 'cardId', label: '카드', type: 'select', value: x ? x.cardId : S.cards[0].id, options: S.cards.map((c) => [c.id, c.name]) },
      { name: 'start', label: '첫 결제월', type: 'month', value: x ? x.startMonth : C.addMonths(today().slice(0, 7), 1) },
      { name: 'months', label: '개월 수', type: 'number', value: x ? x.months : 3 },
      { name: 'amount', label: '한 달 금액', type: 'money', value: x ? (Array.isArray(x.amounts) ? x.amounts[0] : x.amount) : '' },
      { name: 'amounts', label: '달마다 금액이 다르면 (선택, 쉼표로)', value: x && Array.isArray(x.amounts) ? x.amounts.join(', ') : '', ph: '예: 18168, 18166, 18166' },
      { name: 'note', label: '메모 (선택)', value: x ? x.note || '' : '' },
    ], () => {
      const name = val('name').trim(); const months = Number(val('months'));
      const list = val('amounts').split(/[,\s]+/).map((s) => Math.abs(parseAmt(s))).filter(Boolean);
      const amount = Math.abs(parseAmt(val('amount'))) || list[0];
      if (!name || !months || !amount || !val('start')) return toast('이름·첫 결제월·개월 수·금액을 적어 주세요');
      const y = x || { id: uid() };
      Object.assign(y, { name, cardId: val('cardId'), startMonth: val('start'), months, amount, note: val('note').trim() });
      if (list.length) y.amounts = list; else delete y.amounts;
      if (!x) S.installments.push(y);
      return LINKED;
    }, x ? () => { S.installments = S.installments.filter((y) => y !== x); return true; } : null);
  }
  function editDebt(id) {
    const d = id ? S.debts.find((y) => y.id === id) : null;
    formSheet(d ? '갚을·받을 돈 고치기' : '갚을·받을 돈 추가', [
      { name: 'dir', label: '방향', type: 'select', value: d ? d.dir : 'pay', options: [['pay', '갚을 돈'], ['recv', '받을 돈']] },
      { name: 'who', label: '누구 (또는 계좌)', value: d ? d.who : '', ph: '예: 친구, 사업계좌' },
      { name: 'reason', label: '사유', value: d ? d.reason || '' : '', ph: '예: 임시출금' },
      { name: 'amount', label: '금액', type: 'money', value: d ? d.amount : '' },
      { name: 'due', label: '예정일 (선택)', type: 'date', value: d ? d.due || '' : '' },
      { name: 'inForecast', label: '예정일에 흐름·예상잔액에 넣기', type: 'switch', value: d ? d.inForecast : false },
      { name: 'note', label: '메모 (선택)', value: d ? d.note || '' : '' },
    ], () => {
      const who = val('who').trim(); const amount = Math.abs(parseAmt(val('amount')));
      if (!who || !amount) return toast('누구와 금액을 적어 주세요');
      const y = d || { id: uid() };
      Object.assign(y, { dir: val('dir'), who, reason: val('reason').trim(), amount, due: val('due') || null, inForecast: val('inForecast'), note: val('note').trim() });
      if (!d) S.debts.push(y);
      return d ? LINKED : true;
    }, d ? () => { S.records = S.records.filter((r) => r.debtId !== d.id); S.debts = S.debts.filter((y) => y !== d); return true; } : null);
  }
  function debtSheet(id) {
    const d = S.debts.find((y) => y.id === id); const st = C.debtStatus(S, d);
    const hist = S.records.filter((r) => r.type === 'settle' && r.debtId === d.id);
    openSheet({
      title: d.who + ' · ' + (d.dir === 'pay' ? '갚을 돈' : '받을 돈'),
      body: () => '<div class="kv"><div><span>처음 금액</span><b>' + won(d.amount) + '</b></div><div><span>정산함</span><b>' + won(st.settled) + '</b></div><div><span>남은 금액</span><b>' + won(st.left) + '</b></div>' + (st.extra ? '<div><span>더 ' + (d.dir === 'pay' ? '갚은' : '받은') + ' 금액</span><b>' + won(st.extra) + '</b></div>' : '') + '</div>' +
        (d.reason || d.note ? '<p class="hint">' + esc([d.reason, d.note].filter(Boolean).join(' · ')) + '</p>' : '') +
        field({ name: 'amt', label: d.dir === 'pay' ? '이번에 갚은 금액' : '이번에 받은 금액', type: 'money', value: st.left || '' }) +
        '<label class="field"><span class="lab">' + (d.dir === 'pay' ? '나간 계좌' : '들어온 계좌') + '</span><select class="input" name="acc">' + methodOptions('', false) + '</select></label>' +
        (hist.length ? '<div class="sub-list">' + hist.map(recRow).join('') + '</div>' : ''),
      foot: () => '<button class="btn" data-act="settle" data-id="' + d.id + '">정산 기록</button><button class="btn ghost" data-act="editDebt" data-id="' + d.id + '">내용 고치기</button>',
    });
  }

  // ===== 캡처로 가져오기 (iPhone 글자 인식 → 붙여넣기 → 확인 후 저장) =====
  function parseCapture(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const y = today().slice(0, 4); const out = []; let lastDate = null;
    const dateRe = /(?:(20\d{2})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})일?/;
    const amtRe = /(-?\d{1,3}(?:,\d{3})+|-?\d{3,})\s*원/;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; const dm = l.match(dateRe);
      if (dm) lastDate = (dm[1] || y) + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[3]).padStart(2, '0');
      const am = l.match(amtRe); if (!am || /합계|총|잔액|한도|결제\s*예정|청구/.test(l)) continue;
      let name = l.replace(amtRe, '').replace(dateRe, '').replace(/\d{1,2}:\d{2}/, '').replace(/[|·•]/g, ' ').trim();
      if (!name && i > 0) name = lines[i - 1].replace(dateRe, '').replace(/\d{1,2}:\d{2}/, '').trim();
      out.push({ date: lastDate || today(), amount: Math.abs(parseAmt(am[1])), memo: name.slice(0, 30), cancel: /취소|환불/.test(l) });
    }
    return out;
  }
  function captureSheet(text) {
    let rows = null; let method = last.method || (S.cards[0] ? 'card:' + S.cards[0].id : 'account:' + S.accounts[0].id);
    openSheet({
      title: '캡처로 가져오기',
      body() {
        if (!rows) return '<p class="hint">카드·은행앱 사용내역을 캡처한 뒤 사진의 글자를 길게 눌러 <b>모두 선택 → 복사</b>하고 붙여넣어 주세요.</p><textarea class="input" name="raw" placeholder="여기에 붙여넣기">' + esc(text || '') + '</textarea>';
        if (!rows.length) return '<p class="hint center">읽을 수 있는 금액을 못 찾았어요.</p>';
        return '<label class="field"><span class="lab">결제수단 (모두 같게)</span><select class="input" name="imethod">' + methodOptions(method, true) + '</select></label><p class="hint">중복 의심은 빼 두었어요.</p><div class="sub-list">' +
          rows.map((r, i) => '<label class="row check"><input type="checkbox" data-live="pick" data-i="' + i + '"' + (r.pick ? ' checked' : '') + '><span class="grow"><span class="t">' + esc(r.memo || '이름 없음') + '</span><span class="s">' + md(r.date) + (r.dup ? ' · 중복 의심' : '') + (r.cancel ? ' · 취소' : '') + '</span></span><span class="amt">' + won(r.amount) + '</span></label>').join('') + '</div>';
      },
      foot: () => !rows ? '<button class="btn" data-act="capRead">읽기</button>' : '<button class="btn" data-act="capSave">선택한 것 저장</button><button class="btn ghost" data-act="capBack">다시 붙여넣기</button>',
    });
    sheet.cap = {
      read() { rows = parseCapture(val('raw') || '').map((r) => { r.dup = !!C.findDuplicate(S, r); r.pick = !r.dup && !r.cancel; return r; }); paintSheet(); },
      back() { rows = null; paintSheet(); },
      pick(i, on) { rows[i].pick = on; },
      save() {
        method = val('imethod'); const from = refOf(method); let n = 0;
        for (const r of rows.filter((x) => x.pick)) {
          const rec = { id: uid(), type: 'expense', amount: r.amount, date: r.date, memo: r.memo, cat: last.cat || '기타', from, at: now() };
          if (from.type === 'card') rec.payMonth = C.payMonthOf(card(from.id), r.date);
          S.records.push(rec); n++;
        }
        save(); closeSheet(); render(); toast(n + '건 가져왔어요');
      },
    };
  }

  // ===== 백업·이전 정보 묶음 =====
  function backupSheet() {
    openSheet({
      title: '백업·가져오기',
      body: () => '<p class="hint">전체 백업을 가져오면 지금 데이터가 바뀌어요. 이전 정보 묶음(money-seed)은 지금 데이터에 <b>더해요</b>. 이름이 같은 건 건너뛰어요.</p>' +
        '<textarea class="input" name="seed" placeholder="파일 내용을 붙여넣어도 돼요"></textarea><input type="file" id="importFile" accept=".json,application/json,text/plain" hidden>',
      foot: () => '<button class="btn" data-act="importPaste">붙여넣은 내용 가져오기</button><div class="grid2"><button class="btn ghost" data-act="importFile">파일 가져오기</button><button class="btn ghost" data-act="exportJSON">파일로 내보내기</button></div>',
      mount(el) { el.querySelector('#importFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) f.text().then(takeImport).catch(() => toast('이 파일은 읽을 수 없어요')); }); },
    });
  }
  function takeImport(txt) {
    let d; try { d = JSON.parse(txt); } catch (e) { return toast('이 내용은 읽을 수 없어요'); }
    if (d && d.kind === 'money-seed') return mergeSeed(d);
    if (d && d.v === 2) { if (!confirm('지금 데이터를 이 백업으로 바꿀까요?')) return; S = d; }
    else if (d && d.version && Array.isArray(d.txns)) { if (!confirm('예전 버전 백업이에요. 지금 데이터를 바꿀까요?')) return; S = fromV1(d); }
    else return toast('이 내용은 읽을 수 없어요');
    S.started = true; save(); closeSheet(); location.hash = '#/home'; render(); toast('가져왔어요');
  }
  function mergeSeed(d) {
    const findAcc = (n) => S.accounts.find((a) => a.name === n);
    const findCard = (n) => S.cards.find((c) => c.name === n);
    const add = { 계좌: 0, 카드: 0, 고정비: 0, 수입: 0, 대출: 0, '갚을·받을 돈': 0, 할부: 0 };
    const t = today(); const P = curP();
    for (const a of d.accounts || []) {
      let x = findAcc(a.name);
      if (!x) { x = { id: uid(), name: a.name, type: a.kind === 'overdraft' ? 'overdraft' : a.kind === 'local' ? 'local' : 'bank', include: a.kind !== 'local', balance: 0, balanceAt: 0, balanceDate: null }; S.accounts.push(x); add.계좌++; }
      if (a.kind === 'overdraft') { x.type = 'overdraft'; if (a.limit) x.limit = a.limit; }
      if (a.rate) x.rate = a.rate; if (a.note && !x.purpose) x.purpose = a.note;
    }
    const ref = (m) => { if (!m) return null; if (m.type === 'card') { const c = findCard(m.name); return c && { type: 'card', id: c.id }; } const a = findAcc(m.name); return a && { type: 'account', id: a.id }; };
    for (const c of d.cards || []) { if (findCard(c.name)) continue; const a = findAcc(c.account) || S.accounts[0]; if (!a) continue; S.cards.push({ id: uid(), name: c.name, payDay: c.payDay || 15, offset: c.payOffset == null ? 1 : c.payOffset, accountId: a.id }); add.카드++; }
    for (const r of d.recurring || []) {
      const m = ref(r.method); if (!m) continue;
      if (r.kind === 'income') { if (S.incomes.some((y) => y.name === r.name)) continue; S.incomes.push({ id: uid(), name: r.name, amount: r.amount, day: r.day, accountId: m.id, salary: !!r.salary, approx: !!r.approx, note: r.note || '', until: r.end || null, active: r.active !== false }); add.수입++; }
      else { if (S.fixed.some((y) => y.name === r.name)) continue; S.fixed.push({ id: uid(), name: r.name, amount: r.amount, day: r.day, dayText: r.dayText || '', pay: m, cat: r.category || '기타', approx: !!r.approx, note: r.note || '', until: r.end || null, active: r.active !== false }); add.고정비++; }
    }
    for (const l of d.loans || []) { if (S.loans.some((y) => y.name === l.name)) continue; const a = findAcc(l.payFrom); if (!a) continue; S.loans.push({ id: uid(), bank: l.bank || '', name: l.name, balance: l.balance || 0, balanceDate: t, rate: l.rate || null, monthly: l.monthly || 0, approx: !!l.approx, payDay: l.payDay, accountId: a.id, familyPayer: l.familyPayer || null, note: l.note || '', active: true }); add.대출++; }
    for (const b of d.debts || []) { if (S.debts.some((y) => y.who === b.person && y.reason === b.reason)) continue; S.debts.push({ id: uid(), dir: b.dir, who: b.person, reason: b.reason || '', amount: b.principal, due: b.dueDate || null, inForecast: false }); add['갚을·받을 돈']++; }
    for (const i of d.installments || []) { if (S.installments.some((y) => y.name === i.name)) continue; const c = findCard(i.card); if (!c) continue; S.installments.push({ id: uid(), name: i.name, cardId: c.id, startMonth: i.startPayMonth, months: i.months, amount: i.amount, note: i.note || '' }); add.할부++; }
    S.started = true; save(); closeSheet(); render();
    openSheet({ title: '이전 정보를 더했어요', body: () => '<div class="kv">' + Object.entries(add).map(([k, n]) => '<div><span>' + k + '</span><b>' + n + '개</b></div>').join('') + '</div><p class="hint">' + mName(P) + ' 급여주기부터 흐름에 들어가요. 계좌 잔액은 입력 탭에서 은행앱 숫자를 적어 주세요.</p>', foot: () => '<a class="btn" href="#/input">입력 탭으로</a>' });
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'money-backup-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ===== 예전 버전(v1) 데이터 옮기기 =====
  function fromV1(o) {
    const s = C.emptyState(); const t = today();
    s.settings.payDay = (o.settings && o.settings.cycleStartDay) || 25;
    const latest = (xs, f) => xs.filter(f).sort((a, b) => b.at - a.at)[0];
    const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
    for (const a of o.accounts || []) {
      const chk = latest(o.balanceChecks || [], (c) => c.accountId === a.id);
      s.accounts.push({ id: a.id, name: a.name, type: a.kind === 'overdraft' ? 'overdraft' : a.kind === 'local' ? 'local' : 'bank', include: a.include !== false, limit: a.limit, rate: a.rate || null, purpose: a.note || '', balance: chk ? chk.amount : 0, balanceAt: chk ? chk.at : 0, balanceDate: chk ? dstr(chk.at) : null });
    }
    for (const c of o.cards || []) {
      const app = {};
      for (const k of o.cardChecks || []) if (k.cardId === c.id && (!app[k.payMonth] || app[k.payMonth].at < k.at)) app[k.payMonth] = { amount: k.amount, at: k.at, date: dstr(k.at) };
      s.cards.push({ id: c.id, name: c.name, payDay: c.payDay, offset: c.payOffset == null ? 1 : c.payOffset, accountId: c.accountId, app });
    }
    for (const r of o.recurring || []) {
      const amt = (r.history || []).reduce((a, h) => h.amount, r.amount);
      if (r.kind === 'income') s.incomes.push({ id: r.id, name: r.name, amount: amt, day: r.day, accountId: r.to && r.to.id, salary: !!r.salary, approx: !!r.approx, note: r.note || '', from: r.start || null, until: r.end || null, active: r.active !== false });
      else s.fixed.push({ id: r.id, name: r.name, amount: amt, day: r.day, pay: r.method, cat: r.categoryId || '기타', approx: !!r.approx, note: r.note || '', from: r.start || null, until: r.end || null, active: r.active !== false });
    }
    for (const l of o.loans || []) s.loans.push({ id: l.id, bank: l.bank || '', name: l.name, balance: l.balance || 0, balanceDate: t, rate: l.rate || null, monthly: l.monthly || 0, approx: !!l.approx, payDay: l.payDay, accountId: l.payFrom, familyPayer: l.familyPayer || null, note: l.note || '', from: l.start || null, active: l.active !== false });
    for (const i of o.installments || []) s.installments.push({ id: i.id, name: i.name, cardId: i.cardId, startMonth: i.startPayMonth, months: i.months, amount: i.amount, amounts: i.amounts, note: i.note || '' });
    const ppl = {}; (o.people || []).forEach((p) => { ppl[p.id] = p.name; });
    for (const d of o.debts || []) s.debts.push({ id: d.id, dir: d.dir, who: ppl[d.personId] || '', reason: d.reason || '', amount: d.principal, due: d.dueDate || null, inForecast: !!d.includeInForecast });
    for (const x of o.txns || []) {
      const manual = x.source && x.source.manual;
      if (!(manual || x.kind === 'settle') || x.status !== 'done') continue;
      const r = { id: x.id, type: x.kind, amount: x.amount, date: x.date, memo: x.memo || '', cat: x.categoryId || null, from: x.from || null, to: x.to || null, at: x.recordedAt || now() };
      if (x.kind === 'settle') r.debtId = x.debtId;
      if (x.from && x.from.type === 'card') { r.payMonth = x.cardPayMonth; if (x.reflect === 'reflected') r.reflected = true; }
      s.records.push(r);
    }
    for (const c of o.categories || []) if (s.categories.indexOf(c) < 0 && c !== '급여' && c !== '대출') s.categories.push(c);
    s.started = true;
    return s;
  }

  // ---------- 동작 ----------
  const A = {
    closeSheet,
    period(d) { view.P = C.addMonths(view.P, Number(d.d)); render(); },
    addRecord(d) { if (!S.accounts.length) return toast('계좌를 먼저 추가해 주세요'); recordSheet(null, d.card && S.cards[0] ? { from: { type: 'card', id: S.cards[0].id } } : null); },
    editRecord(d) { const r = S.records.find((x) => x.id === d.id); if (r) recordSheet(r); },
    recType(d) { const rec = sheet.rec; rec.x.amount = Math.abs(parseAmt(val('amt'))); rec.x.memo = val('memo'); rec.x.date = val('date'); rec.f.type = d.k; rec.f.cat = d.k === 'income' ? '급여' : rec.f.cat === '급여' ? last.cat || '식비' : rec.f.cat; paintSheet(); },
    recCat(d) { sheet.rec.f.cat = d.c; document.querySelectorAll('#sheet .cat').forEach((b) => b.classList.toggle('on', b.dataset.c === d.c)); recHint(); },
    addAmt(d) { const el = document.querySelector('#sheet [name=amt]'); el.value = won(Math.abs(parseAmt(el.value)) + Number(d.n)); },
    saveRecord,
    deleteRecord(d) { if (!confirm('이 기록을 지울까요?')) return; S.records = S.records.filter((x) => x.id !== d.id); save(); closeSheet(); render(); toast('지웠어요 · 잔액과 흐름에서도 빠졌어요'); },
    bookCat(d) { view.cat = d.k; render(); },
    goBook() { location.hash = '#/book'; },
    capture: () => captureSheet(), capRead: () => sheet.cap.read(), capBack: () => sheet.cap.back(), capSave: () => sheet.cap.save(),
    sched: (d) => schedSheet(d.k, d.p),
    schedSave(d) {
      const it = sheet.item; const amt = Math.abs(parseAmt(val('amt'))); const date = val('date');
      const o = Object.assign({}, S.over[d.k]);
      if (amt === it.planned) delete o.amount; else o.amount = amt;
      if (!date || date === it.plannedDate) delete o.date; else o.date = date;
      S.over[d.k] = o; save(); closeSheet(); render(); toast(mName(d.p) + '만 바꿨어요 · 흐름과 잔액에 반영됐어요');
    },
    schedSkip(d) { const o = Object.assign({}, S.over[d.k]); o.skip = !o.skip; S.over[d.k] = o; save(); closeSheet(); render(); toast(o.skip ? '이번 달은 건너뛰어요' : '다시 넣었어요'); },
    schedReset(d) { delete S.over[d.k]; save(); closeSheet(); render(); toast('기본값으로 되돌렸어요'); },
    cardApp: (d) => cardApp(d.id, d.m),
    cardAppSave(d) {
      const c = card(d.id); const v = val('amt'); const p = val('paid');
      if (String(v).trim() !== '') { const amt = Math.abs(parseAmt(v)); const prev = c.app && c.app[d.m]; if (!prev || prev.amount !== amt) c.app = Object.assign({}, c.app, { [d.m]: { amount: amt, at: now(), date: today() } }); }
      const k = 'card:' + d.id + ':' + d.m;
      if (String(p).trim() !== '') S.over[k] = { amount: Math.abs(parseAmt(p)) }; else delete S.over[k];
      save(); closeSheet(); render(); toast('카드값을 맞췄어요 · 현황과 흐름에 반영됐어요');
    },
    toggleRefl: (d) => toggleRefl(d.k, d.id, d.m),
    balance: (d) => balanceSheet(d.id),
    saveBalance(d) {
      const a = acct(d.id); const v = Math.abs(parseAmt(val('amt'))); const nb = a.type === 'overdraft' ? -v : v;
      const gap = nb - C.accountBalance(S, d.id, today());
      a.balance = nb; a.balanceAt = now(); a.balanceDate = today(); save(); closeSheet(); render();
      toast(gap === 0 ? '기록과 잔액이 딱 맞아요' : '잔액을 맞췄어요 · 기록 안 된 금액 ' + (gap > 0 ? '+' : '−') + won(gap) + '원');
    },
    inputSave() { const n = applyInputs(S, document.querySelector('.screen')); if (!n) return toast('고친 칸이 없어요'); save(); render(); toast(n + '칸 저장했어요 · 모든 탭에 반영됐어요'); },
    inputReset() { render(); toast('되돌렸어요'); },
    editAccount: (d) => editAccount(d.id), editCard: (d) => editCard(d.id), editFixed: (d) => editFixed(d.id), fixedInfo: (d) => fixedInfo(d.id), editIncome: (d) => editIncome(d.id),
    editLoan: (d) => editLoan(d.id), editInst: (d) => editInst(d.id), editDebt: (d) => editDebt(d.id), debt: (d) => debtSheet(d.id),
    formSave() { const r = sheet.onSave(); if (r === true || typeof r === 'string') { save(); closeSheet(); render(); toast(r === true ? '저장했어요' : r); } },
    formDelete() { if (!confirm('삭제할까요?')) return; if (sheet.onDelete() !== false) { save(); closeSheet(); render(); toast('삭제했어요 · 모든 탭에서 빠졌어요'); } },
    settle(d) {
      const debt = S.debts.find((x) => x.id === d.id); const amt = Math.abs(parseAmt(val('amt'))); const acc = refOf(val('acc'));
      if (!amt) return toast('금액을 적어 주세요');
      const r = { id: uid(), type: 'settle', debtId: debt.id, amount: amt, date: today(), memo: debt.who + ' 정산', at: now() };
      if (debt.dir === 'recv') r.to = acc; else r.from = acc;
      S.records.push(r); save(); closeSheet(); render(); toast('정산했어요 · 남은 금액과 잔액이 바뀌었어요');
    },
    setPayDay() { formSheet('급여일', [{ name: 'd', label: '매월', type: 'select', value: S.settings.payDay, options: dayOpts.slice(0, 28) }], () => { S.settings.payDay = Number(val('d')); view.P = null; return LINKED; }); },
    backup: () => { const w = document.getElementById('wPay'); if (w) S.settings.payDay = Number(w.value); backupSheet(); },
    importPaste() { const t = (val('seed') || '').trim(); if (!t) return toast('내용을 붙여넣어 주세요'); takeImport(t); },
    importFile: () => document.getElementById('importFile').click(),
    exportJSON,
    remigrate() { if (!confirm('예전 버전 데이터로 지금 데이터를 바꿀까요?')) return; S = fromV1(readJSON(OLDKEY)); save(); location.hash = '#/home'; render(); toast('예전 데이터를 가져왔어요'); },
  };
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) { if (ev.target.id === 'scrim') closeSheet(); return; }
    const fn = A[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') ev.preventDefault();
    if (el.dataset.act === 'editAccount' && !S.accounts.length) { const w = document.getElementById('wPay'); if (w) S.settings.payDay = Number(w.value); }
    fn(el.dataset, el, ev);
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target; const live = el.dataset && el.dataset.live;
    if (live === 'money') {
      const n = Math.abs(parseAmt(el.value)); el.value = el.value.trim() === '' ? '' : won(n);
      if (el.dataset.est != null) { const g = n - Number(el.dataset.est); const gap = document.getElementById('gap'); if (gap) gap.textContent = (g > 0 ? '+' : g < 0 ? '−' : '') + won(g); }
      recHint();
    } else if (live === 'hint') recHint();
    else if (live === 'pick') sheet.cap.pick(Number(el.dataset.i), el.checked);
    if (view.tab === 'input' && !sheet) inputPreview();
  });
  document.addEventListener('change', (ev) => { if (ev.target.dataset && ev.target.dataset.live === 'hint') recHint(); if (view.tab === 'input' && !sheet) inputPreview(); });

  function route() {
    const h = location.hash || '#/home';
    if (h.indexOf('#/import') === 0) { const q = h.split('?t=')[1]; history.replaceState(null, '', '#/book'); view.tab = 'book'; render(); if (S.accounts.length) captureSheet(q ? decodeURIComponent(q) : ''); return; }
    const tab = h.replace('#/', '');
    view.tab = TABS.some((x) => x[0] === tab) || tab === 'settings' ? tab : 'home';
    if (view.tab === 'home') view.P = curP();
    closeSheet(); render(); window.scrollTo(0, 0);
  }
  S = load();
  window.addEventListener('hashchange', route);
  window.App = { get state() { return S; }, render };
  if (migrated) { save(); setTimeout(() => toast('예전 버전 데이터를 옮겨 왔어요'), 400); }
  route();
})();
