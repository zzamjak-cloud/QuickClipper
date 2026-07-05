import { useState } from 'react';
import { Bookmark, ExternalLink, Languages, Loader2 } from 'lucide-react';
import type { DigestItem } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { translateItem } from '../lib/translate';

interface Props {
  item: DigestItem;
}

export function ItemCard({ item }: Props) {
  const { clipIds, toggleClip, applyTranslation, date } = useAppStore();
  const clipped = clipIds.has(item.id);
  const [translating, setTranslating] = useState(false);
  const [showKo, setShowKo] = useState(!!item.titleKo);

  const hasTranslation = !!item.titleKo;
  const title = showKo && item.titleKo ? item.titleKo : item.title;
  const summary = showKo && item.summaryKo ? item.summaryKo : item.summary;

  async function onTranslate() {
    // 캐시가 있으면 원문↔번역 토글만, 없으면 번역 호출
    if (hasTranslation) {
      setShowKo((v) => !v);
      return;
    }
    setTranslating(true);
    try {
      const { titleKo, summaryKo } = await translateItem(date, item.id);
      applyTranslation(item.id, titleKo, summaryKo);
      setShowKo(true);
    } catch (e) {
      alert(`번역 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold leading-snug text-slate-900 hover:text-blue-600"
        >
          {title}
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

      {summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{summary}</p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
          {item.sourceName}
        </span>
        <span>{item.score}점</span>
        {item.lang === 'en' && (
          <button
            onClick={onTranslate}
            disabled={translating}
            className="ml-auto flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {translating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Languages className="h-3.5 w-3.5" aria-hidden />
            )}
            {hasTranslation ? (showKo ? '원문 보기' : '번역 보기') : '번역하기'}
          </button>
        )}
      </div>
    </article>
  );
}
