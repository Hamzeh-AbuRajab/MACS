import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Splash } from '@/auth/guards';
import { Emblem } from '@/components/Logo';
import { Spinner } from '@/components/ui';
import { isConfigured } from '@/lib/supabase';

export function Login() {
  const { loading, session, profile, signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/app';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Splash />;
  if (session && profile) return <Navigate to="/app" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const err = await signIn(username, password, remember);
    setBusy(false);
    if (err) { setError(err); return; }
    nav(from.startsWith('/app') ? from : '/app', { replace: true });
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold-300">
          <ArrowRight className="h-3.5 w-3.5" aria-hidden /> العودة للصفحة الرئيسية
        </Link>
        <div className="card p-7 shadow-gold sm:p-9">
          <div className="mb-7 flex flex-col items-center text-center">
            <Emblem size={64} />
            <h1 className="ltr mt-4 text-2xl font-extrabold tracking-[.2em] text-white">MACS</h1>
            <p className="mt-1 text-sm text-slate-400">تسجيل الدخول العسكري</p>
          </div>

          {!isConfigured && (
            <p role="alert" className="mb-4 rounded-md bg-gold-500/10 p-3 text-xs leading-6 text-gold-300">
              <AlertTriangle className="me-1 inline h-3.5 w-3.5" aria-hidden />
              قاعدة البيانات غير مهيّأة. أنشئ ملف <span className="ltr font-mono">.env</span> أولاً.
            </p>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="label">اسم المستخدم</label>
              <input id="username" className="input ltr text-start" autoComplete="username" autoCapitalize="none" spellCheck={false}
                value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus placeholder="username" />
            </div>
            <div>
              <label htmlFor="password" className="label">كلمة المرور</label>
              <div className="relative">
                <input id="password" type={show ? 'text' : 'password'} className="input ltr pe-11 text-start" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:text-slate-200">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <label className="flex cursor-pointer items-center gap-2 text-slate-400">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#B69A52]" />
                تذكرني
              </label>
              <Link to="/forgot-password" className="text-gold-400 hover:underline">نسيت كلمة المرور؟</Link>
            </div>
            {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
            <button type="submit" disabled={busy || !username.trim() || !password} className="btn btn-gold w-full !py-3">
              {busy ? <Spinner className="h-4 w-4 !text-navy-900" /> : <LogIn className="h-4 w-4" aria-hidden />} دخول
            </button>
          </form>
          <p className="mt-6 border-t border-white/[.06] pt-4 text-center text-[11px] leading-6 text-slate-500">
            الحسابات تُنشأ من الإدارة المخوّلة فقط. لا يوجد تسجيل ذاتي.
          </p>
        </div>
      </div>
    </div>
  );
}
