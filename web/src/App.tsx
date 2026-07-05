import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useAppStore } from './store/useAppStore';
import { LoginScreen } from './components/LoginScreen';
import { DigestView } from './components/DigestView';
import { ClipsView } from './components/ClipsView';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';

function App() {
  const { user, authReady, accessDenied, view, setUser } = useAppStore();

  useEffect(() => onAuthStateChanged(auth, setUser), [setUser]);

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-400">
        로딩 중…
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  if (accessDenied) return <AccessDeniedScreen />;
  return view === 'clips' ? <ClipsView /> : <DigestView />;
}

export default App;
