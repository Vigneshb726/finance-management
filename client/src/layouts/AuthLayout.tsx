import type { ReactNode } from 'react';
import { BarChart3, PiggyBank, ShieldCheck, Target } from 'lucide-react';
import { Logo } from './Logo';

const features = [
  { icon: BarChart3, title: 'Clear insights', text: 'See where every rupee goes with live charts and reports.' },
  { icon: PiggyBank, title: 'Smart budgets', text: 'Category limits with alerts before you overspend.' },
  { icon: Target, title: 'Savings goals', text: 'Track progress towards the things that matter.' },
  { icon: ShieldCheck, title: 'Private & secure', text: 'Encrypted passwords and token-based sessions.' },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-4 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-indigo-700 to-slate-900 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">Take control of your money, one transaction at a time.</h2>
          <p className="mt-3 text-brand-100">Income, expenses, budgets and goals — all in one calm, clear dashboard.</p>
          <ul className="mt-10 space-y-5">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-sm text-brand-100">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
