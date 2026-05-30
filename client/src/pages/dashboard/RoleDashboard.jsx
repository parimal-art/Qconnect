import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Activity,
  Briefcase,
  CheckCircle2,
  Clock,
  Users
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';

import api from '../../lib/api';
import DashboardCard from '../../components/DashboardCard';
import ChildEmployeeTracker from '../../components/ChildEmployeeTracker';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ROLES, roleLabel } from '../../lib/roles';

const msToHours = ms => Math.round(((ms || 0) / 3600000) * 10) / 10;

const roleTitle = {
  employees: 'All Employees',
  HR: 'HR Employees',
  TEAM_LEADER: 'Team Leaders',
  SALESPERSON: 'Salespersons',
  leads: 'All Leads'
};

const leadTypes = ['all', 'Hot Lead', 'Mid Lead', 'Cold Lead'];

const pipelineStatuses = [
  'all',
  'New Lead',
  'Contacted',
  'Interested',
  'Follow-up',
  'Demo Scheduled',
  'Negotiation',
  'Won',
  'Lost'
];

export default function RoleDashboard({ title, subtitle, showTracker = true }) {
  const { user } = useSelector(state => state.auth);
  const canGenerateEmployee = [ROLES.ADMIN, ROLES.HR].includes(user?.role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activePanel, setActivePanel] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('all');

  useEffect(() => {
    api
      .get('/reports/dashboard')
      .then(res => setData(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  const roleCounts = useMemo(
    () => Object.fromEntries((data?.roleCounts || []).map(r => [r._id, r.count])),
    [data]
  );

  const stateData = (data?.statusCounts || []).map(item => ({
    name: item._id || 'Unknown',
    value: item.count
  }));

  const attendance = data?.attendanceTotals || {};

  const leadTotals = (data?.leadCounts || []).reduce(
    (acc, item) => {
      acc.total += item.count;
      if (item._id?.isCompleted) acc.completed += item.count;
      if (item._id?.pipelineStatus === 'Won') acc.won += item.count;
      if (item._id?.pipelineStatus === 'Lost') acc.lost += item.count;
      return acc;
    },
    { total: 0, completed: 0, won: 0, lost: 0 }
  );

  const openPanel = async panel => {
    setActivePanel(panel);
    setDetailsLoading(true);

    try {
      if (panel === 'leads') {
        const { data: response } = await api.get('/leads?limit=100');
        setDetailRows(response.leads || []);
      } else {
        const params = new URLSearchParams({ status: 'all' });

        if (panel !== 'employees') {
          params.set('role', panel);
        }

        const { data: response } = await api.get(`/users?${params.toString()}`);
        setDetailRows(response.users || []);
      }
    } finally {
      setDetailsLoading(false);
    }
  };

  const visibleDetailRows = useMemo(() => {
    if (activePanel !== 'leads') return detailRows;

    return detailRows.filter(lead => {
      const typeOk = leadTypeFilter === 'all' || lead.leadType === leadTypeFilter;
      const pipelineOk =
        pipelineFilter === 'all' || lead.pipelineStatus === pipelineFilter;

      return typeOk && pipelineOk;
    });
  }, [activePanel, detailRows, leadTypeFilter, pipelineFilter]);

  const employeeColumns = [
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
        employee.assignedTeamLeader?.name || employee.assignedHR?.name || 'Admin'
    },
    {
      key: 'active',
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
      key: 'profile',
      header: 'Profile',
      render: employee => `${employee.profileCompletionPercentage || 0}%`
    }
  ];

  const leadColumns = [
    {
      key: 'name',
      header: 'Lead',
      render: lead => (
        <div>
          <p className="font-semibold">{lead.name}</p>
          <p className="text-xs text-slate-500">{lead.companyName || 'No company'}</p>
        </div>
      )
    },
    {
      key: 'contact',
      header: 'Contact',
      render: lead => (
        <div>
          <p>{lead.contactNumber || '—'}</p>
          <p className="text-xs text-slate-500">{lead.email || '—'}</p>
        </div>
      )
    },
    {
      key: 'leadType',
      header: 'Lead Type',
      render: lead => <StatusBadge value={lead.leadType || 'Cold Lead'} />
    },
    {
      key: 'pipelineStatus',
      header: 'Pipeline',
      render: lead => <StatusBadge value={lead.pipelineStatus || 'New Lead'} />
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: lead =>
        lead.assignedTo?._id ? (
          <Link
            to={`/employees/${lead.assignedTo._id}`}
            className="font-semibold text-blue-600 hover:underline"
          >
            {lead.assignedTo.name || lead.assignedTo.email}
          </Link>
        ) : (
          'Unassigned'
        )
    },
    {
      key: 'completed',
      header: 'Completed',
      render: lead => <StatusBadge value={lead.isCompleted ? 'Approved' : 'Pending'} />
    }
  ];

  if (loading) return <LoadingState rows={6} />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-slate-500">{subtitle}</p>
        </div>

        {canGenerateEmployee && (
          <Link to="/employees/new" className="btn-primary w-fit">
            Generate Employee
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard
          title="Total Employees"
          value={
            (roleCounts.HR || 0) +
            (roleCounts.TEAM_LEADER || 0) +
            (roleCounts.SALESPERSON || 0)
          }
          icon={Users}
          active={activePanel === 'employees'}
          onClick={() => openPanel('employees')}
        />

        <DashboardCard
          title="HR"
          value={roleCounts.HR || 0}
          icon={Users}
          active={activePanel === 'HR'}
          onClick={() => openPanel('HR')}
        />

        <DashboardCard
          title="Team Leaders"
          value={roleCounts.TEAM_LEADER || 0}
          icon={Users}
          active={activePanel === 'TEAM_LEADER'}
          onClick={() => openPanel('TEAM_LEADER')}
        />

        <DashboardCard
          title="Salespersons"
          value={roleCounts.SALESPERSON || 0}
          icon={Users}
          active={activePanel === 'SALESPERSON'}
          onClick={() => openPanel('SALESPERSON')}
        />

        <DashboardCard
          title="Total Leads"
          value={leadTotals.total}
          icon={Briefcase}
          active={activePanel === 'leads'}
          onClick={() => openPanel('leads')}
        />
      </div>

      {activePanel && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">{roleTitle[activePanel]}</h2>
              <p className="text-sm text-slate-500">
                Tap any employee name to open the full profile.
              </p>
            </div>

            {activePanel === 'leads' && (
              <div className="flex flex-wrap gap-2">
                <select
                  className="input w-44"
                  value={leadTypeFilter}
                  onChange={event => setLeadTypeFilter(event.target.value)}
                >
                  {leadTypes.map(type => (
                    <option key={type} value={type}>
                      {type === 'all' ? 'All lead types' : type}
                    </option>
                  ))}
                </select>

                <select
                  className="input w-44"
                  value={pipelineFilter}
                  onChange={event => setPipelineFilter(event.target.value)}
                >
                  {pipelineStatuses.map(status => (
                    <option key={status} value={status}>
                      {status === 'all' ? 'All pipeline' : status}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {detailsLoading ? (
            <LoadingState rows={4} />
          ) : (
            <DataTable
              columns={activePanel === 'leads' ? leadColumns : employeeColumns}
              rows={visibleDetailRows}
              keyField="_id"
            />
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Working-hour Active"
          value={`${msToHours(attendance.totalActive)}h`}
          icon={Activity}
          footer="CRM PWA activity inside assigned shift"
        />
        <DashboardCard
          title="Idle Time"
          value={`${msToHours(attendance.totalIdle)}h`}
          icon={Clock}
        />
        <DashboardCard
          title="Break Time"
          value={`${msToHours(attendance.totalBreak)}h`}
          icon={Clock}
        />
        <DashboardCard
          title="Best Salesperson"
          value={data?.bestSalesperson?.name || '—'}
          icon={CheckCircle2}
          footer={
            data?.bestSalesperson
              ? `${data.bestSalesperson.completed} completed leads`
              : 'No completed lead yet'
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card h-80">
          <h2 className="mb-4 font-semibold">Employee activity state</h2>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie data={stateData} dataKey="value" nameKey="name" outerRadius={95} label>
                {stateData.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card h-80">
          <h2 className="mb-4 font-semibold">Lead status</h2>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart
              data={[
                {
                  name: 'Leads',
                  total: leadTotals.total,
                  completed: leadTotals.completed,
                  won: leadTotals.won,
                  lost: leadTotals.lost
                }
              ]}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" />
              <Bar dataKey="completed" />
              <Bar dataKey="won" />
              <Bar dataKey="lost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {showTracker && <ChildEmployeeTracker />}
    </div>
  );
}
