// 재무앱 계산 엔진 — 화면은 이 파일의 결과만 보여줌 (설계 03-데이터모델-계산원칙.md)
// 저장하는 건 입력값뿐, 합계는 매번 계산. 날짜는 'YYYY-MM-DD', 기간·결제월은 'YYYY-MM' 문자열.
(function (root) {
  'use strict';

  // ---------- 날짜 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ym = (y, m) => { // m은 1~12, 넘쳐도 됨
    const t = y * 12 + (m - 1);
    return Math.floor(t / 12) + '-' + pad((t % 12 + 12) % 12 + 1);
  };
  const parseYM = (s) => [Number(s.slice(0, 4)), Number(s.slice(5, 7))];
  const addMonths = (s, k) => { const [y, m] = parseYM(s); return ym(y, m + k); };
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dateIn = (monthStr, day) => { // 말일보다 큰 날짜는 말일로
    const [y, m] = parseYM(monthStr);
    return monthStr + '-' + pad(Math.min(day, daysIn(y, m)));
  };
  const monthOf = (d) => d.slice(0, 7);
  const dayOf = (d) => Number(d.slice(8, 10));
  const addDays = (d, k) => {
    const t = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, dayOf(d) + k));
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  };

  // ---------- 급여주기 (M4: 날짜 고정) ----------
  // "10월 급여주기" = 9/25 ~ 10/24 (시작일 25). 이름은 끝나는 달.
  function periodOf(state, d) {
    const s = state.settings.cycleStartDay;
    return dayOf(d) >= s ? addMonths(monthOf(d), 1) : monthOf(d);
  }
  function periodRange(state, p) {
    const s = state.settings.cycleStartDay;
    const start = dateIn(addMonths(p, -1), s);
    return { start, end: addDays(dateIn(p, s), -1) };
  }

  // 거래가 어느 기간에 집계되는지: 직접 지정 > 급여 규칙 > 날짜
  function txnPeriod(state, t) {
    if (t.period) return t.period;
    const p = periodOf(state, t.date);
    if (t.kind === 'income' && t.salary && t.date !== periodRange(state, p).start) return addMonths(p, 1);
    return p;
  }

  // ---------- 조회 도우미 ----------
  const byId = (list, id) => list.find((x) => x.id === id);
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
  const isCard = (ref) => ref && ref.type === 'card';
  const isAcct = (ref) => ref && ref.type === 'account';

  // 카드 사용일 → 결제월. 기본: 전월 1일~말일 사용분이 다음 달 결제
  function cardPayMonth(card, usageDate) {
    return addMonths(monthOf(usageDate), card.payOffset == null ? 1 : card.payOffset);
  }
  const cardPayDate = (card, payMonth) => dateIn(payMonth, card.payDay);

  // 거래가 계좌에 주는 영향 (+유입 / −유출). 카드로 쓴 기록은 계좌 영향 없음.
  function acctEffect(t, accountId) {
    let e = 0;
    if (isAcct(t.from) && t.from.id === accountId) e -= t.amount;
    if (isAcct(t.to) && t.to.id === accountId) e += t.amount;
    return e;
  }

  // ---------- ① 계정별 추정 잔액 ----------
  function latestCheck(checks, pred) {
    let best = null;
    for (const c of checks) if (pred(c) && (!best || c.at > best.at)) best = c;
    return best;
  }
  function accountBalance(state, accountId) {
    const chk = latestCheck(state.balanceChecks, (c) => c.accountId === accountId);
    const base = chk ? chk.amount : 0;
    const since = chk ? chk.at : -Infinity;
    // M2: 확인 시각보다 나중에 기록한 완료 거래만 가감
    const moved = sum(state.txns.filter((t) => t.status === 'done' && t.recordedAt > since), (t) => acctEffect(t, accountId));
    return { amount: base + moved, checkedAt: chk ? chk.at : null, checkedAmount: chk ? chk.amount : null };
  }
  // 은행앱 잔액을 새로 넣을 때: 입력값 − 추정 잔액 = 기록 안 된 금액
  function balanceGap(state, accountId, input) {
    return input - accountBalance(state, accountId).amount;
  }

  // ---------- ③ 카드별·결제월별 예상 카드값 ----------
  // 정기결제·할부처럼 예정에서 온 항목은 '미반영'일 때만 더함.
  // 직접 쓴 카드 사용은 확인 이후 기록한 것만 더함 (새 확인액에 포함된 것으로 봄).
  const fromSchedule = (t) => !!(t.source && (t.source.ruleId || t.source.installmentId)) || t.status === 'planned';
  function cardItems(state, cardId, payMonth) {
    return state.txns.filter((t) => t.kind === 'expense' && isCard(t.from) && t.from.id === cardId && t.cardPayMonth === payMonth);
  }
  function cardBill(state, cardId, payMonth) {
    const chk = latestCheck(state.cardChecks, (c) => c.cardId === cardId && c.payMonth === payMonth);
    const confirmed = chk ? chk.amount : 0;
    const since = chk ? chk.at : -Infinity;
    const items = cardItems(state, cardId, payMonth).filter((t) => t.reflect !== 'reflected');
    const pending = items.filter(fromSchedule);
    const afterCheck = items.filter((t) => !fromSchedule(t) && t.recordedAt > since);
    const pendingSum = sum(pending, (t) => t.amount);
    const afterSum = sum(afterCheck, (t) => t.amount);
    const paid = state.txns.some((t) => t.kind === 'cardPayment' && t.status === 'done' && t.cardId === cardId && t.payMonth === payMonth);
    return {
      cardId, payMonth, confirmed, confirmedAt: chk ? chk.at : null,
      afterCheck: afterSum, afterCheckItems: afterCheck,
      pending: pendingSum, pendingItems: pending,
      total: confirmed + afterSum + pendingSum, paid,
    };
  }

  // ---------- ⑥ 받을 돈 / 갚을 돈 (상계 없음, M6 부분정산) ----------
  function debtStatus(state, debt) {
    const settled = sum(state.txns.filter((t) => t.kind === 'settle' && t.status === 'done' && t.debtId === debt.id), (t) => t.amount);
    const remaining = Math.max(0, debt.principal - settled);
    // 예정보다 더 받거나 더 갚은 금액은 따로 남김
    return { settled, remaining, extra: Math.max(0, settled - debt.principal), state: settled <= 0 ? '미정산' : remaining > 0 ? '부분정산' : '완료' };
  }

  // ---------- 마이너스통장 (M8: 쓸 수 있는 돈은 남은 한도, 사용액은 대출) ----------
  const isOverdraft = (a) => a.kind === 'overdraft';
  function available(state, a, bal) {
    const b = bal == null ? accountBalance(state, a.id).amount : bal;
    return isOverdraft(a) && state.settings.overdraftMode !== 'balance' ? (a.limit || 0) + b : b;
  }
  const overdraftUsed = (a, bal) => (isOverdraft(a) ? Math.max(0, -bal) : 0);

  // ---------- 대출 ----------
  // 일반대출은 잔액을 직접 관리, 마이너스통장 사용액은 계좌에서 계산
  function loanSummary(state) {
    const od = state.accounts.filter(isOverdraft).map((a) => {
      const bal = accountBalance(state, a.id).amount;
      return { account: a, used: overdraftUsed(a, bal), left: (a.limit || 0) + bal };
    });
    const loans = state.loans || [];
    const self = sum(loans.filter((l) => !l.familyPayer), (l) => l.monthly || 0);
    const family = sum(loans.filter((l) => l.familyPayer), (l) => l.monthly || 0);
    return {
      overdrafts: od, loans,
      overdraftTotal: sum(od, (o) => o.used), loanTotal: sum(loans, (l) => l.balance || 0),
      total: sum(od, (o) => o.used) + sum(loans, (l) => l.balance || 0),
      monthlySelf: self, monthlyFamily: family,
      byRate: loans.concat(od.filter((o) => o.used > 0).map((o) => ({ name: o.account.name, rate: o.account.rate, balance: o.used }))).filter((x) => x.rate).sort((a, b) => b.rate - a.rate),
    };
  }

  // ---------- 이번 주기 여유/부족: 이 주기 수입으로 이 주기에 나갈 돈을 감당하는지 ----------
  function periodBalance(state, p) {
    const { start, end } = periodRange(state, p);
    const incl = new Set(state.accounts.filter((a) => a.include).map((a) => a.id));
    const mine = (r) => r && r.type === 'account' && incl.has(r.id);
    let income = 0, out = 0;
    const parts = { income: 0, card: 0, account: 0, loan: 0, other: 0 };
    for (const t of state.txns) {
      if (txnPeriod(state, t) !== p) continue;
      if (t.kind === 'income' && mine(t.to)) { income += t.amount; parts.income += t.amount; }
      else if (t.kind === 'expense' && mine(t.from)) { out += t.amount; if (t.categoryId === '대출') parts.loan += t.amount; else parts.account += t.amount; }
      else if (t.kind === 'settle' && mine(t.to)) { income += t.amount; parts.income += t.amount; }
      else if (t.kind === 'settle' && mine(t.from)) { out += t.amount; parts.other += t.amount; }
      else if (t.kind === 'transfer' && mine(t.from) && !mine(t.to)) { out += t.amount; parts.other += t.amount; }
      else if (t.kind === 'transfer' && !mine(t.from) && mine(t.to)) { income += t.amount; parts.income += t.amount; }
    }
    for (const c of state.cards) {
      for (const m of [addMonths(p, -1), p, addMonths(p, 1)]) {
        const d = cardPayDate(c, m);
        if (d < start || d > end) continue;
        const pay = state.txns.find((t) => t.kind === 'cardPayment' && t.status === 'done' && t.cardId === c.id && t.payMonth === m);
        const amt = pay ? pay.amount : cardBill(state, c.id, m).total;
        out += amt; parts.card += amt;
      }
    }
    return { period: p, income, out, left: income - out, parts };
  }

  // ---------- 현황 숫자 (②④⑤⑥ + 지역화폐) ----------
  function summary(state, today) {
    const p = periodOf(state, today);
    const { start, end } = periodRange(state, p);
    const incl = new Set(state.accounts.filter((a) => a.include).map((a) => a.id));
    const balances = state.accounts.map((a) => ({ account: a, ...accountBalance(state, a.id) }));

    balances.forEach((b) => { b.available = available(state, b.account, b.amount); });
    // ② 쓸 수 있는 돈: 합산 켠 계정 합. 마통은 남은 한도 (M8)
    const spendable = sum(balances.filter((b) => incl.has(b.account.id)), (b) => b.available);
    // M5: 지역화폐는 합산 꺼져 있으면 따로
    const localMoney = sum(balances.filter((b) => b.account.kind === 'local' && !incl.has(b.account.id)), (b) => b.amount);

    // ④ 이번 주기 끝까지의 예정 유입·유출 (합산 계정 기준, 카드 사용은 카드대금으로만)
    let inflow = 0, outflow = 0;
    const outItems = [];
    for (const t of state.txns) {
      if (t.status !== 'planned' || t.date > end) continue;
      if (t.kind === 'cardPayment') continue; // 카드대금은 아래에서 ③으로 계산
      let e = 0;
      for (const id of incl) e += acctEffect(t, id);
      if (e > 0) inflow += e;
      if (e < 0) { outflow += -e; outItems.push({ label: t.memo || t.kind, amount: -e, date: t.date }); }
    }
    // 이번 주기에 결제일이 있는 카드대금 (결제 완료면 빠짐)
    const cardBills = [];
    for (const c of state.cards) {
      for (const m of [addMonths(p, -1), p, addMonths(p, 1)]) {
        const d = cardPayDate(c, m);
        if (d < start || d > end) continue;
        const b = cardBill(state, c.id, m);
        cardBills.push({ card: c, payDate: d, ...b });
        if (!b.paid && incl.has(c.accountId)) { outflow += b.total; outItems.push({ label: c.name + ' 대금', amount: b.total, date: d }); }
      }
    }
    // M3: 받을/갚을 돈은 예정일이 있고 스위치 켠 것만
    let recv = 0, pay = 0;
    for (const debt of state.debts) {
      const st = debtStatus(state, debt);
      if (debt.dir === 'recv') recv += st.remaining; else pay += st.remaining;
      if (debt.includeInForecast && debt.dueDate && debt.dueDate <= end && st.remaining > 0) {
        if (debt.dir === 'recv') inflow += st.remaining;
        else { outflow += st.remaining; outItems.push({ label: '갚을 돈', amount: st.remaining, date: debt.dueDate }); }
      }
    }

    // 다음 카드값: 아직 결제 안 된 가장 가까운 결제월들
    const nextCards = state.cards.map((c) => {
      let m = cardPayMonth(c, today);
      if (cardPayDate(c, addMonths(m, -1)) >= today) m = addMonths(m, -1);
      if (cardBill(state, c.id, m).paid) m = addMonths(m, 1);
      return { card: c, payDate: cardPayDate(c, m), ...cardBill(state, c.id, m) };
    });

    return {
      period: p, start, end, daysLeft: daysBetween(today, end),
      spendable, forecast: spendable + inflow - outflow,
      nextCardTotal: sum(nextCards, (b) => b.total), nextCards,
      remainingPlanned: outflow, plannedOut: outItems.sort((a, b) => (a.date < b.date ? -1 : 1)), plannedIn: inflow,
      receivable: recv, payable: pay, localMoney, balances, cardBills,
      debtTotal: loanSummary(state).total,
      unclosedPrev: !isClosed(state, addMonths(p, -1)) && hasAnyIn(state, addMonths(p, -1)),
    };
  }
  function daysBetween(a, b) {
    const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
    const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
    return Math.round((tb - ta) / 86400000);
  }

  // ---------- 흐름: 기간 집계 (이체·차입은 수입·지출 아님) ----------
  function flow(state, p) {
    const ts = state.txns.filter((t) => txnPeriod(state, t) === p);
    const isIn = (t) => t.kind === 'income';
    const isOut = (t) => t.kind === 'expense';
    const done = ts.filter((t) => t.status === 'done');
    const byCat = {};
    for (const t of ts.filter(isOut)) byCat[t.categoryId || '기타'] = (byCat[t.categoryId || '기타'] || 0) + t.amount;
    return {
      period: p, ...periodRange(state, p),
      income: sum(ts.filter(isIn), (t) => t.amount),
      spent: sum(done.filter(isOut), (t) => t.amount),
      plannedSpend: sum(ts.filter((t) => isOut(t) && t.status === 'planned'), (t) => t.amount),
      byCategory: byCat,
      items: ts.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
  }

  // ---------- 새 주기: 정기결제·할부 예정 자동 생성 (P7, 번호 고정이라 한 번만) ----------
  function ensurePeriod(state, p, now) {
    const { start, end } = periodRange(state, p);
    const have = new Set(state.txns.map((t) => t.id));
    const made = [];
    for (const r of state.recurring) {
      if (r.active === false) continue;
      if (r.start && p < r.start) continue;
      if (r.end && p > r.end) continue;
      const id = 'r:' + r.id + ':' + p;
      if (have.has(id)) continue;
      // 결제일이 시작일 이후면 앞달, 아니면 끝달
      const date = r.day >= state.settings.cycleStartDay ? dateIn(addMonths(p, -1), r.day) : dateIn(p, r.day);
      const t = { id, kind: r.kind || 'expense', amount: amountAt(r, p), date, status: 'planned', from: r.method, to: r.to || null,
        categoryId: r.categoryId || null, memo: r.name, source: { ruleId: r.id }, approx: !!r.approx, salary: !!r.salary, recordedAt: now };
      if (isCard(r.method)) { t.cardPayMonth = cardPayMonth(byId(state.cards, r.method.id), date); t.reflect = 'unreflected'; }
      made.push(t);
    }
    // 대출 월 납입: 납부 계좌에서 정기 출금, 가족 대납이면 같은 날 대납금 수입도 함께
    for (const l of state.loans || []) {
      if (!l.monthly || !l.payDay || !l.payFrom || l.active === false) continue;
      if (l.start && p < l.start) continue;
      const date = l.payDay >= state.settings.cycleStartDay ? dateIn(addMonths(p, -1), l.payDay) : dateIn(p, l.payDay);
      const id = 'l:' + l.id + ':' + p;
      if (!have.has(id)) made.push({ id, kind: 'expense', amount: l.monthly, date, status: 'planned', from: { type: 'account', id: l.payFrom },
        categoryId: '대출', memo: l.name + ' 납입', source: { loanId: l.id }, approx: !!l.approx, recordedAt: now });
      const fid = 'lf:' + l.id + ':' + p;
      if (l.familyPayer && !have.has(fid)) made.push({ id: fid, kind: 'income', amount: l.monthly, date, status: 'planned', to: { type: 'account', id: l.payFrom },
        categoryId: '대납금', memo: l.familyPayer + ' 대납금 (' + l.name + ')', source: { loanId: l.id, family: true }, recordedAt: now });
    }
    for (const ins of state.installments) {
      const card = byId(state.cards, ins.cardId);
      for (let k = 0; k < ins.months; k++) {
        const m = addMonths(ins.startPayMonth, k);
        const pd = cardPayDate(card, m);
        // 이번 주기 사용분이 나가는 결제월까지 미리 만듦 (지난 결제분은 만들지 않음)
        if (m > cardPayMonth(card, end) || pd < start) continue;
        const id = 'i:' + ins.id + ':' + (k + 1);
        if (have.has(id)) continue;
        made.push({ id, kind: 'expense', amount: Array.isArray(ins.amounts) ? ins.amounts[k] : ins.amount, date: pd, status: 'planned',
          from: { type: 'card', id: card.id }, categoryId: ins.categoryId || null, memo: ins.name + ' ' + (k + 1) + '/' + ins.months,
          source: { installmentId: ins.id }, cardPayMonth: m, reflect: ins.reflectDefault || 'unreflected', recordedAt: now });
      }
    }
    state.txns.push(...made);
    return made;
  }
  function amountAt(rule, p) {
    let a = rule.amount;
    for (const h of rule.history || []) if (h.from <= p) a = h.amount;
    return a;
  }

  // ---------- 할부 월별 청구 추이 (카드별) ----------
  function installmentTrend(state, fromMonth, months) {
    const rows = [];
    for (let k = 0; k < months; k++) {
      const m = addMonths(fromMonth, k);
      const byCard = {};
      for (const ins of state.installments) {
        const idx = monthDiff(ins.startPayMonth, m);
        if (idx < 0 || idx >= ins.months) continue;
        const a = Array.isArray(ins.amounts) ? ins.amounts[idx] : ins.amount;
        byCard[ins.cardId] = (byCard[ins.cardId] || 0) + a;
      }
      const total = Object.values(byCard).reduce((x, y) => x + y, 0);
      if (total) rows.push({ month: m, byCard, total });
    }
    return rows;
  }
  const monthDiff = (a, b) => { const [y1, m1] = parseYM(a); const [y2, m2] = parseYM(b); return (y2 - y1) * 12 + (m2 - m1); };

  // ---------- 월마감 (P5 경고만, 이월은 같은 기록을 옮김) ----------
  const isClosed = (state, p) => state.closes.some((c) => c.period === p && !c.reopenedAt);
  const hasAnyIn = (state, p) => state.txns.some((t) => txnPeriod(state, t) === p);

  function closeChecks(state, p, now) {
    const warn = [];
    const pend = state.txns.filter((t) => t.status === 'planned' && txnPeriod(state, t) === p);
    if (pend.length) warn.push({ kind: 'pending', count: pend.length, text: '완료 안 된 예정 ' + pend.length + '건은 다음 주기로 넘어가요' });
    for (const a of state.accounts) {
      const chk = latestCheck(state.balanceChecks, (c) => c.accountId === a.id);
      const days = chk ? Math.floor((now - chk.at) / 86400000) : null;
      if (days == null || days > 7) warn.push({ kind: 'stale', accountId: a.id, text: a.name + ' 잔액 확인이 ' + (days == null ? '아직 없어요' : days + '일 전이에요') });
    }
    return warn;
  }
  function closePeriod(state, p, now, today) {
    const next = addMonths(p, 1);
    const carried = [];
    for (const t of state.txns) {
      if (t.status === 'planned' && txnPeriod(state, t) === p && t.kind !== 'cardPayment') {
        t.period = next; t.carriedFrom = p; carried.push(t.id);
      }
    }
    const snap = {
      period: p, closedAt: now,
      flow: flow(state, p),
      summary: summary(state, today),
      txns: JSON.parse(JSON.stringify(state.txns.filter((t) => txnPeriod(state, t) === p || t.carriedFrom === p))),
      settings: JSON.parse(JSON.stringify({ settings: state.settings, accounts: state.accounts, cards: state.cards, recurring: state.recurring })),
      carried,
    };
    state.closes.push(snap);
    return snap;
  }
  function reopenPeriod(state, p, now) {
    const c = state.closes.find((x) => x.period === p && !x.reopenedAt);
    if (c) c.reopenedAt = now; // 이전 스냅샷은 이력으로 남음
    return c;
  }

  // ---------- 캡처 가져오기: 중복 의심 (날짜+금액+가맹점) ----------
  const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
  function findDuplicate(state, cand) {
    return state.txns.find((t) => t.date === cand.date && t.amount === cand.amount && norm(t.memo) === norm(cand.memo)) || null;
  }

  function emptyState() {
    return {
      version: 1,
      settings: { cycleStartDay: 25 },
      accounts: [], cards: [], recurring: [], installments: [], people: [], debts: [], loans: [],
      categories: ['식비', '카페', '교통', '쇼핑', '생활', '의료', '경조사', '주거', '통신', '구독', '보험', '대출', '급여', '기타'],
      txns: [], balanceChecks: [], cardChecks: [], closes: [],
    };
  }

  const api = {
    addMonths, addDays, dateIn, periodOf, periodRange, txnPeriod, cardPayMonth, cardPayDate,
    accountBalance, balanceGap, cardBill, debtStatus, summary, flow, ensurePeriod,
    available, loanSummary, periodBalance, installmentTrend,
    closeChecks, closePeriod, reopenPeriod, isClosed, findDuplicate, emptyState, daysBetween,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
