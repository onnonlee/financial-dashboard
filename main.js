// 머니 v2 화면. 숫자는 모두 Core(core.js)가 기본 정보와 가계부에서 계산하고, 여기서는 보여주고 입력만 받음.
(function () {
  'use strict';
  const C = window.Core;
  const KEY = 'money.v2';
  const OLDKEY = 'money.v1';
  const VERSION = '2.34';

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
  // 월급이 없으면 '급여주기' 대신 그냥 '달'로 보여줌 (계산은 같음: 정한 날짜부터 다음 달 그 전날까지)
  const noSal = () => !!S.settings.noSalary;
  const PW = () => noSal() ? '' : ' 급여주기';
  // 1일부터 끊으면 10/1~10/31은 '10월'로 (급여주기는 다음 급여 달 이름)
  const pName = (P) => S.settings.payDay === 1 ? mName(C.addMonths(P, -1)) : mName(P);
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
    mRepeat: sv('<path d="M17 2.5 20.5 6 17 9.5"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="m7 21.5L3.5 18 7 14.5"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>'),
    mCard: sv('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M7 14.5h4"/>'),
    mLoan: sv('<path d="M3 10.5 12 4l9 6.5"/><path d="M5 10.5V19M9.5 10.5V19M14.5 10.5V19M19 10.5V19"/><path d="M3 20h18"/>'),
    mWallet: sv('<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="17" height="11.5" rx="2.5"/><path d="M16 13.5h5"/><circle cx="16" cy="13.75" r=".6" fill="currentColor"/>'),
    mIncome: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M8.5 13l3.5 3.5 3.5-3.5"/>'),
    mSwap: sv('<path d="M4 8.5h13"/><path d="m13.5 5 3.5 3.5L13.5 12"/><path d="M20 15.5H7"/><path d="m10.5 12-3.5 3.5 3.5 3.5"/>'),
    mLocal: sv('<path d="M12 21s-6.5-5.2-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.8 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>'),
    mEdit: sv('<path d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20z"/><path d="m13.5 9 2.5 2.5"/>'),
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
    koAll(el); if (sheet.mount) sheet.mount(el);
    if (sheet.focus && !sheet.focused) { sheet.focused = true; const f = el.querySelector(sheet.focus); if (f) setTimeout(() => focusAmt(f), 60); }
  }
  function closeSheet() {
    closePad();
    const el = document.getElementById('sheet'); el.classList.remove('on');
    document.getElementById('scrim').hidden = true; el.hidden = true; sheet = null;
  }
  const val = (name) => { const el = document.querySelector('#sheet [name="' + name + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };

  // 입력 칸 하나
  const dayOpts = Array.from({ length: 31 }, (_, i) => [i + 1, i + 1 + '일']);
  // 금액 읽어 주기: 3,205,000 → '320만 5,000원' (0을 몇 개 쳤는지 헷갈리지 않게 입력 칸 아래에 보여줌)
  const koWon = (n) => { n = Math.round(Math.abs(n)); if (!n) return ''; const e = Math.floor(n / 1e8), m = Math.floor(n % 1e8 / 1e4), r = n % 1e4;
    return [e ? e + '억' : '', m ? won(m) + '만' : '', r ? won(r) : ''].filter(Boolean).join(' ') + '원'; };
  // 금액 칸 아래: '320만 5,000원' 읽어 주기
  function koFill(el) {
    const box = el.closest('.money'); if (!box || box.closest('.in-row, .dyn-grid')) return;
    let row = box.nextElementSibling;
    if (!row || !row.classList.contains('ko-row')) { row = document.createElement('div'); row.className = 'ko-row'; row.innerHTML = '<span class="ko-amt"></span>'; box.after(row); }
    // 큰 금액 칸은 비어 있으면 0원으로
    row.querySelector('.ko-amt').textContent = koWon(parseAmt(el.value)) || (box.matches('.big, .huge') ? '0원' : '');
  }
  const koAll = (root) => { (root || document).querySelectorAll('[data-live=money]').forEach(koFill); padMark(root); };
  // ===== 앱 전용 숫자 키패드 (큰 금액 칸, 휴대폰만): 1~9, 00, 0, 지우기 + 위에 읽어 주기와 파란 확인 =====
  const PAD_SEL = '.money.big .input, .money.huge .input';
  let padEl = null;
  // 손가락으로 쓰는 기기(휴대폰·태블릿)에서만 키패드, PC는 원래 키보드로
  const PAD_ON = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  function padMark(root) { if (!PAD_ON) return; (root || document).querySelectorAll(PAD_SEL).forEach((el) => { el.readOnly = true; el.setAttribute('inputmode', 'none'); el.closest('.money').classList.add('pad'); }); }
  function padOk() { return document.getElementById('obSal') && padEl && padEl.to && padEl.to.id === 'obSal' ? ['obSalOk', '확인'] : ['padClose', '완료']; }
  function openPad(el) {
    if (!el) return;
    let p = document.getElementById('pad');
    if (!p) { p = document.createElement('div'); p.id = 'pad'; document.body.appendChild(p); }
    padEl = { to: el };
    document.querySelectorAll('.money.pad-on').forEach((m) => m.classList.remove('pad-on')); el.closest('.money').classList.add('pad-on');
    const [act, label] = padOk();
    const key = (k, l) => '<button type="button" data-act="padKey" data-k="' + k + '">' + (l || k) + '</button>';
    p.innerHTML = '<div class="pad-units"><span class="pad-ko"></span></div>' +
      '<button type="button" class="pad-ok" data-act="' + act + '">' + label + '</button>' +
      '<div class="pad-keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => key(n)).join('') + key('00') + key('0') + key('del', I.left) + '</div>';
    p.hidden = false; document.body.classList.add('pad-open'); requestAnimationFrame(() => p.classList.add('on')); padKo();
    setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 120);
  }
  function closePad() { const p = document.getElementById('pad'); padEl = null; document.body.classList.remove('pad-open'); document.querySelectorAll('.money.pad-on').forEach((m) => m.classList.remove('pad-on')); if (p) { p.classList.remove('on'); p.hidden = true; } }
  function padKo() { const k = document.querySelector('#pad .pad-ko'); if (k && padEl) k.textContent = koWon(parseAmt(padEl.to.value)) || '0원'; }
  const focusAmt = (el) => { if (!el) return; if (PAD_ON && el.matches(PAD_SEL)) openPad(el); else el.focus(); };
  function field(f) {
    const lab = '<span class="lab">' + esc(f.label) + (f.sub ? ' <em>' + esc(f.sub) + '</em>' : '') + '</span>';
    if (f.type === 'switch') return '<label class="switch"><span>' + esc(f.label) + (f.hint ? '<small>' + esc(f.hint) + '</small>' : '') + '</span><input type="checkbox" name="' + f.name + '"' + (f.value ? ' checked' : '') + '><i></i></label>';
    if (f.type === 'select') return '<label class="field">' + lab + '<select class="input" name="' + f.name + '">' + f.options.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(f.value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>';
    if (f.type === 'money') return '<label class="field">' + lab + '<div class="money"><input class="input" name="' + f.name + '" inputmode="numeric" pattern="[0-9]*" data-live="money" value="' + (f.value != null && f.value !== '' ? won(f.value) : '') + '" placeholder="' + esc(f.ph || '0') + '"><span>원</span></div></label>';
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
    for (const f of S.fixed) if (f.base) f.amount = C.fixedAmount(f, curP());
    // 통장 없이 적어 둔 수입은 통장이 생기면 같은 은행 통장(없으면 첫 입출금 통장)으로
    if (S.onboard == null && S.accounts.length && S.incomes.some((x) => !acct(x.accountId))) { for (const x of S.incomes) if (!acct(x.accountId)) x.accountId = (accOfBank(x.bank) || acct((salaryOf() || {}).accountId) || S.accounts.find((a) => a.type === 'bank') || S.accounts[0]).id; save(); }
    if (padEl) closePad();
    if (onboarding()) { app.innerHTML = onboard(); koAll(app); return; }
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
    return '<div class="period"><button class="icon-btn" data-act="period" data-d="-1" aria-label="이전 달">' + I.left + '</button><div><b>' + pName(P) + PW() + '</b><span>' + md(r.start) + ' – ' + md(r.end) + (P === curP() ? ' · 지금' : '') + '</span></div><button class="icon-btn" data-act="period" data-d="1" aria-label="다음 달">' + I.rightL + '</button></div>';
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
  // 은행 이름 [알아보는 글자, 칩 색, 이름]. 앞쪽 은행이 고르기 목록에 나옴 (카드사는 칩 색만)
  const BANK = [[/국민|KB|종합통장/i, 'kb', '국민'], [/신한|쏠편한|쓸편한/, 'sh', '신한'], [/하나/, 'hn', '하나'], [/우리/, 'wr', '우리'], [/농협|NH/i, 'nh', '농협'], [/기업|IBK/i, 'ibk', '기업'],
    [/카카오/, 'kk', '카카오뱅크'], [/토스/, 'ts', '토스뱅크'], [/케이뱅크|K\s?뱅크/i, 'kbank', '케이뱅크'], [/SC|제일/i, 'etc', 'SC제일'], [/씨티/, 'etc', '씨티'], [/부산/, 'etc', '부산'], [/iM|대구/i, 'etc', 'iM뱅크'],
    [/경남/, 'etc', '경남'], [/광주/, 'etc', '광주'], [/전북/, 'etc', '전북'], [/제주/, 'etc', '제주'], [/수협/, 'etc', '수협'], [/우체국/, 'etc', '우체국'], [/새마을|MG/i, 'etc', '새마을금고'], [/신협/, 'etc', '신협'], [/산업|KDB/i, 'etc', '산업'],
    [/삼성/, 'ss', '삼성'], [/현대/, 'hd', '현대'], [/롯데/, 'lt', '롯데']];
  const BANK_NAMES = BANK.slice(0, 22).map((b) => b[2]);
  const SHORT = { 카카오뱅크: '카카오', 토스뱅크: '토스', 케이뱅크: '케이', 새마을금고: '새마을', SC제일: 'SC', iM뱅크: 'iM' };
  const bankOf = (n) => { if (!n || /카드/.test(n)) return null; const b = BANK.slice(0, 22).find((x) => x[0].test(n)); return b ? b[2] : null; };
  // 은행 아이콘: 은행 로고, 없으면(카드사 등) 색 + 글자
  const LOOK = { 국민: ['#FFBC00', '#4a3500', 'KB'], 신한: ['#0046FF', '#fff', '신한'], 하나: ['#00927C', '#fff', '하나'], 우리: ['#0B6FB8', '#fff', '우리'], 농협: ['#00A54F', '#fff', 'NH'], 기업: ['#0056A6', '#fff', 'IBK'],
    카카오뱅크: ['#FFE500', '#3a2a00', 'kakao'], 토스뱅크: ['#0064FF', '#fff', 'toss'], 케이뱅크: ['#1D1E5F', '#fff', 'K'], SC제일: ['#0A7A3E', '#fff', 'SC'], 씨티: ['#0A3D7A', '#fff', 'citi'], 부산: ['#D7141A', '#fff', 'BNK'],
    iM뱅크: ['#00A3E0', '#fff', 'iM'], 경남: ['#D7141A', '#fff', 'BNK'], 광주: ['#0060AF', '#fff', 'JB'], 전북: ['#0060AF', '#fff', 'JB'], 제주: ['#2A62D9', '#fff', '제주'], 수협: ['#0072BC', '#fff', 'Sh'],
    우체국: ['#E2231A', '#fff', '우체국'], 새마을금고: ['#0A4EA2', '#fff', 'MG'], 신협: ['#0072C6', '#fff', 'CU'], 산업: ['#00479B', '#fff', 'KDB'], 삼성: ['#1428A0', '#fff', '삼성'], 현대: ['#222', '#fff', '현대'], 롯데: ['#E60012', '#fff', '롯데'] };
  // 은행 로고 (토스 송금 '은행 선택' 화면에서 잘라 banks/ 폴더에 둠)
  const LOGO_FILE = { 국민: 'kb', 신한: 'shinhan', 하나: 'hana', 우리: 'woori', 농협: 'nh', 기업: 'ibk', 카카오뱅크: 'kakao', 토스뱅크: 'toss', 케이뱅크: 'kbank', SC제일: 'sc', 씨티: 'citi', 부산: 'busan',
    iM뱅크: 'im', 경남: 'kyongnam', 광주: 'kwangju', 전북: 'jeonbuk', 제주: 'jeju', 수협: 'suhyup', 우체국: 'post', 새마을금고: 'mg', 신협: 'cu', 산업: 'kdb' };
  function bankIcon(bank, cls) {
    const k = bank && LOOK[bank] ? bank : bankOf(bank || '') || (BANK.find((x) => x[0].test(bank || '')) || [])[2];
    if (k && LOGO_FILE[k]) return '<span class="bico img' + (cls ? ' ' + cls : '') + '"><img src="banks/' + LOGO_FILE[k] + '.png" alt="' + esc(k) + '"></span>';
    const L = LOOK[k] || ['var(--soft)', 'var(--text2)', (bank || '?').slice(0, 2)];
    return '<span class="bico' + (cls ? ' ' + cls : '') + (L[2].length > 3 ? ' long' : '') + '" style="background:' + L[0] + ';color:' + L[1] + '">' + esc(L[2]) + '</span>';
  }
  const bankChip = (name) => bankIcon(name);
  // 은행 고르기: 버튼을 누르면 토스처럼 아래에서 '은행을 선택해주세요' 창이 올라옴 (3칸 타일)
  const bankField = (name, value, attrs) => '<input type="hidden" name="' + name + '" value="' + esc(value || '') + '"' + (attrs || '') + '>' +
    '<button type="button" class="bank-btn' + (value ? '' : ' empty') + '" data-act="bankOpen" data-f="' + name + '">' + (value ? bankIcon(value) + '<b>' + esc(value) + '</b>' : '<span class="bico q">?</span><b>은행 고르기</b>') + '<span class="chev">' + I.right + '</span></button>';
  // 토스 송금 화면과 같은 순서·이름표
  const POP_ORDER = ['농협', '카카오뱅크', '국민', '토스뱅크', '신한', '우리', '기업', '하나', '새마을금고', '부산', 'iM뱅크', '케이뱅크', '신협', '우체국', 'SC제일', '경남', '광주', '수협', '전북', '제주', '씨티', '산업'];
  const POP_LABEL = { 농협: 'NH농협', 국민: 'KB국민', 기업: 'IBK기업', 새마을금고: '새마을', 산업: 'KDB산업' };
  const bankScope = () => document.querySelector('#sheet:not([hidden])') || document;
  function bankPop(f) {
    const cur = (bankScope().querySelector('[name="' + f + '"]') || {}).value;
    let el = document.getElementById('bankPop');
    if (!el) { el = document.createElement('div'); el.id = 'bankPop'; document.body.appendChild(el); }
    el.innerHTML = '<div class="bp-scrim" data-act="bankClose"></div><section class="bp" role="dialog" aria-modal="true"><i class="bp-grab"></i><h3>은행을 선택해주세요</h3><div class="bp-grid">' +
      POP_ORDER.map((b) => '<button type="button" class="bp-tile' + (b === cur ? ' on' : '') + '" data-act="bankPick" data-f="' + f + '" data-b="' + b + '">' + bankIcon(b, 'xl') + '<span>' + (POP_LABEL[b] || b) + '</span></button>').join('') +
      '</div></section>';
    el.hidden = false; requestAnimationFrame(() => el.classList.add('on'));
  }
  function bankClose() { const el = document.getElementById('bankPop'); if (!el) return; el.classList.remove('on'); el.hidden = true; }
  const acctChip = (a) => bankChip(a.bank || a.name);

  // ===== 이번 급여로 버티면 (이전 대시보드의 전체자금예상) =====
  function hero(link) {
    const st = C.status(S, today());
    const ahead = st.daysLeft <= 10;
    const P = ahead ? C.addMonths(st.P, 1) : st.P;
    const f = C.flow(S, P, today());
    const short = f.left < 0; const L = f.lines;
    const lines = [['수입', L.income, 'in'], ['카드값', -L.card], ['통장 고정비', -L.fixed], ['대출·이자', -L.loan], ['가계부 통장 지출', -L.living], ['정산·기타', -L.other]].filter((x, i) => i < 4 || x[1]);
    return '<' + (link ? 'a href="#/flow"' : 'section') + ' class="hero tint ' + (short ? 'red' : 'amber') + '"><span class="hero-label">전체자금예상 <span class="pill-s">' + (short ? '부족' : '여유') + '</span></span>' +
      '<span class="hero-num">' + (short ? '− ' : '+ ') + won(f.left) + '원</span><span class="hero-sub">' + (ahead ? (noSal() ? md(C.addDays(st.end, 1)) + '부터 ' + pName(P) + ' 예상' : md(C.addDays(st.end, 1)) + ' 급여로 ' + pName(P) + ' 버티면') : pName(P) + ' 수입과 전체 지출 기준') + '</span>' +
      '<div class="hero-lines">' + lines.map(([l, n, c]) => '<div><span>' + l + '</span><b' + (c ? ' class="' + c + '"' : '') + '>' + (n > 0 ? '+' : n < 0 ? '−' : '') + won(n) + '</b></div>').join('') + '</div></' + (link ? 'a' : 'section') + '>';
  }

  // ===== 현황: 머리 카드 (지금 쓸 수 있는 돈) =====
  function homeMast(st) {
    const t = today();
    const ahead = st.daysLeft <= 10; const P = ahead ? C.addMonths(st.P, 1) : st.P;
    const f = C.flow(S, P, t); const short = f.left < 0;
    return '<header class="masthead"><div class="mast home"><div class="mast-top"><div><p class="mast-lab">지금 쓸 수 있는 돈</p><b class="mast-num">' + wonS(st.spendable) + '<em>원</em></b></div>' +
      '<a class="mast-btn" href="#/settings" aria-label="설정">' + I.gear + '</a></div>' +
      '<p class="mast-sub">' + pName(st.P) + PW() + ' · ' + md(st.start) + ' – ' + md(st.end) + ' · <b>' + st.daysLeft + '일 남음</b></p>' +
      '<div class="mast-chips"><a href="#/flow" class="' + (short ? 'bad' : 'good') + '"><span>' + (noSal() ? (ahead ? pName(P) : '이번 달') : ahead ? mName(P) + ' 급여로' : '이번 급여로') + '</span><b>' + (short ? '부족 −' : '여유 +') + won(f.left) + '</b></a>' +
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
    h += '<a class="card period-card" href="#/flow">' + head(pName(st.P) + PW(), st.daysLeft + '일 남음' + I.right) +
      '<div class="trio"><div><span>수입</span><b class="in">' + won(L.income) + '</b></div><div><span>나갈 돈</span><b>' + won(out) + '</b></div><div><span>남는 돈</span><b class="' + (f.left < 0 ? 'warn' : '') + '">' + wonS(f.left) + '</b></div></div>' +
      '<div class="prog"><i style="width:' + Math.round(100 * Math.min(1, out ? done / out : 0)) + '%"></i><u style="left:' + Math.round(elapsed * 100) + '%"></u></div><div class="prog-lab"><span>나간 돈 ' + won(done) + '</span><span>오늘 · ' + Math.round(elapsed * 100) + '% 지남</span></div></a>';

    // 3. 다가오는 입출금 3건
    const up = st.upcoming.filter((x) => !x.skip && !x.done);
    if (up.length) h += '<section class="card">' + head('다가오는 입출금', up.length + '건 · −' + won(st.outflow), 'flow') + up.slice(0, 3).map((x) => schedRow(x, st.P)).join('') + '</section>';

    // 4. 내 돈: 계좌·카드값·대출 한 줄씩
    const nc = st.nextCards[0]; const Ls = C.loanSummary(S, t);
    const mine = (href, ic, lab, t1, amt, cls) => '<a class="row" href="' + href + '"><span class="lead"><span class="m-ic ' + ic + '">' + lab + '</span></span><span class="grow"><span class="t">' + t1[0] + '</span><span class="s">' + t1[1] + '</span></span><span class="end"><span class="amt' + (cls ? ' ' + cls : '') + '">' + amt + '</span></span><span class="chev">' + I.right + '</span></a>';
    h += '<section class="card">' + head('내 돈', '') +
      mine('#/accounts', 'teal', I.mWallet, ['계좌 ' + S.accounts.length + '개', aa ? shortDate(aa) + ' 확인 · 마통 남은 한도 포함' : '잔액을 아직 안 적었어요'], wonS(st.spendable)) +
      (nc ? mine('#/cards', 'indigo', I.mCard, [mName(nc.payMonth) + ' 카드값', md(nc.payDate) + ' 출금 · ' + st.nextCards.map((b) => esc(b.card.name)).join(' + ')], '−' + won(st.nextCardTotal)) : '') +
      (Ls.total ? mine('#/loans', 'red', I.mLoan, ['대출 남은 돈', '매달 내 부담 ' + won(Ls.monthlySelf) + '원' + (Ls.order[0] ? ' · 먼저 갚을 것 ' + esc(Ls.order[0].name) : '')], won(Ls.total)) : '') +
      (st.local ? mine('#/accounts', 'green', I.mLocal, ['지역화폐', '쓸 수 있는 돈과 따로 세요'], won(st.local)) : '') + '</section>';

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
    return row({ act: 'balance', data: { id: a.id }, lead: acctChip(a), t: esc(a.name) + (a.include === false ? badge('합계 제외', 'gray') : ''), s: od ? won(used) + ' / ' + won(a.limit) + ' 사용' : ago(a.balanceAt), extra: od && a.limit ? meter(used / a.limit) : '', amt: wonS(x.available), end: od ? '남은 한도' : '' });
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
    h += '<section class="card">' + head(pName(P) + PW() + ' 수입', '실제로 들어온 금액') + (sch.length ? sch.map((x) => inRow('in:' + x.key, x.name, x.amount, md(x.date) + ' · 기본 ' + won(x.planned) + '원')).join('') : '<p class="hint">정기 수입이 없어요. 수입 탭에서 급여를 추가해 주세요.</p>') + '</section>';
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
  const inRow = (k, label, v, sub) => '<label class="in-row"><span class="grow"><span class="t">' + esc(label) + '</span><span class="s">' + esc(sub || '') + '</span></span><span class="money"><input class="input" inputmode="numeric" pattern="[0-9]*" data-live="money" data-k="' + esc(k) + '" data-orig="' + (v === '' ? '' : Math.round(v)) + '" value="' + (v === '' ? '' : won(v)) + '" placeholder="0"><span>원</span></span></label>';
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
    const has = INFO_KEYS.some((k) => inf[k]) || !!inf.extra || !!x.base || !!(x.perks || []).length;
    openSheet({
      title: x.name,
      body: () => '<div class="info-top"><b>' + amtText(x) + '</b><span>매월 ' + esc(dayText(x)) + ' · ' + esc(refName(x.pay)) + (x.cat ? ' · ' + esc(x.cat) : '') + '</span></div>' +
        billHtml(x) +
        (inf.extra ? '<div class="info-extra"><span>특이사항</span><p>' + esc(inf.extra) + '</p></div>' : '') +
        (INFO_KEYS.some((k) => inf[k]) ? '<div class="info-list">' + INFO_KEYS.filter((k) => inf[k]).map((k) => '<div><span>' + INFO_LAB[k] + '</span><b>' + esc(k === 'contractEnd' ? inf[k].replace(/-/g, '.') + (daysTo(inf[k]) >= 0 ? ' (D-' + daysTo(inf[k]) + ')' : ' (끝남)') : inf[k]) + '</b></div>').join('') + '</div>'
          : has ? '' : '<p class="hint">가입한 곳, 요금제, 약정 끝나는 날, 해지 방법, 특이사항을 적어 두면 나중에 찾을 필요가 없어요.</p>') +
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
    const item = (tab, name, sub, amt, ic, icn) => '<a class="row" href="#/' + tab + '"><span class="lead"><span class="m-ic ' + ic + '">' + I[icn] + '</span></span><span class="grow"><span class="t">' + name + '</span><span class="s">' + sub + '</span></span><span class="end"><span class="amt">' + amt + '</span></span><span class="chev">' + I.right + '</span></a>';
    const grp = (title, rows) => '<section class="card menu"><h3 class="grp">' + title + '</h3>' + rows.join('') + '</section>';
    let h = soonCard();
    h += grp('매달 나가는 돈', [
      item('fixed', '구독·고정비', fx.length + '개 · 통신비·보험·구독', '월 ' + won(fx.reduce((a, x) => a + x.amount, 0)), 'blue', 'mRepeat'),
      item('cards', '카드·할부', S.cards.length + '개 카드 · 할부 ' + S.installments.length + '건', won(st.nextCardTotal || 0), 'indigo', 'mCard'),
      item('loans', '대출', '매달 내 부담 ' + won(L.monthlySelf) + '원', won(L.total), 'red', 'mLoan'),
    ]);
    h += grp('내 돈', [
      item('accounts', '계좌', S.accounts.length + '개 · 쓸 수 있는 돈', wonS(st.spendable), 'teal', 'mWallet'),
      item('income', '수입', inc.length + '개 · 급여·정기 수입', '월 ' + won(inc.reduce((a, x) => a + x.amount, 0)), 'green', 'mIncome'),
      item('debts', '갚을·받을 돈', '받을 돈 ' + won(get) + '원', won(pay), 'amber', 'mSwap'),
    ]);
    h += grp('관리', [
      item('input', '한 번에 입력', '잔액·카드값을 한 화면에서 고쳐요', '', 'gray', 'mEdit'),
      item('settings', '설정·백업', '급여일, 분류, 백업 내보내기', '', 'gray', 'gear'),
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
    }).join('') + L.interestFixed.slice().sort((a, b) => a.day - b.day).map((f) => row({ act: 'editFixed', data: { id: f.id }, lead: f.pay && f.pay.type === 'account' && acct(f.pay.id) ? acctChip(acct(f.pay.id)) : bankChip(refName(f.pay)), cls: 'wrap', t: esc(f.name), s: esc(dayText(f)) + ' · 이자' + (f.note ? ' · ' + esc(f.note) : ''), amt: amtText(f) })).join('') || '<p class="hint">대출이 없어요</p>') + '</section>';
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
      return '<section class="card"><div class="acct-head"><div><h2>' + acctChip(a) + ' ' + esc(a.name) + '</h2><span class="s">' + (od ? '마이너스통장' : a.type === 'local' ? '지역화폐' : '입출금') + ' · ' + ago(a.balanceAt) + '</span></div><button class="btn sm soft" data-act="balance" data-id="' + a.id + '">잔액 고치기</button></div>' +
        '<div class="big-num">' + wonS(x.available) + '원<span>' + (od ? '남은 한도' : '현재 잔액') + '</span></div>' + (od && a.limit ? meter(used / a.limit) : '') +
        '<div class="kv">' + (od ? kv('현재 사용액', won(used)) + kv('총 한도', won(a.limit)) : '') + (a.rate ? kv('이율', '연 ' + a.rate + '%') + (od ? kv('매월 예상 이자', '약 ' + won(used * a.rate / 1200)) : '') : '') + (a.purpose ? kv('주요 용도', esc(a.purpose)) : '') + '</div>' +
        '<button class="link-btn" data-act="editAccount" data-id="' + a.id + '">계좌 정보 고치기</button></section>';
    }).join('');
    h += '<div class="btn-row"><button class="btn ghost" data-act="editAccount">계좌 추가</button><button class="btn ghost" data-act="setup">' + I.scan + ' 캡처로 추가</button></div><p class="hint center">잔액은 마지막에 적은 은행앱 숫자에 그 뒤 가계부 기록과 지난 고정비·대출·카드대금을 더하고 뺀 값이에요.</p>';
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
      (readJSON(OLDKEY) ? row({ act: 'remigrate', t: '예전 버전 앱 데이터 다시 가져오기', s: '지금 데이터는 바뀌어요', amt: '' }) : '') +
      row({ act: 'resetAll', t: '<span class="danger">처음부터 다시 시작</span>', s: '이 기기의 데이터를 모두 지우고 처음 화면으로 가요', amt: '' }) + '</section>' +
      '<p class="hint center">홈 화면에 추가해서 쓰면 Safari가 데이터를 지우지 않아요.<br>공유 버튼 → 홈 화면에 추가<br>버전 ' + VERSION + '</p>';
  }

  // ===== 처음 시작: 급여일 → 계좌 잔액 → 카드값 순서로 한 단계씩 =====
  const onboarding = () => S.onboard != null || (!S.started && !S.accounts.length);
  const nextPayMonth = (c) => { const d = today(); let m = d.slice(0, 7); if (C.cardPayDate(c, m) < d) m = C.addMonths(m, 1); return m; };
  // 단계: 급여(날짜+금액) → 계좌 → 카드·할부 → 고정비·구독 → 대출 (뒤쪽 셋은 없으면 건너뛰기)
  // 월급은 들어오는 통장이 있어야 저장되니, 금액은 먼저 받아 두고 계좌 단계에서 통장을 고르면 수입으로 만듦
  const OB_STEPS = ['소득', '계좌', '카드', '고정비', '대출'];
  const FIXED_PRESETS = [['월세', '주거'], ['관리비', '주거'], ['통신비', '통신'], ['인터넷', '통신'], ['보험', '보험'], ['넷플릭스', '구독'], ['유튜브 프리미엄', '구독'], ['쿠팡 와우', '구독'], ['적금', '기타']];
  const salaryOf = () => S.incomes.find((x) => x.salary);
  const salAcc = () => { const s = salaryOf() || S.incomes[0]; const id = (s && s.accountId) || S.obSalAcc; return acct(id) ? id : (S.accounts.find((a) => a.type === 'bank') || S.accounts[0] || {}).id; };
  // 수입을 적을 때 고른 은행과 같은 은행 통장으로 연결 (입출금 통장 먼저)
  const accOfBank = (b) => b ? (S.accounts.find((a) => a.bank === b && a.type === 'bank') || S.accounts.find((a) => a.bank === b)) : null;
  let obRowN = 0;
  function obSalarySave() {
    if (noSal()) S.incomes = S.incomes.filter((x) => !x.salary);
    const amt = noSal() ? null : S.obSalary; const s = salaryOf();
    const to = acct(S.obSalAcc) ? S.obSalAcc : (accOfBank(S.obSalBank) || {}).id;
    // 통장을 아직 안 넣었으면 통장 없이 저장해 두고, 통장이 생기면 render()에서 같은 은행 통장으로 이어 줌
    if (amt && s) Object.assign(s, { amount: amt, day: S.settings.payDay, bank: S.obSalBank || s.bank || null });
    if (s) { if (to) s.accountId = to; }
    else if (amt) S.incomes.push({ id: uid(), name: '급여', amount: amt, day: S.settings.payDay, bank: S.obSalBank || null, accountId: to || salAcc() || null, salary: true, approx: false, active: true });
    // 급여일 화면에서 적은 다른 수입은 통장이 생기면 월급 통장으로 넣음 (나중에 고칠 수 있음)
    for (const r of S.obExtra || []) S.incomes.push({ id: uid(), name: r.name, amount: r.amount, day: r.day, bank: r.bank || (acct(r.acc) || {}).bank || null, accountId: (acct(r.acc) || accOfBank(r.bank) || {}).id || salAcc() || null, salary: false, approx: false, active: true });
    delete S.obExtra;
  }
  const extraRow = (r) => { r = r || {}; return '<div class="dyn-row" data-t="inc"><input class="input" data-k="name" value="' + esc(r.name || '') + '" placeholder="이름 (예: 부업, 용돈, 이자)">' +
    '<div class="dyn-grid"><div class="money"><input class="input" data-k="val" inputmode="numeric" pattern="[0-9]*" data-live="money" value="' + (r.amount ? won(r.amount) : '') + '" placeholder="금액"><span>원</span></div>' +
    '<select class="input" data-k="day">' + dayOpts.map(([v, l]) => '<option value="' + v + '"' + (v === (r.day || S.settings.payDay) ? ' selected' : '') + '>매월 ' + l + '</option>').join('') + '</select></div>' +
    (S.accounts.length ? '<div class="ob-bank"><span>받는 통장</span><select class="input" data-k="acc">' + S.accounts.map((a) => '<option value="' + a.id + '"' + (a.id === (r.acc || salAcc()) ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select></div>' : '') +
    '<button type="button" class="dyn-del" data-act="dynDel">지우기</button></div>'; };
  // 맨 처음 소개 화면: 앱이 뭘 해주는지 보여주고 '시작하기'로 소득 단계부터
  function intro() {
    const feat = (ic, cls, t, d) => '<div class="in-feat"><span class="m-ic ' + cls + '">' + ic + '</span><div><b>' + t + '</b><span>' + d + '</span></div></div>';
    return '<main class="screen hello"><div class="in-hero"><img src="icons/icon-180.png" alt="" class="in-logo"><h1>이번 달 월급부터<br>다음 달 월급까지</h1><p>급여주기를 확인하고 흐름을 관리해요.</p></div>' +
      '<div class="in-feats">' + feat(I.flow, 'blue', '이번 달 남는 돈 미리 보기', '월급·카드값·고정비·대출을 날짜별로 계산해요') + feat(I.scan, 'green', '캡처 한 장으로 계좌 입력', '은행앱 화면을 찍으면 잔액이 한 번에 들어가요') + feat(I.book, 'indigo', '할부·약정까지 기억', '끝나는 할인, 남은 할부를 대신 챙겨요') + '</div>' +
      '<div class="ob-foot"><button class="btn" data-act="obStart">시작하기</button><button class="btn ghost" data-act="backup">예전 백업으로 시작하기</button><p class="in-note">다섯 단계면 끝나요 · 데이터는 이 아이폰에만 저장돼요</p></div></main>';
  }
  // 급여 단계는 토스처럼 질문을 하나씩: 답하면 다음 질문이 위에 나타나고, 답한 건 아래에 쌓임 (누르면 다시 고치기)
  const OB_Q = ['정기적으로 들어오는 소득이 있나요?', '급여일이 언제인가요?', '월급은 얼마인가요?', '어느 은행으로 받나요?', '다른 수입도 있나요?'];
  const obQ = () => S.obQ || 0;
  const obMax = () => S.obMaxQ != null ? S.obMaxQ : (salaryOf() || noSal() ? 4 : 0);
  function onboard() {
    if (S.onboard == null) return intro();
    const step = S.onboard || 0; const pd = S.settings.payDay; const last = step === OB_STEPS.length - 1;
    const head = (t, p) => '<div class="ob-head ob-in"><h1>' + t + '</h1>' + (p ? '<p>' + p + '</p>' : '') + '</div>';
    const list = (rows) => rows.length ? '<section class="card ob-list">' + rows.join('') + '</section>' : '';
    const item = (act, id, t, sub, amt, extra) => '<button class="row" data-act="' + act + '" data-id="' + id + '"' + (extra || '') + '><span class="grow"><span class="t">' + t + '</span>' + (sub ? '<span class="s">' + sub + '</span>' : '') + '</span>' + amt + '</button>';
    const cta = (act, label, sub) => '<div class="ob-foot">' + (sub || '') + '<button class="btn" data-act="' + act + '">' + label + '</button></div>';
    const skip = (act) => '<div class="ob-foot"><button class="ob-skip" data-act="' + act + '">나중에 입력할게요</button></div>';
    const foot = (has, opt) => last ? cta('obDone', '시작하기') : has || !opt ? cta('obNext', '다음') : skip('obNext');
    const q = obQ(); const prog = (step + (step === 0 ? Math.min(q, 4) / 5 : 0) + 0.5) / OB_STEPS.length;
    let h = '<main class="screen ob"><div class="ob-top"><button class="ob-back" data-act="obBack" aria-label="이전">' + I.left + '</button><div class="ob-bar"><s style="width:' + Math.round(prog * 100) + '%"></s></div><span class="ob-n">' + (step + 1) + '/' + OB_STEPS.length + '</span><button class="ob-reset" data-act="resetAll">처음부터</button></div>';
    if (step === 0) {
      const r = C.periodRange(S, C.periodOf(S, today())); const s = salaryOf(); const sal = S.obSalary != null ? S.obSalary : (s || {}).amount;
      const bank = S.obSalBank || ((acct((s || {}).accountId) || {}).bank) || '';
      // 통장을 먼저 넣었으면 그 통장 중에서 고르고, 건너뛰었으면 은행만 고름
      const accs = S.accounts.filter((a) => a.type !== 'local'); const sa = acct(S.obSalAcc) ? S.obSalAcc : (s && acct(s.accountId) ? s.accountId : null);
      const done = (i, label, v) => '<button class="ob-ans" data-act="obEdit" data-q="' + i + '"><span>' + label + '</span><b>' + v + '</b></button>';
      const subs = ['월급처럼 매달 정해진 날에 들어오는 돈이 있으면 그날을 기준으로 한 달을 계산해요.', '이날부터 다음 급여일 전날까지를 한 달로 계산해요.', '세후, 통장에 실제로 들어오는 금액이에요.', '같은 은행 통장을 넣으면 월급이 그 통장으로 들어가요.', '부업, 용돈, 이자처럼 매달 들어오는 돈이 있으면 더해 주세요.'];
      const titles = OB_Q.slice();
      if (noSal()) { titles[1] = '주기 시작을 며칠부터로 할까요?'; subs[1] = '이날부터 다음 달 그 전날까지를 한 달로 계산해요. 보통 매월 1일로 해요.'; titles[4] = '매달 들어오는 돈이 있나요?'; subs[4] = '용돈, 이자, 정기 수입처럼 매달 들어오는 돈이 있으면 적어 주세요. 들쭉날쭉한 수입은 들어올 때 가계부에 적으면 돼요.'; }
      if (accs.length) { titles[3] = '어느 통장으로 받나요?'; subs[3] = '앞에서 넣은 통장 중에 골라 주세요.'; }
      h += head(titles[q], subs[q]) + '<div class="ob-q ob-in">';
      if (q === 0) h += '<div class="ob-opts"><button type="button" class="ob-opt' + (obMax() > 0 && !noSal() ? ' on' : '') + '" data-act="obHasSal" data-v="1"><b>네, 있어요</b><span>월급, 연금처럼 매달 정해진 날에 들어와요</span></button><button type="button" class="ob-opt' + (obMax() > 0 && noSal() ? ' on' : '') + '" data-act="obHasSal" data-v="0"><b>아니요</b><span>프리랜서·자영업·학생처럼 들어오는 날이 정해져 있지 않아요</span></button></div>';
      else if (q === 1) h += '<div class="ob-dayin"><span>매월</span><input class="input" id="obDayIn" inputmode="numeric" pattern="[0-9]*" maxlength="2" enterkeyhint="done" value="' + (obMax() > 1 && pd !== 31 ? pd : '') + '" placeholder="' + (noSal() ? '1' : '25') + '"><span>일</span></div>' +
        (noSal() ? '<p class="ob-ex">비워 두고 확인을 누르면 매월 1일부터예요.</p>' : '<button type="button" class="ob-last' + (obMax() > 1 && pd === 31 ? ' on' : '') + '" data-act="obDay" data-d="31">매달 말일에 받아요</button>');
      else if (q === 2) h += '<div class="money huge"><input class="input" id="obSal" inputmode="numeric" pattern="[0-9]*" data-live="money" enterkeyhint="done" value="' + (sal ? won(sal) : '') + '" placeholder="0"><span>원</span></div>';
      else if (q === 3 && accs.length) h += '<div class="ob-accs">' + accs.map((a) => '<button type="button" class="ob-acc' + (a.id === sa ? ' on' : '') + '" data-act="obAcc" data-id="' + a.id + '">' + acctChip(a) + '<span class="grow"><b>' + esc(a.name) + '</b><span>' + (a.type === 'overdraft' ? '마이너스통장' : '입출금') + '</span></span><span class="chk"></span></button>').join('') + '</div>';
      else if (q === 3) h += '<div class="bp-grid ob-banks">' + POP_ORDER.map((b) => '<button type="button" class="bp-tile' + (b === bank ? ' on' : '') + '" data-act="obBank" data-b="' + b + '">' + bankIcon(b, 'xl') + '<span>' + (POP_LABEL[b] || b) + '</span></button>').join('') + '</div>';
      else h += S.incomes.filter((x) => !x.salary).map((x) => '<button class="row ob-inc" data-act="editIncome" data-id="' + x.id + '"><span class="grow"><span class="t">' + esc(x.name) + '</span><span class="s">매월 ' + x.day + '일</span></span><span class="amt in">+' + won(x.amount) + '</span></button>').join('') +
        '<div class="dyn">' + (S.obExtra || []).map(extraRow).join('') + '<button type="button" class="dyn-add" data-act="dynAdd" data-t="inc">+ ' + (noSal() ? '들어오는 돈 추가' : '다른 수입 추가') + '</button></div>';
      h += '</div>';
      // 답한 것들 (최근 답이 위로)
      const ans = [];
      if (obMax() > 0 && q !== 0) ans.push(done(0, '정기 소득', noSal() ? '없어요' : '있어요'));
      if (obMax() > 1 && q !== 1) ans.push(done(1, noSal() ? '주기 시작' : '급여일', (pd === 31 ? '매달 말일' : '매월 ' + pd + '일') + ' <em>' + md(r.start) + ' ~ ' + md(r.end) + '</em>'));
      if (!noSal() && obMax() > 2 && q !== 2) ans.push(done(2, '월급', sal ? won(sal) + '원' : '나중에 적기'));
      if (ans.length) h += '<section class="ob-done">' + ans.reverse().join('') + '</section>';
      if (q === 1) h += cta('obDayOk', '확인');
      else if (q === 2) h += cta('obSalOk', '확인', '<button class="ob-skip" data-act="obSalOk" data-skip="1">월급은 나중에 적을게요</button>');
      else if (q === 3 && !accs.length) h += '<div class="ob-foot"><button class="ob-skip" data-act="obBank" data-b="">나중에 고를게요</button></div>';
      else if (q === 4) h += cta('obNext', '다음');
    } else if (step === 1) {
      const sal = salaryOf(); const amt = sal && sal.amount;
      // 월급 통장은 항상 하나 고르게: 같은 은행 통장이 있으면 미리 골라 둠
      const sa = acct(S.obSalAcc) ? S.obSalAcc : (sal && acct(sal.accountId) ? sal.accountId : (S.accounts.length === 1 ? S.accounts[0].id : ((sal && accOfBank(S.obSalBank || sal.bank)) || {}).id));
      h += head('통장을 넣어 볼까요?', '은행앱이나 토스의 \'내 계좌\' 화면을 캡처하면 한 번에 들어가요.') +
        list(S.accounts.map((x) => { const v = C.accountBalance(S, x.id, today()); return item('editAccount', x.id, acctChip(x) + ' ' + esc(x.name), x.type === 'overdraft' ? '마이너스통장 · 한도 ' + won(x.limit || 0) + '원' : '', '<span class="amt">' + (v < 0 ? '−' : '') + won(Math.abs(v)) + '</span>'); })) +
        '<div class="ob-add"><button class="btn' + (S.accounts.length ? ' ghost' : '') + '" data-act="setup">' + I.scan + ' 캡처로 넣기</button><button class="btn ghost" data-act="editAccount">직접 적기</button></div>' +
        (S.accounts.length && amt ? '<section class="card ob-pick"><b>월급 ' + won(amt) + '원은 어느 통장으로 들어오나요?</b>' + '' + '<div class="ob-chips">' + S.accounts.map((a) => '<button class="chip' + (a.id === sa ? ' on' : '') + '" data-act="obSalAcc" data-id="' + a.id + '">' + acctChip(a) + ' ' + esc(a.name) + '</button>').join('') + '</div></section>' : '') +
        (S.accounts.length ? (amt && !sa ? '<div class="ob-foot"><button class="btn" disabled>통장을 골라 주세요</button></div>' : foot(true)) : skip('obNext'));
    } else if (step === 2) {
      h += head('카드값을 입력할까요?', '카드앱의 결제 예정 금액을 적어 주세요. 할부도 같이 넣어 두면 다음 달 카드값까지 미리 계산해요.') +
        S.cards.map((c) => { const m = nextPayMonth(c); const b = C.cardBill(S, c.id, m); const ins = S.installments.filter((i) => i.cardId === c.id);
          return '<section class="card ob-list">' + item('cardApp', c.id, bankChip(c.name) + ' ' + esc(c.name), md(b.payDate) + ' 결제', b.app ? '<span class="amt">' + won(b.app.amount) + '</span>' : '<span class="badge warn">카드값 적기</span>', ' data-m="' + m + '"') +
            ins.map((i) => { const left = i.months - Math.max(0, C.monthDiff(i.startMonth, m)); return item('editInst', i.id, '<span class="ob-sub">할부</span> ' + esc(i.name), (left > 0 ? left + '개월 남음' : '끝남') + ' · 매달', '<span class="amt">' + won(Array.isArray(i.amounts) ? i.amounts[0] : i.amount) + '</span>'); }).join('') +
            '<button class="ob-inst" data-act="editInst" data-card="' + c.id + '">+ 할부 넣기</button></section>'; }).join('') +
        '<div class="ob-add"><button class="btn ghost" data-act="setup">' + I.scan + ' 카드앱 캡처로 넣기</button><button class="btn ghost" data-act="editCard">카드 직접 추가</button></div>' + foot(S.cards.length, true);
    } else if (step === 3) {
      const have = new Set(S.fixed.map((x) => x.name));
      h += head('고정비를 입력할까요?', '월세, 통신비, 보험, 구독처럼 매달 나가는 돈이에요. 아래에서 고르면 이름이 채워지고, 약정·결합할인 같은 특이사항도 같이 적을 수 있어요.') +
        list(S.fixed.map((x) => item('editFixed', x.id, esc(x.name), '매월 ' + x.day + '일 · ' + esc(x.cat || ''), '<span class="amt">' + won(x.amount) + '</span>'))) +
        '<div class="ob-chips">' + FIXED_PRESETS.filter(([n]) => !have.has(n)).map(([n, c]) => '<button class="chip" data-act="editFixed" data-name="' + n + '" data-cat="' + c + '">+ ' + n + '</button>').join('') + '<button class="chip" data-act="editFixed">+ 직접 적기</button></div>' + foot(S.fixed.length, true);
    } else {
      h += head('대출을 입력할까요?', '남은 원금, 금리, 매달 내는 돈을 적어 두면 이자와 다 갚는 날까지 계산해요. 마이너스통장은 앞에서 넣었으면 따로 안 넣어도 돼요.') +
        list(S.loans.map((l) => item('editLoan', l.id, bankChip(l.bank || l.name) + ' ' + esc(l.name), '매월 ' + l.payDay + '일 · ' + won(l.monthly || 0) + '원' + (l.rate ? ' · ' + l.rate + '%' : ''), '<span class="amt">' + won(C.loanBalance(S, l, today()).amount) + '</span>'))) +
        '<div class="ob-add"><button class="btn ghost" data-act="editLoan">대출 넣기</button></div>' + foot(S.loans.length, true);
    }
    return h + '</main>';
  }
  function obReadSal() {
    const el = document.getElementById('obSal'); if (el) S.obSalary = Math.abs(parseAmt(el.value)) || null;
    if (!document.querySelector('.ob .dyn')) return;
    S.obExtra = Array.from(document.querySelectorAll('.ob .dyn-row[data-t="inc"]')).map((r) => ({ name: r.querySelector('[data-k=name]').value.trim(), amount: Math.abs(parseAmt(r.querySelector('[data-k=val]').value)), day: Number(r.querySelector('[data-k=day]').value), bank: (r.querySelector('[data-k=bank]') || {}).value || null, acc: (r.querySelector('[data-k=acc]') || {}).value || null })).filter((r) => r.name && r.amount);
  }
  // 질문에 답하면 아직 안 한 다음 질문으로 (고치러 돌아온 경우엔 다시 맨 앞 질문으로)
  function obAnswer(q) { closePad(); let n = q + 1; if (noSal() && n >= 2 && n <= 3) n = 4; if (n === 3) n = 4; S.obMaxQ = Math.max(obMax(), n); S.obQ = Math.max(n, Math.min(S.obMaxQ, n)); save(); render(); focusAmt(document.getElementById('obSal') || document.getElementById('obDayIn')); }
  function obFinish() { delete S.onboard; delete S.obSalary; delete S.obSalAcc; delete S.obExtra; delete S.obSalBank; delete S.obQ; delete S.obMaxQ; S.started = true; save(); location.hash = '#/home'; render(); }

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
        h += '<div class="money big"><input class="input" name="amt" inputmode="numeric" pattern="[0-9]*" data-live="money" value="' + (x.amount ? won(x.amount) : '') + '" placeholder="0"><span>원</span></div>';
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
      { name: 'bank', label: '은행', type: 'html', html: '<div class="field"><span class="lab">은행</span>' + bankField('bank', a ? a.bank || bankOf(a.name) || '' : '') + '</div>' },
      { name: 'name', label: '계좌 이름', value: a ? a.name : '', ph: '예: 종합통장, 생활비 통장' },
      { name: 'type', label: '종류', type: 'select', value: a ? a.type : 'bank', options: [['bank', '입출금'], ['overdraft', '마이너스통장'], ['local', '지역화폐']] },
      { name: 'limit', label: '마이너스통장 한도', type: 'money', value: a ? a.limit : '', ph: '마이너스통장일 때만' },
      { name: 'rate', label: '이율 % (선택)', type: 'number', value: a ? a.rate : '', ph: '예: 5.1' },
      { name: 'purpose', label: '주요 용도 (선택)', value: a ? a.purpose || '' : '', ph: '예: 급여 수령·카드대금' },
      { name: 'include', label: '쓸 수 있는 돈에 합산', type: 'switch', value: a ? a.include !== false : true },
    ];
    if (!a) f.push({ name: 'bal', label: '지금 은행앱 잔액 (마이너스통장은 사용 중인 금액)', type: 'money' });
    formSheet(a ? '계좌 정보' : '계좌 추가', f, () => {
      const bank = val('bank'); const name = val('name').trim() || (bank ? bank + ' 통장' : ''); if (!name) return toast('은행을 고르거나 이름을 적어 주세요');
      const x = a || { id: uid() };
      x.name = name; if (bank) x.bank = bank; else delete x.bank; x.type = val('type'); x.include = val('include'); x.purpose = val('purpose').trim(); x.rate = num(val('rate'));
      if (x.type === 'overdraft') x.limit = Math.abs(parseAmt(val('limit'))); else delete x.limit;
      if (!a) { const v = Math.abs(parseAmt(val('bal'))); x.balance = x.type === 'overdraft' ? -v : v; x.balanceAt = now(); x.balanceDate = today(); S.accounts.push(x); if (!onboarding()) S.started = true; }
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
      body: () => '<div class="money big"><input class="input" name="amt" inputmode="numeric" pattern="[0-9]*" data-live="money" data-est="' + est + '" value="' + won(est) + '"><span>원</span></div>' +
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
  // ----- 요금 계산: 기본 요금 − 할인(기간·%) = 매달 내는 돈, 따로 받는 혜택은 비교만 -----
  const discRow = (d) => { d = d || {}; return '<div class="dyn-row" data-t="disc"><input class="input" data-k="name" value="' + esc(d.name || '') + '" placeholder="할인 이름 (예: 통신사 할인, 카드 청구할인)">' +
    '<div class="dyn-grid"><input class="input" data-k="val" inputmode="decimal" value="' + (d.pct || d.amount || '') + '" placeholder="금액">' +
    '<select class="input" data-k="unit"><option value="won"' + (d.pct ? '' : ' selected') + '>원</option><option value="pct"' + (d.pct ? ' selected' : '') + '>%</option></select></div>' +
    '<div class="dyn-grid"><label><span>언제부터 (선택)</span><input class="input" type="month" data-k="from" value="' + (d.from || '') + '"></label><label><span>언제까지 (선택)</span><input class="input" type="month" data-k="until" value="' + (d.until || '') + '"></label></div>' +
    '<button type="button" class="dyn-del" data-act="dynDel">이 할인 지우기</button></div>'; };
  const perkRow = (b) => { b = b || {}; return '<div class="dyn-row" data-t="perk"><input class="input" data-k="name" value="' + esc(b.name || '') + '" placeholder="혜택 이름 (예: 꿀머니, 쿠폰)">' +
    '<div class="money"><input class="input" data-k="val" inputmode="numeric" pattern="[0-9]*" data-live="money" value="' + (b.amount ? won(b.amount) : '') + '" placeholder="한 달에 받는 금액"><span>원</span></div>' +
    '<div class="dyn-grid"><label><span>언제부터 (선택)</span><input class="input" type="month" data-k="from" value="' + (b.from || '') + '"></label><label><span>언제까지 (선택)</span><input class="input" type="month" data-k="until" value="' + (b.until || '') + '"></label></div>' +
    '<button type="button" class="dyn-del" data-act="dynDel">이 혜택 지우기</button></div>'; };
  const readRows = (t) => Array.from(document.querySelectorAll('#sheet .dyn-row[data-t="' + t + '"]')).map((r) => {
    const g = (k) => (r.querySelector('[data-k="' + k + '"]') || {}).value || ''; const v = g('val');
    const o = { name: g('name').trim() }; if (g('from')) o.from = g('from'); if (g('until')) o.until = g('until');
    if (t === 'disc' && g('unit') === 'pct') o.pct = Number(v.replace(/[^0-9.]/g, '')) || 0; else o.amount = Math.abs(parseAmt(v));
    return o;
  }).filter((o) => o.name && (o.pct || o.amount));
  const inR = (x, P) => (!x.from || P >= x.from) && (!x.until || P <= x.until);
  const rangeText = (x) => x.from && x.until ? mName(x.from) + '~' + mName(x.until) : x.until ? mName(x.until) + '까지' : x.from ? mName(x.from) + '부터' : '';
  // 이번 달 요금 계산 + 혜택 비교 (고정비 정보 화면)
  function billHtml(x) {
    const P = curP(); let h = '';
    if (x.base) {
      let a = x.base; const rows = [['기본 요금', won(x.base) + '원', '']];
      for (const d of x.discounts || []) { const on = inR(d, P); const cut = on ? (d.pct ? Math.round(a * d.pct / 100) : d.amount) : 0; a -= cut; rows.push([esc(d.name) + (d.pct ? ' ' + d.pct + '%' : ''), on ? '−' + won(cut) + '원' : '0원', on ? rangeText(d) : (d.until && P > d.until ? '끝남' : rangeText(d))]); }
      h += '<div class="bill"><b class="bill-t">' + mName(P) + ' 요금 계산</b>' + rows.map(([t, v, n]) => '<div><span>' + t + (n ? ' <em>' + n + '</em>' : '') + '</span><b>' + v + '</b></div>').join('') + '<div class="sum"><span>실제 내는 돈</span><b>' + won(C.fixedAmount(x, P)) + '원</b></div></div>';
    }
    const perks = x.perks || [];
    if (perks.length) {
      const now = perks.filter((b) => inR(b, P)); const got = now.reduce((s2, b) => s2 + b.amount, 0); const net = got - C.fixedAmount(x, P);
      h += '<div class="bill"><b class="bill-t">따로 받는 혜택</b>' + perks.map((b) => '<div><span>' + esc(b.name) + (rangeText(b) ? ' <em>' + rangeText(b) + '</em>' : '') + '</span><b>' + won(b.amount) + '원</b></div>').join('') +
        '<div class="sum ' + (net >= 0 ? 'good' : '') + '"><span>' + mName(P) + ' 혜택 반영하면</span><b>월 ' + won(Math.abs(net)) + '원 ' + (net >= 0 ? '이득' : '부담') + '</b></div>';
      const fr = perks.map((b) => b.from).filter(Boolean).sort()[0]; const to = perks.map((b) => b.until).filter(Boolean).sort().pop();
      if (fr && to && to >= fr) {
        let pay = 0, rec = 0, n = 0; for (let m = fr; m <= to; m = C.addMonths(m, 1)) { pay += C.fixedAmount(x, m); rec += perks.filter((b) => inR(b, m)).reduce((s2, b) => s2 + b.amount, 0); n++; }
        h += '<div><span>' + mName(fr) + '~' + mName(to) + ' ' + n + '개월 동안 내는 돈</span><b>' + won(pay) + '원</b></div><div><span>그동안 받는 혜택</span><b>' + won(rec) + '원</b></div>' +
          '<div class="sum ' + (rec >= pay ? 'good' : '') + '"><span>' + n + '개월 합치면</span><b>' + won(Math.abs(rec - pay)) + '원 ' + (rec >= pay ? '이득' : '부담') + '</b></div>';
      }
      h += '<p class="hint">혜택은 카드값·흐름에서 빼지 않고 비교로만 보여줘요.</p></div>';
    }
    return h;
  }
  function editFixed(id, pre) {
    const x = id ? S.fixed.find((y) => y.id === id) : null; pre = pre || {};
    const info = (x && x.info) || {};
    if (!payOpts().length) return toast('계좌나 카드를 먼저 추가해 주세요');
    formSheet(x ? '고정비 고치기' : '고정비 추가', [
      { name: 'name', label: '이름', value: x ? x.name : pre.name || '', ph: '예: 월세, 넷플릭스' },
      { name: 'amount', label: x && x.base ? '금액 (아래 요금 계산으로 자동)' : '금액', type: 'money', value: x ? x.amount : '' },
      { name: 'day', label: '매월 날짜', type: 'select', value: x ? x.day : 25, options: dayOpts },
      { name: 'dayText', label: '날짜 표시 (선택)', value: x ? x.dayText || '' : '', ph: '예: 24일-25일, 말일' },
      { type: 'html', html: '<details class="calc"' + (x && (x.base || (x.perks || []).length) ? ' open' : '') + '><summary>요금 계산·할인·혜택 <em>통신비처럼 할인이 붙을 때</em></summary>' +
        '<p class="hint">기본 요금과 할인을 적으면 매달 내는 돈을 알아서 계산해요. 할인은 적힌 순서대로 빼요(카드 청구할인 %는 맨 아래에).</p>' +
        field({ name: 'base', label: '기본 요금', type: 'money', value: x && x.base ? x.base : '', ph: '예: 40,500' }) +
        '<div class="dyn" data-for="disc">' + ((x && x.discounts) || []).map(discRow).join('') + '<button type="button" class="dyn-add" data-act="dynAdd" data-t="disc">+ 할인 넣기</button></div>' +
        '<p class="group-lab">따로 받는 혜택 <em>포인트·쿠폰처럼 요금에서 안 빠지는 것</em></p>' +
        '<div class="dyn" data-for="perk">' + ((x && x.perks) || []).map(perkRow).join('') + '<button type="button" class="dyn-add" data-act="dynAdd" data-t="perk">+ 혜택 넣기</button></div></details>' },
      { name: 'pay', label: '내는 곳', type: 'select', value: x ? refVal(x.pay) : payOpts()[0][0], options: payOpts() },
      { name: 'cat', label: '분류', type: 'select', value: x ? x.cat || '기타' : pre.cat || '구독', options: S.categories.map((c) => [c, c]) },
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
      { type: 'html', html: '<label class="field"><span class="lab">특이사항</span><textarea class="input" name="extra" rows="4" placeholder="예: 인터넷과 결합할인 중 · 해지하면 할인 끝남&#10;가족 명의로 묶여 있음, 위약금 약 5만원">' + esc(info.extra || '') + '</textarea></label>' },
    ], () => {
      const name = val('name').trim(); const base = Math.abs(parseAmt(val('base'))); const discounts = readRows('disc'); const perks = readRows('perk');
      const amount = base ? C.fixedAmount({ base, discounts }, curP()) : Math.abs(parseAmt(val('amount')));
      if (!name || !(amount || base)) return toast('이름과 금액을 적어 주세요');
      const y = x || { id: uid(), from: curP() };
      if (base) { y.base = base; y.discounts = discounts; } else { delete y.base; delete y.discounts; }
      if (perks.length) y.perks = perks; else delete y.perks;
      Object.assign(y, { name, amount, day: Number(val('day')), dayText: val('dayText').trim(), pay: refOf(val('pay')), cat: val('cat'), approx: val('approx'), from: val('from') || (x ? null : curP()), until: val('until') || null, note: val('note').trim(), active: val('active') });
      const inf = {}; for (const k of INFO_KEYS.concat('extra')) { const v = (val(k) || '').trim(); if (v) inf[k] = v; }
      if (Object.keys(inf).length) y.info = inf; else delete y.info;
      if (!x) S.fixed.push(y);
      return LINKED;
    }, x ? () => { S.fixed = S.fixed.filter((y) => y !== x); return true; } : null, '이번 달만 금액이 다르면 월간 흐름에서 그 항목을 눌러 바꿔요.');
  }
  function editIncome(id) {
    const x = id ? S.incomes.find((y) => y.id === id) : null;
    if (!S.accounts.length) return toast('계좌를 먼저 추가해 주세요');
    formSheet(x ? '정기 수입 고치기' : '정기 수입 추가', [
      { name: 'name', label: '이름', value: x ? x.name : S.incomes.length ? '' : '급여', ph: '예: 급여, 회수금' },
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
  // 새 할부는 '남은 개월 수'만 받고 첫 결제월은 그 카드의 다음 결제월로 둠
  function editInst(id, cardId) {
    const x = id ? S.installments.find((y) => y.id === id) : null;
    if (!S.cards.length) return toast('카드를 먼저 추가해 주세요');
    formSheet(x ? '할부 고치기' : '할부 넣기', [
      { name: 'name', label: '무엇을 샀나요', value: x ? x.name : '', ph: '예: 노트북' },
      { name: 'cardId', label: '카드', type: 'select', value: x ? x.cardId : cardId || S.cards[0].id, options: S.cards.map((c) => [c.id, c.name]) },
      x ? { name: 'start', label: '첫 결제월', type: 'month', value: x.startMonth } : { type: 'html', html: '' },
      { name: 'months', label: x ? '개월 수' : '남은 개월 수 (이번 결제 포함)', type: 'number', value: x ? x.months : '', ph: '예: 3' },
      { name: 'amount', label: '한 달 금액', type: 'money', value: x ? (Array.isArray(x.amounts) ? x.amounts[0] : x.amount) : '' },
      { name: 'amounts', label: '달마다 금액이 다르면 (선택, 쉼표로)', value: x && Array.isArray(x.amounts) ? x.amounts.join(', ') : '', ph: '예: 18168, 18166, 18166' },
      { name: 'note', label: '메모 (선택)', value: x ? x.note || '' : '' },
    ], () => {
      const name = val('name').trim(); const months = Number(val('months'));
      const list = val('amounts').split(/[,\s]+/).map((s) => Math.abs(parseAmt(s))).filter(Boolean);
      const amount = Math.abs(parseAmt(val('amount'))) || list[0];
      const start = x ? val('start') : nextPayMonth(card(val('cardId')));
      if (!name || !months || !amount || !start) return toast('이름·개월 수·금액을 적어 주세요');
      const y = x || { id: uid() };
      Object.assign(y, { name, cardId: val('cardId'), startMonth: start, months, amount, note: val('note').trim() });
      if (list.length) y.amounts = list; else delete y.amounts;
      if (!x) S.installments.push(y);
      return LINKED;
    }, x ? () => { S.installments = S.installments.filter((y) => y !== x); return true; } : null, x ? '' : '카드앱 할부 내역에서 남은 회차를 보고 적으면 돼요.');
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
    let rows = null; let busy = ''; let method = last.method || (S.cards[0] ? 'card:' + S.cards[0].id : 'account:' + S.accounts[0].id);
    openSheet({
      title: '캡처로 가져오기',
      body() {
        if (!rows) return '<p class="hint">카드·은행앱 <b>사용내역</b> 화면을 캡처해서 골라 주세요. 여러 장도 한 번에 고를 수 있어요.</p>' + photoBtn(busy) +
          '<p class="hint">사진은 이 아이폰 안에서만 읽고 어디에도 보내지 않아요.</p>' +
          '<details class="paste"' + (text ? ' open' : '') + '><summary>글자를 직접 붙여넣기</summary><textarea class="input" name="raw" placeholder="여기에 붙여넣기">' + esc(text || '') + '</textarea><button class="btn ghost" data-act="capRead">붙여넣은 글자 읽기</button></details>';
        if (!rows.length) return '<p class="hint center">읽을 수 있는 금액을 못 찾았어요.</p>';
        return '<label class="field"><span class="lab">결제수단 (모두 같게)</span><select class="input" name="imethod">' + methodOptions(method, true) + '</select></label><p class="hint">중복 의심은 빼 두었어요.</p><div class="sub-list">' +
          rows.map((r, i) => '<label class="row check"><input type="checkbox" data-live="pick" data-i="' + i + '"' + (r.pick ? ' checked' : '') + '><span class="grow"><span class="t">' + esc(r.memo || '이름 없음') + '</span><span class="s">' + md(r.date) + (r.dup ? ' · 중복 의심' : '') + (r.cancel ? ' · 취소' : '') + '</span></span><span class="amt">' + won(r.amount) + '</span></label>').join('') + '</div>';
      },
      foot: () => !rows ? '' : '<button class="btn" data-act="capSave">선택한 것 저장</button><button class="btn ghost" data-act="capBack">다시 고르기</button>',
    });
    sheet.ocr = async (files) => {
      try { const r = await readPhotos(files, (m) => { busy = m; paintSheet(); }); busy = ''; sheet.cap.read(r.text); }
      catch (e) { busy = ''; paintSheet(); toast('사진을 못 읽었어요. 글자 붙여넣기로 해 주세요'); }
    };
    sheet.cap = {
      read(t) { rows = parseCapture(typeof t === 'string' ? t : val('raw') || '').map((r) => { r.dup = !!C.findDuplicate(S, r); r.pick = !r.dup && !r.cancel; return r; }); paintSheet(); },
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

  // ===== 캡처 사진에서 글자 읽기 (이 기기 안에서 처리, 사진은 어디에도 안 보냄) =====
  let ocrWorker = null;
  const loadScript = (src) => new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = no; document.head.appendChild(el); });
  async function readPhotos(files, onStep) {
    const base = new URL('vendor/ocr/', location.href).href;
    if (!window.Tesseract) { onStep('글자 읽기 준비 중 · 처음 한 번만 받아요'); await loadScript(base + 'tesseract.min.js'); }
    if (!ocrWorker) { onStep('글자 읽기 준비 중 · 처음 한 번만 받아요'); ocrWorker = await Tesseract.createWorker('kor', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base.replace(/\/$/, ''), gzip: true }); }
    const lines = []; const meta = []; const pics = [];
    // 한 글자씩 떨어진 한글("국 민")만 붙이고, 숫자 뒤 '월'로 잘못 읽힌 '원'을 고침
    const fix = (t) => t.replace(/(^|\s)([가-힣]) (?=[가-힣](\s|$))/g, '$1$2').replace(/[—–]/g, '-').replace(/ㆍ/g, '·').replace(/(\d)\s*월\s*$/, '$1원').trim();
    for (let i = 0; i < files.length; i++) {
      onStep('사진 ' + (i + 1) + '/' + files.length + ' 읽는 중');
      const { data } = await ocrWorker.recognize(files[i]);
      try { pics[i] = await createImageBitmap(files[i]); } catch (e) { pics[i] = null; }
      for (const l of data.lines || []) { const t = fix(l.text); if (!t) continue; lines.push(t); meta.push({ pic: i, box: l.bbox, words: (l.words || []).map((w) => ({ t: w.text, box: w.bbox })) }); }
    }
    return { text: lines.join('\n'), meta, pics };
  }

  // ----- 은행 로고 알아보기: 금액 왼쪽 로고를 잘라 작은 색 지도로 만들고, 아는 로고와 비교 -----
  // 처음 보는 로고는 고른 은행을 기억해 두고 다음부터 알아서 고름 (이 기기에만 저장)
  const LOGO_KEY = 'money.v2.logos';
  // 토스 '내 계좌' 화면의 은행 로고 (8×8 색 지도)
  const LOGO_PRIORS = { '국민': [[255,241,208,254,242,208,254,242,209,252,244,203,255,241,206,252,243,206,251,243,205,255,241,208,255,242,208,255,242,208,255,242,206,254,241,210,252,243,209,254,241,210,255,239,211,255,242,208,254,242,208,254,242,205,254,240,202,247,182,100,255,213,140,241,156,51,252,242,205,255,242,208,252,243,211,248,183,92,247,150,14,250,148,3,255,239,205,243,152,18,254,240,207,255,242,208,254,243,207,249,186,97,252,207,123,250,157,21,255,224,165,254,152,5,255,230,166,255,240,203,254,242,211,254,241,205,255,240,196,255,235,183,254,239,191,250,160,19,248,210,136,254,241,212,255,242,208,255,242,208,254,243,205,255,240,197,255,242,208,255,242,208,255,242,208,255,242,210,255,242,208,255,242,208,255,241,206,255,241,207,255,242,208,255,242,208,255,242,208,254,242,206]], '토스뱅크': [[225,234,253,223,235,252,220,237,254,220,237,254,220,238,251,220,237,254,220,237,254,216,237,253,218,237,254,220,237,254,218,237,249,75,158,241,93,165,241,220,235,254,224,235,249,220,237,254,218,238,248,217,237,251,1,131,252,26,152,253,0,128,248,19,126,254,205,238,255,220,237,254,220,237,254,84,147,231,22,127,253,29,144,255,10,109,252,17,115,254,39,116,233,220,237,254,224,235,252,224,234,254,205,239,255,174,222,253,0,95,253,18,101,245,221,233,254,220,237,254,216,238,254,218,238,249,220,237,254,217,237,254,221,236,251,220,237,254,220,237,254,216,238,253,94,141,222,216,238,250,220,237,254,220,237,254,220,236,251,220,237,254,220,237,254,152,195,246,253,254,255,254,254,254,141,181,238,72,129,210,74,129,211,130,172,232,250,255,255,255,254,254]], '신한': [[234,238,254,234,239,252,234,238,254,234,238,254,234,238,254,234,238,254,234,238,254,234,239,252,234,238,251,234,238,255,178,200,249,40,88,217,38,89,213,121,149,218,237,237,254,234,238,254,236,237,254,179,203,247,240,246,255,40,94,216,249,254,253,125,148,213,86,124,205,234,238,254,232,238,254,37,100,216,189,216,245,179,206,241,97,138,212,45,98,210,40,98,219,234,238,254,235,237,254,42,105,214,36,105,216,92,136,213,245,248,253,47,106,206,35,106,217,234,238,254,234,238,254,128,166,224,238,247,255,138,170,227,35,111,215,241,246,254,61,119,206,234,238,254,234,238,254,234,238,253,100,143,210,78,131,200,33,118,219,58,126,201,233,238,252,234,238,254,234,238,254,234,238,254,233,238,253,234,237,254,232,238,254,232,238,253,236,238,252,234,238,253]], '하나': [[228,243,241,228,242,241,228,243,241,221,242,237,225,243,238,228,242,241,228,242,241,228,243,241,228,243,241,228,243,241,227,242,240,220,150,144,205,75,70,228,243,241,227,242,240,228,242,241,227,243,241,5,144,120,48,143,124,113,187,171,123,191,177,85,166,150,13,142,119,228,243,241,228,242,241,231,242,243,222,246,241,214,248,243,202,242,235,225,244,241,224,245,241,228,243,241,228,243,241,228,243,241,228,242,241,19,141,119,39,146,125,226,244,241,228,243,241,228,243,241,228,243,241,228,243,241,228,243,241,26,142,120,117,193,176,225,244,240,228,243,241,228,243,241,228,243,241,228,243,241,228,243,241,228,242,239,25,141,119,228,243,241,228,243,241,228,242,241,228,243,241,228,243,241,228,243,241,229,242,240,228,241,240,228,243,241,228,243,241,228,243,241]], '우리': [[227,245,254,227,245,254,224,246,253,225,245,254,226,246,253,227,245,254,227,245,254,226,245,254,227,244,254,226,245,253,195,237,251,9,129,201,3,129,201,162,214,241,225,245,252,227,245,254,226,245,254,197,237,255,3,131,201,8,144,207,19,144,209,0,131,201,104,173,214,227,245,254,226,245,254,21,152,210,82,194,229,154,223,243,159,222,241,89,204,230,27,156,213,227,245,254,227,245,254,111,208,234,250,254,254,254,254,254,255,254,255,253,254,251,131,211,238,227,245,254,226,245,253,77,148,186,8,129,203,0,131,202,9,130,202,11,129,204,36,129,190,227,245,254,224,246,253,228,244,253,25,128,197,1,130,203,0,130,203,8,130,197,228,244,255,227,245,254,227,245,254,227,245,254,227,245,254,225,245,254,223,245,254,225,245,254,227,245,254,228,243,254]], '농협': [[229,241,252,229,241,251,229,241,252,229,241,252,229,241,252,229,241,252,229,241,252,229,241,252,230,239,251,228,241,252,228,241,249,229,240,251,228,241,251,229,240,252,229,241,249,229,240,253,229,240,252,221,242,254,228,240,252,216,243,255,217,242,255,228,241,252,224,244,254,226,242,254,227,243,251,17,108,177,198,233,249,2,107,182,7,106,178,224,242,253,160,211,237,225,242,255,224,244,254,67,134,177,15,116,173,2,116,178,25,114,176,217,244,254,159,212,239,225,242,254,224,243,249,139,182,202,223,244,249,115,171,201,123,174,200,228,241,251,190,224,240,228,240,251,229,241,251,229,241,251,225,243,252,226,242,251,226,241,252,228,241,253,229,241,252,229,240,253,229,241,252,229,241,252,229,241,252,229,241,252,229,241,252,229,241,252,229,241,252,229,241,252]] };
  // 글자가 시작하는 x (로고 바로 오른쪽). 로고가 글자로 잘못 읽혀 붙는 줄이 있어서 사진마다 가운데 값을 씀
  function textLeft(ocr, at, nameAt) {
    const m = ocr.meta[at]; if (!m) return null;
    const w = m.words.find((x) => /\d{2}/.test(x.t)); const n = nameAt != null ? ocr.meta[nameAt] : null;
    return Math.max(w ? w.box.x0 : m.box.x0, n && n.words[0] ? n.words[0].box.x0 : 0);
  }
  function cropLogo(ocr, at, nameAt, left) {
    const m = ocr.meta[at]; const pic = m && ocr.pics[m.pic]; if (!pic) return null;
    const x1 = (left || textLeft(ocr, at, nameAt)) - 6;
    const n = nameAt != null ? ocr.meta[nameAt] : null;
    const y0 = Math.max(0, m.box.y0 - 20); const y1 = Math.min(pic.height, (n ? n.box.y1 : m.box.y1) + 20);
    if (x1 < 24 || y1 - y0 < 24) return null;
    return logoIn(pic, 0, y0, x1, y1 - y0);
  }
  // 사진의 한 영역에서 배경과 다른 네모난 덩어리(로고)를 찾아 색 지도로 만듦
  function logoIn(pic, rx, ry, rw, rh) {
    rx = Math.max(0, Math.round(rx)); ry = Math.max(0, Math.round(ry)); rw = Math.min(pic.width - rx, Math.round(rw)); rh = Math.min(pic.height - ry, Math.round(rh));
    if (rw < 24 || rh < 24) return null;
    const cv = document.createElement('canvas'); cv.width = rw; cv.height = rh;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(pic, rx, ry, rw, rh, 0, 0, rw, rh);
    const px = g.getImageData(0, 0, cv.width, cv.height).data; const bg = [px[0], px[1], px[2]];
    let a = cv.width, b = cv.height, c = -1, d = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const k = (y * cv.width + x) * 4; if (Math.abs(px[k] - bg[0]) + Math.abs(px[k + 1] - bg[1]) + Math.abs(px[k + 2] - bg[2]) > 30) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } }
    const bw = c - a, bh = d - b; if (bw < 16 || bh < 16 || bw > bh * 1.6 || bh > bw * 1.6) return null;
    // 테두리(선택 표시 등)를 피하려고 가운데 80%만 씀
    const ix = a + bw * 0.1, iy = b + bh * 0.1, iw = bw * 0.8, ih = bh * 0.8;
    const sm = document.createElement('canvas'); sm.width = sm.height = 8; const sg = sm.getContext('2d', { willReadFrequently: true });
    sg.drawImage(cv, ix, iy, iw, ih, 0, 0, 8, 8); const sp = sg.getImageData(0, 0, 8, 8).data; const sig = [];
    for (let k = 0; k < sp.length; k += 4) sig.push(sp[k], sp[k + 1], sp[k + 2]);
    return { sig };
  }
  const logoDist = (p, q) => { let s = 0; for (let k = 0; k < p.length; k++) s += Math.abs(p[k] - q[k]); return s / p.length; };
  function matchLogo(sig) {
    const known = Object.assign({}, LOGO_PRIORS); const mine = readJSON(LOGO_KEY) || {};
    for (const b of Object.keys(mine)) known[b] = (known[b] || []).concat(mine[b]);
    // 가장 가까운 은행이 충분히 가깝고, 두 번째 은행과도 확실히 차이 날 때만 고름
    const by = {};
    for (const b of Object.keys(known)) for (const q of known[b]) { const dd = logoDist(sig, q); if (by[b] == null || dd < by[b]) by[b] = dd; }
    const r = Object.entries(by).sort((x, y) => x[1] - y[1]);
    return r[0] && r[0][1] < 24 && (!r[1] || r[1][1] - r[0][1] > 6) ? r[0][0] : null;
  }
  function learnLogo(bank, sig) {
    const mine = readJSON(LOGO_KEY) || {}; const list = mine[bank] || [];
    if (list.some((q) => logoDist(q, sig) < 8)) return;
    list.unshift(sig); mine[bank] = list.slice(0, 4);
    try { localStorage.setItem(LOGO_KEY, JSON.stringify(mine)); } catch (e) { /* 편의 기능 */ }
  }
  const photoBtn = (busy) => busy ? '<div class="ocr-busy"><span class="spin"></span>' + esc(busy) + '</div>'
    : '<label class="btn photo-btn">' + I.scan + ' 캡처 사진 고르기<input type="file" accept="image/*" multiple data-live="ocr" hidden></label>';

  // ===== 캡처로 계좌·카드 한 번에 (처음 시작) =====
  // 두 모양을 다 읽음: ① 이름 줄 다음 금액 줄 (은행앱) ② 금액 줄 다음 계좌 이름 줄 (토스 내 계좌, 왼쪽에 은행 로고)
  // 이름 없는 금액은 묶음 합계로 보고 버림. "합계에 포함되지 않아요" 아래는 기본으로 빼기.
  function parseSetup(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    // 쉼표를 하나 놓친 숫자(-3989,877원)도 읽음
    const amtRe = /([-−]?\s?\d[\d,]*)\s*원|([-−]?\d{1,3}(?:,\d{3})+)/;
    const acctNoRe = /\d{2,6}-\d{2,6}(-\d{1,8})*/g;
    const noise = /송금|보내기|가져오기|불러오기|더보기|이체|개설|편집|둘러보기|찾는다면|혜택|추천|이벤트|광고|^내 계좌$|^입출금$|^저축$|^투자$|^대출$|^기타/;
    // 버튼 글자(송금 등)와 로고를 잘못 읽은 한 글자 조각은 버림
    const clean = (l) => l.replace(/송금|보내기|채우기|꺼내기/g, ' ').replace(acctNoRe, '').replace(/\*+/g, '').replace(/[·•|]\s*주계좌|주계좌/g, '').replace(/잔액|출금가능\s*(금액)?|결제\s*예정\s*(금액)?|이번\s*달|청구\s*(금액)?|이용\s*(금액)?|^금액$/g, '').replace(/[|·•:<>』「」*]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter((w) => w.length > 1).join(' ').replace(/^[^가-힣A-Za-z]+/, '');
    const isName = (l) => { const b = clean(l || ''); return !!b && /[가-힣A-Za-z]{2}/.test(b) && !amtRe.test(l) && !/^[\d\s.:\-]+$/.test(b) && !noise.test(b); };
    const out = []; let pend = null; let excl = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; if (!l) continue; const am = l.match(amtRe);
      if (!am) { if (/합계에\s*포함되지|합산\s*제외|숨긴/.test(l)) excl = true; pend = isName(l) ? { name: clean(l), at: i } : (noise.test(clean(l)) ? null : pend); continue; }
      if (/총|합계|자산|순자산|전체/.test(l)) { pend = null; continue; }
      if (/^\d{2,6}-\d{2,6}/.test(l) && !/원/.test(l)) continue; // 계좌번호 줄
      const amount = parseAmt((am[1] || am[2]).replace('−', '-').replace(/\s/g, ''));
      if (/한도/.test(l)) { const prev = out[out.length - 1]; if (prev) { prev.limit = Math.abs(amount); if (prev.kind !== 'card') prev.kind = 'overdraft'; } continue; }
      let name = clean(l.replace(amtRe, '')); if (!/[가-힣A-Za-z]{2}/.test(name)) name = '';
      let nameAt = null; const at = i;
      // 금액 줄에 붙은 짧은 글자는 버튼일 때가 많아서, 다음 줄이 이름이면 그걸 씀 (토스 내 계좌)
      if (name && name.replace(/\s/g, '').length <= 3 && !bankOf(name) && isName(lines[i + 1])) name = '';
      if (!name && pend) { name = pend.name; nameAt = pend.at; } else if (!name && isName(lines[i + 1])) { name = clean(lines[i + 1]); nameAt = i + 1; i++; }
      pend = null;
      if (!name) continue;
      if (/카드/.test(name)) excl = false; // 카드앱 캡처가 이어 붙은 것
      const kind = excl ? 'skip' : /카드/.test(name) ? 'card' : /마이너스|마통|한도대출/.test(name) || amount < 0 ? 'overdraft' : /지역화폐|지역사랑|상품권|동백|온누리|페이머니/.test(name) ? 'local' : 'bank';
      out.push({ name: name.slice(0, 24), amount, kind, limit: null, payDay: 15, bank: bankOf(name) || '', at, nameAt });
    }
    // 바로 뒤 몇 줄을 더한 값과 같은 금액은 묶음 합계로 보고 버림 (글자를 잘못 읽어 '총 자산'을 놓쳤을 때)
    for (let i = out.length - 2; i >= 0; i--) { let sum = 0; for (let j = i + 1; j < out.length; j++) { sum += out[j].amount; if (j > i + 1 && sum === out[i].amount) { out.splice(i, 1); break; } } }
    // 여러 장 캡처가 겹치면 같은 이름·금액은 한 번만 (같은 금액인데 한쪽 이름이 깨졌으면 깨진 쪽을 버림)
    const ok = (r) => /^[가-힣A-Za-z0-9 ()\-]+$/.test(r.name);
    for (let i = out.length - 1; i > 0; i--) if (out.slice(0, i).some((r) => r.amount === out[i].amount && (r.name === out[i].name || !ok(out[i])))) out.splice(i, 1);
    for (let i = out.length - 2; i >= 0; i--) if (!ok(out[i]) && out.slice(i + 1).some((r) => r.amount === out[i].amount && ok(r))) out.splice(i, 1);
    return out;
  }
  function setupSheet() {
    let rows = null; let busy = '';
    const kinds = [['bank', '입출금'], ['overdraft', '마이너스통장'], ['local', '지역화폐'], ['card', '신용카드'], ['skip', '빼기']];
    const g = (n) => document.querySelector('#sheet [name="' + n + '"]');
    const sync = () => { if (!rows) return; rows.forEach((r, i) => { if (g('n' + i)) r.name = g('n' + i).value.trim(); if (g('b' + i)) r.bank = g('b' + i).value; if (g('a' + i)) r.amount = parseAmt(g('a' + i).value); if (g('l' + i)) r.limit = parseAmt(g('l' + i).value); if (g('d' + i)) r.payDay = Number(g('d' + i).value); }); };
    const isAcct = (r) => r.kind !== 'skip' && r.kind !== 'card';
    openSheet({
      title: '캡처로 계좌·카드 추가',
      body() {
        if (!rows) return '<p class="hint">은행앱이나 토스의 <b>전체 계좌</b> 화면(카드앱은 <b>결제 예정 금액</b> 화면)을 캡처해서 골라 주세요. 여러 장도 한 번에 고를 수 있어요.</p>' + photoBtn(busy) +
          '<p class="hint">사진은 이 아이폰 안에서만 읽고 어디에도 보내지 않아요. 계좌번호는 저장하지 않아요.</p>' +
          '<details class="paste"><summary>글자를 직접 붙여넣기</summary><textarea class="input" name="raw" placeholder="사진에서 글자를 길게 눌러 모두 선택 → 복사한 뒤 붙여넣기"></textarea><button class="btn ghost" data-act="setupRead">붙여넣은 글자 읽기</button></details>';
        if (!rows.length) return '<p class="hint center">계좌와 금액을 못 찾았어요.<br>다른 캡처로 다시 골라 주세요.</p>';
        const needL = rows.filter((r) => r.kind === 'overdraft' && !r.limit).length;
        const needB = rows.filter((r) => isAcct(r) && !r.bank).length;
        const byLogo = rows.filter((r) => isAcct(r) && r.byLogo).length;
        return (needL || needB ? '<div class="ask">' + (needL ? '<b>마이너스통장 ' + needL + '개의 한도를 적어 주세요.</b><span>캡처에는 한도가 안 나와서 물어봐요. 은행앱에서 그 통장을 누르면 보여요. 한도를 알아야 쓸 수 있는 돈(남은 한도)을 계산해요.</span>' : '') +
          (needB ? '<b>' + needB + '개는 은행을 골라 주세요.</b><span>로고 옆 목록에서 고르면 그 로고를 기억해서 다음부터는 알아서 골라요.</span>' : '') + '</div>' : '<p class="hint">은행·계좌 이름·금액을 확인해 주세요.</p>') +
          (byLogo ? '<p class="hint">로고를 보고 은행 ' + byLogo + '개를 골라 뒀어요. 틀리면 바꿔 주세요.</p>' : '') + rows.map((r, i) =>
          '<div class="setup-row' + (r.kind === 'skip' ? ' off' : '') + (r.kind === 'overdraft' && !r.limit && r.need ? ' need' : '') + '">' +
          (r.kind === 'card' ? '' : '<div class="sr-bank">' + bankField('b' + i, r.bank) + '</div>') +
          '<label class="field"><span class="lab">' + (r.kind === 'card' ? '카드 이름' : '계좌 이름') + '</span><input class="input" name="n' + i + '" value="' + esc(r.name) + '" placeholder="예: 종합통장"></label>' +
          '<div class="grid2"><select class="input" data-live="setupKind" data-i="' + i + '">' + kinds.map(([v, l]) => '<option value="' + v + '"' + (r.kind === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
          (r.kind === 'skip' ? '<span></span>' : '<div class="money"><input class="input" name="a' + i + '" inputmode="numeric" pattern="[0-9]*" data-live="money" value="' + won(r.amount) + '"><span>원</span></div>') + '</div>' +
          (r.kind === 'overdraft' ? '<p class="od-note">마이너스 ' + won(r.amount) + '원 사용 중</p><label class="field"><span class="lab">마이너스통장 한도' + (r.limit ? '' : ' <em class="req">필수</em>') + '</span><div class="money"><input class="input" name="l' + i + '" inputmode="numeric" pattern="[0-9]*" data-live="money" value="' + (r.limit ? won(r.limit) : '') + '" placeholder="예: 10,000,000"><span>원</span></div></label>' : '') +
          (r.kind === 'card' ? '<select class="input" name="d' + i + '">' + dayOpts.map(([v, l]) => '<option value="' + v + '"' + (v === r.payDay ? ' selected' : '') + '>결제일 ' + l + '</option>').join('') + '</select>' : '') + '</div>').join('');
      },
      foot: () => !rows ? '' : (rows.length ? '<button class="btn" data-act="setupSave">' + rows.filter((r) => r.kind !== 'skip').length + '개 추가</button>' : '') + '<button class="btn ghost" data-act="setupBack">다시 고르기</button>',
    });
    sheet.ocr = async (files) => {
      try { const r = await readPhotos(files, (m) => { busy = m; paintSheet(); }); busy = ''; sheet.setup.read(r); }
      catch (e) { busy = ''; paintSheet(); toast('사진을 못 읽었어요. 글자 붙여넣기로 해 주세요'); }
    };
    sheet.setup = {
      read(ocr) {
        const fromPhoto = ocr && typeof ocr === 'object';
        rows = parseSetup(fromPhoto ? ocr.text : val('raw') || '');
        const left = {};
        if (fromPhoto) { const xs = {}; rows.forEach((r) => { const m = ocr.meta[r.at]; const x = textLeft(ocr, r.at, r.nameAt); if (m && x) (xs[m.pic] = xs[m.pic] || []).push(x); }); for (const k of Object.keys(xs)) { const v = xs[k].sort((a, b) => a - b); left[k] = v[Math.floor(v.length / 2)]; } }
        rows.forEach((r) => {
          if (fromPhoto && r.kind !== 'card') { try { r.logo = cropLogo(ocr, r.at, r.nameAt, ocr.meta[r.at] && left[ocr.meta[r.at].pic]); } catch (e) { r.logo = null; } }
          if (!r.bank && r.logo) { r.bank = matchLogo(r.logo.sig) || ''; r.byLogo = !!r.bank; }
          if (S.accounts.some((a) => a.name === r.name && (a.bank || '') === r.bank) || S.cards.some((c) => c.name === r.name)) r.kind = 'skip';
        });
        paintSheet();
      },
      back() { rows = null; paintSheet(); },
      kind(i, k) { sync(); rows[i].kind = k; paintSheet(); },
      bankSel() { sync(); paintSheet(); },
      save() {
        sync();
        const noLimit = rows.filter((r) => r.kind === 'overdraft' && !r.limit);
        if (noLimit.length) { noLimit.forEach((r) => { r.need = true; }); paintSheet(); const el = document.querySelector('#sheet .setup-row.need'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return toast('마이너스통장 한도를 적어 주세요'); }
        const use = rows.filter((r) => r.kind !== 'skip' && (r.name || r.bank));
        const accs = use.filter((r) => r.kind !== 'card'); const cards = use.filter((r) => r.kind === 'card');
        if (!accs.length && !S.accounts.length) return toast('카드값이 나갈 계좌도 하나 넣어 주세요');
        const t = now(); const d = today();
        for (const r of accs) {
          const a = { id: uid(), name: r.name || r.bank + ' 통장', type: r.kind, include: r.kind !== 'local', balanceAt: t, balanceDate: d };
          if (r.bank) a.bank = r.bank;
          if (r.kind === 'overdraft') { a.limit = r.limit || 0; a.balance = -Math.abs(r.amount); } else a.balance = Math.abs(r.amount);
          S.accounts.push(a);
          if (r.bank && r.logo) learnLogo(r.bank, r.logo.sig);
        }
        const payAcc = (S.accounts.find((a) => a.type === 'bank') || S.accounts[0]).id;
        for (const r of cards) {
          const c = { id: uid(), name: r.name, payDay: r.payDay, accountId: payAcc, app: {} };
          let m = d.slice(0, 7); if (C.cardPayDate(c, m) < d) m = C.addMonths(m, 1);
          if (r.amount) c.app[m] = { amount: Math.abs(r.amount), at: t, date: d };
          S.cards.push(c);
        }
        const ob = onboarding(); if (!ob) S.started = true; else if (S.onboard == null) S.onboard = 1;
        save(); closeSheet(); if (!ob) location.hash = '#/home'; render(); toast('계좌 ' + accs.length + '개 · 카드 ' + cards.length + '개 추가했어요');
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
    delete S.onboard; S.started = true; save(); closeSheet(); location.hash = '#/home'; render(); toast('가져왔어요');
  }
  function mergeSeed(d) {
    const findAcc = (n) => S.accounts.find((a) => a.name === n);
    const findCard = (n) => S.cards.find((c) => c.name === n);
    const add = { 계좌: 0, 카드: 0, 고정비: 0, 수입: 0, 대출: 0, '갚을·받을 돈': 0, 할부: 0 };
    const t = today(); const P = curP();
    for (const a of d.accounts || []) {
      let x = findAcc(a.name);
      if (!x) { x = { id: uid(), name: a.name, bank: a.bank || bankOf(a.name) || (a.name === '토스' ? '토스뱅크' : null), type: a.kind === 'overdraft' ? 'overdraft' : a.kind === 'local' ? 'local' : 'bank', include: a.kind !== 'local', balance: 0, balanceAt: 0, balanceDate: null }; S.accounts.push(x); add.계좌++; }
      if (!x.bank) x.bank = bankOf(x.name) || (x.name === '토스' ? '토스뱅크' : null);
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
    delete S.onboard; S.started = true; save(); closeSheet(); render();
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
    padKey(d) {
      const el = padEl && padEl.to; if (!el) return;
      if (d.k === 'del') { const dg = el.value.replace(/[^0-9]/g, ''); el.value = dg.slice(0, -1); } else el.value = el.value + d.k;
      el.dispatchEvent(new Event('input', { bubbles: true })); padKo();
    },
    padClose: () => closePad(),

    saveRecord,
    deleteRecord(d) { if (!confirm('이 기록을 지울까요?')) return; S.records = S.records.filter((x) => x.id !== d.id); save(); closeSheet(); render(); toast('지웠어요 · 잔액과 흐름에서도 빠졌어요'); },
    bookCat(d) { view.cat = d.k; render(); },
    goBook() { location.hash = '#/book'; },
    bankOpen(d) { bankPop(d.f); },
    bankClose() { bankClose(); },
    bankPick(d) {
      bankClose();
      const sc = bankScope(); const inp = sc.querySelector('[name="' + d.f + '"]'); if (!inp) return; inp.value = d.b;
      const btn = sc.querySelector('.bank-btn[data-f="' + d.f + '"]'); btn.classList.remove('empty'); btn.innerHTML = bankIcon(d.b) + '<b>' + esc(d.b) + '</b><span class="chev">' + I.right + '</span>';
      if (sheet && sheet.setup) sheet.setup.bankSel();
    },
    resetAll() {
      const n = S.accounts.length + S.cards.length + S.fixed.length + S.loans.length + S.records.length;
      openSheet({ title: '처음부터 다시 시작', body: () => '<p class="hint">이 아이폰에 저장된 계좌·카드·고정비·대출·가계부 ' + n + '개를 모두 지워요. 되돌릴 수 없어요.<br>남겨 두고 싶으면 먼저 백업을 내보내 주세요.</p>',
        foot: () => '<button class="btn ghost" data-act="exportJSON">먼저 백업 내보내기</button><button class="btn danger" data-act="resetGo">모두 지우고 처음부터</button>' });
    },
    resetGo() { try { [KEY, OLDKEY, 'money.v2.last'].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* 지울 게 없음 */ } S = C.emptyState(); last = {}; closeSheet(); location.hash = '#/home'; render(); toast('모두 지웠어요'); },
    setup: () => setupSheet(), setupRead: () => sheet.setup.read(), setupBack: () => sheet.setup.back(), setupSave: () => sheet.setup.save(), 
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
    dynAdd(d, el) { el.insertAdjacentHTML('beforebegin', d.t === 'disc' ? discRow() : d.t === 'inc' ? extraRow() : perkRow()); const r = el.previousElementSibling; r.querySelector('input').focus(); },
    dynDel(d, el) { el.closest('.dyn-row').remove(); },
    obDay(d) { if (sheet) closeSheet(); S.settings.payDay = Number(d.d); obAnswer(1); },
    obHasSal(d) { const no = d.v === '0'; S.settings.noSalary = no; if (no) { delete S.obSalary; delete S.obSalBank; delete S.obSalAcc; if (S.obMaxQ == null) S.settings.payDay = 1; } else if (S.obMaxQ == null) S.settings.payDay = 25; obAnswer(0); },
    obDayOk() { const el = document.getElementById('obDayIn') || {}; const v = noSal() && !String(el.value || '').trim() ? 1 : Number(el.value); if (!(v >= 1 && v <= 31)) return toast('1일부터 31일 중에 적어 주세요');
      // 29·30일은 '말일'인지 한 번 물어봄 (31일은 말일과 같게 계산)
      if (v === 29 || v === 30) return openSheet({ title: '매달 말일에 받나요?', body: () => '<p class="hint">' + v + '일이 없는 달(2월 등)은 그달 마지막 날로 계산해요. 31일까지 있는 달에도 말일에 받는다면 \'말일\'을 골라 주세요.</p>',
        foot: () => '<button class="btn" data-act="obDay" data-d="31">네, 매달 말일이에요</button><button class="btn ghost" data-act="obDay" data-d="' + v + '">아니요, 매월 ' + v + '일이에요</button>' });
      S.settings.payDay = v; obAnswer(1); },
    obSalOk(d) { if (d.skip) S.obSalary = null; else { obReadSal(); if (!S.obSalary) return toast('월급을 적어 주세요'); } obAnswer(2); },
    obSalAcc(d) { S.obSalAcc = d.id; const sal = salaryOf(); if (sal) sal.accountId = d.id; save(); render(); },
    obBank(d) { S.obSalBank = d.b || null; delete S.obSalAcc; obAnswer(3); },
    obAcc(d) { S.obSalAcc = d.id; S.obSalBank = (acct(d.id) || {}).bank || null; obAnswer(3); },
    obEdit(d) { obReadSal(); S.obQ = Number(d.q); save(); render(); window.scrollTo(0, 0); focusAmt(document.getElementById('obSal') || document.getElementById('obDayIn')); },
    obNext() { obReadSal(); if ((S.onboard || 0) <= 1) obSalarySave(); S.onboard = (S.onboard || 0) + 1; save(); render(); window.scrollTo(0, 0); },

    obBack() { obReadSal(); if (!S.onboard) { if (obQ() > 0) S.obQ = obQ() === 4 ? (noSal() ? 1 : 2) : obQ() - 1; else delete S.onboard; } else S.onboard -= 1; save(); render(); window.scrollTo(0, 0); },
    obStart() { S.onboard = 0; save(); render(); window.scrollTo(0, 0); },
    obDone: () => obFinish(),
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
    editAccount: (d) => editAccount(d.id), editCard: (d) => editCard(d.id), editFixed: (d) => editFixed(d.id, { name: d.name, cat: d.cat }), fixedInfo: (d) => fixedInfo(d.id), editIncome: (d) => editIncome(d.id),
    editLoan: (d) => editLoan(d.id), editInst: (d) => editInst(d.id, d.card), editDebt: (d) => editDebt(d.id), debt: (d) => debtSheet(d.id),
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
    backup: () => backupSheet(),
    importPaste() { const t = (val('seed') || '').trim(); if (!t) return toast('내용을 붙여넣어 주세요'); takeImport(t); },
    importFile: () => document.getElementById('importFile').click(),
    exportJSON,
    remigrate() { if (!confirm('예전 버전 데이터로 지금 데이터를 바꿀까요?')) return; S = fromV1(readJSON(OLDKEY)); save(); location.hash = '#/home'; render(); toast('예전 데이터를 가져왔어요'); },
  };
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) { if (ev.target.id === 'scrim') closeSheet(); return; }
    const fn = A[el.dataset.act]; if (!fn || el.dataset.act === 'padKey') return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') ev.preventDefault();
    fn(el.dataset, el, ev);
  });
  document.addEventListener('click', (ev) => { if (!PAD_ON) return; const el = ev.target.closest && ev.target.closest(PAD_SEL); if (el) openPad(el); }, true);
  // [만]·[천]을 눌러도 자판이 내려가지 않게
  // 키패드는 손가락이 닿는 순간 바로 반응 (사파리가 빠른 연타를 두 번 누르기로 보고 click을 버리는 일 방지)
  document.addEventListener('pointerdown', (ev) => {
    if (!ev.target.closest || !ev.target.closest('#pad')) return;
    ev.preventDefault();
    const k = ev.target.closest('[data-act=padKey]'); if (k) { k.classList.add('hit'); setTimeout(() => k.classList.remove('hit'), 120); A.padKey(k.dataset); }
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target; const live = el.dataset && el.dataset.live;
    // 숫자 칸(날짜·금액)은 숫자 말고는 안 들어가게
    if (el.getAttribute && el.getAttribute('inputmode') === 'numeric' && live !== 'money') { const d = el.value.replace(/[^0-9]/g, ''); if (d !== el.value) el.value = d; }
    if (live === 'money') {
      const n = Math.abs(parseAmt(el.value)); el.value = el.value.trim() === '' ? '' : won(n); koFill(el);
      if (el.dataset.est != null) { const g = n - Number(el.dataset.est); const gap = document.getElementById('gap'); if (gap) gap.textContent = (g > 0 ? '+' : g < 0 ? '−' : '') + won(g); }
      recHint();
    } else if (live === 'hint') recHint();
    else if (live === 'pick') sheet.cap.pick(Number(el.dataset.i), el.checked);
    if (view.tab === 'input' && !sheet) inputPreview();
  });
  document.addEventListener('change', (ev) => { const dl = ev.target.dataset && ev.target.dataset.live;
    if (dl === 'ocr' && sheet && sheet.ocr && ev.target.files.length) { sheet.ocr(Array.from(ev.target.files)); return; } if (dl === 'setupKind') sheet.setup.kind(Number(ev.target.dataset.i), ev.target.value); if (dl === 'setupB') sheet.setup.bankSel(); if (dl === 'hint') recHint(); if (view.tab === 'input' && !sheet) inputPreview(); });

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
