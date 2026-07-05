import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import type { Category, Clip, DigestItem } from '../lib/types';
import { kstToday } from '../lib/types';
import { fetchDigestItems } from '../lib/digest';
import { addClip, fetchClipIds, fetchClips, removeClip, updateClipMeta } from '../lib/clips';
import type { AccessConfig } from '../lib/access';
import { fetchAccessConfig } from '../lib/access';

interface AppState {
  user: User | null;
  authReady: boolean;
  /** 현재 화면: 오늘의 다이제스트 / 스크랩 보관함 */
  view: 'digest' | 'clips';
  date: string;
  category: Category | '전체';
  items: DigestItem[];
  loading: boolean;
  clipIds: Set<string>;
  clips: Clip[];
  clipsLoading: boolean;
  /** 허용 목록에 없는 계정으로 로그인한 상태 */
  accessDenied: boolean;
  /** 관리자 여부 (config/access 읽기 성공 = 관리자) */
  accessConfig: AccessConfig | null;

  setUser: (user: User | null) => void;
  setView: (view: 'digest' | 'clips') => void;
  setCategory: (category: Category | '전체') => void;
  loadDigest: (date: string) => Promise<void>;
  loadClipIds: () => Promise<void>;
  loadClips: () => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  saveClipMeta: (clipId: string, meta: { tags?: string[]; memo?: string }) => Promise<void>;
  checkAdmin: () => Promise<void>;
  setAccessConfig: (config: AccessConfig) => void;
  toggleClip: (item: DigestItem) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authReady: false,
  view: 'digest',
  date: kstToday(),
  category: '전체',
  items: [],
  loading: false,
  clipIds: new Set(),
  clips: [],
  clipsLoading: false,
  accessDenied: false,
  accessConfig: null,

  setUser: (user) => set({ user, authReady: true, accessDenied: false, accessConfig: null }),
  setView: (view) => set({ view }),
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

  loadClips: async () => {
    const { user } = get();
    if (!user) return;
    set({ clipsLoading: true });
    try {
      const clips = await fetchClips(user.uid);
      // 최근 스크랩 순 정렬
      clips.sort((a, b) => (b.clippedAt?.toMillis() ?? 0) - (a.clippedAt?.toMillis() ?? 0));
      set({ clips });
    } finally {
      set({ clipsLoading: false });
    }
  },

  deleteClip: async (clipId) => {
    const { user, clips, clipIds } = get();
    if (!user) return;
    const nextIds = new Set(clipIds);
    nextIds.delete(clipId);
    set({ clips: clips.filter((c) => c.id !== clipId), clipIds: nextIds }); // 낙관적 업데이트
    await removeClip(user.uid, clipId);
  },

  saveClipMeta: async (clipId, meta) => {
    const { user, clips } = get();
    if (!user) return;
    set({ clips: clips.map((c) => (c.id === clipId ? { ...c, ...meta } : c)) });
    await updateClipMeta(user.uid, clipId, meta);
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
