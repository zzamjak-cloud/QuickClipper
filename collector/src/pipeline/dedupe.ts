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

/**
 * 중복 제거: ① 정규화 URL 완전 일치 ② 같은 카테고리 내 제목 유사도.
 * 점수가 높은 항목을 남긴다.
 */
export function dedupeItems(items: DigestItem[]): DigestItem[] {
  // 점수 내림차순으로 정렬해 두면 "먼저 남긴 것이 항상 더 높은 점수"가 보장됨
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const kept: { item: DigestItem; words: Set<string> }[] = [];
  const seenUrls = new Set<string>();

  for (const item of sorted) {
    if (seenUrls.has(item.url)) continue;

    const words = titleWords(item.title);
    const isDup = kept.some(
      (k) =>
        k.item.category === item.category &&
        jaccard(k.words, words) >= TITLE_SIMILARITY_THRESHOLD,
    );
    if (isDup) continue;

    seenUrls.add(item.url);
    kept.push({ item, words });
  }

  return kept.map((k) => k.item);
}
