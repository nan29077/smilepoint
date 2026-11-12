import { animals, banks, escape, faq, format, grades, icon, providers, ticketCategories } from '../catalog.js';
import { balances, feeFor, grade, kstDay, notificationsFor, partnerAvailable, series, streak, types, visibleTransactions, withdrawnToday } from '../state.js';
import { action, announcementList, avatar, barChart, barcode, blank, button, donut, faqList, maskAccount, metric, money, panel, pill, productCards, productName, progress, providerName, showDate, showTime, table, trend } from './ui.js';

export const userMenu = [
  ['개인', [['overview', 'home', '내 지갑'], ['exchange', 'exchange', '포인트 교환'], ['withdrawal', 'bank', '계좌 출금'], ['shop', 'shop', '포인트 쇼핑'], ['coupons', 'ticket', '쿠폰함']]],
  ['혜택', [['attendance', 'calendar', '출석체크'], ['gift', 'send', '포인트 선물']]],
  ['내 정보', [['activity', 'file', '거래 내역'], ['support', 'help', '고객센터']]],
];
export const userDescriptions = {
  exchange: '웹하드 계정을 연결하고 포인트를 스마일 포인트로 교환하세요.',
  withdrawal: '본인 명의 계좌로 포인트를 출금하세요. 등급이 오르면 수수료가 할인됩니다.',
  shop: '보유한 포인트로 모바일 쿠폰을 구매하세요.',
  coupons: '구매한 모바일 쿠폰의 바코드와 유효기간을 확인하세요.',
  attendance: '하루 한 번 출석하고 포인트를 받으세요. 7일 연속 출석하면 보너스!',
  gift: '친구나 가족에게 포인트를 선물하고, 추천 코드로 함께 혜택을 받으세요.',
  activity: '교환, 출금, 구매, 적립 내역을 기간과 유형별로 확인하세요.',
  support: '궁금한 점을 문의하고 답변을 확인하세요.',
  profile: '프로필 사진, 동물 캐릭터, 연락처와 알림 설정을 관리하세요.',
};

const unlinkedNote = '<p class="muted small">웹하드 아이디를 입력해 계정을 연결하면 교환 가능 포인트를 불러옵니다.</p>';

function partnerExchangeCards(state, me) {
  return `<div class="card-grid partner-grid four">${state.partners.map(item => {
    const link = me.links[item.id];
    const available = partnerAvailable(state, me.id, item.id);
    return `<article class="partner-card ${link ? 'linked' : ''} ${item.active ? '' : 'inactive'}">
      <div class="partner-top"><span class="partner-logo ${item.color}">${item.initials}</span>${link ? pill('연결됨', 'complete') : pill(item.active ? '미연결' : '일시 중지')}</div>
      <h3>${item.name}</h3><p class="partner-rate"><strong>${item.divisor} P</strong>${icon('arrow', 16)}<strong>1 스마일 P</strong></p>
      <dl class="mini-dl"><div><dt>교환 가능</dt><dd>${link ? format(available) + ' P' : '—'}</dd></div><div><dt>최소 신청</dt><dd>${format(item.min)} P</dd></div><div><dt>승인 시간</dt><dd>${item.approval}</dd></div></dl>
      <div class="partner-actions">${!item.active ? '<span class="muted small">점검 중입니다</span>' : link
        ? action('교환하기', 'exchange', `data-id="${item.id}" ${available < item.min ? 'disabled' : ''}`, 'btn primary sm', 'exchange') + action('연결 해제', 'unlink', `data-id="${item.id}"`, 'text-btn')
        : action('계정 연결', 'link', `data-id="${item.id}"`, 'btn outline sm', 'link')}</div>
    </article>`;
  }).join('')}</div>`;
}

function overview(state, me) {
  const rows = visibleTransactions(state, me);
  const bal = balances(state, me.id);
  const level = grade(state, me.id);
  const today = kstDay();
  const attended = (state.attendance[me.id] ?? []).includes(today);
  const monthKey = today.slice(0, 7);
  const monthIn = rows.filter(row => row.status === 'complete' && kstDay(row.date).startsWith(monthKey) && ['exchange', 'attendance', 'reward', 'gift_in'].includes(row.type)).reduce((sum, row) => sum + row.points, 0);
  const daily = series(rows.filter(row => row.status === 'complete' && ['exchange', 'attendance', 'reward', 'gift_in'].includes(row.type)), 14, row => row.points);
  const prevWeek = daily.slice(0, 7).reduce((s, d) => s + d.value, 0), thisWeek = daily.slice(7).reduce((s, d) => s + d.value, 0);
  const spentBy = type => rows.filter(row => row.type === type && ['complete', 'pending'].includes(row.status)).reduce((sum, row) => sum + row.points, 0);
  const linked = state.partners.filter(item => me.links[item.id]);
  return `<section class="dash-banner user-banner"><div>
      <span class="eyebrow">${level.name} 회원 · 내 지갑</span>
      <h1>${escape(me.name)}님, 안녕하세요.</h1>
      <div class="banner-balance"><span>사용 가능 포인트</span><strong>${money(bal.available)}</strong></div>
      <div class="banner-actions">${button('출금하기', '#app/user/withdrawal', 'btn lime sm', 'bank')}${button('쇼핑하기', '#app/user/shop', 'btn ghost sm', 'shop')}${button('교환하기', '#app/user/exchange', 'btn ghost sm', 'exchange')}</div>
    </div>${avatar(me, 'banner-avatar')}</section>
    <div class="card-grid metrics four">
      ${metric('사용 가능', money(bal.available), 'wallet', '출금·쇼핑·선물에 사용', 0)}
      ${metric('적립 예정', money(bal.pending), 'clock', '제휴사 승인 후 적립', 1)}
      ${metric('처리 중', money(bal.reserved), 'bank', '진행 중인 출금 신청', 2)}
      ${metric('이번 달 적립', money(monthIn), 'star', '교환·출석·이벤트 합계', 3, trend(thisWeek, prevWeek))}
    </div>
    <div class="dash-grid three">
      <section class="panel attend-card"><div class="panel-head"><h2>오늘의 출석</h2>${pill(streak(state, me.id) + '일 연속', 'complete')}</div>
        <div class="week-dots">${Array.from({ length: 7 }, (_, i) => { const key = kstDay(Date.now() - (6 - i) * 86400000); const on = (state.attendance[me.id] ?? []).includes(key); return `<span class="${on ? 'on' : ''} ${key === today ? 'today' : ''}"><i>${on ? icon('check', 14) : ''}</i><small>${key.slice(8)}</small></span>`; }).join('')}</div>
        ${attended ? `<p class="muted small">오늘 출석 완료! 내일 또 만나요.</p>${button('출석 달력 보기', '#app/user/attendance', 'btn outline sm block', '')}` : action(`출석하고 ${state.settings.attendancePoints} P 받기`, 'attend', '', 'btn primary block', 'calendar')}
      </section>
      <section class="panel grade-card"><div class="panel-head"><h2>회원 등급</h2><span class="grade-badge" style="--c:${level.color}">${icon('trophy', 15)} ${level.name}</span></div>
        <p class="grade-line"><strong>${format(level.exchanged)} P</strong> 누적 교환</p>${progress(level.progress, '다음 등급까지 진행률')}
        <p class="muted small">${level.next ? `${level.next.name}까지 ${format(level.next.min - level.exchanged)} P 남았어요.` : '최고 등급입니다!'} 현재 출금 수수료 <b>${format(feeFor(state, me.id))} P</b></p>
        <div class="grade-steps">${grades.map(g => `<span class="${g.id === level.id ? 'on' : ''}">${g.name}</span>`).join('')}</div>
      </section>
      <section class="panel invite-card"><div class="panel-head"><h2>친구 초대</h2>${icon('users', 20)}</div>
        <p class="muted small">친구가 내 코드로 가입하면 둘 다 ${format(state.settings.referralBonus)} P!</p>
        <div class="code-box"><code>${me.referral}</code>${action('복사', 'copy', `data-value="${me.referral}"`, 'btn outline sm', 'copy')}</div>
        ${button('포인트 선물하기', '#app/user/gift', 'text-btn', 'chevron')}
      </section>
    </div>
    <div class="dash-grid two-one">
      ${panel('최근 14일 적립', barChart(daily), `<span class="muted small">이번 주 ${format(thisWeek)} P</span>`)}
      ${panel('포인트 사용처', donut([{ label: '계좌 출금', value: spentBy('withdrawal'), color: '#18563e' }, { label: '쿠폰 구매', value: spentBy('coupon'), color: '#f0a43a' }, { label: '포인트 선물', value: spentBy('gift_out'), color: '#6f86d6' }], `<strong>${format(bal.spent + bal.reserved)}</strong><small>사용 P</small>`))}
    </div>
    <div class="dash-grid two-one">
      ${panel('최근 거래', table(state, rows.slice(0, 6), me), button('전체 내역', '#app/user/activity', 'text-btn', 'chevron'))}
      ${panel('연결된 웹하드', linked.length ? `<ul class="link-list">${linked.map(item => `<li><span class="partner-logo ${item.color} sm">${item.initials}</span><div><strong>${item.name}</strong><small>${escape(me.links[item.id].loginId)}</small></div><b>${format(partnerAvailable(state, me.id, item.id))} P</b></li>`).join('')}</ul>` : blank('연결된 웹하드가 없습니다.', 'link'), button('관리', '#app/user/exchange', 'text-btn', 'chevron'))}
    </div>
    ${panel('공지사항', announcementList(state.announcements.slice(0, 3)))}`;
}

function exchangePage(state, me) {
  const pending = visibleTransactions(state, me).filter(row => row.type === 'exchange');
  return `<div class="notice-bar">${icon('megaphone', 18)}<span><b>이벤트</b> 디스크온 첫 교환 시 5% 추가 적립 (11.30까지)</span></div>
    ${partnerExchangeCards(state, me)}
    ${unlinkedNote}
    ${panel('교환 신청 내역', table(state, pending.slice(0, 10), me, { showUpdate: true }), button('전체 보기', '#app/user/activity', 'text-btn', 'chevron'))}`;
}

function withdrawalPage(state, me) {
  const bal = balances(state, me.id);
  const fee = feeFor(state, me.id);
  const level = grade(state, me.id);
  const history = visibleTransactions(state, me).filter(row => row.type === 'withdrawal');
  const limitLeft = Math.max(0, state.settings.dailyWithdrawLimit - withdrawnToday(state, me.id));
  if (!me.bank?.verified) return `${bankForm(me, false)}${panel('출금 내역', table(state, history, me))}`;
  const max = Math.min(bal.available, limitLeft);
  return `<div class="dash-grid two-one">
    <section class="panel"><div class="panel-head"><h2>출금 신청</h2>${pill(level.name + ' 수수료 ' + format(fee) + ' P', 'complete')}</div>
      <form class="stack" data-form="withdrawal"><label for="withdraw-amount">출금할 포인트</label>
        <div class="amount-field"><input id="withdraw-amount" name="amount" type="number" inputmode="numeric" required min="${state.settings.withdrawalMinimum}" max="${max}" step="1" placeholder="${format(state.settings.withdrawalMinimum)} 이상" data-fee="${fee}"><span>P</span></div>
        <div class="chips">${[10000, 30000, 50000].map(value => `<button type="button" class="chip" data-action="fill" data-target="withdraw-amount" data-value="${value}" ${value > max ? 'disabled' : ''}>${format(value)}</button>`).join('')}<button type="button" class="chip" data-action="fill" data-target="withdraw-amount" data-value="${max}">전액</button></div>
        <div class="form-summary"><div><span>사용 가능</span><strong>${money(bal.available)}</strong></div><div><span>오늘 남은 한도</span><strong>${money(limitLeft)}</strong></div><div><span>출금 수수료</span><strong>${money(fee)}</strong></div><div class="total"><span>예상 실수령액</span><strong id="withdraw-net">0원</strong></div></div>
        <button type="submit" class="btn primary block" ${max < state.settings.withdrawalMinimum ? 'disabled' : ''}>출금 신청 ${icon('arrow', 17)}</button>
        <p class="muted small">최소 ${format(state.settings.withdrawalMinimum)} P · 승인 후 다음 영업일 입금 · 처리 대기 중에는 취소할 수 있어요.</p>
      </form></section>
    <div class="side-stack">
      <section class="panel bank-card"><span class="eyebrow">출금 계좌</span><h2>${me.bank.bank}</h2><p class="bank-number">${maskAccount(me.bank.number)}</p><p class="muted small">예금주 ${escape(me.bank.holder)} · ${pill('본인 확인 완료', 'complete')}</p>
        ${action('계좌 변경', 'bank-edit', '', 'btn outline sm', 'edit')}</section>
      <section class="panel"><h2>등급별 수수료</h2><ul class="fee-list">${grades.map(g => `<li class="${g.id === level.id ? 'on' : ''}"><span>${g.name}</span><b>${g.feeRate ? format(Math.round(state.settings.fee * g.feeRate)) + ' P' : '무료'}</b></li>`).join('')}</ul></section>
    </div></div>
    ${panel('출금 내역', table(state, history, me, { showUpdate: true }))}`;
}

export function bankForm(me, editing) {
  return `<section class="panel max-form"><div class="panel-head"><h2>${editing ? '출금 계좌 변경' : '출금 계좌 등록'}</h2>${pill('본인 명의만 가능', 'pending')}</div>
    <p class="muted">예금주가 회원 이름(<b>${escape(me.name)}</b>)과 같아야 등록됩니다. 등록 즉시 1원 인증을 모의로 진행합니다.</p>
    <form class="stack" data-form="bank"><label for="bank-name">은행</label><select id="bank-name" name="bank" required><option value="">은행 선택</option>${banks.map(item => `<option ${me.bank?.bank === item ? 'selected' : ''}>${item}</option>`).join('')}</select>
      <label for="bank-number">계좌번호</label><input id="bank-number" name="number" inputmode="numeric" required placeholder="'-' 없이 숫자만">
      <label for="bank-holder">예금주</label><input id="bank-holder" name="holder" required value="${escape(me.name)}">
      <button class="btn primary" type="submit">계좌 인증하고 등록 ${icon('check', 17)}</button></form></section>`;
}

function shopPage(state, me) {
  const bal = balances(state, me.id);
  const owned = visibleTransactions(state, me).filter(row => row.type === 'coupon' && !row.coupon?.used).length;
  return `<div class="shop-bar"><div><span>사용 가능</span><strong>${money(bal.available)}</strong></div><div><span>보유 쿠폰</span><strong>${owned}장</strong></div>${button('쿠폰함', '#app/user/coupons', 'btn outline sm', 'ticket')}</div>
    ${productCards(state)}`;
}

function couponsPage(state, me, ui) {
  const tab = ui.couponTab ?? 'usable';
  const now = new Date().toISOString();
  const all = visibleTransactions(state, me).filter(row => row.type === 'coupon' && row.status === 'complete');
  const groups = { usable: all.filter(row => !row.coupon.used && row.coupon.expires > now), used: all.filter(row => row.coupon.used), expired: all.filter(row => !row.coupon.used && row.coupon.expires <= now) };
  const labels = { usable: '사용 가능', used: '사용 완료', expired: '기간 만료' };
  const list = groups[tab];
  return `<div class="tabs" role="tablist">${Object.entries(labels).map(([id, label]) => `<button type="button" role="tab" class="tab ${tab === id ? 'active' : ''}" aria-selected="${tab === id}" data-action="ui" data-key="couponTab" data-value="${id}">${label} <b>${groups[id].length}</b></button>`).join('')}</div>
    ${list.length ? `<div class="card-grid coupon-grid">${list.map(row => {
      const product = state.products.find(item => item.id === row.product);
      const left = Math.ceil((new Date(row.coupon.expires) - Date.now()) / 86400000);
      return `<article class="coupon ${row.coupon.used ? 'used' : ''}"><div class="coupon-top"><span class="eyebrow">${escape(product?.brand ?? '')}</span>${tab === 'usable' ? pill('D-' + left, left < 15 ? 'pending' : 'complete') : pill(labels[tab])}</div>
        <h2>${escape(productName(state, row.product))}</h2><button type="button" class="barcode-btn" data-action="barcode" data-id="${row.id}" aria-label="바코드 크게 보기">${barcode(row.coupon.code)}<code>${row.coupon.code.replace(/(\d{4})(?=\d)/g, '$1 ')}</code></button>
        <div class="coupon-foot"><small>~ ${showDate(row.coupon.expires)} · ${format(row.points)} P</small>${tab === 'usable' ? action('사용 완료', 'coupon-used', `data-id="${row.id}"`, 'text-btn') : tab === 'used' ? action('되돌리기', 'coupon-unused', `data-id="${row.id}"`, 'text-btn') : ''}</div></article>`;
    }).join('')}</div>` : blank(tab === 'usable' ? '사용 가능한 쿠폰이 없습니다. 포인트 쇼핑에서 골라 보세요.' : labels[tab] + ' 쿠폰이 없습니다.', 'ticket')}
    ${tab === 'usable' ? `<p class="center">${button('쿠폰 쇼핑하기', '#app/user/shop', 'btn outline', 'shop')}</p>` : ''}`;
}

function attendancePage(state, me) {
  const today = kstDay();
  const [year, month] = today.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const set = new Set(state.attendance[me.id] ?? []);
  const attended = set.has(today);
  const monthCount = [...set].filter(key => key.startsWith(today.slice(0, 7))).length;
  const count = streak(state, me.id);
  const cells = [...Array(first).fill('<span class="empty-cell"></span>'), ...Array.from({ length: days }, (_, i) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return `<span class="${set.has(key) ? 'on' : ''} ${key === today ? 'today' : ''} ${key > today ? 'future' : ''}"><b>${i + 1}</b>${set.has(key) ? `<i>${icon('check', 13)}</i>` : ''}</span>`;
  })];
  return `<div class="dash-grid two-one">
    <section class="panel"><div class="panel-head"><h2>${year}년 ${month}월</h2>${pill('이번 달 ' + monthCount + '회 출석', 'complete')}</div>
      <div class="calendar"><div class="cal-head">${['일', '월', '화', '수', '목', '금', '토'].map(d => `<span>${d}</span>`).join('')}</div><div class="cal-body">${cells.join('')}</div></div></section>
    <div class="side-stack"><section class="panel attend-hero"><span class="feature-icon tone-3">${icon('calendar', 26)}</span><h2>${count}일 연속 출석 중</h2>
        <p class="muted small">7일 연속 출석하면 보너스 ${format(state.settings.attendanceBonus)} P를 드려요. ${count && count % 7 === 0 ? '이번 주 보너스를 받았어요!' : `보너스까지 ${7 - (count % 7)}일 남았어요.`}</p>
        ${progress(count && count % 7 === 0 ? 100 : Math.round((count % 7) / 7 * 100))}
        ${attended ? '<button class="btn outline block" disabled>오늘 출석 완료</button>' : action(`출석하고 ${state.settings.attendancePoints} P 받기`, 'attend', '', 'btn primary block', 'check')}</section>
      <section class="panel"><h2>출석 혜택</h2><ul class="fee-list"><li><span>매일 출석</span><b>${state.settings.attendancePoints} P</b></li><li><span>7일 연속 보너스</span><b>+${state.settings.attendanceBonus} P</b></li><li><span>누적 출석</span><b>${set.size}일</b></li></ul></section></div></div>`;
}

function giftPage(state, me) {
  const bal = balances(state, me.id);
  const history = visibleTransactions(state, me).filter(row => row.type === 'gift_out' || row.type === 'gift_in');
  return `<div class="dash-grid two-one">
    <section class="panel"><div class="panel-head"><h2>포인트 선물하기</h2>${pill('수수료 무료', 'complete')}</div>
      <form class="stack" data-form="gift"><label for="gift-email">받는 분 이메일</label><input id="gift-email" name="email" type="email" required placeholder="friend@example.com">
        <label for="gift-amount">선물할 포인트</label><div class="amount-field"><input id="gift-amount" name="amount" type="number" required min="${state.settings.giftMinimum}" max="${bal.available}" placeholder="${format(state.settings.giftMinimum)} 이상"><span>P</span></div>
        <div class="chips">${[1000, 3000, 5000, 10000].map(v => `<button type="button" class="chip" data-action="fill" data-target="gift-amount" data-value="${v}" ${v > bal.available ? 'disabled' : ''}>${format(v)}</button>`).join('')}</div>
        <label for="gift-msg">메시지 <small class="muted">(선택, 40자)</small></label><input id="gift-msg" name="message" maxlength="40" placeholder="고마워요! 맛있는 거 사 먹어요 :)">
        <div class="form-summary"><div><span>사용 가능</span><strong>${money(bal.available)}</strong></div></div>
        <button class="btn primary" type="submit">선물 보내기 ${icon('send', 17)}</button>
        <p class="muted small">체험용으로 haneul@example.com, doyun@example.com 등에게 보낼 수 있어요. 선물한 포인트는 되돌릴 수 없습니다.</p></form></section>
    <section class="panel invite-card big"><span class="eyebrow">친구 초대</span><h2>초대하고 함께 ${format(state.settings.referralBonus)} P 받기</h2><p class="muted small">친구가 가입할 때 아래 추천 코드를 입력하면 두 분 모두에게 포인트를 드려요.</p>
      <div class="code-box"><code>${me.referral}</code>${action('복사', 'copy', `data-value="${me.referral}"`, 'btn outline sm', 'copy')}</div>
      <p class="muted small">초대로 받은 포인트 <b>${format(visibleTransactions(state, me).filter(row => row.type === 'reward' && /추천/.test(row.memo ?? '')).reduce((s, r) => s + r.points, 0))} P</b></p></section></div>
    ${panel('선물 내역', table(state, history, me, { empty: '주고받은 선물이 없습니다.' }))}`;
}

export function activityFilters(ui, typeList) {
  return `<div class="filters"><label class="search-field">${icon('search', 18)}<span class="sr-only">검색</span><input type="search" data-ui="q" value="${escape(ui.q ?? '')}" placeholder="거래번호, 내용 검색"></label>
    <select data-ui="type" aria-label="유형"><option value="">전체 유형</option>${typeList.map(t => `<option value="${t}" ${ui.type === t ? 'selected' : ''}>${types[t]}</option>`).join('')}</select>
    <select data-ui="status" aria-label="상태"><option value="">전체 상태</option>${[['pending', '처리 대기'], ['complete', '완료'], ['rejected', '반려'], ['canceled', '취소']].map(([v, l]) => `<option value="${v}" ${ui.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select data-ui="period" aria-label="기간">${[['', '전체 기간'], ['7', '최근 7일'], ['30', '최근 30일'], ['90', '최근 90일']].map(([v, l]) => `<option value="${v}" ${(ui.period ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    ${action('CSV', 'csv', 'data-name="거래내역"', 'btn outline sm', 'download')}</div>`;
}
export function applyFilters(state, rows, ui) {
  const q = (ui.q ?? '').trim().toLowerCase();
  const since = ui.period ? new Date(Date.now() - Number(ui.period) * 86400000).toISOString() : '';
  return rows.filter(row => (!ui.type || row.type === ui.type) && (!ui.status || row.status === ui.status) && (!since || row.date >= since)
    && (!q || [row.id, row.memo, state.partners.find(p => p.id === row.partner)?.name, state.products.find(p => p.id === row.product)?.name, state.accounts.find(a => a.id === row.userId)?.name].join(' ').toLowerCase().includes(q)));
}

function activityPage(state, me, ui) {
  const rows = applyFilters(state, visibleTransactions(state, me), ui);
  const sum = dir => rows.filter(row => row.status === 'complete' && (dir === 'in' ? ['exchange', 'attendance', 'reward', 'gift_in'].includes(row.type) || (row.type === 'adjust' && row.points > 0) : !['exchange', 'attendance', 'reward', 'gift_in'].includes(row.type) && !(row.type === 'adjust' && row.points > 0))).reduce((s, r) => s + Math.abs(r.points), 0);
  return `${activityFilters(ui, Object.keys(types))}
    <div class="summary-strip"><div><span>조회 건수</span><strong>${rows.length}건</strong></div><div><span>적립 합계</span><strong class="plus">+${format(sum('in'))} P</strong></div><div><span>사용 합계</span><strong class="minus">−${format(sum('out'))} P</strong></div></div>
    <section class="panel" data-csv>${table(state, rows, me, { showUpdate: true })}</section>`;
}

export function supportPage(state, me, viewerIsAdmin = false, ui = {}) {
  const filter = ui.ticket ?? '';
  const tickets = (viewerIsAdmin ? state.tickets : state.tickets.filter(item => item.userId === me.id)).filter(item => !filter || item.status === filter);
  const list = tickets.length ? `<div class="ticket-list">${tickets.map(item => {
    const owner = state.accounts.find(a => a.id === item.userId);
    return `<article><div class="ticket-head"><div>${pill(item.category)} ${item.transaction ? `<small>${item.transaction}</small>` : ''}</div>${pill(item.status === 'answered' ? '답변 완료' : '답변 대기', item.status === 'answered' ? 'complete' : 'pending')}</div>
      ${viewerIsAdmin ? `<p class="ticket-user">${avatar(owner, 'xs')} <b>${escape(owner?.name)}</b> <small>${escape(owner?.email)}</small></p>` : ''}
      <p>${escape(item.message)}</p><small class="muted">${showTime(item.date)}</small>
      ${item.reply ? `<div class="ticket-reply"><strong>${icon('check', 14)} 운영팀 답변</strong><p>${escape(item.reply)}</p><small>${showTime(item.repliedAt)}</small></div>` : viewerIsAdmin ? `<form class="stack reply-form" data-form="reply" data-id="${item.id}"><label for="reply-${item.id}" class="sr-only">답변</label><textarea rows="2" id="reply-${item.id}" name="reply" maxlength="500" required placeholder="답변을 입력하세요"></textarea><div class="chips">${['확인 후 처리해 드렸습니다. 이용에 불편을 드려 죄송합니다.', '내 프로필 > 출금 계좌에서 변경하실 수 있습니다.'].map(t => `<button type="button" class="chip" data-action="template" data-target="reply-${item.id}" data-value="${t}">${t.slice(0, 14)}…</button>`).join('')}</div><button type="submit" class="btn primary sm">답변 등록</button></form>` : ''}
    </article>`;
  }).join('')}</div>` : blank('문의 내역이 없습니다.');
  if (viewerIsAdmin) {
    return `<div class="tabs">${[['', '전체'], ['open', '답변 대기'], ['answered', '답변 완료']].map(([v, l]) => `<button type="button" class="tab ${filter === v ? 'active' : ''}" data-action="ui" data-key="ticket" data-value="${v}">${l} <b>${state.tickets.filter(t => !v || t.status === v).length}</b></button>`).join('')}</div>${panel('1:1 문의', list)}`;
  }
  return `<div class="dash-grid two-one">
    <section class="panel"><h2>1:1 문의하기</h2><form class="stack" data-form="ticket">
      <div class="field-grid"><div><label for="ticket-category">문의 유형</label><select name="category" id="ticket-category">${ticketCategories.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div><label for="ticket-transaction">관련 거래 <small class="muted">(선택)</small></label><select name="transaction" id="ticket-transaction"><option value="">선택 안 함</option>${visibleTransactions(state, me).slice(0, 30).map(row => `<option value="${row.id}">${row.id} · ${types[row.type]}</option>`).join('')}</select></div></div>
      <label for="ticket-text">문의 내용</label><textarea id="ticket-text" name="message" maxlength="500" rows="5" required placeholder="문의하실 내용을 자세히 적어 주세요."></textarea>
      <button class="btn primary" type="submit">문의 등록 ${icon('send', 16)}</button></form></section>
    <section class="panel contact-card"><span class="feature-icon tone-1">${icon('help', 24)}</span><h2>고객센터 1588-0000</h2><p class="muted small">평일 10:00 ~ 18:00 (점심 12:00 ~ 13:00)<br>주말·공휴일 휴무 · 1:1 문의는 24시간 접수</p></section></div>
    ${panel('내 문의 내역', list)}
    ${panel('자주 묻는 질문', faqList(faq))}`;
}

export function profilePage(state, me) {
  const isUser = me.role === 'user';
  return `<div class="dash-grid two-one">
    <section class="panel profile-panel"><div class="profile-current">${avatar(me, 'profile-avatar')}<div><h2>${escape(me.name)}</h2><p>${escape(me.email)} · ${providerName(me.provider)} 가입</p>
      <div class="profile-actions"><label class="btn outline sm" for="profile-photo">${icon('edit', 16)} 사진 올리기</label><input class="sr-only" id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp">
      ${me.photo ? action('사진 삭제', 'remove-photo', '', 'text-btn') : ''}</div><p class="muted small">직접 올린 사진이 동물 캐릭터보다 우선 표시됩니다.</p></div></div>
      <div class="panel-head avatar-heading"><h2>동물 캐릭터</h2>${action('무작위', 'random-avatar', '', 'btn outline sm', 'refresh')}</div>
      <div class="avatar-grid">${animals.map((name, i) => `<button type="button" class="avatar-option ${me.avatar === i ? 'selected' : ''}" data-action="avatar" data-id="${i}" aria-pressed="${me.avatar === i}"><img src="./assets/animal-${i + 1}.jpg" alt="" loading="lazy"><span>${name}</span></button>`).join('')}</div>
    </section>
    <div class="side-stack">
      <section class="panel"><h2>기본 정보</h2><form class="stack" data-form="profile"><label for="profile-name">표시 이름</label><input id="profile-name" name="name" required maxlength="24" value="${escape(me.name)}">
        <label for="profile-phone">연락처</label><input id="profile-phone" name="phone" value="${escape(me.phone ?? '')}">
        <label>이메일</label><input value="${escape(me.email)}" disabled>
        <button class="btn primary sm" type="submit">저장</button></form></section>
      ${isUser ? `<section class="panel"><h2>알림 설정</h2><form class="stack" data-form="notify">${[['email', '이메일 알림'], ['sms', '문자 알림'], ['marketing', '이벤트·혜택 수신']].map(([k, l]) => `<label class="switch"><input type="checkbox" name="${k}" ${me.notify?.[k] ? 'checked' : ''} data-autosubmit><i></i>${l}</label>`).join('')}</form></section>
      <section class="panel"><h2>출금 계좌</h2>${me.bank ? `<p><b>${me.bank.bank}</b> ${maskAccount(me.bank.number)} ${pill('인증', 'complete')}</p>` : '<p class="muted small">등록된 계좌가 없습니다.</p>'}${button(me.bank ? '계좌 관리' : '계좌 등록', '#app/user/withdrawal', 'text-btn', 'chevron')}</section>` : ''}
      <section class="panel"><h2>로그인 · 보안</h2><p class="muted small">가입 방법 <b>${providerName(me.provider)}</b>${me.lastLogin ? ' · 최근 로그인 ' + showTime(me.lastLogin) : ''}</p>
        ${me.password ? `<form class="stack" data-form="password"><label for="pw-now">현재 비밀번호</label><input id="pw-now" name="before" type="password" autocomplete="current-password" required><label for="pw-new">새 비밀번호</label><input id="pw-new" name="after" type="password" autocomplete="new-password" required placeholder="영문+숫자 8자 이상"><button class="btn outline sm" type="submit">비밀번호 변경</button></form>` : `<p class="muted small">${providers[me.provider]?.name} 계정으로 로그인합니다.</p>`}</section>
    </div></div>`;
}

export function notificationList(state, me) {
  const list = notificationsFor(state, me).slice(0, 30);
  return list.length ? `<ul class="notice-list">${list.map(item => `<li class="${item.read ? '' : 'unread'}"><a href="#${item.link}" data-action="close">${icon('bell', 16)}<span>${escape(item.text)}<small>${showTime(item.date)}</small></span></a></li>`).join('')}</ul>` : blank('새 알림이 없습니다.', 'bell');
}

export function userPage(state, me, page, ui) {
  switch (page) {
    case 'overview': return overview(state, me);
    case 'exchange': return exchangePage(state, me);
    case 'withdrawal': return ui.bankEdit ? bankForm(me, true) : withdrawalPage(state, me);
    case 'shop': return shopPage(state, me);
    case 'coupons': return couponsPage(state, me, ui);
    case 'attendance': return attendancePage(state, me);
    case 'gift': return giftPage(state, me);
    case 'activity': return activityPage(state, me, ui);
    case 'support': return supportPage(state, me, false, ui);
    case 'profile': return profilePage(state, me);
    default: return '';
  }
}
