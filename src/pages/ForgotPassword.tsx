import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { Emblem } from '@/components/Logo';
import { Spinner } from '@/components/ui';
import { isConfigured, supabase } from '@/lib/supabase';

/** Accounts use internal emails, so resets are handled by admins. This files a request they can act on. */
export function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const u = username.trim().toLowerCase();
    if (!isConfigured) { setBusy(false); setError('قاعدة البيانات غير مهيّأة.'); return; }
    const { error: err } = await supabase.from('password_reset_requests').insert({ username: u, note: note.trim() || null });
    setBusy(false);
    if (err) { setError('تعذّر إرسال الطلب. تأكد من اسم المستخدم وحاول مجدداً.'); return; }
    setDone(true);
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold-300">
          <ArrowRight className="h-3.5 w-3.5" aria-hidden /> العودة لتسجيل الدخول
        </Link>
        <div className="card p-7 sm:p-9">
          <div className="mb-6 flex flex-col items-center text-center">
            <Emblem size={52} />
            <h1 className="mt-3 text-xl font-bold text-white">استعادة كلمة المرور</h1>
          </div>
          {done ? (
            <div className="text-center" role="status">
              <CheckCircle2 className="mx-auto h-10 w-10 text-olive-400" aria-hidden />
              <p className="mt-3 font-semibold text-white">تم إرسال الطلب</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">ستقوم الإدارة المخوّلة بإعادة تعيين كلمة المرور وتسليمها لك.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm leading-7 text-slate-400">أدخل اسم المستخدم وسيصل طلبك إلى الإدارة لإعادة تعيين كلمة المرور.</p>
              <div>
                <label htmlFor="u" className="label">اسم المستخدم</label>
                <input id="u" className="input ltr text-start" required minLength={3} maxLength={32} autoCapitalize="none" spellCheck={false}
                  value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label htmlFor="n" className="label">ملاحظة (اختياري)</label>
                <textarea id="n" className="input min-h-20" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
              <button className="btn btn-gold w-full !py-3" disabled={busy || username.trim().length < 3}>
                {busy ? <Spinner className="h-4 w-4 !text-navy-900" /> : <Send className="h-4 w-4" aria-hidden />} إرسال الطلب
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
