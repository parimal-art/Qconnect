import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';
import { ROLES, roleLabel } from '../lib/roles';

const buildRoleOptions = role => [
  { label: 'All roles', value: 'all' },
  ...(role === ROLES.SUPER_ADMIN ? [{ label: 'Admin', value: ROLES.ADMIN }] : []),
  { label: 'HR', value: ROLES.HR },
  { label: 'Team Leader', value: ROLES.TEAM_LEADER },
  { label: 'Salesperson', value: ROLES.SALESPERSON }
];

const verificationGroupOptions = [
  { label: 'All document statuses', value: 'all' },
  { label: 'New Employees (before document verification)', value: 'new' },
  { label: 'Document verification pending', value: 'pending' },
  { label: 'Completed / Verified', value: 'completed' },
  { label: 'Rejected / Not verified', value: 'rejected' }
];

export default function EmployeesPage() {
  const { user } = useSelector(state => state.auth);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const roleOptions = useMemo(() => buildRoleOptions(user?.role), [user?.role]);
  const canManageActiveStatus = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      params.set('status', statusFilter);

      if (roleFilter !== 'all') {
        params.set('role', roleFilter);
      }

      if (verificationFilter !== 'all') {
        params.set('verificationGroup', verificationFilter);
      }

      const { data } = await api.get(`/users?${params.toString()}`);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, verificationFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleUsers = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (!text) return users;

    return users.filter(employee =>
      [
        employee.name,
        employee.email,
        employee.employeeId,
        employee.role,
        employee.assignedHR?.name,
        employee.assignedTeamLeader?.name,
        employee.createdBy?.name
      ]
        .join(' ')
        .toLowerCase()
        .includes(text)
    );
  }, [users, query]);

  const toggleActiveStatus = async employee => {
    setMessage('');
    setError('');
    setUpdatingId(employee._id);

    try {
      const { data } = await api.patch(`/users/${employee._id}/status`, {
        isActive: !employee.isActive
      });

      setMessage(data.message);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Employee status update failed.');
    } finally {
      setUpdatingId('');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Employee',
      render: employee => (
        <div>
          <Link
            to={`/employees/${employee._id}`}
            className="font-semibold text-blue-600 hover:underline"
          >
            {employee.name || employee.email}
          </Link>
          <p className="text-xs text-slate-500">{employee.employeeId || '—'}</p>
          <p className="text-xs text-slate-400">{employee.email}</p>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      render: employee => roleLabel[employee.role] || employee.role
    },
    {
      key: 'parent',
      header: 'Parent',
      render: employee =>
        employee.assignedTeamLeader?.name ||
        employee.assignedHR?.name ||
        employee.createdBy?.name ||
        (employee.role === ROLES.ADMIN ? 'Super Admin' : 'Admin')
    },
    {
      key: 'loginAccess',
      header: 'Login Access',
      render: employee => (
        <StatusBadge value={employee.isActive ? 'Active' : 'Deactivated'} />
      )
    },
    {
      key: 'activity',
      header: 'Activity',
      render: employee => <StatusBadge value={employee.currentActivityState} />
    },
    {
      key: 'profileCompletionPercentage',
      header: 'Profile',
      render: employee => `${employee.profileCompletionPercentage || 0}%`
    },
    {
      key: 'verificationStatus',
      header: 'Verification',
      render: employee => <StatusBadge value={employee.verificationStatus || (employee.isVerified ? 'verified' : 'pending_review')} />
    },
    {
      key: 'shift',
      header: 'Shift',
      render: employee => `${employee.shiftStart || '09:00'} - ${employee.shiftEnd || '19:00'}`
    },
    {
      key: 'actions',
      header: 'Actions',
      render: employee =>
        canManageActiveStatus ? (
          <button
            type="button"
            onClick={() => toggleActiveStatus(employee)}
            disabled={updatingId === employee._id || String(employee._id) === String(user?.id)}
            className={`text-sm font-semibold ${
              employee.isActive ? 'text-rose-600' : 'text-emerald-600'
            } disabled:opacity-60`}
          >
            {updatingId === employee._id
              ? 'Updating...'
              : employee.isActive
                ? 'Deactivate'
                : 'Activate'}
          </button>
        ) : (
          '—'
        )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-slate-500">
            Super Admin can control all admins and employees. Admins can access only their own employee hierarchy.
          </p>
        </div>

        {[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR].includes(user?.role) && (
          <Link to="/employees/new" className="btn-primary w-fit">
            Generate Employee
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-5">
        <input
          className="input"
          placeholder="Search name, email, ID, role..."
          value={query}
          onChange={event => setQuery(event.target.value)}
        />

        <select
          className="input"
          value={roleFilter}
          onChange={event => setRoleFilter(event.target.value)}
        >
          {roleOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value)}
        >
          <option value="all">All login statuses</option>
          <option value="active">Active login only</option>
          <option value="inactive">Deactivated only</option>
        </select>

        <select
          className="input"
          value={verificationFilter}
          onChange={event => setVerificationFilter(event.target.value)}
        >
          {verificationGroupOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={load} className="btn-secondary">
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <DataTable columns={columns} rows={visibleUsers} keyField="_id" />
      )}
    </div>
  );
}
