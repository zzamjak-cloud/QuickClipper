import type { RawItem } from '../types.js';

/** 추적 파라미터 제거 + URL 표준화 — 중복 판정의 기준 키를 만든다 */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    // utm_* 등 추적용 쿼리 제거
    const params = [...url.searchParams.keys()];
    for (const key of params) {
      if (/^(utm_|fbclid|gclid|ref_|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    // 후행 슬래시 통일
    let out = url.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return raw.trim();
  }
}

/** HTML 태그 제거 + 공백 정리 + 길이 제한 */
export function cleanSummary(raw: string, maxLen = 400): string {
  const text = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

/** 원시 항목 정규화 (URL·요약 정리, 빈 URL 제거) */
export function normalizeItems(items: RawItem[]): RawItem[] {
  return items
    .filter((it) => it.url)
    .map((it) => ({
      ...it,
      url: normalizeUrl(it.url),
      summary: cleanSummary(it.summary),
    }));
}
