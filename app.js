import { animals, config, format, icon, partners, products, roles } from './catalog.js';
import { balances, canUpdate, exchange, fee, load, order, partnerAvailable, roleTransactions, save, update, withdraw } from './state.js';
import { dashboard, details, filteredProducts, hero, landing, login, menus, money, slides } from './views.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
const landingIds = new Set(['partners', 'withdraw', 'shop', 'guide', 'support']);
let state = load();
let slideIndex = 0;
let route;
let toastTimer;

try { save(state); } catch {}

function getRoute() {
  const [section, first, second] = location.hash.slice(1).split('/');
  if (section === 'app' && Object.hasOwn(roles, first)) {
    return { view: 'dashboard', role: first, page: menus[first].some(([id]) => id === second) ? second : 'overview' };
  }
  if (section === 'login') return { view: 'login', page: menus.user.some(([id]) => id === first) ? first : 'overview' };
  return { view: 'landing', anchor: landingIds.has(section) ? section : '' };
}

function render(keepScroll = false) {
  const previous = route;
  route = getRoute();
  document.title = route.view === 'dashboard'
    ? menus[route.role].find(([id]) => id === route.page)[2] + ' | ' + config.name
    : route.view === 'login' ? '체험 로그인 | ' + config.name : config.name;
  if (route.view === 'dashboard') app.innerHTML = dashboard(state, route.role, route.page);
  if (route.view === 'login') app.innerHTML = login(route.page);
  if (route.view === 'landing' && (!keepScroll || previous?.view !== 'landing')) app.innerHTML = landing(slideIndex);
  if (keepScroll) return;
  if (route.anchor) requestAnimationFrame(() => document.getElementById(route.anchor)?.scrollIntoView());
  else window.scrollTo(0, 0);
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}

function dialog(title, body) {
  modal.innerHTML = `<div class="dialog-inner"><div class="panel-head"><h2 id="dialog-title">${title}</h2><button type="button" class="icon-btn" data-action="close" aria-label="닫기">${icon('close', 21)}</button></div>${body}</div>`;
  modal.setAttribute('aria-labelledby', 'dialog-title');
  if (!modal.open) modal.showModal();
}

function change(callback) {
  const next = load();
  const result = callback(next);
  save(next);
  state = next;
  return result;
}

function refresh(message) {
  if (modal.open) modal.close();
  render(true);
  notify(message);
}

function slide(next, control) {
  slideIndex = (next + slides.length) % slides.length;
  const element = document.getElementById('hero');
  if (!element) return;
  element.innerHTML = hero(slideIndex);
  if (control) {
    const query = control === 'slide' ? '[data-action="slide"][aria-pressed="true"]' : '[data-action="' + control + '"]';
    element.querySelector(query)?.focus({ preventScroll: true });
  }
}

function exchangeDialog(id) {
  if (route.role !== 'user') return;
  const item = partners.find(partner => partner.id === id);
  if (!item) return;
  const available = partnerAvailable(state, id);
  dialog(item.name + ' 포인트 교환', `<p class="muted">${item.type} · ${item.divisor} P당 1 스마일 P · 최소 ${format(item.min)} P</p>
    <form class="stack" data-form="exchange" data-id="${id}"><label for="exchange-amount">교환할 제휴 포인트</label>
    <input id="exchange-amount" data-divisor="${item.divisor}" name="amount" type="number" min="${item.min}" max="${available}" step="${item.divisor}" required placeholder="${format(item.min)}">
    <div class="form-summary"><div><span>교환 가능</span><strong>${money(available)}</strong></div><div><span>받을 스마일 포인트</span><strong id="exchange-net">0 P</strong></div></div>
    <button class="btn primary" type="submit" ${available < item.min ? 'disabled' : ''}>교환 신청 ${icon('arrow', 17)}</button></form>`);
}

function productDialog(id) {
  const item = products.find(product => product.id === id);
  if (!item) return;
  const isUser = route.role === 'user';
  const canBuy = balances(state).available >= item.cost;
  dialog(item.name, `<img class="dialog-product" src="./assets/${item.image}.jpg" alt="">
    <div class="form-summary"><div><span>상품</span><strong>${item.brand}</strong></div><div><span>필요 포인트</span><strong>${money(item.cost)}</strong></div>${isUser ? `<div><span>사용 가능</span><strong>${money(balances(state).available)}</strong></div>` : ''}</div>
    <p class="muted">발급 내역은 쿠폰함에서 볼 수 있습니다. 체험 쿠폰은 실제 매장에서 사용할 수 없습니다.</p>
    ${isUser ? `<form class="stack" data-form="purchase" data-id="${item.id}"><button class="btn primary" type="submit" ${canBuy ? '' : 'disabled'}>${canBuy ? '포인트로 구매' : '포인트 부족'} ${icon('gift', 17)}</button></form>` :
      route.view === 'landing' ? '<a class="btn primary" href="#login/shop">쇼핑 체험하기</a>' : ''}`);
}

function transactionDialog(id) {
  if (!route.role) return;
  const row = roleTransactions(state, route.role).find(item => item.id === id);
  if (!row) return;
  const options = [['complete', row.type === 'withdrawal' ? '모의 지급 완료' : '승인'], ['rejected', '반려'], ['canceled', '신청 취소']];
  dialog('거래 상세', `${details(row)}<div class="dialog-actions">${options.filter(([status]) => canUpdate(row, route.role, status)).map(([status, label]) =>
    `<button class="btn ${status === 'complete' ? 'primary' : 'outline'}" type="button" data-action="status" data-id="${row.id}" data-value="${status}">${label}</button>`).join('')}</div>`);
}

function setAvatar(index) {
  if (!route.role || !animals[index]) return;
  const profile = change(next => {
    next.profiles[route.role].avatar = index;
    return next.profiles[route.role];
  });
  refresh(profile.photo ? '동물 캐릭터를 저장했습니다. 현재는 올린 사진이 표시됩니다.' : '동물 캐릭터를 변경했습니다.');
}

function onAction(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const { action, id, value, index } = trigger.dataset;
  switch (action) {
    case 'site-menu':
    case 'dash-menu': {
      const menu = document.getElementById(trigger.getAttribute('aria-controls'));
      trigger.setAttribute('aria-expanded', menu.classList.toggle('open'));
      break;
    }
    case 'slide': slide(Number(index), action); break;
    case 'prev': slide(slideIndex - 1, action); break;
    case 'next': slide(slideIndex + 1, action); break;
    case 'category': {
      const scope = trigger.closest('.filter-row');
      for (const filter of scope.querySelectorAll('button')) {
        filter.classList.toggle('active', filter === trigger);
        filter.setAttribute('aria-pressed', String(filter === trigger));
      }
      scope.nextElementSibling.innerHTML = filteredProducts(value);
      break;
    }
    case 'exchange': exchangeDialog(id); break;
    case 'product': productDialog(id); break;
    case 'transaction': transactionDialog(id); break;
    case 'status':
      change(next => update(next, id, route.role, value));
      refresh(value === 'complete' ? '처리를 완료했습니다.' : value === 'rejected' ? '신청을 반려했습니다.' : '신청을 취소했습니다.');
      break;
    case 'close': modal.close(); break;
    case 'avatar': setAvatar(Number(id)); break;
    case 'random-avatar': {
      const current = state.profiles[route.role].avatar;
      setAvatar((current + 1 + Math.floor(Math.random() * (animals.length - 1))) % animals.length);
      break;
    }
    case 'remove-photo':
      change(next => { next.profiles[route.role].photo = ''; });
      refresh('프로필 사진을 삭제했습니다.');
      break;
  }
}

document.addEventListener('click', event => {
  if (event.target === modal) modal.close();
  const skip = event.target.closest('.skip');
  if (skip) {
    event.preventDefault();
    const main = document.getElementById('main');
    main?.setAttribute('tabindex', '-1');
    main?.focus();
    return;
  }
  const menuLink = event.target.closest('#site-menu a');
  if (menuLink) {
    document.getElementById('site-menu').classList.remove('open');
    document.querySelector('.mobile-toggle').setAttribute('aria-expanded', 'false');
  }
  try { onAction(event); } catch (error) { notify(error.message); }
});

document.addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'withdraw-amount') document.getElementById('withdraw-net').textContent = format(Math.max(0, Number(input.value) - fee)) + '원';
  if (input.id === 'exchange-amount') document.getElementById('exchange-net').textContent = format(Math.floor(Number(input.value) / Number(input.dataset.divisor))) + ' P';
});

document.addEventListener('submit', event => {
  const form = event.target;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  const data = new FormData(form);
  const amount = Number(data.get('amount'));
  try {
    if (route.role === 'user' && kind === 'exchange') {
      change(next => exchange(next, form.dataset.id, amount));
      refresh('교환을 신청했습니다. 거래 내역에서 진행 상태를 확인하세요.');
    }
    if (route.role === 'user' && kind === 'withdrawal') {
      change(next => withdraw(next, amount));
      location.hash = 'app/user/activity';
      notify('모의 출금을 신청했습니다.');
    }
    if (route.role === 'user' && kind === 'purchase') {
      change(next => order(next, form.dataset.id));
      if (modal.open) modal.close();
      location.hash = 'app/user/coupons';
      notify('체험 쿠폰을 발급했습니다.');
    }
    if (route.role && kind === 'profile') {
      const name = data.get('name').trim();
      if (!name || name.length > 24) throw new Error('표시 이름은 1~24자로 입력해 주세요.');
      change(next => { next.profiles[route.role].name = name; });
      refresh('프로필을 저장했습니다.');
    }
    if (route.role === 'user' && kind === 'ticket') {
      const message = data.get('message').trim();
      if (!message || message.length > 500) throw new Error('문의 내용을 1~500자로 입력해 주세요.');
      change(next => {
        const transaction = next.transactions.find(row => row.id === data.get('transaction'));
        next.tickets.unshift({ id: crypto.randomUUID(), transaction: transaction?.id ?? '', date: new Date().toISOString(), message, reply: '' });
      });
      refresh('문의를 등록했습니다.');
    }
    if (route.role === 'admin' && kind === 'reply') {
      const reply = data.get('reply').trim();
      if (!reply || reply.length > 500) throw new Error('답변을 1~500자로 입력해 주세요.');
      change(next => {
        const ticket = next.tickets.find(item => item.id === form.dataset.id);
        if (!ticket || ticket.reply) throw new Error('이미 답변했거나 찾을 수 없는 문의입니다.');
        ticket.reply = reply;
      });
      refresh('운영 답변을 저장했습니다.');
    }
  } catch (error) { notify(error.message); }
});

async function profilePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('8MB 이하의 JPG, PNG 또는 WebP 사진을 선택해 주세요.');
  }
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

document.addEventListener('change', async event => {
  const field = event.target;
  if (field.id !== 'profile-photo' || !field.files?.[0] || !route.role) return;
  const role = route.role;
  try {
    const photo = await profilePhoto(field.files[0]);
    change(next => { next.profiles[role].photo = photo; });
    refresh('프로필 사진을 저장했습니다.');
  } catch (error) { notify(error.message); }
  finally { field.value = ''; }
});

let touchStart;
app.addEventListener('touchstart', event => {
  touchStart = event.target.closest('#hero') ? event.touches[0].clientX : undefined;
}, { passive: true });
app.addEventListener('touchend', event => {
  if (touchStart === undefined) return;
  const delta = event.changedTouches[0].clientX - touchStart;
  if (Math.abs(delta) > 65) slide(slideIndex + (delta < 0 ? 1 : -1));
  touchStart = undefined;
}, { passive: true });

window.addEventListener('hashchange', () => {
  if (modal.open) modal.close();
  render();
});
window.addEventListener('storage', event => {
  if (event.key === 'smilepoint-demo-v1' || event.key === null) {
    state = load();
    if (modal.open) modal.close();
    render(true);
  }
});
render();
