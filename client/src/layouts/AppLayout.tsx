import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  FileText,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Plus,
  Repeat,
  Settings,
  Sun,
  Tags,
  Target,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isOfflineApp } from '../services/backend';
import { authApi } from '../services/endpoints';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import { Logo } from './Logo';
import { NotificationsMenu } from './NotificationsMenu';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <ul className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white',
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      {isOfflineApp() ? (
        <div className="m-3 flex gap-2.5 rounded-xl border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <HardDrive className="h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            <span className="font-medium text-slate-900 dark:text-white">Works offline.</span> Your data is stored encrypted on this
            device. Back it up from Settings.
          </p>
        </div>
      ) : (
        <div className="m-3 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-800 p-4 text-white">
          <p className="text-sm font-semibold">Stay on budget</p>
          <p className="mt-1 text-xs text-brand-100">You'll be notified at 80% and 100% of every budget you set.</p>
        </div>
      )}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{initials}</span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-700 dark:text-slate-200 lg:block">{user?.name}</span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-60 animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="p-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" /> Settings
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, setUser } = useAuth();
  const { isDark, setTheme } = useTheme();

  const toggleTheme = () => {
    const next = isDark ? 'LIGHT' : 'DARK';
    setTheme(next);
    authApi.updateProfile({ theme: next }).then(setUser).catch(() => undefined);
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const location = useLocation();

  // Keep the UI theme in sync with the saved account preference
  const savedTheme = user?.theme;
  useEffect(() => {
    if (savedTheme) setTheme(savedTheme);
  }, [savedTheme, setTheme]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block print:!hidden">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-950/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative h-full w-72 max-w-[85vw] bg-white shadow-pop dark:bg-slate-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64 print:!pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:px-6 print:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Welcome back, <span className="font-medium text-slate-900 dark:text-white">{user?.name.split(' ')[0]}</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button size="sm" className="hidden sm:inline-flex" onClick={() => setQuickAdd(true)}>
              <Plus className="h-4 w-4" /> Add transaction
            </Button>
            <button
              onClick={() => setQuickAdd(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white sm:hidden"
              aria-label="Add transaction"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationsMenu />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <TransactionForm open={quickAdd} onClose={() => setQuickAdd(false)} />
    </div>
  );
}
