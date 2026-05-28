import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const submit = async e => {
    e.preventDefault();
    const { data } = await api.post('/auth/change-password', form);
    setMessage(data.message);
    setTimeout(() => navigate('/login'), 1000);
  };
  return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><form onSubmit={submit} className="card w-full max-w-md"><h1 className="text-2xl font-bold">Change default password</h1><p className="mt-1 text-sm text-slate-500">Required on first login.</p><input type="password" className="input mt-6" placeholder="Current/default password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} /><input type="password" className="input mt-3" placeholder="New password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} /><button className="btn-primary mt-4 w-full">Change password</button>{message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}</form></div>;
}
