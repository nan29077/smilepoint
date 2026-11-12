import { clean, dispatch } from './actions.js';
import { config, escape, format, icon, providers, socialMark } from './catalog.js';
import * as S from './state.js';
import { memberDetail, partnerForm, productForm } from './views/admin.js';
import { dashboard, pages, pageTitle } from './views/dashboard.js';
import { legalBody } from './views/legal.js';
import { hero, landing, legalPage, login, resetPage, signup, slides, socialAvailable, socialTermsPage, termsFields } from './views/site.js';
import { barcode, details, filteredProducts, money, productVisual, showDate } from './views/ui.js';
import { notificationList } from './views/user.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
const landingIds = new Set(['partners', 'withdraw', 'shop', 'guide', 'support']);
let state = S.load();
let server = { mode: 'demo', demo: true, oauth: {} };
let pollTimer;
let dirty = false;
let slideIndex = 0;
let slideTimer;
let route;
let toastTimer;
let ui = {};
let nextAfterLogin = '';

const me = () => S.current(state);
const live = () => server.mode === 'server';

// ───────── 데이터 계층: 서버가 있으면 API, 없으면(GitHub Pages 등) 브라우저 저장소 ─────────
async function api(path, body) {
  const response = await fetch(path, body === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-SmilePoint': '1' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || data.message || '요청을 처리하지 못했습니다.'), { status: response.status, need: data.need });
  return data;
}
const publicOps = new Set(['login', 'loginAs', 'socialDemo', 'socialComplete', 'signup', 'requestReset', 'resetWithToken', 'logout']);
async function act(op, payload = {}) {
  if (live()) {
    let data;
    try { data = await api('./api/action', { op, payload }); }
    catch (error) {
      // 다른 기기에서 비밀번호를 바꾸는 등으로 로그인이 끊긴 경우: 최신 상태를 받아 로그인 화면으로 보낸다.
      if (error.status === 401 && !publicOps.has(op)) {
        try { state = withServer((await api('./api/state')).state); } catch {}
        if (modal.open) modal.close();
        if (!me()) { nextAfterLogin = location.hash.slice(1); location.replace('#login'); render(); throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
      }
      throw error;
    }
    state = withServer(data.state);
    return data.result;
  }
  const next = S.load();
  const result = dispatch(next, next.session?.accountId ?? null, op, payload, { demo: true });
  S.save(next);
  state = withServer(next);
  scheduleMockPayouts();
  return clean(result) ?? result;
}
// 데모 모드(서버 없음): 승인된 출금을 모의 지급대행이 3초 뒤 입금 완료로 처리한다.
let mockTimer;
function scheduleMockPayouts() {
  if (live() || mockTimer || !S.payoutQueue(state).length) return;
  mockTimer = setTimeout(() => {
    mockTimer = null;
    const next = S.load();
    if (!S.runMockPayouts(next)) return;
    S.save(next);
    state = withServer(next);
    if (!busy()) render(true);
  }, 3000);
}
const withServer = value => Object.assign(value, { server });
async function boot() {
  try {
    const health = await fetch('./api/health', { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
    if (health?.mode === 'server') {
      server = health;
      state = withServer((await api('./api/state')).state);
    }
  } catch {}
  if (!live()) { try { S.save(state); } catch {} withServer(state); scheduleMockPayouts(); }
  render();
  clearInterval(pollTimer);
  if (live()) pollTimer = setInterval(poll, 15000);
}
// 서버 모드: 다른 관리자·회원의 처리 결과를 주기적으로 반영한다.
// 작성 중인 입력·선택이 있으면 화면을 다시 그리지 않는다 (입력값 보존).
function busy() {
  return dirty || modal.open || document.body.classList.contains('menu-open') || !!document.querySelector('[data-select]:checked, .create-box[open]')
    || document.activeElement?.matches('input, textarea, select');
}
async function poll() {
  if (document.hidden || route?.view !== 'dashboard' || busy()) return;
  try {
    const data = await api('./api/state');
    const before = JSON.stringify({ ...state, server: 0 });
    const next = withServer(data.state);
    if (JSON.stringify({ ...next, server: 0 }) !== before) { state = next; render(true); }
  } catch {}
}

// ───────── 라우팅 ─────────
function getRoute() {
  const [section, role, page] = location.hash.slice(1).split('/');
  if (section === 'app' && ['user', 'partner', 'admin'].includes(role)) {
    return { view: 'dashboard', role, page: pages(role).some(([id]) => id === page) ? page : 'overview' };
  }
  if (section === 'login') return { view: 'login', notice: role ?? '' };
  if (section === 'social' && /^[\w-]{20,}$/.test(role ?? '')) return { view: 'social', token: role };
  if (section === 'signup') return { view: 'signup' };
  if (section === 'terms' || section === 'privacy') return { view: 'legal', page: section };
  if (section === 'reset' && /^[\w-]{16,}$/.test(role ?? '')) return { view: 'reset', token: role };
  return { view: 'landing', anchor: landingIds.has(section) ? section : '' };
}

function render(keepScroll = false) {
  const previous = route;
  route = getRoute();
  const viewer = me();
  if (route.view === 'dashboard') {
    if (!viewer) {
      nextAfterLogin = location.hash.slice(1);
      location.replace('#login');
      notify('로그인이 필요한 메뉴입니다. 로그인해 주세요.');
      return;
    }
    if (viewer.role !== route.role) { location.replace(`#app/${viewer.role}/overview`); return; }
  }
  if ((route.view === 'login' || route.view === 'signup') && viewer) { location.replace(`#app/${viewer.role}/overview`); return; }
  if (previous && (previous.view !== route.view || previous.page !== route.page)) ui = {};
  if (route.view === 'dashboard' && route.role === 'user' && route.page === 'support' && state.tickets.some(t => t.userId === viewer.id && t.status === 'answered' && !t.seen)) {
    act('seenTickets').then(() => render(true)).catch(() => {});
  }
  const active = document.activeElement;
  const focusKey = active?.dataset?.ui;
  const caret = focusKey ? active.selectionStart : null;

  document.title = route.view === 'dashboard' ? `${pageTitle(route.role, route.page)} | ${config.name}`
    : route.view === 'login' ? `로그인 | ${config.name}` : route.view === 'signup' || route.view === 'social' ? `회원가입 | ${config.name}` : route.view === 'legal' ? `${route.page === 'privacy' ? '개인정보처리방침' : '이용약관'} | ${config.name}` : route.view === 'reset' ? `비밀번호 재설정 | ${config.name}` : `${config.name} - 흩어진 포인트를 한곳에`;
  if (route.view === 'dashboard') app.innerHTML = dashboard(state, viewer, route.page, ui);
  else if (route.view === 'login') app.innerHTML = login(state, route.notice);
  else if (route.view === 'social') app.innerHTML = socialTermsPage(state, route.token);
  else if (route.view === 'signup') app.innerHTML = signup(state);
  else if (route.view === 'legal') app.innerHTML = legalPage(state, route.page);
  else if (route.view === 'reset') app.innerHTML = resetPage(state, route.token);
  else if (!keepScroll || previous?.view !== 'landing') { app.innerHTML = landing(state, slideIndex); startSlides(); }
  else app.innerHTML = landing(state, slideIndex);
  if (route.view !== 'landing') clearInterval(slideTimer);

  if (focusKey) {
    const input = app.querySelector(`[data-ui="${focusKey}"]`);
    input?.focus();
    if (caret !== null && input?.setSelectionRange) try { input.setSelectionRange(caret, caret); } catch {}
  }
  if (keepScroll) return;
  if (route.anchor) requestAnimationFrame(() => document.getElementById(route.anchor)?.scrollIntoView());
  else window.scrollTo(0, 0);
}

function notify(message, tone = '') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = 'toast ' + tone;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function dialog(title, body, css = '') {
  modal.className = css;
  modal.innerHTML = `<div class="dialog-inner"><div class="panel-head"><h2 id="dialog-title">${title}</h2><button type="button" class="icon-btn" data-action="close" aria-label="닫기">${icon('close', 21)}</button></div>${body}</div>`;
  modal.setAttribute('aria-labelledby', 'dialog-title');
  if (!modal.open) modal.showModal();
  modal.querySelector('input:not([type=hidden]):not([disabled]), textarea')?.focus();
}

function refresh(message, tone) {
  if (modal.open) modal.close();
  dirty = false;
  render(true);
  if (message) notify(message, tone);
}
const go = hash => { if (modal.open) modal.close(); location.hash = hash; };

function startSlides() {
  clearInterval(slideTimer);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  slideTimer = setInterval(() => { if (!document.hidden && !document.querySelector('#hero:hover')) slide(slideIndex + 1); }, 7000);
}
function slide(next, control) {
  slideIndex = (next + slides.length) % slides.length;
  const element = document.getElementById('hero');
  if (!element) return;
  element.innerHTML = hero(slideIndex);
  if (control) element.querySelector(control === 'slide' ? '[data-action="slide"][aria-pressed="true"]' : `[data-action="${control}"]`)?.focus({ preventScroll: true });
}

function afterLogin(account, message) {
  const target = nextAfterLogin.startsWith(`app/${account.role}/`) ? nextAfterLogin : `app/${account.role}/overview`;
  nextAfterLogin = '';
  if (modal.open) modal.close();
  location.hash = target;
  notify(message);
}

// ───────── 다이얼로그 ─────────
function exchangeDialog(id) {
  const viewer = me();
  const item = state.partners.find(partner => partner.id === id);
  if (!item || viewer?.role !== 'user') return;
  const available = S.partnerAvailable(state, viewer.id, id);
  dialog(item.name + ' 포인트 교환', `<p class="muted">${item.type} · ${item.divisor} P당 1 스마일 P · 최소 ${format(item.min)} P · ${item.approval}</p>
    <form class="stack" data-form="exchange" data-id="${id}"><label for="exchange-amount">교환할 ${item.name} 포인트</label>
    <div class="amount-field"><input id="exchange-amount" data-divisor="${item.divisor}" name="amount" type="number" min="${item.min}" ${available === null ? '' : `max="${available}"`} step="${item.divisor}" required placeholder="${format(item.min)}"><span>P</span></div>
    <div class="chips"><button type="button" class="chip" data-action="fill" data-target="exchange-amount" data-value="${item.min}">최소</button>${available === null ? '' : `<button type="button" class="chip" data-action="fill" data-target="exchange-amount" data-value="${available - (available % item.divisor)}">전액</button>`}</div>
    <div class="form-summary"><div><span>교환 가능</span><strong>${available === null ? `${item.name} 승인 시 확인` : money(available)}</strong></div><div class="total"><span>받을 스마일 포인트</span><strong id="exchange-net">0 P</strong></div></div>
    <button class="btn primary block" type="submit" ${available !== null && available < item.min ? 'disabled' : ''}>교환 신청 ${icon('arrow', 17)}</button>
    <p class="muted small">신청 후 ${item.name} 승인 시 사용 가능 포인트로 적립됩니다. 승인 전에는 거래 내역에서 취소할 수 있어요.</p></form>`);
}
function linkDialog(id) {
  const item = state.partners.find(partner => partner.id === id);
  if (!item) return;
  const name = escape(item.name);
  dialog(name + ' 계정 연결', `<p class="muted">${name}에서 사용하는 아이디를 입력하세요. ${name}로 6자리 인증번호가 전송되며, 번호를 입력해야 연결이 완료됩니다.</p>
    <form class="stack" data-form="link" data-id="${id}"><label for="link-id">${name} 아이디</label><input id="link-id" name="loginId" required minlength="4" maxlength="20" placeholder="영문·숫자 4~20자" autocomplete="off">
    <label class="check"><input type="checkbox" name="agree" required> 포인트 잔액 조회 및 교환을 위한 정보 제공에 동의합니다.</label>
    <button class="btn primary block" type="submit">인증번호 받기 ${icon('send', 17)}</button></form>`);
}
function linkVerifyDialog(id, demoCode = '') {
  const item = state.partners.find(partner => partner.id === id);
  const link = me()?.links?.[id];
  if (!item || !link) return;
  const name = escape(item.name);
  dialog(name + ' 인증번호 입력', `<p class="muted"><b>${escape(link.loginId)}</b> 계정으로 ${name}에서 보낸 6자리 인증번호를 입력하세요. (10분 안에, 5회까지)</p>
    ${demoCode ? `<div class="notice-bar">${icon('key', 18)}<span><b>데모</b> 실제로는 ${name} 쪽지·알림으로 전달되는 번호입니다: <code>${escape(demoCode)}</code></span></div>` : ''}
    <form class="stack" data-form="link-confirm" data-id="${id}"><label for="link-code">인증번호</label><input id="link-code" name="code" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9]{6}" maxlength="6" placeholder="000000">
    <button class="btn primary block" type="submit">연결 완료 ${icon('check', 17)}</button>
    <button class="text-btn" type="button" data-action="link" data-id="${id}">번호를 받지 못했어요 · 다시 요청</button></form>`, 'narrow');
}
function productDialog(id) {
  const item = state.products.find(product => product.id === id);
  if (!item) return;
  const viewer = me();
  const isUser = viewer?.role === 'user';
  const available = isUser ? S.balances(state, viewer.id).available : 0;
  const soldOut = !item.active || item.stock < 1;
  dialog(escape(item.name), `<div class="dialog-product">${productVisual(item)}</div>
    <div class="form-summary"><div><span>브랜드</span><strong>${escape(item.brand)}</strong></div><div><span>상품 포인트</span><strong>${money(item.cost)}</strong></div><div><span>유효기간</span><strong>구매일로부터 90일</strong></div><div><span>남은 수량</span><strong>${format(item.stock)}개</strong></div>${isUser ? `<div><span>사용 가능</span><strong>${money(available)}</strong></div>` : ''}</div>
    ${isUser ? `<form class="stack" data-form="purchase" data-id="${item.id}"><label for="qty">수량</label><div class="qty"><button type="button" class="icon-btn" data-action="qty" data-value="-1" aria-label="수량 줄이기">${icon('minus', 18)}</button><input id="qty" name="qty" type="number" min="1" max="5" value="1" data-cost="${item.cost}"><button type="button" class="icon-btn" data-action="qty" data-value="1" aria-label="수량 늘리기">${icon('plus', 18)}</button><span class="qty-total" id="qty-total">${format(item.cost)} P</span></div>
      <button class="btn primary block" type="submit" ${soldOut || available < item.cost ? 'disabled' : ''}>${soldOut ? '품절' : available < item.cost ? '포인트가 부족해요' : '포인트로 구매'} ${icon('gift', 17)}</button></form>
      <p class="muted small">구매한 쿠폰은 쿠폰함에서 바코드로 사용할 수 있습니다. 개발 중인 데모로 실제 매장에서는 사용할 수 없습니다.</p>`
      : `<a class="btn primary block" href="#app/user/shop" data-action="close">로그인하고 구매하기</a>`}`);
}
function transactionDialog(id) {
  const viewer = me();
  const row = S.visibleTransactions(state, viewer).find(item => item.id === id);
  if (!row) return;
  const api = state.settings.payoutMode === 'api';
  const options = [['complete', row.type === 'withdrawal' ? (api ? '승인 · 이체 요청' : '지급 완료') : '승인'], ['rejected', '반려'], ['canceled', '신청 취소']].filter(([status]) => S.canUpdate(row, viewer, status));
  const failedPayout = viewer.role === 'admin' && row.type === 'withdrawal' && row.status === 'processing' && row.payout?.status === 'failed';
  const couponCancel = viewer.role === 'admin' && row.type === 'coupon' && row.status === 'complete' && !row.coupon?.used;
  const reversible = row.type === 'exchange' && row.status === 'complete' && !row.reversed && (viewer.role === 'admin' || (viewer.role === 'partner' && Date.now() - new Date(row.updated ?? row.date) <= 30 * 86400000));
  dialog('거래 상세', `${details(state, row, viewer)}
    ${viewer.role === 'admin' && row.type === 'withdrawal' && row.status === 'pending' ? `<div class="dialog-actions" data-payout-box><button class="btn outline sm" type="button" data-action="payout-account" data-id="${row.id}">${icon('eye', 16)}지급 계좌번호 확인</button><small class="muted">열람 기록이 감사 기록에 남습니다.</small></div>` : ''}
    ${reversible ? `<details class="danger-zone"><summary>교환 회수</summary><p class="muted small">판매 취소·부정 적립 등으로 이 교환의 스마일 포인트 ${format(row.points)} P를 회원에게서 회수합니다. 이미 사용했다면 잔액이 마이너스가 될 수 있습니다.</p><label for="reverse-reason" class="small-label">회수 사유 <small class="muted">(회원에게 안내됩니다)</small></label><input id="reverse-reason" maxlength="100" placeholder="예: 판매 취소로 웹하드 포인트 환원"><div class="dialog-actions"><button class="btn danger sm" type="button" data-action="reverse" data-id="${row.id}">회수하기</button></div></details>` : ''}
    ${failedPayout ? `<p class="muted small">지급대행사에서 이 거래번호(<b>${row.id}</b>)의 이체 여부를 먼저 확인하세요. 재시도는 같은 거래번호로 요청합니다.</p><label for="reject-reason" class="small-label">반려 사유 <small class="muted">(반려 시 필수 · 포인트가 복원됩니다)</small></label><input id="reject-reason" maxlength="100" placeholder="예: 계좌 정보 오류로 이체 불가">
      <div class="dialog-actions"><button class="btn primary" type="button" data-action="payout-retry" data-id="${row.id}">이체 재시도</button><button class="btn outline" type="button" data-action="payout-manual" data-id="${row.id}">수동 지급 완료</button><button class="btn danger" type="button" data-action="payout-refund" data-id="${row.id}">반려·포인트 복원</button></div>` : ''}
    ${couponCancel ? `<label for="reject-reason" class="small-label">취소 사유 <small class="muted">(회원에게 안내됩니다)</small></label><input id="reject-reason" maxlength="100" placeholder="예: 공급사 품절로 발행 불가"><div class="dialog-actions"><button class="btn danger" type="button" data-action="coupon-cancel-confirm" data-id="${row.id}">주문 취소·환불</button></div>` : ''}
    ${options.some(([s]) => s === 'rejected') ? `<label for="reject-reason" class="small-label">반려 사유 <small class="muted">(반려 시 필수)</small></label><input id="reject-reason" maxlength="100" placeholder="예: 판매 포인트 정산 보류">` : ''}
    <div class="dialog-actions">${options.map(([status, label]) => `<button class="btn ${status === 'complete' ? 'primary' : status === 'rejected' ? 'danger' : 'outline'}" type="button" data-action="status" data-id="${row.id}" data-value="${status}">${label}</button>`).join('')}
    ${viewer.role === 'user' ? `<a class="btn outline" href="#app/user/support" data-action="close">이 거래 문의하기</a>` : ''}</div>`);
}
function socialDialog(provider) {
  const p = providers[provider];
  if (!p) return;
  dialog(`${p.name} 계정으로 계속하기`, `<div class="social-consent ${provider}"><span class="social-mark">${socialMark[provider]}</span><p><b>${config.name}</b>이(가) ${p.name} 계정으로 로그인하려고 합니다.</p></div>
    <div class="form-summary"><div><span>제공 항목</span><strong>이름, 이메일, 프로필 사진</strong></div><div><span>선택 항목</span><strong>휴대폰 번호</strong></div></div>
    <p class="muted small">개발 중인 데모입니다. 실제 ${p.name} 로그인은 앱 키를 등록한 뒤 사용할 수 있습니다. 지금은 체험용 ${p.name} 회원으로 로그인합니다. 처음 가입하는 경우 아래 약관에 동의해 주세요.</p>
    <form class="stack" data-form="social-demo" data-id="${provider}">${termsFields()}
    <button type="submit" class="social ${provider} block">${socialMark[provider]}<span>동의하고 계속하기</span></button></form>`, 'narrow');
}

// ───────── CSV ─────────
function downloadCsv(scope, name) {
  const tableEl = scope?.querySelector('table');
  if (!tableEl) { notify('내보낼 데이터가 없습니다.'); return; }
  // 엑셀에서 수식으로 실행되지 않도록 =, +, -, @ 로 시작하는 값 앞에 ' 를 붙인다 (숫자는 그대로).
  const safe = text => /^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-[\d,.\s]+(P|원)?$/.test(text)) ? "'" + text : text;
  const lines = [...tableEl.rows].map(tr => [...tr.cells].filter(cell => !cell.querySelector('input[type=checkbox]')).map(cell => `"${safe(cell.innerText.replace(/\s*\n\s*/g, ' ').trim()).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${name}_${S.kstDay()}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  notify('CSV 파일을 내려받았습니다.');
}

// 서버 모드: 이체 결과가 곧 반영되므로 잠시 뒤 한 번 더 받아 온다.
function followPayouts() { if (live()) { setTimeout(poll, 4000); setTimeout(poll, 9000); } }

// ───────── 클릭 동작 ─────────
async function onAction(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || trigger.disabled) return;
  const { action, id, value, index, target, key, name } = trigger.dataset;
  const viewer = me();
  switch (action) {
    case 'site-menu':
    case 'dash-menu': {
      const menu = document.getElementById(trigger.getAttribute('aria-controls'));
      const opened = !menu.classList.contains('open');
      closeMenus();
      if (opened) { menu.classList.add('open'); trigger.setAttribute('aria-expanded', 'true'); document.body.classList.add('menu-open'); }
      break;
    }
    case 'slide': slide(Number(index), action); startSlides(); break;
    case 'prev': slide(slideIndex - 1, action); startSlides(); break;
    case 'next': slide(slideIndex + 1, action); startSlides(); break;
    case 'category': {
      const scope = trigger.closest('.filter-row');
      for (const filter of scope.querySelectorAll('button')) { filter.classList.toggle('active', filter === trigger); filter.setAttribute('aria-pressed', String(filter === trigger)); }
      const wrap = trigger.closest('.shop-tools');
      wrap.nextElementSibling.innerHTML = filteredProducts(state, value, wrap.querySelector('[data-filter=product]')?.value ?? '');
      break;
    }
    case 'social':
      if (live() && server.oauth?.[id]) { location.href = './auth/' + id; break; }
      if (!socialAvailable(state, id)) { notify('아직 연결되지 않은 로그인 방식입니다. 다른 방법으로 로그인해 주세요.', 'error'); break; }
      socialDialog(id);
      break;
    case 'test-login': { const account = await act('loginAs', { id }); afterLogin(account, `${account.name}(테스트 계정)으로 로그인했습니다.`); break; }
    case 'toggle-password': { const input = trigger.previousElementSibling; input.type = input.type === 'password' ? 'text' : 'password'; trigger.setAttribute('aria-label', input.type === 'password' ? '비밀번호 표시' : '비밀번호 숨기기'); break; }
    case 'find-password': dialog('비밀번호 찾기', `<form class="stack" data-form="find"><p class="muted">가입한 이메일로 비밀번호 재설정 링크를 보내 드립니다.</p><label for="find-email">이메일</label><input id="find-email" name="email" type="email" required><button class="btn primary" type="submit">재설정 링크 받기</button></form>`, 'narrow'); break;
    case 'logout': await act('logout'); ui = {}; go('#home'); notify('로그아웃했습니다.'); break;
    case 'exchange': exchangeDialog(id); break;
    case 'link': linkDialog(id); break;
    case 'unlink':
      dialog('연결 해제', `<p>${state.partners.find(p => p.id === id)?.name} 연결을 해제할까요? 다시 연결하면 잔액을 새로 불러옵니다.</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="unlink-confirm" data-id="${id}">해제</button><button class="btn outline" type="button" data-action="close">취소</button></div>`, 'narrow');
      break;
    case 'unlink-confirm': { const waiting = me()?.links?.[id] && !me().links[id].verified; await act('unlinkPartner', { partnerId: id }); refresh(waiting ? '연결 요청을 취소했습니다.' : '웹하드 연결을 해제했습니다.'); break; }
    case 'link-verify': linkVerifyDialog(id); break;
    case 'bank-retry': await act('cancelBankRequest'); ui.bankEdit = '1'; refresh(); break;
    case 'bank-approve': await act('approveBank', { userId: id }); dialog('회원 상세', memberDetail(state, me(), id), 'wide'); render(true); notify('계좌 인증을 승인했습니다.'); break;
    case 'payout-account': {
      const info = await act('payoutAccount', { id });
      const box = trigger.closest('[data-payout-box]');
      if (box) box.innerHTML = `<div class="code-box wide"><code>${escape(info.bank)} ${escape(info.number)} · ${escape(info.holder)}</code><button type="button" class="btn outline sm" data-action="copy" data-value="${escape(info.number)}">${icon('copy', 16)}복사</button></div>`;
      break;
    }
    case 'reverse': {
      const reason = document.getElementById('reverse-reason')?.value ?? '';
      await act('reverseExchange', { id, reason });
      refresh('교환을 회수했습니다. 회원에게 알림을 보냈어요.');
      break;
    }
    case 'coupon-reveal':
      dialog('쿠폰 번호 보기', '<p>쿠폰 번호를 확인하면 <b>직접 취소·환불할 수 없습니다.</b> 매장에서 사용할 때 열어 주세요.</p><div class="dialog-actions"><button class="btn primary" type="button" data-action="coupon-reveal-confirm" data-id="' + escape(id) + '">번호 보기</button><button class="btn outline" type="button" data-action="close">닫기</button></div>', 'narrow');
      break;
    case 'coupon-reveal-confirm': {
      const info = await act('revealCoupon', { id });
      refresh();
      const row = state.transactions.find(item => item.id === id);
      dialog(escape(state.products.find(p => p.id === row?.product)?.name ?? '쿠폰'), `<div class="barcode-large">${barcode(info.code)}<code>${escape(info.code).replace(/(\d{4})(?=\d)/g, '$1 ')}</code></div><p class="muted small center">매장 직원에게 바코드를 보여 주세요. 유효기간 ~ ${showDate(info.expires)}</p>`, 'narrow');
      break;
    }
    case 'totp-setup': {
      const setup = await act('setupTotp');
      dialog('2단계 인증 설정', `<p class="muted">휴대폰의 인증 앱(Google Authenticator, Microsoft Authenticator 등)에서 <b>설정 키 입력</b>을 선택하고 아래 키를 등록하세요.</p>
        <div class="code-box wide"><code>${escape(setup.secret.replace(/(.{4})(?=.)/g, '$1 '))}</code><button type="button" class="btn outline sm" data-action="copy" data-value="${escape(setup.secret)}">${icon('copy', 16)}복사</button></div>
        <p class="muted small">계정 이름: SmilePoint · 시간 기준(TOTP) · 6자리. 등록 후 앱에 표시되는 코드를 입력하면 켜집니다.</p>
        <form class="stack" data-form="totp-enable"><label for="totp-on">인증 앱 코드</label><input id="totp-on" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000"><button class="btn primary" type="submit">확인하고 켜기</button></form>`, 'narrow');
      break;
    }
    case 'product': productDialog(id); break;
    case 'qty': {
      const input = document.getElementById('qty');
      input.value = Math.min(5, Math.max(1, Number(input.value) + Number(value)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      break;
    }
    case 'transaction': transactionDialog(id); break;
    case 'status': {
      const reason = document.getElementById('reject-reason')?.value ?? '';
      const row = await act(value === 'canceled' ? 'cancel' : 'review', { id, status: value, reason });
      refresh(row?.status === 'pending' && row?.partnerApproved ? `승인했습니다. ${row.review} 건이라 운영팀 2차 승인 후 적립됩니다.` : row?.status === 'processing' ? '승인했습니다. 지급대행사에 이체를 요청했어요.' : value === 'complete' ? '처리를 완료했습니다. 회원에게 알림을 보냈어요.' : value === 'rejected' ? '신청을 반려했습니다.' : '신청을 취소했습니다. 포인트가 복원되었어요.');
      if (row?.status === 'processing') followPayouts();
      break;
    }
    case 'payout-retry': await act('retryPayout', { id }); refresh('이체를 다시 요청했습니다.'); followPayouts(); break;
    case 'payout-manual': await act('completePayout', { id }); refresh('수동 지급 완료로 처리했습니다. 회원에게 알림을 보냈어요.'); break;
    case 'payout-refund': await act('refundPayout', { id, reason: document.getElementById('reject-reason')?.value ?? '' }); refresh('출금을 반려하고 포인트를 복원했습니다.'); break;
    case 'read-all': await act('readAll'); refresh('알림을 모두 읽음으로 표시했습니다.'); break;
    case 'bulk': {
      const ids = [...trigger.closest('[data-bulk]').querySelectorAll('[data-select]:checked')].map(box => box.value);
      if (!ids.length) { notify('처리할 신청을 선택해 주세요.'); break; }
      if (value === 'rejected') {
        dialog(`${ids.length}건 반려`, `<form class="stack" data-form="bulk-reject" data-ids="${ids.join(',')}"><label for="bulk-reason">반려 사유</label><input id="bulk-reason" name="reason" required maxlength="100" placeholder="회원에게 안내되는 사유입니다"><button class="btn danger" type="submit">반려하기</button></form>`, 'narrow');
        break;
      }
      const done = await act('bulkReview', { ids, status: 'complete' });
      const held = state.transactions.filter(row => ids.includes(row.id) && row.status === 'pending' && row.partnerApproved).length;
      refresh(held && viewer.role === 'partner' ? `${done}건을 승인했습니다. 이 중 ${held}건은 고액·한도 초과로 운영팀 2차 승인 후 적립됩니다.` : `${done}건을 승인했습니다.`);
      followPayouts();
      break;
    }
    case 'attend': {
      const result = await act('attend');
      refresh(`출석 완료! ${result.points} P 적립 · ${result.count}일 연속 출석 🎉`, 'celebrate');
      break;
    }
    case 'copy':
      navigator.clipboard?.writeText(value).then(() => notify('복사했습니다.'), () => notify('복사하지 못했습니다. 직접 선택해 주세요.'));
      break;
    case 'fill': { const input = document.getElementById(target); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); break; }
    case 'template': { const input = document.getElementById(target); input.value = value; input.focus(); break; }
    case 'ui': ui[key] = value; if (key === 'bankEdit' && !value) delete ui.bankEdit; render(true); break;
    case 'bank-edit': ui.bankEdit = '1'; render(true); break;
    case 'coupon-used': await act('setCouponUsed', { id, used: true }); refresh('사용 완료로 표시했어요.'); break;
    case 'coupon-unused': await act('setCouponUsed', { id, used: false }); refresh('사용 가능 쿠폰으로 되돌렸어요.'); break;
    case 'barcode': {
      const row = state.transactions.find(item => item.id === id);
      if (!row?.coupon?.code) break;
      dialog(escape(state.products.find(p => p.id === row.product)?.name ?? '쿠폰'), `<div class="barcode-large">${barcode(row.coupon.code)}<code>${row.coupon.code.replace(/(\d{4})(?=\d)/g, '$1 ')}</code></div><p class="muted small center">매장 직원에게 바코드를 보여 주세요. 유효기간 ~ ${showDate(row.coupon.expires)}</p>`, 'narrow');
      break;
    }
    case 'notifications':
      dialog('알림', notificationList(state, viewer), 'narrow');
      act('readAll').catch(() => {});
      document.querySelector('.bell b')?.remove();
      break;
    case 'member': dialog('회원 상세', memberDetail(state, viewer, id), 'wide'); break;
    case 'member-status': await act('setMemberStatus', { userId: id, status: value }); refresh(value === 'active' ? '이용 정지를 해제했습니다.' : '이용을 정지했습니다.'); break;
    case 'partner-edit': dialog(`${state.partners.find(p => p.id === id).name} 정책 수정`, partnerForm(state.partners.find(p => p.id === id)), 'narrow'); break;
    case 'product-edit': dialog(escape(state.products.find(p => p.id === id).name), productForm(state.products.find(p => p.id === id)), 'narrow'); break;
    case 'announce-toggle': await act('toggleAnnouncement', { id }); refresh('공지 노출 상태를 바꿨습니다.'); break;
    case 'regen-key':
      dialog('API 키 재발급', `<p>재발급하면 <b>기존 키는 즉시 폐기</b>되어 연동 서버에서 오류가 날 수 있습니다. 계속할까요?</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="regen-confirm">재발급</button><button class="btn outline" type="button" data-action="close">취소</button></div>`, 'narrow');
      break;
    case 'regen-confirm': await act('regenerateKey'); ui.reveal = '1'; refresh('새 API 키를 발급했습니다. 연동 서버에 반영해 주세요. 웹훅 서명 키도 함께 바뀝니다.'); break;
    case 'reset-demo':
      dialog('데모 데이터 초기화', '<p>모든 회원·거래·설정을 처음 상태로 되돌립니다. 계속할까요?</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="reset-confirm">초기화</button><button class="btn outline" type="button" data-action="close">취소</button></div>', 'narrow');
      break;
    case 'reset-confirm': await act('resetDemo'); ui = {}; refresh('데모 데이터를 초기화했습니다.'); break;
    case 'csv': {
      // 목록이 '더 보기'로 나뉘어 있으면 전체를 그린 뒤 내보낸다.
      let button = trigger;
      if (document.querySelector('[data-more]')) { ui.more = 'all'; render(true); button = document.querySelector(`[data-action="csv"][data-name="${CSS.escape(name ?? '')}"]`) ?? trigger; }
      downloadCsv(button.closest('[data-csv]') ?? button.closest('.dash-content')?.querySelector('[data-csv]') ?? document.querySelector('[data-csv]'), name ?? '내보내기');
      break;
    }
    case 'policy': dialog(value === 'privacy' ? '개인정보처리방침' : '이용약관', `<div class="legal-dialog">${legalBody(value)}</div>`, 'wide'); break;
    case 'coupon-cancel':
      dialog('쿠폰 취소', `<p>쿠폰을 취소하고 사용한 포인트를 돌려받을까요? 취소한 쿠폰은 다시 사용할 수 없습니다.</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="coupon-cancel-confirm" data-id="${id}">취소하고 환불받기</button><button class="btn outline" type="button" data-action="close">닫기</button></div>`, 'narrow');
      break;
    case 'coupon-cancel-confirm': { const row = await act('cancelCoupon', { id, reason: document.getElementById('reject-reason')?.value ?? '' }); refresh(viewer.role === 'admin' ? `주문을 취소하고 회원에게 ${format(row.points)} P를 환불했습니다.` : `쿠폰을 취소했어요. ${format(row.points)} P를 돌려드렸습니다.`); break; }
    case 'settle':
      dialog(`${id} 정산 확인`, `<form class="stack" data-form="settle" data-date="${id}"><p class="muted">자사 장부의 이 날짜 교환 차감 합계를 입력하세요. 스마일 포인트 집계: <b>${trigger.dataset.count}건 · ${format(Number(trigger.dataset.amount))} P</b></p>
        <div class="field-grid"><div><label for="st-count">건수</label><input id="st-count" name="count" type="number" min="0" value="${trigger.dataset.count}" required></div><div><label for="st-amount">차감 포인트 합계</label><input id="st-amount" name="amount" type="number" min="0" value="${trigger.dataset.amount}" required></div></div>
        <button class="btn primary" type="submit">확인 제출</button></form>`, 'narrow');
      break;
    case 'event-toggle': await act('setEventActive', { id, active: !!value }); refresh(value ? '이벤트를 시작했습니다.' : '이벤트를 중지했습니다.'); break;
    case 'test-webhook': await act('testWebhook'); refresh(live() ? '테스트 웹훅을 보냈습니다. 잠시 뒤 전송 결과가 표시됩니다.' : '데모 모드에서는 웹훅이 실제로 전송되지 않습니다. 서버를 실행해 주세요.'); if (live()) setTimeout(poll, 2500); break;
    case 'staff-status': await act('setStaffStatus', { id, status: value }); refresh(value === 'active' ? '계정을 활성화했습니다.' : '계정을 정지했습니다.'); break;
    case 'reset-password':
      dialog('비밀번호 초기화', `<p>${escape(state.accounts.find(a => a.id === id)?.name ?? '')}님의 비밀번호를 임시 비밀번호로 바꿉니다.</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="reset-password-confirm" data-id="${id}">초기화</button><button class="btn outline" type="button" data-action="close">취소</button></div>`, 'narrow');
      break;
    case 'reset-password-confirm': {
      const temp = await act('resetPassword', { id });
      render(true);
      dialog('임시 비밀번호', `<p class="muted">아래 비밀번호를 담당자에게 안전하게 전달하세요. 이 창을 닫으면 다시 볼 수 없습니다.</p><div class="code-box wide"><code>${escape(temp)}</code><button type="button" class="btn outline sm" data-action="copy" data-value="${escape(temp)}">${icon('copy', 16)}복사</button></div>`, 'narrow');
      break;
    }
    case 'close': modal.close(); break;
    case 'remove-photo': await act('setPhoto', { photo: '' }); refresh('프로필 사진을 삭제했어요. 다시 동물 캐릭터가 표시됩니다.'); break;
  }
}

document.addEventListener('click', event => {
  if (event.target === modal) modal.close();
  const skip = event.target.closest('.skip');
  if (skip) { event.preventDefault(); const main = document.getElementById('main'); main?.setAttribute('tabindex', '-1'); main?.focus(); return; }
  // 메뉴 링크를 누르거나 메뉴 바깥을 누르면 닫는다.
  if (document.body.classList.contains('menu-open') && (event.target.closest('#site-menu a, #dash-menu a') || !event.target.closest('#site-menu, #dash-menu, [data-action="site-menu"], [data-action="dash-menu"]'))) closeMenus();
  // 처리 중인 버튼은 다시 눌리지 않게 잠근다 (중복 요청 방지).
  const trigger = event.target.closest('[data-action]');
  if (trigger?.dataset.busy) return;
  const task = onAction(event);
  if (trigger && trigger.isConnected && !['close', 'ui', 'site-menu', 'dash-menu', 'slide', 'prev', 'next', 'category', 'qty', 'fill', 'template', 'toggle-password'].includes(trigger.dataset.action)) {
    trigger.dataset.busy = '1';
    trigger.setAttribute('aria-busy', 'true');
    task.finally(() => { delete trigger.dataset.busy; trigger.removeAttribute('aria-busy'); });
  }
  task.catch(error => notify(error.message, 'error'));
});

// ───────── 입력 ─────────
let filterTimer;
document.addEventListener('input', event => {
  const input = event.target;
  if (input.closest('.dash-content form') && !input.matches('[data-ui], [data-filter]')) dirty = true;
  if (input.id === 'withdraw-amount') document.getElementById('withdraw-net').textContent = format(Math.max(0, Number(input.value) - Number(input.dataset.fee))) + '원';
  if (input.id === 'exchange-amount') document.getElementById('exchange-net').textContent = format(Math.floor(Number(input.value) / Number(input.dataset.divisor))) + ' P';
  if (input.id === 'qty') document.getElementById('qty-total').textContent = format(Math.min(5, Math.max(1, Number(input.value) || 1)) * Number(input.dataset.cost)) + ' P';
  if (input.dataset.filter === 'product') {
    const wrap = input.closest('.shop-tools');
    wrap.nextElementSibling.innerHTML = filteredProducts(state, wrap.querySelector('.filter.active')?.dataset.value ?? '전체', input.value);
  }
  if (input.dataset.ui && input.type === 'search') { clearTimeout(filterTimer); filterTimer = setTimeout(() => { ui[input.dataset.ui] = input.value; render(true); }, 250); }
  if (input.id === 'su-pw') {
    const v = input.value;
    const score = [v.length >= 8, /[a-z]/i.test(v) && /\d/.test(v), /[^a-z0-9]/i.test(v), v.length >= 12].filter(Boolean).length;
    const meter = document.querySelector('[data-meter]');
    meter.dataset.score = v ? score : '';
    meter.querySelector('span').textContent = v ? ['매우 약함', '약함', '보통', '안전', '매우 안전'][score] : '비밀번호 안전도';
  }
});

document.addEventListener('change', async event => {
  const field = event.target;
  if (field.dataset.ui && field.tagName === 'SELECT') { ui[field.dataset.ui] = field.value; render(true); return; }
  if (field.matches('[data-select-all]')) { for (const box of field.closest('[data-bulk]').querySelectorAll('[data-select]')) box.checked = field.checked; }
  if (field.matches('[data-select], [data-select-all]')) {
    const scope = field.closest('[data-bulk]');
    scope.querySelector('[data-selected-count]').textContent = scope.querySelectorAll('[data-select]:checked').length + '건 선택';
  }
  if (field.matches('[data-check-all]')) for (const box of field.closest('fieldset').querySelectorAll('[data-term]')) box.checked = field.checked;
  if (field.matches('[data-term]')) { const set = field.closest('fieldset'); set.querySelector('[data-check-all]').checked = [...set.querySelectorAll('[data-term]')].every(box => box.checked); }
  if (field.matches('[data-autosubmit]')) field.form.requestSubmit();
  if (field.matches('[data-toggle-partner]')) field.form.querySelector('[data-partner-field]').hidden = field.value !== 'partner';
  if (field.id !== 'profile-photo' || !field.files?.[0] || !me()) return;
  const viewerId = me().id;
  try {
    const photo = await profilePhoto(field.files[0]);
    await act('setPhoto', { photo });
    refresh('프로필 사진을 저장했어요.');
  } catch (error) { notify(error.message, 'error'); }
  finally { field.value = ''; }
});

// ───────── 폼 제출 ─────────
document.addEventListener('submit', async event => {
  const form = event.target;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  // 제출 중에는 같은 폼을 다시 보내지 않는다 (더블클릭·엔터 연타로 인한 중복 처리 방지).
  if (form.dataset.busy) return;
  form.dataset.busy = '1';
  const submits = [...form.querySelectorAll('button[type=submit], button:not([type])')];
  for (const button of submits) button.disabled = true;
  try { await submitForm(form, kind); }
  finally {
    delete form.dataset.busy;
    for (const button of submits) button.disabled = false;
  }
});

async function submitForm(form, kind) {
  const data = Object.fromEntries(new FormData(form));
  const checked = name => form.elements[name]?.checked ?? false;
  const viewer = me();
  const amount = Number(data.amount);
  try {
    switch (kind) {
      case 'login': {
        try {
          const account = await act('login', { email: data.email, password: data.password, otp: data.otp ?? '', remember: checked('remember') });
          afterLogin(account, `${account.name}님, 환영합니다!`);
        } catch (error) {
          const box = form.querySelector('[data-otp]');
          if (error.need === 'otp' && box) {
            const first = box.hidden;
            box.hidden = false;
            box.querySelector('input').focus();
            if (first && !data.otp) { notify('2단계 인증 코드를 입력해 주세요.'); break; }
          }
          throw error;
        }
        break;
      }
      case 'signup': {
        const account = await act('signup', { ...data, terms: checked('terms'), privacy: checked('privacy'), age: checked('age'), marketing: checked('marketing') });
        const bonus = state.settings.signupBonus + (data.referral ? state.settings.referralBonus : 0);
        afterLogin(account, bonus ? `가입을 축하해요! 첫 포인트 교환을 마치면 ${format(bonus)} P를 드려요. 🎉` : '가입을 축하해요! 🎉');
        break;
      }
      case 'social-demo': {
        const provider = form.dataset.id;
        const account = await act('socialDemo', { provider, terms: checked('terms'), privacy: checked('privacy'), age: checked('age'), marketing: checked('marketing') });
        afterLogin(account, `${providers[provider].name} 계정으로 로그인했습니다.`);
        break;
      }
      case 'social-terms': {
        const account = await act('socialComplete', { token: form.dataset.token, terms: checked('terms'), privacy: checked('privacy'), age: checked('age'), marketing: checked('marketing') });
        afterLogin(account, '가입을 환영합니다! 🎉');
        break;
      }
      case 'find': {
        const sent = await act('requestReset', { email: data.email });
        const link = sent?.link ?? (sent?.token ? `${location.origin}${location.pathname}#reset/${sent.token}` : '');
        if (link) dialog('재설정 링크 (데모)', `<p class="muted">데모 환경이라 메일 대신 링크를 바로 보여 드립니다. 운영 환경에서는 가입한 이메일로 발송됩니다.</p><a class="btn primary block" href="${escape(link.slice(link.indexOf('#')))}" data-action="close">비밀번호 재설정하러 가기</a>`, 'narrow');
        else { if (modal.open) modal.close(); notify('입력한 이메일이 가입되어 있다면 재설정 안내를 보냈습니다. 메일함을 확인해 주세요.'); }
        break;
      }
      case 'reset':
        if (data.password !== data.confirm) throw new Error('비밀번호 확인이 일치하지 않습니다.');
        await act('resetWithToken', { token: form.dataset.token, password: data.password });
        location.hash = 'login';
        notify('비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.');
        break;
      case 'settle': { const r = await act('confirmSettlement', { date: form.dataset.date, count: Number(data.count), amount: Number(data.amount) }); refresh(r.status === 'match' ? '스마일 포인트 집계와 일치합니다.' : `집계와 ${format(Math.abs(r.diff))} P 차이가 있어 운영팀에 알렸습니다.`, r.status === 'match' ? '' : 'error'); break; }
      case 'event-create': await act('createEvent', { ...data, firstOnly: checked('firstOnly') }); refresh('이벤트를 등록했습니다.'); break;
      case 'exchange': await act('exchange', { partnerId: form.dataset.id, amount }); refresh('교환을 신청했습니다. 승인되면 알림으로 알려 드릴게요.'); break;
      case 'link': { const sent = await act('linkPartner', { partnerId: form.dataset.id, loginId: data.loginId }); refresh(); linkVerifyDialog(form.dataset.id, sent?.code ?? ''); notify('인증번호를 보냈습니다. 웹하드에서 확인해 주세요.'); break; }
      case 'link-confirm': { const link = await act('confirmLink', { partnerId: form.dataset.id, code: data.code }); refresh(link.balance === null ? '연결 완료! 교환 가능 포인트는 제휴사 승인 시 확인합니다.' : `연결 완료! 교환 가능 ${format(link.balance)} P를 불러왔어요.`); break; }
      case 'withdrawal': { const row = await act('withdraw', { amount }); refresh(row?.status === 'processing' ? '출금을 신청했습니다. 바로 계좌 이체를 요청했어요.' : state.settings.payoutMode === 'api' ? '출금을 신청했습니다. 승인되면 등록 계좌로 자동 이체됩니다.' : '출금을 신청했습니다. 승인 후 다음 영업일에 입금됩니다.'); if (row?.status === 'processing') followPayouts(); break; }
      case 'bank': { const sent = await act('setBank', data); delete ui.bankEdit; refresh(sent?.code ? `데모: 1원 입금자명은 '스마일${sent.code}'입니다. 숫자 4자리를 입력하세요.` : '1원을 보냈습니다. 입금자명의 숫자 4자리를 입력해 주세요.'); break; }
      case 'bank-confirm': await act('confirmBank', { code: data.code }); refresh('계좌 인증이 완료되었습니다.'); break;
      case 'totp-enable': await act('enableTotp', { code: data.code }); refresh('2단계 인증을 켰습니다. 다음 로그인부터 코드를 입력합니다.'); break;
      case 'totp-disable': await act('disableTotp', { code: data.code }); refresh('2단계 인증을 껐습니다.'); break;
      case 'delete-account': { const done = await act('deleteAccount', { password: data.password, confirm: data.confirm }); ui = {}; go('#home'); notify(done?.left ? `탈퇴가 완료되었습니다. 남은 ${format(done.left)} P는 소멸되었습니다.` : '탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.'); break; }
      case 'purchase': { const rows = await act('order', { productId: form.dataset.id, quantity: Number(data.qty) }); go('#app/user/coupons'); notify(`쿠폰 ${rows.length}장을 발급했어요. 쿠폰함에서 확인하세요.`); break; }
      case 'gift': await act('gift', { email: data.email, amount, message: data.message }); form.reset(); refresh(`${format(amount)} P를 선물했어요. 🎁`); break;
      case 'ticket': await act('openTicket', data); refresh('문의를 등록했습니다. 답변이 등록되면 알려 드릴게요.'); break;
      case 'reply': await act('replyTicket', { id: form.dataset.id, reply: data.reply }); refresh('답변을 등록했습니다.'); break;
      case 'profile': await act('updateProfile', { name: data.name, phone: data.phone }); refresh('프로필을 저장했습니다.'); break;
      case 'notify': await act('updateProfile', { notify: { email: checked('email'), sms: checked('sms'), marketing: checked('marketing') } }); notify('알림 설정을 저장했습니다.'); break;
      case 'password': await act('changePassword', { before: data.before, after: data.after }); form.reset(); notify('비밀번호를 변경했습니다.'); break;
      case 'adjust': await act('adjust', { userId: form.dataset.id, amount, reason: data.reason }); refresh('포인트를 조정했습니다.'); break;
      case 'partner': await act('updatePartner', { partnerId: form.dataset.id, divisor: Number(data.divisor), min: Number(data.min), dailyLimit: Number(data.dailyLimit), reviewOver: Number(data.reviewOver), active: checked('active') }); refresh('제휴사 정책을 저장했습니다.'); break;
      case 'product-edit': await act('updateProduct', { productId: form.dataset.id, cost: Number(data.cost), stock: Number(data.stock), active: checked('active') }); refresh('상품을 저장했습니다.'); break;
      case 'settings': await act('updateSettings', { ...data, maintenance: checked('maintenance') }); refresh('운영 설정을 저장했습니다.'); break;
      case 'announce': await act('addAnnouncement', { title: data.title, body: data.body, pinned: checked('pinned') }); refresh('공지를 등록했습니다.'); break;
      case 'webhook': await act('setWebhook', { url: data.url }); refresh('웹훅 주소를 저장했습니다.'); break;
      case 'partner-create': await act('createPartner', data); refresh('제휴사를 등록했습니다. 연동 확인 후 운영을 켜 주세요.'); break;
      case 'product-create': await act('createProduct', data); refresh('상품을 등록했습니다.'); break;
      case 'staff-create': await act('createStaff', data); refresh('운영진 계정을 만들었습니다.'); break;
      case 'bulk-reject': { const done = await act('bulkReview', { ids: form.dataset.ids.split(','), status: 'rejected', reason: data.reason }); refresh(`${done}건을 반려했습니다.`); break; }
    }
  } catch (error) { notify(error.message, 'error'); }
}

async function profilePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('8MB 이하의 JPG, PNG 또는 WebP 사진을 선택해 주세요.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('사진을 읽을 수 없습니다. 다른 파일을 선택해 주세요.'); }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    const size = Math.min(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 320, 320);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally { bitmap.close(); }
}

let touchStart;
app.addEventListener('touchstart', event => { touchStart = event.target.closest('#hero') ? event.touches[0].clientX : undefined; }, { passive: true });
app.addEventListener('touchend', event => {
  if (touchStart === undefined) return;
  const delta = event.changedTouches[0].clientX - touchStart;
  if (Math.abs(delta) > 65) { slide(slideIndex + (delta < 0 ? 1 : -1)); startSlides(); }
  touchStart = undefined;
}, { passive: true });

// 화면은 즉시 바꾸고, 서버 모드면 최신 데이터를 받아 달라진 경우에만 다시 그린다.
let navSeq = 0;
window.addEventListener('hashchange', async () => {
  if (modal.open) modal.close();
  closeMenus();
  dirty = false;
  render();
  if (!live()) return;
  const seq = ++navSeq;
  try {
    const next = withServer((await api('./api/state')).state);
    if (seq !== navSeq) return;
    const changed = JSON.stringify({ ...next, server: 0 }) !== JSON.stringify({ ...state, server: 0 });
    state = next;
    if (changed && !busy()) render(true);
  } catch {}
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenus();
});
function closeMenus() {
  document.body.classList.remove('menu-open');
  for (const menu of document.querySelectorAll('#site-menu.open, #dash-menu.open')) menu.classList.remove('open');
  for (const toggle of document.querySelectorAll('[data-action="site-menu"], [data-action="dash-menu"]')) toggle.setAttribute('aria-expanded', 'false');
}
window.addEventListener('storage', event => {
  if (!live() && (event.key === S.storageKey || event.key === null)) { state = withServer(S.load()); if (modal.open) modal.close(); render(true); }
});
boot();
