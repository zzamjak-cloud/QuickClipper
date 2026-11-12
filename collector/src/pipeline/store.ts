import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Report } from '../types.js';

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
  // imageUrl 등 선택 필드의 undefined를 자동 제거
  db.settings({ ignoreUndefinedProperties: true });
  return db;
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

/** Firestore digests/{date}/items/{후보 id} 문서 — 리포트가 참조하는 후보 원본 */
export interface StoredItem {
  /** 후보 id (c1, c2, …) — 문서 ID이자 리포트의 참조 키 */
  id: string;
  /** 후보 순서 (1부터, 점수순) */
  rank: number;
  title: string;
  url: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  lang: 'ko' | 'en';
  score: number;
  publishedAt: Date | null;
  collectedAt: Date;
  imageUrl?: string;
  relatedSources?: { name: string; url: string }[];
}

/**
 * 다이제스트 저장: digests/{date}.report + items 서브컬렉션.
 * 같은 날짜 재실행(FORCE) 시 이전 항목이 섞이지 않도록 기존 items를 지우고 새로 쓴다.
 */
export async function saveDigest(
  db: FirebaseFirestore.Firestore,
  date: string,
  items: StoredItem[],
  report: Report | null,
): Promise<void> {
  await db.recursiveDelete(db.collection(`digests/${date}/items`));

  const batch = db.batch();
  for (const { id, ...item } of items) {
    batch.set(db.doc(`digests/${date}/items/${id}`), {
      ...item,
      publishedAt: item.publishedAt ? Timestamp.fromDate(item.publishedAt) : null,
      collectedAt: Timestamp.fromDate(item.collectedAt),
    });
  }
  // 메타 문서는 merge 없이 덮어써 이전 스키마 필드(briefing 등)를 남기지 않는다
  batch.set(db.doc(`digests/${date}`), {
    date,
    itemCount: items.length,
    report,
    aiGenerated: report !== null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

/** 보존 기간이 지난 다이제스트 삭제 */
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
  return oldDigests.size;
}
