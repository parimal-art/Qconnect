import { useEffect, useState } from 'react';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';
import DataTable from './DataTable';
import StatusBadge from './StatusBadge';
import { LoadingState } from './LoadingState';

const fmt = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const dateFmt = value => value ? new Date(value).toLocaleString() : '—';

export default function ChildEmployeeTracker() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/children/tracking');
      setRows(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const socket = connectSocket();
    const update = payload => {
      setRows(prev => prev.map(row => row.userId === payload.userId ? { ...row, onlineStatus: payload.onlineStatus, currentActivityState: payload.currentActivityState, lastSeen: payload.lastSeen } : row));
    };
    socket?.on('child_employee_status_updated', update);
    socket?.on('active_time_updated', load);
    return () => {
      socket?.off('child_employee_status_updated', update);
      socket?.off('active_time_updated', load);
    };
  }, []);

  const filtered = rows.filter(row => [row.employeeName, row.employeeId, row.role, row.assignedParentName].join(' ').toLowerCase().includes(query.toLowerCase()));

  const columns = [
    { key: 'employeeName', header: 'Employee', render: r => <div><p className="font-semibold">{r.employeeName}</p><p className="text-xs text-slate-500">{r.employeeId}</p></div> },
    { key: 'role', header: 'Role' },
    { key: 'assignedParentName', header: 'Parent' },
    { key: 'currentActivityState', header: 'Status', render: r => <div className="space-y-1"><StatusBadge value={r.currentActivityState} /><p className="text-xs text-slate-500">{r.onlineStatus}</p></div> },
    { key: 'times', header: 'Login / Logout', render: r => <div>{fmt(r.loginTime)}<span className="text-slate-400"> → </span>{fmt(r.logoutTime)}</div> },
    { key: 'shift', header: 'Shift', render: r => <div><p>{r.assignedWorkingHours}</p><p className="text-xs text-slate-500">{r.totalShiftDuration}</p></div> },
    { key: 'active', header: 'Active In Shift', render: r => r.totalActiveTimeDuringWorkingHours },
    { key: 'idle', header: 'Idle', render: r => r.totalIdleTimeDuringWorkingHours },
    { key: 'break', header: 'Break', render: r => r.totalBreakTime },
    { key: 'outside', header: 'Out Shift', render: r => r.outOfShiftActivityTime },
    { key: 'leadStats', header: 'Leads', render: r => <div className="text-xs"><p>Total: {r.todaysLeadCount}</p><p>Done: {r.completedLeadCount} · Pending: {r.pendingLeadCount}</p><p>Follow-up: {r.followUpDueCount}</p></div> },
    { key: 'performancePercentage', header: 'Performance', render: r => <div className="min-w-28"><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${r.performancePercentage}%` }} /></div><p className="mt-1 text-xs">{r.performancePercentage}%</p></div> },
    { key: 'lastSeen', header: 'Last seen', render: r => dateFmt(r.lastSeen) }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Child Employee Tracker</h1>
          <p className="text-sm text-slate-500">Real-time hierarchy based activity, attendance, leads, and performance.</p>
        </div>
        <input className="input max-w-sm" placeholder="Search employee, role, parent..." value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      {loading ? <LoadingState rows={6} /> : <DataTable columns={columns} rows={filtered} keyField="userId" />}
    </div>
  );
}
