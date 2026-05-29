import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  Clock,
  Home,
  LogOut,
  Menu,
  Users,
  Bell,
  UserCircle
} from 'lucide-react';
import { logout } from '../store/authSlice';
import { ROLES, roleLabel } from '../lib/roles';
import NotificationBell from './NotificationBell';
import { useActivityTracker } from '../hooks/useActivityTracker';

const navByRole = {
  [ROLES.ADMIN]: [
    ['Dashboard', '/admin', Home],
    ['Tracker', '/tracker', Clock],
    ['Employees', '/employees', Users],
    ['Leads', '/leads', Briefcase],
    ['Attendance', '/attendance', CalendarCheck],
    ['Reports', '/reports', BarChart3],
    ['Notifications', '/notifications', Bell]
  ],
  [ROLES.HR]: [
    ['Dashboard', '/hr', Home],
    ['Tracker', '/tracker', Clock],
    ['Create Employee', '/employees/new', Users],
    ['Leads', '/leads', Briefcase],
    ['Attendance', '/attendance', CalendarCheck],
    ['Reports', '/reports', BarChart3],
    ['Notifications', '/notifications', Bell]
  ],
  [ROLES.TEAM_LEADER]: [
    ['Dashboard', '/team-leader', Home],
    ['Tracker', '/tracker', Clock],
    ['My Salespersons', '/employees', Users],
    ['Leads', '/leads', Briefcase],
    ['Reports', '/reports', BarChart3],
    ['Notifications', '/notifications', Bell]
  ],
  [ROLES.SALESPERSON]: [
    ['Dashboard', '/salesperson', Home],
    ['My Leads', '/leads', Briefcase],
    ['Break/Leave', '/break-leave', CalendarCheck],
    ['Profile', '/profile', UserCircle],
    ['Notifications', '/notifications', Bell]
  ]
};

export default function Layout() {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useActivityTracker(Boolean(user));

  const nav = navByRole[user?.role] || [];

  const onLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-72 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 font-bold text-white">
            CRM
          </div>
          <div>
            <p className="font-bold">Employee Tracker</p>
            <p className="text-xs text-slate-500">PWA CRM Dashboard</p>
          </div>
        </div>

        <nav className="space-y-1">
          {nav.map(([label, to, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:px-8">
          <div className="flex items-center gap-3">
            <Menu className="lg:hidden" size={22} />
            <div>
              <p className="font-semibold">{roleLabel[user?.role] || 'Dashboard'}</p>
              <p className="text-xs text-slate-500">
                {user?.name || user?.email} · {user?.employeeId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <button onClick={onLogout} className="btn-secondary flex items-center gap-2">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        {nav.slice(0, 5).map(([label, to, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] ${
                isActive ? 'text-blue-600' : 'text-slate-500'
              }`
            }
          >
            <Icon size={18} />
            {label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}