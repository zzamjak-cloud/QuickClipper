import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DigestItem, UserProfile, WeeklyReport } from './types';

/** 클릭 이력 기록 (추천용 로컬 데이터, 실패 무시) */
export function recordClick(uid: string, item: DigestItem): void {
  addDoc(collection(db, `users/${uid}/clicks`), {
    title: item.titleKo ?? item.title,
    category: item.category,
    sourceName: item.sourceName,
    ts: serverTimestamp(),
  }).catch(() => {});
}

/** 관심 프로필 조회 (기존 저장분만, AI 재생성 없음) */
export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, `users/${uid}/profile/main`));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** 주간 리포트 목록 (최신순, 기존 저장분만) */
export async function fetchReports(): Promise<WeeklyReport[]> {
  const q = query(collection(db, 'reports'), orderBy('weekId', 'desc'), limit(12));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as WeeklyReport);
}
