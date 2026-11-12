import { escape, format, icon } from '../catalog.js';
import { account, balances, grade, kstDay, series } from '../state.js';
import { pendingQueue, settlementTable } from './partner.js';
import { slides } from './site.js';
import { activityFilters, applyFilters } from './user.js';
import { action, announcementList, avatar, barChart, blank, button, donut, maskAccount, metric, money, panel, pill, productVisual, providerName, showDate, showTime, table, trend, transactionLabel } from './ui.js';

export const adminMenu = [
  ['대시보드', [['overview', 'home', '운영 개요']]],
  ['회원·제휴', [['members', 'users', '회원 관리'], ['partners', 'layers', '제휴사 관리'], ['staff', 'key', '운영진 계정']]],
  ['거래 심사', [['requests', 'exchange', '교환 심사'], ['payouts', 'bank', '출금 심사'], ['transactions', 'file', '전체 거래']]],
  ['쇼핑', [['products', 'gift', '쿠폰 상품'], ['orders', 'shop', '쿠폰 주문']]],
  ['운영', [['settlement', 'chart', '정산 및 대사'], ['support', 'help', '고객센터'], ['content', 'megaphone', '배너·공지'], ['integrations', 'link', '연동 관리'], ['settings', 'settings', '운영 설정'], ['audit', 'shield', '감사 기록']]],
];
export const adminDescriptions = {
  members: '회원을 검색하고 잔액, 연결 계정, 거래를 확인하세요. 포인트 조정과 이용 정지를 할 수 있습니다.',
  partners: '제휴 웹하드를 등록하고 교환 비율, 최소 금액과 운영 상태를 관리하세요.',
  staff: '웹하드 관리자·최고 관리자 계정을 만들고 정지하거나 비밀번호를 초기화하세요.',
  integrations: '소셜 로그인, 웹하드 API, 쿠폰 공급사, 계좌 지급 등 외부 연동 상태를 확인하세요.',
  requests: '모든 제휴사의 교환 신청을 심사하세요.',
  payouts: '출금 신청을 확인하고 지급 또는 반려하세요. 여러 건을 한 번에 처리할 수 있습니다.',
  transactions: '서비스 전체 거래 원장을 조회하세요.',
  products: '모바일 쿠폰 상품을 등록하고 판매 포인트, 재고, 판매 상태를 관리하세요.',
  orders: '쿠폰 주문과 사용 현황을 확인하세요.',
  settlement: '제휴사별 교환 완료 내역과 정산 금액을 대사하세요.',
  support: '회원 1:1 문의에 답변하세요.',
  content: '메인 배너 구성을 확인하고 공지사항을 등록·관리하세요.',
  settings: '수수료, 한도, 적립 포인트 등 서비스 운영 정책을 설정하세요.',
  audit: '관리자의 처리·변경 이력을 확인하세요.',
  profile: '관리자 정보와 프로필 캐릭터를 관리하세요.',
};

function overview(state, me) {
  const rows = state.transactions;
  const users = state.accounts.filter(a => a.role === 'user');
  const today = kstDay();
  const pendingEx = rows.filter(r => r.type === 'exchange' && r.status === 'pending');
  const pendingOut = rows.filter(r => r.type === 'withdrawal' && r.status === 'pending');
  const couponToday = rows.filter(r => r.type === 'coupon' && kstDay(r.date) === today);
  const exSeries = series(rows.filter(r => r.type === 'exchange' && r.status !== 'canceled' && r.status !== 'rejected'), 14, r => r.points);
  const outSeries = series(rows.filter(r => r.type === 'withdrawal' && r.status !== 'canceled' && r.status !== 'rejected'), 14, r => r.points);
  const chart = exSeries.map((d, i) => ({ ...d, extra: outSeries[i].value }));
  const weekNow = exSeries.slice(7).reduce((s, d) => s + d.value, 0), weekBefore = exSeries.slice(0, 7).reduce((s, d) => s + d.value, 0);
  const colors = { green: '#18563e', blue: '#4f6fbf', peach: '#e08a4c', violet: '#8b62c9' };
  const byPartner = state.partners.map(p => ({ label: p.name, color: colors[p.color], value: rows.filter(r => r.partner === p.id && r.status === 'complete').reduce((s, r) => s + r.points, 0) }));
  const liability = users.reduce((s, u) => { const b = balances(state, u.id); return s + b.available + b.reserved; }, 0);
  const openTickets = state.tickets.filter(t => t.status === 'open').length;
  const lowStock = state.products.filter(p => p.active && p.stock < 30);
  const alerts = [
    pendingEx.length && ['exchange', `교환 심사 대기 ${pendingEx.length}건`, '#app/admin/requests', 'pending'],
    pendingOut.length && ['bank', `출금 지급 대기 ${pendingOut.length}건 · ${format(pendingOut.reduce((s, r) => s + r.points - r.fee, 0))}원`, '#app/admin/payouts', 'pending'],
    openTickets && ['help', `답변 대기 문의 ${openTickets}건`, '#app/admin/support', 'pending'],
    lowStock.length && ['alert', `재고 부족 상품 ${lowStock.length}개 (${lowStock.slice(0, 2).map(p => p.name).join(', ')}${lowStock.length > 2 ? ' 외' : ''})`, '#app/admin/products', 'rejected'],
    state.settings.maintenance && ['settings', '점검 모드가 켜져 있습니다.', '#app/admin/settings', 'rejected'],
  ].filter(Boolean);
  const recent = [...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return `<section class="dash-banner admin-banner"><div><span class="eyebrow">최고 관리자 · 운영 개요</span>
      <h1>${escape(me.name)}님, 오늘도 좋은 하루예요.</h1><p>처리할 일 ${alerts.length}가지 · 회원 보유 포인트 총 ${format(liability)} P</p>
      <div class="banner-actions">${button('교환 심사', '#app/admin/requests', 'btn lime sm', 'exchange')}${button('출금 심사', '#app/admin/payouts', 'btn ghost sm', 'bank')}${button('회원 관리', '#app/admin/members', 'btn ghost sm', 'users')}</div></div>
      ${avatar(me, 'banner-avatar')}</section>
    <div class="card-grid metrics four">
      ${metric('전체 회원', format(users.length) + '명', 'users', `오늘 가입 ${users.filter(u => kstDay(u.createdAt) === today).length}명 · 정지 ${users.filter(u => u.status === 'suspended').length}명`, 0)}
      ${metric('교환 심사 대기', pendingEx.length + '건', 'exchange', `${format(pendingEx.reduce((s, r) => s + r.points, 0))} P 적립 예정`, 1)}
      ${metric('출금 지급 대기', pendingOut.length + '건', 'bank', `${format(pendingOut.reduce((s, r) => s + r.points, 0))} P 처리 중`, 2)}
      ${metric('7일 교환 적립', format(weekNow) + ' P', 'activity', `오늘 쿠폰 ${couponToday.length}건 판매`, 3, trend(weekNow, weekBefore))}
    </div>
    <div class="dash-grid two-one">
      ${panel('최근 14일 거래 추이', barChart(chart, { stacked: true }) + '<div class="chart-legend"><span><i class="green"></i>교환 적립</span><span><i class="extra"></i>출금 신청</span></div>')}
      ${panel('제휴사별 교환 비중', donut(byPartner, `<strong>${state.partners.length}</strong><small>제휴사</small>`))}
    </div>
    <div class="dash-grid two-one">
      ${panel('확인이 필요한 일', alerts.length ? `<ul class="alert-list">${alerts.map(([glyph, text, href, tone]) => `<li><a href="${href}"><span class="dot-icon ${tone}">${icon(glyph, 17)}</span>${text}${icon('chevron', 16)}</a></li>`).join('')}</ul>` : blank('모든 업무를 처리했어요.', 'check'))}
      ${panel('최근 가입 회원', `<ul class="member-mini">${recent.map(u => `<li><button type="button" data-action="member" data-id="${u.id}">${avatar(u, 'sm')}<span><strong>${escape(u.name)}</strong><small>${providerName(u.provider)} · ${showDate(u.createdAt)}</small></span></button></li>`).join('')}</ul>`, button('전체', '#app/admin/members', 'text-btn', 'chevron'))}
    </div>
    <div class="dash-grid two-one">
      ${panel('최근 거래', table(state, rows.slice(0, 8), me, { showUser: true }), button('전체 거래', '#app/admin/transactions', 'text-btn', 'chevron'))}
      ${panel('최근 관리 기록', auditList(state, state.audit.slice(0, 6)), button('감사 기록', '#app/admin/audit', 'text-btn', 'chevron'))}
    </div>`;
}

const auditList = (state, items) => items.length ? `<ul class="audit-list">${items.map(item => `<li><b>${escape(item.action)}</b><span>${escape(item.detail || item.target)}</span><small>${escape(account(state, item.actor)?.name ?? item.actor)} · ${showTime(item.date)}</small></li>`).join('')}</ul>` : blank('기록이 없습니다.');

function members(state, me, ui) {
  const q = (ui.q ?? '').trim().toLowerCase();
  const list = state.accounts.filter(a => a.role === 'user')
    .filter(a => (!ui.mstatus || a.status === ui.mstatus) && (!ui.provider || a.provider === ui.provider) && (!q || (a.name + a.email + a.phone).toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const users = state.accounts.filter(a => a.role === 'user');
  return `<div class="summary-strip"><div><span>전체 회원</span><strong>${users.length}명</strong></div><div><span>활성</span><strong>${users.filter(u => u.status === 'active').length}명</strong></div><div><span>이용 정지</span><strong>${users.filter(u => u.status === 'suspended').length}명</strong></div><div><span>계좌 인증</span><strong>${users.filter(u => u.bank?.verified).length}명</strong></div></div>
    <div class="filters"><label class="search-field">${icon('search', 18)}<span class="sr-only">회원 검색</span><input type="search" data-ui="q" value="${escape(ui.q ?? '')}" placeholder="이름, 이메일, 연락처"></label>
      <select data-ui="mstatus" aria-label="상태"><option value="">전체 상태</option><option value="active" ${ui.mstatus === 'active' ? 'selected' : ''}>활성</option><option value="suspended" ${ui.mstatus === 'suspended' ? 'selected' : ''}>이용 정지</option></select>
      <select data-ui="provider" aria-label="가입 경로"><option value="">전체 가입 경로</option>${['email', 'kakao', 'naver', 'google', 'apple'].map(p => `<option value="${p}" ${ui.provider === p ? 'selected' : ''}>${providerName(p)}</option>`).join('')}</select>
      ${action('CSV', 'csv', 'data-name="회원목록"', 'btn outline sm', 'download')}</div>
    <section class="panel" data-csv>${list.length ? `<div class="table-scroll"><table><thead><tr><th>회원</th><th>가입 경로</th><th>등급</th><th class="numeric">사용 가능</th><th class="numeric">적립 예정</th><th>계좌</th><th>상태</th><th>가입일</th><th><span class="sr-only">관리</span></th></tr></thead>
      <tbody>${list.map(u => { const b = balances(state, u.id); return `<tr><td><div class="cell-user">${avatar(u, 'sm')}<span><strong>${escape(u.name)}</strong><small>${escape(u.email)}</small></span></div></td><td>${pill(providerName(u.provider), 'p-' + u.provider)}</td><td>${grade(state, u.id).name}</td><td class="numeric">${format(b.available)}</td><td class="numeric">${format(b.pending)}</td><td>${u.bank?.verified ? pill('인증', 'complete') : pill('미등록')}</td><td>${pill(u.status === 'active' ? '활성' : '정지', u.status === 'active' ? 'complete' : 'rejected')}</td><td>${showDate(u.createdAt)}</td><td>${action('관리', 'member', `data-id="${u.id}"`, 'text-btn')}</td></tr>`; }).join('')}</tbody></table></div>` : blank('조건에 맞는 회원이 없습니다.', 'users')}</section>`;
}

export function memberDetail(state, me, id) {
  const u = account(state, id);
  const b = balances(state, id);
  const g = grade(state, id);
  const rows = state.transactions.filter(r => r.userId === id);
  return `<div class="member-head">${avatar(u, 'profile-avatar')}<div><h3>${escape(u.name)} ${pill(u.status === 'active' ? '활성' : '이용 정지', u.status === 'active' ? 'complete' : 'rejected')}</h3><p class="muted small">${escape(u.email)} · ${escape(u.phone || '연락처 없음')} · ${providerName(u.provider)} 가입 · ${g.name}</p></div></div>
    <div class="summary-strip compact"><div><span>사용 가능</span><strong>${format(b.available)} P</strong></div><div><span>적립 예정</span><strong>${format(b.pending)} P</strong></div><div><span>처리 중</span><strong>${format(b.reserved)} P</strong></div></div>
    <div class="form-summary"><div><span>출금 계좌</span><strong>${u.bank ? `${u.bank.bank} ${maskAccount(u.bank.number)}` : '미등록'}</strong></div><div><span>연결 웹하드</span><strong>${Object.keys(u.links ?? {}).map(k => state.partners.find(p => p.id === k)?.name).join(', ') || '없음'}</strong></div><div><span>추천 코드</span><strong>${u.referral}</strong></div><div><span>가입일</span><strong>${showDate(u.createdAt)}</strong></div></div>
    <h4>최근 거래</h4>${rows.length ? `<ul class="mini-tx">${rows.slice(0, 6).map(r => `<li><span>${transactionLabel(state, r)}</span><small>${showDate(r.date)}</small><b>${format(Math.abs(r.points))} P</b></li>`).join('')}</ul>` : blank('거래가 없습니다.')}
    <form class="stack adjust-form" data-form="adjust" data-id="${u.id}"><h4>포인트 조정</h4><div class="field-grid"><div><label for="adj-amount">조정 포인트 (차감은 −)</label><input id="adj-amount" name="amount" type="number" required placeholder="예: 1000 또는 -500"></div><div><label for="adj-reason">사유</label><input id="adj-reason" name="reason" required maxlength="60" placeholder="이벤트 지급, 오류 정정 등"></div></div><button class="btn primary sm" type="submit">조정 반영</button></form>
    <div class="dialog-actions">${action(u.status === 'active' ? '이용 정지' : '정지 해제', 'member-status', `data-id="${u.id}" data-value="${u.status === 'active' ? 'suspended' : 'active'}"`, u.status === 'active' ? 'btn danger sm' : 'btn outline sm', u.status === 'active' ? 'lock' : 'check')}</div>`;
}

function partners(state) {
  return `<details class="panel create-box"><summary>${icon('plus', 18)} 새 제휴사 등록</summary><form class="stack" data-form="partner-create">
    <div class="field-grid three"><div><label for="pc-name">제휴사 이름</label><input id="pc-name" name="name" required maxlength="20" placeholder="예: 스카이파일"></div><div><label for="pc-type">교환 대상</label><input id="pc-type" name="type" maxlength="20" placeholder="판매 적립"></div><div><label for="pc-approval">안내 승인 시간</label><input id="pc-approval" name="approval" maxlength="20" placeholder="평균 1일"></div>
    <div><label for="pc-div">교환 비율 (제휴 P : 1)</label><input id="pc-div" name="divisor" type="number" min="1" max="20" value="2" required></div><div><label for="pc-min">최소 신청 금액</label><input id="pc-min" name="min" type="number" min="1" value="2000" required></div></div>
    <p class="muted small">등록하면 API 키가 발급되고 <b>일시 중지</b> 상태로 시작합니다. 연동 테스트를 마친 뒤 정책 수정에서 운영을 켜세요.</p><button class="btn primary sm" type="submit">등록</button></form></details>
    <div class="card-grid partner-grid two">${state.partners.map(p => {
    const rows = state.transactions.filter(r => r.partner === p.id);
    const done = rows.filter(r => r.status === 'complete');
    const manager = state.accounts.find(a => a.role === 'partner' && a.partnerId === p.id);
    return `<article class="partner-card admin"><div class="partner-top"><span class="partner-logo ${p.color}">${p.initials}</span>${pill(p.active ? '운영 중' : '일시 중지', p.active ? 'complete' : 'rejected')}</div>
      <h3>${p.name}</h3><p class="muted small">${p.type} · 담당 ${manager ? escape(manager.name) : '미지정'}</p>
      <dl class="mini-dl"><div><dt>교환 비율</dt><dd>${p.divisor}:1</dd></div><div><dt>최소</dt><dd>${format(p.min)} P</dd></div><div><dt>대기</dt><dd>${rows.filter(r => r.status === 'pending').length}건</dd></div><div><dt>누적 적립</dt><dd>${format(done.reduce((s, r) => s + r.points, 0))} P</dd></div><div><dt>연결 회원</dt><dd>${state.accounts.filter(a => a.links?.[p.id]).length}명</dd></div><div><dt>승인 시간</dt><dd>${p.approval}</dd></div></dl>
      <div class="partner-actions">${action('정책 수정', 'partner-edit', `data-id="${p.id}"`, 'btn outline sm', 'edit')}</div></article>`;
  }).join('')}</div>`;
}

export function partnerForm(p) {
  return `<form class="stack" data-form="partner" data-id="${p.id}"><div class="field-grid"><div><label for="pe-div">교환 비율 (제휴 P : 1)</label><input id="pe-div" name="divisor" type="number" min="1" max="20" value="${p.divisor}" required></div>
    <div><label for="pe-min">최소 신청 금액</label><input id="pe-min" name="min" type="number" min="1" value="${p.min}" required></div></div>
    <label class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><i></i>교환 서비스 운영</label>
    <p class="muted small">변경 내용은 즉시 사용자 화면에 반영되고 감사 기록에 남습니다. 이미 접수된 신청은 신청 당시 비율로 처리됩니다.</p>
    <button class="btn primary" type="submit">저장</button></form>`;
}

function products(state) {
  return `<details class="panel create-box"><summary>${icon('plus', 18)} 새 상품 등록</summary><form class="stack" data-form="product-create">
    <div class="field-grid three"><div><label for="pr-name">상품명</label><input id="pr-name" name="name" required maxlength="40"></div><div><label for="pr-brand">브랜드</label><input id="pr-brand" name="brand" required maxlength="20"></div><div><label for="pr-cat">분류</label><select id="pr-cat" name="category">${['카페', '외식', '편의점', '디저트', '문화', '상품권'].map(c => `<option>${c}</option>`).join('')}</select></div>
    <div><label for="pr-cost">판매 포인트</label><input id="pr-cost" name="cost" type="number" min="100" required></div><div><label for="pr-stock">재고</label><input id="pr-stock" name="stock" type="number" min="0" value="100" required></div></div>
    <p class="muted small">쿠폰 공급사 API를 연동하면 상품 코드와 공급 단가를 함께 저장하도록 확장합니다.</p><button class="btn primary sm" type="submit">등록</button></form></details>
    <section class="panel" data-csv><div class="panel-head"><h2>상품 ${state.products.length}종</h2>${action('CSV', 'csv', 'data-name="쿠폰상품"', 'btn outline sm', 'download')}</div><div class="table-scroll"><table><thead><tr><th>상품</th><th>분류</th><th class="numeric">판매 포인트</th><th class="numeric">재고</th><th class="numeric">판매 수</th><th>상태</th><th><span class="sr-only">관리</span></th></tr></thead>
    <tbody>${state.products.map(p => `<tr><td><div class="cell-user"><span class="thumb">${productVisual(p)}</span><span><strong>${escape(p.name)}</strong><small>${escape(p.brand)}</small></span></div></td><td>${p.category}</td><td class="numeric">${format(p.cost)}</td><td class="numeric ${p.stock < 30 ? 'minus' : ''}">${format(p.stock)}</td><td class="numeric">${state.transactions.filter(r => r.product === p.id).length}</td><td>${pill(p.active ? '판매 중' : '판매 중지', p.active ? 'complete' : 'canceled')}</td><td>${action('수정', 'product-edit', `data-id="${p.id}"`, 'text-btn')}</td></tr>`).join('')}</tbody></table></div></section>`;
}
export function productForm(p) {
  return `<form class="stack" data-form="product-edit" data-id="${p.id}"><div class="field-grid"><div><label for="pp-cost">판매 포인트</label><input id="pp-cost" name="cost" type="number" min="100" value="${p.cost}" required></div><div><label for="pp-stock">재고</label><input id="pp-stock" name="stock" type="number" min="0" value="${p.stock}" required></div></div>
    <label class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><i></i>판매 중</label><button class="btn primary" type="submit">저장</button></form>`;
}

function orders(state, me) {
  const rows = state.transactions.filter(r => r.type === 'coupon');
  const used = rows.filter(r => r.coupon?.used).length;
  const byCat = {};
  for (const r of rows) { const c = state.products.find(p => p.id === r.product)?.category ?? '기타'; byCat[c] = (byCat[c] ?? 0) + r.points; }
  const palette = ['#18563e', '#f0a43a', '#4f6fbf', '#d65a5a', '#8b62c9', '#3aa5a0'];
  return `<div class="summary-strip"><div><span>주문 건수</span><strong>${rows.length}건</strong></div><div><span>판매 포인트</span><strong>${format(rows.reduce((s, r) => s + r.points, 0))} P</strong></div><div><span>사용 완료</span><strong>${used}건</strong></div><div><span>미사용</span><strong>${rows.length - used}건</strong></div></div>
    <div class="dash-grid two-one"><section class="panel" data-csv><div class="panel-head"><h2>쿠폰 주문</h2>${action('CSV', 'csv', 'data-name="쿠폰주문"', 'btn outline sm', 'download')}</div>${table(state, rows, me, { showUser: true })}</section>
    ${panel('분류별 판매', donut(Object.entries(byCat).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] })), `<strong>${rows.length}</strong><small>주문</small>`))}</div>`;
}

function content(state) {
  return `${panel('메인 배너', `<div class="card-grid">${slides.map((s, i) => `<article class="content-card"><img src="./assets/${s.image}.jpg" alt="" loading="lazy"><span class="pill complete">${i + 1}번 · 노출 중</span><h3>${s.title.join(' ')}</h3><p class="muted small">${s.label} · 버튼 “${s.button}”</p></article>`).join('')}</div>`)}
    <div class="dash-grid two-one"><section class="panel"><h2>공지 등록</h2><form class="stack" data-form="announce"><label for="an-title">제목</label><input id="an-title" name="title" maxlength="60" required>
      <label for="an-body">내용</label><textarea id="an-body" name="body" rows="4" maxlength="500" required></textarea><label class="check"><input type="checkbox" name="pinned"> 상단 고정</label><button class="btn primary sm" type="submit">등록</button></form></section>
    <section class="panel"><h2>공지 목록</h2><ul class="announce-admin">${state.announcements.map(n => `<li class="${n.visible ? '' : 'hidden-item'}"><div><strong>${n.pinned ? '<b class="pin">고정</b>' : ''}${escape(n.title)}</strong><small>${n.date} · ${n.visible ? '노출' : '숨김'}</small></div>${action(n.visible ? '숨기기' : '노출', 'announce-toggle', `data-id="${n.id}"`, 'text-btn')}</li>`).join('')}</ul></section></div>
    ${panel('사용자에게 보이는 공지', announcementList(state.announcements))}`;
}

function settings(state) {
  const s = state.settings;
  const field = (name, label, hint) => `<div><label for="set-${name}">${label}</label><div class="amount-field"><input id="set-${name}" name="${name}" type="number" min="0" value="${s[name]}" required><span>P</span></div><small class="muted">${hint}</small></div>`;
  return `<form class="stack" data-form="settings"><section class="panel"><h2>출금 정책</h2><div class="field-grid three">${field('fee', '기본 출금 수수료', '등급별 할인율이 곱해집니다')}${field('withdrawalMinimum', '최소 출금 금액', '수수료보다 커야 합니다')}${field('dailyWithdrawLimit', '1인 일일 출금 한도', '신청 기준 합계')}</div></section>
    <section class="panel"><h2>적립 정책</h2><div class="field-grid three">${field('signupBonus', '회원가입 축하', '가입 즉시 지급')}${field('referralBonus', '추천 가입 보너스', '추천인·가입자 각각')}${field('attendancePoints', '출석체크', '하루 1회')}${field('attendanceBonus', '7일 연속 보너스', '7·14·21일째')}${field('giftMinimum', '최소 선물 금액', '회원 간 선물')}</div></section>
    <section class="panel"><h2>서비스 상태</h2><label class="switch"><input type="checkbox" name="maintenance" ${s.maintenance ? 'checked' : ''}><i></i>점검 모드 (메인 상단에 점검 안내 표시)</label></section>
    <div class="sticky-save"><button class="btn primary" type="submit">설정 저장 ${icon('check', 17)}</button>${state.server?.demo !== false ? `<button class="btn outline" type="button" data-action="reset-demo">${icon('refresh', 17)} 데모 데이터 초기화</button>` : ''}</div></form>`;
}

function audit(state, ui) {
  const q = (ui.q ?? '').trim().toLowerCase();
  const list = state.audit.filter(item => !q || (item.action + item.detail + item.target).toLowerCase().includes(q));
  return `<div class="filters"><label class="search-field">${icon('search', 18)}<span class="sr-only">검색</span><input type="search" data-ui="q" value="${escape(ui.q ?? '')}" placeholder="작업, 대상, 내용 검색"></label>${action('CSV', 'csv', 'data-name="감사기록"', 'btn outline sm', 'download')}</div>
    <section class="panel" data-csv>${list.length ? `<div class="table-scroll"><table><thead><tr><th>일시</th><th>관리자</th><th>작업</th><th>대상</th><th>내용</th></tr></thead><tbody>${list.map(item => `<tr><td>${showTime(item.date)}</td><td>${escape(account(state, item.actor)?.name ?? item.actor)}</td><td>${pill(escape(item.action))}</td><td>${escape(item.target)}</td><td class="wrap">${escape(item.detail)}</td></tr>`).join('')}</tbody></table></div>` : blank('기록이 없습니다.')}</section>`;
}

function staff(state, me) {
  const list = state.accounts.filter(a => a.role !== 'user');
  const roleName = a => a.role === 'admin' ? '최고 관리자' : (state.partners.find(p => p.id === a.partnerId)?.name ?? '') + ' 담당자';
  return `<div class="dash-grid two-one"><section class="panel" data-csv><div class="panel-head"><h2>운영진 ${list.length}명</h2>${action('CSV', 'csv', 'data-name="운영진"', 'btn outline sm', 'download')}</div>
    <div class="table-scroll"><table><thead><tr><th>계정</th><th>역할</th><th>상태</th><th>최근 로그인</th><th><span class="sr-only">관리</span></th></tr></thead><tbody>${list.map(a => `<tr><td><div class="cell-user">${avatar(a, 'sm')}<span><strong>${escape(a.name)}${a.id === me.id ? ' <small class="muted">(나)</small>' : ''}</strong><small>${escape(a.email)}</small></span></div></td><td>${pill(roleName(a), a.role === 'admin' ? 'p-apple' : 'p-google')}</td><td>${pill(a.status === 'active' ? '활성' : '정지', a.status === 'active' ? 'complete' : 'rejected')}</td><td>${a.lastLogin ? showTime(a.lastLogin) : '—'}</td>
      <td class="row-actions">${a.id === me.id ? '' : `${action(a.status === 'active' ? '정지' : '활성화', 'staff-status', `data-id="${a.id}" data-value="${a.status === 'active' ? 'suspended' : 'active'}"`, 'text-btn')}${action('비밀번호 초기화', 'reset-password', `data-id="${a.id}"`, 'text-btn')}`}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel"><h2>운영진 계정 만들기</h2><form class="stack" data-form="staff-create">
      <label for="st-role">역할</label><select id="st-role" name="role" data-toggle-partner><option value="partner">웹하드 관리자</option><option value="admin">최고 관리자</option></select>
      <div data-partner-field class="stack"><label for="st-partner">담당 제휴사</label><select id="st-partner" name="partnerId">${state.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
      <label for="st-name">이름</label><input id="st-name" name="name" required maxlength="20">
      <label for="st-email">이메일 (로그인 아이디)</label><input id="st-email" name="email" type="email" required>
      <label for="st-pw">초기 비밀번호</label><input id="st-pw" name="password" required minlength="8" placeholder="영문+숫자 8자 이상">
      <button class="btn primary sm" type="submit">계정 만들기</button>
      <p class="muted small">첫 로그인 후 내 프로필에서 비밀번호를 바꾸도록 안내하세요. 모든 생성·정지·초기화는 감사 기록에 남습니다.</p></form></section></div>`;
}

function integrations(state) {
  const server = state.server ?? { mode: 'demo' };
  const live = server.mode === 'server';
  const status = (ok, on = '연동됨', off = '데모') => pill(ok ? on : off, ok ? 'complete' : 'pending');
  const lastCall = id => (state.apiLogs ?? []).find(item => item.partner === id && item.source === 'partner-api');
  const rows = [
    ['server', '서비스 서버', live ? '서버 API · 파일 DB(data/db.json) · HttpOnly 세션 쿠키 · scrypt 비밀번호' : '브라우저 저장소로 동작 중 (GitHub Pages 등 정적 호스팅)', status(live, '서버 연결', '브라우저 데모')],
    ['users', '카카오 로그인', '.env의 KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET · Redirect URI: /auth/kakao/callback', status(server.oauth?.kakao)],
    ['users', '네이버 로그인', '.env의 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET · Redirect URI: /auth/naver/callback', status(server.oauth?.naver)],
    ['users', 'Google 로그인', '.env의 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET · Redirect URI: /auth/google/callback', status(server.oauth?.google)],
    ['users', 'Apple 로그인', 'Apple Developer 서비스 ID와 키(.p8)로 client_secret(JWT) 생성 필요', status(false, '', '준비 중')],
    ['send', '웹하드 웹훅 발송', live ? (server.webhooks ? 'HMAC 서명 · 실패 시 최대 3회 재시도' : 'WEBHOOK_DELIVERY=off 로 꺼져 있음') : '서버 실행 시 동작', status(live && server.webhooks, '동작 중', '대기')],
    ['gift', '모바일 쿠폰 공급사', '기프티쇼 비즈 등 계약 후 상품 조회·발행·취소 API 연결 (현재 자체 발급 코드)', status(false, '', '계약 전')],
    ['bank', '계좌 지급(펌뱅킹)', '현재 관리자가 출금 심사에서 지급 완료 처리 · 은행/PG 지급대행 API 계약 후 자동 이체', status(false, '', '수동 지급')],
    ['shield', '본인 확인', '휴대폰 본인인증(PASS 등)으로 실명·명의 확인 후 계좌 등록', status(false, '', '계약 전')],
  ];
  return `<section class="panel"><h2>외부 연동 상태</h2><ul class="integration-list">${rows.map(([glyph, name, copy, badge]) => `<li><span class="feature-icon tone-1">${icon(glyph, 20)}</span><div><strong>${name}</strong><small>${copy}</small></div>${badge}</li>`).join('')}</ul></section>
    ${panel('제휴사 API 상태', `<div class="table-scroll"><table><thead><tr><th>제휴사</th><th>상태</th><th>API 키</th><th>웹훅</th><th>최근 API 호출</th></tr></thead><tbody>${state.partners.map(p => { const last = lastCall(p.id); return `<tr><td><strong>${p.name}</strong></td><td>${pill(p.active ? '운영' : '중지', p.active ? 'complete' : 'canceled')}</td><td><code>${escape((p.apiKey ?? '').slice(0, 12))}…</code></td><td>${p.webhook ? `<code>${escape(p.webhook.replace(/^https:\/\//, '').slice(0, 34))}</code>` : '—'}</td><td>${last ? showTime(last.date) + ' · ' + last.status : '—'}</td></tr>`; }).join('')}</tbody></table></div>`)}
    <section class="panel"><h2>서버 실행 방법</h2><pre class="code-sample">npm run dev            # http://localhost:3070
cp .env.example .env   # 소셜 로그인 키, 운영 옵션 설정
DEMO_MODE=off          # 운영 시 테스트 계정 로그인·데모 초기화 차단</pre></section>`;
}

export function adminPage(state, me, page, ui, { profilePage, supportPage }) {
  const rows = state.transactions;
  switch (page) {
    case 'overview': return overview(state, me);
    case 'members': return members(state, me, ui);
    case 'partners': return partners(state);
    case 'staff': return staff(state, me);
    case 'integrations': return integrations(state);
    case 'requests': {
      const ex = rows.filter(r => r.type === 'exchange');
      return `<div class="tabs">${[['', '전체'], ...state.partners.map(p => [p.id, p.name])].map(([v, l]) => `<button type="button" class="tab ${(ui.partner ?? '') === v ? 'active' : ''}" data-action="ui" data-key="partner" data-value="${v}">${l} <b>${ex.filter(r => r.status === 'pending' && (!v || r.partner === v)).length}</b></button>`).join('')}</div>
        ${pendingQueue(state, me, ex.filter(r => !ui.partner || r.partner === ui.partner))}${panel('처리 내역', table(state, ex.filter(r => r.status !== 'pending' && (!ui.partner || r.partner === ui.partner)).slice(0, 30), me, { showUser: true, showUpdate: true }))}`;
    }
    case 'payouts': {
      const out = rows.filter(r => r.type === 'withdrawal');
      const pend = out.filter(r => r.status === 'pending');
      return `<div class="summary-strip"><div><span>지급 대기</span><strong>${pend.length}건</strong></div><div><span>지급 예정액</span><strong>${format(pend.reduce((s, r) => s + r.points - r.fee, 0))}원</strong></div><div><span>수수료 수익(누적)</span><strong>${format(out.filter(r => r.status === 'complete').reduce((s, r) => s + r.fee, 0))} P</strong></div><div><span>누적 지급</span><strong>${format(out.filter(r => r.status === 'complete').reduce((s, r) => s + r.points - r.fee, 0))}원</strong></div></div>
        ${pendingQueue(state, me, out)}${panel('처리 내역', table(state, out.filter(r => r.status !== 'pending'), me, { showUser: true, showUpdate: true }))}`;
    }
    case 'transactions': return `${activityFilters(ui, ['exchange', 'withdrawal', 'coupon', 'attendance', 'reward', 'adjust', 'gift_out', 'gift_in'])}<section class="panel" data-csv>${table(state, applyFilters(state, rows, ui), me, { showUser: true, showUpdate: true })}</section>`;
    case 'products': return products(state);
    case 'orders': return orders(state, me);
    case 'settlement': return `<div class="tabs">${[7, 14, 30].map(d => `<button type="button" class="tab ${(Number(ui.days) || 14) === d ? 'active' : ''}" data-action="ui" data-key="days" data-value="${d}">최근 ${d}일</button>`).join('')}</div>${settlementTable(state, rows, state.partners, Number(ui.days) || 14)}`;
    case 'support': return supportPage(state, me, true, ui);
    case 'content': return content(state);
    case 'settings': return settings(state);
    case 'audit': return audit(state, ui);
    case 'profile': return profilePage(state, me);
    default: return '';
  }
}
export { money };
