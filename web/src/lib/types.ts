import type { Timestamp } from 'firebase/firestore';

/** digests/{date}/items/{id} 문서 */
export interface DigestItem {
  id: string;
  /** 리포트 내 순서 (1부터, 중요도순) */
  rank: number;
  title: string;
  url: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  lang: 'ko' | 'en';
  score: number;
  publishedAt: Timestamp | null;
  collectedAt: Timestamp;
  imageUrl?: string;
  /** 같은 이슈를 보도한 다른 소스들 (교차 보도) */
  relatedSources?: { name: string; url: string }[];
  /** AI 리포트 필드 — 요약 실패(원문 폴백) 시 없음 */
  titleKo?: string;
  summaryKo?: string;
  whyItMatters?: string;
  tags?: string[];
}

/** digests/{date}.briefing */
export interface Briefing {
  headline: string;
  summary: string;
  keyPoints: string[];
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

/** "2026년 11월 12일 (목)" 형식 */
export function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

const relative = new Intl.RelativeTimeFormat('ko-KR', { numeric: 'auto' });

/** 게시 시각을 "3시간 전" 형식으로 */
export function timeAgo(at: Timestamp | null): string | null {
  if (!at) return null;
  const minutes = Math.round((at.toMillis() - Date.now()) / 60_000);
  if (minutes > -60) return relative.format(Math.min(minutes, -1), 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -48) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}
