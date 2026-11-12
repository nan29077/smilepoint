import { config, escape, faqFor, format, grades, icon, socialMark, testAccounts, testPassword } from '../catalog.js';
import { current, publicStats } from '../state.js';
import { legalBody, legalDocs } from './legal.js';
import { announcementList, avatar, brand, button, faqList, heading, productCards } from './ui.js';

export const slides = [
  { image: 'hero-exchange-v2', mobileImage: 'hero-exchange-mobile-v3', label: '포인트 교환', title: ['흩어진 포인트,', '한곳에 모으세요.'], copy: '여러 웹하드에 쌓인 포인트를 스마일 포인트로 모아\n계좌로 출금하거나 모바일 쿠폰으로 바꿔 보세요.', button: '포인트 교환하기', page: 'exchange' },
  { image: 'hero-withdraw-v2', mobileImage: 'hero-withdraw-mobile-v3', label: '계좌 출금', title: ['받을 금액과 일정을', '한눈에 확인하세요.'], copy: '신청 전에 수수료와 실수령액을 미리 보고\n본인 명의 계좌로 안전하게 받아 보세요.', button: '출금 신청하기', page: 'withdrawal' },
  { image: 'hero-shop-v2', mobileImage: 'hero-shop-mobile-v3', label: '포인트 쇼핑', title: ['모은 포인트로', '오늘의 선물을.'], copy: '커피부터 외식, 편의점, 영화 관람권까지.\n가지고 있는 포인트로 바로 골라 보세요.', button: '쿠폰 쇼핑하기', page: 'shop' },
];

const stories = {
  exchange: { image: 'story-exchange', label: '포인트 교환', title: '교환 신청 전에 받을 포인트를 확인하세요.', copy: '웹하드 계정을 연결하면 교환 가능 잔액과 적용 비율, 받을 스마일 포인트를 확인할 수 있어요.', button: '내 교환 금액 확인하기', href: '#app/user/exchange' },
  withdrawal: { image: 'story-withdraw', label: '계좌 출금', title: '수수료를 빼면 얼마를 받을까요?', copy: '출금할 포인트를 입력하면 예상 실수령액이 바로 표시됩니다. 회원 등급이 오르면 수수료가 할인되고, VIP는 무료예요.', button: '출금하러 가기', href: '#app/user/withdrawal' },
  shop: { image: 'story-shop', label: '모바일 쿠폰', title: '오늘 고른 쿠폰은 내 쿠폰함에.', copy: '상품을 고르고 포인트로 결제하면 바코드가 담긴 쿠폰이 쿠폰함에 바로 발급됩니다.', button: '쿠폰 둘러보기', href: '#app/user/shop' },
};

const quick = [
  ['exchange', 'exchange', '포인트 교환', '웹하드 포인트를 한곳으로'],
  ['withdrawal', 'bank', '계좌 출금', '실수령액과 입금 일정 확인'],
  ['shop', 'gift', '포인트 쇼핑', '모바일 쿠폰을 포인트로'],
  ['attendance', 'calendar', '출석체크', '매일 출석하고 포인트 받기'],
];

const webhardDirectory = [
  { name: '온디스크', domain: 'ondisk.co.kr', logo: 'webhard-ondisk.png' },
  { name: '케이디스크', domain: 'kdisk.co.kr', logo: 'webhard-kdisk.png' },
  { name: '파일조', domain: 'filejo.com', logo: 'webhard-filejo.png' },
  { name: '파일마루', domain: 'filemaru.com', logo: 'webhard-filemaru.png' },
  { name: '미투디스크', domain: 'me2disk.com', logo: 'webhard-me2disk.svg' },
  { name: '스마트파일', domain: 'smartfile.co.kr', logo: 'webhard-smartfile.png' },
];

export function header(state, { stickyOnMobile = false } = {}) {
  const me = current(state);
  const actions = me
    ? `<a class="header-user" href="#app/${me.role}/overview">${avatar(me)}<span>${escape(me.name)}</span></a>
       ${button('내 대시보드', '#app/' + me.role + '/overview', 'btn primary header-cta', '')}
       <button type="button" class="icon-btn" data-action="logout" aria-label="로그아웃" title="로그아웃">${icon('logout', 20)}</button>`
    : `<a href="#login" class="btn outline header-login">로그인</a>${button('회원가입', '#signup', 'btn primary header-cta', '')}`;
  return `<header class="site-header${stickyOnMobile ? ' site-header--landing' : ''}"><div class="container header-inner">
    ${brand()}
    <nav class="site-nav" id="site-menu" aria-label="주 메뉴">
      <a href="#partners">포인트 교환</a><a href="#withdraw">계좌 출금</a><a href="#shop">포인트 쇼핑</a><a href="#guide">이용 안내</a><a href="#support">고객센터</a>
    </nav>
    <div class="header-actions">${actions}
    <button class="icon-btn mobile-toggle" type="button" data-action="site-menu" aria-label="주 메뉴" aria-controls="site-menu" aria-expanded="false">${icon('menu')}</button></div>
  </div></header>`;
}

export function footer(state) {
  const demo = state?.server?.demo !== false;
  return `<footer class="site-footer"><div class="container footer-top">${brand()}
    <nav aria-label="하단 메뉴"><a href="#partners">웹하드 업체</a><a href="#withdraw">계좌 출금</a><a href="#shop">포인트 쇼핑</a><a href="#guide">이용 안내</a><a href="#support">고객센터</a><a href="#login">로그인</a><a href="#signup">회원가입</a></nav>
    </div><div class="container footer-info"><p>${config.name}(가칭) · 고객센터 ${config.support} (${config.hours}) · 제휴 문의 partner@smilepoint.kr</p>
    ${demo ? '<p>개발 중인 데모 서비스입니다. 제휴사·상품·거래 데이터는 샘플이며 실제 포인트 교환과 지급은 일어나지 않습니다.</p>' : '<p>사업자 정보는 정식 오픈 시 게시됩니다.</p>'}</div>
    <div class="container footer-bottom"><span><a href="#terms">이용약관</a> · <a href="#privacy"><b>개인정보처리방침</b></a></span><span>© 2026 ${config.english}</span></div></footer>`;
}

export function hero(index) {
  const slide = slides[index];
  return `<div class="hero-split hero-${slide.page}">
    <div class="hero-image"><picture>
      <source media="(max-width: 760px)" srcset="./assets/${slide.mobileImage}.jpg" width="900" height="1200">
      <img src="./assets/${slide.image}.jpg" alt="" width="1320" height="880" fetchpriority="high">
    </picture></div>
    <div class="container hero-inner"><div class="hero-copy" aria-live="polite">
      <span class="hero-kicker"><i></i>${slide.label}</span>
      <h1>${slide.title[0]}<br><em>${slide.title[1]}</em></h1>
      <p>${slide.copy}</p>
      <div class="hero-actions">${button(slide.button, '#app/user/' + slide.page, 'btn lime')}<a href="#guide" class="hero-secondary">이용 방법 ${icon('chevron', 15)}</a></div>
    </div><div class="carousel" aria-label="배너 선택">
      <span class="count"><b>0${index + 1}</b><span></span>0${slides.length}</span>
      ${slides.map((item, i) => `<button type="button" class="dot ${i === index ? 'selected' : ''}" data-action="slide" data-index="${i}" aria-label="${item.label} 배너" aria-pressed="${i === index}"></button>`).join('')}
      <button type="button" class="round" data-action="prev" aria-label="이전 배너">${icon('back', 17)}</button>
      <button type="button" class="round" data-action="next" aria-label="다음 배너">${icon('chevron', 17)}</button>
    </div></div>
  </div>`;
}

function storyBanner(key, detail) {
  const story = stories[key];
  return `<article class="story-banner story-${key}">
    <div class="story-image"><img src="./assets/${story.image}.jpg" alt="" width="1020" height="680" loading="lazy" decoding="async"></div>
    <div class="story-copy"><span class="eyebrow">${story.label}</span><h2>${story.title}</h2><p>${story.copy}</p>${detail}${button(story.button, story.href, 'btn primary')}</div>
  </article>`;
}

function webhardCards() {
  return `<ul class="webhard-list">${webhardDirectory.map(({ name, domain, logo }) => `<li>
    <a class="webhard-card" href="https://www.${domain}/" target="_blank" rel="noopener noreferrer" aria-label="${name} 공식 사이트 (새 창)">
      <span class="webhard-thumbnail"><img src="./assets/${logo}" alt="" width="104" height="48" loading="lazy" decoding="async"></span>
      <span class="webhard-name"><strong>${name}</strong><small>${domain}</small></span>
      <span class="webhard-link-icon">${icon('external', 16)}</span>
    </a>
  </li>`).join('')}</ul>`;
}

function stats(state) {
  const summary = state.stats ?? publicStats(state);
  const exchanged = summary.exchanged;
  const members = summary.members;
  const items = [
    ['exchange', format(exchanged) + ' P', '누적 교환 포인트'],
    ['users', format(members) + '명', '함께하는 회원'],
    ['layers', webhardDirectory.length + '곳', '웹하드 업체 안내'],
    ['gift', state.products.filter(item => item.active).length + '종', '모바일 쿠폰 상품'],
  ];
  return `<div class="stats-band"><div class="container stats-grid">${items.map(([glyph, value, label]) => `<div>${icon(glyph, 24)}<strong>${value}</strong><span>${label}</span></div>`).join('')}</div></div>`;
}

export function landing(state, index) {
  const fee = state.settings.fee;
  const example = `<div class="story-example"><span>그린파일 12,000 P</span><strong>스마일 6,000 P 적립</strong></div>`;
  const terms = [['최소 신청 금액', format(state.settings.withdrawalMinimum) + ' P'], ['건당 수수료', format(fee) + ' P (등급별 할인)'], ['예상 입금일', '승인 후 다음 영업일']];
  const steps = [
    ['user', '회원가입', `카카오·네이버 또는 이메일로 30초 만에 가입하세요. 첫 교환을 마치면 가입 축하 ${format(state.settings.signupBonus)} P를 드려요.`],
    ['link', '웹하드 연결', '포인트가 있는 웹하드 계정을 연결하면 교환 가능 잔액이 표시돼요.'],
    ['exchange', '교환 신청', '받을 포인트를 확인하고 신청하세요. 승인되면 알림을 보내 드려요.'],
    ['gift', '출금 또는 쇼핑', '계좌로 출금하거나 모바일 쿠폰을 사고, 친구에게 선물할 수도 있어요.'],
  ];
  return `${state.settings.maintenance ? `<div class="maintenance">${icon('alert', 17)} 서비스 점검 중입니다. 일부 기능 이용이 제한될 수 있습니다.</div>` : ''}${header(state, { stickyOnMobile: true })}<main id="main">
    <section id="hero" aria-label="스마일 포인트 소개">${hero(index)}</section>
    <div class="quick-wrap"><div class="container quick-grid four">${quick.map(([page, glyph, label, copy], i) => `<a class="quick-card" href="#app/user/${page}">
      <span class="feature-icon tone-${i}">${icon(glyph, 25)}</span><span><strong>${label}</strong><small>${copy}</small></span>${icon('chevron', 18)}</a>`).join('')}</div></div>
    ${stats(state)}
    <section class="section container" id="partners">
      <div class="section-head">${heading('업체 안내', '웹하드 업체', '카드를 누르면 해당 업체의 공식 사이트가 열립니다.')}${button('포인트 교환하기', '#app/user/exchange', 'btn outline')}</div>
      ${webhardCards()}
      <div class="section-story">${storyBanner('exchange', example)}</div>
    </section>
    <section class="section cash-section" id="withdraw" aria-label="계좌 출금"><div class="container">
      ${storyBanner('withdrawal', `<div class="story-example"><span>10,000 P 출금 예시</span><strong>${format(10000 - fee)}원 실수령</strong></div>`)}
      <dl class="cash-terms">${terms.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
      <div class="grade-strip">${grades.map(g => [g.name, g.feeRate ? format(Math.round(fee * g.feeRate)) + ' P' : '무료']).map(([name, value], i) => `<div class="g${i}"><span>${icon('trophy', 18)} ${name}</span><strong>출금 수수료 ${value}</strong></div>`).join('')}</div>
    </div></section>
    <section class="shopping section" id="shop"><div class="container">
      <div class="section-head">${heading('포인트 쇼핑', '오늘은 어떤 선물을 고를까요?', '커피 한 잔부터 외식, 영화 관람권과 상품권까지 포인트로 바로 구매하세요.')}${button('쇼핑하러 가기', '#app/user/shop', 'btn outline')}</div>
      ${productCards(state, { search: false })}
      <div class="section-story">${storyBanner('shop', '')}</div>
    </div></section>
    <section class="section container" id="guide">
      <div class="section-head">${heading('이용 안내', '가입부터 사용까지, 네 단계', '처음이어도 어렵지 않아요. 아래 순서대로 시작해 보세요.')}${button('지금 가입하기', '#signup', 'btn primary')}</div>
      <ol class="card-grid steps four">${steps.map(([glyph, title, copy], index) => `<li class="step"><span class="feature-icon tone-${index}">${icon(glyph)}</span><small>STEP 0${index + 1}</small><h3>${title}</h3><p>${copy}</p></li>`).join('')}</ol>
      <div class="wallet-guide"><div class="wallet-guide-title"><span class="eyebrow">내 지갑</span><h3>잔액은 이렇게 표시돼요</h3></div>
        <div class="wallet-states">${[['clock', '적립 예정', '교환을 신청하고 제휴사 승인을 기다리는 포인트예요.'], ['wallet', '사용 가능', '지금 출금하거나 쿠폰을 사고 선물할 수 있는 포인트예요.'], ['bank', '처리 중', '출금을 신청해 지급 결과를 기다리는 포인트예요.']].map(([glyph, title, copy]) => `<div>${icon(glyph, 20)}<div><strong>${title}</strong><p>${copy}</p></div></div>`).join('')}</div>
      </div>
    </section>
    <section class="cta-band"><div class="container cta-inner"><div><h2>첫 교환을 마치면 ${format(state.settings.signupBonus)} P를 더 드려요</h2><p>카카오·네이버로 3초 만에 시작하고, 친구를 초대하면 둘 다 ${format(state.settings.referralBonus)} P!</p></div>
      <div class="cta-actions">${button('회원가입', '#signup', 'btn lime', 'arrow')}<a class="btn ghost" href="#login">로그인</a></div></div></section>
    <section class="help-section section" id="support"><div class="container">
      <div class="section-head">${heading('고객센터', '무엇을 도와드릴까요?', `자주 묻는 질문을 먼저 확인해 보세요. 고객센터 ${config.support} · ${config.hours}`)}${button('1:1 문의하기', '#app/user/support', 'btn outline')}</div>
      <div class="help-grid"><div class="panel"><h3>자주 묻는 질문</h3>${faqList(faqFor(state.settings))}</div><div class="panel"><h3>공지사항</h3>${announcementList(state.announcements)}</div></div>
    </div></section>
  </main>${footer(state)}`;
}

// ───────── 로그인 · 회원가입 ─────────
function authAside(title, copy) {
  return `<aside class="auth-aside"><img src="./assets/hero-exchange-v2.jpg" alt="" width="1320" height="880">
    <div><span class="hero-kicker"><i></i>${config.name}</span><h2>${title}</h2><p>${copy}</p>
    <ul>${['웹하드 포인트를 한곳에 모아 교환', '본인 계좌로 출금, 등급별 수수료 할인', '모바일 쿠폰 쇼핑과 포인트 선물'].map(item => `<li>${icon('check', 17)}${item}</li>`).join('')}</ul></div></aside>`;
}

// 운영 서버에서는 앱 키를 등록한(연동된) 소셜 로그인만 보여 준다. 데모에서는 모두 체험용으로 표시한다.
export const socialAvailable = (state, id) => state.server?.mode !== 'server' || state.server?.demo !== false || !!state.server?.oauth?.[id];
function socialButtons(state, mode) {
  const verb = mode === 'signup' ? '가입하기' : '로그인';
  const on = id => socialAvailable(state, id);
  if (!['kakao', 'naver', 'google', 'apple'].some(on)) return '';
  const wide = [on('kakao') && `<button type="button" class="social kakao" data-action="social" data-id="kakao">${socialMark.kakao}<span>카카오로 ${verb}</span></button>`,
    on('naver') && `<button type="button" class="social naver" data-action="social" data-id="naver">${socialMark.naver}<span>네이버로 ${verb}</span></button>`].filter(Boolean).join('');
  const row = [on('google') && `<button type="button" class="social google" data-action="social" data-id="google">${socialMark.google}<span>Google</span></button>`,
    on('apple') && `<button type="button" class="social apple" data-action="social" data-id="apple">${socialMark.apple}<span>Apple</span></button>`].filter(Boolean).join('');
  return `<div class="social-buttons">${wide}${row ? `<div class="social-row">${row}</div>` : ''}</div>
    <div class="divider"><span>또는 이메일로 ${mode === 'signup' ? '가입' : '로그인'}</span></div>`;
}
const loginNotices = {
  'social-canceled': '소셜 로그인을 취소했습니다.',
  'social-failed': '소셜 로그인에 실패했습니다. 잠시 뒤 다시 시도하거나 이메일로 로그인해 주세요.',
  'social-blocked': '이용이 제한된 계정입니다. 고객센터로 문의해 주세요.',
  'social-unavailable': '아직 연결되지 않은 로그인 방식입니다. 다른 방법으로 로그인해 주세요.',
};

export function login(state, notice = '') {
  return `${header(state)}<main id="main" class="auth-page"><div class="auth-shell">
    ${authAside('다시 만나서 반가워요.', '로그인하고 오늘의 출석 포인트를 받아 가세요.')}
    <div class="auth-card"><span class="eyebrow">로그인</span><h1>${config.name} 로그인</h1>
      <p class="muted">소셜 계정 또는 이메일로 로그인하세요.</p>
      ${loginNotices[notice] ? `<div class="notice-bar warn" role="alert">${icon('alert', 18)}<span>${loginNotices[notice]}</span></div>` : ''}
      ${socialButtons(state, 'login')}
      <form class="stack auth-form" data-form="login" novalidate>
        <label for="login-email">이메일</label><input id="login-email" name="email" type="email" autocomplete="username" required placeholder="name@example.com">
        <label for="login-password">비밀번호</label><div class="password-field"><input id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="비밀번호"><button type="button" class="icon-btn" data-action="toggle-password" aria-label="비밀번호 표시">${icon('eye', 18)}</button></div>
        <div class="stack otp-field" data-otp hidden><label for="login-otp">인증 앱 6자리 코드</label><input id="login-otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000"><small class="muted">2단계 인증을 켠 계정입니다. 인증 앱(Google Authenticator 등)의 코드를 입력하세요.</small></div>
        <div class="auth-row"><label class="check"><input type="checkbox" name="remember" checked> 로그인 상태 유지</label><button type="button" class="text-btn" data-action="find-password">비밀번호 찾기</button></div>
        <button class="btn primary block" type="submit">로그인 ${icon('login', 17)}</button>
      </form>
      <p class="auth-switch">아직 회원이 아니신가요? <a href="#signup">회원가입</a></p>
      ${state.server?.demo === false ? '' : `<div class="test-accounts"><div class="test-head"><strong>${icon('key', 17)} 테스트 계정으로 로그인</strong><small>비밀번호 ${testPassword}</small></div>
        ${testAccounts.map((item, i) => `<button type="button" class="test-login" data-action="test-login" data-id="${item.id}">
          <span class="feature-icon tone-${i}">${icon(['user', 'layers', 'shield'][i], 21)}</span><span><strong>${item.label} 테스트 계정 로그인</strong><small>${item.email} · ${item.copy}</small></span>${icon('chevron', 18)}</button>`).join('')}
      </div>`}
    </div>
  </div></main>`;
}

export function signup(state) {
  return `${header(state)}<main id="main" class="auth-page"><div class="auth-shell">
    ${authAside(`첫 교환을 마치면 ${format(state.settings.signupBonus)} P를 드려요.`, '소셜 계정으로 3초 만에, 이메일로도 간단하게 시작할 수 있어요.')}
    <div class="auth-card"><span class="eyebrow">회원가입</span><h1>${config.name} 시작하기</h1>
      ${socialButtons(state, 'signup')}
      <form class="stack auth-form" data-form="signup" novalidate>
        <div class="field-grid"><div><label for="su-name">이름</label><input id="su-name" name="name" required maxlength="20" autocomplete="name" placeholder="홍길동"></div>
        <div><label for="su-phone">휴대폰 번호</label><input id="su-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000"></div></div>
        <label for="su-email">이메일</label><input id="su-email" name="email" type="email" required autocomplete="email" placeholder="name@example.com">
        <div class="field-grid"><div><label for="su-pw">비밀번호</label><input id="su-pw" name="password" type="password" required autocomplete="new-password" placeholder="영문+숫자 8자 이상"></div>
        <div><label for="su-confirm">비밀번호 확인</label><input id="su-confirm" name="confirm" type="password" required autocomplete="new-password" placeholder="한 번 더 입력"></div></div>
        <div class="pw-meter" data-meter><i></i><span>비밀번호 안전도</span></div>
        <label for="su-ref">추천인 코드 <small class="muted">(선택)</small></label><input id="su-ref" name="referral" placeholder="예: SMILE3070" maxlength="12">
        <fieldset class="terms"><legend class="sr-only">약관 동의</legend>
          <label class="check all"><input type="checkbox" data-check-all> <strong>전체 동의</strong></label>
          <div class="term-row"><label class="check"><input type="checkbox" name="terms" data-term> [필수] 서비스 이용약관 동의</label><button type="button" class="text-btn" data-action="policy" data-value="terms">보기</button></div>
          <div class="term-row"><label class="check"><input type="checkbox" name="privacy" data-term> [필수] 개인정보 수집·이용 동의</label><button type="button" class="text-btn" data-action="policy" data-value="privacy">보기</button></div>
          <label class="check"><input type="checkbox" name="age" data-term> [필수] 만 14세 이상입니다</label>
          <label class="check"><input type="checkbox" name="marketing" data-term> [선택] 이벤트·혜택 알림 수신 동의</label>
        </fieldset>
        <button class="btn primary block" type="submit">가입하기 ${icon('arrow', 17)}</button>
        <p class="muted small center">가입 축하 ${format(state.settings.signupBonus)} P${state.settings.referralBonus ? `(추천 코드 입력 시 +${format(state.settings.referralBonus)} P)` : ''}는 첫 포인트 교환이 완료되면 지급됩니다.</p>
      </form>
      <p class="auth-switch">이미 회원이신가요? <a href="#login">로그인</a></p>
    </div>
  </div></main>`;
}

export function legalPage(state, kind) {
  const doc = legalDocs[kind];
  return `${header(state)}<main id="main" class="legal-page"><div class="container legal-wrap">
    <nav class="tabs" aria-label="약관 종류"><a class="tab ${kind === 'terms' ? 'active' : ''}" href="#terms">이용약관</a><a class="tab ${kind === 'privacy' ? 'active' : ''}" href="#privacy">개인정보처리방침</a></nav>
    <article class="panel legal-doc"><h1>${doc.title}</h1>${legalBody(kind)}</article>
  </div></main>${footer(state)}`;
}

// 소셜 계정으로 처음 가입할 때 약관 동의를 받는 화면 (실제 OAuth 연동 시)
export function termsFields() {
  return `<fieldset class="terms"><legend class="sr-only">약관 동의</legend>
    <label class="check all"><input type="checkbox" data-check-all> <strong>전체 동의</strong></label>
    <div class="term-row"><label class="check"><input type="checkbox" name="terms" data-term required> [필수] 서비스 이용약관 동의</label><button type="button" class="text-btn" data-action="policy" data-value="terms">보기</button></div>
    <div class="term-row"><label class="check"><input type="checkbox" name="privacy" data-term required> [필수] 개인정보 수집·이용 동의</label><button type="button" class="text-btn" data-action="policy" data-value="privacy">보기</button></div>
    <label class="check"><input type="checkbox" name="age" data-term required> [필수] 만 14세 이상입니다</label>
    <label class="check"><input type="checkbox" name="marketing" data-term> [선택] 이벤트·혜택 알림 수신 동의</label></fieldset>`;
}
export function socialTermsPage(state, token) {
  return `${header(state)}<main id="main" class="auth-page"><div class="auth-card solo"><span class="eyebrow">회원가입</span><h1>약관 동의</h1>
    <p class="muted">처음 오셨네요! 아래 약관에 동의하면 가입이 완료됩니다.</p>
    <form class="stack auth-form" data-form="social-terms" data-token="${escape(token)}">${termsFields()}<button class="btn primary block" type="submit">동의하고 가입하기 ${icon('arrow', 17)}</button></form>
    <p class="auth-switch"><a href="#login">취소하고 돌아가기</a></p></div></main>`;
}

export function resetPage(state, token) {
  return `${header(state)}<main id="main" class="auth-page"><div class="auth-card solo"><span class="eyebrow">비밀번호 재설정</span><h1>새 비밀번호 만들기</h1>
    <p class="muted">영문과 숫자를 포함해 8자 이상으로 입력해 주세요. 재설정하면 다른 기기의 로그인은 모두 해제됩니다.</p>
    <form class="stack auth-form" data-form="reset" data-token="${escape(token)}">
      <label for="rs-pw">새 비밀번호</label><input id="rs-pw" name="password" type="password" autocomplete="new-password" required minlength="8">
      <label for="rs-confirm">새 비밀번호 확인</label><input id="rs-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="8">
      <button class="btn primary block" type="submit">비밀번호 재설정</button></form>
    <p class="auth-switch"><a href="#login">로그인으로 돌아가기</a></p></div></main>`;
}
