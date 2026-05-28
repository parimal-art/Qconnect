import { useSelector } from 'react-redux';
import StatusBadge from '../components/StatusBadge';

export default function ProfilePage() {
  const { user } = useSelector(s => s.auth);
  return <div className="mx-auto max-w-2xl"><div className="card"><h1 className="text-2xl font-bold">My profile</h1><div className="mt-6 space-y-3 text-sm"><p><b>Name:</b> {user?.name || 'Pending'}</p><p><b>Email:</b> {user?.email}</p><p><b>Role:</b> {user?.role}</p><p><b>Employee ID:</b> {user?.employeeId}</p><p><b>Shift:</b> {user?.shiftStart} - {user?.shiftEnd}</p><p><b>Profile completion:</b> {user?.profileCompletionPercentage}%</p><p><b>Verification:</b> <StatusBadge value={user?.isVerified ? 'Approved' : 'Pending'} /></p></div>{user?.pendingRequiredFields?.length > 0 && <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><b>Pending fields:</b> {user.pendingRequiredFields.join(', ')}</div>}</div></div>;
}
