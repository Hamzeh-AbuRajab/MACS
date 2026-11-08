import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Plus, Shield } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { Field, Input, Modal, PageHeader, Select, SubmitRow, Table, Tabs, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { opts } from '@/lib/refs';
import { REQUEST_STATUS, SERVICE_STATUS, fmtDate } from '@/lib/format';
import type { Announcement, Department, Law, PersonnelRow } from '@/lib/types';

export function Departments() {
  const { can } = useAuth();
  const [edit, setEdit] = useState<Partial<Department> | null>(null);
  const depts = useAsync(async () => unwrap(await supabase.from('departments').select('*').order('sort_order')) as Department[], []);
  const counts = useAsync(async () => unwrap(await supabase.from('personnel').select('department_id')) as { department_id: string | null }[], []);
  return (
    <div className="animate-fade-up">
      <PageHeader title="الأقسام العسكرية" actions={can('departments.create') && <button className="btn btn-gold" onClick={() => setEdit({ sort_order: 10 })}><Plus className="h-4 w-4" /> قسم جديد</button>} />
      <AsyncView state={depts} emptyTitle="لا توجد أقسام">
        {(rows) => (
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((d) => (
              <Link key={d.id} to={`/app/departments/${d.id}`} className="card p-5 transition-colors hover:border-gold-500/40">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-md bg-olive-500/20 text-olive-400"><Shield className="h-5 w-5" /></span>
                  <div className="flex-1">
                    <p className="font-bold text-white">{d.name_ar}</p>
                    <p className="ltr text-start text-[11px] text-gold-400">{d.name_en}</p>
                  </div>
                  <Badge>{(counts.data ?? []).filter((c) => c.department_id === d.id).length} فرد</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-400">{d.description}</p>
              </Link>
            ))}
          </div>
        )}
      </AsyncView>
      {edit && <DeptForm initial={edit} members={[]} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); depts.reload(); }} />}
    </div>
  );
}

type Tab = 'overview' | 'members' | 'laws' | 'announcements' | 'requests' | 'reports';

export function DepartmentDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [edit, setEdit] = useState(false);
  const dept = useAsync(async () => unwrap(await supabase.from('departments').select('*').eq('id', id!).maybeSingle()) as Department | null, [id]);
  const members = useAsync(async () => unwrap(await supabase.from('personnel')
    .select('*, profile:profiles(*), rank:ranks(*)').eq('department_id', id!).order('rank_id')) as unknown as PersonnelRow[], [id]);

  if (dept.loading && !dept.data) return <LoadingBlock />;
  if (dept.error) return <ErrorState message={dept.error} onRetry={dept.reload} />;
  const d = dept.data;
  if (!d) return <EmptyState title="القسم غير موجود" />;

  const nameOf = (uid: string | null) => members.data?.find((m) => m.user_id === uid)?.profile.full_name;
  const canManage = can('departments.update');

  return (
    <div className="animate-fade-up">
      <PageHeader title={d.name_ar} desc={d.name_en}
        actions={canManage && <button className="btn btn-outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> تعديل القسم</button>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'نظرة عامة' }, { id: 'members', label: 'الأعضاء' }, { id: 'laws', label: 'قوانين القسم' },
        { id: 'announcements', label: 'الإعلانات' }, { id: 'requests', label: 'الطلبات' }, { id: 'reports', label: 'التقارير' }]} />

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card p-5"><h3 className="mb-2 text-sm font-bold text-gold-300">قيادة القسم</h3>
            <p className="text-sm text-slate-300">القائد: <b className="text-white">{nameOf(d.commander_id) ?? (d.commander_id ? 'غير ظاهر لك' : 'غير معيّن')}</b></p>
            <p className="mt-1 text-sm text-slate-300">النائب: <b className="text-white">{nameOf(d.deputy_id) ?? (d.deputy_id ? 'غير ظاهر لك' : 'غير معيّن')}</b></p>
          </section>
          <section className="card p-5"><h3 className="mb-2 text-sm font-bold text-gold-300">الوصف</h3><p className="text-sm leading-7 text-slate-400">{d.description || '—'}</p></section>
          <section className="card p-5 md:col-span-2"><h3 className="mb-2 text-sm font-bold text-gold-300">المهام والمسؤوليات</h3>
            <p className="whitespace-pre-line text-sm leading-8 text-slate-300">{d.missions || 'لم تُحدد مهام بعد.'}</p></section>
        </div>
      )}

      {tab === 'members' && (
        <AsyncView state={members} emptyTitle="لا توجد أعضاء ظاهرون لك" emptyHint="تظهر لك بيانات الأعضاء حسب صلاحياتك فقط.">
          {(rows) => (
            <Table head={['الاسم', 'الرتبة', 'الرقم العسكري', 'الحالة']}>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-semibold text-white">{can('personnel.view') ? <Link className="hover:text-gold-300" to={`/app/personnel/${m.user_id}`}>{m.profile.full_name}</Link> : m.profile.full_name}
                    {(d.commander_id === m.user_id) && <Badge tone="warn">قائد</Badge>}{(d.deputy_id === m.user_id) && <Badge>نائب</Badge>}</td>
                  <td className="px-4 py-3 text-slate-300">{m.rank?.name_ar}</td>
                  <td className="ltr px-4 py-3 text-start font-mono text-xs text-slate-400">{m.military_number}</td>
                  <td className="px-4 py-3"><Badge tone={SERVICE_STATUS[m.service_status].tone}>{SERVICE_STATUS[m.service_status].label}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </AsyncView>
      )}
      {tab === 'laws' && <DeptLaws id={d.id} />}
      {tab === 'announcements' && <DeptAnnouncements id={d.id} />}
      {tab === 'requests' && <DeptRequests id={d.id} />}
      {tab === 'reports' && <DeptReport members={members.data ?? []} />}
      {edit && <DeptForm initial={d} members={members.data ?? []} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); dept.reload(); }} />}
    </div>
  );
}

function DeptLaws({ id }: { id: string }) {
  const s = useAsync(async () => unwrap(await supabase.from('laws').select('id,category_id,title,content,responsible_party,updated_at').eq('department_id', id).eq('status', 'published').order('sort_order')) as Law[], [id]);
  return (
    <AsyncView state={s} emptyTitle="لا توجد قوانين خاصة بهذا القسم">
      {(rows) => <div className="space-y-3">{rows.map((l) => (
        <article key={l.id} className="card p-5"><h3 className="font-bold text-white">{l.title}</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-8 text-slate-300">{l.content}</p>
          <p className="mt-2 text-[11px] text-slate-500">آخر تحديث: {fmtDate(l.updated_at)}</p></article>))}</div>}
    </AsyncView>
  );
}

function DeptAnnouncements({ id }: { id: string }) {
  const s = useAsync(async () => unwrap(await supabase.from('announcements').select('id,title,body,image_url,pinned,published_at,is_public').eq('target_department_id', id).eq('status', 'published').order('published_at', { ascending: false })) as Announcement[], [id]);
  return (
    <AsyncView state={s} emptyTitle="لا توجد إعلانات خاصة بالقسم">
      {(rows) => <div className="space-y-3">{rows.map((a) => (
        <article key={a.id} className="card p-5"><h3 className="font-bold text-white">{a.title}</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-300">{a.body}</p>
          <p className="mt-2 text-[11px] text-slate-500">{fmtDate(a.published_at)}</p></article>))}</div>}
    </AsyncView>
  );
}

function DeptRequests({ id }: { id: string }) {
  const leaves = useAsync(async () => unwrap(await supabase.from('leave_requests').select('id,start_date,end_date,status,applicant:profiles!leave_requests_applicant_id_fkey(full_name)').eq('department_id', id).order('created_at', { ascending: false }).limit(50)) as unknown as { id: string; start_date: string; end_date: string; status: string; applicant: { full_name: string } | null }[], [id]);
  const promos = useAsync(async () => unwrap(await supabase.from('promotion_requests').select('id,status,created_at,applicant:profiles!promotion_requests_applicant_id_fkey(full_name),requested_rank:ranks!promotion_requests_requested_rank_id_fkey(name_ar)').eq('department_id', id).order('created_at', { ascending: false }).limit(50)) as unknown as { id: string; status: string; created_at: string; applicant: { full_name: string } | null; requested_rank: { name_ar: string } | null }[], [id]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section><h3 className="mb-3 text-sm font-bold text-gold-300">طلبات الإجازة</h3>
        <AsyncView state={leaves} emptyTitle="لا توجد طلبات ظاهرة لك">{(r) => <ul className="card divide-y divide-white/[.06]">{r.map((x) => (
          <li key={x.id} className="flex items-center gap-2 px-4 py-3 text-sm"><span className="flex-1 text-slate-200">{x.applicant?.full_name} <span className="text-xs text-slate-500">{fmtDate(x.start_date)} ← {fmtDate(x.end_date)}</span></span><Badge tone={REQUEST_STATUS[x.status].tone}>{REQUEST_STATUS[x.status].label}</Badge></li>))}</ul>}</AsyncView></section>
      <section><h3 className="mb-3 text-sm font-bold text-gold-300">طلبات الترقية</h3>
        <AsyncView state={promos} emptyTitle="لا توجد طلبات ظاهرة لك">{(r) => <ul className="card divide-y divide-white/[.06]">{r.map((x) => (
          <li key={x.id} className="flex items-center gap-2 px-4 py-3 text-sm"><span className="flex-1 text-slate-200">{x.applicant?.full_name} <span className="text-xs text-slate-500">← {x.requested_rank?.name_ar}</span></span><Badge tone={REQUEST_STATUS[x.status].tone}>{REQUEST_STATUS[x.status].label}</Badge></li>))}</ul>}</AsyncView></section>
    </div>
  );
}

function DeptReport({ members }: { members: PersonnelRow[] }) {
  if (!members.length) return <EmptyState title="لا توجد بيانات لعرض التقرير" hint="التقرير يُبنى من الأعضاء الظاهرين لك." />;
  const byStatus = Object.entries(SERVICE_STATUS).map(([k, v]) => ({ k, label: v.label, n: members.filter((m) => m.service_status === k).length }));
  const byRank = [...new Map(members.map((m) => [m.rank_id, m.rank?.name_ar ?? '—'])).entries()].map(([k, label]) => ({ k, label, n: members.filter((m) => m.rank_id === k).length }));
  const bars = (rows: { k: string; label: string; n: number }[]) => (
    <ul className="space-y-2">{rows.map((r) => (
      <li key={r.k} className="flex items-center gap-3 text-sm"><span className="w-28 text-slate-300">{r.label}</span>
        <span className="h-2 flex-1 overflow-hidden rounded bg-white/5"><span className="block h-full bg-gold-500" style={{ width: `${(r.n / members.length) * 100}%` }} /></span>
        <span className="w-6 text-end font-mono text-xs text-slate-400">{r.n}</span></li>))}</ul>);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card p-5"><h3 className="mb-3 text-sm font-bold text-gold-300">حسب حالة الخدمة (الإجمالي {members.length})</h3>{bars(byStatus)}</section>
      <section className="card p-5"><h3 className="mb-3 text-sm font-bold text-gold-300">توزيع الرتب</h3>{bars(byRank)}</section>
    </div>
  );
}

function DeptForm({ initial, members, onClose, onSaved }: { initial: Partial<Department>; members: PersonnelRow[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const { busy, run } = useAction();
  const set = <K extends keyof Department>(k: K, v: Department[K]) => setF((s) => ({ ...s, [k]: v }));
  const people = opts(members, (m) => m.user_id, (m) => m.profile.full_name);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const row = { code: f.code, name_ar: f.name_ar, name_en: f.name_en, description: f.description ?? null, missions: f.missions ?? null,
      commander_id: f.commander_id || null, deputy_id: f.deputy_id || null, sort_order: Number(f.sort_order ?? 0) };
    if (await run(async () => { must(f.id ? await supabase.from('departments').update(row).eq('id', f.id) : await supabase.from('departments').insert(row)); }, 'تم حفظ القسم')) onSaved();
  };
  return (
    <Modal title={f.id ? 'تعديل القسم' : 'قسم جديد'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم بالعربية"><Input required value={f.name_ar ?? ''} onChange={(e) => set('name_ar', e.target.value)} /></Field>
          <Field label="الاسم بالإنجليزية"><Input required className="ltr" value={f.name_en ?? ''} onChange={(e) => set('name_en', e.target.value)} /></Field>
          <Field label="الكود"><Input required className="ltr" pattern="[a-z0-9_]+" disabled={!!f.id} value={f.code ?? ''} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="الترتيب"><Input type="number" value={f.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} /></Field>
          {f.id && <>
            <Field label="قائد القسم"><Select value={f.commander_id ?? ''} onChange={(v) => set('commander_id', v || null)} options={people} placeholder="— غير معيّن —" /></Field>
            <Field label="نائب القائد"><Select value={f.deputy_id ?? ''} onChange={(v) => set('deputy_id', v || null)} options={people} placeholder="— غير معيّن —" /></Field>
          </>}
        </div>
        <Field label="الوصف"><Textarea value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="المهام والمسؤوليات"><Textarea value={f.missions ?? ''} onChange={(e) => set('missions', e.target.value)} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
