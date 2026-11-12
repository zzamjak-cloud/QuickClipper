import { create } from 'zustand';
import type { DigestItem, Report } from '../lib/types';
import { kstToday } from '../lib/types';
import { fetchDigestItems, fetchDigestReport } from '../lib/digest';

interface AppState {
  date: string;
  items: DigestItem[];
  report: Report | null;
  loading: boolean;
  error: string | null;
  loadDigest: (date: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  date: kstToday(),
  items: [],
  report: null,
  loading: false,
  error: null,

  loadDigest: async (date) => {
    set({ loading: true, date, error: null });
    try {
      const [items, report] = await Promise.all([
        fetchDigestItems(date),
        fetchDigestReport(date).catch(() => null),
      ]);
      // 날짜를 빠르게 넘길 때 늦게 도착한 이전 응답이 덮어쓰지 않게 한다
      if (useAppStore.getState().date === date) set({ items, report });
    } catch (e) {
      if (useAppStore.getState().date === date) {
        set({ items: [], report: null, error: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      if (useAppStore.getState().date === date) set({ loading: false });
    }
  },
}));
