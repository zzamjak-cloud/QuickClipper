import { useState } from 'react';
import { ExternalLink, Lightbulb } from 'lucide-react';
import type { DigestItem } from '../lib/types';
import { faviconUrl, timeAgo } from '../lib/types';

interface Props {
  item: DigestItem;
  onTagClick: (tag: string) => void;
}

export function ItemCard({ item, onTagClick }: Props) {
  const [imgError, setImgError] = useState(false);

  // AI 리포트가 있으면 한국어 우선, 원문 폴백이면 원문 그대로
  const title = item.titleKo ?? item.title;
  const summary = item.summaryKo ?? item.summary;
  const favicon = faviconUrl(item.url);
  const ago = timeAgo(item.publishedAt);
  const showImage = !!item.imageUrl && !imgError;
  const related = item.relatedSources ?? [];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-300">
              {String(item.rank).padStart(2, '0')}
            </span>
            <span aria-hidden>·</span>
            {favicon && <img src={favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />}
            <span className="font-medium text-slate-600 dark:text-slate-300">{item.sourceName}</span>
            {ago && (
              <>
                <span aria-hidden>·</span>
                <span>{ago}</span>
              </>
            )}
          </div>
          <h3 className="mt-1.5 text-[17px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-300"
            >
              {title}
            </a>
          </h3>
          {item.titleKo && item.titleKo !== item.title && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-400 dark:text-slate-500">{item.title}</p>
          )}
        </div>
        {showImage && (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            className="hidden h-20 w-32 shrink-0 rounded-xl bg-slate-100 object-cover sm:block dark:bg-slate-800"
          />
        )}
      </div>

      {summary && (
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{summary}</p>
      )}

      {item.whyItMatters && (
        <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <p>
            <span className="font-semibold">왜 중요한가 </span>
            {item.whyItMatters}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.tags?.map((tag) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            #{tag}
          </button>
        ))}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
        >
          원문 보기
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      {/* 교차 보도: 같은 소식을 다룬 다른 소스 */}
      {related.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800">
          <span className="font-medium text-slate-500 dark:text-slate-400">함께 보도</span>
          {related.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-slate-300 hover:text-slate-600 dark:decoration-slate-600 dark:hover:text-slate-300"
            >
              {s.name}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
