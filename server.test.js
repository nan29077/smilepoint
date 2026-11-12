import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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

test('운영 모드: 기본 비밀번호 계정 잠금, 테스트 로그인 차단, 데이터 유지', async () => {
  const admin = await call('loginAs', { id: 'a1' });
  await call('addAnnouncement', { title: '재시작 확인', body: '유지' }, admin.cookie);
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
