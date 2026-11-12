import { mkdir, rm, writeFile } from 'node:fs/promises';
import { SOURCES } from '../sources.config.js';
import { fetchRss } from './sources/rss.js';
import { fetchHackerNews } from './sources/hackernews.js';
import { fetchGeekNews } from './sources/geeknews.js';
import { normalizeItems } from './pipeline/normalize.js';
import { dedupeItems } from './pipeline/dedupe.js';
import { toDigestItems } from './pipeline/score.js';
import { enrichImages } from './pipeline/enrich.js';
import { initFirestore, kstDateString, digestExists } from './pipeline/store.js';
import { CANDIDATES_PATH, OUT_DIR, REPORT_PATH } from './report.js';
import type { CandidatesFile, DigestItem, RawItem, SourceDef, SourceTier } from './types.js';

// 1단계(collect): 수집 → 정규화 → 중복 제거 → 점수 → 상위 후보를 out/candidates.json으로 출력.
// Firestore에는 쓰지 않는다 (저장은 publish 단계).

const CANDIDATE_COUNT = 30;
/** 한 소스가 후보를 독점하지 않도록 등급별 소스당 상한 */
const MAX_PER_SOURCE: Record<SourceTier, number> = { official: 5, media: 8, community: 4 };
/** 신선도 윈도: 공식 블로그는 게시 빈도가 낮아 72시간, 나머지는 하루 이틀 내 소식만 */
const MAX_AGE_HOURS: Record<SourceTier, number> = { official: 72, media: 48, community: 48 };

/** 소스별 fetcher 선택 — GeekNews는 추천수 파싱을 위해 전용 fetcher 사용 */
function fetcherFor(source: SourceDef): (s: SourceDef) => Promise<RawItem[]> {
  if (source.id === 'geeknews') return fetchGeekNews;
  return source.type === 'hackernews' ? fetchHackerNews : fetchRss;
}

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function pickCandidates(items: DigestItem[], now: Date): DigestItem[] {
  const perSource = new Map<string, number>();
  const picked: DigestItem[] = [];
  for (const item of [...items].sort((a, b) => b.score - a.score)) {
    const ageHours = item.publishedAt ? (now.getTime() - item.publishedAt.getTime()) / 3600_000 : 0;
    if (ageHours > MAX_AGE_HOURS[item.sourceTier]) continue;
    const count = perSource.get(item.sourceId) ?? 0;
    if (count >= MAX_PER_SOURCE[item.sourceTier]) continue;
    perSource.set(item.sourceId, count + 1);
    picked.push(item);
    if (picked.length === CANDIDATE_COUNT) break;
  }
  return picked;
}

async function main() {
  const now = new Date();
  const date = kstDateString(now);
  // 이전 실행의 산출물이 다음 단계로 새어 들어가지 않게 먼저 비운다
  await rm(CANDIDATES_PATH, { force: true });
  await rm(REPORT_PATH, { force: true });

  // 백업 크론 재실행 시 이미 발행된 날짜는 건너뜀 (DRY_RUN은 Firestore 조회 없이 수집만)
  if (!process.env.DRY_RUN && !envFlag('FORCE_COLLECT')) {
    if (await digestExists(initFirestore(), date)) {
      console.log(`[collect] ${date} 다이제스트가 이미 있어 건너뜀 (FORCE_COLLECT=1로 강제 실행)`);
      return;
    }
  }

  const sources = SOURCES.filter((s) => s.enabled !== false);
  console.log(`[collect] ${date} 수집 시작 — 소스 ${sources.length}개`);

  // 소스별 수집: 하나가 실패해도 나머지는 계속 진행
  const results = await Promise.allSettled(
    sources.map(async (source) => toDigestItems(normalizeItems(await fetcherFor(source)(source)), source, now)),
  );

  const items: DigestItem[] = [];
  const failures: string[] = [];
  results.forEach((res, i) => {
    const source = sources[i];
    if (res.status === 'fulfilled') {
      console.log(`  ✓ ${source.name}: ${res.value.length}건`);
      items.push(...res.value);
    } else {
      console.error(`  ✗ ${source.name}: ${res.reason}`);
      failures.push(source.name);
    }
  });

  const deduped = dedupeItems(items);
  const picked = pickCandidates(deduped, now);
  console.log(`[collect] 수집 ${items.length}건 → 중복 제거 ${deduped.length}건 → 후보 ${picked.length}건`);
  if (picked.length === 0) {
    throw new Error('후보 항목이 0건 — 전체 소스 장애 가능성');
  }
  // 요약 전에 이미지를 확보해 Claude가 대표 이미지(heroId)를 고를 수 있게 한다
  await enrichImages(picked);

  const file: CandidatesFile = {
    date,
    collectedAt: now.toISOString(),
    candidates: picked.map((it, i) => ({
      id: `c${i + 1}`,
      title: it.title,
      url: it.url,
      summary: it.summary,
      sourceId: it.sourceId,
      sourceName: it.sourceName,
      lang: it.lang,
      score: it.score,
      publishedAt: it.publishedAt?.toISOString() ?? null,
      imageUrl: it.imageUrl,
      relatedSources: it.relatedSources,
    })),
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(CANDIDATES_PATH, JSON.stringify(file, null, 2));
  console.log(`[collect] ${CANDIDATES_PATH} 저장`);

  // 절반 이상 실패하면 워크플로를 실패 처리해 Actions 알림을 받는다
  if (failures.length >= sources.length / 2) {
    throw new Error(`소스 절반 이상 실패: ${failures.join(', ')}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[collect] 실패:', err);
    process.exit(1);
  });
