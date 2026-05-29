import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../lib/api';
import { connectSocket } from '../lib/socket';

import DataTable from './DataTable';
import StatusBadge from './StatusBadge';
import { LoadingState } from './LoadingState';

const REFRESH_EVERY_MS = 5 * 60 * 1000;

const fmt = value =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

const dateFmt = value => (value ? new Date(value).toLocaleString() : '—');

export default function ChildEmployeeTracker() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const load = useCallback(async ({ silent = false, manual = false } = {}) => {
    if (!silent && !manual) {
      setLoading(true);
    }

    if (manual) {
      setManualRefreshing(true);
    }

    try {
      const { data } = await api.get('/users/children/tracking');

      setRows(data.data || []);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Failed to load child employee tracking data:', error);
    } finally {
      if (!silent && !manual) {
        setLoading(false);
      }

      if (manual) {
        setManualRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();

    const socket = connectSocket();

    const updateStatusOnly = payload => {
      if (!payload?.userId) return;

      setRows(previousRows =>
        previousRows.map(row => {
          if (row.userId !== payload.userId) {
            return row;
          }

          return {
            ...row,
            onlineStatus: payload.onlineStatus ?? row.onlineStatus,
            currentActivityState:
              payload.currentActivityState ?? row.currentActivityState,
            lastSeen: payload.lastSeen ?? row.lastSeen
          };
        })
      );
    };

    socket?.on('child_employee_status_updated', updateStatusOnly);

    const refreshTimer = setInterval(() => {
      load({ silent: true });
    }, REFRESH_EVERY_MS);

    return () => {
      clearInterval(refreshTimer);
      socket?.off('child_employee_status_updated', updateStatusOnly);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const searchText = query.toLowerCase().trim();

    if (!searchText) {
      return rows;
    }

    return rows.filter(row =>
      [
        row.employeeName,
        row.employeeId,
        row.role,
        row.assignedParentName,
        row.onlineStatus,
        row.currentActivityState
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchText)
    );
  }, [rows, query]);

  const columns = [
    {
      key: 'employeeName',
      header: 'Employee',
      render: row => (
        <div>
          <p className="font-semibold">{row.employeeName}</p>
          <p className="text-xs text-slate-500">{row.employeeId}</p>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role'
    },
    {
      key: 'assignedParentName',
      header: 'Parent',
      render: row => row.assignedParentName || '—'
    },
    {
      key: 'currentActivityState',
      header: 'Status',
      render: row => (
        <div className="space-y-1">
          <StatusBadge value={row.currentActivityState} />
          <p className="text-xs text-slate-500">{row.onlineStatus || '—'}</p>
        </div>
      )
    },
    {
      key: 'times',
      header: 'Login / Logout',
      render: row => (
        <div>
          {fmt(row.loginTime)}
          <span className="text-slate-400"> → </span>
          {fmt(row.logoutTime)}
        </div>
      )
    },
    {
      key: 'shift',
      header: 'Shift',
      render: row => (
        <div>
          <p>{row.assignedWorkingHours || '—'}</p>
          <p className="text-xs text-slate-500">
            {row.totalShiftDuration || '—'}
          </p>
        </div>
      )
    },
    {
      key: 'active',
      header: 'Active In Shift',
      render: row => row.totalActiveTimeDuringWorkingHours || '0h 0m'
    },
    {
      key: 'idle',
      header: 'Idle',
      render: row => row.totalIdleTimeDuringWorkingHours || '0h 0m'
    },
    {
      key: 'offline',
      header: 'Offline In Shift',
      render: row => row.totalOfflineTimeDuringWorkingHours || '0h 0m'
    },
    {
      key: 'break',
      header: 'Break',
      render: row => row.totalBreakTime || '0h 0m'
    },
    {
      key: 'outside',
      header: 'Out Shift',
      render: row => row.outOfShiftActivityTime || '0h 0m'
    },
    {
      key: 'leadStats',
      header: 'Leads',
      render: row => (
        <div className="text-xs">
          <p>Total: {row.todaysLeadCount || 0}</p>
          <p>
            Done: {row.completedLeadCount || 0} · Pending:{' '}
            {row.pendingLeadCount || 0}
          </p>
          <p>Follow-up: {row.followUpDueCount || 0}</p>
        </div>
      )
    },
    {
      key: 'performancePercentage',
      header: 'Performance',
      render: row => (
        <div className="min-w-28">
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{
                width: `${Math.min(row.performancePercentage || 0, 100)}%`
              }}
            />
          </div>
          <p className="mt-1 text-xs">{row.performancePercentage || 0}%</p>
        </div>
      )
    },
    {
      key: 'lastSeen',
      header: 'Last seen',
      render: row => dateFmt(row.lastSeen)
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Child Employee Tracker</h1>

          <p className="text-sm text-slate-500">
            Status updates live. Full tracker data auto-refreshes every 5 minutes.
          </p>

          {lastUpdatedAt && (
            <p className="mt-1 text-xs text-slate-400">
              Last refreshed: {lastUpdatedAt.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => load({ manual: true })}
            disabled={manualRefreshing}
            className="btn-secondary whitespace-nowrap"
          >
            {manualRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>

          <input
            className="input max-w-sm"
            placeholder="Search employee, role, parent..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState rows={6} />
      ) : (
        <DataTable columns={columns} rows={filtered} keyField="userId" />
      )}
    </div>
  );
}