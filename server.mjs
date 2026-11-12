// 스마일 포인트 서버
// - 정적 파일 제공 (미리보기 포트 3070)
// - /api/*      : 로그인 세션(HttpOnly 쿠키) 기반 서비스 API. 데이터는 data/db.json에 저장한다.
// - /api/v1/*   : 웹하드 제휴사 서버용 API (X-Api-Key 인증)
// - /auth/*     : 카카오·네이버·구글 OAuth (.env에 키가 있을 때만 동작)
// - /api/payout/webhook : 지급대행사의 이체 결과 통지 (payout.mjs)
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clean, dispatch, ops } from './actions.js';
import { testPassword } from './catalog.js';
import { createPayoutProvider } from './payout.mjs';
import * as S from './state.js';

const root = fileURLToPath(new URL('.', import.meta.url));
loadEnv(join(root, '.env'));
const env = process.env;
const port = Number(env.PORT || 3070);
const host = env.HOST || '127.0.0.1';
const publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
// 데모 모드(테스트 계정 로그인·데모 초기화·인증번호 화면 표시)는 내 PC(127.0.0.1)에서 실행할 때만 기본으로 켜진다.
// 외부에 여는 서버(HOST=0.0.0.0, https 주소, NODE_ENV=production)는 DEMO_MODE=on을 직접 적지 않으면 운영 모드로 시작한다.
const demo = env.DEMO_MODE ? env.DEMO_MODE !== 'off' : loopback && !publicUrl.startsWith('https://') && env.NODE_ENV !== 'production';
const dataDir = env.DATA_DIR || join(root, 'data');
const secureCookie = env.COOKIE_SECURE === 'on' || publicUrl.startsWith('https://');
const webhookDelivery = (env.WEBHOOK_DELIVERY ?? 'on') !== 'off';
const proxyHops = env.TRUST_PROXY === 'on' ? Math.max(1, Number(env.TRUST_PROXY_HOPS) || 1) : 0;
const sessionDays = 7;
if (demo && !loopback) console.warn('\n[보안 경고] 외부에서 접속할 수 있는 주소에서 데모 모드가 켜져 있습니다. 누구나 테스트 계정(최고 관리자 포함)으로 로그인할 수 있습니다. 운영 전 DEMO_MODE=off로 바꾸세요.\n');
const payout = createPayoutProvider(env, { demo }); // 실제 지급대행 | 모의(데모) | null(운영 모드에서 미설정)

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
const sameText = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

// ───────── 2단계 인증: TOTP (RFC 6238, 30초 · 6자리 · SHA-1 — Google Authenticator 등과 호환) ─────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buffer) {
  let bits = 0, value = 0, out = '';
  for (const byte of buffer) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  return bits > 0 ? out + B32[(value << (5 - bits)) & 31] : out;
}
function unbase32(text) {
  let bits = 0, value = 0;
  const out = [];
  for (const char of String(text).toUpperCase().replace(/[^A-Z2-7]/g, '')) { value = (value << 5) | B32.indexOf(char); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function hotp(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', unbase32(secret)).update(message).digest();
  const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
S.security.totpSecret = () => base32(randomBytes(20));
// 앞뒤 30초 오차를 허용하고, 이미 쓴 코드(같은 시간 칸)는 다시 받지 않는다. 성공하면 시간 칸 번호, 실패하면 null
S.security.totpCheck = (secret, code, lastStep) => {
  if (!/^\d{6}$/.test(String(code))) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now - 1, now, now + 1]) if (step > (lastStep ?? -1) && sameText(hotp(secret, step), code)) return step;
  return null;
};

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
if (demo) db.demoTainted = true; // 데모 모드로 한 번이라도 연 데이터 (테스트 계정으로 누구나 API 키를 볼 수 있었음)
else {
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
  // 데모 때 노출됐을 수 있는 제휴사 API 키(웹훅 서명 키)는 모두 새로 발급한다.
  if (db.demoTainted) {
    for (const partner of db.partners) partner.apiKey = S.newApiKey();
    if (db.partners.length) console.warn(`[보안] 데모 모드로 사용한 데이터라 제휴사 API 키 ${db.partners.length}개를 모두 재발급했습니다. 각 제휴사에 새 키를 전달하세요.`);
    S.log(db, 'system', 'API 키 일괄 재발급', '전체 제휴사', '데모 데이터를 운영 모드로 전환');
    delete db.demoTainted;
  }
  if (!db.accounts.some(account => account.role === 'admin' && account.status === 'active')) {
    const email = env.ADMIN_EMAIL || 'admin@smilepoint.kr';
    const existing = db.accounts.find(account => account.email === email);
    const hash = S.security.hash(initialAdminPassword());
    if (existing) { Object.assign(existing, { role: 'admin', status: 'active', password: hash }); delete existing.locked; delete existing.totp; revokeAtBoot.add(existing.id); }
    else db.accounts.push({ id: 'a' + Date.now().toString(36), role: 'admin', name: '서비스 운영자', email, phone: '', provider: 'email', status: 'active', createdAt: new Date().toISOString(), password: hash, avatar: 0, photo: '' });
  }
}
if (db.settings.payoutMode === 'api' && !payout) {
  db.settings.payoutMode = 'manual';
  console.warn('[지급대행] PAYOUT_API_URL / PAYOUT_API_KEY가 없어 출금 지급 방식을 수동으로 되돌렸습니다.');
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
  const out = {};
  for (const part of String(request.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    try { out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* 깨진 쿠키는 무시 */ }
  }
  return out;
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

// ───────── 시도 제한 ─────────
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
// 같은 요청이 연달아 들어오면(더블클릭·중복 제출) 한 번만 처리한다.
const recent = new Map();
const duplicateGuarded = new Set(['exchange', 'withdraw', 'order', 'gift', 'attend', 'setBank', 'linkPartner', 'openTicket', 'adjust', 'review', 'bulkReview', 'reverseExchange', 'createPartner', 'createProduct', 'createStaff', 'createEvent', 'addAnnouncement', 'replyTicket', 'regenerateKey', 'resetPassword', 'cancelCoupon']);
setInterval(() => { const now = Date.now(); for (const [key, at] of recent) if (now - at > 10000) recent.delete(key); }, 30000).unref();

// ───────── 응답 도우미 ─────────
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  ...(secureCookie ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
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
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch { reject(new S.AppError('잘못된 요청 형식입니다.', 400)); }
    });
    request.on('error', reject);
  });
}
// 리버스 프록시 뒤에서는 X-Forwarded-For의 오른쪽(우리 프록시가 붙인 값)부터 센다. 왼쪽 값은 접속자가 마음대로 넣을 수 있다.
const ip = request => {
  if (proxyHops) {
    const chain = String(request.headers['x-forwarded-for'] ?? '').split(',').map(item => item.trim()).filter(Boolean);
    if (chain.length >= proxyHops) return chain[chain.length - proxyHops];
  }
  return request.socket.remoteAddress;
};

// ───────── OAuth ─────────
const oauth = {
  kakao: env.KAKAO_CLIENT_ID && {
    authorize: 'https://kauth.kakao.com/oauth/authorize', token: 'https://kauth.kakao.com/oauth/token', id: env.KAKAO_CLIENT_ID, secret: env.KAKAO_CLIENT_SECRET, scope: 'profile_nickname account_email',
    profile: async token => { const r = await (await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })).json(); const a = r.kakao_account ?? {}; return { id: r.id, name: a.profile?.nickname, email: a.email, emailVerified: !!(a.is_email_valid && a.is_email_verified) }; },
  },
  naver: env.NAVER_CLIENT_ID && {
    authorize: 'https://nid.naver.com/oauth2.0/authorize', token: 'https://nid.naver.com/oauth2.0/token', id: env.NAVER_CLIENT_ID, secret: env.NAVER_CLIENT_SECRET, scope: '',
    profile: async token => { const r = (await (await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })).json()).response ?? {}; return { id: r.id, name: r.name ?? r.nickname, email: r.email, emailVerified: /@naver\.com$/i.test(r.email ?? '') }; },
  },
  google: env.GOOGLE_CLIENT_ID && {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, scope: 'openid email profile',
    profile: async token => { const r = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })).json(); return { id: r.sub, name: r.name, email: r.email, emailVerified: r.email_verified === true }; },
  },
};
// 처음 소셜 로그인한 회원은 약관 동의 화면(#social/토큰)을 거친 뒤 가입한다. 소셜 프로필은 10분 동안만 서버 메모리에 둔다.
const pendingSocial = new Map();
const takeSocial = token => {
  const entry = pendingSocial.get(token);
  pendingSocial.delete(token);
  return entry && entry.expires > Date.now() ? entry : null;
};
setInterval(() => { const now = Date.now(); for (const [key, entry] of pendingSocial) if (entry.expires < now) pendingSocial.delete(key); }, 60000).unref();

async function handleOAuth(request, response, url) {
  const [, , provider, step] = url.pathname.split('/');
  const config = Object.hasOwn(oauth, provider) && oauth[provider];
  const redirect = (location, headers = {}) => { response.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...headers }); response.end(); };
  if (!config) return redirect('/#login/social-unavailable');
  const callback = `${publicUrl}/auth/${provider}/callback`;
  if (!step) {
    const stateToken = randomBytes(16).toString('hex');
    const query = new URLSearchParams({ response_type: 'code', client_id: config.id, redirect_uri: callback, state: stateToken, ...(config.scope ? { scope: config.scope } : {}) });
    return redirect(`${config.authorize}?${query}`, { 'Set-Cookie': cookie('sp_oauth', stateToken, 600) });
  }
  const clear = cookie('sp_oauth', '', 0);
  try {
    if (url.searchParams.get('error')) throw Object.assign(new Error('사용자 취소'), { quiet: true, code: 'social-canceled' });
    const expected = cookies(request).sp_oauth;
    if (!url.searchParams.get('state') || !expected || !sameText(url.searchParams.get('state'), expected)) throw new Error('state 불일치');
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: config.id, client_secret: config.secret ?? '', redirect_uri: callback, code: url.searchParams.get('code') ?? '', state: url.searchParams.get('state') });
    const token = await (await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(8000) })).json();
    if (!token.access_token) throw new Error('토큰 발급 실패');
    const profile = await config.profile(token.access_token);
    if (!profile.id) throw new Error('프로필 조회 실패');
    let account;
    try { account = S.socialLogin(db, provider, profile); }
    catch (error) {
      if (error.need !== 'terms') throw error;
      const key = randomBytes(24).toString('base64url');
      pendingSocial.set(key, { provider, profile, expires: Date.now() + 10 * 60000 });
      return redirect(`/#social/${key}`, { 'Set-Cookie': clear });
    }
    persist();
    redirect(`/#app/${account.role}/overview`, { 'Set-Cookie': [startSession(account.id), clear] });
  } catch (error) {
    if (!error.quiet) console.error(`[oauth:${provider}]`, error.message);
    redirect(`/#login/${error.code ?? (error instanceof S.AppError ? 'social-blocked' : 'social-failed')}`, { 'Set-Cookie': clear });
  }
}

// ───────── 제휴사 서버용 API (/api/v1) ─────────
async function handlePartnerApi(request, response, url) {
  const started = Date.now();
  const key = String(request.headers['x-api-key'] ?? '');
  const partner = key ? db.partners.find(item => item.apiKey && sameText(item.apiKey, key)) : null;
  const finish = (status, body) => {
    if (partner) { S.apiLog(db, { partner: partner.id, method: request.method, path: url.pathname, status, ms: Date.now() - started, source: 'partner-api', ip: ip(request) }); persist(); }
    json(response, status, body);
  };
  if (!partner) {
    failed('api:' + ip(request));
    if (limited('api:' + ip(request), 30)) return json(response, 429, { error: 'too_many_requests', message: '잘못된 키로 너무 많이 요청했습니다. 10분 뒤 다시 시도하세요.' });
    return json(response, 401, { error: 'invalid_api_key', message: 'X-Api-Key가 올바르지 않습니다.' });
  }
  if (env.ENFORCE_PARTNER_IP === 'on' && partner.ip && partner.ip !== ip(request)) return finish(403, { error: 'ip_not_allowed' });
  const manager = db.accounts.find(item => item.role === 'partner' && item.partnerId === partner.id && item.status === 'active');
  const parts = url.pathname.split('/').filter(Boolean); // api v1 ...
  const view = row => ({ id: row.id, status: row.status, member: row.member ?? S.account(db, row.userId)?.links?.[partner.id]?.loginId ?? null, amount: row.source, points: row.points, rate: row.rate, requestedAt: row.date, processedAt: row.updated ?? null, reason: row.reason ?? null,
    review: row.partnerApproved && row.status === 'pending' ? { status: 'admin_review', reason: row.review } : null, reversed: row.reversed ? { at: row.reversed.at, reason: row.reversed.reason } : null });
  const backup = JSON.stringify(db);
  try {
    if (request.method === 'GET' && parts[2] === 'exchanges' && parts.length === 3) {
      const status = url.searchParams.get('status');
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100));
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const rows = db.transactions.filter(row => row.type === 'exchange' && row.partner === partner.id && (!status || row.status === status));
      return finish(200, { data: rows.slice(offset, offset + limit).map(view), total: rows.length, next: offset + limit < rows.length ? offset + limit : null });
    }
    if (request.method === 'POST' && parts[2] === 'exchanges' && ['approve', 'reject', 'reverse'].includes(parts[4]) && parts.length === 5) {
      if (!manager) return finish(409, { error: 'no_manager', message: '활성 담당자 계정이 없습니다.' });
      const body = await readBody(request, 16 * 1024);
      const row = db.transactions.find(item => item.id === parts[3] && item.type === 'exchange' && item.partner === partner.id);
      if (!row) return finish(404, { error: 'not_found' });
      if (parts[4] === 'reverse') S.reverseExchange(db, manager.id, row.id, body.reason ?? '');
      else S.update(db, manager.id, row.id, parts[4] === 'approve' ? 'complete' : 'rejected', body.reason ?? '');
      return finish(200, { data: view(row) });
    }
    if (request.method === 'GET' && parts[2] === 'link-requests' && parts.length === 3) return finish(200, { data: S.linkRequests(db, partner.id) });
    if (request.method === 'POST' && parts[2] === 'settlements' && parts[3] && parts.length === 4) {
      const body = await readBody(request, 16 * 1024);
      const result = S.confirmSettlement(db, partner.id, parts[3], body, 'partner-api');
      return finish(200, { date: parts[3], status: result.status, ours: result.ours, theirs: result.theirs, diff: result.diff });
    }
    if (request.method === 'GET' && parts[2] === 'settlements' && parts.length === 3) {
      const date = url.searchParams.get('date') ?? S.kstDay();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return finish(400, { error: 'invalid_date' });
      const rows = db.transactions.filter(row => row.type === 'exchange' && row.partner === partner.id && row.status === 'complete' && !row.reversed && S.kstDay(row.updated ?? row.date) === date);
      return finish(200, { date, count: rows.length, amount: rows.reduce((s, r) => s + r.source, 0), points: rows.reduce((s, r) => s + r.points, 0), reconciliation: S.settlementStatus(db, partner.id, date).status, data: rows.map(view) });
    }
    return finish(404, { error: 'not_found' });
  } catch (error) {
    if (!error.keep) db = JSON.parse(backup);
    const status = error.status ?? 500;
    if (status >= 500) console.error(error);
    return finish(status, { error: 'request_failed', message: status >= 500 ? '서버 오류가 발생했습니다.' : error.message });
  }
}

// ───────── 외부 전송 (웹훅) ─────────
// 접속 직전에 DNS 결과를 다시 검사해 내부망으로 가는 요청을 막는다 (DNS 재바인딩 방지: 검사한 주소로 바로 접속).
function guardedLookup(hostname, options, callback) {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family || 4 }];
    if (!list.length || list.some(item => S.isPrivateIp(item.address))) return callback(Object.assign(new Error('blocked private address'), { code: 'BLOCKED_PRIVATE_ADDRESS' }));
    if (options.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}
function postJson(target, body, headers, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(target);
    if (url.protocol !== 'https:') return reject(Object.assign(new Error('https only'), { code: 'HTTPS_ONLY' }));
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (S.isPrivateHost(hostname) || (isIP(hostname) && S.isPrivateIp(hostname))) return reject(Object.assign(new Error('blocked'), { code: 'BLOCKED_PRIVATE_ADDRESS' }));
    const req = httpsRequest(url, { method: 'POST', lookup: guardedLookup, timeout, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'SmilePoint-Webhook/1', ...headers } }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })));
    req.on('error', reject);
    req.end(body);
  });
}

let delivering = false;
async function deliverWebhooks() {
  if (delivering || !webhookDelivery) return;
  delivering = true;
  try {
    const due = (db.webhooks ?? []).filter(item => item.status === 'queued' || (item.status === 'retry' && item.next <= Date.now())).slice(0, 10).map(item => item.id);
    for (const id of due) {
      const pick = () => (db.webhooks ?? []).find(item => item.id === id); // 전송 중 db가 바뀌어도 현재 기록에 결과를 적는다
      const hook = pick();
      if (!hook) continue;
      const partner = db.partners.find(item => item.id === hook.partner);
      if (!partner?.webhook) { Object.assign(hook, { status: 'skipped', error: '웹훅 주소 없음' }); continue; }
      const body = JSON.stringify({ id: hook.id, event: hook.event, data: hook.data, sentAt: new Date().toISOString() });
      const started = Date.now();
      const result = { attempts: (hook.attempts ?? 0) + 1 };
      try {
        result.code = await postJson(partner.webhook, body, { 'X-SmilePoint-Event': hook.event, 'X-SmilePoint-Signature': 'sha256=' + createHmac('sha256', partner.apiKey).update(body).digest('hex') });
        result.status = result.code >= 200 && result.code < 300 ? 'delivered' : result.attempts >= 3 ? 'failed' : 'retry';
      } catch (error) {
        result.status = error.code === 'BLOCKED_PRIVATE_ADDRESS' || result.attempts >= 3 ? 'failed' : 'retry';
        result.error = error.code ?? error.name;
      }
      result.ms = Date.now() - started;
      if (result.status === 'retry') result.next = Date.now() + result.attempts * 30000;
      const current = pick();
      if (current) Object.assign(current, result);
      let path = '';
      try { path = new URL(partner.webhook).pathname; } catch {}
      S.apiLog(db, { partner: partner.id, method: 'POST', path: `${path} (${hook.event})`, status: result.code ?? 0, ms: result.ms, source: 'webhook' });
    }
    persist();
  } finally { delivering = false; }
}
setInterval(deliverWebhooks, 15000).unref();

// 1원 인증 송금 요청: BANK_VERIFY_URL(지급대행·펌뱅킹 업체 연동 주소)이 있으면 요청하고, 없으면 최고 관리자에게 확인을 맡긴다.
async function requestBankTransfer(account, request) {
  if (!env.BANK_VERIFY_URL) {
    if (!demo) S.notify(db, 'admin', `계좌 인증 확인 필요: ${account.name} · ${request.bank} ••••${request.number.slice(-4)} (1원 송금 연동 없음 — 회원 관리에서 명의 확인 후 승인)`, 'app/admin/members');
    return;
  }
  try {
    await fetch(env.BANK_VERIFY_URL, { method: 'POST', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', ...(env.BANK_VERIFY_TOKEN ? { Authorization: `Bearer ${env.BANK_VERIFY_TOKEN}` } : {}) },
      body: JSON.stringify({ bank: request.bank, accountNumber: request.number, holder: request.holder, amount: 1, memo: '스마일' + request.code }) });
  } catch (error) {
    console.error('[bank] 1원 송금 요청 실패:', error.message);
    S.notify(db, 'admin', `1원 송금 요청 실패: ${account.name} · ${request.bank} (회원 관리에서 확인 후 승인할 수 있습니다)`, 'app/admin/members');
  }
}

// ───────── 지급대행 이체 ─────────
// 승인된 출금(이체 요청 대기)을 지급대행사로 보내고 결과를 원장에 반영한다.
let paying = false;
async function processPayouts() {
  if (paying || !payout) return;
  paying = true;
  try {
    if (payout.mock) { if (S.runMockPayouts(db)) persist(); return; }
    let changed = false;
    const apply = (id, result) => {
      if (result.state === 'paid') S.payoutResult(db, id, { ok: true, ref: result.ref, provider: payout.name });
      else if (result.state === 'failed') S.payoutResult(db, id, { ok: false, ref: result.ref, provider: payout.name, error: result.error });
      else return false;
      return true;
    };
    for (const { id } of S.payoutQueue(db).slice(0, 10)) {
      const row = db.transactions.find(item => item.id === id);
      const request = S.payoutRequest(db, row);
      changed = true;
      if (!request?.bankCode) { S.payoutResult(db, id, { ok: false, provider: payout.name, error: '출금 계좌를 확인할 수 없음' }); continue; }
      try {
        const result = await payout.transfer(request);
        if (!apply(id, result)) S.payoutSent(db, id, { ref: result.ref, provider: payout.name });
      } catch (error) {
        // 응답을 받지 못하면 송금 여부를 알 수 없다. 자동으로 다시 보내지 않고 관리자가 확인하게 한다.
        console.error('[지급대행] 이체 요청 실패:', id, error.message);
        try { S.payoutResult(db, id, { ok: false, provider: payout.name, error: '응답 없음 · 지급대행사에서 이체 여부 확인 필요' }); } catch {}
      }
    }
    // 접수 후 1분이 지나도 결과 통지가 없으면 상태를 조회한다.
    const waiting = db.transactions.filter(row => row.type === 'withdrawal' && row.status === 'processing' && row.payout?.status === 'sent'
      && Date.now() - Date.parse(row.payout.sentAt) > 60000 && Date.now() - (row.payout.checkedAt ?? 0) > 60000).slice(0, 10);
    for (const { id } of waiting) {
      try {
        const result = await payout.status({ transferId: id });
        const row = db.transactions.find(item => item.id === id);
        if (row?.payout?.status !== 'sent') continue;
        row.payout.checkedAt = Date.now();
        apply(id, result);
        changed = true;
      } catch (error) { console.error('[지급대행] 상태 조회 실패:', id, error.message); }
    }
    if (changed) persist();
  } catch (error) { console.error('[지급대행]', error); }
  finally { paying = false; }
}
setInterval(processPayouts, 10000).unref();
const schedulePayouts = () => { if (payout && S.payoutQueue(db).length) setTimeout(processPayouts, payout.mock ? 3000 : 0).unref(); };
schedulePayouts();

// 지급대행사의 이체 결과 통지. 서명이 맞을 때만 반영하고, 같은 통지가 여러 번 와도 한 번만 처리한다.
function readRaw(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    request.on('data', chunk => { size += chunk.length; if (size > limit) { reject(new S.AppError('요청이 너무 큽니다.', 413)); request.destroy(); } else chunks.push(chunk); });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}
async function handlePayoutWebhook(request, response) {
  if (request.method !== 'POST' || !payout?.live) return json(response, 404, { error: 'not_found' });
  const raw = await readRaw(request);
  if (!payout.verifyWebhook(raw, request.headers['x-payout-signature'])) return json(response, 401, { error: 'invalid_signature' });
  let data;
  try { data = JSON.parse(raw); } catch { return json(response, 400, { error: 'invalid_json' }); }
  const event = payout.parseWebhook(data);
  const row = db.transactions.find(item => item.id === event.transferId && item.type === 'withdrawal');
  if (!row) return json(response, 404, { error: 'unknown_transfer' });
  if (row.status === 'rejected' && event.state === 'paid' && !row.payout?.lateNotice) {
    // 이미 반려(포인트 복원)한 출금이 실제로는 송금된 경우: 관리자가 바로 알 수 있게 한다.
    row.payout = { ...row.payout, lateNotice: true, ref: event.ref || row.payout?.ref };
    S.notify(db, 'admin', `주의: 반려한 출금 ${row.id}이(가) 지급대행사에서는 송금 완료로 통지되었습니다. 회원 포인트를 확인해 주세요.`, 'app/admin/payouts');
    persist();
  }
  if (row.status !== 'processing' || event.state === 'accepted') return json(response, 200, { ok: true, status: row.status });
  // 실패로 기록된 뒤 늦게 도착한 성공 통지도 반영한다 (응답 없음 → 실제로는 송금된 경우).
  if (row.payout?.status === 'failed' && event.state === 'failed') return json(response, 200, { ok: true, status: row.status });
  S.payoutResult(db, row.id, { ok: event.state === 'paid', ref: event.ref, provider: payout.name, error: event.error });
  persist();
  return json(response, 200, { ok: true, status: row.status });
}

// ───────── 서비스 API ─────────
// 스냅샷의 프로필 사진은 주소로 바꿔 보낸다 (관리자 화면이 모든 회원 사진을 매번 받지 않도록).
function view(viewer) {
  const snap = S.snapshot(db, viewer);
  snap.accounts = snap.accounts.map(account => account.photo ? { ...account, photo: '', photoUrl: `./api/photo/${account.id}?v=${createHash('sha1').update(account.photo).digest('hex').slice(0, 10)}` } : account);
  return snap;
}
function servePhoto(response, viewer, id) {
  let targetId = '';
  try { targetId = decodeURIComponent(id); } catch {}
  const target = S.account(db, targetId);
  const allowed = viewer && target?.photo && (viewer.id === target.id || viewer.role === 'admin'
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
  if (!demo) { S.notify(db, 'admin', `비밀번호 재설정 요청: ${account.email} (메일 발송 설정이 없어 서버 로그에 링크를 남겼습니다)`, 'app/admin/integrations'); persist(); }
}
function health() {
  return { ok: true, mode: 'server', demo, version: 2, oauth: Object.fromEntries(Object.keys(oauth).map(key => [key, !!oauth[key]])), webhooks: webhookDelivery, mail: !!env.MAIL_WEBHOOK_URL, bankVerify: !!env.BANK_VERIFY_URL,
    payout: { provider: payout?.name ?? '', live: !!payout?.live, mock: !!payout?.mock, webhook: !!payout?.webhook }, time: new Date().toISOString() };
}
const sessionOps = { changePassword: 1, resetPassword: 1, setStaffStatus: 1, setMemberStatus: 1, resetWithToken: 1, deleteAccount: 1 };
async function handleApi(request, response, url) {
  if (url.pathname === '/api/health') return json(response, 200, health());
  const viewer = viewerOf(request);
  if (url.pathname === '/api/state' && request.method === 'GET') return json(response, 200, { state: view(viewer), server: health() });
  if (url.pathname.startsWith('/api/photo/') && request.method === 'GET') return servePhoto(response, viewer, url.pathname.slice(11));
  if (url.pathname !== '/api/action' || request.method !== 'POST') return json(response, 404, { error: '찾을 수 없는 API입니다.' });
  if (request.headers['x-smilepoint'] !== '1' || !String(request.headers['content-type']).startsWith('application/json')) return json(response, 403, { error: '허용되지 않은 요청입니다.' });
  let backup = '';
  try {
    const { op, payload: raw = {} } = await readBody(request);
    const payload = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const spec = typeof op === 'string' && Object.hasOwn(ops, op) ? ops[op] : null;
    const who = ip(request);
    const email = String(payload.email ?? '').trim().toLowerCase().slice(0, 200);
    // 로그인 제한: 같은 IP·이메일 5회, 같은 IP 30회, 같은 이메일(여러 IP 합산) 10회 실패하면 잠시 막는다.
    const loginKeys = [`login:${who}:${email}`, `login-ip:${who}`, `login-email:${email}`];
    if (op === 'login' && (limited(loginKeys[0]) || limited(loginKeys[1], 30) || limited(loginKeys[2], 10, 15 * 60000))) return json(response, 429, { error: '로그인 시도가 너무 많습니다. 10~15분 뒤 다시 시도해 주세요.' });
    if (op === 'signup' && limited('signup:' + who, 3, 3600000)) return json(response, 429, { error: '같은 곳에서 가입이 너무 많습니다. 1시간 뒤 다시 시도해 주세요.' });
    if (op === 'requestReset' && limited('reset:' + who, 5, 3600000)) return json(response, 429, { error: '요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.' });
    if (['confirmLink', 'confirmBank', 'socialComplete'].includes(op) && limited(`code:${who}`, 30)) return json(response, 429, { error: '인증 시도가 너무 많습니다. 10분 뒤 다시 시도해 주세요.' });
    if (viewer && duplicateGuarded.has(op)) {
      const key = `${viewer.id}:${op}:${createHash('sha1').update(JSON.stringify(payload)).digest('hex')}`;
      if (Date.now() - (recent.get(key) ?? 0) < 3000) return json(response, 409, { error: '같은 요청이 방금 처리되었습니다. 결과를 확인해 주세요.' });
      recent.set(key, Date.now());
    }
    if (op === 'updateSettings' && payload.payoutMode === 'api' && !payout) return json(response, 400, { error: '지급대행 API 키(PAYOUT_API_URL, PAYOUT_API_KEY)가 설정되지 않아 자동 이체를 켤 수 없습니다.' });
    db.session = null;
    backup = JSON.stringify(db); // 처리 중 오류가 나면 이 시점으로 되돌린다 (동기 처리라 다른 요청과 섞이지 않음)
    let result;
    try { result = dispatch(db, viewer?.id ?? null, op, payload, { demo, takeSocial }); }
    catch (error) {
      if (op === 'login') for (const key of loginKeys) failed(key, key.startsWith('login-email') ? 15 * 60000 : 10 * 60000);
      if (['confirmLink', 'confirmBank', 'socialComplete'].includes(op)) failed(`code:${who}`);
      throw error;
    }
    const headers = {};
    let next = viewer;
    if (spec?.auth && db.session?.accountId) {
      headers['Set-Cookie'] = startSession(db.session.accountId, payload.remember !== false);
      next = S.account(db, db.session.accountId);
      attempts.delete(loginKeys[0]);
    }
    if (op === 'signup') failed('signup:' + who, 3600000);
    if (op === 'logout') { headers['Set-Cookie'] = endSession(request); next = null; }
    // 비밀번호가 바뀌거나 계정이 정지·탈퇴되면 다른 기기의 로그인을 끊는다.
    if (sessionOps[op]) {
      if (op === 'changePassword') revokeSessions(viewer.id, cookies(request).sp_sid);
      if (op === 'resetPassword') revokeSessions(payload.id);
      if ((op === 'setStaffStatus' || op === 'setMemberStatus') && payload.status === 'suspended') revokeSessions(payload.id ?? payload.userId);
      if (op === 'resetWithToken' && result?.id) revokeSessions(result.id);
      if (op === 'deleteAccount') { revokeSessions(viewer.id); headers['Set-Cookie'] = cookie('sp_sid', '', 0); next = null; }
    }
    if (op === 'requestReset') failed('reset:' + who, 3600000);
    if (op === 'resetDemo') { sessions = viewer ? Object.fromEntries(Object.entries(sessions).filter(([, s]) => s.accountId === viewer.id)) : {}; persistSessions(); }
    persist(); // 외부 전송(메일 등)을 기다리기 전에 먼저 저장한다
    if (op === 'setBank' && viewer) {
      const request = S.account(db, viewer.id)?.bankRequest;
      if (request) requestBankTransfer(viewer, { ...request }).then(persist, () => {});
    }
    if (op === 'requestReset') {
      const link = result ? `${publicUrl}/#reset/${result.token}` : '';
      if (result) await deliverResetMail(result.account, link);
      result = { sent: true, ...(demo && link ? { link } : {}) };
    }
    if (db.webhooks?.some(item => item.status === 'queued')) setImmediate(deliverWebhooks);
    schedulePayouts();
    const plain = typeof result === 'string' && ['resetPassword', 'regenerateKey'].includes(op) ? result : op === 'requestReset' ? result : clean(result);
    return json(response, 200, { result: plain, state: view(next) }, headers);
  } catch (error) {
    if (backup) {
      if (error.keep) persist(); // 인증번호 오입력 횟수처럼 실패해도 남겨야 하는 변경
      else db = JSON.parse(backup);
    }
    db.session = null;
    const status = error.status ?? 500;
    const known = error instanceof S.AppError || status < 500;
    if (!known) console.error(error);
    return json(response, status, { error: known ? error.message : '서버 오류가 발생했습니다.', ...(error.need ? { need: error.need } : {}) });
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
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders }).end('페이지를 찾을 수 없습니다.');
    return;
  }
  response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': statSync(file).size, ...securityHeaders });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).on('error', () => response.destroy()).pipe(response);
}

const server = createServer(async (request, response) => {
  let url, path;
  try { url = new URL(request.url, 'http://localhost'); path = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
  try {
    if (url.pathname.startsWith('/api/v1/')) return await handlePartnerApi(request, response, url);
    if (url.pathname === '/api/payout/webhook') return await handlePayoutWebhook(request, response);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (url.pathname.startsWith('/auth/')) return await handleOAuth(request, response, url);
    serveStatic(request, response, path);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) json(response, 500, { error: '서버 오류가 발생했습니다.' });
  }
});
server.on('error', error => { console.error(`서버를 시작할 수 없습니다. ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => {
  console.log(`스마일 포인트 서버 http://localhost:${port}/`);
  console.log(`  데이터: ${dbFile}`);
  console.log(`  데모 모드: ${demo ? '켜짐 (테스트 계정 로그인 가능)' : '꺼짐 (운영 모드)'}`);
  console.log(`  소셜 로그인: ${Object.entries(oauth).map(([k, v]) => `${k}=${v ? '연동' : '미설정'}`).join(', ')}`);
  console.log(`  출금 지급: ${payout ? payout.name + (payout.live ? ' (API 연동)' : ' (데모)') : '수동 지급 (지급대행 미설정)'}`);
});

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
