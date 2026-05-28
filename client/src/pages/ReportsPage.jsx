import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';

export default function ReportsPage() {
  const [type, setType] = useState('team-performance');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    const endpoint = type === 'leads' ? '/reports/leads' : type === 'attendance' ? '/reports/attendance' : '/reports/team-performance';
    const { data } = await api.get(endpoint);
    setRows(data.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [type]);
  const download = format => {
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/export/${format}?type=${type}&format=${format}`;
    const token = localStorage.getItem('crm_access_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }).then(async res => {
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}.${format === 'excel' ? 'xlsx' : format}`;
      a.click();
    });
  };
  const columns = Object.keys(rows[0] || { employee: '', total: '', completed: '', performancePercentage: '' }).slice(0, 8).map(key => ({ key, header: key, render: row => typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '') }));
  return <div className="space-y-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold">Reports & exports</h1><p className="text-slate-500">Role-permission based CSV, Excel and PDF reports.</p></div><div className="flex flex-wrap gap-2"><select value={type} onChange={e => setType(e.target.value)} className="input w-56"><option value="team-performance">Team performance</option><option value="leads">Lead report</option><option value="attendance">Attendance report</option></select><button onClick={() => download('csv')} className="btn-secondary">CSV</button><button onClick={() => download('excel')} className="btn-secondary">Excel</button><button onClick={() => download('pdf')} className="btn-secondary">PDF</button></div></div>{loading ? <LoadingState /> : <DataTable columns={columns} rows={rows.map((r, i) => ({ id: i, ...r }))} keyField="id" />}</div>;
}
