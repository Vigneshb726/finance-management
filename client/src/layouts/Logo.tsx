export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#4f46e5" />
        <path d="M10 22V10h11M10 16h8" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Finora</span>
    </div>
  );
}
