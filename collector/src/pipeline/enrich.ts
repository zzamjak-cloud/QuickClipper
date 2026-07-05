import type { DigestItem } from '../types.js';

// 썸네일이 없는 항목의 기사 페이지에서 og:image를 추출해 보강한다.
// 실패해도 무시 (이미지는 부가 정보) — 타임아웃 4초, 동시 8개.

const CONCURRENCY = 8;
const TIMEOUT_MS = 4000;
const MAX_HTML_BYTES = 120_000;

async function fetchOgImage(pageUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuickClipper/1.0; +https://quick-clipper.web.app)',
        Accept: 'text/html',
      },
    });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return undefined;

    // 본문 전체가 아닌 앞부분만 읽는다 (og 태그는 <head>에 있음)
    const reader = res.body?.getReader();
    if (!reader) return undefined;
    let html = '';
    const decoder = new TextDecoder();
    while (html.length < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes('</head>')) break;
    }
    reader.cancel().catch(() => {});

    const match =
      html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i);
    const url = match?.[1];
    return url && /^https?:\/\//.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

/** 이미지 없는 항목에 og:image 보강 (원본 배열을 직접 수정) */
export async function enrichImages(items: DigestItem[]): Promise<void> {
  const targets = items.filter((it) => !it.imageUrl);
  let enriched = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        const image = await fetchOgImage(item.url);
        if (image) {
          item.imageUrl = image;
          enriched++;
        }
      }),
    );
  }
  console.log(`[enrich] og:image 보강: ${targets.length}개 시도 → ${enriched}개 성공`);
}
