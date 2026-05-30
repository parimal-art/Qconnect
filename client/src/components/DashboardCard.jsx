import { ArrowRight } from 'lucide-react';

const variants = {
  blue: {
    card: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white dark:border-blue-900/60 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    active: 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-950'
  },
  emerald: {
    card: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    active: 'border-emerald-400 ring-2 ring-emerald-100 dark:ring-emerald-950'
  },
  amber: {
    card: 'border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white dark:border-amber-900/60 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    active: 'border-amber-400 ring-2 ring-amber-100 dark:ring-amber-950'
  },
  violet: {
    card: 'border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white dark:border-violet-900/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-slate-900',
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    active: 'border-violet-400 ring-2 ring-violet-100 dark:ring-violet-950'
  },
  rose: {
    card: 'border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white dark:border-rose-900/60 dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900',
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    active: 'border-rose-400 ring-2 ring-rose-100 dark:ring-rose-950'
  },
  cyan: {
    card: 'border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-white dark:border-cyan-900/60 dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900',
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    active: 'border-cyan-400 ring-2 ring-cyan-100 dark:ring-cyan-950'
  }
};

export default function DashboardCard({
  title,
  value,
  icon: Icon,
  footer,
  onClick,
  active = false,
  color = 'blue'
}) {
  const variant = variants[color] || variants.blue;

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>
        </div>

        {Icon ? (
          <div className={`rounded-2xl p-3 shadow-sm ${variant.icon}`}>
            <Icon size={22} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>{footer || (onClick ? 'Tap to view details' : '')}</span>
        {onClick ? <ArrowRight size={15} className="shrink-0" /> : null}
      </div>
    </>
  );

  const className = `card ${variant.card} ${active ? variant.active : ''}`;

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} w-full text-left transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
    >
      {content}
    </button>
  );
}
