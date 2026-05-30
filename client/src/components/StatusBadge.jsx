const classes = {
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Online: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Idle: 'bg-amber-50 text-amber-700 ring-amber-200',
  'On Break': 'bg-purple-50 text-purple-700 ring-purple-200',
  Offline: 'bg-slate-100 text-slate-600 ring-slate-200',
  Won: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Lost: 'bg-rose-50 text-rose-700 ring-rose-200',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  Deactivated: 'bg-rose-50 text-rose-700 ring-rose-200'
};

export default function StatusBadge({ value }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[value] || 'bg-blue-50 text-blue-700 ring-blue-200'}`}>{value || 'N/A'}</span>;
}