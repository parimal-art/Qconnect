import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { markAllRead, setNotifications } from '../store/notificationSlice';

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const { items } = useSelector(s => s.notifications);
  useEffect(() => { api.get('/notifications').then(({ data }) => dispatch(setNotifications(data.notifications || []))); }, [dispatch]);
  const readAll = async () => { await api.put('/notifications/read-all'); dispatch(markAllRead()); };
  const columns = [
    { key: 'title', header: 'Title', render: r => <div><p className="font-semibold">{r.title}</p><p className="text-xs text-slate-500">{r.message}</p></div> },
    { key: 'type', header: 'Type' },
    { key: 'isRead', header: 'Read', render: r => <StatusBadge value={r.isRead ? 'Approved' : 'Pending'} /> },
    { key: 'createdAt', header: 'Time', render: r => new Date(r.createdAt).toLocaleString() }
  ];
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-slate-500">Real-time notification history.</p></div><button onClick={readAll} className="btn-secondary">Mark all read</button></div><DataTable columns={columns} rows={items} keyField="_id" /></div>;
}
