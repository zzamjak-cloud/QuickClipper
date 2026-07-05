import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import type { DigestItem } from '../types.js';

/**
 * Admin SDK 초기화.
 * GitHub Actions에서는 FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 문자열) 사용,
 * 로컬에서는 GOOGLE_APPLICATION_CREDENTIALS 경로 사용.
 */
export function initFirestore() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const app = saJson
    ? initializeApp({ credential: cert(JSON.parse(saJson)) })
    : initializeApp({ credential: applicationDefault() });
  const db = getFirestore(app);
  // imageUrl/titleKo 등 선택 필드의 undefined를 자동 제거
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

/** URL 해시로 결정적 문서 ID 생성 — 재실행 시 같은 항목은 덮어쓰기(멱등) */
function itemDocId(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 20);
}

/** KST 기준 오늘 날짜 문자열 (YYYY-MM-DD) — 다이제스트 문서 ID */
export function kstDateString(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

const RETENTION_DAYS = 30;

/** 백업 cron 재실행 시 이미 저장된 다이제스트는 다시 생성하지 않음 */
export async function digestExists(
  db: FirebaseFirestore.Firestore,
  date: string,
): Promise<boolean> {
  const snap = await db.doc(`digests/${date}`).get();
  const data = snap.data() as { itemCount?: unknown } | undefined;
  return snap.exists && typeof data?.itemCount === 'number' && data.itemCount > 0;
}

/** 다이제스트 저장: digests/{date}/items/{itemId} */
export async function saveDigest(
  db: FirebaseFirestore.Firestore,
  date: string,
  items: DigestItem[],
  briefing?: unknown,
): Promise<void> {
  // 다이제스트 메타 문서 (열람 앱에서 날짜 목록·브리핑 조회용)
  await db.doc(`digests/${date}`).set(
    {
      date,
      itemCount: items.length,
      categories: [...new Set(items.map((it) => it.category))],
      ...(briefing ? { briefing } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Firestore 배치는 500개 제한 → 400개 단위로 분할 커밋
  const CHUNK = 400;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = db.batch();
    for (const item of items.slice(i, i + CHUNK)) {
      const ref = db.doc(`digests/${date}/items/${itemDocId(item.url)}`);
      batch.set(ref, {
        ...item,
        publishedAt: item.publishedAt ? Timestamp.fromDate(item.publishedAt) : null,
        collectedAt: Timestamp.fromDate(item.collectedAt),
      });
    }
    await batch.commit();
  }
}

/** 보존 기간이 지난 다이제스트·순위 삭제 (스크랩은 users/ 아래 스냅샷이라 영향 없음) */
export async function cleanupOldDigests(
  db: FirebaseFirestore.Firestore,
  now: Date,
): Promise<number> {
  const cutoff = kstDateString(new Date(now.getTime() - RETENTION_DAYS * 86400_000));

  const oldDigests = await db.collection('digests').where('date', '<', cutoff).get();
  for (const doc of oldDigests.docs) {
    // 하위 items 서브컬렉션까지 재귀 삭제
    await db.recursiveDelete(doc.ref);
  }

  const oldRankings = await db.collection('rankings').where('date', '<', cutoff).get();
  for (const doc of oldRankings.docs) {
    await db.recursiveDelete(doc.ref);
  }

  return oldDigests.size;
}
