import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

function fns() {
  return getFunctions(getApp(), 'asia-northeast3');
}

/** 클릭 이력 기록 (개인화 학습용, 실패 무시) */
export function recordClick(uid: string, item: DigestItem): void {
  addDoc(collection(db, `users/${uid}/clicks`), {
    title: item.titleKo ?? item.title,
    category: item.category,
    sourceName: item.sourceName,
    ts: serverTimestamp(),
  }).catch(() => {});
}

/** 관심 프로필 조회 */
export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, `users/${uid}/profile/main`));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** 관심 프로필 생성/갱신 (Functions — 클릭·스크랩 이력 분석) */
export async function generateProfile(): Promise<UserProfile> {
  const call = httpsCallable<void, UserProfile>(fns(), 'generateProfile');
  return (await call()).data;
}

/** 스크랩 자동 태그 제안 (Functions) */
export async function suggestTags(item: DigestItem): Promise<string[]> {
  const call = httpsCallable<
    { title: string; summary?: string; category?: string },
    { tags: string[] }
  >(fns(), 'suggestTags');
  const res = await call({
    title: item.titleKo ?? item.title,
    summary: item.summaryKo ?? item.summary,
    category: item.category,
  });
  return res.data.tags;
}

/** 주간 리포트 목록 (최신순) */
export async function fetchReports(): Promise<WeeklyReport[]> {
  const q = query(collection(db, 'reports'), orderBy('weekId', 'desc'), limit(12));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as WeeklyReport);
}
