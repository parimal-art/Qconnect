import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { login } from '../../store/authSlice';
import { roleHome } from '../../lib/roles';

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

export default function Login() {
  const { loading, error } = useSelector(s => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { email: 'admin@example.com', password: 'Admin@123' } });

  const onSubmit = async values => {
    const result = await dispatch(login(values));
    if (result.payload?.user) {
      const user = result.payload.user;
      const next = user.firstLogin ? '/change-password' : user.profileCompletionPercentage < 100 ? '/complete-profile' : (location.state?.from?.pathname || roleHome[user.role]);
      navigate(next, { replace: true });
    }
  };

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-100 lg:grid-cols-2">
      <div className="hidden items-center justify-center p-12 lg:flex">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">Production-ready CRM PWA</div>
          <h1 className="text-5xl font-black tracking-tight text-slate-950">Track teams, leads, activity and attendance in real time.</h1>
          <p className="mt-5 text-lg text-slate-600">Hierarchy-based dashboards for Admin, HR, Team Leader and Salesperson with working-hour activity calculation.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
          <h2 className="text-2xl font-bold">Login</h2>
          <p className="mt-1 text-sm text-slate-500">Use your employee account credentials.</p>
          {location.state?.notice && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{location.state.notice}</div>}
          {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium">Email<input className="input mt-1" {...register('email')} /></label>
            {errors.email && <p className="text-xs text-rose-600">{errors.email.message}</p>}
            <label className="block text-sm font-medium">Password<input type="password" className="input mt-1" {...register('password')} /></label>
            {errors.password && <p className="text-xs text-rose-600">{errors.password.message}</p>}
          </div>
          <button disabled={loading} className="btn-primary mt-6 w-full">{loading ? 'Signing in...' : 'Sign in'}</button>
          <Link to="/forgot-password" className="mt-4 block text-center text-sm text-blue-600">Forgot password?</Link>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
            <p><b>Admin:</b> admin@example.com / Admin@123</p>
            <p><b>HR:</b> hr@example.com / Hr@123</p>
            <p><b>TL:</b> tl@example.com / Tl@123</p>
            <p><b>Sales:</b> salesperson@example.com / Sales@123</p>
          </div>
        </form>
      </div>
    </div>
  );
}



