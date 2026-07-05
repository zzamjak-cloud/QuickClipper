import type { RawItem, SourceDef } from '../types.js';

const API = 'https://hacker-news.firebaseio.com/v0';

interface HnItem {
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  id: number;
}

/** Hacker News 상위 스토리 수집 (공식 API) */
export async function fetchHackerNews(source: SourceDef): Promise<RawItem[]> {
  const limit = source.limit ?? 20;
  const idsRes = await fetch(`${API}/topstories.json`);
  if (!idsRes.ok) throw new Error(`HN topstories HTTP ${idsRes.status}`);
  const ids: number[] = (await idsRes.json()).slice(0, limit);

  const items = await Promise.all(
    ids.map(async (id): Promise<HnItem | null> => {
      const res = await fetch(`${API}/item/${id}.json`);
      return res.ok ? res.json() : null;
    }),
  );

  return items
    .filter((it): it is HnItem => it !== null && !!it.title)
    .map((it) => ({
      title: it.title!.trim(),
      // 외부 링크가 없는 Ask HN 등은 HN 토론 페이지로 연결
      url: it.url ?? `https://news.ycombinator.com/item?id=${it.id}`,
      summary: '',
      publishedAt: it.time ? new Date(it.time * 1000) : null,
      sourceScore: it.score ?? null,
    }));
}
