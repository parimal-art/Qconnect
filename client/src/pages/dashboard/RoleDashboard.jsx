import { useEffect, useMemo, useState } from 'react';
import { Activity, Briefcase, CheckCircle2, Clock, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import api from '../../lib/api';
import DashboardCard from '../../components/DashboardCard';
import ChildEmployeeTracker from '../../components/ChildEmployeeTracker';
import { LoadingState } from '../../components/LoadingState';

const msToHours = ms => Math.round((ms || 0) / 3600000 * 10) / 10;

export default function RoleDashboard({ title, subtitle, showTracker = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard').then(res => setData(res.data.data)).finally(() => setLoading(false));
  }, []);

  const roleCounts = useMemo(() => Object.fromEntries((data?.roleCounts || []).map(r => [r._id, r.count])), [data]);
  const stateData = (data?.statusCounts || []).map(item => ({ name: item._id || 'Unknown', value: item.count }));
  const attendance = data?.attendanceTotals || {};
  const leadTotals = (data?.leadCounts || []).reduce((acc, item) => {
    acc.total += item.count;
    if (item._id?.isCompleted) acc.completed += item.count;
    if (item._id?.pipelineStatus === 'Won') acc.won += item.count;
    if (item._id?.pipelineStatus === 'Lost') acc.lost += item.count;
    return acc;
  }, { total: 0, completed: 0, won: 0, lost: 0 });

  if (loading) return <LoadingState rows={6} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-slate-500">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard title="Total Employees" value={(roleCounts.HR || 0) + (roleCounts.TEAM_LEADER || 0) + (roleCounts.SALESPERSON || 0)} icon={Users} />
        <DashboardCard title="HR" value={roleCounts.HR || 0} icon={Users} />
        <DashboardCard title="Team Leaders" value={roleCounts.TEAM_LEADER || 0} icon={Users} />
        <DashboardCard title="Salespersons" value={roleCounts.SALESPERSON || 0} icon={Users} />
        <DashboardCard title="Total Leads" value={leadTotals.total} icon={Briefcase} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Working-hour Active" value={`${msToHours(attendance.totalActive)}h`} icon={Activity} footer="CRM PWA activity inside assigned shift" />
        <DashboardCard title="Idle Time" value={`${msToHours(attendance.totalIdle)}h`} icon={Clock} />
        <DashboardCard title="Break Time" value={`${msToHours(attendance.totalBreak)}h`} icon={Clock} />
        <DashboardCard title="Best Salesperson" value={data?.bestSalesperson?.name || '—'} icon={CheckCircle2} footer={data?.bestSalesperson ? `${data.bestSalesperson.completed} completed leads` : 'No completed lead yet'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card h-80"><h2 className="mb-4 font-semibold">Employee activity state</h2><ResponsiveContainer width="100%" height="85%"><PieChart><Pie data={stateData} dataKey="value" nameKey="name" outerRadius={95} label>{stateData.map((_, i) => <Cell key={i} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
        <div className="card h-80"><h2 className="mb-4 font-semibold">Lead status</h2><ResponsiveContainer width="100%" height="85%"><BarChart data={[{ name: 'Leads', total: leadTotals.total, completed: leadTotals.completed, won: leadTotals.won, lost: leadTotals.lost }]}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="total" /><Bar dataKey="completed" /><Bar dataKey="won" /><Bar dataKey="lost" /></BarChart></ResponsiveContainer></div>
      </div>
      {showTracker && <ChildEmployeeTracker />}
    </div>
  );
}
