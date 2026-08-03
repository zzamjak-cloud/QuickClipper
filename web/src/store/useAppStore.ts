import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import type { Briefing, Category, Clip, DigestItem, UserProfile } from '../lib/types';
import { kstToday } from '../lib/types';
import { fetchDigestBriefing, fetchDigestItems } from '../lib/digest';
import { addClip, fetchClipIds, fetchClips, removeClip, updateClipMeta } from '../lib/clips';
import type { AccessConfig } from '../lib/access';
import { fetchAccessConfig } from '../lib/access';
import { fetchProfile, recordClick } from '../lib/ai';

/** 다이제스트 탭: 카테고리 + 가상 탭(전체/추천) */
export type Tab = Category | '전체' | '추천';

interface AppState {
  user: User | null;
  authReady: boolean;
  /** 현재 화면: 다이제스트 / 보관함 / 주간 리포트 */
  view: 'digest' | 'clips' | 'reports';
  date: string;
  category: Tab;
  items: DigestItem[];
  loading: boolean;
  /** 오늘의 AI 브리핑 */
  briefing: Briefing | null;
  /** 관심 프로필 (추천 탭 정렬용) */
  profile: UserProfile | null;
  clipIds: Set<string>;
  clips: Clip[];
  clipsLoading: boolean;
  /** 허용 목록에 없는 계정으로 로그인한 상태 */
  accessDenied: boolean;
  /** 관리자 여부 (config/access 읽기 성공 = 관리자) */
  accessConfig: AccessConfig | null;

  setUser: (user: User | null) => void;
  setView: (view: 'digest' | 'clips' | 'reports') => void;
  setCategory: (category: Tab) => void;
  loadDigest: (date: string) => Promise<void>;
  loadClipIds: () => Promise<void>;
  loadClips: () => Promise<void>;
  /** 기존 관심 프로필 로드 (AI 재생성 없음) */
  ensureProfile: () => Promise<void>;
  trackClick: (item: DigestItem) => void;
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
  briefing: null,
  profile: null,
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
      const [items, briefing] = await Promise.all([
        fetchDigestItems(date),
        fetchDigestBriefing(date).catch(() => null),
      ]);
      set({ items, briefing });
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

  ensureProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await fetchProfile(user.uid).catch(() => null);
    if (profile) set({ profile });
  },

  trackClick: (item) => {
    const { user } = get();
    if (user) recordClick(user.uid, item);
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
