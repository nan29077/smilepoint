// 브라우저(데모 모드)와 서버(server.mjs)가 함께 쓰는 기능 목록.
// 요청한 사람(actor)은 서버 세션으로만 정해지며, 각 기능은 state.js에서 권한을 다시 검사한다.
import { testAccounts } from './catalog.js';
import * as S from './state.js';

const user = run => ({ role: 'user', run });
const partner = run => ({ role: 'partner', run });
const admin = run => ({ role: 'admin', run });
const reviewer = run => ({ role: ['partner', 'admin'], run });
const anyone = run => ({ run });
const open = (run, extra = {}) => ({ public: true, run, ...extra });

export const ops = {
  // 인증
  login: open((s, _, p) => S.login(s, p.email, p.password), { auth: true }),
  loginAs: open((s, _, p) => {
    if (!testAccounts.some(item => item.id === p.id)) throw new S.AppError('테스트 계정이 아닙니다.', 403);
    return S.loginAs(s, p.id);
  }, { auth: true, demo: true }),
  socialDemo: open((s, _, p) => S.socialLogin(s, p.provider), { auth: true, demo: true }),
  signup: open((s, _, p) => S.signup(s, { ...p, provider: 'email' }), { auth: true }),
  logout: open(s => S.logout(s)),
  requestReset: open((s, _, p) => S.requestReset(s, p.email)),
  resetWithToken: open((s, _, p) => S.resetWithToken(s, p.token, p.password)),

  // 사용자
  exchange: user((s, a, p) => S.exchange(s, a.id, p.partnerId, p.amount)),
  linkPartner: user((s, a, p) => S.linkPartner(s, a.id, p.partnerId, p.loginId)),
  unlinkPartner: user((s, a, p) => S.unlinkPartner(s, a.id, p.partnerId)),
  withdraw: user((s, a, p) => S.withdraw(s, a.id, p.amount)),
  setBank: user((s, a, p) => S.setBank(s, a.id, p)),
  order: user((s, a, p) => S.order(s, a.id, p.productId, p.quantity)),
  setCouponUsed: user((s, a, p) => S.setCouponUsed(s, a.id, p.id, !!p.used)),
  cancelCoupon: { role: ['user', 'admin'], run: (s, a, p) => S.cancelCoupon(s, a.id, p.id, p.reason) },
  attend: user((s, a) => S.attend(s, a.id)),
  gift: user((s, a, p) => S.gift(s, a.id, p.email, p.amount, p.message)),
  openTicket: user((s, a, p) => S.openTicket(s, a.id, p)),
  seenTickets: user((s, a) => { for (const t of s.tickets) if (t.userId === a.id && t.status === 'answered') t.seen = true; }),

  // 모든 로그인 계정
  updateProfile: anyone((s, a, p) => S.updateProfile(s, a.id, p)),
  changePassword: anyone((s, a, p) => S.changePassword(s, a.id, p.before, p.after)),
  setAvatar: anyone((s, a, p) => S.setAvatar(s, a.id, p.index)),
  setPhoto: anyone((s, a, p) => S.setPhoto(s, a.id, p.photo)),
  readAll: anyone((s, a) => S.readAll(s, a)),
  cancel: anyone((s, a, p) => S.update(s, a.id, p.id, 'canceled')),

  // 심사 (웹하드 관리자·최고 관리자)
  review: reviewer((s, a, p) => S.update(s, a.id, p.id, p.status, p.reason)),
  bulkReview: reviewer((s, a, p) => S.bulkUpdate(s, a.id, Array.isArray(p.ids) ? p.ids.slice(0, 200) : [], p.status, p.reason)),

  // 웹하드 관리자
  regenerateKey: partner((s, a) => S.regenerateKey(s, a.id)),
  setWebhook: partner((s, a, p) => S.setWebhook(s, a.id, p.url)),
  testWebhook: partner((s, a) => S.queueWebhook(s, a.partnerId, 'ping', { message: '스마일 포인트 웹훅 연결 테스트' })),
  confirmSettlement: partner((s, a, p) => S.confirmSettlement(s, a.partnerId, p.date, p, a.id)),

  // 최고 관리자
  adjust: admin((s, a, p) => S.adjust(s, a.id, p.userId, p.amount, p.reason)),
  setMemberStatus: admin((s, a, p) => S.setMemberStatus(s, a.id, p.userId, p.status)),
  updatePartner: admin((s, a, p) => S.updatePartner(s, a.id, p.partnerId, p)),
  createPartner: admin((s, a, p) => S.createPartner(s, a.id, p)),
  updateProduct: admin((s, a, p) => S.updateProduct(s, a.id, p.productId, p)),
  createProduct: admin((s, a, p) => S.createProduct(s, a.id, p)),
  updateSettings: admin((s, a, p) => S.updateSettings(s, a.id, p)),
  addAnnouncement: admin((s, a, p) => S.addAnnouncement(s, a.id, p)),
  toggleAnnouncement: admin((s, a, p) => S.toggleAnnouncement(s, a.id, p.id)),
  replyTicket: admin((s, a, p) => S.replyTicket(s, a.id, p.id, p.reply)),
  createStaff: admin((s, a, p) => S.createStaff(s, a.id, p)),
  createEvent: admin((s, a, p) => S.createEvent(s, a.id, p)),
  setEventActive: admin((s, a, p) => S.setEventActive(s, a.id, p.id, p.active)),
  setStaffStatus: admin((s, a, p) => S.setStaffStatus(s, a.id, p.id, p.status)),
  resetPassword: admin((s, a, p) => S.resetPassword(s, a.id, p.id)),
  resetDemo: { ...admin((s, a) => {
    const session = s.session;
    const fresh = S.freshState();
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, fresh, { session });
    S.log(s, a.id, '데모 데이터 초기화', '전체', '');
  }), demo: true },
};

/**
 * @param {object} state 전체 데이터 (변경됨)
 * @param {string|null} actorId 로그인한 계정 id (서버에서는 세션으로만 결정)
 * @param {string} op ops의 키
 * @param {object} payload 요청 값
 * @param {{demo?: boolean}} options demo가 false면 테스트 로그인·초기화를 막는다
 */
const maintenanceBlocked = new Set(['exchange', 'linkPartner', 'unlinkPartner', 'withdraw', 'setBank', 'order', 'cancelCoupon', 'attend', 'gift', 'cancel']);

export function dispatch(state, actorId, op, payload = {}, { demo = true } = {}) {
  const spec = Object.hasOwn(ops, op) ? ops[op] : null;
  if (!spec) throw new S.AppError('알 수 없는 요청입니다.', 404);
  if (spec.demo && !demo) throw new S.AppError('운영 환경에서는 사용할 수 없는 기능입니다.', 403);
  const actor = actorId ? S.account(state, actorId) : null;
  if (!spec.public) {
    if (!actor) throw new S.AppError('로그인이 필요합니다.', 401);
    if (actor.status !== 'active') throw new S.AppError('이용이 정지된 계정입니다.', 403);
    if (spec.role && ![].concat(spec.role).includes(actor.role)) throw new S.AppError('이 기능을 사용할 권한이 없습니다.', 403);
    // 점검 중에는 사용자의 거래성 기능을 막는다 (조회·프로필·로그아웃은 허용).
    if (state.settings?.maintenance && actor.role === 'user' && maintenanceBlocked.has(op)) throw new S.AppError('서비스 점검 중이라 잠시 이용할 수 없습니다. 점검이 끝난 뒤 다시 시도해 주세요.', 503);
  }
  if (state.settings?.maintenance && op === 'signup') throw new S.AppError('서비스 점검 중에는 회원가입을 할 수 없습니다.', 503);
  return spec.run(state, actor, payload && typeof payload === 'object' ? payload : {});
}

// 응답에 비밀번호 해시 등이 섞이지 않도록 정리한다.
export function clean(result) {
  if (Array.isArray(result)) return result.map(clean);
  if (result && typeof result === 'object') {
    const { password, apiKey, ...rest } = result;
    return rest;
  }
  return result ?? null;
}
