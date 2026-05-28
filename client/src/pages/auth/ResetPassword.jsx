import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const submit = async e => {
    e.preventDefault();
    const { data } = await api.post('/auth/reset-password', { email: params.get('email'), token: params.get('token'), newPassword });
    setMessage(data.message);
    setTimeout(() => navigate('/login'), 1000);
  };
  return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><form onSubmit={submit} className="card w-full max-w-md"><h1 className="text-2xl font-bold">Reset password</h1><input type="password" className="input mt-6" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" /><button className="btn-primary mt-4 w-full">Reset</button>{message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}</form></div>;
}
