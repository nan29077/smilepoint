// 지급대행 API 연동 검증: 가짜 지급대행 서버를 띄우고 이체 요청 → 결과 통지(웹훅)까지 확인한다.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const dir = mkdtempSync(join(tmpdir(), 'smilepoint-payout-'));
const port = 4500 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;
const secret = 'whsec_test';
const received = [];
let reply = () => ({ code: 200, body: { status: 'ACCEPTED', transferKey: 'TK-' + received.length } });
let child, provider;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function call(op, payload = {}, cookie = '') {
  const response = await fetch(base + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SmilePoint': '1', cookie }, body: JSON.stringify({ op, payload }) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie };
}
const rowOf = async (cookie, id) => (await (await fetch(base + '/api/state', { headers: { cookie } })).json()).state.transactions.find(row => row.id === id);
async function until(check, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) { const value = await check(); if (value) return value; }
  throw new Error('시간 초과');
}
function webhook(body, signature) {
  const raw = JSON.stringify(body);
  return fetch(base + '/api/payout/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Payout-Signature': signature ?? 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex') }, body: raw });
}

before(async () => {
  provider = createServer((request, response) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      received.push({ method: request.method, url: request.url, headers: request.headers, body: raw ? JSON.parse(raw) : null });
      const { code, body } = reply();
      response.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    });
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  child = await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, WEBHOOK_DELIVERY: 'off', PAYOUT_PROVIDER_NAME: '테스트페이', PAYOUT_API_URL: `http://127.0.0.1:${provider.address().port}/v1`, PAYOUT_API_KEY: 'pk_test', PAYOUT_API_SECRET: 'sk_test', PAYOUT_WEBHOOK_SECRET: secret }, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', chunk => { if (String(chunk).includes('서버 http')) resolve(proc); });
    proc.on('exit', code => reject(new Error('server exited ' + code)));
    setTimeout(() => reject(new Error('timeout')), 8000);
  });
});
after(async () => {
  if (child) await new Promise(resolve => { child.removeAllListeners('exit'); child.once('exit', resolve); child.kill(); });
  provider?.close();
  rmSync(dir, { recursive: true, force: true });
});

test('지급대행: 승인 → 이체 요청 → 결과 통지로 입금 완료', async () => {
  const health = await (await fetch(base + '/api/health')).json();
  assert.deepEqual(health.payout, { provider: '테스트페이', live: true, mock: false, webhook: true });
  const user = await call('loginAs', { id: 'u1' });
  const admin = await call('loginAs', { id: 'a1' });
  const requested = await call('withdraw', { amount: 5000 }, user.cookie);
  assert.equal(requested.body.result.status, 'pending');
  const id = requested.body.result.id;
  const approved = await call('review', { id, status: 'complete' }, admin.cookie);
  assert.equal(approved.body.result.status, 'processing');
  const sent = await until(async () => { const row = await rowOf(admin.cookie, id); return row.payout.status === 'sent' && row; });
  assert.equal(sent.payout.ref, 'TK-1');
  const { headers, body, url, method } = received[0];
  assert.equal(method + ' ' + url, 'POST /v1/transfers');
  assert.equal(headers['idempotency-key'], id, '거래번호를 멱등 키로 보낸다');
  assert.equal(headers.authorization, 'Bearer pk_test');
  assert.equal(headers['x-signature'], 'sha256=' + createHmac('sha256', 'sk_test').update(JSON.stringify(body)).digest('hex'));
  assert.deepEqual({ transferId: body.transferId, bankCode: body.bankCode, accountNumber: body.accountNumber, holderName: body.holderName, amount: body.amount }, { transferId: id, bankCode: '004', accountNumber: '123401043070', holderName: '스마일 회원', amount: 4600 });
  assert.equal((await call('cancel', { id }, user.cookie)).status, 400, '이체 중에는 회원이 취소할 수 없다');
  // 결과 통지
  const event = { transferId: id, status: 'COMPLETED', transferKey: 'TK-1' };
  assert.equal((await webhook(event, 'sha256=bad')).status, 401, '서명이 틀리면 거부');
  assert.equal((await rowOf(admin.cookie, id)).status, 'processing');
  assert.equal((await webhook(event)).status, 200);
  const paid = await rowOf(user.cookie, id);
  assert.equal(paid.status, 'complete');
  assert.equal(paid.payout.status, 'paid');
  assert.equal((await webhook(event)).status, 200, '같은 통지가 다시 와도 문제없다');
  assert.equal((await webhook({ transferId: 'SP-0', status: 'COMPLETED' })).status, 404);
  assert.equal(received.length, 1, '이체 요청은 한 번만 보낸다');
});

test('지급대행: 이체 거절은 실패로 남고 관리자가 반려하면 포인트가 복원된다', async () => {
  const user = await call('loginAs', { id: 'u1' });
  const admin = await call('loginAs', { id: 'a1' });
  const balance = async () => { const state = (await (await fetch(base + '/api/state', { headers: { cookie: user.cookie } })).json()).state; return state.transactions.filter(r => ['pending', 'processing'].includes(r.status) && r.type === 'withdrawal').length; };
  reply = () => ({ code: 400, body: { status: 'FAILED', message: '수취 계좌 오류' } });
  const id = (await call('withdraw', { amount: 6000 }, user.cookie)).body.result.id;
  await call('review', { id, status: 'complete' }, admin.cookie);
  const failed = await until(async () => { const row = await rowOf(admin.cookie, id); return row.payout.status === 'failed' && row; });
  assert.equal(failed.status, 'processing');
  assert.equal(failed.payout.error, '수취 계좌 오류');
  assert.equal(await balance(), 1);
  assert.equal((await call('refundPayout', { id, reason: '' }, admin.cookie)).status, 400);
  assert.equal((await call('refundPayout', { id, reason: '계좌 정보 오류' }, user.cookie)).status, 403);
  assert.equal((await call('refundPayout', { id, reason: '계좌 정보 오류' }, admin.cookie)).status, 200);
  assert.equal((await rowOf(user.cookie, id)).status, 'rejected');
  assert.equal(await balance(), 0);
  // 반려 뒤 늦게 도착한 송금 완료 통지는 관리자에게 경고한다
  assert.equal((await webhook({ transferId: id, status: 'COMPLETED', transferKey: 'TK-late' })).status, 200);
  const notices = (await (await fetch(base + '/api/state', { headers: { cookie: admin.cookie } })).json()).state.notifications;
  assert.ok(notices.some(n => /반려한 출금/.test(n.text)));
});
