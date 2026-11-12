export const config = { name: '스마일 포인트', english: 'SMILE POINT', point: 'P', support: '1588-0000', hours: '평일 10:00 ~ 18:00' };

export const partnerSeeds = [
  { id: 'green', name: '그린파일', initials: 'G', color: 'green', type: '판매 적립', divisor: 2, min: 2000, approval: '평균 2시간', active: true },
  { id: 'cloud', name: '클라우드박스', initials: 'C', color: 'blue', type: '활동 적립', divisor: 1, min: 1000, approval: '평균 30분', active: true },
  { id: 'file', name: '파일가든', initials: 'F', color: 'peach', type: '판매 적립', divisor: 2, min: 2000, approval: '평균 4시간', active: true },
  { id: 'disk', name: '디스크온', initials: 'D', color: 'violet', type: '판매·추천 적립', divisor: 4, min: 4000, approval: '평균 1일', active: true },
];

// image가 없는 상품은 분류별 일러스트 타일로 표시한다.
export const productSeeds = [
  { id: 'coffee', name: '아이스 아메리카노', category: '카페', brand: '데일리 카페', cost: 4500, image: 'coffee', stock: 120, active: true, best: true },
  { id: 'latte', name: '카페 라떼 + 조각 케이크', category: '카페', brand: '데일리 카페', cost: 11000, stock: 40, active: true },
  { id: 'chicken', name: '바삭 후라이드 치킨', category: '외식', brand: '크리스피 키친', cost: 18500, image: 'chicken', stock: 35, active: true, best: true },
  { id: 'pizza', name: '페퍼로니 피자 L', category: '외식', brand: '피자 스테이션', cost: 24000, stock: 25, active: true },
  { id: 'burger', name: '더블 버거 세트', category: '외식', brand: '버거 하우스', cost: 8900, stock: 60, active: true },
  { id: 'market', name: '편의점 모바일 교환권 5천원', category: '편의점', brand: '스마일 마켓', cost: 5000, image: 'market', stock: 200, active: true, best: true },
  { id: 'market10', name: '편의점 모바일 교환권 1만원', category: '편의점', brand: '스마일 마켓', cost: 10000, stock: 150, active: true },
  { id: 'icecream', name: '아이스크림 파인트', category: '디저트', brand: '스노우 크림', cost: 9800, stock: 50, active: true },
  { id: 'donut', name: '도넛 6개 박스', category: '디저트', brand: '해피 도넛', cost: 12000, stock: 30, active: true },
  { id: 'movie', name: '영화 관람권 2D', category: '문화', brand: '시네마 스퀘어', cost: 13000, stock: 45, active: true, best: true },
  { id: 'book', name: '온라인 서점 상품권 1만원', category: '문화', brand: '북스토어', cost: 10000, stock: 80, active: true },
  { id: 'gift30', name: '백화점 모바일 상품권 3만원', category: '상품권', brand: '스마일 백화점', cost: 30000, stock: 20, active: true },
];

export const categories = ['전체', '카페', '외식', '편의점', '디저트', '문화', '상품권'];

export const roles = {
  user: { name: '일반 사용자', icon: 'user', home: 'overview' },
  partner: { name: '웹하드 관리자', icon: 'layers', home: 'overview' },
  admin: { name: '최고 관리자', icon: 'shield', home: 'overview' },
};

export const testAccounts = [
  { id: 'u1', role: 'user', label: '사용자', email: 'user@smilepoint.kr', copy: '포인트 교환 · 출금 · 쇼핑' },
  { id: 'p1', role: 'partner', label: '웹하드 관리자', email: 'partner@smilepoint.kr', copy: '그린파일 교환 승인 · 정산 · API' },
  { id: 'a1', role: 'admin', label: '최고 관리자', email: 'admin@smilepoint.kr', copy: '회원 · 거래 심사 · 운영 설정' },
];
export const testPassword = 'smile1234';

export const providers = {
  kakao: { name: '카카오', label: '카카오로 시작하기' },
  naver: { name: '네이버', label: '네이버로 시작하기' },
  google: { name: '구글', label: 'Google로 시작하기' },
  apple: { name: '애플', label: 'Apple로 시작하기' },
  email: { name: '이메일', label: '이메일' },
};

export const banks = ['국민은행', '신한은행', '우리은행', '하나은행', '농협은행', '기업은행', '카카오뱅크', '토스뱅크', '케이뱅크', '새마을금고', '우체국'];

export const grades = [
  { id: 'bronze', name: '브론즈', min: 0, feeRate: 1, color: '#b0773f' },
  { id: 'silver', name: '실버', min: 30000, feeRate: .8, color: '#7d8a94' },
  { id: 'gold', name: '골드', min: 100000, feeRate: .6, color: '#c79410' },
  { id: 'vip', name: 'VIP', min: 300000, feeRate: 0, color: '#18563e' },
];

export const ticketCategories = ['포인트 교환', '계좌 출금', '쿠폰·쇼핑', '계정·로그인', '기타'];

export const animals = [
  '고양이','강아지','토끼','수달','여우','곰','판다','레서판다','너구리','다람쥐',
  '코알라','햄스터','사자','호랑이','표범','사슴','알파카','양','소','돼지',
  '말','코끼리','기린','원숭이','펭귄','부엉이','오리','개구리','물범','고슴도치',
];

const won = value => new Intl.NumberFormat('ko-KR').format(value);
export const faqFor = (settings = {}) => [
  ['어떤 포인트를 교환할 수 있나요?', '제휴 웹하드의 판매 적립·활동 적립 포인트를 교환할 수 있습니다. 포인트 교환 화면에서 제휴사별 교환 비율, 최소 금액, 평균 승인 시간을 확인하세요.'],
  ['교환을 신청했는데 왜 사용 가능 잔액이 그대로인가요?', '교환 신청 직후에는 적립 예정 포인트로 표시됩니다. 제휴사가 해당 웹하드 포인트를 확인하고 승인하면 사용 가능 잔액에 반영되고 알림을 보내 드립니다.'],
  ['출금 수수료와 입금일은 어떻게 되나요?', `기본 수수료는 건당 ${won(settings.fee ?? 500)} P이며 회원 등급에 따라 할인됩니다(VIP 무료). 최소 ${won(settings.withdrawalMinimum ?? 5000)} P부터 신청할 수 있고, 승인 후 다음 영업일에 본인 명의 계좌로 입금됩니다.`],
  ['출금 신청을 취소하거나 반려되면 포인트가 돌아오나요?', '네. 처리 대기 중인 신청을 취소하거나 반려되면 해당 포인트는 즉시 사용 가능 잔액으로 돌아옵니다.'],
  ['모바일 쿠폰을 취소할 수 있나요?', '쿠폰 번호를 아직 확인하지 않은 쿠폰은 구매 후 7일 안에 쿠폰함에서 취소할 수 있고, 사용한 포인트는 바로 돌려드립니다. 번호를 확인한 쿠폰은 고객센터에서 사용 여부를 확인한 뒤 처리해 드립니다.'],
  ['웹하드 계정은 어떻게 연결하나요?', '포인트 교환 화면에서 웹하드 아이디를 입력하면 해당 웹하드로 인증번호가 전송됩니다. 웹하드에서 받은 6자리 번호를 입력하면 연결이 완료됩니다. 다른 사람의 아이디는 연결할 수 없습니다.'],
  ['출석체크는 어떻게 하나요?', `내 지갑에서 하루 한 번 출석체크를 하면 ${won(settings.attendancePoints ?? 10)} P가 적립됩니다. 7일 연속 출석하면 보너스 ${won(settings.attendanceBonus ?? 50)} P를 드립니다.`],
  ['다른 회원에게 포인트를 선물할 수 있나요?', `포인트 교환을 1회 이상 완료한 회원은 받는 분의 이메일로 ${won(settings.giftMinimum ?? 1000)} P부터 선물할 수 있습니다. 하루 선물 한도는 ${won(settings.dailyGiftLimit ?? 100000)} P입니다.`],
  ['가입·친구 초대 보너스는 언제 받나요?', `가입 축하 ${won(settings.signupBonus ?? 1000)} P와 추천 코드 입력 보너스 ${won(settings.referralBonus ?? 500)} P는 첫 포인트 교환이 완료되면 지급됩니다. 추천한 분도 친구가 첫 교환을 완료하면 ${won(settings.referralBonus ?? 500)} P를 받습니다.`],
];

export const announcementSeeds = [
  { id: 'n3', title: '디스크온 제휴 오픈 기념 교환 이벤트', date: '2026-11-12', body: '디스크온 포인트를 처음 교환하시면 교환 금액의 5%를 추가로 적립해 드립니다. (이벤트 기간 11.12 ~ 11.30)', pinned: true, visible: true },
  { id: 'n2', title: '모바일 쿠폰 신규 상품 입고 안내', date: '2026-11-10', body: '디저트·문화 카테고리 상품이 새로 추가되었습니다. 포인트 쇼핑에서 확인해 보세요.', pinned: false, visible: true },
  { id: 'n1', title: '스마일 포인트 서비스 오픈 안내', date: '2026-11-01', body: '흩어진 웹하드 포인트를 한곳에 모아 계좌 출금과 모바일 쿠폰 쇼핑에 사용할 수 있습니다.', pinned: false, visible: true },
];

const paths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  exchange: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  wallet: '<path d="M20 8V5H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V7m18 5h-5a2 2 0 0 0 0 4h5"/><path d="M16 14h.01"/>',
  bank: '<path d="M3 9h18L12 4 3 9Zm2 11h14M7 10v7m5-7v7m5-7v7"/>',
  gift: '<path d="M4 11h16v9H4zm-1-4h18v4H3zm9 0v13"/><path d="M12 7c-5 0-7-1-6-3s5-1 6 3Zm0 0c5 0 7-1 6-3s-5-1-6 3Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M16 4.5a3.2 3.2 0 0 1 0 6.3M18 14a4.5 4.5 0 0 1 3 4.3V20"/>',
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
  minus: '<path d="M5 12h14"/>',
  bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"/>',
  logout: '<path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h12"/>',
  login: '<path d="M14 4h6v16h-6M4 12h11m-4-4 4 4-4 4"/>',
  shop: '<path d="M4 8h16l-1 12H5L4 8Zm4 0V6a4 4 0 0 1 8 0v2"/>',
  edit: '<path d="m5 15-1 5 5-1L20 8l-4-4L5 15Zm9-9 4 4"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8m0-12v5h-5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4m8-4v4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M4 20h16"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-4 4 3 3m-6 0 2 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1"/>',
  alert: '<path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H4a3 3 0 0 0 4 4m8-4h4a3 3 0 0 1-4 4m-4 3v4m-4 3h8"/>',
  megaphone: '<path d="M3 10v4h4l8 5V5L7 10H3Zm15-2a5 5 0 0 1 0 8"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3v2Zm11-2v12"/>',
  coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm13 1h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3m4-3v3"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4"/>',
  cake: '<path d="M4 20h16v-7H4v7Zm0-4c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0M12 13V9m0-5c1 1.3 1 2.5 0 3"/>',
  store: '<path d="M4 10v10h16V10M3 4h18l-1 6H4L3 4Zm6 16v-6h6v6"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
};
export const icon = (name, size = 22) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.arrow}</svg>`;

export const socialMark = {
  kakao: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#191919" d="M12 3.5C6.8 3.5 2.6 6.8 2.6 10.9c0 2.6 1.7 4.9 4.3 6.2l-1 3.8c-.1.3.3.6.6.4l4.5-3c.3 0 .7.1 1 .1 5.2 0 9.4-3.3 9.4-7.4S17.2 3.5 12 3.5Z"/></svg>',
  naver: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M15.6 12.8 8.1 2H2v20h6.4V11.2L15.9 22H22V2h-6.4z"/></svg>',
  google: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>',
  apple: '<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24"><path fill="#fff" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9a4.8 4.8 0 0 0-3.8-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9a5 5 0 0 0-4.2 2.5c-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.6 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.3 3-2.5a10 10 0 0 0 1.4-2.8 4.3 4.3 0 0 1-2.4-4.1ZM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.5-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.4Z"/></svg>',
};

export const format = value => new Intl.NumberFormat('ko-KR').format(value);
export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
