import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { DigestItem, Report } from './types';

/** 특정 날짜의 후보 원본 전체 (rank 오름차순, rank 없는 오래된 문서는 점수순으로 뒤에) */
export async function fetchDigestItems(date: string): Promise<DigestItem[]> {
  const snap = await getDocs(collection(db, `digests/${date}/items`));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DigestItem);
  return items.sort(
    (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.score ?? 0) - (a.score ?? 0),
  );
}

/** 리포트 문서 조회 — 이전 스키마(briefing·카드형)나 원문 폴백이면 null */
export async function fetchDigestReport(date: string): Promise<Report | null> {
  const snap = await getDoc(doc(db, `digests/${date}`));
  const report = snap.data()?.report as Partial<Report> | null | undefined;
  return report?.headline && Array.isArray(report.sections) ? (report as Report) : null;
}
