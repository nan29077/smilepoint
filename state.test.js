import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balances, exchange, freshState, order, partnerAvailable, roleTransactions, update, withdraw } from './state.js';

test('교환 대기 금액은 승인 시 한 번만 사용 가능 잔액으로 이동한다', () => {
  const state = freshState();
  const before = balances(state);
  const row = exchange(state, 'green', 4000);
  assert.equal(partnerAvailable(state, 'green'), 26000);
  assert.deepEqual(balances(state), { ...before, pending: before.pending + 2000 });
  update(state, row.id, 'partner', 'complete');
  assert.deepEqual(balances(state), { ...before, available: before.available + 2000 });
  assert.throws(() => update(state, row.id, 'admin', 'complete'));
});

test('웹하드 관리자는 자사 교환만 조회하고 처리할 수 있다', () => {
  const state = freshState();
  const other = exchange(state, 'cloud', 3000);
  const payout = withdraw(state, 5000);
  assert.ok(roleTransactions(state, 'partner').every(row => row.partner === 'green'));
  assert.throws(() => update(state, other.id, 'partner', 'complete'));
  assert.throws(() => update(state, payout.id, 'partner', 'complete'));
  update(state, other.id, 'admin', 'complete');
});

test('출금 반려·취소 시 잔액을 복원하고 지급 시 추가로 차감하지 않는다', () => {
  const state = freshState();
  const before = balances(state);
  const first = withdraw(state, 5000);
  assert.deepEqual(balances(state), { ...before, available: before.available - 5000, reserved: 5000 });
  update(state, first.id, 'user', 'canceled');
  assert.deepEqual(balances(state), before);
  const second = withdraw(state, 6000);
  update(state, second.id, 'admin', 'rejected');
  assert.deepEqual(balances(state), before);
  const third = withdraw(state, 5000);
  update(state, third.id, 'admin', 'complete');
  assert.deepEqual(balances(state), { ...before, available: before.available - 5000 });
});

test('최소 금액과 교환 단위를 검증하고 쿠폰 구매는 사용 가능 포인트를 차감한다', () => {
  const state = freshState();
  assert.throws(() => exchange(state, 'green', 2001));
  assert.throws(() => withdraw(state, 4999));
  const initial = balances(state).available;
  order(state, 'chicken');
  assert.equal(balances(state).available, initial - 18500);
  assert.throws(() => order(state, 'chicken'));
});
