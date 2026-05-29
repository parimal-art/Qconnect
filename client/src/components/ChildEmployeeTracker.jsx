import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../lib/api';
import { connectSocket } from '../lib/socket';

import DataTable from './DataTable';
import StatusBadge from './StatusBadge';
import { LoadingState } from './LoadingState';

const REFRESH_EVERY_MS = 5 * 60 * 1000;
const LIVE_TICK_MS = 60 * 1000;

const fmt = value =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

const dateFmt = value => (value ? new Date(value).toLocaleString() : '—');

const number = value => Number(value || 0);

const formatDuration = ms => {
  const totalMinutes = Math.max(0, Math.round(number(ms) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

const parseHHMM = value => {
  if (!value || typeof value !== 'string') {
    return { hours: 0, minutes: 0 };
  }

  const [hours, minutes] = value.split(':').map(Number);

  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0
  };
};

const getShiftBounds = (baseDate, shiftStart = '09:00', shiftEnd = '19:00') => {
  const startParts = parseHHMM(shiftStart);
  const endParts = parseHHMM(shiftEnd);

  const start = new Date(baseDate);
  start.setHours(startParts.hours, startParts.minutes, 0, 0);

  const end = new Date(baseDate);
  end.setHours(endParts.hours, endParts.minutes, 0, 0);

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
};

const splitInsideShiftMs = ({ from, to, shiftStart, shiftEnd }) => {
  const start = new Date(from);
  const end = new Date(to);

  if (!from || !to || end <= start) {
    return 0;
  }

  const { start: shiftFrom, end: shiftTo } = getShiftBounds(start, shiftStart, shiftEnd);

  const overlapStart = Math.max(start.getTime(), shiftFrom.getTime());
  const overlapEnd = Math.min(end.getTime(), shiftTo.getTime());

  return Math.max(0, overlapEnd - overlapStart);
};

const normaliseAttendancePatch = attendance => {
  if (!attendance) return {};

  return {
    loginTime: attendance.loginTime,
    logoutTime: attendance.logoutTime,
    attendanceStatus: attendance.status,
    currentActivityState: attendance.currentState,
    lastHeartbeatAt: attendance.lastHeartbeatAt,
    currentStateStartedAt: attendance.lastStateStartedAt,
    trackerSnapshotAt: attendance.lastHeartbeatAt || new Date().toISOString(),
    shiftStart: attendance.shiftStart,
    shiftEnd: attendance.shiftEnd,

    activeTimeInsideShiftMs: number(attendance.activeTimeInsideShift),
    idleTimeInsideShiftMs: number(attendance.idleTimeInsideShift),
    offlineTimeInsideShiftMs: number(attendance.offlineTimeInsideShift),
    breakTimeInsideShiftMs: number(attendance.breakTimeInsideShift),
    activeTimeOutsideShiftMs: number(attendance.activeTimeOutsideShift),
    offlineTimeOutsideShiftMs: number(attendance.offlineTimeOutsideShift),
    totalBreakTimeMs: number(attendance.totalBreakTime),
    totalIdleTimeMs: number(attendance.totalIdleTime),
    totalOfflineTimeMs: number(attendance.totalOfflineTime)
  };
};

const getLiveDurationMs = (row, type, now) => {
  const baseMap = {
    active: 'activeTimeInsideShiftMs',
    idle: 'idleTimeInsideShiftMs',
    offline: 'offlineTimeInsideShiftMs',
    break: 'totalBreakTimeMs',
    outside: 'activeTimeOutsideShiftMs',
    offlineOutside: 'offlineTimeOutsideShiftMs'
  };

  let value = number(row[baseMap[type]]);

  const status = row.currentActivityState;
  const onlineStatus = row.onlineStatus;
  const snapshotAt = row.trackerSnapshotAt || row.lastHeartbeatAt || row.lastSeen;

  if (!snapshotAt) {
    return value;
  }

  const shouldAddLiveMs =
    (type === 'active' && onlineStatus === 'online' && ['Active', 'Online'].includes(status)) ||
    (type === 'idle' && onlineStatus === 'online' && status === 'Idle') ||
    (type === 'break' && onlineStatus === 'online' && status === 'On Break') ||
    (type === 'offline' && (onlineStatus === 'offline' || status === 'Offline')) ||
    (type === 'outside' && onlineStatus === 'online' && ['Active', 'Online'].includes(status)) ||
    (type === 'offlineOutside' && (onlineStatus === 'offline' || status === 'Offline'));

  if (!shouldAddLiveMs) {
    return value;
  }

  const from = new Date(snapshotAt);
  const to = now;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return value;
  }

  const totalElapsed = to.getTime() - from.getTime();

  const insideShiftMs = splitInsideShiftMs({
    from,
    to,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd
  });

  const outsideShiftMs = Math.max(0, totalElapsed - insideShiftMs);

  if (type === 'outside' || type === 'offlineOutside') {
    value += outsideShiftMs;
  } else {
    value += insideShiftMs;
  }

  return value;
};

export default function ChildEmployeeTracker() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [now, setNow] = useState(() => new Date());

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
      setNow(new Date());
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

    const updateStatusAndDuration = payload => {
      if (!payload?.userId) return;

      const attendancePatch = normaliseAttendancePatch(payload.attendance);

      setRows(previousRows =>
        previousRows.map(row => {
          if (String(row.userId) !== String(payload.userId)) {
            return row;
          }

          return {
            ...row,
            ...attendancePatch,
            onlineStatus: payload.onlineStatus ?? row.onlineStatus,
            currentActivityState:
              payload.currentActivityState ??
              attendancePatch.currentActivityState ??
              row.currentActivityState,
            lastSeen: payload.lastSeen ?? row.lastSeen,
            trackerSnapshotAt:
              attendancePatch.trackerSnapshotAt ||
              payload.lastSeen ||
              row.trackerSnapshotAt ||
              new Date().toISOString()
          };
        })
      );

      setNow(new Date());
    };

    socket?.on('child_employee_status_updated', updateStatusAndDuration);

    const refreshTimer = setInterval(() => {
      load({ silent: true });
    }, REFRESH_EVERY_MS);

    const liveTimer = setInterval(() => {
      setNow(new Date());
    }, LIVE_TICK_MS);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(liveTimer);
      socket?.off('child_employee_status_updated', updateStatusAndDuration);
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
          <p>{row.assignedWorkingHours || `${row.shiftStart || '09:00'} - ${row.shiftEnd || '19:00'}`}</p>
          <p className="text-xs text-slate-500">
            {row.totalShiftDuration || '—'}
          </p>
        </div>
      )
    },
    {
      key: 'active',
      header: 'Active In Shift',
      render: row => formatDuration(getLiveDurationMs(row, 'active', now))
    },
    {
      key: 'idle',
      header: 'Idle',
      render: row => formatDuration(getLiveDurationMs(row, 'idle', now))
    },
    {
      key: 'offline',
      header: 'Offline In Shift',
      render: row => formatDuration(getLiveDurationMs(row, 'offline', now))
    },
    {
      key: 'break',
      header: 'Break',
      render: row => formatDuration(getLiveDurationMs(row, 'break', now))
    },
    {
      key: 'outside',
      header: 'Out Shift',
      render: row => formatDuration(getLiveDurationMs(row, 'outside', now))
    },
    {
      key: 'offlineOutside',
      header: 'Offline Out Shift',
      render: row => formatDuration(getLiveDurationMs(row, 'offlineOutside', now))
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
            Status updates live. Time updates in hours and minutes.
          </p>

          {lastUpdatedAt && (
            <p className="mt-1 text-xs text-slate-400">
              Last refreshed: {lastUpdatedAt.toLocaleTimeString()} · Auto-refresh every 5 minutes
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