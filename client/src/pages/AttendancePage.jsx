import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';

const h = ms => `${Math.round((ms || 0) / 3600000 * 10) / 10}h`;

export default function AttendancePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/attendance/report').then(({ data }) => setRows(data.data || [])).finally(() => setLoading(false)); }, []);
  const columns = [
    { key: 'user', header: 'Employee', render: r => <div><p className="font-semibold">{r.user?.name || r.user?.email}</p><p className="text-xs text-slate-500">{r.user?.employeeId}</p></div> },
    { key: 'date', header: 'Date', render: r => new Date(r.date).toLocaleDateString() },
    { key: 'loginTime', header: 'Login', render: r => r.loginTime ? new Date(r.loginTime).toLocaleTimeString() : '—' },
    { key: 'logoutTime', header: 'Logout', render: r => r.logoutTime ? new Date(r.logoutTime).toLocaleTimeString() : '—' },
    { key: 'activeTimeInsideShift', header: 'Active In Shift', render: r => h(r.activeTimeInsideShift) },
    { key: 'idleTimeInsideShift', header: 'Idle', render: r => h(r.idleTimeInsideShift) },
    { key: 'breakTimeInsideShift', header: 'Break', render: r => h(r.breakTimeInsideShift) },
    { key: 'activeTimeOutsideShift', header: 'Out of Shift', render: r => h(r.activeTimeOutsideShift) },
    { key: 'status', header: 'Session', render: r => r.status }
  ];
  return <div className="space-y-4"><div><h1 className="text-2xl font-bold">Attendance tracking</h1><p className="text-slate-500">Login/logout and working-hour activity report.</p></div>{loading ? <LoadingState /> : <DataTable columns={columns} rows={rows} keyField="_id" />}</div>;
}
