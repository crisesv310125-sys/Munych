import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { authService } from '../data-access/authService';
import { getMe } from '../data-access/endpoints/me';
import { setOnAuthExpired } from '../data-access/apiClient';
import type { Session } from '../types';

/** Estado de UI pura: sesión y evento activo. Los datos de servidor viven en data-access/hooks.ts (TanStack Query). */
interface AppState {
  session: Session | null;
  sessionLoading: boolean;
  activeEventId: string | null;
}

interface AppActions {
  login: (email: string, password: string) => Promise<Session['role']>;
  loginWithMagicLink: (email: string) => Promise<void>;
  logout: () => void;
  setActiveEvent: (eventId: string | null) => void;
}

const AppStateCtx = createContext<(AppState & AppActions) | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  // GET /me por usuario, compartido entre login() y onAuthStateChange (SIGNED_IN, TOKEN_REFRESHED…)
  // para no repetir la petición en cada evento de Supabase. `fresh` ignora la petición anterior (login:
  // la que hubiera en curso se hizo con el token de una sesión vieja).
  const meRequest = useRef<{ userKey: string; promise: Promise<Session | null> } | null>(null);

  const resolveSession = useCallback((userKey: string | null, fresh = false): Promise<Session | null> => {
    if (!userKey) {
      meRequest.current = null;
      return Promise.resolve(null);
    }
    if (!fresh && meRequest.current?.userKey === userKey) return meRequest.current.promise;

    const promise = getMe().then((me): Session | null => {
      // role null = usuario sin rol en app.user_roles (o juez desactivado): no puede usar el panel.
      if (!me.role) return null;
      const email = me.email ?? '';
      return { role: me.role, name: me.full_name ?? email, email, judgeId: me.role === 'judge' ? me.user_id : null };
    });
    meRequest.current = { userKey, promise };
    promise.catch(() => {
      if (meRequest.current?.promise === promise) meRequest.current = null;
    });
    return promise;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = authService.onAuthStateChange((userKey) => {
      const promise = resolveSession(userKey);
      // Si mientras tanto hubo otro login/logout, este resultado ya no vale.
      const isCurrent = () => !cancelled && (userKey === null || meRequest.current?.promise === promise);
      promise
        .then((next) => {
          if (isCurrent()) setSession(next);
        })
        .catch(() => {
          if (isCurrent()) setSession(null);
        })
        .finally(() => {
          if (!cancelled) setSessionLoading(false);
        });
    });
    setOnAuthExpired(() => {
      meRequest.current = null;
      setSession(null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [resolveSession]);

  const setActiveEvent = useCallback((eventId: string | null) => setActiveEventId(eventId), []);

  const login = useCallback(
    async (email: string, password: string) => {
      const userKey = await authService.signInWithPassword(email, password);
      const next = await resolveSession(userKey, true);
      setSession(next);
      if (!next) {
        meRequest.current = null;
        await authService.signOut();
        throw new Error('Tu cuenta no tiene acceso al panel. Pide a un administrador que te asigne un rol.');
      }
      return next.role;
    },
    [resolveSession],
  );

  const loginWithMagicLink = useCallback(async (email: string) => {
    await authService.signInWithMagicLink(email);
  }, []);

  const logout = useCallback(() => {
    meRequest.current = null;
    authService.signOut();
    setSession(null);
  }, []);

  const value: AppState & AppActions = {
    session,
    sessionLoading,
    activeEventId,
    login,
    loginWithMagicLink,
    logout,
    setActiveEvent,
  };

  return <AppStateCtx.Provider value={value}>{children}</AppStateCtx.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error('useAppState debe usarse dentro de AppStateProvider');
  return ctx;
}
