import { readFile } from 'node:fs/promises';
import { enrichImages } from './pipeline/enrich.js';
import {
  cleanupOldDigests,
  initFirestore,
  saveDigest,
  type StoredBriefing,
  type StoredItem,
} from './pipeline/store.js';
import { CANDIDATES_PATH, MAX_REPORT_ITEMS, REPORT_PATH, validateReport } from './report.js';
import type { Candidate, CandidatesFile, Report } from './types.js';

// 3단계(publish): report.json + candidates.json 병합 → Firestore digests/{date} 저장.
// report.json이 없거나 깨졌으면 상위 후보를 원문 그대로 저장한다 (폴백).

async function loadReport(candidates: Candidate[]): Promise<Report | null> {
  try {
    const report = validateReport(JSON.parse(await readFile(REPORT_PATH, 'utf8')), candidates);
    if (!report) console.warn('[publish] report.json 검증 실패 — 원문 폴백');
    return report;
  } catch (err) {
    console.warn(`[publish] report.json 없음/읽기 실패 — 원문 폴백: ${err}`);
    return null;
  }
}

function toStored(c: Candidate, rank: number, collectedAt: Date): StoredItem {
  return {
    rank,
    title: c.title,
    url: c.url,
    summary: c.summary,
    sourceId: c.sourceId,
    sourceName: c.sourceName,
    lang: c.lang,
    score: c.score,
    publishedAt: c.publishedAt ? new Date(c.publishedAt) : null,
    collectedAt,
    imageUrl: c.imageUrl,
    relatedSources: c.relatedSources,
  };
}

/** 모델이 합친 후보들을 대표 항목의 교차 보도 링크로 묶는다 (URL 중복 제거, 최대 6개) */
function mergeRelated(main: Candidate, merged: Candidate[]): Candidate['relatedSources'] {
  const links = [
    ...(main.relatedSources ?? []),
    ...merged.flatMap((c) => [{ name: c.sourceName, url: c.url }, ...(c.relatedSources ?? [])]),
  ];
  const unique = links.filter(
    (l, i) => l.url !== main.url && links.findIndex((x) => x.url === l.url) === i,
  );
  return unique.length > 0 ? unique.slice(0, 6) : undefined;
}

async function main() {
  const file = JSON.parse(await readFile(CANDIDATES_PATH, 'utf8')) as CandidatesFile;
  const collectedAt = new Date(file.collectedAt);
  const byId = new Map(file.candidates.map((c) => [c.id, c]));
  const report = await loadReport(file.candidates);

  let items: StoredItem[];
  let briefing: StoredBriefing | null = null;
  if (report) {
    briefing = report.briefing;
    items = report.items.map((r, i) => ({
      ...toStored(byId.get(r.id)!, i + 1, collectedAt),
      relatedSources: mergeRelated(byId.get(r.id)!, r.relatedIds.map((rid) => byId.get(rid)!)),
      titleKo: r.titleKo,
      summaryKo: r.summaryKo,
      whyItMatters: r.whyItMatters,
      tags: r.tags,
    }));
  } else {
    items = file.candidates.slice(0, MAX_REPORT_ITEMS).map((c, i) => toStored(c, i + 1, collectedAt));
  }

  await enrichImages(items);
  const db = initFirestore();
  await saveDigest(db, file.date, items, briefing);
  console.log(
    `[publish] ${file.date} 저장 완료 — 항목 ${items.length}건 (${report ? 'AI 리포트' : '원문 폴백'})`,
  );

  const removed = await cleanupOldDigests(db, collectedAt);
  console.log(`[publish] 만료 다이제스트 ${removed}건 정리`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[publish] 실패:', err);
    process.exit(1);
  });
