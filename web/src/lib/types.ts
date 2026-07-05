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
  /** 썸네일 이미지 (수집 시 추출) */
  imageUrl?: string;
  /** 배치 번역 결과 (영문 항목만) */
  titleKo?: string;
  summaryKo?: string;
}

/** 사이트 파비콘 URL (구글 파비콘 서비스) */
export function faviconUrl(pageUrl: string): string | null {
  try {
    const host = new URL(pageUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch {
    return null;
  }
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
  /** 썸네일 이미지 */
  imageUrl?: string;
  /** 사용자 태그 */
  tags?: string[];
  /** 사용자 메모 */
  memo?: string;
}

/** sources/{id} 문서 — 수집 소스 정의 (collector와 동일 스키마) */
export interface SourceDef {
  id: string;
  name: string;
  type: 'rss' | 'hackernews' | 'reddit' | 'navernews';
  category: Category;
  target: string;
  limit?: number;
  enabled?: boolean;
  lang: 'ko' | 'en';
  /** 관리자가 설정 UI에서 직접 추가한 소스 (이 경우에만 삭제 허용) */
  custom?: boolean;
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
