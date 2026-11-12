import { escape, format, icon } from '../catalog.js';
import { account, kstDay, series, settlementStatus, visibleTransactions } from '../state.js';
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
      ${apiStatus(state, partner)}
        ${button('API · 연동 관리', '#app/partner/integration', 'text-btn', 'chevron')}</section>
    </div>`;
}

const settleLabel = { match: ['일치', 'complete'], mismatch: ['불일치', 'rejected'], unconfirmed: ['미확인', 'pending'], empty: ['거래 없음', 'canceled'] };
function apiStatus(state, partner) {
  const logs = (state.apiLogs ?? []).filter(item => item.partner === partner.id);
  const api = logs.filter(item => item.source === 'partner-api'), hooks = logs.filter(item => item.source === 'webhook');
  const avg = list => list.length ? Math.round(list.slice(0, 20).reduce((s, l) => s + (l.ms ?? 0), 0) / Math.min(list.length, 20)) + 'ms' : '';
  const ok = list => list.length && list[0].status >= 200 && list[0].status < 300;
  const line = (label, list) => `<li><i class="${!list.length ? 'idle' : ok(list) ? 'ok' : 'bad'}"></i>${label}<small>${list.length ? `${ok(list) ? '정상' : '실패'} · 평균 ${avg(list)} · ${ago(list[0].date)}` : '기록 없음'}</small></li>`;
  const overall = !api.length && !hooks.length ? pill('기록 없음') : (api.length && !ok(api)) || (hooks.length && !ok(hooks)) ? pill('확인 필요', 'pending') : pill('정상', 'complete');
  return `<section class="panel api-status"><div class="panel-head"><h2>연동 상태</h2>${overall}</div>
        <ul class="status-list">${line('제휴사 → 스마일 API 호출', api)}${line('스마일 → 제휴사 웹훅', hooks)}</ul>
`;
}

export function settlementTable(state, partners, days, { canConfirm = false } = {}) {
  const dates = Array.from({ length: days }, (_, i) => kstDay(Date.now() - i * 86400000));
  const cells = partners.flatMap(partner => dates.map(date => ({ partner, date, ...settlementStatus(state, partner.id, date) })));
  const active = cells.filter(cell => cell.status !== 'empty' || cell.theirs);
  const byPartner = partners.map(partner => {
    const list = cells.filter(cell => cell.partner.id === partner.id);
    return { partner, count: list.reduce((s, c) => s + c.ours.count, 0), source: list.reduce((s, c) => s + c.ours.amount, 0), points: list.reduce((s, c) => s + c.ours.points, 0),
      mismatch: list.filter(c => c.status === 'mismatch').length, unconfirmed: list.filter(c => c.status === 'unconfirmed').length };
  });
  const total = byPartner.reduce((acc, row) => ({ count: acc.count + row.count, source: acc.source + row.source, points: acc.points + row.points, mismatch: acc.mismatch + row.mismatch }), { count: 0, source: 0, points: 0, mismatch: 0 });
  const result = row => row.mismatch ? pill(`불일치 ${row.mismatch}일`, 'rejected') : row.unconfirmed ? pill(`미확인 ${row.unconfirmed}일`, 'pending') : pill(row.count ? '일치' : '거래 없음', row.count ? 'complete' : 'canceled');
  return `<div class="summary-strip"><div><span>정산 기간</span><strong>최근 ${days}일</strong></div><div><span>완료 건수</span><strong>${total.count}건</strong></div><div><span>제휴 포인트 차감</span><strong>${format(total.source)} P</strong></div><div><span>정산 예정 금액</span><strong>${format(total.points)}원</strong></div><div><span>불일치</span><strong class="${total.mismatch ? 'minus' : ''}">${total.mismatch}일</strong></div></div>
    <section class="panel" data-csv><div class="panel-head"><h2>제휴사별 대사</h2>${action('CSV', 'csv', 'data-name="정산대사"', 'btn outline sm', 'download')}</div>
      <div class="table-scroll"><table><thead><tr><th>제휴사</th><th class="numeric">완료 건</th><th class="numeric">제휴 포인트 차감</th><th class="numeric">스마일 포인트 지급</th><th class="numeric">정산 금액(원)</th><th>대사 결과</th></tr></thead>
      <tbody>${byPartner.map(row => `<tr><td><strong>${escape(row.partner.name)}</strong><small>${row.partner.divisor}:1</small></td><td class="numeric">${row.count}</td><td class="numeric">${format(row.source)}</td><td class="numeric">${format(row.points)}</td><td class="numeric">${format(row.points)}</td><td>${result(row)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel" data-csv><div class="panel-head"><h2>일자별 대사</h2>${action('CSV', 'csv', 'data-name="일자별정산"', 'btn outline sm', 'download')}</div>
      <p class="muted small">제휴사가 자사 장부의 일자별 차감 합계를 확인(화면 또는 <code>POST /api/v1/settlements/{날짜}</code>)하면 스마일 포인트 원장과 비교합니다.</p>
      ${active.length ? `<div class="table-scroll"><table><thead><tr><th>일자</th>${partners.length > 1 ? '<th>제휴사</th>' : ''}<th class="numeric">우리 집계</th><th class="numeric">제휴사 확인</th><th>결과</th>${canConfirm ? '<th><span class="sr-only">확인</span></th>' : ''}</tr></thead><tbody>${active.map(cell => `<tr>
        <td>${cell.date}</td>${partners.length > 1 ? `<td>${escape(cell.partner.name)}</td>` : ''}<td class="numeric">${cell.ours.count}건 · ${format(cell.ours.amount)} P</td>
        <td class="numeric">${cell.theirs ? `${cell.theirs.count}건 · ${format(cell.theirs.amount)} P` : '—'}</td>
        <td>${pill(settleLabel[cell.status][0] + (cell.status === 'mismatch' ? ` (${cell.diff > 0 ? '+' : ''}${format(cell.diff)} P)` : ''), settleLabel[cell.status][1])}</td>
        ${canConfirm ? `<td>${cell.date === kstDay() ? '<small class="muted">집계 중</small>' : action(cell.theirs ? '다시 확인' : '확인', 'settle', `data-id="${cell.date}" data-count="${cell.ours.count}" data-amount="${cell.ours.amount}"`, 'text-btn')}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : blank('대사할 거래가 없습니다.')}</section>`;
}

function integration(state, me, partner, ui) {
  const key = ui.reveal ? partner.apiKey : partner.apiKey.slice(0, 12) + '•'.repeat(16) + partner.apiKey.slice(-4);
  const logs = (state.apiLogs ?? []).filter(item => item.partner === partner.id).slice(0, 15);
  const hooks = (state.webhooks ?? []).filter(item => item.partner === partner.id).slice(0, 8);
  const live = state.server?.mode === 'server';
  const base = live ? (globalThis.location?.origin ?? '') : 'https://api.smilepoint.kr';
  const hookPill = h => pill({ delivered: '전송 완료', failed: '전송 실패', retry: '재시도 대기', queued: live ? '전송 대기' : '데모: 전송 안 함', skipped: '주소 없음' }[h.status] ?? h.status, { delivered: 'complete', failed: 'rejected', retry: 'pending', queued: 'pending' }[h.status] ?? 'canceled');
  return `<div class="notice-bar ${live ? 'ok' : ''}">${icon(live ? 'check' : 'alert', 18)}<span>${live ? `<b>서버 연결됨</b> 아래 API는 지금 이 서버(${escape(globalThis.location?.host ?? '')})에서 실제로 호출할 수 있습니다.` : '<b>데모 모드</b> 브라우저 저장소로 동작 중입니다. <code>npm run dev</code>로 서버를 실행하면 실제 API와 웹훅이 동작합니다.'}</span></div>
    <div class="dash-grid two-one">
    <section class="panel"><div class="panel-head"><h2>API 키</h2>${pill('운영 키', 'complete')}</div>
      <div class="code-box wide"><code>${key}</code>${action(ui.reveal ? '숨기기' : '보기', 'ui', `data-key="reveal" data-value="${ui.reveal ? '' : '1'}"`, 'btn outline sm', 'eye')}${action('복사', 'copy', `data-value="${partner.apiKey}"`, 'btn outline sm', 'copy')}</div>
      <p class="muted small">키는 서버 간 통신에만 사용하고 외부에 노출하지 마세요. 재발급하면 이전 키는 즉시 폐기됩니다.</p>
      ${action('키 재발급', 'regen-key', '', 'btn outline sm', 'refresh')}
      <hr><form class="stack" data-form="webhook"><label for="webhook">웹훅 수신 URL</label><div class="inline-field"><input id="webhook" name="url" value="${escape(partner.webhook)}" required placeholder="https://"><button class="btn primary sm" type="submit">저장</button></div></form>
      <div class="hook-actions">${action('웹훅 테스트 전송', 'test-webhook', '', 'btn outline sm', 'send')}<span class="muted small">서명 헤더 <code>X-SmilePoint-Signature: sha256=HMAC(API 키, 본문)</code></span></div></section>
    <section class="panel"><h2>API 명세</h2><ul class="endpoint-list">
      <li><b class="get">GET</b><code>/api/v1/exchanges?status=pending</code><small>자사 교환 신청 목록</small></li>
      <li><b class="post">POST</b><code>/api/v1/exchanges/{id}/approve</code><small>승인 · 회원 포인트 적립</small></li>
      <li><b class="post">POST</b><code>/api/v1/exchanges/{id}/reject</code><small>반려 · 본문 <code>{"reason":"사유"}</code></small></li>
      <li><b class="get">GET</b><code>/api/v1/settlements?date=YYYY-MM-DD</code><small>일자별 대사 자료</small></li>
      <li><b class="post">POST</b><code>/api/v1/settlements/{YYYY-MM-DD}</code><small>자사 합계 제출 <code>{"count":0,"amount":0}</code> → 일치/불일치</small></li></ul>
      <p class="muted small">웹훅 이벤트: <code>exchange.requested</code> <code>exchange.canceled</code> <code>ping</code> · 실패 시 30초 간격 최대 3회 재시도</p>
      <pre class="code-sample">curl -H "X-Api-Key: ${ui.reveal ? partner.apiKey : 'sp_live_…'}" \\
  "${base}/api/v1/exchanges?status=pending"</pre></section></div>
    <div class="dash-grid two-one">
    <section class="panel"><div class="panel-head"><h2>최근 API 호출</h2>${pill(live ? '실시간 기록' : '샘플 기록', live ? 'complete' : 'pending')}</div>
      ${logs.length ? `<div class="table-scroll"><table><thead><tr><th>시각</th><th>구분</th><th>요청</th><th>응답</th><th class="numeric">지연</th></tr></thead><tbody>${logs.map(log => `<tr><td>${showTime(log.date)}</td><td>${pill(log.source === 'webhook' ? '웹훅' : 'API', log.source === 'webhook' ? 'pending' : 'plain')}</td><td><code>${escape(log.method)} ${escape(log.path)}</code></td><td>${pill(log.status ? String(log.status) : '연결 실패', log.status >= 200 && log.status < 300 ? 'complete' : 'rejected')}</td><td class="numeric">${log.ms ?? '—'}ms</td></tr>`).join('')}</tbody></table></div>` : blank('호출 기록이 없습니다.')}</section>
    <section class="panel"><h2>웹훅 전송</h2>${hooks.length ? `<ul class="hook-list">${hooks.map(h => `<li><div><code>${escape(h.event)}</code><small>${showTime(h.date)} · ${h.attempts ?? 0}회 시도${h.error ? ' · ' + escape(h.error) : ''}</small></div>${hookPill(h)}</li>`).join('')}</ul>` : blank('전송 기록이 없습니다.', 'send')}</section></div>`;
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
    case 'settlement': return `<div class="tabs">${[7, 14, 30].map(d => `<button type="button" class="tab ${(Number(ui.days) || 14) === d ? 'active' : ''}" data-action="ui" data-key="days" data-value="${d}">최근 ${d}일</button>`).join('')}</div>${settlementTable(state, [partner], Number(ui.days) || 14, { canConfirm: true })}`;
    case 'integration': return integration(state, me, partner, ui);
    case 'policy': return policy(state, partner);
    case 'profile': return profilePage(state, me);
    default: return '';
  }
}

export const memberCell = (state, id) => { const a = account(state, id); return a ? `${avatar(a, 'xs')} ${escape(a.name)}` : '—'; };
export { money };
