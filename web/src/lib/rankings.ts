import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { kstToday, shiftDate } from './types';

/** rankings/{date}/charts/{chartId} 문서의 항목 */
export interface ChartItem {
  rank: number;
  name: string;
  url: string;
  icon?: string;
  publisher?: string;
}

/** 순위 조회 — 오늘 데이터가 없으면 어제 것으로 폴백 */
export async function fetchChart(
  chartId: string,
): Promise<{ items: ChartItem[]; date: string } | null> {
  const today = kstToday();
  for (const date of [today, shiftDate(today, -1)]) {
    const snap = await getDoc(doc(db, `rankings/${date}/charts/${chartId}`));
    if (snap.exists()) {
      return { items: (snap.data().items ?? []) as ChartItem[], date };
    }
  }
  return null;
}
