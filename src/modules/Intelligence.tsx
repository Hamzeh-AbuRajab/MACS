import { useState, type FormEvent } from 'react';
import { ExternalLink, Plus, Send } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge, EmptyState } from '@/components/ui';
import { Field, Input, Modal, PageHeader, Select, SubmitRow, Table, Tabs, Textarea, must, useAction, useToast } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { opts } from '@/lib/refs';
import { fmtDateTime } from '@/lib/format';

interface Case { id: string; case_number: string; title: string; description: string | null; case_type: 'report' | 'case'; status: string; final_decision: string | null;
  created_at: string; subject_id: string | null; assigned_to: string | null; reporter: { full_name: string } | null; subject: { full_name: string } | null }
const ST: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }> = {
  open: { label: 'مفتوحة', tone: 'warn' }, under_investigation: { label: 'قيد التحقيق', tone: 'bad' }, closed: { label: 'مغلقة', tone: 'ok' }, referred: { label: 'محالة', tone: 'mute' } };
const SEL = 'id,case_number,title,description,case_type,status,final_decision,created_at,subject_id,assigned_to,reporter:profiles!cases_reported_by_fkey(full_name),subject:profiles!cases_subject_id_fkey(full_name)';

export function Intelligence() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<Case | null>(null);
  const [adding, setAdding] = useState(false);
  const cases = useAsync(async () => unwrap(await supabase.from('cases').select(SEL).order('created_at', { ascending: false })) as unknown as Case[], []);
  const rows = (cases.data ?? []).filter((c) => !status || c.status === status);
  return (
    <div className="animate-fade-up">
      <PageHeader title="الاستخبارات العسكرية" desc="البلاغات والقضايا والتحقيقات. الوصول لمصرّح لهم فقط."
        actions={can('cases.create') && <button className="btn btn-gold" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> قضية جديدة</button>} />
      <div className="mb-4 max-w-xs"><Select value={status} onChange={setStatus} placeholder="كل الحالات" options={Object.entries(ST).map(([value, v]) => ({ value, label: v.label }))} aria-label="الحالة" /></div>
      <AsyncView state={{ ...cases, data: cases.data ? rows : undefined }} emptyTitle="لا توجد قضايا">
        {(list) => (
          <Table head={['الرقم', 'العنوان', 'النوع', 'الأطراف', 'الحالة', 'التاريخ']}>
            {list.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-white/[.03]" onClick={() => setOpen(c)}>
                <td className="ltr px-4 py-3 text-start font-mono text-xs text-slate-400">{c.case_number}</td>
                <td className="px-4 py-3 font-semibold text-white">{c.title}</td>
                <td className="px-4 py-3 text-slate-300">{c.case_type === 'report' ? 'بلاغ' : 'قضية'}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{c.reporter && <>المبلّغ: {c.reporter.full_name}<br /></>}{c.subject && <>المعني: {c.subject.full_name}</>}</td>
                <td className="px-4 py-3"><Badge tone={ST[c.status].tone}>{ST[c.status].label}</Badge></td>
                <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(c.created_at)}</td>
              </tr>))}
          </Table>)}
      </AsyncView>
      {adding && <NewCase onClose={() => setAdding(false)} onDone={() => { setAdding(false); cases.reload(); }} />}
      {open && <CaseDetail c={open} onClose={() => setOpen(null)} onChanged={cases.reload} />}
    </div>
  );
}

/** Any signed-in military user may file a report. They cannot read cases afterwards. */
export function FileReport() {
  const { profile } = useAuth();
  const [t, setT] = useState('');
  const [d, setD] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.from('cases').insert({ title: t, description: d, case_type: 'report', status: 'open', reported_by: profile!.id })); })) setSent(true);
  };
  return (
    <div className="animate-fade-up mx-auto max-w-xl">
      <PageHeader title="تقديم بلاغ" desc="يصل البلاغ للاستخبارات العسكرية بسرية. لن تتمكن من رؤية بقية الملفات." />
      {sent ? <div className="card p-8 text-center"><Send className="mx-auto h-8 w-8 text-olive-400" /><p className="mt-3 font-semibold text-white">تم إرسال البلاغ</p>
        <button className="btn btn-outline mt-4" onClick={() => { setSent(false); setT(''); setD(''); }}>بلاغ آخر</button></div> : (
        <form onSubmit={submit} className="card space-y-4 p-6">
          <Field label="عنوان البلاغ"><Input required value={t} onChange={(e) => setT(e.target.value)} /></Field>
          <Field label="التفاصيل"><Textarea required className="min-h-40" value={d} onChange={(e) => setD(e.target.value)} /></Field>
          <SubmitRow busy={busy} onCancel={() => { setT(''); setD(''); }} label="إرسال" />
        </form>)}
    </div>
  );
}

function NewCase({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const people = useAsync(async () => unwrap(await supabase.from('profiles').select('id,full_name').order('full_name')) as { id: string; full_name: string }[], []);
  const [f, setF] = useState({ title: '', description: '', subject_id: '' });
  const { busy, run } = useAction();
  const { profile } = useAuth();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.from('cases').insert({ ...f, subject_id: f.subject_id || null, case_type: 'case', reported_by: profile!.id })); }, 'تم فتح القضية')) onDone();
  };
  return (
    <Modal title="قضية جديدة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="العنوان"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="العسكري المعني (اختياري)"><Select value={f.subject_id} onChange={(v) => setF({ ...f, subject_id: v })} placeholder="—" options={opts(people.data, (p) => p.id, (p) => p.full_name)} /></Field>
        <Field label="الوصف"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} label="فتح" />
      </form>
    </Modal>
  );
}

interface Inv { id: string; summary: string | null; report: string | null; status: string; lead: { full_name: string } | null }
interface Ev { id: string; title: string; description: string | null; file_path: string | null; created_at: string; by: { full_name: string } | null }
interface Stm { id: string; witness_name: string | null; content: string; created_at: string; witness: { full_name: string } | null; taker: { full_name: string } | null }

function CaseDetail({ c, onClose, onChanged }: { c: Case; onClose: () => void; onChanged: () => void }) {
  const { can, profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'info' | 'inv' | 'ev' | 'stm'>('info');
  const [status, setStatus] = useState(c.status);
  const [decision, setDecision] = useState(c.final_decision ?? '');
  const { busy, run } = useAction();
  const inv = useAsync(async () => unwrap(await supabase.from('investigations').select('id,summary,report,status,lead:profiles!investigations_lead_investigator_id_fkey(full_name)').eq('case_id', c.id)) as unknown as Inv[], [c.id]);
  const ev = useAsync(async () => unwrap(await supabase.from('evidence').select('id,title,description,file_path,created_at,by:profiles!evidence_added_by_fkey(full_name)').eq('case_id', c.id).order('created_at')) as unknown as Ev[], [c.id]);
  const stm = useAsync(async () => unwrap(await supabase.from('statements').select('id,witness_name,content,created_at,witness:profiles!statements_witness_id_fkey(full_name),taker:profiles!statements_taken_by_fkey(full_name)').eq('case_id', c.id).order('created_at')) as unknown as Stm[], [c.id]);
  const [form, setForm] = useState({ a: '', b: '' });
  const [file, setFile] = useState<File | null>(null);

  const saveCase = () => run(async () => {
    must(await supabase.from('cases').update({ status, final_decision: decision || null, closed_at: status === 'closed' ? new Date().toISOString() : null }).eq('id', c.id));
    onChanged();
  }, 'تم تحديث القضية');
  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from('evidence').createSignedUrl(path, 120);
    if (error || !data) { toast.fail('تعذّر فتح الملف'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <Modal title={`${c.case_number} — ${c.title}`} onClose={onClose} wide>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'info', label: 'القضية' }, { id: 'inv', label: 'التحقيق' }, { id: 'ev', label: 'الأدلة' }, { id: 'stm', label: 'الإفادات' }]} />
      {tab === 'info' && (
        <div className="space-y-4">
          <p className="whitespace-pre-line text-sm leading-7 text-slate-300">{c.description || 'لا يوجد وصف.'}</p>
          {can('cases.update') && <>
            <Field label="الحالة"><Select value={status} onChange={setStatus} options={Object.entries(ST).map(([value, v]) => ({ value, label: v.label }))} /></Field>
            <Field label="القرار النهائي"><Textarea value={decision} onChange={(e) => setDecision(e.target.value)} /></Field>
            <div className="flex justify-end"><button className="btn btn-gold" disabled={busy} onClick={saveCase}>حفظ</button></div></>}
        </div>)}
      {tab === 'inv' && (
        <div className="space-y-4">
          <AsyncView state={inv} emptyTitle="لا يوجد تحقيق مفتوح" rows={1}>{(r) => <>{r.map((i) => (
            <div key={i.id} className="rounded-md bg-navy-900/50 p-4 text-sm"><Badge tone="warn">{i.status}</Badge> <span className="text-slate-400">المحقق: {i.lead?.full_name ?? '—'}</span>
              <p className="mt-2 text-slate-200">{i.summary}</p><p className="mt-2 whitespace-pre-line text-slate-400">{i.report}</p></div>))}</>}</AsyncView>
          {can('investigations.create') && (
            <form className="space-y-3 border-t border-white/[.08] pt-4" onSubmit={async (e) => { e.preventDefault();
              if (await run(async () => { must(await supabase.from('investigations').insert({ case_id: c.id, lead_investigator_id: profile!.id, summary: form.a, report: form.b })); }, 'تم تسجيل التحقيق')) { setForm({ a: '', b: '' }); inv.reload(); } }}>
              <Field label="ملخص"><Input required value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} /></Field>
              <Field label="تقرير المحقق"><Textarea value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} /></Field>
              <button className="btn btn-gold" disabled={busy}>إضافة تحقيق</button></form>)}
        </div>)}
      {tab === 'ev' && (
        <div className="space-y-4">
          <AsyncView state={ev} emptyTitle="لا توجد أدلة" rows={1}>{(r) => <ul className="divide-y divide-white/[.06]">{r.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-3 text-sm"><div className="flex-1"><p className="font-semibold text-white">{x.title}</p><p className="text-xs text-slate-400">{x.description} · {x.by?.full_name} · {fmtDateTime(x.created_at)}</p></div>
              {x.file_path && <button className="btn btn-outline !py-1 text-xs" onClick={() => openFile(x.file_path!)}><ExternalLink className="h-3.5 w-3.5" /> فتح</button>}</li>))}</ul>}</AsyncView>
          {can('investigations.create') && (
            <form className="space-y-3 border-t border-white/[.08] pt-4" onSubmit={async (e) => { e.preventDefault();
              if (await run(async () => {
                let file_path: string | null = null;
                if (file) { file_path = `${c.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`; const up = await supabase.storage.from('evidence').upload(file_path, file); if (up.error) throw up.error; }
                must(await supabase.from('evidence').insert({ case_id: c.id, title: form.a, description: form.b || null, file_path, added_by: profile!.id }));
              }, 'تمت إضافة الدليل')) { setForm({ a: '', b: '' }); setFile(null); ev.reload(); } }}>
              <Field label="عنوان الدليل"><Input required value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} /></Field>
              <Field label="وصف"><Input value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} /></Field>
              <Field label="ملف (اختياري)"><input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
              <button className="btn btn-gold" disabled={busy}>إضافة دليل</button></form>)}
        </div>)}
      {tab === 'stm' && (
        <div className="space-y-4">
          <AsyncView state={stm} emptyTitle="لا توجد إفادات" rows={1}>{(r) => <ul className="space-y-3">{r.map((x) => (
            <li key={x.id} className="rounded-md bg-navy-900/50 p-3 text-sm"><p className="font-semibold text-white">{x.witness?.full_name ?? x.witness_name ?? 'غير معروف'}</p>
              <p className="mt-1 whitespace-pre-line text-slate-300">{x.content}</p><p className="mt-1 text-[11px] text-slate-500">أخذها: {x.taker?.full_name} · {fmtDateTime(x.created_at)}</p></li>))}</ul>}</AsyncView>
          {can('investigations.create') && (
            <form className="space-y-3 border-t border-white/[.08] pt-4" onSubmit={async (e) => { e.preventDefault();
              if (await run(async () => { must(await supabase.from('statements').insert({ case_id: c.id, witness_name: form.a, content: form.b, taken_by: profile!.id })); }, 'تمت إضافة الإفادة')) { setForm({ a: '', b: '' }); stm.reload(); } }}>
              <Field label="اسم صاحب الإفادة"><Input required value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} /></Field>
              <Field label="نص الإفادة"><Textarea required value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} /></Field>
              <button className="btn btn-gold" disabled={busy}>إضافة إفادة</button></form>)}
        </div>)}
      {!can('cases.update') && tab === 'info' && <EmptyState title="صلاحية العرض فقط" />}
    </Modal>
  );
}
