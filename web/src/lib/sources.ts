import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { SourceDef } from './types';

/** 수집 소스 목록 조회 */
export async function fetchSources(): Promise<SourceDef[]> {
  const snap = await getDocs(collection(db, 'sources'));
  return snap.docs
    .map((d) => d.data() as SourceDef)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** RSS 소스 추가 (관리자 전용) */
export async function addSource(source: SourceDef): Promise<void> {
  await setDoc(doc(db, `sources/${source.id}`), source);
}

/** 소스 삭제 (관리자 전용) */
export async function deleteSource(id: string): Promise<void> {
  await deleteDoc(doc(db, `sources/${id}`));
}
