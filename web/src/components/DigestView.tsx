import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, RefreshCw, Settings } from 'lucide-react';
import { CATEGORIES, kstToday, shiftDate } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { ItemCard } from './ItemCard';
import { SettingsModal } from './SettingsModal';
import { GameRankings } from './GameRankings';

const PAGE_SIZE = 20;

export function DigestView() {
  const { date, category, items, loading, accessConfig, setCategory, setView, loadDigest, loadClipIds, checkAdmin } =
    useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [gameMode, setGameMode] = useState<
    'news' | 'mobileHot' | 'steamHot' | 'mobile' | 'steam'
  >('news');

  // 탭·날짜·게임 하위 탭이 바뀌면 표시 개수 초기화
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, date, gameMode]);

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

  // 게임 "모바일 핫 / 스팀 핫": 키워드 기반으로 해당 플랫폼 뉴스만 추림
  const MOBILE_HOT_RE =
    /모바일|mobile|iOS|안드로이드|android|앱스토어|app store|구글\s?플레이|google play|가챠|gacha/i;
  const STEAM_HOT_RE = /스팀|steam|얼리\s?액세스|early access|넥스트\s?페스트|next fest|데모|demo/i;

  const displayList = useMemo(() => {
    if (category !== '게임' || (gameMode !== 'mobileHot' && gameMode !== 'steamHot')) {
      return filtered;
    }
    const re = gameMode === 'mobileHot' ? MOBILE_HOT_RE : STEAM_HOT_RE;
    return filtered.filter((it) =>
      re.test(`${it.title} ${it.summary} ${it.titleKo ?? ''} ${it.summaryKo ?? ''}`),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, category, gameMode]);

  const isToday = date === kstToday();

  // ── 좌우 스와이프/가로휠로 탭 이동 ──
  const tabs = useMemo(() => ['전체', ...availableCategories] as const, [availableCategories]);
  const tabsRef = useRef(tabs);
  const categoryRef = useRef(category);
  tabsRef.current = tabs;
  categoryRef.current = category;
  const navRef = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // fixed 헤더의 실제 높이만큼 본문 상단 여백 확보
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(104);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderH(el.offsetHeight));
    observer.observe(el);
    setHeaderH(el.offsetHeight);
    return () => observer.disconnect();
  }, []);
  /** 탭 전환 애니메이션 방향 ('right' = 새 리스트가 오른쪽에서 들어옴) */
  const [slideDir, setSlideDir] = useState<'right' | 'left' | null>(null);

  function changeCategory(next: (typeof tabs)[number]) {
    const list = tabsRef.current;
    const diff = list.indexOf(next) - list.indexOf(categoryRef.current as (typeof list)[number]);
    if (diff === 0) return;
    setSlideDir(diff > 0 ? 'right' : 'left');
    setCategory(next);
  }

  function switchTab(dir: 1 | -1) {
    const list = tabsRef.current;
    const next = list[list.indexOf(categoryRef.current as (typeof list)[number]) + dir];
    if (next) changeCategory(next);
  }

  // PC: Shift+휠 / 터치패드 두 손가락 가로 스와이프
  useEffect(() => {
    let acc = 0;
    let cooldownUntil = 0;
    const onWheel = (e: WheelEvent) => {
      // 탭 바 자체의 가로 스크롤은 그대로 두기
      if ((e.target as HTMLElement).closest('[data-tabnav]')) return;
      const dx = e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (dx === 0 || Math.abs(dx) < Math.abs(e.deltaY) * 0.8) return;
      const now = performance.now();
      if (now < cooldownUntil) return;
      acc += dx;
      if (Math.abs(acc) > 100) {
        switchTab(acc > 0 ? 1 : -1);
        acc = 0;
        cooldownUntil = now + 600; // 관성 스크롤로 연속 전환되는 것 방지
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 활성 탭이 바뀌면 탭 바에서 보이도록 스크롤
  useEffect(() => {
    navRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [category]);

  return (
    <div
      // touch-pan-y: 가로 팬 제스처를 브라우저가 처리하지 않게 해 스와이프 시 화면 출렁임 방지
      className="min-h-dvh touch-pan-y overscroll-x-none bg-slate-50"
      // 모바일: 좌우 스와이프로 탭 이동 (세로 스크롤과 구분되게 가로 우세 + 60px 이상일 때만)
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest('[data-tabnav]')) return;
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
          switchTab(dx < 0 ? 1 : -1);
        }
      }}
    >
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur"
      >
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
            <button
              onClick={() => setShowSettings(true)}
              aria-label="설정"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 카테고리 탭 + 새로고침 */}
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-4 pb-2">
          <nav ref={navRef} data-tabnav className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex gap-1.5 whitespace-nowrap">
              {tabs.map((cat) => (
                <button
                  key={cat}
                  data-active={category === cat}
                  onClick={() => changeCategory(cat)}
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
          <button
            onClick={() => {
              loadDigest(date);
              loadClipIds();
            }}
            disabled={loading}
            aria-label="새로고침"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* overflow-hidden 마스크 안에서 새 리스트가 방향에 맞춰 슬라이드 인 */}
      <main
        className="mx-auto max-w-2xl overflow-x-hidden px-4 pb-4"
        style={{ paddingTop: headerH + 16 }}
      >
        <div
          key={category}
          className={`flex flex-col gap-3 ${
            slideDir === 'right' ? 'tab-enter-right' : slideDir === 'left' ? 'tab-enter-left' : ''
          }`}
        >
        {/* 게임 탭 전용 하위 메뉴 */}
        {category === '게임' && (
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['news', '뉴스'],
                ['mobileHot', '모바일 핫'],
                ['steamHot', '스팀 핫'],
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

        {category === '게임' && (gameMode === 'mobile' || gameMode === 'steam') ? (
          <GameRankings mode={gameMode} />
        ) : loading ? (
          <p className="py-16 text-center text-slate-400">불러오는 중…</p>
        ) : displayList.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            {items.length === 0
              ? '이 날짜의 다이제스트가 없습니다'
              : '이 카테고리에 항목이 없습니다'}
          </p>
        ) : (
          <>
            {/* "전체" 탭은 전부 표시, 개별 카테고리 탭은 20건씩 + 더보기 */}
            {(category === '전체' ? displayList : displayList.slice(0, visibleCount)).map(
              (item) => (
                <ItemCard key={item.id} item={item} />
              ),
            )}
            {category !== '전체' && displayList.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100"
              >
                더보기 ({visibleCount} / {displayList.length})
              </button>
            )}
          </>
        )}
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
