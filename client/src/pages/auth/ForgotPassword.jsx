import { useState } from 'react';
import api from '../../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const submit = async e => {
    e.preventDefault();
    const { data } = await api.post('/auth/forgot-password', { email });
    setMessage(data.message);
  };
  return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><form onSubmit={submit} className="card w-full max-w-md"><h1 className="text-2xl font-bold">Forgot password</h1><p className="mt-1 text-sm text-slate-500">Enter your email to receive reset instructions.</p><input className="input mt-6" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" /><button className="btn-primary mt-4 w-full">Send reset link</button>{message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}</form></div>;
}
