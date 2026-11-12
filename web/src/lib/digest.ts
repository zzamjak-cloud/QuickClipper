import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import type { Briefing, DigestItem } from './types';

/** 특정 날짜의 리포트 항목 (rank 오름차순 — rank 없는 구 스키마 문서는 제외됨) */
export async function fetchDigestItems(date: string): Promise<DigestItem[]> {
  const q = query(collection(db, `digests/${date}/items`), orderBy('rank', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DigestItem);
}

/** 리포트 브리핑 조회 — 구 스키마(points 배열)나 원문 폴백이면 null */
export async function fetchDigestBriefing(date: string): Promise<Briefing | null> {
  const snap = await getDoc(doc(db, `digests/${date}`));
  const briefing = snap.data()?.briefing as Partial<Briefing> | null | undefined;
  return briefing?.headline && Array.isArray(briefing.keyPoints) ? (briefing as Briefing) : null;
}
