import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { setUser } from '../../store/authSlice';
import { roleHome } from '../../lib/roles';

const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

const initialProfile = user => ({
  name: user?.name || '',
  phone: user?.phone || '',
  address: user?.address || '',
  emergencyContactNumber: user?.emergencyContactNumber || '',
  dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '',
  gender: genderOptions.includes(user?.gender) ? user.gender : '',
  joiningDate: user?.joiningDate ? String(user.joiningDate).slice(0, 10) : new Date().toISOString().slice(0, 10)
});

export default function CompleteProfile() {
  const { user } = useSelector(s => s.auth);
  const [form, setForm] = useState(() => initialProfile(user));
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const missingFields = useMemo(() => {
    const required = ['name', 'phone', 'address', 'emergencyContactNumber', 'dateOfBirth', 'gender', 'joiningDate'];
    return required.filter(field => !String(form[field] || '').trim());
  }, [form]);

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateFile = (key, file) => setFiles(current => ({ ...current, [key]: file || null }));

  const submit = async e => {
    e.preventDefault();
    setError('');

    if (missingFields.length) {
      setError(`Please fill: ${missingFields.map(f => f.replace(/([A-Z])/g, ' $1')).join(', ')}`);
      return;
    }

    if (!user?.profilePhoto && !files.profilePhoto) {
      setError('Please upload a profile photo.');
      return;
    }

    if (!user?.aadhaarCard && !files.aadhaarCard) {
      setError('Please upload Aadhaar card.');
      return;
    }

    const fd = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        fd.append(key, value);
      }
    });

    Object.entries(files).forEach(([key, file]) => {
      if (file) fd.append(key, file);
    });

    try {
      setLoading(true);
      const { data } = await api.put('/users/profile/complete', fd);
      dispatch(setUser({ ...user, ...data.user }));
      navigate(roleHome[data.user.role || user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Profile update failed. Please check all required fields and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <form onSubmit={submit} className="card">
        <h1 className="text-2xl font-bold">Complete employee profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Profile completion: {user?.profileCompletionPercentage || 0}%
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Full name
            <input
              className="input mt-1"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium">
            Contact number
            <input
              className="input mt-1"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium md:col-span-2">
            Address
            <input
              className="input mt-1"
              value={form.address}
              onChange={e => update('address', e.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium">
            Emergency contact number
            <input
              className="input mt-1"
              value={form.emergencyContactNumber}
              onChange={e => update('emergencyContactNumber', e.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium">
            Date of birth
            <input
              className="input mt-1"
              type="date"
              value={form.dateOfBirth}
              onChange={e => update('dateOfBirth', e.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium">
            Gender
            <select
              className="input mt-1"
              value={form.gender}
              onChange={e => update('gender', e.target.value)}
              required
            >
              <option value="">Select gender</option>
              {genderOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Joining date
            <input
              className="input mt-1"
              type="date"
              value={form.joiningDate}
              onChange={e => update('joiningDate', e.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium">
            Profile photo
            <input
              className="input mt-1"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => updateFile('profilePhoto', e.target.files?.[0])}
              required={!user?.profilePhoto}
            />
          </label>

          <label className="text-sm font-medium">
            Aadhaar card
            <input
              className="input mt-1"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={e => updateFile('aadhaarCard', e.target.files?.[0])}
              required={!user?.aadhaarCard}
            />
          </label>
        </div>

        <button className="btn-primary mt-6 disabled:opacity-60" disabled={loading}>
          {loading ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}