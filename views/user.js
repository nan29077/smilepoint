import { animals, banks, escape, faqFor, format, grades, icon, providers, ticketCategories } from '../catalog.js';
import { activeEvents, balances, feeFor, grade, kstDay, notificationsFor, partnerAvailable, series, streak, types, visibleTransactions, withdrawnToday } from '../state.js';
import { action, animalIndex, announcementList, avatar, barChart, barcode, blank, button, donut, exchangeFlow, faqList, maskAccount, metric, money, panel, pill, productCard, productCards, productName, progress, providerName, showDate, showTime, table, transactionLabel, trend, withdrawalFlow } from './ui.js';

export const userMenu = [
  ['개인', [['overview', 'home', '내 지갑'], ['exchange', 'exchange', '포인트 교환'], ['withdrawal', 'bank', '계좌 출금'], ['shop', 'shop', '포인트 쇼핑'], ['coupons', 'ticket', '쿠폰함']]],
  ['혜택', [['attendance', 'calendar', '출석체크'], ['gift', 'send', '포인트 선물'], ['benefits', 'trophy', '등급·이벤트']]],
  ['내 정보', [['activity', 'file', '거래 내역'], ['alerts', 'bell', '알림'], ['support', 'help', '고객센터']]],
];
export const userDescriptions = {
  exchange: '웹하드 계정을 연결하고 포인트를 스마일 포인트로 교환하세요.',
  withdrawal: '본인 명의 계좌로 포인트를 출금하세요. 신청부터 입금까지 진행 상황을 바로 확인할 수 있습니다.',
  benefits: '회원 등급별 혜택과 진행 중인 이벤트, 포인트를 모으는 방법을 확인하세요.',
  alerts: '교환 승인, 출금 입금, 문의 답변 등 내 계정의 알림을 모아 보세요.',
  shop: '보유한 포인트로 모바일 쿠폰을 구매하세요.',
  coupons: '구매한 모바일 쿠폰의 바코드와 유효기간을 확인하세요.',
  attendance: '하루 한 번 출석하고 포인트를 받으세요. 7일 연속 출석하면 보너스!',
  gift: '친구나 가족에게 포인트를 선물하고, 추천 코드로 함께 혜택을 받으세요.',
  activity: '교환, 출금, 구매, 적립 내역을 기간과 유형별로 확인하세요.',
  support: '궁금한 점을 문의하고 답변을 확인하세요.',
  profile: '프로필 사진, 연락처와 알림 설정을 관리하세요.',
};

const unlinkedNote = '<p class="muted small">웹하드 아이디를 입력하면 해당 웹하드로 인증번호가 전송됩니다. 웹하드에서 받은 번호를 입력해야 연결이 완료되고 교환 가능 포인트를 불러옵니다.</p>';

function partnerExchangeCards(state, me) {
  return `<div class="card-grid partner-grid four">${state.partners.map(item => {
    const link = me.links[item.id];
    const verified = !!link?.verified;
    const waiting = link && !verified;
    const available = partnerAvailable(state, me.id, item.id);
    const status = verified ? pill('연결됨', 'complete') : waiting ? pill('인증 대기', 'pending') : pill(item.active ? '미연결' : '일시 중지');
    const actions = !item.active ? '<span class="muted small">점검 중입니다</span>'
      : verified ? action('교환하기', 'exchange', `data-id="${item.id}" ${available !== null && available < item.min ? 'disabled' : ''}`, 'btn primary sm', 'exchange') + action('연결 해제', 'unlink', `data-id="${item.id}"`, 'text-btn')
      : waiting ? action('인증번호 입력', 'link-verify', `data-id="${item.id}"`, 'btn primary sm', 'key') + action('취소', 'unlink-confirm', `data-id="${item.id}"`, 'text-btn')
      : action('계정 연결', 'link', `data-id="${item.id}"`, 'btn outline sm', 'link');
    return `<article class="partner-card ${verified ? 'linked' : ''} ${item.active ? '' : 'inactive'}">
      <div class="partner-top"><span class="partner-logo ${item.color}">${escape(item.initials)}</span>${status}</div>
      <h3>${escape(item.name)}</h3><p class="partner-rate"><strong>${item.divisor} P</strong>${icon('arrow', 16)}<strong>1 스마일 P</strong></p>
      <dl class="mini-dl"><div><dt>교환 가능</dt><dd>${!verified ? (waiting ? '인증 후 확인' : '—') : available === null ? '승인 시 확인' : format(available) + ' P'}</dd></div><div><dt>최소 신청</dt><dd>${format(item.min)} P</dd></div><div><dt>승인 시간</dt><dd>${escape(item.approval)}</dd></div></dl>
      ${waiting ? `<p class="muted small">${escape(link.loginId)} · ${escape(item.name)}에서 받은 인증번호를 입력하세요.</p>` : ''}
      <div class="partner-actions">${actions}</div>
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
  const linked = state.partners.filter(item => me.links[item.id]?.verified);
  const active = rows.filter(row => ['pending', 'processing'].includes(row.status) && ['exchange', 'withdrawal'].includes(row.type)).slice(0, 3);
  const sellable = state.products.filter(item => item.active && item.stock > 0);
  const affordable = sellable.filter(item => item.cost <= bal.available).sort((a, b) => (b.best ? 1 : 0) - (a.best ? 1 : 0) || b.cost - a.cost);
  const picks = (affordable.length ? affordable : [...sellable].sort((a, b) => a.cost - b.cost)).slice(0, 4);
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
    ${active.length ? panel('진행 중인 신청', `<div class="track-list">${active.map(row => trackCard(state, row)).join('')}</div>`, pill(active.length + '건 진행 중', 'pending')) : ''}
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
      ${panel('연결된 웹하드', linked.length ? `<ul class="link-list">${linked.map(item => `<li><span class="partner-logo ${item.color} sm">${escape(item.initials)}</span><div><strong>${escape(item.name)}</strong><small>${escape(me.links[item.id].loginId)}</small></div><b>${partnerAvailable(state, me.id, item.id) === null ? '승인 시 확인' : format(partnerAvailable(state, me.id, item.id)) + ' P'}</b></li>`).join('')}</ul>` : blank('연결된 웹하드가 없습니다.', 'link'), button('관리', '#app/user/exchange', 'text-btn', 'chevron'))}
    </div>
    ${picks.length ? panel(affordable.length ? '지금 바꿀 수 있는 쿠폰' : '조금만 더 모으면 받을 수 있어요', `<div class="card-grid product-grid">${picks.map(productCard).join('')}</div>`, button('쇼핑 전체 보기', '#app/user/shop', 'text-btn', 'chevron')) : ''}
    ${panel('공지사항', announcementList(state.announcements.slice(0, 3)))}`;
}

function trackCard(state, row) {
  return `<article class="track"><div class="track-head"><strong>${types[row.type]} · ${transactionLabel(state, row)}</strong><b>${format(row.points)} P</b></div>
    ${row.type === 'withdrawal' ? withdrawalFlow(row) : exchangeFlow(row)}
    <div class="track-foot"><small class="muted">${row.id}</small>${action('상세 보기', 'transaction', `data-id="${row.id}"`, 'text-btn')}</div></article>`;
}

function exchangePage(state, me) {
  const pending = visibleTransactions(state, me).filter(row => row.type === 'exchange');
  const events = activeEvents(state);
  return `${events.map(event => `<div class="notice-bar">${icon('megaphone', 18)}<span><b>이벤트</b> ${escape(event.title)} · ${escape(state.partners.find(p => p.id === event.partner)?.name ?? '')} ${event.firstOnly ? '첫 교환' : '교환'}이 승인되면 자동으로 추가 적립돼요${event.until ? ` (${Number(event.until.slice(5, 7))}.${Number(event.until.slice(8))}까지)` : ''}</span></div>`).join('')}
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
  if (me.bankRequest) return `${bankConfirm(state, me)}${panel('출금 내역', table(state, history, me))}`;
  if (!me.bank?.verified) return `${bankForm(me, false)}${panel('출금 내역', table(state, history, me))}`;
  const max = Math.min(bal.available, limitLeft);
  const api = state.settings.payoutMode === 'api';
  const auto = api ? state.settings.payoutAutoLimit : 0;
  const net = row => row.points - (row.fee ?? 0);
  const monthKey = kstDay().slice(0, 7);
  const paid = history.filter(row => row.status === 'complete');
  const paidMonth = paid.filter(row => kstDay(row.date).startsWith(monthKey));
  const active = history.filter(row => ['pending', 'processing'].includes(row.status));
  return `<div class="summary-strip"><div><span>이번 달 출금</span><strong>${paidMonth.length}건 · ${format(paidMonth.reduce((s, r) => s + net(r), 0))}원</strong></div><div><span>진행 중</span><strong>${active.length}건 · ${format(active.reduce((s, r) => s + r.points, 0))} P</strong></div><div><span>누적 실수령</span><strong>${format(paid.reduce((s, r) => s + net(r), 0))}원</strong></div><div><span>지급 방식</span><strong>${api ? '자동 이체' : '영업일 지급'}</strong></div></div>
    ${active.length ? panel('진행 중인 출금', `<div class="track-list">${active.map(row => trackCard(state, row)).join('')}</div>`, pill(active.length + '건', 'pending')) : ''}
    <div class="dash-grid two-one">
    <section class="panel"><div class="panel-head"><h2>출금 신청</h2>${pill(level.name + ' 수수료 ' + format(fee) + ' P', 'complete')}</div>
      <form class="stack" data-form="withdrawal"><label for="withdraw-amount">출금할 포인트</label>
        <div class="amount-field"><input id="withdraw-amount" name="amount" type="number" inputmode="numeric" required min="${state.settings.withdrawalMinimum}" max="${max}" step="1" placeholder="${format(state.settings.withdrawalMinimum)} 이상" data-fee="${fee}"><span>P</span></div>
        <div class="chips">${[10000, 30000, 50000].map(value => `<button type="button" class="chip" data-action="fill" data-target="withdraw-amount" data-value="${value}" ${value > max ? 'disabled' : ''}>${format(value)}</button>`).join('')}<button type="button" class="chip" data-action="fill" data-target="withdraw-amount" data-value="${max}">전액</button></div>
        <div class="form-summary"><div><span>사용 가능</span><strong>${money(bal.available)}</strong></div><div><span>오늘 남은 한도</span><strong>${money(limitLeft)}</strong></div><div><span>출금 수수료</span><strong>${money(fee)}</strong></div><div class="total"><span>예상 실수령액</span><strong id="withdraw-net">0원</strong></div></div>
        <button type="submit" class="btn primary block" ${max < state.settings.withdrawalMinimum ? 'disabled' : ''}>출금 신청 ${icon('arrow', 17)}</button>
        <p class="muted small">최소 ${format(state.settings.withdrawalMinimum)} P · ${api ? `${auto ? format(auto) + ' P 이하는 심사 없이, 그 외에는 ' : ''}승인 즉시 지급대행사를 통해 등록 계좌로 자동 이체` : '승인 후 다음 영업일 입금'} · 심사 대기 중에는 취소할 수 있어요.</p>
      </form></section>
    <div class="side-stack">
      <section class="panel bank-card"><span class="eyebrow">출금 계좌</span><h2>${escape(me.bank.bank)}</h2><p class="bank-number">${maskAccount(me.bank.number)}</p><p class="muted small">예금주 ${escape(me.bank.holder)} · ${pill('본인 확인 완료', 'complete')}</p>
        ${action('계좌 변경', 'bank-edit', '', 'btn outline sm', 'edit')}</section>
      <section class="panel"><h2>등급별 수수료</h2><ul class="fee-list">${grades.map(g => `<li class="${g.id === level.id ? 'on' : ''}"><span>${g.name}</span><b>${g.feeRate ? format(Math.round(state.settings.fee * g.feeRate)) + ' P' : '무료'}</b></li>`).join('')}</ul></section>
      <section class="panel"><h2>출금 안내</h2><ul class="guide-list"><li>출금은 <b>본인 명의 계좌</b>로만 가능합니다.</li><li>${api ? '승인되면 지급대행사를 통해 <b>자동으로 이체</b>되고, 입금되면 알림을 보내 드립니다.' : '승인 후 <b>다음 영업일</b>에 입금됩니다.'}</li><li>은행 점검 시간(매일 23:30~00:30)에는 이체가 지연될 수 있습니다.</li><li>하루 최대 <b>${format(state.settings.dailyWithdrawLimit)} P</b>까지 신청할 수 있습니다.</li></ul></section>
    </div></div>
    ${panel('출금 내역', table(state, history, me, { showUpdate: true }))}`;
}

export function bankForm(me, editing) {
  return `<section class="panel max-form"><div class="panel-head"><h2>${editing ? '출금 계좌 변경' : '출금 계좌 등록'}</h2>${pill('본인 명의만 가능', 'pending')}</div>
    <p class="muted">예금주가 회원 이름(<b>${escape(me.name)}</b>)과 같아야 합니다. 입력한 계좌로 <b>1원</b>을 보내 드리며, 입금자명에 적힌 숫자 4자리를 입력하면 인증이 끝납니다. 계좌를 등록하면 이름은 바꿀 수 없습니다.</p>
    <form class="stack" data-form="bank"><label for="bank-name">은행</label><select id="bank-name" name="bank" required><option value="">은행 선택</option>${banks.map(item => `<option ${me.bank?.bank === item ? 'selected' : ''}>${item}</option>`).join('')}</select>
      <label for="bank-number">계좌번호</label><input id="bank-number" name="number" inputmode="numeric" required maxlength="20" placeholder="'-' 없이 숫자만">
      <label for="bank-holder">예금주</label><input id="bank-holder" name="holder" required maxlength="24" value="${escape(me.name)}">
      <button class="btn primary" type="submit">1원 보내고 인증하기 ${icon('send', 17)}</button>
      ${editing ? action('취소', 'ui', 'data-key="bankEdit" data-value=""', 'btn outline') : ''}</form></section>`;
}
export function bankConfirm(state, me) {
  const request = me.bankRequest;
  const expired = request.expires < Date.now();
  const manual = state.server?.mode === 'server' && state.server?.demo === false && !state.server?.bankVerify;
  return `<section class="panel max-form"><div class="panel-head"><h2>출금 계좌 인증</h2>${pill(expired ? '시간 만료' : '인증 대기', expired ? 'rejected' : 'pending')}</div>
    <p><b>${escape(request.bank)}</b> ${escape(request.masked ?? '••••' + String(request.number ?? '').slice(-4))} 계좌로 1원을 보냈습니다.</p>
    <p class="muted small">${manual ? '자동 1원 송금이 연결되지 않아 운영팀이 명의를 확인한 뒤 승인합니다. 승인되면 알림으로 알려 드려요. 운영팀 안내를 받은 경우 아래에 숫자를 입력할 수도 있습니다.' : '은행 앱의 입금 내역에서 입금자명 <b>스마일○○○○</b>의 숫자 4자리를 입력하세요. 30분 안에 입력해야 합니다.'}</p>
    ${expired ? '' : `<form class="stack" data-form="bank-confirm"><label for="bank-code">입금자명 숫자 4자리</label><input id="bank-code" name="code" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9]{4}" maxlength="4" placeholder="0000">
      <button class="btn primary" type="submit">인증 완료 ${icon('check', 17)}</button></form>`}
    <div class="dialog-actions">${action('다른 계좌로 다시 등록', 'bank-retry', '', 'btn outline sm', 'refresh')}</div></section>`;
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
  const mine = visibleTransactions(state, me).filter(row => row.type === 'coupon');
  const all = mine.filter(row => row.status === 'complete');
  const groups = { usable: all.filter(row => !row.coupon.used && row.coupon.expires > now), used: all.filter(row => row.coupon.used), expired: all.filter(row => !row.coupon.used && row.coupon.expires <= now), canceled: mine.filter(row => row.status === 'canceled') };
  const labels = { usable: '사용 가능', used: '사용 완료', expired: '기간 만료', canceled: '취소·환불' };
  const list = groups[tab];
  return `<div class="tabs" role="tablist">${Object.entries(labels).map(([id, label]) => `<button type="button" role="tab" class="tab ${tab === id ? 'active' : ''}" aria-selected="${tab === id}" data-action="ui" data-key="couponTab" data-value="${id}">${label} <b>${groups[id].length}</b></button>`).join('')}</div>
    ${list.length ? `<div class="card-grid coupon-grid">${list.map(row => {
      const product = state.products.find(item => item.id === row.product);
      const left = Math.ceil((new Date(row.coupon.expires) - Date.now()) / 86400000);
      const hidden = !row.coupon.revealed || !row.coupon.code;
      const code = hidden ? '' : `<button type="button" class="barcode-btn" data-action="barcode" data-id="${row.id}" aria-label="바코드 크게 보기">${barcode(row.coupon.code)}<code>${escape(row.coupon.code).replace(/(\d{4})(?=\d)/g, '$1 ')}</code></button>`;
      const reveal = `<button type="button" class="barcode-btn locked" data-action="coupon-reveal" data-id="${row.id}">${icon('eye', 22)}<span>쿠폰 번호 보기</span><small>번호를 확인하면 직접 취소할 수 없어요</small></button>`;
      const canCancel = hidden && Date.now() - new Date(row.date) <= 7 * 86400000;
      return `<article class="coupon ${row.coupon.used ? 'used' : ''}"><div class="coupon-top"><span class="eyebrow">${escape(product?.brand ?? '')}</span>${tab === 'usable' ? pill('D-' + left, left < 15 ? 'pending' : 'complete') : pill(labels[tab])}</div>
        <h2>${escape(productName(state, row.product))}</h2>${tab === 'canceled' ? `<p class="canceled-note">취소된 쿠폰입니다${row.reason ? ' · ' + escape(row.reason) : ''}</p>` : hidden && tab !== 'expired' ? reveal : code}
        <div class="coupon-foot"><small>~ ${showDate(row.coupon.expires)} · ${format(row.points)} P</small>${tab === 'usable' ? `<span class="coupon-actions">${canCancel ? action('취소', 'coupon-cancel', `data-id="${row.id}"`, 'text-btn muted-btn') : ''}${hidden ? '' : action('사용 완료', 'coupon-used', `data-id="${row.id}"`, 'text-btn')}</span>` : tab === 'used' ? action('되돌리기', 'coupon-unused', `data-id="${row.id}"`, 'text-btn') : tab === 'canceled' ? `<small>${row.points.toLocaleString('ko-KR')} P 환불</small>` : ''}</div></article>`;
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
        <p class="muted small">${state.server?.demo !== false ? '데모에서는 haneul@example.com, doyun@example.com 등에게 보낼 수 있어요. ' : ''}선물한 포인트는 되돌릴 수 없습니다.</p></form></section>
    <section class="panel invite-card big"><span class="eyebrow">친구 초대</span><h2>초대하고 함께 ${format(state.settings.referralBonus)} P 받기</h2><p class="muted small">친구가 가입할 때 아래 추천 코드를 입력하면 두 분 모두에게 포인트를 드려요.</p>
      <div class="code-box"><code>${me.referral}</code>${action('복사', 'copy', `data-value="${me.referral}"`, 'btn outline sm', 'copy')}</div>
      <p class="muted small">초대로 받은 포인트 <b>${format(visibleTransactions(state, me).filter(row => row.type === 'reward' && /추천/.test(row.memo ?? '')).reduce((s, r) => s + r.points, 0))} P</b></p></section></div>
    ${panel('선물 내역', table(state, history, me, { empty: '주고받은 선물이 없습니다.' }))}`;
}

export function activityFilters(ui, typeList) {
  return `<div class="filters"><label class="search-field">${icon('search', 18)}<span class="sr-only">검색</span><input type="search" data-ui="q" value="${escape(ui.q ?? '')}" placeholder="거래번호, 내용 검색"></label>
    <select data-ui="type" aria-label="유형"><option value="">전체 유형</option>${typeList.map(t => `<option value="${t}" ${ui.type === t ? 'selected' : ''}>${types[t]}</option>`).join('')}</select>
    <select data-ui="status" aria-label="상태"><option value="">전체 상태</option>${[['pending', '처리 대기'], ['processing', '이체 중'], ['complete', '완료'], ['rejected', '반려'], ['canceled', '취소']].map(([v, l]) => `<option value="${v}" ${ui.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
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
    return `<article><div class="ticket-head"><div>${pill(escape(item.category))} ${item.transaction ? `<small>${escape(item.transaction)}</small>` : ''}</div>${pill(item.status === 'answered' ? '답변 완료' : '답변 대기', item.status === 'answered' ? 'complete' : 'pending')}</div>
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
      <div><label for="ticket-transaction">관련 거래 <small class="muted">(선택)</small></label><select name="transaction" id="ticket-transaction"><option value="">선택 안 함</option>${visibleTransactions(state, me).slice(0, 30).map(row => `<option value="${escape(row.id)}">${escape(row.id)} · ${types[row.type]}</option>`).join('')}</select></div></div>
      <label for="ticket-text">문의 내용</label><textarea id="ticket-text" name="message" maxlength="500" rows="5" required placeholder="문의하실 내용을 자세히 적어 주세요."></textarea>
      <button class="btn primary" type="submit">문의 등록 ${icon('send', 16)}</button></form></section>
    <section class="panel contact-card"><span class="feature-icon tone-1">${icon('help', 24)}</span><h2>고객센터 1588-0000</h2><p class="muted small">평일 10:00 ~ 18:00 (점심 12:00 ~ 13:00)<br>주말·공휴일 휴무 · 1:1 문의는 24시간 접수</p></section></div>
    ${panel('내 문의 내역', list)}
    ${panel('자주 묻는 질문', faqList(faqFor(state.settings)))}`;
}

export function profilePage(state, me) {
  const isUser = me.role === 'user';
  return `<div class="dash-grid two-one">
    <section class="panel profile-panel"><div class="profile-current">${avatar(me, 'profile-avatar')}<div><h2>${escape(me.name)}</h2><p>${escape(me.email)} · ${providerName(me.provider)} 가입</p>
      <div class="profile-actions"><label class="btn outline sm" for="profile-photo">${icon('edit', 16)} 사진 올리기</label><input class="sr-only" id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp">
      ${me.photo || me.photoUrl ? action('사진 삭제', 'remove-photo', '', 'text-btn') : ''}</div><p class="muted small">JPG·PNG·WebP, 8MB 이하. 직접 올린 사진이 캐릭터보다 우선 표시됩니다.</p></div></div>
      <div class="profile-character"><img src="./assets/animal-${animalIndex(me) + 1}.jpg" alt="" loading="lazy"><div><strong>내 캐릭터 · ${animals[animalIndex(me)]}</strong><small>가입할 때 무작위로 정해진 캐릭터예요. 사진을 올리면 사진이 먼저 보이고, 사진을 삭제하면 다시 이 캐릭터가 표시됩니다.</small></div>${me.photo || me.photoUrl ? pill('사진 사용 중', 'complete') : pill('캐릭터 사용 중')}</div>
    </section>
    <div class="side-stack">
      <section class="panel"><h2>기본 정보</h2><form class="stack" data-form="profile"><label for="profile-name">표시 이름</label><input id="profile-name" name="name" required maxlength="24" value="${escape(me.name)}">
        <label for="profile-phone">연락처</label><input id="profile-phone" name="phone" inputmode="tel" maxlength="20" value="${escape(me.phone ?? '')}">
        <label for="profile-email">이메일</label><input id="profile-email" value="${escape(me.email)}" disabled>
        ${isUser && (me.bank || me.bankRequest) ? '<p class="muted small">출금 계좌를 등록해 이름은 바꿀 수 없습니다.</p>' : ''}
        <button class="btn primary sm" type="submit">저장</button></form></section>
      ${isUser ? `<section class="panel"><h2>알림 설정</h2><form class="stack" data-form="notify">${[['email', '이메일 알림'], ['sms', '문자 알림'], ['marketing', '이벤트·혜택 수신']].map(([k, l]) => `<label class="switch"><input type="checkbox" name="${k}" ${me.notify?.[k] ? 'checked' : ''} data-autosubmit><i></i>${l}</label>`).join('')}</form></section>
      <section class="panel"><h2>출금 계좌</h2>${me.bank ? `<p><b>${escape(me.bank.bank)}</b> ${maskAccount(me.bank.number)} ${pill('인증', 'complete')}</p>` : '<p class="muted small">등록된 계좌가 없습니다.</p>'}${button(me.bank ? '계좌 관리' : '계좌 등록', '#app/user/withdrawal', 'text-btn', 'chevron')}</section>` : ''}
      <section class="panel"><h2>로그인 · 보안</h2><p class="muted small">가입 방법 <b>${providerName(me.provider)}</b>${me.lastLogin ? ' · 최근 로그인 ' + showTime(me.lastLogin) : ''}</p>
        ${me.password ? `<form class="stack" data-form="password"><label for="pw-now">현재 비밀번호</label><input id="pw-now" name="before" type="password" autocomplete="current-password" required><label for="pw-new">새 비밀번호</label><input id="pw-new" name="after" type="password" autocomplete="new-password" required placeholder="영문+숫자 8자 이상"><button class="btn outline sm" type="submit">비밀번호 변경</button></form>` : `<p class="muted small">${escape(providers[me.provider]?.name ?? '')} 계정으로 로그인합니다.</p>`}</section>
      ${!isUser && me.password ? totpPanel(state, me) : ''}
      ${isUser ? deletePanel(state, me) : ''}
    </div></div>`;
}

// 운영진 2단계 인증 (Google Authenticator·Microsoft Authenticator 등 OTP 앱)
function totpPanel(state, me) {
  const live = state.server?.mode === 'server';
  return `<section class="panel"><div class="panel-head"><h2>2단계 인증</h2>${pill(me.totp ? '사용 중' : '꺼짐', me.totp ? 'complete' : 'pending')}</div>
    ${!live ? '<p class="muted small">서버를 실행한 환경(npm run dev)에서 설정할 수 있습니다.</p>'
      : me.totp ? `<p class="muted small">로그인할 때 비밀번호와 함께 인증 앱의 6자리 코드를 입력합니다.</p><form class="stack" data-form="totp-disable"><label for="totp-off">인증 앱 코드</label><input id="totp-off" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button class="btn outline sm" type="submit">2단계 인증 끄기</button></form>`
      : `<p class="muted small">비밀번호가 유출되어도 계정을 지킬 수 있도록 인증 앱 코드를 함께 확인합니다. ${me.role === 'admin' ? '<b>최고 관리자는 반드시 켜 두세요.</b>' : ''}</p>${action('2단계 인증 설정', 'totp-setup', '', 'btn primary sm', 'shield')}`}</section>`;
}
function deletePanel(state, me) {
  const left = balances(state, me.id).available;
  return `<details class="panel danger-zone"><summary>회원 탈퇴</summary>
    <p class="muted small">탈퇴하면 이름·이메일·연락처·계좌·웹하드 연결 정보가 즉시 파기되고 다시 되돌릴 수 없습니다. 거래 기록은 관련 법령에 따라 일정 기간 익명으로 보관됩니다.${left > 0 ? ` <b>남은 ${format(left)} P는 소멸됩니다.</b> 출금하거나 쿠폰으로 사용한 뒤 탈퇴해 주세요.` : ''}</p>
    <form class="stack" data-form="delete-account">${me.password ? '<label for="del-pw">비밀번호 확인</label><input id="del-pw" name="password" type="password" autocomplete="current-password" required>' : `<label for="del-confirm">확인을 위해 <b>탈퇴</b>를 입력하세요</label><input id="del-confirm" name="confirm" required>`}
      <label class="check"><input type="checkbox" name="agree" required> 안내 내용을 확인했으며 탈퇴에 동의합니다.</label>
      <button class="btn danger sm" type="submit">탈퇴하기</button></form></details>`;
}

export function notificationList(state, me, limit = 30) {
  const list = notificationsFor(state, me).slice(0, limit);
  return list.length ? `<ul class="notice-list">${list.map(item => `<li class="${item.read ? '' : 'unread'}"><a href="#${item.link}" data-action="close">${icon('bell', 16)}<span>${escape(item.text)}<small>${showTime(item.date)}</small></span></a></li>`).join('')}</ul>` : blank('새 알림이 없습니다.', 'bell');
}

function benefitsPage(state, me) {
  const level = grade(state, me.id);
  const events = activeEvents(state);
  const rewards = visibleTransactions(state, me).filter(row => row.status === 'complete' && ['reward', 'attendance'].includes(row.type));
  const sum = test => rewards.filter(test).reduce((s, row) => s + row.points, 0);
  const s = state.settings;
  return `<section class="panel grade-hero"><div class="panel-head"><h2>내 등급</h2><span class="grade-badge" style="--c:${level.color}">${icon('trophy', 15)} ${level.name}</span></div>
      <p class="grade-line"><strong>${format(level.exchanged)} P</strong> 누적 교환</p>${progress(level.progress, '다음 등급까지 진행률')}
      <p class="muted small">${level.next ? `<b>${level.next.name}</b>까지 ${format(level.next.min - level.exchanged)} P 남았어요. 교환이 승인될 때마다 누적됩니다.` : '최고 등급입니다. 출금 수수료가 무료예요!'}</p>
      <div class="table-scroll"><table><thead><tr><th>등급</th><th class="numeric">누적 교환 기준</th><th class="numeric">출금 수수료</th><th>상태</th></tr></thead><tbody>${grades.map(g => `<tr class="${g.id === level.id ? 'row-on' : ''}"><td><span class="grade-badge" style="--c:${g.color}">${g.name}</span></td><td class="numeric">${format(g.min)} P 이상</td><td class="numeric">${g.feeRate ? format(Math.round(s.fee * g.feeRate)) + ' P' : '무료'}</td><td>${g.id === level.id ? pill('현재 등급', 'complete') : g.min > level.exchanged ? `<small class="muted">${format(g.min - level.exchanged)} P 남음</small>` : pill('달성')}</td></tr>`).join('')}</tbody></table></div></section>
    ${panel('진행 중인 이벤트', events.length ? `<div class="card-grid event-grid">${events.map(event => `<article class="event-card"><span class="feature-icon tone-3">${icon('megaphone', 22)}</span><div><h3>${escape(event.title)}</h3><p class="muted small">${escape(state.partners.find(p => p.id === event.partner)?.name ?? '')} · ${event.firstOnly ? '첫 교환' : '모든 교환'} ${event.rate}% 추가 적립${event.until ? ` · ~${event.until.slice(5).replace('-', '.')}` : ''}</p></div>${button('교환하러 가기', '#app/user/exchange', 'btn outline sm', 'arrow')}</article>`).join('')}</div>` : blank('진행 중인 이벤트가 없습니다. 새 이벤트가 열리면 알림으로 알려 드릴게요.', 'megaphone'))}
    <div class="dash-grid two-one">
      <section class="panel"><h2>포인트 모으는 방법</h2><ul class="integration-list">
        <li><span class="feature-icon tone-0">${icon('exchange', 20)}</span><div><strong>웹하드 포인트 교환</strong><small>제휴 웹하드 포인트를 스마일 포인트로 교환 · 등급도 함께 올라요</small></div>${button('교환', '#app/user/exchange', 'text-btn', 'chevron')}</li>
        <li><span class="feature-icon tone-3">${icon('calendar', 20)}</span><div><strong>출석체크 ${format(s.attendancePoints)} P</strong><small>7일 연속 출석하면 보너스 ${format(s.attendanceBonus)} P</small></div>${button('출석', '#app/user/attendance', 'text-btn', 'chevron')}</li>
        <li><span class="feature-icon tone-1">${icon('users', 20)}</span><div><strong>친구 초대 ${format(s.referralBonus)} P</strong><small>친구가 첫 교환을 완료하면 적립 · 내 코드 <code>${me.referral}</code></small></div>${action('코드 복사', 'copy', `data-value="${me.referral}"`, 'text-btn')}</li>
        <li><span class="feature-icon tone-2">${icon('megaphone', 20)}</span><div><strong>교환 이벤트</strong><small>이벤트 기간에 교환하면 승인과 함께 추가 포인트 자동 적립</small></div></li></ul></section>
      <section class="panel"><h2>내가 받은 혜택</h2><ul class="fee-list"><li><span>출석 적립</span><b>${format(sum(row => row.type === 'attendance' || /출석/.test(row.memo ?? '')))} P</b></li><li><span>친구 초대</span><b>${format(sum(row => /추천/.test(row.memo ?? '')))} P</b></li><li><span>가입·이벤트</span><b>${format(sum(row => row.type === 'reward' && !/추천|출석/.test(row.memo ?? '')))} P</b></li><li class="on"><span>혜택 합계</span><b>${format(sum(() => true))} P</b></li></ul></section>
    </div>`;
}

function alertsPage(state, me) {
  const all = notificationsFor(state, me);
  const unread = all.filter(item => !item.read).length;
  return `<div class="summary-strip"><div><span>전체 알림</span><strong>${all.length}건</strong></div><div><span>읽지 않음</span><strong class="${unread ? 'minus' : ''}">${unread}건</strong></div></div>
    ${panel('알림', notificationList(state, me, 100), unread ? action('모두 읽음', 'read-all', '', 'btn outline sm', 'check') : '')}
    <p class="muted small">알림 수신 방법(이메일·문자)은 ${button('내 프로필', '#app/user/profile', 'text-btn', '')}에서 바꿀 수 있습니다.</p>`;
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
    case 'benefits': return benefitsPage(state, me);
    case 'alerts': return alertsPage(state, me);
    case 'activity': return activityPage(state, me, ui);
    case 'support': return supportPage(state, me, false, ui);
    case 'profile': return profilePage(state, me);
    default: return '';
  }
}
