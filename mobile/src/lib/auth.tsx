// حالة الدخول: المستخدم الحالي ورمز الجلسة
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, loadToken, setToken, setUnauthorizedHandler } from './api';

export type User = {
  id: string; name: string; email: string; phone?: string; phoneVerified?: boolean;
  role: 'patient' | 'doctor' | 'admin'; status: string; termsAcceptedAt?: string;
  doctor?: { specialty: string; verification: 'pending' | 'approved' | 'rejected' };
};

type Ctx = { user: User | null; ready: boolean; signedIn: (u: User) => void; signOut: () => Promise<void>; refresh: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User | null }>('/api/auth/me');
      setUser(me.user && me.user.role !== 'admin' ? me.user : null);
    } catch {}
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setUser(null); });
    loadToken().then(async t => { if (t) await refresh(); setReady(true); });
  }, [refresh]);

  const signOut = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, ready, signedIn: setUser, signOut, refresh }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
