// 재무앱 화면. 숫자는 모두 Engine(engine.js)이 계산하고, 여기서는 보여주고 입력만 받음.
(function () {
  'use strict';
  const E = window.Engine;
  const KEY = 'money.v1';
  const UIKEY = 'money.ui.v1';

  // ---------- 저장 (기기 로컬 우선, M7) ----------
  let S = load();
  let UI = Object.assign({ last: {}, expanded: {} }, readJSON(UIKEY) || {});
  UI.expanded = {};
  const view = { tab: 'home', period: null, flowFilter: 'all', ledgerTab: 'account' };

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function load() {
    const s = readJSON(KEY);
    if (!s || !s.version) return E.emptyState();
    const base = E.emptyState();
    for (const k of Object.keys(base)) if (s[k] == null) s[k] = base[k];
    for (const c of base.categories) if (s.categories.indexOf(c) < 0) s.categories.splice(s.categories.length - 1, 0, c);
    return s;
  }
  function save() {
    S.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장 공간이 부족해요. 백업을 내보내 주세요'); }
    try { localStorage.setItem(UIKEY, JSON.stringify({ last: UI.last })); } catch (e) { /* 편의 기능 */ }
    if (window.Sync) window.Sync.schedule();
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const now = () => Date.now();
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const APP_VERSION = '10.17-5';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const curPeriod = () => E.periodOf(S, today());

  // ---------- 표기 ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => Math.round(n).toLocaleString('ko-KR');
  const wonS = (n) => (n < 0 ? '−' : '') + won(Math.abs(n));
  const md = (d) => Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10));
  const pName = (p) => Number(p.slice(5, 7)) + '월';
  const pNameFull = (p) => p.slice(0, 4) + '년 ' + Number(p.slice(5, 7)) + '월 급여주기';
  const parseAmt = (s) => { const n = Number(String(s || '').replace(/[^0-9-]/g, '')); return isFinite(n) ? n : 0; };
  const ago = (t) => {
    if (!t) return '확인 전';
    const m = Math.floor((now() - t) / 60000);
    if (m < 1) return '방금';
    if (m < 60) return m + '분 전';
    if (m < 1440) return Math.floor(m / 60) + '시간 전';
    return Math.floor(m / 1440) + '일 전';
  };
  const acct = (id) => S.accounts.find((a) => a.id === id);
  const card = (id) => S.cards.find((c) => c.id === id);
  const refName = (ref) => !ref ? '' : ref.type === 'card' ? (card(ref.id) || {}).name || '카드' : (acct(ref.id) || {}).name || '계좌';
  const person = (id) => S.people.find((p) => p.id === id);

  // ---------- 아이콘 (선 아이콘) ----------
  const sv = (d, w) => '<svg width="' + (w || 20) + '" height="' + (w || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const I = {
    card: sv('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/>'),
    bank: sv('<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>'),
    wallet: sv('<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2"/>'),
    coin: sv('<circle cx="12" cy="12" r="8"/><path d="M9 9.5h6M9 12h6M12 9.5V16"/>'),
    refresh: sv('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>', 16),
    plus: sv('<path d="M12 5v14"/><path d="M5 12h14"/>', 24),
    close: sv('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 22),
    left: sv('<path d="M15 6l-6 6 6 6"/>'),
    right: sv('<path d="M9 6l6 6-6 6"/>', 16),
    down: sv('<path d="M6 9l6 6 6-6"/>', 16),
    up: sv('<path d="M6 15l6-6 6 6"/>', 16),
    warn: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.5"/>', 18),
    edit: sv('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', 18),
    scan: sv('<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>', 16),
    person: sv('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    repeat: sv('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
    home: sv('<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>', 24),
    flow: sv('<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>', 24),
    book: sv('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 9h6"/><path d="M9 13h6"/>', 24),
    sliders: sv('<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/>', 24),
  };
  const CAT_ICON = {
    식비: '<path d="M7 3v8"/><path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3"/><path d="M7 11v10"/><path d="M17 21V3c-2 1.5-3 4-3 7v3h3"/>',
    카페: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3v3"/><path d="M12 3v3"/>',
    교통: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><path d="M8 21l1.5-4"/><path d="M16 21l-1.5-4"/>',
    쇼핑: '<path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    생활: '<path d="M4 10.5L12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
    의료: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    경조사: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11"/><path d="M4 13h16"/>',
    주거: '<path d="M3 11l9-7 9 7"/><path d="M6 10v10h12V10"/>',
    통신: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    구독: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M10 9l4 2-4 2z"/><path d="M8 21h8"/>',
    급여: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  };
  const catIcon = (c) => sv(CAT_ICON[c] || '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>', 22);
  const acctIcon = (a) => a.kind === 'cash' ? I.wallet : a.kind === 'local' ? I.coin : I.bank;

  // ---------- 토스트 ----------
  let toastT;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- 시트 ----------
  let sheet = null; // { title, body(), foot(), onSave, ... }
  function openSheet(def) {
    sheet = def;
    const sc = document.getElementById('scrim'), sh = document.getElementById('sheet');
    paintSheet();
    sc.hidden = false; sh.hidden = false;
    requestAnimationFrame(() => { sc.classList.add('show'); sh.classList.add('show'); });
    if (def.focus) setTimeout(() => { const f = sh.querySelector(def.focus); if (f) f.focus(); }, 300);
  }
  function paintSheet() {
    if (!sheet) return;
    const sh = document.getElementById('sheet');
    const top = sheet.headRight ? sheet.headRight() : '';
    sh.innerHTML = '<div class="grab"></div><div class="head"><h2>' + esc(sheet.title) + '</h2><div style="display:flex;align-items:center;gap:4px">' + top +
      '<button class="icon-btn" data-act="closeSheet" aria-label="닫기">' + I.close + '</button></div></div>' +
      '<div class="body">' + sheet.body() + '</div>' + (sheet.foot ? '<div class="foot">' + sheet.foot() + '</div>' : '');
    if (sheet.mount) sheet.mount(sh);
  }
  function closeSheet() {
    const sc = document.getElementById('scrim'), sh = document.getElementById('sheet');
    sc.classList.remove('show'); sh.classList.remove('show');
    setTimeout(() => { if (!sh.classList.contains('show')) { sh.hidden = true; sc.hidden = true; sh.innerHTML = ''; } }, 300);
    sheet = null;
  }
  const val = (name) => { const el = document.querySelector('#sheet [name="' + name + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };

  // ---------- 화면 그리기 ----------
  function render() {
    const app = document.getElementById('app');
    if (!S.accounts.length && !S.onboarded) { app.innerHTML = onboarding(); return; }
    E.ensurePeriod(S, curPeriod(), now());
    // 카드로 나가는 정기결제·할부는 날짜가 지나면 사용 완료로 (카드값 계산은 반영 상태로 따로 함)
    const t0 = today();
    S.txns.forEach((t) => { if (t.status === 'planned' && t.from && t.from.type === 'card' && t.source && (t.source.ruleId || t.source.installmentId) && t.date <= t0) t.status = 'done'; });
    if (!view.period) view.period = curPeriod();
    const body = { home: homeScreen, flow: flowScreen, ledger: ledgerScreen, manage: manageScreen }[view.tab]();
    app.innerHTML = '<main class="screen">' + body + '</main>' + tabbar();
  }
  function tabbar() {
    const a = (tab, icon, label) => '<a href="#/' + tab + '" class="' + (view.tab === tab ? 'on' : '') + '"' + (view.tab === tab ? ' aria-current="page"' : '') + '>' + icon + '<span>' + label + '</span></a>';
    return '<nav class="tabbar" aria-label="하단 메뉴">' + a('home', I.home, '현황') + a('flow', I.flow, '흐름') +
      '<button class="plus" data-act="addRecord" aria-label="기록 추가">' + I.plus + '</button>' +
      a('ledger', I.book, '장부') + a('manage', I.sliders, '관리') + '</nav>';
  }
  function periodBar(note) {
    const p = view.period;
    const r = E.periodRange(S, p);
    const st = E.isClosed(S, p) ? '마감됨' : p === curPeriod() ? '진행 중' : p > curPeriod() ? '예정' : '마감 전';
    return '<div class="period"><button class="icon-btn" data-act="period" data-d="-1" aria-label="이전 기간">' + I.left + '</button>' +
      '<div class="mid"><b>' + pName(p) + ' 급여주기</b><span class="sub" style="justify-content:center">' + md(r.start) + ' – ' + md(r.end) + ' · ' + st + (note ? ' · ' + note : '') + '</span></div>' +
      '<button class="icon-btn" data-act="period" data-d="1" aria-label="다음 기간"><span style="display:inline-flex;transform:scale(1.25)">' + I.right + '</span></button></div>';
  }
  const syncLabel = () => window.Sync && window.Sync.status ? window.Sync.status() : { on: false, text: '이 기기에 저장' };

  // ===== ① 현황 =====
  function homeScreen() {
    const t = today();
    const sm = E.summary(S, t);
    const sync = syncLabel();
    let h = '<div class="top"><div><h1>' + pName(sm.period) + '</h1><div class="sub"><span>' + md(sm.start) + ' – ' + md(sm.end) + ' · ' + sm.daysLeft + '일 남음</span>' +
      '<span class="dot' + (sync.on ? '' : ' off') + '"></span><span>' + esc(sync.text) + '</span></div></div>' +
      '<button class="pill" data-act="quick">' + I.refresh + '<span>빠른 업데이트</span></button></div>';
    if (sm.unclosedPrev) h += '<button class="banner" data-act="closeFlow" data-p="' + E.addMonths(sm.period, -1) + '">' + I.warn + '<span>' + pName(E.addMonths(sm.period, -1)) + ' 마감이 아직 남았어요</span><b>마감하기</b></button>';

    // 큰 숫자 3개
    const ex = UI.expanded;
    h += '<div class="card"><button class="row" style="padding:0;min-height:0" data-act="toggle" data-k="spend"><div class="grow" style="gap:6px"><span class="label-lg">쓸 수 있는 돈</span>' +
      '<span class="big">' + wonS(sm.spendable) + '<small>원</small></span></div><span class="chev">' + (ex.spend ? I.up : I.down) + '</span></button>';
    if (ex.spend) {
      h += '<div class="detail" style="margin:0">' + sm.balances.filter((b) => b.account.include).map((b) =>
        '<div class="line"><span>' + esc(b.account.name) + (b.account.kind === 'overdraft' && S.settings.overdraftMode !== 'balance' ? ' · 남은 한도' : '') + ' · ' + ago(b.checkedAt) + '</span><span>' + wonS(b.available) + '</span></div>').join('') +
        (sm.debtTotal ? '<div class="line"><span>대출·마통 사용액 (따로 관리)</span><span>' + won(sm.debtTotal) + '</span></div>' : '') +
        '<button class="btn sm soft" style="align-self:flex-end" data-act="quick" data-tab="balance">잔액 고치기</button></div>';
    }
    h += '<div class="hr"></div><div class="grid2"><button class="tile" style="padding:0" data-act="toggle" data-k="fore"><span class="label">예상잔액</span><span class="mid-num">' + wonS(sm.forecast) + '원</span></button>' +
      '<button class="tile" style="padding:0" data-act="toggle" data-k="cards"><span class="label">다음 카드값</span><span class="mid-num">' + won(sm.nextCardTotal) + '원</span></button></div>';
    if (ex.fore) {
      h += '<div class="detail" style="margin:0"><div class="line"><span>쓸 수 있는 돈</span><span>' + wonS(sm.spendable) + '</span></div>' +
        (sm.plannedIn ? '<div class="line"><span>들어올 예정</span><span class="in">+' + won(sm.plannedIn) + '</span></div>' : '') +
        sm.plannedOut.map((o) => '<div class="line"><span>' + md(o.date) + ' ' + esc(o.label) + '</span><span>−' + won(o.amount) + '</span></div>').join('') +
        '<div class="line"><span>' + md(sm.end) + ' 예상</span><b>' + wonS(sm.forecast) + '</b></div></div>';
    }
    h += '</div>';

    // 카드사별 (W1: 누르면 세부 + 고치기)
    if (sm.nextCards.length) {
      h += '<div class="card tight">' + sm.nextCards.map((b) => {
        const k = 'c_' + b.card.id; const open = ex[k];
        let r = '<button class="row" data-act="toggle" data-k="' + k + '"><span class="ico ' + (open ? 'blue' : '') + '">' + I.card + '</span><div class="grow"><span class="t" style="font-weight:600">' + esc(b.card.name) + '</span>' +
          '<span class="s">' + md(b.payDate) + ' 출금 예정' + (b.paid ? ' · 결제 완료' : '') + '</span></div><span class="amt" style="font-size:16px;font-weight:700">' + won(b.total) + '원</span><span class="chev">' + (open ? I.up : I.down) + '</span></button>';
        if (open) {
          r += '<div class="detail"><div class="line"><span>카드앱 확인액 · ' + (b.confirmedAt ? ago(b.confirmedAt) : '확인 전') + '</span><span>' + won(b.confirmed) + '</span></div>' +
            '<div class="line"><span>확인 이후 사용 ' + b.afterCheckItems.length + '건</span><span>+' + won(b.afterCheck) + '</span></div>' +
            '<div class="line"><span>아직 안 보이는 예정 ' + b.pendingItems.length + '건</span><span>+' + won(b.pending) + '</span></div>' +
            '<button class="btn sm soft" style="align-self:flex-end" data-act="cardCheck" data-id="' + b.card.id + '" data-m="' + b.payMonth + '">확인액 고치기</button></div>';
        }
        return r;
      }).join('') + '</div>';
    }

    h += '<div class="grid2"><button class="tile" data-act="toggle" data-k="fore"><span class="label">남은 예정 지출</span><span class="v">' + won(sm.remainingPlanned) + '원</span></button>' +
      '<a class="tile" href="#/ledger" data-act="ledgerTab" data-t="people" style="text-decoration:none;color:inherit"><span class="label">받을 돈 · 갚을 돈</span><span class="v"><span class="in">+' + won(sm.receivable) + '</span> <span class="muted" style="font-weight:500">/</span> ' + won(sm.payable) + '</span></a></div>';
    if (S.accounts.some((a) => a.kind === 'local' && !a.include)) h += '<div class="sub" style="justify-content:space-between;padding:2px 6px"><span>지역화폐 · 합계에서 빠져 있어요</span><span>' + won(sm.localMoney) + '원</span></div>';
    return h;
  }

  // ===== 빠른 업데이트 시트 (D6) =====
  function quickSheet(tab) {
    let qt = tab || 'balance';
    openSheet({
      title: '빠른 업데이트',
      body() {
        const t = today(); const sm = E.summary(S, t);
        const segs = [['balance', '잔액'], ['card', '카드'], ['planned', '예정'], ['settle', '정산']];
        let h = '<div class="seg">' + segs.map(([k, l]) => '<button data-act="qtab" data-t="' + k + '" class="' + (qt === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
        if (qt === 'balance') {
          h += '<div class="hint">은행앱에 보이는 잔액을 그대로 적으면 기준점이 다시 맞춰져요.</div><div class="list-box">' + sm.balances.map((b) =>
            '<button class="row" data-act="balance" data-id="' + b.account.id + '"><span class="ico">' + acctIcon(b.account) + '</span><div class="grow"><span class="t">' + esc(b.account.name) + '</span><span class="s">확인 ' + ago(b.checkedAt) + (b.account.kind === 'overdraft' ? ' · 남은 한도 ' + wonS(b.available) : '') + '</span></div><span class="amt">' + wonS(b.amount) + '원</span><span class="chev">' + I.right + '</span></button>').join('') + '</div>';
        } else if (qt === 'card') {
          h += '<div class="hint">카드앱의 결제 예정 금액을 적어요. 저장하면 아직 안 보이던 항목을 체크할 수 있어요.</div><div class="list-box">' + (sm.nextCards.map((b) =>
            '<button class="row" data-act="cardCheck" data-id="' + b.card.id + '" data-m="' + b.payMonth + '"><span class="ico blue">' + I.card + '</span><div class="grow"><span class="t">' + esc(b.card.name) + ' · ' + pName(b.payMonth) + ' 결제</span><span class="s">확인 ' + (b.confirmedAt ? ago(b.confirmedAt) : '전') + '</span></div><span class="amt">' + won(b.total) + '원</span><span class="chev">' + I.right + '</span></button>').join('') || '<div class="empty">등록된 카드가 없어요</div>') + '</div>';
        } else if (qt === 'planned') {
          const due = S.txns.filter((x) => x.status === 'planned' && x.date <= sm.end && !(x.from && x.from.type === 'card')).sort((a, b) => (a.date < b.date ? -1 : 1));
          const cardP = S.txns.filter((x) => x.from && x.from.type === 'card' && x.reflect === 'unreflected' && x.status === 'planned');
          const bills = sm.cardBills.filter((b) => !b.paid && b.total > 0);
          if (bills.length) h += '<div class="group-title" style="padding-left:2px">카드대금 출금</div><div class="list-box">' + bills.map((b) => '<div class="row"><div class="grow"><span class="t">' + esc(b.card.name) + ' ' + pName(b.payMonth) + ' 결제</span><span class="s">' + md(b.payDate) + ' · ' + esc((acct(b.card.accountId) || {}).name || '') + '</span></div><span class="amt">−' + won(b.total) + '</span><button class="btn sm soft" data-act="payCard" data-id="' + b.card.id + '" data-m="' + b.payMonth + '">출금됨</button></div>').join('') + '</div>';
          h += '<div class="group-title" style="padding-left:2px">계좌에서 나가고 들어올 예정</div><div class="list-box">' + (due.map((x) => txnRow(x, '<button class="btn sm soft" data-act="markDone" data-id="' + x.id + '">완료</button>')).join('') || '<div class="empty">남은 예정이 없어요</div>') + '</div>';
          h += '<div class="group-title" style="padding-left:2px">카드앱에 아직 안 보이는 항목</div><div class="list-box">' + (cardP.map((x) => txnRow(x, '<button class="btn sm soft" data-act="markReflect" data-id="' + x.id + '">반영됨</button>')).join('') || '<div class="empty">모두 반영됐어요</div>') + '</div>';
        } else {
          const open = S.debts.filter((d) => E.debtStatus(S, d).remaining > 0);
          h += '<div class="list-box">' + (open.map((d) => debtRow(d)).join('') || '<div class="empty">정산할 받을 돈·갚을 돈이 없어요</div>') + '</div>';
        }
        return h;
      },
    });
    sheet.setTab = (t) => { qt = t; paintSheet(); };
  }
  function txnRow(x, right) {
    const sign = x.kind === 'income' || (x.kind === 'settle' && x.to) ? '+' : x.kind === 'transfer' ? '' : '−';
    return '<div class="row"><div class="grow" data-act="editTxn" data-id="' + x.id + '"><span class="t">' + esc(x.memo || x.categoryId || '기록') + (x.carriedFrom ? ' <span class="badge gray">' + pName(x.carriedFrom) + '에서 넘어옴</span>' : '') + '</span>' +
      '<span class="s">' + md(x.date) + ' · ' + esc(refName(x.from || x.to)) + '</span></div><span class="amt' + (sign === '+' ? ' in' : '') + '">' + sign + won(x.amount) + '</span>' + (right || '') + '</div>';
  }
  function debtRow(d) {
    const st = E.debtStatus(S, d); const p = person(d.personId);
    return '<button class="row" data-act="debt" data-id="' + d.id + '"><span class="ico">' + I.person + '</span><div class="grow"><span class="t">' + esc((p ? p.name : '') + (d.reason ? ' · ' + d.reason : '')) + '</span>' +
      '<span class="s">' + (d.dir === 'recv' ? '받을 돈' : '갚을 돈') + ' · ' + st.state + (st.extra ? ' · ' + won(st.extra) + '원 더 ' + (d.dir === 'recv' ? '받음' : '갚음') : '') + (d.dueDate ? ' · ' + md(d.dueDate) + ' 예정' : '') + (d.includeInForecast ? ' · 예상잔액 반영' : '') + '</span></div>' +
      '<span class="amt' + (d.dir === 'recv' ? ' in' : '') + '">' + (d.dir === 'recv' ? '+' : '') + won(st.remaining) + '</span><span class="chev">' + I.right + '</span></button>';
  }

  // ===== 잔액 확인 (P1 기준점) =====
  function balanceSheet(id) {
    const a = acct(id); const est = E.accountBalance(S, id).amount;
    openSheet({
      title: a.name + ' 잔액', focus: '[name=amt]',
      body: () => '<div class="field"><span>은행앱에 보이는 잔액</span><div class="amount-in"><input name="amt" inputmode="numeric" data-live="money" data-est="' + est + '" value="' + won(est) + '"><span>원</span></div></div>' +
        '<div class="detail" style="margin:0"><div class="line"><span>앱이 계산한 잔액</span><span>' + wonS(est) + '</span></div><div class="line"><span>기록 안 된 금액</span><span id="gap" class="gap">0</span></div></div>' +
        '<div class="hint">차이가 있으면 그만큼 기록하지 않은 입출금이 있다는 뜻이에요. 저장하면 이 금액이 새 기준점이 되고, 이후 기록만 더하고 빼요.</div>',
      foot: () => '<button class="btn" data-act="saveBalance" data-id="' + id + '">저장</button>',
    });
  }
  function cardCheckSheet(id, m) {
    const c = card(id); const b = E.cardBill(S, id, m);
    let step = 1;
    openSheet({
      title: c.name + ' ' + pName(m) + ' 결제', focus: '[name=amt]',
      body() {
        if (step === 1) {
          return '<div class="field"><span>카드앱의 결제 예정 금액</span><div class="amount-in"><input name="amt" inputmode="numeric" data-live="money" value="' + (b.confirmedAt ? won(b.confirmed) : '') + '" placeholder="0"><span>원</span></div></div>' +
            '<div class="detail" style="margin:0"><div class="line"><span>지난 확인액</span><span>' + (b.confirmedAt ? won(b.confirmed) + ' · ' + ago(b.confirmedAt) : '없음') + '</span></div><div class="line"><span>확인 이후 사용</span><span>+' + won(b.afterCheck) + '</span></div><div class="line"><span>아직 안 보이는 예정</span><span>+' + won(b.pending) + '</span></div></div>';
        }
        const nb = E.cardBill(S, id, m);
        return '<div class="hint">카드앱에 이미 보이는 항목을 반영됨으로 바꿔 주세요. 안 보이는 것만 카드값에 더해요.</div><div class="list-box">' +
          (cardItemsFor(id, m).map((x) => txnRow(x, '<button class="btn sm ' + (x.reflect === 'reflected' ? 'gray' : 'soft') + '" data-act="toggleReflect" data-id="' + x.id + '">' + (x.reflect === 'reflected' ? '반영됨 ✓' : '반영됨') + '</button>')).join('') || '<div class="empty">체크할 예정 항목이 없어요</div>') +
          '</div><div class="detail" style="margin:0"><div class="line"><span>예상 카드값</span><b>' + won(nb.total) + '원</b></div></div>';
      },
      foot: () => step === 1 ? '<button class="btn" data-act="saveCardCheck" data-id="' + id + '" data-m="' + m + '">저장</button>' : '<button class="btn" data-act="closeSheet">완료</button>',
    });
    sheet.next = () => { step = 2; paintSheet(); };
  }
  const cardItemsFor = (id, m) => S.txns.filter((x) => x.kind === 'expense' && x.from && x.from.type === 'card' && x.from.id === id && x.cardPayMonth === m && (x.source && (x.source.ruleId || x.source.installmentId) || x.status === 'planned'));

  // ===== + 기록 (W2: 한 화면, 마지막 분류·결제수단 기억) =====
  function methodOptions(sel, withCards) {
    let o = S.accounts.map((a) => '<option value="account:' + a.id + '"' + (sel === 'account:' + a.id ? ' selected' : '') + '>' + esc(a.name) + (a.kind === 'cash' ? '' : ' (계좌·체크)') + '</option>').join('');
    if (withCards) o += S.cards.map((c) => '<option value="card:' + c.id + '"' + (sel === 'card:' + c.id ? ' selected' : '') + '>' + esc(c.name) + ' (신용)</option>').join('');
    return o;
  }
  const refOf = (v) => { if (!v) return null; const [type, id] = v.split(':'); return { type, id }; };
  const refVal = (r) => (r ? r.type + ':' + r.id : '');

  function recordSheet(existing, preset) {
    const x = existing ? JSON.parse(JSON.stringify(existing)) : Object.assign({
      kind: 'expense', amount: 0, date: today(), memo: '',
      categoryId: UI.last.category || '식비',
      from: refOf(UI.last.method) || (S.accounts[0] ? { type: 'account', id: S.accounts[0].id } : null),
    }, preset || {});
    const f = { kind: x.kind, cat: x.categoryId };
    openSheet({
      title: existing ? '기록 고치기' : '기록하기', focus: existing ? null : '[name=amt]',
      headRight: () => existing ? '' : '<button class="pill" style="background:var(--line-soft)" data-act="importOpen">' + I.scan + '<span>캡처로 가져오기</span></button>',
      body() {
        const kinds = [['expense', '지출'], ['income', '수입'], ['transfer', '이체']];
        let h = '<div class="seg">' + kinds.map(([k, l]) => '<button data-act="recKind" data-k="' + k + '" class="' + (f.kind === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
        h += '<div class="field"><span>' + (f.kind === 'income' ? '얼마 들어왔나요?' : f.kind === 'transfer' ? '얼마 옮겼나요?' : '얼마를 썼나요?') + '</span><div class="amount-in"><input name="amt" inputmode="numeric" data-live="money" value="' + (x.amount ? won(x.amount) : '') + '" placeholder="0"><span>원</span></div>' +
          '<div class="chips">' + [1000, 10000, 50000].map((n) => '<button class="chip" data-act="addAmt" data-n="' + n + '">+' + (n >= 10000 ? n / 10000 + '만' : n / 1000 + '천') + '</button>').join('') + '</div></div>';
        if (f.kind !== 'transfer') {
          const cats = f.kind === 'income' ? ['급여', '용돈', '환급', '이자', '기타'] : S.categories.filter((c) => c !== '급여');
          h += '<div class="field"><span>분류</span><div class="cats">' + cats.map((c) => '<button class="cat' + (f.cat === c ? ' on' : '') + '" data-act="recCat" data-c="' + esc(c) + '" aria-pressed="' + (f.cat === c) + '">' + catIcon(c) + '<span>' + esc(c) + '</span></button>').join('') + '</div></div>';
        }
        if (f.kind === 'expense') h += '<label class="field"><span>결제수단</span><select class="input" name="method" data-live="hint">' + methodOptions(refVal(x.from), true) + '</select></label>';
        if (f.kind === 'income') h += '<label class="field"><span>들어온 계좌</span><select class="input" name="to" data-live="hint">' + methodOptions(refVal(x.to) || refVal(x.from), false) + '</select></label>';
        if (f.kind === 'transfer') {
          h += '<label class="field"><span>보내는 계좌</span><select class="input" name="method">' + methodOptions(refVal(x.from), false) + '</select></label>' +
            '<label class="field"><span>받는 계좌</span><select class="input" name="to">' + methodOptions(refVal(x.to) || (S.accounts[1] ? 'account:' + S.accounts[1].id : ''), false) + '</select></label>';
        }
        h += '<div class="grid2"><label class="field"><span>날짜</span><input class="input" type="date" name="date" value="' + x.date + '" data-live="hint"></label><label class="field"><span>메모</span><input class="input" name="memo" value="' + esc(x.memo) + '" placeholder="가게 이름 등"></label></div>';
        if (existing) h += '<label class="switch"><span>완료됨<br><span class="hint">끄면 예정으로 남아요</span></span><input type="checkbox" name="done"' + (x.status === 'done' ? ' checked' : '') + '></label>';
        if (existing && existing.from && existing.from.type === 'card') h += '<label class="switch"><span>카드앱에 반영됨</span><input type="checkbox" name="reflected"' + (x.reflect === 'reflected' ? ' checked' : '') + '></label>';
        return h;
      },
      foot: () => '<div class="hint" id="recHint" style="text-align:center"></div><button class="btn" data-act="saveRecord">저장</button>' + (existing ? '<button class="btn danger" data-act="deleteTxn" data-id="' + existing.id + '">기록 삭제</button>' : ''),
      mount: () => recHint(),
    });
    sheet.rec = { x, f, existing };
  }
  function recHint() {
    const el = document.getElementById('recHint'); if (!el || !sheet || !sheet.rec) return;
    const f = sheet.rec.f; const amt = parseAmt(val('amt'));
    const d = val('date') || today();
    const future = d > today();
    let t = '';
    if (f.kind === 'expense') {
      const r = refOf(val('method'));
      if (r && r.type === 'card') { const c = card(r.id); t = c.name + ' ' + pName(E.cardPayMonth(c, d)) + ' 결제 카드값에 더해져요'; }
      else if (r) t = (acct(r.id) || {}).name + (future ? ' 예정 지출로 남아요' : ' 잔액이 ' + won(amt) + '원 줄어요');
    } else if (f.kind === 'income') { const r = refOf(val('to')); if (r) t = (acct(r.id) || {}).name + (future ? ' 예정 수입으로 남아요' : ' 잔액이 ' + won(amt) + '원 늘어요') + (sheet.rec.f.cat === '급여' ? ' · 다음 주기 수입으로 집계' : ''); }
    else t = '내 계좌끼리 옮기는 거라 합계는 그대로예요';
    el.textContent = t;
  }
  function saveRecord() {
    const { x, f, existing } = sheet.rec;
    const amount = parseAmt(val('amt'));
    if (!amount) { toast('금액을 적어 주세요'); return; }
    const t = existing ? S.txns.find((y) => y.id === existing.id) : { id: uid(), recordedAt: now(), source: { manual: true } };
    t.kind = f.kind; t.amount = amount; t.date = val('date') || today(); t.memo = (val('memo') || '').trim();
    t.categoryId = f.kind === 'transfer' ? null : f.cat;
    t.salary = f.kind === 'income' && f.cat === '급여';
    if (f.kind === 'expense') { t.from = refOf(val('method')); t.to = null; }
    else if (f.kind === 'income') { t.to = refOf(val('to')); t.from = null; }
    else { t.from = refOf(val('method')); t.to = refOf(val('to')); if (refVal(t.from) === refVal(t.to)) { toast('보내는 계좌와 받는 계좌가 같아요'); return; } }
    if (existing) {
      t.status = val('done') ? 'done' : 'planned';
      if (t.from && t.from.type === 'card') t.reflect = val('reflected') ? 'reflected' : 'unreflected';
    } else t.status = t.date > today() ? 'planned' : 'done';
    if (t.from && t.from.type === 'card') {
      t.cardPayMonth = E.cardPayMonth(card(t.from.id), t.date);
      if (!t.reflect) t.reflect = 'unreflected';
    } else { delete t.cardPayMonth; delete t.reflect; }
    if (!existing) S.txns.push(t);
    if (f.kind === 'expense') { UI.last.category = f.cat; UI.last.method = refVal(t.from); }
    save(); closeSheet(); render();
    toast(existing ? '고쳤어요' : t.status === 'planned' ? '예정으로 저장했어요' : '저장했어요');
  }

  // ===== ⑤ 캡처 가져오기 (C1: iPhone 글자 인식 → 붙여넣기 → 확인 후 저장) =====
  // 앱별 규칙은 온이 쓰는 카드·은행앱 캡처를 받으면 추가. 지금은 공통 규칙: 날짜·금액·가맹점이 한 줄 또는 이웃 줄에 있음.
  function parseCapture(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const y = today().slice(0, 4);
    const out = [];
    let lastDate = null;
    const dateRe = /(?:(20\d{2})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})일?/;
    const amtRe = /(-?\d{1,3}(?:,\d{3})+|-?\d{3,})\s*원/;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const dm = l.match(dateRe);
      if (dm) lastDate = (dm[1] || y) + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[3]).padStart(2, '0');
      const am = l.match(amtRe);
      if (!am) continue;
      if (/합계|총|잔액|한도|결제\s*예정|청구/.test(l)) continue;
      let name = l.replace(amtRe, '').replace(dateRe, '').replace(/\d{1,2}:\d{2}/, '').replace(/[|·•]/g, ' ').trim();
      let unsure = false;
      if (!name && i > 0) { name = lines[i - 1].replace(dateRe, '').replace(/\d{1,2}:\d{2}/, '').trim(); unsure = true; }
      if (!lastDate) unsure = true;
      const amount = Math.abs(parseAmt(am[1]));
      const cancel = /취소|환불/.test(l);
      out.push({ date: lastDate || today(), amount, memo: name.slice(0, 30), raw: l, unsure, cancel });
    }
    return out;
  }
  function importSheet(text) {
    let rows = null;
    let method = UI.last.method || (S.cards[0] ? 'card:' + S.cards[0].id : S.accounts[0] ? 'account:' + S.accounts[0].id : '');
    openSheet({
      title: '캡처로 가져오기',
      body() {
        if (!rows) {
          return '<div class="hint">카드·은행앱 사용내역을 캡처한 뒤 사진에서 글자를 길게 눌러 <b>모두 선택 → 복사</b>하고 여기에 붙여넣어 주세요. 단축어를 쓰면 이 단계가 자동이에요.</div>' +
            '<textarea class="input" name="raw" placeholder="여기에 붙여넣기">' + esc(text || '') + '</textarea>';
        }
        if (!rows.length) return '<div class="empty">읽을 수 있는 금액을 못 찾았어요.<br>글자를 다시 복사해 주세요.</div>';
        return '<label class="field"><span>결제수단 (모두 같게)</span><select class="input" name="imethod">' + methodOptions(method, true) + '</select></label>' +
          '<div class="hint">중복 의심은 기본으로 꺼 두었어요. 확인 후 저장하세요.</div><div class="list-box">' + rows.map((r, i) =>
            '<label class="row"><input type="checkbox" data-live="pick" data-i="' + i + '"' + (r.pick ? ' checked' : '') + ' style="width:22px;height:22px;accent-color:var(--accent)"><div class="grow"><span class="t">' + esc(r.memo || '이름 없음') + '</span><span class="s">' + md(r.date) + (r.dup ? ' · <span class="badge warn">중복 의심</span>' : '') + (r.unsure ? ' · <span class="badge gray">확인 필요</span>' : '') + (r.cancel ? ' · <span class="badge gray">취소</span>' : '') + '</span></div><span class="amt">' + (r.cancel ? '+' : '−') + won(r.amount) + '</span></label>').join('') + '</div>';
      },
      foot: () => !rows ? '<button class="btn" data-act="importRead">읽기</button>' : '<button class="btn" data-act="importSave">' + rows.filter((r) => r.pick).length + '건 저장</button><button class="btn gray" data-act="importBack">다시 붙여넣기</button>',
    });
    sheet.imp = {
      read() { rows = parseCapture(val('raw') || '').map((r) => { r.dup = !!E.findDuplicate(S, r); r.pick = !r.dup && !r.cancel; return r; }); paintSheet(); },
      back() { rows = null; paintSheet(); },
      pick(i, on) { rows[i].pick = on; const b = document.querySelector('#sheet [data-act=importSave]'); if (b) b.textContent = rows.filter((r) => r.pick).length + '건 저장'; },
      save() {
        method = val('imethod'); const from = refOf(method); let n = 0;
        for (const r of rows.filter((x) => x.pick)) {
          const t = { id: uid(), kind: 'expense', amount: r.amount, date: r.date, memo: r.memo, categoryId: UI.last.category || '기타', from, status: r.date > today() ? 'planned' : 'done', recordedAt: now(), source: { manual: true }, import: { type: 'capture', raw: r.raw } };
          if (from.type === 'card') { t.cardPayMonth = E.cardPayMonth(card(from.id), r.date); t.reflect = 'unreflected'; }
          S.txns.push(t); n++;
        }
        UI.last.method = method; save(); closeSheet(); render(); toast(n + '건 가져왔어요');
      },
    };
  }

  // ===== ⑥ 흐름 (W3: 타임라인, 분류별은 버튼) =====
  function flowScreen() {
    const p = view.period; const f = E.flow(S, p);
    const isCur = p === curPeriod();
    const snap = S.closes.filter((c) => c.period === p && !c.reopenedAt).pop();
    const fore = isCur ? E.summary(S, today()).forecast : snap ? snap.summary.forecast : null;
    let h = periodBar();
    const pb = E.periodBalance(S, p);
    const short = pb.left < 0;
    h += '<button class="card" style="border:0;text-align:left;gap:6px;color:inherit' + (short ? ';background:var(--warn-bg)' : '') + '" data-act="toggle" data-k="pb"><span class="label-lg"' + (short ? ' style="color:var(--warn)"' : '') + '>이번 급여로 ' + (short ? '부족해요' : '버틸 수 있어요') + '</span>' +
      '<span class="mid-num"' + (short ? ' style="color:var(--warn)"' : '') + '>' + (short ? '−' : '+') + won(Math.abs(pb.left)) + '원</span>';
    if (UI.expanded.pb) h += '<div class="detail" style="margin:4px 0 0;width:100%"><div class="line"><span>이 주기 수입 (급여는 다음 주기로)</span><span class="in">+' + won(pb.parts.income) + '</span></div><div class="line"><span>카드대금</span><span>−' + won(pb.parts.card) + '</span></div><div class="line"><span>계좌에서 나가는 돈</span><span>−' + won(pb.parts.account) + '</span></div><div class="line"><span>대출 납입</span><span>−' + won(pb.parts.loan) + '</span></div>' + (pb.parts.other ? '<div class="line"><span>정산·합산 밖 이체</span><span>−' + won(pb.parts.other) + '</span></div>' : '') + '</div>';
    h += '</button>';
    h += '<div class="grid2"><div class="tile"><span class="label">수입</span><span class="v in">' + won(f.income) + '</span></div><div class="tile"><span class="label">실제 지출</span><span class="v">' + won(f.spent) + '</span></div>' +
      '<div class="tile"><span class="label">남은 예정 지출</span><span class="v">' + won(f.plannedSpend) + '</span></div><div class="tile"><span class="label">' + (snap ? '마감 시 예상잔액' : '예상잔액') + '</span><span class="v">' + (fore == null ? '–' : wonS(fore)) + '</span></div></div>';
    const fl = view.flowFilter;
    h += '<div class="chips">' + [['all', '전체'], ['planned', '예정'], ['done', '완료'], ['cat', '분류별']].map(([k, l]) => '<button class="chip' + (fl === k ? ' on' : '') + '" data-act="flowFilter" data-k="' + k + '">' + l + '</button>').join('') + '</div>';
    if (fl === 'cat') {
      const cats = Object.entries(f.byCategory).sort((a, b) => b[1] - a[1]);
      const max = cats.length ? cats[0][1] : 1;
      h += '<div class="card">' + (cats.map(([c, v]) => '<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;font-size:15px"><span>' + esc(c) + '</span><b>' + won(v) + '</b></div><div class="bar"><span style="width:' + (v / max * 100) + '%;background:var(--accent)"></span></div></div>').join('') || '<div class="empty">이 기간 지출이 없어요</div>') + '</div>';
      return h;
    }
    const items = f.items.filter((x) => fl === 'all' || x.status === fl);
    const fut = items.filter((x) => x.status === 'planned').sort((a, b) => (a.date < b.date ? -1 : 1));
    const past = items.filter((x) => x.status === 'done');
    const row = (x) => {
      const isT = x.kind === 'transfer';
      const plus = x.kind === 'income' || (x.kind === 'settle' && x.to);
      const label = isT ? refName(x.from) + ' → ' + refName(x.to) : (x.memo || x.categoryId || '기록');
      const sub = md(x.date) + (x.categoryId ? ' · ' + x.categoryId : '') + (isT ? '' : ' · ' + refName(x.from || x.to)) + (x.salary ? ' · 다음 주기 수입' : '');
      return '<button class="row" data-act="editTxn" data-id="' + x.id + '"><div class="grow"><span class="t">' + esc(label) + (x.carriedFrom ? ' <span class="badge gray">' + pName(x.carriedFrom) + '에서</span>' : '') + '</span><span class="s">' + esc(sub) + '</span></div>' +
        '<span class="amt' + (plus ? ' in' : isT ? ' muted' : '') + '">' + (isT ? '0 (내 계좌)' : (plus ? '+' : '−') + won(x.amount)) + (x.status === 'planned' ? ' <span class="badge gray">예정</span>' : '') + '</span></button>';
    };
    h += '<div class="card tight">';
    if (fut.length) h += '<div class="group-title">앞으로</div>' + fut.map(row).join('');
    if (past.length) h += '<div class="group-title">지난 기록</div>' + past.map(row).join('');
    if (!fut.length && !past.length) h += '<div class="empty">이 기간 기록이 없어요.<br>아래 + 버튼으로 기록해 보세요.</div>';
    h += '</div>';
    if (snap) h += '<div class="hint" style="text-align:center">' + pName(p) + '은 ' + new Date(snap.closedAt).toLocaleDateString('ko-KR') + '에 마감됐어요. 관리에서 해제할 수 있어요.</div>';
    return h;
  }

  // ===== ⑦ 장부 (W4: 위쪽 탭 4개) =====
  function ledgerScreen() {
    const p = view.period; const lt = view.ledgerTab;
    let h = periodBar();
    h += '<div class="tabs" role="tablist">' + [['account', '계좌'], ['card', '카드'], ['rule', '정기결제'], ['people', '사람']].map(([k, l]) => '<button role="tab" aria-selected="' + (lt === k) + '" class="' + (lt === k ? 'on' : '') + '" data-act="ledgerTab" data-t="' + k + '">' + l + '</button>').join('') + '</div>';
    if (lt === 'account') {
      h += '<div class="card tight" style="border-radius:0 0 22px 22px;margin-top:-10px">' + (S.accounts.map((a) => {
        const b = E.accountBalance(S, a.id);
        return '<div class="row"><span class="ico">' + acctIcon(a) + '</span><div class="grow" data-act="editAccount" data-id="' + a.id + '"><span class="t" style="font-weight:600">' + esc(a.name) + (!a.include ? ' <span class="badge gray">합산 제외</span>' : '') + '</span><span class="s">은행앱 확인 ' + ago(b.checkedAt) + (b.checkedAmount != null ? ' · ' + won(b.checkedAmount) + '원' : '') + '</span></div>' +
          '<span class="amt">' + (a.kind === 'overdraft' ? '<span class="s" style="display:block;text-align:right;font-weight:400">남은 한도</span>' + wonS(E.available(S, a, b.amount)) : wonS(b.amount)) + '원</span><button class="btn sm soft" data-act="balance" data-id="' + a.id + '">고치기</button></div>';
      }).join('') || '<div class="empty">계좌가 없어요</div>') + '</div><div class="grid2"><button class="btn gray" data-act="editAccount">계좌 추가</button><button class="btn gray" data-act="setupImport">캡처로 추가</button></div>';
      h += loansBlock();
    } else if (lt === 'card') {
      const end = E.periodRange(S, p).end;
      const bills = S.cards.map((c) => ({ c, b: E.cardBill(S, c.id, E.cardPayMonth(c, end)) }));
      h += '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 4px 0"><span class="label-lg">' + (bills[0] ? pName(bills[0].b.payMonth) : '') + '에 나갈 카드값</span><b style="font-size:17px">' + won(bills.reduce((a, x) => a + x.b.total, 0)) + '원</b></div>';
      for (const { c, b } of bills) {
        const tot = Math.max(1, b.total);
        h += '<div class="card"><div style="display:flex;align-items:center;gap:12px"><span class="ico blue">' + I.card + '</span><div class="grow" style="flex:1"><div style="font-weight:600;font-size:16px">' + esc(c.name) + '</div><div class="label">' + md(E.cardPayDate(c, b.payMonth)) + ' ' + esc((acct(c.accountId) || {}).name || '') + ' 출금' + (b.paid ? ' · 결제 완료' : '') + '</div></div>' +
          '<button class="icon-btn soft" data-act="editCard" data-id="' + c.id + '" aria-label="' + esc(c.name) + ' 편집">' + I.edit + '</button></div>' +
          '<div style="font-size:28px;font-weight:700;letter-spacing:-0.8px">' + won(b.total) + '원</div>' +
          '<div class="bar" role="img" aria-label="확인액 ' + won(b.confirmed) + '원, 확인 이후 ' + won(b.afterCheck) + '원, 예정 ' + won(b.pending) + '원"><span style="width:' + (b.confirmed / tot * 100) + '%;background:var(--accent)"></span><span style="width:' + (b.afterCheck / tot * 100) + '%;background:#7FA2F0"></span><span style="width:' + (b.pending / tot * 100) + '%;background:var(--warn-dot)"></span></div>' +
          '<div><div class="line-row" style="display:flex;align-items:center;gap:10px;min-height:34px;font-size:14px"><span class="legend" style="background:var(--accent)"></span><span style="flex:1">카드앱 확인액 <span class="muted">· ' + (b.confirmedAt ? ago(b.confirmedAt) : '확인 전') + '</span></span><b>' + won(b.confirmed) + '</b></div>' +
          '<div style="display:flex;align-items:center;gap:10px;min-height:34px;font-size:14px"><span class="legend" style="background:#7FA2F0"></span><span style="flex:1">확인 이후 사용</span><b>+' + won(b.afterCheck) + '</b></div>' +
          '<div style="display:flex;align-items:center;gap:10px;min-height:34px;font-size:14px"><span class="legend" style="background:var(--warn-dot)"></span><span style="flex:1">아직 카드앱에 안 보이는 예정</span><b>+' + won(b.pending) + '</b></div></div>' +
          '<button class="btn soft" style="min-height:46px;font-size:15px" data-act="cardCheck" data-id="' + c.id + '" data-m="' + b.payMonth + '">카드앱 확인액 입력</button></div>';
        if (b.afterCheckItems.length || b.pendingItems.length) {
          h += '<div class="card tight">' + (b.afterCheckItems.length ? '<div class="group-title">확인 이후 사용 · ' + b.afterCheckItems.length + '건</div>' + b.afterCheckItems.map((x) => txnRow(x)).join('') : '') +
            (b.pendingItems.length ? '<div class="group-title warn">아직 안 보이는 예정 · ' + b.pendingItems.length + '건</div>' + b.pendingItems.map((x) => txnRow(x, '<button class="btn sm soft" data-act="markReflect" data-id="' + x.id + '">반영됨</button>')).join('') : '') + '</div>';
        }
      }
      h += '<button class="btn gray" data-act="editCard">카드 추가</button>';
    } else if (lt === 'rule') {
      const ruleRow = (r) => {
        const t = S.txns.find((x) => x.id === 'r:' + r.id + ':' + p);
        const off = r.active === false || (r.end && p > r.end);
        return '<button class="row" data-act="editRule" data-id="' + r.id + '"' + (off ? ' style="opacity:.55"' : '') + '><div class="grow"><span class="t">' + esc(r.name) + (r.active === false ? ' <span class="badge gray">해지</span>' : r.end && p > r.end ? ' <span class="badge gray">' + pName(r.end) + '까지</span>' : r.end ? ' <span class="badge gray">' + pName(r.end) + '까지</span>' : '') + '</span><span class="s">' + r.day + '일' + (r.approx ? ' 전후' : '') + ' · ' + esc(refName(r.method || r.to)) + (t ? ' · ' + (t.status === 'done' ? '완료' : t.reflect === 'reflected' ? '반영됨' : '예정') : '') + (r.note ? ' · ' + esc(r.note) : '') + '</span></div><span class="amt' + (r.kind === 'income' ? ' in' : '') + '">' + (r.approx ? '약 ' : '') + (r.kind === 'income' ? '+' : '') + won(r.amount) + '</span><span class="chev">' + I.right + '</span></button>';
      };
      const on = (r) => r.active !== false && !(r.end && p > r.end);
      const groups = [['통장에서 나가는 고정비', S.recurring.filter((r) => r.kind !== 'income' && r.method && r.method.type === 'account')],
        ['카드로 청구되는 고정비', S.recurring.filter((r) => r.kind !== 'income' && r.method && r.method.type === 'card')],
        ['정기적으로 들어오는 돈', S.recurring.filter((r) => r.kind === 'income')]];
      const total = (xs) => won(xs.filter(on).reduce((a, r) => a + r.amount, 0));
      h += '<div class="card tight" style="border-radius:0 0 22px 22px;margin-top:-10px">' + (S.recurring.length ? groups.filter((g) => g[1].length).map(([t, xs]) =>
        '<div class="group-title" style="display:flex;justify-content:space-between"><span>' + t + '</span><span>' + total(xs) + '원</span></div>' + xs.sort((a, b) => a.day - b.day).map(ruleRow).join('')).join('') : '<div class="empty">정기결제가 없어요</div>') + '</div>';
      const fixed = S.recurring.filter((r) => r.kind !== 'income' && on(r));
      if (fixed.length) h += '<div class="sub" style="justify-content:space-between;padding:0 6px"><span>고정비 전체 (대출 납입 제외)</span><b style="color:var(--text)">' + won(fixed.reduce((a, r) => a + r.amount, 0)) + '원</b></div>';
      h += '<div class="card tight"><div class="group-title">할부</div>' + (S.installments.map((ins) => {
        const done = S.txns.filter((x) => x.source && x.source.installmentId === ins.id).length;
        const endM = E.addMonths(ins.startPayMonth, ins.months - 1);
        return '<button class="row" data-act="editInst" data-id="' + ins.id + '"><div class="grow"><span class="t">' + esc(ins.name) + '</span><span class="s">' + esc((card(ins.cardId) || {}).name || '') + ' · ' + ins.months + '개월 · ' + endM.slice(2, 4) + '년 ' + pName(endM) + ' 끝' + (ins.note ? ' · ' + esc(ins.note) : '') + '</span></div><span class="amt">' + won(ins.amount) + '/월</span><span class="chev">' + I.right + '</span></button>';
      }).join('') || '<div class="empty">할부가 없어요</div>') + '</div>';
      const trend = E.installmentTrend(S, E.addMonths(p, 0), 24);
      if (trend.length) {
        const mx = Math.max.apply(null, trend.map((r) => r.total));
        h += '<div class="card"><div class="label-lg">결제월별 할부 청구</div>' + trend.map((r) => '<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>' + r.month.slice(2, 4) + '년 ' + pName(r.month) + (r.total === mx ? ' <span class="badge warn">가장 많음</span>' : '') + '</span><b>' + won(r.total) + '</b></div><div class="bar"><span style="width:' + (r.total / mx * 100) + '%;background:var(--accent)"></span></div>' +
          (S.cards.length > 1 ? '<span class="s" style="font-size:12px;color:var(--text-3)">' + Object.entries(r.byCard).map(([c, v]) => esc((card(c) || {}).name || '') + ' ' + won(v)).join(' · ') + '</span>' : '') + '</div>').join('') + '</div>';
      }
      h += '<div class="grid2"><button class="btn gray" data-act="editRule">정기결제 추가</button><button class="btn gray" data-act="editInst">할부 추가</button></div>';
    } else {
      const recv = S.debts.filter((d) => d.dir === 'recv'), pay = S.debts.filter((d) => d.dir === 'pay');
      const tot = (xs) => won(xs.reduce((a, d) => a + E.debtStatus(S, d).remaining, 0));
      h += '<div class="card tight" style="border-radius:0 0 22px 22px;margin-top:-10px"><div class="group-title">받을 돈 · ' + tot(recv) + '원</div>' + (recv.map(debtRow).join('') || '<div class="empty">없어요</div>') +
        '<div class="group-title">갚을 돈 · ' + tot(pay) + '원</div>' + (pay.map(debtRow).join('') || '<div class="empty">없어요</div>') + '</div>' +
        '<div class="hint" style="padding:0 6px">같은 사람이어도 받을 돈과 갚을 돈은 따로 계산해요.</div><button class="btn gray" data-act="editDebt">받을·갚을 돈 추가</button>';
    }
    return h;
  }

  // ===== ⑧ 관리 =====
  function manageScreen() {
    const p = view.period; const cp = curPeriod();
    const prev = E.addMonths(cp, -1);
    const sync = syncLabel();
    let h = periodBar(E.isClosed(S, p) ? '' : '수정 가능');
    h += '<div class="group-title" style="padding-left:6px">이번 기간 입력</div><div class="card tight">' +
      '<button class="row" data-act="quick" data-tab="card"><div class="grow"><span class="t">카드앱 확인액</span></div><span class="s">' + S.cards.length + '개 카드</span><span class="chev">' + I.right + '</span></button>' +
      '<button class="row" data-act="addPlanned"><div class="grow"><span class="t">예정 입출금 추가</span><span class="s">날짜를 미래로 적으면 예정이 돼요</span></div><span class="chev">' + I.right + '</span></button>' +
      '<button class="row" data-act="ledgerTab" data-t="rule"><div class="grow"><span class="t">정기결제 이번 금액 확인</span></div><span class="s">자동 생성 ' + S.txns.filter((x) => x.source && x.source.ruleId && E.txnPeriod(S, x) === p).length + '건</span><span class="chev">' + I.right + '</span></button></div>';
    h += '<div class="group-title" style="padding-left:6px">항목 등록·편집</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      [['editAccount', '계좌'], ['editCard', '카드'], ['editRule', '정기결제'], ['editInst', '할부'], ['editDebt', '받을·갚을 돈'], ['editLoan', '대출'], ['setupImport', '캡처로 계좌·카드'], ['ledgerTab:account', '목록 보기']].map(([a, l]) => {
        const [act, t] = a.split(':');
        return '<button class="tile" style="align-items:center;justify-content:center;min-height:52px;font-size:14px" data-act="' + act + '"' + (t ? ' data-t="' + t + '"' : '') + '>' + l + (a.indexOf('edit') === 0 ? ' 추가' : '') + '</button>';
      }).join('') + '</div>';
    // 월마감 (D7)
    h += '<div class="group-title" style="padding-left:6px">월마감</div>';
    const closed = E.isClosed(S, prev);
    h += '<button class="banner" style="' + (closed ? 'background:var(--surface);color:var(--text)' : '') + '" data-act="closeFlow" data-p="' + prev + '"><span>' + pName(prev) + ' 급여주기 ' + (closed ? '마감됨' : '마감 전') + '</span><b>' + (closed ? '보기 ›' : '마감하기 ›') + '</b></button>';
    if (p !== prev && p < cp) h += '<button class="banner" style="background:var(--surface);color:var(--text)" data-act="closeFlow" data-p="' + p + '"><span>' + pName(p) + ' 급여주기 ' + (E.isClosed(S, p) ? '마감됨' : '마감 전') + '</span><b>열기 ›</b></button>';
    // 설정
    h += '<div class="group-title" style="padding-left:6px">설정</div><div class="card tight">' +
      '<button class="row" data-act="settingStart"><div class="grow"><span class="t">급여주기 시작일</span></div><span class="s">매월 ' + S.settings.cycleStartDay + '일</span><span class="chev">' + I.right + '</span></button>' +
      '<button class="row" data-act="settingInclude"><div class="grow"><span class="t">쓸 수 있는 돈 합산 계좌</span></div><span class="s">' + S.accounts.filter((a) => a.include).length + '개</span><span class="chev">' + I.right + '</span></button>' +
      (S.accounts.some((a) => a.kind === 'overdraft') ? '<button class="row" data-act="settingOverdraft"><div class="grow"><span class="t">마이너스통장 쓸 수 있는 돈</span></div><span class="s">' + (S.settings.overdraftMode === 'balance' ? '잔액 그대로' : '남은 한도') + '</span><span class="chev">' + I.right + '</span></button>' : '') +
      '<button class="row" data-act="syncOpen"><div class="grow"><span class="t">구글 드라이브 동기화</span></div><span class="s' + (sync.on ? ' in' : '') + '">' + esc(sync.text) + '</span><span class="chev">' + I.right + '</span></button>' +
      '<button class="row" data-act="backup"><div class="grow"><span class="t">백업 파일 내보내기·가져오기</span></div><span class="chev">' + I.right + '</span></button></div>';
    h += '<div class="hint" style="text-align:center;padding:8px">홈 화면에 추가해서 쓰면 Safari가 데이터를 지우지 않아요.<br>공유 버튼 → 홈 화면에 추가<br>버전 ' + APP_VERSION + '</div>';
    return h;
  }

  // ===== ⑨ 월마감 (P5 경고만, 이월 미리보기) =====
  function closeSheet9(p) {
    const r = E.periodRange(S, p);
    openSheet({
      title: pName(p) + ' 급여주기 마감',
      body() {
        const snap = S.closes.filter((c) => c.period === p && !c.reopenedAt).pop();
        if (snap) {
          const f = snap.flow;
          return '<div class="hint">' + md(r.start) + ' – ' + md(r.end) + ' · ' + new Date(snap.closedAt).toLocaleString('ko-KR') + ' 마감</div><div class="card" style="background:var(--surface-2)"><div class="grid2">' +
            '<div><div class="label">수입</div><b>' + won(f.income) + '</b></div><div><div class="label">지출</div><b>' + won(f.spent) + '</b></div><div><div class="label">마감 시 쓸 수 있는 돈</div><b>' + wonS(snap.summary.spendable) + '</b></div><div><div class="label">다음 주기로 이월</div><b>' + snap.carried.length + '건</b></div></div></div>' +
            '<div class="hint">마감 기록은 잠겨 있어 지금 설정을 바꿔도 그대로예요. 해제하면 이 기록은 이력으로 남고, 다시 마감하면 새로 만들어져요.</div>';
        }
        const warns = E.closeChecks(S, p, now());
        const pend = S.txns.filter((x) => x.status === 'planned' && E.txnPeriod(S, x) === p);
        const open = S.debts.filter((d) => E.debtStatus(S, d).remaining > 0);
        const f = E.flow(S, p);
        return '<div class="hint" style="text-align:center">' + md(r.start) + ' – ' + md(r.end) + '</div>' +
          '<div class="field"><span>1. 점검 · 그래도 마감할 수 있어요</span>' + (warns.length ? '<div class="list-box" style="background:var(--warn-bg)">' + warns.map((w) => '<div class="row" style="color:var(--warn)">' + esc(w.text) + (w.accountId ? '<button class="btn sm" style="margin-left:auto;background:transparent;color:var(--warn)" data-act="balance" data-id="' + w.accountId + '">확인 ›</button>' : '') + '</div>').join('') + '</div>' : '<div class="hint">모두 괜찮아요</div>') + '</div>' +
          '<div class="field"><span>2. 다음 주기로 이어지는 것</span><div class="list-box"><div class="row"><div class="grow"><span class="t">받을 돈·갚을 돈 (정산 전)</span></div><span class="amt">' + open.length + '건</span></div>' +
          '<div class="row"><div class="grow"><span class="t">완료 안 된 예정 → ' + pName(E.addMonths(p, 1)) + '로 이동</span></div><span class="amt">' + pend.length + '건 · ' + won(pend.reduce((a, x) => a + x.amount, 0)) + '</span></div></div><div class="hint">정기결제·할부는 새 주기가 시작될 때 이미 자동으로 생겨요. 복사하지 않고 같은 기록이 이어져요.</div></div>' +
          '<div class="field"><span>3. 마감 기록에 남는 숫자</span><div class="card" style="background:var(--surface-2)"><div class="grid2"><div><div class="label">수입</div><b>' + won(f.income) + '</b></div><div><div class="label">지출</div><b>' + won(f.spent) + '</b></div></div></div></div>';
      },
      foot() {
        const snap = S.closes.filter((c) => c.period === p && !c.reopenedAt).pop();
        return snap ? '<button class="btn gray" data-act="reopen" data-p="' + p + '">마감 해제</button>' : '<button class="btn" data-act="doClose" data-p="' + p + '">마감하고 잠그기</button><div class="hint" style="text-align:center">마감 후에도 해제하고 고칠 수 있어요</div>';
      },
    });
  }

  // ===== 항목 편집 시트들 =====
  function formSheet(title, fields, onSave, onDelete) {
    openSheet({
      title,
      body: () => fields.map((f) => {
        if (f.type === 'switch') return '<label class="switch"><span>' + esc(f.label) + (f.hint ? '<br><span class="hint">' + esc(f.hint) + '</span>' : '') + '</span><input type="checkbox" name="' + f.name + '"' + (f.value ? ' checked' : '') + '></label>';
        if (f.type === 'select') return '<label class="field"><span>' + esc(f.label) + '</span><select class="input" name="' + f.name + '">' + f.options.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(f.value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>';
        if (f.type === 'money') return '<label class="field"><span>' + esc(f.label) + '</span><input class="input" name="' + f.name + '" inputmode="numeric" data-live="money" value="' + (f.value != null && f.value !== '' ? won(f.value) : '') + '" placeholder="' + esc(f.ph || '0') + '"></label>';
        return '<label class="field"><span>' + esc(f.label) + '</span><input class="input" name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value == null ? '' : f.value) + '" placeholder="' + esc(f.ph || '') + '"' + (f.type === 'number' ? ' inputmode="numeric"' : '') + '></label>';
      }).join('') + (fields.note ? '<div class="hint">' + fields.note + '</div>' : ''),
      foot: () => '<button class="btn" data-act="formSave">저장</button>' + (onDelete ? '<button class="btn danger" data-act="formDelete">삭제</button>' : ''),
    });
    sheet.onSave = onSave; sheet.onDelete = onDelete;
  }
  const dayOpts = Array.from({ length: 31 }, (_, i) => [i + 1, (i + 1) + '일']);
  const acctOpts = () => S.accounts.map((a) => [a.id, a.name]);

  function editAccount(id) {
    const a = id ? acct(id) : null;
    const f = [
      { name: 'name', label: '별칭', value: a ? a.name : '', ph: '예: 국민 생활비' },
      { name: 'kind', label: '종류', type: 'select', value: a ? a.kind : 'bank', options: [['bank', '입출금'], ['cash', '현금'], ['local', '지역화폐'], ['overdraft', '마이너스통장']] },
      { name: 'include', label: '쓸 수 있는 돈에 합산', type: 'switch', value: a ? a.include : true, hint: '지역화폐는 꺼 두면 따로 보여요' },
      { name: 'limit', label: '마이너스통장 한도', type: 'money', value: a ? a.limit : '', ph: '마이너스통장일 때만' },
      { name: 'rate', label: '마이너스통장 금리 % (선택)', value: a && a.rate ? a.rate : '', ph: '예: 5.1' },
    ];
    if (!a) f.push({ name: 'bal', label: '지금 은행앱 잔액', type: 'money' });
    f.note = '계좌번호·실명은 적지 않아요. 별칭만 저장해요. 마이너스통장 잔액은 쓴 만큼 −로 적어요.';
    formSheet(a ? '계좌 편집' : '계좌 추가', f, () => {
      const name = val('name').trim(); if (!name) return toast('별칭을 적어 주세요');
      const x = a || { id: uid() };
      x.name = name; x.kind = val('kind'); x.include = val('include');
      if (x.kind === 'overdraft') { x.limit = parseAmt(val('limit')); x.rate = Number(String(val('rate')).replace(/[^0-9.]/g, '')) || null; } else { delete x.limit; delete x.rate; }
      if (!a) { S.accounts.push(x); S.balanceChecks.push({ id: uid(), accountId: x.id, amount: parseAmt(val('bal')), at: now() }); }
      return true;
    }, a ? () => {
      if (S.txns.some((t) => (t.from && t.from.id === a.id) || (t.to && t.to.id === a.id))) { toast('기록이 있는 계좌는 지울 수 없어요'); return false; }
      S.accounts = S.accounts.filter((y) => y.id !== a.id); return true;
    } : null);
  }
  function editCard(id) {
    const c = id ? card(id) : null;
    if (!S.accounts.length) return toast('출금 계좌를 먼저 추가해 주세요');
    formSheet(c ? '카드 편집' : '카드 추가', [
      { name: 'name', label: '별칭', value: c ? c.name : '', ph: '예: 삼성카드' },
      { name: 'payDay', label: '결제일', type: 'select', value: c ? c.payDay : 15, options: dayOpts },
      { name: 'payOffset', label: '사용기간', type: 'select', value: c ? (c.payOffset == null ? 1 : c.payOffset) : 1, options: [[1, '전월 1일~말일 사용분'], [2, '전전월 1일~말일 사용분'], [0, '당월 사용분']] },
      { name: 'accountId', label: '출금 계좌', type: 'select', value: c ? c.accountId : S.accounts[0].id, options: acctOpts() },
    ], () => {
      const name = val('name').trim(); if (!name) return toast('별칭을 적어 주세요');
      const x = c || { id: uid() };
      x.name = name; x.payDay = Number(val('payDay')); x.payOffset = Number(val('payOffset')); x.accountId = val('accountId');
      if (!c) S.cards.push(x);
      return true;
    }, c ? () => { if (S.txns.some((t) => t.from && t.from.id === c.id)) { toast('기록이 있는 카드는 지울 수 없어요'); return false; } S.cards = S.cards.filter((y) => y.id !== c.id); return true; } : null);
  }
  function editRule(id) {
    const r = id ? S.recurring.find((x) => x.id === id) : null;
    const methods = S.accounts.map((a) => ['account:' + a.id, a.name + ' (계좌)']).concat(S.cards.map((c) => ['card:' + c.id, c.name + ' (카드)']));
    if (!methods.length) return toast('계좌나 카드를 먼저 추가해 주세요');
    formSheet(r ? '정기결제 편집' : '정기결제 추가', [
      { name: 'name', label: '이름', value: r ? r.name : '', ph: '예: 월세, 멜론' },
      { name: 'kind', label: '종류', type: 'select', value: r ? r.kind || 'expense' : 'expense', options: [['expense', '나가는 돈'], ['income', '들어오는 돈 (급여 등)']] },
      { name: 'amount', label: '금액', type: 'money', value: r ? r.amount : '' },
      { name: 'day', label: '매월 날짜', type: 'select', value: r ? r.day : 25, options: dayOpts },
      { name: 'method', label: '결제수단 / 들어오는 계좌', type: 'select', value: r ? refVal(r.method || r.to) : methods[0][0], options: methods },
      { name: 'category', label: '분류', type: 'select', value: r ? r.categoryId || '' : '주거', options: S.categories.map((c) => [c, c]) },
      { name: 'approx', label: '금액·날짜가 조금씩 달라요', type: 'switch', value: r ? r.approx : false, hint: '"약 ○원", "○일 전후"로 보여요' },
      { name: 'end', label: '끝나는 달 (선택)', type: 'month', value: r ? r.end || '' : '' },
      { name: 'note', label: '메모 (선택)', value: r ? r.note || '' : '', ph: '예: 통신비 청구할인 포함' },
      { name: 'active', label: '사용 중', type: 'switch', value: r ? r.active !== false : true, hint: '끄면 해지로 표시돼요' },
    ], () => {
      const name = val('name').trim(); const amount = parseAmt(val('amount'));
      if (!name || !amount) return toast('이름과 금액을 적어 주세요');
      const x = r || { id: uid(), start: curPeriod() };
      const kind = val('kind'); const ref = refOf(val('method'));
      if (kind === 'income' && ref.type === 'card') return toast('들어오는 돈은 계좌를 골라 주세요');
      if (r && r.amount !== amount) { x.history = (x.history || []).concat([{ from: curPeriod(), amount }]); }
      x.name = name; x.kind = kind; x.amount = amount; x.day = Number(val('day')); x.categoryId = val('category'); x.active = val('active');
      x.approx = val('approx'); x.end = val('end') || null; x.note = val('note').trim();
      if (kind === 'income') { x.to = ref; x.method = null; x.salary = val('category') === '급여'; } else { x.method = ref; x.to = null; }
      if (!r) S.recurring.push(x);
      // 이번 주기 예정이 아직 남아 있으면 같이 고침
      const t = S.txns.find((y) => y.id === 'r:' + x.id + ':' + curPeriod());
      if (t && t.status === 'planned') { t.amount = amount; t.memo = name; t.approx = x.approx; }
      return true;
    }, r ? () => { S.recurring = S.recurring.filter((y) => y.id !== r.id); S.txns = S.txns.filter((t) => !(t.source && t.source.ruleId === r.id && t.status === 'planned')); return true; } : null);
  }
  function editInst(id) {
    const ins = id ? S.installments.find((x) => x.id === id) : null;
    if (!S.cards.length) return toast('카드를 먼저 추가해 주세요');
    formSheet(ins ? '할부 편집' : '할부 추가', [
      { name: 'name', label: '이름', value: ins ? ins.name : '', ph: '예: 노트북' },
      { name: 'cardId', label: '카드', type: 'select', value: ins ? ins.cardId : S.cards[0].id, options: S.cards.map((c) => [c.id, c.name]) },
      { name: 'start', label: '첫 결제월', type: 'month', value: ins ? ins.startPayMonth : E.addMonths(curPeriod(), 1) },
      { name: 'months', label: '개월 수', type: 'number', value: ins ? ins.months : 3 },
      { name: 'amount', label: '한 달 금액', type: 'money', value: ins ? ins.amount : '' },
      { name: 'note', label: '메모 (선택)', value: ins ? ins.note || '' : '' },
    ], () => {
      const name = val('name').trim(); const amount = parseAmt(val('amount')); const months = Number(val('months'));
      if (!name || !amount || !months || !val('start')) return toast('모든 칸을 채워 주세요');
      const x = ins || { id: uid() };
      x.name = name; x.cardId = val('cardId'); x.startPayMonth = val('start'); x.months = months; x.amount = amount; x.note = val('note').trim();
      if (!ins) S.installments.push(x);
      S.txns.filter((t) => t.source && t.source.installmentId === x.id && t.reflect !== 'reflected').forEach((t) => { t.amount = amount; });
      return true;
    }, ins ? () => { S.installments = S.installments.filter((y) => y.id !== ins.id); S.txns = S.txns.filter((t) => !(t.source && t.source.installmentId === ins.id && t.reflect !== 'reflected')); return true; } : null);
  }
  function editDebt(id) {
    const d = id ? S.debts.find((x) => x.id === id) : null;
    const p = d ? person(d.personId) : null;
    formSheet(d ? '받을·갚을 돈 편집' : '받을·갚을 돈 추가', [
      { name: 'dir', label: '방향', type: 'select', value: d ? d.dir : 'recv', options: [['recv', '받을 돈'], ['pay', '갚을 돈']] },
      { name: 'person', label: '사람', value: p ? p.name : '', ph: '별칭' },
      { name: 'reason', label: '사유', value: d ? d.reason : '', ph: '예: 저녁 더치페이' },
      { name: 'principal', label: '금액', type: 'money', value: d ? d.principal : '' },
      { name: 'due', label: '예정일 (선택)', type: 'date', value: d ? d.dueDate || '' : '' },
      { name: 'inc', label: '예상잔액에 넣기', type: 'switch', value: d ? d.includeInForecast : false, hint: '예정일이 있을 때만 들어가요' },
    ], () => {
      const pn = val('person').trim(); const amt = parseAmt(val('principal'));
      if (!pn || !amt) return toast('사람과 금액을 적어 주세요');
      let pp = S.people.find((x) => x.name === pn); if (!pp) { pp = { id: uid(), name: pn }; S.people.push(pp); }
      const x = d || { id: uid() };
      x.dir = val('dir'); x.personId = pp.id; x.reason = val('reason').trim(); x.principal = amt; x.dueDate = val('due') || null; x.includeInForecast = val('inc');
      if (!d) S.debts.push(x);
      return true;
    }, d ? () => { if (E.debtStatus(S, d).settled > 0) { toast('정산 기록이 있어 지울 수 없어요'); return false; } S.debts = S.debts.filter((y) => y.id !== d.id); return true; } : null);
  }
  function debtSheet(id) {
    const d = S.debts.find((x) => x.id === id); const st = E.debtStatus(S, d); const p = person(d.personId);
    const hist = S.txns.filter((t) => t.kind === 'settle' && t.debtId === d.id);
    openSheet({
      title: (p ? p.name : '') + ' · ' + (d.dir === 'recv' ? '받을 돈' : '갚을 돈'),
      headRight: () => '<button class="icon-btn" data-act="editDebt" data-id="' + d.id + '" aria-label="편집">' + I.edit + '</button>',
      body: () => '<div class="detail" style="margin:0"><div class="line"><span>원금</span><span>' + won(d.principal) + '</span></div><div class="line"><span>정산됨</span><span>' + won(st.settled) + '</span></div><div class="line"><span>남은 금액 · ' + st.state + '</span><b>' + won(st.remaining) + '</b></div>' + (st.extra ? '<div class="line"><span>예정보다 더 ' + (d.dir === 'recv' ? '받은' : '갚은') + ' 금액</span><span>' + won(st.extra) + '</span></div>' : '') + '</div><div class="hint">예정과 실제 금액이 달라도 실제 들어온(나간) 금액을 그대로 적어 주세요.</div>' +
        (st.remaining > 0 ? '<label class="field"><span>' + (d.dir === 'recv' ? '이번에 받은 금액' : '이번에 갚은 금액') + '</span><input class="input" name="amt" inputmode="numeric" data-live="money" value="' + won(st.remaining) + '"></label>' +
        '<label class="field"><span>' + (d.dir === 'recv' ? '들어온 계좌' : '나간 계좌') + '</span><select class="input" name="acc">' + methodOptions('', false) + '</select></label>' : '') +
        (hist.length ? '<div class="list-box">' + hist.map((t) => txnRow(t)).join('') + '</div>' : ''),
      foot: () => st.remaining > 0 ? '<button class="btn" data-act="settle" data-id="' + d.id + '">정산 기록</button>' : '<div class="hint" style="text-align:center">정산이 끝났어요</div>',
    });
  }

  // ===== 대출 묶음 (장부 계좌 탭 안) =====
  function loansBlock() {
    const L = E.loanSummary(S);
    if (!L.loans.length && !L.overdrafts.length) return '<button class="btn gray" data-act="editLoan">대출 추가</button>';
    let h = '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 4px 0"><span class="label-lg">대출·마이너스통장</span><b style="font-size:17px">' + won(L.total) + '원</b></div>';
    h += '<div class="card tight">';
    if (L.overdrafts.length) h += '<div class="group-title">마이너스통장 사용액</div>' + L.overdrafts.map((o) =>
      '<button class="row" data-act="editAccount" data-id="' + o.account.id + '"><div class="grow"><span class="t">' + esc(o.account.name) + '</span><span class="s">한도 ' + won(o.account.limit || 0) + ' · 남은 한도 ' + wonS(o.left) + (o.account.rate ? ' · ' + o.account.rate + '%' : '') + '</span></div><span class="amt">' + won(o.used) + '</span><span class="chev">' + I.right + '</span></button>').join('');
    if (L.loans.length) h += '<div class="group-title">대출</div>' + L.loans.map((l) =>
      '<button class="row" data-act="editLoan" data-id="' + l.id + '"' + (l.active === false ? ' style="opacity:.55"' : '') + '><div class="grow"><span class="t">' + esc(l.name) + (l.familyPayer ? ' <span class="badge">' + esc(l.familyPayer) + ' 대납</span>' : '') + (l.active === false ? ' <span class="badge gray">끝남</span>' : '') + '</span><span class="s">' + [l.bank, l.rate ? l.rate + '%' : '', l.monthly ? '월 ' + (l.approx ? '약 ' : '') + won(l.monthly) + (l.payDay ? ' · ' + l.payDay + '일' : '') : '', l.note].filter(Boolean).map(esc).join(' · ') + '</span></div><span class="amt">' + won(l.balance || 0) + '</span><span class="chev">' + I.right + '</span></button>').join('');
    h += '</div>';
    if (L.monthlySelf || L.monthlyFamily) h += '<div class="detail" style="margin:0"><div class="line"><span>매달 내 돈으로 내는 납입</span><b>' + won(L.monthlySelf) + '원</b></div>' + (L.monthlyFamily ? '<div class="line"><span>가족이 보내 주는 납입 (대납금)</span><span>' + won(L.monthlyFamily) + '원</span></div>' : '') + '</div>';
    if (L.byRate.length > 1) h += '<div class="card tight"><div class="group-title">먼저 갚으면 좋은 순서 (금리 높은 순)</div>' + L.byRate.map((x, i) => '<div class="row"><div class="grow"><span class="t">' + (i + 1) + '. ' + esc(x.name) + '</span></div><span class="s">' + x.rate + '%</span><span class="amt">' + won(x.balance || 0) + '</span></div>').join('') + '</div>';
    h += '<button class="btn gray" data-act="editLoan">대출 추가</button>';
    return h;
  }
  function editLoan(id) {
    const l = id ? (S.loans || []).find((x) => x.id === id) : null;
    if (!S.accounts.length) return toast('납입 계좌를 먼저 추가해 주세요');
    const f = [
      { name: 'name', label: '이름', value: l ? l.name : '', ph: '예: 전세대출' },
      { name: 'bank', label: '은행 (선택)', value: l ? l.bank || '' : '' },
      { name: 'balance', label: '남은 원금', type: 'money', value: l ? l.balance : '' },
      { name: 'rate', label: '금리 % (선택)', value: l && l.rate ? l.rate : '', ph: '예: 4.2' },
      { name: 'monthly', label: '월 납입액', type: 'money', value: l ? l.monthly : '' },
      { name: 'approx', label: '납입액이 매달 조금씩 달라요', type: 'switch', value: l ? l.approx : false, hint: '금액 앞에 "약"으로 보여요' },
      { name: 'payDay', label: '납입일', type: 'select', value: l ? l.payDay : 25, options: dayOpts },
      { name: 'payFrom', label: '납입 계좌', type: 'select', value: l ? l.payFrom : S.accounts[0].id, options: acctOpts() },
      { name: 'familyPayer', label: '납입금을 보내 주는 사람 (선택)', value: l ? l.familyPayer || '' : '', ph: '예: 엄마' },
      { name: 'note', label: '메모 (선택)', value: l ? l.note || '' : '', ph: '예: 내년 3월 금리 변동' },
      { name: 'active', label: '갚는 중', type: 'switch', value: l ? l.active !== false : true },
    ];
    f.note = '월 납입은 급여주기마다 납입 계좌의 예정 출금으로 생겨요. 보내 주는 사람을 적으면 같은 날 대납금이 들어올 예정으로 함께 생겨요.';
    formSheet(l ? '대출 편집' : '대출 추가', f, () => {
      const name = val('name').trim(); if (!name) return toast('이름을 적어 주세요');
      const x = l || { id: uid() };
      x.name = name; x.bank = val('bank').trim(); x.balance = parseAmt(val('balance')); x.rate = Number(String(val('rate')).replace(/[^0-9.]/g, '')) || null;
      x.monthly = parseAmt(val('monthly')); x.approx = val('approx'); x.payDay = Number(val('payDay')); x.payFrom = val('payFrom');
      x.familyPayer = val('familyPayer').trim() || null; x.note = val('note').trim(); x.active = val('active');
      if (!S.loans) S.loans = [];
      if (!l) {
        // 이번 주기 납입일이 이미 지났으면 다음 주기부터 예정 생성 (이미 낸 돈은 잔액에 들어 있음)
        const cp = curPeriod(); const pd = x.payDay >= S.settings.cycleStartDay ? E.addMonths(cp, -1) : cp;
        x.start = pd + '-' + String(x.payDay).padStart(2, '0') < today() ? E.addMonths(cp, 1) : cp;
        S.loans.push(x);
      }
      // 이번 주기 예정이 남아 있으면 같이 고침
      ['l:', 'lf:'].forEach((k) => { const t = S.txns.find((y) => y.id === k + x.id + ':' + curPeriod()); if (t && t.status === 'planned') { t.amount = x.monthly; t.approx = x.approx; } });
      E.ensurePeriod(S, curPeriod(), now());
      return true;
    }, l ? () => { S.loans = S.loans.filter((y) => y.id !== l.id); S.txns = S.txns.filter((t) => !(t.source && t.source.loanId === l.id && t.status === 'planned')); return true; } : null);
  }

  // ===== 처음 설정·계좌 추가를 캡처로 (은행앱 전체 계좌·카드앱 화면) =====
  // 이름 줄과 금액 줄을 짝지음. "한도"가 붙은 금액은 바로 앞 마이너스통장의 한도로.
  // 두 모양을 다 읽음: ① 이름 줄 다음 금액 줄 (은행앱) ② 금액 줄 다음 이름 줄 (토스 내 계좌)
  // 금액만 있는 줄이 이어서 나오면 그 앞 것은 합계로 보고 버림. "합계에 포함되지 않아요" 아래는 기본으로 빼기.
  const BANKS = ['국민', '토스', '신한', '하나', '우리', '농협', '카카오'];
  function bankOf(n) {
    if (/카드/.test(n)) return null;
    return /KB|국민/i.test(n) ? '국민' : /토스/.test(n) ? '토스' : /신한|쏠편한|쓸편한/.test(n) ? '신한' : /하나/.test(n) ? '하나' : /우리/.test(n) ? '우리' : /NH|농협/i.test(n) ? '농협' : /카카오/.test(n) ? '카카오' : null;
  }
  function parseSetup(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const amtRe = /([-−]?\s?\d{1,3}(?:,\d{3})+|[-−]?\s?\d+)\s*원|([-−]?\d{1,3}(?:,\d{3})+)/;
    const acctNoRe = /\d{2,6}-\d{2,6}(-\d{1,8})*/g;
    const noise = /송금|보내기|가져오기|불러오기|더보기|이체|개설|편집|둘러보기|찾는다면|혜택|추천|이벤트|광고|^내 계좌$|^입출금$|^저축$|^투자$|^대출$|^기타/;
    const clean = (l) => l.replace(acctNoRe, '').replace(/\*+/g, '').replace(/[·•|]\s*주계좌|주계좌/g, '').replace(/잔액|출금가능(금액)?|결제\s*예정(금액)?|이번\s*달|청구(금액)?|이용(금액)?/g, '').replace(/[|·•:]/g, ' ').replace(/\s+/g, ' ').trim();
    const isName = (l) => { const b = clean(l); return !!b && !amtRe.test(l) && !/^[\d\s.:\-]+$/.test(b) && !noise.test(b); };
    const out = []; let pend = ''; let excl = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const am = l.match(amtRe);
      if (!am) {
        if (/합계에\s*포함되지|합산\s*제외|숨긴/.test(l)) excl = true;
        pend = isName(l) ? clean(l) : (noise.test(clean(l)) ? '' : pend);
        continue;
      }
      if (/총|합계|자산|순자산|전체/.test(l)) { pend = ''; continue; }
      const amount = parseAmt((am[1] || am[2]).replace('−', '-').replace(/\s/g, ''));
      if (/한도/.test(l)) { const prev = out[out.length - 1]; if (prev) { prev.limit = Math.abs(amount); prev.kind = prev.kind === 'card' ? 'card' : 'overdraft'; } continue; }
      let name = clean(l.replace(amtRe, ''));
      if (!name && pend) name = pend;
      else if (!name && lines[i + 1] && isName(lines[i + 1])) { name = clean(lines[i + 1]); i++; }
      pend = '';
      if (!name) continue; // 이름 없는 금액 = 묶음 합계
      const kind = excl ? 'skip' : /카드/.test(name) ? 'card' : /마이너스|마통|한도대출/.test(name) || amount < 0 ? 'overdraft' : /지역화폐|지역사랑|상품권|동백|온누리|페이머니/.test(name) ? 'local' : 'bank';
      out.push({ name: name.slice(0, 20), amount, kind, limit: null, payDay: 15 });
    }
    // 이름은 은행 이름만 (온 요청). 상품명으로 은행을 알 수 있으면 바꾸고, 모르면 확인 화면에서 고름
    out.forEach((r) => { const bk = bankOf(r.name); if (bk) r.name = bk + (/서브/.test(r.name) ? ' 서브' : ''); else r.pickBank = r.kind !== 'card'; });
    // 같은 이름은 번호를 붙여 구분
    const seen = {};
    out.forEach((r) => { seen[r.name] = (seen[r.name] || 0) + 1; if (seen[r.name] > 1) r.name += ' ' + seen[r.name]; });
    return out;
  }
  function setupSheet(onDone) {
    let rows = null;
    const kinds = [['bank', '입출금'], ['overdraft', '마이너스통장'], ['local', '지역화폐'], ['cash', '현금'], ['card', '신용카드'], ['skip', '빼기']];
    const sync = () => { if (!rows) return; rows.forEach((r, i) => { const g = (n) => document.querySelector('#sheet [name="' + n + i + '"]'); if (g('n')) r.name = g('n').value.trim(); if (g('a')) r.amount = parseAmt(g('a').value); if (g('l')) r.limit = parseAmt(g('l').value); if (g('d')) r.payDay = Number(g('d').value); }); };
    openSheet({
      title: '캡처로 계좌·카드 추가',
      body() {
        if (!rows) return '<div class="hint">은행앱 <b>전체 계좌</b> 화면과 카드앱 <b>결제 예정 금액</b> 화면을 캡처한 뒤, 사진에서 글자를 길게 눌러 <b>모두 선택 → 복사</b>하고 붙여넣어 주세요. 여러 장이면 이어서 붙여넣으면 돼요.</div>' +
          '<textarea class="input" name="raw" placeholder="여기에 붙여넣기"></textarea><div class="hint">계좌번호는 저장하지 않아요. 이름과 금액만 읽어요.</div>';
        if (!rows.length) return '<div class="empty">이름과 금액을 못 찾았어요.<br>글자를 다시 복사해 주세요.</div>';
        return '<div class="hint">줄마다 이름과 종류를 확인해 주세요. 금액이 −인 통장은 마이너스통장으로 골라 두었어요. 한도를 적으면 남은 한도가 쓸 수 있는 돈이 돼요. 은행을 못 알아본 통장은 아래 은행 버튼을 눌러 주세요.</div>' + rows.map((r, i) =>
          '<div class="card" style="background:var(--surface-2);gap:8px;padding:12px"><input class="input" name="n' + i + '" value="' + esc(r.name) + '">' +
          (r.pickBank ? '<div class="chips" style="flex-wrap:wrap">' + BANKS.map((bk) => '<button class="chip' + (r.name === bk ? ' on' : '') + '" data-act="setupBank" data-i="' + i + '" data-b="' + bk + '">' + bk + '</button>').join('') + '</div>' : '') +
          '<div class="grid2"><select class="input" data-live="setupKind" data-i="' + i + '">' + kinds.map(([v, l]) => '<option value="' + v + '"' + (r.kind === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
          (r.kind === 'skip' ? '' : '<input class="input" name="a' + i + '" inputmode="numeric" data-live="money" value="' + won(r.amount) + '">') + '</div>' +
          (r.kind === 'overdraft' ? '<label class="field"><span>한도' + (r.limit ? '' : ' <span class="badge warn">적어 주세요</span>') + '</span><input class="input" name="l' + i + '" inputmode="numeric" data-live="money" value="' + (r.limit ? won(r.limit) : '') + '" placeholder="예: 30,000,000"></label>' : '') +
          (r.kind === 'card' ? '<select class="input" name="d' + i + '">' + dayOpts.map(([v, l]) => '<option value="' + v + '"' + (v === r.payDay ? ' selected' : '') + '>결제일 ' + l + '</option>').join('') + '</select>' : '') + '</div>').join('');
      },
      foot: () => !rows ? '<button class="btn" data-act="setupRead">읽기</button>' : rows.length ? '<button class="btn" data-act="setupSave">' + rows.filter((r) => r.kind !== 'skip').length + '개 추가</button><button class="btn gray" data-act="setupBack">다시 붙여넣기</button>' : '<button class="btn gray" data-act="setupBack">다시 붙여넣기</button>',
    });
    sheet.setup = {
      read() { rows = parseSetup(val('raw') || ''); rows.forEach((r) => { if (S.accounts.some((a) => a.name === r.name) || S.cards.some((c) => c.name === r.name)) r.kind = 'skip'; }); paintSheet(); },
      back() { rows = null; paintSheet(); },
      kind(i, k) { sync(); rows[i].kind = k; paintSheet(); },
      bank(i, bk) { sync(); rows[i].name = bk; paintSheet(); },
      save() {
        sync();
        const use = rows.filter((r) => r.kind !== 'skip' && r.name);
        const accs = use.filter((r) => r.kind !== 'card'); const cards = use.filter((r) => r.kind === 'card');
        if (cards.length && !accs.length && !S.accounts.length) return toast('카드값이 나갈 계좌도 하나 넣어 주세요');
        const t = now();
        for (const r of accs) {
          const a = { id: uid(), name: r.name, kind: r.kind, include: r.kind !== 'local' };
          if (r.kind === 'overdraft') a.limit = r.limit || 0;
          S.accounts.push(a); S.balanceChecks.push({ id: uid(), accountId: a.id, amount: r.amount, at: t });
        }
        const payAcc = (S.accounts.find((a) => a.kind === 'bank') || S.accounts[0]).id;
        for (const r of cards) {
          const c = { id: uid(), name: r.name, payDay: r.payDay, payOffset: 1, accountId: payAcc };
          S.cards.push(c);
          let m = today().slice(0, 7); if (E.cardPayDate(c, m) < today()) m = E.addMonths(m, 1);
          if (r.amount) S.cardChecks.push({ id: uid(), cardId: c.id, payMonth: m, amount: Math.abs(r.amount), at: t });
        }
        closeSheet();
        if (onDone) onDone(accs.length, cards.length); else { save(); render(); toast('계좌 ' + accs.length + '개 · 카드 ' + cards.length + '개 추가했어요'); }
      },
    };
  }

  // ===== 처음 시작 (P6 단계별 안내) =====
  let ob = { step: 0, start: 25, acct: '', bal: '', card: '', payDay: 15 };
  function onboarding() {
    const steps = '<div class="steps">' + [0, 1, 2].map((i) => '<span class="' + (i <= ob.step ? 'on' : '') + '"></span>').join('') + '</div>';
    let b = '';
    if (ob.step === 0) b = '<h1 style="font-size:26px;margin:0">급여주기 시작일</h1><div class="hint" style="font-size:15px">월급이 들어오는 날이 시작일이에요. 예를 들어 25일이면 10월 급여주기는 9/25 ~ 10/24예요.</div>' +
      '<select class="input" id="obStart">' + dayOpts.slice(0, 28).map(([v, l]) => '<option value="' + v + '"' + (v === ob.start ? ' selected' : '') + '>매월 ' + l + '</option>').join('') + '</select>';
    if (ob.step === 1) b = '<h1 style="font-size:26px;margin:0">주로 쓰는 계좌</h1><div class="hint" style="font-size:15px">별칭과 은행앱에 지금 보이는 잔액을 적어 주세요. 나머지 계좌는 나중에 관리에서 추가해요.</div>' +
      '<button class="btn soft" data-act="obCapture">' + I.scan + ' 은행앱·카드앱 캡처로 한 번에</button><div class="hint" style="text-align:center">또는 하나만 직접 적기</div>' +
      '<input class="input" id="obAcct" placeholder="예: 국민 생활비" value="' + esc(ob.acct) + '"><input class="input" id="obBal" inputmode="numeric" data-live="money" placeholder="잔액 0원" value="' + esc(ob.bal) + '">';
    if (ob.step === 2) b = '<h1 style="font-size:26px;margin:0">신용카드 (선택)</h1><div class="hint" style="font-size:15px">신용카드가 있으면 별칭과 결제일을 적어 주세요. 체크카드는 계좌로 기록하니 안 적어도 돼요.</div>' +
      '<input class="input" id="obCard" placeholder="예: 삼성카드" value="' + esc(ob.card) + '"><select class="input" id="obPay">' + dayOpts.map(([v, l]) => '<option value="' + v + '"' + (v === ob.payDay ? ' selected' : '') + '>결제일 ' + l + '</option>').join('') + '</select>';
    return '<main class="screen" style="padding-bottom:40px;min-height:100vh"><div style="padding-top:30px">' + steps + '</div><div style="display:flex;flex-direction:column;gap:16px;padding:30px 4px;flex:1">' + b + '</div>' +
      '<button class="btn" data-act="obNext">' + (ob.step === 2 ? (ob.card ? '시작하기' : '카드 없이 시작하기') : '다음') + '</button>' +
      (ob.step === 0 ? '<button class="btn gray" data-act="backup">백업 파일로 시작</button>' : '<button class="btn gray" data-act="obBack">이전</button>') + '</main>';
  }
  function obNext() {
    if (ob.step === 0) ob.start = Number(document.getElementById('obStart').value);
    if (ob.step === 1) {
      ob.acct = document.getElementById('obAcct').value.trim(); ob.bal = document.getElementById('obBal').value;
      if (!ob.acct) return toast('계좌 별칭을 적어 주세요');
    }
    if (ob.step === 2) {
      ob.card = document.getElementById('obCard').value.trim(); ob.payDay = Number(document.getElementById('obPay').value);
      S.settings.cycleStartDay = ob.start;
      const a = { id: uid(), name: ob.acct, kind: 'bank', include: true };
      S.accounts.push(a); S.balanceChecks.push({ id: uid(), accountId: a.id, amount: parseAmt(ob.bal), at: now() });
      if (ob.card) S.cards.push({ id: uid(), name: ob.card, payDay: ob.payDay, payOffset: 1, accountId: a.id });
      S.onboarded = true; save(); view.tab = 'home'; render(); toast('준비됐어요. + 버튼으로 기록해 보세요');
      return;
    }
    ob.step++; render();
  }

  // ===== 백업 (비상용) =====
  function backupSheet() {
    openSheet({
      title: '백업',
      body: () => '<div class="hint">모든 기록을 파일 하나로 내보내요. 다른 기기에서 가져오면 그대로 이어서 쓸 수 있어요. 가져오면 지금 데이터는 바뀌어요.</div>' +
        '<input type="file" accept="application/json,.json" id="importFile" hidden>',
      foot: () => '<button class="btn" data-act="exportJSON">파일로 내보내기</button><button class="btn gray" data-act="importJSON">파일 가져오기</button>',
      mount(sh) {
        sh.querySelector('#importFile').addEventListener('change', (e) => {
          const file = e.target.files[0]; if (!file) return;
          file.text().then((txt) => {
            const data = JSON.parse(txt);
            if (!data || !data.version || !Array.isArray(data.txns)) throw new Error('bad');
            if (!confirm('지금 데이터를 백업 파일 내용으로 바꿀까요?')) return;
            S = data; S.onboarded = true; save(); closeSheet(); view.tab = 'home'; render(); toast('가져왔어요');
          }).catch(() => toast('이 파일은 읽을 수 없어요'));
        });
      },
    });
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'money-backup-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- 동작 ----------
  const A = {
    closeSheet,
    quick: (d) => quickSheet(d.tab),
    qtab: (d) => sheet.setTab(d.t),
    toggle: (d) => { UI.expanded[d.k] = !UI.expanded[d.k]; render(); },
    balance: (d) => balanceSheet(d.id),
    saveBalance(d) {
      const amt = parseAmt(val('amt'));
      const gap = E.balanceGap(S, d.id, amt);
      S.balanceChecks.push({ id: uid(), accountId: d.id, amount: amt, at: now() });
      save(); closeSheet(); render();
      toast(gap === 0 ? '기록과 잔액이 딱 맞아요' : '기준점을 맞췄어요 · 기록 안 된 금액 ' + (gap > 0 ? '+' : '−') + won(Math.abs(gap)) + '원');
    },
    cardCheck: (d) => cardCheckSheet(d.id, d.m),
    saveCardCheck(d) {
      const amt = parseAmt(val('amt'));
      S.cardChecks.push({ id: uid(), cardId: d.id, payMonth: d.m, amount: amt, at: now() });
      save(); render();
      if (cardItemsFor(d.id, d.m).length) sheet.next(); else { closeSheet(); toast('확인액을 저장했어요'); }
    },
    toggleReflect(d) { const t = S.txns.find((x) => x.id === d.id); t.reflect = t.reflect === 'reflected' ? 'unreflected' : 'reflected'; save(); paintSheet(); render(); },
    markReflect(d) {
      const t = S.txns.find((x) => x.id === d.id); t.reflect = 'reflected'; save(); render(); if (sheet) paintSheet();
      toast('반영됨으로 바꿨어요 · 카드앱 확인액도 새로 적어 주세요');
    },
    markDone(d) { const t = S.txns.find((x) => x.id === d.id); t.status = 'done'; t.recordedAt = now(); t.date = t.date > today() ? today() : t.date; save(); render(); paintSheet(); toast('완료했어요'); },
    addRecord: () => (S.accounts.length ? recordSheet() : toast('계좌를 먼저 추가해 주세요')),
    addPlanned: () => recordSheet(null, { date: E.addDays(today(), 1) }),
    editTxn(d) { const t = S.txns.find((x) => x.id === d.id); if (t) recordSheet(t); },
    recKind(d) { sheet.rec.x.amount = parseAmt(val('amt')); sheet.rec.x.memo = val('memo'); sheet.rec.x.date = val('date'); sheet.rec.f.kind = d.k; if (d.k === 'income') sheet.rec.f.cat = '급여'; else if (sheet.rec.f.cat === '급여') sheet.rec.f.cat = UI.last.category || '식비'; paintSheet(); },
    recCat(d) { sheet.rec.f.cat = d.c; document.querySelectorAll('#sheet .cat').forEach((b) => { const on = b.dataset.c === d.c; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); recHint(); },
    addAmt(d) { const el = document.querySelector('#sheet [name=amt]'); el.value = won(parseAmt(el.value) + Number(d.n)); recHint(); },
    saveRecord,
    deleteTxn(d) { if (!confirm('이 기록을 지울까요?')) return; S.txns = S.txns.filter((x) => x.id !== d.id); save(); closeSheet(); render(); toast('지웠어요'); },
    importOpen: () => importSheet(),
    importRead: () => sheet.imp.read(),
    importBack: () => sheet.imp.back(),
    importSave: () => sheet.imp.save(),
    period(d) { view.period = E.addMonths(view.period, Number(d.d)); render(); },
    flowFilter(d) { view.flowFilter = d.k; render(); },
    ledgerTab(d, el, ev) { if (ev) ev.preventDefault(); view.ledgerTab = d.t; if (view.tab !== 'ledger') location.hash = '#/ledger'; else render(); closeSheet(); },
    editAccount: (d) => editAccount(d.id), editCard: (d) => editCard(d.id), editRule: (d) => editRule(d.id), editInst: (d) => editInst(d.id),
    editDebt: (d) => editDebt(d.id), debt: (d) => debtSheet(d.id),
    formSave() { if (sheet.onSave() === true) { save(); closeSheet(); render(); toast('저장했어요'); } },
    formDelete() { if (!confirm('삭제할까요?')) return; if (sheet.onDelete() !== false) { save(); closeSheet(); render(); toast('삭제했어요'); } },
    settle(d) {
      const debt = S.debts.find((x) => x.id === d.id); const amt = parseAmt(val('amt')); const acc = refOf(val('acc'));
      if (!amt) return toast('금액을 적어 주세요');
      const t = { id: uid(), kind: 'settle', debtId: debt.id, amount: amt, date: today(), status: 'done', recordedAt: now(), memo: (person(debt.personId) || {}).name + ' 정산' };
      if (debt.dir === 'recv') t.to = acc; else t.from = acc;
      S.txns.push(t); save(); closeSheet(); render(); toast('정산을 기록했어요');
    },
    closeFlow: (d) => closeSheet9(d.p),
    doClose(d) { E.closePeriod(S, d.p, now(), today()); save(); paintSheet(); render(); toast(pName(d.p) + ' 마감했어요'); },
    reopen(d) { if (!confirm('마감을 해제할까요? 지금 마감 기록은 이력으로 남아요.')) return; E.reopenPeriod(S, d.p, now()); save(); paintSheet(); render(); toast('해제했어요'); },
    settingStart() {
      formSheet('급여주기 시작일', [{ name: 'd', label: '매월', type: 'select', value: S.settings.cycleStartDay, options: dayOpts.slice(0, 28) }],
        () => { S.settings.cycleStartDay = Number(val('d')); view.period = null; return true; });
    },
    settingInclude() {
      formSheet('합산 계좌', S.accounts.map((a) => ({ name: 'inc_' + a.id, label: a.name, type: 'switch', value: a.include })),
        () => { S.accounts.forEach((a) => { a.include = val('inc_' + a.id); }); return true; });
    },
    syncOpen: () => (window.Sync ? window.Sync.open({ openSheet, closeSheet, toast, esc }) : toast('곧 연결할게요')),
    backup: () => backupSheet(),
    exportJSON,
    importJSON: () => document.getElementById('importFile').click(),
    obNext, obBack: () => { ob.step--; render(); },
    obCapture: () => setupSheet((na, nc) => {
      if (!na && !nc) return;
      S.settings.cycleStartDay = ob.start; S.onboarded = true; save(); view.tab = 'home'; render();
      toast('계좌 ' + na + '개 · 카드 ' + nc + '개로 시작해요. 카드 출금 계좌는 장부에서 바꿀 수 있어요');
    }),
    setupImport: () => setupSheet(),
    setupRead: () => sheet.setup.read(),
    setupBack: () => sheet.setup.back(),
    setupSave: () => sheet.setup.save(),
    setupBank: (d) => sheet.setup.bank(Number(d.i), d.b),
    editLoan: (d) => editLoan(d.id),
    payCard(d) {
      const c = card(d.id); const b = E.cardBill(S, c.id, d.m);
      if (!confirm(c.name + ' ' + pName(d.m) + ' 결제 ' + won(b.total) + '원이 ' + ((acct(c.accountId) || {}).name || '계좌') + '에서 나갔나요?')) return;
      S.txns.push({ id: uid(), kind: 'cardPayment', cardId: c.id, payMonth: d.m, amount: b.total, date: today(), status: 'done', from: { type: 'account', id: c.accountId }, memo: c.name + ' ' + pName(d.m) + ' 결제', recordedAt: now() });
      save(); render(); paintSheet(); toast('카드대금 출금을 기록했어요');
    },
    settingOverdraft() {
      formSheet('마이너스통장 쓸 수 있는 돈', [{ name: 'm', label: '쓸 수 있는 돈에 넣을 값', type: 'select', value: S.settings.overdraftMode || 'limit', options: [['limit', '남은 한도 (한도 + 잔액)'], ['balance', '잔액 그대로 (마이너스면 빼기)']] }],
        () => { S.settings.overdraftMode = val('m'); return true; });
    },
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) { if (ev.target.id === 'scrim') closeSheet(); return; }
    const fn = A[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') ev.preventDefault();
    fn(el.dataset, el, ev);
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target; const live = el.dataset && el.dataset.live;
    if (live === 'money') {
      const n = parseAmt(el.value); el.value = el.value.trim() === '' ? '' : won(n);
      if (el.dataset.est != null) { const g = n - Number(el.dataset.est); const gap = document.getElementById('gap'); if (gap) gap.textContent = (g > 0 ? '+' : g < 0 ? '−' : '') + won(Math.abs(g)); }
      recHint();
    } else if (live === 'hint') recHint();
    else if (live === 'pick') sheet.imp.pick(Number(el.dataset.i), el.checked);
    else if (live === 'setupKind') sheet.setup.kind(Number(el.dataset.i), el.value);
  });
  document.addEventListener('change', (ev) => { if (ev.target.dataset && ev.target.dataset.live === 'hint') recHint(); });

  function route() {
    const h = location.hash || '#/home';
    // 단축어 연결: …/#/import?t=복사한글자
    if (h.indexOf('#/import') === 0) {
      const q = h.split('?t=')[1];
      history.replaceState(null, '', '#/home'); view.tab = 'home'; render();
      if (S.accounts.length) importSheet(q ? decodeURIComponent(q) : '');
      return;
    }
    const tab = h.replace('#/', '');
    view.tab = ['home', 'flow', 'ledger', 'manage'].indexOf(tab) >= 0 ? tab : 'home';
    if (view.tab === 'home') view.period = curPeriod();
    closeSheet(); render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  // 다른 탭·기기에서 바뀐 데이터 반영 (동기화 모듈이 호출)
  window.App = { get state() { return S; }, replace(s) { S = s; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 실패 시에도 화면은 갱신 */ } render(); }, render, toast };
  route();
})();
