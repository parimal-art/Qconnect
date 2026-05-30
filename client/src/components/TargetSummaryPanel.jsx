import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Target, TrendingUp, WalletCards } from 'lucide-react';

import api from '../lib/api';
import DashboardCard from './DashboardCard';
import { LoadingState } from './LoadingState';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const TARGET_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444'];

export default function TargetSummaryPanel({ userId, title = 'Sales target summary', compact = false }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const endpoint = userId ? `/targets/user/${userId}/summary` : '/targets/my-summary';

    setLoading(true);
    setError('');

    api
      .get(endpoint)
      .then(({ data }) => {
        if (!cancelled) setSummary(data.data);
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load target summary.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const chartData = useMemo(
    () => [
      {
        name: 'Target',
        assigned: summary?.assignedTarget || 0,
        distributed: summary?.distributedTarget || 0,
        completed: summary?.completedTarget || 0
      }
    ],
    [summary]
  );

  const pieData = useMemo(() => {
    const assignedTarget = Number(summary?.assignedTarget || 0);
    const distributedTarget = Number(summary?.distributedTarget || 0);
    const completedTarget = Number(summary?.completedTarget || 0);
    const remainingTarget = Math.max(0, assignedTarget - completedTarget);

    return [
      { name: 'Assigned Target', value: assignedTarget },
      { name: 'Distributed Target', value: distributedTarget },
      { name: 'Completed Target', value: completedTarget },
      { name: 'Remaining Target', value: remainingTarget }
    ].filter(item => item.value > 0);
  }, [summary]);

  if (loading) return <LoadingState rows={2} />;
  if (error) return <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (!summary) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-slate-500">
          {new Date(summary.periodStart).toLocaleDateString()} - {new Date(summary.periodEnd).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Assigned Target" value={money(summary.assignedTarget)} icon={Target} color="blue" />
        <DashboardCard title="Distributed Target" value={money(summary.distributedTarget)} icon={WalletCards} color="amber" />
        <DashboardCard title="Completed Sales" value={money(summary.completedTarget)} icon={TrendingUp} color="emerald" />
        <DashboardCard title="Coverage" value={`${summary.completionPercentage || 0}%`} icon={TrendingUp} color="violet" footer={`Remaining ${money(summary.remainingTarget)}`} />
      </div>

      {!compact && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card h-80">
            <h3 className="mb-4 font-semibold">Target distribution pie chart</h3>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={92} paddingAngle={3}>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={TARGET_COLORS[index % TARGET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={value => money(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-56 place-items-center text-sm text-slate-500">No target amount assigned yet.</div>
            )}
          </div>

          <div className="card h-80">
            <h3 className="mb-4 font-semibold">Target vs distributed vs completed</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={value => money(value)} />
                <Bar dataKey="assigned" fill={TARGET_COLORS[0]} />
                <Bar dataKey="distributed" fill={TARGET_COLORS[1]} />
                <Bar dataKey="completed" fill={TARGET_COLORS[2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
