import { useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { updateAllowedEmails } from '../lib/access';

interface Props {
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 관리자 전용 설정 팝업 — 허용 이메일 계정 관리 */
export function SettingsModal({ onClose }: Props) {
  const { accessConfig, setAccessConfig } = useAppStore();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (!accessConfig) return null;
  const { admins, allowed } = accessConfig;

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
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
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
      </div>
    </div>
  );
}
