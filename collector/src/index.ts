import { SOURCES } from '../sources.config.js';
import { fetchRss } from './sources/rss.js';
import { fetchHackerNews } from './sources/hackernews.js';
import { fetchReddit, hasRedditCredentials } from './sources/reddit.js';
import { fetchNaverNews, hasNaverCredentials } from './sources/navernews.js';
import { fetchGeekNews } from './sources/geeknews.js';
import { normalizeItems } from './pipeline/normalize.js';
import { dedupeItems } from './pipeline/dedupe.js';
import { toDigestItems } from './pipeline/score.js';
import { enrichImages } from './pipeline/enrich.js';
import { hasGeminiCredentials, translateItems } from './pipeline/translate.js';
import {
  initFirestore,
  saveDigest,
  cleanupOldDigests,
  kstDateString,
  digestExists,
} from './pipeline/store.js';
import type { DigestItem, RawItem, SourceDef } from './types.js';

const FETCHERS: Record<SourceDef['type'], (s: SourceDef) => Promise<RawItem[]>> = {
  rss: fetchRss,
  hackernews: fetchHackerNews,
  reddit: fetchReddit,
  navernews: fetchNaverNews,
};

/** 소스별 fetcher 선택 — GeekNews는 추천수 파싱을 위해 전용 fetcher 사용 */
function fetcherFor(source: SourceDef): (s: SourceDef) => Promise<RawItem[]> {
  if (source.id === 'geeknews') return fetchGeekNews;
  return FETCHERS[source.type];
}

/**
 * 수집 소스 로드: Firestore sources 컬렉션 우선 (관리자 UI에서 편집 가능),
 * 비어 있거나 접근 불가하면 sources.config.ts 폴백.
 */
async function loadSources(db: FirebaseFirestore.Firestore | null): Promise<SourceDef[]> {
  if (db) {
    try {
      const snap = await db.collection('sources').get();
      if (!snap.empty) {
        console.log(`[collect] Firestore 소스 ${snap.size}개 로드`);
        return snap.docs.map((doc) => doc.data() as SourceDef);
      }
    } catch (err) {
      console.warn(`[collect] Firestore 소스 로드 실패 — 설정 파일 폴백: ${err}`);
    }
  }
  return SOURCES;
}

/** 자격증명이 없는 타입의 소스를 제외 */
function filterByCredentials(sources: SourceDef[]): SourceDef[] {
  let result = sources.filter((s) => s.enabled !== false);

  if (!hasRedditCredentials()) {
    const before = result.length;
    result = result.filter((s) => s.type !== 'reddit');
    if (before !== result.length) {
      console.warn(`[collect] REDDIT_CLIENT_ID/SECRET 미설정 — Reddit 소스 ${before - result.length}개 건너뜀`);
    }
  }
  if (!hasNaverCredentials()) {
    const before = result.length;
    result = result.filter((s) => s.type !== 'navernews');
    if (before !== result.length) {
      console.warn(`[collect] NAVER_CLIENT_ID/SECRET 미설정 — 네이버 소스 ${before - result.length}개 건너뜀`);
    }
  }
  return result;
}

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

async function main() {
  const now = new Date();
  const date = kstDateString(now);
  const dryRun = !!process.env.DRY_RUN;
  const forceCollect = envFlag('FORCE_COLLECT');
  const skipAiExtras = envFlag('SKIP_AI_EXTRAS');

  const db = dryRun ? null : initFirestore();
  if (!dryRun && db && !forceCollect && (await digestExists(db, date))) {
    console.log(`[collect] ${date} 다이제스트가 이미 있어 수집 건너뜀 (FORCE_COLLECT=1로 강제 실행)`);
    return;
  }

  const sources = filterByCredentials(await loadSources(db));
  console.log(`[collect] ${date} 수집 시작 — 소스 ${sources.length}개`);

  // 소스별 수집: 하나가 실패해도 나머지는 계속 진행
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const raws = await fetcherFor(source)(source);
      return toDigestItems(normalizeItems(raws), source, now);
    }),
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
  console.log(`[collect] 수집 ${items.length}건 → 중복 제거 후 ${deduped.length}건`);

  if (deduped.length === 0) {
    throw new Error('수집된 항목이 0건 — 전체 소스 장애 가능성');
  }

  // 기본 다이제스트를 먼저 저장해 AI 부가기능 지연이 열람 가능 상태를 막지 않게 한다.
  let briefing: unknown = null;
  let savedBaseline = false;
  if (!dryRun) {
    await saveDigest(db!, date, deduped);
    savedBaseline = true;
    console.log(`[collect] 기본 다이제스트 저장 완료 (${date})`);

    // 이미지 보강 → 영문 항목 배치 번역 → AI 부가기능 (실패해도 기본 다이제스트는 이미 저장됨)
    await enrichImages(deduped);
    if (skipAiExtras) {
      console.warn('[collect] SKIP_AI_EXTRAS=1 — 배치 번역·AI 부가기능 건너뜀');
    } else if (hasGeminiCredentials()) {
      await translateItems(deduped);
      await saveDigest(db!, date, deduped);
      console.log(`[collect] 번역 다이제스트 업데이트 완료 (${date})`);
      const { generateBriefing, summarizeClusters } = await import('./pipeline/ai-extras.js');
      await summarizeClusters(deduped);
      briefing = await generateBriefing(deduped);
    } else {
      console.warn('[collect] GEMINI_API_KEY 미설정 — 배치 번역·AI 부가기능 건너뜀');
    }
  }

  // DRY_RUN=1이면 Firestore 저장 없이 수집 결과만 출력 (로컬 검증용)
  if (dryRun || !db) {
    const byCategory = new Map<string, number>();
    for (const it of deduped) byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + 1);
    console.log('[dry-run] 카테고리별:', Object.fromEntries(byCategory));
    console.log('[dry-run] 샘플:', deduped.slice(0, 3).map((it) => `${it.title} (${it.score})`));
    return;
  }

  await saveDigest(db, date, deduped, briefing);
  if (savedBaseline) console.log(`[collect] 보강 다이제스트 업데이트 완료 (${date})`);

  // 게임 순위 수집 (실패해도 다이제스트에는 영향 없음)
  try {
    const { collectRankings } = await import('./rankings.js');
    await collectRankings(db, date);
  } catch (err) {
    console.warn(`[rankings] 순위 수집 실패: ${err}`);
  }

  // 주간 트렌드 리포트 — 일요일마다 지난 7일 다이제스트로 생성 (FORCE_REPORT=1로 강제 가능)
  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
  if ((isSunday || process.env.FORCE_REPORT) && hasGeminiCredentials()) {
    try {
      const { generateWeeklyReport } = await import('./pipeline/ai-extras.js');
      const dates = Array.from({ length: 7 }, (_, i) =>
        kstDateString(new Date(now.getTime() - (6 - i) * 86400_000)),
      );
      await generateWeeklyReport(db, dates);
    } catch (err) {
      console.warn(`[report] 주간 리포트 실패: ${err}`);
    }
  }

  const removed = await cleanupOldDigests(db, now);
  console.log(`[collect] 저장 완료 (${date}), 만료 다이제스트 ${removed}건 정리`);

  // 절반 이상 실패하면 워크플로우를 실패 처리해 Actions 알림을 받는다
  if (failures.length >= sources.length / 2) {
    throw new Error(`소스 절반 이상 실패: ${failures.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('[collect] 실패:', err);
  process.exit(1);
});
