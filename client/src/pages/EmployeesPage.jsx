import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';
import { roleLabel } from '../lib/roles';

export default function EmployeesPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/users').then(({ data }) => setUsers(data.users)).finally(() => setLoading(false)); }, []);
  const columns = [
    { key: 'name', header: 'Employee', render: r => <div><p className="font-semibold">{r.name || r.email}</p><p className="text-xs text-slate-500">{r.employeeId}</p></div> },
    { key: 'role', header: 'Role', render: r => roleLabel[r.role] || r.role },
    { key: 'parent', header: 'Parent', render: r => r.assignedTeamLeader?.name || r.assignedHR?.name || 'Admin' },
    { key: 'status', header: 'Status', render: r => <StatusBadge value={r.currentActivityState} /> },
    { key: 'profileCompletionPercentage', header: 'Profile', render: r => `${r.profileCompletionPercentage || 0}%` },
    { key: 'isVerified', header: 'Verified', render: r => r.isVerified ? <StatusBadge value="Approved" /> : <StatusBadge value="Pending" /> },
    { key: 'shift', header: 'Shift', render: r => `${r.shiftStart} - ${r.shiftEnd}` }
  ];
  return <div className="space-y-4"><div><h1 className="text-2xl font-bold">Employees</h1><p className="text-slate-500">Role and hierarchy based employee management.</p></div>{loading ? <LoadingState /> : <DataTable columns={columns} rows={users} keyField="_id" />}</div>;
}
