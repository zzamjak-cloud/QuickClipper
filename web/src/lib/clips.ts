import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
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
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Clip, 'id'>), id: d.id }));
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
  // Firestore는 undefined를 허용하지 않으므로 번역 캐시는 있을 때만 포함
  if (item.titleKo) data.titleKo = item.titleKo;
  if (item.summaryKo) data.summaryKo = item.summaryKo;
  await setDoc(doc(db, `users/${uid}/clips/${item.id}`), data);
}

export async function removeClip(uid: string, itemId: string) {
  await deleteDoc(doc(db, `users/${uid}/clips/${itemId}`));
}
