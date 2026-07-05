import { initFirestore, kstDateString } from './pipeline/store.js';
import { generateBriefing, generateWeeklyReport } from './pipeline/ai-extras.js';
import type { DigestItem } from './types.js';

// 저장된 다이제스트로 브리핑·주간 리포트만 재생성 (개발·수동 갱신용)
const db = initFirestore();
const now = new Date();
const date = kstDateString(now);

const snap = await db.collection(`digests/${date}/items`).get();
const items = snap.docs.map((d) => d.data() as DigestItem);
console.log(`[ai-extras] ${date} 항목 ${items.length}건 로드`);

const briefing = await generateBriefing(items);
if (briefing) {
  await db.doc(`digests/${date}`).set({ briefing }, { merge: true });
  console.log('[ai-extras] 브리핑 저장 완료');
}

const dates = Array.from({ length: 7 }, (_, i) =>
  kstDateString(new Date(now.getTime() - (6 - i) * 86400_000)),
);
await generateWeeklyReport(db, dates);
process.exit(0);
