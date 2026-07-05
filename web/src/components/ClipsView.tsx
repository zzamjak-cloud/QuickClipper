import { useEffect, useMemo, useRef, useState } from 'react';
import { Newspaper, Search } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ClipCard } from './ClipCard';

/** 스크랩 보관함 — 검색(제목/요약/태그/메모) + 최신순 목록 */
export function ClipsView() {
  const { clips, clipsLoading, loadClips, setView } = useAppStore();
  const [query, setQuery] = useState('');
  // fixed 헤더의 실제 높이만큼 본문 상단 여백 확보
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(112);

  useEffect(() => {
    loadClips();
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderH(el.offsetHeight));
    observer.observe(el);
    setHeaderH(el.offsetHeight);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        (c.memo ?? '').toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [clips, query]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">보관함</h1>
          <button
            onClick={() => setView('digest')}
            aria-label="다이제스트로 이동"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            <Newspaper className="h-4 w-4" />
            다이제스트
          </button>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 요약, 태그, 메모 검색"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </header>

      <main
        className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pb-4"
        style={{ paddingTop: headerH + 16 }}
      >
        {clipsLoading ? (
          <p className="py-16 text-center text-slate-400">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            {clips.length === 0
              ? '아직 스크랩한 항목이 없습니다. 다이제스트에서 북마크를 눌러보세요.'
              : '검색 결과가 없습니다'}
          </p>
        ) : (
          filtered.map((clip) => <ClipCard key={clip.id} clip={clip} />)
        )}
      </main>
    </div>
  );
}
