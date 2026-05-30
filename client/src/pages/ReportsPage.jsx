import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';

const formatDate = value => (value ? new Date(value).toLocaleDateString() : '—');

const formatDuration = ms => {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

const employeeLink = employee => {
  if (!employee) return '—';

  if (!employee._id) {
    return employee.name || employee.email || JSON.stringify(employee);
  }

  return (
    <Link
      to={`/employees/${employee._id}`}
      className="font-semibold text-blue-600 hover:underline"
    >
      {employee.name || employee.email || employee.employeeId}
    </Link>
  );
};

export default function ReportsPage() {
  const [type, setType] = useState('team-performance');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);

    const endpoint =
      type === 'leads'
        ? '/reports/leads'
        : type === 'attendance'
          ? '/reports/attendance'
          : '/reports/team-performance';

    try {
      const { data } = await api.get(endpoint);
      setRows(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [type]);

  const download = format => {
    const url = `${
      import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    }/reports/export/${format}?type=${type}&format=${format}`;

    const token = localStorage.getItem('crm_access_token');

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include'
    }).then(async res => {
      const blob = await res.blob();
      const a = document.createElement('a');

      a.href = URL.createObjectURL(blob);
      a.download = `${type}.${format === 'excel' ? 'xlsx' : format}`;
      a.click();
    });
  };

  const columns = useMemo(() => {
    if (type === 'team-performance') {
      return [
        {
          key: 'employee',
          header: 'Employee',
          render: row => employeeLink(row.employee)
        },
        { key: 'total', header: 'Total Leads' },
        { key: 'completed', header: 'Completed' },
        { key: 'won', header: 'Won' },
        { key: 'lost', header: 'Lost' },
        { key: 'selfGenerated', header: 'Self Generated' },
        {
          key: 'performancePercentage',
          header: 'Performance',
          render: row => `${row.performancePercentage || 0}%`
        }
      ];
    }

    if (type === 'attendance') {
      return [
        {
          key: 'user',
          header: 'Employee',
          render: row => employeeLink(row.user)
        },
        {
          key: 'date',
          header: 'Date',
          render: row => formatDate(row.date)
        },
        {
          key: 'activeTimeInsideShift',
          header: 'Active',
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
        { key: 'status', header: 'Session' }
      ];
    }

    return [
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
        key: 'assignedTo',
        header: 'Assigned To',
        render: row => employeeLink(row.assignedTo)
      },
      {
        key: 'assignedBy',
        header: 'Assigned By',
        render: row => employeeLink(row.assignedBy)
      },
      {
        key: 'isCompleted',
        header: 'Completed',
        render: row => <StatusBadge value={row.isCompleted ? 'Approved' : 'Pending'} />
      }
    ];
  }, [type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & exports</h1>
          <p className="text-slate-500">
            Role-permission based CSV, Excel and PDF reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={type}
            onChange={event => setType(event.target.value)}
            className="input w-56"
          >
            <option value="team-performance">Team performance</option>
            <option value="leads">Lead report</option>
            <option value="attendance">Attendance report</option>
          </select>

          <button onClick={() => download('csv')} className="btn-secondary">
            CSV
          </button>

          <button onClick={() => download('excel')} className="btn-secondary">
            Excel
          </button>

          <button onClick={() => download('pdf')} className="btn-secondary">
            PDF
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={columns}
          rows={rows.map((row, index) => ({ id: row._id || index, ...row }))}
          keyField="id"
        />
      )}
    </div>
  );
}
