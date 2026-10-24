// 계산 엔진 v2 시험 (숫자는 모두 가짜). 실행: node test/core.test.js
const assert = require('assert');
const C = require('../core.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✔', name); } catch (e) { console.log('✘', name, '\n  ', e.message); process.exitCode = 1; }
}

// 가짜 장부: A은행(입출금), B은행(마이너스통장 한도 500만), C카드(15일, A은행 출금)
function base() {
  const s = C.emptyState();
  s.accounts.push({ id: 'a', name: 'A은행', type: 'bank', balance: 1000000, balanceAt: 1000, balanceDate: '2026-10-20' });
  s.accounts.push({ id: 'b', name: 'B은행', type: 'overdraft', limit: 5000000, rate: 6, balance: -2000000, balanceAt: 1000, balanceDate: '2026-10-20' });
  s.cards.push({ id: 'c', name: 'C카드', payDay: 15, accountId: 'a' });
  return s;
}

test('11월 급여주기 = 10/25 ~ 11/24', () => {
  const s = base();
  assert.deepStrictEqual(C.periodRange(s, '2026-11'), { start: '2026-10-25', end: '2026-11-24' });
  assert.strictEqual(C.periodOf(s, '2026-10-25'), '2026-11');
  assert.strictEqual(C.periodOf(s, '2026-10-24'), '2026-10');
});

test('급여일 말일(31일)이면 짧은 달은 그달 마지막 날부터', () => {
  const s = base(); s.settings.payDay = 31;
  assert.strictEqual(C.periodOf(s, '2026-11-30'), '2026-12');
  assert.strictEqual(C.periodOf(s, '2026-11-29'), '2026-11');
  assert.deepStrictEqual(C.periodRange(s, '2026-12'), { start: '2026-11-30', end: '2026-12-30' });
  assert.deepStrictEqual(C.periodRange(s, '2027-03'), { start: '2027-02-28', end: '2027-03-30' });
});

test('고정비 금액을 고치면 이번 주기·다음 주기 일정이 같이 바뀜', () => {
  const s = base();
  s.fixed.push({ id: 'rent', name: '월세', amount: 300000, day: 25, pay: { type: 'account', id: 'a' } });
  assert.strictEqual(C.flow(s, '2026-11', '2026-10-21').lines.fixed, 300000);
  s.fixed[0].amount = 350000;
  assert.strictEqual(C.flow(s, '2026-11', '2026-10-21').lines.fixed, 350000);
  assert.strictEqual(C.flow(s, '2026-12', '2026-10-21').lines.fixed, 350000);
});

test('이번 달만 바꾸기는 그 달에만, 건너뛰기는 합계에서 빠짐', () => {
  const s = base();
  s.fixed.push({ id: 'gas', name: '가스', amount: 30000, day: 5, pay: { type: 'account', id: 'a' } });
  s.over['fixed:gas:2026-11'] = { amount: 45000 };
  assert.strictEqual(C.flow(s, '2026-11', '2026-10-21').lines.fixed, 45000);
  assert.strictEqual(C.flow(s, '2026-12', '2026-10-21').lines.fixed, 30000);
  s.over['fixed:gas:2026-12'] = { skip: true };
  assert.strictEqual(C.flow(s, '2026-12', '2026-10-21').lines.fixed, 0);
});

test('계좌 잔액: 은행앱 숫자 + 그 뒤 가계부 기록 + 날짜가 지난 고정비', () => {
  const s = base();
  s.fixed.push({ id: 'rent', name: '월세', amount: 300000, day: 25, pay: { type: 'account', id: 'a' } });
  s.records.push({ id: 'r1', type: 'expense', amount: 12000, date: '2026-10-21', from: { type: 'account', id: 'a' }, at: 2000 });
  s.records.push({ id: 'r0', type: 'expense', amount: 9999, date: '2026-10-19', from: { type: 'account', id: 'a' }, at: 500 }); // 확인 전 기록은 이미 포함
  assert.strictEqual(C.accountBalance(s, 'a', '2026-10-24'), 988000);
  assert.strictEqual(C.accountBalance(s, 'a', '2026-10-25'), 688000);
});

test('카드값 = 카드앱 확인액 + 확인 뒤 가계부 카드 사용 + 확인 뒤 청구될 고정비', () => {
  const s = base();
  s.fixed.push({ id: 'ott', name: 'OTT', amount: 10000, day: 3, pay: { type: 'card', id: 'c' } });
  s.fixed.push({ id: 'music', name: '음악', amount: 7000, day: 28, pay: { type: 'card', id: 'c' } });
  s.cards[0].app = { '2026-11': { amount: 500000, at: 3000, date: '2026-10-20' } };
  s.records.push({ id: 'x', type: 'expense', amount: 20000, date: '2026-10-21', from: { type: 'card', id: 'c' }, payMonth: '2026-11', at: 4000 });
  const b = C.cardBill(s, 'c', '2026-11');
  assert.strictEqual(b.total, 527000); // OTT는 10/3이라 확인액에 포함
  s.over['fixed:music:2026-11'] = { reflected: true }; // 음악이 카드앱에 보이면
  assert.strictEqual(C.cardBill(s, 'c', '2026-11').total, 520000);
});

test('카드앱 확인액이 없으면 아는 것을 모두 더함 (할부 포함)', () => {
  const s = base();
  s.fixed.push({ id: 'ott', name: 'OTT', amount: 10000, day: 3, pay: { type: 'card', id: 'c' } });
  s.installments.push({ id: 'i', name: '노트북', cardId: 'c', startMonth: '2026-10', months: 3, amount: 100000 });
  assert.strictEqual(C.cardBill(s, 'c', '2026-11').total, 110000);
  assert.strictEqual(C.cardBill(s, 'c', '2027-01').total, 10000);
});

test('카드대금이 출금되면 계좌에서 빠지고 이번 주기 카드값에 잡힘', () => {
  const s = base();
  s.cards[0].app = { '2026-11': { amount: 400000, at: 3000, date: '2026-10-20' } };
  assert.strictEqual(C.flow(s, '2026-11', '2026-10-21').lines.card, 400000);
  assert.strictEqual(C.accountBalance(s, 'a', '2026-11-14'), 1000000);
  assert.strictEqual(C.accountBalance(s, 'a', '2026-11-15'), 600000);
});

test('대출 납입일이 지나면 원금 부분만큼 잔액이 줄고, 가족 대납은 같은 날 들어옴', () => {
  const s = base();
  s.loans.push({ id: 'ln', bank: 'A', name: '신용대출', balance: 12000000, balanceDate: '2026-10-20', rate: 6, monthly: 300000, payDay: 26, accountId: 'a', familyPayer: '가족' });
  assert.strictEqual(C.loanBalance(s, s.loans[0], '2026-10-25').amount, 12000000);
  assert.strictEqual(C.loanBalance(s, s.loans[0], '2026-10-26').amount, 11760000); // 이자 60,000
  assert.strictEqual(C.accountBalance(s, 'a', '2026-10-26'), 1000000); // 나간 만큼 대납금이 들어옴
  const L = C.loanSummary(s, '2026-10-26');
  assert.strictEqual(L.monthlyFamily, 300000);
  assert.strictEqual(L.odTotal, 2000000);
});

test('마이너스통장은 남은 한도가 쓸 수 있는 돈', () => {
  const st = C.status(base(), '2026-10-21');
  assert.strictEqual(st.spendable, 1000000 + 3000000);
});

test('이번 급여로 버티면: 수입 − 카드값 − 고정비 − 대출 − 통장 지출', () => {
  const s = base();
  s.incomes.push({ id: 'sal', name: '급여', amount: 2500000, day: 25, accountId: 'a', salary: true });
  s.fixed.push({ id: 'rent', name: '월세', amount: 300000, day: 25, pay: { type: 'account', id: 'a' } });
  s.loans.push({ id: 'ln', name: '대출', balance: 1000000, monthly: 100000, payDay: 26, accountId: 'a' });
  s.cards[0].app = { '2026-11': { amount: 800000, at: 3000, date: '2026-10-20' } };
  s.records.push({ id: 'x', type: 'expense', amount: 50000, date: '2026-10-30', from: { type: 'account', id: 'a' }, at: 4000 });
  const f = C.flow(s, '2026-11', '2026-10-21');
  assert.strictEqual(f.left, 2500000 - 800000 - 300000 - 100000 - 50000);
});

test('정기 수입은 끝나는 달까지만', () => {
  const s = base();
  s.incomes.push({ id: 'x', name: '회수금', amount: 90000, day: 25, accountId: 'a', until: '2026-11' });
  assert.strictEqual(C.flow(s, '2026-11', '2026-10-21').lines.income, 90000);
  assert.strictEqual(C.flow(s, '2026-12', '2026-10-21').lines.income, 0);
});

test('갚을 돈 부분 정산: 남은 금액 = 금액 − 정산 합계', () => {
  const s = base();
  s.debts.push({ id: 'd', dir: 'pay', who: '친구', amount: 200000 });
  s.records.push({ id: 's', type: 'settle', debtId: 'd', amount: 50000, date: '2026-10-21', from: { type: 'account', id: 'a' }, at: 5000 });
  assert.strictEqual(C.debtStatus(s, s.debts[0]).left, 150000);
  assert.strictEqual(C.accountBalance(s, 'a', '2026-10-21'), 950000);
});

test('할부 월별 추이', () => {
  const s = base();
  s.installments.push({ id: 'i', name: 'TV', cardId: 'c', startMonth: '2026-11', months: 2, amounts: [60000, 40000] });
  const t = C.installmentTrend(s, '2026-11', 6);
  assert.deepStrictEqual(t.map((r) => r.total), [60000, 40000]);
});

test('고정비 기본요금과 기간 할인', () => {
  const s = base();
  // 가짜 숫자: 기본 50,000 · 통신사 2,000원 할인 11월까지 · 카드 청구할인 10%
  s.fixed.push({ id: 'ph', name: '통신비', amount: 0, base: 50000, discounts: [{ name: '통신사', amount: 2000, until: '2026-11' }, { name: '카드', pct: 10 }], day: 25, pay: { type: 'account', id: 'a' } });
  assert.strictEqual(C.fixedAmount(s.fixed[0], '2026-11'), 43200);
  assert.strictEqual(C.fixedAmount(s.fixed[0], '2026-12'), 45000);
  assert.strictEqual(C.flow(s, '2026-12', '2026-10-21').lines.fixed, 45000);
});

test('급여일이 주말·공휴일이면 앞 평일로 당겨요', () => {
  assert.strictEqual(C.bizBefore('2026-10-24'), '2026-10-23');
  assert.strictEqual(C.bizBefore('2026-09-24'), '2026-09-23');
  assert.strictEqual(C.bizBefore('2026-08-24'), '2026-08-24');
  const s = base(); s.settings.payDay = 24; s.settings.payShift = true;
  s.incomes.push({ id: 'i', name: '급여', amount: 2000000, day: 24, accountId: 'a', salary: true });
  const it = C.schedule(s, '2026-11', '2026-10-21').find((x) => x.src === 'income');
  assert.strictEqual(it.date, '2026-10-23');
  s.settings.payShift = false;
  assert.strictEqual(C.schedule(s, '2026-11', '2026-10-21').find((x) => x.src === 'income').date, '2026-10-24');
});

console.log('\n' + passed + '개 통과');
