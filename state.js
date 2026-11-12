import { animals, announcementSeeds, grades, partnerSeeds, productSeeds, testPassword } from './catalog.js';

export const storageKey = 'smilepoint-demo-v2';
export const types = {
  exchange: '포인트 교환', withdrawal: '계좌 출금', coupon: '쿠폰 구매', attendance: '출석체크',
  reward: '이벤트 적립', adjust: '관리자 조정', gift_out: '포인트 선물', gift_in: '선물 받음',
};
export const statuses = { pending: '처리 대기', complete: '완료', rejected: '반려', canceled: '취소' };
const credits = new Set(['exchange', 'attendance', 'reward', 'gift_in']);
const day = 86400000;

// ───────── 공통 유틸 ─────────
export const kstDay = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(value));
export const hashPassword = text => {
  let h = 2166136261;
  for (const char of 'smilepoint:' + text) { h ^= char.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return 'fnv1a:' + h.toString(16);
};
// 서버에서는 scrypt 기반 해시로 교체한다 (server.mjs 참고).
export const security = {
  hash: text => hashPassword(text),
  verify: (text, stored) => !!stored && stored === hashPassword(text),
};
export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new AppError(message, status); };
const int = value => Number.isSafeInteger(value) ? value : NaN;
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const code = (random, length = 12) => Array.from({ length }, () => Math.floor(random() * 10)).join('');

export function nextId(state, prefix = 'SP') {
  state.seq += 1;
  return prefix + '-' + state.seq;
}

// ───────── 초기 데이터 ─────────
export function freshState(now = new Date()) {
  const random = seeded(3070);
  const at = (daysAgo, hour = 11) => {
    const date = new Date(now.getTime() - daysAgo * day);
    date.setUTCHours(hour - 9, Math.floor(random() * 60), 0, 0);
    return date.toISOString();
  };
  const pw = security.hash(testPassword);
  const people = [
    ['u2', '김하늘', 'haneul@example.com', 'kakao'], ['u3', '이도윤', 'doyun@example.com', 'naver'],
    ['u4', '박서연', 'seoyeon@example.com', 'email'], ['u5', '최민준', 'minjun@example.com', 'kakao'],
    ['u6', '정지아', 'jia@example.com', 'google'], ['u7', '강태오', 'taeo@example.com', 'naver'],
    ['u8', '윤시우', 'siwoo@example.com', 'apple'], ['u9', '한예린', 'yerin@example.com', 'kakao'],
  ];
  const state = {
    version: 2, seq: 1023,
    settings: { fee: 500, withdrawalMinimum: 5000, dailyWithdrawLimit: 500000, attendancePoints: 10, attendanceBonus: 50, signupBonus: 1000, referralBonus: 500, giftMinimum: 1000, maintenance: false },
    session: null,
    partners: partnerSeeds.map((item, i) => ({ ...item, apiKey: 'sp_live_' + code(random, 24), webhook: `https://api.${item.id}.example.com/smilepoint/webhook`, ip: `203.0.113.${10 + i}` })),
    products: productSeeds.map(item => ({ ...item })),
    announcements: announcementSeeds.map(item => ({ ...item })),
    accounts: [
      { id: 'u1', role: 'user', name: '스마일 회원', email: 'user@smilepoint.kr', phone: '010-3070-1004', provider: 'email', status: 'active', createdAt: at(120), referral: 'SMILE3070',
        bank: { bank: '국민은행', number: '123401043070', holder: '스마일 회원', verified: true },
        links: { green: { loginId: 'smile_green', balance: 128000, linkedAt: at(90) }, cloud: { loginId: 'smile_cloud', balance: 22000, linkedAt: at(60) } },
        notify: { email: true, sms: true, marketing: false } },
      { id: 'p1', role: 'partner', partnerId: 'green', name: '그린파일 담당자', email: 'partner@smilepoint.kr', phone: '02-3070-2000', provider: 'email', status: 'active', createdAt: at(150) },
      { id: 'p2', role: 'partner', partnerId: 'cloud', name: '클라우드박스 담당자', email: 'cloud@smilepoint.kr', phone: '02-3070-3000', provider: 'email', status: 'active', createdAt: at(140) },
      { id: 'a1', role: 'admin', name: '서비스 운영자', email: 'admin@smilepoint.kr', phone: '02-3070-0000', provider: 'email', status: 'active', createdAt: at(200) },
      ...people.map(([id, name, email, provider], i) => ({
        id, role: 'user', name, email, phone: '010-' + code(random, 4) + '-' + code(random, 4), provider, status: i === 6 ? 'suspended' : 'active', createdAt: at(10 + i * 9),
        referral: 'SP' + code(random, 6),
        bank: i % 3 === 2 ? null : { bank: ['신한은행', '카카오뱅크', '우리은행', '토스뱅크'][i % 4], number: code(random, 12), holder: name, verified: true },
        links: Object.fromEntries(partnerSeeds.filter((_, p) => (i + p) % 2 === 0).map(p => [p.id, { loginId: email.split('@')[0] + '_' + p.id, balance: 20000 + Math.floor(random() * 60) * 1000, linkedAt: at(8 + i) }])),
        notify: { email: true, sms: false, marketing: i % 2 === 0 },
      })),
    ],
    transactions: [], tickets: [], notifications: [], audit: [], attendance: {}, apiLogs: [], webhooks: [],
  };
  for (const account of state.accounts) {
    account.password = pw;
    account.avatar = Math.floor(random() * animals.length);
    account.photo = '';
  }
  state.accounts.find(item => item.id === 'u1').avatar = 0;

  const push = row => { state.transactions.push({ id: nextId(state), ...row }); return row; };
  // 대표 사용자 내역
  push({ userId: 'u1', type: 'reward', points: 1000, status: 'complete', date: at(119), memo: '회원가입 축하 포인트' });
  push({ userId: 'u1', type: 'exchange', partner: 'green', source: 60000, points: 30000, rate: 2, status: 'complete', date: at(12, 11), updated: at(12, 13) });
  push({ userId: 'u1', type: 'exchange', partner: 'cloud', source: 10000, points: 10000, rate: 1, status: 'complete', date: at(9, 15), updated: at(9, 16) });
  push({ userId: 'u1', type: 'exchange', partner: 'green', source: 24000, points: 12000, rate: 2, status: 'complete', date: at(6, 10), updated: at(6, 12) });
  push({ userId: 'u1', type: 'coupon', product: 'coffee', points: 4500, status: 'complete', date: at(5, 13), coupon: { code: code(random), expires: at(-85), used: false } });
  push({ userId: 'u1', type: 'withdrawal', points: 8000, fee: 500, status: 'complete', date: at(4, 9), updated: at(3, 10), bank: '국민은행 ••••3070' });
  push({ userId: 'u1', type: 'coupon', product: 'market', points: 5000, status: 'complete', date: at(3, 19), coupon: { code: code(random), expires: at(-87), used: true } });
  for (const d of [3, 2, 1]) push({ userId: 'u1', type: 'attendance', points: 10, status: 'complete', date: at(d, 8), memo: '출석체크' });
  push({ userId: 'u1', type: 'exchange', partner: 'green', source: 8000, points: 4000, rate: 2, status: 'pending', date: at(0, 10) });
  state.attendance.u1 = [3, 2, 1].map(d => kstDay(new Date(now.getTime() - d * day)));

  // 다른 회원 거래 (최근 14일 추이용)
  for (const account of state.accounts.filter(item => item.role === 'user' && item.id !== 'u1')) {
    let earned = 0;
    push({ userId: account.id, type: 'reward', points: 1000, status: 'complete', date: account.createdAt, memo: '회원가입 축하 포인트' });
    for (const [partnerId] of Object.entries(account.links)) {
      const partner = partnerSeeds.find(item => item.id === partnerId);
      const times = 1 + Math.floor(random() * 3);
      for (let t = 0; t < times; t++) {
        const source = (2 + Math.floor(random() * 10)) * partner.divisor * 1000;
        const daysAgo = Math.floor(random() * 14);
        const status = daysAgo < 1 ? 'pending' : random() < .1 ? 'rejected' : 'complete';
        push({ userId: account.id, type: 'exchange', partner: partnerId, source, points: source / partner.divisor, rate: partner.divisor, status, date: at(daysAgo, 9 + Math.floor(random() * 12)), ...(status !== 'pending' ? { updated: at(daysAgo, 21) } : {}), ...(status === 'rejected' ? { reason: '판매 포인트 정산 보류 건' } : {}) });
        if (status === 'complete') earned += source / partner.divisor;
      }
    }
    if (account.bank && earned > 12000) {
      const amount = Math.floor(earned * .5 / 1000) * 1000;
      const daysAgo = Math.floor(random() * 4);
      push({ userId: account.id, type: 'withdrawal', points: amount, fee: 500, status: daysAgo === 0 ? 'pending' : 'complete', date: at(daysAgo, 14), bank: account.bank.bank + ' ••••' + account.bank.number.slice(-4), ...(daysAgo ? { updated: at(daysAgo, 18) } : {}) });
      earned -= amount;
    }
    if (earned > 6000) {
      const product = productSeeds[Math.floor(random() * 6)];
      if (product.cost < earned) push({ userId: account.id, type: 'coupon', product: product.id, points: product.cost, status: 'complete', date: at(Math.floor(random() * 10), 12), coupon: { code: code(random), expires: at(-80), used: random() < .5 } });
    }
  }
  state.transactions.sort((a, b) => b.date.localeCompare(a.date));

  state.tickets.push(
    { id: 'T-2', userId: 'u3', category: '계좌 출금', transaction: '', message: '출금 계좌를 다른 은행으로 바꾸고 싶어요. 어떻게 해야 하나요?', reply: '', status: 'open', date: at(0, 9) },
    { id: 'T-1', userId: 'u1', category: '포인트 교환', transaction: '', message: '그린파일 판매 포인트도 교환이 되나요?', reply: '네, 그린파일 판매 적립 포인트는 2:1 비율로 교환하실 수 있습니다.', status: 'answered', date: at(7, 14), repliedAt: at(7, 16) },
  );
  notify(state, 'u1', '그린파일 교환 12,000 P가 적립되었습니다.', 'app/user/activity', at(6, 12));
  notify(state, 'u1', '출금 8,000 P가 국민은행 계좌로 지급되었습니다.', 'app/user/activity', at(3, 10));
  notify(state, 'u1', '디스크온 제휴 오픈! 첫 교환 시 5% 추가 적립', 'app/user/exchange', at(0, 8));
  notify(state, 'partner:green', '새 교환 신청이 접수되었습니다. (8,000 P)', 'app/partner/requests', at(0, 10));
  notify(state, 'admin', '새 1:1 문의가 등록되었습니다.', 'app/admin/support', at(0, 9));
  notify(state, 'admin', '출금 심사 대기 건을 확인해 주세요.', 'app/admin/payouts', at(0, 14));
  for (const item of state.notifications) if (item.date < at(1)) item.read = true;
  for (const row of state.transactions.filter(r => r.type === 'exchange').slice(0, 40)) {
    state.apiLogs.push({ id: 'A-' + row.id, partner: row.partner, method: 'POST', path: '/api/v1/exchanges/' + row.id + (row.status === 'complete' ? '/approve' : row.status === 'rejected' ? '/reject' : ''), status: 200, ms: 80 + Math.floor(random() * 140), date: row.updated ?? row.date, source: row.status === 'pending' ? 'webhook' : 'partner-api' });
  }
  log(state, 'a1', '설정 변경', '운영 설정', '출금 수수료 500 P, 최소 출금 5,000 P', at(30));
  log(state, 'a1', '공지 등록', 'n3', '디스크온 제휴 오픈 기념 교환 이벤트', at(0, 8));
  return state;
}

export function load(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (saved?.version === 2 && Array.isArray(saved.accounts) && Array.isArray(saved.transactions)) return saved;
  } catch {}
  return freshState();
}
export function save(state, storage = globalThis.localStorage) { storage.setItem(storageKey, JSON.stringify(state)); }

// ───────── 계정·세션 ─────────
export const account = (state, id) => state.accounts.find(item => item.id === id);
export const current = state => state.session ? account(state, state.session.accountId) ?? null : null;
const byEmail = (state, email) => state.accounts.find(item => item.email.toLowerCase() === String(email).trim().toLowerCase());
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function startSession(state, target, method) {
  if (target.status === 'suspended') fail('이용이 정지된 계정입니다. 고객센터로 문의해 주세요.');
  state.session = { accountId: target.id, method, at: new Date().toISOString() };
  target.lastLogin = state.session.at;
  return target;
}

export function login(state, email, password) {
  const target = byEmail(state, email);
  if (!target || !security.verify(String(password ?? ''), target.password)) fail('이메일 또는 비밀번호가 일치하지 않습니다.', 401);
  return startSession(state, target, 'email');
}
export function loginAs(state, id) {
  const target = account(state, id) ?? fail('테스트 계정을 찾을 수 없습니다.');
  return startSession(state, target, 'test');
}
export function logout(state) { state.session = null; }

export function signup(state, input, now = new Date()) {
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim();
  if (name.length < 2 || name.length > 20) fail('이름은 2~20자로 입력해 주세요.');
  if (!emailPattern.test(email)) fail('올바른 이메일 주소를 입력해 주세요.');
  if (byEmail(state, email)) fail('이미 가입된 이메일입니다. 로그인해 주세요.');
  if (input.provider === 'email' || !input.provider) {
    const pw = String(input.password ?? '');
    if (pw.length < 8 || !/[a-z]/i.test(pw) || !/\d/.test(pw)) fail('비밀번호는 영문과 숫자를 포함해 8자 이상으로 입력해 주세요.');
    if (pw !== input.confirm) fail('비밀번호 확인이 일치하지 않습니다.');
  }
  if (!input.terms || !input.privacy || !input.age) fail('필수 약관에 모두 동의해 주세요.');
  const referrer = input.referral ? state.accounts.find(item => item.referral === String(input.referral).trim().toUpperCase()) : null;
  if (input.referral && !referrer) fail('추천인 코드를 찾을 수 없습니다.');
  const created = {
    id: 'u' + (state.accounts.length + 1) + '-' + now.getTime().toString(36), role: 'user', name, email, phone: String(input.phone ?? '').trim(),
    provider: input.provider || 'email', status: 'active', createdAt: now.toISOString(), referral: 'SP' + now.getTime().toString(36).slice(-6).toUpperCase(),
    password: input.provider && input.provider !== 'email' ? '' : security.hash(input.password), avatar: Math.floor(Math.random() * animals.length), photo: '',
    bank: null, links: {}, notify: { email: true, sms: false, marketing: !!input.marketing },
  };
  state.accounts.push(created);
  credit(state, created.id, 'reward', state.settings.signupBonus, '회원가입 축하 포인트');
  if (referrer) {
    credit(state, created.id, 'reward', state.settings.referralBonus, '추천인 코드 입력 보너스');
    credit(state, referrer.id, 'reward', state.settings.referralBonus, `${name}님 추천 가입 보너스`);
    notify(state, referrer.id, `${name}님이 추천 코드로 가입해 ${state.settings.referralBonus} P가 적립되었습니다.`, 'app/user/activity');
  }
  notify(state, created.id, `가입을 환영합니다! ${state.settings.signupBonus} P를 드렸어요.`, 'app/user/overview');
  notify(state, 'admin', `신규 회원 가입: ${name}`, 'app/admin/members');
  startSession(state, created, created.provider);
  return created;
}

// profile: 실제 OAuth 연동 시 { id, name, email } — 없으면 데모 회원으로 처리한다.
export function socialLogin(state, provider, profile = null, now = new Date()) {
  if (!['kakao', 'naver', 'google', 'apple'].includes(provider)) fail('지원하지 않는 로그인 방식입니다.');
  const socialId = profile?.id ? String(profile.id) : 'demo';
  const existing = state.accounts.find(item => item.role === 'user' && item.social?.[provider] === socialId);
  if (existing) return startSession(state, existing, provider);
  const sameEmail = profile?.email ? byEmail(state, profile.email) : null;
  if (sameEmail) {
    if (sameEmail.role !== 'user') fail('관리자 계정은 소셜 로그인을 사용할 수 없습니다.', 403);
    sameEmail.social = { ...(sameEmail.social ?? {}), [provider]: socialId };
    return startSession(state, sameEmail, provider);
  }
  const names = { kakao: '카카오 회원', naver: '네이버 회원', google: 'Google 회원', apple: 'Apple 회원' };
  const created = signup(state, {
    provider, name: String(profile?.name ?? names[provider]).slice(0, 20).padEnd(2, ' ').trim() || names[provider],
    email: profile?.email ?? `${provider}.${now.getTime().toString(36)}@social.smilepoint.kr`, terms: true, privacy: true, age: true,
  }, now);
  created.social = { [provider]: socialId };
  return created;
}

export function updateProfile(state, id, { name, phone, notify: prefs }) {
  const target = account(state, id);
  if (name !== undefined) {
    const value = String(name).trim();
    if (!value || value.length > 24) fail('표시 이름은 1~24자로 입력해 주세요.');
    target.name = value;
  }
  if (phone !== undefined) target.phone = String(phone).trim().slice(0, 20);
  if (prefs) target.notify = { ...target.notify, ...prefs };
  return target;
}
export function changePassword(state, id, before, after) {
  const target = account(state, id);
  after = String(after ?? '');
  if (target.password && !security.verify(String(before ?? ''), target.password)) fail('현재 비밀번호가 일치하지 않습니다.');
  if (after.length < 8 || !/[a-z]/i.test(after) || !/\d/.test(after)) fail('새 비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.');
  target.password = security.hash(after);
}

// ───────── 잔액·등급 ─────────
export const direction = row => credits.has(row.type) || (row.type === 'adjust' && row.points > 0) ? 'in' : 'out';
export function balances(state, userId) {
  const totals = { available: 0, pending: 0, reserved: 0, earned: 0, spent: 0 };
  for (const row of state.transactions) {
    if (row.userId !== userId) continue;
    const amount = Math.abs(row.points);
    if (direction(row) === 'in') {
      if (row.status === 'complete') { totals.available += amount; totals.earned += amount; }
      if (row.status === 'pending') totals.pending += amount;
    } else if (row.status === 'pending' || row.status === 'complete') {
      totals.available -= amount;
      if (row.status === 'pending') totals.reserved += amount;
      else totals.spent += amount;
    }
  }
  return totals;
}
export function grade(state, userId) {
  const exchanged = state.transactions.filter(row => row.userId === userId && row.type === 'exchange' && row.status === 'complete').reduce((sum, row) => sum + row.points, 0);
  const index = grades.findLastIndex(item => exchanged >= item.min);
  const next = grades[index + 1];
  return { ...grades[index], exchanged, next, progress: next ? Math.min(100, Math.round((exchanged - grades[index].min) / (next.min - grades[index].min) * 100)) : 100 };
}
export const feeFor = (state, userId) => Math.round(state.settings.fee * grade(state, userId).feeRate);

// ───────── 원장 기록 ─────────
function record(state, details) {
  const row = { id: nextId(state), date: new Date().toISOString(), ...details };
  state.transactions.unshift(row);
  return row;
}
function credit(state, userId, type, points, memo) { return record(state, { userId, type, points, status: 'complete', memo }); }
const user = (state, id) => {
  const target = account(state, id);
  if (!target || target.role !== 'user') fail('사용자 계정만 이용할 수 있습니다.');
  if (target.status !== 'active') fail('이용이 정지된 계정입니다.');
  return target;
};
const partnerOf = (state, id) => state.partners.find(item => item.id === id);

export function notify(state, to, text, link = '', date = new Date().toISOString()) {
  state.notifications.unshift({ id: 'N-' + (state.notifications.length + 1) + '-' + Date.parse(date).toString(36), to, text, link, date, read: false });
}
export function notificationsFor(state, viewer) {
  if (!viewer) return [];
  const keys = new Set([viewer.id, viewer.role === 'admin' ? 'admin' : '', viewer.role === 'partner' ? 'partner:' + viewer.partnerId : '']);
  return state.notifications.filter(item => keys.has(item.to));
}
export function readAll(state, viewer) { for (const item of notificationsFor(state, viewer)) item.read = true; }
export function log(state, actorId, action, target, detail = '', date = new Date().toISOString()) {
  state.audit.unshift({ id: 'L-' + (state.audit.length + 1), actor: actorId, action, target, detail, date });
}

// ───────── 웹하드 연결·교환 ─────────
export function linkPartner(state, userId, partnerId, loginId) {
  const target = user(state, userId);
  const partner = partnerOf(state, partnerId) ?? fail('제휴사를 찾을 수 없습니다.');
  const id = String(loginId ?? '').trim();
  if (!/^[a-z0-9_.-]{4,20}$/i.test(id)) fail('웹하드 아이디는 영문·숫자 4~20자로 입력해 주세요.');
  if (target.links[partnerId]) fail('이미 연결된 웹하드입니다.');
  const balance = 10000 + (([...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) * 37) % 40) * 1000;
  target.links[partnerId] = { loginId: id, balance: balance - (balance % partner.divisor), linkedAt: new Date().toISOString() };
  return target.links[partnerId];
}
export function unlinkPartner(state, userId, partnerId) {
  const target = user(state, userId);
  if (state.transactions.some(row => row.userId === userId && row.partner === partnerId && row.status === 'pending')) fail('처리 대기 중인 교환이 있어 연결을 해제할 수 없습니다.');
  delete target.links[partnerId];
}
export function partnerAvailable(state, userId, partnerId) {
  const link = account(state, userId)?.links?.[partnerId];
  if (!link) return 0;
  return link.balance - state.transactions
    .filter(row => row.userId === userId && row.partner === partnerId && ['pending', 'complete'].includes(row.status) && row.date >= link.linkedAt)
    .reduce((sum, row) => sum + row.source, 0);
}
export function exchange(state, userId, partnerId, amount) {
  user(state, userId);
  const partner = partnerOf(state, partnerId);
  if (!partner?.active) fail('현재 교환할 수 없는 제휴사입니다.');
  if (!account(state, userId).links[partnerId]) fail('먼저 웹하드 계정을 연결해 주세요.');
  amount = int(amount);
  if (!(amount >= partner.min) || amount > partnerAvailable(state, userId, partnerId) || amount % partner.divisor) fail('교환 가능 잔액, 최소 금액과 교환 단위를 확인해 주세요.');
  const row = record(state, { userId, type: 'exchange', partner: partnerId, source: amount, points: amount / partner.divisor, rate: partner.divisor, status: 'pending' });
  notify(state, 'partner:' + partnerId, `새 교환 신청이 접수되었습니다. (${amount.toLocaleString('ko-KR')} P)`, 'app/partner/requests');
  queueWebhook(state, partnerId, 'exchange.requested', { exchangeId: row.id, member: account(state, userId).links[partnerId].loginId, amount, points: row.points, rate: row.rate });
  return row;
}

// ───────── 계좌·출금 ─────────
export function setBank(state, userId, { bank, number, holder }) {
  const target = user(state, userId);
  const digits = String(number ?? '').replace(/\D/g, '');
  if (!bank) fail('은행을 선택해 주세요.');
  if (digits.length < 10 || digits.length > 16) fail('계좌번호는 숫자 10~16자리로 입력해 주세요.');
  if (String(holder ?? '').trim() !== target.name) fail(`예금주가 회원 이름(${target.name})과 일치해야 합니다.`);
  if (state.transactions.some(row => row.userId === userId && row.type === 'withdrawal' && row.status === 'pending')) fail('처리 중인 출금이 있어 계좌를 바꿀 수 없습니다.');
  target.bank = { bank, number: digits, holder: target.name, verified: true, verifiedAt: new Date().toISOString() };
  return target.bank;
}
export function withdrawnToday(state, userId) {
  const today = kstDay();
  return state.transactions.filter(row => row.userId === userId && row.type === 'withdrawal' && ['pending', 'complete'].includes(row.status) && kstDay(row.date) === today).reduce((sum, row) => sum + row.points, 0);
}
export function withdraw(state, userId, amount) {
  const target = user(state, userId);
  if (!target.bank?.verified) fail('본인 명의 출금 계좌를 먼저 등록해 주세요.');
  amount = int(amount);
  const fee = feeFor(state, userId);
  if (!(amount >= state.settings.withdrawalMinimum) || amount > balances(state, userId).available || amount <= fee) fail('최소 출금액과 사용 가능 잔액을 확인해 주세요.');
  if (withdrawnToday(state, userId) + amount > state.settings.dailyWithdrawLimit) fail('일일 출금 한도를 초과했습니다.');
  const row = record(state, { userId, type: 'withdrawal', points: amount, fee, status: 'pending', bank: target.bank.bank + ' ••••' + target.bank.number.slice(-4) });
  notify(state, 'admin', `${target.name}님 출금 신청 ${amount.toLocaleString('ko-KR')} P`, 'app/admin/payouts');
  return row;
}

// ───────── 쇼핑·쿠폰 ─────────
export function order(state, userId, productId, quantity = 1) {
  user(state, userId);
  const product = state.products.find(item => item.id === productId);
  quantity = int(quantity);
  if (!product?.active) fail('판매 중인 상품이 아닙니다.');
  if (!(quantity >= 1 && quantity <= 5)) fail('수량은 1~5개로 선택해 주세요.');
  if (product.stock < quantity) fail('재고가 부족합니다.');
  if (product.cost * quantity > balances(state, userId).available) fail('사용 가능 포인트가 부족합니다.');
  product.stock -= quantity;
  const rows = [];
  for (let i = 0; i < quantity; i++) {
    rows.push(record(state, { userId, type: 'coupon', product: productId, points: product.cost, status: 'complete',
      coupon: { code: String(Math.floor(Math.random() * 1e12)).padStart(12, '0'), expires: new Date(Date.now() + 90 * day).toISOString(), used: false } }));
  }
  return rows;
}
export function setCouponUsed(state, userId, id, used = true) {
  const row = state.transactions.find(item => item.id === id && item.userId === userId && item.type === 'coupon') ?? fail('쿠폰을 찾을 수 없습니다.');
  row.coupon.used = used;
  return row;
}

// ───────── 출석·선물 ─────────
export function streak(state, userId, now = new Date()) {
  const days = new Set(state.attendance[userId] ?? []);
  let count = 0;
  let cursor = now.getTime();
  if (!days.has(kstDay(cursor))) cursor -= day;
  while (days.has(kstDay(cursor))) { count++; cursor -= day; }
  return count;
}
export function attend(state, userId, now = new Date()) {
  user(state, userId);
  const today = kstDay(now);
  const list = state.attendance[userId] ??= [];
  if (list.includes(today)) fail('오늘은 이미 출석했어요. 내일 다시 만나요!');
  list.push(today);
  const count = streak(state, userId, now);
  const rows = [credit(state, userId, 'attendance', state.settings.attendancePoints, '출석체크')];
  if (count % 7 === 0) rows.push(credit(state, userId, 'reward', state.settings.attendanceBonus, `${count}일 연속 출석 보너스`));
  return { count, points: rows.reduce((sum, row) => sum + row.points, 0) };
}
export function gift(state, userId, email, amount, message = '') {
  const sender = user(state, userId);
  const receiver = byEmail(state, email);
  amount = int(amount);
  if (!receiver || receiver.role !== 'user') fail('받는 분의 이메일을 확인해 주세요.');
  if (receiver.id === userId) fail('본인에게는 선물할 수 없습니다.');
  if (receiver.status !== 'active') fail('받는 분의 계정을 이용할 수 없는 상태입니다.');
  if (!(amount >= state.settings.giftMinimum) || amount > balances(state, userId).available) fail(`선물은 ${state.settings.giftMinimum.toLocaleString('ko-KR')} P 이상, 사용 가능 포인트 이내로 보낼 수 있습니다.`);
  const memo = String(message).trim().slice(0, 40);
  const row = record(state, { userId, type: 'gift_out', points: amount, status: 'complete', counterpart: receiver.id, memo });
  record(state, { userId: receiver.id, type: 'gift_in', points: amount, status: 'complete', counterpart: userId, memo });
  notify(state, receiver.id, `${sender.name}님이 ${amount.toLocaleString('ko-KR')} P를 선물했어요.${memo ? ' “' + memo + '”' : ''}`, 'app/user/activity');
  return row;
}

// ───────── 처리 권한·상태 변경 ─────────
export function visibleTransactions(state, viewer) {
  if (!viewer) return [];
  if (viewer.role === 'user') return state.transactions.filter(row => row.userId === viewer.id);
  if (viewer.role === 'partner') return state.transactions.filter(row => row.type === 'exchange' && row.partner === viewer.partnerId);
  return state.transactions;
}
export function canUpdate(row, viewer, status) {
  if (!row || !viewer || row.status !== 'pending') return false;
  if (viewer.role === 'user') return status === 'canceled' && row.userId === viewer.id;
  if (!['complete', 'rejected'].includes(status)) return false;
  if (viewer.role === 'admin') return ['exchange', 'withdrawal'].includes(row.type);
  return viewer.role === 'partner' && row.type === 'exchange' && row.partner === viewer.partnerId;
}
export function update(state, actorId, id, status, reason = '') {
  const viewer = account(state, actorId);
  const row = state.transactions.find(item => item.id === id);
  if (!canUpdate(row, viewer, status)) fail('이 거래는 해당 상태로 변경할 수 없습니다.');
  if (status === 'rejected' && !String(reason).trim()) fail('반려 사유를 입력해 주세요.');
  row.status = status;
  row.updated = new Date().toISOString();
  row.handler = actorId;
  if (reason) row.reason = String(reason).trim().slice(0, 100);
  const owner = account(state, row.userId);
  const amount = row.points.toLocaleString('ko-KR');
  if (status === 'canceled' && row.type === 'exchange') queueWebhook(state, row.partner, 'exchange.canceled', { exchangeId: row.id });
  if (status !== 'canceled') {
    const label = row.type === 'exchange' ? `${partnerOf(state, row.partner)?.name} 교환 ${amount} P` : `출금 ${amount} P`;
    notify(state, row.userId, status === 'complete' ? `${label}${row.type === 'exchange' ? '가 적립되었습니다.' : '가 지급되었습니다.'}` : `${label} 신청이 반려되었습니다. 사유: ${row.reason}`, 'app/user/activity');
    log(state, actorId, status === 'complete' ? (row.type === 'exchange' ? '교환 승인' : '출금 지급') : '반려', row.id, `${owner?.name} · ${amount} P${row.reason ? ' · ' + row.reason : ''}`);
  }
  return row;
}
export function bulkUpdate(state, actorId, ids, status, reason = '') {
  let done = 0;
  for (const id of ids) { update(state, actorId, id, status, reason); done++; }
  return done;
}

// ───────── 최고 관리자 ─────────
const admin = (state, id) => account(state, id)?.role === 'admin' || fail('최고 관리자 권한이 필요합니다.');
export function adjust(state, adminId, userId, amount, reason) {
  admin(state, adminId);
  amount = int(amount);
  if (!amount || Math.abs(amount) > 1000000) fail('조정 포인트는 0이 아닌 ±1,000,000 이내로 입력해 주세요.');
  if (!String(reason ?? '').trim()) fail('조정 사유를 입력해 주세요.');
  if (amount < 0 && balances(state, userId).available + amount < 0) fail('차감 후 잔액이 0보다 작아집니다.');
  const row = record(state, { userId, type: 'adjust', points: amount, status: 'complete', memo: String(reason).trim().slice(0, 60), handler: adminId });
  notify(state, userId, `관리자 포인트 ${amount > 0 ? '지급' : '차감'}: ${Math.abs(amount).toLocaleString('ko-KR')} P (${row.memo})`, 'app/user/activity');
  log(state, adminId, '포인트 조정', userId, `${amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR')} P · ${row.memo}`);
  return row;
}
export function setMemberStatus(state, adminId, userId, status) {
  admin(state, adminId);
  const target = account(state, userId);
  if (!target || target.role !== 'user' || !['active', 'suspended'].includes(status)) fail('회원 상태를 바꿀 수 없습니다.');
  target.status = status;
  log(state, adminId, status === 'active' ? '이용 정지 해제' : '이용 정지', userId, target.name);
}
export function updatePartner(state, adminId, partnerId, { divisor, min, active }) {
  admin(state, adminId);
  const partner = partnerOf(state, partnerId) ?? fail('제휴사를 찾을 수 없습니다.');
  divisor = int(divisor); min = int(min);
  if (!(divisor >= 1 && divisor <= 20)) fail('교환 비율은 1~20 사이로 입력해 주세요.');
  if (!(min >= divisor) || min % divisor) fail('최소 금액은 교환 비율의 배수여야 합니다.');
  const before = `${partner.divisor}:1 · 최소 ${partner.min}`;
  Object.assign(partner, { divisor, min, active: !!active });
  log(state, adminId, '제휴사 정책 변경', partner.name, `${before} → ${divisor}:1 · 최소 ${min} · ${active ? '운영' : '중지'}`);
}
export function updateProduct(state, adminId, productId, { cost, stock, active }) {
  admin(state, adminId);
  const product = state.products.find(item => item.id === productId) ?? fail('상품을 찾을 수 없습니다.');
  cost = int(cost); stock = int(stock);
  if (!(cost >= 100) || !(stock >= 0)) fail('판매 포인트와 재고를 확인해 주세요.');
  Object.assign(product, { cost, stock, active: !!active });
  log(state, adminId, '상품 수정', product.name, `${cost.toLocaleString('ko-KR')} P · 재고 ${stock} · ${active ? '판매' : '중지'}`);
}
export function updateSettings(state, adminId, input) {
  admin(state, adminId);
  const next = { ...state.settings };
  for (const key of ['fee', 'withdrawalMinimum', 'dailyWithdrawLimit', 'attendancePoints', 'attendanceBonus', 'signupBonus', 'referralBonus', 'giftMinimum']) {
    if (input[key] === undefined) continue;
    const value = int(Number(input[key]));
    if (!(value >= 0)) fail('설정값은 0 이상의 정수여야 합니다.');
    next[key] = value;
  }
  if (next.withdrawalMinimum <= next.fee) fail('최소 출금액은 수수료보다 커야 합니다.');
  next.maintenance = !!input.maintenance;
  state.settings = next;
  log(state, adminId, '설정 변경', '운영 설정', `수수료 ${next.fee} P · 최소 출금 ${next.withdrawalMinimum} P · 출석 ${next.attendancePoints} P`);
}
export function addAnnouncement(state, adminId, { title, body, pinned }) {
  admin(state, adminId);
  title = String(title ?? '').trim(); body = String(body ?? '').trim();
  if (!title || title.length > 60 || !body || body.length > 500) fail('제목(60자)과 내용(500자)을 입력해 주세요.');
  const item = { id: 'n' + Date.now().toString(36), title, body, pinned: !!pinned, visible: true, date: kstDay() };
  state.announcements.unshift(item);
  log(state, adminId, '공지 등록', item.id, title);
  return item;
}
export function toggleAnnouncement(state, adminId, id) {
  admin(state, adminId);
  const item = state.announcements.find(entry => entry.id === id) ?? fail('공지를 찾을 수 없습니다.');
  item.visible = !item.visible;
  log(state, adminId, item.visible ? '공지 노출' : '공지 숨김', id, item.title);
}

// ───────── 고객센터 ─────────
export function openTicket(state, userId, { category, transaction, message }) {
  const target = user(state, userId);
  message = String(message ?? '').trim();
  if (!message || message.length > 500) fail('문의 내용을 1~500자로 입력해 주세요.');
  const linked = state.transactions.find(row => row.id === transaction && row.userId === userId);
  const item = { id: 'T-' + (state.tickets.length + 1) + '-' + Date.now().toString(36), userId, category: category || '기타', transaction: linked?.id ?? '', message, reply: '', status: 'open', date: new Date().toISOString() };
  state.tickets.unshift(item);
  notify(state, 'admin', `새 1:1 문의: ${target.name} · ${item.category}`, 'app/admin/support');
  return item;
}
export function replyTicket(state, adminId, id, reply) {
  admin(state, adminId);
  const item = state.tickets.find(entry => entry.id === id);
  reply = String(reply ?? '').trim();
  if (!item || item.reply) fail('이미 답변했거나 찾을 수 없는 문의입니다.');
  if (!reply || reply.length > 500) fail('답변을 1~500자로 입력해 주세요.');
  Object.assign(item, { reply, status: 'answered', repliedAt: new Date().toISOString() });
  notify(state, item.userId, `1:1 문의에 답변이 등록되었습니다. (${item.category})`, 'app/user/support');
  log(state, adminId, '문의 답변', item.id, item.category);
}

// ───────── 웹하드 관리자 연동 ─────────
export function regenerateKey(state, actorId) {
  const viewer = account(state, actorId);
  const partner = viewer?.role === 'partner' ? partnerOf(state, viewer.partnerId) : fail('웹하드 관리자만 키를 재발급할 수 있습니다.');
  partner.apiKey = 'sp_live_' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  log(state, actorId, 'API 키 재발급', partner.name, '이전 키 즉시 폐기');
  return partner.apiKey;
}
export function setWebhook(state, actorId, url) {
  const viewer = account(state, actorId);
  const partner = viewer?.role === 'partner' ? partnerOf(state, viewer.partnerId) : fail('웹하드 관리자만 변경할 수 있습니다.');
  let parsed;
  try { parsed = new URL(url); } catch { fail('올바른 URL을 입력해 주세요.'); }
  if (parsed.protocol !== 'https:') fail('웹훅 주소는 https:// 로 시작해야 합니다.');
  partner.webhook = parsed.href;
  log(state, actorId, '웹훅 변경', partner.name, parsed.href);
}

// ───────── 통계 ─────────
export function series(rows, days, pick, now = new Date()) {
  const keys = Array.from({ length: days }, (_, i) => kstDay(now.getTime() - (days - 1 - i) * day));
  const sums = Object.fromEntries(keys.map(key => [key, 0]));
  for (const row of rows) {
    const key = kstDay(row.date);
    if (key in sums) sums[key] += pick(row);
  }
  return keys.map(key => ({ key, label: key.slice(5).replace('-', '.'), value: sums[key] }));
}

// ───────── 프로필 이미지 ─────────
export function setAvatar(state, id, index) {
  const target = account(state, id);
  if (!target || !Number.isInteger(index) || !animals[index]) fail('캐릭터를 찾을 수 없습니다.');
  target.avatar = index;
  return target;
}
export function setPhoto(state, id, photo) {
  const target = account(state, id);
  photo = String(photo ?? '');
  if (photo && (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(photo) || photo.length > 400000)) fail('사진 형식 또는 크기를 확인해 주세요.');
  target.photo = photo;
  return target;
}

// ───────── 관리자: 운영진·제휴사·상품 생성 ─────────
export function createStaff(state, adminId, { role, partnerId, name, email, password }) {
  admin(state, adminId);
  if (!['partner', 'admin'].includes(role)) fail('역할을 선택해 주세요.');
  if (role === 'partner' && !partnerOf(state, partnerId)) fail('담당 제휴사를 선택해 주세요.');
  name = String(name ?? '').trim(); email = String(email ?? '').trim();
  if (name.length < 2 || name.length > 20) fail('이름은 2~20자로 입력해 주세요.');
  if (!emailPattern.test(email)) fail('올바른 이메일 주소를 입력해 주세요.');
  if (byEmail(state, email)) fail('이미 사용 중인 이메일입니다.');
  const pw = String(password ?? '');
  if (pw.length < 8 || !/[a-z]/i.test(pw) || !/\d/.test(pw)) fail('초기 비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.');
  const created = { id: (role === 'admin' ? 'a' : 'p') + Date.now().toString(36), role, ...(role === 'partner' ? { partnerId } : {}), name, email, phone: '', provider: 'email', status: 'active', createdAt: new Date().toISOString(), password: security.hash(pw), avatar: Math.floor(Math.random() * animals.length), photo: '' };
  state.accounts.push(created);
  log(state, adminId, '운영진 계정 생성', email, `${role === 'admin' ? '최고 관리자' : partnerOf(state, partnerId).name + ' 담당자'} · ${name}`);
  return created;
}
export function setStaffStatus(state, adminId, id, status) {
  admin(state, adminId);
  const target = account(state, id);
  if (!target || target.role === 'user' || !['active', 'suspended'].includes(status)) fail('운영진 계정을 찾을 수 없습니다.');
  if (target.id === adminId) fail('본인 계정은 정지할 수 없습니다.');
  if (status === 'suspended' && target.role === 'admin' && state.accounts.filter(a => a.role === 'admin' && a.status === 'active').length < 2) fail('활성 최고 관리자가 최소 1명 필요합니다.');
  target.status = status;
  log(state, adminId, status === 'active' ? '운영진 활성화' : '운영진 정지', target.email, target.name);
}
export function resetPassword(state, adminId, id) {
  admin(state, adminId);
  const target = account(state, id) ?? fail('계정을 찾을 수 없습니다.');
  if (!target.password) fail('소셜 로그인 계정은 비밀번호가 없습니다.');
  const temp = 'Sp' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
  target.password = security.hash(temp);
  log(state, adminId, '비밀번호 초기화', target.email, target.name);
  notify(state, target.id, '관리자가 비밀번호를 초기화했습니다. 로그인 후 비밀번호를 변경해 주세요.', `app/${target.role}/profile`);
  return temp;
}
export function createPartner(state, adminId, { name, type, divisor, min, approval }) {
  admin(state, adminId);
  name = String(name ?? '').trim();
  divisor = int(Number(divisor)); min = int(Number(min));
  if (name.length < 2 || name.length > 20) fail('제휴사 이름은 2~20자로 입력해 주세요.');
  if (state.partners.some(p => p.name === name)) fail('이미 등록된 제휴사입니다.');
  if (!(divisor >= 1 && divisor <= 20) || !(min >= divisor) || min % divisor) fail('교환 비율과 최소 금액(비율의 배수)을 확인해 주세요.');
  const colors = ['green', 'blue', 'peach', 'violet'];
  const id = 'w' + Date.now().toString(36);
  const partner = { id, name, initials: name[0], color: colors[state.partners.length % colors.length], type: String(type || '판매 적립').slice(0, 20), divisor, min, approval: String(approval || '평균 1일').slice(0, 20), active: false,
    apiKey: 'sp_live_' + Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join(''), webhook: '', ip: '' };
  state.partners.push(partner);
  log(state, adminId, '제휴사 등록', name, `${divisor}:1 · 최소 ${min} · 등록 직후 일시 중지 상태`);
  return partner;
}
export function createProduct(state, adminId, { name, brand, category, cost, stock }) {
  admin(state, adminId);
  name = String(name ?? '').trim(); brand = String(brand ?? '').trim();
  cost = int(Number(cost)); stock = int(Number(stock));
  if (!name || name.length > 40 || !brand || brand.length > 20) fail('상품명(40자)과 브랜드(20자)를 입력해 주세요.');
  if (!['카페', '외식', '편의점', '디저트', '문화', '상품권'].includes(category)) fail('분류를 선택해 주세요.');
  if (!(cost >= 100) || !(stock >= 0)) fail('판매 포인트와 재고를 확인해 주세요.');
  const product = { id: 'g' + Date.now().toString(36), name, brand, category, cost, stock, active: true };
  state.products.push(product);
  log(state, adminId, '상품 등록', name, `${cost.toLocaleString('ko-KR')} P · 재고 ${stock}`);
  return product;
}

// ───────── 연동 기록 ─────────
export function apiLog(state, entry) {
  state.apiLogs ??= [];
  state.apiLogs.unshift({ id: 'A-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date: new Date().toISOString(), ...entry });
  state.apiLogs.length = Math.min(state.apiLogs.length, 500);
}

// ───────── 공개 통계 · 역할별 스냅샷 ─────────
export function publicStats(state) {
  return {
    exchanged: state.transactions.filter(row => row.type === 'exchange' && row.status === 'complete').reduce((sum, row) => sum + row.points, 0),
    members: state.accounts.filter(item => item.role === 'user').length,
  };
}
const publicPartner = ({ apiKey, webhook, ip, ...rest }) => rest;
const brief = a => ({ id: a.id, role: a.role, name: a.name, avatar: a.avatar, photo: a.photo, provider: a.provider, status: a.status, createdAt: a.createdAt });
const privateAccount = ({ password, ...rest }) => ({ ...rest, password: password ? 'set' : '' });

// 서버가 브라우저로 보내는 데이터. 역할에 따라 볼 수 있는 범위만 담는다.
export function snapshot(state, viewer) {
  const base = {
    version: 2, seq: state.seq, settings: state.settings, products: state.products,
    announcements: state.announcements.filter(item => viewer?.role === 'admin' || item.visible),
    stats: publicStats(state), session: viewer ? { accountId: viewer.id } : null,
    partners: state.partners.map(publicPartner), accounts: [], transactions: [], tickets: [], notifications: [], audit: [], attendance: {}, apiLogs: [], webhooks: [],
  };
  if (!viewer) return base;
  const mine = notificationsFor(state, viewer);
  if (viewer.role === 'admin') {
    return { ...base, ...state, partners: state.partners, accounts: state.accounts.map(privateAccount), notifications: mine, session: base.session, stats: base.stats };
  }
  if (viewer.role === 'partner') {
    const rows = state.transactions.filter(row => row.type === 'exchange' && row.partner === viewer.partnerId);
    const ids = new Set(rows.map(row => row.userId));
    return { ...base, partners: state.partners.map(p => p.id === viewer.partnerId ? p : publicPartner(p)),
      accounts: [privateAccount(viewer), ...state.accounts.filter(a => ids.has(a.id)).map(brief)], transactions: rows, notifications: mine,
      apiLogs: (state.apiLogs ?? []).filter(item => item.partner === viewer.partnerId).slice(0, 100), webhooks: (state.webhooks ?? []).filter(item => item.partner === viewer.partnerId).slice(0, 50) };
  }
  const rows = state.transactions.filter(row => row.userId === viewer.id);
  const others = new Set(rows.map(row => row.counterpart).filter(Boolean));
  return { ...base, accounts: [privateAccount(viewer), ...state.accounts.filter(a => others.has(a.id)).map(brief)], transactions: rows,
    tickets: state.tickets.filter(item => item.userId === viewer.id), notifications: mine, attendance: { [viewer.id]: state.attendance[viewer.id] ?? [] } };
}

// 웹훅은 대기열에 쌓고, 실서버(server.mjs)가 비동기로 전송해 결과를 기록한다.
export function queueWebhook(state, partnerId, event, data) {
  state.webhooks ??= [];
  state.webhooks.unshift({ id: 'W-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), partner: partnerId, event, data, status: 'queued', attempts: 0, date: new Date().toISOString() });
  state.webhooks.length = Math.min(state.webhooks.length, 300);
}
