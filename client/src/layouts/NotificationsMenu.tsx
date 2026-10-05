import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, BellOff, CalendarCheck, CheckCheck, Info, Target, X, XCircle } from 'lucide-react';
import { useNotificationActions, useNotifications } from '../hooks/queries';
import type { NotificationType } from '../types';
import { cn } from '../utils/cn';
import { formatRelative } from '../utils/format';
import { Spinner } from '../components/ui/Feedback';

const typeStyle: Record<NotificationType, { icon: typeof Bell; className: string }> = {
  BUDGET_EXCEEDED: { icon: XCircle, className: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  BUDGET_WARNING: { icon: AlertTriangle, className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  GOAL_MILESTONE: { icon: Target, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  MONTHLY_SUMMARY: { icon: CalendarCheck, className: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' },
  SYSTEM: { icon: Info, className: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' },
};

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useNotifications();
  const { markRead, markAllRead, remove } = useNotificationActions();
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-40 animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : !data?.data.length ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <BellOff className="mb-2 h-6 w-6 text-slate-300" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">You're all caught up</p>
                <p className="mt-0.5 text-xs text-slate-500">Budget alerts and goal milestones will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.data.map((n) => {
                  const style = typeStyle[n.type];
                  return (
                    <li
                      key={n.id}
                      className={cn('group relative flex gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50', !n.isRead && 'bg-brand-50/40 dark:bg-brand-500/5')}
                    >
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.className)}>
                        <style.icon className="h-4 w-4" />
                      </span>
                      <button className="min-w-0 flex-1 text-left" onClick={() => !n.isRead && markRead.mutate(n.id)}>
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                          {n.title}
                          {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{n.message}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatRelative(n.createdAt)}</p>
                      </button>
                      <button
                        onClick={() => remove.mutate(n.id)}
                        className="h-6 w-6 shrink-0 rounded p-1 text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-700"
                        aria-label="Dismiss notification"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
