import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { Category, DigestItem } from '../lib/types';
import { kstToday } from '../lib/types';
import { fetchDigestItems } from '../lib/digest';
import { addClip, fetchClipIds, removeClip } from '../lib/clips';

interface AppState {
  user: User | null;
  authReady: boolean;
  date: string;
  category: Category | '전체';
  items: DigestItem[];
  loading: boolean;
  clipIds: Set<string>;

  setUser: (user: User | null) => void;
  setCategory: (category: Category | '전체') => void;
  loadDigest: (date: string) => Promise<void>;
  loadClipIds: () => Promise<void>;
  toggleClip: (item: DigestItem) => Promise<void>;
  /** 번역 결과를 로컬 상태에 반영 (Firestore 캐시는 Functions가 기록) */
  applyTranslation: (itemId: string, titleKo: string, summaryKo: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authReady: false,
  date: kstToday(),
  category: '전체',
  items: [],
  loading: false,
  clipIds: new Set(),

  setUser: (user) => set({ user, authReady: true }),
  setCategory: (category) => set({ category }),

  loadDigest: async (date) => {
    set({ loading: true, date });
    try {
      const items = await fetchDigestItems(date);
      set({ items });
    } finally {
      set({ loading: false });
    }
  },

  loadClipIds: async () => {
    const { user } = get();
    if (!user) return;
    set({ clipIds: await fetchClipIds(user.uid) });
  },

  toggleClip: async (item) => {
    const { user, clipIds, date } = get();
    if (!user) return;
    const next = new Set(clipIds);
    if (next.has(item.id)) {
      next.delete(item.id);
      set({ clipIds: next }); // 낙관적 업데이트
      await removeClip(user.uid, item.id);
    } else {
      next.add(item.id);
      set({ clipIds: next });
      await addClip(user.uid, item, date);
    }
  },

  applyTranslation: (itemId, titleKo, summaryKo) =>
    set((state) => ({
      items: state.items.map((it) =>
        it.id === itemId ? { ...it, titleKo, summaryKo } : it,
      ),
    })),
}));
