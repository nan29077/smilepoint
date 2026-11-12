import { animals, announcementSeeds, banks, grades, partnerSeeds, productSeeds, testPassword, ticketCategories } from './catalog.js';

export const storageKey = 'smilepoint-demo-v2';
export const types = {
  exchange: '포인트 교환', withdrawal: '계좌 출금', coupon: '쿠폰 구매', attendance: '출석체크',
  reward: '이벤트 적립', adjust: '관리자 조정', gift_out: '포인트 선물', gift_in: '선물 받음', reversal: '교환 회수',
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
  tokenHash: text => hashPassword('token:' + text),
  token: () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join(''),
  verify: (text, stored) => !!stored && stored === hashPassword(text),
};
// extra.keep: 실패해도 변경(시도 횟수 등)을 저장한다 · extra.need: 화면이 추가 입력을 요청할 때 (예: 'otp', 'terms')
export class AppError extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}
const fail = (message, status, extra) => { throw new AppError(message, status, extra); };
const int = value => Number.isSafeInteger(value) ? value : NaN;

// 보안 난수 (브라우저·Node 22 공통 Web Crypto). 편향 없이 문자를 고른다.
export function randomChars(alphabet, length) {
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    for (const byte of globalThis.crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit) out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}
export const randomDigits = length => randomChars('0123456789', length);
export const newApiKey = () => 'sp_live_' + randomChars('0123456789abcdef', 32);
const clip = (value, max) => String(value ?? '').trim().slice(0, max);
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
    settings: { fee: 500, withdrawalMinimum: 5000, dailyWithdrawLimit: 500000, attendancePoints: 10, attendanceBonus: 50, signupBonus: 1000, referralBonus: 500, giftMinimum: 1000, dailyGiftLimit: 100000, maintenance: false, mockWebhardBalance: true },
    session: null,
    partners: partnerSeeds.map((item, i) => ({ ...item, apiKey: newApiKey(), webhook: `https://api.${item.id}.example.com/smilepoint/webhook`, ip: `203.0.113.${10 + i}`, dailyLimit: 1000000, reviewOver: 100000 })),
    products: productSeeds.map(item => ({ ...item })),
    announcements: announcementSeeds.map(item => ({ ...item })),
    accounts: [
      { id: 'u1', role: 'user', name: '스마일 회원', email: 'user@smilepoint.kr', phone: '010-3070-1004', provider: 'email', status: 'active', createdAt: at(120), referral: 'SMILE3070',
        bank: { bank: '국민은행', number: '123401043070', holder: '스마일 회원', verified: true },
        links: { green: { loginId: 'smile_green', balance: 128000, linkedAt: at(90), verified: true }, cloud: { loginId: 'smile_cloud', balance: 22000, linkedAt: at(60), verified: true } },
        notify: { email: true, sms: true, marketing: false } },
      { id: 'p1', role: 'partner', partnerId: 'green', name: '그린파일 담당자', email: 'partner@smilepoint.kr', phone: '02-3070-2000', provider: 'email', status: 'active', createdAt: at(150) },
      { id: 'p2', role: 'partner', partnerId: 'cloud', name: '클라우드박스 담당자', email: 'cloud@smilepoint.kr', phone: '02-3070-3000', provider: 'email', status: 'active', createdAt: at(140) },
      { id: 'a1', role: 'admin', name: '서비스 운영자', email: 'admin@smilepoint.kr', phone: '02-3070-0000', provider: 'email', status: 'active', createdAt: at(200) },
      ...people.map(([id, name, email, provider], i) => ({
        id, role: 'user', name, email, phone: '010-' + code(random, 4) + '-' + code(random, 4), provider, status: i === 6 ? 'suspended' : 'active', createdAt: at(10 + i * 9),
        referral: 'SP' + code(random, 6),
        bank: i % 3 === 2 ? null : { bank: ['신한은행', '카카오뱅크', '우리은행', '토스뱅크'][i % 4], number: code(random, 12), holder: name, verified: true },
        links: Object.fromEntries(partnerSeeds.filter((_, p) => (i + p) % 2 === 0).map(p => [p.id, { loginId: email.split('@')[0] + '_' + p.id, balance: 20000 + Math.floor(random() * 60) * 1000, linkedAt: at(8 + i), verified: true }])),
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
  push({ userId: 'u1', type: 'coupon', product: 'coffee', points: 4500, status: 'complete', date: at(5, 13), coupon: { code: randomDigits(12), expires: at(-85), used: false, revealed: false } });
  push({ userId: 'u1', type: 'withdrawal', points: 8000, fee: 500, status: 'complete', date: at(4, 9), updated: at(3, 10), bank: '국민은행 ••••3070' });
  push({ userId: 'u1', type: 'coupon', product: 'market', points: 5000, status: 'complete', date: at(3, 19), coupon: { code: randomDigits(12), expires: at(-87), used: true, revealed: true } });
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
      if (product.cost < earned) push({ userId: account.id, type: 'coupon', product: product.id, points: product.cost, status: 'complete', date: at(Math.floor(random() * 10), 12), coupon: { code: randomDigits(12), expires: at(-80), used: random() < .5, revealed: true } });
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
  state.webhardBalances = {};
  for (const item of state.accounts) for (const [partnerId, link] of Object.entries(item.links ?? {})) {
    state.webhardBalances[ledgerKey(partnerId, link.loginId)] = link.balance;
    delete link.balance;
  }
  for (const row of state.transactions) if (row.type === 'exchange') row.member = account(state, row.userId)?.links?.[row.partner]?.loginId;
  state.events = [{ id: 'e1', partner: 'disk', rate: 5, until: '2026-11-30', firstOnly: true, active: true, title: '디스크온 첫 교환 5% 추가 적립' }];
  return state;
}

// 운영 모드(DEMO_MODE=off)의 첫 데이터: 샘플 회원·거래 없이 최고 관리자 1명으로 시작한다.
export function productionState({ adminEmail, adminName = '서비스 운영자', passwordHash }) {
  const fresh = freshState();
  return {
    version: 2, seq: 1000, settings: { ...fresh.settings, mockWebhardBalance: false }, session: null,
    partners: [], products: [], announcements: [], events: [],
    accounts: [{ id: 'a1', role: 'admin', name: adminName, email: adminEmail, phone: '', provider: 'email', status: 'active', createdAt: new Date().toISOString(), password: passwordHash, avatar: 0, photo: '' }],
    transactions: [], tickets: [], notifications: [], audit: [], attendance: {}, apiLogs: [], webhooks: [], webhardBalances: {}, resets: [], settlements: {},
  };
}

export function load(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (saved?.version === 2 && Array.isArray(saved.accounts) && Array.isArray(saved.transactions)) return normalize(saved, true);
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
  if (target.status !== 'active') fail(target.status === 'deleted' ? '탈퇴한 계정입니다.' : '이용이 정지된 계정입니다. 고객센터로 문의해 주세요.');
  state.session = { accountId: target.id, method, at: new Date().toISOString() };
  target.lastLogin = state.session.at;
  return target;
}

export function login(state, email, password, otp = '') {
  const target = byEmail(state, email);
  if (!target || !security.verify(String(password ?? ''), target.password)) fail('이메일 또는 비밀번호가 일치하지 않습니다.', 401);
  // 2단계 인증(OTP)을 켠 계정은 인증 앱의 6자리 코드까지 확인한다.
  if (target.totp?.enabled) {
    if (!String(otp ?? '').trim()) fail('인증 앱의 6자리 코드를 입력해 주세요.', 401, { need: 'otp' });
    const step = security.totpCheck?.(target.totp.secret, String(otp).trim(), target.totp.last);
    if (step === null || step === undefined) fail('인증 코드가 올바르지 않습니다.', 401, { need: 'otp' });
    target.totp.last = step;
  }
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
  if (input.referral && (!referrer || referrer.role !== 'user' || referrer.status !== 'active')) fail('추천인 코드를 찾을 수 없습니다.');
  const phone = String(input.phone ?? '').trim();
  if (!/^[0-9+\-\s()]{0,20}$/.test(phone)) fail('휴대폰 번호는 숫자와 - 만 입력해 주세요.');
  const created = {
    id: 'u' + (state.accounts.length + 1) + '-' + now.getTime().toString(36), role: 'user', name, email, phone,
    provider: input.provider || 'email', status: 'active', createdAt: now.toISOString(), referral: uniqueReferral(state),
    password: input.provider && input.provider !== 'email' ? '' : security.hash(input.password), avatar: Math.floor(Math.random() * animals.length), photo: '',
    bank: null, links: {}, notify: { email: true, sms: false, marketing: !!input.marketing }, ...(referrer ? { referredBy: referrer.id, referralPaid: false } : {}),
    consent: { terms: now.toISOString(), privacy: now.toISOString(), marketing: input.marketing ? now.toISOString() : null },
  };
  state.accounts.push(created);
  // 가입·추천 보너스는 '적립 예정'으로 두었다가 첫 포인트 교환이 완료되면 지급한다 (다계정 가입으로 쿠폰을 뽑아 가는 악용 방지).
  const held = (points, memo) => points > 0 && record(state, { userId: created.id, type: 'reward', points, status: 'pending', memo, hold: 'first-exchange' });
  held(state.settings.signupBonus, '회원가입 축하 포인트');
  if (referrer) {
    held(state.settings.referralBonus, '추천인 코드 입력 보너스');
    notify(state, referrer.id, `${name}님이 추천 코드로 가입했어요. 첫 포인트 교환이 완료되면 ${state.settings.referralBonus} P를 드려요.`, 'app/user/gift');
  }
  const bonus = state.settings.signupBonus + (referrer ? state.settings.referralBonus : 0);
  notify(state, created.id, bonus > 0 ? `가입을 환영합니다! 첫 포인트 교환이 완료되면 ${bonus.toLocaleString('ko-KR')} P를 드려요.` : '가입을 환영합니다!', 'app/user/overview');
  notify(state, 'admin', `신규 회원 가입: ${name}`, 'app/admin/members');
  startSession(state, created, created.provider);
  return created;
}

// profile: 실제 OAuth 연동 시 { id, name, email, emailVerified } — 없으면 데모 회원으로 처리한다.
// consent: 처음 가입하는 경우에만 필요 { terms, privacy, age, marketing }. 없으면 need: 'terms' 오류로 동의 화면을 요청한다.
export function socialLogin(state, provider, profile = null, now = new Date(), consent = null) {
  if (!['kakao', 'naver', 'google', 'apple'].includes(provider)) fail('지원하지 않는 로그인 방식입니다.');
  const socialId = profile?.id ? String(profile.id) : 'demo';
  const existing = state.accounts.find(item => item.role === 'user' && item.social?.[provider] === socialId);
  if (existing) return startSession(state, existing, provider);
  const names = { kakao: '카카오 회원', naver: '네이버 회원', google: 'Google 회원', apple: 'Apple 회원' };
  const email = profile?.email && emailPattern.test(profile.email) ? String(profile.email).trim() : '';
  const sameEmail = email ? byEmail(state, email) : null;
  // 인증된 이메일일 때만 기존 계정에 연결한다. (미인증 이메일로 남의 계정에 들어가는 것을 막음)
  if (sameEmail && profile?.emailVerified && sameEmail.role === 'user') {
    sameEmail.social = { ...(sameEmail.social ?? {}), [provider]: socialId };
    return startSession(state, sameEmail, provider);
  }
  if (!consent?.terms || !consent?.privacy || !consent?.age) fail('처음 가입하는 경우 필수 약관에 동의해 주세요.', 400, { need: 'terms' });
  let name = String(profile?.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) name = names[provider];
  const created = signup(state, {
    provider, name: name.slice(0, 20), email: email && !sameEmail ? email : `${provider}.${now.getTime().toString(36)}${randomChars('abcdefghijklmnopqrstuvwxyz0123456789', 4)}@social.smilepoint.kr`,
    terms: true, privacy: true, age: true, marketing: !!consent.marketing,
  }, now);
  created.social = { [provider]: socialId };
  return created;
}

export function updateProfile(state, id, { name, phone, notify: prefs }) {
  const target = account(state, id);
  if (name !== undefined) {
    const value = String(name).trim().replace(/\s+/g, ' ');
    if (!value || value.length > 24) fail('표시 이름은 1~24자로 입력해 주세요.');
    // 출금 계좌 예금주 확인에 이름을 쓰므로, 계좌를 등록(또는 인증 중)한 회원은 이름을 바꿀 수 없다.
    if (value !== target.name && target.role === 'user' && (target.bank || target.bankRequest)) fail('출금 계좌를 등록한 회원은 이름을 바꿀 수 없습니다. 고객센터로 문의해 주세요.');
    target.name = value;
  }
  if (phone !== undefined) {
    const value = String(phone).trim();
    if (!/^[0-9+\-\s()]{0,20}$/.test(value)) fail('연락처는 숫자와 - 만 20자 이내로 입력해 주세요.');
    target.phone = value;
  }
  if (prefs && typeof prefs === 'object') {
    const next = { ...(target.notify ?? {}) };
    for (const key of ['email', 'sms', 'marketing']) if (key in prefs) next[key] = !!prefs[key];
    target.notify = next;
  }
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
  const exchanged = state.transactions.filter(row => row.userId === userId && row.type === 'exchange' && row.status === 'complete' && !row.reversed).reduce((sum, row) => sum + row.points, 0);
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
export const ledgerKey = (partnerId, loginId) => partnerId + ':' + String(loginId).toLowerCase();
const verifiedOwner = (state, partnerId, loginId, exceptId) => state.accounts.find(item => item.id !== exceptId && item.links?.[partnerId]?.verified && item.links[partnerId].loginId.toLowerCase() === loginId.toLowerCase());
const LINK_TTL = 10 * 60000;

// 웹하드 계정 연결 1단계: 아이디를 받으면 6자리 인증번호를 만들어 제휴사로 보낸다 (웹훅 member.link_requested 또는
// 제휴사 API GET /api/v1/link-requests). 제휴사는 그 아이디의 회원에게만(웹하드 쪽지·알림 등) 번호를 전달하고,
// 회원이 번호를 입력해야 연결이 완료된다. 남의 아이디를 입력해도 번호를 받을 수 없으므로 연결·교환할 수 없다.
export function linkPartner(state, userId, partnerId, loginId) {
  const target = user(state, userId);
  const partner = partnerOf(state, partnerId) ?? fail('제휴사를 찾을 수 없습니다.');
  if (!partner.active) fail('현재 연결할 수 없는 제휴사입니다.');
  const id = String(loginId ?? '').trim();
  if (!/^[a-z0-9_.-]{4,20}$/i.test(id)) fail('웹하드 아이디는 영문·숫자 4~20자로 입력해 주세요.');
  if (target.links[partnerId]?.verified) fail('이미 연결된 웹하드입니다.');
  if (verifiedOwner(state, partnerId, id, userId)) fail('이미 다른 회원이 연결한 웹하드 아이디입니다.');
  const today = kstDay();
  const tries = (target.linkTries ?? []).filter(item => item.day === today);
  if (tries.length >= 10) fail('오늘 인증 요청 횟수를 넘었습니다. 내일 다시 시도해 주세요.', 429);
  target.linkTries = [...tries, { day: today, partner: partnerId }];
  const code = randomDigits(6);
  const now = Date.now();
  target.links[partnerId] = { loginId: id, verified: false, requestedAt: new Date(now).toISOString(), pending: { code, expires: now + LINK_TTL, attempts: 0 } };
  queueWebhook(state, partnerId, 'member.link_requested', { member: id, code, expiresAt: new Date(now + LINK_TTL).toISOString() });
  return { loginId: id, pending: true, code, expiresAt: new Date(now + LINK_TTL).toISOString() };
}
// 웹하드 계정 연결 2단계: 회원이 받은 인증번호를 입력한다. 틀린 횟수는 실패해도 저장한다(keep).
export function confirmLink(state, userId, partnerId, code) {
  const target = user(state, userId);
  const partner = partnerOf(state, partnerId) ?? fail('제휴사를 찾을 수 없습니다.');
  const link = target.links[partnerId];
  if (!link || link.verified || !link.pending) fail('인증을 요청한 웹하드가 없습니다. 계정 연결부터 진행해 주세요.');
  if (link.pending.expires < Date.now()) fail('인증번호가 만료되었습니다. 다시 요청해 주세요.');
  if (link.pending.attempts >= 5) fail('인증번호를 5회 잘못 입력했습니다. 다시 요청해 주세요.');
  if (String(code ?? '').trim() !== link.pending.code) {
    link.pending.attempts += 1;
    fail(`인증번호가 일치하지 않습니다. (${5 - link.pending.attempts}회 남음)`, 400, { keep: true });
  }
  if (verifiedOwner(state, partnerId, link.loginId, userId)) fail('이미 다른 회원이 연결한 웹하드 아이디입니다.');
  // 같은 아이디로 인증 대기 중이던 다른 회원의 요청은 정리한다.
  for (const other of state.accounts) if (other.id !== userId && other.links?.[partnerId] && !other.links[partnerId].verified && other.links[partnerId].loginId.toLowerCase() === link.loginId.toLowerCase()) delete other.links[partnerId];
  state.webhardBalances ??= {};
  const key = ledgerKey(partnerId, link.loginId);
  // 데모: 웹하드 잔액을 아이디별로 한 번만 만들고 계속 유지한다 (연결 해제·재연결로 잔액이 늘지 않음).
  if (state.settings.mockWebhardBalance && !(key in state.webhardBalances)) {
    const balance = 10000 + (([...link.loginId.toLowerCase()].reduce((sum, c) => sum + c.charCodeAt(0), 0) * 37) % 40) * 1000;
    state.webhardBalances[key] = balance - (balance % partner.divisor);
  }
  target.links[partnerId] = { loginId: link.loginId, linkedAt: new Date().toISOString(), verified: true };
  queueWebhook(state, partnerId, 'member.linked', { member: link.loginId });
  return { ...target.links[partnerId], balance: partnerAvailable(state, userId, partnerId) };
}
export function unlinkPartner(state, userId, partnerId) {
  const target = user(state, userId);
  if (state.transactions.some(row => row.userId === userId && row.partner === partnerId && row.status === 'pending')) fail('처리 대기 중인 교환이 있어 연결을 해제할 수 없습니다.');
  const link = target.links[partnerId];
  delete target.links[partnerId];
  if (link?.verified) queueWebhook(state, partnerId, 'member.unlinked', { member: link.loginId });
}
// 제휴사가 회원에게 전달할 인증번호 목록 (제휴사 API·화면용)
export function linkRequests(state, partnerId, now = Date.now()) {
  return state.accounts.flatMap(item => {
    const link = item.links?.[partnerId];
    return link && !link.verified && link.pending && link.pending.expires > now && link.pending.attempts < 5
      ? [{ member: link.loginId, code: link.pending.code, requestedAt: link.requestedAt, expiresAt: new Date(link.pending.expires).toISOString() }] : [];
  });
}
// 교환 가능 잔액. 운영 모드에서는 웹하드가 승인 시 직접 확인하므로 null(알 수 없음)을 돌려준다.
export function partnerAvailable(state, userId, partnerId) {
  const link = account(state, userId)?.links?.[partnerId];
  if (!link || !link.verified) return 0;
  if (state.available && state.session?.accountId === userId && partnerId in state.available) return state.available[partnerId]; // 서버가 계산해 보낸 값
  if (!state.settings.mockWebhardBalance) return null;
  const base = state.webhardBalances?.[ledgerKey(partnerId, link.loginId)] ?? link.balance ?? 0;
  const member = link.loginId.toLowerCase();
  const used = state.transactions
    .filter(row => row.type === 'exchange' && row.partner === partnerId && ['pending', 'complete'].includes(row.status) && !row.reversed && (row.member ? row.member.toLowerCase() === member : row.userId === userId))
    .reduce((sum, row) => sum + row.source, 0);
  return Math.max(0, base - used);
}
export function exchange(state, userId, partnerId, amount) {
  user(state, userId);
  const partner = partnerOf(state, partnerId);
  if (!partner?.active) fail('현재 교환할 수 없는 제휴사입니다.');
  if (!account(state, userId).links[partnerId]?.verified) fail('먼저 웹하드 계정을 연결하고 인증을 완료해 주세요.');
  amount = int(amount);
  const available = partnerAvailable(state, userId, partnerId);
  if (!(amount >= partner.min) || (available !== null && amount > available) || amount % partner.divisor || amount > 10000000) fail('교환 가능 잔액, 최소 금액과 교환 단위를 확인해 주세요.');
  const row = record(state, { userId, type: 'exchange', partner: partnerId, member: account(state, userId).links[partnerId].loginId, source: amount, points: amount / partner.divisor, rate: partner.divisor, status: 'pending' });
  notify(state, 'partner:' + partnerId, `새 교환 신청이 접수되었습니다. (${amount.toLocaleString('ko-KR')} P)`, 'app/partner/requests');
  queueWebhook(state, partnerId, 'exchange.requested', { exchangeId: row.id, member: account(state, userId).links[partnerId].loginId, amount, points: row.points, rate: row.rate });
  return row;
}

// ───────── 계좌·출금 ─────────
// 출금 계좌 등록 1단계(1원 인증): 계좌로 1원을 보내며 입금자명에 4자리 숫자를 넣고, 회원이 그 숫자를 입력하면 인증된다.
// 서버는 BANK_VERIFY_URL(지급대행·펌뱅킹 업체)이 있으면 그곳으로 송금을 요청하고, 없으면 최고 관리자가 확인 후 승인한다.
const BANK_TTL = 30 * 60000;
export function setBank(state, userId, { bank, number, holder }) {
  const target = user(state, userId);
  const digits = String(number ?? '').replace(/\D/g, '');
  if (!banks.includes(bank)) fail('은행을 목록에서 선택해 주세요.');
  if (digits.length < 10 || digits.length > 16) fail('계좌번호는 숫자 10~16자리로 입력해 주세요.');
  if (String(holder ?? '').trim() !== target.name) fail(`예금주가 회원 이름(${target.name})과 일치해야 합니다.`);
  if (state.transactions.some(row => row.userId === userId && row.type === 'withdrawal' && row.status === 'pending')) fail('처리 중인 출금이 있어 계좌를 바꿀 수 없습니다.');
  if (state.accounts.some(item => item.id !== userId && item.bank?.bank === bank && item.bank?.number === digits)) fail('다른 계정에 등록된 계좌입니다. 고객센터로 문의해 주세요.');
  const today = kstDay();
  const tries = (target.bankTries ?? []).filter(day => day === today);
  if (tries.length >= 5) fail('오늘 계좌 인증 요청 횟수를 넘었습니다. 내일 다시 시도해 주세요.', 429);
  target.bankTries = [...tries, today];
  const code = randomDigits(4);
  target.bankRequest = { bank, number: digits, holder: target.name, code, expires: Date.now() + BANK_TTL, attempts: 0, requestedAt: new Date().toISOString() };
  return { requested: true, bank, masked: '••••' + digits.slice(-4), code, expiresAt: new Date(target.bankRequest.expires).toISOString() };
}
function finishBank(state, target) {
  const request = target.bankRequest;
  if (state.accounts.some(item => item.id !== target.id && item.bank?.bank === request.bank && item.bank?.number === request.number)) fail('다른 계정에 등록된 계좌입니다. 고객센터로 문의해 주세요.');
  target.bank = { bank: request.bank, number: request.number, holder: request.holder, verified: true, verifiedAt: new Date().toISOString() };
  delete target.bankRequest;
  return target.bank;
}
export function confirmBank(state, userId, code) {
  const target = user(state, userId);
  const request = target.bankRequest ?? fail('인증 중인 계좌가 없습니다. 계좌를 다시 등록해 주세요.');
  if (request.expires < Date.now()) fail('인증 시간이 지났습니다. 계좌를 다시 등록해 주세요.');
  if (request.attempts >= 5) fail('인증번호를 5회 잘못 입력했습니다. 계좌를 다시 등록해 주세요.');
  if (String(code ?? '').trim() !== request.code) {
    request.attempts += 1;
    fail(`입금자명의 숫자 4자리가 일치하지 않습니다. (${5 - request.attempts}회 남음)`, 400, { keep: true });
  }
  return finishBank(state, target);
}
export function cancelBankRequest(state, userId) { delete user(state, userId).bankRequest; }
export function approveBank(state, adminId, userId) {
  admin(state, adminId);
  const target = account(state, userId);
  if (!target?.bankRequest) fail('인증 대기 중인 계좌가 없습니다.');
  const bank = finishBank(state, target);
  notify(state, target.id, `출금 계좌(${bank.bank} ••••${bank.number.slice(-4)}) 인증이 완료되었습니다.`, 'app/user/withdrawal');
  log(state, adminId, '계좌 인증 승인', target.id, `${target.name} · ${bank.bank} ••••${bank.number.slice(-4)}`);
  return { bank: bank.bank };
}
// 지급 담당 관리자가 출금 건의 실제 계좌번호를 확인한다 (화면 데이터에는 끝 4자리만 내려간다). 열람은 감사 기록에 남는다.
export function payoutAccount(state, adminId, id) {
  admin(state, adminId);
  const row = state.transactions.find(item => item.id === id && item.type === 'withdrawal') ?? fail('출금 건을 찾을 수 없습니다.');
  const owner = account(state, row.userId);
  if (!owner?.bank) fail('회원의 출금 계좌 정보가 없습니다.');
  log(state, adminId, '지급 계좌 열람', row.id, `${owner.name} · ${owner.bank.bank}`);
  return { bank: owner.bank.bank, number: owner.bank.number, holder: owner.bank.holder };
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
      coupon: { code: randomDigits(12), expires: new Date(Date.now() + 90 * day).toISOString(), used: false, revealed: false } }));
  }
  return rows;
}
export function setCouponUsed(state, userId, id, used = true) {
  const row = state.transactions.find(item => item.id === id && item.userId === userId && item.type === 'coupon' && item.status === 'complete') ?? fail('쿠폰을 찾을 수 없습니다.');
  row.coupon.used = !!used;
  if (used) row.coupon.revealed ||= new Date().toISOString();
  return row;
}
// 쿠폰 번호는 회원이 '번호 보기'를 누를 때 처음 공개한다. 번호를 본 쿠폰은 회원이 직접 취소·환불할 수 없다
// (매장에서 쓰고 취소해 포인트를 돌려받는 악용 방지). 실제 사용 여부는 쿠폰 공급사 API 연동 시 공급사가 확인한다.
export function revealCoupon(state, userId, id) {
  const row = state.transactions.find(item => item.id === id && item.userId === userId && item.type === 'coupon' && item.status === 'complete') ?? fail('쿠폰을 찾을 수 없습니다.');
  if (!row.coupon.revealed) row.coupon.revealed = new Date().toISOString();
  return { id: row.id, code: row.coupon.code, expires: row.coupon.expires };
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
export function giftedToday(state, userId) {
  const today = kstDay();
  return state.transactions.filter(row => row.userId === userId && row.type === 'gift_out' && row.status === 'complete' && kstDay(row.date) === today).reduce((sum, row) => sum + row.points, 0);
}
export function gift(state, userId, email, amount, message = '') {
  const sender = user(state, userId);
  const receiver = byEmail(state, email);
  amount = int(amount);
  // 받는 분이 없거나 받을 수 없는 계정이면 같은 문구로 안내한다 (가입 여부 노출 방지).
  if (!receiver || receiver.role !== 'user' || receiver.status !== 'active' || receiver.id === userId) fail('선물할 수 없는 이메일입니다. 받는 분의 가입 이메일을 확인해 주세요.');
  if (!state.transactions.some(row => row.userId === userId && row.type === 'exchange' && row.status === 'complete')) fail('포인트 교환을 1회 이상 완료한 뒤 선물할 수 있습니다.');
  if (!(amount >= state.settings.giftMinimum) || amount > balances(state, userId).available) fail(`선물은 ${state.settings.giftMinimum.toLocaleString('ko-KR')} P 이상, 사용 가능 포인트 이내로 보낼 수 있습니다.`);
  if (giftedToday(state, userId) + amount > (state.settings.dailyGiftLimit ?? 100000)) fail('오늘 선물 한도를 넘었습니다.');
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
  // 회원은 교환·출금 신청만, 제휴사가 승인하기 전까지 취소할 수 있다.
  if (viewer.role === 'user') return status === 'canceled' && row.userId === viewer.id && ['exchange', 'withdrawal'].includes(row.type) && !row.partnerApproved;
  if (!['complete', 'rejected'].includes(status)) return false;
  if (viewer.role === 'admin') return ['exchange', 'withdrawal'].includes(row.type);
  return viewer.role === 'partner' && row.type === 'exchange' && row.partner === viewer.partnerId && !row.partnerApproved;
}
// 제휴사 승인 금액이 고액(reviewOver 초과)이거나 제휴사 일일 승인 한도(dailyLimit)를 넘으면 바로 적립하지 않고 최고 관리자 2차 승인으로 넘긴다.
export function approvedToday(state, partnerId, today = kstDay()) {
  return state.transactions.filter(row => row.type === 'exchange' && row.partner === partnerId && row.status === 'complete' && kstDay(row.updated ?? row.date) === today).reduce((sum, row) => sum + row.points, 0);
}
function needsReview(state, row) {
  const partner = partnerOf(state, row.partner);
  const reasons = [];
  if (partner?.reviewOver > 0 && row.points > partner.reviewOver) reasons.push(`고액(${partner.reviewOver.toLocaleString('ko-KR')} P 초과)`);
  if (partner?.dailyLimit > 0 && approvedToday(state, row.partner) + row.points > partner.dailyLimit) reasons.push('제휴사 일일 승인 한도 초과');
  return reasons.join(' · ');
}
export function update(state, actorId, id, status, reason = '') {
  const viewer = account(state, actorId);
  const row = state.transactions.find(item => item.id === id);
  if (!canUpdate(row, viewer, status)) fail('이 거래는 해당 상태로 변경할 수 없습니다.');
  if (status === 'rejected' && !String(reason).trim()) fail('반려 사유를 입력해 주세요.');
  const owner = account(state, row.userId);
  const amount = row.points.toLocaleString('ko-KR');
  if (status === 'complete' && row.type === 'exchange' && viewer.role === 'partner') {
    const review = needsReview(state, row);
    if (review) {
      row.partnerApproved = { by: actorId, at: new Date().toISOString() };
      row.review = review;
      notify(state, 'admin', `2차 승인 필요: ${partnerOf(state, row.partner)?.name} 교환 ${amount} P (${review})`, 'app/admin/requests');
      log(state, actorId, '교환 1차 승인', row.id, `${owner?.name} · ${amount} P · ${review} → 최고 관리자 2차 승인 대기`);
      return row;
    }
  }
  row.status = status;
  row.updated = new Date().toISOString();
  row.handler = actorId;
  if (reason) row.reason = clip(reason, 100);
  if (status === 'canceled' && row.type === 'exchange') queueWebhook(state, row.partner, 'exchange.canceled', { exchangeId: row.id });
  // 최고 관리자가 교환을 처리하면 제휴사가 장부를 맞출 수 있도록 알린다.
  if (viewer.role === 'admin' && row.type === 'exchange') queueWebhook(state, row.partner, status === 'complete' ? 'exchange.completed' : 'exchange.rejected', { exchangeId: row.id, member: row.member ?? null, amount: row.source, points: row.points, by: 'admin', ...(row.reason ? { reason: row.reason } : {}) });
  if (status === 'complete' && row.type === 'exchange') afterExchange(state, row, owner);
  if (status !== 'canceled') {
    const label = row.type === 'exchange' ? `${partnerOf(state, row.partner)?.name} 교환 ${amount} P` : `출금 ${amount} P`;
    notify(state, row.userId, status === 'complete' ? `${label}${row.type === 'exchange' ? '가 적립되었습니다.' : '가 지급되었습니다.'}` : `${label} 신청이 반려되었습니다. 사유: ${row.reason}`, 'app/user/activity');
    log(state, actorId, status === 'complete' ? (row.type === 'exchange' ? (row.partnerApproved ? '교환 2차 승인' : '교환 승인') : '출금 지급') : '반려', row.id, `${owner?.name} · ${amount} P${row.reason ? ' · ' + row.reason : ''}`);
  }
  return row;
}
export function bulkUpdate(state, actorId, ids, status, reason = '') {
  let done = 0;
  for (const id of ids) { update(state, actorId, id, status, reason); done++; }
  return done;
}
// 완료된 교환 회수: 제휴사 쪽 판매 취소·부정 적립 등으로 포인트를 되돌린다. 원장은 지우지 않고 '교환 회수' 차감 기록을 남긴다.
// 최고 관리자는 언제든, 웹하드 관리자는 자사 교환을 완료 후 30일 안에 회수할 수 있다. 이미 쓴 포인트라면 잔액이 마이너스가 될 수 있다.
export function reverseExchange(state, actorId, id, reason) {
  const actor = account(state, actorId);
  const row = state.transactions.find(item => item.id === id && item.type === 'exchange');
  if (!row || !actor || !(actor.role === 'admin' || (actor.role === 'partner' && actor.partnerId === row.partner))) fail('교환 건을 찾을 수 없습니다.', 404);
  if (row.status !== 'complete') fail('완료된 교환만 회수할 수 있습니다.');
  if (row.reversed) fail('이미 회수한 교환입니다.');
  if (actor.role === 'partner' && Date.now() - new Date(row.updated ?? row.date) > 30 * day) fail('완료 후 30일이 지난 교환은 운영팀에 회수를 요청해 주세요.');
  reason = clip(reason, 100);
  if (!reason) fail('회수 사유를 입력해 주세요.');
  row.reversed = { at: new Date().toISOString(), by: actorId, reason };
  record(state, { userId: row.userId, type: 'reversal', points: row.points, status: 'complete', ref: row.id, partner: row.partner, memo: reason, handler: actorId });
  notify(state, row.userId, `${partnerOf(state, row.partner)?.name} 교환 ${row.points.toLocaleString('ko-KR')} P가 회수되었습니다. 사유: ${reason}`, 'app/user/activity');
  log(state, actorId, '교환 회수', row.id, `${account(state, row.userId)?.name} · ${row.points.toLocaleString('ko-KR')} P · ${reason}`);
  if (actor.role === 'admin') queueWebhook(state, row.partner, 'exchange.reversed', { exchangeId: row.id, member: row.member ?? null, amount: row.source, points: row.points, reason });
  return row;
}

// ───────── 최고 관리자 ─────────
const admin = (state, id) => account(state, id)?.role === 'admin' || fail('최고 관리자 권한이 필요합니다.');
export function adjust(state, adminId, userId, amount, reason) {
  admin(state, adminId);
  amount = int(amount);
  if (!amount || Math.abs(amount) > 1000000) fail('조정 포인트는 0이 아닌 ±1,000,000 이내로 입력해 주세요.');
  if (!String(reason ?? '').trim()) fail('조정 사유를 입력해 주세요.');
  if (account(state, userId)?.role !== 'user') fail('회원을 찾을 수 없습니다.');
  if (amount < 0 && balances(state, userId).available + amount < 0) fail('차감 후 잔액이 0보다 작아집니다.');
  const row = record(state, { userId, type: 'adjust', points: amount, status: 'complete', memo: String(reason).trim().slice(0, 60), handler: adminId });
  notify(state, userId, `관리자 포인트 ${amount > 0 ? '지급' : '차감'}: ${Math.abs(amount).toLocaleString('ko-KR')} P (${row.memo})`, 'app/user/activity');
  log(state, adminId, '포인트 조정', userId, `${amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR')} P · ${row.memo}`);
  return row;
}
export function setMemberStatus(state, adminId, userId, status) {
  admin(state, adminId);
  const target = account(state, userId);
  if (!target || target.role !== 'user' || target.status === 'deleted' || !['active', 'suspended'].includes(status)) fail('회원 상태를 바꿀 수 없습니다.');
  target.status = status;
  log(state, adminId, status === 'active' ? '이용 정지 해제' : '이용 정지', userId, target.name);
}
export function updatePartner(state, adminId, partnerId, { divisor, min, active, dailyLimit, reviewOver }) {
  admin(state, adminId);
  const partner = partnerOf(state, partnerId) ?? fail('제휴사를 찾을 수 없습니다.');
  divisor = int(Number(divisor)); min = int(Number(min));
  dailyLimit = dailyLimit === undefined ? partner.dailyLimit : int(Number(dailyLimit));
  reviewOver = reviewOver === undefined ? partner.reviewOver : int(Number(reviewOver));
  if (!(divisor >= 1 && divisor <= 20)) fail('교환 비율은 1~20 사이로 입력해 주세요.');
  if (!(min >= divisor) || min % divisor || min > 10000000) fail('최소 금액은 교환 비율의 배수여야 합니다.');
  if (!(dailyLimit >= 0 && dailyLimit <= 1e9) || !(reviewOver >= 0 && reviewOver <= 1e9)) fail('일일 승인 한도와 2차 승인 기준은 0 이상의 정수로 입력해 주세요. (0은 제한 없음)');
  const before = `${partner.divisor}:1 · 최소 ${partner.min}`;
  Object.assign(partner, { divisor, min, active: !!active, dailyLimit, reviewOver });
  log(state, adminId, '제휴사 정책 변경', partner.name, `${before} → ${divisor}:1 · 최소 ${min} · 일일 한도 ${dailyLimit || '없음'} · 2차 승인 ${reviewOver ? reviewOver + ' P 초과' : '없음'} · ${active ? '운영' : '중지'}`);
}
export function updateProduct(state, adminId, productId, { cost, stock, active }) {
  admin(state, adminId);
  const product = state.products.find(item => item.id === productId) ?? fail('상품을 찾을 수 없습니다.');
  cost = int(cost); stock = int(stock);
  if (!(cost >= 100 && cost <= 10000000) || !(stock >= 0 && stock <= 1000000)) fail('판매 포인트와 재고를 확인해 주세요.');
  Object.assign(product, { cost, stock, active: !!active });
  log(state, adminId, '상품 수정', product.name, `${cost.toLocaleString('ko-KR')} P · 재고 ${stock} · ${active ? '판매' : '중지'}`);
}
export function updateSettings(state, adminId, input) {
  admin(state, adminId);
  const next = { ...state.settings };
  for (const key of ['fee', 'withdrawalMinimum', 'dailyWithdrawLimit', 'attendancePoints', 'attendanceBonus', 'signupBonus', 'referralBonus', 'giftMinimum', 'dailyGiftLimit']) {
    if (input[key] === undefined) continue;
    const value = int(Number(input[key]));
    if (!(value >= 0 && value <= 100000000)) fail('설정값은 0 이상 1억 이하의 정수여야 합니다.');
    next[key] = value;
  }
  if (next.withdrawalMinimum <= next.fee) fail('최소 출금액은 수수료보다 커야 합니다.');
  if (next.dailyGiftLimit < next.giftMinimum) fail('하루 선물 한도는 최소 선물 금액 이상이어야 합니다.');
  next.maintenance = !!input.maintenance;
  state.settings = next;
  log(state, adminId, '설정 변경', '운영 설정', `수수료 ${next.fee} P · 최소 출금 ${next.withdrawalMinimum} P · 출석 ${next.attendancePoints} P · 선물 한도 ${next.dailyGiftLimit} P${next.maintenance ? ' · 점검 모드' : ''}`);
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
  const linked = state.transactions.find(row => row.id === String(transaction ?? '') && row.userId === userId);
  const open = state.tickets.filter(item => item.userId === userId && item.status === 'open').length;
  if (open >= 10) fail('답변을 기다리는 문의가 많습니다. 답변을 받은 뒤 다시 문의해 주세요.');
  const item = { id: 'T-' + (state.tickets.length + 1) + '-' + Date.now().toString(36), userId, category: ticketCategories.includes(category) ? category : '기타', transaction: linked?.id ?? '', message, reply: '', status: 'open', date: new Date().toISOString() };
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
  partner.apiKey = newApiKey();
  log(state, actorId, 'API 키 재발급', partner.name, '이전 키 즉시 폐기');
  return partner.apiKey;
}
export function setWebhook(state, actorId, url) {
  const viewer = account(state, actorId);
  const partner = viewer?.role === 'partner' ? partnerOf(state, viewer.partnerId) : fail('웹하드 관리자만 변경할 수 있습니다.');
  let parsed;
  if (String(url ?? '').length > 300) fail('웹훅 주소는 300자 이내로 입력해 주세요.');
  try { parsed = new URL(String(url ?? '').trim()); } catch { fail('올바른 URL을 입력해 주세요.'); }
  if (parsed.protocol !== 'https:') fail('웹훅 주소는 https:// 로 시작해야 합니다.');
  if (parsed.username || parsed.password) fail('웹훅 주소에 계정 정보를 넣을 수 없습니다.');
  if (isPrivateHost(parsed.hostname)) fail('내부망·로컬 주소는 웹훅으로 등록할 수 없습니다.');
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
  const temp = 'Sp' + randomChars('abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10) + randomDigits(2);
  target.password = security.hash(temp);
  // 분실 대응: 비밀번호를 초기화하면 2단계 인증도 해제되어 다시 설정해야 한다.
  const hadTotp = !!target.totp?.enabled;
  delete target.totp;
  log(state, adminId, '비밀번호 초기화', target.email, target.name + (hadTotp ? ' · 2단계 인증 해제' : ''));
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
    apiKey: newApiKey(), webhook: '', ip: '', dailyLimit: 1000000, reviewOver: 100000 };
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
    exchanged: state.transactions.filter(row => row.type === 'exchange' && row.status === 'complete' && !row.reversed).reduce((sum, row) => sum + row.points, 0),
    members: state.accounts.filter(item => item.role === 'user' && item.status !== 'deleted').length,
  };
}
const publicPartner = ({ apiKey, webhook, ip, ...rest }) => rest;
// 최고 관리자 화면에도 API 키 전체는 내려보내지 않는다 (앞부분만 표시).
const adminPartner = ({ apiKey, ...rest }) => ({ ...rest, apiKeyHint: String(apiKey ?? '').slice(0, 12) });
export const maskName = name => {
  const chars = [...String(name ?? '')];
  if (chars.length <= 1) return chars.join('') + '*';
  if (chars.length === 2) return chars[0] + '*';
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
};
// 제휴사 담당자에게는 자사와 거래한 회원의 마스킹 이름과 캐릭터만 보여 준다.
const partnerBrief = a => ({ id: a.id, role: a.role, name: maskName(a.name), avatar: a.avatar, photo: '' });
const brief = a => ({ id: a.id, role: a.role, name: a.name, avatar: a.avatar, photo: a.photo });
// 비밀번호 해시, OTP 비밀키, 인증번호 같은 비밀값은 어떤 화면에도 보내지 않는다.
export function privateAccount(a, { maskBank = false } = {}) {
  const { password, totp, bankRequest, linkTries, bankTries, ...rest } = a;
  const out = { ...rest, password: password ? 'set' : '', totp: !!totp?.enabled };
  if (bankRequest) out.bankRequest = { bank: bankRequest.bank, masked: '••••' + bankRequest.number.slice(-4), expires: bankRequest.expires, attempts: bankRequest.attempts, requestedAt: bankRequest.requestedAt };
  if (rest.links) out.links = Object.fromEntries(Object.entries(rest.links).map(([id, link]) => {
    const { pending, ...linkRest } = link;
    return [id, pending ? { ...linkRest, pending: { expires: pending.expires, attempts: pending.attempts } } : linkRest];
  }));
  if (maskBank && rest.bank) out.bank = { ...rest.bank, number: '••••' + String(rest.bank.number).slice(-4) };
  return out;
}
const hideCode = row => row.type === 'coupon' && row.coupon && !row.coupon.revealed ? { ...row, coupon: { ...row.coupon, code: '' } } : row;
const hideHookCode = hook => hook.data?.code ? { ...hook, data: { ...hook.data, code: '••••••' } } : hook;

// 서버가 브라우저로 보내는 데이터. 역할에 따라 볼 수 있는 범위만 담는다.
export function snapshot(state, viewer) {
  const base = {
    version: 2, seq: state.seq, settings: state.settings, products: state.products,
    announcements: state.announcements.filter(item => viewer?.role === 'admin' || item.visible),
    stats: publicStats(state), session: viewer ? { accountId: viewer.id } : null,
    partners: state.partners.map(publicPartner), accounts: [], transactions: [], tickets: [], notifications: [], audit: [], attendance: {}, apiLogs: [], webhooks: [],
    events: viewer?.role === 'admin' ? (state.events ?? []) : activeEvents(state), settlements: {},
  };
  if (!viewer) return base;
  const mine = notificationsFor(state, viewer);
  if (viewer.role === 'admin') {
    const { resets, webhardBalances, ...rest } = state;
    return { ...base, ...rest, partners: state.partners.map(adminPartner), accounts: state.accounts.map(a => privateAccount(a, { maskBank: true })), webhooks: (state.webhooks ?? []).map(hideHookCode),
      notifications: mine, session: base.session, stats: base.stats, events: base.events };
  }
  if (viewer.role === 'partner') {
    const rows = state.transactions.filter(row => row.type === 'exchange' && row.partner === viewer.partnerId);
    const ids = new Set(rows.map(row => row.userId));
    return { ...base, partners: state.partners.map(p => p.id === viewer.partnerId ? p : publicPartner(p)),
      accounts: [privateAccount(viewer), ...state.accounts.filter(a => ids.has(a.id)).map(partnerBrief)], transactions: rows, notifications: mine,
      apiLogs: (state.apiLogs ?? []).filter(item => item.partner === viewer.partnerId).slice(0, 100), webhooks: (state.webhooks ?? []).filter(item => item.partner === viewer.partnerId).slice(0, 50),
      linkRequests: linkRequests(state, viewer.partnerId),
      settlements: Object.fromEntries(Object.entries(state.settlements ?? {}).filter(([key]) => key.startsWith(viewer.partnerId + ':'))) };
  }
  const rows = state.transactions.filter(row => row.userId === viewer.id);
  const others = new Set(rows.map(row => row.counterpart).filter(Boolean));
  return { ...base, accounts: [privateAccount(viewer), ...state.accounts.filter(a => others.has(a.id)).map(brief)], transactions: rows.map(hideCode),
    tickets: state.tickets.filter(item => item.userId === viewer.id), notifications: mine, attendance: { [viewer.id]: state.attendance[viewer.id] ?? [] },
    available: Object.fromEntries(Object.keys(viewer.links ?? {}).map(id => [id, partnerAvailable(state, viewer.id, id)])) };
}

// 웹훅은 대기열에 쌓고, 실서버(server.mjs)가 비동기로 전송해 결과를 기록한다.
export function queueWebhook(state, partnerId, event, data) {
  state.webhooks ??= [];
  state.webhooks.unshift({ id: 'W-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), partner: partnerId, event, data, status: 'queued', attempts: 0, date: new Date().toISOString() });
  state.webhooks.length = Math.min(state.webhooks.length, 300);
}

function uniqueReferral(state) {
  for (;;) {
    const code = 'SP' + randomChars('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
    if (!state.accounts.some(item => item.referral === code)) return code;
  }
}

// 교환 승인 후: 추천인 보너스(첫 교환 완료 시) · 진행 중인 교환 이벤트 적립
function afterExchange(state, row, owner) {
  if (!owner) return;
  // 가입·추천 보너스(적립 예정)를 첫 교환 완료와 함께 지급한다.
  for (const held of state.transactions.filter(item => item.userId === owner.id && item.hold === 'first-exchange' && item.status === 'pending')) {
    held.status = 'complete';
    held.updated = new Date().toISOString();
    delete held.hold;
    notify(state, owner.id, `${held.memo} ${held.points.toLocaleString('ko-KR')} P가 지급되었습니다.`, 'app/user/activity');
  }
  if (owner.referredBy && !owner.referralPaid) {
    const referrer = account(state, owner.referredBy);
    owner.referralPaid = true;
    if (referrer?.status === 'active') {
      credit(state, referrer.id, 'reward', state.settings.referralBonus, `${owner.name}님 추천 보너스 (첫 교환 완료)`);
      notify(state, referrer.id, `${owner.name}님이 첫 교환을 완료해 추천 보너스 ${state.settings.referralBonus} P가 적립되었습니다.`, 'app/user/activity');
    }
  }
  const today = kstDay();
  for (const event of activeEvents(state).filter(item => item.partner === row.partner)) {
    if (event.until && today > event.until) continue;
    const earlier = state.transactions.some(other => other.id !== row.id && other.userId === row.userId && other.type === 'exchange' && other.partner === row.partner && other.status === 'complete');
    if (event.firstOnly && earlier) continue;
    const bonus = Math.floor(row.points * event.rate / 100);
    if (bonus > 0) {
      credit(state, row.userId, 'reward', bonus, `${event.title}`);
      notify(state, row.userId, `${event.title}: ${bonus.toLocaleString('ko-KR')} P가 추가 적립되었습니다.`, 'app/user/activity');
    }
  }
}
export const activeEvents = state => (state.events ?? []).filter(item => item.active && (!item.until || kstDay() <= item.until));

// 내부망·로컬 주소 판별 (웹훅이 서버 내부를 호출하지 못하게 함). 서버는 전송 직전 DNS 결과도 다시 검사한다.
export function isPrivateHost(host) {
  host = String(host ?? '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(host) || !host.includes('.') && !host.includes(':')) return true;
  return isPrivateIp(host);
}
function privateV4(a, b) {
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
// IPv6 주소를 16비트 8칸으로 펼친다. (끝에 IPv4 표기가 붙은 형태 포함) 형식이 틀리면 null
function expandV6(ip) {
  let text = ip.split('%')[0];
  const tail = text.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (tail) {
    const n = tail.slice(1).map(Number);
    if (n.some(x => x > 255)) return null;
    text = text.slice(0, -tail[0].length) + ((n[0] << 8) | n[1]).toString(16) + ':' + ((n[2] << 8) | n[3]).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  const parts = [...head, ...Array(Math.max(0, fill)).fill('0'), ...rest];
  if (parts.length !== 8 || parts.some(p => !/^[0-9a-f]{1,4}$/.test(p))) return null;
  return parts.map(p => parseInt(p, 16));
}
export function isPrivateIp(ip) {
  ip = String(ip ?? '').toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return privateV4(Number(v4[1]), Number(v4[2]));
  if (!ip.includes(':')) return false;
  const h = expandV6(ip);
  if (!h) return true; // 해석할 수 없는 주소는 막는다
  const embedded = (hi, lo) => privateV4(hi >> 8, hi & 255) || (hi === 0 && lo === 0);
  if (h.every(x => x === 0) || (h.slice(0, 7).every(x => x === 0) && h[7] === 1)) return true; // :: , ::1
  if (h.slice(0, 5).every(x => x === 0) && (h[5] === 0xffff || h[5] === 0)) return embedded(h[6], h[7]) || h[5] === 0; // IPv4 매핑·호환 주소
  if (h[0] === 0x64 && h[1] === 0xff9b) return true; // NAT64 (내부 IPv4로 변환될 수 있음)
  if (h[0] === 0x2002) return embedded(h[1], h[2]); // 6to4
  if (h[0] === 0x2001 && h[1] === 0) return true; // Teredo
  if (h[0] === 0x2001 && h[1] === 0xdb8) return true; // 문서용
  if (h[0] === 0x100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true; // 폐기용
  return (h[0] & 0xfe00) === 0xfc00 || (h[0] & 0xffc0) === 0xfe80 || (h[0] & 0xff00) === 0xff00; // 사설·링크로컬·멀티캐스트
}

// ───────── 비밀번호 재설정 ─────────
export function requestReset(state, email, now = Date.now()) {
  const target = byEmail(state, email);
  state.resets = (state.resets ?? []).filter(item => item.expires > now);
  if (!target || !target.password || target.status !== 'active') return null; // 존재 여부는 알리지 않는다.
  if (state.resets.filter(item => item.accountId === target.id).length >= 3) return null;
  const token = security.token();
  state.resets.push({ hash: security.tokenHash(token), accountId: target.id, expires: now + 30 * 60000 });
  return { token, account: target };
}
export function resetWithToken(state, token, password, now = Date.now()) {
  const hash = security.tokenHash(String(token ?? ''));
  const entry = (state.resets ?? []).find(item => item.hash === hash && item.expires > now);
  if (!entry) fail('링크가 만료되었거나 올바르지 않습니다. 비밀번호 찾기를 다시 진행해 주세요.');
  const target = account(state, entry.accountId);
  password = String(password ?? '');
  if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) fail('새 비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.');
  target.password = security.hash(password);
  state.resets = state.resets.filter(item => item.accountId !== target.id);
  log(state, target.id, '비밀번호 재설정', target.email, '재설정 링크 사용');
  return target;
}

// ───────── 쿠폰 취소·환불 ─────────
export function cancelCoupon(state, actorId, id, reason = '') {
  const actor = account(state, actorId);
  const row = state.transactions.find(item => item.id === id && item.type === 'coupon');
  if (!row || !actor) fail('쿠폰을 찾을 수 없습니다.');
  const isAdmin = actor.role === 'admin';
  if (!isAdmin && row.userId !== actorId) fail('쿠폰을 찾을 수 없습니다.');
  if (row.status !== 'complete') fail('이미 취소된 쿠폰입니다.');
  if (row.coupon?.used) fail('사용한 쿠폰은 취소할 수 없습니다.');
  if (!isAdmin && row.coupon?.revealed) fail('쿠폰 번호를 확인한 쿠폰은 직접 취소할 수 없습니다. 사용하지 않았다면 고객센터로 문의해 주세요.');
  if (!isAdmin && Date.now() - new Date(row.date) > 7 * 86400000) fail('구매 후 7일이 지나 취소할 수 없습니다. 고객센터로 문의해 주세요.');
  if (isAdmin && !String(reason).trim()) fail('취소 사유를 입력해 주세요.');
  row.status = 'canceled';
  row.updated = new Date().toISOString();
  row.handler = actorId;
  if (reason) row.reason = String(reason).trim().slice(0, 100);
  const product = state.products.find(item => item.id === row.product);
  if (product) product.stock += 1;
  if (isAdmin) {
    notify(state, row.userId, `쿠폰 구매가 취소되어 ${row.points.toLocaleString('ko-KR')} P가 환불되었습니다. 사유: ${row.reason}`, 'app/user/coupons');
    log(state, actorId, '쿠폰 취소', row.id, `${product?.name ?? ''} · ${row.points} P · ${row.reason}`);
  }
  return row;
}

// ───────── 정산 대사 ─────────
// 제휴사가 자기 장부의 일자별 합계를 확인(입력)하면 우리 원장과 비교한다.
export function settlementOurs(state, partnerId, date) {
  const rows = state.transactions.filter(row => row.type === 'exchange' && row.partner === partnerId && row.status === 'complete' && !row.reversed && kstDay(row.updated ?? row.date) === date);
  return { count: rows.length, amount: rows.reduce((sum, row) => sum + row.source, 0), points: rows.reduce((sum, row) => sum + row.points, 0) };
}
export function settlementStatus(state, partnerId, date) {
  const ours = settlementOurs(state, partnerId, date);
  const theirs = state.settlements?.[partnerId + ':' + date] ?? null;
  const status = !theirs ? (ours.count ? 'unconfirmed' : 'empty') : theirs.count === ours.count && theirs.amount === ours.amount ? 'match' : 'mismatch';
  return { ours, theirs, status, diff: theirs ? theirs.amount - ours.amount : 0 };
}
export function confirmSettlement(state, partnerId, date, { count, amount }, by = 'partner-api') {
  if (!partnerOf(state, partnerId)) fail('제휴사를 찾을 수 없습니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || date > kstDay()) fail('대사 일자를 확인해 주세요.');
  count = int(Number(count)); amount = int(Number(amount));
  if (!(count >= 0) || !(amount >= 0)) fail('건수와 금액을 확인해 주세요.');
  state.settlements ??= {};
  state.settlements[partnerId + ':' + date] = { count, amount, by, at: new Date().toISOString() };
  const result = settlementStatus(state, partnerId, date);
  if (result.status === 'mismatch') notify(state, 'admin', `${partnerOf(state, partnerId).name} ${date} 정산 불일치 (차이 ${result.diff.toLocaleString('ko-KR')} P)`, 'app/admin/settlement');
  return result;
}

// ───────── 교환 이벤트 ─────────
export function setEventActive(state, adminId, id, active) {
  admin(state, adminId);
  const event = (state.events ?? []).find(item => item.id === id) ?? fail('이벤트를 찾을 수 없습니다.');
  event.active = !!active;
  log(state, adminId, active ? '이벤트 시작' : '이벤트 중지', event.title, '');
}
export function createEvent(state, adminId, { partner, rate, until, title, firstOnly }) {
  admin(state, adminId);
  if (!partnerOf(state, partner)) fail('제휴사를 선택해 주세요.');
  rate = int(Number(rate));
  if (!(rate >= 1 && rate <= 50)) fail('추가 적립률은 1~50% 사이로 입력해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(until)) || until < kstDay()) fail('종료일을 오늘 이후로 선택해 주세요.');
  title = String(title ?? '').trim() || `${partnerOf(state, partner).name} 교환 ${rate}% 추가 적립`;
  const event = { id: 'e' + Date.now().toString(36), partner, rate, until, title: title.slice(0, 40), firstOnly: !!firstOnly, active: true };
  (state.events ??= []).unshift(event);
  log(state, adminId, '이벤트 등록', event.title, `${rate}% · ~${until}${firstOnly ? ' · 첫 교환만' : ''}`);
  return event;
}

// ───────── 2단계 인증 (OTP) ─────────
// 비밀키 생성·코드 확인은 서버(server.mjs)가 security.totpSecret / security.totpCheck로 제공한다.
export function setupTotp(state, id) {
  const target = account(state, id);
  if (!target || target.role === 'user' || !target.password) fail('운영진 이메일 계정만 2단계 인증을 설정할 수 있습니다.');
  if (!security.totpSecret) fail('2단계 인증은 서버를 실행한 환경에서만 설정할 수 있습니다.');
  if (target.totp?.enabled) fail('이미 2단계 인증을 사용 중입니다.');
  const secret = security.totpSecret();
  target.totp = { secret, enabled: false };
  return { secret, uri: `otpauth://totp/${encodeURIComponent('SmilePoint:' + target.email)}?secret=${secret}&issuer=SmilePoint&digits=6&period=30` };
}
export function enableTotp(state, id, code) {
  const target = account(state, id);
  if (!target?.totp?.secret || target.totp.enabled) fail('2단계 인증 설정을 다시 시작해 주세요.');
  const step = security.totpCheck?.(target.totp.secret, String(code ?? '').trim(), null);
  if (step === null || step === undefined) fail('인증 코드가 올바르지 않습니다. 휴대폰 시간이 맞는지 확인해 주세요.');
  Object.assign(target.totp, { enabled: true, last: step, enabledAt: new Date().toISOString() });
  log(state, id, '2단계 인증 사용', target.email, '');
}
export function disableTotp(state, id, code) {
  const target = account(state, id);
  if (!target?.totp?.enabled) fail('2단계 인증을 사용하고 있지 않습니다.');
  const step = security.totpCheck?.(target.totp.secret, String(code ?? '').trim(), target.totp.last);
  if (step === null || step === undefined) fail('인증 코드가 올바르지 않습니다.');
  delete target.totp;
  log(state, id, '2단계 인증 해제', target.email, '');
}

// ───────── 회원 탈퇴 ─────────
// 거래 원장은 관련 법령(전자상거래법 등)에 따라 보관해야 하므로 지우지 않고, 회원 개인정보만 즉시 파기(익명화)한다.
export function deleteAccount(state, userId, { password, confirm } = {}) {
  const target = user(state, userId);
  if (target.password ? !security.verify(String(password ?? ''), target.password) : String(confirm ?? '').trim() !== '탈퇴') fail(target.password ? '비밀번호가 일치하지 않습니다.' : "확인을 위해 '탈퇴'를 입력해 주세요.");
  if (state.transactions.some(row => row.userId === userId && row.status === 'pending' && ['exchange', 'withdrawal'].includes(row.type))) fail('처리 중인 교환·출금이 있어 탈퇴할 수 없습니다. 처리가 끝난 뒤 다시 시도해 주세요.');
  const left = Math.max(0, balances(state, userId).available);
  for (const [partnerId, link] of Object.entries(target.links ?? {})) if (link.verified) queueWebhook(state, partnerId, 'member.unlinked', { member: link.loginId });
  for (const row of state.transactions) if (row.userId === userId && row.hold && row.status === 'pending') row.status = 'canceled';
  Object.assign(target, { status: 'deleted', deletedAt: new Date().toISOString(), name: '탈퇴 회원', email: `deleted+${userId}@deleted.invalid`, phone: '', password: '', photo: '', bank: null, links: {}, referral: null, notify: { email: false, sms: false, marketing: false } });
  for (const key of ['bankRequest', 'social', 'totp', 'lastLogin', 'linkTries', 'bankTries', 'consent']) delete target[key];
  delete state.attendance[userId];
  state.resets = (state.resets ?? []).filter(item => item.accountId !== userId);
  log(state, userId, '회원 탈퇴', userId, left ? `잔여 ${left.toLocaleString('ko-KR')} P 소멸` : '');
  state.session = null;
  return { left };
}

// 이전 버전에 저장된 데이터에 새 항목의 기본값을 채운다.
export function normalize(state, demo = true) {
  state.settings = { fee: 500, withdrawalMinimum: 5000, dailyWithdrawLimit: 500000, attendancePoints: 10, attendanceBonus: 50, signupBonus: 1000, referralBonus: 500, giftMinimum: 1000, dailyGiftLimit: 100000, maintenance: false, ...state.settings };
  state.settings.mockWebhardBalance ??= demo;
  state.events ??= [];
  state.webhardBalances ??= {};
  state.resets ??= [];
  state.settlements ??= {};
  state.apiLogs ??= [];
  state.webhooks ??= [];
  for (const partner of state.partners ?? []) { partner.dailyLimit ??= 1000000; partner.reviewOver ??= 100000; }
  for (const item of state.accounts ?? []) for (const link of Object.values(item.links ?? {})) link.verified ??= !!demo;
  for (const row of state.transactions ?? []) if (row.type === 'coupon' && row.coupon) row.coupon.revealed ??= true;
  return state;
}
