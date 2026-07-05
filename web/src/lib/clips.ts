import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Clip, DigestItem } from './types';

/** 스크랩 ID 목록 조회 (카드의 스크랩 상태 표시용) */
export async function fetchClipIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, `users/${uid}/clips`));
  return new Set(snap.docs.map((d) => d.id));
}

/** 스크랩 전체 조회 (보관함 화면용, 최신순 정렬은 호출부에서) */
export async function fetchClips(uid: string): Promise<Clip[]> {
  const snap = await getDocs(collection(db, `users/${uid}/clips`));
  const clips = snap.docs.map((d) => ({ ...(d.data() as Omit<Clip, 'id'>), id: d.id }));
  return hydrateClipTranslations(uid, clips);
}

async function hydrateClipTranslations(uid: string, clips: Clip[]): Promise<Clip[]> {
  return Promise.all(
    clips.map(async (clip) => {
      if (!clip.digestDate || (clip.titleKo && clip.summaryKo !== undefined)) return clip;

      try {
        const digestSnap = await getDoc(doc(db, `digests/${clip.digestDate}/items/${clip.id}`));
        if (!digestSnap.exists()) return clip;

        const item = digestSnap.data() as Partial<DigestItem>;
        const patch: Record<string, unknown> = {};
        if (!clip.titleKo && item.titleKo) patch.titleKo = item.titleKo;
        if (clip.summaryKo === undefined && item.summaryKo !== undefined) {
          patch.summaryKo = item.summaryKo;
        }

        if (Object.keys(patch).length === 0) return clip;
        await updateDoc(doc(db, `users/${uid}/clips/${clip.id}`), patch);
        return { ...clip, ...patch };
      } catch {
        return clip;
      }
    }),
  );
}

/** 다이제스트 항목을 스냅샷으로 스크랩 (링크가 죽어도 내용 보존) */
export async function addClip(uid: string, item: DigestItem, digestDate: string) {
  const data: Record<string, unknown> = {
    title: item.title,
    url: item.url,
    summary: item.summary,
    category: item.category,
    sourceName: item.sourceName,
    lang: item.lang,
    digestDate,
    clippedAt: serverTimestamp(),
  };
  // Firestore는 undefined를 허용하지 않으므로 선택 필드는 있을 때만 포함
  if (item.titleKo) data.titleKo = item.titleKo;
  if (item.summaryKo) data.summaryKo = item.summaryKo;
  if (item.imageUrl) data.imageUrl = item.imageUrl;
  await setDoc(doc(db, `users/${uid}/clips/${item.id}`), data);
}

export async function removeClip(uid: string, itemId: string) {
  await deleteDoc(doc(db, `users/${uid}/clips/${itemId}`));
}

/** 스크랩의 태그/메모 갱신 */
export async function updateClipMeta(
  uid: string,
  clipId: string,
  meta: { tags?: string[]; memo?: string },
) {
  await updateDoc(doc(db, `users/${uid}/clips/${clipId}`), meta);
}
