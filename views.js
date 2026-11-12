import { animals, announcements, config, escape, faq, format, icon, partners, products, roles } from './catalog.js';
import { balances, partnerAvailable, fee, roleTransactions, statuses, types, withdrawalMinimum } from './state.js';

export const slides = [
  { image: 'hero-exchange-v2', label: '포인트 교환', title: ['흩어진 포인트,', '한곳에 모으세요.'], copy: '제휴 웹하드 포인트를 모아 계좌로 출금하거나\n모바일 쿠폰으로 교환해 보세요.', button: '포인트 교환하기', page: 'exchange' },
  { image: 'hero-withdraw-v2', label: '계좌 출금', title: ['받을 금액과 일정을', '한눈에 확인하세요.'], copy: '신청 전에 수수료와 실수령액을 확인하고\n계좌로 출금하는 과정을 체험해 보세요.', button: '출금 방법 보기', page: 'withdrawal' },
  { image: 'hero-shop-v2', label: '포인트 쇼핑', title: ['모은 포인트로', '오늘의 선물을.'], copy: '커피부터 외식, 편의점 쿠폰까지.\n가지고 있는 포인트로 골라보세요.', button: '포인트 쇼핑', page: 'shop' },
];

const stories = {
  exchange: {
    image: 'story-exchange', label: '포인트 교환 예시', title: '교환 신청 전에 받을 포인트를 확인하세요.',
    copy: '제휴사마다 교환 비율이 다릅니다. 교환 신청 화면에서 받을 금액을 먼저 확인하고, 승인 전에는 내 지갑에서 적립 예정 금액을 볼 수 있어요.',
    button: '내 교환 금액 확인하기', href: '#login/exchange',
  },
  withdrawal: {
    image: 'story-withdraw', label: '계좌 출금 안내', title: '수수료를 빼면 얼마를 받을까요?',
    copy: '출금할 포인트를 입력하면 예상 실수령액이 표시됩니다. 신청한 뒤에는 거래 내역에서 심사와 지급 상태를 확인할 수 있어요.',
    button: '출금 화면 체험하기', href: '#login/withdrawal',
  },
  shop: {
    image: 'story-shop', label: '모바일 쿠폰 이용법', title: '오늘 고른 쿠폰은 내 쿠폰함에.',
    copy: '상품에 필요한 포인트를 확인하고 구매하면 쿠폰함에 발급 내역이 표시됩니다. 카페, 외식, 편의점 중 필요한 상품부터 둘러보세요.',
    button: '포인트로 쿠폰 구매 체험', href: '#login/shop',
  },
};

const quick = [
  ['exchange','exchange','포인트 교환','웹하드 포인트를 한곳으로'],
  ['withdrawal','bank','계좌 출금','실수령액과 입금 일정 확인'],
  ['shop','gift','포인트 쇼핑','모바일 쿠폰을 포인트로'],
];

export const menus = {
  user: [
    ['overview','home','내 지갑'], ['exchange','exchange','포인트 교환'], ['withdrawal','bank','계좌 출금'],
    ['shop','shop','포인트 쇼핑'], ['coupons','gift','쿠폰함'], ['activity','file','거래 내역'], ['support','help','고객센터'], ['profile','user','내 프로필'],
  ],
  partner: [
    ['overview','home','자사 개요'], ['requests','exchange','교환 요청'], ['activity','file','거래 내역'],
    ['settlement','chart','정산 및 대사'], ['integration','link','연동 기록'], ['profile','user','담당자 프로필'],
  ],
  admin: [
    ['overview','home','운영 개요'], ['members','user','회원 관리'], ['partners','layers','제휴사 관리'], ['requests','exchange','교환 심사'],
    ['payouts','bank','출금 심사'], ['orders','gift','쿠폰 상품·주문'], ['settlement','chart','정산 및 대사'],
    ['support','help','고객센터'], ['content','file','배너·공지'], ['audit','shield','감사 기록'], ['profile','user','내 프로필'],
  ],
};

const pageDescriptions = {
  exchange: '제휴사별 조건을 확인하고 포인트를 교환하세요.',
  withdrawal: '출금 조건과 실수령액을 확인하고 모의 출금을 신청하세요.',
  shop: '보유한 포인트로 모바일 쿠폰을 구매해 보세요.',
  coupons: '포인트로 구매한 체험용 쿠폰을 확인하세요.',
  activity: '교환, 출금, 구매 상태와 거래번호를 확인하세요.',
  requests: '대기 중인 교환을 확인하고 승인 또는 반려하세요.',
  payouts: '출금 요청과 예상 지급액을 확인하고 모의 지급을 처리하세요.',
  orders: '체험 상품과 쿠폰 주문 내역을 확인하세요.',
  settlement: '완료 거래를 제휴사별로 확인하세요.',
  integration: '제휴사 거래 결과를 확인하세요.',
  members: '체험 계정과 역할을 확인하세요.',
  partners: '제휴사별 교환 조건과 신청 현황을 확인하세요.',
  support: '서비스 이용 문의와 처리 현황을 확인하세요.',
  content: '메인 배너와 공개 공지를 확인하세요.',
  audit: '거래 처리 결과와 마지막 변경 시각을 확인하세요.',
  profile: '이름, 동물 캐릭터 또는 직접 올린 사진을 관리하세요.',
};

export const brand = () => `<a class="brand" href="#home"><img src="./assets/smile.svg" alt="" width="40" height="40"><span>${config.name}<small>${config.english}</small></span></a>`;
export const money = value => `${format(value)} <small>${config.point}</small>`;
const showDate = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date(value));
const showTime = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const partnerName = id => partners.find(item => item.id === id)?.name ?? '—';
const productName = id => products.find(item => item.id === id)?.name ?? '—';
const pill = (text, style = 'plain') => `<span class="pill ${style}">${text}</span>`;
const button = (label, href, css = 'btn primary', glyph = 'arrow') => `<a class="${css}" href="${href}">${label}${glyph ? icon(glyph, 18) : ''}</a>`;
const heading = (eyebrow, title, copy) => `<div class="section-title"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${copy}</p></div>`;
const blank = (message, glyph = 'inbox') => `<div class="empty">${icon(glyph, 28)}<p>${message}</p></div>`;

export function avatar(profile, css = '') {
  const photo = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(profile.photo) ? profile.photo : '';
  const index = Number.isInteger(profile.avatar) && animals[profile.avatar] ? profile.avatar : 0;
  return `<img class="avatar ${css}" src="${photo || './assets/animal-' + (index + 1) + '.jpg'}" alt="${photo ? '사용자 프로필 사진' : animals[index]}">`;
}

function header() {
  return `<header class="site-header"><div class="container header-inner">
    ${brand()}
    <nav class="site-nav" id="site-menu" aria-label="주 메뉴">
      <a href="#partners">포인트 교환</a><a href="#withdraw">계좌 출금</a><a href="#shop">포인트 쇼핑</a><a href="#guide">이용 안내</a>
    </nav>
    <div class="header-actions"><a href="#login" class="login-link">로그인</a>${button('체험 시작하기', '#login', 'btn primary header-cta', 'arrow')}
    <button class="icon-btn mobile-toggle" type="button" data-action="site-menu" aria-label="주 메뉴" aria-controls="site-menu" aria-expanded="false">${icon('menu')}</button></div>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-top">${brand()}
    <nav aria-label="하단 메뉴"><a href="#partners">제휴사</a><a href="#withdraw">계좌 출금</a><a href="#shop">포인트 쇼핑</a><a href="#guide">이용 안내</a><a href="#support">고객센터</a><a href="#login">체험 로그인</a></nav>
    </div><div class="container footer-bottom"><span>${config.name} · 체험 서비스</span><span>© ${config.english}</span></div></footer>`;
}

export function hero(index) {
  const slide = slides[index];
  return `<div class="hero-split hero-${slide.page}">
    <div class="hero-image"><img src="./assets/${slide.image}.jpg" alt="" width="1320" height="880" fetchpriority="high"></div>
    <div class="container hero-inner"><div class="hero-copy" aria-live="polite">
      <span class="hero-kicker"><i></i>${slide.label}</span>
      <h1>${slide.title[0]}<br><em>${slide.title[1]}</em></h1>
      <p>${slide.copy}</p>
      <div class="hero-actions">${button(slide.button, '#login/' + slide.page, 'btn lime')}<a href="#guide" class="hero-secondary">이용 방법 ${icon('chevron', 15)}</a></div>
    </div><div class="carousel" aria-label="배너 선택">
      <span class="count"><b>0${index + 1}</b><span></span>0${slides.length}</span>
      ${slides.map((slide, i) => `<button type="button" class="dot ${i === index ? 'selected' : ''}" data-action="slide" data-index="${i}" aria-label="${slide.label} 배너" aria-pressed="${i === index}"></button>`).join('')}
      <button type="button" class="round" data-action="prev" aria-label="이전 배너">${icon('back', 17)}</button>
      <button type="button" class="round" data-action="next" aria-label="다음 배너">${icon('chevron', 17)}</button>
    </div></div>
  </div>`;
}

function partnerCards(state, mode = 'exchange') {
  return `<div class="card-grid partner-grid">${partners.map(item => `<article class="partner-card">
    <div class="partner-top"><span class="partner-logo ${item.color}">${item.initials}</span>${pill(item.type)}</div>
    <h3>${item.name}</h3><p class="partner-rate"><strong>${item.divisor} P</strong>${icon('arrow', 16)}<strong>1 스마일 P</strong></p>
    <div class="partner-foot"><span>${mode === 'exchange' ? '교환 가능 ' + format(partnerAvailable(state, item.id)) + ' P' : '최소 ' + format(item.min) + ' P'}</span>
    ${mode === 'exchange' ? `<button class="text-btn" type="button" data-action="exchange" data-id="${item.id}">교환하기 ${icon('chevron', 16)}</button>` :
      mode === 'public' ? button('교환하기', '#login/exchange', 'text-btn', 'chevron') : pill(state.transactions.filter(row => row.partner === item.id && row.status === 'pending').length + '건 대기', 'pending')}</div>
  </article>`).join('')}</div>`;
}

function productCard(item) {
  return `<button class="product-card" type="button" data-action="product" data-id="${item.id}">
    <div class="product-image"><img loading="lazy" src="./assets/${item.image}.jpg" alt=""><span>${item.category}</span></div>
    <div class="product-detail"><p>${item.brand}</p><h3>${item.name}</h3><div><strong>${money(item.cost)}</strong><span class="product-arrow">${icon('arrow', 18)}</span></div></div>
  </button>`;
}

function productCards() {
  return `<div class="filter-row" aria-label="상품 분류">${['전체','카페','외식','편의점'].map((item, i) =>
    `<button type="button" class="filter ${i === 0 ? 'active' : ''}" data-action="category" data-value="${item}" aria-pressed="${i === 0}">${item}</button>`).join('')}</div>
    <div class="card-grid product-grid" data-products>${products.map(productCard).join('')}</div>`;
}

export function filteredProducts(category) {
  return products.filter(item => category === '전체' || item.category === category).map(productCard).join('');
}

function storyBanner(key, detail) {
  const story = stories[key];
  return `<article class="story-banner story-${key}">
    <div class="story-image"><img src="./assets/${story.image}.jpg" alt="" width="1020" height="680" loading="lazy" decoding="async"></div>
    <div class="story-copy"><span class="eyebrow">${story.label}</span><h2>${story.title}</h2><p>${story.copy}</p>
      ${detail}${button(story.button, story.href, 'btn primary')}
    </div>
  </article>`;
}

function withdrawalGuide() {
  const exampleAmount = 10000;
  const terms = [
    ['최소 신청 금액', format(withdrawalMinimum) + ' P'],
    ['건당 수수료', format(fee) + ' P'],
    ['예상 입금일', '승인 후 다음 영업일'],
  ];
  return `<section class="section cash-section" id="withdraw" aria-label="계좌 출금"><div class="container">
    ${storyBanner('withdrawal', `<div class="story-example"><span>${format(exampleAmount)} P 출금 예시</span><strong>${format(exampleAmount - fee)}원 실수령</strong></div>`)}
    <dl class="cash-terms">${terms.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
    <p class="section-note">위 금액과 일정은 체험 기준이며 실제로 입금되지 않습니다.</p>
  </div></section>`;
}

function usageGuide() {
  const steps = [
    ['layers', '제휴사 선택', '제휴사 카드에서 교환할 포인트 종류와 최소 신청 금액을 확인하세요.'],
    ['exchange', '교환 신청', '받을 포인트를 확인하고 신청하세요. 승인 전에는 적립 예정으로 표시됩니다.'],
    ['gift', '출금 또는 쇼핑', '적립이 완료되면 계좌 출금과 모바일 쿠폰 쇼핑에 쓸 수 있어요.'],
  ];
  const states = [
    ['clock', '적립 예정', '교환을 신청하고 제휴사 승인을 기다리는 포인트예요.'],
    ['wallet', '사용 가능', '지금 출금하거나 모바일 쿠폰을 구매할 수 있는 포인트예요.'],
    ['bank', '처리 중', '이미 출금을 신청해 지급 결과를 기다리는 포인트예요.'],
  ];
  return `<section class="section container" id="guide">
    <div class="section-head">${heading('이용 안내', '교환부터 사용까지, 세 단계', '제휴사를 선택하고 교환이 끝나면 원하는 방법으로 사용하세요.')}</div>
    <ol class="card-grid steps">${steps.map(([glyph, title, copy], index) => `<li class="step"><span class="feature-icon tone-${index}">${icon(glyph)}</span><small>0${index + 1}</small><h3>${title}</h3><p>${copy}</p></li>`).join('')}</ol>
    <div class="wallet-guide"><div class="wallet-guide-title"><span class="eyebrow">내 지갑</span><h3>잔액은 이렇게 표시돼요</h3></div>
      <div class="wallet-states">${states.map(([glyph, title, copy]) => `<div>${icon(glyph, 20)}<div><strong>${title}</strong><p>${copy}</p></div></div>`).join('')}</div>
    </div>
  </section>`;
}

export function landing(index) {
  const examplePartner = partners[0];
  const exampleSource = 12000;
  const example = `<div class="story-example"><span>${examplePartner.name} ${format(exampleSource)} P</span><strong>스마일 ${format(exampleSource / examplePartner.divisor)} P 적립</strong></div>`;
  return `${header()}<main id="main">
    <section id="hero" aria-label="스마일 포인트 소개">${hero(index)}</section>
    <div class="quick-wrap"><div class="container quick-grid">${quick.map(([page, glyph, label, copy], i) => `<a class="quick-card" href="#login/${page}">
      <span class="feature-icon tone-${i}">${icon(glyph, 25)}</span><span><strong>${label}</strong><small>${copy}</small></span>${icon('chevron', 18)}</a>`).join('')}</div></div>
    <section class="section container" id="partners">
      <div class="section-head">${heading('제휴 포인트', '포인트를 가져올 수 있는 곳', '웹하드별 교환 비율과 최소 신청 금액을 먼저 확인하세요.')}${button('교환 체험하기', '#login/exchange', 'btn outline')}</div>
      ${partnerCards(null, 'public')}<p class="section-note">화면에 표시된 제휴사는 체험용 예시입니다.</p>
      <div class="section-story">${storyBanner('exchange', example)}</div>
    </section>
    ${withdrawalGuide()}
    <section class="shopping section" id="shop"><div class="container">
      <div class="section-head">${heading('포인트 쇼핑', '오늘은 어떤 선물을 고를까요?', '커피 한 잔부터 간식과 외식까지, 모은 포인트로 고를 수 있어요.')}${button('쇼핑 체험하기', '#login/shop', 'btn outline')}</div>${productCards()}
      <div class="section-story">${storyBanner('shop', '<p class="story-note">체험용 쿠폰은 실제 매장에서 사용할 수 없습니다.</p>')}</div>
    </div></section>
    ${usageGuide()}
    <section class="help-section section" id="support"><div class="container">
      <div class="section-head">${heading('고객센터', '무엇을 도와드릴까요?', '이용 중 궁금한 점을 확인하거나 체험 문의를 남겨 보세요.')}${button('문의하기', '#login/support', 'btn outline')}</div>
      <div class="help-grid"><div class="panel"><h3>자주 묻는 질문</h3>${faqList()}</div><div class="panel"><h3>공지사항</h3>${announcementList()}</div></div>
    </div></section>
  </main>${footer()}`;
}

function faqList() {
  return `<div class="disclosure-list">${faq.map(([question, answer]) => `<details><summary>${question}<span>${icon('plus', 17)}</span></summary><p>${answer}</p></details>`).join('')}</div>`;
}

function announcementList() {
  return `<div class="disclosure-list">${announcements.map(([title, date, copy]) => `<details><summary><span>${title}<small>${date}</small></span>${icon('plus', 17)}</summary><p>${copy}</p></details>`).join('')}</div>`;
}

export function login(target) {
  return `${header()}<main id="main" class="login-page"><div class="login-card">
    <img src="./assets/smile.svg" alt="" width="56" height="56"><span class="eyebrow">계정 체험</span>
    <h1>${config.name}에<br>오신 것을 환영합니다.</h1>
    <p>계정을 선택하면 샘플 데이터가 담긴 대시보드로 이동합니다.</p>
    <div class="role-buttons">${Object.entries(roles).map(([id, role], i) => `<a href="#app/${id}/${id === 'user' ? target : 'overview'}">
      <span class="feature-icon tone-${i}">${icon(role.icon, 23)}</span><span><strong>${role.name} 체험</strong><small>${['포인트 교환 · 출금 · 쇼핑','자사 교환 승인 · 정산','전체 거래 심사 · 운영'][i]}</small></span>${icon('chevron', 19)}</a>`).join('')}</div>
    <a class="text-btn" href="#home">${icon('back', 16)} 메인으로 돌아가기</a>
  </div></main>`;
}

function transactionLabel(row) {
  if (row.type === 'exchange') return partnerName(row.partner);
  if (row.type === 'coupon') return productName(row.product);
  return '체험 계좌 · 실수령 ' + format(row.points - row.fee) + '원';
}

export function table(rows, role, { actions = true, showUpdate = false } = {}) {
  if (!rows.length) return blank('해당 조건의 거래가 없습니다.');
  return `<div class="table-scroll"><table><thead><tr><th scope="col">거래</th><th scope="col">신청일</th><th scope="col">포인트</th><th scope="col">상태</th>${showUpdate ? '<th scope="col">최종 변경</th>' : ''}${actions ? '<th scope="col"><span class="sr-only">상세 및 처리</span></th>' : ''}</tr></thead>
    <tbody>${rows.map(row => `<tr><td><strong>${types[row.type]} · ${transactionLabel(row)}</strong><small>${row.id}</small></td><td>${showDate(row.date)}</td>
      <td class="numeric">${row.type === 'exchange' ? '+' : '−'}${format(row.points)} P</td><td>${pill(statuses[row.status], row.status)}</td>
      ${showUpdate ? `<td>${row.updated ? showTime(row.updated) : '—'}</td>` : ''}${actions ? `<td><button type="button" class="text-btn" data-action="transaction" data-id="${row.id}">${row.status === 'pending' && role !== 'user' ? '처리' : '상세'} ${icon('chevron', 15)}</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function metric(label, value, glyph, hint, i) {
  return `<article class="metric"><span class="feature-icon tone-${i}">${icon(glyph)}</span><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`;
}

function overview(state, role) {
  const rows = roleTransactions(state, role);
  const { available, pending, reserved } = balances(state);
  const pendingRows = rows.filter(row => row.status === 'pending');
  const done = rows.filter(row => row.status === 'complete');
  const summary = role === 'user' ? [
    ['사용 가능 포인트', money(available), 'wallet', '출금과 쿠폰 구매에 사용할 수 있어요.'],
    ['적립 예정 포인트', money(pending), 'clock', '제휴사 승인 후 적립됩니다.'],
    ['처리 중 포인트', money(reserved), 'bank', '진행 중인 출금 신청 금액입니다.'],
  ] : [
    ['처리 대기', format(pendingRows.length) + '건', 'clock', role === 'partner' ? '그린파일 교환 승인 대기' : '교환·출금 심사 대기'],
    ['처리 완료', format(done.length) + '건', 'check', '전체 체험 기간의 완료 거래'],
    ['누적 거래', format(rows.length) + '건', 'chart', '반려와 취소 건 포함'],
  ];
  return `<section class="dash-banner"><div><span class="eyebrow">${roles[role].name} 대시보드</span>
    <h1>${escape(state.profiles[role].name)}님, 안녕하세요.</h1><p>${role === 'user' ? '흩어진 포인트를 모으고, 필요한 곳에 써 보세요.' : '오늘 처리할 거래와 최근 거래를 확인하세요.'}</p></div>
    ${avatar(state.profiles[role], 'banner-avatar')}</section>
    <div class="card-grid metrics">${summary.map(([label, value, glyph, hint], i) => metric(label, value, glyph, hint, i)).join('')}</div>
    ${role === 'user' ? `<div class="card-grid dash-quick">${quick.map(([page, glyph, label, copy], i) => `<a class="quick-card" href="#app/user/${page}"><span class="feature-icon tone-${i}">${icon(glyph)}</span><span><strong>${label}</strong><small>${copy}</small></span>${icon('chevron', 17)}</a>`).join('')}</div>`
    : `<div class="dash-shortcuts">${button('교환 요청 보기', '#app/' + role + '/requests', 'btn primary')}${role === 'admin' ? button('출금 심사', '#app/admin/payouts', 'btn outline') : button('정산 보기', '#app/partner/settlement', 'btn outline')}</div>`}
    <section class="panel"><div class="panel-head"><h2>최근 거래</h2>${button('전체 내역', '#app/' + role + '/' + (role === 'admin' ? 'audit' : 'activity'), 'text-btn', 'chevron')}</div>${table(rows.slice(0, 6), role)}</section>`;
}

function profilePage(profile) {
  return `<section class="panel profile-panel"><div class="profile-current">${avatar(profile, 'profile-avatar')}<div><h2>프로필 사진</h2><p>사진을 올리면 선택한 동물 캐릭터보다 먼저 표시됩니다.</p>
    <div class="profile-actions"><label class="btn outline" for="profile-photo">${icon('edit', 17)} 사진 올리기</label><input class="sr-only" id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp">
    ${profile.photo ? '<button class="text-btn" type="button" data-action="remove-photo">사진 삭제</button>' : ''}</div></div></div>
    <form class="name-form" data-form="profile"><label for="profile-name">표시 이름</label><div><input id="profile-name" name="name" required maxlength="24" value="${escape(profile.name)}"><button class="btn primary" type="submit">저장</button></div></form>
    <div class="panel-head avatar-heading"><h2>동물 캐릭터</h2><button type="button" class="btn outline" data-action="random-avatar">${icon('refresh', 17)} 무작위 선택</button></div>
    <div class="avatar-grid">${animals.map((name, i) => `<button type="button" class="avatar-option ${profile.avatar === i ? 'selected' : ''}" data-action="avatar" data-id="${i}" aria-pressed="${profile.avatar === i}"><img src="./assets/animal-${i + 1}.jpg" alt="" loading="lazy"><span>${name}</span></button>`).join('')}</div>
  </section>`;
}

function supportPage(state, role) {
  const tickets = state.tickets;
  return `<div class="help-grid dash-help">
    <section class="panel"><h2>${role === 'admin' ? '등록된 문의' : '1:1 문의'}</h2>
      ${role === 'user' ? `<form class="stack" data-form="ticket"><label for="ticket-transaction">관련 거래</label><select name="transaction" id="ticket-transaction"><option value="">일반 문의</option>${state.transactions.map(row => `<option value="${row.id}">${row.id} · ${types[row.type]}</option>`).join('')}</select>
      <label for="ticket-text">문의 내용</label><textarea id="ticket-text" name="message" maxlength="500" rows="4" required></textarea><button class="btn primary" type="submit">문의 등록</button></form>` : ''}
      ${tickets.length ? `<div class="ticket-list">${tickets.map(item => `<article><strong>${item.transaction || '일반 문의'}</strong><small>${showDate(item.date)}</small><p>${escape(item.message)}</p>${item.reply ? `<p class="ticket-reply"><strong>운영 답변</strong> ${escape(item.reply)}</p>` : role === 'admin' ? `<form class="stack" data-form="reply" data-id="${item.id}"><label for="reply-${item.id}">운영 답변</label><textarea rows="2" id="reply-${item.id}" name="reply" maxlength="500" required></textarea><button type="submit" class="btn outline">답변 저장</button></form>` : pill('답변 대기', 'pending')}</article>`).join('')}</div>` : blank('등록된 문의가 없습니다.')}</section>
    <section class="panel"><h2>자주 묻는 질문</h2>${faqList()}</section></div>`;
}

function settlement(rows, role) {
  const totals = partners.filter(p => role === 'admin' || p.id === 'green').map(item => {
    const matching = rows.filter(row => row.partner === item.id && row.status === 'complete');
    return `<tr><td><strong>${item.name}</strong></td><td>${matching.length}건</td><td>${format(matching.reduce((sum, row) => sum + row.source, 0))} P</td><td>${format(matching.reduce((sum, row) => sum + row.points, 0))} P</td></tr>`;
  });
  return `<section class="panel"><div class="panel-head"><h2>교환 완료 집계</h2>${pill('체험 자료', 'pending')}</div>
    <div class="table-scroll"><table><thead><tr><th>제휴사</th><th>완료 건</th><th>제휴 포인트</th><th>스마일 포인트</th></tr></thead><tbody>${totals.join('')}</tbody></table></div>
    <p class="section-note">스마일 포인트의 체험 거래 원장을 기준으로 계산한 내역입니다.</p></section>`;
}

function pageContent(state, role, page) {
  const rows = roleTransactions(state, role);
  switch (page) {
    case 'exchange': return partnerCards(state);
    case 'withdrawal': return `<section class="panel max-form"><h2>계좌 출금 신청</h2><p class="muted">최소 ${format(withdrawalMinimum)} P · 수수료 ${format(fee)} P · 승인 후 다음 영업일 예정</p>
      <form class="stack" data-form="withdrawal"><label for="withdraw-amount">출금할 포인트</label><input id="withdraw-amount" name="amount" type="number" required min="${withdrawalMinimum}" max="${balances(state).available}" placeholder="5,000">
      <div class="form-summary"><div><span>사용 가능</span><strong>${money(balances(state).available)}</strong></div><div><span>입금 계좌</span><strong>체험은행 · •••• 3070</strong></div><div><span>수수료</span><strong>${money(fee)}</strong></div><div><span>예상 실수령액</span><strong id="withdraw-net">0원</strong></div></div>
      <button type="submit" class="btn primary" ${balances(state).available < withdrawalMinimum ? 'disabled' : ''}>모의 출금 신청 ${icon('arrow', 17)}</button></form></section>`;
    case 'shop': return productCards();
    case 'coupons': {
      const coupons = rows.filter(row => row.type === 'coupon' && row.status === 'complete');
      return coupons.length ? `<div class="card-grid coupon-grid">${coupons.map(row => `<article class="panel coupon"><span class="feature-icon tone-2">${icon('gift')}</span><h2>${productName(row.product)}</h2><p>${showDate(row.date)} 구매</p><code>DEMO-${row.id}</code><small>체험 쿠폰 · 실제 사용 불가</small></article>`).join('')}</div>` : blank('구매한 쿠폰이 없습니다.', 'gift');
    }
    case 'activity': return `<section class="panel"><div class="panel-head"><h2>전체 거래</h2></div>${table(rows, role)}</section>`;
    case 'requests':
    case 'payouts': {
      const type = page === 'requests' ? 'exchange' : 'withdrawal';
      const matching = rows.filter(row => row.type === type);
      return `<section class="panel"><div class="panel-head"><h2>처리 대기</h2>${pill(matching.filter(row => row.status === 'pending').length + '건', 'pending')}</div>${table(matching.filter(row => row.status === 'pending'), role)}</section>
        <section class="panel"><h2>처리 내역</h2>${table(matching.filter(row => row.status !== 'pending'), role, { showUpdate: true })}</section>`;
    }
    case 'orders': return `<section class="panel"><h2>쿠폰 주문</h2>${table(rows.filter(row => row.type === 'coupon'), role)}</section><section class="panel"><h2>체험 상품</h2>${productCards()}</section>`;
    case 'settlement': return settlement(rows, role);
    case 'integration': return `<section class="panel"><div class="panel-head"><h2>그린파일 연동 기록</h2>${pill('모의 연동', 'pending')}</div>${table(rows, role, { actions: false, showUpdate: true })}</section>`;
    case 'members': return `<div class="card-grid">${Object.entries(roles).map(([id, data]) => `<section class="panel member-card">${avatar(state.profiles[id])}<h2>${escape(state.profiles[id].name)}</h2><p>${data.name}</p></section>`).join('')}</div>`;
    case 'partners': return partnerCards(state, 'admin');
    case 'support': return supportPage(state, role);
    case 'content': {
      const bannerCards = items => `<div class="card-grid">${items.map(({ image, title, label }) => `<article class="panel content-card"><img src="./assets/${image}.jpg" alt="" loading="lazy"><h3>${title}</h3><p>${label}</p></article>`).join('')}</div>`;
      return `<section class="panel"><h2>메인 배너</h2>${bannerCards(slides.map(slide => ({ ...slide, title: slide.title.join(' ') })))}</section>
        <section class="panel"><h2>본문 배너</h2>${bannerCards(Object.values(stories))}</section>
        <section class="panel"><h2>공지사항</h2>${announcementList()}</section>`;
    }
    case 'audit': return `<section class="panel"><h2>거래 처리 기록</h2>${table(rows, role, { showUpdate: true })}</section>`;
    case 'profile': return profilePage(state.profiles[role]);
    default: return '';
  }
}

export function dashboard(state, role, page) {
  const links = menus[role];
  return `<div class="dash">
    <aside class="sidebar" id="dash-menu"><div class="sidebar-top">${brand()}<span class="role-label">${icon(roles[role].icon, 16)} ${roles[role].name}</span></div>
      <nav aria-label="대시보드 메뉴">${links.map(([id, glyph, label]) => `<a href="#app/${role}/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(glyph, 19)}${label}</a>`).join('')}</nav>
      <div class="side-foot"><a href="#login">${icon('logout', 19)} 계정 전환</a><a href="#home">${icon('external', 18)} 메인으로</a></div>
    </aside>
    <div class="dash-main"><header class="dash-header">
      <div><button type="button" class="icon-btn dash-toggle" data-action="dash-menu" aria-label="대시보드 메뉴" aria-controls="dash-menu" aria-expanded="false">${icon('menu')}</button>
      <span class="demo-indicator"><i></i> 체험 환경</span></div>
      <a class="dash-profile" href="#app/${role}/profile">${avatar(state.profiles[role])}<span>${escape(state.profiles[role].name)}<small>${roles[role].name}</small></span>${icon('chevron', 15)}</a>
    </header><main id="main" class="dash-content">
      ${page === 'overview' ? overview(state, role) : `<div class="dash-title"><h1>${links.find(item => item[0] === page)[2]}</h1><p>${pageDescriptions[page]}</p></div>${pageContent(state, role, page)}`}
    </main></div>
  </div>`;
}

export function details(row) {
  return `<div class="form-summary"><div><span>거래번호</span><strong>${row.id}</strong></div><div><span>거래 유형</span><strong>${types[row.type]}</strong></div>
    <div><span>거래 내용</span><strong>${transactionLabel(row)}</strong></div><div><span>거래 포인트</span><strong>${money(row.points)}</strong></div>
    <div><span>상태</span>${pill(statuses[row.status], row.status)}</div>${row.type === 'withdrawal' ? '<div><span>예상 입금</span><strong>승인 후 다음 영업일</strong></div>' : ''}</div>`;
}
