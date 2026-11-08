import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge } from '@/components/ui';
import { ConfirmButton, Field, Input, Modal, Select, SubmitRow, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';

interface Role { id: string; code: string; name_ar: string; name_en: string; description: string | null; scope: 'global' | 'department'; is_system: boolean }
interface Perm { id: string; code: string; resource: string; action: string }

const RES: Record<string, string> = {
  users: 'الحسابات', roles: 'الأدوار', ranks: 'الرتب', departments: 'الأقسام', personnel: 'شؤون الأفراد', laws: 'القوانين',
  announcements: 'الإعلانات', decisions: 'القرارات', promotions: 'الترقيات', leaves: 'الإجازات', discipline: 'العقوبات',
  warehouses: 'المستودعات', inventory: 'المخزون', custody: 'العهد', cases: 'القضايا', investigations: 'التحقيقات',
  reports: 'التقارير', site: 'الموقع', audit: 'سجل الإدارة',
};
const ACT: [string, string][] = [['view', 'عرض'], ['create', 'إضافة'], ['update', 'تعديل'], ['delete', 'حذف'], ['approve', 'اعتماد']];

export function Roles() {
  const { can } = useAuth();
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { busy, run } = useAction();
  const roles = useAsync(async () => unwrap(await supabase.from('roles').select('*').order('created_at')) as Role[], []);
  const perms = useAsync(async () => unwrap(await supabase.from('permissions').select('*')) as Perm[], []);
  const rp = useAsync(async () => unwrap(await supabase.from('role_permissions').select('role_id,permission_id')) as { role_id: string; permission_id: string }[], []);

  const role = roles.data?.find((r) => r.id === (sel ?? roles.data?.[0]?.id));
  const has = (pid: string) => !!rp.data?.some((x) => x.role_id === role?.id && x.permission_id === pid);
  const editable = can('roles.update');

  const toggle = (p: Perm) => run(async () => {
    if (!role) return;
    must(has(p.id)
      ? await supabase.from('role_permissions').delete().eq('role_id', role.id).eq('permission_id', p.id)
      : await supabase.from('role_permissions').insert({ role_id: role.id, permission_id: p.id }));
    rp.reload();
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="card h-fit p-2">
        <AsyncView state={roles} emptyTitle="لا توجد أدوار" rows={5}>
          {(list) => <>{list.map((r) => (
            <button key={r.id} onClick={() => setSel(r.id)} aria-pressed={role?.id === r.id}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-start text-sm ${role?.id === r.id ? 'bg-gold-500/15 text-gold-300' : 'text-slate-300 hover:bg-white/5'}`}>
              <span className="flex-1">{r.name_ar}</span><span className="text-[11px] text-slate-500">{rp.data?.filter((x) => x.role_id === r.id).length ?? ''}</span>
            </button>))}</>}
        </AsyncView>
        {can('roles.create') && <button className="btn btn-outline mt-2 w-full !py-1.5 text-xs" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> دور جديد</button>}
      </aside>

      <section>
        {role && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white">{role.name_ar}</h2>
              <span className="ltr text-xs text-slate-500">{role.code}</span>
              <Badge tone={role.scope === 'global' ? 'warn' : 'ok'}>{role.scope === 'global' ? 'نطاق عام' : 'ضمن قسم صاحب الدور فقط'}</Badge>
              <span className="flex-1" />
              {can('roles.delete') && !role.is_system && <ConfirmButton label="حذف الدور" busy={busy} onConfirm={() => run(async () => { must(await supabase.from('roles').delete().eq('id', role.id)); setSel(null); roles.reload(); }, 'تم حذف الدور')} />}
            </div>
            {role.description && <p className="mb-4 text-sm text-slate-400">{role.description}</p>}
            <AsyncView state={perms} emptyTitle="لا توجد صلاحيات">
              {(list) => (
                <div className="card overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead><tr className="border-b border-white/[.08] text-[11px] text-slate-500">
                      <th className="px-4 py-3 text-start font-semibold">الصفحة / الوحدة</th>{ACT.map(([, l]) => <th key={l} className="px-3 py-3 font-semibold">{l}</th>)}</tr></thead>
                    <tbody className="divide-y divide-white/[.05]">
                      {Object.keys(RES).map((res) => (
                        <tr key={res}><td className="px-4 py-2.5 text-slate-200">{RES[res]}</td>
                          {ACT.map(([a, l]) => {
                            const p = list.find((x) => x.resource === res && x.action === a);
                            return <td key={a} className="px-3 py-2.5 text-center">{p && <input type="checkbox" className="h-4 w-4 accent-[#B69A52]" aria-label={`${RES[res]} ${l}`}
                              checked={has(p.id)} disabled={!editable || busy} onChange={() => toggle(p)} />}</td>;
                          })}</tr>))}
                    </tbody>
                  </table>
                </div>
              )}
            </AsyncView>
          </>
        )}
      </section>
      {adding && <RoleForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); roles.reload(); }} />}
    </div>
  );
}

function RoleForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ code: '', name_ar: '', name_en: '', description: '', scope: 'global' });
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.from('roles').insert({ ...f, description: f.description || null })); }, 'تم إنشاء الدور')) onSaved();
  };
  return (
    <Modal title="دور جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم بالعربية"><Input required value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></Field>
          <Field label="الاسم بالإنجليزية"><Input required className="ltr" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></Field>
          <Field label="الكود"><Input required className="ltr" pattern="[a-z0-9_]+" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
          <Field label="النطاق"><Select value={f.scope} onChange={(v) => setF({ ...f, scope: v })} options={[{ value: 'global', label: 'عام (كل الأقسام)' }, { value: 'department', label: 'قسم صاحب الدور فقط' }]} /></Field>
        </div>
        <Field label="الوصف"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} label="إنشاء" />
      </form>
    </Modal>
  );
}
