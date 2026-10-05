import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setUnauthorizedHandler, tokenStore } from '../services/api';
import { isOfflineApp } from '../services/backend';
import { authApi } from '../services/endpoints';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Web sessions are a JWT in storage; installed apps keep their session in the local data layer. */
const hasStoredSession = () => isOfflineApp() || !!tokenStore.get();

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(hasStoredSession);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
    void authApi.logout().catch(() => undefined);
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      queryClient.clear();
    });
  }, [queryClient]);

  // Restore the previous session
  useEffect(() => {
    if (!hasStoredSession()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (!isOfflineApp()) tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await authApi.register({ name, email, password });
    if (!isOfflineApp()) tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, setUser }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
