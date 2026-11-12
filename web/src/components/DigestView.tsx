import { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles, X } from 'lucide-react';
import { formatDateLabel, kstToday, shiftDate } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { BriefingCard } from './BriefingCard';
import { ItemCard } from './ItemCard';

/** 단일 화면: 날짜 선택 + 브리핑 + 뉴스 카드 목록 (태그 필터) */
export function DigestView() {
  const { date, items, briefing, loading, error, tag, setTag, loadDigest } = useAppStore();

  useEffect(() => {
    loadDigest(date);
    // 마운트 시 1회 (날짜 변경은 핸들러에서 loadDigest 직접 호출)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 많이 쓰인 태그순으로 필터 칩 노출
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) for (const t of it.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [items]);

  const visible = useMemo(
    () => (tag ? items.filter((it) => it.tags?.includes(tag)) : items),
    [items, tag],
  );

  const isToday = date === kstToday();

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <h1 className="flex items-center gap-1.5 text-base font-bold sm:text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-indigo-500">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            AI 데일리
          </h1>
          <div className="flex items-center gap-0.5 text-sm text-slate-600 dark:text-slate-300">
            <button
              onClick={() => loadDigest(shiftDate(date, -1))}
              aria-label="이전 날짜"
              className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={date}
              max={kstToday()}
              onChange={(e) => e.target.value && loadDigest(e.target.value)}
              aria-label="날짜 선택"
              className="cursor-pointer rounded-lg bg-transparent px-1 py-0.5 font-medium tabular-nums outline-none hover:bg-slate-100 dark:scheme-dark dark:hover:bg-slate-800"
            />
            <button
              onClick={() => loadDigest(shiftDate(date, 1))}
              disabled={isToday}
              aria-label="다음 날짜"
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => loadDigest(date)}
              disabled={loading}
              aria-label="새로고침"
              className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-12 pt-5">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {formatDateLabel(date)} AI 리포트
        </p>

        {loading && items.length === 0 ? (
          <p className="py-16 text-center text-slate-400">불러오는 중…</p>
        ) : error ? (
          <p className="py-16 text-center text-slate-400">리포트를 불러오지 못했습니다 ({error})</p>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            {isToday ? '오늘 리포트가 아직 발행되지 않았습니다' : '이 날짜의 리포트가 없습니다'}
          </p>
        ) : (
          <>
            {briefing ? (
              <BriefingCard briefing={briefing} />
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                AI 요약을 만들지 못한 날이라 수집된 원문 목록을 그대로 보여줍니다.
              </p>
            )}

            {tags.length > 0 && (
              <nav aria-label="태그 필터" className="-mx-4 overflow-x-auto px-4">
                <div className="flex gap-1.5 whitespace-nowrap">
                  <button
                    onClick={() => setTag(null)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      tag === null
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    전체 {items.length}
                  </button>
                  {tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTag(tag === t ? null : t)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition ${
                        tag === t
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      #{t}
                      {tag === t && <X className="h-3.5 w-3.5" aria-hidden />}
                    </button>
                  ))}
                </div>
              </nav>
            )}

            <div className="flex flex-col gap-3">
              {visible.map((item) => (
                <ItemCard key={item.id} item={item} onTagClick={(t) => setTag(t)} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
