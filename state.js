import { animals, partners, products, roles } from './catalog.js';

const key = 'smilepoint-demo-v1';
export const fee = 500;
export const withdrawalMinimum = 5000;
const initialPoints = 24600;
export const types = { exchange: '포인트 교환', withdrawal: '계좌 출금', coupon: '쿠폰 구매' };
export const statuses = { pending: '처리 대기', complete: '완료', rejected: '반려', canceled: '취소' };

export function freshState() {
  return {
    profiles: Object.fromEntries(Object.entries(roles).map(([id, role]) => [id, {
      name: role.account, avatar: Math.floor(Math.random() * animals.length), photo: '',
    }])),
    transactions: [
      { id: 'SP-1023', type: 'exchange', partner: 'green', source: 8000, points: 4000, status: 'pending', date: '2026-11-12T10:15:00+09:00' },
      { id: 'SP-1022', type: 'exchange', partner: 'cloud', source: 10000, points: 10000, status: 'complete', date: '2026-11-10T15:00:00+09:00' },
      { id: 'SP-1021', type: 'coupon', product: 'coffee', points: 4500, status: 'complete', date: '2026-11-09T13:00:00+09:00' },
    ],
    tickets: [],
  };
}

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.profiles && Array.isArray(saved.transactions) && Array.isArray(saved.tickets)) return saved;
  } catch {}
  return freshState();
}

export function save(state) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function balances(state) {
  const totals = { available: initialPoints, pending: 0, reserved: 0 };
  for (const row of state.transactions) {
    if (row.type === 'exchange') {
      if (row.status === 'complete') totals.available += row.points;
      if (row.status === 'pending') totals.pending += row.points;
    } else if (row.status === 'pending' || row.status === 'complete') {
      totals.available -= row.points;
      if (row.status === 'pending') totals.reserved += row.points;
    }
  }
  return totals;
}

export function partnerAvailable(state, id) {
  const partner = partners.find(item => item.id === id);
  if (!partner) return 0;
  return partner.available - state.transactions
    .filter(row => row.partner === id && ['pending', 'complete'].includes(row.status))
    .reduce((sum, row) => sum + row.source, 0);
}

function record(state, details) {
  const id = 'SP-' + (Math.max(1023, ...state.transactions.map(row => Number(row.id.slice(3)))) + 1);
  const row = { id, date: new Date().toISOString(), ...details };
  state.transactions.unshift(row);
  return row;
}

export function exchange(state, partnerId, amount) {
  const partner = partners.find(item => item.id === partnerId);
  if (!partner || !Number.isSafeInteger(amount) || amount < partner.min || amount > partnerAvailable(state, partnerId) || amount % partner.divisor) {
    throw new Error('교환 가능 잔액, 최소 금액과 교환 단위를 확인해 주세요.');
  }
  return record(state, { type: 'exchange', partner: partnerId, source: amount, points: amount / partner.divisor, status: 'pending' });
}

export function withdraw(state, amount) {
  if (!Number.isSafeInteger(amount) || amount < withdrawalMinimum || amount > balances(state).available) {
    throw new Error('최소 출금액과 사용 가능 잔액을 확인해 주세요.');
  }
  return record(state, { type: 'withdrawal', points: amount, fee, status: 'pending' });
}

export function order(state, productId) {
  const product = products.find(item => item.id === productId);
  if (!product || product.cost > balances(state).available) throw new Error('상품 또는 사용 가능 포인트를 확인해 주세요.');
  return record(state, { type: 'coupon', product: productId, points: product.cost, status: 'complete' });
}

export function canUpdate(row, role, status) {
  if (!row || row.status !== 'pending') return false;
  if (role === 'user') return status === 'canceled';
  if (!['complete', 'rejected'].includes(status)) return false;
  return role === 'admin' || (role === 'partner' && row.type === 'exchange' && row.partner === 'green');
}

export function update(state, id, role, status) {
  const row = state.transactions.find(item => item.id === id);
  if (!canUpdate(row, role, status)) throw new Error('이 거래는 해당 상태로 변경할 수 없습니다.');
  row.status = status;
  row.updated = new Date().toISOString();
  return row;
}

export function roleTransactions(state, role) {
  return role === 'partner' ? state.transactions.filter(row => row.partner === 'green') : state.transactions;
}
