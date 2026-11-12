export const config = { name: '스마일 포인트', english: 'SMILE POINT', point: 'P' };

export const partners = [
  { id: 'green', name: '그린파일', initials: 'G', color: 'green', type: '판매 적립', available: 38000, divisor: 2, min: 2000 },
  { id: 'cloud', name: '클라우드박스', initials: 'C', color: 'blue', type: '활동 적립', available: 22000, divisor: 1, min: 1000 },
  { id: 'file', name: '파일가든', initials: 'F', color: 'peach', type: '판매 적립', available: 16000, divisor: 2, min: 2000 },
];

export const products = [
  { id: 'coffee', name: '아이스 아메리카노', category: '카페', brand: '데일리 카페', cost: 4500, image: 'coffee' },
  { id: 'chicken', name: '바삭 후라이드 치킨', category: '외식', brand: '크리스피 키친', cost: 18500, image: 'chicken' },
  { id: 'market', name: '편의점 모바일 교환권', category: '편의점', brand: '스마일 마켓', cost: 5000, image: 'market' },
];

export const roles = {
  user: { name: '일반 사용자', account: '스마일 회원', icon: 'user' },
  partner: { name: '웹하드 관리자', account: '그린파일 담당자', icon: 'layers' },
  admin: { name: '최고 관리자', account: '서비스 운영자', icon: 'shield' },
};

export const animals = [
  '고양이','강아지','토끼','수달','여우','곰','판다','레서판다','너구리','다람쥐',
  '코알라','햄스터','사자','호랑이','표범','사슴','알파카','양','소','돼지',
  '말','코끼리','기린','원숭이','펭귄','부엉이','오리','개구리','물범','고슴도치',
];

export const faq = [
  ['어떤 포인트를 교환할 수 있나요?', '제휴사별 판매 적립·활동 적립 포인트를 교환할 수 있습니다. 교환 가능 유형, 최소 금액, 교환 비율은 제휴사 카드에서 확인할 수 있습니다.'],
  ['교환을 신청했는데 왜 사용 가능 잔액이 그대로인가요?', '교환 신청 직후에는 적립 예정 포인트에 표시됩니다. 제휴사 관리자 또는 최고 관리자가 교환을 승인하면 사용 가능 잔액에 반영됩니다.'],
  ['출금 수수료와 입금일은 어디에서 보나요?', '출금 화면에 신청 금액을 입력하면 수수료와 실수령액이 표시됩니다. 체험 정책은 최소 5,000 P, 건당 500 P, 승인 후 다음 영업일 입금 예정입니다.'],
  ['출금 신청을 취소하거나 반려되면 포인트가 돌아오나요?', '네. 처리 대기 중인 신청을 취소하거나 최고 관리자가 반려하면 해당 포인트는 사용 가능 잔액으로 돌아옵니다.'],
  ['모바일 쿠폰은 어디서 확인하나요?', '포인트로 구매한 쿠폰은 사용자 대시보드의 쿠폰함에 표시됩니다. 체험 쿠폰은 실제 매장에서 사용할 수 없습니다.'],
  ['휴대폰과 PC에서 체험 내역이 공유되나요?', '체험 내역은 지금 사용 중인 브라우저에 저장됩니다. 다른 기기나 브라우저에서 열면 별도의 체험으로 시작합니다.'],
  ['신청을 취소하거나 문의할 수 있나요?', '처리 대기 중인 교환·출금 신청은 거래 내역에서 취소할 수 있습니다. 거래번호가 있는 문의는 고객센터에서 선택해 남길 수 있습니다.'],
];

export const announcements = [
  ['스마일 포인트 체험 서비스 안내', '2026.11.12', '세 가지 역할의 체험 계정과 샘플 제휴사·쿠폰을 제공합니다. 교환과 지급은 브라우저 안에서 모의 처리됩니다.'],
  ['포인트 교환과 계좌 출금 흐름', '2026.11.12', '사용자가 교환을 신청하면 해당 제휴사 관리자 또는 최고 관리자가 심사할 수 있습니다. 계좌 출금은 최고 관리자가 처리합니다.'],
];

const paths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  exchange: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  wallet: '<path d="M20 8V5H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V7m18 5h-5a2 2 0 0 0 0 4h5"/><path d="M16 14h.01"/>',
  bank: '<path d="M3 9h18L12 4 3 9Zm2 11h14M7 10v7m5-7v7m5-7v7"/>',
  gift: '<path d="M4 11h16v9H4zm-1-4h18v4H3zm9 0v13"/><path d="M12 7c-5 0-7-1-6-3s5-1 6 3Zm0 0c5 0 7-1 6-3s-5-1-6 3Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  shield: '<path d="m12 3 8 3v5c0 4-3 7-8 10-5-3-8-6-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  home: '<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M4 5h16l2 10v4H2v-4L4 5Zm-2 10h6l1 2h6l1-2h6"/>',
  chart: '<path d="M4 4v16h16M8 16v-4m4 4V8m4 8v-6m4 6V6"/>',
  file: '<path d="M6 3h8l4 4v14H6zm8 0v5h4M9 12h6m-6 4h6"/>',
  link: '<path d="m10 13 4-4m-5 7-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2-1 2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  external: '<path d="M13 4h7v7m0-7-9 9m7 0v7H4V6h7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"/>',
  logout: '<path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h12"/>',
  shop: '<path d="M4 8h16l-1 12H5L4 8Zm4 0V6a4 4 0 0 1 8 0v2"/>',
  edit: '<path d="m5 15-1 5 5-1L20 8l-4-4L5 15Zm9-9 4 4"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8m0-12v5h-5"/>',
};
export const icon = (name, size = 22) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.arrow}</svg>`;
export const format = value => new Intl.NumberFormat('ko-KR').format(value);
export const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
