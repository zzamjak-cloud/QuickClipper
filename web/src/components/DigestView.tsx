import { useEffect, useMemo, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, LogOut, Settings } from 'lucide-react';
import { CATEGORIES, kstToday, shiftDate } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { signOutUser } from '../lib/firebase';
import { ItemCard } from './ItemCard';
import { SettingsModal } from './SettingsModal';
import { GameRankings } from './GameRankings';

const PAGE_SIZE = 30;

export function DigestView() {
  const { date, category, items, loading, accessConfig, setCategory, setView, loadDigest, loadClipIds, checkAdmin } =
    useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [gameMode, setGameMode] = useState<'news' | 'mobile' | 'steam'>('news');

  // 탭·날짜가 바뀌면 표시 개수 초기화
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, date]);

  useEffect(() => {
    loadDigest(date);
    loadClipIds();
    checkAdmin();
    // 마운트 시 1회 (date 변경은 버튼 핸들러에서 loadDigest 직접 호출)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이 날짜에 실제로 존재하는 카테고리 탭만 노출
  const availableCategories = useMemo(() => {
    const present = new Set(items.map((it) => it.category));
    return CATEGORIES.filter((c) => present.has(c));
  }, [items]);

  const filtered = useMemo(
    () => (category === '전체' ? items : items.filter((it) => it.category === category)),
    [items, category],
  );

  const isToday = date === kstToday();

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">QuickClipper</h1>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <button
              onClick={() => loadDigest(shiftDate(date, -1))}
              aria-label="이전 날짜"
              className="rounded-lg p-1.5 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={date}
              max={kstToday()}
              onChange={(e) => e.target.value && loadDigest(e.target.value)}
              aria-label="날짜 선택"
              className="cursor-pointer rounded-lg bg-transparent px-1 py-0.5 font-medium tabular-nums outline-none hover:bg-slate-100"
            />
            <button
              onClick={() => loadDigest(shiftDate(date, 1))}
              disabled={isToday}
              aria-label="다음 날짜"
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setView('clips')}
              aria-label="보관함"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Bookmark className="h-4 w-4" />
            </button>
            {accessConfig && (
              <button
                onClick={() => setShowSettings(true)}
                aria-label="설정"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => signOutUser()}
              aria-label="로그아웃"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 카테고리 탭 */}
        <nav className="mx-auto max-w-2xl overflow-x-auto px-4 pb-2">
          <div className="flex gap-1.5 whitespace-nowrap">
            {(['전체', ...availableCategories] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  category === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4">
        {/* 게임 탭 전용 하위 메뉴: 뉴스 / 모바일 순위 / 스팀 순위 */}
        {category === '게임' && (
          <div className="flex gap-1.5">
            {(
              [
                ['news', '뉴스'],
                ['mobile', '모바일 순위'],
                ['steam', '스팀 순위'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setGameMode(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  gameMode === value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {category === '게임' && gameMode !== 'news' ? (
          <GameRankings mode={gameMode} />
        ) : loading ? (
          <p className="py-16 text-center text-slate-400">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            {items.length === 0
              ? '이 날짜의 다이제스트가 없습니다'
              : '이 카테고리에 항목이 없습니다'}
          </p>
        ) : (
          <>
            {filtered.slice(0, visibleCount).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
            {filtered.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100"
              >
                더보기 ({visibleCount} / {filtered.length})
              </button>
            )}
          </>
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
