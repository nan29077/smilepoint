import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as S from './state.js';

const fresh = () => S.freshState(new Date('2026-11-12T03:00:00Z'));

test('테스트 계정·이메일 로그인과 정지 계정 차단', () => {
  const state = fresh();
  assert.throws(() => S.login(state, 'user@smilepoint.kr', 'wrong'));
  assert.equal(S.login(state, 'USER@smilepoint.kr', 'smile1234').id, 'u1');
  assert.equal(S.current(state).role, 'user');
  S.logout(state);
  assert.equal(S.current(state), null);
  assert.equal(S.loginAs(state, 'a1').role, 'admin');
  assert.throws(() => S.loginAs(state, 'u8'), /정지/);
});

test('회원가입: 약관·비밀번호 검증, 가입·추천 보너스, 소셜 로그인 재사용', () => {
  const state = fresh();
  const base = { name: '홍길동', email: 'hong@test.com', password: 'abcd1234', confirm: 'abcd1234', terms: true, privacy: true, age: true };
  assert.throws(() => S.signup(state, { ...base, age: false }), /약관/);
  assert.throws(() => S.signup(state, { ...base, password: 'short', confirm: 'short' }));
  assert.throws(() => S.signup(state, { ...base, email: 'user@smilepoint.kr' }), /이미/);
  const before = S.balances(state, 'u1').available;
  const created = S.signup(state, { ...base, referral: 'smile3070' });
  assert.equal(S.balances(state, created.id).available, 1500);
  assert.equal(S.balances(state, 'u1').available, before + 500);
  const kakao = S.socialLogin(state, 'kakao');
  assert.equal(S.socialLogin(state, 'kakao').id, kakao.id);
});

test('교환 대기는 승인 시 한 번만 적립되고 웹하드 관리자는 자사 거래만 처리한다', () => {
  const state = fresh();
  const before = S.balances(state, 'u1');
  const row = S.exchange(state, 'u1', 'green', 4000);
  assert.equal(S.balances(state, 'u1').pending, before.pending + 2000);
  assert.throws(() => S.update(state, 'p2', row.id, 'complete'));
  S.update(state, 'p1', row.id, 'complete');
  assert.equal(S.balances(state, 'u1').available, before.available + 2000);
  assert.throws(() => S.update(state, 'a1', row.id, 'complete'));
  assert.ok(S.visibleTransactions(state, S.account(state, 'p1')).every(r => r.partner === 'green'));
  assert.throws(() => S.exchange(state, 'u1', 'green', 2001));
  assert.throws(() => S.exchange(state, 'u1', 'file', 2000), /연결/);
});

test('출금: 등급 수수료, 반려 사유 필수, 반려·취소 시 복원', () => {
  const state = fresh();
  const before = S.balances(state, 'u1');
  const first = S.withdraw(state, 'u1', 5000);
  assert.equal(first.fee, 400); // 실버 등급
  assert.equal(S.balances(state, 'u1').reserved, 5000);
  S.update(state, 'u1', first.id, 'canceled');
  assert.deepEqual(S.balances(state, 'u1'), before);
  const second = S.withdraw(state, 'u1', 6000);
  assert.throws(() => S.update(state, 'a1', second.id, 'rejected'), /사유/);
  S.update(state, 'a1', second.id, 'rejected', '계좌 확인 필요');
  assert.equal(S.balances(state, 'u1').available, before.available);
  assert.throws(() => S.withdraw(state, 'u1', 4999));
  const signup = S.signup(state, { name: '새회원', email: 'n@test.com', password: 'abcd1234', confirm: 'abcd1234', terms: true, privacy: true, age: true });
  assert.throws(() => S.withdraw(state, signup.id, 5000), /계좌/);
  assert.throws(() => S.setBank(state, signup.id, { bank: '신한은행', number: '1101234567', holder: '다른이름' }), /예금주/);
});

test('쿠폰 구매·출석·선물·관리자 조정', () => {
  const state = fresh();
  const start = S.balances(state, 'u1').available;
  const stock = state.products.find(p => p.id === 'coffee').stock;
  S.order(state, 'u1', 'coffee', 2);
  assert.equal(S.balances(state, 'u1').available, start - 9000);
  assert.equal(state.products.find(p => p.id === 'coffee').stock, stock - 2);
  const now = new Date('2026-11-12T03:00:00Z');
  const result = S.attend(state, 'u1', now);
  assert.equal(result.count, 4);
  assert.throws(() => S.attend(state, 'u1', now), /이미/);
  S.gift(state, 'u1', 'haneul@example.com', 1000);
  assert.throws(() => S.gift(state, 'u1', 'user@smilepoint.kr', 1000));
  assert.throws(() => S.adjust(state, 'p1', 'u2', 100, '테스트'));
  S.adjust(state, 'a1', 'u2', -500, '오류 정정');
  assert.equal(state.audit[0].action, '포인트 조정');
});
