import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { RankInsignia } from '@/components/RankInsignia';
import { AsyncView, Badge, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { Check, Field, Input, Modal, PageHeader, Select, SubmitRow, Table, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { callAdmin, opts, useDepartments, useRanks } from '@/lib/refs';
import { EVENT_LABEL, PENALTY, REQUEST_STATUS, SERVICE_STATUS, fmtDate, fmtDateTime } from '@/lib/format';
import type { PersonnelEvent, PersonnelRow, ServiceStatus } from '@/lib/types';
import { CreateAccountModal } from './admin/CreateAccount';

const SELECT = '*, profile:profiles(*), rank:ranks(*), department:departments(*)';

export function PersonnelList() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [rank, setRank] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(false);
  const ranks = useRanks();
  const depts = useDepartments();
  const list = useAsync(async () => unwrap(await supabase.from('personnel').select(SELECT).order('rank_id')) as unknown as PersonnelRow[], []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data ?? []).filter((p) =>
      (!s || p.profile.full_name.toLowerCase().includes(s) || p.profile.username.includes(s) || p.military_number.toLowerCase().includes(s)) &&
      (!rank || p.rank_id === rank) && (!dept || (dept === 'none' ? !p.department_id : p.department_id === dept)) && (!status || p.service_status === status))
      .sort((a, b) => (a.rank?.level ?? 99) - (b.rank?.level ?? 99));
  }, [list.data, q, rank, dept, status]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="شؤون الأفراد" desc="تظهر لك الملفات ضمن نطاق صلاحياتك فقط."
        actions={can('users.create') && <button className="btn btn-gold" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> إضافة عسكري</button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input ps-9" placeholder="بحث بالاسم / المستخدم / الرقم" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
        </div>
        <Select value={rank} onChange={setRank} placeholder="كل الرتب" options={opts(ranks.data, (r) => r.id, (r) => r.name_ar)} aria-label="الرتبة" />
        <Select value={dept} onChange={setDept} placeholder="كل الأقسام" options={[{ value: 'none', label: 'القيادة العليا' }, ...opts(depts.data, (d) => d.id, (d) => d.name_ar)]} aria-label="القسم" />
        <Select value={status} onChange={setStatus} placeholder="كل الحالات" options={Object.entries(SERVICE_STATUS).map(([value, v]) => ({ value, label: v.label }))} aria-label="الحالة" />
      </div>
      <AsyncView state={{ ...list, data: list.data }} emptyTitle="لا توجد ملفات" emptyHint="لا توجد ملفات ظاهرة لك.">
        {() => rows.length === 0 ? <EmptyState title="لا نتائج مطابقة" /> : (
          <Table head={['العسكري', 'الرتبة', 'القسم', 'الرقم العسكري', 'الحالة']}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-white/[.03]">
                <td className="px-4 py-3"><Link to={`/app/personnel/${p.user_id}`} className="flex items-center gap-3">
                  {p.rank && <RankInsignia category={p.rank.category} level={p.rank.level} url={p.rank.insignia_url} size={32} />}
                  <span><span className="block font-semibold text-white">{p.profile.full_name}</span><span className="ltr block text-start text-[11px] text-slate-500">@{p.profile.username}</span></span></Link></td>
                <td className="px-4 py-3 text-slate-300">{p.rank?.name_ar}</td>
                <td className="px-4 py-3 text-slate-300">{p.department?.name_ar ?? 'القيادة العليا'}</td>
                <td className="ltr px-4 py-3 text-start font-mono text-xs text-slate-400">{p.military_number}</td>
                <td className="px-4 py-3"><Badge tone={SERVICE_STATUS[p.service_status].tone}>{SERVICE_STATUS[p.service_status].label}</Badge>
                  {!p.profile.is_active && <Badge tone="bad">معطّل</Badge>}</td>
              </tr>
            ))}
          </Table>
        )}
      </AsyncView>
      {adding && <CreateAccountModal onClose={() => setAdding(false)} onCreated={() => { setAdding(false); list.reload(); }} />}
    </div>
  );
}

type Action = 'rank' | 'transfer' | 'status' | 'edit' | 'assign' | null;

export function PersonnelDetail() {
  const { userId } = useParams();
  const { can, profile: me } = useAuth();
  const [act, setAct] = useState<Action>(null);
  const p = useAsync(async () => unwrap(await supabase.from('personnel').select(SELECT).eq('user_id', userId!).maybeSingle()) as unknown as PersonnelRow | null, [userId]);
  const events = useAsync(async () => unwrap(await supabase.from('personnel_events')
    .select('id,event_type,reason,created_at,from_rank:ranks!personnel_events_from_rank_id_fkey(name_ar),to_rank:ranks!personnel_events_to_rank_id_fkey(name_ar),from_department:departments!personnel_events_from_department_id_fkey(name_ar),to_department:departments!personnel_events_to_department_id_fkey(name_ar)')
    .eq('user_id', userId!).order('created_at', { ascending: false })) as unknown as PersonnelEvent[], [userId]);
  const penalties = useAsync(async () => unwrap(await supabase.from('disciplinary_records').select('id,violation_type,penalty_type,issued_at').eq('subject_id', userId!).order('issued_at', { ascending: false })) as { id: string; violation_type: string; penalty_type: string; issued_at: string }[], [userId]);
  const leaves = useAsync(async () => unwrap(await supabase.from('leave_requests').select('id,start_date,end_date,status').eq('applicant_id', userId!).order('created_at', { ascending: false })) as { id: string; start_date: string; end_date: string; status: string }[], [userId]);
  const promos = useAsync(async () => unwrap(await supabase.from('promotion_requests').select('id,status,created_at,requested_rank:ranks!promotion_requests_requested_rank_id_fkey(name_ar)').eq('applicant_id', userId!).order('created_at', { ascending: false })) as unknown as { id: string; status: string; created_at: string; requested_rank: { name_ar: string } | null }[], [userId]);

  if (p.loading && !p.data) return <LoadingBlock />;
  if (p.error) return <ErrorState message={p.error} onRetry={p.reload} />;
  const x = p.data;
  if (!x) return <EmptyState title="الملف غير موجود أو لا تملك صلاحية عرضه" />;
  const self = x.user_id === me?.id;
  const refresh = () => { p.reload(); events.reload(); };
  const st = SERVICE_STATUS[x.service_status];

  const btn = (a: Exclude<Action, null>, label: string, perm: string) =>
    !self && can(perm) && <button className="btn btn-outline !py-1.5 text-xs" onClick={() => setAct(a)}>{label}</button>;

  return (
    <div className="animate-fade-up space-y-6">
      {can('personnel.view') && <Link to="/app/personnel" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-gold-300"><ArrowRight className="h-3.5 w-3.5" /> كل الأفراد</Link>}
      <section className="card p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {x.rank && <RankInsignia category={x.rank.category} level={x.rank.level} url={x.rank.insignia_url} size={88} />}
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-white">{x.profile.full_name}</h1>
            <p className="ltr text-start text-sm text-slate-400">{x.rank?.name_en} · @{x.profile.username}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Badge tone={st.tone}>{st.label}</Badge>{!x.profile.is_active && <Badge tone="bad">الحساب معطّل</Badge>}</div>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[['الرتبة', x.rank?.name_ar], ['القسم', x.department?.name_ar ?? 'القيادة العليا'], ['الرقم العسكري', x.military_number], ['الانتساب', fmtDate(x.joined_at)]].map(([k, v]) => (
            <div key={k} className="rounded-md bg-navy-900/50 px-3 py-2.5"><dt className="text-[11px] text-slate-500">{k}</dt><dd className="mt-0.5 text-sm font-semibold text-white">{v}</dd></div>))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {btn('rank', 'ترقية / تخفيض', 'promotions.approve')}
          {btn('transfer', 'نقل بين الأقسام', 'personnel.approve')}
          {btn('status', 'تغيير حالة الخدمة', 'personnel.approve')}
          {btn('assign', 'تسجيل تكليف / ملاحظة', 'personnel.update')}
          {!self && can('personnel.update') && <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => setAct('edit')}>تعديل البيانات</button>}
        </div>
        {can('personnel.view') && x.admin_notes && <p className="mt-4 rounded-md bg-gold-500/10 p-3 text-sm text-gold-300"><b>ملاحظات إدارية:</b> {x.admin_notes}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Box title="سجل الترقيات والنقل والتكليفات">
          <AsyncView state={events} emptyTitle="لا توجد سجلات">{(r) => <ul className="space-y-3">{r.map((e) => (
            <li key={e.id} className="text-sm"><b className="text-slate-100">{EVENT_LABEL[e.event_type] ?? e.event_type}</b>
              {e.to_rank && <span className="text-slate-400"> — {e.from_rank ? `${e.from_rank.name_ar} ← ` : ''}{e.to_rank.name_ar}</span>}
              {e.to_department && <span className="text-slate-400"> — {e.from_department ? `${e.from_department.name_ar} ← ` : ''}{e.to_department.name_ar}</span>}
              {e.reason && <p className="text-xs text-slate-400">{e.reason}</p>}<p className="text-[11px] text-slate-500">{fmtDateTime(e.created_at)}</p></li>))}</ul>}</AsyncView>
        </Box>
        <Box title="سجل العقوبات">
          <AsyncView state={penalties} emptyTitle="لا توجد عقوبات (أو لا تملك صلاحية العرض)">{(r) => <ul className="space-y-2">{r.map((e) => (
            <li key={e.id} className="text-sm"><Badge tone="bad">{PENALTY[e.penalty_type]}</Badge> <span className="ms-1 text-slate-200">{e.violation_type}</span> <span className="text-[11px] text-slate-500">{fmtDate(e.issued_at)}</span></li>))}</ul>}</AsyncView>
        </Box>
        <Box title="سجل الإجازات">
          <AsyncView state={leaves} emptyTitle="لا توجد إجازات">{(r) => <ul className="space-y-2">{r.map((e) => (
            <li key={e.id} className="text-sm"><Badge tone={REQUEST_STATUS[e.status].tone}>{REQUEST_STATUS[e.status].label}</Badge> <span className="ms-1 text-slate-200">{fmtDate(e.start_date)} ← {fmtDate(e.end_date)}</span></li>))}</ul>}</AsyncView>
        </Box>
        <Box title="سجل طلبات الترقية">
          <AsyncView state={promos} emptyTitle="لا توجد طلبات">{(r) => <ul className="space-y-2">{r.map((e) => (
            <li key={e.id} className="text-sm"><Badge tone={REQUEST_STATUS[e.status].tone}>{REQUEST_STATUS[e.status].label}</Badge> <span className="ms-1 text-slate-200">إلى {e.requested_rank?.name_ar}</span> <span className="text-[11px] text-slate-500">{fmtDate(e.created_at)}</span></li>))}</ul>}</AsyncView>
        </Box>
      </div>

      {act && <ActionModal act={act} p={x} onClose={() => setAct(null)} onDone={() => { setAct(null); refresh(); }} />}
    </div>
  );
}

const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card p-5"><h2 className="mb-4 text-sm font-bold text-white">{title}</h2>{children}</section>);

function ActionModal({ act, p, onClose, onDone }: { act: Exclude<Action, null>; p: PersonnelRow; onClose: () => void; onDone: () => void }) {
  const ranks = useRanks();
  const depts = useDepartments();
  const { busy, run } = useAction();
  const [rank, setRank] = useState(p.rank_id);
  const [dept, setDept] = useState(p.department_id ?? '');
  const [status, setStatus] = useState<ServiceStatus>(p.service_status);
  const [reason, setReason] = useState('');
  const [num, setNum] = useState(p.military_number);
  const [notes, setNotes] = useState(p.admin_notes ?? '');
  const [disable, setDisable] = useState(false);

  const titles = { rank: 'ترقية / تخفيض رتبة', transfer: 'نقل بين الأقسام', status: 'تغيير حالة الخدمة', edit: 'تعديل بيانات العسكري', assign: 'تسجيل تكليف / ملاحظة' };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (act === 'rank') must(await supabase.rpc('change_personnel', { p_user: p.user_id, p_rank: rank, p_reason: reason }));
      if (act === 'transfer') must(await supabase.rpc('change_personnel', { p_user: p.user_id, p_department: dept || null, p_set_department: true, p_reason: reason }));
      if (act === 'status') {
        must(await supabase.rpc('change_personnel', { p_user: p.user_id, p_status: status, p_reason: reason }));
        if (status === 'terminated' && disable) await callAdmin({ action: 'set_active', user_id: p.user_id, active: false });
      }
      if (act === 'edit') {
        must(await supabase.from('personnel').update({ military_number: num, admin_notes: notes || null }).eq('user_id', p.user_id));
      }
      if (act === 'assign') must(await supabase.from('personnel_events').insert({ user_id: p.user_id, event_type: 'assignment', reason, created_by: (await supabase.auth.getUser()).data.user?.id }));
    }, 'تم تنفيذ الإجراء وتسجيله');
    if (ok) onDone();
  };
  const needReason = act !== 'edit';
  return (
    <Modal title={`${titles[act]} — ${p.profile.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {act === 'rank' && <Field label="الرتبة الجديدة"><Select value={rank} onChange={setRank} options={opts(ranks.data, (r) => r.id, (r) => `${r.level}. ${r.name_ar}`)} /></Field>}
        {act === 'transfer' && <Field label="القسم الجديد"><Select value={dept} onChange={setDept} placeholder="القيادة العليا (بدون قسم)" options={opts(depts.data, (d) => d.id, (d) => d.name_ar)} /></Field>}
        {act === 'status' && <>
          <Field label="الحالة"><Select value={status} onChange={(v) => setStatus(v as ServiceStatus)} options={Object.entries(SERVICE_STATUS).map(([value, v]) => ({ value, label: v.label }))} /></Field>
          {status === 'terminated' && <Check label="تعطيل الحساب أيضاً" checked={disable} onChange={setDisable} />}</>}
        {act === 'edit' && <>
          <Field label="الرقم العسكري"><Input required className="ltr" value={num} onChange={(e) => setNum(e.target.value)} /></Field>
          <Field label="ملاحظات إدارية"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></>}
        {needReason && <Field label={act === 'assign' ? 'نص التكليف / الملاحظة' : 'السبب'}><Textarea required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        <SubmitRow busy={busy} onCancel={onClose} label="تنفيذ" />
      </form>
    </Modal>
  );
}
