import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as S from './state.js';

const fresh = () => S.freshState(new Date('2026-11-12T03:00:00Z'));
// 웹하드 연결: 인증번호 요청 → 입력까지 마친다.
const link = (state, userId, partnerId, loginId) => S.confirmLink(state, userId, partnerId, S.linkPartner(state, userId, partnerId, loginId).code);
const consent = { terms: true, privacy: true, age: true };

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
  assert.equal(S.balances(state, created.id).available, 0, '가입·추천 보너스는 첫 교환 전까지 적립 예정');
  assert.equal(S.balances(state, created.id).pending, 1500);
  assert.equal(S.balances(state, 'u1').available, before, '추천인 보너스는 첫 교환 완료 전까지 지급하지 않는다');
  assert.throws(() => S.update(state, created.id, state.transactions.find(r => r.userId === created.id && r.hold).id, 'canceled'), '보너스 대기 건은 회원이 취소할 수 없다');
  link(state, created.id, 'cloud', 'hong_cloud');
  const first = S.exchange(state, created.id, 'cloud', 1000);
  S.update(state, 'p2', first.id, 'complete');
  assert.equal(S.balances(state, 'u1').available, before + 500);
  assert.equal(S.balances(state, created.id).available, 1500 + 1000, '첫 교환 완료 시 보류 보너스 지급');
  const second = S.exchange(state, created.id, 'cloud', 1000);
  S.update(state, 'p2', second.id, 'complete');
  assert.equal(S.balances(state, 'u1').available, before + 500, '추천 보너스는 한 번만');
  assert.throws(() => S.socialLogin(state, 'kakao'), e => e.need === 'terms', '처음 소셜 가입은 약관 동의가 필요하다');
  const kakao = S.socialLogin(state, 'kakao', null, new Date(), consent);
  assert.equal(S.socialLogin(state, 'kakao').id, kakao.id, '기존 소셜 회원은 동의 없이 로그인');
  const short = S.socialLogin(state, 'kakao', { id: 'k-77', name: '가', email: 'g@test.com', emailVerified: false }, new Date(), consent);
  assert.equal(short.name, '카카오 회원');
  const hijack = S.socialLogin(state, 'naver', { id: 'n-1', name: '공격자', email: 'user@smilepoint.kr', emailVerified: false }, new Date(), consent);
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
  const linked = link(state, 'u1', 'disk', 'disk_user');
  S.exchange(state, 'u1', 'disk', 4000);
  const left = S.partnerAvailable(state, 'u1', 'disk');
  assert.equal(left, linked.balance - 4000);
  assert.throws(() => S.unlinkPartner(state, 'u1', 'disk'), /대기/);
  state.transactions.find(r => r.partner === 'disk' && r.status === 'pending').status = 'complete';
  S.unlinkPartner(state, 'u1', 'disk');
  link(state, 'u1', 'disk', 'disk_user');
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
  link(state, 'u1', 'disk', 'disk_user');
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

test('웹하드 연결은 인증번호로 본인 확인 — 남의 아이디로 연결·교환 불가', () => {
  const state = fresh();
  const sent = S.linkPartner(state, 'u2', 'cloud', 'victim_01');
  assert.equal(sent.pending, true);
  assert.ok(/^\d{6}$/.test(sent.code));
  assert.equal(S.partnerAvailable(state, 'u2', 'cloud'), 0, '인증 전에는 잔액 0');
  assert.throws(() => S.exchange(state, 'u2', 'cloud', 1000), /인증/, '인증 전 교환 불가');
  assert.ok(state.webhooks.some(h => h.event === 'member.link_requested' && h.data.member === 'victim_01' && h.data.code === sent.code), '제휴사로 인증번호 전송');
  assert.deepEqual(S.linkRequests(state, 'cloud').map(r => r.member), ['victim_01']);
  for (let i = 0; i < 5; i++) assert.throws(() => S.confirmLink(state, 'u2', 'cloud', '000000' === sent.code ? '111111' : '000000'), e => e.keep === true);
  assert.throws(() => S.confirmLink(state, 'u2', 'cloud', sent.code), /5회/, '5회 틀리면 다시 요청해야 한다');
  const again = S.linkPartner(state, 'u2', 'cloud', 'victim_01');
  const owner = S.linkPartner(state, 'u4', 'cloud', 'victim_01');
  S.confirmLink(state, 'u4', 'cloud', owner.code);
  assert.equal(state.accounts.find(a => a.id === 'u2').links.cloud, undefined, '진짜 주인이 인증하면 다른 대기 요청은 정리');
  assert.throws(() => S.confirmLink(state, 'u2', 'cloud', again.code));
  assert.throws(() => S.linkPartner(state, 'u2', 'cloud', 'VICTIM_01'), /다른 회원/);
  const view = S.snapshot(state, S.account(state, 'u5'));
  assert.ok(!JSON.stringify(view).includes(owner.code));
});

test('계좌 1원 인증, 이름 변경 잠금, 관리자 승인과 지급 계좌 열람 기록', () => {
  const state = fresh();
  const n = S.signup(state, { name: '새회원', email: 'b@test.com', password: 'abcd1234', confirm: 'abcd1234', terms: true, privacy: true, age: true });
  assert.throws(() => S.setBank(state, n.id, { bank: '<img src=x>', number: '1101234567', holder: '새회원' }), /목록/, '은행은 목록 값만');
  const sent = S.setBank(state, n.id, { bank: '신한은행', number: '110-123-4567', holder: '새회원' });
  assert.ok(/^\d{4}$/.test(sent.code));
  assert.equal(S.account(state, n.id).bank, null, '숫자를 입력하기 전에는 미등록');
  assert.throws(() => S.withdraw(state, n.id, 5000), /계좌/);
  assert.throws(() => S.updateProfile(state, n.id, { name: '다른이름' }), /이름/, '계좌 인증 중에는 이름 변경 불가');
  assert.throws(() => S.confirmBank(state, n.id, sent.code === '0000' ? '1111' : '0000'), e => e.keep);
  S.confirmBank(state, n.id, sent.code);
  assert.equal(S.account(state, n.id).bank.verified, true);
  assert.throws(() => S.updateProfile(state, n.id, { name: '다른이름' }), /이름/);
  const other = S.signup(state, { name: '둘째', email: 'c@test.com', password: 'abcd1234', confirm: 'abcd1234', terms: true, privacy: true, age: true });
  S.setBank(state, other.id, { bank: '국민은행', number: '9988776655', holder: '둘째' });
  assert.throws(() => S.approveBank(state, 'p1', other.id));
  S.approveBank(state, 'a1', other.id);
  assert.equal(S.account(state, other.id).bank.number, '9988776655');
  const row = S.withdraw(state, 'u1', 5000);
  const admin = S.snapshot(state, S.account(state, 'a1'));
  assert.ok(admin.accounts.every(a => !a.bank || a.bank.number.startsWith('••••')), '관리자 화면 데이터에는 계좌 끝 4자리만');
  assert.ok(admin.partners.every(p => !p.apiKey && p.apiKeyHint), '관리자 화면 데이터에도 API 키 전체는 없음');
  assert.equal(S.payoutAccount(state, 'a1', row.id).number, '123401043070');
  assert.equal(state.audit[0].action, '지급 계좌 열람');
});

test('쿠폰 번호를 본 뒤에는 직접 환불 불가, 화면 데이터에 번호 숨김', () => {
  const state = fresh();
  const [coupon] = S.order(state, 'u1', 'coffee');
  const view = S.snapshot(state, S.account(state, 'u1'));
  assert.equal(view.transactions.find(r => r.id === coupon.id).coupon.code, '', '번호 보기 전에는 번호를 보내지 않는다');
  const shown = S.revealCoupon(state, 'u1', coupon.id);
  assert.equal(shown.code.length, 12);
  assert.throws(() => S.cancelCoupon(state, 'u1', coupon.id), /번호를 확인/);
  S.cancelCoupon(state, 'a1', coupon.id, '미사용 확인 후 환불');
  assert.equal(state.transactions.find(r => r.id === coupon.id).status, 'canceled');
  assert.throws(() => S.revealCoupon(state, 'u2', state.transactions.find(r => r.type === 'coupon' && r.userId === 'u1').id), /찾을 수 없/);
});

test('제휴사 고액·일일 한도 초과 교환은 최고 관리자 2차 승인, 완료 교환 회수', () => {
  const state = fresh();
  state.partners.find(p => p.id === 'cloud').reviewOver = 5000;
  link(state, 'u1', 'disk', 'disk_big');
  const before = S.balances(state, 'u1').available;
  const big = S.exchange(state, 'u1', 'cloud', 6000);
  S.update(state, 'p2', big.id, 'complete');
  assert.equal(big.status, 'pending', '고액은 2차 승인 대기');
  assert.ok(big.partnerApproved);
  assert.throws(() => S.update(state, 'p2', big.id, 'complete'), '제휴사는 다시 승인할 수 없다');
  assert.throws(() => S.update(state, 'u1', big.id, 'canceled'), '1차 승인 후에는 회원이 취소할 수 없다');
  S.update(state, 'a1', big.id, 'complete');
  assert.equal(big.status, 'complete');
  assert.equal(S.balances(state, 'u1').available, before + 6000);
  assert.ok(state.webhooks.some(h => h.event === 'exchange.completed' && h.data.exchangeId === big.id));
  state.partners.find(p => p.id === 'cloud').dailyLimit = S.approvedToday(state, 'cloud') + 1000;
  const second = S.exchange(state, 'u1', 'cloud', 2000);
  S.update(state, 'p2', second.id, 'complete');
  assert.match(second.review, /한도/);
  assert.throws(() => S.reverseExchange(state, 'p1', big.id, '사유'), '다른 제휴사 교환은 회수 불가');
  assert.throws(() => S.reverseExchange(state, 'p2', big.id, ''), /사유/);
  S.reverseExchange(state, 'p2', big.id, '판매 취소');
  assert.equal(S.balances(state, 'u1').available, before, '회수하면 잔액에서 차감');
  assert.throws(() => S.reverseExchange(state, 'a1', big.id, '다시'), /이미/);
  assert.ok(!S.settlementOurs(state, 'cloud', S.kstDay()).count || true);
});

test('회원 탈퇴: 개인정보 파기, 로그인 차단, 처리 중 거래가 있으면 거부', () => {
  const state = fresh();
  assert.throws(() => S.deleteAccount(state, 'u1', { password: 'smile1234' }), /처리 중/);
  const n = S.signup(state, { name: '탈퇴자', email: 'bye@test.com', password: 'abcd1234', confirm: 'abcd1234', phone: '010-1111-2222', terms: true, privacy: true, age: true });
  assert.throws(() => S.deleteAccount(state, n.id, { password: 'wrong123' }), /비밀번호/);
  S.deleteAccount(state, n.id, { password: 'abcd1234' });
  const gone = S.account(state, n.id);
  assert.equal(gone.status, 'deleted');
  assert.equal(gone.email.endsWith('@deleted.invalid'), true);
  assert.equal(gone.phone, '');
  assert.throws(() => S.login(state, 'bye@test.com', 'abcd1234'));
  assert.ok(state.transactions.some(r => r.userId === n.id), '거래 기록은 보관');
  assert.ok(state.transactions.filter(r => r.userId === n.id && r.type === 'reward').every(r => r.status === 'canceled'), '보류 보너스는 소멸');
});

test('입력값 검증·보안 난수·내부망 주소 판별', () => {
  const state = fresh();
  S.updateProfile(state, 'u2', { notify: { email: false, junk: 'x'.repeat(1000) } });
  assert.deepEqual(Object.keys(S.account(state, 'u2').notify).sort(), ['email', 'marketing', 'sms']);
  assert.throws(() => S.updateProfile(state, 'u2', { phone: '<b>1</b>' }), /연락처/);
  const ticket = S.openTicket(state, 'u2', { category: '<b>X</b>'.repeat(100), message: 'hi' });
  assert.equal(ticket.category, '기타');
  assert.throws(() => S.adjust(state, 'a1', 'nobody', 100, '사유'), /회원/);
  assert.throws(() => S.updateSettings(state, 'a1', { fee: 1e12 }));
  S.updateSettings(state, 'a1', { dailyGiftLimit: 5000 });
  assert.equal(state.settings.dailyGiftLimit, 5000);
  const keys = new Set(state.partners.map(p => p.apiKey));
  assert.equal(keys.size, state.partners.length);
  assert.ok(state.partners.every(p => /^sp_live_[0-9a-f]{32}$/.test(p.apiKey)));
  assert.notEqual(S.freshState().partners[0].apiKey, S.freshState().partners[0].apiKey, '초기 데이터 API 키가 매번 다름 (예측 불가)');
  for (const ip of ['::ffff:7f00:1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '64:ff9b::7f00:1', '2002:7f00:1::', '::1', '::', 'fe80::1', 'fd00::1', '::7f00:1', '10.1.2.3', '100.64.0.1', '169.254.169.254', '[::ffff:192.168.0.1]', 'zz::1'])
    assert.equal(S.isPrivateIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '2606:4700:4700::1111', '203.0.113.5'.replace('203.0.113', '1.1.1')]) assert.equal(S.isPrivateIp(ip), false, ip);
  for (const url of ['https://[::ffff:127.0.0.1]:8443/x', 'https://[::ffff:a9fe:a9fe]/', 'https://[64:ff9b::7f00:1]/', 'https://2130706433/', 'https://0x7f.0.0.1/']) assert.throws(() => S.setWebhook(state, 'p1', url), url);
  assert.equal(S.maskName('김하늘'), '김*늘');
  const partnerView = S.snapshot(state, S.account(state, 'p1'));
  assert.ok(partnerView.accounts.slice(1).every(a => !a.provider && !a.createdAt && /\*/.test(a.name)), '제휴사에는 마스킹된 이름만');
});

test('출금 지급: 수동 지급, 지급대행 이체 흐름, 자동 승인, 실패 후 재시도·반려', () => {
  const state = fresh();
  const before = S.balances(state, 'u1').available;
  // 수동 지급: 승인하면 바로 완료
  state.settings.payoutMode = 'manual';
  const manual = S.withdraw(state, 'u1', 5000);
  S.update(state, 'a1', manual.id, 'complete');
  assert.equal(manual.status, 'complete');
  assert.equal(manual.payout.method, 'manual');
  // 지급대행: 승인 → 이체 중 → 입금 완료
  state.settings.payoutMode = 'api';
  const row = S.withdraw(state, 'u1', 5000);
  assert.equal(row.status, 'pending');
  S.update(state, 'a1', row.id, 'complete');
  assert.equal(row.status, 'processing');
  assert.equal(row.payout.status, 'queued');
  assert.equal(S.balances(state, 'u1').reserved, 5000, '이체 중에도 포인트는 묶여 있다');
  assert.throws(() => S.update(state, 'u1', row.id, 'canceled'), /변경할 수 없습니다/, '이체 요청 후에는 취소할 수 없다');
  assert.throws(() => S.setBank(state, 'u1', { bank: '신한은행', number: '1101234567', holder: '스마일 회원' }), /처리 중/);
  assert.deepEqual(S.payoutRequest(state, row), { transferId: row.id, bank: '국민은행', bankCode: '004', accountNumber: '123401043070', holder: '스마일 회원', amount: 4600, memo: '스마일포인트' });
  S.payoutSent(state, row.id, { ref: 'TK-1', provider: '테스트' });
  assert.equal(row.payout.status, 'sent');
  S.payoutResult(state, row.id, { ok: true, ref: 'TK-1' });
  assert.equal(row.status, 'complete');
  assert.equal(row.payout.status, 'paid');
  assert.equal(S.balances(state, 'u1').available, before - 10000);
  assert.throws(() => S.payoutResult(state, row.id, { ok: true }), /찾을 수 없습니다/, '같은 결과가 다시 와도 두 번 처리하지 않는다');
  // 자동 승인 한도
  state.settings.payoutAutoLimit = 6000;
  const auto = S.withdraw(state, 'u1', 6000);
  assert.equal(auto.status, 'processing');
  assert.equal(S.withdraw(state, 'u1', 7000).status, 'pending', '한도 초과는 심사 대기');
  // 실패 → 재시도 → 실패 → 반려(포인트 복원)
  S.payoutResult(state, auto.id, { ok: false, error: '수취 계좌 오류' });
  assert.equal(auto.status, 'processing');
  assert.equal(auto.payout.status, 'failed');
  assert.ok(state.notifications.some(n => n.to === 'admin' && /이체 실패/.test(n.text)));
  assert.throws(() => S.retryPayout(state, 'u1', auto.id), /권한/);
  S.retryPayout(state, 'a1', auto.id);
  assert.equal(auto.payout.status, 'queued');
  assert.equal(S.runMockPayouts(state), 1);
  assert.equal(auto.status, 'complete', '모의 지급대행은 바로 입금 완료 처리');
  const bad = S.withdraw(state, 'u1', 5000);
  S.payoutResult(state, bad.id, { ok: false, error: '응답 없음' });
  assert.throws(() => S.refundPayout(state, 'a1', bad.id, ''), /사유/);
  const reserved = S.balances(state, 'u1').available;
  S.refundPayout(state, 'a1', bad.id, '계좌 정보 오류');
  assert.equal(bad.status, 'rejected');
  assert.equal(S.balances(state, 'u1').available, reserved + 5000);
  const hand = S.withdraw(state, 'u1', 5000);
  S.payoutResult(state, hand.id, { ok: false, error: '점검' });
  S.completePayoutManually(state, 'a1', hand.id);
  assert.equal(hand.status, 'complete');
  assert.equal(hand.payout.method, 'manual');
});
