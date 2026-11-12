import { fileURLToPath } from 'node:url';
import { SOURCES } from '../sources.config.js';
import { jaccard, titleWords } from './pipeline/dedupe.js';
import type { Candidate, Report, ReportSection } from './types.js';

// collect → summarize → publish 단계가 주고받는 파일 (워크플로 단계 간 전달용)
export const OUT_DIR = fileURLToPath(new URL('../out/', import.meta.url));
export const CANDIDATES_PATH = `${OUT_DIR}candidates.json`;
export const REPORT_PATH = `${OUT_DIR}report.json`;
export const PROMPT_PATH = fileURLToPath(new URL('../prompts/report.md', import.meta.url));

const MIN_SECTIONS = 2;
const MAX_SECTIONS = 6;
const MAX_BOOKMARKS_PER_SECTION = 4;
const MAX_BRIEFS = 15;
/** 섹션 제목·짧은 소식 문장이 이 이상 겹치면 같은 주제/사건 중복으로 보고 뒤의 것을 버린다 */
const DUPLICATE_TEXT_SIMILARITY = 0.5;
/** 공식 블로그는 소스 = 한 회사이므로 한 회사 소식이 섹션을 채우지 않게 북마크 상한을 둔다 */
const MAX_BOOKMARKS_PER_OFFICIAL_SOURCE = 2;
const OFFICIAL_SOURCE_IDS = new Set(SOURCES.filter((s) => s.tier === 'official').map((s) => s.id));

/** claude -p --json-schema 에 넘기는 출력 스키마 (Report 타입과 일치, heroId 없음은 빈 문자열) */
export const REPORT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    lede: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'array', items: { type: 'string' } },
          heroId: { type: 'string' },
          bookmarks: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, reason: { type: 'string' } },
              required: ['id', 'reason'],
            },
          },
        },
        required: ['title', 'body', 'heroId', 'bookmarks'],
      },
    },
    briefs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, oneLine: { type: 'string' } },
        required: ['id', 'oneLine'],
      },
    },
  },
  required: ['headline', 'lede', 'sections', 'briefs'],
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function textList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((v): v is string => v !== null).slice(0, max);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map((v) => (v ?? {}) as Record<string, unknown>) : [];
}

/**
 * 모델 출력을 검증·정리한다.
 * - 모든 후보 id는 리포트 전체(북마크+짧은 소식)에서 한 번만 쓰인다. 중복·미지 id는 버린다.
 * - 같은 공식 블로그 북마크는 상한을 넘으면 버린다.
 * - 제목이 거의 같은 섹션, 문장이 거의 같은 짧은 소식은 중복 주제로 보고 버린다.
 * - 유효 북마크가 없는 섹션은 본문 근거가 없으므로 섹션째 버린다.
 * - heroId는 그 섹션 북마크 중 이미지가 있는 후보로 보정한다.
 * 헤드라인·리드가 없거나 섹션이 너무 적으면 null (원문 폴백 신호).
 */
export function validateReport(raw: unknown, candidates: Candidate[]): Report | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const headline = text(data.headline);
  const lede = text(data.lede);
  if (!headline || !lede) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const claimed = new Set<string>();
  const perOfficialSource = new Map<string, number>();

  /** 아직 쓰이지 않은 유효 후보면 점유하고 true */
  function claim(id: string | null, forBookmark: boolean): id is string {
    if (!id || claimed.has(id)) return false;
    const candidate = byId.get(id);
    if (!candidate) return false;
    if (forBookmark && OFFICIAL_SOURCE_IDS.has(candidate.sourceId)) {
      const count = perOfficialSource.get(candidate.sourceId) ?? 0;
      if (count >= MAX_BOOKMARKS_PER_OFFICIAL_SOURCE) return false;
      perOfficialSource.set(candidate.sourceId, count + 1);
    }
    claimed.add(id);
    return true;
  }

  const sections: ReportSection[] = [];
  const sectionTitles: Set<string>[] = [];
  for (const s of records(data.sections)) {
    const title = text(s.title);
    const body = textList(s.body, 5);
    if (!title || body.length === 0) continue;
    const words = titleWords(title);
    if (sectionTitles.some((w) => jaccard(w, words) >= DUPLICATE_TEXT_SIMILARITY)) continue;

    const bookmarks: ReportSection['bookmarks'] = [];
    for (const b of records(s.bookmarks)) {
      const id = text(b.id);
      const reason = text(b.reason);
      if (!reason || bookmarks.length === MAX_BOOKMARKS_PER_SECTION) continue;
      if (claim(id, true)) bookmarks.push({ id, reason });
    }
    if (bookmarks.length === 0) continue;

    const withImage = bookmarks.filter((b) => byId.get(b.id)?.imageUrl).map((b) => b.id);
    const requestedHero = text(s.heroId);
    const heroId = requestedHero && withImage.includes(requestedHero) ? requestedHero : (withImage[0] ?? null);

    sectionTitles.push(words);
    sections.push({ title, body, heroId, bookmarks });
    if (sections.length === MAX_SECTIONS) break;
  }
  if (sections.length < MIN_SECTIONS) return null;

  const briefs: Report['briefs'] = [];
  const briefWords: Set<string>[] = [];
  for (const b of records(data.briefs)) {
    const id = text(b.id);
    const oneLine = text(b.oneLine);
    if (!oneLine || briefs.length === MAX_BRIEFS) continue;
    const words = titleWords(oneLine);
    if (briefWords.some((w) => jaccard(w, words) >= DUPLICATE_TEXT_SIMILARITY)) continue;
    if (!claim(id, false)) continue;
    briefWords.push(words);
    briefs.push({ id, oneLine });
  }

  return { headline, lede, sections, briefs };
}
