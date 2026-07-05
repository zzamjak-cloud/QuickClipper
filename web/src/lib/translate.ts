import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface TranslateResult {
  titleKo: string;
  summaryKo: string;
}

/**
 * 번역하기 — Firebase Functions(asia-northeast3) 경유 Claude 호출.
 * 결과는 서버에서 digests/{date}/items/{id}에 캐시되므로 재호출 시 과금 없음.
 */
export async function translateItem(date: string, itemId: string): Promise<TranslateResult> {
  const fns = getFunctions(getApp(), 'asia-northeast3');
  const call = httpsCallable<{ date: string; itemId: string }, TranslateResult>(
    fns,
    'translateItem',
  );
  const res = await call({ date, itemId });
  return res.data;
}
