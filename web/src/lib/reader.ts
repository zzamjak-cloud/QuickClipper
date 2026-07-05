import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface TranslatedArticle {
  title: string;
  paragraphs: string[];
}

/**
 * 앱 내 번역 리더 — 기사 본문을 서버에서 추출·한국어 전문 번역해서 받는다.
 * 결과는 서버에 캐시되어 같은 기사 재열람 시 즉시 반환.
 */
export async function readArticle(date: string, itemId: string): Promise<TranslatedArticle> {
  const fns = getFunctions(getApp(), 'asia-northeast3');
  const call = httpsCallable<{ date: string; itemId: string }, TranslatedArticle>(
    fns,
    'readArticle',
  );
  return (await call({ date, itemId })).data;
}
