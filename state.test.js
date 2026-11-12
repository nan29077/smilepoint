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
  assert.equal(S.balances(state, 'u1').available, before, '추천인 보너스는 첫 교환 완료 전까지 지급하지 않는다');
  S.linkPartner(state, created.id, 'cloud', 'hong_cloud');
  const first = S.exchange(state, created.id, 'cloud', 1000);
  S.update(state, 'p2', first.id, 'complete');
  assert.equal(S.balances(state, 'u1').available, before + 500);
  const second = S.exchange(state, created.id, 'cloud', 1000);
  S.update(state, 'p2', second.id, 'complete');
  assert.equal(S.balances(state, 'u1').available, before + 500, '추천 보너스는 한 번만');
  const kakao = S.socialLogin(state, 'kakao');
  assert.equal(S.socialLogin(state, 'kakao').id, kakao.id);
  const short = S.socialLogin(state, 'kakao', { id: 'k-77', name: '가', email: 'g@test.com', emailVerified: false });
  assert.equal(short.name, '카카오 회원');
  const hijack = S.socialLogin(state, 'naver', { id: 'n-1', name: '공격자', email: 'user@smilepoint.kr', emailVerified: false });
  assert.notEqual(hijack.id, 'u1', '미인증 이메일로 기존 계정에 연결하지 않는다');
  assert.equal(S.socialLogin(state, 'google', { id: 'g-1', name: '본인', email: 'user@smilepoint.kr', emailVerified: true }).id, 'u1');
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

test('관리자: 운영진·제휴사·상품 생성과 역할별 스냅샷', () => {
  const state = fresh();
  const staff = S.createStaff(state, 'a1', { role: 'partner', partnerId: 'file', name: '담당자', email: 'f@test.com', password: 'abcd1234' });
  assert.equal(S.login(state, 'f@test.com', 'abcd1234').id, staff.id);
  assert.throws(() => S.createStaff(state, 'u1', { role: 'admin', name: '해커', email: 'h@test.com', password: 'abcd1234' }));
  assert.throws(() => S.setStaffStatus(state, 'a1', 'a1', 'suspended'));
  const temp = S.resetPassword(state, 'a1', 'p1');
  assert.equal(S.login(state, 'partner@smilepoint.kr', temp).id, 'p1');
  const partner = S.createPartner(state, 'a1', { name: '스카이파일', divisor: 3, min: 3000 });
  assert.equal(partner.active, false);
  S.createProduct(state, 'a1', { name: '버블티', brand: '티하우스', category: '카페', cost: 5500, stock: 10 });
  const userView = S.snapshot(state, S.account(state, 'u1'));
  assert.ok(userView.transactions.every(row => row.userId === 'u1'));
  assert.ok(userView.partners.every(p => !p.apiKey));
  assert.equal(userView.accounts[0].password, 'set');
  const anon = S.snapshot(state, null);
  assert.equal(anon.accounts.length, 0);
});

test('웹하드 연결: 재연결로 잔액이 늘지 않고 아이디는 한 회원만', () => {
  const state = fresh();
  const linked = S.linkPartner(state, 'u1', 'disk', 'disk_user');
  S.exchange(state, 'u1', 'disk', 4000);
  const left = S.partnerAvailable(state, 'u1', 'disk');
  assert.equal(left, linked.balance - 4000);
  assert.throws(() => S.unlinkPartner(state, 'u1', 'disk'), /대기/);
  state.transactions.find(r => r.partner === 'disk' && r.status === 'pending').status = 'complete';
  S.unlinkPartner(state, 'u1', 'disk');
  S.linkPartner(state, 'u1', 'disk', 'disk_user');
  assert.equal(S.partnerAvailable(state, 'u1', 'disk'), left);
  assert.throws(() => S.linkPartner(state, 'u2', 'cloud', 'SMILE_CLOUD'), /다른 회원/);
  state.settings.mockWebhardBalance = false;
  assert.equal(S.partnerAvailable(state, 'u1', 'disk'), null);
  S.exchange(state, 'u1', 'disk', 400000);
});

test('선물·계좌 악용 방지와 쿠폰 취소', () => {
  const state = fresh();
  const n = S.signup(state, { name: '새회원', email: 'n2@test.com', password: 'abcd1234', confirm: 'abcd1234', terms: true, privacy: true, age: true });
  assert.throws(() => S.gift(state, n.id, 'user@smilepoint.kr', 1000), /교환을 1회/);
  assert.throws(() => S.gift(state, 'u1', 'nobody@test.com', 1000), /선물할 수 없는 이메일/);
  assert.throws(() => S.gift(state, 'u1', 'siwoo@example.com', 1000), /선물할 수 없는 이메일/);
  state.settings.dailyGiftLimit = 1500;
  S.gift(state, 'u1', 'haneul@example.com', 1000);
  assert.throws(() => S.gift(state, 'u1', 'haneul@example.com', 1000), /한도/);
  assert.throws(() => S.setBank(state, n.id, { bank: '국민은행', number: '123401043070', holder: '새회원' }), /다른 계정/);
  const before = S.balances(state, 'u1').available;
  const [coupon] = S.order(state, 'u1', 'coffee');
  const stock = state.products.find(p => p.id === 'coffee').stock;
  S.cancelCoupon(state, 'u1', coupon.id);
  assert.equal(S.balances(state, 'u1').available, before);
  assert.equal(state.products.find(p => p.id === 'coffee').stock, stock + 1);
  assert.throws(() => S.cancelCoupon(state, 'u1', coupon.id), /이미/);
  const used = state.transactions.find(r => r.type === 'coupon' && r.coupon?.used);
  assert.throws(() => S.cancelCoupon(state, 'a1', used.id, '사유'), /사용한/);
});

test('이벤트 적립·정산 대사·비밀번호 재설정·웹훅 주소 검증', () => {
  const state = fresh();
  S.linkPartner(state, 'u1', 'disk', 'disk_user');
  const row = S.exchange(state, 'u1', 'disk', 4000);
  const before = S.balances(state, 'u1').available;
  S.update(state, 'a1', row.id, 'complete');
  assert.equal(S.balances(state, 'u1').available, before + 1000 + 50, '1,000 P + 첫 교환 5% 보너스');
  const again = S.exchange(state, 'u1', 'disk', 4000);
  S.update(state, 'a1', again.id, 'complete');
  assert.equal(S.balances(state, 'u1').available, before + 2050, '두 번째 교환에는 보너스 없음');
  const date = S.kstDay();
  const ours = S.settlementOurs(state, 'disk', date);
  assert.equal(S.confirmSettlement(state, 'disk', date, ours).status, 'match');
  assert.equal(S.confirmSettlement(state, 'disk', date, { count: ours.count, amount: ours.amount + 100 }).status, 'mismatch');
  assert.ok(state.notifications.some(n => n.to === 'admin' && /불일치/.test(n.text)));
  const req = S.requestReset(state, 'user@smilepoint.kr');
  assert.equal(S.requestReset(state, 'nobody@test.com'), null);
  assert.throws(() => S.resetWithToken(state, 'wrong-token-value-123', 'newpass123'));
  S.resetWithToken(state, req.token, 'newpass123');
  assert.equal(S.login(state, 'user@smilepoint.kr', 'newpass123').id, 'u1');
  assert.throws(() => S.resetWithToken(state, req.token, 'another123'), /만료/);
  for (const url of ['https://localhost/x', 'https://10.0.0.5/h', 'https://169.254.169.254/latest', 'http://example.com/h', 'https://a:b@example.com/']) assert.throws(() => S.setWebhook(state, 'p1', url));
  S.setWebhook(state, 'p1', 'https://hooks.example.com/smile');
  assert.ok(!('resets' in S.snapshot(state, S.account(state, 'a1'))));
});
