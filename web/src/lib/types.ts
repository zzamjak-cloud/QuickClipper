import type { Timestamp } from 'firebase/firestore';

/** 지원 카테고리 — 탭 노출 순서 기준 */
export const CATEGORIES = [
  '글로벌 핫이슈',
  'AI',
  '인사이트',
  '게임',
  '아트',
  'IT',
  '증권',
  '여행',
  '맛집',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** digests/{date}/items/{id} 문서 */
export interface DigestItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  category: Category;
  sourceId: string;
  sourceName: string;
  lang: 'ko' | 'en';
  score: number;
  publishedAt: Timestamp | null;
  collectedAt: Timestamp;
  /** 번역하기 결과 캐시 (있으면 재호출 없이 표시) */
  titleKo?: string;
  summaryKo?: string;
}

/** users/{uid}/clips/{id} 문서 — 다이제스트 항목의 스냅샷 */
export interface Clip {
  id: string;
  title: string;
  url: string;
  summary: string;
  category: Category;
  sourceName: string;
  lang: 'ko' | 'en';
  titleKo?: string;
  summaryKo?: string;
  /** 원본 다이제스트 날짜 (YYYY-MM-DD) */
  digestDate: string;
  clippedAt: Timestamp;
}

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 날짜 문자열 ± n일 */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
