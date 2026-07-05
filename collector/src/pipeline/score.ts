import type { DigestItem, RawItem, SourceDef } from '../types.js';

/**
 * 소스 지표(HN 포인트, 레딧 업보트)를 0~100으로 정규화.
 * 지표가 없는 RSS는 최신일수록 높은 점수(0~70)를 부여해 최신순 정렬 효과를 낸다.
 */
export function scoreItem(raw: RawItem, now: Date): number {
  if (raw.sourceScore !== null) {
    // 로그 스케일: 10점→33, 100점→67, 1000점→100
    const score = Math.log10(Math.max(raw.sourceScore, 1)) * 33.3;
    return Math.min(Math.round(score), 100);
  }

  if (raw.publishedAt) {
    const hoursAgo = (now.getTime() - raw.publishedAt.getTime()) / 3600_000;
    // 24시간 이내 → 70점에서 시간당 감소, 최소 10점
    return Math.max(Math.round(70 - hoursAgo * 2.5), 10);
  }

  return 10;
}

/** RawItem → DigestItem 변환 (점수·메타데이터 부여) */
export function toDigestItems(
  raws: RawItem[],
  source: SourceDef,
  now: Date,
): DigestItem[] {
  return raws.map((raw) => ({
    title: raw.title,
    url: raw.url,
    summary: raw.summary,
    category: source.category,
    sourceId: source.id,
    sourceName: source.name,
    lang: source.lang,
    score: scoreItem(raw, now),
    publishedAt: raw.publishedAt,
    collectedAt: now,
  }));
}
