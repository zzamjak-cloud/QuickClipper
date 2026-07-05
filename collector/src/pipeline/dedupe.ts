import type { DigestItem } from '../types.js';

/** 제목을 단어 집합으로 변환 (소문자, 특수문자 제거) */
function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}

/** 자카드 유사도 (0~1) */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

const TITLE_SIMILARITY_THRESHOLD = 0.75;
/** 다른 소스가 같은 소식을 보도할 때마다 부여하는 화제성 가점 */
const CROSS_SOURCE_BOOST = 8;

/**
 * 중복 제거: ① 정규화 URL 완전 일치 ② 같은 카테고리 내 제목 유사도.
 * 점수가 높은 항목을 남기고, 서로 다른 소스의 중복(교차 보도)은 화제성 가점을 준다.
 */
export function dedupeItems(items: DigestItem[]): DigestItem[] {
  // 점수 내림차순으로 정렬해 두면 "먼저 남긴 것이 항상 더 높은 점수"가 보장됨
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const kept: { item: DigestItem; words: Set<string> }[] = [];
  const seenUrls = new Map<string, DigestItem>();

  // 교차 보도 기록: 남긴 항목에 가점 + 탈락한 다른 소스 기사를 relatedSources로 보존
  function absorb(keptItem: DigestItem, dropped: DigestItem) {
    if (keptItem.sourceId === dropped.sourceId) return;
    keptItem.score = Math.min(keptItem.score + CROSS_SOURCE_BOOST, 100);
    const related = keptItem.relatedSources ?? [];
    if (!related.some((s) => s.url === dropped.url) && related.length < 6) {
      keptItem.relatedSources = [...related, { name: dropped.sourceName, url: dropped.url }];
    }
  }

  for (const item of sorted) {
    const urlDup = seenUrls.get(item.url);
    if (urlDup) {
      absorb(urlDup, item);
      continue;
    }

    const words = titleWords(item.title);
    const titleDup = kept.find(
      (k) =>
        k.item.category === item.category &&
        jaccard(k.words, words) >= TITLE_SIMILARITY_THRESHOLD,
    );
    if (titleDup) {
      absorb(titleDup.item, item);
      continue;
    }

    seenUrls.set(item.url, item);
    kept.push({ item, words });
  }

  return kept.map((k) => k.item);
}
