import { signInWithGoogle } from '../lib/firebase';

export function LoginScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-50 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">QuickClipper</h1>
        <p className="mt-3 text-slate-500">
          매일 아침, 내가 고른 소스의 소식만 한 곳에서
        </p>
      </div>
      <button
        onClick={() => signInWithGoogle().catch((e) => alert(`로그인 실패: ${e.message}`))}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
        </svg>
        Google로 로그인
      </button>
    </div>
  );
}
