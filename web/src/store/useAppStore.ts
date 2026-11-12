import { create } from 'zustand';
import type { Briefing, DigestItem } from '../lib/types';
import { kstToday } from '../lib/types';
import { fetchDigestBriefing, fetchDigestItems } from '../lib/digest';

interface AppState {
  date: string;
  items: DigestItem[];
  briefing: Briefing | null;
  loading: boolean;
  error: string | null;
  /** 선택된 태그 필터 (null = 전체) */
  tag: string | null;

  setTag: (tag: string | null) => void;
  loadDigest: (date: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  date: kstToday(),
  items: [],
  briefing: null,
  loading: false,
  error: null,
  tag: null,

  setTag: (tag) => set({ tag }),

  loadDigest: async (date) => {
    set({ loading: true, date, tag: null, error: null });
    try {
      const [items, briefing] = await Promise.all([
        fetchDigestItems(date),
        fetchDigestBriefing(date).catch(() => null),
      ]);
      // 날짜를 빠르게 넘길 때 늦게 도착한 이전 응답이 덮어쓰지 않게 한다
      if (useAppStore.getState().date === date) set({ items, briefing });
    } catch (e) {
      if (useAppStore.getState().date === date) {
        set({ items: [], briefing: null, error: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      if (useAppStore.getState().date === date) set({ loading: false });
    }
  },
}));
