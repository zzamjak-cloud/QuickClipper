import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import type { DigestItem } from '../lib/types';
import type { TranslatedArticle } from '../lib/reader';
import { readArticle } from '../lib/reader';

interface Props {
  item: DigestItem;
  date: string;
  onClose: () => void;
}

/** 앱 내 번역 리더 — 영문 기사를 한국어 전문 번역으로 표시 */
export function ArticleReader({ item, date, onClose }: Props) {
  const [article, setArticle] = useState<TranslatedArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readArticle(date, item.id)
      .then((result) => !cancelled && setArticle(result))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [date, item.id]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* 리더 헤더 */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="닫기"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-500">
          {item.sourceName}
        </span>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          원문 열기
        </a>
      </div>

      {/* 본문 */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-5 py-6">
          {error ? (
            <div className="py-16 text-center">
              <p className="text-slate-500">번역을 가져오지 못했습니다</p>
              <p className="mt-1 text-xs text-slate-400">{error}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                원문으로 보기
              </a>
            </div>
          ) : !article ? (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              <p className="text-sm">본문을 번역하는 중… (처음 여는 기사는 10~30초)</p>
            </div>
          ) : (
            <article>
              <h1 className="text-xl font-bold leading-snug text-slate-900">{article.title}</h1>
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="mt-4 w-full rounded-xl bg-slate-100 object-cover"
                />
              )}
              <div className="mt-5 space-y-4">
                {article.paragraphs.map((p, i) => (
                  <p key={i} className="leading-relaxed text-slate-700">
                    {p}
                  </p>
                ))}
              </div>
              <p className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
                AI 번역본 · 정확한 내용은{' '}
                <a href={item.url} target="_blank" rel="noreferrer" className="underline">
                  원문
                </a>
                을 확인하세요
              </p>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
