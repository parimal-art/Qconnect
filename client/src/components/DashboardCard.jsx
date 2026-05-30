import { ArrowRight } from 'lucide-react';

export default function DashboardCard({
  title,
  value,
  icon: Icon,
  footer,
  onClick,
  active = false
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
        </div>

        {Icon ? (
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40">
            <Icon size={22} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{footer || (onClick ? 'Tap to view details' : '')}</span>
        {onClick ? <ArrowRight size={15} className="shrink-0" /> : null}
      </div>
    </>
  );

  if (!onClick) {
    return <div className="card">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card w-full text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        active ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950' : ''
      }`}
    >
      {content}
    </button>
  );
}
