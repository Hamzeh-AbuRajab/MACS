import { useState } from 'react';
import { Copy, KeyRound, Plus, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge } from '@/components/ui';
import { Chips, Modal, Table, must, useAction, useToast } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { callAdmin, opts, randomPassword } from '@/lib/refs';
import { SERVICE_STATUS, fmtDateTime } from '@/lib/format';
import { CreateAccountModal } from './CreateAccount';

interface Row {
  id: string; username: string; full_name: string; is_active: boolean;
  personnel: { military_number: string; service_status: keyof typeof SERVICE_STATUS; rank: { name_ar: string } | null; department: { name_ar: string } | null } | null;
  user_roles: { role_id: string; roles: { code: string; name_ar: string } | null }[];
}
interface Req { id: string; username: string; note: string | null; status: string; created_at: string }
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export function Accounts() {
  const { can, profile } = useAuth();
  const [creating, setCreating] = useState(false);
  const [rolesFor, setRolesFor] = useState<Row | null>(null);
  const [pwFor, setPwFor] = useState<{ user_id: string; username: string; request_id?: string } | null>(null);
  const { busy, run } = useAction();

  const rows = useAsync(async () => (unwrap(await supabase.from('profiles')
    .select('id,username,full_name,is_active,personnel(military_number,service_status,rank:ranks(name_ar),department:departments(name_ar)),user_roles!user_roles_user_id_fkey(role_id,roles(code,name_ar))')
    .order('full_name')) as unknown as (Omit<Row, 'personnel'> & { personnel: Row['personnel'] | Row['personnel'][] })[])
    .map((r) => ({ ...r, personnel: one(r.personnel) })) as Row[], []);
  const reqs = useAsync(async () => unwrap(await supabase.from('password_reset_requests').select('*').eq('status', 'pending').order('created_at')) as Req[], []);

  const toggle = (r: Row) => run(async () => { await callAdmin({ action: 'set_active', user_id: r.id, active: !r.is_active }); rows.reload(); }, r.is_active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب');

  return (
    <div className="space-y-8">
      <div className="flex items-center">
        <p className="flex-1 text-sm text-slate-400">إنشاء الحسابات وتعطيلها وإعادة تعيين كلمات المرور ومنح الأدوار.</p>
        {can('users.create') && <button className="btn btn-gold" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> حساب جديد</button>}
      </div>

      <AsyncView state={reqs} emptyTitle="لا توجد طلبات استعادة كلمة مرور" rows={1}>
        {(list) => (
          <section className="card border-gold-500/30 p-4">
            <h3 className="mb-3 text-sm font-bold text-gold-300">طلبات استعادة كلمة المرور ({list.length})</h3>
            <ul className="divide-y divide-white/[.06]">
              {list.map((q) => {
                const target = rows.data?.find((r) => r.username === q.username);
                return (
                  <li key={q.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="ltr font-mono text-slate-100">@{q.username}</span>
                    <span className="flex-1 text-xs text-slate-400">{q.note} · {fmtDateTime(q.created_at)}</span>
                    {target && can('users.update') && <button className="btn btn-outline !py-1 text-xs" onClick={() => setPwFor({ user_id: target.id, username: q.username, request_id: q.id })}>تعيين كلمة مرور</button>}
                    {!target && <Badge tone="mute">اسم غير موجود</Badge>}
                    {can('users.update') && <button className="btn btn-ghost !py-1 text-xs" disabled={busy}
                      onClick={() => run(async () => { must(await supabase.from('password_reset_requests').update({ status: 'dismissed' }).eq('id', q.id)); reqs.reload(); }, 'تم تجاهل الطلب')}>تجاهل</button>}
                  </li>);
              })}
            </ul>
          </section>
        )}
      </AsyncView>

      <AsyncView state={rows} emptyTitle="لا توجد حسابات">
        {(list) => (
          <Table head={['الحساب', 'الرتبة / القسم', 'الأدوار', 'الحالة', '']}>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3"><p className="font-semibold text-white">{r.full_name}</p><p className="ltr text-start text-[11px] text-slate-500">@{r.username} · {r.personnel?.military_number}</p></td>
                <td className="px-4 py-3 text-slate-300">{r.personnel?.rank?.name_ar ?? '—'} <span className="text-slate-500">/ {r.personnel?.department?.name_ar ?? 'القيادة العليا'}</span></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{r.user_roles.map((u) => <Badge key={u.role_id} tone="warn">{u.roles?.name_ar}</Badge>)}</div></td>
                <td className="px-4 py-3"><Badge tone={r.is_active ? 'ok' : 'bad'}>{r.is_active ? 'مفعّل' : 'معطّل'}</Badge>
                  {r.personnel && <span className="ms-1 text-[11px] text-slate-500">{SERVICE_STATUS[r.personnel.service_status].label}</span>}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1">
                  {can('roles.update') && r.id !== profile!.id && <button className="btn btn-ghost !p-1.5" title="الأدوار" onClick={() => setRolesFor(r)}><ShieldCheck className="h-4 w-4" /></button>}
                  {can('users.update') && <button className="btn btn-ghost !p-1.5" title="كلمة المرور" onClick={() => setPwFor({ user_id: r.id, username: r.username })}><KeyRound className="h-4 w-4" /></button>}
                  {can('users.update') && r.id !== profile!.id && <button className="btn btn-ghost !p-1.5" title={r.is_active ? 'تعطيل' : 'تفعيل'} disabled={busy} onClick={() => toggle(r)}>
                    {r.is_active ? <UserX className="h-4 w-4 text-red-300" /> : <UserCheck className="h-4 w-4 text-olive-400" />}</button>}
                </div></td>
              </tr>
            ))}
          </Table>
        )}
      </AsyncView>

      {creating && <CreateAccountModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); rows.reload(); }} />}
      {rolesFor && <RolesModal row={rolesFor} onClose={() => setRolesFor(null)} onSaved={() => { setRolesFor(null); rows.reload(); }} />}
      {pwFor && <PasswordModal target={pwFor} onClose={() => setPwFor(null)} onDone={() => { setPwFor(null); reqs.reload(); }} />}
    </div>
  );
}

function RolesModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const roles = useAsync(async () => unwrap(await supabase.from('roles').select('id,code,name_ar')) as { id: string; code: string; name_ar: string }[], []);
  const [sel, setSel] = useState<string[]>(row.user_roles.map((u) => u.role_id));
  const { busy, run } = useAction();
  const save = async () => {
    const before = row.user_roles.map((u) => u.role_id);
    const add = sel.filter((x) => !before.includes(x));
    const del = before.filter((x) => !sel.includes(x));
    if (await run(async () => {
      if (add.length) must(await supabase.from('user_roles').insert(add.map((role_id) => ({ user_id: row.id, role_id }))));
      if (del.length) must(await supabase.from('user_roles').delete().eq('user_id', row.id).in('role_id', del));
    }, 'تم تحديث الأدوار')) onSaved();
  };
  return (
    <Modal title={`أدوار ${row.full_name}`} onClose={onClose}>
      <AsyncView state={roles} emptyTitle="لا توجد أدوار">{(list) => <Chips value={sel} onChange={setSel} options={opts(list, (r) => r.id, (r) => r.name_ar)} />}</AsyncView>
      <p className="mt-3 text-xs text-slate-500">الدور هو مصدر الصلاحيات الوحيد. تغيير الرتبة لا يغيّر الصلاحيات.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        <button className="btn btn-gold" disabled={busy} onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}

function PasswordModal({ target, onClose, onDone }: { target: { user_id: string; username: string; request_id?: string }; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState(randomPassword());
  const [done, setDone] = useState(false);
  const toast = useToast();
  const { busy, run } = useAction();
  const submit = async () => { if (await run(async () => { await callAdmin({ action: 'reset_password', user_id: target.user_id, password: pw, request_id: target.request_id }); })) setDone(true); };
  return (
    <Modal title={`كلمة مرور @${target.username}`} onClose={done ? onDone : onClose}>
      {done ? (
        <>
          <p className="text-sm text-slate-300">تم التغيير. سلّم كلمة المرور للعسكري:</p>
          <pre className="ltr my-3 rounded-md bg-navy-900 p-3 font-mono text-gold-300">{pw}</pre>
          <div className="flex justify-end gap-2"><button className="btn btn-outline" onClick={() => { void navigator.clipboard.writeText(pw); toast.ok('تم النسخ'); }}><Copy className="h-4 w-4" /> نسخ</button><button className="btn btn-gold" onClick={onDone}>تم</button></div>
        </>
      ) : (
        <>
          <input className="input ltr font-mono" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} aria-label="كلمة المرور الجديدة" />
          <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setPw(randomPassword())}>توليد</button><button className="btn btn-gold" disabled={busy || pw.length < 8} onClick={submit}>تعيين</button></div>
        </>
      )}
    </Modal>
  );
}
