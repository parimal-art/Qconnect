import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';
import { roleLabel } from '../lib/roles';

const formatDate = value => (value ? new Date(value).toLocaleDateString() : '—');
const formatDateTime = value => (value ? new Date(value).toLocaleString() : '—');

const formatDuration = ms => {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

export default function ProfilePage() {
  const { id } = useParams();
  const { user: loggedInUser } = useSelector(state => state.auth);

  const [profile, setProfile] = useState(id ? null : loggedInUser);
  const [activity, setActivity] = useState({ attendance: [], leads: [] });
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setProfile(loggedInUser);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError('');

      try {
        const [profileResponse, activityResponse] = await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/users/${id}/activity`).catch(() => ({
            data: { attendance: [], leads: [] }
          }))
        ]);

        if (!cancelled) {
          setProfile(profileResponse.data.user);
          setActivity({
            attendance: activityResponse.data.attendance || [],
            leads: activityResponse.data.leads || []
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load employee profile.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [id, loggedInUser]);

  const attendanceColumns = [
    {
      key: 'date',
      header: 'Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'loginTime',
      header: 'Login',
      render: row => formatDateTime(row.loginTime)
    },
    {
      key: 'logoutTime',
      header: 'Logout',
      render: row => formatDateTime(row.logoutTime)
    },
    {
      key: 'active',
      header: 'Active',
      render: row => formatDuration(row.activeTimeInsideShift)
    },
    {
      key: 'idle',
      header: 'Idle',
      render: row => formatDuration(row.idleTimeInsideShift)
    },
    {
      key: 'offline',
      header: 'Offline',
      render: row => formatDuration(row.offlineTimeInsideShift)
    }
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
    {
      key: 'leadType',
      header: 'Type',
      render: row => <StatusBadge value={row.leadType} />
    },
    {
      key: 'pipelineStatus',
      header: 'Pipeline',
      render: row => <StatusBadge value={row.pipelineStatus} />
    },
    {
      key: 'callStatus',
      header: 'Call',
      render: row => row.callStatus || '—'
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: row => formatDateTime(row.updatedAt)
    }
  ];

  if (loading) return <LoadingState rows={6} />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
        Employee profile not found.
      </div>
    );
  }

  const parentName =
    profile.assignedTeamLeader?.name ||
    profile.assignedHR?.name ||
    (profile.role === 'ADMIN' ? '—' : 'Admin');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-blue-50 text-xl font-bold text-blue-700">
              {profile.profilePhoto ? (
                <img
                  src={profile.profilePhoto}
                  alt={profile.name || profile.email}
                  className="h-full w-full object-cover"
                />
              ) : (
                (profile.name || profile.email || '?').slice(0, 1).toUpperCase()
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold">{profile.name || 'Profile pending'}</h1>
              <p className="text-slate-500">{profile.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge value={roleLabel[profile.role] || profile.role} />
                <StatusBadge value={profile.isActive === false ? 'Deactivated' : 'Active'} />
                <StatusBadge value={profile.isVerified ? 'Approved' : 'Pending'} />
              </div>
            </div>
          </div>

          <div className="text-sm text-slate-500">
            <p>
              <b>Employee ID:</b> {profile.employeeId || '—'}
            </p>
            <p>
              <b>Profile completion:</b> {profile.profileCompletionPercentage || 0}%
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
          <p>
            <b>Phone:</b> {profile.phone || '—'}
          </p>
          <p>
            <b>Address:</b> {profile.address || '—'}
          </p>
          <p>
            <b>Parent:</b> {parentName}
          </p>
          <p>
            <b>Shift:</b> {profile.shiftStart || '09:00'} - {profile.shiftEnd || '19:00'}
          </p>
          <p>
            <b>Joining Date:</b> {formatDate(profile.joiningDate)}
          </p>
          <p>
            <b>Last Seen:</b> {formatDateTime(profile.lastSeen)}
          </p>
          <p>
            <b>Online Status:</b> {profile.onlineStatus || 'offline'}
          </p>
          <p>
            <b>Activity:</b> {profile.currentActivityState || 'Offline'}
          </p>
          <p>
            <b>Date of Birth:</b> {formatDate(profile.dateOfBirth)}
          </p>
        </div>

        {profile.pendingRequiredFields?.length > 0 && (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <b>Pending fields:</b> {profile.pendingRequiredFields.join(', ')}
          </div>
        )}
      </div>

      {id && (
        <>
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Recent attendance</h2>
            <DataTable columns={attendanceColumns} rows={activity.attendance} keyField="_id" />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">Recent leads</h2>
            <DataTable columns={leadColumns} rows={activity.leads} keyField="_id" />
          </div>
        </>
      )}
    </div>
  );
}
