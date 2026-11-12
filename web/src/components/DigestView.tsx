import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { formatDateLabel, kstToday, shiftDate } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { NewsList } from './NewsList';
import { ReportArticle } from './ReportArticle';

/** 이전 스키마는 날짜당 수백 건이라 짧은 소식 폴백은 상위 일부만 보여준다 */
const FALLBACK_LIMIT = 40;

/** 단일 화면: 날짜 선택 + 리포트 문서 (없으면 짧은 소식 폴백) */
export function DigestView() {
  const { date, items, report, loading, error, loadDigest } = useAppStore();

  useEffect(() => {
    loadDigest(date);
    // 마운트 시 1회 (날짜 변경은 핸들러에서 loadDigest 직접 호출)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isToday = date === kstToday();

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-2 px-4 py-3">
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

      <main className="mx-auto max-w-[760px] px-4 pb-16 pt-6">
        <p className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
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
        ) : report ? (
          <ReportArticle report={report} items={items} />
        ) : (
          // 리포트가 없는 날(AI 요약 실패·이전 스키마): 수집 원문을 짧은 소식으로
          <section>
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              이 날짜는 정리된 리포트가 없어 수집된 소식을 목록으로 보여줍니다.
            </p>
            <div className="mt-2">
              <NewsList entries={items.slice(0, FALLBACK_LIMIT).map((item) => ({ item }))} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
