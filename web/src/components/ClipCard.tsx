import { useState } from 'react';
import { ExternalLink, Tag, Trash2, X } from 'lucide-react';
import type { Clip } from '../lib/types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  clip: Clip;
}

export function ClipCard({ clip }: Props) {
  const { deleteClip, saveClipMeta } = useAppStore();
  const [tagInput, setTagInput] = useState('');
  const [memo, setMemo] = useState(clip.memo ?? '');
  const tags = clip.tags ?? [];

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag)) {
      setTagInput('');
      return;
    }
    saveClipMeta(clip.id, { tags: [...tags, tag] });
    setTagInput('');
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <a
          href={clip.url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold leading-snug text-slate-900 hover:text-blue-600"
        >
          {clip.title}
          <ExternalLink className="ml-1 inline h-3.5 w-3.5 text-slate-400" aria-hidden />
        </a>
        <button
          onClick={() => confirm('이 스크랩을 삭제할까요?') && deleteClip(clip.id)}
          aria-label="스크랩 삭제"
          className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {clip.summary && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{clip.summary}</p>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
          {clip.category}
        </span>
        <span>{clip.sourceName}</span>
        <span>{clip.digestDate} 수집</span>
      </div>

      {/* 태그 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Tag className="h-3.5 w-3.5 text-slate-300" aria-hidden />
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
          >
            #{tag}
            <button
              onClick={() => saveClipMeta(clip.id, { tags: tags.filter((t) => t !== tag) })}
              aria-label={`태그 ${tag} 제거`}
              className="text-amber-400 hover:text-amber-600"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          onBlur={() => tagInput.trim() && addTag()}
          placeholder="+ 태그"
          className="w-20 bg-transparent text-xs text-slate-600 outline-none placeholder:text-slate-300"
        />
      </div>

      {/* 메모 */}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() => memo !== (clip.memo ?? '') && saveClipMeta(clip.id, { memo })}
        placeholder="메모 남기기…"
        rows={memo ? 2 : 1}
        className="mt-2 w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-300 focus:bg-slate-100"
      />
    </article>
  );
}
