import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import api from '../lib/api';
import { connectSocket } from '../lib/socket';
import { addNotification, markAllRead, setNotifications } from '../store/notificationSlice';

const notificationLink = notification => {
  if (notification?.metadata?.userId) return `/employees/${notification.metadata.userId}`;
  if (notification?.metadata?.leadId) return '/leads';
  if (notification?.metadata?.targetId) return '/targets';
  if (notification?.metadata?.quotationId) return '/quotations';
  return '/notifications';
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const { items, unread } = useSelector(s => s.notifications);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => dispatch(setNotifications(data.notifications))).catch(() => {});
    const socket = connectSocket();
    socket?.on('new_notification', n => dispatch(addNotification(n)));
    return () => socket?.off('new_notification');
  }, [dispatch]);

  const readAll = async () => {
    await api.put('/notifications/read-all');
    dispatch(markAllRead());
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-xs text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Notifications</p>
            <button onClick={readAll} className="text-xs text-blue-600">Mark all read</button>
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {items.slice(0, 10).map(n => (
              <Link to={notificationLink(n)} onClick={() => setOpen(false)} key={n._id} className={`block rounded-xl p-3 text-sm ${n.isRead ? 'bg-slate-50 dark:bg-slate-800' : 'bg-blue-50 dark:bg-blue-950/40'}`}>
                <p className="font-semibold">{n.title}</p>
                <p className="text-slate-500">{n.message}</p>
                <p className="mt-1 text-xs font-semibold text-blue-600">Open details</p>
              </Link>
            ))}
            {!items.length && <p className="text-sm text-slate-500">No notifications yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
