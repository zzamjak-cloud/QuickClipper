import { fileURLToPath } from 'node:url';
import { SOURCES } from '../sources.config.js';
import { jaccard, titleWords } from './pipeline/dedupe.js';
import type { Candidate, Report } from './types.js';

// collect → summarize → publish 단계가 주고받는 파일 (워크플로 단계 간 전달용)
export const OUT_DIR = fileURLToPath(new URL('../out/', import.meta.url));
export const CANDIDATES_PATH = `${OUT_DIR}candidates.json`;
export const REPORT_PATH = `${OUT_DIR}report.json`;
export const PROMPT_PATH = fileURLToPath(new URL('../prompts/report.md', import.meta.url));

export const MIN_REPORT_ITEMS = 3;
export const MAX_REPORT_ITEMS = 12;
/** 한국어 제목끼리 이 이상 겹치면 같은 사건으로 보고 뒤 항목을 버린다 (모델이 합치지 못한 경우의 안전장치) */
const DUPLICATE_TITLE_SIMILARITY = 0.5;
/** 공식 블로그는 소스 = 한 회사이므로 한 회사 소식이 리포트를 채우지 않게 소스당 상한을 둔다 */
const MAX_ITEMS_PER_OFFICIAL_SOURCE = 2;
const OFFICIAL_SOURCE_IDS = new Set(SOURCES.filter((s) => s.tier === 'official').map((s) => s.id));

/** claude -p --json-schema 에 넘기는 출력 스키마 (Report 타입과 일치) */
export const REPORT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    briefing: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        summary: { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
      },
      required: ['headline', 'summary', 'keyPoints'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          titleKo: { type: 'string' },
          summaryKo: { type: 'string' },
          whyItMatters: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          relatedIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'titleKo', 'summaryKo', 'whyItMatters', 'tags', 'relatedIds'],
      },
    },
  },
  required: ['briefing', 'items'],
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function textList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((v): v is string => v !== null).slice(0, max);
}

/**
 * 모델 출력을 검증·정리한다. 후보에 없는 id·빈 필드 항목은 버리고,
 * 앞 항목이 이미 대표하거나 relatedIds로 흡수한 후보, 제목이 거의 같은 항목도 같은 사건으로 보고 버린다.
 * 같은 공식 블로그(회사) 항목은 상한을 넘으면 버린다.
 * 브리핑이 깨졌거나 유효 항목이 너무 적으면 null (원문 폴백 신호).
 */
export function validateReport(raw: unknown, candidates: Candidate[]): Report | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const briefing = data.briefing as Record<string, unknown> | undefined;
  const headline = text(briefing?.headline);
  const summary = text(briefing?.summary);
  const keyPoints = textList(briefing?.keyPoints, 6);
  if (!headline || !summary || keyPoints.length === 0) return null;

  const known = new Set(candidates.map((c) => c.id));
  const sourceOf = new Map(candidates.map((c) => [c.id, c.sourceId]));
  const perOfficialSource = new Map<string, number>();
  // 이미 어떤 항목(대표 또는 relatedIds)에 속한 후보 id
  const claimed = new Set<string>();
  const keptTitles: Set<string>[] = [];
  const items: Report['items'] = [];
  for (const entry of Array.isArray(data.items) ? data.items : []) {
    const it = (entry ?? {}) as Record<string, unknown>;
    const id = text(it.id);
    const titleKo = text(it.titleKo);
    const summaryKo = text(it.summaryKo);
    const whyItMatters = text(it.whyItMatters);
    if (!id || !known.has(id) || claimed.has(id) || !titleKo || !summaryKo || !whyItMatters) continue;
    const sourceId = sourceOf.get(id)!;
    const officialCount = perOfficialSource.get(sourceId) ?? 0;
    if (OFFICIAL_SOURCE_IDS.has(sourceId) && officialCount >= MAX_ITEMS_PER_OFFICIAL_SOURCE) continue;
    const words = titleWords(titleKo);
    if (keptTitles.some((w) => jaccard(w, words) >= DUPLICATE_TITLE_SIMILARITY)) continue;
    const relatedIds = textList(it.relatedIds, 10).filter(
      (rid) => rid !== id && known.has(rid) && !claimed.has(rid),
    );
    if (OFFICIAL_SOURCE_IDS.has(sourceId)) perOfficialSource.set(sourceId, officialCount + 1);
    claimed.add(id);
    for (const rid of relatedIds) claimed.add(rid);
    keptTitles.push(words);
    items.push({ id, titleKo, summaryKo, whyItMatters, tags: textList(it.tags, 4), relatedIds });
    if (items.length === MAX_REPORT_ITEMS) break;
  }
  if (items.length < MIN_REPORT_ITEMS) return null;

  return { briefing: { headline, summary, keyPoints }, items };
}
