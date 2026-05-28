import { useMemo, useState } from 'react';
import api from '../lib/api';

const columns = ['New Lead', 'Contacted', 'Interested', 'Follow-up', 'Demo Scheduled', 'Negotiation', 'Won', 'Lost'];

export default function LeadKanban({ leads, onChanged }) {
  const [dragId, setDragId] = useState(null);
  const grouped = useMemo(() => columns.reduce((acc, c) => ({ ...acc, [c]: leads.filter(l => l.pipelineStatus === c) }), {}), [leads]);

  const drop = async status => {
    if (!dragId) return;
    await api.put(`/leads/${dragId}/status`, { pipelineStatus: status });
    setDragId(null);
    onChanged?.();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(col => (
        <div key={col} onDragOver={e => e.preventDefault()} onDrop={() => drop(col)} className="min-h-96 w-72 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center justify-between"><p className="font-semibold">{col}</p><span className="rounded-full bg-white px-2 py-1 text-xs dark:bg-slate-800">{grouped[col]?.length || 0}</span></div>
          <div className="space-y-3">
            {grouped[col]?.map(lead => (
              <div draggable onDragStart={() => setDragId(lead._id)} key={lead._id} className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="font-semibold">{lead.name}</p>
                <p className="text-xs text-slate-500">{lead.companyName || lead.contactNumber}</p>
                <p className="mt-2 text-xs text-blue-600">{lead.leadType}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
