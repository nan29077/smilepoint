import { animals, config, escape, format, icon, providers, socialMark } from './catalog.js';
import * as S from './state.js';
import { memberDetail, partnerForm, productForm } from './views/admin.js';
import { dashboard, pages, pageTitle } from './views/dashboard.js';
import { hero, landing, login, signup, slides } from './views/site.js';
import { barcode, details, filteredProducts, money, productVisual, showDate } from './views/ui.js';
import { notificationList } from './views/user.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
const landingIds = new Set(['partners', 'withdraw', 'shop', 'guide', 'support']);
let state = S.load();
let slideIndex = 0;
let slideTimer;
let route;
let toastTimer;
let ui = {};
let nextAfterLogin = '';

try { S.save(state); } catch {}
const me = () => S.current(state);

// ───────── 라우팅 ─────────
function getRoute() {
  const [section, role, page] = location.hash.slice(1).split('/');
  if (section === 'app' && ['user', 'partner', 'admin'].includes(role)) {
    return { view: 'dashboard', role, page: pages(role).some(([id]) => id === page) ? page : 'overview' };
  }
  if (section === 'login') return { view: 'login' };
  if (section === 'signup') return { view: 'signup' };
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
    change(next => { for (const t of next.tickets) if (t.userId === viewer.id && t.status === 'answered') t.seen = true; });
  }
  const active = document.activeElement;
  const focusKey = active?.dataset?.ui;
  const caret = focusKey ? active.selectionStart : null;

  document.title = route.view === 'dashboard' ? `${pageTitle(route.role, route.page)} | ${config.name}`
    : route.view === 'login' ? `로그인 | ${config.name}` : route.view === 'signup' ? `회원가입 | ${config.name}` : `${config.name} - 흩어진 포인트를 한곳에`;
  if (route.view === 'dashboard') app.innerHTML = dashboard(state, viewer, route.page, ui);
  else if (route.view === 'login') app.innerHTML = login(state);
  else if (route.view === 'signup') app.innerHTML = signup(state);
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

// 저장소의 최신 상태를 불러와 변경한 뒤 저장한다. 실패하면 아무것도 저장하지 않는다.
function change(callback) {
  const next = S.load();
  const result = callback(next);
  S.save(next);
  state = next;
  return result;
}
function refresh(message, tone) {
  if (modal.open) modal.close();
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
    <div class="amount-field"><input id="exchange-amount" data-divisor="${item.divisor}" name="amount" type="number" min="${item.min}" max="${available}" step="${item.divisor}" required placeholder="${format(item.min)}"><span>P</span></div>
    <div class="chips"><button type="button" class="chip" data-action="fill" data-target="exchange-amount" data-value="${item.min}">최소</button><button type="button" class="chip" data-action="fill" data-target="exchange-amount" data-value="${available - (available % item.divisor)}">전액</button></div>
    <div class="form-summary"><div><span>교환 가능</span><strong>${money(available)}</strong></div><div class="total"><span>받을 스마일 포인트</span><strong id="exchange-net">0 P</strong></div></div>
    <button class="btn primary block" type="submit" ${available < item.min ? 'disabled' : ''}>교환 신청 ${icon('arrow', 17)}</button>
    <p class="muted small">신청 후 ${item.name} 승인 시 사용 가능 포인트로 적립됩니다. 승인 전에는 거래 내역에서 취소할 수 있어요.</p></form>`);
}
function linkDialog(id) {
  const item = state.partners.find(partner => partner.id === id);
  if (!item) return;
  dialog(item.name + ' 계정 연결', `<p class="muted">${item.name}에서 사용하는 아이디를 입력하세요. 실제 서비스에서는 ${item.name} 로그인(OAuth) 또는 인증번호로 본인을 확인합니다.</p>
    <form class="stack" data-form="link" data-id="${id}"><label for="link-id">${item.name} 아이디</label><input id="link-id" name="loginId" required minlength="4" maxlength="20" placeholder="영문·숫자 4~20자" autocomplete="off">
    <label class="check"><input type="checkbox" name="agree" required> 포인트 잔액 조회 및 교환을 위한 정보 제공에 동의합니다.</label>
    <button class="btn primary block" type="submit">연결하기 ${icon('link', 17)}</button></form>`);
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
  const options = [['complete', row.type === 'withdrawal' ? '지급 완료' : '승인'], ['rejected', '반려'], ['canceled', '신청 취소']].filter(([status]) => S.canUpdate(row, viewer, status));
  dialog('거래 상세', `${details(state, row)}
    ${options.some(([s]) => s === 'rejected') ? `<label for="reject-reason" class="small-label">반려 사유 <small class="muted">(반려 시 필수)</small></label><input id="reject-reason" maxlength="100" placeholder="예: 판매 포인트 정산 보류">` : ''}
    <div class="dialog-actions">${options.map(([status, label]) => `<button class="btn ${status === 'complete' ? 'primary' : status === 'rejected' ? 'danger' : 'outline'}" type="button" data-action="status" data-id="${row.id}" data-value="${status}">${label}</button>`).join('')}
    ${viewer.role === 'user' ? `<a class="btn outline" href="#app/user/support" data-action="close">이 거래 문의하기</a>` : ''}</div>`);
}
function socialDialog(provider) {
  const p = providers[provider];
  dialog(`${p.name} 계정으로 계속하기`, `<div class="social-consent ${provider}"><span class="social-mark">${socialMark[provider]}</span><p><b>${config.name}</b>이(가) ${p.name} 계정으로 로그인하려고 합니다.</p></div>
    <div class="form-summary"><div><span>제공 항목</span><strong>이름, 이메일, 프로필 사진</strong></div><div><span>선택 항목</span><strong>휴대폰 번호</strong></div></div>
    <p class="muted small">개발 중인 데모입니다. 실제 ${p.name} 로그인은 앱 키를 등록하고 SDK를 연동한 뒤 사용할 수 있습니다. 지금은 체험용 ${p.name} 회원으로 로그인합니다.</p>
    <button type="button" class="social ${provider} block" data-action="social-confirm" data-id="${provider}">${socialMark[provider]}<span>동의하고 계속하기</span></button>`, 'narrow');
}

// ───────── CSV ─────────
function downloadCsv(scope, name) {
  const tableEl = scope?.querySelector('table');
  if (!tableEl) { notify('내보낼 데이터가 없습니다.'); return; }
  const lines = [...tableEl.rows].map(tr => [...tr.cells].filter(cell => !cell.querySelector('input[type=checkbox]')).map(cell => `"${cell.innerText.replace(/\s*\n\s*/g, ' ').replace(/"/g, '""').trim()}"`).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${name}_${S.kstDay()}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  notify('CSV 파일을 내려받았습니다.');
}

function setAvatar(index) {
  const viewer = me();
  if (!viewer || !animals[index]) return;
  const profile = change(next => { const target = S.account(next, viewer.id); target.avatar = index; return target; });
  refresh(profile.photo ? '캐릭터를 저장했어요. 지금은 올린 사진이 우선 표시됩니다.' : `${animals[index]} 캐릭터로 바꿨어요.`);
}

// ───────── 클릭 동작 ─────────
function onAction(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || trigger.disabled) return;
  const { action, id, value, index, target, key, name } = trigger.dataset;
  const viewer = me();
  switch (action) {
    case 'site-menu':
    case 'dash-menu': {
      const menu = document.getElementById(trigger.getAttribute('aria-controls'));
      trigger.setAttribute('aria-expanded', menu.classList.toggle('open'));
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
    case 'social': socialDialog(id); break;
    case 'social-confirm': { const account = change(next => S.socialLogin(next, id)); afterLogin(account, `${providers[id].name} 계정으로 로그인했습니다.`); break; }
    case 'test-login': { const account = change(next => S.loginAs(next, id)); afterLogin(account, `${account.name}(테스트 계정)으로 로그인했습니다.`); break; }
    case 'toggle-password': { const input = trigger.previousElementSibling; input.type = input.type === 'password' ? 'text' : 'password'; trigger.setAttribute('aria-label', input.type === 'password' ? '비밀번호 표시' : '비밀번호 숨기기'); break; }
    case 'find-password': dialog('비밀번호 찾기', `<form class="stack" data-form="find"><p class="muted">가입한 이메일로 비밀번호 재설정 링크를 보내 드립니다.</p><label for="find-email">이메일</label><input id="find-email" name="email" type="email" required><button class="btn primary" type="submit">재설정 링크 받기</button></form>`, 'narrow'); break;
    case 'logout': change(next => S.logout(next)); ui = {}; go('#home'); notify('로그아웃했습니다.'); break;
    case 'exchange': exchangeDialog(id); break;
    case 'link': linkDialog(id); break;
    case 'unlink':
      dialog('연결 해제', `<p>${state.partners.find(p => p.id === id)?.name} 연결을 해제할까요? 다시 연결하면 잔액을 새로 불러옵니다.</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="unlink-confirm" data-id="${id}">해제</button><button class="btn outline" type="button" data-action="close">취소</button></div>`, 'narrow');
      break;
    case 'unlink-confirm': change(next => S.unlinkPartner(next, viewer.id, id)); refresh('웹하드 연결을 해제했습니다.'); break;
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
      change(next => S.update(next, viewer.id, id, value, reason));
      refresh(value === 'complete' ? '처리를 완료했습니다. 회원에게 알림을 보냈어요.' : value === 'rejected' ? '신청을 반려했습니다.' : '신청을 취소했습니다. 포인트가 복원되었어요.');
      break;
    }
    case 'bulk': {
      const ids = [...trigger.closest('[data-bulk]').querySelectorAll('[data-select]:checked')].map(box => box.value);
      if (!ids.length) { notify('처리할 신청을 선택해 주세요.'); break; }
      if (value === 'rejected') {
        dialog(`${ids.length}건 반려`, `<form class="stack" data-form="bulk-reject" data-ids="${ids.join(',')}"><label for="bulk-reason">반려 사유</label><input id="bulk-reason" name="reason" required maxlength="100" placeholder="회원에게 안내되는 사유입니다"><button class="btn danger" type="submit">반려하기</button></form>`, 'narrow');
        break;
      }
      const done = change(next => S.bulkUpdate(next, viewer.id, ids, 'complete'));
      refresh(`${done}건을 승인했습니다.`);
      break;
    }
    case 'attend': {
      const result = change(next => S.attend(next, viewer.id));
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
    case 'coupon-used': change(next => S.setCouponUsed(next, viewer.id, id, true)); refresh('사용 완료로 표시했어요.'); break;
    case 'coupon-unused': change(next => S.setCouponUsed(next, viewer.id, id, false)); refresh('사용 가능 쿠폰으로 되돌렸어요.'); break;
    case 'barcode': {
      const row = state.transactions.find(item => item.id === id);
      dialog(escape(state.products.find(p => p.id === row.product)?.name ?? '쿠폰'), `<div class="barcode-large">${barcode(row.coupon.code)}<code>${row.coupon.code.replace(/(\d{4})(?=\d)/g, '$1 ')}</code></div><p class="muted small center">매장 직원에게 바코드를 보여 주세요. 유효기간 ~ ${showDate(row.coupon.expires)}</p>`, 'narrow');
      break;
    }
    case 'notifications':
      dialog('알림', notificationList(state, viewer), 'narrow');
      change(next => S.readAll(next, S.current(next)));
      document.querySelector('.bell b')?.remove();
      break;
    case 'member': dialog('회원 상세', memberDetail(state, viewer, id), 'wide'); break;
    case 'member-status': change(next => S.setMemberStatus(next, viewer.id, id, value)); refresh(value === 'active' ? '이용 정지를 해제했습니다.' : '이용을 정지했습니다.'); break;
    case 'partner-edit': dialog(`${state.partners.find(p => p.id === id).name} 정책 수정`, partnerForm(state.partners.find(p => p.id === id)), 'narrow'); break;
    case 'product-edit': dialog(escape(state.products.find(p => p.id === id).name), productForm(state.products.find(p => p.id === id)), 'narrow'); break;
    case 'announce-toggle': change(next => S.toggleAnnouncement(next, viewer.id, id)); refresh('공지 노출 상태를 바꿨습니다.'); break;
    case 'regen-key':
      dialog('API 키 재발급', `<p>재발급하면 <b>기존 키는 즉시 폐기</b>되어 연동 서버에서 오류가 날 수 있습니다. 계속할까요?</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="regen-confirm">재발급</button><button class="btn outline" type="button" data-action="close">취소</button></div>`, 'narrow');
      break;
    case 'regen-confirm': change(next => S.regenerateKey(next, viewer.id)); ui.reveal = '1'; refresh('새 API 키를 발급했습니다. 연동 서버에 반영해 주세요.'); break;
    case 'reset-demo':
      dialog('데모 데이터 초기화', '<p>모든 회원·거래·설정을 처음 상태로 되돌립니다. 계속할까요?</p><div class="dialog-actions"><button class="btn danger" type="button" data-action="reset-confirm">초기화</button><button class="btn outline" type="button" data-action="close">취소</button></div>', 'narrow');
      break;
    case 'reset-confirm': { const fresh = S.freshState(); fresh.session = state.session; S.save(fresh); state = fresh; refresh('데모 데이터를 초기화했습니다.'); break; }
    case 'csv': downloadCsv(trigger.closest('[data-csv]') ?? trigger.closest('.dash-content')?.querySelector('[data-csv]'), name ?? '내보내기'); break;
    case 'policy': dialog(value === 'privacy' ? '개인정보처리방침' : '이용약관', `<p class="muted">${config.name}(가칭)의 ${value === 'privacy' ? '개인정보처리방침' : '이용약관'}은 서비스 정식 오픈 전에 법률 검토를 거쳐 게시됩니다.</p>`, 'narrow'); break;
    case 'close': modal.close(); break;
    case 'avatar': setAvatar(Number(id)); break;
    case 'random-avatar': setAvatar((viewer.avatar + 1 + Math.floor(Math.random() * (animals.length - 1))) % animals.length); break;
    case 'remove-photo': change(next => { S.account(next, viewer.id).photo = ''; }); refresh('프로필 사진을 삭제했어요. 동물 캐릭터가 표시됩니다.'); break;
  }
}

document.addEventListener('click', event => {
  if (event.target === modal) modal.close();
  const skip = event.target.closest('.skip');
  if (skip) { event.preventDefault(); const main = document.getElementById('main'); main?.setAttribute('tabindex', '-1'); main?.focus(); return; }
  if (event.target.closest('#site-menu a')) { document.getElementById('site-menu').classList.remove('open'); document.querySelector('.mobile-toggle')?.setAttribute('aria-expanded', 'false'); }
  if (event.target.closest('#dash-menu a')) document.getElementById('dash-menu')?.classList.remove('open');
  try { onAction(event); } catch (error) { notify(error.message, 'error'); }
});

// ───────── 입력 ─────────
let filterTimer;
document.addEventListener('input', event => {
  const input = event.target;
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
  if (field.id !== 'profile-photo' || !field.files?.[0] || !me()) return;
  const viewerId = me().id;
  try {
    const photo = await profilePhoto(field.files[0]);
    change(next => { S.account(next, viewerId).photo = photo; });
    refresh('프로필 사진을 저장했어요.');
  } catch (error) { notify(error.message, 'error'); }
  finally { field.value = ''; }
});

// ───────── 폼 제출 ─────────
document.addEventListener('submit', event => {
  const form = event.target;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const checked = name => form.elements[name]?.checked ?? false;
  const viewer = me();
  const amount = Number(data.amount);
  try {
    switch (kind) {
      case 'login': { const account = change(next => S.login(next, data.email, data.password)); afterLogin(account, `${account.name}님, 환영합니다!`); break; }
      case 'signup': {
        const account = change(next => S.signup(next, { ...data, provider: 'email', terms: checked('terms'), privacy: checked('privacy'), age: checked('age'), marketing: checked('marketing') }));
        afterLogin(account, `가입을 축하해요! ${format(state.settings.signupBonus)} P를 드렸어요. 🎉`);
        break;
      }
      case 'find': if (modal.open) modal.close(); notify(`${data.email}(으)로 재설정 안내를 보냈습니다. (데모)`); break;
      case 'exchange': change(next => S.exchange(next, viewer.id, form.dataset.id, amount)); refresh('교환을 신청했습니다. 승인되면 알림으로 알려 드릴게요.'); break;
      case 'link': { const link = change(next => S.linkPartner(next, viewer.id, form.dataset.id, data.loginId)); refresh(`연결 완료! 교환 가능 ${format(link.balance)} P를 불러왔어요.`); break; }
      case 'withdrawal': change(next => S.withdraw(next, viewer.id, amount)); refresh('출금을 신청했습니다. 승인 후 다음 영업일에 입금됩니다.'); break;
      case 'bank': change(next => S.setBank(next, viewer.id, data)); delete ui.bankEdit; refresh('계좌 인증이 완료되었습니다.'); break;
      case 'purchase': { const rows = change(next => S.order(next, viewer.id, form.dataset.id, Number(data.qty))); go('#app/user/coupons'); notify(`쿠폰 ${rows.length}장을 발급했어요. 쿠폰함에서 확인하세요.`); break; }
      case 'gift': change(next => S.gift(next, viewer.id, data.email, amount, data.message)); form.reset(); refresh(`${format(amount)} P를 선물했어요. 🎁`); break;
      case 'ticket': change(next => S.openTicket(next, viewer.id, data)); refresh('문의를 등록했습니다. 답변이 등록되면 알려 드릴게요.'); break;
      case 'reply': change(next => S.replyTicket(next, viewer.id, form.dataset.id, data.reply)); refresh('답변을 등록했습니다.'); break;
      case 'profile': change(next => S.updateProfile(next, viewer.id, { name: data.name, phone: data.phone })); refresh('프로필을 저장했습니다.'); break;
      case 'notify': change(next => S.updateProfile(next, viewer.id, { notify: { email: checked('email'), sms: checked('sms'), marketing: checked('marketing') } })); notify('알림 설정을 저장했습니다.'); break;
      case 'password': change(next => S.changePassword(next, viewer.id, data.before, data.after)); form.reset(); notify('비밀번호를 변경했습니다.'); break;
      case 'adjust': change(next => S.adjust(next, viewer.id, form.dataset.id, amount, data.reason)); refresh('포인트를 조정했습니다.'); break;
      case 'partner': change(next => S.updatePartner(next, viewer.id, form.dataset.id, { divisor: Number(data.divisor), min: Number(data.min), active: checked('active') })); refresh('제휴사 정책을 저장했습니다.'); break;
      case 'product-edit': change(next => S.updateProduct(next, viewer.id, form.dataset.id, { cost: Number(data.cost), stock: Number(data.stock), active: checked('active') })); refresh('상품을 저장했습니다.'); break;
      case 'settings': change(next => S.updateSettings(next, viewer.id, { ...data, maintenance: checked('maintenance') })); refresh('운영 설정을 저장했습니다.'); break;
      case 'announce': change(next => S.addAnnouncement(next, viewer.id, { title: data.title, body: data.body, pinned: checked('pinned') })); refresh('공지를 등록했습니다.'); break;
      case 'webhook': change(next => S.setWebhook(next, viewer.id, data.url)); refresh('웹훅 주소를 저장했습니다.'); break;
      case 'bulk-reject': { const done = change(next => S.bulkUpdate(next, viewer.id, form.dataset.ids.split(','), 'rejected', data.reason)); refresh(`${done}건을 반려했습니다.`); break; }
    }
  } catch (error) { notify(error.message, 'error'); }
});

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

window.addEventListener('hashchange', () => { if (modal.open) modal.close(); render(); });
window.addEventListener('storage', event => {
  if (event.key === S.storageKey || event.key === null) { state = S.load(); if (modal.open) modal.close(); render(true); }
});
render();
