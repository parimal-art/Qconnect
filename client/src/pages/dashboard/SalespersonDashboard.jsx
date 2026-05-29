import { useEffect, useState } from 'react';
import { Briefcase, CheckCircle2, Clock, Gift } from 'lucide-react';
import api from '../../lib/api';
import DashboardCard from '../../components/DashboardCard';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';

const h = ms => `${Math.round(((ms || 0) / 3600000) * 10) / 10}h`;

export default function SalespersonDashboard() {
  const [leads, setLeads] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/leads?limit=100'), api.get('/attendance/report')])
      .then(([leadResponse, attendanceResponse]) => {
        setLeads(leadResponse.data.leads || []);
        setAttendance(attendanceResponse.data.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState rows={6} />;

  const completed = leads.filter(lead => lead.isCompleted).length;
  const self = leads.filter(lead => lead.isSelfGenerated).length;
  const reward = leads.filter(lead => lead.rewardEligible).length;
  const today = attendance[0] || {};

  const columns = [
    {
      key: 'name',
      header: 'Lead',
      render: r => (
        <div>
          <p className="font-semibold">{r.name}</p>
          <p className="text-xs text-slate-500">{r.companyName}</p>
        </div>
      )
    },
    {
      key: 'leadType',
      header: 'Type',
      render: r => <StatusBadge value={r.leadType} />
    },
    {
      key: 'pipelineStatus',
      header: 'Pipeline',
      render: r => <StatusBadge value={r.pipelineStatus} />
    },
    { key: 'callStatus', header: 'Call' },
    {
      key: 'followUpDate',
      header: 'Follow-up',
      render: r => (r.followUpDate ? new Date(r.followUpDate).toLocaleString() : '—')
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Salesperson dashboard</h1>
        <p className="text-slate-500">Own attendance, activity, leads and follow-ups.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Assigned Leads" value={leads.length} icon={Briefcase} />
        <DashboardCard title="Completed" value={completed} icon={CheckCircle2} />
        <DashboardCard title="Self Generated" value={self} icon={Gift} />
        <DashboardCard title="Reward Eligible" value={reward} icon={Gift} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Active in shift" value={h(today.activeTimeInsideShift)} icon={Clock} />
        <DashboardCard title="Idle" value={h(today.idleTimeInsideShift)} icon={Clock} />
        <DashboardCard title="Offline" value={h(today.offlineTimeInsideShift)} icon={Clock} />
        <DashboardCard title="Break" value={h(today.breakTimeInsideShift)} icon={Clock} />
      </div>

      <section>
        <h2 className="mb-4 text-xl font-bold">My leads</h2>
        <DataTable columns={columns} rows={leads} keyField="_id" />
      </section>
    </div>
  );
}
