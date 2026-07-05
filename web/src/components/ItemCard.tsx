import { Bookmark, ExternalLink } from 'lucide-react';
import type { DigestItem } from '../lib/types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  item: DigestItem;
}

export function ItemCard({ item }: Props) {
  const { clipIds, toggleClip } = useAppStore();
  const clipped = clipIds.has(item.id);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold leading-snug text-slate-900 hover:text-blue-600"
        >
          {item.title}
          <ExternalLink className="ml-1 inline h-3.5 w-3.5 text-slate-400" aria-hidden />
        </a>
        <button
          onClick={() => toggleClip(item)}
          aria-label={clipped ? '스크랩 해제' : '스크랩'}
          className={`shrink-0 rounded-lg p-1.5 transition ${
            clipped ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'
          }`}
        >
          <Bookmark className="h-5 w-5" fill={clipped ? 'currentColor' : 'none'} />
        </button>
      </div>

      {item.summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.summary}</p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
          {item.sourceName}
        </span>
        <span>{item.score}점</span>
      </div>
    </article>
  );
}
