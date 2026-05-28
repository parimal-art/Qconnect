import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function BreakLeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [reason, setReason] = useState('');
  const [leave, setLeave] = useState({ startDate: '', endDate: '', reason: '', leaveType: 'Full day' });
  const load = () => api.get('/leave').then(({ data }) => setLeaves(data.data || []));
  useEffect(() => { load(); }, []);
  const startBreak = () => api.post('/break/start', { type: 'Short break', reason }).then(() => setReason(''));
  const endBreak = () => api.post('/break/end');
  const requestLeave = async e => { e.preventDefault(); await api.post('/leave/request', leave); setLeave({ startDate: '', endDate: '', reason: '', leaveType: 'Full day' }); load(); };
  const columns = [{ key: 'leaveType', header: 'Type' }, { key: 'startDate', header: 'Start', render: r => new Date(r.startDate).toLocaleDateString() }, { key: 'endDate', header: 'End', render: r => new Date(r.endDate).toLocaleDateString() }, { key: 'reason', header: 'Reason' }, { key: 'status', header: 'Status', render: r => <StatusBadge value={r.status} /> }];
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Break & leave</h1><p className="text-slate-500">Break duration is tracked separately from idle time.</p></div><div className="grid gap-4 lg:grid-cols-2"><div className="card"><h2 className="font-semibold">Break control</h2><input className="input mt-4" placeholder="Break reason" value={reason} onChange={e => setReason(e.target.value)} /><div className="mt-4 flex gap-2"><button onClick={startBreak} className="btn-primary">Start break</button><button onClick={endBreak} className="btn-secondary">End break</button></div></div><form onSubmit={requestLeave} className="card"><h2 className="font-semibold">Request leave</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><select className="input" value={leave.leaveType} onChange={e => setLeave({ ...leave, leaveType: e.target.value })}><option>Full day</option><option>Half day</option><option>Sick leave</option><option>Casual leave</option></select><input className="input" type="date" value={leave.startDate} onChange={e => setLeave({ ...leave, startDate: e.target.value })} /><input className="input" type="date" value={leave.endDate} onChange={e => setLeave({ ...leave, endDate: e.target.value })} /><input className="input" placeholder="Reason" value={leave.reason} onChange={e => setLeave({ ...leave, reason: e.target.value })} /></div><button className="btn-primary mt-4">Submit leave</button></form></div><DataTable columns={columns} rows={leaves} keyField="_id" /></div>;
}
