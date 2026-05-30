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
  Deactivated: 'bg-rose-50 text-rose-700 ring-rose-200',
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending_review: 'bg-amber-50 text-amber-700 ring-amber-200',
  document_pending: 'bg-orange-50 text-orange-700 ring-orange-200',
  not_verified: 'bg-rose-50 text-rose-700 ring-rose-200',
  not_submitted: 'bg-slate-100 text-slate-600 ring-slate-200',
  finalized: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending_tl_review: 'bg-amber-50 text-amber-700 ring-amber-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  not_requested: 'bg-slate-100 text-slate-600 ring-slate-200',
  generated: 'bg-blue-50 text-blue-700 ring-blue-200',
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  sent: 'bg-purple-50 text-purple-700 ring-purple-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200'
};

const label = value =>
  String(value || 'N/A')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

export default function StatusBadge({ value }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[value] || 'bg-blue-50 text-blue-700 ring-blue-200'}`}>
      {label(value)}
    </span>
  );
}
