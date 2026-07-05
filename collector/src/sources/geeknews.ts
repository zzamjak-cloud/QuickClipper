import type { RawItem, SourceDef } from '../types.js';
import { fetchRss } from './rss.js';

// GeekNews는 RSS에 추천수가 없어 각 토픽 페이지에서 파싱한다.
// 페이지 구조: <span id='tp{토픽ID}'>{추천수}</span>P

const CONCURRENCY = 5;
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; QuickClipper/1.0)' };

async function fetchPoints(topicUrl: string): Promise<number | null> {
  try {
    const id = new URL(topicUrl).searchParams.get('id');
    if (!id) return null;
    const res = await fetch(topicUrl, { signal: AbortSignal.timeout(5000), headers: UA });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(new RegExp(`id='tp${id}'>(\\d+)<`));
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/** GeekNews 수집: RSS + 토픽 페이지 추천수 파싱 */
export async function fetchGeekNews(source: SourceDef): Promise<RawItem[]> {
  const items = await fetchRss(source);

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(
      items.slice(i, i + CONCURRENCY).map(async (item) => {
        const points = await fetchPoints(item.url);
        if (points !== null) {
          // GeekNews 추천수는 HN 대비 스케일이 작아 10배 보정 (GN 10점 ≈ HN 100점)
          item.sourceScore = points * 10;
        }
      }),
    );
  }
  return items;
}
