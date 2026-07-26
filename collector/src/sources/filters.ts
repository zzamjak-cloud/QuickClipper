import type { RawItem, SourceDef } from '../types.js';

function normalizeKeyword(text: string): string {
  return text.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
}

function itemText(item: RawItem): string {
  return normalizeKeyword(`${item.title} ${item.summary}`);
}

/** 소스 정의의 include/exclude 키워드로 항목 품질을 보수적으로 거른다. */
export function matchesSourceFilters(item: RawItem, source: SourceDef): boolean {
  const text = itemText(item);
  const includeKeywords = source.includeKeywords?.map(normalizeKeyword).filter(Boolean) ?? [];
  const excludeKeywords = source.excludeKeywords?.map(normalizeKeyword).filter(Boolean) ?? [];

  if (includeKeywords.length > 0 && !includeKeywords.some((keyword) => text.includes(keyword))) {
    return false;
  }

  if (excludeKeywords.some((keyword) => text.includes(keyword))) {
    return false;
  }

  return true;
}

export function applySourceFilters(items: RawItem[], source: SourceDef): RawItem[] {
  if (!source.includeKeywords?.length && !source.excludeKeywords?.length) return items;
  return items.filter((item) => matchesSourceFilters(item, source));
}
