import { SOURCES } from '../sources.config.js';
import { fetchRss } from './sources/rss.js';
import { fetchHackerNews } from './sources/hackernews.js';
import { fetchReddit, hasRedditCredentials } from './sources/reddit.js';
import { normalizeItems } from './pipeline/normalize.js';
import { dedupeItems } from './pipeline/dedupe.js';
import { toDigestItems } from './pipeline/score.js';
import { initFirestore, saveDigest, cleanupOldDigests, kstDateString } from './pipeline/store.js';
import type { DigestItem, RawItem, SourceDef } from './types.js';

const FETCHERS: Record<SourceDef['type'], (s: SourceDef) => Promise<RawItem[]>> = {
  rss: fetchRss,
  hackernews: fetchHackerNews,
  reddit: fetchReddit,
};

async function main() {
  const now = new Date();
  const date = kstDateString(now);

  // Reddit OAuth 미설정 시 Reddit 소스는 제외하고 진행
  let sources = SOURCES;
  if (!hasRedditCredentials()) {
    sources = SOURCES.filter((s) => s.type !== 'reddit');
    console.warn(
      `[collect] REDDIT_CLIENT_ID/SECRET 미설정 — Reddit 소스 ${SOURCES.length - sources.length}개 건너뜀`,
    );
  }
  console.log(`[collect] ${date} 수집 시작 — 소스 ${sources.length}개`);

  // 소스별 수집: 하나가 실패해도 나머지는 계속 진행
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const raws = await FETCHERS[source.type](source);
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

  // DRY_RUN=1이면 Firestore 저장 없이 수집 결과만 출력 (로컬 검증용)
  if (process.env.DRY_RUN) {
    const byCategory = new Map<string, number>();
    for (const it of deduped) byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + 1);
    console.log('[dry-run] 카테고리별:', Object.fromEntries(byCategory));
    console.log('[dry-run] 샘플:', deduped.slice(0, 3).map((it) => `${it.title} (${it.score})`));
    return;
  }

  const db = initFirestore();
  await saveDigest(db, date, deduped);
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
