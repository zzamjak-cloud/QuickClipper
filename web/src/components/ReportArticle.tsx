import type { DigestItem, Report } from '../lib/types';
import { BookmarkCard } from './BookmarkCard';
import { NewsList, type NewsEntry } from './NewsList';
import { SafeImage } from './SafeImage';

interface Props {
  report: Report;
  items: DigestItem[];
}

/** 하나의 리포트 문서: 헤드라인·리드 → 주제 섹션(대표 이미지·본문·북마크) → 짧은 소식 → 출처 전체 */
export function ReportArticle({ report, items }: Props) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const briefs = report.briefs.flatMap((b): NewsEntry[] => {
    const item = byId.get(b.id);
    return item ? [{ item, line: b.oneLine }] : [];
  });

  return (
    <article className="flex flex-col gap-10">
      <header>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem] dark:text-slate-50">
          {report.headline}
        </h2>
        <p className="mt-4 text-[17px] leading-8 text-slate-700 dark:text-slate-300">{report.lede}</p>
        {/* 목차 */}
        <nav aria-label="목차" className="mt-5 flex flex-wrap gap-1.5">
          {report.sections.map((s, i) => (
            <a
              key={i}
              href={`#section-${i + 1}`}
              className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-indigo-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:text-indigo-300"
            >
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>
      </header>

      {report.sections.map((section, i) => {
        const hero = section.heroId ? byId.get(section.heroId) : undefined;
        const bookmarks = section.bookmarks.flatMap((b) => {
          const item = byId.get(b.id);
          return item ? [{ item, reason: b.reason }] : [];
        });
        return (
          <section key={i} id={`section-${i + 1}`} className="scroll-mt-20">
            <h3 className="flex items-baseline gap-2 text-xl font-bold text-slate-900 dark:text-slate-50">
              <span className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              {section.title}
            </h3>
            {hero && (
              <SafeImage
                src={hero.imageUrl}
                wrapperClassName="mt-4 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800"
                className="aspect-[16/9] w-full object-cover"
              />
            )}
            <div className="mt-4 space-y-4 text-[16px] leading-8 text-slate-700 dark:text-slate-300">
              {section.body.map((paragraph, j) => (
                <p key={j}>{paragraph}</p>
              ))}
            </div>
            {bookmarks.length > 0 && (
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {bookmarks.map(({ item, reason }) => (
                  <BookmarkCard key={item.id} item={item} reason={reason} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {briefs.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">짧은 소식</h3>
          <div className="mt-2">
            <NewsList entries={briefs} />
          </div>
        </section>
      )}

      <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">
          출처 전체 ({items.length}건)
        </summary>
        <NewsList entries={items.map((item) => ({ item }))} />
      </details>
    </article>
  );
}
