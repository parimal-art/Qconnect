import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { loadMe } from './store/authSlice';
import {
  clearPendingAppClose,
  clearToken,
  getToken,
  shouldLogoutBecauseAppWasClosed
} from './lib/authStorage';

import { ROLES, roleHome } from './lib/roles';

import Layout from './components/Layout';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/auth/ChangePassword';
import CompleteProfile from './pages/auth/CompleteProfile';

import AdminDashboard from './pages/dashboard/AdminDashboard';
import HRDashboard from './pages/dashboard/HRDashboard';
import TeamLeaderDashboard from './pages/dashboard/TeamLeaderDashboard';
import SalespersonDashboard from './pages/dashboard/SalespersonDashboard';

import TrackerPage from './pages/TrackerPage';
import EmployeesPage from './pages/EmployeesPage';
import CreateEmployeePage from './pages/CreateEmployeePage';
import LeadsPage from './pages/LeadsPage';
import AttendancePage from './pages/AttendancePage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import BreakLeavePage from './pages/BreakLeavePage';
import ProfilePage from './pages/ProfilePage';

function HomeRedirect() {
  const { user } = useSelector(state => state.auth);

  return <Navigate to={roleHome[user?.role] || '/login'} replace />;
}

export default function App() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(state => state.auth);

  useEffect(() => {
    const wasAppClosed = shouldLogoutBecauseAppWasClosed();

    if (wasAppClosed) {
      clearToken();
      clearPendingAppClose();
      return;
    }

    clearPendingAppClose();

    if (getToken()) {
      dispatch(loadMe());
    }
  }, [dispatch]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <HomeRedirect /> : <Login />}
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<HomeRedirect />} />

            <Route element={<RoleRoute roles={[ROLES.ADMIN]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            <Route element={<RoleRoute roles={[ROLES.HR]} />}>
              <Route path="/hr" element={<HRDashboard />} />
            </Route>

            <Route element={<RoleRoute roles={[ROLES.TEAM_LEADER]} />}>
              <Route path="/team-leader" element={<TeamLeaderDashboard />} />
            </Route>

            <Route element={<RoleRoute roles={[ROLES.SALESPERSON]} />}>
              <Route path="/salesperson" element={<SalespersonDashboard />} />
            </Route>

            <Route path="/tracker" element={<TrackerPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/new" element={<CreateEmployeePage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/break-leave" element={<BreakLeavePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}