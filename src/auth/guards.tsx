import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Spinner } from '@/components/ui';

export function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
        <Spinner className="h-7 w-7" /> جارٍ التحقق من الهوية…
      </div>
    </div>
  );
}

/** All /app/* routes. Real protection is RLS; this only keeps anonymous visitors out of the shell. */
export function RequireAuth() {
  const { loading, session, profile } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!session || !profile) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

export function RequirePerm({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (can(perm)) return <>{children}</>;
  return (
    <div className="card mx-auto mt-16 max-w-md p-8 text-center">
      <ShieldAlert className="mx-auto h-8 w-8 text-gold-400" aria-hidden />
      <h2 className="mt-3 text-lg font-bold text-white">لا تملك صلاحية الوصول</h2>
      <p className="mt-2 text-sm text-slate-400">هذه الصفحة مخصصة لأصحاب صلاحيات محددة. تواصل مع الإدارة إن كنت تحتاج الوصول.</p>
    </div>
  );
}
