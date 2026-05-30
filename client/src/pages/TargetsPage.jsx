import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import TargetSummaryPanel from '../components/TargetSummaryPanel';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';
import { ROLES, roleLabel } from '../lib/roles';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const date = value => (value ? new Date(value).toLocaleDateString() : '—');

export default function TargetsPage() {
  const { user } = useSelector(state => state.auth);
  const [targets, setTargets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ assignedTo: '', amount: '', periodStart: '', periodEnd: '', notes: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canAssign = [ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEADER].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [targetResponse, employeeResponse] = await Promise.all([
        api.get('/targets/team'),
        api.get('/users/children').catch(() => ({ data: { users: [] } }))
      ]);
      setTargets(targetResponse.data.targets || []);
      setEmployees(employeeResponse.data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load targets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignableEmployees = useMemo(() => {
    if (user?.role === ROLES.ADMIN) return employees.filter(employee => employee.role !== ROLES.ADMIN);
    if (user?.role === ROLES.HR) return employees.filter(employee => employee.role === ROLES.TEAM_LEADER);
    if (user?.role === ROLES.TEAM_LEADER) return employees.filter(employee => employee.role === ROLES.SALESPERSON);
    return [];
  }, [employees, user?.role]);

  const assign = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!form.assignedTo || !form.amount) {
      setError('Select employee and enter target amount.');
      return;
    }

    try {
      await api.post('/targets', form);
      setMessage('Target assigned successfully.');
      setForm({ assignedTo: '', amount: '', periodStart: '', periodEnd: '', notes: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Target assignment failed.');
    }
  };

  const columns = [
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: target => (
        <div>
          <Link to={`/employees/${target.assignedTo?._id}`} className="font-semibold text-blue-600 hover:underline">
            {target.assignedTo?.name || target.assignedTo?.email || 'Employee'}
          </Link>
          <p className="text-xs text-slate-500">{roleLabel[target.assignedTo?.role] || target.assignedTo?.role}</p>
        </div>
      )
    },
    {
      key: 'assignedBy',
      header: 'Assigned By',
      render: target => target.assignedBy?.name || target.assignedBy?.email || '—'
    },
    { key: 'amount', header: 'Amount', render: target => money(target.amount) },
    { key: 'period', header: 'Period', render: target => `${date(target.periodStart)} - ${date(target.periodEnd)}` },
    { key: 'status', header: 'Status', render: target => <StatusBadge value={target.status} /> },
    { key: 'notes', header: 'Notes', render: target => target.notes || '—' }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Targets</h1>
        <p className="text-slate-500">HR assigns Team Leader targets. Team Leader distributes targets to Salespersons. Completed sales can exceed assigned target.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</div>}

      <TargetSummaryPanel title="My target performance" />

      {canAssign && (
        <form onSubmit={assign} className="card space-y-4">
          <h2 className="text-xl font-bold">Assign / distribute target</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select className="input xl:col-span-2" value={form.assignedTo} onChange={event => setForm(current => ({ ...current, assignedTo: event.target.value }))}>
              <option value="">Select employee</option>
              {assignableEmployees.map(employee => (
                <option key={employee._id} value={employee._id}>{employee.name || employee.email} · {roleLabel[employee.role]}</option>
              ))}
            </select>
            <input className="input" type="number" min="0" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} placeholder="Amount" />
            <input className="input" type="date" value={form.periodStart} onChange={event => setForm(current => ({ ...current, periodStart: event.target.value }))} />
            <input className="input" type="date" value={form.periodEnd} onChange={event => setForm(current => ({ ...current, periodEnd: event.target.value }))} />
            <button className="btn-primary">Assign</button>
          </div>
          <input className="input" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
        </form>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Visible target history</h2>
        {loading ? <LoadingState rows={4} /> : <DataTable columns={columns} rows={targets} keyField="_id" />}
      </section>
    </div>
  );
}
