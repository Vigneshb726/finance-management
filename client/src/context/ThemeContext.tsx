import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemePreference } from '../types';

const STORAGE_KEY = 'finora-theme';

interface ThemeContextValue {
  theme: ThemePreference;
  isDark: boolean;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readStored = (): ThemePreference => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'LIGHT' || v === 'DARK' || v === 'SYSTEM' ? v : 'SYSTEM';
  } catch {
    return 'SYSTEM';
  }
};

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStored);
  const [isDark, setIsDark] = useState(() => theme === 'DARK' || (theme === 'SYSTEM' && systemDark()));

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'DARK' || (theme === 'SYSTEM' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, isDark, setTheme }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
