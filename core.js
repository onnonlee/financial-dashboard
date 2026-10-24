// 계산 엔진 v2. 저장하는 건 기본 정보(계좌·카드·고정비·대출·할부·수입·갚을 돈)와 가계부 기록뿐.
// 매달 나가고 들어오는 돈은 저장하지 않고 기본 정보에서 그때그때 계산 → 한 곳을 고치면 모든 화면이 같이 바뀜.
// 날짜 'YYYY-MM-DD', 달 'YYYY-MM'. 급여주기 P = (P-1월 급여일) ~ (P월 급여일 전날). 예: 11월 = 10/25 ~ 11/24.
(function (root) {
  'use strict';

  // ---------- 날짜 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ym = (y, m) => { const t = y * 12 + (m - 1); return Math.floor(t / 12) + '-' + pad(((t % 12) + 12) % 12 + 1); };
  const addMonths = (s, k) => ym(Number(s.slice(0, 4)), Number(s.slice(5, 7)) + k);
  const daysIn = (s) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)), 0)).getUTCDate();
  const dateIn = (m, d) => m + '-' + pad(Math.min(d, daysIn(m)));
  const monthOf = (d) => d.slice(0, 7);
  const dayOf = (d) => Number(d.slice(8, 10));
  const toUTC = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, dayOf(d));
  const addDays = (d, k) => { const t = new Date(toUTC(d) + k * 86400000); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); };
  const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
  const monthDiff = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  const sum = (xs, f) => xs.reduce((a, x) => a + (f ? f(x) : x), 0);

  const payDay = (st) => st.settings.payDay || 25;
  // 공휴일(대체공휴일 포함). 임시공휴일은 생기면 추가
  const HOLI = new Set(('2026-01-01 2026-02-16 2026-02-17 2026-02-18 2026-03-02 2026-05-05 2026-05-25 2026-06-03 2026-08-17 2026-09-24 2026-09-25 2026-10-05 2026-10-09 2026-12-25 ' +
    '2027-01-01 2027-02-08 2027-02-09 2027-03-01 2027-05-05 2027-05-13 2027-08-16 2027-09-14 2027-09-15 2027-09-16 2027-10-04 2027-10-11 2027-12-27').split(' '));
  const isOff = (d) => { const w = new Date(toUTC(d)).getUTCDay(); return w === 0 || w === 6 || HOLI.has(d); };
  // 주말·공휴일이면 앞 평일로
  function bizBefore(d) { let x = d; for (let i = 0; i < 10 && isOff(x); i++) x = addDays(x, -1); return x; }
  // 급여일이 31일(말일)이면 30일까지인 달은 30일이 급여일
  function periodOf(st, d) { return d >= dateIn(monthOf(d), payDay(st)) ? addMonths(monthOf(d), 1) : monthOf(d); }
  function periodRange(st, P) { return { start: dateIn(addMonths(P, -1), payDay(st)), end: addDays(dateIn(P, payDay(st)), -1) }; }
  // 매달 d일 항목이 주기 P 안에서 오는 날짜
  const dayInPeriod = (st, P, d) => (d >= payDay(st) ? dateIn(addMonths(P, -1), d) : dateIn(P, d));
  const activeIn = (x, P) => x.active !== false && (!x.from || P >= x.from) && (!x.until || P <= x.until);
  const findBy = (xs, id) => xs.find((x) => x.id === id);
  // 고정비 금액: 기본 요금(base)이 있으면 그 달에 적용되는 할인을 차례로 빼서 계산 (통신사 할인 → 카드 청구할인 % 순서)
  const inRange = (x, P) => (!x.from || P >= x.from) && (!x.until || P <= x.until);
  function fixedAmount(f, P) {
    if (!f.base) return f.amount;
    let a = f.base;
    for (const d of f.discounts || []) if (inRange(d, P)) a -= d.pct ? Math.round(a * d.pct / 100) : d.amount || 0;
    return Math.max(0, a);
  }

  // ---------- 카드 ----------
  // 사용한 달 + offset(기본 1) = 결제월
  const payMonthOf = (card, usageDate) => addMonths(monthOf(usageDate), card.offset == null ? 1 : card.offset);
  const cardPayDate = (card, m) => dateIn(m, card.payDay || 15);

  // ---------- 이번 달만 바꾸기 (over) ----------
  // st.over[key] = { amount, date, skip, reflected }. key: 'fixed:id:P', 'loan:id:P', 'family:id:P', 'income:id:P', 'card:id:결제월', 'inst:id:결제월'
  const ov = (st, key) => (st.over && st.over[key]) || {};

  // ---------- 매달 일정: 기본 정보에서 계산 ----------
  // 계좌로 오가는 것만 (카드로 내는 고정비·할부는 카드값 안에 들어감)
  function schedule(st, P, today) {
    const out = [];
    const push = (it) => {
      const o = ov(st, it.key);
      it.planned = it.amount; it.plannedDate = it.date;
      if (o.amount != null) { it.amount = o.amount; it.edited = true; }
      if (o.date) { it.date = o.date; it.edited = true; }
      it.skip = !!o.skip;
      it.done = !it.skip && today != null && it.date <= today;
      out.push(it);
    };
    for (const x of st.incomes) {
      if (!activeIn(x, P)) continue;
      push({ key: 'income:' + x.id + ':' + P, src: 'income', id: x.id, name: x.name, dir: 'in', amount: x.amount, approx: !!x.approx, date: x.salary && st.settings.payShift ? bizBefore(dayInPeriod(st, P, x.day)) : dayInPeriod(st, P, x.day), acct: x.accountId, cat: x.salary ? '급여' : '수입' });
    }
    for (const l of st.loans) {
      if (!activeIn(l, P) || !l.monthly || !l.accountId) continue;
      const date = dayInPeriod(st, P, l.payDay || payDay(st));
      push({ key: 'loan:' + l.id + ':' + P, src: 'loan', id: l.id, name: (l.bank ? l.bank + ' ' : '') + l.name, dir: 'out', amount: l.monthly, approx: !!l.approx, date, acct: l.accountId, cat: '대출', family: l.familyPayer || null });
      if (l.familyPayer) push({ key: 'family:' + l.id + ':' + P, src: 'family', id: l.id, name: l.familyPayer + ' 대납금', dir: 'in', amount: l.familyAmount || l.monthly, approx: !!l.approx, date, acct: l.accountId, cat: '대납금' });
    }
    for (const f of st.fixed) {
      if (!activeIn(f, P) || !f.pay || f.pay.type !== 'account') continue;
      push({ key: 'fixed:' + f.id + ':' + P, src: 'fixed', id: f.id, name: f.name, dir: 'out', amount: fixedAmount(f, P), approx: !!f.approx, date: dayInPeriod(st, P, f.day), acct: f.pay.id, cat: f.cat || '고정비' });
    }
    const { start, end } = periodRange(st, P);
    for (const c of st.cards) {
      for (const m of [addMonths(P, -1), P, addMonths(P, 1)]) {
        const d = cardPayDate(c, m);
        if (d < start || d > end) continue;
        const b = cardBill(st, c.id, m);
        push({ key: 'card:' + c.id + ':' + m, src: 'card', id: c.id, payMonth: m, name: c.name + ' ' + Number(m.slice(5)) + '월 결제', dir: 'out', amount: b.total, date: d, acct: c.accountId, cat: '카드값' });
      }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // ---------- 카드값 = 카드앱 확인액 + 아직 카드앱에 안 보이는 것 ----------
  // 카드앱 확인액을 적은 뒤에 쓴 것(가계부), 확인한 날 이후 청구될 고정비만 더함. 할부는 확인액에 들어 있다고 봄.
  // 확인액이 없으면 아는 것(가계부 카드 사용 + 고정비 + 할부)을 모두 더함.
  function cardCharges(st, cardId, m) {
    const c = findBy(st.cards, cardId); const items = [];
    const U = addMonths(m, -(c.offset == null ? 1 : c.offset)); // 사용한 달
    for (const f of st.fixed) {
      if (!f.pay || f.pay.type !== 'card' || f.pay.id !== cardId) continue;
      const date = dateIn(U, f.day); const P = periodOf(st, date);
      if (!activeIn(f, P)) continue;
      const key = 'fixed:' + f.id + ':' + P; const o = ov(st, key);
      if (o.skip) continue;
      items.push({ key, src: 'fixed', id: f.id, name: f.name, date: o.date || date, amount: o.amount != null ? o.amount : fixedAmount(f, P), approx: !!f.approx, reflected: o.reflected });
    }
    for (const i of st.installments) {
      if (i.cardId !== cardId) continue;
      const k = monthDiff(i.startMonth, m);
      if (k < 0 || k >= i.months) continue;
      const key = 'inst:' + i.id + ':' + m; const o = ov(st, key);
      const amt = o.amount != null ? o.amount : Array.isArray(i.amounts) && i.amounts[k] != null ? i.amounts[k] : i.amount;
      items.push({ key, src: 'inst', id: i.id, name: i.name + ' ' + (k + 1) + '/' + i.months, date: null, amount: amt, inst: true, reflected: o.reflected });
    }
    for (const r of st.records) {
      if (r.type !== 'expense' || !r.from || r.from.type !== 'card' || r.from.id !== cardId || r.payMonth !== m) continue;
      items.push({ key: 'rec:' + r.id, src: 'record', id: r.id, name: r.memo || r.cat || '카드 사용', date: r.date, amount: r.amount, at: r.at, reflected: r.reflected });
    }
    return items;
  }
  function cardBill(st, cardId, m) {
    const c = findBy(st.cards, cardId);
    const app = c.app && c.app[m];
    const items = cardCharges(st, cardId, m);
    for (const it of items) {
      if (it.reflected === true || it.reflected === false) { it.included = it.reflected; continue; }
      if (!app) { it.included = false; continue; }
      if (it.inst) it.included = true;
      else if (it.src === 'record') it.included = it.at <= app.at;
      else it.included = it.date <= app.date;
    }
    const pending = items.filter((x) => !x.included);
    const o = ov(st, 'card:' + cardId + ':' + m);
    const total = o.amount != null ? o.amount : (app ? app.amount : 0) + sum(pending, (x) => x.amount);
    return { cardId, payMonth: m, payDate: cardPayDate(c, m), app: app || null, items, pending, pendingTotal: sum(pending, (x) => x.amount), total, paidAmount: o.amount != null ? o.amount : null,
      instTotal: sum(items.filter((x) => x.inst), (x) => x.amount) };
  }

  // ---------- 가계부 기록이 계좌에 주는 영향 ----------
  function recEffect(r, acctId) {
    let e = 0;
    if (r.from && r.from.type === 'account' && r.from.id === acctId) e -= r.amount;
    if (r.to && r.to.type === 'account' && r.to.id === acctId) e += r.amount;
    return e;
  }

  // ---------- 계좌 잔액 = 은행앱 숫자(기준) + 그 뒤 기록 + 그 뒤 지난 일정 ----------
  function accountBalance(st, acctId, today) {
    const a = findBy(st.accounts, acctId);
    let bal = a.balance || 0;
    const baseAt = a.balanceAt || 0, baseDate = a.balanceDate;
    for (const r of st.records) if (r.at > baseAt) bal += recEffect(r, acctId);
    // 은행앱 숫자를 아직 안 적었으면 일정은 더하지 않음
    if (today && a.balanceDate) {
      for (const P of periodsBetween(st, baseDate, today)) {
        for (const it of schedule(st, P, today)) {
          if (it.acct !== acctId || !it.done || it.date <= baseDate) continue;
          bal += it.dir === 'in' ? it.amount : -it.amount;
        }
      }
    }
    return bal;
  }
  function periodsBetween(st, fromDate, toDate) {
    const out = []; let P = periodOf(st, fromDate); const last = periodOf(st, toDate);
    while (P <= last && out.length < 60) { out.push(P); P = addMonths(P, 1); }
    return out;
  }
  const isOD = (a) => a.type === 'overdraft';
  const available = (a, bal) => (isOD(a) ? (a.limit || 0) + bal : bal);

  // ---------- 대출 잔액 = 적어 둔 잔액 − 그 뒤 납입의 원금 부분 (납입액 − 잔액×금리÷12) ----------
  function loanBalance(st, loan, today) {
    let bal = loan.balance || 0; let paid = 0;
    const base = loan.balanceDate || today;
    if (!today) return { amount: bal, paid };
    for (const P of periodsBetween(st, base, today)) {
      const it = schedule(st, P, today).find((x) => x.src === 'loan' && x.id === loan.id);
      if (!it || !it.done || it.date <= base) continue;
      const interest = Math.round((bal * (loan.rate || 0)) / 1200);
      const part = Math.min(bal, Math.max(0, it.amount - interest));
      bal -= part; paid++;
    }
    return { amount: bal, paid };
  }
  function loanSummary(st, today) {
    const od = st.accounts.filter(isOD).map((a) => { const bal = accountBalance(st, a.id, today); return { account: a, used: Math.max(0, -bal), left: (a.limit || 0) + bal }; });
    const loans = st.loans.map((l) => { const b = loanBalance(st, l, today); return { loan: l, ...b, interest: Math.round((b.amount * (l.rate || 0)) / 1200) }; });
    const live = loans.filter((x) => x.loan.active !== false);
    // 내 부담 = 내가 내는 대출 납입 + 이자로 적어 둔 고정비(분류 '대출')
    const interestFixed = st.fixed.filter((f) => f.cat === '대출' && f.active !== false);
    const self = sum(live.filter((x) => !x.loan.familyPayer), (x) => x.loan.monthly || 0) + sum(interestFixed, (f) => f.amount);
    const family = sum(live.filter((x) => x.loan.familyPayer), (x) => x.loan.monthly || 0);
    const odTotal = sum(od, (o) => o.used), loanTotal = sum(live, (x) => x.amount);
    const order = live.filter((x) => x.loan.rate && x.amount > 0).map((x) => ({ name: (x.loan.bank ? x.loan.bank + ' ' : '') + x.loan.name, rate: x.loan.rate, amount: x.amount }))
      .concat(od.filter((o) => o.used > 0 && o.account.rate).map((o) => ({ name: o.account.name + ' 마이너스통장', rate: o.account.rate, amount: o.used })))
      .sort((a, b) => b.rate - a.rate);
    return { overdrafts: od, loans, interestFixed, odTotal, loanTotal, total: odTotal + loanTotal, monthlySelf: self, monthlyFamily: family, order };
  }

  // ---------- 받을 돈·갚을 돈 ----------
  function debtStatus(st, d) {
    const settled = sum(st.records.filter((r) => r.type === 'settle' && r.debtId === d.id), (r) => r.amount);
    return { settled, left: Math.max(0, d.amount - settled), extra: Math.max(0, settled - d.amount), done: settled >= d.amount };
  }

  // ---------- 급여주기 흐름: 이번 급여로 버틸 수 있나 ----------
  const recPeriod = (st, r) => (r.period ? r.period : periodOf(st, r.date));
  function flow(st, P, today) {
    const sch = schedule(st, P, today).filter((x) => !x.skip);
    const recs = st.records.filter((r) => recPeriod(st, r) === P);
    const inc = (a) => { const x = findBy(st.accounts, a); return !x || x.include !== false; };
    const L = {
      income: sum(sch.filter((x) => x.dir === 'in' && inc(x.acct)), (x) => x.amount) + sum(recs.filter((r) => r.type === 'income' && r.to && inc(r.to.id)), (r) => r.amount) + sum(recs.filter((r) => r.type === 'settle' && r.to), (r) => r.amount),
      card: sum(sch.filter((x) => x.src === 'card'), (x) => x.amount),
      // 분류가 '대출'인 고정비(마이너스통장 이자 등)는 대출·이자로
      fixed: sum(sch.filter((x) => x.src === 'fixed' && x.cat !== '대출'), (x) => x.amount),
      loan: sum(sch.filter((x) => x.src === 'loan' || (x.src === 'fixed' && x.cat === '대출')), (x) => x.amount),
      living: sum(recs.filter((r) => r.type === 'expense' && r.from && r.from.type === 'account'), (r) => r.amount),
      other: sum(recs.filter((r) => r.type === 'settle' && r.from), (r) => r.amount),
    };
    for (const d of st.debts) {
      if (!d.inForecast || !d.due || periodOf(st, d.due) !== P) continue;
      const left = debtStatus(st, d).left;
      if (d.dir === 'pay') L.other += left; else L.income += left;
    }
    const out = L.card + L.fixed + L.loan + L.living + L.other;
    // 가계부 지출 (카드 포함) 분류별
    const spend = recs.filter((r) => r.type === 'expense');
    const byCat = {};
    for (const r of spend) byCat[r.cat || '기타'] = (byCat[r.cat || '기타'] || 0) + r.amount;
    return { P, ...periodRange(st, P), lines: L, out, left: L.income - out, schedule: sch, records: recs,
      spent: sum(spend, (r) => r.amount), spentCard: sum(spend.filter((r) => r.from && r.from.type === 'card'), (r) => r.amount), byCat };
  }

  // ---------- 지금 현황 ----------
  function status(st, today) {
    const P = periodOf(st, today); const { start, end } = periodRange(st, P);
    const accts = st.accounts.map((a) => { const bal = accountBalance(st, a.id, today); return { account: a, balance: bal, available: available(a, bal) }; });
    const spendable = sum(accts.filter((x) => x.account.include !== false && x.account.type !== 'local'), (x) => x.available);
    const local = sum(accts.filter((x) => x.account.type === 'local'), (x) => x.balance);
    const inc = new Set(st.accounts.filter((a) => a.include !== false && a.type !== 'local').map((a) => a.id));
    const upcoming = schedule(st, P, today).filter((x) => !x.skip && !x.done && inc.has(x.acct));
    for (const d of st.debts) {
      const left = debtStatus(st, d).left;
      if (d.inForecast && d.due && d.due > today && d.due <= end && left > 0) upcoming.push({ key: 'debt:' + d.id, src: 'debt', id: d.id, name: (d.dir === 'pay' ? '갚을 돈 · ' : '받을 돈 · ') + d.who, dir: d.dir === 'pay' ? 'out' : 'in', amount: left, date: d.due });
    }
    upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));
    const inflow = sum(upcoming.filter((x) => x.dir === 'in'), (x) => x.amount);
    const outflow = sum(upcoming.filter((x) => x.dir === 'out'), (x) => x.amount);
    const nextCards = st.cards.map((c) => {
      let m = monthOf(today); if (cardPayDate(c, m) <= today) m = addMonths(m, 1);
      return { card: c, ...cardBill(st, c.id, m) };
    });
    const debts = st.debts.map((d) => ({ debt: d, ...debtStatus(st, d) }));
    return { P, start, end, daysLeft: daysBetween(today, end), accts, spendable, local, upcoming, inflow, outflow, forecast: spendable + inflow - outflow,
      nextCards, nextCardTotal: sum(nextCards, (b) => b.total), debts,
      payable: sum(debts.filter((x) => x.debt.dir === 'pay'), (x) => x.left), receivable: sum(debts.filter((x) => x.debt.dir === 'recv'), (x) => x.left) };
  }

  // ---------- 할부 월별 추이 ----------
  function installmentTrend(st, fromMonth, n) {
    const rows = [];
    for (let k = 0; k < n; k++) {
      const m = addMonths(fromMonth, k); const byCard = {};
      for (const c of st.cards) { const a = sum(cardCharges(st, c.id, m).filter((x) => x.inst), (x) => x.amount); if (a) byCard[c.id] = a; }
      const total = sum(Object.values(byCard));
      if (total) rows.push({ month: m, byCard, total });
    }
    return rows;
  }

  // ---------- 캡처 중복 의심 ----------
  const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
  const findDuplicate = (st, c) => st.records.find((r) => r.date === c.date && r.amount === c.amount && norm(r.memo) === norm(c.memo)) || null;

  function emptyState() {
    return {
      v: 2, settings: { payDay: 25 },
      accounts: [], cards: [], fixed: [], loans: [], installments: [], incomes: [], debts: [], records: [], over: {},
      categories: ['식비', '카페', '교통', '쇼핑', '생활', '의료', '경조사', '주거', '통신', '구독', '보험', '기타'],
    };
  }

  const api = { addMonths, addDays, dateIn, daysBetween, monthDiff, periodOf, periodRange, dayInPeriod, payMonthOf, cardPayDate,
    schedule, cardCharges, cardBill, accountBalance, available, loanBalance, loanSummary, debtStatus, flow, status, installmentTrend, findDuplicate, emptyState, fixedAmount, bizBefore, isOff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(this);
