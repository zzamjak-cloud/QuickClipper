import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import type { DigestItem } from '../lib/types';
import { faviconUrl } from '../lib/types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  item: DigestItem;
}

export function ItemCard({ item }: Props) {
  const { clipIds, toggleClip, trackClick } = useAppStore();
  const clipped = clipIds.has(item.id);
  const [imgError, setImgError] = useState(false);

  // 배치 번역이 있으면 한국어 우선 표시 (본문 번역은 크롬 내장 번역 활용)
  const title = item.titleKo ?? item.title;
  // 교차 보도 이슈는 AI 종합 요약 우선
  const summary = item.clusterSummary ?? item.summaryKo ?? item.summary;
  const favicon = faviconUrl(item.url);
  const showImage = !!item.imageUrl && !imgError;
  const related = item.relatedSources ?? [];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackClick(item)}
        className="flex gap-3"
      >
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-semibold leading-snug text-slate-900">{title}</h2>
          {summary && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">{summary}</p>
          )}
        </div>
        {showImage && (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-[4.5rem] w-28 shrink-0 rounded-lg bg-slate-100 object-cover"
          />
        )}
      </a>

      {/* 교차 보도: 다른 소스 링크 */}
      {related.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-600">
            {related.length + 1}개 소스 보도
          </span>
          {related.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-300 hover:text-slate-600"
            >
              {s.name}
            </a>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        {favicon && <img src={favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />}
        <span className="font-medium text-slate-500">{item.sourceName}</span>
        <span>·</span>
        <span>{item.score}점</span>
        <button
          onClick={() => toggleClip(item)}
          aria-label={clipped ? '스크랩 해제' : '스크랩'}
          className={`ml-auto rounded-lg p-1 transition ${
            clipped ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'
          }`}
        >
          <Bookmark className="h-5 w-5" fill={clipped ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  );
}
