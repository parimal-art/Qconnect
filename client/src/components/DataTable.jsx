import { EmptyState } from './LoadingState';

export default function DataTable({ columns, rows, keyField = 'id' }) {
  if (!rows?.length) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>{columns.map(col => <th key={col.key} className="table-th">{col.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, index) => (
              <tr key={row[keyField] || row._id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                {columns.map(col => <td key={col.key} className="table-td">{col.render ? col.render(row) : row[col.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
