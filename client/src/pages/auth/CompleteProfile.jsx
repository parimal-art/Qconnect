import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  joiningDate: user?.joiningDate
    ? String(user.joiningDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10),
  previousCompanyName: user?.previousCompanyName || '',
  panCard: user?.panCard || ''
});

const newOtherDocument = () => ({ documentName: '', file: null, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` });

export default function CompleteProfile() {
  const { user } = useSelector(state => state.auth);

  const [form, setForm] = useState(() => initialProfile(user));
  const [files, setFiles] = useState({
    profilePhoto: null,
    aadhaarCard: null,
    previousCompanyPayslip: null,
    experienceLetter: null
  });
  const [otherDocuments, setOtherDocuments] = useState([newOtherDocument()]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const missingFields = useMemo(() => {
    const requiredFields = [
      'name',
      'phone',
      'address',
      'emergencyContactNumber',
      'dateOfBirth',
      'gender',
      'joiningDate'
    ];

    return requiredFields.filter(field => !String(form[field] || '').trim());
  }, [form]);

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateFile = (key, file) => setFiles(current => ({ ...current, [key]: file || null }));

  const updateOtherDocument = (id, key, value) => {
    setOtherDocuments(current =>
      current.map(document => (document.id === id ? { ...document, [key]: value } : document))
    );
  };

  const addOtherDocument = () => setOtherDocuments(current => [...current, newOtherDocument()]);
  const removeOtherDocument = id => {
    setOtherDocuments(current => (current.length === 1 ? current : current.filter(document => document.id !== id)));
  };

  const goToDashboard = updatedUser => {
    const dashboardPath = roleHome[updatedUser?.role || user?.role] || '/';
    navigate(dashboardPath, { replace: true });
  };

  const submit = async event => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (missingFields.length > 0) {
      setError(
        `Please fill: ${missingFields
          .map(field => field.replace(/([A-Z])/g, ' $1'))
          .join(', ')}`
      );
      return;
    }

    if (!user?.profilePhoto && !files.profilePhoto) {
      setError('Please choose a Profile Photo before saving.');
      return;
    }

    if (!user?.aadhaarCard && !files.aadhaarCard) {
      setError('Please choose an Aadhaar Card file before saving.');
      return;
    }

    const invalidOtherDoc = otherDocuments.find(document => document.file && !document.documentName.trim());
    if (invalidOtherDoc) {
      setError('Please write a document name for each extra uploaded document.');
      return;
    }

    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        formData.append(key, value);
      }
    });

    Object.entries(files).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    const uploadedOtherDocs = otherDocuments.filter(document => document.file);
    formData.append('documentNames', JSON.stringify(uploadedOtherDocs.map(document => document.documentName.trim())));
    uploadedOtherDocs.forEach(document => formData.append('otherDocuments', document.file));

    try {
      setLoading(true);

      const { data } = await api.put('/users/profile/complete', formData);

      const updatedUser = {
        ...user,
        ...data.user
      };

      dispatch(setUser(updatedUser));
      setSuccess('Profile/documents submitted successfully. HR/Admin will verify it from notification/profile page.');

      if ((updatedUser.profileCompletionPercentage || 0) >= 100) {
        setTimeout(() => goToDashboard(updatedUser), 800);
        return;
      }

      setError(
        `Profile saved but still incomplete. Pending fields: ${
          updatedUser.pendingRequiredFields?.join(', ') || 'Please check required fields'
        }`
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Profile update failed. Please check all fields and uploaded files.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <form onSubmit={submit} noValidate className="card">
        <h1 className="text-2xl font-bold">Complete employee profile</h1>

        <p className="mt-1 text-sm text-slate-500">
          Profile completion: {user?.profileCompletionPercentage || 0}% · Verification:{' '}
          {(user?.verificationStatus || 'not submitted').replace(/_/g, ' ')}
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Full name
            <input className="input mt-1" value={form.name} onChange={event => update('name', event.target.value)} placeholder="Enter full name" />
          </label>

          <label className="text-sm font-medium">
            Contact number
            <input className="input mt-1" value={form.phone} onChange={event => update('phone', event.target.value)} placeholder="Enter contact number" />
          </label>

          <label className="text-sm font-medium md:col-span-2">
            Address
            <input className="input mt-1" value={form.address} onChange={event => update('address', event.target.value)} placeholder="Enter address" />
          </label>

          <label className="text-sm font-medium">
            Emergency contact number
            <input className="input mt-1" value={form.emergencyContactNumber} onChange={event => update('emergencyContactNumber', event.target.value)} placeholder="Enter emergency contact number" />
          </label>

          <label className="text-sm font-medium">
            Date of birth
            <input className="input mt-1" type="date" value={form.dateOfBirth} onChange={event => update('dateOfBirth', event.target.value)} />
          </label>

          <label className="text-sm font-medium">
            Gender
            <select className="input mt-1" value={form.gender} onChange={event => update('gender', event.target.value)}>
              <option value="">Select gender</option>
              {genderOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Joining date
            <input className="input mt-1" type="date" value={form.joiningDate} onChange={event => update('joiningDate', event.target.value)} />
          </label>

          <label className="text-sm font-medium">
            Previous company name
            <input className="input mt-1" value={form.previousCompanyName} onChange={event => update('previousCompanyName', event.target.value)} placeholder="Optional" />
          </label>

          <label className="text-sm font-medium">
            PAN card number
            <input className="input mt-1" value={form.panCard} onChange={event => update('panCard', event.target.value)} placeholder="Optional" />
          </label>

          <label className="text-sm font-medium">
            Profile photo
            <input className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => updateFile('profilePhoto', event.target.files?.[0])} />
            {user?.profilePhoto ? <p className="mt-1 text-xs text-emerald-600">Existing profile photo uploaded.</p> : <p className="mt-1 text-xs text-red-600">Required</p>}
          </label>

          <label className="text-sm font-medium">
            Aadhaar card
            <input className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => updateFile('aadhaarCard', event.target.files?.[0])} />
            {user?.aadhaarCard ? <p className="mt-1 text-xs text-emerald-600">Existing Aadhaar card uploaded.</p> : <p className="mt-1 text-xs text-red-600">Required</p>}
          </label>

          <label className="text-sm font-medium">
            Previous company payslip
            <input className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => updateFile('previousCompanyPayslip', event.target.files?.[0])} />
          </label>

          <label className="text-sm font-medium">
            Experience letter
            <input className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => updateFile('experienceLetter', event.target.files?.[0])} />
          </label>
        </div>

        <div className="mt-8 space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Other relevant documents</h2>
              <p className="text-sm text-slate-500">Upload extra documents and write the document name.</p>
            </div>
            <button type="button" onClick={addOtherDocument} className="btn-secondary flex items-center gap-2"><Plus size={16} /> Add</button>
          </div>

          {otherDocuments.map(document => (
            <div key={document.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950 md:grid-cols-[1fr_1fr_auto]">
              <input className="input" value={document.documentName} onChange={event => updateOtherDocument(document.id, 'documentName', event.target.value)} placeholder="Document name e.g. Offer Letter" />
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => updateOtherDocument(document.id, 'file', event.target.files?.[0] || null)} />
              <button type="button" onClick={() => removeOtherDocument(document.id)} className="btn-secondary flex items-center justify-center gap-2 text-rose-600"><Trash2 size={16} /> Remove</button>
            </div>
          ))}
        </div>

        <button className="btn-primary mt-6 disabled:opacity-60" disabled={loading}>
          {loading ? 'Submitting profile...' : 'Submit profile for HR/Admin verification'}
        </button>
      </form>
    </div>
  );
}
