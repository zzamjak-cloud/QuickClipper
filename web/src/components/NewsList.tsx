import type { DigestItem } from '../lib/types';
import { domainOf, timeAgo } from '../lib/types';

export interface NewsEntry {
  item: DigestItem;
  /** 한 줄 설명 (없으면 제목만) */
  line?: string;
}

/** 짧은 소식 목록 — 리포트의 briefs, 그리고 리포트가 없는 날의 폴백 화면에 쓴다 */
export function NewsList({ entries }: { entries: NewsEntry[] }) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {entries.map(({ item, line }) => {
        const ago = timeAgo(item.publishedAt);
        return (
          <li key={item.id} className="py-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium leading-snug text-slate-900 hover:text-indigo-600 hover:underline dark:text-slate-100 dark:hover:text-indigo-300"
            >
              {line ?? item.titleKo ?? item.title}
            </a>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {item.sourceName} · {domainOf(item.url)}
              {ago && ` · ${ago}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
