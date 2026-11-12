import Parser from 'rss-parser';
import type { RawItem, SourceDef } from '../types.js';
import { applySourceFilters } from './filters.js';

// media:* 네임스페이스 필드까지 파싱해 썸네일을 추출한다
const parser: Parser<Record<string, unknown>, Record<string, unknown>> = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'media:group', 'content:encoded'],
  },
});

/** RSS 항목에서 썸네일 URL 추출 (media:* → enclosure → 본문 첫 <img> 순) */
function extractImage(item: Record<string, unknown>): string | undefined {
  const mediaContent = item['media:content'] as { $?: { url?: string; medium?: string } } | undefined;
  if (mediaContent?.$?.url && mediaContent.$.medium !== 'audio') return mediaContent.$.url;

  const mediaThumb = item['media:thumbnail'] as { $?: { url?: string } } | undefined;
  if (mediaThumb?.$?.url) return mediaThumb.$.url;

  // 유튜브 등 Atom 피드는 media:group 안에 썸네일이 있음
  const group = item['media:group'] as Record<string, { $?: { url?: string } }[]> | undefined;
  const groupThumb = group?.['media:thumbnail']?.[0]?.$?.url;
  if (groupThumb) return groupThumb;

  const enclosure = item.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.url && (enclosure.type ?? '').startsWith('image/')) return enclosure.url;

  const html = (item['content:encoded'] as string) || (item.content as string) || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && /^https?:\/\//.test(match[1])) return match[1];

  return undefined;
}

/** RSS 피드에서 항목 수집 */
export async function fetchRss(source: SourceDef): Promise<RawItem[]> {
  // parseURL은 요청하지 않은 gzip 응답(DeepMind 피드)을 풀지 못해 fetch로 받아 파싱한다
  const res = await fetch(source.target, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuickClipper/1.0)' },
  });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const limit = source.limit ?? 30;

  const items = (feed.items ?? []).map((item) => ({
    title: ((item.title as string) ?? '(제목 없음)').trim(),
    url: (item.link as string) ?? '',
    summary: (item.contentSnippet as string) ?? (item.content as string) ?? '',
    publishedAt: item.isoDate ? new Date(item.isoDate as string) : null,
    sourceScore: null,
    imageUrl: extractImage(item),
  }));

  return applySourceFilters(items, source).slice(0, limit);
}
