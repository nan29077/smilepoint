import { escape, format, icon } from '../catalog.js';
import { account, kstDay, series, visibleTransactions } from '../state.js';
import { activityFilters, applyFilters } from './user.js';
import { action, ago, avatar, barChart, blank, button, donut, metric, money, panel, pill, showTime, table, trend } from './ui.js';

export const partnerMenu = [
  ['업무', [['overview', 'home', '자사 개요'], ['requests', 'exchange', '교환 요청'], ['activity', 'file', '거래 내역']]],
  ['정산·연동', [['settlement', 'chart', '정산 및 대사'], ['integration', 'key', 'API · 연동'], ['policy', 'settings', '교환 정책']]],
];
export const partnerDescriptions = {
  requests: '자사 회원의 교환 신청을 확인하고 승인 또는 반려하세요. 여러 건을 한 번에 처리할 수 있습니다.',
  activity: '자사 교환 거래 전체를 기간·상태별로 조회하세요.',
  settlement: '일자별 교환 완료 내역과 정산 예정 금액을 대사하세요.',
  integration: 'API 키, 웹훅, 허용 IP와 최근 API 호출 기록을 관리하세요.',
  policy: '현재 적용 중인 교환 비율과 신청 조건을 확인하세요.',
  profile: '담당자 정보와 프로필 캐릭터를 관리하세요.',
};

const elapsed = rows => {
  const done = rows.filter(row => row.status !== 'pending' && row.updated);
  if (!done.length) return '—';
  const minutes = done.reduce((sum, row) => sum + (new Date(row.updated) - new Date(row.date)) / 60000, 0) / done.length;
  return minutes < 60 ? Math.round(minutes) + '분' : (minutes / 60).toFixed(1) + '시간';
};

export function pendingQueue(state, viewer, rows, { showUser = true } = {}) {
  const pending = rows.filter(row => row.status === 'pending');
  return `<section class="panel" data-bulk><div class="panel-head"><h2>처리 대기 ${pill(pending.length + '건', 'pending')}</h2>
      ${pending.length ? `<div class="bulk-actions"><span class="muted small" data-selected-count>0건 선택</span>${action('선택 승인', 'bulk', 'data-value="complete"', 'btn primary sm', 'check')}${action('선택 반려', 'bulk', 'data-value="rejected"', 'btn outline sm', 'close')}</div>` : ''}</div>
      ${table(state, pending, viewer, { select: true, showUser, empty: '처리할 신청이 없습니다. 👏' })}</section>`;
}

function overview(state, me, partner) {
  const rows = visibleTransactions(state, me);
  const today = kstDay();
  const pending = rows.filter(row => row.status === 'pending');
  const approvedToday = rows.filter(row => row.status === 'complete' && row.updated && kstDay(row.updated) === today);
  const daily = series(rows.filter(row => row.status !== 'canceled'), 14, row => row.source);
  const thisWeek = daily.slice(7).reduce((s, d) => s + d.value, 0), lastWeek = daily.slice(0, 7).reduce((s, d) => s + d.value, 0);
  const members = new Set(rows.map(row => row.userId)).size;
  const count = status => rows.filter(row => row.status === status).length;
  return `<section class="dash-banner partner-banner"><div><span class="eyebrow">웹하드 관리자 · ${partner.name}</span>
      <h1>${escape(me.name)}님, 오늘 처리할 교환이 ${pending.length}건 있어요.</h1><p>승인하면 회원에게 즉시 적립 알림이 발송됩니다.</p>
      <div class="banner-actions">${button('교환 요청 처리', '#app/partner/requests', 'btn lime sm', 'exchange')}${button('정산 보기', '#app/partner/settlement', 'btn ghost sm', 'chart')}</div></div>
      <span class="partner-logo ${partner.color} xl">${partner.initials}</span></section>
    <div class="card-grid metrics four">
      ${metric('처리 대기', pending.length + '건', 'clock', `대기 포인트 ${format(pending.reduce((s, r) => s + r.source, 0))} P`, 2)}
      ${metric('오늘 승인', approvedToday.length + '건', 'check', `${format(approvedToday.reduce((s, r) => s + r.source, 0))} P 차감`, 0)}
      ${metric('최근 7일 신청액', format(thisWeek) + ' P', 'activity', '자사 포인트 기준', 1, trend(thisWeek, lastWeek))}
      ${metric('평균 처리 시간', elapsed(rows), 'refresh', `교환 회원 ${members}명`, 3)}
    </div>
    <div class="dash-grid two-one">
      ${panel('최근 14일 교환 신청액', barChart(daily, { tone: 'blue' }))}
      ${panel('처리 현황', donut([{ label: '완료', value: count('complete'), color: '#18563e' }, { label: '대기', value: count('pending'), color: '#f0a43a' }, { label: '반려', value: count('rejected'), color: '#d65a5a' }, { label: '취소', value: count('canceled'), color: '#a9b6af' }], `<strong>${rows.length}</strong><small>전체 건</small>`))}
    </div>
    <div class="dash-grid two-one">
      ${pendingQueue(state, me, rows)}
      <section class="panel api-status"><div class="panel-head"><h2>연동 상태</h2>${pill('정상', 'complete')}</div>
        <ul class="status-list"><li><i class="ok"></i>잔액 조회 API<small>응답 120ms</small></li><li><i class="ok"></i>교환 차감 API<small>응답 180ms</small></li><li><i class="ok"></i>웹훅 수신<small>${rows[0] ? ago(rows[0].date) : '—'}</small></li></ul>
        ${button('API · 연동 관리', '#app/partner/integration', 'text-btn', 'chevron')}</section>
    </div>`;
}

export function settlementTable(state, rows, partners, days) {
  const since = Date.now() - days * 86400000;
  const done = rows.filter(row => row.type === 'exchange' && row.status === 'complete' && new Date(row.updated ?? row.date) >= since);
  const byPartner = partners.map(item => {
    const list = done.filter(row => row.partner === item.id);
    const source = list.reduce((s, r) => s + r.source, 0), points = list.reduce((s, r) => s + r.points, 0);
    return { item, count: list.length, source, points };
  });
  const total = byPartner.reduce((acc, row) => ({ count: acc.count + row.count, source: acc.source + row.source, points: acc.points + row.points }), { count: 0, source: 0, points: 0 });
  const daily = series(done, Math.min(days, 14), row => row.points).reverse();
  return `<div class="summary-strip"><div><span>정산 기간</span><strong>최근 ${days}일</strong></div><div><span>완료 건수</span><strong>${total.count}건</strong></div><div><span>제휴 포인트 차감</span><strong>${format(total.source)} P</strong></div><div><span>스마일 포인트 지급</span><strong>${format(total.points)} P</strong></div><div><span>정산 예정 금액</span><strong>${format(total.points)}원</strong></div></div>
    <section class="panel" data-csv><div class="panel-head"><h2>제휴사별 대사</h2>${action('CSV', 'csv', 'data-name="정산대사"', 'btn outline sm', 'download')}</div>
      <div class="table-scroll"><table><thead><tr><th>제휴사</th><th class="numeric">완료 건</th><th class="numeric">제휴 포인트 차감</th><th class="numeric">스마일 포인트 지급</th><th class="numeric">정산 금액(원)</th><th>대사 결과</th></tr></thead>
      <tbody>${byPartner.map(row => `<tr><td><strong>${row.item.name}</strong><small>${row.item.divisor}:1</small></td><td class="numeric">${row.count}</td><td class="numeric">${format(row.source)}</td><td class="numeric">${format(row.points)}</td><td class="numeric">${format(row.points)}</td><td>${pill('일치', 'complete')}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel" data-csv><div class="panel-head"><h2>일자별 지급 내역</h2>${action('CSV', 'csv', 'data-name="일자별정산"', 'btn outline sm', 'download')}</div>
      <div class="table-scroll"><table><thead><tr><th>일자</th><th class="numeric">스마일 포인트 지급</th><th>상태</th></tr></thead><tbody>${daily.map(d => `<tr><td>${d.key}</td><td class="numeric">${format(d.value)}</td><td>${d.value ? pill(d.key === kstDay() ? '집계 중' : '정산 확정', d.key === kstDay() ? 'pending' : 'complete') : '—'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function integration(state, me, partner, ui) {
  const rows = visibleTransactions(state, me).slice(0, 12);
  const key = ui.reveal ? partner.apiKey : partner.apiKey.slice(0, 12) + '•'.repeat(16) + partner.apiKey.slice(-4);
  const logs = rows.flatMap(row => [
    { at: row.date, method: 'POST', path: '/v1/exchanges', code: 201, ms: 140 + (row.source % 90), id: row.id },
    ...(row.updated ? [{ at: row.updated, method: 'POST', path: `/v1/exchanges/${row.id}/${row.status === 'complete' ? 'approve' : 'reject'}`, code: 200, ms: 90 + (row.points % 70), id: row.id }] : []),
  ]).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return `<div class="dash-grid two-one">
    <section class="panel"><div class="panel-head"><h2>API 키</h2>${pill('운영 키', 'complete')}</div>
      <div class="code-box wide"><code>${key}</code>${action(ui.reveal ? '숨기기' : '보기', 'ui', `data-key="reveal" data-value="${ui.reveal ? '' : '1'}"`, 'btn outline sm', 'eye')}${action('복사', 'copy', `data-value="${partner.apiKey}"`, 'btn outline sm', 'copy')}</div>
      <p class="muted small">키는 서버 간 통신에만 사용하고 외부에 노출하지 마세요. 재발급하면 이전 키는 즉시 폐기됩니다.</p>
      ${action('키 재발급', 'regen-key', '', 'btn outline sm', 'refresh')}
      <hr><form class="stack" data-form="webhook"><label for="webhook">웹훅 수신 URL</label><div class="inline-field"><input id="webhook" name="url" value="${escape(partner.webhook)}" required><button class="btn primary sm" type="submit">저장</button></div></form>
      <p class="muted small">허용 IP <code>${partner.ip}</code> · 이벤트 <code>exchange.requested</code> <code>exchange.canceled</code></p></section>
    <section class="panel"><h2>API 명세 요약</h2><ul class="endpoint-list">
      <li><b class="get">GET</b><code>/v1/members/{id}/balance</code><small>회원 교환 가능 잔액 조회</small></li>
      <li><b class="post">POST</b><code>/v1/exchanges</code><small>교환 신청 수신 · 포인트 홀드</small></li>
      <li><b class="post">POST</b><code>/v1/exchanges/{id}/approve</code><small>승인 · 포인트 차감 확정</small></li>
      <li><b class="post">POST</b><code>/v1/exchanges/{id}/reject</code><small>반려 · 홀드 해제</small></li>
      <li><b class="get">GET</b><code>/v1/settlements?date=</code><small>일자별 대사 자료</small></li></ul>
      <p class="muted small">모든 요청은 <code>X-Api-Key</code>와 HMAC 서명 헤더로 인증합니다.</p></section></div>
    <section class="panel"><div class="panel-head"><h2>최근 API 호출</h2>${pill('모의 로그', 'pending')}</div>
      ${logs.length ? `<div class="table-scroll"><table><thead><tr><th>시각</th><th>요청</th><th>거래</th><th>응답</th><th class="numeric">지연</th></tr></thead><tbody>${logs.map(log => `<tr><td>${showTime(log.at)}</td><td><code>${log.method} ${log.path}</code></td><td>${log.id}</td><td>${pill(log.code + ' OK', 'complete')}</td><td class="numeric">${log.ms}ms</td></tr>`).join('')}</tbody></table></div>` : blank('호출 기록이 없습니다.')}</section>`;
}

function policy(state, partner) {
  return `<div class="dash-grid two-one"><section class="panel"><div class="panel-head"><h2>${partner.name} 교환 정책</h2>${pill(partner.active ? '운영 중' : '일시 중지', partner.active ? 'complete' : 'rejected')}</div>
    <div class="form-summary"><div><span>교환 비율</span><strong>${partner.divisor} P → 1 스마일 P</strong></div><div><span>최소 신청 금액</span><strong>${format(partner.min)} P</strong></div><div><span>교환 대상</span><strong>${partner.type}</strong></div><div><span>안내 승인 시간</span><strong>${partner.approval}</strong></div><div><span>정산 기준</span><strong>스마일 1 P = 1원 · 월 2회</strong></div></div>
    <p class="muted small">정책 변경은 계약 조건에 따라 최고 관리자가 반영합니다. 변경이 필요하면 운영팀(partner@smilepoint.kr)에 요청해 주세요.</p></section>
    <section class="panel"><h2>교환 예시</h2><ul class="fee-list">${[10000, 50000, 100000].map(v => `<li><span>${format(v)} P 교환</span><b>${format(Math.floor(v / partner.divisor))} 스마일 P</b></li>`).join('')}</ul></section></div>`;
}

export function partnerPage(state, me, page, ui, profilePage) {
  const partner = state.partners.find(item => item.id === me.partnerId);
  const rows = visibleTransactions(state, me);
  switch (page) {
    case 'overview': return overview(state, me, partner);
    case 'requests': return `${pendingQueue(state, me, rows)}${panel('처리 내역', table(state, rows.filter(row => row.status !== 'pending').slice(0, 30), me, { showUser: true, showUpdate: true }))}`;
    case 'activity': return `${activityFilters(ui, ['exchange'])}<section class="panel" data-csv>${table(state, applyFilters(state, rows, ui), me, { showUser: true, showUpdate: true })}</section>`;
    case 'settlement': return `<div class="tabs">${[7, 14, 30].map(d => `<button type="button" class="tab ${(Number(ui.days) || 14) === d ? 'active' : ''}" data-action="ui" data-key="days" data-value="${d}">최근 ${d}일</button>`).join('')}</div>${settlementTable(state, rows, [partner], Number(ui.days) || 14)}`;
    case 'integration': return integration(state, me, partner, ui);
    case 'policy': return policy(state, partner);
    case 'profile': return profilePage(state, me);
    default: return '';
  }
}

export const memberCell = (state, id) => { const a = account(state, id); return a ? `${avatar(a, 'xs')} ${escape(a.name)}` : '—'; };
export { money };
