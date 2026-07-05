import { Sparkles } from 'lucide-react';
import type { Briefing } from '../lib/types';

/** 오늘의 AI 브리핑 — 전체 탭 상단 카드 */
export function BriefingCard({ briefing }: { briefing: Briefing }) {
  return (
    <section className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-indigo-700">
        <Sparkles className="h-4 w-4" aria-hidden />
        오늘의 브리핑
      </h2>
      <ol className="mt-3 space-y-2.5">
        {briefing.points.map((point, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-slate-900">
                {point.title}
                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                  {point.category}
                </span>
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{point.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
