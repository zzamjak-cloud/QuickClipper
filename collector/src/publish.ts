import { readFile } from 'node:fs/promises';
import { cleanupOldDigests, initFirestore, saveDigest, type StoredItem } from './pipeline/store.js';
import { CANDIDATES_PATH, REPORT_PATH, validateReport } from './report.js';
import type { Candidate, CandidatesFile, Report } from './types.js';

// 3단계(publish): report.json + candidates.json → Firestore digests/{date} 저장.
// 후보 전체를 items로 저장하고 리포트는 후보 id로 참조한다.
// report.json이 없거나 깨졌으면 report 없이 저장 — 웹이 후보를 짧은 소식 목록으로 보여준다 (폴백).

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
    id: c.id,
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

async function main() {
  const file = JSON.parse(await readFile(CANDIDATES_PATH, 'utf8')) as CandidatesFile;
  const collectedAt = new Date(file.collectedAt);
  const report = await loadReport(file.candidates);
  const items = file.candidates.map((c, i) => toStored(c, i + 1, collectedAt));

  const db = initFirestore();
  await saveDigest(db, file.date, items, report);
  const summary = report
    ? `리포트 섹션 ${report.sections.length}개·북마크 ${report.sections.reduce((n, s) => n + s.bookmarks.length, 0)}건·짧은 소식 ${report.briefs.length}건`
    : '원문 폴백';
  console.log(`[publish] ${file.date} 저장 완료 — 후보 ${items.length}건, ${summary}`);

  const removed = await cleanupOldDigests(db, collectedAt);
  console.log(`[publish] 만료 다이제스트 ${removed}건 정리`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[publish] 실패:', err);
    process.exit(1);
  });
