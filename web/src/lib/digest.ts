import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import type { DigestItem } from './types';

/** 특정 날짜의 다이제스트 항목 전체 조회 (점수 내림차순) */
export async function fetchDigestItems(date: string): Promise<DigestItem[]> {
  const q = query(collection(db, `digests/${date}/items`), orderBy('score', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as DigestItem);
}
