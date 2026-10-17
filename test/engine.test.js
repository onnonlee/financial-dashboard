// 설계서 테스트 시나리오 9개 + 결정 규칙 검증. 실행: node test/engine.test.js
const assert = require('assert');
const E = require('../engine.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✔', name); }
  catch (e) { console.log('✘', name, '\n  ', e.message); process.exitCode = 1; }
}

// 기본 장부: 국민(합산), 토스(합산), 지역화폐, 삼성카드(15일 결제, 국민 출금)
function base() {
  const s = E.emptyState();
  s.accounts.push({ id: 'kb', name: '국민', kind: 'bank', include: true });
  s.accounts.push({ id: 'toss', name: '토스', kind: 'bank', include: true });
  s.accounts.push({ id: 'local', name: '지역화폐', kind: 'local', include: false });
  s.cards.push({ id: 'ss', name: '삼성카드', payDay: 15, accountId: 'kb' });
  s.balanceChecks.push({ id: 'b1', accountId: 'kb', amount: 3000000, at: 1000 });
  s.balanceChecks.push({ id: 'b2', accountId: 'toss', amount: 500000, at: 1000 });
  return s;
}
// 11월 결제분: 확인액 1,849,741 + 멜론(정기결제) 11,990 + 할부 109,000 (둘 다 미반영)
function samsung() {
  const s = base();
  s.recurring.push({ id: 'melon', name: '멜론', amount: 11990, day: 5, method: { type: 'card', id: 'ss' } });
  s.installments.push({ id: 'nb', name: '노트북 할부', cardId: 'ss', startPayMonth: '2026-09', months: 6, amount: 109000 });
  E.ensurePeriod(s, '2026-11', 2000); // 11월 주기(10/25~11/24): 멜론 11/5 → 12월 결제, 할부 11/15 결제분
  E.ensurePeriod(s, '2026-10', 2000); // 10월 주기: 멜론 10/5 → 11월 결제
  s.cardChecks.push({ id: 'c1', cardId: 'ss', payMonth: '2026-11', amount: 1849741, at: 3000 });
  return s;
}

test('① 확인액 1,849,741 + 미반영 120,990 = 1,970,731', () => {
  const b = E.cardBill(samsung(), 'ss', '2026-11');
  assert.strictEqual(b.pending, 120990);
  assert.strictEqual(b.total, 1970731);
});

test('② 멜론을 반영됨으로, 확인액 그대로 → 1,958,741', () => {
  const s = samsung();
  s.txns.find((t) => t.id === 'r:melon:2026-10').reflect = 'reflected';
  assert.strictEqual(E.cardBill(s, 'ss', '2026-11').total, 1958741);
});

test('③ 확인액도 1,861,731로 고치면 1,970,731 유지', () => {
  const s = samsung();
  s.txns.find((t) => t.id === 'r:melon:2026-10').reflect = 'reflected';
  s.cardChecks.push({ id: 'c2', cardId: 'ss', payMonth: '2026-11', amount: 1861731, at: 4000 });
  assert.strictEqual(E.cardBill(s, 'ss', '2026-11').total, 1970731);
});

test('④ 카드대금 100만 출금 → 계좌 −100만, 예상잔액 변화 0', () => {
  const s = base();
  s.cardChecks.push({ id: 'c1', cardId: 'ss', payMonth: '2026-10', amount: 1000000, at: 3000 });
  const today = '2026-10-10';
  const before = E.summary(s, today);
  s.txns.push({ id: 'pay', kind: 'cardPayment', cardId: 'ss', payMonth: '2026-10', amount: 1000000, date: '2026-10-15',
    status: 'done', from: { type: 'account', id: 'kb' }, recordedAt: 5000 });
  const after = E.summary(s, today);
  assert.strictEqual(E.accountBalance(s, 'kb').amount, 2000000);
  assert.strictEqual(after.forecast, before.forecast);
  assert.strictEqual(before.forecast, 2500000);
});

test('⑤ 국민 → 토스 20만 이체: 각 계좌만 바뀌고 합계·수입·지출 0', () => {
  const s = base();
  const before = E.summary(s, '2026-10-10');
  s.txns.push({ id: 'tr', kind: 'transfer', amount: 200000, date: '2026-10-12', status: 'done',
    from: { type: 'account', id: 'kb' }, to: { type: 'account', id: 'toss' }, recordedAt: 5000 });
  const after = E.summary(s, '2026-10-12');
  assert.strictEqual(E.accountBalance(s, 'kb').amount, 2800000);
  assert.strictEqual(E.accountBalance(s, 'toss').amount, 700000);
  assert.strictEqual(after.spendable, before.spendable);
  const f = E.flow(s, '2026-10');
  assert.strictEqual(f.income, 0);
  assert.strictEqual(f.spent, 0);
});

test('⑥ 같은 사람 받을 돈 30만, 갚을 돈 11만은 따로', () => {
  const s = base();
  s.people.push({ id: 'p', name: '민수' });
  s.debts.push({ id: 'd1', dir: 'recv', personId: 'p', principal: 300000 });
  s.debts.push({ id: 'd2', dir: 'pay', personId: 'p', principal: 110000 });
  const sm = E.summary(s, '2026-10-10');
  assert.strictEqual(sm.receivable, 300000);
  assert.strictEqual(sm.payable, 110000);
});

test('⑦ 9월 마감 후 기록을 고쳐도 스냅샷은 그대로', () => {
  const s = base();
  s.txns.push({ id: 'x', kind: 'expense', amount: 10000, date: '2026-09-10', status: 'done', from: { type: 'account', id: 'kb' }, recordedAt: 5000 });
  const snap = E.closePeriod(s, '2026-09', 6000, '2026-09-24');
  s.txns.find((t) => t.id === 'x').amount = 99999;
  assert.strictEqual(snap.flow.spent, 10000);
  assert.strictEqual(snap.txns.find((t) => t.id === 'x').amount, 10000);
  assert.ok(E.isClosed(s, '2026-09'));
});

test('⑧ 10월 급여주기 = 9/25 ~ 10/24', () => {
  const r = E.periodRange(base(), '2026-10');
  assert.deepStrictEqual(r, { start: '2026-09-25', end: '2026-10-24' });
  assert.strictEqual(E.periodOf(base(), '2026-09-25'), '2026-10');
  assert.strictEqual(E.periodOf(base(), '2026-10-24'), '2026-10');
});

test('⑨ 확인액에 포함된 할부(반영됨)는 다시 더하지 않음', () => {
  const s = samsung();
  s.txns.find((t) => t.id === 'i:nb:3').reflect = 'reflected';
  assert.strictEqual(E.cardBill(s, 'ss', '2026-11').total, 1849741 + 11990);
});

// ---- 결정 규칙 ----
test('M2 잔액 확인 이후 기록만 가감, 이전 기록은 포함으로 봄', () => {
  const s = base();
  s.txns.push({ id: 'a', kind: 'expense', amount: 9000, date: '2026-10-16', status: 'done', from: { type: 'account', id: 'kb' }, recordedAt: 900 });
  s.txns.push({ id: 'b', kind: 'expense', amount: 12000, date: '2026-10-16', status: 'done', from: { type: 'account', id: 'kb' }, recordedAt: 1100 });
  assert.strictEqual(E.accountBalance(s, 'kb').amount, 3000000 - 12000);
  assert.strictEqual(E.balanceGap(s, 'kb', 2985000), 2985000 - 2988000);
});

test('M1 카드 직접 사용은 확인 이후 기록만 더함', () => {
  const s = samsung();
  s.txns.push({ id: 'u1', kind: 'expense', amount: 6500, date: '2026-10-16', status: 'done', from: { type: 'card', id: 'ss' }, cardPayMonth: '2026-11', recordedAt: 2500 });
  s.txns.push({ id: 'u2', kind: 'expense', amount: 5490, date: '2026-10-15', status: 'done', from: { type: 'card', id: 'ss' }, cardPayMonth: '2026-11', recordedAt: 3500 });
  const b = E.cardBill(s, 'ss', '2026-11');
  assert.strictEqual(b.afterCheck, 5490);
  assert.strictEqual(b.total, 1970731 + 5490);
  assert.strictEqual(E.accountBalance(s, 'kb').amount, 3000000); // 카드 사용은 계좌 불변
});

test('M4 급여는 다음 주기 수입 (10/24 입금 → 11월 주기)', () => {
  const s = base();
  s.txns.push({ id: 'sal', kind: 'income', salary: true, amount: 3200000, date: '2026-10-24', status: 'done', to: { type: 'account', id: 'kb' }, recordedAt: 5000 });
  assert.strictEqual(E.txnPeriod(s, s.txns[0]), '2026-11');
  s.txns[0].date = '2026-10-25';
  assert.strictEqual(E.txnPeriod(s, s.txns[0]), '2026-11');
  assert.strictEqual(E.accountBalance(s, 'kb').amount, 6200000); // 잔액엔 바로 반영
});

test('M5 지역화폐는 쓸 수 있는 돈에서 빼고 따로', () => {
  const s = base();
  s.balanceChecks.push({ id: 'b3', accountId: 'local', amount: 82000, at: 1000 });
  const sm = E.summary(s, '2026-10-10');
  assert.strictEqual(sm.spendable, 3500000);
  assert.strictEqual(sm.localMoney, 82000);
});

test('M3 받을 돈은 예정일 + 스위치 켠 것만 예상잔액에', () => {
  const s = base();
  s.debts.push({ id: 'd1', dir: 'recv', principal: 150000, dueDate: '2026-10-20', includeInForecast: true });
  s.debts.push({ id: 'd2', dir: 'recv', principal: 70000, dueDate: '2026-10-20', includeInForecast: false });
  assert.strictEqual(E.summary(s, '2026-10-10').forecast, 3500000 + 150000);
});

test('M6 부분 정산: 잔여금 = 원금 − 정산 합계', () => {
  const s = base();
  s.debts.push({ id: 'd1', dir: 'recv', principal: 300000 });
  s.txns.push({ id: 's1', kind: 'settle', debtId: 'd1', amount: 100000, date: '2026-10-11', status: 'done', to: { type: 'account', id: 'kb' }, recordedAt: 5000 });
  const st = E.debtStatus(s, s.debts[0]);
  assert.strictEqual(st.remaining, 200000);
  assert.strictEqual(st.state, '부분정산');
  assert.strictEqual(E.accountBalance(s, 'kb').amount, 3100000);
});

test('P7 주기 시작 자동 생성은 몇 번 열어도 하나', () => {
  const s = samsung();
  const n = s.txns.length;
  E.ensurePeriod(s, '2026-10', 9000);
  E.ensurePeriod(s, '2026-11', 9000);
  assert.strictEqual(s.txns.length, n);
});

test('마감 이월: 완료 안 된 예정은 같은 기록이 다음 주기로 이동', () => {
  const s = base();
  s.txns.push({ id: 'p1', kind: 'expense', amount: 50000, date: '2026-09-20', status: 'planned', from: { type: 'account', id: 'kb' }, recordedAt: 5000 });
  E.closePeriod(s, '2026-09', 6000, '2026-09-24');
  assert.strictEqual(s.txns.length, 1);
  assert.strictEqual(E.txnPeriod(s, s.txns[0]), '2026-10');
  assert.strictEqual(s.txns[0].carriedFrom, '2026-09');
});

test('계좌 정기결제(월세)는 예상잔액에서 빠지고 카드 정기결제는 카드값에만', () => {
  const s = base();
  s.recurring.push({ id: 'rent', name: '월세', amount: 600000, day: 25, method: { type: 'account', id: 'kb' } });
  s.recurring.push({ id: 'melon', name: '멜론', amount: 11990, day: 5, method: { type: 'card', id: 'ss' } });
  E.ensurePeriod(s, '2026-11', 2000);
  const sm = E.summary(s, '2026-10-26');
  assert.strictEqual(sm.forecast, 3500000 - 600000);
});

test('캡처 중복 의심: 날짜+금액+가맹점', () => {
  const s = base();
  s.txns.push({ id: 'k', kind: 'expense', amount: 6500, date: '2026-10-16', memo: '김밥 천국', status: 'done' });
  assert.ok(E.findDuplicate(s, { date: '2026-10-16', amount: 6500, memo: '김밥천국' }));
  assert.ok(!E.findDuplicate(s, { date: '2026-10-16', amount: 6000, memo: '김밥천국' }));
});

console.log('\n' + passed + '개 통과');
