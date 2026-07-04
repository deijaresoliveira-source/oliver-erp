import { ReactNode } from 'react';

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-950 dark:bg-[#070b12] dark:text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#070b12]/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-4 pt-16 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight md:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground md:text-base">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-6">{children}</div>
    </div>
  );
}

export function SummaryCard({
  title,
  value,
  icon,
  tone = 'primary',
}: {
  title: string;
  value: string | number;
  icon?: ReactNode;
  tone?: 'primary' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const toneClass = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    green: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  }[tone];

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 dark:border-white/10 dark:bg-card ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2">{icon}<p className="text-sm font-medium opacity-90">{title}</p></div>
      <p className="text-2xl font-black md:text-3xl">{value}</p>
    </div>
  );
}
