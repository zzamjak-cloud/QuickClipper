import { ShieldX } from 'lucide-react';
import { signOutUser } from '../lib/firebase';
import { useAppStore } from '../store/useAppStore';

export function AccessDeniedScreen() {
  const user = useAppStore((s) => s.user);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <ShieldX className="h-12 w-12 text-slate-300" aria-hidden />
      <div>
        <h1 className="text-xl font-bold text-slate-900">접근 권한이 없습니다</h1>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{user?.email}</span> 계정은 허용 목록에
          없습니다.
          <br />
          관리자에게 계정 등록을 요청해주세요.
        </p>
      </div>
      <button
        onClick={() => signOutUser()}
        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
      >
        다른 계정으로 로그인
      </button>
    </div>
  );
}
