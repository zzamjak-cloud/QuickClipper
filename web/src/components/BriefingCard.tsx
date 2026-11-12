import { Sparkles } from 'lucide-react';
import type { Briefing } from '../lib/types';

/** 오늘의 AI 브리핑 — 리포트 상단 요약 카드 */
export function BriefingCard({ briefing }: { briefing: Briefing }) {
  return (
    <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-sm sm:p-6 dark:border-indigo-900/60 dark:from-indigo-950/70 dark:via-slate-900 dark:to-slate-900">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        오늘의 브리핑
      </p>
      <h2 className="mt-2 text-xl font-bold leading-snug text-slate-900 sm:text-2xl dark:text-slate-50">
        {briefing.headline}
      </h2>
      <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">{briefing.summary}</p>
      <ul className="mt-4 space-y-2 border-t border-indigo-100 pt-4 dark:border-indigo-900/60">
        {briefing.keyPoints.map((point, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-900/70 dark:text-indigo-200">
              {i + 1}
            </span>
            <span className="min-w-0">{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
