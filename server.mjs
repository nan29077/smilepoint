// 스마일 포인트 서버
// - 정적 파일 제공 (미리보기 포트 3070)
// - /api/*      : 로그인 세션(HttpOnly 쿠키) 기반 서비스 API. 데이터는 data/db.json에 저장한다.
// - /api/v1/*   : 웹하드 제휴사 서버용 API (X-Api-Key 인증)
// - /auth/*     : 카카오·네이버·구글 OAuth (.env에 키가 있을 때만 동작)
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clean, dispatch, ops } from './actions.js';
import { testPassword } from './catalog.js';
import * as S from './state.js';

const root = fileURLToPath(new URL('.', import.meta.url));
loadEnv(join(root, '.env'));
const env = process.env;
const port = Number(env.PORT || 3070);
const host = env.HOST || '127.0.0.1';
const demo = (env.DEMO_MODE ?? 'on') !== 'off';
const dataDir = env.DATA_DIR || join(root, 'data');
const publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
const secureCookie = env.COOKIE_SECURE === 'on' || publicUrl.startsWith('https://');
const webhookDelivery = (env.WEBHOOK_DELIVERY ?? 'on') !== 'off';
const sessionDays = 7;

// ───────── 비밀번호: scrypt ─────────
S.security.hash = text => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(String(text), salt, 32).toString('hex')}`;
};
S.security.verify = (text, stored) => {
  if (!stored) return false;
  if (stored.startsWith('fnv1a:')) return stored === S.hashPassword(text);
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const actual = scryptSync(String(text), Buffer.from(salt, 'hex'), 32);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

S.security.tokenHash = text => createHash('sha256').update(String(text)).digest('hex');
S.security.token = () => randomBytes(24).toString('base64url');

// ───────── 저장소 ─────────
mkdirSync(dataDir, { recursive: true });
const dbFile = join(dataDir, 'db.json');
const sessionFile = join(dataDir, 'sessions.json');
const readJson = (file, fallback) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; } };
let db = readJson(dbFile, null);
if (db?.version !== 2) {
  db = demo ? S.freshState() : S.productionState({ adminEmail: env.ADMIN_EMAIL || 'admin@smilepoint.kr', passwordHash: S.security.hash(initialAdminPassword()) });
  console.log(`새 데이터베이스를 만들었습니다 (${demo ? '데모 데이터' : '운영 초기 데이터'}):`, dbFile);
}
db.session = null;
S.normalize(db, demo);
const revokeAtBoot = new Set();
if (!demo) {
  // 운영 모드: 기본 비밀번호(테스트 계정)가 남아 있으면 잠그고, 활성 최고 관리자가 없으면 새로 만든다.
  db.settings.mockWebhardBalance = false;
  for (const account of db.accounts) {
    if (account.status === 'active' && account.password && S.security.verify(testPassword, account.password)) {
      account.status = 'suspended';
      account.locked = 'default-password';
      revokeAtBoot.add(account.id);
      console.warn(`[보안] 기본 비밀번호를 쓰는 계정을 잠갔습니다: ${account.email}`);
    }
  }
  if (!db.accounts.some(account => account.role === 'admin' && account.status === 'active')) {
    const email = env.ADMIN_EMAIL || 'admin@smilepoint.kr';
    const existing = db.accounts.find(account => account.email === email);
    const hash = S.security.hash(initialAdminPassword());
    if (existing) { Object.assign(existing, { role: 'admin', status: 'active', password: hash }); delete existing.locked; revokeAtBoot.add(existing.id); }
    else db.accounts.push({ id: 'a' + Date.now().toString(36), role: 'admin', name: '서비스 운영자', email, phone: '', provider: 'email', status: 'active', createdAt: new Date().toISOString(), password: hash, avatar: 0, photo: '' });
  }
}
function initialAdminPassword() {
  if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD !== testPassword) return env.ADMIN_PASSWORD;
  const generated = 'Sp' + randomBytes(9).toString('base64url') + '7';
  console.warn(`[보안] 최고 관리자 임시 비밀번호: ${generated}  (로그인 후 바로 변경하세요. .env의 ADMIN_PASSWORD로 지정할 수도 있습니다)`);
  return generated;
}
let sessions = readJson(sessionFile, {});
for (const [key, entry] of Object.entries(sessions)) if (revokeAtBoot.has(entry.accountId)) delete sessions[key];
function writeAtomic(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value));
  renameSync(temp, file);
}
const persist = () => { db.session = null; writeAtomic(dbFile, db); };
const persistSessions = () => writeAtomic(sessionFile, sessions);
persist();
if (revokeAtBoot.size) persistSessions();

// ───────── 세션 ─────────
const tokenKey = token => createHash('sha256').update(token).digest('hex');
function cookies(request) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').map(part => part.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function viewerOf(request) {
  const token = cookies(request).sp_sid;
  const entry = token && sessions[tokenKey(token)];
  if (!entry || entry.expires < Date.now()) return null;
  const account = S.account(db, entry.accountId);
  return account?.status === 'active' ? account : null;
}
function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secureCookie ? '; Secure' : ''}${maxAge !== undefined ? `; Max-Age=${maxAge}` : ''}`;
}
function startSession(accountId, remember = true) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  for (const [key, entry] of Object.entries(sessions)) if (entry.expires < now) delete sessions[key];
  sessions[tokenKey(token)] = { accountId, created: now, expires: now + sessionDays * 86400000 };
  persistSessions();
  return cookie('sp_sid', token, remember ? sessionDays * 86400 : undefined);
}
function revokeSessions(accountId, exceptToken = '') {
  const keep = exceptToken ? tokenKey(exceptToken) : '';
  let changed = false;
  for (const [key, entry] of Object.entries(sessions)) if (entry.accountId === accountId && key !== keep) { delete sessions[key]; changed = true; }
  if (changed) persistSessions();
}
function endSession(request) {
  const token = cookies(request).sp_sid;
  if (token) { delete sessions[tokenKey(token)]; persistSessions(); }
  return cookie('sp_sid', '', 0);
}

// ───────── 로그인 시도 제한 ─────────
const attempts = new Map();
function limited(key, max = 5, windowMs = 10 * 60000) {
  const entry = attempts.get(key);
  return !!entry && entry.count >= max && Date.now() - entry.first < windowMs;
}
function failed(key, windowMs = 10 * 60000) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > windowMs) attempts.set(key, { count: 1, first: Date.now() });
  else entry.count++;
}
setInterval(() => { const now = Date.now(); for (const [key, entry] of attempts) if (now - entry.first > 3600000) attempts.delete(key); }, 600000).unref();

// ───────── 응답 도우미 ─────────
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
function json(response, status, body, headers = {}) {
  const text = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...securityHeaders, ...headers });
  response.end(text);
}
function readBody(request, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    request.on('data', chunk => { size += chunk.length; if (size > limit) { reject(new S.AppError('요청이 너무 큽니다.', 413)); request.destroy(); } else chunks.push(chunk); });
    request.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new S.AppError('잘못된 요청 형식입니다.', 400)); }
    });
    request.on('error', reject);
  });
}
const ip = request => (env.TRUST_PROXY === 'on' && request.headers['x-forwarded-for']?.split(',')[0].trim()) || request.socket.remoteAddress;

// ───────── OAuth ─────────
const oauth = {
  kakao: env.KAKAO_CLIENT_ID && {
    authorize: 'https://kauth.kakao.com/oauth/authorize', token: 'https://kauth.kakao.com/oauth/token', id: env.KAKAO_CLIENT_ID, secret: env.KAKAO_CLIENT_SECRET, scope: 'profile_nickname account_email',
    profile: async token => { const r = await (await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${token}` } })).json(); const a = r.kakao_account ?? {}; return { id: r.id, name: a.profile?.nickname, email: a.email, emailVerified: !!(a.is_email_valid && a.is_email_verified) }; },
  },
  naver: env.NAVER_CLIENT_ID && {
    authorize: 'https://nid.naver.com/oauth2.0/authorize', token: 'https://nid.naver.com/oauth2.0/token', id: env.NAVER_CLIENT_ID, secret: env.NAVER_CLIENT_SECRET, scope: '',
    profile: async token => { const r = (await (await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${token}` } })).json()).response ?? {}; return { id: r.id, name: r.name ?? r.nickname, email: r.email, emailVerified: /@naver\.com$/i.test(r.email ?? '') }; },
  },
  google: env.GOOGLE_CLIENT_ID && {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, scope: 'openid email profile',
    profile: async token => { const r = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } })).json(); return { id: r.sub, name: r.name, email: r.email, emailVerified: r.email_verified === true }; },
  },
};
async function handleOAuth(request, response, url) {
  const [, , provider, step] = url.pathname.split('/');
  const config = Object.hasOwn(oauth, provider) && oauth[provider];
  const redirect = location => { response.writeHead(302, { Location: location, 'Cache-Control': 'no-store' }); response.end(); };
  if (!config) return redirect('/#login');
  const callback = `${publicUrl}/auth/${provider}/callback`;
  if (!step) {
    const stateToken = randomBytes(16).toString('hex');
    const query = new URLSearchParams({ response_type: 'code', client_id: config.id, redirect_uri: callback, state: stateToken, ...(config.scope ? { scope: config.scope } : {}) });
    response.writeHead(302, { Location: `${config.authorize}?${query}`, 'Set-Cookie': cookie('sp_oauth', stateToken, 600) });
    return response.end();
  }
  try {
    if (!url.searchParams.get('state') || url.searchParams.get('state') !== cookies(request).sp_oauth) throw new Error('state 불일치');
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: config.id, client_secret: config.secret ?? '', redirect_uri: callback, code: url.searchParams.get('code') ?? '', state: url.searchParams.get('state') });
    const token = await (await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })).json();
    if (!token.access_token) throw new Error('토큰 발급 실패');
    const profile = await config.profile(token.access_token);
    if (!profile.id) throw new Error('프로필 조회 실패');
    const account = S.socialLogin(db, provider, profile);
    persist();
    response.writeHead(302, { Location: `/#app/${account.role}/overview`, 'Set-Cookie': [startSession(account.id), cookie('sp_oauth', '', 0)] });
    response.end();
  } catch (error) {
    console.error(`[oauth:${provider}]`, error.message);
    redirect('/#login');
  }
}

// ───────── 제휴사 서버용 API (/api/v1) ─────────
async function handlePartnerApi(request, response, url) {
  const started = Date.now();
  const key = String(request.headers['x-api-key'] ?? '');
  const partner = key && db.partners.find(item => item.apiKey.length === key.length && timingSafeEqual(Buffer.from(item.apiKey), Buffer.from(key)));
  const finish = (status, body) => {
    if (partner) { S.apiLog(db, { partner: partner.id, method: request.method, path: url.pathname, status, ms: Date.now() - started, source: 'partner-api', ip: ip(request) }); persist(); }
    json(response, status, body);
  };
  if (!partner) return json(response, 401, { error: 'invalid_api_key', message: 'X-Api-Key가 올바르지 않습니다.' });
  if (env.ENFORCE_PARTNER_IP === 'on' && partner.ip && partner.ip !== ip(request)) return finish(403, { error: 'ip_not_allowed' });
  const manager = db.accounts.find(item => item.role === 'partner' && item.partnerId === partner.id && item.status === 'active');
  const parts = url.pathname.split('/').filter(Boolean); // api v1 ...
  const view = row => ({ id: row.id, status: row.status, member: S.account(db, row.userId)?.links?.[partner.id]?.loginId ?? null, amount: row.source, points: row.points, rate: row.rate, requestedAt: row.date, processedAt: row.updated ?? null, reason: row.reason ?? null });
  try {
    if (request.method === 'GET' && parts[2] === 'exchanges' && parts.length === 3) {
      const status = url.searchParams.get('status');
      const rows = db.transactions.filter(row => row.type === 'exchange' && row.partner === partner.id && (!status || row.status === status)).slice(0, 200);
      return finish(200, { data: rows.map(view) });
    }
    if (request.method === 'POST' && parts[2] === 'exchanges' && ['approve', 'reject'].includes(parts[4])) {
      if (!manager) return finish(409, { error: 'no_manager', message: '활성 담당자 계정이 없습니다.' });
      const body = await readBody(request, 16 * 1024);
      const row = db.transactions.find(item => item.id === parts[3] && item.partner === partner.id);
      if (!row) return finish(404, { error: 'not_found' });
      S.update(db, manager.id, row.id, parts[4] === 'approve' ? 'complete' : 'rejected', body.reason ?? '');
      return finish(200, { data: view(row) });
    }
    if (request.method === 'POST' && parts[2] === 'settlements' && parts[3]) {
      const body = await readBody(request, 16 * 1024);
      const result = S.confirmSettlement(db, partner.id, parts[3], body, 'partner-api');
      return finish(200, { date: parts[3], status: result.status, ours: result.ours, theirs: result.theirs, diff: result.diff });
    }
    if (request.method === 'GET' && parts[2] === 'settlements') {
      const date = url.searchParams.get('date') ?? S.kstDay();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return finish(400, { error: 'invalid_date' });
      const rows = db.transactions.filter(row => row.type === 'exchange' && row.partner === partner.id && row.status === 'complete' && S.kstDay(row.updated ?? row.date) === date);
      return finish(200, { date, count: rows.length, amount: rows.reduce((s, r) => s + r.source, 0), points: rows.reduce((s, r) => s + r.points, 0), reconciliation: S.settlementStatus(db, partner.id, date).status, data: rows.map(view) });
    }
    return finish(404, { error: 'not_found' });
  } catch (error) {
    return finish(error.status ?? 500, { error: 'request_failed', message: error.message });
  }
}

// ───────── 웹훅 전송 ─────────
let delivering = false;
async function deliverWebhooks() {
  if (delivering || !webhookDelivery) return;
  delivering = true;
  try {
    for (const hook of (db.webhooks ?? []).filter(item => item.status === 'queued' || (item.status === 'retry' && item.next <= Date.now())).slice(0, 10)) {
      const partner = db.partners.find(item => item.id === hook.partner);
      if (!partner?.webhook) { hook.status = 'skipped'; hook.error = '웹훅 주소 없음'; continue; }
      let target;
      try {
        target = new URL(partner.webhook);
        const addresses = await lookup(target.hostname, { all: true });
        if (S.isPrivateHost(target.hostname) || !addresses.length || addresses.some(item => S.isPrivateIp(item.address))) throw Object.assign(new Error('blocked'), { code: 'BLOCKED_PRIVATE_ADDRESS' });
      } catch (error) {
        hook.attempts = (hook.attempts ?? 0) + 1;
        hook.status = error.code === 'BLOCKED_PRIVATE_ADDRESS' || hook.attempts >= 3 ? 'failed' : 'retry';
        hook.error = error.code ?? error.name;
        if (hook.status === 'retry') hook.next = Date.now() + hook.attempts * 30000;
        S.apiLog(db, { partner: partner.id, method: 'POST', path: (target?.pathname ?? '') + ` (${hook.event})`, status: 0, ms: 0, source: 'webhook' });
        continue;
      }
      const body = JSON.stringify({ id: hook.id, event: hook.event, data: hook.data, sentAt: new Date().toISOString() });
      const started = Date.now();
      hook.attempts = (hook.attempts ?? 0) + 1;
      try {
        const result = await fetch(target, { method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', 'X-SmilePoint-Event': hook.event, 'X-SmilePoint-Signature': 'sha256=' + createHmac('sha256', partner.apiKey).update(body).digest('hex') } });
        hook.status = result.ok ? 'delivered' : hook.attempts >= 3 ? 'failed' : 'retry';
        hook.code = result.status;
      } catch (error) {
        hook.status = hook.attempts >= 3 ? 'failed' : 'retry';
        hook.error = error.cause?.code ?? error.name;
      }
      hook.ms = Date.now() - started;
      if (hook.status === 'retry') hook.next = Date.now() + hook.attempts * 30000;
      S.apiLog(db, { partner: partner.id, method: 'POST', path: new URL(partner.webhook).pathname + ` (${hook.event})`, status: hook.code ?? 0, ms: hook.ms, source: 'webhook' });
    }
    persist();
  } finally { delivering = false; }
}
setInterval(deliverWebhooks, 15000).unref();

// ───────── 서비스 API ─────────
// 스냅샷의 프로필 사진은 주소로 바꿔 보낸다 (관리자 화면이 모든 회원 사진을 매번 받지 않도록).
function view(viewer) {
  const snap = S.snapshot(db, viewer);
  snap.accounts = snap.accounts.map(account => account.photo ? { ...account, photo: '', photoUrl: `./api/photo/${account.id}?v=${createHash('sha1').update(account.photo).digest('hex').slice(0, 10)}` } : account);
  return snap;
}
function servePhoto(response, viewer, id) {
  const target = S.account(db, decodeURIComponent(id));
  const allowed = viewer && target?.photo && (viewer.id === target.id || viewer.role === 'admin'
    || (viewer.role === 'partner' && db.transactions.some(row => row.userId === target.id && row.partner === viewer.partnerId))
    || (viewer.role === 'user' && db.transactions.some(row => row.userId === viewer.id && row.counterpart === target.id)));
  if (!allowed) return json(response, 404, { error: '사진을 찾을 수 없습니다.' });
  const match = target.photo.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return json(response, 404, { error: '사진을 찾을 수 없습니다.' });
  const buffer = Buffer.from(match[2], 'base64');
  response.writeHead(200, { 'Content-Type': match[1], 'Content-Length': buffer.length, 'Cache-Control': 'private, max-age=86400', ...securityHeaders });
  response.end(buffer);
}
// 메일 발송: MAIL_WEBHOOK_URL(메일 발송 서비스의 웹훅)이 있으면 그곳으로 보내고, 없으면 서버 로그와 관리자 알림으로 남긴다.
async function deliverResetMail(account, link) {
  const text = `${account.name}님, 아래 링크에서 30분 안에 비밀번호를 다시 설정해 주세요.\n${link}\n요청하지 않았다면 이 메일을 무시하세요.`;
  if (env.MAIL_WEBHOOK_URL) {
    try {
      await fetch(env.MAIL_WEBHOOK_URL, { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', ...(env.MAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.MAIL_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ to: account.email, subject: '[스마일 포인트] 비밀번호 재설정 안내', text }) });
      return;
    } catch (error) { console.error('[mail] 발송 실패:', error.message); }
  }
  console.log(`[mail] 메일 발송 설정 없음 — ${account.email} 재설정 링크: ${link}`);
  if (!demo) S.notify(db, 'admin', `비밀번호 재설정 요청: ${account.email} (메일 발송 설정이 없어 서버 로그에 링크를 남겼습니다)`, 'app/admin/integrations');
}
function health() {
  return { ok: true, mode: 'server', demo, version: 2, oauth: Object.fromEntries(Object.keys(oauth).map(key => [key, !!oauth[key]])), webhooks: webhookDelivery, mail: !!env.MAIL_WEBHOOK_URL, time: new Date().toISOString() };
}
async function handleApi(request, response, url) {
  if (url.pathname === '/api/health') return json(response, 200, health());
  const viewer = viewerOf(request);
  if (url.pathname === '/api/state' && request.method === 'GET') return json(response, 200, { state: view(viewer), server: health() });
  if (url.pathname.startsWith('/api/photo/') && request.method === 'GET') return servePhoto(response, viewer, url.pathname.slice(11));
  if (url.pathname !== '/api/action' || request.method !== 'POST') return json(response, 404, { error: '찾을 수 없는 API입니다.' });
  if (request.headers['x-smilepoint'] !== '1' || !String(request.headers['content-type']).startsWith('application/json')) return json(response, 403, { error: '허용되지 않은 요청입니다.' });
  try {
    const { op, payload = {} } = await readBody(request);
    const spec = Object.hasOwn(ops, op) ? ops[op] : null;
    const limitKey = `${ip(request)}:${String(payload.email ?? '').toLowerCase()}`;
    if (op === 'login' && limited(limitKey)) return json(response, 429, { error: '로그인 시도가 너무 많습니다. 10분 뒤 다시 시도해 주세요.' });
    if (op === 'signup' && limited('signup:' + ip(request), 3, 3600000)) return json(response, 429, { error: '같은 곳에서 가입이 너무 많습니다. 1시간 뒤 다시 시도해 주세요.' });
    if (op === 'requestReset' && limited('reset:' + ip(request), 5, 3600000)) return json(response, 429, { error: '요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.' });
    db.session = null;
    let result;
    try { result = dispatch(db, viewer?.id ?? null, op, payload, { demo }); }
    catch (error) { if (op === 'login') failed(limitKey); throw error; }
    const headers = {};
    let next = viewer;
    if (spec?.auth && db.session?.accountId) {
      headers['Set-Cookie'] = startSession(db.session.accountId, payload.remember !== false);
      next = S.account(db, db.session.accountId);
      attempts.delete(limitKey);
    }
    if (op === 'signup') failed('signup:' + ip(request), 3600000);
    if (op === 'logout') { headers['Set-Cookie'] = endSession(request); next = null; }
    // 비밀번호가 바뀌거나 계정이 정지되면 다른 기기의 로그인을 끊는다.
    if (op === 'changePassword') revokeSessions(viewer.id, cookies(request).sp_sid);
    if (op === 'resetPassword') revokeSessions(payload.id);
    if ((op === 'setStaffStatus' || op === 'setMemberStatus') && payload.status === 'suspended') revokeSessions(payload.id ?? payload.userId);
    if (op === 'resetWithToken' && result?.id) revokeSessions(result.id);
    if (op === 'requestReset') {
      failed('reset:' + ip(request), 3600000);
      const link = result ? `${publicUrl}/#reset/${result.token}` : '';
      if (result) await deliverResetMail(result.account, link);
      result = { sent: true, ...(demo && link ? { link } : {}) };
    }
    if (op === 'resetDemo') { sessions = viewer ? Object.fromEntries(Object.entries(sessions).filter(([, s]) => s.accountId === viewer.id)) : {}; persistSessions(); }
    persist();
    if (db.webhooks?.some(item => item.status === 'queued')) setImmediate(deliverWebhooks);
    const plain = typeof result === 'string' && ['resetPassword', 'regenerateKey'].includes(op) ? result : op === 'requestReset' ? result : clean(result);
    return json(response, 200, { result: plain, state: view(next) }, headers);
  } catch (error) {
    db = readJson(dbFile, db); // 실패한 요청의 중간 변경은 버린다.
    db.session = null;
    const status = error.status ?? 500;
    if (status >= 500 && !(error instanceof S.AppError)) console.error(error);
    return json(response, status, { error: status >= 500 && !(error instanceof S.AppError) ? '서버 오류가 발생했습니다.' : error.message });
  }
}

// ───────── 정적 파일 ─────────
const rootFiles = new Set(['/index.html', '/styles.css', '/app.js', '/catalog.js', '/state.js', '/actions.js']);
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2',
};
function serveStatic(request, response, path) {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  if (path === '/') path = '/index.html';
  const permitted = rootFiles.has(path) || /^\/views\/[a-z]+\.js$/.test(path) || /^\/assets\/[a-z0-9][a-z0-9-]*\.(svg|jpg|webp|png|woff2)$/.test(path);
  const file = join(root, path.slice(1));
  if (!permitted || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('페이지를 찾을 수 없습니다.');
    return;
  }
  response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': statSync(file).size, ...securityHeaders });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).on('error', () => response.destroy()).pipe(response);
}

const server = createServer(async (request, response) => {
  let url;
  try { url = new URL(request.url, 'http://localhost'); decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
  try {
    if (url.pathname.startsWith('/api/v1/')) return await handlePartnerApi(request, response, url);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (url.pathname.startsWith('/auth/')) return await handleOAuth(request, response, url);
    serveStatic(request, response, decodeURIComponent(url.pathname));
  } catch (error) {
    console.error(error);
    if (!response.headersSent) json(response, 500, { error: '서버 오류가 발생했습니다.' });
  }
});
server.on('error', error => { console.error(`서버를 시작할 수 없습니다. ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => {
  console.log(`스마일 포인트 서버 http://localhost:${port}/`);
  console.log(`  데이터: ${dbFile}`);
  console.log(`  데모 모드: ${demo ? '켜짐 (테스트 계정 로그인 가능)' : '꺼짐'}`);
  console.log(`  소셜 로그인: ${Object.entries(oauth).map(([k, v]) => `${k}=${v ? '연동' : '데모'}`).join(', ')}`);
});

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
