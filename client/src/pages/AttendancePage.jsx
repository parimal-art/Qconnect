import { useEffect, useState } from 'react';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';

const formatDuration = ms => {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

export default function AttendancePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    if (silent) {
      setRefreshing(true);
    }

    try {
      const { data } = await api.get('/attendance/report');
      setRows(data.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns = [
    {
      key: 'user',
      header: 'Employee',
      render: row => (
        <div>
          <p className="font-semibold">{row.user?.name || row.user?.email}</p>
          <p className="text-xs text-slate-500">{row.user?.employeeId}</p>
        </div>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: row => new Date(row.date).toLocaleDateString()
    },
    {
      key: 'loginTime',
      header: 'Login',
      render: row => (row.loginTime ? new Date(row.loginTime).toLocaleTimeString() : '—')
    },
    {
      key: 'logoutTime',
      header: 'Logout',
      render: row => (row.logoutTime ? new Date(row.logoutTime).toLocaleTimeString() : '—')
    },
    {
      key: 'activeTimeInsideShift',
      header: 'Active In Shift',
      render: row => formatDuration(row.activeTimeInsideShift)
    },
    {
      key: 'idleTimeInsideShift',
      header: 'Idle',
      render: row => formatDuration(row.idleTimeInsideShift)
    },
    {
      key: 'offlineTimeInsideShift',
      header: 'Offline',
      render: row => formatDuration(row.offlineTimeInsideShift)
    },
    {
      key: 'breakTimeInsideShift',
      header: 'Break',
      render: row => formatDuration(row.breakTimeInsideShift)
    },
    {
      key: 'activeTimeOutsideShift',
      header: 'Out of Shift',
      render: row => formatDuration(row.activeTimeOutsideShift)
    },
    {
      key: 'offlineTimeOutsideShift',
      header: 'Offline Out Shift',
      render: row => formatDuration(row.offlineTimeOutsideShift)
    },
    {
      key: 'status',
      header: 'Session',
      render: row => row.status
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Attendance tracking</h1>
          <p className="text-slate-500">
            Login/logout and working-hour activity report in hours and minutes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => load({ silent: true })}
          disabled={refreshing}
          className="btn-secondary w-fit"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <DataTable columns={columns} rows={rows} keyField="_id" />
      )}
    </div>
  );
}