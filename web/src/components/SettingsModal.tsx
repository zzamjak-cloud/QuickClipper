import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { updateAllowedEmails } from '../lib/access';
import { addSource, deleteSource, fetchSources } from '../lib/sources';
import type { Category, SourceDef } from '../lib/types';
import { CATEGORIES } from '../lib/types';

interface Props {
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 관리자 전용 설정 팝업 — 허용 이메일 계정 + 수집 소스 관리 */
export function SettingsModal({ onClose }: Props) {
  const { accessConfig, setAccessConfig } = useAppStore();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  // 수집 소스 관리 상태
  const [sources, setSources] = useState<SourceDef[]>([]);
  const [srcName, setSrcName] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [srcCategory, setSrcCategory] = useState<Category>('IT');
  const [srcLang, setSrcLang] = useState<'ko' | 'en'>('en');
  const [srcSaving, setSrcSaving] = useState(false);

  useEffect(() => {
    fetchSources().then(setSources).catch(() => {});
  }, []);

  if (!accessConfig) return null;
  const { admins, allowed } = accessConfig;

  async function addRssSource() {
    const name = srcName.trim();
    const url = srcUrl.trim();
    if (!name || !/^https?:\/\/.+/.test(url)) {
      alert('이름과 올바른 RSS 주소(https://…)를 입력해주세요');
      return;
    }
    const source: SourceDef = {
      id: `rss-${Date.now().toString(36)}`,
      name,
      type: 'rss',
      category: srcCategory,
      target: url,
      lang: srcLang,
    };
    setSrcSaving(true);
    try {
      await addSource(source);
      setSources((prev) => [...prev, source]);
      setSrcName('');
      setSrcUrl('');
    } catch (e) {
      alert(`소스 추가 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSrcSaving(false);
    }
  }

  async function removeSource(id: string) {
    if (!confirm('이 소스를 삭제할까요? 다음 수집부터 제외됩니다.')) return;
    await deleteSource(id);
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  async function save(nextAllowed: string[]) {
    setSaving(true);
    try {
      await updateAllowedEmails(nextAllowed);
      setAccessConfig({ admins, allowed: nextAllowed });
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  }

  async function addEmail() {
    const email = input.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      alert('올바른 이메일 형식이 아닙니다');
      return;
    }
    if (allowed.includes(email) || admins.includes(email)) {
      alert('이미 등록된 계정입니다');
      return;
    }
    await save([...allowed, email]);
    setInput('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">계정 관리</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          허용된 계정만 앱에 로그인해 다이제스트를 볼 수 있습니다.
        </p>

        {/* 관리자 (고정) */}
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          관리자
        </h3>
        <ul className="mt-1.5 space-y-1">
          {admins.map((email) => (
            <li
              key={email}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
            >
              {email}
            </li>
          ))}
        </ul>

        {/* 허용 계정 */}
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          허용 계정
        </h3>
        <ul className="mt-1.5 space-y-1">
          {allowed
            .filter((email) => !admins.includes(email))
            .map((email) => (
              <li
                key={email}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                {email}
                <button
                  onClick={() => save(allowed.filter((e) => e !== email))}
                  disabled={saving}
                  aria-label={`${email} 제거`}
                  className="rounded-md p-1 text-slate-400 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          {allowed.filter((e) => !admins.includes(e)).length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">추가된 계정이 없습니다</li>
          )}
        </ul>

        {/* 계정 추가 */}
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEmail()}
            placeholder="email@example.com"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <button
            onClick={addEmail}
            disabled={saving || !input.trim()}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            추가
          </button>
        </div>

        {/* ── 수집 소스 관리 ── */}
        <hr className="my-5 border-slate-100" />
        <h2 className="text-lg font-bold text-slate-900">수집 소스</h2>
        <p className="mt-1 text-xs text-slate-500">
          변경 사항은 다음 수집(매일 06:30)부터 반영됩니다. RSS 소스만 추가할 수 있습니다.
        </p>

        <ul className="mt-3 space-y-1">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {s.category}
                </span>
                <span className="font-medium text-slate-700">{s.name}</span>
                <span className="ml-1.5 text-[11px] text-slate-400">{s.type}</span>
              </div>
              <button
                onClick={() => removeSource(s.id)}
                aria-label={`${s.name} 삭제`}
                className="shrink-0 rounded-md p-1 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* 소스 추가 */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={srcName}
              onChange={(e) => setSrcName(e.target.value)}
              placeholder="소스 이름"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <select
              value={srcCategory}
              onChange={(e) => setSrcCategory(e.target.value as Category)}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={srcLang}
              onChange={(e) => setSrcLang(e.target.value as 'ko' | 'en')}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none"
            >
              <option value="en">영어</option>
              <option value="ko">한국어</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={srcUrl}
              onChange={(e) => setSrcUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRssSource()}
              placeholder="RSS 피드 주소 (https://…)"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <button
              onClick={addRssSource}
              disabled={srcSaving || !srcName.trim() || !srcUrl.trim()}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {srcSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
