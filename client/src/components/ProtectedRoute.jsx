import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { roleHome } from '../lib/roles';
import { getToken } from '../lib/authStorage';

export function ProtectedRoute() {
  const { isAuthenticated, user, loading } = useSelector(state => state.auth);
  const location = useLocation();

  if (loading && getToken()) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">
        Loading session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.firstLogin && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (
    !user?.firstLogin &&
    user?.profileCompletionPercentage < 100 &&
    location.pathname !== '/complete-profile'
  ) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <Outlet />;
}

export function RoleRoute({ roles }) {
  const { user } = useSelector(state => state.auth);

  if (!roles.includes(user?.role)) {
    return <Navigate to={roleHome[user?.role] || '/login'} replace />;
  }

  return <Outlet />;
}