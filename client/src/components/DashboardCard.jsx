export default function DashboardCard({ title, value, icon: Icon, footer }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        {Icon ? <div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><Icon size={22} /></div> : null}
      </div>
      {footer ? <div className="mt-4 text-xs text-slate-500">{footer}</div> : null}
    </div>
  );
}
