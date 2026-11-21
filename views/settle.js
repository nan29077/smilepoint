// 웹하드 정산서 화면 — 최고 관리자와 웹하드 관리자가 함께 사용한다.
import { escape, format, icon } from '../catalog.js';
import { account, kstDay, receivables, settleCycles, statementPeriods, statementRows } from '../state.js';
import { action, blank, panel, pill, showDate, showTime } from './ui.js?v=coin-1120';

const won = value => format(value) + '원';

function statusOf(period, today) {
  const record = period.record;
  if (!record) return period.current ? pill('진행 중') : period.live.count ? pill('발행 대기', 'pending') : pill('거래 없음');
  if (record.status === 'paid') return pill('입금 완료', 'complete');
  return record.due < today ? pill('입금 기한 지남', 'rejected') : pill('입금 대기', 'processing');
}
function partnerCheck(record) {
  if (!record) return '<span class="muted">—</span>';
  if (record.dispute) return `${pill('이의 제기', 'rejected')}<small class="cell-note">${escape(record.dispute.message)}</small>`;
  if (record.ack) return `${pill('확인 완료', 'complete')}<small class="cell-note">${showTime(record.ack.at)}</small>`;
  return '<span class="muted small">확인 전</span>';
}

export function statementsPage(state, viewer, ui = {}) {
  const isAdmin = viewer.role === 'admin';
  const partners = isAdmin ? state.partners : state.partners.filter(p => p.id === viewer.partnerId);
  if (!partners.length) return blank('제휴사가 없습니다.', 'layers');
  const partner = partners.find(p => p.id === ui.sp) ?? partners[0];
  const today = kstDay();
  const total = receivables(state, isAdmin ? undefined : partner.id);
  const mine = receivables(state, partner.id);
  const periods = statementPeriods(state, partner.id, 12);
  const unissued = periods.filter(p => !p.current && !p.record && p.live.count);
  const rows = periods.map(period => {
    const record = period.record;
    const key = `${partner.id}:${period.from}`;
    const buttons = [];
    if (isAdmin && !record && !period.current && period.live.count) buttons.push(action('정산서 발행', 'statement-issue', `data-id="${key}"`, 'btn primary sm'));
    if (isAdmin && record?.status === 'issued') buttons.push(action('입금 확인', 'statement-paid', `data-id="${escape(record.id)}"`, 'btn primary sm'), action('취소', 'statement-cancel', `data-id="${escape(record.id)}"`, 'btn outline sm'));
    if (!isAdmin && record && !record.ack) buttons.push(action('확인', 'statement-ack', `data-id="${escape(record.id)}"`, 'btn primary sm'), action('이의 제기', 'statement-dispute', `data-id="${escape(record.id)}"`, 'btn outline sm'));
    if (period.live.count || record) buttons.push(action('상세', 'statement', `data-id="${key}"`, 'text-btn'));
    const amount = record ? record.points : period.live.points;
    return `<tr><td><strong>${period.from} ~ ${period.to}</strong><small>${record ? escape(record.id) : period.current ? '집계 중' : '정산서 미발행'}</small></td>
      <td class="numeric">${format(record ? record.count : period.live.count)}건</td>
      <td class="numeric"><strong>${won(amount)}</strong>${period.changed ? `<small class="cell-note warn-text">발행 후 변동 · 현재 ${won(period.live.points)}</small>` : ''}${record?.status === 'paid' && record.paidAmount !== record.points ? `<small class="cell-note">입금 ${won(record.paidAmount)}${record.memo ? ' · ' + escape(record.memo) : ''}</small>` : ''}</td>
      <td class="numeric">${format(record ? record.source : period.live.source)} P</td>
      <td>${statusOf(period, today)}</td>
      <td>${record ? (record.status === 'paid' ? `<small>입금 ${showDate(record.paidAt)}</small>` : escape(record.due)) : '—'}</td>
      <td>${partnerCheck(record)}</td>
      <td><span class="row-actions">${buttons.join('')}</span></td></tr>`;
  }).join('');
  return `<div class="summary-strip"><div><span>${isAdmin ? '받을 정산금 (발행·입금 전)' : '입금 예정 정산금'}</span><strong class="${total.issued ? 'minus' : ''}">${won(total.issued)}</strong></div><div><span>발행 대기 (기간 종료)</span><strong>${won(total.unissued)}</strong></div><div><span>진행 중 기간 누적</span><strong>${won(total.current)}</strong></div><div><span>이번 달 입금 완료</span><strong>${won(total.paidThisMonth)}</strong></div></div>
    ${isAdmin ? `<div class="tabs">${partners.map(p => {
      const r = receivables(state, p.id);
      const due = (state.statements ?? []).some(s => s.partner === p.id && s.status === 'issued' && s.due < today);
      return `<button type="button" class="tab ${p.id === partner.id ? 'active' : ''}" data-action="ui" data-key="sp" data-value="${p.id}">${escape(p.name)} <b>${format(r.issued + r.unissued)}</b>${due ? ' ⚠' : ''}</button>`;
    }).join('')}</div>` : ''}
    ${unissued.length && isAdmin ? `<div class="notice-bar warn">${icon('alert', 18)}<span><b>${escape(partner.name)}</b> 기간이 끝났지만 발행하지 않은 정산이 ${unissued.length}건 (${won(unissued.reduce((s, p) => s + p.live.points, 0))}) 있습니다.</span></div>` : ''}
    <section class="panel" data-csv><div class="panel-head"><h2>${escape(partner.name)} 정산서</h2><span class="row-actions">${pill(settleCycles[partner.settleCycle ?? 'monthly'] ?? '월 1회')}${action('CSV', 'csv', `data-name="정산서_${escape(partner.name)}"`, 'btn outline sm', 'download')}</span></div>
      <p class="muted small">정산 금액 = 기간 안에 ${escape(partner.name)}이(가) 사용 승인한 스마일 포인트 합계 (1 P = 1원, 회수된 건 제외) · 입금 기한: 기간 종료 후 ${partner.settleDue ?? 10}일${isAdmin ? ' · 정산 주기와 기한은 제휴사 관리 > 정책 수정에서 바꿉니다.' : ''}</p>
      ${periods.length ? `<div class="table-scroll"><table><thead><tr><th>정산 기간</th><th class="numeric">건수</th><th class="numeric">정산 금액</th><th class="numeric">웹하드 차감</th><th>상태</th><th>입금 기한</th><th>웹하드 확인</th><th><span class="sr-only">처리</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : blank('아직 정산할 거래가 없습니다.', 'chart')}
    </section>
    <p class="muted small">기간 중 집계는 실시간으로 바뀝니다. 정산서를 발행하면 그 시점 금액으로 고정되고, 이후 회수 등으로 금액이 바뀌면 '발행 후 변동'으로 표시됩니다 (취소 후 다시 발행 가능).</p>
    ${isAdmin ? '' : `<p class="muted small">자사 서버에서는 <code>GET /api/v1/statements</code> 또는 웹훅 <code>settlement.issued</code>로 정산서를 받을 수 있습니다. 현재 미수 합계 ${won(mine.issued)}.</p>`}`;
}

export function statementDetail(state, viewer, key) {
  const [partnerId, from] = String(key).split(':');
  const partner = state.partners.find(p => p.id === partnerId);
  if (!partner) return blank('정산 정보를 찾을 수 없습니다.');
  const period = statementPeriods(state, partnerId, 24).find(p => p.from === from);
  if (!period) return blank('정산 기간을 찾을 수 없습니다.');
  const rows = statementRows(state, partnerId, period.from, period.to).sort((a, b) => (a.updated ?? a.date).localeCompare(b.updated ?? b.date));
  const record = period.record;
  return `<div class="form-summary"><div><span>제휴사</span><strong>${escape(partner.name)}</strong></div><div><span>기간</span><strong>${period.from} ~ ${period.to}</strong></div><div><span>정산서</span><strong>${record ? `${escape(record.id)} · ${showTime(record.issuedAt)} 발행` : period.current ? '진행 중' : '미발행'}</strong></div>${record ? `<div><span>발행 금액</span><strong>${won(record.points)} (${format(record.count)}건)</strong></div>` : ''}<div class="total"><span>현재 집계</span><strong>${won(period.live.points)} (${format(period.live.count)}건)</strong></div></div>
    ${record?.dispute ? `<div class="notice-bar warn">${icon('alert', 18)}<span><b>이의 제기</b> ${escape(record.dispute.message)} · ${showTime(record.dispute.at)}</span></div>` : ''}
    <section data-csv>${rows.length ? `<div class="panel-head"><h4>확정 승인 내역</h4>${action('CSV', 'csv', `data-name="정산내역_${escape(partner.name)}_${period.from}"`, 'btn outline sm', 'download')}</div><div class="table-scroll"><table><thead><tr><th>승인 일시</th><th>회원</th><th>웹하드 아이디</th><th>거래번호</th><th class="numeric">웹하드 차감</th><th class="numeric">정산 금액</th></tr></thead><tbody>${rows.map(row => `<tr><td>${showTime(row.updated ?? row.date)}</td><td>${escape(account(state, row.userId)?.name ?? '—')}</td><td>${escape(row.member ?? '—')}</td><td>${escape(row.transferId ?? row.id)}</td><td class="numeric">${format(row.source)} P</td><td class="numeric">${won(row.points)}</td></tr>`).join('')}</tbody></table></div>` : blank('이 기간에 확정 승인된 거래가 없습니다.')}</section>`;
}
