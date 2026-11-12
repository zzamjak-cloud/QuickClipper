import type { Timestamp } from 'firebase/firestore';

/** digests/{date}/items/{id} 문서 — 수집 후보 원본 (id = 후보 id) */
export interface DigestItem {
  id: string;
  /** 후보 순서 (1부터, 점수순) — 아주 오래된 스키마엔 없음 */
  rank?: number;
  title: string;
  url: string;
  summary: string;
  sourceName: string;
  score: number;
  publishedAt: Timestamp | null;
  imageUrl?: string;
  relatedSources?: { name: string; url: string }[];
  /** 이전 스키마(카드형 리포트)의 한국어 필드 — 짧은 소식 폴백에서만 사용 */
  titleKo?: string;
  summaryKo?: string;
}

/** digests/{date}.report — 하나의 리포트 문서 (id는 모두 items 문서 id) */
export interface Report {
  headline: string;
  lede: string;
  sections: ReportSection[];
  briefs: { id: string; oneLine: string }[];
}

export interface ReportSection {
  title: string;
  body: string[];
  heroId: string | null;
  bookmarks: { id: string; reason: string }[];
}

/** 링크 표시용 도메인 (www. 제거) */
export function domainOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
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
