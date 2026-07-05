import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import type { Category, DigestItem } from '../lib/types';
import { kstToday } from '../lib/types';
import { fetchDigestItems } from '../lib/digest';
import { addClip, fetchClipIds, removeClip } from '../lib/clips';
import type { AccessConfig } from '../lib/access';
import { fetchAccessConfig } from '../lib/access';

interface AppState {
  user: User | null;
  authReady: boolean;
  date: string;
  category: Category | '전체';
  items: DigestItem[];
  loading: boolean;
  clipIds: Set<string>;
  /** 허용 목록에 없는 계정으로 로그인한 상태 */
  accessDenied: boolean;
  /** 관리자 여부 (config/access 읽기 성공 = 관리자) */
  accessConfig: AccessConfig | null;

  setUser: (user: User | null) => void;
  setCategory: (category: Category | '전체') => void;
  loadDigest: (date: string) => Promise<void>;
  loadClipIds: () => Promise<void>;
  checkAdmin: () => Promise<void>;
  setAccessConfig: (config: AccessConfig) => void;
  toggleClip: (item: DigestItem) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authReady: false,
  date: kstToday(),
  category: '전체',
  items: [],
  loading: false,
  clipIds: new Set(),
  accessDenied: false,
  accessConfig: null,

  setUser: (user) => set({ user, authReady: true, accessDenied: false, accessConfig: null }),
  setCategory: (category) => set({ category }),

  loadDigest: async (date) => {
    set({ loading: true, date });
    try {
      const items = await fetchDigestItems(date);
      set({ items });
    } catch (e) {
      // 허용 목록에 없는 계정 → 접근 거부 화면으로 전환
      if (e instanceof FirebaseError && e.code === 'permission-denied') {
        set({ accessDenied: true });
      } else {
        throw e;
      }
    } finally {
      set({ loading: false });
    }
  },

  checkAdmin: async () => {
    const config = await fetchAccessConfig();
    if (config) set({ accessConfig: config });
  },

  setAccessConfig: (config) => set({ accessConfig: config }),

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
}));
