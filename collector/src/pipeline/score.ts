import type { DigestItem, RawItem, SourceDef, SourceTier } from '../types.js';

// 1차 출처(공식 블로그)는 게시가 드물고 최신성 점수가 빨리 바닥나므로 가산,
// 범용 커뮤니티는 AI 외 잡음·화제성 편향이 있어 감산한다.
const TIER_BONUS: Record<SourceTier, number> = { official: 30, media: 0, community: -10 };

/**
 * 소스 지표(HN 포인트, GeekNews 추천수)를 0~100으로 정규화.
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
    sourceId: source.id,
    sourceName: source.name,
    lang: source.lang,
    sourceTier: source.tier,
    score: Math.min(Math.max(scoreItem(raw, now) + TIER_BONUS[source.tier], 0), 100),
    publishedAt: raw.publishedAt,
    collectedAt: now,
    imageUrl: raw.imageUrl,
  }));
}
