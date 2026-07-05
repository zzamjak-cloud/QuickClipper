import { FieldValue } from 'firebase-admin/firestore';
import { initFirestore, kstDateString } from './pipeline/store.js';
import { hasGeminiCredentials, translateItems } from './pipeline/translate.js';
import type { DigestItem } from './types.js';

interface LoadedDigestItem extends DigestItem {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
}

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

const db = initFirestore();
const date = process.env.DIGEST_DATE?.trim() || kstDateString(new Date());
const forceTranslate = envFlag('FORCE_TRANSLATE');

if (!hasGeminiCredentials()) {
  throw new Error('GEMINI_API_KEY 미설정 — 다이제스트 번역을 실행할 수 없음');
}

const snap = await db.collection(`digests/${date}/items`).get();
const items = snap.docs.map(
  (doc) =>
    ({
      id: doc.id,
      ref: doc.ref,
      ...(doc.data() as DigestItem),
    }) as LoadedDigestItem,
);

const targets = items.filter(
  (item) => item.lang === 'en' && (forceTranslate || !item.titleKo || !item.summaryKo),
);
console.log(`[translate-digest] ${date} 전체 ${items.length}건, 번역 대상 ${targets.length}건`);

if (targets.length === 0) {
  console.log('[translate-digest] 번역할 항목 없음');
  process.exit(0);
}

await translateItems(targets);

const translated = targets.filter((item) => item.titleKo);
const CHUNK = 400;
for (let i = 0; i < translated.length; i += CHUNK) {
  const batch = db.batch();
  for (const item of translated.slice(i, i + CHUNK)) {
    batch.update(item.ref, {
      titleKo: item.titleKo,
      summaryKo: item.summaryKo ?? '',
      translationUpdatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

await db.doc(`digests/${date}`).set(
  {
    translatedItemCount: translated.length,
    translationUpdatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

console.log(`[translate-digest] ${date} 번역 저장 완료: ${translated.length}/${targets.length}건`);
process.exit(0);
