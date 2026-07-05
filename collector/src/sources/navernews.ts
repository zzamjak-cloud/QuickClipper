import type { RawItem, SourceDef } from '../types.js';

// 네이버 검색 Open API (뉴스) — https://developers.naver.com 에서 앱 등록 후
// NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수로 주입한다. (무료 일 25,000회)

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

/** 네이버 API 자격증명이 설정되어 있는지 */
export function hasNaverCredentials(): boolean {
  return !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

/** HTML 태그(<b> 등)와 엔티티 제거 */
function stripTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** 네이버 뉴스 검색 — 키워드 기준 최신순 */
export async function fetchNaverNews(source: SourceDef): Promise<RawItem[]> {
  const limit = source.limit ?? 15;
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(source.target)}&display=${limit}&sort=date`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID!,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET!,
    },
  });
  if (!res.ok) throw new Error(`네이버 뉴스 "${source.target}" HTTP ${res.status}`);
  const json = await res.json();

  return ((json.items ?? []) as NaverNewsItem[]).map((it) => ({
    title: stripTags(it.title),
    url: it.originallink || it.link,
    summary: stripTags(it.description),
    publishedAt: it.pubDate ? new Date(it.pubDate) : null,
    sourceScore: null,
  }));
}
