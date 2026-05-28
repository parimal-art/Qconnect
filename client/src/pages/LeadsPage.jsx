import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import LeadKanban from '../components/LeadKanban';
import { LoadingState } from '../components/LoadingState';

const leadInitial = { name: '', companyName: '', contactNumber: '', email: '', website: '', domain: '', source: 'Manual', leadType: 'Cold Lead', pipelineStatus: 'New Lead', callStatus: '', actionRequired: 'Follow-up', remarks: '', followUpDate: '' };

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(leadInitial);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const load = async () => {
    setLoading(true);
    const [l, u] = await Promise.all([api.get('/leads?limit=100'), api.get('/users/children').catch(() => ({ data: { users: [] } }))]);
    setLeads(l.data.leads || []); setEmployees(u.data.users || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const create = async e => { e.preventDefault(); await api.post('/leads', form); setForm(leadInitial); load(); };
  const upload = async e => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append('file', file); if (form.assignedTo) fd.append('assignedTo', form.assignedTo); await api.post('/leads/upload', fd); load(); };
  const complete = async lead => { await api.put(`/leads/${lead._id}/complete`, { pipelineStatus: lead.pipelineStatus === 'Lost' ? 'Lost' : 'Won' }); load(); };
  const search = async e => { setQuery(e.target.value); if (e.target.value.length > 1) { const { data } = await api.get(`/leads/search?q=${encodeURIComponent(e.target.value)}`); setLeads(data.leads || []); } else load(); };
  const columns = [
    { key: 'name', header: 'Lead', render: r => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-slate-500">{r.companyName}</p></div> },
    { key: 'contact', header: 'Contact', render: r => <div><p>{r.contactNumber}</p><p className="text-xs text-slate-500">{r.email}</p></div> },
    { key: 'leadType', header: 'Type', render: r => <StatusBadge value={r.leadType} /> },
    { key: 'pipelineStatus', header: 'Pipeline', render: r => <StatusBadge value={r.pipelineStatus} /> },
    { key: 'assignedTo', header: 'Assigned To', render: r => r.assignedTo?.name || '—' },
    { key: 'followUpDate', header: 'Follow-up', render: r => r.followUpDate ? new Date(r.followUpDate).toLocaleString() : '—' },
    { key: 'actions', header: 'Actions', render: r => <button onClick={() => complete(r)} className="text-sm font-semibold text-blue-600">Complete</button> }
  ];
  if (loading) return <LoadingState rows={6} />;
  return <div className="space-y-6"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold">Lead management</h1><p className="text-slate-500">Manual leads, upload, search, Kanban and timeline-ready status updates.</p></div><div className="flex gap-2"><button onClick={() => setView('table')} className="btn-secondary">Table</button><button onClick={() => setView('kanban')} className="btn-secondary">Kanban</button></div></div><form onSubmit={create} className="card"><h2 className="font-semibold">Create lead</h2><div className="mt-4 grid gap-3 md:grid-cols-4"><input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input className="input" placeholder="Company" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /><input className="input" placeholder="Phone" value={form.contactNumber} onChange={e => setForm({ ...form, contactNumber: e.target.value })} /><input className="input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input className="input" placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /><select className="input" value={form.leadType} onChange={e => setForm({ ...form, leadType: e.target.value })}><option>Hot Lead</option><option>Mid Lead</option><option>Cold Lead</option></select><select className="input" value={form.assignedTo || ''} onChange={e => setForm({ ...form, assignedTo: e.target.value })}><option value="">Assign salesperson</option>{employees.filter(u => u.role === 'SALESPERSON').map(s => <option key={s._id} value={s._id}>{s.name || s.email}</option>)}</select><input className="input" type="datetime-local" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} /></div><div className="mt-4 flex flex-wrap gap-3"><button className="btn-primary">Create lead</button><label className="btn-secondary cursor-pointer">Upload CSV/Excel<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={upload} /></label></div></form><input className="input max-w-md" placeholder="Search leads by name, company, phone, email, website..." value={query} onChange={search} />{view === 'kanban' ? <LeadKanban leads={leads} onChanged={load} /> : <DataTable columns={columns} rows={leads} keyField="_id" />}</div>;
}
