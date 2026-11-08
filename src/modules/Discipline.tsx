import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge } from '@/components/ui';
import { ConfirmButton, Field, Input, Modal, PageHeader, Select, SubmitRow, Table, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { opts } from '@/lib/refs';
import { PENALTY, fmtDate } from '@/lib/format';

interface Rec { id: string; violation_type: string; description: string; evidence: string | null; penalty_type: string; penalty_details: string | null; issued_at: string;
  subject: { full_name: string } | null; rank: { name_ar: string } | null; department: { name_ar: string } | null; issuer: { full_name: string } | null }

export function Discipline() {
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('');
  const { busy, run } = useAction();
  const s = useAsync(async () => unwrap(await supabase.from('disciplinary_records')
    .select('id,violation_type,description,evidence,penalty_type,penalty_details,issued_at,subject:profiles!disciplinary_records_subject_id_fkey(full_name),rank:ranks(name_ar),department:departments(name_ar),issuer:profiles!disciplinary_records_issued_by_fkey(full_name)')
    .order('issued_at', { ascending: false })) as unknown as Rec[], []);
  const rows = (s.data ?? []).filter((r) => !type || r.penalty_type === type);
  return (
    <div className="animate-fade-up">
      <PageHeader title="سجل العقوبات العسكرية" desc="العقوبة تُسجَّل في الملف. التخفيض والفصل الفعليان يتمان من ملف العسكري بقرار."
        actions={can('discipline.create') && <button className="btn btn-gold" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> تسجيل عقوبة</button>} />
      <div className="mb-4 max-w-xs"><Select value={type} onChange={setType} placeholder="كل العقوبات" options={Object.entries(PENALTY).map(([value, label]) => ({ value, label }))} aria-label="النوع" /></div>
      <AsyncView state={{ ...s, data: s.data ? rows : undefined }} emptyTitle="لا توجد عقوبات مسجلة">
        {(list) => (
          <Table head={['العسكري', 'المخالفة', 'العقوبة', 'المُصدِر', 'التاريخ', '']}>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3"><p className="font-semibold text-white">{r.subject?.full_name}</p><p className="text-[11px] text-slate-500">{r.rank?.name_ar} · {r.department?.name_ar ?? 'القيادة العليا'}</p></td>
                <td className="px-4 py-3 text-slate-300">{r.violation_type}<p className="text-[11px] text-slate-500">{r.description}</p>{r.evidence && <p className="text-[11px] text-gold-300">الأدلة: {r.evidence}</p>}</td>
                <td className="px-4 py-3"><Badge tone="bad">{PENALTY[r.penalty_type]}</Badge>{r.penalty_details && <p className="mt-1 text-[11px] text-slate-500">{r.penalty_details}</p>}</td>
                <td className="px-4 py-3 text-slate-300">{r.issuer?.full_name}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(r.issued_at)}</td>
                <td className="px-4 py-3">{can('discipline.delete') && <ConfirmButton label="حذف" busy={busy} onConfirm={() => run(async () => { must(await supabase.from('disciplinary_records').delete().eq('id', r.id)); s.reload(); }, 'تم الحذف')} />}</td>
              </tr>))}
          </Table>)}
      </AsyncView>
      {adding && <Form onClose={() => setAdding(false)} onDone={() => { setAdding(false); s.reload(); }} />}
    </div>
  );
}

function Form({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const people = useAsync(async () => unwrap(await supabase.from('personnel').select('user_id,profile:profiles(full_name)')) as unknown as { user_id: string; profile: { full_name: string } | null }[], []);
  const [f, setF] = useState({ subject_id: '', violation_type: '', description: '', evidence: '', penalty_type: 'warning', penalty_details: '' });
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.from('disciplinary_records').insert({ ...f, evidence: f.evidence || null, penalty_details: f.penalty_details || null })); }, 'تم تسجيل العقوبة وإشعار العسكري')) onDone();
  };
  return (
    <Modal title="تسجيل عقوبة" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="العسكري"><Select required value={f.subject_id} onChange={(v) => setF({ ...f, subject_id: v })} placeholder="اختر" options={opts(people.data, (p) => p.user_id, (p) => p.profile?.full_name ?? '')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع المخالفة"><Input required value={f.violation_type} onChange={(e) => setF({ ...f, violation_type: e.target.value })} /></Field>
          <Field label="العقوبة"><Select value={f.penalty_type} onChange={(v) => setF({ ...f, penalty_type: v })} options={Object.entries(PENALTY).map(([value, label]) => ({ value, label }))} /></Field>
        </div>
        <Field label="وصف المخالفة"><Textarea required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="الأدلة"><Input value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} placeholder="رابط أو وصف" /></Field>
        <Field label="تفاصيل العقوبة (المدة / المبلغ…)"><Input value={f.penalty_details} onChange={(e) => setF({ ...f, penalty_details: e.target.value })} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} label="تسجيل" />
      </form>
    </Modal>
  );
}
