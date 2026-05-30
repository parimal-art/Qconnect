import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import api from '../../lib/api';
import { clearAuthState } from '../../store/authSlice';
import { clearToken } from '../../lib/authStorage';

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const submit = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });

      clearToken();
      dispatch(clearAuthState());
      setMessage('Password changed successfully. Kindly login again with your new password.');

      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { notice: 'Password changed successfully. Kindly login again with your new password.' }
        });
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || 'Password change failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <form onSubmit={submit} className="card w-full max-w-md">
        <h1 className="text-2xl font-bold">Change default password</h1>
        <p className="mt-1 text-sm text-slate-500">
          After changing your password, you must login again with the new password.
        </p>

        {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {message && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

        <input
          type="password"
          className="input mt-6"
          placeholder="Current/default password"
          value={form.currentPassword}
          onChange={event => update('currentPassword', event.target.value)}
        />
        <input
          type="password"
          className="input mt-3"
          placeholder="New password"
          value={form.newPassword}
          onChange={event => update('newPassword', event.target.value)}
        />
        <input
          type="password"
          className="input mt-3"
          placeholder="Confirm new password"
          value={form.confirmPassword}
          onChange={event => update('confirmPassword', event.target.value)}
        />

        <button className="btn-primary mt-4 w-full" disabled={loading}>
          {loading ? 'Changing password...' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
