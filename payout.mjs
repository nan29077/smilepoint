// 지급대행(펌뱅킹) 어댑터 — 출금 승인 건을 실제 계좌로 이체한다.
//
// .env에 PAYOUT_API_URL, PAYOUT_API_KEY가 있으면 실제 지급대행사 API를 호출하고,
// 없으면 데모 모드에서만 "모의 지급대행"으로 동작한다 (운영 모드에서는 수동 지급만 가능).
//
// 지급대행사마다 주소·필드 이름이 다르므로, 계약 후에는 이 파일의 아래 세 곳만 규격에 맞게 고치면 된다.
//   1) transferBody  : 이체 요청 본문
//   2) outcome       : 응답·웹훅의 상태값 → paid(입금 완료) / failed(실패) / accepted(접수, 결과 대기)
//   3) parseWebhook  : 결과 통지(웹훅) 본문에서 거래번호·상태를 꺼내는 부분
import { createHmac, timingSafeEqual } from 'node:crypto';

const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');

export function createPayoutProvider(env, { demo = true } = {}) {
  if (env.PAYOUT_API_URL && env.PAYOUT_API_KEY) return httpProvider(env);
  return demo ? { name: '모의 지급대행', live: false, mock: true } : null;
}

function httpProvider(env) {
  const base = env.PAYOUT_API_URL.replace(/\/$/, '');
  const name = env.PAYOUT_PROVIDER_NAME || '지급대행';
  const timeout = Number(env.PAYOUT_TIMEOUT_MS || 10000);
  const headers = body => ({
    'Content-Type': 'application/json', Authorization: `Bearer ${env.PAYOUT_API_KEY}`,
    ...(body && env.PAYOUT_API_SECRET ? { 'X-Signature': 'sha256=' + hmac(env.PAYOUT_API_SECRET, body) } : {}),
  });
  // 1) 이체 요청 본문
  const transferBody = request => ({
    merchantId: env.PAYOUT_MERCHANT_ID || undefined, transferId: request.transferId, bankCode: request.bankCode,
    accountNumber: request.accountNumber, holderName: request.holder, amount: request.amount, currency: 'KRW', memo: request.memo,
  });
  // 2) 상태값 해석
  const outcome = data => {
    const status = String(data?.status ?? data?.result ?? '').toUpperCase();
    if (['COMPLETED', 'COMPLETE', 'SUCCESS', 'PAID', 'DONE'].includes(status)) return 'paid';
    if (['FAILED', 'FAIL', 'REJECTED', 'CANCELED', 'CANCELLED', 'ERROR'].includes(status)) return 'failed';
    return 'accepted';
  };
  const result = (response, data) => {
    const ref = String(data?.transferKey ?? data?.id ?? data?.ref ?? '');
    // 5xx는 송금 여부를 알 수 없다 → 호출한 쪽에서 "확인 필요"로 처리한다.
    if (response.status >= 500) throw new Error(`지급대행 서버 오류 (HTTP ${response.status})`);
    if (!response.ok) return { state: 'failed', ref, error: String(data?.message ?? data?.error ?? `HTTP ${response.status}`) };
    const state = outcome(data);
    return { state, ref, error: state === 'failed' ? String(data?.message ?? data?.error ?? '이체가 거절되었습니다') : '' };
  };
  return {
    name, live: true, webhook: !!env.PAYOUT_WEBHOOK_SECRET,
    // 이체 요청. Idempotency-Key(거래번호)로 같은 출금이 두 번 송금되지 않게 한다.
    async transfer(request) {
      const body = JSON.stringify(transferBody(request));
      const response = await fetch(base + '/transfers', { method: 'POST', body, signal: AbortSignal.timeout(timeout), headers: { ...headers(body), 'Idempotency-Key': request.transferId } });
      return result(response, await response.json().catch(() => ({})));
    },
    // 이체 결과 조회 (웹훅이 오지 않을 때 사용)
    async status({ transferId }) {
      const response = await fetch(`${base}/transfers/${encodeURIComponent(transferId)}`, { signal: AbortSignal.timeout(timeout), headers: headers('') });
      return result(response, await response.json().catch(() => ({})));
    },
    // 결과 통지 서명 검증: X-Payout-Signature: sha256=HMAC(PAYOUT_WEBHOOK_SECRET, 본문)
    verifyWebhook(raw, signature) {
      if (!env.PAYOUT_WEBHOOK_SECRET) return false;
      const expected = Buffer.from('sha256=' + hmac(env.PAYOUT_WEBHOOK_SECRET, raw));
      const actual = Buffer.from(String(signature ?? ''));
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
    // 3) 결과 통지 본문 해석
    parseWebhook(data) {
      const state = outcome(data);
      return { transferId: String(data?.transferId ?? data?.merchantTransferId ?? ''), state, ref: String(data?.transferKey ?? data?.id ?? data?.ref ?? ''), error: state === 'failed' ? String(data?.message ?? data?.error ?? '이체 실패') : '' };
    },
  };
}
