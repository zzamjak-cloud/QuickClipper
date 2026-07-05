import { useEffect, useRef, useState } from 'react';
import { Newspaper } from 'lucide-react';
import type { WeeklyReport } from '../lib/types';
import { fetchReports } from '../lib/ai';
import { useAppStore } from '../store/useAppStore';

/** 주간 트렌드 리포트 열람 화면 */
export function ReportsView() {
  const setView = useAppStore((s) => s.setView);
  const [reports, setReports] = useState<WeeklyReport[] | null>(null);
  const [selected, setSelected] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(60);

  useEffect(() => {
    fetchReports()
      .then(setReports)
      .catch(() => setReports([]));
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderH(el.offsetHeight));
    observer.observe(el);
    setHeaderH(el.offsetHeight);
    return () => observer.disconnect();
  }, []);

  const report = reports?.[selected];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">주간 리포트</h1>
          <button
            onClick={() => setView('digest')}
            aria-label="다이제스트로 이동"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            <Newspaper className="h-4 w-4" />
            다이제스트
          </button>
        </div>
        {reports && reports.length > 1 && (
          <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-2">
            <div className="flex gap-1.5 whitespace-nowrap">
              {reports.map((r, i) => (
                <button
                  key={r.weekId}
                  onClick={() => setSelected(i)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                    selected === i
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ~{r.endDate.slice(5)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-8" style={{ paddingTop: headerH + 16 }}>
        {reports === null ? (
          <p className="py-16 text-center text-slate-400">불러오는 중…</p>
        ) : !report ? (
          <p className="py-16 text-center text-slate-400">
            아직 리포트가 없습니다. 매주 일요일 아침에 자동 생성됩니다.
          </p>
        ) : (
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold leading-snug text-slate-900">{report.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {report.startDate} ~ {report.endDate}
            </p>
            <div className="mt-4 space-y-5">
              {report.sections.map((section, i) => (
                <section key={i}>
                  <h3 className="font-semibold text-slate-800">{section.heading}</h3>
                  <p className="mt-1.5 whitespace-pre-line leading-relaxed text-slate-600">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
