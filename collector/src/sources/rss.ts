import Parser from 'rss-parser';
import type { RawItem, SourceDef } from '../types.js';

const parser = new Parser({ timeout: 15000 });

/** RSS 피드에서 항목 수집 */
export async function fetchRss(source: SourceDef): Promise<RawItem[]> {
  const feed = await parser.parseURL(source.target);
  const limit = source.limit ?? 20;

  return (feed.items ?? []).slice(0, limit).map((item) => ({
    title: item.title?.trim() ?? '(제목 없음)',
    url: item.link ?? '',
    summary: item.contentSnippet ?? item.content ?? '',
    publishedAt: item.isoDate ? new Date(item.isoDate) : null,
    sourceScore: null,
  }));
}
