import { animals, categories, config, escape, format, icon, providers } from '../catalog.js';
import { account, statuses, types } from '../state.js';

export const money = value => `${format(value)} <small>${config.point}</small>`;
export const showDate = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date(value));
export const showTime = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
export const ago = value => {
  const minutes = Math.round((Date.now() - new Date(value)) / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return minutes + '분 전';
  if (minutes < 1440) return Math.floor(minutes / 60) + '시간 전';
  return Math.floor(minutes / 1440) + '일 전';
};
export const pill = (text, style = 'plain') => `<span class="pill ${style}">${text}</span>`;
export const button = (label, href, css = 'btn primary', glyph = 'arrow') => `<a class="${css}" href="${href}">${label}${glyph ? icon(glyph, 18) : ''}</a>`;
export const action = (label, name, attrs = '', css = 'btn primary', glyph = '') => `<button type="button" class="${css}" data-action="${name}" ${attrs}>${glyph ? icon(glyph, 17) : ''}${label}</button>`;
export const heading = (eyebrow, title, copy) => `<div class="section-title"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${copy}</p></div>`;
export const blank = (message, glyph = 'inbox') => `<div class="empty">${icon(glyph, 28)}<p>${message}</p></div>`;
export const brand = () => `<a class="brand" href="#home"><img src="./assets/smile.svg" alt="" width="40" height="40"><span>${config.name}<small>${config.english}</small></span></a>`;
export const providerName = id => providers[id]?.name ?? '이메일';
export const partnerName = (state, id) => state.partners.find(item => item.id === id)?.name ?? '—';
export const productName = (state, id) => state.products.find(item => item.id === id)?.name ?? '—';
export const maskAccount = number => number ? '••••' + String(number).slice(-4) : '—';

export function avatar(profile, css = '') {
  const photo = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(profile?.photo ?? '') ? profile.photo : '';
  const index = Number.isInteger(profile?.avatar) && animals[profile.avatar] ? profile.avatar : 0;
  return `<img class="avatar ${css}" src="${photo || './assets/animal-' + (index + 1) + '.jpg'}" alt="${photo ? '프로필 사진' : animals[index] + ' 캐릭터'}">`;
}

export function panel(title, body, extra = '', css = '') {
  return `<section class="panel ${css}"><div class="panel-head"><h2>${title}</h2>${extra}</div>${body}</section>`;
}

export function metric(label, value, glyph, hint, tone = 0, trend = '') {
  return `<article class="metric"><div class="metric-top"><span class="feature-icon tone-${tone % 4}">${icon(glyph)}</span>${trend}</div><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`;
}
export function trend(now, before) {
  if (!before && !now) return '';
  const rate = before ? Math.round((now - before) / before * 100) : 100;
  return `<span class="trend ${rate >= 0 ? 'up' : 'down'}">${rate >= 0 ? '▲' : '▼'} ${Math.abs(rate)}%</span>`;
}

// ───────── 차트 ─────────
export function barChart(data, { unit = 'P', height = 180, tone = 'green', stacked } = {}) {
  const max = Math.max(1, ...data.map(item => stacked ? item.value + (item.extra ?? 0) : item.value));
  const width = 100 / data.length;
  return `<div class="chart" style="--h:${height}px" role="img" aria-label="${data.map(d => d.label + ' ' + format(d.value) + unit).join(', ')}">
    <div class="chart-bars">${data.map(item => `<div class="chart-col" style="width:${width}%">
      <span class="chart-tip">${format(item.value)}${unit}</span>
      <div class="chart-stack">${stacked && item.extra ? `<i class="bar extra" style="height:${item.extra / max * 100}%"></i>` : ''}<i class="bar ${tone}" style="height:${Math.max(item.value ? 3 : 0, item.value / max * 100)}%"></i></div>
      <small>${item.label}</small></div>`).join('')}</div></div>`;
}
export function donut(parts, center = '') {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  let offset = 0;
  const circles = parts.map(part => {
    const length = part.value / total * 100;
    const svg = `<circle r="15.9" cx="18" cy="18" fill="none" stroke="${part.color}" stroke-width="4.2" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${25 - offset}"/>`;
    offset += length;
    return svg;
  }).join('');
  return `<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 36 36" aria-hidden="true"><circle r="15.9" cx="18" cy="18" fill="none" stroke="#edf2ed" stroke-width="4.2"/>${circles}</svg><div>${center}</div></div>
    <ul class="legend">${parts.map(part => `<li><i style="background:${part.color}"></i><span>${part.label}</span><strong>${format(part.value)}</strong></li>`).join('')}</ul></div>`;
}
export function progress(value, label = '') {
  return `<div class="progress" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" ${label ? `aria-label="${label}"` : ''}><i style="width:${value}%"></i></div>`;
}
export function barcode(text) {
  let x = 0;
  const bars = [...String(text)].flatMap(char => {
    const n = Number(char) || 0;
    return [1 + (n % 3), 1 + ((n + 1) % 2), 2 + (n % 2), 1];
  });
  const rects = bars.map((w, i) => { const r = i % 2 === 0 ? `<rect x="${x}" width="${w}" height="40"/>` : ''; x += w; return r; }).join('');
  return `<svg class="barcode" viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}

// ───────── 상품 ─────────
const categoryArt = { 카페: 'coffee', 외식: 'shop', 편의점: 'store', 디저트: 'cake', 문화: 'film', 상품권: 'card' };
export function productVisual(item) {
  return item.image
    ? `<img loading="lazy" src="./assets/${item.image}.jpg" alt="">`
    : `<div class="product-art art-${categories.indexOf(item.category)}">${icon(categoryArt[item.category] ?? 'gift', 52)}<strong>${escape(item.brand)}</strong></div>`;
}
export function productCard(item) {
  const soldOut = !item.active || item.stock < 1;
  return `<button class="product-card ${soldOut ? 'sold-out' : ''}" type="button" data-action="product" data-id="${item.id}">
    <div class="product-image">${productVisual(item)}<span>${item.category}</span>${item.best ? '<b class="best">BEST</b>' : ''}${soldOut ? '<em>품절</em>' : ''}</div>
    <div class="product-detail"><p>${escape(item.brand)}</p><h3>${escape(item.name)}</h3><div><strong>${money(item.cost)}</strong><span class="product-arrow">${icon('arrow', 18)}</span></div></div>
  </button>`;
}
export function productCards(state, { search = true } = {}) {
  return `<div class="shop-tools">${search ? `<label class="search-field">${icon('search', 18)}<span class="sr-only">상품 검색</span><input type="search" data-filter="product" placeholder="브랜드나 상품명을 검색하세요"></label>` : ''}
    <div class="filter-row" aria-label="상품 분류">${categories.map((item, i) =>
      `<button type="button" class="filter ${i === 0 ? 'active' : ''}" data-action="category" data-value="${item}" aria-pressed="${i === 0}">${item}</button>`).join('')}</div></div>
    <div class="card-grid product-grid" data-products>${state.products.filter(item => item.active).map(productCard).join('')}</div>`;
}
export function filteredProducts(state, category, query = '') {
  const q = query.trim().toLowerCase();
  const list = state.products.filter(item => item.active && (category === '전체' || item.category === category) && (!q || (item.name + item.brand).toLowerCase().includes(q)));
  return list.length ? list.map(productCard).join('') : blank('조건에 맞는 상품이 없습니다.', 'search');
}

// ───────── 거래 표 ─────────
export function transactionLabel(state, row) {
  if (row.type === 'exchange') return partnerName(state, row.partner) + ' · ' + format(row.source) + ' P';
  if (row.type === 'coupon') return productName(state, row.product);
  if (row.type === 'withdrawal') return (row.bank ?? '등록 계좌') + ' · 실수령 ' + format(row.points - (row.fee ?? 0)) + '원';
  if (row.type === 'gift_out' || row.type === 'gift_in') return (row.type === 'gift_out' ? '받는 분 ' : '보낸 분 ') + escape(row.counterpartName ?? '');
  return escape(row.memo ?? '');
}
const signed = row => (['exchange', 'attendance', 'reward', 'gift_in'].includes(row.type) || (row.type === 'adjust' && row.points > 0) ? '+' : '−') + format(Math.abs(row.points)) + ' P';

export function table(state, rows, viewer, { actions = true, showUpdate = false, showUser = false, select = false, empty = '해당 조건의 거래가 없습니다.' } = {}) {
  if (!rows.length) return blank(empty);
  const named = rows.map(row => row.counterpart ? { ...row, counterpartName: account(state, row.counterpart)?.name } : row);
  return `<div class="table-scroll"><table><thead><tr>${select ? '<th scope="col"><input type="checkbox" data-select-all aria-label="전체 선택"></th>' : ''}<th scope="col">거래</th>${showUser ? '<th scope="col">회원</th>' : ''}<th scope="col">신청일</th><th scope="col" class="numeric">포인트</th><th scope="col">상태</th>${showUpdate ? '<th scope="col">최종 변경</th>' : ''}${actions ? '<th scope="col"><span class="sr-only">상세 및 처리</span></th>' : ''}</tr></thead>
    <tbody>${named.map(row => `<tr>${select ? `<td>${row.status === 'pending' ? `<input type="checkbox" data-select value="${row.id}" aria-label="${row.id} 선택">` : ''}</td>` : ''}
      <td><strong>${types[row.type]} · ${transactionLabel(state, row)}</strong><small>${row.id}</small></td>
      ${showUser ? `<td>${escape(account(state, row.userId)?.name ?? '—')}</td>` : ''}<td>${showTime(row.date)}</td>
      <td class="numeric ${signed(row)[0] === '+' ? 'plus' : 'minus'}">${signed(row)}</td><td>${pill(statuses[row.status], row.status)}</td>
      ${showUpdate ? `<td>${row.updated ? showTime(row.updated) : '—'}</td>` : ''}
      ${actions ? `<td><button type="button" class="text-btn" data-action="transaction" data-id="${row.id}">${row.status === 'pending' && viewer.role !== 'user' ? '처리' : '상세'} ${icon('chevron', 15)}</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

export function details(state, row) {
  const owner = account(state, row.userId);
  return `<div class="form-summary"><div><span>거래번호</span><strong>${row.id}</strong></div><div><span>거래 유형</span><strong>${types[row.type]}</strong></div>
    <div><span>회원</span><strong>${escape(owner?.name ?? '—')}</strong></div>
    <div><span>거래 내용</span><strong>${transactionLabel(state, row.counterpart ? { ...row, counterpartName: account(state, row.counterpart)?.name } : row)}</strong></div>
    ${row.type === 'exchange' ? `<div><span>교환 비율</span><strong>${row.rate}:1</strong></div>` : ''}
    <div><span>거래 포인트</span><strong>${money(Math.abs(row.points))}</strong></div>
    ${row.type === 'withdrawal' ? `<div><span>수수료</span><strong>${money(row.fee ?? 0)}</strong></div><div><span>실수령액</span><strong>${format(row.points - (row.fee ?? 0))}원</strong></div>` : ''}
    <div><span>신청 일시</span><strong>${showTime(row.date)}</strong></div>
    <div><span>상태</span>${pill(statuses[row.status], row.status)}</div>
    ${row.updated ? `<div><span>처리 일시</span><strong>${showTime(row.updated)}</strong></div>` : ''}
    ${row.reason ? `<div><span>반려 사유</span><strong>${escape(row.reason)}</strong></div>` : ''}
    ${row.memo && !['gift_out', 'gift_in'].includes(row.type) ? '' : row.memo ? `<div><span>메시지</span><strong>${escape(row.memo)}</strong></div>` : ''}
  </div>`;
}

export function faqList(faq) {
  return `<div class="disclosure-list">${faq.map(([question, answer]) => `<details><summary>${question}<span>${icon('plus', 17)}</span></summary><p>${answer}</p></details>`).join('')}</div>`;
}
export function announcementList(items) {
  const list = items.filter(item => item.visible).sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date));
  return list.length ? `<div class="disclosure-list">${list.map(item => `<details><summary><span>${item.pinned ? '<b class="pin">공지</b>' : ''}${escape(item.title)}<small>${item.date.replaceAll('-', '.')}</small></span>${icon('plus', 17)}</summary><p>${escape(item.body)}</p></details>`).join('')}</div>` : blank('등록된 공지가 없습니다.');
}
