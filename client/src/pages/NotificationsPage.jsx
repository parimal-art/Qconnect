import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { markAllRead, setNotifications } from '../store/notificationSlice';

const notificationLink = notification => {
  if (notification?.metadata?.userId) return `/employees/${notification.metadata.userId}`;
  if (notification?.metadata?.leadId) return '/leads';
  if (notification?.metadata?.targetId) return '/targets';
  if (notification?.metadata?.quotationId) return '/quotations';
  return '/notifications';
};

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const { items } = useSelector(s => s.notifications);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => dispatch(setNotifications(data.notifications || [])));
  }, [dispatch]);

  const readAll = async () => {
    await api.put('/notifications/read-all');
    dispatch(markAllRead());
  };

  const columns = [
    {
      key: 'title',
      header: 'Notification',
      render: row => (
        <div>
          <p className="font-semibold">{row.title}</p>
          <p className="text-xs text-slate-500">{row.message}</p>
          <Link to={notificationLink(row)} className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline">Open related page</Link>
        </div>
      )
    },
    { key: 'type', header: 'Type' },
    { key: 'isRead', header: 'Read', render: row => <StatusBadge value={row.isRead ? 'Approved' : 'Pending'} /> },
    { key: 'createdAt', header: 'Time', render: row => new Date(row.createdAt).toLocaleString() }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-slate-500">Profile review, target, lead and quotation alerts.</p>
        </div>
        <button onClick={readAll} className="btn-secondary">Mark all read</button>
      </div>
      <DataTable columns={columns} rows={items} keyField="_id" />
    </div>
  );
}
