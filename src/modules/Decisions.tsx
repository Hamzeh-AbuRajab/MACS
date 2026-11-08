import { useState, type FormEvent } from 'react';
import { Archive, Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge } from '@/components/ui';
import { Check, ConfirmButton, Field, Input, Modal, PageHeader, Select, SubmitRow, Tabs, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { DECISION_TYPE, IMPORTANCE, fmtDate } from '@/lib/format';
import { STATUS_AR, STATUS_TONE, TargetFields } from './shared';

interface D {
  id: string; ref_number: string | null; title: string; body: string; decision_type: string; importance: string; status: string;
  target_department_id: string | null; target_rank_ids: string[] | null; is_public: boolean; issued_at: string;
}

export function Decisions() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'published' | 'draft' | 'archived'>('published');
  const [type, setType] = useState('');
  const [edit, setEdit] = useState<Partial<D> | null>(null);
  const { busy, run } = useAction();
  const s = useAsync(async () => unwrap(await supabase.from('decisions').select('*').order('issued_at', { ascending: false })) as D[], []);
  const rows = (s.data ?? []).filter((d) => d.status === tab && (!type || d.decision_type === type));
  const manage = can('decisions.create') || can('decisions.update');

  return (
    <div className="animate-fade-up">
      <PageHeader title="القرارات العسكرية" desc="القرارات الموجهة إليك أو المنشورة للجميع."
        actions={can('decisions.create') && <button className="btn btn-gold" onClick={() => setEdit({ decision_type: 'general', importance: 'normal', status: 'draft', issued_at: new Date().toISOString() })}><Plus className="h-4 w-4" /> قرار جديد</button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'published', label: 'المنشورة' }, ...(manage ? [{ id: 'draft' as const, label: 'المسودات' }] : []), { id: 'archived', label: 'الأرشيف' }]} />
      <div className="mb-4 max-w-xs"><Select value={type} onChange={setType} placeholder="كل الأنواع" options={Object.entries(DECISION_TYPE).map(([value, label]) => ({ value, label }))} aria-label="النوع" /></div>
      <AsyncView state={{ ...s, data: s.data && rows.length ? rows : (s.data ? [] : undefined) }} emptyTitle="لا توجد قرارات" emptyHint="لا توجد قرارات في هذا القسم.">
        {(list) => (
          <div className="space-y-3">
            {list.map((d) => (
              <article key={d.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Badge tone={IMPORTANCE[d.importance].tone}>{IMPORTANCE[d.importance].label}</Badge>
                  <span className="text-slate-400">{DECISION_TYPE[d.decision_type]}</span>
                  {d.ref_number && <span className="ltr font-mono text-slate-500">#{d.ref_number}</span>}
                  {d.status !== 'published' && <Badge tone={STATUS_TONE[d.status]}>{STATUS_AR[d.status]}</Badge>}
                  <span className="ms-auto text-slate-500">{fmtDate(d.issued_at)}</span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-white">{d.title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-8 text-slate-300">{d.body}</p>
                {manage && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[.06] pt-3">
                    {can('decisions.update') && <button className="btn btn-ghost !py-1 text-xs" onClick={() => setEdit(d)}><Pencil className="h-3.5 w-3.5" /> تعديل</button>}
                    {can('decisions.approve') && d.status === 'draft' && <button className="btn btn-outline !py-1 text-xs" disabled={busy}
                      onClick={() => run(async () => { must(await supabase.from('decisions').update({ status: 'published' }).eq('id', d.id)); s.reload(); }, 'تم نشر القرار وإشعار المستهدفين')}>نشر</button>}
                    {can('decisions.update') && d.status === 'published' && <button className="btn btn-ghost !py-1 text-xs" disabled={busy}
                      onClick={() => run(async () => { must(await supabase.from('decisions').update({ status: 'archived' }).eq('id', d.id)); s.reload(); }, 'تمت الأرشفة')}><Archive className="h-3.5 w-3.5" /> أرشفة</button>}
                    {can('decisions.delete') && <ConfirmButton label="حذف" busy={busy} onConfirm={() => run(async () => { must(await supabase.from('decisions').delete().eq('id', d.id)); s.reload(); }, 'تم الحذف')} />}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </AsyncView>
      {edit && <DecisionForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); s.reload(); }} />}
    </div>
  );
}

function DecisionForm({ initial, onClose, onSaved }: { initial: Partial<D>; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth();
  const [f, setF] = useState(initial);
  const { busy, run } = useAction();
  const set = <K extends keyof D>(k: K, v: D[K]) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const row = { ref_number: f.ref_number || null, title: f.title, body: f.body, decision_type: f.decision_type, importance: f.importance, status: f.status,
      target_department_id: f.target_department_id ?? null, target_rank_ids: f.target_rank_ids ?? null, is_public: !!f.is_public, issued_at: f.issued_at };
    if (await run(async () => { must(f.id ? await supabase.from('decisions').update(row).eq('id', f.id) : await supabase.from('decisions').insert(row)); },
      f.status === 'published' ? 'تم نشر القرار' : 'تم حفظ القرار')) onSaved();
  };
  return (
    <Modal title={f.id ? 'تعديل القرار' : 'قرار جديد'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="النوع"><Select value={f.decision_type ?? 'general'} onChange={(v) => set('decision_type', v)} options={Object.entries(DECISION_TYPE).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="درجة الأهمية"><Select value={f.importance ?? 'normal'} onChange={(v) => set('importance', v)} options={Object.entries(IMPORTANCE).map(([value, v]) => ({ value, label: v.label }))} /></Field>
          <Field label="رقم القرار"><Input className="ltr" value={f.ref_number ?? ''} onChange={(e) => set('ref_number', e.target.value)} /></Field>
          <Field label="تاريخ الإصدار"><Input type="date" value={(f.issued_at ?? '').slice(0, 10)} onChange={(e) => set('issued_at', new Date(e.target.value).toISOString())} /></Field>
        </div>
        <Field label="عنوان القرار"><Input required value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="نص القرار"><Textarea required className="min-h-40" value={f.body ?? ''} onChange={(e) => set('body', e.target.value)} /></Field>
        <TargetFields value={{ target_department_id: f.target_department_id ?? null, target_rank_ids: f.target_rank_ids ?? null }} onChange={(t) => setF((s) => ({ ...s, ...t }))} />
        <Field label="الحالة"><Select value={f.status ?? 'draft'} onChange={(v) => set('status', v)}
          options={[{ value: 'draft', label: 'مسودة' }, ...(can('decisions.approve') ? [{ value: 'published', label: 'نشر الآن' }] : []), { value: 'archived', label: 'مؤرشف' }]} /></Field>
        <Check label="إعلان القرار للزوار في الصفحة الرئيسية" checked={!!f.is_public} onChange={(v) => set('is_public', v)} />
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
