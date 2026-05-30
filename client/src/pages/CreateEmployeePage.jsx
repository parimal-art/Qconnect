import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../lib/api';
import { ROLES } from '../lib/roles';

const initial = { name: '', email: '', defaultPassword: '', role: ROLES.SALESPERSON, assignedHR: '', assignedTeamLeader: '', shiftStart: '09:00', shiftEnd: '19:00' };

export default function CreateEmployeePage() {
  const { user } = useSelector(s => s.auth);
  const [form, setForm] = useState(initial);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/users?status=active').then(({ data }) => setUsers(data.users || [])); }, []);
  const hrs = users.filter(u => u.role === ROLES.HR);
  const tls = users.filter(u => u.role === ROLES.TEAM_LEADER && (!form.assignedHR || u.assignedHR?._id === form.assignedHR || u.assignedHR === form.assignedHR));
  const submit = async e => {
    e.preventDefault();
    const { data } = await api.post('/users/create', form);
    setMessage(`Created ${data.user.email} (${data.user.employeeId}). Credentials email is sent when SMTP is configured.`);
    setForm(initial);
  };
  const roleOptions = user.role === ROLES.ADMIN ? [ROLES.HR, ROLES.TEAM_LEADER, ROLES.SALESPERSON] : [ROLES.TEAM_LEADER, ROLES.SALESPERSON];
  return <div className="mx-auto max-w-3xl"><form onSubmit={submit} className="card"><h1 className="text-2xl font-bold">Create employee</h1><p className="text-slate-500">Employee receives default credentials and must change password on first login.</p><div className="mt-6 grid gap-4 md:grid-cols-2"><input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input className="input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input className="input" placeholder="Default password" value={form.defaultPassword} onChange={e => setForm({ ...form, defaultPassword: e.target.value })} /><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roleOptions.map(r => <option key={r} value={r}>{r}</option>)}</select>{user.role === ROLES.ADMIN && form.role !== ROLES.HR && <select className="input" value={form.assignedHR} onChange={e => setForm({ ...form, assignedHR: e.target.value })}><option value="">Assign HR</option>{hrs.map(hr => <option value={hr._id} key={hr._id}>{hr.name || hr.email}</option>)}</select>}{form.role === ROLES.SALESPERSON && <select className="input" value={form.assignedTeamLeader} onChange={e => setForm({ ...form, assignedTeamLeader: e.target.value })}><option value="">Assign Team Leader</option>{tls.map(tl => <option value={tl._id} key={tl._id}>{tl.name || tl.email}</option>)}</select>}<input className="input" type="time" value={form.shiftStart} onChange={e => setForm({ ...form, shiftStart: e.target.value })} /><input className="input" type="time" value={form.shiftEnd} onChange={e => setForm({ ...form, shiftEnd: e.target.value })} /></div><button className="btn-primary mt-6">Create employee</button>{message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}</form></div>;
}