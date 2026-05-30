import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import TargetSummaryPanel from '../components/TargetSummaryPanel';
import { LoadingState } from '../components/LoadingState';
import { ROLES, roleLabel } from '../lib/roles';
import { setUser } from '../store/authSlice';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const assetUrl = url => (url?.startsWith('/uploads') ? `${API_ORIGIN}${url}` : url);

const formatDate = value => (value ? new Date(value).toLocaleDateString() : '—');
const formatDateTime = value => (value ? new Date(value).toLocaleString() : '—');
const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const formatDuration = ms => {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

const newOtherDocument = () => ({ documentName: '', file: null, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` });

export default function ProfilePage() {
  const { id } = useParams();
  const { user: loggedInUser } = useSelector(state => state.auth);
  const dispatch = useDispatch();

  const [profile, setProfile] = useState(id ? null : loggedInUser);
  const [activity, setActivity] = useState({ attendance: [], leads: [] });
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [verification, setVerification] = useState({ status: 'verified', notes: '' });
  const [verifying, setVerifying] = useState(false);

  const [targetForm, setTargetForm] = useState({ amount: '', notes: '', periodStart: '', periodEnd: '' });
  const [assigningTarget, setAssigningTarget] = useState(false);

  const [profileForm, setProfileForm] = useState({ phone: '', address: '', emergencyContactNumber: '' });
  const [files, setFiles] = useState({ profilePhoto: null, aadhaarCard: null });
  const [otherDocuments, setOtherDocuments] = useState([newOtherDocument()]);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const targetId = id || loggedInUser?.id;
  const isOwnProfile = !id || String(id) === String(loggedInUser?.id);
  const canVerify = [ROLES.ADMIN, ROLES.HR].includes(loggedInUser?.role) && !isOwnProfile;

  const loadProfile = async () => {
    if (!id) {
      setProfile(loggedInUser);
      setProfileForm({
        phone: loggedInUser?.phone || '',
        address: loggedInUser?.address || '',
        emergencyContactNumber: loggedInUser?.emergencyContactNumber || ''
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [profileResponse, activityResponse] = await Promise.all([
        api.get(`/users/${id}`),
        api.get(`/users/${id}/activity`).catch(() => ({ data: { attendance: [], leads: [] } }))
      ]);

      setProfile(profileResponse.data.user);
      setActivity({
        attendance: activityResponse.data.attendance || [],
        leads: activityResponse.data.leads || []
      });
      setVerification({ status: profileResponse.data.user.verificationStatus === 'verified' ? 'verified' : 'document_pending', notes: profileResponse.data.user.verificationNotes || '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employee profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loggedInUser?.id]);

  useEffect(() => {
    if (!profile || !isOwnProfile) return;
    setProfileForm({
      phone: profile.phone || '',
      address: profile.address || '',
      emergencyContactNumber: profile.emergencyContactNumber || ''
    });
  }, [profile, isOwnProfile]);

  const canAssignTarget = useMemo(() => {
    if (!profile) return false;
    if (loggedInUser?.role === ROLES.ADMIN && profile.role !== ROLES.ADMIN) return true;
    if (loggedInUser?.role === ROLES.HR && profile.role === ROLES.TEAM_LEADER) return true;
    if (loggedInUser?.role === ROLES.TEAM_LEADER && profile.role === ROLES.SALESPERSON) return true;
    return false;
  }, [loggedInUser?.role, profile]);

  const attendanceColumns = [
    { key: 'date', header: 'Date', render: row => formatDate(row.date) },
    { key: 'loginTime', header: 'Login', render: row => formatDateTime(row.loginTime) },
    { key: 'logoutTime', header: 'Logout', render: row => formatDateTime(row.logoutTime) },
    { key: 'active', header: 'Active', render: row => formatDuration(row.activeTimeInsideShift) },
    { key: 'idle', header: 'Idle', render: row => formatDuration(row.idleTimeInsideShift) },
    { key: 'offline', header: 'Offline', render: row => formatDuration(row.offlineTimeInsideShift) }
  ];

  const leadColumns = [
    {
      key: 'name',
      header: 'Lead',
      render: row => (
        <div>
          <p className="font-semibold">{row.name}</p>
          <p className="text-xs text-slate-500">{row.companyName || 'No company'}</p>
        </div>
      )
    },
    { key: 'leadType', header: 'Type', render: row => <StatusBadge value={row.leadType} /> },
    { key: 'pipelineStatus', header: 'Pipeline', render: row => <StatusBadge value={row.pipelineStatus} /> },
    { key: 'finalizationStatus', header: 'Deal', render: row => <StatusBadge value={row.finalizationStatus || 'not_requested'} /> },
    { key: 'amount', header: 'Final Amount', render: row => money(row.finalizedAmount) },
    { key: 'updatedAt', header: 'Updated', render: row => formatDateTime(row.updatedAt) }
  ];

  const verifyProfile = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    setVerifying(true);

    try {
      const { data } = await api.put(`/users/${profile._id}/verify`, verification);
      setProfile(data.user);
      setMessage('Employee verification status updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification update failed.');
    } finally {
      setVerifying(false);
    }
  };

  const assignTarget = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!targetForm.amount || Number(targetForm.amount) <= 0) {
      setError('Enter a valid target amount.');
      return;
    }

    setAssigningTarget(true);

    try {
      await api.post('/targets', {
        ...targetForm,
        assignedTo: profile._id
      });
      setTargetForm({ amount: '', notes: '', periodStart: '', periodEnd: '' });
      setMessage('Target assigned successfully. Refresh target panel to see latest values.');
    } catch (err) {
      setError(err.response?.data?.message || 'Target assignment failed.');
    } finally {
      setAssigningTarget(false);
    }
  };

  const updateOtherDocument = (documentId, key, value) => {
    setOtherDocuments(current => current.map(document => (document.id === documentId ? { ...document, [key]: value } : document)));
  };

  const submitOwnProfileUpdate = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    const invalidOtherDoc = otherDocuments.find(document => document.file && !document.documentName.trim());
    if (invalidOtherDoc) {
      setError('Please write a document name for each extra uploaded document.');
      return;
    }

    const formData = new FormData();
    Object.entries(profileForm).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });
    Object.entries(files).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    const uploadedDocs = otherDocuments.filter(document => document.file);
    formData.append('documentNames', JSON.stringify(uploadedDocs.map(document => document.documentName.trim())));
    uploadedDocs.forEach(document => formData.append('otherDocuments', document.file));

    setUpdatingProfile(true);

    try {
      const { data } = await api.put('/users/profile/complete', formData);
      setProfile(data.user);
      dispatch(setUser({ ...loggedInUser, ...data.user }));
      setMessage('Profile changes submitted. HR/Admin will reverify your documents.');
      setFiles({ profilePhoto: null, aadhaarCard: null });
      setOtherDocuments([newOtherDocument()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Profile update failed.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  if (loading) return <LoadingState rows={6} />;

  if (error && !profile) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>;
  }

  if (!profile) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">Employee profile not found.</div>;
  }

  const parentName = profile.assignedTeamLeader?.name || profile.assignedHR?.name || (profile.role === 'ADMIN' ? '—' : 'Admin');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</div>}

      <div className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-blue-50 text-xl font-bold text-blue-700">
              {profile.profilePhoto ? <img src={assetUrl(profile.profilePhoto)} alt={profile.name || profile.email} className="h-full w-full object-cover" /> : (profile.name || profile.email || '?').slice(0, 1).toUpperCase()}
            </div>

            <div>
              <h1 className="text-2xl font-bold">{profile.name || 'Profile pending'}</h1>
              <p className="text-slate-500">{profile.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge value={roleLabel[profile.role] || profile.role} />
                <StatusBadge value={profile.isActive === false ? 'Deactivated' : 'Active'} />
                <StatusBadge value={profile.verificationStatus || (profile.isVerified ? 'verified' : 'pending_review')} />
              </div>
            </div>
          </div>

          <div className="text-sm text-slate-500">
            <p><b>Employee ID:</b> {profile.employeeId || '—'}</p>
            <p><b>Profile completion:</b> {profile.profileCompletionPercentage || 0}%</p>
            <p><b>Last submitted:</b> {formatDateTime(profile.lastProfileSubmittedAt)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
          <p><b>Phone:</b> {profile.phone || '—'}</p>
          <p><b>Address:</b> {profile.address || '—'}</p>
          <p><b>Parent:</b> {parentName}</p>
          <p><b>Shift:</b> {profile.shiftStart || '09:00'} - {profile.shiftEnd || '19:00'}</p>
          <p><b>Joining Date:</b> {formatDate(profile.joiningDate)}</p>
          <p><b>Last Seen:</b> {formatDateTime(profile.lastSeen)}</p>
          <p><b>Online Status:</b> {profile.onlineStatus || 'offline'}</p>
          <p><b>Activity:</b> {profile.currentActivityState || 'Offline'}</p>
          <p><b>Date of Birth:</b> {formatDate(profile.dateOfBirth)}</p>
          <p><b>Emergency Contact:</b> {profile.emergencyContactNumber || '—'}</p>
          <p><b>Previous Company:</b> {profile.previousCompanyName || '—'}</p>
          <p><b>PAN:</b> {profile.panCard || '—'}</p>
        </div>

        {profile.pendingRequiredFields?.length > 0 && (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <b>Pending fields:</b> {profile.pendingRequiredFields.join(', ')}
          </div>
        )}

        {profile.verificationNotes && (
          <div className="mt-6 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            <b>Verification note:</b> {profile.verificationNotes}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="text-xl font-bold">Employee documents</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profile.profilePhoto && <a className="btn-secondary text-center" href={assetUrl(profile.profilePhoto)} target="_blank" rel="noreferrer">View Profile Photo</a>}
          {profile.aadhaarCard && <a className="btn-secondary text-center" href={assetUrl(profile.aadhaarCard)} target="_blank" rel="noreferrer">View Aadhaar Card</a>}
          {profile.previousCompanyPayslip && <a className="btn-secondary text-center" href={assetUrl(profile.previousCompanyPayslip)} target="_blank" rel="noreferrer">View Payslip</a>}
          {profile.experienceLetter && <a className="btn-secondary text-center" href={assetUrl(profile.experienceLetter)} target="_blank" rel="noreferrer">View Experience Letter</a>}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(profile.documents || []).map(document => (
            <div key={document._id || document.url} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{document.documentName || document.label || 'Document'}</p>
                  <p className="text-xs text-slate-500">Uploaded: {formatDateTime(document.uploadedAt)}</p>
                </div>
                <StatusBadge value={document.status || 'pending_review'} />
              </div>
              {document.url && <a href={assetUrl(document.url)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">Open / Download</a>}
              {document.reviewNote && <p className="mt-2 text-xs text-slate-500">Note: {document.reviewNote}</p>}
            </div>
          ))}
          {!profile.documents?.length && <p className="text-sm text-slate-500">No extra documents uploaded yet.</p>}
        </div>
      </div>

      {canVerify && (
        <form onSubmit={verifyProfile} className="card space-y-4">
          <h2 className="text-xl font-bold">HR/Admin verification</h2>
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <select className="input" value={verification.status} onChange={event => setVerification(current => ({ ...current, status: event.target.value }))}>
              <option value="verified">Verify</option>
              <option value="document_pending">Document Pending</option>
              <option value="not_verified">Not Verified</option>
            </select>
            <input className="input" value={verification.notes} onChange={event => setVerification(current => ({ ...current, notes: event.target.value }))} placeholder="Review note for employee" />
            <button className="btn-primary" disabled={verifying}>{verifying ? 'Saving...' : 'Save status'}</button>
          </div>
        </form>
      )}

      {(profile.role === ROLES.TEAM_LEADER || profile.role === ROLES.SALESPERSON || isOwnProfile) && (
        <TargetSummaryPanel userId={targetId} title="Target and sales performance" />
      )}

      {canAssignTarget && (
        <form onSubmit={assignTarget} className="card space-y-4">
          <h2 className="text-xl font-bold">Assign sales target</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input className="input" type="number" min="0" value={targetForm.amount} onChange={event => setTargetForm(current => ({ ...current, amount: event.target.value }))} placeholder="Target amount" />
            <input className="input" type="date" value={targetForm.periodStart} onChange={event => setTargetForm(current => ({ ...current, periodStart: event.target.value }))} />
            <input className="input" type="date" value={targetForm.periodEnd} onChange={event => setTargetForm(current => ({ ...current, periodEnd: event.target.value }))} />
            <input className="input" value={targetForm.notes} onChange={event => setTargetForm(current => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
            <button className="btn-primary" disabled={assigningTarget}>{assigningTarget ? 'Assigning...' : 'Assign target'}</button>
          </div>
        </form>
      )}

      {isOwnProfile && (
        <form onSubmit={submitOwnProfileUpdate} className="card space-y-4">
          <h2 className="text-xl font-bold">Update my profile/documents</h2>
          <p className="text-sm text-slate-500">Any profile or document change will notify HR/Admin for re-verification.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" value={profileForm.phone} onChange={event => setProfileForm(current => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
            <input className="input" value={profileForm.address} onChange={event => setProfileForm(current => ({ ...current, address: event.target.value }))} placeholder="Address" />
            <input className="input" value={profileForm.emergencyContactNumber} onChange={event => setProfileForm(current => ({ ...current, emergencyContactNumber: event.target.value }))} placeholder="Emergency contact" />
            <label className="text-sm font-medium">Profile photo<input className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFiles(current => ({ ...current, profilePhoto: event.target.files?.[0] || null }))} /></label>
            <label className="text-sm font-medium">Aadhaar card<input className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFiles(current => ({ ...current, aadhaarCard: event.target.files?.[0] || null }))} /></label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Add other required documents</p>
              <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => setOtherDocuments(current => [...current, newOtherDocument()])}><Plus size={16} /> Add</button>
            </div>
            {otherDocuments.map(document => (
              <div key={document.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input className="input" value={document.documentName} onChange={event => updateOtherDocument(document.id, 'documentName', event.target.value)} placeholder="Document name" />
                <input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => updateOtherDocument(document.id, 'file', event.target.files?.[0] || null)} />
                <button type="button" className="btn-secondary text-rose-600" onClick={() => setOtherDocuments(current => current.length === 1 ? current : current.filter(item => item.id !== document.id))}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <button className="btn-primary" disabled={updatingProfile}>{updatingProfile ? 'Submitting...' : 'Submit changes for re-verification'}</button>
        </form>
      )}

      {id && (
        <>
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Recent attendance</h2>
            <DataTable columns={attendanceColumns} rows={activity.attendance} keyField="_id" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent leads</h2>
              <Link to="/quotations" className="text-sm font-semibold text-blue-600 hover:underline">View quotations</Link>
            </div>
            <DataTable columns={leadColumns} rows={activity.leads} keyField="_id" />
          </div>
        </>
      )}
    </div>
  );
}
