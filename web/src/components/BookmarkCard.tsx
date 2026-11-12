import { ArrowUpRight } from 'lucide-react';
import type { DigestItem } from '../lib/types';
import { domainOf, faviconUrl } from '../lib/types';
import { SafeImage } from './SafeImage';

/** 원문으로 이어지는 북마크 링크 카드 (썸네일·제목·이유·출처·도메인) */
export function BookmarkCard({ item, reason }: { item: DigestItem; reason: string }) {
  const favicon = faviconUrl(item.url);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-300">
          {item.title}
        </p>
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{reason}</p>
        <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-slate-400 dark:text-slate-500">
          {favicon && (
            <img src={favicon} alt="" referrerPolicy="no-referrer" className="h-3.5 w-3.5 rounded-sm" />
          )}
          <span className="font-medium text-slate-600 dark:text-slate-300">{item.sourceName}</span>
          <span className="truncate">{domainOf(item.url)}</span>
          <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden />
        </p>
      </div>
      <SafeImage
        src={item.imageUrl}
        wrapperClassName="w-24 shrink-0 sm:w-28"
        className="h-full w-full bg-slate-100 object-cover dark:bg-slate-800"
      />
    </a>
  );
}
