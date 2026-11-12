import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const dir = mkdtempSync(join(tmpdir(), 'smilepoint-'));
const port = 3900 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
let child;

function start(extra = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, WEBHOOK_DELIVERY: 'off', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', chunk => { if (String(chunk).includes('서버 http')) resolve(proc); });
    proc.on('exit', code => reject(new Error('server exited ' + code)));
    setTimeout(() => reject(new Error('timeout')), 8000);
  });
}
const stop = proc => new Promise(resolve => { proc.removeAllListeners('exit'); proc.once('exit', resolve); proc.kill(); });
async function call(op, payload = {}, cookie = '') {
  const response = await fetch(base + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SmilePoint': '1', cookie }, body: JSON.stringify({ op, payload }) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie };
}

const db = () => JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8'));
const state = async cookie => (await (await fetch(base + '/api/state', { headers: { cookie } })).json()).state;
// 테스트용 TOTP 계산 (RFC 6238)
function totp(secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0; const bytes = [];
  for (const c of secret) { value = (value << 5) | alphabet.indexOf(c); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(msg).digest();
  return String((h.readUInt32BE(h[19] & 15) & 0x7fffffff) % 1e6).padStart(6, '0');
}

before(async () => { child = await start(); });
after(async () => { if (child) await stop(child); rmSync(dir, { recursive: true, force: true }); });

test('서버 상태와 로그인 세션', async () => {
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.mode, 'server');
  assert.equal((await call('login', { email: 'user@smilepoint.kr', password: 'nope' })).status, 401);
  const ok = await call('login', { email: 'user@smilepoint.kr', password: 'smile1234' });
  assert.equal(ok.status, 200);
  assert.match(ok.cookie, /^sp_sid=/);
  const state = (await (await fetch(base + '/api/state', { headers: { cookie: ok.cookie } })).json()).state;
  assert.equal(state.session.accountId, 'u1');
  assert.ok(state.transactions.every(row => row.userId === 'u1'));
  assert.ok(!JSON.stringify(state).includes('scrypt$'));
  const stored = JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8'));
  assert.match(stored.accounts[0].password, /^scrypt\$/);
});

test('권한 검사와 요청 위조 방지', async () => {
  const user = await call('loginAs', { id: 'u1' });
  assert.equal((await call('adjust', { userId: 'u2', amount: 100, reason: 'x' }, user.cookie)).status, 403);
  assert.equal((await call('exchange', { partnerId: 'green', amount: 4000 })).status, 401);
  const forged = await fetch(base + '/api/action', { method: 'POST', headers: { 'Content-Type': 'text/plain', cookie: user.cookie }, body: JSON.stringify({ op: 'attend' }) });
  assert.equal(forged.status, 403);
  const partner = await call('loginAs', { id: 'p1' });
  const snap = (await (await fetch(base + '/api/state', { headers: { cookie: partner.cookie } })).json()).state;
  assert.ok(snap.transactions.every(row => row.partner === 'green'));
  assert.ok(snap.partners.filter(p => p.apiKey).length === 1);
});

test('웹하드 제휴사 API: 키 인증, 조회, 승인', async () => {
  const user = await call('loginAs', { id: 'u1' });
  const requested = await call('exchange', { partnerId: 'green', amount: 2000 }, user.cookie);
  assert.equal(requested.status, 200);
  const key = JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8')).partners.find(p => p.id === 'green').apiKey;
  assert.equal((await fetch(base + '/api/v1/exchanges', { headers: { 'X-Api-Key': 'bad' } })).status, 401);
  const list = await (await fetch(base + '/api/v1/exchanges?status=pending', { headers: { 'X-Api-Key': key } })).json();
  assert.ok(list.data.some(row => row.id === requested.body.result.id));
  const approved = await fetch(`${base}/api/v1/exchanges/${requested.body.result.id}/approve`, { method: 'POST', headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal((await approved.json()).data.status, 'complete');
  const other = JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8')).partners.find(p => p.id === 'cloud').apiKey;
  assert.equal((await fetch(`${base}/api/v1/exchanges/${requested.body.result.id}/approve`, { method: 'POST', headers: { 'X-Api-Key': other } })).status, 404);
});

test('사진 주소 분리, 비밀번호 변경 시 다른 기기 로그아웃', async () => {
  const pc = await call('login', { email: 'user@smilepoint.kr', password: 'smile1234' });
  const phone = await call('login', { email: 'user@smilepoint.kr', password: 'smile1234' });
  const photo = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
  const saved = await call('setPhoto', { photo }, pc.cookie);
  const me = saved.body.state.accounts.find(a => a.id === 'u1');
  assert.equal(me.photo, '');
  assert.match(me.photoUrl, /^\.\/api\/photo\/u1\?v=/);
  assert.equal((await fetch(base + '/api/photo/u1', { headers: { cookie: pc.cookie } })).status, 200);
  assert.equal((await fetch(base + '/api/photo/u1')).status, 404);
  const other = await call('loginAs', { id: 'u2' });
  assert.equal((await fetch(base + '/api/photo/u1', { headers: { cookie: other.cookie } })).status, 404);
  assert.equal((await call('changePassword', { before: 'smile1234', after: 'newpass123' }, pc.cookie)).status, 200);
  const phoneState = (await (await fetch(base + '/api/state', { headers: { cookie: phone.cookie } })).json()).state;
  assert.equal(phoneState.session, null, '다른 기기 세션은 끊긴다');
  const pcState = (await (await fetch(base + '/api/state', { headers: { cookie: pc.cookie } })).json()).state;
  assert.equal(pcState.session.accountId, 'u1', '변경한 기기는 유지');
  await call('changePassword', { before: 'newpass123', after: 'smile1234' }, pc.cookie);
});

test('비밀번호 재설정, 정산 확인 API, 점검 모드', async () => {
  const unknown = await call('requestReset', { email: 'nobody@test.com' });
  assert.deepEqual(unknown.body.result, { sent: true });
  const known = await call('requestReset', { email: 'partner@smilepoint.kr' });
  const token = known.body.result.link.split('#reset/')[1];
  assert.ok(token);
  assert.equal((await call('resetWithToken', { token, password: 'short' })).status, 400);
  assert.equal((await call('resetWithToken', { token, password: 'smile1234' })).status, 200);
  const db = JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8'));
  const key = db.partners.find(p => p.id === 'green').apiKey;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const confirm = await fetch(`${base}/api/v1/settlements/${today}`, { method: 'POST', headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 999, amount: 1 }) });
  assert.equal((await confirm.json()).status, 'mismatch');
  const admin = await call('loginAs', { id: 'a1' });
  await call('updateSettings', { maintenance: true }, admin.cookie);
  const user = await call('loginAs', { id: 'u1' });
  assert.equal((await call('attend', {}, user.cookie)).status, 503);
  assert.equal((await call('updateProfile', { name: '스마일 회원' }, user.cookie)).status, 200, '점검 중에도 프로필은 가능');
  await call('updateSettings', { maintenance: false }, admin.cookie);
  assert.equal((await call('setWebhook', { url: 'https://127.0.0.1/hook' }, await call('loginAs', { id: 'p1' }).then(r => r.cookie))).status, 400);
});

test('깨진 쿠키·비ASCII API 키·잘못된 본문은 500이 아니다', async () => {
  assert.equal((await fetch(base + '/api/state', { headers: { cookie: 'sp_sid=%E0%A4%A' } })).status, 200);
  assert.equal((await fetch(base + '/api/v1/exchanges', { headers: { 'X-Api-Key': 'sp_live_' + 'é'.repeat(24) } })).status, 401);
  const bad = await fetch(base + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SmilePoint': '1' }, body: '[1,2]' });
  assert.equal(bad.status, 400);
  assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);
});

test('중복 제출 차단, 실패 요청 되돌리기, 인증번호 오입력 횟수 유지', async () => {
  const user = await call('loginAs', { id: 'u1' });
  const [a, b] = await Promise.all([call('order', { productId: 'coffee', quantity: 1 }, user.cookie), call('order', { productId: 'coffee', quantity: 1 }, user.cookie)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], '같은 주문은 한 번만');
  assert.equal(a.status === 200 ? a.body.result[0].coupon.code : b.body.result[0].coupon.code, '', '구매 응답에도 쿠폰 번호를 보내지 않는다');
  const sent = await call('linkPartner', { partnerId: 'file', loginId: 'u1_file_id' }, user.cookie);
  assert.equal(sent.status, 200);
  const code = sent.body.result.code; // 데모 모드에서만 화면에 돌려준다
  assert.match(code, /^\d{6}$/);
  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal((await call('confirmLink', { partnerId: 'file', code: wrong }, user.cookie)).status, 400);
  assert.equal(db().accounts.find(x => x.id === 'u1').links.file.pending.attempts, 1, '틀린 횟수는 실패해도 저장');
  const before = db().transactions.length;
  assert.equal((await call('withdraw', { amount: 999999999 }, user.cookie)).status, 400);
  assert.equal(db().transactions.length, before, '실패한 요청은 원장에 남지 않는다');
  const ok = await call('confirmLink', { partnerId: 'file', code }, user.cookie);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.state.accounts[0].links.file.verified, true);
});

test('운영진 2단계 인증: 설정 → 로그인 시 코드 필요', async () => {
  const partner = await call('login', { email: 'cloud@smilepoint.kr', password: 'smile1234' });
  const setup = await call('setupTotp', {}, partner.cookie);
  assert.equal(setup.status, 200);
  const secret = setup.body.result.secret;
  assert.ok(!JSON.stringify(await state(partner.cookie)).includes(secret), '비밀키는 화면 데이터에 없다');
  assert.equal((await call('enableTotp', { code: '000000' === totp(secret) ? '111111' : '000000' }, partner.cookie)).status, 400);
  assert.equal((await call('enableTotp', { code: totp(secret) }, partner.cookie)).status, 200);
  const need = await call('login', { email: 'cloud@smilepoint.kr', password: 'smile1234' });
  assert.equal(need.status, 401);
  assert.equal(need.body.need, 'otp');
  const ok = await call('login', { email: 'cloud@smilepoint.kr', password: 'smile1234', otp: totp(secret, Date.now() + 30000) });
  assert.equal(ok.status, 200);
  const replay = await call('login', { email: 'cloud@smilepoint.kr', password: 'smile1234', otp: totp(secret, Date.now() + 30000) });
  assert.equal(replay.status, 401, '한 번 쓴 코드는 다시 쓸 수 없다');
});

test('제휴사 API: 페이지 나누기, 연결 인증번호 조회, 교환 회수', async () => {
  const key = db().partners.find(p => p.id === 'green').apiKey;
  const page = await (await fetch(base + '/api/v1/exchanges?limit=2&offset=0', { headers: { 'X-Api-Key': key } })).json();
  assert.equal(page.data.length, 2);
  assert.equal(page.next, 2);
  const user = await call('login', { email: 'haneul@example.com', password: 'smile1234' });
  const linkSent = await call('linkPartner', { partnerId: 'disk', loginId: 'haneul_disk' }, user.cookie);
  assert.equal(linkSent.status, 200, JSON.stringify(linkSent.body.error));
  const diskKey = db().partners.find(p => p.id === 'disk').apiKey;
  const requests = await (await fetch(base + '/api/v1/link-requests', { headers: { 'X-Api-Key': diskKey } })).json();
  assert.ok(requests.data.some(r => r.member === 'haneul_disk' && /^\d{6}$/.test(r.code)));
  const done = db().transactions.find(r => r.type === 'exchange' && r.partner === 'green' && r.status === 'complete' && !r.reversed);
  const rev = await fetch(`${base}/api/v1/exchanges/${done.id}/reverse`, { method: 'POST', headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: '판매 취소' }) });
  assert.equal(rev.status, 200);
  assert.ok((await rev.json()).data.reversed);
  assert.ok(db().transactions.some(r => r.type === 'reversal' && r.ref === done.id));
});

test('로그인 대입 제한: 이메일을 바꿔도 같은 IP는 막힌다', async () => {
  let last;
  for (let i = 0; i < 31; i++) last = await call('login', { email: `spray${i}@x.io`, password: 'zzzz1111' });
  assert.equal(last.status, 429);
});

test('운영 모드: 기본 비밀번호 계정 잠금, 테스트 로그인 차단, 데이터 유지', async () => {
  const admin = await call('loginAs', { id: 'a1' });
  await call('addAnnouncement', { title: '재시작 확인', body: '유지' }, admin.cookie);
  const demoKey = db().partners.find(p => p.id === 'green').apiKey;
  await stop(child);
  child = await start({ DEMO_MODE: 'off', ADMIN_PASSWORD: 'Owner2026pass' });
  assert.equal((await call('loginAs', { id: 'u1' })).status, 403);
  assert.notEqual((await call('login', { email: 'user@smilepoint.kr', password: 'smile1234' })).status, 200, '기본 비밀번호 계정은 잠긴다');
  const old = (await (await fetch(base + '/api/state', { headers: { cookie: admin.cookie } })).json()).state;
  assert.equal(old.session, null, '잠긴 계정의 기존 세션도 무효');
  const owner = await call('login', { email: 'admin@smilepoint.kr', password: 'Owner2026pass' });
  assert.equal(owner.status, 200);
  assert.equal(owner.body.state.announcements[0].title, '재시작 확인');
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.demo, false);
  assert.equal((await fetch(base + '/api/v1/exchanges', { headers: { 'X-Api-Key': demoKey } })).status, 401, '데모 때의 API 키는 운영 전환 시 폐기');
  assert.equal((await call('socialDemo', { provider: 'kakao', terms: true, privacy: true, age: true })).status, 403);
  const reset = await call('requestReset', { email: 'admin@smilepoint.kr' });
  assert.deepEqual(reset.body.result, { sent: true }, '운영에서는 재설정 링크를 화면에 주지 않는다');
});

test('외부 주소(HOST=0.0.0.0)로 열면 DEMO_MODE를 적지 않는 한 운영 모드', async () => {
  const otherDir = mkdtempSync(join(tmpdir(), 'smilepoint-host-'));
  const otherPort = port + 2;
  const proc = await new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(otherPort), HOST: '0.0.0.0', DATA_DIR: otherDir, ADMIN_PASSWORD: 'Owner2026pass', WEBHOOK_DELIVERY: 'off' };
    delete env.DEMO_MODE;
    const p = spawn(process.execPath, ['server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', chunk => { if (String(chunk).includes('서버 http')) resolve(p); });
    setTimeout(() => reject(new Error('timeout')), 8000);
  });
  try {
    const health = await (await fetch(`http://127.0.0.1:${otherPort}/api/health`)).json();
    assert.equal(health.demo, false);
    const test = await fetch(`http://127.0.0.1:${otherPort}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SmilePoint': '1' }, body: JSON.stringify({ op: 'loginAs', payload: { id: 'a1' } }) });
    assert.equal(test.status, 403);
  } finally { await stop(proc); rmSync(otherDir, { recursive: true, force: true }); }
});

test('운영 모드 첫 실행: 샘플 없이 최고 관리자만 생성', async () => {
  const prodDir = mkdtempSync(join(tmpdir(), 'smilepoint-prod-'));
  const prodPort = port + 1;
  const proc = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(prodPort), DATA_DIR: prodDir, DEMO_MODE: 'off', ADMIN_EMAIL: 'owner@test.com', ADMIN_PASSWORD: 'Owner2026pass', WEBHOOK_DELIVERY: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', chunk => { if (String(chunk).includes('서버 http')) resolve(p); });
    setTimeout(() => reject(new Error('timeout')), 8000);
  });
  try {
    const db = JSON.parse(readFileSync(join(prodDir, 'db.json'), 'utf8'));
    assert.equal(db.accounts.length, 1);
    assert.equal(db.accounts[0].email, 'owner@test.com');
    assert.equal(db.transactions.length, 0);
    assert.equal(db.settings.mockWebhardBalance, false);
  } finally { await stop(proc); rmSync(prodDir, { recursive: true, force: true }); }
});
