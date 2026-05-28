export function LoadingState({ rows = 4 }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
}

export function EmptyState({ title = 'No data found', description = 'There is nothing to show yet.' }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}
