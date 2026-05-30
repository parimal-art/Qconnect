import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../lib/api';
import { ROLES, roleLabel } from '../lib/roles';

const baseInitial = {
  name: '',
  email: '',
  defaultPassword: '',
  role: ROLES.SALESPERSON,
  assignedHR: '',
  assignedTeamLeader: '',
  shiftStart: '09:00',
  shiftEnd: '19:00'
};

export default function CreateEmployeePage() {
  const { user } = useSelector(s => s.auth);
  const [form, setForm] = useState(baseInitial);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roleOptions = useMemo(() => {
    if (user?.role === ROLES.SUPER_ADMIN) {
      return [ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON];
    }

    if (user?.role === ROLES.ADMIN) {
      return [ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON];
    }

    return [ROLES.TEAM_LEADER, ROLES.SALESPERSON];
  }, [user?.role]);

  useEffect(() => {
    if (!roleOptions.includes(form.role)) {
      setForm(current => ({ ...current, role: roleOptions[0] || ROLES.SALESPERSON }));
    }
  }, [form.role, roleOptions]);

  useEffect(() => {
    api.get('/users?status=active').then(({ data }) => setUsers(data.users || [])).catch(() => setUsers([]));
  }, []);

  const hrs = users.filter(u => u.role === ROLES.HR);
  const tls = users.filter(
    u =>
      u.role === ROLES.TEAM_LEADER &&
      (!form.assignedHR || u.assignedHR?._id === form.assignedHR || u.assignedHR === form.assignedHR)
  );

  const submit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      const payload = { ...form };

      if ([ROLES.ADMIN, ROLES.HR].includes(payload.role)) {
        payload.assignedHR = '';
        payload.assignedTeamLeader = '';
      }

      if (payload.role === ROLES.TEAM_LEADER) {
        payload.assignedTeamLeader = '';
      }

      const { data } = await api.post('/users/create', payload);
      setMessage(`Created ${data.user.email} (${data.user.employeeId}). Credentials email is sent when SMTP is configured.`);
      setForm({ ...baseInitial, role: roleOptions[0] || ROLES.SALESPERSON });
    } catch (err) {
      setError(err.response?.data?.message || 'Employee creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const showHRPicker = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user?.role) &&
    [ROLES.TEAM_LEADER, ROLES.SALESPERSON].includes(form.role);

  return (
    <div className="mx-auto max-w-3xl">
      <form onSubmit={submit} className="card">
        <h1 className="text-2xl font-bold">Create employee</h1>
        <p className="text-slate-500">
          Super Admin can create Admins. Admins can create only their own HR, Team Leaders and Salespersons.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Default password" value={form.defaultPassword} onChange={e => setForm({ ...form, defaultPassword: e.target.value })} />

          <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, assignedHR: '', assignedTeamLeader: '' })}>
            {roleOptions.map(r => <option key={r} value={r}>{roleLabel[r] || r}</option>)}
          </select>

          {showHRPicker && (
            <select className="input" value={form.assignedHR} onChange={e => setForm({ ...form, assignedHR: e.target.value, assignedTeamLeader: '' })}>
              <option value="">Assign HR</option>
              {hrs.map(hr => <option value={hr._id} key={hr._id}>{hr.name || hr.email}</option>)}
            </select>
          )}

          {form.role === ROLES.SALESPERSON && (
            <select className="input" value={form.assignedTeamLeader} onChange={e => setForm({ ...form, assignedTeamLeader: e.target.value })}>
              <option value="">Assign Team Leader</option>
              {tls.map(tl => <option value={tl._id} key={tl._id}>{tl.name || tl.email}</option>)}
            </select>
          )}

          <input className="input" type="time" value={form.shiftStart} onChange={e => setForm({ ...form, shiftStart: e.target.value })} />
          <input className="input" type="time" value={form.shiftEnd} onChange={e => setForm({ ...form, shiftEnd: e.target.value })} />
        </div>

        <button className="btn-primary mt-6" disabled={submitting}>{submitting ? 'Creating...' : 'Create employee'}</button>
        {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </form>
    </div>
  );
}
